/**
 * 전역 타입 정의 파일
 *
 * 이 파일은 프로젝트 전체에서 사용되는 TypeScript 타입들을 정의합니다.
 * - 데이터베이스 타입
 * - API 응답 타입
 * - 컴포넌트 Props 타입 등
 */

// ============================================
// 사용자 관련 타입
// ============================================

/**
 * 사용자 정보
 * 데이터베이스의 users 테이블과 매핑
 */
export interface User {
  id: string; // 사용자 고유 ID (UUID)
  naver_id: string; // 네이버 계정 ID
  email: string; // 이메일 주소
  blog_url: string; // 네이버 블로그 URL
  display_name?: string; // 사용자 표시 이름 (선택)
  newsletter_time: string; // 뉴스레터 발송 시간 (예: "07:00")
  is_active: boolean; // 활성 상태
  created_at: string; // 가입일 (ISO 날짜 문자열)
  updated_at: string; // 수정일
}

/**
 * 사용자 생성 데이터
 * 새 사용자를 만들 때 필요한 정보
 */
export interface CreateUserData {
  naver_id: string;
  email: string;
  blog_url: string;
  display_name?: string;
}

// ============================================
// 블로그 포스트 관련 타입
// ============================================

/**
 * 블로그 포스트
 * 데이터베이스의 blog_posts 테이블과 매핑
 */
export interface BlogPost {
  id: string; // 포스트 고유 ID (UUID)
  user_id: string; // 작성자 ID (외래 키)
  post_id: string; // 네이버 블로그 포스트 ID
  title: string; // 포스트 제목
  content: string; // 포스트 본문 (HTML 제거된 텍스트)
  word_count: number; // 글자 수
  published_at: string; // 발행일
  link: string; // 포스트 URL
  category?: string; // 카테고리 (선택)
  created_at: string; // 수집일
}

/**
 * 크롤링 결과
 * 웹 크롤러가 반환하는 데이터 형식
 */
export interface CrawlResult {
  success: boolean; // 크롤링 성공 여부
  title?: string; // 제목 (성공 시)
  content?: string; // 본문 (성공 시)
  error?: string; // 에러 메시지 (실패 시)
  retryCount?: number; // 재시도 횟수
}

// ============================================
// 창작 DNA 관련 타입
// ============================================

/**
 * 페르소나 프로필
 * 블로거의 글쓰기 스타일 특성
 */
export interface PersonaProfile {
  archetype: string; // 페르소나 유형 (예: "전문가 멘토")
  tone_descriptors: string[]; // 톤 설명 (예: ["친근한", "정보 제공적"])
  expertise_level: string; // 전문성 수준 (예: "중급")
  target_audience: string; // 타겟 독자 (예: "일반인")
}

/**
 * 문체 분석 결과
 */
export interface Stylometry {
  avg_sentence_length: number; // 평균 문장 길이
  avg_paragraph_length: number; // 평균 문단 길이
  lexical_density: number; // 어휘 밀도
  vocabulary_richness: number; // 어휘 다양성 (TTR)
  morphological_patterns: Record<string, any>; // 형태소 패턴
  function_words: Record<string, any>; // 기능어 사용
  syntactic_complexity: Record<string, any>; // 구문 복잡도
  emotional_tone: Record<string, any>; // 감정 톤
  readability: Record<string, any>; // 가독성
  common_phrases: string[]; // 자주 사용하는 표현
  punctuation_patterns: Record<string, number>; // 구두점 패턴
  style_signature: string; // 문체 서명 (요약)
}

/**
 * 주제 프로필
 */
export interface TopicProfile {
  main_topics: Array<{
    topic_name: string;
    coverage: number; // 주제 비중 (0-1)
    sub_topics: Array<{
      sub_topic_name: string;
      keywords: string[];
      secondary_keywords: string[];
    }>;
  }>;
  keyword_importance: Record<string, number>; // 키워드별 중요도
}

/**
 * 창작 DNA (전체)
 * 데이터베이스의 creative_dna 테이블과 매핑
 */
export interface CreativeDNA {
  id: string;
  user_id: string;
  persona_profile: PersonaProfile;
  stylometry: Stylometry;
  topic_profile: TopicProfile;
  content_type: 'NEWS_DRIVEN' | 'EVERGREEN_IDEAS'; // 콘텐츠 유형
  analyzed_at: string; // 분석일
  created_at: string;
  updated_at: string;
}

// ============================================
// API 응답 타입
// ============================================

/**
 * 표준 API 응답
 * 모든 API는 이 형식으로 응답합니다
 */
export interface ApiResponse<T = any> {
  success: boolean; // 성공 여부
  data?: T; // 응답 데이터 (성공 시)
  error?: string; // 에러 메시지 (실패 시)
  message?: string; // 추가 메시지
}

/**
 * 페이지네이션 응답
 * 목록 조회 시 사용
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[]; // 데이터 배열
  pagination: {
    page: number; // 현재 페이지
    limit: number; // 페이지당 항목 수
    total: number; // 전체 항목 수
    totalPages: number; // 전체 페이지 수
  };
}

// ============================================
// 뉴스레터 관련 타입
// ============================================

/**
 * 큐레이션된 콘텐츠 항목
 */
export interface CuratedItem {
  type: 'NEWS' | 'ARTICLE' | 'VIDEO'; // 콘텐츠 유형
  title: string; // 제목
  summary: string; // 요약
  url: string; // 원본 URL
  source: string; // 출처 (예: "네이버 뉴스")
  publishedAt?: string; // 발행일 (선택)
  relevanceScore?: number; // 관련성 점수 (선택)
}

/**
 * 생성된 초안
 */
export interface GeneratedDraft {
  topic: string; // 주제
  titleOptions: string[]; // 제목 옵션 (5개)
  metaDescriptions: string[]; // 메타 설명 (5개)
  recommendedTitle: string; // 추천 제목
  content: string; // 본문 (Markdown)
  wordCount: number; // 글자 수
  seoScore: number; // SEO 점수 (0-100)
  viralScore: number; // 바이럴 점수 (0-5)
}

/**
 * 뉴스레터 데이터
 */
export interface NewsletterData {
  userId: string; // 수신자 ID
  subject: string; // 이메일 제목
  recommendedTopic: string; // 추천 주제
  viralScore: number; // 바이럴 점수
  curatedItems: CuratedItem[]; // 큐레이션 목록 (5개)
  draft: GeneratedDraft; // 생성된 초안
  sentAt: string; // 발송 시간
}

// ============================================
// 유틸리티 타입
// ============================================

/**
 * 부분 업데이트 타입
 * 특정 타입의 일부 필드만 업데이트할 때 사용
 *
 * 예시:
 * UpdateData<User> = { id: string } & Partial<User>
 */
export type UpdateData<T> = {
  id: string;
} & Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>;

/**
 * Nullable 타입
 * null이 가능한 타입
 */
export type Nullable<T> = T | null;

/**
 * Optional 타입
 * undefined가 가능한 타입
 */
export type Optional<T> = T | undefined;
