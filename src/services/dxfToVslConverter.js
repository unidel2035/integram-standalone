/**
 * DXF to VSL Converter
 * Converts parsed DXF entities into VSL (Visual Scene Language) JSON objects
 */

/**
 * Convert parsed DXF data (from dxf-parser) into VSL document
 * @param {Object} dxfData - Parsed DXF data from dxf-parser
 * @param {Object} options - Conversion options
 * @returns {Object} VSL document
 */
export function convertDxfToVsl(dxfData, options = {}) {
  const {
    scale = 1,
    offsetX = 0,
    offsetY = 0,
    filterLayers = null
  } = options

  const vslObjects = []
  const metadata = {
    source: 'dxf',
    layers: [],
    blocks: [],
    entityCount: 0
  }

  if (!dxfData?.entities) {
    return createVslDocument(vslObjects, metadata)
  }

  // Collect layer info
  if (dxfData.tables?.layer?.layers) {
    metadata.layers = Object.keys(dxfData.tables.layer.layers)
  }

  // Collect block info
  if (dxfData.blocks) {
    metadata.blocks = Object.keys(dxfData.blocks)
  }

  let idCounter = 1

  for (const entity of dxfData.entities) {
    // Filter by layer if specified
    if (filterLayers && !filterLayers.includes(entity.layer)) continue

    const converted = convertEntity(entity, idCounter, scale, offsetX, offsetY)
    if (converted) {
      if (Array.isArray(converted)) {
        vslObjects.push(...converted)
        idCounter += converted.length
      } else {
        vslObjects.push(converted)
        idCounter++
      }
    }
  }

  // Convert block inserts (INSERT entities reference blocks)
  if (dxfData.blocks) {
    for (const entity of dxfData.entities) {
      if (entity.type === 'INSERT' && dxfData.blocks[entity.name]) {
        const block = dxfData.blocks[entity.name]
        const blockEntities = block.entities || []
        const groupChildren = []

        for (const bEntity of blockEntities) {
          const converted = convertEntity(
            bEntity,
            idCounter,
            scale * (entity.xScale || 1),
            (entity.position?.x || 0) * scale + offsetX,
            (entity.position?.y || 0) * scale + offsetY
          )
          if (converted) {
            if (Array.isArray(converted)) {
              groupChildren.push(...converted)
              idCounter += converted.length
            } else {
              groupChildren.push(converted)
              idCounter++
            }
          }
        }

        if (groupChildren.length > 0) {
          vslObjects.push({
            id: `vsl_${idCounter++}`,
            type: 'group',
            name: entity.name,
            layer: entity.layer,
            children: groupChildren,
            position: {
              x: (entity.position?.x || 0) * scale + offsetX,
              y: (entity.position?.y || 0) * scale + offsetY
            },
            rotation: entity.rotation || 0
          })
        }
      }
    }
  }

  metadata.entityCount = vslObjects.length
  return createVslDocument(vslObjects, metadata)
}

function convertEntity(entity, id, scale, offsetX, offsetY) {
  switch (entity.type) {
    case 'LINE':
      return convertLine(entity, id, scale, offsetX, offsetY)
    case 'CIRCLE':
      return convertCircle(entity, id, scale, offsetX, offsetY)
    case 'ARC':
      return convertArc(entity, id, scale, offsetX, offsetY)
    case 'LWPOLYLINE':
    case 'POLYLINE':
      return convertPolyline(entity, id, scale, offsetX, offsetY)
    case 'TEXT':
    case 'MTEXT':
      return convertText(entity, id, scale, offsetX, offsetY)
    case 'DIMENSION':
      return convertDimension(entity, id, scale, offsetX, offsetY)
    case 'ELLIPSE':
      return convertEllipse(entity, id, scale, offsetX, offsetY)
    case 'SPLINE':
      return convertSpline(entity, id, scale, offsetX, offsetY)
    case 'POINT':
      return convertPoint(entity, id, scale, offsetX, offsetY)
    default:
      return null
  }
}

function convertLine(entity, id, scale, ox, oy) {
  return {
    id: `vsl_${id}`,
    type: 'line',
    layer: entity.layer,
    color: entity.color,
    points: [
      { x: (entity.vertices?.[0]?.x || 0) * scale + ox, y: (entity.vertices?.[0]?.y || 0) * scale + oy },
      { x: (entity.vertices?.[1]?.x || 0) * scale + ox, y: (entity.vertices?.[1]?.y || 0) * scale + oy }
    ]
  }
}

function convertCircle(entity, id, scale, ox, oy) {
  const radius = (entity.radius || 0) * scale
  const diameter = Math.round(radius * 2 * 10) / 10

  return {
    id: `vsl_${id}`,
    type: 'circle',
    layer: entity.layer,
    color: entity.color,
    position: {
      x: (entity.center?.x || 0) * scale + ox,
      y: (entity.center?.y || 0) * scale + oy
    },
    radius,
    diameter,
    // Semantic hint: circles with specific diameters are likely bolt holes
    semantic: identifyCircleSemantic(diameter)
  }
}

function convertArc(entity, id, scale, ox, oy) {
  return {
    id: `vsl_${id}`,
    type: 'arc',
    layer: entity.layer,
    color: entity.color,
    center: {
      x: (entity.center?.x || 0) * scale + ox,
      y: (entity.center?.y || 0) * scale + oy
    },
    radius: (entity.radius || 0) * scale,
    startAngle: entity.startAngle || 0,
    endAngle: entity.endAngle || 360
  }
}

