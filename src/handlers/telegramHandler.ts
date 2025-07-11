import { Context } from 'hono';
import { TelegramUpdate } from '../types/telegram';
import { isTelegramThreadIdInBlacklist, countUserMessage } from '../utils/db-helpers';
import { recordTelegramChannelMessage } from '../utils/telegram-helpers';
import { commands } from '../commands';

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

    console.log('Request body:', JSON.stringify(update, null, 2));

    // Early return if no new message found (we only want to count new messages)
    if (!update.message) {
      console.log(`[${timestamp}] No new message found in the update or it's an edited message`);
      return c.json({ success: true, message: 'Ignoring non-new messages' });
    }

    // Only use regular new messages
    const message = update.message;

    // Only count/process messages from supergroups (avoid DMs)
    if (message.chat.type !== 'supergroup' && !c.env.DEV_MODE) {
      console.log(`[${timestamp}] Ignoring message from non-supergroup chat: ${message.chat.type}`);
      return c.json({
        success: true,
        message: 'Ignoring non-supergroup message',
      });
    }

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
      return c.json({ success: true, message: 'Ignoring service message' });
    }

    // Use wrangler environment variables (.dev.vars)
    const botToken = c.env.TELEGRAM_BOT_TOKEN;

    if (botToken && message.text) {
      for (const command of commands) {
        if (command.isMatch(message.text)) {
          c.executionCtx.waitUntil(command.process(c, message, botToken));
          break; // Exit loop once a command is matched
        }
      }
    }

    // We can only count messages that have a sender
    if (!message || !message.from) {
      console.log(`[${timestamp}] No sender information in the message`);
      return c.json({ success: false, error: 'No sender information' });
    }

    // Don't count messages from bots
    if (message.from.is_bot) {
      console.log(
        `[${timestamp}] Ignored message from bot: ${
          message.from.username || message.from.first_name
        }`
      );
      return c.json({ success: true, message: 'Ignored bot message' });
    }

    // Format display name (prioritize first+last name over username)
    const displayName = message.from.first_name
      ? `${message.from.first_name}${message.from.last_name ? ' ' + message.from.last_name : ''}`
      : message.from.username || 'Unknown User';

    const text = message.text || '';

    console.log(`[${timestamp}] Processing message from user: ${displayName} (${message.from.id})`);

    // Track the message in our database
    await countUserMessage(
      c.env.DB,
      'telegram',
      message.from.id.toString(),
      displayName,
      text.length
    );

    console.log(`[${timestamp}] Successfully counted message from user: ${displayName}`);

    // Check if the message is in a blacklisted topic
    if (message.message_thread_id) {
      const isBlacklisted = await isTelegramThreadIdInBlacklist(
        c.env.DB,
        message.message_thread_id.toString()
      );
      if (isBlacklisted) {
        console.log(
          `[${timestamp}] Ignoring message in blacklisted topic: ${message.message_thread_id}`
        );
        return c.json({
          success: true,
          message: 'Ignoring message in blacklisted topic',
        });
      }
    }

    // if isBlacklisted = false, record messages into DB
    if (message) {
      await recordTelegramChannelMessage(c.env.DB, message);
    }

    return c.json({ success: true });
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] Error processing webhook:`, error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}
