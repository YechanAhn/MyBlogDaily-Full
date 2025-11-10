/**
 * 네이버 OAuth 2.0 인증 헬퍼 함수
 *
 * 네이버 로그인 API를 사용하여 사용자를 인증합니다.
 * 공식 문서: https://developers.naver.com/docs/login/api/
 */

// ============================================
// 타입 정의
// ============================================

/** 네이버 사용자 프로필 */
export interface NaverUserProfile {
  id: string; // 네이버 고유 ID
  email: string; // 이메일
  name: string; // 이름
  nickname: string; // 닉네임
  profile_image: string | null; // 프로필 이미지 URL
  age: string | null; // 연령대
  gender: 'M' | 'F' | 'U' | null; // 성별
  birthday: string | null; // 생일 (MM-DD)
  birthyear: string | null; // 생년 (YYYY)
}

/** 네이버 토큰 응답 */
export interface NaverTokenResponse {
  access_token: string; // 액세스 토큰
  refresh_token: string; // 리프레시 토큰
  token_type: string; // 토큰 타입 (항상 "bearer")
  expires_in: number; // 토큰 만료 시간 (초)
}

/** 네이버 API 에러 */
export interface NaverApiError {
  errorMessage: string;
  errorCode: string;
}

// ============================================
// 환경 변수 확인
// ============================================

/**
 * 네이버 API 환경 변수를 가져옵니다.
 * 환경 변수가 설정되지 않으면 에러를 발생시킵니다.
 */
function getNaverConfig() {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  const callbackUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/naver/callback`
    : 'http://localhost:3000/api/auth/naver/callback';

  if (!clientId || !clientSecret) {
    throw new Error(
      '네이버 API 키가 설정되지 않았습니다. ' +
        '.env.local 파일에 NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET를 추가하세요.'
    );
  }

  return {
    clientId,
    clientSecret,
    callbackUrl,
  };
}

// ============================================
// OAuth 2.0 URL 생성
// ============================================

/**
 * 네이버 로그인 페이지 URL을 생성합니다.
 *
 * @param state - CSRF 공격 방지를 위한 랜덤 문자열
 * @returns 네이버 로그인 페이지 URL
 *
 * 사용 예시:
 * ```ts
 * const loginUrl = generateNaverLoginUrl('random-state-string');
 * // 사용자를 이 URL로 리다이렉트
 * ```
 */
export function generateNaverLoginUrl(state: string): string {
  const { clientId, callbackUrl } = getNaverConfig();

  // URL 쿼리 파라미터 생성
  const params = new URLSearchParams({
    response_type: 'code', // 응답 타입 (항상 code)
    client_id: clientId, // 클라이언트 ID
    redirect_uri: callbackUrl, // 콜백 URL
    state: state, // CSRF 방지 토큰
  });

  // 네이버 로그인 URL 반환
  return `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`;
}

// ============================================
// 액세스 토큰 발급
// ============================================

/**
 * 인증 코드를 사용하여 액세스 토큰을 발급받습니다.
 *
 * @param code - 네이버에서 받은 인증 코드
 * @param state - CSRF 방지 토큰
 * @returns 액세스 토큰 및 리프레시 토큰
 *
 * @throws {Error} API 호출 실패 시
 */
export async function getNaverAccessToken(
  code: string,
  state: string
): Promise<NaverTokenResponse> {
  const { clientId, clientSecret } = getNaverConfig();

  try {
    // 1. 네이버 토큰 엔드포인트 호출
    const params = new URLSearchParams({
      grant_type: 'authorization_code', // 권한 부여 타입
      client_id: clientId,
      client_secret: clientSecret,
      code: code, // 인증 코드
      state: state, // CSRF 방지 토큰
    });

    const response = await fetch(
      `https://nid.naver.com/oauth2.0/token?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // 2. 응답 처리
    const data = await response.json();

    // 에러 체크
    if (!response.ok || data.error) {
      throw new Error(
        `네이버 토큰 발급 실패: ${data.error_description || data.error}`
      );
    }

    // 3. 토큰 응답 반환
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
    };
  } catch (error) {
    console.error('네이버 토큰 발급 에러:', error);
    throw new Error(
      `네이버 토큰 발급 실패: ${
        error instanceof Error ? error.message : '알 수 없는 오류'
      }`
    );
  }
}

