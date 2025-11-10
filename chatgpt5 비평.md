#IMPROVED_PRD.md 를 비평적으로 분석하고 더 나은 대안이 있으면 반영해줘 특히 크롤링 부분에서 차단당하지 않도록 하는 부분과, 각 sub agent의 프롬프트, 문체분석 방법 등을 집중적으로 

요청하신 PRD는 방향성이 타당하지만, 차단 회피와 데이터 접근 경로를 재설계하면 안정성과 지속성이 크게 향상됩니다. 핵심 개선안은 RSS-first 수집으로 링크 목록을 확보하고, 모바일 페이지로 본문을 파싱하며, 세션형 프록시·스텔스 조합으로 탐지 신호를 낮추고, 서브 에이전트 프롬프트를 과업 단위로 세분화하는 것입니다.[^1][^2][^3][^4]

### 핵심 개선 요약

- 링크 수집은 블로그 RSS 피드를 1차 소스로 사용해 최신 30개 포스트의 안정적 URL 인덱스를 구성하고, 이후 본문·메타 수집은 페이지 렌더링으로 진행합니다.[^5][^6]
- 본문 파싱은 데스크톱의 mainFrame iframe 대신 모바일 페이지로 전환해 DOM 접근을 단순화하는 것을 기본 경로로 채택합니다.[^2][^7]
- 차단 회피는 세션형 프록시 로테이션+브라우저 스텔스+인간형 타이밍 3축으로 구성하되, navigator.webdriver와 Headless 표식 제거의 한계를 인지하고 유지보수 가능한 우회만 채택합니다.[^3][^8]
- 운영은 Apify의 스케줄링·모니터링·프록시 관리로 외부화해 MTTR을 줄이고, 실패 세션 격리와 회복을 표준화합니다.[^9][^10]


### 차단 회피 설계

- RSS-first 경로: 네이버 블로그는 공식적으로 RSS 피드를 제공하므로 rss.blog.naver.com/{아이디}.xml 형태로 최신 글 목록을 안정적으로 취득하고, 무한스크롤 의존도를 제거합니다.[^11][^5]
- 모바일 페이지 우선: 데스크톱은 mainFrame iframe 내부에 실제 본문이 존재해 자동화 풋프린트를 키우므로, 크롬 확장 사례처럼 모바일 웹으로 전환해 단순 DOM 파싱을 기본값으로 설정합니다.[^7][^2]
- 스텔스 적용과 한계: playwright-stealth 계열로 기본적인 자동화 지표(HeadlessChrome, navigator.webdriver 등)를 감춥니다만, Chromium의 구조적 조건 때문에 webdriver를 완전히 숨기기 어렵다는 점을 정책적으로 명시합니다.[^12][^8]
- 세션형 프록시: Apify Proxy 및 SessionPool로 IP를 단순 라운드로빈이 아닌 세션 단위로 유지·교체하여 인간형 행동에 근접하게 하고, 과사용/에러 세션을 즉시 폐기합니다.[^4][^13]
- 인간형 타이밍: 정밀 고정 주기 대신 랜덤화된 간격과 단계별 인터랙션으로 탐지 시그널을 낮추는 패턴을 적용합니다(스텔스 가이드라인의 휴리스틱 회피 권장과 결합).[^14][^3]


### 서브 에이전트 설계와 프롬프트

- 링크 인덱서: “주어진 네이버 블로그 ID의 RSS에서 최신 30개 아이템의 제목·링크·발행일을 파싱해 정규화된 포스트 URL 리스트를 반환하라”처럼 RSS 전용 파이프라인을 분리합니다.[^1][^11]
- 본문 파서(모바일 우선): “모바일 블로그 포스트 URL로 이동→필요시 스크롤→제목·본문 컨테이너가 로드될 때까지 대기 후 텍스트 추출→None-safe 에러 처리” 형태로 명시합니다.[^2][^7]
- 데스크톱 폴백(iFrame): “\#mainFrame 로드까지 대기→프레임 컨텍스트 전환→타깃 셀렉터 대기 후 추출”을 표준 시퀀스로 정의합니다.[^15][^2]
- 스텔스/세션 매니저: “플레이wright 컨텍스트 생성 시 UA 랜덤·stealth 적용·세션형 프록시 발급·세션별 쿠키 유지·임계 오류 시 세션 폐기”를 정책으로 고정합니다.[^13][^12]
- 오케스트레이터: “Apify로 스케줄·실패 재시도·실행 로그·프록시 그룹 선택·건강 모니터링을 구성”해 운영을 코드 밖으로 분리합니다.[^10][^9]


### 구현 디테일 보완

