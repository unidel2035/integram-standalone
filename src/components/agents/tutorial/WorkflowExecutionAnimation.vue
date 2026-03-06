<template>
  <Dialog
    :visible="visible"
    header="Выполнение Workflow"
    :modal="true"
    :closable="!isExecuting"
    :style="{ width: '600px' }"
    @hide="handleClose"
  >
    <div class="execution-animation">
      <!-- Progress visualization -->
      <div class="execution-progress">
        <div
          v-for="(step, index) in executionSteps"
          :key="step.nodeId"
          class="execution-step"
          :class="{
            'completed': index < currentStepIndex,
            'active': index === currentStepIndex,
            'pending': index > currentStepIndex
          }"
        >
          <div class="step-icon">
            <i v-if="index < currentStepIndex" class="pi pi-check"></i>
            <i v-else-if="index === currentStepIndex" class="pi pi-spin pi-spinner"></i>
            <i v-else class="pi pi-circle"></i>
          </div>
          <div class="step-content">
            <div class="step-name">{{ getNodeName(step.nodeId) }}</div>
            <div class="step-status">{{ getStepStatus(step, index) }}</div>
          </div>
        </div>

        <!-- Connections between steps -->
        <div
          v-for="(step, index) in executionSteps.slice(0, -1)"
          :key="`conn-${index}`"
          class="step-connection"
          :class="{
            'completed': index < currentStepIndex,
            'active': index === currentStepIndex
          }"
        ></div>
      </div>

      <!-- Current step details -->
      <div v-if="currentStep" class="current-step-details">
        <div class="detail-header">
          <i class="pi pi-cog pi-spin"></i>
          <span>{{ currentStep.status }}</span>
        </div>
        <ProgressBar
          :value="stepProgress"
          :showValue="false"
          class="step-progress-bar"
        />
      </div>

      <!-- Results display -->
      <div v-if="executionComplete && results" class="execution-results">
        <div class="results-header">
          <i class="pi pi-check-circle"></i>
          <h3>Workflow выполнен успешно!</h3>
        </div>

        <div class="results-stats">
          <div class="stat-item">
            <i class="pi pi-file"></i>
            <div class="stat-content">
              <div class="stat-label">Обработано строк</div>
              <div class="stat-value">{{ results.rowsProcessed }}</div>
            </div>
          </div>
          <div class="stat-item">
            <i class="pi pi-clock"></i>
            <div class="stat-content">
              <div class="stat-label">Время выполнения</div>
              <div class="stat-value">{{ results.duration }} сек</div>
            </div>
          </div>
          <div class="stat-item">
            <i class="pi pi-file-pdf"></i>
            <div class="stat-content">
              <div class="stat-label">Выходной файл</div>
              <div class="stat-value">{{ results.outputFile }}</div>
            </div>
          </div>
        </div>

        <div class="result-preview">
          <div class="preview-header">
            <i class="pi pi-eye"></i>
            <span>Превью отчёта</span>
          </div>
          <div class="preview-content">
            <div class="mock-report">
              <div class="report-title">Отчёт по продажам 2024</div>
              <div class="report-section">
                <div class="report-item">Всего продаж: 100</div>
                <div class="report-item">Средний чек: $450</div>
                <div class="report-item">Рост: +15%</div>
              </div>
              <div class="report-chart">
                <div class="chart-bar" style="height: 60%"></div>
                <div class="chart-bar" style="height: 75%"></div>
                <div class="chart-bar" style="height: 90%"></div>
                <div class="chart-bar" style="height: 100%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <Button
        v-if="executionComplete"
        label="Отлично!"
        icon="pi pi-check"
        @click="handleComplete"
        severity="success"
      />
      <Button
        v-else
        label="Отменить"
        icon="pi pi-times"
        outlined
        @click="handleCancel"
        :disabled="isExecuting"
      />
    </template>
  </Dialog>

  <!-- Confetti canvas -->
  <canvas ref="confettiCanvas" class="confetti-canvas"></canvas>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  executionSteps: {
    type: Array,
    required: true
  },
  nodes: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['complete', 'cancel', 'update:show'])

