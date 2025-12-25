/**
 * Claude Code Service - Headless Integration
 * Issue #3107: Direct Claude Code integration via Chat.vue
 *
 * This service runs Claude Code in headless mode on the server,
 * providing programmatic access to Claude Code's agentic capabilities.
 *
 * Architecture:
 * Chat.vue → backend/monolith/claude-proxy → ClaudeCodeService → Claude Code (headless)
 */

import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createSession as createIntegramSession } from './email/integramSessionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ClaudeCodeService
 * Manages Claude Code sessions running in headless mode
 */
class ClaudeCodeService {
  constructor() {
    this.sessions = new Map(); // sessionId → session object
    this.workspaceRoot = process.env.CLAUDE_CODE_WORKSPACE || path.join(__dirname, '../../../workspaces');
    this.claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude'; // Assumes claude is in PATH
  }

  /**
   * Initialize service and create workspace directory
   */
  async initialize() {
    try {
      await fs.mkdir(this.workspaceRoot, { recursive: true });
      logger.info({ workspaceRoot: this.workspaceRoot }, 'ClaudeCodeService initialized');
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to initialize ClaudeCodeService');
      throw error;
    }
  }

  /**
   * Create a new Claude Code session
   * @param {string} userId - User identifier
   * @param {object} options - Session options
   * @returns {object} Session object
   */
  async createSession(userId, options = {}) {
    const sessionId = options.sessionId || uuidv4();
    const workspacePath = path.join(this.workspaceRoot, userId, sessionId);

    try {
      // Create workspace directory for this session
      await fs.mkdir(workspacePath, { recursive: true });

      // Clone repository if provided
      if (options.repositoryUrl) {
        await this._cloneRepository(options.repositoryUrl, workspacePath);
      }

      const session = {
        id: sessionId,
        userId,
        workspacePath,
        repositoryUrl: options.repositoryUrl || null,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        conversationHistory: [],
        process: null,
        streaming: false,
        allowedTools: options.allowedTools || ['Read', 'Write', 'Bash', 'WebFetch', 'Glob', 'Grep'],
        permissionMode: options.permissionMode || 'acceptEdits', // 'acceptEdits' or 'ask'
      };

      this.sessions.set(sessionId, session);
      logger.info({ sessionId, userId, workspacePath }, 'Created Claude Code session');

      return session;
    } catch (error) {
      logger.error({ error: error.message, sessionId }, 'Failed to create session');
      throw error;
    }
  }

  /**
   * Send a message to Claude Code in headless mode
   * @param {string} sessionId - Session identifier
   * @param {string} message - User message
   * @param {function} onChunk - Callback for streaming chunks
   * @returns {Promise<object>} Response object
   */
  async chat(sessionId, message, onChunk = null) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Create Integram session on first message (Issue #5137)
    // Session is created when user starts typing a message, not at workspace creation
    if (!session.integramSessionId && session.userId) {
      try {
        logger.info({ userId: session.userId, sessionId }, 'Creating Integram session for chat');

        const integramResult = await createIntegramSession({
          userId: session.userId,
          database: 'my',
          sessionType: 'claude_code_chat'
        });

        if (integramResult.success) {
          session.integramSessionId = integramResult.sessionId;
          logger.info({
            userId: session.userId,
            sessionId,
            integramSessionId: integramResult.sessionId
          }, 'Integram session created successfully');
        } else {
          logger.warn({
            userId: session.userId,
            sessionId,
            error: integramResult.error
          }, 'Failed to create Integram session');
        }
      } catch (err) {
        logger.error({
          userId: session.userId,
          sessionId,
          error: err.message,
          stack: err.stack
        }, 'Error creating Integram session');
      }
    }

    session.lastActivity = new Date().toISOString();
    session.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    try {
      // Build Claude Code command
      const args = this._buildClaudeCodeArgs(session, message);

      logger.info({ sessionId, command: args.join(' ') }, 'Executing Claude Code');

      // Execute Claude Code in headless mode
      const result = await this._executeClaudeCode(args, session.workspacePath, onChunk);

      // Store assistant response
      session.conversationHistory.push({
        role: 'assistant',
        content: result.output,
        timestamp: new Date().toISOString(),
        toolsUsed: result.toolsUsed || [],
        filesModified: result.filesModified || [],
      });

      return {
        success: true,
        sessionId,
        output: result.output,
        toolsUsed: result.toolsUsed || [],
        filesModified: result.filesModified || [],
        exitCode: result.exitCode,
      };
    } catch (error) {
      logger.error({ error: error.message, sessionId }, 'Claude Code execution failed');
      throw error;
    }
  }

  /**
   * Get Git status for session workspace
   * @param {string} sessionId - Session identifier
   * @returns {Promise<object>} Git status
   */
  async getGitStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      const { stdout } = await this._execCommand('git status --porcelain', session.workspacePath);
      const { stdout: branch } = await this._execCommand('git branch --show-current', session.workspacePath);
      const { stdout: remoteUrl } = await this._execCommand('git config --get remote.origin.url', session.workspacePath);

      const files = stdout.split('\n').filter(line => line.trim()).map(line => {
        const status = line.substring(0, 2).trim();
        const filepath = line.substring(3);
        return { status, filepath };
      });

