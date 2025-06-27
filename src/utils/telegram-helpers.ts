// Telegram helpers for channel and supergroup message recording
import { TelegramMessage } from "../types/telegram";

/**
 * Validate Telegram-specific parameters
 */
function validateTelegramParams(chatId: string, limit?: number): void {
  if (!chatId || chatId.trim() === '') {
    throw new Error('Chat ID is required');
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 1000)) {
    throw new Error(`Invalid limit: ${limit}. Must be an integer between 1 and 1000.`);
  }
}

/**
 * Safely execute D1 database mutation for Telegram operations
 */
async function executeTelegramMutation(
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
 * Safely execute D1 database query for Telegram operations
 */
async function executeTelegramQuery<T>(
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
 * Record a message from a Telegram channel or supergroup in the database
 *
 * @param db - D1Database instance
 * @param message - The Telegram message object
 * @returns Promise<void>
 */
export async function recordTelegramChannelMessage(
  db: D1Database,
  message: TelegramMessage
): Promise<void> {
  try {
    if (!message || !message.message_id || !message.chat) {
      throw new Error('Invalid message object provided');
    }

    const timestamp = new Date().toISOString();
    // Convert Telegram timestamp to ISO format
    const messageDate = new Date(message.date * 1000).toISOString();

    const chatId = message.chat.id.toString();
    const chatType = message.chat.type;
    const chatTitle = message.chat.title || "Unknown Channel";

    validateTelegramParams(chatId);

    // Get sender info if available
    const senderId = message.from ? message.from.id.toString() : null;
    let senderName = "Unknown User";
    if (message.from) {
      senderName = message.from.first_name
        ? `${message.from.first_name}${
            message.from.last_name ? " " + message.from.last_name : ""
          }`
        : message.from.username || "Unknown User";
    }

    console.log(
      `[${timestamp}] Recording ${chatType} message from chat: ${chatTitle} (${chatId})`
    ); 
    
    // Determine media type if any
    let mediaType = null;
    if (message.photo) mediaType = "photo";
    if (message.video) mediaType = "video";
    if (message.document) mediaType = "document";
    if (message.audio) mediaType = "audio";

    // Handle forwarded message info
    let forwardedFrom = null;
    if (message.forward_from) {
      forwardedFrom = message.forward_from.first_name
        ? `${message.forward_from.first_name}${
            message.forward_from.last_name
              ? " " + message.forward_from.last_name
              : ""
          }`
        : message.forward_from.username || "Unknown User";
    } else if (message.forward_from_chat) {
      forwardedFrom =
        message.forward_from_chat.title ||
        message.forward_from_chat.username ||
        `Chat ${message.forward_from_chat.id}`;
    }

    // Handle reply to message
    const replyToMessageId =
      message.reply_to_message?.message_id?.toString() || null;

    // Get message thread ID if it exists
    const messageThreadId = message.message_thread_id?.toString() || null;

    // Insert message into the database
    const statement = db
      .prepare(
        `INSERT INTO telegram_channel_messages (
          message_id, 
          chat_id, 
          chat_type, 
          chat_title, 
          sender_id, 
          sender_name, 
          message_text, 
          message_date, 
          media_type, 
          forwarded_from, 
          reply_to_message_id,
          message_thread_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        message.message_id.toString(),
        chatId,
        chatType,
        chatTitle,
        senderId,
        senderName,
        message.text || "",
        messageDate,
        mediaType,
        forwardedFrom,
        replyToMessageId,
        messageThreadId
      )
      .run();

    console.log(
      `[${timestamp}] Successfully recorded ${chatType} message from: ${chatTitle}`
    );
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] Error recording channel message:`, error);
    throw error;
  }
}

/**
 * Send a message to a Telegram chat
 *
 * @param botToken - The Telegram bot token
 * @param chatId - The chat ID to send the message to
 * @param text - The message text to send
 * @param threadId - Optional message thread ID for forum topics
 * @returns Promise<Response>
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string | number,
  text: string,
  threadId?: string | number,
  replyToMessageId?: number
): Promise<Response> {
  const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const payload: {
    chat_id: string | number;
    text: string;
    message_thread_id?: string | number;
    parse_mode: "HTML";
    reply_to_message_id?: number;
  } = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML", // Use HTML parsing for better formatting
  };

  if (threadId) {
    payload.message_thread_id = threadId;
  }

  if (replyToMessageId) {
    payload.reply_to_message_id = replyToMessageId;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  // Log the response for debugging telegram parser breakage
  // const responseText = await response.text();
  // console.log(
  //   `[sendTelegramMessage] API Response: ${response.status} - ${responseText}`
  // );

  return response;
}

/**
 * Fetch recent messages from a Telegram chat
 *
 * @param db - D1Database instance
 * @param chatId - The chat ID to fetch messages from
 * @param threadId - Optional thread ID to filter messages by thread
 * @param limit - The maximum number of messages to fetch
 * @returns Promise<Array<{ message_text: string, sender_name: string, message_date: string, message_thread_id: string }>>

 */
export async function fetchRecentMessages(
  db: D1Database,
  chatId: string,
  limit: number = 200,
  threadId?: string
): Promise<
  Array<{
    message_text: string;
    sender_name: string;
    message_date: string;
    message_thread_id?: string;
  }>
> {
  try {
    validateTelegramParams(chatId, limit);
    
    let query = `SELECT message_text, sender_name, message_date, message_thread_id FROM telegram_channel_messages 
                WHERE chat_id = ? AND message_text != ''`;

    const params = [chatId.trim()];
    // Add thread filter if threadId is provided
    if (threadId && threadId.trim() !== '') {
      query += ` AND message_thread_id = ?`;
      params.push(threadId.trim());
    }

    query += ` ORDER BY message_date DESC LIMIT ?`;
    params.push(limit.toString());

    const statement = db.prepare(query).bind(...params);
    const result = await executeTelegramQuery<{
      message_text: string;
      sender_name: string;
      message_date: string;
      message_thread_id?: string;
    }>(statement, 'fetchRecentMessages');

    return result.results as Array<{
      message_text: string;
      sender_name: string;
      message_date: string;
      message_thread_id?: string;
    }>;
  } catch (error) {
    console.error(`Error fetching messages for chat ${chatId}:`, error);
    throw error;
  }
}

/**
 * Send a chat action (e.g., "typing") to a Telegram chat
 *
 * @param botToken - The Telegram bot token
 * @param chatId - The chat ID to send the action to
 * @param action - The type of action to send (e.g., "typing", "upload_photo")
 * @param threadId - Optional message thread ID for forum topics
 * @returns Promise<Response>
 */
export async function sendTelegramChatAction(
  botToken: string,
  chatId: string | number,
  action: string,
  threadId?: string | number
): Promise<Response> {
  const apiUrl = `https://api.telegram.org/bot${botToken}/sendChatAction`;

  const payload: {
    chat_id: string | number;
    action: string;
    message_thread_id?: string | number;
  } = {
    chat_id: chatId,
    action: action,
  };

  if (threadId) {
    payload.message_thread_id = threadId;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  console.log(
    `[sendTelegramChatAction] API Response: ${response.status} - ${responseText}`
  );
  return response;
}
