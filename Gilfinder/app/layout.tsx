import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://ontheway.kr'),
  title: '가는길에 - OnTheWay',
  description: '가는 길이 즐거워지는 순간. 경로 위 맛집, 주유소, 카페를 찾아보세요.',
  keywords: ['경로 검색', '맛집', '주유소', '카페', '휴게소', '길 위', '가는길에', 'OnTheWay', '경유지', '드라이브'],
  manifest: '/manifest.json',
  robots: { index: true, follow: true },
  openGraph: {
    title: '가는길에 - OnTheWay',
    description: '가는 길이 즐거워지는 순간. 경로 위 맛집, 주유소, 카페를 찾아보세요.',
    type: 'website',
    locale: 'ko_KR',
    url: 'https://ontheway.kr',
    siteName: '가는길에',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '가는길에',
  },
  verification: {
    other: {
      'naver-site-verification': '',
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3B82F6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const kakaoJsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || '';
  const ga4Id = process.env.NEXT_PUBLIC_GA4_ID;

  return (
    <html lang="ko">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="antialiased">
        {children}
        <Analytics />

        {/* Kakao Map SDK */}
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoJsKey}&libraries=services&autoload=false`}
          strategy="beforeInteractive"
        />

        {/* Kakao AdFit SDK */}
        <Script
          src="//t1.daumcdn.net/kas/static/ba.min.js"
          strategy="afterInteractive"
        />

        {/* Service Worker Registration */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js');
              });
            }
          `}
        </Script>

        {/* Google Analytics 4 (GA4) - 프로덕션 환경에서만 로드 */}
        {ga4Id && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${ga4Id}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
