import { tool } from 'ai';
import { z } from 'zod';

// In-memory cache to avoid excessive API calls
interface JokeCache {
  joke: string;
  timestamp: number;
}

let jokeCache: JokeCache | null = null;
const CACHE_DURATION = 60000; // 1 minute cache

// Fallback jokes in case API is down
const fallbackJokes = [
  "Why don't scientists trust atoms? Because they make up everything!",
  "Why did the scarecrow win an award? Because he was outstanding in his field!",
  "What do you call a fake noodle? An impasta!",
  "Why don't eggs tell jokes? They'd crack each other up!",
  "What did the ocean say to the beach? Nothing, it just waved!",
];

export const getJoke = tool({
  description: 'Get a random joke to entertain the user',
  parameters: z.object({
    category: z
      .enum(['any', 'programming', 'misc', 'pun'])
      .optional()
      .describe('The category of joke to fetch'),
  }),
  execute: async ({ category = 'any' }) => {
    // Check cache first
    if (jokeCache && Date.now() - jokeCache.timestamp < CACHE_DURATION) {
      return {
        joke: jokeCache.joke,
        source: 'cache',
      };
    }

    try {
      // Use JokeAPI - it's free and doesn't require authentication
      const categoryParam =
        category === 'any' ? 'Any' : category === 'programming' ? 'Programming' : 'Miscellaneous';
      const response = await fetch(
        `https://v2.jokeapi.dev/joke/${categoryParam}?blacklistFlags=nsfw,religious,political,racist,sexist,explicit&type=single`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.message || 'API returned an error');
      }

      const joke = data.joke || `${data.setup} ${data.delivery}`;

      // Update cache
      jokeCache = {
        joke,
        timestamp: Date.now(),
      };

      return {
        joke,
        source: 'api',
        category: data.category,
      };
    } catch (error) {
      // Fallback to local jokes if API fails
      const randomJoke =
        fallbackJokes[Math.floor(Math.random() * fallbackJokes.length)];

      return {
        joke: randomJoke,
        source: 'fallback',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
