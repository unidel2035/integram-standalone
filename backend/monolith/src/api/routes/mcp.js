// mcp.js - Model Context Protocol Routes
import express from 'express';
import logger from '../../utils/logger.js';
import crypto from 'crypto';

/**
 * Parse MCP catalog markdown file to extract server information
 * @param {string} catalogContent - The markdown content
 * @returns {Array} Array of server objects
 */
function parseMCPCatalog(catalogContent) {
  const servers = [];
  const lines = catalogContent.split('\n');

  let currentCategory = '';
  let currentServer = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match category headers (## Category Name)
    if (line.match(/^## [A-Z]/)) {
      currentCategory = line.replace(/^## /, '').trim();
      continue;
    }

    // Match server names (### Server Name)
    if (line.startsWith('### ')) {
      // Save previous server if exists
      if (currentServer) {
        servers.push(currentServer);
      }

      // Start new server
      currentServer = {
        name: line.replace(/^### /, '').trim(),
        category: currentCategory,
        functions: 0,
        requiresApiKey: false,
        url: '',
        description: '',
        availableFunctions: [],
        apiDocs: ''
      };
      continue;
    }

    // Parse server properties
    if (currentServer && line.startsWith('- **')) {
      const match = line.match(/- \*\*(.+?)\*\*:\s*(.+)/);
      if (match) {
        const [, key, value] = match;

        switch (key) {
          case 'Category':
            currentServer.category = value.trim();
            break;
          case 'Functions':
            currentServer.functions = parseInt(value.trim()) || 0;
            break;
          case 'Requires API Key':
            currentServer.requiresApiKey = value.trim().toLowerCase() === 'yes';
            break;
          case 'URL':
            currentServer.url = value.trim();
            break;
          case 'Description':
            currentServer.description = value.trim();
            break;
          case 'API Docs':
            currentServer.apiDocs = value.trim();
            break;
        }
      }
    }

    // Parse available functions
    if (currentServer && line.match(/^\s+- `[\w_]+`/)) {
      const funcMatch = line.match(/`([\w_]+)`\s*-\s*(.+)/);
      if (funcMatch) {
        currentServer.availableFunctions.push({
          name: funcMatch[1],
          description: funcMatch[2]
        });
      }
    }
  }

  // Add last server
  if (currentServer) {
    servers.push(currentServer);
  }

  return servers;
}

/**
 * Session storage for MCP clients
 * Maps session ID to { client, transport, createdAt, lastUsedAt }
 */
const mcpSessions = new Map();

/**
 * Session timeout (30 minutes of inactivity)
 */
const SESSION_TIMEOUT = 30 * 60 * 1000;

/**
 * Cleanup interval for expired sessions (every 5 minutes)
 */
const CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Cleanup expired sessions
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  let cleaned = 0;

  for (const [sessionId, session] of mcpSessions.entries()) {
    if (now - session.lastUsedAt > SESSION_TIMEOUT) {
      try {
        session.client.close().catch(() => {});
        mcpSessions.delete(sessionId);
        cleaned++;
      } catch (error) {
        logger.error({ error: error.message, sessionId }, 'Failed to cleanup session');
      }
    }
  }

  if (cleaned > 0) {
    logger.info({ cleaned, remaining: mcpSessions.size }, 'Cleaned up expired MCP sessions');
  }
}

/**
 * Start periodic session cleanup
 */
setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL);

/**
 * Get or create MCP session
 */
async function getOrCreateSession(sessionId, serverScriptPath) {
  const now = Date.now();

  // If sessionId provided and session exists, reuse it
  if (sessionId && mcpSessions.has(sessionId)) {
    const session = mcpSessions.get(sessionId);
    session.lastUsedAt = now;
    logger.debug({ sessionId, age: now - session.createdAt }, 'Reusing existing MCP session');
    return { sessionId, client: session.client, isNew: false };
  }

  // Create new session
  const newSessionId = sessionId || generateSessionId();

  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverScriptPath],
  });

  const client = new Client(
    {
      name: 'integram-mcp-client',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  await client.connect(transport);

  mcpSessions.set(newSessionId, {
    client,
    transport,
    createdAt: now,
    lastUsedAt: now
  });

  logger.info({ sessionId: newSessionId, totalSessions: mcpSessions.size }, 'Created new MCP session');

  return { sessionId: newSessionId, client, isNew: true };
}

/**
 * Close a specific session
 */
async function closeSession(sessionId) {
  if (!mcpSessions.has(sessionId)) {
    return false;
  }

  const session = mcpSessions.get(sessionId);
  try {
    await session.client.close();
    mcpSessions.delete(sessionId);
    logger.info({ sessionId }, 'Closed MCP session');
    return true;
  } catch (error) {
    logger.error({ error: error.message, sessionId }, 'Failed to close session');
    return false;
  }
}

/**
 * Create MCP (Model Context Protocol) routes
 * Provides access to MCP tools and integrations
 */
export function createMCPRoutes() {
  const router = express.Router();

  /**
   * GET /api/mcp/tools
   * List available MCP tools
   */
  router.get('/tools', async (req, res) => {
    try {
      // Import MCPTools dynamically to avoid circular dependencies
      const { getMCPTools } = await import('../../services/mcp/MCPTools.js');
      const tools = await getMCPTools();

      res.json({
        success: true,
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        })),
        count: tools.length
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to list MCP tools');
      res.status(500).json({
        success: false,
        error: 'Failed to list MCP tools',
        message: error.message
      });
    }
  });

  /**
   * POST /api/mcp/chat
   * Chat with MCP-enabled AI using available tools
   */
  router.post('/chat', async (req, res) => {
    try {
      const { message, model = 'deepseek-chat', tools = [] } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }

      // Import MCP bridge dynamically
      const { executeMCPChat } = await import('../../services/mcp/MCPBridge.js');
      const result = await executeMCPChat(message, model, tools);

      res.json({
        success: true,
        response: result.response,
        toolCalls: result.toolCalls,
        model: result.model
      });
    } catch (error) {
      logger.error({ error: error.message }, 'MCP chat failed');
      res.status(500).json({
        success: false,
        error: 'MCP chat failed',
        message: error.message
      });
    }
  });

  /**
   * POST /api/mcp/execute-tool
   * Execute a specific MCP tool
   */
  router.post('/execute-tool', async (req, res) => {
    try {
      const { toolName, arguments: toolArgs } = req.body;

      if (!toolName) {
        return res.status(400).json({
          success: false,
          error: 'Tool name is required'
        });
      }

      // V2 tools (Deloitte 6 Gaps)
      if (toolName && toolName.startsWith('integram_v2_')) {
        const { executeV2Tool } = await import('../../services/mcp/integram-v2-tools.js');
        const result = await executeV2Tool(toolName, toolArgs || {});
        return res.json({ success: true, result, toolName });
      }

      // Import tool executor
      const { executeMCPTool } = await import('../../services/mcp/MCPBridge.js');
      const result = await executeMCPTool(toolName, toolArgs || {});

      res.json({
        success: true,
        result,
        toolName
      });
    } catch (error) {
      logger.error({ error: error.message, toolName: req.body.toolName }, 'MCP tool execution failed');
      res.status(500).json({
        success: false,
        error: 'Tool execution failed',
        message: error.message
      });
    }
  });

  /**
   * POST /api/mcp/stripe/charge
   * Create a Stripe charge (requires Stripe API key)
   */
  router.post('/stripe/charge', async (req, res) => {
    try {
      const { amount, currency = 'usd', description } = req.body;

      if (!amount) {
        return res.status(400).json({
          success: false,
          error: 'Amount is required'
        });
      }

      // Import Stripe tools
      const { createStripeCharge } = await import('../../services/mcp/stripe-tools.js');
      const charge = await createStripeCharge({ amount, currency, description });

      res.json({
        success: true,
        charge
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Stripe charge failed');
      res.status(500).json({
        success: false,
        error: 'Stripe charge failed',
        message: error.message
      });
    }
  });

  /**
   * POST /api/mcp/payments/russian
   * Russian payment system operations (Lava, Robokassa, YooKassa, Tinkoff)
   */
  router.post('/payments/russian', async (req, res) => {
    try {
      const { provider, operation, params } = req.body;

      if (!provider || !operation) {
        return res.status(400).json({
          success: false,
          error: 'Provider and operation are required'
        });
      }

      // Import Russian payment tools
      const { executeRussianPayment } = await import('../../services/mcp/russian-payment-tools.js');
      const result = await executeRussianPayment(provider, operation, params || {});

      res.json({
        success: true,
        result,
        provider,
        operation
      });
    } catch (error) {
      logger.error({ error: error.message, provider: req.body.provider }, 'Russian payment operation failed');
      res.status(500).json({
        success: false,
        error: 'Payment operation failed',
        message: error.message
      });
    }
  });

  /**
   * GET /api/mcp/health
   * MCP service health check
   */
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'mcp',
      timestamp: new Date().toISOString()
    });
  });

  /**
   * GET /api/mcp/sessions
   * List all active MCP sessions
   */
  router.get('/sessions', (req, res) => {
    const now = Date.now();
    const sessions = [];

    for (const [sessionId, session] of mcpSessions.entries()) {
      sessions.push({
        sessionId,
        createdAt: new Date(session.createdAt).toISOString(),
        lastUsedAt: new Date(session.lastUsedAt).toISOString(),
        ageMs: now - session.createdAt,
        idleMs: now - session.lastUsedAt
      });
    }

    res.json({
      success: true,
      sessions,
      count: sessions.length,
      timeout: SESSION_TIMEOUT,
      cleanupInterval: CLEANUP_INTERVAL
    });
  });

  /**
   * DELETE /api/mcp/sessions/:sessionId
   * Close a specific MCP session
   */
  router.delete('/sessions/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    const closed = await closeSession(sessionId);

    if (closed) {
      res.json({
        success: true,
        message: `Session ${sessionId} closed successfully`
      });
    } else {
      res.status(404).json({
        success: false,
        error: `Session ${sessionId} not found`
      });
    }
  });

  /**
   * POST /api/mcp/sessions/cleanup
   * Manually trigger cleanup of expired sessions
   */
  router.post('/sessions/cleanup', (req, res) => {
    cleanupExpiredSessions();

    res.json({
      success: true,
      message: 'Cleanup triggered',
      activeSessions: mcpSessions.size
    });
  });

  /**
   * MCP Session storage for persistent connections
   * Maps sessionId to { client, transport, createdAt, lastUsedAt }
   */
  const mcpIntegStations = new Map();

  /**
   * Get or create MCP client for integram
   */
  async function getIntegraMCPClient(sessionId) {
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const serverScriptPath = path.join(__dirname, '../../services/mcp/integram-server.js');

    // Check for existing session
    if (sessionId && mcpIntegStations.has(sessionId)) {
      const session = mcpIntegStations.get(sessionId);
      session.lastUsedAt = Date.now();
      return { client: session.client, sessionId, isNew: false };
    }

    // Create new session
    const newSessionId = sessionId || crypto.randomBytes(16).toString('hex');

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverScriptPath],
    });

    const client = new Client(
      { name: 'integram-http-mcp', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    await client.connect(transport);

    mcpIntegStations.set(newSessionId, {
      client,
      transport,
      createdAt: Date.now(),
      lastUsedAt: Date.now()
    });

    // Cleanup old sessions (older than 30 min)
    const now = Date.now();
    for (const [id, sess] of mcpIntegStations.entries()) {
      if (now - sess.lastUsedAt > 30 * 60 * 1000) {
        try {
          await sess.client.close();
        } catch (e) {}
        mcpIntegStations.delete(id);
      }
    }

    return { client, sessionId: newSessionId, isNew: true };
  }

  /**
   * GET /api/mcp/integram
   * SSE endpoint for MCP protocol (Streamable HTTP transport)
   * Supports both SSE streaming and regular HTTP for mcp-remote
   */
  router.get('/integram', async (req, res) => {
    // Set SSE headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');

    logger.info('MCP SSE client connected');

    // Send endpoint event as per MCP spec
    const sessionId = crypto.randomBytes(16).toString('hex');
    res.write(`event: endpoint\n`);
    res.write(`data: /api/mcp/integram?sessionId=${sessionId}\n\n`);

    // Keep connection alive
    const keepAliveInterval = setInterval(() => {
      res.write(`:keepalive\n\n`);
    }, 15000);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(keepAliveInterval);
      logger.info('MCP SSE client disconnected');
    });
  });

  /**
   * POST /api/mcp/integram
   * Streamable HTTP MCP endpoint - full JSON-RPC 2.0 support
   * Supports: initialize, tools/list, tools/call, notifications/initialized
   */
  router.post('/integram', async (req, res) => {
    try {
      const { jsonrpc, method, params, id } = req.body;
      const sessionId = req.query.sessionId || req.headers['mcp-session-id'];

      logger.info({ method, id, sessionId }, 'MCP HTTP request received');

      // Validate JSON-RPC
      if (jsonrpc !== '2.0') {
        return res.status(400).json({
          jsonrpc: '2.0',
          id: id || null,
          error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' }
        });
      }

      // Handle different MCP methods
      switch (method) {
        case 'initialize': {
          // MCP initialize handshake
          const { protocolVersion, capabilities: clientCaps, clientInfo } = params || {};

          logger.info({ clientInfo, protocolVersion }, 'MCP initialize request');

          res.json({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: protocolVersion || '2024-11-05',
              capabilities: {
                tools: { listChanged: false }
              },
              serverInfo: {
                name: 'integram-mcp-server',
                version: '1.0.0'
              }
            }
          });
          break;
        }

        case 'notifications/initialized': {
          // Client notification that initialization is complete
          // This is a notification, no response needed (no id)
          logger.info('MCP client initialized notification received');
          res.status(204).send();
          break;
        }

        case 'tools/list': {
          // Get MCP client and list tools
          const { client } = await getIntegraMCPClient(sessionId);
          const response = await client.listTools();

          res.json({
            jsonrpc: '2.0',
            id,
            result: {
              tools: response.tools
            }
          });
          break;
        }

        case 'tools/call': {
          // Execute tool
          const { name: toolName, arguments: toolArgs } = params || {};

          if (!toolName) {
            return res.status(400).json({
              jsonrpc: '2.0',
              id,
              error: { code: -32602, message: 'Invalid params: name is required' }
            });
          }

          const { client } = await getIntegraMCPClient(sessionId);
          const result = await client.callTool({ name: toolName, arguments: toolArgs || {} });

          res.json({
            jsonrpc: '2.0',
            id,
            result
          });
          break;
        }

        case 'ping': {
          // Health check
          res.json({
            jsonrpc: '2.0',
            id,
            result: {}
          });
          break;
        }

        default: {
          // Unknown method
          res.status(400).json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`
            }
          });
        }
      }

    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'MCP request failed');
      res.status(500).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: -32603,
          message: error.message
        }
      });
    }
  });

  /**
   * OPTIONS /api/mcp/integram
   * CORS preflight handler
   */
  router.options('/integram', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).send();
  });

  /**
   * GET /api/mcp/integram/manifest
   * MCP server manifest for claude.ai integration
   *
   * This endpoint provides the manifest that claude.ai needs to connect to this MCP server.
   * Use this URL in claude.ai Settings → Connectors:
   * https://dev.drondoc.ru/api/mcp/integram/manifest
   */
  router.get('/integram/manifest', (req, res) => {
    const baseURL = `${req.protocol}://${req.get('host')}`;

    res.json({
      schema_version: '1.0',
      name: 'Integram MCP Server',
      description: 'MCP server for Integram database operations - создание типов, объектов, запросы к БД',
      version: '1.0.0',
      capabilities: {
        tools: true
      },
      endpoints: {
        sse: `${baseURL}/api/mcp/integram`,
        tools: `${baseURL}/api/mcp/integram/tools`,
        execute: `${baseURL}/api/mcp/integram/execute`
      },
      authentication: {
        type: 'none',
        note: 'Authentication is handled per-tool via integram_authenticate or integram_set_context'
      },
      metadata: {
        author: 'DronDoc Team',
        homepage: 'https://dronedoc.ru',
        repository: 'https://github.com/unidel2035/dronedoc2025',
        documentation: 'https://dev.drondoc.ru/api/mcp/integram/tools'
      }
    });
  });

  /**
   * GET /api/mcp/integram/tools
   * List available Integram MCP tools
   */
  router.get('/integram/tools', async (req, res) => {
    try {
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const serverScriptPath = path.join(__dirname, '../../services/mcp/integram-server.js');

      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [serverScriptPath],
      });

      const client = new Client(
        {
          name: 'integram-mcp-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      await client.connect(transport);
      const response = await client.listTools();

      // Close the client
      await client.close();

      res.json({
        success: true,
        tools: response.tools,
        count: response.tools.length
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to list Integram MCP tools');
      res.status(500).json({
        success: false,
        error: 'Failed to list Integram MCP tools',
        message: error.message
      });
    }
  });

  /**
   * POST /api/mcp/integram/execute
   * Execute an Integram MCP tool with session persistence
   *
   * Supports X-Session-ID header for maintaining state across requests.
   * If no session ID is provided, a new session is created and returned.
   */
  router.post('/integram/execute', async (req, res) => {
    try {
      const { toolName, arguments: toolArgs } = req.body;
      const requestSessionId = req.headers['x-session-id'];

      if (!toolName) {
        return res.status(400).json({
          success: false,
          error: 'Tool name is required'
        });
      }

      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const serverScriptPath = path.join(__dirname, '../../services/mcp/integram-server.js');

      // Get or create session
      const { sessionId, client, isNew } = await getOrCreateSession(requestSessionId, serverScriptPath);

      try {
        const result = await client.callTool({
          name: toolName,
          arguments: toolArgs || {},
        });

        // Return session ID in response header
        res.setHeader('X-Session-ID', sessionId);

        res.json({
          success: true,
          result,
          toolName,
          session: {
            id: sessionId,
            isNew,
            message: isNew
              ? 'New session created. Use X-Session-ID header in subsequent requests to maintain state.'
              : 'Using existing session.'
          }
        });
      } catch (toolError) {
        // If tool execution fails, keep session alive for retry
        logger.error({ error: toolError.message, toolName, sessionId }, 'Tool execution failed but session kept alive');

        res.setHeader('X-Session-ID', sessionId);
        res.status(500).json({
          success: false,
          error: 'Tool execution failed',
          message: toolError.message,
          session: {
            id: sessionId,
            isNew,
            message: 'Session is still active. You can retry or use other tools.'
          }
        });
      }
    } catch (error) {
      logger.error({ error: error.message, toolName: req.body.toolName }, 'Integram tool execution failed');
      res.status(500).json({
        success: false,
        error: 'Tool execution failed',
        message: error.message
      });
    }
  });

  /**
   * GET /api/mcp/servers/catalog
   * Get the list of available MCP servers from the catalog
   */
  router.get('/servers/catalog', async (req, res) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      // Read the MCP catalog markdown file
      const catalogPath = path.join(__dirname, '../../../docs/MCP_SERVERS_CATALOG.md');
      const catalogContent = await fs.readFile(catalogPath, 'utf-8');

      // Parse the catalog to extract server information
      const servers = parseMCPCatalog(catalogContent);

      res.json({
        success: true,
        servers,
        count: servers.length,
        categories: [...new Set(servers.map(s => s.category))]
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to load MCP servers catalog');
      res.status(500).json({
        success: false,
        error: 'Failed to load MCP servers catalog',
        message: error.message
      });
    }
  });

  /**
   * GET /api/mcp/servers/connected
   * Get list of currently connected MCP servers
   */
  router.get('/servers/connected', (req, res) => {
    try {
      const connectedServers = [];

      // List all active MCP sessions
      for (const [sessionId, session] of mcpSessions.entries()) {
        connectedServers.push({
          sessionId,
          serverName: session.serverName || 'Unknown',
          createdAt: new Date(session.createdAt).toISOString(),
          lastUsedAt: new Date(session.lastUsedAt).toISOString()
        });
      }

      res.json({
        success: true,
        servers: connectedServers,
        count: connectedServers.length
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to list connected servers');
      res.status(500).json({
        success: false,
        error: 'Failed to list connected servers',
        message: error.message
      });
    }
  });

  /**
   * POST /api/mcp/servers/connect
   * Connect to an MCP server
   */
  router.post('/servers/connect', async (req, res) => {
    try {
      const { serverName, serverURL, apiKey, config } = req.body;

      if (!serverName) {
        return res.status(400).json({
          success: false,
          error: 'Server name is required'
        });
      }

      // For now, we support stdio-based MCP servers
      // HTTP/SSE MCP servers will be added in future iterations

      logger.info({ serverName, hasApiKey: !!apiKey }, 'Connecting to MCP server');

      res.json({
        success: true,
        message: `Connection request received for ${serverName}`,
        note: 'HTTP MCP server connections will be implemented in the next iteration'
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to connect to MCP server');
      res.status(500).json({
        success: false,
        error: 'Failed to connect to MCP server',
        message: error.message
      });
    }
  });

  /**
   * POST /api/mcp/integram/chat
   * Chat with AI using Integram MCP tools
   */
  router.post('/integram/chat', async (req, res) => {
    try {
      const {
        message,
        conversationHistory = [],
        serverURL,
        database,
        token,
        xsrfToken,
        systemPrompt,
        model = 'deepseek-chat',
        temperature = 0.7,
        maxTokens = 4000,
        mcpContext
      } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }

      // Use mcpContext if provided (from frontend)
      const contextServerURL = mcpContext?.serverURL || serverURL
      const contextDatabase = mcpContext?.database || database
      const contextToken = token || null
      const contextXsrfToken = xsrfToken || null

      // Import necessary modules
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
      const OpenAI = (await import('openai')).default;
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      // Initialize Integram MCP client
      const serverScriptPath = path.join(__dirname, '../../services/mcp/integram-server.js');

      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [serverScriptPath],
      });

      const mcpClient = new Client(
        {
          name: 'integram-chat-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      await mcpClient.connect(transport);

      // Set Integram context if provided
      if (contextServerURL && contextDatabase && contextToken && contextXsrfToken) {
        logger.info({ contextServerURL, contextDatabase }, 'Setting Integram MCP context');
        await mcpClient.callTool({
          name: 'integram_set_context',
          arguments: {
            serverURL: contextServerURL,
            database: contextDatabase,
            token: contextToken,
            xsrfToken: contextXsrfToken
          }
        });
      }

      // Get available tools
      const toolsResponse = await mcpClient.listTools();
      const availableTools = toolsResponse.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));

      logger.info({ toolsCount: availableTools.length }, 'Loaded Integram MCP tools');

      // Initialize DeepSeek client
      const deepseekClient = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com',
      });

      // Use custom system prompt if provided, otherwise use default
      const defaultSystemPrompt = `You are a helpful assistant with access to Integram API tools.
Use these tools to interact with the Integram database: manage types (tables), objects (records), requisites (columns), and execute queries.
Always provide clear and structured information.`;

      const messages = [
        {
          role: 'system',
          content: systemPrompt || defaultSystemPrompt
        },
        ...conversationHistory,
        { role: 'user', content: message }
      ];

      // Call DeepSeek with tools
      const completion = await deepseekClient.chat.completions.create({
        model: model,
        messages: messages,
        tools: availableTools,
        tool_choice: 'auto',
        temperature: temperature,
        max_tokens: maxTokens,
        stream: false,
      });

      let currentMessages = [...messages];
      let toolCallsCount = 0;
      const MAX_TOOL_ITERATIONS = 5;
      let finalResponse = completion;

      // Handle tool calls
      while (toolCallsCount < MAX_TOOL_ITERATIONS) {
        const choice = finalResponse.choices[0];

        if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
          toolCallsCount++;

          currentMessages.push(choice.message);

          const toolResults = [];
          for (const toolCall of choice.message.tool_calls) {
            try {
              const toolArgs = JSON.parse(toolCall.function.arguments);
              const result = await mcpClient.callTool({
                name: toolCall.function.name,
                arguments: toolArgs,
              });

              const toolResultContent = result.content?.[0]?.text || JSON.stringify(result);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: toolCall.function.name,
                content: toolResultContent,
              });
            } catch (error) {
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: toolCall.function.name,
                content: `Error: ${error.message}`,
              });
            }
          }

          currentMessages.push(...toolResults);

          const nextCompletion = await deepseekClient.chat.completions.create({
            model: model,
            messages: currentMessages,
            tools: availableTools,
            tool_choice: 'auto',
            temperature: temperature,
            max_tokens: maxTokens,
            stream: false,
          });

          finalResponse = nextCompletion;
        } else {
          break;
        }
      }

      // Close MCP client
      await mcpClient.close();

      const finalContent = finalResponse.choices[0].message.content || '';

      res.json({
        success: true,
        response: finalContent,
        toolCallsCount,
        conversationHistory: currentMessages
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Integram chat failed');
      res.status(500).json({
        success: false,
        error: 'Integram chat failed',
        message: error.message
      });
    }
  });

  return router;
}
