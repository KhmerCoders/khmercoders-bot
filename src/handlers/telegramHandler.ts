import { Context } from "hono";
import { TelegramMessage, TelegramUpdate } from "../types/telegram";
import { trackMessage } from "../utils/db-helpers";
import {
  fetchRecentMessages,
  recordTelegramChannelMessage,
  sendTelegramMessage,
  sendTelegramChatAction,
} from "../utils/telegram-helpers";
import {
  getDailyLeaderboard,
  getWeeklyLeaderboard,
  getMonthlyLeaderboard,
  getAllTimeLeaderboard,
  formatLeaderboardMessage,
  getUserStats,
  getPlatformStats,
} from "../utils/stats-helpers";
import {
  commandRateLimiter,
  summaryRateLimiter,
  sanitizeInput,
  detectAbuse,
  logSecurityEvent,
  isAdmin,
} from "../utils/security-helpers";

/**
 * Generate a summary of chat messages using Cloudflare AI
 *
 * @param messages - Array of chat messages
 * @param ai - Cloudflare AI instance
 * @returns Promise<string> - The generated summary
 */
async function generateChatSummary(
  userPrompt: string,
  messages: Array<{
    message_text: string;
    sender_name: string;
    message_date: string;
  }>,
  ai: Ai<AiModels>
): Promise<string> {
  try {
    // Build a conversation history to summarize
    const conversationHistory = messages
      .reverse() // Order from oldest to newest
      .map((msg) => {
        // Format date for display - convert ISO date to more readable format
        const date = new Date(msg.message_date);
        const formattedDate = date.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        return `[${formattedDate}] ${msg.sender_name}: ${msg.message_text}`;
      })
      .join("\n");

    // Call Cloudflare AI to generate summary
    const response: AiTextGenerationOutput = await ai.run(
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      {
        messages: [
          {
            role: "system",
            content: `
            You are Khmercoders assistant. Your main task is to provide brief 50 - 100 words, easy-to-read summaries of chat history.
            
            ---
            Format

            When you respond, use these HTML tags for formatting:
            - Use <b>text</b> for bold formatting
            - Use <i>text</i> for italic formatting
            - Use <code>text</code> for inline code
            - Use <pre>text</pre> for code blocks
            - Use <tg-spoiler>spoiler</tg-spoiler> for spoilers
            
            Escape special characters: 
            - replace < with &lt;
            - replace > with &gt;
            - replace & with &amp;
            - replace " with &quot;
            ---

            ---
            Your Restrictions:

            Summaries Only: Your primary purpose is to summarize chat conversations. Make sure summaries are short and concise for quick reading.

            "Who are you?" Exception: If someone asks "Who are you?", you can briefly state that you are the Khmercoders Assistant.

            No Other Topics: Do not answer any other questions or engage in conversations outside of summarizing chats or stating your identity. Politely decline if asked to do anything else.
            ---
            `,
          },
          {
            role: "user",
            content: `Summarize the following ${messages.length} Telegram messages:\n\n${conversationHistory}`,
          },
          { role: "user", content: userPrompt },
        ],
      },
      {
        gateway: {
          id: "khmercoders-bot-summary-gw",
        },
      }
    );

    // Check if the response is a ReadableStream (which we can't directly use)
    if (response instanceof ReadableStream) {
      console.warn(
        "Received ReadableStream response which cannot be processed"
      );
      return "Sorry, I couldn't generate a summary at this time.";
    }

    // Return the response if available
    return response?.response || "No summary generated";
  } catch (error) {
    console.error(`Error generating summary:`, error);
    return "Sorry, I couldn't generate a summary at this time.";
  }
}

/**
 * Process the /summary command
 *
 * @param c - Hono context
 * @param message - Telegram message
 * @param botToken - Telegram bot token
 */
