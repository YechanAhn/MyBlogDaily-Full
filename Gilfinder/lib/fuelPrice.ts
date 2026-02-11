import { Place, FuelType } from './types';

/**
 * Sort places by combined score of fuel price and detour time
 * Lower score = better
 */
export function sortByFuelValue(places: Place[]): Place[] {
  return [...places].sort((a, b) => {
    const priceA = a.fuelPrice || Infinity;
    const priceB = b.fuelPrice || Infinity;

    // Weighted score: price difference + detour penalty
    // Each minute of detour is worth ~20원/L (approximate value of time)
    const scoreA = priceA + a.detourMinutes * 20;
    const scoreB = priceB + b.detourMinutes * 20;

    return scoreA - scoreB;
  });
}

/**
 * Format fuel price for display
 */
export function formatFuelPrice(price: number): string {
  return price.toLocaleString('ko-KR') + '원/L';
}

/**
 * Get fuel type display name in Korean
 */
export function getFuelTypeName(type: FuelType): string {
  switch (type) {
    case 'gasoline':
      return '휘발유';
    case 'diesel':
      return '경유';
    case 'lpg':
      return 'LPG';
  }
}

/**
 * Get OPINET fuel type code
 */
export function getOpinetFuelCode(type: FuelType): string {
  switch (type) {
    case 'gasoline':
      return 'B027';
    case 'diesel':
      return 'D047';
    case 'lpg':
      return 'K015';
  }
}
