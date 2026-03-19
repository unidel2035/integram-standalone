/**
 * Code Analyzer API Routes
 * AI-powered code analysis for errors and memory leaks
 *
 * Issue #4508 - Create an agent that analyzes code for errors and memory leaks
 *
 * IMPORTANT: This implementation uses Integram MCP for data storage (not PostgreSQL)
 * See: backend/monolith/migrations/code_analyzer_integram_schema.md
 */

import express from 'express'
import crypto from 'crypto'
import logger from '../../utils/logger.js'
import { TokenBasedLLMCoordinator } from '../../core/TokenBasedLLMCoordinator.js'
import IntegramClient from '../../services/integram/integram-client.js'
import { pool } from '../../config/database.js'

const router = express.Router()

// Initialize LLM coordinator (singleton)
let llmCoordinator = null

async function getCoordinator() {
  if (!llmCoordinator) {
    llmCoordinator = new TokenBasedLLMCoordinator({ db: pool, logger })
  }
  return llmCoordinator
}

// Initialize Integram client (singleton)
let integramClient = null

async function getIntegramClient() {
  if (!integramClient) {
    integramClient = new IntegramClient(
      process.env.INTEGRAM_SERVER_URL || 'https://dronedoc.ru',
      process.env.INTEGRAM_DATABASE || 'a2025'
    )

    // Authenticate
    const login = process.env.INTEGRAM_LOGIN || 'd'
    const password = process.env.INTEGRAM_PASSWORD || 'd'
    await integramClient.authenticate(login, password)

    logger.info('Integram client initialized for Code Analyzer')
  }
  return integramClient
}

// Load Integram type IDs from config
let integramConfig = null

async function loadIntegramConfig() {
  if (!integramConfig) {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      const { fileURLToPath } = await import('url')
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const configPath = path.join(__dirname, '../../config/code-analyzer-integram.json')

      const configData = await fs.readFile(configPath, 'utf-8')
      integramConfig = JSON.parse(configData)
      logger.info('Loaded Integram config for Code Analyzer', {
        analysisTypeId: integramConfig.analysisTypeId,
        issueTypeId: integramConfig.issueTypeId
      })
    } catch (error) {
      logger.error('Failed to load Integram config. Run setup script first:', error.message)
      throw new Error(
        'Code Analyzer Integram schema not set up. ' +
        'Run: node backend/monolith/scripts/setup-code-analyzer-integram.js'
      )
    }
  }
  return integramConfig
}

/**
 * System prompt for code analysis
 */
const CODE_ANALYSIS_SYSTEM_PROMPT = `You are an expert code analyzer specialized in finding errors and memory leaks.

Your task is to analyze code and identify:
1. **Syntax errors**: Invalid syntax that will prevent code from running
2. **Logic errors**: Bugs in code logic that may cause unexpected behavior
3. **Memory leaks**: Issues that prevent proper memory cleanup (unclosed connections, event listeners, file handles, etc.)
4. **Resource leaks**: Unclosed files, database connections, network sockets
5. **Performance issues**: Inefficient algorithms, N+1 queries, unnecessary operations
6. **Security vulnerabilities**: SQL injection, XSS, insecure data handling
7. **Best practice violations**: Code smells, anti-patterns

For each issue found, provide:
- **severity**: critical, high, medium, low, info
- **type**: error, memory-leak, resource-leak, performance, security, style
- **line**: Line number where the issue occurs (if applicable)
- **description**: Clear explanation of the issue
- **suggestion**: How to fix the issue
- **code**: Example of fixed code (if applicable)

Return your analysis as a JSON array of issues. If no issues found, return an empty array.

Example response format:
[
  {
    "severity": "high",
    "type": "memory-leak",
    "line": 15,
    "description": "Event listener added but never removed, causing memory leak",
    "suggestion": "Add cleanup in component unmount or use AbortController",
    "code": "// Add cleanup\\nonBeforeUnmount(() => {\\n  window.removeEventListener('resize', handler)\\n})"
  }
]

Be thorough but concise. Focus on actionable findings.`

/**
 * POST /api/code-analyzer/analyze
 * Analyze code for errors and memory leaks using AI
 */
