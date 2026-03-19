// memory-cache-agent.js - Memory and Cache Management Agent routes
// Issue #2491: API endpoints for cache management operations
import express from 'express';
import logger from '../../utils/logger.js';
import { MemoryCacheAgent } from '../../agents/MemoryCacheAgent.js';

/**
 * Create Memory Cache Agent routes
 * @param {Object} orchestrator - Orchestrator instance with agentManager
 * @returns {express.Router} Express router
 */
export function createMemoryCacheAgentRoutes(orchestrator) {
  const router = express.Router();
  const { agentManager } = orchestrator;

  // Get or create memory cache agent instance
  const getMemoryCacheAgent = () => {
    let agent = agentManager.getAgentByCapability('cache_manager');

    if (!agent) {
      // Create new agent if not exists
      agent = new MemoryCacheAgent({
        id: 'memory-cache-agent',
        maxSize: 5000,
        maxMemoryBytes: 200 * 1024 * 1024, // 200MB
        ttl: null // No default TTL
      });

      agentManager.registerAgent(agent);
      logger.info('MemoryCacheAgent created and registered');
    }

    return agent;
  };

  /**
   * GET /api/memory-cache/stats
   * Get cache statistics
   */
  router.get('/stats', async (req, res, next) => {
    try {
      const agent = getMemoryCacheAgent();
      const stats = await agent.execute({
        id: `stats-${Date.now()}`,
        type: 'get_stats'
      });

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get cache stats');
      next(error);
    }
  });

  /**
   * GET /api/memory-cache/:cacheName/:key
   * Get value from cache
   */
  router.get('/:cacheName/:key', async (req, res, next) => {
    try {
      const { cacheName, key } = req.params;
      const agent = getMemoryCacheAgent();

      const value = await agent.execute({
        id: `get-${Date.now()}`,
        type: 'get',
        payload: { key, cacheName }
      });

      if (value === undefined) {
        return res.status(404).json({
          success: false,
          error: 'Key not found or expired'
        });
      }

      res.json({
        success: true,
        data: {
          key,
          value,
          cacheName
        }
      });
    } catch (error) {
      logger.error({ error: error.message, key: req.params.key }, 'Failed to get cache value');
      next(error);
    }
  });

  /**
   * POST /api/memory-cache/:cacheName
   * Set value in cache
   */
  router.post('/:cacheName', async (req, res, next) => {
    try {
      const { cacheName } = req.params;
      const { key, value, ttl, size } = req.body;

      if (!key) {
        return res.status(400).json({
          success: false,
          error: 'Key is required'
        });
      }

      const agent = getMemoryCacheAgent();

      await agent.execute({
        id: `set-${Date.now()}`,
        type: 'set',
        payload: {
          key,
          value,
          options: {
            cacheName,
            ttl: ttl || null,
            size: size || undefined
          }
        }
      });

      res.json({
        success: true,
        message: 'Value cached successfully',
        data: {
          key,
          cacheName,
          ttl: ttl || null
        }
      });
    } catch (error) {
      logger.error({ error: error.message, key: req.body.key }, 'Failed to set cache value');
      next(error);
    }
  });

  /**
   * DELETE /api/memory-cache/:cacheName/:key
   * Delete key from cache
   */
  router.delete('/:cacheName/:key', async (req, res, next) => {
    try {
      const { cacheName, key } = req.params;
      const agent = getMemoryCacheAgent();

      const deleted = await agent.execute({
        id: `delete-${Date.now()}`,
        type: 'delete',
        payload: { key, cacheName }
      });

      res.json({
        success: true,
        deleted,
        key,
        cacheName
      });
    } catch (error) {
      logger.error({ error: error.message, key: req.params.key }, 'Failed to delete cache value');
      next(error);
    }
  });

  /**
   * POST /api/memory-cache/:cacheName/clear
   * Clear cache
   */
  router.post('/:cacheName/clear', async (req, res, next) => {
    try {
      const { cacheName } = req.params;
      const agent = getMemoryCacheAgent();

      const result = await agent.execute({
        id: `clear-${Date.now()}`,
        type: 'clear',
        payload: { cacheName }
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error: error.message, cacheName: req.params.cacheName }, 'Failed to clear cache');
      next(error);
    }
  });

  /**
   * POST /api/memory-cache/create
   * Create new cache namespace
   */
  router.post('/create', async (req, res, next) => {
    try {
      const { name, maxSize, maxMemoryBytes, ttl } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Cache name is required'
        });
      }

      const agent = getMemoryCacheAgent();

      const result = await agent.execute({
        id: `create-cache-${Date.now()}`,
        type: 'create_cache',
        payload: {
          name,
          config: {
            maxSize: maxSize || 1000,
            maxMemoryBytes: maxMemoryBytes || 100 * 1024 * 1024,
            ttl: ttl || null
          }
        }
      });

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error: error.message, name: req.body.name }, 'Failed to create cache');
      next(error);
    }
  });

  /**
   * POST /api/memory-cache/:cacheName/invalidate
   * Invalidate keys by pattern
   */
  router.post('/:cacheName/invalidate', async (req, res, next) => {
    try {
      const { cacheName } = req.params;
      const { pattern } = req.body;

      if (!pattern) {
        return res.status(400).json({
          success: false,
          error: 'Pattern is required'
        });
      }

      const agent = getMemoryCacheAgent();

      const result = await agent.execute({
        id: `invalidate-${Date.now()}`,
        type: 'invalidate_pattern',
        payload: { pattern, cacheName }
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error: error.message, pattern: req.body.pattern }, 'Failed to invalidate cache keys');
      next(error);
    }
  });

  /**
   * POST /api/memory-cache/:cacheName/warmup
   * Warm up cache
   */
  router.post('/:cacheName/warmup', async (req, res, next) => {
    try {
      const { cacheName } = req.params;
      const { keys } = req.body;

      const agent = getMemoryCacheAgent();

      const result = await agent.execute({
        id: `warmup-${Date.now()}`,
        type: 'warmup',
        payload: {
          cacheName,
          keys: keys || []
        }
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error: error.message, cacheName: req.params.cacheName }, 'Failed to warm up cache');
      next(error);
    }
  });

  /**
   * GET /api/memory-cache/:cacheName/lfu
   * Get least frequently used entries
   */
  router.get('/:cacheName/lfu', async (req, res, next) => {
    try {
      const { cacheName } = req.params;
      const count = parseInt(req.query.count) || 10;

      const agent = getMemoryCacheAgent();

      const entries = await agent.execute({
        id: `lfu-${Date.now()}`,
        type: 'get_lfu_entries',
        payload: { count, cacheName }
      });

      res.json({
        success: true,
        data: {
          cacheName,
          count,
          entries
        }
      });
    } catch (error) {
      logger.error({ error: error.message, cacheName: req.params.cacheName }, 'Failed to get LFU entries');
      next(error);
    }
  });

  /**
   * POST /api/memory-cache/cleanup
   * Cleanup expired entries
   */
  router.post('/cleanup', async (req, res, next) => {
    try {
      const agent = getMemoryCacheAgent();

      const result = await agent.execute({
        id: `cleanup-${Date.now()}`,
        type: 'cleanup_expired'
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to cleanup expired entries');
      next(error);
    }
  });

  /**
   * GET /api/memory-cache/memory-leak
   * Get memory leak detection status
   */
  router.get('/memory-leak', async (req, res, next) => {
    try {
      const agent = getMemoryCacheAgent();

      const result = await agent.execute({
        id: `leak-detection-${Date.now()}`,
        type: 'detect_leaks'
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get memory leak status');
      next(error);
    }
  });

  /**
   * GET /api/memory-cache/health
   * Health check endpoint
   */
  router.get('/health', async (req, res) => {
    try {
      const agent = getMemoryCacheAgent();
      const stats = await agent.execute({
        id: `health-${Date.now()}`,
        type: 'get_stats'
      });

      const healthy = stats.recommendations.filter(r => r.severity === 'critical').length === 0;

      res.json({
        success: true,
        healthy,
        stats: {
          totalCaches: stats.global.totalCaches,
          uptime: stats.global.uptimeMinutes,
          memoryLeak: stats.memoryLeak.trend?.potentialLeak || false
        },
        recommendations: stats.recommendations
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Health check failed');
      res.status(500).json({
        success: false,
        healthy: false,
        error: error.message
      });
    }
  });

  return router;
}
