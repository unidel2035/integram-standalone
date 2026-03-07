/**
 * News Parser (Yandex News)
 *
 * Мониторинг новостных упоминаний портфельных компаний
 * Sentiment analysis для оценки репутационных рисков
 *
 * Источники:
 * - Яндекс.Новости RSS: https://news.yandex.ru/
 * - Альтернатива: парсинг через поисковую выдачу
 *
 * Sentiment analysis через YandexGPT или локальную модель
 */

import fetch from 'node-fetch'
import { SocksProxyAgent } from 'socks-proxy-agent'

const SOCKS_PROXY = process.env.SOCKS_PROXY || 'socks5://127.0.0.1:9050'
const YANDEX_NEWS_SEARCH = 'https://news.yandex.ru/search'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

// YandexGPT API для sentiment analysis
const YANDEX_API_KEY = process.env.YANDEX_API_KEY || ''
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID || ''

/**
 * Поиск новостей о компании
 * @param {string} companyName - Название компании
 * @param {number} days - Период поиска (дней назад)
 * @returns {Promise<Object>} Данные о новостных упоминаниях
 */
export async function fetchCompanyNews(companyName, days = 30) {
  try {
    const agent = new SocksProxyAgent(SOCKS_PROXY)

    // Поиск новостей
    const searchUrl = `${YANDEX_NEWS_SEARCH}?text=${encodeURIComponent(companyName)}`

    const response = await fetch(searchUrl, {
      agent,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html'
      },
      timeout: 10000
    })

    if (!response.ok) {
      console.warn(`[News] Search failed for ${companyName}: ${response.status}`)
      return buildEmptyResult(companyName)
    }

    // В реальной реализации здесь парсинг HTML
    // Для MVP используем упрощённую структуру
    const newsItems = await parseMockNews(companyName, days)

    // Анализ sentiment для каждой новости
    const newsWithSentiment = await analyzeSentiment(newsItems)

    // Общий анализ
    const analysis = analyzeNews(newsWithSentiment, days)

    return {
      companyName,
      period: `${days} days`,
      found: newsItems.length > 0,
      newsCount: newsItems.length,
      news: newsWithSentiment,
      analysis,
      lastUpdate: new Date().toISOString()
    }

  } catch (error) {
    console.error(`[News] Error fetching news for ${companyName}:`, error.message)
    return {
      companyName,
      error: error.message,
      found: false,
      newsCount: 0,
      lastUpdate: new Date().toISOString()
    }
  }
}

/**
 * Парсинг новостей (mock для MVP)
 * В продакшне заменить на реальный парсинг Яндекс.Новостей или RSS
 */
async function parseMockNews(companyName, days) {
  // Мок-данные для демонстрации структуры
  const mockNews = [
    {
      title: `${companyName} представила новую линейку продуктов`,
      url: 'https://example.com/news1',
      source: 'РБК',
      publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      snippet: 'Компания анонсировала выход на новый рынок...'
    },
    {
      title: `${companyName} получила контракт на 50 млн рублей`,
      url: 'https://example.com/news2',
      source: 'Ведомости',
      publishedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      snippet: 'Государственный контракт на поставку оборудования...'
    }
  ]

  return mockNews
}

/**
 * Анализ sentiment новостей через YandexGPT
 */
async function analyzeSentiment(newsItems) {
  const newsWithSentiment = []

  for (const item of newsItems) {
    try {
      // Если нет API ключа, используем простую эвристику
      if (!YANDEX_API_KEY) {
        item.sentiment = detectSimpleSentiment(item.title + ' ' + item.snippet)
      } else {
        item.sentiment = await detectSentimentWithYandex(item.title + ' ' + item.snippet)
      }

      newsWithSentiment.push(item)
    } catch (error) {
      console.error('[News] Sentiment analysis error:', error.message)
      item.sentiment = { score: 0, label: 'neutral' }
      newsWithSentiment.push(item)
    }
  }

  return newsWithSentiment
}

/**
 * Простая эвристика для определения sentiment без API
 */
function detectSimpleSentiment(text) {
  const lowerText = text.toLowerCase()

  const positiveWords = [
    'успех', 'рост', 'контракт', 'победа', 'достижение', 'инновация',
    'прорыв', 'расширение', 'инвестиции', 'партнерство', 'награда'
  ]

  const negativeWords = [
    'проблема', 'убыток', 'кризис', 'банкротство', 'срыв', 'скандал',
    'штраф', 'иск', 'отставка', 'закрытие', 'увольнение'
  ]

  let positiveCount = 0
  let negativeCount = 0

  positiveWords.forEach(word => {
    if (lowerText.includes(word)) positiveCount++
  })

  negativeWords.forEach(word => {
    if (lowerText.includes(word)) negativeCount++
  })

  if (positiveCount > negativeCount) {
    return { score: 1, label: 'positive', confidence: 0.6 }
  } else if (negativeCount > positiveCount) {
    return { score: -1, label: 'negative', confidence: 0.6 }
  } else {
    return { score: 0, label: 'neutral', confidence: 0.5 }
  }
}

/**
 * Анализ sentiment через YandexGPT API
 */
