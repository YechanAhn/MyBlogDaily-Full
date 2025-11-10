/**
 * 로그아웃 API
 *
 * URL: /api/auth/logout
 * Method: POST
 *
 * 사용자를 로그아웃하고 모든 세션을 삭제합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/logout
 *
 * 사용자를 로그아웃합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);

    // 1. Supabase Auth 세션 삭제
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(`로그아웃 실패: ${error.message}`);
    }

    // 2. 로그인 페이지로 리다이렉트
    return NextResponse.redirect(new URL('/login', request.url));
  } catch (error) {
    console.error('로그아웃 에러:', error);

    // 에러가 있어도 로그인 페이지로 리다이렉트
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
