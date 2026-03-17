/**
 * Simplified modelFallback for fund backend.
 * Original in dronedoc2026 uses AgentChainCoordinator — too many deps.
 */

export function buildFallbackChain(primaryItem, tiers = []) {
  const chain = [primaryItem]
  for (const tier of tiers) {
    if (tier.envKey && !process.env[tier.envKey]) continue
    if (tier.fast && !chain.includes(tier.fast)) chain.push(tier.fast)
  }
  return chain
}

export async function withFallback(chain, executor, options = {}) {
  const { timeout = 90000 } = options
  let lastError
  for (let i = 0; i < chain.length; i++) {
    try {
      return await (timeout
        ? Promise.race([
            executor(chain[i], i),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout ${timeout}ms`)), timeout))
          ])
        : executor(chain[i], i))
    } catch (error) {
      lastError = error
      console.warn(`[Fallback] ${chain[i]} failed (${i + 1}/${chain.length}):`, error.message)
    }
  }
  throw lastError
}