router.post('/analyze', express.json(), async (req, res) => {
  const startTime = Date.now()

  try {
    const {
      code,
      language = 'javascript',
      fileName,
      accessToken,
      modelId,
      options = {}
    } = req.body

    // Validate input
    if (!code) {
      return res.status(400).json({
        status: 'error',
        message: 'Code is required'
      })
    }

    if (!accessToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Access token is required'
      })
    }

    logger.info('Starting code analysis', {
      language,
      fileName,
      codeLength: code.length,
      modelId
    })

    // Prepare analysis prompt
    const userPrompt = `Analyze the following ${language} code${fileName ? ` from file "${fileName}"` : ''}:

\`\`\`${language}
${code}
\`\`\`

Provide a detailed analysis of errors, memory leaks, and other issues as JSON array.`

    // Get LLM coordinator
    const coordinator = await getCoordinator()

    // Analyze code with AI
    const llmOptions = {
      application: 'CodeAnalyzer',
      operation: 'analyze',
      temperature: options.temperature || 0.2,
      maxTokens: options.maxTokens || 4096,
      systemPrompt: CODE_ANALYSIS_SYSTEM_PROMPT
    }

    const result = await coordinator.chatWithToken(
      accessToken,
      modelId,
      userPrompt,
      llmOptions
    )

    // Parse AI response
    let issues = []
    try {
      // Try to extract JSON from response
      const jsonMatch = result.content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        issues = JSON.parse(jsonMatch[0])
      } else if (result.content.includes('{') && result.content.includes('}')) {
        // Try to parse as single issue object
        const singleIssue = JSON.parse(result.content)
        issues = [singleIssue]
      }
    } catch (parseError) {
      logger.warn('Failed to parse AI response as JSON, using raw text', {
        error: parseError.message
      })
      // Fallback: Return raw response as a single issue
      issues = [{
        severity: 'info',
        type: 'analysis',
        description: result.content,
        suggestion: 'Review the AI analysis manually'
      }]
    }

    // Calculate statistics
    const stats = {
      totalIssues: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
      memoryLeaks: issues.filter(i => i.type === 'memory-leak').length,
      errors: issues.filter(i => i.type === 'error').length,
      performance: issues.filter(i => i.type === 'performance').length,
      security: issues.filter(i => i.type === 'security').length
    }

    const duration = Date.now() - startTime

    logger.info('Code analysis completed', {
      duration,
      totalIssues: stats.totalIssues,
      tokensUsed: result.usage?.totalTokens || 0,
      cost: result.cost
    })

    // Store analysis result in Integram
    try {
      const integram = await getIntegramClient()
      const config = await loadIntegramConfig()

      const codeHash = crypto.createHash('sha256').update(code).digest('hex')

      // Create analysis object
      const analysisObject = await integram.createObject(
        config.analysisTypeId,
        codeHash.substring(0, 12), // Use first 12 chars of hash as object name
        {
          [config.analysisRequisites['Хеш кода']]: codeHash,
          [config.analysisRequisites['Язык']]: language,
          [config.analysisRequisites['Имя файла']]: fileName || '',
          [config.analysisRequisites['Длина кода']]: code.length.toString(),
          [config.analysisRequisites['Найдено проблем']]: issues.length.toString(),
          [config.analysisRequisites['Статистика']]: JSON.stringify(stats),
          [config.analysisRequisites['ID модели']]: modelId || '',
          [config.analysisRequisites['Использовано токенов']]: (result.usage?.totalTokens || 0).toString(),
          [config.analysisRequisites['Стоимость USD']]: (result.cost || 0).toString(),
          [config.analysisRequisites['Длительность мс']]: duration.toString(),
          [config.analysisRequisites['Дата создания']]: new Date().toISOString()
        }
      )

      const analysisId = analysisObject.id

      // Store each issue
      for (const issue of issues) {
        await integram.createObject(
          config.issueTypeId,
          issue.description.substring(0, 50), // First 50 chars as name
          {
            [config.issueRequisites['Анализ']]: analysisId,
            [config.issueRequisites['Серьезность']]: issue.severity || 'info',
            [config.issueRequisites['Тип']]: issue.type || 'other',
            [config.issueRequisites['Строка']]: (issue.line || 0).toString(),
            [config.issueRequisites['Описание']]: issue.description || '',
            [config.issueRequisites['Рекомендация']]: issue.suggestion || '',
            [config.issueRequisites['Пример кода']]: issue.code || ''
          }
        )
      }

      logger.info('Stored analysis in Integram', { analysisId, issuesCount: issues.length })
    } catch (dbError) {
      // Don't fail if storage fails
      logger.warn('Failed to store analysis in Integram', {
        error: dbError.message
      })
    }

    res.json({
      status: 'success',
      data: {
        issues,
        stats,
        metadata: {
          language,
          fileName,
          codeLength: code.length,
          modelUsed: result.model || modelId,
          tokensUsed: result.usage?.totalTokens || 0,
          cost: result.cost || 0,
          duration
        }
      }
    })
  } catch (error) {
    logger.error('Code analysis failed', {
      error: error.message,
      stack: error.stack
    })

    res.status(500).json({
      status: 'error',
      message: 'Code analysis failed',
      error: error.message
    })
  }
})

/**
 * POST /api/code-analyzer/batch
 * Analyze multiple files in batch
 */
