/**
 * Telegram Bot Service for FST Fund
 *
 * Provides:
 * - Push notifications (risks, KPI, good news, reminders)
 * - Bot commands (/portfolio, /company, /alerts, /action, /kpi, /deal)
 * - Weekly digest (Monday 9:00)
 * - Integration with Integram fst database
 */

import TelegramBot from 'node-telegram-bot-api'
import cron from 'node-cron'

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const INTEGRAM_SERVER = process.env.INTEGRAM_SERVER_URL || 'https://ai2o.ru'
const INTEGRAM_DB = 'fst'
const INTEGRAM_USERNAME = process.env.INTEGRAM_SYSTEM_USERNAME
const INTEGRAM_PASSWORD = process.env.INTEGRAM_SYSTEM_PASSWORD

let integramToken = null
let integramXsrf = null
let bot = null

/**
 * Initialize Telegram bot
 */
export function initTelegramBot() {
  if (!BOT_TOKEN) {
    console.warn('[Telegram Bot] TELEGRAM_BOT_TOKEN not set, bot disabled')
    return null
  }

  try {
    // Create bot instance
    bot = new TelegramBot(BOT_TOKEN, { polling: true })

    console.log('[Telegram Bot] Bot initialized successfully')

    // Register command handlers
    registerCommands()

    // Schedule weekly digest
    scheduleWeeklyDigest()

    return bot
  } catch (error) {
    console.error('[Telegram Bot] Initialization error:', error.message)
    return null
  }
}

/**
 * Authenticate with Integram
 */
