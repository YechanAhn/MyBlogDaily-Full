'use client';

import { SearchCategory } from '@/lib/types';

interface CategoryChipsProps {
  value: SearchCategory;
  onChange: (cat: SearchCategory) => void;
  visible?: boolean;
  customLabel?: string; // 검색 시 검색어를 라벨로 표시
}

const CATEGORIES: { key: SearchCategory; label: string; emoji: string }[] = [
  { key: 'custom', label: '검색', emoji: '🔍' },
  { key: 'coffee', label: '카페', emoji: '☕' },
  { key: 'fuel', label: '주유소', emoji: '⛽' },
  { key: 'food', label: '맛집', emoji: '🍽️' },
  { key: 'convenience', label: '편의점', emoji: '🏪' },
  { key: 'rest', label: '휴게소', emoji: '🅿️' },
];

export default function CategoryChips({ value, onChange, visible = true, customLabel }: CategoryChipsProps) {
  if (!visible) return null;

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-2">
      {CATEGORIES.map((cat) => {
        const label = cat.key === 'custom' && customLabel ? customLabel : cat.label;
        return (
          <button
            key={cat.key}
            onClick={() => onChange(cat.key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all whitespace-nowrap shadow-sm
              ${value === cat.key
                ? 'bg-white text-blue-600 shadow-md ring-1 ring-blue-100'
                : 'bg-white/90 text-gray-700 hover:bg-white'
              }`}
          >
            <span className="text-sm">{cat.emoji}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
