// Agricultural Products API Routes
// Manages catalog of agricultural products (fertilizers, pesticides, etc.)
// Issue #1146 - Recipe Management Module

import express from 'express'
import { body, param, query, validationResult } from 'express-validator'

const router = express.Router()

/**
 * Validation middleware
 */
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() })
  }
  next()
}

/**
 * GET /api/agro-products
 * Get all products with optional filters
 */
router.get('/', [
  query('category').optional().isString(),
  query('manufacturer').optional().isString(),
  query('search').optional().isString(),
  query('active').optional().isBoolean(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], validate, async (req, res) => {
  try {
    const { db } = req.app.locals
    const {
      category,
      manufacturer,
      search,
      active = true,
      limit = 50,
      offset = 0
    } = req.query

    let query = `
      SELECT
        id, name, manufacturer, active_ingredient, form, concentration,
        concentration_unit, purpose, application_rates, restrictions,
        compatibility, waiting_period, hazard_class, category,
        description, is_active, created_at, updated_at
      FROM agro_products
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1

    if (active !== undefined) {
      query += ` AND is_active = $${paramIndex}`
      params.push(active)
      paramIndex++
    }

    if (category) {
      query += ` AND category = $${paramIndex}`
      params.push(category)
      paramIndex++
    }

    if (manufacturer) {
      query += ` AND manufacturer ILIKE $${paramIndex}`
      params.push(`%${manufacturer}%`)
      paramIndex++
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR active_ingredient ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    query += ` ORDER BY name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM agro_products WHERE 1=1'
    const countParams = []
    let countIndex = 1

    if (active !== undefined) {
      countQuery += ` AND is_active = $${countIndex}`
      countParams.push(active)
      countIndex++
    }

    if (category) {
      countQuery += ` AND category = $${countIndex}`
      countParams.push(category)
      countIndex++
    }

    if (manufacturer) {
      countQuery += ` AND manufacturer ILIKE $${countIndex}`
      countParams.push(`%${manufacturer}%`)
      countIndex++
    }

    if (search) {
      countQuery += ` AND (name ILIKE $${countIndex} OR active_ingredient ILIKE $${countIndex} OR description ILIKE $${countIndex})`
      countParams.push(`%${search}%`)
    }

    const countResult = await db.query(countQuery, countParams)

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
      message: error.message
    })
  }
})

/**
 * GET /api/agro-products/:id
 * Get a specific product by ID
 */
router.get('/:id', [
  param('id').isUUID()
], validate, async (req, res) => {
  try {
    const { db } = req.app.locals
    const { id } = req.params

    const result = await db.query(`
      SELECT * FROM agro_products WHERE id = $1
    `, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      })
    }

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error fetching product:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product',
      message: error.message
    })
  }
})

/**
 * POST /api/agro-products
 * Create a new product
 */
