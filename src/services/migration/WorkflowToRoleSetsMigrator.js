/**
 * Workflow to Role-Sets Migration Service
 *
 * Converts legacy workflow-based diagrams to Role-Sets conceptual models.
 *
 * Migration Strategy:
 * 1. Workflow nodes → Things (ID-only entities)
 * 2. Node properties → Witnesses within appropriate Prisms
 * 3. Edges → Role relationships or Transport operations
 * 4. Transformations → PQ-programs
 *
 * @see /docs/flow-editor/DEVELOPMENT_PLAN.md - Phase 10
 * @see /CLAUDE.md - Flow Editor Development Guidelines
 */

import { generateId } from '../../utils/idGenerator.js'
import { logger } from '../../utils/logger.js'

/**
 * Workflow to Role-Sets Migrator
 */
export class WorkflowToRoleSetsMigrator {
  /**
   * Migrate a workflow diagram to Role-Sets model
   *
   * @param {Object} workflow - Legacy workflow object with nodes and edges
   * @returns {Object} - Migrated Role-Sets model (Things, Prisms, RoleBindings, PQ-programs)
   */
  async migrateWorkflow(workflow) {
    logger.info('Starting workflow migration', { workflowId: workflow.id })

    const migrationResult = {
      success: true,
      things: [],
      prisms: [],
      roleBindings: [],
      pqPrograms: [],
      errors: [],
      warnings: []
    }

    try {
      // Step 1: Extract nodes and create Things
      const nodeToThingMap = new Map()
      for (const node of workflow.nodes || []) {
        const thing = this._createThingFromNode(node)
        migrationResult.things.push(thing)
        nodeToThingMap.set(node.id, thing)
      }

      // Step 2: Identify prisms based on node types and properties
      const prismMap = this._identifyPrisms(workflow.nodes || [])
      migrationResult.prisms = Array.from(prismMap.values())

      // Step 3: Create role bindings with witnesses
      for (const node of workflow.nodes || []) {
        const thing = nodeToThingMap.get(node.id)
        const bindings = this._createRoleBindingsFromNode(node, thing.id, prismMap)
        migrationResult.roleBindings.push(...bindings)
      }

      // Step 4: Convert transformations to PQ-programs
      const pqPrograms = this._extractPQProgramsFromWorkflow(workflow, nodeToThingMap)
      migrationResult.pqPrograms = pqPrograms

      // Step 5: Validate migration
      const validationResult = this._validateMigration(migrationResult)
      migrationResult.warnings = validationResult.warnings
      migrationResult.errors = validationResult.errors

      if (validationResult.errors.length > 0) {
        migrationResult.success = false
      }

      logger.info('Workflow migration completed', {
        workflowId: workflow.id,
        thingsCount: migrationResult.things.length,
        prismsCount: migrationResult.prisms.length,
        bindingsCount: migrationResult.roleBindings.length,
        errorsCount: validationResult.errors.length
      })

      return migrationResult
    } catch (error) {
      logger.error('Workflow migration failed', error)
      migrationResult.success = false
      migrationResult.errors.push({
        type: 'CRITICAL_ERROR',
        message: error.message,
        stack: error.stack
      })
      return migrationResult
    }
  }

  /**
   * Create a Thing from a workflow node
   * Things have ONLY ID - no attributes (per Role-Sets axioms)
   *
   * @private
   */
  _createThingFromNode(node) {
    return {
      id: node.id || generateId(),
      metadata: {
        createdAt: new Date().toISOString(),
        migratedFrom: 'workflow-node',
        originalNodeId: node.id
      }
    }
  }

