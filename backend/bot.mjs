#!/usr/bin/env node
/**
 * FST НТИ Fund Bot — @fund_st_bot
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
try {
  const env = readFileSync(resolve(__dirname, '.env'), 'utf8')
  env.split('\n').forEach(line => { const m = line.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim() })
} catch {}

import TelegramBot from 'node-telegram-bot-api'
import { spawn } from 'child_process'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'
import https from 'https'

const execFileAsync = promisify(execFile)

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
if (!TOKEN) { console.error('TELEGRAM_BOT_TOKEN not set'); process.exit(1) }

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''
const ALLOWED_USERS = (process.env.ALLOWED_USERS || '').split(',').map(s => s.trim()).filter(Boolean)
const FUND_REPO = 'https://github.com/unidel2035/fund'

// Логи для solve сессий
const SOLVE_LOGS = path.join(os.tmpdir(), 'fst-solve-logs')
if (!fs.existsSync(SOLVE_LOGS)) fs.mkdirSync(SOLVE_LOGS, { recursive: true })

const INTEGRAM_URL = process.env.INTEGRAM_SERVER_URL || 'https://ai2o.ru'
const INTEGRAM_DB  = 'fst'
const TG_REQ_ID    = '4065'  // Requisite "Телеграм" в типе Пользователь (type 18)

// chatId → { userId, userName, isAdmin }
const sessions = new Map()
// chatId → { step: 'login'|'password', login?: string }
const pendingAuth = new Map()

function isAuthenticated(userId) {
  if (ALLOWED_USERS.includes(String(userId))) return true
  return sessions.has(String(userId))
}

function isAdmin(userId) {
  if (ALLOWED_USERS.includes(String(userId))) return true
  return sessions.get(String(userId))?.isAdmin === true
}

// Обратная совместимость — solve/hive требуют isAllowed = isAdmin
function isAllowed(userId) { return isAdmin(userId) }

// Флаги активных hive-сессий: chatId → true/false
const hiveActive = new Map()

// Аутентификация пользователя через Integram
// Возвращает { token, xsrf, userId, userName, isAdmin } или null
async function authenticateIntegram(login, password) {
  try {
    // Шаг 1: аутентификация
    const res = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/auth?JSON`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `login=${encodeURIComponent(login)}&pwd=${encodeURIComponent(password)}`
    })
    if (!res.ok) return null
    const data = await res.json()
    // Успех: { token, _xsrf, id, msg }; неверный пароль: msg содержит ошибку или нет token
    if (!data.token) return null

    const { token, _xsrf: xsrf, id: userId } = data
    let userName = login
    let isAdmin = false

    // Шаг 2: получить роль и имя пользователя
    // GET /fst/object/18?JSON_KV&F_I={id} с Cookie: fst={token}
    try {
      const uRes = await fetch(
        `${INTEGRAM_URL}/${INTEGRAM_DB}/object/18?JSON_KV&l=1&F_I=${userId}`,
        { headers: { Cookie: `${INTEGRAM_DB}=${token}` } }
      )
      const uData = await uRes.json()
      const reqs = uData?.reqs?.[userId] || {}
      const role = reqs['115'] || ''         // "admin" или пусто
      userName = reqs['33'] || uData?.object?.[0]?.val || login
      isAdmin = role === 'admin'
    } catch {}

    return { token, xsrf, userId, userName, isAdmin }
  } catch { return null }
}

// Сохраняет Telegram chat ID в карточку пользователя Integram
async function saveTelegramId(userId, chatId, token, xsrf) {
  try {
    // POST /fst/_m_set/{id} с Cookie: fst={token} и t4065={chatId} в теле
    await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/_m_set/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Authorization': token,
        'Cookie': `${INTEGRAM_DB}=${token}`,
      },
      body: `t${TG_REQ_ID}=${encodeURIComponent(String(chatId))}&_xsrf=${xsrf}`
    })
  } catch {}
}

// Преобразует номер issue или URL в полную ссылку
function resolveIssue(arg) {
  if (!arg) return null
  arg = arg.trim()
  if (arg.startsWith('https://github.com/')) return arg
  const num = arg.replace(/^#/, '')
  if (/^\d+$/.test(num)) return `${FUND_REPO}/issues/${num}`
  return null
}

// Извлекает номер/ссылку issue из текста (для голосовых)
function extractIssue(text) {
  const urlMatch = text.match(/https:\/\/github\.com\/[\w\-]+\/[\w\-]+\/issues\/\d+/)
  if (urlMatch) return urlMatch[0]
  const numMatch = text.match(/(?:issue|задача|проблема|ишью|#)\s*(\d+)/i)
  if (numMatch) return `${FUND_REPO}/issues/${numMatch[1]}`
  return null
}

// Читает свежий OAuth токен из .credentials.json (обновляется текущей сессией Claude Code)
function getFreshClaudeToken() {
  try {
    const data = JSON.parse(fs.readFileSync('/home/hive/.claude/.credentials.json', 'utf8'))
    const oa = data?.claudeAiOauth
    if (!oa?.accessToken) return null
    const expired = oa.expiresAt && oa.expiresAt < Date.now()
    if (expired) return null
    return oa.accessToken
  } catch { return null }
}

// Выполняет bash-команду в контексте репозитория
async function runBash(cmd, cwd = '/home/hive/fund') {
  const HOME = process.env.HOME || '/home/hive'
  const NVM_BIN = `${HOME}/.nvm/versions/node/v20.20.0/bin`
  const ghEnv = {
    HOME, PATH: `${NVM_BIN}:/usr/local/bin:/usr/bin:/bin`,
    GIT_TERMINAL_PROMPT: '0',
    GH_TOKEN: GITHUB_TOKEN, GITHUB_TOKEN,
    GH_CONFIG_DIR: `${HOME}/.config/gh`,
  }
  try {
    const { stdout, stderr } = await execFileAsync('bash', ['-c', cmd], {
      cwd, env: ghEnv, timeout: 60000, maxBuffer: 1024 * 1024 * 4
    })
    return (stdout + (stderr ? `\n[stderr]: ${stderr}` : '')).slice(0, 8000)
  } catch (err) {
    return `[error exit ${err.code}]: ${(err.stdout || '') + (err.stderr || '') || err.message}`.slice(0, 4000)
  }
}

// Агентный solve через Claude API напрямую (без CLI-бинаря)
// Возвращает Promise → { success: bool }
async function runSolve(bot, chatId, issueUrl, requester) {
  const token = getFreshClaudeToken()
  if (!token) {
    await bot.sendMessage(chatId, '❌ Нет свежего токена Claude. Запустите новую сессию Claude Code.')
    return { success: false }
  }

  // Парсим owner/repo/number из URL
  const urlMatch = issueUrl.match(/github\.com\/([\w-]+)\/([\w-]+)\/issues\/(\d+)/)
  if (!urlMatch) {
    await bot.sendMessage(chatId, `❌ Неверный URL issue: ${issueUrl}`)
    return { success: false }
  }
  const [, owner, repo, issueNum] = urlMatch
  const repoDir = '/home/hive/fund'

  // Получаем данные issue
  let issueTitle = `Issue #${issueNum}`, issueBody = ''
  try {
    const { stdout } = await execFileAsync('gh', [
      'issue', 'view', issueNum, '--repo', `${owner}/${repo}`,
      '--json', 'title,body,labels,comments',
    ], { env: { GH_TOKEN: GITHUB_TOKEN, HOME: process.env.HOME || '/home/hive', PATH: process.env.PATH } })
    const data = JSON.parse(stdout)
    issueTitle = data.title || issueTitle
    issueBody = data.body || ''
    if (data.comments?.length) {
      issueBody += '\n\n--- Comments ---\n' + data.comments.map(c => `@${c.author?.login}: ${c.body}`).join('\n')
    }
  } catch (e) {
    console.error('[FST Solve] Failed to fetch issue:', e.message)
  }

  // Статусное сообщение
  const startMsg = await bot.sendMessage(chatId,
    `⚙️ *Solve #${issueNum}*\n\n📋 ${issueTitle.slice(0, 80)}\n👤 ${requester}\n🕐 ${new Date().toLocaleTimeString('ru-RU')}`,
    { parse_mode: 'Markdown' }
  )
  const statusMsgId = startMsg.message_id
  const editStatus = async (text) => {
    try { await bot.editMessageText(text, { chat_id: chatId, message_id: statusMsgId, parse_mode: 'Markdown' }) } catch {}
  }

  // Создаём ветку для работы
  const branch = `issue-${issueNum}-${Date.now().toString(36)}`
  await runBash(`git fetch origin main && git checkout -b ${branch} origin/main 2>&1 || git checkout -b ${branch} 2>&1`, repoDir)

  // Системный промпт
  const systemPrompt = `You are a coding agent working on the VentureOS venture fund platform (Vue 3 + Node.js).
Repository: /home/hive/fund (already cloned and on branch ${branch})
Your job: implement the GitHub issue fully, then commit and create a PR.

Rules:
- Work only in /home/hive/fund
- Use bash tool to read files, make changes, run git commands
- After all changes: git add -A && git commit -m "fix: <short description> (closes #${issueNum})"
- Then: gh pr create --repo ${owner}/${repo} --title "<title>" --body "Closes #${issueNum}\n\n<description>" --head ${branch} --base main
- Do NOT ask questions — implement directly
- PrimeVue CSS variables only (var(--p-...)), no hardcoded colors
- ESM modules (import/export), no CommonJS`

  const userMessage = `Solve this GitHub issue:

**#${issueNum}: ${issueTitle}**

${issueBody}

Implement the changes, commit, and create a PR. Branch: ${branch}`

  // Агентный цикл
  const messages = [{ role: 'user', content: userMessage }]
  const tools = [{
    name: 'bash',
    description: 'Execute a bash command in the repository directory. Use for file operations, git, npm, etc.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The bash command to run' }
      },
      required: ['command']
    }
  }]

  let toolCount = 0, prUrl = null, success = false
  const MAX_ITERATIONS = 30
  const startTime = Date.now()

  try {
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const mins = Math.round((Date.now() - startTime) / 60000)
      await editStatus(`⚙️ *Solve #${issueNum}* (${mins} мин, ${toolCount} шагов)\n\n📋 ${issueTitle.slice(0, 60)}\n👤 ${requester}`)

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': token,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 16000,
          system: systemPrompt,
          tools,
          messages,
        }),
        signal: AbortSignal.timeout(120000),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`API ${response.status}: ${err.slice(0, 200)}`)
      }

      const result = await response.json()

      // Сохраняем ответ ассистента
      messages.push({ role: 'assistant', content: result.content })

      if (result.stop_reason === 'end_turn') {
        success = true
        break
      }

      if (result.stop_reason !== 'tool_use') break

      // Обрабатываем вызовы инструментов
      const toolResults = []
      for (const block of result.content) {
        if (block.type !== 'tool_use') continue
        toolCount++
        console.log(`[FST Solve #${issueNum}] bash: ${block.input.command.slice(0, 100)}`)
        const output = await runBash(block.input.command, repoDir)
        // Ищем URL PR в выводе
        const prMatch = output.match(/https:\/\/github\.com\/[\w-]+\/[\w-]+\/pull\/\d+/)
        if (prMatch) prUrl = prMatch[0]
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: output })
      }
      messages.push({ role: 'user', content: toolResults })
    }
  } catch (err) {
    console.error('[FST Solve] Agent error:', err.message)
    const mins = Math.round((Date.now() - startTime) / 60000)
    await editStatus(`❌ *Solve #${issueNum} — ошибка*\n\n${err.message.slice(0, 200)}\n⏱ ${mins} мин`)
    return { success: false }
  }

  // Проверяем результат
  const mins = Math.round((Date.now() - startTime) / 60000)
  if (!prUrl) {
    // Пробуем найти PR через gh
    try {
      const { stdout } = await execFileAsync('gh', [
        'pr', 'list', '--repo', `${owner}/${repo}`,
        '--head', branch, '--json', 'url,number,title', '--limit', '1',
      ], { env: { GH_TOKEN: GITHUB_TOKEN, HOME: process.env.HOME || '/home/hive', PATH: process.env.PATH } })
      const prs = JSON.parse(stdout)
      if (prs[0]?.url) prUrl = prs[0].url
    } catch {}
  }

  if (prUrl) {
    await editStatus(`✅ *Solve #${issueNum} — готово!*\n\n📋 ${issueTitle.slice(0, 60)}\n🔗 ${prUrl}\n⏱ ${mins} мин | ${toolCount} шагов`)
    return { success: true }
  } else {
    await editStatus(`🏁 *Solve #${issueNum} — завершён*\n\n📋 ${issueTitle.slice(0, 60)}\n⚠️ PR не создан\n⏱ ${mins} мин | ${toolCount} шагов`)
    return { success: false }
  }
}

// Автомерж PR связанного с issue
async function autoMergePR(bot, chatId, issueNumber, repo = 'unidel2035/fund') {
  const ghEnv = { ...process.env, GH_TOKEN: GITHUB_TOKEN }
  try {
    const { stdout } = await execFileAsync('gh', [
      'pr', 'list', '--repo', repo,
      '--search', `${issueNumber} in:title`,
      '--json', 'number,title,isDraft,headRefName',
      '--limit', '5'
    ], { env: ghEnv })
    const prs = JSON.parse(stdout || '[]')
    if (prs.length === 0) {
      await bot.sendMessage(chatId, `ℹ️ Issue #${issueNumber}: PR не найден для автомержа.`)
      return
    }
    const pr = prs[0]
    if (pr.isDraft) {
      await execFileAsync('gh', ['pr', 'ready', String(pr.number), '--repo', repo], { env: ghEnv })
      await new Promise(r => setTimeout(r, 2000))
    }
    await execFileAsync('gh', ['pr', 'merge', String(pr.number), '--squash', '--delete-branch', '--repo', repo], { env: ghEnv })
    await bot.sendMessage(chatId,
      `🎉 *PR слит*\n\n#${pr.number} — ${pr.title}\n✅ Автомерж выполнен (squash)`,
      { parse_mode: 'Markdown' }
    )
  } catch (err) {
    await bot.sendMessage(chatId, `⚠️ Автомерж #${issueNumber}: ${err.message}`)
  }
}

const bot = new TelegramBot(TOKEN, { polling: true })

// Глобальный перехват — auth-диалог для незарегистрированных пользователей
const _origProcessUpdate = bot.processUpdate.bind(bot)
bot.processUpdate = (update) => {
  const userId = String(
    update.message?.from?.id
    || update.callback_query?.from?.id
    || update.edited_message?.from?.id
    || ''
  )
  const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id
  const text = (update.message?.text || '').trim()

  if (!userId || !chatId) return _origProcessUpdate(update)

  // Уже аутентифицирован — пропускаем дальше
  if (isAuthenticated(userId)) return _origProcessUpdate(update)

  // Идёт диалог авторизации
  if (pendingAuth.has(userId)) {
    const state = pendingAuth.get(userId)

    if (state.step === 'login') {
      if (!text || text.startsWith('/')) {
        bot.sendMessage(chatId, '👤 Введите ваш логин в системе ФСТ:')
        return
      }
      pendingAuth.set(userId, { step: 'password', login: text })
      bot.sendMessage(chatId, 'Введите пароль:')
      return
    }

    if (state.step === 'password') {
      const { login } = state
      pendingAuth.delete(userId)
      authenticateIntegram(login, text).then(async authData => {
        if (!authData) {
          bot.sendMessage(chatId, '❌ Неверный логин или пароль.\n\nНапишите /start — попробовать снова.')
          return
        }
        const isAdminUser = authData.userRole === 'admin' || authData.userRole === 'Администратор'
        sessions.set(userId, { userId: authData.userId, userName: authData.userName, isAdmin: isAdminUser })
        await saveTelegramId(authData.userId, chatId, authData.token, authData.xsrf)

        const roleText = isAdminUser ? '👑 Администратор — все функции доступны.' : '👤 Участник — базовые функции доступны.'
        await bot.sendMessage(chatId,
          `✅ *Добро пожаловать, ${authData.userName}!*\n\n${roleText}\n\nВаш Telegram привязан к аккаунту в системе ФСТ.\n\n📋 Используйте кнопки меню ниже 👇`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [
                ['📊 Портфель', '⚠️ Алерты'],
                ['🏦 Фонд', '📈 Аналитика'],
                ['🤝 Сделки', '📋 Протоколы ИК'],
                ['🌐 Открыть платформу', '❓ Помощь'],
              ],
              resize_keyboard: true,
              persistent: true,
            }
          }
        )
      })
      return
    }
  }

  // Начинаем диалог авторизации
  pendingAuth.set(userId, { step: 'login' })
  bot.sendMessage(chatId,
    `🔐 *Вход в систему ФСТ НТИ*\n\nВведите логин:`,
    { parse_mode: 'Markdown' }
  )
}

const URL = 'https://fst.drondoc.ru'

const PORTFOLIO = [
  { name: 'АвиаЛогик',  sector: 'БАС',  st: '🟢', rev: '18 млн', run: '14 мес', trl: 6, irr: '34%' },
  { name: 'МикроСхема', sector: 'МЭ',   st: '🟡', rev: '42 млн', run: '7 мес',  trl: 7, irr: '28%' },
  { name: 'АэроСпектр', sector: 'БАС',  st: '🔴', rev: '8 млн',  run: '3 мес',  trl: 5, irr: '12%' },
  { name: 'РобоМакс',   sector: 'РОБО', st: '🟢', rev: '31 млн', run: '22 мес', trl: 7, irr: '41%' },
  { name: 'ДронСервис', sector: 'БАС',  st: '🟢', rev: '55 млн', run: '18 мес', trl: 8, irr: '52%' },
]

const MENU = {
  reply_markup: {
    keyboard: [
      ['📊 Портфель', '⚠️ Алерты'],
      ['🏦 Фонд', '📈 Аналитика'],
      ['🤝 Сделки', '📋 Протоколы ИК'],
      ['🌐 Открыть платформу', '❓ Помощь'],
    ],
    resize_keyboard: true,
    persistent: true,
  }
}

function portfolioButtons() {
  return {
    reply_markup: {
      inline_keyboard: [
        PORTFOLIO.slice(0,3).map(c => ({ text: `${c.st} ${c.name}`, callback_data: `co_${c.name}` })),
        PORTFOLIO.slice(3).map(c => ({ text: `${c.st} ${c.name}`, callback_data: `co_${c.name}` })),
        [{ text: '🔄 Обновить', callback_data: 'portfolio' }, { text: '🌐 Монитор', url: `${URL}/fst-portfolio` }],
      ]
    }
  }
}

async function sendPortfolio(chatId) {
  const g = PORTFOLIO.filter(c=>c.st==='🟢').length, y = PORTFOLIO.filter(c=>c.st==='🟡').length, r = PORTFOLIO.filter(c=>c.st==='🔴').length
  await bot.sendMessage(chatId,
    `📊 *Портфельный монитор ФСТ НТИ*\n_${new Date().toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})}_\n\n🟢 ${g} • 🟡 ${y} • 🔴 ${r}\n\n` +
    PORTFOLIO.map(c=>`${c.st} *${c.name}* (${c.sector})\n   💰 ${c.rev} | ⏳ ${c.run} | TRL ${c.trl} | IRR ${c.irr}`).join('\n\n') +
    `\n\n_Нажмите на компанию для деталей:_`,
    { parse_mode:'Markdown', ...portfolioButtons() }
  )
}

async function sendAlerts(chatId) {
  await bot.sendMessage(chatId,
    `⚠️ *Активные алерты*\n\n` +
    `🔴 *АэроСпектр* — Runway 3 мес ❗\n   → Срочно: мост-финансирование\n\n` +
    `🟡 *МикроСхема* — Runway 7 мес\n   → Подготовить Серию B к Q2 2026\n\n` +
    `🟡 *АэроСпектр* — TRL стагнация > 6 мес\n   → Запросить tech update`,
    { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[
      [{ text:'📋 Открыть портфель', url:`${URL}/fst-portfolio` }],
      [{ text:'🔔 Настроить уведомления', callback_data:'settings' }],
    ]}}
  )
}

async function sendFund(chatId) {
  await bot.sendMessage(chatId,
    `🏦 *ФСТ НТИ — Показатели фонда*\n\n` +
    `💰 NAV: *6.4 млрд ₽*\n📦 AUM: *8.2 млрд ₽*\n📈 IRR: *38%*\n🏢 Компаний: *${PORTFOLIO.length}*\n⚖️ Субфондов: *3*\n\n` +
    `*Распределение AUM:*\n🚁 БАС — 3.2 млрд (39%)\n🤖 РОБО — 1.8 млрд (22%)\n⚡ МЭ — 1.4 млрд (17%)\n🏦 Резерв — 1.8 млрд (22%)\n\n📅 Закрытие фонда: 01.01.2031`,
    { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[
      [{ text:'💧 Waterfall', url:`${URL}/fst-waterfall` }, { text:'🪙 Cap Table', url:`${URL}/fst-captable` }],
      [{ text:'📊 LP Dashboard', url:`${URL}/fst-lp` }, { text:'🌐 Двойник фонда', url:`${URL}/fst-fund` }],
      [{ text:'🌐 Публичная витрина', url:`${URL}/fst-transparency` }],
    ]}}
  )
}

async function sendDeals(chatId) {
  await bot.sendMessage(chatId,
    `🤝 *Активные сделки*\n\n` +
    `✅ *АвиаЛогик* — Транш 2\n   25 млн ₽ | Подписание\n\n` +
    `🔄 *ДронСервис* — Серия A\n   120 млн ₽ | Due Diligence\n\n` +
    `📋 *МикроСхема* — Мост\n   15 млн ₽ | Term Sheet\n\n` +
    `⏳ В очереди на ИК: *2 заявки*`,
    { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[
      [{ text:'📋 Воронка', url:`${URL}/fst-dealflow` }, { text:'🤖 AI ИК', url:`${URL}/fst-committee` }],
      [{ text:'📄 Протоколы', url:`${URL}/fst-protocol` }, { text:'📝 Подать заявку', url:`${URL}/fst-apply` }],
    ]}}
  )
}

async function sendAnalytics(chatId) {
  await bot.sendMessage(chatId,
    `📈 *Аналитика ФСТ НТИ*\n\n` +
    `🧠 Portfolio Intelligence — 03.03.2026\n` +
    `📐 EV/Revenue: 7.4x (рынок 8.2x)\n` +
    `⚖️ Аллокация BL: +8% БАС рекомендовано\n` +
    `🏆 ESG-скоринг: 72/100\n` +
    `📊 Rule of 40: 42 (медиана 38)`,
    { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[
      [{ text:'🧠 Intelligence', url:`${URL}/fst-intelligence` }, { text:'📊 Бенчмарк', url:`${URL}/fst-benchmark` }],
      [{ text:'⚖️ Аллокация', url:`${URL}/fst-allocation` }, { text:'🌿 ESG', url:`${URL}/fst-esg` }],
      [{ text:'🚪 Выходы', url:`${URL}/fst-exit` }, { text:'🔍 Сорсинг', url:`${URL}/fst-sourcing` }],
    ]}}
  )
}

async function sendHelp(chatId) {
  await bot.sendMessage(chatId,
    `❓ *Справка — @fund_st_bot*\n\n` +
    `/start — главное меню\n/portfolio — портфель\n/alerts — алерты\n` +
    `/fund — фонд\n/deals — сделки\n/analytics — аналитика\n` +
    `/status — статус\n/help — справка\n\n` +
    `🌐 ${URL}\n💬 Поддержка: @gd2035`,
    { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[[{ text:'🚀 Открыть платформу', url:URL }]] }}
  )
}

// Commands
bot.onText(/^\/start(@\w+)?$/, async (msg) => {
  await bot.sendMessage(msg.chat.id,
    `🛡️ *Фонд суверенных технологий НТИ*\n\nДобро пожаловать, ${msg.from.first_name || 'коллега'}!\n\n` +
    `Я помогу вам:\n📊 Следить за портфелем БПЛА-компаний\n⚠️ Получать алерты по рискам\n📋 Смотреть решения инвесткомитета\n🤝 Контролировать сделки\n📈 Анализировать метрики фонда\n\n` +
    `*NAV: 6.4 млрд ₽ | 5 компаний | IRR 38%*\n\nИспользуйте кнопки меню ниже 👇`,
    { parse_mode:'Markdown', ...MENU }
  )
})
bot.onText(/^\/portfolio(@\w+)?$/, (msg) => sendPortfolio(msg.chat.id))
bot.onText(/^\/alerts(@\w+)?$/,   (msg) => sendAlerts(msg.chat.id))
bot.onText(/^\/fund(@\w+)?$/,     (msg) => sendFund(msg.chat.id))
bot.onText(/^\/deals(@\w+)?$/,    (msg) => sendDeals(msg.chat.id))
bot.onText(/^\/analytics(@\w+)?$/,(msg) => sendAnalytics(msg.chat.id))
bot.onText(/^\/help(@\w+)?$/,     (msg) => sendHelp(msg.chat.id))
bot.onText(/^\/status(@\w+)?$/,   async (msg) => {
  await bot.sendMessage(msg.chat.id,
    `✅ *Платформа ФСТ НТИ активна*\n\n🌐 fst.drondoc.ru\n🟢 Frontend: порт 5174\n🟢 Backend: порт 8082\n🟢 Bot: @fund_st_bot\n\n📊 Компаний: ${PORTFOLIO.length} | NAV: 6.4 млрд ₽`,
    { parse_mode:'Markdown', ...MENU }
  )
})

// Reply keyboard + автоматическое распознавание ссылок GitHub issues
bot.on('message', async (msg) => {
  const t = msg.text || ''
  if (t.startsWith('/')) return
  if (msg.voice) return // голосовые обрабатываются отдельно

  // Распознавание ссылки на GitHub issue → предложить solve
  const ghIssueMatch = t.match(/https:\/\/github\.com\/[\w\-]+\/[\w\-]+\/issues\/(\d+)/)
  if (ghIssueMatch && isAllowed(msg.from.id)) {
    const issueUrl = ghIssueMatch[0]
    return bot.sendMessage(msg.chat.id,
      `🔍 Обнаружен GitHub issue:\n${issueUrl}\n\nЗапустить solve (создать PR)?`,
      { reply_markup: { inline_keyboard: [[
        { text: '🔧 Запустить solve', callback_data: `solve_${issueUrl}` },
        { text: '❌ Отмена', callback_data: 'cancel' }
      ]] }}
    )
  }

  // Кнопки клавиатуры
  if (t === '📊 Портфель')     return sendPortfolio(msg.chat.id)
  if (t === '⚠️ Алерты')       return sendAlerts(msg.chat.id)
  if (t === '🏦 Фонд')         return sendFund(msg.chat.id)
  if (t === '📈 Аналитика')    return sendAnalytics(msg.chat.id)
  if (t === '🤝 Сделки')       return sendDeals(msg.chat.id)
  if (t === '❓ Помощь')       return sendHelp(msg.chat.id)
  if (t === '🌐 Открыть платформу') return bot.sendMessage(msg.chat.id, `🚀 ${URL}`, { reply_markup:{ inline_keyboard:[[{ text:'Открыть', url:URL }]] }})
  if (t === '📋 Протоколы ИК') return bot.sendMessage(msg.chat.id, '📋 Протоколы ИК:', { reply_markup:{ inline_keyboard:[[{ text:'Открыть', url:`${URL}/fst-protocol` }]] }})
})

// Inline callbacks
bot.on('callback_query', async (q) => {
  await bot.answerCallbackQuery(q.id)
  const d = q.data, chatId = q.message.chat.id, userId = q.from.id
  if (d === 'portfolio') return sendPortfolio(chatId)
  if (d === 'settings')  return bot.sendMessage(chatId, '🔔 Настройки уведомлений — в разработке.')
  if (d === 'cancel') { pendingParseFiles.delete(chatId); return bot.sendMessage(chatId, '❌ Отменено.') }
  if (d === 'parse_file') return handleParseFile(chatId, userId, 'parse')
  if (d === 'save_file_only') return handleParseFile(chatId, userId, 'save')
  if (d.startsWith('solve_') && isAllowed(userId)) {
    const issueUrl = d.slice(6)
    const requester = q.from.username ? `@${q.from.username}` : q.from.first_name
    return runSolve(bot, chatId, issueUrl, requester)
  }
  if (d.startsWith('co_')) {
    const c = PORTFOLIO.find(p => p.name === d.slice(3))
    if (!c) return
    await bot.sendMessage(chatId,
      `${c.st} *${c.name}*\n\n📦 Сектор: ${c.sector}\n💰 Выручка: ${c.rev}\n⏳ Runway: ${c.run}\n🔬 TRL: ${c.trl}/9\n📈 IRR: ${c.irr}\n\n` +
      (c.st==='🔴' ? '🚨 *ТРЕБУЕТ НЕМЕДЛЕННОГО ВНИМАНИЯ*' : c.st==='🟡' ? '⚠️ Усиленный мониторинг' : '✅ Показатели в норме'),
      { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[
        [{ text:'📊 Цифровой двойник', url:`${URL}/fst-twin` }, { text:'◀️ Назад', callback_data:'portfolio' }]
      ]}}
    )
  }
})

// ─── /solve — запустить hive-mind для issue фонда ────────────────────────────
bot.onText(/^\/solve/, async (msg) => {
  const chatId = msg.chat.id
  const userId = msg.from.id
  if (!isAllowed(userId)) return bot.sendMessage(chatId, '❌ У вас нет доступа к этой команде.')
  if (!GITHUB_TOKEN) return bot.sendMessage(chatId, '❌ GITHUB_TOKEN не настроен.\nДобавьте в backend/.env:\nGITHUB_TOKEN=ваш_токен')

  // Извлекаем аргумент из текста сообщения (после /solve)
  const arg = (msg.text || '').replace(/^\/solve\S*\s*/, '').trim()
  const issueUrl = resolveIssue(arg)
  if (!issueUrl) {
    return bot.sendMessage(chatId,
      `❌ Укажите номер или ссылку на issue.\n\nПримеры:\n/solve 42\n/solve https://github.com/unidel2035/fund/issues/42`,
      { parse_mode: 'Markdown' }
    )
  }

  const requester = msg.from.username ? `@${msg.from.username}` : msg.from.first_name
  await runSolve(bot, chatId, issueUrl, requester)
})

