/**
 * Playwright 로그인 테스트 스크립트
 *
 * 이 스크립트는 MyBlogDaily의 로그인 플로우를 자동으로 테스트합니다.
 */

const { chromium } = require('playwright');

async function testLogin() {
  console.log('🚀 Playwright 로그인 테스트 시작...\n');

  // 1. 브라우저 실행
  const browser = await chromium.launch({
    headless: false, // 브라우저 창을 보이게 (디버깅용)
    slowMo: 500, // 각 액션 사이에 0.5초 대기
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  try {
    // 2. 홈페이지 접속 테스트
    console.log('📱 Step 1: 홈페이지 접속 중...');
    await page.goto('http://localhost:3001', { waitUntil: 'load', timeout: 10000 });
    console.log('✅ 홈페이지 로드 완료\n');

    // 홈페이지 스크린샷
    await page.screenshot({ path: 'screenshots/01-homepage.png' });
    console.log('📸 스크린샷 저장: screenshots/01-homepage.png\n');

    // 3. 로그인 페이지로 이동
    console.log('📱 Step 2: 로그인 페이지로 이동 중...');
    await page.goto('http://localhost:3001/login', { waitUntil: 'load', timeout: 10000 });
    console.log('✅ 로그인 페이지 로드 완료\n');

    // 로그인 페이지 스크린샷
    await page.screenshot({ path: 'screenshots/02-login-page.png' });
    console.log('📸 스크린샷 저장: screenshots/02-login-page.png\n');

    // 4. 페이지 내용 확인
    console.log('🔍 Step 3: 페이지 요소 확인 중...\n');

    // 제목 확인
    const title = await page.textContent('h1');
    console.log(`   제목: "${title}"`);

    // 네이버 로그인 버튼 확인
    const naverButton = await page.$('button:has-text("네이버로 시작하기")');
    if (naverButton) {
      console.log('   ✅ "네이버로 시작하기" 버튼 발견\n');
    } else {
      console.log('   ❌ "네이버로 시작하기" 버튼을 찾을 수 없음\n');
    }

    // 5. 콘솔 에러 체크
    console.log('🔍 Step 4: 브라우저 콘솔 에러 확인 중...\n');

    const consoleMessages = [];
    const consoleErrors = [];

    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(text);

      if (msg.type() === 'error') {
        consoleErrors.push(text);
        console.log(`   ❌ 콘솔 에러: ${text}`);
      }
    });

    // 페이지 리로드해서 콘솔 메시지 캡처
    await page.reload({ waitUntil: 'networkidle' });

    await page.waitForTimeout(2000);

    if (consoleErrors.length === 0) {
      console.log('   ✅ 콘솔 에러 없음\n');
    } else {
      console.log(`   ⚠️  총 ${consoleErrors.length}개의 콘솔 에러 발견\n`);
    }

    // 6. 네트워크 에러 체크
    console.log('🔍 Step 5: 네트워크 요청 확인 중...\n');

    const failedRequests = [];

    page.on('requestfailed', (request) => {
      failedRequests.push({
        url: request.url(),
        failure: request.failure(),
      });
      console.log(`   ❌ 요청 실패: ${request.url()}`);
      console.log(`      사유: ${request.failure()?.errorText}\n`);
    });

    // 페이지 리로드
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    if (failedRequests.length === 0) {
      console.log('   ✅ 실패한 네트워크 요청 없음\n');
    } else {
      console.log(`   ⚠️  총 ${failedRequests.length}개의 요청 실패\n`);
    }

    // 7. 네이버 로그인 버튼 클릭 테스트
    console.log('📱 Step 6: 네이버 로그인 API 테스트...');

    // 버튼 클릭 전에 네트워크 대기
    const navigationPromise = page.waitForNavigation({ timeout: 10000 }).catch(() => null);

    try {
      await page.click('button:has-text("네이버로 시작하기")');
      console.log('   ✅ 버튼 클릭 성공\n');

      // 네비게이션 대기
      await navigationPromise;

      const currentUrl = page.url();
      console.log(`   현재 URL: ${currentUrl}\n`);

      if (currentUrl.includes('naver.com')) {
        console.log('   ✅ 네이버 로그인 페이지로 리다이렉트 성공!\n');
        await page.screenshot({ path: 'screenshots/03-naver-login.png' });
        console.log('   📸 스크린샷 저장: screenshots/03-naver-login.png\n');
      } else if (currentUrl.includes('localhost:3001/login?error=')) {
        const errorMatch = currentUrl.match(/error=([^&]+)/);
        const errorMessage = errorMatch ? decodeURIComponent(errorMatch[1]) : '알 수 없는 에러';
        console.log(`   ❌ 로그인 에러 발생: ${errorMessage}\n`);
        await page.screenshot({ path: 'screenshots/03-login-error.png' });
        console.log('   📸 스크린샷 저장: screenshots/03-login-error.png\n');
      } else {
        console.log(`   ⚠️  예상치 못한 URL로 이동: ${currentUrl}\n`);
        await page.screenshot({ path: 'screenshots/03-unexpected-url.png' });
        console.log('   📸 스크린샷 저장: screenshots/03-unexpected-url.png\n');
      }
    } catch (error) {
      console.log(`   ❌ 버튼 클릭 또는 네비게이션 실패: ${error.message}\n`);
      await page.screenshot({ path: 'screenshots/03-click-error.png' });
      console.log('   📸 스크린샷 저장: screenshots/03-click-error.png\n');
    }

    // 8. 최종 스크린샷
    await page.screenshot({ path: 'screenshots/04-final.png', fullPage: true });
    console.log('📸 전체 페이지 스크린샷 저장: screenshots/04-final.png\n');

    console.log('=' .repeat(60));
    console.log('📊 테스트 결과 요약:');
    console.log('=' .repeat(60));
    console.log(`콘솔 에러: ${consoleErrors.length}개`);
    console.log(`네트워크 에러: ${failedRequests.length}개`);
    console.log(`스크린샷: screenshots/ 폴더에 저장됨`);
    console.log('=' .repeat(60));

    // 10초 대기 (사용자가 확인할 수 있도록)
    console.log('\n⏳ 10초 후 브라우저를 닫습니다...\n');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ 테스트 중 에러 발생:', error);
    await page.screenshot({ path: 'screenshots/error.png' });
    console.log('📸 에러 스크린샷 저장: screenshots/error.png\n');
  } finally {
    await browser.close();
    console.log('✅ 브라우저 종료\n');
  }
}

// 실행
testLogin().catch(console.error);
