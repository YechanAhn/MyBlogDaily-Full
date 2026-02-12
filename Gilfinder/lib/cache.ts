'use client';

// 경로 검색 결과 캐싱 (localStorage)
const CACHE_PREFIX = 'otw_';
const ROUTE_CACHE_TTL = 30 * 60 * 1000; // 30분
const PLACE_CACHE_TTL = 60 * 60 * 1000; // 1시간
const MAX_CACHE_ENTRIES = 50;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// 캐시 키 생성: 출발지+도착지+카테고리
export function makeRouteKey(originLat: number, originLng: number, destLat: number, destLng: number): string {
  // Round to 3 decimal places for fuzzy matching
  const oLat = originLat.toFixed(3);
  const oLng = originLng.toFixed(3);
  const dLat = destLat.toFixed(3);
  const dLng = destLng.toFixed(3);
  return `${CACHE_PREFIX}route_${oLat}_${oLng}_${dLat}_${dLng}`;
}

export function makePlaceKey(originLat: number, originLng: number, destLat: number, destLng: number, category: string): string {
  const oLat = originLat.toFixed(3);
  const oLng = originLng.toFixed(3);
  const dLat = destLat.toFixed(3);
  const dLng = destLng.toFixed(3);
  return `${CACHE_PREFIX}places_${oLat}_${oLng}_${dLat}_${dLng}_${category}`;
}

export function getCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > entry.ttl) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T, ttl?: number): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || ROUTE_CACHE_TTL,
    };
    localStorage.setItem(key, JSON.stringify(entry));
    cleanOldEntries();
  } catch {
    // localStorage full - clear old entries
    clearAllCache();
  }
}

// 오래된 캐시 정리
function cleanOldEntries(): void {
  try {
    const keys: { key: string; timestamp: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const entry = JSON.parse(raw);
            keys.push({ key, timestamp: entry.timestamp || 0 });
          }
        } catch { /* skip */ }
      }
    }
    // MAX_CACHE_ENTRIES 초과 시 오래된 것부터 삭제
    if (keys.length > MAX_CACHE_ENTRIES) {
      keys.sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
      toRemove.forEach(({ key }) => localStorage.removeItem(key));
    }
  } catch { /* ignore */ }
}

export function clearAllCache(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) toRemove.push(key);
    }
    toRemove.forEach(key => localStorage.removeItem(key));
  } catch { /* ignore */ }
}

export { PLACE_CACHE_TTL, ROUTE_CACHE_TTL };
