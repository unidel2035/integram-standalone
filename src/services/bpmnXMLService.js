/**
 * BPMN XML Service
 *
 * This service provides BPMN 2.0 XML import/export functionality
 * for the Flow2 editor.
 */

import { logger } from '@/utils/logger'

/**
 * Export BPMN process to XML
 * @param {Object} process - BPMN process definition
 * @param {Object} options - Export options
 * @returns {string} BPMN 2.0 XML string
 */
export function exportToXML(process, options = {}) {
  const {
    includeMetadata = true,
    includeDiagramLayout = true,
    prettyPrint = true,
    schemaVersion = '2.0'
  } = options

  try {
    const xml = generateBPMNXML(process, {
      includeMetadata,
      includeDiagramLayout,
      prettyPrint,
      schemaVersion
    })

    logger.info('BPMN XML Export: Successfully exported process', { processId: process.id })
    return xml
  } catch (error) {
    logger.error('BPMN XML Export: Failed to export process', { error: error.message })
    throw new Error(`Failed to export BPMN XML: ${error.message}`)
  }
}

/**
 * Generate BPMN 2.0 XML string
 * @param {Object} process - BPMN process definition
 * @param {Object} options - Generation options
 * @returns {string} XML string
 */
function generateBPMNXML(process, options) {
  const { prettyPrint } = options
  const indent = prettyPrint ? '  ' : ''
  const newline = prettyPrint ? '\n' : ''

  let xml = '<?xml version="1.0" encoding="UTF-8"?>' + newline
  xml += `<bpmn:definitions` + newline
  xml += `${indent}xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"` + newline
  xml += `${indent}xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"` + newline
  xml += `${indent}xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"` + newline
  xml += `${indent}xmlns:di="http://www.omg.org/spec/DD/20100524/DI"` + newline
  xml += `${indent}xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"` + newline
  xml += `${indent}id="Definitions_${process.id}"` + newline
  xml += `${indent}targetNamespace="http://bpmn.io/schema/bpmn"` + newline
  xml += `${indent}exporter="DronDoc Flow2 Editor"` + newline
  xml += `${indent}exporterVersion="1.0">${newline}`

  // Process element
  xml += `${indent}<bpmn:process id="${escapeXML(process.id)}" name="${escapeXML(process.name)}" isExecutable="${process.isExecutable}">${newline}`

  // Add elements (start events, tasks, gateways, end events)
  process.elements.forEach(element => {
    xml += generateElementXML(element, indent + indent, newline)
  })

  // Add sequence flows
  process.sequenceFlows.forEach(flow => {
    xml += generateSequenceFlowXML(flow, indent + indent, newline)
  })

  xml += `${indent}</bpmn:process>${newline}`

  // Add diagram information if requested
  if (options.includeDiagramLayout) {
    xml += generateDiagramXML(process, indent, newline)
  }

  xml += `</bpmn:definitions>${newline}`

  return xml
}

/**
 * Generate XML for BPMN element
 * @param {Object} element - BPMN element
 * @param {string} indent - Indentation string
 * @param {string} newline - Newline character
 * @returns {string} XML string
 */
function generateElementXML(element, indent, newline) {
  const elementType = element.type.replace('bpmn:', '')
  let xml = `${indent}<bpmn:${elementType} id="${escapeXML(element.id)}"`

  // Add name/label if present
  if (element.data.label) {
    xml += ` name="${escapeXML(element.data.label)}"`
  }

  // Element-specific attributes
  switch (element.type) {
    case 'bpmn:userTask':
      if (element.data.assignee) {
        xml += ` assignee="${escapeXML(element.data.assignee)}"`
      }
      break
    case 'bpmn:serviceTask':
      if (element.data.implementation) {
        xml += ` implementation="${escapeXML(element.data.implementation)}"`
      }
      break
    case 'bpmn:scriptTask':
      if (element.data.scriptFormat) {
        xml += ` scriptFormat="${escapeXML(element.data.scriptFormat)}"`
      }
      break
  }

  // Check if element has child elements (event definitions, script content, etc.)
  const hasChildren = hasChildElements(element)

  if (hasChildren) {
    xml += `>${newline}`
    xml += generateChildElementsXML(element, indent + '  ', newline)
    xml += `${indent}</bpmn:${elementType}>${newline}`
  } else {
    xml += ` />${newline}`
  }

  return xml
}

