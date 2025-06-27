// Statistics and leaderboard helpers for user message tracking

/**
 * Validate and sanitize database parameters
 */
function validateDatabaseParams(platform: string, limit: number): void {
  if (!platform || !['telegram', 'discord'].includes(platform.toLowerCase())) {
    throw new Error(`Invalid platform: ${platform}. Must be 'telegram' or 'discord'.`);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error(`Invalid limit: ${limit}. Must be an integer between 1 and 1000.`);
  }
}

/**
 * Safely execute D1 database query with error handling for .all() operations
 */
async function executeQueryAll<T>(
  preparedStatement: D1PreparedStatement,
  operation: string
): Promise<D1Result<T>> {
  try {
    const result = await preparedStatement.all();
    return result as D1Result<T>;
  } catch (error) {
    console.error(`D1Database error in ${operation}:`, error);
    throw new Error(`Database operation failed: ${operation}`);
  }
}

/**
 * Safely execute D1 database query with error handling for .first() operations
 */
async function executeQueryFirst<T>(
  preparedStatement: D1PreparedStatement,
  operation: string
): Promise<T | null> {
  try {
    const result = await preparedStatement.first();
    return result as T | null;
  } catch (error) {
    console.error(`D1Database error in ${operation}:`, error);
    throw new Error(`Database operation failed: ${operation}`);
  }
}

/**
 * Safely execute D1 database mutation with error handling for .run() operations
 */
async function executeMutation(
  preparedStatement: D1PreparedStatement,
  operation: string
): Promise<D1Result> {
  try {
    const result = await preparedStatement.run();
    return result;
  } catch (error) {
    console.error(`D1Database error in ${operation}:`, error);
    throw new Error(`Database operation failed: ${operation}`);
  }
}

/**
 * Get daily leaderboard for a specific platform
 *
 * @param db - D1Database instance
 * @param platform - Platform identifier ('telegram' or 'discord')
 * @param date - Date in YYYY-MM-DD format (optional, defaults to today)
 * @param limit - Maximum number of users to return (default: 10)
 * @returns Promise<Array<{ user_id: string, display_name: string, message_count: number, message_length: number }>>
 */
export async function getDailyLeaderboard(
  db: D1Database,
  platform: string,
  date?: string,
  limit: number = 10
): Promise<Array<{
  user_id: string;
  display_name: string;
  message_count: number;
  message_length: number;
}>> {
  try {
    validateDatabaseParams(platform, limit);
    const targetDate = date || new Date().toISOString().split("T")[0];
    
    const statement = db
      .prepare(
        `SELECT 
          cc.user_id,
          u.display_name,
          cc.message_count,
          cc.message_length
        FROM chat_counter cc
        JOIN users u ON cc.platform = u.platform AND cc.user_id = u.user_id
        WHERE cc.platform = ? AND cc.chat_date = ?
        ORDER BY cc.message_count DESC, cc.message_length DESC
        LIMIT ?`
      )
      .bind(platform.toLowerCase(), targetDate, limit);

    const result = await executeQueryAll(statement, 'getDailyLeaderboard');

    return result.results as Array<{
      user_id: string;
      display_name: string;
      message_count: number;
      message_length: number;
    }>;
  } catch (error) {
    console.error(`Error getting daily leaderboard for ${platform}:`, error);
    throw error;
  }
}

/**
 * Get weekly leaderboard for a specific platform
 *
 * @param db - D1Database instance
 * @param platform - Platform identifier ('telegram' or 'discord')
 * @param limit - Maximum number of users to return (default: 10)
 * @returns Promise<Array<{ user_id: string, display_name: string, total_messages: number, total_length: number }>>
 */
