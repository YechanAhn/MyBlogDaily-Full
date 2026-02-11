import { LatLng } from './types';

/**
 * Parse vertexes array from Kakao Mobility API response
 * vertexes are in [lng, lat, lng, lat, ...] format
 */
export function parseVertexes(vertexes: number[]): LatLng[] {
  const points: LatLng[] = [];
  for (let i = 0; i < vertexes.length; i += 2) {
    points.push({ lng: vertexes[i], lat: vertexes[i + 1] });
  }
  return points;
}

/**
 * Calculate distance between two points using Haversine formula (in km)
 */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const calc = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(calc), Math.sqrt(1 - calc));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Sample polyline at given interval (in km)
 * Returns points approximately every intervalKm along the route
 */
export function samplePolyline(polyline: LatLng[], intervalKm: number = 2): LatLng[] {
  if (polyline.length === 0) return [];

  const sampled: LatLng[] = [polyline[0]];
  let accumulated = 0;

  for (let i = 1; i < polyline.length; i++) {
    const dist = haversineDistance(polyline[i - 1], polyline[i]);
    accumulated += dist;

    if (accumulated >= intervalKm) {
      sampled.push(polyline[i]);
      accumulated = 0;
    }
  }

  // Always include the last point
  const last = polyline[polyline.length - 1];
  if (sampled[sampled.length - 1] !== last) {
    sampled.push(last);
  }

  return sampled;
}

/**
 * Find the closest point on the polyline to a given point
 * Returns distance in km
 */
export function distanceToRoute(polyline: LatLng[], point: LatLng): number {
  let minDist = Infinity;
  for (const p of polyline) {
    const d = haversineDistance(p, point);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Interpolate between two points
 */
export function interpolate(a: LatLng, b: LatLng, ratio: number): LatLng {
  return {
    lat: a.lat + (b.lat - a.lat) * ratio,
    lng: a.lng + (b.lng - a.lng) * ratio,
  };
}
