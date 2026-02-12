import { NextRequest, NextResponse } from 'next/server';
import { findNearbyPrices, getCache, refreshFuelCache } from '@/lib/fuelCache';

/**
 * 주유소 가격 API
 * - 캐시에서 근처 주유소 가격 조회
 * - 캐시가 없으면 자동 갱신 시도 (첫 요청)
 * - Kakao 검색도 병행하여 주유소 목록 제공
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const x = searchParams.get('x'); // longitude
  const y = searchParams.get('y'); // latitude
  const fuelType = searchParams.get('fuelType') || 'B027';
  const radius = searchParams.get('radius') || '2000';

  if (!x || !y) {
    return NextResponse.json(
      { error: '위치 정보가 필요합니다.' },
      { status: 400 }
    );
  }

  // 좌표 검증
  const xNum = parseFloat(x);
  const yNum = parseFloat(y);
  if (isNaN(xNum) || isNaN(yNum) || xNum < 124 || xNum > 132 || yNum < 33 || yNum > 39) {
    return NextResponse.json({ error: '유효하지 않은 좌표입니다.' }, { status: 400 });
  }

  const kakaoKey = process.env.KAKAO_REST_KEY;
  if (!kakaoKey) {
    return NextResponse.json(
      { error: 'API 키가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  try {
    const safeFuelType = ['B027', 'D047', 'K015'].includes(fuelType) ? fuelType : 'B027';
    const radiusNum = Math.min(Math.max(parseInt(radius, 10) || 2000, 300), 20000);

    // 1. Kakao 검색으로 주유소 목록 가져오기
    const kakaoParams = new URLSearchParams({
      query: '주유소',
      x,
      y,
      radius: String(radiusNum),
      sort: 'distance',
      category_group_code: 'OL7',
      size: '15',
    });

    const kakaoRes = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?${kakaoParams.toString()}`,
      { headers: { Authorization: `KakaoAK ${kakaoKey}` } }
    );

    if (!kakaoRes.ok) {
      return NextResponse.json(
        { error: '주유소 검색 중 오류가 발생했습니다.' },
        { status: kakaoRes.status }
      );
    }

    const kakaoData = await kakaoRes.json();

    // 2. OPINET 캐시에서 가격 데이터 가져오기
    let cache = getCache();

    // 캐시가 없으면 자동 갱신 시도 (첫 요청 또는 캐시 만료)
    if (!cache) {
      const opinetKey = process.env.OPINET_API_KEY;
      if (opinetKey) {
        try {
          console.log('[FuelAPI] 캐시 없음 - 자동 갱신 시작');
          await refreshFuelCache(opinetKey, safeFuelType);
          cache = getCache();
        } catch (e) {
          console.error('[FuelAPI] 자동 갱신 실패:', e);
        }
      }
    }

    // 3. 캐시 데이터가 있으면 가격 정보 병합
    const lat = parseFloat(y);
    const lng = parseFloat(x);
    const nearbyPrices = cache ? findNearbyPrices(lat, lng, 8) : [];

    return NextResponse.json({
      ...kakaoData,
      fuelPrices: nearbyPrices.length > 0 ? nearbyPrices : null,
      cacheStatus: cache ? {
        available: true,
        stationCount: cache.stations.length,
        ageMinutes: Math.round((Date.now() - cache.updatedAt) / 60000),
      } : { available: false },
    });
  } catch (error) {
    console.error('Fuel API error:', error);
    return NextResponse.json(
      { error: '주유소 검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
