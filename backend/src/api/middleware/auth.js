/**
 * Authentication & Authorization Middleware
 *
 * - API tokens (Bearer) для партнёров
 * - Webhook secrets для источников данных
 */

// Integram configuration
const INTEGRAM_SERVER = process.env.INTEGRAM_SERVER_URL || 'https://ai2o.ru'
const INTEGRAM_DB = 'fst'
const INTEGRAM_USERNAME = process.env.INTEGRAM_SYSTEM_USERNAME
const INTEGRAM_PASSWORD = process.env.INTEGRAM_SYSTEM_PASSWORD

// Webhook secrets (из переменных окружения)
const WEBHOOK_SECRETS = {
  egrul: process.env.WEBHOOK_SECRET_EGRUL || 'default-egrul-secret',
  rospatent: process.env.WEBHOOK_SECRET_ROSPATENT || 'default-rospatent-secret',
  hh: process.env.WEBHOOK_SECRET_HH || 'default-hh-secret',
}

// Cache для Integram токенов
let integramTokenCache = {
  token: null,
  xsrf: null,
  expiresAt: 0
}

/**
 * Авторизация в Integram API
 */
async function authenticateIntegram() {
  try {
    // Проверяем кеш (токены живут ~1 час)
    if (integramTokenCache.token && Date.now() < integramTokenCache.expiresAt) {
      return integramTokenCache
    }

    // Integram auth возвращает 302 с Set-Cookie: {db}=<token>, не JSON
    const response = await fetch(`${INTEGRAM_SERVER}/${INTEGRAM_DB}/auth`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        login: INTEGRAM_USERNAME,
        pwd: INTEGRAM_PASSWORD
      })
    })

    // 302 = успех, токен в Set-Cookie
    if (response.status !== 302) {
      throw new Error(`Integram auth failed: ${response.status}`)
    }

    // Извлекаем токен из Set-Cookie: {db}=<token>
    const setCookies = response.headers.getSetCookie?.() || []
    let token = null
    for (const c of setCookies) {
      const m = c.match(new RegExp(`^${INTEGRAM_DB}=([^;]+)`))
      if (m) { token = m[1]; break }
    }
    if (!token) throw new Error('Integram auth: no token in Set-Cookie')

    // Получаем _xsrf через /xsrf endpoint
    const xsrfRes = await fetch(`${INTEGRAM_SERVER}/${INTEGRAM_DB}/xsrf`, {
      headers: { 'X-Authorization': token, 'Cookie': `${INTEGRAM_DB}=${token}` }
    })
    const xsrfData = xsrfRes.ok ? await xsrfRes.json() : {}

    integramTokenCache = {
      token,
      xsrf: xsrfData._xsrf || '',
      expiresAt: Date.now() + 55 * 60 * 1000 // 55 минут
    }

    console.log('[Auth] Integram authentication successful')
    return integramTokenCache

  } catch (error) {
    console.error('[Auth] Integram auth error:', error.message)
    throw new Error('Failed to authenticate with Integram')
  }
}

/**
 * Middleware: Проверка API токена партнёра
 *
 * Токены хранятся в Integram (type 1195: API Tokens)
 * Format: Bearer <token>
 */
export async function authenticateApiToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header. Expected: Bearer <token>'
      })
    }

    const token = authHeader.substring(7) // Remove 'Bearer '

    // Авторизуемся в Integram
    const { token: integramToken } = await authenticateIntegram()

    // Проверяем токен в БД (type 1195: API Tokens)
    const API_TOKENS_TYPE = 1195
    const response = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_d_req/${API_TOKENS_TYPE}?JSON_KV&l=100`,
      {
        headers: { 'X-Authorization': integramToken }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch API tokens: ${response.status}`)
    }

    const tokens = await response.json()

    // Ищем токен в БД
    const validToken = tokens.find(t => t.token === token || t.t1196 === token)

    if (!validToken) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API token'
      })
    }

    // Проверяем, что токен активен
    if (validToken.active === false || validToken.r1199 === false) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'API token is disabled'
      })
    }

    // Добавляем информацию о партнёре в request
    req.partner = {
      id: validToken.id,
      name: validToken.name || validToken.t1197 || 'Unknown Partner',
      permissions: validToken.permissions || validToken.t1198 || 'read'
    }

    next()

  } catch (error) {
    console.error('[Auth] Token validation error:', error.message)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate API token'
    })
  }
}

/**
 * Middleware: Проверка webhook secret
 *
 * Secret передаётся в заголовке X-Webhook-Secret
 */
export function validateWebhookSecret(req, res, next) {
  try {
    const webhookSecret = req.headers['x-webhook-secret']

    if (!webhookSecret) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing X-Webhook-Secret header'
      })
    }

    // Определяем источник по пути (egrul, rospatent, hh)
    const source = req.path.split('/').pop()

    if (!WEBHOOK_SECRETS[source]) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Unknown webhook source: ${source}`
      })
    }

    if (webhookSecret !== WEBHOOK_SECRETS[source]) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid webhook secret'
      })
    }

    req.webhookSource = source
    next()

  } catch (error) {
    console.error('[Auth] Webhook validation error:', error.message)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate webhook secret'
    })
  }
}

/**
 * Экспорт функции для получения Integram токена
 * (используется в route handlers)
 */
export { authenticateIntegram }
