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
import { createAdminClient } from '@/lib/supabase/server';

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
    const adminClient = createAdminClient();

    // ⚠️ 네이버 ID로 기존 사용자 확인 (users 테이블)
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id')
      .eq('naver_id', naverProfile.id)
      .single();

    let userId: string;

    if (existingUser && existingUser.id) {
      // 기존 사용자: users 테이블의 ID 사용
      userId = existingUser.id;
      console.log('기존 사용자 로그인:', userId);
    } else {
      // 신규 사용자: 새로운 Supabase Auth 사용자 생성
      console.log('신규 사용자 회원가입:', naverProfile.email);

      // 고유한 비밀번호 생성 (실제로는 사용 안 함, 네이버 로그인만 사용)
      const randomPassword = Math.random().toString(36).slice(2) +
                             Math.random().toString(36).slice(2) +
                             Math.random().toString(36).slice(2);

      try {
        // admin.createUser: 이메일 확인 자동 완료 + RLS 우회
        const { data: authData, error: authError } =
          await adminClient.auth.admin.createUser({
            email: naverProfile.email,
            password: randomPassword,
            email_confirm: true, // ✅ 이메일 자동 확인 (중요!)
            user_metadata: {
              name: naverProfile.name,
              naver_id: naverProfile.id,
            },
          });

        if (authError || !authData.user) {
          throw new Error(
            `Supabase Auth 사용자 생성 실패: ${authError?.message || '알 수 없는 오류'}`
          );
        }

        userId = authData.user.id;
        console.log('신규 사용자 생성 완료:', userId);
      } catch (createUserError) {
        console.error('사용자 생성 중 에러:', createUserError);
        throw createUserError;
      }
    }
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
