<template>
  <div class="graduation-project">
    <Card class="project-header-card">
      <template #title>
        <div class="project-title">
          <span class="project-icon">{{ project.icon }}</span>
          <h2>{{ project.title }}</h2>
        </div>
      </template>
      <template #content>
        <div class="project-description">
          <p>{{ project.description }}</p>
        </div>
      </template>
    </Card>

    <!-- Requirements -->
    <Card class="requirements-card">
      <template #title>
        <h3>Требования к проекту</h3>
      </template>
      <template #content>
        <div class="requirements-list">
          <div
            v-for="req in project.requirements"
            :key="req.id"
            class="requirement-item"
            :class="{ 'bonus': req.bonus, 'completed': isRequirementCompleted(req.id) }"
          >
            <div class="req-checkbox">
              <i :class="isRequirementCompleted(req.id) ? 'pi pi-check-circle' : 'pi pi-circle'"></i>
            </div>
            <div class="req-content">
              <span class="req-title">{{ req.title }}</span>
              <Tag
                v-if="req.bonus"
                value="Бонус"
                severity="warning"
                class="ml-2"
              />
              <span class="req-points">+{{ req.points }} баллов</span>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <!-- Workflow Builder Area -->
    <Card class="builder-card">
      <template #title>
        <div class="builder-header">
          <h3>Конструктор Workflow</h3>
          <div class="builder-actions">
            <Button
              label="Подсказка"
              icon="pi pi-lightbulb"
              outlined
              @click="showHint"
              :badge="availableHints.toString()"
              badge-class="p-badge-warning"
            />
            <Button
              label="Проверить решение"
              icon="pi pi-check-square"
              @click="validateSolution"
              :disabled="!canValidate"
            />
            <Button
              label="Запустить"
              icon="pi pi-play"
              severity="success"
              @click="executionWorkflow"
              :disabled="!isValid || isExecuting"
            />
          </div>
        </div>
      </template>
      <template #content>
        <div class="builder-content">
          <!-- Simplified workflow builder -->
          <div class="workflow-canvas">
            <div class="canvas-info">
              <Message severity="info" :closable="false">
                <p>
                  <strong>Как использовать конструктор:</strong><br>
                  1. Выберите агента из палитры слева<br>
                  2. Соедините агенты в нужном порядке<br>
                  3. Проверьте решение и запустите workflow
                </p>
              </Message>
            </div>

            <!-- Node Palette -->
            <div class="node-palette">
              <h4>Доступные агенты:</h4>
              <div class="palette-items">
                <div
                  v-for="nodeType in availableNodeTypes"
                  :key="nodeType.type"
                  class="palette-item"
                  @click="addNode(nodeType)"
                >
                  <i :class="nodeType.icon"></i>
                  <span>{{ nodeType.label }}</span>
                </div>
              </div>
            </div>

            <!-- Simple canvas representation -->
            <div class="simple-canvas">
              <div v-if="workflowNodes.length === 0" class="canvas-placeholder">
                <i class="pi pi-plus-circle"></i>
                <p>Добавьте первый агент из палитры</p>
              </div>
              <div v-else class="nodes-list">
                <div
                  v-for="(node, index) in workflowNodes"
                  :key="node.id"
                  class="canvas-node"
                >
                  <div class="node-card">
                    <div class="node-header">
                      <i :class="getNodeIcon(node.type)"></i>
                      <span>{{ getNodeLabel(node.type) }}</span>
                      <Button
                        icon="pi pi-times"
                        text
                        rounded
                        size="small"
                        severity="danger"
                        @click="removeNode(node.id)"
                      />
                    </div>
                  </div>
                  <div v-if="index < workflowNodes.length - 1" class="node-connector">
                    <i class="pi pi-arrow-down"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <!-- Validation Results -->
    <Card v-if="validationResult" class="validation-card">
      <template #title>
        <div class="validation-header">
          <h3>Результаты проверки</h3>
          <Tag
            :value="`${validationResult.score} / ${validationResult.maxScore} баллов`"
            :severity="getScoreSeverity(validationResult.score)"
            class="score-tag"
          />
        </div>
      </template>
      <template #content>
        <div class="validation-content">
          <div class="grade-banner" :class="`grade-${getGradeClass(validationResult.grade)}`">
            <h2>{{ validationResult.grade }}</h2>
          </div>

          <div class="feedback-list">
            <div
              v-for="(feedback, index) in validationResult.feedback"
              :key="index"
              class="feedback-item"
              :class="`feedback-${feedback.type}`"
            >
              <div class="feedback-message">{{ feedback.message }}</div>
              <div class="feedback-requirement">{{ feedback.requirement }}</div>
            </div>
          </div>

          <div v-if="validationResult.score >= 60" class="success-actions">
            <Button
              label="Завершить проект и получить сертификат"
              icon="pi pi-trophy"
              size="large"
              @click="completeProject"
            />
          </div>
        </div>
      </template>
    </Card>

    <!-- Hints Dialog -->
    <Dialog
      v-model:visible="showHintsDialog"
      header="Подсказки"
      :modal="true"
      :style="{ width: '500px' }"
    >
      <div class="hints-content">
        <div v-if="availableHints === 0" class="no-hints">
          <p>Все подсказки уже доступны! Прокрутите вниз, чтобы увидеть их.</p>
        </div>
        <div v-for="hint in visibleHints" :key="hint.id" class="hint-item">
          <div class="hint-header">
            <i class="pi pi-lightbulb"></i>
            <strong>Подсказка {{ hint.id }}</strong>
          </div>
          <div class="hint-title">{{ hint.title }}</div>
          <div class="hint-description">{{ hint.description }}</div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

