'use client';

import { useState, useEffect } from 'react';
import { Place, LatLng, NaviApp } from '@/lib/types';
import { openNaviApp, getNaviInfo } from '@/lib/deeplink';

interface PlaceDetailProps {
  place: Place;
  origin?: LatLng | null;
  destination?: LatLng | null;
  originName?: string;
  destName?: string;
  originalDuration?: number; // 원래 경로 소요시간 (초)
  originalDistance?: number; // 원래 경로 거리 (m)
  onClose: () => void;
  onAddWaypoint?: (place: Place) => void;
}

interface WaypointDelta {
  duration: number; // 추가 소요시간 (초)
  distance: number; // 추가 거리 (m)
  loading: boolean;
}

export default function PlaceDetail({
  place,
  origin,
  destination,
  originName,
  destName,
  originalDuration,
  originalDistance,
  onClose,
  onAddWaypoint,
}: PlaceDetailProps) {
  const [delta, setDelta] = useState<WaypointDelta>({ duration: 0, distance: 0, loading: false });
  const [imageUrl, setImageUrl] = useState<string | null>(place.imageUrl || null);
  const [imgError, setImgError] = useState(false);

  // 경유지 추가 시 경로 변경 계산
  useEffect(() => {
    if (!origin || !destination || !originalDuration) return;

    const fetchWaypointRoute = async () => {
      setDelta(prev => ({ ...prev, loading: true }));
      try {
        const res = await fetch('/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin,
            destination,
            waypoints: [{ lat: place.lat, lng: place.lng, name: place.name }],
          }),
        });

        if (!res.ok) {
          setDelta({ duration: 0, distance: 0, loading: false });
          return;
        }

        const data = await res.json();
        const routes = data.routes;
        if (routes?.length) {
          const newDuration = routes[0].summary?.duration || 0;
          const newDistance = routes[0].summary?.distance || 0;
          setDelta({
            duration: newDuration - (originalDuration || 0),
            distance: newDistance - (originalDistance || 0),
            loading: false,
          });
        } else {
          setDelta({ duration: 0, distance: 0, loading: false });
        }
      } catch {
        setDelta({ duration: 0, distance: 0, loading: false });
      }
    };

    fetchWaypointRoute();
  }, [place.id, origin, destination, originalDuration, originalDistance, place.lat, place.lng, place.name]);

  // 장소 상세 정보에서 이미지 가져오기
  useEffect(() => {
    if (place.imageUrl) {
      setImageUrl(place.imageUrl);
      return;
    }

    const fetchImage = async () => {
      try {
        const res = await fetch(`/api/place-detail?id=${place.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.imageUrl) setImageUrl(data.imageUrl);
      } catch {
        // 실패 시 무시
      }
    };

    fetchImage();
  }, [place.id, place.imageUrl]);

  const handleNavi = (navi: NaviApp) => {
    if (!origin || !destination) return;
    const wp = { lat: place.lat, lng: place.lng, name: place.name };
    const start = { ...origin, name: originName || '출발지' };
    const end = { ...destination, name: destName || '도착지' };
    openNaviApp(navi, start, end, wp);
  };

  const formatDelta = (seconds: number) => {
    const min = Math.round(Math.abs(seconds) / 60);
    if (min === 0) return '변동 없음';
    const sign = seconds < 0 ? '-' : '+';
    return `${sign}${min}분`;
  };

  const formatDistDelta = (meters: number) => {
    if (meters === 0) return '';
    const sign = meters < 0 ? '-' : '+';
    const abs = Math.abs(meters);
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}km`;
    return `${sign}${Math.round(abs)}m`;
  };

  return (
    <div className="bg-white rounded-t-2xl shadow-2xl animate-slide-up max-h-[70vh] overflow-y-auto">
      {/* 이미지 */}
      {imageUrl && !imgError && (
        <div className="w-full h-[160px] bg-gray-100 overflow-hidden rounded-t-2xl">
          <img
            src={imageUrl}
            alt={place.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        </div>
      )}

      {/* Handle */}
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 bg-gray-200 rounded-full" />
      </div>

      <div className="px-5 pb-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">{place.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{place.category}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 -mr-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 mb-4">
          {place.rating !== undefined && place.rating !== null && (
            <div className="flex items-center gap-1">
              <span className="text-amber-500 font-bold text-sm">★ {place.rating.toFixed(1)}</span>
            </div>
          )}
          {place.reviewCount !== undefined && place.reviewCount !== null && place.reviewCount > 0 && (
            <span className="text-xs text-gray-400">리뷰 {place.reviewCount}개</span>
          )}
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full
            ${place.detourMinutes <= 2 ? 'bg-green-100 text-green-700' :
              place.detourMinutes <= 5 ? 'bg-blue-100 text-blue-700' :
              'bg-orange-100 text-orange-700'}`}>
            경로 이탈 {place.detourMinutes > 0 ? `+${place.detourMinutes}` : place.detourMinutes}분
          </span>
          {place.fuelPrice && (
            <span className="text-sm font-bold text-red-500">{place.fuelPrice.toLocaleString()}원/L</span>
          )}
        </div>

        {/* 경유지 추가 시 경로 변경 델타 */}
        {originalDuration && (
          <div className="mb-4 p-3 bg-blue-50 rounded-xl">
            {delta.loading ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-blue-600">경유 경로 계산 중...</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-blue-700 font-medium">경유 시</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-blue-600">{formatDelta(delta.duration)}</span>
                  {delta.distance !== 0 && (
                    <span className="text-xs text-blue-500">{formatDistDelta(delta.distance)}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info rows */}
        <div className="space-y-2 mb-4">
          <div className="flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" className="mt-0.5 flex-shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <p className="text-sm text-gray-600">{place.roadAddress || place.address}</p>
          </div>
          {place.phone && (
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" className="flex-shrink-0"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              <a href={`tel:${place.phone}`} className="text-sm text-blue-600">{place.phone}</a>
            </div>
          )}
        </div>

        {/* 카카오맵 리뷰/사진 링크 - 평점이 없을 때 더 강조 */}
        {place.placeUrl && (
          <a
            href={place.placeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`block w-full text-center py-2.5 mb-3 rounded-xl text-sm font-medium transition-colors ${
              place.rating === undefined || place.rating === null
                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {place.rating === undefined || place.rating === null ? '⭐ 리뷰·평점·사진 보기 →' : '카카오맵에서 리뷰·사진 보기 →'}
          </a>
        )}

        {/* 경유지로 추가 버튼 */}
        {onAddWaypoint && (
          <button
            onClick={() => onAddWaypoint(place)}
            className="w-full py-3 mb-3 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            이 장소를 경유지로 추가
          </button>
        )}

        {/* Navigation buttons */}
        {origin && destination && (
          <div className="flex gap-2">
            {(['kakao', 'naver', 'tmap'] as NaviApp[]).map((navi) => {
              const info = getNaviInfo(navi);
              return (
                <button
                  key={navi}
                  onClick={() => handleNavi(navi)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all"
                >
                  <span className="text-base">{info.icon}</span>
                  <span className="text-xs font-semibold text-gray-700">{info.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
