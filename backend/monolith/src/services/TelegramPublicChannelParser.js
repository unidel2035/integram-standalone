// TelegramPublicChannelParser.js - Service for parsing public Telegram channels using MTProto
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Logger } from 'telegram/extensions/Logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Service for parsing public Telegram channels without needing bot API
 * Uses MTProto protocol (user account authentication) to access public channels
 *
 * Features:
 * - Parse public channels (no bot token needed)
 * - Handle rate limiting (FloodWait)
 * - Store messages in JSON format
 * - Support for 1000+ msgs/min throughput
 * - Session persistence
 */
export class TelegramPublicChannelParser {
  constructor(config = {}) {
    // Telegram API credentials (required for MTProto)
    this.apiId = config.apiId || process.env.TELEGRAM_API_ID;
    this.apiHash = config.apiHash || process.env.TELEGRAM_API_HASH;

    if (!this.apiId || !this.apiHash) {
      throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH are required');
    }

    // Session management
    this.sessionString = config.sessionString || process.env.TELEGRAM_SESSION || '';
    this.session = new StringSession(this.sessionString);

    // Storage configuration
    this.storageDir = config.storageDir || path.join(__dirname, '../../../telegram-bot/parsed_messages');

    // Rate limiting configuration
    this.maxRequestsPerSecond = config.maxRequestsPerSecond || 30;
    this.floodWaitHandling = config.floodWaitHandling !== false; // Enable by default

    // Client instance (will be initialized on connect)
    this.client = null;
    this.connected = false;

    // Rate limiter state
    this.requestTimestamps = [];
    this.rateLimitWindow = 1000; // 1 second
  }

  /**
   * Initialize and connect to Telegram
   * @param {Object} options - Connection options
   * @param {string} options.phoneNumber - Phone number for authentication (if new session)
   * @param {string} options.password - 2FA password (if enabled)
   * @param {Function} options.onCode - Callback to get verification code
   * @returns {Promise<boolean>} - Connection status
   */
  async connect(options = {}) {
    try {
      logger.info('Connecting to Telegram using MTProto...');

      // Disable gramjs internal logging (too verbose)
      Logger.setLevel('none');

      // Create client
      this.client = new TelegramClient(
        this.session,
        parseInt(this.apiId),
        this.apiHash,
        {
          connectionRetries: 5,
          useWSS: false, // Use TCP instead of WebSocket for better stability
        }
      );

      // Connect
      await this.client.connect();

      // Check if already authorized
      if (await this.client.isUserAuthorized()) {
        logger.info('Already authorized with Telegram');
        this.connected = true;
        return true;
      }

      // Need to authorize - requires phone number
      if (!options.phoneNumber) {
        throw new Error('Phone number required for first-time authorization');
      }

      logger.info({ phone: options.phoneNumber }, 'Starting authorization...');

      // Send code
      await this.client.sendCode(
        {
          apiId: parseInt(this.apiId),
          apiHash: this.apiHash,
        },
        options.phoneNumber
      );

      // Get code from callback
      if (!options.onCode) {
        throw new Error('onCode callback required for authorization');
      }

      const code = await options.onCode();

      // Sign in
      await this.client.signInUser(
        {
          apiId: parseInt(this.apiId),
          apiHash: this.apiHash,
        },
        {
          phoneNumber: options.phoneNumber,
          phoneCode: async () => code,
          password: async () => options.password || '',
        }
      );

      // Save session string for future use
      this.sessionString = this.client.session.save();
      logger.info('Authorization successful. Save this session string to TELEGRAM_SESSION env var:', {
        session: this.sessionString
      });

      this.connected = true;
      return true;
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Failed to connect to Telegram');
      this.connected = false;
      throw error;
    }
  }

