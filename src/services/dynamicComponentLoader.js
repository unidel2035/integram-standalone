/**
 * Dynamic Component Loader Service
 *
 * Loads and executes Vue components dynamically from custom agent definitions
 * - Parse Vue SFC JSON definitions
 * - Create Vue components on-the-fly
 * - Handle dependencies and imports
 * - Sanitize code for security
 * - Provide context and utilities to components
 *
 * Usage:
 * const component = await loadCustomAgentComponent(agentDefinition)
 * const results = await executeCustomAgent(agentDefinition, inputs, context)
 */

import { defineComponent, h } from 'vue'

/**
 * Sanitize component code to prevent XSS and dangerous operations
 */
export function sanitizeComponentCode(code) {
  // List of dangerous patterns to block
  const dangerousPatterns = [
    /eval\s*\(/gi,
    /Function\s*\(/gi,
    /setTimeout\s*\(/gi,
    /setInterval\s*\(/gi,
    /document\.write/gi,
    /window\.location/gi,
    /localStorage/gi,
    /sessionStorage/gi,
    /fetch\s*\(/gi,
    /XMLHttpRequest/gi,
    /import\s+/gi,
    /require\s*\(/gi
  ]

  let sanitized = code

  // Remove dangerous patterns
  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      // Allow if it's in a comment
      const lines = sanitized.split('\n')
      sanitized = lines
        .map(line => {
          // Skip if it's a comment
          if (line.trim().startsWith('//')) return line

          // Replace dangerous calls
          return line
            .replace(pattern, `/* blocked: ${pattern.source} */ `)
        })
        .join('\n')
    }
  }

  return sanitized
}

/**
 * Create Vue component from SFC definition
 */
export function createVueComponent(sfc, dependencies = {}) {
  try {
    // Validate SFC structure
    if (!sfc.template) {
      throw new Error('Component template is required')
    }

    // Parse and compile template (simple approach)
    const template = sfc.template

    // Create component options
    const componentOptions = {
      template
    }

    // Add script if provided
    if (sfc.script) {
      try {
        // Sanitize script code
        const sanitized = sanitizeComponentCode(sfc.script)

        // Execute script in controlled context
        const scriptFunction = new Function(
          'return (' + sanitized + ')'
        )
        const scriptExport = scriptFunction()

        // Merge script options
        Object.assign(componentOptions, scriptExport)
      } catch (error) {
        console.warn('Failed to parse component script:', error)
      }
    }

    // Add styles if provided
    if (sfc.style) {
      // Styles are injected as-is (they're not executable)
      const style = document.createElement('style')
      style.textContent = sfc.style
      document.head.appendChild(style)
    }

    // Create and return Vue component
    return defineComponent(componentOptions)
  } catch (error) {
    console.error('Failed to create component:', error)
    throw error
  }
}

/**
 * Load custom agent UI component
 */
export async function loadCustomAgentComponent(agentDefinition) {
  try {
    if (!agentDefinition.ui) {
      throw new Error('Agent definition must have UI')
    }

    const component = createVueComponent(agentDefinition.ui, agentDefinition.ui.dependencies || [])

    return {
      component,
      metadata: {
        agentId: agentDefinition.id,
        name: agentDefinition.name,
        version: agentDefinition.version,
        uiType: agentDefinition.uiType || 'vue-sfc'
      }
    }
  } catch (error) {
    console.error('Failed to load agent component:', error)
    throw error
  }
}

/**
 * Execute custom agent code with sandbox and context
 */
export async function executeCustomAgentCode(code, inputs = {}, context = {}) {
  try {
    // Sanitize code
    const sanitized = sanitizeComponentCode(code)

    // Create execution function
    const executionFunction = new Function(
      'inputs',
      'context',
      'return (' + sanitized + ')(inputs, context)'
    )

    // Create execution context with safe utilities
    const safeContext = {
      logger: {
        log: (...args) => console.log('[Agent]', ...args),
        info: (...args) => console.info('[Agent]', ...args),
        warn: (...args) => console.warn('[Agent]', ...args),
        error: (...args) => console.error('[Agent]', ...args)
      },
      utils: {
        delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        formatDate: (date) => new Date(date).toISOString(),
        parseJSON: (str) => {
          try {
            return JSON.parse(str)
          } catch {
            return null
          }
        },
        stringifyJSON: (obj) => JSON.stringify(obj, null, 2)
      },
      math: {
        sum: (arr) => arr.reduce((a, b) => a + b, 0),
        avg: (arr) => arr.reduce((a, b) => a + b, 0) / arr.length,
        min: (arr) => Math.min(...arr),
        max: (arr) => Math.max(...arr)
      },
      ...context
    }

    // Execute with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Execution timeout')), 30000)
    )

    const executionPromise = Promise.resolve(
      executionFunction(inputs, safeContext)
    )

    const result = await Promise.race([executionPromise, timeoutPromise])

    return {
      success: true,
      result,
      error: null
    }
  } catch (error) {
    return {
      success: false,
      result: null,
      error: {
        message: error.message,
        stack: error.stack
      }
    }
  }
}

/**
 * Validate component code syntax
 */
export function validateComponentCode(code) {
  try {
    new Function(code)
    return {
      valid: true,
      message: 'Code syntax is valid'
    }
  } catch (error) {
    return {
      valid: false,
      message: `Syntax error: ${error.message}`
    }
  }
}

/**
 * Validate component template
 */
export function validateComponentTemplate(template) {
  try {
    if (!template || !template.trim()) {
      throw new Error('Template cannot be empty')
    }

    // Basic validation: check for matching tags
    const openTags = template.match(/<[\w-]+[^/]*>/g) || []
    const closeTags = template.match(/<\/[\w-]+>/g) || []

    if (openTags.length !== closeTags.length) {
      throw new Error('Mismatched opening/closing tags')
    }

    return {
      valid: true,
      message: 'Template is valid'
    }
  } catch (error) {
    return {
      valid: false,
      message: `Template error: ${error.message}`
    }
  }
}

/**
 * Validate config schema
 */
export function validateConfigSchema(schema) {
  try {
    if (typeof schema === 'string') {
      schema = JSON.parse(schema)
    }

    if (!schema.properties) {
      throw new Error('Schema must have properties object')
    }

    return {
      valid: true,
      message: 'Config schema is valid'
    }
  } catch (error) {
    return {
      valid: false,
      message: `Schema error: ${error.message}`
    }
  }
}

/**
 * Extract dependencies from code
 */
export function extractDependencies(code) {
  const dependencies = new Set()

  // Find Vue component imports (like <component-name />)
  const componentMatches = code.match(/<([A-Z][a-zA-Z0-9]*)/g) || []
  componentMatches.forEach(match => {
    dependencies.add(match.substring(1))
  })

  // Find v-model, v-if, v-for references
  const vueDirMatches = code.match(/:[a-z-]+="([^"]+)"/g) || []
  vueDirMatches.forEach(match => {
    const prop = match.match(/="([^"]+)"/)[1]
    if (prop) dependencies.add(prop)
  })

  return Array.from(dependencies)
}

/**
 * Analyze agent definition for completeness
 */
export function analyzeAgentDefinition(agent) {
  const issues = []
  const warnings = []
  const info = []

  // Check required fields
  if (!agent.name || !agent.name.trim()) {
    issues.push('Agent name is required')
  }

  if (!agent.code || !agent.code.trim()) {
    issues.push('Agent code is required')
  }

  if (!agent.ui || !agent.ui.template || !agent.ui.template.trim()) {
    issues.push('Agent UI template is required')
  }

  // Check code validity
  if (agent.code) {
    const codeValidation = validateComponentCode(agent.code)
    if (!codeValidation.valid) {
      issues.push(`Code: ${codeValidation.message}`)
    }
  }

  // Check template validity
  if (agent.ui?.template) {
    const templateValidation = validateComponentTemplate(agent.ui.template)
    if (!templateValidation.valid) {
      issues.push(`UI: ${templateValidation.message}`)
    }
  }

  // Check config validity
  if (agent.config) {
    const configValidation = validateConfigSchema(agent.config)
    if (!configValidation.valid) {
      warnings.push(`Config: ${configValidation.message}`)
    }
  }

  // Extract dependencies
  if (agent.ui?.template) {
    const dependencies = extractDependencies(agent.ui.template)
    if (dependencies.length > 0) {
      info.push(`Found ${dependencies.length} component dependencies: ${dependencies.join(', ')}`)
    }
  }

  // Check for blocking patterns
  if (agent.code && /eval|Function|localStorage|sessionStorage/.test(agent.code)) {
    warnings.push('Code contains potentially dangerous patterns')
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    info
  }
}

/**
 * Create test harness for agent
 */
export async function createAgentTestHarness(agent, inputs = {}) {
  const analysis = analyzeAgentDefinition(agent)

  if (!analysis.valid) {
    return {
      success: false,
      error: `Agent validation failed: ${analysis.issues.join(', ')}`
    }
  }

  try {
    // Test code execution
    const codeResult = await executeCustomAgentCode(agent.code, inputs)

    // Test UI component creation
    let componentResult = null
    if (agent.ui) {
      componentResult = await loadCustomAgentComponent(agent)
    }

    return {
      success: true,
      codeExecution: codeResult,
      componentCreation: componentResult ? { success: true } : null,
      analysis
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      analysis
    }
  }
}
