/**
 * Claude를 사용한 블로그 포스트 초안 작성
 *
 * 용도:
 * - creativeDNA 기반 페르소나 및 문체 모방
 * - 큐레이션된 콘텐츠를 바탕으로 초안 작성
 * - 여러 개의 초안 옵션 제공
 */

import Anthropic from '@anthropic-ai/sdk';
import { getEnv } from '@/lib/utils/env-validator';
import { aiLogger as logger } from '@/lib/utils/logger';
import { Errors } from '@/lib/utils/error-handler';
import type { CreativeDNA } from './types';
import type { CuratedItem } from '@/lib/curation';

/**
 * 초안 작성 옵션
 */
export interface DraftOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  numDrafts?: number;         // 생성할 초안 개수 (기본: 3)
  minLength?: number;         // 최소 길이 (자) (기본: 500)
  maxLength?: number;         // 최대 길이 (자) (기본: 2000)
  includeTitle?: boolean;     // 제목 포함 여부 (기본: true)
}

/**
 * 블로그 포스트 초안
 */
export interface BlogDraft {
  title: string;              // 제목
  content: string;            // 본문
  summary: string;            // 요약 (100자)
  tags: string[];             // 태그 (3-5개)
  estimatedReadTime: number;  // 예상 읽기 시간 (분)
}

/**
 * 초안 작성 결과
 */
export interface DraftResult {
  drafts: BlogDraft[];        // 생성된 초안들
  curatedCount: number;       // 참고한 큐레이션 아이템 수
  persona: string;            // 사용된 페르소나
  strategy: string;           // 사용된 전략
}

/**
 * 기본 옵션
 */
const DEFAULT_OPTIONS: Required<DraftOptions> = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 8192,
  temperature: 0.7,  // 창의성을 위해 높게 설정
  numDrafts: 3,
  minLength: 500,
  maxLength: 2000,
  includeTitle: true
};

/**
 * Draft Writer 클래스
 */
export class DraftWriter {
  private client: Anthropic;

  constructor() {
    const apiKey = getEnv('ANTHROPIC_API_KEY');
    this.client = new Anthropic({ apiKey });
  }

