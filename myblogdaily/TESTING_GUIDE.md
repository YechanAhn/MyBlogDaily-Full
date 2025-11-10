# 🧪 테스트 가이드

MyBlogDaily 프로젝트의 기능을 테스트하는 방법입니다.

---

## ✅ 사전 준비

### 1. 환경 변수 설정

먼저 `.env.local` 파일을 생성하고 API 키를 설정합니다:

```bash
# .env.local.example 복사
cp .env.local.example .env.local

# 실제 API 키로 교체
# code .env.local  # VS Code
# vim .env.local   # vim
```

**필수 API 키:**
- `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` - Naver 로그인, 검색
- `ANTHROPIC_API_KEY` - Claude AI
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` - 이메일 발송
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` - Redis 큐

### 2. 환경 변수 검증

```bash
npm run check-env
```

모든 필수 환경 변수가 설정되어 있는지 확인합니다.

---

## 🚀 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속

---

## 📋 API 엔드포인트 테스트

### 1. 포스트 수집 (POST /api/collect-posts)

먼저 Supabase에서 사용자를 생성하고 userId를 얻어야 합니다.

```bash
# 예시 (실제 userId로 교체)
USER_ID="your-user-id-here"
BLOG_ID="your-naver-blog-id"

curl -X POST http://localhost:3000/api/collect-posts \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"blogId\": \"$BLOG_ID\",
    \"limit\": 10
  }"
```

**예상 응답:**
```json
{
  "success": true,
  "collected": 10,
  "failed": 0,
  "skipped": 0,
  "duration": 45000,
  "posts": [...]
}
```

---

### 2. 문체 분석 (POST /api/analyze-dna)

포스트 수집 후 실행:

```bash
curl -X POST http://localhost:3000/api/analyze-dna \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\"
  }"
```

**예상 응답:**
```json
{
  "success": true,
  "creativeDNA": {
    "metadata": {
      "analysis_date": "2025-11-10T...",
      "analyzed_post_count": 10
    },
    "persona_profile": {
      "archetype": "전문가 멘토",
      "tone_descriptors": ["정보 제공적", "친근한"],
      "expertise_level": "전문가"
    },
    ...
  },
  "isNew": true
}
```

---

### 3. 큐레이션 + 초안 작성 (POST /api/curate)

문체 분석 후 실행:

```bash
curl -X POST http://localhost:3000/api/curate \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"curationOptions\": {
      \"maxItems\": 5
    },
    \"draftOptions\": {
      \"numDrafts\": 2
    }
  }"
```

**예상 응답:**
```json
{
  "success": true,
  "curated": {
    "items": [ /* 5개 아이템 */ ],
    "count": 5,
    "keywords": ["React", "TypeScript", ...]
  },
  "drafts": [
    {
      "title": "...",
      "content": "...",
      "summary": "...",
      "tags": [...],
      "estimatedReadTime": 5
    }
  ]
}
```

---

### 4. 뉴스레터 즉시 발송 (POST /api/send-newsletter)

```bash
curl -X POST http://localhost:3000/api/send-newsletter \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"action\": \"send-now\"
  }"
```

**예상 응답:**
```json
{
  "success": true,
  "action": "send-now",
  "jobId": "12345",
  "message": "뉴스레터 발송 작업이 큐에 추가되었습니다. 곧 발송됩니다."
}
```

---

### 5. 매일 반복 작업 설정

```bash
# 매일 아침 7시 자동 발송 설정
curl -X POST http://localhost:3000/api/send-newsletter \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"action\": \"schedule-daily\",
    \"cronTime\": \"0 7 * * *\"
  }"
```

**Cron 표현식 예시:**
- `0 7 * * *` - 매일 아침 7시
- `0 22 * * *` - 매일 밤 10시 (UTC 기준)
- `0 9 * * 1` - 매주 월요일 아침 9시

---

### 6. 큐 통계 조회 (GET /api/send-newsletter)

```bash
curl http://localhost:3000/api/send-newsletter
```

**예상 응답:**
```json
{
  "success": true,
  "stats": {
    "waiting": 0,
    "active": 1,
    "completed": 5,
    "failed": 0,
    "delayed": 0
  },
  "repeatableJobs": [
    {
      "key": "daily-user-id",
      "name": "send-newsletter-daily",
      "pattern": "0 7 * * *",
      "next": 1699603200000
    }
  ]
}
```

