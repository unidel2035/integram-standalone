/**
 * Role-Sets API Routes - Backend Integration (Phase 7)
 *
 * REST API for Role-Sets conceptual framework:
 * - Thing management (CRUD)
 * - Prism management (CRUD)
 * - Role management (within prisms)
 * - RoleBinding management (witnesses)
 * - PQ program execution
 *
 * Storage: Uses local JSON files (per CLAUDE.md guidelines - NO databases!)
 *
 * @see /docs/conceptual-framework/role-sets-theory.md
 * @see /docs/conceptual-framework/pq-language-spec.md
 * @see /CLAUDE.md - Backend Development Guidelines
 */

import express from 'express'
import logger from '../../utils/logger.js'
import { RoleSetStorage } from '../../storage/RoleSetStorage.js'
import { PQExecutionService } from '../../services/pq/PQExecutionService.js'

/**
 * Create Role-Sets routes
 */
export function createRoleSetRoutes() {
  const router = express.Router()

  // Initialize storage (local JSON files - no database!)
  const storage = new RoleSetStorage()

  // Initialize PQ execution service
  const pqService = new PQExecutionService(storage)

  // ========================================
  // Thing Management
  // ========================================

  /**
   * GET /api/role-sets/things
   * Get all Things
   */
  router.get('/things', async (req, res, next) => {
    try {
      const { limit, offset } = req.query
      const things = await storage.getAllThings({
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      })

      res.json({
        success: true,
        data: things,
        count: things.length
      })
    } catch (error) {
      logger.error('Error getting things:', error)
      next(error)
    }
  })

  /**
   * GET /api/role-sets/things/:id
   * Get Thing by ID
   */
  router.get('/things/:id', async (req, res, next) => {
    try {
      const thing = await storage.getThing(req.params.id)

      if (!thing) {
        return res.status(404).json({
          success: false,
          error: 'Thing not found'
        })
      }

      res.json({
        success: true,
        data: thing
      })
    } catch (error) {
      logger.error('Error getting thing:', error)
      next(error)
    }
  })

  /**
   * POST /api/role-sets/things
   * Create new Thing
   */
  router.post('/things', async (req, res, next) => {
    try {
      const { id } = req.body
      const thing = await storage.createThing({ id })

      res.status(201).json({
        success: true,
        data: thing
      })
    } catch (error) {
      logger.error('Error creating thing:', error)
      next(error)
    }
  })

  /**
   * DELETE /api/role-sets/things/:id
   * Delete Thing
   */
  router.delete('/things/:id', async (req, res, next) => {
    try {
      await storage.deleteThing(req.params.id)

      res.json({
        success: true,
        message: 'Thing deleted'
      })
    } catch (error) {
      logger.error('Error deleting thing:', error)
      next(error)
    }
  })

  // ========================================
  // Prism Management
  // ========================================

  /**
   * GET /api/role-sets/prisms
   * Get all Prisms
   */
  router.get('/prisms', async (req, res, next) => {
    try {
      const prisms = await storage.getAllPrisms()

      res.json({
        success: true,
        data: prisms,
        count: prisms.length
      })
    } catch (error) {
      logger.error('Error getting prisms:', error)
      next(error)
    }
  })

  /**
   * GET /api/role-sets/prisms/:id
   * Get Prism by ID
   */
  router.get('/prisms/:id', async (req, res, next) => {
    try {
      const prism = await storage.getPrism(req.params.id)

      if (!prism) {
        return res.status(404).json({
          success: false,
          error: 'Prism not found'
        })
      }

      res.json({
        success: true,
        data: prism
      })
    } catch (error) {
      logger.error('Error getting prism:', error)
      next(error)
    }
  })

  /**
   * POST /api/role-sets/prisms
   * Create new Prism
   */
  router.post('/prisms', async (req, res, next) => {
    try {
      const { name, description, metadata } = req.body

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Prism name is required'
        })
      }

      const prism = await storage.createPrism({
        name,
        description,
        metadata
      })

      res.status(201).json({
        success: true,
        data: prism
      })
    } catch (error) {
      logger.error('Error creating prism:', error)
      next(error)
    }
  })

  /**
   * PUT /api/role-sets/prisms/:id
   * Update Prism
   */
  router.put('/prisms/:id', async (req, res, next) => {
    try {
      const { name, description, metadata } = req.body
      const prism = await storage.updatePrism(req.params.id, {
        name,
        description,
        metadata
      })

      res.json({
        success: true,
        data: prism
      })
    } catch (error) {
      logger.error('Error updating prism:', error)
      next(error)
    }
  })

  /**
   * DELETE /api/role-sets/prisms/:id
   * Delete Prism
   */
  router.delete('/prisms/:id', async (req, res, next) => {
    try {
      await storage.deletePrism(req.params.id)

      res.json({
        success: true,
        message: 'Prism deleted'
      })
    } catch (error) {
      logger.error('Error deleting prism:', error)
      next(error)
    }
  })

  // ========================================
  // Role Management
  // ========================================

  /**
   * GET /api/role-sets/prisms/:prismId/roles
   * Get all Roles in a Prism
   */
  router.get('/prisms/:prismId/roles', async (req, res, next) => {
    try {
      const roles = await storage.getRolesByPrism(req.params.prismId)

      res.json({
        success: true,
        data: roles,
        count: roles.length
      })
    } catch (error) {
      logger.error('Error getting roles:', error)
      next(error)
    }
  })

  /**
   * GET /api/role-sets/roles/:id
   * Get Role by ID
   */
  router.get('/roles/:id', async (req, res, next) => {
    try {
      const role = await storage.getRole(req.params.id)

      if (!role) {
        return res.status(404).json({
          success: false,
          error: 'Role not found'
        })
      }

      res.json({
        success: true,
        data: role
      })
    } catch (error) {
      logger.error('Error getting role:', error)
      next(error)
    }
  })

  /**
   * POST /api/role-sets/prisms/:prismId/roles
   * Create new Role in Prism
   */
  router.post('/prisms/:prismId/roles', async (req, res, next) => {
    try {
      const { name, contract, invariants, attributeSchema } = req.body

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Role name is required'
        })
      }

      const role = await storage.createRole({
        prismId: req.params.prismId,
        name,
        contract,
        invariants,
        attributeSchema
      })

      res.status(201).json({
        success: true,
        data: role
      })
    } catch (error) {
      logger.error('Error creating role:', error)
      next(error)
    }
  })

  /**
   * PUT /api/role-sets/roles/:id
   * Update Role
   */
  router.put('/roles/:id', async (req, res, next) => {
    try {
      const { name, contract, invariants, attributeSchema } = req.body
      const role = await storage.updateRole(req.params.id, {
        name,
        contract,
        invariants,
        attributeSchema
      })

      res.json({
        success: true,
        data: role
      })
    } catch (error) {
      logger.error('Error updating role:', error)
      next(error)
    }
  })

  /**
   * DELETE /api/role-sets/roles/:id
   * Delete Role
   */
  router.delete('/roles/:id', async (req, res, next) => {
    try {
      await storage.deleteRole(req.params.id)

      res.json({
        success: true,
        message: 'Role deleted'
      })
    } catch (error) {
      logger.error('Error deleting role:', error)
      next(error)
    }
  })

  // ========================================
  // RoleBinding Management (Witnesses)
  // ========================================

  /**
   * GET /api/role-sets/role-bindings
   * Get all RoleBindings (with optional filters)
   */
  router.get('/role-bindings', async (req, res, next) => {
    try {
      const { thingId, prismId, roleId } = req.query
      const bindings = await storage.getAllRoleBindings({
        thingId,
        prismId,
        roleId
      })

      res.json({
        success: true,
        data: bindings,
        count: bindings.length
      })
    } catch (error) {
      logger.error('Error getting role bindings:', error)
      next(error)
    }
  })

  /**
   * GET /api/role-sets/role-bindings/:id
   * Get RoleBinding by ID
   */
  router.get('/role-bindings/:id', async (req, res, next) => {
    try {
      const binding = await storage.getRoleBinding(req.params.id)

      if (!binding) {
        return res.status(404).json({
          success: false,
          error: 'RoleBinding not found'
        })
      }

      res.json({
        success: true,
        data: binding
      })
    } catch (error) {
      logger.error('Error getting role binding:', error)
      next(error)
    }
  })

  /**
   * POST /api/role-sets/role-bindings
   * Create new RoleBinding (with witness validation)
   */
  router.post('/role-bindings', async (req, res, next) => {
    try {
      const { thingId, prismId, roleId, attributes, explanation } = req.body

      if (!thingId || !prismId || !roleId) {
        return res.status(400).json({
          success: false,
          error: 'thingId, prismId, and roleId are required'
        })
      }

      if (!attributes || typeof attributes !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'attributes are required and must be an object'
        })
      }

      // Create binding with witness validation
      const binding = await storage.createRoleBinding({
        thingId,
        prismId,
        roleId,
        attributes,
        explanation
      })

      res.status(201).json({
        success: true,
        data: binding
      })
    } catch (error) {
      logger.error('Error creating role binding:', error)

      // Return validation errors with details
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: error.message,
          details: error.details
        })
      }

      next(error)
    }
  })

  /**
   * PUT /api/role-sets/role-bindings/:id
   * Update RoleBinding (re-validates witness)
   */
  router.put('/role-bindings/:id', async (req, res, next) => {
    try {
      const { attributes, explanation } = req.body
      const binding = await storage.updateRoleBinding(req.params.id, {
        attributes,
        explanation
      })

      res.json({
        success: true,
        data: binding
      })
    } catch (error) {
      logger.error('Error updating role binding:', error)

      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: error.message,
          details: error.details
        })
      }

      next(error)
    }
  })

  /**
   * DELETE /api/role-sets/role-bindings/:id
   * Delete RoleBinding
   */
  router.delete('/role-bindings/:id', async (req, res, next) => {
    try {
      await storage.deleteRoleBinding(req.params.id)

      res.json({
        success: true,
        message: 'RoleBinding deleted'
      })
    } catch (error) {
      logger.error('Error deleting role binding:', error)
      next(error)
    }
  })

  /**
   * GET /api/role-sets/things/:thingId/role-bindings
   * Get all RoleBindings for a Thing
   */
  router.get('/things/:thingId/role-bindings', async (req, res, next) => {
    try {
      const bindings = await storage.getRoleBindingsByThing(req.params.thingId)

      res.json({
        success: true,
        data: bindings,
        count: bindings.length
      })
    } catch (error) {
      logger.error('Error getting thing role bindings:', error)
      next(error)
    }
  })

  // ========================================
  // PQ Program Execution
  // ========================================

  /**
   * POST /api/role-sets/pq/execute
   * Execute PQ program
   *
   * Body: { pq: string, options: { includeWitnesses, includeTrace, ... } }
   */
  router.post('/pq/execute', async (req, res, next) => {
    try {
      const { pq, options = {} } = req.body

      if (!pq) {
        return res.status(400).json({
          success: false,
          error: 'PQ program is required'
        })
      }

      const result = await pqService.execute(pq, options)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      logger.error('Error executing PQ program:', error)

      // Return PQ execution errors with details
      if (error.name === 'PQExecutionError' || error.name === 'PQParseError') {
        return res.status(400).json({
          success: false,
          error: error.message,
          details: {
            type: error.name,
            step: error.step,
            position: error.position
          }
        })
      }

      next(error)
    }
  })

  /**
   * POST /api/role-sets/pq/explain
   * Get execution plan and trace for PQ program (without executing)
   *
   * Body: { pq: string }
   */
  router.post('/pq/explain', async (req, res, next) => {
    try {
      const { pq } = req.body

      if (!pq) {
        return res.status(400).json({
          success: false,
          error: 'PQ program is required'
        })
      }

      const explanation = await pqService.explain(pq)

      res.json({
        success: true,
        data: explanation
      })
    } catch (error) {
      logger.error('Error explaining PQ program:', error)

      if (error.name === 'PQParseError') {
        return res.status(400).json({
          success: false,
          error: error.message,
          details: {
            type: error.name,
            position: error.position
          }
        })
      }

      next(error)
    }
  })

  /**
   * POST /api/role-sets/pq/validate
   * Validate PQ program syntax
   *
   * Body: { pq: string }
   */
  router.post('/pq/validate', async (req, res, next) => {
    try {
      const { pq } = req.body

      if (!pq) {
        return res.status(400).json({
          success: false,
          error: 'PQ program is required'
        })
      }

      const validation = await pqService.validate(pq)

      res.json({
        success: true,
        data: validation
      })
    } catch (error) {
      logger.error('Error validating PQ program:', error)
      next(error)
    }
  })

  // ========================================
  // Bulk Operations
  // ========================================

  /**
   * POST /api/role-sets/bulk/import
   * Bulk import Things, Prisms, Roles, and RoleBindings
   *
   * Body: { things: [], prisms: [], roles: [], roleBindings: [] }
   */
  router.post('/bulk/import', async (req, res, next) => {
    try {
      const { things = [], prisms = [], roles = [], roleBindings = [] } = req.body

      const result = await storage.bulkImport({
        things,
        prisms,
        roles,
        roleBindings
      })

      res.json({
        success: true,
        data: result,
        message: 'Bulk import completed'
      })
    } catch (error) {
      logger.error('Error in bulk import:', error)
      next(error)
    }
  })

  /**
   * GET /api/role-sets/bulk/export
   * Bulk export all data
   */
  router.get('/bulk/export', async (req, res, next) => {
    try {
      const data = await storage.bulkExport()

      res.json({
        success: true,
        data
      })
    } catch (error) {
      logger.error('Error in bulk export:', error)
      next(error)
    }
  })

  // ========================================
  // System Info
  // ========================================

  /**
   * GET /api/role-sets/info
   * Get system information and statistics
   */
  router.get('/info', async (req, res, next) => {
    try {
      const info = await storage.getSystemInfo()

      res.json({
        success: true,
        data: info
      })
    } catch (error) {
      logger.error('Error getting system info:', error)
      next(error)
    }
  })

  return router
}

export default createRoleSetRoutes
