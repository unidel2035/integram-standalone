/**
 * VSL Renderer Service
 *
 * Converts VSL JSON documents to visual representations using Fabric.js
 *
 * @module services/vslRenderer
 */

import * as fabric from 'fabric'

/**
 * VSL Renderer Class
 */
export class VSLRenderer {
  constructor() {
    this.canvas = null
  }

  /**
   * Initialize the renderer with a canvas element
   * @param {HTMLCanvasElement|string} canvasElement - Canvas element or ID
   * @returns {fabric.Canvas} Fabric canvas instance
   */
  init(canvasElement) {
    if (typeof canvasElement === 'string') {
      canvasElement = document.getElementById(canvasElement)
    }

    this.canvas = new fabric.Canvas(canvasElement, {
      selection: true,
      preserveObjectStacking: true
    })

    return this.canvas
  }

  /**
   * Render a VSL document to the canvas
   * @param {Object} document - VSL document
   * @param {Object} options - Rendering options
   */
  async render(document, options = {}) {
    if (!this.canvas) {
      throw new Error('Renderer not initialized. Call init() first.')
    }

    const { clearCanvas = true } = options

    if (clearCanvas) {
      this.canvas.clear()
    }

    // Set canvas size and background
    if (document.canvas) {
      this.canvas.setWidth(document.canvas.width)
      this.canvas.setHeight(document.canvas.height)

      if (document.canvas.backgroundColor) {
        this.canvas.setBackgroundColor(document.canvas.backgroundColor, this.canvas.renderAll.bind(this.canvas))
      }

      // Add grid if enabled
      if (document.canvas.showGrid && document.canvas.gridSize) {
        this._renderGrid(document.canvas.gridSize)
      }
    }

    // Render objects
    const fabricObjects = []
    for (const vslObj of document.objects) {
      const fabricObj = await this._renderObject(vslObj, document)
      if (fabricObj) {
        fabricObjects.push(fabricObj)
        this.canvas.add(fabricObj)
      }
    }

    // Handle relationships (e.g., draw connection lines)
    if (document.relationships) {
      this._renderRelationships(document.relationships, fabricObjects, document)
    }

    this.canvas.renderAll()

    return fabricObjects
  }

