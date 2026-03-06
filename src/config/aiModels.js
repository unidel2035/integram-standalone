/**
 * AI Models Configuration
 * Issue #4581: Provider and model selection for workspace AI agent
 * Issue #4605: Fix "No API key available for provider: deepseek" error
 *
 * Defines available AI providers and their models for use in workspace chat.
 *
 * IMPORTANT: The default provider is Polza.ai which acts as an aggregator
 * providing access to multiple AI models without requiring separate API keys.
 * Model IDs must match the format expected by the backend API (e.g., 'anthropic/claude-sonnet-4.5').
 */

export const AI_PROVIDERS = {
  POLZA: {
    id: 'polza',
    name: 'Polza.ai',
    displayName: 'Polza.ai (Recommended)',
    description: 'Aggregator with access to multiple AI models',
    baseUrl: 'https://api.polza.ai/api/v1',
    envKey: 'POLZA_AI_API_KEY',
    default: true
  },
  OPENAI: {
    id: 'openai',
    name: 'OpenAI',
    displayName: 'OpenAI',
    description: 'GPT models from OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY'
  },
  ANTHROPIC: {
    id: 'anthropic',
    name: 'Anthropic',
    displayName: 'Anthropic',
    description: 'Claude models from Anthropic',
    baseUrl: 'https://api.anthropic.com',
    envKey: 'ANTHROPIC_API_KEY'
  },
  DEEPSEEK: {
    id: 'deepseek',
    name: 'DeepSeek',
    displayName: 'DeepSeek',
    description: 'DeepSeek AI models',
    baseUrl: 'https://api.deepseek.com',
    envKey: 'DEEPSEEK_API_KEY'
  },
  KODACODE: {
    id: 'kodacode',
    name: 'Kodacode',
    displayName: 'Kodacode',
    description: 'Multiple AI models via Kodacode API',
    baseUrl: 'https://api.kodacode.ru',
    envKey: 'GITHUB_TOKEN'
  }
}

