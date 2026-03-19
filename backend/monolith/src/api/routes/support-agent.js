// support-agent.js - API routes for Support Agent
import express from 'express';
import logger from '../../utils/logger.js';
import { SupportAgent } from '../../agents/templates/support-agent.js';

export function createSupportAgentRoutes(orchestrator) {
  const router = express.Router();
  const { db, agentRegistry } = orchestrator;

  // Global support agent instances (cached by organization)
  const agentInstances = new Map();

  /**
   * Helper to get or create support agent instance
   */
  const getAgentInstance = (organizationId, llmCoordinator) => {
    const key = `support-${organizationId}`;

    if (!agentInstances.has(key)) {
      const agent = new SupportAgent({
        id: key,
        db,
        organizationId,
        agentRegistry,
        llmCoordinator
      });
      agentInstances.set(key, agent);
    }

    return agentInstances.get(key);
  };

  /**
   * Setup Telegram bot
   * POST /api/agents/support/telegram/setup
   */
  router.post('/telegram/setup', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const { botToken, webhookUrl } = req.body;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      if (!botToken || !webhookUrl) {
        return res.status(400).json({ error: 'Bot token and webhook URL are required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'setup_telegram_bot',
        payload: { botToken, webhookUrl }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to setup Telegram bot');
      next(error);
    }
  });

  /**
   * Handle incoming message
   * POST /api/agents/support/messages
   */
  router.post('/messages', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const { message, customerId, customerName, platform } = req.body;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      if (!message || !customerId) {
        return res.status(400).json({ error: 'Message and customer ID are required' });
      }

      const agent = getAgentInstance(organizationId, orchestrator.llmCoordinator);

      const result = await agent.execute({
        type: 'handle_message',
        payload: { message, customerId, customerName, platform }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to handle message');
      next(error);
    }
  });

  /**
   * Create support ticket
   * POST /api/agents/support/tickets
   */
  router.post('/tickets', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const { customerId, subject, description, priority, tags } = req.body;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      if (!customerId || !subject) {
        return res.status(400).json({ error: 'Customer ID and subject are required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'create_ticket',
        payload: { customerId, subject, description, priority, tags }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create ticket');
      next(error);
    }
  });

  /**
   * Update support ticket
   * PATCH /api/agents/support/tickets/:ticketId
   */
  router.patch('/tickets/:ticketId', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const ticketId = req.params.ticketId;
      const { status, priority, assignedTo, notes } = req.body;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'update_ticket',
        payload: { ticketId, status, priority, assignedTo, notes }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to update ticket');
      next(error);
    }
  });

  /**
   * Get ticket details
   * GET /api/agents/support/tickets/:ticketId
   */
  router.get('/tickets/:ticketId', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;
      const ticketId = req.params.ticketId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'get_ticket',
        payload: { ticketId }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get ticket');
      next(error);
    }
  });

  /**
   * Search tickets
   * GET /api/agents/support/tickets
   */
  router.get('/tickets', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'search_tickets',
        payload: {
          status: req.query.status,
          priority: req.query.priority,
          customerId: req.query.customerId,
          limit: parseInt(req.query.limit) || 50,
          offset: parseInt(req.query.offset) || 0
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to search tickets');
      next(error);
    }
  });

  /**
   * Close ticket (update with status closed)
   * POST /api/agents/support/tickets/:ticketId/close
   */
  router.post('/tickets/:ticketId/close', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const ticketId = req.params.ticketId;
      const { notes } = req.body;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'update_ticket',
        payload: { ticketId, status: 'closed', notes }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to close ticket');
      next(error);
    }
  });

  /**
   * Escalate ticket
   * POST /api/agents/support/tickets/:ticketId/escalate
   */
  router.post('/tickets/:ticketId/escalate', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const ticketId = req.params.ticketId;
      const { reason, assignTo } = req.body;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'escalate_ticket',
        payload: { ticketId, reason, assignTo }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to escalate ticket');
      next(error);
    }
  });

  /**
   * Get conversation history
   * GET /api/agents/support/conversations/:customerId
   */
  router.get('/conversations/:customerId', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;
      const customerId = req.params.customerId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'get_conversation_history',
        payload: {
          customerId,
          limit: parseInt(req.query.limit) || 50,
          offset: parseInt(req.query.offset) || 0
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get conversation history');
      next(error);
    }
  });

  /**
   * Add canned response
   * POST /api/agents/support/canned-responses
   */
  router.post('/canned-responses', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const { title, content, tags, category } = req.body;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'add_canned_response',
        payload: { title, content, tags, category }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to add canned response');
      next(error);
    }
  });

  /**
   * Get canned responses
   * GET /api/agents/support/canned-responses
   */
  router.get('/canned-responses', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'get_canned_responses',
        payload: {
          category: req.query.category,
          searchQuery: req.query.search,
          limit: parseInt(req.query.limit) || 50
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get canned responses');
      next(error);
    }
  });

  /**
   * Add knowledge base article
   * POST /api/agents/support/knowledge
   */
  router.post('/knowledge', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const { title, content, tags, category, keywords } = req.body;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'add_knowledge_article',
        payload: { title, content, tags, category, keywords }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to add knowledge article');
      next(error);
    }
  });

  /**
   * Update knowledge base article
   * PATCH /api/agents/support/knowledge/:articleId
   */
  router.patch('/knowledge/:articleId', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const articleId = req.params.articleId;
      const { title, content, tags, category, keywords } = req.body;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      // Note: Update functionality needs to be implemented in SupportAgent
      // For now, return not implemented
      res.status(501).json({
        success: false,
        error: 'Update knowledge article not yet implemented in SupportAgent'
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to update knowledge article');
      next(error);
    }
  });

  /**
   * Search knowledge base
   * GET /api/agents/support/knowledge
   */
  router.get('/knowledge', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'search_knowledge',
        payload: {
          query: req.query.q || req.query.query,
          category: req.query.category,
          limit: parseInt(req.query.limit) || 5
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to search knowledge base');
      next(error);
    }
  });

  /**
   * Analyze sentiment
   * POST /api/agents/support/sentiment
   */
  router.post('/sentiment', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const { text } = req.body;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'analyze_sentiment',
        payload: { text }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to analyze sentiment');
      next(error);
    }
  });

  /**
   * Get statistics
   * GET /api/agents/support/statistics
   */
  router.get('/statistics', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      // Get ticket statistics
      const ticketStats = await db.query(`
        SELECT
          COUNT(*) as total_tickets,
          COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tickets,
          COUNT(CASE WHEN status = 'escalated' THEN 1 END) as escalated_tickets,
          COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_tickets,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
          COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_priority,
          COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_priority,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_resolution_time_seconds
        FROM agent_support_tickets
        WHERE organization_id = $1
      `, [organizationId]);

      // Get message statistics
      const messageStats = await db.query(`
        SELECT
          COUNT(*) as total_messages,
          COUNT(CASE WHEN sender = 'customer' THEN 1 END) as customer_messages,
          COUNT(CASE WHEN sender = 'agent' THEN 1 END) as agent_messages,
          COUNT(DISTINCT customer_id) as unique_customers
        FROM agent_support_conversations
        WHERE organization_id = $1
      `, [organizationId]);

      res.json({
        success: true,
        statistics: {
          tickets: ticketStats.rows[0],
          messages: messageStats.rows[0]
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get statistics');
      next(error);
    }
  });

  /**
   * Get response time statistics
   * GET /api/agents/support/statistics/response-times
   */
  router.get('/statistics/response-times', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;
      const days = parseInt(req.query.days) || 7;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const result = await db.query(`
        WITH response_times AS (
          SELECT
            DATE_TRUNC('day', t.created_at) as day,
            EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 60 as response_time_minutes
          FROM agent_support_tickets t
          WHERE t.organization_id = $1
            AND t.created_at >= NOW() - INTERVAL '${days} days'
            AND t.status IN ('closed', 'resolved')
        )
        SELECT
          day,
          AVG(response_time_minutes) as avg_response_time,
          MIN(response_time_minutes) as min_response_time,
          MAX(response_time_minutes) as max_response_time,
          COUNT(*) as ticket_count
        FROM response_times
        GROUP BY day
        ORDER BY day DESC
      `, [organizationId]);

      res.json({
        success: true,
        responseTimes: result.rows,
        periodDays: days
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get response time statistics');
      next(error);
    }
  });

  return router;
}

export default createSupportAgentRoutes;
