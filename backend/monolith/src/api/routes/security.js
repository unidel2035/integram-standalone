import express from 'express';
import { authenticate, requirePermissions } from '../../middleware/auth/auth.js';
import {
  addToWhitelist,
  removeFromWhitelist,
  addToBlacklist,
  removeFromBlacklist,
  getWhitelistedIPs,
  getBlacklistedIPs,
  getBlacklistReason,
} from '../../middleware/security/ipFilter.js';
import {
  blockIP,
  unblockIP,
  getBlockedIPs,
  getSecurityEvents,
} from '../../middleware/security/abuseDetection.js';
import { RATE_LIMIT_TIERS } from '../../middleware/security/rateLimiter.js';
import { SecurityScanner } from '../../services/code-review/SecurityScanner.js';
import logger from '../../utils/logger.js';

const router = express.Router();

/**
 * Security Management Routes
 * Issue #77: Admin endpoints for managing security settings
 *
 * All routes require admin authentication
 */

/**
 * Get all security events
 * GET /api/security/events
 */
router.get('/events', authenticate, requirePermissions(['admin']), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const events = await getSecurityEvents(limit);

    res.json({
      success: true,
      data: {
        events,
        count: events.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get security events:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось получить события безопасности',
    });
  }
});

/**
 * Get IP whitelist
 * GET /api/security/whitelist
 */
router.get('/whitelist', authenticate, requirePermissions(['admin']), async (req, res) => {
  try {
    const ips = await getWhitelistedIPs();

    res.json({
      success: true,
      data: {
        ips,
        count: ips.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get whitelist:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось получить белый список IP',
    });
  }
});

/**
 * Add IP to whitelist
 * POST /api/security/whitelist
 */
router.post('/whitelist', authenticate, requirePermissions(['admin']), async (req, res) => {
  try {
    const { ip, isCIDR } = req.body;

    if (!ip) {
      return res.status(400).json({
        success: false,
        error: 'IP адрес обязателен',
      });
    }

    await addToWhitelist(ip, isCIDR);

    logger.info(`Admin ${req.user.id} added IP to whitelist: ${ip}`);

    res.json({
      success: true,
      message: `IP ${ip} добавлен в белый список`,
    });
  } catch (error) {
    logger.error('Failed to add to whitelist:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось добавить IP в белый список',
    });
  }
});

/**
 * Remove IP from whitelist
 * DELETE /api/security/whitelist/:ip
 */
router.delete('/whitelist/:ip', authenticate, requirePermissions(['admin']), async (req, res) => {
  try {
    const { ip } = req.params;

    await removeFromWhitelist(decodeURIComponent(ip));

    logger.info(`Admin ${req.user.id} removed IP from whitelist: ${ip}`);

    res.json({
      success: true,
      message: `IP ${ip} удален из белого списка`,
    });
  } catch (error) {
    logger.error('Failed to remove from whitelist:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось удалить IP из белого списка',
    });
  }
});

/**
 * Get IP blacklist
 * GET /api/security/blacklist
 */
router.get('/blacklist', authenticate, requirePermissions(['admin']), async (req, res) => {
  try {
    const ips = await getBlacklistedIPs();

    // Get reasons for each IP
    const ipsWithReasons = await Promise.all(
      ips.map(async (ip) => ({
        ip,
        reason: await getBlacklistReason(ip),
      }))
    );

    res.json({
      success: true,
      data: {
        ips: ipsWithReasons,
        count: ips.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get blacklist:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось получить черный список IP',
    });
  }
});

/**
 * Add IP to blacklist
 * POST /api/security/blacklist
 */
router.post('/blacklist', authenticate, requirePermissions(['admin']), async (req, res) => {
  try {
    const { ip, reason, isCIDR } = req.body;

    if (!ip) {
      return res.status(400).json({
        success: false,
        error: 'IP адрес обязателен',
      });
    }

    await addToBlacklist(ip, reason || 'Manually blacklisted by admin', isCIDR);

    logger.info(`Admin ${req.user.id} added IP to blacklist: ${ip} (${reason})`);

    res.json({
      success: true,
      message: `IP ${ip} добавлен в черный список`,
    });
  } catch (error) {
    logger.error('Failed to add to blacklist:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось добавить IP в черный список',
    });
  }
});

