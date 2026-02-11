'use client';

import { useState } from 'react';
import { MealSearchMode } from '@/lib/types';

interface MealSearchProps {
  onSearch: (mode: MealSearchMode, value: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export default function MealSearch({ onSearch, onClose, isLoading }: MealSearchProps) {
  const [mode, setMode] = useState<MealSearchMode>('time');
  const [hours, setHours] = useState('1');
  const [region, setRegion] = useState('');

  const handleSearch = () => {
    if (mode === 'time') {
      onSearch('time', hours);
    } else {
      if (!region.trim()) return;
      onSearch('region', region.trim());
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 mx-4 animate-fade-in">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-gray-900">식사 장소 찾기</h3>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-3">
        <button
          onClick={() => setMode('time')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
            mode === 'time' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          시간으로 찾기
        </button>
        <button
          onClick={() => setMode('region')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
            mode === 'region' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          지역으로 찾기
        </button>
      </div>

      {mode === 'time' ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">출발 후 몇 시간 뒤에 식사하실 건가요?</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-50 rounded-xl flex-1">
              {[0.5, 1, 1.5, 2, 3].map((h) => (
                <button
                  key={h}
                  onClick={() => setHours(h.toString())}
                  className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                    hours === h.toString()
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {h}시간
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">어느 지역 근처에서 식사하시겠어요?</p>
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="예: 횡성, 여주, 천안"
            className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none ring-1 ring-gray-200 focus:ring-blue-400"
            autoFocus
          />
        </div>
      )}

      <button
        onClick={handleSearch}
        disabled={isLoading || (mode === 'region' && !region.trim())}
        className="w-full mt-3 py-2.5 bg-blue-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all"
      >
        {isLoading ? '검색 중...' : '맛집 찾기'}
      </button>
    </div>
  );
}
