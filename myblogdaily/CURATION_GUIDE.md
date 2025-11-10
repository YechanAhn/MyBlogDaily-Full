# 📰 큐레이션 + 초안 작성 가이드

> Phase 1 Week 4 완료: 콘텐츠 큐레이션 + Claude 초안 작성 + 이메일 발송 + 스케줄링

---

## ✅ 구현 완료

### 1. Naver Search API 클라이언트 (`lib/curation/naver-search.ts`)
Naver 검색 API를 사용하여 블로그와 뉴스를 검색합니다.

**기능:**
- ✅ 블로그 검색 (`searchBlog`)
- ✅ 뉴스 검색 (`searchNews`)
- ✅ 다중 키워드 병렬 검색 (`searchMultipleKeywords`)
- ✅ HTML 태그 제거 유틸리티
- ✅ 정렬 옵션 (정확도/날짜)

**사용 예시:**
```typescript
import { naverSearchAPI } from '@/lib/curation';

// 단일 검색
const result = await naverSearchAPI.searchBlog({
  query: 'Next.js',
  display: 10,
  sort: 'date'
});

// 다중 키워드 검색
const keywords = ['React', 'TypeScript', 'Tailwind'];
const results = await naverSearchAPI.searchMultipleKeywords('blog', keywords, 5);
```

---

### 2. 큐레이터 (`lib/curation/curator.ts`)
creativeDNA 기반으로 콘텐츠를 큐레이션합니다.

**분석 전략:**

#### 1) NEWS_DRIVEN
- **대상**: 부동산, 주식, IT 트렌드 등
- **정렬**: 날짜순 (최신 정보 우선)
- **뉴스 우대**: +5점

#### 2) EVERGREEN_IDEAS
- **대상**: 요리, 육아, 자기계발 등
- **정렬**: 정확도순 (관련성 우선)
- **블로그 우대**: +5점

**점수 계산:**
- 기본 점수: 50점
- 제목에 키워드 포함: +20점
- 요약에 키워드 포함: +10점
- 최근 7일 이내: +15점
- 최근 30일 이내: +5점
- 콘텐츠 타입 우대: +5점

**사용 예시:**
```typescript
import { curator } from '@/lib/curation';
import type { CreativeDNA } from '@/lib/ai/types';

const creativeDNA: CreativeDNA = { /* ... */ };

const result = await curator.curateContent(creativeDNA, {
  maxItems: 10,
  itemsPerKeyword: 5,
  useNews: true,
  useBlog: true
});

console.log(`${result.items.length}개 아이템 큐레이션 완료`);
```

---

### 3. Claude 초안 작성기 (`lib/ai/draft-writer.ts`)
creativeDNA의 페르소나와 문체를 반영하여 블로그 포스트 초안을 작성합니다.

**프롬프트 구조:**
1. **페르소나 정보**: archetype, tone_descriptors, expertise_level
2. **문체 정보**: 평균 문장 길이, 자주 사용하는 표현, 문장 부호 패턴
3. **큐레이션 콘텐츠**: 제목, 출처, 요약, URL
4. **작성 지침**:
   - 초안 1: 정보 전달 중심
   - 초안 2: 경험/의견 공유 중심
   - 초안 3: 실용적 팁/가이드 중심

**사용 예시:**
```typescript
import { draftWriter } from '@/lib/ai';
import type { CuratedItem } from '@/lib/curation';

const curatedItems: CuratedItem[] = [ /* ... */ ];

const result = await draftWriter.generateDrafts(creativeDNA, curatedItems, {
  numDrafts: 3,
  minLength: 500,
  maxLength: 2000,
  temperature: 0.7
});

result.drafts.forEach((draft, i) => {
  console.log(`초안 ${i + 1}: ${draft.title}`);
  console.log(`태그: ${draft.tags.join(', ')}`);
});
```

---

### 4. 큐레이션 API (`app/api/curate/route.ts`)
큐레이션 + 초안 작성을 한 번에 실행하는 API입니다.

**플로우:**
```
1. writing_dna 조회
   ↓
2. 큐레이션 실행 (Naver Search)
   ↓
3. Claude로 초안 작성 (3개)
   ↓
4. curated_items 테이블에 저장
   ↓
5. 결과 반환
```

**API 사용:**
```bash
# POST /api/curate
curl -X POST http://localhost:3000/api/curate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "uuid-here",
    "curationOptions": {
      "maxItems": 10,
      "itemsPerKeyword": 5
    },
    "draftOptions": {
      "numDrafts": 3
    }
  }'
```

