/**
 * Orbity Service
 *
 * Service layer for the Orbity platform - ecosystem for customers and executors
 * with transparent labor division, practical learning, and fair remuneration.
 *
 * All data is stored in INTEGRA database 'orbits' on https://integram.io server.
 * Uses integramService.js internally for all CRUD operations.
 */

import integramService from './integramApiClient'
import { logger } from '@/utils/logger'

class OrbityService {
  constructor() {
    this.database = 'orbits'  // Using 'orbits' database on integram.io
    this.initialized = false
  }

  /**
   * Initialize service and set database context
   */
  async initialize() {
    if (!this.initialized) {
      // Set Orbits-specific server and database
      integramService.setServer('https://integram.io')
      integramService.setDatabase(this.database)
      this.initialized = true
    }
    return this.initialized
  }

  /**
   * Ensure service is initialized before operations
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize()
    }
    /*if (!integramService.getSessionId()) {
      throw new Error('Not authenticated. Please login to INTEGRA first.')
    }*/
  }

  // ============================================
  // User Registration & Profile Management
  // ============================================
/**
 * Authenticate user with username and password
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<Object>} Authentication result
 */
/**
 * Authenticate user with username and password
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<Object>} Authentication result
 */
/**
 * Authenticate user with username and password
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<Object>} Authentication result
 */
