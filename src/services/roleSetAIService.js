/**
 * Role-Sets AI Service
 *
 * AI-powered assistance for Role-Sets operations using token-based LLM integration.
 * Issue #1906 - Phase 8: LLM Integration for Role-Sets
 *
 * This service provides:
 * - AI-powered prism generation from natural language descriptions
 * - Natural language to PQ-program compilation
 * - Witness validation and generation assistance
 * - Anomaly detection in role bindings
 * - Prism consistency validation
 *
 * All operations use TokenBasedLLMCoordinator with default DeepSeek model.
 */

import { getDefaultToken, getCurrentUserId, estimateTokenCount, calculateCost } from './aiTokenService'
import { getApiUrl } from '../utils/apiConfig'

// Use orchestrator API
const API_BASE_URL = getApiUrl('/api')

// Application name for usage tracking
const APPLICATION_NAME = 'FlowEditor-RoleSets'

/**
 * Generate prism suggestions from natural language description
 *
 * @param {Object} options - Generation options
 * @param {string} options.description - Natural language description of the domain
 * @param {string[]} [options.existingPrisms] - Names of existing prisms (to avoid conflicts)
 * @param {string} [options.userId] - User ID (defaults to current user)
 * @returns {Promise<Object>} Generated prism suggestion
 */
export async function generatePrismSuggestion(options) {
  const {
    description,
    existingPrisms = [],
    userId = getCurrentUserId()
  } = options

  // Get default token
  const { token, defaultModel } = await getDefaultToken(userId)

  // Construct the prompt
  const existingPrismsContext = existingPrisms.length > 0
    ? `\n\nExisting prisms to avoid conflicts: ${existingPrisms.join(', ')}`
    : ''

  const prompt = `You are an expert in Role-Sets theory and conceptual modeling. Given a domain description, suggest a prism definition following these principles:

1. Prisms are first-class contexts/perspectives
2. Each prism should have a clear, focused purpose
3. Roles within prisms define contracts (required attributes)
4. Invariants validate role membership
5. Witnesses are proofs that satisfy role contracts

Domain Description:
${description}${existingPrismsContext}

Generate a prism suggestion in the following JSON format:
{
  "name": "PrismName",
  "description": "Clear description of what this prism represents",
  "dslDefinition": "Brief DSL/vocabulary for this context",
  "roles": [
    {
      "name": "RoleName",
      "description": "What this role represents",
      "contract": ["attribute1", "attribute2"],
      "attributeTypes": {
        "attribute1": "string",
        "attribute2": "number"
      },
      "invariants": ["attribute1.length > 0", "attribute2 > 0"],
      "operations": ["operationName"]
    }
  ],
  "invariants": ["prism-level invariants"],
  "rationale": "Why this prism makes sense for the domain"
}

Provide ONLY the JSON response, no additional text.`

  // Call AI via orchestrator
  const response = await fetch(`${API_BASE_URL}/ai-tokens/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.id}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      modelId: defaultModel.id,
      prompt,
      application: APPLICATION_NAME,
      operation: 'prism-generation',
      temperature: 0.3,
      maxTokens: 2048
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to generate prism' }))
    throw new Error(error.error || 'Failed to generate prism suggestion')
  }

  const result = await response.json()

  // Parse the AI response
  try {
    const prismData = JSON.parse(result.content)
    return {
      success: true,
      prism: prismData,
      usage: result.usage,
      modelUsed: result.model
    }
  } catch (parseError) {
    // If JSON parsing fails, return raw content for user review
    return {
      success: false,
      error: 'Failed to parse AI response as JSON',
      rawResponse: result.content,
      usage: result.usage
    }
  }
}

/**
 * Generate multiple prism suggestions for a complex domain
 *
 * @param {Object} options - Generation options
 * @param {string} options.description - Natural language description of the domain
 * @param {number} [options.count=3] - Number of suggestions to generate
 * @param {string} [options.userId] - User ID
 * @returns {Promise<Object>} Multiple prism suggestions
 */
export async function generateMultiplePrismSuggestions(options) {
  const {
    description,
    count = 3,
    userId = getCurrentUserId()
  } = options

  const { token, defaultModel } = await getDefaultToken(userId)

  const prompt = `You are an expert in Role-Sets theory. Given a domain description, suggest ${count} different prism perspectives that could be useful for modeling this domain.

Domain Description:
${description}

For each prism, provide:
1. A unique name
2. A clear description
3. At least 2-3 roles with their contracts

Return a JSON array of ${count} prism suggestions, following the format:
[
  {
    "name": "PrismName1",
    "description": "...",
    "roles": [...],
    "rationale": "Why this perspective is valuable"
  },
  ...
]

Provide ONLY the JSON array, no additional text.`

  const response = await fetch(`${API_BASE_URL}/ai-tokens/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.id}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      modelId: defaultModel.id,
      prompt,
      application: APPLICATION_NAME,
      operation: 'multi-prism-generation',
      temperature: 0.5,
      maxTokens: 4096
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to generate prisms' }))
    throw new Error(error.error || 'Failed to generate prism suggestions')
  }

  const result = await response.json()

  try {
    const prisms = JSON.parse(result.content)
    return {
      success: true,
      prisms,
      usage: result.usage,
      modelUsed: result.model
    }
  } catch (parseError) {
    return {
      success: false,
      error: 'Failed to parse AI response',
      rawResponse: result.content,
      usage: result.usage
    }
  }
}

