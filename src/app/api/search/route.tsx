import { NextResponse } from 'next/server';
import { detectRateLimit } from '@/app/lib/utils/rate-limit-detector';

// Define TypeScript interfaces for Roblox API responses
interface RobloxUser {
  id: number;
  name: string;
  displayName: string;
  hasVerifiedBadge: boolean;
  previousUsernames?: string[];
  description?: string;
  created?: string;
  isBanned?: boolean;
}

interface RobloxSearchResponse {
  previousPageCursor?: string | null;
  nextPageCursor?: string | null;
  data: RobloxUser[];
}

interface ErrorResponse {
  error: string;
  rateLimitStatus?: {
    isRateLimited: boolean;
    retryAfter?: number;
    remainingRequests?: number;
    resetTime?: string;
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  const limit = searchParams.get('limit') || '10';
  const cursor = searchParams.get('cursor');

  if (!keyword) {
    return NextResponse.json(
      { error: 'Missing keyword' } as ErrorResponse,
      { status: 400 }
    );
  }

  try {
    // Build the API URL
    let apiUrl = `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
    if (cursor) {
      apiUrl += `&cursor=${encodeURIComponent(cursor)}`;
    }

    const response = await fetch(apiUrl);
    
    // Detect rate limiting
    const rateLimitStatus = detectRateLimit(response);
    
    if (rateLimitStatus.isRateLimited) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          rateLimitStatus: {
            isRateLimited: true,
            retryAfter: rateLimitStatus.retryAfter,
            remainingRequests: rateLimitStatus.remainingRequests,
            resetTime: rateLimitStatus.resetTime?.toISOString(),
          },
        } as ErrorResponse,
        { status: 429 }
      );
    }

    // Check for other errors
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Roblox API error: ${response.status} - ${errorText}` } as ErrorResponse,
        { status: response.status }
      );
    }

    const data = await response.json() as RobloxSearchResponse;
    
    // Validate that we have the expected data structure
    if (!data.data || !Array.isArray(data.data)) {
      return NextResponse.json(
        { error: 'Invalid response from Roblox API' } as ErrorResponse,
        { status: 502 }
      );
    }

    // Add rate limit headers to response
    const headers: Record<string, string> = {};
    if (rateLimitStatus.remainingRequests !== undefined) {
      headers['X-RateLimit-Remaining'] = rateLimitStatus.remainingRequests.toString();
    }
    if (rateLimitStatus.resetTime) {
      headers['X-RateLimit-Reset'] = rateLimitStatus.resetTime.toISOString();
    }

    // Map the data to ensure all users have the expected structure
    const users: RobloxUser[] = data.data.map((user) => ({
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      hasVerifiedBadge: user.hasVerifiedBadge || false,
      previousUsernames: user.previousUsernames || [],
      description: user.description,
      created: user.created,
      isBanned: user.isBanned,
    }));

    const responseData: RobloxSearchResponse = {
      previousPageCursor: data.previousPageCursor,
      nextPageCursor: data.nextPageCursor,
      data: users,
    };

    return NextResponse.json(responseData, { headers });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Roblox' } as ErrorResponse,
      { status: 500 }
    );
  }
}