      return {
        branch: branch.trim(),
        remoteUrl: remoteUrl.trim(),
        files,
        hasChanges: files.length > 0,
      };
    } catch (error) {
      logger.error({ error: error.message, sessionId }, 'Failed to get Git status');
      throw error;
    }
  }

  /**
   * Commit changes in session workspace
   * @param {string} sessionId - Session identifier
   * @param {string} commitMessage - Commit message
   * @returns {Promise<object>} Commit result
   */
  async commitChanges(sessionId, commitMessage) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      // Add all changes
      await this._execCommand('git add .', session.workspacePath);

      // Commit with message
      const { stdout } = await this._execCommand(
        `git commit -m "${commitMessage.replace(/"/g, '\\"')}"`,
        session.workspacePath
      );

      logger.info({ sessionId, commitMessage }, 'Committed changes');

      return {
        success: true,
        commitMessage,
        output: stdout,
      };
    } catch (error) {
      logger.error({ error: error.message, sessionId }, 'Failed to commit changes');
      throw error;
    }
  }

  /**
   * Push changes to remote repository
   * @param {string} sessionId - Session identifier
   * @returns {Promise<object>} Push result
   */
  async pushChanges(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      const { stdout } = await this._execCommand('git push', session.workspacePath);

      logger.info({ sessionId }, 'Pushed changes to remote');

      return {
        success: true,
        output: stdout,
      };
    } catch (error) {
      logger.error({ error: error.message, sessionId }, 'Failed to push changes');
      throw error;
    }
  }

  /**
   * List files in session workspace
   * @param {string} sessionId - Session identifier
   * @param {string} directory - Relative directory path (default: '')
   * @returns {Promise<array>} Array of files and directories
   */
  async listFiles(sessionId, directory = '') {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      const targetPath = path.join(session.workspacePath, directory);
      const entries = await fs.readdir(targetPath, { withFileTypes: true });

      const files = await Promise.all(entries.map(async (entry) => {
        const filepath = path.join(directory, entry.name);
        const stats = await fs.stat(path.join(session.workspacePath, filepath));

        return {
          name: entry.name,
          path: filepath,
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile(),
          size: stats.size,
          modified: stats.mtime.toISOString(),
        };
      }));

      return files;
    } catch (error) {
      logger.error({ error: error.message, sessionId, directory }, 'Failed to list files');
      throw error;
    }
  }

  /**
   * Read file content from session workspace
   * @param {string} sessionId - Session identifier
   * @param {string} filepath - Relative file path
   * @returns {Promise<string>} File content
   */
  async readFile(sessionId, filepath) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      const targetPath = path.join(session.workspacePath, filepath);
      const content = await fs.readFile(targetPath, 'utf-8');
      return content;
    } catch (error) {
      logger.error({ error: error.message, sessionId, filepath }, 'Failed to read file');
      throw error;
    }
  }

  /**
   * Delete a session and clean up workspace
   * @param {string} sessionId - Session identifier
   */
  async deleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      // Clean up workspace directory
      await fs.rm(session.workspacePath, { recursive: true, force: true });
      this.sessions.delete(sessionId);
      logger.info({ sessionId }, 'Deleted Claude Code session');
    } catch (error) {
      logger.error({ error: error.message, sessionId }, 'Failed to delete session');
    }
  }

  /**
   * Get all sessions for a user
   * @param {string} userId - User identifier
   * @returns {array} Array of session objects
   */
  getUserSessions(userId) {
    const sessions = [];
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        sessions.push({
          id: session.id,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          repositoryUrl: session.repositoryUrl,
          messageCount: session.conversationHistory.length,
        });
      }
    }
    return sessions;
  }

  /**
   * Build Claude Code command arguments
   * @private
   */
  _buildClaudeCodeArgs(session, message) {
    const args = [
      '--print', message,
      '--output-format', 'json',
      '--permission-mode', session.permissionMode,
    ];

    // Add allowed tools
    if (session.allowedTools.length > 0) {
      args.push('--allowedTools', session.allowedTools.join(','));
    }

    return args;
  }

  /**
   * Execute Claude Code command
   * @private
   */
  async _executeClaudeCode(args, workingDirectory, onChunk) {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(this.claudeCodePath, args, {
        cwd: workingDirectory,
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        },
      });

      let stdout = '';
      let stderr = '';
      let jsonOutput = '';

      childProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;

        // Try to extract streaming text
        if (onChunk) {
          // Claude Code outputs JSON, we need to extract the text field
          try {
            const lines = chunk.split('\n').filter(line => line.trim());
            for (const line of lines) {
              const parsed = JSON.parse(line);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                onChunk(parsed.delta.text);
              }
            }
          } catch (e) {
            // Not JSON, might be plain text
            onChunk(chunk);
          }
        }
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (exitCode) => {
        if (exitCode !== 0) {
          reject(new Error(`Claude Code exited with code ${exitCode}: ${stderr}`));
          return;
        }

        try {
          // Parse JSON output
          const result = JSON.parse(stdout);

          resolve({
            output: result.text || stdout,
            toolsUsed: result.toolsUsed || [],
            filesModified: result.filesModified || [],
            exitCode,
          });
        } catch (error) {
          // If not JSON, return raw output
          resolve({
            output: stdout,
            toolsUsed: [],
            filesModified: [],
            exitCode,
          });
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to start Claude Code: ${error.message}`));
      });
    });
  }

  /**
   * Clone a Git repository
   * @private
   */
  async _cloneRepository(repositoryUrl, workspacePath) {
    try {
      const { stdout } = await this._execCommand(`git clone ${repositoryUrl} .`, workspacePath);
      logger.info({ repositoryUrl, workspacePath }, 'Cloned repository');
      return stdout;
    } catch (error) {
      logger.error({ error: error.message, repositoryUrl }, 'Failed to clone repository');
      throw error;
    }
  }

  /**
   * Execute a shell command
   * @private
   */
  _execCommand(command, cwd) {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      exec(command, { cwd }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Command failed: ${error.message}\n${stderr}`));
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }
}

// Export singleton instance
const claudeCodeService = new ClaudeCodeService();
export default claudeCodeService;