/**
 * Compile natural language query to PQ-program
 *
 * @param {Object} options - Compilation options
 * @param {string} options.query - Natural language query
 * @param {Array} options.availablePrisms - List of available prisms with roles
 * @param {string} [options.userId] - User ID
 * @returns {Promise<Object>} Compiled PQ-program
 */
export async function compileNaturalLanguageToPQ(options) {
  const {
    query,
    availablePrisms = [],
    userId = getCurrentUserId()
  } = options

  const { token, defaultModel } = await getDefaultToken(userId)

  // Format available prisms context
  const prismsContext = availablePrisms.map(p => {
    const rolesStr = p.roles?.map(r => `    - ${r.name} (attributes: ${r.contract?.join(', ') || 'none'})`).join('\n') || ''
    return `  - Prism: ${p.name}\n${rolesStr}`
  }).join('\n')

  const prompt = `You are an expert in PQ-program language for Role-Sets. Convert a natural language query into a PQ-program.

Available Prisms and Roles:
${prismsContext || '(No prisms available)'}

Natural Language Query:
"${query}"

PQ-program syntax:
- FROM <Prism>.<Role> - Select a role from a prism
- WHERE <conditions> - Filter by attribute predicates
- SELECT <attributes> - Project specific attributes
- TRANSFORM TO <Prism>.<Role> - Move to another prism/role
- COMPOSE WITH <PQ> - Compose with another PQ-program

Example:
{
  "from": "Commerce.Product",
  "where": [
    { "attribute": "price", "operator": ">", "value": 1000 }
  ],
  "select": ["price", "inventory", "sku"]
}

Generate a PQ-program in JSON format. Also provide:
1. An explanation of what the program does
2. Any assumptions made
3. Suggestions for optimization (if applicable)

Response format:
{
  "pqProgram": { ... },
  "explanation": "...",
  "assumptions": ["..."],
  "optimizations": ["..."]
}

Provide ONLY the JSON response, no additional text.`

  const response = await fetch(`${API_BASE_URL}/ai-tokens/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.id}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      modelId: defaultModel.id,
      prompt,
      application: APPLICATION_NAME,
      operation: 'pq-compilation',
      temperature: 0.2,
      maxTokens: 2048
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to compile PQ' }))
    throw new Error(error.error || 'Failed to compile natural language to PQ')
  }

  const result = await response.json()

  try {
    const compiled = JSON.parse(result.content)
    return {
      success: true,
      pqProgram: compiled.pqProgram,
      explanation: compiled.explanation,
      assumptions: compiled.assumptions || [],
      optimizations: compiled.optimizations || [],
      usage: result.usage,
      modelUsed: result.model
    }
  } catch (parseError) {
    return {
      success: false,
      error: 'Failed to parse PQ compilation result',
      rawResponse: result.content,
      usage: result.usage
    }
  }
}

/**
 * Optimize an existing PQ-program
 *
 * @param {Object} options - Optimization options
 * @param {Object} options.pqProgram - The PQ-program to optimize
 * @param {Array} [options.availablePrisms] - Available prisms context
 * @param {string} [options.userId] - User ID
 * @returns {Promise<Object>} Optimized PQ-program with suggestions
 */
export async function optimizePQProgram(options) {
  const {
    pqProgram,
    availablePrisms = [],
    userId = getCurrentUserId()
  } = options

  const { token, defaultModel } = await getDefaultToken(userId)

  const prompt = `You are an expert in PQ-program optimization for Role-Sets.

Current PQ-program:
${JSON.stringify(pqProgram, null, 2)}

Available Prisms: ${availablePrisms.map(p => p.name).join(', ')}

Analyze this PQ-program and suggest optimizations:
1. More efficient query paths
2. Alternative prism/role combinations
3. Predicate optimizations (move filters earlier)
4. Reduce unnecessary transformations

Response format:
{
  "optimizedProgram": { ... },
  "improvements": [
    {
      "type": "efficiency|readability|correctness",
      "description": "...",
      "impact": "high|medium|low"
    }
  ],
  "executionPlan": "High-level description of execution"
}

Provide ONLY the JSON response, no additional text.`

  const response = await fetch(`${API_BASE_URL}/ai-tokens/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.id}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      modelId: defaultModel.id,
      prompt,
      application: APPLICATION_NAME,
      operation: 'pq-optimization',
      temperature: 0.3,
      maxTokens: 2048
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to optimize PQ' }))
    throw new Error(error.error || 'Failed to optimize PQ-program')
  }

  const result = await response.json()

  try {
    const optimized = JSON.parse(result.content)
    return {
      success: true,
      optimizedProgram: optimized.optimizedProgram,
      improvements: optimized.improvements || [],
      executionPlan: optimized.executionPlan,
      usage: result.usage,
      modelUsed: result.model
    }
  } catch (parseError) {
    return {
      success: false,
      error: 'Failed to parse optimization result',
      rawResponse: result.content,
      usage: result.usage
    }
  }
}

