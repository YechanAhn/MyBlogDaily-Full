'use client';

import { NaviApp, LatLng, Place } from '@/lib/types';
import { openNaviApp, getNaviInfo } from '@/lib/deeplink';

interface NaviSelectorProps {
  start: LatLng;
  end: LatLng & { name?: string };
  waypoint?: Place;
  onClose?: () => void;
}

export default function NaviSelector({ start, end, waypoint, onClose }: NaviSelectorProps) {
  const naviApps: NaviApp[] = ['kakao', 'naver', 'tmap'];

  const handleNaviClick = (navi: NaviApp) => {
    const wp = waypoint
      ? { lat: waypoint.lat, lng: waypoint.lng, name: waypoint.name }
      : undefined;
    openNaviApp(navi, start, { ...end, name: end.name || '도착지' }, wp);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl p-5 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

        <h3 className="text-lg font-bold text-gray-900 mb-1">내비게이션 선택</h3>
        {waypoint && (
          <p className="text-sm text-gray-500 mb-4">
            경유지: <span className="text-blue-600 font-medium">{waypoint.name}</span>
          </p>
        )}

        <div className="flex gap-3">
          {naviApps.map((navi) => {
            const info = getNaviInfo(navi);
            const isTmapWithWaypoint = navi === 'tmap' && !!waypoint;
            return (
              <button
                key={navi}
                onClick={() => handleNaviClick(navi)}
                className="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-gray-100 hover:border-gray-300 active:scale-95 transition-all"
                style={{ backgroundColor: `${info.color}15` }}
              >
                <span className="text-2xl">{info.icon}</span>
                <span className="text-sm font-semibold text-gray-800">{info.name}</span>
                {isTmapWithWaypoint && (
                  <span className="text-[10px] text-orange-500 leading-tight text-center">경유지를 목적지로 설정</span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-3 text-sm text-gray-500 hover:text-gray-700"
        >
          취소
        </button>
      </div>
    </div>
  );
}