async authenticate(username, password) {
  try {
    if (!this.initialized) {
      await this.initialize()
    }

    // Use integramService for authentication
    const result = await integramService.auth(username, password, this.database)
    
    if (result.success) {
      logger.info('Authentication successful, setting session...')
      
      // Store session data in orbityService
      this.session = {
        token: result.token,
        xsrf: result.xsrf,
        userId: result.userId,
        userName: result.userName,
        userEmail: result.userEmail || '',
        userRole: result.userRole
      }

      return {
        success: true,
        token: result.token,
        xsrf: result.xsrf,
        userId: result.userId,
        userName: result.userName,
        userEmail: result.userEmail || '',
        userRole: result.userRole
      }
    } else {
      return {
        success: false,
        error: result.error || 'Authentication failed'
      }
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return {
      success: false,
      error: error.message || 'Authentication failed'
    }
  }
}
  /**
   * Register a new user
   * @param {Object} userData - User data (fio, email, phone, password)
   * @returns {Promise<Object>} Created user object
   */
/**
 * Register a new user
 * @param {Object} userData - User data (fio, email, phone, password)
 * @returns {Promise<Object>} Created user object
 */
/**
 * Register a new user
 */

// orbityService.js - добавляю метод

/**
 * Register new user using admin credentials
 * @param {Object} userData - User data (fio, email, phone)
 * @returns {Promise<Object>} Created user object
 */
// orbityService.js - исправляю метод registerUserWithAdmin

/**
 * Register new user using admin credentials
 * @param {Object} userData - User data (fio, email, phone)
 * @returns {Promise<Object>} Created user object
 */
async registerUserWithAdmin(userData) {
  await this.ensureInitialized()

  // First authenticate as admin
  const authResult = await this.authenticate('reg', 'wix10141')
  
  if (!authResult.success) {
    throw new Error('Admin authentication failed: ' + authResult.error)
  }

  // Get the "Пользователь" type ID (18)
  const userTypeId = 18

  // Prepare requisites for new user
  const requisites = {
    '33': userData.fio, // Имя
    '41': userData.email, // Email  
    '156': new Date().toISOString().split('T')[0] // Дата
  }

  // Добавляем телефон только если он есть
  if (userData.phone) {
    requisites['30'] = userData.phone
  }

  logger.debug('Creating user with requisites', { requisites })

  // Create user object
  const result = await integramService.createObject(
    userTypeId,
    userData.fio, // Object value
    requisites,   // Requisites object
    null          // No parent
  )

  return result
}// orbityService.js - обновляю метод registerUserWithAdmin

/**
 * Register new user using admin credentials
 * @param {Object} userData - User data (fio, email, phone, login, password)
 * @returns {Promise<Object>} Created user object
 */
async registerUserWithAdmin(userData) {
  logger.debug('registerUserWithAdmin input', { userData })
  await this.ensureInitialized()

  const authResult = await this.authenticate('reg', 'wix10141')
  if (!authResult.success) {
    throw new Error('Admin authentication failed: ' + authResult.error)
  }

  const userTypeId = 18

  const requisites = {
    '33': userData.fullName, // Полное имя
    '41': userData.email, // Email
    '30': userData.phone || '', // Телефон
    '156': new Date().toISOString().split('T')[0], // Дата
    '20': userData.password, // Пароль
    '18': userData.login // Логин (добавляем в requisites)
  }

  logger.debug('Creating user with requisites (admin)', { requisites })

  const result = await integramService.createObject(
    userTypeId,
    userData.login, // Логин как значение объекта
    requisites,
    null
  )

  return result
}
async registerUser(userData) {
  try {
    await this.ensureInitialized()

    // Get the "Пользователи" type ID
    const types = await this.getTypeByName('Пользователи')
    if (!types || types.length === 0) {
      throw new Error('Тип "Пользователи" не найден в базе данных')
    }
    const userTypeId = types[0].id

    // Get status "Активен" for new user
    const activeStatus = await this.getUserStatusByName('Активен')

    // Create user object in INTEGRA
    const requisites = {
      fio: userData.fio,
      email: userData.email,
      phone: userData.phone,
      registration_date: new Date().toISOString().split('T')[0],
      status: activeStatus ? activeStatus.id : null
    }

    const result = await integramService.createObject(
      userTypeId,
      userData.fio,
      null,
      requisites
    )

    return result

  } catch (error) {
    console.error('User registration error:', error)
    throw error
  }
}
/**
 * Set user credentials for authentication
 * @param {string|number} userId - User ID
 * @param {string} username - Username/email
 * @param {string} password - Password
 * @returns {Promise<Object>} Result
 */
async setUserCredentials(userId, username, password) {
  await this.ensureInitialized()

  // This would typically create a record in the authentication system
  // For INTEGRA, this might involve creating a specific object type for credentials
  logger.info(`Setting credentials for user ${userId}: ${username}`)
  
  // Placeholder - in a real implementation, you'd create the actual auth record
  return { success: true, userId, username }
}
  /**
   * Get user profile by user ID
   * @param {string|number} userId - User ID
   * @returns {Promise<Object>} User profile data
   */
  async getUserProfile(userId) {
    await this.ensureInitialized()
    const result = await integramService.getEditObject(userId)
    return integramService.parseObjectForEdit(result)
  }
async getUserRateValue(userId) {
  await this.ensureInitialized()
  
  // Используем правильный формат с F_U фильтром
  const result = await integramService.getObjects(721, {
    F_U: userId
  })
  
  const parsed = integramService.parseObjectList(result)
  const rates = parsed.objects || []
  
  logger.debug('Rates from table 721', { count: rates.length })
  
  if (rates.length > 0) {
    return rates[0].val // "666"
  }
  
  return null
}
async getAllUsers() {
  await this.ensureInitialized()
  const result = await integramService.getObjects(18) // typeId для Пользователь
  const parsed = integramService.parseObjectList(result)
  return parsed.objects || []
}
  /**
   * Update user profile
   * @param {string|number} userId - User ID
   * @param {Object} updates - Updated fields
   * @returns {Promise<Object>} Updated user object
   */
  
// В orbityService.js, обновим метод updateUserProfile:
async getUserRates(userId) {
  await this.ensureInitialized()
  
  const types = await this.getTypeByName('Ставка в час')
  if (!types || types.length === 0) {
    return []
  }
  const ratesTypeId = types[0].id

  const filters = integramService.buildFilters({
    fields: { user: userId }
  })

  const result = await integramService.getObjects(ratesTypeId, filters)
  const parsed = integramService.parseObjectList(result)

  return parsed.objects || []
}
/**
 * Update user profile
 * @param {string|number} userId - User ID
 * @param {Object} updates - Updated fields
 * @returns {Promise<Object>} Updated user object
 */
// В orbityService.js - исправляем updateUserProfile
// В orbityService.js - исправляем updateUserProfile
async updateUserProfile(userId, updates) {
  await this.ensureInitialized()

  try {
    // Получаем текущие данные пользователя
    const currentUser = await this.getUserProfile(userId)
    
    // Подготавливаем реквизиты в правильном формате
    const requisites = {}
    
    // Используем правильные ID реквизитов:
    // t33 - имя, t30 - телефон, t39 - примечание
    if (updates.fio !== undefined) {
      requisites['33'] = updates.fio
    }
    if (updates.phone !== undefined) {
      requisites['30'] = updates.phone
    }
    // Если нужно обновлять примечание
    if (updates.note !== undefined) {
      requisites['39'] = updates.note
    }

    // Используем оригинальный метод saveObject
    const result = await integramService.saveObject(
      userId,
      null,
      updates.fio || currentUser.val,
      requisites
    )

    if (result && (result.id || result.success)) {
      return result
    } else {
      throw new Error('Failed to save user profile')
    }
    
  } catch (error) {
    console.error('Error updating user profile:', error)
    throw new Error(`Ошибка обновления профиля: ${error.message}`)
  }
}
  /**
   * Get user roles
   * @param {string|number} userId - User ID
   * @returns {Promise<Array>} Array of user roles
   */
  async getUserRoles(userId) {
    await this.ensureInitialized()

    // Get the "ПользователиРоли" type ID
    const types = await this.getTypeByName('ПользователиРоли')
    if (!types || types.length === 0) {
      return []
    }
    const userRolesTypeId = types[0].id

    // Get user-role bindings
    const filters = integramService.buildFilters({
      fields: { user: userId }
    })

    const result = await integramService.getObjects(userRolesTypeId, filters)
    const parsed = integramService.parseObjectList(result)

    return parsed.objects || []
  }

  /**
   * Assign role to user
   * @param {string|number} userId - User ID
   * @param {string|number} roleId - Role ID
   * @returns {Promise<Object>} Created user-role binding
   */
  async assignRole(userId, roleId) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('ПользователиРоли')
    if (!types || types.length === 0) {
      throw new Error('Тип "ПользователиРоли" не найден')
    }
    const userRolesTypeId = types[0].id

    const requisites = {
      user: userId,
      role: roleId,
      assignment_date: new Date().toISOString().split('T')[0]
    }

    return await integramService.createObject(
      userRolesTypeId,
      `User ${userId} - Role ${roleId}`,
      null,
      requisites
    )
  }

  // ============================================
  // Skills Management
  // ============================================

  /**
   * Get user skills
   * @param {string|number} userId - User ID
   * @returns {Promise<Array>} Array of user skills with levels
   */
  async getUserSkills(userId) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('НавыкиПользователей')
    if (!types || types.length === 0) {
      return []
    }
    const userSkillsTypeId = types[0].id

    const filters = integramService.buildFilters({
      fields: { user: userId }
    })

    const result = await integramService.getObjects(userSkillsTypeId, filters)
    const parsed = integramService.parseObjectList(result)

    return parsed.objects || []
  }

  /**
   * Get all available skills
   * @returns {Promise<Array>} Array of all skills
   */
  async getAllSkills() {
    await this.ensureInitialized()

    const types = await this.getTypeByName('Навыки')
    if (!types || types.length === 0) {
      return []
    }
    const skillsTypeId = types[0].id

    const result = await integramService.getObjects(skillsTypeId)
    const parsed = integramService.parseObjectList(result)

    return parsed.objects || []
  }

  // ============================================
  // Financial Information
  // ============================================

  /**
   * Get user's current rate
   * @param {string|number} userId - User ID
   * @returns {Promise<number>} Current rate in rubles per hour
   */
  async getUserRate(userId) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('Ставки')
    if (!types || types.length === 0) {
      return 510 // Default base rate
    }
    const ratesTypeId = types[0].id

    const filters = integramService.buildFilters({
      fields: { user: userId }
    })

    const result = await integramService.getObjects(ratesTypeId, filters)
    const parsed = integramService.parseObjectList(result)

    if (!parsed.objects || parsed.objects.length === 0) {
      return 510 // Default base rate
    }

    // Get the most recent rate (sorted by date in descending order)
    const sortedRates = parsed.objects.sort((a, b) => {
      const dateA = new Date(a.req_date || 0)
      const dateB = new Date(b.req_date || 0)
      return dateB - dateA
    })

    return parseFloat(sortedRates[0].req_rate || 510)
  }

  /**
   * Get user's balance
   * @param {string|number} userId - User ID
   * @returns {Promise<number>} Current balance in rubles
   */
  async getUserBalance(userId) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('Транзакции')
    if (!types || types.length === 0) {
      return 0
    }
    const transactionsTypeId = types[0].id

    const filters = integramService.buildFilters({
      fields: { user: userId }
    })

    const result = await integramService.getObjects(transactionsTypeId, filters)
    const parsed = integramService.parseObjectList(result)

    if (!parsed.objects || parsed.objects.length === 0) {
      return 0
    }

    // Calculate balance by summing all transactions
    const balance = parsed.objects.reduce((sum, transaction) => {
      const amount = parseFloat(transaction.req_amount || 0)
      return sum + amount
    }, 0)

    return balance
  }

  // ============================================
  // Tasks Management
  // ============================================

  /**
   * Get available tasks for executor
   * @param {string|number} userId - User ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Array of available tasks
   */
  async getAvailableTasks(userId, filters = {}) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('Задачи')
    if (!types || types.length === 0) {
      return []
    }
    const tasksTypeId = types[0].id

    // Get user skills to filter matching tasks
    const userSkills = await this.getUserSkills(userId)
    const userSkillIds = userSkills.map(s => s.req_skill)

    // Get tasks with "Новая" status
    const newStatus = await this.getTaskStatusByName('Новая')

    const taskFilters = integramService.buildFilters({
      fields: {
        status: newStatus ? newStatus.id : null,
        ...filters.fields
      }
    })

    const result = await integramService.getObjects(tasksTypeId, taskFilters)
    const parsed = integramService.parseObjectList(result)

    // Filter tasks that match user skills (if user has skills)
    if (userSkillIds.length > 0) {
      return (parsed.objects || []).filter(task => {
        // If task has required skills, check if user has them
        if (task.req_required_skills) {
          // Handle multiselect reference field
          const requiredSkillIds = Array.isArray(task.req_required_skills)
            ? task.req_required_skills
            : [task.req_required_skills]

          return requiredSkillIds.some(skillId => userSkillIds.includes(skillId))
        }
        return true // If no required skills, show task
      })
    }

    return parsed.objects || []
  }

  /**
   * Get user's active tasks
   * @param {string|number} userId - User ID
   * @returns {Promise<Array>} Array of active tasks
   */
  async getUserActiveTasks(userId) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('ВыполнениеЗадач')
    if (!types || types.length === 0) {
      return []
    }
    const executionTypeId = types[0].id

    const filters = integramService.buildFilters({
      fields: { executor: userId }
    })

    const result = await integramService.getObjects(executionTypeId, filters)
    const parsed = integramService.parseObjectList(result)

    return parsed.objects || []
  }

  // ============================================
  // Projects Management (for Customers)
  // ============================================

  /**
   * Get customer's projects
   * @param {string|number} userId - Customer user ID
   * @returns {Promise<Array>} Array of projects
   */
  async getCustomerProjects(userId) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('Проекты')
    if (!types || types.length === 0) {
      return []
    }
    const projectsTypeId = types[0].id

    const filters = integramService.buildFilters({
      fields: { customer: userId }
    })

    const result = await integramService.getObjects(projectsTypeId, filters)
    const parsed = integramService.parseObjectList(result)

    return parsed.objects || []
  }

  /**
   * Get projects with filters
   * @param {Object} filters - Filter criteria (status, customer, dateRange, search)
   * @returns {Promise<Array>} Array of projects
   */
  async getProjects(filters = {}) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('Проекты')
    if (!types || types.length === 0) {
      return []
    }
    const projectsTypeId = types[0].id

    const integraFilters = integramService.buildFilters({
      fields: filters.fields || {}
    })

    const result = await integramService.getObjects(projectsTypeId, integraFilters)
    const parsed = integramService.parseObjectList(result)

    return parsed.objects || []
  }

  /**
   * Get project by ID
   * @param {string|number} projectId - Project ID
   * @returns {Promise<Object>} Project data
   */
  async getProject(projectId) {
    await this.ensureInitialized()
    const result = await integramService.getEditObject(projectId)
    return integramService.parseObjectForEdit(result)
  }

  /**
   * Create new project
   * @param {Object} projectData - Project data
   * @returns {Promise<Object>} Created project
   */
  async createProject(projectData) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('Проекты')
    if (!types || types.length === 0) {
      throw new Error('Тип "Проекты" не найден в базе данных')
    }
    const projectTypeId = types[0].id

    // Get status "Новый"
    const newStatus = await this.getProjectStatusByName('Новый')

    const requisites = {
      name: projectData.name,
      description: projectData.description,
      customer: projectData.customerId,
      status: newStatus ? newStatus.id : null,
      start_date: projectData.startDate,
      end_date: projectData.endDate,
      budget: projectData.budget
    }

    const result = await integramService.createObject(
      projectTypeId,
      projectData.name,
      null,
      requisites
    )

    return result
  }

  /**
   * Update project
   * @param {string|number} projectId - Project ID
   * @param {Object} updates - Updated fields
   * @returns {Promise<Object>} Updated project
   */
  async updateProject(projectId, updates) {
    await this.ensureInitialized()

    const updateData = {
      value: updates.name || updates.value,
      typeId: updates.typeId,
      reqs: {}
    }

    if (updates.name) updateData.reqs.name = updates.name
    if (updates.description) updateData.reqs.description = updates.description
    if (updates.status) updateData.reqs.status = updates.status
    if (updates.startDate) updateData.reqs.start_date = updates.startDate
    if (updates.endDate) updateData.reqs.end_date = updates.endDate
    if (updates.budget) updateData.reqs.budget = updates.budget

    return await integramService.saveObject(projectId, updateData)
  }

  /**
   * Delete project
   * @param {string|number} projectId - Project ID
   * @returns {Promise<void>}
   */
  async deleteProject(projectId) {
    await this.ensureInitialized()
    return await integramService.deleteObject(projectId)
  }

  /**
   * Get tasks with filters
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} Array of tasks
   */
  async getTasks(filters = {}) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('Задачи')
    if (!types || types.length === 0) {
      return []
    }
    const tasksTypeId = types[0].id

    const integraFilters = integramService.buildFilters({
      fields: filters.fields || {}
    })

    const result = await integramService.getObjects(tasksTypeId, integraFilters)
    const parsed = integramService.parseObjectList(result)

    return parsed.objects || []
  }

  /**
   * Get task by ID
   * @param {string|number} taskId - Task ID
   * @returns {Promise<Object>} Task data
   */
  async getTask(taskId) {
    await this.ensureInitialized()
    const result = await integramService.getEditObject(taskId)
    return integramService.parseObjectForEdit(result)
  }

  /**
   * Create new task
   * @param {Object} taskData - Task data
   * @returns {Promise<Object>} Created task
   */
  async createTask(taskData) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('Задачи')
    if (!types || types.length === 0) {
      throw new Error('Тип "Задачи" не найден в базе данных')
    }
    const taskTypeId = types[0].id

    // Get status
    const status = await this.getTaskStatusByName(taskData.status || 'Новая')

    const requisites = {
      project: taskData.projectId,
      name: taskData.name,
      description: taskData.description,
      task_type: taskData.taskType,
      required_skills: taskData.skills, // multi-reference
      planned_time: taskData.plannedTime,
      status: status ? status.id : null,
      priority: taskData.priority || 3
    }

    const result = await integramService.createObject(
      taskTypeId,
      taskData.name,
      null,
      requisites
    )

    return result
  }

  /**
   * Update task
   * @param {string|number} taskId - Task ID
   * @param {Object} updates - Updated fields
   * @returns {Promise<Object>} Updated task
   */
  async updateTask(taskId, updates) {
    await this.ensureInitialized()

    const updateData = {
      value: updates.name || updates.value,
      typeId: updates.typeId,
      reqs: {}
    }

    if (updates.name) updateData.reqs.name = updates.name
    if (updates.description) updateData.reqs.description = updates.description
    if (updates.taskType) updateData.reqs.task_type = updates.taskType
    if (updates.skills) updateData.reqs.required_skills = updates.skills
    if (updates.plannedTime) updateData.reqs.planned_time = updates.plannedTime
    if (updates.status) updateData.reqs.status = updates.status
    if (updates.priority) updateData.reqs.priority = updates.priority

    return await integramService.saveObject(taskId, updateData)
  }

  /**
   * Delete task
   * @param {string|number} taskId - Task ID
   * @returns {Promise<void>}
   */
  async deleteTask(taskId) {
    await this.ensureInitialized()
    return await integramService.deleteObject(taskId)
  }

  /**
   * Assign executor to task
   * @param {string|number} taskId - Task ID
   * @param {string|number} executorId - Executor user ID
   * @returns {Promise<Object>} Created task execution record
   */
  async assignExecutor(taskId, executorId) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('ВыполнениеЗадач')
    if (!types || types.length === 0) {
      throw new Error('Тип "ВыполнениеЗадач" не найден')
    }
    const executionTypeId = types[0].id

    // Check if executor is a trainee, assign mentor if needed
    const userSkills = await this.getUserSkills(executorId)
    const hasTraineeSkills = userSkills.some(skill => {
      // Check if any skill has "Стажер" level
      return skill.req_level && skill.req_level.includes('Стажер')
    })

    let mentorId = null
    if (hasTraineeSkills) {
      // TODO: Implement mentor assignment logic (1:3 ratio)
      // For now, skip mentor assignment
    }

    const requisites = {
      task: taskId,
      executor: executorId,
      mentor: mentorId,
      start_date: new Date().toISOString(),
      status_control: null
    }

    const result = await integramService.createObject(
      executionTypeId,
      `Task ${taskId} - Executor ${executorId}`,
      null,
      requisites
    )

    // Update task status to "Назначена"
    const assignedStatus = await this.getTaskStatusByName('Назначена')
    if (assignedStatus) {
      await this.updateTask(taskId, { status: assignedStatus.id })
    }

    return result
  }

  /**
   * Auto-match executors for a task
   * Algorithm:
   * 1. Get required skills of the task
   * 2. Find all users with "Исполнитель" role
   * 3. Filter by matching skills
   * 4. Calculate rating based on:
   *    - Skill level (Мастер +10, Специалист +5, Стажер +1)
   *    - Workload (fewer active tasks = higher rating)
   *    - Success rate (average quality control score)
   * 5. Sort by rating (descending)
   * 6. Return top 10 candidates
   *
   * @param {string|number} taskId - Task ID
   * @returns {Promise<Array>} Array of matched executors with ratings
   */
  async autoMatchExecutors(taskId) {
    await this.ensureInitialized()

    // Get task details
    const task = await this.getTask(taskId)
    const requiredSkillIds = Array.isArray(task.req_required_skills)
      ? task.req_required_skills
      : [task.req_required_skills]

    // Get all users with "Исполнитель" role
    const executorRole = (await this.getAllRoles()).find(r => r.val === 'Исполнитель')
    if (!executorRole) {
      return []
    }

    // Get all user-role bindings for executors
    const types = await this.getTypeByName('ПользователиРоли')
    if (!types || types.length === 0) {
      return []
    }
    const userRolesTypeId = types[0].id

    const filters = integramService.buildFilters({
      fields: { role: executorRole.id }
    })

    const userRolesResult = await integramService.getObjects(userRolesTypeId, filters)
    const userRolesParsed = integramService.parseObjectList(userRolesResult)
    const executorUserIds = (userRolesParsed.objects || []).map(ur => ur.req_user)

    // Calculate rating for each executor
    const candidates = []

    for (const userId of executorUserIds) {
      // Get user skills
      const userSkills = await this.getUserSkills(userId)

      // Check if user has any of the required skills
      const matchingSkills = userSkills.filter(us =>
        requiredSkillIds.includes(us.req_skill)
      )

      if (matchingSkills.length === 0) {
        continue // Skip if no matching skills
      }

      // Calculate skill level score
      let skillScore = 0
      matchingSkills.forEach(skill => {
        const levelName = skill.req_level?.val || ''
        if (levelName.includes('Мастер')) skillScore += 10
        else if (levelName.includes('Специалист')) skillScore += 5
        else if (levelName.includes('Стажер')) skillScore += 1
      })

      // Get workload (active tasks)
      const activeTasks = await this.getUserActiveTasks(userId)
      const workload = activeTasks.length
      const workloadScore = Math.max(0, 10 - workload) // Less workload = higher score

      // Get user rate
      const rate = await this.getUserRate(userId)

      // Calculate success rate (placeholder - would need quality control data)
      const successRate = 100 // Default 100%

      // Calculate total rating
      const rating = skillScore + workloadScore

      // Get user profile
      const userProfile = await this.getUserProfile(userId)

      candidates.push({
        userId: userId,
        name: userProfile.val || 'Unknown',
        photo: userProfile.req_photo,
        role: 'Исполнитель',
        skills: matchingSkills.map(ms => ({
          id: ms.req_skill,
          name: ms.req_skill?.val || 'Unknown',
          level: ms.req_level?.val || 'Unknown'
        })),
        rating: rating,
        rate: rate,
        workload: (workload / 10) * 100, // Convert to percentage (assume max 10 tasks)
        activeTasks: workload,
        successRate: successRate,
        completedTasks: userSkills.reduce((sum, skill) =>
          sum + (skill.req_execution_count || 0), 0
        )
      })
    }

    // Sort by rating (descending) and return top 10
    return candidates
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10)
  }

  /**
   * Get all executors (for manual assignment)
   * @returns {Promise<Array>} Array of all executors
   */
  async getAllExecutors() {
    await this.ensureInitialized()

    const executorRole = (await this.getAllRoles()).find(r => r.val === 'Исполнитель')
    if (!executorRole) {
      return []
    }

    const types = await this.getTypeByName('ПользователиРоли')
    if (!types || types.length === 0) {
      return []
    }
    const userRolesTypeId = types[0].id

    const filters = integramService.buildFilters({
      fields: { role: executorRole.id }
    })

    const result = await integramService.getObjects(userRolesTypeId, filters)
    const parsed = integramService.parseObjectList(result)

    const executors = []
    for (const userRole of (parsed.objects || [])) {
      const userProfile = await this.getUserProfile(userRole.req_user)
      executors.push({
        userId: userRole.req_user,
        name: userProfile.val || 'Unknown',
        photo: userProfile.req_photo,
        role: 'Исполнитель'
      })
    }

    return executors
  }

  /**
   * Take task in progress (executor action)
   * @param {string|number} taskId - Task ID
   * @param {string|number} executorId - Executor ID
   * @returns {Promise<Object>} Updated task execution
   */
  async takeTaskInProgress(taskId, executorId) {
    await this.ensureInitialized()

    // Update task status to "В работе"
    const inProgressStatus = await this.getTaskStatusByName('В работе')
    if (inProgressStatus) {
      await this.updateTask(taskId, { status: inProgressStatus.id })
    }

    // TODO: Update execution record if needed

    return { success: true }
  }

  /**
   * Complete task (executor action)
   * @param {string|number} taskId - Task ID
   * @param {string|number} executorId - Executor ID
   * @param {Object} result - Task result (actualTime, comment, photos)
   * @returns {Promise<Object>} Updated task execution
   */
  async completeTask(taskId, executorId, result) {
    await this.ensureInitialized()

    // Update task status to "На проверке"
    const onReviewStatus = await this.getTaskStatusByName('На проверке')
    if (onReviewStatus) {
      await this.updateTask(taskId, { status: onReviewStatus.id })
    }

    // TODO: Update execution record with actual time and result

    return { success: true }
  }

  /**
   * Get project team (executors working on project tasks)
   * @param {string|number} projectId - Project ID
   * @returns {Promise<Array>} Array of team members
   */
  async getProjectTeam(projectId) {
    await this.ensureInitialized()

    // Get all tasks of the project
    const tasks = await this.getTasks({
      fields: { project: projectId }
    })

    // Get unique executor IDs from task executions
    const executorIds = new Set()
    for (const task of tasks) {
      // TODO: Get executions for each task and extract executor IDs
    }

    // For now, return empty array
    return []
  }

  /**
   * Get project finances (budget, spent, breakdown)
   * @param {string|number} projectId - Project ID
   * @returns {Promise<Object>} Finance data
   */
  async getProjectFinances(projectId) {
    await this.ensureInitialized()

    const project = await this.getProject(projectId)

    // TODO: Calculate actual spending from task payments

    return {
      budget: project.req_budget || 0,
      spent: 0,
      remaining: project.req_budget || 0,
      breakdown: {
        labor: 0,
        materials: 0,
        overhead: 0
      }
    }
  }

  /**
   * Get project status by name
   * @param {string} statusName - Status name
   * @returns {Promise<Object|null>} Status object or null
   */
  async getProjectStatusByName(statusName) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('СтатусыПроектов')
    if (!types || types.length === 0) {
      return null
    }
    const statusTypeId = types[0].id

    const result = await integramService.getObjects(statusTypeId)
    const parsed = integramService.parseObjectList(result)

    const status = (parsed.objects || []).find(obj => obj.val === statusName)
    return status || null
  }

  // ============================================
  // Helper Methods - Get References by Name
  // ============================================

  /**
   * Get type ID by type name
   * @param {string} typeName - Type name
   * @returns {Promise<Array>} Array of matching types
   */
