// Template loader utility for HTML templates

/**
 * Landing page fallback HTML template
 */
export const LANDING_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KhmerCoders Bot - Community Management</title>
    <meta name="description" content="KhmerCoders Bot - Community Message Tracking & Leaderboards for Telegram & Discord">
    <link rel="stylesheet" href="/css/style.css">
</head>
<body class="landing-page">
    <div class="landing-container">
        <div class="landing-header">
            <h1>🤖 KhmerCoders Bot</h1>
            <p>Community Message Tracking & Leaderboards for Telegram & Discord</p>
        </div>
        
        <div class="features">
            <div class="feature">
                <h3>📊 Message Tracking</h3>
                <p>Automatically tracks messages from both Telegram and Discord platforms</p>
            </div>
            <div class="feature">
                <h3>🏆 Leaderboards</h3>
                <p>Daily, weekly, monthly, and all-time rankings for community members</p>
            </div>
            <div class="feature">
                <h3>🤖 AI Summaries</h3>
                <p>Generate intelligent summaries of chat conversations using Cloudflare AI</p>
            </div>
            <div class="feature">
                <h3>📈 Analytics</h3>
                <p>Detailed statistics and insights about community activity</p>
            </div>
        </div>
        
        <div class="cta">
            <a href="/dashboard" class="btn">📊 View Dashboard</a>
            <a href="/api/docs" class="btn">📋 API Docs</a>
        </div>
        
        <div class="landing-stats" id="stats">
            <h3 class="mb-20" style="color: #667eea;">Live Statistics</h3>
            <div class="stats-grid" id="stats-grid">
                <div class="stat">
                    <div class="stat-value">Loading...</div>
                    <div class="stat-label">Total Users</div>
                </div>
                <div class="stat">
                    <div class="stat-value">Loading...</div>
                    <div class="stat-label">Total Messages</div>
                </div>
                <div class="stat">
                    <div class="stat-value">Loading...</div>
                    <div class="stat-label">Active Today</div>
                </div>
                <div class="stat">
                    <div class="stat-value">Loading...</div>
                    <div class="stat-label">Active This Week</div>
                </div>
            </div>
        </div>
    </div>

    <script src="/js/landing.js"></script>
</body>
</html>`;

/**
 * Dashboard fallback HTML template
 */
export const DASHBOARD_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KhmerCoders Bot Dashboard</title>
    <meta name="description" content="KhmerCoders Bot Dashboard - Real-time community analytics and leaderboards">
    <link rel="stylesheet" href="/css/style.css">
</head>
<body class="dashboard-page">
    <div class="container">
        <div class="header">
            <h1>🤖 KhmerCoders Bot Dashboard</h1>
            <p>Community Message Tracking & Leaderboards</p>
        </div>
        
        <button class="refresh-btn" onclick="loadDashboard()">🔄 Refresh Data</button>
        
        <div class="dashboard">
            <!-- Overview Stats -->
            <div class="card">
                <h3>📊 Overview Statistics</h3>
                <div id="overview-stats" class="loading">Loading...</div>
            </div>
            
            <!-- Platform Comparison -->
            <div class="card">
                <h3>⚖️ Platform Comparison</h3>
                <div id="platform-comparison" class="loading">Loading...</div>
            </div>
        </div>
        
        <!-- Leaderboards -->
        <div class="card">
            <h3>🏆 Leaderboards</h3>
            
            <!-- Platform Tabs -->
            <div class="tabs">
                <button class="tab active" onclick="switchPlatform('telegram')">💬 Telegram</button>
                <button class="tab" onclick="switchPlatform('discord')">🎮 Discord</button>
            </div>
            
            <!-- Period Tabs -->
            <div class="tabs">
                <button class="tab active" onclick="switchPeriod('all')">🏆 All Time</button>
                <button class="tab" onclick="switchPeriod('monthly')">📅 Monthly</button>
                <button class="tab" onclick="switchPeriod('weekly')">📊 Weekly</button>
                <button class="tab" onclick="switchPeriod('daily')">📈 Daily</button>
            </div>
            
            <div id="leaderboard" class="leaderboard loading">Loading...</div>
        </div>
    </div>

    <script src="/js/dashboard.js"></script>
</body>
</html>`;

/**
 * Template constants for easy access
 */
export const TEMPLATES = {
  LANDING_FALLBACK: LANDING_FALLBACK_HTML,
  DASHBOARD_FALLBACK: DASHBOARD_FALLBACK_HTML,
} as const;

/**
 * Get template by name
 */
export function getTemplate(templateName: keyof typeof TEMPLATES): string {
  return TEMPLATES[templateName];
}

/**
 * Get the landing page fallback HTML template
 */
export function getLandingFallbackTemplate(): string {
  return LANDING_FALLBACK_HTML;
}

/**
 * Get the dashboard fallback HTML template
 */
export function getDashboardFallbackTemplate(): string {
  return DASHBOARD_FALLBACK_HTML;
}
