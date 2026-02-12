import { NextRequest, NextResponse } from 'next/server';
import { getChargerStatusByStation } from '@/lib/evCache';

/**
 * 실시간 충전기 상태 조회 API
 * GET /api/ev-status?statId=ME000001&lat=37.5&lng=127.0
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statId = searchParams.get('statId');
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');

    if (!statId || !lat || !lng) {
      return NextResponse.json({ error: '필수 파라미터 누락 (statId, lat, lng)' }, { status: 400 });
    }

    const status = await getChargerStatusByStation(statId, lat, lng);

    if (!status) {
      return NextResponse.json({ status: null });
    }

    // 충전 완료 예상시간 계산 (충전중인 기기에 대해)
    const chargingDetails = status.chargers
      .filter(c => c.stat === '3' && c.nowTsdt)
      .map(c => {
        const startTime = parseStatusDate(c.nowTsdt);
        const elapsedMin = startTime ? Math.round((Date.now() - startTime.getTime()) / 60000) : null;
        return {
          chgerId: c.chgerId,
          elapsedMin,
          startTime: c.nowTsdt,
        };
      });

    return NextResponse.json({
      status: {
        total: status.total,
        available: status.available,
        charging: status.charging,
        broken: status.broken,
        unknown: status.unknown,
        chargingDetails,
      },
    });
  } catch (error) {
    console.error('EvStatus API error:', error);
    return NextResponse.json({ error: '충전기 상태 조회 오류' }, { status: 500 });
  }
}

/** 상태 일시 문자열 파싱 (YYYYMMDDHHmmss) */
function parseStatusDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.length < 14) return null;
  const y = parseInt(dateStr.slice(0, 4));
  const m = parseInt(dateStr.slice(4, 6)) - 1;
  const d = parseInt(dateStr.slice(6, 8));
  const h = parseInt(dateStr.slice(8, 10));
  const min = parseInt(dateStr.slice(10, 12));
  const s = parseInt(dateStr.slice(12, 14));
  return new Date(y, m, d, h, min, s);
}