  /**
   * Render grid on canvas
   * @private
   */
  _renderGrid(gridSize) {
    const width = this.canvas.getWidth()
    const height = this.canvas.getHeight()

    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      const line = new fabric.Line([x, 0, x, height], {
        stroke: '#e0e0e0',
        strokeWidth: 0.5,
        selectable: false,
        evented: false
      })
      this.canvas.add(line)
      this.canvas.sendToBack(line)
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      const line = new fabric.Line([0, y, width, y], {
        stroke: '#e0e0e0',
        strokeWidth: 0.5,
        selectable: false,
        evented: false
      })
      this.canvas.add(line)
      this.canvas.sendToBack(line)
    }
  }

  /**
   * Render a single VSL object
   * @private
   */
  async _renderObject(vslObj, document) {
    const commonProps = {
      left: vslObj.position.x,
      top: vslObj.position.y,
      angle: vslObj.rotation || 0,
      visible: vslObj.visible !== false,
      selectable: !vslObj.locked,
      data: { vslId: vslObj.id, vslType: vslObj.type }
    }

    // Apply style
    if (vslObj.style) {
      this._applyStyle(commonProps, vslObj.style)
    }

    let fabricObj = null

    switch (vslObj.type) {
      case 'rectangle':
        fabricObj = this._renderRectangle(vslObj, commonProps)
        break
      case 'circle':
        fabricObj = this._renderCircle(vslObj, commonProps)
        break
      case 'ellipse':
        fabricObj = this._renderEllipse(vslObj, commonProps)
        break
      case 'line':
        fabricObj = this._renderLine(vslObj, commonProps)
        break
      case 'text':
        fabricObj = this._renderText(vslObj, commonProps)
        break
      case 'image':
        fabricObj = await this._renderImage(vslObj, commonProps)
        break
      case 'path':
        fabricObj = this._renderPath(vslObj, commonProps)
        break
      case 'wall':
        fabricObj = this._renderWall(vslObj, commonProps)
        break
      case 'door':
        fabricObj = this._renderDoor(vslObj, commonProps)
        break
      case 'window':
        fabricObj = this._renderWindow(vslObj, commonProps)
        break
      case 'dimension':
        fabricObj = this._renderDimension(vslObj, commonProps)
        break
      case 'annotation':
        fabricObj = this._renderAnnotation(vslObj, commonProps)
        break
      default:
        console.warn(`Unknown VSL object type: ${vslObj.type}`)
    }

    return fabricObj
  }

  /**
   * Apply VSL style to Fabric object properties
   * @private
   */
  _applyStyle(props, style) {
    if (style.fill) props.fill = style.fill
    if (style.stroke) props.stroke = style.stroke
    if (style.strokeWidth !== undefined) props.strokeWidth = style.strokeWidth
    if (style.opacity !== undefined) props.opacity = style.opacity
    if (style.strokeDashArray) props.strokeDashArray = style.strokeDashArray

    if (style.shadow) {
      props.shadow = new fabric.Shadow({
        color: style.shadow.color,
        blur: style.shadow.blur,
        offsetX: style.shadow.offsetX,
        offsetY: style.shadow.offsetY
      })
    }

    if (style.fontSize) props.fontSize = style.fontSize
    if (style.fontFamily) props.fontFamily = style.fontFamily
    if (style.fontWeight) props.fontWeight = style.fontWeight
    if (style.fontStyle) props.fontStyle = style.fontStyle
    if (style.textAlign) props.textAlign = style.textAlign
  }

  /**
   * Render rectangle
   * @private
   */
  _renderRectangle(vslObj, props) {
    return new fabric.Rect({
      ...props,
      width: vslObj.size.width,
      height: vslObj.size.height,
      rx: vslObj.cornerRadius || 0,
      ry: vslObj.cornerRadius || 0
    })
  }

  /**
   * Render circle
   * @private
   */
  _renderCircle(vslObj, props) {
    return new fabric.Circle({
      ...props,
      radius: vslObj.radius
    })
  }

  /**
   * Render ellipse
   * @private
   */
  _renderEllipse(vslObj, props) {
    return new fabric.Ellipse({
      ...props,
      rx: vslObj.radiusX,
      ry: vslObj.radiusY
    })
  }

  /**
   * Render line/polyline
   * @private
   */
  _renderLine(vslObj, props) {
    if (vslObj.points.length === 2) {
      // Simple line
      const [p1, p2] = vslObj.points
      return new fabric.Line([p1.x, p1.y, p2.x, p2.y], props)
    } else {
      // Polyline
      return new fabric.Polyline(vslObj.points, props)
    }
  }

  /**
   * Render text
   * @private
   */
  _renderText(vslObj, props) {
    return new fabric.Text(vslObj.content, {
      ...props,
      width: vslObj.maxWidth
    })
  }

  /**
   * Render image
   * @private
   */
  async _renderImage(vslObj, props) {
    return new Promise((resolve) => {
      fabric.Image.fromURL(vslObj.src, (img) => {
        img.set({
          ...props,
          width: vslObj.size.width,
          height: vslObj.size.height
        })

        if (vslObj.preserveAspectRatio) {
          img.scaleToWidth(vslObj.size.width)
          img.scaleToHeight(vslObj.size.height)
        }

        resolve(img)
      })
    })
  }

  /**
   * Render path
   * @private
   */
  _renderPath(vslObj, props) {
    return new fabric.Path(vslObj.pathData, props)
  }

  /**
   * Render wall (architectural)
   * @private
   */
  _renderWall(vslObj, props) {
    if (vslObj.points.length < 2) return null

    const [p1, p2] = vslObj.points
    const thickness = vslObj.thickness || 10

    // Calculate perpendicular offset for thickness
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const len = Math.sqrt(dx * dx + dy * dy)
    const offsetX = (-dy / len) * (thickness / 2)
    const offsetY = (dx / len) * (thickness / 2)

    const points = [
      { x: p1.x + offsetX, y: p1.y + offsetY },
      { x: p2.x + offsetX, y: p2.y + offsetY },
      { x: p2.x - offsetX, y: p2.y - offsetY },
      { x: p1.x - offsetX, y: p1.y - offsetY }
    ]

    return new fabric.Polygon(points, {
      ...props,
      fill: props.fill || '#cccccc',
      stroke: props.stroke || '#333333'
    })
  }

  /**
   * Render door (architectural)
   * @private
   */
  _renderDoor(vslObj, props) {
    const group = new fabric.Group([], props)

    // Door frame
    const frame = new fabric.Rect({
      width: vslObj.size.width,
      height: vslObj.size.height,
      fill: props.fill || '#8B4513',
      stroke: props.stroke || '#654321',
      strokeWidth: 2
    })

    group.addWithUpdate(frame)

    // Door swing arc (if not sliding)
    if (vslObj.doorType !== 'sliding') {
      const arc = new fabric.Path(`M 0 ${vslObj.size.height} Q ${vslObj.size.width} ${vslObj.size.height} ${vslObj.size.width} 0`, {
        fill: 'transparent',
        stroke: '#999999',
        strokeWidth: 1,
        strokeDashArray: [5, 5]
      })

      group.addWithUpdate(arc)
    }

    return group
  }

  /**
   * Render window (architectural)
   * @private
   */
  _renderWindow(vslObj, props) {
    const group = new fabric.Group([], props)

    // Window frame
    const frame = new fabric.Rect({
      width: vslObj.size.width,
      height: vslObj.size.height,
      fill: props.fill || '#87CEEB',
      stroke: props.stroke || '#4682B4',
      strokeWidth: 2
    })

    group.addWithUpdate(frame)

    // Cross lines to indicate glass
    const line1 = new fabric.Line([0, 0, vslObj.size.width, vslObj.size.height], {
      stroke: '#4682B4',
      strokeWidth: 1
    })

    const line2 = new fabric.Line([vslObj.size.width, 0, 0, vslObj.size.height], {
      stroke: '#4682B4',
      strokeWidth: 1
    })

    group.addWithUpdate(line1)
    group.addWithUpdate(line2)

    return group
  }

  /**
   * Render dimension annotation (engineering)
   * @private
   */
  _renderDimension(vslObj, props) {
    const group = new fabric.Group([], props)

    const { startPoint, endPoint, offset = 0, label } = vslObj

    // Dimension line
    const line = new fabric.Line(
      [startPoint.x, startPoint.y + offset, endPoint.x, endPoint.y + offset],
      {
        stroke: props.stroke || '#FF0000',
        strokeWidth: 1
      }
    )

    group.addWithUpdate(line)

    // Arrows
    const arrowSize = 10
    const arrow1 = new fabric.Polygon([
      { x: startPoint.x, y: startPoint.y + offset },
      { x: startPoint.x + arrowSize, y: startPoint.y + offset - arrowSize / 2 },
      { x: startPoint.x + arrowSize, y: startPoint.y + offset + arrowSize / 2 }
    ], {
      fill: props.stroke || '#FF0000'
    })

    const arrow2 = new fabric.Polygon([
      { x: endPoint.x, y: endPoint.y + offset },
      { x: endPoint.x - arrowSize, y: endPoint.y + offset - arrowSize / 2 },
      { x: endPoint.x - arrowSize, y: endPoint.y + offset + arrowSize / 2 }
    ], {
      fill: props.stroke || '#FF0000'
    })

    group.addWithUpdate(arrow1)
    group.addWithUpdate(arrow2)

    // Label
    if (label) {
      const text = new fabric.Text(label, {
        left: (startPoint.x + endPoint.x) / 2,
        top: startPoint.y + offset - 20,
        fontSize: props.fontSize || 14,
        fill: props.stroke || '#FF0000',
        originX: 'center'
      })

      group.addWithUpdate(text)
    }

    return group
  }

  /**
   * Render annotation with leader line
   * @private
   */
  _renderAnnotation(vslObj, props) {
    const group = new fabric.Group([], props)

    // Text
    const text = new fabric.Text(vslObj.content, {
      fontSize: props.fontSize || 12,
      fontFamily: props.fontFamily || 'Arial',
      fill: props.fill || '#000000'
    })

    group.addWithUpdate(text)

    // Leader line if present
    if (vslObj.leaderLine && vslObj.leaderLine.length > 1) {
      const line = new fabric.Polyline(vslObj.leaderLine, {
        stroke: '#000000',
        strokeWidth: 1,
        fill: 'transparent'
      })

      group.addWithUpdate(line)
    }

    return group
  }

  /**
   * Render relationships between objects
   * @private
   */
  _renderRelationships(relationships, fabricObjects, document) {
    relationships.forEach(rel => {
      const sourceObj = fabricObjects.find(o => o.data && o.data.vslId === rel.sourceId)
      const targetObj = fabricObjects.find(o => o.data && o.data.vslId === rel.targetId)

      if (sourceObj && targetObj) {
        // Draw a dashed line between objects
        const line = new fabric.Line(
          [
            sourceObj.left + (sourceObj.width || 0) / 2,
            sourceObj.top + (sourceObj.height || 0) / 2,
            targetObj.left + (targetObj.width || 0) / 2,
            targetObj.top + (targetObj.height || 0) / 2
          ],
          {
            stroke: '#999999',
            strokeWidth: 1,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            data: {
              isRelationship: true,
              type: rel.type
            }
          }
        )

        this.canvas.add(line)
        this.canvas.sendToBack(line)
      }
    })
  }

  /**
   * Export canvas as image
   * @param {string} format - Image format (png, jpeg, svg)
   * @returns {string} Data URL
   */
  exportAsImage(format = 'png') {
    if (!this.canvas) {
      throw new Error('Renderer not initialized')
    }

    switch (format) {
      case 'svg':
        return this.canvas.toSVG()
      case 'jpeg':
      case 'jpg':
        return this.canvas.toDataURL({ format: 'jpeg', quality: 0.9 })
      case 'png':
      default:
        return this.canvas.toDataURL({ format: 'png' })
    }
  }

  /**
   * Get VSL document from current canvas state
   * @param {Object} baseDocument - Base VSL document to update
   * @returns {Object} Updated VSL document
   */
  getVSLFromCanvas(baseDocument) {
    if (!this.canvas) {
      throw new Error('Renderer not initialized')
    }

    const objects = this.canvas.getObjects().map(obj => {
      if (!obj.data || !obj.data.vslId) return null

      return {
        id: obj.data.vslId,
        type: obj.data.vslType,
        position: { x: obj.left, y: obj.top },
        rotation: obj.angle,
        visible: obj.visible,
        locked: !obj.selectable
      }
    }).filter(Boolean)

    return {
      ...baseDocument,
      objects,
      metadata: {
        ...baseDocument.metadata,
        modified: new Date().toISOString()
      }
    }
  }

  /**
   * Dispose renderer and cleanup
   */
  dispose() {
    if (this.canvas) {
      this.canvas.dispose()
      this.canvas = null
    }
  }
}

// Create singleton instance
const vslRenderer = new VSLRenderer()

export default vslRenderer
