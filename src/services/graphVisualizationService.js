/**
 * Graph Visualization Service
 * Provides utilities for creating advanced graph visualizations using D3.js
 */

import * as d3 from 'd3'

/**
 * Default configuration for graph visualization
 */
export const DEFAULT_CONFIG = {
  width: 800,
  height: 600,
  nodeRadius: 8,
  linkDistance: 100,
  linkStrength: 0.5,
  chargeStrength: -300,
  collisionRadius: 30,
  alphaDecay: 0.02,
  velocityDecay: 0.4,
  colors: {
    node: '#3b82f6',
    nodeHover: '#2563eb',
    nodeSelected: '#ef4444',
    link: '#94a3b8',
    linkHighlight: '#3b82f6',
    text: 'currentColor',
    background: 'transparent'
  },
  zoom: {
    scaleExtent: [0.1, 4],
    duration: 750
  },
  simulation: {
    enableCollision: true,
    enableCenter: true
  }
}

/**
 * Create a force-directed graph simulation
 * @param {Array} nodes - Array of node objects
 * @param {Array} links - Array of link objects
 * @param {Object} config - Configuration options
 * @returns {Object} D3 simulation instance
 */
export function createForceSimulation(nodes, links, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(cfg.linkDistance)
      .strength(cfg.linkStrength))
    .force('charge', d3.forceManyBody()
      .strength(cfg.chargeStrength))
    .alphaDecay(cfg.alphaDecay)
    .velocityDecay(cfg.velocityDecay)

  if (cfg.simulation.enableCenter) {
    simulation.force('center', d3.forceCenter(cfg.width / 2, cfg.height / 2))
  }

  if (cfg.simulation.enableCollision) {
    simulation.force('collision', d3.forceCollide()
      .radius(cfg.collisionRadius))
  }

  return simulation
}

/**
 * Create zoom behavior for graph visualization
 * @param {Object} svg - D3 selection of SVG element
 * @param {Object} container - D3 selection of container element
 * @param {Object} config - Configuration options
 * @returns {Object} D3 zoom behavior
 */
export function createZoomBehavior(svg, container, config = {}) {
  const cfg = { ...DEFAULT_CONFIG.zoom, ...config }

  const zoom = d3.zoom()
    .scaleExtent(cfg.scaleExtent)
    .on('zoom', (event) => {
      container.attr('transform', event.transform)
    })

  svg.call(zoom)

  return zoom
}

/**
 * Create drag behavior for nodes
 * @param {Object} simulation - D3 simulation instance
 * @returns {Object} D3 drag behavior
 */
export function createDragBehavior(simulation) {
  function dragStarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart()
    event.subject.fx = event.subject.x
    event.subject.fy = event.subject.y
  }

  function dragged(event) {
    event.subject.fx = event.x
    event.subject.fy = event.y
  }

  function dragEnded(event) {
    if (!event.active) simulation.alphaTarget(0)
    event.subject.fx = null
    event.subject.fy = null
  }

  return d3.drag()
    .on('start', dragStarted)
    .on('drag', dragged)
    .on('end', dragEnded)
}

/**
 * Apply graph layout algorithms
 */
export const LayoutAlgorithms = {
  /**
   * Circular layout
   * @param {Array} nodes - Array of nodes
   * @param {Number} width - Container width
   * @param {Number} height - Container height
   * @param {Number} radius - Circle radius
   */
  circular(nodes, width, height, radius = null) {
    const r = radius || Math.min(width, height) * 0.4
    const centerX = width / 2
    const centerY = height / 2

    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI
      node.x = centerX + r * Math.cos(angle)
      node.y = centerY + r * Math.sin(angle)
    })

    return nodes
  },

  /**
   * Grid layout
   * @param {Array} nodes - Array of nodes
   * @param {Number} width - Container width
   * @param {Number} height - Container height
   * @param {Number} columns - Number of columns
   */
  grid(nodes, width, height, columns = null) {
    const cols = columns || Math.ceil(Math.sqrt(nodes.length))
    const rows = Math.ceil(nodes.length / cols)
    const cellWidth = width / cols
    const cellHeight = height / rows

    nodes.forEach((node, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      node.x = col * cellWidth + cellWidth / 2
      node.y = row * cellHeight + cellHeight / 2
    })

    return nodes
  },

  /**
   * Hierarchical layout (tree-like)
   * @param {Array} nodes - Array of nodes
   * @param {Array} links - Array of links
   * @param {Number} width - Container width
   * @param {Number} height - Container height
   */
  hierarchical(nodes, links, width, height) {
    // Create hierarchy map
    const nodeMap = new Map(nodes.map(n => [n.id, { ...n, children: [] }]))
    const roots = []

    // Build tree structure
    links.forEach(link => {
      const source = nodeMap.get(link.source.id || link.source)
      const target = nodeMap.get(link.target.id || link.target)
      if (source && target) {
        source.children.push(target)
        target.hasParent = true
      }
    })

    // Find root nodes (no parents)
    nodeMap.forEach(node => {
      if (!node.hasParent) {
        roots.push(node)
      }
    })

    // Layout nodes by levels
    const levelHeight = height / (nodes.length / roots.length + 1)
    let currentY = 50

    function layoutLevel(levelNodes, level) {
      const levelWidth = width / (levelNodes.length + 1)
      levelNodes.forEach((node, i) => {
        node.x = (i + 1) * levelWidth
        node.y = currentY
        if (node.children && node.children.length > 0) {
          currentY += levelHeight
          layoutLevel(node.children, level + 1)
          currentY -= levelHeight
        }
      })
    }

    layoutLevel(roots, 0)

    return Array.from(nodeMap.values())
  },

  /**
   * Radial layout
   * @param {Array} nodes - Array of nodes
   * @param {Number} width - Container width
   * @param {Number} height - Container height
   */
  radial(nodes, width, height) {
    const centerX = width / 2
    const centerY = height / 2
    const levels = Math.ceil(Math.sqrt(nodes.length))
    const maxRadius = Math.min(width, height) * 0.45

    nodes.forEach((node, i) => {
      const level = Math.floor(i / (nodes.length / levels))
      const radius = (level + 1) * (maxRadius / levels)
      const angle = (i % (nodes.length / levels)) * (2 * Math.PI / (nodes.length / levels))
      node.x = centerX + radius * Math.cos(angle)
      node.y = centerY + radius * Math.sin(angle)
    })

    return nodes
  }
}

