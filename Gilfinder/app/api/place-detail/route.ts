import { NextRequest, NextResponse } from 'next/server';

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toInt = (value: unknown): number | null => {
  const num = toNumber(value);
  if (num === null) return null;
  const intVal = Math.round(num);
  return Number.isFinite(intVal) ? intVal : null;
};

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// Google Places API로 평점 가져오기 (Kakao 평점이 없을 때 폴백)
async function fetchGooglePlaceRating(placeName: string, lat: number, lng: number) {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return null; // API 키 없으면 Google 폴백 비활성화

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.rating,places.userRatingCount,places.location,places.displayName',
      },
      body: JSON.stringify({
        textQuery: placeName,
        maxResultCount: 5,
        languageCode: 'ko',
        locationBias: {
          circle: {
            center: {
              latitude: lat,
              longitude: lng,
            },
            radius: 500.0,
          },
        },
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const places = data.places || [];

    let best: { rating: number; reviewCount: number | null } | null = null;
    let bestDistance = Infinity;

    for (const candidate of places) {
      const rating = toNumber(candidate.rating);
      if (rating === null) continue;
      const reviewCount = toInt(candidate.userRatingCount);
      const location = candidate.location;
      const locLat = toNumber(location?.latitude);
      const locLng = toNumber(location?.longitude);
      if (locLat !== null && locLng !== null) {
        const distance = haversineKm(lat, lng, locLat, locLng);
        if (distance <= 1 && distance < bestDistance) {
          bestDistance = distance;
          best = { rating, reviewCount };
        }
      } else if (!best) {
        best = { rating, reviewCount };
      }
    }

    if (best) {
      return {
        rating: Math.round(best.rating * 10) / 10,
        reviewCount: best.reviewCount,
      };
    }

    return null;
  } catch {
    return null;
  }
}

// 카카오 플레이스 내부 API에서 상세 정보 가져오기
async function fetchKakaoPlaceAPI(placeId: string) {
  try {
    const res = await fetch(`https://place.map.kakao.com/main/v/${placeId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `https://place.map.kakao.com/${placeId}`,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.basicInfo) return null;

    const basic = data.basicInfo;
    // 평점 추출 - 여러 소스 확인
    let rating: number | null = null;
    const scoreSum = toNumber(basic.feedback?.scoresum);
    const scoreCnt = toNumber(basic.feedback?.scorecnt);
    const feedbackRating = toNumber(basic.feedback?.rating);
    const gradeScore = toNumber(basic.grade?.totalScore);
    const gradeCount = toNumber(basic.grade?.scoreCount);
    const basicScore = toNumber(basic.score);

    if (scoreSum !== null && scoreCnt) {
      rating = scoreSum / scoreCnt;
    } else if (feedbackRating !== null) {
      rating = feedbackRating;
    } else if (gradeScore !== null && gradeCount) {
      rating = gradeScore / gradeCount;
    } else if (basicScore !== null) {
      rating = basicScore;
    }

    // 리뷰 수 추출 - 여러 소스 확인
    const reviewCount = toInt(basic.feedback?.scorecnt)
      ?? toInt(basic.feedback?.reviewCount)
      ?? toInt(basic.feedback?.blogrvwcnt)
      ?? toInt(data.comment?.kamapCommentCnt)
      ?? toInt(data.comment?.commentCount)
      ?? toInt(data.comment?.list?.length)
      ?? null;

    // 이미지 추출
    let imageUrl: string | null = null;
    if (basic.mainphotourl) {
      imageUrl = basic.mainphotourl;
    } else if (data.photo?.photoList?.[0]?.list?.[0]?.orgurl) {
      imageUrl = data.photo.photoList[0].list[0].orgurl;
    }
    if (imageUrl?.startsWith('//')) imageUrl = 'https:' + imageUrl;

    // 영업시간 추출 - 객체를 문자열로 파싱
    let openHours: string | null = null;
    if (basic.openHour) {
      try {
        const oh = basic.openHour;
        // periodList에서 오늘의 영업시간 추출
        const periods = oh.periodList;
        if (periods?.length > 0) {
          // KST 기준 오늘 요일 (Vercel UTC 서버 대응)
          const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getDay();
          const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
          const todayPeriod = periods.find((p: any) =>
            p.periodName?.includes(dayNames[today]) || p.periodName === '매일'
          ) || periods[0];
          if (todayPeriod?.timeList?.length > 0) {
            const t = todayPeriod.timeList[0];
            openHours = `${t.timeSE || ''}`.trim() || null;
          }
        }
        // realtime 정보 있으면 추가
        if (oh.realtime?.open === 'Y') {
          openHours = openHours ? `영업중 · ${openHours}` : '영업중';
        } else if (oh.realtime?.open === 'N') {
          openHours = openHours ? `영업종료 · ${openHours}` : '영업종료';
        }
      } catch {
        // 파싱 실패 시 무시
      }
    }

    return {
      id: placeId,
      imageUrl,
      title: basic.placenamefull || null,
      description: basic.address?.region?.fullname || null,
      rating: rating !== null ? Math.round(Math.min(5, Math.max(0, rating)) * 10) / 10 : null,
      reviewCount,
      openHours,
    };
  } catch {
    return null;
  }
}

// HTML 메타태그 파싱 (폴백)
async function fetchFromHTML(placeId: string) {
  try {
    const res = await fetch(`https://place.map.kakao.com/${placeId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) return null;

    const html = await res.text();

    // og:image 메타태그에서 이미지 URL 추출
    const imageMatch = html.match(/og:image.*?content="(.*?)"/);
    let imageUrl: string | null = null;
    if (imageMatch?.[1]) {
      imageUrl = imageMatch[1];
      if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
    }

    const descMatch = html.match(/og:description.*?content="(.*?)"/);
    const titleMatch = html.match(/<title>(.*?)\s*\|/);

    return {
      id: placeId,
      imageUrl,
      title: titleMatch?.[1] || null,
      description: descMatch?.[1] || null,
      rating: null,
      reviewCount: null,
      openHours: null,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const placeId = searchParams.get('id');
  const name = searchParams.get('name')?.trim();
  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');

  if (!placeId || !/^\d+$/.test(placeId)) {
    return NextResponse.json(
      { error: '유효하지 않은 장소 ID입니다.' },
      { status: 400 }
    );
  }

  try {
    // 1차: 카카오 내부 API 시도 (평점/리뷰/영업시간 포함)
    let apiResult = await fetchKakaoPlaceAPI(placeId);

    if (apiResult) {
      // Kakao 평점이 없고, Google API 호출 조건이 충족되면 Google API 시도
      if (apiResult.rating === null && name && name.length <= 80 && latParam && lngParam) {
        const lat = parseFloat(latParam);
        const lng = parseFloat(lngParam);

        if (!isNaN(lat) && !isNaN(lng) && lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132) {
          const googleRating = await fetchGooglePlaceRating(name, lat, lng);
          if (googleRating) {
            // Google 평점으로 업데이트
            apiResult = {
              ...apiResult,
              rating: googleRating.rating,
              reviewCount: googleRating.reviewCount,
            };
          }
        }
      }

      return NextResponse.json(apiResult);
    }

    // 2차: HTML 메타태그 파싱 (이미지만)
    const htmlResult = await fetchFromHTML(placeId);
    if (htmlResult) {
      return NextResponse.json(htmlResult);
    }

    return NextResponse.json({
      id: placeId,
      imageUrl: null,
      title: null,
      description: null,
      rating: null,
      reviewCount: null,
      openHours: null,
    });
  } catch (error) {
    console.error('Place detail API error:', error);
    return NextResponse.json(
      { error: '장소 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
