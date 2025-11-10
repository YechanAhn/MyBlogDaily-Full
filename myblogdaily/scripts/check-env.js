#!/usr/bin/env node

/**
 * 환경 변수 검증 CLI 스크립트
 *
 * 사용법: npm run check-env
 */

const fs = require('fs');
const path = require('path');

// ANSI 색상 코드
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// .env.local 파일 경로
const envPath = path.join(__dirname, '..', '.env.local');
const envExamplePath = path.join(__dirname, '..', '.env.local.example');

// .env.local 파일 존재 확인
if (!fs.existsSync(envPath)) {
  log('\n❌ .env.local 파일이 없습니다!\n', 'red');
  log('💡 해결 방법:', 'cyan');
  log('  1. 터미널에서 다음 명령어 실행:', 'reset');
  log('     cp .env.local.example .env.local\n', 'yellow');
  log('  2. .env.local 파일을 열고 실제 API 키로 교체:', 'reset');
  log('     code .env.local\n', 'yellow');
  process.exit(1);
}

// .env.local 파일 읽기
const envContent = fs.readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');

// 환경 변수 파싱
const envVars = {};
envLines.forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').trim();
    envVars[key.trim()] = value;
  }
});

// 필수 환경 변수 목록
const requiredEnvVars = [
  { key: 'NEXT_PUBLIC_SITE_URL', pattern: /^https?:\/\/.+/, example: 'http://localhost:3000' },
  { key: 'NAVER_CLIENT_ID', pattern: /.+/, example: 'your_naver_client_id' },
  { key: 'NAVER_CLIENT_SECRET', pattern: /.+/, example: 'your_naver_client_secret' },
  { key: 'NEXT_PUBLIC_SUPABASE_URL', pattern: /^https:\/\/.+\.supabase\.co$/, example: 'https://xxx.supabase.co' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', pattern: /^eyJ.+/, example: 'eyJhbGci...' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', pattern: /^eyJ.+/, example: 'eyJhbGci...' },
  { key: 'ANTHROPIC_API_KEY', pattern: /^sk-ant-.+/, example: 'sk-ant-xxx' },
  { key: 'OPENAI_API_KEY', pattern: /^sk-.+/, example: 'sk-xxx' },
  { key: 'RESEND_API_KEY', pattern: /^re_.+/, example: 're_xxx' },
  { key: 'UPSTASH_REDIS_REST_URL', pattern: /^https:\/\/.+\.upstash\.io$/, example: 'https://xxx.upstash.io' },
  { key: 'UPSTASH_REDIS_REST_TOKEN', pattern: /.+/, example: 'your_redis_token' },
  { key: 'AUTH_SECRET', pattern: /.{32,}/, example: '32자 이상의 랜덤 문자열' }
];

// 검증 시작
log('\n🔍 환경 변수 검증 중...\n', 'cyan');

let hasError = false;
const missing = [];
const invalid = [];
const valid = [];

requiredEnvVars.forEach(({ key, pattern, example }) => {
  const value = envVars[key];

  // 존재 여부 확인
  if (!value) {
    missing.push({ key, example });
    hasError = true;
    return;
  }

  // 기본값인지 확인 (교체되지 않음)
  if (value.includes('your_') || value.includes('here')) {
    invalid.push({ key, reason: '기본값이 그대로 남아있음', example });
    hasError = true;
    return;
  }

  // 형식 검증
  if (pattern && !pattern.test(value)) {
    invalid.push({ key, reason: '형식이 올바르지 않음', example });
    hasError = true;
    return;
  }

  valid.push(key);
});

// 결과 출력
if (missing.length > 0) {
  log('🔴 누락된 환경 변수:', 'red');
  missing.forEach(({ key, example }) => {
    log(`  ❌ ${key}`, 'red');
    log(`     예시: ${example}`, 'yellow');
  });
  log('', 'reset');
}

if (invalid.length > 0) {
  log('🔴 형식이 올바르지 않은 환경 변수:', 'red');
  invalid.forEach(({ key, reason, example }) => {
    log(`  ❌ ${key} - ${reason}`, 'red');
    log(`     예시: ${example}`, 'yellow');
  });
  log('', 'reset');
}

if (valid.length > 0) {
  log('✅ 정상 환경 변수:', 'green');
  valid.forEach(key => {
    log(`  ✓ ${key}`, 'green');
  });
  log('', 'reset');
}

// 최종 결과
if (hasError) {
  log('❌ 환경 변수 검증 실패!', 'red');
  log('\n💡 해결 방법:', 'cyan');
  log('  1. .env.local 파일 열기:', 'reset');
  log('     code .env.local\n', 'yellow');
  log('  2. 누락되거나 잘못된 변수를 실제 API 키로 교체', 'reset');
  log('  3. 다시 검증:', 'reset');
  log('     npm run check-env\n', 'yellow');
  process.exit(1);
} else {
  log('✅ 모든 환경 변수가 정상입니다!', 'green');
  log('🚀 이제 개발 서버를 실행할 수 있습니다:', 'cyan');
  log('   npm run dev\n', 'yellow');
  process.exit(0);
}
