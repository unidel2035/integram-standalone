/**
 * Agent Polza2 Service
 *
 * Provides integration with agent_polza2 - a Bun-based AI CLI agent
 * from https://github.com/judas-priest/hives/tree/main/agent_polza2
 *
 * This service spawns agent_polza2 as a subprocess and streams its JSON output.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to agent_polza2
const AGENT_POLZA2_PATH = path.join(__dirname, '../../vendor/hives/agent_polza2');
const AGENT_POLZA2_CONFIG = path.join(AGENT_POLZA2_PATH, 'polza-config-example.json');

// Default bun path (installed via bun.sh)
const DEFAULT_BUN_PATH = '/home/hive/.bun/bin/bun';

/**
 * Execute a command using agent_polza2
 *
 * @param {string} message - User message/command
 * @param {object} options - Execution options
 * @param {string} options.workspaceId - Workspace ID
 * @param {string} options.workspacePath - Path to workspace directory
 * @param {string} options.model - AI model to use (default: opencode/grok-code)
 * @param {array} options.tools - List of tools to enable
 * @param {function} options.onEvent - Callback for streaming events
 * @returns {Promise<object>} - Execution result
 */
export async function executeWithPolza(message, options = {}) {
  const {
    workspaceId,
    workspacePath,
    model = 'opencode/grok-code',
    tools = ['read', 'write', 'list', 'bash', 'grep', 'glob'],
    onEvent = () => {}
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // Build JSON input for agent_polza2
      const input = JSON.stringify({
        message,
        tools: tools.map(tool => ({ name: tool }))
      });

      logger.info({
        workspaceId,
        workspacePath,
        model,
        tools,
        messageLength: message.length
      }, 'Executing agent_polza2');

      // Check if bun is available (use default path if not in env)
      const bunCommand = process.env.BUN_PATH || DEFAULT_BUN_PATH;

      // Spawn agent_polza2 process
      const agent = spawn(bunCommand, [
        'run',
        path.join(AGENT_POLZA2_PATH, 'src/index.js'),
        '--format', 'json',
        '--model', model
      ], {
        cwd: workspacePath || AGENT_POLZA2_PATH,
        env: {
          ...process.env,
          OPENCODE_CONFIG: AGENT_POLZA2_CONFIG,
          POLZA_API_KEY: process.env.POLZA_API_KEY || '',
          NODE_ENV: process.env.NODE_ENV
        }
      });

      // Send input to agent
      agent.stdin.write(input);
      agent.stdin.end();

      let outputBuffer = '';
      let errorBuffer = '';
      const events = [];

      // Handle stdout (JSON events)
      agent.stdout.on('data', (data) => {
        const chunk = data.toString();
        outputBuffer += chunk;

        // Try to parse JSON events
        const lines = outputBuffer.split('\n');
        outputBuffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event = JSON.parse(line);
            events.push(event);

            // Stream event to callback
            onEvent(event);

            logger.debug({
              workspaceId,
              eventType: event.type || 'unknown',
              event
            }, 'agent_polza2 event');

          } catch (parseError) {
            // Not valid JSON, might be plain text output
            logger.warn({
              workspaceId,
              line,
              error: parseError.message
            }, 'Failed to parse agent_polza2 output as JSON');

            // Treat as text event
            const textEvent = {
              type: 'text',
              text: line
            };
            events.push(textEvent);
            onEvent(textEvent);
          }
        }
      });

      // Handle stderr
      agent.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorBuffer += chunk;

        logger.warn({
          workspaceId,
          stderr: chunk
        }, 'agent_polza2 stderr output');

        // Stream error as event
        onEvent({
          type: 'error',
          error: chunk
        });
      });

      // Handle process exit
      agent.on('close', (code) => {
        logger.info({
          workspaceId,
          exitCode: code,
          eventCount: events.length,
          hasError: !!errorBuffer
        }, 'agent_polza2 process closed');

        if (code !== 0) {
          reject(new Error(`agent_polza2 exited with code ${code}: ${errorBuffer}`));
        } else {
          resolve({
            success: true,
            events,
            output: events.filter(e => e.type === 'text').map(e => e.text).join('\n'),
            exitCode: code
          });
        }
      });

      // Handle process error
      agent.on('error', (error) => {
        logger.error({
          workspaceId,
          error: error.message
        }, 'agent_polza2 process error');

        reject(new Error(`Failed to spawn agent_polza2: ${error.message}`));
      });

    } catch (error) {
      logger.error({
        workspaceId,
        error: error.message
      }, 'agent_polza2 execution error');

      reject(error);
    }
  });
}

/**
 * Check if agent_polza2 and bun are available
 *
 * @returns {Promise<object>} - Availability status
 */
export async function checkAvailability() {
  return new Promise((resolve) => {
    const bunCommand = process.env.BUN_PATH || DEFAULT_BUN_PATH;

    // Check if agent_polza2 directory exists
    const agentPathExists = fs.existsSync(AGENT_POLZA2_PATH);
    const agentIndexExists = fs.existsSync(path.join(AGENT_POLZA2_PATH, 'src/index.js'));
    const configExists = fs.existsSync(AGENT_POLZA2_CONFIG);

    if (!agentPathExists || !agentIndexExists) {
      resolve({
        available: false,
        bun: {
          available: null,
          version: null,
          checked: false
        },
        agent: {
          pathExists: agentPathExists,
          indexExists: agentIndexExists,
          configExists: configExists,
          path: AGENT_POLZA2_PATH,
          error: 'agent_polza2 not found. Please install it to backend/monolith/vendor/hives/agent_polza2'
        },
        agentPath: AGENT_POLZA2_PATH,
        configPath: AGENT_POLZA2_CONFIG
      });
      return;
    }

    const bunCheck = spawn(bunCommand, ['--version']);

    let bunVersion = '';
    bunCheck.stdout.on('data', (data) => {
      bunVersion += data.toString();
    });

    bunCheck.on('close', (code) => {
      const bunAvailable = code === 0;

      resolve({
        available: bunAvailable && agentPathExists && agentIndexExists,
        bun: {
          available: bunAvailable,
          version: bunAvailable ? bunVersion.trim() : null,
          checked: true
        },
        agent: {
          pathExists: agentPathExists,
          indexExists: agentIndexExists,
          configExists: configExists,
          path: AGENT_POLZA2_PATH
        },
        agentPath: AGENT_POLZA2_PATH,
        configPath: AGENT_POLZA2_CONFIG
      });
    });

    bunCheck.on('error', (err) => {
      resolve({
        available: false,
        bun: {
          available: false,
          version: null,
          error: `Bun spawn failed: ${err.message}. Tried path: ${bunCommand}`,
          checked: true,
          triedPath: bunCommand,
          bunExists: fs.existsSync(bunCommand)
        },
        agent: {
          pathExists: agentPathExists,
          indexExists: agentIndexExists,
          configExists: configExists,
          path: AGENT_POLZA2_PATH
        },
        agentPath: AGENT_POLZA2_PATH,
        configPath: AGENT_POLZA2_CONFIG
      });
    });
  });
}

export default {
  executeWithPolza,
  checkAvailability
};
