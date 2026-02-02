// Fallback jokes in case API is down
export const FALLBACK_JOKES = [
  "Why don't scientists trust atoms? Because they make up everything!",
  "Why did the scarecrow win an award? Because he was outstanding in his field!",
  "What do you call a fake noodle? An impasta!",
  "Why don't eggs tell jokes? They'd crack each other up!",
  "What did the ocean say to the beach? Nothing, it just waved!",
  "Why did the bicycle fall over? Because it was two-tired!",
  "What do you call cheese that isn't yours? Nacho cheese!",
  "Why did the math book look so sad? Because it had too many problems!",
];

// In-memory cache to avoid excessive API calls
// Note: In serverless environments, consider using Redis for caching
export interface JokeCache {
  joke: string;
  timestamp: number;
  category?: string;
}

// Category-specific cache
const jokeCacheMap: Map<string, JokeCache> = new Map();
export const CACHE_DURATION = 60000; // 1 minute cache

export function getJokeCache(category: string): JokeCache | null {
  return jokeCacheMap.get(category) || null;
}

export function setJokeCache(category: string, cache: JokeCache): void {
  jokeCacheMap.set(category, cache);
}

export function isCacheValid(category: string): boolean {
  const cache = jokeCacheMap.get(category);
  return cache != null && Date.now() - cache.timestamp < CACHE_DURATION;
}

// Map category to JokeAPI category
export function mapCategoryToApiCategory(
  category: string,
): 'Any' | 'Programming' | 'Miscellaneous' | 'Pun' {
  switch (category) {
    case 'programming':
      return 'Programming';
    case 'misc':
      return 'Miscellaneous';
    case 'pun':
      return 'Pun';
    default:
      return 'Any';
  }
}

// Extract joke from API response with proper null handling
export function extractJokeFromResponse(data: any): string {
  if (data.joke) {
    return data.joke;
  }
  
  if (data.setup && data.delivery) {
    return `${data.setup} ${data.delivery}`;
  }
  
  return 'No joke available';
}