export async function getWeeklyLeaderboard(
  db: D1Database,
  platform: string,
  limit: number = 10
): Promise<Array<{
  user_id: string;
  display_name: string;
  total_messages: number;
  total_length: number;
}>> {
  try {
    validateDatabaseParams(platform, limit);
    
    // Get the date 7 days ago
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startDate = weekAgo.toISOString().split("T")[0];
    
    const statement = db
      .prepare(
        `SELECT 
          cc.user_id,
          u.display_name,
          SUM(cc.message_count) as total_messages,
          SUM(cc.message_length) as total_length
        FROM chat_counter cc
        JOIN users u ON cc.platform = u.platform AND cc.user_id = u.user_id
        WHERE cc.platform = ? AND cc.chat_date >= ?
        GROUP BY cc.user_id, u.display_name
        ORDER BY total_messages DESC, total_length DESC
        LIMIT ?`
      )
      .bind(platform.toLowerCase(), startDate, limit);

    const result = await executeQueryAll(statement, 'getWeeklyLeaderboard');

    return result.results as Array<{
      user_id: string;
      display_name: string;
      total_messages: number;
      total_length: number;
    }>;
  } catch (error) {
    console.error(`Error getting weekly leaderboard for ${platform}:`, error);
    throw error;
  }
}

/**
 * Get monthly leaderboard for a specific platform
 *
 * @param db - D1Database instance
 * @param platform - Platform identifier ('telegram' or 'discord')
 * @param limit - Maximum number of users to return (default: 10)
 * @returns Promise<Array<{ user_id: string, display_name: string, total_messages: number, total_length: number }>>
 */
export async function getMonthlyLeaderboard(
  db: D1Database,
  platform: string,
  limit: number = 10
): Promise<Array<{
  user_id: string;
  display_name: string;
  total_messages: number;
  total_length: number;
}>> {
  try {
    validateDatabaseParams(platform, limit);
    
    // Get the first day of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = startOfMonth.toISOString().split("T")[0];
    
    const statement = db
      .prepare(
        `SELECT 
          cc.user_id,
          u.display_name,
          SUM(cc.message_count) as total_messages,
          SUM(cc.message_length) as total_length
        FROM chat_counter cc
        JOIN users u ON cc.platform = u.platform AND cc.user_id = u.user_id
        WHERE cc.platform = ? AND cc.chat_date >= ?
        GROUP BY cc.user_id, u.display_name
        ORDER BY total_messages DESC, total_length DESC
        LIMIT ?`
      )
      .bind(platform.toLowerCase(), startDate, limit);

    const result = await executeQueryAll(statement, 'getMonthlyLeaderboard');

    return result.results as Array<{
      user_id: string;
      display_name: string;
      total_messages: number;
      total_length: number;
    }>;
  } catch (error) {
    console.error(`Error getting monthly leaderboard for ${platform}:`, error);
    throw error;
  }
}

/**
 * Get all-time leaderboard for a specific platform
 *
 * @param db - D1Database instance
 * @param platform - Platform identifier ('telegram' or 'discord')
 * @param limit - Maximum number of users to return (default: 10)
 * @returns Promise<Array<{ user_id: string, display_name: string, total_messages: number, total_length: number }>>
 */
export async function getAllTimeLeaderboard(
  db: D1Database,
  platform: string,
  limit: number = 10
): Promise<Array<{
  user_id: string;
  display_name: string;
  total_messages: number;
  total_length: number;
}>> {
  try {
    validateDatabaseParams(platform, limit);
    
    const statement = db
      .prepare(
        `SELECT 
          cc.user_id,
          u.display_name,
          SUM(cc.message_count) as total_messages,
          SUM(cc.message_length) as total_length
        FROM chat_counter cc
        JOIN users u ON cc.platform = u.platform AND cc.user_id = u.user_id
        WHERE cc.platform = ?
        GROUP BY cc.user_id, u.display_name
        ORDER BY total_messages DESC, total_length DESC
        LIMIT ?`
      )
      .bind(platform.toLowerCase(), limit);

    const result = await executeQueryAll(statement, 'getAllTimeLeaderboard');

    return result.results as Array<{
      user_id: string;
      display_name: string;
      total_messages: number;
      total_length: number;
    }>;
  } catch (error) {
    console.error(`Error getting all-time leaderboard for ${platform}:`, error);
    throw error;
  }
}

