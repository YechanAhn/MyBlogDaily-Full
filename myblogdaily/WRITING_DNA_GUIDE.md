# ✍️ 문체 DNA 분석 가이드

> Phase 1 Week 3 완료: 텍스트 분석 + Claude API 페르소나 분석

---

## ✅ 구현 완료

### 1. 텍스트 분석기 (`lib/ai/text-analyzer.ts`)
한국어 텍스트의 기본 통계를 계산합니다.

**기능:**
- ✅ 평균 문장 길이 계산
- ✅ 어휘 밀도 계산 (고유 단어 / 전체 단어)
- ✅ 자주 사용하는 표현 추출 (N-gram)
- ✅ 문장 부호 사용 패턴 (느낌표, 말줄임표, 물음표)
- ✅ 문단 수, 단어 수 통계

**사용 예시:**
```typescript
import { textAnalyzer } from '@/lib/ai';

const posts = ['포스트 1', '포스트 2', '포스트 3'];
const metrics = textAnalyzer.analyzeStyle(posts);

console.log(`평균 문장 길이: ${metrics.avgSentenceLength}자`);
console.log(`어휘 밀도: ${metrics.lexicalDensity}`);
console.log(`자주 사용하는 표현: ${metrics.commonPhrases.join(', ')}`);
```

---

### 2. Claude 분석기 (`lib/ai/claude-analyzer.ts`)
Claude API를 사용하여 블로거의 창작 DNA를 추출합니다.

**분석 항목:**

#### 1) 페르소나 프로필
- **Archetype (원형)**: 전문가 멘토, 친한 친구, 객관적 기자 등
- **Tone Descriptors (어조)**: 정보 제공적, 친근한, 유머러스한 등 3-5개
- **Expertise Level (전문성)**: 초보자, 중급자, 전문가

#### 2) 문체론 (Stylometry)
- 평균 문장 길이
- 어휘 밀도
- 자주 사용하는 표현
- 문장 부호 패턴

#### 3) 토픽 프로필
- **Main Topics (메인 토픽)**: 2-3개
- **Sub Topics (하위 토픽)**: 각 메인 토픽당 여러 개
- **Keywords (키워드)**: 각 하위 토픽당 5개 이상

#### 4) 콘텐츠 니즈
- **NEWS_DRIVEN**: 시의성 중요 (부동산, 주식, IT 트렌드)
- **EVERGREEN_IDEAS**: 깊이 있는 정보 중요 (요리, 육아, 자기계발)

**사용 예시:**
```typescript
import { claudeAnalyzer } from '@/lib/ai';

const posts = ['포스트 1', '포스트 2', ...];  // 최소 10개
const creativeDNA = await claudeAnalyzer.analyzeCreativeDNA(posts);

console.log(`페르소나: ${creativeDNA.persona_profile.archetype}`);
console.log(`어조: ${creativeDNA.persona_profile.tone_descriptors.join(', ')}`);
console.log(`콘텐츠 타입: ${creativeDNA.content_needs.type}`);
```

---

### 3. 문체 DNA 분석 API (`app/api/analyze-dna/route.ts`)
블로그 포스트를 분석하여 창작 DNA를 추출하고 DB에 저장합니다.

**플로우:**
```
1. 사용자의 blog_posts 조회 (최대 50개)
   ↓
2. 텍스트 통계 분석
   ↓
3. Claude API로 창작 DNA 추출
   ↓
4. writing_dna 테이블에 저장 (upsert)
   ↓
5. blog_posts의 is_analyzed 플래그 업데이트
```

**API 사용:**
```bash
# POST /api/analyze-dna
curl -X POST http://localhost:3000/api/analyze-dna \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "uuid-here",
    "forceReanalyze": false
  }'
```

