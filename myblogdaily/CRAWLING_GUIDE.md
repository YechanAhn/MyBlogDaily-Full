# 🕷️ 크롤링 시스템 가이드

> Phase 1 Week 2 완료: RSS 파싱 + Playwright 크롤링

---

## ✅ 구현 완료

### 1. RSS 파서 (`lib/crawler/rss-parser.ts`)
네이버 블로그의 공식 RSS 피드를 파싱하여 포스트 링크 목록을 확보합니다.

**기능:**
- ✅ RSS 피드 파싱 (`https://rss.blog.naver.com/{blogId}.xml`)
- ✅ 최신 30-50개 포스트 메타데이터 수집
- ✅ URL 정규화 (모바일 → 데스크톱)
- ✅ 블로그 ID 검증 및 추출

**사용 예시:**
```typescript
import { fetchNaverBlogPosts } from '@/lib/crawler';

// 간편 함수
const result = await fetchNaverBlogPosts('user_id', 50);

if (result.success) {
  console.log(`${result.posts.length}개 포스트 발견`);
  result.posts.forEach(post => {
    console.log(`- ${post.title}: ${post.link}`);
  });
}
```

---

### 2. 차단 감지 (`lib/crawler/block-detector.ts`)
네이버의 차단을 자동으로 감지하고 백오프 전략을 적용합니다.

**기능:**
- ✅ HTTP 상태 코드 확인 (403, 429)
- ✅ CAPTCHA 페이지 감지
- ✅ 차단 메시지 감지
- ✅ 지수 백오프 (2s → 4s → 8s → 16s)
- ✅ 연속 3회 실패 시 30분 장기 대기
- ✅ Rate Limiting (2-5초 랜덤 대기)

**통계 조회:**
```typescript
import { globalBlockDetector } from '@/lib/crawler';

const stats = globalBlockDetector.getStats();
console.log(`연속 실패: ${stats.consecutiveFailures}회`);
console.log(`총 차단: ${stats.totalBlocks}회`);
```

---

### 3. Playwright 크롤러 (`lib/crawler/playwright-crawler.ts`)
모바일 우선 크롤링 + 데스크톱 iframe 폴백 전략으로 안정적인 본문 수집을 보장합니다.

**전략:**
1. **모바일 페이지 우선** (`m.blog.naver.com`)
   - 단순한 DOM 구조
   - 빠른 로드 속도
   - 차단 위험 낮음

2. **데스크톱 iframe 폴백** (`blog.naver.com`)
   - 모바일 실패 시 자동 전환
   - `#mainFrame` iframe 접근

3. **스텔스 기능**
   - navigator.webdriver 숨김
   - 랜덤 User-Agent (4개 모바일 UA 풀)
   - 인간형 타이밍 (2-5초 랜덤 대기)

4. **재시도 로직**
   - 최대 3회 재시도
   - 지수 백오프
   - 차단 감지 시 자동 대기

**사용 예시:**
```typescript
import { crawler } from '@/lib/crawler';

// 단일 포스트 크롤링
const result = await crawler.crawlWithRetry('https://blog.naver.com/user_id/123');

if (result.success) {
  console.log(`제목: ${result.title}`);
  console.log(`본문: ${result.content.substring(0, 100)}...`);
  console.log(`방식: ${result.method}`);  // 'mobile' or 'desktop'
}

// 크롤러 종료
await crawler.closeBrowser();
```

---

### 4. 블로그 포스트 수집 API (`app/api/collect-posts/route.ts`)
RSS + Playwright를 통합하여 포스트를 수집하고 Supabase에 저장합니다.

**플로우:**
```
1. RSS 피드 파싱 (링크 목록 확보)
   ↓
2. 기존 포스트 중복 체크
   ↓
3. Playwright 크롤링 (본문 수집)
   ↓
4. Supabase에 저장
   ↓
5. 통계 및 결과 반환
```

**API 사용:**
```bash
# POST /api/collect-posts
curl -X POST http://localhost:3000/api/collect-posts \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "uuid-here",
    "blogId": "user_id",
    "limit": 50
  }'
```

**응답 예시:**
```json
{
  "success": true,
  "collected": 45,
  "failed": 3,
  "skipped": 2,
  "duration": 125000,
  "posts": [
    {
      "title": "제목",
      "url": "https://blog.naver.com/...",
      "status": "success"
    }
  ]
}
```

---

## 🚀 사용 방법

### 1. 환경 변수 설정
`.env.local` 파일에 크롤러 설정 추가:

```bash
# 크롤링 설정
CRAWLER_HEADLESS=true
CRAWLER_MAX_RETRIES=3
CRAWLER_TIMEOUT_MS=15000
CRAWLER_RATE_LIMIT_MIN_MS=2000
CRAWLER_RATE_LIMIT_MAX_MS=5000
```

