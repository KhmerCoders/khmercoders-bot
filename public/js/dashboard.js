// KhmerCoders Bot - Dashboard JavaScript

// Global state
let currentPlatform = 'telegram';
let currentPeriod = 'all';

/**
 * Load dashboard data - main entry point
 */
async function loadDashboard() {
    await Promise.all([
        loadOverviewStats(),
        loadPlatformComparison(),
        loadLeaderboard()
    ]);
}

/**
 * Load and display overview statistics
 */
async function loadOverviewStats() {
    try {
        const response = await fetch('/api/overview');
        const data = await response.json();
        
        const element = document.getElementById('overview-stats');
        if (element) {
            element.innerHTML = `
                <div class="stats-grid">
                    <div class="stat">
                        <div class="stat-value">${data.total.totalUsers.toLocaleString()}</div>
                        <div class="stat-label">Total Users</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${data.total.totalMessages.toLocaleString()}</div>
                        <div class="stat-label">Total Messages</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${data.total.activeToday.toLocaleString()}</div>
                        <div class="stat-label">Active Today</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${data.total.activeThisWeek.toLocaleString()}</div>
                        <div class="stat-label">Active This Week</div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load overview stats:', error);
        const element = document.getElementById('overview-stats');
        if (element) {
            element.innerHTML = '<div class="error">Failed to load overview stats</div>';
        }
    }
}

/**
 * Load and display platform comparison
 */
async function loadPlatformComparison() {
    try {
        const response = await fetch('/api/overview');
        const data = await response.json();
        
        const element = document.getElementById('platform-comparison');
        if (element) {
            element.innerHTML = `
                <div class="platform-section">
                    <h4>💬 Telegram</h4>
                    <div class="stats-grid">
                        <div class="stat">
                            <div class="stat-value">${data.platforms.telegram.totalUsers.toLocaleString()}</div>
                            <div class="stat-label">Users</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${data.platforms.telegram.totalMessages.toLocaleString()}</div>
                            <div class="stat-label">Messages</div>
                        </div>
                    </div>
                </div>
                <div class="platform-section">
                    <h4>🎮 Discord</h4>
                    <div class="stats-grid">
                        <div class="stat">
                            <div class="stat-value">${data.platforms.discord.totalUsers.toLocaleString()}</div>
                            <div class="stat-label">Users</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${data.platforms.discord.totalMessages.toLocaleString()}</div>
                            <div class="stat-label">Messages</div>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load platform comparison:', error);
        const element = document.getElementById('platform-comparison');
        if (element) {
            element.innerHTML = '<div class="error">Failed to load platform comparison</div>';
        }
    }
}

/**
 * Load and display leaderboard
 */
async function loadLeaderboard() {
    try {
        const response = await fetch(`/api/leaderboard/${currentPlatform}/${currentPeriod}?limit=10`);
        const data = await response.json();
        
        const element = document.getElementById('leaderboard');
        if (!element) return;
        
        if (data.leaderboard.length === 0) {
            element.innerHTML = '<div class="loading">No data available for this period</div>';
            return;
        }
        
        const medals = ['🥇', '🥈', '🥉'];
        let html = '';
        
        data.leaderboard.forEach((user, index) => {
            const rank = index < 3 ? medals[index] : `#${index + 1}`;
            const messageCount = user.message_count || user.total_messages || 0;
            const messageLength = user.message_length || user.total_length || 0;
            
            html += `
                <div class="leaderboard-item slide-up">
                    <div class="rank">${rank}</div>
                    <div class="username">${user.display_name}</div>
                    <div class="message-count">${messageCount.toLocaleString()} msgs (${messageLength.toLocaleString()} chars)</div>
                </div>
            `;
        });
        
        element.innerHTML = html;
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
        const element = document.getElementById('leaderboard');
        if (element) {
            element.innerHTML = '<div class="error">Failed to load leaderboard</div>';
        }
    }
}

/**
 * Switch between platforms (Telegram/Discord)
 */
function switchPlatform(platform, event) {
    currentPlatform = platform;
    
    // Update tab appearance
    const platformTabs = document.querySelectorAll('.tabs')[0];
    if (platformTabs) {
        platformTabs.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        if (event && event.target) {
            event.target.classList.add('active');
        }
    }
    
    loadLeaderboard();
}

/**
 * Switch between time periods (daily/weekly/monthly/all)
 */
function switchPeriod(period, event) {
    currentPeriod = period;
    
    // Update tab appearance
    const periodTabs = document.querySelectorAll('.tabs')[1];
    if (periodTabs) {
        periodTabs.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        if (event && event.target) {
            event.target.classList.add('active');
        }
    }
    
    loadLeaderboard();
}

/**
 * Set up event listeners for tabs
 */
function setupEventListeners() {
    // Platform tabs
    const platformTabs = document.querySelectorAll('.tabs')[0];
    if (platformTabs) {
        const telegramTab = platformTabs.children[0];
        const discordTab = platformTabs.children[1];
        
        if (telegramTab) {
            telegramTab.addEventListener('click', (e) => switchPlatform('telegram', e));
        }
        if (discordTab) {
            discordTab.addEventListener('click', (e) => switchPlatform('discord', e));
        }
    }
    
    // Period tabs
    const periodTabs = document.querySelectorAll('.tabs')[1];
    if (periodTabs) {
        const allTab = periodTabs.children[0];
        const monthlyTab = periodTabs.children[1];
        const weeklyTab = periodTabs.children[2];
        const dailyTab = periodTabs.children[3];
        
        if (allTab) allTab.addEventListener('click', (e) => switchPeriod('all', e));
        if (monthlyTab) monthlyTab.addEventListener('click', (e) => switchPeriod('monthly', e));
        if (weeklyTab) weeklyTab.addEventListener('click', (e) => switchPeriod('weekly', e));
        if (dailyTab) dailyTab.addEventListener('click', (e) => switchPeriod('daily', e));
    }
    
    // Refresh button
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadDashboard);
    }
}

/**
 * Initialize dashboard functionality
 */
function initDashboard() {
    setupEventListeners();
    loadDashboard();
    
    // Auto-refresh every 30 seconds
    setInterval(loadDashboard, 30000);
}

// Load functionality when page loads
document.addEventListener('DOMContentLoaded', initDashboard);

// Export functions for global access (for inline onclick handlers if needed)
window.switchPlatform = (platform) => {
    switchPlatform(platform);
};

window.switchPeriod = (period) => {
    switchPeriod(period);
};

window.loadDashboard = loadDashboard;