export const AI_MODELS = {
  // Polza.ai models (default provider)
  'polza/claude-sonnet-4.5': {
    id: 'anthropic/claude-sonnet-4.5', // Use the actual model ID for API calls
    modelId: 'anthropic/claude-sonnet-4.5',
    provider: AI_PROVIDERS.POLZA,
    displayName: 'Claude Sonnet 4.5 (Polza)',
    description: 'Most capable model for complex tasks via Polza.ai',
    contextWindow: '200K',
    maxOutputTokens: '8192',
    costPer1kInput: 3.00,
    costPer1kOutput: 15.00,
    recommended: true
  },
  'polza/claude-sonnet-3.5': {
    id: 'anthropic/claude-3.5-sonnet',
    modelId: 'anthropic/claude-3.5-sonnet',
    provider: AI_PROVIDERS.POLZA,
    displayName: 'Claude Sonnet 3.5 (Polza)',
    description: 'Balanced performance and cost via Polza.ai',
    contextWindow: '200K',
    maxOutputTokens: '4096',
    costPer1kInput: 3.00,
    costPer1kOutput: 15.00
  },
  'polza/gpt-4': {
    id: 'openai/gpt-4',
    modelId: 'openai/gpt-4',
    provider: AI_PROVIDERS.POLZA,
    displayName: 'GPT-4 (Polza)',
    description: 'OpenAI flagship model via Polza.ai',
    contextWindow: '128K',
    maxOutputTokens: '4096',
    costPer1kInput: 30.00,
    costPer1kOutput: 60.00
  },
  'polza/gpt-4-turbo': {
    id: 'openai/gpt-4-turbo',
    modelId: 'openai/gpt-4-turbo',
    provider: AI_PROVIDERS.POLZA,
    displayName: 'GPT-4 Turbo (Polza)',
    description: 'Faster GPT-4 variant via Polza.ai',
    contextWindow: '128K',
    maxOutputTokens: '4096',
    costPer1kInput: 10.00,
    costPer1kOutput: 30.00
  },

  'polza/deepseek-chat': {
    id: 'deepseek/deepseek-chat',
    modelId: 'deepseek/deepseek-chat',
    provider: AI_PROVIDERS.POLZA,
    displayName: 'DeepSeek Chat (Polza)',
    description: 'DeepSeek Chat via Polza.ai gateway',
    contextWindow: '128K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.14,
    costPer1kOutput: 0.28
  },
  'polza/deepseek-r1-0528': {
    id: 'deepseek/deepseek-r1-0528',
    modelId: 'deepseek/deepseek-r1-0528',
    provider: AI_PROVIDERS.POLZA,
    displayName: 'DeepSeek R1-0528 (Reasoning)',
    description: 'DeepSeek R1 reasoning model with thinking via Polza.ai',
    contextWindow: '128K',
    maxOutputTokens: '8192',
    costPer1kInput: 0.46,
    costPer1kOutput: 1.81,
    isReasoning: true,
    recommended: true
  },

  // Direct OpenAI models
  'openai/gpt-4': {
    id: 'openai_gpt4',
    modelId: 'gpt-4',
    provider: AI_PROVIDERS.OPENAI,
    displayName: 'GPT-4',
    description: 'OpenAI flagship model',
    contextWindow: '8K',
    maxOutputTokens: '4096',
    costPer1kInput: 30.00,
    costPer1kOutput: 60.00
  },
  'openai/gpt-4-turbo': {
    id: 'openai_gpt4_turbo',
    modelId: 'gpt-4-turbo-preview',
    provider: AI_PROVIDERS.OPENAI,
    displayName: 'GPT-4 Turbo',
    description: 'Faster GPT-4 variant',
    contextWindow: '128K',
    maxOutputTokens: '4096',
    costPer1kInput: 10.00,
    costPer1kOutput: 30.00
  },
  'openai/gpt-3.5-turbo': {
    id: 'openai_gpt35_turbo',
    modelId: 'gpt-3.5-turbo',
    provider: AI_PROVIDERS.OPENAI,
    displayName: 'GPT-3.5 Turbo',
    description: 'Fast and cost-effective',
    contextWindow: '16K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.50,
    costPer1kOutput: 1.50
  },

  // Direct Anthropic models
  'anthropic/claude-3-opus': {
    id: 'anthropic_opus',
    modelId: 'claude-3-opus-20240229',
    provider: AI_PROVIDERS.ANTHROPIC,
    displayName: 'Claude 3 Opus',
    description: 'Most powerful Claude model',
    contextWindow: '200K',
    maxOutputTokens: '4096',
    costPer1kInput: 15.00,
    costPer1kOutput: 75.00
  },
  'anthropic/claude-3-sonnet': {
    id: 'anthropic_sonnet',
    modelId: 'claude-3-sonnet-20240229',
    provider: AI_PROVIDERS.ANTHROPIC,
    displayName: 'Claude 3 Sonnet',
    description: 'Balanced Claude model',
    contextWindow: '200K',
    maxOutputTokens: '4096',
    costPer1kInput: 3.00,
    costPer1kOutput: 15.00
  },

  // DeepSeek models
  'deepseek/deepseek-chat': {
    id: 'deepseek_chat',
    modelId: 'deepseek-chat',
    provider: AI_PROVIDERS.DEEPSEEK,
    displayName: 'DeepSeek Chat',
    description: 'Cost-effective AI model',
    contextWindow: '128K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.14,
    costPer1kOutput: 0.28
  },
  'deepseek/deepseek-coder': {
    id: 'deepseek_coder',
    modelId: 'deepseek-coder',
    provider: AI_PROVIDERS.DEEPSEEK,
    displayName: 'DeepSeek Coder',
    description: 'Specialized for code generation',
    contextWindow: '128K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.14,
    costPer1kOutput: 0.28
  },

  // Kodacode models (via external API)
  'kodacode/minimax-m2': {
    id: 'kodacode_minimax_m2',
    modelId: 'minimax-m2',
    provider: AI_PROVIDERS.KODACODE,
    displayName: 'MiniMax M2',
    description: 'MiniMax M2 with large context window',
    contextWindow: '180K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.00,
    costPer1kOutput: 0.00
  },
  'kodacode/gemini-2.5-flash': {
    id: 'kodacode_gemini_2_5_flash',
    modelId: 'gemini-2.5-flash',
    provider: AI_PROVIDERS.KODACODE,
    displayName: 'Gemini 2.5 Flash',
    description: 'Google Gemini with massive 986K context window',
    contextWindow: '986K',
    maxOutputTokens: '8192',
    costPer1kInput: 0.00,
    costPer1kOutput: 0.00,
    recommended: true
  },
  'kodacode/deepseek-v3.1-terminus': {
    id: 'kodacode_deepseek_v3_1_terminus',
    modelId: 'deepseek-v3.1-terminus',
    provider: AI_PROVIDERS.KODACODE,
    displayName: 'DeepSeek V3.1 Terminus',
    description: 'DeepSeek V3.1 Terminus with 114K context',
    contextWindow: '114K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.00,
    costPer1kOutput: 0.00
  },
  'kodacode/glm-4.6': {
    id: 'kodacode_glm_4_6',
    modelId: 'glm-4.6',
    provider: AI_PROVIDERS.KODACODE,
    displayName: 'GLM-4.6',
    description: 'GLM-4.6 with 186K context window',
    contextWindow: '186K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.00,
    costPer1kOutput: 0.00
  },
  'kodacode/qwen3-235b-a22b': {
    id: 'kodacode_qwen3_235b_a22b',
    modelId: 'qwen3-235b-a22b',
    provider: AI_PROVIDERS.KODACODE,
    displayName: 'Qwen3 235B A22B',
    description: 'Qwen3 235B A22B with 116K context',
    contextWindow: '116K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.00,
    costPer1kOutput: 0.00
  },
  'kodacode/qwen3-coder': {
    id: 'kodacode_qwen3_coder',
    modelId: 'qwen3-coder',
    provider: AI_PROVIDERS.KODACODE,
    displayName: 'Qwen3 Coder',
    description: 'Qwen3 Coder specialized for code generation',
    contextWindow: '116K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.00,
    costPer1kOutput: 0.00
  },
  'kodacode/kimi-k2-thinking': {
    id: 'kodacode_kimi_k2_thinking',
    modelId: 'kimi-k2-thinking',
    provider: AI_PROVIDERS.KODACODE,
    displayName: 'Kimi K2 Thinking',
    description: 'Kimi K2 Thinking with 244K context',
    contextWindow: '244K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.00,
    costPer1kOutput: 0.00
  },
  'kodacode/deepseek-v3.2': {
    id: 'kodacode_deepseek_v3_2',
    modelId: 'deepseek-v3.2',
    provider: AI_PROVIDERS.KODACODE,
    displayName: 'DeepSeek V3.2',
    description: 'DeepSeek V3.2 with 147K context',
    contextWindow: '147K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.00,
    costPer1kOutput: 0.00
  },
  'kodacode/KodaChat': {
    id: 'kodacode_koda_chat',
    modelId: 'KodaChat',
    provider: AI_PROVIDERS.KODACODE,
    displayName: 'KodaChat',
    description: 'Koda Chat model with 176K context',
    contextWindow: '176K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.00,
    costPer1kOutput: 0.00
  },
  'kodacode/KodaAgent': {
    id: 'kodacode_koda_agent',
    modelId: 'KodaAgent',
    provider: AI_PROVIDERS.KODACODE,
    displayName: 'KodaAgent',
    description: 'Koda Agent model with 176K context',
    contextWindow: '176K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.00,
    costPer1kOutput: 0.00
  },
  'kodacode/KodaReason': {
    id: 'kodacode_koda_reason',
    modelId: 'KodaReason',
    provider: AI_PROVIDERS.KODACODE,
    displayName: 'KodaReason',
    description: 'Koda Reasoning model with 41K context',
    contextWindow: '41K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.00,
    costPer1kOutput: 0.00
  },
  'kodacode/KodaEdit': {
    id: 'kodacode_koda_edit',
    modelId: 'KodaEdit',
    provider: AI_PROVIDERS.KODACODE,
    displayName: 'KodaEdit',
    description: 'Koda Edit model for code editing with 128K context',
    contextWindow: '128K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.00,
    costPer1kOutput: 0.00
  },
  'kodacode/KodaApply': {
    id: 'kodacode_koda_apply',
    modelId: 'KodaApply',
    provider: AI_PROVIDERS.KODACODE,
    displayName: 'KodaApply',
    description: 'Koda Apply model for applying changes',
    contextWindow: '4K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.00,
    costPer1kOutput: 0.00
  },
  'kodacode/KodaApply2': {
    id: 'kodacode_koda_apply2',
    modelId: 'KodaApply2',
    provider: AI_PROVIDERS.KODACODE,
    displayName: 'KodaApply2',
    description: 'Koda Apply 2 model with 16K context',
    contextWindow: '16K',
    maxOutputTokens: '4096',
    costPer1kInput: 0.00,
    costPer1kOutput: 0.00
  }
}

