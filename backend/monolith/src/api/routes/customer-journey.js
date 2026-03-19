import express from 'express'
import axios from 'axios'
import FormData from 'form-data'
import multer from 'multer'
import fs from 'fs'
import zlib from 'zlib'
import { promisify } from 'util'
import { TokenBasedLLMCoordinator } from '../../core/TokenBasedLLMCoordinator.js'
import { agentsForJourney } from '../../data/agentsForJourney.js'
import {
  authenticateIntegram,
  fetchAllCompanyData,
  saveCompanyDataToIntegram
} from '../../services/dataNewtonIntegram.js'
import { HRAnalysisAgent } from '../../agents/HRAnalysisAgent.js'
import { createEndpointLimiter } from '../../middleware/security/rateLimiter.js'
import logger from '../../utils/logger.js'

const router = express.Router()
const gunzip = promisify(zlib.gunzip)

// Import EGRUL extractor functions
import { extractAllFields, getOrganizationName } from '../../utils/egrulExtractor.js'

// Helper function to save EGRUL data to Integram
async function saveEgrulToIntegram(inn, egrulData, extractedInfo) {
  logger.info({ inn }, '[ЕГРЮЛ → Integram] ===== FUNCTION CALLED =====')

  try {
    // Extract ALL 59 fields using the comprehensive extractor
    logger.info({ inn }, '[ЕГРЮЛ → Integram] Calling extractAllFields...')
    const allFields = extractAllFields(egrulData)
    const orgName = getOrganizationName(egrulData)

    logger.info({ inn, fieldsExtracted: Object.keys(allFields).length }, '[ЕГРЮЛ → Integram] Extracted fields')

    // Authenticate with Integram
    const login = process.env.INTEGRAM_SYSTEM_USERNAME || 'd'
    const password = process.env.INTEGRAM_SYSTEM_PASSWORD || 'd'
    const auth = await authenticateIntegram(login, password)

    // Check if organization already exists by INN (параметр 214636)
    // Use /object/ endpoint (works correctly) instead of _d_list (returns only menu)
    const searchUrl = `https://dronedoc.ru/my/object/197000?JSON_KV&F_198195=${inn}`

    const searchResponse = await axios.get(searchUrl, {
      headers: {
        'X-Authorization': auth.token
      }
    })

    let orgId
    const existingOrgs = searchResponse.data?.object || []

    if (existingOrgs.length > 0) {
      // Update existing organization
      orgId = existingOrgs[0].id
      logger.info({ orgId, inn }, '[ЕГРЮЛ → Integram] Updating existing organization')
    } else {
      // Create new organization
      const createUrl = `https://dronedoc.ru/my/_m_new/197000?JSON_KV`
      const formData = new URLSearchParams()
      formData.append('_xsrf', auth.xsrf)
      formData.append('t197000', orgName) // Organization name
      formData.append('up', '1') // Independent object

      const createResponse = await axios.post(createUrl, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Authorization': auth.token
        }
      })

      orgId = createResponse.data?.id || createResponse.data?.obj
      if (!orgId) {
        logger.error({ response: createResponse.data }, '[ЕГРЮЛ → Integram] Failed to get org ID from response')
        throw new Error('Failed to create organization - no ID returned')
      }

      logger.info({ orgId, inn, name: orgName }, '[ЕГРЮЛ → Integram] Created new organization')
    }

    // Update organization basic fields in organization table
    const updateUrl = `https://dronedoc.ru/my/_m_set/${orgId}?JSON_KV`
    const updateData = new URLSearchParams()
    updateData.append('_xsrf', auth.xsrf)

    // Save INN, OGRN, KPP to organization table basic fields
    if (allFields['214636']) updateData.append('t198195', allFields['214636']) // ИНН
    if (allFields['214634']) updateData.append('t198239', allFields['214634']) // ОГРН
    if (allFields['214637']) updateData.append('t198266', allFields['214637']) // КПП
    if (allFields['214641']) updateData.append('t198267', allFields['214641']) // Краткое наименование
    if (allFields['214649']) updateData.append('t198268', allFields['214649']) // Полный адрес

    // Руководитель (ФИО)
    const head = [
      allFields['214671'], // Фамилия
      allFields['214672'], // Имя
      allFields['214673']  // Отчество
    ].filter(Boolean).join(' ')
    if (head) updateData.append('t198272', head)

    // Уставный капитал
    if (allFields['214670']) updateData.append('t198271', allFields['214670'])

    await axios.post(updateUrl, updateData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Authorization': auth.token
      }
    }).catch(err => {
      logger.warn({ error: err.message }, '[ЕГРЮЛ → Integram] Failed to update organization basic fields (non-critical)')
    })

    // Delete existing ЕГРЮЛ requisites for this organization to avoid duplicates
    try {
      const existingReqsUrl = `https://dronedoc.ru/my/_d_list/209592?JSON_KV`
      const existingReqsParams = new URLSearchParams()
      existingReqsParams.append('F_U', orgId) // Filter by parent (organization) ID

      const existingReqsResponse = await axios.post(existingReqsUrl, existingReqsParams.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Authorization': auth.token
        }
      })

      const existingReqs = existingReqsResponse.data?.object || []
      for (const req of existingReqs) {
        const deleteUrl = `https://dronedoc.ru/my/_m_delete/${req.id}?JSON_KV`
        const deleteParams = new URLSearchParams()
        deleteParams.append('_xsrf', auth.xsrf)

        await axios.post(deleteUrl, deleteParams.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Authorization': auth.token
          }
        }).catch(err => {
          logger.warn({ reqId: req.id, error: err.message }, '[ЕГРЮЛ → Integram] Failed to delete old requisite')
        })
      }

      if (existingReqs.length > 0) {
        logger.info({ deleted: existingReqs.length }, '[ЕГРЮЛ → Integram] Deleted old requisites')
      }
    } catch (err) {
      logger.warn({ error: err.message }, '[ЕГРЮЛ → Integram] Failed to clean up old requisites (non-critical)')
    }

    // Create ALL 59 ЕГРЮЛ requisites in Реквизит table (209592)
    // Parameters 214633-214691 linked to domain 214622 (ЕГРЮЛ)
    let savedCount = 0
    let skippedCount = 0

    for (const [paramId, value] of Object.entries(allFields)) {
      if (!value || value === 'null' || value === '') {
        skippedCount++
        continue // Skip empty values
      }

      const reqUrl = `https://dronedoc.ru/my/_m_new/209592?JSON_KV`
      const reqData = new URLSearchParams()
      reqData.append('_xsrf', auth.xsrf)
      reqData.append('t209592', String(value).substring(0, 100)) // Название объекта (короткое)
      reqData.append('t209595', paramId) // Параметр API (reference to 209590)
      reqData.append('t209597', String(value)) // Значение (MEMO - полные данные)
      reqData.append('up', orgId) // Subordinate to organization

      await axios.post(reqUrl, reqData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Authorization': auth.token
        }
      }).then(() => {
        savedCount++
      }).catch(err => {
        logger.warn({ paramId, value: String(value).substring(0, 100), error: err.message },
          '[ЕГРЮЛ → Integram] Failed to create requisite')
        skippedCount++
      })
    }

    logger.info({
      orgId,
      inn,
      name: orgName,
      saved: savedCount,
      skipped: skippedCount,
      total: Object.keys(allFields).length
    }, '[ЕГРЮЛ → Integram] Successfully saved data')

    return {
      success: true,
      orgId,
      requisitesSaved: savedCount,
      requisitesSkipped: skippedCount,
      totalFields: Object.keys(allFields).length
    }
  } catch (error) {
    logger.error({ inn, error: error.message, stack: error.stack }, '[ЕГРЮЛ → Integram] Error saving data')
    return { success: false, error: error.message }
  }
}

// In-memory cache for ЕГРЮЛ data with 24-hour TTL
const egrulCache = new Map()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

