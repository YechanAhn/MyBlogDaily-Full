/**
 * Next.js 설정 파일
 *
 * 이 파일은 Next.js 앱의 동작 방식을 설정합니다.
 * - 이미지 최적화, 환경 변수, 리다이렉트 등을 설정할 수 있습니다.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 이미지 최적화 설정
  images: {
    // 외부 이미지를 사용할 수 있는 도메인 목록
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.naver.com', // 네이버 블로그 이미지
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co', // Supabase 스토리지
      },
    ],
  },

  // 환경 변수 노출 (NEXT_PUBLIC_으로 시작하는 것들만 브라우저에서 접근 가능)
  env: {
    // 추가 환경 변수가 필요하면 여기에 작성
  },

  // 실험적 기능 (필요시 활성화)
  experimental: {
    // serverActions: true, // 서버 액션 사용 시
  },
};

// 설정을 내보냄
module.exports = nextConfig;
