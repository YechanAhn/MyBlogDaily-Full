/**
 * OPINET 주유소 가격 캐시 시스템
 *
 * 전략:
 * - 매일 오전 7시 (OPINET 6시 갱신 후) 전국 주요 지점에서 aroundAll 조회
 * - 서버 메모리에 캐시, /tmp에 파일 백업 (Vercel cold start 대비)
 * - 주유소 이름 + 좌표로 Kakao 검색 결과와 매칭
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

// ===================== KATEC 좌표 변환 =====================
// OPINET은 KATEC(Bessel TM) 좌표계 사용, Kakao는 WGS84
// 중심: 128°E, 38°N / Scale: 0.9999 / FE: 400000, FN: 600000

function wgs84ToKatec(lonDeg: number, latDeg: number): { x: number; y: number } {
  const toRad = (d: number) => (d * Math.PI) / 180;

  // WGS84 → Bessel datum shift (Molodensky 근사)
  const dX = -146.43, dY = 507.89, dZ = 681.46;
  const lon = toRad(lonDeg), lat = toRad(latDeg);

  const aW = 6378137.0, fW = 1 / 298.257223563;
  const e2W = 2 * fW - fW * fW;
  const N = aW / Math.sqrt(1 - e2W * Math.sin(lat) ** 2);

  const X = N * Math.cos(lat) * Math.cos(lon) + dX;
  const Y = N * Math.cos(lat) * Math.sin(lon) + dY;
  const Z = N * (1 - e2W) * Math.sin(lat) + dZ;

  // 3D → Bessel 경위도
  const aB = 6377397.155, fB = 1 / 299.1528128;
  const e2B = 2 * fB - fB * fB;
  const p = Math.sqrt(X * X + Y * Y);
  const lonB = Math.atan2(Y, X);
  let latB = Math.atan2(Z, p * (1 - e2B));
  for (let i = 0; i < 10; i++) {
    const Nb = aB / Math.sqrt(1 - e2B * Math.sin(latB) ** 2);
    latB = Math.atan2(Z + e2B * Nb * Math.sin(latB), p);
  }

  // Bessel → KATEC TM 투영
  const lon0 = toRad(128), lat0 = toRad(38);
  const k0 = 0.9999, FE = 400000, FN = 600000;
  const ep2 = e2B / (1 - e2B);
  const Ntm = aB / Math.sqrt(1 - e2B * Math.sin(latB) ** 2);
  const T = Math.tan(latB) ** 2;
  const C = ep2 * Math.cos(latB) ** 2;
  const A = (lonB - lon0) * Math.cos(latB);

  const e4 = e2B ** 2, e6 = e2B ** 3;
  const arcLen = (phi: number) =>
    aB * ((1 - e2B / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
      - (3 * e2B / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
      + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi)
      - (35 * e6 / 3072) * Math.sin(6 * phi));

  const M = arcLen(latB), M0 = arcLen(lat0);

  const x = k0 * Ntm * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120);
  const y = k0 * (M - M0 + Ntm * Math.tan(latB) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720));

  return { x: FE + x, y: FN + y };
}

function katecToWgs84(x: number, y: number): { lng: number; lat: number } {
  // 간소화된 역변환 (KATEC → Bessel → WGS84)
  const aB = 6377397.155, fB = 1 / 299.1528128;
  const e2B = 2 * fB - fB * fB;
  const ep2 = e2B / (1 - e2B);
  const k0 = 0.9999, FE = 400000, FN = 600000;
  const lon0 = (128 * Math.PI) / 180;
  const lat0 = (38 * Math.PI) / 180;
  const e4 = e2B ** 2, e6 = e2B ** 3;

  const arcLen0 = aB * ((1 - e2B / 4 - 3 * e4 / 64 - 5 * e6 / 256) * lat0
    - (3 * e2B / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * lat0)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * lat0)
    - (35 * e6 / 3072) * Math.sin(6 * lat0));

  const M1 = arcLen0 + (y - FN) / k0;
  const mu = M1 / (aB * (1 - e2B / 4 - 3 * e4 / 64 - 5 * e6 / 256));
  const e1 = (1 - Math.sqrt(1 - e2B)) / (1 + Math.sqrt(1 - e2B));

  const lat1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu);

  const N1 = aB / Math.sqrt(1 - e2B * Math.sin(lat1) ** 2);
  const T1 = Math.tan(lat1) ** 2;
  const C1 = ep2 * Math.cos(lat1) ** 2;
  const R1 = aB * (1 - e2B) / (1 - e2B * Math.sin(lat1) ** 2) ** 1.5;
  const D = (x - FE) / (N1 * k0);

  const latB = lat1 - (N1 * Math.tan(lat1) / R1) * (D ** 2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6 / 720);
  const lonB = lon0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5 / 120) / Math.cos(lat1);

  // Bessel → WGS84 (역 Molodensky)
  const latDeg = (latB * 180) / Math.PI + 0.00003;
  const lonDeg = (lonB * 180) / Math.PI - 0.00012;

  return { lng: lonDeg, lat: latDeg };
}

// ===================== 캐시 시스템 =====================

// OPINET 주유소 가격 데이터
export interface FuelStation {
  UNI_ID: string;      // 주유소 고유 ID
  OS_NM: string;       // 주유소명
  PRICE: number;       // 가격 (원/L)
  PRODCD: string;      // 유종 코드 (B027=휘발유, D047=경유, K015=LPG)
  POLL_DIV_CD: string; // 브랜드 코드
  lng: number;         // 경도 (WGS84 변환값)
  lat: number;         // 위도
  DISTANCE: number;    // 조회 지점으로부터 거리
  NEW_ADR: string;     // 도로명주소
  VAN_ADR: string;     // 지번주소
}

interface FuelCache {
  stations: FuelStation[];
  updatedAt: number;   // Unix timestamp (ms)
  fuelType: string;    // 캐시된 유종
}

// 서버 메모리 캐시
let memoryCache: FuelCache | null = null;

const CACHE_FILE = '/tmp/ontheway-fuel-cache.json';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간

// 전국 주요 고속도로/도시 그리드 포인트 (~150개)
// 경부, 서해안, 중부, 영동, 호남, 남해 고속도로 + 주요 도시 + 내륙 커버리지 강화
const GRID_POINTS: { lat: number; lng: number; name: string }[] = [
  // 수도권
  { lat: 37.566, lng: 126.978, name: '서울' },
  { lat: 37.456, lng: 126.705, name: '인천' },
  { lat: 37.263, lng: 127.029, name: '수원' },
  { lat: 37.390, lng: 127.100, name: '성남' },
  { lat: 37.750, lng: 127.040, name: '의정부' },
  { lat: 37.325, lng: 126.831, name: '안산' },
  { lat: 37.500, lng: 127.140, name: '하남' },

  // 경부고속도로 (서울→부산)
  { lat: 37.095, lng: 127.067, name: '평택' },
  { lat: 36.820, lng: 127.114, name: '천안' },
  { lat: 36.635, lng: 127.230, name: '세종' },
  { lat: 36.351, lng: 127.385, name: '대전' },
  { lat: 36.107, lng: 127.488, name: '옥천' },
  { lat: 35.870, lng: 128.030, name: '김천' },
  { lat: 35.872, lng: 128.602, name: '대구' },
  { lat: 35.640, lng: 128.750, name: '경산' },
  { lat: 35.540, lng: 129.030, name: '울산' },
  { lat: 35.540, lng: 129.350, name: '울산동' },
  { lat: 35.180, lng: 129.076, name: '부산' },
  { lat: 35.100, lng: 129.030, name: '부산남' },
  { lat: 35.230, lng: 128.880, name: '양산' },

  // 서해안고속도로 (서울→목포)
  { lat: 36.770, lng: 126.930, name: '아산' },
  { lat: 36.570, lng: 126.860, name: '홍성' },
  { lat: 36.330, lng: 126.860, name: '보령' },
  { lat: 35.970, lng: 126.720, name: '군산' },
  { lat: 35.820, lng: 126.890, name: '김제' },
  { lat: 35.500, lng: 126.720, name: '함평' },
  { lat: 34.812, lng: 126.393, name: '목포' },

  // 호남고속도로 (대전→광주)
  { lat: 36.080, lng: 127.150, name: '논산' },
  { lat: 35.820, lng: 127.148, name: '전주' },
  { lat: 35.600, lng: 127.050, name: '정읍' },
  { lat: 35.160, lng: 126.920, name: '광주' },
  { lat: 35.060, lng: 126.870, name: '광주남' },
  { lat: 34.950, lng: 127.490, name: '순천' },
  { lat: 34.740, lng: 127.736, name: '여수' },

  // 중부고속도로
  { lat: 37.060, lng: 127.300, name: '용인' },
  { lat: 36.980, lng: 127.930, name: '충주' },
  { lat: 36.830, lng: 127.680, name: '음성' },
  { lat: 36.640, lng: 127.490, name: '청주' },

  // 영동고속도로 (서울→강릉)
  { lat: 37.338, lng: 127.945, name: '원주' },
  { lat: 37.350, lng: 128.350, name: '횡성' },
  { lat: 37.440, lng: 128.720, name: '평창' },
  { lat: 37.752, lng: 128.876, name: '강릉' },

  // 중부내륙/중앙고속도로
  { lat: 37.880, lng: 127.730, name: '춘천' },
  { lat: 36.570, lng: 128.730, name: '안동' },
  { lat: 35.970, lng: 128.380, name: '구미' },
  { lat: 36.040, lng: 129.360, name: '포항' },
  { lat: 35.860, lng: 129.220, name: '경주' },

  // 남해고속도로 (부산→순천)
  { lat: 35.075, lng: 128.580, name: '창원' },
  { lat: 35.090, lng: 128.830, name: '김해' },
  { lat: 35.000, lng: 128.060, name: '진주' },
  { lat: 34.950, lng: 127.800, name: '하동' },
  { lat: 35.180, lng: 128.070, name: '사천' },

  // 동해안
  { lat: 37.480, lng: 129.165, name: '동해' },
  { lat: 37.170, lng: 129.070, name: '삼척' },
  { lat: 38.210, lng: 128.590, name: '속초' },

  // 보충 지점
  { lat: 36.320, lng: 127.120, name: '계룡' },
  { lat: 35.350, lng: 127.150, name: '남원' },
  { lat: 36.810, lng: 128.260, name: '문경' },
  { lat: 35.490, lng: 128.490, name: '창녕' },
  { lat: 36.430, lng: 128.160, name: '상주' },
  { lat: 35.820, lng: 127.700, name: '무주' },
  { lat: 37.180, lng: 128.210, name: '제천' },
  { lat: 36.990, lng: 126.660, name: '서산' },
  { lat: 35.310, lng: 129.010, name: '기장' },
  { lat: 36.780, lng: 126.450, name: '태안' },
  { lat: 35.970, lng: 126.980, name: '익산' },
  { lat: 34.570, lng: 126.570, name: '해남' },
  { lat: 33.500, lng: 126.530, name: '제주' },
  { lat: 33.250, lng: 126.250, name: '서귀포' },

  // 고속도로 IC 주변 보충
  { lat: 37.200, lng: 127.430, name: '이천' },
  { lat: 37.100, lng: 127.700, name: '여주' },
  { lat: 36.350, lng: 128.690, name: '영주' },
  { lat: 36.190, lng: 128.880, name: '영천' },
  { lat: 35.230, lng: 128.600, name: '밀양' },
  { lat: 36.440, lng: 126.620, name: '서천' },
  { lat: 35.400, lng: 126.950, name: '담양' },

  // ===== 경기도 추가 커버리지 (가장 인구 많은 지역) =====
  { lat: 37.290, lng: 126.980, name: '안양' },
  { lat: 37.478, lng: 126.877, name: '부천' },
  { lat: 37.650, lng: 127.150, name: '남양주' },
  { lat: 37.206, lng: 127.077, name: '오산' },
  { lat: 37.340, lng: 127.125, name: '분당' },
  { lat: 37.450, lng: 127.127, name: '구리' },
  { lat: 37.640, lng: 127.025, name: '노원' },
  { lat: 37.860, lng: 127.200, name: '가평' },
  { lat: 37.740, lng: 127.047, name: '포천' },
  { lat: 37.758, lng: 126.780, name: '파주' },
  { lat: 37.630, lng: 126.830, name: '고양' },
  { lat: 37.290, lng: 126.850, name: '광명' },
  { lat: 37.486, lng: 126.656, name: '김포' },
  { lat: 37.275, lng: 127.009, name: '군포' },
  { lat: 37.155, lng: 127.090, name: '화성' },
  { lat: 37.000, lng: 127.270, name: '안성' },
  { lat: 37.140, lng: 127.260, name: '용인남' },
  { lat: 37.370, lng: 127.220, name: '광주' },
  { lat: 37.440, lng: 127.294, name: '하남동' },
  { lat: 37.200, lng: 126.850, name: '시흥' },

  // ===== 충남 내륙 강화 =====
  { lat: 36.460, lng: 126.660, name: '당진' },
  { lat: 36.270, lng: 126.990, name: '예산' },
  { lat: 36.240, lng: 126.800, name: '청양' },
  { lat: 36.275, lng: 127.120, name: '공주' },
  { lat: 36.158, lng: 127.250, name: '부여' },
  { lat: 36.547, lng: 126.660, name: '예천' },
  { lat: 36.600, lng: 127.000, name: '홍성동' },
  { lat: 36.105, lng: 126.613, name: '서천남' },

  // ===== 충북 내륙 강화 =====
  { lat: 36.970, lng: 127.490, name: '증평' },
  { lat: 36.790, lng: 127.440, name: '진천' },
  { lat: 36.580, lng: 127.290, name: '청주서' },
  { lat: 36.640, lng: 127.650, name: '청주동' },
  { lat: 36.470, lng: 127.670, name: '보은' },
  { lat: 36.220, lng: 127.520, name: '영동' },
  { lat: 36.370, lng: 128.410, name: '단양' },
  { lat: 36.620, lng: 128.200, name: '충주북' },
  { lat: 36.990, lng: 128.190, name: '제천동' },
  { lat: 36.800, lng: 128.050, name: '괴산' },

  // ===== 전북 내륙 강화 =====
  { lat: 35.720, lng: 127.100, name: '완주' },
  { lat: 35.650, lng: 127.250, name: '진안' },
  { lat: 35.450, lng: 127.380, name: '장수' },
  { lat: 35.950, lng: 127.150, name: '익산동' },
  { lat: 35.820, lng: 127.400, name: '전주동' },
  { lat: 35.570, lng: 126.856, name: '고창' },
  { lat: 35.420, lng: 126.700, name: '영광' },
  { lat: 35.680, lng: 126.780, name: '정읍서' },

  // ===== 전남 내륙 강화 =====
  { lat: 35.250, lng: 126.910, name: '장성' },
  { lat: 35.030, lng: 126.710, name: '영암' },
  { lat: 35.060, lng: 126.980, name: '나주' },
  { lat: 35.000, lng: 127.090, name: '화순' },
  { lat: 34.940, lng: 127.270, name: '보성' },
  { lat: 34.760, lng: 127.150, name: '고흥' },
  { lat: 34.610, lng: 127.280, name: '여수북' },
  { lat: 34.830, lng: 126.910, name: '무안' },
  { lat: 35.070, lng: 126.710, name: '함평북' },
  { lat: 34.610, lng: 126.750, name: '강진' },
  { lat: 34.500, lng: 126.770, name: '완도' },
  { lat: 34.730, lng: 126.480, name: '신안' },

  // ===== 경북 내륙 강화 =====
  { lat: 36.740, lng: 128.890, name: '안동동' },
  { lat: 36.470, lng: 128.890, name: '예천동' },
  { lat: 36.570, lng: 129.110, name: '영덕' },
  { lat: 36.420, lng: 129.360, name: '포항남' },
  { lat: 36.770, lng: 128.620, name: '봉화' },
  { lat: 36.570, lng: 129.340, name: '영양' },
  { lat: 36.660, lng: 128.450, name: '영주동' },
  { lat: 36.350, lng: 128.480, name: '예천서' },
  { lat: 36.010, lng: 128.690, name: '칠곡' },
  { lat: 36.230, lng: 128.340, name: '의성' },
  { lat: 36.420, lng: 128.750, name: '청송' },
  { lat: 36.130, lng: 129.060, name: '경주서' },

  // ===== 경남 내륙 강화 =====
  { lat: 35.230, lng: 128.300, name: '창녕동' },
  { lat: 35.680, lng: 128.320, name: '성주' },
  { lat: 35.680, lng: 128.110, name: '고령' },
  { lat: 35.510, lng: 128.210, name: '합천' },
  { lat: 35.250, lng: 127.910, name: '산청' },
  { lat: 35.420, lng: 127.740, name: '함양' },
  { lat: 35.650, lng: 127.910, name: '거창' },
  { lat: 35.470, lng: 128.750, name: '양산동' },
  { lat: 35.330, lng: 128.430, name: '창녕서' },
  { lat: 35.180, lng: 128.400, name: '창원북' },
  { lat: 35.050, lng: 128.270, name: '함안' },
  { lat: 35.170, lng: 127.730, name: '하동동' },
  { lat: 34.850, lng: 127.950, name: '남해' },

  // ===== 강원도 남부 강화 =====
  { lat: 37.380, lng: 128.680, name: '평창동' },
  { lat: 37.270, lng: 128.460, name: '영월' },
  { lat: 37.380, lng: 128.660, name: '정선' },
  { lat: 37.164, lng: 128.989, name: '태백' },
  { lat: 37.270, lng: 129.180, name: '삼척북' },
  { lat: 37.550, lng: 128.870, name: '강릉남' },
  { lat: 37.686, lng: 128.720, name: '홍천' },
  { lat: 37.490, lng: 127.730, name: '횡성서' },
  { lat: 38.070, lng: 128.460, name: '양양' },
  { lat: 38.208, lng: 128.350, name: '인제' },
  { lat: 37.900, lng: 127.530, name: '춘천남' },
];

/**
 * 캐시 읽기 (메모리 → 파일 → null)
 */
