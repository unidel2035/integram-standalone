// workPlanService.js - Service for Work Plan management
// Issue #5427: Work Plan Templates - Шаблоны планов работы субагента

/**
 * Work Plan Step Types
 */
export const STEP_TYPES = {
  LLM: 'llm',           // LLM processing step
  MCP: 'mcp',           // MCP operation (database, API)
  CONDITION: 'condition', // Conditional branching
  ACTION: 'action',     // Custom action
  TRANSFORM: 'transform', // Data transformation
  WEBHOOK: 'webhook'    // External webhook call
};

/**
 * Trigger Types
 */
export const TRIGGER_TYPES = {
  MESSAGE: 'message',   // On message received
  SCHEDULE: 'schedule', // Scheduled execution
  WEBHOOK: 'webhook',   // Webhook trigger
  MANUAL: 'manual',     // Manual execution
  EVENT: 'event'        // System event
};

/**
 * MCP Operation Types
 */
export const MCP_OPERATIONS = {
  SEARCH: 'search',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  QUERY: 'query',
  EXECUTE_REPORT: 'execute_report'
};

/**
 * Work Plan Schema
 */
export const WORK_PLAN_SCHEMA = {
  id: '',               // Unique identifier
  name: '',             // Plan name
  description: '',      // Plan description
  version: '1.0.0',     // Schema version
  trigger: {
    type: '',           // Trigger type (from TRIGGER_TYPES)
    config: {}          // Trigger-specific configuration
  },
  steps: [],            // Array of step objects
  variables: {},        // Global variables
  fallback: {           // Fallback configuration
    action: '',         // Action to take on error
    message: ''         // Fallback message
  },
  metadata: {
    createdAt: null,
    updatedAt: null,
    createdBy: null,
    tags: []
  }
};

/**
 * Work Plan Step Schema
 */
export const STEP_SCHEMA = {
  id: '',               // Unique step identifier
  name: '',             // Step name
  description: '',      // Step description
  type: '',             // Step type (from STEP_TYPES)
  config: {},           // Step-specific configuration
  inputVars: [],        // Input variables (array of variable names)
  outputVar: null,      // Output variable name
  onError: {            // Error handling
    action: 'continue', // continue | stop | retry | goto
    retryCount: 0,
    gotoStep: null
  },
  timeout: 30000,       // Timeout in milliseconds
  enabled: true         // Whether step is enabled
};

/**
 * LLM Step Configuration Schema
 */
export const LLM_STEP_CONFIG = {
  prompt: '',           // Prompt template with {{variables}}
  model: null,          // Optional model override
  temperature: 0.7,
  maxTokens: 1000,
  systemPrompt: null,
  outputVar: 'result'   // Variable to store result
};

/**
 * MCP Step Configuration Schema
 */
export const MCP_STEP_CONFIG = {
  operation: '',        // MCP operation type
  table: null,          // Table/resource name
  query: null,          // Query parameters
  data: null,           // Data for create/update
  filters: {},          // Filter conditions
  outputVar: 'result'
};

/**
 * Condition Step Configuration Schema
 */
export const CONDITION_STEP_CONFIG = {
  condition: '',        // Condition expression (e.g., "{{var}} == 'value'")
  operator: '==',       // Comparison operator
  thenStep: null,       // Step ID to execute if true
  elseStep: null,       // Step ID to execute if false
  thenSteps: [],        // Array of step IDs to execute if true
  elseSteps: []         // Array of step IDs to execute if false
};

/**
 * Action Step Configuration Schema
 */
export const ACTION_STEP_CONFIG = {
  actionType: '',       // Action type (e.g., 'send_email', 'notify', 'log')
  parameters: {},       // Action parameters
  outputVar: 'result'
};

/**
 * Validate Work Plan
 * @param {Object} plan - Work plan to validate
 * @returns {Object} Validation result { valid: boolean, errors: [] }
 */
