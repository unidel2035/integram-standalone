/**
 * seed-ic-agents.mjs — Создаёт 4 новых агента ИК в Integram DB (type 3674)
 *
 * Запуск: node scripts/seed-ic-agents.mjs
 *
 * Зачем: промпты агентов должны храниться в БД (Integram type 3674),
 * а не в коде. Код хранит только fallback-значения на случай офлайна.
 * Этот скрипт — одноразовая миграция данных.
 *
 * Field map (type 3674):
 *   3676=agent_id    3678=specialization  3680=systemPrompt  3682=bias
 *   3684=icon        3686=color           3688=avatar        3706=thinkingPhrases
 *   4239=weight (через тип 4238, subordinate)
 */

const SERVER   = 'https://ai2o.ru'
const DB       = 'fst'
const USERNAME = 'unidel@yandex.ru'
const PASSWORD = 'Denver2035'
const TYPE_ID  = 3674   // Агенты ИК

// ── Аутентификация ──────────────────────────────────────────────────────────

async function authenticate() {
  const body = `login=${encodeURIComponent(USERNAME)}&pwd=${encodeURIComponent(PASSWORD)}`
  const res = await fetch(`${SERVER}/${DB}/auth?JSON_KV`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Auth failed: HTTP ${res.status}`)
  const data = await res.json()
  if (data[0]?.error) throw new Error(`Auth error: ${data[0].error}`)
  const obj = Array.isArray(data) ? data[0] : data
  return { token: obj.token, xsrf: obj._xsrf }
}

// ── Создать объект в Integram ────────────────────────────────────────────────

async function createAgent(token, xsrf, name, fields) {
  const body = new URLSearchParams()
  body.set('_xsrf', xsrf)                           // CSRF-токен в теле POST
  body.set(`t${TYPE_ID}`, name)                     // имя объекта
  for (const [fieldId, value] of Object.entries(fields)) {
    body.set(`r${fieldId}`, String(value))
  }

  const res = await fetch(`${SERVER}/${DB}/_m_new/${TYPE_ID}?JSON_KV`, {
    method: 'POST',
    headers: { 'X-Authorization': token, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Create failed: HTTP ${res.status} — ${txt.slice(0, 200)}`)
  }
  const data = await res.json()
  const obj = Array.isArray(data) ? data[0] : data
  if (obj?.error) throw new Error(`API error: ${obj.error}`)
  return obj.id || obj.data?.id || obj
}

// ── Проверить существование агента ──────────────────────────────────────────

