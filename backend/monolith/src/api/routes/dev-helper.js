// dev-helper.js - Routes for Developer Helper Agent
// Issue #2442 - API endpoints for scanning PRs and extracting future work items

import express from 'express'
import { Octokit } from '@octokit/rest'
import { TokenBasedLLMCoordinator } from '../../core/TokenBasedLLMCoordinator.js'
import { pool } from '../../config/database.js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const router = express.Router()

// Initialize LLM coordinator
const llmCoordinator = new TokenBasedLLMCoordinator({ db: pool })

// Data directory for storing scanned PRs and extracted ideas
const dataDir = path.join(__dirname, '../../data/dev-helper')

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(dataDir, { recursive: true })
  } catch (error) {
    console.error('Failed to create data directory:', error)
  }
}

ensureDataDir()

/**
 * Extract future work sections from PR body
 * Looks for sections like:
 * - "Будущие улучшения"
 * - "Future Improvements"
 * - "Будущая интеграция"
 * - "🔮 Будущие улучшения"
 * - "## Next Steps"
 * - "TODO"
 */
function extractFutureWorkSections(prBody) {
  if (!prBody) return []

  const sections = []

  // Patterns for future work section headers
  const sectionHeaders = [
    /##?\s*(?:🔮\s*)?Будущие улучшения/gi,
    /##?\s*Будущая интеграция/gi,
    /##?\s*Future Improvements?/gi,
    /##?\s*Future Integration/gi,
    /##?\s*Next Steps/gi,
    /##?\s*TODO/gi,
    /##?\s*To[- ]?Do/gi
  ]

  // Split by lines
  const lines = prBody.split('\n')
  let currentSection = null
  let currentItems = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Check if this is a future work section header
    const isHeader = sectionHeaders.some(pattern => pattern.test(line))

    if (isHeader) {
      // Save previous section if exists
      if (currentSection && currentItems.length > 0) {
        sections.push({
          title: currentSection,
          items: currentItems
        })
      }

      // Start new section
      currentSection = line.replace(/^#+\s*/, '').trim()
      currentItems = []
      continue
    }

    // If we're in a future work section
    if (currentSection) {
      // Check if we hit another section header (end of future work section)
      if (line.startsWith('##') && !sectionHeaders.some(p => p.test(line))) {
        // Save current section and stop collecting
        if (currentItems.length > 0) {
          sections.push({
            title: currentSection,
            items: currentItems
          })
        }
        currentSection = null
        currentItems = []
        continue
      }

      // Extract list items (-, *, 1., etc.)
      const listItemMatch = line.match(/^[\s-]*(?:[-*+]|\d+\.)\s+(.+)$/)
      if (listItemMatch) {
        const item = listItemMatch[1].trim()
        // Remove checkboxes [ ] or [x]
        const cleanItem = item.replace(/^\[[ x]\]\s*/, '').trim()
        if (cleanItem) {
          currentItems.push(cleanItem)
        }
      }
      // Also capture non-list lines if they're not empty and not starting with special chars
      else if (line && !line.startsWith('#') && !line.startsWith('```') && !line.startsWith('---')) {
        // Only add if it looks like a meaningful sentence
        if (line.length > 10 && /[а-яА-ЯёЁa-zA-Z]/.test(line)) {
          currentItems.push(line)
        }
      }
    }
  }

  // Save last section
  if (currentSection && currentItems.length > 0) {
    sections.push({
      title: currentSection,
      items: currentItems
    })
  }

  return sections
}

/**
 * GET /api/dev-helper/scan-prs
 * Scan merged PRs from a repository and extract future work items
 */
router.get('/scan-prs', async (req, res, next) => {
  try {
    const { owner, repo, limit = 50, githubToken } = req.query

    if (!owner || !repo) {
      return res.status(400).json({
        error: 'Repository owner and name are required',
        example: '?owner=unidel2035&repo=dronedoc2025'
      })
    }

    // Initialize Octokit
    const octokit = new Octokit({
      auth: githubToken || process.env.GITHUB_TOKEN
    })

    // Fetch merged PRs
    const { data: prs } = await octokit.pulls.list({
      owner,
      repo,
      state: 'closed',
      per_page: Math.min(parseInt(limit), 100),
      sort: 'updated',
      direction: 'desc'
    })

    // Filter only merged PRs
    const mergedPRs = prs.filter(pr => pr.merged_at)

    // Extract future work items from each PR
    const results = mergedPRs.map(pr => {
      const futureWorkSections = extractFutureWorkSections(pr.body)

      return {
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        merged_at: pr.merged_at,
        author: pr.user.login,
        futureWorkSections,
        totalItems: futureWorkSections.reduce((sum, section) => sum + section.items.length, 0)
      }
    })

    // Filter only PRs with future work items
    const prsWithFutureWork = results.filter(pr => pr.totalItems > 0)

    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `scan-${owner}-${repo}-${timestamp}.json`
    await fs.writeFile(
      path.join(dataDir, filename),
      JSON.stringify({
        repository: `${owner}/${repo}`,
        scanned_at: new Date().toISOString(),
        total_prs_scanned: mergedPRs.length,
        prs_with_future_work: prsWithFutureWork.length,
        results: prsWithFutureWork
      }, null, 2)
    )

    res.json({
      success: true,
      data: {
        repository: `${owner}/${repo}`,
        total_prs_scanned: mergedPRs.length,
        prs_with_future_work: prsWithFutureWork.length,
        results: prsWithFutureWork,
        saved_to: filename
      }
    })
  } catch (error) {
    console.error('Error scanning PRs:', error)
    next(error)
  }
})