export function getCache(): FuelCache | null {
  // 메모리 캐시 확인
  if (memoryCache && Date.now() - memoryCache.updatedAt < CACHE_TTL) {
    return memoryCache;
  }

  // 파일 캐시 확인
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

/**
 * 캐시에서 좌표 근처 주유소 가격 검색
 */
function getNearbyStationsWithDistance(
  lat: number,
  lng: number,
  radiusKm: number
): { station: FuelStation; distanceKm: number }[] {
  const cache = getCache();
  if (!cache) return [];

  const results: { station: FuelStation; distanceKm: number }[] = [];
  for (const s of cache.stations) {
    const dlat = s.lat - lat;
    const dlng = s.lng - lng;
    // 간단 거리 계산 (정확도보다 속도 우선)
    const approxKm = Math.sqrt(dlat * dlat + dlng * dlng) * 111;
    if (approxKm <= radiusKm) {
      results.push({ station: s, distanceKm: approxKm });
    }
  }

  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results;
}

export function findNearbyPrices(
  lat: number,
  lng: number,
  radiusKm: number = 3
): FuelStation[] {
  return getNearbyStationsWithDistance(lat, lng, radiusKm).map(r => r.station);
}

/**
 * 주유소 이름으로 가격 매칭
 * OPINET KATEC→WGS84 변환 오차(3~5km)를 감안하여 넓은 반경 검색
 */
export function matchStationPrice(
  placeName: string,
  placeLat: number,
  placeLng: number,
  placeAddress?: string,
  placeRoadAddress?: string
): { price: number; prodcd: string; isSelf: boolean } | null {
  const isSelf = placeName.includes('셀프');
  const normalize = (name: string) =>
    name
      .replace(/주유소|셀프|self|㈜|\(주\)|직영|에너지플러스허브|에너지플러스|오일뱅크|S-?OIL|SK|GS|현대오일뱅크|알뜰/gi, '')
      .replace(/[()·\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const normalized = normalize(placeName);

  // KATEC 좌표 변환 오차 감안하여 넓은 반경 (12km)
  const nearby = getNearbyStationsWithDistance(placeLat, placeLng, 12);
  if (nearby.length === 0) return null;

  // 1차: 주소 매칭 (가장 정확)
  if (placeAddress || placeRoadAddress) {
    const normalizeAddr = (addr: string) =>
      addr.replace(/\s+/g, ' ').trim().toLowerCase();

    for (const { station, distanceKm } of nearby) {
      if (distanceKm > 5) continue; // 주소 매칭은 5km 이내만

      const vanAddr = normalizeAddr(station.VAN_ADR);
      const newAddr = normalizeAddr(station.NEW_ADR);

      if (!vanAddr && !newAddr) continue;

      // 도로명주소 매칭 (가장 정확)
      if (placeRoadAddress && newAddr) {
        const normPlaceRoad = normalizeAddr(placeRoadAddress);
        if (normPlaceRoad === newAddr || normPlaceRoad.includes(newAddr) || newAddr.includes(normPlaceRoad)) {
          return {
            price: station.PRICE,
            prodcd: station.PRODCD,
            isSelf: isSelf || station.OS_NM.includes('셀프'),
          };
        }
      }

      // 지번주소 매칭
      if (placeAddress && vanAddr) {
        const normPlaceAddr = normalizeAddr(placeAddress);
        if (normPlaceAddr === vanAddr || normPlaceAddr.includes(vanAddr) || vanAddr.includes(normPlaceAddr)) {
          return {
            price: station.PRICE,
            prodcd: station.PRODCD,
            isSelf: isSelf || station.OS_NM.includes('셀프'),
          };
        }
      }
    }
  }

  const tokens = (name: string) => name.split(/\s+/).filter(w => w.length >= 2);

  const scoreNameMatch = (a: string, b: string) => {
    if (!a || !b) return 0;
    if (a === b) return 3;
    if (a.includes(b) || b.includes(a)) return 2.2;
    const wordsA = tokens(a);
    const wordsB = tokens(b);
    let hits = 0;
    for (const w1 of wordsA) {
      for (const w2 of wordsB) {
        if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) hits++;
      }
    }
    return hits > 0 ? 1 + Math.min(1.2, hits * 0.4) : 0;
  };

  let best: { station: FuelStation; score: number } | null = null;

  for (const { station, distanceKm } of nearby) {
    const sNorm = normalize(station.OS_NM);
    const nameScore = scoreNameMatch(normalized, sNorm);
    if (nameScore <= 0) continue;
    const distScore = Math.max(0, 1 - distanceKm / 12);
    const score = nameScore * 2 + distScore;
    if (!best || score > best.score) {
      best = { station, score };
    }
  }

  if (best) {
    return {
      price: best.station.PRICE,
      prodcd: best.station.PRODCD,
      isSelf: isSelf || best.station.OS_NM.includes('셀프'),
    };
  }

  // 2차: 가장 가까운 주유소의 가격을 참고치로 제공 (12km 이내, KATEC 변환 오차 감안)
  const closest = nearby[0];
  if (closest) {
    return {
      price: closest.station.PRICE,
      prodcd: closest.station.PRODCD,
      isSelf: isSelf || closest.station.OS_NM.includes('셀프'),
    };
  }

  return null;
}

/**
 * 전국 주유소 가격 캐시 갱신
 * OPINET aroundAll API를 그리드 포인트별로 호출
 */
export async function refreshFuelCache(
  apiKey: string,
  fuelType: string = 'B027'
): Promise<{ totalStations: number; apiCalls: number; errors: number }> {
  const allStations = new Map<string, FuelStation>();
  let apiCalls = 0;
  let errors = 0;

  // 배치 처리 (3개씩, API 부하 방지)
  for (let i = 0; i < GRID_POINTS.length; i += 3) {
    const batch = GRID_POINTS.slice(i, i + 3);
    const promises = batch.map(async (point) => {
      try {
        // WGS84 → KATEC 좌표 변환 (OPINET은 KATEC 좌표계 사용)
        const katec = wgs84ToKatec(point.lng, point.lat);
        const url = `https://www.opinet.co.kr/api/aroundAll.do?code=${apiKey}&x=${Math.round(katec.x)}&y=${Math.round(katec.y)}&radius=7000&prodcd=${fuelType}&sort=2&out=json`;
        apiCalls++;

        const res = await fetch(url);
        if (!res.ok) {
          errors++;
          return [];
        }

        const data = await res.json();
        const oils = data?.RESULT?.OIL || [];

        return oils.map((oil: any) => {
          // KATEC 좌표 → WGS84 변환
          const gisX = parseFloat(oil.GIS_X_COOR);
          const gisY = parseFloat(oil.GIS_Y_COOR);
          const wgs = (gisX && gisY) ? katecToWgs84(gisX, gisY) : { lng: point.lng, lat: point.lat };

          return {
            UNI_ID: oil.UNI_ID,
            OS_NM: oil.OS_NM,
            PRICE: parseInt(oil.PRICE) || 0,
            PRODCD: oil.PRODCD || fuelType,
            POLL_DIV_CD: oil.POLL_DIV_CD || '',
            lng: wgs.lng,
            lat: wgs.lat,
            DISTANCE: parseFloat(oil.DISTANCE) || 0,
            NEW_ADR: oil.NEW_ADR || '',
            VAN_ADR: oil.VAN_ADR || '',
          };
        });
      } catch {
        errors++;
        return [];
      }
    });

    const results = await Promise.all(promises);
    for (const stations of results) {
      for (const station of stations) {
        if (station.UNI_ID && station.PRICE > 0) {
          allStations.set(station.UNI_ID, station);
        }
      }
    }

    // API 부하 방지 대기
    if (i + 3 < GRID_POINTS.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // 캐시 저장
  const cache: FuelCache = {
    stations: Array.from(allStations.values()),
    updatedAt: Date.now(),
    fuelType,
  };

  memoryCache = cache;

  // 파일 백업
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch {
    // Vercel에서는 /tmp 외 쓰기 불가할 수 있음
  }

  return {
    totalStations: allStations.size,
    apiCalls,
    errors,
  };
}

/**
 * 캐시 상태 확인
 */
export function getCacheStatus(): {
  hasCachedData: boolean;
  stationCount: number;
  updatedAt: string | null;
  ageMinutes: number | null;
} {
  const cache = getCache();
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