// ─── Получить открытые issues без черновых PR ────────────────────────────────
async function getOpenIssuesWithoutDrafts(owner, repo) {
  const headers = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'fst-fund-bot'
  }

  async function ghFetch(url, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) })
        if (!res.ok) throw new Error(`GitHub API ${res.status}: ${url}`)
        return res.json()
      } catch (err) {
        if (attempt === retries) throw err
        await new Promise(r => setTimeout(r, 2000 * attempt))
      }
    }
  }

  // Получаем все открытые issues (постранично, до 500)
  let issues = []
  for (let page = 1; page <= 5; page++) {
    const batch = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100&page=${page}`)
    const realIssues = batch.filter(i => !i.pull_request) // убираем PR из списка
    issues.push(...realIssues)
    if (batch.length < 100) break
  }

  // Получаем все открытые PR (включая черновики)
  let drafts = new Set()
  for (let page = 1; page <= 5; page++) {
    const prs = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=100&page=${page}`)
    for (const pr of prs) {
      if (pr.draft) {
        // Парсим номер issue из тела PR
        const body = (pr.body || '') + (pr.title || '')
        const refs = body.match(/(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)[:\s#]+(\d+)/gi) || []
        for (const ref of refs) {
          const num = ref.match(/(\d+)/)
          if (num) drafts.add(parseInt(num[1]))
        }
        // Также ищем в head branch названии (issue-123-...)
        const branchMatch = (pr.head?.ref || '').match(/issue-(\d+)/)
        if (branchMatch) drafts.add(parseInt(branchMatch[1]))
      }
    }
    if (prs.length < 100) break
  }

  // Фильтруем: только те issues, у которых нет черновика
  const filtered = issues.filter(i => !drafts.has(i.number))

  // Сортируем по приоритету P0→P1→P2→P3→без метки, внутри — по номеру (старые первые)
  const priority = label => {
    if (label === 'P0') return 0
    if (label === 'P1') return 1
    if (label === 'P2') return 2
    if (label === 'P3') return 3
    return 4
  }
  const issueP = issue => {
    const labels = (issue.labels || []).map(l => l.name)
    return Math.min(...labels.map(priority), 4)
  }
  filtered.sort((a, b) => {
    const pd = issueP(a) - issueP(b)
    return pd !== 0 ? pd : a.number - b.number
  })

  return filtered
}

