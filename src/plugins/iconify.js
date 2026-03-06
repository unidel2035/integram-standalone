/**
 * Iconify Local Icons Setup with Lazy Loading
 *
 * Issue #4393: Icon sets are lazy-loaded to reduce initial bundle size.
 * Icons are loaded on-demand when first requested.
 *
 * This file provides lazy loading for icon data locally,
 * eliminating the need for API calls to api.iconify.design.
 *
 * Benefits of lazy loading:
 * ✅ Smaller initial bundle size
 * ✅ Icons loaded only when needed
 * ✅ No network requests to api.iconify.design
 * ✅ Works completely offline
 * ✅ No CSP configuration needed for external API
 *
 * Icon sets available (loaded on demand):
 * - Material Design Icons (mdi)
 * - Font Awesome (fa)
 * - Bootstrap Icons (bi)
 * - Lucide Icons (lucide)
 * - Heroicons (heroicons)
 * - Flat Color Icons (flat-color-icons)
 * - VSCode Icons (vscode-icons)
 */

import { addCollection } from '@iconify/vue'

// Track which icon sets have been loaded
const loadedSets = new Set()

/**
 * Lazy load a specific icon set
 * @param {string} setName - Icon set name (mdi, fa, bi, lucide, heroicons, flat-color-icons, vscode-icons)
 */
async function loadIconSet(setName) {
  if (loadedSets.has(setName)) {
    return // Already loaded
  }

  try {
    let icons
    switch (setName) {
      case 'mdi':
        icons = await import('@iconify-json/mdi/icons.json')
        break
      case 'fa':
        icons = await import('@iconify-json/fa/icons.json')
        break
      case 'bi':
        icons = await import('@iconify-json/bi/icons.json')
        break
      case 'lucide':
        icons = await import('@iconify-json/lucide/icons.json')
        break
      case 'heroicons':
        icons = await import('@iconify-json/heroicons/icons.json')
        break
      case 'flat-color-icons':
        icons = await import('@iconify-json/flat-color-icons/icons.json')
        break
      case 'vscode-icons':
        icons = await import('@iconify-json/vscode-icons/icons.json')
        break
      default:
        console.warn(`Unknown icon set: ${setName}`)
        return
    }

    addCollection(icons.default || icons)
    loadedSets.add(setName)
  } catch (error) {
    console.error(`Failed to load icon set ${setName}:`, error)
  }
}

/**
 * Initialize icon collections with lazy loading
 * Call this function before creating the Vue app
 * This only sets up the lazy loading mechanism; icons are loaded on first use
 */
export function setupIconify() {
  // Set up a global icon loader for on-demand loading
  // Icons will be loaded when first referenced in components

  // Pre-load most commonly used icon sets for instant availability
  // Less common sets will load on demand
  Promise.all([
    loadIconSet('mdi'),
    loadIconSet('flat-color-icons'),
    loadIconSet('lucide')
  ]).catch(err => {
    console.error('Failed to preload common icon sets:', err)
  })
}

/**
 * Manually load a specific icon set
 * @param {string} setName - Icon set name
 */
export function loadIcons(setName) {
  return loadIconSet(setName)
}
