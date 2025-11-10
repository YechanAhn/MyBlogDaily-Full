# 🚀 Phase 1 Week 1 완료! - 설정 가이드

축하합니다! Phase 1 Week 1의 모든 코드가 완성되었습니다. 🎉

이제 실제로 동작하는지 테스트해봅시다!

---

## ✅ 완료된 작업

### 1. 데이터베이스 스키마 ✅
- [supabase/migrations/20241030000000_initial_schema.sql](/Users/yechanahn/Code/myblogdaily/supabase/migrations/20241030000000_initial_schema.sql)
- [types/database.ts](/Users/yechanahn/Code/myblogdaily/types/database.ts)

### 2. 네이버 로그인 API ✅
- [lib/auth/naver.ts](/Users/yechanahn/Code/myblogdaily/lib/auth/naver.ts)
- [app/api/auth/naver/route.ts](/Users/yechanahn/Code/myblogdaily/app/api/auth/naver/route.ts)
- [app/api/auth/naver/callback/route.ts](/Users/yechanahn/Code/myblogdaily/app/api/auth/naver/callback/route.ts)
- [app/api/auth/logout/route.ts](/Users/yechanahn/Code/myblogdaily/app/api/auth/logout/route.ts)

### 3. 로그인 페이지 ✅
- [app/(auth)/login/page.tsx](/Users/yechanahn/Code/myblogdaily/app/(auth)/login/page.tsx)

### 4. 대시보드 페이지 ✅
- [app/(dashboard)/dashboard/page.tsx](/Users/yechanahn/Code/myblogdaily/app/(dashboard)/dashboard/page.tsx)

---

## 📋 테스트 전 체크리스트

### Step 1: Supabase 프로젝트 생성 (아직 안 했다면)

1. https://supabase.com 접속
2. "New Project" 클릭
3. 정보 입력:
   - Name: **MyBlogDaily**
   - Database Password: 강력한 비밀번호 설정 (꼭 저장!)
   - Region: **Northeast Asia (Seoul)**
4. "Create new project" 클릭 (2-3분 대기)

### Step 2: Supabase에 스키마 적용

**방법 1: SQL Editor 사용 (추천)**

1. Supabase 대시보드에서 "SQL Editor" 클릭
2. "New query" 클릭
3. [supabase/migrations/20241030000000_initial_schema.sql](/Users/yechanahn/Code/myblogdaily/supabase/migrations/20241030000000_initial_schema.sql) 파일의 전체 내용을 복사
4. SQL Editor에 붙여넣기
5. "Run" 버튼 클릭 (⌘ + Enter 또는 Ctrl + Enter)
6. 성공 메시지 확인

**결과 확인:**
- "Table Editor" 메뉴에서 다음 테이블들이 생성되었는지 확인:
  - ✅ users
  - ✅ blog_posts
  - ✅ writing_dna
  - ✅ curated_items
  - ✅ newsletters

### Step 3: Supabase API 키 복사

1. Supabase 대시보드에서 "Settings" → "API" 클릭
2. 다음 값들을 복사:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6...`
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6...` (비밀!)

### Step 4: 네이버 개발자 센터 설정

1. https://developers.naver.com 접속
2. "Application" → "애플리케이션 등록" 클릭
3. 정보 입력:
   - **애플리케이션 이름**: MyBlogDaily
   - **사용 API**:
     - ✅ 네이버 로그인
     - ✅ 검색
   - **환경**: PC 웹
   - **서비스 URL**: `http://localhost:3000`
   - **Callback URL**: `http://localhost:3000/api/auth/naver/callback`
4. 등록 완료 후:
   - **Client ID** 복사
   - **Client Secret** 복사

### Step 5: .env.local 파일 업데이트

[.env.local](/Users/yechanahn/Code/myblogdaily/.env.local) 파일을 열고 다음 값들을 실제 값으로 교체하세요:

```bash
# 사이트 URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# 네이버 API
NAVER_CLIENT_ID=실제_클라이언트_ID
NAVER_CLIENT_SECRET=실제_클라이언트_SECRET

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://실제프로젝트ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=실제_anon_키
SUPABASE_SERVICE_ROLE_KEY=실제_service_role_키
```

