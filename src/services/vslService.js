/**
 * Visual Scene Language (VSL) Service
 *
 * Provides functionality for:
 * - Parsing and validating VSL JSON documents
 * - Converting between VSL and other formats
 * - Manipulating VSL objects
 * - Generating VSL from natural language (via LLM)
 *
 * @module services/vslService
 */

import { generateUniqueId } from '@/utils/idGenerator'

/**
 * VSL Service Class
 */
export class VSLService {
  constructor() {
    this.version = '1.0.0'
  }

  /**
   * Create a new empty VSL document
   * @param {Object} canvasOptions - Canvas configuration
   * @returns {Object} VSL document
   */
  createDocument(canvasOptions = {}) {
    const defaultCanvas = {
      width: 800,
      height: 600,
      unit: 'px',
      backgroundColor: '#ffffff',
      showGrid: false,
      scale: 1,
      ...canvasOptions
    }

    return {
      version: this.version,
      canvas: defaultCanvas,
      objects: [],
      relationships: [],
      layers: [
        {
          id: generateUniqueId(),
          name: 'Layer 1',
          visible: true,
          locked: false,
          objectIds: []
        }
      ],
      metadata: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        version: this.version
      }
    }
  }

  /**
   * Validate a VSL document
   * @param {Object} document - VSL document to validate
   * @returns {Object} Validation result with errors
   */
  validate(document) {
    const errors = []

    // Check required top-level properties
    if (!document.version) {
      errors.push({ path: 'version', message: 'Version is required' })
    }

    if (!document.canvas) {
      errors.push({ path: 'canvas', message: 'Canvas is required' })
    } else {
      // Validate canvas
      if (typeof document.canvas.width !== 'number' || document.canvas.width <= 0) {
        errors.push({ path: 'canvas.width', message: 'Canvas width must be a positive number' })
      }
      if (typeof document.canvas.height !== 'number' || document.canvas.height <= 0) {
        errors.push({ path: 'canvas.height', message: 'Canvas height must be a positive number' })
      }
      const validUnits = ['px', 'mm', 'cm', 'm', 'in', 'pt']
      if (!validUnits.includes(document.canvas.unit)) {
        errors.push({ path: 'canvas.unit', message: `Canvas unit must be one of: ${validUnits.join(', ')}` })
      }
    }

    if (!Array.isArray(document.objects)) {
      errors.push({ path: 'objects', message: 'Objects must be an array' })
    } else {
      // Validate objects
      const objectIds = new Set()
      document.objects.forEach((obj, index) => {
        const objPath = `objects[${index}]`

        if (!obj.id) {
          errors.push({ path: `${objPath}.id`, message: 'Object ID is required' })
        } else if (objectIds.has(obj.id)) {
          errors.push({ path: `${objPath}.id`, message: `Duplicate object ID: ${obj.id}` })
        } else {
          objectIds.add(obj.id)
        }

        if (!obj.type) {
          errors.push({ path: `${objPath}.type`, message: 'Object type is required' })
        }

        if (!obj.position || typeof obj.position.x !== 'number' || typeof obj.position.y !== 'number') {
          errors.push({ path: `${objPath}.position`, message: 'Object position must have x and y coordinates' })
        }

        // Type-specific validation
        this._validateObjectType(obj, objPath, errors)
      })
    }

    // Validate relationships
    if (document.relationships && Array.isArray(document.relationships)) {
      const objectIds = new Set(document.objects.map(o => o.id))
      document.relationships.forEach((rel, index) => {
        const relPath = `relationships[${index}]`
        if (!rel.sourceId || !objectIds.has(rel.sourceId)) {
          errors.push({ path: `${relPath}.sourceId`, message: 'Invalid or missing source object ID' })
        }
        if (!rel.targetId || !objectIds.has(rel.targetId)) {
          errors.push({ path: `${relPath}.targetId`, message: 'Invalid or missing target object ID' })
        }
      })
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate object type-specific properties
   * @private
   */
  _validateObjectType(obj, path, errors) {
    switch (obj.type) {
      case 'rectangle':
        if (!obj.size || typeof obj.size.width !== 'number' || typeof obj.size.height !== 'number') {
          errors.push({ path: `${path}.size`, message: 'Rectangle must have width and height' })
        }
        break
      case 'circle':
        if (typeof obj.radius !== 'number' || obj.radius <= 0) {
          errors.push({ path: `${path}.radius`, message: 'Circle must have a positive radius' })
        }
        break
      case 'text':
        if (!obj.content) {
          errors.push({ path: `${path}.content`, message: 'Text object must have content' })
        }
        break
      case 'line':
        if (!Array.isArray(obj.points) || obj.points.length < 2) {
          errors.push({ path: `${path}.points`, message: 'Line must have at least 2 points' })
        }
        break
      // Add more type validations as needed
    }
  }

  /**
   * Add an object to the document
   * @param {Object} document - VSL document
   * @param {Object} object - Object to add
   * @param {string} layerId - Layer to add object to
   * @returns {Object} Updated document
   */
  addObject(document, object, layerId = null) {
    // Ensure object has an ID
    if (!object.id) {
      object.id = generateUniqueId()
    }

    // Add to objects array
    document.objects.push(object)

    // Add to layer
    if (layerId) {
      const layer = document.layers?.find(l => l.id === layerId)
      if (layer) {
        layer.objectIds.push(object.id)
      }
    } else if (document.layers && document.layers.length > 0) {
      // Add to first layer if no layer specified
      document.layers[0].objectIds.push(object.id)
    }

    // Update modified timestamp
    if (document.metadata) {
      document.metadata.modified = new Date().toISOString()
    }

    return document
  }

  /**
   * Remove an object from the document
   * @param {Object} document - VSL document
   * @param {string} objectId - ID of object to remove
   * @returns {Object} Updated document
   */
  removeObject(document, objectId) {
    // Remove from objects array
    const index = document.objects.findIndex(o => o.id === objectId)
    if (index !== -1) {
      document.objects.splice(index, 1)
    }

    // Remove from layers
    if (document.layers) {
      document.layers.forEach(layer => {
        const idx = layer.objectIds.indexOf(objectId)
        if (idx !== -1) {
          layer.objectIds.splice(idx, 1)
        }
      })
    }

    // Remove related relationships
    if (document.relationships) {
      document.relationships = document.relationships.filter(
        r => r.sourceId !== objectId && r.targetId !== objectId
      )
    }

    // Update modified timestamp
    if (document.metadata) {
      document.metadata.modified = new Date().toISOString()
    }

    return document
  }

  /**
   * Update an object in the document
   * @param {Object} document - VSL document
   * @param {string} objectId - ID of object to update
   * @param {Object} updates - Properties to update
   * @returns {Object} Updated document
   */
  updateObject(document, objectId, updates) {
    const object = document.objects.find(o => o.id === objectId)
    if (object) {
      Object.assign(object, updates)

      // Update modified timestamp
      if (document.metadata) {
        document.metadata.modified = new Date().toISOString()
      }
    }

    return document
  }

  /**
   * Get object by ID
   * @param {Object} document - VSL document
   * @param {string} objectId - Object ID
   * @returns {Object|null} Object or null if not found
   */
  getObject(document, objectId) {
    return document.objects.find(o => o.id === objectId) || null
  }

  /**
   * Add a relationship between objects
   * @param {Object} document - VSL document
   * @param {string} sourceId - Source object ID
   * @param {string} targetId - Target object ID
   * @param {string} type - Relationship type
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Updated document
   */
  addRelationship(document, sourceId, targetId, type, metadata = {}) {
    if (!document.relationships) {
      document.relationships = []
    }

    document.relationships.push({
      type,
      sourceId,
      targetId,
      metadata
    })

    return document
  }

  /**
   * Export VSL document to JSON string
   * @param {Object} document - VSL document
   * @param {Object} options - Export options
   * @returns {string} JSON string
   */
  exportToJSON(document, options = {}) {
    const { prettify = true, includeMetadata = true } = options

    const exportDoc = includeMetadata ? document : {
      ...document,
      metadata: undefined
    }

    return prettify
      ? JSON.stringify(exportDoc, null, 2)
      : JSON.stringify(exportDoc)
  }

  /**
   * Import VSL document from JSON string
   * @param {string} jsonString - JSON string
   * @param {Object} options - Import options
   * @returns {Object} VSL document
   */
  importFromJSON(jsonString, options = {}) {
    const { validateSchema = true } = options

    try {
      const document = JSON.parse(jsonString)

      if (validateSchema) {
        const validation = this.validate(document)
        if (!validation.valid) {
          throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`)
        }
      }

      return document
    } catch (error) {
      throw new Error(`Failed to import VSL document: ${error.message}`)
    }
  }

  /**
   * Create example architectural scene
   * @returns {Object} VSL document with example room
   */
  createExampleArchitecturalScene() {
    const doc = this.createDocument({
      width: 1000,
      height: 800,
      unit: 'cm',
      showGrid: true,
      gridSize: 50
    })

    // Room walls
    const wallThickness = 20

    // North wall
    this.addObject(doc, {
      id: generateUniqueId(),
      type: 'wall',
      points: [
        { x: 0, y: 0 },
        { x: 800, y: 0 }
      ],
      thickness: wallThickness,
      style: {
        fill: '#cccccc',
        stroke: '#333333',
        strokeWidth: 2
      },
      name: 'North Wall'
    })

    // East wall
    this.addObject(doc, {
      id: generateUniqueId(),
      type: 'wall',
      points: [
        { x: 800, y: 0 },
        { x: 800, y: 600 }
      ],
      thickness: wallThickness,
      style: {
        fill: '#cccccc',
        stroke: '#333333',
        strokeWidth: 2
      },
      name: 'East Wall'
    })

    // South wall
    this.addObject(doc, {
      id: generateUniqueId(),
      type: 'wall',
      points: [
        { x: 800, y: 600 },
        { x: 0, y: 600 }
      ],
      thickness: wallThickness,
      style: {
        fill: '#cccccc',
        stroke: '#333333',
        strokeWidth: 2
      },
      name: 'South Wall'
    })

    // West wall
    this.addObject(doc, {
      id: generateUniqueId(),
      type: 'wall',
      points: [
        { x: 0, y: 600 },
        { x: 0, y: 0 }
      ],
      thickness: wallThickness,
      style: {
        fill: '#cccccc',
        stroke: '#333333',
        strokeWidth: 2
      },
      name: 'West Wall'
    })

    // Door
    this.addObject(doc, {
      id: generateUniqueId(),
      type: 'door',
      position: { x: 400, y: 600 },
      size: { width: 90, height: wallThickness },
      openingDirection: 'inward',
      doorType: 'single',
      style: {
        fill: '#8B4513',
        stroke: '#654321',
        strokeWidth: 2
      },
      name: 'Main Door'
    })

    // Window
    this.addObject(doc, {
      id: generateUniqueId(),
      type: 'window',
      position: { x: 200, y: 0 },
      size: { width: 120, height: wallThickness },
      windowType: 'casement',
      style: {
        fill: '#87CEEB',
        stroke: '#4682B4',
        strokeWidth: 2
      },
      name: 'Window 1'
    })

    // Furniture - Table
    this.addObject(doc, {
      id: generateUniqueId(),
      type: 'rectangle',
      position: { x: 300, y: 250 },
      size: { width: 200, height: 100 },
      style: {
        fill: '#8B4513',
        stroke: '#654321',
        strokeWidth: 2
      },
      name: 'Table'
    })

    // Annotation
    this.addObject(doc, {
      id: generateUniqueId(),
      type: 'annotation',
      position: { x: 50, y: 50 },
      content: 'Living Room\n8m × 6m',
      style: {
        fontSize: 20,
        fontFamily: 'Arial',
        fill: '#000000'
      },
      name: 'Room Label'
    })

    doc.metadata.title = 'Example Room Layout'
    doc.metadata.description = 'A simple room with walls, door, window, and furniture'

    return doc
  }

  /**
   * Create example engineering diagram
   * @returns {Object} VSL document with engineering elements
   */
  createExampleEngineeringDiagram() {
    const doc = this.createDocument({
      width: 1200,
      height: 800,
      unit: 'mm',
      showGrid: true,
      gridSize: 10
    })

    // Main component
    this.addObject(doc, {
      id: generateUniqueId(),
      type: 'rectangle',
      position: { x: 400, y: 300 },
      size: { width: 400, height: 200 },
      style: {
        fill: 'none',
        stroke: '#000000',
        strokeWidth: 2
      },
      name: 'Main Component'
    })

    // Dimension annotation
    this.addObject(doc, {
      id: generateUniqueId(),
      type: 'dimension',
      startPoint: { x: 400, y: 520 },
      endPoint: { x: 800, y: 520 },
      offset: 30,
      label: '400 mm',
      style: {
        stroke: '#FF0000',
        strokeWidth: 1,
        fontSize: 14
      },
      name: 'Width Dimension'
    })

    // Technical note
    this.addObject(doc, {
      id: generateUniqueId(),
      type: 'annotation',
      position: { x: 850, y: 400 },
      content: 'Material: Steel\nTolerance: ±0.1mm',
      leaderLine: [
        { x: 850, y: 400 },
        { x: 800, y: 400 }
      ],
      style: {
        fontSize: 12,
        fontFamily: 'Arial',
        fill: '#000000'
      },
      name: 'Material Note'
    })

    doc.metadata.title = 'Engineering Component'
    doc.metadata.description = 'Example engineering drawing with dimensions and annotations'

    return doc
  }
}

// Create singleton instance
const vslService = new VSLService()

export default vslService