import { getValidationSummary } from '@/utils/tutorial/projectValidator'

const props = defineProps({
  project: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['complete', 'workflow-change'])

const workflowNodes = ref([])
const validationResult = ref(null)
const showHintsDialog = ref(false)
const isExecuting = ref(false)
const startTime = ref(null)
const elapsedTime = ref(0)
let timerInterval = null

const availableNodeTypes = [
  { type: 'ValidatorAgent', label: 'Валидатор', icon: 'pi pi-check-circle' },
  { type: 'TableAnalyzerAgent', label: 'Анализатор', icon: 'pi pi-chart-bar' },
  { type: 'DataTransformAgent', label: 'Трансформация', icon: 'pi pi-arrow-right-arrow-left' },
  { type: 'ReportGeneratorAgent', label: 'Генератор отчётов', icon: 'pi pi-file-pdf' },
  { type: 'IntegrationAgent', label: 'Интеграция', icon: 'pi pi-link' }
]

const canValidate = computed(() => workflowNodes.value.length >= 4)
const isValid = computed(() => validationResult.value && validationResult.value.score >= 60)

const availableHints = computed(() => {
  if (!startTime.value) return props.project.hints.length
  const elapsed = elapsedTime.value
  return props.project.hints.filter(h => elapsed >= h.unlockAfter).length
})

const visibleHints = computed(() => {
  if (!startTime.value) return []
  const elapsed = elapsedTime.value
  return props.project.hints.filter(h => elapsed >= h.unlockAfter)
})

const completedRequirements = ref(new Set())

onMounted(() => {
  startTime.value = Date.now()
  // Update elapsed time every second
  timerInterval = setInterval(() => {
    if (startTime.value) {
      elapsedTime.value = Math.floor((Date.now() - startTime.value) / 1000)
    }
  }, 1000)
})

onBeforeUnmount(() => {
  // Clean up interval to prevent memory leak
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
})

const addNode = (nodeType) => {
  const newNode = {
    id: `node-${Date.now()}`,
    type: nodeType.type,
    label: nodeType.label,
    position: { x: 100, y: workflowNodes.value.length * 100 + 100 }
  }
  workflowNodes.value.push(newNode)
  emit('workflow-change', getWorkflowConfig())
}

const removeNode = (nodeId) => {
  workflowNodes.value = workflowNodes.value.filter(n => n.id !== nodeId)
  emit('workflow-change', getWorkflowConfig())
}

const getWorkflowConfig = () => {
  const edges = []
  for (let i = 0; i < workflowNodes.value.length - 1; i++) {
    edges.push({
      id: `edge-${i}`,
      source: workflowNodes.value[i].id,
      target: workflowNodes.value[i + 1].id
    })
  }

  return {
    nodes: workflowNodes.value,
    edges
  }
}

const validateSolution = () => {
  const workflow = getWorkflowConfig()
  const result = getValidationSummary(workflow)
  validationResult.value = result

  // Update completed requirements
  result.feedback.forEach(f => {
    if (f.type === 'success' || f.type === 'bonus') {
      const req = props.project.requirements.find(r => r.title === f.requirement)
      if (req) {
        completedRequirements.value.add(req.id)
      }
    }
  })
}

const executionWorkflow = async () => {
  isExecuting.value = true
  // Simulate workflow execution
  await new Promise(resolve => setTimeout(resolve, 2000))
  isExecuting.value = false

  // Auto-validate after execution
  validateSolution()
}

const showHint = () => {
  showHintsDialog.value = true
}

const completeProject = () => {
  emit('complete', {
    score: validationResult.value.score,
    grade: validationResult.value.grade,
    workflow: getWorkflowConfig()
  })
}

const isRequirementCompleted = (reqId) => {
  return completedRequirements.value.has(reqId)
}

const getNodeIcon = (type) => {
  const nodeType = availableNodeTypes.find(n => n.type === type)
  return nodeType ? nodeType.icon : 'pi pi-circle'
}

const getNodeLabel = (type) => {
  const nodeType = availableNodeTypes.find(n => n.type === type)
  return nodeType ? nodeType.label : type
}

const getScoreSeverity = (score) => {
  if (score >= 90) return 'success'
  if (score >= 70) return 'info'
  if (score >= 60) return 'warning'
  return 'danger'
}

const getGradeClass = (grade) => {
  if (grade.includes('Отлично')) return 'excellent'
  if (grade.includes('Хорошо')) return 'good'
  if (grade.includes('Удовлетворительно')) return 'satisfactory'
  return 'needs-work'
}
</script>

<style scoped lang="scss">
.graduation-project {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  .project-header-card {
    .project-title {
      display: flex;
      align-items: center;
      gap: 1rem;

      .project-icon {
        font-size: 2.5rem;
      }

      h2 {
        margin: 0;
        font-size: 1.75rem;
      }
    }

    .project-description {
      p {
        margin: 0;
        line-height: 1.6;
        font-size: 1.1rem;
      }
    }
  }

  .requirements-card {
    .requirements-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .requirement-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem;
      background: var(--surface-ground);
      border-radius: 6px;
      border-left: 3px solid var(--surface-border);
      transition: all 0.2s;

      &.completed {
        border-left-color: var(--green-500);
        background: rgba(34, 197, 94, 0.05);

        .req-checkbox i {
          color: var(--green-500);
        }
      }

      &.bonus {
        border-left-color: var(--orange-500);
      }

      .req-checkbox i {
        font-size: 1.25rem;
        color: var(--text-color-secondary);
      }

      .req-content {
        flex: 1;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;

        .req-title {
          flex: 1;
          min-width: 200px;
        }

        .req-points {
          color: var(--primary-color);
          font-weight: 600;
          font-size: 0.875rem;
        }
      }
    }
  }

  .builder-card {
    .builder-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;

      h3 {
        margin: 0;
      }

      .builder-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
    }

    .workflow-canvas {
      display: grid;
      grid-template-columns: 250px 1fr;
      gap: 1.5rem;
      min-height: 500px;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }

      .canvas-info {
        grid-column: 1 / -1;
      }

      .node-palette {
        h4 {
          margin: 0 0 1rem 0;
        }

        .palette-items {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .palette-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: var(--surface-card);
          border: 2px solid var(--surface-border);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;

          &:hover {
            border-color: var(--primary-color);
            transform: translateX(4px);
          }

          i {
            font-size: 1.25rem;
            color: var(--primary-color);
          }

          span {
            font-weight: 500;
          }
        }
      }

      .simple-canvas {
        padding: 1rem;
        background: var(--surface-ground);
        border-radius: 8px;
        border: 2px dashed var(--surface-border);
        min-height: 400px;

        .canvas-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-color-secondary);

          i {
            font-size: 3rem;
            margin-bottom: 1rem;
          }

          p {
            margin: 0;
            font-size: 1.1rem;
          }
        }

        .nodes-list {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .canvas-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          max-width: 400px;

          .node-card {
            width: 100%;
            background: white;
            border: 2px solid var(--primary-color);
            border-radius: 8px;
            padding: 1rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

            .node-header {
              display: flex;
              align-items: center;
              gap: 0.75rem;

              i {
                font-size: 1.5rem;
                color: var(--primary-color);
              }

              span {
                flex: 1;
                font-weight: 600;
                font-size: 1.1rem;
              }
            }
          }

          .node-connector {
            color: var(--primary-color);
            font-size: 1.5rem;
            margin: 0.25rem 0;
          }
        }
      }
    }
  }

  .validation-card {
    .validation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;

      h3 {
        margin: 0;
      }

      .score-tag {
        font-size: 1.1rem;
        font-weight: 600;
      }
    }

    .validation-content {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .grade-banner {
      padding: 2rem;
      border-radius: 8px;
      text-align: center;

      h2 {
        margin: 0;
        font-size: 2rem;
        font-weight: 700;
      }

      &.grade-excellent {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
      }

      &.grade-good {
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        color: white;
      }

      &.grade-satisfactory {
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: white;
      }

      &.grade-needs-work {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: white;
      }
    }

    .feedback-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .feedback-item {
      padding: 1rem;
      border-radius: 6px;
      border-left: 4px solid;

      &.feedback-success {
        background: rgba(34, 197, 94, 0.1);
        border-left-color: var(--green-500);
      }

      &.feedback-error {
        background: rgba(239, 68, 68, 0.1);
        border-left-color: var(--red-500);
      }

      &.feedback-warning {
        background: rgba(245, 158, 11, 0.1);
        border-left-color: var(--orange-500);
      }

      &.feedback-bonus {
        background: rgba(168, 85, 247, 0.1);
        border-left-color: var(--purple-500);
      }

      .feedback-message {
        font-weight: 500;
        margin-bottom: 0.25rem;
      }

      .feedback-requirement {
        font-size: 0.875rem;
        color: var(--text-color-secondary);
      }
    }

    .success-actions {
      padding-top: 1rem;
      border-top: 1px solid var(--surface-border);
      text-align: center;

      button {
        font-size: 1.1rem;
        padding: 1rem 2rem;
      }
    }
  }

  .hints-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;

    .no-hints {
      text-align: center;
      padding: 2rem;
      color: var(--text-color-secondary);
    }

    .hint-item {
      padding: 1rem;
      background: var(--surface-ground);
      border-radius: 6px;
      border-left: 3px solid var(--orange-500);

      .hint-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
        color: var(--orange-500);

        i {
          font-size: 1.25rem;
        }
      }

      .hint-title {
        font-weight: 600;
        margin-bottom: 0.5rem;
      }

      .hint-description {
        color: var(--text-color-secondary);
        line-height: 1.6;
      }
    }
  }
}
</style>
