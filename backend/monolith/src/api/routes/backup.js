/**
 * Backup API Routes
 *
 * Endpoints for backup and disaster recovery operations
 *
 * @module api/routes/backup
 */

import express from 'express';
import { createLogger } from '../../utils/logger.js';
import BackupService from '../../services/backup/BackupService.js';

const router = express.Router();
const logger = createLogger('BackupAPI');

/**
 * Initialize backup service
 * Note: In production, this should be initialized once and reused
 */
function getBackupService(req) {
  return new BackupService({
    db: req.app.locals.db,
    config: {
      encryptionEnabled: process.env.BACKUP_ENCRYPTION_ENABLED !== 'false',
      encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
      s3Enabled: process.env.S3_ENABLED === 'true',
      s3BucketPrimary: process.env.S3_BUCKET_PRIMARY,
      s3BucketSecondary: process.env.S3_BUCKET_SECONDARY,
      s3RegionPrimary: process.env.S3_REGION_PRIMARY,
      s3RegionSecondary: process.env.S3_REGION_SECONDARY,
      localBackupPath: process.env.LOCAL_BACKUP_PATH || '/var/dronedoc/backups'
    }
  });
}

/**
 * GET /api/backup/status
 * Get backup system status
 */
router.get('/status', async (req, res) => {
  try {
    const backupService = getBackupService(req);
    const stats = await backupService.getBackupStats({ days: 7 });

    const status = {
      enabled: true,
      encryptionEnabled: process.env.BACKUP_ENCRYPTION_ENABLED !== 'false',
      cloudStorageEnabled: process.env.S3_ENABLED === 'true',
      lastBackup: stats.latestBackups.find(b => b.backup_type === 'full')?.last_backup,
      stats
    };

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get backup status', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/backup/create
 * Trigger manual backup
 */
router.post('/create', async (req, res) => {
  try {
    const { type = 'full', options = {} } = req.body;

    const backupService = getBackupService(req);

    let result;

    switch (type) {
      case 'full':
        result = await backupService.createFullBackup(options);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported backup type: ${type}`
        });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Manual backup failed', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/backup/list
 * List all backups
 */
router.get('/list', async (req, res) => {
  try {
    const { type, status, startDate, limit } = req.query;

    const backupService = getBackupService(req);

    const backups = await backupService.listBackups({
      type,
      status,
      startDate,
      limit: limit ? parseInt(limit) : undefined
    });

    res.json({
      success: true,
      data: backups
    });
  } catch (error) {
    logger.error('Failed to list backups', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/backup/:id
 * Get backup details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    const result = await db.query(
      'SELECT * FROM backup_jobs WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Backup not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to get backup details', { error, id: req.params.id });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/backup/:id/verify
 * Verify backup integrity
 */
router.post('/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;

    const backupService = getBackupService(req);
    const result = await backupService.verifyBackup(id);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Backup verification failed', { error, id: req.params.id });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/backup/cleanup
 * Cleanup old backups
 */
router.post('/cleanup', async (req, res) => {
  try {
    const backupService = getBackupService(req);
    const result = await backupService.cleanupOldBackups();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Cleanup failed', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/backup/config
 * Get backup configuration
 */
router.get('/config', async (req, res) => {
  try {
    const db = req.app.locals.db;

    const result = await db.query(
      `SELECT config_key, config_value, config_type, description, category
       FROM backup_config
       WHERE is_sensitive = false
       ORDER BY category, config_key`
    );

    const config = {};
    for (const row of result.rows) {
      config[row.config_key] = {
        value: row.config_value,
        type: row.config_type,
        description: row.description,
        category: row.category
      };
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Failed to get backup config', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/backup/config
 * Update backup configuration
 */
router.put('/config', async (req, res) => {
  try {
    const { configKey, configValue } = req.body;

    if (!configKey || configValue === undefined) {
      return res.status(400).json({
        success: false,
        error: 'configKey and configValue are required'
      });
    }

    const db = req.app.locals.db;

    const result = await db.query(
      `UPDATE backup_config
       SET config_value = $1,
           updated_at = NOW(),
           updated_by = $2,
           previous_value = (SELECT config_value FROM backup_config WHERE config_key = $3)
       WHERE config_key = $3
       RETURNING *`,
      [configValue, req.user?.id || 'admin', configKey]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Configuration key not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to update backup config', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/backup/metrics
 * Get backup metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const days = parseInt(req.query.days) || 30;

    // Get success rate by type
    const successRate = await db.query(
      `SELECT * FROM v_backup_success_rate`
    );

    // Get recent backups
    const recentBackups = await db.query(
      `SELECT * FROM v_recent_backups LIMIT 20`
    );

    // Get storage summary
    const storageSummary = await db.query(
      `SELECT * FROM v_storage_summary`
    );

    res.json({
      success: true,
      data: {
        successRate: successRate.rows,
        recentBackups: recentBackups.rows,
        storage: storageSummary.rows,
        period: `${days} days`
      }
    });
  } catch (error) {
    logger.error('Failed to get backup metrics', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/backup/user-data-export
 * Request user data export (GDPR)
 */
router.post('/user-data-export', async (req, res) => {
  try {
    const { userId, format = 'json', includeFiles = true } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const db = req.app.locals.db;

    // Create export request
    const result = await db.query(
      `INSERT INTO user_data_exports (user_id, export_format, include_files, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [userId, format, includeFiles]
    );

    const exportJob = result.rows[0];

    // TODO: Queue export job for background processing
    // For now, return the pending job

    res.json({
      success: true,
      data: exportJob
    });
  } catch (error) {
    logger.error('Failed to create user data export', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/backup/user-data-export/:id
 * Get user data export status or download
 */
router.get('/user-data-export/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { download } = req.query;

    const db = req.app.locals.db;

    const result = await db.query(
      'SELECT * FROM user_data_exports WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Export not found'
      });
    }

    const exportJob = result.rows[0];

    // Check if expired
    if (exportJob.expires_at && new Date(exportJob.expires_at) < new Date()) {
      return res.status(410).json({
        success: false,
        error: 'Export has expired'
      });
    }

    // If download requested and file is ready
    if (download && exportJob.status === 'completed' && exportJob.file_path) {
      // TODO: Stream file to user
      // For now, return file information
      return res.json({
        success: true,
        data: {
          downloadUrl: exportJob.download_url,
          fileSize: exportJob.file_size_bytes
        }
      });
    }

    // Return export status
    res.json({
      success: true,
      data: exportJob
    });
  } catch (error) {
    logger.error('Failed to get user data export', { error, id: req.params.id });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
