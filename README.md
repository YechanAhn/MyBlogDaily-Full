# 🤖 MyBlogDaily

> 블로거를 위한 매일 아침 맞춤형 콘텐츠 큐레이션 및 초안 작성 서비스

---

## 📋 목차

1. [프로젝트 소개](#프로젝트-소개)
2. [빠른 시작](#빠른-시작)
3. [환경 설정](#환경-설정)
4. [개발 가이드](#개발-가이드)
5. [배포](#배포)
6. [문제 해결](#문제-해결)

---

## 🎯 프로젝트 소개

이 서비스는 블로거가 **매일 꾸준히 포스팅**할 수 있도록 돕습니다:

### 핵심 기능
- 📝 사용자의 블로그 문체 AI 분석
- 📰 매일 맞춤형 콘텐츠 큐레이션
- ✍️ 블로거 문체를 반영한 초안 자동 작성
- 📧 매일 아침 이메일로 초안 전달

### 기술 스택
- **프론트엔드**: Next.js 14, TypeScript, Tailwind CSS
- **백엔드**: Vercel Functions, Supabase
- **AI**: Claude 4.5 Sonnet, OpenAI
- **크롤링**: Playwright
- **이메일**: Resend

---

## ⚡ 빠른 시작

### 1️⃣ 사전 요구사항

다음 소프트웨어가 설치되어 있어야 합니다:

```bash
# Node.js 20 이상 (LTS 버전 권장)
node --version  # v20.x.x 이상

# npm 또는 pnpm
npm --version   # 10.x.x 이상
# 또는
pnpm --version  # 8.x.x 이상
```

**설치 방법**:
- Node.js: https://nodejs.org (LTS 버전 다운로드)
- pnpm (선택): `npm install -g pnpm`

### 2️⃣ 프로젝트 클론

```bash
# GitHub에서 프로젝트 클론
git clone https://github.com/your-username/myblogdaily.git

# 프로젝트 폴더로 이동
cd myblogdaily
```

### 3️⃣ 의존성 설치

```bash
# npm 사용 시
npm install

# pnpm 사용 시
pnpm install
```

설치하는 데 2-5분 정도 걸립니다. ☕️

### 4️⃣ 환경 변수 설정

```bash
# .env.local.example 파일을 복사
cp .env.local.example .env.local

# VS Code나 텍스트 에디터로 .env.local 열기
code .env.local
```

각 API 키를 발급받아서 입력하세요. 자세한 방법은 [환경 설정](#환경-설정) 참고.

### 5️⃣ 개발 서버 실행

```bash
# 개발 모드로 실행
npm run dev

# 또는
pnpm dev
```

브라우저에서 http://localhost:3000 을 열어보세요! 🎉

---

## 🔧 환경 설정

### API 키 발급 가이드

모든 API 키는 무료 티어로 시작할 수 있습니다.

#### 1. 네이버 API (필수)

```bash
# 발급 링크: https://developers.naver.com
# 소요 시간: 5분
```

1. 네이버 개발자센터 접속
2. "애플리케이션 등록" 클릭
3. 정보 입력:
   - 이름: "MyBlogDaily"
   - 사용 API: "네이버 로그인", "검색"
   - 서비스 URL: `http://localhost:3000`
   - Callback URL: `http://localhost:3000/auth/callback/naver`
4. 등록 완료 후 Client ID와 Client Secret 복사
5. `.env.local`에 붙여넣기

#### 2. Claude API (필수)

```bash
# 발급 링크: https://console.anthropic.com
# 소요 시간: 3분
# 초기 크레딧: $5 (무료)
```

1. Anthropic 콘솔 접속 (Google 계정으로 가입 가능)
2. "API Keys" 메뉴
3. "Create Key" 클릭
4. API Key 복사 (한 번만 표시됨!)
5. `.env.local`에 붙여넣기

⚠️ **주의**: API 키는 절대 GitHub에 올리면 안 됩니다!

#### 3. OpenAI API (필수)

```bash
# 발급 링크: https://platform.openai.com
# 소요 시간: 3분
# 초기 크레딧: $5 (신규 가입 시)
```

1. OpenAI Platform 접속
2. "API keys" 메뉴
3. "Create new secret key" 클릭
4. 이름 입력 후 생성
5. API Key 복사
6. `.env.local`에 붙여넣기

#### 4. Supabase (필수)

```bash
# 발급 링크: https://supabase.com
# 소요 시간: 5분
# 무료 티어: 500MB DB, 2GB 파일
```

1. Supabase 대시보드 접속 (GitHub 계정으로 가입 가능)
2. "New Project" 클릭
3. 정보 입력:
   - 이름: "MyBlogDaily"
   - Database Password: 강력한 비밀번호 설정 (꼭 기억!)
   - Region: **Northeast Asia (Seoul)** 선택 (중요!)
4. 프로젝트 생성 완료 (2-3분 소요)
5. Settings → API 메뉴에서:
   - Project URL 복사
   - `anon` `public` 키 복사
   - `service_role` `secret` 키 복사 (절대 공개 금지!)
6. `.env.local`에 붙여넣기

#### 5. Resend (필수)

```bash
# 발급 링크: https://resend.com
# 소요 시간: 2분
# 무료 티어: 100통/일
```

1. Resend 접속 (GitHub 계정으로 가입 가능)
2. "API Keys" 메뉴
3. "Create API Key" 클릭
4. API Key 복사
5. `.env.local`에 붙여넣기

#### 6. Upstash Redis (필수)

```bash
# 발급 링크: https://upstash.com
# 소요 시간: 3분
# 무료 티어: 10,000 commands/일
```

1. Upstash 접속 (GitHub 계정으로 가입 가능)
2. "Create Database" 클릭
3. 정보 입력:
   - Type: **Redis** 선택
   - Name: "blogger-queue"
   - Region: **Asia Pacific (Seoul)** 선택
4. "REST API" 탭 클릭
5. `UPSTASH_REDIS_REST_URL`과 `UPSTASH_REDIS_REST_TOKEN` 복사
6. `.env.local`에 붙여넣기

#### 7. YouTube Data API (선택)

```bash
# 발급 링크: https://console.cloud.google.com
# 소요 시간: 5분
# 무료 할당량: 10,000 requests/일
```

1. Google Cloud Console 접속
2. 새 프로젝트 생성: "MyBlogDaily"
3. "APIs & Services" → "Enable APIs and Services"
4. "YouTube Data API v3" 검색 후 활성화
5. "Credentials" → "Create Credentials" → "API Key"
6. API Key 복사
7. `.env.local`에 붙여넣기

---

### 환경 변수 검증

모든 키를 입력했으면 다음 명령어로 확인:

```bash
# 환경 변수가 제대로 로드되는지 확인
npm run check-env

# 또는 수동 확인
cat .env.local | grep -v "^#" | grep -v "^$"
```

---

## 🛠️ 개발 가이드

### 프로젝트 구조

```
프로젝트/
├── app/                      # Next.js App Router
│   ├── (auth)/              # 인증 관련 페이지
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/         # 대시보드 (로그인 필요)
│   │   ├── page.tsx
│   │   └── settings/
│   └── api/                 # API 엔드포인트
│       ├── auth/
│       ├── collect-posts/
│       ├── analyze-dna/
│       ├── curate/
│       └── newsletter/
├── lib/                     # 재사용 가능한 유틸리티
│   ├── crawler/             # 크롤링 로직
│   ├── ai/                  # AI (Claude, OpenAI)
│   ├── queue/               # 작업 큐
│   └── email/               # 이메일
├── components/              # React 컴포넌트
│   ├── ui/                  # shadcn/ui
│   └── custom/              # 커스텀 컴포넌트
├── types/                   # TypeScript 타입
├── public/                  # 정적 파일 (이미지 등)
├── .env.local              # 환경 변수 (Git에서 제외)
├── .env.local.example      # 환경 변수 템플릿
├── .gitignore              # Git 제외 파일
├── Claude.md               # Claude Code 설정
├── IMPROVED_PRD.md         # 프로젝트 요구사항 문서
└── package.json            # 의존성 및 스크립트
```

### 개발 명령어

```bash
# 개발 서버 실행
npm run dev

# TypeScript 타입 체크
npm run type-check

# ESLint로 코드 검사
npm run lint

# Prettier로 코드 포맷팅
npm run format

# 프로덕션 빌드
npm run build

# 빌드된 버전 실행
npm run start
```

### Git 워크플로우

```bash
# 1. 새 브랜치 생성
git checkout -b feature/your-feature-name

# 2. 코드 작성 및 테스트
npm run dev

# 3. 변경사항 스테이징
git add .

# 4. 커밋 (의미 있는 메시지 작성)
git commit -m "feat: 네이버 블로그 RSS 파싱 추가"

# 5. GitHub에 푸시
git push origin feature/your-feature-name

# 6. GitHub에서 Pull Request 생성
```

---

## 🚀 배포

### Vercel 배포 (권장)

1. **Vercel 계정 생성**: https://vercel.com/signup
2. **GitHub 연결**: Vercel 대시보드에서 GitHub 저장소 임포트
3. **환경 변수 설정**: Vercel 프로젝트 설정에서 `.env.local`의 모든 변수 추가
4. **배포**: "Deploy" 버튼 클릭

자동으로 `https://your-project.vercel.app` 도메인이 생성됩니다.

### 배포 후 확인사항

```bash
# 체크리스트
- [ ] 모든 환경 변수가 Vercel에 추가됨
- [ ] 네이버 Callback URL을 Vercel 도메인으로 변경
- [ ] Supabase에서 Vercel 도메인을 허용 목록에 추가
- [ ] 실제 도메인에서 로그인 테스트
- [ ] 크롤링 기능 테스트
- [ ] 이메일 발송 테스트
```

---

## 🐛 문제 해결

### 자주 발생하는 문제

#### 1. `Cannot find module` 에러

```bash
# 해결: node_modules 재설치
rm -rf node_modules package-lock.json
npm install
```

#### 2. `EADDRINUSE: address already in use`

```bash
# 해결: 3000 포트를 사용 중인 프로세스 종료
# Mac/Linux:
lsof -ti:3000 | xargs kill -9

# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID번호> /F
```

#### 3. TypeScript 에러

```bash
# 해결: 타입 캐시 삭제
rm -rf .next
npm run type-check
```

#### 4. Supabase 연결 실패

```bash
# 해결: 환경 변수 확인
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# 값이 없으면 .env.local 파일 확인
cat .env.local | grep SUPABASE
```

#### 5. 크롤링 실패 (Playwright)

```bash
# 해결: Playwright 브라우저 재설치
npx playwright install chromium

# Docker 환경에서 실행 시
npx playwright install-deps chromium
```

---

## 📖 추가 문서

- [IMPROVED_PRD.md](./IMPROVED_PRD.md) - 상세한 프로젝트 요구사항
- [Claude.md](./Claude.md) - Claude Code 개발 가이드
- [Phase 1 개발 가이드](./docs/phase1.md) - Week 1-4 개발 계획 (작성 예정)

---

## 🤝 기여하기

이 프로젝트는 개인 프로젝트이지만, 개선 제안은 환영합니다!

1. 이슈 생성: 버그 리포트 또는 기능 제안
2. Pull Request: 코드 개선

---

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

---

## 🙋 질문이 있나요?

Claude Code에게 물어보세요:

```
"README를 읽었는데 [구체적인 질문] 에 대해 알려줘"
```

또는 [GitHub Issues](https://github.com/your-username/myblogdaily/issues)에 남겨주세요.

---

## 🎉 시작하기

모든 설정이 완료되었으면:

```bash
npm run dev
```

그리고 Claude Code에게 이렇게 말해보세요:

```
"Phase 1 Week 1 개발을 시작해줘.
Next.js 프로젝트를 생성하고 기본 폴더 구조를 만들어줘."
```

**행운을 빕니다!** 🚀
