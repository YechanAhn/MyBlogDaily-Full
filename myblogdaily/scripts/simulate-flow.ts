/**
 * 전체 플로우 Mock 테스트
 *
 * 환경 변수 없이 전체 플로우를 시뮬레이션합니다.
 */

// Mock 데이터
const mockUser = {
  id: 'test-user-id-12345',
  email: 'test@myblogdaily.com',
  name: '테스트 사용자',
  blog_id: 'test_blog'
};

const mockBlogPosts = [
  {
    title: 'Next.js 14의 새로운 기능',
    content: 'Next.js 14가 출시되었습니다. 서버 컴포넌트가 더욱 강력해졌고...',
    url: 'https://blog.naver.com/test/1',
    publishedAt: '2025-11-01'
  },
  {
    title: 'TypeScript 타입 시스템 완벽 가이드',
    content: 'TypeScript의 타입 시스템은 매우 강력합니다. 제네릭부터 유틸리티 타입까지...',
    url: 'https://blog.naver.com/test/2',
    publishedAt: '2025-11-02'
  },
  {
    title: 'React 18 Concurrent 기능 정리',
    content: 'React 18에서 가장 중요한 기능은 Concurrent 렌더링입니다. Suspense와 함께...',
    url: 'https://blog.naver.com/test/3',
    publishedAt: '2025-11-03'
  }
];

const mockCreativeDNA = {
  metadata: {
    analysis_date: new Date().toISOString(),
    analyzed_post_count: 3
  },
  persona_profile: {
    archetype: '전문가 멘토',
    tone_descriptors: ['정보 제공적', '친근한', '실용적'],
    expertise_level: '전문가'
  },
  stylometry: {
    avg_sentence_length: 25.5,
    lexical_density: 0.65,
    common_phrases: ['그렇기 때문에', '다시 말해', '중요한 점은'],
    punctuation_patterns: {
      exclamation_mark_freq: 5,
      ellipsis_freq: 3
    }
  },
  topic_profile: {
    main_topics: [
      {
        topic_name: '웹 개발',
        sub_topics: [
          {
            name: 'Frontend',
            keywords: ['React', 'Next.js', 'TypeScript']
          },
          {
            name: 'Backend',
            keywords: ['Node.js', 'API', '데이터베이스']
          }
        ]
      }
    ]
  },
  content_needs: {
    type: 'EVERGREEN_IDEAS',
    description: '깊이 있는 기술 설명과 실용적인 예제'
  }
};

const mockCuratedItems = [
  {
    title: 'React 19 베타 출시 소식',
    url: 'https://react.dev/blog/react-19',
    summary: 'React 19 베타가 출시되었습니다. 새로운 Compiler와 함께...',
    source: 'React 공식 블로그',
    publishedAt: '2025-11-10',
    keyword: 'React',
    score: 95,
    type: 'blog' as const
  },
  {
    title: 'TypeScript 5.3 릴리즈',
    url: 'https://devblogs.microsoft.com/typescript',
    summary: 'TypeScript 5.3이 정식 출시되었습니다.',
    source: 'TypeScript 팀',
    publishedAt: '2025-11-09',
    keyword: 'TypeScript',
    score: 90,
    type: 'news' as const
  }
];

