/**
 * Single source of truth for default AI model configuration.
 * Change the default model HERE — all components will pick it up.
 */

// Default: Polza Claude Sonnet 4.6
export const DEFAULT_AI_MODEL = 'polza/anthropic/claude-sonnet-4.6'
export const DEFAULT_AI_PROVIDER = 'polza'

// Reasoning model for complex tasks
export const REASONING_AI_MODEL = 'polza/anthropic/claude-sonnet-4.6'

// Fallback model when primary is unavailable
export const FALLBACK_AI_MODEL = 'polza/deepseek/deepseek-chat-v3-0324'

/**
 * Ordered fallback chain for ModelSelector when the default model
 * is not available in the loaded model list.
 * Tiers: Polza Claude → Polza DeepSeek → DeepSeek direct → Kodacode
 */
export const MODEL_FALLBACK_CHAIN = [
  // 1. Polza Claude Sonnet (default)
  { provider: 'polza', match: id => id.includes('claude-sonnet') },
  // 2. Polza DeepSeek (fallback)
  { provider: 'polza', match: id => id.includes('deepseek') },
  // 3. DeepSeek direct
  { provider: 'deepseek', match: id => id.includes('deepseek-chat') },
  // 4. Kodacode (free via GITHUB_TOKEN)
  { provider: 'kodacode', match: id => id === 'KodaAgent' || id.includes('Koda') },
  { provider: 'kodacode', match: () => true },
  // 5. Any available model
  { provider: null, match: () => true },
]
