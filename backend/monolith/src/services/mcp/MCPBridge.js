import express from "express";
import cors from "cors";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

class Logger {
  constructor() {
    this.logFile = path.join(__dirname, "bridge-server.log");
    this.setupLogging();
  }

  setupLogging() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
    };

    const logLine = `[${timestamp}] ${level.toUpperCase()}: ${message}${
      data ? " " + JSON.stringify(data, null, 2) : ""
    }\n`;

    fs.appendFileSync(this.logFile, logLine);
    // console.log(logLine.trim());
  }

  info(message, data = null) {
    this.log("info", message, data);
  }

  error(message, data = null) {
    this.log("error", message, data);
  }

  warn(message, data = null) {
    this.log("warn", message, data);
  }

  debug(message, data = null) {
    this.log("debug", message, data);
  }
}

const logger = new Logger();

logger.info("🚀 Инициализация DeepSeek MCP Bridge сервера");

// Check if DEEPSEEK_API_KEY is configured
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === "your-deepseek-key-here") {
  logger.error("❌ DEEPSEEK_API_KEY не настроен или использует placeholder значение");
  logger.error("Получите API ключ на https://platform.deepseek.com/api_keys");
  logger.error("Добавьте DEEPSEEK_API_KEY в файл .env: DEEPSEEK_API_KEY=sk-ваш-ключ-здесь");
}

const deepseekClient = new OpenAI({
  apiKey: DEEPSEEK_API_KEY || "placeholder-for-errors",
  baseURL: "https://api.deepseek.com",
});

logger.info("✅ DeepSeek клиент инициализирован");

class MCPBridge {
  constructor() {
    this.client = null;
    this.transport = null;
    this.isConnected = false;
    logger.info("🔄 MCP Bridge создан");
  }

  async connectToMCPServer() {
    try {
      if (this.isConnected && this.client) {
        logger.info("✅ MCP соединение уже установлено");
        return true;
      }

      logger.info("🔄 Попытка подключения к MCP серверу...");
      const serverScriptPath = path.join(__dirname, "server.js");

      logger.debug("Путь к MCP серверу:", { serverScriptPath });

      if (!fs.existsSync(serverScriptPath)) {
        throw new Error(`MCP сервер не найден по пути: ${serverScriptPath}`);
      }

      this.transport = new StdioClientTransport({
        command: "node",
        args: [serverScriptPath],
      });

      this.client = new Client(
        {
          name: "dronedoc-chat-bridge",
          version: "1.0.0",
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      logger.debug("🔄 Установка обработчиков событий MCP клиента");

      this.client.onerror = (error) => {
        logger.error("❌ Ошибка MCP клиента:", { error: error.message });
        this.isConnected = false;
      };

      this.client.onclose = () => {
        logger.warn("🔌 MCP соединение закрыто");
        this.isConnected = false;
      };

      await this.client.connect(this.transport);
      logger.info("✅ Успешно подключен к MCP серверу");
      this.isConnected = true;

      await new Promise((resolve) => setTimeout(resolve, 1000));

      return true;
    } catch (error) {
      logger.error("❌ Ошибка подключения к MCP серверу:", {
        error: error.message,
        stack: error.stack,
      });
      this.isConnected = false;
      return false;
    }
  }

  async ensureConnection() {
    if (!this.isConnected || !this.client) {
      logger.info("🔌 Соединение разорвано, переподключаемся...");
      return await this.connectToMCPServer();
    }
    return true;
  }

  async getAvailableTools() {
    if (!(await this.ensureConnection())) {
      throw new Error("Не удалось подключиться к MCP серверу");
    }

    try {
      logger.debug("🔄 Запрос списка инструментов от MCP сервера");

      const response = await this.client.listTools();

      logger.info("✅ Получены инструменты от MCP сервера", {
        toolsCount: response.tools.length,
        toolNames: response.tools.map((t) => t.name),
      });

      return response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      }));
    } catch (error) {
      logger.error("❌ Ошибка получения инструментов:", {
        error: error.message,
        stack: error.stack,
      });

      this.isConnected = false;
      throw error;
    }
  }

  async callTool(toolName, args, apiBase, db, authToken) {
    if (!(await this.ensureConnection())) {
      throw new Error("Не удалось подключиться к MCP серверу");
    }

    try {
      // Inject apiBase, db, and authToken into tool arguments
      const enhancedArgs = {
        ...args,
        _apiBase: apiBase,
        _db: db,
        _authToken: authToken,
      };

      logger.info(`🛠️ Вызов инструмента: ${toolName}`, { arguments: enhancedArgs });

      const result = await this.client.callTool({
        name: toolName,
        arguments: enhancedArgs,
      });

      logger.info(`✅ Инструмент ${toolName} выполнен успешно`, {
        resultLength: result.content?.[0]?.text?.length || 0,
      });

      return result;
    } catch (error) {
      logger.error(`❌ Ошибка вызова инструмента ${toolName}:`, {
        error: error.message,
        arguments: args,
        stack: error.stack,
      });

      this.isConnected = false;
      throw error;
    }
  }
}

