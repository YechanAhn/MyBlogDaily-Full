/**
 * 네이버 로그인 콜백 API
 *
 * URL: /api/auth/naver/callback
 * Method: GET
 *
 * 네이버 로그인 후 리다이렉트되는 엔드포인트입니다.
 * 인증 코드를 받아 액세스 토큰을 발급하고, 사용자 정보를 가져와서 DB에 저장합니다.
 *
 * 플로우:
 * 1. 네이버에서 code와 state를 쿼리 파라미터로 전달
 * 2. state 검증 (CSRF 공격 방지)
 * 3. code로 액세스 토큰 발급
 * 4. 액세스 토큰으로 사용자 프로필 조회
 * 5. Supabase Auth에 사용자 생성 또는 업데이트
 * 6. 사용자 정보를 users 테이블에 저장
 * 7. 대시보드로 리다이렉트
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getNaverAccessToken,
  getNaverUserProfile,
} from '@/lib/auth/naver';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/auth/naver/callback
 *
 * 네이버 OAuth 콜백을 처리합니다.
 */
export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const requestUrl = new URL(request.url);

  // 1. 쿼리 파라미터에서 code와 state 추출
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // 에러가 있으면 로그인 페이지로 리다이렉트
  if (error) {
    console.error('네이버 로그인 에러:', error, errorDescription);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(errorDescription || '네이버 로그인에 실패했습니다.')}`,
        request.url
      )
    );
  }

  // code와 state가 없으면 에러
  if (!code || !state) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent('잘못된 요청입니다.')}`,
        request.url
      )
    );
  }

  try {
    // 2. state 검증 (CSRF 공격 방지)
    const savedState = cookieStore.get('naver_oauth_state')?.value;

    if (!savedState || savedState !== state) {
      throw new Error('CSRF 토큰 검증 실패');
    }

    // 3. 액세스 토큰 발급
    const tokens = await getNaverAccessToken(code, state);

    // 4. 사용자 프로필 조회
    const naverProfile = await getNaverUserProfile(tokens.access_token);

    // 5. Supabase Auth에 사용자 생성/업데이트
    const supabase = createServerClient(cookieStore);

    // 이메일로 기존 사용자 찾기
    const { data: existingUser } = await supabase.auth.getUser();

    let userId: string;

    if (existingUser && existingUser.user) {
      // 이미 로그인된 사용자 (토큰 업데이트)
      userId = existingUser.user.id;
    } else {
      // 신규 사용자 또는 로그아웃 상태
      // Supabase Auth에 사용자 생성 (이메일 기반)
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: naverProfile.email,
          password: naverProfile.id, // 네이버 ID를 비밀번호로 사용 (임시)
        });

      if (authError) {
        // 사용자가 없으면 회원가입
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({
            email: naverProfile.email,
            password: naverProfile.id,
            options: {
              data: {
                name: naverProfile.name,
                naver_id: naverProfile.id,
              },
              emailRedirectTo: undefined, // 이메일 확인 비활성화
            },
          });

        if (signUpError || !signUpData.user) {
          throw new Error(`회원가입 실패: ${signUpError?.message}`);
        }

        userId = signUpData.user.id;

        // 회원가입 후 명시적으로 로그인하여 세션 생성
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: naverProfile.email,
          password: naverProfile.id,
        });

        if (signInError) {
          console.error('회원가입 후 로그인 에러:', signInError);
          // 에러가 있어도 계속 진행 (세션이 이미 있을 수 있음)
        }
      } else {
        if (!authData.user) {
          throw new Error('로그인 실패: 사용자 정보를 가져올 수 없습니다.');
        }
        userId = authData.user.id;
      }
    }

    // 6. users 테이블에 사용자 정보 저장 또는 업데이트
    // RLS를 우회하기 위해 관리자 클라이언트 사용
    const adminClient = createAdminClient();
    const { error: upsertError } = await adminClient
      .from('users')
      .upsert(
        {
          id: userId,
          email: naverProfile.email,
          name: naverProfile.name,
          naver_access_token: tokens.access_token,
          naver_refresh_token: tokens.refresh_token,
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'id', // id가 같으면 업데이트
        }
      );

    if (upsertError) {
      console.error('사용자 정보 저장 에러:', upsertError);
      throw new Error(`사용자 정보 저장 실패: ${upsertError.message}`);
    }

    // 7. state 쿠키 삭제 (보안)
    const response = NextResponse.redirect(
      new URL('/dashboard', request.url)
    );

    response.cookies.delete('naver_oauth_state');

    // 8. 대시보드로 리다이렉트
    return response;
  } catch (error) {
    // 에러 발생 시 로그 출력 및 로그인 페이지로 리다이렉트
    console.error('네이버 로그인 콜백 에러:', error);

    // state 쿠키 삭제
    const response = NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          error instanceof Error ? error.message : '로그인에 실패했습니다.'
        )}`,
        request.url
      )
    );

    response.cookies.delete('naver_oauth_state');

    return response;
  }
}