  /**
   * Identify prisms based on node types and properties
   *
   * Strategy:
   * - Data nodes → DataPrism (with DataSource role)
   * - Transform nodes → TransformPrism (with Transformer role)
   * - Filter nodes → FilterPrism (with Predicate role)
   * - Join nodes → RelationPrism (with Joiner role)
   * - Agent nodes → AgentPrism (with Agent role)
   * - Custom prisms based on domain-specific attributes
   *
   * @private
   */
  _identifyPrisms(nodes) {
    const prismMap = new Map()

    // Default prisms for common node types
    const defaultPrisms = [
      {
        id: 'workflow-data-prism',
        name: 'WorkflowDataPrism',
        description: 'Prism for data source nodes',
        roles: {
          DataSource: {
            contract: ['tableName', 'columns'],
            invariants: ['tableName != null']
          }
        }
      },
      {
        id: 'workflow-transform-prism',
        name: 'WorkflowTransformPrism',
        description: 'Prism for transformation nodes',
        roles: {
          Transformer: {
            contract: ['transformType', 'config'],
            invariants: ['transformType != null']
          }
        }
      },
      {
        id: 'workflow-filter-prism',
        name: 'WorkflowFilterPrism',
        description: 'Prism for filter/predicate nodes',
        roles: {
          Predicate: {
            contract: ['filterExpression', 'filterType'],
            invariants: ['filterExpression != null']
          }
        }
      },
      {
        id: 'workflow-agent-prism',
        name: 'WorkflowAgentPrism',
        description: 'Prism for agent nodes',
        roles: {
          Agent: {
            contract: ['agentType', 'configuration'],
            invariants: ['agentType != null']
          }
        }
      }
    ]

    // Add default prisms
    for (const prism of defaultPrisms) {
      prismMap.set(prism.id, prism)
    }

    // Analyze nodes to detect domain-specific prisms
    const domainAttributes = this._extractDomainAttributes(nodes)
    if (domainAttributes.size > 0) {
      // Create domain-specific prism if custom attributes detected
      const domainPrism = {
        id: 'workflow-domain-prism',
        name: 'WorkflowDomainPrism',
        description: 'Custom prism for domain-specific attributes',
        roles: {
          DomainEntity: {
            contract: Array.from(domainAttributes),
            invariants: []
          }
        }
      }
      prismMap.set(domainPrism.id, domainPrism)
    }

    return prismMap
  }

  /**
   * Extract domain-specific attributes from nodes
   * (attributes that don't fit standard workflow categories)
   *
   * @private
   */
  _extractDomainAttributes(nodes) {
    const standardAttributes = new Set([
      'id', 'type', 'label', 'position', 'tableName', 'columns',
      'transformType', 'config', 'filterExpression', 'filterType',
      'agentType', 'configuration'
    ])

    const domainAttributes = new Set()

    for (const node of nodes) {
      if (node.data) {
        for (const key of Object.keys(node.data)) {
          if (!standardAttributes.has(key)) {
            domainAttributes.add(key)
          }
        }
      }
    }

    return domainAttributes
  }

