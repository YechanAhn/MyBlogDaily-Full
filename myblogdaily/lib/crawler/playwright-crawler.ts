/**
 * Playwright 기반 네이버 블로그 크롤러
 *
 * 전략:
 * 1. 모바일 페이지 우선 크롤링 (단순한 DOM 구조)
 * 2. 실패 시 데스크톱 iframe 폴백
 * 3. 차단 감지 및 자동 재시도
 * 4. Rate Limiting으로 자연스러운 간격 유지
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { BlockDetector } from './block-detector';
import { crawlerLogger as logger } from '@/lib/utils/logger';
import { getEnv, getEnvNumber, getEnvBoolean } from '@/lib/utils/env-validator';

/**
 * 크롤링 결과
 */
export interface CrawlResult {
  success: boolean;
  title?: string;
  content?: string;
  publishedAt?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  error?: string;
  retryCount?: number;
  method?: 'mobile' | 'desktop';  // 어떤 방법으로 크롤링했는지
}

/**
 * 크롤러 설정
 */
export interface CrawlerConfig {
  headless: boolean;
  maxRetries: number;
  timeoutMs: number;
  rateLimitMinMs: number;
  rateLimitMaxMs: number;
}

/**
 * User-Agent 풀 (실제 모바일 디바이스 기반)
 */
const MOBILE_USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 12; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36'
];

/**
 * 프로덕션급 크롤러 클래스
 */
export class PlaywrightCrawler {
  private blockDetector: BlockDetector;
  private config: CrawlerConfig;
  private browser?: Browser;

  constructor(config?: Partial<CrawlerConfig>) {
    this.blockDetector = new BlockDetector();
    this.config = {
      headless: getEnvBoolean('CRAWLER_HEADLESS', true),
      maxRetries: getEnvNumber('CRAWLER_MAX_RETRIES', 3),
      timeoutMs: getEnvNumber('CRAWLER_TIMEOUT_MS', 15000),
      rateLimitMinMs: getEnvNumber('CRAWLER_RATE_LIMIT_MIN_MS', 2000),
      rateLimitMaxMs: getEnvNumber('CRAWLER_RATE_LIMIT_MAX_MS', 5000),
      ...config
    };
  }

  /**
   * 브라우저 인스턴스 획득 (재사용)
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      logger.info('Chromium 브라우저 실행 중...');

      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });
    }

    return this.browser;
  }

  /**
   * 브라우저 종료
   */
  async closeBrowser(): Promise<void> {
    if (this.browser && this.browser.isConnected()) {
      await this.browser.close();
      this.browser = undefined;
      logger.info('브라우저 종료');
    }
  }

