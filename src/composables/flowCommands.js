/**
 * Command implementations for Flow Editor operations
 * These commands follow the Command pattern to enable undo/redo functionality
 */

/**
 * Base command class with common functionality
 */
class BaseCommand {
  constructor(name) {
    this.name = name
  }

  execute() {
    throw new Error('execute() must be implemented')
  }

  undo() {
    throw new Error('undo() must be implemented')
  }

  redo() {
    this.execute()
  }
}

/**
 * Command for adding a filter node
 */
export class AddFilterCommand extends BaseCommand {
  constructor(filters, elements, saveToLocalStorage) {
    super('Добавить фильтр')
    this.filters = filters
    this.elements = elements
    this.saveToLocalStorage = saveToLocalStorage
    this.filterId = null
    this.filter = null
    this.node = null
  }

  execute() {
    this.filterId = `filter_${this.filters.value.length + 1}`
    this.filter = {
      id: this.filterId,
      name: `Фильтр ${this.filters.value.length + 1}`,
      condition: '',
      connectedColumnId: null,
    }
    this.filters.value.push(this.filter)

    const nodeData = {
      label: this.filter.name,
      type: 'filter',
      filterId: this.filterId,
      connectedColumnId: null,
    }

    this.node = {
      id: this.filterId,
      type: 'customNode',
      position: { x: 600 + this.filters.value.length * 200, y: 200 },
      data: nodeData,
    }

    this.elements.value.push(this.node)
    this.saveToLocalStorage()
  }

  undo() {
    // Remove filter from filters array
    const filterIndex = this.filters.value.findIndex(f => f.id === this.filterId)
    if (filterIndex !== -1) {
      this.filters.value.splice(filterIndex, 1)
    }

    // Remove node and associated edges from elements
    const nodeIndex = this.elements.value.findIndex(el => el.id === this.filterId)
    if (nodeIndex !== -1) {
      this.elements.value.splice(nodeIndex, 1)
    }

    // Remove all edges connected to this node
    const edgesToRemove = this.elements.value.filter(
      el => el.source === this.filterId || el.target === this.filterId
    )
    edgesToRemove.forEach(edge => {
      const edgeIndex = this.elements.value.findIndex(el => el.id === edge.id)
      if (edgeIndex !== -1) {
        this.elements.value.splice(edgeIndex, 1)
      }
    })

    this.saveToLocalStorage()
  }
}

/**
 * Command for adding a transformation node
 */
export class AddTransformationCommand extends BaseCommand {
  constructor(type, transformations, elements, saveToLocalStorage, getTransformationName) {
    super(`Добавить трансформацию: ${type}`)
    this.type = type
    this.transformations = transformations
    this.elements = elements
    this.saveToLocalStorage = saveToLocalStorage
    this.getTransformationName = getTransformationName
    this.transformationId = null
    this.transformation = null
    this.node = null
  }

  execute() {
    this.transformationId = `transformation_${this.transformations.value.length + 1}`
    const transformationName = this.getTransformationName(this.type)

    this.transformation = {
      id: this.transformationId,
      name: transformationName,
      type: this.type,
      params: {},
    }
    this.transformations.value.push(this.transformation)

    const nodeData = {
      label: transformationName,
      type: 'transformation',
      transformationId: this.transformationId,
      transformationType: this.type,
    }

    this.node = {
      id: this.transformationId,
      type: 'customNode',
      position: { x: 600 + this.transformations.value.length * 200, y: 300 },
      data: nodeData,
    }

    this.elements.value.push(this.node)
    this.saveToLocalStorage()
  }