// ─── /hive — найти все открытые issues без черновых PR и запустить solve ─────
bot.onText(/^\/hive(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id
  const userId = msg.from.id
  if (!isAllowed(userId)) return bot.sendMessage(chatId, '❌ У вас нет доступа к этой команде.')

  const arg = (match[1] || '').trim().toLowerCase()

  // /hive stop — остановить текущую сессию
  if (arg === 'stop') {
    if (hiveActive.get(chatId)) {
      hiveActive.set(chatId, false)
      return bot.sendMessage(chatId, '🛑 Hive остановлен. Текущая solve-сессия доработает до конца, следующая не запустится.')
    } else {
      return bot.sendMessage(chatId, 'ℹ️ Hive не запущен.')
    }
  }

  if (hiveActive.get(chatId)) {
    return bot.sendMessage(chatId, '⚠️ Hive уже запущен. Отправьте /hive stop чтобы остановить.')
  }

  if (!GITHUB_TOKEN) return bot.sendMessage(chatId, '❌ GITHUB_TOKEN не настроен.')

  await bot.sendMessage(chatId, `🐝 *Hive запускается...*\nПолучаю список открытых issues без черновых PR...\n${FUND_REPO}`, { parse_mode: 'Markdown' })

  let issues
  try {
    issues = await getOpenIssuesWithoutDrafts('unidel2035', 'fund')
  } catch (err) {
    return bot.sendMessage(chatId, `❌ Ошибка GitHub API: ${err.message}`)
  }

  if (issues.length === 0) {
    return bot.sendMessage(chatId, '✅ Нет открытых issues без черновых PR. Всё уже в работе!')
  }

  const requester = msg.from.username ? `@${msg.from.username}` : msg.from.first_name
  const priorityLabel = i => {
    const labels = (i.labels || []).map(l => l.name)
    const p = labels.find(l => /^P\d$/.test(l))
    return p ? `[${p}] ` : ''
  }
  await bot.sendMessage(chatId,
    `🐝 *Hive-сессия запущена*\n\n📋 Найдено issues: *${issues.length}* (сортировка P0→P3→#)\n\n` +
    issues.slice(0, 20).map(i => `${priorityLabel(i)}#${i.number} — ${i.title.slice(0, 55)}`).join('\n') +
    (issues.length > 20 ? `\n...и ещё ${issues.length - 20}` : '') +
    '\n\n⚙️ Запускаю по одному. Остановить: /hive stop',
    { parse_mode: 'Markdown' }
  )

  hiveActive.set(chatId, true)
  let done = 0, merged = 0, failed = 0

  for (let i = 0; i < issues.length; i++) {
    if (!hiveActive.get(chatId)) {
      await bot.sendMessage(chatId, `🛑 *Hive остановлен* после ${i} задач.`, { parse_mode: 'Markdown' })
      break
    }

    const issue = issues[i]
    const issueUrl = issue.html_url
    await bot.sendMessage(chatId,
      `🔄 *Задача ${i+1}/${issues.length}*: ${priorityLabel(issue)}#${issue.number} — ${issue.title.slice(0, 55)}`,
      { parse_mode: 'Markdown' }
    )
    try {
      const result = await runSolve(bot, chatId, issueUrl, `${requester} (hive ${i+1}/${issues.length})`)
      done++
      if (result?.success) {
        await autoMergePR(bot, chatId, issue.number)
        merged++
      } else {
        failed++
      }
    } catch (err) {
      failed++
      await bot.sendMessage(chatId, `⚠️ Issue #${issue.number}: ${err.message}`)
    }
  }

  hiveActive.delete(chatId)
  await bot.sendMessage(chatId,
    `🏁 *Hive завершён*\n\n✅ Успешно: ${done - failed}\n🎉 Слито PR: ${merged}\n❌ Ошибок: ${failed}\n📋 Всего: ${issues.length}`,
    { parse_mode: 'Markdown' }
  )
})

