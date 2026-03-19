// anomaly-detection.js - API routes for Anomaly Detection Agent
import express from 'express';
import { AnomalyDetectionAgent } from '../../agents/AnomalyDetectionAgent.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Create a singleton instance of the agent
let agent = null;

/**
 * Get or create agent instance
 */
function getAgent() {
  if (!agent) {
    agent = new AnomalyDetectionAgent({
      id: 'anomaly-detection-agent-001',
      config: {
        detectionThreshold: 0.7,
        ddosThreshold: 100,
        maxFailedLogins: 5,
        suspiciousActivityWindow: 300000,
        alertChannels: ['console'] // Can be extended to ['console', 'slack', 'telegram']
      }
    });
    agent.initialize();
  }
  return agent;
}

/**
 * GET /api/anomaly-detection/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  try {
    const agentInstance = getAgent();
    res.json({
      success: true,
      status: 'healthy',
      agent: {
        id: agentInstance.id,
        name: agentInstance.name,
        isProcessing: agentInstance.isProcessing
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Health check failed');
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error.message
    });
  }
});

/**
 * POST /api/anomaly-detection/analyze-traffic
 * Analyze traffic patterns for anomalies
 */
router.post('/analyze-traffic', async (req, res) => {
  try {
    const agentInstance = getAgent();
    const { requestsPerSecond, avgResponseTime, errorRate } = req.body;

    const result = await agentInstance.processTask({
      id: `traffic-analysis-${Date.now()}`,
      payload: {
        type: 'analyze_traffic',
        data: {
          requestsPerSecond: requestsPerSecond || 0,
          avgResponseTime: avgResponseTime || 0,
          errorRate: errorRate || 0
        }
      }
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Traffic analysis failed');
    res.status(500).json({
      success: false,
      error: 'Traffic analysis failed',
      message: error.message
    });
  }
});

/**
 * POST /api/anomaly-detection/check-ddos
 * Check for DDoS attacks
 */
router.post('/check-ddos', async (req, res) => {
  try {
    const agentInstance = getAgent();
    const { requestsPerSecond, sourceIPs, requestPatterns } = req.body;

    const result = await agentInstance.processTask({
      id: `ddos-check-${Date.now()}`,
      payload: {
        type: 'check_ddos',
        data: {
          requestsPerSecond: requestsPerSecond || 0,
          sourceIPs: sourceIPs || [],
          requestPatterns: requestPatterns || {}
        }
      }
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'DDoS check failed');
    res.status(500).json({
      success: false,
      error: 'DDoS check failed',
      message: error.message
    });
  }
});

/**
 * POST /api/anomaly-detection/analyze-user-behavior
 * Analyze user behavior for anomalies
 */
router.post('/analyze-user-behavior', async (req, res) => {
  try {
    const agentInstance = getAgent();
    const { userId, actions, timestamp } = req.body;

    const result = await agentInstance.processTask({
      id: `user-behavior-${Date.now()}`,
      payload: {
        type: 'analyze_user_behavior',
        data: {
          userId: userId || 'unknown',
          actions: actions || [],
          timestamp: timestamp || Date.now()
        }
      }
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'User behavior analysis failed');
    res.status(500).json({
      success: false,
      error: 'User behavior analysis failed',
      message: error.message
    });
  }
});

/**
 * POST /api/anomaly-detection/detect-anomalies
 * ML-based anomaly detection on data points
 */
router.post('/detect-anomalies', async (req, res) => {
  try {
    const agentInstance = getAgent();
    const { dataPoints } = req.body;

    const result = await agentInstance.processTask({
      id: `anomaly-detection-${Date.now()}`,
      payload: {
        type: 'detect_anomalies',
        data: dataPoints || []
      }
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Anomaly detection failed');
    res.status(500).json({
      success: false,
      error: 'Anomaly detection failed',
      message: error.message
    });
  }
});

/**
 * GET /api/anomaly-detection/alerts
 * Get recent alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const agentInstance = getAgent();
    const { limit, severity, type } = req.query;

    const result = await agentInstance.processTask({
      id: `get-alerts-${Date.now()}`,
      payload: {
        type: 'get_alerts',
        data: {
          limit: parseInt(limit) || 50,
          severity,
          type
        }
      }
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get alerts');
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts',
      message: error.message
    });
  }
});

/**
 * GET /api/anomaly-detection/stats
 * Get agent statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const agentInstance = getAgent();

    const result = await agentInstance.processTask({
      id: `get-stats-${Date.now()}`,
      payload: {
        type: 'get_stats',
        data: {}
      }
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get stats');
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
      message: error.message
    });
  }
});

/**
 * POST /api/anomaly-detection/report-false-positive
 * Report a false positive for learning
 */
router.post('/report-false-positive', (req, res) => {
  try {
    const agentInstance = getAgent();
    const { anomalyId } = req.body;

    const result = agentInstance.reportFalsePositive(anomalyId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to report false positive');
    res.status(500).json({
      success: false,
      error: 'Failed to report false positive',
      message: error.message
    });
  }
});

/**
 * POST /api/anomaly-detection/report-true-positive
 * Report a true positive for metrics
 */
router.post('/report-true-positive', (req, res) => {
  try {
    const agentInstance = getAgent();
    const { anomalyId } = req.body;

    const result = agentInstance.reportTruePositive(anomalyId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to report true positive');
    res.status(500).json({
      success: false,
      error: 'Failed to report true positive',
      message: error.message
    });
  }
});

/**
 * POST /api/anomaly-detection/simulate-attack
 * Simulate various attack scenarios (for testing)
 */
router.post('/simulate-attack', async (req, res) => {
  try {
    const agentInstance = getAgent();
    const { attackType } = req.body;

    let simulationData;

    switch (attackType) {
      case 'ddos':
        simulationData = {
          requestsPerSecond: 500,
          sourceIPs: Array.from({ length: 50 }, (_, i) => `192.168.1.${i}`),
          requestPatterns: { uniform: true }
        };
        break;

      case 'brute_force':
        simulationData = {
          userId: 'test-user-123',
          actions: Array.from({ length: 10 }, () => ({
            type: 'login_failed',
            timestamp: Date.now()
          })),
          timestamp: Date.now() - 60000
        };
        break;

      case 'data_exfiltration':
        simulationData = {
          userId: 'test-user-456',
          actions: Array.from({ length: 20 }, () => ({
            type: 'download',
            size: 10 * 1024 * 1024, // 10MB each
            timestamp: Date.now()
          })),
          timestamp: Date.now() - 60000
        };
        break;

      case 'traffic_spike':
        simulationData = {
          requestsPerSecond: 150,
          avgResponseTime: 800,
          errorRate: 0.05
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Unknown attack type',
          supportedTypes: ['ddos', 'brute_force', 'data_exfiltration', 'traffic_spike']
        });
    }

    const taskType = attackType === 'ddos' ? 'check_ddos' :
                     attackType === 'traffic_spike' ? 'analyze_traffic' :
                     'analyze_user_behavior';

    const result = await agentInstance.processTask({
      id: `simulation-${attackType}-${Date.now()}`,
      payload: {
        type: taskType,
        data: simulationData
      }
    });

    res.json({
      success: true,
      attackType,
      simulation: true,
      ...result
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Attack simulation failed');
    res.status(500).json({
      success: false,
      error: 'Attack simulation failed',
      message: error.message
    });
  }
});

export default router;
