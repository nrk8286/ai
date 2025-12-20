# Random Joke Generator

## Overview
The Random Joke Generator feature allows users to get random jokes from an external API (JokeAPI) through the chatbot interface or via a dedicated API endpoint.

## Features
- **AI Chat Integration**: Ask the chatbot for jokes naturally (e.g., "Tell me a joke")
- **Category Support**: Request specific types of jokes (programming, misc, pun)
- **Caching**: 1-minute cache to reduce API calls
- **Rate Limiting**: 10 requests per minute per user (when Redis is configured)
- **Fallback Mechanism**: Built-in fallback jokes when API is unavailable
- **Content Filtering**: Automatically filters out NSFW, religious, political, racist, sexist, and explicit content

## Usage

### Via Chat Interface
Simply ask the chatbot for a joke:
- "Tell me a joke"
- "Tell me a programming joke"
- "I need a laugh, tell me something funny"

The AI will automatically call the joke tool and return a joke to you.

### Via API Endpoint
Make a GET request to `/api/joke` with optional query parameters:

```bash
# Get any random joke
curl -X GET "https://your-domain.com/api/joke" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Get a programming joke
curl -X GET "https://your-domain.com/api/joke?category=programming" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

**Query Parameters:**
- `category` (optional): The category of joke to fetch
  - Values: `any`, `programming`, `misc`, `pun`
  - Default: `any`

**Response Format:**
```json
{
  "joke": "Why don't scientists trust atoms? Because they make up everything!",
  "source": "api",
  "category": "Misc"
}
```

**Response Fields:**
- `joke`: The joke text
- `source`: Where the joke came from (`api`, `cache`, or `fallback`)
- `category`: The category of the joke (when from API)
- `error`: Error message (only present when using fallback)

## Rate Limiting
When Redis is configured (via `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables), the API endpoint applies rate limiting:
- **Limit**: 10 requests per minute per user
- **Response on rate limit exceeded**: HTTP 429 with rate limit headers

Rate limit headers in response:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Timestamp when limit resets

## Technical Implementation

### Architecture
1. **AI Tool** (`lib/ai/tools/get-joke.ts`): Integrated with the AI SDK for natural language requests
2. **API Route** (`app/(chat)/api/joke/route.ts`): Standalone REST endpoint for direct access

### External API
Uses [JokeAPI v2](https://v2.jokeapi.dev/) which:
- Is free to use
- Doesn't require authentication
- Supports multiple categories
- Provides content filtering options

### Caching Strategy
- Category-specific in-memory cache with 1-minute TTL
- Each category (any, programming, misc, pun) has its own cache
- Reduces load on external API
- Improves response time for repeated requests
- **Note**: In serverless environments, consider using Redis for persistent caching across instances

### Error Handling
1. API failures trigger fallback to local jokes
2. Network timeouts return fallback jokes
3. Rate limiting returns proper HTTP 429 status
4. Authentication failures return HTTP 401

### Fallback Jokes
The system includes 8 family-friendly fallback jokes that are used when:
- The external API is unavailable
- Network connectivity issues occur
- The API returns an error

## Configuration
No additional configuration required. The feature works out of the box.

**Optional**:
- Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to enable rate limiting

## Testing
Tests are located in `tests/joke.test.ts` and cover:
- Basic joke fetching via chat
- Category-specific joke requests
- Error handling scenarios

Run tests:
```bash
pnpm test tests/joke.test.ts
```

## Security Considerations
- All jokes are filtered for inappropriate content
- Rate limiting prevents abuse (when configured)
- Authentication required for all requests
- No sensitive data stored or transmitted

## Future Enhancements
- Add support for more joke categories
- Implement user preferences for joke types
- Add joke favorites/history
- Support multi-part jokes (setup + delivery)
- Add custom joke submission feature
