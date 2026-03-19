<template>
  <div class="advanced-techniques-demo">
    <h2 class="section-title">Продвинутые техники</h2>

    <div class="techniques-grid">
      <Card
        v-for="technique in techniques"
        :key="technique.id"
        class="technique-card"
      >
        <template #header>
          <div class="technique-header">
            <div class="technique-icon">{{ technique.icon }}</div>
            <h3>{{ technique.title }}</h3>
          </div>
        </template>

        <template #content>
          <div class="technique-content">
            <!-- Description -->
            <div class="technique-description">
              <p>{{ technique.description }}</p>
              <Message severity="info" :closable="false" class="explanation-box">
                {{ technique.explanation }}
              </Message>
            </div>

            <!-- Diagram -->
            <div class="technique-diagram">
              <h4>Пример:</h4>
              <pre class="diagram-text">{{ technique.example.diagram }}</pre>
            </div>

            <!-- Metrics (if available) -->
            <div v-if="technique.example.metrics" class="technique-metrics">
              <h4>Сравнение производительности:</h4>
              <div class="metrics-comparison">
                <div class="metric-item">
                  <span class="metric-label">Последовательно:</span>
                  <Tag :value="technique.example.metrics.sequential" severity="warning" />
                </div>
                <div class="metric-item">
                  <span class="metric-label">Параллельно:</span>
                  <Tag :value="technique.example.metrics.parallel" severity="success" />
                </div>
              </div>
            </div>

            <!-- Interactive Demo Button -->
            <div class="demo-actions">
              <Button
                :label="`Попробовать ${technique.title}`"
                icon="pi pi-play-circle"
                @click="startDemo(technique)"
                class="demo-btn"
              />
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Demo Dialog -->
    <Dialog
      v-model:visible="showDemo"
      :header="currentTechnique?.title"
      :modal="true"
      :style="{ width: '80vw', maxWidth: '1200px' }"
      class="demo-dialog"
    >
      <div v-if="currentTechnique" class="demo-container">
        <div class="demo-workflow-preview">
          <h4>Интерактивная демонстрация:</h4>
          <div class="workflow-visualization">
            <!-- Simplified workflow visualization -->
            <div
              v-for="node in currentTechnique.example.workflow.nodes"
              :key="node.id"
              class="demo-node"
              :style="{
                left: `${node.position.x}px`,
                top: `${node.position.y}px`,
                backgroundColor: getDemoNodeColor(node.type)
              }"
            >
              <div class="demo-node-label">{{ node.label }}</div>
              <div v-if="node.data?.cache" class="cache-badge">💾</div>
              <div v-if="node.data?.useCache" class="cache-use-badge">📥</div>
            </div>

            <!-- Edges -->
            <svg class="demo-edges">
              <g v-for="edge in currentTechnique.example.workflow.edges" :key="edge.id">
                <line
                  :x1="getNodeCenter(edge.source).x"
                  :y1="getNodeCenter(edge.source).y"
                  :x2="getNodeCenter(edge.target).x"
                  :y2="getNodeCenter(edge.target).y"
                  stroke="var(--primary-color)"
                  stroke-width="2"
                  :stroke-dasharray="edge.condition ? '5,5' : '0'"
                />
                <text
                  v-if="edge.label"
                  :x="(getNodeCenter(edge.source).x + getNodeCenter(edge.target).x) / 2"
                  :y="(getNodeCenter(edge.source).y + getNodeCenter(edge.target).y) / 2"
                  fill="var(--text-color-secondary)"
                  font-size="12"
                  text-anchor="middle"
                >
                  {{ edge.label }}
                </text>
              </g>
            </svg>
          </div>
        </div>

        <div class="demo-controls">
          <h4>Управление демонстрацией:</h4>
          <div class="control-buttons">
            <Button
              label="Запустить"
              icon="pi pi-play"
              @click="runDemo"
              :disabled="demoRunning"
            />
            <Button
              label="Сбросить"
              icon="pi pi-refresh"
              outlined
              @click="resetDemo"
            />
          </div>

          <div v-if="demoLogs.length" class="demo-logs">
            <h5>Логи выполнения:</h5>
            <div class="logs-container">
              <div
                v-for="(log, index) in demoLogs"
                :key="index"
                class="log-entry"
                :class="`log-${log.level}`"
              >
                <span class="log-time">{{ log.time }}</span>
                <span class="log-message">{{ log.message }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Закрыть" icon="pi pi-times" @click="showDemo = false" text />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  techniques: {
    type: Array,
    required: true
  }
})

const showDemo = ref(false)
const currentTechnique = ref(null)
const demoRunning = ref(false)
const demoLogs = ref([])

