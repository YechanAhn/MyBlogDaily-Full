import { LatLng, Place, SearchCategory } from './types';
import { samplePolyline, haversineDistance } from './polyline';

const CATEGORY_MAP: Record<SearchCategory, { keyword: string; code?: string }> = {
  all: { keyword: '' },
  coffee: { keyword: '', code: 'CE7' },
  fuel: { keyword: '', code: 'OL7' },
  food: { keyword: '', code: 'FD6' },
  convenience: { keyword: '', code: 'CS2' },
  rest: { keyword: '고속도로휴게소' },
  dessert: { keyword: '두쫀쿠' },
  custom: { keyword: '' },
};

// 총 거리 기반 가변 파라미터
function getRouteParams(totalDistanceKm: number): { radius: number; intervalKm: number } {
  if (totalDistanceKm < 10) return { radius: 400, intervalKm: 0.3 };
  if (totalDistanceKm < 30) return { radius: 500, intervalKm: 0.7 };
  if (totalDistanceKm < 100) return { radius: 1000, intervalKm: 2 };
  if (totalDistanceKm < 300) return { radius: 2000, intervalKm: 3 };
  return { radius: 3000, intervalKm: 5 };
}

/**
 * Search for places along a route using Kakao Local API
 * 경로를 5등분하여 세그먼트별 균등 선택
 */
export async function searchAlongRoute(
  polyline: LatLng[],
  category: SearchCategory,
  customKeyword?: string,
  maxDetourMin: number = 5,
  originalDuration?: number,
  onProgress?: (percent: number, text: string) => void
): Promise<Place[]> {
  const catInfo = CATEGORY_MAP[category];
  const keyword = category === 'custom' ? (customKeyword || '') : catInfo.keyword;
  if (!keyword && !catInfo.code) return [];

  onProgress?.(35, '경로 분석 중...');

  // 총 거리 계산
  const totalDistanceKm = calculateTotalDistance(polyline);
  const { radius, intervalKm } = getRouteParams(totalDistanceKm);

  const samplePoints = samplePolyline(polyline, intervalKm);
  const allResults: Place[] = [];
  const seenIds = new Set<string>();
  const totalBatches = Math.ceil(samplePoints.length / 3);

  onProgress?.(40, '주변 장소 검색 중...');

  // Search in batches of 3 to be gentle on API
  for (let i = 0; i < samplePoints.length; i += 3) {
    const batch = samplePoints.slice(i, i + 3);
    const batchIdx = Math.floor(i / 3);
    // 40% ~ 65% 구간에서 검색 진행률 표시
    const searchProgress = 40 + Math.round((batchIdx / totalBatches) * 25);
    onProgress?.(searchProgress, `장소 검색 중... (${batchIdx + 1}/${totalBatches})`);

    const promises = batch.map((point) =>
      fetchPlaces(keyword, point.lng, point.lat, radius, catInfo.code)
    );
    const results = await Promise.all(promises);

    for (const places of results) {
      for (const place of places) {
        if (!seenIds.has(place.id)) {
          seenIds.add(place.id);
          const routeDist = nearestRouteDistance(polyline, { lat: place.lat, lng: place.lng });
          allResults.push({ ...place, distance: Math.round(routeDist * 1000) });
        }
      }
    }
  }

  onProgress?.(68, `${allResults.length}개 장소 필터링 중...`);

  // 휴게소 필터링: 이름에 "휴게소" 포함 필수, "졸음"/"간이" 제외
  let filtered = allResults;
  if (category === 'rest') {
    filtered = allResults.filter(p => {
      if (!p.name.includes('휴게소')) return false;
      if (p.name.includes('졸음') || p.name.includes('간이')) return false;
      return true;
    });
  }

  const numSegments = 10;
  const segPerCount = (category === 'food' || category === 'coffee') ? 5 : 3;
  const candidates = selectBySegments(filtered, polyline, numSegments, segPerCount, category);

  onProgress?.(72, '우회 시간 계산 중...');
  let withDetour = await calculateDetourTimes(candidates, polyline, originalDuration);

  // 주유소 카테고리일 때 OPINET API로 가격 데이터 보강
  if (category === 'fuel') {
    onProgress?.(85, '주유소 가격 조회 중...');
    withDetour = await enrichFuelPrices(withDetour);
  }

  onProgress?.(92, '결과 정렬 중...');
  const results = withDetour.filter(p => p.detourMinutes <= maxDetourMin);

  // 주유소: 최저가 기준 정렬
  if (category === 'fuel') {
    return results.sort((a, b) => {
      if (a.fuelPrice && b.fuelPrice) return a.fuelPrice - b.fuelPrice;
      if (a.fuelPrice) return -1;
      if (b.fuelPrice) return 1;
      return a.detourMinutes - b.detourMinutes;
    });
  }

  return results;  // 세그먼트 순서 유지
}

