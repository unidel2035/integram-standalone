// solve.js - GitHub Issue Solver Routes
// Replicates telegram-bot /solve functionality (Issue #2208)
// Uses SSH to execute solve commands on remote server (root@193.239.166.31)
import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../../utils/logger.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = createLogger('solve-api');

// SSH configuration for remote solve execution (Issue #2208, #2245)
const SOLVE_SSH_HOST = process.env.AUTO_SOLVE_SSH_HOST || 'root@193.239.166.31';
const SOLVE_SSH_PASSWORD = process.env.AUTO_SOLVE_SSH_PASSWORD || 'Ivtm4XEfm6qS';
const SOLVE_USER = 'hive'; // User to run solve commands as

/**
 * Build SSH command with password authentication using sshpass
 * @param {string} command - The command to execute on remote server
 * @returns {string} - Complete sshpass + ssh command
 */
function buildSshCommand(command) {
  // Use sshpass for password authentication (Issue #2245)
  // Format: sshpass -p 'password' ssh -o StrictHostKeyChecking=no host 'command'
  return `sshpass -p '${SOLVE_SSH_PASSWORD}' ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${SOLVE_SSH_HOST} '${command}'`;
}

/**
 * Session Manager for solve processes
 * Manages screen sessions for isolated execution of solve commands
 */
class ScreenSessionManager {
  constructor() {
    this.sessions = new Map(); // session_id -> session_info
    this.logsDir = path.join(__dirname, '../../../logs/solve');
    this._initializeLogsDir();
  }

