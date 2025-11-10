# 🚀 시작하기 가이드 (비개발자용)

> **목표**: 이 문서를 따라하면 30분 안에 개발을 시작할 수 있습니다!

---

## 📋 체크리스트

아래 항목들을 하나씩 체크하면서 진행하세요:

```bash
[ ] Step 1: 필요한 소프트웨어 설치 (10분)
[ ] Step 2: API 키 발급 (15분)
[ ] Step 3: 프로젝트 설정 (5분)
[ ] Step 4: 첫 번째 명령어 실행 (1분)
```

---

## Step 1: 필요한 소프트웨어 설치 (10분)

### 1.1 Node.js 설치

Node.js는 JavaScript를 실행하는 프로그램입니다.

```bash
# 다운로드 링크
https://nodejs.org

# 설치할 버전: LTS (Long Term Support)
# Mac: .pkg 파일 다운로드
# Windows: .msi 파일 다운로드
```

**설치 확인**:

```bash
# 터미널(Mac) 또는 명령 프롬프트(Windows)를 열고:
node --version
# 출력 예시: v20.11.0

npm --version
# 출력 예시: 10.2.4
```

✅ 버전이 출력되면 성공!

### 1.2 Git 설치

Git은 코드 버전 관리 도구입니다.

```bash
# 다운로드 링크
https://git-scm.com/downloads

# Mac: .dmg 파일
# Windows: .exe 파일
```

**설치 확인**:

```bash
git --version
# 출력 예시: git version 2.39.0
```

✅ 버전이 출력되면 성공!

### 1.3 VS Code 설치

VS Code는 코드 편집기입니다.

```bash
# 다운로드 링크
https://code.visualstudio.com

# 모든 OS: 그냥 다운로드해서 설치
```

### 1.4 Claude Code 확장 설치

VS Code를 열고:

1. 왼쪽 사이드바에서 확장 아이콘 클릭 (네모 4개 모양)
2. 검색창에 "Claude Code" 입력
3. "Install" 버튼 클릭

✅ 설치 완료!

---

## Step 2: API 키 발급 (15분)

이제 가장 중요한 부분입니다. 각 서비스에서 API 키를 발급받아야 합니다.

### 📝 준비물

- 이메일 계정 (Gmail 추천)
- 메모장 (API 키 임시 저장용)

### 2.1 네이버 API (필수, 3분)

```
1. https://developers.naver.com 접속
2. 로그인 (네이버 계정 필요)
3. 상단 메뉴 "Application" → "애플리케이션 등록" 클릭
4. 정보 입력:
   - 애플리케이션 이름: "MyBlogDaily"
   - 사용 API:
     ✅ 네이버 로그인
     ✅ 검색
   - 환경: PC 웹
   - 서비스 URL: http://localhost:3000
   - Callback URL: http://localhost:3000/auth/callback/naver

5. 등록 완료 후 "내 애플리케이션" 메뉴에서:
   - Client ID 복사 → 메모장에 저장
   - Client Secret 복사 → 메모장에 저장
```

### 2.2 Claude API (필수, 2분)

```
1. https://console.anthropic.com 접속
2. "Sign Up" (Google 계정으로 가입 가능)
3. 왼쪽 메뉴 "API Keys" 클릭
4. "Create Key" 버튼 클릭
5. 이름 입력 (예: "my-project")
6. API Key 복사 → 메모장에 저장
   ⚠️ 경고: 이 키는 한 번만 보여집니다!
```

### 2.3 OpenAI API (필수, 2분)

```
1. https://platform.openai.com 접속
2. 회원가입 (Google 계정으로 가능)
3. 왼쪽 메뉴 "API keys" 클릭
4. "Create new secret key" 클릭
5. 이름 입력 후 생성
6. API Key 복사 → 메모장에 저장
   ⚠️ 경고: 이 키는 한 번만 보여집니다!
```

### 2.4 Supabase (필수, 3분)

