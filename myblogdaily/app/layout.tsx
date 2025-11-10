/**
 * 루트 레이아웃 컴포넌트
 *
 * 이 컴포넌트는 앱의 모든 페이지를 감싸는 최상위 레이아웃입니다.
 * - HTML 구조 (html, body 태그)
 * - 전역 스타일 (globals.css)
 * - 메타데이터 (제목, 설명 등)
 * - 폰트 설정
 *
 * 모든 페이지에서 공통으로 사용되는 요소를 여기에 작성합니다.
 */

import type { Metadata } from 'next';
import './globals.css'; // 전역 CSS 파일 임포트

// === 메타데이터 설정 ===
// SEO를 위한 페이지 정보
export const metadata: Metadata = {
  title: 'MyBlogDaily', // 브라우저 탭에 표시될 제목
  description: '매일 맞춤형 블로그 콘텐츠 아이디어와 초안을 받아보세요', // 검색 엔진 설명
  keywords: ['블로그', 'AI', '뉴스레터', '콘텐츠 작성', '네이버 블로그'], // 검색 키워드
  authors: [{ name: 'MyBlogDaily Team' }], // 작성자
  // Open Graph (SNS 공유 시 표시될 정보)
  openGraph: {
    title: 'MyBlogDaily',
    description: '매일 맞춤형 블로그 콘텐츠 아이디어와 초안을 받아보세요',
    type: 'website',
    locale: 'ko_KR',
  },
};

// === 루트 레이아웃 컴포넌트 ===
export default function RootLayout({
  children, // 이 위치에 각 페이지의 내용이 들어갑니다
}: {
  children: React.ReactNode; // children은 React 노드 타입
}) {
  return (
    // lang="ko": 한국어 페이지임을 명시
    <html lang="ko">
      <body>
        {/* === 전체 앱 컨테이너 === */}
        <div className="min-h-screen flex flex-col">
          {/*
            min-h-screen: 최소 높이를 화면 전체로
            flex flex-col: 세로 방향 flexbox
          */}

          {/* === 헤더 (모든 페이지 공통) === */}
          <header className="bg-white border-b border-gray-200">
            {/*
              bg-white: 흰색 배경
              border-b: 아래쪽 테두리
              border-gray-200: 회색 테두리 색상
            */}
            <div className="container-center py-4">
              {/*
                container-center: globals.css에서 정의한 중앙 정렬 컨테이너
                py-4: 위아래 여백 16px (1rem = 16px, py-4 = 4 * 0.25rem)
              */}
              <div className="flex items-center justify-between">
                {/*
                  flex: flexbox 사용
                  items-center: 세로 중앙 정렬
                  justify-between: 양 끝에 배치
                */}

                {/* 로고 */}
                <a href="/" className="text-xl font-bold text-gray-900">
                  {/*
                    text-xl: 글자 크기 20px
                    font-bold: 굵은 글씨
                    text-gray-900: 거의 검은색
                  */}
                  🤖 MyBlogDaily
                </a>

                {/* 네비게이션 (나중에 추가 예정) */}
                <nav>
                  {/* 로그인/회원가입 버튼 등이 들어갈 자리 */}
                </nav>
              </div>
            </div>
          </header>

          {/* === 메인 콘텐츠 영역 === */}
          <main className="flex-1">
            {/*
              flex-1: 남은 공간을 모두 차지 (헤더, 푸터 제외)
              이렇게 하면 푸터가 항상 화면 맨 아래에 위치합니다
            */}
            {children}
            {/* 각 페이지의 내용이 여기에 렌더링됩니다 */}
          </main>

          {/* === 푸터 (모든 페이지 공통) === */}
          <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
            {/*
              bg-gray-50: 연한 회색 배경
              border-t: 위쪽 테두리
              mt-auto: 위쪽 마진 자동 (항상 맨 아래 위치)
            */}
            <div className="container-center py-6">
              {/* py-6: 위아래 여백 24px */}
              <div className="text-center text-sm text-gray-600">
                {/*
                  text-center: 텍스트 중앙 정렬
                  text-sm: 작은 글자 (14px)
                  text-gray-600: 회색 글자
                */}
                <p>© 2024 MyBlogDaily. All rights reserved.</p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
