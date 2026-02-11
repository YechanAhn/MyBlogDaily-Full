import { NextRequest, NextResponse } from 'next/server';
import { refreshFuelCache, getCacheStatus } from '@/lib/fuelCache';

/**
 * 주유소 가격 캐시 갱신 엔드포인트
 *
 * Vercel Cron으로 매일 오전 7시(KST) 호출:
 * vercel.json에 아래 추가:
 * {
 *   "crons": [{
 *     "path": "/api/fuel/refresh",
 *     "schedule": "0 22 * * *"  // UTC 22:00 = KST 07:00
 *   }]
 * }
 *
 * GET: 캐시 상태 확인
 * POST: 캐시 갱신 실행
 */

export async function GET() {
  const status = getCacheStatus();
  return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPINET_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPINET_API_KEY가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  // Vercel Cron 인증 (선택적)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Cron secret이 설정되어 있으면 인증 필요
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 유종 파라미터 (기본: 휘발유)
  let fuelType = 'B027';
  try {
    const body = await request.json().catch(() => ({}));
    if (body.fuelType) fuelType = body.fuelType;
  } catch {
    // body 없으면 기본값 사용
  }

  try {
    console.log(`[FuelCache] 캐시 갱신 시작 (유종: ${fuelType})`);
    const result = await refreshFuelCache(apiKey, fuelType);
    console.log(`[FuelCache] 갱신 완료: ${result.totalStations}개 주유소, ${result.apiCalls}회 API 호출, ${result.errors}건 에러`);

    return NextResponse.json({
      success: true,
      ...result,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[FuelCache] 갱신 실패:', error);
    return NextResponse.json(
      { error: '캐시 갱신 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
