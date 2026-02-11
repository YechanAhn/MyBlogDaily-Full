'use client';

import { useState, useEffect } from 'react';
import { RouteResult, Place } from '@/lib/types';

interface RoutePanelProps {
  originName: string;
  destName: string;
  route: RouteResult | null;
  waypoint?: Place | null;
  defaultCompact?: boolean;
  onSwap?: () => void;
  onOriginClick?: () => void;
  onDestClick?: () => void;
  onRemoveWaypoint?: () => void;
}

export default function RoutePanel({
  originName,
  destName,
  route,
  waypoint,
  defaultCompact = false,
  onSwap,
  onOriginClick,
  onDestClick,
  onRemoveWaypoint,
}: RoutePanelProps) {
  const [isCompact, setIsCompact] = useState(defaultCompact);

  // 경로가 설정되면 자동으로 컴팩트 모드로 전환
  useEffect(() => {
    if (route && defaultCompact) {
      setIsCompact(true);
    }
  }, [route, defaultCompact]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}시간 ${minutes}분`;
    return `${minutes}분`;
  };

  const formatDistance = (meters: number) => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
    return `${meters}m`;
  };

  // 경로 확정 후 컴팩트 모드
  if (route && isCompact) {
    return (
      <div
        className="bg-white rounded-2xl shadow-lg px-4 py-2.5 cursor-pointer"
        onClick={() => setIsCompact(false)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs text-gray-500 truncate max-w-[80px]">{originName}</span>
            <span className="text-gray-300">→</span>
            {waypoint && (
              <>
                <span className="text-xs text-blue-600 font-medium truncate max-w-[80px]">{waypoint.name}</span>
                <span className="text-gray-300">→</span>
              </>
            )}
            <span className="text-xs text-gray-500 truncate max-w-[80px]">{destName}</span>
          </div>
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            <span className="text-sm font-bold text-blue-600">{formatDuration(route.totalDuration)}</span>
            <span className="text-xs text-gray-400">{formatDistance(route.totalDistance)}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4">
      <div className="flex gap-3">
        {/* 경로 도트 라인 */}
        <div className="flex flex-col items-center py-1 gap-0.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <div className="w-0.5 flex-1 bg-gray-200" />
          {waypoint && (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <div className="w-0.5 flex-1 bg-gray-200" />
            </>
          )}
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
        </div>

        {/* 입력 필드 */}
        <div className="flex-1 space-y-2">
          <button
            onClick={onOriginClick}
            className="w-full text-left px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-800 truncate hover:bg-gray-100 transition-colors"
          >
            {originName || '출발지 선택'}
          </button>
          {waypoint && (
            <div className="flex items-center gap-1">
              <div className="flex-1 px-3 py-2 bg-green-50 rounded-lg text-sm text-green-700 font-medium truncate">
                {waypoint.name}
              </div>
              <button
                onClick={onRemoveWaypoint}
                className="p-1.5 rounded-full hover:bg-red-50 transition-colors flex-shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          )}
          <button
            onClick={onDestClick}
            className="w-full text-left px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-800 truncate hover:bg-gray-100 transition-colors"
          >
            {destName || '도착지 선택'}
          </button>
        </div>

        {/* 스왑 + 접기 버튼 */}
        <div className="flex flex-col items-center justify-center gap-1">
          <button
            onClick={onSwap}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
              <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
          {route && (
            <button
              onClick={() => setIsCompact(true)}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              title="접기"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* 경로 요약 */}
      {route && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <span className="text-sm font-bold text-blue-600">{formatDuration(route.totalDuration)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span className="text-sm text-gray-500">{formatDistance(route.totalDistance)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