  async _initializeLogsDir() {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
      logger.info(`[ScreenSessionManager] Local logs directory initialized: ${this.logsDir} (metadata only)`);
      logger.info(`[ScreenSessionManager] Remote logs will be stored on ${SOLVE_SSH_HOST}:/home/${SOLVE_USER}/solve-logs/`);
    } catch (error) {
      logger.error(`[ScreenSessionManager] Failed to create logs directory: ${error.message}`);
    }
  }

  /**
   * Generate unique session ID
   */
  _generateSessionId(userId = 'api') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `solve-${userId}-${timestamp}`;
  }

  /**
   * Get log file path for session
   */
  _getLogPath(sessionId) {
    return path.join(this.logsDir, `${sessionId}.log`);
  }

  /**
   * Start a new solve session using shell script (Issue #2302)
   * The script runs in background and the method returns immediately with 'running' status
   */
  async startSession(issueUrl, options = [], userId = 'api', userInfo = 'API User') {
    const sessionId = this._generateSessionId(userId);
    const logPath = this._getLogPath(sessionId);
    const scriptPath = path.join(__dirname, '../../../scripts/solve-ssh-wrapper.sh');

    try {
      // Validate GitHub token
      if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
        console.log('\n❌ [SOLVE] GitHub token not configured!');
        console.log('   Please set GITHUB_TOKEN or GH_TOKEN environment variable.\n');
        return {
          success: false,
          message: 'GitHub token not configured. Set GITHUB_TOKEN or GH_TOKEN environment variable.',
          sessionId: null
        };
      }

      // Console output for development visibility (Issue #2274)
      console.log('\n🚀 [SOLVE] Starting solve session via shell script');
      console.log(`   Session ID: ${sessionId}`);
      console.log(`   Issue URL: ${issueUrl}`);
      console.log(`   User: ${userInfo} (${userId})`);
      console.log(`   Script: ${scriptPath}`);
      console.log(`   SSH Host: ${SOLVE_SSH_HOST}\n`);

      logger.info(`[Session][${sessionId}] Starting solve session for ${userInfo}`, {
        issueUrl,
        options,
        sshHost: SOLVE_SSH_HOST,
        scriptPath
      });

      // Store session info with 'running' status
      this.sessions.set(sessionId, {
        sessionId,
        userId,
        userInfo,
        issueUrl,
        options,
        startTime: new Date(),
        sshHost: SOLVE_SSH_HOST,
        status: 'running',
        scriptPath
      });

      // Execute shell script in background
      // The script will continue running while solve is running
      console.log('⏳ [SOLVE] Launching shell script in background...');
      logger.info(`[Session][${sessionId}] Launching shell script in background`);

      const scriptProcess = exec(`"${scriptPath}" "${issueUrl}"`, (error, stdout, stderr) => {
        // This callback is called when the script completes
        const endTime = new Date();
        const session = this.sessions.get(sessionId);

        if (!session) {
          logger.warn(`[Session][${sessionId}] Session not found when script completed`);
          return;
        }

        const duration = endTime - session.startTime;
        const durationMinutes = (duration / 1000 / 60).toFixed(2);

        if (error) {
          console.log(`\n❌ [SOLVE] Script execution failed for session ${sessionId}`);
          console.log(`   Error: ${error.message}`);
          console.log(`   Exit code: ${error.code}`);
          if (stderr) console.log(`   Stderr: ${stderr}`);

          logger.error(`[Session][${sessionId}] Script execution failed: ${error.message}`, {
            exitCode: error.code,
            stderr,
            duration
          });

          // Update session status to 'failed'
          session.status = 'failed';
          session.endTime = endTime;
          session.duration = duration;
          session.error = error.message;
          session.exitCode = error.code;
        } else {
          console.log(`\n✅ [SOLVE] Script completed successfully for session ${sessionId}`);
          console.log(`   Duration: ${durationMinutes} minutes`);
          if (stdout) console.log(`   Output: ${stdout}`);

          logger.info(`[Session][${sessionId}] Script completed successfully`, {
            duration,
            durationMinutes: parseFloat(durationMinutes),
            stdout
          });

          // Update session status to 'completed'
          session.status = 'completed';
          session.endTime = endTime;
          session.duration = duration;
          session.durationMinutes = parseFloat(durationMinutes);
        }

        this.sessions.set(sessionId, session);
      });

      console.log(`✅ [SOLVE] Solve script launched successfully!`);
      console.log(`   Session ID: ${sessionId}`);
      console.log(`   Status: running`);
      console.log(`   Check status with: GET /api/solve/sessions/${sessionId}\n`);

      return {
        success: true,
        message: `Solve session started on ${SOLVE_SSH_HOST}`,
        sessionId,
        remoteHost: SOLVE_SSH_HOST,
        status: 'running'
      };

    } catch (error) {
      console.log(`\n❌ [SOLVE] Error starting solve session!`);
      console.log(`   Session ID: ${sessionId}`);
      console.log(`   Error: ${error.message}`);
      console.log(`   Stack: ${error.stack}\n`);
      logger.error(`[Session][${sessionId}] Error starting solve session: ${error.message}`, {
        error: error.stack
      });
      return {
        success: false,
        message: `Error starting solve session: ${error.message}`,
        sessionId: null
      };
    }
  }

  /**
   * Stop a running session (Issue #2302: Note - cannot easily stop background script)
   */
  async stopSession(sessionId) {
    try {
      if (!this.sessions.has(sessionId)) {
        return {
          success: false,
          message: `Session ${sessionId} not found`
        };
      }

      const session = this.sessions.get(sessionId);

      if (session.status !== 'running') {
        return {
          success: false,
          message: `Session ${sessionId} is not running (status: ${session.status})`
        };
      }

      logger.info(`[Session][${sessionId}] Marking session as stopped`);

      // Update session status
      // Note: The background script will continue running until solve completes
      // This just marks the session as stopped in our tracking
      session.status = 'stopped';
      session.stopTime = new Date();

      logger.info(`[Session][${sessionId}] Session marked as stopped (script may continue in background)`);

      return {
        success: true,
        message: `Session ${sessionId} marked as stopped (note: background script continues until solve completes)`,
        warning: 'The shell script cannot be easily terminated once started. It will continue until solve completes.'
      };

    } catch (error) {
      logger.error(`[Session][${sessionId}] Error stopping session: ${error.message}`);
      return {
        success: false,
        message: `Error stopping session: ${error.message}`
      };
    }
  }

  /**
   * Check if a session is still running (based on session status)
   */
  async _isSessionAlive(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    return session.status === 'running';
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionId = null) {
    if (sessionId) {
      if (!this.sessions.has(sessionId)) {
        return { error: `Session ${sessionId} not found` };
      }

      const sessionInfo = { ...this.sessions.get(sessionId) };
      const isAlive = await this._isSessionAlive(sessionId);
      sessionInfo.isAlive = isAlive;

      // Update status if session completed
      if (!isAlive && sessionInfo.status === 'running') {
        sessionInfo.status = 'completed';
        const session = this.sessions.get(sessionId);
        session.status = 'completed';
      }

      return sessionInfo;
    } else {
      // Return all sessions
      const allSessions = {};
      for (const [sid, info] of this.sessions.entries()) {
        const sessionInfo = { ...info };
        const isAlive = await this._isSessionAlive(sid);
        sessionInfo.isAlive = isAlive;

        if (!isAlive && sessionInfo.status === 'running') {
          sessionInfo.status = 'completed';
          info.status = 'completed';
        }

        allSessions[sid] = sessionInfo;
      }
      return allSessions;
    }
  }

  /**
   * Get session logs (Issue #2302: No logs stored, return session info instead)
   */
  async getSessionLogs(sessionId, lines = 50) {
    try {
      if (!this.sessions.has(sessionId)) {
        return {
          success: false,
          logs: `Session ${sessionId} not found`
        };
      }

      const session = this.sessions.get(sessionId);

      logger.info(`[Session][${sessionId}] Fetching session information (logs not available with shell script approach)`);

      // Return session information as "logs"
      const sessionInfo = JSON.stringify(session, null, 2);

      return {
        success: true,
        logs: `Session Information:\n${sessionInfo}\n\nNote: Detailed logs are not available with the shell script approach (Issue #2302).\nCheck the solve command output on the remote server.`
      };

    } catch (error) {
      logger.error(`[Session][${sessionId}] Error getting session info: ${error.message}`);
      return {
        success: false,
        logs: `Error getting session info: ${error.message}`
      };
    }
  }

  /**
   * Cleanup old sessions (metadata only, logs remain on remote server)
   */
  async cleanupOldSessions(days = 7) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.startTime < cutoffDate && session.status !== 'running') {
        // Note: We don't delete log files on remote server
        // They can be cleaned up manually or via cron job on the remote server

        // Remove session metadata
        this.sessions.delete(sessionId);
        removedCount++;
      }
    }

    logger.info(`[ScreenSessionManager] Cleaned up ${removedCount} old session metadata entries`);
    return removedCount;
  }
}

