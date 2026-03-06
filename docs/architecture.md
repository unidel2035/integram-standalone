# Архитектура платформы VentureOS

> Документация архитектуры Фонда

---

## 1. Общая структура

VentureOS — это AI-powered платформа управления венчурным фондом, покрывающая полный инвестиционный цикл:

```
┌─────────────────────────────────────────────────────────┐
│                    VentureOS Platform                    │
├──────────────┬──────────────┬──────────────┬────────────┤
│  AI Agent    │  Ontology    │  Digital     │  Financial │
│  Network     │  Engine      │  Twins       │  Engine    │
├──────────────┴──────────────┴──────────────┴────────────┤
│              Integram Data Layer (NoSQL + Graph)         │
├─────────────────────────────────────────────────────────┤
│      KAG — Knowledge Augmented Graph (Vector + Graph)   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Компоненты платформы

### 2.1 Frontend (Vue 3)

**Технологии:**
- Vue 3 (Composition API)
- Vite (сборка)
- PrimeVue (UI-компоненты)
- Pinia (state management)
- vue-router (маршрутизация)
- HyperFormula (финансовые модели)
- Socket.io-client (WebSocket)

**Структура:**
```
src/
├── views/pages/          # Страницы модулей
│   ├── FstCommittee.vue  # AI инвестиционный комитет
│   ├── FstDeal.vue       # Структурирование сделки
│   ├── FstPortfolio.vue  # Мониторинг портфеля
│   ├── FstExecution.vue  # Пост-инвестиционное управление
│   ├── FstDigitalTwin.vue # Digital twin компании
│   └── FstFundTwin.vue   # Digital twin фонда
├── components/
│   ├── fst-committee/    # Компоненты ИК
│   ├── fst-deal/         # Компоненты сделок
│   ├── fst-portfolio/    # Компоненты портфеля
│   └── integram/         # Integram-специфичные компоненты
├── services/
│   ├── aiTokenService.js # Маршрутизация AI-запросов
│   ├── integramService.js # Работа с Integram API
│   └── kagService.js     # Работа с Knowledge Graph
├── router/
│   └── index.js          # Определение маршрутов
├── config/
│   ├── routeDescriptions.js # Описания маршрутов
│   └── constants.js      # Константы приложения
└── templates/finmodel/   # JSON-шаблоны финмоделей
```

**Ключевые паттерны:**
- **Composition API**: все компоненты используют `<script setup>`
- **CSS Variables**: PrimeVue тема (`var(--p-surface-card)`), никогда не хардкодить цвета
- **Reactive state**: ref/reactive для локального состояния, Pinia для глобального
- **WebSocket**: real-time обновления для симуляций и дебатов

### 2.2 Backend (Node.js)

**Технологии:**
- Node.js (ESM monolith)
- Express.js (REST API)
- Socket.io (WebSocket)
- Integram API Client
- KAG Client

**Структура:**
```
backend/monolith/
├── src/
│   ├── api/routes/       # REST endpoints
│   │   ├── ai-tokens.js  # AI token router
│   │   ├── integram.js   # Integram proxy
│   │   └── mcp.js        # MCP tools
│   ├── core/
│   │   ├── llmCoordinator.js # Orchestration LLM-провайдеров
│   │   └── providers/    # DeepSeek, Claude, GPT-4o, YandexGPT
│   ├── services/
│   │   ├── integramService.js # Integram business logic
│   │   ├── kagService.js # KAG operations
│   │   └── simulationService.js # Digital twin engine
│   └── scripts/
│       ├── koda-site-tester.cjs    # QA автоматизация
│       ├── koda-code-reviewer.cjs  # Code review
│       ├── koda-api-tester.cjs     # API testing
│       └── koda-deploy-checker.cjs # Deploy health
└── .env
```

**Key responsibilities:**
- **Token routing**: все AI-запросы через `/api/ai-tokens/chat`
- **Integram proxy**: аутентификация, управление токенами, `_xsrf`
- **MCP orchestration**: предоставление 60+ tools для AI-агентов
- **WebSocket**: стриминг симуляций, дебатов, обновлений портфеля

### 2.3 Data Layer (Integram)

**Сервер:** `https://ai2o.ru`
**Базы данных:**
- `fst` — данные фонда (проекты, сделки, портфель)
- `kval` — онтология технологий UAV (~1140 концептов, ~923 связей)
- `my` — пользователи, токены, категории агентов

**Схема БД FST:**
```
Субфонды (1082)
  ├── БАС (БеспилотАвиаСистемы)
  ├── РОБО (Робототехника)
  └── МЭ (Микроэлектроника)

Проекты ФСТ (1155) ────► Решения ИК (1160) ────► Сделки ФСТ (1164)
                              │                        │
                              │                        ├──► Портфельные компании (1169)
                              │                        └──► Транши (1173)
                              │
                          (Протокол дебатов,
                           голоса, условия)
```

