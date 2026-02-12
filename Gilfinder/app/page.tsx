'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import KakaoMap from '@/components/KakaoMap';
import SearchBar from '@/components/SearchBar';
import CategoryChips from '@/components/CategoryChips';
import PlaceCard from '@/components/PlaceCard';
import PlaceDetail from '@/components/PlaceDetail';
import RoutePanel from '@/components/RoutePanel';
import MealSearch from '@/components/MealSearch';
import KakaoAdFit from '@/components/KakaoAdFit';
import ChargerTypeFilter, { filterByChargerType } from '@/components/ChargerTypeFilter';
import OnboardingPopup from '@/components/OnboardingPopup';
import { LatLng, Place, RouteResult, RouteSection, SearchCategory, AddressResult, AppView, MealSearchMode, NaviApp } from '@/lib/types';
import { parseVertexes } from '@/lib/polyline';
import { searchAlongRoute } from '@/lib/searchAlongRoute';
import { searchMealPlaces } from '@/lib/estimateArrival';
import { openNaviApp, getNaviInfo } from '@/lib/deeplink';
import { makeRouteKey, makePlaceKey, getCache, setCache, ROUTE_CACHE_TTL, PLACE_CACHE_TTL } from '@/lib/cache';
import { getRandomLoadingTip } from '@/lib/loadingTips';

