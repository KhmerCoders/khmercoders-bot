import { Hono } from "hono";
import { DiscordWebhookPayload } from "./types/discord";
import { handleTelegramWebhook } from "./handlers/telegramHandler";
import { trackMessage } from "./utils/db-helpers";
import {
  getDailyLeaderboard,
  getWeeklyLeaderboard,
  getMonthlyLeaderboard,
  getAllTimeLeaderboard,
  getPlatformStats,
  getUserStats,
} from "./utils/stats-helpers";
import { apiRateLimiter, createErrorResponse } from "./utils/security-helpers";
import { 
  handleLandingPage, 
  handleDashboardPage, 
  serveCssAssets, 
  serveJsAssets, 
  serveImageAssets 
} from "./utils/route-handlers";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Serve static assets
app.get("/css/*", serveCssAssets);
app.get("/js/*", serveJsAssets);
app.get("/images/*", serveImageAssets);

// Landing page route
app.get("/", handleLandingPage);

// Serve the detailed dashboard
app.get("/dashboard", handleDashboardPage);

// Handle Telegram webhook requests
app.post("/telegram/webhook", handleTelegramWebhook);

// Handle Discord webhook requests
app.post("/discord/webhook", async (c) => {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Received Discord webhook request`);

    // Parse the incoming webhook data
    const payload: DiscordWebhookPayload = await c.req.json();

    // Early return if no message data or user ID found
    if (!payload || !payload.username || !payload.user_id) {
      console.log(
        `[${timestamp}] No valid message data found in the Discord webhook payload`
      );
      return c.json({ success: false, error: "No valid message data found" });
    }

    // Use the username as the display name
    const displayName = payload.username || "Unknown Discord User";

    // Use the user_id directly as a string
    const userId = payload.user_id;

    const text = payload.content || "";

    console.log(
      `[${timestamp}] Processing message from Discord user: ${displayName} (ID: ${payload.user_id})`
    );

    // Track the message in our database
    await trackMessage(c.env.DB, "discord", userId, displayName, text.length);

    console.log(
      `[${timestamp}] Successfully tracked message from Discord user: ${displayName}`
    );
    return c.json({ success: true });
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] Error processing Discord webhook:`, error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// API Routes for Web Dashboard

// Rate limiting middleware for API routes
app.use("/api/*", async (c, next) => {
  const clientIp = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
  
  if (apiRateLimiter.isRateLimited(clientIp)) {
    const resetTime = Math.ceil(apiRateLimiter.getResetTime(clientIp) / 1000);
    return c.json(
      createErrorResponse(
        `Rate limit exceeded. Try again in ${resetTime} seconds.`,
        "RATE_LIMITED",
        429
      ),
      429
    );
  }
  
  await next();
});

// Get platform statistics
app.get("/api/stats/:platform", async (c) => {
  try {
    const platform = c.req.param("platform");

    if (!["telegram", "discord"].includes(platform)) {
      return c.json(
        createErrorResponse(
          "Invalid platform. Use 'telegram' or 'discord'",
          "INVALID_PLATFORM",
          400
        ),
        400
      );
    }

    const stats = await getPlatformStats(c.env.DB, platform);
    return c.json({ 
      success: true,
      platform, 
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error getting platform stats:", error);
    return c.json(
      createErrorResponse("Internal server error", "INTERNAL_ERROR", 500),
      500
    );
  }
});

// Get leaderboard for a specific platform and period
app.get("/api/leaderboard/:platform/:period?", async (c) => {
  try {
    const platform = c.req.param("platform");
    const period = c.req.param("period") || "all";
    const limit = Math.min(parseInt(c.req.query("limit") || "10"), 100); // Max 100 entries

    if (!["telegram", "discord"].includes(platform)) {
      return c.json(
        createErrorResponse(
          "Invalid platform. Use 'telegram' or 'discord'",
          "INVALID_PLATFORM",
          400
        ),
        400
      );
    }

    if (!["daily", "weekly", "monthly", "all"].includes(period)) {
      return c.json(
        createErrorResponse(
          "Invalid period. Use 'daily', 'weekly', 'monthly', or 'all'",
          "INVALID_PERIOD",
          400
        ),
        400
      );
    }

    let leaderboard;
    switch (period) {
      case "daily":
        leaderboard = await getDailyLeaderboard(
          c.env.DB,
          platform,
          undefined,
          limit
        );
        break;
      case "weekly":
        leaderboard = await getWeeklyLeaderboard(c.env.DB, platform, limit);
        break;
      case "monthly":
        leaderboard = await getMonthlyLeaderboard(c.env.DB, platform, limit);
        break;
      case "all":
      default:
        leaderboard = await getAllTimeLeaderboard(c.env.DB, platform, limit);
        break;
    }

    return c.json({
      success: true,
      platform,
      period,
      limit,
      leaderboard,
      count: leaderboard.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting leaderboard:", error);
    return c.json(
      createErrorResponse("Internal server error", "INTERNAL_ERROR", 500),
      500
    );
  }
});

// Get user statistics
app.get("/api/user/:platform/:userId", async (c) => {
  try {
    const platform = c.req.param("platform");
    const userId = c.req.param("userId");

    if (!["telegram", "discord"].includes(platform)) {
      return c.json(
        createErrorResponse(
          "Invalid platform. Use 'telegram' or 'discord'",
          "INVALID_PLATFORM",
          400
        ),
        400
      );
    }

    if (!userId || userId.trim() === "") {
      return c.json(
        createErrorResponse(
          "User ID is required",
          "MISSING_USER_ID",
          400
        ),
        400
      );
    }

    const stats = await getUserStats(c.env.DB, platform, userId);
    return c.json({ 
      success: true,
      platform, 
      userId, 
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error getting user stats:", error);
    return c.json(
      createErrorResponse("Internal server error", "INTERNAL_ERROR", 500),
      500
    );
  }
});

// Get combined statistics from both platforms
app.get("/api/overview", async (c) => {
  try {
    const [telegramStats, discordStats] = await Promise.all([
      getPlatformStats(c.env.DB, "telegram"),
      getPlatformStats(c.env.DB, "discord"),
    ]);

    const totalStats = {
      totalUsers: telegramStats.totalUsers + discordStats.totalUsers,
      totalMessages: telegramStats.totalMessages + discordStats.totalMessages,
      activeToday: telegramStats.activeToday + discordStats.activeToday,
      activeThisWeek: telegramStats.activeThisWeek + discordStats.activeThisWeek,
    };

    return c.json({
      success: true,
      total: totalStats,
      platforms: {
        telegram: telegramStats,
        discord: discordStats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting overview stats:", error);
    return c.json(
      createErrorResponse("Internal server error", "INTERNAL_ERROR", 500),
      500
    );
  }
});

// Health check endpoint
app.get("/api/health", (c) => {
  return c.json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// API documentation endpoint
app.get("/api/docs", (c) => {
  return c.json({
    success: true,
    title: "KhmerCoders Bot API",
    version: "1.0.0",
    endpoints: {
      "GET /api/health": "Health check",
      "GET /api/overview": "Get combined platform statistics",
      "GET /api/stats/:platform": "Get platform-specific statistics",
      "GET /api/leaderboard/:platform/:period?": "Get leaderboard (period: daily/weekly/monthly/all)",
      "GET /api/user/:platform/:userId": "Get user statistics",
      "POST /telegram/webhook": "Telegram webhook endpoint",
      "POST /discord/webhook": "Discord webhook endpoint",
    },
    parameters: {
      platform: "telegram or discord",
      period: "daily, weekly, monthly, or all (default)",
      limit: "Number of entries to return (max 100, default 10)",
      userId: "Platform-specific user ID",
    },
    rateLimit: "60 requests per minute per IP for API endpoints",
  });
});

export default app;