const mockDrafts = [
  {
    title: 'React 19와 함께하는 모던 웹 개발',
    content: `React 19 베타가 드디어 출시되었습니다. 그렇기 때문에 이제는 새로운 패러다임으로 개발을 시작할 시점입니다.

## 주요 변경사항

React 19의 가장 중요한 점은 새로운 Compiler입니다. 다시 말해, 이제 수동으로 최적화를 고민할 필요가 없어졌다는 뜻입니다.

### 1. React Compiler

자동으로 메모이제이션을 처리해줍니다. 그렇기 때문에 useMemo나 useCallback을 남발할 필요가 없습니다.

### 2. Server Components

서버 컴포넌트가 더욱 강력해졌습니다. 중요한 점은 이제 클라이언트 번들 크기를 크게 줄일 수 있다는 것입니다.

## 결론

React 19는 개발자 경험을 크게 향상시킵니다. 지금 바로 시작해보세요!`,
    summary: 'React 19 베타의 주요 기능과 변경사항을 살펴봅니다.',
    tags: ['React', 'React19', 'JavaScript', '프론트엔드'],
    estimatedReadTime: 5
  },
  {
    title: 'TypeScript 5.3으로 업그레이드하기',
    content: `TypeScript 5.3이 정식 출시되었습니다. 그렇기 때문에 프로젝트를 업그레이드할 좋은 시기입니다.

## 새로운 기능들

다시 말해, 이번 버전은 타입 시스템의 안정성을 크게 개선했습니다.

### 1. Import Attributes

새로운 import 문법이 추가되었습니다. 중요한 점은 JSON 모듈을 더 안전하게 import할 수 있다는 것입니다.

### 2. 타입 추론 개선

복잡한 제네릭 타입의 추론이 더 정확해졌습니다.

## 마이그레이션 가이드

기존 프로젝트를 업그레이드하는 방법을 알아봅시다.`,
    summary: 'TypeScript 5.3의 새로운 기능과 마이그레이션 방법을 안내합니다.',
    tags: ['TypeScript', 'TypeScript5.3', '타입시스템'],
    estimatedReadTime: 4
  }
];

/**
 * 전체 플로우 시뮬레이션
 */
