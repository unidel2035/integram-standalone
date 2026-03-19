// customer-support.js - API routes for Customer Support Agent
// Issue #1737 - AI-powered customer support bot
// Issue #2144 - Fixed PostgreSQL import error (pg not installed)
//
// NOTE: This module requires database integration via DronDoc API.
// Database requirements:
// - customer_support_conversations table
// - customer_support_ai_responses table
// - customer_support_knowledge_base table
// - conversations table
// - message_delivery table
//
// Current implementation uses in-memory storage as a temporary solution.
// TODO: Integrate with DronDoc API for persistent storage when available.

import express from 'express';
import { CustomerSupportAgent } from '../../agents/CustomerSupportAgent.js';
import { TokenBasedLLMCoordinator } from '../../core/TokenBasedLLMCoordinator.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Temporary in-memory storage (replace with DronDoc API)
const inMemoryStorage = {
  knowledgeBase: [],
  conversations: new Map(),
  aiResponses: new Map()
};

// LLM Coordinator for AI responses (without database dependency)
const llmCoordinator = new TokenBasedLLMCoordinator({ db: null });

// Create a global customer support agent instance
const customerSupportAgent = new CustomerSupportAgent({
  id: 'customer_support_agent_main',
  db: null, // Database integration pending
  llmCoordinator,
  metadata: { version: '1.0.0' }
});

customerSupportAgent.initialize();

/**
 * POST /api/customer-support/message
 * Handle customer message and generate AI response
 *
 * Request body:
 * {
 *   messageText: string - Customer message
 *   conversationId: UUID - Conversation ID
 *   customerUserId: UUID - Customer user ID
 *   accessToken: string - DronDoc AI access token
 * }
 */
