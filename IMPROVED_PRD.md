# MyBlogDaily - Product Requirements Document (PRD)

**버전**: 2.1 (최종 개선판)
**작성일**: 2025-10-22
**LLM**: Claude 4.5 Sonnet
**문서 유형**: 실행 가능한 기술 PRD
**최종 검증**: GPT-5 비평 반영 및 비판적 검토 완료

---

## 🆕 v2.1 주요 개선사항

이 버전은 GPT-5의 비평을 **비판적으로 검토**하여 최선의 옵션만 선택한 최종 개발용 PRD입니다.

### 채택한 개선사항 ✅
1. **현실적 스텔스 한계 명시**
   - navigator.webdriver 완전 은닉 불가능 명시
   - 탐지 가능한 신호들과 현실적 대응 전략 구체화
   - 차단 감지 및 복구 로직 추가

2. **프로덕션 레벨 에러 처리**
   - 지수 백오프 재시도 로직
   - 차단 감지 자동화 (BlockDetector 클래스)
   - 여러 셀렉터 폴백 전략
   - HTTP 상태 코드 검증

3. **고급 Rate Limiting**
   - 기본: 2-5초 랜덤 대기
   - 실패 시: 2s → 4s → 8s → 16s 지수 백오프
   - 연속 3회 실패: 30분 장기 대기

4. **유연한 스케일링 전략**
   - Phase별 명확한 인프라 로드맵
   - 4가지 프록시/분산 옵션 비교 (비용, 복잡도, lock-in)
   - Apify는 최후 수단으로만 제시 (vendor lock-in 경고)

5. **강화된 User-Agent 전략**
   - 4개 실제 모바일 UA 풀에서 랜덤 선택
   - deviceScaleFactor, isMobile, hasTouch 등 세부 설정

### 거부한 제안 ❌
1. **Apify 플랫폼 의존**
   - 이유: 초기 스타트업에 과한 비용 및 vendor lock-in 위험
   - 대안: 자체 구현 → Smartproxy/Bright Data → AWS Lambda 순으로 확장

2. **과도한 인프라 복잡도**
   - 이유: MVP는 단순함 유지, 필요 시 점진적 확장
   - 접근: Phase별 명확한 마일스톤

### 기술적 우선순위
```
🥇 합법적 사용 (사용자 본인 블로그만 수집)
🥈 기본 스텔스 (UA, webdriver 숨김 - 90% 효과)
🥉 적응형 Rate Limiting
📊 실패율 모니터링 및 전략 조정
```

---

## 📌 Executive Summary

### 서비스 개요
블로거가 **1일 1포스트**를 쉽게 작성할 수 있도록 돕는 AI 기반 개인화 뉴스레터 서비스입니다. 사용자의 네이버 블로그를 분석하여 고유한 문체와 관심사를 학습하고, 매일 맞춤형 콘텐츠 아이디어와 초안을 메일로 전달합니다.

### 핵심 가치 제안
- **시간 절약**: 매일 무엇을 쓸지 고민하는 시간을 90% 절감
- **개인화**: 블로거 본인의 문체와 전문성을 그대로 반영
- **지속 가능성**: 완전 자동화된 일일 큐레이션 및 초안 작성

---

## 🎯 비즈니스 목표 & 성공 지표

### 비즈니스 목표
1. 초기 3개월 내 100명의 활성 사용자 확보
2. 사용자의 평균 주간 포스팅 빈도 2배 증가
3. 80% 이상의 뉴스레터 오픈율 달성

### 핵심 성공 지표 (KPI)
| 지표 | 목표 | 측정 방법 |
|------|------|-----------|
| 뉴스레터 오픈율 | 80% | 이메일 오픈 추적 |
| 초안 활용률 | 60% | 사용자 피드백 설문 |
| 서비스 유지율 (30일) | 70% | 월간 활성 사용자 비율 |
| 평균 초안 만족도 | 4.0/5.0 | 주간 설문조사 |

---

## 👥 타겟 사용자

### Primary Persona: "바쁜 전문가 블로거"
- **연령**: 25-45세
- **직업**: 직장인, 프리랜서, 전문가
- **블로그 유형**: IT 트렌드, 부동산, 재테크, 육아, 요리 등
- **Pain Point**:
  - 블로그 주제 찾기에 시간이 오래 걸림
  - 매일 글쓰기 시간 확보가 어려움
  - 트렌드를 놓치는 경우가 많음
- **Goal**: 꾸준한 블로그 운영을 통한 수익 창출 및 개인 브랜딩

---

## 🔧 핵심 기능 명세

### 1. 네이버 로그인 & 블로그 포스트 수집 (하이브리드 방식)
**우선순위**: P0 (필수)

**사용자 플로우**:
```
1. 사용자가 "네이버로 시작하기" 버튼 클릭
2. 네이버 OAuth 2.0 로그인 페이지로 리다이렉션
3. 사용자가 권한 승인
4. Access Token 획득 및 사용자 프로필 조회
5. 사용자의 네이버 블로그 주소 입력 (예: blog.naver.com/user_id)
6. 블로그 포스트 본문 수집 시작 (하이브리드 방식)
```

#### 블로그 포스트 수집 전략 (GPT-5 비평 반영 개선안)

**문제**:
- RSS Feed는 본문 일부만 제공하지만, **링크 목록은 안정적으로 제공**
- 네이버 검색 API도 description만 제공
- 문체 분석을 위해서는 **본문 전체**가 필수
- 데스크톱 iframe 크롤링은 차단 위험이 높음

**해결책**: **RSS-first + 모바일 페이지 우선 크롤링 + Playwright-stealth**

