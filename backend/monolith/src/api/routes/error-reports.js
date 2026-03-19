/**
 * Error Reports API Routes
 * Автоматическое создание GitHub issues при ошибках на фронтенде
 *
 * Issue #1533 - Uses unified token storage system
 * Issue #1764 - Auto-solve functionality for automatic error resolution
 * Issue #1809 - Auto-resolve with /solve in screen session and Telegram notifications
 * Issue #1853 - Auto-execute solve fix: run as hive user, terminate session, notify admins
 */

import express from 'express'
import { Octokit } from '@octokit/rest'
import { exec } from 'child_process'
import { promisify } from 'util'
import logger from '../../utils/logger.js'
import { pool } from '../../config/database.js'

const router = express.Router()
const execAsync = promisify(exec)

// GitHub configuration
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'unidel2035'
const GITHUB_REPO = process.env.GITHUB_REPO || 'dronedoc2025'

// Auto-solve configuration (Issue #1764, #1809)
const AUTO_SOLVE_ENABLED = process.env.AUTO_SOLVE_ENABLED !== 'false' // Enabled by default
const AUTO_SOLVE_SSH_HOST = process.env.AUTO_SOLVE_SSH_HOST || 'root@193.239.166.31'
const AUTO_SOLVE_SCREEN_SESSION = process.env.AUTO_SOLVE_SCREEN_SESSION || 'gh-issue-solver'
const AUTO_SOLVE_WRAPPER_SCRIPT = process.env.AUTO_SOLVE_WRAPPER_SCRIPT || '/root/dronedoc2025/backend/monolith/scripts/auto-solve-wrapper.sh'

// Rate limiting storage (in-memory, можно заменить на Redis)
const errorReports = new Map()
const RATE_LIMIT_WINDOW = 60000 // 1 минута
const MAX_REPORTS_PER_WINDOW = 10 // Максимум 10 отчетов в минуту

/**
 * Получить GitHub API токен из unified token storage или environment variable
 * @returns {Promise<string|null>} GitHub API token or null if not found
 */
async function getGitHubToken() {
  logger.info('[GitHub Token] Retrieving GitHub token...')

  // Проверяем environment variable сначала (простой способ для разработки)
  if (process.env.GITHUB_TOKEN) {
    const tokenPreview = process.env.GITHUB_TOKEN.substring(0, 10) + '***'
    logger.info('[GitHub Token] Using GitHub token from environment variable', {
      tokenPreview,
      tokenLength: process.env.GITHUB_TOKEN.length
    })
    return process.env.GITHUB_TOKEN
  }

  logger.info('[GitHub Token] GITHUB_TOKEN env var not found, trying unified token storage...')

  // Иначе пытаемся получить из unified token storage
  try {
    const result = await pool.query(`
      SELECT
        k.api_key_encrypted,
        p.name as provider_name
      FROM ai_provider_api_keys k
      JOIN ai_model_providers p ON k.provider_id = p.id
      WHERE p.name = 'github'
        AND k.is_active = true
        AND k.is_default = true
      LIMIT 1
    `)

    logger.info('[GitHub Token] Database query completed', {
      rowsFound: result.rows.length
    })

    if (result.rows.length === 0) {
      logger.warn('[GitHub Token] GitHub API key not found in unified token storage or environment variable', {
        envVarSet: !!process.env.GITHUB_TOKEN,
        GH_TOKEN_set: !!process.env.GH_TOKEN,
        dbRowsFound: result.rows.length
      })
      return null
    }

    // Decrypt the key (currently using base64, but should use proper encryption in production)
    const encryptedKey = result.rows[0].api_key_encrypted
    const decryptedKey = Buffer.from(encryptedKey, 'base64').toString('utf-8')
    const tokenPreview = decryptedKey.substring(0, 10) + '***'

    logger.info('[GitHub Token] Using GitHub token from unified token storage', {
      tokenPreview,
      tokenLength: decryptedKey.length,
      provider: result.rows[0].provider_name
    })
    return decryptedKey
  } catch (error) {
    logger.error('[GitHub Token] Failed to retrieve GitHub token from unified storage', {
      error: error.message,
      stack: error.stack,
      dbAvailable: !!pool
    })
    return null
  }
}

/**
 * Проверка rate limit
 */
