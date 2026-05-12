import { Context } from 'hono';
import { TelegramMessage } from '../types/telegram';
import {
  sendTelegramMessage,
  sendTelegramChatAction,
  fetchRecentMessages,
} from '../utils/telegram-helpers';
import { processSummaryCommand } from '../commands/summary';

/**
 * Check if the message text contains "kcbot" (case-insensitive)
 *
 * @param text - Message text to check
 * @returns boolean indicating if kcbot is mentioned
 */
export function containsKcbot(text?: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes('kcbot');
}

/**
 * Detect if user wants to trigger a summary command
 *
 * @param text - Message text to check
 * @returns boolean indicating if summary intent is detected
 */
export function detectSummaryIntent(text?: string): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  const summaryKeywords = [
    'summarize',
    'summary',
    'sum up',
    'summarise',
    'tl;dr',
    'tldr',
    'catch me up',
    'what did we talk about',
    'what happened',
    'recap',
    'overview',
  ];
  return summaryKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Convert common Markdown formatting to HTML for Telegram
 *
 * @param text - Text with potential Markdown formatting
 * @returns Text with HTML formatting
 */
function convertMarkdownToHTML(text: string): string {
  try {
    // Convert **bold** and __bold__ to <b>bold</b>
    text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    text = text.replace(/__(.*?)__/g, '<b>$1</b>');

    // Convert *italic* and _italic_ to <i>italic</i>
    text = text.replace(/\*(.*?)\*/g, '<i>$1</i>');
    text = text.replace(/_(.*?)_/g, '<i>$1</i>');

    // Convert `code` to <code>code</code>
    text = text.replace(/`(.*?)`/g, '<code>$1</code>');

    // Convert ```code blocks``` to <pre>code</pre>
    text = text.replace(/```([\s\S]*?)```/g, '<pre>$1</pre>');

    // Convert ~~strikethrough~~ to <s>strikethrough</s>
    text = text.replace(/~~(.*?)~~/g, '<s>$1</s>');

    return text;
  } catch (error) {
    console.error('Error converting Markdown to HTML:', error);
    return text;
  }
}

/**
 * Sanitize and format HTML content for Telegram messages
 *
 * @param htmlContent - Raw HTML content
 * @returns Sanitized HTML string safe for Telegram
 */
