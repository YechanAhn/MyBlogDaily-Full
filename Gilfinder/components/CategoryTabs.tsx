'use client';

import { SearchCategory } from '@/lib/types';

interface CategoryTabsProps {
  value: SearchCategory;
  onChange: (cat: SearchCategory) => void;
}

const CATEGORIES: { key: SearchCategory; label: string; emoji: string }[] = [
  { key: 'custom', label: '검색', emoji: '🔍' },
  { key: 'ev', label: '전기차', emoji: '🔌' },
  { key: 'dt', label: 'DT', emoji: '🚗' },
  { key: 'fuel', label: '주유소', emoji: '⛽' },
  { key: 'rest', label: '휴게소', emoji: '🅿️' },
  { key: 'toilet', label: '화장실', emoji: '🚻' },
  { key: 'food', label: '맛집', emoji: '🍽️' },
  { key: 'coffee', label: '카페', emoji: '☕' },
];

export default function CategoryTabs({ value, onChange }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.key}
          onClick={() => onChange(cat.key)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap
            ${value === cat.key
              ? 'bg-blue-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          <span>{cat.emoji}</span>
          <span>{cat.label}</span>
        </button>
      ))}
    </div>
  );
}
