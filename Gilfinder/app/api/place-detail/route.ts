import { NextRequest, NextResponse } from 'next/server';

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
    // 평점 추출
    const rating = basic.feedback?.scoresum && basic.feedback?.scorecnt
      ? basic.feedback.scoresum / basic.feedback.scorecnt
      : null;
    const reviewCount = basic.feedback?.scorecnt || data.comment?.kamapCommentCnt || null;

    // 이미지 추출
    let imageUrl: string | null = null;
    if (basic.mainphotourl) {
      imageUrl = basic.mainphotourl;
    } else if (data.photo?.photoList?.[0]?.list?.[0]?.orgurl) {
      imageUrl = data.photo.photoList[0].list[0].orgurl;
    }
    if (imageUrl?.startsWith('//')) imageUrl = 'https:' + imageUrl;

    return {
      id: placeId,
      imageUrl,
      title: basic.placenamefull || null,
      description: basic.address?.region?.fullname || null,
      rating: rating ? Math.round(rating * 10) / 10 : null,
      reviewCount,
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
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const placeId = searchParams.get('id');

  if (!placeId || !/^\d+$/.test(placeId)) {
    return NextResponse.json(
      { error: '유효하지 않은 장소 ID입니다.' },
      { status: 400 }
    );
  }

  try {
    // 1차: 카카오 내부 API 시도 (평점/리뷰 포함)
    const apiResult = await fetchKakaoPlaceAPI(placeId);
    if (apiResult) {
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
    });
  } catch (error) {
    console.error('Place detail API error:', error);
    return NextResponse.json(
      { error: '장소 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
