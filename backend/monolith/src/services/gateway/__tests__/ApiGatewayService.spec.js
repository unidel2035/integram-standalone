import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiGatewayService } from '../ApiGatewayService.js';

describe('ApiGatewayService', () => {
  let service;

  beforeEach(() => {
    service = new ApiGatewayService({
      enableAnalytics: true,
      enableLoadBalancing: true,
      enableVersioning: true,
      maxRetries: 3,
      healthCheckInterval: 5000
    });
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Route Registration', () => {
    it('should register a route successfully', () => {
      const route = service.registerRoute('/api/test', {
        service: 'test-service',
        method: 'GET',
        version: 'v1',
        auth: true
      });

      expect(route).toBeDefined();
      expect(route.pattern).toBe('/api/test');
      expect(route.service).toBe('test-service');
      expect(route.method).toBe('GET');
      expect(route.version).toBe('v1');
      expect(route.auth).toBe(true);
    });

    it('should find registered route', () => {
      service.registerRoute('/api/users', {
        service: 'user-service',
        method: 'GET',
        version: 'v1'
      });

      const found = service.findRoute('GET', '/api/users', 'v1');
      expect(found).toBeDefined();
      expect(found.service).toBe('user-service');
    });

    it('should match route patterns with parameters', () => {
      service.registerRoute('/api/users/:id', {
        service: 'user-service',
        method: 'GET',
        version: 'v1'
      });

      const found = service.findRoute('GET', '/api/users/123', 'v1');
      expect(found).toBeDefined();
      expect(found.service).toBe('user-service');
    });

    it('should match ALL method routes', () => {
      service.registerRoute('/api/health', {
        service: 'health-service',
        method: 'ALL',
        version: 'v1',
        auth: false
      });

      const getRoute = service.findRoute('GET', '/api/health', 'v1');
      const postRoute = service.findRoute('POST', '/api/health', 'v1');

      expect(getRoute).toBeDefined();
      expect(postRoute).toBeDefined();
      expect(getRoute.service).toBe('health-service');
      expect(postRoute.service).toBe('health-service');
    });

    it('should return null for non-existent route', () => {
      const found = service.findRoute('GET', '/api/nonexistent', 'v1');
      expect(found).toBeNull();
    });
  });

  describe('Service Registration', () => {
    it('should register a service successfully', () => {
      const serviceInstance = service.registerService('test-service', {
        url: 'http://localhost:3000',
        weight: 1,
        healthCheckUrl: 'http://localhost:3000/health'
      });

      expect(serviceInstance).toBeDefined();
      expect(serviceInstance.name).toBe('test-service');
      expect(serviceInstance.url).toBe('http://localhost:3000');
      expect(serviceInstance.healthy).toBe(true);
    });

    it('should register multiple instances of same service', () => {
      service.registerService('api-service', {
        url: 'http://localhost:3001',
        weight: 1
      });

      service.registerService('api-service', {
        url: 'http://localhost:3002',
        weight: 2
      });

      const instances = service.servicePool.get('api-service');
      expect(instances).toHaveLength(2);
    });
  });

  describe('Load Balancing', () => {
    beforeEach(() => {
      service.registerService('api-service', {
        url: 'http://localhost:3001',
        weight: 1
      });

      service.registerService('api-service', {
        url: 'http://localhost:3002',
        weight: 1
      });

      service.registerService('api-service', {
        url: 'http://localhost:3003',
        weight: 2
      });
    });

    it('should select service using round-robin', () => {
      const selected1 = service.selectService('api-service', 'round-robin');
      const selected2 = service.selectService('api-service', 'round-robin');
      const selected3 = service.selectService('api-service', 'round-robin');

      expect(selected1).toBeDefined();
      expect(selected2).toBeDefined();
      expect(selected3).toBeDefined();

      // Should rotate through instances
      expect(selected1.url).not.toBe(selected2.url);
    });

    it('should select service using random', () => {
      const selected = service.selectService('api-service', 'random');
      expect(selected).toBeDefined();
      expect(selected.url).toMatch(/http:\/\/localhost:300[123]/);
    });

    it('should return null for non-existent service', () => {
      const selected = service.selectService('nonexistent', 'round-robin');
      expect(selected).toBeNull();
    });

    it('should filter out unhealthy instances', () => {
      const instances = service.servicePool.get('api-service');
      instances[0].healthy = false;

      const selected = service.selectService('api-service', 'round-robin');

      expect(selected).toBeDefined();
      expect(selected.healthy).toBe(true);
      expect(selected.url).not.toBe('http://localhost:3001');
    });
  });

  describe('Analytics', () => {
    it('should record request metrics', () => {
      service.recordRequest('/api/users', 'GET', 200, 150);

      const analytics = service.getAnalytics();

      expect(analytics.requests.total).toBe(1);
      expect(analytics.requests.successful).toBe(1);
      expect(analytics.requests.failed).toBe(0);
    });

    it('should record failed requests', () => {
      service.recordRequest('/api/users', 'GET', 500, 250, new Error('Server error'));

      const analytics = service.getAnalytics();

      expect(analytics.requests.total).toBe(1);
      expect(analytics.requests.successful).toBe(0);
      expect(analytics.requests.failed).toBe(1);
      expect(analytics.errors.total).toBe(1);
    });

    it('should track requests by route', () => {
      service.recordRequest('/api/users', 'GET', 200, 100);
      service.recordRequest('/api/users', 'GET', 200, 120);
      service.recordRequest('/api/posts', 'GET', 200, 80);

      const analytics = service.getAnalytics();

      const usersRoute = analytics.requests.byRoute.find(r => r.route === '/api/users');
      const postsRoute = analytics.requests.byRoute.find(r => r.route === '/api/posts');

      expect(usersRoute.total).toBe(2);
      expect(postsRoute.total).toBe(1);
    });

    it('should track requests by method', () => {
      service.recordRequest('/api/users', 'GET', 200, 100);
      service.recordRequest('/api/users', 'POST', 201, 150);
      service.recordRequest('/api/posts', 'GET', 200, 90);

      const analytics = service.getAnalytics();

      expect(analytics.requests.byMethod.GET).toBe(2);
      expect(analytics.requests.byMethod.POST).toBe(1);
    });

    it('should calculate latency metrics', () => {
      service.recordRequest('/api/users', 'GET', 200, 100);
      service.recordRequest('/api/users', 'GET', 200, 200);
      service.recordRequest('/api/users', 'GET', 200, 150);

      const analytics = service.getAnalytics();

      expect(analytics.latency.min).toBe(100);
      expect(analytics.latency.max).toBe(200);
      expect(analytics.latency.avg).toBeGreaterThan(0);
    });

    it('should record authentication attempts', () => {
      service.recordAuth('jwt', true);
      service.recordAuth('jwt', true);
      service.recordAuth('jwt', false);

      const analytics = service.getAnalytics();

      expect(analytics.auth.total).toBe(3);
      expect(analytics.auth.successful).toBe(2);
      expect(analytics.auth.failed).toBe(1);
    });

    it('should record rate limit events', () => {
      service.recordRateLimit('192.168.1.1', 'user123', false);
      service.recordRateLimit('192.168.1.1', 'user123', true);
      service.recordRateLimit('192.168.1.2', 'user456', true);

      const analytics = service.getAnalytics();

      expect(analytics.rateLimit.total).toBe(3);
      expect(analytics.rateLimit.blocked).toBe(2);
    });

    it('should reset analytics', () => {
      service.recordRequest('/api/users', 'GET', 200, 100);
      service.resetAnalytics();

      const analytics = service.getAnalytics();

      expect(analytics.requests.total).toBe(0);
    });
  });

  describe('Pattern Matching', () => {
    it('should match exact path', () => {
      expect(service.matchPattern('/api/users', '/api/users')).toBe(true);
    });

    it('should match path with parameter', () => {
      expect(service.matchPattern('/api/users/123', '/api/users/:id')).toBe(true);
    });

    it('should match path with multiple parameters', () => {
      expect(service.matchPattern('/api/users/123/posts/456', '/api/users/:userId/posts/:postId')).toBe(true);
    });

    it('should match wildcard path', () => {
      expect(service.matchPattern('/api/users/anything/here', '/api/users/*')).toBe(true);
    });

    it('should not match different path', () => {
      expect(service.matchPattern('/api/posts', '/api/users')).toBe(false);
    });
  });

  describe('Route Configuration', () => {
    it('should get all registered routes', () => {
      service.registerRoute('/api/users', {
        service: 'user-service',
        method: 'GET',
        version: 'v1'
      });

      service.registerRoute('/api/posts', {
        service: 'post-service',
        method: 'POST',
        version: 'v1'
      });

      const routes = service.getRoutes();

      expect(routes).toHaveLength(2);
      expect(routes.some(r => r.pattern === '/api/users')).toBe(true);
      expect(routes.some(r => r.pattern === '/api/posts')).toBe(true);
    });

    it('should get service health status', () => {
      service.registerService('test-service', {
        url: 'http://localhost:3000',
        weight: 1
      });

      const health = service.getServiceHealth();

      expect(health).toHaveLength(1);
      expect(health[0].name).toBe('test-service');
      expect(health[0].healthy).toBe(true);
    });
  });

  describe('Events', () => {
    it('should emit request event', (done) => {
      service.on('request', (data) => {
        expect(data.route).toBe('/api/test');
        expect(data.method).toBe('GET');
        expect(data.statusCode).toBe(200);
        done();
      });

      service.recordRequest('/api/test', 'GET', 200, 100);
    });
  });

  describe('Health Checks', () => {
    it('should start health check monitoring', () => {
      service.startHealthChecks();
      expect(service.healthCheckTimer).toBeDefined();
    });

    it('should stop health check monitoring', () => {
      service.startHealthChecks();
      service.stopHealthChecks();
      expect(service.healthCheckTimer).toBeNull();
    });

    it('should not start multiple health check timers', () => {
      service.startHealthChecks();
      const firstTimer = service.healthCheckTimer;

      service.startHealthChecks();
      const secondTimer = service.healthCheckTimer;

      expect(firstTimer).toBe(secondTimer);
    });
  });

  describe('Shutdown', () => {
    it('should clean up resources on shutdown', async () => {
      service.startHealthChecks();
      await service.shutdown();

      expect(service.healthCheckTimer).toBeNull();
    });
  });
});
