/**
 * Workspace Chat API - Claude with Tool Calling
 * Issue #3600: Implement workspace tool call support
 * Issue #4873: AI usage statistics logging to Integram
 *
 * This API extends claude-chat.js with workspace tool execution capabilities.
 * It enables Claude to use tools like file operations, command execution, etc.
 * within isolated workspaces.
 *
 * Architecture:
 * Chat.vue → /api/workspace-chat → Claude API with tools → WorkspaceService
 */

import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import logger from '../../utils/logger.js';
import aiProviderKeysService from '../../services/ai-provider-keys/AIProviderKeysService.js';
import workspaceService from '../../services/WorkspaceService.js';
import { WORKSPACE_TOOLS, executeWorkspaceTool } from '../../services/workspace-tools/index.js';
import tokenConsumptionLogger from '../../services/ai/tokenConsumptionLogger.js';

/**
 * Get Anthropic API key
 */
async function getAnthropicApiKey() {
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      return process.env.ANTHROPIC_API_KEY;
    }

    const apiKey = await aiProviderKeysService.getProviderKey('anthropic');
    if (!apiKey) {
      logger.warn('Anthropic API key not found');
      return null;
    }

    return apiKey;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to retrieve Anthropic API key');
    return null;
  }
}

/**
 * Create Workspace Chat routes
 */