/**
 * 경로를 N등분하여 세그먼트별 상위 M개 선택
 * 출발지 근처에 결과가 몰리는 문제 해결
 * 거리와 인기도를 함께 고려하여 선택
 */
function selectBySegments(
  places: Place[],
  polyline: LatLng[],
  numSegments: number,
  perSegment: number,
  category: SearchCategory
): Place[] {
  if (polyline.length < 2) return places.slice(0, numSegments * perSegment);

  // 경로의 누적 거리 계산
  const cumDist: number[] = [0];
  for (let i = 1; i < polyline.length; i++) {
    cumDist.push(cumDist[i - 1] + haversineDistance(polyline[i - 1], polyline[i]));
  }
  const totalDist = cumDist[cumDist.length - 1];
  if (totalDist === 0) return places.slice(0, numSegments * perSegment);

  const segmentLength = totalDist / numSegments;

  const segments: { start: LatLng; end: LatLng; lengthKm: number; cumStartKm: number }[] = [];
  for (let i = 0; i < polyline.length - 1; i++) {
    const start = polyline[i];
    const end = polyline[i + 1];
    const lengthKm = haversineDistance(start, end);
    segments.push({ start, end, lengthKm, cumStartKm: cumDist[i] });
  }

  const toLocalXY = (lat: number, lng: number, refLat: number) => {
    const rad = Math.PI / 180;
    const k = 111.32; // km per degree
    return {
      x: lng * Math.cos(refLat * rad) * k,
      y: lat * k,
    };
  };

  const closestAlongRoute = (place: LatLng) => {
    let bestDist = Infinity;
    let bestAlongKm = 0;
    for (const seg of segments) {
      const refLat = (seg.start.lat + seg.end.lat) / 2;
      const a = toLocalXY(seg.start.lat, seg.start.lng, refLat);
      const b = toLocalXY(seg.end.lat, seg.end.lng, refLat);
      const p = toLocalXY(place.lat, place.lng, refLat);
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const apx = p.x - a.x;
      const apy = p.y - a.y;
      const abLen2 = abx * abx + aby * aby;
      const t = abLen2 === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLen2));
      const cx = a.x + abx * t;
      const cy = a.y + aby * t;
      const dist = Math.hypot(p.x - cx, p.y - cy);
      if (dist < bestDist) {
        bestDist = dist;
        bestAlongKm = seg.cumStartKm + seg.lengthKm * t;
      }
    }
    return bestAlongKm;
  };

  // 각 장소가 경로의 어느 세그먼트에 속하는지 결정 (세그먼트 투영 기준)
  const segmented: Place[][] = Array.from({ length: numSegments }, () => []);

  for (const place of places) {
    const alongKm = closestAlongRoute({ lat: place.lat, lng: place.lng });
    const segIdx = Math.min(Math.floor(alongKm / segmentLength), numSegments - 1);
    segmented[segIdx].push(place);
  }

  // 각 세그먼트에서 거리와 인기도를 고려한 점수 기반 선택
  const totalQuota = numSegments * perSegment;
  let remaining = totalQuota;
  const firstPass: Place[] = [];
  const overflowSegments: { idx: number; extras: Place[] }[] = [];

  for (let i = 0; i < segmented.length; i++) {
    const segment = segmented[i];

    if (segment.length === 0) continue;

    // 거리와 리뷰 수를 모두 고려한 점수 기반 정렬
    // 거리가 가까울수록, 리뷰가 많을수록 점수가 낮음 (낮을수록 우선순위 높음)
    const distWeight = (category === 'food' || category === 'coffee' || category === 'dessert') ? 0 : 0.7;
    const scored = segment.map(p => ({
      ...p,
      _score: p.distance * distWeight + (p.reviewCount ? -Math.log(p.reviewCount + 1) * 200 : 0),
    }));
    scored.sort((a, b) => a._score - b._score);

    // 세그먼트당 할당량만큼 선택
    const take = Math.min(perSegment, scored.length);
    firstPass.push(...scored.slice(0, take));
    remaining -= take;

    // 여분이 있는 세그먼트는 나중에 재분배용으로 저장
    if (scored.length > perSegment) {
      overflowSegments.push({ idx: i, extras: scored.slice(perSegment) });
    }
  }

  // 빈 세그먼트의 할당량을 다른 세그먼트에 재분배
  if (remaining > 0 && overflowSegments.length > 0) {
    let added = true;
    while (remaining > 0 && added) {
      added = false;
      for (const bucket of overflowSegments) {
        if (bucket.extras.length === 0) continue;
        firstPass.push(bucket.extras.shift()!);
        remaining -= 1;
        added = true;
        if (remaining <= 0) break;
      }
    }
  }

  return firstPass;
}

