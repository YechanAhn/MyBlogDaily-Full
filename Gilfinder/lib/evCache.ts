/**
 * 전기차 충전소 정보 캐시 시스템
 *
 * 전략:
 * - 한국환경공단 전기자동차 충전소 정보 API 활용
 * - 지역코드(zcode)별로 데이터 조회, 충전소(statId) 단위로 집계
 * - 캐시 우선순위: 메모리 -> Redis(지역별 분할) -> /tmp 파일 -> null
 * - Redis에 지역별 분할 저장 (Upstash 1MB 제한 대응)
 * - 매일 1회 갱신 (충전기 타입/위치는 자주 변하지 않음)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { cacheGet, cacheSet, cacheMGet } from './redis';

// ===================== API 응답 파싱 =====================

/** XML 응답에서 <item> 목록 추출 (split 기반 -- 대용량 XML에서 스택 오버플로우 방지) */
function parseXmlItems(xml: string): Record<string, string>[] {
  const items: Record<string, string>[] = [];
  const parts = xml.split('<item>');
  // parts[0]은 <item> 이전 헤더, 나머지가 각 아이템
  for (let i = 1; i < parts.length; i++) {
    const endIdx = parts[i].indexOf('</item>');
    if (endIdx === -1) continue;
    const itemContent = parts[i].substring(0, endIdx);
    const fields: Record<string, string> = {};
    const fieldRegex = /<(\w+)>([^<]*)<\/\1>/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(itemContent)) !== null) {
      fields[fieldMatch[1]] = fieldMatch[2];
    }
    items.push(fields);
  }
  return items;
}

/** XML 응답에서 totalCount 추출 */
function parseTotalCount(xml: string): number {
  const match = xml.match(/<totalCount>(\d+)<\/totalCount>/);
  return match ? parseInt(match[1]) : 0;
}

// ===================== 데이터 타입 =====================

/** 충전소 단위 집계 데이터 */
export interface EvStation {
  statId: string;        // 충전소 ID
  statNm: string;        // 충전소명
  addr: string;          // 주소
  lat: number;           // 위도
  lng: number;           // 경도
  chargerTypes: string[]; // 충전기 타입 코드 목록 (중복 제거)
  maxOutput: number;     // 최대 충전 용량 (kW)
  busiNm: string;        // 운영기관명
  useTime: string;       // 이용 가능 시간
  parkingFree: boolean;  // 주차료 무료
  chargerCount: number;  // 충전기 총 수
  zcode: string;         // 지역코드
}

interface EvCache {
  stations: EvStation[];
  updatedAt: number;     // Unix timestamp (ms)
}

/** Redis 메타데이터 (지역별 분할 저장 시 사용) */
interface EvCacheMeta {
  updatedAt: number;     // Unix timestamp (ms)
  zcodes: string[];      // 저장된 지역코드 목록
}

// ===================== 지역 코드 =====================

const ZCODES: { code: string; name: string }[] = [
  { code: '11', name: '서울' },
  { code: '26', name: '부산' },
  { code: '27', name: '대구' },
  { code: '28', name: '인천' },
  { code: '29', name: '광주' },
  { code: '30', name: '대전' },
  { code: '31', name: '울산' },
  { code: '36', name: '세종' },
  { code: '41', name: '경기' },
  { code: '42', name: '강원' },
  { code: '43', name: '충북' },
  { code: '44', name: '충남' },
  { code: '45', name: '전북' },
  { code: '46', name: '전남' },
  { code: '47', name: '경북' },
  { code: '48', name: '경남' },
  { code: '50', name: '제주' },
];

// Redis 키 프리픽스
const REDIS_META_KEY = 'ev:meta';
const REDIS_REGION_PREFIX = 'ev:';
const REDIS_TTL = 90000; // 25시간 (초 단위)

