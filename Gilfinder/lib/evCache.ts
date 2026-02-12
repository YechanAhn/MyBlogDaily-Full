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
import { cacheGet, cacheSet, cacheMGet, cachePipelineSet } from './redis';

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

  const res = await fetch(url, { signal: AbortSignal.timeout(55000) });
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

// ===================== 지오 그리드 인덱스 =====================

/** 그리드 인덱스용 간소화 데이터 (Redis 용량 최소화) */
interface EvStationCompact {
  i: string;   // statId
  n: string;   // statNm
  la: number;  // lat
  ln: number;  // lng
  ct: string[];// chargerTypes
  mo: number;  // maxOutput
  b: string;   // busiNm
  cc: number;  // chargerCount
  ut: string;  // useTime
  pf: boolean; // parkingFree
}

/** 매칭 결과 타입 */
export interface EvMatchResult {
  statId: string;          // 충전소 ID (실시간 상태 조회용)
  chargerTypes: string[];
  maxOutput: number;
  operator: string;
  chargerCount: number;
  useTime: string;
  parkingFree: boolean;
}

const GRID_PREFIX = 'ev:g:';
const GRID_TTL = 604800; // 7일 (초)

/** 좌표를 그리드 셀 키로 변환 (0.01° ≈ 1.1km × 0.9km) */
function toGridKey(lat: number, lng: number): string {
  return `${GRID_PREFIX}${Math.floor(lat * 100)}:${Math.floor(lng * 100)}`;
}

/** 풀 충전소 데이터를 간소화 */
function compactStation(s: EvStation): EvStationCompact {
  return {
    i: s.statId, n: s.statNm, la: s.lat, ln: s.lng,
    ct: s.chargerTypes, mo: s.maxOutput, b: s.busiNm,
    cc: s.chargerCount, ut: s.useTime, pf: s.parkingFree,
  };
}

/** 지오 그리드 인덱스 생성 후 Redis 저장 (pipeline으로 대량 저장 최적화) */
async function saveGeoIndex(stations: EvStation[]): Promise<number> {
  const grid = new Map<string, EvStationCompact[]>();
  for (const s of stations) {
    const key = toGridKey(s.lat, s.lng);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(compactStation(s));
  }

  // Redis pipeline으로 대량 저장 (개별 SET 대신 배치 파이프라인)
  const pipelineEntries = Array.from(grid.entries()).map(([key, data]) => ({
    key,
    value: data,
    ttl: GRID_TTL,
  }));
  const saved = await cachePipelineSet(pipelineEntries);

  // 그리드 메타 저장
  await cacheSet('ev:grid:meta', { cellCount: grid.size, updatedAt: Date.now(), savedCells: saved }, GRID_TTL);

  console.log(`[EvCache] 지오 그리드 인덱스: ${grid.size}개 셀, ${saved}개 저장 성공`);
  return grid.size;
}

/** compact 데이터를 매칭 결과로 변환 */
function formatCompactMatch(c: EvStationCompact): EvMatchResult {
  return {
    statId: c.i,
    chargerTypes: c.ct,
    maxOutput: c.mo,
    operator: c.b,
    chargerCount: c.cc,
    useTime: c.ut,
    parkingFree: c.pf,
  };
}