- 모바일 전환 기본값: 환경/테마 차단 시 폴백으로 데스크톱 iFrame 경로를 유지하되, 1순위는 모바일 DOM 파싱으로 설정합니다.[^7][^2]
- iFrame 전환 패턴: 페이지 로드 후 mainFrame 존재 대기→프레임 전환→필드 추출→오류 시 기본 컨텍스트 복귀를 재사용 가능한 유틸로 캡슐화합니다.[^15][^2]
- webdriver 한계 고지: Chromium이 특정 플래그·파이프 조건에서 navigator.webdriver를 true로 노출하므로 완전 은닉을 전제한 설계를 지양합니다.[^8]
- 스텔스 우선순위: Headless 표식과 UA·플러그인·미디어 캐패빌리티 등 표준 지표를 우선 완화하고 라이브러리 업데이트로 추적 위험을 낮춥니다.[^3]
- 세션형 로테이션: SessionPool을 활성화하고 maxUsageCount·maxErrorScore 정책으로 세션 수명주기를 관리해 블록 신호 축적을 분산합니다.[^4][^13]


### 문체 분석 방법

- 코퍼스 구성: RSS로 최신 30개 링크를 안정적으로 확보한 뒤, 각 본문과 메타를 페이지 파싱으로 보강해 분석 입력을 일관화합니다.[^1][^2]
- 분석 초점: 제목·본문에 집중하되 플랫폼 규모상 트렌드 추정에 유의미한 밀도 확보가 가능함을 전제로, 통일된 정제 규칙과 시간축 지표화를 설계합니다.[^16]


### 데이터 항목 보정

- 본문/제목: 모바일 DOM을 1순위로, 실패 시 데스크톱 iFrame 경로에서 셀렉터 대기 후 추출합니다.[^2][^7]
- 날짜/URL: RSS의 발행일과 링크를 정규화해 기준값으로 사용하고, 페이지에서 확인된 값과 상호 검증합니다.[^11][^1]
- 조회/공감/댓글: RSS에는 요약만 포함되므로 페이지 렌더링 후 DOM에 표기된 수치를 안전 추출하며, 실패 시 None-safe로 저장합니다.[^1][^2]


### 운영·윤리 가이드

- 스케줄링과 모니터링: Apify의 스케줄러·웹훅·런 기록으로 실패 재시작과 알림을 표준화합니다.[^10]
- 프록시 정책: Apify Proxy에서 거주형 그룹·국가 타겟팅·세션 유지 정책을 설정하고, 플랫폼이 제공하는 건강 모니터링·로테이션을 활용합니다.[^17][^9]
- 리스크 저감: 프록시·세션 로테이션과 인간형 타이밍을 병행하고, 탐지 회피는 지속 업데이트가 필요하므로 스텔스 구성요소를 정기 점검합니다.[^18][^3]


### 보완된 아키텍처 제안

- 수집 파이프라인: RSS 인덱서 → 모바일 본문 파서(데스크톱 iFrame 폴백) → 메타 추출기 → 스텔스/세션 매니저 → 저장소로 구성합니다.[^2][^1]
- 플랫폼 운영: Apify로 스케줄·프록시·세션·모니터링을 일원화하고, 코드 레벨은 Playwright 스크립트의 안정성 개선에 집중시킵니다.[^9][^10]


### 대표 프롬프트 템플릿

- 링크 인덱서: “[입력: 네이버 블로그 ID] 해당 블로그의 RSS에서 최신 30개 아이템의 제목·링크·발행일을 파싱해 정규화된 리스트를 반환하라(중복·미발행 제외)”.[^11][^1]
- 본문 파서(모바일): “[입력: 포스트 URL] 모바일 페이지로 이동 후 제목/본문 컨테이너가 로드될 때까지 대기하고 텍스트를 추출하라(타임아웃·결측을 None-safe 처리)”.[^7]
- iFrame 폴백: “[입력: 포스트 URL] \#mainFrame 로드 대기→프레임 전환→타깃 셀렉터 대기→필드 추출→컨텍스트 복귀, 실패 시 재시도 정책 적용”.[^15][^2]
- 스텔스/세션: “컨텍스트 생성 시 playwright-stealth 적용, UA 랜덤, Apify Proxy 세션 발급, maxUsageCount·maxErrorScore로 세션 수명 관리”.[^12][^4]
- 오케스트레이터: “Apify에서 크론 스케줄·실패 재시작·런 로그·프록시 그룹을 설정하고 실행 상태를 대시보드로 모니터링하라”.[^9][^10]

이와 같이 RSS-first 인덱싱, 모바일 우선 파싱, 세션형 프록시·스텔스 병행, 과업 단위 프롬프트로 재구성하면 차단 위험을 줄이면서 유지보수성과 성공률을 함께 끌어올릴 수 있습니다.[^3][^11]
<span style="display:none">[^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30][^31][^32][^33][^34][^35][^36][^37][^38][^39][^40][^41][^42][^43][^44][^45][^46][^47][^48][^49][^50][^51][^52][^53][^54][^55][^56][^57][^58]</span>

<div align="center">⁂</div>