### 2. Playwright 브라우저 설치
```bash
npx playwright install chromium
```

### 3. 개발 서버 실행
```bash
npm run dev
```

### 4. API 호출
```bash
curl -X POST http://localhost:3000/api/collect-posts \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id",
    "blogId": "blog-id",
    "limit": 50
  }'
```

---

## 📊 프로젝트 구조

```
lib/crawler/
├── rss-parser.ts        # RSS 피드 파싱
├── block-detector.ts    # 차단 감지 시스템
├── playwright-crawler.ts # Playwright 크롤러
└── index.ts            # 통합 export

app/api/collect-posts/
└── route.ts            # 포스트 수집 API
```

---

## 🔧 설정 옵션

### CrawlerConfig
```typescript
{
  headless: boolean;        // 헤드리스 모드 (기본: true)
  maxRetries: number;       // 최대 재시도 (기본: 3)
  timeoutMs: number;        // 타임아웃 (기본: 15000ms)
  rateLimitMinMs: number;   // 최소 대기 시간 (기본: 2000ms)
  rateLimitMaxMs: number;   // 최대 대기 시간 (기본: 5000ms)
}
```

### BlockDetectorConfig
```typescript
{
  maxConsecutiveFailures: number;  // 연속 실패 허용 (기본: 3)
  baseDelayMs: number;             // 기본 대기 (기본: 2000ms)
  maxDelayMs: number;              // 최대 대기 (기본: 16000ms)
  longWaitMs: number;              // 장기 대기 (기본: 30분)
}
```

---

## ⚠️ 중요 사항

### 1. 합법적 사용
- ✅ **사용자 본인의 블로그만** 크롤링
- ✅ 네이버 이용약관 준수
- ❌ 타인의 블로그 무단 수집 금지

### 2. 스텔스 기술의 한계
완벽한 차단 회피는 불가능합니다:
- ✅ 기본 지표 (UA, webdriver) 숨김 → 90% 효과
- ⚠️ 고급 탐지 시스템은 여러 신호 종합 분석
- ⚠️ navigator.webdriver 완전 은닉 불가능
- ⚠️ 과도한 요청 빈도는 항상 감지됨

### 3. Rate Limiting
- 기본: 2-5초 랜덤 대기
- 실패 시: 지수 백오프
- 연속 3회 실패: 30분 대기
- **공격적이지 않은** 요청 빈도 유지

### 4. 에러 처리
```typescript
try {
  const result = await crawler.crawlWithRetry(url);

  if (!result.success) {
    console.error(`크롤링 실패: ${result.error}`);
    // 재시도 또는 스킵 로직
  }

} catch (error) {
  console.error('예외 발생:', error);
  // 에러 로깅 및 알림
}
```

---

## 🐛 문제 해결

### 1. "Chromium not found"
```bash
# 해결: Playwright 브라우저 설치
npx playwright install chromium
```

### 2. "차단 감지: CAPTCHA"
```bash
# 해결: Rate Limiting 간격 늘리기
CRAWLER_RATE_LIMIT_MIN_MS=5000
CRAWLER_RATE_LIMIT_MAX_MS=10000
```

### 3. "본문 추출 실패"
- 네이버 블로그 구조 변경 가능성
- 셀렉터 업데이트 필요
- `playwright-crawler.ts`의 `contentSelectors` 배열 확인

### 4. "연속 3회 차단"
- 30분 장기 대기 중
- 정상 동작입니다
- 대기 후 자동 재개

---

## 📈 성능

### 예상 수치 (50개 포스트 기준)
- **RSS 파싱**: 1-2초
- **크롤링**: 2-5분 (Rate Limiting 포함)
- **총 소요 시간**: 3-6분
- **성공률**: 85-95%
- **메모리 사용**: 150-300MB

### 최적화 팁
1. **병렬 처리**: 동시에 2-3개 포스트 크롤링 (차단 위험 증가)
2. **브라우저 재사용**: `crawler` 인스턴스 재사용
3. **캐싱**: 이미 수집한 포스트 스킵

---

## 🔄 다음 단계 (Phase 1 Week 3)

크롤링 완료 후:
1. **문체 분석** (Kiwi.js + Claude API)
2. **페르소나 추출**
3. **창작 DNA 생성**

---

## 📚 참고 문서

- [IMPROVED_PRD.md](../IMPROVED_PRD.md) - 크롤링 전략 상세
- [Claude.md](../Claude.md) - 개발 가이드
- [Playwright 공식 문서](https://playwright.dev)

---

**✅ Phase 1 Week 2 완료!**

이제 블로그 포스트 수집이 가능합니다. 🎉

다음 단계: 문체 분석 (Phase 1 Week 3)
