/**
 * AI 분석 관련 타입 정의
 */

/**
 * 창작 DNA 전체 구조
 */
export interface CreativeDNA {
  metadata: {
    analysis_date: string;
    analyzed_post_count: number;
  };
  persona_profile: PersonaProfile;
  stylometry: Stylometry;
  topic_profile: TopicProfile;
  content_needs: ContentNeeds;
}

/**
 * 페르소나 프로필
 */
export interface PersonaProfile {
  archetype: string;                // 페르소나 원형 (예: "전문가 멘토", "친한 친구")
  tone_descriptors: string[];       // 어조 서술어 3-5개 (예: ["정보 제공적", "친근한"])
  expertise_level: ExpertiseLevel;  // 전문성 수준
}

/**
 * 전문성 수준
 */
export type ExpertiseLevel = '초보자' | '중급자' | '전문가';

/**
 * 문체론 (Stylometry)
 */
export interface Stylometry {
  avg_sentence_length: number;      // 평균 문장 길이
  lexical_density: number;          // 어휘 밀도
  common_phrases: string[];         // 자주 사용하는 표현
  punctuation_patterns: {
    exclamation_mark_freq: number;  // 느낌표 빈도
    ellipsis_freq: number;          // 말줄임표 빈도
  };
}

/**
 * 토픽 프로필
 */
export interface TopicProfile {
  main_topics: Topic[];
}

/**
 * 토픽
 */
export interface Topic {
  topic_name: string;
  sub_topics: SubTopic[];
}

/**
 * 하위 토픽
 */
export interface SubTopic {
  sub_topic_name: string;
  keywords: string[];
}

/**
 * 콘텐츠 니즈
 */
export interface ContentNeeds {
  type: ContentType;
}

/**
 * 콘텐츠 타입
 */
export type ContentType = 'NEWS_DRIVEN' | 'EVERGREEN_IDEAS';

/**
 * Claude API 응답
 */
export interface ClaudeAnalysisResponse {
  creativeDNA: CreativeDNA;
}
