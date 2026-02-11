'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import KakaoMap from '@/components/KakaoMap';
import PlaceCard from '@/components/PlaceCard';
import NaviSelector from '@/components/NaviSelector';
import { LatLng, Place, RouteResult, RouteSection, SearchCategory } from '@/lib/types';
import type { FuelType } from '@/lib/types';
import { parseVertexes } from '@/lib/polyline';
import { searchAlongRoute } from '@/lib/searchAlongRoute';
import { estimateLocationAfterHours } from '@/lib/estimateArrival';

function ResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [showNaviSelector, setShowNaviSelector] = useState(false);
  const [mealLocation, setMealLocation] = useState<LatLng | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse search params
  const origin = searchParams.get('origin') || '';
  const destination = searchParams.get('destination') || '';
  const category = (searchParams.get('category') || 'food') as SearchCategory;
  const maxDetourMin = parseInt(searchParams.get('maxDetourMin') || '5');
  const keyword = searchParams.get('keyword') || '';
  const mealTime = searchParams.get('mealTime') || '';
  const minRating = parseFloat(searchParams.get('minRating') || '0');
  const fuelType = (searchParams.get('fuelType') || 'gasoline') as FuelType;

  const originCoord: LatLng = {
    lat: parseFloat(origin.split(',')[0]),
    lng: parseFloat(origin.split(',')[1]),
  };
  const destCoord: LatLng = {
    lat: parseFloat(destination.split(',')[0]),
    lng: parseFloat(destination.split(',')[1]),
  };

  // Fetch route and search places
  const fetchRouteAndSearch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Get route from Kakao Mobility
      const routeRes = await fetch(
        `/api/route?origin=${originCoord.lng},${originCoord.lat}&destination=${destCoord.lng},${destCoord.lat}`
      );

      if (!routeRes.ok) {
        throw new Error('경로를 찾을 수 없습니다.');
      }

      const routeData = await routeRes.json();

      // Parse route data
      const routes = routeData.routes;
      if (!routes || routes.length === 0) {
        throw new Error('경로를 찾을 수 없습니다.');
      }

      const route = routes[0];
      const sections: RouteSection[] = route.sections?.map((section: any) => ({
        distance: section.distance,
        duration: section.duration,
        startCoord: { lat: section.roads?.[0]?.vertexes?.[1] || 0, lng: section.roads?.[0]?.vertexes?.[0] || 0 },
        endCoord: {
          lat: section.roads?.[section.roads.length - 1]?.vertexes?.[section.roads[section.roads.length - 1]?.vertexes?.length - 1] || 0,
          lng: section.roads?.[section.roads.length - 1]?.vertexes?.[section.roads[section.roads.length - 1]?.vertexes?.length - 2] || 0,
        },
        roads: section.roads || [],
      })) || [];

      // Extract polyline from all roads
      const polyline: LatLng[] = [];
      for (const section of route.sections || []) {
        for (const road of section.roads || []) {
          const points = parseVertexes(road.vertexes || []);
          polyline.push(...points);
        }
      }

      const result: RouteResult = {
        totalDistance: route.summary?.distance || 0,
        totalDuration: route.summary?.duration || 0,
        polyline,
        sections,
      };

      setRouteResult(result);

      // 2. Calculate meal location if food category
      if (category === 'food' && mealTime) {
        const hours = parseFloat(mealTime) || 1;
        const mealLoc = estimateLocationAfterHours(sections, hours);
        setMealLocation(mealLoc);
      }

      // 3. Search places along route
      const searchKeyword = category === 'custom' ? keyword : undefined;
      const foundPlaces = await searchAlongRoute(
        polyline,
        category,
        searchKeyword,
        maxDetourMin
      );

      // Apply additional filters
      let filtered = foundPlaces;
      if (category === 'food' && minRating > 0) {
        filtered = filtered.filter((p) => !p.rating || p.rating >= minRating);
      }

      setPlaces(filtered);
    } catch (err: any) {
      setError(err.message || '검색 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination, category, maxDetourMin, keyword, mealTime, minRating, fuelType]);

  useEffect(() => {
    if (origin && destination) {
      fetchRouteAndSearch();
    }
  }, [fetchRouteAndSearch, origin, destination]);

  const handlePlaceSelect = (place: Place) => {
    setSelectedPlace(place);
  };

  const handleNavigate = () => {
    if (selectedPlace) {
      setShowNaviSelector(true);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}시간 ${minutes}분`;
    return `${minutes}분`;
  };

  const formatDistance = (meters: number) => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
    return `${meters}m`;
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 safe-top flex items-center gap-3 z-10">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          {routeResult && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-gray-900">
                {formatDistance(routeResult.totalDistance)}
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-blue-600 font-medium">
                {formatDuration(routeResult.totalDuration)}
              </span>
            </div>
          )}
          {isLoading && (
            <span className="text-sm text-gray-400">경로 검색 중...</span>
          )}
        </div>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
          {places.length}개 발견
        </span>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative">
        {error ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center">
              <p className="text-4xl mb-4">😥</p>
              <p className="text-gray-600 font-medium mb-2">{error}</p>
              <button
                onClick={() => router.back()}
                className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium"
              >
                돌아가기
              </button>
            </div>
          </div>
        ) : (
          <KakaoMap
            polyline={routeResult?.polyline}
            places={places}
            selectedPlace={selectedPlace}
            mealLocation={mealLocation}
            onPlaceSelect={handlePlaceSelect}
          />
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-600 font-medium">경로 위 장소를 찾고 있어요...</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Card List */}
      {places.length > 0 && (
        <div className="bg-white border-t border-gray-200 pt-3 pb-2 safe-bottom">
          {/* Selected place action bar */}
          {selectedPlace && (
            <div className="px-4 mb-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{selectedPlace.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {selectedPlace.roadAddress || selectedPlace.address}
                </p>
              </div>
              <button
                onClick={handleNavigate}
                className="ml-3 px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-lg active:bg-blue-600 flex-shrink-0"
              >
                내비 출발
              </button>
            </div>
          )}

          {/* Horizontal scroll cards */}
          <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x px-4 pb-2">
            {places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                isSelected={selectedPlace?.id === place.id}
                onClick={() => handlePlaceSelect(place)}
              />
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {!isLoading && places.length === 0 && !error && (
        <div className="bg-white border-t border-gray-200 p-8 text-center safe-bottom">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-sm text-gray-600 font-medium">경로 주변에 결과가 없습니다</p>
          <p className="text-xs text-gray-400 mt-1">이탈 시간을 늘려보세요</p>
        </div>
      )}

      {/* Navi Selector Modal */}
      {showNaviSelector && selectedPlace && (
        <NaviSelector
          start={originCoord}
          end={{ ...destCoord, name: '도착지' }}
          waypoint={selectedPlace}
          onClose={() => setShowNaviSelector(false)}
        />
      )}
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">로딩 중...</p>
        </div>
      </div>
    }>
      <ResultContent />
    </Suspense>
  );
}
