/**
 * Supabase 클라이언트 설정
 *
 * Supabase는 데이터베이스, 인증, 스토리지를 제공하는 서비스입니다.
 * 이 파일은 브라우저에서 Supabase에 연결하기 위한 클라이언트를 생성합니다.
 *
 * 사용 예시:
 * ```ts
 * import { supabase } from '@/lib/supabase/client';
 *
 * const { data, error } = await supabase
 *   .from('users')
 *   .select('*');
 * ```
 */

import { createBrowserClient } from '@supabase/ssr';

// === Supabase 클라이언트 생성 함수 ===
/**
 * 브라우저용 Supabase 클라이언트를 생성합니다.
 *
 * @returns Supabase 클라이언트 인스턴스
 */
export function createClient() {
  // 1. 환경 변수에서 Supabase URL과 키 가져오기
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 2. 환경 변수가 설정되지 않았으면 에러 발생
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase 환경 변수가 설정되지 않았습니다. ' +
      '.env.local 파일에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 추가하세요.'
    );
  }

  // 3. 브라우저 클라이언트 생성
  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  );
}

// === 전역 클라이언트 인스턴스 ===
/**
 * Supabase 클라이언트 싱글톤 인스턴스
 * 앱 전체에서 같은 인스턴스를 재사용합니다.
 *
 * 이렇게 하는 이유:
 * - 불필요한 중복 연결 방지
 * - 성능 향상
 * - 메모리 절약
 */
export const supabase = createClient();

// === 타입 헬퍼 (나중에 사용) ===
/**
 * Supabase Database 타입
 * 실제 데이터베이스 스키마에서 자동 생성될 예정
 */
export type Database = any; // TODO: supabase gen types로 자동 생성