async function processSummaryCommand(
  c: Context<{ Bindings: CloudflareBindings }>,
  message: TelegramMessage,
  botToken: string
): Promise<void> {
  const chatId = message.chat.id.toString();
  const timestamp = new Date().toISOString();
  const threadId = message.message_thread_id?.toString();
  const userId = message.from?.id.toString() || "unknown";

  try {
    // Rate limiting check
    if (summaryRateLimiter.isRateLimited(userId)) {
      const resetTime = Math.ceil(summaryRateLimiter.getResetTime(userId) / 1000);
      await sendTelegramMessage(
        botToken,
        chatId,
        `⏰ Please wait ${resetTime} seconds before requesting another summary.`,
        threadId,
        message.message_id
      );
      logSecurityEvent("RATE_LIMITED", "Summary command rate limited", userId, "telegram");
      return;
    }

    console.log(
      `[${timestamp}] Processing /summary command for chat ${chatId}${
        threadId ? `, thread ${threadId}` : ""
      }`
    );
    console.log(
      `[${timestamp}] Attempting to send 'typing' action for /summary...`
    );
    await sendTelegramChatAction(botToken, chatId, "typing", threadId);
    console.log(`[${timestamp}] 'typing' action sent for /summary.`);

    // Fetch recent messages, filtering by thread if applicable
    const messages = await fetchRecentMessages(c.env.DB, chatId, 200, threadId);

    if (messages.length === 0) {
      await sendTelegramMessage(
        botToken,
        chatId,
        "No messages found to summarize.",
        threadId,
        message.message_id
      );
      return;
    }

    console.log(
      `[${timestamp}] Fetched ${messages.length} messages for summarization${
        threadId ? ` from thread ${threadId}` : ""
      }`
    );

    // User prompt with sanitization
    const rawPrompt = message.text?.replace("/summary", "").trim() || "";
    const userPrompt = sanitizeInput(rawPrompt, 500) || "";

    // Generate summary
    const summary = await generateChatSummary(userPrompt, messages, c.env.AI);
    const currentDate = new Date().toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const summaryText = `<b>📝 Chat Summary</b> (as of ${currentDate})\n\n${summary}`;
    await sendTelegramMessage(
      botToken,
      chatId,
      summaryText,
      threadId,
      message.message_id
    );
    console.log(
      `[${timestamp}] Summary sent to chat ${chatId}${
        threadId ? `, thread ${threadId}` : ""
      }`
    );
  } catch (error) {
    console.error(`[${timestamp}] Error processing summary command:`, error);

    // Send error message
    await sendTelegramMessage(
      botToken,
      chatId,
      "Sorry, an error occurred while generating the summary.",
      threadId,
      message.message_id
    );
  }
}

/**
 * Process the /ping command
 *
 * @param c - Hono context
 * @param message - Telegram message
 * @param botToken - Telegram bot token
 */
async function processPingCommand(
  c: Context<{ Bindings: CloudflareBindings }>,
  message: TelegramMessage,
  botToken: string
): Promise<void> {
  const chatId = message.chat.id.toString();
  const timestamp = new Date().toISOString();
  const threadId = message.message_thread_id?.toString();
  const messageId = message.message_id;

  try {
    console.log(
      `[${timestamp}] Processing /ping command for chat ${chatId}${
        threadId ? `, thread ${threadId}` : ""
      }`
    );
    console.log(
      `[${timestamp}] Attempting to send 'typing' action for /ping...`
    );
    await sendTelegramChatAction(botToken, chatId, "typing", threadId);
    console.log(`[${timestamp}] 'typing' action sent for /ping.`);

    await sendTelegramMessage(
      botToken,
      chatId,
      "pong",
      threadId,
      messageId // Pass the message ID for reply
    );

    console.log(
      `[${timestamp}] Sent pong reply to message ${messageId} in chat ${chatId}${
        threadId ? `, thread ${threadId}` : ""
      }`
    );
  } catch (error) {
    console.error(`[${timestamp}] Error processing ping command:`, error);
    await sendTelegramMessage(
      botToken,
      chatId,
      "Sorry, an error occurred while processing your ping.",
      threadId,
      messageId
    );
  }
}

