import { LatLng, NaviApp } from './types';

interface DeeplinkTarget extends LatLng {
  name?: string;
}

/**
 * Generate deep link URL for navigation apps
 */
export function generateDeeplink(
  navi: NaviApp,
  start: DeeplinkTarget,
  end: DeeplinkTarget,
  waypoint?: DeeplinkTarget
): string {
  switch (navi) {
    case 'kakao': {
      let url = `kakaomap://route?sp=${start.lat},${start.lng}&ep=${end.lat},${end.lng}&by=car`;
      if (waypoint) url += `&vp=${waypoint.lat},${waypoint.lng}`;
      return url;
    }
    case 'naver': {
      // 네이버: dname에 장소명 표시 (도로명 대신)
      let url = `nmap://route/car?slat=${start.lat}&slng=${start.lng}&sname=${encodeURIComponent(start.name || '출발지')}&dlat=${end.lat}&dlng=${end.lng}&dname=${encodeURIComponent(end.name || '도착지')}&appname=com.gilfinder`;
      if (waypoint) {
        url += `&v1lat=${waypoint.lat}&v1lng=${waypoint.lng}&v1name=${encodeURIComponent(waypoint.name || '경유지')}`;
      }
      return url;
    }
    case 'tmap': {
      // T맵은 경유지를 rVX/rVY로 전달, 최종 도착지는 rGoX/rGoY
      let url = `tmap://route?rGoName=${encodeURIComponent(end.name || '도착지')}&rGoX=${end.lng}&rGoY=${end.lat}`;
      if (waypoint) {
        url += `&rV1Name=${encodeURIComponent(waypoint.name || '경유지')}&rV1X=${waypoint.lng}&rV1Y=${waypoint.lat}`;
      }
      return url;
    }
  }
}

/**
 * App store fallback URLs
 */
const APP_STORE_URLS: Record<NaviApp, { ios: string; android: string }> = {
  kakao: {
    ios: 'https://apps.apple.com/kr/app/카카오맵/id304608425',
    android: 'https://play.google.com/store/apps/details?id=net.daum.android.map',
  },
  naver: {
    ios: 'https://apps.apple.com/kr/app/네이버-지도/id311867728',
    android: 'https://play.google.com/store/apps/details?id=com.nhn.android.nmap',
  },
  tmap: {
    ios: 'https://apps.apple.com/kr/app/tmap/id431589174',
    android: 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku',
  },
};

/**
 * Open navigation app with fallback to app store
 */
export function openNaviApp(
  navi: NaviApp,
  start: DeeplinkTarget,
  end: DeeplinkTarget,
  waypoint?: DeeplinkTarget
): void {
  const deeplink = generateDeeplink(navi, start, end, waypoint);

  // Try to open the app
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Use a hidden iframe approach for iOS, direct location for Android
  if (isIOS) {
    window.location.href = deeplink;

    // Fallback to App Store after delay
    setTimeout(() => {
      if (!document.hidden) {
        window.location.href = APP_STORE_URLS[navi].ios;
      }
    }, 1500);
  } else {
    // Android
    const intent = deeplink;
    window.location.href = intent;

    setTimeout(() => {
      if (!document.hidden) {
        window.location.href = APP_STORE_URLS[navi].android;
      }
    }, 1500);
  }
}

/**
 * Get navi app display info
 */
export function getNaviInfo(navi: NaviApp): { name: string; color: string; icon: string } {
  switch (navi) {
    case 'kakao':
      return { name: '카카오내비', color: '#FEE500', icon: '🗺️' };
    case 'naver':
      return { name: '네이버지도', color: '#03C75A', icon: '🧭' };
    case 'tmap':
      return { name: 'T맵', color: '#EF4135', icon: '🚗' };
  }
}
