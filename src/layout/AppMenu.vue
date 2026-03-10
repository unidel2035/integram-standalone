<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import AppMenuItem from './AppMenuItem.vue'
import { fstMenuConfig } from '@/config/fstMenuConfig'
import { useRoleStore } from '@/stores/roleStore'

const props = defineProps({
  searchQuery: { type: String, default: '' },
  collapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['menu-loaded'])

const roleStore = useRoleStore()

const debouncedSearchQuery = ref('')
let searchDebounceTimer = null
watch(() => props.searchQuery, (newQuery) => {
  clearTimeout(searchDebounceTimer)
  const delay = (!newQuery || newQuery.trim() === '') ? 50 : 150
  searchDebounceTimer = setTimeout(() => { debouncedSearchQuery.value = newQuery || '' }, delay)
}, { flush: 'post' })

// Также реагируем на смену роли
watch(() => roleStore.activeRole, () => { /* computed пересчитается автоматически */ })
watch(() => roleStore.fullMenuMode, () => { /* computed пересчитается автоматически */ })

const model = computed(() =>
  fstMenuConfig
    .filter(section => roleStore.hasMenuAccess(section.roles))
    .map(section => ({
      ...section,
      items: (section.items || []).filter(item => roleStore.hasMenuAccess(item.roles))
    }))
    .filter(section => section.items && section.items.length > 0)
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