async function simulateFullFlow() {
  console.log('🚀 MyBlogDaily 전체 플로우 시뮬레이션 시작\n');
  console.log('='.repeat(60));

  // 1. 로그인 시뮬레이션
  console.log('\n📝 Step 1: 네이버 로그인');
  console.log('   → 사용자가 /login 페이지 방문');
  console.log('   → "네이버로 시작하기" 버튼 클릭');
  console.log('   → OAuth 인증 완료');
  console.log(`   ✅ 사용자 생성: ${mockUser.name} (${mockUser.email})`);
  console.log(`   📌 User ID: ${mockUser.id}`);

  await sleep(1);

  // 2. 포스트 수집 시뮬레이션
  console.log('\n📚 Step 2: 블로그 포스트 수집 (크롤링)');
  console.log(`   → 블로그 ID: ${mockUser.blog_id}`);
  console.log('   → RSS 파싱 시작...');
  console.log('   → Playwright로 본문 크롤링...');

  for (let i = 0; i < mockBlogPosts.length; i++) {
    await sleep(0.5);
    console.log(`   📄 [${i + 1}/${mockBlogPosts.length}] ${mockBlogPosts[i].title}`);
  }

  console.log(`   ✅ 총 ${mockBlogPosts.length}개 포스트 수집 완료`);

  await sleep(1);

  // 3. 문체 분석 시뮬레이션
  console.log('\n🧬 Step 3: 문체 DNA 분석');
  console.log('   → 텍스트 분석 중...');
  console.log(`      - 평균 문장 길이: ${mockCreativeDNA.stylometry.avg_sentence_length}자`);
  console.log(`      - 어휘 밀도: ${mockCreativeDNA.stylometry.lexical_density}`);
  console.log(`      - 자주 쓰는 표현: ${mockCreativeDNA.stylometry.common_phrases.join(', ')}`);

  await sleep(1);

  console.log('   → Claude API로 페르소나 분석 중...');
  console.log(`   ✅ 페르소나: ${mockCreativeDNA.persona_profile.archetype}`);
  console.log(`      어조: ${mockCreativeDNA.persona_profile.tone_descriptors.join(', ')}`);
  console.log(`      전문성: ${mockCreativeDNA.persona_profile.expertise_level}`);
  console.log(`      콘텐츠 타입: ${mockCreativeDNA.content_needs.type}`);

  await sleep(1);

  // 4. 큐레이션 시뮬레이션
  console.log('\n🔍 Step 4: 콘텐츠 큐레이션');
  console.log(`   → 전략: ${mockCreativeDNA.content_needs.type}`);
  console.log(`   → 키워드 추출: ${mockCreativeDNA.topic_profile.main_topics[0].sub_topics[0].keywords.join(', ')}`);
  console.log('   → Naver Search API로 검색 중...');

  await sleep(1);

  for (const item of mockCuratedItems) {
    console.log(`   📌 [점수: ${item.score}] ${item.title}`);
    console.log(`      출처: ${item.source} | 키워드: ${item.keyword}`);
  }

  console.log(`   ✅ ${mockCuratedItems.length}개 아이템 큐레이션 완료`);

  await sleep(1);

  // 5. 초안 작성 시뮬레이션
  console.log('\n✍️  Step 5: 블로그 초안 작성 (Claude)');
  console.log('   → 페르소나 적용 중...');
  console.log('   → 문체 모방 중...');
  console.log('   → 큐레이션 콘텐츠 기반 작성 중...');

  await sleep(1.5);

  for (let i = 0; i < mockDrafts.length; i++) {
    console.log(`\n   📝 초안 ${i + 1}:`);
    console.log(`      제목: ${mockDrafts[i].title}`);
    console.log(`      요약: ${mockDrafts[i].summary}`);
    console.log(`      태그: ${mockDrafts[i].tags.join(', ')}`);
    console.log(`      읽기 시간: 약 ${mockDrafts[i].estimatedReadTime}분`);
  }

  console.log(`\n   ✅ ${mockDrafts.length}개 초안 작성 완료`);

  await sleep(1);

  // 6. 이메일 발송 시뮬레이션
  console.log('\n📧 Step 6: 뉴스레터 이메일 발송');
  console.log(`   → 수신자: ${mockUser.email}`);
  console.log('   → HTML 템플릿 생성 중...');
  console.log(`      - 큐레이션: ${mockCuratedItems.length}개 아이템`);
  console.log(`      - 초안: ${mockDrafts.length}개`);

  await sleep(1);

  console.log('   → Resend API로 발송 중...');
  console.log('   ✅ 이메일 발송 완료! 📬');

  await sleep(0.5);

  // 7. 스케줄러 설정 시뮬레이션
  console.log('\n⏰ Step 7: 매일 자동 발송 설정');
  console.log('   → BullMQ 큐에 반복 작업 추가');
  console.log('   → Cron: 0 7 * * * (매일 아침 7시)');
  console.log('   → Upstash Redis 연결');
  console.log('   ✅ 스케줄러 설정 완료!');

  // 최종 요약
  console.log('\n' + '='.repeat(60));
  console.log('\n🎉 전체 플로우 시뮬레이션 완료!\n');

  console.log('📊 결과 요약:');
  console.log(`   ✅ 사용자: ${mockUser.name}`);
  console.log(`   ✅ 수집한 포스트: ${mockBlogPosts.length}개`);
  console.log(`   ✅ 분석된 페르소나: ${mockCreativeDNA.persona_profile.archetype}`);
  console.log(`   ✅ 큐레이션 아이템: ${mockCuratedItems.length}개`);
  console.log(`   ✅ 작성된 초안: ${mockDrafts.length}개`);
  console.log(`   ✅ 이메일 발송: 성공`);
  console.log(`   ✅ 스케줄러: 매일 아침 7시 자동 발송 설정\n`);

  console.log('💡 실제 환경에서는:');
  console.log('   1. 네이버 OAuth로 실제 로그인');
  console.log('   2. Playwright로 실제 블로그 크롤링');
  console.log('   3. Claude API로 실제 AI 분석');
  console.log('   4. Naver Search API로 실제 검색');
  console.log('   5. Resend로 실제 이메일 발송\n');
}

/**
 * Sleep 헬퍼
 */
function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// 실행
simulateFullFlow().catch(console.error);