**API паттерны:**
```javascript
// Аутентификация
POST https://ai2o.ru/fst/auth?JSON_KV
body: login=d&pwd=d
→ { token, _xsrf }

// Заголовки для всех запросов
X-Authorization: {token}

// XSRF в теле POST-запроса (НЕ в заголовке!)
body: _xsrf={_xsrf}&...

// Создание объекта
POST /{db}/_m_new/{typeId}
body: _xsrf={_xsrf}&t{typeId}={name}&r{reqId}={value}

// Обновление объекта
POST /{db}/_m_set/{objectId}
body: _xsrf={_xsrf}&t{reqId}={value}

// Получение объектов
GET /{db}/_d_req/{typeId}?JSON_KV&l=100&s=0
```

Подробнее: см. [`docs/database.md`](./database.md)

### 2.4 AI Agent System

**Провайдеры LLM:**
- **DeepSeek** (по умолчанию) — экономичный, быстрый
- **Claude Opus 4.6** — глубокий анализ, дебаты
- **GPT-4o** — multimodal, презентации
- **YandexGPT** — русскоязычные запросы

**Token Router:**
```javascript
// Пользовательский запрос → token router
POST /api/ai-tokens/chat
body: {
  userId, message,
  model: "deepseek-chat", // или "claude-opus-4", "gpt-4o"
  stream: true
}

→ Выбор токена → Провайдер → Ответ + логирование расходов
```

**MCP (Model Context Protocol):**
AI-агенты получают доступ к 60+ инструментам:
- `get_dictionary` — схема БД
- `get_object_list` — запросы с фильтрами
- `set_object_requisites` — запись результатов
- `execute_report` — агрегированная аналитика
- `search_objects` — полнотекстовый + семантический поиск

**Архитектура дебатов ИК:**
```
Проект → AI Committee (6 agents)
  ├── Round 1: Position Statements (каждый агент анализирует проект)
  ├── Round 2: Rebuttals (критика позиций других агентов)
  └── Round 3: Synthesis (консенсус, голосование)
        │
        ▼
  Протокол → Решение ИК (Одобрен / Условно / Отклонён)
```

**Агенты:**
- **Market Analyst** — TAM/SAM/SOM, конкуренция
- **Technical Auditor** — TRL/MRL, архитектура, IP
- **Financial Modeler** — Unit economics, IRR, оценка
- **Legal & Compliance** — регуляторика, риски
- **Portfolio Strategist** — синергии, стратегия
- **Contrarian** — devil's advocate, стресс-тест

### 2.5 Knowledge Graph (KAG)

**Технология:** Knowledge Augmented Graph (vector + graph)

**Источники:**
- **Integram kval** — онтология UAV (1140+ концептов, 923 связи)
- **Company profiles** — портфельные компании, конкуренты
- **Market segments** — рыночные сегменты, отрасли
- **Regulatory framework** — нормативная база, стандарты

**Операции:**
```javascript
// Семантический поиск
kag_search("UAV regulation certification")

// Вопрос-ответ
kag_ask("What are the key risks for hardware startups?")

// Создание сущности
kag_create_entities([{
  name: "EntityName",
  entityType: "Technology|Company|Concept|Person",
  observations: ["fact 1", "fact 2"]
}])

// Добавление фактов
kag_add_observations([{
  entityName: "...",
  contents: ["..."]
}])
```

**Use cases:**
- Автоматическое обогащение профилей компаний
- Поиск аналогов и конкурентов
- Оценка технологической зрелости (TRL mapping)
- Поиск экспертов и менторов

### 2.6 Digital Twins

**Company Twin:**
Симуляция метрик компании:
```
State:
  revenue, burnRate, runway, headcount, trl, mrl,
  marketShare, customersCount, kpiProgress

Events (probabilistic pool):
  - Team change (founder leaves) → -15% revenue
  - Regulatory shift → +6 months delay
  - Competitor raised funding → -10% market share
  - Key hire → +5% efficiency

Tick-based simulation:
  tick() → generateEvents() → applyEffects() → updateMetrics()
```

**Fund Twin:**
Симуляция NAV фонда, IRR, распределение по субфондам:
```
State:
  nav, irr, moic, dealsPipeline, portfolioCount,
  subFundAllocation

Events:
  - Exit event → +NAV, +IRR
  - New deal → -Cash, +Portfolio
  - Write-down → -NAV
  - Follow-on round → -Cash, dilution impact

Real-time metrics:
  - Live IRR calculation
  - Risk exposure heatmap
  - LP reporting dashboard
```

---

## 3. Инвестиционный процесс (flow)

```
1. Deal Sourcing
   ├── Telegram Bot (intake)
   ├── Job boards scraping
   └── Research databases

2. AI Pre-Screening (15 criteria, 0-100 score)
   ├── TRL/MRL assessment
   ├── Market size estimation
   ├── Technology sovereignty check
   └── Financial viability

3. Partner Review (human gate)

4. AI Committee Debate (6 agents, 3 rounds)
   ├── Position Statements
   ├── Rebuttals
   └── Synthesis + Vote
        │
        ▼
   Decision: Approve / Conditional / Reject

5. Human IC Meeting (AI transcript as briefing)

6. Term Sheet Generation (if approved)
   ├── SPV setup
   ├── Tranche structuring
   └── KPI triggers

7. Deal Execution
   ├── Smart contract timeline
   ├── First tranche release
   └── KPI tracking begins

8. Portfolio Monitoring
   ├── Real-time KPI dashboard
   ├── Traffic light risk system
   ├── AI weekly reports
   └── Fund interventions (if needed)

9. Exit Scenarios
   ├── M&A simulation
   ├── IPO readiness
   └── Buyback options
```