```
1. https://supabase.com 접속
2. "Start your project" (GitHub 계정으로 가입 가능)
3. "New Project" 클릭
4. 정보 입력:
   - Name: "MyBlogDaily"
   - Database Password: 강력한 비밀번호 입력
     (예: "MyStr0ng!Pass123" - 꼭 기억하세요!)
   - Region: Northeast Asia (Seoul) ⭐️ 중요!
5. "Create new project" 클릭 (2분 대기)
6. 프로젝트 생성 완료 후:
   - 왼쪽 메뉴 "Settings" → "API" 클릭
   - Project URL 복사 → 메모장에 저장 https://zvmhzotjaarkxaqhcjlc.supabase.co
   - "anon public" 키 복사 → 메모장에 저장
   - "service_role secret" 키 복사 → 메모장에 저장
     ⚠️ 경고: secret 키는 절대 공개하면 안 됩니다!
```

### 2.5 Resend (필수, 2분)

```
1. https://resend.com 접속
2. "Sign Up" (GitHub 계정으로 가능)
3. 왼쪽 메뉴 "API Keys" 클릭
4. "Create API Key" 클릭
5. 키 이름 입력
6. API Key 복사 → 메모장에 저장
```

### 2.6 Upstash Redis (필수, 3분)

```
1. https://upstash.com 접속
2. "Get Started" (GitHub 계정으로 가능)
3. "Create Database" 클릭
4. 정보 입력:
   - Type: Redis ⭐️ 선택
   - Name: "blogger-queue"
   - Region: Asia Pacific (Seoul) ⭐️ 선택
5. "Create" 클릭
6. 생성된 데이터베이스 클릭
7. "REST API" 탭 선택
8. 복사:
   - UPSTASH_REDIS_REST_URL → 메모장에 저장
   - UPSTASH_REDIS_REST_TOKEN → 메모장에 저장
```

### ✅ API 키 발급 완료!

이제 메모장에 다음 키들이 있어야 합니다:

- ✅ 네이버 Client ID
- ✅ 네이버 Client Secret
- ✅ Claude API Key
- ✅ OpenAI API Key
- ✅ Supabase URL
- ✅ Supabase Anon Key
- ✅ Supabase Service Role Key
- ✅ Resend API Key
- ✅ Upstash Redis URL
- ✅ Upstash Redis Token

---

## Step 3: 프로젝트 설정 (5분)

### 3.1 터미널 열기

**Mac**:

```bash
1. Spotlight 검색 (Cmd + Space)
2. "Terminal" 입력
3. Enter
```

**Windows**:

```bash
1. 시작 메뉴 클릭
2. "cmd" 또는 "PowerShell" 입력
3. Enter
```

### 3.2 프로젝트 폴더로 이동

```bash
# Mac/Linux
cd /Users/yechanahn/Code

# Windows
cd C:\Users\yechanahn\Code
```

### 3.3 의존성 설치

```bash
# 프로젝트 폴더에서 실행
npm install

# 2-5분 정도 걸립니다. 기다려주세요... ☕️
```

출력 예시:

```
added 1247 packages, and audited 1248 packages in 3m
```

✅ 에러 없이 완료되면 성공!

### 3.4 환경 변수 파일 생성

```bash
# 템플릿 파일을 복사
cp .env.local.example .env.local

# VS Code로 열기
code .env.local
```

### 3.5 API 키 입력

VS Code에서 `.env.local` 파일이 열립니다.

메모장에 저장한 API 키들을 복사해서 붙여넣으세요:

```bash
# 예시:
NAVER_CLIENT_ID=여기에_실제_키_붙여넣기
NAVER_CLIENT_SECRET=여기에_실제_키_붙여넣기
ANTHROPIC_API_KEY=sk-ant-여기에_실제_키_붙여넣기
# ... 나머지도 동일
```

⚠️ **주의**:

- `=` 기호 앞뒤에 공백이 없어야 합니다
- 따옴표("")는 필요 없습니다
- 실제 키를 그대로 붙여넣으세요

완료 후 저장 (Cmd+S 또는 Ctrl+S)

---

## Step 4: 첫 번째 명령어 실행 (1분)

### 4.1 개발 서버 실행

터미널에서:

```bash
npm run dev
```

출력 예시:

```
▲ Next.js 14.1.0
- Local:        http://localhost:3000
- Network:      http://192.168.1.100:3000

✓ Ready in 2.3s
```

### 4.2 브라우저에서 확인

브라우저를 열고:

```
http://localhost:3000
```

✅ 페이지가 로드되면 성공!

---

## 🎉 축하합니다!

모든 설정이 완료되었습니다!

