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

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
if (!TOKEN) { console.error('TELEGRAM_BOT_TOKEN not set'); process.exit(1) }

const bot = new TelegramBot(TOKEN, { polling: true })
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
bot.onText(/\/start/, async (msg) => {
  await bot.sendMessage(msg.chat.id,
    `🛡️ *Фонд суверенных технологий НТИ*\n\nДобро пожаловать, ${msg.from.first_name || 'коллега'}!\n\n` +
    `Я помогу вам:\n📊 Следить за портфелем БПЛА-компаний\n⚠️ Получать алерты по рискам\n📋 Смотреть решения инвесткомитета\n🤝 Контролировать сделки\n📈 Анализировать метрики фонда\n\n` +
    `*NAV: 6.4 млрд ₽ | 5 компаний | IRR 38%*\n\nИспользуйте кнопки меню ниже 👇`,
    { parse_mode:'Markdown', ...MENU }
  )
})
bot.onText(/\/portfolio/, (msg) => sendPortfolio(msg.chat.id))
bot.onText(/\/alerts/,   (msg) => sendAlerts(msg.chat.id))
bot.onText(/\/fund/,     (msg) => sendFund(msg.chat.id))
bot.onText(/\/deals/,    (msg) => sendDeals(msg.chat.id))
bot.onText(/\/analytics/,(msg) => sendAnalytics(msg.chat.id))
bot.onText(/\/help/,     (msg) => sendHelp(msg.chat.id))
bot.onText(/\/status/,   async (msg) => {
  await bot.sendMessage(msg.chat.id,
    `✅ *Платформа ФСТ НТИ активна*\n\n🌐 fst.drondoc.ru\n🟢 Frontend: порт 5174\n🟢 Backend: порт 8082\n🟢 Bot: @fund_st_bot\n\n📊 Компаний: ${PORTFOLIO.length} | NAV: 6.4 млрд ₽`,
    { parse_mode:'Markdown', ...MENU }
  )
})

// Reply keyboard
bot.on('message', async (msg) => {
  const t = msg.text || ''
  if (t.startsWith('/')) return
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
  const d = q.data, chatId = q.message.chat.id
  if (d === 'portfolio') return sendPortfolio(chatId)
  if (d === 'settings')  return bot.sendMessage(chatId, '🔔 Настройки уведомлений — в разработке.')
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

bot.on('polling_error', (err) => console.error('[FST Bot]', err.message))
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
bot.onText(/\/app/, async (msg) => {
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

bot.onText(/\/ask (.+)/, async (msg, match) => {
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
    { command:'app',       description:'📱 Мини-приложение' },
    { command:'ask',       description:'🤖 AI-вопрос (пример: /ask IRR портфеля?)' },
    { command:'status',    description:'✅ Статус платформы' },
    { command:'help',      description:'❓ Справка' },
  ]).then(() => console.log('[FST Bot] ✅ Commands updated with /app and /ask'))
}, 2000)