router.post('/', [
  body('name').isString().trim().isLength({ min: 1, max: 255 }),
  body('manufacturer').optional().isString().trim(),
  body('activeIngredient').optional().isString().trim(),
  body('form').optional().isIn(['liquid', 'powder', 'granules', 'tablet', 'emulsion']),
  body('concentration').optional().isFloat({ min: 0 }),
  body('concentrationUnit').optional().isString(),
  body('purpose').optional().isString(),
  body('applicationRates').optional().isObject(),
  body('restrictions').optional().isString(),
  body('compatibility').optional().isObject(),
  body('waitingPeriod').optional().isInt({ min: 0 }),
  body('hazardClass').optional().isInt({ min: 1, max: 4 }),
  body('category').optional().isIn(['fertilizer', 'pesticide', 'fungicide', 'herbicide', 'insecticide', 'growth_regulator', 'other']),
  body('description').optional().isString(),
  body('metadata').optional().isObject()
], validate, async (req, res) => {
  try {
    const { db } = req.app.locals
    const {
      name,
      manufacturer = null,
      activeIngredient = null,
      form = null,
      concentration = null,
      concentrationUnit = null,
      purpose = null,
      applicationRates = {},
      restrictions = null,
      compatibility = {},
      waitingPeriod = null,
      hazardClass = null,
      category = 'other',
      description = null,
      metadata = {},
      createdBy = 'system'
    } = req.body

    const result = await db.query(`
      INSERT INTO agro_products (
        name, manufacturer, active_ingredient, form, concentration,
        concentration_unit, purpose, application_rates, restrictions,
        compatibility, waiting_period, hazard_class, category,
        description, metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      name, manufacturer, activeIngredient, form, concentration,
      concentrationUnit, purpose, JSON.stringify(applicationRates), restrictions,
      JSON.stringify(compatibility), waitingPeriod, hazardClass, category,
      description, JSON.stringify(metadata), createdBy
    ])

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Product created successfully'
    })
  } catch (error) {
    console.error('Error creating product:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create product',
      message: error.message
    })
  }
})

/**
 * PUT /api/agro-products/:id
 * Update a product
 */
router.put('/:id', [
  param('id').isUUID(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 255 }),
  body('manufacturer').optional().isString().trim(),
  body('activeIngredient').optional().isString().trim(),
  body('form').optional().isIn(['liquid', 'powder', 'granules', 'tablet', 'emulsion']),
  body('concentration').optional().isFloat({ min: 0 }),
  body('concentrationUnit').optional().isString(),
  body('purpose').optional().isString(),
  body('applicationRates').optional().isObject(),
  body('restrictions').optional().isString(),
  body('compatibility').optional().isObject(),
  body('waitingPeriod').optional().isInt({ min: 0 }),
  body('hazardClass').optional().isInt({ min: 1, max: 4 }),
  body('category').optional().isIn(['fertilizer', 'pesticide', 'fungicide', 'herbicide', 'insecticide', 'growth_regulator', 'other']),
  body('description').optional().isString(),
  body('isActive').optional().isBoolean(),
  body('metadata').optional().isObject()
], validate, async (req, res) => {
  try {
    const { db } = req.app.locals
    const { id } = req.params
    const updates = req.body

    const setClauses = []
    const values = []
    let paramIndex = 1

    // Map camelCase to snake_case and build SET clause
    const fieldMapping = {
      name: 'name',
      manufacturer: 'manufacturer',
      activeIngredient: 'active_ingredient',
      form: 'form',
      concentration: 'concentration',
      concentrationUnit: 'concentration_unit',
      purpose: 'purpose',
      applicationRates: 'application_rates',
      restrictions: 'restrictions',
      compatibility: 'compatibility',
      waitingPeriod: 'waiting_period',
      hazardClass: 'hazard_class',
      category: 'category',
      description: 'description',
      isActive: 'is_active',
      metadata: 'metadata'
    }

    Object.entries(updates).forEach(([key, value]) => {
      const dbField = fieldMapping[key]
      if (dbField) {
        setClauses.push(`${dbField} = $${paramIndex}`)
        if (key === 'applicationRates' || key === 'compatibility' || key === 'metadata') {
          values.push(JSON.stringify(value))
        } else {
          values.push(value)
        }
        paramIndex++
      }
    })

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid updates provided'
      })
    }

    values.push(id)

    const result = await db.query(`
      UPDATE agro_products
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values)

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      })
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Product updated successfully'
    })
  } catch (error) {
    console.error('Error updating product:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update product',
      message: error.message
    })
  }
})

/**
 * DELETE /api/agro-products/:id
 * Soft delete a product (set is_active = false)
 */
router.delete('/:id', [
  param('id').isUUID()
], validate, async (req, res) => {
  try {
    const { db } = req.app.locals
    const { id } = req.params

    const result = await db.query(`
      UPDATE agro_products
      SET is_active = false
      WHERE id = $1
      RETURNING id, name
    `, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      })
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Product deactivated successfully'
    })
  } catch (error) {
    console.error('Error deleting product:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete product',
      message: error.message
    })
  }
})

/**
 * GET /api/agro-products/categories
 * Get list of product categories with counts
 */
router.get('/meta/categories', async (req, res) => {
  try {
    const { db } = req.app.locals

    const result = await db.query(`
      SELECT
        category,
        COUNT(*) as count
      FROM agro_products
      WHERE is_active = true
      GROUP BY category
      ORDER BY category
    `)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
      message: error.message
    })
  }
})

/**
 * GET /api/agro-products/stats
 * Get product usage statistics
 */
router.get('/meta/stats', async (req, res) => {
  try {
    const { db } = req.app.locals

    const result = await db.query(`
      SELECT * FROM v_product_usage_stats
      ORDER BY recipe_count DESC, application_count DESC
      LIMIT 50
    `)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    })
  }
})

export default router
