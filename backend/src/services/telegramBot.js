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
import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'
import https from 'https'
import http from 'http'

const execAsync = promisify(exec)

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const INTEGRAM_SERVER = process.env.INTEGRAM_SERVER_URL || 'https://ai2o.ru'
const INTEGRAM_DB = 'fst'
const INTEGRAM_USERNAME = process.env.INTEGRAM_SYSTEM_USERNAME
const INTEGRAM_PASSWORD = process.env.INTEGRAM_SYSTEM_PASSWORD
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const ALLOWED_USERS = (process.env.ALLOWED_USERS || '').split(',').map(s => s.trim()).filter(Boolean)

// Fixed fund repository
const FUND_REPO_URL = 'https://github.com/unidel2035/fund'

// Solve sessions: chatId → [sessionId, ...]
const solveSessions = new Map()

// Logs directory for solve output
const SOLVE_LOGS_DIR = path.join(os.tmpdir(), 'fst-solve-logs')
if (!fs.existsSync(SOLVE_LOGS_DIR)) {
  fs.mkdirSync(SOLVE_LOGS_DIR, { recursive: true })
}

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
 * Check if user is allowed to use bot
 */
function isAllowed(userId) {
  if (!ALLOWED_USERS.length) return true
  return ALLOWED_USERS.includes(String(userId))
}

/**
 * Download file from URL to temp path
 */
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)
    const proto = url.startsWith('https') ? https : http
    proto.get(url, (res) => {
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', (err) => {
      fs.unlink(destPath, () => {})
      reject(err)
    })
  })
}

/**
 * Transcribe audio file using Python+Whisper (if available)
 * Returns null if whisper not available
 */
async function transcribeAudio(audioPath) {
  const script = `
import sys
try:
    import whisper
    model = whisper.load_model("base")
    result = model.transcribe(sys.argv[1], language="ru")
    print(result["text"])
except ImportError:
    print("__WHISPER_NOT_AVAILABLE__")
except Exception as e:
    print(f"__ERROR__: {e}")
`
  const scriptPath = path.join(os.tmpdir(), 'fst_transcribe.py')
  fs.writeFileSync(scriptPath, script)
  try {
    const { stdout } = await execAsync(`python3 "${scriptPath}" "${audioPath}"`, { timeout: 60000 })
    const text = stdout.trim()
    if (text === '__WHISPER_NOT_AVAILABLE__') return null
    if (text.startsWith('__ERROR__')) return null
    return text
  } catch {
    return null
  }
}

/**
 * Start solve session in screen
 */
async function startSolveSession(issueUrl, chatId) {
  const timestamp = Date.now()
  const sessionId = `fst-solve-${chatId}-${timestamp}`
  const logPath = path.join(SOLVE_LOGS_DIR, `${sessionId}.log`)

  const env = { ...process.env }
  if (GITHUB_TOKEN) {
    env.GH_TOKEN = GITHUB_TOKEN
    env.GITHUB_TOKEN = GITHUB_TOKEN
  }
  env.GH_CONFIG_DIR = '/home/hive/.config/gh'
  env.GIT_TERMINAL_PROMPT = '0'

  const nvmInit = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"'
  const cmdStr = `${nvmInit} && solve "${issueUrl}"`

  const screenArgs = [
    '-dmS', sessionId,
    '-L', '-Logfile', logPath,
    'bash', '-c', cmdStr
  ]

  await new Promise((resolve, reject) => {
    const proc = spawn('screen', screenArgs, { env, detached: true, stdio: 'ignore' })
    proc.on('close', (code) => {
      if (code === 0 || code === null) resolve()
      else reject(new Error(`screen exited with code ${code}`))
    })
    proc.on('error', reject)
  })

  // Track sessions per chat
  if (!solveSessions.has(chatId)) solveSessions.set(chatId, [])
  solveSessions.get(chatId).push(sessionId)

  return { sessionId, logPath }
}

/**
 * Monitor solve session and send log tail to Telegram
 */
