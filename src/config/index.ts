// KhmerCoders Bot - Configuration

export const CONFIG = {
  // App metadata
  APP_NAME: "KhmerCoders Bot",
  APP_VERSION: "1.0.0",
  APP_DESCRIPTION: "Community Message Tracking & Leaderboards for Telegram & Discord",
  
  // Rate limiting
  RATE_LIMIT: {
    API_REQUESTS_PER_MINUTE: 60,
    WEBHOOK_REQUESTS_PER_MINUTE: 100,
  },
  
  // Leaderboard settings
  LEADERBOARD: {
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },
  
  // Auto-refresh intervals (in milliseconds)
  REFRESH_INTERVALS: {
    LANDING_STATS: 5 * 60 * 1000, // 5 minutes
    DASHBOARD: 30 * 1000, // 30 seconds
  },
  
  // Supported platforms
  PLATFORMS: ['telegram', 'discord'] as const,
  
  // Supported time periods
  TIME_PERIODS: ['daily', 'weekly', 'monthly', 'all'] as const,
  
  // API endpoints
  API_ENDPOINTS: {
    HEALTH: '/api/health',
    OVERVIEW: '/api/overview',
    STATS: '/api/stats/:platform',
    LEADERBOARD: '/api/leaderboard/:platform/:period?',
    USER: '/api/user/:platform/:userId',
    DOCS: '/api/docs',
  },
  
  // Static file paths
  STATIC_PATHS: {
    CSS: '/css',
    JS: '/js', 
    IMAGES: '/images',
  },
  
  // Page routes
  ROUTES: {
    LANDING: '/',
    DASHBOARD: '/dashboard',
    TELEGRAM_WEBHOOK: '/telegram/webhook',
    DISCORD_WEBHOOK: '/discord/webhook',
  },
} as const;

export type Platform = typeof CONFIG.PLATFORMS[number];
export type TimePeriod = typeof CONFIG.TIME_PERIODS[number];
