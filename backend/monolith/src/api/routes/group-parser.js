// group-parser.js - Telegram Group Parser Bot API routes
import express from 'express';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Helper function to get parsed_messages directory path
 */
function getParsedMessagesDir() {
  // Default to backend/telegram-bot/parsed_messages
  const defaultPath = path.join(__dirname, '../../../../telegram-bot/parsed_messages');
  return process.env.PARSED_MESSAGES_DIR || defaultPath;
}

/**
 * Helper function to get groups from parsed messages directory
 * Reads the filesystem to find all chat directories
 */
async function getGroupsFromStorage() {
  const parsedMessagesDir = getParsedMessagesDir();

  try {
    // Check if directory exists
    await fs.access(parsedMessagesDir);
  } catch (error) {
    logger.warn({ dir: parsedMessagesDir }, 'Parsed messages directory does not exist');
    return [];
  }

  try {
    const entries = await fs.readdir(parsedMessagesDir, { withFileTypes: true });
    const groups = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('chat_')) {
        continue;
      }

      // Extract chat_id from directory name (e.g., "chat_-1001234567890")
      const chatId = entry.name.replace('chat_', '');
      const chatIdNum = parseInt(chatId, 10);

      if (isNaN(chatIdNum)) {
        logger.warn({ dirName: entry.name }, 'Invalid chat directory name');
        continue;
      }

      // Get statistics for this chat
      const chatDir = path.join(parsedMessagesDir, entry.name);
      const stats = await getGroupStatistics(chatDir, chatIdNum);

      groups.push({
        id: chatIdNum,
        title: stats.title || `Group ${chatIdNum}`,
        type: chatIdNum < 0 ? 'supergroup' : 'group',
        members_count: stats.users_count || 0,
        messages_count: stats.messages_count || 0,
        last_message_date: stats.last_message_date || null
      });
    }

    logger.info({ count: groups.length }, 'Groups loaded from storage');
    return groups;
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Failed to read groups from storage');
    return [];
  }
}

/**
 * Helper function to get statistics for a specific group
 */
async function getGroupStatistics(chatDir, chatId) {
  const stats = {
    messages_count: 0,
    users_count: 0,
    users: new Set(),
    title: null,
    type: null,
    username: null,
    last_message_date: null
  };

  try {
    const files = await fs.readdir(chatDir);

    // Read metadata.json first if it exists (contains chat title from API)
    const metadataPath = path.join(chatDir, 'metadata.json');
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);
      if (metadata.title) stats.title = metadata.title;
      if (metadata.type) stats.type = metadata.type;
      if (metadata.username) stats.username = metadata.username;
    } catch {
      // metadata.json doesn't exist, continue
    }

    for (const file of files) {
      if (!file.endsWith('.json') || file === 'metadata.json') {
        continue;
      }

      const filePath = path.join(chatDir, file);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const messages = JSON.parse(content);

        if (Array.isArray(messages)) {
          stats.messages_count += messages.length;

          for (const msg of messages) {
            if (msg.user_id) {
              stats.users.add(msg.user_id);
            }

            // Extract group title from first message
            if (!stats.title && msg.chat_title) {
              stats.title = msg.chat_title;
            }

            // Track last message date
            if (msg.date) {
              const msgDate = new Date(msg.date);
              if (!stats.last_message_date || msgDate > new Date(stats.last_message_date)) {
                stats.last_message_date = msg.date;
              }
            }
          }
        }
      } catch (fileError) {
        logger.warn({ file, error: fileError.message }, 'Failed to read message file');
      }
    }

    stats.users_count = stats.users.size;
    delete stats.users; // Remove Set from result

    return stats;
  } catch (error) {
    logger.error({ chatId, error: error.message }, 'Failed to get group statistics');
    return stats;
  }
}

/**
 * Create group parser routes
 * This endpoint allows the frontend to interact with the Telegram Group Parser Bot
 */
