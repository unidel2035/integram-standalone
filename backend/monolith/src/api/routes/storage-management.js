/**
 * Storage Management API Routes
 * Issue #2670: storage-management-agent работа с реальными серверами
 *
 * Provides endpoints for:
 * - Storage statistics (disk usage)
 * - File type analysis
 * - Cold storage candidate scanning
 * - Duplicate file detection
 * - Activity logging
 */

import express from 'express';
import { StorageManagementService } from '../../services/storage/StorageManagementService.js';
import { systemResourcesMonitor } from './system-resources.js';
import logger from '../../utils/logger.js';

// Create service instance
const storageService = new StorageManagementService({
  scanRoots: process.env.STORAGE_SCAN_ROOTS?.split(',') || ['/tmp'],
  maxLogSize: 1000
});

export function createStorageManagementRoutes() {
  const router = express.Router();

  /**
   * GET /api/storage-management/stats
   * Get storage statistics (disk usage)
   */
  router.get('/stats', async (req, res) => {
    try {
      const stats = await storageService.getStorageStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get storage stats', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve storage statistics',
        message: error.message
      });
    }
  });

  /**
   * GET /api/storage-management/disk-info
   * Get detailed disk information from system resources monitor
   */
  router.get('/disk-info', async (req, res) => {
    try {
      const current = systemResourcesMonitor.getCurrentMetrics();

      if (!current || !current.disk) {
        return res.status(503).json({
          success: false,
          error: 'Disk monitoring not yet initialized'
        });
      }

      res.json({
        success: true,
        data: current.disk
      });
    } catch (error) {
      logger.error('Failed to get disk info', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve disk information',
        message: error.message
      });
    }
  });

  /**
   * POST /api/storage-management/scan-file-types
   * Scan directories and analyze file types
   */
  router.post('/scan-file-types', async (req, res) => {
    try {
      const { directories, maxDepth = 3 } = req.body;

      const result = await storageService.scanFileTypes(directories, maxDepth);

      res.json({
        success: true,
        data: result,
        count: result.length
      });
    } catch (error) {
      logger.error('Failed to scan file types', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to scan file types',
        message: error.message
      });
    }
  });

  /**
   * POST /api/storage-management/scan-cold-storage
   * Find candidates for cold storage (old, large files)
   */
  router.post('/scan-cold-storage', async (req, res) => {
    try {
      const {
        directories,
        daysThreshold = 90,
        minSizeMB = 10,
        maxResults = 100
      } = req.body;

      const candidates = await storageService.scanColdStorageCandidates({
        directories,
        daysThreshold,
        minSizeMB,
        maxResults
      });

      res.json({
        success: true,
        data: candidates,
        count: candidates.length
      });
    } catch (error) {
      logger.error('Failed to scan cold storage candidates', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to scan cold storage candidates',
        message: error.message
      });
    }
  });

  /**
   * POST /api/storage-management/scan-duplicates
   * Find duplicate files using hash-based detection
   */
  router.post('/scan-duplicates', async (req, res) => {
    try {
      const { directories, minSizeMB = 1 } = req.body;

      const result = await storageService.scanDuplicates(directories, minSizeMB);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to scan duplicates', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to scan for duplicate files',
        message: error.message
      });
    }
  });

  /**
   * GET /api/storage-management/activity-log
   * Get activity log
   */
  router.get('/activity-log', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const log = storageService.getActivityLog(limit);

      res.json({
        success: true,
        data: log,
        count: log.length
      });
    } catch (error) {
      logger.error('Failed to get activity log', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve activity log',
        message: error.message
      });
    }
  });

  /**
   * GET /api/storage-management/health
   * Health check endpoint
   */
  router.get('/health', async (req, res) => {
    try {
      const stats = await storageService.getStorageStats();

      res.json({
        success: true,
        status: 'healthy',
        service: 'storage-management',
        scanRoots: storageService.scanRoots,
        storageStats: stats
      });
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: error.message
      });
    }
  });

  return router;
}

export { storageService };
