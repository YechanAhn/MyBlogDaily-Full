/**
 * 콘텐츠 큐레이터
 *
 * 용도:
 * - creativeDNA 기반 콘텐츠 검색
 * - content_needs.type에 따른 전략적 큐레이션
 * - NEWS_DRIVEN: 최신 뉴스 위주
 * - EVERGREEN_IDEAS: 관련성 높은 콘텐츠 위주
 */

import { curationLogger as logger } from '@/lib/utils/logger';
import { Errors } from '@/lib/utils/error-handler';
import type { CreativeDNA, ContentType } from '@/lib/ai/types';
import { naverSearchAPI, stripHtmlTags, type SearchResultItem, type SortType } from './naver-search';

/**
 * 큐레이션 아이템
 */
export interface CuratedItem {
  title: string;           // 제목 (HTML 태그 제거됨)
  url: string;             // 링크
  summary: string;         // 요약 (HTML 태그 제거됨)
  source: string;          // 출처 (블로거명 or 언론사)
  publishedAt: string;     // 발행일 (ISO 8601)
  keyword: string;         // 검색에 사용된 키워드
  score: number;           // 관련도 점수 (0-100)
  type: 'blog' | 'news';   // 콘텐츠 타입
}

/**
 * 큐레이션 옵션
 */
export interface CurationOptions {
  maxItems?: number;              // 최대 아이템 수 (기본: 10)
  itemsPerKeyword?: number;       // 키워드당 검색 결과 수 (기본: 5)
  useNews?: boolean;              // 뉴스도 검색할지 (기본: true)
  useBlog?: boolean;              // 블로그도 검색할지 (기본: true)
  deduplicateByUrl?: boolean;     // URL 중복 제거 (기본: true)
  minScore?: number;              // 최소 점수 (기본: 0)
}

/**
 * 큐레이션 결과
 */
export interface CurationResult {
  items: CuratedItem[];
  totalSearched: number;    // 총 검색된 아이템 수
  totalFiltered: number;    // 필터링된 아이템 수
  keywords: string[];       // 사용된 키워드
  strategy: ContentType;    // 사용된 전략
}

/**
 * 큐레이터 클래스
 */
export class Curator {
  /**
   * creativeDNA 기반 콘텐츠 큐레이션
   */
  async curateContent(
    creativeDNA: CreativeDNA,
    options: CurationOptions = {}
  ): Promise<CurationResult> {
    const {
      maxItems = 10,
      itemsPerKeyword = 5,
      useNews = true,
      useBlog = true,
      deduplicateByUrl = true,
      minScore = 0
    } = options;

    logger.info('큐레이션 시작', {
      strategy: creativeDNA.content_needs.type,
      maxItems,
      itemsPerKeyword
    });

    // 1. 키워드 추출
    const keywords = this.extractKeywords(creativeDNA);
    logger.info(`${keywords.length}개 키워드 추출: ${keywords.slice(0, 5).join(', ')}...`);

    // 2. 정렬 전략 결정
    const sort: SortType = this.decideSortStrategy(creativeDNA.content_needs.type);

    // 3. 검색 실행
    const allItems: CuratedItem[] = [];

    if (useBlog) {
      logger.info('블로그 검색 중...');
      const blogResults = await naverSearchAPI.searchMultipleKeywords(
        'blog',
        keywords,
        itemsPerKeyword,
        sort
      );

      for (const [keyword, result] of blogResults.entries()) {
        const items = this.convertToCuratedItems(result.items, keyword, 'blog');
        allItems.push(...items);
      }
    }

    if (useNews) {
      logger.info('뉴스 검색 중...');
      const newsResults = await naverSearchAPI.searchMultipleKeywords(
        'news',
        keywords,
        itemsPerKeyword,
        sort
      );

      for (const [keyword, result] of newsResults.entries()) {
        const items = this.convertToCuratedItems(result.items, keyword, 'news');
        allItems.push(...items);
      }
    }

    logger.success(`총 ${allItems.length}개 아이템 수집 완료`);

    // 4. 중복 제거
    let filteredItems = allItems;
    if (deduplicateByUrl) {
      filteredItems = this.deduplicateByUrl(allItems);
      logger.info(`중복 제거: ${allItems.length} -> ${filteredItems.length}`);
    }

    // 5. 점수 계산
    filteredItems = filteredItems.map(item => ({
      ...item,
      score: this.calculateScore(item, creativeDNA)
    }));

    // 6. 점수 기준 필터링
    filteredItems = filteredItems.filter(item => item.score >= minScore);

    // 7. 점수 순 정렬 및 상위 N개 선택
    filteredItems.sort((a, b) => b.score - a.score);
    const topItems = filteredItems.slice(0, maxItems);

    logger.success(`큐레이션 완료: ${topItems.length}개 아이템 선택`);

    return {
      items: topItems,
      totalSearched: allItems.length,
      totalFiltered: filteredItems.length,
      keywords,
      strategy: creativeDNA.content_needs.type
    };
  }

