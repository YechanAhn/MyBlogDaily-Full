/**
 * 네이버 개발자 센터 Callback URL 확인 스크립트
 */

const { chromium } = require('playwright');

async function checkNaverSettings() {
  console.log('🔍 네이버 개발자 센터 설정 확인 시작...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  try {
    // 1. 네이버 개발자 센터 접속
    console.log('📱 Step 1: 네이버 개발자 센터 접속...');
    await page.goto('https://developers.naver.com/apps/#/myapps', {
      waitUntil: 'load',
      timeout: 30000
    });

    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/naver-dev-01-myapps.png' });
    console.log('📸 스크린샷 저장: screenshots/naver-dev-01-myapps.png\n');

    // 2. 로그인 확인
    const currentUrl = page.url();
    console.log(`   현재 URL: ${currentUrl}\n`);

    if (currentUrl.includes('nid.naver.com')) {
      console.log('⚠️  로그인이 필요합니다!');
      console.log('   브라우저에서 로그인해주세요 (1분 대기)...\n');

      // 로그인 대기 (1분)
      await page.waitForTimeout(60000);

      await page.screenshot({ path: 'screenshots/naver-dev-02-after-login.png' });
      console.log('📸 스크린샷 저장: screenshots/naver-dev-02-after-login.png\n');
    }

    // 3. 애플리케이션 목록에서 CLIENT_ID 찾기
    console.log('📱 Step 2: 애플리케이션 목록에서 UL797Xy__70UXjsZvVQS 찾는 중...');

    await page.waitForTimeout(3000);

    // 페이지 내용 확인
    const pageContent = await page.content();

    if (pageContent.includes('UL797Xy__70UXjsZvVQS')) {
      console.log('✅ 애플리케이션을 찾았습니다!\n');

      // 애플리케이션 클릭 시도
      try {
        // Client ID가 포함된 요소 찾기
        const appElement = await page.locator('text=UL797Xy__70UXjsZvVQS').first();
        await appElement.click();

        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'screenshots/naver-dev-03-app-detail.png' });
        console.log('📸 스크린샷 저장: screenshots/naver-dev-03-app-detail.png\n');

        // 4. API 설정 탭 찾기
        console.log('📱 Step 3: API 설정 확인 중...');

        const apiSettingsTab = await page.locator('text=API 설정').first().catch(() => null);
        if (apiSettingsTab) {
          await apiSettingsTab.click();
          await page.waitForTimeout(2000);
        }

        await page.screenshot({ path: 'screenshots/naver-dev-04-api-settings.png', fullPage: true });
        console.log('📸 스크린샷 저장: screenshots/naver-dev-04-api-settings.png\n');

        // 5. Callback URL 텍스트 찾기
        console.log('📱 Step 4: Callback URL 확인 중...\n');

        const pageText = await page.textContent('body');

        // Callback URL 패턴 찾기
        const callbackUrlMatches = pageText.match(/http:\/\/localhost:\d+\/[^\s]*/g);

        if (callbackUrlMatches) {
          console.log('🔍 발견된 Callback URLs:');
          callbackUrlMatches.forEach(url => {
            console.log(`   - ${url}`);
          });
          console.log('');
        }

        console.log('✅ 모든 스크린샷이 screenshots/ 폴더에 저장되었습니다.');
        console.log('   직접 확인해주세요!\n');

      } catch (error) {
        console.log(`⚠️  애플리케이션 클릭 실패: ${error.message}`);
        console.log('   수동으로 확인이 필요합니다.\n');
      }

    } else {
      console.log('❌ 애플리케이션을 찾을 수 없습니다.');
      console.log('   페이지를 수동으로 확인해주세요.\n');
    }

    // 사용자가 확인할 시간 제공
    console.log('⏳ 30초 후 브라우저를 닫습니다...\n');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('❌ 에러 발생:', error);
    await page.screenshot({ path: 'screenshots/naver-dev-error.png' });
  } finally {
    await browser.close();
    console.log('✅ 브라우저 종료\n');
  }
}

checkNaverSettings().catch(console.error);
