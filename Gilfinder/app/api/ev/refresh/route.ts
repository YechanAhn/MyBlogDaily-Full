import { NextRequest, NextResponse } from 'next/server';
import { refreshEvCache, getEvCacheStatus } from '@/lib/evCache';

/**
 * 전기차 충전소 캐시 갱신 엔드포인트
 *
 * Vercel Cron으로 매일 오전 6시(KST) 호출:
 * vercel.json에 설정:
 * {
 *   "path": "/api/ev/refresh",
 *   "schedule": "0 21 * * *"  // UTC 21:00 = KST 06:00
 * }
 *
 * GET: 캐시 상태 확인
 * POST: 캐시 갱신 실행
 */

export async function GET() {
  const status = getEvCacheStatus();
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

  try {
    console.log('[EvCache] 캐시 갱신 시작');
    const result = await refreshEvCache(apiKey);
    console.log(`[EvCache] 갱신 완료: ${result.totalStations}개 충전소, ${result.apiCalls}회 API 호출, ${result.errors}건 에러`);

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
