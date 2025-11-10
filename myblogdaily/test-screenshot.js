/**
 * Playwright 스크린샷 테스트 스크립트
 *
 * 이 스크립트는 다음을 테스트합니다:
 * 1. Playwright가 제대로 설치되었는지
 * 2. 브라우저 실행이 가능한지
 * 3. 페이지 스크린샷 캡처가 작동하는지
 * 4. 네이버 블로그 페이지 접근 및 캡처 (크롤링 시뮬레이션)
 */

const { chromium } = require('playwright');

async function testScreenshot() {
  console.log('🚀 Playwright 스크린샷 테스트 시작...\n');

  let browser;

  try {
    // 1. 브라우저 실행 (헤드리스 모드)
    console.log('📦 브라우저 실행 중...');
    browser = await chromium.launch({
      headless: true, // 백그라운드에서 실행
    });
    console.log('✅ 브라우저 실행 성공!\n');

    // 2. 새 페이지 생성
    console.log('📄 새 페이지 생성 중...');
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 }, // 화면 크기 설정
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', // 실제 브라우저처럼 보이게
    });
    console.log('✅ 페이지 생성 성공!\n');

    // 3. 테스트 1: 네이버 메인 페이지 스크린샷
    console.log('🌐 테스트 1: 네이버 메인 페이지 접속...');
    await page.goto('https://www.naver.com', {
      waitUntil: 'networkidle', // 네트워크 요청이 끝날 때까지 대기
      timeout: 30000, // 30초 타임아웃
    });

    await page.screenshot({
      path: 'screenshot-naver-main.png',
      fullPage: true, // 전체 페이지 캡처
    });
    console.log('✅ 네이버 메인 페이지 스크린샷 저장: screenshot-naver-main.png\n');

    // 4. 테스트 2: 네이버 블로그 페이지 스크린샷
    console.log('📝 테스트 2: 네이버 블로그 페이지 접속...');
    await page.goto('https://blog.naver.com', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // 2초 대기 (페이지가 완전히 로드되도록)
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'screenshot-naver-blog.png',
      fullPage: true,
    });
    console.log('✅ 네이버 블로그 페이지 스크린샷 저장: screenshot-naver-blog.png\n');

    // 5. 테스트 3: 특정 블로그 포스트 접속 시뮬레이션
    console.log('📰 테스트 3: 예시 블로그 포스트 접속...');
    // 네이버 공식 블로그를 예시로 사용
    await page.goto('https://blog.naver.com/naver_diary', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'screenshot-blog-example.png',
      fullPage: false, // 첫 화면만 캡처
    });
    console.log('✅ 블로그 포스트 스크린샷 저장: screenshot-blog-example.png\n');

    // 6. 페이지 정보 출력
    console.log('📊 페이지 정보:');
    const title = await page.title();
    const url = page.url();
    console.log(`   제목: ${title}`);
    console.log(`   URL: ${url}\n`);

    console.log('🎉 모든 테스트 완료!\n');
    console.log('📸 생성된 스크린샷 파일:');
    console.log('   - screenshot-naver-main.png');
    console.log('   - screenshot-naver-blog.png');
    console.log('   - screenshot-blog-example.png');

  } catch (error) {
    // 에러 발생 시 상세 정보 출력
    console.error('\n❌ 에러 발생:', error.message);
    console.error('상세 에러 정보:', error);

    // 에러 발생 시 스크린샷 캡처 시도
    try {
      if (browser) {
        const pages = await browser.contexts()[0]?.pages();
        if (pages && pages.length > 0) {
          await pages[0].screenshot({
            path: 'screenshot-error.png',
          });
          console.log('📸 에러 발생 시점의 스크린샷 저장: screenshot-error.png');
        }
      }
    } catch (screenshotError) {
      console.error('에러 스크린샷 저장 실패:', screenshotError.message);
    }

  } finally {
    // 브라우저 종료 (항상 실행)
    if (browser) {
      console.log('\n🔒 브라우저 종료 중...');
      await browser.close();
      console.log('✅ 브라우저 종료 완료!');
    }
  }
}

// 스크립트 실행
testScreenshot().catch(error => {
  console.error('치명적 에러:', error);
  process.exit(1);
});
