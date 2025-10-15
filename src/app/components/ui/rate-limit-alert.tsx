'use client';

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import { RateLimitStatus, formatRetryDuration } from '@/app/lib/utils/rate-limit-detector';

export interface RateLimitAlertProps {
  rateLimitStatus: RateLimitStatus;
  onDismiss?: () => void;
}

export function RateLimitAlert({ rateLimitStatus, onDismiss }: RateLimitAlertProps) {
  if (!rateLimitStatus.isRateLimited) {
    return null;
  }

  const retryMessage = rateLimitStatus.retryAfter
    ? `Please try again in ${formatRetryDuration(rateLimitStatus.retryAfter)}.`
    : 'Please try again later.';

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTitle>Rate Limit Exceeded</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          You&apos;ve made too many requests to the Roblox API. {retryMessage}
        </p>
        {rateLimitStatus.resetTime && (
          <p className="text-xs opacity-80">
            Rate limit will reset at {rateLimitStatus.resetTime.toLocaleTimeString()}
          </p>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="mt-2 text-xs underline hover:no-underline"
          >
            Dismiss
          </button>
        )}
      </AlertDescription>
    </Alert>
  );
}