export function createWorkspaceChatRoutes() {
  const router = express.Router();

  const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
  const MAX_TOOL_ITERATIONS = 10; // Prevent infinite loops

  /**
   * POST /api/workspace-chat/workspaces
   * Create a new workspace
   */
  router.post('/workspaces', async (req, res) => {
    try {
      const {
        userId,
        name,
        repositoryUrl,
        branch,
        toolConfig,
        githubToken, // Issue #4494: Accept GitHub token for private repo cloning
        integramServer // Issue #4584: Accept integram server for directory naming
      } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required'
        });
      }

      const workspace = await workspaceService.createWorkspace(userId, {
        name,
        repositoryUrl,
        branch,
        toolConfig,
        githubToken, // Pass GitHub token to WorkspaceService
        integramServer // Pass integram server to WorkspaceService
      });

      res.json({
        success: true,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          createdAt: workspace.createdAt,
          repositoryUrl: workspace.repositoryUrl,
          toolConfig: workspace.toolConfig
        }
      });
    } catch (error) {
      logger.error({ error: error.message, suggestedUrl: error.suggestedUrl }, 'Failed to create workspace');
      res.status(500).json({
        success: false,
        error: error.message,
        suggestedUrl: error.suggestedUrl || null
      });
    }
  });

  /**
   * GET /api/workspace-chat/workspaces/:userId
   * Get all workspaces for a user
   */
  router.get('/workspaces/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const workspaces = workspaceService.getUserWorkspaces(userId);

      // Issue #4718: Set cache-control headers to prevent 304 Not Modified responses
      // Workspaces should always return fresh data
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.json({
        success: true,
        workspaces
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get workspaces');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/workspace-chat/workspace/:workspaceId
   * Get a single workspace by ID
   * Issue #4764: Add endpoint to get workspace details for direct URL access
   */
  router.get('/workspace/:workspaceId', async (req, res) => {
    try {
      const { workspaceId } = req.params;
      const workspace = workspaceService.getWorkspace(workspaceId);

      if (!workspace) {
        return res.status(404).json({
          success: false,
          error: 'Workspace not found'
        });
      }

      // Set cache-control headers to prevent 304 Not Modified responses
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.json({
        success: true,
        workspace
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get workspace');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/workspace-chat/workspaces/:workspaceId
   * Delete a workspace
   */
  router.delete('/workspaces/:workspaceId', async (req, res) => {
    try {
      const { workspaceId } = req.params;
      await workspaceService.deleteWorkspace(workspaceId);

      res.json({
        success: true,
        message: 'Workspace deleted'
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to delete workspace');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/workspace-chat/workspaces/:workspaceId/files
   * Get file tree for workspace
   */
  router.get('/workspaces/:workspaceId/files', async (req, res) => {
    try {
      const { workspaceId } = req.params;
      const { path = '' } = req.query;

      const tree = await workspaceService.getFileTree(workspaceId, path);

      // Set cache-control headers to prevent 304 Not Modified responses
      // Issue #4411: Cloned folders should always return fresh data
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.json({
        success: true,
        tree
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get file tree');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/workspace-chat/chat
   * Chat with Claude using workspace tools
   * Supports streaming with tool execution
   */
  router.post('/chat', async (req, res) => {
    try {
      const {
        workspaceId,
        message,
        conversationHistory = [],
        model = DEFAULT_MODEL,
        temperature = 0.7,
        maxTokens = 4096,
        systemPrompt,
        enableTools = true
      } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          error: 'workspaceId is required for tool-enabled chat'
        });
      }

      // Verify workspace exists
      const workspace = workspaceService.getWorkspace(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          error: `Workspace not found: ${workspaceId}`
        });
      }

      // Get API key
      const apiKey = await getAnthropicApiKey();
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: 'Anthropic API key not configured'
        });
      }

      // Initialize Anthropic client
      const anthropic = new Anthropic({ apiKey });

      // Set response headers for streaming
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Build messages array
      const messages = [
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: 'user',
          content: message
        }
      ];

      // Enhanced system prompt for workspace context
      const workspaceSystemPrompt = `${systemPrompt || 'Ты - полезный ассистент DronDoc с доступом к инструментам для работы с файлами и кодом.'}

Ты работаешь в изолированном рабочем пространстве (workspace).
${workspace.repositoryUrl ? `Репозиторий: ${workspace.repositoryUrl}` : ''}
${workspace.repositoryInfo ? `Ветка: ${workspace.repositoryInfo.branch}, Commit: ${workspace.repositoryInfo.commitHash}` : ''}

У тебя есть доступ к следующим инструментам:
- read_file: Читать содержимое файлов
- write_file: Создавать и изменять файлы
- execute_command: Выполнять shell команды (npm, git, python, и др.)
- list_files: Просматривать файлы в директории
- search_files: Искать файлы по паттерну
- search_content: Искать текст в файлах
- git_status: Проверять статус изменений в Git

Используй эти инструменты для выполнения задач пользователя. Работай пошагово:
1. Сначала изучи структуру проекта (list_files, search_files)
2. Прочитай необходимые файлы (read_file)
3. Выполни требуемые изменения (write_file, execute_command)
4. Проверь результат (execute_command для тестов, git_status для изменений)

Будь кратким и конкретным в ответах.`;

      logger.info({
        workspaceId,
        model,
        messagesCount: messages.length,
        enableTools
      }, 'Starting workspace chat with tools');

      // Tool execution loop
      let currentMessages = [...messages];
      let toolIterations = 0;
      let allToolCalls = [];
      let totalUsage = { input_tokens: 0, output_tokens: 0 }; // Track total usage across iterations

      while (toolIterations < MAX_TOOL_ITERATIONS) {
        toolIterations++;

        // Call Claude with tools
        const response = await anthropic.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          system: workspaceSystemPrompt,
          messages: currentMessages,
          tools: enableTools ? WORKSPACE_TOOLS : []
        });

        // Accumulate usage tokens from each iteration
        if (response.usage) {
          totalUsage.input_tokens += response.usage.input_tokens || 0;
          totalUsage.output_tokens += response.usage.output_tokens || 0;
        }

        // Send the response content as a chunk
        const responseChunk = {
          type: 'response',
          content: response.content,
          stopReason: response.stop_reason,
          usage: response.usage
        };

        res.write(JSON.stringify(responseChunk) + '\n');

        // Check if Claude wants to use tools
        const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');

        if (toolUseBlocks.length === 0) {
          // No more tools to execute, we're done
          // Log total token consumption to Integram (Issue #4873)
          if (totalUsage.input_tokens > 0 || totalUsage.output_tokens > 0) {
            const userId = req.body.userId || workspace.userId || 'unknown';
            tokenConsumptionLogger.logConsumption({
              userId: userId,
              model: response.model || model,
              promptTokens: totalUsage.input_tokens,
              completionTokens: totalUsage.output_tokens
            }).catch(err => {
              logger.error('[Workspace Chat] Failed to log token consumption:', err.message);
            });
          }

          res.end();
          logger.info({ toolIterations, totalToolCalls: allToolCalls.length, totalUsage }, 'Workspace chat completed');
          return;
        }

        // Execute all tool calls
        const toolResults = [];
        for (const toolUse of toolUseBlocks) {
          logger.info({ toolName: toolUse.name, toolInput: toolUse.input }, 'Executing tool');

          try {
            const result = await executeWorkspaceTool(
              workspaceId,
              toolUse.name,
              toolUse.input
            );

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result, null, 2)
            });

            allToolCalls.push({
              toolName: toolUse.name,
              toolInput: toolUse.input,
              result
            });

            // Send tool execution update
            const toolChunk = {
              type: 'tool_execution',
              toolName: toolUse.name,
              toolInput: toolUse.input,
              result
            };

            res.write(JSON.stringify(toolChunk) + '\n');
          } catch (error) {
            logger.error({ error: error.message, toolName: toolUse.name }, 'Tool execution failed');

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify({
                success: false,
                error: error.message
              }, null, 2),
              is_error: true
            });
          }
        }

        // Add assistant's response and tool results to conversation
        currentMessages.push({
          role: 'assistant',
          content: response.content
        });

        currentMessages.push({
          role: 'user',
          content: toolResults
        });
      }

      // If we hit max iterations, send a warning
      logger.warn({ toolIterations, totalUsage }, 'Max tool iterations reached');

      // Log total token consumption even when max iterations is reached (Issue #4873)
      if (totalUsage.input_tokens > 0 || totalUsage.output_tokens > 0) {
        const userId = req.body.userId || workspace.userId || 'unknown';
        tokenConsumptionLogger.logConsumption({
          userId: userId,
          model: model,
          promptTokens: totalUsage.input_tokens,
          completionTokens: totalUsage.output_tokens
        }).catch(err => {
          logger.error('[Workspace Chat] Failed to log token consumption (max iterations):', err.message);
        });
      }

      res.write(JSON.stringify({
        type: 'warning',
        message: 'Maximum tool execution iterations reached'
      }) + '\n');

      res.end();
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Workspace chat failed');

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      } else {
        res.write(JSON.stringify({
          type: 'error',
          error: error.message
        }) + '\n');
        res.end();
      }
    }
  });

  /**
   * GET /api/workspace-chat/tools
   * Get list of available workspace tools
   */
  router.get('/tools', (req, res) => {
    res.json({
      success: true,
      tools: WORKSPACE_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: Object.keys(tool.input_schema.properties)
      }))
    });
  });

  /**
   * GET /api/workspace-chat/workspaces/:workspaceId/files/:filepath
   * Read file content from workspace
   */
  router.get('/workspaces/:workspaceId/files/:filepath(*)', async (req, res) => {
    try {
      const { workspaceId, filepath } = req.params;

      const content = await workspaceService.readFile(workspaceId, filepath);

      res.json({
        success: true,
        filepath,
        content
      });
    } catch (error) {
      logger.error({ error: error.message, workspaceId: req.params.workspaceId, filepath: req.params.filepath }, 'Failed to read file');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /api/workspace-chat/workspaces/:workspaceId/files/:filepath
   * Write/update file content in workspace
   */
  router.put('/workspaces/:workspaceId/files/:filepath(*)', async (req, res) => {
    try {
      const { workspaceId, filepath } = req.params;
      const { content } = req.body;

      if (content === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Content is required'
        });
      }

      await workspaceService.writeFile(workspaceId, filepath, content);

      res.json({
        success: true,
        message: 'File written successfully',
        filepath
      });
    } catch (error) {
      logger.error({ error: error.message, workspaceId: req.params.workspaceId, filepath: req.params.filepath }, 'Failed to write file');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/workspace-chat/workspaces/:workspaceId/files/:filepath
   * Delete file from workspace
   */
  router.delete('/workspaces/:workspaceId/files/:filepath(*)', async (req, res) => {
    try {
      const { workspaceId, filepath } = req.params;

      await workspaceService.deleteFile(workspaceId, filepath);

      res.json({
        success: true,
        message: 'File deleted successfully',
        filepath
      });
    } catch (error) {
      logger.error({ error: error.message, workspaceId: req.params.workspaceId, filepath: req.params.filepath }, 'Failed to delete file');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/workspace-chat/health
   * Health check
   */
  router.get('/health', async (req, res) => {
    try {
      const apiKey = await getAnthropicApiKey();

      res.json({
        status: 'ok',
        service: 'workspace-chat',
        apiKeyConfigured: !!apiKey,
        toolsAvailable: WORKSPACE_TOOLS.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.json({
        status: 'error',
        service: 'workspace-chat',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}

export default createWorkspaceChatRoutes;
