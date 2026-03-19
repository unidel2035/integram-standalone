// claudeTerminalHandler.js - WebSocket handler for Claude CLI terminal
import { WebSocketServer } from 'ws';
import pty from 'node-pty';
import path from 'path';
import fs from 'fs';
import logger from '../../utils/logger.js';

export class ClaudeTerminalHandler {
  constructor(server) {
    console.log('🤖 [ClaudeTerminalHandler] Initializing...');

    // Use noServer mode to avoid conflicts with other WebSocket servers
    this.wss = new WebSocketServer({
      noServer: true,
      perMessageDeflate: false
    });

    // Sessions keyed by clientId (NOT workspaceId!)
    // Each client has their own independent session
    // Session structure:
    // { pty, ws, lastPing, connectedAt, workspaceId, gracePeriodTimer, waitingForReconnect }
    this.sessions = new Map();
    this.server = server;

    // Heartbeat configuration
    this.heartbeatInterval = 30000; // 30 seconds
    this.heartbeatTimeout = 90000; // 90 seconds without response = dead

    // Reconnection grace period (wait for client to reconnect before killing PTY)
    this.reconnectGracePeriod = 30000; // 30 seconds

    this.setupWebSocket();
    this.startHeartbeatCheck();

    console.log('✅ [ClaudeTerminalHandler] WebSocket server ready (noServer mode)');
    logger.info('Claude Terminal WebSocket handler initialized');
  }

  /**
   * Start periodic heartbeat check to detect stale connections
   */
  startHeartbeatCheck() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();