  undo() {
    // Remove transformation from transformations array
    const transformationIndex = this.transformations.value.findIndex(
      t => t.id === this.transformationId
    )
    if (transformationIndex !== -1) {
      this.transformations.value.splice(transformationIndex, 1)
    }

    // Remove node from elements
    const nodeIndex = this.elements.value.findIndex(el => el.id === this.transformationId)
    if (nodeIndex !== -1) {
      this.elements.value.splice(nodeIndex, 1)
    }

    // Remove all edges connected to this node
    const edgesToRemove = this.elements.value.filter(
      el => el.source === this.transformationId || el.target === this.transformationId
    )
    edgesToRemove.forEach(edge => {
      const edgeIndex = this.elements.value.findIndex(el => el.id === edge.id)
      if (edgeIndex !== -1) {
        this.elements.value.splice(edgeIndex, 1)
      }
    })

    this.saveToLocalStorage()
  }
}

/**
 * Command for deleting a node
 */
export class DeleteNodeCommand extends BaseCommand {
  constructor(node, filters, transformations, finalBlock, elements, tables, saveToLocalStorage) {
    super(`Удалить узел: ${node.data.label}`)
    this.node = node
    this.filters = filters
    this.transformations = transformations
    this.finalBlock = finalBlock
    this.elements = elements
    this.tables = tables
    this.saveToLocalStorage = saveToLocalStorage

    // Store state for undo
    this.deletedFilter = null
    this.deletedTransformation = null
    this.deletedTable = null
    this.deletedColumn = null
    this.deletedFinalBlock = null
    this.deletedEdges = []
    this.nodeIndex = null
  }

  execute() {
    // Store the node index
    this.nodeIndex = this.elements.value.findIndex(el => el.id === this.node.id)

    // Store edges that will be deleted
    this.deletedEdges = this.elements.value.filter(
      el => (el.source === this.node.id || el.target === this.node.id) &&
           !this._isTableColumnEdge(el)
    ).map(edge => ({
      ...edge,
      index: this.elements.value.findIndex(el => el.id === edge.id)
    }))

    // Delete based on node type
    switch (this.node.data.type) {
      case 'table':
        this.deletedTable = { ...this.tables.value[this.node.data.tableId] }
        delete this.tables.value[this.node.data.tableId]
        break

      case 'column':
        const table = this.tables.value[this.node.data.tableId]
        if (table) {
          const headerIndex = table.headers.findIndex(h => h.id === this.node.data.field)
          if (headerIndex !== -1) {
            this.deletedColumn = {
              tableId: this.node.data.tableId,
              header: { ...table.headers[headerIndex] },
              headerIndex,
              values: []
            }
            table.headers.splice(headerIndex, 1)

            table.rows.forEach(row => {
              const valueIndex = row.values.findIndex(v => v.headerId === this.node.data.field)
              if (valueIndex !== -1) {
                this.deletedColumn.values.push({
                  rowId: row.id,
                  value: { ...row.values[valueIndex] },
                  valueIndex
                })
                row.values.splice(valueIndex, 1)
              }
            })
          }
        }
        break

      case 'filter':
        const filterIndex = this.filters.value.findIndex(f => f.id === this.node.data.filterId)
        if (filterIndex !== -1) {
          this.deletedFilter = {
            filter: { ...this.filters.value[filterIndex] },
            index: filterIndex
          }
          this.filters.value.splice(filterIndex, 1)
        }
        break

      case 'transformation':
        const transformationIndex = this.transformations.value.findIndex(
          t => t.id === this.node.data.transformationId
        )
        if (transformationIndex !== -1) {
          this.deletedTransformation = {
            transformation: { ...this.transformations.value[transformationIndex] },
            index: transformationIndex
          }
          this.transformations.value.splice(transformationIndex, 1)
        }
        break

      case 'final':
        this.deletedFinalBlock = { ...this.finalBlock.value }
        this.finalBlock.value = null
        break
    }

    // Remove edges
    this.deletedEdges.forEach(edge => {
      const index = this.elements.value.findIndex(el => el.id === edge.id)
      if (index !== -1) {
        this.elements.value.splice(index, 1)
      }
    })

    // Remove node
    if (this.nodeIndex !== -1) {
      this.elements.value.splice(this.nodeIndex, 1)
    }

    this.saveToLocalStorage()
  }

