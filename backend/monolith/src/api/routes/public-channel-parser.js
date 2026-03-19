// public-channel-parser.js - API routes for Telegram public channel parsing
import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import logger from '../../utils/logger.js';
import TelegramPublicChannelParser from '../../services/TelegramPublicChannelParser.js';
import TelegramParsingQueue from '../../services/TelegramParsingQueue.js';

/**
 * Create public channel parser routes
 * Supports parsing public Telegram channels using MTProto API
 *
 * API Endpoints:
 * - POST /api/public-channel-parser/sources - Add a channel to parse
 * - GET /api/public-channel-parser/messages - Get parsed messages
 * - POST /api/public-channel-parser/parse/:channel - Start parsing a channel
 * - GET /api/public-channel-parser/export - Export messages to CSV/JSON
 * - GET /api/public-channel-parser/stats - Get parsing statistics
 * - GET /api/public-channel-parser/health - Health check
 */
export function createPublicChannelParserRoutes() {
  const router = express.Router();

  // Singleton instances
  let parser = null;
  let parsingQueue = null;

  /**
   * Initialize parser (lazy initialization)
   */
  function getParser() {
    if (!parser) {
      parser = new TelegramPublicChannelParser({
        apiId: process.env.TELEGRAM_API_ID,
        apiHash: process.env.TELEGRAM_API_HASH,
        sessionString: process.env.TELEGRAM_SESSION,
      });
    }
    return parser;
  }

  /**
   * Initialize queue (lazy initialization)
   */
  function getQueue() {
    if (!parsingQueue) {
      parsingQueue = new TelegramParsingQueue({
        redisHost: process.env.REDIS_HOST,
        redisPort: process.env.REDIS_PORT,
        redisPassword: process.env.REDIS_PASSWORD,
      });

      // Start processing (if session is configured)
      if (process.env.TELEGRAM_SESSION) {
        parsingQueue.startProcessing({
          apiId: process.env.TELEGRAM_API_ID,
          apiHash: process.env.TELEGRAM_API_HASH,
          sessionString: process.env.TELEGRAM_SESSION,
        }).catch(error => {
          logger.error({ error: error.message }, 'Failed to start queue processing');
        });
      }
    }
    return parsingQueue;
  }

  /**
   * POST /api/public-channel-parser/sources
   * Add a channel/source to parse
   *
   * Request body:
   * {
   *   channel: string - Channel username (without @)
   *   limit?: number - Max messages to fetch (default: 100)
   *   filterKeywords?: string[] - Keywords to filter
   *   priority?: number - Job priority (1-10)
   * }
   */
  router.post('/sources',
    [
      body('channel').trim().notEmpty().withMessage('Channel username is required'),
      body('limit').optional().isInt({ min: 1, max: 10000 }).withMessage('Limit must be between 1 and 10000'),
      body('filterKeywords').optional().isArray().withMessage('Filter keywords must be an array'),
      body('priority').optional().isInt({ min: 1, max: 10 }).withMessage('Priority must be between 1 and 10'),
    ],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array(),
          });
        }

        const { channel, limit = 100, filterKeywords = [], priority = 5 } = req.body;

        logger.info({ channel, limit }, 'Adding channel source...');

        // Add job to queue
        const queue = getQueue();
        const job = await queue.addParsingJob(
          {
            channelUsername: channel,
            limit,
            offsetId: 0,
            filterKeywords,
          },
          { priority }
        );

        return res.json({
          success: true,
          message: `Channel @${channel} added to parsing queue`,
          job: {
            id: job.id,
            channel,
            limit,
            priority,
          },
        });
      } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'Failed to add channel source');

        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/public-channel-parser/messages
   * Get parsed messages from a channel
   *
   * Query params:
   * - channel: string - Channel username
   * - limit?: number - Max messages to return (default: 100)
   * - offset?: number - Offset for pagination (default: 0)
   */
  router.get('/messages',
    [
      query('channel').trim().notEmpty().withMessage('Channel username is required'),
      query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
      query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0'),
    ],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array(),
          });
        }

        const { channel, limit = 100, offset = 0 } = req.query;

        logger.info({ channel, limit, offset }, 'Fetching messages...');

        const parserInstance = getParser();

        // Load messages from storage
        const fs = await import('fs/promises');
        const path = await import('path');
        const channelDir = path.join(
          parserInstance.storageDir,
          `channel_${channel}`
        );

        let allMessages = [];

        try {
          const files = await fs.readdir(channelDir);

          for (const file of files) {
            if (!file.endsWith('.json')) {
              continue;
            }

            const filePath = path.join(channelDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const messages = JSON.parse(content);

            allMessages.push(...messages);
          }
        } catch (error) {
          if (error.code === 'ENOENT') {
            return res.json({
              success: true,
              messages: [],
              total: 0,
              message: `No messages found for channel @${channel}. Try parsing the channel first.`,
            });
          }
          throw error;
        }

        // Sort by message_id descending
        allMessages.sort((a, b) => b.message_id - a.message_id);

        // Pagination
        const paginatedMessages = allMessages.slice(offset, offset + limit);

        return res.json({
          success: true,
          messages: paginatedMessages,
          total: allMessages.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
        });
      } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'Failed to fetch messages');

        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * POST /api/public-channel-parser/parse/:channel
   * Trigger immediate parsing of a channel (bypasses queue)
   *
   * URL params:
   * - channel: string - Channel username
   *
   * Request body:
   * {
   *   limit?: number - Max messages to fetch (default: 100)
   *   offsetId?: number - Starting message ID (default: 0)
   *   filterKeywords?: string[] - Keywords to filter
   * }
   */
  router.post('/parse/:channel',
    [
      param('channel').trim().notEmpty().withMessage('Channel username is required'),
      body('limit').optional().isInt({ min: 1, max: 10000 }).withMessage('Limit must be between 1 and 10000'),
      body('offsetId').optional().isInt({ min: 0 }).withMessage('Offset ID must be >= 0'),
      body('filterKeywords').optional().isArray().withMessage('Filter keywords must be an array'),
    ],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array(),
          });
        }

        const { channel } = req.params;
        const { limit = 100, offsetId = 0, filterKeywords = [] } = req.body;

        logger.info({ channel, limit, offsetId }, 'Starting immediate channel parsing...');

        const parserInstance = getParser();

        // Connect if not connected
        if (!parserInstance.isConnected()) {
          await parserInstance.connect();
        }

        // Parse channel
        const messages = await parserInstance.parseChannel(channel, {
          limit,
          offsetId,
          filterKeywords,
        });

        // Save messages
        const savedPath = await parserInstance.saveMessages(messages, channel);

        // Get statistics
        const stats = await parserInstance.getChannelStatistics(channel);

        return res.json({
          success: true,
          message: `Successfully parsed @${channel}`,
          messages_count: messages.length,
          saved_path: savedPath,
          statistics: stats,
        });
      } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'Failed to parse channel');

        // Check for specific errors
        let errorMessage = error.message;
        let errorCode = 500;

        if (error.message.includes('USER_DEACTIVATED_BAN')) {
          errorMessage = 'Telegram account is banned or deactivated';
          errorCode = 403;
        } else if (error.message.includes('AUTH_KEY_UNREGISTERED')) {
          errorMessage = 'Invalid Telegram session. Please re-authenticate.';
          errorCode = 401;
        } else if (error.message.includes('CHANNEL_INVALID')) {
          errorMessage = `Channel @${req.params.channel} not found or is private`;
          errorCode = 404;
        } else if (error.message.includes('FLOOD_WAIT')) {
          errorMessage = 'Rate limit exceeded. Please try again later.';
          errorCode = 429;
        }

        return res.status(errorCode).json({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/public-channel-parser/export
   * Export messages to CSV or JSON
   *
   * Query params:
   * - channel: string - Channel username
   * - format: string - Export format ('csv' or 'json')
   */
  router.get('/export',
    [
      query('channel').trim().notEmpty().withMessage('Channel username is required'),
      query('format').trim().isIn(['csv', 'json']).withMessage('Format must be csv or json'),
    ],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array(),
          });
        }

        const { channel, format } = req.query;

        logger.info({ channel, format }, 'Exporting messages...');

        const parserInstance = getParser();

        // Load all messages
        const fs = await import('fs/promises');
        const path = await import('path');
        const channelDir = path.join(
          parserInstance.storageDir,
          `channel_${channel}`
        );

        let allMessages = [];

        try {
          const files = await fs.readdir(channelDir);

          for (const file of files) {
            if (!file.endsWith('.json')) {
              continue;
            }

            const filePath = path.join(channelDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const messages = JSON.parse(content);

            allMessages.push(...messages);
          }
        } catch (error) {
          if (error.code === 'ENOENT') {
            return res.status(404).json({
              success: false,
              error: `No messages found for channel @${channel}`,
            });
          }
          throw error;
        }

        if (allMessages.length === 0) {
          return res.status(404).json({
            success: false,
            error: `No messages found for channel @${channel}`,
          });
        }

        // Sort by message_id
        allMessages.sort((a, b) => b.message_id - a.message_id);

        if (format === 'csv') {
          const csvContent = parserInstance.exportToCSV(allMessages);

          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${channel}_messages.csv"`);
          return res.send(csvContent);
        } else {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="${channel}_messages.json"`);
          return res.json({
            channel,
            total_messages: allMessages.length,
            exported_at: new Date().toISOString(),
            messages: allMessages,
          });
        }
      } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'Failed to export messages');

        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/public-channel-parser/stats
   * Get statistics for parsed channels
   *
   * Query params:
   * - channel?: string - Specific channel (optional, returns all if not provided)
   */
  router.get('/stats',
    [
      query('channel').optional().trim(),
    ],
    async (req, res) => {
      try {
        const { channel } = req.query;

        const parserInstance = getParser();
        const queue = getQueue();

        // Queue stats
        const queueStats = await queue.getQueueStats();

        // Channel stats
        if (channel) {
          const channelStats = await parserInstance.getChannelStatistics(channel);

          return res.json({
            success: true,
            channel,
            statistics: channelStats,
            queue: queueStats,
          });
        } else {
          // Get stats for all channels
          const fs = await import('fs/promises');
          const path = await import('path');

          let allChannels = [];

          try {
            const entries = await fs.readdir(parserInstance.storageDir, { withFileTypes: true });

            for (const entry of entries) {
              if (!entry.isDirectory() || !entry.name.startsWith('channel_')) {
                continue;
              }

              const channelUsername = entry.name.replace('channel_', '');
              const stats = await parserInstance.getChannelStatistics(channelUsername);

              allChannels.push({
                channel: channelUsername,
                ...stats,
              });
            }
          } catch (error) {
            if (error.code !== 'ENOENT') {
              throw error;
            }
          }

          return res.json({
            success: true,
            total_channels: allChannels.length,
            channels: allChannels,
            queue: queueStats,
          });
        }
      } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'Failed to get statistics');

        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/public-channel-parser/health
   * Health check endpoint
   */
  router.get('/health', async (req, res) => {
    try {
      const parserInstance = getParser();
      const queue = getQueue();

      const isParserConnected = parserInstance.isConnected();
      const queueStats = await queue.getQueueStats();

      const warnings = [];

      if (!isParserConnected) {
        warnings.push('Parser not connected to Telegram. Session may not be configured.');
      }

      if (!process.env.TELEGRAM_API_ID || !process.env.TELEGRAM_API_HASH) {
        warnings.push('TELEGRAM_API_ID or TELEGRAM_API_HASH not configured');
      }

      if (!process.env.TELEGRAM_SESSION) {
        warnings.push('TELEGRAM_SESSION not configured. Manual parsing only (no queue processing).');
      }

      if (!process.env.REDIS_HOST && !process.env.REDIS_PORT) {
        warnings.push('Redis not configured. Queue functionality may be limited.');
      }

      const isHealthy = isParserConnected || process.env.TELEGRAM_SESSION;

      return res.json({
        success: true,
        status: isHealthy ? 'healthy' : 'degraded',
        parser_connected: isParserConnected,
        session_configured: !!process.env.TELEGRAM_SESSION,
        queue: queueStats,
        warnings: warnings.length > 0 ? warnings : undefined,
        recommendations: warnings.length > 0 ? [
          'Configure TELEGRAM_API_ID and TELEGRAM_API_HASH from https://my.telegram.org/apps',
          'Run parser authentication to generate TELEGRAM_SESSION',
          'Configure Redis for queue functionality',
        ] : undefined,
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Health check failed');

      return res.status(500).json({
        success: false,
        status: 'error',
        error: error.message,
      });
    }
  });

  return router;
}

export default createPublicChannelParserRoutes;
