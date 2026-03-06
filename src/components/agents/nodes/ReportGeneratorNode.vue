<template>
  <BaseAgentNode
    :data="data"
    label="Report Generator"
    icon="pi pi-file"
    :description="description"
    :status="data.status"
    color="#8b5cf6"
  >
    <template #config>
      <div class="config-summary" v-if="data.config">
        <div class="config-item" v-if="data.config.format">
          <i class="pi pi-file-pdf"></i>
          <span>Format: {{ data.config.format.toUpperCase() }}</span>
        </div>
        <div class="config-item" v-if="data.config.template">
          <i class="pi pi-image"></i>
          <span>Template: {{ data.config.template }}</span>
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
  props.data.description || 'Generate reports from data'
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
