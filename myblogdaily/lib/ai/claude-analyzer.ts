/**
 * Claude API를 사용한 창작 DNA 분석
 *
 * 용도:
 * - 블로그 포스트 텍스트를 Claude API로 분석
 * - 페르소나, 문체, 토픽, 콘텐츠 니즈 추출
 * - Sub_Agent_Prompt의 "창작 DNA 분석 에이전트" 사용
 */

import Anthropic from '@anthropic-ai/sdk';
import { getEnv } from '@/lib/utils/env-validator';
import { aiLogger as logger } from '@/lib/utils/logger';
import { Errors } from '@/lib/utils/error-handler';
import type { CreativeDNA, ClaudeAnalysisResponse } from './types';
import { textAnalyzer, type StyleMetrics } from './text-analyzer';

/**
 * Claude 분석 옵션
 */
export interface ClaudeAnalysisOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * 기본 옵션
 */
const DEFAULT_OPTIONS: Required<ClaudeAnalysisOptions> = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 4096,
  temperature: 0.3
};

/**
 * Claude 분석기 클래스
 */
export class ClaudeAnalyzer {
  private client: Anthropic;

  constructor() {
    const apiKey = getEnv('ANTHROPIC_API_KEY');
    this.client = new Anthropic({ apiKey });
  }

  /**
   * 창작 DNA 분석
   *
   * @param posts 블로그 포스트 배열
   * @param styleMetrics 사전 계산된 문체 통계 (선택)
   * @param options Claude API 옵션
   * @returns 창작 DNA
   */
  async analyzeCreativeDNA(
    posts: string[],
    styleMetrics?: StyleMetrics,
    options?: ClaudeAnalysisOptions
  ): Promise<CreativeDNA> {
    const startTime = Date.now();

    logger.info(`창작 DNA 분석 시작: ${posts.length}개 포스트`);

    // 옵션 병합
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // 포스트가 너무 적으면 에러
    if (posts.length < 10) {
      throw Errors.VALIDATION_ERROR(
        '최소 10개 이상의 포스트가 필요합니다.',
        { provided: posts.length }
      );
    }

    // 텍스트 통계 계산 (제공되지 않은 경우)
    if (!styleMetrics) {
      styleMetrics = textAnalyzer.analyzeStyle(posts);
    }

    // 프롬프트 생성
    const prompt = this.buildPrompt(posts, styleMetrics);

    try {
      // Claude API 호출
      logger.debug('Claude API 호출 중...');

      const message = await this.client.messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      // 응답 파싱
      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : '';

      logger.debug('Claude 응답 수신', {
        length: responseText.length,
        tokens: message.usage
      });

      // JSON 추출
      const creativeDNA = this.extractJSON(responseText);

      // 메타데이터 추가
      creativeDNA.metadata = {
        analysis_date: new Date().toISOString(),
        analyzed_post_count: posts.length
      };

      const duration = Date.now() - startTime;

      logger.success(
        `창작 DNA 분석 완료 (${duration}ms)`,
        {
          archetype: creativeDNA.persona_profile.archetype,
          mainTopics: creativeDNA.topic_profile.main_topics.length,
          contentType: creativeDNA.content_needs.type
        }
      );

      return creativeDNA;

    } catch (error) {
      logger.error('Claude API 호출 실패', error);

      if (error instanceof Anthropic.APIError) {
        if (error.status === 429) {
          throw Errors.TOKEN_LIMIT_EXCEEDED('Claude API 요청 한도 초과');
        }
        throw Errors.EXTERNAL_API_ERROR('Claude API', error.message);
      }

      throw Errors.AI_GENERATION_FAILED('창작 DNA 분석 중 오류 발생');
    }
  }

