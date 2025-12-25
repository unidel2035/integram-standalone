/**
 * Deep Assistant Agent Service
 * Integration with github.com/deep-assistant/agent
 *
 * This service provides execution and management for the deep-assistant/agent,
 * a Bun-based CLI agent with 13 tools including file operations, bash execution,
 * web search, code search, and more.
 *
 * @see https://github.com/deep-assistant/agent
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

/**
 * Deep Assistant Agent Executor
 * Manages execution of the @link-assistant/agent CLI
 */
export class DeepAssistantAgent extends EventEmitter {
  constructor(options = {}) {
    super();

    this.workspaceId = options.workspaceId;
    this.workingDirectory = options.workingDirectory || process.cwd();

    // Default to polza/claude-sonnet-4.5 instead of opencode/grok-code
    // Fix for Issue #4894: opencode/grok-code requires @ai-sdk/openai which fails to install via Bun
    // polza/claude-sonnet-4.5 is proven to work reliably in workspace-ai-agent
    this.model = options.model || 'polza/claude-sonnet-4.5';
    this.systemMessage = options.systemMessage || null;
    this.appendSystemMessage = options.appendSystemMessage || null;

    // Agent execution state
    this.isRunning = false;
    this.sessionId = null;
    this.process = null;
    this.outputBuffer = [];
    this.eventBuffer = [];
  }

  /**
   * Execute agent with a user message
   * @param {string} message - User message to send to agent
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Agent execution result
   */
  async execute(message, options = {}) {
    if (this.isRunning) {
      throw new Error('Agent is already running');
    }

    return new Promise((resolve, reject) => {
      try {
        this.isRunning = true;
        this.outputBuffer = [];
        this.eventBuffer = [];

        // Build command arguments
        const args = this._buildCommandArgs(message, options);

        logger.info({
          command: 'bun x @link-assistant/agent',
          args: args.filter(a => !a.includes('secret')),
          workingDirectory: this.workingDirectory
        }, 'Starting deep-assistant/agent');

        // Spawn agent process using Bun
        this.process = spawn('bun', ['x', '@link-assistant/agent', ...args], {
          cwd: this.workingDirectory,
          env: process.env,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // Write message to stdin as JSON
        const inputJSON = JSON.stringify({
          message: message,
          model: this.model,
          systemMessage: this.systemMessage,
          workspaceId: this.workspaceId
        });

        this.process.stdin.write(inputJSON + '\n');
        this.process.stdin.end();

        // Collect stdout (JSON event stream)
        let stdoutData = '';
        this.process.stdout.on('data', (chunk) => {
          stdoutData += chunk.toString();

          // Parse JSON events line by line
          const lines = stdoutData.split('\n');
          stdoutData = lines.pop(); // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              try {
                const event = JSON.parse(line);
                this._handleAgentEvent(event);
              } catch (parseError) {
                logger.warn({ line, error: parseError.message }, 'Failed to parse agent event');
              }
            }
          }
        });

        // Collect stderr (errors and warnings)
        let stderrData = '';
        this.process.stderr.on('data', (chunk) => {
          stderrData += chunk.toString();
          logger.warn({ stderr: chunk.toString() }, 'Agent stderr output');
        });

        // Handle process completion
        this.process.on('close', (code) => {
          this.isRunning = false;
          this.process = null;

          if (code === 0) {
            logger.info({
              eventCount: this.eventBuffer.length,
              sessionId: this.sessionId
            }, 'Agent execution completed successfully');

            resolve({
              success: true,
              sessionId: this.sessionId,
              events: this.eventBuffer,
              output: this.outputBuffer.join('\n')
            });
          } else {
            const error = new Error(`Agent exited with code ${code}`);
            logger.error({
              code,
              stderr: stderrData,
              message: message.substring(0, 100)
            }, 'Agent execution failed');

            reject(error);
          }
        });

        // Handle process errors
        this.process.on('error', (error) => {
          this.isRunning = false;
          this.process = null;

          logger.error({ error: error.message }, 'Agent process error');
          reject(error);
        });

      } catch (error) {
        this.isRunning = false;
        logger.error({ error: error.message }, 'Failed to start agent');
        reject(error);
      }
    });
  }

  /**
   * Build command arguments for agent CLI
   * @private
   */
  _buildCommandArgs(message, options) {
    const args = [];

    // Model selection
    if (options.model || this.model) {
      args.push('--model', options.model || this.model);
    }

    // System message
    if (options.systemMessage || this.systemMessage) {
      args.push('--system-message', options.systemMessage || this.systemMessage);
    }

    // Append system message
    if (options.appendSystemMessage || this.appendSystemMessage) {
      args.push('--append-system-message', options.appendSystemMessage || this.appendSystemMessage);
    }

    return args;
  }

  /**
   * Handle agent event from JSON stream
   * @private
   */
  _handleAgentEvent(event) {
    this.eventBuffer.push(event);

    // Extract session ID from first event
    if (!this.sessionId && event.sessionId) {
      this.sessionId = event.sessionId;
    }

    // Emit events to listeners
    this.emit('event', event);

    // Handle specific event types
    switch (event.type) {
      case 'step_start':
        this.emit('step_start', event);
        logger.debug({ stepId: event.stepId }, 'Agent step started');
        break;

      case 'text':
        // Accumulate text output
        if (event.part && event.part.text) {
          this.outputBuffer.push(event.part.text);
          this.emit('text', event.part.text);
        }
        break;

      case 'tool_use':
        // Tool execution
        this.emit('tool_use', {
          toolId: event.part.id,
          toolName: event.part.name,
          toolInput: event.part.input
        });
        logger.info({
          tool: event.part.name,
          toolId: event.part.id
        }, 'Agent using tool');
        break;

      case 'step_finish':
        this.emit('step_finish', event);
        logger.debug({ stepId: event.stepId }, 'Agent step finished');
        break;

      case 'error':
        this.emit('error_event', event);
        logger.error({ error: event.error }, 'Agent error event');
        break;

      default:
        logger.debug({ type: event.type }, 'Unknown agent event type');
    }
  }

  /**
   * Stop agent execution
   */
  stop() {
    if (this.process && this.isRunning) {
      logger.info({ sessionId: this.sessionId }, 'Stopping agent process');
      this.process.kill('SIGTERM');
      this.isRunning = false;
      this.process = null;
    }
  }

  /**
   * Get agent execution status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      sessionId: this.sessionId,
      workspaceId: this.workspaceId,
      model: this.model,
      eventCount: this.eventBuffer.length,
      outputLength: this.outputBuffer.join('').length
    };
  }
}

/**
 * Agent Manager - Singleton for managing multiple agent instances
 */
