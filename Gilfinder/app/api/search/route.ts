import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query')?.trim();
  const x = searchParams.get('x');
  const y = searchParams.get('y');
  const radius = searchParams.get('radius') || '1000';
  const sort = searchParams.get('sort') || 'accuracy';
  const page = searchParams.get('page') || '1';
  const categoryGroupCode = searchParams.get('category_group_code') || '';
  const mode = searchParams.get('mode') || 'keyword'; // 'keyword' or 'address' or 'category'

  if (!query && !categoryGroupCode) {
    return NextResponse.json({ error: '검색어를 입력해주세요.' }, { status: 400 });
  }

  // 입력값 검증
  if (query && query.length > 100) {
    return NextResponse.json({ error: '검색어가 너무 깁니다.' }, { status: 400 });
  }
  if (categoryGroupCode && !/^[A-Z0-9]{2,4}$/.test(categoryGroupCode)) {
    return NextResponse.json({ error: '유효하지 않은 카테고리 코드입니다.' }, { status: 400 });
  }
  if (x && (isNaN(parseFloat(x)) || parseFloat(x) < 124 || parseFloat(x) > 132)) {
    return NextResponse.json({ error: '유효하지 않은 좌표입니다.' }, { status: 400 });
  }
  if (y && (isNaN(parseFloat(y)) || parseFloat(y) < 33 || parseFloat(y) > 39)) {
    return NextResponse.json({ error: '유효하지 않은 좌표입니다.' }, { status: 400 });
  }

  const apiKey = process.env.KAKAO_REST_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
  }

  try {
    const safeMode = mode === 'address' || mode === 'category' ? mode : 'keyword';
    const safeSort = sort === 'distance' ? 'distance' : 'accuracy';
    const pageNum = Math.min(Math.max(parseInt(page, 10) || 1, 1), 45);
    const radiusNum = Math.min(Math.max(parseInt(radius, 10) || 1000, 100), 20000);

    if (safeMode === 'address') {
      // Address/keyword search for autocomplete
      const params = new URLSearchParams({ query: query || '', page: String(pageNum), size: '10' });
      if (x && y) {
        params.set('x', x);
        params.set('y', y);
      }
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`;
      const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
      if (!res.ok) {
        return NextResponse.json({ error: '검색 중 오류가 발생했습니다.' }, { status: res.status });
      }
      return NextResponse.json(await res.json());
    }

    // Category-only search (no keyword needed)
    if (safeMode === 'category' && categoryGroupCode) {
      const catParams = new URLSearchParams({
        category_group_code: categoryGroupCode,
        sort: safeSort,
        page: String(pageNum),
        size: '15',
      });
      if (x && y) {
        catParams.set('x', x);
        catParams.set('y', y);
        catParams.set('radius', String(radiusNum));
      }
      const url = `https://dapi.kakao.com/v2/local/search/category.json?${catParams.toString()}`;
      const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
      if (!res.ok) {
        return NextResponse.json({ error: '검색 중 오류가 발생했습니다.' }, { status: res.status });
      }
      return NextResponse.json(await res.json());
    }

    // Standard keyword search with location
    const params = new URLSearchParams({ sort: safeSort, page: String(pageNum), size: '15' });
    if (query) params.set('query', query);
    if (x && y) {
      params.set('x', x);
      params.set('y', y);
      params.set('radius', String(radiusNum));
    }
    if (categoryGroupCode) params.set('category_group_code', categoryGroupCode);

    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
    if (!res.ok) {
      return NextResponse.json({ error: '검색 중 오류가 발생했습니다.' }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: '검색 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