/** 좌표 기반 지역코드 추정 (대략적 바운딩박스) */
export function estimateZcodeFromCoords(lat: number, lng: number): string | null {
  const regions: { code: string; minLat: number; maxLat: number; minLng: number; maxLng: number }[] = [
    { code: '11', minLat: 37.4, maxLat: 37.7, minLng: 126.7, maxLng: 127.2 }, // 서울
    { code: '26', minLat: 34.9, maxLat: 35.3, minLng: 128.8, maxLng: 129.3 }, // 부산
    { code: '27', minLat: 35.7, maxLat: 36.0, minLng: 128.4, maxLng: 128.8 }, // 대구
    { code: '28', minLat: 37.3, maxLat: 37.6, minLng: 126.3, maxLng: 126.8 }, // 인천
    { code: '29', minLat: 35.0, maxLat: 35.3, minLng: 126.7, maxLng: 127.0 }, // 광주
    { code: '30', minLat: 36.2, maxLat: 36.5, minLng: 127.2, maxLng: 127.6 }, // 대전
    { code: '31', minLat: 35.4, maxLat: 35.7, minLng: 129.0, maxLng: 129.5 }, // 울산
    { code: '36', minLat: 36.4, maxLat: 36.7, minLng: 126.8, maxLng: 127.1 }, // 세종
    { code: '41', minLat: 36.9, maxLat: 37.9, minLng: 126.4, maxLng: 127.8 }, // 경기
    { code: '42', minLat: 37.0, maxLat: 38.3, minLng: 127.5, maxLng: 129.4 }, // 강원
    { code: '43', minLat: 36.4, maxLat: 37.2, minLng: 127.3, maxLng: 128.3 }, // 충북
    { code: '44', minLat: 36.0, maxLat: 37.0, minLng: 126.1, maxLng: 127.4 }, // 충남
    { code: '45', minLat: 35.3, maxLat: 36.1, minLng: 126.4, maxLng: 127.5 }, // 전북
    { code: '46', minLat: 34.1, maxLat: 35.5, minLng: 126.0, maxLng: 127.5 }, // 전남
    { code: '47', minLat: 35.6, maxLat: 37.1, minLng: 128.3, maxLng: 129.6 }, // 경북
    { code: '48', minLat: 34.7, maxLat: 35.9, minLng: 127.5, maxLng: 129.0 }, // 경남
    { code: '50', minLat: 33.1, maxLat: 33.6, minLng: 126.1, maxLng: 127.0 }, // 제주
  ];
  for (const r of regions) {
    if (lat >= r.minLat && lat <= r.maxLat && lng >= r.minLng && lng <= r.maxLng) {
      return r.code;
    }
  }
  return null;
}

/** 주소에서 지역코드 추출 */
export function getZcodeFromAddress(address: string): string | null {
  const map: Record<string, string> = {
    '서울': '11', '부산': '26', '대구': '27', '인천': '28',
    '광주': '29', '대전': '30', '울산': '31', '세종': '36',
    '경기': '41', '강원': '42', '충북': '43', '충청북': '43',
    '충남': '44', '충청남': '44', '전북': '45', '전라북': '45',
    '전남': '46', '전라남': '46', '경북': '47', '경상북': '47',
    '경남': '48', '경상남': '48', '제주': '50',
  };
  for (const [prefix, code] of Object.entries(map)) {
    if (address.includes(prefix)) return code;
  }
  return null;
}

// ===================== 캐시 시스템 =====================

let memoryCache: EvCache | null = null;
const CACHE_FILE = '/tmp/ontheway-ev-cache.json';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간

/** Redis에서 특정 지역들의 충전소 데이터 로드 */
async function loadRegionsFromRedis(zcodes: string[]): Promise<EvStation[]> {
  if (zcodes.length === 0) return [];
  const keys = zcodes.map(z => `${REDIS_REGION_PREFIX}${z}`);
  const results = await cacheMGet<EvStation[]>(keys);
  const stations: EvStation[] = [];
  for (const regionStations of results) {
    if (regionStations && Array.isArray(regionStations)) {
      for (const s of regionStations) stations.push(s);
    }
  }
  return stations;
}

/** 캐시 읽기 (메모리 -> Redis -> /tmp 파일 -> null) */
export async function getEvCache(): Promise<EvCache | null> {
  // 1. 메모리 캐시
  if (memoryCache && Date.now() - memoryCache.updatedAt < CACHE_TTL) {
    return memoryCache;
  }

  // 2. Redis 캐시 (지역별 분할)
  try {
    const meta = await cacheGet<EvCacheMeta>(REDIS_META_KEY);
    if (meta && Date.now() - meta.updatedAt < CACHE_TTL && meta.zcodes?.length > 0) {
      const stations = await loadRegionsFromRedis(meta.zcodes);
      if (stations.length > 0) {
        const cache: EvCache = { stations, updatedAt: meta.updatedAt };
        memoryCache = cache;
        console.log(`[EvCache] Redis에서 ${stations.length}개 충전소 로드 (${meta.zcodes.length}개 지역)`);
        return cache;
      }
    }
  } catch {
    // Redis 실패 시 /tmp 폴백
  }

  // 3. /tmp 파일 백업
  try {
    if (existsSync(CACHE_FILE)) {
      const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
      if (Date.now() - data.updatedAt < CACHE_TTL) {
        memoryCache = data;
        return data;
      }
    }
  } catch {
    // 파일 읽기 실패 무시
  }

  return null;
}

