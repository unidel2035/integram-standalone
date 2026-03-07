import express from 'express'

const router = express.Router()

/**
 * Glossary data - synced with frontend src/data/glossary.js
 * This allows MCP tools and AI agents to access term definitions
 */
const glossaryTerms = {
  // Financial terms
  irr: {
    id: 'irr',
    title: 'IRR — Внутренняя норма доходности',
    category: 'financial',
    definition: 'Ставка дисконтирования, при которой чистая приведённая стоимость (NPV) инвестиции равна нулю. Показывает эффективность инвестиций в % годовых.',
    formula: 'IRR = 25% означает: ₽1 млн → ₽1.25 млн через год'
  },
  moic: {
    id: 'moic',
    title: 'MOIC — Множитель инвестиций',
    category: 'financial',
    definition: 'Отношение общей стоимости (выходы + текущая стоимость) к первоначальным инвестициям. Показывает, во сколько раз увеличился капитал.',
    formula: 'MOIC = (Выходы + Текущая стоимость) / Инвестиции'
  },
  dpi: {
    id: 'dpi',
    title: 'DPI — Реализованная стоимость',
    category: 'financial',
    definition: 'Distributions to Paid-In — отношение распределённых средств к внесённому капиталу. Показывает реальные денежные возвраты.',
    formula: 'DPI = Распределения / Внесённый капитал'
  },
  tvpi: {
    id: 'tvpi',
    title: 'TVPI — Общая стоимость',
    category: 'financial',
    definition: 'Total Value to Paid-In — сумма распределений и остаточной стоимости портфеля к внесённому капиталу.',
    formula: 'TVPI = (Распределения + Остаточная стоимость) / Внесённый капитал'
  },
  nav: {
    id: 'nav',
    title: 'NAV — Чистая стоимость активов',
    category: 'financial',
    definition: 'Net Asset Value — оценочная стоимость всех активов фонда за вычетом обязательств.',
    formula: 'NAV = Активы - Обязательства'
  }
  // Note: Full glossary with 65 terms is maintained in frontend src/data/glossary.js
  // This backend endpoint provides a lightweight API for MCP tool access
}

/**
 * GET /api/glossary/terms
 * Get all glossary terms
 */
router.get('/terms', (req, res) => {
  res.json({
    success: true,
    count: Object.keys(glossaryTerms).length,
    terms: glossaryTerms
  })
})

/**
 * GET /api/glossary/term/:id
 * Get specific term by ID
 */
router.get('/term/:id', (req, res) => {
  const { id } = req.params
  const term = glossaryTerms[id]

  if (!term) {
    return res.status(404).json({
      success: false,
      error: 'Term not found',
      availableTerms: Object.keys(glossaryTerms)
    })
  }

  res.json({
    success: true,
    term
  })
})

/**
 * POST /api/glossary/search
 * Search glossary terms
 */
router.post('/search', (req, res) => {
  const { query } = req.body

  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Query parameter required'
    })
  }

  const lowerQuery = query.toLowerCase()
  const results = Object.values(glossaryTerms).filter(term =>
    term.title.toLowerCase().includes(lowerQuery) ||
    term.definition.toLowerCase().includes(lowerQuery) ||
    term.category.toLowerCase().includes(lowerQuery)
  )

  res.json({
    success: true,
    query,
    count: results.length,
    results
  })
})

/**
 * MCP Tool: get_term_definition
 * Usage for AI agents: POST /api/glossary/mcp/get_term_definition
 * Body: { term: "irr" }
 */
router.post('/mcp/get_term_definition', (req, res) => {
  const { term: termId } = req.body

  if (!termId) {
    return res.status(400).json({
      success: false,
      error: 'term parameter required',
      usage: 'POST /api/glossary/mcp/get_term_definition with body: { term: "irr" }'
    })
  }

  const term = glossaryTerms[termId.toLowerCase()]

  if (!term) {
    // Try searching by title
    const searchResult = Object.values(glossaryTerms).find(t =>
      t.title.toLowerCase().includes(termId.toLowerCase())
    )

    if (searchResult) {
      return res.json({
        success: true,
        term: searchResult,
        note: `Found by title search for "${termId}"`
      })
    }

    return res.status(404).json({
      success: false,
      error: `Term "${termId}" not found`,
      suggestion: 'Try searching with /api/glossary/search',
      availableTerms: Object.keys(glossaryTerms).slice(0, 10)
    })
  }

  res.json({
    success: true,
    term: {
      id: term.id,
      title: term.title,
      definition: term.definition,
      formula: term.formula,
      category: term.category
    }
  })
})

export default router