// Rate limiter for ЕГРЮЛ endpoint (20 requests per hour)
const egrulRateLimiter = createEndpointLimiter('egrul', {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: 'Превышен лимит запросов к ЕГРЮЛ API. Попробуйте через час.'
})

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/plain'
    ]

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`))
    }
  }
})

/**
 * POST /api/customer-journey/salary-estimate
 * Estimate salary using hh.ru API
 */
router.post('/salary-estimate', async (req, res) => {
  try {
    const { functionDescription, region } = req.body

    if (!functionDescription) {
      return res.status(400).json({
        success: false,
        error: 'functionDescription is required'
      })
    }

    // Map region names to hh.ru area codes
    const regionMap = {
      'Москва': 1,
      'Санкт-Петербург': 2,
      'Московская область': 2019,
      'Екатеринбург': 3,
      'Новосибирск': 4,
      'Удмуртская Республика': 18,
      'Россия': 113
    }

    const areaId = regionMap[region] || 113 // Default to Russia

    // Search vacancies on hh.ru
    const hhResponse = await axios.get('https://api.hh.ru/vacancies', {
      params: {
        text: functionDescription,
        area: areaId,
        per_page: 100,
        only_with_salary: true
      },
      headers: {
        'User-Agent': 'DronDoc/1.0 (https://drondoc.ru)'
      },
      timeout: 15000
    })

    const vacancies = hhResponse.data.items || []

    // Calculate salary statistics
    const salaries = []
    let minSalary = Infinity
    let maxSalary = 0
    let currency = 'RUR'

    for (const vacancy of vacancies) {
      if (!vacancy.salary) continue

      const { from, to, currency: curr } = vacancy.salary
      currency = curr || currency

      let salaryValue
      if (from && to) {
        salaryValue = (from + to) / 2
      } else if (from) {
        salaryValue = from
      } else if (to) {
        salaryValue = to
      } else {
        continue
      }

      salaries.push(salaryValue)

      if (from && from < minSalary) minSalary = from
      if (to && to > maxSalary) maxSalary = to
    }

    if (salaries.length === 0) {
      return res.json({
        success: true,
        data: {
          averageSalary: 0,
          minSalary: 0,
          maxSalary: 0,
          vacanciesCount: vacancies.length,
          withSalaryCount: 0,
          source: 'hh.ru',
          message: 'No vacancies with salary information found'
        }
      })
    }

    // Calculate average and median
    const average = Math.round(
      salaries.reduce((sum, val) => sum + val, 0) / salaries.length
    )

    const sorted = [...salaries].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid]

    res.json({
      success: true,
      data: {
        averageSalary: average,
        medianSalary: median,
        minSalary: minSalary === Infinity ? 0 : minSalary,
        maxSalary: maxSalary,
        vacanciesCount: vacancies.length,
        withSalaryCount: salaries.length,
        source: 'hh.ru',
        currency
      }
    })
  } catch (error) {
    console.error('Error estimating salary:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to estimate salary'
    })
  }
})

/**
 * POST /api/customer-journey/process-documents
 * Process uploaded documents with AI
 */
router.post('/process-documents', upload.array('documents', 5), async (req, res) => {
  try {
    const files = req.files
    const context = req.body.context ? JSON.parse(req.body.context) : {}

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      })
    }

    // TODO: Extract text from files (PDF, DOCX, etc.)
    // For now, simulate extraction
    const documentTexts = files.map(file => ({
      fileName: file.originalname,
      size: file.size,
      type: file.mimetype,
      extractedText: `[Text extracted from ${file.originalname}]`
    }))

    // Use AI to analyze documents
    const db = req.app.get('db')
    const coordinator = new TokenBasedLLMCoordinator({ db })

    // Get default system token for AI operations
    const defaultModelQuery = 'SELECT id FROM ai_models WHERE provider = ? AND is_default = 1 LIMIT 1'
    const defaultModel = await new Promise((resolve, reject) => {
      db.get(defaultModelQuery, ['deepseek'], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })

    if (!defaultModel) {
      throw new Error('Default AI model not configured')
    }

    const prompt = `
Проанализируй следующие документы об организации и извлеки структурированные данные.

Документы:
${documentTexts.map(doc => `Файл: ${doc.fileName}\n${doc.extractedText}`).join('\n\n')}

Контекст:
${JSON.stringify(context, null, 2)}

Извлеки и верни JSON со следующими полями:
{
  "businessDescription": "краткое описание бизнеса",
  "keyProcesses": ["процесс1", "процесс2", ...],
  "painPoints": ["проблема1", "проблема2", ...],
  "currentSystems": ["система1", "система2", ...],
  "employeeBreakdown": [
    {"function": "название функции", "count": число},
    ...
  ],
  "financialData": {
    "revenue": число_или_null,
    "costs": число_или_null
  },
  "summary": "краткое резюме анализа"
}

Верни только JSON, без дополнительного текста.
`

    // Use system token for AI operations
    const systemTokenQuery = 'SELECT id FROM ai_access_tokens WHERE token_type = ? AND is_active = 1 LIMIT 1'
    const systemToken = await new Promise((resolve, reject) => {
      db.get(systemTokenQuery, ['system'], (err, row) => {
        if (err) reject(err)
        else resolve(row?.id)
      })
    })

    if (!systemToken) {
      throw new Error('System AI token not found')
    }

    const aiResponse = await coordinator.chatWithToken(
      systemToken,
      defaultModel.id,
      prompt,
      {
        application: 'CustomerJourney',
        operation: 'document-processing',
        temperature: 0.2,
        maxTokens: 2048
      }
    )

    // Parse AI response
    let extractedData
    try {
      // Extract JSON from response (AI might wrap it in markdown)
      const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/)
      extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      extractedData = {
        summary: aiResponse.content,
        businessDescription: '',
        keyProcesses: [],
        painPoints: [],
        currentSystems: [],
        employeeBreakdown: [],
        financialData: {}
      }
    }

    res.json({
      success: true,
      data: {
        extractedData,
        filesProcessed: files.length,
        tokensUsed: aiResponse.usage?.total_tokens || 0
      }
    })
  } catch (error) {
    console.error('Error processing documents:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process documents'
    })
  }
})

/**
 * POST /api/customer-journey/generate-proposal
 * Generate commercial proposal with AI
 */
router.post('/generate-proposal', async (req, res) => {
  try {
    const { journeyData, options = {} } = req.body

    if (!journeyData) {
      return res.status(400).json({
        success: false,
        error: 'journeyData is required'
      })
    }

    // Validate required journey data
    if (!journeyData.organization?.name) {
      return res.status(400).json({
        success: false,
        error: 'Organization name is required'
      })
    }

    if (!journeyData.selectedAgents || journeyData.selectedAgents.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one agent must be selected'
      })
    }

    // Build prompt for AI
    const org = journeyData.organization
    const agents = journeyData.selectedAgents
    const roi = journeyData.roiData || {}
    const docs = journeyData.documentsData || {}

    const prompt = `
Создай профессиональное коммерческое предложение для внедрения ИИ-агентов в формате Markdown.

КОНТЕКСТ ОРГАНИЗАЦИИ:
- Название: ${org.name}
- ИНН: ${org.inn || 'не указан'}
- Регион: ${org.region || 'не указан'}
- Отрасль: ${org.industry || 'не указано'}
- Количество сотрудников: ${org.employeeCount || 'не указано'}
${docs.businessDescription ? `- Описание бизнеса: ${docs.businessDescription}` : ''}
${docs.painPoints && docs.painPoints.length > 0 ? `- Ключевые проблемы: ${docs.painPoints.join(', ')}` : ''}

ТЕКУЩИЕ ЗАТРАТЫ:
- Функция: ${journeyData.agentRequest?.description || 'не указана'}
- Количество сотрудников: ${journeyData.salaryData?.employeeCount || 'не указано'}
- Зарплата (брутто): ${journeyData.salaryData?.grossSalary?.toLocaleString() || '0'} руб/мес
- Налоги работодателя: ${journeyData.salaryData?.employerTaxes?.toLocaleString() || '0'} руб/мес
- Итого затраты: ${journeyData.salaryData?.totalMonthlyCosts?.toLocaleString() || roi.currentCosts?.toLocaleString() || '0'} руб/мес