**응답 예시:**
```json
{
  "success": true,
  "curated": {
    "items": [ /* 10개 아이템 */ ],
    "count": 10,
    "keywords": ["React", "TypeScript", "Next.js"]
  },
  "drafts": [
    {
      "title": "Next.js로 시작하는 풀스택 개발",
      "content": "...",
      "summary": "Next.js의 주요 기능을 살펴봅니다.",
      "tags": ["Next.js", "React", "웹개발"],
      "estimatedReadTime": 5
    }
  ],
  "savedIds": ["id1", "id2", ...]
}
```

---

### 5. 이메일 시스템 (`lib/email/`)

#### Resend 클라이언트 (`resend-client.ts`)
- ✅ 단일 이메일 발송
- ✅ 일괄 발송
- ✅ 에러 핸들링

#### 뉴스레터 템플릿 (`newsletter-template.ts`)
- ✅ 반응형 HTML 템플릿
- ✅ 큐레이션 섹션
- ✅ 초안 섹션
- ✅ 태그 및 메타 정보

**사용 예시:**
```typescript
import { resendClient, generateNewsletterHTML } from '@/lib/email';

const html = generateNewsletterHTML({
  userName: '홍길동',
  curatedItems: [ /* ... */ ],
  drafts: [ /* ... */ ],
  date: new Date().toISOString()
});

await resendClient.sendEmail({
  to: 'user@example.com',
  subject: '오늘의 뉴스레터',
  html
});
```

---

### 6. BullMQ 스케줄러 (`lib/scheduler/`)

#### Redis 연결 (`redis-connection.ts`)
- Upstash Redis 연결 설정
- TLS 보안 연결

#### 뉴스레터 큐 (`newsletter-queue.ts`)
- ✅ 즉시 작업 추가
- ✅ 매일 반복 작업 (Cron)
- ✅ 재시도 로직 (3회, 지수 백오프)
- ✅ 큐 통계 조회
- ✅ 큐 정리

#### Worker (`newsletter-worker.ts`)
- ✅ 큐 작업 처리
- ✅ 큐레이션 → 초안 작성 → 이메일 발송
- ✅ 동시성 제어 (5개)
- ✅ Rate Limiting (1분당 10개)

**사용 예시:**
```typescript
import { newsletterQueue, startNewsletterWorker } from '@/lib/scheduler';

// Worker 시작 (서버 시작 시 한 번만)
const worker = startNewsletterWorker();

// 매일 반복 작업 추가
await newsletterQueue.addDailyJob({
  userId: 'uuid',
  userEmail: 'user@example.com',
  userName: '홍길동',
  scheduledAt: new Date().toISOString()
}, '0 7 * * *');  // 매일 아침 7시 (한국 시간)
```

---

### 7. 뉴스레터 발송 API (`app/api/send-newsletter/route.ts`)

**액션:**
1. **send-now**: 즉시 발송
2. **schedule-daily**: 매일 반복 설정
3. **unschedule**: 반복 해제

**API 사용:**
```bash
# 즉시 발송
curl -X POST http://localhost:3000/api/send-newsletter \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "uuid",
    "action": "send-now"
  }'

# 매일 반복 설정
curl -X POST http://localhost:3000/api/send-newsletter \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "uuid",
    "action": "schedule-daily",
    "cronTime": "0 7 * * *"
  }'

# 반복 해제
curl -X POST http://localhost:3000/api/send-newsletter \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "uuid",
    "action": "unschedule"
  }'

# 큐 통계 조회 (GET)
curl http://localhost:3000/api/send-newsletter
```

---

## 🚀 전체 플로우

### 1회성 수동 실행
```bash
# 1. 포스트 수집 (Phase 1 Week 2)
POST /api/collect-posts

# 2. 문체 분석 (Phase 1 Week 3)
POST /api/analyze-dna

# 3. 큐레이션 + 초안 작성 (Phase 1 Week 4)
POST /api/curate

# 4. 뉴스레터 발송
POST /api/send-newsletter (action: send-now)
```

### 자동 스케줄링
```bash
# 1회만 설정하면 매일 자동 실행
POST /api/send-newsletter (action: schedule-daily)
```

**자동 플로우:**
```
매일 아침 7시 (Cron)
   ↓
Worker가 큐에서 작업 가져옴
   ↓
1. creativeDNA 조회
   ↓
2. 큐레이션 (Naver Search)
   ↓
3. 초안 작성 (Claude)
   ↓
4. 이메일 템플릿 생성
   ↓
5. 이메일 발송 (Resend)
   ↓
6. DB 저장 (newsletters 테이블)
```

---

## 📊 프로젝트 구조

```
lib/
├── curation/
│   ├── naver-search.ts      # Naver Search API
│   ├── curator.ts            # 큐레이터
│   └── index.ts
├── ai/
│   ├── draft-writer.ts       # Claude 초안 작성기
│   └── index.ts
├── email/
│   ├── resend-client.ts      # Resend API
│   ├── newsletter-template.ts # HTML 템플릿
│   └── index.ts
└── scheduler/
    ├── redis-connection.ts   # Redis 설정
    ├── newsletter-queue.ts   # BullMQ 큐
    ├── newsletter-worker.ts  # Worker
    └── index.ts

app/api/
├── curate/
│   └── route.ts              # 큐레이션 API
└── send-newsletter/
    └── route.ts              # 뉴스레터 발송 API
```