function convertPolyline(entity, id, scale, ox, oy) {
  const points = (entity.vertices || []).map(v => ({
    x: (v.x || 0) * scale + ox,
    y: (v.y || 0) * scale + oy,
    bulge: v.bulge || 0
  }))

  return {
    id: `vsl_${id}`,
    type: 'polyline',
    layer: entity.layer,
    color: entity.color,
    closed: entity.shape || false,
    points
  }
}

function convertText(entity, id, scale, ox, oy) {
  return {
    id: `vsl_${id}`,
    type: 'text',
    layer: entity.layer,
    color: entity.color,
    position: {
      x: (entity.startPoint?.x || entity.position?.x || 0) * scale + ox,
      y: (entity.startPoint?.y || entity.position?.y || 0) * scale + oy
    },
    text: entity.text || entity.value || '',
    height: (entity.textHeight || entity.height || 3) * scale,
    rotation: entity.rotation || 0
  }
}

function convertDimension(entity, id, scale, ox, oy) {
  return {
    id: `vsl_${id}`,
    type: 'dimension',
    layer: entity.layer,
    color: entity.color,
    dimensionType: entity.dimensionType,
    text: entity.text || '',
    startPoint: entity.anchorPoint ? {
      x: (entity.anchorPoint.x || 0) * scale + ox,
      y: (entity.anchorPoint.y || 0) * scale + oy
    } : null,
    endPoint: entity.middleOfText ? {
      x: (entity.middleOfText.x || 0) * scale + ox,
      y: (entity.middleOfText.y || 0) * scale + oy
    } : null
  }
}

function convertEllipse(entity, id, scale, ox, oy) {
  return {
    id: `vsl_${id}`,
    type: 'ellipse',
    layer: entity.layer,
    color: entity.color,
    center: {
      x: (entity.center?.x || 0) * scale + ox,
      y: (entity.center?.y || 0) * scale + oy
    },
    majorAxis: {
      x: (entity.majorAxisEndPoint?.x || 0) * scale,
      y: (entity.majorAxisEndPoint?.y || 0) * scale
    },
    axisRatio: entity.axisRatio || 1,
    startAngle: entity.startAngle || 0,
    endAngle: entity.endAngle || Math.PI * 2
  }
}

function convertSpline(entity, id, scale, ox, oy) {
  const controlPoints = (entity.controlPoints || []).map(p => ({
    x: (p.x || 0) * scale + ox,
    y: (p.y || 0) * scale + oy
  }))
  return {
    id: `vsl_${id}`,
    type: 'spline',
    layer: entity.layer,
    color: entity.color,
    degree: entity.degreeOfSplineCurve || 3,
    controlPoints,
    closed: entity.flag === 1
  }
}

function convertPoint(entity, id, scale, ox, oy) {
  return {
    id: `vsl_${id}`,
    type: 'point',
    layer: entity.layer,
    position: {
      x: (entity.position?.x || 0) * scale + ox,
      y: (entity.position?.y || 0) * scale + oy
    }
  }
}

/**
 * Identify semantic meaning of a circle based on diameter
 * Standard bolt holes: d_hole = d_bolt + 2mm (normal) or d_bolt + 3mm (enlarged)
 */
function identifyCircleSemantic(diameter) {
  const boltHoles = {
    13: 'M12', 14: 'M12',
    17: 'M16', 18: 'M16',
    21: 'M20', 22: 'M20',
    23: 'M22', 24: 'M22',
    25: 'M24', 26: 'M24',
    28: 'M27', 30: 'M27',
    33: 'M30',
    39: 'M36',
    45: 'M42',
    51: 'M48'
  }

  const rounded = Math.round(diameter)
  if (boltHoles[rounded]) {
    return { type: 'bolt_hole', boltSize: boltHoles[rounded], holeDiameter: rounded }
  }
  return null
}

/**
 * Extract bolt hole groups from VSL objects
 * Groups nearby circles with the same diameter
 * @param {Array} vslObjects - VSL objects array
 * @param {number} maxDistance - Max distance between holes to group them, mm
 * @returns {Array} Groups of bolt holes
 */
export function extractBoltHoleGroups(vslObjects, maxDistance = 200) {
  const holes = vslObjects.filter(
    obj => obj.type === 'circle' && obj.semantic?.type === 'bolt_hole'
  )

  if (holes.length === 0) return []

  // Group holes by bolt size and proximity
  const groups = []
  const used = new Set()

  for (let i = 0; i < holes.length; i++) {
    if (used.has(i)) continue

    const group = [holes[i]]
    used.add(i)

    for (let j = i + 1; j < holes.length; j++) {
      if (used.has(j)) continue
      if (holes[j].semantic.boltSize !== holes[i].semantic.boltSize) continue

      const dist = Math.sqrt(
        Math.pow(holes[j].position.x - holes[i].position.x, 2) +
        Math.pow(holes[j].position.y - holes[i].position.y, 2)
      )

      if (dist <= maxDistance) {
        group.push(holes[j])
        used.add(j)
      }
    }

    if (group.length >= 2) {
      groups.push({
        boltSize: group[0].semantic.boltSize,
        holeDiameter: group[0].semantic.holeDiameter,
        count: group.length,
        holes: group.map(h => ({ x: h.position.x, y: h.position.y })),
        center: {
          x: group.reduce((s, h) => s + h.position.x, 0) / group.length,
          y: group.reduce((s, h) => s + h.position.y, 0) / group.length
        }
      })
    }
  }

  return groups
}

function createVslDocument(objects, metadata) {
  return {
    version: '1.0',
    type: 'construction_drawing',
    metadata: {
      ...metadata,
      convertedAt: new Date().toISOString(),
      converter: 'dxfToVslConverter'
    },
    objects
  }
}