  undo() {
    // Restore node
    if (this.nodeIndex !== -1) {
      this.elements.value.splice(this.nodeIndex, 0, this.node)
    }

    // Restore based on type
    if (this.deletedFilter) {
      this.filters.value.splice(this.deletedFilter.index, 0, this.deletedFilter.filter)
    }

    if (this.deletedTransformation) {
      this.transformations.value.splice(
        this.deletedTransformation.index,
        0,
        this.deletedTransformation.transformation
      )
    }

    if (this.deletedTable) {
      this.tables.value[this.node.data.tableId] = this.deletedTable
    }

    if (this.deletedColumn) {
      const table = this.tables.value[this.deletedColumn.tableId]
      if (table) {
        table.headers.splice(this.deletedColumn.headerIndex, 0, this.deletedColumn.header)
        this.deletedColumn.values.forEach(({ rowId, value, valueIndex }) => {
          const row = table.rows.find(r => r.id === rowId)
          if (row) {
            row.values.splice(valueIndex, 0, value)
          }
        })
      }
    }

    if (this.deletedFinalBlock) {
      this.finalBlock.value = this.deletedFinalBlock
    }

    // Restore edges
    this.deletedEdges.sort((a, b) => a.index - b.index).forEach(edge => {
      this.elements.value.splice(edge.index, 0, {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        style: edge.style
      })
    })

    this.saveToLocalStorage()
  }

  _isTableColumnEdge(edge) {
    return edge.id?.includes('edge_table_') && edge.id?.includes('_col_')
  }
}

/**
 * Command for creating a connection/edge
 */
export class CreateConnectionCommand extends BaseCommand {
  constructor(connection, elements, filters, flowSettings, saveToLocalStorage, addEdges, updateNode) {
    super('Создать связь')
    this.connection = connection
    this.elements = elements
    this.filters = filters
    this.flowSettings = flowSettings
    this.saveToLocalStorage = saveToLocalStorage
    this.addEdges = addEdges
    this.updateNode = updateNode
    this.createdEdge = null
    this.sourceNode = null
    this.targetNode = null
  }

  execute() {
    this.sourceNode = this.elements.value.find(el => el.id === this.connection.source)
    this.targetNode = this.elements.value.find(el => el.id === this.connection.target)

    if (!this.sourceNode || !this.targetNode) return

    const edgeId = `edge_${this.connection.source}_${this.connection.target}`
    let strokeColor = '#3b82f6'

    // Determine edge color based on connection type
    if (this.sourceNode.data.type === 'column' && this.targetNode.data.type === 'final') {
      strokeColor = '#3b82f6'
    } else if (this.sourceNode.data.type === 'column' && this.targetNode.data.type === 'filter') {
      strokeColor = '#10b981'

      // Update filter connection
      const filter = this.filters.value.find(f => f.id === this.targetNode.data.filterId)
      if (filter) {
        filter.connectedColumnId = this.sourceNode.id
        this.targetNode.data.connectedColumnId = this.sourceNode.id
        this.updateNode(this.targetNode.id, { data: this.targetNode.data })
      }
    } else if (this.sourceNode.data.type === 'filter' && this.targetNode.data.type === 'final') {
      strokeColor = '#f59e0b'
    } else if (this.sourceNode.data.type === 'transformation' && this.targetNode.data.type === 'final') {
      strokeColor = '#f97316'
    } else if (this.sourceNode.data.type === 'column' && this.targetNode.data.type === 'transformation') {
      strokeColor = '#8b5cf6'
    } else if (this.sourceNode.data.type === 'transformation' && this.targetNode.data.type === 'transformation') {
      strokeColor = '#6366f1'
    }

    this.createdEdge = {
      id: edgeId,
      source: this.connection.source,
      target: this.connection.target,
      type: this.flowSettings.value.edgeStyle,
      style: { stroke: strokeColor, strokeWidth: 2 },
    }

    this.addEdges([this.createdEdge])
    this.saveToLocalStorage()
  }

