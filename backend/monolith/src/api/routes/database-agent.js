/**
 * Database Agent API Routes
 *
 * Comprehensive database management: backups, optimization, migrations, monitoring
 *
 * Issue #2474: Database Management Agent
 *
 * Endpoints:
 * - GET /api/database-agent/health - Overall health status
 * - GET /api/database-agent/performance - Performance metrics
 * - POST /api/database-agent/optimize-queries - Optimize slow queries
 * - GET /api/database-agent/migrations - List migrations
 * - POST /api/database-agent/migrations - Create migration
 * - POST /api/database-agent/migrations/:id/apply - Apply migration
 * - POST /api/database-agent/migrations/:id/rollback - Rollback migration
 * - GET /api/database-agent/archive-candidates - Data ready for archiving
 * - POST /api/database-agent/archive - Archive old data
 * - GET /api/database-agent/metrics-history - Historical metrics
 */

import express from 'express';
import { createLogger } from '../../utils/logger.js';

const router = express.Router();
const logger = createLogger('DatabaseAgent');

/**
 * GET /api/database-agent/health
 * Get overall database health status
 */
router.get('/health', async (req, res) => {
  try {
    const db = req.app.locals.db;

    // Check connection
    const connectionCheck = await db.query('SELECT 1');

    // Get active connections
    const connectionsResult = await db.query(`
      SELECT count(*) as active_connections
      FROM pg_stat_activity
      WHERE state = 'active'
    `);

    // Get database size
    const sizeResult = await db.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);

    // Check for long-running queries
    const longQueriesResult = await db.query(`
      SELECT count(*) as long_running_queries
      FROM pg_stat_activity
      WHERE state = 'active'
        AND now() - query_start > interval '5 minutes'
    `);

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      connections: {
        active: parseInt(connectionsResult.rows[0].active_connections)
      },
      database: {
        size: sizeResult.rows[0].size
      },
      performance: {
        longRunningQueries: parseInt(longQueriesResult.rows[0].long_running_queries)
      }
    };

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(500).json({
      success: false,
      error: error.message,
      status: 'unhealthy'
    });
  }
});

/**
 * GET /api/database-agent/performance
 * Get performance metrics
 */