function formatTelegramHTML(htmlContent: string): string {
  try {
    // Telegram's allowed HTML tags
    const telegramAllowedTags = [
      'b',
      'strong',
      'i',
      'em',
      'u',
      'ins',
      's',
      'strike',
      'del',
      'code',
      'pre',
      'a',
      'tg-spoiler',
    ];

    // First, escape all HTML entities to prevent XSS
    let sanitized = htmlContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    // Re-allow only Telegram's supported HTML tags
    telegramAllowedTags.forEach(tag => {
      // Allow opening tags
      const openTagRegex = new RegExp(`&lt;${tag}&gt;`, 'gi');
      sanitized = sanitized.replace(openTagRegex, `<${tag}>`);

      // Allow closing tags
      const closeTagRegex = new RegExp(`&lt;\\/${tag}&gt;`, 'gi');
      sanitized = sanitized.replace(closeTagRegex, `</${tag}>`);
    });

    // Handle special case for <a> tags with href attribute
    sanitized = sanitized.replace(/&lt;a\s+href=&quot;([^&"]+)&quot;&gt;/gi, '<a href="$1">');

    // Handle closing </a> tags
    sanitized = sanitized.replace(/&lt;\/a&gt;/gi, '</a>');

    // Validate that tags are properly nested and remove malformed ones
    sanitized = validateAndCleanTelegramHTML(sanitized);

    return sanitized;
  } catch (error) {
    console.error('Error formatting HTML for Telegram:', error);
    return htmlContent.replace(/<[^>]*>/g, '');
  }
}

/**
 * Validate and clean Telegram HTML to ensure proper tag nesting
 *
 * @param html - HTML string to validate
 * @returns Cleaned HTML string
 */
function validateAndCleanTelegramHTML(html: string): string {
  try {
    // Remove empty tags
    html = html.replace(/<(b|strong|i|em|u|ins|s|strike|del|code|pre|tg-spoiler)><\/\1>/gi, '');

    // Remove nested identical tags
    const tagsToCheck = [
      'b',
      'strong',
      'i',
      'em',
      'u',
      'ins',
      's',
      'strike',
      'del',
      'code',
      'tg-spoiler',
    ];

    tagsToCheck.forEach(tag => {
      const nestedRegex = new RegExp(
        `<${tag}>([^<]*)<${tag}>([^<]*)<\\/${tag}>([^<]*)<\\/${tag}>`,
        'gi'
      );
      html = html.replace(nestedRegex, `<${tag}>$1$2$3</${tag}>`);
    });

    return html;
  } catch (error) {
    console.error('Error validating Telegram HTML:', error);
    return html;
  }
}

/**
 * Format conversation history for AI context
 *
 * @param messages - Array of recent messages
 * @returns Formatted conversation string
 */
function formatConversationContext(
  messages: Array<{
    message_text: string;
    sender_name: string;
    message_date: string;
  }>
): string {
  if (messages.length === 0) {
    return '';
  }

  // Format messages oldest to newest, filtering out empty messages
  const formattedMessages = messages
    .filter(msg => msg.message_text && msg.message_text.trim().length > 0)
    .map(msg => {
      // Use "kcbot" as sender name for bot messages (you may need to adjust this based on your bot's username)
      const sender = msg.sender_name || 'Unknown';
      return `[${sender}]: ${msg.message_text}`;
    });

  if (formattedMessages.length === 0) {
    return '';
  }

  return `Recent conversation:\n${formattedMessages.join('\n')}`;
}

/**
 * Generate AI chat response using Cloudflare AI
 *
 * @param userMessage - The user's message that mentioned kcbot
 * @param contextMessages - Recent conversation context
 * @param ai - Cloudflare AI instance
 * @returns Promise<string> - The generated response
 */
async function generateAIChatResponse(
  userMessage: string,
  contextMessages: Array<{
    message_text: string;
    sender_name: string;
    message_date: string;
  }>,
  ai: Ai<AiModels>
): Promise<string> {
  try {
    // Build conversation context
    const conversationContext = formatConversationContext(contextMessages);

    const systemContent = `You are kcbot, a chill member of the KhmerCoders community. You're just another dev in the chat, not a formal assistant. Type like you're texting a friend - fast, messy, and casual.

ABSOLUTE RULES (break these = fail):
- NO emojis. Not even one. Never.
- Max 3 sentences (can be fragments)
- Never use proper grammar or complete sentences
- Type like a real person texting in a hurry

Your vibe:
- Casual, laid-back, just vibing in the chat
- Tech-savvy but not showy about it
- Helpful when needed but not formal
- Sound like a real KhmerCoders member, not a bot

Writing style (MUST follow):
- Shortened words: u, ur, idk, tbh, ngl, fr, rn, asap, btw, imo, kinda, sorta, prolly, gonna, wanna, lemme, gimme
- lowercase preferred, missing apostrophes (dont, isnt, cant, wont)
- Run-on sentences are fine
- Fragments and trailing thoughts: "but...", "wait...", "nvm...", "actually..."
- Interruptions mid-sentence are good
- Intentional casual "mistakes" and typos okay
- Use text expressions: lol, lmao, bruh, nah, yea, nah, shit, damn

Examples of your style (study these):
- "nah idk bout that lol wait u mean the new one? i havent tried it yet"
- "hmm nah i dont think so tbh"
- "oh shit u right wait lemme check"
- "idk man maybe try that thing where u... actually nvm"
- "bruh fr? i thought it was broken lol"
- "yea i got u gimme a sec"
- "nah thats not it try the other way"
- "wait hold up i think i got it"
- "prolly gonna need more info tbh"

Context Awareness:
- You can see the recent conversation
- Reference previous messages casually, dont be formal about it
- If someone mentions your previous message, acknowledge it naturally
- Messages from "kcbot" in history are your own previous responses

Formatting:
- Use <b>bold</b> VERY sparingly for key words only
- Use <code>code</code> for commands or technical terms (keep it casual)
- NO <i>italic</i>, NO <pre> blocks - too formal

${conversationContext ? conversationContext + '\n\n' : ''}Now respond to the user (remember: NO emojis, casual messy style, max 3 sentences):`;

    const aiMessages = [
      {
        role: 'system',
        content: systemContent,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ];

    // Call Cloudflare AI to generate response
    const response: AiTextGenerationOutput = await ai.run(
      '@cf/openai/gpt-oss-120b',
      {
        messages: aiMessages,
      },
      {
        gateway: {
          id: 'khmercoders-bot-summary-gw',
        },
      }
    );

    // Log the full response for debugging
    console.log('Full AI response:', JSON.stringify(response, null, 2));

    // Check if the response is a ReadableStream
    if (response instanceof ReadableStream) {
      console.warn('Received ReadableStream response which cannot be processed');
      return "Hey there! I'm having a little trouble thinking right now. Mind trying again in a moment?";
    }

    // Extract response text - handle different model response formats
    // Llama style: response.response
    // OpenAI/GPT-OSS style: response.choices[0].message.content
    let rawResponse = "I'm not sure how to respond to that. Could you rephrase?";

    if (response && typeof response === 'object') {
      // Check for Llama-style response
      if ('response' in response && typeof response.response === 'string') {
        rawResponse = response.response;
        console.log('Extracted Llama-style response');
      }
      // Check for OpenAI/GPT-OSS style response
      else if ('choices' in response) {
        console.log('Found choices in response, type:', typeof response.choices);
        console.log('Is array:', Array.isArray(response.choices));
        console.log('Choices length:', response.choices?.length);
        
        if (Array.isArray(response.choices) && response.choices.length > 0) {
          const firstChoice = response.choices[0];
          console.log('First choice:', JSON.stringify(firstChoice, null, 2));
          console.log('First choice type:', typeof firstChoice);
          
          if (firstChoice && typeof firstChoice === 'object') {
            console.log('First choice keys:', Object.keys(firstChoice));
            console.log('Message object:', firstChoice.message);
            console.log('Content:', firstChoice.message?.content);
            
            if (firstChoice.message?.content) {
              rawResponse = firstChoice.message.content;
              console.log('Successfully extracted OpenAI/GPT-OSS response');
            } else {
              console.warn('No content found in message object');
            }
          } else {
            console.warn('First choice is not an object:', firstChoice);
          }
        } else {
          console.warn('Choices is not an array or is empty');
        }
      }
      // Log unknown response structure
      else {
        console.warn('Unknown response structure, keys:', Object.keys(response));
      }
    }

    console.log('Extracted AI response:', rawResponse);

    // Convert Markdown to HTML first, then sanitize for Telegram
    const markdownConverted = convertMarkdownToHTML(rawResponse);
    console.log('Markdown converted response:', markdownConverted);

    return formatTelegramHTML(markdownConverted);
  } catch (error) {
    console.error('Error generating AI chat response:', error);
    return "Oops! My circuits are a bit tangled right now. Give me a moment to untangle them!";
  }
}

/**
 * Process an AI chat interaction when kcbot is mentioned
 *
 * @param c - Hono context
 * @param message - Telegram message
 * @param botToken - Telegram bot token
 */
export async function processAIChat(
  c: Context<{ Bindings: CloudflareBindings }>,
  message: TelegramMessage,
  botToken: string
): Promise<void> {
  const chatId = message.chat.id.toString();
  const timestamp = new Date().toISOString();
  const threadId = message.message_thread_id?.toString();

  try {
    console.log(
      `[${timestamp}] Processing kcbot mention in chat ${chatId}${
        threadId ? `, thread ${threadId}` : ''
      }`
    );

    // Get the message text
    const userMessage = message.text || '';

    // Check if user wants a summary before generating AI response
    if (detectSummaryIntent(userMessage)) {
      console.log(`[${timestamp}] Summary intent detected, executing /summary command`);
      await processSummaryCommand(c, message, botToken);
      console.log(`[${timestamp}] Summary command executed successfully`);
      return;
    }

    // Send typing action to indicate the bot is thinking
    console.log(`[${timestamp}] Attempting to send 'typing' action...`);
    await sendTelegramChatAction(botToken, chatId, 'typing', threadId);
    console.log(`[${timestamp}] 'typing' action sent.`);

    // Fetch recent conversation context (last 50 messages from this chat, all threads)
    console.log(`[${timestamp}] Fetching recent conversation context...`);
    const contextMessages = await fetchRecentMessages(c.env.DB, chatId, 50, undefined);
    console.log(`[${timestamp}] Fetched ${contextMessages.length} messages for context`);

    // Filter out the current message from context (it was just recorded)
    const filteredContext = contextMessages.filter(msg => msg.message_text !== userMessage);

    // Generate AI response with context
    const aiResponse = await generateAIChatResponse(userMessage, filteredContext, c.env.AI);

    // Send the response
    await sendTelegramMessage(botToken, chatId, aiResponse, threadId, message.message_id);
    console.log(
      `[${timestamp}] AI response sent to chat ${chatId}${threadId ? `, thread ${threadId}` : ''}`
    );
  } catch (error) {
    console.error(`[${timestamp}] Error processing kcbot mention:`, error);

    // Send a fallback error message
    try {
      await sendTelegramMessage(
        botToken,
        chatId,
        "Hmm, something went wrong on my end. Can you try again? 🤖",
        threadId,
        message.message_id
      );
    } catch (sendError) {
      console.error(`[${timestamp}] Failed to send error message:`, sendError);
    }
  }
}
