/**
 * PQExecutionService - Backend PQ Program Execution
 *
 * Executes PQ programs using the frontend PQ compiler and executor,
 * but with backend storage layer access.
 *
 * @see /docs/conceptual-framework/pq-language-spec.md
 * @see /src/pq/ - Frontend PQ implementation
 */

import logger from '../../utils/logger.js'

// Import PQ compiler and executor from local backend copy
import { parse as parsePQ } from '../../pq/parser.js'
import { compile as compilePQ } from '../../pq/compiler.js'
import { Executor } from '../../pq/executor.js'

/**
 * PQ Parse Error
 */
export class PQParseError extends Error {
  constructor(message, position) {
    super(message)
    this.name = 'PQParseError'
    this.position = position
  }
}

/**
 * PQ Execution Error
 */
export class PQExecutionError extends Error {
  constructor(message, step) {
    super(message)
    this.name = 'PQExecutionError'
    this.step = step
  }
}

/**
 * DataStore adapter for RoleSetStorage
 * Implements the interface expected by the PQ Executor
 */
class StorageDataStoreAdapter {
  constructor(storage) {
    this.storage = storage
  }

  /**
   * Get witnesses (RoleBindings) for prism/role
   */
  async getWitnesses(prism, role) {
    // Find prism by name
    const prisms = await this.storage.getAllPrisms()
    const prismObj = prisms.find(p => p.name === prism)

    if (!prismObj) {
      return []
    }

    // Find role by name in this prism
    const roles = await this.storage.getRolesByPrism(prismObj.id)
    const roleObj = roles.find(r => r.name === role)

    if (!roleObj) {
      return []
    }

    // Get all role bindings for this prism/role
    const bindings = await this.storage.getAllRoleBindings({
      prismId: prismObj.id,
      roleId: roleObj.id
    })

    // Convert RoleBindings to Witness format expected by executor
    return bindings.map(binding => ({
      thingId: binding.thingId,
      prism: prism,
      role: role,
      proof: binding.proof,
      timestamp: new Date(binding.proof.timestamp)
    }))
  }

  /**
   * Get witnesses by Thing IDs
   */
  async getWitnessesByIds(thingIds) {
    const witnesses = []

    for (const thingId of thingIds) {
      const bindings = await this.storage.getRoleBindingsByThing(thingId)

      for (const binding of bindings) {
        // Resolve prism and role names
        const prism = await this.storage.getPrism(binding.prismId)
        const role = await this.storage.getRole(binding.roleId)

        if (prism && role) {
          witnesses.push({
            thingId: binding.thingId,
            prism: prism.name,
            role: role.name,
            proof: binding.proof,
            timestamp: new Date(binding.proof.timestamp)
          })
        }
      }
    }

    return witnesses
  }

  /**
   * Get related witnesses (for joins/relations)
   */
  async getRelatedWitnesses(thingIds, prism, role) {
    const witnesses = await this.getWitnesses(prism, role)
    return witnesses.filter(w => thingIds.includes(w.thingId))
  }

  /**
   * Get transport mapping between prisms
   * For Phase 6 (Transport) - stub for now
   */
  async getTransportMapping(fromPrism, toPrism) {
    // TODO: Implement transport mapping in Phase 6
    // For now, return identity mapping (same Thing IDs)
    return {
      type: 'identity',
      transform: (witnesses) => witnesses
    }
  }
}

/**
 * PQExecutionService
 * Compiles and executes PQ programs against backend storage
 */
export class PQExecutionService {
  constructor(storage) {
    this.storage = storage
    this.dataStore = new StorageDataStoreAdapter(storage)
    logger.info('PQExecutionService initialized')
  }

  /**
   * Validate PQ program syntax
   */
  async validate(pqString) {
    try {
      const ast = parsePQ(pqString)

      return {
        valid: true,
        ast,
        message: 'PQ program is syntactically valid'
      }
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        position: error.position,
        message: `Parse error: ${error.message}`
      }
    }
  }

  /**
   * Explain PQ program (show execution plan without executing)
   */
  async explain(pqString) {
    try {
      // Parse PQ
      const ast = parsePQ(pqString)

      // Compile to execution plan
      const plan = compilePQ(ast)

      // Return plan structure
      return {
        ast,
        plan: {
          steps: plan.steps,
          estimatedComplexity: this._estimateComplexity(plan),
          optimizations: plan.optimizations || []
        },
        message: 'PQ program compiled successfully'
      }
    } catch (error) {
      logger.error('Error explaining PQ program:', error)

      if (error.name === 'ParseError') {
        throw new PQParseError(error.message, error.position)
      }

      throw error
    }
  }

  /**
   * Execute PQ program
   */
  async execute(pqString, options = {}) {
    const {
      includeWitnesses = false,
      includeTrace = true,
      maxResults = 10000
    } = options

    try {
      // Parse PQ
      const ast = parsePQ(pqString)

      // Compile to execution plan
      const plan = compilePQ(ast)

      // Execute plan
      const executor = new Executor(this.dataStore)
      const result = await executor.execute(plan, {
        includeWitnesses,
        includeTrace,
        maxResults
      })

      // Log execution
      logger.debug('PQ execution completed', {
        thingCount: result.thingIds.length,
        duration: result.trace.duration
      })

      return {
        thingIds: result.thingIds,
        witnesses: includeWitnesses ? result.witnesses : undefined,
        trace: includeTrace ? result.trace : undefined,
        metadata: {
          count: result.thingIds.length,
          duration: result.trace.duration,
          steps: result.trace.steps.length
        }
      }
    } catch (error) {
      logger.error('Error executing PQ program:', error)

      if (error.name === 'ParseError') {
        throw new PQParseError(error.message, error.position)
      }

      if (error.name === 'ExecutionError') {
        throw new PQExecutionError(error.message, error.step)
      }

      throw error
    }
  }

  /**
   * Estimate execution plan complexity
   * @private
   */
  _estimateComplexity(plan) {
    // Simple heuristic based on step types
    const weights = {
      'scan': 1,
      'filter': 2,
      'project': 1,
      'join': 5,
      'transform': 3,
      'union': 2,
      'intersect': 3
    }

    let complexity = 0

    for (const step of plan.steps) {
      complexity += weights[step.type] || 1
    }

    // Categorize complexity
    if (complexity <= 5) return 'low'
    if (complexity <= 15) return 'medium'
    return 'high'
  }
}

export default PQExecutionService
