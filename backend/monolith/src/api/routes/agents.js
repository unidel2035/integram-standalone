// agents.js - Agent management routes
import express from 'express';
import logger from '../../utils/logger.js';

export function createAgentRoutes(orchestrator) {
  const router = express.Router();
  const { agentRegistry, agentManager, messageBus } = orchestrator;

  /**
   * Register a new agent
   */
  router.post('/register', (req, res, next) => {
    try {
      const { id, name, capabilities, metadata } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Agent name is required' });
      }

      const agent = agentRegistry.registerAgent({
        id,
        name,
        capabilities: capabilities || [],
        metadata: metadata || {}
      });

      res.status(201).json({
        success: true,
        agent: {
          id: agent.id,
          name: agent.name,
          status: agent.status,
          capabilities: agent.capabilities,
          registeredAt: agent.registeredAt
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Unregister an agent
   */
  router.delete('/:id', (req, res, next) => {
    try {
      const agent = agentRegistry.unregisterAgent(req.params.id);

      res.json({
        success: true,
        message: 'Agent unregistered',
        agent: {
          id: agent.id,
          name: agent.name
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get agent by ID
   */
  router.get('/:id', (req, res, next) => {
    try {
      const agent = agentRegistry.getAgent(req.params.id);

      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      res.json({
        success: true,
        agent: {
          id: agent.id,
          name: agent.name,
          status: agent.status,
          capabilities: agent.capabilities,
          currentTask: agent.currentTask,
          tasksCompleted: agent.tasksCompleted,
          tasksFailed: agent.tasksFailed,
          registeredAt: agent.registeredAt,
          lastHeartbeat: agent.lastHeartbeat
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get all agents
   */
  router.get('/', (req, res, next) => {
    try {
      const { status, capability } = req.query;

      let agents;
      if (status) {
        agents = agentRegistry.getAgentsByStatus(status);
      } else if (capability) {
        agents = agentRegistry.getAgentsByCapability(capability);
      } else {
        agents = agentRegistry.getAllAgents();
      }

      res.json({
        success: true,
        count: agents.length,
        agents: agents.map(agent => ({
          id: agent.id,
          name: agent.name,
          status: agent.status,
          capabilities: agent.capabilities,
          currentTask: agent.currentTask,
          tasksCompleted: agent.tasksCompleted,
          tasksFailed: agent.tasksFailed,
          lastHeartbeat: agent.lastHeartbeat
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Send heartbeat from agent
   */
  router.post('/:id/heartbeat', (req, res, next) => {
    try {
      const agent = agentRegistry.heartbeat(req.params.id);

      res.json({
        success: true,
        agent: {
          id: agent.id,
          status: agent.status,
          lastHeartbeat: agent.lastHeartbeat
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get agent registry statistics
   */
  router.get('/stats/summary', (req, res, next) => {
    try {
      const stats = agentRegistry.getStats();

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // AgentManager Routes (Issue #2459 - Phase 2)
  // ============================================================================

  /**
   * Create a new task
   */
  router.post('/tasks', (req, res, next) => {
    try {
      if (!agentManager) {
        return res.status(501).json({ error: 'AgentManager not available' });
      }

      const { type, payload, requiredCapabilities, priority, metadata } = req.body;

      if (!type) {
        return res.status(400).json({ error: 'Task type is required' });
      }

      const task = agentManager.createTask({
        type,
        payload,
        requiredCapabilities,
        priority,
        metadata
      });

      res.status(201).json({
        success: true,
        task: {
          id: task.id,
          type: task.type,
          status: task.status,
          requiredCapabilities: task.requiredCapabilities,
          priority: task.priority,
          createdAt: task.createdAt
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get task by ID
   */
  router.get('/tasks/:taskId', (req, res, next) => {
    try {
      if (!agentManager) {
        return res.status(501).json({ error: 'AgentManager not available' });
      }

      const task = agentManager.getTask(req.params.taskId);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json({
        success: true,
        task
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get all tasks
   */
  router.get('/tasks', (req, res, next) => {
    try {
      if (!agentManager) {
        return res.status(501).json({ error: 'AgentManager not available' });
      }

      const { status } = req.query;

      const tasks = status
        ? agentManager.getTasksByStatus(status)
        : agentManager.getAllTasks();

      res.json({
        success: true,
        count: tasks.length,
        tasks
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Assign task to agent manually
   */
  router.post('/tasks/:taskId/assign', async (req, res, next) => {
    try {
      if (!agentManager) {
        return res.status(501).json({ error: 'AgentManager not available' });
      }

      const { agentId } = req.body;

      if (!agentId) {
        return res.status(400).json({ error: 'Agent ID is required' });
      }

      const task = await agentManager.assignTaskToAgent(req.params.taskId, agentId);

      res.json({
        success: true,
        task: {
          id: task.id,
          status: task.status,
          assignedAgentId: task.assignedAgentId,
          assignedAt: task.assignedAt
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Cancel a task
   */
  router.post('/tasks/:taskId/cancel', (req, res, next) => {
    try {
      if (!agentManager) {
        return res.status(501).json({ error: 'AgentManager not available' });
      }

      const task = agentManager.cancelTask(req.params.taskId);

      res.json({
        success: true,
        task: {
          id: task.id,
          status: task.status,
          completedAt: task.completedAt
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get agent statistics (from AgentManager)
   */
  router.get('/:id/stats', (req, res, next) => {
    try {
      if (!agentManager) {
        return res.status(501).json({ error: 'AgentManager not available' });
      }

      const stats = agentManager.getAgentStats(req.params.id);

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get AgentManager statistics
   */
  router.get('/manager/stats', (req, res, next) => {
    try {
      if (!agentManager) {
        return res.status(501).json({ error: 'AgentManager not available' });
      }

      const stats = agentManager.getStats();

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // MessageBus Routes (Issue #2459 - Phase 2)
  // ============================================================================

  /**
   * Send a message between agents
   */
  router.post('/messages/send', async (req, res, next) => {
    try {
      if (!messageBus) {
        return res.status(501).json({ error: 'MessageBus not available' });
      }

      const { fromAgentId, toAgentId, messageType, payload, options } = req.body;

      if (!fromAgentId || !toAgentId || !messageType) {
        return res.status(400).json({
          error: 'fromAgentId, toAgentId, and messageType are required'
        });
      }

      let message;

      switch (messageType) {
        case 'request':
          message = await messageBus.sendRequest(fromAgentId, toAgentId, payload, options);
          break;

        case 'notification':
          message = await messageBus.sendNotification(fromAgentId, toAgentId, payload, options);
          break;

        case 'handoff':
          message = await messageBus.sendHandoff(fromAgentId, toAgentId, payload, options);
          break;

        default:
          return res.status(400).json({ error: `Unknown message type: ${messageType}` });
      }

      res.status(201).json({
        success: true,
        message: {
          messageId: message.messageId,
          messageType: message.messageType,
          status: message.status,
          createdAt: message.createdAt
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Send response to a request
   */
  router.post('/messages/:messageId/respond', async (req, res, next) => {
    try {
      if (!messageBus) {
        return res.status(501).json({ error: 'MessageBus not available' });
      }

      const { fromAgentId, toAgentId, payload } = req.body;

      if (!fromAgentId || !toAgentId) {
        return res.status(400).json({ error: 'fromAgentId and toAgentId are required' });
      }

      const sent = await messageBus.sendResponse(
        req.params.messageId,
        fromAgentId,
        toAgentId,
        payload
      );

      res.json({
        success: true,
        sent
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Broadcast message to multiple agents
   */
  router.post('/messages/broadcast', async (req, res, next) => {
    try {
      if (!messageBus) {
        return res.status(501).json({ error: 'MessageBus not available' });
      }

      const { fromAgentId, toAgentIds, payload, options } = req.body;

      if (!fromAgentId || !toAgentIds || !Array.isArray(toAgentIds)) {
        return res.status(400).json({
          error: 'fromAgentId and toAgentIds (array) are required'
        });
      }

      const messages = await messageBus.broadcast(fromAgentId, toAgentIds, payload, options);

      res.status(201).json({
        success: true,
        messageCount: messages.length,
        messages: messages.map(m => ({
          messageId: m.messageId,
          to: m.to.agentId,
          status: m.status
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get message by ID
   */
  router.get('/messages/:messageId', (req, res, next) => {
    try {
      if (!messageBus) {
        return res.status(501).json({ error: 'MessageBus not available' });
      }

      const message = messageBus.getMessage(req.params.messageId);

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      res.json({
        success: true,
        message
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get conversation messages
   */
  router.get('/conversations/:conversationId/messages', (req, res, next) => {
    try {
      if (!messageBus) {
        return res.status(501).json({ error: 'MessageBus not available' });
      }

      const messages = messageBus.getConversationMessages(req.params.conversationId);

      res.json({
        success: true,
        count: messages.length,
        messages
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Acknowledge message receipt
   */
  router.post('/messages/:messageId/acknowledge', (req, res, next) => {
    try {
      if (!messageBus) {
        return res.status(501).json({ error: 'MessageBus not available' });
      }

      const { agentId } = req.body;

      if (!agentId) {
        return res.status(400).json({ error: 'Agent ID is required' });
      }

      const message = messageBus.acknowledgeMessage(req.params.messageId, agentId);

      res.json({
        success: true,
        message: {
          messageId: message.messageId,
          status: message.status,
          acknowledgedAt: message.acknowledgedAt,
          acknowledgedBy: message.acknowledgedBy
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get MessageBus statistics
   */
  router.get('/messages/stats/summary', (req, res, next) => {
    try {
      if (!messageBus) {
        return res.status(501).json({ error: 'MessageBus not available' });
      }

      const stats = messageBus.getStats();

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // Circuit Breaker Routes (Issue #2707 - Phase 3.2)
  // ============================================================================

  /**
   * Get all circuit breaker states
   */
  router.get('/circuit-breakers', (req, res, next) => {
    try {
      if (!messageBus) {
        return res.status(501).json({ error: 'MessageBus not available' });
      }

      const states = messageBus.getCircuitBreakerStates();

      res.json({
        success: true,
        count: Object.keys(states).length,
        circuitBreakers: states
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get circuit breaker state for specific agent
   */
  router.get('/circuit-breakers/:agentId', (req, res, next) => {
    try {
      if (!messageBus) {
        return res.status(501).json({ error: 'MessageBus not available' });
      }

      const states = messageBus.getCircuitBreakerStates();
      const state = states[req.params.agentId];

      if (!state) {
        return res.status(404).json({ error: 'Circuit breaker not found for this agent' });
      }

      res.json({
        success: true,
        circuitBreaker: state
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Reset a circuit breaker for specific agent
   */
  router.post('/circuit-breakers/:agentId/reset', (req, res, next) => {
    try {
      if (!messageBus) {
        return res.status(501).json({ error: 'MessageBus not available' });
      }

      const success = messageBus.resetCircuitBreaker(req.params.agentId);

      if (!success) {
        return res.status(404).json({ error: 'Circuit breaker not found for this agent' });
      }

      res.json({
        success: true,
        message: `Circuit breaker for agent ${req.params.agentId} has been reset`,
        agentId: req.params.agentId
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Reset all circuit breakers
   */
  router.post('/circuit-breakers/reset-all', (req, res, next) => {
    try {
      if (!messageBus) {
        return res.status(501).json({ error: 'MessageBus not available' });
      }

      const count = messageBus.resetAllCircuitBreakers();

      res.json({
        success: true,
        message: `Reset ${count} circuit breakers`,
        count
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get circuit breaker statistics
   */
  router.get('/circuit-breakers/stats/summary', (req, res, next) => {
    try {
      if (!messageBus) {
        return res.status(501).json({ error: 'MessageBus not available' });
      }

      const stats = messageBus.getStats();

      res.json({
        success: true,
        stats: stats.circuitBreakers
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