/**
 * Generate witness for a Thing-Role binding
 *
 * @param {Object} options - Witness generation options
 * @param {string} options.thingId - Thing ID
 * @param {Object} options.role - Role definition with contract
 * @param {Object} [options.existingData] - Existing data about the thing
 * @param {string} [options.userId] - User ID
 * @returns {Promise<Object>} Generated witness
 */
export async function generateWitness(options) {
  const {
    thingId,
    role,
    existingData = {},
    userId = getCurrentUserId()
  } = options

  const { token, defaultModel } = await getDefaultToken(userId)

  const prompt = `You are an expert in witness generation for Role-Sets theory.

Thing ID: ${thingId}

Role Definition:
- Name: ${role.name}
- Contract (required attributes): ${role.contract?.join(', ') || 'none'}
- Attribute Types: ${JSON.stringify(role.attributeTypes || {}, null, 2)}
- Invariants: ${role.invariants?.join(', ') || 'none'}

Existing Data about Thing:
${JSON.stringify(existingData, null, 2)}

Generate a witness (proof) that this Thing can satisfy the role contract.

If existing data is sufficient, validate and return the witness.
If data is missing, suggest reasonable default values based on the role contract.
If the Thing cannot satisfy the contract, explain why.

Response format:
{
  "valid": true/false,
  "witness": {
    "attribute1": value1,
    "attribute2": value2,
    ...
  },
  "explanation": "Why this witness is valid/invalid",
  "missingData": ["list of missing required attributes"],
  "suggestions": ["suggestions for completing the witness"]
}

Provide ONLY the JSON response, no additional text.`

  const response = await fetch(`${API_BASE_URL}/ai-tokens/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.id}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      modelId: defaultModel.id,
      prompt,
      application: APPLICATION_NAME,
      operation: 'witness-generation',
      temperature: 0.2,
      maxTokens: 1024
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to generate witness' }))
    throw new Error(error.error || 'Failed to generate witness')
  }

  const result = await response.json()

  try {
    const witnessResult = JSON.parse(result.content)
    return {
      success: true,
      valid: witnessResult.valid,
      witness: witnessResult.witness,
      explanation: witnessResult.explanation,
      missingData: witnessResult.missingData || [],
      suggestions: witnessResult.suggestions || [],
      usage: result.usage,
      modelUsed: result.model
    }
  } catch (parseError) {
    return {
      success: false,
      error: 'Failed to parse witness generation result',
      rawResponse: result.content,
      usage: result.usage
    }
  }
}

/**
 * Validate witness consistency and detect anomalies
 *
 * @param {Object} options - Validation options
 * @param {Object} options.witness - Witness data to validate
 * @param {Object} options.role - Role definition
 * @param {Array} [options.similarWitnesses] - Other witnesses for the same role (for anomaly detection)
 * @param {string} [options.userId] - User ID
 * @returns {Promise<Object>} Validation result with anomaly detection
 */
export async function validateWitnessWithAI(options) {
  const {
    witness,
    role,
    similarWitnesses = [],
    userId = getCurrentUserId()
  } = options

  const { token, defaultModel } = await getDefaultToken(userId)

  const similarContext = similarWitnesses.length > 0
    ? `\n\nSimilar witnesses for comparison:\n${JSON.stringify(similarWitnesses.slice(0, 5), null, 2)}`
    : ''

  const prompt = `You are an expert in witness validation for Role-Sets theory.

Role Contract:
- Required attributes: ${role.contract?.join(', ') || 'none'}
- Attribute types: ${JSON.stringify(role.attributeTypes || {}, null, 2)}
- Invariants: ${role.invariants?.join(', ') || 'none'}

Witness to validate:
${JSON.stringify(witness, null, 2)}${similarContext}

Validate this witness:
1. Check all required attributes are present
2. Verify attribute types match the contract
3. Validate all invariants are satisfied
4. Detect anomalies compared to similar witnesses (outliers, unusual patterns)

Response format:
{
  "valid": true/false,
  "contractViolations": ["list of contract violations"],
  "invariantViolations": ["list of invariant violations"],
  "anomalies": [
    {
      "attribute": "attributeName",
      "severity": "high|medium|low",
      "description": "What's unusual",
      "suggestion": "How to fix"
    }
  ],
  "overallScore": 0-100,
  "recommendation": "accept|review|reject"
}

Provide ONLY the JSON response, no additional text.`

  const response = await fetch(`${API_BASE_URL}/ai-tokens/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.id}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      modelId: defaultModel.id,
      prompt,
      application: APPLICATION_NAME,
      operation: 'witness-validation',
      temperature: 0.2,
      maxTokens: 1536
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to validate witness' }))
    throw new Error(error.error || 'Failed to validate witness with AI')
  }

  const result = await response.json()

  try {
    const validation = JSON.parse(result.content)
    return {
      success: true,
      valid: validation.valid,
      contractViolations: validation.contractViolations || [],
      invariantViolations: validation.invariantViolations || [],
      anomalies: validation.anomalies || [],
      overallScore: validation.overallScore || 0,
      recommendation: validation.recommendation,
      usage: result.usage,
      modelUsed: result.model
    }
  } catch (parseError) {
    return {
      success: false,
      error: 'Failed to parse validation result',
      rawResponse: result.content,
      usage: result.usage
    }
  }
}