이 방식은 실제 Chrome Extension ([Naver Blog Switch to Mobile](https://chromewebstore.google.com/detail/naver-blog-switch-to-mobi/oeommpbkijhendhlbcpjahomfipicanc))과 한국 개발자 커뮤니티에서 검증된 방법입니다.

##### Step 1: RSS Feed로 포스트 링크 목록 확보 (안정적)

네이버 블로그는 공식적으로 RSS 2.0 피드를 제공합니다. 이를 통해 **최신 30개 포스트의 링크를 안정적으로 확보**할 수 있습니다.

```typescript
import Parser from 'rss-parser';

interface NaverBlogRSSItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;  // 요약본 (본문 X)
}

async function fetchBlogPostLinks(blogId: string): Promise<NaverBlogRSSItem[]> {
  const parser = new Parser();
  const rssUrl = `https://rss.blog.naver.com/${blogId}.xml`;

  try {
    const feed = await parser.parseURL(rssUrl);

    return feed.items.slice(0, 50).map(item => ({
      title: item.title || '',
      link: item.link || '',
      pubDate: item.pubDate || '',
      contentSnippet: item.contentSnippet  // 본문 아님, 요약만
    }));
  } catch (error) {
    console.error(`RSS 파싱 실패 (${blogId}):`, error);
    return [];
  }
}

// 사용 예시
const posts = await fetchBlogPostLinks('user_id');
console.log(`${posts.length}개의 포스트 링크 확보`);
// 출력: 50개의 포스트 링크 확보
```

**장점**:
- ✅ 공식 API이므로 안정적
- ✅ API 호출 제한 없음 (네이버 검색 API 절약)
- ✅ 최신 포스트부터 시간 순으로 정렬됨
- ✅ 차단 위험 없음

**제한**:
- ❌ 보통 최근 30-50개만 제공
- ❌ 본문은 없음 (요약만)

##### Step 2: 모바일 페이지로 본문 전체 크롤링 (프로덕션 레벨)

**왜 모바일 페이지인가?**
- 데스크톱: `#mainFrame` iframe 내부에 복잡한 구조로 본문 로드
- 모바일: **단순한 DOM 구조**로 본문이 직접 노출
- 실제 Chrome Extension도 이 방식 사용 ([검증됨](https://chromewebstore.google.com/detail/naver-blog-switch-to-mobi/oeommpbkijhendhlbcpjahomfipicanc))

```typescript
import { chromium, Browser, BrowserContext, Page } from 'playwright';

// User-Agent 풀 (실제 디바이스 기반)
const MOBILE_USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 12; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36'
];

interface CrawlResult {
  success: boolean;
  title?: string;
  content?: string;
  error?: string;
  retryCount?: number;
}

class ProductionCrawler {
  private blockDetector = new BlockDetector();
  private maxRetries = 3;
  private retryDelayMs = 2000;

  /**
   * 재시도 로직이 포함된 안전한 크롤링
   */
  async crawlWithRetry(postUrl: string): Promise<CrawlResult> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 시도 ${attempt}/${this.maxRetries}: ${postUrl}`);

        const result = await this.crawlBlogPostMobile(postUrl);

        if (result.success) {
          this.blockDetector.reset();
          return result;
        }

        // 차단 감지 시 백오프
        if (result.error?.includes('blocked') || result.error?.includes('captcha')) {
          await this.blockDetector.handleBlock();
        }

      } catch (error) {
        console.error(`❌ 시도 ${attempt} 실패:`, error);

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1); // 지수 백오프
          console.log(`⏳ ${delay}ms 대기 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: `${this.maxRetries}회 재시도 후 실패`
    };
  }

  /**
   * 모바일 페이지 크롤링 (메인 로직)
   */
  private async crawlBlogPostMobile(postUrl: string): Promise<CrawlResult> {
    const mobileUrl = postUrl.replace('blog.naver.com', 'm.blog.naver.com');

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage', // Docker 환경 대응
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    // 랜덤 UA 선택
    const userAgent = MOBILE_USER_AGENTS[Math.floor(Math.random() * MOBILE_USER_AGENTS.length)];

    const context = await browser.newContext({
      userAgent,
      viewport: { width: 375, height: 812 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      deviceScaleFactor: 2, // Retina display
      isMobile: true,
      hasTouch: true
    });

    const page = await context.newPage();

    // Stealth 스크립트
    await this.applyStealthScript(page);

    // 차단 감지 리스너
    page.on('response', async (response) => {
      const isBlocked = await this.blockDetector.detectBlock(response);
      if (isBlocked) {
        console.warn('🚫 차단 신호 감지:', response.url());
      }
    });

    try {
      // 페이지 로드 (타임아웃 설정)
      const response = await page.goto(mobileUrl, {
        waitUntil: 'domcontentloaded', // networkidle은 너무 느림
        timeout: 15000
      });

      // HTTP 상태 확인
      if (!response || response.status() >= 400) {
        throw new Error(`HTTP ${response?.status()}: 페이지 로드 실패`);
      }

      // 차단 페이지 감지
      if (await this.blockDetector.detectBlock(response)) {
        return {
          success: false,
          error: 'blocked'
        };
      }

      // 본문 컨테이너 대기 (여러 셀렉터 시도)
      const selectors = ['.se_component_wrap', '.se-main-container', '#postViewArea'];
      let content: string | null = null;
      let title: string | null = null;

      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
          content = await page.locator(selector).textContent();
          if (content && content.trim().length > 100) break; // 유효한 본문 발견
        } catch {
          continue; // 다음 셀렉터 시도
        }
      }

      // 제목 추출 (여러 셀렉터 시도)
      const titleSelectors = ['.se_title', '.se-title', 'h3.se_textarea'];
      for (const selector of titleSelectors) {
        try {
          title = await page.locator(selector).textContent();
          if (title && title.trim().length > 0) break;
        } catch {
          continue;
        }
      }

      // 검증
      if (!content || content.trim().length < 50) {
        console.warn('⚠️ 본문이 너무 짧거나 비어있음. 데스크톱으로 폴백');
        return await this.crawlBlogPostDesktop(postUrl, browser);
      }

      return {
        success: true,
        title: title?.trim() || '제목 없음',
        content: content.trim()
      };

    } catch (error) {
      console.warn(`⚠️ 모바일 크롤링 실패, 데스크톱으로 폴백: ${postUrl}`);
      return await this.crawlBlogPostDesktop(postUrl, browser);

    } finally {
      await context.close();
      await browser.close();
    }
  }

  /**
   * 데스크톱 iframe 폴백
   */
  private async crawlBlogPostDesktop(postUrl: string, existingBrowser?: Browser): Promise<CrawlResult> {
    const browser = existingBrowser || await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      await page.goto(postUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
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

      const title = await iframe.locator('.se-title').textContent().catch(() => '제목 없음');

      if (!content || content.trim().length < 50) {
        return {
          success: false,
          error: '본문 추출 실패 (데스크톱 폴백)'
        };
      }

      return {
        success: true,
        title: title?.trim() || '제목 없음',
        content: content.trim()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      };
    } finally {
      await page.close();
      if (!existingBrowser) {
        await browser.close();
      }
    }
  }

  /**
   * Stealth 스크립트 적용
   */
  private async applyStealthScript(page: Page): Promise<void> {
    await page.addInitScript(() => {
      // navigator.webdriver 숨김
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      // plugins 추가 (빈 배열 방지)
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // languages 설정
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ko-KR', 'ko', 'en-US', 'en']
      });

      // chrome 객체 추가 (Headless 감지 회피)
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
}
```

**차단 회피 전략** (현실적 접근):

**Phase 1 기본 전략** (MVP):
1. **모바일 UA**: iPhone Safari로 위장
2. **navigator.webdriver 숨김**: `addInitScript`로 undefined 설정
3. **적응형 Rate Limiting**:
   - 기본: 2-5초 랜덤 대기
   - 실패 시: 지수 백오프 (2s → 4s → 8s → 16s)
   - 연속 실패 3회: 30분 대기 후 재시도
4. **브라우저 컨텍스트 재사용**: 같은 세션 유지로 자연스러운 행동 패턴 모방
5. **User-Agent 로테이션**: 실제 모바일 기기 UA 풀에서 랜덤 선택

**Phase 2 고급 전략** (베타 테스트 단계):
```typescript
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());
```

**스텔스 기술의 현실적 한계** (중요):
⚠️ **완벽한 차단 회피는 불가능합니다**. 다음 사항을 인지하고 설계하세요:

1. **navigator.webdriver 한계**:
   - Chromium은 특정 플래그 조합에서 `navigator.webdriver: true`를 노출
   - `addInitScript`로 undefined 설정은 가능하지만, CDP 프로토콜 시그니처는 남음
   - 고급 탐지 시스템은 여러 신호를 종합 분석

2. **탐지 가능한 신호들**:
   - Headless Chrome 특유의 canvas/WebGL 핑거프린트
   - JavaScript 실행 타이밍 패턴
   - 마우스 움직임 부재
   - 일정한 요청 간격

3. **현실적 대응**:
   - ✅ 기본 지표(UA, webdriver, plugins)는 숨김
   - ✅ 인간형 타이밍과 랜덤성 추가
   - ✅ 실패 시 백오프로 블록 위험 감소
   - ❌ 완벽한 회피 시도는 오히려 의심 유발
   - ❌ 과도한 스텔스는 유지보수 비용 증가

**대응 전략 우선순위**:
1. 🥇 **합법적 사용**: 사용자 본인 블로그만 수집 (ToS 준수)
2. 🥈 **기본 스텔스**: UA, webdriver 숨김 (90% 효과)
3. 🥉 **Rate Limiting**: 공격적이지 않은 요청 빈도
4. 📊 **모니터링**: 실패율 추적 및 전략 조정

**차단 감지 및 복구**:
```typescript
class BlockDetector {
  private failureCount = 0;
  private lastFailureTime: Date | null = null;

  async detectBlock(response: Response): Promise<boolean> {
    // CAPTCHA 페이지 감지
    if (response.url().includes('captcha')) return true;

    // 403/429 상태 코드
    if ([403, 429].includes(response.status())) return true;

    // 비정상적인 리다이렉트
    if (response.url().includes('block') || response.url().includes('error')) return true;

    return false;
  }

  async handleBlock(): Promise<void> {
    this.failureCount++;
    this.lastFailureTime = new Date();

    // 지수 백오프
    const backoffMs = Math.min(Math.pow(2, this.failureCount) * 1000, 60000);
    console.warn(`🚫 차단 감지. ${backoffMs}ms 대기 후 재시도 (실패 횟수: ${this.failureCount})`);

    await new Promise(resolve => setTimeout(resolve, backoffMs));

    // 3회 연속 실패 시 장기 대기
    if (this.failureCount >= 3) {
      console.error('❌ 연속 차단 3회. 30분 대기 또는 관리자 알림');
      await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000));
      this.failureCount = 0; // 리셋
    }
  }

  reset() {
    this.failureCount = 0;
    this.lastFailureTime = null;
  }
}
```

**Phase 3-4 스케일업 옵션** (사용자 1,000명+):
차단 위험이 높아지면 다음 옵션 고려:
- **프록시 서비스**: Bright Data, Oxylabs, Smartproxy (Residential proxies)
- **분산 크롤링**: 여러 IP/지역에서 분산 수집
- **클라우드 함수**: AWS Lambda 등으로 IP 자연스럽게 분산
- ⚠️ Apify 같은 플랫폼은 vendor lock-in 위험 - 신중히 검토

##### Step 3: 전체 파이프라인

```typescript
async function collectUserBlogPosts(blogId: string) {
  // 1. RSS로 링크 목록 확보
  const rssItems = await fetchBlogPostLinks(blogId);
  console.log(`RSS에서 ${rssItems.length}개 링크 확보`);

  // 2. 각 포스트 크롤링 (Rate Limiting 적용)
  const posts = [];

  for (const item of rssItems) {
    try {
      const { title, content } = await crawlBlogPostMobile(item.link);

      posts.push({
        postId: extractPostId(item.link),
        title,
        content,
        publishedAt: new Date(item.pubDate),
        link: item.link
      });

      // Rate Limiting: 2-5초 랜덤 대기
      const delay = 2000 + Math.random() * 3000;
      await new Promise(resolve => setTimeout(resolve, delay));

    } catch (error) {
      console.error(`크롤링 실패: ${item.link}`, error);
      continue;  // 실패한 것은 건너뛰기
    }
  }

  console.log(`${posts.length}/${rssItems.length}개 포스트 수집 완료`);
  return posts;
}
```

**기술 스펙**:
- **네이버 OAuth 2.0 인증**
  - Authorization Endpoint: `https://nid.naver.com/oauth2.0/authorize`
  - Token Endpoint: `https://nid.naver.com/oauth2.0/token`
  - 필요 권한: 사용자 기본 프로필 조회
- **네이버 RSS Feed**
  - Endpoint: `https://rss.blog.naver.com/{blogId}.xml`
  - 인증: 불필요
  - 제한: 최신 30-50개
- **Playwright**
  - 브라우저: Chromium (headless mode)
  - 언어: Node.js (TypeScript)
  - 추가 라이브러리: `rss-parser`, `playwright-extra` (선택)

**데이터 저장**:
```typescript
interface UserBlog {
  userId: string;
  naverId: string;
  blogUrl: string;
  accessToken: string;
  refreshToken: string;
  email: string;
  posts: BlogPost[];
  lastSync: Date;
  isActive: boolean;
}

interface BlogPost {
  postId: string;
  title: string;
  content: string;  // HTML 제거된 전체 본문 텍스트
  publishedAt: Date;
  link: string;
  category?: string;
  wordCount: number;  // 분석용
}
```

**성능 최적화**:
- 초기 수집 시 50개 포스트 크롤링: ~5-10분 소요
- 배경 작업으로 처리 (BullMQ 등 작업 큐 사용)
- 사용자에게는 "분석 중입니다. 24시간 내 첫 뉴스레터를 보내드리겠습니다" 안내

---

### 2. 창작 DNA 분석 (고도화된 문체 분석)
**우선순위**: P0 (필수)

**목적**: 블로거의 고유한 문체, 페르소나, 주제 선호도를 **정밀하게** 분석

#### 2.1. 고급 페르소나 & 문체 분석

기존 Gemini 문서에서 제안한 기본 지표 외에 다음을 추가:

```json
{
  "persona_profile": {
    "archetype": "전문가 멘토 | 친근한 이웃 | 객관적 기자",
    "tone_descriptors": ["정보 제공적", "친근한", "유머러스한"],
    "expertise_level": "초보자 | 중급 | 전문가",
    "target_audience": "일반인 | 전문가 | 학생"
  },

  "stylometry": {
    // 기본 지표
    "avg_sentence_length": 18.5,
    "avg_paragraph_length": 3.2,
    "lexical_density": 0.55,
    "vocabulary_richness": 0.68,  // TTR (Type-Token Ratio)

    // 한국어 특화 지표 (Kiwi 형태소 분석기 사용)
    "morphological_patterns": {
      "josa_usage": {  // 조사 사용 패턴
        "은는": 0.12,
        "이가": 0.08,
        "을를": 0.10
      },
      "eomi_usage": {  // 어미 사용 패턴
        "습니다": 0.15,
        "요": 0.05,
        "다": 0.20
      },
      "pos_distribution": {  // 품사 분포
        "명사": 0.35,
        "동사": 0.18,
        "형용사": 0.12,
        "부사": 0.08
      }
    },

    // Function words 분석 (무의식적 사용)
    "function_words": {
      "conjunctions": ["그리고", "하지만", "그래서"],  // 접속사
      "particles": ["은", "는", "이", "가"],  // 조사
      "frequency": 0.22  // 전체 텍스트 중 비율
    },

    // 구문 복잡도
    "syntactic_complexity": {
      "avg_clauses_per_sentence": 1.8,  // 문장당 절 개수
      "modifier_frequency": 0.25,  // 수식어 사용 빈도
      "sentence_variety_score": 0.65  // 문장 구조 다양성
    },

    // 감정 톤 분석
    "emotional_tone": {
      "positive_ratio": 0.55,
      "negative_ratio": 0.10,
      "neutral_ratio": 0.35,
      "dominant_emotion": "긍정적-격려"
    },

    // 읽기 난이도 (Cognitive Load)
    "readability": {
      "flesch_reading_ease_kr": 65.0,  // 한국어 버전
      "avg_syllables_per_word": 2.3,
      "difficulty_level": "중급"
    },

    // 자주 사용하는 표현
    "common_phrases": [
      "~하는 것이 중요합니다",
      "저는 생각합니다",
      "가장 큰 장점은"
    ],

    // 구두점 사용 패턴
    "punctuation_patterns": {
      "exclamation_freq": 0.02,
      "question_freq": 0.05,
      "ellipsis_freq": 0.01,
      "quote_freq": 0.08
    },

    // 문체적 특징 요약
    "style_signature": "짧고 간결한 문장을 선호하며, 전문 용어를 많이 사용하지만 친근한 예시로 설명하는 스타일. 독자에게 직접 말을 거는 듯한 2인칭 사용이 빈번함."
  }
}
```

#### 문체 분석 구현

**Step 1: 한국어 형태소 분석 (Kiwi)**
```typescript
import Kiwi from 'kiwi-js';

const kiwi = await Kiwi.create();

function analyzeMorphology(texts: string[]) {
  const allTokens = [];

  for (const text of texts) {
    const result = kiwi.analyze(text);
    allTokens.push(...result[0].tokens);
  }

  // 조사 빈도 계산
  const josaCount = allTokens.filter(t => t.tag === 'JKS' || t.tag === 'JKO');
  // 어미 빈도 계산
  const eomiCount = allTokens.filter(t => t.tag.startsWith('EF') || t.tag.startsWith('EP'));
  // 품사 분포
  const posDistribution = calculatePOSDistribution(allTokens);

  return {
    josa_usage: calculateJosaPatterns(josaCount),
    eomi_usage: calculateEomiPatterns(eomiCount),
    pos_distribution: posDistribution
  };
}
```

**Step 2: Claude API로 종합 분석**

```typescript
const analysisPrompt = `
당신은 세계 최고 수준의 문체 분석 전문가입니다.
한국어 계산 언어학, 문체론(Stylometry), 페르소나 전략을 결합한 전문성을 가지고 있습니다.

# MISSION
제공된 블로그 포스트 50개를 분석하여 저자의 고유한 '창작 DNA'를 추출하세요.

# INPUT DATA
- 블로그 포스트 텍스트: {posts}
- 형태소 분석 결과: {morphology_analysis}

# ANALYSIS STEPS
단계별로 생각하며 다음을 수행하세요:

## 1단계: 페르소나 정의
- 저자가 글에서 취하는 역할 (멘토/친구/기자/전문가 등)
- 독자와의 관계 설정 방식 (존댓말/반말, 거리감)
- 전문성 수준 판단

## 2단계: 문체적 특징 정량화
- 평균 문장 길이 계산
- 어휘 다양성 (TTR) 계산
- 구두점 사용 빈도 분석
- 자주 반복되는 구문 패턴 3-5개 추출

## 3단계: 한국어 특화 분석
제공된 형태소 분석 결과를 바탕으로:
- 조사 사용 패턴에서 특징 도출
- 어미 선택에서 격식체/비격식체 판단
- 품사 분포로 명사 중심/동사 중심 글쓰기 스타일 파악

## 4단계: 감정 톤 및 읽기 난이도
- 긍정/부정/중립 문장 비율
- 문장 복잡도 평가
- 일반 독자 대상인지, 전문가 대상인지 판단

## 5단계: 문체 서명(Style Signature) 작성
위 모든 분석을 2-3문장으로 요약하여 이 블로거만의 독특한 문체를 정의하세요.

# OUTPUT FORMAT
반드시 다음 JSON 형식으로만 출력하세요:

{출력 스키마}

# EXAMPLES (Few-shot)
<example>
입력: IT 블로거의 리액트 관련 포스트 50개
출력:
{
  "persona_profile": {
    "archetype": "친절한 선배 개발자",
    "tone_descriptors": ["친근한", "실용적", "격려하는"],
    "expertise_level": "중급-고급"
  },
  "stylometry": {
    "avg_sentence_length": 15.2,
    "style_signature": "짧고 명확한 문장으로 복잡한 개념을 쉽게 풀어내며, 코드 예시를 즉시 제공하는 실용적 스타일. '여러분'이라는 호칭으로 독자와 친밀감을 형성함."
  }
}
</example>
`;
```

**Claude 4.5 Sonnet 활용 이유**:
- Extended Thinking 모드로 더 깊은 분석 가능
- 한국어 이해도 우수
- JSON 출력 안정성 높음
- Few-shot learning에 강함

#### 2.2. 주제 & 키워드 분석
```json
{
  "topic_profile": {
    "main_topics": [
      {
        "topic_name": "리액트 개발",
        "coverage": 0.40,  // 전체 포스트 중 40%
        "sub_topics": [
          {
            "sub_topic_name": "상태 관리",
            "keywords": ["useState", "useReducer", "Redux", "Zustand"],
            "secondary_keywords": ["전역 상태", "리렌더링", "성능"]
          },
          {
            "sub_topic_name": "성능 최적화",
            "keywords": ["React.memo", "useMemo", "useCallback", "lazy"],
            "secondary_keywords": ["번들 사이즈", "코드 스플리팅"]
          }
        ]
      }
    ],
    "keyword_importance": {
      // TF-IDF 기반 중요도
      "React": 0.95,
      "컴포넌트": 0.88,
      "useState": 0.75
    }
  }
}
```

#### 2.3. 콘텐츠 유형 분류
- **NEWS_DRIVEN**: 최신 뉴스/트렌드 중심 (IT, 부동산, 주식)
- **EVERGREEN_IDEAS**: 시의성 낮은 교육/하우투 콘텐츠 (요리, 육아, 자기계발)

**분류 로직**:
```python
def classify_content_type(posts):
    time_sensitive_keywords = ['최신', '속보', '발표', '출시', '오늘', '이번주']
    evergreen_keywords = ['방법', '가이드', '팁', '노하우', '추천']

    # 제목 분석
    time_sensitive_count = count_keywords_in_titles(posts, time_sensitive_keywords)
    evergreen_count = count_keywords_in_titles(posts, evergreen_keywords)

    # 발행 간격 분석
    avg_publish_interval = calculate_avg_interval(posts)

    # 시간에 따른 조회수 감소율 (가능하면)
    decay_rate = analyze_view_decay(posts)

    if time_sensitive_count > evergreen_count and avg_publish_interval < 3:
        return 'NEWS_DRIVEN'
    else:
        return 'EVERGREEN_IDEAS'
```

**실행 방식**:
- **초기 분석**: 사용자 가입 후 포스트 수집 완료 시 즉시 실행
- **업데이트**: 매월 1일 자동 재분석 (문체 변화 반영)
- **비용**: Claude API 호출당 ~$0.15 (사용자당 월 1회)

---

### 3. 일일 콘텐츠 큐레이션
**우선순위**: P0 (필수)

**실행 시점**: 매일 오전 6시 (사용자 설정 가능)

#### 3.1. 뉴스 기반 큐레이션 (NEWS_DRIVEN 블로거)

**데이터 소스**:
1. **네이버 뉴스 검색 API**
   - Endpoint: `https://openapi.naver.com/v1/search/news.json`
   - 파라미터: `query={창작DNA의 키워드}`, `display=20`, `sort=date`
   - 제한: 일일 25,000회 (사용자 100명 × 50회 = 5,000회/일 → 충분)

2. **Google News RSS** (보조)
   - URL: `https://news.google.com/rss/search?q={keyword}&hl=ko`

**큐레이션 로직**:
```typescript
async function curateNews(
  creativeDNA: CreativeDNA,
  previouslysentUrls: string[]
): Promise<CuratedNews[]> {

  // 1. 키워드 기반 뉴스 검색
  const keywords = creativeDNA.topic_profile.main_topics
    .flatMap(t => t.sub_topics)
    .flatMap(st => st.keywords)
    .slice(0, 5);  // 상위 5개 키워드만

  let newsResults: NewsItem[] = [];

  for (const keyword of keywords) {
    const news = await naverNewsAPI.search({
      query: keyword,
      display: 10,
      sort: 'date'
    });
    newsResults.push(...news.items);
  }

  // 2. URL 기반 중복 제거
  const uniqueByUrl = newsResults.filter(
    news => !previouslysentUrls.includes(news.link)
  );

  // 3. 의미 기반 중복 제거 (임베딩 유사도)
  const semanticUnique = await semanticDedup(uniqueByUrl, threshold=0.90);

  // 4. 블로거 주제와의 관련성 점수 계산 (Claude API)
  const scored = await scoreRelevance(semanticUnique, creativeDNA);

  // 5. 상위 5개 선정
  const topNews = scored
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 5);

  // 6. 각 뉴스 요약 (Claude API)
  const summaries = await Promise.all(
    topNews.map(news => summarizeNews(news))
  );

  return summaries;
}
```

**의미 기반 중복 제거**:
```typescript
import { OpenAI } from 'openai';

async function semanticDedup(
  newsItems: NewsItem[],
  threshold: number = 0.90
): Promise<NewsItem[]> {

  const openai = new OpenAI();

  // 1. 각 뉴스의 임베딩 생성
  const embeddings = await Promise.all(
    newsItems.map(news =>
      openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: news.title + ' ' + news.description
      })
    )
  );

  // 2. 코사인 유사도 계산하여 중복 필터링
  const unique: NewsItem[] = [];
  const seen: number[] = [];

  for (let i = 0; i < newsItems.length; i++) {
    if (seen.includes(i)) continue;

    let isDuplicate = false;
    for (let j = 0; j < unique.length; j++) {
      const similarity = cosineSimilarity(
        embeddings[i].data[0].embedding,
        embeddings[newsItems.indexOf(unique[j])].data[0].embedding
      );

      if (similarity >= threshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      unique.push(newsItems[i]);
    } else {
      seen.push(i);
    }
  }

  return unique;
}
```

**요약 프롬프트** (Claude 4.5 Sonnet):
```
당신은 편견 없는 뉴스 요약 전문가입니다.

# MISSION
다음 뉴스를 3-4문장의 한국어로 요약하세요.

# RULES (엄격 준수)
1. 주관적 형용사/부사 사용 금지 (예: "놀랍게도", "안타깝게도", "충격적인")
2. 오직 기사에 명시된 사실만 전달
3. 의견이나 주장은 반드시 출처 명시 (예: "업계 관계자는 ~라고 밝혔다")
4. 추상 요약(Abstractive Summarization) 사용 - 문장을 그대로 복사하지 말고 재구성

# INPUT
제목: {news.title}
본문: {news.description}

# OUTPUT FORMAT
간결한 3-4문장의 요약문만 출력하세요. 다른 설명 없이 요약문만.
```

#### 3.2. 에버그린 콘텐츠 큐레이션 (EVERGREEN_IDEAS 블로거)

**데이터 소스**:
1. **Google Trends** (비공식 라이브러리 `google-trends-api`)
2. **YouTube Data API v3**
3. **Medium/Brunch 검색** (웹 스크래핑 또는 검색 API)

**큐레이션 로직**:
```typescript
async function curateEvergreen(
  creativeDNA: CreativeDNA
): Promise<CuratedContent[]> {

  const mainTopics = creativeDNA.topic_profile.main_topics;
  const risingSubtopics: string[] = [];

  // 1. 트렌드 기반 하위 주제 발굴
  for (const topic of mainTopics.slice(0, 3)) {  // 상위 3개 주제
    const trends = await googleTrends.relatedQueries({
      keyword: topic.topic_name,
      geo: 'KR'
    });

    const rising = trends.default.rankedList
      .find(r => r.rankedKeyword.some(k => k.query))
      ?.rankedKeyword.slice(0, 3)
      .map(k => k.query) || [];

    risingSubtopics.push(...rising);
  }

  // 2. 각 하위 주제별 콘텐츠 검색
  const contentCandidates: ContentCandidate[] = [];

  for (const subtopic of risingSubtopics.slice(0, 10)) {
    // YouTube 영상 검색
    const video = await youtubeAPI.search({
      q: subtopic,
      type: 'video',
      order: 'relevance',
      maxResults: 1,
      relevanceLanguage: 'ko'
    });

    // 고품질 아티클 검색 (네이버 블로그 제외)
    const article = await searchQualityArticle(subtopic);

    if (video || article) {
      contentCandidates.push({
        subtopic,
        video: video?.items[0],
        article
      });
    }
  }

  // 3. LLM 기반 품질 평가 (LLM-as-a-Judge)
  const scoredContent = await evaluateContentQuality(
    contentCandidates,
    creativeDNA
  );

  // 4. 상위 5개 선정
  return scoredContent
    .sort((a, b) => b.quality_score - a.quality_score)
    .slice(0, 5);
}
```

**품질 평가 프롬프트** (LLM-as-a-Judge):
```
당신은 콘텐츠 큐레이션 전문가입니다.

# MISSION
제공된 콘텐츠(아티클 또는 영상)를 다음 루브릭으로 평가하세요.

# EVALUATION RUBRIC
각 항목을 1-5점으로 평가하고 근거를 서술하세요:

1. **출처 신뢰도** (1-5점)
   - 해당 분야에서 권위 있는 출처인가?
   - 작성자의 전문성이 검증되었는가?

2. **콘텐츠 깊이 & 독창성** (1-5점)
   - 피상적인 정보를 넘어 깊이 있는 인사이트를 제공하는가?
   - 다른 곳에서 보기 힘든 독창적인 관점이 있는가?

3. **블로거 주제 관련성** (1-5점)
   - 블로거의 창작 DNA와 얼마나 일치하는가?
   - 블로거의 독자층이 관심 가질 만한 내용인가?

4. **실용성 & 적용 가능성** (1-5점)
   - 독자가 실제 삶에 적용할 수 있는 구체적인 팁/정보가 있는가?
   - 추상적이지 않고 실질적인가?

# DECISION RULE
- 평균 3.5점 미만: 제외
- 평균 3.5-4.0점: 보통
- 평균 4.0점 이상: 우수

# INPUT
<콘텐츠>
제목: {content.title}
URL: {content.url}
요약/스크립트 일부: {content.preview}
</콘텐츠>

<블로거 창작 DNA>
{JSON.stringify(creativeDNA, null, 2)}
</블로거 창작 DNA>

# OUTPUT FORMAT
{
  "scores": {
    "credibility": 4,
    "depth": 5,
    "relevance": 4,
    "practicality": 3
  },
  "rationale": {
    "credibility": "업계 최고 전문가가 작성한 아티클로 신뢰도가 높음",
    "depth": "일반적인 설명을 넘어 내부 동작 원리까지 상세히 설명",
    "relevance": "블로거의 핵심 주제와 정확히 일치",
    "practicality": "코드 예시는 있으나 실제 프로젝트 적용법이 부족"
  },
  "average_score": 4.0,
  "recommendation": "INCLUDE"
}
```

---

### 4. AI 초안 작성
**우선순위**: P0 (필수)

#### 4.1. 주제 선정 (네이버 블로그 바이럴 최적화)

**바이럴 가능성 평가 루브릭**:
```typescript
interface ViralScore {
  topic: string;
  scores: {
    expertise_match: number;      // 30% 가중치
    visual_potential: number;      // 25%
    content_depth: number;         // 20%
    engagement_potential: number;  // 15%
    timeliness: number;            // 10%
  };
  weighted_total: number;
  rationale: string;
}
```

**평가 프롬프트** (Claude 4.5 Sonnet Extended Thinking):
```
당신은 네이버 블로그 SEO 및 바이럴 콘텐츠 전문가입니다.

# CONTEXT
네이버는 C-Rank(출처 신뢰도)와 D.I.A.(Deep Intent Analysis) 알고리즘을 사용합니다.
D.I.A.는 특히 다음을 중요시합니다:
- 콘텐츠 독창성
- 1,500자 이상 충분한 길이
- 고품질 원본 사진 사용
- 독자 체류 시간 (참여 유도)

# MISSION
큐레이션된 5개 주제를 평가하여 가장 바이럴될 가능성이 높은 주제 1개를 선정하세요.

# EVALUATION CRITERIA
각 주제를 1-5점으로 평가:

1. **주제 전문성 일치도** (30% 가중치)
   - 블로거의 기존 주제(C-Rank 향상)와 얼마나 일치하는가?
   - 전문성을 강화할 수 있는 주제인가?

2. **시각적 잠재력** (25% 가중치)
   - 고품질 사진/영상을 풍부하게 활용할 수 있는가?
   - 시각적 요소가 필수적인 주제인가? (예: 요리, 여행, 인테리어)

3. **콘텐츠 깊이 가능성** (20% 가중치)
   - 1,500자 이상 깊이 있는 글을 쓸 수 있는가?
   - 피상적이지 않고 전문가 수준 분석이 가능한가?

4. **참여 유도력** (15% 가중치)
   - 독자의 댓글, 질문, 공감을 자연스럽게 유발하는가?
   - 논쟁적이거나 개인적 경험 공유를 요구하는가?

5. **시의성/트렌드** (10% 가중치)
   - 현재 트렌드와 관련이 있는가?
   - 검색량이 증가하는 주제인가?

# INPUT
<블로거 창작 DNA>
{creativeDNA}
</블로거 창작 DNA>

<큐레이션된 주제들>
{curatedTopics}
</큐레이션된 주제들>

# OUTPUT FORMAT
각 주제별 점수와 근거를 제시한 후, 최종 추천 주제 1개를 선정하세요.

{
  "evaluations": [
    {
      "topic": "주제 1",
      "scores": {...},
      "weighted_total": 4.2,
      "rationale": "..."
    },
    ...
  ],
  "recommended_topic": {
    "topic": "선정된 주제",
    "reason": "이 주제를 선택한 이유..."
  }
}
```

#### 4.2. 초안 작성 (문체 모방 + SEO 최적화)

**스타일 주입 프롬프트**:
```
# IDENTITY
당신은 지금부터 "{blogger_name}"의 도플갱어 작가입니다.
당신이 작성하는 모든 글은 아래 '창작 DNA'와 완벽하게 일치해야 합니다.

# CREATIVE DNA (절대 준수)
<persona>
{creativeDNA.persona_profile}
</persona>

<style_guide>
문장 길이: 평균 {avg_sentence_length}자
문단 길이: 평균 {avg_paragraph_length}문장
어휘 밀도: {lexical_density}
자주 사용하는 표현: {common_phrases.join(', ')}
조사 패턴: {josa_usage}
어미 패턴: {eomi_usage}
존댓말 수준: {honorific_usage}
감정 톤: {emotional_tone.dominant_emotion}
</style_guide>

<style_signature>
{creativeDNA.stylometry.style_signature}
</style_signature>

# MISSION
선정된 주제로 네이버 블로그 포스트 초안을 작성하세요.

# REQUIREMENTS

## 1. 제목 제안 (5개)
- 60자 이내
- 주요 키워드 1개 자연스럽게 포함
- 클릭을 유도하는 호기심 자극
- 블로거의 톤 반영

## 2. 메타 설명 제안 (5개)
- 80자 이내
- 핵심 내용 요약
- 키워드 포함

## 3. 본문 작성
### 구조
- 도입부 (100-150자): 독자의 관심 끌기
- H2 제목 3-5개로 섹션 구분
- 각 섹션에 H3 하위 제목 활용
- 결론 + CTA (Call-to-Action)

### 네이버 블로그 최적화
- **최소 1,500자 이상** (D.I.A. 알고리즘)
- 짧은 문단 (3-4문장)
- 중요 내용은 **굵게** 강조
- 이미지 삽입 가이드 최소 3곳 (예: "[이미지: 리액트 컴포넌트 구조 다이어그램]")
- 외부 링크 2-3개 (참고 자료)
- 내부 링크 가이드 1개 (예: "[이전 포스트: useState 완벽 가이드]")
- 독자 참여 유도 질문 (말미에)

### 스타일 제약
- 창작 DNA의 문장 길이, 어휘, 표현 패턴 **엄격히 준수**
- 블로거가 절대 사용하지 않는 표현은 사용 금지
- 블로거의 페르소나에 맞는 톤 유지

# INPUT
<selected_topic>
{selectedTopic}
</selected_topic>

<reference_materials>
{curatedContent}
</reference_materials>

<keywords>
주요 키워드: {primaryKeywords}
보조 키워드: {secondaryKeywords}
</keywords>

# OUTPUT FORMAT
Markdown 형식으로 출력하세요.

## 제목 옵션 (5개)
1. ...
2. ...

## 메타 설명 옵션 (5개)
1. ...
2. ...

## 추천 제목
{가장 좋은 제목 1개}

---

## 본문

{도입부}

### {H2 제목 1}

{본문 내용}

**{굵게 강조할 핵심 내용}**

[이미지: 이미지 설명]

#### {H3 하위 제목}

...

### {H2 제목 2}

...

### 마무리

{결론}

**여러분은 어떻게 생각하시나요? 댓글로 의견을 나눠주세요!** (CTA 예시)
```

**SEO 체크리스트 자동 검증**:
초안 작성 후 다음을 자동 확인:
```typescript
function validateSEO(draft: string, keywords: string[]): SEOValidation {
  return {
    wordCount: draft.length >= 1500,
    h2Count: (draft.match(/^##\s/gm) || []).length >= 3,
    keywordInTitle: keywords.some(k => draft.split('\n')[0].includes(k)),
    imageGuidelines: (draft.match(/\[이미지:/g) || []).length >= 3,
    externalLinks: (draft.match(/\[.*\]\(http/g) || []).length >= 2,
    ctaIncluded: draft.includes('댓글') || draft.includes('의견'),
    score: calculateSEOScore(...)
  };
}
```

---

### 5. 뉴스레터 발송
**우선순위**: P0 (필수)

**발송 시간**: 매일 오전 7시 (사용자별 설정 가능)

**이메일 구조**:
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>오늘의 블로그 아이디어 - {date}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">

  <!-- 헤더 -->
  <div style="background: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h1 style="color: #03C75A; font-size: 26px; margin: 0 0 10px 0;">안녕하세요, {blogger_name}님!</h1>
    <p style="color: #666; font-size: 15px; margin: 0; line-height: 1.6;">
      오늘도 <strong>{blogger_name}</strong> 님만을 위한 맞춤 콘텐츠와 초안을 준비했습니다.
    </p>
  </div>

  <!-- 섹션 1: 오늘의 추천 주제 -->
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 12px; margin-bottom: 20px; color: white;">
    <h2 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">📝 오늘의 추천 주제</h2>
    <h3 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 700;">{recommended_title}</h3>
    <div style="display: flex; gap: 15px; margin-top: 12px; font-size: 14px;">
      <span>⭐ 바이럴 점수: <strong>{viral_score.toFixed(1)}/5.0</strong></span>
      <span>⏱️ 예상 작성 시간: <strong>30분</strong></span>
    </div>
  </div>

  <!-- 섹션 2: 큐레이션된 읽을거리 -->
  <div style="background: white; padding: 25px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #333;">📚 오늘의 읽을거리 (5개)</h2>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
      <!-- 각 항목 -->
      {{#each curatedItems}}
      <tr>
        <td style="padding: 15px 0; border-bottom: 1px solid #eee;">
          <div style="margin-bottom: 8px;">
            <span style="display: inline-block; padding: 3px 8px; background: #e3f2fd; color: #1976d2; border-radius: 4px; font-size: 12px; font-weight: 600;">
              {{this.type}}
            </span>
          </div>
          <p style="margin: 0 0 8px 0; font-size: 15px; line-height: 1.7; color: #333;">
            {{this.summary}}
          </p>
          <a href="{{this.url}}" style="font-size: 13px; color: #03C75A; text-decoration: none; font-weight: 600;">
            자세히 읽기 →
          </a>
        </td>
      </tr>
      {{/each}}
    </table>
  </div>

  <!-- 섹션 3: 작성된 초안 -->
  <div style="background: white; border: 3px solid #03C75A; border-radius: 12px; padding: 25px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 15px 0; font-size: 20px; color: #333;">✍️ AI가 작성한 초안</h2>

    <details style="cursor: pointer;">
      <summary style="color: #03C75A; font-weight: 700; font-size: 16px; padding: 10px 0;">
        초안 전문 보기 (클릭하여 펼치기)
      </summary>

      <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #f0f0f0; font-size: 15px; line-height: 1.8; color: #333;">
        {draft_content_html}
      </div>
    </details>

    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
      <a href="{copy_to_blog_link}" style="display: inline-block; padding: 14px 28px; background: #03C75A; color: white; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(3, 199, 90, 0.3);">
        네이버 블로그에 복사하기
      </a>

      <a href="{regenerate_link}" style="display: inline-block; margin-left: 10px; padding: 14px 28px; background: white; color: #333; text-decoration: none; border-radius: 8px; border: 2px solid #ddd; font-weight: 600; font-size: 16px;">
        다시 생성하기
      </a>
    </div>
  </div>

  <!-- 푸터 -->
  <div style="text-align: center; margin-top: 40px; padding: 20px; background: white; border-radius: 12px;">
    <p style="color: #999; font-size: 13px; margin: 0 0 10px 0;">
      매일 아침 7시, 새로운 아이디어를 받아보세요!
    </p>
    <div style="margin-top: 15px;">
      <a href="{settings_link}" style="color: #666; text-decoration: none; font-size: 13px; margin: 0 10px;">
        ⚙️ 설정 변경
      </a>
      <span style="color: #ddd;">|</span>
      <a href="{feedback_link}" style="color: #666; text-decoration: none; font-size: 13px; margin: 0 10px;">
        💬 피드백 보내기
      </a>
      <span style="color: #ddd;">|</span>
      <a href="{unsubscribe_link}" style="color: #999; text-decoration: none; font-size: 13px; margin: 0 10px;">
        구독 취소
      </a>
    </div>
  </div>

</body>
</html>
```

**이메일 발송 서비스 선택**:

| 서비스 | 무료 티어 | 가격 (유료) | 장점 | 단점 |
|--------|-----------|-------------|------|------|
| **Resend** ✅ | 100통/일 | $20/월 (50,000통) | 개발자 친화적, Next.js 통합 쉬움 | 새로운 서비스 |
| **SendGrid** | 100통/일 | $19.95/월 (50,000통) | 검증된 서비스, 높은 전달률 | 복잡한 UI |
| **AWS SES** | 없음 | $0.10/1,000통 | 매우 저렴 | 초기 설정 복잡 |

**추천**: **Resend** (개발 편의성) 또는 **AWS SES** (비용 효율성)

---

## 🏗️ 기술 아키텍처

### 시스템 구성도

```
┌─────────────────────────────────────────┐
│   사용자 웹앱 (Next.js 14 App Router)   │
│  - 회원가입/로그인                      │
│  - 대시보드 (발송 히스토리, 통계)       │
│  - 설정 (발송 시간, 주제 필터)          │
│  - Vercel 배포                          │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│      Supabase (Backend as a Service)    │
│  - PostgreSQL (사용자/포스트/DNA)       │
│  - pgvector (임베딩 벡터 저장)          │
│  - Authentication (Naver OAuth)         │
│  - Storage (이미지 등)                  │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│   백엔드 로직 (Vercel Functions + Cron) │
│  - /api/collect-posts (포스트 수집)     │
│  - /api/analyze-dna (창작 DNA 분석)     │
│  - /api/curate-daily (일일 큐레이션)    │
│  - /api/generate-draft (초안 작성)      │
│  - /api/send-newsletter (뉴스레터 발송) │
│                                         │
│  Vercel Cron:                           │
│  - 매일 06:00 - 큐레이션 시작           │
│  - 매일 07:00 - 뉴스레터 발송           │
│  - 매월 1일 - DNA 재분석                │
└────────────┬────────────────────────────┘
             │
    ┌────────┼────────┬────────┬──────────┐
    ▼        ▼        ▼        ▼          ▼
┌────────┐ ┌────┐ ┌─────┐ ┌──────┐ ┌──────────┐
│Claude  │ │네이버│ │OpenAI│ │YouTube│ │Resend/   │
│4.5     │ │API   │ │API   │ │API    │ │AWS SES   │
│Sonnet  │ │검색  │ │임베딩│ │검색   │ │이메일    │
└────────┘ └────┘ └─────┘ └──────┘ └──────────┘

┌─────────────────────────────────────────┐
│   작업 큐 (BullMQ + Redis)              │
│  - 포스트 크롤링 (Playwright)           │
│  - DNA 분석 (백그라운드)                │
│  - 이메일 발송 (배치)                   │
│  Upstash Redis (Serverless)             │
└─────────────────────────────────────────┘
```

### 기술 스택

#### 프론트엔드
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.3+
- **Styling**: Tailwind CSS 3.4
- **UI Components**: shadcn/ui (Radix UI 기반)
- **State Management**: Zustand
- **Deployment**: Vercel

#### 백엔드
- **Runtime**: Node.js 20 (Vercel Edge Functions)
- **Database**: Supabase PostgreSQL
- **Vector DB**: Supabase pgvector 확장
- **Authentication**: Supabase Auth + Naver OAuth 2.0
- **Cron Jobs**: Vercel Cron
- **Job Queue**: BullMQ + Upstash Redis

#### AI & External APIs
- **LLM**: Anthropic Claude 4.5 Sonnet
  - 문체 분석, 초안 작성, 품질 평가
  - Extended Thinking 모드 활용
- **Embeddings**: OpenAI `text-embedding-3-small`
  - 의미 기반 중복 제거
- **한국어 NLP**: Kiwi.js (형태소 분석)
- **크롤링**: Playwright (Chromium)

#### External APIs
- **네이버**:
  - 로그인 API (OAuth 2.0)
  - 검색 API (뉴스, 블로그)
- **Google**:
  - Trends (비공식 `google-trends-api`)
  - YouTube Data API v3
- **이메일**: Resend 또는 AWS SES

#### 개발 도구
- **Version Control**: Git + GitHub
- **Package Manager**: pnpm
- **Code Quality**: ESLint, Prettier
- **Type Safety**: TypeScript strict mode
- **Testing**: Vitest, Playwright Test
- **Monitoring**: Sentry + Vercel Analytics

---

## 📊 데이터베이스 스키마

### Supabase PostgreSQL Tables

```sql
-- 사용자 테이블
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  naver_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  blog_url VARCHAR(500) NOT NULL,
  display_name VARCHAR(100),
  access_token TEXT,
  refresh_token TEXT,
  newsletter_time TIME DEFAULT '07:00:00',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 블로그 포스트 테이블
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id VARCHAR(255) NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,  -- 크롤링한 전체 본문
  word_count INTEGER,
  published_at TIMESTAMP WITH TIME ZONE,
  link VARCHAR(500),
  category VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE INDEX idx_posts_user_published ON blog_posts(user_id, published_at DESC);

-- 창작 DNA 테이블
CREATE TABLE creative_dna (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,

  -- Persona
  persona_archetype VARCHAR(100),
  tone_descriptors JSONB,
  expertise_level VARCHAR(50),
  target_audience VARCHAR(50),

  -- Stylometry (기본)
  avg_sentence_length DECIMAL(5,2),
  avg_paragraph_length DECIMAL(4,2),
  lexical_density DECIMAL(4,3),
  vocabulary_richness DECIMAL(4,3),

  -- 한국어 특화
  morphological_patterns JSONB,  -- 조사, 어미, 품사 분포
  function_words JSONB,
  syntactic_complexity JSONB,
  emotional_tone JSONB,
  readability JSONB,

  common_phrases JSONB,
  punctuation_patterns JSONB,
  style_signature TEXT,

  -- 주제
  topic_profile JSONB,
  keyword_importance JSONB,

  -- 분류
  content_type VARCHAR(50),  -- 'NEWS_DRIVEN' or 'EVERGREEN_IDEAS'

  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 큐레이션 히스토리 (중복 방지)
CREATE TABLE curation_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_url VARCHAR(500) NOT NULL,
  content_hash VARCHAR(64) UNIQUE,  -- SHA-256
  content_title TEXT,
  content_summary TEXT,
  content_type VARCHAR(50),  -- 'NEWS' or 'EVERGREEN'
  sent_at DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_curation_user_date ON curation_history(user_id, sent_at DESC);

-- 뉴스레터 발송 로그
CREATE TABLE newsletter_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  email_subject VARCHAR(255),
  recommended_topic VARCHAR(500),
  viral_score DECIMAL(3,2),

  draft_content TEXT,
  draft_word_count INTEGER,

  curated_items JSONB,  -- 5개 큐레이션 목록

  -- 사용자 행동
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_draft BOOLEAN DEFAULT false,
  clicked_regenerate BOOLEAN DEFAULT false,
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_newsletter_user_sent ON newsletter_logs(user_id, sent_at DESC);

-- 임베딩 벡터 테이블 (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE content_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_url VARCHAR(500),
  content_hash VARCHAR(64) UNIQUE,
  content_text TEXT,
  embedding VECTOR(1536),  -- OpenAI embedding dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_embedding_user ON content_embeddings(user_id);

-- 작업 상태 추적
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  job_type VARCHAR(50) NOT NULL,  -- 'COLLECT_POSTS', 'ANALYZE_DNA', 'CURATE', 'DRAFT'
  status VARCHAR(50) DEFAULT 'PENDING',  -- 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED'
  progress INTEGER DEFAULT 0,  -- 0-100
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_jobs_user_status ON jobs(user_id, status, created_at DESC);
```

---

## 🔐 보안 & 개인정보 보호

### 네이버 OAuth 보안
- Access Token 암호화 저장 (Supabase Vault 또는 환경 변수 암호화)
- Refresh Token 자동 갱신 메커니즘
- HTTPS 필수 (Vercel 자동 제공)
- CSRF 토큰 검증 (Supabase Auth 자동 처리)

### 데이터 보호
- 개인정보 최소 수집 원칙 (이메일, 블로그 URL, 네이버 ID만)
- GDPR/PIPA 준수: 사용자 데이터 삭제 요청 지원
- 크롤링한 블로그 포스트는 분석 목적으로만 사용, 재배포 금지
- 암호화: 데이터베이스는 Supabase에서 자동 암호화

### API 키 관리
- 모든 API 키는 Vercel Environment Variables로 관리
- 절대 코드에 하드코딩 금지
- `.env.local.example` 파일로 필요한 키 목록 문서화

### Rate Limiting
- 네이버 API: 일일 25,000회 제한 준수
- Playwright 크롤링: 각 요청 사이 1-2초 대기 (IP 차단 방지)
- 사용자별 API 호출 횟수 모니터링

---

## 💰 비용 추정

### 월간 비용 (사용자 100명 기준)

| 항목 | 비용 | 계산 근거 |
|------|------|-----------|
| **Vercel** | $0 | Hobby Plan (충분) |
| **Supabase** | $0 | Free Tier (500MB DB, 2GB 파일, 500K 엣지 요청) |
| **Upstash Redis** | $0 | Free Tier (10,000 commands/일) |
| **Claude 4.5 Sonnet** | $40-60 | 사용자당 월 1회 DNA 분석 + 일일 초안 작성 |
| **OpenAI Embedding** | $5-8 | 의미 중복 제거 (일 500회 × 30일) |
| **네이버 API** | $0 | 무료 (일 25,000회) |
| **YouTube API** | $0 | 무료 할당량 (일 10,000 요청) |
| **Google Trends** | $0 | 비공식 API 무료 |
| **Resend** | $0 | Free Tier (100통/일) 또는 $20 (3,000통/일) |
| **Playwright** | $0 | 자체 호스팅 (Vercel 서버리스) |
| **합계** | **$45-70** | 사용자당 $0.45-0.70/월 |

### 스케일업 시나리오 (사용자 1,000명)

| 항목 | 비용 |
|------|------|
| Vercel Pro | $20/월 |
| Supabase Pro | $25/월 |
| Upstash Redis | $10/월 |
| Claude API | $400-600/월 |
| OpenAI Embedding | $50/월 |
| Resend | $20/월 |
| **합계** | **$525-725/월** |

### 수익화 시나리오

**월 구독료 모델**:
- Basic: $9.99/월 (일일 뉴스레터)
- Pro: $19.99/월 (일일 뉴스레터 + 주간 분석 리포트 + 우선 지원)

**100명 기준**:
- 매출: $999/월 (Basic만 가정)
- 비용: $70/월
- **순이익: $929/월**

**1,000명 기준**:
- 매출: $9,990/월
- 비용: $725/월
- **순이익: $9,265/월**

---

## 🚀 개발 로드맵

### Phase 1: MVP 개발 (4주)

#### Week 1: 프로젝트 초기 설정 + 인증
- [ ] Next.js 14 프로젝트 생성 (App Router)
- [ ] Supabase 프로젝트 설정
- [ ] DB 스키마 구축
- [ ] 네이버 OAuth 2.0 로그인 구현
- [ ] 사용자 대시보드 UI (기본)

#### Week 2: 블로그 포스트 수집 + DNA 분석
- [ ] 네이버 검색 API 연동
- [ ] Playwright 크롤링 엔진 구현
  - iframe 처리
  - 본문 텍스트 추출
  - 에러 핸들링
- [ ] BullMQ 작업 큐 설정 (Upstash Redis)
- [ ] Kiwi.js 형태소 분석 통합
- [ ] Claude API 연동
- [ ] 창작 DNA 분석 프롬프트 개발
  - 페르소나 분석
  - 문체 분석 (고급 지표 포함)
  - 주제/키워드 추출

#### Week 3: 콘텐츠 큐레이션 시스템
- [ ] 네이버 뉴스 API 연동
- [ ] YouTube Data API 연동
- [ ] Google Trends API 연동 (비공식)
- [ ] OpenAI Embedding API 연동
- [ ] 의미 기반 중복 제거 구현
- [ ] LLM-as-a-Judge 품질 평가 시스템
- [ ] 큐레이션 히스토리 저장

#### Week 4: 초안 작성 + 뉴스레터 발송
- [ ] 주제 선정 로직 (바이럴 점수 평가)
- [ ] 초안 작성 프롬프트 최적화
  - 스타일 주입
  - SEO 최적화
  - 네이버 블로그 가이드라인 준수
- [ ] SEO 체크리스트 자동 검증
- [ ] HTML 이메일 템플릿 디자인
- [ ] Resend 연동
- [ ] Vercel Cron Job 설정
  - 일일 큐레이션 (06:00)
  - 뉴스레터 발송 (07:00)

### Phase 2: 베타 테스트 & 개선 (2주)

#### Week 5: 베타 사용자 모집 & 초기 테스트
- [ ] 10명 베타 사용자 모집 (블로거 커뮤니티)
- [ ] 온보딩 플로우 개선
- [ ] 버그 수정
- [ ] 성능 모니터링 (Sentry 연동)

#### Week 6: 피드백 반영 & 프롬프트 튜닝
- [ ] 사용자 피드백 수집 (설문조사)
- [ ] 초안 품질 평가
  - BERTScore로 문체 유사도 측정
  - ROUGE 스코어로 요약 품질 측정
- [ ] 프롬프트 A/B 테스트
- [ ] 뉴스레터 오픈율 추적
- [ ] 문체 분석 정확도 검증

### Phase 3: 정식 출시 (2주)

#### Week 7: 출시 준비
- [ ] 랜딩 페이지 제작
- [ ] 결제 시스템 연동 (Stripe)
- [ ] 사용 약관 & 개인정보 처리방침
- [ ] 고객 지원 채널 (이메일 또는 Discord)
- [ ] 프로덕션 환경 최적화

#### Week 8: 마케팅 & 론칭
- [ ] Product Hunt 출시
- [ ] 블로거 커뮤니티 홍보
- [ ] SNS 마케팅 (인스타그램, 트위터)
- [ ] 초기 사용자 확보 (목표: 100명)

### Phase 4: 고도화 & 스케일링 (지속적)

#### 기능 고도화
- [ ] 사용자 피드백 학습 시스템
  - 별점 피드백 수집
  - 피드백 데이터로 프롬프트 자동 튜닝
- [ ] A/B 테스트 자동화 (Promptfoo)
- [ ] 다중 블로그 플랫폼 지원
  - 티스토리
  - 브런치
  - Medium
- [ ] 이미지 생성 기능 (DALL-E 3)
- [ ] 음성 변환 (TTS)
- [ ] 모바일 앱 (React Native)

#### 인프라 스케일링 옵션 (사용자 1,000명+ 또는 차단 위험 증가 시)

**크롤링 안정성 강화**:

**옵션 1: 프록시 서비스 통합** (추천)
- **장점**: 구현 간단, vendor lock-in 낮음, 비용 효율적
- **단점**: 직접 관리 필요
- **추천 서비스**:
  - [Bright Data](https://brightdata.com) - Residential proxies, $500/월부터
  - [Oxylabs](https://oxylabs.io) - 기업급 안정성, $300/월부터
  - [Smartproxy](https://smartproxy.com) - 소규모 친화적, $75/월부터

```typescript
// Bright Data 통합 예시
import { chromium } from 'playwright';

const browser = await chromium.launch({
  proxy: {
    server: 'http://brd.superproxy.io:22225',
    username: 'brd-customer-USERNAME',
    password: 'PASSWORD'
  }
});
```

**옵션 2: AWS Lambda + 분산 크롤링**
- **장점**: IP 자연 분산, 비용 최적화, 이미 클라우드 인프라 사용 중이면 유리
- **단점**: 구현 복잡도 증가
- **구현**:
  - Lambda 함수를 여러 리전에 배포
  - SQS로 크롤링 작업 큐 관리
  - 각 리전에서 독립적으로 크롤링

**옵션 3: Apify 플랫폼** (⚠️ 신중히 검토)
- **장점**: 크롤링 특화 플랫폼, 프록시+스케줄링 일체형
- **단점**: vendor lock-in, 높은 비용 ($49/월 시작 + 프록시 비용), 코드 이식성 낮음
- **적합한 경우**: 자체 인프라 관리 리소스가 전혀 없을 때
- **비추천 이유**: 초기 스타트업에는 과한 인프라, 비용 대비 효과 낮음

**옵션 4: Selenium Grid + Docker Swarm**
- **장점**: 완전 자체 호스팅, 비용 절감
- **단점**: DevOps 부담 큰 폭 증가
- **적합한 경우**: 엔지니어링 리소스 충분하고 비용 최소화 필요할 때

**추천 로드맵**:
1. **Phase 1-2**: 자체 구현 (Playwright + 기본 스텔스)
2. **Phase 3** (사용자 500명): Smartproxy/Bright Data 통합 (월 $75-300)
3. **Phase 4** (사용자 2,000명+): AWS Lambda 분산 또는 프록시 서비스 고도화
4. **Phase 5** (엔터프라이즈): 전용 크롤링 인프라 또는 Apify 고려

**비용 비교** (사용자 1,000명 기준):
| 옵션 | 월 비용 | 구현 복잡도 | Vendor Lock-in | 추천도 |
|------|---------|-------------|----------------|--------|
| 자체 구현 (Playwright) | $0 | 낮음 | 없음 | ⭐⭐⭐⭐⭐ (Phase 1-2) |
| Smartproxy | $75-150 | 낮음 | 낮음 | ⭐⭐⭐⭐⭐ (Phase 3) |
| Bright Data | $300-500 | 낮음 | 중간 | ⭐⭐⭐⭐ (Phase 3-4) |
| AWS Lambda 분산 | $100-200 | 높음 | 없음 | ⭐⭐⭐ (Phase 4) |
| Apify | $200-500+ | 중간 | 높음 | ⭐⭐ (최후 수단) |

**모니터링 & 알림**:
- Sentry로 크롤링 실패율 추적
- 성공률 90% 미만 시 Slack 알림
- 차단 감지 시 자동으로 Rate Limiting 조정

---

## 📈 성공 측정 & 반복 개선

### A/B 테스트 계획

#### 1. 초안 작성 프롬프트
- **버전 A**: 간결한 프롬프트 (스타일 가이드만)
- **버전 B**: Few-shot 프롬프트 (2-3개 예시 포함)
- **측정**: 사용자 만족도 (5점 척도), 문체 유사도 (BERTScore)

#### 2. 주제 선정 알고리즘
- **버전 A**: LLM 기반 바이럴 점수
- **버전 B**: 단순 트렌드 점수 (조회수 기반)
- **측정**: 실제 포스팅 후 조회수, 댓글 수

#### 3. 이메일 발송 시간
- **버전 A**: 오전 7시
- **버전 B**: 오전 8시
- **측정**: 이메일 오픈율

### 품질 지표

#### 초안 품질
- **문체 유사도**: BERTScore (목표: 0.85 이상)
- **가독성**: Flesch Reading Ease (목표: 60-80)
- **SEO 점수**: 자체 체크리스트 (목표: 90점 이상)

#### 요약 품질
- **정확도**: ROUGE-L 스코어 (목표: 0.5 이상)
- **간결성**: 요약문 길이 (목표: 100-150자)

#### 사용자 만족도
- **NPS**: Net Promoter Score (목표: 50 이상)
- **별점**: 평균 별점 (목표: 4.0/5.0 이상)

### 피드백 루프

```
사용자 피드백 → 데이터 수집 → 분석 → 프롬프트 개선 → A/B 테스트 → 성능 측정 → 배포 → 반복
```

**구체적 구현**:
1. 뉴스레터에 별점 피드백 버튼 추가 (1-5점)
2. 별점 데이터와 초안 내용을 DB에 저장
3. 주간 단위로 낮은 점수 초안 분석
4. Claude에게 "왜 이 초안이 낮은 점수를 받았는지" 분석 요청
5. 개선 방향 도출 후 프롬프트 업데이트
6. A/B 테스트로 검증

---

## 🛠️ 비개발자를 위한 초기 설정 가이드

### 1단계: 필요한 계정 생성 (모두 무료)

| 서비스 | 용도 | 가입 링크 |
|--------|------|-----------|
| GitHub | 코드 저장소 | [github.com](https://github.com/signup) |
| Vercel | 웹앱 호스팅 | [vercel.com](https://vercel.com/signup) |
| Supabase | 데이터베이스 | [supabase.com](https://supabase.com) |
| Anthropic | Claude API | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI | 임베딩 API | [platform.openai.com](https://platform.openai.com/signup) |
| 네이버 개발자센터 | 네이버 API | [developers.naver.com](https://developers.naver.com) |
| Google Cloud | YouTube API | [console.cloud.google.com](https://console.cloud.google.com) |
| Resend | 이메일 발송 | [resend.com](https://resend.com/signup) |
| Upstash | Redis (작업 큐) | [upstash.com](https://upstash.com) |

### 2단계: API 키 발급 체크리스트

- [ ] **네이버 개발자센터**
  1. [애플리케이션 등록](https://developers.naver.com/apps/#/register)
  2. 애플리케이션 이름: "MyBlogDaily"
  3. 사용 API: "네이버 로그인", "검색"
  4. 환경: "PC 웹"
  5. 서비스 URL: `https://your-app.vercel.app`
  6. Callback URL: `https://your-app.vercel.app/auth/callback/naver`
  7. Client ID 및 Client Secret 복사

- [ ] **Anthropic Claude**
  1. [API Keys 페이지](https://console.anthropic.com/settings/keys)
  2. "Create Key" 클릭
  3. API Key 복사

- [ ] **OpenAI**
  1. [API Keys 페이지](https://platform.openai.com/api-keys)
  2. "Create new secret key" 클릭
  3. API Key 복사

- [ ] **YouTube Data API**
  1. [Google Cloud Console](https://console.cloud.google.com) 접속
  2. 새 프로젝트 생성: "blogger-newsletter"
  3. "APIs & Services" → "Enable APIs and Services"
  4. "YouTube Data API v3" 검색 후 활성화
  5. "Credentials" → "Create Credentials" → "API Key"
  6. API Key 복사

- [ ] **Resend**
  1. [API Keys 페이지](https://resend.com/api-keys)
  2. "Create API Key" 클릭
  3. API Key 복사

- [ ] **Supabase**
  1. [새 프로젝트 생성](https://supabase.com/dashboard/projects)
  2. Project URL 및 Anon Key 복사
  3. Settings → Database → Connection string 복사

### 3단계: 환경 변수 설정

Vercel 대시보드에서 Environment Variables 설정:

```bash
# 네이버
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret

# Claude
ANTHROPIC_API_KEY=your_anthropic_api_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# YouTube
YOUTUBE_API_KEY=your_youtube_api_key

# Resend
RESEND_API_KEY=your_resend_api_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

### 4단계: 프로젝트 배포

1. GitHub에 코드 푸시
2. Vercel에서 "Import Project" 클릭
3. GitHub 저장소 선택
4. 환경 변수 입력
5. "Deploy" 클릭

---

## ⚠️ 주요 제약사항 및 대응

### 1. 네이버 블로그 크롤링

**제약**:
- 네이버는 robots.txt로 크롤링을 제한
- iframe 구조로 인한 복잡도 증가
- Rate limiting (너무 빠른 요청 시 IP 차단)
- 완벽한 차단 회피는 불가능 (Chromium의 구조적 한계)

**대응** (Phase별 전략):

**Phase 1-2 (MVP, ~100명)**:
- ✅ **합법적 크롤링**: 사용자 본인 블로그만 수집 (저작권 문제 없음)
- ✅ **RSS-first 접근**: 링크 목록은 공식 RSS로 안정적 확보
- ✅ **모바일 페이지 우선**: iframe 회피, 단순한 DOM 구조
- ✅ **적응형 Rate Limiting**:
  - 기본 2-5초 랜덤 대기
  - 실패 시 지수 백오프 (2s → 4s → 8s → 16s)
  - 연속 3회 실패 시 30분 대기
- ✅ **기본 스텔스**: UA 로테이션, navigator.webdriver 숨김
- ✅ **BlockDetector**: CAPTCHA/403/429 자동 감지 및 복구
- ✅ **여러 셀렉터 폴백**: 한 방법 실패 시 자동으로 다음 방법 시도
- ✅ **모니터링**: Sentry로 실패율 추적 (목표: 90% 이상 성공)

**Phase 3 (사용자 500명+, 차단 위험 증가 시)**:
- 🔄 **프록시 서비스 통합**: Smartproxy ($75/월) 또는 Bright Data ($300/월)
- 🔄 **playwright-stealth**: 고급 스텔스 라이브러리 적용
- 🔄 **세션 관리**: 같은 IP로 여러 요청 처리 (자연스러운 패턴)

**Phase 4 (사용자 2,000명+)**:
- 🚀 **AWS Lambda 분산**: 여러 리전에서 독립적으로 크롤링
- 🚀 **자동 스케일링**: 실패율에 따라 Rate Limiting 동적 조정
- 🚀 (최후 수단) Apify 등 크롤링 플랫폼 고려

**최후 대안**:
- 사용자에게 포스트 URL 목록 제공 요청
- 또는 복사-붙여넣기 방식 지원

### 2. 네이버 API 제한

**제약**:
- 일일 25,000회 호출 제한
- 검색 결과 최대 1,099개

**대응**:
- **사용량 모니터링**: 사용자 100명 기준 일 5,000회 정도로 충분
- **캐싱**: 같은 검색 쿼리는 1시간 캐싱
- **필요 시**: 네이버 API 제휴 신청 (무료 증량 가능)

### 3. Claude API 비용

**제약**:
- 토큰 비용이 사용자 증가 시 급증

**대응**:
- **프롬프트 최적화**: 불필요한 컨텍스트 제거
- **캐싱**: 창작 DNA는 월 1회만 재분석
- **Prompt Caching**: Anthropic의 프롬프트 캐싱 기능 활용
- **배치 처리**: 가능한 경우 여러 요청 병합

### 4. 이메일 전달률

**제약**:
- 스팸 필터에 걸릴 위험
- 새로운 도메인은 평판이 낮음

**대응**:
- **도메인 인증**: SPF, DKIM, DMARC 레코드 설정
- **구독 취소 링크**: 명확하게 표시
- **Resend 사용**: 검증된 발송 인프라
- **점진적 확장**: 초기에는 적은 수의 이메일로 시작하여 평판 구축

### 5. Playwright 성능

**제약**:
- 크롤링이 느림 (포스트 1개당 3-5초)
- Vercel Serverless 함수는 10초 제한

**대응**:
- **백그라운드 작업**: BullMQ로 작업 큐 사용
- **배치 처리**: 한 번에 10개씩 병렬 크롤링
- **타임아웃**: 30초 이상 걸리면 건너뛰기
- **대안**: AWS Lambda (최대 15분 타임아웃) 또는 전용 서버

---

## 📝 향후 개선 아이디어 (Phase 4+)

### 1. 사용자 피드백 학습 시스템
- 초안에 대한 별점 + 구체적 피드백 수집
- 피드백 데이터로 프롬프트 자동 튜닝
- Fine-tuning용 데이터셋 구축

### 2. 다중 플랫폼 지원
- **티스토리**: RSS Feed 또는 API
- **브런치**: 웹 크롤링
- **Medium**: Medium API
- **크로스 포스팅**: 한 번에 여러 플랫폼 발행

### 3. 이미지 생성
- **썸네일**: DALL-E 3로 자동 생성
- **인포그래픽**: 데이터 시각화 자동화
- **스타일 일관성**: 블로거의 기존 이미지 스타일 학습

### 4. 음성 변환 (TTS)
- OpenAI TTS로 초안을 음성 파일로 변환
- 출퇴근 중 듣기 가능
- 팟캐스트 자동 생성

### 5. 커뮤니티 기능
- 블로거 간 초안 공유 및 피드백
- 베스트 초안 갤러리
- 문체 스타일 마켓플레이스

### 6. 고급 분석 대시보드
- 블로그 성장 추적 (조회수, 댓글 수)
- SEO 점수 추이
- 문체 변화 시각화

### 7. AI 편집자 모드
- 사용자가 작성한 초안을 블로거 문체로 리라이팅
- 맞춤법 및 문법 교정
- SEO 개선 제안

---

## 📚 참고 자료

### 공식 문서
- [네이버 개발자센터](https://developers.naver.com)
- [Anthropic Claude API](https://docs.anthropic.com)
- [OpenAI API](https://platform.openai.com/docs)
- [Supabase 문서](https://supabase.com/docs)
- [Playwright 문서](https://playwright.dev)
- [Vercel 문서](https://vercel.com/docs)
- [Resend 문서](https://resend.com/docs)

### 학술 자료
- [Stylometry 가이드](https://programminghistorian.org/en/lessons/introduction-to-stylometry-with-python)
- [Text Style Transfer 연구](https://arxiv.org/abs/2401.05707)
- [LLM-based Style Transfer](https://aclanthology.org/2024.naacl-srw.21/)

### 네이버 블로그 SEO
- [네이버 검색 가이드](https://searchadvisor.naver.com)
- [D.I.A. 알고리즘 설명](https://blog.naver.com/blogpeople/222345678901)

---

## 🎓 개발 시작 전 체크리스트

### 기술적 이해도 확인
- [ ] TypeScript 기본 문법 이해
- [ ] Next.js App Router 개념 이해
- [ ] REST API 개념 이해
- [ ] 비동기 프로그래밍 (async/await) 이해
- [ ] PostgreSQL 기본 쿼리 이해

### 계정 및 API 키 준비
- [ ] 모든 필수 서비스 가입 완료
- [ ] API 키 발급 완료
- [ ] 환경 변수 준비 완료

### 개발 환경 구축
- [ ] Node.js 20+ 설치
- [ ] pnpm 설치
- [ ] Git 설치
- [ ] VS Code 설치
- [ ] GitHub 저장소 생성

### 학습 자료
- [ ] Next.js 공식 튜토리얼 완료
- [ ] Supabase 퀵스타트 완료
- [ ] Playwright 기본 예제 실습

---

## 🚦 다음 단계

1. **PRD 검토**: 이 문서를 읽고 질문사항 정리
2. **기술 스택 학습**: 위 체크리스트의 기본 개념 학습
3. **계정 생성**: 모든 필수 서비스 가입
4. **프로젝트 킥오프**: Week 1 개발 시작

---

**문서 버전**: 2.1 (최종 개선판)
**마지막 업데이트**: 2025-10-22
**작성자**: Claude 4.5 Sonnet + Yechan Ahn
**검증**: GPT-5 비평 반영 (비판적 검토 완료)
**개발 준비 상태**: ✅ Ready for Development

---

## 📋 개발 시작 전 최종 체크리스트

### 핵심 의사결정 확인
- [ ] **크롤링 전략 이해**: RSS-first + 모바일 우선 + 데스크톱 폴백
- [ ] **스텔스 한계 인지**: 완벽한 차단 회피 불가능, 90% 성공률 목표
- [ ] **Phase별 로드맵 숙지**: 자체 구현 → 프록시 → 분산 크롤링
- [ ] **Apify 경고 이해**: Vendor lock-in 위험, 최후 수단으로만 고려

### 기술적 준비
- [ ] TypeScript, Next.js 14, Playwright 기본 이해
- [ ] 모든 API 키 발급 완료 (네이버, Claude, OpenAI 등)
- [ ] Supabase 프로젝트 생성 및 DB 스키마 준비
- [ ] Vercel 계정 생성 및 배포 환경 이해

### 예상 개발 기간
- **Phase 1 MVP**: 4주 (핵심 기능 구현)
- **Phase 2 베타**: 2주 (테스트 및 개선)
- **Phase 3 출시**: 2주 (마케팅 및 론칭)
- **총 기간**: 8주

### 예상 초기 비용 (사용자 100명 기준)
- **Phase 1-2**: $45-70/월 (API 비용만)
- **Phase 3**: $120-220/월 (프록시 추가 시)
- **수익화**: $9.99/월 × 100명 = $999/월
- **초기 순이익**: $780-930/월

---

## 부록: 네이버 블로그 크롤링 상세 가이드

### RSS-first + 모바일 우선 크롤러 클래스

```typescript
// lib/crawler/naver-blog-crawler.ts
import { chromium, Browser, BrowserContext } from 'playwright';
import Parser from 'rss-parser';

interface BlogPost {
  postId: string;
  title: string;
  content: string;
  publishedAt: Date;
  link: string;
  success: boolean;
  error?: string;
}

export class NaverBlogCrawler {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private rssParser: Parser;

  constructor() {
    this.rssParser = new Parser();
  }

  async init() {
    if (this.browser) return;

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    // 모바일 컨텍스트 생성 (재사용)
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      viewport: { width: 375, height: 812 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul'
    });
  }

  /**
   * Step 1: RSS로 포스트 링크 목록 확보
   */
  async fetchPostLinks(blogId: string): Promise<Array<{ title: string; link: string; pubDate: string }>> {
    const rssUrl = `https://rss.blog.naver.com/${blogId}.xml`;

    try {
      const feed = await this.rssParser.parseURL(rssUrl);

      return feed.items.slice(0, 50).map(item => ({
        title: item.title || '',
        link: item.link || '',
        pubDate: item.pubDate || ''
      }));
    } catch (error) {
      console.error(`RSS 파싱 실패 (${blogId}):`, error);
      return [];
    }
  }

  /**
   * Step 2: 모바일 페이지로 본문 크롤링
   */
  async crawlPostMobile(postUrl: string): Promise<BlogPost> {
    if (!this.context) {
      await this.init();
    }

    const mobileUrl = postUrl.replace('blog.naver.com', 'm.blog.naver.com');
    const page = await this.context!.newPage();

    // navigator.webdriver 숨기기
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
    });

    try {
      await page.goto(mobileUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // 모바일 페이지 셀렉터 (iframe 없음)
      await page.waitForSelector('.se_component_wrap', {
        state: 'visible',
        timeout: 10000
      });

      const content = await page.locator('.se_component_wrap').textContent();
      const title = await page.locator('.se_title').textContent();

      return {
        postId: this.extractPostId(postUrl),
        title: title?.trim() || '',
        content: content?.trim() || '',
        publishedAt: new Date(),
        link: postUrl,
        success: true
      };

    } catch (error) {
      console.warn(`모바일 크롤링 실패, 데스크톱으로 폴백: ${postUrl}`);
      await page.close();
      return this.crawlPostDesktop(postUrl);
    } finally {
      await page.close();
    }
  }

  /**
   * 폴백: 데스크톱 iframe 방식
   */
  private async crawlPostDesktop(postUrl: string): Promise<BlogPost> {
    const page = await this.context!.newPage();

    try {
      await page.goto(postUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // iframe 전환
      const iframe = page.frameLocator('#mainFrame');
      await iframe.locator('.se-main-container').waitFor({ timeout: 10000 });

      const content = await iframe.locator('.se-main-container').textContent();
      const title = await iframe.locator('.se-title').textContent();

      return {
        postId: this.extractPostId(postUrl),
        title: title?.trim() || '',
        content: content?.trim() || '',
        publishedAt: new Date(),
        link: postUrl,
        success: true
      };

    } catch (error) {
      return {
        postId: this.extractPostId(postUrl),
        title: '',
        content: '',
        publishedAt: new Date(),
        link: postUrl,
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      };
    } finally {
      await page.close();
    }
  }

  /**
   * 전체 파이프라인: RSS + 모바일 크롤링
   */
  async collectBlogPosts(blogId: string): Promise<BlogPost[]> {
    await this.init();

    // Step 1: RSS로 링크 확보
    const links = await this.fetchPostLinks(blogId);
    console.log(`📋 RSS에서 ${links.length}개 링크 확보`);

    const posts: BlogPost[] = [];

    // Step 2: 각 링크 크롤링 (Rate Limiting)
    for (const [index, link] of links.entries()) {
      try {
        const post = await this.crawlPostMobile(link.link);
        post.publishedAt = new Date(link.pubDate);

        posts.push(post);

        console.log(`✅ [${index + 1}/${links.length}] ${link.title.substring(0, 30)}...`);

        // Rate Limiting: 2-5초 랜덤 대기
        if (index < links.length - 1) {
          const delay = 2000 + Math.random() * 3000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error) {
        console.error(`❌ 크롤링 실패: ${link.link}`, error);
        continue;
      }
    }

    console.log(`🎉 ${posts.filter(p => p.success).length}/${links.length}개 포스트 수집 완료`);
    return posts;
  }

  private extractPostId(url: string): string {
    const match = url.match(/\/(\d+)$/);
    return match ? match[1] : '';
  }

  async close() {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// 사용 예시
async function example() {
  const crawler = new NaverBlogCrawler();

  try {
    const posts = await crawler.collectBlogPosts('user_id');

    for (const post of posts) {
      if (post.success) {
        console.log(`제목: ${post.title}`);
        console.log(`본문: ${post.content.substring(0, 100)}...`);
        console.log(`날짜: ${post.publishedAt}`);
        console.log('---');
      }
    }
  } finally {
    await crawler.close();
  }
}
```

### BullMQ 작업 큐 설정

```typescript
// lib/queue/collect-posts-queue.ts
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis({
  host: process.env.UPSTASH_REDIS_HOST,
  port: Number(process.env.UPSTASH_REDIS_PORT),
  password: process.env.UPSTASH_REDIS_PASSWORD,
  maxRetriesPerRequest: null
});

export const collectPostsQueue = new Queue('collect-posts', { connection });

// Worker
export const collectPostsWorker = new Worker(
  'collect-posts',
  async (job) => {
    const { userId, blogUrl, postLinks } = job.data;

    const crawler = new NaverBlogCrawler();

    try {
      const results = await crawler.crawlMultiple(postLinks);

      // DB에 저장
      for (const [link, result] of results) {
        if (result.success) {
          await supabase.from('blog_posts').insert({
            user_id: userId,
            post_id: extractPostId(link),
            title: '...', // 네이버 검색 API에서 가져온 제목
            content: result.content,
            link
          });
        }
      }

      return { success: true, count: results.size };
    } finally {
      await crawler.close();
    }
  },
  { connection }
);
```

---

**이 PRD는 실제 개발 가능한 수준으로 작성되었습니다.**
**질문이나 추가 설명이 필요하시면 언제든 말씀해주세요!**
