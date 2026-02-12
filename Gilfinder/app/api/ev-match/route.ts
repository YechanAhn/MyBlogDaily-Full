import { NextRequest, NextResponse } from 'next/server';
import { getEvCache, getEvCacheForRegions, fetchRegions, matchEvStation, getZcodeFromAddress } from '@/lib/evCache';

/**
 * 충전소 정보 일괄 매칭 API
 * - 충전소 이름/좌표 배열을 받아 캐시에서 충전기 타입 정보 매칭
 * - 캐시 없으면 Redis 지역별 부분 조회 -> API 부분 조회 순으로 폴백
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stations } = body;

    if (!Array.isArray(stations) || stations.length === 0) {
      return NextResponse.json({ results: [] });
    }

    if (stations.length > 50) {
      return NextResponse.json({ error: '최대 50개까지 가능합니다.' }, { status: 400 });
    }

    const cache = await getEvCache();

    // 캐시 없으면 필요한 지역만 부분 조회
    if (!cache) {
      const apiKey = process.env.DATA_GO_KR_API_KEY;

      // 주소에서 지역 코드 추출
      const zcodes = new Set<string>();
      for (const s of stations) {
        const addr = s.address || s.roadAddress || '';
        const zcode = getZcodeFromAddress(addr);
        if (zcode) zcodes.add(zcode);
      }

      if (zcodes.size > 0) {
        const zcodeArr = Array.from(zcodes);

        // 1차: Redis에서 해당 지역만 부분 로드 시도
        try {
          const redisStations = await getEvCacheForRegions(zcodeArr);
          if (redisStations.length > 0) {
            console.log(`[EvMatch] Redis 부분 로드: ${zcodeArr.join(',')} (${redisStations.length}개 충전소)`);
            const results = matchFromStations(stations, redisStations);
            return NextResponse.json({
              results,
              cacheStatus: { stationCount: redisStations.length, partial: true, source: 'redis' },
            });
          }
        } catch {
          // Redis 부분 로드 실패 시 API 폴백
        }

        // 2차: API에서 필요한 지역만 부분 조회 (전체 갱신 대신)
        if (apiKey) {
          try {
            console.log(`[EvMatch] 캐시 없음 - 지역 ${zcodeArr.join(',')} 부분 조회`);
            const partialStations = await fetchRegions(apiKey, zcodeArr);
            if (partialStations.length > 0) {
              const results = matchFromStations(stations, partialStations);
              return NextResponse.json({
                results,
                cacheStatus: { stationCount: partialStations.length, partial: true, source: 'api' },
              });
            }
          } catch (e) {
            console.error('[EvMatch] 부분 조회 실패:', e);
          }
        }
      }
    }

    if (!cache) {
      return NextResponse.json({ results: stations.map(() => null) });
    }

    // 전체 캐시에서 매칭
    const results = await Promise.all(
      stations.map(async (s: {
        name: string;
        lat: number;
        lng: number;
        address?: string;
        roadAddress?: string;
      }) => {
        if (!s?.name || typeof s.lat !== 'number' || typeof s.lng !== 'number') return null;
        if (s.lng < 124 || s.lng > 132 || s.lat < 33 || s.lat > 39) return null;

        const matched = await matchEvStation(
          String(s.name),
          s.lat,
          s.lng,
          s.address || s.roadAddress
        );

        if (!matched) return null;

        return {
          chargerTypes: matched.chargerTypes,
          maxOutput: matched.maxOutput,
          operator: matched.busiNm,
          chargerCount: matched.chargerCount,
          useTime: matched.useTime,
          parkingFree: matched.parkingFree,
        };
      })
    );

    return NextResponse.json({
      results,
      cacheStatus: {
        stationCount: cache.stations.length,
        ageMinutes: Math.round((Date.now() - cache.updatedAt) / 60000),
      },
    });
  } catch (error) {
    console.error('EvMatch API error:', error);
    return NextResponse.json({ error: '충전소 정보 조회 오류' }, { status: 500 });
  }
}

/** 부분 충전소 데이터에서 직접 매칭 (캐시 없을 때 사용) */
function matchFromStations(
  requestStations: any[],
  evStations: import('@/lib/evCache').EvStation[]
): (object | null)[] {
  return requestStations.map((s: any) => {
    if (!s?.name || typeof s.lat !== 'number' || typeof s.lng !== 'number') return null;
    if (s.lng < 124 || s.lng > 132 || s.lat < 33 || s.lat > 39) return null;

    // 3km 이내 충전소 필터링
    const nearby = evStations.filter(st => {
      const dlat = st.lat - s.lat;
      const dlng = st.lng - s.lng;
      return Math.sqrt(dlat * dlat + dlng * dlng) * 111 <= 3;
    });
    if (nearby.length === 0) return null;

    // 가장 가까운 충전소 반환
    nearby.sort((a, b) => {
      const da = Math.hypot(a.lat - s.lat, a.lng - s.lng);
      const db = Math.hypot(b.lat - s.lat, b.lng - s.lng);
      return da - db;
    });
    const matched = nearby[0];

    return {
      chargerTypes: matched.chargerTypes,
      maxOutput: matched.maxOutput,
      operator: matched.busiNm,
      chargerCount: matched.chargerCount,
      useTime: matched.useTime,
      parkingFree: matched.parkingFree,
    };
  });
}
