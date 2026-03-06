/**
 * Генератор уникальных временных имен пользователей
 * Используется для создания пользователей на этапе 1 customer journey
 */

/**
 * Генерирует уникальное временное имя пользователя
 * Формат: temp_XXXXXX где X - случайные символы
 * @returns {string} Временное имя пользователя
 */
export function generateTempUsername() {
  // Генерируем случайную строку из 8 символов
  const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase()
  const timestamp = Date.now().toString(36).toUpperCase()

  // Возвращаем временное имя в формате temp_TIMESTAMP_RANDOM
  return `temp_${timestamp}_${randomPart}`
}

/**
 * Генерирует уникальный fingerprint браузера
 * Может использоваться как альтернатива для временного ID
 * @returns {string} Browser fingerprint
 */
export function generateBrowserFingerprint() {
  const nav = window.navigator
  const screen = window.screen

  const fingerprint = [
    nav.userAgent,
    nav.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage
  ].join('|')

  // Простой хеш функция для преобразования fingerprint в короткую строку
  let hash = 0
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Конвертация в 32bit integer
  }

  return `browser_${Math.abs(hash).toString(36).toUpperCase()}`
}

/**
 * Проверяет, является ли username временным
 * @param {string} username
 * @returns {boolean}
 */
export function isTempUsername(username) {
  return username && (username.startsWith('temp_') || username.startsWith('browser_'))
}
