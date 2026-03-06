<template>
  <div class="settings-panel">
    <div class="panel-header">
      <h3>{{ title }}</h3>
      <p v-if="description" class="description">{{ description }}</p>
    </div>

    <div class="panel-body">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.settings-panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  height: fit-content;
}

.panel-header {
  background-color: #f9fafb;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.panel-header h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.description {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
  line-height: 1.5;
}

.panel-body {
  padding: 16px;
}
</style>