/**
 * Get user statistics for a specific user and platform
 *
 * @param db - D1Database instance
 * @param platform - Platform identifier ('telegram' or 'discord')
 * @param userId - User ID
 * @returns Promise<{ daily: number, weekly: number, monthly: number, allTime: number, rank: number | null }>
 */
export async function getUserStats(
  db: D1Database,
  platform: string,
  userId: string
): Promise<{
  daily: number;
  weekly: number;
  monthly: number;
  allTime: number;
  rank: number | null;
}> {
  try {
    if (!platform || !['telegram', 'discord'].includes(platform.toLowerCase())) {
      throw new Error(`Invalid platform: ${platform}`);
    }
    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required');
    }

    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startOfWeek = weekAgo.toISOString().split("T")[0];
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split("T")[0];

    // Get daily stats
    const dailyStatement = db
      .prepare(
        `SELECT message_count FROM chat_counter 
         WHERE platform = ? AND user_id = ? AND chat_date = ?`
      )
      .bind(platform.toLowerCase(), userId.trim(), today);
    const dailyResult = await executeQueryFirst<{ message_count: number }>(dailyStatement, 'getUserStats-daily');

    // Get weekly stats
    const weeklyStatement = db
      .prepare(
        `SELECT SUM(message_count) as total FROM chat_counter 
         WHERE platform = ? AND user_id = ? AND chat_date >= ?`
      )
      .bind(platform.toLowerCase(), userId.trim(), startOfWeek);
    const weeklyResult = await executeQueryFirst<{ total: number }>(weeklyStatement, 'getUserStats-weekly');

    // Get monthly stats
    const monthlyStatement = db
      .prepare(
        `SELECT SUM(message_count) as total FROM chat_counter 
         WHERE platform = ? AND user_id = ? AND chat_date >= ?`
      )
      .bind(platform.toLowerCase(), userId.trim(), startOfMonthStr);
    const monthlyResult = await executeQueryFirst<{ total: number }>(monthlyStatement, 'getUserStats-monthly');

    // Get all-time stats
    const allTimeStatement = db
      .prepare(
        `SELECT SUM(message_count) as total FROM chat_counter 
         WHERE platform = ? AND user_id = ?`
      )
      .bind(platform.toLowerCase(), userId.trim());
    const allTimeResult = await executeQueryFirst<{ total: number }>(allTimeStatement, 'getUserStats-allTime');

    // Get user's rank (all-time)
    const rankStatement = db
      .prepare(
        `WITH user_totals AS (
          SELECT user_id, SUM(message_count) as total_messages
          FROM chat_counter 
          WHERE platform = ?
          GROUP BY user_id
        ), ranked_users AS (
          SELECT user_id, total_messages,
                 ROW_NUMBER() OVER (ORDER BY total_messages DESC) as rank
          FROM user_totals
        )
        SELECT rank FROM ranked_users WHERE user_id = ?`
      )
      .bind(platform.toLowerCase(), userId.trim());
    const rankResult = await executeQueryFirst<{ rank: number }>(rankStatement, 'getUserStats-rank');

    return {
      daily: (dailyResult?.message_count as number) || 0,
      weekly: (weeklyResult?.total as number) || 0,
      monthly: (monthlyResult?.total as number) || 0,
      allTime: (allTimeResult?.total as number) || 0,
      rank: (rankResult?.rank as number) || null,
    };
  } catch (error) {
    console.error(`Error getting user stats for ${platform}/${userId}:`, error);
    throw error;
  }
}

/**
 * Get platform statistics summary
 *
 * @param db - D1Database instance
 * @param platform - Platform identifier ('telegram' or 'discord')
 * @returns Promise<{ totalUsers: number, totalMessages: number, activeToday: number, activeThisWeek: number }>
 */