**응답 예시:**
```json
{
  "success": true,
  "creativeDNA": {
    "metadata": {
      "analysis_date": "2025-11-10T00:00:00Z",
      "analyzed_post_count": 50
    },
    "persona_profile": {
      "archetype": "전문가 멘토",
      "tone_descriptors": ["정보 제공적", "친근한", "열정적"],
      "expertise_level": "전문가"
    },
    "stylometry": {
      "avg_sentence_length": 45.2,
      "lexical_density": 0.382,
      "common_phrases": ["중요합니다", "생각합니다"],
      "punctuation_patterns": {
        "exclamation_mark_freq": 2.5,
        "ellipsis_freq": 1.2
      }
    },
    "topic_profile": {
      "main_topics": [
        {
          "topic_name": "웹 개발",
          "sub_topics": [
            {
              "sub_topic_name": "React",
              "keywords": ["컴포넌트", "훅", "상태관리", "JSX", "Props"]
            }
          ]
        }
      ]
    },
    "content_needs": {
      "type": "NEWS_DRIVEN"
    }
  },
  "isNew": true
}
```

---

## 🚀 사용 방법

### 1. 환경 변수 확인
`.env.local`에 Claude API 키가 있는지 확인:
```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 2. 포스트 수집 먼저
문체 분석 전에 반드시 포스트를 수집해야 합니다:
```bash
curl -X POST http://localhost:3000/api/collect-posts \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "uuid",
    "blogId": "blog-id",
    "limit": 50
  }'
```

### 3. 문체 분석 실행
```bash
curl -X POST http://localhost:3000/api/analyze-dna \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "uuid"
  }'
```

### 4. 결과 확인
Supabase `writing_dna` 테이블에서 확인하거나, API 응답으로 확인.

---

## 📊 프로젝트 구조

```
lib/ai/
├── types.ts             # 타입 정의 (CreativeDNA 등)
├── text-analyzer.ts     # 텍스트 통계 분석
├── claude-analyzer.ts   # Claude API 창작 DNA 분석
└── index.ts            # 통합 export

app/api/analyze-dna/
└── route.ts            # 문체 DNA 분석 API
```

---

## 🔧 설정 옵션

### ClaudeAnalysisOptions
```typescript
{
  model?: string;           // 기본: 'claude-sonnet-4-5-20250929'
  maxTokens?: number;       // 기본: 4096
  temperature?: number;     // 기본: 0.3 (낮을수록 일관성 높음)
}
```

**커스텀 옵션 사용:**
```typescript
const creativeDNA = await claudeAnalyzer.analyzeCreativeDNA(posts, null, {
  temperature: 0.5,
  maxTokens: 8192
});
```

---

## 💡 프롬프트 엔지니어링

### Sub_Agent_Prompt 사용
`claude-analyzer.ts`는 `Sub_Agent_Prompt.txt`의 "창작 DNA 분석 에이전트" 프롬프트를 사용합니다.

**프롬프트 구조:**
1. **MISSION**: AI의 역할 정의 (창작 DNA 분석가)
2. **INPUT DATA**: 블로그 포스트 + 사전 계산된 통계
3. **INSTRUCTIONS**: 3단계 분석 과정
   - 1단계: 페르소나 및 문체 분석
   - 2단계: 주제 및 토픽 분석
   - 3단계: 콘텐츠 요구사항 분류
4. **OUTPUT FORMAT**: JSON 형식 명시

**프롬프트 개선 팁:**
- 예시 추가로 정확도 향상
- Few-shot Learning 적용
- Temperature 조정 (0.3-0.7)

---

## ⚠️ 중요 사항

### 1. 최소 포스트 수
- ✅ **최소 10개** 이상의 포스트 필요
- ✅ **권장: 30-50개** (더 정확한 분석)
- ❌ 10개 미만: 에러 발생

### 2. Claude API 비용
- **모델**: Claude Sonnet 4.5
- **예상 토큰**: 입력 ~20-50K, 출력 ~1K
- **예상 비용**: 분석당 $0.5-$1.5
- **최적화**: 포스트 샘플링 (최대 100,000자)

### 3. 재분석
```bash
# 기존 분석 무시하고 재분석
curl -X POST http://localhost:3000/api/analyze-dna \
  -d '{"userId": "uuid", "forceReanalyze": true}'
