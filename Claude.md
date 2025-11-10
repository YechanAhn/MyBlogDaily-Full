# MyBlogDaily 개발 가이드

## 📌 프로젝트 개요
**MyBlogDaily** - 블로거의 네이버 블로그 문체를 분석하여 매일 맞춤형 초안을 이메일로 전송하는 AI 뉴스레터 서비스

**기술 스택**:
- Frontend: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- Backend: Vercel Functions, Supabase, BullMQ + Upstash Redis
- AI: Claude 4.5 Sonnet, OpenAI, Kiwi.js
- Crawling: Playwright
- Data: 네이버 API, YouTube API, Google Trends
- Email: Resend / AWS SES

---

## 🎯 핵심 개발 원칙

### 1. KISS - Keep It Simple, Stupid
**절대 overengineering 하지 말 것!**
- MVP 단계에서는 가장 단순한 방법 선택
- 추상화/패턴은 실제로 필요할 때만 추가
- 라이브러리는 최소한만 사용
- "나중에 필요할 수도"는 금지 - 지금 필요한 것만 구현

**Bad (overengineered)**:
```typescript
// Factory Pattern + Strategy Pattern + Repository Pattern
class UserServiceFactory {
  createService(type: string) { /* 복잡한 로직 */ }
}
```

**Good (simple)**:
```typescript
// 그냥 함수로 시작
async function getUser(userId: string) {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
  if (error) throw new Error(error.message);
  return data;
}
```

### 2. 코딩 규칙
- **한글 주석 필수**: 핵심 로직에만 간결하게
- **TypeScript**: any 금지, 명확한 타입 정의
- **에러 처리**: try-catch + 명확한 에러 메시지

**파일 구조**:
```
app/
├── (auth)/login, signup
├── (dashboard)/          # 로그인 필요
└── api/                  # collect-posts, analyze-dna, curate, newsletter
lib/
├── crawler/              # 크롤링 로직
├── ai/                   # Claude, OpenAI
└── email/                # 이메일 발송
```

### 3. 개발 단계 (MVP 우선)

**Phase 1 (4주)**: 핵심 기능만
- Week 1: Next.js + Supabase + 네이버 로그인
- Week 2: RSS 파싱 + Playwright 크롤링 (50개 포스트)
- Week 3: Kiwi.js 형태소 분석 + Claude 페르소나 분석
- Week 4: 큐레이션 + Claude 초안 작성 + 이메일 발송

**Phase 2-3**: 베타 테스트 → 결제 → 출시

### 4. 크롤링 전략
**목표**: 90% 성공률 (본인 블로그만 크롤링)

**플로우**:
1. RSS로 링크 목록 확보 (`https://rss.blog.naver.com/{블로그ID}.xml`)
2. 모바일 페이지 크롤링 시도 → 실패 시 데스크톱 iframe 방식
3. 재시도: 2초 → 4초 → 8초 → 30분 대기

**BlockDetector**: 차단 감지 후 자동 대기 & 재시도

### 5. 환경 변수 (.env.local)
```bash
# .gitignore에 반드시 포함!
NAVER_CLIENT_ID / NAVER_CLIENT_SECRET
ANTHROPIC_API_KEY
OPENAI_API_KEY
YOUTUBE_API_KEY
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
```

---

## 참고
- 공식 문서: [Next.js](https://nextjs.org/docs) · [Supabase](https://supabase.com/docs) · [Playwright](https://playwright.dev) · [Claude API](https://docs.anthropic.com)
- Git 커밋: `feat:` / `fix:` / `refactor:` / `docs:` / `chore:`
