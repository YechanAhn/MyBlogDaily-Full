'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AddressResult } from '@/lib/types';

interface SearchBarProps {
  placeholder?: string;
  onSelect: (result: AddressResult) => void;
  onFocus?: () => void;
  onBack?: () => void;
  defaultValue?: string;
  autoFocus?: boolean;
  showBackButton?: boolean;
  userLat?: number;
  userLng?: number;
}

export default function SearchBar({
  placeholder = '어디로 갈까요?',
  onSelect,
  onFocus,
  onBack,
  defaultValue = '',
  autoFocus = false,
  showBackButton = false,
  userLat,
  userLng,
}: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue);
  const [results, setResults] = useState<AddressResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const searchAddress = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    try {
      const params = new URLSearchParams({ query: q, mode: 'address' });
      if (userLat && userLng) {
        params.set('x', userLng.toString());
        params.set('y', userLat.toString());
      }
      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: AddressResult[] = (data.documents || []).map((doc: any) => ({
        id: doc.id,
        name: doc.place_name,
        address: doc.address_name || '',
        roadAddress: doc.road_address_name || '',
        lat: parseFloat(doc.y),
        lng: parseFloat(doc.x),
        category: doc.category_group_name || '',
      }));
      setResults(items);
      setIsOpen(items.length > 0);
    } catch {
      setResults([]);
    }
  }, [userLat, userLng]);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddress(value), 300);
  };

  const handleSelect = (item: AddressResult) => {
    setQuery(item.name);
    setIsOpen(false);
    setIsFocused(false);
    inputRef.current?.blur();
    onSelect(item);
  };

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2">
        {showBackButton && (
          <button onClick={onBack} className="p-1.5 -ml-1 rounded-full hover:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        )}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { setIsFocused(true); onFocus?.(); if (query.length >= 2) setIsOpen(true); }}
          onBlur={() => setTimeout(() => { setIsFocused(false); setIsOpen(false); }, 200)}
          placeholder={placeholder}
          className="flex-1 text-[15px] bg-transparent outline-none placeholder:text-gray-400"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setIsOpen(false); }} className="p-1 rounded-full hover:bg-gray-100">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {isOpen && isFocused && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 max-h-[320px] overflow-y-auto z-50">
          {results.map((item) => (
            <button
              key={item.id}
              onMouseDown={() => handleSelect(item)}
              className="w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 text-left"
            >
              <div className="mt-0.5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{item.roadAddress || item.address}</p>
                {item.category && <p className="text-xs text-blue-500 mt-0.5">{item.category}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
