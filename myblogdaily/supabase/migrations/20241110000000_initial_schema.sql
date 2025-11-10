-- MyBlogDaily 초기 데이터베이스 스키마
-- 생성일: 2024-11-10
-- 설명: 사용자, 블로그 포스트, 문체 DNA, 큐레이션, 뉴스레터 테이블 생성

-- =============================================================================
-- 1. Users 테이블 (사용자 정보)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  naver_id TEXT UNIQUE, -- 네이버 고유 ID
  blog_url TEXT, -- 네이버 블로그 URL (예: blog.naver.com/user_id)
  blog_id TEXT, -- 블로그 ID만 추출 (예: user_id)
  profile_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'pro', 'premium')),
  newsletter_enabled BOOLEAN DEFAULT true,
  newsletter_time TIME DEFAULT '07:00:00', -- 뉴스레터 발송 시간
  timezone TEXT DEFAULT 'Asia/Seoul'
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_naver_id ON users(naver_id);
CREATE INDEX IF NOT EXISTS idx_users_blog_id ON users(blog_id);

-- =============================================================================
-- 2. Blog Posts 테이블 (블로그 포스트 저장)
-- =============================================================================
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- 본문 전체
  post_url TEXT NOT NULL, -- 원본 포스트 URL
  published_at TIMESTAMPTZ, -- 포스트 발행일
  crawled_at TIMESTAMPTZ DEFAULT NOW(), -- 크롤링된 시간
  word_count INTEGER, -- 단어 수
  view_count INTEGER DEFAULT 0, -- 조회수 (크롤링 시 수집)
  like_count INTEGER DEFAULT 0, -- 공감 수
  comment_count INTEGER DEFAULT 0, -- 댓글 수
  tags TEXT[], -- 태그 배열
  category TEXT, -- 카테고리
  is_analyzed BOOLEAN DEFAULT false, -- 문체 분석 완료 여부
  UNIQUE(user_id, post_url) -- 중복 방지
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_blog_posts_user_id ON blog_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_is_analyzed ON blog_posts(is_analyzed);

-- =============================================================================
-- 3. Writing DNA 테이블 (문체 분석 결과)
-- =============================================================================
CREATE TABLE IF NOT EXISTS writing_dna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creative_dna JSONB NOT NULL, -- Claude 분석 결과 (JSON 형식)
  analyzed_post_count INTEGER DEFAULT 0, -- 분석에 사용된 포스트 수
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1 -- 재분석 시 버전 업
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_writing_dna_user_id ON writing_dna(user_id);
CREATE INDEX IF NOT EXISTS idx_writing_dna_updated_at ON writing_dna(updated_at DESC);

-- =============================================================================
-- 4. Curated Items 테이블 (큐레이션된 콘텐츠)
-- =============================================================================
CREATE TABLE IF NOT EXISTS curated_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('news', 'article', 'video', 'trend')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  summary TEXT, -- AI 생성 요약
  source TEXT, -- 출처 (네이버, 유튜브, 구글 트렌드 등)
  relevance_score FLOAT, -- 관련성 점수 (0.0 ~ 1.0)
  published_at TIMESTAMPTZ, -- 콘텐츠 발행일
  curated_at TIMESTAMPTZ DEFAULT NOW(), -- 큐레이션된 시간
  is_sent BOOLEAN DEFAULT false, -- 뉴스레터 발송 여부
  sent_at TIMESTAMPTZ -- 발송 시간
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_curated_items_user_id ON curated_items(user_id);
CREATE INDEX IF NOT EXISTS idx_curated_items_curated_at ON curated_items(curated_at DESC);
CREATE INDEX IF NOT EXISTS idx_curated_items_is_sent ON curated_items(is_sent);

-- =============================================================================
-- 5. Newsletters 테이블 (발송된 뉴스레터 기록)
-- =============================================================================
CREATE TABLE IF NOT EXISTS newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL, -- 이메일 제목
  html_content TEXT NOT NULL, -- HTML 이메일 본문
  draft_content TEXT, -- Claude가 생성한 블로그 초안
  curated_item_ids UUID[], -- 포함된 큐레이션 아이템 ID 배열
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ, -- 이메일 오픈 시간
  clicked_at TIMESTAMPTZ, -- 링크 클릭 시간
  email_provider_id TEXT, -- Resend 메시지 ID
  status TEXT DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'failed', 'bounced'))
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_newsletters_user_id ON newsletters(user_id);
CREATE INDEX IF NOT EXISTS idx_newsletters_sent_at ON newsletters(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletters_status ON newsletters(status);

-- =============================================================================
-- 6. 함수: 사용자 통계 조회
-- =============================================================================
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_posts BIGINT,
  analyzed_posts BIGINT,
  total_newsletters BIGINT,
  curated_items_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM blog_posts WHERE user_id = p_user_id) AS total_posts,
    (SELECT COUNT(*) FROM blog_posts WHERE user_id = p_user_id AND is_analyzed = true) AS analyzed_posts,
    (SELECT COUNT(*) FROM newsletters WHERE user_id = p_user_id) AS total_newsletters,
    (SELECT COUNT(*) FROM curated_items WHERE user_id = p_user_id AND is_sent = false) AS curated_items_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. 트리거: writing_dna 업데이트 시 updated_at 자동 갱신
-- =============================================================================
CREATE OR REPLACE FUNCTION update_writing_dna_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_writing_dna_timestamp
BEFORE UPDATE ON writing_dna
FOR EACH ROW
EXECUTE FUNCTION update_writing_dna_timestamp();

-- =============================================================================
-- 8. Row Level Security (RLS) 활성화
-- =============================================================================
-- 사용자는 자신의 데이터만 접근 가능

-- Users 테이블
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON users
  FOR SELECT USING (true); -- 모든 사용자 조회 가능 (프로필 공개)

CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth.uid() = id);

-- Blog Posts 테이블
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY blog_posts_select_own ON blog_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY blog_posts_insert_own ON blog_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY blog_posts_update_own ON blog_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY blog_posts_delete_own ON blog_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Writing DNA 테이블
ALTER TABLE writing_dna ENABLE ROW LEVEL SECURITY;

CREATE POLICY writing_dna_select_own ON writing_dna
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY writing_dna_insert_own ON writing_dna
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY writing_dna_update_own ON writing_dna
  FOR UPDATE USING (auth.uid() = user_id);

-- Curated Items 테이블
ALTER TABLE curated_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY curated_items_select_own ON curated_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY curated_items_insert_own ON curated_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY curated_items_update_own ON curated_items
  FOR UPDATE USING (auth.uid() = user_id);

-- Newsletters 테이블
ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;

CREATE POLICY newsletters_select_own ON newsletters
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY newsletters_insert_own ON newsletters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 완료 메시지
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ MyBlogDaily 초기 스키마 생성 완료!';
  RAISE NOTICE '테이블: users, blog_posts, writing_dna, curated_items, newsletters';
  RAISE NOTICE '함수: get_user_stats()';
  RAISE NOTICE 'RLS: 모든 테이블에 활성화됨';
END $$;