ПРЕДЛАГАЕМЫЕ АГЕНТЫ:
${agents.map(a => `- **${a.name}**: ${a.description}`).join('\n')}

ЭКОНОМИЧЕСКИЙ ЭФФЕКТ (ROI):
- Текущие затраты: ${roi.currentCosts?.toLocaleString() || '0'} руб/мес
- Затраты с агентами: ${roi.agentCosts?.toLocaleString() || '0'} руб/мес
- Экономия: ${roi.savings?.toLocaleString() || '0'} руб/мес (${roi.savingsPercent || 0}%)
- Срок окупаемости: ${roi.paybackDays || 0} дней

Создай КП в следующей структуре:

1. **Введение** (2-3 абзаца о проблеме клиента)
2. **Текущая ситуация** (детальный анализ затрат и проблем)
3. **Предлагаемое решение** (описание каждого агента и его функций)
4. **Экономический эффект** (подробный расчет ROI и экономии)
5. **План внедрения** (этапы с конкретными сроками)
6. **Стоимость и условия** (прозрачная структура ценообразования)
7. **Заключение** (призыв к действию)

Используй профессиональный деловой стиль. Будь конкретным и убедительным. Используй таблицы и списки для структурирования информации. Добавь раздел "Гарантии и поддержка" в конце.

Верни готовое КП в формате Markdown.
`

    // Use AI to generate proposal
    const db = req.app.get('db')
    const coordinator = new TokenBasedLLMCoordinator({ db })

    const defaultModelQuery = 'SELECT id FROM ai_models WHERE provider = ? AND is_default = 1 LIMIT 1'
    const defaultModel = await new Promise((resolve, reject) => {
      db.get(defaultModelQuery, ['deepseek'], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })

    if (!defaultModel) {
      throw new Error('Default AI model not configured')
    }

    const systemTokenQuery = 'SELECT id FROM ai_access_tokens WHERE token_type = ? AND is_active = 1 LIMIT 1'
    const systemToken = await new Promise((resolve, reject) => {
      db.get(systemTokenQuery, ['system'], (err, row) => {
        if (err) reject(err)
        else resolve(row?.id)
      })
    })

    if (!systemToken) {
      throw new Error('System AI token not found')
    }

    const aiResponse = await coordinator.chatWithToken(
      systemToken,
      defaultModel.id,
      prompt,
      {
        application: 'CustomerJourney',
        operation: 'proposal-generation',
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 4096
      }
    )

    res.json({
      success: true,
      data: {
        proposal: aiResponse.content,
        generatedAt: new Date().toISOString(),
        modelUsed: 'deepseek-chat',
        tokensUsed: aiResponse.usage?.total_tokens || 0
      }
    })
  } catch (error) {
    console.error('Error generating proposal:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate proposal'
    })
  }
})

/**
 * PUT /api/customer-journey/organizations/:id
 * Update organization data (placeholder - adapt to your Integram schema)
 */
router.put('/organizations/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { fullName, inn, address, region, okved } = req.body

    // TODO: Implement Integram update
    // This is a placeholder - adapt to your Integram integration
    res.json({
      success: true,
      data: {
        id,
        fullName,
        inn,
        address,
        region,
        okved,
        updatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error updating organization:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update organization'
    })
  }
})

/**
 * POST /api/customer-journey/organizations
 * Create a new organization in Integram table 197000
 */
router.post('/organizations', async (req, res) => {
  console.log('[Organizations] POST /organizations endpoint called')
  console.log('[Organizations] Request body:', JSON.stringify(req.body))

  try {
    const { name, inn, ogrn, kpp, address, industry, region, employeeCount, userId } = req.body

    if (!name || !inn) {
      console.log('[Organizations] ERROR: Missing name or INN')
      return res.status(400).json({
        success: false,
        error: 'Name and INN are required'
      })
    }

    console.log(`[Organizations] Creating organization: ${name} (ИНН: ${inn})`)

    // Authenticate with Integram using registration user credentials
    const login = process.env.INTEGRAM_REGISTRATION_USERNAME || 'api_reg'
    const password = process.env.INTEGRAM_REGISTRATION_PASSWORD || 'ca84qkcx'
    console.log(`[Organizations] Authenticating with Integram: login=${login}`)

    let auth
    try {
      auth = await authenticateIntegram(login, password)
      console.log('[Organizations] ✅ Integram authentication successful')
    } catch (authError) {
      console.error('[Organizations] ❌ Integram authentication failed:', authError.message)
      console.error('[Organizations] Auth error details:', authError.response?.data || authError)
      throw authError
    }

    // Create organization in Integram table 197000
    const createUrl = `https://dronedoc.ru/my/_m_new/197000?JSON_KV`
    const formData = new URLSearchParams()
    formData.append('_xsrf', auth.xsrf)  // CRITICAL: Must include CSRF token!
    formData.append('t197000', name)
    formData.append('up', '1')

    // Add requisites
    if (inn) formData.append('t198195', inn)        // ИНН
    if (ogrn) formData.append('t198239', ogrn)      // ОГРН
    if (kpp) formData.append('t198266', kpp)        // КПП
    if (address) formData.append('t198268', address) // Полный адрес
    if (employeeCount) formData.append('t209401', String(employeeCount)) // Кол-во сотрудников

    // Link to user if provided
    if (userId) formData.append('t198172', String(userId)) // User reference

    const createResponse = await axios.post(createUrl, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Authorization': auth.token
      }
    })

    console.log('[Organizations] Create response:', createResponse.data)

    const orgId = createResponse.data?.id || createResponse.data?.obj

    if (!orgId) {
      throw new Error('Failed to create organization - no ID returned')
    }

    console.log(`[Organizations] ✅ Organization created with ID: ${orgId}`)

    // Fetch all company data from DataNewton API (10 endpoints, 160+ parameters)
    console.log(`[Organizations] Fetching company data from DataNewton API for INN: ${inn}`)
    const companyData = await fetchAllCompanyData(inn, auth)
    console.log('[Organizations] DataNewton data fetched:', {
      counterparty: !!companyData.counterparty,
      links: !!companyData.links,
      risks: !!companyData.risks,
      scoring: !!companyData.scoring,
      finance: !!companyData.finance,
      taxInfo: !!companyData.taxInfo,
      bankruptcy: !!companyData.bankruptcy,
      inspections: !!companyData.inspections,
      governmentContracts: !!companyData.governmentContracts,
      arbitrationCases: !!companyData.arbitrationCases
    })

    // Save all company data to Integram table 209592 (Реквизит)
    console.log(`[Organizations] Saving 160+ requisites to table 209592 for organization ${orgId}`)
    const saveResult = await saveCompanyDataToIntegram(orgId, companyData, auth)
    console.log(`[Organizations] ✅ Saved ${saveResult.savedRequisites.length} requisites`)
    if (saveResult.errors.length > 0) {
      console.warn(`[Organizations] ⚠️ ${saveResult.errors.length} errors during save:`, saveResult.errors)
    }

    res.json({
      success: true,
      data: {
        id: orgId,
        name,
        inn,
        ogrn,
        kpp,
        address,
        industry,
        region,
        employeeCount,
        requisitesSaved: saveResult.savedRequisites.length,
        requisitesErrors: saveResult.errors.length,
        organizationNameUpdated: saveResult.organizationNameUpdated
      }
    })
  } catch (error) {
    console.error('[Organizations] Error creating organization:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create organization'
    })
  }
})

/**
 * GET /api/customer-journey/organizations/user/:userId
 * Get organization linked to a user from Integram
 */
