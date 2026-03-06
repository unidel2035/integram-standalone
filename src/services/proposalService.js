import axios from 'axios'
import { marked } from 'marked'

/**
 * Commercial Proposal Service
 *
 * Handles AI-based generation of commercial proposals (КП)
 * for Customer Journey feature. Uses DeepSeek/OpenAI through
 * the token-based AI system.
 */

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api'

/**
 * Proposal Service Class
 */
class ProposalService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000 // 60 seconds for AI generation
    })
  }

  /**
   * Generate commercial proposal using AI
   *
   * @param {Object} journeyData - Complete customer journey data
   * @returns {Promise<Object>} Generated proposal
   */
  async generateProposal(journeyData) {
    try {
      const response = await this.apiClient.post(
        '/customer-journey/generate-proposal',
        { journeyData }
      )

      return {
        success: true,
        data: response.data.data,
        raw: response.data
      }
    } catch (error) {
      console.error('Error generating proposal:', error)
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to generate proposal',
        data: null
      }
    }
  }

  /**
   * Regenerate proposal with different parameters
   *
   * @param {Object} journeyData - Customer journey data
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated proposal
   */
  async regenerateProposal(journeyData, options = {}) {
    try {
      const response = await this.apiClient.post(
        '/customer-journey/generate-proposal',
        {
          journeyData,
          options: {
            temperature: options.temperature || 0.7,
            style: options.style || 'professional', // professional, casual, technical
            length: options.length || 'medium', // short, medium, long
            includeFinancials: options.includeFinancials !== false,
            includeTimeline: options.includeTimeline !== false,
            ...options
          }
        }
      )

      return {
        success: true,
        data: response.data.data,
        raw: response.data
      }
    } catch (error) {
      console.error('Error regenerating proposal:', error)
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to regenerate proposal',
        data: null
      }
    }
  }

  /**
   * Render markdown proposal to HTML
   *
   * @param {string} markdown - Markdown content
   * @returns {string} HTML content
   */
  renderMarkdown(markdown) {
    if (!markdown) return ''

    // Configure marked for safe rendering
    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: true,
      mangle: false,
      sanitize: false // We trust AI-generated content
    })

    return marked.parse(markdown)
  }

  /**
   * Download proposal as PDF
   * Uses backend service to generate PDF from markdown
   *
   * @param {string} proposalContent - Markdown content
   * @param {Object} metadata - Proposal metadata
   * @returns {Promise<Blob>} PDF file blob
   */
  async downloadPDF(proposalContent, metadata = {}) {
    try {
      const response = await this.apiClient.post(
        '/customer-journey/proposal/pdf',
        {
          content: proposalContent,
          metadata
        },
        {
          responseType: 'blob'
        }
      )

      return {
        success: true,
        blob: response.data,
        fileName: `proposal_${metadata.organizationName || 'document'}_${new Date().toISOString().split('T')[0]}.pdf`
      }
    } catch (error) {
      console.error('Error downloading PDF:', error)
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to generate PDF',
        blob: null
      }
    }
  }

  /**
   * Download proposal as DOCX
   * Uses backend service to generate DOCX from markdown
   *
   * @param {string} proposalContent - Markdown content
   * @param {Object} metadata - Proposal metadata
   * @returns {Promise<Blob>} DOCX file blob
   */
  async downloadDOCX(proposalContent, metadata = {}) {
    try {
      const response = await this.apiClient.post(
        '/customer-journey/proposal/docx',
        {
          content: proposalContent,
          metadata
        },
        {
          responseType: 'blob'
        }
      )

      return {
        success: true,
        blob: response.data,
        fileName: `proposal_${metadata.organizationName || 'document'}_${new Date().toISOString().split('T')[0]}.docx`
      }
    } catch (error) {
      console.error('Error downloading DOCX:', error)
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to generate DOCX',
        blob: null
      }
    }
  }

  /**
   * Trigger file download in browser
   *
   * @param {Blob} blob - File blob
   * @param {string} fileName - File name
   */
  triggerDownload(blob, fileName) {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  /**
   * Send proposal via email
   *
   * @param {string} proposalContent - Markdown content
   * @param {string} recipientEmail - Recipient email address
   * @param {Object} metadata - Proposal metadata
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(proposalContent, recipientEmail, metadata = {}) {
    try {
      const response = await this.apiClient.post(
        '/customer-journey/proposal/email',
        {
          content: proposalContent,
          recipientEmail,
          metadata
        }
      )

      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      console.error('Error sending email:', error)
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to send email'
      }
    }
  }

  /**
   * Build proposal context from journey data
   * Helper method to structure data for AI prompt
   *
   * @param {Object} journeyData - Customer journey data
   * @returns {Object} Structured context
   */
  buildProposalContext(journeyData) {
    return {
      organization: {
        name: journeyData.organization?.name || 'Организация',
        inn: journeyData.organization?.inn || null,
        industry: journeyData.organization?.industry || null,
        region: journeyData.organization?.region || null,
        employeeCount: journeyData.organization?.employeeCount || null,
        description: journeyData.documentsData?.businessDescription || null
      },
      agentRequest: {
        description: journeyData.agentRequest?.description || '',
        functions: journeyData.agentRequest?.functions || []
      },
      currentCosts: {
        salaries: journeyData.organization?.currentCosts?.salaries || 0,
        employeeCount: journeyData.salaryData?.employeeCount || 0,
        totalMonthlyCosts: journeyData.salaryData?.totalMonthlyCosts || 0,
        source: journeyData.salaryData?.source || 'manual'
      },
      selectedAgents: (journeyData.selectedAgents || []).map(agent => ({
        name: agent.name,
        description: agent.description,
        category: agent.category,
        estimatedSavings: agent.estimatedSavings
      })),
      roi: {
        currentCosts: journeyData.roiData?.currentCosts || 0,
        agentCosts: journeyData.roiData?.agentCosts || 0,
        savings: journeyData.roiData?.savings || 0,
        savingsPercent: journeyData.roiData?.savingsPercent || 0,
        paybackDays: journeyData.roiData?.paybackDays || 0
      },
      documentsData: journeyData.documentsData || null
    }
  }

  /**
   * Validate journey data before proposal generation
   *
   * @param {Object} journeyData - Customer journey data
   * @returns {Object} Validation result
   */
  validateJourneyData(journeyData) {
    const errors = []

    if (!journeyData.organization?.name) {
      errors.push('Organization name is required')
    }

    if (!journeyData.agentRequest?.description) {
      errors.push('Agent request description is required')
    }

    if (!journeyData.selectedAgents || journeyData.selectedAgents.length === 0) {
      errors.push('At least one agent must be selected')
    }

    if (!journeyData.roiData || !journeyData.roiData.savings) {
      errors.push('ROI data is required')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Create a default proposal template (fallback if AI fails)
   *
   * @param {Object} context - Proposal context
   * @returns {string} Markdown proposal
   */
  createDefaultProposal(context) {
    return `# Коммерческое предложение
## Внедрение ИИ-агентов для ${context.organization.name}

### Анализ текущей ситуации

На основе предоставленных данных, ваша компания в отрасли "${context.organization.industry}" ежемесячно несет следующие затраты на персонал:

- **Ежемесячные затраты:** ₽${context.currentCosts.totalMonthlyCosts?.toLocaleString() || context.currentCosts.salaries?.toLocaleString()}
- **Количество сотрудников:** ${context.currentCosts.employeeCount || 'не указано'}

### Предлагаемое решение

Мы предлагаем внедрить ${context.selectedAgents.length} ИИ-агентов для автоматизации следующих функций:

${context.selectedAgents.map((agent, index) => `${index + 1}. **${agent.name}**: ${agent.description}`).join('\n')}

### Экономический эффект

**Текущие затраты:** ₽${context.roi.currentCosts?.toLocaleString() || 0} в месяц

**Стоимость агентов:** ₽${context.roi.agentCosts?.toLocaleString() || 0} в месяц

**Экономия:** ₽${context.roi.savings?.toLocaleString() || 0} в месяц (${context.roi.savingsPercent || 0}%)

**Окупаемость:** ${context.roi.paybackDays || 0} дней

### План внедрения

1. **Этап 1 (1-2 недели):** Настройка и интеграция агентов
2. **Этап 2 (2-4 недели):** Обучение и тестирование
3. **Этап 3 (1 неделя):** Запуск в production

### Следующие шаги

1. Зарегистрируйтесь на платформе DronDoc
2. Получите 2 недели бесплатного доступа
3. Начните использовать агентов уже сегодня

---

*Это предложение сформировано автоматически на основе анализа вашего бизнеса.*
`
  }
}

// Export singleton instance
export const proposalService = new ProposalService()

// Export class for testing/customization
export default ProposalService