/**
 * Get type ID by type name
 * @param {string} typeName - Type name
 * @returns {Promise<Array>} Array of matching types
 */
async getTypeByName(typeName) {
  try {
    await this.ensureInitialized()
    const dictionary = await integramService.getDictionary()
    
    // Dictionary возвращает объект {id: "name"}, преобразуем в массив
    const typesArray = []
    for (const [id, name] of Object.entries(dictionary)) {
      typesArray.push({ id: parseInt(id), val: name })
    }
    
    return typesArray.filter(type => type.val === typeName)
  } catch (error) {
    console.error('Error getting type by name:', error)
    return []
  }
}

  /**
   * Get user status by name
   * @param {string} statusName - Status name (e.g., "Активен")
   * @returns {Promise<Object|null>} Status object or null
   */
  async getUserStatusByName(statusName) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('СтатусыПользователей')
    if (!types || types.length === 0) {
      return null
    }
    const statusTypeId = types[0].id

    const result = await integramService.getObjects(statusTypeId)
    const parsed = integramService.parseObjectList(result)

    const status = (parsed.objects || []).find(obj => obj.val === statusName)
    return status || null
  }

  /**
   * Get task status by name
   * @param {string} statusName - Status name (e.g., "Новая")
   * @returns {Promise<Object|null>} Status object or null
   */
  async getTaskStatusByName(statusName) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('СтатусыЗадач')
    if (!types || types.length === 0) {
      return null
    }
    const statusTypeId = types[0].id

    const result = await integramService.getObjects(statusTypeId)
    const parsed = integramService.parseObjectList(result)

    const status = (parsed.objects || []).find(obj => obj.val === statusName)
    return status || null
  }

  /**
   * Get all roles
   * @returns {Promise<Array>} Array of all roles
   */
  async getAllRoles() {
    await this.ensureInitialized()

    const types = await this.getTypeByName('Роли')
    if (!types || types.length === 0) {
      return []
    }
    const rolesTypeId = types[0].id

    const result = await integramService.getObjects(rolesTypeId)
    const parsed = integramService.parseObjectList(result)

    return parsed.objects || []
  }

  // ============================================
  // Skills Management (Extended for Stage 4)
  // ============================================

  /**
   * Get all skills with filters
   * @param {Object} filters - Filter criteria (category, search, sort)
   * @returns {Promise<Array>} Array of skills
   */
  async getSkills(filters = {}) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('Навыки')
    if (!types || types.length === 0) {
      return []
    }
    const skillsTypeId = types[0].id

    const integraFilters = integramService.buildFilters({
      fields: filters.fields || {}
    })

    const result = await integramService.getObjects(skillsTypeId, integraFilters)
    const parsed = integramService.parseObjectList(result)

    return parsed.objects || []
  }

  /**
   * Get skill by ID
   * @param {string|number} skillId - Skill ID
   * @returns {Promise<Object>} Skill data
   */
  async getSkill(skillId) {
    await this.ensureInitialized()
    const result = await integramService.getEditObject(skillId)
    return integramService.parseObjectForEdit(result)
  }

  /**
   * Add skill to user
   * @param {string|number} userId - User ID
   * @param {string|number} skillId - Skill ID
   * @param {string|number} levelId - Level ID (Стажер/Специалист/Мастер)
   * @returns {Promise<Object>} Created user skill binding
   */
  async addSkillToUser(userId, skillId, levelId) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('НавыкиПользователей')
    if (!types || types.length === 0) {
      throw new Error('Тип "НавыкиПользователей" не найден')
    }
    const userSkillsTypeId = types[0].id

    // Check if user already has this skill
    const existingSkills = await this.getUserSkills(userId)
    const hasSkill = existingSkills.some(s => s.req_skill === skillId)
    if (hasSkill) {
      throw new Error('Пользователь уже имеет этот навык')
    }

    const requisites = {
      user: userId,
      skill: skillId,
      level: levelId,
      execution_count: 0,
      acquisition_date: new Date().toISOString().split('T')[0]
    }

    return await integramService.createObject(
      userSkillsTypeId,
      `User ${userId} - Skill ${skillId}`,
      null,
      requisites
    )
  }

  // ============================================
  // Mentorship Management
  // ============================================

  /**
   * Get mentorships for user (as mentor or trainee)
   * @param {string|number} userId - User ID
   * @param {string} role - 'mentor' or 'trainee'
   * @returns {Promise<Array>} Array of mentorship connections
   */
  async getMentorships(userId, role = 'both') {
    await this.ensureInitialized()

    const types = await this.getTypeByName('СвязиНаставничества')
    if (!types || types.length === 0) {
      return []
    }
    const mentorshipTypeId = types[0].id

    let filters = {}
    if (role === 'mentor') {
      filters = { mentor: userId }
    } else if (role === 'trainee') {
      filters = { trainee: userId }
    }

    const integraFilters = integramService.buildFilters({ fields: filters })
    const result = await integramService.getObjects(mentorshipTypeId, integraFilters)
    const parsed = integramService.parseObjectList(result)

    // If role === 'both', get both mentor and trainee relationships
    if (role === 'both' && Object.keys(filters).length === 0) {
      // Get all mentorships where user is either mentor or trainee
      const allMentorships = parsed.objects || []
      return allMentorships.filter(m =>
        m.req_mentor === userId || m.req_trainee === userId
      )
    }

    return parsed.objects || []
  }

  /**
   * Get mentorship details by ID
   * @param {string|number} mentorshipId - Mentorship ID
   * @returns {Promise<Object>} Mentorship data
   */
  async getMentorship(mentorshipId) {
    await this.ensureInitialized()
    const result = await integramService.getEditObject(mentorshipId)
    return integramService.parseObjectForEdit(result)
  }

  /**
   * Assign mentor to trainee for a skill
   * @param {string|number} traineeId - Trainee user ID
   * @param {string|number} mentorId - Mentor user ID
   * @param {string|number} skillId - Skill ID
   * @returns {Promise<Object>} Created mentorship connection
   */
  async assignMentor(traineeId, mentorId, skillId) {
    await this.ensureInitialized()

    // Validation: trainee cannot be mentor to themselves
    if (traineeId === mentorId) {
      throw new Error('Стажер не может быть наставником сам себе')
    }

    // Check if mentor has the skill at Specialist or Master level
    const mentorSkills = await this.getUserSkills(mentorId)
    const mentorHasSkill = mentorSkills.some(s => {
      const levelName = s.req_level?.val || ''
      return s.req_skill === skillId &&
        (levelName.includes('Специалист') || levelName.includes('Мастер'))
    })

    if (!mentorHasSkill) {
      throw new Error('Наставник должен иметь навык уровня Специалист или Мастер')
    }

    // Check mentor's current trainees count (max 3)
    const mentorTrainees = await this.getMentorships(mentorId, 'mentor')
    const activeTrainees = mentorTrainees.filter(m => {
      const status = m.req_status?.val || ''
      return status.includes('Активно')
    })

    if (activeTrainees.length >= 3) {
      throw new Error('Наставник уже имеет максимальное количество стажеров (3)')
    }

    const types = await this.getTypeByName('СвязиНаставничества')
    if (!types || types.length === 0) {
      throw new Error('Тип "СвязиНаставничества" не найден')
    }
    const mentorshipTypeId = types[0].id

    // Get "Активно" status
    const activeStatus = await this.getMentorshipStatusByName('Активно')

    const requisites = {
      mentor: mentorId,
      trainee: traineeId,
      skill: skillId,
      start_date: new Date().toISOString().split('T')[0],
      status: activeStatus ? activeStatus.id : null,
      session_count: 0
    }

    return await integramService.createObject(
      mentorshipTypeId,
      `Mentor ${mentorId} - Trainee ${traineeId} - Skill ${skillId}`,
      null,
      requisites
    )
  }

  /**
   * Complete mentorship
   * @param {string|number} mentorshipId - Mentorship ID
   * @returns {Promise<Object>} Updated mentorship
   */
  async completeMentorship(mentorshipId) {
    await this.ensureInitialized()

    const mentorship = await this.getMentorship(mentorshipId)
    const completedStatus = await this.getMentorshipStatusByName('Завершено')

    const updateData = {
      value: mentorship.val,
      typeId: mentorship.typeId,
      reqs: {
        end_date: new Date().toISOString().split('T')[0],
        status: completedStatus ? completedStatus.id : null
      }
    }

    return await integramService.saveObject(mentorshipId, updateData)
  }

  /**
   * Find suitable mentors for a skill (algorithm 1:3)
   * @param {string|number} skillId - Skill ID
   * @param {number} maxTraineesPerMentor - Max trainees per mentor (default 3)
   * @returns {Promise<Array>} Array of suitable mentors with ratings
   */
  async findSuitableMentors(skillId, maxTraineesPerMentor = 3) {
    await this.ensureInitialized()

    // Get all user skills for this skill
    const types = await this.getTypeByName('НавыкиПользователей')
    if (!types || types.length === 0) {
      return []
    }
    const userSkillsTypeId = types[0].id

    const filters = integramService.buildFilters({
      fields: { skill: skillId }
    })

    const result = await integramService.getObjects(userSkillsTypeId, filters)
    const parsed = integramService.parseObjectList(result)
    const userSkills = parsed.objects || []

    // Filter users with Specialist or Master level
    const potentialMentors = userSkills.filter(us => {
      const levelName = us.req_level?.val || ''
      return levelName.includes('Специалист') || levelName.includes('Мастер')
    })

    // Calculate rating for each mentor
    const mentorCandidates = []

    for (const userSkill of potentialMentors) {
      const mentorId = userSkill.req_user

      // Get current trainees count
      const mentorships = await this.getMentorships(mentorId, 'mentor')
      const activeTrainees = mentorships.filter(m => {
        const status = m.req_status?.val || ''
        return status.includes('Активно')
      })

      // Skip if mentor already has max trainees
      if (activeTrainees.length >= maxTraineesPerMentor) {
        continue
      }

      // Calculate rating
      const levelName = userSkill.req_level?.val || ''
      let skillScore = 0
      if (levelName.includes('Мастер')) skillScore = 10
      else if (levelName.includes('Специалист')) skillScore = 5

      // Count successfully trained trainees (completed mentorships)
      const completedMentorships = mentorships.filter(m => {
        const status = m.req_status?.val || ''
        return status.includes('Завершено')
      })

      const successScore = completedMentorships.length * 2 // +2 per completed trainee

      // Calculate total rating
      const rating = skillScore + successScore

      // Get mentor profile
      const mentorProfile = await this.getUserProfile(mentorId)

      mentorCandidates.push({
        mentorId: mentorId,
        name: mentorProfile.val || 'Unknown',
        photo: mentorProfile.req_photo,
        skillLevel: levelName,
        currentTrainees: activeTrainees.length,
        maxTrainees: maxTraineesPerMentor,
        completedTrainees: completedMentorships.length,
        rating: rating,
        averageRating: 5 // Placeholder - would need actual feedback data
      })
    }

    // Sort by rating (descending) and return top 10
    return mentorCandidates
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10)
  }

  /**
   * Calculate time coefficient for user's skill
   * @param {string|number} userId - User ID
   * @param {string|number} skillId - Skill ID
   * @returns {Promise<number>} Time coefficient (+30%, +15%, or 0%)
   */
  async calculateTimeCoefficient(userId, skillId) {
    await this.ensureInitialized()

    // Get user's skill
    const userSkills = await this.getUserSkills(userId)
    const userSkill = userSkills.find(s => s.req_skill === skillId)

    if (!userSkill) {
      return 0.30 // No skill = +30% (trainee level)
    }

    const executionCount = userSkill.req_execution_count || 0

    if (executionCount < 5) {
      return 0.30 // 0-4 executions: +30%
    } else if (executionCount < 10) {
      return 0.15 // 5-9 executions: +15%
    } else {
      return 0 // 10+ executions: no coefficient (standard time)
    }
  }

  /**
   * Promote skill level if eligible
   * @param {string|number} userId - User ID
   * @param {string|number} skillId - Skill ID
   * @returns {Promise<Object>} Result with promotion status
   */
  async promoteSkillLevel(userId, skillId) {
    await this.ensureInitialized()

    // Get user's skill
    const userSkills = await this.getUserSkills(userId)
    const userSkill = userSkills.find(s => s.req_skill === skillId)

    if (!userSkill) {
      return { promoted: false, reason: 'Навык не найден у пользователя' }
    }

    const executionCount = userSkill.req_execution_count || 0
    const currentLevel = userSkill.req_level?.val || ''

    let newLevelName = null

    // Check promotion eligibility
    if (currentLevel.includes('Стажер') && executionCount >= 10) {
      newLevelName = 'Специалист'
    } else if (currentLevel.includes('Специалист') && executionCount >= 25) {
      newLevelName = 'Мастер'
    } else {
      return {
        promoted: false,
        reason: `Недостаточно выполнений: ${executionCount}. Требуется: ${currentLevel.includes('Стажер') ? 10 : 25}`
      }
    }

    // Get new level ID
    const newLevel = await this.getSkillLevelByName(newLevelName)
    if (!newLevel) {
      return { promoted: false, reason: 'Уровень не найден' }
    }

    // Update user skill level
    const updateData = {
      value: userSkill.val,
      typeId: userSkill.typeId,
      reqs: {
        level: newLevel.id
      }
    }

    await integramService.saveObject(userSkill.id, updateData)

    // Recalculate user rate
    await this.calculateRate(userId)

    // Create transaction record for rate increase
    // TODO: Implement transaction creation

    return {
      promoted: true,
      oldLevel: currentLevel,
      newLevel: newLevelName,
      message: `Поздравляем! Вы повышены до уровня ${newLevelName}!`
    }
  }

  /**
   * Check mentorship progress and promote if eligible
   * @param {string|number} mentorshipId - Mentorship ID
   * @returns {Promise<Object>} Result with actions taken
   */
  async checkMentorshipProgress(mentorshipId) {
    await this.ensureInitialized()

    const mentorship = await this.getMentorship(mentorshipId)
    const traineeId = mentorship.req_trainee
    const skillId = mentorship.req_skill

    // Get trainee's skill
    const traineeSkills = await this.getUserSkills(traineeId)
    const traineeSkill = traineeSkills.find(s => s.req_skill === skillId)

    if (!traineeSkill) {
      return { action: 'none', reason: 'Навык не найден у стажера' }
    }

    const executionCount = traineeSkill.req_execution_count || 0

    // Check if trainee is ready for promotion
    if (executionCount >= 10) {
      const promotionResult = await this.promoteSkillLevel(traineeId, skillId)

      if (promotionResult.promoted) {
        // Suggest completing mentorship
        return {
          action: 'suggest_completion',
          executionCount,
          promotionResult,
          message: 'Стажер готов к завершению наставничества'
        }
      }
    }

    return {
      action: 'continue',
      executionCount,
      remaining: 10 - executionCount,
      message: `Осталось выполнить задач: ${10 - executionCount}`
    }
  }

  /**
   * Calculate user rate based on skills
   * Algorithm:
   * - Base rate: 510 ₽/hour
   * - +10 ₽/hour for each skill at Specialist+ level
   * @param {string|number} userId - User ID
   * @returns {Promise<number>} Calculated rate
   */
  async calculateRate(userId) {
    await this.ensureInitialized()

    const BASE_RATE = 510
    const SKILL_BONUS = 10

    // Get user skills
    const userSkills = await this.getUserSkills(userId)

    // Count skills at Specialist or Master level
    const qualifiedSkills = userSkills.filter(s => {
      const levelName = s.req_level?.val || ''
      return levelName.includes('Специалист') || levelName.includes('Мастер')
    })

    const newRate = BASE_RATE + (qualifiedSkills.length * SKILL_BONUS)

    // Save new rate to database
    const types = await this.getTypeByName('Ставки')
    if (types && types.length > 0) {
      const ratesTypeId = types[0].id

      const requisites = {
        user: userId,
        rate: newRate,
        date: new Date().toISOString().split('T')[0],
        reason: 'Повышение уровня навыка'
      }

      await integramService.createObject(
        ratesTypeId,
        `User ${userId} - Rate ${newRate}`,
        null,
        requisites
      )
    }

    return newRate
  }

  // ============================================
  // Video Instructions Management
  // ============================================

  /**
   * Get videos with filters
   * @param {Object} filters - Filter criteria (skill, search, sort)
   * @returns {Promise<Array>} Array of video instructions
   */
  async getVideos(filters = {}) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('ВидеоИнструкции')
    if (!types || types.length === 0) {
      return []
    }
    const videosTypeId = types[0].id

    const integraFilters = integramService.buildFilters({
      fields: filters.fields || {}
    })

    const result = await integramService.getObjects(videosTypeId, integraFilters)
    const parsed = integramService.parseObjectList(result)

    return parsed.objects || []
  }

  /**
   * Get video by ID
   * @param {string|number} videoId - Video ID
   * @returns {Promise<Object>} Video data
   */
  async getVideo(videoId) {
    await this.ensureInitialized()
    const result = await integramService.getEditObject(videoId)
    return integramService.parseObjectForEdit(result)
  }

  /**
   * Add new video instruction
   * @param {Object} videoData - Video data
   * @returns {Promise<Object>} Created video
   */
  async addVideo(videoData) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('ВидеоИнструкции')
    if (!types || types.length === 0) {
      throw new Error('Тип "ВидеоИнструкции" не найден')
    }
    const videosTypeId = types[0].id

    const requisites = {
      skill: videoData.skillId,
      name: videoData.name,
      description: videoData.description,
      url: videoData.url,
      duration: videoData.duration,
      author: videoData.authorId
    }

    return await integramService.createObject(
      videosTypeId,
      videoData.name,
      null,
      requisites
    )
  }

  /**
   * Rate video usefulness
   * @param {string|number} videoId - Video ID
   * @param {string|number} userId - User ID
   * @param {boolean} isUseful - True if useful, false otherwise
   * @returns {Promise<Object>} Rating result
   */
  async rateVideo(videoId, userId, isUseful) {
    await this.ensureInitialized()

    // TODO: Implement rating system (requires separate table for ratings)
    // For now, return success
    return { success: true, isUseful }
  }

  /**
   * Get learning progress for user
   * @param {string|number} userId - User ID
   * @returns {Promise<Object>} Learning progress data
   */
  async getLearningProgress(userId) {
    await this.ensureInitialized()

    // Get user skills
    const userSkills = await this.getUserSkills(userId)

    // Get active mentorships
    const mentorships = await this.getMentorships(userId, 'trainee')
    const activeMentorships = mentorships.filter(m => {
      const status = m.req_status?.val || ''
      return status.includes('Активно')
    })

    // Get rate history
    const types = await this.getTypeByName('Ставки')
    let rateHistory = []
    if (types && types.length > 0) {
      const ratesTypeId = types[0].id
      const filters = integramService.buildFilters({
        fields: { user: userId }
      })
      const result = await integramService.getObjects(ratesTypeId, filters)
      const parsed = integramService.parseObjectList(result)
      rateHistory = (parsed.objects || []).sort((a, b) => {
        const dateA = new Date(a.req_date || 0)
        const dateB = new Date(b.req_date || 0)
        return dateA - dateB
      })
    }

    // Calculate progress for each skill
    const skillsProgress = userSkills.map(skill => {
      const levelName = skill.req_level?.val || ''
      const executionCount = skill.req_execution_count || 0

      let nextLevel = null
      let executionsNeeded = 0

      if (levelName.includes('Стажер')) {
        nextLevel = 'Специалист'
        executionsNeeded = Math.max(0, 10 - executionCount)
      } else if (levelName.includes('Специалист')) {
        nextLevel = 'Мастер'
        executionsNeeded = Math.max(0, 25 - executionCount)
      }

      return {
        skillId: skill.req_skill,
        skillName: skill.req_skill?.val || 'Unknown',
        currentLevel: levelName,
        nextLevel,
        executionCount,
        executionsNeeded,
        progress: nextLevel ? Math.min(100, (executionCount / (levelName.includes('Стажер') ? 10 : 25)) * 100) : 100
      }
    })

    return {
      skills: skillsProgress,
      activeMentorships: activeMentorships.length,
      rateHistory,
      currentRate: await this.getUserRate(userId)
    }
  }

  /**
   * Get AI recommendations for skill development
   * @param {string|number} userId - User ID
   * @returns {Promise<Object>} AI recommendations
   */
  async getAIRecommendations(userId) {
    await this.ensureInitialized()

    // Get user skills
    const userSkills = await this.getUserSkills(userId)

    // Get all available skills
    const allSkills = await this.getSkills()

    // Skills user doesn't have
    const userSkillIds = userSkills.map(s => s.req_skill)
    const availableSkills = allSkills.filter(s => !userSkillIds.includes(s.id))

    // Simple recommendation algorithm (can be enhanced with AI later)
    // Recommend skills with high base rate
    const recommendations = availableSkills
      .sort((a, b) => (b.req_base_rate || 0) - (a.req_base_rate || 0))
      .slice(0, 5)
      .map(skill => ({
        skillId: skill.id,
        skillName: skill.val,
        baseRate: skill.req_base_rate || 0,
        reason: `Высокая базовая ставка: ${skill.req_base_rate || 0} ₽/час`,
        estimatedIncome: `+${(skill.req_base_rate || 0) * 160} ₽/месяц` // Assuming 160 hours/month
      }))

    return {
      recommendations,
      message: 'Рекомендации основаны на базовых ставках навыков'
    }
  }

  // ============================================
  // Helper Methods for Mentorship and Skills
  // ============================================

  /**
   * Get mentorship status by name
   * @param {string} statusName - Status name (e.g., "Активно")
   * @returns {Promise<Object|null>} Status object or null
   */
  async getMentorshipStatusByName(statusName) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('СтатусыНаставничества')
    if (!types || types.length === 0) {
      return null
    }
    const statusTypeId = types[0].id

    const result = await integramService.getObjects(statusTypeId)
    const parsed = integramService.parseObjectList(result)

    const status = (parsed.objects || []).find(obj => obj.val === statusName)
    return status || null
  }

  /**
   * Get skill level by name
   * @param {string} levelName - Level name (e.g., "Специалист")
   * @returns {Promise<Object|null>} Level object or null
   */
  async getSkillLevelByName(levelName) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('УровниНавыков')
    if (!types || types.length === 0) {
      return null
    }
    const levelTypeId = types[0].id

    const result = await integramService.getObjects(levelTypeId)
    const parsed = integramService.parseObjectList(result)

    const level = (parsed.objects || []).find(obj => obj.val === levelName)
    return level || null
  }

  // ============================================
  // Financial System - Stage 5
  // ============================================

  /**
   * Calculate hourly rate for a user
   * Algorithm:
   * - Base rate: 510 ₽/hour
   * - +10 ₽/hour for each mastered skill (Специалист or Мастер level)
   * - Manager (Руководитель role): fixed 1000 ₽/hour
   *
   * @param {string|number} userId - User ID
   * @returns {Promise<Object>} Rate calculation result
   */
  async calculateRate(userId) {
    await this.ensureInitialized()

    const baseRate = 510
    const skillBonusPerSkill = 10
    const managerRate = 1000

    // Check if user has "Руководитель" role
    const userRoles = await this.getUserRoles(userId)
    const isManager = userRoles.some(roleBinding => {
      return roleBinding.req_role?.includes('Руководитель') ||
             roleBinding.role_name?.includes('Руководитель')
    })

    if (isManager) {
      return {
        rate: managerRate,
        reason: 'Фиксированная ставка руководителя',
        breakdown: {
          base: managerRate,
          skillBonus: 0,
          totalSkills: 0,
          masteredSkills: 0
        }
      }
    }

    // Get user skills
    const userSkills = await this.getUserSkills(userId)

    // Count skills at Специалист or Мастер level
    const masteredSkills = userSkills.filter(skill => {
      const level = skill.req_level || skill.level_name
      return level && (level.includes('Специалист') || level.includes('Мастер'))
    })

    const masteredCount = masteredSkills.length
    const skillBonus = masteredCount * skillBonusPerSkill
    const calculatedRate = baseRate + skillBonus

    return {
      rate: calculatedRate,
      reason: `Базовая ставка + ${masteredCount} освоенных навыков`,
      breakdown: {
        base: baseRate,
        skillBonus: skillBonus,
        totalSkills: userSkills.length,
        masteredSkills: masteredCount
      }
    }
  }

  /**
   * Update user rate and record in Ставки table
   * @param {string|number} userId - User ID
   * @param {number} newRate - New hourly rate
   * @param {string} reason - Reason for rate change
   * @returns {Promise<Object>} Created rate record
   */
  async updateUserRate(userId, newRate, reason) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('Ставки')
    if (!types || types.length === 0) {
      throw new Error('Тип "Ставки" не найден')
    }
    const rateTypeId = types[0].id

    const requisites = {
      user: userId,
      rate: newRate,
      set_date: new Date().toISOString().split('T')[0],
      reason: reason
    }

    const result = await integramService.createObject(
      rateTypeId,
      `Rate ${newRate} for user ${userId}`,
      null,
      requisites
    )

    return result
  }

  /**
   * Calculate payment for task execution
   * Algorithm:
   * 1. Get task and normative time
   * 2. Get executor and their rate
   * 3. Get actual execution time
   * 4. Apply level coefficient:
   *    - Trainee (< 5 executions): time × 1.30
   *    - Trainee (5-10 executions): time × 1.15
   *    - Specialist/Master: time × 1.0
   * 5. Get quality control results (3 levels)
   * 6. Apply quality coefficient:
   *    - All 3 levels passed first time: 1.0
   *    - 1 revision: 0.9
   *    - 2+ revisions: 0.8
   * 7. Calculate: payment = rate × adjusted_time × quality_coefficient
   * 8. Create transaction record
   * 9. Update user balance
   *
   * @param {string|number} taskExecutionId - Task execution record ID
   * @returns {Promise<Object>} Payment calculation result with transaction
   */
  async calculateTaskPayment(taskExecutionId) {
    await this.ensureInitialized()

    // Get task execution record
    const execution = await integramService.getEditObject(taskExecutionId)
    const executionData = integramService.parseObjectForEdit(execution)

    const taskId = executionData.reqs.task
    const executorId = executionData.reqs.executor
    const actualTime = executionData.reqs.actual_time || 0

    if (actualTime === 0) {
      throw new Error('Фактическое время выполнения не указано')
    }

    // Get task details for normative time
    const task = await this.getTask(taskId)
    const normativeTime = task.req_normative_time || actualTime

    // Get executor rate
    const rateCalc = await this.calculateRate(executorId)
    const executorRate = rateCalc.rate

    // Get user skills to determine level coefficient
    const userSkills = await this.getUserSkills(executorId)

    // Find if user is trainee for this task's skills
    const taskSkillIds = Array.isArray(task.req_required_skills)
      ? task.req_required_skills
      : [task.req_required_skills]

    let levelCoefficient = 1.0
    let levelReason = 'Специалист/Мастер'

    // Check if executor is trainee for any required skill
    for (const skillId of taskSkillIds) {
      const userSkill = userSkills.find(s => s.req_skill === skillId)
      if (userSkill) {
        const executionCount = userSkill.req_execution_count || 0
        const level = userSkill.req_level || userSkill.level_name

        if (level && level.includes('Стажер')) {
          if (executionCount < 5) {
            levelCoefficient = 1.30
            levelReason = 'Стажер (< 5 выполнений)'
          } else if (executionCount < 10) {
            levelCoefficient = 1.15
            levelReason = 'Стажер (5-10 выполнений)'
          }
          break
        }
      }
    }

    const adjustedTime = actualTime * levelCoefficient

    // Get quality control status
    // Count revisions from control status fields
    const controlLevel1 = executionData.reqs.control_status_level1
    const controlLevel2 = executionData.reqs.control_status_level2
    const controlLevel3 = executionData.reqs.control_status_level3

    let revisionCount = 0

    // Check each level for "Не пройден" status (indicates revision needed)
    if (controlLevel1 && controlLevel1.includes('Не пройден')) revisionCount++
    if (controlLevel2 && controlLevel2.includes('Не пройден')) revisionCount++
    if (controlLevel3 && controlLevel3.includes('Не пройден')) revisionCount++

    let qualityCoefficient = 1.0
    let qualityReason = 'Все проверки с первого раза'

    if (revisionCount === 1) {
      qualityCoefficient = 0.9
      qualityReason = '1 возврат на доработку'
    } else if (revisionCount >= 2) {
      qualityCoefficient = 0.8
      qualityReason = '2+ возврата на доработку'
    }

    // Calculate final payment
    const payment = executorRate * (adjustedTime / 60) * qualityCoefficient // Divide by 60 to convert minutes to hours

    // Create transaction
    const transaction = await this.createTransaction(
      executorId,
      payment,
      'Оплата за работу',
      taskId,
      `Задача #${taskId}: ${task.val}`
    )

    return {
      payment: payment,
      breakdown: {
        executorRate: executorRate,
        normativeTime: normativeTime,
        actualTime: actualTime,
        levelCoefficient: levelCoefficient,
        levelReason: levelReason,
        adjustedTime: adjustedTime,
        qualityCoefficient: qualityCoefficient,
        qualityReason: qualityReason,
        revisionCount: revisionCount
      },
      transaction: transaction
    }
  }

  /**
   * Create a financial transaction
   * @param {string|number} userId - User ID
   * @param {number} amount - Transaction amount (rubles)
   * @param {string} typeName - Transaction type name
   * @param {string|number} relatedTaskId - Related task ID (optional)
   * @param {string} description - Description
   * @returns {Promise<Object>} Created transaction
   */
  async createTransaction(userId, amount, typeName, relatedTaskId = null, description = '') {
    await this.ensureInitialized()

    const types = await this.getTypeByName('Транзакции')
    if (!types || types.length === 0) {
      throw new Error('Тип "Транзакции" не найден')
    }
    const transactionTypeId = types[0].id

    // Get transaction type reference
    const transactionType = await this.getTransactionTypeByName(typeName)
    if (!transactionType) {
      throw new Error(`Тип транзакции "${typeName}" не найден`)
    }

    // Get "Обработана" status
    const status = await this.getTransactionStatusByName('Обработана')

    const requisites = {
      user: userId,
      amount: amount,
      type: transactionType.id,
      date: new Date().toISOString(),
      status: status ? status.id : null,
      related_task: relatedTaskId
    }

    const result = await integramService.createObject(
      transactionTypeId,
      description || `${typeName}: ${amount} ₽`,
      null,
      requisites
    )

    // Update user balance
    await this.updateUserBalance(userId, amount)

    return result
  }

  /**
   * Get user balance
   * @param {string|number} userId - User ID
   * @returns {Promise<number>} Current balance
   */
  async getUserBalance(userId) {
    await this.ensureInitialized()

    // Get all transactions for user
    const transactions = await this.getTransactions(userId)

    // Sum all transaction amounts
    const balance = transactions.reduce((sum, trans) => {
      const amount = trans.req_amount || 0
      const type = trans.req_type || trans.type_name || ''

      // Subtract for withdrawal transactions, add for others
      if (type.includes('Вывод')) {
        return sum - Math.abs(amount)
      }
      return sum + amount
    }, 0)

    return balance
  }

  /**
   * Update user balance (internal method)
   * Note: Balance is calculated from transactions, not stored separately
   * This method is kept for API compatibility
   * @param {string|number} userId - User ID
   * @param {number} amount - Amount to add (positive) or subtract (negative)
   * @returns {Promise<number>} New balance
   */
  async updateUserBalance(userId, amount) {
    // Balance is calculated dynamically from transactions
    // No action needed here, just return new balance
    return await this.getUserBalance(userId)
  }

  /**
   * Get user transactions with optional filters
   * @param {string|number} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} List of transactions
   */
  async getTransactions(userId, filters = {}) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('Транзакции')
    if (!types || types.length === 0) {
      return []
    }
    const transactionTypeId = types[0].id

    const result = await integramService.getObjects(transactionTypeId)
    const parsed = integramService.parseObjectList(result)

    // Filter transactions by user
    let transactions = (parsed.objects || []).filter(trans => {
      return trans.req_user === userId || trans.user_id === userId
    })

    // Apply additional filters
    if (filters.type) {
      transactions = transactions.filter(t =>
        t.req_type === filters.type || t.type_name?.includes(filters.type)
      )
    }

    if (filters.startDate) {
      transactions = transactions.filter(t => {
        const transDate = t.req_date || t.date
        return transDate >= filters.startDate
      })
    }

    if (filters.endDate) {
      transactions = transactions.filter(t => {
        const transDate = t.req_date || t.date
        return transDate <= filters.endDate
      })
    }

    // Sort by date descending
    transactions.sort((a, b) => {
      const dateA = a.req_date || a.date || ''
      const dateB = b.req_date || b.date || ''
      return dateB.localeCompare(dateA)
    })

    return transactions
  }

  /**
   * Request withdrawal of funds
   * @param {string|number} userId - User ID
   * @param {number} amount - Amount to withdraw
   * @param {string} method - Withdrawal method
   * @param {Object} details - Payment details (card number, account, etc.)
   * @returns {Promise<Object>} Withdrawal transaction
   */
  async requestWithdrawal(userId, amount, method, details) {
    await this.ensureInitialized()

    // Check balance
    const balance = await this.getUserBalance(userId)
    if (balance < amount) {
      throw new Error(`Недостаточно средств. Баланс: ${balance} ₽, запрошено: ${amount} ₽`)
    }

    // Create withdrawal transaction with "В обработке" status
    const types = await this.getTypeByName('Транзакции')
    if (!types || types.length === 0) {
      throw new Error('Тип "Транзакции" не найден')
    }
    const transactionTypeId = types[0].id

    const transactionType = await this.getTransactionTypeByName('Вывод средств')
    const status = await this.getTransactionStatusByName('Ожидает обработки')

    const description = JSON.stringify({ method, ...details })

    const requisites = {
      user: userId,
      amount: -amount, // Negative for withdrawal
      type: transactionType ? transactionType.id : null,
      date: new Date().toISOString(),
      status: status ? status.id : null,
      related_task: null
    }

    const result = await integramService.createObject(
      transactionTypeId,
      `Вывод средств: ${amount} ₽ (${method})`,
      null,
      requisites
    )

    return result
  }

  /**
   * Register a technological improvement
   * @param {string|number} userId - Author user ID
   * @param {string|number} skillId - Related skill ID
   * @param {string} description - Improvement description
   * @param {number} normativeImprovement - Percentage improvement in normative time
   * @returns {Promise<Object>} Created improvement record
   */
  async registerImprovement(userId, skillId, description, normativeImprovement) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('ТехнологическиеУлучшения')
    if (!types || types.length === 0) {
      throw new Error('Тип "ТехнологическиеУлучшения" не найден')
    }
    const improvementTypeId = types[0].id

    // Get "На рассмотрении" status
    const status = await this.getImprovementStatusByName('На рассмотрении')

    const requisites = {
      author: userId,
      skill: skillId,
      description: description,
      normative_improvement: normativeImprovement,
      status: status ? status.id : null,
      creation_date: new Date().toISOString().split('T')[0],
      application_count: 0
    }

    const result = await integramService.createObject(
      improvementTypeId,
      description.substring(0, 50),
      null,
      requisites
    )

    return result
  }

  /**
   * Apply an improvement to a task execution
   * @param {string|number} improvementId - Improvement ID
   * @param {string|number} taskExecutionId - Task execution ID
   * @returns {Promise<Object>} Updated improvement record
   */
  async applyImprovement(improvementId, taskExecutionId) {
    await this.ensureInitialized()

    // Get improvement
    const improvement = await integramService.getEditObject(improvementId)
    const improvementData = integramService.parseObjectForEdit(improvement)

    // Increment application count
    const currentCount = improvementData.reqs.application_count || 0
    const newCount = currentCount + 1

    const updateData = {
      val: improvementData.val,
      reqs: {
        ...improvementData.reqs,
        application_count: newCount
      }
    }

    await integramService.saveObject(improvementId, updateData)

    // Check if improvement should be approved (7%+ improvement AND 5+ applications)
    const improvementPercent = improvementData.reqs.normative_improvement || 0
    if (improvementPercent >= 7 && newCount >= 5) {
      await this.approveImprovement(improvementId)
    }

    return {
      improvementId,
      newApplicationCount: newCount,
      autoApproved: improvementPercent >= 7 && newCount >= 5
    }
  }

  /**
   * Approve an improvement (change status to "Одобрено")
   * @param {string|number} improvementId - Improvement ID
   * @returns {Promise<Object>} Updated improvement record
   */
  async approveImprovement(improvementId) {
    await this.ensureInitialized()

    const improvement = await integramService.getEditObject(improvementId)
    const improvementData = integramService.parseObjectForEdit(improvement)

    // Get "Одобрено" status
    const approvedStatus = await this.getImprovementStatusByName('Одобрено')

    const updateData = {
      val: improvementData.val,
      reqs: {
        ...improvementData.reqs,
        status: approvedStatus ? approvedStatus.id : improvementData.reqs.status
      }
    }

    return await integramService.saveObject(improvementId, updateData)
  }

  /**
   * Calculate passive income for an improvement application
   * Formula: passive_income = (old_normative - new_normative) × average_rate × 0.1
   * @param {string|number} improvementId - Improvement ID
   * @param {string|number} taskExecutionId - Task execution ID where improvement was applied
   * @returns {Promise<Object>} Passive income calculation and transaction
   */
  async calculatePassiveIncome(improvementId, taskExecutionId) {
    await this.ensureInitialized()

    // Get improvement
    const improvement = await integramService.getEditObject(improvementId)
    const improvementData = integramService.parseObjectForEdit(improvement)

    const authorId = improvementData.reqs.author
    const improvementPercent = improvementData.reqs.normative_improvement || 0

    // Get task execution to find task and calculate time savings
    const execution = await integramService.getEditObject(taskExecutionId)
    const executionData = integramService.parseObjectForEdit(execution)

    const taskId = executionData.reqs.task
    const task = await this.getTask(taskId)
    const oldNormative = task.req_normative_time || 60 // Default 60 minutes

    // Calculate time savings
    const newNormative = oldNormative * (1 - improvementPercent / 100)
    const timeSavings = oldNormative - newNormative

    // Use average rate (assume 600 ₽/hour for simplicity, can be enhanced)
    const averageRate = 600

    // Calculate cost savings
    const costSavings = (timeSavings / 60) * averageRate

    // Author gets 10% of savings
    const passiveIncome = costSavings * 0.1

    // Create passive income transaction
    const transaction = await this.createTransaction(
      authorId,
      passiveIncome,
      'Пассивный доход',
      taskId,
      `Пассивный доход от улучшения #${improvementId}`
    )

    return {
      passiveIncome: passiveIncome,
      breakdown: {
        improvementPercent: improvementPercent,
        oldNormative: oldNormative,
        newNormative: newNormative,
        timeSavings: timeSavings,
        costSavings: costSavings,
        authorShare: 0.1
      },
      transaction: transaction
    }
  }

  /**
   * Get user improvements
   * @param {string|number} userId - User ID
   * @returns {Promise<Array>} List of improvements created by user
   */
  async getUserImprovements(userId) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('ТехнологическиеУлучшения')
    if (!types || types.length === 0) {
      return []
    }
    const improvementTypeId = types[0].id

    const result = await integramService.getObjects(improvementTypeId)
    const parsed = integramService.parseObjectList(result)

    // Filter by author
    const improvements = (parsed.objects || []).filter(imp => {
      return imp.req_author === userId || imp.author_id === userId
    })

    return improvements
  }

  /**
   * Get income statistics for a user
   * @param {string|number} userId - User ID
   * @param {string} period - Period ('month', 'quarter', 'year')
   * @returns {Promise<Object>} Income statistics
   */
  async getIncomeStats(userId, period = 'month') {
    await this.ensureInitialized()

    const now = new Date()
    let startDate

    switch (period) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const transactions = await this.getTransactions(userId, {
      startDate: startDate.toISOString()
    })

    let totalEarned = 0
    let workPayments = 0
    let passiveIncome = 0
    let withdrawals = 0

    transactions.forEach(trans => {
      const amount = trans.req_amount || 0
      const type = trans.req_type || trans.type_name || ''

      if (type.includes('Оплата за работу')) {
        workPayments += amount
        totalEarned += amount
      } else if (type.includes('Пассивный доход')) {
        passiveIncome += amount
        totalEarned += amount
      } else if (type.includes('Вывод')) {
        withdrawals += Math.abs(amount)
      }
    })

    return {
      period: period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      totalEarned: totalEarned,
      workPayments: workPayments,
      passiveIncome: passiveIncome,
      withdrawals: withdrawals,
      currentBalance: await this.getUserBalance(userId),
      transactionCount: transactions.length
    }
  }

  /**
   * Get AI financial recommendations for a user
   * Uses DeepSeek API through TokenBasedLLMCoordinator
   * @param {string|number} userId - User ID
   * @returns {Promise<Object>} AI recommendations
   */
  async getAIFinancialRecommendations(userId) {
    await this.ensureInitialized()

    // Get user data
    const userProfile = await this.getUserProfile(userId)
    const userSkills = await this.getUserSkills(userId)
    const rateCalc = await this.calculateRate(userId)
    const incomeStats = await this.getIncomeStats(userId, 'month')

    // Get all available skills
    const allSkills = await this.getSkills()
    const userSkillIds = userSkills.map(s => s.req_skill)
    const availableSkills = allSkills.filter(s => !userSkillIds.includes(s.id))

    // Simple recommendations (can be enhanced with actual AI later)
    const recommendations = []

    // Recommendation 1: Learn high-value skills
    if (availableSkills.length > 0) {
      const topSkills = availableSkills
        .sort((a, b) => (b.req_base_rate || 0) - (a.req_base_rate || 0))
        .slice(0, 3)

      recommendations.push({
        type: 'learn_skill',
        priority: 'high',
        title: 'Освойте высокооплачиваемые навыки',
        description: `Изучение навыков "${topSkills.map(s => s.val).join('", "')}" увеличит ваш доход на ${Math.round((topSkills[0].req_base_rate || 0) * 160)} ₽/месяц`,
        skills: topSkills.map(s => ({ id: s.id, name: s.val, rate: s.req_base_rate }))
      })
    }

    // Recommendation 2: Increase task volume
    if (incomeStats.workPayments < 50000) {
      recommendations.push({
        type: 'increase_volume',
        priority: 'medium',
        title: 'Увеличьте объем выполняемых задач',
        description: `При текущей ставке ${rateCalc.rate} ₽/час вы можете зарабатывать до ${rateCalc.rate * 160} ₽/месяц (при загрузке 160 часов)`,
        currentIncome: incomeStats.workPayments,
        potentialIncome: rateCalc.rate * 160
      })
    }

    // Recommendation 3: Become a mentor
    const masteredSkills = userSkills.filter(s => {
      const level = s.req_level || s.level_name
      return level && level.includes('Мастер')
    })

    if (masteredSkills.length > 0) {
      recommendations.push({
        type: 'become_mentor',
        priority: 'medium',
        title: 'Станьте наставником',
        description: 'У вас есть навыки уровня "Мастер". Станьте наставником и получайте дополнительный доход за обучение стажеров',
        masteredSkills: masteredSkills.length
      })
    }

    return {
      userId: userId,
      currentRate: rateCalc.rate,
      currentIncome: incomeStats.totalEarned,
      recommendations: recommendations,
      analysisDate: new Date().toISOString()
    }
  }

  // ============================================
  // Helper Methods for Financial System
  // ============================================

  /**
   * Get transaction type by name
   * @param {string} typeName - Type name (e.g., "Оплата за работу")
   * @returns {Promise<Object|null>} Type object or null
   */
  async getTransactionTypeByName(typeName) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('ТипыТранзакций')
    if (!types || types.length === 0) {
      return null
    }
    const typeId = types[0].id

    const result = await integramService.getObjects(typeId)
    const parsed = integramService.parseObjectList(result)

    const type = (parsed.objects || []).find(obj => obj.val === typeName)
    return type || null
  }

  /**
   * Get transaction status by name
   * @param {string} statusName - Status name (e.g., "Обработана")
   * @returns {Promise<Object|null>} Status object or null
   */
  async getTransactionStatusByName(statusName) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('СтатусыТранзакций')
    if (!types || types.length === 0) {
      return null
    }
    const statusTypeId = types[0].id

    const result = await integramService.getObjects(statusTypeId)
    const parsed = integramService.parseObjectList(result)

    const status = (parsed.objects || []).find(obj => obj.val === statusName)
    return status || null
  }

  /**
   * Get improvement status by name
   * @param {string} statusName - Status name (e.g., "Одобрено")
   * @returns {Promise<Object|null>} Status object or null
   */
  async getImprovementStatusByName(statusName) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('СтатусыУлучшений')
    if (!types || types.length === 0) {
      return null
    }
    const statusTypeId = types[0].id

    const result = await integramService.getObjects(statusTypeId)
    const parsed = integramService.parseObjectList(result)

    const status = (parsed.objects || []).find(obj => obj.val === statusName)
    return status || null
  }

  // ============================================
  // Stage 6: Quality Control & Project Management
  // ============================================

  /**
   * Submit task for quality control
   * @param {string|number} taskExecutionId - Task execution ID
   * @param {number} level - Control level (1, 2, or 3)
   * @param {Array<File>} photos - Photos/videos of result
   * @returns {Promise<Object>} Updated task execution
   */
  async submitForQualityControl(taskExecutionId, level, photos = []) {
    await this.ensureInitialized()

    const statusTypesAwaitCheck = await this.getControlStatusByName('Ожидает проверки')

    if (!statusTypesAwaitCheck) {
      throw new Error('Control status "Ожидает проверки" not found')
    }

    const updateData = {
      [`control_level${level}_status`]: statusTypesAwaitCheck.id,
      [`control_level${level}_date`]: new Date().toISOString()
    }

    if (photos && photos.length > 0) {
      updateData.result_photo = photos
    }

    return await integramService.updateObject(taskExecutionId, updateData)
  }

  /**
   * Perform quality control check
   * @param {string|number} taskExecutionId - Task execution ID
   * @param {number} level - Control level (1, 2, or 3)
   * @param {string} status - Status ("Пройден" or "Не пройден")
   * @param {number} rating - Quality rating (1-5)
   * @param {string} comment - Reviewer comment
   * @param {string|number} reviewerId - Reviewer user ID
   * @returns {Promise<Object>} Updated task execution
   */
  async performQualityControl(taskExecutionId, level, status, rating, comment, reviewerId) {
    await this.ensureInitialized()

    const controlStatus = await this.getControlStatusByName(status)

    if (!controlStatus) {
      throw new Error(`Control status "${status}" not found`)
    }

    const updateData = {
      [`control_level${level}_status`]: controlStatus.id,
      [`control_level${level}_comment`]: comment,
      [`control_level${level}_date`]: new Date().toISOString(),
      [`control_level${level}_reviewer`]: reviewerId
    }

    if (level === 3 && status === 'Пройден') {
      // Final approval - set quality rating
      updateData.quality_rating = rating
    }

    return await integramService.updateObject(taskExecutionId, updateData)
  }

  /**
   * Get quality control data for task execution
   * @param {string|number} taskExecutionId - Task execution ID
   * @returns {Promise<Object>} Quality control data
   */
  async getQualityControlData(taskExecutionId) {
    await this.ensureInitialized()

    const taskExecution = await integramService.getEditObject(taskExecutionId)
    const parsed = integramService.parseObjectForEdit(taskExecution)

    // Get task details
    const taskId = parsed.reqs?.task
    const task = taskId ? await this.getTask(taskId) : null

    // Get executor details
    const executorId = parsed.reqs?.executor
    const executor = executorId ? await this.getUserProfile(executorId) : null

    return {
      taskExecution: parsed,
      task,
      executor,
      qualityControl: {
        level1: {
          status: parsed.reqs?.control_level1_status,
          comment: parsed.reqs?.control_level1_comment,
          date: parsed.reqs?.control_level1_date,
          reviewer: parsed.reqs?.control_level1_reviewer
        },
        level2: {
          status: parsed.reqs?.control_level2_status,
          comment: parsed.reqs?.control_level2_comment,
          date: parsed.reqs?.control_level2_date,
          reviewer: parsed.reqs?.control_level2_reviewer
        },
        level3: {
          status: parsed.reqs?.control_level3_status,
          comment: parsed.reqs?.control_level3_comment,
          date: parsed.reqs?.control_level3_date,
          reviewer: parsed.reqs?.control_level3_reviewer
        },
        rating: parsed.reqs?.quality_rating,
        photos: parsed.reqs?.result_photo
      }
    }
  }

  /**
   * Get project management data
   * @param {string|number} projectId - Project ID
   * @returns {Promise<Object>} Project management data with metrics
   */
  async getProjectManagementData(projectId) {
    await this.ensureInitialized()

    const project = await this.getProject(projectId)
    const tasks = await this.getTasks({ project: projectId })
    const team = await this.getProjectTeam(projectId)
    const finances = await this.getProjectFinances(projectId)

    // Calculate progress
    const completedTasks = tasks.filter(t => t.status?.val === 'Завершена').length
    const progress = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0

    // Calculate team workload
    const teamWorkload = await Promise.all(
      team.map(async member => {
        const activeTasks = await this.getUserActiveTasks(member.id)
        return {
          ...member,
          activeTasks: activeTasks.length,
          workload: activeTasks.length
        }
      })
    )

    return {
      project,
      metrics: {
        progress,
        completedTasks,
        totalTasks: tasks.length,
        budget: project.reqs?.budget || 0,
        spent: finances.totalSpent || 0,
        teamSize: team.length
      },
      tasks,
      team: teamWorkload,
      finances
    }
  }

  /**
   * Get project risks
   * @param {string|number} projectId - Project ID
   * @returns {Promise<Array>} Array of project risks
   */
  async getProjectRisks(projectId) {
    await this.ensureInitialized()

    // Get all tasks
    const tasks = await this.getTasks({ project: projectId })

    const risks = []

    // Identify overdue tasks
    const now = new Date()
    const overdueTasks = tasks.filter(t => {
      if (!t.reqs?.deadline) return false
      const deadline = new Date(t.reqs.deadline)
      return deadline < now && t.status?.val !== 'Завершена'
    })

    if (overdueTasks.length > 0) {
      risks.push({
        type: 'schedule',
        level: 'high',
        description: `${overdueTasks.length} задач просрочены`,
        impact: 'Риск срыва сроков проекта',
        mitigation: 'Перераспределить задачи, добавить ресурсы'
      })
    }

    // Check for quality issues
    const qualityIssues = tasks.filter(t => t.reqs?.quality_rating && t.reqs.quality_rating < 3)
    if (qualityIssues.length > 0) {
      risks.push({
        type: 'quality',
        level: 'medium',
        description: `${qualityIssues.length} задач с низкой оценкой качества`,
        impact: 'Недовольство заказчика, требуется переделка',
        mitigation: 'Усилить контроль, провести дополнительное обучение'
      })
    }

    return risks
  }

  /**
   * Add risk to project
   * @param {string|number} projectId - Project ID
   * @param {string} description - Risk description
   * @param {string} level - Risk level (high/medium/low)
   * @param {number} probability - Probability (0-100)
   * @param {string} impact - Impact description
   * @returns {Promise<Object>} Created risk
   */
  async addRisk(projectId, description, level, probability, impact) {
    // For MVP, risks are calculated automatically
    // This method could be used for manual risk addition in future
    return {
      projectId,
      description,
      level,
      probability,
      impact,
      createdAt: new Date().toISOString()
    }
  }

  /**
   * Generate daily report
   * @param {string|number} projectId - Project ID
   * @param {string} date - Report date (YYYY-MM-DD)
   * @returns {Promise<Object>} Generated report
   */
  async generateDailyReport(projectId, date) {
    await this.ensureInitialized()

    const project = await this.getProject(projectId)
    const managementData = await this.getProjectManagementData(projectId)

    // Get tasks completed today
    const tasks = await this.getTasks({ project: projectId })
    const completedToday = tasks.filter(t => {
      if (!t.reqs?.completion_date) return false
      const completionDate = t.reqs.completion_date.split('T')[0]
      return completionDate === date && t.status?.val === 'Завершена'
    })

    // Get photos from completed tasks
    const photos = completedToday
      .map(t => t.reqs?.result_photo)
      .filter(p => p)
      .flat()

    // Generate report content (HTML)
    const content = `
      <h2>Ежедневный отчет: ${project.val}</h2>
      <p><strong>Дата:</strong> ${date}</p>

      <h3>Прогресс проекта</h3>
      <p>Выполнено задач: ${managementData.metrics.completedTasks} из ${managementData.metrics.totalTasks} (${Math.round(managementData.metrics.progress)}%)</p>

      <h3>Выполнено сегодня</h3>
      <ul>
        ${completedToday.map(t => `<li>${t.val}</li>`).join('')}
      </ul>

      <h3>Команда</h3>
      <p>Задействовано: ${managementData.team.length} исполнителей</p>

      <h3>Финансы</h3>
      <p>Бюджет: ${managementData.metrics.budget} руб.</p>
      <p>Потрачено: ${managementData.metrics.spent} руб.</p>
    `

    // Save report to INTEGRA
    const reportTypes = await this.getTypeByName('ЕжедневныеОтчеты')
    if (!reportTypes || reportTypes.length === 0) {
      throw new Error('Type "ЕжедневныеОтчеты" not found. Please run Stage 6 setup first.')
    }

    const reportTypeId = reportTypes[0].id
    const completedTaskIds = completedToday.map(t => t.id)

    const reportData = {
      project: projectId,
      date,
      content,
      completed_tasks: completedTaskIds,
      progress: Math.round(managementData.metrics.progress),
      sent_to_customer: 0
    }

    const result = await integramService.createObject(
      reportTypeId,
      `Отчет ${date}`,
      null,
      reportData
    )

    return {
      ...result,
      completedTasks: completedToday,
      photos
    }
  }

  /**
   * Get daily reports for project
   * @param {string|number} projectId - Project ID
   * @returns {Promise<Array>} Array of daily reports
   */
  async getDailyReports(projectId) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('ЕжедневныеОтчеты')
    if (!types || types.length === 0) {
      return []
    }
    const reportTypeId = types[0].id

    const filters = integramService.buildFilters({
      fields: { project: projectId }
    })

    const result = await integramService.getObjects(reportTypeId, filters)
    const parsed = integramService.parseObjectList(result)

    return parsed.objects || []
  }

  /**
   * Send report to customer via email
   * @param {string|number} reportId - Report ID
   * @returns {Promise<Object>} Result
   */
  async sendReportToCustomer(reportId) {
    // For MVP: mark as sent
    // In production: integrate with email service
    await this.ensureInitialized()

    const updateData = {
      sent_to_customer: 1
    }

    await integramService.updateObject(reportId, updateData)

    return {
      success: true,
      message: 'Report marked as sent (email integration pending)'
    }
  }

  /**
   * Get improvements for review
   * @returns {Promise<Array>} Improvements awaiting review
   */
  async getImprovementsForReview() {
    await this.ensureInitialized()

    const types = await this.getTypeByName('ТехнологическиеУлучшения')
    if (!types || types.length === 0) {
      return []
    }
    const improvementTypeId = types[0].id

    const reviewStatus = await this.getImprovementStatusByName('На рассмотрении')

    if (!reviewStatus) {
      return []
    }

    const filters = integramService.buildFilters({
      fields: { status: reviewStatus.id }
    })

    const result = await integramService.getObjects(improvementTypeId, filters)
    const parsed = integramService.parseObjectList(result)

    return parsed.objects || []
  }

  /**
   * Reject improvement
   * @param {string|number} improvementId - Improvement ID
   * @param {string} reason - Rejection reason
   * @returns {Promise<Object>} Updated improvement
   */
  async rejectImprovement(improvementId, reason) {
    await this.ensureInitialized()

    const rejectedStatus = await this.getImprovementStatusByName('Отклонено')

    if (!rejectedStatus) {
      throw new Error('Status "Отклонено" not found')
    }

    const updateData = {
      status: rejectedStatus.id,
      rejection_reason: reason
    }

    return await integramService.updateObject(improvementId, updateData)
  }

  /**
   * Get AI project analysis
   * @param {string|number} projectId - Project ID
   * @returns {Promise<Object>} AI analysis results
   */
  async getAIProjectAnalysis(projectId) {
    await this.ensureInitialized()

    const managementData = await this.getProjectManagementData(projectId)
    const risks = await this.getProjectRisks(projectId)

    // Placeholder for AI analysis
    // In production: call DeepSeek API via TokenBasedLLMCoordinator

    return {
      status: managementData.metrics.progress > 80 ? 'green' : managementData.metrics.progress > 50 ? 'yellow' : 'red',
      progress: managementData.metrics.progress,
      keyIssues: risks.map(r => r.description),
      recommendations: [
        'Перераспределить задачи между исполнителями',
        'Усилить контроль качества',
        'Провести дополнительное обучение команды'
      ]
    }
  }

  /**
   * Get AI resource optimization suggestions
   * @param {string|number} projectId - Project ID
   * @returns {Promise<Object>} Optimization suggestions
   */
  async getAIResourceOptimization(projectId) {
    await this.ensureInitialized()

    const managementData = await this.getProjectManagementData(projectId)

    // Find overloaded executors
    const overloaded = managementData.team.filter(m => m.workload > 3)

    // Find underutilized executors
    const underutilized = managementData.team.filter(m => m.workload < 1)

    return {
      overloadedExecutors: overloaded,
      underutilizedExecutors: underutilized,
      suggestions: [
        {
          type: 'reassign',
          from: overloaded[0]?.id,
          to: underutilized[0]?.id,
          tasks: 2,
          expectedSpeedup: '15%'
        }
      ]
    }
  }

  /**
   * Get control status by name
   * @param {string} statusName - Status name (e.g., "Пройден")
   * @returns {Promise<Object|null>} Status object or null
   */
  async getControlStatusByName(statusName) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('СтатусыКонтроля')
    if (!types || types.length === 0) {
      return null
    }
    const statusTypeId = types[0].id

    const result = await integramService.getObjects(statusTypeId)
    const parsed = integramService.parseObjectList(result)

    const status = (parsed.objects || []).find(obj => obj.val === statusName)
    return status || null
  }

  // ============================================
  // Construction Brigade Management
  // ============================================

  /**
   * Get all brigades for window installation
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Array of brigade objects
   */
  async getBrigades(filters = {}) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('Бригады')
    if (!types || types.length === 0) {
      return []
    }
    const brigadeTypeId = types[0].id

    const integramFilters = integramService.buildFilters(filters)
    const result = await integramService.getObjects(brigadeTypeId, integramFilters)
    const parsed = integramService.parseObjectList(result)

    return parsed.objects || []
  }

  /**
   * Get brigade by ID
   * @param {string|number} brigadeId - Brigade ID
   * @returns {Promise<Object>} Brigade object
   */
  async getBrigade(brigadeId) {
    await this.ensureInitialized()
    const result = await integramService.getEditObject(brigadeId)
    return integramService.parseObjectForEdit(result)
  }

  /**
   * Create new brigade
   * @param {Object} brigadeData - Brigade data (name, leader, members, specialization)
   * @returns {Promise<Object>} Created brigade object
   */
  async createBrigade(brigadeData) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('Бригады')
    if (!types || types.length === 0) {
      throw new Error('Тип "Бригады" не найден в базе данных')
    }
    const brigadeTypeId = types[0].id

    const requisites = {
      leader: brigadeData.leaderId,
      specialization: brigadeData.specialization,
      created_date: new Date().toISOString().split('T')[0]
    }

    if (brigadeData.members) {
      requisites.members = brigadeData.members
    }

    return await integramService.createObject(
      brigadeTypeId,
      brigadeData.name,
      null,
      requisites
    )
  }

  /**
   * Get customer requests for window installation
   * @param {Object} filters - Optional filters (status, date range, priority)
   * @returns {Promise<Array>} Array of request objects
   */
  async getCustomerRequests(filters = {}) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('ЗаявкиЗаказчиков')
    if (!types || types.length === 0) {
      return []
    }
    const requestTypeId = types[0].id

    const integramFilters = integramService.buildFilters(filters)
    const result = await integramService.getObjects(requestTypeId, integramFilters)
    const parsed = integramService.parseObjectList(result)

    return parsed.objects || []
  }

  /**
   * Get request by ID
   * @param {string|number} requestId - Request ID
   * @returns {Promise<Object>} Request object
   */
  async getRequest(requestId) {
    await this.ensureInitialized()
    const result = await integramService.getEditObject(requestId)
    return integramService.parseObjectForEdit(result)
  }

  /**
   * Create new customer request
   * @param {Object} requestData - Request data
   * @returns {Promise<Object>} Created request object
   */
  async createRequest(requestData) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('ЗаявкиЗаказчиков')
    if (!types || types.length === 0) {
      throw new Error('Тип "ЗаявкиЗаказчиков" не найден')
    }
    const requestTypeId = types[0].id

    const requisites = {
      customer: requestData.customerId,
      address: requestData.address,
      work_type: requestData.workType,
      priority: requestData.priority,
      desired_date: requestData.desiredDate,
      description: requestData.description,
      created_date: new Date().toISOString().split('T')[0],
      status: requestData.status || 'Новая'
    }

    return await integramService.createObject(
      requestTypeId,
      `Заявка ${requestData.customer}`,
      null,
      requisites
    )
  }

  /**
   * Update request status
   * @param {string|number} requestId - Request ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated request
   */
  async updateRequestStatus(requestId, status) {
    await this.ensureInitialized()

    const request = await this.getRequest(requestId)

    return await integramService.saveObject(requestId, {
      value: request.value,
      typeId: request.typeId,
      reqs: {
        ...request.requisites,
        status
      }
    })
  }

  /**
   * Get daily work schedule
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {Object} filters - Optional filters (brigadeId, status)
   * @returns {Promise<Array>} Array of scheduled tasks
   */
  async getDailySchedule(date, filters = {}) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('ПланРабот')
    if (!types || types.length === 0) {
      return []
    }
    const scheduleTypeId = types[0].id

    const integramFilters = integramService.buildFilters({
      fields: {
        scheduled_date: date,
        ...filters.fields
      }
    })

    const result = await integramService.getObjects(scheduleTypeId, integramFilters)
    const parsed = integramService.parseObjectList(result)

    return parsed.objects || []
  }

  /**
   * Create schedule entry
   * @param {Object} scheduleData - Schedule data
   * @returns {Promise<Object>} Created schedule entry
   */
  async createScheduleEntry(scheduleData) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('ПланРабот')
    if (!types || types.length === 0) {
      throw new Error('Тип "ПланРабот" не найден')
    }
    const scheduleTypeId = types[0].id

    const requisites = {
      request: scheduleData.requestId,
      brigade: scheduleData.brigadeId,
      scheduled_date: scheduleData.date,
      scheduled_time: scheduleData.time,
      estimated_duration: scheduleData.estimatedDuration,
      status: scheduleData.status || 'Запланировано',
      created_by: scheduleData.managerId
    }

    return await integramService.createObject(
      scheduleTypeId,
      `План на ${scheduleData.date}`,
      null,
      requisites
    )
  }

  /**
   * Get contractor scoring data
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Array of contractors with scores
   */
  async getContractorScoring(filters = {}) {
    await this.ensureInitialized()

    // Get contractors
    const types = await this.getTypeByName('Исполнители')
    if (!types || types.length === 0) {
      return []
    }
    const contractorTypeId = types[0].id

    const integramFilters = integramService.buildFilters(filters)
    const result = await integramService.getObjects(contractorTypeId, integramFilters)
    const parsed = integramService.parseObjectList(result)

    const contractors = parsed.objects || []

    // Get scoring data for each contractor
    const scoringTypes = await this.getTypeByName('СкорингИсполнителей')
    if (!scoringTypes || scoringTypes.length === 0) {
      return contractors
    }
    const scoringTypeId = scoringTypes[0].id

    // Enrich contractors with scoring data
    for (const contractor of contractors) {
      const scoringFilters = integramService.buildFilters({
        fields: { contractor: contractor.id }
      })

      const scoringResult = await integramService.getObjects(scoringTypeId, scoringFilters)
      const scoringParsed = integramService.parseObjectList(scoringResult)

      if (scoringParsed.objects && scoringParsed.objects.length > 0) {
        contractor.scoring = scoringParsed.objects[0]
      }
    }

    return contractors
  }

  /**
   * Calculate contractor score
   * @param {string|number} contractorId - Contractor ID
   * @returns {Promise<Object>} Score calculation result
   */
  async calculateContractorScore(contractorId) {
    await this.ensureInitialized()

    // Get contractor's completed tasks
    const completedTasks = await this.getContractorCompletedTasks(contractorId)

    // Calculate metrics
    const totalTasks = completedTasks.length
    const averageRating = totalTasks > 0
      ? completedTasks.reduce((sum, task) => sum + (task.rating || 0), 0) / totalTasks
      : 0

    const onTimeCount = completedTasks.filter(task => task.completed_on_time).length
    const onTimePercentage = totalTasks > 0 ? (onTimeCount / totalTasks) * 100 : 0

    const qualityScore = averageRating * 20 // Convert to 0-100 scale
    const punctualityScore = onTimePercentage
    const experienceScore = Math.min(totalTasks * 2, 100) // 2 points per task, max 100

    const totalScore = (qualityScore * 0.4 + punctualityScore * 0.3 + experienceScore * 0.3)

    return {
      contractorId,
      totalScore: Math.round(totalScore),
      metrics: {
        qualityScore: Math.round(qualityScore),
        punctualityScore: Math.round(punctualityScore),
        experienceScore: Math.round(experienceScore),
        totalTasks,
        averageRating: averageRating.toFixed(1),
        onTimePercentage: onTimePercentage.toFixed(1)
      }
    }
  }

  /**
   * Get contractor's completed tasks
   * @param {string|number} contractorId - Contractor ID
   * @returns {Promise<Array>} Array of completed tasks
   */
  async getContractorCompletedTasks(contractorId) {
    await this.ensureInitialized()

    const types = await this.getTypeByName('ВыполненныеРаботы')
    if (!types || types.length === 0) {
      return []
    }
    const completedTasksTypeId = types[0].id

    const filters = integramService.buildFilters({
      fields: { contractor: contractorId }
    })

    const result = await integramService.getObjects(completedTasksTypeId, filters)
    const parsed = integramService.parseObjectList(result)

    return parsed.objects || []
  }

  /**
   * Get dashboard metrics for construction management
   * @param {string} date - Date for metrics (optional, defaults to today)
   * @returns {Promise<Object>} Dashboard metrics
   */
  async getConstructionDashboardMetrics(date = null) {
    await this.ensureInitialized()

    const targetDate = date || new Date().toISOString().split('T')[0]

    // Get metrics in parallel
    const [newRequests, inProgressSchedule, activeBrigades, completedToday] = await Promise.all([
      this.getCustomerRequests({ fields: { status: 'Новая' } }),
      this.getDailySchedule(targetDate, { fields: { status: 'В работе' } }),
      this.getBrigades({ fields: { status: 'Активна' } }),
      this.getDailySchedule(targetDate, { fields: { status: 'Завершено' } })
    ])

    return {
      newRequests: newRequests.length,
      inProgress: inProgressSchedule.length,
      activeBrigades: activeBrigades.length,
      completedToday: completedToday.length
    }
  }

  /**
   * Get suitable brigades for a request
   * @param {Object} request - Request object
   * @returns {Promise<Array>} Array of suitable brigades with match scores
   */
  async getSuitableBrigades(request) {
    await this.ensureInitialized()

    const allBrigades = await this.getBrigades({ fields: { status: 'Активна' } })

    // Score each brigade based on specialization, availability, and performance
    const scoredBrigades = await Promise.all(
      allBrigades.map(async (brigade) => {
        let score = 0

        // Specialization match (40%)
        if (brigade.requisites?.specialization === request.work_type) {
          score += 40
        } else if (brigade.requisites?.specialization?.includes('Универсальная')) {
          score += 20
        }

        // Availability check (30%)
        const schedule = await this.getDailySchedule(request.desired_date, {
          fields: { brigade: brigade.id }
        })
        const availabilityScore = Math.max(0, 30 - (schedule.length * 10))
        score += availabilityScore

        // Performance rating (30%)
        if (brigade.requisites?.rating) {
          score += (brigade.requisites.rating / 5) * 30
        }

        return {
          ...brigade,
          matchScore: Math.round(score),
          availability: schedule.length === 0 ? 'Свободна' : `Занято: ${schedule.length} задач`
        }
      })
    )

    // Sort by match score descending
    return scoredBrigades.sort((a, b) => b.matchScore - a.matchScore)
  }
}

// Create singleton instance
const orbityService = new OrbityService()

export default orbityService
