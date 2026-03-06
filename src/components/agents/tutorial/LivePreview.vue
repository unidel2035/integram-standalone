<template>
  <div class="live-preview" :class="{ updating: isUpdating }">
    <div class="preview-header">
      <div class="header-left">
        <h3>Live-результат</h3>
        <div v-if="executionTime" class="execution-time">
          ⚡ {{ executionTime }}мс
        </div>
      </div>
      <div class="header-right">
        <span v-if="isUpdating" class="status updating">
          <span class="spinner"></span>
          Обновление...
        </span>
        <span v-else class="status ready">✓ Готово</span>
      </div>
    </div>

    <div class="preview-body">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  isUpdating: {
    type: Boolean,
    default: false
  },
  executionTime: {
    type: Number,
    default: null
  }
})
</script>

<style scoped>
.live-preview {
  background: white;
  border: 2px solid #10b981;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.live-preview.updating {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.2);
  }
}

.preview-header {
  background-color: #f0fdf4;
  padding: 12px 16px;
  border-bottom: 1px solid #10b981;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.live-preview.updating .preview-header {
  background-color: #eff6ff;
  border-bottom-color: #3b82f6;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.preview-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #065f46;
}

.live-preview.updating .preview-header h3 {
  color: #1e40af;
}

.execution-time {
  font-size: 12px;
  color: #059669;
  font-weight: 500;
  background-color: #d1fae5;
  padding: 4px 8px;
  border-radius: 4px;
}

.status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 12px;
}

.status.ready {
  background-color: #d1fae5;
  color: #065f46;
}

.status.updating {
  background-color: #dbeafe;
  color: #1e40af;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #3b82f6;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.preview-body {
  padding: 16px;
  max-height: 500px;
  overflow: auto;
}
</style>
