'use client';

import { FuelType } from '@/lib/types';
import { getFuelTypeName } from '@/lib/fuelPrice';

interface FuelTypeToggleProps {
  value: FuelType;
  onChange: (type: FuelType) => void;
}

const FUEL_TYPES: FuelType[] = ['gasoline', 'diesel', 'lpg'];

export default function FuelTypeToggle({ value, onChange }: FuelTypeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 flex-shrink-0">유종</span>
      <div className="flex bg-gray-100 rounded-lg p-0.5">
        {FUEL_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all
              ${value === type
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {getFuelTypeName(type)}
          </button>
        ))}
      </div>
    </div>
  );
}
