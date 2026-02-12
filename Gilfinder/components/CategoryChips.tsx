'use client';

import { useState, useEffect, useRef } from 'react';
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
  { key: 'dt', label: 'DT', emoji: '🚗' },
  { key: 'fuel', label: '주유소', emoji: '⛽' },
  { key: 'rest', label: '휴게소', emoji: '🅿️' },
  { key: 'toilet', label: '화장실', emoji: '🚻' },
  { key: 'food', label: '맛집', emoji: '🍽️' },
  { key: 'coffee', label: '카페', emoji: '☕' },
];

export default function CategoryChips({ value, onChange, visible = true, customLabel }: CategoryChipsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hiddenCount, setHiddenCount] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateCount = () => {
      const containerRight = el.scrollLeft + el.clientWidth;
      let hidden = 0;
      Array.from(el.children).forEach((child) => {
        const btn = child as HTMLElement;
        // 버튼의 오른쪽 끝이 컨테이너 보이는 영역 밖이면 hidden
        if (btn.offsetLeft + btn.offsetWidth > containerRight + 10) {
          hidden++;
        }
      });
      setHiddenCount(hidden);
    };

    updateCount();
    el.addEventListener('scroll', updateCount, { passive: true });
    window.addEventListener('resize', updateCount);
    return () => {
      el.removeEventListener('scroll', updateCount);
      window.removeEventListener('resize', updateCount);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="relative">
      <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto scrollbar-hide px-4 py-2">
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
      {/* 오른쪽 오버플로우 표시 */}
      {hiddenCount > 0 && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center pointer-events-none">
          <div className="w-12 h-full bg-gradient-to-l from-gray-100 to-transparent" />
          <span className="absolute right-1 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
            +{hiddenCount}
          </span>
        </div>
      )}
    </div>
  );
}