const visible = ref(false)
const currentStepIndex = ref(-1)
const stepProgress = ref(0)
const executionComplete = ref(false)
const isExecuting = ref(false)
const results = ref(null)
const confettiCanvas = ref(null)

watch(() => props.show, (newVal) => {
  visible.value = newVal
  if (newVal) {
    startExecution()
  }
})

watch(visible, (newVal) => {
  emit('update:show', newVal)
})

const currentStep = computed(() => {
  if (currentStepIndex.value >= 0 && currentStepIndex.value < props.executionSteps.length) {
    return props.executionSteps[currentStepIndex.value]
  }
  return null
})

const getNodeName = (nodeId) => {
  const node = props.nodes.find(n => n.id === nodeId)
  return node ? node.label : nodeId
}

const getStepStatus = (step, index) => {
  if (index < currentStepIndex.value) {
    return 'Выполнено ✓'
  } else if (index === currentStepIndex.value) {
    return step.status
  } else {
    return 'Ожидание'
  }
}

const startExecution = async () => {
  currentStepIndex.value = -1
  stepProgress.value = 0
  executionComplete.value = false
  isExecuting.value = true
  results.value = null

  for (let i = 0; i < props.executionSteps.length; i++) {
    currentStepIndex.value = i
    const step = props.executionSteps[i]

    // Animate progress for this step
    await animateProgress(step.duration)

    // Store result from this step
    if (step.result) {
      // Accumulate results
    }
  }

  // Execution complete
  isExecuting.value = false
  executionComplete.value = true
  results.value = {
    rowsProcessed: 100,
    duration: 2.3,
    outputFile: 'sales_report_2024.pdf'
  }

  // Trigger confetti
  await new Promise(resolve => setTimeout(resolve, 300))
  triggerConfetti()
}

const animateProgress = (duration) => {
  return new Promise((resolve) => {
    stepProgress.value = 0
    const interval = 50 // ms
    const steps = duration / interval
    const increment = 100 / steps
    let current = 0

    const timer = setInterval(() => {
      current += increment
      stepProgress.value = Math.min(current, 100)

      if (current >= 100) {
        clearInterval(timer)
        resolve()
      }
    }, interval)
  })
}

const triggerConfetti = () => {
  const canvas = confettiCanvas.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  canvas.style.display = 'block'

  const confetti = []
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6']
  const confettiCount = 150

  // Create confetti particles
  for (let i = 0; i < confettiCount; i++) {
    confetti.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 6 + 4,
      d: Math.random() * confettiCount,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.floor(Math.random() * 10) - 10,
      tiltAngleIncremental: Math.random() * 0.07 + 0.05,
      tiltAngle: 0
    })
  }

  let animationFrame

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    confetti.forEach((c, index) => {
      ctx.beginPath()
      ctx.lineWidth = c.r / 2
      ctx.strokeStyle = c.color
      ctx.moveTo(c.x + c.tilt + c.r / 3, c.y)
      ctx.lineTo(c.x + c.tilt, c.y + c.tilt + c.r / 5)
      ctx.stroke()

      // Update position
      c.tiltAngle += c.tiltAngleIncremental
      c.y += (Math.cos(c.d) + 3 + c.r / 2) / 2
      c.x += Math.sin(c.d)
      c.tilt = Math.sin(c.tiltAngle - index / 3) * 15

      // Remove confetti that's off screen
      if (c.y > canvas.height) {
        confetti.splice(index, 1)
      }
    })

    if (confetti.length > 0) {
      animationFrame = requestAnimationFrame(draw)
    } else {
      canvas.style.display = 'none'
    }
  }

  animationFrame = requestAnimationFrame(draw)

  // Auto hide confetti after 5 seconds
  setTimeout(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
    }
    canvas.style.display = 'none'
  }, 5000)
}

const handleComplete = () => {
  visible.value = false
  emit('complete')
}

const handleCancel = () => {
  visible.value = false
  emit('cancel')
}

const handleClose = () => {
  if (executionComplete.value) {
    emit('complete')
  }
}

