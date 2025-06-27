// Rate limiting and security helpers for the bot

/**
 * Simple in-memory rate limiter using Map
 * In production, consider using Cloudflare KV or D1 for persistence
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if a request should be rate limited
   *
   * @param key - Unique identifier (e.g., user ID, IP address)
   * @returns boolean - true if rate limited, false if allowed
   */
  isRateLimited(key: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];
    
    // Remove expired requests
    const validRequests = userRequests.filter(
      (timestamp) => now - timestamp < this.windowMs
    );
    
    if (validRequests.length >= this.maxRequests) {
      return true;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return false;
  }

  /**
   * Get remaining requests for a key
   *
   * @param key - Unique identifier
   * @returns number of remaining requests
   */
  getRemainingRequests(key: string): number {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];
    const validRequests = userRequests.filter(
      (timestamp) => now - timestamp < this.windowMs
    );
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  /**
   * Get time until rate limit resets
   *
   * @param key - Unique identifier
   * @returns milliseconds until reset
   */
  getResetTime(key: string): number {
    const userRequests = this.requests.get(key) || [];
    if (userRequests.length === 0) return 0;
    
    const oldestRequest = Math.min(...userRequests);
    return Math.max(0, this.windowMs - (Date.now() - oldestRequest));
  }

  /**
   * Clean up expired entries (call periodically)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(
        (timestamp) => now - timestamp < this.windowMs
      );
      
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }
}

// Global rate limiters for different command types
export const commandRateLimiter = new RateLimiter(5, 60000); // 5 commands per minute
export const summaryRateLimiter = new RateLimiter(2, 300000); // 2 summaries per 5 minutes
export const apiRateLimiter = new RateLimiter(60, 60000); // 60 API requests per minute

/**
 * Validate and sanitize user input
 *
 * @param input - User input string
 * @param maxLength - Maximum allowed length
 * @returns sanitized string or null if invalid
 */
export function sanitizeInput(input: string, maxLength: number = 1000): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }
  
  // Remove potential XSS/injection attempts
  const sanitized = input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
  
  if (sanitized.length > maxLength) {
    return sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Check if a user has admin privileges
 * This is a simple implementation - in production, store admin list in database
 *
 * @param userId - User ID to check
 * @param platform - Platform (telegram/discord)
 * @returns boolean indicating admin status
 */
export function isAdmin(userId: string, platform: string): boolean {
  // Add your admin user IDs here
  const adminUsers: Record<string, string[]> = {
    telegram: [
      "188725399", // Example: Add your Telegram user ID
    ],
    discord: [
      // Add Discord user IDs here
    ],
  };
  
  return adminUsers[platform]?.includes(userId) || false;
}

/**
 * Log security events
 *
 * @param event - Type of security event
 * @param details - Event details
 * @param userId - User ID involved
 * @param platform - Platform where event occurred
 */
export function logSecurityEvent(
  event: string,
  details: string,
  userId?: string,
  platform?: string
): void {
  const timestamp = new Date().toISOString();
  console.warn(
    `[SECURITY][${timestamp}] ${event}: ${details}${
      userId ? ` - User: ${userId}` : ""
    }${platform ? ` - Platform: ${platform}` : ""}`
  );
}

/**
 * Detect potential spam or abuse
 *
 * @param text - Message text to analyze
 * @returns object with abuse indicators
 */
export function detectAbuse(text: string): {
  isSpam: boolean;
  isFlood: boolean;
  containsSuspiciousContent: boolean;
  score: number;
} {
  if (!text) {
    return { isSpam: false, isFlood: false, containsSuspiciousContent: false, score: 0 };
  }
  
  let score = 0;
  
  // Check for repeated characters (flooding)
  const repeatedChars = /(.)\1{10,}/g;
  const isFlood = repeatedChars.test(text);
  if (isFlood) score += 30;
  
  // Check for excessive caps
  const capsPercentage = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsPercentage > 0.7 && text.length > 10) score += 20;
  
  // Check for suspicious URLs or patterns
  const suspiciousPatterns = [
    /bit\.ly/gi,
    /tinyurl/gi,
    /telegram\.me\/joinchat/gi,
    /discord\.gg/gi,
    /free.*crypto/gi,
    /click.*here.*now/gi,
  ];
  
  const containsSuspiciousContent = suspiciousPatterns.some(pattern => 
    pattern.test(text)
  );
  if (containsSuspiciousContent) score += 40;
  
  // Check for excessive emojis
  const emojiCount = (text.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
  if (emojiCount > text.length * 0.3 && text.length > 5) score += 15;
  
  const isSpam = score >= 50;
  
  return {
    isSpam,
    isFlood,
    containsSuspiciousContent,
    score,
  };
}

/**
 * Create a standardized error response
 *
 * @param message - Error message
 * @param code - Error code
 * @param statusCode - HTTP status code
 * @returns formatted error object
 */
export function createErrorResponse(
  message: string,
  code: string = "UNKNOWN_ERROR",
  statusCode: number = 500
) {
  return {
    error: {
      message,
      code,
      timestamp: new Date().toISOString(),
    },
    statusCode,
  };
}

/**
 * Periodic cleanup function for rate limiters
 * Call this in a scheduled worker or periodic task
 */
export function performCleanup(): void {
  commandRateLimiter.cleanup();
  summaryRateLimiter.cleanup();
  apiRateLimiter.cleanup();
}
