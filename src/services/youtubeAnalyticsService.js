/**
 * YouTube Analytics API Service
 *
 * Service для взаимодействия с YouTube Analytics API
 * Tokens are now cached client-side and sent with each request
 */

import { useYouTubeStore } from '../stores/youtubeStore'
import { getApiUrl } from '../utils/apiConfig'

const API_BASE_URL = getApiUrl('/api/youtube')

/**
 * Get headers with tokens for API requests
 * @private
 * @returns {Object} Headers object with Content-Type and tokens
 */
function getRequestHeaders() {
  const youtubeStore = useYouTubeStore()
  const headers = {
    'Content-Type': 'application/json'
  }

  // Add tokens if available
  try {
    const tokens = youtubeStore.getTokensForRequest()
    if (tokens.youtube_token) {
      headers['X-YouTube-Token'] = tokens.youtube_token
    }
    if (tokens.bot_token) {
      headers['X-Bot-Token'] = tokens.bot_token
    }
  } catch (error) {
    console.warn('No cached tokens available for request:', error.message)
  }

  return headers
}

/**
 * Получить статистику канала
 * @param {string} channelId - ID канала или @username
 * @returns {Promise<Object>} Статистика канала
 */
export async function getChannelStats(channelId) {
  const response = await fetch(`${API_BASE_URL}/channel/stats`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({ channel_id: channelId })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}: ${response.statusText}` }))
    throw new Error(error.detail || 'Failed to fetch channel stats')
  }

  return response.json()
}

/**
 * Получить последние видео канала
 * @param {string} channelId - ID канала или @username
 * @param {number} maxResults - Максимальное количество видео (0 = все видео)
 * @returns {Promise<Object>} Список видео
 */
export async function getRecentVideos(channelId, maxResults = 0) {
  const response = await fetch(`${API_BASE_URL}/channel/videos`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      channel_id: channelId,
      max_results: maxResults
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || `Failed to fetch recent videos for channel: ${channelId}`)
  }

  const data = await response.json()

  // Log a warning if videos are returned but missing expected fields
  if (data.videos && Array.isArray(data.videos)) {
    const firstVideoWithoutDuration = data.videos.find(v => !v.duration)
    if (firstVideoWithoutDuration) {
      console.warn('Warning: Some videos are missing the "duration" field. This may cause display issues.')
    }
  }

  return data
}

/**
 * Анализ производительности канала
 * @param {string} channelId - ID канала или @username
 * @param {number} days - Период анализа в днях
 * @returns {Promise<Object>} Анализ производительности
 */
export async function getChannelPerformance(channelId, days = 30) {
  const response = await fetch(`${API_BASE_URL}/channel/performance`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      channel_id: channelId,
      days: days
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const errorMessage = error.detail || `Failed to analyze channel: ${channelId}`
    throw new Error(errorMessage)
  }

  const data = await response.json()

  // Validate critical fields are present
  if (data && typeof data === 'object') {
    if (data.videos_in_period === undefined) {
      console.warn('Warning: Channel performance data is missing "videos_in_period" field')
    }
    if (data.engagement_rate === undefined) {
      console.warn('Warning: Channel performance data is missing "engagement_rate" field')
    }
  }

  return data
}

/**
 * Сравнить несколько каналов
 * @param {Array<string>} channelIds - Список ID каналов или @username
 * @param {number} days - Период анализа в днях
 * @returns {Promise<Object>} Сравнительный анализ
 */
export async function compareChannels(channelIds, days = 30) {
  const response = await fetch(`${API_BASE_URL}/channels/compare`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      channel_ids: channelIds,
      days: days
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}: ${response.statusText}` }))
    throw new Error(error.detail || 'Failed to compare channels')
  }

  return response.json()
}

/**
 * Отправить тестовое уведомление в Telegram
 * @param {string} chatId - Telegram Chat ID
 * @returns {Promise<Object>} Результат отправки
 */
export async function sendTestNotification(chatId) {
  const response = await fetch(getApiUrl('/api/telegram/test'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ chat_id: chatId })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}: ${response.statusText}` }))
    throw new Error(error.detail || 'Failed to send test notification')
  }

  return response.json()
}

/**
 * Отправить уведомление в Telegram
 * @param {string} chatId - Telegram Chat ID
 * @param {string} message - Текст сообщения
 * @returns {Promise<Object>} Результат отправки
 */
export async function sendTelegramNotification(chatId, message) {
  const response = await fetch(getApiUrl('/api/telegram/send'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      message: message
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}: ${response.statusText}` }))
    throw new Error(error.detail || 'Failed to send notification')
  }

  return response.json()
}

/**
 * Получить VPD (Views Per Day) метрики для канала
 * @param {string} channelId - ID канала или @username
 * @param {number} maxVideos - Максимальное количество видео для анализа (0 = все видео)
 * @returns {Promise<Object>} VPD метрики и трендовые видео
 */
