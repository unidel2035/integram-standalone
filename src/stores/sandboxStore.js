import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSandboxStore = defineStore('sandbox', () => {
  // Sandbox mode state
  const isSandboxMode = ref(false)
  const showResetConfirmation = ref(false)

  // Current scenario being practiced
  const activeScenario = ref(null)
  const scenarioProgress = ref({})

  // Toggle sandbox mode
  function toggleSandbox() {
    isSandboxMode.value = !isSandboxMode.value

    // Reset scenario when exiting sandbox
    if (!isSandboxMode.value) {
      activeScenario.value = null
      scenarioProgress.value = {}
    }
  }

  // Enable sandbox mode
  function enableSandbox() {
    isSandboxMode.value = true
  }

  // Disable sandbox mode
  function disableSandbox() {
    isSandboxMode.value = false
    activeScenario.value = null
    scenarioProgress.value = {}
  }

  // Reset demo data to initial state
  function resetDemoData() {
    scenarioProgress.value = {}
    activeScenario.value = null
    showResetConfirmation.value = false

    // Emit event for components to reset their demo state
    window.dispatchEvent(new CustomEvent('sandbox-reset'))
  }

  // Start a practice scenario
  function startScenario(scenarioId) {
    activeScenario.value = scenarioId
    scenarioProgress.value = {
      [scenarioId]: {
        started: Date.now(),
        completed: [],
        currentStep: 0
      }
    }
  }

  // Update scenario progress
  function updateScenarioProgress(scenarioId, stepIndex) {
    if (!scenarioProgress.value[scenarioId]) {
      scenarioProgress.value[scenarioId] = {
        started: Date.now(),
        completed: [],
        currentStep: 0
      }
    }

    scenarioProgress.value[scenarioId].currentStep = stepIndex
    if (!scenarioProgress.value[scenarioId].completed.includes(stepIndex)) {
      scenarioProgress.value[scenarioId].completed.push(stepIndex)
    }
  }

  // Complete a scenario
  function completeScenario(scenarioId) {
    if (scenarioProgress.value[scenarioId]) {
      scenarioProgress.value[scenarioId].completedAt = Date.now()
    }
  }

  // Computed
  const modeName = computed(() => isSandboxMode.value ? '🎓 Режим обучения' : '🏦 Боевой режим')

  const isProductionMode = computed(() => !isSandboxMode.value)

  return {
    // State
    isSandboxMode,
    showResetConfirmation,
    activeScenario,
    scenarioProgress,

    // Computed
    modeName,
    isProductionMode,

    // Actions
    toggleSandbox,
    enableSandbox,
    disableSandbox,
    resetDemoData,
    startScenario,
    updateScenarioProgress,
    completeScenario
  }
})