export function createGroupParserRoutes() {
  const router = express.Router();

  // Get bot service URL from environment or default to local
  const BOT_SERVICE_URL = process.env.GROUP_PARSER_BOT_URL || 'http://localhost:8000';

  /**
   * POST /api/group-parser/test-connection
   * Test connection to Telegram bot
   *
   * Request body:
   * {
   *   bot_token: string - Telegram bot token
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   bot?: {
   *     username: string
   *     first_name: string
   *   }
   *   error?: string
   * }
   */
  router.post('/test-connection', async (req, res) => {
    try {
      // Accept both snake_case (bot_token) and camelCase (botToken) for API compatibility
      const bot_token = req.body.bot_token || req.body.botToken;

      if (!bot_token) {
        return res.status(400).json({
          success: false,
          error: 'Bot token is required'
        });
      }

      logger.info('Testing bot connection');

      // Call Telegram API directly to test bot token
      const response = await axios.get(`https://api.telegram.org/bot${bot_token}/getMe`, {
        timeout: 10000
      });

      if (response.data.ok) {
        logger.info({ username: response.data.result.username }, 'Bot connection successful');

        return res.json({
          success: true,
          bot: {
            username: response.data.result.username,
            first_name: response.data.result.first_name
          }
        });
      } else {
        throw new Error(response.data.description || 'Failed to connect to bot');
      }
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Bot connection test failed');

      // Extract detailed error message from Telegram API response
      let errorMessage = 'Failed to connect to bot';

      if (error.response) {
        // Telegram API returned an error response
        if (error.response.data?.description) {
          errorMessage = error.response.data.description;
        } else if (error.response.status === 404) {
          errorMessage = 'Invalid bot token. Please check your token and try again.';
        } else if (error.response.status === 401) {
          errorMessage = 'Unauthorized. Please check your bot token.';
        } else {
          errorMessage = `Telegram API error: ${error.response.statusText || error.response.status}`;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout. Please try again.';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot reach Telegram API. Please check your internet connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  });

  /**
   * POST /api/group-parser/groups
   * Get list of groups where bot has parsed messages
   *
   * This endpoint reads from the parsed_messages directory to find all groups
   * where the bot has collected data. It does NOT use Telegram API directly
   * because Bot API doesn't provide a method to list all chats.
   *
   * Request body:
   * {
   *   bot_token: string - Telegram bot token (optional, for validation)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   groups?: Array<{
   *     id: number
   *     title: string
   *     type: string
   *     members_count: number
   *     messages_count: number
   *     last_message_date: string|null
   *   }>
   *   source: string - Data source indicator
   *   error?: string
   * }
   */
  router.post('/groups', async (req, res) => {
    try {
      // Accept both snake_case (bot_token) and camelCase (botToken) for API compatibility
      const bot_token = req.body.bot_token || req.body.botToken;

      const parsedMessagesDir = getParsedMessagesDir();
      logger.info({ dir: parsedMessagesDir }, 'Fetching groups from parsed messages storage');

      // Optionally validate bot token if provided
      let botInfo = null;
      if (bot_token) {
        try {
          const botResponse = await axios.get(`https://api.telegram.org/bot${bot_token}/getMe`, {
            timeout: 5000
          });

          if (!botResponse.data.ok) {
            return res.status(400).json({
              success: false,
              error: 'Invalid bot token'
            });
          }

          botInfo = {
            username: botResponse.data.result.username,
            first_name: botResponse.data.result.first_name,
            id: botResponse.data.result.id
          };

          logger.info({ botInfo }, 'Bot token validated');
        } catch (tokenError) {
          logger.warn({ error: tokenError.message }, 'Bot token validation failed, proceeding anyway');
          // Continue anyway - we can still read stored data
        }
      }

      // Check if directory exists and get diagnostic info
      let directoryExists = false;
      let directoryReadable = false;
      let entriesCount = 0;

      try {
        await fs.access(parsedMessagesDir);
        directoryExists = true;
        directoryReadable = true;

        const entries = await fs.readdir(parsedMessagesDir);
        entriesCount = entries.length;

        logger.info({ entriesCount, directoryExists, directoryReadable }, 'Directory diagnostics');
      } catch (error) {
        logger.warn({ error: error.message, parsedMessagesDir }, 'Directory access check failed');
      }

      // Get groups from storage (parsed_messages directory)
      const groups = await getGroupsFromStorage();

      logger.info({ count: groups.length }, 'Groups fetched successfully from storage');

      // Build detailed diagnostic message
      const diagnostics = {
        parsed_messages_directory: parsedMessagesDir,
        directory_exists: directoryExists,
        directory_readable: directoryReadable,
        entries_in_directory: entriesCount,
        chat_directories_found: groups.length
      };

      // Build user-friendly message
      let message = '';
      let troubleshooting = [];

      if (groups.length === 0) {
        message = 'No groups found with parsed messages.';

        if (!directoryExists) {
          troubleshooting.push({
            issue: 'Parsed messages directory does not exist',
            path: parsedMessagesDir,
            solution: 'Start the Group Parser Bot service (group_parser_bot.py) to create the directory and begin collecting messages'
          });
        } else if (entriesCount === 0) {
          troubleshooting.push({
            issue: 'Parsed messages directory is empty',
            solution: 'The Group Parser Bot service needs to be running and added to Telegram groups as admin to collect messages'
          });
        } else {
          troubleshooting.push({
            issue: `Found ${entriesCount} entries but no valid chat directories`,
            solution: 'Ensure the Group Parser Bot service is properly configured and has been added to groups as admin'
          });
        }

        troubleshooting.push({
          step: 1,
          action: 'Verify the bot service is running',
          command: 'ps aux | grep group_parser_bot.py'
        });

        troubleshooting.push({
          step: 2,
          action: 'Start the bot service if not running',
          command: 'cd backend/telegram-bot && python group_parser_bot.py'
        });

        troubleshooting.push({
          step: 3,
          action: 'Ensure bot is added to Telegram groups as administrator',
          details: 'Open Telegram group → Add bot → Make it admin with "Read Messages" permission'
        });

        troubleshooting.push({
          step: 4,
          action: 'Send a test message in the group',
          details: 'After adding the bot as admin, send any message to trigger message collection'
        });
      } else {
        message = `Found ${groups.length} group(s) with parsed messages`;
      }

      return res.json({
        success: true,
        groups,
        source: 'parsed_messages_storage',
        message,
        diagnostics,
        troubleshooting: troubleshooting.length > 0 ? troubleshooting : undefined,
        bot_info: botInfo
      });
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Failed to fetch groups');

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch groups from storage',
        hint: 'Ensure the Group Parser Bot is running and the parsed_messages directory is accessible'
      });
    }
  });

  /**
   * POST /api/group-parser/parse
   * Parse messages from a group
   *
   * Request body:
   * {
   *   bot_token: string - Telegram bot token
   *   chat_id: number - Chat ID to parse
   *   limit?: number - Max messages to parse (default: 100)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   messages_count?: number
   *   error?: string
   * }
   */
  router.post('/parse', async (req, res) => {
    try {
      // Accept both snake_case and camelCase for API compatibility
      const bot_token = req.body.bot_token || req.body.botToken;
      const chat_id = req.body.chat_id || req.body.chatId;
      const limit = req.body.limit || 100;

      if (!bot_token || !chat_id) {
        return res.status(400).json({
          success: false,
          error: 'Bot token and chat_id are required'
        });
      }

      logger.info({ chat_id, limit }, 'Fetching parsed message count');

      // Read current message count from parsed_messages directory
      const parsedMessagesDir = getParsedMessagesDir();
      const chatDirName = `chat_${chat_id}`;
      const chatDir = path.join(parsedMessagesDir, chatDirName);

      let messagesCount = 0;

      try {
        await fs.access(chatDir);

        // Count messages in all JSON files
        const files = await fs.readdir(chatDir);
        const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'metadata.json');

        for (const file of jsonFiles) {
          try {
            const filePath = path.join(chatDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const messages = JSON.parse(content);

            if (Array.isArray(messages)) {
              messagesCount += messages.length;
            }
          } catch (fileError) {
            logger.warn({ file, error: fileError.message }, 'Failed to read message file');
          }
        }

        logger.info({ chat_id, messagesCount }, 'Message count retrieved');

        return res.json({
          success: true,
          messages_count: messagesCount,
          message: messagesCount > 0
            ? `Found ${messagesCount} parsed messages. The Group Parser Bot service collects messages in real-time.`
            : 'No messages collected yet. Ensure the Group Parser Bot service is running and added to this group as admin.'
        });
      } catch (error) {
        logger.warn({ chat_id, error: error.message }, 'Chat directory not found');

        // Note: Telegram Bot API doesn't provide a direct way to get chat history
        // This is a limitation - we can only get updates that arrive after the bot starts
        // For full history parsing, users would need to use Telegram Client API (requires user account)

        return res.json({
          success: true,
          messages_count: 0,
          message: 'No parsed messages found for this group. The Group Parser Bot service needs to be running to collect messages. ' +
                   'Make sure: (1) The bot service is running, (2) Bot is added to the group as admin, (3) Messages are being sent in the group.'
        });
      }
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Message parsing check failed');

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to check parsed messages'
      });
    }
  });

  /**
   * POST /api/group-parser/messages
   * Get parsed messages from a group
   *
   * Request body:
   * {
   *   bot_token: string - Telegram bot token
   *   chat_id: number - Chat ID
   *   limit?: number - Max messages to return (default: 100)
   *   offset?: number - Offset for pagination (default: 0)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   messages?: Array<Object>
   *   error?: string
   * }
   */
  router.post('/messages', async (req, res) => {
    try {
      // Accept both snake_case and camelCase for API compatibility
      const bot_token = req.body.bot_token || req.body.botToken;
      const chat_id = req.body.chat_id || req.body.chatId;
      const limit = req.body.limit || 100;
      const offset = req.body.offset || 0;

      if (!bot_token || !chat_id) {
        return res.status(400).json({
          success: false,
          error: 'Bot token and chat_id are required'
        });
      }

      logger.info({ chat_id, limit, offset }, 'Fetching parsed messages');

      // Read messages from parsed_messages directory
      const parsedMessagesDir = getParsedMessagesDir();
      const chatDirName = `chat_${chat_id}`;
      const chatDir = path.join(parsedMessagesDir, chatDirName);

      // Check if chat directory exists
      try {
        await fs.access(chatDir);
      } catch (error) {
        logger.warn({ chat_id, chatDir }, 'Chat directory not found');
        return res.json({
          success: true,
          messages: [],
          message: `No messages found for chat ${chat_id}. Make sure the Group Parser Bot service is running and has collected messages from this group.`
        });
      }

      // Read all JSON files from chat directory
      const files = await fs.readdir(chatDir);
      const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'metadata.json');

      if (jsonFiles.length === 0) {
        logger.info({ chat_id, chatDir }, 'No message files found in chat directory');
        return res.json({
          success: true,
          messages: [],
          message: `Chat directory exists but contains no message files yet.`
        });
      }

      // Read and combine messages from all JSON files
      let allMessages = [];
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(chatDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const messages = JSON.parse(content);

          if (Array.isArray(messages)) {
            allMessages = allMessages.concat(messages);
          }
        } catch (fileError) {
          logger.warn({ file, error: fileError.message }, 'Failed to read message file');
        }
      }

      // Sort messages by date (most recent first)
      allMessages.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
      });

      // Apply pagination
      const paginatedMessages = allMessages.slice(offset, offset + limit);

      logger.info({
        chat_id,
        total_messages: allMessages.length,
        returned_messages: paginatedMessages.length,
        offset,
        limit
      }, 'Messages fetched successfully');

      return res.json({
        success: true,
        messages: paginatedMessages,
        total: allMessages.length,
        offset,
        limit,
        has_more: (offset + limit) < allMessages.length
      });
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Failed to fetch messages');

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch messages'
      });
    }
  });

  /**
   * GET /api/group-parser/health
   * Check if the Group Parser Bot service is running
   *
   * Response:
   * {
   *   success: boolean
   *   status: string
   *   message: string
   * }
   */
  router.get('/health', async (req, res) => {
    try {
      const parsedMessagesDir = getParsedMessagesDir();

      // Check storage directory status
      let storageStatus = {
        directory_exists: false,
        directory_path: parsedMessagesDir,
        chat_directories: 0,
        total_messages: 0
      };

      try {
        await fs.access(parsedMessagesDir);
        storageStatus.directory_exists = true;

        const entries = await fs.readdir(parsedMessagesDir, { withFileTypes: true });
        const chatDirs = entries.filter(e => e.isDirectory() && e.name.startsWith('chat_'));
        storageStatus.chat_directories = chatDirs.length;

        // Quick count of total messages across all groups
        for (const chatDir of chatDirs) {
          const chatDirPath = path.join(parsedMessagesDir, chatDir.name);
          const files = await fs.readdir(chatDirPath);
          const jsonFiles = files.filter(f => f.endsWith('.json'));

          for (const file of jsonFiles) {
            try {
              const filePath = path.join(chatDirPath, file);
              const content = await fs.readFile(filePath, 'utf-8');
              const messages = JSON.parse(content);
              if (Array.isArray(messages)) {
                storageStatus.total_messages += messages.length;
              }
            } catch (err) {
              // Skip invalid files
            }
          }
        }
      } catch (error) {
        logger.warn({ error: error.message }, 'Storage directory not accessible');
      }

      // Try to ping the bot service if URL is configured
      let botServiceStatus = 'unknown';
      if (BOT_SERVICE_URL && BOT_SERVICE_URL !== 'http://localhost:8000') {
        try {
          await axios.get(`${BOT_SERVICE_URL}/health`, { timeout: 5000 });
          botServiceStatus = 'running';
        } catch (error) {
          botServiceStatus = 'offline';
        }
      } else {
        botServiceStatus = 'not_configured';
      }

      // Determine overall status
      const isHealthy = storageStatus.directory_exists && (
        storageStatus.chat_directories > 0 || botServiceStatus === 'running'
      );

      const warnings = [];
      if (!storageStatus.directory_exists) {
        warnings.push('Storage directory does not exist. Bot service may not have been started yet.');
      }
      if (storageStatus.chat_directories === 0 && storageStatus.directory_exists) {
        warnings.push('No chat directories found. Bot may not be added to any groups or not collecting messages.');
      }
      if (botServiceStatus === 'offline') {
        warnings.push('Bot service is not responding at configured URL.');
      }
      if (botServiceStatus === 'not_configured') {
        warnings.push('Bot service URL is not configured. Storage-based operation only.');
      }

      return res.json({
        success: isHealthy,
        status: isHealthy ? 'healthy' : 'degraded',
        message: isHealthy
          ? `Group Parser system is operational. ${storageStatus.chat_directories} groups tracked, ${storageStatus.total_messages} messages stored.`
          : 'Group Parser system has issues. Check warnings for details.',
        bot_service_status: botServiceStatus,
        bot_service_url: BOT_SERVICE_URL || 'not_configured',
        storage: storageStatus,
        warnings: warnings.length > 0 ? warnings : undefined,
        recommendations: warnings.length > 0 ? [
          'Ensure group_parser_bot.py is running: cd backend/telegram-bot && python group_parser_bot.py',
          'Verify bot is added to Telegram groups as administrator',
          'Check GROUP_PARSER_BOT_TOKEN is set in environment variables',
          'Send test messages in groups to trigger message collection'
        ] : undefined
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Health check failed');

      return res.status(500).json({
        success: false,
        status: 'error',
        message: error.message
      });
    }
  });

  return router;
}
