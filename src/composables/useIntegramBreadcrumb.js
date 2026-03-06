import { ref } from 'vue'

// Module-level reactive state — shared across all component instances
const extraItems = ref([])

export function useIntegramBreadcrumb() {
  function setExtra(items) {
    extraItems.value = items
  }

  function clearExtra() {
    extraItems.value = []
  }

  return { extraItems, setExtra, clearExtra }
}
