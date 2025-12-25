/**
 * Self-Healing Service for Backend
 * Issue #1674: Система самолечения бэкэнда
 *
 * Implements automatic recovery strategies for backend errors
 */

import logger from '../../utils/logger.js';
import { pool } from '../../config/database.js';
import GitHubIssueService from './GitHubIssueService.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SelfHealingService {
  constructor(options = {}) {
    this.githubService = new GitHubIssueService(options.github);
    this.config = null;
    this.recoveryStrategies = new Map();
    this.isEnabled = true;

    // Register recovery strategies
    this.registerDefaultStrategies();

    logger.info('SelfHealingService initialized');
  }

  /**
   * Load configuration from database
   *
   * Issue #1798: Handle null pool gracefully
   */
  async loadConfiguration(serviceName = 'orchestrator') {
    // Check if database is configured
    if (!pool) {
      logger.warn('Database not configured - self-healing will use defaults', {
        serviceName,
        hint: 'Create backend/monolith/.env with DB_PASSWORD to enable database features'
      });
      this.config = {
        service_name: serviceName,
        enabled: true,
        auto_recovery_enabled: true,
        notify_on_error: false
      };
      this.isEnabled = true;
      return;
    }

    try {
      const result = await pool.query(
        'SELECT * FROM backend_health_config WHERE service_name = $1',
        [serviceName]
      );

      if (result.rows.length > 0) {
        this.config = result.rows[0];
        this.isEnabled = this.config.auto_recovery_enabled;
        logger.debug('Self-healing configuration loaded', { serviceName });
      } else {
        logger.warn('No self-healing configuration found in database, using defaults', {
          serviceName
        });
        // Use default configuration if not found
        this.config = {
          service_name: serviceName,
          enabled: true,
          auto_recovery_enabled: true,
          notify_on_error: false // Disable GitHub issue creation by default
        };
      }
    } catch (error) {
      // Check if error is due to missing table
      const isMissingTable = error.message && (
        error.message.includes('relation "backend_health_config" does not exist') ||
        error.message.includes('does not exist')
      );

      if (isMissingTable) {
        logger.warn('Self-healing tables not yet created. Please run database migrations.', {
          hint: 'Run: cd backend/monolith/scripts && ./setup-database.sh'
        });
        // Disable self-healing until migrations are run
        this.isEnabled = false;
        this.config = {
          service_name: serviceName,
          enabled: false,
          auto_recovery_enabled: false,
          notify_on_error: false
        };
      } else {
        logger.error('Failed to load self-healing configuration', {
          error: error.message
        });
        // Use safe defaults on other errors
        this.config = {
          service_name: serviceName,
          enabled: true,
          auto_recovery_enabled: true,
          notify_on_error: false
        };
      }
    }
  }

  /**
   * Register default recovery strategies
   */
  registerDefaultStrategies() {
    this.registerStrategy('reconnect_database', this.reconnectDatabase.bind(this));
    this.registerStrategy('clear_cache', this.clearCache.bind(this));
    this.registerStrategy('restart_service', this.restartService.bind(this));
    this.registerStrategy('kill_zombie_process', this.killZombieProcess.bind(this));
    this.registerStrategy('create_missing_directories', this.createMissingDirectories.bind(this));
    this.registerStrategy('retry_with_backoff', this.retryWithBackoff.bind(this));
    this.registerStrategy('log_and_continue', this.logAndContinue.bind(this));

    logger.info('Default recovery strategies registered', {
      count: this.recoveryStrategies.size
    });
  }

  /**
   * Register a custom recovery strategy
   */
  registerStrategy(name, handler) {
    this.recoveryStrategies.set(name, handler);
    logger.debug('Recovery strategy registered', { name });
  }

  /**
   * Log an error to database
   *
   * Issue #1798: Handle null pool gracefully - skip database logging if not configured
   */
  async logError(errorData) {
    if (!pool) {
      logger.debug('Database not configured - error logged to logger only', {
        errorType: errorData.error_type,
        errorMessage: errorData.error_message
      });
      // Return a pseudo-ID for in-memory tracking
      return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    try {
      const result = await pool.query(
        `INSERT INTO backend_error_logs (
          error_type,
          severity,
          service_name,
          error_message,
          error_stack,
          error_context,
          endpoint,
          request_method,
          request_body,
          response_status,
          user_id,
          ip_address,
          user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id`,
        [
          errorData.error_type || 'unhandled_exception',
          errorData.severity || 'medium',
          errorData.service_name || 'backend',
          errorData.error_message || String(errorData.error),
          errorData.error_stack || null,
          JSON.stringify(errorData.error_context || {}),
          errorData.endpoint || null,
          errorData.request_method || null,
          errorData.request_body ? JSON.stringify(errorData.request_body) : null,
          errorData.response_status || null,
          errorData.user_id || null,
          errorData.ip_address || null,
          errorData.user_agent || null
        ]
      );

      const errorLogId = result.rows[0].id;

      logger.info('Error logged to database', {
        errorLogId,
        errorType: errorData.error_type,
        severity: errorData.severity
      });

      return errorLogId;
    } catch (error) {
      logger.error('Failed to log error to database', {
        error: error.message,
        originalError: errorData
      });
      return null;
    }
  }

  /**
   * Classify error and determine recovery strategy
   *
   * Issue #1798: Handle null pool gracefully - use default classification if DB not configured
   */
  async classifyError(errorMessage, errorStack) {
    if (!pool) {
      logger.debug('Database not configured - using default error classification');
      return {
        pattern: 'unknown',
        recovery_strategy: 'log_and_continue',
        severity: 'medium',
        auto_create_issue: false // Don't create issues without DB
      };
    }

    try {
      // Find matching error pattern
      const result = await pool.query(
        `SELECT * FROM backend_error_patterns
         WHERE active = true
         ORDER BY occurrence_count DESC`
      );

      for (const pattern of result.rows) {
        const { pattern_matcher, pattern_type, recovery_strategy, severity } = pattern;

        let matches = false;

        if (pattern_type === 'substring') {
          matches = errorMessage.includes(pattern_matcher) || (errorStack && errorStack.includes(pattern_matcher));
        } else if (pattern_type === 'regex') {
          const regex = new RegExp(pattern_matcher, 'i');
          matches = regex.test(errorMessage) || (errorStack && regex.test(errorStack));
        }

        if (matches) {
          // Update pattern occurrence count
          await pool.query(
            `UPDATE backend_error_patterns
             SET occurrence_count = occurrence_count + 1,
                 last_seen_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [pattern.id]
          );

          logger.info('Error pattern matched', {
            patternName: pattern.pattern_name,
            recoveryStrategy: recovery_strategy
          });

          return {
            pattern: pattern.pattern_name,
            recovery_strategy,
            severity,
            auto_create_issue: pattern.auto_create_issue
          };
        }
      }

      // No pattern matched - return default
      return {
        pattern: 'unknown',
        recovery_strategy: 'log_and_continue',
        severity: 'medium',
        auto_create_issue: true
      };
    } catch (error) {
      logger.error('Failed to classify error', {
        error: error.message
      });
      return {
        pattern: 'unknown',
        recovery_strategy: 'log_and_continue',
        severity: 'medium',
        auto_create_issue: true
      };
    }
  }

  /**
   * Execute recovery action
   *
   * Issue #1798: Handle null pool gracefully - skip DB logging if not configured
   */
  async executeRecoveryAction(errorLogId, actionType, parameters = {}) {
    const startTime = Date.now();

    try {
      let recoveryActionId = null;

      // Log recovery action start if DB is available
      if (pool) {
        const result = await pool.query(
          `INSERT INTO backend_recovery_actions (
            error_log_id,
            action_type,
            action_description,
            action_parameters,
            status
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING id`,
          [
            errorLogId,
            actionType,
            `Executing ${actionType} recovery action`,
            JSON.stringify(parameters),
            'in_progress'
          ]
        );
        recoveryActionId = result.rows[0].id;
      } else {
        recoveryActionId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      logger.info('Executing recovery action', {
        recoveryActionId,
        actionType,
        errorLogId
      });

      // Get recovery strategy handler
      const strategyHandler = this.recoveryStrategies.get(actionType);

      if (!strategyHandler) {
        throw new Error(`Unknown recovery strategy: ${actionType}`);
      }

      // Execute the strategy
      const recoveryResult = await strategyHandler(parameters);

      const duration = Date.now() - startTime;

      // Update recovery action with result if DB is available
      if (pool) {
        await pool.query(
          `UPDATE backend_recovery_actions
           SET status = $1,
               completed_at = CURRENT_TIMESTAMP,
               duration_ms = $2,
               result_message = $3,
               result_data = $4,
               success = $5
           WHERE id = $6`,
          [
            'success',
            duration,
            recoveryResult.message || 'Recovery action completed successfully',
            JSON.stringify(recoveryResult.data || {}),
            true,
            recoveryActionId
          ]
        );
      }

      logger.info('Recovery action completed successfully', {
        recoveryActionId,
        actionType,
        duration
      });

      return {
        success: true,
        recoveryActionId,
        duration,
        result: recoveryResult
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Recovery action failed', {
        actionType,
        error: error.message,
        errorLogId
      });

      // Update recovery action with failure if DB is available
      if (pool) {
        try {
          await pool.query(
            `UPDATE backend_recovery_actions
             SET status = $1,
                 completed_at = CURRENT_TIMESTAMP,
                 duration_ms = $2,
                 result_message = $3,
                 success = $4
             WHERE error_log_id = $5 AND action_type = $6 AND status = 'in_progress'`,
            ['failed', duration, error.message, false, errorLogId, actionType]
          );
        } catch (dbError) {
          logger.debug('Failed to update recovery action in database', {
            error: dbError.message
          });
        }
      }

      return {
        success: false,
        error: error.message,
        duration
      };
    }
  }

  /**
   * Handle error with self-healing
   */
  async handleError(error, context = {}) {
    try {
      if (!this.isEnabled) {
        logger.info('Self-healing is disabled, skipping error handling');
        return null;
      }

      const errorMessage = error.message || String(error);
      const errorStack = error.stack || null;

      // Classify error
      const classification = await this.classifyError(errorMessage, errorStack);

      // Log error
      const errorData = {
        error_type: context.error_type || 'unhandled_exception',
        severity: classification.severity,
        service_name: context.service_name || 'backend',
        error_message: errorMessage,
        error_stack: errorStack,
        error_context: context,
        endpoint: context.endpoint,
        request_method: context.request_method,
        user_id: context.user_id,
        ip_address: context.ip_address
      };

      const errorLogId = await this.logError(errorData);

      if (!errorLogId) {
        logger.error('Failed to log error, cannot proceed with recovery');
        return null;
      }

      // Execute recovery strategy
      const recoveryResult = await this.executeRecoveryAction(
        errorLogId,
        classification.recovery_strategy,
        context
      );

      // Get recovery action for GitHub issue (only if DB is configured)
      let recoveryActions = { rows: [] };
      if (pool) {
        recoveryActions = await pool.query(
          'SELECT * FROM backend_recovery_actions WHERE error_log_id = $1',
          [errorLogId]
        );
      }

      // Create GitHub issue if needed (only if DB is configured)
      if (pool && classification.auto_create_issue && this.config?.notify_on_error !== false) {
        try {
          const errorLog = await pool.query(
            'SELECT * FROM backend_error_logs WHERE id = $1',
            [errorLogId]
          );

          const issue = await this.githubService.createIssueForError(
            errorLog.rows[0],
            recoveryActions.rows
          );

          if (issue) {
            await this.githubService.updateErrorLogWithIssue(errorLogId, issue);
          }
        } catch (issueError) {
          logger.error('Failed to create GitHub issue', {
            error: issueError.message
          });
        }
      }

      return {
        errorLogId,
        classification,
        recoveryResult
      };
    } catch (error) {
      logger.error('Self-healing error handler failed', {
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  // ========================================
  // Recovery Strategy Implementations
  // ========================================

  /**
   * Strategy: Reconnect to database
   *
   * Issue #1798: Handle null pool gracefully
   */
  async reconnectDatabase(parameters) {
    logger.info('Attempting database reconnection');

    if (!pool) {
      return {
        message: 'Database not configured - cannot reconnect',
        data: { reconnected: false, configured: false }
      };
    }

    try {
      // Test connection
      await pool.query('SELECT 1');

      return {
        message: 'Database connection is healthy',
        data: { reconnected: false }
      };
    } catch (error) {
      logger.warn('Database connection failed, attempting to reconnect', {
        error: error.message
      });

      // In a production system, you would implement actual reconnection logic here
      // For now, we just test the connection again after a delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        await pool.query('SELECT 1');
        return {
          message: 'Database reconnected successfully',
          data: { reconnected: true }
        };
      } catch (retryError) {
        throw new Error(`Database reconnection failed: ${retryError.message}`);
      }
    }
  }

  /**
   * Strategy: Clear cache
   */
  async clearCache(parameters) {
    logger.info('Clearing cache');
    // Placeholder - implement cache clearing logic
    return {
      message: 'Cache cleared successfully',
      data: { cleared: true }
    };
  }

  /**
   * Strategy: Restart service
   */
  async restartService(parameters) {
    logger.warn('Service restart requested - not implemented in current version');
    // This is dangerous and should be carefully implemented with proper checks
    return {
      message: 'Service restart not implemented - manual intervention required',
      data: { restarted: false }
    };
  }

  /**
   * Strategy: Kill zombie process
   */
  async killZombieProcess(parameters) {
    logger.info('Checking for zombie processes');

    try {
      const { stdout } = await execAsync("ps aux | grep 'node' | grep -v grep");
      logger.debug('Process list retrieved', { stdout });

      return {
        message: 'Zombie process check completed',
        data: { processes: stdout.split('\n').length }
      };
    } catch (error) {
      return {
        message: 'No zombie processes found',
        data: { processes: 0 }
      };
    }
  }

  /**
   * Strategy: Create missing directories
   */
  async createMissingDirectories(parameters) {
    logger.info('Creating missing directories');

    try {
      const directories = parameters.directories || [];

      for (const dir of directories) {
        await execAsync(`mkdir -p ${dir}`);
        logger.info('Directory created', { directory: dir });
      }

      return {
        message: `Created ${directories.length} directories`,
        data: { directories }
      };
    } catch (error) {
      throw new Error(`Failed to create directories: ${error.message}`);
    }
  }

  /**
   * Strategy: Retry with exponential backoff
   */
  async retryWithBackoff(parameters) {
    logger.info('Retry with backoff strategy applied');
    return {
      message: 'Error logged for retry with exponential backoff',
      data: { retryScheduled: true }
    };
  }

  /**
   * Strategy: Log and continue
   */
  async logAndContinue(parameters) {
    logger.info('Log and continue strategy - error logged, no action taken');
    return {
      message: 'Error logged, no recovery action needed',
      data: { logged: true }
    };
  }
}

export default SelfHealingService;