/** Redis에서 특정 지역만 로드 (부분 조회용) */
export async function getEvCacheForRegions(zcodes: string[]): Promise<EvStation[]> {
  // 1. 메모리 캐시에서 해당 지역 필터링
  if (memoryCache && Date.now() - memoryCache.updatedAt < CACHE_TTL) {
    const zcodeSet = new Set(zcodes);
    return memoryCache.stations.filter(s => zcodeSet.has(s.zcode));
  }

  // 2. Redis에서 필요한 지역만 로드
  try {
    const meta = await cacheGet<EvCacheMeta>(REDIS_META_KEY);
    if (meta && Date.now() - meta.updatedAt < CACHE_TTL) {
      // 요청 지역 중 Redis에 있는 것만 필터
      const available = zcodes.filter(z => meta.zcodes.includes(z));
      if (available.length > 0) {
        return await loadRegionsFromRedis(available);
      }
    }
  } catch {
    // Redis 실패 무시
  }

  return [];
}

/** 캐시 상태 확인 */
export async function getEvCacheStatus(): Promise<{
  hasCachedData: boolean;
  stationCount: number;
  updatedAt: string | null;
  ageMinutes: number | null;
}> {
  const cache = await getEvCache();
  if (!cache) {
    return { hasCachedData: false, stationCount: 0, updatedAt: null, ageMinutes: null };
  }
  return {
    hasCachedData: true,
    stationCount: cache.stations.length,
    updatedAt: new Date(cache.updatedAt).toISOString(),
    ageMinutes: Math.round((Date.now() - cache.updatedAt) / 60000),
  };
}

// ===================== API 호출 =====================

const EV_API_BASE = 'https://apis.data.go.kr/B552584/EvCharger/getChargerInfo';