  /**
   * 블로그 포스트 초안 작성
   */
  async generateDrafts(
    creativeDNA: CreativeDNA,
    curatedItems: CuratedItem[],
    options?: DraftOptions
  ): Promise<DraftResult> {
    const startTime = Date.now();

    logger.info('블로그 초안 작성 시작', {
      curatedCount: curatedItems.length,
      numDrafts: options?.numDrafts || DEFAULT_OPTIONS.numDrafts
    });

    // 옵션 병합
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // 큐레이션 아이템이 없으면 에러
    if (curatedItems.length === 0) {
      throw Errors.VALIDATION_ERROR('큐레이션된 아이템이 필요합니다.', {
        provided: 0
      });
    }

    // 프롬프트 생성
    const prompt = this.buildPrompt(creativeDNA, curatedItems, opts);

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
      const drafts = this.extractDrafts(responseText, opts.numDrafts);

      const duration = Date.now() - startTime;

      logger.success(
        `블로그 초안 작성 완료 (${duration}ms)`,
        {
          count: drafts.length,
          avgLength: Math.round(drafts.reduce((sum, d) => sum + d.content.length, 0) / drafts.length)
        }
      );

      return {
        drafts,
        curatedCount: curatedItems.length,
        persona: creativeDNA.persona_profile.archetype,
        strategy: creativeDNA.content_needs.type
      };

    } catch (error) {
      logger.error('Claude API 호출 실패', error);

      if (error instanceof Anthropic.APIError) {
        if (error.status === 429) {
          throw Errors.TOKEN_LIMIT_EXCEEDED('Claude API 요청 한도 초과');
        }
        throw Errors.EXTERNAL_API_ERROR('Claude API', error.message);
      }

      throw Errors.AI_GENERATION_FAILED('블로그 초안 작성 중 오류 발생');
    }
  }

  /**
   * 프롬프트 생성
   */
  private buildPrompt(
    creativeDNA: CreativeDNA,
    curatedItems: CuratedItem[],
    opts: Required<DraftOptions>
  ): string {
    // 큐레이션 아이템 요약
    const itemsSummary = curatedItems
      .map((item, i) => `[${i + 1}] ${item.title}\n출처: ${item.source}\n요약: ${item.summary}\nURL: ${item.url}`)
      .join('\n\n');

    return `당신은 '블로그 포스트 초안 작성가(Blog Draft Writer)'입니다. 당신의 임무는 제공된 큐레이션 콘텐츠를 바탕으로 블로거의 고유한 문체와 페르소나를 완벽히 모방하여 블로그 포스트 초안을 ${opts.numDrafts}개 작성하는 것입니다.

**블로거 페르소나 (Persona Profile)**

- **원형(Archetype)**: ${creativeDNA.persona_profile.archetype}
- **어조(Tone)**: ${creativeDNA.persona_profile.tone_descriptors.join(', ')}
- **전문성 수준**: ${creativeDNA.persona_profile.expertise_level}

**문체론 (Stylometry)**

- **평균 문장 길이**: ${creativeDNA.stylometry.avg_sentence_length}자
- **어휘 밀도**: ${creativeDNA.stylometry.lexical_density}
- **자주 사용하는 표현**: ${creativeDNA.stylometry.common_phrases.join(', ')}
- **느낌표 빈도**: ${creativeDNA.stylometry.punctuation_patterns.exclamation_mark_freq}/1000자
- **말줄임표 빈도**: ${creativeDNA.stylometry.punctuation_patterns.ellipsis_freq}/1000자

**토픽 프로필**

메인 토픽: ${creativeDNA.topic_profile.main_topics.map(t => t.topic_name).join(', ')}

**콘텐츠 전략**

타입: ${creativeDNA.content_needs.type}
${creativeDNA.content_needs.type === 'NEWS_DRIVEN'
  ? '→ 최신 정보, 시의성, 뉴스 기반 업데이트 중심'
  : '→ 깊이 있는 정보, 다양한 하위 주제, 에버그린 콘텐츠 중심'}

---

**큐레이션된 콘텐츠**

${itemsSummary}

---

**작성 지침**

1. **페르소나 모방**: 위에 명시된 페르소나 원형과 어조를 완벽히 따라야 합니다.

2. **문체 모방**:
   - 평균 문장 길이를 지켜주세요 (${creativeDNA.stylometry.avg_sentence_length}자 내외)
   - 자주 사용하는 표현을 적절히 활용하세요
   - 느낌표와 말줄임표 빈도를 맞춰주세요

3. **콘텐츠 구성**:
   - 큐레이션된 콘텐츠를 바탕으로 작성하되, 단순 요약이 아닌 블로거의 관점과 인사이트를 더해주세요
   - ${opts.minLength}자 이상, ${opts.maxLength}자 이하로 작성해주세요
   - 제목은 흥미롭고 SEO에 최적화되어야 합니다

4. **다양성**: ${opts.numDrafts}개의 초안은 각각 다른 관점과 구성으로 작성해주세요
   - 초안 1: 정보 전달 중심
   - 초안 2: 경험/의견 공유 중심
   - 초안 3: 실용적 팁/가이드 중심

5. **출처 표기**: 큐레이션된 콘텐츠의 출처를 자연스럽게 포함하세요 (예: "최근 OO에 따르면...")

---

**출력 형식**

${opts.numDrafts}개의 초안을 JSON 배열로 출력해주세요. 다른 설명 없이 JSON만 출력하세요.

\`\`\`json
{
  "drafts": [
    {
      "title": "...",
      "content": "...",
      "summary": "...",
      "tags": ["...", "...", "..."],
      "estimatedReadTime": 5
    }
  ]
}
\`\`\`

**필드 설명**:
- title: 블로그 포스트 제목 (한글, 30-50자)
- content: 본문 (마크다운 형식, ${opts.minLength}-${opts.maxLength}자)
- summary: 요약 (100자 이내)
- tags: 관련 태그 3-5개
- estimatedReadTime: 예상 읽기 시간 (분)

이제 작성을 시작하세요. JSON만 출력하세요.`;
  }

  /**
   * JSON 추출 및 초안 파싱
   */
  private extractDrafts(text: string, expectedCount: number): BlogDraft[] {
    try {
      // JSON 블록 찾기
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                        text.match(/\{[\s\S]*"drafts"[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('JSON 형식을 찾을 수 없습니다.');
      }

      const jsonText = jsonMatch[1] || jsonMatch[0];
      const parsed: { drafts: BlogDraft[] } = JSON.parse(jsonText);

      if (!parsed.drafts || !Array.isArray(parsed.drafts)) {
        throw new Error('drafts 배열이 없습니다.');
      }

      if (parsed.drafts.length === 0) {
        throw new Error('초안이 생성되지 않았습니다.');
      }

      logger.info(`${parsed.drafts.length}개 초안 파싱 완료`);

      return parsed.drafts;

    } catch (error) {
      logger.error('JSON 파싱 실패', { text: text.substring(0, 500) });
      throw Errors.AI_GENERATION_FAILED('Claude 응답을 파싱할 수 없습니다.');
    }
  }
}

/**
 * 전역 Draft Writer 인스턴스
 */
export const draftWriter = new DraftWriter();
