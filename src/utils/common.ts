// KhmerCoders Bot - Common Utilities

import { CONFIG } from '../config';

/**
 * Validate if a platform is supported
 */
export function isValidPlatform(platform: string): boolean {
  return CONFIG.PLATFORMS.includes(platform as any);
}

/**
 * Validate if a time period is supported
 */
export function isValidTimePeriod(period: string): boolean {
  return CONFIG.TIME_PERIODS.includes(period as any);
}

/**
 * Sanitize and validate limit parameter
 */
export function sanitizeLimit(limit?: string): number {
  if (!limit) return CONFIG.LEADERBOARD.DEFAULT_LIMIT;
  
  const parsedLimit = parseInt(limit, 10);
  if (isNaN(parsedLimit)) return CONFIG.LEADERBOARD.DEFAULT_LIMIT;
  
  return Math.min(Math.max(1, parsedLimit), CONFIG.LEADERBOARD.MAX_LIMIT);
}

/**
 * Format numbers for display
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Create standardized API response
 */
export function createApiResponse(data: any, success: boolean = true) {
  return {
    success,
    timestamp: new Date().toISOString(),
    ...data,
  };
}

/**
 * Extract client IP from request headers
 */
export function getClientIp(headers: any): string {
  return headers.get("cf-connecting-ip") || 
         headers.get("x-forwarded-for") || 
         headers.get("x-real-ip") || 
         "unknown";
}

/**
 * Generate leaderboard medals
 */
export function getLeaderboardRank(index: number): string {
  const medals = ['🥇', '🥈', '🥉'];
  return index < 3 ? medals[index] : `#${index + 1}`;
}

/**
 * Validate user ID
 */
export function isValidUserId(userId: string): boolean {
  return Boolean(userId && userId.trim() !== "");
}

/**
 * Create error response with consistent format
 */
export function createErrorApiResponse(
  message: string, 
  code: string, 
  statusCode: number = 400
) {
  return {
    success: false,
    error: {
      message,
      code,
      statusCode,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log with timestamp
 */
export function logWithTimestamp(message: string, ...args: any[]): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, ...args);
}

/**
 * Handle async errors safely
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  fallback: T,
  errorMessage?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (errorMessage) {
      logWithTimestamp(errorMessage, error);
    }
    return fallback;
  }
}