/**
 * Task Queue for solve requests
 */
class SolveQueue {
  constructor(sessionManager) {
    this.queue = [];
    this.processing = false;
    this.sessionManager = sessionManager;
  }

  /**
   * Add task to queue
   */
  async enqueue(task) {
    this.queue.push(task);
    logger.info(`[SolveQueue] Task added. Queue size: ${this.queue.length}`);

    if (!this.processing) {
      this._processQueue();
    }
  }

  /**
   * Process queue
   */
  async _processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      logger.info(`[SolveQueue] Processing task. Remaining: ${this.queue.length}`);

      try {
        const { issueUrl, options, userId, userInfo, callback } = task;

        const result = await this.sessionManager.startSession(
          issueUrl,
          options,
          userId,
          userInfo
        );

        if (callback) {
          callback(result);
        }

      } catch (error) {
        logger.error(`[SolveQueue] Error processing task: ${error.message}`);
      }
    }

    this.processing = false;
  }

  /**
   * Get queue size
   */
  size() {
    return this.queue.length;
  }
}

/**
 * Create solve routes
 */
export function createSolveRoutes() {
  const router = express.Router();
  const sessionManager = new ScreenSessionManager();
  const solveQueue = new SolveQueue(sessionManager);

  /**
   * POST /api/solve - Start a solve session
   * Body: {
   *   issueUrl: string,
   *   options?: string[],
   *   userId?: string,
   *   userInfo?: string
   * }
   * Issue #2302: Returns immediately with 'running' status, script continues in background
   */
  router.post('/solve', async (req, res) => {
    try {
      const { issueUrl, options = [], userId = 'api', userInfo = 'API User' } = req.body;

      // Console output for endpoint access visibility (Issue #2274)
      console.log('\n' + '='.repeat(80));
      console.log('📥 [SOLVE ENDPOINT] POST /api/solve - Request received');
      console.log('='.repeat(80));
      console.log(`   Timestamp: ${new Date().toISOString()}`);
      console.log(`   Issue URL: ${issueUrl || '(not provided)'}`);
      console.log(`   Options: ${JSON.stringify(options)}`);
      console.log(`   User ID: ${userId}`);
      console.log(`   User Info: ${userInfo}`);
      console.log('='.repeat(80) + '\n');

      if (!issueUrl) {
        console.log('❌ [SOLVE ENDPOINT] Missing required parameter: issueUrl\n');
        return res.status(400).json({
          success: false,
          error: 'issueUrl is required'
        });
      }

      // Validate GitHub token
      if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
        console.log('❌ [SOLVE ENDPOINT] GitHub token not configured!\n');
        return res.status(500).json({
          success: false,
          error: 'GitHub token not configured. Set GITHUB_TOKEN or GH_TOKEN environment variable.'
        });
      }

      // Start session directly (no queue needed for asynchronous execution)
      console.log('📋 [SOLVE ENDPOINT] Starting solve session...');
      const result = await sessionManager.startSession(
        issueUrl,
        Array.isArray(options) ? options : [],
        userId,
        userInfo
      );

      if (!result.success) {
        console.log(`❌ [SOLVE ENDPOINT] Failed to start session: ${result.message}\n`);
        return res.status(500).json({
          success: false,
          error: result.message
        });
      }

      console.log(`✅ [SOLVE ENDPOINT] Session started successfully`);
      console.log(`   Session ID: ${result.sessionId}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Remote host: ${SOLVE_SSH_HOST}\n`);

      // Return immediately with session info (Issue #2302)
      return res.json({
        success: true,
        message: 'Solve is running',
        sessionId: result.sessionId,
        status: result.status,
        remoteHost: SOLVE_SSH_HOST,
        note: `Use GET /api/solve/sessions/${result.sessionId} to check status and completion.`
      });

    } catch (error) {
      console.log(`\n❌ [SOLVE ENDPOINT] Error handling solve request!`);
      console.log(`   Error: ${error.message}`);
      console.log(`   Stack: ${error.stack}\n`);
      logger.error(`[Solve] Error handling solve request: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/solve/sessions - Get all sessions
   */
  router.get('/solve/sessions', async (req, res) => {
    try {
      const sessions = await sessionManager.getSessionStatus();
      return res.json({
        success: true,
        sessions,
        remoteHost: SOLVE_SSH_HOST
      });
    } catch (error) {
      logger.error(`[Solve] Error getting sessions: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/solve/sessions/:sessionId - Get specific session status
   */
  router.get('/solve/sessions/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await sessionManager.getSessionStatus(sessionId);

      if (session.error) {
        return res.status(404).json({
          success: false,
          error: session.error
        });
      }

      return res.json({
        success: true,
        session
      });
    } catch (error) {
      logger.error(`[Solve] Error getting session status: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/solve/sessions/:sessionId - Stop a session
   */
  router.delete('/solve/sessions/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const result = await sessionManager.stopSession(sessionId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.json(result);
    } catch (error) {
      logger.error(`[Solve] Error stopping session: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/solve/sessions/:sessionId/logs - Get session logs
   */
  router.get('/solve/sessions/:sessionId/logs', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { lines = 50 } = req.query;

      const result = await sessionManager.getSessionLogs(sessionId, parseInt(lines));

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.logs
        });
      }

      return res.json({
        success: true,
        logs: result.logs
      });
    } catch (error) {
      logger.error(`[Solve] Error getting logs: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/solve/queue - Get queue status
   */
  router.get('/solve/queue', (req, res) => {
    return res.json({
      success: true,
      queueSize: solveQueue.size(),
      processing: solveQueue.processing
    });
  });

  /**
   * POST /api/solve/cleanup - Cleanup old sessions
   */
  router.post('/solve/cleanup', async (req, res) => {
    try {
      const { days = 7 } = req.body;
      const removedCount = await sessionManager.cleanupOldSessions(days);

      return res.json({
        success: true,
        message: `Cleaned up ${removedCount} old session metadata entries`,
        removedCount,
        note: 'Log files on remote server are not deleted by this operation'
      });
    } catch (error) {
      logger.error(`[Solve] Error cleaning up sessions: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}