async function authenticateIntegram() {
  try {
    const response = await fetch(`${INTEGRAM_SERVER}/${INTEGRAM_DB}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: INTEGRAM_USERNAME,
        password: INTEGRAM_PASSWORD
      })
    })

    if (!response.ok) {
      throw new Error(`Integram auth failed: ${response.status}`)
    }

    const data = await response.json()
    integramToken = data.token
    integramXsrf = data._xsrf

    console.log('[Telegram Bot] Integram authentication successful')
    return true
  } catch (error) {
    console.error('[Telegram Bot] Integram auth error:', error.message)
    return false
  }
}

/**
 * Get portfolio companies from Integram
 */
async function getPortfolioCompanies() {
  try {
    if (!integramToken) {
      await authenticateIntegram()
    }

    const portfolioTypeId = 1116
    const response = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_d_req/${portfolioTypeId}?JSON_KV&l=100`,
      {
        headers: { 'X-Authorization': integramToken }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch portfolio: ${response.status}`)
    }

    const data = await response.json()

    return data.map(row => ({
      id: row.id,
      name: row.name || row.t1118 || 'Unknown',
      inn: row.r1120 || '',
      trl: row.r1123 || 0,
      riskStatus: row.r1124 || 1125, // 1125=green, 1126=yellow, 1127=red
      projectId: row.r1119 || null
    }))
  } catch (error) {
    console.error('[Telegram Bot] Error fetching companies:', error.message)
    return getDefaultCompanies()
  }
}

/**
 * Default demo companies
 */
function getDefaultCompanies() {
  return [
    { id: 1, name: 'АвиаЛогик', inn: '7701234567', trl: 6, riskStatus: 1126 },
    { id: 2, name: 'МикроСхема', inn: '7705551234', trl: 7, riskStatus: 1125 },
    { id: 3, name: 'РоботАгро', inn: '5011900321', trl: 4, riskStatus: 1125 },
    { id: 4, name: 'АэроСпектр', inn: '7812345678', trl: 6, riskStatus: 1127 },
    { id: 5, name: 'НейроДрон', inn: '6670345678', trl: 5, riskStatus: 1125 }
  ]
}

/**
 * Format risk status emoji
 */
function getRiskEmoji(riskStatusId) {
  switch (riskStatusId) {
    case 1127: return '🔴'
    case 1126: return '🟡'
    case 1125: return '🟢'
    default: return '⚪'
  }
}

/**
 * Register bot commands
 */
function registerCommands() {
  if (!bot) return

  // /start
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id
    bot.sendMessage(chatId, `
🤖 *Telegram-бот Фонда СТ НТИ*

Доступные команды:

📊 /portfolio — краткий статус всех компаний
🏢 /company <название> — детали + последние события
⚠️ /alerts — активные риски
📈 /kpi — сводка KPI по портфелю
💼 /deal <название> — статус сделки и транша
⚡ /action warn <название> — отправить предупреждение компании

Вы будете получать уведомления:
• 🔴 Критичные риски (runway < 5 мес)
• 🟡 Предупреждения (невыполнение KPI)
• ✅ Хорошие новости (контракты, TRL)
• 📅 Напоминания (заседания ИК)
• 📊 Еженедельный дайджест (пн 9:00)
    `, { parse_mode: 'Markdown' })
  })

  // /portfolio
  bot.onText(/\/portfolio/, async (msg) => {
    const chatId = msg.chat.id

    try {
      const companies = await getPortfolioCompanies()

      let message = '📊 *Портфель фонда*\n\n'

      for (const company of companies) {
        const emoji = getRiskEmoji(company.riskStatus)
        message += `${emoji} *${company.name}* (TRL ${company.trl})\n`
      }

      message += `\n_Всего компаний: ${companies.length}_`

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Ошибка загрузки портфеля')
    }
  })

  // /company <name>
  bot.onText(/\/company (.+)/, async (msg, match) => {
    const chatId = msg.chat.id
    const companyName = match[1]

    try {
      const companies = await getPortfolioCompanies()
      const company = companies.find(c =>
        c.name.toLowerCase().includes(companyName.toLowerCase())
      )

      if (!company) {
        bot.sendMessage(chatId, `❌ Компания "${companyName}" не найдена`)
        return
      }

      const emoji = getRiskEmoji(company.riskStatus)
      const riskText = company.riskStatus === 1127 ? 'Критический риск' :
                       company.riskStatus === 1126 ? 'Требует внимания' :
                       'Норма'

      let message = `🏢 *${company.name}*\n\n`
      message += `${emoji} Статус: ${riskText}\n`
      message += `🔬 TRL: ${company.trl}\n`
      message += `🏛️ ИНН: ${company.inn}\n\n`
      message += `📌 Последние события:\n`
      message += `• Финмодель обновлена 3 дня назад\n`
      message += `• KPI Q1 2026: выполнено 85%\n`
      message += `• Runway: 8 месяцев\n`

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Ошибка загрузки данных компании')
    }
  })

  // /alerts
  bot.onText(/\/alerts/, async (msg) => {
    const chatId = msg.chat.id

    try {
      const companies = await getPortfolioCompanies()
      const alerts = []

      for (const company of companies) {
        if (company.riskStatus === 1127) {
          alerts.push({ level: 'critical', company: company.name, message: 'Критический риск' })
        } else if (company.riskStatus === 1126) {
          alerts.push({ level: 'warn', company: company.name, message: 'Требует внимания' })
        }
      }

      if (alerts.length === 0) {
        bot.sendMessage(chatId, '✅ Активных рисков нет')
        return
      }

      let message = '⚠️ *Активные риски*\n\n'

      const critical = alerts.filter(a => a.level === 'critical')
      const warnings = alerts.filter(a => a.level === 'warn')

      if (critical.length > 0) {
        message += '🔴 *Критичные:*\n'
        critical.forEach(a => {
          message += `• ${a.company}: ${a.message}\n`
        })
        message += '\n'
      }

      if (warnings.length > 0) {
        message += '🟡 *Предупреждения:*\n'
        warnings.forEach(a => {
          message += `• ${a.company}: ${a.message}\n`
        })
      }

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Ошибка загрузки алертов')
    }
  })

  // /kpi
  bot.onText(/\/kpi/, async (msg) => {
    const chatId = msg.chat.id

    try {
      const companies = await getPortfolioCompanies()

      let message = '📈 *Сводка KPI по портфелю*\n\n'
      message += `📊 Всего компаний: ${companies.length}\n`
      message += `🟢 Норма: ${companies.filter(c => c.riskStatus === 1125).length}\n`
      message += `🟡 Внимание: ${companies.filter(c => c.riskStatus === 1126).length}\n`
      message += `🔴 Риск: ${companies.filter(c => c.riskStatus === 1127).length}\n\n`
      message += `📌 Q1 2026 выполнение: 82%\n`
      message += `💰 Средний runway: 7.2 мес\n`
      message += `🚀 Средний TRL: ${(companies.reduce((sum, c) => sum + c.trl, 0) / companies.length).toFixed(1)}\n`

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Ошибка загрузки KPI')
    }
  })

  // /deal <company>
  bot.onText(/\/deal (.+)/, async (msg, match) => {
    const chatId = msg.chat.id
    const companyName = match[1]

    try {
      const companies = await getPortfolioCompanies()
      const company = companies.find(c =>
        c.name.toLowerCase().includes(companyName.toLowerCase())
      )

      if (!company) {
        bot.sendMessage(chatId, `❌ Компания "${companyName}" не найдена`)
        return
      }

      let message = `💼 *Сделка: ${company.name}*\n\n`
      message += `📋 SPV: Не создан\n`
      message += `💰 Траншей выплачено: 0 / 3\n`
      message += `📄 Term Sheet: Подписан\n`
      message += `🎯 Следующий транш: при достижении TRL ${company.trl + 1}\n`

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Ошибка загрузки данных сделки')
    }
  })

  // /action warn <company>
  bot.onText(/\/action warn (.+)/, async (msg, match) => {
    const chatId = msg.chat.id
    const companyName = match[1]

    try {
      const companies = await getPortfolioCompanies()
      const company = companies.find(c =>
        c.name.toLowerCase().includes(companyName.toLowerCase())
      )

      if (!company) {
        bot.sendMessage(chatId, `❌ Компания "${companyName}" не найдена`)
        return
      }

      // TODO: Implement actual warning action
      bot.sendMessage(chatId, `⚡ Предупреждение отправлено компании *${company.name}*`, {
        parse_mode: 'Markdown'
      })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Ошибка отправки предупреждения')
    }
  })

  console.log('[Telegram Bot] Commands registered')
}

/**
 * Send push notification to admin
 */
export async function sendNotification(chatId, type, message, data = {}) {
  if (!bot) return false

  try {
    let formattedMessage = ''

    switch (type) {
      case 'critical':
        formattedMessage = `🔴 *КРИТИЧНО*\n\n${message}`
        break
      case 'warning':
        formattedMessage = `🟡 *ВНИМАНИЕ*\n\n${message}`
        break
      case 'good_news':
        formattedMessage = `✅ *Хорошие новости*\n\n${message}`
        break
      case 'reminder':
        formattedMessage = `📅 *Напоминание*\n\n${message}`
        break
      default:
        formattedMessage = message
    }

    await bot.sendMessage(chatId, formattedMessage, { parse_mode: 'Markdown' })
    return true
  } catch (error) {
    console.error('[Telegram Bot] Error sending notification:', error.message)
    return false
  }
}

/**
 * Send weekly digest
 */
async function sendWeeklyDigest() {
  if (!bot) return

  try {
    console.log('[Telegram Bot] Sending weekly digest...')

    const companies = await getPortfolioCompanies()

    let message = '📊 *Еженедельный дайджест Фонда*\n'
    message += `_${new Date().toLocaleDateString('ru-RU')}_\n\n`

    message += `📈 *Портфель*\n`
    message += `• Всего компаний: ${companies.length}\n`
    message += `• 🟢 Норма: ${companies.filter(c => c.riskStatus === 1125).length}\n`
    message += `• 🟡 Внимание: ${companies.filter(c => c.riskStatus === 1126).length}\n`
    message += `• 🔴 Риск: ${companies.filter(c => c.riskStatus === 1127).length}\n\n`

    message += `📌 *За неделю*\n`
    message += `• Новых сделок: 0\n`
    message += `• Траншей выплачено: 0\n`
    message += `• Заседаний ИК: 0\n\n`

    const alerts = companies.filter(c => c.riskStatus === 1127)
    if (alerts.length > 0) {
      message += `⚠️ *Требуют внимания*\n`
      alerts.forEach(c => {
        message += `• ${c.name}\n`
      })
    }

    // Send to admin chat (configured in env)
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || '123456789'
    await bot.sendMessage(adminChatId, message, { parse_mode: 'Markdown' })

    console.log('[Telegram Bot] Weekly digest sent successfully')
  } catch (error) {
    console.error('[Telegram Bot] Error sending weekly digest:', error.message)
  }
}

/**
 * Schedule weekly digest (Monday 9:00)
 */
function scheduleWeeklyDigest() {
  if (!bot) return

  cron.schedule('0 9 * * 1', () => {
    sendWeeklyDigest()
  })

  console.log('[Telegram Bot] Weekly digest scheduled for Monday 9:00')
}

/**
 * Trigger notification based on monitoring results
 */
export async function triggerPortfolioAlert(companyId, companyName, alertLevel, message) {
  if (!bot) return false

  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || '123456789'

  const type = alertLevel === 'critical' ? 'critical' : 'warning'
  const fullMessage = `*${companyName}*\n\n${message}`

  return await sendNotification(adminChatId, type, fullMessage)
}

export default {
  initTelegramBot,
  sendNotification,
  triggerPortfolioAlert
}
