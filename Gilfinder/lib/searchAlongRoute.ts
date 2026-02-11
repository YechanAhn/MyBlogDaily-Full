import { LatLng, Place, SearchCategory } from './types';
import { samplePolyline, haversineDistance } from './polyline';

const CATEGORY_MAP: Record<SearchCategory, { keyword: string; code?: string }> = {
  all: { keyword: '' },
  coffee: { keyword: '카페', code: 'CE7' },
  fuel: { keyword: '주유소', code: 'OL7' },
  food: { keyword: '맛집', code: 'FD6' },
  convenience: { keyword: '편의점', code: 'CS2' },
  rest: { keyword: '고속도로휴게소' },
  custom: { keyword: '' },
};

// 총 거리 기반 가변 파라미터
function getRouteParams(totalDistanceKm: number): { radius: number; intervalKm: number } {
  if (totalDistanceKm < 30) return { radius: 500, intervalKm: 1 };
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

  // 경로를 5등분하여 세그먼트별 상위 6개씩 선택 (총 30개)
  const candidates = selectBySegments(filtered, polyline, 5, 6);

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

  return results.sort((a, b) => a.detourMinutes - b.detourMinutes);
}

/**
 * 경로를 N등분하여 세그먼트별 상위 M개 선택
 * 출발지 근처에 결과가 몰리는 문제 해결
 */
function selectBySegments(
  places: Place[],
  polyline: LatLng[],
  numSegments: number,
  perSegment: number
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

  // 각 장소가 경로의 어느 세그먼트에 속하는지 결정
  const segmented: Place[][] = Array.from({ length: numSegments }, () => []);

  for (const place of places) {
    // 경로 상에서 가장 가까운 포인트의 누적 거리 찾기
    let minDist = Infinity;
    let closestCumDist = 0;
    for (let i = 0; i < polyline.length; i++) {
      const d = haversineDistance(polyline[i], { lat: place.lat, lng: place.lng });
      if (d < minDist) {
        minDist = d;
        closestCumDist = cumDist[i];
      }
    }

    const segIdx = Math.min(
      Math.floor(closestCumDist / segmentLength),
      numSegments - 1
    );
    segmented[segIdx].push(place);
  }

  // 각 세그먼트에서 경로와 가장 가까운 상위 perSegment개 선택
  const selected: Place[] = [];
  for (const segment of segmented) {
    const sorted = segment.sort((a, b) => a.distance - b.distance);
    selected.push(...sorted.slice(0, perSegment));
  }

  return selected;
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

/**
 * 실제 경유 시 추가 시간/거리 계산
 * 원래 경로 대비 경유지 추가 경로의 차이를 Kakao API로 계산
 */
async function calculateDetourTimes(
  places: Place[],
  polyline: LatLng[],
  originalDuration?: number
): Promise<Place[]> {
  if (!originalDuration || polyline.length < 2) {
    // API 호출 불가 시 거리 기반 추정
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

  const origin = polyline[0];
  const destination = polyline[polyline.length - 1];

  // 5개씩 배치로 실제 경유 경로 계산
  const results: Place[] = [];
  for (let i = 0; i < places.length; i += 5) {
    const batch = places.slice(i, i + 5);
    const promises = batch.map(async (place) => {
      try {
        const res = await fetch('/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin,
            destination,
            waypoints: [{ lat: place.lat, lng: place.lng, name: place.name }],
          }),
        });
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        const routes = data.routes;
        if (routes?.length) {
          const newDuration = routes[0].summary?.duration || 0;
          const newDistance = routes[0].summary?.distance || 0;
          const deltaDuration = newDuration - originalDuration;
          const deltaDistance = newDistance - (polyline.length > 0 ? calculateRouteDistance(polyline) : 0);
          return {
            ...place,
            detourMinutes: Math.max(0, Math.round(deltaDuration / 60)),
            detourDistance: Math.max(0, Math.round(deltaDistance)),
          };
        }
      } catch {
        // 실패 시 거리 기반 추정
      }
      const nearestDist = nearestRouteDistance(polyline, { lat: place.lat, lng: place.lng });
      const distMeters = nearestDist * 1000;
      const drivingMin = (distMeters * 1.4 / 1000) / 40 * 60 * 2;
      return {
        ...place,
        detourMinutes: Math.max(1, Math.round(drivingMin + 3)),
        detourDistance: Math.round(distMeters * 1.4 * 2),
      };
    });
    results.push(...await Promise.all(promises));
  }

  return results;
}

/**
 * 폴리라인 총 거리 계산 (m)
 */
function calculateRouteDistance(polyline: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < polyline.length; i++) {
    total += haversineDistance(polyline[i - 1], polyline[i]) * 1000;
  }
  return total;
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
        stations: places.map(p => ({ name: p.name, lat: p.lat, lng: p.lng })),
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

    if (keyword) params.set('query', keyword);
    if (categoryCode) params.set('category_group_code', categoryCode);
    if (!keyword && categoryCode) params.set('query', ' ');

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
