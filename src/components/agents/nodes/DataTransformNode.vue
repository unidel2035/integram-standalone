<template>
  <BaseAgentNode
    :data="data"
    label="Data Transform"
    icon="pi pi-refresh"
    :description="description"
    :status="data.status"
    color="#3b82f6"
  >
    <template #config>
      <div class="config-summary" v-if="data.config">
        <div class="config-item" v-if="data.config.transformationType">
          <i class="pi pi-cog"></i>
          <span>Type: {{ data.config.transformationType }}</span>
        </div>
        <div class="config-item" v-if="data.config.rules && data.config.rules.length">
          <i class="pi pi-list"></i>
          <span>{{ data.config.rules.length }} rules</span>
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
  props.data.description || 'Transform and manipulate data'
)
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
</style>
