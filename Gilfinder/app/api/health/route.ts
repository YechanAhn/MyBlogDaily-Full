import { NextResponse } from 'next/server';
import { getErrorCount } from '@/lib/redis';
import { getCacheStatus } from '@/lib/fuelCache';

export async function GET() {
  const [searchErrors, routeErrors, placeErrors] = await Promise.all([
    getErrorCount('search'),
    getErrorCount('route'),
    getErrorCount('place-detail'),
  ]);

  const fuelCache = getCacheStatus();
  const totalErrors = searchErrors + routeErrors + placeErrors;
  const status = totalErrors > 50 ? 'degraded' : 'healthy';

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    errors: {
      search: searchErrors,
      route: routeErrors,
      placeDetail: placeErrors,
      total: totalErrors,
    },
    fuelCache: {
      hasCachedData: fuelCache.hasCachedData,
      stationCount: fuelCache.stationCount,
      ageMinutes: fuelCache.ageMinutes,
    },
  });
}
