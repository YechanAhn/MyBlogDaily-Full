/**
 * 에러 핸들링 유틸리티
 *
 * 용도:
 * - 일관된 에러 응답 형식
 * - 에러 로깅
 * - 사용자 친화적 에러 메시지 변환
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * 표준 에러 응답 형식
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

/**
 * 표준 성공 응답 형식
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * HTTP 상태 코드별 에러 코드 매핑
 */
const HTTP_ERROR_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMIT_EXCEEDED',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE'
} as const;

/**
 * 에러 클래스
 */
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * 에러를 표준 응답으로 변환
 */
export function createErrorResponse(
  error: unknown,
  statusCode: number = 500
): NextResponse<ErrorResponse> {
  // AppError인 경우
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        },
        timestamp: new Date().toISOString()
      },
      { status: error.statusCode }
    );
  }

  // 일반 Error인 경우
  if (error instanceof Error) {
    const code = HTTP_ERROR_CODES[statusCode as keyof typeof HTTP_ERROR_CODES] || 'INTERNAL_SERVER_ERROR';

    return NextResponse.json(
      {
        success: false,
        error: {
          code,
          message: error.message || '알 수 없는 오류가 발생했습니다.',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );
  }

  // 알 수 없는 에러인 경우
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '알 수 없는 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      timestamp: new Date().toISOString()
    },
    { status: statusCode }
  );
}

/**
 * 성공 응답 생성
 */
export function createSuccessResponse<T>(
  data: T,
  statusCode: number = 200
): NextResponse<SuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString()
    },
    { status: statusCode }
  );
}

/**
 * 에러 로깅
 */
export function logError(error: unknown, context?: string): void {
  const timestamp = new Date().toISOString();
  const prefix = context ? `[${context}]` : '';

  if (error instanceof AppError) {
    console.error(`${timestamp} ${prefix} [${error.code}] ${error.message}`);
    if (error.details) {
      console.error('Details:', error.details);
    }
  } else if (error instanceof Error) {
    console.error(`${timestamp} ${prefix} ${error.message}`);
    if (process.env.NODE_ENV === 'development' && error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(`${timestamp} ${prefix} 알 수 없는 에러:`, error);
  }
}

/**
 * 비동기 함수를 안전하게 래핑
 */
export function asyncHandler<T>(
  fn: (req: NextRequest, context?: unknown) => Promise<NextResponse<T>>
) {
  return async (req: NextRequest, context?: unknown): Promise<NextResponse<T | ErrorResponse>> => {
    try {
      return await fn(req, context);
    } catch (error) {
      logError(error, 'API');
      return createErrorResponse(error);
    }
  };
}

/**
 * 사전 정의된 에러들
 */
export const Errors = {
  // 인증 관련
  UNAUTHORIZED: (message = '인증이 필요합니다.') =>
    new AppError('UNAUTHORIZED', message, 401),

  FORBIDDEN: (message = '권한이 없습니다.') =>
    new AppError('FORBIDDEN', message, 403),

  INVALID_TOKEN: (message = '유효하지 않은 토큰입니다.') =>
    new AppError('INVALID_TOKEN', message, 401),

  // 요청 관련
  BAD_REQUEST: (message = '잘못된 요청입니다.') =>
    new AppError('BAD_REQUEST', message, 400),

  VALIDATION_ERROR: (message: string, details?: unknown) =>
    new AppError('VALIDATION_ERROR', message, 422, details),

  NOT_FOUND: (resource = '리소스') =>
    new AppError('NOT_FOUND', `${resource}를 찾을 수 없습니다.`, 404),

  CONFLICT: (message = '이미 존재하는 리소스입니다.') =>
    new AppError('CONFLICT', message, 409),

  // 외부 서비스 관련
  EXTERNAL_API_ERROR: (service: string, message?: string) =>
    new AppError(
      'EXTERNAL_API_ERROR',
      message || `${service} API 호출에 실패했습니다.`,
      502
    ),

  RATE_LIMIT: (message = '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.') =>
    new AppError('RATE_LIMIT_EXCEEDED', message, 429),

  // 데이터베이스 관련
  DATABASE_ERROR: (message = '데이터베이스 오류가 발생했습니다.') =>
    new AppError('DATABASE_ERROR', message, 500),

  // 크롤링 관련
  CRAWLING_BLOCKED: (message = '차단 감지: 잠시 후 다시 시도합니다.') =>
    new AppError('CRAWLING_BLOCKED', message, 503),

  CRAWLING_FAILED: (url: string, reason?: string) =>
    new AppError(
      'CRAWLING_FAILED',
      `크롤링 실패: ${url}`,
      500,
      { url, reason }
    ),

  // AI 관련
  AI_GENERATION_FAILED: (message = 'AI 콘텐츠 생성에 실패했습니다.') =>
    new AppError('AI_GENERATION_FAILED', message, 500),

  TOKEN_LIMIT_EXCEEDED: (message = 'AI 토큰 한도를 초과했습니다.') =>
    new AppError('TOKEN_LIMIT_EXCEEDED', message, 429)
};

/**
 * Supabase 에러를 AppError로 변환
 */
export function handleSupabaseError(error: any): never {
  const message = error?.message || '데이터베이스 오류가 발생했습니다.';

  // 특정 Supabase 에러 코드 처리
  if (error?.code === 'PGRST116') {
    throw Errors.NOT_FOUND('데이터');
  }

  if (error?.code === '23505') {
    throw Errors.CONFLICT('이미 존재하는 데이터입니다.');
  }

  throw Errors.DATABASE_ERROR(message);
}

/**
 * API 응답 헬퍼
 */
export const ApiResponse = {
  /**
   * 200 OK
   */
  ok: <T>(data: T) => createSuccessResponse(data, 200),

  /**
   * 201 Created
   */
  created: <T>(data: T) => createSuccessResponse(data, 201),

  /**
   * 204 No Content
   */
  noContent: () => new NextResponse(null, { status: 204 }),

  /**
   * 400 Bad Request
   */
  badRequest: (message: string) => createErrorResponse(Errors.BAD_REQUEST(message), 400),

  /**
   * 401 Unauthorized
   */
  unauthorized: (message?: string) => createErrorResponse(Errors.UNAUTHORIZED(message), 401),

  /**
   * 403 Forbidden
   */
  forbidden: (message?: string) => createErrorResponse(Errors.FORBIDDEN(message), 403),

  /**
   * 404 Not Found
   */
  notFound: (resource?: string) => createErrorResponse(Errors.NOT_FOUND(resource), 404),

  /**
   * 500 Internal Server Error
   */
  serverError: (error: unknown) => createErrorResponse(error, 500)
};
