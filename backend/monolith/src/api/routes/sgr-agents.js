/**
 * SGR Agents API Routes
 *
 * RESTful API for Schema-Guided Reasoning agents
 * Compatible with OpenAI chat completions API
 */

import express from 'express';
import { SGRResearchAgent } from '../../agents/SGRResearchAgent.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// In-memory storage for active agents (TODO: move to Redis or database)
const activeAgents = new Map();

/**
 * Health check
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'sgr-agents',
    timestamp: new Date().toISOString(),
    active_agents: activeAgents.size
  });
});

/**
 * List available agent models
 */
router.get('/v1/models', (req, res) => {
  res.json({
    object: 'list',
    data: [
      {
        id: 'sgr-research',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'dronedoc',
        description: 'Schema-Guided Reasoning research agent'
      }
    ]
  });
});

/**
 * Get agent state
 */
router.get('/agents/:agentId/state', (req, res) => {
  const { agentId } = req.params;

  const agent = activeAgents.get(agentId);

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const state = agent.getState();

  res.json({
    success: true,
    data: state
  });
});

/**
 * List all active agents
 */
router.get('/agents', (req, res) => {
  const agents = Array.from(activeAgents.values()).map(agent => agent.getState());

  res.json({
    success: true,
    data: {
      agents,
      total: agents.length
    }
  });
});

/**
 * Provide clarification to agent
 */
router.post('/agents/:agentId/clarification', async (req, res) => {
  const { agentId } = req.params;
  const { clarifications } = req.body;

  if (!clarifications) {
    return res.status(400).json({ error: 'Clarifications text is required' });
  }

  const agent = activeAgents.get(agentId);

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  try {
    await agent.provideClarification(clarifications);

    res.json({
      success: true,
      message: 'Clarification provided',
      agent_id: agentId
    });

  } catch (error) {
    logger.error('Error providing clarification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create chat completion (OpenAI-compatible)
 *
 * POST /v1/chat/completions
 * Body: { model, messages, stream }
 */
router.post('/v1/chat/completions', async (req, res) => {
  const { model, messages, stream = false } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  // Extract task from messages (last user message)
  let task = '';
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      task = messages[i].content;
      break;
    }
  }

  if (!task) {
    return res.status(400).json({ error: 'No user message found in messages' });
  }

  try {
    // Create agent
    const agent = new SGRResearchAgent(task, {
      openai_api_key: process.env.OPENAI_API_KEY,
      openai_base_url: process.env.OPENAI_BASE_URL,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      tavily_api_key: process.env.TAVILY_API_KEY,
      max_iterations: 15,
      max_clarifications: 2,
      max_searches: 8
    });

    // Store agent
    activeAgents.set(agent.id, agent);

    // Set up event handlers
    const events = [];

    agent.on('start', (data) => {
      events.push({ type: 'start', ...data });
    });

    agent.on('clarification_needed', (data) => {
      events.push({ type: 'clarification_needed', ...data });
    });

    agent.on('completed', (data) => {
      events.push({ type: 'completed', ...data });
    });

    agent.on('error', (data) => {
      events.push({ type: 'error', ...data });
    });

    // If streaming requested
    if (stream) {
      // Set response headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Agent-ID', agent.id);

      // Send initial response
      res.write(`data: ${JSON.stringify({
        id: agent.id,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: model || 'sgr-research',
        choices: [{
          index: 0,
          delta: { role: 'assistant', content: '' },
          finish_reason: null
        }]
      })}\n\n`);

      // Send events as they occur
      agent.on('start', () => {
        res.write(`data: ${JSON.stringify({
          id: agent.id,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: model || 'sgr-research',
          choices: [{
            index: 0,
            delta: { content: `Starting research: ${task.substring(0, 100)}...\n\n` },
            finish_reason: null
          }]
        })}\n\n`);
      });

      agent.on('log', (log) => {
        if (log.step_type === 'tool_execution') {
          res.write(`data: ${JSON.stringify({
            id: agent.id,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model || 'sgr-research',
            choices: [{
              index: 0,
              delta: { content: `Tool: ${log.tool_name}\n` },
              finish_reason: null
            }]
          })}\n\n`);
        }
      });

      agent.on('clarification_needed', (data) => {
        res.write(`data: ${JSON.stringify({
          id: agent.id,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: model || 'sgr-research',
          choices: [{
            index: 0,
            delta: { content: `\n\n**Clarification Needed:**\n${data.question}\n\n` },
            finish_reason: null
          }]
        })}\n\n`);
      });

      agent.on('completed', (data) => {
        const finalContent = data.final_answer || 'Research completed';

        res.write(`data: ${JSON.stringify({
          id: agent.id,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: model || 'sgr-research',
          choices: [{
            index: 0,
            delta: { content: `\n\n${finalContent}\n\n` },
            finish_reason: 'stop'
          }]
        })}\n\n`);

        res.write('data: [DONE]\n\n');
        res.end();
      });

      agent.on('error', (data) => {
        res.write(`data: ${JSON.stringify({
          id: agent.id,
          object: 'error',
          error: { message: data.error }
        })}\n\n`);
        res.end();
      });

      // Execute agent (async, sends events as it runs)
      agent.execute().catch(error => {
        logger.error('Agent execution error:', error);
      });

    } else {
      // Non-streaming: wait for completion
      await agent.execute();

      const state = agent.getState();
      const lastMessage = agent.conversation[agent.conversation.length - 1];

      res.json({
        id: agent.id,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model || 'sgr-research',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: lastMessage?.content || 'Research completed'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        },
        metadata: {
          agent_id: agent.id,
          state: state.state,
          iterations: state.iteration,
          sources: state.sources_count
        }
      });
    }

  } catch (error) {
    logger.error('Error creating chat completion:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Cleanup old agents periodically
 */
setInterval(() => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour

  for (const [id, agent] of activeAgents.entries()) {
    const age = now - agent.creation_time.getTime();

    if (age > maxAge) {
      activeAgents.delete(id);
      logger.info(`Cleaned up old agent: ${id}`);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

export default router;