/**
 * Check if the message is a /summary command
 *
 * @param text - Message text
 * @returns boolean
 */
function isSummaryCommand(text?: string): boolean {
  if (!text) return false;
  return text.startsWith("/summary");
}

/**
 * Check if the message is a /ping command
 *
 * @param text - Message text
 * @returns boolean
 */
function isPingCommand(text?: string): boolean {
  if (!text) return false;
  return text.startsWith("/ping");
}

/**
 * Check if the message is a /help command
 *
 * @param text - Message text
 * @returns boolean
 */
function isHelpCommand(text?: string): boolean {
  if (!text) return false;
  return text.startsWith("/help");
}

/**
 * Check if the message is a /stats command
 *
 * @param text - Message text
 * @returns boolean
 */
function isStatsCommand(text?: string): boolean {
  if (!text) return false;
  return text.startsWith("/stats") || text.startsWith("/leaderboard");
}

/**
 * Check if the message is a /mystats command
 *
 * @param text - Message text
 * @returns boolean
 */
function isMyStatsCommand(text?: string): boolean {
  if (!text) return false;
  return text.startsWith("/mystats") || text.startsWith("/me");
}

/**
 * Check if the message is a /leaderboard command
 *
 * @param text - Message text
 * @returns boolean
 */
function isLeaderboardCommand(text?: string): boolean {
  if (!text) return false;
  return text.startsWith("/leaderboard") || text.startsWith("/top") || text.startsWith("/ranking");
}

/**
 * Check if the message is a /daily command
 *
 * @param text - Message text
 * @returns boolean
 */
function isDailyCommand(text?: string): boolean {
  if (!text) return false;
  return text.startsWith("/daily");
}

/**
 * Check if the message is a /weekly command
 *
 * @param text - Message text
 * @returns boolean
 */
function isWeeklyCommand(text?: string): boolean {
  if (!text) return false;
  return text.startsWith("/weekly");
}

/**
 * Check if the message is a /monthly command
 *
 * @param text - Message text
 * @returns boolean
 */
function isMonthlyCommand(text?: string): boolean {
  if (!text) return false;
  return text.startsWith("/monthly");
}

/**
 * Check if the message is an admin command
 *
 * @param text - Message text
 * @returns boolean
 */
function isAdminCommand(text?: string): boolean {
  if (!text) return false;
  return text.startsWith("/admin") || text.startsWith("/broadcast") || text.startsWith("/cleanup");
}

/**
 * Process the /help command
 *
 * @param c - Hono context
 * @param message - Telegram message
 * @param botToken - Telegram bot token
 */
