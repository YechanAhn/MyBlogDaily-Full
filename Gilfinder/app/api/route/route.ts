import { NextRequest, NextResponse } from 'next/server';
import { cacheGet, cacheSet, incrementErrorCount } from '@/lib/redis';

const parseCoord = (value: string) => {
  const [lngStr, latStr] = value.split(',');
  const lng = parseFloat(lngStr);
  const lat = parseFloat(latStr);
  if (Number.isNaN(lng) || Number.isNaN(lat)) return null;
  if (lng < 124 || lng > 132 || lat < 33 || lat > 39) return null;
  return { lng, lat };
};

// 좌표 반올림 헬퍼 (캐싱용)
const roundCoord = (c: string) => c.split(',').map(v => parseFloat(v).toFixed(4)).join(',');

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const origin = searchParams.get('origin'); // "lng,lat"
  const destination = searchParams.get('destination'); // "lng,lat"

  if (!origin || !destination) {
    return NextResponse.json(
      { error: '출발지와 도착지를 입력해주세요.' },
      { status: 400 }
    );
  }

  // 좌표 형식 검증 (lng,lat)
  const coordPattern = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
  if (!coordPattern.test(origin) || !coordPattern.test(destination)) {
    return NextResponse.json(
      { error: '유효하지 않은 좌표 형식입니다.' },
      { status: 400 }
    );
  }
  if (!parseCoord(origin) || !parseCoord(destination)) {
    return NextResponse.json(
      { error: '유효하지 않은 좌표입니다.' },
      { status: 400 }
    );
  }

  const apiKey = process.env.KAKAO_REST_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API 키가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  try {
    // 캐시 조회
    const cacheKey = `route:${roundCoord(origin)}:${roundCoord(destination)}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return NextResponse.json(cached);

    const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin}&destination=${destination}&priority=TIME`;

    const res = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Kakao Mobility API error:', errorText);
      return NextResponse.json(
        { error: '경로를 찾을 수 없습니다.' },
        { status: res.status }
      );
    }

    const data = await res.json();
    cacheSet(cacheKey, data, 1800); // 30분 캐시
    return NextResponse.json(data);
  } catch (error) {
    console.error('Route API error:', error);
    incrementErrorCount('route'); // 에러 추적
    return NextResponse.json(
      { error: '경로 검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.KAKAO_REST_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API 키가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { origin, destination, waypoints } = body;

    if (!origin || !destination) {
      return NextResponse.json(
        { error: '출발지와 도착지를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 좌표 범위 검증
    const isValidPoint = (p: any) =>
      typeof p?.lng === 'number' && typeof p?.lat === 'number'
      && p.lng >= 124 && p.lng <= 132
      && p.lat >= 33 && p.lat <= 39;

    if (!isValidPoint(origin) || !isValidPoint(destination)) {
      return NextResponse.json(
        { error: '유효하지 않은 좌표입니다.' },
        { status: 400 }
      );
    }

    // 경유지 개수 제한
    if (waypoints && waypoints.length > 5) {
      return NextResponse.json({ error: '경유지는 최대 5개까지 가능합니다.' }, { status: 400 });
    }

    if (waypoints && Array.isArray(waypoints)) {
      for (const wp of waypoints) {
        if (!isValidPoint(wp)) {
          return NextResponse.json({ error: '유효하지 않은 경유지 좌표입니다.' }, { status: 400 });
        }
        if (wp.name && String(wp.name).length > 60) {
          return NextResponse.json({ error: '경유지 이름이 너무 깁니다.' }, { status: 400 });
        }
      }
    }

    // 경유지가 없으면 기본 경로 API 사용
    if (!waypoints || waypoints.length === 0) {
      const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.lng},${origin.lat}&destination=${destination.lng},${destination.lat}&priority=TIME`;
      const res = await fetch(url, {
        headers: { Authorization: `KakaoAK ${apiKey}` },
      });
      if (!res.ok) {
        return NextResponse.json({ error: '경로를 찾을 수 없습니다.' }, { status: res.status });
      }
      return NextResponse.json(await res.json());
    }

    // 경유지 포함 경로 - Kakao Mobility 다중 경유지 API
    const waypointBody = {
      origin: { x: origin.lng, y: origin.lat },
      destination: { x: destination.lng, y: destination.lat },
      waypoints: waypoints.map((wp: any, idx: number) => ({
        name: wp.name || `경유지${idx + 1}`,
        x: wp.lng,
        y: wp.lat,
      })),
      priority: 'TIME',
    };

    const res = await fetch('https://apis-navi.kakaomobility.com/v1/waypoints/directions', {
      method: 'POST',
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(waypointBody),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Kakao Waypoint API error:', errorText);
      return NextResponse.json(
        { error: '경유지 경로를 찾을 수 없습니다.' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Waypoint Route API error:', error);
    return NextResponse.json(
      { error: '경유지 경로 검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
