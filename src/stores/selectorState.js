/**
 * Shared selector state singleton (module-level)
 *
 * This module-level reactive object is shared across ALL Vue app instances,
 * including sub-apps (embedded DataTables, Charts, etc.) that don't have
 * access to the main app's Pinia instance.
 *
 * The Pinia-based selectorStore reads/writes through this same object,
 * so all consumers stay in sync without needing Pinia.
 *
 * Issue #6769: Selector filtering integration
 */

import { reactive } from 'vue'

export const selectorState = reactive({
  // { [selectorName]: value | null }
  selectors: {}
})

export function setGlobalSelector(name, value) {
  if (value === null || value === '' || value === undefined) {
    delete selectorState.selectors[name]
  } else {
    selectorState.selectors[name] = value
  }
  // Trigger reactivity for watchers on the full object
  selectorState.selectors = { ...selectorState.selectors }
}

export function getGlobalSelector(name) {
  return selectorState.selectors[name] || null
}
