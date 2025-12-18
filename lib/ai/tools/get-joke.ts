import { tool } from 'ai';
import { z } from 'zod';
import {
  FALLBACK_JOKES,
  getJokeCache,
  isCacheValid,
  mapCategoryToApiCategory,
  setJokeCache,
} from '@/lib/utils/joke-utils';

export const getJoke = tool({
  description: 'Get a random joke to entertain the user',
  parameters: z.object({
    category: z
      .enum(['any', 'programming', 'misc', 'pun'])
      .optional()
      .describe('The category of joke to fetch'),
  }),
  execute: async ({ category = 'any' }) => {
    // Check cache first (category-specific)
    const cachedJoke = getJokeCache(category);
    if (cachedJoke && isCacheValid(category)) {
      return {
        joke: cachedJoke.joke,
        source: 'cache',
        category: cachedJoke.category,
      };
    }

    try {
      // Use JokeAPI - it's free and doesn't require authentication
      const categoryParam = mapCategoryToApiCategory(category);
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

      // Update cache (category-specific)
      setJokeCache(category, {
        joke,
        timestamp: Date.now(),
        category: data.category,
      });

      return {
        joke,
        source: 'api',
        category: data.category,
      };
    } catch (error) {
      // Fallback to local jokes if API fails
      const randomJoke =
        FALLBACK_JOKES[Math.floor(Math.random() * FALLBACK_JOKES.length)];

      return {
        joke: randomJoke,
        source: 'fallback',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