async function detectSentimentWithYandex(text) {
  try {
    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${YANDEX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelUri: `gpt://${YANDEX_FOLDER_ID}/yandexgpt-lite`,
        completionOptions: {
          temperature: 0.1,
          maxTokens: 50
        },
        messages: [
          {
            role: 'system',
            text: 'Определи sentiment текста: positive, negative или neutral. Ответь одним словом.'
          },
          {
            role: 'user',
            text: text
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`YandexGPT API error: ${response.status}`)
    }

    const data = await response.json()
    const sentimentLabel = data.result.alternatives[0].message.text.trim().toLowerCase()

    let score = 0
    if (sentimentLabel.includes('positive')) score = 1
    else if (sentimentLabel.includes('negative')) score = -1

    return {
      score,
      label: sentimentLabel,
      confidence: 0.8
    }

  } catch (error) {
    console.error('[News] YandexGPT sentiment error:', error.message)
    // Fallback на простую эвристику
    return detectSimpleSentiment(text)
  }
}

/**
 * Анализ новостного фона компании
 */
function analyzeNews(newsItems, days) {
  if (newsItems.length === 0) {
    return {
      overall: 'neutral',
      score: 0,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      frequency: 0,
      insights: [{
        level: 'ok',
        message: 'Нет упоминаний в СМИ за период.'
      }]
    }
  }

  // Подсчёт по sentiment
  const positiveCount = newsItems.filter(n => n.sentiment.score > 0).length
  const negativeCount = newsItems.filter(n => n.sentiment.score < 0).length
  const neutralCount = newsItems.filter(n => n.sentiment.score === 0).length

  // Средний sentiment score
  const avgScore = newsItems.reduce((sum, n) => sum + n.sentiment.score, 0) / newsItems.length

  // Общая оценка
  let overall = 'neutral'
  if (avgScore > 0.3) overall = 'positive'
  else if (avgScore < -0.3) overall = 'negative'

  // Частота упоминаний
  const frequency = (newsItems.length / days).toFixed(1)

  return {
    overall,
    score: avgScore.toFixed(2),
    positiveCount,
    negativeCount,
    neutralCount,
    frequency,
    insights: generateNewsInsights(overall, newsItems.length, positiveCount, negativeCount, frequency)
  }
}

/**
 * Генерация инсайтов по новостному фону
 */
function generateNewsInsights(overall, total, positive, negative, frequency) {
  const insights = []

  // Инсайты по общему sentiment
  if (overall === 'positive') {
    insights.push({
      level: 'ok',
      message: `Позитивный новостной фон (${positive} позитивных из ${total}).`
    })
  } else if (overall === 'negative') {
    insights.push({
      level: 'warn',
      message: `Негативный новостной фон (${negative} негативных из ${total}). Риск репутации.`
    })
  } else {
    insights.push({
      level: 'ok',
      message: 'Нейтральный новостной фон.'
    })
  }

  // Инсайты по частоте
  if (frequency > 1) {
    insights.push({
      level: 'ok',
      message: `Высокая медиа-активность: ${frequency} упоминаний/день.`
    })
  } else if (frequency < 0.1 && total > 0) {
    insights.push({
      level: 'ok',
      message: 'Низкая медиа-активность (редкие упоминания).'
    })
  }

  return insights
}

/**
 * Построение пустого результата
 */
function buildEmptyResult(companyName) {
  return {
    companyName,
    found: false,
    newsCount: 0,
    news: [],
    analysis: {
      overall: 'neutral',
      score: 0,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      frequency: 0,
      insights: []
    },
    lastUpdate: new Date().toISOString()
  }
}

/**
 * Мониторинг новостей для списка компаний
 * @param {Array<Object>} companies - Массив компаний с полями {id, name}
 * @param {number} days - Период мониторинга (дней)
 * @returns {Promise<Array<Object>>} Массив результатов мониторинга новостей
 */
export async function monitorCompaniesNews(companies, days = 30) {
  console.log(`[News Monitor] Starting news monitoring for ${companies.length} companies (${days} days)`)

  const results = []

  for (const company of companies) {
    try {
      console.log(`[News Monitor] Processing ${company.name}`)

      const newsData = await fetchCompanyNews(company.name, days)

      const result = {
        companyId: company.id,
        companyName: company.name,
        timestamp: new Date().toISOString(),
        news: newsData,
        alerts: []
      }

      // Генерируем алерты при негативном фоне
      if (newsData.analysis && newsData.analysis.overall === 'negative') {
        result.alerts.push({
          level: 'warn',
          type: 'negative_media',
          message: `Негативный новостной фон: ${newsData.analysis.negativeCount} негативных публикаций.`
        })
      }

      // Алерт при очень высокой негативной активности
      if (newsData.analysis && newsData.analysis.negativeCount >= 5) {
        result.alerts.push({
          level: 'critical',
          type: 'media_crisis',
          message: `Медиа-кризис: ${newsData.analysis.negativeCount} негативных публикаций. Требуется PR-реагирование.`
        })
      }

      results.push(result)

      // Задержка между запросами
      await sleep(2000)

    } catch (error) {
      console.error(`[News Monitor] Error processing ${company.name}:`, error.message)
      results.push({
        companyId: company.id,
        companyName: company.name,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    }
  }

  console.log(`[News Monitor] Completed. Processed ${results.length} companies`)

  return results
}

/**
 * Утилита для задержки
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default {
  fetchCompanyNews,
  monitorCompaniesNews
}
