# 🏗️ 인프라 설정 완료 가이드

> Option C: 인프라 정리 작업 완료

---

## ✅ 완료된 작업

### 1. 환경 변수 관리 시스템

#### 📄 `.env.local.example` - 환경 변수 템플릿
- 위치: `/myblogdaily/.env.local.example`
- 내용: 모든 필수/선택 환경 변수 목록 및 설명
- 사용법:
  ```bash
  cp .env.local.example .env.local
  # .env.local 파일을 열어 실제 API 키로 교체
  ```

#### 🔧 `lib/utils/env-validator.ts` - 환경 변수 검증
- 기능:
  - ✅ 필수 환경 변수 존재 여부 확인
  - ✅ 형식 검증 (URL, API 키 패턴)
  - ✅ 안전한 환경 변수 접근 함수
  - ✅ 개발/프로덕션 환경 구분
- 사용 예시:
  ```typescript
  import { validateEnvOrThrow, getEnv } from '@/lib/utils';

  // 앱 시작 시 환경 변수 검증
  validateEnvOrThrow();

  // 안전하게 환경 변수 가져오기
  const apiKey = getEnv('ANTHROPIC_API_KEY');
  ```

#### 🛠️ `scripts/check-env.js` - CLI 검증 스크립트
- 사용법:
  ```bash
  npm run check-env
  ```
- 기능:
  - ✅ .env.local 파일 존재 확인
  - ✅ 누락/잘못된 환경 변수 표시
  - ✅ 색상 코딩된 친절한 에러 메시지

---

### 2. Supabase 데이터베이스 스키마

#### 📊 `supabase/migrations/20241110000000_initial_schema.sql`
- 생성된 테이블:
  1. **users** - 사용자 정보
  2. **blog_posts** - 블로그 포스트
  3. **writing_dna** - 문체 분석 결과
  4. **curated_items** - 큐레이션 콘텐츠
  5. **newsletters** - 발송 이력

- 추가 기능:
  - ✅ 함수: `get_user_stats()` - 사용자 통계 조회
  - ✅ 트리거: `writing_dna` 자동 타임스탬프 업데이트
  - ✅ RLS (Row Level Security) - 모든 테이블에 활성화

#### 📝 Supabase 스키마 적용 방법

**방법 1: SQL Editor 사용 (추천)**
1. Supabase 대시보드 → "SQL Editor" 클릭
2. "New query" 클릭
3. `supabase/migrations/20241110000000_initial_schema.sql` 파일 내용 복사
4. 붙여넣기 후 "Run" (⌘ + Enter)
5. "Success" 메시지 확인

**방법 2: Supabase CLI 사용**
```bash
# Supabase CLI 설치
npm install -g supabase

# 프로젝트 연결
supabase link --project-ref your-project-id

# 마이그레이션 적용
supabase db push
```

---

### 3. 에러 핸들링 시스템

#### 🚨 `lib/utils/error-handler.ts`
- 기능:
  - ✅ 표준 에러 응답 형식 (`ErrorResponse`, `SuccessResponse`)
  - ✅ 커스텀 에러 클래스 (`AppError`)
  - ✅ 사전 정의된 에러들 (`Errors`)
  - ✅ API 응답 헬퍼 (`ApiResponse`)
  - ✅ 비동기 함수 래퍼 (`asyncHandler`)

- 사용 예시:
  ```typescript
  import { asyncHandler, Errors, ApiResponse } from '@/lib/utils';

  // API 라우트에서 사용
  export const POST = asyncHandler(async (req: Request) => {
    const body = await req.json();

    if (!body.userId) {
      throw Errors.BAD_REQUEST('userId가 필요합니다.');
    }

    // 성공 응답
    return ApiResponse.ok({ message: '성공!' });
  });
  ```

---

### 4. 로깅 시스템