  undo() {
    if (!this.createdEdge) return

    // Remove filter connection if applicable
    if (this.sourceNode?.data.type === 'column' && this.targetNode?.data.type === 'filter') {
      const filter = this.filters.value.find(f => f.id === this.targetNode.data.filterId)
      if (filter) {
        filter.connectedColumnId = null
        this.targetNode.data.connectedColumnId = null
        this.updateNode(this.targetNode.id, { data: this.targetNode.data })
      }
    }

    const index = this.elements.value.findIndex(el => el.id === this.createdEdge.id)
    if (index !== -1) {
      this.elements.value.splice(index, 1)
    }
    this.saveToLocalStorage()
  }
}

/**
 * Command for deleting a connection/edge
 */
export class DeleteConnectionCommand extends BaseCommand {
  constructor(edge, elements, saveToLocalStorage) {
    super('Удалить связь')
    this.edge = edge
    this.elements = elements
    this.saveToLocalStorage = saveToLocalStorage
    this.edgeIndex = null
  }

  execute() {
    this.edgeIndex = this.elements.value.findIndex(el => el.id === this.edge.id)
    if (this.edgeIndex !== -1) {
      this.elements.value.splice(this.edgeIndex, 1)
      this.saveToLocalStorage()
    }
  }

  undo() {
    if (this.edgeIndex !== -1) {
      this.elements.value.splice(this.edgeIndex, 0, this.edge)
      this.saveToLocalStorage()
    }
  }
}

/**
 * Command for moving a node (drag operation)
 */
export class MoveNodeCommand extends BaseCommand {
  constructor(nodeId, oldPosition, newPosition, elements, saveToLocalStorage) {
    super('Переместить узел')
    this.nodeId = nodeId
    this.oldPosition = { ...oldPosition }
    this.newPosition = { ...newPosition }
    this.elements = elements
    this.saveToLocalStorage = saveToLocalStorage
  }

  execute() {
    const node = this.elements.value.find(el => el.id === this.nodeId)
    if (node) {
      node.position = { ...this.newPosition }
      this.saveToLocalStorage()
    }
  }

  undo() {
    const node = this.elements.value.find(el => el.id === this.nodeId)
    if (node) {
      node.position = { ...this.oldPosition }
      this.saveToLocalStorage()
    }
  }
}

/**
 * Command for updating node parameters (filter condition, transformation params)
 */
export class UpdateNodeParametersCommand extends BaseCommand {
  constructor(node, oldParams, newParams, filters, transformations, saveToLocalStorage, updateNode) {
    super(`Обновить параметры: ${node.data.label}`)
    this.node = node
    this.oldParams = JSON.parse(JSON.stringify(oldParams))
    this.newParams = JSON.parse(JSON.stringify(newParams))
    this.filters = filters
    this.transformations = transformations
    this.saveToLocalStorage = saveToLocalStorage
    this.updateNode = updateNode
  }

  execute() {
    this._applyParams(this.newParams)
  }

  undo() {
    this._applyParams(this.oldParams)
  }

  _applyParams(params) {
    if (this.node.data.type === 'filter') {
      const filter = this.filters.value.find(f => f.id === this.node.data.filterId)
      if (filter) {
        Object.assign(filter, params)
        this.updateNode(this.node.id, {
          data: { ...this.node.data, label: params.name }
        })
      }
    } else if (this.node.data.type === 'transformation') {
      const transformation = this.transformations.value.find(
        t => t.id === this.node.data.transformationId
      )
      if (transformation) {
        Object.assign(transformation, params)
        this.updateNode(this.node.id, {
          data: { ...this.node.data, label: params.name }
        })
      }
    }
    this.saveToLocalStorage()
  }
}
