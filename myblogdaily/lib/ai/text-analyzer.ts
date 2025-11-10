/**
 * 한국어 텍스트 분석기
 *
 * 용도:
 * - 기본 텍스트 통계 계산 (문장 길이, 어휘 밀도 등)
 * - 자주 사용하는 표현 추출
 * - 문장 부호 사용 패턴 분석
 *
 * Note: 형태소 분석은 Claude API에서 수행
 */

import { logger } from '@/lib/utils/logger';

/**
 * 문체 통계
 */
export interface StyleMetrics {
  avgSentenceLength: number;      // 평균 문장 길이 (글자 수)
  lexicalDensity: number;          // 어휘 밀도 (내용어 비율)
  commonPhrases: string[];         // 자주 사용하는 표현
  punctuationPatterns: {
    exclamationFreq: number;       // 느낌표 빈도
    ellipsisFreq: number;          // 말줄임표 빈도
    questionFreq: number;          // 물음표 빈도
  };
  paragraphCount: number;          // 문단 수
  totalWords: number;              // 총 단어 수
  uniqueWords: number;             // 고유 단어 수
}

/**
 * 텍스트 분석기 클래스
 */
export class TextAnalyzer {
  /**
   * 여러 포스트를 분석하여 문체 통계 계산
   */
  analyzeStyle(posts: string[]): StyleMetrics {
    logger.info(`텍스트 분석 시작: ${posts.length}개 포스트`);

    const combinedText = posts.join('\n\n');

    // 문장 분리
    const sentences = this.splitSentences(combinedText);

    // 평균 문장 길이
    const avgSentenceLength = this.calculateAvgSentenceLength(sentences);

    // 어휘 밀도
    const lexicalDensity = this.calculateLexicalDensity(combinedText);

    // 자주 사용하는 표현
    const commonPhrases = this.extractCommonPhrases(combinedText);

    // 문장 부호 패턴
    const punctuationPatterns = this.analyzePunctuation(combinedText);

    // 문단 수
    const paragraphCount = this.countParagraphs(combinedText);

    // 단어 통계
    const words = this.extractWords(combinedText);
    const totalWords = words.length;
    const uniqueWords = new Set(words).size;

    const metrics: StyleMetrics = {
      avgSentenceLength,
      lexicalDensity,
      commonPhrases,
      punctuationPatterns,
      paragraphCount,
      totalWords,
      uniqueWords
    };

    logger.success('텍스트 분석 완료', metrics);

    return metrics;
  }

  /**
   * 문장 분리
   */
  private splitSentences(text: string): string[] {
    // 한국어 문장 종결 부호: . ! ? ... 등
    const sentenceEndings = /[.!?…]+[\s\n]|[.!?…]+$/g;

    return text
      .split(sentenceEndings)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * 평균 문장 길이 계산
   */
  private calculateAvgSentenceLength(sentences: string[]): number {
    if (sentences.length === 0) return 0;

    const totalLength = sentences.reduce((sum, s) => sum + s.length, 0);
    return parseFloat((totalLength / sentences.length).toFixed(1));
  }

  /**
   * 어휘 밀도 계산
   * (고유 단어 수 / 전체 단어 수)
   */
  private calculateLexicalDensity(text: string): number {
    const words = this.extractWords(text);
    if (words.length === 0) return 0;

    const uniqueWords = new Set(words);
    return parseFloat((uniqueWords.size / words.length).toFixed(3));
  }

  /**
   * 단어 추출
   */
  private extractWords(text: string): string[] {
    // 한글, 영문, 숫자만 추출 (최소 2글자)
    const wordPattern = /[\uAC00-\uD7A3a-zA-Z0-9]{2,}/g;
    return text.match(wordPattern) || [];
  }

  /**
   * 자주 사용하는 표현 추출
   * N-gram (2-3단어 조합) 빈도 분석
   */
  private extractCommonPhrases(text: string): string[] {
    const words = this.extractWords(text);
    const bigrams = new Map<string, number>();

    // 2-gram 생성
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      bigrams.set(phrase, (bigrams.get(phrase) || 0) + 1);
    }

    // 빈도 상위 5개 추출 (최소 2회 이상)
    return Array.from(bigrams.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([phrase]) => phrase);
  }

  /**
   * 문장 부호 사용 패턴 분석
   */
  private analyzePunctuation(text: string): StyleMetrics['punctuationPatterns'] {
    const totalLength = text.length;

    const exclamationCount = (text.match(/!/g) || []).length;
    const ellipsisCount = (text.match(/\.{2,}|…/g) || []).length;
    const questionCount = (text.match(/\?/g) || []).length;

    return {
      exclamationFreq: parseFloat((exclamationCount / totalLength * 1000).toFixed(3)),
      ellipsisFreq: parseFloat((ellipsisCount / totalLength * 1000).toFixed(3)),
      questionFreq: parseFloat((questionCount / totalLength * 1000).toFixed(3))
    };
  }

  /**
   * 문단 수 계산
   */
  private countParagraphs(text: string): number {
    return text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  }

  /**
   * 포스트별 통계 요약
   */
  summarizePosts(posts: string[]): {
    totalPosts: number;
    avgLength: number;
    minLength: number;
    maxLength: number;
    totalLength: number;
  } {
    const lengths = posts.map(p => p.length);

    return {
      totalPosts: posts.length,
      avgLength: Math.round(lengths.reduce((sum, l) => sum + l, 0) / lengths.length),
      minLength: Math.min(...lengths),
      maxLength: Math.max(...lengths),
      totalLength: lengths.reduce((sum, l) => sum + l, 0)
    };
  }
}

/**
 * 전역 텍스트 분석기 인스턴스
 */
export const textAnalyzer = new TextAnalyzer();