#### 📝 `lib/utils/logger.ts`
- 기능:
  - ✅ 4가지 로그 레벨 (DEBUG, INFO, WARN, ERROR)
  - ✅ 타임스탬프 자동 추가
  - ✅ 컨텍스트 기반 로깅
  - ✅ 색상 코딩 (터미널)
  - ✅ 성능 측정 (`time()`, `timeEnd()`)

- 사용 예시:
  ```typescript
  import { logger, apiLogger, crawlerLogger } from '@/lib/utils';

  // 기본 로거
  logger.info('서버 시작');
  logger.error('에러 발생', error);

  // 컨텍스트별 로거
  apiLogger.info('API 호출 시작', { userId: 'xxx' });
  crawlerLogger.warn('차단 감지');

  // 성능 측정
  logger.time('데이터 처리');
  // ... 작업 ...
  logger.timeEnd('데이터 처리');
  ```

---

### 5. 유틸리티 통합 Export

#### 📦 `lib/utils/index.ts`
모든 유틸리티를 한 곳에서 import:
```typescript
import {
  // 환경 변수
  validateEnvOrThrow,
  getEnv,

  // 에러 핸들링
  AppError,
  Errors,
  ApiResponse,

  // 로깅
  logger,
  apiLogger,
  crawlerLogger
} from '@/lib/utils';
```

---

## 📁 최종 프로젝트 구조

```
myblogdaily/
├── .env.local.example      ✅ 환경 변수 템플릿
├── .gitignore              ✅ 업데이트됨
├── package.json            ✅ check-env 스크립트 추가
├── scripts/
│   └── check-env.js        ✅ CLI 검증 스크립트
├── supabase/
│   └── migrations/
│       └── 20241110000000_initial_schema.sql  ✅ DB 스키마
└── lib/
    └── utils/
        ├── env-validator.ts    ✅ 환경 변수 검증
        ├── error-handler.ts    ✅ 에러 핸들링
        ├── logger.ts           ✅ 로깅 시스템
        └── index.ts            ✅ 통합 export
```

---

## 🚀 다음 단계

### 사용자가 해야 할 일

1. **Supabase 프로젝트 생성**
   - https://supabase.com 접속
   - "New Project" 클릭
   - Region: Northeast Asia (Seoul) 선택

2. **환경 변수 설정**
   ```bash
   cd myblogdaily
   cp .env.local.example .env.local
   code .env.local  # 실제 API 키로 교체
   ```

3. **환경 변수 검증**
   ```bash
   npm run check-env
   ```

4. **Supabase 스키마 적용**
   - Supabase 대시보드 → SQL Editor
   - `supabase/migrations/20241110000000_initial_schema.sql` 내용 실행

5. **개발 서버 실행**
   ```bash
   npm run dev
   ```

---

### 다음 개발 작업 (Phase 1 Week 2)

**이제 API 키 없이는 더 이상 진행할 수 없습니다.**

사용자가 API 키를 설정하면:

1. **RSS 파서 구현** (2-3시간)
   - `lib/crawler/rss-parser.ts`
   - 네이버 블로그 RSS 피드 파싱

2. **Playwright 크롤러 구현** (1일)
   - `lib/crawler/playwright-crawler.ts`
   - 모바일 우선 크롤링
   - 차단 회피 로직

3. **블로그 포스트 수집 API** (4-6시간)
   - `app/api/collect-posts/route.ts`
   - 50개 포스트 수집 및 DB 저장

---

## 💡 유용한 명령어

```bash
# 환경 변수 검증
npm run check-env

# TypeScript 타입 체크
npm run type-check

# ESLint 검사
npm run lint

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
```

---

## 📚 참고 문서

- [환경 변수 설정 가이드](../GETTING_STARTED.md)
- [Supabase 스키마 가이드](./supabase/migrations/20241110000000_initial_schema.sql)
- [에러 핸들링 예제](./lib/utils/error-handler.ts)
- [로깅 시스템 사용법](./lib/utils/logger.ts)

---

**✅ 인프라 설정 완료!**
이제 API 키만 설정하면 본격적인 기능 개발을 시작할 수 있습니다. 🚀