이제 Claude Code를 사용할 시간입니다.

---

## 다음 단계: Claude Code로 개발 시작

### VS Code에서 Claude Code 열기

1. VS Code에서 프로젝트 폴더 열기:

   ```bash
   code /Users/yechanahn/Code
   ```

2. Claude Code 아이콘 클릭 (왼쪽 사이드바)

3. 새 대화 시작

### 첫 번째 명령어

Claude Code에게 이렇게 말해보세요:

```
안녕! 나는 비개발자인데 MyBlogDaily 서비스를 만들고 싶어.
IMPROVED_PRD.md와 Claude.md 파일을 읽고,
Phase 1 Week 1 개발을 시작해줘.

먼저 Next.js 프로젝트의 기본 폴더 구조를 만들어줘.
모든 코드에 한글 주석을 달아줘.
```

Claude Code가 자동으로:

- 필요한 폴더 생성
- 기본 파일 작성
- 설명과 주석 추가

를 해줄 것입니다!

---

## 🆘 문제가 생겼나요?

### 일반적인 문제 해결

#### 1. "npm: command not found"

**원인**: Node.js가 제대로 설치되지 않음

**해결**:

```bash
# Node.js 재설치
https://nodejs.org 에서 LTS 버전 다운로드

# 설치 후 터미널 재시작
```

#### 2. "Cannot find module"

**원인**: 의존성 설치 실패

**해결**:

```bash
# node_modules 폴더 삭제 후 재설치
rm -rf node_modules
npm install
```

#### 3. "Port 3000 is already in use"

**원인**: 3000 포트를 다른 프로그램이 사용 중

**해결**:

```bash
# Mac/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID번호> /F

# 또는 다른 포트 사용
npm run dev -- -p 3001
```

#### 4. "Environment variables not loaded"

**원인**: .env.local 파일이 없거나 잘못됨

**해결**:

```bash
# 파일 존재 확인
ls -la .env.local

# 파일이 없으면 다시 생성
cp .env.local.example .env.local

# API 키 다시 입력
code .env.local
```

#### 5. API 키 에러

**원인**: API 키가 잘못 입력됨

**해결**:

```bash
# .env.local 파일 열기
code .env.local

# 각 줄 확인:
# ✅ = 앞뒤 공백 없음
# ✅ 따옴표 없음
# ✅ 실제 키 값 확인

# 예시:
ANTHROPIC_API_KEY=sk-ant-실제키
```

---

## 📚 다음에 읽을 문서

설정이 완료되면:

1. **Claude.md** - Claude Code에게 주는 상세한 개발 가이드
2. **IMPROVED_PRD.md** - 전체 프로젝트 요구사항
3. **README.md** - 프로젝트 개요 및 명령어

---

## 💡 팁

### 터미널 명령어 기초

```bash
# 현재 위치 확인
pwd

# 폴더 내용 보기
ls          # Mac/Linux
dir         # Windows

# 폴더 이동
cd 폴더명

# 상위 폴더로 이동
cd ..

# 홈 폴더로 이동
cd ~        # Mac/Linux
cd %USERPROFILE%  # Windows

# 화면 지우기
clear       # Mac/Linux
cls         # Windows
```

### VS Code 단축키

```bash
# 명령 팔레트
Cmd+Shift+P (Mac)
Ctrl+Shift+P (Windows)

# 파일 찾기
Cmd+P (Mac)
Ctrl+P (Windows)

# 저장
Cmd+S (Mac)
Ctrl+S (Windows)

# 터미널 열기
Ctrl+` (공통)
```

---

## ✅ 최종 체크리스트

모든 것이 제대로 작동하는지 확인:

```bash
[ ] Node.js 설치됨 (node --version)
[ ] Git 설치됨 (git --version)
[ ] VS Code 설치됨
[ ] Claude Code 확장 설치됨
[ ] 모든 API 키 발급 완료
[ ] .env.local 파일 생성 및 키 입력 완료
[ ] npm install 성공
[ ] npm run dev 성공
[ ] http://localhost:3000 접속 가능
[ ] Claude Code로 대화 가능
```

모두 체크되었나요? 🎉

**이제 개발을 시작하세요!**

---

**질문이 있으면 Claude Code에게 언제든 물어보세요!** 😊