// ============================================
// 사용자 프로필 조회
// ============================================

/**
 * 액세스 토큰을 사용하여 사용자 프로필을 조회합니다.
 *
 * @param accessToken - 네이버 액세스 토큰
 * @returns 사용자 프로필 정보
 *
 * @throws {Error} API 호출 실패 시
 */
export async function getNaverUserProfile(
  accessToken: string
): Promise<NaverUserProfile> {
  try {
    // 1. 네이버 프로필 API 호출
    const response = await fetch('https://openapi.naver.com/v1/nid/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`, // 액세스 토큰
      },
    });

    // 2. 응답 처리
    const data = await response.json();

    // 에러 체크
    if (!response.ok || data.resultcode !== '00') {
      throw new Error(
        `네이버 프로필 조회 실패: ${data.message || '알 수 없는 오류'}`
      );
    }

    // 3. 프로필 데이터 반환
    const profile = data.response;
    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      nickname: profile.nickname,
      profile_image: profile.profile_image || null,
      age: profile.age || null,
      gender: profile.gender || null,
      birthday: profile.birthday || null,
      birthyear: profile.birthyear || null,
    };
  } catch (error) {
    console.error('네이버 프로필 조회 에러:', error);
    throw new Error(
      `네이버 프로필 조회 실패: ${
        error instanceof Error ? error.message : '알 수 없는 오류'
      }`
    );
  }
}

// ============================================
// 토큰 갱신
// ============================================

/**
 * 리프레시 토큰을 사용하여 새로운 액세스 토큰을 발급받습니다.
 *
 * @param refreshToken - 네이버 리프레시 토큰
 * @returns 새로운 액세스 토큰
 *
 * @throws {Error} API 호출 실패 시
 */
export async function refreshNaverAccessToken(
  refreshToken: string
): Promise<NaverTokenResponse> {
  const { clientId, clientSecret } = getNaverConfig();

  try {
    // 1. 네이버 토큰 갱신 엔드포인트 호출
    const params = new URLSearchParams({
      grant_type: 'refresh_token', // 권한 부여 타입
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken, // 리프레시 토큰
    });

    const response = await fetch(
      `https://nid.naver.com/oauth2.0/token?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // 2. 응답 처리
    const data = await response.json();

    // 에러 체크
    if (!response.ok || data.error) {
      throw new Error(
        `토큰 갱신 실패: ${data.error_description || data.error}`
      );
    }

    // 3. 새 토큰 반환
    return {
      access_token: data.access_token,
      refresh_token: refreshToken, // 리프레시 토큰은 그대로 유지
      token_type: data.token_type,
      expires_in: data.expires_in,
    };
  } catch (error) {
    console.error('네이버 토큰 갱신 에러:', error);
    throw new Error(
      `토큰 갱신 실패: ${
        error instanceof Error ? error.message : '알 수 없는 오류'
      }`
    );
  }
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * CSRF 방지를 위한 랜덤 state 문자열을 생성합니다.
 *
 * @returns 랜덤 state 문자열
 */
export function generateState(): string {
  // 랜덤 바이트 생성 후 base64 인코딩
  return Buffer.from(
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * 네이버 블로그 ID를 추출합니다.
 *
 * @param blogUrl - 네이버 블로그 URL (예: https://blog.naver.com/myblog)
 * @returns 블로그 ID (예: myblog)
 *
 * @throws {Error} 유효하지 않은 URL인 경우
 */
export function extractNaverBlogId(blogUrl: string): string {
  try {
    const url = new URL(blogUrl);

    // blog.naver.com/blogid 형식
    if (url.hostname === 'blog.naver.com') {
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        return pathParts[0];
      }
    }

    throw new Error('유효하지 않은 네이버 블로그 URL입니다.');
  } catch (error) {
    throw new Error(
      `블로그 ID 추출 실패: ${
        error instanceof Error ? error.message : '알 수 없는 오류'
      }`
    );
  }
}
