export interface RateLimitStatus {
  isRateLimited: boolean;
  retryAfter?: number;
  remainingRequests?: number;
  resetTime?: Date;
}

export interface RateLimitResponse {
  statusCode: number;
  headers: Headers;
  data?: any;
}

/**
 * Detects rate limiting from API responses
 * @param response - The fetch response object
 * @returns RateLimitStatus object with rate limit information
 */
export function detectRateLimit(response: Response): RateLimitStatus {
  const status: RateLimitStatus = {
    isRateLimited: false,
  };

  // Check for common rate limit status codes
  if (response.status === 429 || response.status === 503) {
    status.isRateLimited = true;

    // Parse retry-after header (can be in seconds or HTTP date)
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
      const retrySeconds = parseInt(retryAfter, 10);
      if (!isNaN(retrySeconds)) {
        status.retryAfter = retrySeconds;
        status.resetTime = new Date(Date.now() + retrySeconds * 1000);
      } else {
        // Try parsing as date
        const retryDate = new Date(retryAfter);
        if (!isNaN(retryDate.getTime())) {
          status.resetTime = retryDate;
          status.retryAfter = Math.ceil((retryDate.getTime() - Date.now()) / 1000);
        }
      }
    }
  }

  // Check for remaining requests (common header patterns)
  const rateLimitRemaining = response.headers.get('x-rate-limit-remaining') ||
                             response.headers.get('x-ratelimit-remaining') ||
                             response.headers.get('ratelimit-remaining');
  
  if (rateLimitRemaining) {
    status.remainingRequests = parseInt(rateLimitRemaining, 10);
  }

  // Check for reset time
  const rateLimitReset = response.headers.get('x-rate-limit-reset') ||
                        response.headers.get('x-ratelimit-reset') ||
                        response.headers.get('ratelimit-reset');
  
  if (rateLimitReset) {
    const resetTimestamp = parseInt(rateLimitReset, 10);
    if (!isNaN(resetTimestamp)) {
      // Assume Unix timestamp
      status.resetTime = new Date(resetTimestamp * 1000);
      if (!status.retryAfter) {
        status.retryAfter = Math.ceil((status.resetTime.getTime() - Date.now()) / 1000);
      }
    }
  }

  return status;
}

/**
 * Checks if an error is a rate limit error
 * @param error - The error object
 * @returns true if the error is a rate limit error
 */
export function isRateLimitError(error: any): boolean {
  if (!error) return false;
  
  // Check for rate limit in error message
  const errorMessage = error.message?.toLowerCase() || '';
  const rateLimitKeywords = ['rate limit', 'too many requests', '429', 'quota exceeded'];
  
  return rateLimitKeywords.some(keyword => errorMessage.includes(keyword));
}

/**
 * Formats a duration in seconds to a human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "2 minutes", "30 seconds")
 */
export function formatRetryDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
}