  /**
   * Create role bindings from a workflow node
   * Each binding has a witness proving contract satisfaction
   *
   * @private
   */
  _createRoleBindingsFromNode(node, thingId, prismMap) {
    const bindings = []

    // Determine node type and create appropriate binding
    if (node.type === 'data' || node.type === 'tableNode') {
      // Data source node → WorkflowDataPrism.DataSource role
      const prism = prismMap.get('workflow-data-prism')
      if (prism) {
        bindings.push({
          id: generateId(),
          thingId,
          prism: prism.id,
          role: 'DataSource',
          witness: {
            tableName: node.data?.tableName || node.data?.table || 'unknown',
            columns: node.data?.columns || []
          },
          validatedAt: new Date().toISOString()
        })
      }
    } else if (node.type === 'transform' || node.type === 'transformNode') {
      // Transform node → WorkflowTransformPrism.Transformer role
      const prism = prismMap.get('workflow-transform-prism')
      if (prism) {
        bindings.push({
          id: generateId(),
          thingId,
          prism: prism.id,
          role: 'Transformer',
          witness: {
            transformType: node.data?.transformType || node.data?.operation || 'unknown',
            config: node.data?.config || {}
          },
          validatedAt: new Date().toISOString()
        })
      }
    } else if (node.type === 'filter' || node.type === 'filterNode') {
      // Filter node → WorkflowFilterPrism.Predicate role
      const prism = prismMap.get('workflow-filter-prism')
      if (prism) {
        bindings.push({
          id: generateId(),
          thingId,
          prism: prism.id,
          role: 'Predicate',
          witness: {
            filterExpression: node.data?.expression || node.data?.condition || 'true',
            filterType: node.data?.filterType || 'basic'
          },
          validatedAt: new Date().toISOString()
        })
      }
    } else if (node.type === 'agent' || node.type === 'agentNode') {
      // Agent node → WorkflowAgentPrism.Agent role
      const prism = prismMap.get('workflow-agent-prism')
      if (prism) {
        bindings.push({
          id: generateId(),
          thingId,
          prism: prism.id,
          role: 'Agent',
          witness: {
            agentType: node.data?.agentType || 'generic',
            configuration: node.data?.config || {}
          },
          validatedAt: new Date().toISOString()
        })
      }
    }

    // Check for domain-specific attributes
    const domainPrism = prismMap.get('workflow-domain-prism')
    if (domainPrism && node.data) {
      const standardKeys = new Set(['tableName', 'columns', 'transformType', 'config', 'filterExpression', 'filterType', 'agentType', 'configuration'])
      const domainWitness = {}
      let hasDomainAttributes = false

      for (const [key, value] of Object.entries(node.data)) {
        if (!standardKeys.has(key)) {
          domainWitness[key] = value
          hasDomainAttributes = true
        }
      }

      if (hasDomainAttributes) {
        bindings.push({
          id: generateId(),
          thingId,
          prism: domainPrism.id,
          role: 'DomainEntity',
          witness: domainWitness,
          validatedAt: new Date().toISOString()
        })
      }
    }

    return bindings
  }

  /**
   * Extract PQ-programs from workflow transformations
   *
   * Converts workflow transformation chains to PQ queries:
   * - Filter → WHERE clause
   * - Join → TRANSFORM (cross-prism)
   * - Aggregate → PQ with aggregation
   * - Map → Attribute projection
   *
   * @private
   */
  _extractPQProgramsFromWorkflow(workflow, nodeToThingMap) {
    const pqPrograms = []

    // Analyze edges to build data flow chains
    const edgesBySource = new Map()
    for (const edge of workflow.edges || []) {
      if (!edgesBySource.has(edge.source)) {
        edgesBySource.set(edge.source, [])
      }
      edgesBySource.get(edge.source).push(edge)
    }

    // For each data source, trace downstream to build PQ
    for (const node of workflow.nodes || []) {
      if (node.type === 'data' || node.type === 'tableNode') {
        const pq = this._buildPQFromDataFlow(node, edgesBySource, workflow.nodes, nodeToThingMap)
        if (pq) {
          pqPrograms.push(pq)
        }
      }
    }

    return pqPrograms
  }

  /**
   * Build PQ-program from data flow starting at a data source
   *
   * @private
   */
  _buildPQFromDataFlow(startNode, edgesBySource, allNodes, nodeToThingMap) {
    const thing = nodeToThingMap.get(startNode.id)
    if (!thing) return null

    const pq = {
      id: generateId(),
      name: `PQ for ${startNode.data?.tableName || startNode.id}`,
      from: 'WorkflowDataPrism.DataSource',
      where: [],
      select: [],
      transform: [],
      trace: true
    }

    // Traverse downstream edges to build query
    const visited = new Set()
    const queue = [startNode.id]

    while (queue.length > 0) {
      const currentNodeId = queue.shift()
      if (visited.has(currentNodeId)) continue
      visited.add(currentNodeId)

      const edges = edgesBySource.get(currentNodeId) || []
      for (const edge of edges) {
        const targetNode = allNodes.find(n => n.id === edge.target)
        if (!targetNode) continue

        // Convert node type to PQ operation
        if (targetNode.type === 'filter' || targetNode.type === 'filterNode') {
          pq.where.push({
            attribute: targetNode.data?.field || 'value',
            operator: targetNode.data?.operator || '==',
            value: targetNode.data?.value || null
          })
        } else if (targetNode.type === 'transform' || targetNode.type === 'transformNode') {
          if (targetNode.data?.transformType === 'map' || targetNode.data?.operation === 'select') {
            pq.select.push(...(targetNode.data?.columns || []))
          } else if (targetNode.data?.transformType === 'join') {
            pq.transform.push({
              type: 'join',
              with: targetNode.data?.joinTable || 'unknown',
              on: targetNode.data?.joinKey || 'id'
            })
          }
        }

        queue.push(targetNode.id)
      }
    }

    return pq
  }