export async function getVPDMetrics(channelId, maxVideos = 0) {
  const response = await fetch(`${API_BASE_URL}/advanced/vpd-metrics`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      channel_id: channelId,
      max_videos: maxVideos
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}: ${response.statusText}` }))
    throw new Error(error.detail || 'Failed to fetch VPD metrics')
  }

  return response.json()
}

/**
 * Рассчитать дельту между двумя снимками данных
 * @param {Object} currentData - Текущие данные
 * @param {Object} previousData - Предыдущие данные
 * @returns {Promise<Object>} Дельта метрик
 */
export async function calculateDeltaMetrics(currentData, previousData) {
  const response = await fetch(`${API_BASE_URL}/advanced/delta-metrics`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      current_data: currentData,
      previous_data: previousData
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}: ${response.statusText}` }))
    throw new Error(error.detail || 'Failed to calculate delta metrics')
  }

  return response.json()
}

/**
 * Генерировать алерты на основе настраиваемых порогов
 * @param {string} channelId - ID канала или @username
 * @param {Object} thresholds - Пороги для алертов
 * @param {number} maxVideos - Максимальное количество видео для анализа (0 = все видео)
 * @returns {Promise<Object>} Сгенерированные алерты
 */
export async function generateAlerts(channelId, thresholds = {}, maxVideos = 0) {
  const defaultThresholds = {
    vpd_spike_threshold: 10000,
    low_er_threshold: 0.5,
    low_vpd_threshold: 100
  }

  const response = await fetch(`${API_BASE_URL}/advanced/generate-alerts`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      channel_id: channelId,
      max_videos: maxVideos,
      thresholds: { ...defaultThresholds, ...thresholds }
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}: ${response.statusText}` }))
    throw new Error(error.detail || 'Failed to generate alerts')
  }

  return response.json()
}

/**
 * Получить трендовые видео на основе VPD
 * @param {string} channelId - ID канала или @username
 * @param {number} maxVideos - Максимальное количество видео для анализа (0 = все видео)
 * @returns {Promise<Object>} Трендовые видео
 */
export async function getTrendingVideos(channelId, maxVideos = 0) {
  const response = await fetch(`${API_BASE_URL}/advanced/trending-videos`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      channel_id: channelId,
      max_videos: maxVideos
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}: ${response.statusText}` }))
    throw new Error(error.detail || 'Failed to fetch trending videos')
  }

  return response.json()
}

/**
 * Получить KPI метрики канала
 * @param {string} channelId - ID канала или @username
 * @param {number} maxVideos - Максимальное количество видео для анализа (0 = все видео)
 * @returns {Promise<Object>} KPI метрики
 */
export async function getChannelKPIs(channelId, maxVideos = 0) {
  const response = await fetch(`${API_BASE_URL}/advanced/kpis`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      channel_id: channelId,
      max_videos: maxVideos
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}: ${response.statusText}` }))
    throw new Error(error.detail || 'Failed to fetch channel KPIs')
  }

  return response.json()
}

/**
 * Получить рекомендации для канала
 * @param {string} channelId - ID канала или @username
 * @param {number} maxVideos - Максимальное количество видео для анализа (0 = все видео)
 * @returns {Promise<Object>} Рекомендации
 */
export async function getChannelRecommendations(channelId, maxVideos = 0) {
  const response = await fetch(`${API_BASE_URL}/advanced/recommendations`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      channel_id: channelId,
      max_videos: maxVideos
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}: ${response.statusText}` }))
    throw new Error(error.detail || 'Failed to fetch channel recommendations')
  }

  return response.json()
}

/**
 * Получить комментарии для видео
 * @param {string} videoId - ID видео YouTube
 * @param {number} maxResults - Максимальное количество комментариев
 * @param {string} order - Порядок сортировки ('relevance' или 'time')
 * @returns {Promise<Object>} Комментарии видео
 */
export async function getVideoComments(videoId, maxResults = 100, order = 'relevance') {
  const response = await fetch(`${API_BASE_URL}/video/comments`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      video_id: videoId,
      max_results: maxResults,
      order: order
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}: ${response.statusText}` }))
    throw new Error(error.detail || `Failed to fetch comments for video: ${videoId}`)
  }

  return response.json()
}

/**
 * Получить комментарии для нескольких видео
 * @param {Array<string>} videoIds - Массив ID видео YouTube
 * @param {number} commentsPerVideo - Количество комментариев на видео
 * @returns {Promise<Object>} Комментарии всех видео
 */
export async function getMultipleVideosComments(videoIds, commentsPerVideo = 50) {
  const response = await fetch(`${API_BASE_URL}/videos/comments`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      video_ids: videoIds,
      comments_per_video: commentsPerVideo
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}: ${response.statusText}` }))
    throw new Error(error.detail || 'Failed to fetch comments for videos')
  }

  return response.json()
}
