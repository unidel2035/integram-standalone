<template>
  <div
    class="agent-card"
    :class="{ active: isActive, animated: animated }"
    :style="{
      '--agent-color': agent.color,
      '--agent-bg-color': agent.bgColor
    }"
  >
    <div class="agent-icon-wrapper">
      <div class="agent-icon">
        <span class="emoji" v-if="agent.emoji">{{ agent.emoji }}</span>
        <i :class="agent.icon" v-else></i>
      </div>
    </div>
    <div class="agent-content">
      <h3 class="agent-title">{{ agent.title }}</h3>
      <p class="agent-ability">
        <i class="pi pi-star-fill"></i>
        {{ agent.ability }}
      </p>
      <p class="agent-example">
        <i class="pi pi-lightbulb"></i>
        <strong>Пример:</strong> {{ agent.example }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { defineProps } from 'vue'

defineProps({
  agent: {
    type: Object,
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  },
  animated: {
    type: Boolean,
    default: true
  }
})
</script>

<style scoped>
.agent-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  border: 2px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
}

.agent-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.agent-card.active {
  border-color: var(--agent-color, #3B82F6);
  background: linear-gradient(135deg, white 0%, var(--agent-bg-color, #EFF6FF) 100%);
}

.agent-card.animated {
  animation: slideIn 0.5s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.agent-icon-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.agent-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--agent-bg-color, #EFF6FF);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--agent-color, #3B82F6);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.agent-card:hover .agent-icon {
  transform: scale(1.1) rotate(5deg);
}

.emoji {
  font-size: 2.5rem;
  line-height: 1;
}

.agent-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.agent-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
  text-align: center;
}

.agent-ability {
  color: #4b5563;
  font-size: 1rem;
  line-height: 1.5;
  margin: 0;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.agent-ability i {
  color: #F59E0B;
  margin-top: 0.25rem;
  flex-shrink: 0;
}

.agent-example {
  color: #6b7280;
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  border-left: 3px solid var(--agent-color, #3B82F6);
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.agent-example i {
  color: var(--agent-color, #3B82F6);
  margin-top: 0.25rem;
  flex-shrink: 0;
}

.agent-example strong {
  color: #374151;
}

@media (max-width: 768px) {
  .agent-card {
    padding: 1rem;
  }

  .agent-icon {
    width: 56px;
    height: 56px;
    font-size: 1.75rem;
  }

  .agent-title {
    font-size: 1.1rem;
  }

  .agent-ability {
    font-size: 0.9rem;
  }

  .agent-example {
    font-size: 0.85rem;
  }
}
</style>