router.get('/organizations/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params

    console.log(`[Organizations] Getting organization for user: ${userId}`)

    // Authenticate with Integram using registration user credentials
    const login = process.env.INTEGRAM_REGISTRATION_USERNAME || 'api_reg'
    const password = process.env.INTEGRAM_REGISTRATION_PASSWORD || 'ca84qkcx'
    const auth = await authenticateIntegram(login, password)

    // Search for organization with this user reference (requisite 198172)
    const searchUrl = `https://dronedoc.ru/my/object/197000?JSON_KV&F_198172=${userId}`

    const searchResponse = await axios.get(searchUrl, {
      headers: {
        'X-Authorization': auth.token
      }
    })

    const objects = searchResponse.data?.object || []
    const reqs = searchResponse.data?.reqs || {}

    if (objects.length === 0) {
      console.log(`[Organizations] No organization found for user ${userId}`)
      return res.status(404).json({
        success: false,
        error: 'No organization found for this user'
      })
    }

    // Get the first organization
    const org = objects[0]
    const orgReqs = reqs[org.id] || {}

    console.log(`[Organizations] ✅ Found organization: ${org.val} (ID: ${org.id})`)

    res.json({
      success: true,
      data: {
        id: org.id,
        name: org.val,
        inn: orgReqs['198195'] || null,
        ogrn: orgReqs['198239'] || null,
        kpp: orgReqs['198266'] || null,
        address: orgReqs['198268'] || null,
        employeeCount: orgReqs['209401'] || null,
        industry: orgReqs['209388'] || null,
        monthlySalaries: orgReqs['209399'] || null
      }
    })
  } catch (error) {
    console.error('[Organizations] Error getting user organization:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get organization'
    })
  }
})

/**
 * GET /api/customer-journey/search-datanewton/:inn
 * Search for company information by INN using DataNewton API
 * Supports both 10-digit (company) and 12-digit (individual entrepreneur) INNs
 */
router.get('/search-datanewton/:inn', async (req, res) => {
  fs.appendFileSync('/tmp/datanewton-debug.log', `[${new Date().toISOString()}] ENDPOINT CALLED with INN: ${req.params.inn}\n`);
  console.error('[DataNewton] ===== ENDPOINT CALLED =====')
  try {
    const { inn } = req.params
    console.error(`[DataNewton] Received INN parameter: ${inn}`)

    // Validate INN format - allow both 10 and 12 digits
    if (!inn || !/^\d{10,12}$/.test(inn)) {
      console.error(`[DataNewton] Invalid INN format: ${inn}`)
      fs.appendFileSync('/tmp/datanewton-debug.log', `[${new Date().toISOString()}] Invalid INN format: ${inn}\n`);
      return res.status(400).json({
        success: false,
        error: 'Invalid INN format. Must be 10 or 12 digits'
      })
    }

    fs.appendFileSync('/tmp/datanewton-debug.log', `[${new Date().toISOString()}] INN validated: ${inn}\n`);
    console.error(`[DataNewton] Searching company with INN: ${inn}`)

    // Authenticate with Integram for API key rotation
    const login = process.env.INTEGRAM_REGISTRATION_USERNAME || 'api_reg'
    const password = process.env.INTEGRAM_REGISTRATION_PASSWORD || 'ca84qkcx'
    fs.appendFileSync('/tmp/datanewton-debug.log', `[${new Date().toISOString()}] Authenticating with Integram...\n`);
    const auth = await authenticateIntegram(login, password)
    fs.appendFileSync('/tmp/datanewton-debug.log', `[${new Date().toISOString()}] Authenticated. Fetching company data...\n`);

    // Use DataNewton API to fetch company data
    const companyData = await fetchAllCompanyData(inn, auth)
    fs.appendFileSync('/tmp/datanewton-debug.log', `[${new Date().toISOString()}] fetchAllCompanyData result: ${JSON.stringify(companyData).substring(0, 200)}\n`);

    if (!companyData || !companyData.counterparty) {
      console.log(`[DataNewton] Company not found for INN: ${inn}`)
      return res.status(404).json({
        success: false,
        error: 'Company not found with provided INN',
        debug: {
          inn,
          source: 'DataNewton API'
        }
      })
    }

    const cp = companyData.counterparty

    console.error(`[DataNewton] Raw counterparty:`, JSON.stringify(cp).substring(0, 500))

    // Determine if this is ИП (individual entrepreneur) - 12 digit INN
    const isIP = inn.length === 12 || cp.individual

    console.error(`[DataNewton] isIP: ${isIP}, inn.length: ${inn.length}, has individual: ${!!cp.individual}`)
    console.error(`[DataNewton] Has company: ${!!cp.company}, has company_names: ${!!cp.company?.company_names}`)
    if (cp.company?.company_names) {
      console.error(`[DataNewton] company_names:`, JSON.stringify(cp.company.company_names))
    }

    // Get name - for ИП use individual.fio, for ЮЛ use company name
    let companyName = 'Unknown'
    if (isIP && cp.individual?.fio) {
      companyName = `ИП ${cp.individual.fio}`
      console.error(`[DataNewton] Using individual.fio: ${companyName}`)
    } else if (cp.company?.company_names) {
      companyName = cp.company.company_names.full_name || cp.company.company_names.short_name || 'Unknown'
      console.error(`[DataNewton] Using company_names: ${companyName}`)
    } else {
      companyName = cp.ПолноеНаимование || cp.name || cp.НаимПолнЮЛ || cp.short_name || 'Unknown'
      console.error(`[DataNewton] Using fallback fields: ${companyName}`)
    }

    // Map DataNewton response to expected format
    const item = {
      НаимПолнЮЛ: companyName,
      НаимСокрНаимЮЛ: isIP ? cp.individual?.fio : (cp.company?.company_names?.short_name || cp.СокращенноеНаименование || cp.short_name || cp.НаимСокрЮЛ || null),
      ИНН: cp.ИНН || cp.inn || inn,
      ОГРН: cp.ОГРН || cp.ogrn || null,
      КПП: isIP ? null : (cp.company?.kpp || cp.КПП || cp.kpp || null),
      АдрМНГосРег: cp.company?.address?.unrestricted_value || cp.Адрес || cp.address || null,
      Регион: cp.company?.address?.data?.region || cp.Регион || cp.region || null,
      ОКВЭДОсн: cp.company?.okveds?.[0]?.code || cp.ОКВЭДОсн || cp.okved || null,
      ВидДеят: cp.company?.okveds?.[0]?.name || cp.ВидДеятельности || cp.activity || null,
      ДатаРег: isIP ? cp.individual?.registration_date : (cp.company?.registration_date || cp.ДатаРегистрации || cp.registration_date || null),
      Статус: isIP ? cp.individual?.status?.status_rus_short : (cp.company?.status?.status_rus_short || cp.Статус || cp.status || null),
      ТипОрганизации: isIP ? 'ИП' : 'ЮЛ',
      source: 'DataNewton API'
    }

    console.log(`[DataNewton] Found company: ${item.НаимПолнЮЛ} (ИНН: ${item.ИНН})`)

    res.json({
      success: true,
      data: {
        items: [item],
        source: 'DataNewton API',
        raw: companyData, // Include full raw data for advanced use
        _debug_marker: 'CODE_VERSION_2025-12-22_v2' // Marker to verify new code is loaded
      }
    })

  } catch (error) {
    fs.appendFileSync('/tmp/datanewton-debug.log', `[${new Date().toISOString()}] ERROR: ${error.message}\n${error.stack}\n`);
    console.error(`[DataNewton] Error searching company by INN: ${error.message}`)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search company',
      debug: {
        inn: req.params.inn,
        source: 'DataNewton API'
      }
    })
  }
})

/**
 * GET /api/customer-journey/company-by-inn/:inn
 * Search for company information by INN using Tochka Bank API
 */
