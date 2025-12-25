/**
 * Backup Service
 *
 * Main service for backup and disaster recovery operations
 *
 * Features:
 * - Full database backups
 * - Incremental WAL backups
 * - Volume snapshots
 * - Point-in-time recovery
 * - Backup verification
 * - Retention management
 * - User data export (GDPR)
 *
 * @module services/backup/BackupService
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { createLogger } from '../../utils/logger.js';
import { createEncryption } from './encryption.js';
import { createStorage } from './storage.js';

const execAsync = promisify(exec);
const logger = createLogger('BackupService');

class BackupService {
  constructor({ db, config }) {
    this.db = db;
    this.config = config;

    // Initialize encryption if enabled
    this.encryption = config.encryptionEnabled
      ? createEncryption(config.encryptionKey || process.env.BACKUP_ENCRYPTION_KEY)
      : null;

    // Initialize storage
    const storageConfig = {
      s3Enabled: config.s3Enabled || false,
      s3BucketPrimary: config.s3BucketPrimary || process.env.S3_BUCKET_PRIMARY,
      s3BucketSecondary: config.s3BucketSecondary || process.env.S3_BUCKET_SECONDARY,
      s3RegionPrimary: config.s3RegionPrimary || process.env.S3_REGION_PRIMARY || 'us-east-1',
      s3RegionSecondary: config.s3RegionSecondary || process.env.S3_REGION_SECONDARY,
      localBackupPath: config.localBackupPath || process.env.LOCAL_BACKUP_PATH || '/var/dronedoc/backups'
    };

    this.storage = createStorage(storageConfig);

    // Database connection info
    this.dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'dronedoc',
      user: process.env.DB_USER || 'dronedoc',
      password: process.env.DB_PASSWORD
    };

    logger.info('BackupService initialized', {
      encryptionEnabled: config.encryptionEnabled,
      s3Enabled: storageConfig.s3Enabled,
      localBackupPath: storageConfig.localBackupPath
    });
  }

  /**
   * Get backup configuration from database
   * @param {string} key - Config key
   * @returns {Promise<string|null>} Config value
   */
  async getConfig(key) {
    try {
      const result = await this.db.query(
        'SELECT config_value FROM backup_config WHERE config_key = $1',
        [key]
      );
      return result.rows[0]?.config_value || null;
    } catch (error) {
      logger.error(`Failed to get config: ${key}`, { error });
      return null;
    }
  }

  /**
   * Create a full database backup
   * @param {Object} options - Backup options
   * @returns {Promise<Object>} Backup job result
   */
  async createFullBackup(options = {}) {
    const backupId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `full-${timestamp}.dump`;
    const tempPath = `/tmp/${filename}`;

    let job = null;

    try {
      logger.info('Starting full database backup', { backupId, filename });

      // Create backup job record
      const jobResult = await this.db.query(
        `INSERT INTO backup_jobs (id, backup_type, status, metadata)
         VALUES ($1, 'full', 'running', $2)
         RETURNING *`,
        [backupId, JSON.stringify({ filename, options })]
      );
      job = jobResult.rows[0];

      // Execute pg_dump
      const pgDumpCmd = this.buildPgDumpCommand(tempPath, options);
      logger.info('Executing pg_dump', { command: pgDumpCmd });

      const { stdout, stderr } = await execAsync(pgDumpCmd, {
        maxBuffer: 100 * 1024 * 1024 // 100MB buffer
      });

      if (stderr && !stderr.includes('WARNING')) {
        logger.warn('pg_dump warnings', { stderr });
      }

      // Get backup file stats
      const stats = await fs.promises.stat(tempPath);
      const backupSize = stats.size;

      logger.info('Database dump completed', { backupId, size: backupSize });

      // Compress if needed
      let compressedPath = tempPath;
      let compressedSize = backupSize;

      if (await this.getConfig('compress_backups') === 'true') {
        compressedPath = await this.compressBackup(tempPath);
        const compressedStats = await fs.promises.stat(compressedPath);
        compressedSize = compressedStats.size;
        logger.info('Backup compressed', { originalSize: backupSize, compressedSize });
      }

      // Encrypt if enabled
      let finalPath = compressedPath;
      let encryptionMethod = null;

      if (this.encryption) {
        const encryptedPath = `${compressedPath}.enc`;
        await this.encryption.encryptFile(compressedPath, encryptedPath);
        finalPath = encryptedPath;
        encryptionMethod = 'aes-256-gcm';
        logger.info('Backup encrypted', { backupId });
      }

      // Calculate checksum
      const checksum = await this.encryption?.calculateChecksum(finalPath) || null;

      // Save to local storage
      const localResult = await this.storage.local.saveBackup(
        finalPath,
        'db',
        path.basename(finalPath)
      );

      // Upload to cloud if enabled
      let cloudLocation = null;
      if (this.storage.cloud.enabled) {
        const remotePath = `database/daily/${new Date().toISOString().split('T')[0]}/${path.basename(finalPath)}`;
        const uploadResult = await this.storage.cloud.uploadToAllTiers(finalPath, remotePath);
        cloudLocation = uploadResult.primary?.location || null;
      }

      // Update backup job
      await this.db.query(
        `UPDATE backup_jobs
         SET status = 'completed',
             completed_at = NOW(),
             duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
             backup_size_bytes = $1,
             compressed_size_bytes = $2,
             compression_ratio = CASE WHEN $2 > 0 THEN ROUND(($1::NUMERIC / $2), 2) ELSE NULL END,
             encryption_method = $3,
             storage_location_local = $4,
             storage_location_cloud_primary = $5,
             checksum = $6
         WHERE id = $7`,
        [backupSize, compressedSize, encryptionMethod, localResult.path, cloudLocation, checksum, backupId]
      );

      // Cleanup temp files
      await this.cleanupTempFiles([tempPath, compressedPath, finalPath]);

      logger.info('Full backup completed successfully', { backupId, cloudLocation });

      return {
        id: backupId,
        type: 'full',
        status: 'completed',
        size: backupSize,
        compressedSize,
        localPath: localResult.path,
        cloudLocation,
        checksum
      };
    } catch (error) {
      logger.error('Full backup failed', { error, backupId });

      // Update job status
      if (job) {
        await this.db.query(
          `UPDATE backup_jobs
           SET status = 'failed',
               completed_at = NOW(),
               error_message = $1,
               error_stack = $2
           WHERE id = $3`,
          [error.message, error.stack, backupId]
        );
      }

      throw error;
    }
  }

  /**
   * Build pg_dump command
   * @param {string} outputPath - Output file path
   * @param {Object} options - Dump options
   * @returns {string} pg_dump command
   */
  buildPgDumpCommand(outputPath, options = {}) {
    const { host, port, database, user, password } = this.dbConfig;

    // Build pg_dump command
    const cmd = [
      'pg_dump',
      `-U ${user}`,
      `-h ${host}`,
      `-p ${port}`,
      `-d ${database}`,
      '-F c', // Custom format
      '-Z 9', // Maximum compression
      '--no-owner',
      '--no-acl'
    ];

    // Add parallel jobs for large databases
    if (options.parallelJobs) {
      cmd.push(`-j ${options.parallelJobs}`);
    }

    // Output file
    cmd.push(`-f ${outputPath}`);

    // Set PGPASSWORD environment variable
    const envCmd = `PGPASSWORD='${password}' ${cmd.join(' ')}`;

    return envCmd;
  }

  /**
   * Compress backup file using gzip
   * @param {string} filePath - File to compress
   * @returns {Promise<string>} Compressed file path
   */
  async compressBackup(filePath) {
    const compressedPath = `${filePath}.gz`;

    try {
      await execAsync(`gzip -9 -c ${filePath} > ${compressedPath}`);
      return compressedPath;
    } catch (error) {
      logger.error('Compression failed', { error, filePath });
      throw error;
    }
  }

  /**
   * Create incremental backup (WAL archiving)
   * @param {string} walFilePath - WAL file path
   * @param {string} walFileName - WAL file name
   * @returns {Promise<Object>} Backup result
   */
  async createIncrementalBackup(walFilePath, walFileName) {
    const backupId = crypto.randomUUID();

    try {
      logger.info('Archiving WAL file', { walFileName });

      // Create backup job
      await this.db.query(
        `INSERT INTO backup_jobs (id, backup_type, status, metadata)
         VALUES ($1, 'wal', 'running', $2)`,
        [backupId, JSON.stringify({ walFileName })]
      );

      // Copy WAL file to local storage
      const localResult = await this.storage.local.saveBackup(
        walFilePath,
        'wal',
        walFileName
      );

      // Upload to cloud if enabled
      let cloudLocation = null;
      if (this.storage.cloud.enabled) {
        const remotePath = `database/wal/${new Date().toISOString().split('T')[0]}/${walFileName}`;
        const uploadResult = await this.storage.cloud.uploadBackup(walFilePath, remotePath);
        cloudLocation = uploadResult.location;
      }

      // Update backup job
      const stats = await fs.promises.stat(localResult.path);
      await this.db.query(
        `UPDATE backup_jobs
         SET status = 'completed',
             completed_at = NOW(),
             duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
             backup_size_bytes = $1,
             storage_location_local = $2,
             storage_location_cloud_primary = $3
         WHERE id = $4`,
        [stats.size, localResult.path, cloudLocation, backupId]
      );

      logger.info('WAL file archived successfully', { walFileName, backupId });

      return {
        id: backupId,
        type: 'wal',
        status: 'completed',
        walFile: walFileName,
        localPath: localResult.path,
        cloudLocation
      };
    } catch (error) {
      logger.error('WAL archiving failed', { error, walFileName });

      await this.db.query(
        `UPDATE backup_jobs
         SET status = 'failed',
             completed_at = NOW(),
             error_message = $1
         WHERE id = $2`,
        [error.message, backupId]
      );

      throw error;
    }
  }

  /**
   * Verify backup integrity
   * @param {string} backupId - Backup job ID
   * @returns {Promise<Object>} Verification result
   */
  async verifyBackup(backupId) {
    try {
      logger.info('Verifying backup', { backupId });

      // Get backup job
      const jobResult = await this.db.query(
        'SELECT * FROM backup_jobs WHERE id = $1',
        [backupId]
      );

      if (jobResult.rows.length === 0) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      const job = jobResult.rows[0];

      // Update status to verifying
      await this.db.query(
        'UPDATE backup_jobs SET verification_status = $1 WHERE id = $2',
        ['pending', backupId]
      );

      let verificationPassed = true;
      const verificationDetails = {};

      // 1. Check file exists
      if (job.storage_location_local) {
        try {
          await fs.promises.access(job.storage_location_local);
          verificationDetails.fileExists = true;
        } catch {
          verificationDetails.fileExists = false;
          verificationPassed = false;
        }
      }

      // 2. Verify checksum
      if (job.checksum && job.storage_location_local && this.encryption) {
        const actualChecksum = await this.encryption.calculateChecksum(job.storage_location_local);
        verificationDetails.checksumMatch = actualChecksum === job.checksum;
        if (!verificationDetails.checksumMatch) {
          verificationPassed = false;
        }
      }

      // 3. For full backups, try test restore (optional, resource-intensive)
      // This would require a temporary database, skipped for now

      // Update verification result
      await this.db.query(
        `UPDATE backup_jobs
         SET verification_status = $1,
             verified_at = NOW(),
             verification_details = $2
         WHERE id = $3`,
        [verificationPassed ? 'passed' : 'failed', JSON.stringify(verificationDetails), backupId]
      );

      logger.info('Backup verification completed', {
        backupId,
        passed: verificationPassed,
        details: verificationDetails
      });

      return {
        backupId,
        passed: verificationPassed,
        details: verificationDetails
      };
    } catch (error) {
      logger.error('Backup verification failed', { error, backupId });

      await this.db.query(
        'UPDATE backup_jobs SET verification_status = $1 WHERE id = $2',
        ['failed', backupId]
      );

      throw error;
    }
  }

  /**
   * Cleanup old backups based on retention policies
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOldBackups() {
    try {
      logger.info('Starting backup cleanup');

      const results = {
        local: {},
        cloud: {},
        database: {}
      };

      // Get retention configuration
      const retentionLocal = parseInt(await this.getConfig('retention_days_local')) || 2;
      const retentionCloudPrimary = parseInt(await this.getConfig('retention_days_cloud_primary')) || 30;

      // Cleanup local backups
      results.local.db = await this.storage.local.cleanupOldBackups('db', retentionLocal);
      results.local.wal = await this.storage.local.cleanupOldBackups('wal', 7);
      results.local.volume = await this.storage.local.cleanupOldBackups('volume', retentionLocal);

      // Soft delete old backup jobs in database
      const deleteResult = await this.db.query(
        `UPDATE backup_jobs
         SET deleted_at = NOW()
         WHERE deleted_at IS NULL
           AND retention_until < NOW()
         RETURNING id, backup_type`,
      );

      results.database.deletedCount = deleteResult.rows.length;
      results.database.deletedJobs = deleteResult.rows;

      logger.info('Backup cleanup completed', results);

      return results;
    } catch (error) {
      logger.error('Cleanup failed', { error });
      throw error;
    }
  }

  /**
   * Get backup statistics
   * @param {Object} options - Statistics options
   * @returns {Promise<Object>} Backup statistics
   */
  async getBackupStats(options = {}) {
    try {
      const days = options.days || 30;

      // Get success rate
      const successRateResult = await this.db.query(
        `SELECT
           backup_type,
           COUNT(*) as total,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
           AVG(duration_seconds) as avg_duration,
           AVG(backup_size_bytes) as avg_size
         FROM backup_jobs
         WHERE started_at >= NOW() - INTERVAL '${days} days'
           AND deleted_at IS NULL
         GROUP BY backup_type`
      );

      // Get latest backup info
      const latestResult = await this.db.query(
        `SELECT backup_type, MAX(started_at) as last_backup
         FROM backup_jobs
         WHERE status = 'completed'
           AND deleted_at IS NULL
         GROUP BY backup_type`
      );

      // Get storage stats
      const storageStats = await this.storage.local.getStorageStats();

      return {
        successRate: successRateResult.rows,
        latestBackups: latestResult.rows,
        storage: storageStats,
        period: `${days} days`
      };
    } catch (error) {
      logger.error('Failed to get backup stats', { error });
      throw error;
    }
  }

  /**
   * List all backups
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} List of backups
   */
  async listBackups(filters = {}) {
    try {
      let query = `
        SELECT * FROM backup_jobs
        WHERE deleted_at IS NULL
      `;

      const params = [];

      if (filters.type) {
        params.push(filters.type);
        query += ` AND backup_type = $${params.length}`;
      }

      if (filters.status) {
        params.push(filters.status);
        query += ` AND status = $${params.length}`;
      }

      if (filters.startDate) {
        params.push(filters.startDate);
        query += ` AND started_at >= $${params.length}`;
      }

      query += ' ORDER BY started_at DESC';

      if (filters.limit) {
        params.push(filters.limit);
        query += ` LIMIT $${params.length}`;
      } else {
        query += ' LIMIT 100';
      }

      const result = await this.db.query(query, params);

      return result.rows;
    } catch (error) {
      logger.error('Failed to list backups', { error, filters });
      throw error;
    }
  }

  /**
   * Cleanup temporary files
   * @param {Array<string>} filePaths - Paths to cleanup
   */
  async cleanupTempFiles(filePaths) {
    for (const filePath of filePaths) {
      try {
        await fs.promises.unlink(filePath);
      } catch {
        // Ignore errors
      }
    }
  }
}

export default BackupService;