export async function getPlatformStats(
  db: D1Database,
  platform: string
): Promise<{
  totalUsers: number;
  totalMessages: number;
  activeToday: number;
  activeThisWeek: number;
}> {
  try {
    validateDatabaseParams(platform, 10); // Use 10 as dummy limit for validation
    
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startOfWeek = weekAgo.toISOString().split("T")[0];

    // Total unique users
    const totalUsersStatement = db
      .prepare(
        `SELECT COUNT(DISTINCT user_id) as count FROM users WHERE platform = ?`
      )
      .bind(platform.toLowerCase());
    const totalUsersResult = await executeQueryFirst<{ count: number }>(totalUsersStatement, 'getPlatformStats-totalUsers');

    // Total messages
    const totalMessagesStatement = db
      .prepare(
        `SELECT SUM(message_count) as total FROM chat_counter WHERE platform = ?`
      )
      .bind(platform.toLowerCase());
    const totalMessagesResult = await executeQueryFirst<{ total: number }>(totalMessagesStatement, 'getPlatformStats-totalMessages');

    // Active users today
    const activeTodayStatement = db
      .prepare(
        `SELECT COUNT(DISTINCT user_id) as count FROM chat_counter 
         WHERE platform = ? AND chat_date = ?`
      )
      .bind(platform.toLowerCase(), today);
    const activeTodayResult = await executeQueryFirst<{ count: number }>(activeTodayStatement, 'getPlatformStats-activeToday');

    // Active users this week
    const activeWeekStatement = db
      .prepare(
        `SELECT COUNT(DISTINCT user_id) as count FROM chat_counter 
         WHERE platform = ? AND chat_date >= ?`
      )
      .bind(platform.toLowerCase(), startOfWeek);
    const activeWeekResult = await executeQueryFirst<{ count: number }>(activeWeekStatement, 'getPlatformStats-activeWeek');

    return {
      totalUsers: (totalUsersResult?.count as number) || 0,
      totalMessages: (totalMessagesResult?.total as number) || 0,
      activeToday: (activeTodayResult?.count as number) || 0,
      activeThisWeek: (activeWeekResult?.count as number) || 0,
    };
  } catch (error) {
    console.error(`Error getting platform stats for ${platform}:`, error);
    throw error;
  }
}

/**
 * Format leaderboard message for Telegram
 *
 * @param leaderboard - Array of leaderboard entries
 * @param type - Type of leaderboard (daily, weekly, monthly, all-time)
 * @param platform - Platform name
 * @returns Formatted message string
 */
export function formatLeaderboardMessage(
  leaderboard: Array<{
    display_name: string;
    message_count?: number;
    total_messages?: number;
    message_length?: number;
    total_length?: number;
  }>,
  type: 'daily' | 'weekly' | 'monthly' | 'all-time',
  platform: string
): string {
  if (leaderboard.length === 0) {
    return `<b>📊 ${type.charAt(0).toUpperCase() + type.slice(1)} ${platform.charAt(0).toUpperCase() + platform.slice(1)} Leaderboard</b>\n\nNo data available yet.`;
  }

  const medals = ['🥇', '🥈', '🥉'];
  let message = `<b>📊 ${type.charAt(0).toUpperCase() + type.slice(1)} ${platform.charAt(0).toUpperCase() + platform.slice(1)} Leaderboard</b>\n\n`;

  leaderboard.forEach((entry, index) => {
    const medal = index < 3 ? medals[index] : `${index + 1}.`;
    const messageCount = entry.message_count || entry.total_messages || 0;
    const messageLength = entry.message_length || entry.total_length || 0;
    
    message += `${medal} <b>${entry.display_name}</b>\n`;
    message += `   📝 ${messageCount} messages (${messageLength} chars)\n\n`;
  });

  return message;
}