  /**
   * 프롬프트 생성
   * Sub_Agent_Prompt.txt의 "창작 DNA 분석 에이전트" 프롬프트 사용
   */
  private buildPrompt(posts: string[], styleMetrics: StyleMetrics): string {
    // 포스트를 하나의 문자열로 결합 (너무 길면 샘플링)
    const maxChars = 100000;  // 약 25,000 토큰
    const sampledPosts = this.samplePosts(posts, maxChars);
    const postsText = sampledPosts.map((p, i) => `[포스트 ${i + 1}]\n${p}`).join('\n\n---\n\n');

    return `당신은 '창작 DNA 분석가(Creative DNA Analyzer)'입니다. 당신의 임무는 제공된 블로그 게시물 텍스트를 심층 분석하여 저자의 고유한 페르소나, 문체, 핵심 주제 및 콘텐츠 요구사항을 추출하는 것입니다. 당신은 계산 언어학자, 페르소나 전략가, SEO 분석가의 전문성을 결합한 고도의 AI 시스템입니다. 분석 결과는 반드시 지정된 JSON 형식으로만 출력해야 합니다.

**INPUT DATA**

총 ${posts.length}개의 블로그 포스트 (샘플링: ${sampledPosts.length}개):

${postsText}

**사전 계산된 문체 통계:**
- 평균 문장 길이: ${styleMetrics.avgSentenceLength}자
- 어휘 밀도: ${styleMetrics.lexicalDensity}
- 자주 사용하는 표현: ${styleMetrics.commonPhrases.join(', ')}
- 느낌표 빈도: ${styleMetrics.punctuationPatterns.exclamationFreq}/1000자
- 말줄임표 빈도: ${styleMetrics.punctuationPatterns.ellipsisFreq}/1000자

**INSTRUCTIONS**

단계별로 생각하며 다음 과업을 순서대로 수행하십시오.

**1단계: 페르소나 및 문체 분석**

계산 언어학 및 문체론 전문가로서 제공된 텍스트 전체를 분석하여 저자의 페르소나와 문체를 정량적, 정성적으로 분석합니다.

분석 항목:
- 페르소나 원형: 저자가 글에서 취하는 역할 (예: 전문가 멘토, 친한 친구, 객관적인 기자)
- 어조 서술어: 글의 전반적인 분위기를 나타내는 형용사 3-5개 (예: 정보 제공적, 친근한)
- 전문성 수준: '초보자', '중급자', '전문가' 중 선택

**2단계: 주제 및 토픽 분석**

SEO 분석가로서 블로그의 핵심 콘텐츠 기둥을 식별합니다.

분석 항목:
- 메인 토픽: 블로그가 다루는 가장 중요한 상위 주제 2-3개
- 하위 토픽 및 키워드: 각 메인 토픽에 대해 연관된 하위 주제와 키워드 5개 이상

**3단계: 콘텐츠 요구사항 분류**

최근 게시물의 제목과 패턴을 분석하여 블로그의 주된 콘텐츠 전략을 분류합니다.

분류 기준:
- NEWS_DRIVEN: 최신 정보, 시의성, 뉴스 기반 업데이트가 중요한 콘텐츠 (부동산, 주식, IT 트렌드 등)
- EVERGREEN_IDEAS: 다양한 하위 주제, 아이디어, 깊이 있는 정보가 중요한 콘텐츠 (요리, 육아, 자기계발 등)

**OUTPUT FORMAT**

위 세 가지 분석 결과를 creativeDNA라는 최상위 키 아래에 단일 JSON 객체로 통합하여 최종 결과물을 생성하십시오. **다른 설명 없이 JSON 객체만 출력해야 합니다.**

JSON 형식:
\`\`\`json
{
  "creativeDNA": {
    "persona_profile": {
      "archetype": "...",
      "tone_descriptors": ["...", "...", "..."],
      "expertise_level": "초보자" | "중급자" | "전문가"
    },
    "stylometry": {
      "avg_sentence_length": ${styleMetrics.avgSentenceLength},
      "lexical_density": ${styleMetrics.lexicalDensity},
      "common_phrases": ${JSON.stringify(styleMetrics.commonPhrases)},
      "punctuation_patterns": {
        "exclamation_mark_freq": ${styleMetrics.punctuationPatterns.exclamationFreq},
        "ellipsis_freq": ${styleMetrics.punctuationPatterns.ellipsisFreq}
      }
    },
    "topic_profile": {
      "main_topics": [
        {
          "topic_name": "...",
          "sub_topics": [
            {
              "sub_topic_name": "...",
              "keywords": ["...", "...", "...", "...", "..."]
            }
          ]
        }
      ]
    },
    "content_needs": {
      "type": "NEWS_DRIVEN" | "EVERGREEN_IDEAS"
    }
  }
}
\`\`\`

이제 분석을 시작하십시오. JSON만 출력하세요.`;
  }

  /**
   * 포스트 샘플링 (너무 긴 경우)
   */
  private samplePosts(posts: string[], maxChars: number): string[] {
    let totalChars = 0;
    const sampled: string[] = [];

    for (const post of posts) {
      if (totalChars + post.length > maxChars) {
        break;
      }
      sampled.push(post);
      totalChars += post.length;
    }

    // 최소 10개는 포함
    if (sampled.length < 10 && posts.length >= 10) {
      return posts.slice(0, 10);
    }

    return sampled;
  }

  /**
   * JSON 추출
   */
  private extractJSON(text: string): CreativeDNA {
    try {
      // JSON 블록 찾기
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                        text.match(/\{[\s\S]*"creativeDNA"[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('JSON 형식을 찾을 수 없습니다.');
      }

      const jsonText = jsonMatch[1] || jsonMatch[0];
      const parsed: ClaudeAnalysisResponse = JSON.parse(jsonText);

      if (!parsed.creativeDNA) {
        throw new Error('creativeDNA 키가 없습니다.');
      }

      return parsed.creativeDNA;

    } catch (error) {
      logger.error('JSON 파싱 실패', { text: text.substring(0, 500) });
      throw Errors.AI_GENERATION_FAILED('Claude 응답을 파싱할 수 없습니다.');
    }
  }
}

/**
 * 전역 Claude 분석기 인스턴스
 */
export const claudeAnalyzer = new ClaudeAnalyzer();
