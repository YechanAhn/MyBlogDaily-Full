/**
 * 홈 페이지 컴포넌트
 *
 * 이 파일은 웹사이트의 메인 페이지(/)입니다.
 * - 서비스 소개
 * - 주요 기능 설명
 * - 시작하기 버튼
 *
 * URL: http://localhost:3000/
 */

export default function HomePage() {
  return (
    // === 메인 컨테이너 ===
    <div className="container-center py-12">
      {/*
        container-center: 중앙 정렬 (최대 너비 1200px)
        py-12: 위아래 여백 48px
      */}

      {/* === 히어로 섹션 (메인 소개) === */}
      <section className="text-center mb-16">
        {/*
          text-center: 텍스트 중앙 정렬
          mb-16: 아래쪽 여백 64px
        */}

        {/* 메인 제목 */}
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          {/*
            text-5xl: 매우 큰 글자 (48px)
            font-bold: 굵은 글씨
            text-gray-900: 거의 검은색
            mb-6: 아래쪽 여백 24px
          */}
          매일 아침, <span className="text-primary-500">AI가 작성한</span>
          <br />
          블로그 초안을 받아보세요
          {/*
            span 태그로 특정 부분만 색상 변경
            text-primary-500: 네이버 그린 색상
          */}
        </h1>

        {/* 부제목 */}
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          {/*
            text-xl: 큰 글자 (20px)
            text-gray-600: 회색
            mb-8: 아래쪽 여백 32px
            max-w-2xl: 최대 너비 672px
            mx-auto: 좌우 마진 자동 (중앙 정렬)
          */}
          당신의 블로그 문체를 분석하고, 매일 맞춤형 콘텐츠 아이디어와 초안을
          이메일로 전달합니다.
          <br />
          더 이상 무엇을 쓸지 고민하지 마세요.
        </p>

        {/* CTA 버튼 (Call To Action) */}
        <div className="flex gap-4 justify-center">
          {/*
            flex: flexbox 사용
            gap-4: 요소 사이 간격 16px
            justify-center: 가로 중앙 정렬
          */}

          {/* 시작하기 버튼 (메인) */}
          <a
            href="/login"
            className="btn btn-primary text-lg px-8 py-3"
          >
            {/*
              btn btn-primary: globals.css에서 정의한 버튼 스타일
              text-lg: 글자 크기 18px
              px-8: 좌우 여백 32px
              py-3: 위아래 여백 12px
            */}
            🚀 무료로 시작하기
          </a>

          {/* 데모 보기 버튼 (보조) */}
          <a
            href="#features"
            className="btn bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-lg px-8 py-3"
          >
            {/*
              bg-white: 흰색 배경
              border border-gray-300: 회색 테두리
              text-gray-700: 진한 회색 글자
              hover:bg-gray-50: 마우스 올리면 연한 회색 배경
            */}
            📺 기능 보기
          </a>
        </div>
      </section>

      {/* === 주요 기능 섹션 === */}
      <section id="features" className="mb-16">
        {/* 섹션 제목 */}
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          {/*
            text-3xl: 큰 글자 (30px)
            mb-12: 아래쪽 여백 48px
          */}
          어떻게 작동하나요?
        </h2>

        {/* 기능 카드들을 담는 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/*
            grid: CSS Grid 사용
            grid-cols-1: 기본 1열 (모바일)
            md:grid-cols-3: 중간 화면 이상에서 3열 (태블릿, 데스크톱)
            gap-8: 카드 사이 간격 32px
          */}

          {/* 기능 1: 블로그 분석 */}
          <div className="card text-center">
            {/* card: globals.css에서 정의한 카드 스타일 */}

            {/* 아이콘 */}
            <div className="text-5xl mb-4">🔍</div>

            {/* 제목 */}
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              {/*
                text-xl: 20px
                font-semibold: 세미볼드
                mb-3: 아래쪽 여백 12px
              */}
              1. 블로그 분석
            </h3>

            {/* 설명 */}
            <p className="text-gray-600">
              네이버 블로그를 연결하면 AI가 당신의 문체와 주제를 자동으로
              분석합니다.
            </p>
          </div>

          {/* 기능 2: 콘텐츠 큐레이션 */}
          <div className="card text-center">
            <div className="text-5xl mb-4">📰</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              2. 맞춤 큐레이션
            </h3>
            <p className="text-gray-600">
              매일 최신 트렌드와 당신의 관심사에 맞는 콘텐츠를 자동으로
              선별합니다.
            </p>
          </div>

          {/* 기능 3: 초안 작성 */}
          <div className="card text-center">
            <div className="text-5xl mb-4">✍️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              3. 초안 생성
            </h3>
            <p className="text-gray-600">
              당신의 문체로 작성된 블로그 포스트 초안을 매일 아침 이메일로
              받아보세요.
            </p>
          </div>
        </div>
      </section>

      {/* === 통계 섹션 === */}
      <section className="bg-primary-50 rounded-2xl p-12 mb-16">
        {/*
          bg-primary-50: 연한 네이버 그린 배경
          rounded-2xl: 매우 둥근 모서리
          p-12: 모든 방향 여백 48px
        */}

        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            이미 많은 블로거들이 사용하고 있습니다
          </h2>

          {/* 통계 수치들 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* 활성 사용자 수 */}
            <div>
              <div className="text-4xl font-bold text-primary-600 mb-2">
                {/*
                  text-4xl: 36px
                  text-primary-600: 네이버 그린
                */}
                100+
              </div>
              <div className="text-gray-600">활성 블로거</div>
            </div>

            {/* 생성된 초안 수 */}
            <div>
              <div className="text-4xl font-bold text-primary-600 mb-2">
                3,000+
              </div>
              <div className="text-gray-600">생성된 초안</div>
            </div>

            {/* 평균 만족도 */}
            <div>
              <div className="text-4xl font-bold text-primary-600 mb-2">
                4.8/5.0
              </div>
              <div className="text-gray-600">평균 만족도</div>
            </div>
          </div>
        </div>
      </section>

      {/* === CTA 섹션 (마지막 액션 유도) === */}
      <section className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">
          지금 바로 시작해보세요
        </h2>
        <p className="text-xl text-gray-600 mb-8">
          첫 한 달 무료! 신용카드 등록 필요 없음
        </p>
        <a
          href="/login"
          className="btn btn-primary text-lg px-12 py-4"
        >
          {/*
            px-12: 좌우 여백 48px (더 큰 버튼)
            py-4: 위아래 여백 16px
          */}
          네이버로 시작하기 →
        </a>
      </section>
    </div>
  );
}