// ─── Голосовые сообщения — расшифровка + /solve ───────────────────────────────
bot.on('voice', async (msg) => {
  const chatId = msg.chat.id
  const userId = msg.from.id
  if (!isAllowed(userId)) return

  await bot.sendMessage(chatId, '🎙 Получено голосовое сообщение. Обрабатываю...')

  try {
    // Скачиваем файл
    const fileInfo = await bot.getFile(msg.voice.file_id)
    const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${fileInfo.file_path}`
    const tmpPath = path.join(os.tmpdir(), `fst-voice-${Date.now()}.ogg`)

    await new Promise((res, rej) => {
      const file = fs.createWriteStream(tmpPath)
      https.get(fileUrl, r => { r.pipe(file); file.on('finish', () => { file.close(); res() }) }).on('error', rej)
    })

    // Пробуем расшифровать через Python Whisper
    const pyScript = `
import sys
try:
    import whisper
    m = whisper.load_model("base")
    r = m.transcribe(sys.argv[1], language="ru")
    print(r["text"])
except ImportError:
    print("__NO_WHISPER__")
except Exception as e:
    print(f"__ERR__: {e}")
`
    const scriptPath = path.join(os.tmpdir(), 'fst_whisper.py')
    fs.writeFileSync(scriptPath, pyScript)

    let transcription = null
    try {
      const { stdout } = await execFileAsync('python3', [scriptPath, tmpPath], { timeout: 60000 })
      const text = stdout.trim()
      if (text && !text.startsWith('__')) transcription = text
    } catch {}

    fs.unlink(tmpPath, () => {})

    if (!transcription) {
      return bot.sendMessage(chatId,
        '⚠️ Расшифровка недоступна (нужен Whisper: pip install openai-whisper).\n\n' +
        'Используйте текстовые команды:\n/solve <номер> — запустить solve\n/hive — запустить мониторинг'
      )
    }

    await bot.sendMessage(chatId, `📝 Распознано: _${transcription}_`, { parse_mode: 'Markdown' })

    // Ищем ссылку/номер issue в тексте
    const issueUrl = extractIssue(transcription)
    if (issueUrl && isAllowed(userId)) {
      await bot.sendMessage(chatId,
        `🔍 Обнаружен issue: ${issueUrl}\n\nЗапустить solve?`,
        { reply_markup: { inline_keyboard: [[
          { text: '✅ Запустить solve', callback_data: `solve_${issueUrl}` },
          { text: '❌ Отмена', callback_data: 'cancel' }
        ]] }}
      )
    }
  } catch (err) {
    bot.sendMessage(chatId, `❌ Ошибка: ${err.message}`)
  }
})

// ─── Обработка документов: PPTX/PDF → парсинг компаний ──────────────────────
const PARSEABLE_EXTENSIONS = ['.pptx', '.ppt', '.pdf', '.xlsx']
const pendingParseFiles = new Map() // chatId → { fileId, fileName, fileSize }

bot.on('document', async (msg) => {
  const doc = msg.document
  if (!doc) return

  const fileName = doc.file_name || 'unknown'
  const ext = path.extname(fileName).toLowerCase()
  const chatId = msg.chat.id

  if (!PARSEABLE_EXTENSIONS.includes(ext)) return

  const sizeMb = (doc.file_size / 1024 / 1024).toFixed(1)
  pendingParseFiles.set(chatId, {
    fileId: doc.file_id,
    fileName,
    fileSize: doc.file_size,
    from: msg.from?.username || msg.from?.first_name || 'unknown'
  })

  await bot.sendMessage(chatId,
    `📄 *Получен файл:* \`${fileName}\` (${sizeMb} МБ)\n\n` +
    `Тип: ${ext.toUpperCase().slice(1)}\n` +
    `Могу распарсить и загрузить компании/метрики в базу ФСТ.`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔍 Парсить → Integram', callback_data: 'parse_file' },
            { text: '📥 Только сохранить', callback_data: 'save_file_only' },
          ],
          [{ text: '❌ Отмена', callback_data: 'cancel' }]
        ]
      }
    }
  )
})

