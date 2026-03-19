// agricultural-missions.js - Agricultural mission management routes
import express from 'express'
import { pool } from '../../config/database.js'
import logger from '../../utils/logger.js'

export function createAgriculturalMissionRoutes() {
  const router = express.Router()

  // ============================================================
  // FIELDS ENDPOINTS
  // ============================================================

  /**
   * Get all fields
   */
  router.get('/fields', async (req, res, next) => {
    try {
      const { active, crop_type } = req.query

      let query = 'SELECT * FROM fields WHERE 1=1'
      const params = []

      if (active !== undefined) {
        params.push(active === 'true')
        query += ` AND is_active = $${params.length}`
      }

      if (crop_type) {
        params.push(crop_type)
        query += ` AND crop_type = $${params.length}`
      }

      query += ' ORDER BY created_at DESC'

      const result = await pool.query(query, params)

      res.json({
        success: true,
        count: result.rows.length,
        fields: result.rows
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get fields')
      next(error)
    }
  })

  /**
   * Get field by ID
   */
  router.get('/fields/:id', async (req, res, next) => {
    try {
      const result = await pool.query('SELECT * FROM fields WHERE id = $1', [req.params.id])

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Field not found' })
      }

      res.json({
        success: true,
        field: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get field')
      next(error)
    }
  })

  /**
   * Create new field
   */
  router.post('/fields', async (req, res, next) => {
    try {
      const {
        name,
        description,
        farm_name,
        area,
        geometry,
        center_latitude,
        center_longitude,
        crop_type,
        soil_type,
        obstacles,
        buffer_zones,
        metadata,
        created_by
      } = req.body

      if (!name || !area || !geometry || !center_latitude || !center_longitude) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      const result = await pool.query(
        `INSERT INTO fields (name, description, farm_name, area, geometry, center_latitude,
          center_longitude, crop_type, soil_type, obstacles, buffer_zones, metadata, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          name,
          description,
          farm_name,
          area,
          JSON.stringify(geometry),
          center_latitude,
          center_longitude,
          crop_type,
          soil_type,
          JSON.stringify(obstacles || []),
          JSON.stringify(buffer_zones || {}),
          JSON.stringify(metadata || {}),
          created_by
        ]
      )

      res.status(201).json({
        success: true,
        field: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create field')
      next(error)
    }
  })

  /**
   * Update field
   */
  router.put('/fields/:id', async (req, res, next) => {
    try {
      const { id } = req.params
      const updates = req.body
      const allowedFields = [
        'name',
        'description',
        'farm_name',
        'area',
        'geometry',
        'center_latitude',
        'center_longitude',
        'crop_type',
        'soil_type',
        'obstacles',
        'buffer_zones',
        'metadata',
        'is_active'
      ]

      const setClause = []
      const values = []
      let paramCount = 1

      Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = $${paramCount}`)
          if (typeof updates[key] === 'object' && updates[key] !== null) {
            values.push(JSON.stringify(updates[key]))
          } else {
            values.push(updates[key])
          }
          paramCount++
        }
      })

      if (setClause.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' })
      }

      values.push(id)
      const query = `UPDATE fields SET ${setClause.join(', ')} WHERE id = $${paramCount} RETURNING *`

      const result = await pool.query(query, values)

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Field not found' })
      }

      res.json({
        success: true,
        field: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to update field')
      next(error)
    }
  })

  /**
   * Delete field
   */
  router.delete('/fields/:id', async (req, res, next) => {
    try {
      const result = await pool.query('DELETE FROM fields WHERE id = $1 RETURNING *', [
        req.params.id
      ])

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Field not found' })
      }

      res.json({
        success: true,
        message: 'Field deleted',
        field: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to delete field')
      next(error)
    }
  })

  // ============================================================
  // RECIPES ENDPOINTS
  // ============================================================

  /**
   * Get all recipes
   */
  router.get('/recipes', async (req, res, next) => {
    try {
      const { active, recipe_type } = req.query

      let query = 'SELECT * FROM recipes WHERE 1=1'
      const params = []

      if (active !== undefined) {
        params.push(active === 'true')
        query += ` AND is_active = $${params.length}`
      }

      if (recipe_type) {
        params.push(recipe_type)
        query += ` AND recipe_type = $${params.length}`
      }

      query += ' ORDER BY created_at DESC'

      const result = await pool.query(query, params)

      res.json({
        success: true,
        count: result.rows.length,
        recipes: result.rows
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get recipes')
      next(error)
    }
  })

  /**
   * Get recipe by ID
   */
  router.get('/recipes/:id', async (req, res, next) => {
    try {
      const result = await pool.query('SELECT * FROM recipes WHERE id = $1', [req.params.id])

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Recipe not found' })
      }

      res.json({
        success: true,
        recipe: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get recipe')
      next(error)
    }
  })

  /**
   * Create new recipe
   */
  router.post('/recipes', async (req, res, next) => {
    try {
      const {
        name,
        description,
        recipe_type,
        target_pest,
        crop_types,
        active_ingredients,
        application_rate,
        water_volume,
        droplet_size,
        temperature_min,
        temperature_max,
        wind_speed_max,
        rain_restriction_hours,
        buffer_zone_distance,
        re_entry_interval,
        safety_notes,
        mixing_instructions,
        metadata,
        created_by
      } = req.body

      if (!name || !recipe_type || !active_ingredients || !application_rate) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      const result = await pool.query(
        `INSERT INTO recipes (name, description, recipe_type, target_pest, crop_types,
          active_ingredients, application_rate, water_volume, droplet_size, temperature_min,
          temperature_max, wind_speed_max, rain_restriction_hours, buffer_zone_distance,
          re_entry_interval, safety_notes, mixing_instructions, metadata, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         RETURNING *`,
        [
          name,
          description,
          recipe_type,
          target_pest,
          JSON.stringify(crop_types || []),
          JSON.stringify(active_ingredients),
          application_rate,
          water_volume,
          droplet_size,
          temperature_min,
          temperature_max,
          wind_speed_max,
          rain_restriction_hours,
          buffer_zone_distance,
          re_entry_interval,
          safety_notes,
          mixing_instructions,
          JSON.stringify(metadata || {}),
          created_by
        ]
      )

      res.status(201).json({
        success: true,
        recipe: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create recipe')
      next(error)
    }
  })

  /**
   * Update recipe
   */
  router.put('/recipes/:id', async (req, res, next) => {
    try {
      const { id } = req.params
      const updates = req.body
      const allowedFields = [
        'name',
        'description',
        'recipe_type',
        'target_pest',
        'crop_types',
        'active_ingredients',
        'application_rate',
        'water_volume',
        'droplet_size',
        'temperature_min',
        'temperature_max',
        'wind_speed_max',
        'rain_restriction_hours',
        'buffer_zone_distance',
        're_entry_interval',
        'safety_notes',
        'mixing_instructions',
        'metadata',
        'is_active'
      ]

      const setClause = []
      const values = []
      let paramCount = 1

      Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = $${paramCount}`)
          if (typeof updates[key] === 'object' && updates[key] !== null) {
            values.push(JSON.stringify(updates[key]))
          } else {
            values.push(updates[key])
          }
          paramCount++
        }
      })

      if (setClause.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' })
      }

      values.push(id)
      const query = `UPDATE recipes SET ${setClause.join(', ')} WHERE id = $${paramCount} RETURNING *`

      const result = await pool.query(query, values)

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Recipe not found' })
      }

      res.json({
        success: true,
        recipe: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to update recipe')
      next(error)
    }
  })

  /**
   * Delete recipe
   */
  router.delete('/recipes/:id', async (req, res, next) => {
    try {
      const result = await pool.query('DELETE FROM recipes WHERE id = $1 RETURNING *', [
        req.params.id
      ])

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Recipe not found' })
      }

      res.json({
        success: true,
        message: 'Recipe deleted',
        recipe: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to delete recipe')
      next(error)
    }
  })

  // ============================================================
  // ORDERS ENDPOINTS
  // ============================================================

  /**
   * Get all orders
   */
  router.get('/orders', async (req, res, next) => {
    try {
      const { status, field_id } = req.query

      let query = `
        SELECT o.*, f.name as field_name, r.name as recipe_name
        FROM ag_orders o
        LEFT JOIN fields f ON o.field_id = f.id
        LEFT JOIN recipes r ON o.recipe_id = r.id
        WHERE 1=1
      `
      const params = []

      if (status) {
        params.push(status)
        query += ` AND o.status = $${params.length}`
      }

      if (field_id) {
        params.push(field_id)
        query += ` AND o.field_id = $${params.length}`
      }

      query += ' ORDER BY o.created_at DESC'

      const result = await pool.query(query, params)

      res.json({
        success: true,
        count: result.rows.length,
        orders: result.rows
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get orders')
      next(error)
    }
  })

  /**
   * Get order by ID
   */
  router.get('/orders/:id', async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT o.*, f.name as field_name, f.area as field_area, r.name as recipe_name
         FROM ag_orders o
         LEFT JOIN fields f ON o.field_id = f.id
         LEFT JOIN recipes r ON o.recipe_id = r.id
         WHERE o.id = $1`,
        [req.params.id]
      )

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' })
      }

      res.json({
        success: true,
        order: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get order')
      next(error)
    }
  })

  /**
   * Create new order
   */
  router.post('/orders', async (req, res, next) => {
    try {
      const {
        order_number,
        field_id,
        recipe_id,
        customer_name,
        customer_contact,
        service_type,
        scheduled_date,
        priority,
        weather_requirements,
        special_instructions,
        estimated_cost,
        metadata,
        created_by
      } = req.body

      if (!order_number || !field_id || !customer_name || !service_type) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      const result = await pool.query(
        `INSERT INTO ag_orders (order_number, field_id, recipe_id, customer_name, customer_contact,
          service_type, scheduled_date, priority, weather_requirements, special_instructions,
          estimated_cost, metadata, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          order_number,
          field_id,
          recipe_id,
          customer_name,
          customer_contact,
          service_type,
          scheduled_date,
          priority || 5,
          JSON.stringify(weather_requirements || {}),
          special_instructions,
          estimated_cost,
          JSON.stringify(metadata || {}),
          created_by
        ]
      )

      res.status(201).json({
        success: true,
        order: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create order')
      next(error)
    }
  })

  /**
   * Update order
   */
  router.put('/orders/:id', async (req, res, next) => {
    try {
      const { id } = req.params
      const updates = req.body
      const allowedFields = [
        'recipe_id',
        'customer_name',
        'customer_contact',
        'service_type',
        'status',
        'scheduled_date',
        'priority',
        'weather_requirements',
        'special_instructions',
        'estimated_cost',
        'actual_cost',
        'completed_at',
        'cancelled_at',
        'cancellation_reason',
        'metadata'
      ]

      const setClause = []
      const values = []
      let paramCount = 1

      Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = $${paramCount}`)
          if (typeof updates[key] === 'object' && updates[key] !== null) {
            values.push(JSON.stringify(updates[key]))
          } else {
            values.push(updates[key])
          }
          paramCount++
        }
      })

      if (setClause.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' })
      }

      values.push(id)
      const query = `UPDATE ag_orders SET ${setClause.join(', ')} WHERE id = $${paramCount} RETURNING *`

      const result = await pool.query(query, values)

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' })
      }

      res.json({
        success: true,
        order: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to update order')
      next(error)
    }
  })

  /**
   * Delete order
   */
  router.delete('/orders/:id', async (req, res, next) => {
    try {
      const result = await pool.query('DELETE FROM ag_orders WHERE id = $1 RETURNING *', [
        req.params.id
      ])

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' })
      }

      res.json({
        success: true,
        message: 'Order deleted',
        order: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to delete order')
      next(error)
    }
  })

  // ============================================================
  // DRONES ENDPOINTS
  // ============================================================

  /**
   * Get all agricultural drones
   */
  router.get('/drones', async (req, res, next) => {
    try {
      const { status, active } = req.query

      let query = 'SELECT * FROM ag_drones WHERE 1=1'
      const params = []

      if (status) {
        params.push(status)
        query += ` AND status = $${params.length}`
      }

      if (active !== undefined) {
        params.push(active === 'true')
        query += ` AND is_active = $${params.length}`
      }

      query += ' ORDER BY name'

      const result = await pool.query(query, params)

      res.json({
        success: true,
        count: result.rows.length,
        drones: result.rows
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get drones')
      next(error)
    }
  })

  /**
   * Get drone by ID
   */
  router.get('/drones/:id', async (req, res, next) => {
    try {
      const result = await pool.query('SELECT * FROM ag_drones WHERE id = $1', [req.params.id])

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Drone not found' })
      }

      res.json({
        success: true,
        drone: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get drone')
      next(error)
    }
  })

  /**
   * Create new drone
   */
  router.post('/drones', async (req, res, next) => {
    try {
      const {
        drone_id,
        name,
        model,
        manufacturer,
        drone_type,
        tank_capacity,
        spray_width,
        max_flight_time,
        max_payload,
        battery_capacity,
        connection_string,
        firmware_version,
        last_maintenance,
        next_maintenance,
        home_latitude,
        home_longitude,
        metadata
      } = req.body

      if (!drone_id || !name || !tank_capacity || !spray_width) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      const result = await pool.query(
        `INSERT INTO ag_drones (drone_id, name, model, manufacturer, drone_type, tank_capacity,
          spray_width, max_flight_time, max_payload, battery_capacity, connection_string,
          firmware_version, last_maintenance, next_maintenance, home_latitude, home_longitude, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING *`,
        [
          drone_id,
          name,
          model,
          manufacturer,
          drone_type || 'multirotor',
          tank_capacity,
          spray_width,
          max_flight_time,
          max_payload,
          battery_capacity,
          connection_string,
          firmware_version,
          last_maintenance,
          next_maintenance,
          home_latitude,
          home_longitude,
          JSON.stringify(metadata || {})
        ]
      )

      res.status(201).json({
        success: true,
        drone: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create drone')
      next(error)
    }
  })

  /**
   * Update drone
   */
  router.put('/drones/:id', async (req, res, next) => {
    try {
      const { id } = req.params
      const updates = req.body
      const allowedFields = [
        'name',
        'model',
        'manufacturer',
        'drone_type',
        'tank_capacity',
        'spray_width',
        'max_flight_time',
        'max_payload',
        'battery_capacity',
        'connection_string',
        'firmware_version',
        'last_maintenance',
        'next_maintenance',
        'flight_hours',
        'missions_completed',
        'status',
        'home_latitude',
        'home_longitude',
        'metadata',
        'is_active'
      ]

      const setClause = []
      const values = []
      let paramCount = 1

      Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = $${paramCount}`)
          if (typeof updates[key] === 'object' && updates[key] !== null) {
            values.push(JSON.stringify(updates[key]))
          } else {
            values.push(updates[key])
          }
          paramCount++
        }
      })

      if (setClause.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' })
      }

      values.push(id)
      const query = `UPDATE ag_drones SET ${setClause.join(', ')} WHERE id = $${paramCount} RETURNING *`

      const result = await pool.query(query, values)

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Drone not found' })
      }

      res.json({
        success: true,
        drone: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to update drone')
      next(error)
    }
  })

  /**
   * Delete drone
   */
  router.delete('/drones/:id', async (req, res, next) => {
    try {
      const result = await pool.query('DELETE FROM ag_drones WHERE id = $1 RETURNING *', [
        req.params.id
      ])

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Drone not found' })
      }

      res.json({
        success: true,
        message: 'Drone deleted',
        drone: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to delete drone')
      next(error)
    }
  })

  return router
}