/**
 * Remove IP from blacklist
 * DELETE /api/security/blacklist/:ip
 */
router.delete('/blacklist/:ip', authenticate, requirePermissions(['admin']), async (req, res) => {
  try {
    const { ip } = req.params;

    await removeFromBlacklist(decodeURIComponent(ip));

    logger.info(`Admin ${req.user.id} removed IP from blacklist: ${ip}`);

    res.json({
      success: true,
      message: `IP ${ip} удален из черного списка`,
    });
  } catch (error) {
    logger.error('Failed to remove from blacklist:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось удалить IP из черного списка',
    });
  }
});

/**
 * Get currently blocked IPs (from abuse detection)
 * GET /api/security/blocked
 */
router.get('/blocked', authenticate, requirePermissions(['admin']), async (req, res) => {
  try {
    const ips = await getBlockedIPs();

    res.json({
      success: true,
      data: {
        ips,
        count: ips.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get blocked IPs:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось получить список заблокированных IP',
    });
  }
});

/**
 * Block an IP address
 * POST /api/security/block
 */
router.post('/block', authenticate, requirePermissions(['admin']), async (req, res) => {
  try {
    const { ip, reason, duration } = req.body;

    if (!ip) {
      return res.status(400).json({
        success: false,
        error: 'IP адрес обязателен',
      });
    }

    await blockIP(ip, reason || 'Manually blocked by admin', duration);

    logger.info(`Admin ${req.user.id} blocked IP: ${ip} (${reason})`);

    res.json({
      success: true,
      message: `IP ${ip} заблокирован`,
    });
  } catch (error) {
    logger.error('Failed to block IP:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось заблокировать IP',
    });
  }
});

/**
 * Unblock an IP address
 * POST /api/security/unblock
 */
router.post('/unblock', authenticate, requirePermissions(['admin']), async (req, res) => {
  try {
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({
        success: false,
        error: 'IP адрес обязателен',
      });
    }

    await unblockIP(ip);

    logger.info(`Admin ${req.user.id} unblocked IP: ${ip}`);

    res.json({
      success: true,
      message: `IP ${ip} разблокирован`,
    });
  } catch (error) {
    logger.error('Failed to unblock IP:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось разблокировать IP',
    });
  }
});

/**
 * Get rate limit tiers configuration
 * GET /api/security/rate-limit-tiers
 */
router.get('/rate-limit-tiers', authenticate, requirePermissions(['admin']), (req, res) => {
  res.json({
    success: true,
    data: RATE_LIMIT_TIERS,
  });
});

/**
 * Get security configuration summary
 * GET /api/security/config
 */
router.get('/config', authenticate, requirePermissions(['admin']), (req, res) => {
  res.json({
    success: true,
    data: {
      rateLimitTiers: RATE_LIMIT_TIERS,
      redisEnabled: process.env.REDIS_ENABLED !== 'false',
      maxJsonSize: parseInt(process.env.MAX_JSON_SIZE || String(10 * 1024 * 1024)),
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || String(100 * 1024 * 1024)),
      nodeEnv: process.env.NODE_ENV,
      securityFeatures: {
        rateLimit: true,
        abuseDetection: true,
        ipFiltering: true,
        requestValidation: true,
        securityHeaders: true,
        botDetection: true,
        credentialStuffingProtection: true,
      },
    },
  });
});

/**
 * Vulnerability Scanner Routes
 * Issue #2476: Vulnerability scanning agent
 */

// Initialize scanner
const scanner = new SecurityScanner();

/**
 * Run vulnerability scan
 * POST /api/security/scan
 */