function checkRateLimit(ip) {
  const now = Date.now()
  const key = `error-report:${ip}`

  let reportData = errorReports.get(key)

  if (!reportData) {
    reportData = {
      count: 0,
      windowStart: now
    }
    errorReports.set(key, reportData)
  }

  // Сброс окна если прошло время
  if (now - reportData.windowStart > RATE_LIMIT_WINDOW) {
    reportData.count = 0
    reportData.windowStart = now
  }

  // Проверка лимита
  if (reportData.count >= MAX_REPORTS_PER_WINDOW) {
    return false
  }

  reportData.count++
  return true
}

/**
 * Очистка старых записей rate limit
 */
function cleanupRateLimitData() {
  const now = Date.now()
  const maxAge = 600000 // 10 минут

  for (const [key, data] of errorReports.entries()) {
    if (now - data.windowStart > maxAge) {
      errorReports.delete(key)
    }
  }
}

// Периодическая очистка каждые 5 минут
setInterval(cleanupRateLimitData, 300000)

/**
 * Нормализация заголовка ошибки для сравнения
 * Убирает специфичные детали, оставляя только суть ошибки
 */
function normalizeErrorTitle(title) {
  return title
    // Убираем префикс [Авто]
    .replace(/^\[Авто\]\s*/i, '')
    // Убираем конкретные значения (числа, URL, etc)
    .replace(/\b\d+\b/g, 'N')
    // Приводим к lowercase для сравнения
    .toLowerCase()
    .trim()
}

/**
 * Извлечение ключевых частей stack trace для сравнения
 */
