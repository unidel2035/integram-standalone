/**
 * MINIMAL Vue DevTools Stub (Issue #5216 Fix)
 *
 * This file MUST be imported FIRST, before any Vue or Vue Router imports.
 *
 * ISSUE: Patching global Object/Reflect methods caused Vue Router's
 * component instances to be null during setup, leading to:
 * "can't access property __vrv_devtools, instance is null"
 *
 * SOLUTION: Provide a minimal devtools stub WITHOUT patching globals.
 * This prevents conflicts with browser extensions while not interfering
 * with Vue Router's instance creation.
 */

if (typeof window !== 'undefined') {
  // Don't install stub if devtools hook already exists from browser extension
  if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
    console.info('ℹ️ Vue DevTools hook exists (browser extension), skipping stub')
    // Use existing hook - no need for our stub
  } else {
    // Create minimal devtools stub (no global patches)
    const minimalStub = {
      enabled: false,
      emit: () => {},
      on: () => {},
      once: () => {},
      off: () => {},
      apps: []
    }

    // Install stub (configurable = true to allow Vue DevTools to override)
    try {
      Object.defineProperty(window, '__VUE_DEVTOOLS_GLOBAL_HOOK__', {
        value: minimalStub,
        writable: true,
        configurable: true,
        enumerable: true
      })
      console.info('🛡️ Minimal Vue DevTools stub installed (no global patches)')
    } catch (e) {
      console.warn('⚠️ Failed to install devtools stub:', e.message)
    }
  }
}

export default {}
