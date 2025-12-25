/**
 * Torgi.gov.ru Proxy Server
 *
 * Простой HTTP сервер для проксирования запросов к torgi.gov.ru
 * Устанавливается на VPS с российским IP, который не заблокирован
 *
 * Issue #4594: Решение проблемы блокировки IP для torgi.gov.ru
 *
 * Установка на VPS:
 * 1. npm init -y
 * 2. npm install express axios
 * 3. node torgi-proxy-server.js
 *
 * Или через PM2:
 * pm2 start torgi-proxy-server.js --name torgi-proxy
 */

import express from 'express'
import axios from 'axios'

const app = express()
const PORT = process.env.TORGI_PROXY_PORT || 3333
const API_KEY = process.env.TORGI_PROXY_API_KEY || 'torgi-proxy-secret-key-2024'

// Middleware
app.use(express.json())

// Auth middleware
function checkAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid API key' })
  }
  next()
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Proxy endpoint for lot card
app.get('/api/lotcard/:lotId', checkAuth, async (req, res) => {
  const { lotId } = req.params

  try {
    const response = await axios.get(
      `https://torgi.gov.ru/new/api/public/lotcards/${lotId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'ru-RU,ru;q=0.9'
        },
        timeout: 30000
      }
    )

    res.json({
      success: true,
      data: response.data
    })
  } catch (error) {
    console.error(`Error fetching lot ${lotId}:`, error.message)
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
      status: error.response?.status
    })
  }
})

// Proxy endpoint for lot documents
app.get('/api/lotcard/:lotId/documents', checkAuth, async (req, res) => {
  const { lotId } = req.params

  // Try multiple endpoints
  const endpoints = [
    `https://torgi.gov.ru/new/api/public/lotcards/${lotId}/documents`,
    `https://torgi.gov.ru/new/api/public/lotcards/${lotId}/files`,
    `https://torgi.gov.ru/new/api/public/lotcards/${lotId}/attachments`
  ]

  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(endpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        timeout: 30000
      })

      if (response.data) {
        return res.json({
          success: true,
          endpoint,
          data: response.data
        })
      }
    } catch (error) {
      // Continue to next endpoint
    }
  }

  res.status(404).json({
    success: false,
    error: 'Documents not found at any endpoint'
  })
})

// Proxy endpoint for search
app.post('/api/search', checkAuth, async (req, res) => {
  try {
    const response = await axios.post(
      'https://torgi.gov.ru/new/api/public/lotcards/search',
      req.body,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    )

    res.json({
      success: true,
      data: response.data
    })
  } catch (error) {
    console.error('Search error:', error.message)
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message
    })
  }
})

// Generic proxy endpoint
app.all('/api/proxy', checkAuth, async (req, res) => {
  const { url, method = 'GET', data, headers: customHeaders } = req.body

  if (!url || !url.includes('torgi.gov.ru')) {
    return res.status(400).json({ error: 'Invalid URL - must be torgi.gov.ru' })
  }

  try {
    const response = await axios({
      url,
      method,
      data,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        ...customHeaders
      },
      timeout: 60000
    })

    res.json({
      success: true,
      status: response.status,
      data: response.data
    })
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
      status: error.response?.status
    })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Torgi Proxy Server running on port ${PORT}`)
  console.log(`API Key: ${API_KEY.substring(0, 10)}...`)
  console.log('')
  console.log('Endpoints:')
  console.log(`  GET  /health`)
  console.log(`  GET  /api/lotcard/:lotId`)
  console.log(`  GET  /api/lotcard/:lotId/documents`)
  console.log(`  POST /api/search`)
  console.log(`  ALL  /api/proxy`)
})
