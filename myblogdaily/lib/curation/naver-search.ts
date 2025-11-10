/**
 * Naver Search API 클라이언트
 *
 * 용도:
 * - 블로그, 뉴스 검색
 * - 키워드 기반 콘텐츠 큐레이션
 * - creativeDNA의 토픽과 관련된 최신 정보 수집
 */

import { getEnv } from '@/lib/utils/env-validator';
import { Errors } from '@/lib/utils/error-handler';
import { curationLogger as logger } from '@/lib/utils/logger';

/**
 * 검색 타입
 */
export type SearchType = 'blog' | 'news';

/**
 * 정렬 방식
 */
export type SortType = 'sim' | 'date';  // sim: 정확도, date: 날짜

/**
 * 검색 옵션
 */
export interface SearchOptions {
  query: string;         // 검색어
  display?: number;      // 검색 결과 개수 (1~100, 기본 10)
  start?: number;        // 검색 시작 위치 (1~1000, 기본 1)
  sort?: SortType;       // 정렬 (기본: 'sim')
}

/**
 * 검색 결과 아이템
 */
export interface SearchResultItem {
  title: string;         // 제목 (HTML 태그 포함)
  link: string;          // 링크
  description: string;   // 요약 (HTML 태그 포함)
  bloggername?: string;  // 블로거 이름 (blog만)
  bloggerlink?: string;  // 블로거 링크 (blog만)
  postdate?: string;     // 작성일 (YYYYMMDD, blog만)
  pubDate?: string;      // 발행일 (news만)
}

/**
 * 검색 결과
 */
export interface SearchResult {
  total: number;                 // 총 검색 결과 수
  start: number;                 // 검색 시작 위치
  display: number;               // 한 페이지에 표시된 검색 결과 개수
  items: SearchResultItem[];     // 검색 결과 배열
}

/**
 * Naver Search API 클래스
 */
export class NaverSearchAPI {
  private clientId: string;
  private clientSecret: string;
  private baseUrl = 'https://openapi.naver.com/v1/search';

  constructor() {
    this.clientId = getEnv('NAVER_CLIENT_ID');
    this.clientSecret = getEnv('NAVER_CLIENT_SECRET');
  }

  /**
   * 검색 실행
   */
  async search(
    type: SearchType,
    options: SearchOptions
  ): Promise<SearchResult> {
    const { query, display = 10, start = 1, sort = 'sim' } = options;

    logger.info(`Naver ${type} 검색: "${query}" (display: ${display}, sort: ${sort})`);

    // URL 구성
    const url = new URL(`${this.baseUrl}/${type}.json`);
    url.searchParams.set('query', query);
    url.searchParams.set('display', display.toString());
    url.searchParams.set('start', start.toString());
    url.searchParams.set('sort', sort);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-Naver-Client-Id': this.clientId,
          'X-Naver-Client-Secret': this.clientSecret
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Naver API 에러 (${response.status})`, { errorText });

        if (response.status === 429) {
          throw Errors.TOKEN_LIMIT_EXCEEDED('Naver Search API 요청 한도 초과');
        }

        throw Errors.EXTERNAL_API_ERROR('Naver Search API', errorText);
      }

      const result: SearchResult = await response.json();

      logger.success(`검색 완료: ${result.items.length}개 결과 (total: ${result.total})`);

      return result;

    } catch (error) {
      if (error instanceof Error && error.name.includes('Fetch')) {
        logger.error('네트워크 에러', error);
        throw Errors.EXTERNAL_API_ERROR('Naver Search API', '네트워크 연결 실패');
      }
      throw error;
    }
  }

  /**
   * 블로그 검색
   */
  async searchBlog(options: SearchOptions): Promise<SearchResult> {
    return this.search('blog', options);
  }

  /**
   * 뉴스 검색
   */
  async searchNews(options: SearchOptions): Promise<SearchResult> {
    return this.search('news', options);
  }


  /**
   * 여러 키워드로 검색 (병렬)
   */
  async searchMultipleKeywords(
    type: SearchType,
    keywords: string[],
    displayPerKeyword: number = 5,
    sort: SortType = 'date'
  ): Promise<Map<string, SearchResult>> {
    logger.info(`다중 키워드 검색: ${keywords.length}개 키워드`);

    const results = await Promise.all(
      keywords.map(async (keyword) => {
        try {
          const result = await this.search(type, {
            query: keyword,
            display: displayPerKeyword,
            sort
          });
          return [keyword, result] as [string, SearchResult];
        } catch (error) {
          logger.error(`키워드 "${keyword}" 검색 실패`, error);
          return [keyword, { total: 0, start: 1, display: 0, items: [] }] as [string, SearchResult];
        }
      })
    );

    return new Map(results);
  }
}

/**
 * 전역 Naver Search API 인스턴스
 */
export const naverSearchAPI = new NaverSearchAPI();

/**
 * HTML 태그 제거 유틸리티 함수
 */
export function stripHtmlTags(text: string): string {
  return text
    .replace(/<b>/g, '')
    .replace(/<\/b>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
