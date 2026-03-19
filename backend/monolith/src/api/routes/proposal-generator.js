/**
 * Proposal Generator API Routes
 *
 * Issue #4467 - Generate commercial proposals with AI and web scraping
 *
 * Endpoints:
 * - POST /api/proposal-generator/generate - Generate a new proposal
 * - GET /api/proposal-generator/analyze/:domain - Analyze company website
 * - GET /api/proposal-generator/salary/:position/:region - Get salary data
 * - GET /api/proposal-generator/proposals - List all generated proposals
 */

import express from 'express'
import ProposalGeneratorService from '../../services/proposal-generator/ProposalGeneratorService.js'

const router = express.Router()

/**
 * POST /api/proposal-generator/generate
 *
 * Generate a commercial proposal for a company
 *
 * Body:
 * {
 *   "companyName": "ООО Ромашка",
 *   "domain": "romashka.ru",
 *   "region": "Москва",
 *   "userId": "user-123"
 * }
 */
router.post('/generate', async (req, res) => {
  try {
    const { companyName, domain, region, userId } = req.body

    if (!companyName) {
      return res.status(400).json({
        error: 'Company name is required',
        message: 'Please provide companyName in request body'
      })
    }

    // Get database connection from request (set by middleware)
    const db = req.app.get('db')

    // Initialize service
    const service = new ProposalGeneratorService({ db })

    // Generate proposal
    const result = await service.generateProposal({
      companyName,
      domain,
      region,
      userId: userId || 'anonymous'
    })

    res.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('[ProposalGeneratorAPI] Error:', error)
    res.status(500).json({
      error: 'Failed to generate proposal',
      message: error.message
    })
  }
})

/**
 * GET /api/proposal-generator/analyze/:domain
 *
 * Analyze a company website without generating full proposal
 */
router.get('/analyze/:domain', async (req, res) => {
  try {
    const { domain } = req.params

    if (!domain) {
      return res.status(400).json({
        error: 'Domain is required'
      })
    }

    const db = req.app.get('db')
    const service = new ProposalGeneratorService({ db })

    // Collect company data
    const companyData = await service.collectCompanyData({
      companyName: 'Unknown',
      domain,
      region: null
    })

    // Detect industry
    const industryData = await service.detectIndustryAndRegion(companyData)

    // Analyze routine
    const routineAnalysis = await service.analyzeWebsiteRoutine(companyData.website)

    res.json({
      success: true,
      data: {
        company: companyData,
        industry: industryData,
        routine: routineAnalysis
      }
    })

  } catch (error) {
    console.error('[ProposalGeneratorAPI] Analyze error:', error)
    res.status(500).json({
      error: 'Failed to analyze website',
      message: error.message
    })
  }
})

/**
 * GET /api/proposal-generator/salary/:position/:region
 *
 * Get salary data for a specific position in a region
 */
router.get('/salary/:position/:region?', async (req, res) => {
  try {
    const { position, region } = req.params

    if (!position) {
      return res.status(400).json({
        error: 'Position is required'
      })
    }

    const db = req.app.get('db')
    const service = new ProposalGeneratorService({ db })

    // Parse salary data
    const salary = await service.parseHHSalary(position, region || 'Москва')

    if (!salary) {
      return res.json({
        success: false,
        message: 'No salary data found for this position',
        data: null
      })
    }

    res.json({
      success: true,
      data: {
        position,
        region: region || 'Москва',
        averageSalary: salary,
        fullCost: Math.round(salary * 1.3)
      }
    })

  } catch (error) {
    console.error('[ProposalGeneratorAPI] Salary error:', error)
    res.status(500).json({
      error: 'Failed to fetch salary data',
      message: error.message
    })
  }
})

/**
 * GET /api/proposal-generator/proposals
 *
 * List all generated proposals (placeholder for future Integram integration)
 */
router.get('/proposals', async (req, res) => {
  try {
    // TODO: Fetch from Integram storage
    // For now, return empty list

    res.json({
      success: true,
      data: {
        proposals: [],
        count: 0,
        message: 'Proposal history requires Integram integration (to be implemented)'
      }
    })

  } catch (error) {
    console.error('[ProposalGeneratorAPI] List error:', error)
    res.status(500).json({
      error: 'Failed to fetch proposals',
      message: error.message
    })
  }
})

/**
 * GET /api/proposal-generator/okved-positions/:okved
 *
 * Get target positions for a specific OKVED code
 */
router.get('/okved-positions/:okved', (req, res) => {
  try {
    const { okved } = req.params

    const db = req.app.get('db')
    const service = new ProposalGeneratorService({ db })

    const positions = service.okvedJobMapping[okved] || []

    res.json({
      success: true,
      data: {
        okved,
        positions,
        count: positions.length
      }
    })

  } catch (error) {
    console.error('[ProposalGeneratorAPI] OKVED positions error:', error)
    res.status(500).json({
      error: 'Failed to fetch OKVED positions',
      message: error.message
    })
  }
})

export default router