---

## 🔧 환경 변수

`.env.local`에 다음 변수 추가:

```bash
# Naver Search API
NAVER_CLIENT_ID=your-client-id
NAVER_CLIENT_SECRET=your-client-secret

# Resend
RESEND_API_KEY=re_your-key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

---

## 📈 성능

### 예상 수치 (사용자 1명 기준)
- **큐레이션**: 5-10초 (10개 아이템)
- **초안 작성**: 15-30초 (Claude API)
- **이메일 발송**: 1-2초 (Resend)
- **총 소요 시간**: 20-45초

### 비용 (사용자 1명, 1일 기준)
- **Naver Search API**: 무료 (일 25,000회)
- **Claude Sonnet 4.5**: ~$0.5-$1.5
- **Resend**: 무료 (월 3,000통)
- **Upstash Redis**: 무료 (월 10,000 커맨드)

---

## ⚠️ 중요 사항

### 1. Worker 시작
서버 시작 시 Worker를 실행해야 큐 작업이 처리됩니다.

**Next.js App Router의 경우:**
```typescript
// app/api/worker/route.ts (별도 엔드포인트)
import { startNewsletterWorker } from '@/lib/scheduler';

let worker: Worker | null = null;

export async function GET() {
  if (!worker) {
    worker = startNewsletterWorker();
    return Response.json({ message: 'Worker started' });
  }
  return Response.json({ message: 'Worker already running' });
}
```

또는 서버리스 환경이 아니라면 별도 프로세스로 실행:
```bash
# worker.ts
import { startNewsletterWorker } from './lib/scheduler';
startNewsletterWorker();

# 실행
ts-node worker.ts
```

### 2. Cron 시간 설정
- `0 7 * * *`: 매일 아침 7시 (서버 로컬 시간)
- **한국 시간 기준**: UTC+9 고려 필요
- 서버가 UTC라면: `0 22 * * *` (22시 = 다음날 7시 KST)

### 3. Redis 연결
- Upstash Redis는 TLS 필수
- REST API 아닌 Redis Protocol 사용

### 4. 에러 처리
- 큐 작업 실패 시 자동 재시도 (3회)
- 3회 모두 실패 시 작업은 failed 상태로 유지
- `/api/send-newsletter` GET으로 통계 확인 가능

---

## 🐛 문제 해결

### 1. "NAVER_CLIENT_ID not found"
```bash
# .env.local에 키 추가
NAVER_CLIENT_ID=your-id
NAVER_CLIENT_SECRET=your-secret
```

### 2. Worker가 작업을 처리하지 않음
- Worker가 시작되었는지 확인
- Redis 연결 확인: `testRedisConnection()`
- 큐 통계 확인: `GET /api/send-newsletter`

### 3. 이메일이 발송되지 않음
- Resend API 키 확인
- `RESEND_FROM_EMAIL`이 도메인 인증되었는지 확인
- Resend 대시보드에서 로그 확인

### 4. Cron 작업이 실행되지 않음
- Worker가 실행 중인지 확인
- Cron 표현식 검증: https://crontab.guru
- 서버 시간대 확인

---

## 🔄 다음 단계: Phase 2

큐레이션 + 초안 작성 완료 후:

1. **프론트엔드 대시보드**
   - 큐레이션 결과 미리보기
   - 초안 편집 UI
   - 뉴스레터 발송 히스토리

2. **피드백 학습**
   - 사용자가 선택한 초안 추적
   - 클릭률 분석
   - creativeDNA 업데이트

3. **고급 기능**
   - 여러 블로그 소스 통합
   - YouTube 큐레이션
   - 이미지 자동 선택

---

## 📚 참고 문서

- [WRITING_DNA_GUIDE.md](./WRITING_DNA_GUIDE.md) - 문체 분석
- [CRAWLING_GUIDE.md](./CRAWLING_GUIDE.md) - 포스트 수집
- [IMPROVED_PRD.md](./IMPROVED_PRD.md) - 전체 프로젝트 요구사항
- [Naver Search API](https://developers.naver.com/docs/serviceapi/search/blog/blog.md)
- [Resend 문서](https://resend.com/docs)
- [BullMQ 문서](https://docs.bullmq.io)

---

**✅ Phase 1 Week 4 완료!**

이제 MyBlogDaily는 완전 자동화되었습니다:
- 매일 아침 7시 큐레이션
- AI 초안 작성
- 이메일 자동 발송

축하합니다! 🎉
