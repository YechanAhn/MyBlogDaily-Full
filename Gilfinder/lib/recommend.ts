import { Place } from './types';

/**
 * Calculate recommendation score for a place.
 * Higher score = better recommendation.
 * Factors: rating, review count, detour time
 */
export function calculateScore(place: Place): number {
  const rating = place.rating || 3.5;
  const reviews = place.reviewCount || 0;
  const detour = place.detourMinutes || 0;

  // 평점 가중치 강화 (rating^1.5)
  const ratingWeight = Math.pow(rating, 1.5);
  // Review weight: log scale so 100 reviews isn't 100x better than 1
  const reviewWeight = Math.log10(reviews + 1) + 1;

  // 우회시간 패널티 완화 (0.15→0.05)
  const detourPenalty = Math.exp(-detour * 0.05);

  // Fuel price bonus (lower price = higher bonus)
  const fuelBonus = place.fuelPrice ? (2000 - place.fuelPrice) / 500 : 0;

  return (ratingWeight * reviewWeight * detourPenalty) + fuelBonus;
}

/**
 * Sort places by recommendation score (highest first)
 */
export function sortByRecommendation(places: Place[]): Place[] {
  return places
    .map(p => ({ ...p, score: calculateScore(p) }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}