export class DeepAssistantAgentManager {
  constructor() {
    this.agents = new Map(); // sessionId -> agent instance
    this.workspaceAgents = new Map(); // workspaceId -> Set<sessionId>
  }

  /**
   * Create a new agent instance
   */
  createAgent(options) {
    const agent = new DeepAssistantAgent(options);
    const sessionId = `agent_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    agent.on('event', () => {
      // Track last activity
      agent.lastActivity = Date.now();
    });

    this.agents.set(sessionId, agent);

    // Track by workspace
    if (options.workspaceId) {
      if (!this.workspaceAgents.has(options.workspaceId)) {
        this.workspaceAgents.set(options.workspaceId, new Set());
      }
      this.workspaceAgents.get(options.workspaceId).add(sessionId);
    }

    logger.info({ sessionId, workspaceId: options.workspaceId }, 'Created new agent instance');
    return { agent, sessionId };
  }

  /**
   * Get agent by session ID
   */
  getAgent(sessionId) {
    return this.agents.get(sessionId);
  }

  /**
   * Get all agents for a workspace
   */
  getWorkspaceAgents(workspaceId) {
    const sessionIds = this.workspaceAgents.get(workspaceId) || new Set();
    return Array.from(sessionIds)
      .map(id => ({ sessionId: id, agent: this.agents.get(id) }))
      .filter(item => item.agent);
  }

  /**
   * Stop agent by session ID
   */
  stopAgent(sessionId) {
    const agent = this.agents.get(sessionId);
    if (agent) {
      agent.stop();
      this.agents.delete(sessionId);

      // Clean up workspace tracking
      for (const [workspaceId, sessionIds] of this.workspaceAgents.entries()) {
        sessionIds.delete(sessionId);
        if (sessionIds.size === 0) {
          this.workspaceAgents.delete(workspaceId);
        }
      }

      logger.info({ sessionId }, 'Stopped and removed agent');
      return true;
    }
    return false;
  }

  /**
   * Clean up inactive agents (older than 1 hour)
   */
  cleanupInactiveAgents() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let cleaned = 0;

    for (const [sessionId, agent] of this.agents.entries()) {
      if (!agent.isRunning && agent.lastActivity && agent.lastActivity < oneHourAgo) {
        this.stopAgent(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info({ cleaned }, 'Cleaned up inactive agents');
    }

    return cleaned;
  }

  /**
   * Get all agent statuses
   */
  getAllStatuses() {
    const statuses = [];
    for (const [sessionId, agent] of this.agents.entries()) {
      statuses.push({
        sessionId,
        ...agent.getStatus()
      });
    }
    return statuses;
  }
}

// Export singleton instance
export const agentManager = new DeepAssistantAgentManager();

// Cleanup inactive agents every 30 minutes
setInterval(() => {
  agentManager.cleanupInactiveAgents();
}, 30 * 60 * 1000);