router.post('/batch', express.json(), async (req, res) => {
  try {
    const { files, accessToken, modelId, options = {} } = req.body

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Files array is required'
      })
    }

    if (!accessToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Access token is required'
      })
    }

    logger.info('Starting batch code analysis', {
      fileCount: files.length
    })

    const results = []
    let totalIssues = 0

    // Analyze each file
    for (const file of files) {
      try {
        const fileResult = await analyzeCodeInternal(
          file.code,
          file.language || 'javascript',
          file.fileName,
          accessToken,
          modelId,
          options
        )

        results.push({
          fileName: file.fileName,
          success: true,
          ...fileResult
        })

        totalIssues += fileResult.stats.totalIssues
      } catch (error) {
        logger.error('Failed to analyze file', {
          fileName: file.fileName,
          error: error.message
        })

        results.push({
          fileName: file.fileName,
          success: false,
          error: error.message
        })
      }
    }

    // Store batch session in Integram
    try {
      const integram = await getIntegramClient()
      const config = await loadIntegramConfig()

      await integram.createObject(
        config.sessionTypeId,
        `Batch ${new Date().toISOString()}`,
        {
          [config.sessionRequisites['Название']]: `Batch analysis ${files.length} files`,
          [config.sessionRequisites['Всего файлов']]: files.length.toString(),
          [config.sessionRequisites['Успешно']]: results.filter(r => r.success).length.toString(),
          [config.sessionRequisites['Ошибок']]: results.filter(r => !r.success).length.toString(),
          [config.sessionRequisites['Всего проблем']]: totalIssues.toString(),
          [config.sessionRequisites['Дата создания']]: new Date().toISOString()
        }
      )
    } catch (dbError) {
      logger.warn('Failed to store batch session', { error: dbError.message })
    }

    res.json({
      status: 'success',
      data: {
        results,
        summary: {
          totalFiles: files.length,
          successCount: results.filter(r => r.success).length,
          failedCount: results.filter(r => !r.success).length,
          totalIssues
        }
      }
    })
  } catch (error) {
    logger.error('Batch analysis failed', {
      error: error.message,
      stack: error.stack
    })

    res.status(500).json({
      status: 'error',
      message: 'Batch analysis failed',
      error: error.message
    })
  }
})

/**
 * Internal function to analyze code (reusable for batch processing)
 */
async function analyzeCodeInternal(code, language, fileName, accessToken, modelId, options = {}) {
  const userPrompt = `Analyze the following ${language} code${fileName ? ` from file "${fileName}"` : ''}:

\`\`\`${language}
${code}
\`\`\`

Provide a detailed analysis of errors, memory leaks, and other issues as JSON array.`

  const coordinator = await getCoordinator()

  const llmOptions = {
    application: 'CodeAnalyzer',
    operation: 'analyze',
    temperature: options.temperature || 0.2,
    maxTokens: options.maxTokens || 4096,
    systemPrompt: CODE_ANALYSIS_SYSTEM_PROMPT
  }

  const result = await coordinator.chatWithToken(
    accessToken,
    modelId,
    userPrompt,
    llmOptions
  )

  let issues = []
  try {
    const jsonMatch = result.content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      issues = JSON.parse(jsonMatch[0])
    }
  } catch (parseError) {
    issues = [{
      severity: 'info',
      type: 'analysis',
      description: result.content,
      suggestion: 'Review the AI analysis manually'
    }]
  }

  const stats = {
    totalIssues: issues.length,
    critical: issues.filter(i => i.severity === 'critical').length,
    high: issues.filter(i => i.severity === 'high').length,
    medium: issues.filter(i => i.severity === 'medium').length,
    low: issues.filter(i => i.severity === 'low').length,
    memoryLeaks: issues.filter(i => i.type === 'memory-leak').length,
    errors: issues.filter(i => i.type === 'error').length
  }

  return {
    issues,
    stats,
    metadata: {
      language,
      fileName,
      codeLength: code.length,
      tokensUsed: result.usage?.totalTokens || 0,
      cost: result.cost || 0
    }
  }
}

/**
 * GET /api/code-analyzer/history
 * Get analysis history from Integram
 */