  /**
   * Disconnect from Telegram
   */
  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.connected = false;
      logger.info('Disconnected from Telegram');
    }
  }

  /**
   * Rate limiter - ensures we don't exceed Telegram's limits
   * @returns {Promise<void>}
   */
  async rateLimit() {
    const now = Date.now();

    // Remove timestamps outside the window
    this.requestTimestamps = this.requestTimestamps.filter(
      ts => now - ts < this.rateLimitWindow
    );

    // If we've hit the limit, wait
    if (this.requestTimestamps.length >= this.maxRequestsPerSecond) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = this.rateLimitWindow - (now - oldestTimestamp);

      if (waitTime > 0) {
        logger.debug({ waitMs: waitTime }, 'Rate limit reached, waiting...');
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.rateLimit(); // Retry
      }
    }

    // Add current timestamp
    this.requestTimestamps.push(now);
  }

  /**
   * Handle FloodWait error from Telegram
   * @param {Error} error - The error object
   * @returns {Promise<void>}
   */
  async handleFloodWait(error) {
    if (!this.floodWaitHandling) {
      throw error;
    }

    // Extract wait time from error message
    // Format: "FLOOD_WAIT_XXX" where XXX is seconds
    const match = error.message.match(/FLOOD_WAIT_(\d+)/);
    if (!match) {
      throw error;
    }

    const waitSeconds = parseInt(match[1]);
    logger.warn({ waitSeconds }, 'FloodWait encountered, waiting...');

    // Wait with progress logging
    for (let i = 0; i < waitSeconds; i += 10) {
      const remaining = waitSeconds - i;
      logger.info({ remaining }, 'FloodWait countdown...');
      await new Promise(resolve => setTimeout(resolve, Math.min(10, remaining) * 1000));
    }

    logger.info('FloodWait complete, resuming...');
  }

  /**
   * Get channel entity by username
   * @param {string} channelUsername - Channel username (without @)
   * @returns {Promise<Object>} - Channel entity
   */
  async getChannel(channelUsername) {
    if (!this.connected) {
      throw new Error('Not connected to Telegram. Call connect() first.');
    }

    try {
      await this.rateLimit();

      logger.info({ channel: channelUsername }, 'Fetching channel entity...');

      const entity = await this.client.getEntity(channelUsername);

      logger.info({
        channel: channelUsername,
        id: entity.id.toString(),
        title: entity.title
      }, 'Channel found');

      return entity;
    } catch (error) {
      if (error.message.includes('FLOOD_WAIT')) {
        await this.handleFloodWait(error);
        return this.getChannel(channelUsername); // Retry
      }
      throw error;
    }
  }

  /**
   * Parse messages from a public channel
   * @param {string} channelUsername - Channel username (without @)
   * @param {Object} options - Parsing options
   * @param {number} options.limit - Maximum number of messages to fetch (default: 100)
   * @param {number} options.offsetId - Message ID to start from (for pagination)
   * @param {Date} options.minDate - Minimum message date
   * @param {Date} options.maxDate - Maximum message date
   * @param {string[]} options.filterKeywords - Keywords to filter messages (optional)
   * @returns {Promise<Array>} - Array of parsed messages
   */
  async parseChannel(channelUsername, options = {}) {
    if (!this.connected) {
      throw new Error('Not connected to Telegram. Call connect() first.');
    }

    const {
      limit = 100,
      offsetId = 0,
      minDate = null,
      maxDate = null,
      filterKeywords = []
    } = options;

    try {
      // Get channel entity
      const channel = await this.getChannel(channelUsername);

      logger.info({
        channel: channelUsername,
        limit,
        offsetId
      }, 'Starting message parsing...');

      const messages = [];
      let currentOffset = offsetId;
      let fetchedCount = 0;

      // Fetch messages in batches (Telegram allows max 100 per request)
      while (fetchedCount < limit) {
        await this.rateLimit();

        const batchSize = Math.min(100, limit - fetchedCount);

        try {
          const result = await this.client.getMessages(channel, {
            limit: batchSize,
            offsetId: currentOffset,
            minId: 0,
            maxId: 0,
          });

          if (!result || result.length === 0) {
            logger.info('No more messages to fetch');
            break;
          }

          logger.info({
            fetched: result.length,
            total: fetchedCount + result.length
          }, 'Batch fetched');

          // Process each message
          for (const msg of result) {
            // Skip empty messages
            if (!msg || !msg.id) {
              continue;
            }

            // Date filtering
            if (minDate && msg.date < minDate) {
              continue;
            }
            if (maxDate && msg.date > maxDate) {
              continue;
            }

            // Keyword filtering
            const messageText = msg.message || '';
            if (filterKeywords.length > 0) {
              const textLower = messageText.toLowerCase();
              const hasKeyword = filterKeywords.some(kw =>
                textLower.includes(kw.toLowerCase())
              );
              if (!hasKeyword) {
                continue;
              }
            }

            // Parse message
            const parsedMessage = {
              message_id: msg.id,
              date: msg.date.toISOString(),
              text: messageText,
              views: msg.views || 0,
              forwards: msg.forwards || 0,
              replies: msg.replies?.replies || 0,
              from_id: msg.fromId?.userId?.toString() || null,
              chat_id: channel.id.toString(),
              chat_title: channel.title,
              chat_username: channelUsername,
              chat_type: 'channel',
              media_type: this.getMediaType(msg),
              has_media: msg.media !== undefined,
              is_pinned: msg.pinned || false,
              edit_date: msg.editDate?.toISOString() || null,
            };

            messages.push(parsedMessage);
          }

          fetchedCount += result.length;
          currentOffset = result[result.length - 1].id;

        } catch (error) {
          if (error.message.includes('FLOOD_WAIT')) {
            await this.handleFloodWait(error);
            continue; // Retry this batch
          }
          throw error;
        }
      }

      logger.info({
        channel: channelUsername,
        total: messages.length
      }, 'Parsing complete');

      return messages;
    } catch (error) {
      logger.error({
        error: error.message,
        channel: channelUsername
      }, 'Failed to parse channel');
      throw error;
    }
  }

  /**
   * Determine media type from message
   * @param {Object} msg - Telegram message object
   * @returns {string|null} - Media type
   */
  getMediaType(msg) {
    if (!msg.media) {
      return null;
    }

    const mediaClassName = msg.media.className;

    if (mediaClassName.includes('Photo')) {
      return 'photo';
    } else if (mediaClassName.includes('Document')) {
      return 'document';
    } else if (mediaClassName.includes('Video')) {
      return 'video';
    } else if (mediaClassName.includes('Audio')) {
      return 'audio';
    } else if (mediaClassName.includes('Voice')) {
      return 'voice';
    } else if (mediaClassName.includes('Sticker')) {
      return 'sticker';
    } else if (mediaClassName.includes('Poll')) {
      return 'poll';
    } else if (mediaClassName.includes('Contact')) {
      return 'contact';
    } else if (mediaClassName.includes('Geo')) {
      return 'location';
    } else {
      return 'other';
    }
  }

  /**
   * Save messages to JSON storage
   * @param {Array} messages - Array of messages
   * @param {string} channelUsername - Channel username
   * @returns {Promise<string>} - Path to saved file
   */
  async saveMessages(messages, channelUsername) {
    if (!messages || messages.length === 0) {
      logger.warn({ channel: channelUsername }, 'No messages to save');
      return null;
    }

    try {
      // Create storage directory
      const channelDir = path.join(
        this.storageDir,
        `channel_${channelUsername}`
      );
      await fs.mkdir(channelDir, { recursive: true });

      // Filename with date
      const date = new Date().toISOString().split('T')[0];
      const filename = path.join(channelDir, `messages_${date}.json`);

      // Load existing messages if file exists
      let existingMessages = [];
      try {
        const content = await fs.readFile(filename, 'utf-8');
        existingMessages = JSON.parse(content);
      } catch (error) {
        // File doesn't exist or invalid JSON, start fresh
      }

      // Merge messages (avoid duplicates by message_id)
      const existingIds = new Set(existingMessages.map(m => m.message_id));
      const newMessages = messages.filter(m => !existingIds.has(m.message_id));

      const allMessages = [...existingMessages, ...newMessages];

      // Sort by message_id descending (newest first)
      allMessages.sort((a, b) => b.message_id - a.message_id);

      // Save to file
      await fs.writeFile(
        filename,
        JSON.stringify(allMessages, null, 2),
        'utf-8'
      );

      logger.info({
        file: filename,
        total: allMessages.length,
        new: newMessages.length
      }, 'Messages saved');

      return filename;
    } catch (error) {
      logger.error({
        error: error.message,
        channel: channelUsername
      }, 'Failed to save messages');
      throw error;
    }
  }

  /**
   * Get statistics for a parsed channel
   * @param {string} channelUsername - Channel username
   * @returns {Promise<Object>} - Statistics object
   */
  async getChannelStatistics(channelUsername) {
    try {
      const channelDir = path.join(
        this.storageDir,
        `channel_${channelUsername}`
      );

      let totalMessages = 0;
      let totalFiles = 0;
      let dateRange = { min: null, max: null };
      let mediaTypes = {};

      try {
        const files = await fs.readdir(channelDir);

        for (const file of files) {
          if (!file.endsWith('.json')) {
            continue;
          }

          totalFiles++;
          const filePath = path.join(channelDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const messages = JSON.parse(content);

          totalMessages += messages.length;

          for (const msg of messages) {
            // Track date range
            const msgDate = new Date(msg.date);
            if (!dateRange.min || msgDate < dateRange.min) {
              dateRange.min = msgDate;
            }
            if (!dateRange.max || msgDate > dateRange.max) {
              dateRange.max = msgDate;
            }

            // Track media types
            if (msg.media_type) {
              mediaTypes[msg.media_type] = (mediaTypes[msg.media_type] || 0) + 1;
            }
          }
        }
      } catch (error) {
        // Directory doesn't exist or no files
        return {
          total_messages: 0,
          total_files: 0,
          date_range: null,
          media_types: {}
        };
      }

      return {
        total_messages: totalMessages,
        total_files: totalFiles,
        date_range: dateRange.min ? {
          min: dateRange.min.toISOString(),
          max: dateRange.max.toISOString()
        } : null,
        media_types: mediaTypes
      };
    } catch (error) {
      logger.error({
        error: error.message,
        channel: channelUsername
      }, 'Failed to get channel statistics');
      throw error;
    }
  }

  /**
   * Export messages to CSV format
   * @param {Array} messages - Array of messages
   * @returns {string} - CSV string
   */
  exportToCSV(messages) {
    if (!messages || messages.length === 0) {
      return '';
    }

    const headers = [
      'message_id',
      'date',
      'text',
      'views',
      'forwards',
      'replies',
      'chat_title',
      'chat_username',
      'media_type',
      'is_pinned'
    ];

    const rows = messages.map(msg => {
      return headers.map(header => {
        const value = msg[header];

        // Escape quotes and wrap in quotes if contains comma or newline
        if (value === null || value === undefined) {
          return '';
        }

        const strValue = String(value);
        if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }

        return strValue;
      }).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Get session string for saving
   * @returns {string} - Session string
   */
  getSessionString() {
    return this.sessionString;
  }

  /**
   * Check if connected
   * @returns {boolean} - Connection status
   */
  isConnected() {
    return this.connected;
  }
}

export default TelegramPublicChannelParser;
