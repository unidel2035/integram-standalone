#!/usr/bin/env node
/**
 * FST API JavaScript SDK Example
 *
 * Пример использования REST API Фонда Суверенных Технологий (ФСТ)
 *
 * Установка зависимостей:
 *    npm install node-fetch  # для Node.js < 18
 *    # Node.js >= 18 имеет встроенный fetch
 *
 * Использование:
 *    export FST_API_TOKEN="your_api_token_here"
 *    node javascript_example.js
 */

// Для Node.js < 18 раскомментируйте:
// import fetch from 'node-fetch'

/**
 * Клиент для работы с FST REST API
 */
class FSTClient {
  /**
   * Инициализация клиента
   *
   * @param {string} apiToken - API токен для аутентификации (получить: unidel@yandex.ru)
   * @param {string} baseUrl - Базовый URL API (по умолчанию production)
   */
  constructor(apiToken, baseUrl = 'https://dev.drondoc.ru') {
    this.apiToken = apiToken
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'FST-JavaScript-SDK/1.0.0'
    }
  }

  /**
   * Внутренний метод для выполнения запросов
   * @private
   */
  async _request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(`API Error (${response.status}): ${error.message || error.error}`)
    }

    return response.json()
  }

  /**
   * Получить список портфельных компаний
   *
   * @returns {Promise<Object>} Объект с полями: total, companies, timestamp
   */
  async getPortfolio() {
    return this._request('/api/fst/portfolio')
  }

  /**
   * Получить детали портфельной компании
   *
   * @param {number} companyId - ID компании
   * @returns {Promise<Object>} Объект с детальной информацией о компании
   */
  async getCompany(companyId) {
    return this._request(`/api/fst/company/${companyId}`)
  }

  /**
   * Получить агрегированные KPI портфеля
   *
   * @returns {Promise<Object>} Объект с KPI всего портфеля
   */
  async getKPIs() {
    return this._request('/api/fst/kpis')
  }

  /**
   * Подать заявку на финансирование
   *
   * @param {Object} application - Данные заявки
   * @param {string} application.companyName - Название компании
   * @param {string} application.inn - ИНН компании
   * @param {string} application.description - Описание проекта
   * @param {number} application.requestedAmount - Запрашиваемая сумма (руб.)
   * @param {string} [application.ogrn] - ОГРН (опционально)
   * @param {number} [application.trl] - Technology Readiness Level 1-9 (опционально)
   * @param {number} [application.sovereignty] - Индекс суверенности 0-10 (опционально)
   * @param {string} [application.contactEmail] - Email для связи (опционально)
   * @param {string} [application.contactPhone] - Телефон (опционально)
   * @param {string} [application.source='api'] - Источник заявки
   * @returns {Promise<Object>} Объект с applicationId и статусом
   */
  async submitApplication(application) {
    return this._request('/api/fst/apply', {
      method: 'POST',
      body: JSON.stringify({
        source: 'api',
        ...application
      })
    })
  }

  /**
   * Проверить статус заявки
   *
   * @param {number} applicationId - ID заявки
   * @returns {Promise<Object>} Объект со статусом заявки и результатами рассмотрения
   */
  async getApplicationStatus(applicationId) {
    return this._request(`/api/fst/application/${applicationId}`)
  }

  /**
   * Проверка работоспособности API (не требует токена)
   *
   * @returns {Promise<Object>} Объект со статусом сервиса
   */
  async healthCheck() {
    const response = await fetch(`${this.baseUrl}/api/fst/health`)
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`)
    }
    return response.json()
  }
}

// Примеры использования
async function main() {
  // Получаем API токен из переменных окружения
  const API_TOKEN = process.env.FST_API_TOKEN

  if (!API_TOKEN) {
    console.error('Error: FST_API_TOKEN environment variable not set')
    console.error('Usage: export FST_API_TOKEN="your_token" && node javascript_example.js')
    process.exit(1)
  }

  // Инициализируем клиент
  const client = new FSTClient(API_TOKEN)

  console.log('='.repeat(60))
  console.log('FST API JavaScript SDK - Примеры использования')
  console.log('='.repeat(60))

  try {
    // 1. Health check (не требует токена)
    console.log('\n1. Health Check:')
    const health = await client.healthCheck()
    console.log(`   Status: ${health.status}`)
    console.log(`   Service: ${health.service} v${health.version}`)

    // 2. Получить список портфеля
    console.log('\n2. Portfolio Companies:')
    try {
      const portfolio = await client.getPortfolio()
      console.log(`   Total companies: ${portfolio.total}`)
      portfolio.companies.slice(0, 3).forEach(company => {
        console.log(`   - ${company.name} (INN: ${company.inn})`)
        console.log(`     Health: ${company.healthScore} (${company.trafficLight})`)
      })
    } catch (error) {
      console.log(`   Error: ${error.message}`)
    }

    // 3. Получить KPI портфеля
    console.log('\n3. Portfolio KPIs:')
    try {
      const kpis = await client.getKPIs()
      console.log(`   Total companies: ${kpis.totalCompanies}`)
      console.log(`   Average health score: ${kpis.averageHealthScore}`)
      const tl = kpis.trafficLightDistribution
      console.log(`   Traffic lights: 🟢 ${tl.green} 🟡 ${tl.yellow} 🔴 ${tl.red}`)
      console.log(`   Total patents: ${kpis.totalPatents}`)
    } catch (error) {
      console.log(`   Error: ${error.message}`)
    }

    // 4. Подать заявку (закомментировано, чтобы не создавать реальные заявки)
    console.log('\n4. Submit Application (example - commented out):')
    console.log(`
    const application = await client.submitApplication({
      companyName: "ИнноТех",
      inn: "7729123456",
      ogrn: "1177746123456",
      description: "Разработка инновационных БПЛА для гражданского применения",
      requestedAmount: 50_000_000,
      trl: 6,
      sovereignty: 8,
      contactEmail: "contact@innotech.ru",
      source: "api"
    })
    console.log(\`   Application ID: \${application.applicationId}\`)
    console.log(\`   Status: \${application.status}\`)
    `)

    // 5. Проверить статус заявки (пример)
    console.log('\n5. Check Application Status (example - commented out):')
    console.log(`
    const status = await client.getApplicationStatus(1202)
    console.log(\`   Company: \${status.companyName}\`)
    console.log(\`   Status: \${status.status}\`)
    if (status.committeeReview) {
      console.log(\`   Committee decision: \${status.committeeReview.decision}\`)
      console.log(\`   Score: \${status.committeeReview.score}\`)
    }
    `)

    // 6. Получить детали компании (пример)
    console.log('\n6. Get Company Details (example - commented out):')
    console.log(`
    const company = await client.getCompany(1202)
    console.log(\`   Name: \${company.name}\`)
    console.log(\`   INN: \${company.inn}\`)
    console.log(\`   Health Score: \${company.healthScore}\`)
    console.log(\`   TRL: \${company.trl}\`)
    console.log(\`   Recent events: \${company.recentEvents.length}\`)
    `)

  } catch (error) {
    console.error('\nError:', error.message)
  }

  console.log('\n' + '='.repeat(60))
  console.log('Документация: https://dev.drondoc.ru/api/fst/docs')
  console.log('='.repeat(60))
}

// Запускаем примеры
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

// Экспортируем класс для использования в других модулях
export default FSTClient
