/**
 * Single source of truth for default AI model configuration.
 * Change the default model HERE — all components will pick it up.
 */

// Default: Claude Opus 4.6 via Max subscription (free, with MCP tools)
export const DEFAULT_AI_MODEL = 'claude-sub/claude-opus-4-6'
export const DEFAULT_AI_PROVIDER = 'claude-sub'

// Reasoning model for complex tasks
export const REASONING_AI_MODEL = 'polza/anthropic/claude-sonnet-4.6'

// Fallback model when primary is unavailable
export const FALLBACK_AI_MODEL = 'google/gemini-2.0-flash-lite-001'

/**
 * Ordered fallback chain for ModelSelector when the default model
 * is not available in the loaded model list.
 * Tiers: Qwen Turbo → Gemini Flash → Polza Claude → DeepSeek → Kodacode
 */
export const MODEL_FALLBACK_CHAIN = [
  // 1. Qwen Turbo (default, fastest)
  { provider: 'polza', match: id => id.includes('qwen-turbo') },
  // 2. Gemini Flash Lite (fast fallback)
  { provider: 'polza', match: id => id.includes('gemini-2') && id.includes('flash') },
  // 3. Polza Claude Sonnet
  { provider: 'polza', match: id => id.includes('claude-sonnet') },
  // 4. Polza DeepSeek (fallback)
  { provider: 'polza', match: id => id.includes('deepseek') },
  // 5. DeepSeek direct
  { provider: 'deepseek', match: id => id.includes('deepseek-chat') },
  // 6. Kodacode (free via GITHUB_TOKEN)
  { provider: 'kodacode', match: id => id === 'KodaAgent' || id.includes('Koda') },
  { provider: 'kodacode', match: () => true },
  // 7. Any available model
  { provider: null, match: () => true },
]