async function processHelpCommand(
  c: Context<{ Bindings: CloudflareBindings }>,
  message: TelegramMessage,
  botToken: string
): Promise<void> {
  const chatId = message.chat.id.toString();
  const timestamp = new Date().toISOString();
  const threadId = message.message_thread_id?.toString();
  const messageId = message.message_id;
  const userId = message.from?.id.toString() || "unknown";

  try {
    console.log(
      `[${timestamp}] Processing /help command for chat ${chatId}${
        threadId ? `, thread ${threadId}` : ""
      }`
    );
    console.log(
      `[${timestamp}] Attempting to send 'typing' action for /help...`
    );
    await sendTelegramChatAction(botToken, chatId, "typing", threadId);
    console.log(`[${timestamp}] 'typing' action sent for /help.`);

    let helpMessage = `
<b>🤖 KhmerCoders Bot - Available Commands:</b>

<b>📊 Leaderboard Commands:</b>
• /leaderboard or /top - Show all-time leaderboard
• /daily - Today's leaderboard
• /weekly - This week's leaderboard  
• /monthly - This month's leaderboard
• /stats [period] - Show leaderboard (supports all periods)

<b>👤 Personal Stats:</b>
• /mystats or /me - Show your personal statistics

<b>🔧 Utility Commands:</b>
• /summary [prompt] - Summarize recent chat messages
• /ping - Check if the bot is online
• /help - Show this help message

<b>📝 Examples:</b>
• <code>/leaderboard</code> - All-time top users
• <code>/daily</code> - Today's most active users
• <code>/summary what were the main topics?</code> - Custom summary

<i>🏆 Compete with other members and climb the leaderboards!</i>
    `;

    await sendTelegramMessage(
      botToken,
      chatId,
      helpMessage,
      threadId,
      messageId
    );

    console.log(
      `[${timestamp}] Sent help message to chat ${chatId}${
        threadId ? `, thread ${threadId}` : ""
      }`
    );
  } catch (error) {
    console.error(`[${timestamp}] Error processing help command:`, error);
    await sendTelegramMessage(
      botToken,
      chatId,
      "Sorry, an error occurred while processing your help request.",
      threadId,
      messageId
    );
  }
}

/**
 * Process the /stats or /leaderboard command
 *
 * @param c - Hono context
 * @param message - Telegram message
 * @param botToken - Telegram bot token
 */
async function processStatsCommand(
  c: Context<{ Bindings: CloudflareBindings }>,
  message: TelegramMessage,
  botToken: string
): Promise<void> {
  const chatId = message.chat.id.toString();
  const timestamp = new Date().toISOString();
  const threadId = message.message_thread_id?.toString();
  const messageId = message.message_id;
  const userId = message.from?.id.toString() || "unknown";

  try {
    // Rate limiting check
    if (commandRateLimiter.isRateLimited(userId)) {
      const remaining = commandRateLimiter.getRemainingRequests(userId);
      const resetTime = Math.ceil(commandRateLimiter.getResetTime(userId) / 1000);
      await sendTelegramMessage(
        botToken,
        chatId,
        `⏰ Command rate limit reached. Try again in ${resetTime} seconds.`,
        threadId,
        messageId
      );
      return;
    }

    console.log(
      `[${timestamp}] Processing /stats command for chat ${chatId}${
        threadId ? `, thread ${threadId}` : ""
      }`
    );
    
    await sendTelegramChatAction(botToken, chatId, "typing", threadId);

    // Parse command arguments
    const commandText = message.text?.toLowerCase() || "";
    const args = commandText.split(" ");
    const period = args[1] || "all"; // default to all-time

    let leaderboard;
    let type: 'daily' | 'weekly' | 'monthly' | 'all-time' = 'all-time';

    switch (period) {
      case 'daily':
      case 'today':
        leaderboard = await getDailyLeaderboard(c.env.DB, "telegram");
        type = 'daily';
        break;
      case 'weekly':
      case 'week':
        leaderboard = await getWeeklyLeaderboard(c.env.DB, "telegram");
        type = 'weekly';
        break;
      case 'monthly':
      case 'month':
        leaderboard = await getMonthlyLeaderboard(c.env.DB, "telegram");
        type = 'monthly';
        break;
      default:
        leaderboard = await getAllTimeLeaderboard(c.env.DB, "telegram");
        type = 'all-time';
    }

    const formattedMessage = formatLeaderboardMessage(leaderboard, type, "telegram");
    
    // Add platform stats
    const platformStats = await getPlatformStats(c.env.DB, "telegram");
    const statsFooter = `\n<i>📈 Total: ${platformStats.totalUsers} users, ${platformStats.totalMessages} messages\n👥 Active today: ${platformStats.activeToday} | This week: ${platformStats.activeThisWeek}</i>`;

    await sendTelegramMessage(
      botToken,
      chatId,
      formattedMessage + statsFooter,
      threadId,
      messageId
    );

    console.log(
      `[${timestamp}] Sent ${type} leaderboard to chat ${chatId}${
        threadId ? `, thread ${threadId}` : ""
      }`
    );
  } catch (error) {
    console.error(`[${timestamp}] Error processing stats command:`, error);
    await sendTelegramMessage(
      botToken,
      chatId,
      "Sorry, an error occurred while fetching the leaderboard.",
      threadId,
      messageId
    );
  }
}

