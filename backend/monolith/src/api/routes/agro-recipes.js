// Agricultural Recipes API Routes
// Manages treatment recipes for agricultural fields
// Issue #1146 - Recipe Management Module

import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { pool } from '../../config/database.js'

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
 * GET /api/agro-recipes
 * Get all recipes with optional filters
 */
router.get('/', [
  query('cropType').optional().isString(),
  query('purpose').optional().isString(),
  query('isPublic').optional().isBoolean(),
  query('createdBy').optional().isString(),
  query('search').optional().isString(),
  query('minRating').optional().isFloat({ min: 0, max: 5 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], validate, async (req, res) => {
  try {
    const { db } = req.app.locals
    const {
      cropType,
      purpose,
      isPublic,
      createdBy,
      search,
      minRating,
      limit = 50,
      offset = 0
    } = req.query

    let query = `
      SELECT * FROM v_recipes_full
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1

    if (cropType) {
      query += ` AND crop_type = $${paramIndex}`
      params.push(cropType)
      paramIndex++
    }

    if (purpose) {
      query += ` AND purpose = $${paramIndex}`
      params.push(purpose)
      paramIndex++
    }

    if (isPublic !== undefined) {
      query += ` AND is_public = $${paramIndex}`
      params.push(isPublic)
      paramIndex++
    }

    if (createdBy) {
      query += ` AND created_by = $${paramIndex}`
      params.push(createdBy)
      paramIndex++
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    if (minRating) {
      query += ` AND rating >= $${paramIndex}`
      params.push(minRating)
      paramIndex++
    }

    query += ` ORDER BY rating DESC, usage_count DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM agro_recipes WHERE 1=1'
    const countParams = []
    let countIndex = 1

    if (cropType) {
      countQuery += ` AND crop_type = $${countIndex}`
      countParams.push(cropType)
      countIndex++
    }

    if (purpose) {
      countQuery += ` AND purpose = $${countIndex}`
      countParams.push(purpose)
      countIndex++
    }

    if (isPublic !== undefined) {
      countQuery += ` AND is_public = $${countIndex}`
      countParams.push(isPublic)
      countIndex++
    }

    if (createdBy) {
      countQuery += ` AND created_by = $${countIndex}`
      countParams.push(createdBy)
      countIndex++
    }

    if (search) {
      countQuery += ` AND (name ILIKE $${countIndex} OR description ILIKE $${countIndex})`
      countParams.push(`%${search}%`)
      countIndex++
    }

    if (minRating) {
      countQuery += ` AND rating >= $${countIndex}`
      countParams.push(minRating)
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
    console.error('Error fetching recipes:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recipes',
      message: error.message
    })
  }
})

/**
 * GET /api/agro-recipes/:id
 * Get a specific recipe with full details including products
 */
router.get('/:id', [
  param('id').isUUID()
], validate, async (req, res) => {
  try {
    const { db } = req.app.locals
    const { id } = req.params

    // Get recipe details
    const recipeResult = await db.query(`
      SELECT * FROM v_recipes_full WHERE id = $1
    `, [id])

    if (recipeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found'
      })
    }

    // Get recipe items (products)
    const itemsResult = await db.query(`
      SELECT
        ri.id,
        ri.dosage,
        ri.unit,
        ri.order_index,
        ri.notes,
        p.id as product_id,
        p.name as product_name,
        p.manufacturer,
        p.active_ingredient,
        p.form,
        p.category,
        p.hazard_class
      FROM recipe_items ri
      JOIN agro_products p ON ri.product_id = p.id
      WHERE ri.recipe_id = $1
      ORDER BY ri.order_index
    `, [id])

    const recipe = {
      ...recipeResult.rows[0],
      items: itemsResult.rows
    }

    res.json({
      success: true,
      data: recipe
    })
  } catch (error) {
    console.error('Error fetching recipe:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recipe',
      message: error.message
    })
  }
})

/**
 * POST /api/agro-recipes
 * Create a new recipe
 */