export default function HomePage() {
  // App state
  const [view, setView] = useState<AppView>('home');
  const [originName, setOriginName] = useState('현재 위치');
  const [originCoord, setOriginCoord] = useState<LatLng | null>(null);
  const [destName, setDestName] = useState('');
  const [destCoord, setDestCoord] = useState<LatLng | null>(null);
  const [category, setCategory] = useState<SearchCategory>('food');
  const [customKeyword, setCustomKeyword] = useState('');
  const [maxDetourMin] = useState(30);
  const [routePriority, setRoutePriority] = useState<'RECOMMEND' | 'TIME'>('RECOMMEND');

  // Route & search state
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [originalRoute, setOriginalRoute] = useState<RouteResult | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [waypoint, setWaypoint] = useState<Place | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('');
  const [loadingTip, setLoadingTip] = useState('');
  const [mapCenter, setMapCenter] = useState<LatLng | undefined>(undefined);
  const [searchTarget, setSearchTarget] = useState<'origin' | 'dest'>('dest');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showMealSearch, setShowMealSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); // 장소 검색 여부
  const [pendingCategory, setPendingCategory] = useState<SearchCategory | null>(null);
  const [mealLocation, setMealLocation] = useState<LatLng | null>(null);
  const [evChargerFilter, setEvChargerFilter] = useState<string[]>([]);

  const cardListRef = useRef<HTMLDivElement>(null);
  const searchRequestRef = useRef(0);

  // 현재 위치 가져오기
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setOriginCoord({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setOriginCoord({ lat: 37.5665, lng: 126.978 });
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // 로딩 중 팁 로테이션 (3초마다 변경)
  useEffect(() => {
    if (!isLoading) {
      setLoadingTip('');
      return;
    }
    setLoadingTip(getRandomLoadingTip());
    const timer = setInterval(() => {
      setLoadingTip(getRandomLoadingTip());
    }, 3000);
    return () => clearInterval(timer);
  }, [isLoading]);

  // 경로 파싱 헬퍼
  const parseRouteData = useCallback((r: any): RouteResult => {
    const sections: RouteSection[] = (r.sections || []).map((section: any) => ({
      distance: section.distance,
      duration: section.duration,
      startCoord: {
        lat: section.roads?.[0]?.vertexes?.[1] || 0,
        lng: section.roads?.[0]?.vertexes?.[0] || 0,
      },
      endCoord: {
        lat: section.roads?.[section.roads.length - 1]?.vertexes?.[section.roads[section.roads.length - 1]?.vertexes?.length - 1] || 0,
        lng: section.roads?.[section.roads.length - 1]?.vertexes?.[section.roads[section.roads.length - 1]?.vertexes?.length - 2] || 0,
      },
      roads: section.roads || [],
    }));

    const polyline: LatLng[] = [];
    for (const section of r.sections || []) {
      for (const road of section.roads || []) {
        polyline.push(...parseVertexes(road.vertexes || []));
      }
    }

    return {
      totalDistance: r.summary?.distance || 0,
      totalDuration: r.summary?.duration || 0,
      polyline,
      sections,
    };
  }, []);

  // 경로 조회
  const fetchRoute = useCallback(async () => {
    if (!originCoord || !destCoord) return;

    // 캐시 확인
    const cacheKey = makeRouteKey(originCoord.lat, originCoord.lng, destCoord.lat, destCoord.lng);
    const cached = getCache<RouteResult>(cacheKey);
    if (cached) {
      setRoute(cached);
      setOriginalRoute(cached);
      setPlaces([]);
      setView('route');
      return;
    }

    setIsLoading(true);
    setLoadingProgress(10);
    setLoadingText('경로 검색 중...');

    try {
      const res = await fetch(
        `/api/route?origin=${originCoord.lng},${originCoord.lat}&destination=${destCoord.lng},${destCoord.lat}&priority=${routePriority}`
      );
      if (!res.ok) throw new Error('경로를 찾을 수 없습니다');

      const data = await res.json();
      const routes = data.routes;
      if (!routes?.length) throw new Error('경로를 찾을 수 없습니다');

      const result = parseRouteData(routes[0]);

      // 캐시에 저장
      setCache(cacheKey, result, ROUTE_CACHE_TTL);

      setRoute(result);
      setOriginalRoute(result);
      setPlaces([]); // 장소 목록 초기화 (카테고리 선택 시 검색)
      setView('route');
    } catch (err: any) {
      alert(err.message || '경로 검색 실패');
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originCoord, destCoord, routePriority]);

  useEffect(() => {
    if (originCoord && destCoord) {
      fetchRoute();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destCoord]);

  // 경로 우선순위 변경 시 재검색
  useEffect(() => {
    if (originCoord && destCoord && route) {
      fetchRoute();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePriority]);

  // 경로 변경 시 카테고리 자동 재검색 (대기 중 또는 기존 검색)
  useEffect(() => {
    if (!route?.polyline) return;
    if (pendingCategory && pendingCategory !== 'custom') {
      // 경로 미설정 상태에서 선택한 카테고리 → 경로 완료 후 자동 검색
      searchPlaces(route.polyline, pendingCategory, route.totalDuration);
      setPendingCategory(null);
    } else if (hasSearched) {
      // 도착지 변경 시 현재 카테고리로 자동 재검색
      if (category === 'custom' && customKeyword) {
        searchPlaces(route.polyline, 'custom', route.totalDuration);
      } else if (category !== 'custom') {
        searchPlaces(route.polyline, category, route.totalDuration);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // 평점 프리로드 함수
  const preloadRatings = async (
    places: Place[],
    requestId: number,
    onBatchDone?: (done: number, total: number) => void
  ): Promise<Place[]> => {
    const results = [...places];
    const batchSize = 10;
    const totalBatches = Math.ceil(places.length / batchSize);

    for (let i = 0; i < places.length; i += batchSize) {
      if (requestId !== searchRequestRef.current) return results;
      const batch = places.slice(i, i + batchSize);
      const details = await Promise.all(
        batch.map(p =>
          fetch(`/api/place-detail?id=${p.id}&name=${encodeURIComponent(p.name)}&lat=${p.lat}&lng=${p.lng}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      );

      batch.forEach((p, j) => {
        const d = details[j];
        if (d) {
          results[i + j] = {
            ...results[i + j],
            rating: d.rating ?? results[i + j].rating,
            reviewCount: d.reviewCount ?? results[i + j].reviewCount,
            ratingSource: d.ratingSource ?? null,
            imageUrl: d.imageUrl ?? results[i + j].imageUrl,
          };
        }
      });

      onBatchDone?.(Math.floor(i / batchSize) + 1, totalBatches);

      if (i + batchSize < places.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
    return results;
  };

  // 장소 검색
  const searchPlaces = async (polyline: LatLng[], cat: SearchCategory, totalDuration?: number) => {
    // 캐시 확인
    if (originCoord && destCoord) {
      const keyword = cat === 'custom' ? customKeyword : undefined;
      const categoryKey = cat === 'custom' && keyword ? `custom_${keyword}` : cat;
      const cacheKey = makePlaceKey(originCoord.lat, originCoord.lng, destCoord.lat, destCoord.lng, categoryKey);
      const cached = getCache<Place[]>(cacheKey);
      if (cached) {
        setPlaces(cached);
        setHasSearched(true);
        setSelectedPlace(null);
        setShowDetail(false);
        return;
      }
    }

    const requestId = ++searchRequestRef.current;
    setIsLoading(true);
    setHasSearched(true);
    setSelectedPlace(null);
    setShowDetail(false);
    setLoadingProgress(30);
    setLoadingText('장소 검색 준비 중...');

    try {
      const keyword = cat === 'custom' ? customKeyword : undefined;
      const found = await searchAlongRoute(
        polyline, cat, keyword, maxDetourMin, totalDuration,
        (percent, text) => {
          setLoadingProgress(percent);
          setLoadingText(text);
        }
      );

      if (requestId !== searchRequestRef.current) return;

      // 1단계: 즉시 표시 (세그먼트 순서)
      setPlaces(found);
      setLoadingProgress(70);
      setLoadingText(`${found.length}개 장소 발견 · 평점 로딩 중...`);

      // 2단계: 평점 프리로드 (fuel 제외)
      if (cat !== 'fuel') {
        const withRatings = await preloadRatings(found, requestId, (batchDone, totalBatches) => {
          if (requestId !== searchRequestRef.current) return;
          const progress = 70 + Math.round((batchDone / totalBatches) * 25);
          setLoadingProgress(progress);
          setLoadingText(`평점 로딩 중... (${batchDone}/${totalBatches})`);
        });

        if (requestId !== searchRequestRef.current) return;

        // 3단계: 별점순 정렬
        setLoadingProgress(97);
        setLoadingText('별점순 정렬 중...');
        withRatings.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        setPlaces(withRatings);

        // 프리로드 완료 데이터로 캐시
        if (originCoord && destCoord) {
          const categoryKey = cat === 'custom' && keyword ? `custom_${keyword}` : cat;
          const cacheKey = makePlaceKey(originCoord.lat, originCoord.lng, destCoord.lat, destCoord.lng, categoryKey);
          setCache(cacheKey, withRatings, PLACE_CACHE_TTL);
        }
      } else {
        if (originCoord && destCoord) {
          const cacheKey = makePlaceKey(originCoord.lat, originCoord.lng, destCoord.lat, destCoord.lng, cat);
          setCache(cacheKey, found, PLACE_CACHE_TTL);
        }
      }

      setLoadingProgress(100);
      setLoadingText('완료!');
    } catch {
      setPlaces([]);
    } finally {
      setTimeout(() => {
        if (requestId === searchRequestRef.current) {
          setIsLoading(false);
          setLoadingProgress(0);
          setLoadingText('');
        }
      }, 500);
    }
  };

  // 카테고리 변경
  const handleCategoryChange = (cat: SearchCategory) => {
    setCategory(cat);
    setShowMealSearch(false);
    setEvChargerFilter([]);
    if (cat === 'custom') {
      setShowCustomInput(true);
      if (!route?.polyline) {
        setPendingCategory('custom');
      }
      return;
    }
    setShowCustomInput(false);
    if (route?.polyline) {
      searchPlaces(route.polyline, cat, route.totalDuration);
    } else {
      // 경로 없음 - 경로 설정 시 자동 검색되도록 저장
      setPendingCategory(cat);
    }
  };

  // 검색어 검색
  const handleCustomSearch = () => {
    if (route?.polyline && customKeyword) {
      searchPlaces(route.polyline, 'custom', route.totalDuration);
    }
  };

  // 식사 장소 검색
  const handleMealSearch = async (mode: MealSearchMode, value: string) => {
    if (!route?.sections) return;
    setIsLoading(true);
    setLoadingProgress(20);
    setLoadingText('식사 장소 검색 중...');
    try {
      const params = mode === 'time'
        ? { mode: 'time' as const, hoursFromNow: parseFloat(value) }
        : { mode: 'region' as const, regionName: value };

      const result = await searchMealPlaces(params, route.sections);
      setLoadingProgress(80);
      if (result.places.length > 0) {
        setMealLocation(result.location);
        setMapCenter(result.location);
        const sorted = [...result.places].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        setPlaces(sorted);
        setCategory('food');
        setShowMealSearch(false);
      } else {
        alert('해당 지역에서 맛집을 찾을 수 없습니다.');
      }
    } catch {
      alert('식사 장소 검색 실패');
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
    }
  };

  // 목적지 검색 결과 선택
  const handleDestSelect = (result: AddressResult) => {
    if (searchTarget === 'dest') {
      setDestName(result.name);
      setDestCoord({ lat: result.lat, lng: result.lng });
    } else {
      setOriginName(result.name);
      setOriginCoord({ lat: result.lat, lng: result.lng });
    }
    setView('home');
  };

  // 장소 카드 선택
  const handlePlaceSelect = (place: Place) => {
    setSelectedPlace(place);
    setMapCenter({ lat: place.lat, lng: place.lng });

    if (cardListRef.current) {
      const card = cardListRef.current.querySelector(`[data-place-id="${place.id}"]`) as HTMLElement;
      card?.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
    }
  };

  // 상세 보기
  const handlePlaceDetailOpen = (place: Place) => {
    setSelectedPlace(place);
    setShowDetail(true);
    setView('detail');
  };

  // 경유지 추가
  const handleAddWaypoint = async (place: Place) => {
    setWaypoint(place);
    setShowDetail(false);
    setView('route');

    // 경유 경로 계산
    if (originCoord && destCoord) {
      try {
        const res = await fetch('/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: originCoord,
            destination: destCoord,
            waypoints: [{ lat: place.lat, lng: place.lng, name: place.name }],
            priority: routePriority,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const routes = data.routes;
        if (routes?.length) {
          const waypointRoute = parseRouteData(routes[0]);
          setRoute(waypointRoute);
        }
      } catch {
        // 실패 시 원래 경로 유지
      }
    }
  };

  // 경유지 제거
  const handleRemoveWaypoint = () => {
    setWaypoint(null);
    if (originalRoute) {
      setRoute(originalRoute);
    }
  };

  // 카드 스크롤 핸들러
  const handleCardScroll = () => {
    if (!cardListRef.current || !displayPlaces.length) return;
    const container = cardListRef.current;
    const containerCenter = container.scrollLeft + container.clientWidth / 2;

    let closestPlaceId: string | null = null;
    let closestDist = Infinity;
    Array.from(container.children).forEach((child) => {
      const el = child as HTMLElement;
      const placeId = el.getAttribute('data-place-id');
      if (!placeId) return; // 광고 요소 건너뛰기
      const elCenter = el.offsetLeft + el.clientWidth / 2;
      const dist = Math.abs(elCenter - containerCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestPlaceId = placeId;
      }
    });

    const centerPlace = closestPlaceId ? displayPlaces.find(p => p.id === closestPlaceId) : null;
    if (centerPlace && centerPlace.id !== selectedPlace?.id) {
      setSelectedPlace(centerPlace);
      setMapCenter({ lat: centerPlace.lat, lng: centerPlace.lng });
    }
  };

  // 출발/도착 스왑
  const handleSwap = () => {
    const tmpName = originName;
    const tmpCoord = originCoord;
    setOriginName(destName);
    setOriginCoord(destCoord);
    setDestName(tmpName);
    setDestCoord(tmpCoord);
  };

  const isRouteView = view === 'route' || view === 'detail';

  // 전기차 충전기 필터 적용
  const displayPlaces = (() => {
    if (category !== 'ev' || evChargerFilter.length === 0) return places;
    const mask = filterByChargerType(places, evChargerFilter);
    return places.filter((_, i) => mask[i]);
  })();

  return (
    <div className="h-[100dvh] flex flex-col relative overflow-hidden bg-gray-100">
      {/* 전체 화면 지도 */}
      <div className="absolute inset-0 z-0">
        <KakaoMap
          polyline={route?.polyline}
          places={displayPlaces}
          selectedPlace={selectedPlace}
          mealLocation={mealLocation}
          onPlaceSelect={handlePlaceSelect}
          center={mapCenter}
          origin={originCoord}
          destination={destCoord}
        />
      </div>

      {/* 앱 이름 */}
      {view !== 'search' && (
        <div className={`relative z-10 px-4 ${isRouteView ? 'pt-[env(safe-area-inset-top)] pt-1 pb-0' : 'pt-[env(safe-area-inset-top)] pt-3 pb-1'}`}>
          <div className={`inline-flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-xl shadow-md ${isRouteView ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
            <span className={isRouteView ? 'text-sm' : 'text-xl'}>🚗</span>
            <h1 className={`font-extrabold tracking-tight ${isRouteView ? 'text-sm' : 'text-lg'}`}>
              <span className="text-blue-600">가는</span><span className="text-gray-800">길에</span>
            </h1>
          </div>
        </div>
      )}

      {/* 상단 검색 영역 */}
      <div className={`relative z-10 px-4 ${view !== 'search' ? 'pt-1' : 'pt-[env(safe-area-inset-top)] pt-3'}`}>
        {view === 'search' ? (
          <SearchBar
            placeholder={searchTarget === 'dest' ? '도착지를 검색하세요' : '출발지를 검색하세요'}
            onSelect={handleDestSelect}
            onBack={() => setView(isRouteView ? 'route' : 'home')}
            showBackButton
            autoFocus
            userLat={originCoord?.lat}
            userLng={originCoord?.lng}
          />
        ) : (
          <RoutePanel
            originName={originName}
            destName={destName || '어디로 갈까요?'}
            route={isRouteView ? route : null}
            waypoint={waypoint}
            defaultCompact={isRouteView}
            onSwap={handleSwap}
            onOriginClick={() => { setSearchTarget('origin'); setView('search'); }}
            onDestClick={() => { setSearchTarget('dest'); setView('search'); }}
            onRemoveWaypoint={handleRemoveWaypoint}
          />
        )}
      </div>

      {/* 경로 우선순위 토글 */}
      {isRouteView && !showDetail && (
        <div className="relative z-10 px-4 mt-1 flex justify-end">
          <button
            onClick={() => {
              const next = routePriority === 'RECOMMEND' ? 'TIME' : 'RECOMMEND';
              setRoutePriority(next);
              if (originCoord && destCoord) {
                // 재검색을 위해 경로 초기화
                setRoute(null);
                setOriginalRoute(null);
                setPlaces([]);
                setHasSearched(false);
              }
            }}
            className="text-xs px-2.5 py-1 rounded-full bg-white/90 shadow-sm text-gray-600 hover:bg-white transition-all"
          >
            {routePriority === 'RECOMMEND' ? '🛣️ 추천 경로' : '⚡ 최단 시간'}
          </button>
        </div>
      )}

      {/* 카테고리 칩 */}
      {view !== 'search' && !showDetail && (
        <div className="relative z-10 mt-2">
          <CategoryChips
            value={category}
            onChange={handleCategoryChange}
            customLabel={customKeyword || undefined}
          />

          {/* 검색어 입력 */}
          {showCustomInput && (
            <div className="px-4 mt-2 flex gap-2">
              <input
                type="text"
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomSearch()}
                placeholder="검색어 입력 (예: 약국, 마트)"
                className="flex-1 px-3 py-2 bg-white rounded-xl shadow-sm text-sm outline-none ring-1 ring-gray-200 focus:ring-blue-400"
                autoFocus
              />
              <button
                onClick={handleCustomSearch}
                className="px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-xl shadow-sm"
              >
                검색
              </button>
            </div>
          )}

          {/* 전기차 충전기 타입 필터 */}
          {category === 'ev' && hasSearched && !isLoading && (
            <ChargerTypeFilter
              selected={evChargerFilter}
              onChange={setEvChargerFilter}
            />
          )}

          {/* 식사 장소 찾기 버튼 */}
          {(category === 'food') && !showMealSearch && (
            <div className="px-4 mt-2">
              <button
                onClick={() => setShowMealSearch(true)}
                className="w-full py-2 bg-white rounded-xl shadow-sm text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors ring-1 ring-orange-100"
              >
                식사 장소 찾기 (시간/지역 기반)
              </button>
            </div>
          )}

          {/* 식사 검색 패널 */}
          {showMealSearch && (
            <div className="mt-2">
              <MealSearch
                onSearch={handleMealSearch}
                onClose={() => setShowMealSearch(false)}
                isLoading={isLoading}
              />
            </div>
          )}
        </div>
      )}

      {/* 로딩 프로그레스바 */}
      {isLoading && (
        <div className="relative z-10 px-4 mt-3">
          <div className="bg-white rounded-xl shadow-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600 font-medium">{loadingText || '검색 중...'}</span>
              <span className="text-xs text-blue-600 font-bold">{loadingProgress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            {loadingTip && (
              <p
                key={loadingTip}
                className="text-[11px] text-gray-500 mt-2 text-center animate-tip-pop leading-tight"
              >
                {loadingTip}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 여백 */}
      <div className="flex-1" />

      {/* 하단 영역 */}
      <div className="relative z-10">
        {/* 경유지 내비 선택 패널 */}
        {isRouteView && !showDetail && waypoint && (
          <div className="mx-4 mb-3 bg-white rounded-2xl shadow-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-base">📍</span>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">경유지</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{waypoint.name}</p>
                </div>
              </div>
              <button
                onClick={handleRemoveWaypoint}
                className="p-1.5 rounded-full hover:bg-gray-100 flex-shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex gap-2">
              {(['kakao', 'naver', 'tmap'] as NaviApp[]).map((navi) => {
                const info = getNaviInfo(navi);
                return (
                  <button
                    key={navi}
                    onClick={() => {
                      if (!originCoord || !destCoord) return;
                      const wp = { lat: waypoint.lat, lng: waypoint.lng, name: waypoint.name };
                      const start = { ...originCoord, name: originName || '출발지' };
                      const end = { ...destCoord, name: destName || '도착지' };
                      if (navi === 'tmap') {
                        alert('T맵은 경유지를 지원하지 않아 경유지를 목적지로 설정합니다.');
                      }
                      openNaviApp(navi, start, end, wp);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all"
                  >
                    <span className="text-base">{info.icon}</span>
                    <span className="text-xs font-semibold text-gray-700">{info.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 상세 보기 */}
        {showDetail && selectedPlace ? (
          <PlaceDetail
            place={selectedPlace}
            origin={originCoord}
            destination={destCoord}
            originName={originName}
            destName={destName}
            originalDuration={originalRoute?.totalDuration}
            originalDistance={originalRoute?.totalDistance}
            onClose={() => { setShowDetail(false); setView('route'); }}
            onAddWaypoint={handleAddWaypoint}
          />
        ) : (
          <>
            {/* 장소 카드 리스트 */}
            {isRouteView && displayPlaces.length > 0 && (
              <div className="pb-[env(safe-area-inset-bottom)] pb-4">
                <div
                  ref={cardListRef}
                  className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4 pb-2"
                  onScroll={handleCardScroll}
                >
                  {displayPlaces.flatMap((place, idx) => {
                    const items = [
                      <PlaceCard
                        key={place.id}
                        place={place}
                        isSelected={selectedPlace?.id === place.id}
                        onClick={() => handlePlaceDetailOpen(place)}
                      />,
                    ];
                    // 5번째 카드마다 250x250 광고 삽입
                    if (idx > 0 && (idx + 1) % 5 === 0 && idx < displayPlaces.length - 1) {
                      items.push(
                        <div key={`ad-${idx}`} className="flex-shrink-0 snap-center flex items-center">
                          <KakaoAdFit unit="DAN-k5zILat6MLLziW0G" width={250} height={250} />
                        </div>
                      );
                    }
                    return items;
                  })}
                </div>
              </div>
            )}

            {/* 결과 없음 - 검색한 적이 있을 때만 표시 */}
            {isRouteView && !isLoading && hasSearched && displayPlaces.length === 0 && (
              <div className="mx-4 mb-4 bg-white rounded-2xl shadow-lg p-6 text-center">
                <p className="text-2xl mb-2">🔍</p>
                {category === 'ev' && evChargerFilter.length > 0 && places.length > 0 ? (
                  <>
                    <p className="text-sm text-gray-600 font-medium">선택한 충전 타입의 충전소가 없습니다</p>
                    <p className="text-xs text-gray-400 mt-1">필터를 변경해보세요</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 font-medium">경로 주변에 결과가 없습니다</p>
                    <p className="text-xs text-gray-400 mt-1">다른 카테고리를 선택해보세요</p>
                  </>
                )}
              </div>
            )}

            {/* 안내 메시지 - 아직 검색 전 */}
            {isRouteView && !isLoading && !hasSearched && places.length === 0 && (
              <div className="mx-4 mb-4 bg-white rounded-2xl shadow-lg p-5 text-center">
                <p className="text-2xl mb-2">👆</p>
                <p className="text-sm text-gray-600 font-medium">카테고리를 선택하여 경로 주변 장소를 찾아보세요</p>
              </div>
            )}

            {/* 카카오 애드핏 배너 */}
            {isRouteView && hasSearched && !isLoading && (
              <KakaoAdFit unit="DAN-T87VNKQlQ4NZY4r4" width={320} height={50} className="pb-2" />
            )}
          </>
        )}
      </div>

      {/* 온보딩 팝업 */}
      <OnboardingPopup />
    </div>
  );
}