const mcpBridge = new MCPBridge();

logger.info("🔄 Инициализация MCP соединения...");
mcpBridge.connectToMCPServer().then((success) => {
  if (success) {
    logger.info("🚀 MCP мост готов к работе");
  } else {
    logger.error("💥 Не удалось инициализировать MCP мост");
  }
});

app.use((req, res, next) => {
  logger.info("📥 Входящий HTTP запрос", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
  next();
});

app.post("/api/chat", async (req, res) => {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { message, apiBase, db, authToken, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Сообщение обязательно",
      });
    }

    // Check if DeepSeek API key is configured
    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === "your-deepseek-key-here" || DEEPSEEK_API_KEY === "placeholder-for-errors") {
      logger.error("❌ Попытка использовать MCP без настроенного DEEPSEEK_API_KEY");
      return res.status(503).json({
        success: false,
        error: "API ключ DeepSeek не настроен. Получите ключ на https://platform.deepseek.com/api_keys и добавьте в backend .env: DEEPSEEK_API_KEY=sk-ваш-ключ-здесь",
      });
    }

    // Validate authToken (MCP должен работать только с токеном из Vue)
    if (!authToken) {
      return res.status(401).json({
        success: false,
        error: "Authorization token required. MCP must receive auth token from Vue frontend.",
      });
    }

    logger.info(`💬 Обработка чат-запроса [${requestId}]`, {
      messageLength: message.length,
      historyLength: conversationHistory.length,
      apiBase: apiBase,
      db: db,
      hasAuthToken: !!authToken,
    });

    let availableTools = [];
    try {
      availableTools = await mcpBridge.getAvailableTools();
      logger.debug(`🛠️ Доступно инструментов: ${availableTools.length}`, {
        toolNames: availableTools.map((t) => t.name),
      });
    } catch (error) {
      logger.warn("⚠️ Не удалось получить инструменты, продолжаем без них", {
        error: error.message,
      });
    }

    const deepseekTools = availableTools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    const messages = [
      {
        role: "system",
        content: `Ты полезный ассистент с доступом к инструментам Dronedoc.
Используй инструменты для получения информации о таблицах, пользователях, отчетах и недвижимости.
Всегда предоставляй полную и структурированную информацию.

Доступные базы данных: A2025
Если пользователь не указал базу данных, используй A2025 по умолчанию.

Форматируй ответы в читаемом виде:
- Используй заголовки и подзаголовки
- Для табличных данных создавай маркдаун таблицы
- Выделяй важную информацию
- Используй списки для перечисления`,
      },
      ...conversationHistory,
      { role: "user", content: message },
    ];

    logger.debug(`🤖 Отправка запроса к DeepSeek API [${requestId}]`, {
      messagesCount: messages.length,
      toolsCount: deepseekTools.length,
    });

    // Use non-streaming mode for proper tool call handling
    const completion = await deepseekClient.chat.completions.create({
      model: "deepseek-chat",
      messages: messages,
      tools: deepseekTools.length > 0 ? deepseekTools : undefined,
      tool_choice: deepseekTools.length > 0 ? "auto" : "none",
      temperature: 0.7,
      max_tokens: 4000,
      stream: false, // Changed to false for proper tool handling
    });

    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    let currentMessages = [...messages];
    let toolCallsCount = 0;
    const MAX_TOOL_ITERATIONS = 5; // Prevent infinite loops

    // Handle tool calls in a loop
    while (toolCallsCount < MAX_TOOL_ITERATIONS) {
      const choice = completion.choices[0];

      // Check if there are tool calls
      if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
        toolCallsCount++;
        logger.info(`🔧 Итерация ${toolCallsCount}: Обнаружены вызовы инструментов [${requestId}]`, {
          toolCallsLength: choice.message.tool_calls.length
        });

        // Add assistant message with tool calls to conversation
        currentMessages.push(choice.message);

        // Execute each tool call
        const toolResults = [];
        for (const toolCall of choice.message.tool_calls) {
          try {
            logger.info(`🛠️ Выполнение инструмента: ${toolCall.function.name}`, {
              arguments: toolCall.function.arguments
            });

            const toolArgs = JSON.parse(toolCall.function.arguments);
            const result = await mcpBridge.callTool(
              toolCall.function.name,
              toolArgs,
              apiBase,
              db,
              authToken
            );

            const toolResultContent = result.content?.[0]?.text || JSON.stringify(result);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: "tool",
              name: toolCall.function.name,
              content: toolResultContent,
            });

            logger.info(`✅ Инструмент ${toolCall.function.name} выполнен`, {
              resultLength: toolResultContent.length
            });
          } catch (error) {
            logger.error(`❌ Ошибка выполнения инструмента ${toolCall.function.name}:`, {
              error: error.message
            });

            toolResults.push({
              tool_call_id: toolCall.id,
              role: "tool",
              name: toolCall.function.name,
              content: `Error: ${error.message}`,
            });
          }
        }

        // Add tool results to conversation
        currentMessages.push(...toolResults);

        // Get next completion with tool results
        const nextCompletion = await deepseekClient.chat.completions.create({
          model: "deepseek-chat",
          messages: currentMessages,
          tools: deepseekTools.length > 0 ? deepseekTools : undefined,
          tool_choice: deepseekTools.length > 0 ? "auto" : "none",
          temperature: 0.7,
          max_tokens: 4000,
          stream: false,
        });

        completion.choices[0] = nextCompletion.choices[0];
      } else {
        // No more tool calls, send final response
        break;
      }
    }

    // Stream the final response
    const finalContent = completion.choices[0].message.content || "";
    logger.info(`📤 Отправка финального ответа [${requestId}]`, {
      contentLength: finalContent.length,
      toolCallsCount: toolCallsCount
    });

    // Simulate streaming for consistent user experience
    const words = finalContent.split(' ');
    for (const word of words) {
      res.write(word + ' ');
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    res.end();

    const processingTime = Date.now() - startTime;
    logger.info(`✅ Чат-запрос завершен [${requestId}]`, {
      processingTime: `${processingTime}ms`,
      responseLength: fullResponse.length,
      hadToolCalls: hasToolCalls,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error(`💥 Ошибка обработки чат-запроса [${requestId}]`, {
      error: error.message,
      stack: error.stack,
      processingTime: `${processingTime}ms`,
    });

    // Provide better error messages for common issues
    let errorMessage = "Внутренняя ошибка сервера";
    let statusCode = 500;

    if (error.status === 401 || error.message.includes("401")) {
      errorMessage = "Ошибка 401: Неверный API ключ DeepSeek. Проверьте DEEPSEEK_API_KEY в файле backend/.env";
      statusCode = 401;
    } else if (error.status === 405 || error.message.includes("405")) {
      errorMessage = "Ошибка 405: API ключ DeepSeek не настроен или неверный. Получите ключ на https://platform.deepseek.com/api_keys и добавьте в backend/.env: DEEPSEEK_API_KEY=sk-ваш-ключ-здесь";
      statusCode = 405;
    } else if (error.message.includes("ECONNREFUSED") || error.message.includes("ENOTFOUND")) {
      errorMessage = "Не удается подключиться к DeepSeek API. Проверьте интернет-соединение.";
      statusCode = 503;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      messageId: requestId,
      processingTime: processingTime,
    });
  }
});

