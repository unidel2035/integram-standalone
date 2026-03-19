// sales-agent.js - API routes for Sales Agent
import express from 'express';
import { SalesAgent } from '../../agents/SalesAgent.js';
import logger from '../../utils/logger.js';

/**
 * Create sales agent routes
 * Provides endpoints for managing sales agent operations
 */
export function createSalesAgentRoutes() {
  const router = express.Router();

  // Create a global sales agent instance
  const salesAgent = new SalesAgent({
    id: 'sales_agent_main',
    metadata: { version: '1.0.0' }
  });

  salesAgent.initialize();

  /**
   * POST /api/sales-agent/generate-leads
   * Generate leads from Telegram group messages
   *
   * Request body:
   * {
   *   messages: Array<Object> - Telegram messages
   *   groupInfo: Object - Group information
   *   filters?: Object - Optional filters (minMessages, etc.)
   * }
   */
  router.post('/generate-leads', async (req, res) => {
    try {
      const { messages, groupInfo, filters } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({
          success: false,
          error: 'messages array is required'
        });
      }

      if (!groupInfo || !groupInfo.id) {
        return res.status(400).json({
          success: false,
          error: 'groupInfo with id is required'
        });
      }

      logger.info({
        messageCount: messages.length,
        groupId: groupInfo.id
      }, 'Generating leads from Telegram messages');

      const result = await salesAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'generate_leads',
        payload: { messages, groupInfo, filters }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Lead generation failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/sales-agent/score-leads
   * Score leads using AI and rule-based criteria
   *
   * Request body:
   * {
   *   leadIds: Array<string> - Lead IDs to score
   *   criteria?: Object - Optional custom scoring criteria
   * }
   */
  router.post('/score-leads', async (req, res) => {
    try {
      const { leadIds, criteria } = req.body;

      if (!leadIds || !Array.isArray(leadIds)) {
        return res.status(400).json({
          success: false,
          error: 'leadIds array is required'
        });
      }

      logger.info({ leadCount: leadIds.length }, 'Scoring leads');

      const result = await salesAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'score_leads',
        payload: { leadIds, criteria }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Lead scoring failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/sales-agent/create-funnel
   * Create a sales funnel for leads
   *
   * Request body:
   * {
   *   name: string - Funnel name
   *   leadIds: Array<string> - Lead IDs
   *   targetProduct?: string - Target product name
   * }
   */
  router.post('/create-funnel', async (req, res) => {
    try {
      const { name, leadIds, targetProduct } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'name is required'
        });
      }

      if (!leadIds || !Array.isArray(leadIds)) {
        return res.status(400).json({
          success: false,
          error: 'leadIds array is required'
        });
      }

      logger.info({
        funnelName: name,
        leadCount: leadIds.length
      }, 'Creating sales funnel');

      const result = await salesAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'create_funnel',
        payload: { name, leadIds, targetProduct }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Funnel creation failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/sales-agent/generate-communication-journey
   * Generate AI-powered communication journey for a lead
   *
   * Request body:
   * {
   *   leadId: string - Lead ID
   *   funnelId: string - Funnel ID
   *   targetProduct?: string - Target product name
   * }
   */
  router.post('/generate-communication-journey', async (req, res) => {
    try {
      const { leadId, funnelId, targetProduct } = req.body;

      if (!leadId) {
        return res.status(400).json({
          success: false,
          error: 'leadId is required'
        });
      }

      if (!funnelId) {
        return res.status(400).json({
          success: false,
          error: 'funnelId is required'
        });
      }

      logger.info({ leadId, funnelId }, 'Generating communication journey');

      const result = await salesAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'generate_communication_journey',
        payload: { leadId, funnelId, targetProduct }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Journey generation failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/sales-agent/send-outreach
   * Send outreach message from communication journey
   *
   * Request body:
   * {
   *   journeyId: string - Journey ID
   *   stepIndex: number - Step index in journey
   * }
   */
  router.post('/send-outreach', async (req, res) => {
    try {
      const { journeyId, stepIndex } = req.body;

      if (!journeyId) {
        return res.status(400).json({
          success: false,
          error: 'journeyId is required'
        });
      }

      if (stepIndex === undefined || stepIndex === null) {
        return res.status(400).json({
          success: false,
          error: 'stepIndex is required'
        });
      }

      logger.info({ journeyId, stepIndex }, 'Sending outreach');

      const result = await salesAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'send_outreach',
        payload: { journeyId, stepIndex }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Outreach sending failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/sales-agent/update-lead-stage
   * Update lead stage in funnel
   *
   * Request body:
   * {
   *   leadId: string - Lead ID
   *   funnelId: string - Funnel ID
   *   newStage: string - New stage name
   * }
   */
  router.post('/update-lead-stage', async (req, res) => {
    try {
      const { leadId, funnelId, newStage } = req.body;

      if (!leadId || !funnelId || !newStage) {
        return res.status(400).json({
          success: false,
          error: 'leadId, funnelId, and newStage are required'
        });
      }

      logger.info({ leadId, funnelId, newStage }, 'Updating lead stage');

      const result = await salesAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'update_lead_stage',
        payload: { leadId, funnelId, newStage }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Lead stage update failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/sales-agent/analyze-campaign
   * Analyze campaign performance
   *
   * Request body:
   * {
   *   funnelId: string - Funnel ID
   * }
   */
  router.post('/analyze-campaign', async (req, res) => {
    try {
      const { funnelId } = req.body;

      if (!funnelId) {
        return res.status(400).json({
          success: false,
          error: 'funnelId is required'
        });
      }

      logger.info({ funnelId }, 'Analyzing campaign');

      const result = await salesAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'analyze_campaign',
        payload: { funnelId }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Campaign analysis failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/sales-agent/statistics
   * Get sales agent statistics
   */
  router.get('/statistics', async (req, res) => {
    try {
      logger.info('Getting sales agent statistics');

      const statistics = salesAgent.getStatistics();

      res.json({
        success: true,
        statistics
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get statistics');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/sales-agent/status
   * Get sales agent status
   */
  router.get('/status', async (req, res) => {
    try {
      const status = salesAgent.getStatus();

      res.json({
        success: true,
        status
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get status');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/sales-agent/health
   * Health check endpoint
   */
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      agent: salesAgent.name,
      timestamp: new Date().toISOString()
    });
  });

  return router;
}

export default createSalesAgentRoutes;
