import { LatLng, RouteSection, Place, MealSearchParams } from './types';
import { interpolate, haversineDistance } from './polyline';

/**
 * Estimate the location along the route after N hours of driving
 * 실제 도로 vertex를 사용하여 정확한 위치 보간
 */
export function estimateLocationAfterHours(
  sections: RouteSection[],
  hours: number
): LatLng {
  const targetSeconds = hours * 3600;
  let accumulated = 0;

  for (const section of sections) {
    // 섹션 내에서 도로별로 세밀하게 보간
    if (accumulated + section.duration >= targetSeconds) {
      const sectionRemaining = targetSeconds - accumulated;
      let roadAccum = 0;

      for (const road of section.roads || []) {
        if (roadAccum + road.duration >= sectionRemaining) {
          // 이 도로 내에서 정확한 위치 찾기
          const roadRemaining = sectionRemaining - roadAccum;
          const ratio = road.duration > 0 ? roadRemaining / road.duration : 0;
          return interpolateAlongVertexes(road.vertexes || [], ratio);
        }
        roadAccum += road.duration;
      }

      // fallback: 섹션 끝
      return section.endCoord;
    }
    accumulated += section.duration;
  }

  // 경로 시간 초과: 마지막 섹션 끝
  if (sections.length > 0) {
    return sections[sections.length - 1].endCoord;
  }
  return { lat: 0, lng: 0 };
}

/**
 * vertexes 배열([lng,lat,lng,lat,...])에서 ratio(0~1) 위치의 좌표 보간
 */
function interpolateAlongVertexes(vertexes: number[], ratio: number): LatLng {
  if (vertexes.length < 4) {
    if (vertexes.length >= 2) return { lat: vertexes[1], lng: vertexes[0] };
    return { lat: 0, lng: 0 };
  }

  // 각 세그먼트 거리 계산
  const segments: { dist: number; startIdx: number }[] = [];
  let totalDist = 0;
  for (let i = 0; i < vertexes.length - 2; i += 2) {
    const p1 = { lat: vertexes[i + 1], lng: vertexes[i] };
    const p2 = { lat: vertexes[i + 3], lng: vertexes[i + 2] };
    const d = haversineDistance(p1, p2);
    segments.push({ dist: d, startIdx: i });
    totalDist += d;
  }

  if (totalDist === 0) return { lat: vertexes[1], lng: vertexes[0] };

  // ratio에 해당하는 위치 찾기
  const targetDist = totalDist * Math.max(0, Math.min(1, ratio));
  let cumDist = 0;

  for (const seg of segments) {
    if (cumDist + seg.dist >= targetDist) {
      const segRatio = seg.dist > 0 ? (targetDist - cumDist) / seg.dist : 0;
      const i = seg.startIdx;
      return interpolate(
        { lat: vertexes[i + 1], lng: vertexes[i] },
        { lat: vertexes[i + 3], lng: vertexes[i + 2] },
        segRatio
      );
    }
    cumDist += seg.dist;
  }

  // 끝 지점
  return { lat: vertexes[vertexes.length - 1], lng: vertexes[vertexes.length - 2] };
}

/**
 * Search for a region name using Kakao API and return its coordinates
 */
