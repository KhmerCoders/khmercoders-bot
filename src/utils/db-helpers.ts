// Database helpers for message counter

/**
 * Validate database helper parameters
 */
function validateTrackingParams(
  platform: string, 
  userId: string, 
  displayName: string, 
  messageLength: number
): void {
  if (!platform || !['telegram', 'discord'].includes(platform.toLowerCase())) {
    throw new Error(`Invalid platform: ${platform}. Must be 'telegram' or 'discord'.`);
  }
  if (!userId || userId.trim() === '') {
    throw new Error('User ID is required');
  }
  if (!displayName || displayName.trim() === '') {
    throw new Error('Display name is required');
  }
  if (!Number.isInteger(messageLength) || messageLength < 0) {
    throw new Error(`Invalid message length: ${messageLength}. Must be a non-negative integer.`);
  }
}

/**
 * Safely execute D1 database mutation for tracking operations
 */
async function executeTrackingMutation(
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
 * Track a message from a user in the database
 *
 * @param db - D1Database instance
 * @param platform - Platform identifier (e.g. 'telegram')
 * @param userId - User ID from the platform (string)
 * @param displayName - User's display name
 * @param messageLength - Length of the message content
 * @returns Promise<void>
 */
export async function trackMessage(
  db: D1Database,
  platform: string,
  userId: string,
  displayName: string,
  messageLength: number
): Promise<void> {
  try {
    validateTrackingParams(platform, userId, displayName, messageLength);

    const timestamp = new Date().toISOString();
    // Get current date in YYYY-MM-DD format (UTC)
    const today = timestamp.split("T")[0];

    const sanitizedPlatform = platform.toLowerCase().trim();
    const sanitizedUserId = userId.trim();
    const sanitizedDisplayName = displayName.trim();

    console.log(
      `[${timestamp}] Tracking message for user ${sanitizedDisplayName} (${sanitizedUserId}) on ${sanitizedPlatform}, length: ${messageLength}`
    );

    // First ensure the user exists in the users table
    const userStatement = db
      .prepare(
        `INSERT OR IGNORE INTO users (platform, user_id, display_name) 
       VALUES (?, ?, ?)`
      )
      .bind(sanitizedPlatform, sanitizedUserId, sanitizedDisplayName);
    
    await executeTrackingMutation(userStatement, 'trackMessage-ensureUser');

    console.log(`[${timestamp}] User record ensured for ${sanitizedDisplayName}`);

    // Then update the message count and total message length
    const counterStatement = db
      .prepare(
        `INSERT INTO chat_counter (chat_date, platform, user_id, message_count, message_length)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT (chat_date, platform, user_id)
       DO UPDATE SET 
         message_count = message_count + 1,
         message_length = message_length + ?`
      )
      .bind(today, sanitizedPlatform, sanitizedUserId, messageLength, messageLength);

    await executeTrackingMutation(counterStatement, 'trackMessage-updateCounter');

    console.log(
      `[${timestamp}] Message count and length updated for ${sanitizedDisplayName} on ${today}`
    );
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] Error tracking message for user ${userId} on ${platform}:`, error);
    throw error;
  }
}
