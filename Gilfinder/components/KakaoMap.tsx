'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { LatLng, Place } from '@/lib/types';

declare global {
  interface Window {
    kakao: any;
  }
}

interface KakaoMapProps {
  polyline?: LatLng[];
  places?: Place[];
  selectedPlace?: Place | null;
  mealLocation?: LatLng | null;
  onPlaceSelect?: (place: Place) => void;
  center?: LatLng;
  onMapReady?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'CE7': '#8B5CF6', // cafe - purple
  'OL7': '#22C55E', // fuel - green
  'FD6': '#EF4444', // food - red
  'CS2': '#3B82F6', // convenience - blue
  'default': '#F97316', // orange
};

export default function KakaoMap({
  polyline = [],
  places = [],
  selectedPlace,
  mealLocation,
  onPlaceSelect,
  center,
  onMapReady,
}: KakaoMapProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const overlaysRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const mealMarkerRef = useRef<any>(null);
  const selectedOverlayRef = useRef<any>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    window.kakao.maps.load(() => {
      const defaultCenter = center || { lat: 37.5665, lng: 126.978 };

      // Try to get user's location
      if (navigator.geolocation && !center) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const userCenter = new window.kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setCenter(userCenter);
            }
          },
          () => {},
          { enableHighAccuracy: true, timeout: 3000 }
        );
      }

      const mapOption = {
        center: new window.kakao.maps.LatLng(defaultCenter.lat, defaultCenter.lng),
        level: 5,
      };

      mapInstanceRef.current = new window.kakao.maps.Map(mapRef.current, mapOption);
      setMapLoaded(true);

      // Enable zoom control
      const zoomControl = new window.kakao.maps.ZoomControl();
      mapInstanceRef.current.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

      onMapReady?.();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pan to center when it changes
  useEffect(() => {
    if (!mapInstanceRef.current || !center) return;
    const moveLatLng = new window.kakao.maps.LatLng(center.lat, center.lng);
    mapInstanceRef.current.panTo(moveLatLng);
  }, [center]);

  // 줌 레벨에 따른 마커 크기 조정
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    const handleZoomChange = () => {
      const level = map.getLevel();
      // level이 높을수록 더 넓은 영역 (zoomed out)
      let markerScale = 1;
      if (level >= 10) markerScale = 0.5;       // 먼 곳: 14px
      else if (level >= 7) markerScale = 0.7;    // 중간: 20px
      else markerScale = 1;                       // 가까운 곳: 28px

      // 마커 크기 업데이트
      overlaysRef.current.forEach((overlay) => {
        const content = overlay.getContent();
        if (content instanceof HTMLElement) {
          const marker = content.querySelector('div') as HTMLElement;
          if (marker && !marker.style.animation) {
            // 선택된 마커가 아닌 경우만 크기 조정
            const baseSize = 28;
            const size = Math.round(baseSize * markerScale);
            marker.style.width = size + 'px';
            marker.style.height = size + 'px';
          }
        }
      });
    };

    window.kakao.maps.event.addListener(map, 'zoom_changed', handleZoomChange);

    return () => {
      window.kakao.maps.event.removeListener(map, 'zoom_changed', handleZoomChange);
    };
  }, [mapLoaded]);

  // Draw polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || polyline.length === 0) return;

    if (polylineRef.current) polylineRef.current.setMap(null);

    const path = polyline.map(p => new window.kakao.maps.LatLng(p.lat, p.lng));

    polylineRef.current = new window.kakao.maps.Polyline({
      path,
      strokeWeight: 6,
      strokeColor: '#4285F4',
      strokeOpacity: 0.9,
      strokeStyle: 'solid',
    });

    polylineRef.current.setMap(map);

    // Fit bounds with padding
    const bounds = new window.kakao.maps.LatLngBounds();
    path.forEach((p: any) => bounds.extend(p));
    map.setBounds(bounds, 100, 100, 200, 100); // top, right, bottom, left padding
  }, [polyline]);

  // Draw place markers
  const updateMarkers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing
    markersRef.current.forEach(m => m.setMap(null));
    overlaysRef.current.forEach(o => o.setMap(null));
    markersRef.current = [];
    overlaysRef.current = [];

    places.forEach((place) => {
      const position = new window.kakao.maps.LatLng(place.lat, place.lng);
      const isSelected = selectedPlace?.id === place.id;
      const color = CATEGORY_COLORS[place.categoryCode || ''] || CATEGORY_COLORS.default;

      // Custom marker overlay
      const markerContent = document.createElement('div');
      const hasFuelPrice = place.fuelPrice && place.categoryCode === 'OL7';
      markerContent.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;">
          <div style="
            width: ${isSelected ? '44px' : '28px'};
            height: ${isSelected ? '44px' : '28px'};
            background: ${isSelected ? color : 'white'};
            border: 3px solid ${color};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 2px 8px rgba(0,0,0,${isSelected ? '0.3' : '0.15'});
            ${isSelected ? 'animation: markerPulse 2s ease-in-out infinite;' : ''}
          ">
            <span style="font-size: ${isSelected ? '20px' : '12px'}; ${isSelected ? 'filter: brightness(10);' : ''}">
              ${getCategoryEmoji(place.categoryCode || '')}
            </span>
          </div>
          ${hasFuelPrice ? `<div style="background:#EF4444;color:white;font-size:10px;font-weight:700;padding:1px 5px;border-radius:6px;margin-top:2px;white-space:nowrap;">${place.fuelPrice!.toLocaleString()}원</div>` : ''}
        </div>
      `;

      const overlay = new window.kakao.maps.CustomOverlay({
        position,
        content: markerContent,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: isSelected ? 10 : 1,
      });

      overlay.setMap(map);
      overlaysRef.current.push(overlay);

      markerContent.addEventListener('click', () => {
        onPlaceSelect?.(place);
      });
    });
  }, [places, selectedPlace, onPlaceSelect]);

  useEffect(() => {
    updateMarkers();
  }, [updateMarkers]);

  // Pan to selected place
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedPlace) return;

    // Remove old selected overlay
    if (selectedOverlayRef.current) {
      selectedOverlayRef.current.setMap(null);
    }

    const position = new window.kakao.maps.LatLng(selectedPlace.lat, selectedPlace.lng);
    map.panTo(position);

    // Show info overlay
    const infoContent = `
      <div style="
        background: white;
        padding: 10px 14px;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        font-size: 13px;
        min-width: 160px;
        transform: translateY(-8px);
      ">
        <div style="font-weight: 700; color: #111; margin-bottom: 2px;">${selectedPlace.name}</div>
        <div style="font-size: 11px; color: #999;">${selectedPlace.category}</div>
        <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
          ${selectedPlace.rating !== undefined && selectedPlace.rating !== null ? `<span style="color: #F59E0B; font-weight: 600; font-size: 12px;">★ ${selectedPlace.rating.toFixed(1)}</span>` : ''}
          <span style="color: #3B82F6; font-weight: 600; font-size: 12px;">+${selectedPlace.detourMinutes}분</span>
          ${selectedPlace.fuelPrice ? `<span style="color: #EF4444; font-weight: 700; font-size: 13px;">${selectedPlace.fuelPrice.toLocaleString()}원/L</span>` : ''}
        </div>
      </div>
    `;

    selectedOverlayRef.current = new window.kakao.maps.CustomOverlay({
      position,
      content: infoContent,
      yAnchor: 3.0,
      zIndex: 100,
    });

    selectedOverlayRef.current.setMap(map);
  }, [selectedPlace]);

  // Meal location marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (mealMarkerRef.current) mealMarkerRef.current.setMap(null);

    if (mealLocation) {
      const position = new window.kakao.maps.LatLng(mealLocation.lat, mealLocation.lng);
      const content = `
        <div style="background:#EF4444;color:white;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(239,68,68,0.4);">
          🍽️ 식사 예상 위치
        </div>
      `;
      mealMarkerRef.current = new window.kakao.maps.CustomOverlay({
        position, content, yAnchor: 1.5,
      });
      mealMarkerRef.current.setMap(map);
    }
  }, [mealLocation]);

  return (
    <div className="absolute inset-0 w-full h-full" style={{ touchAction: 'pan-x pan-y' }}>
      <div ref={mapRef} className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-green-50 via-green-100 to-green-50">
          <div className="text-5xl mb-4">🗺️</div>
          <p className="text-sm font-semibold text-gray-600">지도를 불러오는 중...</p>
          <p className="text-xs text-gray-400 mt-1">카카오맵 API 키를 확인해주세요</p>
        </div>
      )}
    </div>
  );
}

function getCategoryEmoji(code: string): string {
  switch (code) {
    case 'CE7': return '☕';
    case 'OL7': return '⛽';
    case 'FD6': return '🍽️';
    case 'CS2': return '🏪';
    default: return '📍';
  }
}
