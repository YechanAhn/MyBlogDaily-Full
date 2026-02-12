import { NextRequest, NextResponse } from 'next/server';
import { lookupEvByGrid } from '@/lib/evCache';

/**
 * 충전소 정보 일괄 매칭 API (지오 그리드 인덱스 사용)
 * - 좌표 기반 Redis 그리드 셀 조회 -> 즉시 매칭
 * - 1회 Redis mget으로 모든 장소 일괄 처리
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

    const startTime = Date.now();
    const results = await lookupEvByGrid(
      stations.map((s: any) => ({
        name: String(s.name || ''),
        lat: Number(s.lat),
        lng: Number(s.lng),
        address: s.address || s.roadAddress || '',
      }))
    );
    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      results,
      _debug: { elapsed: `${elapsed}ms`, stationCount: stations.length },
    });
  } catch (error) {
    console.error('EvMatch API error:', error);
    return NextResponse.json({ error: '충전소 정보 조회 오류' }, { status: 500 });
  }
}
