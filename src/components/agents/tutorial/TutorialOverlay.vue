<template>
  <div v-if="isActive" class="tutorial-overlay">
    <!-- Dark backdrop -->
    <div class="backdrop" @click="handleBackdropClick"></div>

    <!-- Highlight area -->
    <div
      v-if="highlightedElement"
      class="highlight-area"
      :style="highlightStyle"
    >
      <div class="highlight-border"></div>
    </div>

    <!-- Pointer arrow -->
    <div
      v-if="showArrow && highlightedElement"
      class="pointer-arrow"
      :style="arrowStyle"
    >
      <svg width="60" height="60" viewBox="0 0 60 60">
        <path
          d="M 10 30 Q 20 10, 40 20 L 50 10"
          stroke="#FCD34D"
          stroke-width="3"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="50" cy="10" r="4" fill="#FCD34D" />
      </svg>
    </div>

    <!-- Tooltip/hint -->
    <div
      v-if="tooltip"
      class="tutorial-tooltip"
      :style="tooltipStyle"
    >
      <div class="tooltip-header">
        <i :class="tooltip.icon || 'pi pi-info-circle'"></i>
        <span class="tooltip-label">{{ tooltip.label }}</span>
      </div>
      <p class="tooltip-description">{{ tooltip.description }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  isActive: {
    type: Boolean,
    default: false
  },
  highlightSelector: {
    type: String,
    default: null
  },
  tooltip: {
    type: Object,
    default: null
    // { label: 'Label', description: 'Description', icon: 'pi-icon' }
  },
  showArrow: {
    type: Boolean,
    default: true
  },
  allowBackdropClick: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['backdrop-click'])

const highlightedElement = ref(null)
const highlightRect = ref(null)

const highlightStyle = computed(() => {
  if (!highlightRect.value) return {}

  return {
    top: `${highlightRect.value.top - 8}px`,
    left: `${highlightRect.value.left - 8}px`,
    width: `${highlightRect.value.width + 16}px`,
    height: `${highlightRect.value.height + 16}px`
  }
})

const arrowStyle = computed(() => {
  if (!highlightRect.value) return {}

  // Position arrow to point at the highlighted element
  return {
    top: `${highlightRect.value.top - 70}px`,
    left: `${highlightRect.value.left + highlightRect.value.width / 2 - 30}px`
  }
})

const tooltipStyle = computed(() => {
  if (!highlightRect.value) return {}

  const tooltipWidth = 300
  const tooltipHeight = 120 // approximate

  // Try to position tooltip to the right of the element
  let top = highlightRect.value.top
  let left = highlightRect.value.right + 20

  // If tooltip would overflow right side, position it to the left
  if (left + tooltipWidth > window.innerWidth - 20) {
    left = highlightRect.value.left - tooltipWidth - 20
  }

  // If tooltip would overflow left side, position it below
  if (left < 20) {
    left = highlightRect.value.left
    top = highlightRect.value.bottom + 20
  }

  // If tooltip would overflow bottom, position it above
  if (top + tooltipHeight > window.innerHeight - 20) {
    top = highlightRect.value.top - tooltipHeight - 20
  }

  // Ensure tooltip doesn't go above screen
  if (top < 20) {
    top = 20
  }

  return {
    top: `${top}px`,
    left: `${left}px`
  }
})

const updateHighlight = () => {
  if (!props.highlightSelector) {
    highlightedElement.value = null
    highlightRect.value = null
    return
  }

  const element = document.querySelector(props.highlightSelector)
  if (element) {
    highlightedElement.value = element
    highlightRect.value = element.getBoundingClientRect()

    // Scroll element into view if needed
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

const handleBackdropClick = () => {
  if (props.allowBackdropClick) {
    emit('backdrop-click')
  }
}

// Watch for changes in highlight selector
watch(() => props.highlightSelector, () => {
  if (props.isActive) {
    setTimeout(updateHighlight, 100)
  }
})

watch(() => props.isActive, (isActive) => {
  if (isActive) {
    setTimeout(updateHighlight, 100)
  }
})

// Update highlight on window resize
let resizeObserver = null

onMounted(() => {
  window.addEventListener('resize', updateHighlight)
  window.addEventListener('scroll', updateHighlight, true)

  // Use ResizeObserver to track element size changes
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateHighlight)
    if (highlightedElement.value) {
      resizeObserver.observe(highlightedElement.value)
    }
  }

  if (props.isActive) {
    updateHighlight()
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateHighlight)
  window.removeEventListener('scroll', updateHighlight, true)
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

// Expose updateHighlight for parent components
defineExpose({
  updateHighlight
})
</script>

<style scoped lang="scss">
.tutorial-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 999;
  pointer-events: none;
}

.backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  pointer-events: none;
  animation: fadeIn 0.3s ease;
}

.highlight-area {
  position: absolute;
  pointer-events: none;
  z-index: 1000;
  transition: all 0.3s ease;

  .highlight-border {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: 3px solid #FCD34D;
    border-radius: 8px;
    box-shadow: 0 0 0 4px rgba(252, 211, 77, 0.3),
                0 0 20px rgba(252, 211, 77, 0.5),
                inset 0 0 20px rgba(252, 211, 77, 0.1);
    animation: pulse-border 2s infinite;
  }
}

.pointer-arrow {
  position: absolute;
  pointer-events: none;
  z-index: 1001;
  animation: bounce 2s infinite;

  svg {
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
  }
}

.tutorial-tooltip {
  position: absolute;
  width: 300px;
  background: var(--surface-card);
  border: 2px solid var(--primary-color);
  border-radius: var(--content-border-radius);
  padding: 1rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
  z-index: 1002;
  animation: slideIn 0.3s ease;

  .tooltip-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--surface-border);

    i {
      font-size: 1.5rem;
      color: var(--primary-color);
    }

    .tooltip-label {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-color);
    }
  }

  .tooltip-description {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--text-color-secondary);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes pulse-border {
  0%, 100% {
    box-shadow: 0 0 0 4px rgba(252, 211, 77, 0.3),
                0 0 20px rgba(252, 211, 77, 0.5),
                inset 0 0 20px rgba(252, 211, 77, 0.1);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(252, 211, 77, 0.5),
                0 0 30px rgba(252, 211, 77, 0.7),
                inset 0 0 30px rgba(252, 211, 77, 0.2);
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .tutorial-tooltip {
    width: calc(100vw - 40px);
    left: 20px !important;
    right: 20px;
  }
}
</style>
