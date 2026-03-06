/**
 * Customer Journey Store
 *
 * Manages the 6+ step customer onboarding journey from agent request to purchase:
 * 1. Agent function request input
 * 2. Organization creation
 * 3. Agent selection table
 * 4. ROI calculation
 * 5. Commercial proposal generation
 * 6. Registration with token and free trial
 *
 * Issue #4227
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useCustomerJourneyStore = defineStore('customerJourney', () => {
  // Journey state
  const currentStep = ref(0)
  const journeyStarted = ref(false)
  const journeyCompleted = ref(false)

  // Temporary user ID created at journey start
  const tempUserId = ref(null)
  const tempUsername = ref(null)

  // Step 1: Agent function request
  const agentRequest = ref({
    description: '',
    functions: [],
    requirements: '',
    timestamp: null
  })

  // Step 2: Organization data
  const organizationData = ref({
    name: '',
    industry: '',
    employeeCount: 0,
    currentCosts: {
      salaries: 0,
      training: 0,
      turnover: 0
    },
    created: false,
    // HeadHunter.ru integration
    hhru: {
      found: false,
      loading: false,
      employer: null,
      vacancies: [],
      analysisResults: null,
      error: null
    }
  })

  // Step 3: Selected agents
  const selectedAgents = ref([])

  // Step 4: ROI calculation results
  const roiData = ref({
    currentCosts: 0,
    agentCosts: 0,
    savings: 0,
    paybackDays: 0,
    documents: [],
    calculationMethod: 'empirical' // 'empirical' or 'document-based'
  })

  // Step 5: Commercial proposal
  const commercialProposal = ref({
    generated: false,
    content: '',
    pdf: null,
    timestamp: null
  })

  // Step 6: Registration and trial
  const registrationData = ref({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    token: null,
    trialEndDate: null,
    trialAgents: []
  })

  // Computed
  const totalSteps = computed(() => 6)

  const stepProgress = computed(() => {
    return Math.round((currentStep.value / totalSteps.value) * 100)
  })

  const canProceedToNextStep = computed(() => {
    const step = currentStep.value

    switch (step) {
      case 0: // Agent request
        const canProceedStep0 = agentRequest.value.description.trim().length > 10
        console.log('[Store] canProceedToNextStep - Step 0:', canProceedStep0, 'description length:', agentRequest.value.description.length)
        return canProceedStep0

      case 1: // Organization
        // Для шага 2 достаточно наличия названия и ИНН
        const orgName = organizationData.value.name || ''
        const canProceedStep1 = orgName.trim().length > 0

        console.log('[Store] canProceedToNextStep - Step 1:', canProceedStep1)
        console.log('[Store]   - organizationData:', organizationData.value)
        console.log('[Store]   - name:', orgName, 'length:', orgName.length, 'trimmed length:', orgName.trim().length)

        return canProceedStep1

      case 2: // Agent selection
        const canProceedStep2 = selectedAgents.value.length > 0
        console.log('[Store] canProceedToNextStep - Step 2:', canProceedStep2, 'agents count:', selectedAgents.value.length)
        return canProceedStep2

      case 3: // ROI calculation
        const canProceedStep3 = roiData.value.savings > 0
        console.log('[Store] canProceedToNextStep - Step 3:', canProceedStep3, 'savings:', roiData.value.savings)
        return canProceedStep3

      case 4: // Commercial proposal
        const canProceedStep4 = commercialProposal.value.generated && commercialProposal.value.content.length > 0
        console.log('[Store] canProceedToNextStep - Step 4:', canProceedStep4)
        console.log('[Store]   - generated:', commercialProposal.value.generated)
        console.log('[Store]   - content length:', commercialProposal.value.content?.length || 0)
        return canProceedStep4

      case 5: // Registration
        const canProceedStep5 = (
          registrationData.value.username &&
          registrationData.value.username.trim().length > 0 &&
          registrationData.value.email &&
          registrationData.value.email.trim().length > 0 &&
          registrationData.value.email.includes('@') &&
          registrationData.value.password &&
          registrationData.value.password.length >= 6 &&
          registrationData.value.confirmPassword &&
          registrationData.value.password === registrationData.value.confirmPassword &&
          registrationData.value.acceptTerms === true
        )
        console.log('[Store] canProceedToNextStep - Step 5:', canProceedStep5)
        return canProceedStep5

      default:
        console.log('[Store] canProceedToNextStep - Unknown step:', step)
        return false
    }
  })

  // Actions
  function startJourney() {
    journeyStarted.value = true
    currentStep.value = 0
    journeyCompleted.value = false
  }

  function nextStep() {
    if (canProceedToNextStep.value && currentStep.value < totalSteps.value) {
      currentStep.value++
    }
  }

  function previousStep() {
    if (currentStep.value > 0) {
      currentStep.value--
    }
  }

  function goToStep(step) {
    if (step >= 0 && step < totalSteps.value) {
      currentStep.value = step
    }
  }

  function setAgentRequest(data) {
    agentRequest.value = {
      ...agentRequest.value,
      ...data,
      timestamp: new Date().toISOString()
    }
  }

  function setOrganization(data) {
    // Важно: создаем полностью новый объект для триггера реактивности
    const newOrgData = {
      name: data.name || '',
      industry: data.industry || '',
      employeeCount: data.employeeCount || 0,
      inn: data.inn || '',
      region: data.region || '',
      currentCosts: data.currentCosts || {
        salaries: 0,
        training: 0,
        turnover: 0
      },
      created: true,
      hhru: organizationData.value.hhru // Сохраняем HH.ru данные если есть
    }

    // Присваиваем полностью новый объект (гарантия реактивности)
    organizationData.value = newOrgData

    console.log('[Store] setOrganization called with:', data)
    console.log('[Store] organizationData updated to:', organizationData.value)
    console.log('[Store] Organization name:', organizationData.value.name, 'length:', organizationData.value.name?.length)
  }

  function setHHruData(data) {
    organizationData.value.hhru = {
      ...organizationData.value.hhru,
      ...data
    }
  }

  function setHHruLoading(loading) {
    organizationData.value.hhru.loading = loading
  }

  function setHHruError(error) {
    organizationData.value.hhru.error = error
    organizationData.value.hhru.loading = false
  }

  function addAgent(agent) {
    if (!selectedAgents.value.find(a => a.id === agent.id)) {
      selectedAgents.value.push(agent)
    }
  }

  function removeAgent(agentId) {
    selectedAgents.value = selectedAgents.value.filter(a => a.id !== agentId)
  }

  function setROIData(data) {
    roiData.value = {
      ...roiData.value,
      ...data
    }
  }

  function addROIDocument(document) {
    roiData.value.documents.push(document)
  }

  function setCommercialProposal(content, pdf = null) {
    // Создаем полностью новый объект для гарантии реактивности
    const newProposal = {
      generated: true,
      content: content || '',
      pdf: pdf || null,
      timestamp: new Date().toISOString()
    }

    commercialProposal.value = newProposal

    console.log('[Store] setCommercialProposal called')
    console.log('[Store]   - generated:', newProposal.generated)
    console.log('[Store]   - content length:', newProposal.content?.length || 0)
    console.log('[Store]   - commercialProposal updated to:', commercialProposal.value)
  }

  function setRegistrationData(data) {
    registrationData.value = {
      ...registrationData.value,
      ...data
    }
  }

  function setTrialToken(token) {
    registrationData.value.token = token
    // Set trial end date to 2 weeks from now
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)
    registrationData.value.trialEndDate = trialEnd.toISOString()
  }

  function setTempUser(userId, username) {
    tempUserId.value = userId
    tempUsername.value = username
  }

  function completeJourney() {
    journeyCompleted.value = true
    currentStep.value = totalSteps.value
  }

  function resetJourney() {
    currentStep.value = 0
    journeyStarted.value = false
    journeyCompleted.value = false
    tempUserId.value = null
    tempUsername.value = null
    agentRequest.value = {
      description: '',
      functions: [],
      requirements: '',
      timestamp: null
    }
    organizationData.value = {
      name: '',
      industry: '',
      employeeCount: 0,
      currentCosts: {
        salaries: 0,
        training: 0,
        turnover: 0
      },
      created: false,
      hhru: {
        found: false,
        loading: false,
        employer: null,
        vacancies: [],
        analysisResults: null,
        error: null
      }
    }
    selectedAgents.value = []
    roiData.value = {
      currentCosts: 0,
      agentCosts: 0,
      savings: 0,
      paybackDays: 0,
      documents: [],
      calculationMethod: 'empirical'
    }
    commercialProposal.value = {
      generated: false,
      content: '',
      pdf: null,
      timestamp: null
    }
    registrationData.value = {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
      token: null,
      trialEndDate: null,
      trialAgents: []
    }
  }

  // Save journey state to localStorage (for persistence across page reloads)
  function saveJourneyState() {
    const state = {
      currentStep: currentStep.value,
      journeyStarted: journeyStarted.value,
      journeyCompleted: journeyCompleted.value,
      tempUserId: tempUserId.value,
      tempUsername: tempUsername.value,
      agentRequest: agentRequest.value,
      organizationData: organizationData.value,
      selectedAgents: selectedAgents.value,
      roiData: roiData.value,
      commercialProposal: commercialProposal.value,
      registrationData: registrationData.value
    }
    localStorage.setItem('customerJourneyState', JSON.stringify(state))
  }

  // Load journey state from localStorage
  function loadJourneyState() {
    const savedState = localStorage.getItem('customerJourneyState')
    if (savedState) {
      try {
        const state = JSON.parse(savedState)
        currentStep.value = state.currentStep || 0
        journeyStarted.value = state.journeyStarted || false
        journeyCompleted.value = state.journeyCompleted || false
        tempUserId.value = state.tempUserId || null
        tempUsername.value = state.tempUsername || null
        agentRequest.value = state.agentRequest || agentRequest.value
        organizationData.value = state.organizationData || organizationData.value
        selectedAgents.value = state.selectedAgents || []
        roiData.value = state.roiData || roiData.value
        commercialProposal.value = state.commercialProposal || commercialProposal.value
        registrationData.value = state.registrationData || registrationData.value
      } catch (error) {
        console.error('Failed to load journey state:', error)
      }
    }
  }

  return {
    // State
    currentStep,
    journeyStarted,
    journeyCompleted,
    tempUserId,
    tempUsername,
    agentRequest,
    organizationData,
    selectedAgents,
    roiData,
    commercialProposal,
    registrationData,

    // Computed
    totalSteps,
    stepProgress,
    canProceedToNextStep,

    // Actions
    startJourney,
    nextStep,
    previousStep,
    goToStep,
    setAgentRequest,
    setOrganization,
    setHHruData,
    setHHruLoading,
    setHHruError,
    addAgent,
    removeAgent,
    setROIData,
    addROIDocument,
    setCommercialProposal,
    setRegistrationData,
    setTrialToken,
    setTempUser,
    completeJourney,
    resetJourney,
    saveJourneyState,
    loadJourneyState
  }
})