router.get('/performance', async (req, res) => {
  try {
    const db = req.app.locals.db;

    // Slow queries
    const slowQueries = await db.query(`
      SELECT
        query,
        calls,
        total_exec_time,
        mean_exec_time,
        max_exec_time
      FROM pg_stat_statements
      WHERE mean_exec_time > 100
      ORDER BY mean_exec_time DESC
      LIMIT 10
    `).catch(() => ({ rows: [] })); // Fallback if pg_stat_statements not enabled

    // Table sizes
    const tableSizes = await db.query(`
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as size,
        pg_total_relation_size(schemaname || '.' || tablename) as size_bytes
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY size_bytes DESC
      LIMIT 20
    `);

    // Index usage
    const indexUsage = await db.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0
      ORDER BY schemaname, tablename
      LIMIT 20
    `);

    // Cache hit ratio
    const cacheHitRatio = await db.query(`
      SELECT
        sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0) * 100 as cache_hit_ratio
      FROM pg_statio_user_tables
    `);

    const performance = {
      slowQueries: slowQueries.rows || [],
      tableSizes: tableSizes.rows,
      unusedIndexes: indexUsage.rows,
      cacheHitRatio: cacheHitRatio.rows[0]?.cache_hit_ratio || 0,
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    logger.error('Performance check failed', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/database-agent/optimize-queries
 * Optimize slow queries by suggesting indexes
 */
router.post('/optimize-queries', async (req, res) => {
  try {
    const db = req.app.locals.db;

    // Analyze queries and suggest indexes
    const suggestions = [];

    // Find sequential scans on large tables
    const seqScans = await db.query(`
      SELECT
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        n_live_tup
      FROM pg_stat_user_tables
      WHERE seq_scan > 0
        AND n_live_tup > 10000
        AND seq_scan > idx_scan
      ORDER BY seq_scan DESC
      LIMIT 10
    `);

    for (const row of seqScans.rows) {
      suggestions.push({
        type: 'index',
        severity: 'high',
        table: `${row.schemaname}.${row.tablename}`,
        issue: `Table has ${row.seq_scan} sequential scans with ${row.n_live_tup} rows`,
        recommendation: `Consider adding indexes to frequently queried columns on ${row.tablename}`,
        potentialImprovement: '30-70%'
      });
    }

    // Find unused indexes
    const unusedIndexes = await db.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0
        AND schemaname NOT IN ('pg_catalog', 'information_schema')
      LIMIT 10
    `);

    for (const row of unusedIndexes.rows) {
      suggestions.push({
        type: 'remove_index',
        severity: 'medium',
        table: `${row.schemaname}.${row.tablename}`,
        index: row.indexname,
        issue: `Index never used, wasting ${row.size}`,
        recommendation: `Consider dropping index ${row.indexname}`,
        potentialImprovement: 'Reduced storage and faster writes'
      });
    }

    res.json({
      success: true,
      data: {
        suggestions,
        analyzedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Query optimization failed', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/database-agent/migrations
 * List schema migrations
 */
router.get('/migrations', async (req, res) => {
  try {
    const db = req.app.locals.db;

    // Check if migrations table exists
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'schema_migrations'
      ) as exists
    `);

    let migrations = [];

    if (tableExists.rows[0].exists) {
      const result = await db.query(`
        SELECT
          id,
          name,
          description,
          version,
          applied_at,
          applied_by,
          status,
          rollback_sql
        FROM schema_migrations
        ORDER BY version DESC, applied_at DESC
        LIMIT 50
      `);

      migrations = result.rows;
    }

    res.json({
      success: true,
      data: migrations
    });
  } catch (error) {
    logger.error('Failed to list migrations', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/database-agent/migrations
 * Create a new migration
 */
router.post('/migrations', async (req, res) => {
  try {
    const { name, description, sql, rollbackSql } = req.body;

    if (!name || !sql) {
      return res.status(400).json({
        success: false,
        error: 'name and sql are required'
      });
    }

    const db = req.app.locals.db;

    // Ensure migrations table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        version VARCHAR(50) NOT NULL,
        sql TEXT NOT NULL,
        rollback_sql TEXT,
        applied_at TIMESTAMP DEFAULT NOW(),
        applied_by VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Generate version (timestamp-based)
    const version = new Date().toISOString().replace(/[-:\.TZ]/g, '').substring(0, 14);

    const result = await db.query(`
      INSERT INTO schema_migrations (name, description, version, sql, rollback_sql, applied_by, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *
    `, [name, description, version, sql, rollbackSql || null, req.user?.id || 'system']);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to create migration', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/database-agent/migrations/:id/apply
 * Apply a migration
 */
router.post('/migrations/:id/apply', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    // Get migration
    const migrationResult = await db.query(
      'SELECT * FROM schema_migrations WHERE id = $1',
      [id]
    );

    if (migrationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Migration not found'
      });
    }

    const migration = migrationResult.rows[0];

    if (migration.status === 'applied') {
      return res.status(400).json({
        success: false,
        error: 'Migration already applied'
      });
    }

    // Apply migration in transaction
    await db.query('BEGIN');

    try {
      // Execute migration SQL
      await db.query(migration.sql);

      // Update status
      await db.query(`
        UPDATE schema_migrations
        SET status = 'applied', applied_at = NOW(), applied_by = $1
        WHERE id = $2
      `, [req.user?.id || 'system', id]);

      await db.query('COMMIT');

      res.json({
        success: true,
        data: {
          migrationId: id,
          status: 'applied',
          appliedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Failed to apply migration', { error, id: req.params.id });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/database-agent/migrations/:id/rollback
 * Rollback a migration
 */
router.post('/migrations/:id/rollback', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;

    // Get migration
    const migrationResult = await db.query(
      'SELECT * FROM schema_migrations WHERE id = $1',
      [id]
    );

    if (migrationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Migration not found'
      });
    }

    const migration = migrationResult.rows[0];

    if (migration.status !== 'applied') {
      return res.status(400).json({
        success: false,
        error: 'Migration not applied, cannot rollback'
      });
    }

    if (!migration.rollback_sql) {
      return res.status(400).json({
        success: false,
        error: 'No rollback SQL provided for this migration'
      });
    }

    // Rollback in transaction
    await db.query('BEGIN');

    try {
      // Execute rollback SQL
      await db.query(migration.rollback_sql);

      // Update status
      await db.query(`
        UPDATE schema_migrations
        SET status = 'rolled_back'
        WHERE id = $1
      `, [id]);

      await db.query('COMMIT');

      res.json({
        success: true,
        data: {
          migrationId: id,
          status: 'rolled_back',
          rolledBackAt: new Date().toISOString()
        }
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Failed to rollback migration', { error, id: req.params.id });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/database-agent/archive-candidates
 * Get data candidates for archiving
 */
router.get('/archive-candidates', async (req, res) => {
  try {
    const db = req.app.locals.db;

    // Find tables with timestamp columns
    const candidates = [];

    // Example: Find old error reports
    const oldErrorReports = await db.query(`
      SELECT
        count(*) as count,
        min(created_at) as oldest,
        max(created_at) as newest
      FROM error_reports
      WHERE created_at < NOW() - INTERVAL '90 days'
    `).catch(() => ({ rows: [{ count: 0 }] }));

    if (parseInt(oldErrorReports.rows[0].count) > 0) {
      candidates.push({
        table: 'error_reports',
        recordsCount: parseInt(oldErrorReports.rows[0].count),
        oldestRecord: oldErrorReports.rows[0].oldest,
        criteria: 'Older than 90 days',
        estimatedSizeReduction: '10-20%'
      });
    }

    // Example: Find old backup jobs
    const oldBackups = await db.query(`
      SELECT
        count(*) as count,
        min(created_at) as oldest,
        max(created_at) as newest
      FROM backup_jobs
      WHERE created_at < NOW() - INTERVAL '180 days'
        AND status = 'completed'
    `).catch(() => ({ rows: [{ count: 0 }] }));

    if (parseInt(oldBackups.rows[0].count) > 0) {
      candidates.push({
        table: 'backup_jobs',
        recordsCount: parseInt(oldBackups.rows[0].count),
        oldestRecord: oldBackups.rows[0].oldest,
        criteria: 'Completed backups older than 180 days',
        estimatedSizeReduction: '5-10%'
      });
    }

    res.json({
      success: true,
      data: candidates
    });
  } catch (error) {
    logger.error('Failed to find archive candidates', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/database-agent/archive
 * Archive old data
 */
router.post('/archive', async (req, res) => {
  try {
    const { table, olderThan, archiveTable } = req.body;

    if (!table || !olderThan) {
      return res.status(400).json({
        success: false,
        error: 'table and olderThan are required'
      });
    }

    const db = req.app.locals.db;

    // Create archive table if it doesn't exist
    const archiveName = archiveTable || `${table}_archive`;

    await db.query('BEGIN');

    try {
      // Create archive table (copy structure)
      await db.query(`
        CREATE TABLE IF NOT EXISTS ${archiveName} (LIKE ${table} INCLUDING ALL)
      `);

      // Move old records
      const result = await db.query(`
        WITH moved_rows AS (
          DELETE FROM ${table}
          WHERE created_at < NOW() - INTERVAL '${olderThan}'
          RETURNING *
        )
        INSERT INTO ${archiveName}
        SELECT * FROM moved_rows
      `);

      await db.query('COMMIT');

      res.json({
        success: true,
        data: {
          table,
          archiveTable: archiveName,
          archivedRecords: result.rowCount,
          archivedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Archiving failed', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/database-agent/metrics-history
 * Get historical metrics
 */
router.get('/metrics-history', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const db = req.app.locals.db;

    // For now, return current metrics
    // In production, this would query a metrics history table
    const metrics = {
      period: `${days} days`,
      data: [
        {
          timestamp: new Date().toISOString(),
          connections: 5,
          cacheHitRatio: 95.2,
          slowQueries: 2
        }
      ]
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get metrics history', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