/**
 * Graph analysis utilities
 */
export const GraphAnalysis = {
  /**
   * Calculate node degrees (number of connections)
   * @param {Array} nodes - Array of nodes
   * @param {Array} links - Array of links
   * @returns {Map} Map of node ID to degree
   */
  calculateDegrees(nodes, links) {
    const degrees = new Map(nodes.map(n => [n.id, 0]))

    links.forEach(link => {
      const sourceId = link.source.id || link.source
      const targetId = link.target.id || link.target
      degrees.set(sourceId, (degrees.get(sourceId) || 0) + 1)
      degrees.set(targetId, (degrees.get(targetId) || 0) + 1)
    })

    return degrees
  },

  /**
   * Find connected components
   * @param {Array} nodes - Array of nodes
   * @param {Array} links - Array of links
   * @returns {Array} Array of component arrays
   */
  findComponents(nodes, links) {
    const visited = new Set()
    const components = []
    const adjacency = new Map(nodes.map(n => [n.id, []]))

    // Build adjacency list
    links.forEach(link => {
      const sourceId = link.source.id || link.source
      const targetId = link.target.id || link.target
      adjacency.get(sourceId).push(targetId)
      adjacency.get(targetId).push(sourceId)
    })

    // DFS to find components
    function dfs(nodeId, component) {
      visited.add(nodeId)
      component.push(nodeId)
      adjacency.get(nodeId).forEach(neighborId => {
        if (!visited.has(neighborId)) {
          dfs(neighborId, component)
        }
      })
    }

    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        const component = []
        dfs(node.id, component)
        components.push(component)
      }
    })

    return components
  },

  /**
   * Calculate betweenness centrality (simplified)
   * @param {Array} nodes - Array of nodes
   * @param {Array} links - Array of links
   * @returns {Map} Map of node ID to centrality score
   */
  calculateCentrality(nodes, links) {
    const centrality = new Map(nodes.map(n => [n.id, 0]))
    const adjacency = new Map(nodes.map(n => [n.id, []]))

    // Build adjacency list
    links.forEach(link => {
      const sourceId = link.source.id || link.source
      const targetId = link.target.id || link.target
      adjacency.get(sourceId).push(targetId)
      adjacency.get(targetId).push(sourceId)
    })

    // Simple centrality based on number of connections and their importance
    nodes.forEach(node => {
      const neighbors = adjacency.get(node.id)
      let score = neighbors.length

      // Add bonus for connecting to well-connected nodes
      neighbors.forEach(neighborId => {
        score += adjacency.get(neighborId).length * 0.1
      })

      centrality.set(node.id, score)
    })

    return centrality
  }
}

/**
 * Export graph to various formats
 */
export const GraphExport = {
  /**
   * Export to JSON
   * @param {Array} nodes - Array of nodes
   * @param {Array} links - Array of links
   * @returns {String} JSON string
   */
  toJSON(nodes, links) {
    return JSON.stringify({ nodes, links }, null, 2)
  },

  /**
   * Export to GraphML
   * @param {Array} nodes - Array of nodes
   * @param {Array} links - Array of links
   * @returns {String} GraphML XML string
   */
  toGraphML(nodes, links) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n'
    xml += '  <graph id="G" edgedefault="undirected">\n'

    // Add nodes
    nodes.forEach(node => {
      xml += `    <node id="${node.id}">\n`
      if (node.label) xml += `      <data key="label">${node.label}</data>\n`
      xml += '    </node>\n'
    })

    // Add edges
    links.forEach((link, i) => {
      const source = link.source.id || link.source
      const target = link.target.id || link.target
      xml += `    <edge id="e${i}" source="${source}" target="${target}"/>\n`
    })

    xml += '  </graph>\n'
    xml += '</graphml>'
    return xml
  },

  /**
   * Export to DOT (Graphviz)
   * @param {Array} nodes - Array of nodes
   * @param {Array} links - Array of links
   * @returns {String} DOT string
   */
  toDOT(nodes, links) {
    let dot = 'graph G {\n'

    // Add nodes
    nodes.forEach(node => {
      const label = node.label || node.id
      dot += `  "${node.id}" [label="${label}"];\n`
    })

    // Add edges
    links.forEach(link => {
      const source = link.source.id || link.source
      const target = link.target.id || link.target
      dot += `  "${source}" -- "${target}";\n`
    })

    dot += '}'
    return dot
  }
}

export default {
  DEFAULT_CONFIG,
  createForceSimulation,
  createZoomBehavior,
  createDragBehavior,
  LayoutAlgorithms,
  GraphAnalysis,
  GraphExport
}
