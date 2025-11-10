/**
 * Supabase 데이터베이스 타입 정의
 *
 * 이 파일은 데이터베이스 스키마의 TypeScript 타입을 정의합니다.
 * 실제 운영 환경에서는 `supabase gen types typescript` 명령어로 자동 생성됩니다.
 *
 * 사용 예시:
 * ```ts
 * import { Database } from '@/types/database';
 * type User = Database['public']['Tables']['users']['Row'];
 * ```
 */

// ============================================
// 기본 타입 정의
// ============================================

/** JSON 타입 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** 구독 상태 */
export type SubscriptionStatus = 'trial' | 'active' | 'cancelled';

/** 구독 티어 */
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

/** 뉴스레터 발송 빈도 */
export type NewsletterFrequency = 'daily' | 'weekly';

/** 콘텐츠 소스 */
export type ContentSource = 'naver_news' | 'youtube' | 'google_trends';

/** 뉴스레터 상태 */
export type NewsletterStatus = 'draft' | 'sent' | 'failed';

/** 어휘 수준 */
export type VocabularyLevel = 'simple' | 'moderate' | 'advanced';

// ============================================
// Database 타입 정의
// ============================================

export interface Database {
  public: {
    Tables: {
      // 사용자 테이블
      users: {
        Row: {
          // 기본 정보
          id: string; // UUID
          email: string;
          name: string | null;

          // 네이버 블로그 정보
          naver_blog_id: string | null;
          naver_blog_url: string | null;
          naver_access_token: string | null;
          naver_refresh_token: string | null;

          // 구독 정보
          subscription_status: SubscriptionStatus;
          subscription_tier: SubscriptionTier;
          trial_ends_at: string | null; // ISO 8601 timestamp

          // 뉴스레터 설정
          newsletter_enabled: boolean;
          newsletter_time: string; // HH:MM:SS
          newsletter_frequency: NewsletterFrequency;

          // 메타데이터
          created_at: string; // ISO 8601 timestamp
          updated_at: string; // ISO 8601 timestamp
          last_login_at: string | null; // ISO 8601 timestamp
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          naver_blog_id?: string | null;
          naver_blog_url?: string | null;
          naver_access_token?: string | null;
          naver_refresh_token?: string | null;
          subscription_status?: SubscriptionStatus;
          subscription_tier?: SubscriptionTier;
          trial_ends_at?: string | null;
          newsletter_enabled?: boolean;
          newsletter_time?: string;
          newsletter_frequency?: NewsletterFrequency;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          naver_blog_id?: string | null;
          naver_blog_url?: string | null;
          naver_access_token?: string | null;
          naver_refresh_token?: string | null;
          subscription_status?: SubscriptionStatus;
          subscription_tier?: SubscriptionTier;
          trial_ends_at?: string | null;
          newsletter_enabled?: boolean;
          newsletter_time?: string;
          newsletter_frequency?: NewsletterFrequency;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
      };

      // 블로그 포스트 테이블
      blog_posts: {
        Row: {
          // 기본 정보
          id: string; // UUID
          user_id: string; // UUID

          // 포스트 정보
          title: string;
          content: string;
          url: string;
          published_at: string | null; // ISO 8601 timestamp

          // 크롤링 메타데이터
          crawled_at: string; // ISO 8601 timestamp
          word_count: number | null;
          char_count: number | null;

          // 분석용 데이터
          tags: string[] | null;
          category: string | null;

          // 메타데이터
          created_at: string; // ISO 8601 timestamp
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          content: string;
          url: string;
          published_at?: string | null;
          crawled_at?: string;
          word_count?: number | null;
          char_count?: number | null;
          tags?: string[] | null;
          category?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: string;
          url?: string;
          published_at?: string | null;
          crawled_at?: string;
          word_count?: number | null;
          char_count?: number | null;
          tags?: string[] | null;
          category?: string | null;
          created_at?: string;
        };
      };

      // 문체 분석 테이블
      writing_dna: {
        Row: {
          // 기본 정보
          id: string; // UUID
          user_id: string; // UUID

          // 문체 분석 결과
          persona: Json | null;
          tone_analysis: Json | null;
          vocabulary_level: VocabularyLevel | null;

          // 통계적 특징
          avg_sentence_length: number | null;
          avg_paragraph_length: number | null;
          punctuation_style: Json | null;

          // 자주 사용하는 표현
          common_phrases: string[] | null;
          writing_patterns: Json | null;

          // 주제 및 관심사
          main_topics: string[] | null;
          interests: string[] | null;

          // 분석 메타데이터
          analyzed_posts_count: number;
          confidence_score: number | null;
          analysis_version: string;

          // 메타데이터
          created_at: string; // ISO 8601 timestamp
          updated_at: string; // ISO 8601 timestamp
        };
        Insert: {
          id?: string;
          user_id: string;
          persona?: Json | null;
          tone_analysis?: Json | null;
          vocabulary_level?: VocabularyLevel | null;
          avg_sentence_length?: number | null;
          avg_paragraph_length?: number | null;
          punctuation_style?: Json | null;
          common_phrases?: string[] | null;
          writing_patterns?: Json | null;
          main_topics?: string[] | null;
          interests?: string[] | null;
          analyzed_posts_count?: number;
          confidence_score?: number | null;
          analysis_version?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          persona?: Json | null;
          tone_analysis?: Json | null;
          vocabulary_level?: VocabularyLevel | null;
          avg_sentence_length?: number | null;
          avg_paragraph_length?: number | null;
          punctuation_style?: Json | null;
          common_phrases?: string[] | null;
          writing_patterns?: Json | null;
          main_topics?: string[] | null;
          interests?: string[] | null;
          analyzed_posts_count?: number;
          confidence_score?: number | null;
          analysis_version?: string;
          created_at?: string;
          updated_at?: string;
        };
      };

      // 큐레이션 아이템 테이블
      curated_items: {
        Row: {
          // 기본 정보
          id: string; // UUID
          user_id: string; // UUID

          // 콘텐츠 정보
          title: string;
          url: string;
          source: ContentSource;
          summary: string | null;

          // 큐레이션 메타데이터
          relevance_score: number | null;
          curated_reason: string | null;

          // 상태
          used_in_newsletter: boolean;
          used_at: string | null; // ISO 8601 timestamp

          // 메타데이터
          created_at: string; // ISO 8601 timestamp
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          url: string;
          source: ContentSource;
          summary?: string | null;
          relevance_score?: number | null;
          curated_reason?: string | null;
          used_in_newsletter?: boolean;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          url?: string;
          source?: ContentSource;
          summary?: string | null;
          relevance_score?: number | null;
          curated_reason?: string | null;
          used_in_newsletter?: boolean;
          used_at?: string | null;
          created_at?: string;
        };
      };

      // 뉴스레터 테이블
      newsletters: {
        Row: {
          // 기본 정보
          id: string; // UUID
          user_id: string; // UUID

          // 뉴스레터 내용
          title: string;
          content: string;
          html_content: string | null;

          // 제안된 제목들
          suggested_titles: Json | null;

          // 메타데이터
          word_count: number | null;
          reading_time_minutes: number | null;

          // 발송 정보
          status: NewsletterStatus;
          sent_at: string | null; // ISO 8601 timestamp
          opened_at: string | null; // ISO 8601 timestamp

          // AI 생성 메타데이터
          generation_model: string;
          generation_prompt_tokens: number | null;
          generation_completion_tokens: number | null;

          // 사용된 큐레이션 아이템들
          curated_items_used: string[] | null; // UUID[]

          // 메타데이터
          created_at: string; // ISO 8601 timestamp
          updated_at: string; // ISO 8601 timestamp
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          content: string;
          html_content?: string | null;
          suggested_titles?: Json | null;
          word_count?: number | null;
          reading_time_minutes?: number | null;
          status?: NewsletterStatus;
          sent_at?: string | null;
          opened_at?: string | null;
          generation_model?: string;
          generation_prompt_tokens?: number | null;
          generation_completion_tokens?: number | null;
          curated_items_used?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: string;
          html_content?: string | null;
          suggested_titles?: Json | null;
          word_count?: number | null;
          reading_time_minutes?: number | null;
          status?: NewsletterStatus;
          sent_at?: string | null;
          opened_at?: string | null;
          generation_model?: string;
          generation_prompt_tokens?: number | null;
          generation_completion_tokens?: number | null;
          curated_items_used?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      // 사용자 통계 조회 함수
      get_user_stats: {
        Args: {
          p_user_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// ============================================
// 헬퍼 타입
// ============================================

/** 특정 테이블의 Row 타입 */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

/** 특정 테이블의 Insert 타입 */
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

/** 특정 테이블의 Update 타입 */
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// 편의를 위한 타입 별칭
export type User = Tables<'users'>;
export type BlogPost = Tables<'blog_posts'>;
export type WritingDNA = Tables<'writing_dna'>;
export type CuratedItem = Tables<'curated_items'>;
export type Newsletter = Tables<'newsletters'>;

export type UserInsert = TablesInsert<'users'>;
export type BlogPostInsert = TablesInsert<'blog_posts'>;
export type WritingDNAInsert = TablesInsert<'writing_dna'>;
export type CuratedItemInsert = TablesInsert<'curated_items'>;
export type NewsletterInsert = TablesInsert<'newsletters'>;

export type UserUpdate = TablesUpdate<'users'>;
export type BlogPostUpdate = TablesUpdate<'blog_posts'>;
export type WritingDNAUpdate = TablesUpdate<'writing_dna'>;
export type CuratedItemUpdate = TablesUpdate<'curated_items'>;
export type NewsletterUpdate = TablesUpdate<'newsletters'>;
