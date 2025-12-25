/**
 * Unit tests for SystemResourcesMonitor
 * Issue #2469: Агент мониторинга ресурсов системы
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SystemResourcesMonitor } from '../SystemResourcesMonitor.js';

describe('SystemResourcesMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new SystemResourcesMonitor({
      checkInterval: 1000,
      historySize: 10,
      cpuThreshold: 80.0,
      memoryThreshold: 85.0,
      diskThreshold: 90.0,
      networkErrorsThreshold: 1000
    });
  });

  afterEach(async () => {
    if (monitor.isRunning) {
      monitor.stop();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      const defaultMonitor = new SystemResourcesMonitor();

      expect(defaultMonitor.checkInterval).toBe(30000);
      expect(defaultMonitor.historySize).toBe(100);
      expect(defaultMonitor.isRunning).toBe(false);
    });

    it('should initialize with custom values', () => {
      expect(monitor.checkInterval).toBe(1000);
      expect(monitor.historySize).toBe(10);
      expect(monitor.thresholds.cpu).toBe(80.0);
      expect(monitor.thresholds.memory).toBe(85.0);
      expect(monitor.thresholds.disk).toBe(90.0);
      expect(monitor.thresholds.networkErrors).toBe(1000);
    });
  });

  describe('CPU Metrics Collection', () => {
    it('should collect CPU metrics', async () => {
      const cpuMetrics = await monitor.collectCPUMetrics();

      expect(cpuMetrics).toHaveProperty('timestamp');
      expect(cpuMetrics).toHaveProperty('count');
      expect(cpuMetrics).toHaveProperty('model');
      expect(cpuMetrics).toHaveProperty('speed');
      expect(cpuMetrics).toHaveProperty('loadAverage');
      expect(cpuMetrics).toHaveProperty('usagePercent');
      expect(cpuMetrics).toHaveProperty('cores');

      expect(cpuMetrics.count).toBeGreaterThan(0);
      expect(cpuMetrics.usagePercent).toBeGreaterThanOrEqual(0);
      expect(cpuMetrics.cores).toBeInstanceOf(Array);
      expect(cpuMetrics.cores.length).toBe(cpuMetrics.count);
    });

    it('should have valid load averages', async () => {
      const cpuMetrics = await monitor.collectCPUMetrics();

      expect(cpuMetrics.loadAverage).toHaveProperty('1min');
      expect(cpuMetrics.loadAverage).toHaveProperty('5min');
      expect(cpuMetrics.loadAverage).toHaveProperty('15min');

      expect(cpuMetrics.loadAverage['1min']).toBeGreaterThanOrEqual(0);
      expect(cpuMetrics.loadAverage['5min']).toBeGreaterThanOrEqual(0);
      expect(cpuMetrics.loadAverage['15min']).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Memory Metrics Collection', () => {
    it('should collect memory metrics', async () => {
      const memoryMetrics = await monitor.collectMemoryMetrics();

      expect(memoryMetrics).toHaveProperty('timestamp');
      expect(memoryMetrics).toHaveProperty('total');
      expect(memoryMetrics).toHaveProperty('free');
      expect(memoryMetrics).toHaveProperty('used');
      expect(memoryMetrics).toHaveProperty('usagePercent');
      expect(memoryMetrics).toHaveProperty('totalGB');
      expect(memoryMetrics).toHaveProperty('freeGB');
      expect(memoryMetrics).toHaveProperty('usedGB');

      expect(memoryMetrics.total).toBeGreaterThan(0);
      expect(memoryMetrics.free).toBeGreaterThanOrEqual(0);
      expect(memoryMetrics.used).toBeGreaterThan(0);
      expect(memoryMetrics.usagePercent).toBeGreaterThanOrEqual(0);
      expect(memoryMetrics.usagePercent).toBeLessThanOrEqual(100);
    });

    it('should have consistent memory calculations', async () => {
      const memoryMetrics = await monitor.collectMemoryMetrics();

      expect(memoryMetrics.used).toBe(memoryMetrics.total - memoryMetrics.free);

      const calculatedPercent = (memoryMetrics.used / memoryMetrics.total) * 100;
      expect(Math.abs(memoryMetrics.usagePercent - calculatedPercent)).toBeLessThan(0.1);
    });
  });

  describe('Disk Metrics Collection', () => {
    it('should collect disk metrics', async () => {
      const diskMetrics = await monitor.collectDiskMetrics();

      expect(diskMetrics).toHaveProperty('timestamp');
      expect(diskMetrics).toHaveProperty('disks');
      expect(diskMetrics).toHaveProperty('platform');

      expect(diskMetrics.disks).toBeInstanceOf(Array);
    });

    it('should have valid disk information when available', async () => {
      const diskMetrics = await monitor.collectDiskMetrics();

      if (diskMetrics.disks.length > 0) {
        const disk = diskMetrics.disks[0];

        expect(disk).toHaveProperty('filesystem');
        expect(disk).toHaveProperty('mountPoint');
        expect(disk).toHaveProperty('size');
        expect(disk).toHaveProperty('used');
        expect(disk).toHaveProperty('available');
        expect(disk).toHaveProperty('usagePercent');
        expect(disk).toHaveProperty('sizeGB');
        expect(disk).toHaveProperty('usedGB');
        expect(disk).toHaveProperty('availableGB');

        expect(disk.size).toBeGreaterThan(0);
        expect(disk.usagePercent).toBeGreaterThanOrEqual(0);
        expect(disk.usagePercent).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Network Metrics Collection', () => {
    it('should collect network metrics', async () => {
      const networkMetrics = await monitor.collectNetworkMetrics();

      expect(networkMetrics).toHaveProperty('timestamp');
      expect(networkMetrics).toHaveProperty('interfaces');
      expect(networkMetrics).toHaveProperty('platform');

      expect(networkMetrics.interfaces).toBeInstanceOf(Array);
    });

    it('should have valid network interfaces', async () => {
      const networkMetrics = await monitor.collectNetworkMetrics();

      expect(networkMetrics.interfaces.length).toBeGreaterThan(0);

      const iface = networkMetrics.interfaces[0];
      expect(iface).toHaveProperty('name');
      expect(iface).toHaveProperty('mac');
      expect(iface).toHaveProperty('internal');
    });
  });

  describe('Metrics Collection and History', () => {
    it('should collect all metrics', async () => {
      const metrics = await monitor.collectMetrics();

      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('disk');
      expect(metrics).toHaveProperty('network');
    });

    it('should maintain metrics history', async () => {
      await monitor.collectMetrics();
      await monitor.collectMetrics();
      await monitor.collectMetrics();

      expect(monitor.metrics.cpu.length).toBe(3);
      expect(monitor.metrics.memory.length).toBe(3);
      expect(monitor.metrics.disk.length).toBe(3);
      expect(monitor.metrics.network.length).toBe(3);
    });

    it('should limit history size', async () => {
      // Collect more metrics than historySize
      for (let i = 0; i < 15; i++) {
        await monitor.collectMetrics();
      }

      expect(monitor.metrics.cpu.length).toBe(monitor.historySize);
      expect(monitor.metrics.memory.length).toBe(monitor.historySize);
      expect(monitor.metrics.disk.length).toBe(monitor.historySize);
      expect(monitor.metrics.network.length).toBe(monitor.historySize);
    });

    it('should get current metrics', async () => {
      await monitor.collectMetrics();

      const current = monitor.getCurrentMetrics();

      expect(current).toBeTruthy();
      expect(current).toHaveProperty('cpu');
      expect(current).toHaveProperty('memory');
      expect(current).toHaveProperty('disk');
      expect(current).toHaveProperty('network');
      expect(current).toHaveProperty('timestamp');
    });

    it('should return null for current metrics when no data', () => {
      const current = monitor.getCurrentMetrics();
      expect(current).toBeNull();
    });
  });

  describe('Alert Generation', () => {
    it('should generate CPU alert when threshold exceeded', async () => {
      // Mock high CPU usage
      monitor.thresholds.cpu = 0; // Set very low threshold

      await monitor.collectMetrics();

      const alerts = monitor.getAlerts();
      const cpuAlerts = alerts.filter(a => a.type === 'cpu');

      expect(cpuAlerts.length).toBeGreaterThan(0);
      expect(cpuAlerts[0]).toHaveProperty('severity');
      expect(cpuAlerts[0]).toHaveProperty('message');
      expect(cpuAlerts[0]).toHaveProperty('value');
      expect(cpuAlerts[0]).toHaveProperty('threshold');
    });

    it('should generate memory alert when threshold exceeded', async () => {
      // Mock high memory usage
      monitor.thresholds.memory = 0; // Set very low threshold

      await monitor.collectMetrics();

      const alerts = monitor.getAlerts();
      const memoryAlerts = alerts.filter(a => a.type === 'memory');

      expect(memoryAlerts.length).toBeGreaterThan(0);
      expect(memoryAlerts[0]).toHaveProperty('severity');
      expect(memoryAlerts[0]).toHaveProperty('message');
    });

    it('should differentiate between warning and critical severity', async () => {
      monitor.thresholds.cpu = 0; // Force alert
      await monitor.collectMetrics();

      const alerts = monitor.getAlerts();
      const cpuAlert = alerts.find(a => a.type === 'cpu');

      expect(cpuAlert.severity).toMatch(/warning|critical/);
    });
  });

  describe('Predictions', () => {
    it('should calculate growth rate', () => {
      const values = [10, 12, 14, 16, 18, 20];
      const growthRate = monitor.calculateGrowthRate(values);

      expect(growthRate).toBeGreaterThan(0);
      expect(growthRate).toBeCloseTo(2, 0);
    });

    it('should predict resource exhaustion', async () => {
      // Simulate increasing memory usage
      for (let i = 0; i < 10; i++) {
        // Override collectMemoryMetrics temporarily for testing
        const originalCollectMemory = monitor.collectMemoryMetrics.bind(monitor);
        monitor.collectMemoryMetrics = async () => {
          const metrics = await originalCollectMemory();
          metrics.usagePercent = 50 + i * 5; // Simulate growth
          return metrics;
        };

        await monitor.collectMetrics();
      }

      const predictions = monitor.predictExhaustion();

      // If growth is significant, should have predictions
      expect(Array.isArray(predictions)).toBe(true);
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations for high resource usage', async () => {
      // Force high usage
      monitor.thresholds.cpu = 0;
      monitor.thresholds.memory = 0;
      monitor.thresholds.disk = 0;

      await monitor.collectMetrics();

      const recommendations = monitor.generateRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);

      if (recommendations.length > 0) {
        const rec = recommendations[0];
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('priority');
        expect(rec).toHaveProperty('message');
        expect(rec).toHaveProperty('suggestions');
        expect(rec.suggestions).toBeInstanceOf(Array);
        expect(rec.suggestions.length).toBeGreaterThan(0);
      }
    });

    it('should have different priorities', async () => {
      monitor.thresholds.cpu = 0;
      await monitor.collectMetrics();

      const recommendations = monitor.generateRecommendations();

      if (recommendations.length > 0) {
        const priorities = recommendations.map(r => r.priority);
        expect(priorities).toContain(expect.stringMatching(/high|medium|low/));
      }
    });
  });

  describe('Status Report', () => {
    it('should generate complete status report', async () => {
      await monitor.collectMetrics();

      const report = await monitor.getStatusReport();

      expect(report).toHaveProperty('status');
      expect(report).toHaveProperty('current');
      expect(report).toHaveProperty('alerts');
      expect(report).toHaveProperty('predictions');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('uptime');
      expect(report).toHaveProperty('isMonitoring');
      expect(report).toHaveProperty('checkInterval');
      expect(report).toHaveProperty('thresholds');

      expect(report.status).toMatch(/healthy|warning|critical/);
    });

    it('should report healthy status when no issues', async () => {
      // Set high thresholds
      monitor.thresholds.cpu = 100;
      monitor.thresholds.memory = 100;
      monitor.thresholds.disk = 100;

      await monitor.collectMetrics();

      const report = await monitor.getStatusReport();

      expect(report.status).toBe('healthy');
    });

    it('should report warning/critical status when issues detected', async () => {
      // Set very low thresholds
      monitor.thresholds.cpu = 0;
      monitor.thresholds.memory = 0;

      await monitor.collectMetrics();

      const report = await monitor.getStatusReport();

      expect(report.status).toMatch(/warning|critical/);
    });
  });

  describe('Start/Stop Monitoring', () => {
    it('should start monitoring', async () => {
      expect(monitor.isRunning).toBe(false);

      await monitor.start();

      expect(monitor.isRunning).toBe(true);
      expect(monitor.intervalId).toBeTruthy();

      monitor.stop();
    });

    it('should stop monitoring', async () => {
      await monitor.start();
      expect(monitor.isRunning).toBe(true);

      monitor.stop();

      expect(monitor.isRunning).toBe(false);
      expect(monitor.intervalId).toBeNull();
    });

    it('should not start twice', async () => {
      await monitor.start();
      const firstIntervalId = monitor.intervalId;

      await monitor.start(); // Try starting again

      expect(monitor.intervalId).toBe(firstIntervalId);

      monitor.stop();
    });

    it('should collect initial metrics on start', async () => {
      expect(monitor.metrics.cpu.length).toBe(0);

      await monitor.start();

      expect(monitor.metrics.cpu.length).toBeGreaterThan(0);

      monitor.stop();
    });
  });

  describe('Metrics History', () => {
    it('should get metrics history', async () => {
      await monitor.collectMetrics();
      await monitor.collectMetrics();

      const history = monitor.getMetricsHistory();

      expect(history).toHaveProperty('cpu');
      expect(history).toHaveProperty('memory');
      expect(history).toHaveProperty('disk');
      expect(history).toHaveProperty('network');

      expect(history.cpu.length).toBe(2);
      expect(history.memory.length).toBe(2);
    });
  });

  describe('Alert History', () => {
    it('should get alerts from last hour', async () => {
      monitor.thresholds.cpu = 0;
      await monitor.collectMetrics();

      const alerts = monitor.getAlerts();

      expect(Array.isArray(alerts)).toBe(true);

      // All alerts should be recent (within 1 hour)
      const oneHourAgo = Date.now() - 3600000;
      alerts.forEach(alert => {
        expect(alert.timestamp).toBeGreaterThan(oneHourAgo);
      });
    });
  });
});
