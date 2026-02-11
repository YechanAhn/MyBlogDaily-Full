import { LatLng, RouteSection, Place, MealSearchParams } from './types';
import { interpolate, haversineDistance } from './polyline';

/**
 * Estimate the location along the route after N hours of driving
 */
export function estimateLocationAfterHours(
  sections: RouteSection[],
  hours: number
): LatLng {
  const targetSeconds = hours * 3600;
  let accumulated = 0;

  for (const section of sections) {
    if (accumulated + section.duration >= targetSeconds) {
      const ratio = (targetSeconds - accumulated) / section.duration;
      return interpolate(section.startCoord, section.endCoord, ratio);
    }
    accumulated += section.duration;
  }

  // Beyond route duration: return end of last section
  if (sections.length > 0) {
    return sections[sections.length - 1].endCoord;
  }
  return { lat: 0, lng: 0 };
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
 * 가장 가까운 구간의 인덱스 찾기 (거리 기반)
 */
function findClosestSectionIndex(sections: RouteSection[], point: LatLng): number {
  let minDist = Infinity;
  let idx = 0;
  for (let i = 0; i < sections.length; i++) {
    const mid = {
      lat: (sections[i].startCoord.lat + sections[i].endCoord.lat) / 2,
      lng: (sections[i].startCoord.lng + sections[i].endCoord.lng) / 2,
    };
    const dist = Math.abs(mid.lat - point.lat) + Math.abs(mid.lng - point.lng);
    if (dist < minDist) {
      minDist = dist;
      idx = i;
    }
  }
  return idx;
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
    // 경로에서 해당 지역과 가장 가까운 포인트를 찾아 검색 중심으로 사용
    location = findClosestPointOnRoute(sections, coord);
  } else {
    return { location: { lat: 0, lng: 0 }, places: [] };
  }

  // 3개 포인트에서 검색: 예상 위치 + ±10km 오프셋
  const searchPoints: LatLng[] = [location];

  // ±10km 오프셋 포인트 추가 (위도 기준 약 0.09도 ≈ 10km)
  const offsetDeg = 0.09;
  if (params.mode === 'time' && sections.length > 0) {
    // 경로 방향으로 앞뒤 10km 지점 추가
    const idx = findClosestSectionIndex(sections, location);
    if (idx >= 0 && idx < sections.length) {
      const section = sections[idx];
      const dx = section.endCoord.lng - section.startCoord.lng;
      const dy = section.endCoord.lat - section.startCoord.lat;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const nx = (dx / dist) * offsetDeg;
        const ny = (dy / dist) * offsetDeg;
        searchPoints.push({ lat: location.lat + ny, lng: location.lng + nx });
        searchPoints.push({ lat: location.lat - ny, lng: location.lng - nx });
      }
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