/**
 * Process the /mystats or /me command
 *
 * @param c - Hono context
 * @param message - Telegram message
 * @param botToken - Telegram bot token
 */
async function processMyStatsCommand(
  c: Context<{ Bindings: CloudflareBindings }>,
  message: TelegramMessage,
  botToken: string
): Promise<void> {
  const chatId = message.chat.id.toString();
  const timestamp = new Date().toISOString();
  const threadId = message.message_thread_id?.toString();
  const messageId = message.message_id;

  try {
    if (!message.from) {
      await sendTelegramMessage(
        botToken,
        chatId,
        "Sorry, I couldn't identify you to fetch your statistics.",
        threadId,
        messageId
      );
      return;
    }

    console.log(
      `[${timestamp}] Processing /mystats command for user ${message.from.id} in chat ${chatId}${
        threadId ? `, thread ${threadId}` : ""
      }`
    );
    
    await sendTelegramChatAction(botToken, chatId, "typing", threadId);

    const userId = message.from.id.toString();
    const userStats = await getUserStats(c.env.DB, "telegram", userId);

    const displayName = message.from.first_name
      ? `${message.from.first_name}${
          message.from.last_name ? " " + message.from.last_name : ""
        }`
      : message.from.username || "Unknown User";

    const statsMessage = `
<b>📊 Personal Statistics for ${displayName}</b>

<b>📈 Message Count:</b>
• Today: <b>${userStats.daily}</b> messages
• This Week: <b>${userStats.weekly}</b> messages  
• This Month: <b>${userStats.monthly}</b> messages
• All Time: <b>${userStats.allTime}</b> messages

<b>🏆 Ranking:</b>
${userStats.rank ? `• All-time rank: <b>#${userStats.rank}</b>` : "• Not ranked yet"}

<i>Keep chatting to climb the leaderboards! 🚀</i>
    `;

    await sendTelegramMessage(
      botToken,
      chatId,
      statsMessage,
      threadId,
      messageId
    );

    console.log(
      `[${timestamp}] Sent personal stats for user ${userId} to chat ${chatId}${
        threadId ? `, thread ${threadId}` : ""
      }`
    );
  } catch (error) {
    console.error(`[${timestamp}] Error processing mystats command:`, error);
    await sendTelegramMessage(
      botToken,
      chatId,
      "Sorry, an error occurred while fetching your statistics.",
      threadId,
      messageId
    );
  }
}

/**
 * Process the /leaderboard command
 *
 * @param c - Hono context
 * @param message - Telegram message
 * @param botToken - Telegram bot token
 */
async function processLeaderboardCommand(
  c: Context<{ Bindings: CloudflareBindings }>,
  message: TelegramMessage,
  botToken: string
): Promise<void> {
  const chatId = message.chat.id.toString();
  const timestamp = new Date().toISOString();
  const threadId = message.message_thread_id?.toString();
  const messageId = message.message_id;
  const userId = message.from?.id.toString() || "unknown";

  try {
    // Rate limiting check
    if (commandRateLimiter.isRateLimited(userId)) {
      const resetTime = Math.ceil(commandRateLimiter.getResetTime(userId) / 1000);
      await sendTelegramMessage(
        botToken,
        chatId,
        `⏰ Command rate limit reached. Try again in ${resetTime} seconds.`,
        threadId,
        messageId
      );
      return;
    }

    console.log(
      `[${timestamp}] Processing /leaderboard command for chat ${chatId}${
        threadId ? `, thread ${threadId}` : ""
      }`
    );
    
    await sendTelegramChatAction(botToken, chatId, "typing", threadId);

    // Get all-time leaderboard by default
    const leaderboard = await getAllTimeLeaderboard(c.env.DB, "telegram", 10);
    const formattedMessage = formatLeaderboardMessage(leaderboard, 'all-time', "telegram");
    
    // Add platform stats
    const platformStats = await getPlatformStats(c.env.DB, "telegram");
    const statsFooter = `\n<i>📈 Total: ${platformStats.totalUsers} users, ${platformStats.totalMessages} messages\n👥 Active today: ${platformStats.activeToday} | This week: ${platformStats.activeThisWeek}\n\nUse /daily, /weekly, /monthly for other periods</i>`;

    await sendTelegramMessage(
      botToken,
      chatId,
      formattedMessage + statsFooter,
      threadId,
      messageId
    );

    console.log(
      `[${timestamp}] Sent all-time leaderboard to chat ${chatId}${
        threadId ? `, thread ${threadId}` : ""
      }`
    );
  } catch (error) {
    console.error(`[${timestamp}] Error processing leaderboard command:`, error);
    await sendTelegramMessage(
      botToken,
      chatId,
      "Sorry, an error occurred while fetching the leaderboard.",
      threadId,
      messageId
    );
  }
}

/**
 * Process the /daily command
 *
 * @param c - Hono context
 * @param message - Telegram message
 * @param botToken - Telegram bot token
 */
async function processDailyCommand(
  c: Context<{ Bindings: CloudflareBindings }>,
  message: TelegramMessage,
  botToken: string
): Promise<void> {
  const chatId = message.chat.id.toString();
  const timestamp = new Date().toISOString();
  const threadId = message.message_thread_id?.toString();
  const messageId = message.message_id;
  const userId = message.from?.id.toString() || "unknown";

  try {
    // Rate limiting check
    if (commandRateLimiter.isRateLimited(userId)) {
      const resetTime = Math.ceil(commandRateLimiter.getResetTime(userId) / 1000);
      await sendTelegramMessage(
        botToken,
        chatId,
        `⏰ Command rate limit reached. Try again in ${resetTime} seconds.`,
        threadId,
        messageId
      );
      return;
    }

    await sendTelegramChatAction(botToken, chatId, "typing", threadId);

    const leaderboard = await getDailyLeaderboard(c.env.DB, "telegram", undefined, 10);
    const formattedMessage = formatLeaderboardMessage(leaderboard, 'daily', "telegram");
    
    const platformStats = await getPlatformStats(c.env.DB, "telegram");
    const statsFooter = `\n<i>👥 Active today: ${platformStats.activeToday} users</i>`;

    await sendTelegramMessage(
      botToken,
      chatId,
      formattedMessage + statsFooter,
      threadId,
      messageId
    );
  } catch (error) {
    console.error(`[${timestamp}] Error processing daily command:`, error);
    await sendTelegramMessage(
      botToken,
      chatId,
      "Sorry, an error occurred while fetching today's leaderboard.",
      threadId,
      messageId
    );
  }
}

/**
 * Process the /weekly command
 *
 * @param c - Hono context
 * @param message - Telegram message
 * @param botToken - Telegram bot token
 */
async function processWeeklyCommand(
  c: Context<{ Bindings: CloudflareBindings }>,
  message: TelegramMessage,
  botToken: string
): Promise<void> {
  const chatId = message.chat.id.toString();
  const timestamp = new Date().toISOString();
  const threadId = message.message_thread_id?.toString();
  const messageId = message.message_id;
  const userId = message.from?.id.toString() || "unknown";

  try {
    // Rate limiting check
    if (commandRateLimiter.isRateLimited(userId)) {
      const resetTime = Math.ceil(commandRateLimiter.getResetTime(userId) / 1000);
      await sendTelegramMessage(
        botToken,
        chatId,
        `⏰ Command rate limit reached. Try again in ${resetTime} seconds.`,
        threadId,
        messageId
      );
      return;
    }

    await sendTelegramChatAction(botToken, chatId, "typing", threadId);

    const leaderboard = await getWeeklyLeaderboard(c.env.DB, "telegram", 10);
    const formattedMessage = formatLeaderboardMessage(leaderboard, 'weekly', "telegram");
    
    const platformStats = await getPlatformStats(c.env.DB, "telegram");
    const statsFooter = `\n<i>👥 Active this week: ${platformStats.activeThisWeek} users</i>`;

    await sendTelegramMessage(
      botToken,
      chatId,
      formattedMessage + statsFooter,
      threadId,
      messageId
    );
  } catch (error) {
    console.error(`[${timestamp}] Error processing weekly command:`, error);
    await sendTelegramMessage(
      botToken,
      chatId,
      "Sorry, an error occurred while fetching this week's leaderboard.",
      threadId,
      messageId
    );
  }
}

/**
 * Process the /monthly command
 *
 * @param c - Hono context
 * @param message - Telegram message
 * @param botToken - Telegram bot token
 */
async function processMonthlyCommand(
  c: Context<{ Bindings: CloudflareBindings }>,
  message: TelegramMessage,
  botToken: string
): Promise<void> {
  const chatId = message.chat.id.toString();
  const timestamp = new Date().toISOString();
  const threadId = message.message_thread_id?.toString();
  const messageId = message.message_id;
  const userId = message.from?.id.toString() || "unknown";

  try {
    // Rate limiting check
    if (commandRateLimiter.isRateLimited(userId)) {
      const resetTime = Math.ceil(commandRateLimiter.getResetTime(userId) / 1000);
      await sendTelegramMessage(
        botToken,
        chatId,
        `⏰ Command rate limit reached. Try again in ${resetTime} seconds.`,
        threadId,
        messageId
      );
      return;
    }

    await sendTelegramChatAction(botToken, chatId, "typing", threadId);

    const leaderboard = await getMonthlyLeaderboard(c.env.DB, "telegram", 10);
    const formattedMessage = formatLeaderboardMessage(leaderboard, 'monthly', "telegram");

    await sendTelegramMessage(
      botToken,
      chatId,
      formattedMessage,
      threadId,
      messageId
    );
  } catch (error) {
    console.error(`[${timestamp}] Error processing monthly command:`, error);
    await sendTelegramMessage(
      botToken,
      chatId,
      "Sorry, an error occurred while fetching this month's leaderboard.",
      threadId,
      messageId
    );
  }
}

/**
 * Handle incoming telegram webhook requests
 * @param c - Hono context
 * @returns HTTP response
 */
export async function handleTelegramWebhook(
  c: Context<{ Bindings: CloudflareBindings }>
): Promise<Response> {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Received Telegram webhook request`);

    // Parse the incoming webhook data
    const update: TelegramUpdate = await c.req.json();

    console.log("Request body:", JSON.stringify(update, null, 2));

    // Early return if no new message found (we only want to count new messages)
    if (!update.message) {
      console.log(
        `[${timestamp}] No new message found in the update or it's an edited message`
      );
      return c.json({ success: true, message: "Ignoring non-new messages" });
    }

    // Only use regular new messages
    const message = update.message;

    // Don't count service messages (join/leave, group title changes, etc.)
    if (
      message.new_chat_member ||
      message.new_chat_members ||
      message.left_chat_member ||
      message.new_chat_title ||
      message.new_chat_photo ||
      message.delete_chat_photo ||
      message.group_chat_created ||
      message.supergroup_chat_created ||
      message.channel_chat_created ||
      message.message_auto_delete_timer_changed ||
      message.pinned_message
    ) {
      console.log(`[${timestamp}] Ignoring service message (join/leave/etc)`);
      return c.json({ success: true, message: "Ignoring service message" });
    }

    // Use wrangler environment variables (.dev.vars)
    const botToken = c.env.TELEGRAM_BOT_TOKEN;

    if (message.text && isSummaryCommand(message.text)) {
      if (botToken) {
        c.executionCtx.waitUntil(processSummaryCommand(c, message, botToken));
      } else {
        console.error(
          `[${timestamp}] Bot token not found in environment variables`
        );
      }
    } else if (message.text && isPingCommand(message.text)) {
      if (botToken) {
        c.executionCtx.waitUntil(processPingCommand(c, message, botToken));
      } else {
        console.error(
          `[${timestamp}] Bot token not found in environment variables`
        );
      }
    } else if (message.text && isHelpCommand(message.text)) {
      if (botToken) {
        c.executionCtx.waitUntil(processHelpCommand(c, message, botToken));
      } else {
        console.error(
          `[${timestamp}] Bot token not found in environment variables`
        );
      }
    } else if (message.text && isStatsCommand(message.text)) {
      if (botToken) {
        c.executionCtx.waitUntil(processStatsCommand(c, message, botToken));
      } else {
        console.error(
          `[${timestamp}] Bot token not found in environment variables`
        );
      }
    } else if (message.text && isMyStatsCommand(message.text)) {
      if (botToken) {
        c.executionCtx.waitUntil(processMyStatsCommand(c, message, botToken));
      } else {
        console.error(
          `[${timestamp}] Bot token not found in environment variables`
        );
      }
    } else if (message.text && isLeaderboardCommand(message.text)) {
      if (botToken) {
        c.executionCtx.waitUntil(processLeaderboardCommand(c, message, botToken));
      } else {
        console.error(
          `[${timestamp}] Bot token not found in environment variables`
        );
      }
    } else if (message.text && isDailyCommand(message.text)) {
      if (botToken) {
        c.executionCtx.waitUntil(processDailyCommand(c, message, botToken));
      } else {
        console.error(
          `[${timestamp}] Bot token not found in environment variables`
        );
      }
    } else if (message.text && isWeeklyCommand(message.text)) {
      if (botToken) {
        c.executionCtx.waitUntil(processWeeklyCommand(c, message, botToken));
      } else {
        console.error(
          `[${timestamp}] Bot token not found in environment variables`
        );
      }
    } else if (message.text && isMonthlyCommand(message.text)) {
      if (botToken) {
        c.executionCtx.waitUntil(processMonthlyCommand(c, message, botToken));
      } else {
        console.error(
          `[${timestamp}] Bot token not found in environment variables`
        );
      }
    }

    // We can only count messages that have a sender
    if (!message || !message.from) {
      console.log(`[${timestamp}] No sender information in the message`);
      return c.json({ success: false, error: "No sender information" });
    }

    // Don't count messages from bots
    if (message.from.is_bot) {
      console.log(
        `[${timestamp}] Ignored message from bot: ${
          message.from.username || message.from.first_name
        }`
      );
      return c.json({ success: true, message: "Ignored bot message" });
    }

    // Handle channel posts or supergroup messages
    if (message) {
      await recordTelegramChannelMessage(c.env.DB, message);
    }

    // Format display name (prioritize first+last name over username)
    const displayName = message.from.first_name
      ? `${message.from.first_name}${
          message.from.last_name ? " " + message.from.last_name : ""
        }`
      : message.from.username || "Unknown User";

    const text = message.text || "";

    console.log(
      `[${timestamp}] Processing message from user: ${displayName} (${message.from.id})`
    );

    // Track the message in our database
    await trackMessage(
      c.env.DB,
      "telegram",
      message.from.id.toString(),
      displayName,
      text.length
    );

    console.log(
      `[${timestamp}] Successfully tracked message from user: ${displayName}`
    );
    return c.json({ success: true });
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] Error processing webhook:`, error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
}
