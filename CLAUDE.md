# CLAUDE.md — VentureOS Platform

## Что это за репозиторий

**VentureOS** — AI-платформа управления венчурным фондом.  
Покрывает полный цикл: заявка → AI-инвесткомитет → сделка → мониторинг → выход.

**Live demo:** https://dev.drondoc.ru  
**Issues / Roadmap:** https://github.com/unidel2035/found/issues

---

## Режимы работы агента

### 1. Инвестор задаёт вопросы о платформе
→ Читай `INVESTOR_AGENT.md` — там demo-данные, ответы на частые вопросы, маршруты

### 2. Разработчик / директор работает с кодом
→ Читай ниже (архитектура, правила, команды)

---

## Структура проекта

```
found/
├── src/
│   ├── views/pages/         # Страницы (Fst*.vue — модули фонда)
│   │   ├── FstHub.vue       # /fst — хаб всех модулей
│   │   ├── FstCommittee.vue # /fst-committee — AI инвесткомитет
│   │   ├── FstDeal.vue      # /fst-deal — сделка + финмодель
│   │   ├── FstPortfolio.vue # /fst-portfolio — мониторинг портфеля
│   │   ├── FstExecution.vue # /fst-execution — исполнение/Kanban
│   │   ├── FstDigitalTwin.vue  # /fst-twin — ЦД компании
│   │   ├── FstFundTwin.vue  # /fst-fund — ЦД фонда
│   │   └── FstDirector.vue  # /fst-director — обучение директора
│   ├── components/          # UI компоненты
│   │   └── integram/        # DataTable, AI-кнопка, диалоги
│   ├── services/            # aiTokenService, workspaceAIAgentService
│   ├── templates/finmodel/  # JSON-шаблоны финмоделей
│   ├── config/
│   │   ├── routeDescriptions.js  # SEO и описания маршрутов
│   │   └── router/index.js       # Vue Router
│   └── stores/              # Pinia stores
├── backend/monolith/
│   ├── src/api/routes/      # Express REST эндпоинты
│   │   ├── ai-tokens.js     # POST /api/ai-tokens/chat
│   │   └── mcp.js           # POST /api/mcp/integram/chat
│   ├── src/core/
│   │   └── TokenBasedLLMCoordinator.js  # LLM роутер
│   └── scripts/             # koda-*.cjs — AI QA/review скрипты
├── docs/
│   ├── architecture.md      # Полная архитектура
│   ├── database.md          # Схема Integram БД
│   └── setup.md             # Деплой и настройка
├── INVESTOR_AGENT.md        # Контекст для агента-инвестора
└── CLAUDE.md                # Этот файл
```

---

## Ключевые маршруты

| Маршрут | Файл | Назначение |
|---------|------|-----------|
| `/fst` | FstHub.vue | Хаб — все модули фонда |
| `/fst-committee` | FstCommittee.vue | AI-инвесткомитет (6 агентов) |
| `/fst-deal` | FstDeal.vue | Сделка: SPV, транши, Term Sheet, финмодель |
| `/fst-portfolio` | FstPortfolio.vue | Портфель: светофор, датчики, AI-отчёты |
| `/fst-execution` | FstExecution.vue | Исполнение: Kanban, KPI, действия фонда |
| `/fst-twin` | FstDigitalTwin.vue | ЦД компании: симуляция tick-engine |
| `/fst-fund` | FstFundTwin.vue | ЦД фонда: NAV, IRR, субфонды |
| `/fst-director` | FstDirector.vue | Обучение директора + каталог агентов |
| `/onto` | OntologySpace.vue | Онтология БПЛА (~1100 концептов) |
| `/spaces` | Spaces.vue | Каталог всех агентов платформы |

---

## Технический стек

```
Frontend:  Vue 3 (Composition API) + Vite + PrimeVue + Pinia
           HyperFormula (финмодели) + Chart.js + vue-i18n
Backend:   Node.js ESM монолит + Express + Socket.io
Database:  Integram (NoSQL на ai2o.ru) + SQLite (кеш)
AI:        DeepSeek (default) / Claude / GPT-4o / YandexGPT
           → через POST /api/ai-tokens/chat
           → body: { modelId, prompt, systemPrompt, application }
Knowledge: KAG (hybrid vector+graph), ~1100 UAV концептов в kval
Protocol:  MCP (60+ Integram-инструментов для агентов)
Infra:     systemd (НЕ pm2), SOCKS5:9050, Telegram Bot
```

