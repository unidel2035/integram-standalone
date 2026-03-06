/**
 * Structured logging utility with support for different log levels
 * Supports both development and production environments
 *
 * Production Behavior (Issue #3984):
 * - Logger is disabled by default in production mode (import.meta.env.PROD)
 * - console.* calls are removed from production builds via esbuild drop config
 * - Can be explicitly disabled with VITE_DISABLE_LOGGING=true (Issue #3806)
 *
 * Development Behavior:
 * - Logger is enabled by default
 * - All console.* calls preserved for debugging
 * - Log levels: DEBUG, INFO, WARN, ERROR, CRITICAL
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
}

const LOG_LEVEL_NAMES = {
  0: 'DEBUG',
  1: 'INFO',
  2: 'WARN',
  3: 'ERROR',
  4: 'CRITICAL'
}

// Check if logging is disabled via environment variable (Issue #3806, #3984)
// In production mode, logging is disabled by default unless explicitly enabled
const LOGGING_DISABLED = import.meta.env.VITE_DISABLE_LOGGING === 'true' ||
                         import.meta.env.VITE_DISABLE_LOGGING === '1' ||
                         import.meta.env.PROD

class Logger {
  constructor(options = {}) {
    this.minLevel = options.minLevel || (import.meta.env.PROD ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG)
    // Disable logging if VITE_DISABLE_LOGGING is set or in production mode (Issue #3806, #3984)
    this.enabled = LOGGING_DISABLED ? false : (options.enabled !== false)
    this.context = options.context || {}
    this.handlers = options.handlers || []
  }

  _shouldLog(level) {
    return this.enabled && level >= this.minLevel
  }

  _formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString()
    const levelName = LOG_LEVEL_NAMES[level]

    return {
      timestamp,
      level: levelName,
      message,
      ...this.context,
      ...data,
      env: import.meta.env.MODE
    }
  }

  _log(level, message, data = {}) {
    const logEntry = this._formatMessage(level, message, data)

    if (!this._shouldLog(level)) {
      return logEntry
    }

    // Console output with appropriate method
    if (import.meta.env.DEV) {
      const consoleMethod = level >= LOG_LEVELS.ERROR ? 'error' :
                           level >= LOG_LEVELS.WARN ? 'warn' :
                           level >= LOG_LEVELS.INFO ? 'info' : 'log'

      // Log message and data separately to ensure proper object expansion
      console[consoleMethod](`[${logEntry.level}] ${logEntry.message}`)

      // Only log data if it has properties
      if (data && Object.keys(data).length > 0) {
        console[consoleMethod](data)
      }
    }

    // Call registered handlers (for sending to external services)
    this.handlers.forEach(handler => {
      try {
        handler(logEntry)
      } catch (error) {
        console.error('Logger handler error:', error)
      }
    })

    return logEntry
  }

  debug(message, data) {
    return this._log(LOG_LEVELS.DEBUG, message, data)
  }

  info(message, data) {
    return this._log(LOG_LEVELS.INFO, message, data)
  }

  warn(message, data) {
    return this._log(LOG_LEVELS.WARN, message, data)
  }

  error(message, data) {
    return this._log(LOG_LEVELS.ERROR, message, data)
  }

  critical(message, data) {
    return this._log(LOG_LEVELS.CRITICAL, message, data)
  }

  addHandler(handler) {
    if (typeof handler === 'function') {
      this.handlers.push(handler)
    }
  }

  setContext(context) {
    this.context = { ...this.context, ...context }
  }

  /**
   * Create a console group for organizing related logs
   * @param {string} label - Group label
   */
  group(label) {
    if (import.meta.env.DEV && console.group) {
      console.group(label)
    }
  }

  /**
   * End the current console group
   */
  groupEnd() {
    if (import.meta.env.DEV && console.groupEnd) {
      console.groupEnd()
    }
  }

  /**
   * Create a collapsed console group
   * @param {string} label - Group label
   */
  groupCollapsed(label) {
    if (import.meta.env.DEV && console.groupCollapsed) {
      console.groupCollapsed(label)
    }
  }
}

// Create default logger instance
export const logger = new Logger()

// Export Logger class for custom instances
export { Logger, LOG_LEVELS }
