/**
 * Сервис для работы с организациями в Integram
 * Интеграция с таблицей "Организация" (typeId: 197000)
 *
 * Использует /api/customer-journey endpoints (публичный API, не требует авторизации)
 */

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8082/api'

// ID таблицы Организация в Integram
const ORGANIZATION_TABLE_ID = 197000

// ID реквизитов (полей) таблицы Организация
const REQUISITES = {
  DESCRIPTION: '197002',      // Описание организации
  TITLE: '197004',            // Заголовок
  DATE: '197006',             // Дата
  DB: '197010',               // DB (multiple)
  ICON: '197017',             // Иконка
  USER: '198172',             // User (связь с пользователем)
  INN: '198195',              // ИНН
  INDUSTRY: '209388',         // Отрасль (справочник)
  MONTHLY_SALARIES: '209399', // Ежемесячные затраты на зарплаты
  EMPLOYEE_COUNT: '209401',   // Количество сотрудников
  ARCHIVED: '238051'          // Архивирована (boolean)
}

/**
 * Получить организацию по ID с полными данными (включая счётчики)
 * @param {number|string} organizationId - ID организации
 * @returns {Promise<Object|null>} Организация с membersCount, rolesCount, workspacesCount
 */
export async function getOrganizationById(organizationId) {
  try {
    console.log('🏢 Загрузка организации по ID:', organizationId)

    const response = await axios.get(
      `${API_BASE_URL}/customer-journey/organizations/${organizationId}`
    )

    if (response.data.success) {
      console.log('✅ Организация загружена:', response.data.data)
      return response.data.data
    }

    return null
  } catch (error) {
    console.error('❌ Ошибка получения организации:', error)
    return null
  }
}

/**
 * Получить список организаций с фильтрацией и пагинацией
 * @param {Object} options - Параметры запроса
 * @param {string} options.search - Поисковый запрос
 * @param {number} options.page - Номер страницы (начиная с 1)
 * @param {number} options.limit - Количество на странице
 * @param {boolean} options.includeArchived - Включать архивированные
 * @returns {Promise<{data: Array, pagination: Object}>} Организации и метаданные пагинации
 */
export async function getOrganizations(options = {}) {
  try {
    const { search = '', page = 1, limit = 50, includeArchived = false } = options
    console.log('🏢 Загрузка списка организаций...', { search, page, limit, includeArchived })

    const params = new URLSearchParams()
    if (search) params.append('search', search)
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    params.append('includeArchived', includeArchived.toString())

    const response = await axios.get(
      `${API_BASE_URL}/customer-journey/organizations?${params.toString()}`
    )

    if (response.data.success) {
      console.log('✅ Организации загружены:', response.data.data.length, 'pagination:', response.data.pagination)
      return {
        data: response.data.data || [],
        pagination: response.data.pagination || { page: 1, totalItems: 0, totalPages: 1 }
      }
    }

    return { data: [], pagination: { page: 1, totalItems: 0, totalPages: 1 } }
  } catch (error) {
    console.error('❌ Ошибка получения списка организаций:', error)
    return { data: [], pagination: { page: 1, totalItems: 0, totalPages: 1 } }
  }
}

/**
 * Привязать организацию к пользователю
 * @param {string} userId - ID пользователя в Integram
 * @param {string} organizationId - ID организации из справочника
 * @returns {Promise<Object>} Результат привязки
 */
export async function linkOrganizationToUser(userId, organizationId) {
  try {
    console.log('🔗 Привязка организации к пользователю:', { userId, organizationId })

    const response = await axios.post(
      `${API_BASE_URL}/customer-journey/organizations/link`,
      {
        userId,
        organizationId
      }
    )

    if (response.data.success) {
      console.log('✅ Организация привязана:', response.data.data)
      return response.data.data
    } else {
      throw new Error(response.data.error || 'Failed to link organization')
    }
  } catch (error) {
    console.error('❌ Ошибка привязки организации:', error)
    throw error
  }
}

/**
 * Получить организацию пользователя
 * @param {string} userId - ID пользователя в Integram
 * @returns {Promise<Object|null>} Организация или null
 */
export async function getUserOrganization(userId) {
  try {
    console.log('🔍 Поиск организации для пользователя:', userId)

    const response = await axios.get(
      `${API_BASE_URL}/customer-journey/organizations/user/${userId}`
    )

    if (response.data.success && response.data.data) {
      console.log('✅ Найдена организация:', response.data.data)
      return response.data.data
    }

    console.log('ℹ️ Организация не найдена для пользователя:', userId)
    return null
  } catch (error) {
    if (error.response?.status === 404) {
      return null
    }
    console.error('❌ Ошибка получения организации:', error)
    throw error
  }
}

