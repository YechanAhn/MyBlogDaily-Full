/**
 * Supabase 서버 클라이언트 설정
 *
 * 이 파일은 서버 사이드(API 라우트, 서버 컴포넌트)에서
 * Supabase에 연결하기 위한 클라이언트를 생성합니다.
 *
 * 브라우저용(client.ts)과의 차이점:
 * - 쿠키를 사용하여 인증 상태 유지
 * - Service Role Key를 사용할 수 있음 (관리자 권한)
 * - 서버에서만 실행됨 (보안상 더 안전)
 *
 * 사용 예시:
 * ```ts
 * import { createServerClient } from '@/lib/supabase/server';
 * import { cookies } from 'next/headers';
 *
 * const supabase = createServerClient(cookies());
 * const { data } = await supabase.from('users').select('*');
 * ```
 */

import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { type CookieOptions } from '@supabase/ssr';

/**
 * 서버용 Supabase 클라이언트 생성
 *
 * @param cookieStore - Next.js의 cookies() 함수로 가져온 쿠키 저장소
 * @returns Supabase 서버 클라이언트 인스턴스
 */
export function createServerClient(cookieStore: ReturnType<typeof cookies>) {
  // 1. 환경 변수에서 Supabase URL과 키 가져오기
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 2. 환경 변수가 설정되지 않았으면 에러 발생
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase 환경 변수가 설정되지 않았습니다. ' +
      '.env.local 파일을 확인하세요.'
    );
  }

  // 3. 서버 클라이언트 생성 (쿠키 설정 포함)
  return createSupabaseServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      // 쿠키 처리 로직
      cookies: {
        /**
         * 쿠키 가져오기
         * 인증 토큰 등을 쿠키에서 읽어옴
         */
        get(name: string) {
          return cookieStore.get(name)?.value;
        },

        /**
         * 쿠키 설정
         * 새로운 인증 토큰 등을 쿠키에 저장
         */
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({
              name,
              value,
              ...options,
              // 보안 설정
              sameSite: 'lax', // CSRF 공격 방지
              secure: process.env.NODE_ENV === 'production', // HTTPS에서만 (프로덕션)
            });
          } catch (error) {
            // 서버 컴포넌트에서는 쿠키 설정이 안 될 수 있음 (무시)
            console.warn('쿠키 설정 실패:', error);
          }
        },

        /**
         * 쿠키 삭제
         * 로그아웃 시 등에 사용
         */
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({
              name,
              value: '',
              ...options,
              maxAge: 0, // 즉시 만료
            });
          } catch (error) {
            console.warn('쿠키 삭제 실패:', error);
          }
        },
      },
    }
  );
}

/**
 * 관리자 권한 Supabase 클라이언트 생성
 *
 * Service Role Key를 사용하여 모든 권한을 가진 클라이언트를 생성합니다.
 * ⚠️ 주의: 이 클라이언트는 모든 데이터에 접근 가능하므로
 * 서버에서만 사용해야 하며, 절대 브라우저로 노출되면 안 됩니다!
 *
 * 사용 예시:
 * - 사용자 데이터 일괄 처리
 * - 관리자 전용 작업
 * - Cron Job
 *
 * @returns 관리자 권한 Supabase 클라이언트
 */
export function createAdminClient() {
  // 1. 환경 변수에서 Service Role Key 가져오기
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 2. 환경 변수가 설정되지 않았으면 에러 발생
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Supabase Service Role Key가 설정되지 않았습니다. ' +
      '.env.local 파일에 SUPABASE_SERVICE_ROLE_KEY를 추가하세요.'
    );
  }

  // 3. 관리자 클라이언트 생성
  return createSupabaseServerClient(
    supabaseUrl,
    supabaseServiceKey,
    {
      cookies: {
        // 관리자 클라이언트는 쿠키 사용 안 함
        get: () => undefined,
        set: () => {},
        remove: () => {},
      },
    }
  );
}

// === Next.js의 cookies 함수 타입 가져오기 ===
import { cookies } from 'next/headers';

/**
 * API 라우트용 간단한 Supabase 클라이언트 생성
 *
 * createServerClient의 wrapper로, cookies()를 자동으로 호출합니다.
 *
 * 사용 예시:
 * ```ts
 * import { createClient } from '@/lib/supabase/server';
 *
 * const supabase = createClient();
 * const { data } = await supabase.from('users').select('*');
 * ```
 */
export function createClient() {
  return createServerClient(cookies());
}
