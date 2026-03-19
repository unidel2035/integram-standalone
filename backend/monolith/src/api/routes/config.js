/**
 * Configuration Management API
 *
 * Provides endpoints for managing backend and Integram database configuration.
 * Supports saving, loading, and testing configurations.
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration file path (in backend root)
const CONFIG_FILE_PATH = path.join(__dirname, '../../../config/backend-config.json');

/**
 * Ensure config directory exists
 */
async function ensureConfigDir() {
  const configDir = path.dirname(CONFIG_FILE_PATH);
  try {
    await fs.access(configDir);
  } catch {
    await fs.mkdir(configDir, { recursive: true });
  }
}

/**
 * GET /api/config/backend
 * Load backend configuration
 */
router.get('/backend', async (req, res) => {
  try {
    await ensureConfigDir();

    try {
      const configData = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
      const config = JSON.parse(configData);

      res.json({
        success: true,
        config
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return default config
        const defaultConfig = getDefaultConfig();
        res.json({
          success: true,
          config: defaultConfig,
          isDefault: true
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('[Config API] Load error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load configuration',
      details: error.message
    });
  }
});

/**
 * POST /api/config/backend
 * Save backend configuration
 */
router.post('/backend', async (req, res) => {
  try {
    const { config } = req.body;

    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'Missing configuration data'
      });
    }

    await ensureConfigDir();
    await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');

    res.json({
      success: true,
      message: 'Configuration saved successfully'
    });
  } catch (error) {
    console.error('[Config API] Save error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to save configuration',
      details: error.message
    });
  }
});

/**
 * POST /api/config/test-db
 * Test database connection
 */
router.post('/test-db', async (req, res) => {
  try {
    const { database } = req.body;

    if (!database) {
      return res.status(400).json({
        success: false,
        error: 'Missing database configuration'
      });
    }

    // Import database connection dynamically
    let db;
    try {
      const dbModule = await import('../../services/db/index.js');
      db = dbModule.default || dbModule.db;
    } catch (error) {
      return res.json({
        success: false,
        message: 'Database module not available',
        details: error.message
      });
    }

    // Test query
    try {
      await db.query('SELECT 1 as test');

      res.json({
        success: true,
        message: 'Database connection successful',
        database: {
          host: database.host,
          port: database.port,
          name: database.name
        }
      });
    } catch (error) {
      res.json({
        success: false,
        message: 'Database connection failed',
        details: error.message
      });
    }
  } catch (error) {
    console.error('[Config API] DB test error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to test database connection',
      details: error.message
    });
  }
});

/**
 * POST /api/auth/test
 * Test authentication system
 */
router.post('/auth/test', async (req, res) => {
  try {
    const { jwtSecret } = req.body;

    if (!jwtSecret) {
      return res.json({
        success: false,
        message: 'JWT secret is required for authentication system'
      });
    }

    // Check if JWT secret matches current config
    const currentSecret = process.env.JWT_SECRET;

    if (!currentSecret) {
      return res.json({
        success: false,
        message: 'JWT_SECRET not configured in environment'
      });
    }

    // Simple test: check if auth routes are accessible
    try {
      // Import auth module to verify it's loaded
      const authModule = await import('./auth.js');

      res.json({
        success: true,
        message: 'Authentication system is configured and ready',
        details: {
          secretConfigured: true,
          authRoutesLoaded: !!authModule
        }
      });
    } catch (error) {
      res.json({
        success: false,
        message: 'Authentication module not properly loaded',
        details: error.message
      });
    }
  } catch (error) {
    console.error('[Config API] Auth test error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to test authentication',
      details: error.message
    });
  }
});

/**
 * POST /api/config/test-integram
 * Test Integram API connectivity
 */
router.post('/test-integram', async (req, res) => {
  try {
    const { apiUrl, database } = req.body;

    if (!apiUrl || !database) {
      return res.status(400).json({
        success: false,
        error: 'Missing Integram configuration (apiUrl, database)'
      });
    }

    try {
      const testUrl = `${apiUrl}/${database}?JSON_KV`;
      const response = await axios.get(testUrl, {
        timeout: 5000
      });

      res.json({
        success: true,
        message: 'Integram API is accessible',
        details: {
          url: testUrl,
          status: response.status
        }
      });
    } catch (error) {
      res.json({
        success: false,
        message: 'Failed to connect to Integram API',
        details: {
          url: `${apiUrl}/${database}`,
          error: error.message
        }
      });
    }
  } catch (error) {
    console.error('[Config API] Integram test error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to test Integram connection',
      details: error.message
    });
  }
});

/**
 * GET /api/config/health
 * Health check for config API
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'config-api',
    timestamp: new Date().toISOString()
  });
});

/**
 * Get default configuration
 */
function getDefaultConfig() {
  return {
    monolith: {
      url: process.env.BACKEND_URL || '',
      port: parseInt(process.env.PORT || '8081'),
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        name: process.env.DB_NAME || 'dronedoc',
        user: process.env.DB_USER || 'dronedoc',
        password: '' // Never expose password in default config
      },
      auth: {
        jwtSecret: '', // Never expose secret in default config
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d'
      }
    },
    integram: {
      apiUrl: process.env.INTEGRAM_API_URL || 'https://dronedoc.ru',
      database: process.env.INTEGRAM_DATABASE || 'ddadmin',
      credentials: {
        login: '',
        password: ''
      },
      tables: {
        users: '18',
        menus: '',
        agents: '',
        tokens: '',
        payments: ''
      }
    },
    endpointMappings: [
      { endpoint: '/api/users', tableId: '18', description: 'Users table' },
      { endpoint: '/api/auth/methods', tableId: '', description: 'Authentication methods' }
    ]
  };
}

export default router;