export function validateWorkPlan(plan) {
  const errors = [];

  // Required fields
  if (!plan.name || plan.name.trim() === '') {
    errors.push('Plan name is required');
  }

  if (!plan.trigger || !plan.trigger.type) {
    errors.push('Trigger type is required');
  } else if (!Object.values(TRIGGER_TYPES).includes(plan.trigger.type)) {
    errors.push(`Invalid trigger type: ${plan.trigger.type}`);
  }

  if (!plan.steps || !Array.isArray(plan.steps)) {
    errors.push('Steps must be an array');
  } else if (plan.steps.length === 0) {
    errors.push('Plan must have at least one step');
  } else {
    // Validate each step
    const stepIds = new Set();
    plan.steps.forEach((step, index) => {
      const stepErrors = validateStep(step, index);
      errors.push(...stepErrors);

      // Check for duplicate step IDs
      if (step.id) {
        if (stepIds.has(step.id)) {
          errors.push(`Duplicate step ID: ${step.id}`);
        }
        stepIds.add(step.id);
      }
    });

    // Validate step references in conditions
    plan.steps.forEach((step) => {
      if (step.type === STEP_TYPES.CONDITION) {
        if (step.config.thenStep && !stepIds.has(step.config.thenStep)) {
          errors.push(`Invalid thenStep reference: ${step.config.thenStep}`);
        }
        if (step.config.elseStep && !stepIds.has(step.config.elseStep)) {
          errors.push(`Invalid elseStep reference: ${step.config.elseStep}`);
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate Work Plan Step
 * @param {Object} step - Step to validate
 * @param {number} index - Step index
 * @returns {Array} Array of error messages
 */
export function validateStep(step, index) {
  const errors = [];
  const prefix = `Step ${index + 1}`;

  if (!step.id || step.id.trim() === '') {
    errors.push(`${prefix}: Step ID is required`);
  }

  if (!step.name || step.name.trim() === '') {
    errors.push(`${prefix}: Step name is required`);
  }

  if (!step.type) {
    errors.push(`${prefix}: Step type is required`);
  } else if (!Object.values(STEP_TYPES).includes(step.type)) {
    errors.push(`${prefix}: Invalid step type: ${step.type}`);
  }

  if (!step.config) {
    errors.push(`${prefix}: Step config is required`);
  } else {
    // Type-specific validation
    switch (step.type) {
      case STEP_TYPES.LLM:
        if (!step.config.prompt || step.config.prompt.trim() === '') {
          errors.push(`${prefix}: LLM step requires a prompt`);
        }
        break;
      case STEP_TYPES.MCP:
        if (!step.config.operation) {
          errors.push(`${prefix}: MCP step requires an operation`);
        }
        break;
      case STEP_TYPES.CONDITION:
        if (!step.config.condition && !step.config.thenStep && !step.config.elseStep) {
          errors.push(`${prefix}: Condition step requires condition or step references`);
        }
        break;
      case STEP_TYPES.ACTION:
        if (!step.config.actionType) {
          errors.push(`${prefix}: Action step requires actionType`);
        }
        break;
    }
  }

  return errors;
}

/**
 * Create a new work plan
 * @param {Object} planData - Plan data
 * @returns {Object} New work plan
 */
export function createWorkPlan(planData = {}) {
  return {
    ...WORK_PLAN_SCHEMA,
    id: planData.id || `plan-${Date.now()}`,
    name: planData.name || 'New Work Plan',
    description: planData.description || '',
    trigger: planData.trigger || { type: TRIGGER_TYPES.MANUAL, config: {} },
    steps: planData.steps || [],
    variables: planData.variables || {},
    fallback: planData.fallback || { action: 'stop', message: 'Error occurred' },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: planData.createdBy || null,
      tags: planData.tags || []
    }
  };
}

/**
 * Create a new step
 * @param {Object} stepData - Step data
 * @returns {Object} New step
 */
export function createStep(stepData = {}) {
  const baseStep = {
    ...STEP_SCHEMA,
    id: stepData.id || `step-${Date.now()}`,
    name: stepData.name || 'New Step',
    description: stepData.description || '',
    type: stepData.type || STEP_TYPES.LLM,
    enabled: stepData.enabled !== undefined ? stepData.enabled : true
  };

  // Add type-specific default config
  switch (stepData.type) {
    case STEP_TYPES.LLM:
      baseStep.config = { ...LLM_STEP_CONFIG, ...stepData.config };
      break;
    case STEP_TYPES.MCP:
      baseStep.config = { ...MCP_STEP_CONFIG, ...stepData.config };
      break;
    case STEP_TYPES.CONDITION:
      baseStep.config = { ...CONDITION_STEP_CONFIG, ...stepData.config };
      break;
    case STEP_TYPES.ACTION:
      baseStep.config = { ...ACTION_STEP_CONFIG, ...stepData.config };
      break;
    default:
      baseStep.config = stepData.config || {};
  }

  return baseStep;
}

/**
 * Parse variables from text (finds {{variable}} patterns)
 * @param {string} text - Text to parse
 * @returns {Array} Array of variable names
 */
export function parseVariables(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  return matches.map(match => match.replace(/\{\{|\}\}/g, '').trim());
}

/**
 * Replace variables in text with values
 * @param {string} text - Text with variables
 * @param {Object} variables - Variable values
 * @returns {string} Text with replaced variables
 */
export function replaceVariables(text, variables = {}) {
  if (!text || typeof text !== 'string') return text;

  let result = text;
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(regex, variables[key]);
  });

  return result;
}

/**
 * Evaluate condition expression
 * @param {string} condition - Condition expression
 * @param {Object} variables - Variable values
 * @returns {boolean} Evaluation result
 */
export function evaluateCondition(condition, variables = {}) {
  try {
    // Replace variables in condition
    const processedCondition = replaceVariables(condition, variables);

    // Simple evaluation (can be extended with a proper expression parser)
    // For now, supports basic comparisons
    const operators = ['==', '!=', '>', '<', '>=', '<=', 'includes', 'startsWith', 'endsWith'];

    for (const op of operators) {
      if (processedCondition.includes(op)) {
        const [left, right] = processedCondition.split(op).map(s => s.trim().replace(/['"]/g, ''));

        switch (op) {
          case '==': return left === right;
          case '!=': return left !== right;
          case '>': return parseFloat(left) > parseFloat(right);
          case '<': return parseFloat(left) < parseFloat(right);
          case '>=': return parseFloat(left) >= parseFloat(right);
          case '<=': return parseFloat(left) <= parseFloat(right);
          case 'includes': return left.includes(right);
          case 'startsWith': return left.startsWith(right);
          case 'endsWith': return left.endsWith(right);
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Error evaluating condition:', error);
    return false;
  }
}

/**
 * Get all variables used in a work plan
 * @param {Object} plan - Work plan
 * @returns {Set} Set of variable names
 */
export function getUsedVariables(plan) {
  const variables = new Set();

  if (!plan || !plan.steps) return variables;

  plan.steps.forEach(step => {
    // Parse variables from config
    if (step.config) {
      Object.values(step.config).forEach(value => {
        if (typeof value === 'string') {
          parseVariables(value).forEach(v => variables.add(v));
        }
      });
    }

    // Add input variables
    if (step.inputVars) {
      step.inputVars.forEach(v => variables.add(v));
    }

    // Add output variable
    if (step.outputVar) {
      variables.add(step.outputVar);
    }
  });

  return variables;
}

/**
 * Clone a work plan
 * @param {Object} plan - Work plan to clone
 * @param {Object} options - Clone options
 * @returns {Object} Cloned work plan
 */
export function cloneWorkPlan(plan, options = {}) {
  const cloned = JSON.parse(JSON.stringify(plan));

  if (options.newName) {
    cloned.name = options.newName;
  } else {
    cloned.name = `${plan.name} (Copy)`;
  }

  cloned.id = `plan-${Date.now()}`;
  cloned.metadata.createdAt = new Date().toISOString();
  cloned.metadata.updatedAt = new Date().toISOString();

  // Generate new step IDs if requested
  if (options.regenerateStepIds) {
    const stepIdMap = {};
    cloned.steps.forEach((step, index) => {
      const newId = `step-${Date.now()}-${index}`;
      stepIdMap[step.id] = newId;
      step.id = newId;
    });

    // Update step references in conditions
    cloned.steps.forEach(step => {
      if (step.type === STEP_TYPES.CONDITION) {
        if (step.config.thenStep && stepIdMap[step.config.thenStep]) {
          step.config.thenStep = stepIdMap[step.config.thenStep];
        }
        if (step.config.elseStep && stepIdMap[step.config.elseStep]) {
          step.config.elseStep = stepIdMap[step.config.elseStep];
        }
      }
    });
  }

  return cloned;
}

/**
 * Export work plan to JSON
 * @param {Object} plan - Work plan to export
 * @returns {string} JSON string
 */
export function exportWorkPlan(plan) {
  return JSON.stringify(plan, null, 2);
}

/**
 * Import work plan from JSON
 * @param {string} json - JSON string
 * @returns {Object} Work plan object
 */
export function importWorkPlan(json) {
  try {
    const plan = JSON.parse(json);
    const validation = validateWorkPlan(plan);

    if (!validation.valid) {
      throw new Error(`Invalid work plan: ${validation.errors.join(', ')}`);
    }

    return plan;
  } catch (error) {
    throw new Error(`Failed to import work plan: ${error.message}`);
  }
}
