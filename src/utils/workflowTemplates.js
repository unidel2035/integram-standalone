/**
 * Predefined workflow templates for different agent types
 * These templates provide starting points for common agent workflows
 */

export const workflowTemplates = {
  // YouTube Analytics Agent Workflow
  'youtube-analytics': {
    name: 'YouTube Analytics Workflow',
    description: 'Workflow for collecting and analyzing YouTube channel statistics',
    nodes: [
      {
        id: 'start-1',
        type: 'StartNode',
        label: 'Start',
        position: { x: 100, y: 200 },
        data: {
          nodeType: 'StartNode',
          category: 'control',
          icon: 'pi-play',
          description: 'Workflow entry point'
        }
      },
      {
        id: 'datasource-1',
        type: 'DataSourceNode',
        label: 'YouTube API',
        position: { x: 300, y: 200 },
        data: {
          nodeType: 'DataSourceNode',
          category: 'data',
          icon: 'pi-database',
          description: 'Fetch data from YouTube API',
          config: {
            source: 'youtube-api',
            endpoint: '/channels'
          }
        }
      },
      {
        id: 'filter-1',
        type: 'FilterNode',
        label: 'Filter Active Channels',
        position: { x: 500, y: 200 },
        data: {
          nodeType: 'FilterNode',
          category: 'transform',
          icon: 'pi-filter',
          description: 'Filter active channels only',
          config: {
            condition: 'status === "active"'
          }
        }
      },
      {
        id: 'agent-1',
        type: 'AgentNode',
        label: 'Analyze Trends',
        position: { x: 700, y: 200 },
        data: {
          nodeType: 'AgentNode',
          category: 'agent',
          icon: 'pi-android',
          description: 'AI agent for trend analysis',
          config: {
            agentType: 'analytics',
            model: 'deepseek-chat'
          }
        }
      },
      {
        id: 'output-1',
        type: 'OutputNode',
        label: 'Save Report',
        position: { x: 900, y: 200 },
        data: {
          nodeType: 'OutputNode',
          category: 'output',
          icon: 'pi-file',
          description: 'Save analysis report',
          config: {
            destination: 'reports',
            format: 'json'
          }
        }
      },
      {
        id: 'end-1',
        type: 'EndNode',
        label: 'End',
        position: { x: 1100, y: 200 },
        data: {
          nodeType: 'EndNode',
          category: 'control',
          icon: 'pi-stop',
          description: 'Workflow exit point'
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'datasource-1', type: 'default', animated: false },
      { id: 'e2', source: 'datasource-1', target: 'filter-1', type: 'default', animated: false },
      { id: 'e3', source: 'filter-1', target: 'agent-1', type: 'default', animated: false },
      { id: 'e4', source: 'agent-1', target: 'output-1', type: 'default', animated: false },
      { id: 'e5', source: 'output-1', target: 'end-1', type: 'default', animated: false }
    ]
  },

  // Web Scraper Agent Workflow
  'web-scraper': {
    name: 'Web Scraper Workflow',
    description: 'Workflow for scraping and processing web data',
    nodes: [
      {
        id: 'start-1',
        type: 'StartNode',
        label: 'Start',
        position: { x: 100, y: 200 },
        data: {
          nodeType: 'StartNode',
          category: 'control',
          icon: 'pi-play',
          description: 'Workflow entry point'
        }
      },
      {
        id: 'datasource-1',
        type: 'DataSourceNode',
        label: 'Fetch URL',
        position: { x: 300, y: 200 },
        data: {
          nodeType: 'DataSourceNode',
          category: 'data',
          icon: 'pi-globe',
          description: 'Fetch web page content',
          config: {
            source: 'http-request',
            method: 'GET'
          }
        }
      },
      {
        id: 'agent-1',
        type: 'AgentNode',
        label: 'Parse HTML',
        position: { x: 500, y: 200 },
        data: {
          nodeType: 'AgentNode',
          category: 'agent',
          icon: 'pi-code',
          description: 'Parse HTML content',
          config: {
            agentType: 'parser',
            selector: 'css'
          }
        }
      },
      {
        id: 'filter-1',
        type: 'FilterNode',
        label: 'Validate Data',
        position: { x: 700, y: 200 },
        data: {
          nodeType: 'FilterNode',
          category: 'transform',
          icon: 'pi-check',
          description: 'Validate extracted data',
          config: {
            condition: 'data !== null && data.length > 0'
          }
        }
      },
      {
        id: 'output-1',
        type: 'OutputNode',
        label: 'Save Results',
        position: { x: 900, y: 200 },
        data: {
          nodeType: 'OutputNode',
          category: 'output',
          icon: 'pi-save',
          description: 'Save scraped data',
          config: {
            destination: 'database',
            table: 'scraped_data'
          }
        }
      },
      {
        id: 'end-1',
        type: 'EndNode',
        label: 'End',
        position: { x: 1100, y: 200 },
        data: {
          nodeType: 'EndNode',
          category: 'control',
          icon: 'pi-stop',
          description: 'Workflow exit point'
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'datasource-1', type: 'default', animated: false },
      { id: 'e2', source: 'datasource-1', target: 'agent-1', type: 'default', animated: false },
      { id: 'e3', source: 'agent-1', target: 'filter-1', type: 'default', animated: false },
      { id: 'e4', source: 'filter-1', target: 'output-1', type: 'default', animated: false },
      { id: 'e5', source: 'output-1', target: 'end-1', type: 'default', animated: false }
    ]
  },

  // Drone Control Agent Workflow
  'drone-control': {
    name: 'Drone Control Workflow',
    description: 'Workflow for managing drone telemetry and flight missions',
    nodes: [
      {
        id: 'start-1',
        type: 'StartNode',
        label: 'Start',
        position: { x: 100, y: 150 },
        data: {
          nodeType: 'StartNode',
          category: 'control',
          icon: 'pi-play',
          description: 'Workflow entry point'
        }
      },
      {
        id: 'datasource-1',
        type: 'DataSourceNode',
        label: 'MAVLink Stream',
        position: { x: 300, y: 150 },
        data: {
          nodeType: 'DataSourceNode',
          category: 'data',
          icon: 'pi-wifi',
          description: 'Receive MAVLink telemetry',
          config: {
            source: 'mavlink',
            protocol: 'UDP',
            port: 14550
          }
        }
      },
      {
        id: 'filter-1',
        type: 'FilterNode',
        label: 'Critical Events',
        position: { x: 500, y: 100 },
        data: {
          nodeType: 'FilterNode',
          category: 'transform',
          icon: 'pi-exclamation-triangle',
          description: 'Filter critical events',
          config: {
            condition: 'severity >= "warning"'
          }
        }
      },
      {
        id: 'agent-1',
        type: 'AgentNode',
        label: 'Alert Handler',
        position: { x: 700, y: 100 },
        data: {
          nodeType: 'AgentNode',
          category: 'agent',
          icon: 'pi-bell',
          description: 'Handle critical alerts',
          config: {
            agentType: 'notification',
            channels: ['telegram', 'email']
          }
        }
      },
      {
        id: 'datasource-2',
        type: 'DataSourceNode',
        label: 'Normal Telemetry',
        position: { x: 500, y: 250 },
        data: {
          nodeType: 'DataSourceNode',
          category: 'data',
          icon: 'pi-chart-line',
          description: 'Process normal telemetry',
          config: {
            source: 'telemetry-buffer'
          }
        }
      },
      {
        id: 'output-1',
        type: 'OutputNode',
        label: 'Store Telemetry',
        position: { x: 700, y: 250 },
        data: {
          nodeType: 'OutputNode',
          category: 'output',
          icon: 'pi-database',
          description: 'Store telemetry data',
          config: {
            destination: 'timeseries-db',
            retention: '30d'
          }
        }
      },
      {
        id: 'end-1',
        type: 'EndNode',
        label: 'End',
        position: { x: 900, y: 175 },
        data: {
          nodeType: 'EndNode',
          category: 'control',
          icon: 'pi-stop',
          description: 'Workflow exit point'
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'datasource-1', type: 'default', animated: true },
      { id: 'e2', source: 'datasource-1', target: 'filter-1', type: 'default', animated: false },
      { id: 'e3', source: 'filter-1', target: 'agent-1', type: 'default', animated: false, label: 'Critical' },
      { id: 'e4', source: 'datasource-1', target: 'datasource-2', type: 'default', animated: false },
      { id: 'e5', source: 'datasource-2', target: 'output-1', type: 'default', animated: false, label: 'Normal' },
      { id: 'e6', source: 'agent-1', target: 'end-1', type: 'default', animated: false },
      { id: 'e7', source: 'output-1', target: 'end-1', type: 'default', animated: false }
    ]
  },

  // Default/Generic Agent Workflow
  'default': {
    name: 'Generic Agent Workflow',
    description: 'Basic workflow template for any agent',
    nodes: [
      {
        id: 'start-1',
        type: 'StartNode',
        label: 'Start',
        position: { x: 150, y: 200 },
        data: {
          nodeType: 'StartNode',
          category: 'control',
          icon: 'pi-play',
          description: 'Workflow entry point'
        }
      },
      {
        id: 'datasource-1',
        type: 'DataSourceNode',
        label: 'Data Input',
        position: { x: 350, y: 200 },
        data: {
          nodeType: 'DataSourceNode',
          category: 'data',
          icon: 'pi-database',
          description: 'Input data source',
          config: {}
        }
      },
      {
        id: 'agent-1',
        type: 'AgentNode',
        label: 'Process',
        position: { x: 550, y: 200 },
        data: {
          nodeType: 'AgentNode',
          category: 'agent',
          icon: 'pi-android',
          description: 'Main processing logic',
          config: {}
        }
      },
      {
        id: 'output-1',
        type: 'OutputNode',
        label: 'Output',
        position: { x: 750, y: 200 },
        data: {
          nodeType: 'OutputNode',
          category: 'output',
          icon: 'pi-file',
          description: 'Save output',
          config: {}
        }
      },
      {
        id: 'end-1',
        type: 'EndNode',
        label: 'End',
        position: { x: 950, y: 200 },
        data: {
          nodeType: 'EndNode',
          category: 'control',
          icon: 'pi-stop',
          description: 'Workflow exit point'
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'datasource-1', type: 'default', animated: false },
      { id: 'e2', source: 'datasource-1', target: 'agent-1', type: 'default', animated: false },
      { id: 'e3', source: 'agent-1', target: 'output-1', type: 'default', animated: false },
      { id: 'e4', source: 'output-1', target: 'end-1', type: 'default', animated: false }
    ]
  }
}

/**
 * Get workflow template by agent ID
 * @param {string} agentId - The agent ID
 * @returns {Object|null} Workflow template or null if not found
 */
export function getWorkflowTemplate(agentId) {
  return workflowTemplates[agentId] || workflowTemplates['default']
}

/**
 * List all available workflow templates
 * @returns {Array<Object>} Array of template metadata
 */
export function listWorkflowTemplates() {
  return Object.keys(workflowTemplates).map(key => ({
    id: key,
    name: workflowTemplates[key].name,
    description: workflowTemplates[key].description,
    nodeCount: workflowTemplates[key].nodes.length,
    edgeCount: workflowTemplates[key].edges.length
  }))
}
