'use client';

interface RatingFilterProps {
  value: number;
  onChange: (val: number) => void;
}

const RATINGS = [3.0, 3.5, 4.0, 4.5];

export default function RatingFilter({ value, onChange }: RatingFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 flex-shrink-0">최소 평점</span>
      <div className="flex gap-1.5">
        {RATINGS.map((r) => (
          <button
            key={r}
            onClick={() => onChange(r)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all
              ${value === r
                ? 'bg-yellow-400 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            ★ {r}
          </button>
        ))}
      </div>
    </div>
  );
}