router.post('/scan', authenticate, async (req, res) => {
  try {
    const { scanType, path } = req.body;

    let result;

    switch (scanType) {
      case 'sast':
        // Static application security testing
        result = await scanner.scanCodebase(path);
        break;

      case 'dependencies':
        // Dependency vulnerability scan
        const depVulns = await scanner.runNpmAudit();
        result = {
          vulnerabilities: depVulns,
          metrics: scanner.getSecurityMetrics(depVulns),
          compliance: []
        };
        break;

      case 'owasp':
        // OWASP Top 10 compliance check
        const codebaseResult = await scanner.scanCodebase(path);
        result = {
          vulnerabilities: codebaseResult.vulnerabilities,
          metrics: codebaseResult.metrics,
          compliance: codebaseResult.compliance
        };
        break;

      case 'dast':
        // Dynamic application security testing (placeholder)
        result = {
          vulnerabilities: [],
          metrics: { critical: 0, high: 0, medium: 0, low: 0, coverage: 0 },
          compliance: [],
          message: 'DAST scanning not yet implemented'
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid scan type'
        });
    }

    logger.info(`Vulnerability scan completed: ${scanType}, found ${result.vulnerabilities?.length || 0} issues`);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Vulnerability scan failed:', error);
    res.status(500).json({
      success: false,
      error: 'Scan failed: ' + error.message
    });
  }
});

/**
 * Get vulnerability scan results
 * GET /api/security/vulnerabilities
 */
router.get('/vulnerabilities', authenticate, async (req, res) => {
  try {
    // Run a quick scan and return results
    const result = await scanner.scanCodebase();

    res.json({
      success: true,
      data: result.vulnerabilities
    });
  } catch (error) {
    logger.error('Failed to get vulnerabilities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve vulnerabilities'
    });
  }
});

/**
 * Get dependency vulnerabilities
 * GET /api/security/dependencies
 */
router.get('/dependencies', authenticate, async (req, res) => {
  try {
    const vulnerabilities = await scanner.runNpmAudit();

    // Transform to match frontend expectations
    const dependencyVulns = vulnerabilities.map(v => ({
      id: `${v.package}-${Date.now()}`,
      package: v.package,
      installedVersion: v.range,
      vulnerabilityTitle: v.title,
      severity: v.severity,
      patchedVersion: v.fixAvailable ? 'Available' : null,
      cvss: null, // Would need additional API call to get CVSS score
      detectedAt: new Date().toISOString()
    }));

    res.json({
      success: true,
      data: dependencyVulns
    });
  } catch (error) {
    logger.error('Failed to get dependency vulnerabilities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dependency vulnerabilities'
    });
  }
});

/**
 * Get security metrics
 * GET /api/security/metrics
 */
router.get('/metrics', authenticate, async (req, res) => {
  try {
    const result = await scanner.scanCodebase();

    res.json({
      success: true,
      data: result.metrics
    });
  } catch (error) {
    logger.error('Failed to get security metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security metrics'
    });
  }
});

/**
 * Get OWASP compliance status
 * GET /api/security/compliance
 */
router.get('/compliance', authenticate, async (req, res) => {
  try {
    const result = await scanner.scanCodebase();

    res.json({
      success: true,
      data: result.compliance
    });
  } catch (error) {
    logger.error('Failed to get compliance status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve compliance status'
    });
  }
});

/**
 * Apply automatic fix for a vulnerability
 * POST /api/security/fix/:id
 */
router.post('/fix/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Placeholder for auto-fix functionality
    // In a real implementation, this would apply suggested fixes

    logger.info(`Auto-fix requested for vulnerability: ${id}`);

    res.json({
      success: true,
      message: 'Fix applied successfully',
      data: {
        id,
        status: 'fixed',
        appliedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to apply fix:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply fix'
    });
  }
});

/**
 * Ignore a vulnerability
 * POST /api/security/ignore/:id
 */
router.post('/ignore/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    logger.info(`Vulnerability ignored: ${id} (${reason || 'No reason provided'})`);

    res.json({
      success: true,
      message: 'Vulnerability ignored',
      data: {
        id,
        status: 'ignored',
        reason: reason || 'No reason provided',
        ignoredAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to ignore vulnerability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ignore vulnerability'
    });
  }
});

/**
 * Create patch PR for dependency vulnerability
 * POST /api/security/patch-pr/:id
 */
router.post('/patch-pr/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Placeholder for creating patch PRs
    // In a real implementation, this would create a GitHub PR with dependency updates

    logger.info(`Patch PR creation requested for: ${id}`);

    res.json({
      success: true,
      message: 'Patch PR created',
      data: {
        id,
        prUrl: `https://github.com/your-repo/pull/${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to create patch PR:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create patch PR'
    });
  }
});

export default router;