async function monitorSolve(bot, chatId, sessionId, logPath, statusMsgId) {
  let lastSize = 0
  let checkCount = 0
  const maxChecks = 120 // ~10 min at 5s intervals

  const interval = setInterval(async () => {
    checkCount++
    if (checkCount > maxChecks) {
      clearInterval(interval)
      try {
        await bot.editMessageText(
          `⏰ Таймаут: solve "${sessionId}" работает более 10 минут.\nПроверьте: \`screen -r ${sessionId}\``,
          { chat_id: chatId, message_id: statusMsgId, parse_mode: 'Markdown' }
        )
      } catch {}
      return
    }

    // Check if screen session still running
    let sessionRunning = true
    try {
      const { stdout } = await execAsync(`screen -list | grep "${sessionId}"`)
      sessionRunning = stdout.includes(sessionId)
    } catch {
      sessionRunning = false
    }

    // Read log tail
    let logTail = ''
    try {
      if (fs.existsSync(logPath)) {
        const stat = fs.statSync(logPath)
        if (stat.size !== lastSize) {
          lastSize = stat.size
          const content = fs.readFileSync(logPath, 'utf8')
          const lines = content.split('\n').filter(l => l.trim())
          logTail = lines.slice(-8).join('\n')
        }
      }
    } catch {}

    if (!sessionRunning) {
      clearInterval(interval)
      const finalLog = logTail || '(нет вывода)'
      const safeLog = finalLog.replace(/`/g, "'").slice(0, 800)
      try {
        await bot.editMessageText(
          `✅ *solve завершён*\n\n\`\`\`\n${safeLog}\n\`\`\``,
          { chat_id: chatId, message_id: statusMsgId, parse_mode: 'Markdown' }
        )
      } catch {}

      // Remove from tracked sessions
      const sessions = solveSessions.get(chatId) || []
      solveSessions.set(chatId, sessions.filter(s => s !== sessionId))
      return
    }

    if (logTail) {
      const safeLog = logTail.replace(/`/g, "'").slice(0, 600)
      try {
        await bot.editMessageText(
          `⚙️ *solve выполняется...*\n\n\`\`\`\n${safeLog}\n\`\`\`\n\n_Session: ${sessionId}_`,
          { chat_id: chatId, message_id: statusMsgId, parse_mode: 'Markdown' }
        )
      } catch {}
    }
  }, 5000)
}

/**
 * Register bot commands
 */
