/**
 * Glossary API Routes
 * MCP Tool: get_term_definition(term: string)
 *
 * Provides AI agents with access to venture capital glossary
 * Issue #114 - feat(education): страница /fst-glossary
 */

import { Router } from 'express'

const router = Router()

// Glossary data - synchronized with frontend src/data/glossary.js
// In production, this could be stored in Integram database
const glossaryTerms = {
  irr: {
    id: 'irr',
    title: 'IRR — Внутренняя норма доходности',
    category: 'financial',
    definition: 'Ставка дисконтирования, при которой чистая приведённая стоимость (NPV) инвестиции равна нулю. Показывает эффективность инвестиций в % годовых.',
    formula: 'IRR = 25% означает: ₽1 млн → ₽1.25 млн через год',
    example: 'Фонд инвестировал ₽10 млн в стартап. Через 5 лет фонд получил ₽50 млн. IRR составил 38% годовых, что выше целевого показателя в 25%.',
    relatedTerms: ['moic', 'dpi', 'tvpi', 'nav'],
    context: 'Ключевая метрика для оценки доходности фонда и сравнения с альтернативными инвестициями.'
  },
  moic: {
    id: 'moic',
    title: 'MOIC — Множитель инвестиций',
    category: 'financial',
    definition: 'Отношение общей стоимости (выходы + текущая стоимость) к первоначальным инвестициям. Показывает, во сколько раз увеличился капитал.',
    formula: 'MOIC = (Выходы + Текущая стоимость) / Инвестиции',
    example: 'Инвестиция ₽5 млн, текущая оценка портфеля ₽15 млн. MOIC = 3.0x — капитал утроился.',
    relatedTerms: ['irr', 'dpi', 'tvpi'],
    context: 'Простая метрика для быстрой оценки успешности инвестиции без учёта времени.'
  },
  // Add more terms as needed - this is a simplified version for MCP
  // Full glossary is in frontend src/data/glossary.js
}

/**
 * GET /api/fst/glossary/terms
 * Get all glossary terms
 */
router.get('/glossary/terms', (req, res) => {
  try {
    const { category, search } = req.query

    let terms = Object.values(glossaryTerms)

    // Filter by category if provided
    if (category) {
      terms = terms.filter(term => term.category === category)
    }

    // Search if query provided
    if (search) {
      const searchLower = search.toLowerCase()
      terms = terms.filter(term =>
        term.title.toLowerCase().includes(searchLower) ||
        term.definition.toLowerCase().includes(searchLower)
      )
    }

    res.json({
      success: true,
      count: terms.length,
      terms
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
})

/**
 * GET /api/fst/glossary/term/:termId
 * Get specific term definition (MCP Tool endpoint)
 */
router.get('/glossary/term/:termId', (req, res) => {
  try {
    const { termId } = req.params
    const term = glossaryTerms[termId.toLowerCase()]

    if (!term) {
      return res.status(404).json({
        success: false,
        error: 'Term not found',
        message: `Термин "${termId}" не найден в глоссарии`
      })
    }

    res.json({
      success: true,
      term
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
})

/**
 * GET /api/fst/glossary/categories
 * Get all categories
 */
router.get('/glossary/categories', (req, res) => {
  try {
    const categories = [
      { id: 'financial', label: 'Финансовые метрики', icon: 'pi-chart-line' },
      { id: 'venture', label: 'Венчурные термины', icon: 'pi-briefcase' },
      { id: 'ai', label: 'AI & Технологии', icon: 'pi-sparkles' },
      { id: 'regulation', label: 'Регулирование', icon: 'pi-shield' },
      { id: 'platform', label: 'Платформа', icon: 'pi-desktop' }
    ]

    res.json({
      success: true,
      categories
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
})

export default router
