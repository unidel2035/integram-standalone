/**
 * User Sync API Routes
 *
 * Provides REST API endpoints for user synchronization between
 * Integram ddadmin and user databases.
 *
 * Endpoints:
 * - POST /api/user-sync/register - Register new user with sync
 * - POST /api/user-sync/login - Authenticate user
 * - POST /api/user-sync/change-password - Change password with sync
 * - POST /api/user-sync/sync-user - Manual user sync
 * - GET /api/user-sync/user/:userId - Get user profile
 * - PUT /api/user-sync/user/:userId - Update user profile
 * - DELETE /api/user-sync/user/:userId - Delete user
 * - GET /api/user-sync/logs/:userId - Get sync logs for user
 */

import express from 'express';
import { body, param, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import * as userSyncService from '../../services/user-sync/userSyncService.js';
import * as passwordSyncService from '../../services/user-sync/passwordSyncService.js';
import * as storageService from '../../services/user-sync/storageService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Middleware: Authenticate JWT token
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
}

/**
 * POST /api/user-sync/register
 * Register new user with synchronization to all databases
 */
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('username').optional().isLength({ min: 3, max: 50 }),
    body('displayName').optional().isLength({ max: 255 }),
    body('databases').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { email, password, username, displayName, databases } = req.body;

      logger.info({ email }, 'User registration request received');

      // Register user with sync
      const result = await userSyncService.registerUser(
        {
          email,
          password,
          username,
          displayName
        },
        databases
      );

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: result.userId,
          email: result.email
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // TODO: Create default AI token (integrate with AI tokens service)

      logger.info({ userId: result.userId, email }, 'User registered successfully');

      res.status(201).json({
        success: true,
        data: {
          userId: result.userId,
          email: result.email,
          databases: result.databases,
          token,
          tokenExpiresIn: JWT_EXPIRES_IN
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'User registration failed');

      res.status(500).json({
        success: false,
        error: error.message || 'Registration failed'
      });
    }
  }
);

/**
 * POST /api/user-sync/login
 * Authenticate user and generate JWT token
 * Accepts either 'login' (email or username) or 'email' field
 */