export async function searchRegionCoord(regionName: string): Promise<LatLng | null> {
  try {
    const params = new URLSearchParams({ query: regionName, mode: 'address' });
    const res = await fetch(`/api/search?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const doc = data.documents?.[0];
    if (!doc) return null;
    return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
  } catch {
    return null;
  }
}

/**
 * 경로 위에서 특정 좌표에 가장 가까운 지점 찾기
 * 지역 검색 시 경로에서 벗어나지 않는 결과를 위해 사용
 */
function findClosestPointOnRoute(sections: RouteSection[], target: LatLng): LatLng {
  let minDist = Infinity;
  let closest: LatLng = target;

  for (const section of sections) {
    // 섹션의 도로 포인트들을 순회
    for (const road of section.roads || []) {
      const vertexes = road.vertexes || [];
      for (let i = 0; i < vertexes.length; i += 2) {
        const point = { lat: vertexes[i + 1], lng: vertexes[i] };
        const dist = haversineDistance(point, target);
        if (dist < minDist) {
          minDist = dist;
          closest = point;
        }
      }
    }
    // 섹션 시작/끝 좌표도 확인
    for (const pt of [section.startCoord, section.endCoord]) {
      const dist = haversineDistance(pt, target);
      if (dist < minDist) {
        minDist = dist;
        closest = pt;
      }
    }
  }

  return closest;
}

/**
 * 경로 상에서 특정 지점 근처의 도로 방향 벡터 추출
 */
function findNearbyRouteDirection(sections: RouteSection[], point: LatLng): { dx: number; dy: number } | null {
  let minDist = Infinity;
  let bestDir: { dx: number; dy: number } | null = null;

  for (const section of sections) {
    for (const road of section.roads || []) {
      const v = road.vertexes || [];
      for (let i = 0; i < v.length - 2; i += 2) {
        const p = { lat: v[i + 1], lng: v[i] };
        const dist = haversineDistance(p, point);
        if (dist < minDist) {
          minDist = dist;
          // 다음 포인트가 있으면 방향 계산
          if (i + 3 < v.length) {
            const dx = v[i + 2] - v[i];
            const dy = v[i + 3] - v[i + 1];
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
              bestDir = { dx: dx / len, dy: dy / len };
            }
          }
        }
      }
    }
  }

  return bestDir;
}

/**
 * Search for restaurants based on meal search params
 * Mode 1: hours-from-now → estimate location on route after N hours
 * Mode 2: region-based → search near a specific region name
 */
export async function searchMealPlaces(
  params: MealSearchParams,
  sections: RouteSection[]
): Promise<{ location: LatLng; places: Place[] }> {
  let location: LatLng;

  if (params.mode === 'time' && params.hoursFromNow !== undefined) {
    location = estimateLocationAfterHours(sections, params.hoursFromNow);
  } else if (params.mode === 'region' && params.regionName) {
    const coord = await searchRegionCoord(params.regionName);
    if (!coord) return { location: { lat: 0, lng: 0 }, places: [] };
    // 경로에서 해당 지역과 가장 가까운 포인트 찾기
    const routePoint = findClosestPointOnRoute(sections, coord);
    const distToRoute = haversineDistance(routePoint, coord);
    // 10km 이내면 경로 위 포인트에서 검색, 그 이상이면 지역 좌표에서 직접 검색
    location = distToRoute <= 10 ? routePoint : coord;
  } else {
    return { location: { lat: 0, lng: 0 }, places: [] };
  }

  // 3개 포인트에서 검색: 예상 위치 + ±10km 오프셋
  const searchPoints: LatLng[] = [location];

  // 경로 방향으로 앞뒤 오프셋 포인트 추가
  if (sections.length > 0) {
    // 경로 상 location 부근의 방향 벡터를 도로 vertexes에서 추출
    const nearby = findNearbyRouteDirection(sections, location);
    if (nearby) {
      // ±10km 오프셋 (위도 기준 약 0.09도)
      const offsetDeg = 0.09;
      searchPoints.push({ lat: location.lat + nearby.dy * offsetDeg, lng: location.lng + nearby.dx * offsetDeg });
      searchPoints.push({ lat: location.lat - nearby.dy * offsetDeg, lng: location.lng - nearby.dx * offsetDeg });
    }
  }

  try {
    const allPlaces: Place[] = [];
    const seenIds = new Set<string>();

    // 각 포인트에서 반경 5000m 검색
    for (const point of searchPoints) {
      const searchParams = new URLSearchParams({
        query: '맛집',
        x: point.lng.toString(),
        y: point.lat.toString(),
        radius: '5000',
        sort: 'accuracy',
        size: '15',
      });

      const res = await fetch(`/api/search?${searchParams.toString()}`);
      if (!res.ok) continue;

      const data = await res.json();
      for (const doc of (data.documents || [])) {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          allPlaces.push({
            id: doc.id,
            name: doc.place_name,
            category: doc.category_group_name || doc.category_name || '',
            categoryCode: doc.category_group_code || 'FD6',
            address: doc.address_name || '',
            roadAddress: doc.road_address_name || '',
            phone: doc.phone || '',
            lat: parseFloat(doc.y),
            lng: parseFloat(doc.x),
            distance: parseInt(doc.distance) || 0,
            detourMinutes: 0,
            placeUrl: doc.place_url || '',
          });
        }
      }
    }

    return { location, places: allPlaces };
  } catch {
    return { location, places: [] };
  }
}
