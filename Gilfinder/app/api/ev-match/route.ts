import { NextRequest, NextResponse } from 'next/server';
import { lookupEvByGrid, lookupEvDirectApi } from '@/lib/evCache';

/**
 * 충전소 정보 일괄 매칭 API (지오 그리드 인덱스 사용)
 * - 좌표 기반 Redis 그리드 셀 조회 -> 즉시 매칭
 * - 1회 Redis mget으로 모든 장소 일괄 처리
 * - Redis 비활성화 시 data.go.kr API 직접 조회 폴백
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
    const normalizedStations = stations.map((s: any) => ({
      name: String(s.name || ''),
      lat: Number(s.lat),
      lng: Number(s.lng),
      address: s.address || s.roadAddress || '',
    }));

    // 1. Redis 그리드 인덱스 조회 시도
    let results = await lookupEvByGrid(normalizedStations);
    let source = 'grid';

    // 2. Redis가 비어있으면 (모든 결과가 null) 직접 API 조회 폴백
    if (results.every(r => r === null) && stations.length > 0) {
      console.log('[EvMatch] Redis 그리드 비어있음 - 직접 API 조회 폴백 시작');
      results = await lookupEvDirectApi(normalizedStations);
      source = 'direct';
    }

    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      results,
      _debug: {
        elapsed: `${elapsed}ms`,
        stationCount: stations.length,
        source, // 'grid' 또는 'direct'
      },
    });
  } catch (error) {
    console.error('EvMatch API error:', error);
    return NextResponse.json({ error: '충전소 정보 조회 오류' }, { status: 500 });
  }
}
