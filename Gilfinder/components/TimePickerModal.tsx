'use client';

import { useState } from 'react';
import { MealSearchMode } from '@/lib/types';

interface TimePickerModalProps {
  onConfirm: (mode: MealSearchMode, value: string) => void;
  onClose: () => void;
}

export default function TimePickerModal({ onConfirm, onClose }: TimePickerModalProps) {
  const [mode, setMode] = useState<MealSearchMode>('time');
  const [hours, setHours] = useState('1');
  const [region, setRegion] = useState('');

  const handleConfirm = () => {
    if (mode === 'time') {
      onConfirm('time', hours);
    } else {
      onConfirm('region', region);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900 mb-4">식사 장소 찾기</h3>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('time')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'time' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            시간으로
          </button>
          <button
            onClick={() => setMode('region')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'region' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            지역으로
          </button>
        </div>

        {mode === 'time' ? (
          <div className="mb-4">
            <label className="text-sm text-gray-600 mb-1 block">출발 후 몇 시간 뒤?</label>
            <select
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg text-center"
            >
              {[0.5, 1, 1.5, 2, 3, 4].map(h => (
                <option key={h} value={h}>{h}시간</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mb-4">
            <label className="text-sm text-gray-600 mb-1 block">지역 이름</label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="예: 횡성, 여주"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg text-center"
            />
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium">취소</button>
          <button onClick={handleConfirm} className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold">확인</button>
        </div>
      </div>
    </div>
  );
}
