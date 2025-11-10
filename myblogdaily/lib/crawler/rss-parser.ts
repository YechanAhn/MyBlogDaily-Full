/**
 * 네이버 블로그 RSS 파서
 *
 * 용도:
 * - 네이버 블로그의 공식 RSS 피드를 파싱하여 포스트 링크 목록 확보
 * - 최신 30-50개 포스트의 메타데이터 수집
 * - 크롤링 대상 URL 목록 생성
 */

import Parser from 'rss-parser';
import { logger } from '@/lib/utils/logger';

/**
 * RSS 피드 아이템
 */
export interface NaverBlogRSSItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;  // 요약본 (본문 아님)
  categories?: string[];
}

/**
 * RSS 파싱 결과
 */
export interface RSSParseResult {
  success: boolean;
  posts: NaverBlogRSSItem[];
  error?: string;
  feedTitle?: string;
  feedDescription?: string;
}

/**
 * 네이버 블로그 RSS 파서 클래스
 */
export class NaverBlogRSSParser {
  private parser: Parser;
  private baseUrl = 'https://rss.blog.naver.com';

  constructor() {
    this.parser = new Parser({
      customFields: {
        item: [
          ['category', 'categories', { keepArray: true }]
        ]
      }
    });
  }

  /**
   * 네이버 블로그 ID로부터 RSS URL 생성
   */
  private getRSSUrl(blogId: string): string {
    return `${this.baseUrl}/${blogId}.xml`;
  }

  /**
   * 블로그 ID 유효성 검증
   */
  private validateBlogId(blogId: string): boolean {
    // 영문, 숫자, 언더스코어만 허용 (3~20자)
    const blogIdPattern = /^[a-zA-Z0-9_]{3,20}$/;
    return blogIdPattern.test(blogId);
  }

  /**
   * RSS 피드에서 포스트 링크 목록 가져오기
   *
   * @param blogId 네이버 블로그 ID (예: 'user_id')
   * @param limit 최대 포스트 수 (기본: 50)
   * @returns 파싱 결과
   */
  async fetchBlogPostLinks(
    blogId: string,
    limit: number = 50
  ): Promise<RSSParseResult> {
    const startTime = Date.now();
    logger.info(`RSS 파싱 시작: ${blogId} (최대 ${limit}개)`);

    // 블로그 ID 검증
    if (!this.validateBlogId(blogId)) {
      logger.error(`잘못된 블로그 ID: ${blogId}`);
      return {
        success: false,
        posts: [],
        error: '잘못된 블로그 ID 형식입니다. (영문, 숫자, 언더스코어만 허용, 3-20자)'
      };
    }

    const rssUrl = this.getRSSUrl(blogId);

    try {
      // RSS 피드 파싱
      const feed = await this.parser.parseURL(rssUrl);

      // 아이템이 없는 경우
      if (!feed.items || feed.items.length === 0) {
        logger.warn(`블로그 ${blogId}에 포스트가 없습니다.`);
        return {
          success: true,
          posts: [],
          feedTitle: feed.title,
          feedDescription: feed.description
        };
      }

      // 포스트 목록 변환 및 정규화
      const posts: NaverBlogRSSItem[] = feed.items
        .slice(0, limit)
        .map(item => ({
          title: item.title?.trim() || '제목 없음',
          link: this.normalizePostUrl(item.link || ''),
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          contentSnippet: item.contentSnippet?.trim(),
          categories: item.categories as string[] | undefined
        }))
        .filter(post => post.link !== '');  // 링크가 없는 항목 제외

      const duration = Date.now() - startTime;
      logger.success(
        `RSS 파싱 완료: ${posts.length}개 포스트 (${duration}ms)`,
        { blogId, count: posts.length }
      );

      return {
        success: true,
        posts,
        feedTitle: feed.title,
        feedDescription: feed.description
      };

    } catch (error) {
      logger.error(`RSS 파싱 실패: ${blogId}`, error);

      // 에러 메시지 분석
      let errorMessage = '알 수 없는 오류가 발생했습니다.';

      if (error instanceof Error) {
        if (error.message.includes('404')) {
          errorMessage = '존재하지 않는 블로그입니다.';
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
          errorMessage = '네트워크 연결에 실패했습니다.';
        } else if (error.message.includes('Invalid XML')) {
          errorMessage = 'RSS 피드 형식이 올바르지 않습니다.';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        posts: [],
        error: errorMessage
      };
    }
  }

  /**
   * 포스트 URL 정규화
   * - 모바일 URL을 데스크톱 URL로 변환
   * - 불필요한 쿼리 파라미터 제거
   */
  private normalizePostUrl(url: string): string {
    if (!url) return '';

    try {
      const parsed = new URL(url);

      // 모바일 URL → 데스크톱 URL
      if (parsed.hostname === 'm.blog.naver.com') {
        parsed.hostname = 'blog.naver.com';
      }

      // 불필요한 쿼리 파라미터 제거 (logNo만 유지)
      const logNo = parsed.searchParams.get('logNo');
      const blogId = parsed.pathname.split('/')[1];

      if (blogId && logNo) {
        return `https://blog.naver.com/${blogId}/${logNo}`;
      }

      return url;
    } catch {
      // URL 파싱 실패 시 원본 반환
      return url;
    }
  }

  /**
   * 블로그 ID 추출
   * - blog.naver.com/user_id 형식에서 user_id 추출
   * - https://blog.naver.com/user_id/123 → user_id
   */
  static extractBlogId(blogUrl: string): string | null {
    try {
      const url = new URL(blogUrl);

      // blog.naver.com인지 확인
      if (!url.hostname.includes('blog.naver.com')) {
        return null;
      }

      // 경로에서 첫 번째 세그먼트 추출
      const pathSegments = url.pathname.split('/').filter(s => s);
      return pathSegments[0] || null;

    } catch {
      // URL이 아닌 경우 그대로 반환 (이미 블로그 ID일 수 있음)
      if (/^[a-zA-Z0-9_]{3,20}$/.test(blogUrl)) {
        return blogUrl;
      }
      return null;
    }
  }
}

/**
 * 기본 RSS 파서 인스턴스
 */
export const rssParser = new NaverBlogRSSParser();

/**
 * 간편 함수: 블로그 포스트 링크 목록 가져오기
 */
export async function fetchNaverBlogPosts(
  blogIdOrUrl: string,
  limit: number = 50
): Promise<RSSParseResult> {
  // URL인 경우 블로그 ID 추출
  const blogId = NaverBlogRSSParser.extractBlogId(blogIdOrUrl) || blogIdOrUrl;

  return rssParser.fetchBlogPostLinks(blogId, limit);
}
