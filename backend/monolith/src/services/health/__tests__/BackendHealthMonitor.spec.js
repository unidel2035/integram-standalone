/**
 * Tests for BackendHealthMonitor
 * Issue #1674: Система самолечения бэкэнда
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import BackendHealthMonitor from '../BackendHealthMonitor.js';

describe('BackendHealthMonitor', () => {
  let healthMonitor;

  beforeEach(() => {
    healthMonitor = new BackendHealthMonitor({
      serviceName: 'test-service',
      checkInterval: 1000
    });
  });

  afterEach(() => {
    if (healthMonitor) {
      healthMonitor.stop();
    }
  });

  describe('Initialization', () => {
    it('should initialize with service name and check interval', () => {
      expect(healthMonitor.serviceName).toBe('test-service');
      expect(healthMonitor.checkInterval).toBe(1000);
      expect(healthMonitor.isRunning).toBe(false);
    });

    it('should initialize metrics tracking', () => {
      expect(healthMonitor.metrics).toBeDefined();
      expect(healthMonitor.metrics.requestCount).toBe(0);
      expect(healthMonitor.metrics.errorCount).toBe(0);
      expect(Array.isArray(healthMonitor.metrics.responseTimes)).toBe(true);
    });
  });

  describe('Metrics Collection', () => {
    it('should collect system metrics', () => {
      const metrics = healthMonitor.collectMetrics();

      expect(metrics.service_name).toBe('test-service');
      expect(metrics.cpu_usage_percent).toBeGreaterThanOrEqual(0);
      expect(metrics.memory_usage_mb).toBeGreaterThan(0);
      expect(metrics.memory_usage_percent).toBeGreaterThanOrEqual(0);
      expect(metrics.uptime_seconds).toBeGreaterThanOrEqual(0);
      expect(metrics.metrics_data).toBeDefined();
      expect(metrics.metrics_data.platform).toBeDefined();
      expect(metrics.metrics_data.node_version).toBeDefined();
    });

    it('should calculate error rate correctly', () => {
      // Record some errors
      healthMonitor.recordError(new Error('Test error 1'));
      healthMonitor.recordError(new Error('Test error 2'));
      healthMonitor.recordError(new Error('Test error 3'));

      const metrics = healthMonitor.collectMetrics();

      expect(metrics.error_rate).toBeGreaterThanOrEqual(0);
    });

    it('should calculate response times correctly', () => {
      // Record some response times
      healthMonitor.recordRequest(100);
      healthMonitor.recordRequest(200);
      healthMonitor.recordRequest(150);

      const metrics = healthMonitor.collectMetrics();

      expect(metrics.response_time_avg_ms).toBeGreaterThan(0);
      expect(metrics.response_time_avg_ms).toBeLessThanOrEqual(200);
    });
  });

  describe('Request and Error Recording', () => {
    it('should record requests', () => {
      const initialCount = healthMonitor.metrics.requestCount;

      healthMonitor.recordRequest(100);
      healthMonitor.recordRequest(200);

      expect(healthMonitor.metrics.requestCount).toBe(initialCount + 2);
      expect(healthMonitor.metrics.responseTimes.length).toBe(2);
    });

    it('should record errors', () => {
      const initialCount = healthMonitor.metrics.errorCount;

      healthMonitor.recordError(new Error('Test error'));

      expect(healthMonitor.metrics.errorCount).toBe(initialCount + 1);
      expect(healthMonitor.metrics.lastErrors.length).toBe(1);
    });

    it('should limit response times stored', () => {
      // Record more than 1000 response times
      for (let i = 0; i < 1100; i++) {
        healthMonitor.recordRequest(100 + i);
      }

      expect(healthMonitor.metrics.responseTimes.length).toBeLessThanOrEqual(1000);
    });

    it('should limit errors stored', () => {
      // Record more than 100 errors
      for (let i = 0; i < 150; i++) {
        healthMonitor.recordError(new Error(`Error ${i}`));
      }

      expect(healthMonitor.metrics.lastErrors.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Health Status Determination', () => {
    beforeEach(() => {
      healthMonitor.thresholds = {
        cpu_threshold_percent: 80.0,
        memory_threshold_percent: 85.0,
        error_rate_threshold: 10.0,
        response_time_threshold_ms: 5000
      };
    });

    it('should determine healthy status when all metrics are good', () => {
      const metrics = {
        cpu_usage_percent: 50,
        memory_usage_percent: 60,
        error_rate: 2,
        response_time_avg_ms: 200
      };

      const { status, issues } = healthMonitor.determineStatus(metrics);

      expect(status).toBe('healthy');
      expect(issues.length).toBe(0);
    });

    it('should determine degraded status when one metric exceeds threshold', () => {
      const metrics = {
        cpu_usage_percent: 85, // Exceeds threshold
        memory_usage_percent: 60,
        error_rate: 2,
        response_time_avg_ms: 200
      };

      const { status, issues } = healthMonitor.determineStatus(metrics);

      expect(status).toBe('degraded');
      expect(issues.length).toBe(1);
      expect(issues[0]).toContain('CPU');
    });

    it('should determine unhealthy status when two metrics exceed thresholds', () => {
      const metrics = {
        cpu_usage_percent: 85, // Exceeds
        memory_usage_percent: 90, // Exceeds
        error_rate: 2,
        response_time_avg_ms: 200
      };

      const { status, issues } = healthMonitor.determineStatus(metrics);

      expect(status).toBe('unhealthy');
      expect(issues.length).toBe(2);
    });

    it('should determine critical status when multiple metrics exceed thresholds', () => {
      const metrics = {
        cpu_usage_percent: 85, // Exceeds
        memory_usage_percent: 90, // Exceeds
        error_rate: 15, // Exceeds
        response_time_avg_ms: 6000 // Exceeds
      };

      const { status, issues } = healthMonitor.determineStatus(metrics);

      expect(status).toBe('critical');
      expect(issues.length).toBeGreaterThan(2);
    });
  });

  describe('Start and Stop', () => {
    it('should start monitoring', async () => {
      healthMonitor.thresholds = { enabled: true };

      await healthMonitor.start();

      expect(healthMonitor.isRunning).toBe(true);
      expect(healthMonitor.intervalId).toBeDefined();
    });

    it('should stop monitoring', async () => {
      healthMonitor.thresholds = { enabled: true };

      await healthMonitor.start();
      expect(healthMonitor.isRunning).toBe(true);

      healthMonitor.stop();
      expect(healthMonitor.isRunning).toBe(false);
      expect(healthMonitor.intervalId).toBeNull();
    });

    it('should not start if already running', async () => {
      healthMonitor.thresholds = { enabled: true };

      await healthMonitor.start();
      const firstIntervalId = healthMonitor.intervalId;

      await healthMonitor.start();
      const secondIntervalId = healthMonitor.intervalId;

      expect(firstIntervalId).toBe(secondIntervalId);

      healthMonitor.stop();
    });
  });
});
