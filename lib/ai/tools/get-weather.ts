import { tool } from 'ai';
import { z } from 'zod';
import { isTestEnvironment } from '@/lib/constants';
import { TEST_PROMPTS } from '@/tests/prompts/basic';

export const getWeather = tool({
  description: 'Get the current weather at a location',
  parameters: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  execute: async ({ latitude, longitude }) => {
    if (isTestEnvironment) {
      const fixture = TEST_PROMPTS.GET_WEATHER_RESULT;
      if (fixture.role !== 'tool')
        throw new Error('Invalid weather test fixture');
      return fixture.content[0].result;
    }
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
    );

    const weatherData = await response.json();
    return weatherData;
  },
});