/** 좌표 목록으로 주변 충전소 일괄 조회 (그리드 인덱스 사용) */
export async function lookupEvByGrid(
  places: { name: string; lat: number; lng: number; address?: string }[]
): Promise<(EvMatchResult | null)[]> {
  if (places.length === 0) return [];

  // 1. 각 장소의 3x3 그리드 셀 키 수집 (주변 셀 포함)
  const keySet = new Set<string>();
  for (const p of places) {
    const baseLat = Math.floor(p.lat * 100);
    const baseLng = Math.floor(p.lng * 100);
    for (let dl = -1; dl <= 1; dl++) {
      for (let dn = -1; dn <= 1; dn++) {
        keySet.add(`${GRID_PREFIX}${baseLat + dl}:${baseLng + dn}`);
      }
    }
  }

  // 2. 한번의 mget으로 모든 필요한 셀 로드
  const keys = Array.from(keySet);
  const cellData = await cacheMGet<EvStationCompact[]>(keys);

  // 셀 데이터를 맵으로 변환
  const cellMap = new Map<string, EvStationCompact[]>();
  keys.forEach((k, i) => {
    if (cellData[i] && Array.isArray(cellData[i])) {
      cellMap.set(k, cellData[i]!);
    }
  });

  // 3. 각 장소별 매칭
  return places.map(p => {
    const baseLat = Math.floor(p.lat * 100);
    const baseLng = Math.floor(p.lng * 100);

    // 3x3 셀에서 후보 수집
    const candidates: EvStationCompact[] = [];
    for (let dl = -1; dl <= 1; dl++) {
      for (let dn = -1; dn <= 1; dn++) {
        const cell = cellMap.get(`${GRID_PREFIX}${baseLat + dl}:${baseLng + dn}`);
        if (cell) candidates.push(...cell);
      }
    }

    if (candidates.length === 0) return null;

    // 거리 계산 + 정렬 (1km 이내만)
    const withDist = candidates.map(c => ({
      ...c,
      distKm: Math.sqrt((c.la - p.lat) ** 2 + (c.ln - p.lng) ** 2) * 111
    })).filter(c => c.distKm <= 1.0).sort((a, b) => a.distKm - b.distKm);

    if (withDist.length === 0) return null;

    // 300m 이내 → 즉시 매칭 (거의 확실히 같은 장소)
    if (withDist[0].distKm <= 0.3) return formatCompactMatch(withDist[0]);

    // 이름 매칭 시도
    const normalize = (name: string) =>
      name.replace(/충전소|충전기|전기차|EV|ev|\(.*?\)|주차장|공용/gi, '')
        .replace(/[()·\-_#]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const pNorm = normalize(p.name);

    for (const c of withDist) {
      const cNorm = normalize(c.n);
      if (cNorm.includes(pNorm) || pNorm.includes(cNorm)) return formatCompactMatch(c);
      const tokensA = pNorm.split(/\s+/).filter(w => w.length >= 2);
      const tokensB = cNorm.split(/\s+/).filter(w => w.length >= 2);
      for (const a of tokensA) {
        for (const b of tokensB) {
          if (a === b || a.includes(b) || b.includes(a)) return formatCompactMatch(c);
        }
      }
    }

    // 500m 이내 폴백 (이름 매칭 실패해도 가까우면 매칭)
    if (withDist[0].distKm <= 0.5) return formatCompactMatch(withDist[0]);

    return null;
  });
}

/** 그리드 인덱스 폴백: 지역 캐시에서 직접 매칭 (느리지만 확실) */
export async function lookupEvFallback(
  places: { name: string; lat: number; lng: number; address?: string }[]
): Promise<(EvMatchResult | null)[]> {
  // 필요한 지역코드 수집
  const zcodeSet = new Set<string>();
  for (const p of places) {
    const z = estimateZcodeFromCoords(p.lat, p.lng);
    if (z) zcodeSet.add(z);
  }

  if (zcodeSet.size === 0) return places.map(() => null);

  // 지역별 캐시 로드
  const stations = await getEvCacheForRegions(Array.from(zcodeSet));
  if (stations.length === 0) return places.map(() => null);

  // 각 장소별 매칭
  return places.map(p => {
    const nearby = stations
      .map(s => ({
        station: s,
        dist: Math.sqrt((s.lat - p.lat) ** 2 + (s.lng - p.lng) ** 2) * 111,
      }))
      .filter(s => s.dist <= 1.0)
      .sort((a, b) => a.dist - b.dist);

    if (nearby.length === 0) return null;

    // 300m 이내 최근접
    if (nearby[0].dist <= 0.3) {
      const s = nearby[0].station;
      return { statId: s.statId, chargerTypes: s.chargerTypes, maxOutput: s.maxOutput, operator: s.busiNm, chargerCount: s.chargerCount, useTime: s.useTime, parkingFree: s.parkingFree };
    }

    // 이름 매칭
    const normalize = (name: string) =>
      name.replace(/충전소|충전기|전기차|EV|ev|\(.*?\)|주차장|공용/gi, '')
        .replace(/[()·\-_#]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const pNorm = normalize(p.name);

    for (const { station: s } of nearby) {
      const sNorm = normalize(s.statNm);
      if (sNorm.includes(pNorm) || pNorm.includes(sNorm)) {
        return { statId: s.statId, chargerTypes: s.chargerTypes, maxOutput: s.maxOutput, operator: s.busiNm, chargerCount: s.chargerCount, useTime: s.useTime, parkingFree: s.parkingFree };
      }
    }

    // 500m 폴백
    if (nearby[0].dist <= 0.5) {
      const s = nearby[0].station;
      return { statId: s.statId, chargerTypes: s.chargerTypes, maxOutput: s.maxOutput, operator: s.busiNm, chargerCount: s.chargerCount, useTime: s.useTime, parkingFree: s.parkingFree };
    }

    return null;
  });
}

// ===================== 직접 API 폴백 (Redis 비활성화 시) =====================

// 인메모리 캐시: 지역별 충전소 데이터 (10분 TTL)
const directApiCache = new Map<string, { stations: EvStation[]; fetchedAt: number }>();
const DIRECT_CACHE_TTL = 10 * 60 * 1000; // 10분

/** Redis가 비어있을 때 data.go.kr API에서 직접 조회하여 매칭 */
export async function lookupEvDirectApi(
  places: { name: string; lat: number; lng: number; address?: string }[]
): Promise<(EvMatchResult | null)[]> {
  if (places.length === 0) return [];

  const apiKey = process.env.DATA_GO_KR_API_KEY;
  if (!apiKey) {
    console.error('[EvCache] DATA_GO_KR_API_KEY가 설정되지 않음');
    return places.map(() => null);
  }

  // 1. 필요한 지역코드 수집 (중복 제거)
  const zcodeSet = new Set<string>();
  for (const p of places) {
    const z = estimateZcodeFromCoords(p.lat, p.lng);
    if (z) zcodeSet.add(z);
  }

  if (zcodeSet.size === 0) return places.map(() => null);

  // 2. 지역별 데이터 조회 (인메모리 캐시 사용)
  const allStations: EvStation[] = [];
  const zcodes = Array.from(zcodeSet);

  for (const zcode of zcodes) {
    // 캐시 확인 (10분 이내 데이터)
    const cached = directApiCache.get(zcode);
    if (cached && Date.now() - cached.fetchedAt < DIRECT_CACHE_TTL) {
      allStations.push(...cached.stations);
      continue;
    }

    // API 호출
    try {
      const { items } = await fetchRegion(apiKey, zcode, 1, 9999);
      const chargers = items.map(parseChargerItem).filter(Boolean) as ReturnType<typeof parseChargerItem>[];
      const stations = aggregateByStation(chargers);

      // 캐시 저장
      directApiCache.set(zcode, { stations, fetchedAt: Date.now() });
      allStations.push(...stations);

      console.log(`[EvCache] 직접 API 조회: 지역 ${zcode} → ${stations.length}개 충전소`);
    } catch (e) {
      console.error(`[EvCache] 직접 API 조회 실패 (지역 ${zcode}):`, e);
      // 실패 시 해당 지역은 건너뛰기
    }

    // API 호출 간 짧은 대기 (rate limit 방지)
    await new Promise(r => setTimeout(r, 200));
  }

  if (allStations.length === 0) return places.map(() => null);

  // 3. 각 장소별 매칭 (lookupEvByGrid와 동일한 로직)
  return places.map(p => {
    const nearby = allStations
      .map(s => ({
        station: s,
        dist: Math.sqrt((s.lat - p.lat) ** 2 + (s.lng - p.lng) ** 2) * 111,
      }))
      .filter(s => s.dist <= 1.0)
      .sort((a, b) => a.dist - b.dist);

    if (nearby.length === 0) return null;

    // 300m 이내 → 즉시 매칭
    if (nearby[0].dist <= 0.3) {
      const s = nearby[0].station;
      return {
        statId: s.statId,
        chargerTypes: s.chargerTypes,
        maxOutput: s.maxOutput,
        operator: s.busiNm,
        chargerCount: s.chargerCount,
        useTime: s.useTime,
        parkingFree: s.parkingFree,
      };
    }

    // 이름 매칭
    const normalize = (name: string) =>
      name.replace(/충전소|충전기|전기차|EV|ev|\(.*?\)|주차장|공용/gi, '')
        .replace(/[()·\-_#]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const pNorm = normalize(p.name);

    for (const { station: s } of nearby) {
      const sNorm = normalize(s.statNm);
      if (sNorm.includes(pNorm) || pNorm.includes(sNorm)) {
        return {
          statId: s.statId,
          chargerTypes: s.chargerTypes,
          maxOutput: s.maxOutput,
          operator: s.busiNm,
          chargerCount: s.chargerCount,
          useTime: s.useTime,
          parkingFree: s.parkingFree,
        };
      }

      // 토큰 매칭
      const tokensA = pNorm.split(/\s+/).filter(w => w.length >= 2);
      const tokensB = sNorm.split(/\s+/).filter(w => w.length >= 2);
      for (const a of tokensA) {
        for (const b of tokensB) {
          if (a === b || a.includes(b) || b.includes(a)) {
            return {
              statId: s.statId,
              chargerTypes: s.chargerTypes,
              maxOutput: s.maxOutput,
              operator: s.busiNm,
              chargerCount: s.chargerCount,
              useTime: s.useTime,
              parkingFree: s.parkingFree,
            };
          }
        }
      }
    }

    // 500m 이내 폴백
    if (nearby[0].dist <= 0.5) {
      const s = nearby[0].station;
      return {
        statId: s.statId,
        chargerTypes: s.chargerTypes,
        maxOutput: s.maxOutput,
        operator: s.busiNm,
        chargerCount: s.chargerCount,
        useTime: s.useTime,
        parkingFree: s.parkingFree,
      };
    }

    return null;
  });
}

// ===================== 매칭 (레거시) =====================

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

  // 지오 그리드 인덱스 생성
  try {
    const cellCount = await saveGeoIndex(stations);
    console.log(`[EvCache] 그리드 인덱스: ${cellCount}개 셀`);
  } catch (e) {
    console.error('[EvCache] 그리드 인덱스 생성 실패:', e);
  }

  return {
    totalStations: stations.length,
    apiCalls,
    errors,
    firstError,
  };
}

// ===================== 배치 갱신 =====================

/** 배치별 지역 분할 (6배치 x ~3지역) */
const BATCH_REGIONS: string[][] = [
  ['11', '26', '27'],   // 서울, 부산, 대구
  ['28', '29', '30'],   // 인천, 광주, 대전
  ['31', '36', '41'],   // 울산, 세종, 경기
  ['42', '43', '44'],   // 강원, 충북, 충남
  ['45', '46', '47'],   // 전북, 전남, 경북
  ['48', '50'],         // 경남, 제주
];

/** 배치 단위 캐시 갱신 (3개 지역씩) */
export async function refreshEvBatch(
  apiKey: string,
  batchIndex: number
): Promise<{ totalStations: number; apiCalls: number; errors: number; firstError: string | null; batch: number }> {
  if (batchIndex < 0 || batchIndex >= BATCH_REGIONS.length) {
    return { totalStations: 0, apiCalls: 0, errors: 0, firstError: 'Invalid batch index', batch: batchIndex };
  }

  const regionCodes = BATCH_REGIONS[batchIndex];
  const allChargers: ReturnType<typeof parseChargerItem>[] = [];
  let apiCalls = 0;
  let errors = 0;
  let firstError: string | null = null;

  for (const code of regionCodes) {
    try {
      apiCalls++;
      const { items, totalCount } = await fetchRegion(apiKey, code, 1, 9999);
      for (const item of items) allChargers.push(parseChargerItem(item));

      if (totalCount > 9999) {
        const totalPages = Math.ceil(totalCount / 9999);
        for (let page = 2; page <= totalPages; page++) {
          apiCalls++;
          const extra = await fetchRegion(apiKey, code, page, 9999);
          for (const item of extra.items) allChargers.push(parseChargerItem(item));
          await new Promise(r => setTimeout(r, 300));
        }
      }
    } catch (e: any) {
      errors++;
      if (!firstError) firstError = `${code}: ${e?.message || String(e)}`;
      console.error(`[EvCache] Batch ${batchIndex} - ${code} 조회 실패:`, e);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  const stations = aggregateByStation(allChargers);

  // 그리드 셀 직접 빌드 (per-region Redis는 1MB 제한에 걸릴 수 있으므로 그리드만 저장)
  let cellCount = 0;
  try {
    cellCount = await saveGeoIndex(stations);
    console.log(`[EvCache] Batch ${batchIndex}: ${regionCodes.join(',')} → ${stations.length}개 충전소, ${cellCount}개 그리드 셀`);
  } catch (e) {
    console.error(`[EvCache] Batch ${batchIndex} 그리드 저장 실패:`, e);
  }

  return { totalStations: stations.length, apiCalls, errors, firstError, batch: batchIndex };
}

/** Redis에 저장된 지역 데이터로 그리드 인덱스 빌드 (API 호출 없음) */
export async function buildGridFromRedis(): Promise<{ cellCount: number; stationCount: number }> {
  try {
    const meta = await cacheGet<EvCacheMeta>(REDIS_META_KEY);
    if (!meta?.zcodes?.length) {
      return { cellCount: 0, stationCount: 0 };
    }

    const stations = await loadRegionsFromRedis(meta.zcodes);
    if (stations.length === 0) {
      return { cellCount: 0, stationCount: 0 };
    }

    const cellCount = await saveGeoIndex(stations);
    console.log(`[EvCache] 그리드 인덱스 빌드 완료: ${cellCount}개 셀, ${stations.length}개 충전소`);
    return { cellCount, stationCount: stations.length };
  } catch (e) {
    console.error('[EvCache] 그리드 인덱스 빌드 실패:', e);
    return { cellCount: 0, stationCount: 0 };
  }
}

// ===================== 실시간 충전기 상태 =====================

const STATUS_API_BASE = 'https://apis.data.go.kr/B552584/EvCharger/getChargerStatus';
const STATUS_CACHE_PREFIX = 'ev:status:';
const STATUS_CACHE_TTL = 180; // 3분

/** 개별 충전기 상태 데이터 */
export interface ChargerUnitStatus {
  chgerId: string;      // 충전기 ID
  stat: string;         // 상태 코드 (1~9)
  statUpdDt: string;    // 상태 갱신일시
  nowTsdt: string;      // 현재 충전 시작일시
  lastTsdt: string;     // 마지막 충전 시작일시
  lastTedt: string;     // 마지막 충전 종료일시
}

/** 충전소 단위 상태 집계 */
export interface StationStatus {
  statId: string;
  chargers: ChargerUnitStatus[];
  total: number;
  available: number;    // 충전대기(2)
  charging: number;     // 충전중(3)
  broken: number;       // 통신이상(1) + 운영중지(4) + 점검중(5)
  unknown: number;      // 상태미확인(9)
}

/** 특정 충전소의 실시간 충전기 상태 조회 */
export async function getChargerStatusByStation(
  statId: string,
  lat: number,
  lng: number
): Promise<StationStatus | null> {
  const apiKey = process.env.DATA_GO_KR_API_KEY;
  if (!apiKey) return null;

  // 좌표로 지역코드 추정
  const zcode = estimateZcodeFromCoords(lat, lng);
  if (!zcode) return null;

  const cacheKey = `${STATUS_CACHE_PREFIX}${zcode}`;

  // 1. Redis 캐시 확인 (지역 단위)
  try {
    const cached = await cacheGet<Record<string, ChargerUnitStatus[]>>(cacheKey);
    if (cached && cached[statId]) {
      return aggregateStationStatus(statId, cached[statId]);
    }
    // 캐시는 있지만 해당 statId가 없는 경우 - 캐시가 최근 것이면 null 반환
    if (cached) return null;
  } catch { /* 캐시 실패 시 API 호출 진행 */ }

  // 2. API 호출 (지역 전체)
  try {
    const url = `${STATUS_API_BASE}?ServiceKey=${apiKey}&zcode=${zcode}&numOfRows=9999&pageNo=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;

    const text = await res.text();
    let items: Record<string, string>[];

    if (text.trim().startsWith('{')) {
      try {
        const json = JSON.parse(text);
        const rawItems = json?.items?.item || json?.body?.items?.item || [];
        items = Array.isArray(rawItems) ? rawItems : [rawItems];
      } catch {
        items = parseXmlItems(text);
      }
    } else {
      items = parseXmlItems(text);
    }

    // statId별 그룹핑
    const grouped: Record<string, ChargerUnitStatus[]> = {};
    for (const item of items) {
      const sid = item.statId;
      if (!sid) continue;
      if (!grouped[sid]) grouped[sid] = [];
      grouped[sid].push({
        chgerId: item.chgerId || '',
        stat: item.stat || '9',
        statUpdDt: item.statUpdDt || '',
        nowTsdt: item.nowTsdt || '',
        lastTsdt: item.lastTsdt || '',
        lastTedt: item.lastTedt || '',
      });
    }

    // Redis에 캐시 (3분 TTL)
    try {
      await cacheSet(cacheKey, grouped, STATUS_CACHE_TTL);
    } catch { /* 캐시 저장 실패 무시 */ }

    if (grouped[statId]) {
      return aggregateStationStatus(statId, grouped[statId]);
    }
    return null;
  } catch (e) {
    console.error('[EvStatus] API 호출 실패:', e);
    return null;
  }
}

/** 충전기 상태 목록 → 충전소 단위 집계 */
function aggregateStationStatus(statId: string, chargers: ChargerUnitStatus[]): StationStatus {
  let available = 0, charging = 0, broken = 0, unknown = 0;
  for (const c of chargers) {
    switch (c.stat) {
      case '2': available++; break;
      case '3': charging++; break;
      case '1': case '4': case '5': broken++; break;
      default: unknown++; break;
    }
  }
  return { statId, chargers, total: chargers.length, available, charging, broken, unknown };
}
