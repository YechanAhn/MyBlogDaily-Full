import { NextRequest, NextResponse } from 'next/server';
import { getCache, refreshFuelCache, matchStationPrice } from '@/lib/fuelCache';

/**
 * 주유소 가격 일괄 매칭 API
 * - 주유소 이름/좌표 배열을 받아 OPINET 캐시에서 가격 매칭
 * - 캐시 없으면 자동 갱신 시도
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stations } = body;

    if (!Array.isArray(stations) || stations.length === 0) {
      return NextResponse.json({ prices: [] });
    }

    // 배열 크기 제한
    if (stations.length > 50) {
      return NextResponse.json({ error: '최대 50개까지 가능합니다.' }, { status: 400 });
    }

    let cache = getCache();

    // 캐시 없으면 자동 갱신
    if (!cache) {
      const opinetKey = process.env.OPINET_API_KEY;
      if (opinetKey) {
        try {
          console.log('[FuelMatch] 캐시 없음 - 자동 갱신 시작');
          await refreshFuelCache(opinetKey, 'B027');
          cache = getCache();
        } catch (e) {
          console.error('[FuelMatch] 자동 갱신 실패:', e);
        }
      }
    }

    if (!cache) {
      return NextResponse.json({ prices: stations.map(() => null) });
    }

    // 각 주유소별 가격 매칭
    const prices = stations.map((s: { name: string; lat: number; lng: number }) => {
      if (!s.name || !s.lat || !s.lng) return null;
      return matchStationPrice(s.name, s.lat, s.lng);
    });

    return NextResponse.json({
      prices,
      cacheStatus: {
        stationCount: cache.stations.length,
        ageMinutes: Math.round((Date.now() - cache.updatedAt) / 60000),
      },
    });
  } catch (error) {
    console.error('FuelMatch API error:', error);
    return NextResponse.json({ error: '가격 조회 오류' }, { status: 500 });
  }
}
