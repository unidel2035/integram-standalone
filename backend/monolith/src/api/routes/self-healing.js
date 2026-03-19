/**
 * Self-Healing API Routes
 * Issue #1674: Система самолечения бэкэнда
 *
 * API endpoints for managing backend self-healing system
 */

import express from 'express';
import logger from '../../utils/logger.js';
import { pool } from '../../config/database.js';

const router = express.Router();

/**
 * GET /api/self-healing/health
 * Get current health status
 */
router.get('/health', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM backend_service_health_summary
      ORDER BY timestamp DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Failed to get health status', { error: error.message });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get health status' }
    });
  }
});

/**
 * GET /api/self-healing/errors
 * Get recent backend errors
 */
router.get('/errors', async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      severity,
      service_name,
      resolved,
      hours = 24
    } = req.query;

    let query = `
      SELECT * FROM backend_error_logs
      WHERE timestamp > NOW() - INTERVAL '${parseInt(hours)} hours'
    `;

    const params = [];
    let paramIndex = 1;

    if (severity) {
      query += ` AND severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    if (service_name) {
      query += ` AND service_name = $${paramIndex}`;
      params.push(service_name);
      paramIndex++;
    }

    if (resolved !== undefined) {
      query += ` AND resolved = $${paramIndex}`;
      params.push(resolved === 'true');
      paramIndex++;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) FROM backend_error_logs
      WHERE timestamp > NOW() - INTERVAL '${parseInt(hours)} hours'
    `;
    const countParams = [];
    let countParamIndex = 1;

    if (severity) {
      countQuery += ` AND severity = $${countParamIndex}`;
      countParams.push(severity);
      countParamIndex++;
    }

    if (service_name) {
      countQuery += ` AND service_name = $${countParamIndex}`;
      countParams.push(service_name);
      countParamIndex++;
    }

    if (resolved !== undefined) {
      countQuery += ` AND resolved = $${countParamIndex}`;
      countParams.push(resolved === 'true');
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + result.rows.length < total
      }
    });
  } catch (error) {
    logger.error('Failed to get errors', { error: error.message });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get errors' }
    });
  }
});

/**
 * GET /api/self-healing/errors/:id
 * Get specific error details
 */
router.get('/errors/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const errorResult = await pool.query(
      'SELECT * FROM backend_error_logs WHERE id = $1',
      [id]
    );

    if (errorResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Error not found' }
      });
    }

    const recoveryResult = await pool.query(
      'SELECT * FROM backend_recovery_actions WHERE error_log_id = $1 ORDER BY started_at DESC',
      [id]
    );

    res.json({
      success: true,
      data: {
        error: errorResult.rows[0],
        recoveryActions: recoveryResult.rows
      }
    });
  } catch (error) {
    logger.error('Failed to get error details', { error: error.message });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get error details' }
    });
  }
});

/**
 * GET /api/self-healing/critical-errors
 * Get recent critical errors (view)
 */
router.get('/critical-errors', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM backend_critical_errors LIMIT 100'
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Failed to get critical errors', { error: error.message });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get critical errors' }
    });
  }
});

/**
 * GET /api/self-healing/recovery-actions
 * Get recovery action history
 */