router.post('/', [
  body('name').isString().trim().isLength({ min: 1, max: 255 }),
  body('description').optional().isString(),
  body('cropType').optional().isString(),
  body('growthStage').optional().isString(),
  body('purpose').optional().isString(),
  body('applicationMethod').optional().isString(),
  body('weatherConditions').optional().isObject(),
  body('instructions').optional().isString(),
  body('isPublic').optional().isBoolean(),
  body('metadata').optional().isObject(),
  body('items').isArray().notEmpty(),
  body('items.*.productId').isUUID(),
  body('items.*.dosage').isFloat({ min: 0 }),
  body('items.*.unit').isString(),
  body('items.*.orderIndex').optional().isInt({ min: 0 }),
  body('items.*.notes').optional().isString()
], validate, async (req, res) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const {
      name,
      description = null,
      cropType = null,
      growthStage = null,
      purpose = null,
      applicationMethod = null,
      weatherConditions = {},
      instructions = null,
      isPublic = false,
      metadata = {},
      items,
      createdBy = 'system'
    } = req.body

    // Create recipe
    const recipeResult = await client.query(`
      INSERT INTO agro_recipes (
        name, description, crop_type, growth_stage, purpose,
        application_method, weather_conditions, instructions,
        is_public, metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      name, description, cropType, growthStage, purpose,
      applicationMethod, JSON.stringify(weatherConditions), instructions,
      isPublic, JSON.stringify(metadata), createdBy
    ])

    const recipeId = recipeResult.rows[0].id

    // Check product compatibility
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const compatResult = await client.query(`
          SELECT compatibility FROM product_compatibility
          WHERE (product_a_id = $1 AND product_b_id = $2)
             OR (product_a_id = $2 AND product_b_id = $1)
        `, [items[i].productId, items[j].productId])

        if (compatResult.rows.length > 0 && compatResult.rows[0].compatibility === 'incompatible') {
          await client.query('ROLLBACK')
          return res.status(400).json({
            success: false,
            error: 'Incompatible products detected',
            details: `Products at positions ${i} and ${j} are incompatible`
          })
        }
      }
    }

    // Insert recipe items
    const itemPromises = items.map((item, index) => {
      return client.query(`
        INSERT INTO recipe_items (
          recipe_id, product_id, dosage, unit, order_index, notes
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        recipeId,
        item.productId,
        item.dosage,
        item.unit,
        item.orderIndex !== undefined ? item.orderIndex : index,
        item.notes || null
      ])
    })

    await Promise.all(itemPromises)

    await client.query('COMMIT')

    // Fetch complete recipe
    const completeRecipe = await pool.query(`
      SELECT * FROM v_recipes_full WHERE id = $1
    `, [recipeId])

    const itemsResult = await pool.query(`
      SELECT
        ri.id,
        ri.dosage,
        ri.unit,
        ri.order_index,
        ri.notes,
        p.id as product_id,
        p.name as product_name,
        p.manufacturer,
        p.category
      FROM recipe_items ri
      JOIN agro_products p ON ri.product_id = p.id
      WHERE ri.recipe_id = $1
      ORDER BY ri.order_index
    `, [recipeId])

    res.status(201).json({
      success: true,
      data: {
        ...completeRecipe.rows[0],
        items: itemsResult.rows
      },
      message: 'Recipe created successfully'
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error creating recipe:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create recipe',
      message: error.message
    })
  } finally {
    client.release()
  }
})

/**
 * PUT /api/agro-recipes/:id
 * Update a recipe
 */