/**
 * POST /api/dev-helper/analyze-item
 * Use AI to analyze a future work item and generate issue details
 */
router.post('/analyze-item', async (req, res, next) => {
  try {
    const { item, context, accessToken, prUrl } = req.body

    if (!item) {
      return res.status(400).json({ error: 'Item text is required' })
    }

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required for AI analysis' })
    }

    // Construct prompt for AI
    const prompt = `Ты - помощник для создания GitHub issues из пунктов "будущих улучшений" в PR.

Контекст PR: ${prUrl || 'не указан'}
${context ? `Дополнительный контекст: ${context}` : ''}

Пункт для анализа: "${item}"

Проанализируй этот пункт и создай структурированное описание для GitHub issue:

1. **Заголовок issue** (краткий, понятный, на русском языке)
2. **Описание** (детальное описание задачи, что нужно сделать)
3. **Приоритет** (low/medium/high)
4. **Категория** (enhancement, bug, feature, documentation, refactor, test)
5. **Примерная сложность** (1-10, где 1 - простая задача, 10 - очень сложная)
6. **Теги** (список подходящих тегов для issue)

Формат ответа - строго JSON:
{
  "title": "...",
  "description": "...",
  "priority": "...",
  "category": "...",
  "complexity": N,
  "tags": ["tag1", "tag2", ...]
}

Ответ:`

    // Call LLM
    const result = await llmCoordinator.chatWithToken(
      accessToken,
      null, // Will use default model
      prompt,
      {
        application: 'DevHelper',
        operation: 'analyze_future_work_item',
        temperature: 0.3,
        maxTokens: 1000
      }
    )

    // Parse AI response
    let analysis
    try {
      // Try to extract JSON from response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in AI response')
      }
    } catch (parseError) {
      // Fallback: return raw response
      analysis = {
        title: item.substring(0, 100),
        description: result.content,
        priority: 'medium',
        category: 'enhancement',
        complexity: 5,
        tags: ['future-work']
      }
    }

    res.json({
      success: true,
      data: {
        original_item: item,
        analysis,
        ai_response: result.content,
        tokens_used: result.usage
      }
    })
  } catch (error) {
    console.error('Error analyzing item:', error)
    next(error)
  }
})

/**
 * POST /api/dev-helper/create-issues
 * Create GitHub issues from analyzed future work items
 */
router.post('/create-issues', async (req, res, next) => {
  try {
    const { owner, repo, items, githubToken } = req.body

    if (!owner || !repo) {
      return res.status(400).json({ error: 'Repository owner and name are required' })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' })
    }

    if (!githubToken) {
      return res.status(400).json({ error: 'GitHub token is required to create issues' })
    }

    const octokit = new Octokit({ auth: githubToken })

    const results = []

    for (const item of items) {
      try {
        const { title, description, tags, prUrl } = item

        // Construct issue body
        let body = description || ''

        if (prUrl) {
          body += `\n\n---\n*Создано из будущих улучшений PR: ${prUrl}*`
        }

        body += '\n\n*🤖 Автоматически создано Developer Helper Agent*'

        // Create issue
        const { data: issue } = await octokit.issues.create({
          owner,
          repo,
          title: title || 'Без названия',
          body,
          labels: tags || ['future-work']
        })

        results.push({
          success: true,
          issue_number: issue.number,
          issue_url: issue.html_url,
          title: issue.title
        })
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          item
        })
      }
    }

    res.json({
      success: true,
      data: {
        created: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      }
    })
  } catch (error) {
    console.error('Error creating issues:', error)
    next(error)
  }
})

/**
 * GET /api/dev-helper/scans
 * Get list of previous scans
 */
router.get('/scans', async (req, res, next) => {
  try {
    const files = await fs.readdir(dataDir)
    const scanFiles = files.filter(f => f.startsWith('scan-') && f.endsWith('.json'))

    const scans = await Promise.all(
      scanFiles.map(async (file) => {
        const content = await fs.readFile(path.join(dataDir, file), 'utf-8')
        const data = JSON.parse(content)
        return {
          filename: file,
          repository: data.repository,
          scanned_at: data.scanned_at,
          total_prs_scanned: data.total_prs_scanned,
          prs_with_future_work: data.prs_with_future_work,
          total_items: data.results.reduce((sum, pr) => sum + pr.totalItems, 0)
        }
      })
    )

    // Sort by date, newest first
    scans.sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at))

    res.json({
      success: true,
      data: scans
    })
  } catch (error) {
    console.error('Error listing scans:', error)
    next(error)
  }
})

/**
 * GET /api/dev-helper/scans/:filename
 * Get details of a specific scan
 */
router.get('/scans/:filename', async (req, res, next) => {
  try {
    const { filename } = req.params

    // Security: prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' })
    }

    const filePath = path.join(dataDir, filename)
    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content)

    res.json({
      success: true,
      data
    })
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Scan not found' })
    }
    console.error('Error reading scan:', error)
    next(error)
  }
})

export default router
