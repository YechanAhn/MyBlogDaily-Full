/**
 * 환경 변수 검증 유틸리티
 *
 * 용도:
 * - 필수 환경 변수 존재 여부 확인
 * - 환경 변수 형식 검증
 * - 개발/프로덕션 환경 구분
 */

interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  invalid: string[];
  warnings: string[];
}

/**
 * 필수 환경 변수 목록
 */
const REQUIRED_ENV_VARS = {
  // 사이트 설정
  NEXT_PUBLIC_SITE_URL: {
    required: true,
    format: /^https?:\/\/.+/,
    description: '사이트 URL (예: http://localhost:3000)'
  },

  // 네이버 API
  NAVER_CLIENT_ID: {
    required: true,
    format: /.+/,
    description: '네이버 Client ID'
  },
  NAVER_CLIENT_SECRET: {
    required: true,
    format: /.+/,
    description: '네이버 Client Secret'
  },

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: {
    required: true,
    format: /^https:\/\/.+\.supabase\.co$/,
    description: 'Supabase 프로젝트 URL'
  },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    required: true,
    format: /^eyJ.+/,
    description: 'Supabase Anon Key (JWT 형식)'
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    required: true,
    format: /^eyJ.+/,
    description: 'Supabase Service Role Key (JWT 형식)'
  },

  // Claude API
  ANTHROPIC_API_KEY: {
    required: true,
    format: /^sk-ant-.+/,
    description: 'Claude API Key (sk-ant-로 시작)'
  },

  // OpenAI API
  OPENAI_API_KEY: {
    required: true,
    format: /^sk-.+/,
    description: 'OpenAI API Key (sk-로 시작)'
  },

  // Resend
  RESEND_API_KEY: {
    required: true,
    format: /^re_.+/,
    description: 'Resend API Key (re_로 시작)'
  },
  RESEND_FROM_EMAIL: {
    required: true,
    format: /.+@.+/,
    description: '이메일 발송 주소 (예: noreply@yourdomain.com)'
  },

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: {
    required: true,
    format: /^https:\/\/.+\.upstash\.io$/,
    description: 'Upstash Redis REST URL'
  },
  UPSTASH_REDIS_REST_TOKEN: {
    required: true,
    format: /.+/,
    description: 'Upstash Redis REST Token'
  },

  // 보안
  AUTH_SECRET: {
    required: true,
    format: /.{32,}/,
    description: 'Auth Secret (32자 이상)'
  }
} as const;

/**
 * 선택 환경 변수 목록
 */
const OPTIONAL_ENV_VARS = {
  YOUTUBE_API_KEY: {
    required: false,
    format: /.+/,
    description: 'YouTube Data API Key (큐레이션 향상)'
  },

  // Redis (UPSTASH_REDIS_URL 또는 분리된 호스트/포트/비밀번호 사용)
  UPSTASH_REDIS_URL: {
    required: false,
    format: /^rediss?:\/\/.+/,
    description: 'Upstash Redis RESP URL (rediss://default:password@host:port)'
  },
  UPSTASH_REDIS_HOST: {
    required: false,
    format: /.+/,
    description: 'Upstash Redis 호스트 (URL 대신 사용 가능)'
  },
  UPSTASH_REDIS_PORT: {
    required: false,
    format: /^\d+$/,
    description: 'Upstash Redis 포트 (기본: 6379)'
  },

  LOG_LEVEL: {
    required: false,
    format: /^(debug|info|warn|error)$/,
    description: '로그 레벨 (debug, info, warn, error)'
  },
  NODE_ENV: {
    required: false,
    format: /^(development|production|test)$/,
    description: '실행 환경 (development, production, test)'
  }
} as const;

/**
 * 환경 변수 검증
 * @returns 검증 결과 객체
 */
export function validateEnv(): EnvValidationResult {
  const result: EnvValidationResult = {
    valid: true,
    missing: [],
    invalid: [],
    warnings: []
  };

  // 필수 환경 변수 검증
  for (const [key, config] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = process.env[key];

    // 존재 여부 확인
    if (!value) {
      result.valid = false;
      result.missing.push(`${key} - ${config.description}`);
      continue;
    }

    // 형식 검증
    if (config.format && !config.format.test(value)) {
      result.valid = false;
      result.invalid.push(`${key} - 형식이 올바르지 않음 (${config.description})`);
    }
  }

  // 선택 환경 변수 경고
  for (const [key, config] of Object.entries(OPTIONAL_ENV_VARS)) {
    const value = process.env[key];

    if (!value) {
      result.warnings.push(`${key} - 설정되지 않음 (${config.description})`);
      continue;
    }

    // 형식 검증
    if (config.format && !config.format.test(value)) {
      result.warnings.push(`${key} - 형식이 올바르지 않음 (${config.description})`);
    }
  }

  return result;
}

/**
 * 환경 변수 검증 및 에러 출력
 * 프로덕션 환경에서는 프로세스 종료
 */
export function validateEnvOrThrow(): void {
  const result = validateEnv();

  if (!result.valid) {
    console.error('\n❌ 환경 변수 검증 실패!\n');

    if (result.missing.length > 0) {
      console.error('🔴 누락된 필수 환경 변수:');
      result.missing.forEach(msg => console.error(`  - ${msg}`));
      console.error('');
    }

    if (result.invalid.length > 0) {
      console.error('🔴 형식이 올바르지 않은 환경 변수:');
      result.invalid.forEach(msg => console.error(`  - ${msg}`));
      console.error('');
    }

    console.error('💡 해결 방법:');
    console.error('  1. .env.local.example 파일을 .env.local로 복사');
    console.error('  2. 각 API 키를 발급받아 실제 값으로 교체');
    console.error('  3. 서버 재시작\n');

    // 프로덕션 환경에서는 프로세스 종료
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }

    throw new Error('환경 변수 검증 실패');
  }

  // 경고 출력 (에러는 아님)
  if (result.warnings.length > 0) {
    console.warn('\n⚠️  선택 환경 변수 경고:');
    result.warnings.forEach(msg => console.warn(`  - ${msg}`));
    console.warn('  → 기능이 제한될 수 있지만 서비스는 정상 동작합니다.\n');
  }

  console.log('✅ 환경 변수 검증 완료!\n');
}

/**
 * 특정 환경 변수 존재 확인
 */
export function hasEnv(key: string): boolean {
  return !!process.env[key];
}

/**
 * 안전하게 환경 변수 가져오기
 * @param key 환경 변수 키
 * @param fallback 기본값
 */
export function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];

  if (!value && fallback === undefined) {
    throw new Error(`환경 변수 ${key}가 설정되지 않았습니다.`);
  }

  return value || fallback!;
}

/**
 * 숫자형 환경 변수 가져오기
 */
export function getEnvNumber(key: string, fallback?: number): number {
  const value = process.env[key];

  if (!value) {
    if (fallback === undefined) {
      throw new Error(`환경 변수 ${key}가 설정되지 않았습니다.`);
    }
    return fallback;
  }

  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`환경 변수 ${key}는 숫자여야 합니다. (현재 값: ${value})`);
  }

  return num;
}

/**
 * Boolean형 환경 변수 가져오기
 */
export function getEnvBoolean(key: string, fallback?: boolean): boolean {
  const value = process.env[key];

  if (!value) {
    if (fallback === undefined) {
      throw new Error(`환경 변수 ${key}가 설정되지 않았습니다.`);
    }
    return fallback;
  }

  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * 현재 환경 확인
 */
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test';