router.put('/:id', [
  param('id').isUUID(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 255 }),
  body('description').optional().isString(),
  body('cropType').optional().isString(),
  body('growthStage').optional().isString(),
  body('purpose').optional().isString(),
  body('applicationMethod').optional().isString(),
  body('weatherConditions').optional().isObject(),
  body('instructions').optional().isString(),
  body('isPublic').optional().isBoolean(),
  body('metadata').optional().isObject()
], validate, async (req, res) => {
  try {
    const { db } = req.app.locals
    const { id } = req.params
    const updates = req.body

    const setClauses = []
    const values = []
    let paramIndex = 1

    const fieldMapping = {
      name: 'name',
      description: 'description',
      cropType: 'crop_type',
      growthStage: 'growth_stage',
      purpose: 'purpose',
      applicationMethod: 'application_method',
      weatherConditions: 'weather_conditions',
      instructions: 'instructions',
      isPublic: 'is_public',
      metadata: 'metadata'
    }

    Object.entries(updates).forEach(([key, value]) => {
      const dbField = fieldMapping[key]
      if (dbField) {
        setClauses.push(`${dbField} = $${paramIndex}`)
        if (key === 'weatherConditions' || key === 'metadata') {
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
      UPDATE agro_recipes
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values)

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found'
      })
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Recipe updated successfully'
    })
  } catch (error) {
    console.error('Error updating recipe:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update recipe',
      message: error.message
    })
  }
})

/**
 * DELETE /api/agro-recipes/:id
 * Delete a recipe
 */
router.delete('/:id', [
  param('id').isUUID()
], validate, async (req, res) => {
  try {
    const { db } = req.app.locals
    const { id } = req.params

    const result = await db.query(`
      DELETE FROM agro_recipes
      WHERE id = $1
      RETURNING id, name
    `, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found'
      })
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Recipe deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting recipe:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete recipe',
      message: error.message
    })
  }
})

/**
 * POST /api/agro-recipes/:id/clone
 * Clone a recipe
 */
router.post('/:id/clone', [
  param('id').isUUID(),
  body('name').optional().isString(),
  body('createdBy').optional().isString()
], validate, async (req, res) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const { id } = req.params
    const { name, createdBy = 'system' } = req.body

    // Get original recipe
    const originalRecipe = await client.query(`
      SELECT * FROM agro_recipes WHERE id = $1
    `, [id])

    if (originalRecipe.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        success: false,
        error: 'Recipe not found'
      })
    }

    const original = originalRecipe.rows[0]

    // Create new recipe
    const newRecipe = await client.query(`
      INSERT INTO agro_recipes (
        name, description, crop_type, growth_stage, purpose,
        application_method, weather_conditions, instructions,
        is_public, metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      name || `${original.name} (Copy)`,
      original.description,
      original.crop_type,
      original.growth_stage,
      original.purpose,
      original.application_method,
      original.weather_conditions,
      original.instructions,
      false, // Clones are private by default
      original.metadata,
      createdBy
    ])

    const newRecipeId = newRecipe.rows[0].id

    // Copy recipe items
    await client.query(`
      INSERT INTO recipe_items (recipe_id, product_id, dosage, unit, order_index, notes)
      SELECT $1, product_id, dosage, unit, order_index, notes
      FROM recipe_items
      WHERE recipe_id = $2
    `, [newRecipeId, id])

    await client.query('COMMIT')

    res.status(201).json({
      success: true,
      data: newRecipe.rows[0],
      message: 'Recipe cloned successfully'
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error cloning recipe:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to clone recipe',
      message: error.message
    })
  } finally {
    client.release()
  }
})

/**
 * POST /api/agro-recipes/:id/rate
 * Rate a recipe
 */
router.post('/:id/rate', [
  param('id').isUUID(),
  body('userId').isString().trim().notEmpty(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().isString()
], validate, async (req, res) => {
  try {
    const { db } = req.app.locals
    const { id } = req.params
    const { userId, rating, comment = null } = req.body

    const result = await db.query(`
      INSERT INTO recipe_ratings (recipe_id, user_id, rating, comment)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (recipe_id, user_id)
      DO UPDATE SET rating = $3, comment = $4, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [id, userId, rating, comment])

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Rating submitted successfully'
    })
  } catch (error) {
    console.error('Error rating recipe:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to rate recipe',
      message: error.message
    })
  }
})

/**
 * GET /api/agro-recipes/top-rated
 * Get top rated recipes
 */
router.get('/meta/top-rated', async (req, res) => {
  try {
    const { db } = req.app.locals

    const result = await db.query(`
      SELECT * FROM v_top_rated_recipes LIMIT 20
    `)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Error fetching top rated recipes:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top rated recipes',
      message: error.message
    })
  }
})

export default router
