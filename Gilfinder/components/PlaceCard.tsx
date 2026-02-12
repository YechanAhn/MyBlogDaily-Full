'use client';

import { useState, useEffect, useRef } from 'react';
import { Place } from '@/lib/types';

interface PlaceCardProps {
  place: Place;
  isSelected?: boolean;
  onClick?: () => void;
}

// 장소 상세 정보 캐시
const detailCache = new Map<string, { imageUrl?: string; rating?: number; reviewCount?: number; openHours?: string; ratingSource?: 'kakao' | 'google' | null }>();

export default function PlaceCard({ place, isSelected, onClick }: PlaceCardProps) {
  const [detail, setDetail] = useState<{ imageUrl?: string; rating?: number; reviewCount?: number; openHours?: string; ratingSource?: 'kakao' | 'google' | null } | null>(
    detailCache.get(place.id) || null
  );
  const [imgError, setImgError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Lazy-load: IntersectionObserver로 보일 때만 상세 정보 fetch
  useEffect(() => {
    if (place.rating !== undefined && place.rating !== null) return;
    if (detailCache.has(place.id)) {
      setDetail(detailCache.get(place.id)!);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchDetail();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id]);

  const fetchDetail = async () => {
    try {
      // Google 평점 폴백을 위해 name, lat, lng 전달
      const params = new URLSearchParams({ id: place.id });
      if (place.name) params.set('name', place.name);
      if (place.lat) params.set('lat', String(place.lat));
      if (place.lng) params.set('lng', String(place.lng));
      const res = await fetch(`/api/place-detail?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const info = {
        imageUrl: data.imageUrl || undefined,
        rating: data.rating ?? undefined,
        reviewCount: data.reviewCount ?? undefined,
        openHours: data.openHours || undefined,
        ratingSource: data.ratingSource || undefined,
      };
      detailCache.set(place.id, info);
      setDetail(info);
    } catch {
      // 실패 시 무시
    }
  };

  const displayRating = detail?.rating ?? place.rating;
  const displayReviews = detail?.reviewCount ?? place.reviewCount;
  const imageUrl = detail?.imageUrl || place.imageUrl;
  const displayOpenHours = detail?.openHours || place.openHours;

  return (
    <div
      ref={cardRef}
      data-place-id={place.id}
      onClick={onClick}
      className={`relative flex-shrink-0 w-[260px] snap-center rounded-2xl overflow-hidden cursor-pointer transition-all duration-300
        ${isSelected
          ? 'bg-blue-50 ring-2 ring-blue-400 shadow-xl scale-[1.03] -translate-y-1 animate-pulse-subtle'
          : 'bg-white shadow-lg hover:shadow-xl'
        }`}
    >
      {/* 경유지 추가 뱃지 */}
      {isSelected && (
        <div className="absolute top-2 right-2 z-10 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md">
          경유지 추가
        </div>
      )}

      {/* 이미지 영역 */}
      {imageUrl && !imgError ? (
        <div className="w-full h-[100px] bg-gray-100 overflow-hidden">
          <img
            src={imageUrl}
            alt={place.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        </div>
      ) : null}

      <div className="p-3.5">
        <div className="flex justify-between items-start mb-1.5">
          <h3 className="font-bold text-[14px] text-gray-900 leading-tight line-clamp-1 flex-1">
            {place.name}
          </h3>
          <span className={`ml-2 flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full
            ${place.detourMinutes <= 3 ? 'bg-green-100 text-green-700' :
              place.detourMinutes <= 10 ? 'bg-blue-100 text-blue-700' :
              'bg-orange-100 text-orange-700'}`}>
            +{place.detourMinutes}분
          </span>
        </div>

        {/* 주유소 가격 강조 */}
        {place.fuelPrice ? (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[15px] font-bold text-red-500">{place.fuelPrice.toLocaleString()}원/L</span>
            {place.isSelfService && (
              <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-medium">셀프</span>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-gray-400 mb-2">{place.category}</p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {displayRating !== undefined && displayRating !== null ? (
            <span className="text-[12px] font-semibold text-amber-500">
              ★ {displayRating.toFixed(1)}
              <span className="text-[10px] text-gray-400 ml-0.5">
                {(detail?.ratingSource ?? place.ratingSource) === 'google' ? 'G' :
                 (detail?.ratingSource ?? place.ratingSource) === 'kakao' ? 'K' : ''}
              </span>
            </span>
          ) : (
            <span className="text-[11px] text-gray-400">평점 없음</span>
          )}
          {displayReviews !== undefined && displayReviews !== null && displayReviews > 0 && (
            <span className="text-[11px] text-gray-400">리뷰 {displayReviews >= 1000 ? `${(displayReviews / 1000).toFixed(1)}k` : displayReviews}</span>
          )}
          {place.detourDistance && place.detourDistance > 0 && (
            <span className="text-[11px] text-gray-400">+{place.detourDistance >= 1000 ? `${(place.detourDistance / 1000).toFixed(1)}km` : `${place.detourDistance}m`}</span>
          )}
        </div>

        <p className="text-[11px] text-gray-500 line-clamp-1">{place.roadAddress || place.address}</p>

        {/* 영업시간 정보 */}
        {displayOpenHours && (
          <div className="flex items-center gap-1 mt-1.5">
            <span className="text-[11px] text-gray-600">⏰ {displayOpenHours}</span>
          </div>
        )}
      </div>
    </div>
  );
}