/**
 * Check if element has child elements
 * @param {Object} element - BPMN element
 * @returns {boolean}
 */
function hasChildElements(element) {
  if (element.data.eventDefinitionType) return true
  if (element.data.script) return true
  if (element.data.documentation) return true
  return false
}

/**
 * Generate XML for child elements
 * @param {Object} element - BPMN element
 * @param {string} indent - Indentation string
 * @param {string} newline - Newline character
 * @returns {string} XML string
 */
function generateChildElementsXML(element, indent, newline) {
  let xml = ''

  // Documentation
  if (element.data.documentation) {
    xml += `${indent}<bpmn:documentation>${escapeXML(element.data.documentation)}</bpmn:documentation>${newline}`
  }

  // Event definitions
  if (element.data.eventDefinitionType) {
    xml += `${indent}<bpmn:${element.data.eventDefinitionType} />${newline}`
  }

  // Script content for script tasks
  if (element.data.script) {
    xml += `${indent}<bpmn:script>${escapeXML(element.data.script)}</bpmn:script>${newline}`
  }

  return xml
}

/**
 * Generate XML for sequence flow
 * @param {Object} flow - Sequence flow
 * @param {string} indent - Indentation string
 * @param {string} newline - Newline character
 * @returns {string} XML string
 */
function generateSequenceFlowXML(flow, indent, newline) {
  let xml = `${indent}<bpmn:sequenceFlow`
  xml += ` id="${escapeXML(flow.id)}"`
  xml += ` sourceRef="${escapeXML(flow.source)}"`
  xml += ` targetRef="${escapeXML(flow.target)}"`

  if (flow.label) {
    xml += ` name="${escapeXML(flow.label)}"`
  }

  if (flow.conditionExpression) {
    xml += `>${newline}`
    xml += `${indent}  <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${escapeXML(flow.conditionExpression)}</bpmn:conditionExpression>${newline}`
    xml += `${indent}</bpmn:sequenceFlow>${newline}`
  } else {
    xml += ` />${newline}`
  }

  return xml
}

/**
 * Generate BPMN diagram XML (BPMNDiagram)
 * @param {Object} process - BPMN process
 * @param {string} indent - Indentation string
 * @param {string} newline - Newline character
 * @returns {string} XML string
 */
function generateDiagramXML(process, indent, newline) {
  let xml = `${indent}<bpmndi:BPMNDiagram id="BPMNDiagram_${process.id}">${newline}`
  xml += `${indent}  <bpmndi:BPMNPlane id="BPMNPlane_${process.id}" bpmnElement="${process.id}">${newline}`

  // Add shapes for elements
  process.elements.forEach(element => {
    xml += `${indent}    <bpmndi:BPMNShape id="Shape_${element.id}" bpmnElement="${element.id}">${newline}`
    xml += `${indent}      <dc:Bounds x="${element.position.x}" y="${element.position.y}" width="100" height="80" />${newline}`
    xml += `${indent}    </bpmndi:BPMNShape>${newline}`
  })

  // Add edges for sequence flows
  process.sequenceFlows.forEach(flow => {
    xml += `${indent}    <bpmndi:BPMNEdge id="Edge_${flow.id}" bpmnElement="${flow.id}">${newline}`
    // TODO: Calculate waypoints based on node positions
    xml += `${indent}    </bpmndi:BPMNEdge>${newline}`
  })

  xml += `${indent}  </bpmndi:BPMNPlane>${newline}`
  xml += `${indent}</bpmndi:BPMNDiagram>${newline}`

  return xml
}

/**
 * Import BPMN XML and convert to process definition
 * @param {string} xmlString - BPMN XML string
 * @param {Object} options - Import options
 * @returns {Object} BPMN process definition
 */
export function importFromXML(xmlString, options = {}) {
  const {
    validate = true,
    preserveIds = true,
    autoLayout = false
  } = options

  try {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml')

    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror')
    if (parserError) {
      throw new Error('Invalid XML: ' + parserError.textContent)
    }

    const process = parseBPMNProcess(xmlDoc, { preserveIds, autoLayout })

    logger.info('BPMN XML Import: Successfully imported process', { processId: process.id })
    return process
  } catch (error) {
    logger.error('BPMN XML Import: Failed to import process', { error: error.message })
    throw new Error(`Failed to import BPMN XML: ${error.message}`)
  }
}

