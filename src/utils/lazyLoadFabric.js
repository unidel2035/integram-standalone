/**
 * Utility for lazy loading Fabric.js library
 *
 * Issue #4393: Fabric.js is a heavy library for canvas manipulation.
 * This utility ensures it's only loaded when actually needed.
 *
 * Usage in components:
 * ```js
 * import { loadFabric } from '@/utils/lazyLoadFabric'
 *
 * async function initCanvas() {
 *   const fabric = await loadFabric()
 *   const canvas = new fabric.Canvas('canvas-id')
 *   // Use fabric here
 * }
 * ```
 */

let fabricModule = null

/**
 * Lazy load Fabric.js library (singleton pattern - loads only once)
 * @returns {Promise<Object>} Fabric.js module
 */
export async function loadFabric() {
  if (!fabricModule) {
    fabricModule = await import('fabric')
  }
  return fabricModule
}
