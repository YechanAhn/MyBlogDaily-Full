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
  originalDuration?: number
): Promise<Place[]> {
  const catInfo = CATEGORY_MAP[category];
  const keyword = category === 'custom' ? (customKeyword || '') : catInfo.keyword;
  if (!keyword && !catInfo.code) return [];

  // 총 거리 계산
  const totalDistanceKm = calculateTotalDistance(polyline);
  const { radius, intervalKm } = getRouteParams(totalDistanceKm);

  const samplePoints = samplePolyline(polyline, intervalKm);
  const allResults: Place[] = [];
  const seenIds = new Set<string>();

  // Search in batches of 3 to be gentle on API
  for (let i = 0; i < samplePoints.length; i += 3) {
    const batch = samplePoints.slice(i, i + 3);
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

  let withDetour = await calculateDetourTimes(candidates, polyline, originalDuration);

  // 주유소 카테고리일 때 OPINET API로 가격 데이터 보강
  if (category === 'fuel') {
    withDetour = await enrichFuelPrices(withDetour);
  }

  return withDetour
    .filter(p => p.detourMinutes <= maxDetourMin)
    .sort((a, b) => a.detourMinutes - b.detourMinutes);
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
 * Calculate actual driving detour time for each place
 */
async function calculateDetourTimes(
  places: Place[],
  polyline: LatLng[],
  _originalDuration?: number
): Promise<Place[]> {
  return places.map(place => {
    const nearestDist = nearestRouteDistance(polyline, { lat: place.lat, lng: place.lng });

    let detourMinutes: number;
    const distMeters = nearestDist * 1000;

    if (distMeters < 500) {
      detourMinutes = 1;
    } else if (distMeters < 2000) {
      detourMinutes = Math.round((distMeters / 500) * 2) / 2;
      detourMinutes = Math.max(1, Math.round(detourMinutes));
    } else {
      const drivingMin = distMeters / 600;
      detourMinutes = Math.round(drivingMin + 3);
    }

    // 왕복
    detourMinutes = Math.round(detourMinutes * 2);

    return { ...place, detourMinutes };
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
 * 주유소 검색 결과에 캐시된 OPINET 가격 데이터 보강
 * API 호출 없이 서버 캐시에서 매칭
 */
async function enrichFuelPrices(places: Place[]): Promise<Place[]> {
  if (places.length === 0) return places;

  try {
    // 캐시에서 가격 매칭 요청 (한번의 API 호출로 처리)
    const enriched = await Promise.all(
      places.map(async (place) => {
        try {
          const params = new URLSearchParams({
            x: place.lng.toString(),
            y: place.lat.toString(),
            radius: '1000',
          });
          const res = await fetch(`/api/fuel?${params.toString()}`);
          if (!res.ok) return place;

          const data = await res.json();

          // 캐시된 가격 데이터로 매칭
          if (data.fuelPrices && data.fuelPrices.length > 0) {
            const matched = matchFuelPrice(place, data.fuelPrices);
            if (matched) {
              return {
                ...place,
                fuelPrice: matched.price,
                fuelType: matched.prodcd,
                isSelfService: matched.isSelf,
              };
            }
          }

          // 셀프 여부만이라도 판단
          if (place.name.includes('셀프')) {
            return { ...place, isSelfService: true };
          }

          return place;
        } catch {
          return place;
        }
      })
    );

    return enriched;
  } catch {
    return places;
  }
}

/**
 * OPINET 캐시 데이터에서 장소명/좌표로 가격 매칭
 */
function matchFuelPrice(
  place: Place,
  cachedStations: any[]
): { price: number; prodcd: string; isSelf: boolean } | null {
  if (!cachedStations?.length) return null;

  const normalized = place.name.replace(/주유소|셀프|self|㈜|\(주\)/gi, '').trim();

  // 1차: 이름 매칭
  for (const s of cachedStations) {
    const sName = s.OS_NM || '';
    const sNorm = sName.replace(/주유소|셀프|self|㈜|\(주\)/gi, '').trim();
    if (normalized.includes(sNorm) || sNorm.includes(normalized) || normalized === sNorm) {
      return {
        price: s.PRICE,
        prodcd: s.PRODCD,
        isSelf: place.name.includes('셀프') || sName.includes('셀프'),
      };
    }
  }

  // 2차: 가장 가까운 주유소 사용 (이미 거리순 정렬된 상태)
  if (cachedStations[0]?.PRICE) {
    return {
      price: cachedStations[0].PRICE,
      prodcd: cachedStations[0].PRODCD,
      isSelf: place.name.includes('셀프') || (cachedStations[0].OS_NM || '').includes('셀프'),
    };
  }

  return null;
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
