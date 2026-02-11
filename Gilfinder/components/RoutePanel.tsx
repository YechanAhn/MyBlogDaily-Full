'use client';

import { RouteResult } from '@/lib/types';

interface RoutePanelProps {
  originName: string;
  destName: string;
  route: RouteResult | null;
  onSwap?: () => void;
  onOriginClick?: () => void;
  onDestClick?: () => void;
}

export default function RoutePanel({
  originName,
  destName,
  route,
  onSwap,
  onOriginClick,
  onDestClick,
}: RoutePanelProps) {
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

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4">
      <div className="flex gap-3">
        {/* Route dots line */}
        <div className="flex flex-col items-center py-1 gap-0.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <div className="w-0.5 flex-1 bg-gray-200" />
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
        </div>

        {/* Inputs */}
        <div className="flex-1 space-y-2">
          <button
            onClick={onOriginClick}
            className="w-full text-left px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-800 truncate hover:bg-gray-100 transition-colors"
          >
            {originName || '출발지 선택'}
          </button>
          <button
            onClick={onDestClick}
            className="w-full text-left px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-800 truncate hover:bg-gray-100 transition-colors"
          >
            {destName || '도착지 선택'}
          </button>
        </div>

        {/* Swap button */}
        <button
          onClick={onSwap}
          className="self-center p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {/* Route summary */}
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
