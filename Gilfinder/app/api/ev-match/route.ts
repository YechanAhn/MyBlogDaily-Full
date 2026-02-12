import { NextRequest, NextResponse } from 'next/server';
import {
  getEvCacheForRegions,
  fetchRegions,
  getZcodeFromAddress,
  estimateZcodeFromCoords,
  type EvStation,
} from '@/lib/evCache';

/**
 * 충전소 정보 일괄 매칭 API
 * - 충전소 이름/좌표 배열을 받아 캐시에서 충전기 타입 정보 매칭
 * - 주소/좌표에서 필요한 지역만 추출하여 부분 로드 (전체 87k 로드 방지)
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

    // 주소에서 필요한 지역 코드 추출
    const zcodes = new Set<string>();
    for (const s of stations) {
      const addr = s.address || s.roadAddress || '';
      const zcode = getZcodeFromAddress(addr);
      if (zcode) zcodes.add(zcode);
    }

    // 좌표 기반 지역 추정 (주소가 없는 경우 대비)
    if (zcodes.size === 0) {
      for (const s of stations) {
        if (typeof s.lat === 'number' && typeof s.lng === 'number') {
          const zcode = estimateZcodeFromCoords(s.lat, s.lng);
          if (zcode) zcodes.add(zcode);
        }
      }
    }

    const zcodeArr = Array.from(zcodes);
    let evStations: EvStation[] = [];

    // 1차: 필요한 지역만 로드 (메모리 -> Redis -> API)
    if (zcodeArr.length > 0) {
      evStations = await getEvCacheForRegions(zcodeArr);

      // Redis에 없으면 API에서 부분 조회
      if (evStations.length === 0) {
        const apiKey = process.env.DATA_GO_KR_API_KEY;
        if (apiKey) {
          try {
            evStations = await fetchRegions(apiKey, zcodeArr);
          } catch (e) {
            console.error('[EvMatch] 부분 조회 실패:', e);
          }
        }
      }
    }

    if (evStations.length === 0) {
      return NextResponse.json({ results: stations.map(() => null) });
    }

    // 매칭
    const results = matchFromStations(stations, evStations);
    return NextResponse.json({
      results,
      cacheStatus: { stationCount: evStations.length, regionCount: zcodeArr.length },
    });
  } catch (error) {
    console.error('EvMatch API error:', error);
    return NextResponse.json({ error: '충전소 정보 조회 오류' }, { status: 500 });
  }
}

/** 충전소 데이터에서 단계적 매칭 (300m 근접 -> 이름+1km -> 500m 폴백) */
function matchFromStations(
  requestStations: any[],
  evStations: EvStation[]
): (object | null)[] {
  return requestStations.map((s: any) => {
    if (!s?.name || typeof s.lat !== 'number' || typeof s.lng !== 'number') return null;
    if (s.lng < 124 || s.lng > 132 || s.lat < 33 || s.lat > 39) return null;

    // 1km 이내 충전소 찾기 + 거리 계산
    const nearby: { station: EvStation; distKm: number }[] = [];
    for (const st of evStations) {
      const dlat = st.lat - s.lat;
      const dlng = st.lng - s.lng;
      const distKm = Math.sqrt(dlat * dlat + dlng * dlng) * 111;
      if (distKm <= 1.0) {
        nearby.push({ station: st, distKm });
      }
    }
    if (nearby.length === 0) return null;

    nearby.sort((a, b) => a.distKm - b.distKm);

    // 300m 이내 가장 가까운 충전소 (거의 확실히 같은 장소)
    if (nearby[0].distKm <= 0.3) {
      return formatMatch(nearby[0].station);
    }

    // 이름 유사도 매칭 (1km 이내)
    const normalize = (name: string) =>
      name.replace(/충전소|충전기|전기차|EV|ev|\(.*?\)|주차장|공용/gi, '')
        .replace(/[()·\-_#]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const sNorm = normalize(s.name);

    for (const { station } of nearby) {
      const stNorm = normalize(station.statNm);
      if (stNorm.includes(sNorm) || sNorm.includes(stNorm)) {
        return formatMatch(station);
      }
      // 토큰 매칭
      const tokensA = sNorm.split(/\s+/).filter((w: string) => w.length >= 2);
      const tokensB = stNorm.split(/\s+/).filter((w: string) => w.length >= 2);
      let hits = 0;
      for (const a of tokensA) {
        for (const b of tokensB) {
          if (a === b || a.includes(b) || b.includes(a)) hits++;
        }
      }
      if (hits >= 1) return formatMatch(station);
    }

    // 500m 이내 폴백 (이름 매칭 실패해도 가까우면 매칭)
    if (nearby[0].distKm <= 0.5) {
      return formatMatch(nearby[0].station);
    }

    return null;
  });
}

function formatMatch(station: EvStation) {
  return {
    chargerTypes: station.chargerTypes,
    maxOutput: station.maxOutput,
    operator: station.busiNm,
    chargerCount: station.chargerCount,
    useTime: station.useTime,
    parkingFree: station.parkingFree,
  };
}
