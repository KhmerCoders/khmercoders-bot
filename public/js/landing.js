// KhmerCoders Bot - Landing Page JavaScript

/**
 * Load and display live statistics on the landing page
 */
async function loadLandingStats() {
    try {
        const response = await fetch('/api/overview');
        const data = await response.json();
        
        const statsGrid = document.getElementById('stats-grid');
        if (statsGrid) {
            statsGrid.innerHTML = `
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
            `;
        }
    } catch (error) {
        console.error('Failed to load landing stats:', error);
        const statsGrid = document.getElementById('stats-grid');
        if (statsGrid) {
            statsGrid.innerHTML = `
                <div class="stat">
                    <div class="stat-value">--</div>
                    <div class="stat-label">Total Users</div>
                </div>
                <div class="stat">
                    <div class="stat-value">--</div>
                    <div class="stat-label">Total Messages</div>
                </div>
                <div class="stat">
                    <div class="stat-value">--</div>
                    <div class="stat-label">Active Today</div>
                </div>
                <div class="stat">
                    <div class="stat-value">--</div>
                    <div class="stat-label">Active This Week</div>
                </div>
            `;
        }
    }
}

/**
 * Add fade-in animation to elements
 */
function addAnimations() {
    const elements = document.querySelectorAll('.feature, .stat');
    elements.forEach((element, index) => {
        setTimeout(() => {
            element.classList.add('fade-in');
        }, index * 100);
    });
}

/**
 * Initialize landing page functionality
 */
function initLandingPage() {
    loadLandingStats();
    addAnimations();
    
    // Auto-refresh stats every 5 minutes
    setInterval(loadLandingStats, 5 * 60 * 1000);
}

// Load functionality when page loads
document.addEventListener('DOMContentLoaded', initLandingPage);
