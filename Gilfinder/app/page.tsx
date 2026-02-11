'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import KakaoMap from '@/components/KakaoMap';
import SearchBar from '@/components/SearchBar';
import CategoryChips from '@/components/CategoryChips';
import PlaceCard from '@/components/PlaceCard';
import PlaceDetail from '@/components/PlaceDetail';
import RoutePanel from '@/components/RoutePanel';
import MealSearch from '@/components/MealSearch';
import { LatLng, Place, RouteResult, RouteSection, SearchCategory, AddressResult, AppView, MealSearchMode } from '@/lib/types';
import { parseVertexes } from '@/lib/polyline';
import { searchAlongRoute } from '@/lib/searchAlongRoute';
import { sortByRecommendation } from '@/lib/recommend';
import { searchMealPlaces } from '@/lib/estimateArrival';

export default function HomePage() {
  // App state
  const [view, setView] = useState<AppView>('home');
  const [originName, setOriginName] = useState('현재 위치');
  const [originCoord, setOriginCoord] = useState<LatLng | null>(null);
  const [destName, setDestName] = useState('');
  const [destCoord, setDestCoord] = useState<LatLng | null>(null);
  const [category, setCategory] = useState<SearchCategory>('all');
  const [customKeyword, setCustomKeyword] = useState('');
  const [maxDetourMin] = useState(10);

  // Route & search state
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState<LatLng | undefined>(undefined);
  const [searchTarget, setSearchTarget] = useState<'origin' | 'dest'>('dest');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showMealSearch, setShowMealSearch] = useState(false);
  const [mealLocation, setMealLocation] = useState<LatLng | null>(null);

  const cardListRef = useRef<HTMLDivElement>(null);

  // Get current location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setOriginCoord({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // Default to Seoul
          setOriginCoord({ lat: 37.5665, lng: 126.978 });
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // Fetch route when both origin and destination are set
  const fetchRoute = useCallback(async () => {
    if (!originCoord || !destCoord) return;
    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/route?origin=${originCoord.lng},${originCoord.lat}&destination=${destCoord.lng},${destCoord.lat}`
      );
      if (!res.ok) throw new Error('경로를 찾을 수 없습니다');

      const data = await res.json();
      const routes = data.routes;
      if (!routes?.length) throw new Error('경로를 찾을 수 없습니다');

      const r = routes[0];
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

      const result: RouteResult = {
        totalDistance: r.summary?.distance || 0,
        totalDuration: r.summary?.duration || 0,
        polyline,
        sections,
      };

      setRoute(result);
      setView('route');

      // Auto-search with default category
      if (category === 'all') {
        searchPlaces(polyline, 'food', result.totalDuration);
      } else {
        searchPlaces(polyline, category, result.totalDuration);
      }
    } catch (err: any) {
      alert(err.message || '경로 검색 실패');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originCoord, destCoord]);

  useEffect(() => {
    if (originCoord && destCoord) {
      fetchRoute();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destCoord]);

  // Search places along route
  const searchPlaces = async (polyline: LatLng[], cat: SearchCategory, totalDuration?: number) => {
    setIsLoading(true);
    setSelectedPlace(null);
    setShowDetail(false);

    try {
      const keyword = cat === 'custom' ? customKeyword : undefined;
      const effectiveCat = cat === 'all' ? 'food' : cat;
      const found = await searchAlongRoute(polyline, effectiveCat, keyword, maxDetourMin, totalDuration);
      const sorted = sortByRecommendation(found);
      setPlaces(sorted);
    } catch {
      setPlaces([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle category change
  const handleCategoryChange = (cat: SearchCategory) => {
    setCategory(cat);
    setShowMealSearch(false);
    if (cat === 'custom') {
      setShowCustomInput(true);
      return;
    }
    setShowCustomInput(false);
    if (route?.polyline) {
      searchPlaces(route.polyline, cat, route.totalDuration);
    }
  };

  // Handle custom keyword search
  const handleCustomSearch = () => {
    if (route?.polyline && customKeyword) {
      searchPlaces(route.polyline, 'custom', route.totalDuration);
    }
  };

  // Handle meal search
  const handleMealSearch = async (mode: MealSearchMode, value: string) => {
    if (!route?.sections) return;
    setIsLoading(true);
    try {
      const params = mode === 'time'
        ? { mode: 'time' as const, hoursFromNow: parseFloat(value) }
        : { mode: 'region' as const, regionName: value };

      const result = await searchMealPlaces(params, route.sections);
      if (result.places.length > 0) {
        setMealLocation(result.location);
        setMapCenter(result.location);
        const sorted = sortByRecommendation(result.places);
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
    }
  };

  // Handle destination search result
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

  // Handle place card selection
  const handlePlaceSelect = (place: Place) => {
    setSelectedPlace(place);
    setMapCenter({ lat: place.lat, lng: place.lng });

    // Scroll card into view
    if (cardListRef.current) {
      const idx = places.findIndex(p => p.id === place.id);
      if (idx >= 0) {
        const card = cardListRef.current.children[idx] as HTMLElement;
        card?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  };

  // Handle card tap for detail
  const handlePlaceDetailOpen = (place: Place) => {
    setSelectedPlace(place);
    setShowDetail(true);
    setView('detail');
  };

  // Card scroll handler - sync map with card
  const handleCardScroll = () => {
    if (!cardListRef.current || !places.length) return;
    const container = cardListRef.current;
    const containerCenter = container.scrollLeft + container.clientWidth / 2;

    let closestIdx = 0;
    let closestDist = Infinity;
    Array.from(container.children).forEach((child, idx) => {
      const el = child as HTMLElement;
      const elCenter = el.offsetLeft + el.clientWidth / 2;
      const dist = Math.abs(elCenter - containerCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = idx;
      }
    });

    const centerPlace = places[closestIdx];
    if (centerPlace && centerPlace.id !== selectedPlace?.id) {
      setSelectedPlace(centerPlace);
      setMapCenter({ lat: centerPlace.lat, lng: centerPlace.lng });
    }
  };

  // Swap origin/destination
  const handleSwap = () => {
    const tmpName = originName;
    const tmpCoord = originCoord;
    setOriginName(destName);
    setOriginCoord(destCoord);
    setDestName(tmpName);
    setDestCoord(tmpCoord);
  };

  const isRouteView = view === 'route' || view === 'detail';

  return (
    <div className="h-[100dvh] flex flex-col relative overflow-hidden bg-gray-100">
      {/* Full-screen Map */}
      <div className="absolute inset-0 z-0">
        <KakaoMap
          polyline={route?.polyline}
          places={places}
          selectedPlace={selectedPlace}
          mealLocation={mealLocation}
          onPlaceSelect={handlePlaceSelect}
          center={mapCenter}
        />
      </div>

      {/* Top Search Area */}
      <div className="relative z-10 pt-[env(safe-area-inset-top)] px-4 pt-3">
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
        ) : isRouteView ? (
          <RoutePanel
            originName={originName}
            destName={destName}
            route={route}
            onSwap={handleSwap}
            onOriginClick={() => { setSearchTarget('origin'); setView('search'); }}
            onDestClick={() => { setSearchTarget('dest'); setView('search'); }}
          />
        ) : (
          <RoutePanel
            originName={originName}
            destName={destName || '어디로 갈까요?'}
            route={null}
            onSwap={handleSwap}
            onOriginClick={() => { setSearchTarget('origin'); setView('search'); }}
            onDestClick={() => { setSearchTarget('dest'); setView('search'); }}
          />
        )}
      </div>

      {/* Category Chips */}
      {isRouteView && !showDetail && (
        <div className="relative z-10 mt-2">
          <CategoryChips value={category} onChange={handleCategoryChange} />

          {/* Custom keyword input */}
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

          {/* Meal search button - shown for food/all category */}
          {(category === 'food' || category === 'all') && !showMealSearch && (
            <div className="px-4 mt-2">
              <button
                onClick={() => setShowMealSearch(true)}
                className="w-full py-2 bg-white rounded-xl shadow-sm text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors ring-1 ring-orange-100"
              >
                🍽️ 식사 장소 찾기 (시간/지역 기반)
              </button>
            </div>
          )}

          {/* Meal search panel */}
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

      {/* Loading indicator */}
      {isLoading && (
        <div className="relative z-10 flex justify-center mt-4">
          <div className="bg-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600">검색 중...</span>
          </div>
        </div>
      )}

      {/* Spacer to push bottom content down */}
      <div className="flex-1" />

      {/* Bottom Area */}
      <div className="relative z-10">
        {/* Place Detail View */}
        {showDetail && selectedPlace ? (
          <PlaceDetail
            place={selectedPlace}
            origin={originCoord}
            destination={destCoord}
            originalDuration={route?.totalDuration}
            originalDistance={route?.totalDistance}
            onClose={() => { setShowDetail(false); setView('route'); }}
            onAddWaypoint={(place) => {
              // 경유지 추가 후 네비 앱으로 이동할 수 있도록 알림
              alert(`"${place.name}"이(가) 경유지로 설정되었습니다. 네비 앱에서 경유지가 포함된 경로로 안내됩니다.`);
            }}
          />
        ) : (
          <>
            {/* Place Card List */}
            {isRouteView && places.length > 0 && (
              <div className="pb-[env(safe-area-inset-bottom)] pb-4">
                <div
                  ref={cardListRef}
                  className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4 pb-2"
                  onScroll={handleCardScroll}
                >
                  {places.map((place) => (
                    <PlaceCard
                      key={place.id}
                      place={place}
                      isSelected={selectedPlace?.id === place.id}
                      onClick={() => handlePlaceDetailOpen(place)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* No results */}
            {isRouteView && !isLoading && places.length === 0 && (
              <div className="mx-4 mb-4 bg-white rounded-2xl shadow-lg p-6 text-center">
                <p className="text-2xl mb-2">🔍</p>
                <p className="text-sm text-gray-600 font-medium">경로 주변에 결과가 없습니다</p>
                <p className="text-xs text-gray-400 mt-1">다른 카테고리를 선택해보세요</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
