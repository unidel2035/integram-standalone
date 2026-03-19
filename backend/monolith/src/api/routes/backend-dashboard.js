import { Router } from 'express';
import os from 'os';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get all IP addresses of the server
 */
function getServerIPs() {
  const nets = networkInterfaces();
  const ips = {
    ipv4: [],
    ipv6: [],
    public: [],
    private: []
  };

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal (i.e. 127.0.0.1) and non-IPv4 addresses
      if (net.family === 'IPv4') {
        ips.ipv4.push({
          interface: name,
          address: net.address,
          netmask: net.netmask,
          internal: net.internal
        });

        // Categorize as public or private
        if (!net.internal) {
          if (isPrivateIP(net.address)) {
            ips.private.push(net.address);
          } else {
            ips.public.push(net.address);
          }
        }
      } else if (net.family === 'IPv6' && !net.internal) {
        ips.ipv6.push({
          interface: name,
          address: net.address,
          netmask: net.netmask
        });
      }
    }
  }

  return ips;
}

/**
 * Check if IP is in private range
 */
function isPrivateIP(ip) {
  const parts = ip.split('.').map(Number);
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

const router = Router();

// In-memory storage for deployment history (in production, use database)
const deploymentHistory = [];
const serviceHealth = new Map();

/**
 * Get comprehensive backend system overview
 */
router.get('/system-overview', async (req, res) => {
  try {
    const serverIPs = getServerIPs();

    const overview = {
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        uptime: os.uptime(),
        nodeVersion: process.version,
        memoryTotal: os.totalmem(),
        memoryFree: os.freemem(),
        memoryUsage: process.memoryUsage(),
        cpuCores: os.cpus().length,
        loadAverage: os.loadavg()
      },
      network: {
        ips: serverIPs,
        primaryIP: serverIPs.public[0] || serverIPs.private[0] || 'unknown',
        hostname: os.hostname(),
        interfaces: serverIPs.ipv4.map(ip => ({
          name: ip.interface,
          address: ip.address,
          type: ip.internal ? 'internal' : (isPrivateIP(ip.address) ? 'private' : 'public')
        }))
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        cwd: process.cwd(),
        execPath: process.execPath,
        env: process.env.NODE_ENV || 'development'
      },
      deployment: {
        environment: process.env.NODE_ENV || 'development',
        domain: process.env.DOMAIN || (process.env.NODE_ENV === 'production' ? 'drondoc.ru' : 'dev.drondoc.ru'),
        port: process.env.PORT || 8001,
        httpsEnabled: process.env.HTTPS_ENABLED === 'true',
        version: process.env.APP_VERSION || '4.5.0',
        gitBranch: process.env.GIT_BRANCH || 'unknown',
        gitCommit: process.env.GIT_COMMIT || 'unknown'
      },
      timestamp: new Date().toISOString()
    };

    res.json({ success: true, data: overview });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all backend services and their status
 */
router.get('/services', async (req, res) => {
  try {
    const serverIPs = getServerIPs();
    const primaryIP = serverIPs.public[0] || serverIPs.private[0] || 'unknown';
    const hostname = os.hostname();
    const environment = process.env.NODE_ENV || 'development';
    const domain = process.env.DOMAIN || (environment === 'production' ? 'drondoc.ru' : 'dev.drondoc.ru');

    const services = [
      {
        id: 'monolith',
        name: 'Monolith Backend',
        type: 'Node.js',
        port: process.env.PORT || 8001,
        status: 'running',
        uptime: process.uptime(),
        health: 'healthy',
        server: {
          hostname: hostname,
          ip: primaryIP,
          domain: domain,
          location: environment === 'production' ? 'Production (drondoc.ru)' : 'Development (dev.drondoc.ru)',
          allIPs: {
            public: serverIPs.public,
            private: serverIPs.private
          }
        },
        endpoints: [
          '/api/health',
          '/api/agents',
          '/api/youtube',
          '/api/agricultural-ai',
          '/api/ai-tokens',
          '/api/recording',
          '/api/mcp'
        ],
        metrics: {
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        },
        url: `https://${domain}:${process.env.PORT || 8001}`
      },
      {
        id: 'frontend',
        name: 'Frontend Application',
        type: 'Vue 3 + Vite',
        port: environment === 'production' ? 443 : 5173,
        status: 'running',
        health: 'healthy',
        server: {
          hostname: hostname,
          ip: primaryIP,
          domain: domain,
          location: environment === 'production' ? 'Production (drondoc.ru)' : 'Development (dev.drondoc.ru)'
        },
        url: `https://${domain}`,
        description: 'Main web application interface'
      },
      {
        id: 'integram',
        name: 'Integram Core (FastAPI)',
        type: 'Python',
        port: 8000,
        status: serviceHealth.get('integram')?.status || 'unknown',
        health: serviceHealth.get('integram')?.health || 'unknown',
        server: {
          hostname: hostname,
          ip: primaryIP,
          domain: domain,
          location: environment === 'production' ? 'Production' : 'Development'
        },
        endpoints: ['/docs', '/api/v1'],
        lastCheck: serviceHealth.get('integram')?.lastCheck,
        url: `http://${domain}:8000`
      },
      {
        id: 'telegram-bot',
        name: 'Telegram Bot',
        type: 'Node.js',
        status: serviceHealth.get('telegram-bot')?.status || 'unknown',
        health: serviceHealth.get('telegram-bot')?.health || 'unknown',
        server: {
          hostname: hostname,
          ip: primaryIP,
          domain: domain,
          location: 'Cloud (Telegram)'
        },
        lastCheck: serviceHealth.get('telegram-bot')?.lastCheck,
        description: 'Telegram bot for DronDoc integration'
      },
      {
        id: 'cli',
        name: 'DronDoc CLI',
        type: 'Node.js',
        status: 'available',
        health: 'healthy',
        server: {
          hostname: hostname,
          ip: primaryIP,
          location: 'Local/Server'
        },
        description: 'Command-line interface for DronDoc operations'
      }
    ];

    res.json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get available API endpoints from monolith
 */
router.get('/endpoints', async (req, res) => {
  try {
    const routesPath = path.join(__dirname);
    const files = await fs.readdir(routesPath);

    const endpoints = [];

    for (const file of files) {
      // Skip test files, directories, and special files
      if (file.endsWith('.js') && !file.startsWith('_') && !file.includes('.spec.') && !file.includes('.test.')) {
        const routeName = file.replace('.js', '');
        const filePath = path.join(routesPath, file);
        const stats = await fs.stat(filePath);

        // Skip directories
        if (stats.isDirectory()) {
          continue;
        }

        endpoints.push({
          name: routeName,
          path: `/api/${routeName}`,
          file: file,
          size: stats.size,
          modified: stats.mtime,
          category: categorizeEndpoint(routeName)
        });
      }
    }

    res.json({ success: true, data: endpoints });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get deployment information
 */
router.get('/deployments', async (req, res) => {
  try {
    const deploymentInfo = {
      current: {
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0',
        deployedAt: process.env.DEPLOYED_AT || new Date().toISOString(),
        gitBranch: process.env.GIT_BRANCH || 'unknown',
        gitCommit: process.env.GIT_COMMIT || 'unknown'
      },
      history: deploymentHistory.slice(-10), // Last 10 deployments
      configuration: {
        httpsEnabled: process.env.HTTPS_ENABLED === 'true',
        redisEnabled: process.env.REDIS_ENABLED === 'true',
        databaseConnected: !!process.env.DATABASE_URL,
        port: process.env.PORT || 8001
      }
    };

    res.json({ success: true, data: deploymentInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get environment configuration (sanitized)
 */
router.get('/configuration', async (req, res) => {
  try {
    const config = {
      server: {
        port: process.env.PORT || 8001,
        httpsEnabled: process.env.HTTPS_ENABLED === 'true',
        nodeEnv: process.env.NODE_ENV || 'development'
      },
      features: {
        redis: process.env.REDIS_ENABLED === 'true',
        database: !!process.env.DATABASE_URL,
        openai: !!process.env.OPENAI_API_KEY,
        deepseek: !!process.env.DEEPSEEK_API_KEY,
        youtube: !!process.env.YOUTUBE_API_KEY,
        stripe: !!process.env.STRIPE_SECRET_KEY
      },
      paths: {
        workingDirectory: process.cwd(),
        uploadsDir: process.env.UPLOADS_DIR || './uploads',
        dataDir: process.env.DATA_DIR || './data',
        logsDir: process.env.LOG_DIR || './logs'
      }
    };

    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get logs from the backend
 */
router.get('/logs', async (req, res) => {
  try {
    const { service = 'monolith', limit = 100, level = 'all' } = req.query;

    const logsDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logsDir, `${service}.log`);

    let logs = [];

    try {
      const logContent = await fs.readFile(logFile, 'utf-8');
      const lines = logContent.split('\n').filter(line => line.trim());

      logs = lines
        .slice(-parseInt(limit))
        .map((line, index) => {
          try {
            const parsed = JSON.parse(line);
            return {
              id: index,
              timestamp: parsed.time || parsed.timestamp,
              level: parsed.level,
              message: parsed.msg || parsed.message,
              ...parsed
            };
          } catch {
            return {
              id: index,
              timestamp: new Date().toISOString(),
              level: 'info',
              message: line
            };
          }
        });
    } catch (error) {
      // Log file doesn't exist or can't be read
      logs = [{
        id: 0,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `No logs found for service: ${service}`
      }];
    }

    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Restart a service (requires proper permissions)
 */
router.post('/services/:serviceId/restart', async (req, res) => {
  try {
    const { serviceId } = req.params;

    // In production, this would trigger PM2 restart, Docker restart, etc.
    // For now, just log the action

    const action = {
      service: serviceId,
      action: 'restart',
      timestamp: new Date().toISOString(),
      requestedBy: req.user?.id || 'anonymous',
      status: 'pending'
    };

    deploymentHistory.push(action);

    res.json({
      success: true,
      message: `Restart requested for ${serviceId}`,
      data: action
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update service health status
 */
router.post('/services/:serviceId/health', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { status, health, metadata } = req.body;

    serviceHealth.set(serviceId, {
      status,
      health,
      metadata,
      lastCheck: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Health status updated for ${serviceId}`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get database information
 */
router.get('/database', async (req, res) => {
  try {
    const dbInfo = {
      configured: !!process.env.DATABASE_URL,
      type: process.env.DATABASE_URL ? 'PostgreSQL' : 'none',
      host: process.env.DB_HOST || 'unknown',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'unknown',
      // Don't expose credentials
      connected: false, // Would need to check actual connection
      tables: [] // Would need to query actual tables
    };

    res.json({ success: true, data: dbInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get metrics and statistics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          percentage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
        },
        cpu: {
          cores: os.cpus().length,
          model: os.cpus()[0].model,
          loadAverage: os.loadavg()
        },
        uptime: {
          system: os.uptime(),
          process: process.uptime()
        }
      },
      process: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        pid: process.pid
      },
      requests: {
        // Would track actual request counts in production
        total: 0,
        success: 0,
        errors: 0
      }
    };

    res.json({ success: true, data: metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Helper function to categorize endpoints
 */
function categorizeEndpoint(name) {
  const categories = {
    'ai-tokens': 'AI Services',
    'youtube': 'Analytics',
    'youtube-ai': 'Analytics',
    'agricultural-ai': 'Agriculture',
    'agricultural-missions': 'Agriculture',
    'agricultural-calculators': 'Agriculture',
    'agro-products': 'Agriculture',
    'agro-recipes': 'Agriculture',
    'recording': 'Media',
    'voice-agent': 'Media',
    'mcp': 'AI Services',
    'agents': 'Core',
    'tasks': 'Core',
    'health': 'System',
    'backup': 'System',
    'logs': 'System',
    'accounting': 'Business',
    'payments': 'Business',
    'oauth': 'Auth',
    'auth': 'Auth',
    'security': 'Security',
    'notifications': 'Communication',
    'messaging': 'Communication',
    'database-manager': 'Data',
    'test-runner': 'Development',
    'code-review': 'Development'
  };

  return categories[name] || 'Other';
}

export default router;
