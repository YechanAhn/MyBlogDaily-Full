/**
 * PostCSS 설정 파일
 *
 * PostCSS는 CSS를 변환하는 도구입니다.
 * Tailwind CSS와 Autoprefixer를 사용하도록 설정합니다.
 *
 * - Tailwind CSS: 유틸리티 클래스를 실제 CSS로 변환
 * - Autoprefixer: 브라우저 호환성을 위해 자동으로 접두사 추가
 *   (예: -webkit-, -moz- 등)
 */

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {}, // Tailwind CSS 플러그인
    autoprefixer: {}, // Autoprefixer 플러그인
  },
};

export default config;
