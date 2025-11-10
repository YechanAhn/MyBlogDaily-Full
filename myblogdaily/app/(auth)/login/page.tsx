/**
 * 로그인 페이지
 *
 * URL: /login
 *
 * 사용자가 네이버로 로그인할 수 있는 페이지입니다.
 * - 네이버 로그인 버튼
 * - 에러 메시지 표시
 * - MyBlogDaily 서비스 소개
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  // URL 쿼리 파라미터에서 에러 메시지 가져오기
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 에러 메시지가 URL에 있으면 표시
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  /**
   * 네이버 로그인 버튼 클릭 핸들러
   */
  const handleNaverLogin = () => {
    // /api/auth/naver로 리다이렉트
    window.location.href = '/api/auth/naver';
  };

  return (
    // 전체 화면 중앙 정렬 컨테이너
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white">
      {/*
        min-h-screen: 최소 높이를 화면 전체로
        flex items-center justify-center: 수평/수직 중앙 정렬
        bg-gradient-to-br: 왼쪽 위에서 오른쪽 아래로 그라데이션
      */}

      {/* 로그인 카드 */}
      <div className="w-full max-w-md px-6">
        {/*
          w-full: 전체 너비
          max-w-md: 최대 너비 448px
          px-6: 좌우 여백 24px
        */}

        {/* 카드 컨테이너 */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/*
            bg-white: 흰색 배경
            rounded-2xl: 둥근 모서리
            shadow-xl: 큰 그림자
            p-8: 모든 방향 여백 32px
          */}

          {/* 로고 및 제목 */}
          <div className="text-center mb-8">
            {/* 로고 이모지 */}
            <div className="text-6xl mb-4">🤖</div>

            {/* 서비스 이름 */}
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              MyBlogDaily
            </h1>

            {/* 서비스 설명 */}
            <p className="text-gray-600">
              매일 아침, AI가 작성한
              <br />
              블로그 초안을 받아보세요
            </p>
          </div>

          {/* 에러 메시지 (에러가 있을 때만 표시) */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              {/*
                mb-6: 아래쪽 여백 24px
                p-4: 모든 방향 여백 16px
                bg-red-50: 연한 빨간색 배경
                border border-red-200: 빨간색 테두리
                rounded-lg: 둥근 모서리
              */}
              <div className="flex items-start">
                {/* 에러 아이콘 */}
                <span className="text-red-500 mr-2">⚠️</span>

                {/* 에러 메시지 */}
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* 네이버 로그인 버튼 */}
          <button
            onClick={handleNaverLogin}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-3"
          >
            {/*
              w-full: 전체 너비
              bg-primary-500: 네이버 그린 배경
              hover:bg-primary-600: 마우스 올리면 진한 그린
              text-white: 흰색 글자
              font-semibold: 세미볼드
              py-4: 위아래 여백 16px
              px-6: 좌우 여백 24px
              rounded-lg: 둥근 모서리
              transition-colors: 색상 전환 애니메이션
              duration-200: 0.2초
              flex items-center justify-center: 중앙 정렬
              gap-3: 요소 사이 간격 12px
            */}

            {/* 네이버 아이콘 (이모지) */}
            <span className="text-2xl">🟢</span>

            {/* 버튼 텍스트 */}
            <span>네이버로 시작하기</span>
          </button>

          {/* 추가 안내 문구 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              로그인하면 MyBlogDaily의{' '}
              <a
                href="/terms"
                className="text-primary-600 hover:underline"
              >
                이용약관
              </a>
              과{' '}
              <a
                href="/privacy"
                className="text-primary-600 hover:underline"
              >
                개인정보 처리방침
              </a>
              에 동의하게 됩니다.
            </p>
          </div>
        </div>

        {/* 하단 링크 */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-gray-600 hover:text-gray-900 text-sm"
          >
            ← 홈으로 돌아가기
          </a>
        </div>
      </div>
    </div>
  );
}
