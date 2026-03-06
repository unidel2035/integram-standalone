/**
 * User Integram Service
 * Работа с пользователями через Integram API
 */

import axios from 'axios'
import { generateBrowserFingerprint } from '@/utils/tempUserGenerator'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/**
 * Создает гостевого пользователя в БД с привязкой к браузеру
 * @param {string} referralCode - Опциональный реферальный код
 * @returns {Promise<{userId: string, username: string, browserFingerprint: string}>}
 */
export async function createTempUser(referralCode = null) {
  try {
    // Генерируем уникальное имя на основе browser fingerprint
    const browserFingerprint = generateBrowserFingerprint()
    const tempUsername = `guest_${browserFingerprint}`

    console.log('🔍 Создаём гостевого пользователя через backend API:', tempUsername)

    // Вызываем backend API для создания пользователя
    const response = await axios.post(
      `${API_BASE_URL}/guest-users`,
      {
        username: tempUsername,
        browserFingerprint,
        referralCode
      }
    )

    if (!response.data.success) {
      throw new Error(response.data.error || 'Unknown error')
    }

    const { userId, username } = response.data.data

    console.log('✅ Создан гостевой пользователь:', username, 'ID:', userId)

    // Сохраняем ID пользователя в localStorage для повторного использования
    localStorage.setItem('guestUserId', userId)
    localStorage.setItem('guestUsername', username)
    localStorage.setItem('browserFingerprint', browserFingerprint)

    return {
      userId,
      username,
      browserFingerprint
    }
  } catch (error) {
    console.error('❌ Ошибка создания гостевого пользователя:', error)
    throw new Error('Не удалось создать гостевого пользователя: ' + error.message)
  }
}

/**
 * Обновляет гостевого пользователя реальными данными и меняет роль на user
 * @param {string} userId - ID пользователя в БД
 * @param {Object} userData - Данные пользователя
 * @param {string} userData.username - Логин
 * @param {string} userData.email - Email
 * @param {string} userData.password - Пароль
 * @param {string} userData.name - Имя
 * @returns {Promise<boolean>}
 */
export async function updateTempUserWithRealData(userId, userData) {
  try {
    console.log('🔄 Обновление гостя на реального пользователя:', userId)

    // Вызываем backend API для обновления пользователя
    const response = await axios.put(
      `${API_BASE_URL}/guest-users/${userId}`,
      userData
    )

    if (!response.data.success) {
      throw new Error(response.data.error || 'Unknown error')
    }

    console.log('✅ Пользователь обновлён:', userId, '→', userData.username, '(guest → user)')

    // Очищаем localStorage от гостевых данных
    localStorage.removeItem('guestUserId')
    localStorage.removeItem('guestUsername')

    return true
  } catch (error) {
    console.error('❌ Ошибка обновления пользователя:', error)
    throw new Error('Не удалось обновить пользователя: ' + error.message)
  }
}

/**
 * Получает или создаёт гостевого пользователя
 * Если гость уже существует в localStorage, возвращает его
 * Иначе создаёт нового
 * @param {string} referralCode - Опциональный реферальный код
 * @returns {Promise<{userId: string, username: string, browserFingerprint: string, isExisting: boolean}>}
 */
export async function getOrCreateGuestUser(referralCode = null) {
  // Проверяем, есть ли уже гостевой пользователь
  const existingUserId = localStorage.getItem('guestUserId')
  const existingUsername = localStorage.getItem('guestUsername')
  const existingFingerprint = localStorage.getItem('browserFingerprint')

  // Валидация: userId не должен быть 18 (это ID таблицы User, не пользователя)
  // и должен быть больше 100000 (реальные ID пользователей)
  const isValidUserId = existingUserId &&
    parseInt(existingUserId) !== 18 &&
    parseInt(existingUserId) > 100000

  if (isValidUserId && existingUsername) {
    console.log('👤 Найден существующий гостевой пользователь:', existingUsername, 'ID:', existingUserId)
    return {
      userId: existingUserId,
      username: existingUsername,
      browserFingerprint: existingFingerprint,
      isExisting: true
    }
  }

  // Очистка некорректных данных
  if (existingUserId && !isValidUserId) {
    console.warn('⚠️ Обнаружен некорректный guestUserId:', existingUserId, '- создаём нового пользователя')
    localStorage.removeItem('guestUserId')
    localStorage.removeItem('guestUsername')
    localStorage.removeItem('browserFingerprint')
  }

  // Создаём нового гостя
  console.log('➕ Создание нового гостевого пользователя...')
  const newGuest = await createTempUser(referralCode)
  return {
    ...newGuest,
    isExisting: false
  }
}

/**
 * Получает данные пользователя из БД
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object>}
 */
export async function getUserData(userId) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/guest-users/${userId}`
    )

    if (!response.data.success) {
      throw new Error(response.data.error || 'Unknown error')
    }

    return response.data.data
  } catch (error) {
    console.error('❌ Ошибка получения данных пользователя:', error)
    throw new Error('Не удалось получить данные пользователя: ' + error.message)
  }
}
