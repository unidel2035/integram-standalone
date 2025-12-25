import EventEmitter from 'events';
import logger from '../../utils/logger.js';

/**
 * API Gateway Service
 *
 * Central entry point for all API requests with:
 * - Request routing and load balancing
 * - Authentication and authorization
 * - Rate limiting
 * - Request/response transformation
 * - API versioning
 * - API analytics and monitoring
 *
 * Metaphor: Acts as the "skin" of the organism - the boundary between external and internal
 *
 * Related to: Issue #2483
 */
export class ApiGatewayService extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      enableAnalytics: options.enableAnalytics !== false,
      enableLoadBalancing: options.enableLoadBalancing !== false,
      enableVersioning: options.enableVersioning !== false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      healthCheckInterval: options.healthCheckInterval || 30000,
      ...options
    };

    // Route registry: maps route patterns to backend services
    this.routes = new Map();

    // Service pool: available backend services for load balancing
    this.servicePool = new Map();

    // Analytics data: request metrics and monitoring
    this.analytics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        byRoute: new Map(),
        byMethod: new Map(),
        byStatusCode: new Map(),
        byService: new Map()
      },
      latency: {
        min: Infinity,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        samples: []
      },
      auth: {
        total: 0,
        successful: 0,
        failed: 0,
        byMethod: new Map()
      },
      rateLimit: {
        total: 0,
        blocked: 0,
        byIP: new Map(),
        byUser: new Map()
      },
      errors: {
        total: 0,
        byType: new Map(),
        byRoute: new Map(),
        recent: []
      }
    };

    // API version registry
    this.versions = new Map();
    this.defaultVersion = 'v1';

    // Load balancing state
    this.roundRobinCounters = new Map();

    // Health check interval
    this.healthCheckTimer = null;

    logger.info('API Gateway Service initialized', {
      analytics: this.options.enableAnalytics,
      loadBalancing: this.options.enableLoadBalancing,
      versioning: this.options.enableVersioning
    });
  }

  /**
   * Register a route with the gateway
   */
  registerRoute(pattern, config) {
    const route = {
      pattern,
      service: config.service,
      method: config.method || 'ALL',
      version: config.version || this.defaultVersion,
      auth: config.auth !== false,
      rateLimit: config.rateLimit || null,
      transform: config.transform || null,
      loadBalance: config.loadBalance !== false,
      retries: config.retries !== undefined ? config.retries : this.options.maxRetries,
      timeout: config.timeout || 30000,
      cache: config.cache || null,
      metadata: config.metadata || {}
    };

    const key = `${route.method}:${route.version}:${pattern}`;
    this.routes.set(key, route);

    logger.info('Route registered', {
      pattern,
      service: config.service,
      method: route.method,
      version: route.version
    });

    return route;
  }

  /**
   * Register a backend service for load balancing
   */
  registerService(name, config) {
    const service = {
      name,
      url: config.url,
      weight: config.weight || 1,
      healthy: true,
      lastHealthCheck: null,
      healthCheckUrl: config.healthCheckUrl || `${config.url}/health`,
      metadata: config.metadata || {},
      stats: {
        requests: 0,
        errors: 0,
        totalLatency: 0,
        avgLatency: 0
      }
    };

    if (!this.servicePool.has(name)) {
      this.servicePool.set(name, []);
    }

    this.servicePool.get(name).push(service);

    logger.info('Service registered', {
      name,
      url: config.url,
      weight: service.weight
    });

    return service;
  }

  /**
   * Find matching route for request
   */
  findRoute(method, path, version) {
    version = version || this.defaultVersion;

    // Try exact match first
    const exactKey = `${method}:${version}:${path}`;
    if (this.routes.has(exactKey)) {
      return this.routes.get(exactKey);
    }

    // Try ALL method match
    const allKey = `ALL:${version}:${path}`;
    if (this.routes.has(allKey)) {
      return this.routes.get(allKey);
    }

    // Try pattern matching
    for (const [key, route] of this.routes.entries()) {
      if ((route.method === method || route.method === 'ALL') &&
          route.version === version &&
          this.matchPattern(path, route.pattern)) {
        return route;
      }
    }

    return null;
  }

  /**
   * Match path against route pattern
   */
  matchPattern(path, pattern) {
    // Convert pattern to regex
    // /api/users/:id -> /api/users/([^/]+)
    const regexPattern = pattern
      .replace(/:[^/]+/g, '([^/]+)')
      .replace(/\*/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Select service instance for load balancing
   */
  selectService(serviceName, strategy = 'round-robin') {
    const instances = this.servicePool.get(serviceName);
    if (!instances || instances.length === 0) {
      return null;
    }

    // Filter to healthy instances
    const healthyInstances = instances.filter(s => s.healthy);
    if (healthyInstances.length === 0) {
      // Fallback to any instance if none are healthy
      return instances[0];
    }

    switch (strategy) {
      case 'round-robin':
        return this.roundRobinSelect(serviceName, healthyInstances);

      case 'least-connections':
        return this.leastConnectionsSelect(healthyInstances);

      case 'weighted':
        return this.weightedSelect(healthyInstances);

      case 'random':
        return healthyInstances[Math.floor(Math.random() * healthyInstances.length)];

      default:
        return healthyInstances[0];
    }
  }

  /**
   * Round-robin load balancing
   */
  roundRobinSelect(serviceName, instances) {
    if (!this.roundRobinCounters.has(serviceName)) {
      this.roundRobinCounters.set(serviceName, 0);
    }

    const counter = this.roundRobinCounters.get(serviceName);
    const selected = instances[counter % instances.length];

    this.roundRobinCounters.set(serviceName, counter + 1);

    return selected;
  }

  /**
   * Least connections load balancing
   */
  leastConnectionsSelect(instances) {
    return instances.reduce((min, instance) =>
      instance.stats.requests < min.stats.requests ? instance : min
    );
  }

  /**
   * Weighted load balancing
   */
  weightedSelect(instances) {
    const totalWeight = instances.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;

    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) {
        return instance;
      }
    }

    return instances[instances.length - 1];
  }

  /**
   * Record request metrics
   */
  recordRequest(route, method, statusCode, latency, error = null) {
    if (!this.options.enableAnalytics) {
      return;
    }

    const analytics = this.analytics;

    // Overall stats
    analytics.requests.total++;
    if (error) {
      analytics.requests.failed++;
    } else {
      analytics.requests.successful++;
    }

    // By route
    if (!analytics.requests.byRoute.has(route)) {
      analytics.requests.byRoute.set(route, { total: 0, successful: 0, failed: 0 });
    }
    const routeStats = analytics.requests.byRoute.get(route);
    routeStats.total++;
    if (error) {
      routeStats.failed++;
    } else {
      routeStats.successful++;
    }

    // By method
    if (!analytics.requests.byMethod.has(method)) {
      analytics.requests.byMethod.set(method, 0);
    }
    analytics.requests.byMethod.set(method, analytics.requests.byMethod.get(method) + 1);

    // By status code
    if (!analytics.requests.byStatusCode.has(statusCode)) {
      analytics.requests.byStatusCode.set(statusCode, 0);
    }
    analytics.requests.byStatusCode.set(statusCode, analytics.requests.byStatusCode.get(statusCode) + 1);

    // Latency
    if (latency) {
      analytics.latency.samples.push(latency);
      analytics.latency.min = Math.min(analytics.latency.min, latency);
      analytics.latency.max = Math.max(analytics.latency.max, latency);

      // Keep only last 1000 samples for percentile calculation
      if (analytics.latency.samples.length > 1000) {
        analytics.latency.samples.shift();
      }

      // Recalculate avg and percentiles
      this.calculateLatencyMetrics();
    }

    // Errors
    if (error) {
      analytics.errors.total++;

      const errorType = error.type || 'unknown';
      if (!analytics.errors.byType.has(errorType)) {
        analytics.errors.byType.set(errorType, 0);
      }
      analytics.errors.byType.set(errorType, analytics.errors.byType.get(errorType) + 1);

      if (!analytics.errors.byRoute.has(route)) {
        analytics.errors.byRoute.set(route, 0);
      }
      analytics.errors.byRoute.set(route, analytics.errors.byRoute.get(route) + 1);

      // Keep last 100 errors
      analytics.errors.recent.push({
        timestamp: new Date(),
        route,
        method,
        error: error.message || String(error)
      });
      if (analytics.errors.recent.length > 100) {
        analytics.errors.recent.shift();
      }
    }

    // Emit event
    this.emit('request', {
      route,
      method,
      statusCode,
      latency,
      error,
      timestamp: new Date()
    });
  }

  /**
   * Calculate latency percentiles
   */
  calculateLatencyMetrics() {
    const samples = [...this.analytics.latency.samples].sort((a, b) => a - b);

    if (samples.length === 0) {
      return;
    }

    this.analytics.latency.avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    this.analytics.latency.p50 = samples[Math.floor(samples.length * 0.5)];
    this.analytics.latency.p95 = samples[Math.floor(samples.length * 0.95)];
    this.analytics.latency.p99 = samples[Math.floor(samples.length * 0.99)];
  }

  /**
   * Record authentication attempt
   */
  recordAuth(method, success) {
    if (!this.options.enableAnalytics) {
      return;
    }

    const analytics = this.analytics.auth;
    analytics.total++;

    if (success) {
      analytics.successful++;
    } else {
      analytics.failed++;
    }

    if (!analytics.byMethod.has(method)) {
      analytics.byMethod.set(method, { total: 0, successful: 0, failed: 0 });
    }

    const methodStats = analytics.byMethod.get(method);
    methodStats.total++;
    if (success) {
      methodStats.successful++;
    } else {
      methodStats.failed++;
    }
  }

  /**
   * Record rate limit event
   */
  recordRateLimit(ip, user, blocked) {
    if (!this.options.enableAnalytics) {
      return;
    }

    const analytics = this.analytics.rateLimit;
    analytics.total++;

    if (blocked) {
      analytics.blocked++;
    }

    if (ip) {
      if (!analytics.byIP.has(ip)) {
        analytics.byIP.set(ip, { total: 0, blocked: 0 });
      }
      const ipStats = analytics.byIP.get(ip);
      ipStats.total++;
      if (blocked) {
        ipStats.blocked++;
      }
    }

    if (user) {
      if (!analytics.byUser.has(user)) {
        analytics.byUser.set(user, { total: 0, blocked: 0 });
      }
      const userStats = analytics.byUser.get(user);
      userStats.total++;
      if (blocked) {
        userStats.blocked++;
      }
    }
  }

  /**
   * Get analytics summary
   */
  getAnalytics() {
    return {
      requests: {
        total: this.analytics.requests.total,
        successful: this.analytics.requests.successful,
        failed: this.analytics.requests.failed,
        successRate: this.analytics.requests.total > 0
          ? (this.analytics.requests.successful / this.analytics.requests.total * 100).toFixed(2) + '%'
          : '0%',
        byRoute: Array.from(this.analytics.requests.byRoute.entries()).map(([route, stats]) => ({
          route,
          ...stats,
          successRate: stats.total > 0
            ? (stats.successful / stats.total * 100).toFixed(2) + '%'
            : '0%'
        })),
        byMethod: Object.fromEntries(this.analytics.requests.byMethod),
        byStatusCode: Object.fromEntries(this.analytics.requests.byStatusCode)
      },
      latency: {
        min: this.analytics.latency.min === Infinity ? 0 : this.analytics.latency.min,
        max: this.analytics.latency.max,
        avg: Math.round(this.analytics.latency.avg),
        p50: Math.round(this.analytics.latency.p50),
        p95: Math.round(this.analytics.latency.p95),
        p99: Math.round(this.analytics.latency.p99)
      },
      auth: {
        total: this.analytics.auth.total,
        successful: this.analytics.auth.successful,
        failed: this.analytics.auth.failed,
        successRate: this.analytics.auth.total > 0
          ? (this.analytics.auth.successful / this.analytics.auth.total * 100).toFixed(2) + '%'
          : '0%',
        byMethod: Array.from(this.analytics.auth.byMethod.entries()).map(([method, stats]) => ({
          method,
          ...stats
        }))
      },
      rateLimit: {
        total: this.analytics.rateLimit.total,
        blocked: this.analytics.rateLimit.blocked,
        blockRate: this.analytics.rateLimit.total > 0
          ? (this.analytics.rateLimit.blocked / this.analytics.rateLimit.total * 100).toFixed(2) + '%'
          : '0%'
      },
      errors: {
        total: this.analytics.errors.total,
        byType: Object.fromEntries(this.analytics.errors.byType),
        byRoute: Object.fromEntries(this.analytics.errors.byRoute),
        recent: this.analytics.errors.recent.slice(-10)
      }
    };
  }

  /**
   * Get service health status
   */
  getServiceHealth() {
    const services = [];

    for (const [name, instances] of this.servicePool.entries()) {
      for (const instance of instances) {
        services.push({
          name,
          url: instance.url,
          healthy: instance.healthy,
          lastHealthCheck: instance.lastHealthCheck,
          stats: {
            requests: instance.stats.requests,
            errors: instance.stats.errors,
            avgLatency: Math.round(instance.stats.avgLatency)
          }
        });
      }
    }

    return services;
  }

  /**
   * Get route configuration
   */
  getRoutes() {
    return Array.from(this.routes.entries()).map(([key, route]) => ({
      key,
      pattern: route.pattern,
      service: route.service,
      method: route.method,
      version: route.version,
      auth: route.auth,
      loadBalance: route.loadBalance,
      retries: route.retries,
      timeout: route.timeout
    }));
  }

  /**
   * Perform health check on all services
   */
  async healthCheck() {
    logger.debug('Performing health check on all services');

    for (const [name, instances] of this.servicePool.entries()) {
      for (const instance of instances) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(instance.healthCheckUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'DronDoc-API-Gateway/1.0' }
          });

          clearTimeout(timeout);

          instance.healthy = response.ok;
          instance.lastHealthCheck = new Date();

          logger.debug('Health check completed', {
            service: name,
            url: instance.url,
            healthy: instance.healthy
          });
        } catch (error) {
          instance.healthy = false;
          instance.lastHealthCheck = new Date();

          logger.warn('Health check failed', {
            service: name,
            url: instance.url,
            error: error.message
          });
        }
      }
    }

    this.emit('healthCheck', {
      timestamp: new Date(),
      services: this.getServiceHealth()
    });
  }

  /**
   * Start health check monitoring
   */
  startHealthChecks() {
    if (this.healthCheckTimer) {
      return;
    }

    logger.info('Starting health check monitoring', {
      interval: this.options.healthCheckInterval
    });

    this.healthCheckTimer = setInterval(() => {
      this.healthCheck().catch(error => {
        logger.error('Health check error', { error: error.message });
      });
    }, this.options.healthCheckInterval);

    // Run initial health check
    this.healthCheck().catch(error => {
      logger.error('Initial health check error', { error: error.message });
    });
  }

  /**
   * Stop health check monitoring
   */
  stopHealthChecks() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      logger.info('Stopped health check monitoring');
    }
  }

  /**
   * Reset analytics
   */
  resetAnalytics() {
    this.analytics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        byRoute: new Map(),
        byMethod: new Map(),
        byStatusCode: new Map(),
        byService: new Map()
      },
      latency: {
        min: Infinity,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        samples: []
      },
      auth: {
        total: 0,
        successful: 0,
        failed: 0,
        byMethod: new Map()
      },
      rateLimit: {
        total: 0,
        blocked: 0,
        byIP: new Map(),
        byUser: new Map()
      },
      errors: {
        total: 0,
        byType: new Map(),
        byRoute: new Map(),
        recent: []
      }
    };

    logger.info('Analytics reset');
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    this.stopHealthChecks();
    this.removeAllListeners();
    logger.info('API Gateway Service shutdown complete');
  }
}

export default ApiGatewayService;