/**
 * Suggest missing roles for a prism based on domain analysis
 *
 * @param {Object} options - Suggestion options
 * @param {Object} options.prism - Prism definition
 * @param {Array} [options.existingRoles] - Current roles in the prism
 * @param {string} [options.domainContext] - Additional domain context
 * @param {string} [options.userId] - User ID
 * @returns {Promise<Object>} Role suggestions
 */
export async function suggestMissingRoles(options) {
  const {
    prism,
    existingRoles = [],
    domainContext = '',
    userId = getCurrentUserId()
  } = options

  const { token, defaultModel } = await getDefaultToken(userId)

  const existingRolesStr = existingRoles.map(r => `- ${r.name}: ${r.description || 'No description'}`).join('\n')

  const prompt = `You are an expert in Role-Sets theory and conceptual modeling.

Prism: ${prism.name}
Description: ${prism.description || 'No description'}
DSL: ${prism.dslDefinition || 'No DSL defined'}

Existing Roles:
${existingRolesStr || '(No roles defined yet)'}

${domainContext ? `Domain Context:\n${domainContext}\n` : ''}

Analyze this prism and suggest additional roles that might be missing but would be valuable for this context.

For each suggested role, provide:
1. Name and description
2. Contract (required attributes)
3. Rationale (why this role is useful)

Response format:
{
  "suggestions": [
    {
      "name": "RoleName",
      "description": "...",
      "contract": ["attr1", "attr2"],
      "attributeTypes": { "attr1": "type", ... },
      "invariants": ["..."],
      "rationale": "Why this role is valuable"
    }
  ],
  "completenessScore": 0-100,
  "feedback": "Overall feedback on the prism design"
}

Provide ONLY the JSON response, no additional text.`

  const response = await fetch(`${API_BASE_URL}/ai-tokens/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.id}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      modelId: defaultModel.id,
      prompt,
      application: APPLICATION_NAME,
      operation: 'role-suggestion',
      temperature: 0.4,
      maxTokens: 2048
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to suggest roles' }))
    throw new Error(error.error || 'Failed to suggest missing roles')
  }

  const result = await response.json()

  try {
    const suggestions = JSON.parse(result.content)
    return {
      success: true,
      suggestions: suggestions.suggestions || [],
      completenessScore: suggestions.completenessScore || 0,
      feedback: suggestions.feedback,
      usage: result.usage,
      modelUsed: result.model
    }
  } catch (parseError) {
    return {
      success: false,
      error: 'Failed to parse role suggestions',
      rawResponse: result.content,
      usage: result.usage
    }
  }
}

/**
 * Explain a PQ-program execution trace
 *
 * @param {Object} options - Explanation options
 * @param {Object} options.pqProgram - The PQ-program
 * @param {Array} options.trace - Execution trace
 * @param {string} [options.userId] - User ID
 * @returns {Promise<Object>} Human-readable explanation
 */
export async function explainPQTrace(options) {
  const {
    pqProgram,
    trace,
    userId = getCurrentUserId()
  } = options

  const { token, defaultModel } = await getDefaultToken(userId)

  const prompt = `You are an expert in explaining PQ-program execution for Role-Sets.

PQ-program:
${JSON.stringify(pqProgram, null, 2)}

Execution Trace:
${JSON.stringify(trace, null, 2)}

Provide a human-readable explanation of:
1. What the PQ-program does
2. How it was executed (step by step)
3. Why each Thing in the trace matched (or didn't match)
4. Summary of results

Response format:
{
  "summary": "One sentence summary",
  "detailed": "Detailed explanation with steps",
  "matchReasons": {
    "thingId1": "why it matched",
    "thingId2": "why it matched",
    ...
  },
  "insights": ["interesting insights from the trace"]
}

Provide ONLY the JSON response, no additional text.`

  const response = await fetch(`${API_BASE_URL}/ai-tokens/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.id}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      modelId: defaultModel.id,
      prompt,
      application: APPLICATION_NAME,
      operation: 'trace-explanation',
      temperature: 0.3,
      maxTokens: 2048
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to explain trace' }))
    throw new Error(error.error || 'Failed to explain PQ trace')
  }

  const result = await response.json()

  try {
    const explanation = JSON.parse(result.content)
    return {
      success: true,
      summary: explanation.summary,
      detailed: explanation.detailed,
      matchReasons: explanation.matchReasons || {},
      insights: explanation.insights || [],
      usage: result.usage,
      modelUsed: result.model
    }
  } catch (parseError) {
    return {
      success: false,
      error: 'Failed to parse trace explanation',
      rawResponse: result.content,
      usage: result.usage
    }
  }
}