/**
 * Parse BPMN process from XML document
 * @param {Document} xmlDoc - XML document
 * @param {Object} options - Parse options
 * @returns {Object} BPMN process definition
 */
function parseBPMNProcess(xmlDoc, options) {
  const processElement = xmlDoc.querySelector('process')
  if (!processElement) {
    throw new Error('No process element found in BPMN XML')
  }

  const process = {
    id: processElement.getAttribute('id') || `process_${Date.now()}`,
    name: processElement.getAttribute('name') || 'Imported Process',
    version: '1.0',
    isExecutable: processElement.getAttribute('isExecutable') === 'true',
    processType: 'Private',
    elements: [],
    sequenceFlows: [],
    participants: [],
    lanes: [],
    variables: [],
    dataObjects: [],
    metadata: {
      created: new Date().toISOString(),
      modified: new Date().toISOString()
    }
  }

  // Parse elements (start events, tasks, gateways, end events)
  const elementTypes = [
    'startEvent',
    'endEvent',
    'task',
    'userTask',
    'serviceTask',
    'scriptTask',
    'exclusiveGateway',
    'parallelGateway',
    'inclusiveGateway'
  ]

  let yPosition = 100
  elementTypes.forEach(elementType => {
    const elements = processElement.querySelectorAll(elementType)
    elements.forEach((element, index) => {
      const node = parseElement(element, elementType, options, yPosition + (index * 120))
      process.elements.push(node)
    })
  })

  // Parse sequence flows
  const sequenceFlows = processElement.querySelectorAll('sequenceFlow')
  sequenceFlows.forEach(flow => {
    const sequenceFlow = parseSequenceFlow(flow)
    process.sequenceFlows.push(sequenceFlow)
  })

  return process
}

/**
 * Parse BPMN element from XML
 * @param {Element} element - XML element
 * @param {string} elementType - Element type
 * @param {Object} options - Parse options
 * @param {number} yPosition - Y position for layout
 * @returns {Object} BPMN node
 */
function parseElement(element, elementType, options, yPosition) {
  const id = element.getAttribute('id')
  const name = element.getAttribute('name') || ''

  // Try to get position from BPMNShape if available
  let position = { x: 100, y: yPosition }
  if (!options.autoLayout) {
    const shape = document.querySelector(`BPMNShape[bpmnElement="${id}"]`)
    if (shape) {
      const bounds = shape.querySelector('Bounds')
      if (bounds) {
        position = {
          x: parseFloat(bounds.getAttribute('x')) || position.x,
          y: parseFloat(bounds.getAttribute('y')) || position.y
        }
      }
    }
  }

  const data = {
    id,
    type: `bpmn:${elementType}`,
    label: name
  }

  // Element-specific parsing
  switch (elementType) {
    case 'userTask':
      data.assignee = element.getAttribute('assignee') || null
      break
    case 'serviceTask':
      data.implementation = element.getAttribute('implementation') || ''
      break
    case 'scriptTask':
      data.scriptFormat = element.getAttribute('scriptFormat') || 'javascript'
      const scriptElement = element.querySelector('script')
      data.script = scriptElement ? scriptElement.textContent : ''
      break
    case 'exclusiveGateway':
      data.gatewayType = 'XOR'
      break
    case 'parallelGateway':
      data.gatewayType = 'AND'
      break
    case 'inclusiveGateway':
      data.gatewayType = 'OR'
      break
  }

  // Parse event definition if present
  const eventDef = element.querySelector('[EventDefinition]')
  if (eventDef) {
    data.eventDefinitionType = eventDef.tagName.replace('bpmn:', '')
  }

  return {
    id,
    type: `bpmn:${elementType}`,
    position,
    data
  }
}

/**
 * Parse sequence flow from XML
 * @param {Element} flow - XML flow element
 * @returns {Object} Sequence flow
 */
function parseSequenceFlow(flow) {
  const id = flow.getAttribute('id')
  const sourceRef = flow.getAttribute('sourceRef')
  const targetRef = flow.getAttribute('targetRef')
  const name = flow.getAttribute('name') || ''

  const conditionElement = flow.querySelector('conditionExpression')
  const conditionExpression = conditionElement ? conditionElement.textContent : null

  return {
    id,
    source: sourceRef,
    target: targetRef,
    type: 'sequenceFlow',
    label: name,
    conditionExpression
  }
}

/**
 * Escape XML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeXML(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default {
  exportToXML,
  importFromXML
}
