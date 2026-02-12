import { NextRequest, NextResponse } from 'next/server';
import { refreshEvCache, refreshEvBatch, buildGridFromRedis, getEvCacheStatus } from '@/lib/evCache';

/**
 * 전기차 충전소 캐시 갱신 엔드포인트
 *
 * GET: 캐시 상태 확인
 * POST: 캐시 갱신
 *   - ?batch=0~5: 배치별 갱신 (3개 지역씩)
 *   - ?action=grid: Redis 데이터로 그리드 인덱스 빌드
 *   - 파라미터 없음: 전체 갱신 (타임아웃 주의)
 */

export async function GET() {
  const status = await getEvCacheStatus();
  return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.DATA_GO_KR_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'DATA_GO_KR_API_KEY가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  // Vercel Cron 인증
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const batchParam = searchParams.get('batch');
  const action = searchParams.get('action');

  try {
    // 그리드 인덱스 빌드 (API 호출 없음, Redis 데이터만 사용)
    if (action === 'grid') {
      console.log('[EvCache] 그리드 인덱스 빌드 시작 (Redis 기반)');
      const result = await buildGridFromRedis();
      return NextResponse.json({
        success: true,
        action: 'grid',
        ...result,
      });
    }

    // 배치별 갱신
    if (batchParam !== null) {
      const batchIndex = parseInt(batchParam);
      console.log(`[EvCache] 배치 ${batchIndex} 갱신 시작`);
      const result = await refreshEvBatch(apiKey, batchIndex);
      console.log(`[EvCache] 배치 ${batchIndex} 완료: ${result.totalStations}개 충전소`);
      return NextResponse.json({
        success: result.errors === 0,
        ...result,
        updatedAt: new Date().toISOString(),
      });
    }

    // 전체 갱신 (레거시, 타임아웃 주의)
    console.log('[EvCache] 전체 캐시 갱신 시작');
    const result = await refreshEvCache(apiKey);
    console.log(`[EvCache] 갱신 완료: ${result.totalStations}개 충전소`);

    return NextResponse.json({
      success: true,
      ...result,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[EvCache] 갱신 실패:', error);
    return NextResponse.json(
      { error: '캐시 갱신 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