/**
 * Get default model
 * @returns {Object} Default model configuration
 */
export function getDefaultModel() {
  return AI_MODELS['polza/deepseek-r1-0528'] || AI_MODELS['polza/deepseek-chat'] || AI_MODELS['kodacode/KodaAgent'] || Object.values(AI_MODELS)[0]
}

/**
 * Get models for a specific provider
 * @param {string} providerId - Provider identifier
 * @returns {Array} Array of model configurations
 */
export function getModelsByProvider(providerId) {
  return Object.values(AI_MODELS).filter(m => m.provider.id === providerId)
}

/**
 * Get model by ID
 * @param {string} modelId - Model identifier
 * @returns {Object|null} Model configuration or null
 */
export function getModelById(modelId) {
  return Object.values(AI_MODELS).find(m => m.id === modelId) || null
}

/**
 * Get recommended models
 * @returns {Array} Array of recommended model configurations
 */
export function getRecommendedModels() {
  return Object.values(AI_MODELS).filter(m => m.recommended)
}

/**
 * Format cost for display
 * @param {number} cost - Cost value
 * @returns {string} Formatted cost string
 */
export function formatCost(cost) {
  if (cost < 0.01) {
    return `$${(cost * 1000).toFixed(3)}/M`
  }
  return `$${cost.toFixed(2)}/1K`
}

export default {
  AI_PROVIDERS,
  AI_MODELS,
  getDefaultModel,
  getModelsByProvider,
  getModelById,
  getRecommendedModels,
  formatCost
}
