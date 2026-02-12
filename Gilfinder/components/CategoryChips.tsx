'use client';

import { SearchCategory } from '@/lib/types';

interface CategoryChipsProps {
  value: SearchCategory;
  onChange: (cat: SearchCategory) => void;
  visible?: boolean;
  customLabel?: string; // 검색 시 검색어를 라벨로 표시
}

const CATEGORIES: { key: SearchCategory; label: string; emoji?: string; icon?: string }[] = [
  { key: 'custom', label: '검색', emoji: '🔍' },
  { key: 'ev', label: '전기차', emoji: '🔌' },
  { key: 'fuel', label: '주유소', emoji: '⛽' },
  { key: 'food', label: '맛집', emoji: '🍽️' },
  { key: 'coffee', label: '카페', emoji: '☕' },
  { key: 'rest', label: '휴게소', emoji: '🅿️' },
];

export default function CategoryChips({ value, onChange, visible = true, customLabel }: CategoryChipsProps) {
  if (!visible) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-4 py-2">
      {CATEGORIES.map((cat) => {
        const label = cat.key === 'custom' && customLabel ? customLabel : cat.label;
        const isActive = value === cat.key;
        return (
          <button
            key={cat.key}
            onClick={() => onChange(cat.key)}
            className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap
              ${isActive
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-white/95 text-gray-600 shadow-sm hover:bg-white'
              }`}
          >
            {cat.icon ? (
              <img src={cat.icon} alt={cat.label} className="w-4 h-4 object-contain" />
            ) : (
              <span className="text-xs">{cat.emoji}</span>
            )}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