/**
 * Estimate token cost for an operation before executing
 *
 * @param {string} prompt - The prompt that will be sent
 * @param {Object} [model] - Model configuration (optional, defaults to DeepSeek)
 * @returns {Object} Cost estimation
 */
export function estimateOperationCost(prompt, model = null) {
  const estimatedPromptTokens = estimateTokenCount(prompt)
  const estimatedCompletionTokens = Math.ceil(estimatedPromptTokens * 0.5) // Rough estimate

  if (!model) {
    // Use default DeepSeek pricing if no model provided
    model = {
      cost_per_1k_input: '0.00014',
      cost_per_1k_output: '0.00028'
    }
  }

  const estimatedCost = calculateCost(estimatedPromptTokens, estimatedCompletionTokens, model)

  return {
    estimatedPromptTokens,
    estimatedCompletionTokens,
    estimatedTotalTokens: estimatedPromptTokens + estimatedCompletionTokens,
    estimatedCost,
    estimatedCostFormatted: `$${estimatedCost.toFixed(6)}`
  }
}

export default {
  generatePrismSuggestion,
  generateMultiplePrismSuggestions,
  compileNaturalLanguageToPQ,
  optimizePQProgram,
  generateWitness,
  validateWitnessWithAI,
  suggestMissingRoles,
  explainPQTrace,
  estimateOperationCost
}