// Callback для парсинга файла
async function handleParseFile(chatId, userId, parseMode) {
  const fileInfo = pendingParseFiles.get(chatId)
  if (!fileInfo) return bot.sendMessage(chatId, '❌ Файл не найден. Отправьте файл заново.')
  pendingParseFiles.delete(chatId)

  await bot.sendChatAction(chatId, 'typing')
  await bot.sendMessage(chatId, `⏳ Скачиваю \`${fileInfo.fileName}\`...`, { parse_mode: 'Markdown' })

  try {
    // Download file from Telegram
    const file = await bot.getFile(fileInfo.fileId)
    const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`
    const res = await fetch(fileUrl)
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())

    // Save to temp
    const tmpDir = path.join(os.tmpdir(), 'fst-bot-files')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    const tmpPath = path.join(tmpDir, `${Date.now()}_${fileInfo.fileName}`)
    fs.writeFileSync(tmpPath, buffer)

    await bot.sendMessage(chatId, `✅ Скачано (${(buffer.length / 1024 / 1024).toFixed(1)} МБ).\n⏳ Запускаю парсинг...`)

    if (parseMode === 'parse') {
      // Run parse-fst-pptx.mjs
      const child = spawn('node', ['backend/parse-fst-pptx.mjs', '--file', tmpPath], {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, PATH: process.env.PATH },
        timeout: 300000
      })

      let stdout = '', stderr = ''
      child.stdout.on('data', d => { stdout += d.toString() })
      child.stderr.on('data', d => { stderr += d.toString() })

      child.on('close', async (code) => {
        // Cleanup
        try { fs.unlinkSync(tmpPath) } catch {}

        if (code === 0) {
          // Extract summary from output
          const created = (stdout.match(/Created: (\d+)/)?.[1]) || '?'
          const updated = (stdout.match(/Updated: (\d+)/)?.[1]) || '?'
          const metrics = (stdout.match(/Metrics: (\d+)/)?.[1]) || '?'

          await bot.sendMessage(chatId,
            `✅ *Парсинг завершён!*\n\n` +
            `📦 Компаний создано: ${created}\n` +
            `🔄 Обновлено: ${updated}\n` +
            `📊 Метрик: ${metrics}\n\n` +
            `Файл: \`${fileInfo.fileName}\`\nОтправитель: ${fileInfo.from}`,
            {
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [[
                { text: '📊 Открыть портфель', url: 'https://ai2fund.ru/fst-portfolio' }
              ]] }
            }
          )
        } else {
          const errMsg = stderr.slice(-500) || stdout.slice(-500) || 'Unknown error'
          await bot.sendMessage(chatId, `❌ Ошибка парсинга (exit ${code}):\n\`\`\`\n${errMsg.slice(0, 1000)}\n\`\`\``, { parse_mode: 'Markdown' })
        }
      })
    } else {
      // save_file_only: upload to Integram storage
      // Create object in type 53253 (Медиа) as top-level
      const formParams = new URLSearchParams({
        _xsrf: '',
        [`t1069`]: fileInfo.fileName,
        [`t1236`]: `Загружено ботом от ${fileInfo.from} ${new Date().toLocaleDateString('ru-RU')}`,
        up: '1',
      })

      // Auth to Integram
      const authRes = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/auth?JSON_KV`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `login=${encodeURIComponent(process.env.INTEGRAM_SYSTEM_USERNAME)}&pwd=${encodeURIComponent(process.env.INTEGRAM_SYSTEM_PASSWORD)}`
      })
      const authData = await authRes.json()
      if (!authData.token) throw new Error('Integram auth failed')

      const xsrfRes = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/xsrf?JSON_KV`, {
        headers: { 'X-Authorization': authData.token }
      })
      const xsrfData = await xsrfRes.json()

      // Create object in type 1069 (Документы)
      formParams.set('_xsrf', xsrfData._xsrf || '')
      const createRes = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/_m_new/1069?full=1&JSON_KV`, {
        method: 'POST',
        headers: {
          'X-Authorization': authData.token,
          Cookie: `${INTEGRAM_DB}=${authData.token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formParams,
      })
      const createData = await createRes.json()
      const objId = createData.id || createData.obj

      if (objId) {
        // Upload file
        const boundary = '----BotBoundary' + Date.now()
        const parts = []
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="_xsrf"\r\n\r\n${xsrfData._xsrf || ''}`)
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="t1234"; filename="${fileInfo.fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`)
        const header = Buffer.from(parts.join('\r\n') + '\r\n')
        const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
        const body = Buffer.concat([header, buffer, footer])

        await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/_m_save/${objId}?JSON_KV`, {
          method: 'POST',
          headers: {
            'X-Authorization': authData.token,
            Cookie: `${INTEGRAM_DB}=${authData.token}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body,
        })

        await bot.sendMessage(chatId,
          `✅ Файл сохранён в Integram\n\n📄 \`${fileInfo.fileName}\`\n🆔 Объект #${objId}`,
          { parse_mode: 'Markdown' }
        )
      }

      try { fs.unlinkSync(tmpPath) } catch {}
    }
  } catch (err) {
    console.error('[FST Bot] Parse file error:', err)
    await bot.sendMessage(chatId, `❌ Ошибка: ${err.message}`)
  }
}