router.get('/recovery-actions', async (req, res) => {
  try {
    const { limit = 50, offset = 0, status, action_type } = req.query;

    let query = 'SELECT * FROM backend_recovery_actions WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (action_type) {
      query += ` AND action_type = $${paramIndex}`;
      params.push(action_type);
      paramIndex++;
    }

    query += ` ORDER BY started_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Failed to get recovery actions', { error: error.message });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get recovery actions' }
    });
  }
});

/**
 * GET /api/self-healing/recovery-stats
 * Get recovery action statistics
 */
router.get('/recovery-stats', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM backend_recovery_stats');

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Failed to get recovery stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get recovery stats' }
    });
  }
});

/**
 * GET /api/self-healing/metrics
 * Get health metrics history
 */
router.get('/metrics', async (req, res) => {
  try {
    const { service_name, hours = 24, limit = 1000 } = req.query;

    let query = `
      SELECT * FROM backend_health_metrics
      WHERE timestamp > NOW() - INTERVAL '${parseInt(hours)} hours'
    `;

    const params = [];
    if (service_name) {
      query += ' AND service_name = $1';
      params.push(service_name);
    }

    query += ` ORDER BY timestamp DESC LIMIT ${parseInt(limit)}`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Failed to get metrics', { error: error.message });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get metrics' }
    });
  }
});

/**
 * GET /api/self-healing/config
 * Get self-healing configuration
 */
router.get('/config', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM backend_health_config ORDER BY service_name');

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Failed to get configuration', { error: error.message });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get configuration' }
    });
  }
});

/**
 * PUT /api/self-healing/config/:service_name
 * Update self-healing configuration
 */
router.put('/config/:service_name', async (req, res) => {
  try {
    const { service_name } = req.params;
    const {
      enabled,
      check_interval_seconds,
      cpu_threshold_percent,
      memory_threshold_percent,
      error_rate_threshold,
      response_time_threshold_ms,
      auto_recovery_enabled,
      auto_restart_enabled,
      max_restart_attempts,
      restart_cooldown_minutes,
      notify_on_error
    } = req.body;

    const updateFields = [];
    const params = [service_name];
    let paramIndex = 2;

    if (enabled !== undefined) {
      updateFields.push(`enabled = $${paramIndex}`);
      params.push(enabled);
      paramIndex++;
    }

    if (check_interval_seconds !== undefined) {
      updateFields.push(`check_interval_seconds = $${paramIndex}`);
      params.push(check_interval_seconds);
      paramIndex++;
    }

    if (cpu_threshold_percent !== undefined) {
      updateFields.push(`cpu_threshold_percent = $${paramIndex}`);
      params.push(cpu_threshold_percent);
      paramIndex++;
    }

    if (memory_threshold_percent !== undefined) {
      updateFields.push(`memory_threshold_percent = $${paramIndex}`);
      params.push(memory_threshold_percent);
      paramIndex++;
    }

    if (error_rate_threshold !== undefined) {
      updateFields.push(`error_rate_threshold = $${paramIndex}`);
      params.push(error_rate_threshold);
      paramIndex++;
    }

    if (response_time_threshold_ms !== undefined) {
      updateFields.push(`response_time_threshold_ms = $${paramIndex}`);
      params.push(response_time_threshold_ms);
      paramIndex++;
    }

    if (auto_recovery_enabled !== undefined) {
      updateFields.push(`auto_recovery_enabled = $${paramIndex}`);
      params.push(auto_recovery_enabled);
      paramIndex++;
    }

    if (auto_restart_enabled !== undefined) {
      updateFields.push(`auto_restart_enabled = $${paramIndex}`);
      params.push(auto_restart_enabled);
      paramIndex++;
    }

    if (max_restart_attempts !== undefined) {
      updateFields.push(`max_restart_attempts = $${paramIndex}`);
      params.push(max_restart_attempts);
      paramIndex++;
    }

    if (restart_cooldown_minutes !== undefined) {
      updateFields.push(`restart_cooldown_minutes = $${paramIndex}`);
      params.push(restart_cooldown_minutes);
      paramIndex++;
    }

    if (notify_on_error !== undefined) {
      updateFields.push(`notify_on_error = $${paramIndex}`);
      params.push(notify_on_error);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No fields to update' }
      });
    }

    const query = `
      UPDATE backend_health_config
      SET ${updateFields.join(', ')}
      WHERE service_name = $1
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Configuration not found' }
      });
    }

    logger.info('Self-healing configuration updated', {
      service_name,
      updatedFields: updateFields
    });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to update configuration', { error: error.message });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update configuration' }
    });
  }
});

/**
 * GET /api/self-healing/error-patterns
 * Get error patterns
 */
router.get('/error-patterns', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM backend_error_patterns ORDER BY occurrence_count DESC'
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Failed to get error patterns', { error: error.message });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get error patterns' }
    });
  }
});

/**
 * POST /api/self-healing/error-patterns
 * Create new error pattern
 */
