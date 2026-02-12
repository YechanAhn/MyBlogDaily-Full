'use client';

import { useEffect, useRef } from 'react';

interface KakaoAdFitProps {
  unit: string; // DAN-xxx 광고 단위 ID
  width: number;
  height: number;
  className?: string;
}

// 카카오 애드핏 광고 컴포넌트
export default function KakaoAdFit({ unit, width, height, className = '' }: KakaoAdFitProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;
    let attempts = 0;

    const ensureScript = () => {
      if (document.querySelector('script[data-adfit-script="true"]')) return;
      const script = document.createElement('script');
      script.src = '//t1.daumcdn.net/kas/static/ba.min.js';
      script.async = true;
      script.dataset.adfitScript = 'true';
      document.head.appendChild(script);
    };

    const tryInit = () => {
      if (cancelled || !container) return;
      attempts += 1;
      // 이미 광고가 삽입되어 있으면 스킵
      if (container.querySelector('.kakao_ad_area')) return;

      const adfit = (window as any).adfit || (window as any).kakaoAdFit;
      if (adfit) {
        const ins = document.createElement('ins');
        ins.className = 'kakao_ad_area';
        ins.style.display = 'none';
        ins.style.width = `${width}px`;
        ins.style.height = `${height}px`;
        ins.setAttribute('data-ad-unit', unit);
        ins.setAttribute('data-ad-width', String(width));
        ins.setAttribute('data-ad-height', String(height));
        container.appendChild(ins);
        adfit.display(unit);
      } else {
        // SDK 아직 로드 안됨, 재시도
        ensureScript();
        if (attempts < 8) {
          retryTimer = setTimeout(tryInit, 500);
        }
      }
    };

    ensureScript();
    const timer = setTimeout(tryInit, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(retryTimer);
    };
  }, [unit, width, height]);

  return <div ref={containerRef} className={`flex justify-center ${className}`} />;
}