      for (const [clientId, session] of this.sessions) {
        // Skip sessions waiting for reconnect (no active ws)
        if (session.waitingForReconnect || !session.ws) {
          // Check if grace period expired
          if (now - session.lastPing > this.reconnectGracePeriod + 5000) {
            logger.warn({ clientId }, 'Session grace period expired during heartbeat check');
            this.closeSession(clientId);
          }
          continue;
        }

        // Send server-side ping to keep connection alive
        if (session.ws.readyState === 1) { // WebSocket.OPEN
          try {
            session.ws.ping();
          } catch (e) {
            logger.warn({ clientId, error: e.message }, 'Failed to send ping');
          }
        }

        // Check if session is stale (no ping received for too long)
        if (now - session.lastPing > this.heartbeatTimeout) {
          logger.warn({ clientId, lastPing: session.lastPing }, 'Session timed out, closing');
          try {
            session.ws.close(1001, 'Connection timed out');
          } catch (e) {
            // Ignore
          }
          this.closeSession(clientId);
        }
      }
    }, this.heartbeatInterval);

    // Handle process exit
    process.on('beforeExit', () => {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
      }
    });
  }

  // Public method to handle upgrade requests
  handleUpgrade(request, socket, head) {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit('connection', ws, request);
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      console.log('🔌 [ClaudeTerminal] New WebSocket connection');

      // Parse workspaceId and clientId from URL query params
      const url = new URL(req.url, 'http://localhost');
      const workspaceId = url.searchParams.get('workspaceId');
      // clientId is the KEY for sessions - each client has their own session
      const clientId = url.searchParams.get('clientId') || this.generateClientId();

      console.log('🔌 [ClaudeTerminal] WorkspaceId:', workspaceId, 'ClientId:', clientId);

      if (!workspaceId) {
        console.log('❌ [ClaudeTerminal] No workspaceId provided');
        ws.send(JSON.stringify({ type: 'error', error: 'workspaceId is required' }), { compress: false });
        ws.close();
        return;
      }

      // Store references on ws for later use
      ws.clientId = clientId;
      ws.workspaceId = workspaceId;

      console.log('🚀 [ClaudeTerminal] Starting Claude session for client:', clientId);
      logger.info({ workspaceId, clientId }, 'Claude terminal connection opened');

      // Start or reconnect to Claude CLI PTY
      const result = this.startClaudeSession(ws, workspaceId, clientId);

      if (!result.success) {
        ws.send(JSON.stringify({ type: 'error', error: result.error, fatal: true }), { compress: false });
        ws.close(1000, 'Session rejected');
        return;
      }

      // Send clientId back to client for reconnection
      ws.send(JSON.stringify({ type: 'session', clientId, workspaceId }), { compress: false });

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, clientId, data);
        } catch (error) {
          logger.error({ error: error.message }, 'Failed to parse Claude terminal message');
        }
      });

      ws.on('close', (code, reason) => {
        const reasonStr = reason ? reason.toString() : '';
        logger.info({ workspaceId, clientId, code, reason: reasonStr }, 'Claude terminal connection closed');

        // Check if this is an intentional close (user clicked exit or browser closed cleanly)
        const isIntentionalClose = code === 1000 || code === 1001;

        if (isIntentionalClose) {
          // User intentionally closed - kill session immediately
          console.log('👋 [ClaudeTerminal] Intentional close, killing session for client:', clientId);
          this.closeSession(clientId);
        } else {
          // Unexpected disconnect - start grace period for reconnection
          console.log('⏳ [ClaudeTerminal] Unexpected disconnect, starting grace period for client:', clientId);
          this.startGracePeriod(clientId);
        }
      });

      ws.on('error', (error) => {
        logger.error({ workspaceId, clientId, error: error.message }, 'Claude terminal WebSocket error');
        // Start grace period instead of closing immediately
        this.startGracePeriod(clientId);
      });

      // Handle WebSocket-level pong (response to server ping)
      ws.on('pong', () => {
        const session = this.sessions.get(clientId);
        if (session) {
          session.lastPing = Date.now();
        }
      });
    });
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Start grace period for reconnection
   */
  startGracePeriod(clientId) {
    const session = this.sessions.get(clientId);
    if (!session) return;

    // Clear any existing grace period timer
    if (session.gracePeriodTimer) {
      clearTimeout(session.gracePeriodTimer);
    }

    session.waitingForReconnect = true;
    session.ws = null; // Clear WebSocket reference

    console.log(`⏳ [ClaudeTerminal] Waiting ${this.reconnectGracePeriod / 1000}s for client ${clientId} to reconnect`);
    logger.info({ clientId, gracePeriod: this.reconnectGracePeriod }, 'Starting reconnection grace period');

    session.gracePeriodTimer = setTimeout(() => {
      const currentSession = this.sessions.get(clientId);
      if (currentSession && currentSession.waitingForReconnect) {
        console.log('⌛ [ClaudeTerminal] Grace period expired, killing session for client:', clientId);
        logger.info({ clientId }, 'Grace period expired, closing session');
        this.closeSession(clientId);
      }
    }, this.reconnectGracePeriod);
  }

  startClaudeSession(ws, workspaceId, clientId) {
    console.log('📂 [ClaudeTerminal] startClaudeSession called for client:', clientId, 'workspace:', workspaceId);

    // Check for existing session for THIS client
    if (this.sessions.has(clientId)) {
      const existingSession = this.sessions.get(clientId);

      // Check if PTY process is still alive
      if (existingSession.pty && !existingSession.pty.killed) {
        // Same client reconnecting - REATTACH!
        console.log('🔄 [ClaudeTerminal] Client reconnecting to existing PTY session');
        logger.info({ clientId, pid: existingSession.pty.pid }, 'Client reconnecting to existing PTY');

        // Cancel grace period timer if active
        if (existingSession.gracePeriodTimer) {
          clearTimeout(existingSession.gracePeriodTimer);
          existingSession.gracePeriodTimer = null;
        }

        // Update session with new WebSocket
        existingSession.ws = ws;
        existingSession.lastPing = Date.now();
        existingSession.waitingForReconnect = false;

        // Send reconnection success message
        ws.send(JSON.stringify({
          type: 'output',
          data: '\r\n\x1b[32m✓ Переподключено к существующей сессии Claude\x1b[0m\r\n'
        }), { compress: false });

        return { success: true, reconnected: true };
      } else {
        // PTY is dead, clean up and create new session
        console.log('🔄 [ClaudeTerminal] Existing PTY is dead, creating new session');
        this.sessions.delete(clientId);
      }
    }

    // Determine workspace directory
    const workspacesDir = process.env.WORKSPACES_DIR || path.join(process.cwd(), 'workspaces');
    const workspaceDir = path.join(workspacesDir, workspaceId);
    console.log('📂 [ClaudeTerminal] Workspace dir:', workspaceDir);

    // Ensure workspace directory exists
    if (!fs.existsSync(workspaceDir)) {
      console.log('📂 [ClaudeTerminal] Creating workspace directory...');
      try {
        fs.mkdirSync(workspaceDir, { recursive: true });
        console.log('✅ [ClaudeTerminal] Workspace directory created');
        logger.info({ workspaceDir }, 'Created workspace directory');
      } catch (error) {
        console.error('❌ [ClaudeTerminal] Failed to create workspace directory:', error.message);
        logger.error({ workspaceDir, error: error.message }, 'Failed to create workspace directory');
        return { success: false, error: `Failed to create workspace directory: ${error.message}` };
      }
    }

    // Set up environment with Claude CLI path
    const env = {
      ...process.env,
      HOME: '/home/hive',
      USER: 'hive',
      PATH: '/home/hive/.bun/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/home/hive/.cargo/bin:/home/hive/.pyenv/shims:/home/hive/.pyenv/bin:/home/hive/.nvm/versions/node/v20.19.6/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor'
    };

    // Use project root as cwd so Claude picks up config
    const projectRoot = '/home/hive/dronedoc2025';

    console.log('🚀 [ClaudeTerminal] Spawning Claude CLI for client:', clientId);

    try {
      // Spawn Claude CLI with node-pty
      const claudePath = '/home/hive/.bun/bin/claude';

      const ptyProcess = pty.spawn(claudePath, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: projectRoot,
        env
      });

      console.log('✅ [ClaudeTerminal] Claude CLI PTY started, PID:', ptyProcess.pid, 'for client:', clientId);
      logger.info({ clientId, workspaceId, pid: ptyProcess.pid }, 'Claude CLI PTY started');

      // Store session keyed by clientId
      this.sessions.set(clientId, {
        pty: ptyProcess,
        ws,
        workspaceId,
        lastPing: Date.now(),
        connectedAt: Date.now(),
        waitingForReconnect: false,
        gracePeriodTimer: null
      });

      // Pipe PTY output to WebSocket
      // IMPORTANT: Always get current ws from session to support reconnection
      ptyProcess.onData((data) => {
        const session = this.sessions.get(clientId);
        if (session && session.ws && session.ws.readyState === 1) { // WebSocket.OPEN
          const message = JSON.stringify({ type: 'output', data });
          try {
            session.ws.send(message, { compress: false });
          } catch (err) {
            console.error('❌ [ClaudeTerminal] Send error:', err);
          }
        }
      });

      // Handle PTY exit
      ptyProcess.onExit(({ exitCode, signal }) => {
        logger.info({ clientId, workspaceId, exitCode, signal }, 'Claude CLI PTY exited');
        const session = this.sessions.get(clientId);
        if (session && session.ws && session.ws.readyState === 1) {
          session.ws.send(JSON.stringify({ type: 'exit', code: exitCode, signal }), { compress: false });
        }
        // Clear grace period timer if exists
        if (session && session.gracePeriodTimer) {
          clearTimeout(session.gracePeriodTimer);
        }
        this.sessions.delete(clientId);
      });

      return { success: true, reconnected: false };

    } catch (error) {
      logger.error({ clientId, workspaceId, error: error.message }, 'Failed to start Claude CLI PTY');
      return { success: false, error: `Не удалось запустить Claude: ${error.message}` };
    }
  }

  handleMessage(ws, clientId, data) {
    const session = this.sessions.get(clientId);

    // Handle ping even without active session
    if (data.type === 'ping') {
      // Respond with pong
      try {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }), { compress: false });
      } catch (e) {
        logger.warn({ clientId, error: e.message }, 'Failed to send pong');
      }

      // Update session lastPing if exists
      if (session) {
        session.lastPing = Date.now();
      }
      return;
    }

    if (!session) {
      ws.send(JSON.stringify({ type: 'error', error: 'No active session' }), { compress: false });
      return;
    }

    // Update lastPing on any message
    session.lastPing = Date.now();

    switch (data.type) {
      case 'input':
        // Write user input to PTY
        if (data.data) {
          session.pty.write(data.data);
        }
        break;

      case 'resize':
        // Resize PTY
        if (data.cols && data.rows) {
          session.pty.resize(data.cols, data.rows);
          logger.debug({ clientId, cols: data.cols, rows: data.rows }, 'PTY resized');
        }
        break;

      default:
        logger.warn({ clientId, type: data.type }, 'Unknown Claude terminal message type');
    }
  }

  closeSession(clientId) {
    const session = this.sessions.get(clientId);

    if (session) {
      // Clear grace period timer if exists
      if (session.gracePeriodTimer) {
        clearTimeout(session.gracePeriodTimer);
        session.gracePeriodTimer = null;
      }

      // Kill PTY process
      try {
        if (session.pty && !session.pty.killed) {
          session.pty.kill();
          logger.info({ clientId, workspaceId: session.workspaceId }, 'Claude CLI PTY killed');
        }
      } catch (error) {
        logger.error({ clientId, error: error.message }, 'Error killing Claude CLI PTY');
      }

      this.sessions.delete(clientId);
    }
  }

  close() {
    // Stop heartbeat timer
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Close all sessions
    for (const [clientId] of this.sessions) {
      this.closeSession(clientId);
    }

    // Close WebSocket server
    this.wss.close();
    logger.info('Claude Terminal WebSocket handler closed');
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const sessions = [];
    for (const [clientId, session] of this.sessions) {
      sessions.push({
        clientId,
        workspaceId: session.workspaceId,
        connectedAt: session.connectedAt,
        lastPing: session.lastPing,
        uptime: Date.now() - session.connectedAt,
        wsState: session.ws ? session.ws.readyState : 'disconnected',
        waitingForReconnect: session.waitingForReconnect
      });
    }
    return {
      activeSessions: this.sessions.size,
      sessions
    };
  }
}
