// logs.js - Log retrieval routes (Issue #2140)
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Log file configurations
 * These paths should match the actual log file locations in production
 * Using home directory paths (~ expands to user's home directory)
 */
const LOG_CONFIGS = {
  // Development logs (dev.drondoc.ru)
  'dronedoc_dev_update': {
    name: 'Dev Full Update Log',
    path: path.join(process.env.HOME || '/root', 'dronedoc_dev_update.log'),
    description: 'Full deployment log for dev.drondoc.ru'
  },
  'dronedoc_dev_update_last': {
    name: 'Dev Last Update Log',
    path: path.join(process.env.HOME || '/root', 'dronedoc_dev_update_last.log'),
    description: 'Last deployment log for dev.drondoc.ru'
  },

  // Production logs (drondoc.ru)
  'dronedoc_update': {
    name: 'Production Full Update Log',
    path: path.join(process.env.HOME || '/root', 'dronedoc_update.log'),
    description: 'Full deployment log for drondoc.ru'
  },
  'dronedoc_update_last': {
    name: 'Production Last Update Log',
    path: path.join(process.env.HOME || '/root', 'dronedoc_update_last.log'),
    description: 'Last deployment log for drondoc.ru'
  },

  // Backend/monolith logs (PM2)
  'backend_monolith_out': {
    name: 'Backend Output Log',
    path: '/var/log/dronedoc/pm2-out.log',
    description: 'Backend monolith stdout log (PM2)'
  },
  'backend_monolith_error': {
    name: 'Backend Error Log',
    path: '/var/log/dronedoc/pm2-error.log',
    description: 'Backend monolith stderr log (PM2)'
  },
  'backend_monolith_combined': {
    name: 'Backend Combined Log',
    path: '/var/log/dronedoc/pm2-combined.log',
    description: 'Backend monolith combined log (PM2)'
  },

  // Application logs (written by pino logger)
  'backend_app': {
    name: 'Backend Application Log',
    path: '/var/log/dronedoc/backend-app.log',
    description: 'Backend application logs (pino)'
  }
};

/**
 * Create logs routes
 */
export function createLogsRoutes() {
  const router = express.Router();

  /**
   * GET /api/logs - List all available logs
   */
  router.get('/', async (req, res) => {
    try {
      const availableLogs = [];

      // Check which log files exist
      for (const [key, config] of Object.entries(LOG_CONFIGS)) {
        try {
          const stats = await fs.stat(config.path);
          availableLogs.push({
            key,
            name: config.name,
            description: config.description,
            path: config.path,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            exists: true
          });
        } catch (error) {
          // File doesn't exist or can't be accessed
          availableLogs.push({
            key,
            name: config.name,
            description: config.description,
            path: config.path,
            exists: false,
            error: error.code === 'ENOENT' ? 'File not found' : 'Access denied'
          });
        }
      }

      res.json({
        success: true,
        logs: availableLogs,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to list logs');
      res.status(500).json({
        success: false,
        error: 'Failed to list logs',
        message: error.message
      });
    }
  });

  /**
   * GET /api/logs/:logKey - Retrieve specific log content
   * Query params:
   *   - lines: Number of lines to retrieve (default: 1000, max: 10000)
   *   - tail: If true, get last N lines (default: true)
   *   - offset: Line offset for pagination (default: 0)
   */
  router.get('/:logKey', async (req, res) => {
    try {
      const { logKey } = req.params;
      const lines = Math.min(parseInt(req.query.lines) || 1000, 10000);
      const tail = req.query.tail !== 'false'; // Default to tail mode
      const offset = parseInt(req.query.offset) || 0;

      // Validate log key
      const logConfig = LOG_CONFIGS[logKey];
      if (!logConfig) {
        return res.status(404).json({
          success: false,
          error: 'Log not found',
          message: `Log key '${logKey}' is not recognized`,
          availableKeys: Object.keys(LOG_CONFIGS)
        });
      }

      // Check if file exists
      try {
        await fs.access(logConfig.path, fs.constants.R_OK);
      } catch (error) {
        return res.status(404).json({
          success: false,
          error: 'Log file not accessible',
          message: `Log file at ${logConfig.path} does not exist or is not readable`,
          logKey,
          logName: logConfig.name
        });
      }

      // Read log file
      const content = await fs.readFile(logConfig.path, 'utf-8');
      const allLines = content.split('\n');

      let selectedLines;
      if (tail) {
        // Get last N lines
        selectedLines = allLines.slice(-lines - offset, allLines.length - offset);
      } else {
        // Get first N lines starting from offset
        selectedLines = allLines.slice(offset, offset + lines);
      }

      // Get file stats
      const stats = await fs.stat(logConfig.path);

      res.json({
        success: true,
        logKey,
        logName: logConfig.name,
        description: logConfig.description,
        path: logConfig.path,
        content: selectedLines.join('\n'),
        meta: {
          totalLines: allLines.length,
          returnedLines: selectedLines.length,
          offset,
          tail,
          fileSize: stats.size,
          modified: stats.mtime.toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error({ error: error.message, logKey: req.params.logKey }, 'Failed to retrieve log');
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve log',
        message: error.message
      });
    }
  });

  /**
   * GET /api/logs/:logKey/download - Download log file
   */
  router.get('/:logKey/download', async (req, res) => {
    try {
      const { logKey } = req.params;

      // Validate log key
      const logConfig = LOG_CONFIGS[logKey];
      if (!logConfig) {
        return res.status(404).json({
          success: false,
          error: 'Log not found',
          message: `Log key '${logKey}' is not recognized`
        });
      }

      // Check if file exists
      try {
        await fs.access(logConfig.path, fs.constants.R_OK);
      } catch (error) {
        return res.status(404).json({
          success: false,
          error: 'Log file not accessible',
          message: `Log file at ${logConfig.path} does not exist or is not readable`
        });
      }

      // Send file for download
      const filename = path.basename(logConfig.path);
      res.download(logConfig.path, filename, (err) => {
        if (err) {
          logger.error({ error: err.message, logKey }, 'Failed to download log');
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              error: 'Failed to download log',
              message: err.message
            });
          }
        }
      });
    } catch (error) {
      logger.error({ error: error.message, logKey: req.params.logKey }, 'Failed to download log');
      res.status(500).json({
        success: false,
        error: 'Failed to download log',
        message: error.message
      });
    }
  });

  /**
   * DELETE /api/logs/:logKey - Clear log file (requires authorization)
   * This endpoint truncates the log file without deleting it
   */
  router.delete('/:logKey', async (req, res) => {
    try {
      const { logKey } = req.params;

      // Validate log key
      const logConfig = LOG_CONFIGS[logKey];
      if (!logConfig) {
        return res.status(404).json({
          success: false,
          error: 'Log not found',
          message: `Log key '${logKey}' is not recognized`
        });
      }

      // Check if file exists
      try {
        await fs.access(logConfig.path, fs.constants.W_OK);
      } catch (error) {
        return res.status(404).json({
          success: false,
          error: 'Log file not accessible',
          message: `Log file at ${logConfig.path} does not exist or is not writable`
        });
      }

      // Truncate log file
      await fs.writeFile(logConfig.path, '');
      logger.info({ logKey, path: logConfig.path }, 'Log file cleared');

      res.json({
        success: true,
        message: 'Log file cleared successfully',
        logKey,
        logName: logConfig.name,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error({ error: error.message, logKey: req.params.logKey }, 'Failed to clear log');
      res.status(500).json({
        success: false,
        error: 'Failed to clear log',
        message: error.message
      });
    }
  });

  return router;
}