router.post('/error-patterns', async (req, res) => {
  try {
    const {
      pattern_name,
      pattern_type,
      pattern_matcher,
      error_category,
      recovery_strategy,
      severity,
      auto_create_issue
    } = req.body;

    if (!pattern_name || !pattern_type || !pattern_matcher) {
      return res.status(400).json({
        success: false,
        error: { message: 'pattern_name, pattern_type, and pattern_matcher are required' }
      });
    }

    const result = await pool.query(
      `INSERT INTO backend_error_patterns (
        pattern_name,
        pattern_type,
        pattern_matcher,
        error_category,
        recovery_strategy,
        severity,
        auto_create_issue
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        pattern_name,
        pattern_type,
        pattern_matcher,
        error_category || null,
        recovery_strategy || 'log_and_continue',
        severity || 'medium',
        auto_create_issue !== false
      ]
    );

    logger.info('Error pattern created', { pattern_name });

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to create error pattern', { error: error.message });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create error pattern' }
    });
  }
});

/**
 * GET /api/self-healing/restart-history
 * Get service restart history
 */
router.get('/restart-history', async (req, res) => {
  try {
    const { service_name, limit = 50 } = req.query;

    let query = 'SELECT * FROM backend_restart_history WHERE 1=1';
    const params = [];

    if (service_name) {
      query += ' AND service_name = $1';
      params.push(service_name);
    }

    query += ` ORDER BY started_at DESC LIMIT ${parseInt(limit)}`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Failed to get restart history', { error: error.message });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get restart history' }
    });
  }
});

/**
 * POST /api/self-healing/errors/:id/resolve
 * Mark an error as resolved
 */
router.post('/errors/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution_method, close_github_issue } = req.body;

    const result = await pool.query(
      `UPDATE backend_error_logs
       SET resolved = true,
           resolved_at = CURRENT_TIMESTAMP,
           resolution_method = $1
       WHERE id = $2
       RETURNING *`,
      [resolution_method || 'manual_fix', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Error not found' }
      });
    }

    const errorLog = result.rows[0];

    // Close GitHub issue if requested
    if (close_github_issue && errorLog.github_issue_number) {
      // This would be handled by GitHubIssueService
      logger.info('GitHub issue close requested', {
        issueNumber: errorLog.github_issue_number
      });
    }

    logger.info('Error marked as resolved', { id });

    res.json({
      success: true,
      data: errorLog
    });
  } catch (error) {
    logger.error('Failed to resolve error', { error: error.message });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to resolve error' }
    });
  }
});

/**
 * GET /api/self-healing/stats
 * Get overall statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { hours = 24 } = req.query;

    const stats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_errors,
        COUNT(*) FILTER (WHERE severity = 'high') as high_errors,
        COUNT(*) FILTER (WHERE severity = 'medium') as medium_errors,
        COUNT(*) FILTER (WHERE severity = 'low') as low_errors,
        COUNT(*) FILTER (WHERE resolved = true) as resolved_errors,
        COUNT(*) FILTER (WHERE resolved = false) as unresolved_errors,
        COUNT(DISTINCT service_name) as affected_services,
        COUNT(DISTINCT github_issue_number) FILTER (WHERE github_issue_number IS NOT NULL) as github_issues_created
      FROM backend_error_logs
      WHERE timestamp > NOW() - INTERVAL '${parseInt(hours)} hours'
    `);

    const recoveryStats = await pool.query(`
      SELECT
        COUNT(*) as total_actions,
        COUNT(*) FILTER (WHERE success = true) as successful_actions,
        COUNT(*) FILTER (WHERE success = false) as failed_actions,
        AVG(duration_ms) as avg_duration_ms
      FROM backend_recovery_actions
      WHERE started_at > NOW() - INTERVAL '${parseInt(hours)} hours'
    `);

    res.json({
      success: true,
      data: {
        errors: stats.rows[0],
        recovery: recoveryStats.rows[0],
        period_hours: parseInt(hours)
      }
    });
  } catch (error) {
    logger.error('Failed to get statistics', { error: error.message });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get statistics' }
    });
  }
});

export function createSelfHealingRoutes() {
  return router;
}

export default router;