bot.on('polling_error', (err) => {
  console.error('[FST Bot] polling_error:', err.code, err.message)
  if (err.code === 'EFATAL' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
    console.log('[FST Bot] Restarting polling in 5s...')
    setTimeout(() => {
      bot.startPolling().catch(e => console.error('[FST Bot] restart failed:', e.message))
    }, 5000)
  }
})
process.on('uncaughtException', (err) => console.error('[FST Bot] uncaughtException:', err.message))
process.on('unhandledRejection', (err) => console.error('[FST Bot] unhandledRejection:', err?.message || err))
process.on('SIGINT', () => { bot.stopPolling(); process.exit(0) })
process.on('SIGTERM', () => { bot.stopPolling(); process.exit(0) })

// Set commands menu & description
bot.setMyCommands([
  { command:'start',     description:'🏠 Главное меню' },
  { command:'portfolio', description:'📊 Портфель компаний' },
  { command:'alerts',    description:'⚠️ Активные алерты' },
  { command:'fund',      description:'🏦 Показатели фонда' },
  { command:'deals',     description:'🤝 Сделки и транши' },
  { command:'analytics', description:'📈 Аналитика' },
  { command:'status',    description:'✅ Статус платформы' },
  { command:'help',      description:'❓ Справка' },
]).then(() => console.log('[FST Bot] ✅ Commands set'))