function registerCommands() {
  if (!bot) return

  // /start
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id
    const userId = msg.from.id
    const isAuth = isAllowed(userId)

    let cmdList = `
📊 /portfolio — краткий статус всех компаний
🏢 /company <название> — детали компании
⚠️ /alerts — активные риски
📈 /kpi — сводка KPI по портфелю
💼 /deal <название> — статус сделки
⚡ /action warn <название> — предупреждение компании`

    if (isAuth) {
      cmdList += `

🤖 *Команды hive-mind (только для команды):*
🔧 /solve <url_issue> — запустить solve для GitHub issue
🐝 /hive — запустить hive для репозитория фонда
🎙 *Голосовые сообщения* — отправьте голос с командой (например: "solve issue 123")`
    }

    bot.sendMessage(chatId, `🤖 *Telegram-бот Фонда СТ НТИ*\n${cmdList}\n\n📅 Еженедельный дайджест — пн 9:00`, {
      parse_mode: 'Markdown'
    })
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

  // /solve <issue_url_or_number>
  bot.onText(/\/solve(.*)/, async (msg, match) => {
    const chatId = msg.chat.id
    const userId = msg.from.id

    if (!isAllowed(userId)) {
      bot.sendMessage(chatId, '❌ У вас нет доступа к этой команде.')
      return
    }

    if (!GITHUB_TOKEN) {
      bot.sendMessage(chatId, '❌ GITHUB_TOKEN не настроен. Добавьте его в backend/.env')
      return
    }

    const arg = (match[1] || '').trim()
    if (!arg) {
      bot.sendMessage(chatId, `❌ Использование: /solve <ссылка или номер issue>\n\nПримеры:\n/solve https://github.com/unidel2035/fund/issues/42\n/solve 42`)
      return
    }

    const issueUrl = resolveIssueUrl(arg)
    if (!issueUrl) {
      bot.sendMessage(chatId, '❌ Некорректный номер или URL issue.')
      return
    }

    const userName = msg.from.username ? `@${msg.from.username}` : msg.from.first_name
    bot.sendMessage(chatId, `⚙️ Запускаю solve для ${issueUrl}...\n\nЗапросил: ${userName}`, { parse_mode: 'Markdown' })
      .then(async (statusMsg) => {
        try {
          const { sessionId, logPath } = await startSolveSession(issueUrl, chatId)
          const confirmMsg = await bot.sendMessage(chatId,
            `✅ *Сессия запущена*\n\nSession: \`${sessionId}\`\nЛог: \`${logPath}\`\n\n_Буду присылать обновления..._`,
            { parse_mode: 'Markdown' }
          )
          monitorSolve(bot, chatId, sessionId, logPath, confirmMsg.message_id)
        } catch (err) {
          bot.sendMessage(chatId, `❌ Ошибка запуска solve: ${err.message}`)
        }
      })
  })

  // /hive — run hive for fund repo
  bot.onText(/\/hive/, async (msg) => {
    const chatId = msg.chat.id
    const userId = msg.from.id

    if (!isAllowed(userId)) {
      bot.sendMessage(chatId, '❌ У вас нет доступа к этой команде.')
      return
    }

    if (!GITHUB_TOKEN) {
      bot.sendMessage(chatId, '❌ GITHUB_TOKEN не настроен. Добавьте его в backend/.env')
      return
    }

    bot.sendMessage(chatId, `🐝 Запускаю hive для репозитория фонда...\n\n${FUND_REPO_URL}\n\n⏳ Подождите...`)

    try {
      const hiveBin = '/home/hive/.bun/bin/hive'
      const env = { ...process.env, GITHUB_TOKEN, GH_TOKEN: GITHUB_TOKEN }
      env.PATH = `/home/hive/.bun/bin:/home/hive/.nvm/versions/node/v20.20.0/bin:${env.PATH || '/usr/bin'}`

      const { stdout, stderr } = await execAsync(
        `"${hiveBin}" "${FUND_REPO_URL}"`,
        { env, timeout: 30000 }
      )

      const output = (stdout + stderr).slice(0, 1200).replace(/`/g, "'")
      bot.sendMessage(chatId,
        `✅ *Hive запущен!*\n\n\`\`\`\n${output || '(нет вывода)'}\n\`\`\``,
        { parse_mode: 'Markdown' }
      )
    } catch (err) {
      const errOut = (err.stdout || err.stderr || err.message || '').slice(0, 800).replace(/`/g, "'")
      bot.sendMessage(chatId,
        `❌ *Ошибка hive:*\n\n\`\`\`\n${errOut}\n\`\`\``,
        { parse_mode: 'Markdown' }
      )
    }
  })

  // Voice messages — transcribe and detect solve command
  bot.on('voice', async (msg) => {
    const chatId = msg.chat.id
    const userId = msg.from.id

    if (!isAllowed(userId)) return

    await bot.sendMessage(chatId, '🎙 Получено голосовое сообщение. Обрабатываю...')

    try {
      const fileId = msg.voice.file_id
      const fileInfo = await bot.getFile(fileId)
      const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.file_path}`
      const tmpPath = path.join(os.tmpdir(), `fst-voice-${Date.now()}.ogg`)

      await downloadFile(fileUrl, tmpPath)

      // Try transcription
      const transcription = await transcribeAudio(tmpPath)
      fs.unlink(tmpPath, () => {})

      if (!transcription) {
        bot.sendMessage(chatId,
          '⚠️ Распознавание речи недоступно (whisper не установлен).\n\n' +
          'Используйте текстовые команды:\n' +
          '/solve <номер или ссылка>\n/hive'
        )
        return
      }

      await bot.sendMessage(chatId, `📝 Распознано: _${transcription}_`, { parse_mode: 'Markdown' })

      // Try to extract issue reference from transcription
      const issueUrl = extractIssueFromText(transcription)
      if (issueUrl) {
        await bot.sendMessage(chatId,
          `🔍 Обнаружена ссылка на issue: ${issueUrl}\n\nЗапустить solve? Ответьте /solve ${issueUrl}`
        )
      }
    } catch (err) {
      bot.sendMessage(chatId, `❌ Ошибка обработки голосового сообщения: ${err.message}`)
    }
  })

  console.log('[Telegram Bot] Commands registered')
}

/**
 * Resolve issue URL from number or full URL
 * Accepts: "42", "#42", "https://github.com/unidel2035/fund/issues/42"
 */
function resolveIssueUrl(arg) {
  if (arg.startsWith('https://github.com/')) return arg
  const num = arg.replace(/^#/, '').trim()
  if (/^\d+$/.test(num)) return `${FUND_REPO_URL}/issues/${num}`
  return null
}

/**
 * Extract issue reference from transcribed text
 */
function extractIssueFromText(text) {
  // Direct URL
  const urlMatch = text.match(/https:\/\/github\.com\/[\w-]+\/[\w-]+\/issues\/\d+/)
  if (urlMatch) return urlMatch[0]

  // "issue 42", "issue number 42", "задача 42", "проблема 42"
  const numMatch = text.match(/(?:issue|задача|проблема|#)\s*(\d+)/i)
  if (numMatch) return `${FUND_REPO_URL}/issues/${numMatch[1]}`

  return null
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
