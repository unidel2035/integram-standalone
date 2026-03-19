// customer-support-bot.js - API routes for Customer Support Telegram Bot
// Issue #2452 - Telegram chatbot for customer support
//
// This module provides REST API endpoints to control and monitor
// the Customer Support Telegram Bot.

import express from 'express';
import { CustomerSupportTelegramBot } from '../../services/CustomerSupportTelegramBot.js';
import { CustomerSupportAgent } from '../../agents/CustomerSupportAgent.js';
import { TokenBasedLLMCoordinator } from '../../core/TokenBasedLLMCoordinator.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Global bot instance (singleton)
let botInstance = null;
let llmCoordinator = null;
let customerSupportAgent = null;

/**
 * Initialize dependencies
 */
function initializeDependencies() {
  if (!llmCoordinator) {
    llmCoordinator = new TokenBasedLLMCoordinator({ db: null });
  }

  if (!customerSupportAgent) {
    customerSupportAgent = new CustomerSupportAgent({
      id: 'customer_support_agent_telegram',
      db: null,
      llmCoordinator,
      metadata: { version: '1.0.0', source: 'telegram' }
    });
    customerSupportAgent.initialize();
  }
}

/**
 * POST /api/customer-support-bot/start
 * Start the Telegram bot
 *
 * Request body:
 * {
 *   apiId?: string - Telegram API ID (optional, uses env var by default)
 *   apiHash?: string - Telegram API Hash (optional, uses env var by default)
 *   sessionString?: string - Telegram session string (optional, uses env var by default)
 *   botToken?: string - Bot token (optional, uses env var by default)
 * }
 */
router.post('/start', async (req, res) => {
  try {
    if (botInstance && botInstance.isConnected) {
      return res.status(400).json({
        success: false,
        error: 'Bot is already running',
        statistics: botInstance.getStatistics()
      });
    }

    const { apiId, apiHash, sessionString, botToken } = req.body;

    // Initialize dependencies
    initializeDependencies();

    // Create bot instance
    botInstance = new CustomerSupportTelegramBot({
      apiId: apiId || process.env.TELEGRAM_API_ID,
      apiHash: apiHash || process.env.TELEGRAM_API_HASH,
      sessionString: sessionString || process.env.TELEGRAM_SESSION,
      botToken: botToken || process.env.TELEGRAM_SUPPORT_BOT_TOKEN,
      customerSupportAgent,
      llmCoordinator
    });

    // Start the bot
    const result = await botInstance.start();

    logger.info('Customer Support Telegram Bot started successfully');

    res.json({
      success: true,
      message: 'Bot started successfully',
      ...result,
      statistics: botInstance.getStatistics()
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to start bot');
    res.status(500).json({
      success: false,
      error: error.message,
      hint: error.message.includes('TELEGRAM_API_ID')
        ? 'Please set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env file'
        : undefined
    });
  }
});

/**
 * POST /api/customer-support-bot/stop
 * Stop the Telegram bot
 */
router.post('/stop', async (req, res) => {
  try {
    if (!botInstance || !botInstance.isConnected) {
      return res.status(400).json({
        success: false,
        error: 'Bot is not running'
      });
    }

    const result = await botInstance.stop();

    logger.info('Customer Support Telegram Bot stopped successfully');

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to stop bot');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/customer-support-bot/status
 * Get bot status and statistics
 */
router.get('/status', (req, res) => {
  try {
    if (!botInstance) {
      return res.json({
        success: true,
        isRunning: false,
        statistics: null
      });
    }

    const statistics = botInstance.getStatistics();

    res.json({
      success: true,
      isRunning: botInstance.isConnected,
      statistics
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get bot status');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/customer-support-bot/conversations
 * Get all active conversations
 */
router.get('/conversations', (req, res) => {
  try {
    if (!botInstance || !botInstance.isConnected) {
      return res.status(400).json({
        success: false,
        error: 'Bot is not running'
      });
    }

    const conversations = botInstance.getActiveConversations();

    res.json({
      success: true,
      conversations,
      total: conversations.length
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get conversations');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/customer-support-bot/customer/:id
 * Get customer context by ID
 */
router.get('/customer/:id', (req, res) => {
  try {
    if (!botInstance || !botInstance.isConnected) {
      return res.status(400).json({
        success: false,
        error: 'Bot is not running'
      });
    }

    const { id } = req.params;
    const context = botInstance.getCustomerContext(id);

    if (!context) {
      return res.status(404).json({
        success: false,
        error: 'Customer context not found'
      });
    }

    res.json({
      success: true,
      context
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get customer context');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/customer-support-bot/send-message
 * Send message to customer via bot
 *
 * Request body:
 * {
 *   chatId: string - Telegram chat ID
 *   message: string - Message text
 * }
 */
router.post('/send-message', async (req, res) => {
  try {
    if (!botInstance || !botInstance.isConnected) {
      return res.status(400).json({
        success: false,
        error: 'Bot is not running'
      });
    }

    const { chatId, message } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({
        success: false,
        error: 'chatId and message are required'
      });
    }

    await botInstance.sendMessage(chatId, message);

    logger.info({ chatId }, 'Message sent to customer via bot');

    res.json({
      success: true,
      message: 'Message sent successfully'
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to send message');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/customer-support-bot/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  const isHealthy = botInstance && botInstance.isConnected;

  res.status(isHealthy ? 200 : 503).json({
    success: true,
    healthy: isHealthy,
    timestamp: new Date().toISOString(),
    uptime: botInstance ? botInstance.getStatistics().uptime : 0
  });
});

export default router;