router.post(
  '/login',
  [
    body('login').optional().notEmpty().withMessage('Login is required'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      // Accept either 'login' or 'email' field
      const loginField = req.body.login || req.body.email;
      const { password } = req.body;

      if (!loginField) {
        return res.status(400).json({
          success: false,
          error: 'Email or username is required'
        });
      }

      logger.info({ login: loginField }, 'Login attempt');

      // Get user from registry - search by email or username
      const registry = await storageService.readRegistry();
      const user = Object.values(registry.users).find(u =>
        u.email === loginField || u.username === loginField
      );

      if (!user) {
        logger.warn({ login: loginField }, 'User not found');
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      let passwordHash;

      // Check if user has password_hash stored directly (for test/dev users)
      if (user.password_hash) {
        passwordHash = user.password_hash;
        logger.info({ login: loginField }, 'Using stored password hash for authentication');
      } else {
        // Get user from ddadmin to verify password (production flow)
        const ddadminRecord = user.databases.find(db => db.name === 'ddadmin');
        if (!ddadminRecord) {
          logger.error({ login: loginField }, 'User not found in ddadmin');
          return res.status(500).json({
            success: false,
            error: 'User configuration error'
          });
        }

        // Get user profile to verify password
        const { createIntegramClient } = await import('../../utils/IntegramClient.js');
        const client = createIntegramClient('ddadmin');

        const systemUsername = process.env.INTEGRAM_SYSTEM_USERNAME;
        const systemPassword = process.env.INTEGRAM_SYSTEM_PASSWORD;

        await client.authenticate(systemUsername, systemPassword);
        const userRecord = await client.getUser(ddadminRecord.recordId);

        if (!userRecord || !userRecord.password_hash) {
          logger.error({ login: loginField }, 'Cannot verify password');
          return res.status(500).json({
            success: false,
            error: 'Authentication error'
          });
        }

        passwordHash = userRecord.password_hash;
      }

      // Verify password
      const isValidPassword = await passwordSyncService.verifyPassword(password, passwordHash);

      if (!isValidPassword) {
        logger.warn({ login: loginField }, 'Invalid password');

        await storageService.addLog({
          userId: user.userId,
          operation: 'login_attempt',
          status: 'failed',
          reason: 'invalid_password',
          ipAddress: req.ip
        });

        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.userId,
          email: user.email
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Log successful login
      await storageService.addLog({
        userId: user.userId,
        operation: 'login',
        status: 'success',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      logger.info({ userId: user.userId, email: user.email }, 'Login successful');

      res.json({
        success: true,
        data: {
          userId: user.userId,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          accessToken: token,
          refreshToken: token, // TODO: Implement separate refresh token
          tokenExpiresIn: JWT_EXPIRES_IN
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Login failed');

      res.status(500).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  }
);

/**
 * POST /api/user-sync/change-password
 * Change user password with synchronization
 */
router.post(
  '/change-password',
  authenticateToken,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { currentPassword, newPassword } = req.body;
      const userId = req.user.userId;

      logger.info({ userId }, 'Password change request');

      // Change password with sync
      const result = await passwordSyncService.changePassword(
        userId,
        currentPassword,
        newPassword,
        {
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }
      );

      logger.info({ userId }, 'Password changed successfully');

      res.json({
        success: true,
        message: 'Password changed successfully',
        data: result
      });
    } catch (error) {
      logger.error({ userId: req.user?.userId, error: error.message }, 'Password change failed');

      res.status(400).json({
        success: false,
        error: error.message || 'Failed to change password'
      });
    }
  }
);

/**
 * POST /api/user-sync/sync-user
 * Manually sync user to additional database
 */
router.post(
  '/sync-user',
  authenticateToken,
  [
    body('database').notEmpty().withMessage('Database name is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { database } = req.body;
      const userId = req.user.userId;

      logger.info({ userId, database }, 'Manual sync request');

      const result = await userSyncService.syncUserToDatabase(userId, database);

      logger.info({ userId, database }, 'User synced successfully');

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ userId: req.user?.userId, error: error.message }, 'User sync failed');

      res.status(500).json({
        success: false,
        error: error.message || 'Sync failed'
      });
    }
  }
);

/**
 * GET /api/user-sync/user/:userId
 * Get user profile from all databases
 */
router.get(
  '/user/:userId',
  authenticateToken,
  [
    param('userId').isUUID().withMessage('Valid user ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { userId } = req.params;

      // Verify user can access this profile (self or admin)
      if (req.user.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const profile = await userSyncService.getUserProfile(userId);

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      logger.error({ userId: req.params.userId, error: error.message }, 'Failed to get user profile');

      res.status(404).json({
        success: false,
        error: error.message || 'User not found'
      });
    }
  }
);

/**
 * PUT /api/user-sync/user/:userId
 * Update user profile with synchronization
 */
router.put(
  '/user/:userId',
  authenticateToken,
  [
    param('userId').isUUID().withMessage('Valid user ID is required'),
    body('username').optional().isLength({ min: 3, max: 50 }),
    body('displayName').optional().isLength({ max: 255 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { userId } = req.params;
      const updates = req.body;

      // Verify user can update this profile (self or admin)
      if (req.user.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      logger.info({ userId, updates: Object.keys(updates) }, 'User update request');

      const result = await userSyncService.updateUserInAllDatabases(userId, updates);

      logger.info({ userId }, 'User updated successfully');

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ userId: req.params.userId, error: error.message }, 'Failed to update user');

      res.status(500).json({
        success: false,
        error: error.message || 'Update failed'
      });
    }
  }
);

/**
 * DELETE /api/user-sync/user/:userId
 * Delete user from all databases
 */
router.delete(
  '/user/:userId',
  authenticateToken,
  [
    param('userId').isUUID().withMessage('Valid user ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { userId } = req.params;
      const { archive = true } = req.query;

      // Verify user can delete this profile (self or admin)
      if (req.user.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      logger.info({ userId, archive }, 'User deletion request');

      const result = await userSyncService.deleteUser(userId, archive === 'true');

      logger.info({ userId }, 'User deleted successfully');

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ userId: req.params.userId, error: error.message }, 'Failed to delete user');

      res.status(500).json({
        success: false,
        error: error.message || 'Deletion failed'
      });
    }
  }
);

/**
 * GET /api/user-sync/logs/:userId
 * Get sync logs for user
 */
router.get(
  '/logs/:userId',
  authenticateToken,
  [
    param('userId').isUUID().withMessage('Valid user ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { userId } = req.params;
      const { limit = 50 } = req.query;

      // Verify user can access logs (self or admin)
      if (req.user.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const logs = await storageService.getLogsForUser(userId, parseInt(limit));

      res.json({
        success: true,
        data: {
          userId,
          logs,
          count: logs.length
        }
      });
    } catch (error) {
      logger.error({ userId: req.params.userId, error: error.message }, 'Failed to get logs');

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve logs'
      });
    }
  }
);

/**
 * GET /api/user-sync/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const registry = await storageService.readRegistry();
    const logs = await storageService.readLogs();

    res.json({
      success: true,
      data: {
        status: 'healthy',
        totalUsers: registry.metadata.totalUsers,
        totalLogs: logs.metadata.totalLogs,
        lastUpdated: registry.metadata.lastUpdated
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
});

export default router;
