/**
 * Proposal Generator Service
 *
 * Business Intelligence-driven Proposal Generator
 * Automatically collects data about potential clients and generates personalized proposals
 *
 * Issue #4467 - Generate commercial proposals with AI and web scraping
 *
 * Features:
 * - Company data collection from websites and public registries
 * - Salary data parsing from job sites (HH.ru, Avito)
 * - Industry (OKVED) and region detection
 * - AI-powered proposal generation using DeepSeek
 * - Competitor analysis from marketplaces
 *
 * Data storage: Uses Integram MCP (no direct database creation)
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import { TokenBasedLLMCoordinator } from '../../core/TokenBasedLLMCoordinator.js'

class ProposalGeneratorService {
  constructor({ db, llmCoordinator }) {
    this.db = db
    this.llmCoordinator = llmCoordinator || new TokenBasedLLMCoordinator({ db })

    // OKVED to job position mapping
    this.okvedJobMapping = {
      '62.01': ['программист', 'тестировщик', 'разработчик'],
      '62.02': ['системный администратор', 'DevOps инженер'],
      '73.11': ['маркетолог', 'SMM-специалист'],
      '47.91': ['менеджер по продажам', 'продавец-консультант'],
      '56.10': ['официант', 'повар', 'бармен'],
      '68.20': ['агент по недвижимости', 'риэлтор'],
      '85.41': ['преподаватель', 'учитель'],
      // Add more mappings as needed
    }

    // Time estimates for routine tasks (in minutes)
    this.timeEstimates = {
      product_update: 20,      // minutes per product
      faq_answer: 15,          // minutes per FAQ entry
      form_processing: 10,     // minutes per form submission
      article_writing: 120,    // minutes per blog article
      customer_support: 5      // minutes per support message
    }
  }

  /**
   * Main entry point: Generate proposal for a company
   *
   * @param {Object} params - Input parameters
   * @param {string} params.companyName - Company name (required)
   * @param {string} params.domain - Company website domain (optional)
   * @param {string} params.region - Region (optional, auto-detect if not provided)
   * @param {string} params.userId - User ID for AI token
   * @returns {Promise<Object>} Proposal data
   */
  async generateProposal({ companyName, domain, region, userId }) {
    try {
      console.log(`[ProposalGenerator] Starting proposal generation for: ${companyName}`)

      // Step 1: Collect company data
      const companyData = await this.collectCompanyData({ companyName, domain, region })

      // Step 2: Determine OKVED and region
      const industryData = await this.detectIndustryAndRegion(companyData)

      // Step 3: Calculate employee cost
      const employeeCost = await this.calculateEmployeeCost({
        okved: industryData.okved,
        region: industryData.region,
        positions: industryData.targetPositions
      })

      // Step 4: Analyze website for routine tasks
      const routineAnalysis = await this.analyzeWebsiteRoutine(companyData.website)

      // Step 5: Collect competitive context
      const competitiveContext = await this.collectCompetitiveContext({
        companyName,
        industry: industryData.industry,
        domain
      })

      // Step 6: Generate proposal using AI
      const proposalText = await this.generateProposalWithAI({
        companyData,
        industryData,
        employeeCost,
        routineAnalysis,
        competitiveContext,
        userId
      })

      // Step 7: Save to Integram (if needed)
      const savedProposal = await this.saveProposalData({
        companyName,
        proposalText,
        collectedData: {
          companyData,
          industryData,
          employeeCost,
          routineAnalysis,
          competitiveContext
        }
      })

      return {
        success: true,
        proposal: proposalText,
        data: {
          company: companyData,
          industry: industryData,
          cost: employeeCost,
          routine: routineAnalysis,
          competitors: competitiveContext
        },
        saved: savedProposal
      }
    } catch (error) {
      console.error('[ProposalGenerator] Error:', error)
      throw new Error(`Failed to generate proposal: ${error.message}`)
    }
  }

  /**
   * Collect company data from website and public sources
   */
  async collectCompanyData({ companyName, domain, region }) {
    const data = {
      name: companyName,
      domain: domain || null,
      region: region || null,
      website: null,
      description: null,
      contacts: null
    }

    if (domain) {
      try {
        // Fetch website content
        const websiteUrl = domain.startsWith('http') ? domain : `https://${domain}`
        const response = await axios.get(websiteUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; DronDocBot/1.0; +https://drondoc.ru)'
          }
        })

        const $ = cheerio.load(response.data)

        // Extract meta description
        data.description = $('meta[name="description"]').attr('content') ||
                          $('meta[property="og:description"]').attr('content') ||
                          $('p').first().text().substring(0, 300)

        // Extract contact info
        data.contacts = {
          email: this.extractEmail(response.data),
          phone: this.extractPhone(response.data)
        }

        // Count elements for routine analysis
        data.website = {
          url: websiteUrl,
          productCount: $('.product, .товар, [data-product]').length,
          faqCount: $('.faq, .вопрос, .qa').length,
          formsCount: $('form').length,
          blogPostsCount: $('.blog-post, .article, .статья').length,
          pagesCount: $('a[href]').length
        }

      } catch (error) {
        console.error(`[ProposalGenerator] Failed to fetch website ${domain}:`, error.message)
        data.website = { error: error.message }
      }
    }

    return data
  }

  /**
   * Detect industry (OKVED) and region from company data
   */
  async detectIndustryAndRegion(companyData) {
    // Try to detect from website content
    let okved = null
    let industry = null
    let region = companyData.region

    if (companyData.description) {
      const desc = companyData.description.toLowerCase()

      // Simple keyword-based detection (can be enhanced with AI)
      if (desc.includes('программир') || desc.includes('разработк') || desc.includes('it')) {
        okved = '62.01'
        industry = 'Разработка программного обеспечения'
      } else if (desc.includes('маркетинг') || desc.includes('реклам')) {
        okved = '73.11'
        industry = 'Рекламная деятельность'
      } else if (desc.includes('продаж') || desc.includes('магазин') || desc.includes('торговл')) {
        okved = '47.91'
        industry = 'Розничная торговля'
      } else if (desc.includes('ресторан') || desc.includes('кафе') || desc.includes('общепит')) {
        okved = '56.10'
        industry = 'Общественное питание'
      }
    }

    // Get target positions for this OKVED
    const targetPositions = okved ? (this.okvedJobMapping[okved] || []) : []

    return {
      okved,
      industry: industry || 'Не определена (требуется ручной ввод)',
      region: region || 'Не определён',
      targetPositions,
      confidence: okved ? 0.85 : 0.0
    }
  }

  /**
   * Calculate employee cost based on salary data from job sites
   */
  async calculateEmployeeCost({ okved, region, positions }) {
    if (!positions || positions.length === 0) {
      return {
        error: 'No target positions defined for this industry',
        averageSalary: 0,
        fullCost: 0
      }
    }

    const salaries = []

    for (const position of positions) {
      try {
        // Parse HH.ru for salary data
        const salary = await this.parseHHSalary(position, region)
        if (salary) {
          salaries.push(salary)
        }
      } catch (error) {
        console.error(`[ProposalGenerator] Failed to fetch salary for ${position}:`, error.message)
      }
    }

    if (salaries.length === 0) {
      return {
        error: 'Could not fetch salary data',
        averageSalary: 0,
        fullCost: 0,
        positions
      }
    }

    // Calculate median salary
    salaries.sort((a, b) => a - b)
    const medianSalary = salaries[Math.floor(salaries.length / 2)]

    // Full cost includes 30% overhead (taxes, benefits, etc.)
    const fullCost = Math.round(medianSalary * 1.3)

    return {
      positions,
      averageSalary: medianSalary,
      fullCost,
      salaryRange: {
        min: salaries[0],
        max: salaries[salaries.length - 1]
      },
      dataPoints: salaries.length
    }
  }

  /**
   * Parse salary data from HH.ru
   */
  async parseHHSalary(position, region = 'Москва') {
    try {
      // Note: This is a simplified version. In production, use official HH.ru API
      // https://github.com/hhru/api

      const searchUrl = `https://hh.ru/search/vacancy?text=${encodeURIComponent(position)}&area=1` // area=1 is Moscow

      const response = await axios.get(searchUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DronDocBot/1.0; +https://drondoc.ru)'
        }
      })

      const $ = cheerio.load(response.data)

      // Extract salary from first few vacancies
      const salaries = []
      $('.vacancy-serp-item__sidebar').each((i, elem) => {
        if (i >= 10) return false // Limit to first 10

        const salaryText = $(elem).text()
        const matches = salaryText.match(/(\d+\s*\d*)\s*₽/)
        if (matches) {
          const salary = parseInt(matches[1].replace(/\s/g, ''))
          if (salary > 10000 && salary < 1000000) { // Sanity check
            salaries.push(salary)
          }
        }
      })

      if (salaries.length === 0) {
        return null
      }

      // Return median
      salaries.sort((a, b) => a - b)
      return salaries[Math.floor(salaries.length / 2)]

    } catch (error) {
      console.error(`[ProposalGenerator] HH.ru parsing error:`, error.message)
      return null
    }
  }

  /**
   * Analyze website for routine tasks
   */
  async analyzeWebsiteRoutine(websiteData) {
    if (!websiteData || websiteData.error) {
      return {
        error: 'Website analysis unavailable',
        totalMinutesPerMonth: 0,
        breakdown: {}
      }
    }

    const breakdown = {
      productUpdates: {
        count: websiteData.productCount || 0,
        minutesPerItem: this.timeEstimates.product_update,
        totalMinutes: (websiteData.productCount || 0) * this.timeEstimates.product_update
      },
      faqManagement: {
        count: websiteData.faqCount || 0,
        minutesPerItem: this.timeEstimates.faq_answer,
        totalMinutes: (websiteData.faqCount || 0) * this.timeEstimates.faq_answer
      },
      formProcessing: {
        count: (websiteData.formsCount || 0) * 30, // Assuming 30 submissions per form per month
        minutesPerItem: this.timeEstimates.form_processing,
        totalMinutes: (websiteData.formsCount || 0) * 30 * this.timeEstimates.form_processing
      },
      contentCreation: {
        count: websiteData.blogPostsCount || 0,
        minutesPerItem: this.timeEstimates.article_writing,
        totalMinutes: (websiteData.blogPostsCount || 0) * this.timeEstimates.article_writing
      }
    }

    const totalMinutesPerMonth = Object.values(breakdown).reduce((sum, item) => sum + item.totalMinutes, 0)
    const totalHoursPerMonth = Math.round(totalMinutesPerMonth / 60)
    const equivalentFTE = (totalHoursPerMonth / 160).toFixed(2) // 160 hours = 1 FTE per month

    return {
      breakdown,
      totalMinutesPerMonth,
      totalHoursPerMonth,
      equivalentFTE,
      summary: `Estimated ${totalHoursPerMonth} hours/month of routine work (${equivalentFTE} FTE)`
    }
  }

  /**
   * Collect competitive context from marketplaces and tenders
   */
  async collectCompetitiveContext({ companyName, industry, domain }) {
    const context = {
      marketplaces: [],
      tenders: [],
      competitors: []
    }

    // For e-commerce companies, try to find them on Wildberries/Ozon
    // For B2B services, check government procurement sites
    // This is a placeholder - implement actual scraping as needed

    try {
      // Example: Search for company on zakupki.gov.ru
      // const tenderData = await this.searchTenders(companyName)
      // context.tenders = tenderData

      context.note = 'Competitive analysis requires additional implementation'
    } catch (error) {
      console.error('[ProposalGenerator] Competitive analysis error:', error.message)
    }

    return context
  }

  /**
   * Generate proposal text using AI (DeepSeek via TokenBasedLLMCoordinator)
   */
  async generateProposalWithAI({ companyData, industryData, employeeCost, routineAnalysis, competitiveContext, userId }) {
    try {
      // Build context for AI
      const prompt = this.buildProposalPrompt({
        companyData,
        industryData,
        employeeCost,
        routineAnalysis,
        competitiveContext
      })

      // Get default token for user
      const tokenInfo = await this.getDefaultAIToken(userId)

      // Generate proposal using AI
      const result = await this.llmCoordinator.chatWithToken(
        tokenInfo.token.id,
        tokenInfo.defaultModel.id,
        prompt,
        {
          application: 'ProposalGenerator',
          operation: 'generate_proposal',
          temperature: 0.7,
          maxTokens: 2048
        }
      )

      return result.text

    } catch (error) {
      console.error('[ProposalGenerator] AI generation error:', error.message)

      // Fallback: Generate basic proposal without AI
      return this.generateBasicProposal({ companyData, industryData, employeeCost, routineAnalysis })
    }
  }

  /**
   * Build prompt for AI proposal generation
   */
  buildProposalPrompt({ companyData, industryData, employeeCost, routineAnalysis, competitiveContext }) {
    return `
Сгенерируй персонализированное коммерческое предложение (первую страницу) для компании "${companyData.name}" в стиле Value-Based Selling.

ДАННЫЕ О КОМПАНИИ:
- Название: ${companyData.name}
- Сайт: ${companyData.domain || 'не указан'}
- Отрасль: ${industryData.industry}
- Регион: ${industryData.region}
${companyData.description ? `- Описание: ${companyData.description}` : ''}

АНАЛИЗ ЗАТРАТ НА ПЕРСОНАЛ:
- Целевые должности для автоматизации: ${employeeCost.positions ? employeeCost.positions.join(', ') : 'не определены'}
- Средняя зарплата: ${employeeCost.averageSalary ? employeeCost.averageSalary.toLocaleString('ru-RU') + ' руб.' : 'данные недоступны'}
- Полная стоимость с налогами: ${employeeCost.fullCost ? employeeCost.fullCost.toLocaleString('ru-RU') + ' руб./мес.' : 'данные недоступны'}

АНАЛИЗ РУТИННЫХ ЗАДАЧ:
- Общее время рутины: ${routineAnalysis.totalHoursPerMonth} часов/мес.
- Эквивалент FTE: ${routineAnalysis.equivalentFTE}
${routineAnalysis.breakdown ? `
- Обновление товаров: ${routineAnalysis.breakdown.productUpdates.count} товаров × ${routineAnalysis.breakdown.productUpdates.minutesPerItem} мин = ${routineAnalysis.breakdown.productUpdates.totalMinutes} мин
- FAQ: ${routineAnalysis.breakdown.faqManagement.count} вопросов × ${routineAnalysis.breakdown.faqManagement.minutesPerItem} мин = ${routineAnalysis.breakdown.faqManagement.totalMinutes} мин
- Обработка форм: ${routineAnalysis.breakdown.formProcessing.count} заявок × ${routineAnalysis.breakdown.formProcessing.minutesPerItem} мин = ${routineAnalysis.breakdown.formProcessing.totalMinutes} мин
- Написание статей: ${routineAnalysis.breakdown.contentCreation.count} статей × ${routineAnalysis.breakdown.contentCreation.minutesPerItem} мин = ${routineAnalysis.breakdown.contentCreation.totalMinutes} мин
` : ''}

ЗАДАНИЕ:
Создай убедительное КП, которое:
1. Обращается к конкретным болям компании (на основе собранных данных)
2. Показывает КОНКРЕТНУЮ экономию в рублях при замене сотрудника ИИ-агентом
3. Использует язык Value-Based Selling (фокус на ценности, а не на функциях)
4. Структура:
   - Заголовок (привлекающий внимание)
   - Боль клиента (на основе анализа)
   - Решение (ИИ-агент для автоматизации)
   - Экономия (конкретные цифры)
   - Призыв к действию

Формат: HTML, готовый к вставке в письмо.
`
  }

  /**
   * Generate basic proposal without AI (fallback)
   */
  generateBasicProposal({ companyData, industryData, employeeCost, routineAnalysis }) {
    const savings = employeeCost.fullCost ? employeeCost.fullCost * 0.7 : 0 // Assume 70% savings

    return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #2c3e50;">Экономия ${savings.toLocaleString('ru-RU')} руб./мес. для ${companyData.name}</h1>

  <p>Уважаемые коллеги!</p>

  <p>Мы проанализировали вашу компанию "${companyData.name}" (отрасль: ${industryData.industry}) и обнаружили значительный потенциал для оптимизации расходов.</p>

  <h2 style="color: #3498db;">Ваша текущая ситуация:</h2>
  <ul>
    <li>Затраты на персонал: <strong>${employeeCost.fullCost ? employeeCost.fullCost.toLocaleString('ru-RU') + ' руб./мес.' : 'требуется анализ'}</strong></li>
    <li>Рутинные задачи: <strong>${routineAnalysis.totalHoursPerMonth} часов/мес.</strong></li>
    <li>Должности для автоматизации: ${employeeCost.positions ? employeeCost.positions.join(', ') : 'не определены'}</li>
  </ul>

  <h2 style="color: #27ae60;">Наше решение:</h2>
  <p>ИИ-агент, который автоматизирует рутинные задачи и позволяет сократить затраты на <strong>70%</strong>.</p>

  <h3 style="color: #e74c3c;">Экономия: ${savings.toLocaleString('ru-RU')} руб./мес.</h3>

  <p>Готовы обсудить внедрение? Свяжитесь с нами для персональной презентации.</p>

  <p style="margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; color: #7f8c8d; font-size: 12px;">
    Создано автоматически системой DronDoc Proposal Generator
  </p>
</div>
`
  }

  /**
   * Save proposal data to storage (Integram or local file)
   * Note: As per guidelines, we document database requirements but don't create databases
   */
  async saveProposalData({ companyName, proposalText, collectedData }) {
    // TODO: Integrate with Integram MCP to save proposal data
    // For now, just return metadata

    const metadata = {
      companyName,
      generatedAt: new Date().toISOString(),
      dataCollected: {
        hasWebsiteData: !!collectedData.companyData.website,
        hasIndustryData: !!collectedData.industryData.okved,
        hasSalaryData: collectedData.employeeCost.averageSalary > 0,
        hasRoutineAnalysis: collectedData.routineAnalysis.totalHoursPerMonth > 0
      }
    }

    console.log('[ProposalGenerator] Proposal metadata:', metadata)

    // In production: Save to Integram using MCP tools
    // await this.saveToIntegram({ companyName, proposalText, metadata })

    return {
      saved: false,
      note: 'Saving to Integram requires MCP integration (to be implemented)',
      metadata
    }
  }

  /**
   * Get default AI token for user (using aiTokenService pattern)
   */
  async getDefaultAIToken(userId) {
    // This would call the aiTokenService, but for now we'll mock it
    // In production, integrate with backend/orchestrator/src/api/routes/ai-tokens.js

    return {
      token: {
        id: 'dd_tok_default',
        token_balance: 1000000,
        daily_limit: 100000
      },
      defaultModel: {
        id: 'deepseek-chat',
        display_name: 'DeepSeek Chat',
        provider_display_name: 'DeepSeek'
      }
    }
  }

  /**
   * Extract email from HTML content
   */
  extractEmail(html) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    const matches = html.match(emailRegex)
    return matches ? matches[0] : null
  }

  /**
   * Extract phone from HTML content
   */
  extractPhone(html) {
    const phoneRegex = /(\+7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g
    const matches = html.match(phoneRegex)
    return matches ? matches[0] : null
  }
}

export default ProposalGeneratorService
