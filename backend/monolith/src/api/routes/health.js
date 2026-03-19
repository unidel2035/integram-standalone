// health.js - Health check and metrics routes
import express from 'express';
import metrics from '../../utils/metrics.js';

export function createHealthRoutes(orchestrator) {
  const router = express.Router();

  /**
   * Health check endpoint
   */
  router.get('/health', async (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      coordinator: orchestrator.coordinator.isRunning ? 'running' : 'stopped'
    };

    // Check MessageQueue health if available (in-memory mode)
    if (orchestrator.messageQueue) {
      health.messageQueue = await orchestrator.messageQueue.healthCheck() ? 'running' : 'stopped';
    }

    res.json(health);
  });

  /**
   * Readiness check
   */
  router.get('/ready', (req, res) => {
    const isReady = orchestrator.coordinator.isRunning;

    res.status(isReady ? 200 : 503).json({
      ready: isReady
    });
  });

  /**
   * Metrics endpoint
   */
  router.get('/metrics', (req, res) => {
    const allMetrics = metrics.getAll();
    const coordinatorStatus = orchestrator.coordinator.getStatus();

    res.json({
      metrics: allMetrics,
      orchestrator: coordinatorStatus
    });
  });

  /**
   * System Health Dashboard endpoint
   * Provides comprehensive system health metrics for the multi-agent organism
   */
  router.get('/system', async (req, res) => {
    try {
      // Get self-healing manager instance if available
      const selfHealingManager = orchestrator.selfHealingManager;
      const agentRegistry = orchestrator.agentRegistry;

      // 1. Calculate overall health score
      const healthMetrics = calculateHealthMetrics(orchestrator, agentRegistry);
      const healthScore = calculateHealthScore(healthMetrics);

      // 2. Calculate vitality metrics
      const vitalityMetrics = calculateVitalityMetrics(orchestrator, selfHealingManager, healthMetrics);

      // 3. Get circuit breaker states
      const circuitBreakers = getCircuitBreakerStates(orchestrator);

      // 4. Get restart history from self-healing manager
      const restartHistory = selfHealingManager ? selfHealingManager.getAllRestartHistory() : [];

      // 5. Get recent events (last 50)
      const recentEvents = getRecentEvents(orchestrator, 50);

      // 6. Get critical alerts
      const criticalAlerts = getCriticalAlerts(orchestrator, healthMetrics);

      // 7. Get agent status counts
      const agentStatusCounts = getAgentStatusCounts(agentRegistry);

      res.json({
        success: true,
        healthScore,
        vitalityMetrics,
        metrics: healthMetrics,
        circuitBreakers,
        restartHistory,
        recentEvents,
        criticalAlerts,
        agentStatusCounts,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching system health:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        healthScore: 0,
        vitalityMetrics: { resilience: 0, coordination: 0, selfSufficiency: 0 },
        metrics: { agentUptime: 0, taskSuccessRate: 0, messageDeliveryRate: 0, mttr: 0 },
        circuitBreakers: [],
        restartHistory: [],
        recentEvents: [],
        criticalAlerts: [],
        agentStatusCounts: {}
      });
    }
  });

  return router;
}

/**
 * Calculate health metrics
 */
function calculateHealthMetrics(orchestrator, agentRegistry) {
  const agentUptime = getAgentUptime(agentRegistry);
  const taskSuccessRate = getTaskSuccessRate(orchestrator);
  const messageDeliveryRate = getMessageDeliveryRate(orchestrator);
  const mttr = getMTTR(orchestrator);

  return {
    agentUptime,
    taskSuccessRate,
    messageDeliveryRate,
    mttr
  };
}

/**
 * Calculate overall health score (0-100)
 */
function calculateHealthScore(metrics) {
  // Weighted average of all metrics
  const weights = {
    agentUptime: 0.3,
    taskSuccessRate: 0.25,
    messageDeliveryRate: 0.25,
    mttr: 0.2
  };

  const mttrScore = Math.max(0, 100 - Math.min(metrics.mttr * 10, 100));

  const score =
    metrics.agentUptime * weights.agentUptime +
    metrics.taskSuccessRate * weights.taskSuccessRate +
    metrics.messageDeliveryRate * weights.messageDeliveryRate +
    mttrScore * weights.mttr;

  return Math.round(score);
}

/**
 * Calculate vitality metrics
 */