onUnmounted(() => {
  // Clean up any animations
})
</script>

<style scoped lang="scss">
.execution-animation {
  padding: 1rem 0;
}

.execution-progress {
  position: relative;
  padding: 1rem 0;

  .execution-step {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    margin-bottom: 1rem;
    background: var(--surface-50);
    border-radius: var(--content-border-radius);
    border-left: 4px solid var(--surface-border);
    transition: all 0.3s ease;

    &.pending {
      opacity: 0.5;
    }

    &.active {
      background: var(--primary-50);
      border-left-color: var(--primary-color);
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
    }

    &.completed {
      border-left-color: #10B981;

      .step-icon {
        background: #10B981;
        color: white;
      }
    }

    .step-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface-hover);
      color: var(--text-color-secondary);
      border-radius: 50%;
      font-size: 1.25rem;
      flex-shrink: 0;
      transition: all 0.3s ease;
    }

    &.active .step-icon {
      background: var(--primary-color);
      color: white;
    }

    .step-content {
      flex: 1;

      .step-name {
        font-weight: 600;
        font-size: 1rem;
        color: var(--text-color);
        margin-bottom: 0.25rem;
      }

      .step-status {
        font-size: 0.875rem;
        color: var(--text-color-secondary);
      }
    }
  }

  .step-connection {
    height: 20px;
    width: 4px;
    background: var(--surface-border);
    margin-left: calc(1rem + 18px);
    margin-top: -1rem;
    margin-bottom: -1rem;
    transition: background 0.3s ease;

    &.completed,
    &.active {
      background: #10B981;
    }
  }
}

.current-step-details {
  padding: 1.5rem;
  background: linear-gradient(135deg, var(--primary-50), var(--primary-100));
  border-radius: var(--content-border-radius);
  margin: 1rem 0;

  .detail-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 1rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary-color);

    i {
      font-size: 1.5rem;
    }
  }

  .step-progress-bar {
    height: 8px;
  }
}

.execution-results {
  margin-top: 1.5rem;

  .results-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 1.5rem;
    background: linear-gradient(135deg, #D1FAE5, #A7F3D0);
    border-radius: var(--content-border-radius);
    margin-bottom: 1rem;

    i {
      font-size: 2rem;
      color: #10B981;
    }

    h3 {
      margin: 0;
      color: #065F46;
      font-size: 1.25rem;
    }
  }

  .results-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;

    .stat-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 1rem;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: var(--content-border-radius);

      i {
        font-size: 1.5rem;
        color: var(--primary-color);
      }

      .stat-content {
        flex: 1;

        .stat-label {
          font-size: 0.75rem;
          color: var(--text-color-secondary);
          margin-bottom: 0.25rem;
          text-transform: uppercase;
          font-weight: 600;
        }

        .stat-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-color);
        }
      }
    }
  }

  .result-preview {
    border: 2px solid var(--surface-border);
    border-radius: var(--content-border-radius);
    overflow: hidden;

    .preview-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0.75rem 1rem;
      background: var(--surface-100);
      font-weight: 600;
      font-size: 0.875rem;
      color: var(--text-color);

      i {
        color: var(--primary-color);
      }
    }

    .preview-content {
      padding: 1rem;
      background: white;

      .mock-report {
        .report-title {
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 1rem;
          color: #1F2937;
          text-align: center;
        }

        .report-section {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;

          .report-item {
            padding: 0.75rem;
            background: #F3F4F6;
            border-radius: 6px;
            text-align: center;
            font-weight: 600;
            font-size: 0.875rem;
            color: #374151;
          }
        }

        .report-chart {
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          height: 100px;
          padding: 0 1rem;
          border-top: 2px solid #E5E7EB;

          .chart-bar {
            width: 40px;
            background: linear-gradient(to top, #3B82F6, #60A5FA);
            border-radius: 4px 4px 0 0;
          }
        }
      }
    }
  }
}

.confetti-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
  display: none;
}

@media (max-width: 768px) {
  .results-stats {
    grid-template-columns: 1fr;
  }

  .report-section {
    grid-template-columns: 1fr !important;
  }
}
</style>
