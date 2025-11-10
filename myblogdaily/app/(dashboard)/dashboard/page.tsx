/**
 * 대시보드 페이지
 *
 * URL: /dashboard
 *
 * 로그인한 사용자의 메인 대시보드입니다.
 * - 사용자 정보 표시
 * - 블로그 포스트 수집 상태
 * - 문체 분석 상태
 * - 최근 뉴스레터
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

/**
 * 대시보드 페이지 (서버 컴포넌트)
 */
export default async function DashboardPage() {
  // 1. Supabase 클라이언트 생성
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);

  // 2. 현재 로그인된 사용자 확인
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // 로그인하지 않았으면 로그인 페이지로 리다이렉트
  if (!authUser) {
    redirect('/login');
  }

  // 3. users 테이블에서 사용자 정보 가져오기
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (userError) {
    console.error('사용자 정보 조회 에러:', userError);
  }

  // 4. 사용자 통계 조회
  const { data: statsData } = await supabase.rpc('get_user_stats', {
    p_user_id: authUser.id,
  });

  const stats = statsData || {
    total_posts: 0,
    total_newsletters: 0,
    newsletters_sent: 0,
    curated_items: 0,
    has_writing_dna: false,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200">
        <div className="container-center py-4">
          <div className="flex items-center justify-between">
            {/* 로고 */}
            <a href="/" className="text-xl font-bold text-gray-900">
              🤖 MyBlogDaily
            </a>

            {/* 사용자 메뉴 */}
            <div className="flex items-center gap-4">
              {/* 사용자 이름 */}
              <span className="text-sm text-gray-700">
                {user?.name || user?.email}
              </span>

              {/* 로그아웃 버튼 */}
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  로그아웃
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="container-center py-8">
        {/* 환영 메시지 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            안녕하세요, {user?.name || '사용자'}님! 👋
          </h1>
          <p className="text-gray-600">
            오늘도 멋진 블로그 포스트를 작성해보세요.
          </p>
        </div>

        {/* 통계 카드들 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 총 포스트 수 */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">총 포스트</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.total_posts}
                </p>
              </div>
              <div className="text-4xl">📝</div>
            </div>
          </div>

          {/* 생성된 뉴스레터 */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">생성된 초안</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.total_newsletters}
                </p>
              </div>
              <div className="text-4xl">✉️</div>
            </div>
          </div>

          {/* 발송된 뉴스레터 */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">발송된 초안</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.newsletters_sent}
                </p>
              </div>
              <div className="text-4xl">📬</div>
            </div>
          </div>

          {/* 큐레이션 아이템 */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">큐레이션</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.curated_items}
                </p>
              </div>
              <div className="text-4xl">📰</div>
            </div>
          </div>
        </div>

        {/* 시작하기 섹션 */}
        {stats.total_posts === 0 && (
          <div className="card bg-primary-50 border-2 border-primary-200 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              🚀 시작하기
            </h2>
            <p className="text-gray-700 mb-6">
              MyBlogDaily를 시작하려면 먼저 네이버 블로그를 연결하고 포스트를
              수집해야 합니다.
            </p>

            <div className="space-y-4">
              {/* Step 1: 블로그 연결 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    네이버 블로그 연결
                  </h3>
                  <p className="text-sm text-gray-600">
                    설정 페이지에서 네이버 블로그 URL을 입력하세요.
                  </p>
                </div>
              </div>

              {/* Step 2: 포스트 수집 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    포스트 수집
                  </h3>
                  <p className="text-sm text-gray-600">
                    최근 50개의 블로그 포스트를 수집합니다.
                  </p>
                </div>
              </div>

              {/* Step 3: 문체 분석 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    문체 분석
                  </h3>
                  <p className="text-sm text-gray-600">
                    AI가 당신의 글쓰기 스타일을 분석합니다.
                  </p>
                </div>
              </div>

              {/* Step 4: 초안 받기 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    초안 받기
                  </h3>
                  <p className="text-sm text-gray-600">
                    매일 아침 맞춤형 블로그 초안을 이메일로 받아보세요.
                  </p>
                </div>
              </div>
            </div>

            {/* 설정 페이지로 이동 버튼 */}
            <div className="mt-6">
              <a
                href="/dashboard/settings"
                className="btn btn-primary inline-block"
              >
                설정하러 가기 →
              </a>
            </div>
          </div>
        )}

        {/* 빠른 액션 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 새 초안 생성 */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ✍️ 새 초안 생성
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              AI가 오늘의 콘텐츠 아이디어와 초안을 생성합니다.
            </p>
            <button
              className="btn btn-primary w-full"
              disabled={!stats.has_writing_dna}
            >
              {stats.has_writing_dna
                ? '초안 생성하기'
                : '먼저 문체 분석을 완료하세요'}
            </button>
          </div>

          {/* 설정 */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ⚙️ 설정
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              블로그 연결, 뉴스레터 시간 등을 설정합니다.
            </p>
            <a href="/dashboard/settings" className="btn bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 w-full block text-center">
              설정 페이지로
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
