/**
 * Orbity Store
 *
 * Pinia store for managing Orbity platform state:
 * - Current user profile
 * - User roles and permissions
 * - User skills and levels
 * - Financial data (rate, balance, earnings)
 * - Available and active tasks
 * - Customer projects
 *
 * Uses orbityService.js for all INTEGRA database operations.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import orbityService from '@/services/orbityService'
import { logger } from '@/utils/logger'

export const useOrbityStore = defineStore('orbity', () => {
  // ============================================
  // State
  // ============================================

  // User profile
  const currentUser = ref(null)
  const userRoles = ref([])
  const userSkills = ref([])

  // Financial data
  const userRate = ref(510) // Default base rate
  const userBalance = ref(0)
  const totalEarned = ref(0)

  // Tasks
  const availableTasks = ref([])
  const activeTasks = ref([])

  // Projects (for customers)
  const customerProjects = ref([])

  // Skills catalog
  const allSkills = ref([])

  // Mentorship
  const mentorships = ref([])
  const availableMentors = ref([])

  // Videos
  const videos = ref([])

  // Learning progress
  const learningProgress = ref(null)

  // Financial data (Stage 5)
  const transactions = ref([])
  const improvements = ref([])
  const incomeStats = ref(null)
  const financialRecommendations = ref(null)

  // Session management
  const isAuthenticated = ref(false)
  const authToken = ref(null)
  const xsrfToken = ref(null)
  const userId = ref(null)
  const userName = ref('')
  const userEmail = ref('')

  // Loading states
  const isLoading = ref(false)
  const isLoadingProfile = ref(false)
  const isLoadingRoles = ref(false)
  const isLoadingSkills = ref(false)
  const isLoadingTasks = ref(false)
  const isLoadingProjects = ref(false)
  const isLoadingMentorships = ref(false)
  const isLoadingVideos = ref(false)
  const isLoadingProgress = ref(false)
  const isLoadingTransactions = ref(false)
  const isLoadingImprovements = ref(false)
  const isLoadingFinances = ref(false)

  // Error state
  const error = ref(null)

  // ============================================
  // Getters
  // ============================================

  /**
   * Check if user has Executor role
   */
  const isExecutor = computed(() => {
    return userRoles.value.some(roleBinding => {
      // Check if role name contains "Исполнитель"
      return roleBinding.req_role?.includes('Исполнитель') ||
             roleBinding.role_name?.includes('Исполнитель')
    })
  })

  /**
   * Check if user has Customer role
   */
  const isCustomer = computed(() => {
    return userRoles.value.some(roleBinding => {
      return roleBinding.req_role?.includes('Заказчик') ||
             roleBinding.role_name?.includes('Заказчик')
    })
  })

  /**
   * Check if user has Mentor role
   */
  const isMentor = computed(() => {
    return userRoles.value.some(roleBinding => {
      return roleBinding.req_role?.includes('Наставник') ||
             roleBinding.role_name?.includes('Наставник')
    })
  })

  /**
   * Check if user has Manager role
   */
  const isManager = computed(() => {
    return userRoles.value.some(roleBinding => {
      return roleBinding.req_role?.includes('Руководитель') ||
             roleBinding.role_name?.includes('Руководитель')
    })
  })

  /**
   * Get total earned amount (all income transactions)
   */
  const totalEarnedAmount = computed(() => {
    return totalEarned.value
  })

  /**
   * Check if user profile is loaded
   */
  const isProfileLoaded = computed(() => {
    return currentUser.value !== null
  })

  /**
   * Get user display name
   */
  const displayName = computed(() => {
    if (userName.value) return userName.value
    if (!currentUser.value) return ''
    return currentUser.value.requisites?.fio ||
           currentUser.value.value ||
           'Пользователь'
  })

  /**
   * Get user email
   */
  const email = computed(() => {
    if (userEmail.value) return userEmail.value
    if (!currentUser.value) return ''
    return currentUser.value.requisites?.email || ''
  })

  /**
   * Get user phone
   */
  const userPhone = computed(() => {
    if (!currentUser.value) return ''
    return currentUser.value.requisites?.phone || ''
  })

  /**
   * Get skills that are currently being learned (Trainee level)
   */
  const skillsInLearning = computed(() => {
    return userSkills.value.filter(skill => {
      const levelName = skill.req_level?.val || ''
      return levelName.includes('Стажер')
    })
  })

  /**
   * Get skills available to learn (not yet acquired)
   */
  const availableSkillsToLearn = computed(() => {
    const userSkillIds = userSkills.value.map(s => s.req_skill)
    return allSkills.value.filter(skill => !userSkillIds.includes(skill.id))
  })

  // ============================================
  // Session Management Actions
  // ============================================

  /**
   * Authenticate user with login and password
   * @param {string} username - Username
   * @param {string} password - Password
   * @param {string} serverURL - Server URL (optional)
   * @param {string} database - Database name (optional)
   */
  async function authenticate(username, password, serverURL = 'https://integram.io', database = 'orbits') {
    isLoading.value = true
    error.value = null

    try {
      // Initialize orbityService - используем правильные методы
      await orbityService.initialize(serverURL, database)

      // Authenticate using orbityService
      const result = await orbityService.authenticate(username, password)

      if (result.success) {
        // Store session data in store
        isAuthenticated.value = true
        authToken.value = result.token
        xsrfToken.value = result.xsrf
        userId.value = result.userId
        userName.value = result.userName
        userEmail.value = result.userEmail

        // Save session to localStorage
        saveSession()

        // Load complete user data
        await loadCompleteUserData(userId.value)

        return { success: true, userId: userId.value }
      } else {
        throw new Error(result.error || 'Authentication failed')
      }
    } catch (err) {
      console.error('Authentication failed:', err)
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Save session to localStorage
   */
  function saveSession() {
    if (isAuthenticated.value && authToken.value) {
      const sessionData = {
        isAuthenticated: true,
        authToken: authToken.value,
        xsrfToken: xsrfToken.value,
        userId: userId.value,
        userName: userName.value,
        userEmail: userEmail.value,
        serverURL: orbityService.baseURL,
        database: orbityService.currentDatabase
      }
      localStorage.setItem('orbity_session', JSON.stringify(sessionData))
    }
  }

  /**
   * Load session from localStorage
   */
  function loadSession() {
    try {
      const stored = localStorage.getItem('orbity_session')
      if (stored) {
        const sessionData = JSON.parse(stored)
        
        isAuthenticated.value = sessionData.isAuthenticated
        authToken.value = sessionData.authToken
        xsrfToken.value = sessionData.xsrfToken
        userId.value = sessionData.userId
        userName.value = sessionData.userName
        userEmail.value = sessionData.userEmail

        // Initialize orbityService with stored session
        if (sessionData.serverURL && sessionData.database) {
          orbityService.initialize(sessionData.serverURL, sessionData.database)
          orbityService.setSession({
            token: authToken.value,
            xsrf: xsrfToken.value,
            userId: userId.value,
            userName: userName.value
          })
        }

        return true
      }
    } catch (error) {
      console.error('Failed to load session from localStorage:', error)
      localStorage.removeItem('orbity_session')
    }
    return false
  }

  /**
   * Clear session and logout
   */
  function logout() {
    isAuthenticated.value = false
    authToken.value = null
    xsrfToken.value = null
    userId.value = null
    userName.value = ''
    userEmail.value = ''

    // Clear all user data
    clearUserData()

    // Clear session from localStorage
    localStorage.removeItem('orbity_session')

    // Clear orbityService session
    orbityService.logout()
  }

  /**
   * Check if user is authenticated
   */
  const isUserAuthenticated = computed(() => {
    return isAuthenticated.value && !!authToken.value
  })

  // ============================================
  // User Profile Actions
  // ============================================

  /**
   * Load user profile by user ID
   * @param {string|number} userId - User ID from INTEGRA
   */
  async function loadUserProfile(userId) {
    if (!userId) {
      error.value = 'User ID is required'
      return false
    }

    isLoadingProfile.value = true
    error.value = null

    try {
      await orbityService.initialize()
      currentUser.value = await orbityService.getUserProfile(userId)
      logger.info('Loaded user profile', { user: currentUser.value })
      return true
    } catch (err) {
      logger.error('Failed to load user profile', { error: err.message })
      error.value = err.message
      return false
    } finally {
      isLoadingProfile.value = false
    }
  }

  /**
   * Update user profile
   * @param {Object} updates - Fields to update
   */
// В orbityStore.js, в метод updateProfile добавим:
const userRates = ref([])

async function loadUserRates(userId) {
  if (!userId) return false

  try {
    await orbityService.initialize()
    userRates.value = await orbityService.getUserRates(userId)
    return true
  } catch (err) {
    console.error('Failed to load user rates:', err)
    return false
  }
}

// В loadCompleteUserData добавь вызов loadUserRates
/**
 * Update user profile
 * @param {Object} updates - Fields to update
 */
// В orbityStore.js - метод updateProfile
// В orbityStore.js - метод updateProfile
async function updateProfile(updates) {
  if (!currentUser.value || !currentUser.value.id) {
    error.value = 'No user loaded'
    return false
  }

  isLoadingProfile.value = true
  error.value = null

  try {
    const userId = currentUser.value.id

    const result = await orbityService.updateUserProfile(userId, updates)

    if (result) {
      // Обновляем локальное состояние
      if (updates.fio) {
        userName.value = updates.fio
      }
      if (updates.phone) {
        // phone обновится при следующей загрузке профиля
      }

      return true
    } else {
      throw new Error('No result returned from update')
    }
  } catch (err) {
    console.error('Failed to update profile:', err)
    error.value = err.message
    return false
  } finally {
    isLoadingProfile.value = false
  }
}


  /**
   * Load user roles
   * @param {string|number} userId - User ID
   */
  async function loadUserRoles(userId) {
    if (!userId) {
      error.value = 'User ID is required'
      return false
    }

    isLoadingRoles.value = true
    error.value = null

    try {
      await orbityService.initialize()
      userRoles.value = await orbityService.getUserRoles(userId)
      return true
    } catch (err) {
      console.error('Failed to load user roles:', err)
      error.value = err.message
      return false
    } finally {
      isLoadingRoles.value = false
    }
  }

  /**
   * Load user skills
   * @param {string|number} userId - User ID
   */
  async function loadUserSkills(userId) {
    if (!userId) {
      error.value = 'User ID is required'
      return false
    }

    isLoadingSkills.value = true
    error.value = null

    try {
      await orbityService.initialize()
      userSkills.value = await orbityService.getUserSkills(userId)
      return true
    } catch (err) {
      console.error('Failed to load user skills:', err)
      error.value = err.message
      return false
    } finally {
      isLoadingSkills.value = false
    }
  }

  /**
   * Load available tasks for executor
   * @param {Object} filters - Optional filters
   */
  async function loadAvailableTasks(filters = {}) {
    if (!currentUser.value || !currentUser.value.id) {
      error.value = 'No user loaded'
      return false
    }

    isLoadingTasks.value = true
    error.value = null

    try {
      await orbityService.initialize()
      availableTasks.value = await orbityService.getAvailableTasks(
        currentUser.value.id,
        filters
      )
      return true
    } catch (err) {
      console.error('Failed to load available tasks:', err)
      error.value = err.message
      return false
    } finally {
      isLoadingTasks.value = false
    }
  }

  /**
   * Load user's active tasks
   */
  async function loadActiveTasks() {
    if (!currentUser.value || !currentUser.value.id) {
      error.value = 'No user loaded'
      return false
    }

    isLoadingTasks.value = true
    error.value = null

    try {
      await orbityService.initialize()
      activeTasks.value = await orbityService.getUserActiveTasks(
        currentUser.value.id
      )
      return true
    } catch (err) {
      console.error('Failed to load active tasks:', err)
      error.value = err.message
      return false
    } finally {
      isLoadingTasks.value = false
    }
  }

  /**
   * Load customer projects
   */
  async function loadCustomerProjects() {
    if (!currentUser.value || !currentUser.value.id) {
      error.value = 'No user loaded'
      return false
    }

    isLoadingProjects.value = true
    error.value = null

    try {
      await orbityService.initialize()
      customerProjects.value = await orbityService.getCustomerProjects(
        currentUser.value.id
      )
      return true
    } catch (err) {
      console.error('Failed to load projects:', err)
      error.value = err.message
      return false
    } finally {
      isLoadingProjects.value = false
    }
  }

  /**
   * Refresh user balance and rate
   */
  async function refreshBalance() {
    if (!currentUser.value || !currentUser.value.id) {
      error.value = 'No user loaded'
      return false
    }

    isLoading.value = true
    error.value = null

    try {
      await orbityService.initialize()
      const userId = currentUser.value.id

      // Load balance and rate in parallel
      const [balance, rate] = await Promise.all([
        orbityService.getUserBalance(userId),
        orbityService.getUserRate(userId)
      ])

      userBalance.value = balance
      userRate.value = rate

      // Calculate total earned (all positive transactions)
      totalEarned.value = balance > 0 ? balance : 0

      return true
    } catch (err) {
      console.error('Failed to refresh balance:', err)
      error.value = err.message
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Load complete user data (profile, roles, skills, balance)
   * @param {string|number} userId - User ID
   */
async function loadCompleteUserData(userId) {
  if (!userId) {
    error.value = 'User ID is required'
    return false
  }

  isLoading.value = true
  error.value = null

  try {
    // Load all user data in parallel
    await Promise.all([
      loadUserProfile(userId),
      loadUserRoles(userId),
      loadUserSkills(userId),
      refreshBalance(),
      loadUserRates(userId) // ← ДОБАВЬ ЭТУ СТРОЧКУ
    ])

    // Load tasks if user is executor
    if (isExecutor.value) {
      await Promise.all([
        loadAvailableTasks(),
        loadActiveTasks()
      ])
    }

    // Load projects if user is customer
    if (isCustomer.value) {
      await loadCustomerProjects()
    }

    return true
  } catch (err) {
    console.error('Failed to load complete user data:', err)
    error.value = err.message
    return false
  } finally {
    isLoading.value = false
  }
}

  /**
   * Register new user
   * @param {Object} userData - User registration data
   */
// orbityStore.js - обновляю метод registerUser

/**
 * Register new user using admin credentials
 * @param {Object} userData - User registration data
 */
async function registerUser(userData) {
  isLoading.value = true
  error.value = null

  try {
    await orbityService.initialize()

    // Проверяем что все поля есть
    logger.debug('User data received', { userData })

    const registrationData = {
      login: userData.login,
      password: userData.password, 
      fullName: userData.fullName,
      email: userData.email,
      phone: userData.phone || ''
    }

    logger.debug('Prepared registration data', { registrationData })

    const result = await orbityService.registerUserWithAdmin(registrationData)

    if (result && result.id) {
      // Назначаем роль
      let roleName = ''
      if (userData.role === 'customer') roleName = 'Заказчик'
      else if (userData.role === 'executor') roleName = 'Исполнитель'

      if (roleName) {
        try {
          const allRoles = await orbityService.getAllRoles()
          const targetRole = allRoles.find(role => role.val === roleName)
          if (targetRole) await orbityService.assignRole(result.id, targetRole.id)
        } catch (e) { console.warn('Role assignment failed:', e) }
      }

      return { success: true, userId: result.id }
    }

    return { success: false, error: 'No user ID returned' }
  } catch (err) {
    error.value = err.message
    return { success: false, error: err.message }
  } finally {
    isLoading.value = false
  }
}

  /**
   * Clear all store data
   */
  function clearUserData() {
    currentUser.value = null
    userRoles.value = []
    userSkills.value = []
    userRate.value = 510
    userBalance.value = 0
    totalEarned.value = 0
    availableTasks.value = []
    activeTasks.value = []
    customerProjects.value = []
    allSkills.value = []
    mentorships.value = []
    availableMentors.value = []
    videos.value = []
    learningProgress.value = null
    error.value = null
  }

  /**
   * Load all available skills
   * @param {Object} filters - Optional filters
   */
  async function loadSkills(filters = {}) {
    isLoading.value = true
    error.value = null

    try {
      await orbityService.initialize()
      allSkills.value = await orbityService.getSkills(filters)
      return true
    } catch (err) {
      console.error('Failed to load skills:', err)
      error.value = err.message
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Load mentorships for current user
   * @param {string} role - 'mentor', 'trainee', or 'both'
   */
  async function loadMentorships(role = 'both') {
    if (!currentUser.value || !currentUser.value.id) {
      error.value = 'No user loaded'
      return false
    }

    isLoadingMentorships.value = true
    error.value = null

    try {
      await orbityService.initialize()
      mentorships.value = await orbityService.getMentorships(
        currentUser.value.id,
        role
      )
      return true
    } catch (err) {
      console.error('Failed to load mentorships:', err)
      error.value = err.message
      return false
    } finally {
      isLoadingMentorships.value = false
    }
  }

  /**
   * Find available mentors for a skill
   * @param {string|number} skillId - Skill ID
   */
  async function findMentors(skillId) {
    isLoadingMentorships.value = true
    error.value = null

    try {
      await orbityService.initialize()
      availableMentors.value = await orbityService.findSuitableMentors(skillId)
      return true
    } catch (err) {
      console.error('Failed to find mentors:', err)
      error.value = err.message
      return false
    } finally {
      isLoadingMentorships.value = false
    }
  }

  /**
   * Assign mentor to trainee
   * @param {string|number} traineeId - Trainee user ID
   * @param {string|number} mentorId - Mentor user ID
   * @param {string|number} skillId - Skill ID
   */
  async function assignMentor(traineeId, mentorId, skillId) {
    isLoadingMentorships.value = true
    error.value = null

    try {
      await orbityService.initialize()
      const result = await orbityService.assignMentor(traineeId, mentorId, skillId)

      // Reload mentorships
      if (currentUser.value) {
        await loadMentorships()
      }

      return { success: true, data: result }
    } catch (err) {
      console.error('Failed to assign mentor:', err)
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      isLoadingMentorships.value = false
    }
  }

  /**
   * Load videos with filters
   * @param {Object} filters - Filter criteria
   */
  async function loadVideos(filters = {}) {
    isLoadingVideos.value = true
    error.value = null

    try {
      await orbityService.initialize()
      videos.value = await orbityService.getVideos(filters)
      return true
    } catch (err) {
      console.error('Failed to load videos:', err)
      error.value = err.message
      return false
    } finally {
      isLoadingVideos.value = false
    }
  }

  /**
   * Add new video instruction
   * @param {Object} videoData - Video data
   */
  async function addVideoToSkill(videoData) {
    isLoadingVideos.value = true
    error.value = null

    try {
      await orbityService.initialize()
      const result = await orbityService.addVideo(videoData)

      // Reload videos
      await loadVideos()

      return { success: true, data: result }
    } catch (err) {
      console.error('Failed to add video:', err)
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      isLoadingVideos.value = false
    }
  }

  /**
   * Load learning progress for current user
   */
  async function loadLearningProgress() {
    if (!currentUser.value || !currentUser.value.id) {
      error.value = 'No user loaded'
      return false
    }

    isLoadingProgress.value = true
    error.value = null

    try {
      await orbityService.initialize()
      learningProgress.value = await orbityService.getLearningProgress(
        currentUser.value.id
      )
      return true
    } catch (err) {
      console.error('Failed to load learning progress:', err)
      error.value = err.message
      return false
    } finally {
      isLoadingProgress.value = false
    }
  }

  /**
   * Promote skill level if eligible
   * @param {string|number} skillId - Skill ID
   */
  async function promoteLevelIfEligible(skillId) {
    if (!currentUser.value || !currentUser.value.id) {
      error.value = 'No user loaded'
      return false
    }

    isLoadingSkills.value = true
    error.value = null

    try {
      await orbityService.initialize()
      const result = await orbityService.promoteSkillLevel(
        currentUser.value.id,
        skillId
      )

      if (result.promoted) {
        // Reload user skills and rate
        await Promise.all([
          loadUserSkills(currentUser.value.id),
          refreshBalance()
        ])
      }

      return result
    } catch (err) {
      console.error('Failed to promote skill level:', err)
      error.value = err.message
      return { promoted: false, error: err.message }
    } finally {
      isLoadingSkills.value = false
    }
  }

  // ============================================
  // Financial Actions - Stage 5
  // ============================================

  /**
   * Load user balance and rate
   */
  async function loadBalance() {
    if (!currentUser.value || !currentUser.value.id) {
      error.value = 'No user loaded'
      return false
    }

    isLoadingFinances.value = true
    error.value = null

    try {
      await orbityService.initialize()

      // Load balance
      userBalance.value = await orbityService.getUserBalance(currentUser.value.id)

      // Load current rate
      const rateCalc = await orbityService.calculateRate(currentUser.value.id)
      userRate.value = rateCalc.rate

      return true
    } catch (err) {
      console.error('Failed to load balance:', err)
      error.value = err.message
      return false
    } finally {
      isLoadingFinances.value = false
    }
  }

  /**
   * Load user rate
   */
  async function loadRate() {
    if (!currentUser.value || !currentUser.value.id) {
      error.value = 'No user loaded'
      return false
    }

    isLoadingFinances.value = true
    error.value = null

    try {
      await orbityService.initialize()

      const rateCalc = await orbityService.calculateRate(currentUser.value.id)
      userRate.value = rateCalc.rate

      return true
    } catch (err) {
      console.error('Failed to load rate:', err)
      error.value = err.message
      return false
    } finally {
      isLoadingFinances.value = false
    }
  }

  /**
   * Load transactions with filters
   * @param {Object} filters - Filter options
   */
  async function loadTransactions(filters = {}) {
    if (!currentUser.value || !currentUser.value.id) {
      error.value = 'No user loaded'
      return false
    }

    isLoadingTransactions.value = true
    error.value = null

    try {
      await orbityService.initialize()

      transactions.value = await orbityService.getTransactions(
        currentUser.value.id,
        filters
      )

      return true
    } catch (err) {
      console.error('Failed to load transactions:', err)
      error.value = err.message
      return false
    } finally {
      isLoadingTransactions.value = false
    }
  }

  /**
   * Load user improvements
   */
  async function loadImprovements() {
    if (!currentUser.value || !currentUser.value.id) {
      error.value = 'No user loaded'
      return false
    }

    isLoadingImprovements.value = true
    error.value = null

    try {
      await orbityService.initialize()

      improvements.value = await orbityService.getUserImprovements(
        currentUser.value.id
      )

      return true
    } catch (err) {
      console.error('Failed to load improvements:', err)
      error.value = err.message
      return false
    } finally {
      isLoadingImprovements.value = false
    }
  }

  /**
   * Load income statistics
   * @param {string} period - Period ('month', 'quarter', 'year')
   */
  async function loadIncomeStats(period = 'month') {
    if (!currentUser.value || !currentUser.value.id) {
      error.value = 'No user loaded'
      return false
    }

    isLoadingFinances.value = true
    error.value = null

    try {
      await orbityService.initialize()

      incomeStats.value = await orbityService.getIncomeStats(
        currentUser.value.id,
        period
      )

      // Update totalEarned from stats
      if (incomeStats.value) {
        totalEarned.value = incomeStats.value.totalEarned
      }

      return true
    } catch (err) {
      console.error('Failed to load income stats:', err)
      error.value = err.message
      return false
    } finally {
      isLoadingFinances.value = false
    }
  }

  /**
   * Request withdrawal
   * @param {number} amount - Amount to withdraw
   * @param {string} method - Withdrawal method
   * @param {Object} details - Payment details
   */
  async function requestWithdrawal(amount, method, details) {
    if (!currentUser.value || !currentUser.value.id) {
      error.value = 'No user loaded'
      return { success: false, error: 'No user loaded' }
    }

    isLoadingFinances.value = true
    error.value = null

    try {
      await orbityService.initialize()

      const result = await orbityService.requestWithdrawal(
        currentUser.value.id,
        amount,
        method,
        details
      )

      // Reload balance and transactions
      await Promise.all([
        loadBalance(),
        loadTransactions()
      ])

      return { success: true, data: result }
    } catch (err) {
      console.error('Failed to request withdrawal:', err)
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      isLoadingFinances.value = false
    }
  }

  /**
   * Create a technological improvement
   * @param {Object} improvementData - Improvement data
   */
  async function createImprovement(improvementData) {
    if (!currentUser.value || !currentUser.value.id) {
      error.value = 'No user loaded'
      return { success: false, error: 'No user loaded' }
    }

    isLoadingImprovements.value = true
    error.value = null

    try {
      await orbityService.initialize()

      const result = await orbityService.registerImprovement(
        currentUser.value.id,
        improvementData.skillId,
        improvementData.description,
        improvementData.normativeImprovement
      )

      // Reload improvements
      await loadImprovements()

      return { success: true, data: result }
    } catch (err) {
      console.error('Failed to create improvement:', err)
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      isLoadingImprovements.value = false
    }
  }

  /**
   * Load AI financial recommendations
   */
  async function loadAIRecommendations() {
    if (!currentUser.value || !currentUser.value.id) {
      error.value = 'No user loaded'
      return false
    }

    isLoadingFinances.value = true
    error.value = null

    try {
      await orbityService.initialize()

      financialRecommendations.value = await orbityService.getAIFinancialRecommendations(
        currentUser.value.id
      )

      return true
    } catch (err) {
      console.error('Failed to load AI recommendations:', err)
      error.value = err.message
      return false
    } finally {
      isLoadingFinances.value = false
    }
  }
  const userRateValue = ref('')
async function loadUserRateValue(userId) {
  try {
    const rate = await orbityService.getUserRateValue(userId)
    userRateValue.value = rate
    return true
  } catch (err) {
    console.error('Failed to load user rate:', err)
    return false
  }
}
const allUsers = ref([])

async function loadAllUsers() {
  try {
    await orbityService.initialize()
    allUsers.value = await orbityService.getAllUsers()
    return true
  } catch (err) {
    console.error('Failed to load users:', err)
    return false
  }
}

  // ============================================
  // Computed Getters for Financial Data
  // ============================================

  /**
   * Get earned this month
   */
  const earnedThisMonth = computed(() => {
    return incomeStats.value?.totalEarned || 0
  })

  /**
   * Get passive income total
   */
  const passiveIncome = computed(() => {
    return incomeStats.value?.passiveIncome || 0
  })

  /**
   * Get available for withdrawal
   */
  const availableForWithdrawal = computed(() => {
    return userBalance.value > 0 ? userBalance.value : 0
  })

  // ============================================
  // Return store
  // ============================================

  return {
    // State
    currentUser,
    userRoles,
    userSkills,
    userRate,
    userBalance,
    totalEarned,
    availableTasks,
    activeTasks,
    customerProjects,
    allSkills,
    mentorships,
    availableMentors,
    videos,
    learningProgress,
    transactions,
    improvements,
    incomeStats,
    financialRecommendations,
    isAuthenticated,
    authToken,
    xsrfToken,
    userId,
    userName,
    userEmail,
    isLoading,
    isLoadingProfile,
    isLoadingRoles,
    isLoadingSkills,
    isLoadingTasks,
    isLoadingProjects,
    isLoadingMentorships,
    isLoadingVideos,
    isLoadingProgress,
    isLoadingTransactions,
    isLoadingImprovements,
    isLoadingFinances,
    error,

    // Getters
    isExecutor,
    isCustomer,
    isMentor,
    isManager,
    totalEarnedAmount,
    isProfileLoaded,
    displayName,
    email,
    userPhone,
    skillsInLearning,
    availableSkillsToLearn,
    earnedThisMonth,
    passiveIncome,
    availableForWithdrawal,
    isUserAuthenticated,
    userRateValue,allUsers,

    // Actions
    authenticate,
    saveSession,
    loadSession,
    logout,
    loadUserProfile,
    updateProfile,
    loadUserRoles,
    loadUserSkills,
    loadAvailableTasks,
    loadActiveTasks,
    loadCustomerProjects,
    refreshBalance,
    loadCompleteUserData,
    registerUser,
    clearUserData,
    loadSkills,
    loadMentorships,
    findMentors,
    assignMentor,
    loadVideos,
    addVideoToSkill,
    loadLearningProgress,
    promoteLevelIfEligible,
    loadBalance,
    loadRate,
    loadTransactions,
    loadImprovements,
    loadIncomeStats,
    requestWithdrawal,
    createImprovement,
    loadAIRecommendations,loadUserRateValue,
loadAllUsers
  }
})
