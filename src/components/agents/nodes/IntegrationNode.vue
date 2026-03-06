<template>
  <BaseAgentNode
    :data="data"
    label="Integration"
    icon="pi pi-link"
    :description="description"
    :status="data.status"
    color="#ec4899"
  >
    <template #config>
      <div class="config-summary" v-if="data.config">
        <div class="config-item" v-if="data.config.method">
          <i class="pi pi-server"></i>
          <span>Method: {{ data.config.method }}</span>
        </div>
        <div class="config-item" v-if="data.config.endpoint">
          <i class="pi pi-globe"></i>
          <span class="endpoint-url">{{ truncateUrl(data.config.endpoint) }}</span>
        </div>
      </div>
    </template>
  </BaseAgentNode>
</template>

<script setup>
import { computed } from 'vue'
import BaseAgentNode from './BaseAgentNode.vue'

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

const description = computed(() =>
  props.data.description || 'Connect with external systems'
)

const truncateUrl = (url) => {
  if (!url) return ''
  if (url.length > 30) {
    return url.substring(0, 27) + '...'
  }
  return url
}
</script>

<style scoped lang="scss">
.config-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--surface-border);
}

.config-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--text-color-secondary);

  i {
    font-size: 0.7rem;
    color: var(--primary-color);
  }
}

.endpoint-url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