---

## 4. Deployment

**Systemd Services:**
```bash
# Backend
sudo systemctl start dronedoc-backend.service
sudo systemctl enable dronedoc-backend.service

# Frontend
sudo systemctl start dronedoc-frontend.service
sudo systemctl enable dronedoc-frontend.service

# Telegram Bot
sudo systemctl start dronedoc-telegram-bot.service
sudo systemctl enable dronedoc-telegram-bot.service
```

**Service locations:**
- Backend: `/var/www/dronedoc/backend/monolith`
- Frontend: `/var/www/dronedoc` (Vite build → dist/)

**Environment:**
- Dev: `https://dev.drondoc.ru`
- Production: `https://drondoc.ru`
- FST-specific: `https://fst.drondoc.ru` (planned)

**CI/CD:**
- GitHub Actions: lint + unit tests on PR
- Deploy workflow: push to `main` → systemd restart
- Health checks: Koda scripts (automated)

---

## 5. Безопасность и авторизация

**Integram Auth:**
- Токены генерируются при `/auth`
- Срок жизни токена: сессия (нужна реаутентификация)
- `_xsrf` обязательно в теле POST-запросов

**AI Token Management:**
- Квоты на пользователя: daily/monthly limits
- Cost tracking: логирование всех LLM-запросов
- Model selection: пользователь выбирает модель (если есть доступ)

**Access Control:**
- LP-specific views (только NAV, отчёты)
- Fund manager: полный доступ
- Portfolio companies: read-only для своих данных

---

## 6. Мониторинг и логирование

**Logs:**
- Backend: `/var/log/dronedoc/backend.log`
- Frontend: browser console + Sentry
- Integram: request/response logs

**Metrics:**
- AI token usage (по пользователям, моделям)
- Integram API calls (latency, errors)
- WebSocket connections (active, dropped)

**Alerts:**
- Portfolio risk threshold breaches → Telegram bot
- AI cost anomalies → email to admin
- Service downtime → systemd auto-restart

---

## 7. Development Guidelines

### Branch Strategy
- `dev` — основная ветка разработки
- `feat/*` — фичи
- `fix/*` — баги
- `main` — production-ready код

### Commit Convention
```
feat(module): short description
fix(module): what was broken
refactor(module): what changed
docs: what was documented
```

### Testing
- Unit tests: Vitest (`src/__tests__/`)
- Integration tests: (`tests/integration/`)
- E2E tests: Playwright (`e2e/`)
- Coverage: min 70% statements, 60% branches

### Code Style
- ESLint: `npm run lint`
- Prettier: automatic formatting
- Vue: `<script setup>` + Composition API
- CSS: PrimeVue variables only, no hardcoded colors

---

## 8. Зависимости

**Frontend:**
```json
{
  "vue": "^3.4.0",
  "pinia": "^2.1.0",
  "vue-router": "^4.2.0",
  "primevue": "^4.0.0",
  "hyperformula": "^2.6.0",
  "socket.io-client": "^4.7.0",
  "chart.js": "^4.4.0"
}
```

**Backend:**
```json
{
  "express": "^4.18.0",
  "socket.io": "^4.7.0",
  "node-fetch": "^3.3.0",
  "dotenv": "^16.0.0"
}
```

---

## 9. FAQ

**Q: Почему не используем Postgres/MySQL?**
A: Integram предоставляет NoSQL + graph + отчёты из коробки. Для структурированных данных фонда это достаточно.

**Q: Почему DeepSeek по умолчанию?**
A: Экономичность (5× дешевле GPT-4o) при сопоставимом качестве для большинства задач.

**Q: Как обновить онтологию?**
A: Через KAG API (`kag_create_entities`, `kag_add_observations`) либо напрямую в Integram `kval`.

**Q: Где хранятся финансовые модели?**
A: JSON-шаблоны в `src/templates/finmodel/`, рендеринг через `TemplateRenderer.vue`.

**Q: Можно ли запустить локально без Integram?**
A: Нет, Integram — критичная зависимость. Но можно использовать тестовую БД `ai2o.ru/fst` с логином `d/d`.

---

## 10. Дальнейшее развитие

**Планируется:**
- Модуль вторичного рынка (LP stake trading)
- Open API с webhook-подписками
- Telegram-бот для fund managers
- Black-Litterman оптимизатор портфеля
- Syndication network (сеть со-инвесторов)
- Board Pack auto-generator

**Исследуется:**
- On-chain cap table (blockchain)
- Automated due diligence (AI-powered)
- Predictive analytics (ML models)
- Multi-fund aggregation (LP invests across funds)

---

_Создано: 2026-03-06 | Issue: [#2](https://github.com/unidel2035/found/issues/2)_