router.get('/company-by-inn/:inn', async (req, res) => {
  try {
    const { inn } = req.params

    if (!inn || !/^\d{10}$/.test(inn)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid INN format. Must be 10 digits'
      })
    }

    // Get JWT token from environment variable
    const tochkaJwt = process.env.TOCHKA_JWT_TOKEN

    if (!tochkaJwt) {
      console.warn('[INN] TOCHKA_JWT_TOKEN is not set in environment')
      return res.status(500).json({
        success: false,
        error: 'Tochka API token is not configured',
        debug: {
          inn,
          methods_tried: ['Tochka Bank API (not configured)']
        }
      })
    }

    console.log(`[INN] Searching company with INN: ${inn}`)

    // Call Tochka Bank API
    // According to Tochka API documentation, there are several possible endpoints:
    // 1. /organization/list - list of organizations
    // 2. /counterparty/list - list of counterparties
    // 3. /counterparty/search - search counterparties
    // Try organization/list endpoint first
    const tochkaBaseUrl = 'https://api.tochka.com'
    const tochkaResponse = await axios.get(
      `${tochkaBaseUrl}/organization/list`,
      {
        params: {
          identification_number: inn
        },
        headers: {
          'Authorization': `Bearer ${tochkaJwt}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    )

    console.log(`[INN] Tochka API response status: ${tochkaResponse.status}`)

    if (tochkaResponse.data && tochkaResponse.data.items && tochkaResponse.data.items.length > 0) {
      // Successfully found company in Tochka
      const items = tochkaResponse.data.items.map(item => ({
        НаимПолнЮЛ: item.name || item.НаимПолнЮЛ || 'Unknown',
        ИНН: item.inn || item.ИНН || inn,
        ОГРН: item.ogrn || item.ОГРН || null,
        ВидЮЛ: item.type || item.ВидЮЛ || 'Company',
        source: 'Tochka Bank'
      }))

      return res.json({
        success: true,
        data: {
          items,
          source: 'Tochka Bank API'
        }
      })
    }

    // If not found in Tochka, return 404
    return res.json({
      success: false,
      error: 'Company not found with provided INN',
      debug: {
        inn,
        methods_tried: [
          'Tochka Bank API (no results)'
        ]
      }
    })

  } catch (error) {
    console.error(`[INN] Error searching company by INN with /organization/list: ${error.message}`)

    // Try alternative endpoint: /counterparty/list
    try {
      console.log(`[INN] Trying fallback endpoint /counterparty/list`)
      const fallbackResponse = await axios.get(
        `${tochkaBaseUrl}/counterparty/list`,
        {
          params: {
            identification_number: inn
          },
          headers: {
            'Authorization': `Bearer ${tochkaJwt}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      )

      if (fallbackResponse.data && fallbackResponse.data.items && fallbackResponse.data.items.length > 0) {
        const items = fallbackResponse.data.items.map(item => ({
          НаимПолнЮЛ: item.name || item.НаимПолнЮЛ || 'Unknown',
          ИНН: item.inn || item.ИНН || inn,
          ОГРН: item.ogrn || item.ОГРН || null,
          ВидЮЛ: item.type || item.ВидЮЛ || 'Company',
          source: 'Tochka Bank'
        }))

        return res.json({
          success: true,
          data: {
            items,
            source: 'Tochka Bank API'
          }
        })
      }
    } catch (fallbackError) {
      console.error(`[INN] Fallback endpoint also failed: ${fallbackError.message}`)
    }

    console.error(`[INN] Error details:`, {
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText
    })

    // Check if it's a network error
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'Tochka API is currently unavailable',
        debug: {
          error_code: error.code,
          error_message: error.message
        }
      })
    }

    // If API returned 404, it means the company was not found
    if (error.response?.status === 404) {
      return res.json({
        success: false,
        error: 'Company not found in Tochka Bank database',
        debug: {
          inn,
          status: 404,
          methods_tried: [
            'Tochka Bank API /organization/list (404)',
            'Tochka Bank API /counterparty/list (404)'
          ]
        }
      })
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search company by INN',
      debug: {
        error_code: error.code || 'UNKNOWN',
        status: error.response?.status,
        response_text: error.response?.statusText
      }
    })
  }
})

/**
 * GET /api/customer-journey/agents
 * Get list of available agents for customer journey
 */
router.get('/agents', async (req, res) => {
  try {
    // Return pre-filtered agents data suitable for customer journey
    res.json({
      success: true,
      data: agentsForJourney
    })
  } catch (error) {
    console.error('Error fetching agents:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch agents'
    })
  }
})

/**
 * POST /api/customer-journey/salary-analysis
 * Analyze salary statistics for selected agents
 * Uses HH.ru API to get salary data for professional roles
 */
router.post('/salary-analysis', async (req, res) => {
  try {
    const { agents, areaId, region } = req.body

    if (!agents || !Array.isArray(agents) || agents.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'agents array is required and must not be empty'
      })
    }

    console.log(`[SalaryAnalysis] Analyzing salaries for ${agents.length} agents in region: ${region || 'All Russia'}`)

    // Map agent types to professional roles for HH.ru search
    function mapAgentToProfession(agent) {
      const mapping = {
        'api-integration-agent': 'Разработчик интеграций',
        'health-monitor-dashboard': 'DevOps инженер',
        'support-tickets': 'Специалист технической поддержки',
        'youtube-analytics': 'Аналитик данных',
        'appointment-booking': 'Администратор',
        'sales-agent': 'Менеджер по продажам'
      }

      return mapping[agent.id] || agent.name || 'Специалист'
    }

    // Analyze each agent's salary statistics
    const results = []

    for (const agent of agents) {
      const professionalRole = mapAgentToProfession(agent)
      console.log(`[SalaryAnalysis] ${agent.name} → ${professionalRole}`)

      try {
        // Call HH.ru API
        const hhResponse = await axios.get('https://api.hh.ru/vacancies', {
          params: {
            text: professionalRole,
            area: areaId || 113, // Default to Russia
            per_page: 100,
            only_with_salary: true,
            order_by: 'salary_desc'
          },
          headers: {
            'User-Agent': 'DronDoc/1.0 (https://drondoc.ru)'
          },
          timeout: 15000
        })

        const vacancies = hhResponse.data.items || []
        const salaries = []
        let minSalary = Infinity
        let maxSalary = 0
        let currency = 'RUR'

        for (const vacancy of vacancies) {
          if (!vacancy.salary) continue

          const { from, to, currency: curr } = vacancy.salary
          currency = curr || currency

          let salaryValue
          if (from && to) {
            salaryValue = (from + to) / 2
          } else if (from) {
            salaryValue = from
          } else if (to) {
            salaryValue = to
          } else {
            continue
          }

          salaries.push(salaryValue)

          if (from && from < minSalary) minSalary = from
          if (to && to > maxSalary) maxSalary = to
        }

        let stats = {
          found: 0,
          average: 0,
          median: 0,
          min: 0,
          max: 0,
          currency: 'RUR'
        }

        if (salaries.length > 0) {
          // Calculate average
          const average = Math.round(
            salaries.reduce((sum, val) => sum + val, 0) / salaries.length
          )

          // Calculate median
          const sorted = [...salaries].sort((a, b) => a - b)
          const mid = Math.floor(sorted.length / 2)
          const median = sorted.length % 2 === 0
            ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
            : sorted[mid]

          stats = {
            found: salaries.length,
            average,
            median,
            min: minSalary === Infinity ? 0 : minSalary,
            max: maxSalary,
            currency
          }
        }

        // Calculate ROI
        const monthlySalaryCost = stats.average
        const yearlyHumanCost = monthlySalaryCost * 12
        const yearlyAgentCost = agent.pricing?.yearly || 50000 // Default agent cost
        const savings = yearlyHumanCost - yearlyAgentCost

        results.push({
          agentId: agent.id,
          agentName: agent.name,
          agentType: agent.category || 'business',
          professionalRole,
          stats,
          monthlySalaryCost,
          yearlyHumanCost,
          yearlyAgentCost,
          savings,
          savingsPercent: yearlyHumanCost > 0 ? Math.round((savings / yearlyHumanCost) * 100) : 0
        })

        console.log(`[SalaryAnalysis] ✅ ${agent.name}: avg salary ${stats.average} RUR, savings ${savings} RUR/year`)
      } catch (error) {
        console.error(`[SalaryAnalysis] ❌ Error for ${agent.name}:`, error.message)

        // Add result with error info
        results.push({
          agentId: agent.id,
          agentName: agent.name,
          agentType: agent.category || 'business',
          professionalRole,
          stats: {
            found: 0,
            average: 0,
            median: 0,
            min: 0,
            max: 0,
            currency: 'RUR'
          },
          monthlySalaryCost: 0,
          yearlyHumanCost: 0,
          yearlyAgentCost: agent.pricing?.yearly || 50000,
          savings: 0,
          savingsPercent: 0,
          error: error.message
        })
      }
    }

    // Calculate totals
    const totalYearlyHumanCost = results.reduce((sum, r) => sum + r.yearlyHumanCost, 0)
    const totalYearlyAgentCost = results.reduce((sum, r) => sum + r.yearlyAgentCost, 0)
    const totalSavings = totalYearlyHumanCost - totalYearlyAgentCost

    res.json({
      success: true,
      data: {
        results,
        totals: {
          totalYearlyHumanCost,
          totalYearlyAgentCost,
          totalSavings,
          totalSavingsPercent: totalYearlyHumanCost > 0
            ? Math.round((totalSavings / totalYearlyHumanCost) * 100)
            : 0
        },
        region: region || 'Россия',
        areaId: areaId || 113,
        analyzedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('[SalaryAnalysis] Error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze salary statistics'
    })
  }
})

