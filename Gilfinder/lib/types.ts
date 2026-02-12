// Coordinate types
export interface LatLng {
  lat: number;
  lng: number;
}

// Address search result from Kakao
export interface AddressResult {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  lat: number;
  lng: number;
  category?: string;
}

export interface Place {
  id: string;
  name: string;
  category: string;
  categoryCode?: string;
  address: string;
  roadAddress: string;
  phone: string;
  lat: number;
  lng: number;
  distance: number; // meters from route
  detourMinutes: number; // actual driving detour time
  detourDistance?: number; // actual detour distance in meters
  rating?: number;
  reviewCount?: number;
  ratingSource?: 'kakao' | 'google' | null;
  placeUrl?: string;
  imageUrl?: string;
  isOpen?: boolean;
  openHours?: string; // 영업시간 정보 (예: "영업중", "10:00~22:00")
  score?: number; // recommendation score
  // Fuel specific
  fuelPrice?: number;
  fuelType?: string;
  isSelfService?: boolean;
}

export interface RouteSection {
  distance: number; // meters
  duration: number; // seconds
  startCoord: LatLng;
  endCoord: LatLng;
  roads: RouteRoad[];
}

export interface RouteRoad {
  name: string;
  distance: number;
  duration: number;
  vertexes: number[]; // [lng, lat, lng, lat, ...]
}

export interface RouteResult {
  totalDistance: number; // meters
  totalDuration: number; // seconds
  polyline: LatLng[];
  sections: RouteSection[];
}

export type SearchCategory = 'all' | 'coffee' | 'fuel' | 'food' | 'convenience' | 'rest' | 'custom' | 'ev' | 'toilet';

export type FuelType = 'gasoline' | 'diesel' | 'lpg';

export type NaviApp = 'kakao' | 'naver' | 'tmap';

export type MealSearchMode = 'time' | 'region';

export interface MealSearchParams {
  mode: MealSearchMode;
  hoursFromNow?: number; // e.g. 1 = "1시간 후"
  regionName?: string;   // e.g. "횡성"
}

// App state
export type AppView = 'home' | 'search' | 'route' | 'detail';

export interface AppState {
  view: AppView;
  originName: string;
  originCoord: LatLng | null;
  destName: string;
  destCoord: LatLng | null;
  category: SearchCategory;
  customKeyword: string;
  maxDetourMin: number;
  route: RouteResult | null;
  places: Place[];
  selectedPlace: Place | null;
  isLoading: boolean;
  error: string | null;
}
