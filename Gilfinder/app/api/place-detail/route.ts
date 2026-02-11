import { NextRequest, NextResponse } from 'next/server';

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
    // Kakao Place HTML 페이지에서 메타태그 파싱
    const res = await fetch(`https://place.map.kakao.com/${placeId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: '장소 정보를 가져올 수 없습니다.' },
        { status: res.status }
      );
    }

    const html = await res.text();

    // og:image 메타태그에서 이미지 URL 추출
    const imageMatch = html.match(/og:image.*?content="(.*?)"/);
    let imageUrl: string | null = null;
    if (imageMatch?.[1]) {
      imageUrl = imageMatch[1];
      // 프로토콜 누락 시 추가
      if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
    }

    // og:description에서 주소 추출
    const descMatch = html.match(/og:description.*?content="(.*?)"/);

    // 제목 확인
    const titleMatch = html.match(/<title>(.*?)\s*\|/);

    const result = {
      id: placeId,
      imageUrl,
      title: titleMatch?.[1] || null,
      description: descMatch?.[1] || null,
      // 평점/리뷰는 클라이언트 렌더링이라 메타태그에서 추출 불가
      rating: null,
      reviewCount: null,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Place detail API error:', error);
    return NextResponse.json(
      { error: '장소 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
