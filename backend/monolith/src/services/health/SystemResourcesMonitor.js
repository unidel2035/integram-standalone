/**
 * System Resources Monitor Service
 * Issue #2469: Агент мониторинга ресурсов системы
 *
 * Monitors CPU, RAM, disk space, and network traffic
 * Provides predictions and alerts for resource exhaustion
 */

import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import logger from '../../utils/logger.js';
import { pool } from '../../config/database.js';

const execAsync = promisify(exec);

export class SystemResourcesMonitor {
  constructor(options = {}) {
    this.checkInterval = options.checkInterval || 30000; // 30 seconds default
    this.historySize = options.historySize || 100; // Keep last 100 measurements
    this.metrics = {
      cpu: [],
      memory: [],
      disk: [],
      network: []
    };
    this.lastNetworkStats = null;
    this.intervalId = null;
    this.isRunning = false;
    this.alerts = [];

    // Thresholds for alerts
    this.thresholds = {
      cpu: options.cpuThreshold || 80.0, // percent
      memory: options.memoryThreshold || 85.0, // percent
      disk: options.diskThreshold || 90.0, // percent
      networkErrors: options.networkErrorsThreshold || 1000 // errors count
    };

    logger.info('SystemResourcesMonitor initialized', {
      checkInterval: this.checkInterval,
      thresholds: this.thresholds
    });
  }