const startDemo = (technique) => {
  currentTechnique.value = technique
  showDemo.value = true
  resetDemo()
}

const runDemo = async () => {
  demoRunning.value = true
  demoLogs.value = []

  // Simulate workflow execution
  for (const node of currentTechnique.value.example.workflow.nodes) {
    await new Promise(resolve => setTimeout(resolve, 800))
    demoLogs.value.push({
      time: new Date().toLocaleTimeString(),
      level: 'info',
      message: `Выполняется: ${node.label}`
    })
  }

  demoLogs.value.push({
    time: new Date().toLocaleTimeString(),
    level: 'success',
    message: '✅ Workflow выполнен успешно!'
  })

  demoRunning.value = false
}

const resetDemo = () => {
  demoLogs.value = []
  demoRunning.value = false
}

const getDemoNodeColor = (type) => {
  const colors = {
    IntegrationAgent: '#3b82f6',
    ValidatorAgent: '#10b981',
    TableAnalyzerAgent: '#f59e0b',
    DataTransformAgent: '#8b5cf6',
    ReportGeneratorAgent: '#ef4444'
  }
  return colors[type] || '#6366f1'
}

const getNodeCenter = (nodeId) => {
  const node = currentTechnique.value.example.workflow.nodes.find(n => n.id === nodeId)
  if (!node) return { x: 0, y: 0 }
  return {
    x: node.position.x + 90, // half of node width
    y: node.position.y + 40  // half of node height
  }
}
</script>

<style scoped lang="scss">
.advanced-techniques-demo {
  .section-title {
    font-size: 1.75rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
    color: var(--primary-color);
  }

  .techniques-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .technique-card {
    height: 100%;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
    }

    .technique-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;

      .technique-icon {
        font-size: 2.5rem;
      }

      h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }
    }

    .technique-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .technique-description {
      p {
        margin: 0 0 1rem 0;
        line-height: 1.6;
      }

      .explanation-box {
        font-size: 0.95rem;
      }
    }

    .technique-diagram {
      h4 {
        margin: 0 0 0.75rem 0;
        font-size: 1rem;
        font-weight: 600;
      }

      .diagram-text {
        padding: 1rem;
        background: var(--p-surface-card);
        border-radius: 6px;
        border: 1px solid var(--surface-border);
        font-family: 'Courier New', monospace;
        font-size: 0.85rem;
        line-height: 1.6;
        overflow-x: auto;
        white-space: pre;
      }
    }

    .technique-metrics {
      h4 {
        margin: 0 0 0.75rem 0;
        font-size: 1rem;
        font-weight: 600;
      }

      .metrics-comparison {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem;
        background: var(--p-surface-card);
        border-radius: 6px;

        .metric-item {
          display: flex;
          align-items: center;
          justify-content: space-between;

          .metric-label {
            font-weight: 500;
          }
        }
      }
    }

    .demo-actions {
      padding-top: 0.5rem;

      .demo-btn {
        width: 100%;
      }
    }
  }
}

.demo-dialog {
  .demo-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    min-height: 500px;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }

  .demo-workflow-preview {
    h4 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .workflow-visualization {
      position: relative;
      width: 100%;
      height: 600px;
      background: var(--p-surface-card);
      border-radius: 8px;
      border: 2px solid var(--surface-border);

      .demo-node {
        position: absolute;
        padding: 0.75rem 1rem;
        border-radius: 6px;
        color: white;
        min-width: 180px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        transition: all 0.3s;

        &:hover {
          transform: scale(1.05);
        }

        .demo-node-label {
          font-weight: 500;
          text-align: center;
        }

        .cache-badge,
        .cache-use-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          background: white;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      }

      .demo-edges {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
    }
  }

  .demo-controls {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;

    h4, h5 {
      margin: 0 0 0.75rem 0;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .control-buttons {
      display: flex;
      gap: 1rem;

      button {
        flex: 1;
      }
    }

    .demo-logs {
      .logs-container {
        max-height: 400px;
        overflow-y: auto;
        background: #1e1e1e;
        border-radius: 6px;
        padding: 1rem;
        font-family: 'Courier New', monospace;
        font-size: 0.875rem;

        .log-entry {
          display: flex;
          gap: 0.75rem;
          padding: 0.25rem 0;
          color: #d4d4d4;

          .log-time {
            color: #808080;
            flex-shrink: 0;
          }

          .log-message {
            flex: 1;
          }

          &.log-success {
            color: #22c55e;
          }

          &.log-error {
            color: #ef4444;
          }

          &.log-warning {
            color: #f59e0b;
          }
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .techniques-grid {
    grid-template-columns: 1fr;
  }
}
</style>
