/**
 * Backend Health Monitor Service
 * Issue #1674: Система самолечения бэкэнда
 *
 * Monitors backend health metrics and detects issues
 */

import os from 'os';
import logger from '../../utils/logger.js';
import { pool } from '../../config/database.js';
import { limitArraySize } from '../../utils/memoryOptimization.js';

export class BackendHealthMonitor {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'backend';
    this.checkInterval = options.checkInterval || 60000; // 1 minute default
    this.metrics = {
      startTime: Date.now(),
      requestCount: 0,
      errorCount: 0,
      responseTimes: [],
      lastErrors: []
    };
    this.intervalId = null;
    this.thresholds = null;
    this.isRunning = false;

    logger.info('BackendHealthMonitor initialized', {
      serviceName: this.serviceName,
      checkInterval: this.checkInterval
    });
  }

  /**
   * Load health check configuration from database
   *
   * Issue #1798: Handle null pool gracefully
   */
  async loadConfiguration() {
    // Check if database is configured
    if (!pool) {
      logger.warn('Database not configured - health monitoring will run with defaults', {
        serviceName: this.serviceName,
        hint: 'Create backend/monolith/.env with DB_PASSWORD to enable database features'
      });
      this.thresholds = {
        enabled: true,
        check_interval_seconds: 60,
        cpu_threshold_percent: 80.0,
        memory_threshold_percent: 85.0,
        error_rate_threshold: 10.0,
        response_time_threshold_ms: 5000,
        auto_recovery_enabled: true
      };
      return;
    }

    try {
      const result = await pool.query(
        'SELECT * FROM backend_health_config WHERE service_name = $1',
        [this.serviceName]
      );

      if (result.rows.length > 0) {
        this.thresholds = result.rows[0];
        logger.debug('Health check configuration loaded', {
          serviceName: this.serviceName,
          thresholds: this.thresholds
        });
      } else {
        // Use defaults if no configuration found
        this.thresholds = {
          enabled: true,
          check_interval_seconds: 60,
          cpu_threshold_percent: 80.0,
          memory_threshold_percent: 85.0,
          error_rate_threshold: 10.0,
          response_time_threshold_ms: 5000,
          auto_recovery_enabled: true
        };
        logger.warn('No health check configuration found, using defaults', {
          serviceName: this.serviceName
        });
      }
    } catch (error) {
      // Check if error is due to missing table
      const isMissingTable = error.message && (
        error.message.includes('relation "backend_health_config" does not exist') ||
        error.message.includes('does not exist')
      );

      if (isMissingTable) {
        logger.warn('Health monitoring tables not yet created. Running in degraded mode.', {
          serviceName: this.serviceName,
          hint: 'Run: cd backend/monolith/scripts && ./setup-database.sh'
        });
        // Disable database-dependent features
        this.thresholds = {
          enabled: false, // Disable health monitoring until tables are created
          cpu_threshold_percent: 80.0,
          memory_threshold_percent: 85.0,
          error_rate_threshold: 10.0,
          response_time_threshold_ms: 5000
        };
      } else {
        logger.error('Failed to load health check configuration', {
          error: error.message,
          serviceName: this.serviceName
        });
        // Use defaults on other errors
        this.thresholds = {
          enabled: true,
          cpu_threshold_percent: 80.0,
          memory_threshold_percent: 85.0,
          error_rate_threshold: 10.0,
          response_time_threshold_ms: 5000
        };
      }
    }
  }

  /**
   * Start health monitoring
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Health monitor already running', { serviceName: this.serviceName });
      return;
    }

    await this.loadConfiguration();

    if (!this.thresholds.enabled) {
      logger.info('Health monitoring is disabled', { serviceName: this.serviceName });
      return;
    }

    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.performHealthCheck().catch((error) => {
        logger.error('Health check failed', {
          error: error.message,
          serviceName: this.serviceName
        });
      });
    }, this.checkInterval);

    // Perform initial health check
    await this.performHealthCheck();

    logger.info('Health monitoring started', {
      serviceName: this.serviceName,
      interval: this.checkInterval
    });
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Health monitoring stopped', { serviceName: this.serviceName });
  }

  /**
   * Collect current system metrics
   */
  collectMetrics() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    // Calculate CPU usage (simplified - average load)
    const cpuLoad = os.loadavg()[0]; // 1-minute load average
    const cpuCount = os.cpus().length;
    const cpuUsagePercent = (cpuLoad / cpuCount) * 100;

    // Calculate uptime
    const uptimeSeconds = Math.floor((Date.now() - this.metrics.startTime) / 1000);

    // Calculate error rate (errors per minute)
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentErrors = this.metrics.lastErrors.filter((e) => e.timestamp > oneMinuteAgo);
    const errorRate = recentErrors.length;

    // Calculate response times
    const recentResponseTimes = this.metrics.responseTimes.slice(-100); // Last 100 requests
    const avgResponseTime =
      recentResponseTimes.length > 0
        ? recentResponseTimes.reduce((a, b) => a + b, 0) / recentResponseTimes.length
        : 0;

    const sortedResponseTimes = [...recentResponseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedResponseTimes.length * 0.95);
    const p99Index = Math.floor(sortedResponseTimes.length * 0.99);
    const p95ResponseTime = sortedResponseTimes[p95Index] || 0;
    const p99ResponseTime = sortedResponseTimes[p99Index] || 0;

    return {
      service_name: this.serviceName,
      cpu_usage_percent: Math.round(cpuUsagePercent * 100) / 100,
      memory_usage_mb: Math.round(usedMemory / 1024 / 1024),
      memory_usage_percent: Math.round(memoryUsagePercent * 100) / 100,
      error_rate: errorRate,
      response_time_avg_ms: Math.round(avgResponseTime),
      response_time_p95_ms: Math.round(p95ResponseTime),
      response_time_p99_ms: Math.round(p99ResponseTime),
      uptime_seconds: uptimeSeconds,
      metrics_data: {
        total_requests: this.metrics.requestCount,
        total_errors: this.metrics.errorCount,
        cpu_count: cpuCount,
        total_memory_mb: Math.round(totalMemory / 1024 / 1024),
        free_memory_mb: Math.round(freeMemory / 1024 / 1024),
        platform: os.platform(),
        node_version: process.version
      }
    };
  }

  /**
   * Determine health status based on metrics and thresholds
   */
  determineStatus(metrics) {
    const issues = [];

    // Check CPU
    if (metrics.cpu_usage_percent > this.thresholds.cpu_threshold_percent) {
      issues.push(`CPU usage high: ${metrics.cpu_usage_percent}%`);
    }

    // Check memory
    if (metrics.memory_usage_percent > this.thresholds.memory_threshold_percent) {
      issues.push(`Memory usage high: ${metrics.memory_usage_percent}%`);
    }

    // Check error rate
    if (metrics.error_rate > this.thresholds.error_rate_threshold) {
      issues.push(`Error rate high: ${metrics.error_rate} errors/min`);
    }

    // Check response time
    if (metrics.response_time_avg_ms > this.thresholds.response_time_threshold_ms) {
      issues.push(`Response time high: ${metrics.response_time_avg_ms}ms`);
    }

    // Determine status
    let status;
    if (issues.length === 0) {
      status = 'healthy';
    } else if (issues.length === 1) {
      status = 'degraded';
    } else if (issues.length === 2) {
      status = 'unhealthy';
    } else {
      status = 'critical';
    }

    return { status, issues };
  }

  /**
   * Perform a health check and store metrics
   *
   * Issue #1798: Handle null pool gracefully - skip database storage if not configured
   */
  async performHealthCheck() {
    try {
      const metrics = this.collectMetrics();
      const { status, issues } = this.determineStatus(metrics);

      // Try to store metrics in database if pool is configured
      if (pool) {
        try {
          await pool.query(
            `INSERT INTO backend_health_metrics (
              service_name,
              status,
              cpu_usage_percent,
              memory_usage_mb,
              memory_usage_percent,
              error_rate,
              response_time_avg_ms,
              response_time_p95_ms,
              response_time_p99_ms,
              uptime_seconds,
              metrics_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              metrics.service_name,
              status,
              metrics.cpu_usage_percent,
              metrics.memory_usage_mb,
              metrics.memory_usage_percent,
              metrics.error_rate,
              metrics.response_time_avg_ms,
              metrics.response_time_p95_ms,
              metrics.response_time_p99_ms,
              metrics.uptime_seconds,
              JSON.stringify(metrics.metrics_data)
            ]
          );
        } catch (dbError) {
          // Check if error is due to missing table
          const isMissingTable = dbError.message && (
            dbError.message.includes('relation "backend_health_metrics" does not exist') ||
            dbError.message.includes('does not exist')
          );

          if (isMissingTable) {
            // Only log this warning once per monitoring session
            if (!this._missingTableWarningShown) {
              logger.warn('Cannot store health metrics: database tables not created. Metrics collection continues in-memory only.', {
                serviceName: this.serviceName
              });
              this._missingTableWarningShown = true;
            }
          } else {
            // Log other database errors
            logger.error('Failed to store health metrics in database', {
              error: dbError.message,
              serviceName: this.serviceName
            });
          }
        }
      } else {
        // Database not configured - skip storage (only log once)
        if (!this._noDatabaseWarningShown) {
          logger.debug('Database not configured - health metrics stored in-memory only', {
            serviceName: this.serviceName
          });
          this._noDatabaseWarningShown = true;
        }
      }

      if (status !== 'healthy') {
        logger.warn('Health check detected issues', {
          serviceName: this.serviceName,
          status,
          issues,
          metrics
        });
      } else {
        logger.debug('Health check passed', {
          serviceName: this.serviceName,
          status,
          metrics
        });
      }

      return { status, metrics, issues };
    } catch (error) {
      logger.error('Failed to perform health check', {
        error: error.message,
        stack: error.stack,
        serviceName: this.serviceName
      });
      throw error;
    }
  }

  /**
   * Record a request (for metrics)
   */
  recordRequest(responseTime) {
    this.metrics.requestCount++;
    if (responseTime) {
      this.metrics.responseTimes.push(responseTime);
      // Fix #2157: Use limitArraySize to prevent memory spikes during bursts
      // Previous approach (shift after 1000) could fail under high load
      limitArraySize(this.metrics.responseTimes, 1000);
    }
  }

  /**
   * Record an error (for metrics)
   */
  recordError(error, context = {}) {
    this.metrics.errorCount++;
    this.metrics.lastErrors.push({
      timestamp: Date.now(),
      message: error.message || String(error),
      context
    });
    // Fix #2157: Use limitArraySize to prevent memory spikes during error bursts
    // Previous approach (shift after 100) could fail under high error rate
    limitArraySize(this.metrics.lastErrors, 100);
  }

  /**
   * Get current health status
   */
  async getCurrentHealth() {
    const metrics = this.collectMetrics();
    const { status, issues } = this.determineStatus(metrics);
    return {
      status,
      metrics,
      issues,
      thresholds: this.thresholds,
      isMonitoring: this.isRunning
    };
  }

  /**
   * Get health history from database
   *
   * Issue #1798: Handle null pool gracefully
   */
  async getHealthHistory(hours = 24) {
    if (!pool) {
      logger.debug('Database not configured - cannot retrieve health history', {
        serviceName: this.serviceName
      });
      return [];
    }

    try {
      const result = await pool.query(
        `SELECT * FROM backend_health_metrics
         WHERE service_name = $1
           AND timestamp > NOW() - INTERVAL '${hours} hours'
         ORDER BY timestamp DESC
         LIMIT 1000`,
        [this.serviceName]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get health history', {
        error: error.message,
        serviceName: this.serviceName
      });
      return [];
    }
  }

  /**
   * Clean up old metrics (called periodically)
   *
   * Issue #1798: Handle null pool gracefully
   */
  async cleanupOldMetrics(daysToKeep = 30) {
    if (!pool) {
      logger.debug('Database not configured - cannot clean up old metrics');
      return 0;
    }

    try {
      const result = await pool.query(
        `DELETE FROM backend_health_metrics
         WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'`,
        []
      );

      logger.info('Old health metrics cleaned up', {
        deletedCount: result.rowCount,
        daysToKeep
      });

      return result.rowCount;
    } catch (error) {
      logger.error('Failed to clean up old metrics', {
        error: error.message
      });
      return 0;
    }
  }
}

export default BackendHealthMonitor;