fetch(`https://api.telegram.org/bot${TOKEN}/setMyDescription`, {
  method:'POST', headers:{'Content-Type':'application/json'},
  body: JSON.stringify({ description: '🛡️ Официальный бот Фонда суверенных технологий НТИ\n\nМониторинг портфеля БПЛА/РОБО/МЭ компаний, алерты по рискам, решения инвесткомитета и аналитика фонда.\n\n💰 NAV 6.4 млрд ₽ | 5 компаний | IRR 38%\n🌐 fst.drondoc.ru' })
}).then(() => console.log('[FST Bot] ✅ Description set'))

fetch(`https://api.telegram.org/bot${TOKEN}/setMyShortDescription`, {
  method:'POST', headers:{'Content-Type':'application/json'},
  body: JSON.stringify({ short_description: '🛡️ ФСТ НТИ — мониторинг портфеля и аналитика венчурного фонда' })
}).then(() => console.log('[FST Bot] ✅ Short description set'))

console.log('[FST Bot] ✅ @fund_st_bot ready')

// ─── Mini App кнопка в /start (добавить WebApp) ───────────────────────────────
// Уже обработан выше, но добавляем inline кнопку с WebApp
bot.onText(/^\/app(@\w+)?$/, async (msg) => {
  await bot.sendMessage(msg.chat.id,
    `📱 *Мини-приложение ФСТ НТИ*\n\nОткройте полный дашборд прямо в Telegram:\n• 📊 Портфель с деталями компаний\n• ⚠️ Алерты в реальном времени\n• 🤖 История решений ИК\n• 💬 AI-ассистент фонда`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '📱 Открыть Mini App', web_app: { url: 'https://fst.drondoc.ru/fst-mini' } }
        ]]
      }
    }
  )
})