function extractStackTraceSignature(body) {
  // Ищем блок Stack Trace в теле issue
  const stackMatch = body.match(/### Stack Trace\s*```\s*([^`]+)\s*```/i)
  if (!stackMatch) return ''

  const stackTrace = stackMatch[1]

  // Берем первые 3 строки стека (обычно достаточно для идентификации)
  const lines = stackTrace.split('\n').slice(0, 3)

  // Нормализуем каждую строку
  return lines
    .map(line => line
      // Убираем bundle hashes
      .replace(/index-[A-Za-z0-9]+\.js/g, 'index-[hash].js')
      .replace(/assets\/[A-Za-z0-9-]+\.js/g, 'assets/[hash].js')
      // Убираем точные номера строк/колонок
      .replace(/:\d+:\d+/g, ':LINE:COL')
      // Убираем URL префиксы
      .replace(/https?:\/\/[^/]+\//g, '')
      .replace(/http:\/\/localhost:\d+\//g, '')
      .trim()
    )
    .filter(line => line.length > 0)
    .join('\n')
}

/**
 * Вычисление similarity score между двумя строками
 * Использует простое Levenshtein-подобное сравнение
 */
function calculateSimilarity(str1, str2) {
  if (str1 === str2) return 1.0

  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1

  if (longer.length === 0) return 1.0

  // Простое сравнение по общим подстрокам
  const commonLength = [...shorter].filter((char, i) => longer[i] === char).length
  return commonLength / longer.length
}

/**
 * Проверка, является ли issue дубликатом
 * Проверяет заголовок, stack trace и страницу
 */
function isDuplicateIssue(newTitle, newBody, existingIssue) {
  const existingTitle = existingIssue.title
  const existingBody = existingIssue.body || ''

  // 1. Сравнение нормализованных заголовков
  const normalizedNewTitle = normalizeErrorTitle(newTitle)
  const normalizedExistingTitle = normalizeErrorTitle(existingTitle)
  const titleSimilarity = calculateSimilarity(normalizedNewTitle, normalizedExistingTitle)

  // Если заголовки сильно отличаются, это не дубликат
  if (titleSimilarity < 0.7) return false

  // 2. Извлечение и сравнение stack trace signatures
  const newStackSignature = extractStackTraceSignature(newBody)
  const existingStackSignature = extractStackTraceSignature(existingBody)

  // Если есть stack traces, сравниваем их
  if (newStackSignature && existingStackSignature) {
    const stackSimilarity = calculateSimilarity(newStackSignature, existingStackSignature)

    // Если stack traces очень похожи (>80%), это вероятно дубликат
    if (stackSimilarity > 0.8) return true

    // Если stack traces сильно отличаются, это не дубликат
    if (stackSimilarity < 0.5) return false
  }

  // 3. Проверка страницы (pathname)
  const newPageMatch = newBody.match(/\*\*Путь:\*\*\s*([^\n]+)/i)
  const existingPageMatch = existingBody.match(/\*\*Путь:\*\*\s*([^\n]+)/i)

  if (newPageMatch && existingPageMatch) {
    const newPage = newPageMatch[1].trim()
    const existingPage = existingPageMatch[1].trim()

    // Если на разных страницах, это разные ошибки
    if (newPage !== existingPage) return false
  }

  // Если заголовки очень похожи (>85%) и другие проверки не отклонили, считаем дубликатом
  return titleSimilarity > 0.85
}

/**
 * Запустить автоматическое решение issue на удаленном сервере
 * Issue #1853 - Auto-execute solve fix
 *
 * Запускает команду solve в screen сессии на удаленном сервере как пользователь hive.
 * После успешного создания issue, screen сессия автоматически завершается.
 * Уведомление в Telegram отправляется когда solve завершается успешно.
 *
 * Последовательность:
 * 1. SSH к root@193.239.166.31
 * 2. Переключение на пользователя hive (su - hive)
 * 3. Запуск solve в screen сессии
 * 4. Автоматическое завершение screen сессии после выполнения
 * 5. Отправка уведомления в Telegram администраторам
 *
 * @param {number} issueNumber - Номер созданного GitHub issue
 * @param {string} issueUrl - URL созданного GitHub issue
 * @returns {Promise<{success: boolean, message: string, sessionName?: string}>}
 */
async function triggerAutoSolve(issueNumber, issueUrl) {
  if (!AUTO_SOLVE_ENABLED) {
    logger.debug('Auto-solve is disabled, skipping')
    return { success: false, message: 'Auto-solve disabled' }
  }

  try {
    // Генерируем уникальное имя screen сессии
    const timestamp = Date.now()
    const sessionName = `${AUTO_SOLVE_SCREEN_SESSION}-${issueNumber}-${timestamp}`

    // Issue #1853: Команда должна выполняться как пользователь hive
    // ssh root@193.239.166.31
    // su - hive
    // screen -dmS <session> bash -c 'solve <url>; exit'
    //
    // Используем wrapper script который:
    // 1. Выполняет solve
    // 2. Извлекает информацию о PR
    // 3. Отправляет уведомление в Telegram
    const solveCommand = `${AUTO_SOLVE_WRAPPER_SCRIPT} ${issueUrl}`

    // Команда для запуска в screen сессии как пользователь hive
    // screen -dmS <session_name> - создает detached screen сессию
    // bash -c '...; exit' - выполняет команду и автоматически завершает сессию
    const screenCommand = `screen -dmS ${sessionName} bash -c '${solveCommand}; exit'`

    // SSH команда: подключаемся как root, переключаемся на hive, запускаем screen
    // su - hive -c "..." - выполняет команду от имени hive с его окружением
    const suCommand = `su - hive -c "${screenCommand}"`
    const sshCommand = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${AUTO_SOLVE_SSH_HOST} '${suCommand}'`

    logger.info('Triggering auto-solve on remote server as hive user', {
      issueNumber,
      issueUrl,
      sessionName,
      sshHost: AUTO_SOLVE_SSH_HOST,
      user: 'hive',
      wrapperScript: AUTO_SOLVE_WRAPPER_SCRIPT
    })

    // Запускаем SSH команду асинхронно
    const { stdout, stderr } = await execAsync(sshCommand, {
      timeout: 15000 // 15 секунд timeout для SSH подключения
    })

    if (stderr && !stderr.includes('Warning')) {
      logger.warn('Auto-solve SSH stderr output', { stderr })
    }

    logger.info('Auto-solve triggered successfully in screen session as hive user', {
      issueNumber,
      sessionName,
      stdout: stdout?.trim(),
      note: 'Screen session will auto-terminate after solve completes. Telegram notification will be sent on success.'
    })

    // Сессия screen завершится автоматически после выполнения wrapper script
    // благодаря команде 'exit' в конце bash -c
    // Wrapper script вызывает solve и затем отправляет уведомление в Telegram

    return {
      success: true,
      message: 'Auto-solve started in screen session as hive user (will auto-terminate and notify on success)',
      sessionName
    }
  } catch (error) {
    logger.error('Failed to trigger auto-solve', {
      error: error.message,
      stack: error.stack,
      issueNumber,
      issueUrl
    })

    return {
      success: false,
      message: `Auto-solve failed: ${error.message}`
    }
  }
}

/**
 * Поиск существующих похожих issues в GitHub
 */
async function findSimilarIssues(octokit, title, body) {
  try {
    logger.info('[Duplicate Check] Searching for similar issues in GitHub', {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      state: 'open',
      labels: 'auto-error-report'
    })

    // Ищем только открытые issues с меткой auto-error-report
    const { data: issues } = await octokit.issues.listForRepo({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      state: 'open',
      labels: 'auto-error-report',
      per_page: 100, // Проверяем последние 100 issues
      sort: 'created',
      direction: 'desc'
    })

    logger.info(`[Duplicate Check] Found ${issues.length} existing error report issues to check for duplicates`)

    // Проверяем каждый issue на схожесть
    for (const issue of issues) {
      if (isDuplicateIssue(title, body, issue)) {
        logger.info('[Duplicate Check] Found duplicate issue', {
          existingIssue: issue.number,
          existingTitle: issue.title.substring(0, 50),
          existingUrl: issue.html_url
        })
        return issue
      }
    }

    logger.info('[Duplicate Check] No duplicate issues found')
    return null
  } catch (error) {
    logger.error('[Duplicate Check] Failed to search for similar issues', {
      error: error.message,
      stack: error.stack,
      status: error.status,
      statusText: error.response?.statusText,
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO
    })

    // Log specific auth errors during duplicate check
    if (error.status === 401) {
      logger.error('[Duplicate Check] GitHub authentication failed during duplicate search', {
        message: 'Token is invalid or has been revoked',
        suggestion: 'The same token will be used for issue creation, which will likely fail'
      })
    }

    // В случае ошибки поиска, продолжаем создание issue
    // (лучше создать дубликат, чем потерять ошибку)
    return null
  }
}

/**
 * POST /api/error-reports
 * Создание GitHub issue из отчета об ошибке
 * С проверкой на дубликаты
 */
router.post('/', async (req, res) => {
  try {
    const { title, body, labels, errorContext } = req.body

    // Валидация
    if (!title || !body) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Title and body are required'
        }
      })
    }

    // Проверка rate limit по IP
    const clientIp = req.ip || req.connection.remoteAddress
    if (!checkRateLimit(clientIp)) {
      logger.warn('Error report rate limit exceeded', { ip: clientIp })
      return res.status(429).json({
        success: false,
        error: {
          message: 'Too many error reports. Please try again later.'
        }
      })
    }

    // Получение GitHub token (из env или unified storage)
    logger.info('[Error Report] Retrieving GitHub token for error report creation')
    const githubToken = await getGitHubToken()
    if (!githubToken) {
      logger.error('[Error Report] GitHub token not configured', {
        GITHUB_TOKEN_set: !!process.env.GITHUB_TOKEN,
        GH_TOKEN_set: !!process.env.GH_TOKEN,
        databasePoolAvailable: !!pool
      })
      return res.status(500).json({
        success: false,
        error: {
          message: 'GitHub integration not configured. Please set GITHUB_TOKEN environment variable or add GitHub API key via /api/ai-tokens/provider-keys'
        }
      })
    }

    logger.info('[Error Report] GitHub token retrieved successfully, creating Octokit client')

    // Создание GitHub client
    const octokit = new Octokit({
      auth: githubToken
    })

    logger.info('[Error Report] Octokit client created, testing GitHub API connectivity...')
    try {
      // Test the token with a simple API call
      const { data: rateLimit } = await octokit.rateLimit.get()
      logger.info('[Error Report] GitHub API connectivity verified', {
        remaining: rateLimit.rate.remaining,
        limit: rateLimit.rate.limit,
        resetAt: new Date(rateLimit.rate.reset * 1000).toISOString()
      })
    } catch (testError) {
      logger.error('[Error Report] GitHub API connectivity test failed', {
        status: testError.status,
        statusText: testError.message,
        headers: testError.response?.headers
      })
      // Continue anyway, the actual operation might still work
    }

    // ПРОВЕРКА НА ДУБЛИКАТЫ
    logger.info('Checking for duplicate issues', {
      title: title.substring(0, 50),
      page: errorContext?.page
    })

    const existingIssue = await findSimilarIssues(octokit, title, body)

    if (existingIssue) {
      logger.info('Duplicate issue found, not creating new issue', {
        existingIssue: existingIssue.number,
        existingUrl: existingIssue.html_url
      })

      // Возвращаем информацию о существующем issue
      return res.json({
        success: true,
        duplicate: true,
        message: 'Similar issue already exists',
        data: {
          number: existingIssue.number,
          html_url: existingIssue.html_url,
          state: existingIssue.state,
          created_at: existingIssue.created_at,
          title: existingIssue.title
        }
      })
    }

    // Создание нового GitHub issue
    logger.info('No duplicate found, creating new GitHub issue', {
      title: title.substring(0, 50),
      page: errorContext?.page
    })

    const issue = await octokit.issues.create({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      title,
      body,
      labels: labels || ['auto-error-report', 'bug']
    })

    logger.info('GitHub issue created successfully', {
      issueNumber: issue.data.number,
      issueUrl: issue.data.html_url
    })

    // Issue #2146: Trigger auto-solve ONLY for auto-error-report issues
    // Проверяем, есть ли метка auto-error-report
    const issueLabels = issue.data.labels.map(label =>
      typeof label === 'string' ? label : label.name
    )
    const hasAutoErrorReportLabel = issueLabels.includes('auto-error-report')

    let autoSolveResult = null
    if (hasAutoErrorReportLabel) {
      logger.info('Issue has auto-error-report label, triggering auto-solve', {
        issueNumber: issue.data.number,
        labels: issueLabels
      })
      // Запускаем асинхронно, не блокируя ответ
      autoSolveResult = await triggerAutoSolve(issue.data.number, issue.data.html_url)
    } else {
      logger.info('Issue does not have auto-error-report label, skipping auto-solve', {
        issueNumber: issue.data.number,
        labels: issueLabels
      })
      autoSolveResult = {
        success: false,
        message: 'Auto-solve skipped: issue does not have auto-error-report label'
      }
    }

    res.json({
      success: true,
      duplicate: false,
      data: {
        number: issue.data.number,
        html_url: issue.data.html_url,
        state: issue.data.state,
        created_at: issue.data.created_at
      },
      autoSolve: autoSolveResult // Добавляем информацию об auto-solve
    })

  } catch (error) {
    logger.error('[Error Report] Failed to create error report issue', {
      error: error.message,
      stack: error.stack,
      status: error.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      requestUrl: error.request?.url,
      requestMethod: error.request?.method
    })

    // Проверяем специфичные ошибки GitHub API
    if (error.status === 401) {
      logger.error('[Error Report] GitHub authentication failed (401 Unauthorized)', {
        message: 'The GitHub token is invalid or has been revoked',
        tokenSource: process.env.GITHUB_TOKEN ? 'environment variable' : 'unified token storage',
        GITHUB_TOKEN_set: !!process.env.GITHUB_TOKEN,
        GH_TOKEN_set: !!process.env.GH_TOKEN,
        suggestion: 'Please verify GITHUB_TOKEN environment variable is set correctly or update the token in unified storage'
      })
      return res.status(500).json({
        success: false,
        error: {
          message: 'GitHub authentication failed - token is invalid or revoked'
        }
      })
    }

    if (error.status === 403) {
      logger.error('[Error Report] GitHub API rate limit or permissions issue (403 Forbidden)', {
        message: error.message,
        rateLimitRemaining: error.response?.headers?.['x-ratelimit-remaining'],
        rateLimitReset: error.response?.headers?.['x-ratelimit-reset']
      })
      return res.status(500).json({
        success: false,
        error: {
          message: 'GitHub API rate limit exceeded or insufficient permissions'
        }
      })
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create error report',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    })
  }
})

/**
 * GET /api/error-reports/health
 * Проверка здоровья сервиса
 */
router.get('/health', async (req, res) => {
  try {
    const status = {
      service: 'error-reports',
      status: 'ok',
      timestamp: new Date().toISOString()
    }

    // Проверка GitHub API если токен настроен
    const githubToken = await getGitHubToken()
    if (githubToken) {
      try {
        const octokit = new Octokit({ auth: githubToken })
        await octokit.rateLimit.get()
        status.github = 'connected'
      } catch (error) {
        status.github = 'error'
        status.githubError = error.message
      }
    } else {
      status.github = 'not_configured'
      status.githubMessage = 'Set GITHUB_TOKEN environment variable or add GitHub API key via /api/ai-tokens/provider-keys'
    }

    res.json(status)
  } catch (error) {
    res.status(500).json({
      service: 'error-reports',
      status: 'error',
      error: error.message
    })
  }
})

/**
 * GET /api/error-reports/stats
 * Статистика отчетов об ошибках (для администраторов)
 */
router.get('/stats', (req, res) => {
  const stats = {
    totalReportsSent: errorReports.size,
    rateLimitWindow: RATE_LIMIT_WINDOW,
    maxReportsPerWindow: MAX_REPORTS_PER_WINDOW,
    currentReports: Array.from(errorReports.entries()).map(([key, data]) => ({
      ip: key.replace('error-report:', ''),
      count: data.count,
      windowStart: new Date(data.windowStart).toISOString()
    }))
  }

  res.json({
    success: true,
    data: stats
  })
})

export default router
