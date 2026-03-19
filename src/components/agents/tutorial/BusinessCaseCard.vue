<template>
  <Card class="business-case-card" @click="toggleExpanded">
    <template #header>
      <div class="case-header">
        <div class="case-icon">{{ businessCase.icon }}</div>
        <div class="case-title-section">
          <h3>{{ businessCase.title }}</h3>
          <p class="case-description">{{ businessCase.description }}</p>
        </div>
        <Button
          :icon="expanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
          text
          rounded
          class="expand-btn"
        />
      </div>
    </template>

    <template #content>
      <div v-if="expanded" class="case-content">
        <!-- Workflow Details -->
        <div class="workflow-section">
          <h4>Workflow:</h4>
          <div class="workflow-steps">
            <div
              v-for="(detail, index) in businessCase.details"
              :key="index"
              class="workflow-step"
            >
              <div class="step-number">{{ index + 1 }}</div>
              <div class="step-content">{{ detail }}</div>
            </div>
          </div>
        </div>

        <!-- Metrics -->
        <div class="metrics-section">
          <h4>Результат:</h4>
          <div class="metrics-grid">
            <div
              v-for="(value, key) in businessCase.metrics"
              :key="key"
              class="metric-item"
            >
              <i class="pi pi-check-circle metric-icon"></i>
              <span>{{ value }}</span>
            </div>
          </div>
        </div>

        <!-- Workflow Preview -->
        <div class="workflow-preview">
          <h4>Схема workflow:</h4>
          <div class="preview-container">
            <div
              v-for="(node, index) in businessCase.workflow.nodes"
              :key="node.id"
              class="preview-node"
            >
              <div class="node-box" :style="getNodeStyle(node.type)">
                <div class="node-type">{{ getNodeTypeLabel(node.type) }}</div>
                <div class="node-label">{{ node.label }}</div>
              </div>
              <div v-if="index < businessCase.workflow.nodes.length - 1" class="node-arrow">
                <i class="pi pi-arrow-down"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="case-actions">
          <Button
            label="Попробовать"
            icon="pi pi-play"
            @click.stop="tryWorkflow"
            class="try-btn"
          />
          <Button
            label="Изучить настройки"
            icon="pi pi-cog"
            outlined
            @click.stop="studySettings"
          />
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  businessCase: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['try-workflow', 'study-settings'])

const expanded = ref(false)

const toggleExpanded = () => {
  expanded.value = !expanded.value
}

const tryWorkflow = () => {
  emit('try-workflow', props.businessCase)
}

const studySettings = () => {
  emit('study-settings', props.businessCase)
}

const getNodeTypeLabel = (type) => {
  const labels = {
    IntegrationAgent: 'Интеграция',
    ValidatorAgent: 'Валидация',
    TableAnalyzerAgent: 'Анализ',
    DataTransformAgent: 'Трансформация',
    ReportGeneratorAgent: 'Отчёт'
  }
  return labels[type] || type
}

const getNodeStyle = (type) => {
  const colors = {
    IntegrationAgent: '#3b82f6',
    ValidatorAgent: '#10b981',
    TableAnalyzerAgent: '#f59e0b',
    DataTransformAgent: '#8b5cf6',
    ReportGeneratorAgent: '#ef4444'
  }
  return {
    backgroundColor: colors[type] || '#6366f1',
    borderColor: colors[type] || '#6366f1'
  }
}
</script>

<style scoped lang="scss">
.business-case-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;

  &:hover {
    border-color: var(--primary-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .case-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;

    .case-icon {
      font-size: 3rem;
      flex-shrink: 0;
    }

    .case-title-section {
      flex: 1;

      h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-color);
      }

      .case-description {
        margin: 0;
        color: var(--text-color-secondary);
        font-size: 0.95rem;
      }
    }

    .expand-btn {
      flex-shrink: 0;
    }
  }

  .case-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding-top: 1rem;
  }

  .workflow-section,
  .metrics-section,
  .workflow-preview {
    h4 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--primary-color);
    }
  }

  .workflow-steps {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .workflow-step {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--p-surface-card);
    border-radius: 6px;
    border-left: 3px solid var(--primary-color);

    .step-number {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: var(--primary-color);
      color: white;
      border-radius: 50%;
      font-weight: 600;
      font-size: 0.875rem;
      flex-shrink: 0;
    }

    .step-content {
      flex: 1;
      line-height: 1.6;
    }
  }

  .metrics-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .metric-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--p-surface-card);
    border-radius: 6px;

    .metric-icon {
      color: var(--green-500);
      font-size: 1.1rem;
    }

    span {
      font-size: 0.95rem;
    }
  }

  .preview-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: var(--p-surface-card);
    border-radius: 8px;
    overflow-x: auto;
  }

  .preview-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .node-box {
    padding: 0.75rem 1rem;
    border-radius: 6px;
    color: white;
    text-align: center;
    min-width: 180px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: all 0.2s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .node-type {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      opacity: 0.9;
      margin-bottom: 0.25rem;
    }

    .node-label {
      font-size: 0.95rem;
      font-weight: 500;
    }
  }

  .node-arrow {
    color: var(--text-color-secondary);
    font-size: 1.5rem;
  }

  .case-actions {
    display: flex;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--surface-border);

    .try-btn {
      flex: 1;
    }
  }
}

@media (max-width: 768px) {
  .case-header {
    flex-wrap: wrap;

    .case-icon {
      font-size: 2rem;
    }
  }

  .case-actions {
    flex-direction: column;

    button {
      width: 100%;
    }
  }
}
</style>