/**
 * Получить список всех отраслей
 * @returns {Promise<Array>} Список отраслей
 */
export async function getIndustries() {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/customer-journey/industries`
    )

    if (response.data.success) {
      return response.data.data || []
    }

    return []
  } catch (error) {
    console.error('❌ Ошибка получения списка отраслей:', error)
    return []
  }
}

/**
 * Привязать выбранную организацию к пользователю
 * @param {string} organizationId - ID организации из справочника
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object>} Результат привязки
 */
export async function saveUserOrganization(organizationId, userId) {
  return await linkOrganizationToUser(userId, organizationId)
}

/**
 * Создать организацию в Integram (таблица 197000)
 * @param {Object} organization - Данные организации
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object>} Созданная организация
 */
export async function createOrganization(organization, userId) {
  try {
    console.log('🏢 Создание организации в Integram:', organization.name)

    const response = await axios.post(
      `${API_BASE_URL}/customer-journey/organizations`,
      {
        name: organization.name,
        inn: organization.inn,
        ogrn: organization.ogrn,
        kpp: organization.kpp,
        address: organization.address,
        industry: organization.industry,
        region: organization.region,
        employeeCount: organization.employeeCount,
        userId: userId
      }
    )

    if (response.data.success) {
      console.log('✅ Организация создана:', response.data.data)
      return response.data.data
    } else {
      throw new Error(response.data.error || 'Failed to create organization')
    }
  } catch (error) {
    console.error('❌ Ошибка создания организации:', error)
    throw error
  }
}

/**
 * Получить список агентов для онбординга
 * @returns {Promise<Array>} Список агентов из отчета agent_onboarding
 */
export async function getOnboardingAgents() {
  try {
    console.log('🤖 Загрузка агентов для онбординга...')

    const response = await axios.get(
      `${API_BASE_URL}/customer-journey/agents`
    )

    if (response.data.success) {
      console.log('✅ Агенты загружены:', response.data.data.length)
      return response.data.data || []
    }

    return []
  } catch (error) {
    console.error('❌ Ошибка получения списка агентов:', error)
    return []
  }
}

/**
 * Удалить организацию (жёсткое удаление)
 * @param {string} organizationId - ID организации
 * @returns {Promise<Object>} Результат удаления
 */
export async function deleteOrganization(organizationId) {
  try {
    console.log('🗑️ Удаление организации:', organizationId)

    const response = await axios.delete(
      `${API_BASE_URL}/customer-journey/organizations/${organizationId}`
    )

    if (response.data.success) {
      console.log('✅ Организация удалена:', organizationId)
      return response.data
    } else {
      throw new Error(response.data.error || 'Failed to delete organization')
    }
  } catch (error) {
    console.error('❌ Ошибка удаления организации:', error)
    throw error
  }
}

/**
 * Архивировать организацию (мягкое удаление)
 * @param {string} organizationId - ID организации
 * @returns {Promise<Object>} Результат архивации
 */
export async function archiveOrganization(organizationId) {
  try {
    console.log('📦 Архивация организации:', organizationId)

    const response = await axios.patch(
      `${API_BASE_URL}/customer-journey/organizations/${organizationId}/archive`,
      { archived: true }
    )

    if (response.data.success) {
      console.log('✅ Организация архивирована:', organizationId)
      return response.data
    } else {
      throw new Error(response.data.error || 'Failed to archive organization')
    }
  } catch (error) {
    console.error('❌ Ошибка архивации организации:', error)
    throw error
  }
}

/**
 * Восстановить организацию из архива
 * @param {string} organizationId - ID организации
 * @returns {Promise<Object>} Результат восстановления
 */
export async function unarchiveOrganization(organizationId) {
  try {
    console.log('📤 Восстановление организации:', organizationId)

    const response = await axios.patch(
      `${API_BASE_URL}/customer-journey/organizations/${organizationId}/archive`,
      { archived: false }
    )

    if (response.data.success) {
      console.log('✅ Организация восстановлена:', organizationId)
      return response.data
    } else {
      throw new Error(response.data.error || 'Failed to unarchive organization')
    }
  } catch (error) {
    console.error('❌ Ошибка восстановления организации:', error)
    throw error
  }
}
