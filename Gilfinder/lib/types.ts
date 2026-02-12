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
  // EV charger specific
  evChargerTypes?: string[];    // 충전기 타입 코드 목록 (e.g., ['04', '02'])
  evMaxOutput?: number;         // 최대 충전 용량 (kW)
  evOperator?: string;          // 운영기관명
  evChargerCount?: number;      // 충전기 총 수
  evAvailable?: number;         // 사용 가능 충전기 수
  evUseTime?: string;           // 이용 가능 시간
  evParkingFree?: boolean;      // 주차료 무료 여부
}

// EV 충전기 타입 코드 → 이름 매핑
export const CHARGER_TYPE_MAP: Record<string, string> = {
  '01': 'DC차데모',
  '02': 'AC완속',
  '03': 'DC차데모+AC3상',
  '04': 'DC콤보',
  '05': 'DC차데모+DC콤보',
  '06': 'DC차데모+AC3상+DC콤보',
  '07': 'AC3상',
  '08': 'DC콤보+AC3상',
};

// 충전기 타입 → 간략 분류 (필터용)
export const CHARGER_TYPE_CATEGORY: Record<string, string[]> = {
  'DC콤보': ['04', '05', '06', '08'],
  'DC차데모': ['01', '03', '05', '06'],
  'AC3상': ['03', '06', '07', '08'],
  'AC완속': ['02'],
};

// 충전기 상태 코드
export const CHARGER_STATUS_MAP: Record<string, string> = {
  '1': '통신이상',
  '2': '충전대기',
  '3': '충전중',
  '4': '운영중지',
  '5': '점검중',
  '9': '상태미확인',
};

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

export type SearchCategory = 'all' | 'coffee' | 'fuel' | 'food' | 'rest' | 'custom' | 'ev' | 'dt';

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