---

## 🔧 문제 해결

### 1. "환경 변수가 설정되지 않았습니다"

```bash
# 환경 변수 확인
npm run check-env

# .env.local 파일이 있는지 확인
ls -la .env.local

# 없으면 생성
cp .env.local.example .env.local
```

---

### 2. "사용자를 찾을 수 없음"

Supabase 대시보드에서 `users` 테이블에 사용자를 먼저 생성해야 합니다.

```sql
-- Supabase SQL Editor에서 실행
INSERT INTO users (id, email, name)
VALUES (
  gen_random_uuid(),
  'test@example.com',
  '테스트 사용자'
)
RETURNING id;
```

반환된 `id`를 복사해서 API 호출 시 사용합니다.

---

### 3. "최소 10개 이상의 포스트가 필요합니다"

```bash
# 포스트를 더 수집
curl -X POST http://localhost:3000/api/collect-posts \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"blogId\": \"$BLOG_ID\",
    \"limit\": 50
  }"
```

---

### 4. "Claude API 요청 한도 초과"

Anthropic 대시보드에서 API 사용량 확인:
- https://console.anthropic.com/

잠시 대기 후 재시도하거나 플랜 업그레이드가 필요할 수 있습니다.

---

### 5. Worker가 작동하지 않음

Next.js는 서버리스이므로 BullMQ Worker를 별도로 실행해야 합니다.

**방법 1: 별도 프로세스**
```typescript
// worker.ts 파일 생성
import { startNewsletterWorker } from './lib/scheduler';
startNewsletterWorker();

// 실행
ts-node worker.ts
```

**방법 2: API 엔드포인트로 실행**
```typescript
// app/api/worker/route.ts
import { startNewsletterWorker } from '@/lib/scheduler';

export async function GET() {
  startNewsletterWorker();
  return Response.json({ status: 'Worker started' });
}
```

```bash
# 서버 시작 후 한 번만 호출
curl http://localhost:3000/api/worker
```

---

## 📊 전체 플로우 테스트

### 새 사용자 등록부터 뉴스레터 발송까지

```bash
# 1. 사용자 생성 (Supabase)
# SQL Editor에서 실행하고 USER_ID 얻기

# 2. 환경 변수 설정
USER_ID="your-user-id"
BLOG_ID="your-blog-id"

# 3. 포스트 수집
curl -X POST http://localhost:3000/api/collect-posts \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"blogId\": \"$BLOG_ID\", \"limit\": 20}"

# 4. 문체 분석
curl -X POST http://localhost:3000/api/analyze-dna \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\"}"

# 5. 큐레이션 + 초안 작성
curl -X POST http://localhost:3000/api/curate \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\"}"

# 6. 즉시 발송
curl -X POST http://localhost:3000/api/send-newsletter \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"action\": \"send-now\"}"

# 7. 매일 자동 발송 설정
curl -X POST http://localhost:3000/api/send-newsletter \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"action\": \"schedule-daily\"}"
```

---

## ⏱️ 예상 소요 시간

- **포스트 수집 (20개)**: 30-60초
- **문체 분석**: 20-40초
- **큐레이션 + 초안**: 25-50초
- **이메일 발송**: 1-3초
- **총 소요 시간**: 약 1.5-2.5분

---

## 📚 관련 문서

- [CURATION_GUIDE.md](./CURATION_GUIDE.md) - 큐레이션 시스템
- [WRITING_DNA_GUIDE.md](./WRITING_DNA_GUIDE.md) - 문체 분석
- [CRAWLING_GUIDE.md](./CRAWLING_GUIDE.md) - 포스트 수집

---

## 💡 팁

### TypeScript 타입 체크

```bash
npx tsc --noEmit
```

### Supabase 로컬 개발

```bash
# Supabase CLI 설치
npm install -g supabase

# 로컬 Supabase 시작
supabase start

# 마이그레이션 적용
supabase db push
```

### 로그 확인

서버 콘솔에서 컬러로 표시되는 로그를 확인할 수 있습니다:
- 🔵 INFO
- ✅ SUCCESS
- ⚠️  WARN
- ❌ ERROR

---

**✅ 테스트 완료!**

모든 API가 정상적으로 작동하면 Phase 1이 완료된 것입니다! 🎉