```

### 4. 에러 처리
```typescript
try {
  const creativeDNA = await claudeAnalyzer.analyzeCreativeDNA(posts);
} catch (error) {
  if (error.message.includes('token')) {
    // API 한도 초과
  } else if (error.message.includes('parse')) {
    // JSON 파싱 실패
  }
}
```

---

## 📈 성능

### 예상 수치 (50개 포스트 기준)
- **텍스트 분석**: 1-2초
- **Claude API 호출**: 10-30초
- **DB 저장**: 1초
- **총 소요 시간**: 15-35초
- **메모리 사용**: 100-200MB

### 최적화 팁
1. **캐싱**: 이미 분석된 경우 DB에서 조회
2. **샘플링**: 100,000자 이상은 샘플링
3. **병렬 처리**: 여러 사용자 동시 분석 가능

---

## 🐛 문제 해결

### 1. "ANTHROPIC_API_KEY not found"
```bash
# .env.local에 키 추가
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 2. "최소 10개 이상의 포스트가 필요합니다"
```bash
# 먼저 포스트 수집
POST /api/collect-posts
```

### 3. "Claude API 요청 한도 초과"
- API 플랜 업그레이드 필요
- 또는 잠시 대기 후 재시도

### 4. "JSON 파싱 실패"
- Claude 응답 형식 문제
- 프롬프트 개선 또는 temperature 조정
- 로그 확인: `console.log(responseText)`

---

## 🔄 다음 단계: Phase 1 Week 4

문체 분석 완료 후 **큐레이션 + 초안 작성**:

1. **네이버 검색 API 연동**
   - creativeDNA의 토픽 기반 뉴스 검색
   - content_needs.type에 따라 전략 다르게

2. **Claude로 초안 작성**
   - creativeDNA의 페르소나 반영
   - 문체 그대로 모방

3. **이메일 발송**
   - Resend API 사용
   - 매일 아침 7시 자동 발송

4. **BullMQ 스케줄링**
   - Upstash Redis 큐
   - Cron 작업

---

## 📚 참고 문서

- [Sub_Agent_Prompt.txt](../Sub_Agent_Prompt.txt) - 창작 DNA 프롬프트
- [IMPROVED_PRD.md](../IMPROVED_PRD.md) - 문체 분석 전략
- [Claude API 문서](https://docs.anthropic.com)

---

## 💡 활용 예시

### 창작 DNA 기반 콘텐츠 추천
```typescript
import { createClient } from '@/lib/supabase/server';

const supabase = createClient();

const { data: dna } = await supabase
  .from('writing_dna')
  .select('creative_dna')
  .eq('user_id', userId)
  .single();

if (dna.creative_dna.content_needs.type === 'NEWS_DRIVEN') {
  // 최신 뉴스 큐레이션
  await fetchLatestNews(dna.creative_dna.topic_profile.main_topics);
} else {
  // 에버그린 아이디어 큐레이션
  await fetchEvergreenIdeas(dna.creative_dna.topic_profile.main_topics);
}
```

### 문체 그대로 글쓰기
```typescript
const prompt = `
당신은 다음과 같은 문체로 글을 작성하는 블로거입니다:
- 페르소나: ${dna.persona_profile.archetype}
- 어조: ${dna.persona_profile.tone_descriptors.join(', ')}
- 자주 사용하는 표현: ${dna.stylometry.common_phrases.join(', ')}

다음 주제로 블로그 포스트를 작성하세요: {주제}
`;
```

---

**✅ Phase 1 Week 3 완료!**

이제 블로거의 고유한 문체와 관심사를 AI가 학습했습니다. 다음은 큐레이션 + 초안 작성 (Week 4)입니다! 🎉

궁금한 점이 있으면 언제든 물어보세요! 😊
