'use client';

import { CHARGER_TYPE_CATEGORY } from '@/lib/types';

interface ChargerTypeFilterProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

const FILTER_OPTIONS: { key: string; label: string; color: string; bgColor: string }[] = [
  { key: 'DC콤보', label: 'DC콤보', color: 'text-green-700', bgColor: 'bg-green-100' },
  { key: 'DC차데모', label: 'DC차데모', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  { key: 'AC3상', label: 'AC3상', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  { key: 'AC완속', label: 'AC완속', color: 'text-gray-700', bgColor: 'bg-gray-100' },
];

export default function ChargerTypeFilter({ selected, onChange }: ChargerTypeFilterProps) {
  const toggle = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter(k => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-4 py-1.5">
      <span className="flex-shrink-0 text-[11px] text-gray-400 font-medium self-center mr-0.5">충전타입</span>
      {FILTER_OPTIONS.map(opt => {
        const isActive = selected.includes(opt.key);
        return (
          <button
            key={opt.key}
            onClick={() => toggle(opt.key)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap border
              ${isActive
                ? `${opt.bgColor} ${opt.color} border-current shadow-sm`
                : 'bg-white/80 text-gray-400 border-gray-200'
              }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 충전기 타입 필터를 Place 목록에 적용
 * selected가 빈 배열이면 모든 결과 표시 (필터 없음)
 */
export function filterByChargerType(
  places: { evChargerTypes?: string[] }[],
  selectedCategories: string[]
): boolean[] {
  if (selectedCategories.length === 0) return places.map(() => true);

  // 선택된 카테고리에 해당하는 충전기 타입 코드 수집
  const allowedCodes = new Set<string>();
  for (const cat of selectedCategories) {
    const codes = CHARGER_TYPE_CATEGORY[cat];
    if (codes) codes.forEach(c => allowedCodes.add(c));
  }

  return places.map(place => {
    if (!place.evChargerTypes || place.evChargerTypes.length === 0) return false;
    return place.evChargerTypes.some(code => allowedCodes.has(code));
  });
}