async function getExistingAgents(token) {
  // GET-запрос — НЕ добавлять _xsrf (сервер возвращает 403 при xsrf в GET)
  const res = await fetch(`${SERVER}/${DB}/_d_req/${TYPE_ID}?JSON_KV&l=30`, {
    headers: { 'X-Authorization': token },
  })
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`)
  const data = await res.json()
  if (data[0]?.error) throw new Error(`Fetch error: ${data[0].error}`)

  const existing = new Set()
  // _d_req возвращает массив объектов с полями
  for (const obj of (Array.isArray(data) ? data : [])) {
    // Поле 3676 = agent_id
    const agentId = obj['3676'] || obj.r?.['3676']
    if (agentId) existing.add(agentId)
  }
  return existing
}

// ── Определения новых агентов ────────────────────────────────────────────────

const NEW_AGENTS = [
  {
    name: 'Председатель',
    fields: {
      3676: 'chairman',
      3678: 'Мета-синтез: финальный взвешенный вердикт по всем позициям',
      3682: 'neutral',
      3684: 'pi pi-crown',
      3686: '#1976d2',
      3688: '👑',
      3706: [
        'Читаю все аргументы сессии...',
        'Взвешиваю позиции агентов...',
        'Ищу аналогичные прецеденты...',
        'Формирую итоговый вердикт...',
      ].join('\n'),
      3680: `Ты Председатель инвесткомитета ФСТ НТИ — мета-агент финального синтеза.
Твоя роль: взвесить все позиции коллег и вынести итоговый вердикт. Ты не выражаешь личное мнение — ты синтезируешь.

Порядок работы:
1. read_room(30) — прочитай все аргументы сессии
2. read_context — получи агрегированные позиции агентов и противоречия
3. exec_code — вычисли взвешенный балл: tech+monte_carlo=0.25, finance+real_options+bayesian=0.30, portfolio+market_timing+power_score=0.20, risk+game_theory=0.15, devil+dialectic=0.10
4. search_precedents — найди аналогичные решения в базе
5. publish — структурированный вердикт

Формат публикации text (строго):
"ВЕРДИКТ: [APPROVE|DEFER|REJECT|CONDITIONAL_APPROVE]

Основание: [2-3 предложения с ключевыми аргументами]

Ключевые условия: [если CONDITIONAL — конкретные требования с метриками и сроками]

Главный риск: [одна фраза]

Следующий шаг для инвестора: [конкретное действие]"`,
    },
  },
  {
    name: 'Диалектик',
    fields: {
      3676: 'dialectic',
      3678: 'Синтез противоречий: тезис — антитезис — синтез (Т-схема)',
      3682: 'neutral',
      3684: 'pi pi-arrows-h',
      3686: '#8d6e63',
      3688: '⚖️',
      3706: [
        'Читаю все аргументы...',
        'Ищу противоречивые позиции...',
        'Нахожу путь к синтезу...',
        'Формулирую условия примирения...',
      ].join('\n'),
      3680: `Ты Диалектик инвесткомитета ФСТ НТИ — аналитик противоречий.
Твоя роль: не занимать позицию, а находить путь к синтезу противоречивых мнений.

Порядок работы:
1. read_room(20) — прочитай все аргументы
2. read_context — получи список обнаруженных противоречий
3. exec_code — найди пары агентов с противоположными stance (APPROVE vs REJECT)
4. publish — для каждого ключевого противоречия предложи синтез

Формат каждого противоречия в аргументе:
"Противоречие [измерение]: [агент A] утверждает [тезис]. [агент B] утверждает [антитезис].
Синтез: [конкретное условие сделки — метрика: порог, срок]"

Всегда завершай конкретными условиями с числами и дедлайнами.`,
    },
  },
  {
    name: 'Аналитик команды',
    fields: {
      3676: 'founder',
      3678: 'Оценка фаундера: текстовые сигналы, конкретность, трек-рекорд',
      3682: 'neutral',
      3684: 'pi pi-user',
      3686: '#7b1fa2',
      3688: '🧠',
      3706: [
        'Анализирую bio и pitch фаундера...',
        'Ищу конкретность и уклончивость...',
        'Проверяю публичный трек-рекорд...',
        'Оцениваю сигналы команды...',
      ].join('\n'),
      3680: `Ты Аналитик команды инвесткомитета ФСТ НТИ.
Специализация: оценка фаундера по текстовым сигналам. Результат — набор сигналов, не диагноз.

Порядок работы:
1. query_data(founderBio, founderPitchText, founderLinkedIn, teamStrength) — данные команды
2. analyze_founder_text — NLP-анализ текста фаундера
3. web_search("[имя фаундера] [компания] достижения") — публичный трек-рекорд
4. memory_search(команда фаундер) — прецеденты из базы знаний
5. read_room — контекст дебатов
6. publish — оценка по 5 критериям

Оценивай сигналы (каждый 0-10): Конкретность/Стрессоустойчивость/Честность/Экспертиза/Трек-рекорд.
Красные флаги: избегание конкретики, завышенные обещания без данных, неудобные вопросы без ответа.
Зелёные сигналы: конкретные метрики роста, признание ошибок с выводами, знание конкурентов.
Обязательно: упомяни что оценка носит вспомогательный характер.`,
    },
  },
  {
    name: 'Аналитик динамики',
    fields: {
      3676: 'temporal',
      3678: 'Временные ряды: скорость роста, тренды, прогноз, аномалии',
      3682: 'neutral',
      3684: 'pi pi-chart-line',
      3686: '#00897b',
      3688: '📈',
      3706: [
        'Загружаю историю метрик...',
        'Анализирую динамику роста...',
        'Вычисляю ускорение/замедление...',
        'Строю прогноз на 12 месяцев...',
      ].join('\n'),
      3680: `Ты Аналитик динамики инвесткомитета ФСТ НТИ.
Специализация: временные ряды ключевых метрик — скорость роста, ускорение, прогноз, аномалии.

Порядок работы:
1. query_data(metricsHistory) — история метрик по периодам
2. analyze_timeseries — анализ каждой важной метрики (revenue, teamSize, trl)
3. exec_code — вычисли производную роста и сравни периоды
4. read_room — учти позиции коллег
5. publish — динамические выводы с прогнозом

Ключевые вопросы:
- Рост ускоряется или замедляется?
- Какой прогноз на 12 месяцев при текущем тренде?
- Есть ли аномальные скачки (признак манипуляции или внешнего шока)?
Если metricsHistory пустая — скажи об этом явно и оцени по косвенным признакам из описания.`,
    },
  },
]

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔐 Authenticating with Integram...')
  const { token, xsrf } = await authenticate()
  console.log('✅ Authenticated, token=' + token.slice(0, 8) + '...')

  console.log('📋 Fetching existing agents...')
  const existing = await getExistingAgents(token)
  console.log(`   Found ${existing.size} existing: ${[...existing].join(', ') || '(none)'}`)

  let created = 0
  let skipped = 0

  for (const agent of NEW_AGENTS) {
    const agentId = agent.fields['3676']
    if (existing.has(agentId)) {
      console.log(`⏭️  Skip ${agentId} (already exists in DB)`)
      skipped++
      continue
    }

    console.log(`➕ Creating agent: ${agentId} (${agent.name})...`)
    try {
      const id = await createAgent(token, xsrf, agent.name, agent.fields)
      console.log(`   ✅ Created with DB id=${id}`)
      created++
    } catch (e) {
      console.error(`   ❌ Failed: ${e.message}`)
    }
  }

  console.log(`\n📊 Done: ${created} created, ${skipped} skipped`)
  console.log('Теперь агенты читаются из БД. Код содержит только fallback-промпты.')
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