/** 특정 지역의 충전소 데이터 조회 */
async function fetchRegion(
  apiKey: string,
  zcode: string,
  pageNo: number = 1,
  numOfRows: number = 9999
): Promise<{ items: Record<string, string>[]; totalCount: number }> {
  // Encoding 키(이미 URL 인코딩됨)를 그대로 사용
  const url = `${EV_API_BASE}?ServiceKey=${apiKey}&zcode=${zcode}&pageNo=${pageNo}&numOfRows=${numOfRows}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    throw new Error(`API 호출 실패: ${res.status}`);
  }

  const text = await res.text();

  // JSON 응답인지 확인
  if (text.trim().startsWith('{')) {
    try {
      const json = JSON.parse(text);
      const items = json?.items?.item || json?.body?.items?.item || [];
      const totalCount = json?.body?.totalCount || json?.totalCount || 0;
      return { items: Array.isArray(items) ? items : [items], totalCount };
    } catch {
      // JSON 파싱 실패 시 XML로 처리
    }
  }

  // XML 파싱
  const items = parseXmlItems(text);
  const totalCount = parseTotalCount(text);
  return { items, totalCount };
}

/** API 응답 아이템 -> 충전기 데이터로 변환 */
function parseChargerItem(item: Record<string, string>): {
  statId: string;
  statNm: string;
  addr: string;
  lat: number;
  lng: number;
  chgerType: string;
  output: number;
  busiNm: string;
  useTime: string;
  parkingFree: boolean;
  zcode: string;
} | null {
  const statId = item.statId;
  const lat = parseFloat(item.lat);
  const lng = parseFloat(item.lng);
  if (!statId || !lat || !lng) return null;

  return {
    statId,
    statNm: item.statNm || '',
    addr: item.addr || '',
    lat,
    lng,
    chgerType: item.chgerType || '',
    output: parseInt(item.output) || 0,
    busiNm: item.busiNm || '',
    useTime: item.useTime || '',
    parkingFree: item.parkingFree === 'Y',
    zcode: item.zcode || '',
  };
}

/** 충전기 목록을 충전소 단위로 집계 */
function aggregateByStation(chargers: ReturnType<typeof parseChargerItem>[]): EvStation[] {
  const stationMap = new Map<string, EvStation>();

  for (const c of chargers) {
    if (!c) continue;
    const existing = stationMap.get(c.statId);
    if (existing) {
      if (c.chgerType && !existing.chargerTypes.includes(c.chgerType)) {
        existing.chargerTypes.push(c.chgerType);
      }
      existing.maxOutput = Math.max(existing.maxOutput, c.output);
      existing.chargerCount += 1;
    } else {
      stationMap.set(c.statId, {
        statId: c.statId,
        statNm: c.statNm,
        addr: c.addr,
        lat: c.lat,
        lng: c.lng,
        chargerTypes: c.chgerType ? [c.chgerType] : [],
        maxOutput: c.output,
        busiNm: c.busiNm,
        useTime: c.useTime,
        parkingFree: c.parkingFree,
        chargerCount: 1,
        zcode: c.zcode,
      });
    }
  }

  return Array.from(stationMap.values());
}

// ===================== Redis 저장 (지역별 분할) =====================

/** 충전소 데이터를 지역별로 분할하여 Redis에 저장 */
async function saveToRedis(stations: EvStation[]): Promise<void> {
  // 지역별 분류
  const byRegion = new Map<string, EvStation[]>();
  for (const s of stations) {
    const zcode = s.zcode || '00';
    if (!byRegion.has(zcode)) byRegion.set(zcode, []);
    byRegion.get(zcode)!.push(s);
  }

  const zcodes = Array.from(byRegion.keys());

  // 지역별 병렬 저장
  const savePromises = zcodes.map(zcode =>
    cacheSet(`${REDIS_REGION_PREFIX}${zcode}`, byRegion.get(zcode)!, REDIS_TTL)
  );

  // 메타데이터 저장
  const meta: EvCacheMeta = {
    updatedAt: Date.now(),
    zcodes,
  };
  savePromises.push(cacheSet(REDIS_META_KEY, meta, REDIS_TTL));

  await Promise.all(savePromises);
  console.log(`[EvCache] Redis에 ${zcodes.length}개 지역 저장 완료 (총 ${stations.length}개 충전소)`);
}

// ===================== 매칭 =====================

/** 캐시에서 좌표 근처 충전소 검색 */
async function getNearbyStations(
  lat: number,
  lng: number,
  radiusKm: number
): Promise<{ station: EvStation; distanceKm: number }[]> {
  const cache = await getEvCache();
  if (!cache) return [];

  const results: { station: EvStation; distanceKm: number }[] = [];
  for (const s of cache.stations) {
    const dlat = s.lat - lat;
    const dlng = s.lng - lng;
    const approxKm = Math.sqrt(dlat * dlat + dlng * dlng) * 111;
    if (approxKm <= radiusKm) {
      results.push({ station: s, distanceKm: approxKm });
    }
  }
  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results;
}

/** 충전소 이름+좌표로 매칭 */
export async function matchEvStation(
  placeName: string,
  placeLat: number,
  placeLng: number,
  placeAddress?: string
): Promise<EvStation | null> {
  const normalize = (name: string) =>
    name
      .replace(/충전소|충전기|전기차|EV|ev|\(.*?\)|주차장|공용/gi, '')
      .replace(/[()·\-_#]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const normalized = normalize(placeName);
  const nearby = await getNearbyStations(placeLat, placeLng, 3);
  if (nearby.length === 0) return null;

  // 1차: 이름 매칭 + 거리
  let best: { station: EvStation; score: number } | null = null;

  for (const { station, distanceKm } of nearby) {
    const sNorm = normalize(station.statNm);

    let nameScore = 0;
    if (sNorm === normalized) {
      nameScore = 3;
    } else if (sNorm.includes(normalized) || normalized.includes(sNorm)) {
      nameScore = 2;
    } else {
      // 토큰 매칭
      const tokensA = normalized.split(/\s+/).filter(w => w.length >= 2);
      const tokensB = sNorm.split(/\s+/).filter(w => w.length >= 2);
      let hits = 0;
      for (const a of tokensA) {
        for (const b of tokensB) {
          if (a === b || a.includes(b) || b.includes(a)) hits++;
        }
      }
      if (hits > 0) nameScore = 1 + Math.min(1, hits * 0.3);
    }

    // 주소 매칭 보너스
    if (placeAddress && station.addr) {
      const normAddr = placeAddress.replace(/\s+/g, '').toLowerCase();
      const statAddr = station.addr.replace(/\s+/g, '').toLowerCase();
      if (normAddr.includes(statAddr) || statAddr.includes(normAddr)) {
        nameScore += 1.5;
      }
    }

    if (nameScore <= 0) continue;

    const distScore = Math.max(0, 1 - distanceKm / 3);
    const score = nameScore * 2 + distScore;

    if (!best || score > best.score) {
      best = { station, score };
    }
  }

  if (best && best.score >= 1.5) return best.station;

  // 2차: 200m 이내 가장 가까운 충전소
  const closest = nearby[0];
  if (closest && closest.distanceKm <= 0.2) {
    return closest.station;
  }

  return null;
}

// ===================== 캐시 갱신 =====================

/** 특정 지역들만 조회하여 부분 캐시 갱신 */
export async function fetchRegions(
  apiKey: string,
  zcodes: string[]
): Promise<EvStation[]> {
  const allChargers: ReturnType<typeof parseChargerItem>[] = [];

  for (const zcode of zcodes) {
    try {
      const { items, totalCount } = await fetchRegion(apiKey, zcode, 1, 9999);
      for (const item of items) {
        allChargers.push(parseChargerItem(item));
      }

      // 9999개 초과 시 추가 페이지 조회
      if (totalCount > 9999) {
        const totalPages = Math.ceil(totalCount / 9999);
        for (let page = 2; page <= totalPages; page++) {
          const extra = await fetchRegion(apiKey, zcode, page, 9999);
          for (const item of extra.items) {
            allChargers.push(parseChargerItem(item));
          }
          await new Promise(r => setTimeout(r, 200));
        }
      }
    } catch (e) {
      console.error(`[EvCache] 지역 ${zcode} 조회 실패:`, e);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  return aggregateByStation(allChargers);
}

/** 전국 충전소 캐시 갱신 */
export async function refreshEvCache(
  apiKey: string
): Promise<{ totalStations: number; apiCalls: number; errors: number; firstError: string | null }> {
  const allChargers: ReturnType<typeof parseChargerItem>[] = [];
  let apiCalls = 0;
  let errors = 0;
  let firstError: string | null = null;

  // 배치 처리 (3개 지역씩)
  for (let i = 0; i < ZCODES.length; i += 3) {
    const batch = ZCODES.slice(i, i + 3);
    const promises = batch.map(async ({ code }) => {
      try {
        apiCalls++;
        const { items, totalCount } = await fetchRegion(apiKey, code, 1, 9999);
        const chargers = items.map(parseChargerItem);

        // 9999개 초과 시 추가 페이지
        if (totalCount > 9999) {
          const totalPages = Math.ceil(totalCount / 9999);
          for (let page = 2; page <= totalPages; page++) {
            apiCalls++;
            const extra = await fetchRegion(apiKey, code, page, 9999);
            for (const item of extra.items) chargers.push(parseChargerItem(item));
            await new Promise(r => setTimeout(r, 300));
          }
        }

        return chargers;
      } catch (e: any) {
        errors++;
        if (!firstError) firstError = `${code}: ${e?.message || String(e)}`;
        console.error(`[EvCache] ${code} 조회 실패:`, e);
        return [];
      }
    });

    const results = await Promise.all(promises);
    for (const chargers of results) {
      for (const c of chargers) allChargers.push(c);
    }

    if (i + 3 < ZCODES.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  const stations = aggregateByStation(allChargers);

  // 캐시 저장
  const cache: EvCache = {
    stations,
    updatedAt: Date.now(),
  };

  memoryCache = cache;

  // /tmp 파일 저장
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch {
    // /tmp 외 쓰기 불가할 수 있음
  }

  // Redis에 지역별 분할 저장
  try {
    await saveToRedis(stations);
  } catch (e) {
    console.error('[EvCache] Redis 저장 실패:', e);
  }

  return {
    totalStations: stations.length,
    apiCalls,
    errors,
    firstError,
  };
}
