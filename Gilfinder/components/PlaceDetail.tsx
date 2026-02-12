'use client';

import { useState, useEffect } from 'react';
import { Place, LatLng, NaviApp, CHARGER_TYPE_MAP } from '@/lib/types';
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
  const [reviews, setReviews] = useState<Array<{
    author: string; rating: number; text: string; relativeTime: string;
  }>>([]);
  const [chargerStatus, setChargerStatus] = useState<{
    total: number; available: number; charging: number; broken: number;
    chargingDetails: { chgerId: string; elapsedMin: number | null }[];
  } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

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

  // 장소 상세 정보에서 이미지 + 리뷰 가져오기
  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const params = new URLSearchParams({ id: place.id });
        if (place.name) params.set('name', place.name);
        if (place.lat) params.set('lat', String(place.lat));
        if (place.lng) params.set('lng', String(place.lng));
        const res = await fetch(`/api/place-detail?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.imageUrl && !place.imageUrl) setImageUrl(data.imageUrl);
        if (data.reviews?.length) setReviews(data.reviews);
      } catch { /* 무시 */ }
    };
    fetchDetail();
  }, [place.id, place.name, place.lat, place.lng, place.imageUrl]);

  // 전기차 충전소 실시간 상태 조회
  useEffect(() => {
    if (!place.evStatId) return;
    const fetchStatus = async () => {
      setStatusLoading(true);
      try {
        const res = await fetch(
          `/api/ev-status?statId=${encodeURIComponent(place.evStatId!)}&lat=${place.lat}&lng=${place.lng}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.status) setChargerStatus(data.status);
      } catch { /* 무시 */ }
      finally { setStatusLoading(false); }
    };
    fetchStatus();
  }, [place.evStatId, place.lat, place.lng]);

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
        <div className="flex items-center gap-3 mb-4 flex-wrap">
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

        {/* 전기차 충전기 상세 정보 */}
        {place.evChargerTypes && place.evChargerTypes.length > 0 && (
          <div className="mb-4 p-3 bg-green-50 rounded-xl">
            <p className="text-xs font-semibold text-green-800 mb-2">충전기 정보</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {place.evChargerTypes.map(code => {
                const name = CHARGER_TYPE_MAP[code] || code;
                const isDC = name.includes('DC');
                return (
                  <span
                    key={code}
                    className={`text-xs px-2 py-1 rounded-lg font-medium ${
                      isDC ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'
                    }`}
                  >
                    {isDC ? '⚡' : '🔌'} {name}
                  </span>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {place.evMaxOutput ? (
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">충전 용량</span>
                  <span className="font-bold text-green-700">{place.evMaxOutput}kW</span>
                </div>
              ) : null}
              {place.evChargerCount ? (
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">충전기 수</span>
                  <span className="font-bold text-gray-700">{place.evChargerCount}기</span>
                </div>
              ) : null}
              {place.evOperator && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">운영</span>
                  <span className="font-medium text-gray-700">{place.evOperator}</span>
                </div>
              )}
              {place.evParkingFree !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">주차</span>
                  <span className={`font-medium ${place.evParkingFree ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {place.evParkingFree ? '무료' : '유료'}
                  </span>
                </div>
              )}
            </div>
            {place.evUseTime && (
              <p className="text-[11px] text-gray-500 mt-2">이용시간: {place.evUseTime}</p>
            )}
            {/* 실시간 충전 현황 */}
            {statusLoading ? (
              <div className="mt-3 pt-3 border-t border-green-200 flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-green-600">실시간 현황 로딩 중...</span>
              </div>
            ) : chargerStatus ? (
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-xs font-semibold text-green-800 mb-2">실시간 충전 현황</p>
                <div className="flex gap-2 mb-2">
                  {chargerStatus.available > 0 && (
                    <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-bold">
                      충전가능 {chargerStatus.available}기
                    </span>
                  )}
                  {chargerStatus.charging > 0 && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-lg font-bold">
                      충전중 {chargerStatus.charging}기
                    </span>
                  )}
                  {chargerStatus.broken > 0 && (
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-lg font-medium">
                      고장/점검 {chargerStatus.broken}기
                    </span>
                  )}
                </div>
                {/* 프로그레스 바 */}
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden flex">
                  {chargerStatus.available > 0 && (
                    <div className="h-full bg-emerald-500" style={{ width: `${(chargerStatus.available / chargerStatus.total) * 100}%` }} />
                  )}
                  {chargerStatus.charging > 0 && (
                    <div className="h-full bg-blue-400" style={{ width: `${(chargerStatus.charging / chargerStatus.total) * 100}%` }} />
                  )}
                  {chargerStatus.broken > 0 && (
                    <div className="h-full bg-gray-300" style={{ width: `${(chargerStatus.broken / chargerStatus.total) * 100}%` }} />
                  )}
                </div>
                {/* 모든 충전기 사용중일 때 상세 정보 */}
                {chargerStatus.available === 0 && chargerStatus.charging > 0 && (
                  <div className="mt-2 p-2 bg-amber-50 rounded-lg">
                    <p className="text-xs font-medium text-amber-700 mb-1">현재 모든 충전기 사용중</p>
                    {chargerStatus.chargingDetails.map((d, i) => (
                      <p key={i} className="text-[11px] text-amber-600">
                        충전기 {d.chgerId}: {d.elapsedMin !== null ? `${d.elapsedMin}분 전 시작` : '시간 정보 없음'}
                        {d.elapsedMin !== null && d.elapsedMin < 60 && (
                          <span className="text-amber-500 ml-1">(약 {Math.max(5, 40 - d.elapsedMin)}분 후 완료 예상)</span>
                        )}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* 베스트 리뷰 */}
        {reviews.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500">베스트 리뷰</p>
            {reviews.map((review, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">{review.author}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-amber-500">{'★'.repeat(Math.round(review.rating))}</span>
                    <span className="text-[10px] text-gray-400">{review.relativeTime}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{review.text}</p>
              </div>
            ))}
          </div>
        )}

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