  /**
   * Validate migration result
   *
   * Checks:
   * - All Things have valid IDs
   * - All RoleBindings have witnesses
   * - Witnesses satisfy role contracts
   * - Prisms are well-formed
   *
   * @private
   */
  _validateMigration(result) {
    const warnings = []
    const errors = []

    // Validate Things
    for (const thing of result.things) {
      if (!thing.id) {
        errors.push({
          type: 'INVALID_THING',
          message: 'Thing missing ID',
          thing
        })
      }
      // Check for attributes on Thing (should be NONE per axioms)
      const keys = Object.keys(thing).filter(k => k !== 'id' && k !== 'metadata')
      if (keys.length > 0) {
        errors.push({
          type: 'ATTRIBUTES_ON_THING',
          message: `Thing ${thing.id} has attributes: ${keys.join(', ')}. Attributes must be in witnesses!`,
          thing
        })
      }
    }

    // Validate RoleBindings
    for (const binding of result.roleBindings) {
      if (!binding.witness) {
        errors.push({
          type: 'MISSING_WITNESS',
          message: `RoleBinding ${binding.id} missing witness`,
          binding
        })
      }

      // Check witness satisfies contract
      const prism = result.prisms.find(p => p.id === binding.prism)
      if (prism && prism.roles[binding.role]) {
        const contract = prism.roles[binding.role].contract
        const missingAttrs = contract.filter(attr => !(attr in binding.witness))
        if (missingAttrs.length > 0) {
          errors.push({
            type: 'INCOMPLETE_WITNESS',
            message: `Witness for ${binding.prism}.${binding.role} missing attributes: ${missingAttrs.join(', ')}`,
            binding
          })
        }
      }
    }

    // Validate Prisms
    for (const prism of result.prisms) {
      if (!prism.id || !prism.name) {
        errors.push({
          type: 'INVALID_PRISM',
          message: 'Prism missing id or name',
          prism
        })
      }
      if (!prism.roles || Object.keys(prism.roles).length === 0) {
        warnings.push({
          type: 'EMPTY_PRISM',
          message: `Prism ${prism.name} has no roles`,
          prism
        })
      }
    }

    // Warn if no PQ programs generated
    if (result.pqPrograms.length === 0) {
      warnings.push({
        type: 'NO_PQ_PROGRAMS',
        message: 'No PQ-programs generated from workflow'
      })
    }

    return { warnings, errors }
  }

  /**
   * Preview migration (dry run without saving)
   *
   * @param {Object} workflow - Workflow to preview
   * @returns {Object} - Preview result with statistics
   */
  async previewMigration(workflow) {
    const result = await this.migrateWorkflow(workflow)

    return {
      ...result,
      statistics: {
        thingsCount: result.things.length,
        prismsCount: result.prisms.length,
        roleBindingsCount: result.roleBindings.length,
        pqProgramsCount: result.pqPrograms.length,
        errorsCount: result.errors.length,
        warningsCount: result.warnings.length
      },
      preview: true
    }
  }
}

export default WorkflowToRoleSetsMigrator
