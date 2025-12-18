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
export interface JokeCache {
  joke: string;
  timestamp: number;
  category?: string;
}

let jokeCache: JokeCache | null = null;
export const CACHE_DURATION = 60000; // 1 minute cache

export function getJokeCache(): JokeCache | null {
  return jokeCache;
}

export function setJokeCache(cache: JokeCache): void {
  jokeCache = cache;
}

export function isCacheValid(): boolean {
  return jokeCache !== null && Date.now() - jokeCache.timestamp < CACHE_DURATION;
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
