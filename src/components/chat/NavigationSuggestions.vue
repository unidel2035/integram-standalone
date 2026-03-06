<template>
  <div class="navigation-suggestions">
    <div class="suggestions-header">
      <i class="pi pi-compass"></i>
      <span>{{ title }}</span>
    </div>
    <div class="suggestions-grid">
      <Button
        v-for="(suggestion, index) in suggestions"
        :key="index"
        :label="suggestion.label"
        :icon="suggestion.icon"
        :severity="suggestion.severity"
        @click="handleNavigate(suggestion.path)"
        class="suggestion-btn"
        outlined
      >
        <template #default>
          <div class="suggestion-content">
            <div class="suggestion-title">
              <i :class="suggestion.icon"></i>
              <span>{{ suggestion.label }}</span>
            </div>
            <div class="suggestion-description">
              {{ suggestion.description }}
            </div>
          </div>
        </template>
      </Button>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import { navigateTo } from '@/services/navigationAgent'

const props = defineProps({
  suggestions: {
    type: Array,
    required: true
  },
  title: {
    type: String,
    default: '🧭 Куда бы вы хотели перейти?'
  }
})

const emit = defineEmits(['navigate'])

async function handleNavigate(path) {
  try {
    emit('navigate', path)
    await navigateTo(path)
  } catch (error) {
    console.error('Navigation failed:', error)
  }
}
</script>

<style scoped>
.navigation-suggestions {
  background: var(--surface-card);
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1rem 0;
  box-shadow: var(--shadow-2);
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.suggestions-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--text-color);
}

.suggestions-header i {
  color: var(--primary-color);
}

.suggestions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.suggestion-btn {
  height: auto;
  padding: 0;
  text-align: left;
  transition: all 0.2s ease;
}

.suggestion-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-3);
}

.suggestion-content {
  padding: 1rem;
  width: 100%;
}

.suggestion-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.suggestion-description {
  font-size: 0.875rem;
  opacity: 0.8;
  line-height: 1.4;
  white-space: normal;
  word-wrap: break-word;
}

@media (max-width: 768px) {
  .suggestions-grid {
    grid-template-columns: 1fr;
  }
}
</style>
