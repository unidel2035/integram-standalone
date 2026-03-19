import { Router } from 'express';
import { ApiGatewayService } from '../../services/gateway/ApiGatewayService.js';
import logger from '../../utils/logger.js';

const router = Router();

// Initialize API Gateway Service (singleton)
let gatewayService = null;

function getGatewayService() {
  if (!gatewayService) {
    gatewayService = new ApiGatewayService({
      enableAnalytics: true,
      enableLoadBalancing: true,
      enableVersioning: true
    });

    // Register some default routes
    registerDefaultRoutes();

    // Start health checks
    gatewayService.startHealthChecks();

    logger.info('API Gateway Service initialized and started');
  }
  return gatewayService;
}

/**
 * Register default routes for existing services
 */
function registerDefaultRoutes() {
  const service = getGatewayService();

  // YouTube Analytics
  service.registerRoute('/api/youtube/*', {
    service: 'youtube-analytics',
    version: 'v1',
    auth: true,
    loadBalance: true
  });

  // AI Tokens
  service.registerRoute('/api/ai-tokens/*', {
    service: 'ai-tokens',
    version: 'v1',
    auth: true,
    loadBalance: true
  });

  // Agricultural Services
  service.registerRoute('/api/agro/*', {
    service: 'agricultural',
    version: 'v1',
    auth: true,
    loadBalance: true
  });

  // Agents
  service.registerRoute('/api/agents/*', {
    service: 'agents',
    version: 'v1',
    auth: true,
    loadBalance: true
  });

  // MCP
  service.registerRoute('/api/mcp/*', {
    service: 'mcp',
    version: 'v1',
    auth: true,
    loadBalance: true
  });

  // Recording
  service.registerRoute('/api/recording/*', {
    service: 'recording',
    version: 'v1',
    auth: true,
    loadBalance: true
  });

  // Health (no auth required)
  service.registerRoute('/api/health', {
    service: 'health',
    version: 'v1',
    auth: false,
    loadBalance: false
  });

  // Register default service instances
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:8081';

  service.registerService('youtube-analytics', {
    url: baseUrl,
    weight: 1,
    healthCheckUrl: `${baseUrl}/api/health`
  });

  service.registerService('ai-tokens', {
    url: baseUrl,
    weight: 1,
    healthCheckUrl: `${baseUrl}/api/health`
  });

  service.registerService('agricultural', {
    url: baseUrl,
    weight: 1,
    healthCheckUrl: `${baseUrl}/api/health`
  });

  service.registerService('agents', {
    url: baseUrl,
    weight: 1,
    healthCheckUrl: `${baseUrl}/api/health`
  });

  service.registerService('mcp', {
    url: baseUrl,
    weight: 1,
    healthCheckUrl: `${baseUrl}/api/health`
  });

  service.registerService('recording', {
    url: baseUrl,
    weight: 1,
    healthCheckUrl: `${baseUrl}/api/health`
  });

  service.registerService('health', {
    url: baseUrl,
    weight: 1,
    healthCheckUrl: `${baseUrl}/api/health`
  });

  logger.info('Default routes and services registered');
}

/**
 * GET /api/gateway/status
 * Get gateway status and overview
 */
router.get('/status', (req, res) => {
  try {
    const service = getGatewayService();

    res.json({
      success: true,
      data: {
        status: 'running',
        uptime: process.uptime(),
        routes: service.getRoutes().length,
        services: service.getServiceHealth().length,
        analytics: service.getAnalytics(),
        healthChecks: {
          enabled: true,
          interval: service.options.healthCheckInterval
        }
      }
    });
  } catch (error) {
    logger.error('Error getting gateway status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get gateway status'
    });
  }
});

/**
 * GET /api/gateway/analytics
 * Get detailed analytics
 */
router.get('/analytics', (req, res) => {
  try {
    const service = getGatewayService();
    const analytics = service.getAnalytics();

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('Error getting gateway analytics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get gateway analytics'
    });
  }
});

/**
 * POST /api/gateway/analytics/reset
 * Reset analytics data
 */
router.post('/analytics/reset', (req, res) => {
  try {
    const service = getGatewayService();
    service.resetAnalytics();

    res.json({
      success: true,
      message: 'Analytics reset successfully'
    });
  } catch (error) {
    logger.error('Error resetting analytics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to reset analytics'
    });
  }
});

/**
 * GET /api/gateway/routes
 * Get all registered routes
 */
router.get('/routes', (req, res) => {
  try {
    const service = getGatewayService();
    const routes = service.getRoutes();

    res.json({
      success: true,
      data: routes
    });
  } catch (error) {
    logger.error('Error getting routes', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get routes'
    });
  }
});

/**
 * POST /api/gateway/routes
 * Register a new route
 */
router.post('/routes', (req, res) => {
  try {
    const { pattern, service, method, version, auth, loadBalance, retries, timeout } = req.body;

    if (!pattern || !service) {
      return res.status(400).json({
        success: false,
        error: 'Pattern and service are required'
      });
    }

    const gateway = getGatewayService();
    const route = gateway.registerRoute(pattern, {
      service,
      method: method || 'ALL',
      version: version || 'v1',
      auth: auth !== false,
      loadBalance: loadBalance !== false,
      retries: retries !== undefined ? retries : 3,
      timeout: timeout || 30000
    });

    res.json({
      success: true,
      data: route
    });
  } catch (error) {
    logger.error('Error registering route', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to register route'
    });
  }
});

/**
 * GET /api/gateway/services
 * Get all registered services with health status
 */
