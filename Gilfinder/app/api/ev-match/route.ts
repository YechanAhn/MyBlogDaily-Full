import { NextRequest, NextResponse } from 'next/server';
import { getEvCache, refreshEvCache, matchEvStation, getZcodeFromAddress } from '@/lib/evCache';

/**
 * 충전소 정보 일괄 매칭 API
 * - 충전소 이름/좌표 배열을 받아 캐시에서 충전기 타입 정보 매칭
 * - 캐시 없으면 해당 지역만 자동 조회
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

    let cache = getEvCache();

    // 캐시 없으면 필요한 지역만 조회
    if (!cache) {
      const apiKey = process.env.DATA_GO_KR_API_KEY;
      if (apiKey) {
        try {
          // 주소에서 지역 코드 추출
          const zcodes = new Set<string>();
          for (const s of stations) {
            const addr = s.address || s.roadAddress || '';
            const zcode = getZcodeFromAddress(addr);
            if (zcode) zcodes.add(zcode);
          }

          if (zcodes.size > 0) {
            console.log(`[EvMatch] 캐시 없음 - 지역 ${Array.from(zcodes).join(',')} 조회`);
            // 부분 조회 결과를 임시 캐시로 사용하기 위해 전체 갱신 시도
            await refreshEvCache(apiKey);
            cache = getEvCache();
          }
        } catch (e) {
          console.error('[EvMatch] 자동 조회 실패:', e);
        }
      }
    }

    if (!cache) {
      return NextResponse.json({ results: stations.map(() => null) });
    }

    // 각 충전소별 정보 매칭
    const results = stations.map((s: {
      name: string;
      lat: number;
      lng: number;
      address?: string;
      roadAddress?: string;
    }) => {
      if (!s?.name || typeof s.lat !== 'number' || typeof s.lng !== 'number') return null;
      if (s.lng < 124 || s.lng > 132 || s.lat < 33 || s.lat > 39) return null;

      const matched = matchEvStation(
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
    });

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