[^1]: https://hyeon-gomi.tistory.com/entry/네이버-블로그-RSS-20-활용해서-그누보드에-최신글-5개-출력하기

[^2]: https://statkclee.github.io/nlp2/nlp-ingest-naver-blog.html

[^3]: https://brightdata.com/blog/how-tos/avoid-bot-detection-with-playwright-stealth

[^4]: https://docs.apify.com/academy/expert-scraping-with-apify/solutions/rotating-proxies

[^5]: https://blog.naver.com/cjdental/220318329372

[^6]: https://blog.naver.com/mkttalk/222184380746

[^7]: https://chromewebstore.google.com/detail/naver-blog-switch-to-mobi/oeommpbkijhendhlbcpjahomfipicanc

[^8]: https://github.com/microsoft/playwright-python/issues/527

[^9]: https://docs.apify.com/platform/proxy

[^10]: https://apify.com/apify/monitoring

[^11]: https://jeongyoon.tistory.com/431

[^12]: https://pypi.org/project/playwright-stealth/

[^13]: https://docs.apify.com/sdk/js/docs/guides/proxy-management

[^14]: https://webscraping.ai/faq/headless-chromium/how-do-i-prevent-detection-of-headless-chromium-by-websites

[^15]: https://blog.naver.com/tank100/223123597404

[^16]: https://www.navercorp.com/en/media/pressReleasesDetail?seq=30656

[^17]: https://apify.com/proxy

[^18]: https://blog.apify.com/rotating-proxies/

[^19]: https://blog.naver.com/patchwork_corp/222491203366

[^20]: http://blog.naver.com/pakseung98/70097948557

[^21]: https://blog.naver.com/khbright/223657073303

[^22]: https://blog.naver.com/PostView.naver?isHttpsRedirect=true\&blogId=kiddwannabe\&logNo=221253004219

[^23]: https://blog.naver.com/kiddwannabe/221253004219

[^24]: https://blog.naver.com/PostView.nhn

[^25]: https://blog.naver.com/bgpoilkj/220750482718

[^26]: https://blog.naver.com/eye_korea/220834780778

[^27]: https://blog.naver.com/babo2man/70086484033

[^28]: https://blog.naver.com/PostView.nhn?isHttpsRedirect=true\&blogId=young0641\&logNo=100013320679\&categoryNo=19\&proxyReferer=

[^29]: https://wikidocs.net/48293

[^30]: https://hmk1022.tistory.com/entry/jsoup-네이버-블로그-크롤링iframe

[^31]: https://blog.naver.com/PostView.naver?isHttpsRedirect=true\&blogId=japkey\&logNo=110176555754

[^32]: https://blog.naver.com/patchwork_corp/222485364227

[^33]: https://github.com/AtuboDad/playwright_stealth

[^34]: https://www.reddit.com/r/webscraping/comments/1jub2h8/best_playright_stealth_plugin_for_nodejs/

[^35]: https://crawlee.dev/js/docs/examples/crawler-plugins

[^36]: https://github.com/Granitosaurus/playwright-stealth

[^37]: https://stackoverflow.com/questions/54778814/puppeteer-evaluateonnewdocument-equivalent-in-chrome-extension

[^38]: http://blog.naver.com

[^39]: https://blog.logrocket.com/playwright-extra-extending-playwright-plugins/

[^40]: https://www.lambdatest.com/automation-testing-advisor/javascript/puppeteer-evaluateOnNewDocument

[^41]: https://play.google.com/store/apps/details?id=com.nhn.android.blog\&hl=en

[^42]: https://railway.com/deploy/playwright-ts-puppet

[^43]: https://roundproxies.com/blog/puppeteer-stealth/

[^44]: https://blog.naver.com/MyBlog.nhn

[^45]: https://pypi.org/project/tf-playwright-stealth/

[^46]: https://scrapfly.io/blog/posts/bypass-proxy-detection-with-browser-fingerprint-impersonation

[^47]: https://play.google.com/store/apps/details?id=com.nhn.android.blog\&hl=en_IN

[^48]: https://www.reddit.com/r/korea/comments/cht8kb/how_to_view_naver_comment_history/

[^49]: https://docs.apify.com/sdk/js/docs/3.0/guides/proxy-management

[^50]: https://play.google.com/store/apps/details?id=com.nhn.android.blog\&hl=en_AU

[^51]: https://datadome.co/web-unblockers/apify/

[^52]: https://blackbearmedia.io/apify-review/

[^53]: https://www.icrossborderjapan.com/en/blog/south-korea/naver-blog-guide-2019/

[^54]: https://crawlee.dev/python/docs/deployment/apify-platform

[^55]: https://naver-blog.en.uptodown.com/android

[^56]: https://serpapi.com/naver-search-api

[^57]: https://www.interad.com/en/insights/what-is-naver-blog

[^58]: https://www.facebook.com/groups/koreatravelguide/posts/2582168825280582/

