<script setup>
import { ref, computed, watch } from 'vue'
import AppMenuItem from './AppMenuItem.vue'
import { fstMenuConfig } from '@/config/fstMenuConfig'

const props = defineProps({
  searchQuery: { type: String, default: '' },
  collapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['menu-loaded'])

const debouncedSearchQuery = ref('')
let searchDebounceTimer = null
watch(() => props.searchQuery, (newQuery) => {
  clearTimeout(searchDebounceTimer)
  const delay = (!newQuery || newQuery.trim() === '') ? 50 : 150
  searchDebounceTimer = setTimeout(() => { debouncedSearchQuery.value = newQuery || '' }, delay)
}, { flush: 'post' })

const isAdmin = ref(localStorage.getItem('is_admin') === 'true')
window.addEventListener('storage', (e) => {
  if (e.key === 'is_admin') isAdmin.value = e.newValue === 'true'
})

const model = computed(() =>
  fstMenuConfig
    .filter(s => !s.adminOnly || isAdmin.value)
    .map(s => ({ ...s, items: (s.items || []).filter(i => !i.adminOnly || isAdmin.value) }))
)

const filteredModel = computed(() => {
  if (!debouncedSearchQuery.value) return model.value
  const q = debouncedSearchQuery.value.toLowerCase()
  return model.value.map(section => ({
    ...section,
    items: (section.items || []).filter(item =>
      (item.label || '').toLowerCase().includes(q)
    )
  })).filter(section => section.items && section.items.length > 0)
})

// Emit menu-loaded for parent sidebar (smart search compatibility)
import { onMounted } from 'vue'
onMounted(() => { emit('menu-loaded', model.value) })
</script>

<template>
  <ul class="layout-menu">
    <template v-for="(item, i) in filteredModel" :key="item.label || i">
      <app-menu-item
        v-if="!item.separator"
        :item="item"
        :index="i"
        :collapsed="collapsed"
      />
      <li v-if="item.separator" class="menu-separator"></li>
    </template>
  </ul>
</template>

<style lang="scss" scoped>
.layout-menu {
  list-style: none;
  padding: 0;
  margin: 0;
}
.menu-separator {
  border-top: 1px solid var(--surface-border);
  margin: 0.5rem 0;
}
</style>
