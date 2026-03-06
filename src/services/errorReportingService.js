/**
 * Error Reporting Service
 * Автоматически создает GitHub issues при возникновении ошибок в консоли
 */

import { logger } from '@/utils/logger'
import { getOrchestratorUrlEnv } from '@/utils/envPolyfill.js'

class ErrorReportingService {
  constructor() {
    this.enabled = import.meta.env.VITE_ERROR_REPORTING_ENABLED === 'true'
    // Use getOrchestratorUrlEnv() for auto-detection support (Issue #6346)
    this.orchestratorUrl = getOrchestratorUrlEnv()
    this.reportedErrors = new Map() // Для дедупликации
    this.rateLimitWindow = 60000 // 1 минута
    this.maxErrorsPerWindow = 5 // Максимум 5 ошибок в минуту
    this.errorCount = 0
    this.windowStartTime = Date.now()
    // Увеличенное время для дедупликации (30 минут вместо 5)
    this.deduplicationWindow = 1800000 // 30 минут
  }

  /**
   * Инициализация сервиса отчетов об ошибках
   */
  init() {
    if (!this.enabled) {
      logger.debug('Error reporting is disabled')
      return
    }

    logger.info('Error reporting service initialized')
  }

  /**
   * Генерация уникального ключа ошибки для дедупликации
   * Улучшенная версия с нормализацией bundle hashes
   */
  getErrorKey(error, context) {
    const message = error?.message || 'Unknown error'
    let stack = error?.stack || ''
    const page = context?.page || window.location.pathname

    // Берем первые 2 строки стека для уникальности
    let stackLines = stack.split('\n').slice(0, 2).join('\n')

    // Нормализация: убираем хеши из bundle файлов
    // Например: index-C7fzad42.js -> index-[hash].js
    stackLines = stackLines.replace(/index-[A-Za-z0-9]+\.js/g, 'index-[hash].js')
    stackLines = stackLines.replace(/assets\/[A-Za-z0-9-]+\.js/g, 'assets/[hash].js')

    // Нормализация: убираем точные номера строк и колонок
    // Оставляем только приблизительную локацию
    stackLines = stackLines.replace(/:(\d{4,}):(\d+)/g, ':LINE:COL')

    // Нормализация: убираем протокол и домен для универсальности
    stackLines = stackLines.replace(/https?:\/\/[^/]+\//g, '')
    stackLines = stackLines.replace(/http:\/\/localhost:\d+\//g, '')

    return `${message}|${page}|${stackLines}`
  }

  /**
   * Проверка rate limit
   */
  isRateLimited() {
    const now = Date.now()

    // Сброс счетчика если прошло окно
    if (now - this.windowStartTime > this.rateLimitWindow) {
      this.errorCount = 0
      this.windowStartTime = now
    }

    return this.errorCount >= this.maxErrorsPerWindow
  }

  /**
   * Проверка, была ли ошибка уже отправлена
   */
  isDuplicate(errorKey) {
    const now = Date.now()
    const lastReported = this.reportedErrors.get(errorKey)

    // Считаем дубликатом если та же ошибка была в пределах deduplicationWindow (30 минут)
    if (lastReported && now - lastReported < this.deduplicationWindow) {
      logger.debug('Duplicate error detected', {
        errorKey: errorKey.substring(0, 100),
        lastReportedAgo: Math.round((now - lastReported) / 1000) + 's'
      })
      return true
    }

    return false
  }

  /**
   * Фильтрация ошибок, которые не нужно отправлять
   */
  shouldIgnoreError(error, context) {
    const message = error?.message || ''
    const filename = error?.filename || context?.filename || ''
    const stack = error?.stack || ''

    // Игнорируем ошибки от расширений браузера
    const extensionPatterns = [
      'kaspersky-labs.com',
      'gc.kis.v2.scr',
      'FD126C42-EBFA',
      'chrome-extension://',
      'moz-extension://',
      'safari-extension://',
      'edge-extension://',
      'ERR_NETWORK_IO_SUSPENDED'
    ]

    if (extensionPatterns.some(pattern =>
      message.includes(pattern) || filename.includes(pattern)
    )) {
      return true
    }

    // Игнорируем ResizeObserver errors (browser quirk)
    if (message.includes('ResizeObserver')) {
      return true
    }

    // Игнорируем отмененные запросы
    if (message.includes('ERR_CANCELED') || message.includes('AbortError')) {
      return true
    }

    // Игнорируем ошибки Service Worker (PWA был удален из проекта)
    // Включаем все варианты ошибок связанных с sw.js
    const serviceWorkerPatterns = [
      'ServiceWorker',
      'service worker',
      'sw.js',
      'Service Worker',
      'Failed to update a ServiceWorker'
    ]

    if (serviceWorkerPatterns.some(pattern =>
      message.toLowerCase().includes(pattern.toLowerCase())
    )) {
      return true
    }

    // Игнорируем truly uninformative errors (Issue #2058)
    // These are errors with generic messages and no useful context
    // This is a defense-in-depth measure; main.js should already filter these
    const isUninformativeError =
      (message === 'Unhandled error event' ||
       message === 'UnhandledError: Unhandled error event' ||
       message === 'Script error.' ||
       message === 'UnhandledError: Script error.') &&
      !filename &&
      !stack

    if (isUninformativeError) {
      logger.debug('Ignoring uninformative error event', {
        message,
        hasFilename: !!filename,
        hasStack: !!stack
      })
      return true
    }

    return false
  }

  /**
   * Сбор контекста об ошибке (Enhanced for Issue #1921)
   */
  collectErrorContext(error, additionalContext = {}) {
    return {
      // Информация об ошибке
      message: error?.message || 'Unknown error',
      stack: error?.stack || '',
      name: error?.name || 'Error',
      errorType: additionalContext?.errorType || error?.name || 'Error',

      // Оригинальное событие ошибки (если доступно)
      originalEvent: error?.originalEvent || null,

      // Дополнительные данные об ошибке
      filename: error?.filename || additionalContext?.filename || null,
      lineno: error?.lineno || additionalContext?.lineno || null,
      colno: error?.colno || additionalContext?.colno || null,

      // Контекст страницы
      page: window.location.href,
      pathname: window.location.pathname,
      hash: window.location.hash,
      search: window.location.search,

      // Информация о браузере
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      onLine: navigator.onLine,

      // Информация о viewport
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,

      // Время
      timestamp: new Date().toISOString(),
      timezoneOffset: new Date().getTimezoneOffset(),

      // Enhanced Vue.js context (Issue #1921)
      vueContext: error?.vueContext || additionalContext?.vueContext || {
        componentName: additionalContext?.componentName || error?.componentName || null,
        componentFile: additionalContext?.componentFile || null,
        lifecycle: additionalContext?.vueInfo || null,
        route: additionalContext?.routeInfo || null,
        propsKeys: [],
        parentComponent: null
      },

      // Enhanced focused element context
      focusedElement: additionalContext?.focusedElement || null,

      // Stack frames for better analysis
      stackFrames: additionalContext?.stackFrames || [],

      // Дополнительный контекст
      ...additionalContext
    }
  }

  /**
   * Форматирование тела GitHub issue (Enhanced for Issue #1921)
   */
  formatIssueBody(errorContext) {
    // Extract Vue context for prominent display
    const vueContext = errorContext.vueContext || {}
    const hasVueContext = vueContext.componentName || vueContext.componentFile || vueContext.route

    return `## Автоматический отчет об ошибке

### Ошибка
\`\`\`
${errorContext.errorType || errorContext.name}: ${errorContext.message}
\`\`\`

${hasVueContext ? `### 🎯 Vue Component Context

${vueContext.componentName ? `**Component:** \`${vueContext.componentName}\`\n` : ''}${vueContext.componentFile ? `**File:** \`${vueContext.componentFile}\`\n` : ''}${vueContext.lifecycle ? `**Lifecycle Hook:** \`${vueContext.lifecycle}\`\n` : ''}${vueContext.parentComponent ? `**Parent Component:** \`${vueContext.parentComponent}\`\n` : ''}${vueContext.route ? `**Route:** \`${vueContext.route.name || vueContext.route.path}\` (\`${vueContext.route.fullPath || vueContext.route.path}\`)\n` : ''}${vueContext.route?.params && Object.keys(vueContext.route.params).length > 0 ? `**Route Params:** \`${JSON.stringify(vueContext.route.params)}\`\n` : ''}${vueContext.route?.query && Object.keys(vueContext.route.query).length > 0 ? `**Route Query:** \`${JSON.stringify(vueContext.route.query)}\`\n` : ''}${vueContext.propsKeys && vueContext.propsKeys.length > 0 ? `**Props:** ${vueContext.propsKeys.join(', ')}\n` : ''}
` : ''}### Stack Trace
\`\`\`
${errorContext.stack}
\`\`\`

${errorContext.filename || errorContext.lineno ? `### 📍 Error Location (Minified)

**File:** ${errorContext.filename || 'Unknown'}
**Line:** ${errorContext.lineno || 'Unknown'}
**Column:** ${errorContext.colno || 'Unknown'}

> **Note:** This points to minified production code. Use source maps for debugging (generated in 'hidden' mode).

` : ''}${errorContext.recentActions && errorContext.recentActions.length > 0 ? `### 👤 Recent User Actions

${errorContext.recentActions.map((action, i) => `${i + 1}. **${action.action}** ${action.details?.element ? `on \`${action.details.element}\`` : ''} at \`${action.path}\` (${new Date(action.timestamp).toLocaleTimeString()})`).join('\n')}

` : ''}${errorContext.focusedElement ? `### 🎯 Focused Element

**Tag:** \`<${errorContext.focusedElement.tag}>\`
${errorContext.focusedElement.id ? `**ID:** \`#${errorContext.focusedElement.id}\`\n` : ''}${errorContext.focusedElement.className ? `**Class:** \`${errorContext.focusedElement.className}\`\n` : ''}${errorContext.focusedElement.textContent ? `**Text:** "${errorContext.focusedElement.textContent}"\n` : ''}
` : ''}### 🌐 Page Context

**URL:** ${errorContext.page}
**Path:** ${errorContext.pathname}
${errorContext.hash ? `**Hash:** ${errorContext.hash}\n` : ''}${errorContext.search ? `**Query:** ${errorContext.search}\n` : ''}**Timestamp:** ${errorContext.timestamp}

### 💻 Browser Information

**User Agent:** ${errorContext.userAgent}
**Platform:** ${errorContext.platform}
**Language:** ${errorContext.language}
**Online:** ${errorContext.onLine ? 'Yes' : 'No'}

### 📐 Viewport

**Screen:** ${errorContext.screenWidth}x${errorContext.screenHeight}
**Window:** ${errorContext.windowWidth}x${errorContext.windowHeight}

${errorContext.performanceMetrics ? `### ⚡ Performance Metrics

\`\`\`json
${JSON.stringify(errorContext.performanceMetrics, null, 2)}
\`\`\`

` : ''}${errorContext.timing ? `### ⏱️ Timing

\`\`\`json
${JSON.stringify(errorContext.timing, null, 2)}
\`\`\`

` : ''}${errorContext.stackFrames && errorContext.stackFrames.length > 0 ? `### 📚 Stack Frames

\`\`\`
${errorContext.stackFrames.join('\n')}
\`\`\`

` : ''}${errorContext.originalEvent ? `### 📝 Original Event

\`\`\`json
${JSON.stringify(errorContext.originalEvent, null, 2)}
\`\`\`

` : ''}---

*This issue was automatically created by DronDoc Error Tracking System.*

**Debugging Tips:**
- Source maps are generated in 'hidden' mode (not exposed to browsers)
- Use source maps on the server to decode minified stack traces
- Vue component context helps identify the source component
- Recent actions show what the user was doing before the error

**Related:** Issue #1921 - Enhanced error context collection
`
  }

  /**
   * Отправка отчета об ошибке на backend
   */
  async reportError(error, additionalContext = {}) {
    if (!this.enabled) {
      return
    }

    try {
      // Проверяем, нужно ли игнорировать ошибку
      if (this.shouldIgnoreError(error, additionalContext)) {
        logger.debug('Error ignored (extension/browser quirk)', { error })
        return
      }

      // Собираем контекст
      const errorContext = this.collectErrorContext(error, additionalContext)
      const errorKey = this.getErrorKey(error, errorContext)

      // Проверяем дубликаты
      if (this.isDuplicate(errorKey)) {
        logger.debug('Duplicate error, skipping report', { errorKey })
        return
      }

      // Проверяем rate limit
      if (this.isRateLimited()) {
        logger.warn('Error reporting rate limit exceeded')
        return
      }

      // Отмечаем ошибку как отправленную
      this.reportedErrors.set(errorKey, Date.now())
      this.errorCount++

      // Форматируем issue title (Enhanced for Issue #1921)
      // Include component name and route in title for better clarity
      const errorType = errorContext.errorType || error?.name || 'Error'
      const componentInfo = errorContext.vueContext?.componentName
        ? ` in ${errorContext.vueContext.componentName}`
        : ''
      const routeInfo = errorContext.vueContext?.route?.path
        ? ` on ${errorContext.vueContext.route.path}`
        : errorContext.pathname !== '/'
        ? ` on ${errorContext.pathname}`
        : ''

      const issueTitle = `[Авто] ${errorType}: ${error?.message || 'Unknown error'}${componentInfo}${routeInfo}`
        .substring(0, 255) // GitHub title limit

      const issueBody = this.formatIssueBody(errorContext)

      // Отправляем на backend
      const response = await fetch(`${this.orchestratorUrl}/api/error-reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: issueTitle,
          body: issueBody,
          labels: ['auto-error-report', 'bug'],
          errorContext
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to send error report: ${response.statusText}`)
      }

      const result = await response.json()
      logger.info('Error report sent successfully', {
        issueUrl: result.data?.html_url
      })

      return result.data

    } catch (reportError) {
      // Не логируем в сам сервис отчетов, чтобы избежать бесконечного цикла
      console.error('[ErrorReportingService] Failed to send error report:', reportError)
    }
  }

  /**
   * Очистка старых записей о дубликатах (cleanup)
   */
  cleanup() {
    const now = Date.now()
    const maxAge = 600000 // 10 минут

    for (const [key, timestamp] of this.reportedErrors.entries()) {
      if (now - timestamp > maxAge) {
        this.reportedErrors.delete(key)
      }
    }
  }

  /**
   * Включение отчетов об ошибках
   */
  enable() {
    this.enabled = true
    logger.info('Error reporting enabled')
  }

  /**
   * Отключение отчетов об ошибках
   */
  disable() {
    this.enabled = false
    logger.info('Error reporting disabled')
  }
}

// Создаем singleton
export const errorReportingService = new ErrorReportingService()

// Экспортируем класс для тестирования
export { ErrorReportingService }
