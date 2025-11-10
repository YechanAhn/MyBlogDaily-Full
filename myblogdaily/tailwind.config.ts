/**
 * Tailwind CSS 설정 파일
 *
 * Tailwind CSS는 유틸리티 기반 CSS 프레임워크입니다.
 * 클래스 이름으로 스타일을 빠르게 적용할 수 있습니다.
 *
 * 예: <div className="bg-blue-500 text-white p-4 rounded-lg">
 *      → 파란 배경, 흰 글자, 여백 16px, 둥근 모서리
 */

import type { Config } from 'tailwindcss';

const config: Config = {
  // === 어떤 파일에서 Tailwind 클래스를 사용하는지 지정 ===
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}', // pages 폴더
    './components/**/*.{js,ts,jsx,tsx,mdx}', // components 폴더
    './app/**/*.{js,ts,jsx,tsx,mdx}', // app 폴더 (App Router)
  ],

  // === 테마 커스터마이징 ===
  theme: {
    extend: {
      // 배경 그라데이션 설정
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },

      // 프로젝트 전용 색상 정의
      colors: {
        // 브랜드 컬러 (네이버 초록색과 유사)
        primary: {
          50: '#e6f7ee',
          100: '#b3e6cc',
          200: '#80d5aa',
          300: '#4dc488',
          400: '#1ab366',
          500: '#03c75a', // 메인 컬러 (네이버 그린)
          600: '#02a04a',
          700: '#02793a',
          800: '#01522a',
          900: '#012b1a',
        },
        // 보조 컬러
        secondary: {
          50: '#f0f4ff',
          100: '#d9e2ff',
          200: '#b3c5ff',
          300: '#8ca8ff',
          400: '#668bff',
          500: '#406eff',
          600: '#3358cc',
          700: '#264299',
          800: '#1a2c66',
          900: '#0d1633',
        },
      },

      // 폰트 설정 (한글 최적화)
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'Pretendard Variable',
          'Pretendard',
          'Roboto',
          'Noto Sans KR',
          'Segoe UI',
          'Malgun Gothic',
          'sans-serif',
        ],
      },
    },
  },

  // === 플러그인 ===
  plugins: [
    // 필요한 Tailwind 플러그인을 여기에 추가
    // 예: require('@tailwindcss/forms'),
  ],
};

export default config;
