<template>
  <BaseAgentNode
    :data="data"
    label="Validator"
    icon="pi pi-check-circle"
    :description="description"
    :status="data.status"
    color="#f59e0b"
  >
    <template #config>
      <div class="config-summary" v-if="data.config">
        <div class="config-item" v-if="data.config.rules && data.config.rules.length">
          <i class="pi pi-shield"></i>
          <span>{{ data.config.rules.length }} validation rules</span>
        </div>
        <div class="config-item" v-if="data.config.stopOnError !== undefined">
          <i :class="data.config.stopOnError ? 'pi pi-times-circle' : 'pi pi-forward'"></i>
          <span>{{ data.config.stopOnError ? 'Stop on error' : 'Continue on error' }}</span>
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
  props.data.description || 'Validate data against rules'
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
