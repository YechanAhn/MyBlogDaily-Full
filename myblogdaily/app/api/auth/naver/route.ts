/**
 * 네이버 로그인 시작 API
 *
 * URL: /api/auth/naver
 * Method: GET
 *
 * 사용자를 네이버 로그인 페이지로 리다이렉트합니다.
 *
 * 플로우:
 * 1. 사용자가 "네이버로 로그인" 버튼 클릭
 * 2. 이 API 호출
 * 3. 네이버 로그인 페이지로 리다이렉트
 * 4. 사용자가 네이버에서 로그인
 * 5. 네이버가 /api/auth/naver/callback으로 리다이렉트
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateNaverLoginUrl, generateState } from '@/lib/auth/naver';

/**
 * GET /api/auth/naver
 *
 * 네이버 로그인 페이지로 리다이렉트합니다.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. CSRF 방지를 위한 랜덤 state 생성
    const state = generateState();

    // 2. state를 쿠키에 저장 (나중에 콜백에서 검증)
    // 쿠키는 httpOnly로 설정하여 JavaScript에서 접근 불가
    const response = NextResponse.redirect(generateNaverLoginUrl(state));

    response.cookies.set('naver_oauth_state', state, {
      httpOnly: true, // JavaScript에서 접근 불가 (보안)
      secure: process.env.NODE_ENV === 'production', // HTTPS에서만 (프로덕션)
      sameSite: 'lax', // CSRF 공격 방지
      maxAge: 60 * 10, // 10분 (600초)
      path: '/', // 모든 경로에서 접근 가능
    });

    // 3. 네이버 로그인 페이지로 리다이렉트
    return response;
  } catch (error) {
    // 에러 발생 시 로그 출력 및 에러 페이지로 리다이렉트
    console.error('네이버 로그인 시작 에러:', error);

    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent('네이버 로그인 시작에 실패했습니다.')}`,
        request.url
      )
    );
  }
}