  /**
   * Start monitoring
   */
  async start() {
    if (this.isRunning) {
      logger.warn('System resources monitor already running');
      return;
    }

    this.isRunning = true;

    // Perform initial collection
    await this.collectMetrics();

    // Start periodic collection
    this.intervalId = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        logger.error('Failed to collect metrics', { error: error.message });
      }
    }, this.checkInterval);

    logger.info('System resources monitoring started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('System resources monitoring stopped');
  }

  /**
   * Collect CPU metrics
   */
  async collectCPUMetrics() {
    const cpus = os.cpus();
    const cpuCount = cpus.length;

    // Load averages (1, 5, 15 minutes)
    const loadAvg = os.loadavg();

    // Calculate CPU usage percentage
    const cpuUsagePercent = (loadAvg[0] / cpuCount) * 100;

    // Get per-core information
    const cores = cpus.map((cpu, index) => {
      const total = Object.values(cpu.times).reduce((acc, val) => acc + val, 0);
      const idle = cpu.times.idle;
      const usage = total > 0 ? ((total - idle) / total) * 100 : 0;

      return {
        core: index,
        model: cpu.model,
        speed: cpu.speed,
        usage: Math.round(usage * 100) / 100
      };
    });

    return {
      timestamp: Date.now(),
      count: cpuCount,
      model: cpus[0]?.model || 'Unknown',
      speed: cpus[0]?.speed || 0,
      loadAverage: {
        '1min': Math.round(loadAvg[0] * 100) / 100,
        '5min': Math.round(loadAvg[1] * 100) / 100,
        '15min': Math.round(loadAvg[2] * 100) / 100
      },
      usagePercent: Math.round(cpuUsagePercent * 100) / 100,
      cores
    };
  }

  /**
   * Collect memory metrics
   */
  async collectMemoryMetrics() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usagePercent = (usedMemory / totalMemory) * 100;

    return {
      timestamp: Date.now(),
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      usagePercent: Math.round(usagePercent * 100) / 100,
      totalGB: Math.round((totalMemory / (1024 ** 3)) * 100) / 100,
      freeGB: Math.round((freeMemory / (1024 ** 3)) * 100) / 100,
      usedGB: Math.round((usedMemory / (1024 ** 3)) * 100) / 100
    };
  }

  /**
   * Collect disk metrics
   */
  async collectDiskMetrics() {
    const platform = os.platform();
    let diskInfo = [];

    try {
      if (platform === 'linux' || platform === 'darwin') {
        // Use df command for Unix-like systems
        const { stdout } = await execAsync('df -k');
        const lines = stdout.trim().split('\n');

        // Skip header line
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(/\s+/);
          if (parts.length >= 6) {
            const filesystem = parts[0];
            const size = parseInt(parts[1], 10) * 1024; // Convert to bytes
            const used = parseInt(parts[2], 10) * 1024;
            const available = parseInt(parts[3], 10) * 1024;
            const usagePercent = parseFloat(parts[4]);
            const mountPoint = parts[5];

            // Skip special filesystems
            if (!filesystem.startsWith('/dev/loop') &&
                !filesystem.startsWith('tmpfs') &&
                !filesystem.startsWith('devtmpfs')) {
              diskInfo.push({
                filesystem,
                mountPoint,
                size,
                used,
                available,
                usagePercent,
                sizeGB: Math.round((size / (1024 ** 3)) * 100) / 100,
                usedGB: Math.round((used / (1024 ** 3)) * 100) / 100,
                availableGB: Math.round((available / (1024 ** 3)) * 100) / 100
              });
            }
          }
        }
      } else if (platform === 'win32') {
        // For Windows, use wmic (simplified)
        try {
          const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption');
          const lines = stdout.trim().split('\n');

          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].trim().split(/\s+/);
            if (parts.length >= 3) {
              const drive = parts[0];
              const free = parseInt(parts[1], 10);
              const size = parseInt(parts[2], 10);
              const used = size - free;
              const usagePercent = size > 0 ? (used / size) * 100 : 0;

              diskInfo.push({
                filesystem: drive,
                mountPoint: drive,
                size,
                used,
                available: free,
                usagePercent: Math.round(usagePercent * 100) / 100,
                sizeGB: Math.round((size / (1024 ** 3)) * 100) / 100,
                usedGB: Math.round((used / (1024 ** 3)) * 100) / 100,
                availableGB: Math.round((free / (1024 ** 3)) * 100) / 100
              });
            }
          }
        } catch (error) {
          logger.warn('Failed to collect Windows disk info', { error: error.message });
        }
      }
    } catch (error) {
      logger.error('Failed to collect disk metrics', { error: error.message });
    }

    return {
      timestamp: Date.now(),
      disks: diskInfo,
      platform
    };
  }

  /**
   * Collect network metrics
   */
  async collectNetworkMetrics() {
    const networkInterfaces = os.networkInterfaces();
    const interfaces = [];

    for (const [name, addresses] of Object.entries(networkInterfaces)) {
      if (addresses) {
        const ipv4 = addresses.find(addr => addr.family === 'IPv4');
        const ipv6 = addresses.find(addr => addr.family === 'IPv6');

        interfaces.push({
          name,
          ipv4: ipv4?.address,
          ipv6: ipv6?.address,
          mac: addresses[0]?.mac,
          internal: addresses[0]?.internal
        });
      }
    }

    // Collect network statistics (Linux/Unix only)
    let stats = null;
    const platform = os.platform();

    try {
      if (platform === 'linux') {
        const netdev = await fs.readFile('/proc/net/dev', 'utf-8');
        const lines = netdev.split('\n');

        const interfaceStats = {};
        for (let i = 2; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const parts = line.split(/\s+/);
          if (parts.length >= 17) {
            const iface = parts[0].replace(':', '');
            interfaceStats[iface] = {
              bytesReceived: parseInt(parts[1], 10),
              packetsReceived: parseInt(parts[2], 10),
              errorsReceived: parseInt(parts[3], 10),
              bytesSent: parseInt(parts[9], 10),
              packetsSent: parseInt(parts[10], 10),
              errorsSent: parseInt(parts[11], 10)
            };
          }
        }

        // Calculate rates if we have previous stats
        if (this.lastNetworkStats) {
          const timeDiff = (Date.now() - this.lastNetworkStats.timestamp) / 1000; // seconds

          for (const [iface, current] of Object.entries(interfaceStats)) {
            const previous = this.lastNetworkStats.stats[iface];
            if (previous && timeDiff > 0) {
              const rxRate = (current.bytesReceived - previous.bytesReceived) / timeDiff;
              const txRate = (current.bytesSent - previous.bytesSent) / timeDiff;

              current.rxRateBytesPerSec = Math.max(0, Math.round(rxRate));
              current.txRateBytesPerSec = Math.max(0, Math.round(txRate));
              current.rxRateMbps = Math.round((rxRate * 8 / 1000000) * 100) / 100;
              current.txRateMbps = Math.round((txRate * 8 / 1000000) * 100) / 100;
            }
          }
        }

        stats = interfaceStats;
        this.lastNetworkStats = { timestamp: Date.now(), stats: interfaceStats };
      }
    } catch (error) {
      logger.debug('Failed to collect network statistics', { error: error.message });
    }

    return {
      timestamp: Date.now(),
      interfaces,
      stats,
      platform
    };
  }

  /**
   * Collect all metrics
   */
  async collectMetrics() {
    const cpu = await this.collectCPUMetrics();
    const memory = await this.collectMemoryMetrics();
    const disk = await this.collectDiskMetrics();
    const network = await this.collectNetworkMetrics();

    // Add to history
    this.metrics.cpu.push(cpu);
    this.metrics.memory.push(memory);
    this.metrics.disk.push(disk);
    this.metrics.network.push(network);

    // Limit history size
    if (this.metrics.cpu.length > this.historySize) {
      this.metrics.cpu.shift();
    }
    if (this.metrics.memory.length > this.historySize) {
      this.metrics.memory.shift();
    }
    if (this.metrics.disk.length > this.historySize) {
      this.metrics.disk.shift();
    }
    if (this.metrics.network.length > this.historySize) {
      this.metrics.network.shift();
    }

    // Check for alerts
    await this.checkAlerts({ cpu, memory, disk, network });

    // Store in database if available
    await this.storeMetrics({ cpu, memory, disk, network });

    return { cpu, memory, disk, network };
  }

  /**
   * Check for alert conditions
   */
  async checkAlerts(metrics) {
    const newAlerts = [];
    const now = Date.now();

    // CPU alert
    if (metrics.cpu.usagePercent > this.thresholds.cpu) {
      newAlerts.push({
        type: 'cpu',
        severity: metrics.cpu.usagePercent > 95 ? 'critical' : 'warning',
        message: `CPU usage is ${metrics.cpu.usagePercent}% (threshold: ${this.thresholds.cpu}%)`,
        value: metrics.cpu.usagePercent,
        threshold: this.thresholds.cpu,
        timestamp: now
      });
    }

    // Memory alert
    if (metrics.memory.usagePercent > this.thresholds.memory) {
      newAlerts.push({
        type: 'memory',
        severity: metrics.memory.usagePercent > 95 ? 'critical' : 'warning',
        message: `Memory usage is ${metrics.memory.usagePercent}% (threshold: ${this.thresholds.memory}%)`,
        value: metrics.memory.usagePercent,
        threshold: this.thresholds.memory,
        timestamp: now
      });
    }

    // Disk alerts
    if (metrics.disk.disks) {
      for (const disk of metrics.disk.disks) {
        if (disk.usagePercent > this.thresholds.disk) {
          newAlerts.push({
            type: 'disk',
            severity: disk.usagePercent > 95 ? 'critical' : 'warning',
            message: `Disk ${disk.mountPoint} usage is ${disk.usagePercent}% (threshold: ${this.thresholds.disk}%)`,
            value: disk.usagePercent,
            threshold: this.thresholds.disk,
            filesystem: disk.filesystem,
            mountPoint: disk.mountPoint,
            timestamp: now
          });
        }
      }
    }

    // Network error alerts
    if (metrics.network.stats) {
      for (const [iface, stats] of Object.entries(metrics.network.stats)) {
        const totalErrors = (stats.errorsReceived || 0) + (stats.errorsSent || 0);
        if (totalErrors > this.thresholds.networkErrors) {
          newAlerts.push({
            type: 'network',
            severity: 'warning',
            message: `Network interface ${iface} has ${totalErrors} errors`,
            value: totalErrors,
            threshold: this.thresholds.networkErrors,
            interface: iface,
            timestamp: now
          });
        }
      }
    }

    // Add new alerts and remove old ones (keep last 100)
    this.alerts.push(...newAlerts);
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Log critical alerts
    const criticalAlerts = newAlerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      logger.error('Critical resource alerts detected', { alerts: criticalAlerts });
    } else if (newAlerts.length > 0) {
      logger.warn('Resource alerts detected', { alerts: newAlerts });
    }

    return newAlerts;
  }

  /**
   * Predict resource exhaustion
   */
  predictExhaustion() {
    const predictions = [];

    // Predict memory exhaustion
    if (this.metrics.memory.length >= 10) {
      const recentMemory = this.metrics.memory.slice(-10);
      const growthRate = this.calculateGrowthRate(recentMemory.map(m => m.usagePercent));

      if (growthRate > 0) {
        const currentUsage = recentMemory[recentMemory.length - 1].usagePercent;
        const remainingCapacity = 100 - currentUsage;
        const timeToExhaustion = remainingCapacity / growthRate; // in check intervals
        const minutesToExhaustion = (timeToExhaustion * this.checkInterval) / 60000;

        if (minutesToExhaustion < 60 && minutesToExhaustion > 0) {
          predictions.push({
            type: 'memory',
            message: `Memory may be exhausted in ${Math.round(minutesToExhaustion)} minutes`,
            currentUsage,
            growthRate: Math.round(growthRate * 100) / 100,
            estimatedMinutes: Math.round(minutesToExhaustion)
          });
        }
      }
    }

    // Predict disk exhaustion
    if (this.metrics.disk.length >= 10) {
      const recentDisks = this.metrics.disk.slice(-10);

      // Group by mount point
      const disksByMount = {};
      for (const diskMetrics of recentDisks) {
        for (const disk of diskMetrics.disks || []) {
          if (!disksByMount[disk.mountPoint]) {
            disksByMount[disk.mountPoint] = [];
          }
          disksByMount[disk.mountPoint].push(disk.usagePercent);
        }
      }

      for (const [mountPoint, usages] of Object.entries(disksByMount)) {
        if (usages.length >= 10) {
          const growthRate = this.calculateGrowthRate(usages);

          if (growthRate > 0) {
            const currentUsage = usages[usages.length - 1];
            const remainingCapacity = 100 - currentUsage;
            const timeToExhaustion = remainingCapacity / growthRate;
            const hoursToExhaustion = (timeToExhaustion * this.checkInterval) / 3600000;

            if (hoursToExhaustion < 168 && hoursToExhaustion > 0) { // Less than a week
              predictions.push({
                type: 'disk',
                mountPoint,
                message: `Disk ${mountPoint} may be full in ${Math.round(hoursToExhaustion)} hours`,
                currentUsage: Math.round(currentUsage * 100) / 100,
                growthRate: Math.round(growthRate * 100) / 100,
                estimatedHours: Math.round(hoursToExhaustion)
              });
            }
          }
        }
      }
    }

    return predictions;
  }

  /**
   * Calculate growth rate from time series data
   */
  calculateGrowthRate(values) {
    if (values.length < 2) return 0;

    // Simple linear regression
    const n = values.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const latest = this.getCurrentMetrics();

    if (!latest) return recommendations;

    // CPU recommendations
    if (latest.cpu.usagePercent > 70) {
      recommendations.push({
        type: 'cpu',
        priority: latest.cpu.usagePercent > 90 ? 'high' : 'medium',
        message: 'High CPU usage detected',
        suggestions: [
          'Check for processes consuming excessive CPU',
          'Consider scaling horizontally by adding more instances',
          'Review and optimize application code',
          'Enable caching for frequently computed results'
        ]
      });
    }

    // Memory recommendations
    if (latest.memory.usagePercent > 75) {
      recommendations.push({
        type: 'memory',
        priority: latest.memory.usagePercent > 90 ? 'high' : 'medium',
        message: 'High memory usage detected',
        suggestions: [
          'Check for memory leaks in application',
          'Consider increasing available RAM',
          'Implement memory caching strategies',
          'Review database connection pooling settings',
          'Enable garbage collection optimization'
        ]
      });
    }

    // Disk recommendations
    if (latest.disk.disks) {
      for (const disk of latest.disk.disks) {
        if (disk.usagePercent > 80) {
          recommendations.push({
            type: 'disk',
            priority: disk.usagePercent > 95 ? 'high' : 'medium',
            message: `Disk ${disk.mountPoint} is running low on space`,
            suggestions: [
              'Clean up old log files',
              'Remove unused dependencies and packages',
              'Archive or compress old data',
              'Consider adding more disk space',
              'Implement log rotation policies'
            ]
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Get current metrics (latest measurement)
   */
  getCurrentMetrics() {
    if (this.metrics.cpu.length === 0) return null;

    return {
      cpu: this.metrics.cpu[this.metrics.cpu.length - 1],
      memory: this.metrics.memory[this.metrics.memory.length - 1],
      disk: this.metrics.disk[this.metrics.disk.length - 1],
      network: this.metrics.network[this.metrics.network.length - 1],
      timestamp: Date.now()
    };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory() {
    return {
      cpu: this.metrics.cpu,
      memory: this.metrics.memory,
      disk: this.metrics.disk,
      network: this.metrics.network
    };
  }

  /**
   * Get current alerts
   */
  getAlerts() {
    // Return alerts from last 1 hour
    const oneHourAgo = Date.now() - 3600000;
    return this.alerts.filter(a => a.timestamp > oneHourAgo);
  }

  /**
   * Get full status report
   */
  async getStatusReport() {
    const current = this.getCurrentMetrics();
    const predictions = this.predictExhaustion();
    const recommendations = this.generateRecommendations();
    const alerts = this.getAlerts();

    return {
      status: alerts.some(a => a.severity === 'critical') ? 'critical' :
              alerts.length > 0 ? 'warning' : 'healthy',
      current,
      alerts,
      predictions,
      recommendations,
      uptime: process.uptime(),
      isMonitoring: this.isRunning,
      checkInterval: this.checkInterval,
      thresholds: this.thresholds
    };
  }

  /**
   * Store metrics in database
   */
  async storeMetrics(metrics) {
    if (!pool) return;

    try {
      await pool.query(
        `INSERT INTO system_resource_metrics (
          cpu_usage_percent,
          cpu_load_1min,
          cpu_load_5min,
          cpu_load_15min,
          memory_usage_percent,
          memory_total_gb,
          memory_used_gb,
          memory_free_gb,
          metrics_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          metrics.cpu.usagePercent,
          metrics.cpu.loadAverage['1min'],
          metrics.cpu.loadAverage['5min'],
          metrics.cpu.loadAverage['15min'],
          metrics.memory.usagePercent,
          metrics.memory.totalGB,
          metrics.memory.usedGB,
          metrics.memory.freeGB,
          JSON.stringify({
            cpu: metrics.cpu,
            memory: metrics.memory,
            disk: metrics.disk,
            network: metrics.network
          })
        ]
      );
    } catch (error) {
      // Silently fail if table doesn't exist yet
      if (!error.message.includes('does not exist')) {
        logger.error('Failed to store system metrics', { error: error.message });
      }
    }
  }
}

export default SystemResourcesMonitor;