---

## AI вызовы — как работает

```javascript
// Стандартный вызов (фронтенд)
const resp = await fetch('/api/ai-tokens/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    modelId: 'anthropic/claude-sonnet-4-20250514',
    prompt: userMessage,
    systemPrompt: 'Ты — ...',
    application: 'ModuleName'  // для tracking
  })
})
const { response } = await resp.json()
```

**Доступные модели:**
- `anthropic/claude-sonnet-4-20250514` — стратегический анализ, длинные тексты
- `deepseek/deepseek-chat` — быстро, код, структурированные данные
- `openai/gpt-4o` — мультимодальные задачи
- `yandex/yandexgpt` — русскоязычный контент

---

## Integram API (база данных)

```
Server:   ai2o.ru
Auth:     POST /{db}/auth → { token, _xsrf }
Header:   X-Authorization: {token}
XSRF:     в теле запроса, НЕ в заголовке

Создать:  POST /{db}/_m_new/{typeId}  body: t{typeId}=name&r{reqId}=val
Обновить: POST /{db}/_m_set/{id}      body: t{reqId}=val
Читать:   GET  /{db}/_d_req/{typeId}?JSON_KV&l=100
```

**Ключевые базы:**
- `my` — пользователи, токены AI, категории агентов
- `kval` — онтология БПЛА (type 1673250: ~1140 концептов)
- `fst` — данные фонда (сделки, портфель, события ИК)

---

## Правила разработки

1. **Ветка:** `dev` (основная), PR → `dev`
2. **Сервисы:** systemd, НЕ pm2
   - `sudo systemctl restart dronedoc-backend`
   - `sudo systemctl restart dronedoc-frontend`
3. **Тема:** Только PrimeVue CSS переменные (`var(--p-surface-card)`), никаких хардкод цветов
4. **БД:** Только Integram MCP — никакого PostgreSQL/MySQL
5. **AI:** Только через token router `/api/ai-tokens/chat` — никаких прямых API-ключей на фронте
6. **Новый маршрут → обязательно добавить в:**
   - `src/router/index.js`
   - `src/config/routeDescriptions.js`
   - `src/views/pages/Spaces.vue`

---

## Koda-скрипты (бесплатный AI для QA)

```bash
cd backend/monolith

node scripts/koda-site-tester.cjs /fst-committee --full   # тест страницы
node scripts/koda-code-reviewer.cjs --commit HEAD~3..HEAD  # ревью кода
node scripts/koda-api-tester.cjs --auth                   # тест API
node scripts/koda-deploy-checker.cjs                      # состояние деплоя
```

---

## Окружение (.env)

```env
# Backend (backend/monolith/.env)
DEEPSEEK_API_KEY=sk-...
INTEGRAM_SERVER_URL=ai2o.ru
INTEGRAM_SYSTEM_USERNAME=d
INTEGRAM_SYSTEM_PASSWORD=d
TELEGRAM_BOT_TOKEN=...
GITHUB_TOKEN=...         # для Koda (бесплатный AI)
YANDEX_API_KEY=...
YANDEX_FOLDER_ID=...
```

---

## Roadmap issues

https://github.com/unidel2035/found/issues — 47+ задач с приоритетами P0/P1/P2/P3

**P0 (критический путь):**
- #35 Waterfall & carried interest
- #40 ILPA LP-отчётность
- #36 Government relations dashboard
- #46 Back-office & ФСБУ 4/2023

**P1 (следующий квартал):**
- #33 AML/KYC compliance
- #34 ESG scoring
- #38 Нацпроект БАС tracker
- #41 AI-ускоренный due diligence
- #45 Реестр БПЛА (Постановление №1726)

---

Issue to solve: https://github.com/unidel2035/found/issues/26
Your prepared branch: issue-26-11145280476b
Your prepared working directory: /tmp/gh-issue-solver-1772845772883

Proceed.


Run timestamp: 2026-03-07T01:09:37.114Z

---

Issue to solve: https://github.com/unidel2035/found/issues/29
Your prepared branch: issue-29-cb5a8a2a5bf8
Your prepared working directory: /tmp/gh-issue-solver-1772868902888

Proceed.


Run timestamp: 2026-03-07T07:35:05.711Z