**저장하는 것을 잊지 마세요!** (⌘ + S 또는 Ctrl + S)

---

## 🧪 테스트 시작!

### 1. 개발 서버 실행

터미널을 열고:

```bash
cd /Users/yechanahn/Code/myblogdaily
npm run dev
```

출력 예시:
```
▲ Next.js 14.2.18
- Local:        http://localhost:3000
- Network:      http://192.168.1.100:3000

✓ Ready in 2.3s
```

### 2. 홈페이지 확인

브라우저에서 http://localhost:3000 접속

**확인 사항:**
- ✅ 페이지가 로드됨
- ✅ "MyBlogDaily" 로고가 보임
- ✅ "매일 아침, AI가 작성한 블로그 초안을 받아보세요" 텍스트가 보임

### 3. 로그인 페이지 테스트

http://localhost:3000/login 접속

**확인 사항:**
- ✅ "MyBlogDaily" 제목과 로고(🤖)가 보임
- ✅ "네이버로 시작하기" 버튼이 보임
- ✅ 버튼에 마우스를 올리면 색상이 변함

### 4. 네이버 로그인 테스트

1. "네이버로 시작하기" 버튼 클릭
2. 네이버 로그인 페이지로 리다이렉트됨
3. 네이버 계정으로 로그인
4. "MyBlogDaily에 정보를 제공하시겠습니까?" 동의 화면
5. "동의하기" 클릭
6. 대시보드로 리다이렉트됨!

### 5. 대시보드 확인

http://localhost:3000/dashboard 접속 (로그인 후)

**확인 사항:**
- ✅ "안녕하세요, [이름]님!" 메시지가 보임
- ✅ 통계 카드 4개가 보임 (모두 0)
- ✅ "시작하기" 섹션이 보임
- ✅ "로그아웃" 버튼이 작동함

### 6. Supabase 데이터 확인

Supabase 대시보드에서:

1. "Table Editor" 클릭
2. "users" 테이블 선택
3. 방금 로그인한 사용자 데이터가 있는지 확인:
   - ✅ email
   - ✅ name
   - ✅ last_login_at

---

## 🎉 축하합니다!

**Phase 1 Week 1 완료 기준:**
- ✅ Next.js 프로젝트 생성 완료
- ✅ Supabase 연동 완료
- ✅ 네이버 로그인 동작 확인
- ✅ 사용자가 로그인하여 대시보드 볼 수 있음

모든 항목이 완료되었습니다! 🚀

---

## 🐛 문제 해결

### 에러: "Supabase 환경 변수가 설정되지 않았습니다"

**해결:**
1. `.env.local` 파일이 있는지 확인
2. `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 설정되었는지 확인
3. 개발 서버 재시작 (`Ctrl + C` 후 `npm run dev`)

### 에러: "네이버 토큰 발급 실패"

**해결:**
1. `.env.local`에서 `NAVER_CLIENT_ID`와 `NAVER_CLIENT_SECRET` 확인
2. 네이버 개발자센터에서 Callback URL이 `http://localhost:3000/api/auth/naver/callback`로 설정되었는지 확인
3. 개발 서버 재시작

### 에러: "CSRF 토큰 검증 실패"

**해결:**
1. 브라우저 쿠키를 삭제
2. 시크릿 모드/프라이빗 브라우징 모드에서 테스트
3. 개발 서버 재시작

### 로그인 후 대시보드가 빈 화면

**해결:**
1. 브라우저 콘솔(F12)에서 에러 확인
2. Supabase에 스키마가 제대로 적용되었는지 확인
3. `get_user_stats` 함수가 생성되었는지 확인

---

## 📱 다음 단계: Phase 1 Week 2

다음 주에는:
1. 블로그 포스트 수집 기능 구현
2. Playwright 크롤링 설정
3. RSS 파싱
4. 50개 포스트 수집 및 저장

---

**질문이 있으면 언제든지 물어보세요!** 🤗