  /**
   * creativeDNA에서 키워드 추출
   */
  private extractKeywords(creativeDNA: CreativeDNA): string[] {
    const keywords: string[] = [];

    // 메인 토픽의 모든 하위 토픽 키워드 수집
    for (const mainTopic of creativeDNA.topic_profile.main_topics) {
      for (const subTopic of mainTopic.sub_topics) {
        keywords.push(...subTopic.keywords);
      }
    }

    // 중복 제거 및 최대 20개로 제한
    return [...new Set(keywords)].slice(0, 20);
  }

  /**
   * 정렬 전략 결정
   */
  private decideSortStrategy(contentType: ContentType): SortType {
    // NEWS_DRIVEN: 최신 정보 중요 -> 날짜순
    // EVERGREEN_IDEAS: 관련성 중요 -> 정확도순
    return contentType === 'NEWS_DRIVEN' ? 'date' : 'sim';
  }

  /**
   * 검색 결과를 CuratedItem으로 변환
   */
  private convertToCuratedItems(
    items: SearchResultItem[],
    keyword: string,
    type: 'blog' | 'news'
  ): CuratedItem[] {
    return items.map(item => {
      // HTML 태그 제거
      const title = stripHtmlTags(item.title);
      const summary = stripHtmlTags(item.description);

      // 출처 결정
      const source = type === 'blog'
        ? (item.bloggername || '알 수 없는 블로거')
        : this.extractNewsSource(item.link);

      // 발행일 변환
      const publishedAt = this.normalizeDate(
        type === 'blog' ? item.postdate : item.pubDate
      );

      return {
        title,
        url: item.link,
        summary,
        source,
        publishedAt,
        keyword,
        score: 0,  // 나중에 계산
        type
      };
    });
  }

  /**
   * 뉴스 출처 추출
   */
  private extractNewsSource(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // 주요 언론사 도메인 매핑
      const sourceMap: Record<string, string> = {
        'naver.com': '네이버뉴스',
        'chosun.com': '조선일보',
        'joongang.co.kr': '중앙일보',
        'donga.com': '동아일보',
        'hankyung.com': '한국경제',
        'mk.co.kr': '매일경제',
        'ytn.co.kr': 'YTN',
        'jtbc.co.kr': 'JTBC'
      };

      for (const [domain, name] of Object.entries(sourceMap)) {
        if (hostname.includes(domain)) {
          return name;
        }
      }

      return hostname;
    } catch {
      return '알 수 없는 출처';
    }
  }

  /**
   * 날짜 정규화 (ISO 8601)
   */
  private normalizeDate(dateStr?: string): string {
    if (!dateStr) {
      return new Date().toISOString();
    }

    // YYYYMMDD 형식 (블로그)
    if (/^\d{8}$/.test(dateStr)) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return new Date(`${year}-${month}-${day}`).toISOString();
    }

    // RFC 2822 형식 (뉴스) - "Mon, 10 Nov 2025 12:00:00 +0900"
    try {
      return new Date(dateStr).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  /**
   * URL 기준 중복 제거
   */
  private deduplicateByUrl(items: CuratedItem[]): CuratedItem[] {
    const seen = new Set<string>();
    return items.filter(item => {
      if (seen.has(item.url)) {
        return false;
      }
      seen.add(item.url);
      return true;
    });
  }

  /**
   * 관련도 점수 계산
   */
  private calculateScore(item: CuratedItem, creativeDNA: CreativeDNA): number {
    let score = 50;  // 기본 점수

    // 1. 키워드 매칭 (제목에 키워드 포함 시 +20점)
    const titleLower = item.title.toLowerCase();
    const keywordLower = item.keyword.toLowerCase();
    if (titleLower.includes(keywordLower)) {
      score += 20;
    }

    // 2. 요약에 키워드 포함 시 (+10점)
    const summaryLower = item.summary.toLowerCase();
    if (summaryLower.includes(keywordLower)) {
      score += 10;
    }

    // 3. 최신성 (최근 7일 이내 +15점, 30일 이내 +5점)
    const publishedDate = new Date(item.publishedAt);
    const daysDiff = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff <= 7) {
      score += 15;
    } else if (daysDiff <= 30) {
      score += 5;
    }

    // 4. NEWS_DRIVEN 전략인 경우 뉴스 우대 (+5점)
    if (creativeDNA.content_needs.type === 'NEWS_DRIVEN' && item.type === 'news') {
      score += 5;
    }

    // 5. EVERGREEN_IDEAS 전략인 경우 블로그 우대 (+5점)
    if (creativeDNA.content_needs.type === 'EVERGREEN_IDEAS' && item.type === 'blog') {
      score += 5;
    }

    return Math.min(score, 100);  // 최대 100점
  }
}

/**
 * 전역 큐레이터 인스턴스
 */
export const curator = new Curator();
