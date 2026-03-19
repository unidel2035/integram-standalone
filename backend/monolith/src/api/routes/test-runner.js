// test-runner.js - API routes for test execution and management
import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root: Find it by looking for package.json
// This file is in backend/monolith/src/api/routes/test-runner.js
// Project root is 5 levels up: routes -> api -> src -> monolith -> backend -> project
const PROJECT_ROOT = path.resolve(__dirname, '../../../../..');

// Logs directory for test execution logs
const LOGS_DIR = path.resolve(__dirname, '../../logs/test-runner');

/**
 * Ensure logs directory exists
 */
async function ensureLogsDirectory() {
  try {
    await fs.access(LOGS_DIR);
  } catch {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    logger.info(`Created test logs directory: ${LOGS_DIR}`);
  }
}

/**
 * Create test runner routes
 */
export function createTestRunnerRoutes() {
  const router = express.Router();

  // Ensure logs directory exists on startup
  ensureLogsDirectory().catch(err => {
    logger.error('Failed to create logs directory:', err);
  });

  /**
   * GET /api/test-runner/health
   * Health check endpoint for test-runner service
   */
  router.get('/health', (req, res) => {
    logger.info(`Test Runner health check - PROJECT_ROOT: ${PROJECT_ROOT}`);
    res.json({
      success: true,
      status: 'healthy',
      service: 'test-runner',
      timestamp: new Date().toISOString(),
      logsDirectory: LOGS_DIR,
      projectRoot: PROJECT_ROOT,
      __dirname: __dirname
    });
  });

  /**
   * GET /api/test-runner/tests
   * Get all available tests organized by category
   */
  router.get('/tests', async (req, res) => {
    try {
      const testCategories = [
        {
          id: 'unit',
          name: 'Unit тесты',
          icon: '🧩',
          description: 'Тесты отдельных функций и модулей',
          tests: [
            {
              id: 'unit-all',
              name: 'Все unit тесты',
              command: 'npm run test:unit',
              description: 'Запуск всех unit тестов с использованием Vitest'
            },
            {
              id: 'unit-services',
              name: 'Тесты сервисов',
              command: 'npm run test:unit -- src/__tests__/services',
              description: 'Тесты сервисов приложения'
            },
            {
              id: 'unit-components',
              name: 'Тесты компонентов',
              command: 'npm run test:unit -- src/components/__tests__',
              description: 'Тесты Vue компонентов'
            },
            {
              id: 'unit-api',
              name: 'Тесты API клиентов',
              command: 'npm run test:unit -- src/__tests__/service',
              description: 'Тесты API клиентов (Telegram, ORD, TGStat)'
            }
          ]
        },
        {
          id: 'integration',
          name: 'Integration тесты',
          icon: '🔗',
          description: 'Тесты взаимодействия компонентов',
          tests: [
            {
              id: 'integration-all',
              name: 'Все интеграционные тесты',
              command: 'npm run test:integration',
              description: 'Запуск всех интеграционных тестов'
            },
            {
              id: 'integration-router',
              name: 'Тесты маршрутизации',
              command: 'npm run test:unit -- src/__tests__/integration/router.spec.js',
              description: 'Тесты Vue Router'
            },
            {
              id: 'integration-agents',
              name: 'Тесты агентов',
              command: 'npm run test:integration -- tests/integration/agents',
              description: 'Тесты жизненного цикла агентов'
            }
          ]
        },
        {
          id: 'e2e',
          name: 'E2E тесты (Playwright)',
          icon: '🎭',
          description: 'End-to-end тесты с реальным браузером',
          tests: [
            {
              id: 'e2e-all',
              name: 'Все E2E тесты',
              command: 'npm run test:e2e',
              description: 'Запуск всех E2E тестов во всех браузерах'
            },
            {
              id: 'e2e-chrome',
              name: 'E2E на Chromium',
              command: 'npm run test:e2e:chrome',
              description: 'E2E тесты только в Chromium'
            },
            {
              id: 'e2e-firefox',
              name: 'E2E на Firefox',
              command: 'npm run test:e2e:firefox',
              description: 'E2E тесты только в Firefox'
            },
            {
              id: 'e2e-webkit',
              name: 'E2E на WebKit',
              command: 'npm run test:e2e:webkit',
              description: 'E2E тесты только в WebKit (Safari)'
            },
            {
              id: 'e2e-agents',
              name: 'E2E тесты агентов',
              command: 'npm run test:e2e:agents',
              description: 'E2E тесты агентов и workflow constructor'
            },
            {
              id: 'e2e-agriculture',
              name: 'E2E сельскохозяйственных модулей',
              command: 'npm run test:e2e -- e2e/agriculture',
              description: 'E2E тесты модулей сельского хозяйства'
            },
            {
              id: 'e2e-spaces',
              name: 'E2E Spaces',
              command: 'npm run test:e2e -- e2e/spaces.spec.js',
              description: 'E2E тесты страницы Spaces'
            },
            {
              id: 'e2e-video',
              name: 'E2E видеоконференций',
              command: 'npm run test:e2e -- tests/e2e/video-conference.spec.js',
              description: 'E2E тесты видеоконференций'
            }
          ]
        },
        {
          id: 'backend',
          name: 'Backend тесты',
          icon: '⚙️',
          description: 'Тесты серверной части',
          tests: [
            {
              id: 'backend-monolith',
              name: 'Тесты монолита',
              command: 'cd backend/monolith && npm test',
              description: 'Запуск всех тестов backend/monolith'
            },
            {
              id: 'backend-agents',
              name: 'Тесты агентов (backend)',
              command: 'cd backend/monolith && npm test -- src/agents/__tests__',
              description: 'Тесты агентов в монолите'
            },
            {
              id: 'backend-core',
              name: 'Тесты LLM Coordinator',
              command: 'cd backend/monolith && npm test -- src/core/__tests__',
              description: 'Тесты LLM координатора'
            }
          ]
        },
        {
          id: 'coverage',
          name: 'Coverage (покрытие кода)',
          icon: '📊',
          description: 'Анализ покрытия кода тестами',
          tests: [
            {
              id: 'coverage-all',
              name: 'Анализ покрытия frontend',
              command: 'npm run test:coverage',
              description: 'Генерация отчета о покрытии кода тестами'
            },
            {
              id: 'coverage-backend',
              name: 'Анализ покрытия backend',
              command: 'cd backend/monolith && npm run test:coverage',
              description: 'Генерация отчета о покрытии backend'
            }
          ]
        },
        {
          id: 'specialized',
          name: 'Специализированные тесты',
          icon: '🎯',
          description: 'Специальные тесты и проверки',
          tests: [
            {
              id: 'verify-imports',
              name: 'Проверка импортов',
              command: 'npm run verify-imports',
              description: 'Проверка корректности всех импортов в проекте'
            },
            {
              id: 'lint',
              name: 'ESLint проверка',
              command: 'npm run lint',
              description: 'Проверка кода на соответствие стандартам'
            }
          ]
        },
        {
          id: 'connectivity',
          name: 'Тесты подключения компонентов',
          icon: '🔌',
          description: 'Автоматические тесты подключения всех компонентов к сети',
          tests: [
            {
              id: 'component-connectivity',
              name: 'Тест подключения компонентов',
              command: 'npm run test:e2e -- e2e/component-connectivity.spec.js',
              description: 'Автоматический тест всех API endpoints, WebSocket соединений и backend сервисов'
            },
            {
              id: 'agent-interactions',
              name: 'Автоматический тест взаимодействия с агентами',
              command: 'npm run test:e2e -- e2e/agent-interaction-test.spec.js',
              description: 'Автоматически открывает все страницы агентов и нажимает кнопки для обнаружения ошибок подключения'
            },
            {
              id: 'auto-create-issues',
              name: 'Создание Issues для обнаруженных ошибок',
              command: 'node scripts/auto-create-test-issues.js --dry-run',
              description: 'Автоматическое создание GitHub Issues для ошибок, обнаруженных в тестах подключения (dry-run mode)'
            }
          ]
        }
      ];

      res.json({
        success: true,
        data: testCategories
      });
    } catch (error) {
      logger.error('Error getting tests:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/test-runner/execute
   * Execute a test command
   */
  router.post('/execute', async (req, res) => {
    const { testId, command } = req.body;

    if (!command) {
      return res.status(400).json({
        success: false,
        error: 'Command is required'
      });
    }

    const startTime = Date.now();
    let output = '';
    let errorOutput = '';

    try {
      logger.info(`Executing test: ${testId} - ${command}`);

      // Parse command to handle 'cd' commands
      let workingDir = PROJECT_ROOT;
      let actualCommand = command;

      if (command.startsWith('cd ')) {
        const parts = command.split('&&').map(p => p.trim());
        if (parts.length > 1) {
          const cdPart = parts[0].replace('cd ', '').trim();
          workingDir = path.resolve(PROJECT_ROOT, cdPart);
          actualCommand = parts.slice(1).join(' && ');
        }
      }

      logger.info(`Working directory: ${workingDir}`);
      logger.info(`Actual command: ${actualCommand}`);
      logger.info(`PROJECT_ROOT: ${PROJECT_ROOT}`);

      // Execute command
      const result = await executeCommand(actualCommand, workingDir);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Save to log file
      try {
        await saveTestLog({
          testId,
          command,
          exitCode: result.exitCode,
          output: result.output,
          errorOutput: result.errorOutput,
          duration,
          timestamp: new Date(startTime).toISOString(),
          status: result.exitCode === 0 ? 'passed' : 'failed'
        });
      } catch (fileError) {
        logger.error('Error saving test log to file:', fileError);
        // Continue even if file save fails
      }

      res.json({
        success: true,
        data: {
          exitCode: result.exitCode,
          output: result.output,
          errorOutput: result.errorOutput,
          duration,
          status: result.exitCode === 0 ? 'passed' : 'failed',
          timestamp: new Date(startTime).toISOString()
        }
      });
    } catch (error) {
      logger.error('Error executing test:', error);

      const endTime = Date.now();
      const duration = endTime - startTime;

      res.status(500).json({
        success: false,
        error: error.message,
        data: {
          exitCode: 1,
          output: '',
          errorOutput: error.message,
          duration,
          status: 'error',
          timestamp: new Date(startTime).toISOString()
        }
      });
    }
  });

  /**
   * GET /api/test-runner/logs
   * Get test execution logs
   */
  router.get('/logs', async (req, res) => {
    try {
      const { testId, limit = 50, offset = 0 } = req.query;

      await ensureLogsDirectory();

      // Read all log files
      const files = await fs.readdir(LOGS_DIR);
      const logFiles = files.filter(f => f.endsWith('.json'));

      // Read and parse all logs
      const allLogs = [];
      for (const file of logFiles) {
        try {
          const content = await fs.readFile(path.join(LOGS_DIR, file), 'utf-8');
          const log = JSON.parse(content);
          allLogs.push(log);
        } catch (err) {
          logger.warn(`Failed to read log file ${file}:`, err);
        }
      }

      // Filter by testId if provided
      let filteredLogs = testId
        ? allLogs.filter(log => log.testId === testId)
        : allLogs;

      // Sort by timestamp descending
      filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Apply pagination
      const paginatedLogs = filteredLogs.slice(
        parseInt(offset),
        parseInt(offset) + parseInt(limit)
      );

      res.json({
        success: true,
        data: paginatedLogs,
        total: filteredLogs.length
      });
    } catch (error) {
      logger.error('Error getting test logs:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/test-runner/create-issue
   * Create GitHub issue for failed test (proxy to avoid CORS)
   */
  router.post('/create-issue', async (req, res) => {
    const { testId, testName, testCommand, testFile, testOutput, testDuration, githubToken, githubRepo, labels } = req.body;

    if (!githubToken || !githubRepo) {
      return res.status(400).json({
        success: false,
        error: 'GitHub token and repository are required'
      });
    }

    try {
      const [owner, repo] = githubRepo.split('/');
      if (!owner || !repo) {
        return res.status(400).json({
          success: false,
          error: 'Invalid GitHub repo format. Expected: owner/repo'
        });
      }

      // Prepare issue body
      const issueBody = `## Автоматически созданная issue для упавшего теста

### Информация о тесте

- **ID теста**: \`${testId}\`
- **Название**: ${testName}
- **Команда**: \`${testCommand}\`
- **Файл**: ${testFile || 'N/A'}
- **Длительность**: ${testDuration ? `${testDuration}ms` : 'N/A'}
- **Время**: ${new Date().toLocaleString('ru-RU')}

### Вывод теста

\`\`\`
${(testOutput || 'Нет вывода').slice(0, 10000)}
\`\`\`

### Действия

1. Проверьте код теста: \`${testFile}\`
2. Запустите тест локально: \`${testCommand}\`
3. Исправьте ошибку
4. Убедитесь, что тест проходит
5. Закройте эту issue

---
*Создано автоматически Test Runner на ${new Date().toLocaleString('ru-RU')}*
`;

      // Create issue via GitHub API
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          title: `🔴 Test Failed: ${testName}`,
          body: issueBody,
          labels: labels || ['bug', 'test-failure']
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('GitHub API error:', errorData);
        return res.status(response.status).json({
          success: false,
          error: errorData.message || 'Failed to create GitHub issue'
        });
      }

      const issue = await response.json();
      logger.info(`Created GitHub issue #${issue.number}: ${issue.html_url}`);

      res.json({
        success: true,
        data: {
          number: issue.number,
          html_url: issue.html_url,
          title: issue.title
        }
      });
    } catch (error) {
      logger.error('Error creating GitHub issue:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/test-runner/logs/:testId/latest
   * Get latest log for a specific test
   */
  router.get('/logs/:testId/latest', async (req, res) => {
    try {
      const { testId } = req.params;

      await ensureLogsDirectory();

      // Read all log files
      const files = await fs.readdir(LOGS_DIR);
      const logFiles = files.filter(f => f.endsWith('.json'));

      // Read and parse all logs for this testId
      const testLogs = [];
      for (const file of logFiles) {
        try {
          const content = await fs.readFile(path.join(LOGS_DIR, file), 'utf-8');
          const log = JSON.parse(content);
          if (log.testId === testId) {
            testLogs.push(log);
          }
        } catch (err) {
          logger.warn(`Failed to read log file ${file}:`, err);
        }
      }

      if (testLogs.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No logs found for this test'
        });
      }

      // Sort by timestamp descending and get the latest
      testLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const latestLog = testLogs[0];

      res.json({
        success: true,
        data: latestLog
      });
    } catch (error) {
      logger.error('Error getting latest test log:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

/**
 * Execute a shell command and return the result
 */
function executeCommand(command, workingDir) {
  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';

    // Parse command for shell execution
    const [cmd, ...args] = command.split(' ');

    const child = spawn(cmd, args, {
      cwd: workingDir,
      shell: true,
      env: { ...process.env }
    });

    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      logger.debug(`Test stdout: ${text}`);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      logger.debug(`Test stderr: ${text}`);
    });

    child.on('error', (error) => {
      logger.error('Command execution error:', error);
      reject(error);
    });

    child.on('close', (exitCode) => {
      logger.info(`Command exited with code: ${exitCode}`);
      resolve({
        exitCode,
        output,
        errorOutput
      });
    });
  });
}

/**
 * Save test log to file
 */
async function saveTestLog(logData) {
  const { testId, command, exitCode, output, errorOutput, duration, timestamp, status } = logData;

  try {
    await ensureLogsDirectory();

    // Generate unique filename using timestamp and testId
    const logId = `${Date.now()}-${testId.replace(/[^a-z0-9-]/gi, '_')}`;
    const filename = `${logId}.json`;
    const filepath = path.join(LOGS_DIR, filename);

    // Prepare log entry
    const logEntry = {
      id: logId,
      testId,
      command,
      exitCode,
      output,
      errorOutput,
      duration,
      status,
      timestamp
    };

    // Write to file
    await fs.writeFile(filepath, JSON.stringify(logEntry, null, 2), 'utf-8');
    logger.info(`Test log saved to ${filename}`);
  } catch (error) {
    logger.error('Error saving test log:', error);
    throw error;
  }
}

export default createTestRunnerRoutes;
