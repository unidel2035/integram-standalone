// polza.js - Polza.ai API integration routes
// Refactored to use TokenBasedLLMCoordinator for unified AI provider interface
import express from 'express';
import logger from '../../utils/logger.js';
import { TokenBasedLLMCoordinator } from '../../core/TokenBasedLLMCoordinator.js';
import polzaService from '../../services/ai/polzaService.js'; // Keep for health check and models list
import { getIntegramTools } from '../../services/mcp-tools/integram-tools.js'; // MCP tools support
import axios from 'axios'; // For HTTP MCP endpoint calls
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize TokenBasedLLMCoordinator for chat operations
// Token consumption logging is handled automatically by the coordinator
const llmCoordinator = new TokenBasedLLMCoordinator({ db: null });

// Configuration for MCP tools
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:8082';
const MCP_API_PATH = '/api/mcp/integram';
const MAX_TOOL_ITERATIONS = 10; // Maximum tool execution loop iterations

export function createPolzaRoutes() {
  const router = express.Router();

  // Directory for persistent session storage
  const SESSIONS_DIR = path.join(__dirname, '../../../data/polza-sessions');

  /**
   * Helper function to call AI using TokenBasedLLMCoordinator
   * @param {string} userId - User ID for token lookup
   * @param {string} model - Model name (e.g., 'anthropic/claude-sonnet-4.5')
   * @param {Array} messages - Messages array with {role, content}
   * @param {Object} options - Additional options (temperature, maxTokens, tools, stream)
   * @returns {Promise} Coordinator response
   */
  async function callAIWithCoordinator(userId, model, messages, options = {}) {
    const {
      temperature = 0.7,
      maxTokens = 2048,
      tools = null,
      stream = false,
      onStreamChunk = null,
      systemPrompt = null
    } = options;

    // Get user's access token from coordinator
    // The coordinator will handle token lookup and validation
    const accessToken = `user_${userId}`; // Simplified token format for now

    try {
      // Use chatWithToken for both streaming and non-streaming
      // Streaming is controlled by the 'stream' and 'onStreamChunk' options
      return await llmCoordinator.chatWithToken(
        accessToken,
        model,
        messages,
        {
          temperature,
          maxTokens,
          tools,
          stream,
          onStreamChunk: stream ? onStreamChunk : null,
          systemPrompt,
          application: 'polza',
          operation: stream ? 'chat_stream' : 'chat'
        }
      );
    } catch (error) {
      logger.error('[Polza Chat] Coordinator error:', error);
      throw error;
    }
  }

  /**
   * Execute MCP tool via HTTP MCP endpoint
   * @param {string} toolName - Name of the MCP tool to execute
   * @param {object} toolInput - Tool input parameters
   * @returns {Promise<object>} Tool execution result
   */
  async function executeMCPTool(toolName, toolInput) {
    try {
      logger.info({ toolName, toolInput }, '[Polza MCP] Executing tool');

      const response = await axios.post(`${MCP_SERVER_URL}${MCP_API_PATH}/execute`, {
        toolName,
        arguments: toolInput
      }, {
        timeout: 30000 // 30 second timeout
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Tool execution failed');
      }

      logger.info({ toolName, success: true }, '[Polza MCP] Tool executed successfully');
      return response.data.result;
    } catch (error) {
      logger.error({ toolName, error: error.message }, '[Polza MCP] Tool execution failed');
      throw new Error(`Failed to execute tool ${toolName}: ${error.message}`);
    }
  }

  /**
   * Ensure sessions directory exists
   */
  async function ensureSessionsDir() {
    try {
      await fs.mkdir(SESSIONS_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create sessions directory:', error);
    }
  }

  /**
   * Load session from file
   * @param {string} sessionId - Session identifier
   * @returns {Promise<object|null>} Session data or null
   */
  async function loadSession(sessionId) {
    try {
      const sessionPath = path.join(SESSIONS_DIR, `${sessionId}.json`);
      const data = await fs.readFile(sessionPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`Failed to load session ${sessionId}:`, error);
      }
      return null;
    }
  }

  /**
   * Save session to file
   * @param {string} sessionId - Session identifier
   * @param {object} sessionData - Session data
   */
  async function saveSession(sessionId, sessionData) {
    try {
      await ensureSessionsDir();
      const sessionPath = path.join(SESSIONS_DIR, `${sessionId}.json`);
      await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2), 'utf8');
      logger.debug(`Saved session ${sessionId} to file`);
    } catch (error) {
      logger.error(`Failed to save session ${sessionId}:`, error);
    }
  }

  /**
   * Delete session file
   * @param {string} sessionId - Session identifier
   */
  async function deleteSession(sessionId) {
    try {
      const sessionPath = path.join(SESSIONS_DIR, `${sessionId}.json`);
      await fs.unlink(sessionPath);
      logger.info(`Deleted session ${sessionId} file`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`Failed to delete session ${sessionId}:`, error);
      }
    }
  }

  // Хранилище активных сессий для веб-чата (в памяти для быстрого доступа)
  // Issue #4822: Sessions are loaded on-demand (lazy loading) to speed up server startup
  const activeSessions = new Map();
  const activeAgents = new Map();

  // Initialize: Create sessions directory only, don't load sessions
  // Sessions are loaded lazily when accessed via getOrLoadSession()
  ensureSessionsDir().catch(err => {
    logger.error('Failed to create sessions directory:', err);
  });

  /**
   * Get session from memory cache or load from disk on-demand
   * @param {string} sessionId - Session identifier
   * @returns {Promise<object|null>} Session data or null
   */
  async function getOrLoadSession(sessionId) {
    // Check memory cache first
    if (activeSessions.has(sessionId)) {
      return activeSessions.get(sessionId);
    }

    // Load from disk on-demand
    const sessionData = await loadSession(sessionId);
    if (sessionData) {
      activeSessions.set(sessionId, sessionData);
      logger.debug(`Loaded session ${sessionId} on-demand from disk`);
    }
    return sessionData;
  }

  /**
   * GET /api/polza/health
   * Проверка соединения с Polza.ai
   */
  router.get('/health', async (req, res) => {
    try {
      const result = await polzaService.healthCheck();
      
      res.json({
        success: result.healthy,
        message: result.healthy ? 'Polza.ai соединение активно' : `Ошибка: ${result.error}`,
        provider: 'polza_ai',
        latency: result.latency,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Polza.ai health check failed');
      
      res.json({
        success: false,
        message: error.message,
        provider: 'polza_ai',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * GET /api/polza/models
   * Получение списка доступных моделей
   */
  router.get('/models', (req, res) => {
    try {
      const models = polzaService.getAvailableModels();
      
      res.json({
        success: true,
        models: models,
        default_model: 'anthropic/claude-sonnet-4.5'
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get Polza.ai models');
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/polza/session
   * Создание новой чат-сессии
   */
  router.post('/session', async (req, res) => {
    try {
      const { systemPrompt, model, userId } = req.body;

      // Валидация входных данных
      if (!userId || typeof userId !== 'string') {
        logger.warn('Session creation without valid userId');
        return res.status(400).json({
          success: false,
          error: 'userId is required and must be a string'
        });
      }

      // Default system prompt with MCP tools instructions
      const defaultSystemPrompt = `Ты полезный AI-помощник. Отвечай на русском языке кратко и по делу.

ВАЖНО: Когда пользователь спрашивает про таблицы, данные, или работу с базой данных Integram, используй MCP инструменты:

1. СНАЧАЛА ОБЯЗАТЕЛЬНО аутентифицируйся: integram_authenticate с параметрами:
   - serverURL: "https://dronedoc.ru"
   - database: "a2025" (или другая база если указана)
   - login: "d"
   - password: "d"

2. Затем можешь использовать другие инструменты:
   - integram_get_dictionary - получить список всех таблиц (БЕЗ параметров)
   - integram_get_type_metadata - получить структуру таблицы
   - integram_get_object_list - получить список объектов из таблицы
   - и другие...

Всегда СНАЧАЛА аутентифицируйся, иначе получишь ошибку "Не аутентифицирован".`;

      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const sessionData = {
        session_id: sessionId,
        system_prompt: systemPrompt || defaultSystemPrompt,
        model: model || 'anthropic/claude-sonnet-4.5',
        userId: userId,
        created_at: new Date().toISOString(),
        messages: [],
        last_activity: new Date().toISOString()
      };

      activeSessions.set(sessionId, sessionData);

      // Save session to file for persistence
      await saveSession(sessionId, sessionData);

      logger.info(`Created new session ${sessionId} for user ${userId}`);

      res.json({
        success: true,
        sessionId: sessionId,
        session: {
          session_id: sessionId,
          model: sessionData.model,
          created_at: sessionData.created_at,
          user_id: userId
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create Polza.ai session');
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/polza/chat
   * Отправка сообщения в чат
   */
  router.post('/chat', async (req, res) => {
    try {
      const { sessionId, message, model, temperature, maxTokens, attachments, stream, enableTools } = req.body;

      // Детальная валидация входных данных
      if (!sessionId) {
        logger.warn('Chat request without sessionId');
        return res.status(400).json({
          success: false,
          error: 'sessionId is required'
        });
      }

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        logger.warn('Chat request with invalid message:', message);
        return res.status(400).json({
          success: false,
          error: 'message is required and must be non-empty string'
        });
      }

      // Получаем сессию (lazy loading from disk if needed)
      const session = await getOrLoadSession(sessionId);
      if (!session) {
        logger.warn('Chat request for non-existent session:', sessionId);
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      logger.info(`Processing chat request for session ${sessionId}, message length: ${message.length}, stream: ${stream}`);

      // Формируем полное сообщение с вложениями
      let fullMessage = message;
      if (attachments && attachments.length > 0) {
        fullMessage += '\n\nПрикрепленные файлы:';
        attachments.forEach(attachment => {
          if (attachment.type && attachment.type.startsWith('image/')) {
            fullMessage += `\n- Изображение: ${attachment.name}`;
          } else {
            fullMessage += `\n- ${attachment.name}:\n${attachment.data || ''}`;
          }
        });
      }

      // Обновляем сообщения в сессии
      session.messages.push({
        role: 'user',
        content: fullMessage
      });

      // Определяем модель для запроса
      const requestModel = model || session.model || 'openai/gpt-4o';

      // Log model selection for debugging
      logger.info('📊 Model selection for chat request:', {
        requestedByClient: model,
        sessionDefault: session.model,
        finalModel: requestModel,
        userId: session.userId
      });

      // Настройки запроса
      const requestOptions = {
        temperature: temperature || 0.7,
        maxTokens: maxTokens || 2048,
        stream: stream === true
      };

      // If streaming is requested, set up SSE headers
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let fullContent = '';
        let totalTokens = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        // Get MCP tools if enabled
        const mcpTools = enableTools ? getIntegramTools() : null;

        if (enableTools) {
          logger.info('[Polza Chat Stream] MCP tools enabled, count:', mcpTools.length);
        }

        // Handle streaming response using TokenBasedLLMCoordinator
        try {
          const coordinatorResponse = await callAIWithCoordinator(
            session.userId || 'unknown',
            requestModel,
            session.messages,  // Don't add system here - pass as systemPrompt option
            {
              temperature: requestOptions.temperature,
              maxTokens: requestOptions.maxTokens,
              systemPrompt: session.system_prompt,  // Pass system prompt separately
              tools: mcpTools,  // Add MCP tools for streaming
              stream: true,
              onStreamChunk: (chunk) => {
                // Send chunks to client as they arrive
                if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                  fullContent += chunk.delta.text;
                  res.write(`data: ${JSON.stringify({
                    type: 'content',
                    content: chunk.delta.text,
                    model: requestModel
                  })}\n\n`);
                }
              }
            }
          );

          // Capture usage from coordinator response
          if (coordinatorResponse.usage) {
            totalTokens = {
              prompt_tokens: coordinatorResponse.usage.prompt_tokens || 0,
              completion_tokens: coordinatorResponse.usage.completion_tokens || 0,
              total_tokens: coordinatorResponse.usage.total_tokens || 0
            };
          }

          // Use fullContent from coordinator if callback didn't capture it
          if (!fullContent && coordinatorResponse.content) {
            fullContent = coordinatorResponse.content;
          }
        } catch (error) {
          logger.error('[Polza Chat Stream] Coordinator error:', error);
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          res.end();
          return;
        }

        // Add assistant message to session
        session.messages.push({
          role: 'assistant',
          content: fullContent
        });

        // Update session metadata
        session.last_response = {
          content: fullContent,
          usage: totalTokens,
          model: requestModel,
          timestamp: new Date().toISOString()
        };

        // Limit message history
        if (session.messages.length > 50) {
          session.messages = session.messages.slice(-50);
        }

        // Save session asynchronously
        saveSession(sessionId, session).catch(err => {
          logger.error('[Polza Chat Stream] Failed to save session:', err);
        });

        // Log token consumption
        logger.info('[Polza Chat Stream] Token usage data:', {
          userId: session.userId,
          totalTokens: totalTokens,
          hasUsage: !!(totalTokens.prompt_tokens || totalTokens.completion_tokens)
        });

        // Token consumption logging is now handled automatically by TokenBasedLLMCoordinator
        // Coordinator logs to Integram via tokenConsumptionLogger internally
        // We only calculate cost here for the response to frontend
        let costRub = 0;
        if (totalTokens.prompt_tokens || totalTokens.completion_tokens) {
          // Calculate cost for frontend response (Integram logging done by coordinator)
          const promptPrice = 265.52 / 1000000;  // Claude Sonnet 4.5 default
          const completionPrice = 1327.62 / 1000000;
          costRub = (totalTokens.prompt_tokens * promptPrice) + (totalTokens.completion_tokens * completionPrice);

          logger.info('[Polza Chat Stream] Usage data:', {
            userId: session.userId,
            model: requestModel,
            promptTokens: totalTokens.prompt_tokens,
            completionTokens: totalTokens.completion_tokens,
            costRub: costRub,
            note: 'Token consumption automatically logged to Integram by TokenBasedLLMCoordinator'
          });
        } else {
          logger.warn('[Polza Chat Stream] No usage data received from API');
        }

        // Send completion signal with cost (Issue #: Polza cost not saved to Integram)
        res.write(`data: ${JSON.stringify({
          type: 'done',
          usage: {
            ...totalTokens,
            cost: costRub  // Add cost to usage for frontend to save to Integram
          },
          model: requestModel
        })}\n\n`);
        res.end();

      } else {
        // Get MCP tools if enabled
        const mcpTools = enableTools ? getIntegramTools() : null;

        if (enableTools) {
          logger.info('[Polza Chat] MCP tools enabled, count:', mcpTools.length);
        }

        // Non-streaming response using coordinator
        // Coordinator handles provider routing and tool format conversion
        let response;
        let toolIterations = 0;
        let allToolCalls = [];
        let currentMessages = [...session.messages];

        // System prompt is passed as separate parameter to coordinator, not in messages

        // Tool execution loop
        while (toolIterations < MAX_TOOL_ITERATIONS) {
          toolIterations++;

          try {
            // Call AI through coordinator - it handles provider routing and tool format conversion
            const coordinatorResponse = await callAIWithCoordinator(
              session.userId || 'unknown',
              requestModel,
              currentMessages,
              {
                temperature: requestOptions.temperature,
                maxTokens: requestOptions.maxTokens,
                systemPrompt: session.system_prompt,
                tools: mcpTools, // Coordinator converts tools format for any provider
                stream: false
              }
            );

            // Check if AI wants to use tools
            const toolCalls = coordinatorResponse.toolCalls;

            if (!toolCalls || toolCalls.length === 0) {
              // No tool calls, we're done
              response = {
                success: true,
                data: {
                  choices: [
                    {
                      message: {
                        role: 'assistant',
                        content: coordinatorResponse.content
                      },
                      finish_reason: coordinatorResponse.finish_reason || 'stop'
                    }
                  ],
                  usage: coordinatorResponse.usage || {},
                  model: requestModel,
                  toolCallsExecuted: allToolCalls.length
                }
              };
              break; // Exit tool loop
            }

            // Execute tool calls
            logger.info('[Polza Chat] Executing tool calls:', toolCalls.length);
            const toolResults = [];

            for (const toolCall of toolCalls) {
              try {
                // Parse OpenAI format: toolCall.function.name and toolCall.function.arguments
                const toolName = toolCall.function?.name || toolCall.name;
                const toolInput = toolCall.function?.arguments
                  ? JSON.parse(toolCall.function.arguments)
                  : (toolCall.input || {});

                logger.info('[Polza Chat] Executing MCP tool:', toolName);

                const result = await executeMCPTool(toolName, toolInput);

                // Store for OpenAI format (role: 'tool')
                toolResults.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(result, null, 2)
                });

                allToolCalls.push({
                  toolName,
                  toolInput,
                  result
                });
              } catch (error) {
                logger.error('[Polza Chat] Tool execution failed:', toolCall.function?.name || toolCall.name, error.message);

                toolResults.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({
                    success: false,
                    error: error.message
                  }, null, 2)
                });
              }
            }

            // Add assistant's response with tool calls to messages (OpenAI format)
            currentMessages.push({
              role: 'assistant',
              content: coordinatorResponse.content || null,
              tool_calls: toolCalls
            });

            // Add tool results as separate messages with role 'tool' (OpenAI format)
            for (const toolResult of toolResults) {
              currentMessages.push(toolResult);
            }

            // Continue loop to get AI's response to tool results

          } catch (error) {
            logger.error('[Polza Chat] Coordinator error:', error);
            response = {
              success: false,
              error: error.message
            };
            break;
          }
        }

        // Check if we hit max iterations
        if (toolIterations >= MAX_TOOL_ITERATIONS) {
          logger.warn('[Polza Chat] Max tool iterations reached');
          response = {
            success: false,
            error: 'Maximum tool execution iterations reached'
          };
        }

        if (!response || !response.success) {
          return res.status(500).json({
            success: false,
            error: response?.error || 'Unknown error'
          });
        }

        // Извлекаем ответ ассистента
        const assistantMessage = response.data.choices[0].message;
        session.messages.push(assistantMessage);

        // Обновляем метаданные сессии
        session.last_response = {
          content: assistantMessage.content,
          usage: response.data.usage || {},
          model: response.data.model || requestModel,
          timestamp: new Date().toISOString()
        };

        // Ограничиваем историю сообщений (последние 50 сообщений)
        if (session.messages.length > 50) {
          session.messages = session.messages.slice(-50);
        }

        // Save session to file for persistence (async, don't block response)
        saveSession(sessionId, session).catch(err => {
          logger.error('[Polza Chat] Failed to save session to file:', err);
        });

        // Token consumption logging is now handled automatically by TokenBasedLLMCoordinator
        // Coordinator logs to Integram via tokenConsumptionLogger internally
        const usage = response.data.usage || {};
        const modelName = response.data.model || requestModel;

        // Calculate cost for frontend response (Integram logging done by coordinator)
        let costRub = 0;
        if (usage.prompt_tokens || usage.completion_tokens || usage.total_tokens) {
          const promptPrice = 265.52 / 1000000;  // Claude Sonnet 4.5 default
          const completionPrice = 1327.62 / 1000000;
          costRub = (usage.prompt_tokens * promptPrice) + (usage.completion_tokens * completionPrice);

          logger.info('[Polza Chat] Usage data:', {
            userId: session.userId,
            model: modelName,
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            costRub: costRub,
            note: 'Token consumption automatically logged to Integram by TokenBasedLLMCoordinator'
          });
        }

        res.json({
          success: true,
          response: assistantMessage.content,
          metadata: {
            model: response.data.model || requestModel,
            finish_reason: response.data.choices[0].finish_reason,
            usage: {
              ...(response.data.usage || {}),
              cost: costRub  // Add cost to usage for frontend to save to Integram
            },
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to process Polza.ai chat message');

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });


  /**
   * POST /api/polza/terminate
   * Завершение сессии
   */
  router.post('/terminate', async (req, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'sessionId is required'
        });
      }

      const session = await getOrLoadSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      activeSessions.delete(sessionId);

      // Delete session file from disk
      await deleteSession(sessionId);

      res.json({
        success: true,
        message: 'Session terminated successfully'
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to terminate Polza.ai session');

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/polza/agent
   * Создание специализированного агента
   */
  router.post('/agent', async (req, res) => {
    try {
      const { agentId, agentType, capabilities, model, systemPrompt } = req.body;

      if (!agentId) {
        return res.status(400).json({
          success: false,
          error: 'agentId is required'
        });
      }

      // Создаем сессию агента
      const agentSession = {
        agent_id: agentId,
        session_id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        agent_type: agentType || 'general',
        system_prompt: systemPrompt || `Ты ${agentType || 'универсальный'} агент Polza.ai для ДронДок.`,
        model: model || 'anthropic/claude-sonnet-4.5',
        capabilities: capabilities || ['chat'],
        created_at: new Date().toISOString(),
        status: 'active',
        messages: []
      };

      activeAgents.set(agentId, agentSession);

      res.json({
        success: true,
        agentId: agentId,
        agent: agentSession
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create Polza.ai agent');
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/polza/agent-task
   * Отправка задачи агенту
   */
  router.post('/agent-task', async (req, res) => {
    try {
      const { agentId, task, context } = req.body;

      if (!agentId || !task) {
        return res.status(400).json({
          success: false,
          error: 'agentId and task are required'
        });
      }

      const agent = activeAgents.get(agentId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found'
        });
      }

      // Обрабатываем задачу через агента (упрощенная реализация)
      const result = {
        success: true,
        agentId: agentId,
        task: task,
        result: `Задача "${task}" обработана агентом ${agent.agent_type}`,
        timestamp: new Date().toISOString()
      };

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to process agent task');
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/polza/agent-status/:agentId
   * Получение статуса агента
   */
  router.get('/agent-status/:agentId', (req, res) => {
    try {
      const { agentId } = req.params;

      const agent = activeAgents.get(agentId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found'
        });
      }

      const status = {
        agent_id: agent.agent_id,
        status: agent.status,
        created_at: agent.created_at,
        message_count: agent.messages.length,
        model: agent.model
      };

      res.json({
        success: true,
        agentId: agentId,
        status: status
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get agent status');
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/polza/agent-terminate
   * Завершение работы агента
   */
  router.post('/agent-terminate', (req, res) => {
    try {
      const { agentId } = req.body;

      if (!agentId) {
        return res.status(400).json({
          success: false,
          error: 'agentId is required'
        });
      }

      const agent = activeAgents.get(agentId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found'
        });
      }

      const result = {
        success: true,
        agentId: agentId,
        message: 'Агент успешно завершен',
        timestamp: new Date().toISOString()
      };
      activeAgents.delete(agentId);

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to terminate agent');
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/polza/provider-info
   * Информация о провайдере
   */
  router.get('/provider-info', (req, res) => {
    try {
      const providerInfo = modelAdapter.get_provider_info();

      res.json({
        success: true,
        provider: providerInfo
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get provider info');
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/polza/sessions
   * Список активных сессий
   */
  router.get('/sessions', (req, res) => {
    try {
      const sessions = Array.from(activeSessions.values()).map(session => ({
        session_id: session.session_id,
        model: session.model,
        created_at: session.created_at,
        message_count: session.messages.length,
        user_id: session.user_id
      }));

      res.json({
        success: true,
        sessions: sessions
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get sessions list');
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/polza/agents
   * Список активных агентов
   */
  router.get('/agents', (req, res) => {
    try {
      const agents = Array.from(activeAgents.values()).map(agent => ({
        agent_id: agent.agent_id,
        agent_type: agent.agent_type,
        model: agent.model,
        capabilities: agent.capabilities,
        created_at: agent.created_at,
        status: agent.status
      }));

      res.json({
        success: true,
        agents: agents
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get agents list');
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}