/**
 * POST /api/customer-journey/analyze-hr-problems
 * Analyze HR problems based on company vacancies from HH.ru
 *
 * Request body:
 * {
 *   employer: { name, id, open_vacancies, alternate_url },
 *   vacancies: [...vacancy objects from HH.ru API]
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     employer: {...},
 *     problems: [{type, description, severity, evidence}],
 *     skills: {required, common, deficit},
 *     automationOpportunities: [{task, frequency, automation_potential, suggested_solution}],
 *     suggestedAgents: [{agentId, agentName, solves, estimatedROI}],
 *     roi: {estimatedSavings, totalHumanCost, totalAgentCost, paybackPeriod}
 *   }
 * }
 */
router.post('/analyze-hr-problems', async (req, res) => {
  console.log('[HR Analysis] POST /analyze-hr-problems endpoint called')

  try {
    const { employer, vacancies } = req.body

    if (!employer || !vacancies) {
      console.log('[HR Analysis] ERROR: Missing employer or vacancies data')
      return res.status(400).json({
        success: false,
        error: 'Employer and vacancies data are required'
      })
    }

    console.log(`[HR Analysis] Analyzing ${vacancies.length} vacancies for ${employer.name}`)

    // Initialize HR Analysis Agent
    const db = req.app.get('db')
    const llmCoordinator = new TokenBasedLLMCoordinator({ db })

    const hrAgent = new HRAnalysisAgent({
      llmCoordinator,
      autoRegister: false // Don't register in discovery for one-off analysis
    })

    // Perform analysis
    const analysis = await hrAgent.analyzeVacancies(employer, vacancies)

    console.log('[HR Analysis] ✅ Analysis completed')
    console.log(`[HR Analysis] Found ${analysis.problems.length} problems, ${analysis.automationOpportunities.length} opportunities, ${analysis.suggestedAgents.length} suggested agents`)

    res.json({
      success: true,
      data: analysis
    })

  } catch (error) {
    console.error('[HR Analysis] Error analyzing HR problems:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze HR problems'
    })
  }
})

/**
 * POST /api/customer-journey/search-employer
 * Search employer on HH.ru and analyze vacancies with AI
 * Issue #5208
 */
router.post('/search-employer', async (req, res) => {
  console.log('[HH.ru] POST /search-employer endpoint called')
  try {
    const { companyName } = req.body

    if (!companyName || companyName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'companyName is required'
      })
    }

    console.log(`[HH.ru] Searching employer: ${companyName}`)

    // Step 1: Search for employer
    let employer = null
    try {
      const employerSearchUrl = 'https://api.hh.ru/employers'
      const employerResponse = await axios.get(employerSearchUrl, {
        params: {
          text: companyName,
          per_page: 5
        },
        headers: {
          'User-Agent': 'DronDoc/1.0 (https://drondoc.ru)'
        },
        timeout: 10000
      })

      const employers = employerResponse.data.items || []
      console.log(`[HH.ru] Found ${employers.length} employers`)

      if (employers.length > 0) {
        employer = employers[0]
        console.log(`[HH.ru] Selected employer: ${employer.name} (ID: ${employer.id})`)
      }
    } catch (employerError) {
      console.error('[HH.ru] Error searching employer:', employerError.message)
      // Continue without employer data
    }

    if (!employer) {
      console.log('[HH.ru] Employer not found on HH.ru')
      return res.json({
        success: true,
        data: {
          found: false,
          employer: null,
          vacancies: [],
          aiAnalysis: null,
          message: 'Работодатель не найден на HH.ru'
        }
      })
    }

    // Step 2: Get employer vacancies
    let vacancies = []
    try {
      const vacanciesUrl = 'https://api.hh.ru/vacancies'
      const vacanciesResponse = await axios.get(vacanciesUrl, {
        params: {
          employer_id: employer.id,
          per_page: 50
        },
        headers: {
          'User-Agent': 'DronDoc/1.0 (https://drondoc.ru)'
        },
        timeout: 10000
      })

      vacancies = vacanciesResponse.data.items || []
      console.log(`[HH.ru] Found ${vacancies.length} vacancies for ${employer.name}`)
    } catch (vacanciesError) {
      console.error('[HH.ru] Error fetching vacancies:', vacanciesError.message)
      // Continue without vacancies
    }

    // Step 3: AI analysis of vacancies
    let aiAnalysis = null
    if (vacancies.length > 0) {
      try {
        const db = req.app.get('db')
        const coordinator = new TokenBasedLLMCoordinator({ db })

        // Get default model
        const defaultModelQuery = 'SELECT id FROM ai_models WHERE provider = ? AND is_default = 1 LIMIT 1'
        const defaultModel = await new Promise((resolve, reject) => {
          db.get(defaultModelQuery, ['deepseek'], (err, row) => {
            if (err) reject(err)
            else resolve(row)
          })
        })

        if (!defaultModel) {
          throw new Error('Default AI model not configured')
        }

        // Get system token
        const systemTokenQuery = 'SELECT id FROM ai_access_tokens WHERE token_type = ? AND is_active = 1 LIMIT 1'
        const systemToken = await new Promise((resolve, reject) => {
          db.get(systemTokenQuery, ['system'], (err, row) => {
            if (err) reject(err)
            else resolve(row?.id)
          })
        })

        if (!systemToken) {
          throw new Error('System AI token not found')
        }

        // Build prompt for AI analysis
        const vacanciesText = vacancies.map(v => {
          const requirement = v.snippet?.requirement || ''
          const responsibility = v.snippet?.responsibility || ''
          return `Вакансия: ${v.name}\nТребования: ${requirement}\nОбязанности: ${responsibility}`
        }).join('\n\n')

        const prompt = `Проанализируй вакансии компании "${employer.name}" и определи возможности автоматизации с помощью ИИ-агентов.

Вакансии (${vacancies.length} шт.):
${vacanciesText}

Вернув JSON в следующем формате:
{
  "automationOpportunities": [
    {
      "task": "название задачи",
      "description": "описание задачи",
      "estimatedSavings": "процент экономии времени или затрат"
    }
  ],
  "keySkills": ["навык1", "навык2", ...],
  "painPoints": ["проблема1", "проблема2", ...],
  "recommendedAgents": [
    {
      "agentType": "тип агента",
      "purpose": "для чего нужен",
      "expectedBenefit": "ожидаемая польза"
    }
  ],
  "summary": "краткое резюме анализа"
}

Верни только валидный JSON без дополнительного текста.`

        console.log('[HH.ru] Starting AI analysis of vacancies...')

        const aiResponse = await coordinator.chatWithToken(
          systemToken,
          defaultModel.id,
          prompt,
          {
            application: 'CustomerJourney',
            operation: 'vacancy-analysis',
            temperature: 0.3,
            maxTokens: 2048
          }
        )

        console.log('[HH.ru] AI analysis complete')

        // Parse AI response
        try {
          const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/)
          aiAnalysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null
        } catch (parseError) {
          console.error('[HH.ru] Failed to parse AI response:', parseError)
          aiAnalysis = {
            summary: aiResponse.content,
            automationOpportunities: [],
            keySkills: [],
            painPoints: [],
            recommendedAgents: []
          }
        }
      } catch (aiError) {
        console.error('[HH.ru] Error during AI analysis:', aiError.message)
        // Continue without AI analysis
      }
    }

    res.json({
      success: true,
      data: {
        found: true,
        employer: {
          id: employer.id,
          name: employer.name,
          url: employer.alternate_url,
          vacanciesUrl: employer.vacancies_url,
          openVacancies: employer.open_vacancies || vacancies.length
        },
        vacancies: vacancies.map(v => ({
          id: v.id,
          name: v.name,
          url: v.alternate_url,
          area: v.area?.name || null,
          salary: v.salary ? {
            from: v.salary.from,
            to: v.salary.to,
            currency: v.salary.currency
          } : null,
          snippet: v.snippet || null,
          publishedAt: v.published_at
        })),
        aiAnalysis
      }
    })
  } catch (error) {
    console.error('[HH.ru] Error in search-employer endpoint:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search employer'
    })
  }
})