/**
 * 총 경로 거리 계산 (km)
 */
function calculateTotalDistance(polyline: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < polyline.length; i++) {
    total += haversineDistance(polyline[i - 1], polyline[i]);
  }
  return total;
}

async function calculateDetourTimes(
  places: Place[],
  polyline: LatLng[],
  _originalDuration?: number
): Promise<Place[]> {
  return places.map(place => {
    const nearestDist = nearestRouteDistance(polyline, { lat: place.lat, lng: place.lng });
    const distMeters = nearestDist * 1000;
    // 도로 계수 1.4 적용, 평균 40km/h 가정, 왕복
    const drivingMin = (distMeters * 1.4 / 1000) / 40 * 60 * 2;
    // 고속도로 진출입 시간 추가 (약 3분)
    const detourMinutes = Math.max(1, Math.round(drivingMin + 3));
    return { ...place, detourMinutes, detourDistance: Math.round(distMeters * 1.4 * 2) };
  });
}

function nearestRouteDistance(polyline: LatLng[], point: LatLng): number {
  let minDist = Infinity;
  for (const p of polyline) {
    const d = haversineDistance(p, point);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * 주유소 가격 데이터 보강 - 서버 캐시에서 일괄 매칭
 */
async function enrichFuelPrices(places: Place[]): Promise<Place[]> {
  if (places.length === 0) return places;

  try {
    const res = await fetch('/api/fuel-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stations: places.map(p => ({
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          address: p.address,
          roadAddress: p.roadAddress,
        })),
      }),
    });
    if (!res.ok) return places;
    const data = await res.json();
    const prices: ({ price: number; prodcd: string; isSelf: boolean } | null)[] = data.prices || [];

    return places.map((place, i) => {
      const match = prices[i];
      if (match) {
        return {
          ...place,
          fuelPrice: match.price,
          fuelType: match.prodcd,
          isSelfService: match.isSelf,
        };
      }
      if (place.name.includes('셀프')) {
        return { ...place, isSelfService: true };
      }
      return place;
    });
  } catch {
    return places;
  }
}

async function fetchPlaces(
  keyword: string,
  lng: number,
  lat: number,
  radius: number,
  categoryCode?: string
): Promise<Place[]> {
  try {
    const params = new URLSearchParams({
      x: lng.toString(),
      y: lat.toString(),
      radius: radius.toString(),
      sort: 'distance',
      size: '15',
    });

    if (!keyword && categoryCode) {
      // 카테고리 코드만 있는 경우 카테고리 검색 API 사용
      params.set('category_group_code', categoryCode);
      params.set('mode', 'category');
    } else {
      if (keyword) params.set('query', keyword);
      if (categoryCode) params.set('category_group_code', categoryCode);
    }

    const res = await fetch(`/api/search?${params.toString()}`);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.documents || []).map((doc: any) => ({
      id: doc.id,
      name: doc.place_name,
      category: doc.category_group_name || doc.category_name || '',
      categoryCode: doc.category_group_code || '',
      address: doc.address_name || '',
      roadAddress: doc.road_address_name || '',
      phone: doc.phone || '',
      lat: parseFloat(doc.y),
      lng: parseFloat(doc.x),
      distance: parseInt(doc.distance) || 0,
      detourMinutes: 0,
      placeUrl: doc.place_url || '',
    }));
  } catch {
    return [];
  }
}