  /**
   * 재시도 로직이 포함된 안전한 크롤링
   */
  async crawlWithRetry(postUrl: string): Promise<CrawlResult> {
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      logger.info(`🔄 크롤링 시도 ${attempt}/${this.config.maxRetries}: ${postUrl}`);

      // Rate Limiting (첫 시도가 아닌 경우만)
      if (attempt > 1) {
        await this.blockDetector.randomDelay(
          this.config.rateLimitMinMs,
          this.config.rateLimitMaxMs
        );
      }

      try {
        const result = await this.crawlBlogPostMobile(postUrl);

        if (result.success) {
          this.blockDetector.reset();
          logger.success(`✅ 크롤링 성공: ${postUrl} (${result.method} 방식)`);
          return { ...result, retryCount: attempt };
        }

        // 차단 감지 시 백오프
        if (result.error?.includes('blocked') || result.error?.includes('captcha')) {
          await this.blockDetector.handleBlock();
        }

      } catch (error) {
        logger.error(`❌ 시도 ${attempt} 실패: ${postUrl}`, error);

        if (attempt < this.config.maxRetries) {
          const delay = Math.pow(2, attempt - 1) * this.config.rateLimitMinMs;
          logger.warn(`⏳ ${delay}ms 대기 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: `${this.config.maxRetries}회 재시도 후 실패`,
      retryCount: this.config.maxRetries
    };
  }

  /**
   * 모바일 페이지 크롤링 (메인 로직)
   */
  private async crawlBlogPostMobile(postUrl: string): Promise<CrawlResult> {
    const mobileUrl = postUrl.replace('blog.naver.com', 'm.blog.naver.com');
    const browser = await this.getBrowser();

    // 랜덤 UA 선택
    const userAgent = MOBILE_USER_AGENTS[Math.floor(Math.random() * MOBILE_USER_AGENTS.length)];

    const context = await browser.newContext({
      userAgent,
      viewport: { width: 375, height: 812 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });

    const page = await context.newPage();

    // 스텔스 스크립트 적용
    await this.applyStealthScript(page);

    // 차단 감지 리스너
    let isBlocked = false;
    page.on('response', async (response) => {
      if (await this.blockDetector.detectBlock(response)) {
        isBlocked = true;
        logger.warn('🚫 차단 신호 감지:', response.url());
      }
    });

    try {
      logger.debug(`모바일 페이지 크롤링: ${mobileUrl}`);

      // 페이지 로드
      const response = await page.goto(mobileUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeoutMs
      });

      // HTTP 상태 확인
      if (!response || response.status() >= 400) {
        throw new Error(`HTTP ${response?.status()}: 페이지 로드 실패`);
      }

      // 차단 페이지 감지
      if (isBlocked) {
        return {
          success: false,
          error: 'blocked',
          method: 'mobile'
        };
      }

      // 본문 추출
      const { title, content, publishedAt } = await this.extractMobileContent(page);

      // 통계 추출 (선택)
      const { viewCount, likeCount, commentCount } = await this.extractMobileStats(page);

      // 검증
      if (!content || content.trim().length < 50) {
        logger.warn('⚠️  모바일 본문이 너무 짧음. 데스크톱으로 폴백');
        await context.close();
        return await this.crawlBlogPostDesktop(postUrl);
      }

      await context.close();

      return {
        success: true,
        title: title?.trim() || '제목 없음',
        content: content.trim(),
        publishedAt,
        viewCount,
        likeCount,
        commentCount,
        method: 'mobile'
      };

    } catch (error) {
      logger.warn(`⚠️  모바일 크롤링 실패, 데스크톱으로 폴백: ${postUrl}`);
      logger.debug('모바일 에러:', error);

      await context.close();
      return await this.crawlBlogPostDesktop(postUrl);
    }
  }

  /**
   * 모바일 페이지에서 콘텐츠 추출
   */
  private async extractMobileContent(page: Page): Promise<{
    title?: string;
    content?: string;
    publishedAt?: string;
  }> {
    // 여러 셀렉터 시도
    const contentSelectors = [
      '.se_component_wrap',
      '.se-main-container',
      '#postViewArea',
      '.post_ct'
    ];

    const titleSelectors = [
      '.se_title',
      '.se-title',
      'h3.se_textarea',
      '.tit_h3'
    ];

    let content: string | null = null;
    let title: string | null = null;

    // 본문 추출
    for (const selector of contentSelectors) {
      try {
        await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
        content = await page.locator(selector).textContent();
        if (content && content.trim().length > 100) break;
      } catch {
        continue;
      }
    }

    // 제목 추출
    for (const selector of titleSelectors) {
      try {
        title = await page.locator(selector).textContent();
        if (title && title.trim().length > 0) break;
      } catch {
        continue;
      }
    }

    // 발행일 추출 (선택)
    let publishedAt: string | undefined;
    try {
      const dateText = await page.locator('.se_publishDate, .date').textContent();
      publishedAt = dateText?.trim();
    } catch {
      // 발행일 없음
    }

    return { title: title || undefined, content: content || undefined, publishedAt };
  }

  /**
   * 모바일 페이지에서 통계 추출
   */
  private async extractMobileStats(page: Page): Promise<{
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;
  }> {
    const stats: any = {};

    try {
      // 조회수
      const viewText = await page.locator('.se_viewCount, .view').textContent();
      if (viewText) {
        stats.viewCount = parseInt(viewText.replace(/[^0-9]/g, ''), 10) || 0;
      }
    } catch {}

    try {
      // 공감수
      const likeText = await page.locator('.se_likeCount, .like').textContent();
      if (likeText) {
        stats.likeCount = parseInt(likeText.replace(/[^0-9]/g, ''), 10) || 0;
      }
    } catch {}

    try {
      // 댓글수
      const commentText = await page.locator('.se_commentCount, .cmt').textContent();
      if (commentText) {
        stats.commentCount = parseInt(commentText.replace(/[^0-9]/g, ''), 10) || 0;
      }
    } catch {}

    return stats;
  }

  /**
   * 데스크톱 iframe 폴백
   */
  private async crawlBlogPostDesktop(postUrl: string): Promise<CrawlResult> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      logger.debug(`데스크톱 페이지 크롤링 (iframe): ${postUrl}`);

      await page.goto(postUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeoutMs
      });

      // iframe 전환
      const iframe = page.frameLocator('#mainFrame');

      // 여러 셀렉터 시도
      const selectors = ['.se-main-container', '.se_component_wrap', '#postViewArea'];
      let content: string | null = null;

      for (const selector of selectors) {
        try {
          await iframe.locator(selector).waitFor({ timeout: 5000 });
          content = await iframe.locator(selector).textContent();
          if (content && content.trim().length > 100) break;
        } catch {
          continue;
        }
      }

      const title = await iframe.locator('.se-title, .se_title').textContent().catch(() => '제목 없음');

      if (!content || content.trim().length < 50) {
        return {
          success: false,
          error: '본문 추출 실패 (데스크톱 폴백)',
          method: 'desktop'
        };
      }

      return {
        success: true,
        title: title?.trim() || '제목 없음',
        content: content.trim(),
        method: 'desktop'
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        method: 'desktop'
      };
    } finally {
      await page.close();
    }
  }

  /**
   * 스텔스 스크립트 적용
   */
  private async applyStealthScript(page: Page): Promise<void> {
    await page.addInitScript(() => {
      // navigator.webdriver 숨김
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      // plugins 추가
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // languages 설정
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ko-KR', 'ko', 'en-US', 'en']
      });

      // chrome 객체 추가
      (window as any).chrome = {
        runtime: {}
      };

      // permissions 쿼리 오버라이드
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters)
      );
    });
  }

  /**
   * 크롤러 통계
   */
  getStats() {
    return this.blockDetector.getStats();
  }
}

/**
 * 전역 크롤러 인스턴스
 */
export const crawler = new PlaywrightCrawler();
