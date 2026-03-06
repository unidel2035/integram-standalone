<template>
  <BaseAgentNode
    :data="data"
    label="Table Analyzer"
    icon="pi pi-chart-bar"
    :description="description"
    :status="data.status"
    color="#10b981"
  >
    <template #config>
      <div class="config-summary" v-if="data.config">
        <div class="config-item" v-if="data.config.analysisTypes">
          <i class="pi pi-check-square"></i>
          <span>{{ data.config.analysisTypes.length }} analysis types</span>
        </div>
        <div class="config-item" v-if="data.config.depth">
          <i class="pi pi-sitemap"></i>
          <span>Depth: {{ data.config.depth }}</span>
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
  props.data.description || 'Analyze table structure and data patterns'
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
