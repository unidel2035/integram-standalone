import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLearnModeStore = defineStore('learnMode', () => {
  // State: learning mode is off by default
  const isLearningMode = ref(false)

  // Load from localStorage on initialization
  const storedValue = localStorage.getItem('learningMode')
  if (storedValue !== null) {
    isLearningMode.value = storedValue === 'true'
  }

  // Toggle learning mode
  function toggleLearningMode() {
    isLearningMode.value = !isLearningMode.value
    localStorage.setItem('learningMode', isLearningMode.value.toString())
  }

  // Set learning mode explicitly
  function setLearningMode(value) {
    isLearningMode.value = value
    localStorage.setItem('learningMode', value.toString())
  }

  return {
    isLearningMode,
    toggleLearningMode,
    setLearningMode
  }
})