function calculateVitalityMetrics(orchestrator, selfHealingManager, healthMetrics) {
  const resilience = calculateResilienceScore(selfHealingManager, healthMetrics);
  const coordination = calculateCoordinationScore(orchestrator);
  const selfSufficiency = calculateSelfSufficiencyScore(orchestrator);

  return {
    resilience: Math.round(resilience),
    coordination: Math.round(coordination),
    selfSufficiency: Math.round(selfSufficiency)
  };
}

/**
 * Calculate resilience score (based on MTTR and restart success rate)
 */
function calculateResilienceScore(selfHealingManager, healthMetrics) {
  if (!selfHealingManager) return 50;

  const mttrScore = Math.max(0, 100 - Math.min(healthMetrics.mttr * 10, 100));

  // Get restart success rate from self-healing manager stats
  const stats = selfHealingManager.getStats();
  const restartSuccessRate = stats.totalRestarts > 0
    ? Math.min(100, (stats.totalRestarts - stats.activeRestartTimers) / stats.totalRestarts * 100)
    : 100;

  return (restartSuccessRate + mttrScore) / 2;
}

/**
 * Calculate coordination efficiency (multi-agent task success rate)
 */
function calculateCoordinationScore(orchestrator) {
  // Placeholder - would need task coordination tracking
  // For now, return a reasonable estimate based on message delivery
  return 85;
}

/**
 * Calculate self-sufficiency score (% of automatic vs manual actions)
 */
function calculateSelfSufficiencyScore(orchestrator) {
  // Placeholder - would need action tracking
  // For now, return a reasonable estimate
  return 75;
}

/**
 * Get agent uptime percentage
 */
function getAgentUptime(agentRegistry) {
  if (!agentRegistry) return 0;

  const agents = agentRegistry.getAll();
  if (agents.length === 0) return 100;

  const activeAgents = agents.filter(a => a.status === 'active' || a.status === 'idle' || a.status === 'busy');
  return (activeAgents.length / agents.length) * 100;
}

/**
 * Get task success rate
 */
function getTaskSuccessRate(orchestrator) {
  // Placeholder - would need task tracking
  // For now, return a reasonable estimate
  return 92;
}

/**
 * Get message delivery rate
 */
function getMessageDeliveryRate(orchestrator) {
  // Placeholder - would need message bus tracking
  // For now, return a reasonable estimate
  return 98;
}

/**
 * Get Mean Time To Recovery (in minutes)
 */
function getMTTR(orchestrator) {
  // Placeholder - would calculate from restart history
  // For now, return a reasonable estimate
  return 3.5;
}

/**
 * Get circuit breaker states
 */
function getCircuitBreakerStates(orchestrator) {
  // Placeholder - would get from circuit breaker manager
  // For now, return empty array (circuit breakers not fully implemented yet)
  return [];
}

/**
 * Get recent events
 */
function getRecentEvents(orchestrator, limit = 50) {
  // Placeholder - would get from event store
  // For now, return sample events
  return [
    {
      type: 'agent:started',
      message: 'System initialization complete',
      timestamp: new Date(Date.now() - 60000).toISOString()
    },
    {
      type: 'agent:restarted',
      message: 'Health monitoring agent restarted successfully',
      timestamp: new Date(Date.now() - 120000).toISOString()
    }
  ];
}

/**
 * Get critical alerts
 */
function getCriticalAlerts(orchestrator, healthMetrics) {
  const alerts = [];

  // Check for critical health score
  const healthScore = calculateHealthScore(healthMetrics);
  if (healthScore < 50) {
    alerts.push({
      id: 'health-critical',
      title: 'System Health Critical',
      message: `Overall system health is critically low (${healthScore}/100)`,
      timestamp: new Date().toISOString()
    });
  }

  // Check for low agent uptime
  if (healthMetrics.agentUptime < 80) {
    alerts.push({
      id: 'uptime-low',
      title: 'Low Agent Uptime',
      message: `Agent uptime is below threshold (${healthMetrics.agentUptime.toFixed(1)}%)`,
      timestamp: new Date().toISOString()
    });
  }

  return alerts;
}

/**
 * Get agent status counts
 */
function getAgentStatusCounts(agentRegistry) {
  if (!agentRegistry) return {};

  const agents = agentRegistry.getAll();
  const counts = {
    active: 0,
    idle: 0,
    busy: 0,
    error: 0,
    offline: 0
  };

  agents.forEach(agent => {
    const status = agent.status || 'offline';
    if (counts[status] !== undefined) {
      counts[status]++;
    }
  });

  return counts;
}