router.get('/history', async (req, res) => {
  try {
    const { limit = 50, offset = 0, language } = req.query

    const integram = await getIntegramClient()
    const config = await loadIntegramConfig()

    // Get all analyses
    const analyses = await integram.getObjectList(config.analysisTypeId, {
      offset: parseInt(offset),
      limit: parseInt(limit)
    })

    // Filter by language if specified
    let filteredAnalyses = analyses.object || []
    if (language) {
      const languageReqId = config.analysisRequisites['Язык']
      filteredAnalyses = filteredAnalyses.filter(obj => {
        const reqs = analyses.reqs[obj.id]
        return reqs && reqs[languageReqId] === language
      })
    }

    // Transform to expected format
    const transformed = filteredAnalyses.map(obj => {
      const reqs = analyses.reqs[obj.id] || {}
      return {
        id: obj.id,
        code_hash: reqs[config.analysisRequisites['Хеш кода']],
        language: reqs[config.analysisRequisites['Язык']],
        file_name: reqs[config.analysisRequisites['Имя файла']],
        code_length: parseInt(reqs[config.analysisRequisites['Длина кода']] || '0'),
        issues_found: parseInt(reqs[config.analysisRequisites['Найдено проблем']] || '0'),
        stats: JSON.parse(reqs[config.analysisRequisites['Статистика']] || '{}'),
        model_id: reqs[config.analysisRequisites['ID модели']],
        tokens_used: parseInt(reqs[config.analysisRequisites['Использовано токенов']] || '0'),
        cost_usd: parseFloat(reqs[config.analysisRequisites['Стоимость USD']] || '0'),
        duration_ms: parseInt(reqs[config.analysisRequisites['Длительность мс']] || '0'),
        created_at: reqs[config.analysisRequisites['Дата создания']]
      }
    })

    res.json({
      status: 'success',
      data: {
        analyses: transformed,
        total: transformed.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    })
  } catch (error) {
    logger.error('Failed to fetch history', {
      error: error.message
    })

    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch analysis history',
      error: error.message
    })
  }
})

/**
 * GET /api/code-analyzer/stats
 * Get analysis statistics from Integram
 */
router.get('/stats', async (req, res) => {
  try {
    const integram = await getIntegramClient()
    const config = await loadIntegramConfig()

    // Get all analyses
    const analyses = await integram.getObjectList(config.analysisTypeId, {
      limit: 10000 // Get all for stats
    })

    const analysesList = analyses.object || []
    const reqs = analyses.reqs || {}

    // Calculate statistics
    let totalAnalyses = analysesList.length
    let totalIssuesFound = 0
    let totalTokensUsed = 0
    let totalCost = 0
    let totalDuration = 0
    const languageCounts = {}
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, memoryLeaks: 0 }

    for (const obj of analysesList) {
      const objReqs = reqs[obj.id] || {}

      totalIssuesFound += parseInt(objReqs[config.analysisRequisites['Найдено проблем']] || '0')
      totalTokensUsed += parseInt(objReqs[config.analysisRequisites['Использовано токенов']] || '0')
      totalCost += parseFloat(objReqs[config.analysisRequisites['Стоимость USD']] || '0')
      totalDuration += parseInt(objReqs[config.analysisRequisites['Длительность мс']] || '0')

      const language = objReqs[config.analysisRequisites['Язык']]
      if (language) {
        languageCounts[language] = (languageCounts[language] || 0) + 1
      }

      const statsJson = objReqs[config.analysisRequisites['Статистика']]
      if (statsJson) {
        try {
          const stats = JSON.parse(statsJson)
          severityCounts.critical += stats.critical || 0
          severityCounts.high += stats.high || 0
          severityCounts.medium += stats.medium || 0
          severityCounts.low += stats.low || 0
          severityCounts.memoryLeaks += stats.memoryLeaks || 0
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    const byLanguage = Object.entries(languageCounts).map(([language, analyses_count]) => ({
      language,
      analyses_count,
      total_issues: 0 // TODO: Calculate if needed
    }))

    res.json({
      status: 'success',
      data: {
        overall: {
          total_analyses: totalAnalyses,
          total_issues_found: totalIssuesFound,
          avg_issues_per_analysis: totalAnalyses > 0 ? Math.floor(totalIssuesFound / totalAnalyses) : 0,
          total_tokens_used: totalTokensUsed,
          total_cost: totalCost,
          avg_duration_ms: totalAnalyses > 0 ? Math.floor(totalDuration / totalAnalyses) : 0,
          languages_analyzed: Object.keys(languageCounts).length
        },
        byLanguage,
        bySeverity: severityCounts
      }
    })
  } catch (error) {
    logger.error('Failed to fetch stats', {
      error: error.message
    })

    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch statistics',
      error: error.message
    })
  }
})

/**
 * GET /api/code-analyzer/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    // Check Integram connectivity
    const integram = await getIntegramClient()
    const config = await loadIntegramConfig()

    // Try to get dictionary as a health check
    await integram.client.getDictionary()

    res.json({
      status: 'healthy',
      checks: {
        integram: 'ok',
        llmCoordinator: llmCoordinator ? 'initialized' : 'not_initialized',
        config: config ? 'loaded' : 'not_loaded'
      }
    })
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    })
  }
})

export default router