app.get("/api/tools", async (req, res) => {
  const requestId = `tools_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    logger.info(`🛠️ Запрос списка инструментов [${requestId}]`);

    const tools = await mcpBridge.getAvailableTools();

    logger.info(`✅ Список инструментов отправлен [${requestId}]`, {
      toolsCount: tools.length,
    });

    res.json({ success: true, tools });
  } catch (error) {
    logger.error(`❌ Ошибка получения инструментов [${requestId}]`, {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: error.message,
      tools: [],
    });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    const tools = await mcpBridge.getAvailableTools();

    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      mcpConnected: mcpBridge.isConnected,
      toolsAvailable: tools.length,
      uptime: process.uptime(),
    };

    logger.debug("🏥 Health check выполнен", health);
    res.json(health);
  } catch (error) {
    const health = {
      status: "error",
      timestamp: new Date().toISOString(),
      mcpConnected: false,
      error: error.message,
      uptime: process.uptime(),
    };

    logger.warn("⚠️ Health check с ошибкой", health);
    res.status(500).json(health);
  }
});

app.on("error", (error) => {
  logger.error("💥 Серверная ошибка:", { error: error.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`🎯 Backend сервер запущен на порту ${PORT}`);
  logger.info(`🔗 API доступен по http://localhost:${PORT}/api`);
  logger.info(`📊 Логи записываются в: ${logger.logFile}`);
});

process.on("SIGINT", () => {
  logger.info("🔄 Получен SIGINT, завершение работы...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("🔄 Получен SIGTERM, завершение работы...");
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  logger.error("💥 Неперехваченное исключение:", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("💥 Необработанный промис:", {
    reason: reason?.message || reason,
    promise,
  });
  process.exit(1);
});