router.get('/services', (req, res) => {
  try {
    const service = getGatewayService();
    const services = service.getServiceHealth();

    res.json({
      success: true,
      data: services
    });
  } catch (error) {
    logger.error('Error getting services', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get services'
    });
  }
});

/**
 * POST /api/gateway/services
 * Register a new service instance
 */
router.post('/services', (req, res) => {
  try {
    const { name, url, weight, healthCheckUrl } = req.body;

    if (!name || !url) {
      return res.status(400).json({
        success: false,
        error: 'Name and URL are required'
      });
    }

    const gateway = getGatewayService();
    const service = gateway.registerService(name, {
      url,
      weight: weight || 1,
      healthCheckUrl: healthCheckUrl || `${url}/health`
    });

    res.json({
      success: true,
      data: service
    });
  } catch (error) {
    logger.error('Error registering service', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to register service'
    });
  }
});

/**
 * POST /api/gateway/health-check
 * Trigger manual health check
 */
router.post('/health-check', async (req, res) => {
  try {
    const service = getGatewayService();
    await service.healthCheck();

    const services = service.getServiceHealth();

    res.json({
      success: true,
      data: services
    });
  } catch (error) {
    logger.error('Error performing health check', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to perform health check'
    });
  }
});

/**
 * GET /api/gateway/metrics
 * Get metrics in Prometheus format (for monitoring integration)
 */
router.get('/metrics', (req, res) => {
  try {
    const service = getGatewayService();
    const analytics = service.getAnalytics();

    // Format metrics in Prometheus exposition format
    const metrics = [];

    // Request metrics
    metrics.push(`# HELP api_gateway_requests_total Total number of requests`);
    metrics.push(`# TYPE api_gateway_requests_total counter`);
    metrics.push(`api_gateway_requests_total ${analytics.requests.total}`);

    metrics.push(`# HELP api_gateway_requests_successful Successful requests`);
    metrics.push(`# TYPE api_gateway_requests_successful counter`);
    metrics.push(`api_gateway_requests_successful ${analytics.requests.successful}`);

    metrics.push(`# HELP api_gateway_requests_failed Failed requests`);
    metrics.push(`# TYPE api_gateway_requests_failed counter`);
    metrics.push(`api_gateway_requests_failed ${analytics.requests.failed}`);

    // Latency metrics
    metrics.push(`# HELP api_gateway_latency_milliseconds Request latency`);
    metrics.push(`# TYPE api_gateway_latency_milliseconds summary`);
    metrics.push(`api_gateway_latency_milliseconds{quantile="0.5"} ${analytics.latency.p50}`);
    metrics.push(`api_gateway_latency_milliseconds{quantile="0.95"} ${analytics.latency.p95}`);
    metrics.push(`api_gateway_latency_milliseconds{quantile="0.99"} ${analytics.latency.p99}`);

    // Auth metrics
    metrics.push(`# HELP api_gateway_auth_total Total authentication attempts`);
    metrics.push(`# TYPE api_gateway_auth_total counter`);
    metrics.push(`api_gateway_auth_total ${analytics.auth.total}`);

    metrics.push(`# HELP api_gateway_auth_failed Failed authentication attempts`);
    metrics.push(`# TYPE api_gateway_auth_failed counter`);
    metrics.push(`api_gateway_auth_failed ${analytics.auth.failed}`);

    // Rate limit metrics
    metrics.push(`# HELP api_gateway_rate_limit_blocked Blocked requests due to rate limiting`);
    metrics.push(`# TYPE api_gateway_rate_limit_blocked counter`);
    metrics.push(`api_gateway_rate_limit_blocked ${analytics.rateLimit.blocked}`);

    // Error metrics
    metrics.push(`# HELP api_gateway_errors_total Total errors`);
    metrics.push(`# TYPE api_gateway_errors_total counter`);
    metrics.push(`api_gateway_errors_total ${analytics.errors.total}`);

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics.join('\n') + '\n');
  } catch (error) {
    logger.error('Error generating metrics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to generate metrics'
    });
  }
});

/**
 * POST /api/gateway/record-request
 * Manually record a request (for integration with other middleware)
 */
router.post('/record-request', (req, res) => {
  try {
    const { route, method, statusCode, latency, error } = req.body;

    if (!route || !method || !statusCode) {
      return res.status(400).json({
        success: false,
        error: 'Route, method, and statusCode are required'
      });
    }

    const service = getGatewayService();
    service.recordRequest(route, method, statusCode, latency, error);

    res.json({
      success: true,
      message: 'Request recorded'
    });
  } catch (error) {
    logger.error('Error recording request', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to record request'
    });
  }
});

/**
 * POST /api/gateway/record-auth
 * Manually record an authentication attempt
 */
router.post('/record-auth', (req, res) => {
  try {
    const { method, success } = req.body;

    if (!method || success === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Method and success are required'
      });
    }

    const service = getGatewayService();
    service.recordAuth(method, success);

    res.json({
      success: true,
      message: 'Auth attempt recorded'
    });
  } catch (error) {
    logger.error('Error recording auth', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to record auth'
    });
  }
});

/**
 * POST /api/gateway/record-rate-limit
 * Manually record a rate limit event
 */
router.post('/record-rate-limit', (req, res) => {
  try {
    const { ip, user, blocked } = req.body;

    if (blocked === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Blocked status is required'
      });
    }

    const service = getGatewayService();
    service.recordRateLimit(ip, user, blocked);

    res.json({
      success: true,
      message: 'Rate limit event recorded'
    });
  } catch (error) {
    logger.error('Error recording rate limit', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to record rate limit'
    });
  }
});

/**
 * Create and export router factory function
 */
export function createApiGatewayRoutes() {
  return router;
}

export default router;