/**
 * GET /api/customer-journey/egrul/:inn
 * Get company data from ЕГРЮЛ by INN using egrul.itsoft.ru service
 * Issue #5269
 *
 * Features:
 * - Supports both JSON format from egrul.itsoft.ru
 * - 24-hour caching for performance
 * - Rate limiting (20 requests/hour)
 * - Handles both 10-digit (legal entities) and 12-digit (individual entrepreneurs) INNs
 * - Gzip compression support for faster downloads
 * - Comprehensive error handling
 *
 * Response format:
 * {
 *   success: true,
 *   data: {
 *     inn: "...",
 *     source: "egrul.itsoft.ru",
 *     cached: boolean,
 *     egrulData: { ... }, // Full EGRUL data from API
 *     extractedInfo: {    // Simplified extracted fields
 *       name: "...",
 *       shortName: "...",
 *       ogrn: "...",
 *       kpp: "...",
 *       address: "...",
 *       okved: "...",
 *       registrationDate: "...",
 *       status: "..."
 *     }
 *   }
 * }
 */
router.get('/egrul/:inn', egrulRateLimiter, async (req, res) => {
  const startTime = Date.now()
  try {
    const { inn } = req.params

    // Validate INN format (10 or 12 digits)
    if (!/^\d{10}$|^\d{12}$/.test(inn)) {
      logger.warn({ inn }, '[ЕГРЮЛ] Invalid INN format')
      return res.status(400).json({
        success: false,
        error: 'Неверный формат ИНН. Должен содержать 10 или 12 цифр'
      })
    }

    logger.info({ inn }, '[ЕГРЮЛ] Request received')

    // Check cache first
    const cacheKey = `egrul:${inn}`
    const cached = egrulCache.get(cacheKey)

    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      logger.info({ inn, age: Date.now() - cached.timestamp }, '[ЕГРЮЛ] Cache hit')
      return res.json({
        success: true,
        data: {
          ...cached.data,
          cached: true,
          cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000) // seconds
        }
      })
    }

    logger.info({ inn }, '[ЕГРЮЛ] Cache miss, fetching from egrul.itsoft.ru')

    // Fetch from egrul.itsoft.ru
    // Try .gz first (compressed), then fallback to .json (uncompressed)
    const egrulUrlGz = `https://egrul.itsoft.ru/${inn}.json.gz`
    const egrulUrlJson = `https://egrul.itsoft.ru/${inn}.json`

    let egrulResponse
    let isGzipped = false

    try {
      // Try .gz file first (manually decompress, don't let axios auto-decompress)
      egrulResponse = await axios.get(egrulUrlGz, {
        responseType: 'arraybuffer',
        timeout: 15000,
        decompress: false, // Don't auto-decompress
        headers: {
          'User-Agent': 'DronDoc/1.0 (https://drondoc.ru)',
          'Accept': 'application/json'
        }
      })
      isGzipped = true
      logger.info({ inn }, '[ЕГРЮЛ] Downloaded .gz file')
    } catch (fetchError) {
      // If .gz fails, try uncompressed .json
      if (fetchError.response?.status === 404 || fetchError.code === 'ENOTFOUND') {
        logger.info({ inn }, '[ЕГРЮЛ] .gz not found, trying .json')
        try {
          egrulResponse = await axios.get(egrulUrlJson, {
            timeout: 15000,
            headers: {
              'User-Agent': 'DronDoc/1.0 (https://drondoc.ru)',
              'Accept': 'application/json'
            }
          })
          isGzipped = false
          logger.info({ inn }, '[ЕГРЮЛ] Downloaded .json file')
        } catch (fallbackError) {
          if (fallbackError.response?.status === 404) {
            logger.warn({ inn }, '[ЕГРЮЛ] Company not found')
            return res.status(404).json({
              success: false,
              error: 'Компания с указанным ИНН не найдена в ЕГРЮЛ'
            })
          }
          throw fallbackError
        }
      } else {
        throw fetchError
      }
    }

    // Decompress if needed
    let egrulData
    if (isGzipped) {
      const decompressed = await gunzip(Buffer.from(egrulResponse.data))
      egrulData = JSON.parse(decompressed.toString('utf-8'))
    } else {
      egrulData = typeof egrulResponse.data === 'string'
        ? JSON.parse(egrulResponse.data)
        : egrulResponse.data
    }

    logger.info({ inn, dataKeys: Object.keys(egrulData) }, '[ЕГРЮЛ] Data fetched successfully')

    // Extract key information from EGRUL data using correct structure
    // Structure: egrulData.СвЮЛ contains all data
    const isIP = inn.length === 12
    const svYul = egrulData?.СвЮЛ
    const extractedInfo = {}

    if (!svYul) {
      // Fallback if structure is unexpected
      extractedInfo.type = isIP ? 'ИП' : 'ЮЛ'
      extractedInfo.name = 'Данные недоступны'
      extractedInfo.inn = inn
      logger.warn({ inn }, '[ЕГРЮЛ] Invalid data structure: missing СвЮЛ')
    } else {
      const attrs = svYul['@attributes'] || {}
      const naim = svYul.СвНаимЮЛ?.['@attributes']
      const naimSokr = svYul.СвНаимЮЛ?.СвНаимЮЛСокр?.['@attributes']
      const okved = svYul.СвОКВЭД?.СвОКВЭДОсн?.['@attributes']
      const fl = svYul.СведДолжнФЛ?.СвФЛ?.['@attributes']
      const kapital = svYul.СвУстКап?.['@attributes']

      if (isIP) {
        // Individual Entrepreneur (ИП) - 12 digits
        extractedInfo.type = 'ИП'
        extractedInfo.name = naim?.НаимЮЛПолн || fl ? `${fl.Фамилия || ''} ${fl.Имя || ''} ${fl.Отчество || ''}`.trim() : 'Неизвестно'
        extractedInfo.fio = fl ? `${fl.Фамилия || ''} ${fl.Имя || ''} ${fl.Отчество || ''}`.trim() : null
        extractedInfo.ogrnip = attrs.ОГРН || null
        extractedInfo.registrationDate = attrs.ДатаОГРН || null
        extractedInfo.address = null // TODO: extract address for IP
        extractedInfo.status = svYul.СвПрекрЮЛ ? 'Прекратила деятельность' : 'Действующий'
      } else {
        // Legal Entity (ЮЛ) - 10 digits
        extractedInfo.type = 'ЮЛ'
        extractedInfo.name = naim?.НаимЮЛПолн || 'Неизвестно'
        extractedInfo.shortName = naimSokr?.НаимСокр || null
        extractedInfo.ogrn = attrs.ОГРН || null
        extractedInfo.kpp = attrs.КПП || null
        extractedInfo.registrationDate = attrs.ДатаОГРН || null

        // Format address from parts
        const adres = svYul.СвАдресЮЛ?.АдресРФ
        if (adres) {
          const adresAttrs = adres['@attributes'] || {}
          const region = adres.Регион?.['@attributes']?.НаимРегион
          const ulica = adres.Улица?.['@attributes']
          const parts = []
          if (adresAttrs.Индекс) parts.push(adresAttrs.Индекс)
          if (region) parts.push(region)
          if (ulica) {
            const street = `${ulica.ТипУлица || ''} ${ulica.НаимУлица || ''}`.trim()
            if (street) parts.push(street)
          }
          if (adresAttrs.Дом) parts.push(`д. ${adresAttrs.Дом}`)
          extractedInfo.address = parts.length > 0 ? parts.join(', ') : null
        } else {
          extractedInfo.address = null
        }

        extractedInfo.okved = okved?.КодОКВЭД || null
        extractedInfo.status = svYul.СвПрекрЮЛ ? 'Ликвидирована' : 'Действующая'

        // Руководитель (ФИО)
        if (fl) {
          const headParts = [fl.Фамилия, fl.Имя, fl.Отчество].filter(Boolean)
          extractedInfo.head = headParts.length > 0 ? headParts.join(' ') : null
        } else {
          extractedInfo.head = null
        }

        extractedInfo.capital = kapital?.СумКап || null
      }

      extractedInfo.inn = inn
    }

    const responseData = {
      inn,
      source: 'egrul.itsoft.ru',
      cached: false,
      egrulData,
      extractedInfo,
      fetchedAt: new Date().toISOString()
    }

    // Cache the result
    egrulCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    })

    // Clean up old cache entries (keep last 1000 entries)
    if (egrulCache.size > 1000) {
      const keysToDelete = Array.from(egrulCache.keys()).slice(0, egrulCache.size - 1000)
      keysToDelete.forEach(key => egrulCache.delete(key))
      logger.info({ deleted: keysToDelete.length }, '[ЕГРЮЛ] Cache cleanup')
    }

    const duration = Date.now() - startTime
    logger.info({ inn, duration, cached: false }, '[ЕГРЮЛ] Request completed')

    // Save to Integram asynchronously (don't wait for completion)
    saveEgrulToIntegram(inn, egrulData, extractedInfo)
      .then(result => {
        if (result.success) {
          logger.info({ orgId: result.orgId, requisites: result.requisites }, '[ЕГРЮЛ] Data saved to Integram')
        }
      })
      .catch(err => {
        logger.warn({ error: err.message }, '[ЕГРЮЛ] Failed to save to Integram (non-blocking)')
      })

    res.json({
      success: true,
      data: responseData
    })

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error({
      inn: req.params.inn,
      error: error.message,
      duration,
      stack: error.stack
    }, '[ЕГРЮЛ] Error fetching data')

    // Handle specific error types
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        success: false,
        error: 'Превышено время ожидания ответа от ЕГРЮЛ API',
        details: 'Сервис egrul.itsoft.ru недоступен или медленно отвечает'
      })
    }

    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Компания с указанным ИНН не найдена в ЕГРЮЛ'
      })
    }

    if (error.code === 'ENOTFOUND') {
      return res.status(503).json({
        success: false,
        error: 'Сервис ЕГРЮЛ временно недоступен',
        details: 'Не удалось подключиться к egrul.itsoft.ru'
      })
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Ошибка при получении данных из ЕГРЮЛ',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

// ============================================================
// Custom Agent Creation Endpoints
// ============================================================

/**
 * POST /api/customer-journey/create-agent
 * Create a custom agent based on user's task description
 * Uses kodacode provider with KodaAgent model
 */
router.post('/create-agent', async (req, res) => {
  try {
    const { userId, taskDescription, agentName } = req.body

    if (!userId || !taskDescription) {
      return res.status(400).json({
        success: false,
        error: 'userId and taskDescription are required'
      })
    }

    logger.info({ userId, taskDescription: taskDescription.substring(0, 100) }, '[Customer Journey] Creating custom agent')

    // Initialize LLM coordinator
    const llmCoordinator = new TokenBasedLLMCoordinator({})

    // Create system prompt for agent creation
    const systemPrompt = `Ты - KodaAgent, специализированный ассистент для создания пользовательских AI-агентов.
На основе описания задачи пользователя, создай конфигурацию агента с следующими параметрами:
- name: название агента (краткое, понятное)
- description: описание того, что делает агент
- systemPrompt: системный промпт для агента
- capabilities: список возможностей агента
- suggestedActions: рекомендуемые действия для пользователя

Ответь ТОЛЬКО в формате JSON без дополнительных комментариев.`

    const message = `Создай агента для следующей задачи: ${taskDescription}`

    // Call kodacode/KodaAgent
    const response = await llmCoordinator.chatWithToken(
      `user_${userId}`,
      'kodacode/KodaAgent',
      message,
      {
        systemPrompt,
        temperature: 0.7,
        maxTokens: 2048,
        enableTools: false,
        conversationHistory: []
      }
    )

    let agentConfig
    try {
      // Try to parse JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        agentConfig = JSON.parse(jsonMatch[0])
      } else {
        agentConfig = JSON.parse(response.content)
      }
    } catch (parseError) {
      logger.warn({ response: response.content }, '[Customer Journey] Failed to parse agent config as JSON, using raw response')
      agentConfig = {
        name: agentName || 'Пользовательский агент',
        description: taskDescription,
        rawResponse: response.content
      }
    }

    // Generate unique agent ID
    const agentId = `agent_${userId}_${Date.now()}`

    // Prepare agent data
    const agentData = {
      id: agentId,
      userId,
      taskDescription,
      ...agentConfig,
      createdAt: new Date().toISOString(),
      provider: 'kodacode',
      model: 'KodaAgent'
    }

    // Save agent to file
    const agentsDir = './data/agents'
    if (!fs.existsSync(agentsDir)) {
      fs.mkdirSync(agentsDir, { recursive: true })
    }

    const agentFilePath = `${agentsDir}/${userId}.json`

    // Read existing agents or create new array
    let userAgents = []
    if (fs.existsSync(agentFilePath)) {
      const fileContent = fs.readFileSync(agentFilePath, 'utf-8')
      userAgents = JSON.parse(fileContent)
    }

    // Add new agent
    userAgents.push(agentData)

    // Save to file
    fs.writeFileSync(agentFilePath, JSON.stringify(userAgents, null, 2))

    logger.info({ agentId, userId }, '[Customer Journey] Agent created and saved')

    res.json({
      success: true,
      data: {
        agentId,
        agent: agentData
      }
    })

  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, '[Customer Journey] Error creating agent')
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create agent',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

/**
 * GET /api/customer-journey/agent/:agentId
 * Get agent by ID (only for agent owner)
 */
router.get('/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      })
    }

    // Extract userId from agentId
    const agentUserId = agentId.split('_')[1]

    // Check ownership
    if (agentUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: you can only view your own agents'
      })
    }

    // Read agent file
    const agentFilePath = `./data/agents/${userId}.json`

    if (!fs.existsSync(agentFilePath)) {
      return res.status(404).json({
        success: false,
        error: 'No agents found for this user'
      })
    }

    const fileContent = fs.readFileSync(agentFilePath, 'utf-8')
    const userAgents = JSON.parse(fileContent)

    // Find specific agent
    const agent = userAgents.find(a => a.id === agentId)

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      })
    }

    res.json({
      success: true,
      data: agent
    })

  } catch (error) {
    logger.error({ error: error.message }, '[Customer Journey] Error fetching agent')
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch agent'
    })
  }
})


export default router