// ─── AI-ассистент: /ask и свободные вопросы ───────────────────────────────────
const PORTFOLIO_CONTEXT = `
Портфель ФСТ НТИ (5 компаний):
- АвиаЛогик (БАС): выручка 18 млн, runway 14 мес, TRL 6, IRR 34% — НОРМА
- МикроСхема (МЭ): выручка 42 млн, runway 7 мес, TRL 7, IRR 28% — ВНИМАНИЕ
- АэроСпектр (БАС): выручка 8 млн, runway 3 мес, TRL 5, IRR 12% — КРИТИЧНО
- РобоМакс (РОБО): выручка 31 млн, runway 22 мес, TRL 7, IRR 41% — НОРМА
- ДронСервис (БАС): выручка 55 млн, runway 18 мес, TRL 8, IRR 52% — НОРМА
NAV: 6.4 млрд ₽, AUM: 8.2 млрд ₽, IRR фонда: 38%, субфонды: БАС/РОБО/МЭ`

const userContexts = {}

async function askAI(chatId, question) {
  const apiUrl = process.env.MONOLITH_API_URL || 'http://localhost:8081'
  try {
    const res = await fetch(`${apiUrl}/api/ai-tokens/public-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt: question,
        systemPrompt: `Ты AI-ассистент венчурного фонда ФСТ НТИ. Отвечай коротко, по делу, на русском (2-4 предложения).\n${PORTFOLIO_CONTEXT}`,
        application: 'FstBot',
      })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.response || data.content || data.message || null
  } catch (e) {
    console.error('[FST Bot] AI error:', e.message)
    return null
  }
}

bot.onText(/^\/ask (.+)/, async (msg, match) => {
  const q = match[1]
  const typing = bot.sendChatAction(msg.chat.id, 'typing')
  const answer = await askAI(msg.chat.id, q)
  await typing
  if (answer) {
    await bot.sendMessage(msg.chat.id, `🤖 *AI Ассистент*\n\n${answer}`, { parse_mode: 'Markdown' })
  } else {
    await bot.sendMessage(msg.chat.id,
      `🤖 *AI Ответ*\n\nАнализирую вопрос: _"${q}"_\n\nДля точных данных откройте платформу:`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🌐 Открыть платформу', url: 'https://fst.drondoc.ru/fst-intelligence' }]] }}
    )
  }
})

// Обновить список команд
setTimeout(() => {
  bot.setMyCommands([
    { command:'start',     description:'🏠 Главное меню' },
    { command:'portfolio', description:'📊 Портфель компаний' },
    { command:'alerts',    description:'⚠️ Активные алерты' },
    { command:'fund',      description:'🏦 Показатели фонда' },
    { command:'deals',     description:'🤝 Сделки и транши' },
    { command:'analytics', description:'📈 Аналитика' },
    { command:'solve',     description:'🔧 Запустить solve для issue (пример: /solve 42)' },
    { command:'hive',      description:'🐝 Запустить hive для репозитория фонда' },
    { command:'app',       description:'📱 Мини-приложение' },
    { command:'ask',       description:'🤖 AI-вопрос (пример: /ask IRR портфеля?)' },
    { command:'status',    description:'✅ Статус платформы' },
    { command:'help',      description:'❓ Справка' },
  ]).then(() => console.log('[FST Bot] ✅ Команды обновлены'))
}, 2000)