router.post('/message', async (req, res) => {
  try {
    const { messageText, conversationId, customerUserId, accessToken } = req.body;

    if (!messageText) {
      return res.status(400).json({
        success: false,
        error: 'messageText is required'
      });
    }

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId is required'
      });
    }

    if (!customerUserId) {
      return res.status(400).json({
        success: false,
        error: 'customerUserId is required'
      });
    }

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'accessToken is required'
      });
    }

    logger.info({
      conversationId,
      customerUserId,
      messageLength: messageText.length
    }, 'Handling customer support message');

    const result = await customerSupportAgent.processTask({
      id: `task_${Date.now()}`,
      type: 'handle_message',
      payload: { messageText, conversationId, customerUserId, accessToken }
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Customer support message handling failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/customer-support/conversation
 * Create a new customer support conversation
 *
 * Request body:
 * {
 *   conversationId: UUID - Main conversation ID
 *   customerUserId: UUID - Customer user ID
 *   botId?: UUID - Bot ID (optional)
 *   subject?: string - Conversation subject
 *   category?: string - Conversation category
 * }
 */
router.post('/conversation', async (req, res) => {
  try {
    const { conversationId, customerUserId, botId, subject, category } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId is required'
      });
    }

    if (!customerUserId) {
      return res.status(400).json({
        success: false,
        error: 'customerUserId is required'
      });
    }

    logger.info({
      conversationId,
      customerUserId
    }, 'Creating customer support conversation');

    const result = await customerSupportAgent.processTask({
      id: `task_${Date.now()}`,
      type: 'create_support_conversation',
      payload: { conversationId, customerUserId, botId, subject, category }
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Customer support conversation creation failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/customer-support/analyze
 * Analyze conversation and identify needs/suggestions
 *
 * Request body:
 * {
 *   supportConversationId: UUID - Support conversation ID
 *   accessToken: string - DronDoc AI access token
 * }
 */
router.post('/analyze', async (req, res) => {
  try {
    const { supportConversationId, accessToken } = req.body;

    if (!supportConversationId) {
      return res.status(400).json({
        success: false,
        error: 'supportConversationId is required'
      });
    }

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'accessToken is required'
      });
    }

    logger.info({ supportConversationId }, 'Analyzing customer support conversation');

    const result = await customerSupportAgent.processTask({
      id: `task_${Date.now()}`,
      type: 'analyze_conversation',
      payload: { supportConversationId, accessToken }
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Conversation analysis failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/customer-support/conversation/:id/summary
 * Get conversation summary with all details
 */
router.get('/conversation/:id/summary', async (req, res) => {
  try {
    const { id } = req.params;

    logger.info({ supportConversationId: id }, 'Getting conversation summary');

    const result = await customerSupportAgent.processTask({
      id: `task_${Date.now()}`,
      type: 'get_conversation_summary',
      payload: { supportConversationId: id }
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Get conversation summary failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /api/customer-support/conversation/:id/status
 * Update conversation status
 *
 * Request body:
 * {
 *   status: string - New status
 *   resolvedReason?: string - Reason for resolution
 * }
 */
router.patch('/conversation/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolvedReason } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'status is required'
      });
    }

    const validStatuses = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    logger.info({
      supportConversationId: id,
      newStatus: status
    }, 'Updating conversation status');

    const result = await customerSupportAgent.processTask({
      id: `task_${Date.now()}`,
      type: 'update_status',
      payload: { supportConversationId: id, status, resolvedReason }
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Update conversation status failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/customer-support/knowledge-base/search
 * Search knowledge base
 *
 * Request body:
 * {
 *   query: string - Search query
 *   limit?: number - Maximum results (default: 5)
 * }
 */
router.post('/knowledge-base/search', async (req, res) => {
  try {
    const { query, limit } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'query is required'
      });
    }

    logger.info({ query, limit }, 'Searching knowledge base');

    const result = await customerSupportAgent.processTask({
      id: `task_${Date.now()}`,
      type: 'search_knowledge_base',
      payload: { query, limit }
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Knowledge base search failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/customer-support/knowledge-base
 * Add knowledge base article
 *
 * Request body:
 * {
 *   title: string
 *   content: string
 *   category?: string
 *   tags?: string[]
 *   keywords?: string[]
 *   priority?: number
 * }
 */
router.post('/knowledge-base', async (req, res) => {
  try {
    const { title, content, category, tags, keywords, priority } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'title and content are required'
      });
    }

    logger.info({ title, category }, 'Adding knowledge base article');

    // TODO: Replace with DronDoc API integration
    const article = {
      id: `kb_${Date.now()}`,
      title,
      content,
      category: category || null,
      tags: tags || [],
      keywords: keywords || [],
      priority: priority || 0,
      created_by: req.user?.id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    inMemoryStorage.knowledgeBase.push(article);

    res.json({
      success: true,
      article
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Add knowledge base article failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/customer-support/statistics
 * Get customer support agent statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    logger.info('Getting customer support statistics');

    const stats = await customerSupportAgent.getStatistics();

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Get statistics failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/customer-support/conversations
 * List customer support conversations
 *
 * Query params:
 * - status: Filter by status
 * - customerId: Filter by customer user ID
 * - limit: Maximum results (default: 50)
 * - offset: Pagination offset (default: 0)
 */
router.get('/conversations', async (req, res) => {
  try {
    const {
      status,
      customerId,
      limit = 50,
      offset = 0
    } = req.query;

    const whereClauses = [];
    const values = [];
    let valueIndex = 1;

    if (status) {
      whereClauses.push(`status = $${valueIndex++}`);
      values.push(status);
    }

    if (customerId) {
      whereClauses.push(`customer_user_id = $${valueIndex++}`);
      values.push(customerId);
    }

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    values.push(parseInt(limit));
    values.push(parseInt(offset));

    // TODO: Replace with DronDoc API integration
    let conversations = Array.from(inMemoryStorage.conversations.values());

    // Apply filters
    if (status) {
      conversations = conversations.filter(c => c.status === status);
    }
    if (customerId) {
      conversations = conversations.filter(c => c.customer_user_id === customerId);
    }

    // Apply pagination
    const total = conversations.length;
    const paginatedConversations = conversations
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      conversations: paginatedConversations,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'List conversations failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/customer-support/feedback
 * Submit feedback on AI response
 *
 * Request body:
 * {
 *   aiResponseId: UUID - AI response ID
 *   wasHelpful: boolean
 *   feedbackText?: string
 * }
 */
router.post('/feedback', async (req, res) => {
  try {
    const { aiResponseId, wasHelpful, feedbackText } = req.body;

    if (!aiResponseId) {
      return res.status(400).json({
        success: false,
        error: 'aiResponseId is required'
      });
    }

    if (typeof wasHelpful !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'wasHelpful must be a boolean'
      });
    }

    logger.info({ aiResponseId, wasHelpful }, 'Submitting AI response feedback');

    // TODO: Replace with DronDoc API integration
    const aiResponse = inMemoryStorage.aiResponses.get(aiResponseId);
    if (aiResponse) {
      aiResponse.was_helpful = wasHelpful;
      aiResponse.feedback_text = feedbackText || null;
      inMemoryStorage.aiResponses.set(aiResponseId, aiResponse);
    }

    res.json({
      success: true,
      message: 'Feedback submitted successfully'
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Submit feedback failed');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
