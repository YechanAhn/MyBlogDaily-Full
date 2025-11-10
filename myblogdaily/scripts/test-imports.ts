/**
 * 모듈 import 테스트
 *
 * 모든 주요 모듈이 제대로 import되는지 확인합니다.
 */

console.log('🧪 모듈 import 테스트 시작...\n');

async function testImports() {
  const results: Array<{ module: string; status: 'success' | 'failed'; error?: string }> = [];

  // 1. 유틸리티
  try {
    const utils = await import('../lib/utils');
    console.log('✅ lib/utils');
    results.push({ module: 'lib/utils', status: 'success' });
  } catch (error) {
    console.log('❌ lib/utils:', error);
    results.push({ module: 'lib/utils', status: 'failed', error: String(error) });
  }

  // 2. AI 모듈
  try {
    const ai = await import('../lib/ai');
    console.log('✅ lib/ai');
    results.push({ module: 'lib/ai', status: 'success' });
  } catch (error) {
    console.log('❌ lib/ai:', error);
    results.push({ module: 'lib/ai', status: 'failed', error: String(error) });
  }

  // 3. 큐레이션 모듈
  try {
    const curation = await import('../lib/curation');
    console.log('✅ lib/curation');
    results.push({ module: 'lib/curation', status: 'success' });
  } catch (error) {
    console.log('❌ lib/curation:', error);
    results.push({ module: 'lib/curation', status: 'failed', error: String(error) });
  }

  // 4. 이메일 모듈
  try {
    const email = await import('../lib/email');
    console.log('✅ lib/email');
    results.push({ module: 'lib/email', status: 'success' });
  } catch (error) {
    console.log('❌ lib/email:', error);
    results.push({ module: 'lib/email', status: 'failed', error: String(error) });
  }

  // 5. 스케줄러 모듈
  try {
    const scheduler = await import('../lib/scheduler');
    console.log('✅ lib/scheduler');
    results.push({ module: 'lib/scheduler', status: 'success' });
  } catch (error) {
    console.log('❌ lib/scheduler:', error);
    results.push({ module: 'lib/scheduler', status: 'failed', error: String(error) });
  }

  // 6. 크롤러 모듈
  try {
    const crawler = await import('../lib/crawler');
    console.log('✅ lib/crawler');
    results.push({ module: 'lib/crawler', status: 'success' });
  } catch (error) {
    console.log('❌ lib/crawler:', error);
    results.push({ module: 'lib/crawler', status: 'failed', error: String(error) });
  }

  // 결과 요약
  console.log('\n' + '='.repeat(50));
  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;

  console.log(`\n📊 테스트 결과: ${successful}/${results.length} 성공`);

  if (failed > 0) {
    console.log(`\n❌ 실패한 모듈 (${failed}개):`);
    results
      .filter(r => r.status === 'failed')
      .forEach(r => {
        console.log(`   - ${r.module}`);
        if (r.error) {
          console.log(`     ${r.error.substring(0, 100)}...`);
        }
      });
    process.exit(1);
  } else {
    console.log('\n✅ 모든 모듈 import 성공!');
    process.exit(0);
  }
}

testImports().catch(error => {
  console.error('\n💥 테스트 중 에러 발생:', error);
  process.exit(1);
});
