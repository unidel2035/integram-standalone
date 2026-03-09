# VentureOS — Agent Platform Guide

> **Auto-generated from `src/manifests/pageManifests.js`**
> This file is the primary knowledge source for AI agents operating on the VentureOS platform.
> An agent that loads this file can understand the full platform and navigate any workflow autonomously.

---

## Platform Overview

**VentureOS / ФСТ НТИ** — AI-платформа управления венчурным фондом.

Покрывает полный инвестиционный цикл:
```
Заявка → Скрининг → DD → AI-инвесткомитет → Сделка → Мониторинг → Выход
```

**Live demo:** https://ai2fund.ru

---

## How to navigate the platform (for agents)

Each page has:
- `data-action` attributes on interactive elements
- `data-description` — what the element does
- `data-agent-hint` — additional context for automation

To trigger an action, locate the element by `[data-action="<id>"]` and interact with it.

---

## Core Workflows

### Workflow 1: Full Deal Flow (полный цикл сделки)
```
fst-apply → fst-dealflow → fst-duediligence → fst-memo → fst-committee → fst-deal → fst-portfolio
```

**Steps:**
1. **fst-apply** — стартап подаёт заявку
2. **fst-dealflow** — заявка попадает в воронку, скрининг
3. **fst-duediligence** — AI проводит DD (финансовый, юридический, технологический)
4. **fst-memo** — AI генерирует инвест-меморандум
5. **fst-committee** — 6 AI-агентов голосуют по заявке
6. **fst-deal** — оформление сделки: SPV, транши, Term Sheet
7. **fst-portfolio** — компания переходит в мониторинг

### Workflow 2: Sourcing to Committee
```
fst-sourcing → fst-dealflow → fst-committee
```

### Workflow 3: Deal to Exit
```
fst-deal → fst-execution → fst-portfolio → fst-exit → fst-waterfall
```

### Workflow 4: LP Reporting
```
fst-fund → fst-lp → fst-ilpa → fst-transparency
```

---

## Agent Scenario: «Запустить ИК» (Launch Investment Committee)

This is the primary scenario for testing agent readiness.

**Goal:** Run an investment committee session for a specific company.

**Steps for agent:**
1. Navigate to `/fst-committee`
2. Wait for the project list to load
3. Click the project card for the target company (`.fst-pcard`)
4. Click `[data-action="run-investment-committee"]`
5. Wait 30–60 seconds for all 6 agents to complete
6. Read result: vote counts, aggregated score, recommendation
7. Optionally click `[data-action="view-protocol"]` to see full report

**Required params:** `companyId` (selected via UI card)

**Expected output:**
- `vote-result`: `approved` | `rejected` | `conditional` | `pending`
- `aggregated-score`: 0–100
- `conditions`: array of approval conditions (if conditional)

---

## Page Directory

### Deal Flow & Sourcing

#### `/fst-apply` — Подача заявки
**Description:** Публичная форма подачи инвестиционной заявки в фонд.

**Actions:**
| Action ID | Label | Params |
|-----------|-------|--------|
| `submit-application` | Подать заявку | `companyName`, `sector`, `stage`, `amount` |

**Data fields:** `company-name` (string), `sector` (string), `stage` (enum: pre-seed/seed/series-a/series-b), `requested-amount` (number)

---

#### `/fst-sourcing` — AI Deal Sourcing
**Description:** Автоматический мониторинг источников: Telegram, HH.ru, ЕГРЮЛ, ФИПС, Сколково, GitHub.

**Actions:**
| Action ID | Label | Params | Agent Hint |
|-----------|-------|--------|-----------|
| `refresh-feed` | Обновить ленту | — | — |
| `add-to-funnel` | Добавить в воронку | `companyId` | Создаёт заявку в /fst-dealflow |
| `filter-source` | Фильтр источника | `source` | — |

**Data fields:** `candidates` (array), `ai-score` (0–100), `source` (enum: telegram/hh/egrul/fips/skolkovo/github)

---

#### `/fst-dealflow` — Воронка сделок
**Description:** Канбан-доска по этапам: входящие → скрининг → DD → ИК → закрытие.

**Actions:**
| Action ID | Label | Params |
|-----------|-------|--------|
| `add-deal` | Добавить сделку | — |
| `move-stage` | Переместить по этапам | `dealId`, `stage` |
| `run-committee` | Отправить на ИК | `dealId` |
| `filter-deals` | Фильтр сделок | `stage`, `sector` |

**Stage values:** `incoming` → `screening` → `due-diligence` → `committee` → `closing`

---

### AI Analysis

#### `/fst-committee` — AI-инвесткомитет ⭐ (primary)
**Description:** Запуск голосования 6 AI-агентов. Роли: Аналитик, Юрист, Технолог, ESG, Рынок, Председатель.

**Actions:**
| Action ID | Label | Trigger | Params | Agent Hint |
|-----------|-------|---------|--------|-----------|
| `run-investment-committee` | Запустить ИК | `button[data-action="run-investment-committee"]` | `companyId` | Требует выбор компании. Ждать 30–60 сек. |
| `view-protocol` | Просмотр протокола | `button[data-action="view-protocol"]` | — | — |
| `export-pdf` | Экспорт в PDF | `button[data-action="export-pdf"]` | — | — |
| `select-company` | Выбор компании | `.fst-pcard` | `companyId` | — |

**Data fields:**
- `vote-result`: enum `approved` / `rejected` / `conditional` / `pending`
- `aggregated-score`: 0–100
- `agent-votes`: array of individual agent votes
- `conditions`: approval conditions (if conditional)

**Related pages:** `fst-dealflow`, `fst-deal`, `fst-protocol`

---

#### `/fst-protocol` — Протоколы ИК
**Description:** Хранилище и просмотр протоколов заседаний.

**Actions:** `search-protocol` (query), `view-protocol` (protocolId), `export-pdf` (protocolId)

---

#### `/fst-duediligence` — AI Due Diligence
**Description:** Автоматизированный DD: финансовый, юридический, технологический, ESG.

**Actions:**
| Action ID | Label | Params | Agent Hint |
|-----------|-------|--------|-----------|
| `run-due-diligence` | Запустить DD | `companyId`, `ddType` | AI анализирует все доступные данные |
| `export-dd-report` | Экспорт отчёта | `companyId` | — |

**DD types:** `financial`, `legal`, `tech`, `esg`, `full`

---

#### `/fst-memo` — AI Инвест-меморандум
**Description:** Автогенерация инвестиционного меморандума (IM) по шаблону ФСТ.

**Actions:** `generate-memo` (companyId) — *агент-хинт: AI создаёт полный IM*

---

### Deal Management

#### `/fst-deal` — Доведение сделки
**Description:** SPV-структура, транши, Term Sheet, финансовая модель.

**Actions:**
| Action ID | Label | Params |
|-----------|-------|--------|
| `create-spv` | Создать SPV | — |
| `add-tranche` | Добавить транш | `amount`, `date`, `conditions` |
| `generate-termsheet` | Сгенерировать Term Sheet | — |
| `open-finmodel` | Открыть финмодель | — |

**Data fields:** `investment-amount` (number), `valuation` (number), `equity-stake` (number), `tranches` (array)

---

#### `/fst-captable` — Cap Table
**Description:** Таблица капитализации: акционеры, доли, опционный пул, dilution.

**Actions:** `add-shareholder` (name, shares, type), `simulate-round` (preMoneyVal, investAmount)

---

#### `/fst-waterfall` — Waterfall Калькулятор
**Description:** Распределение выручки при выходе: hurdle rate, carried interest, LP/GP split.

**Actions:** `calculate-waterfall` (exitAmount, hurdleRate, carry)

---

#### `/fst-syndication` — Со-инвестирование
**Description:** База со-инвесторов, синдицированные сделки, граф сети.

**Actions:** `invite-coinvestor` (investorId, dealId, stake)

---

#### `/fst-legal` — Юридические документы
**Description:** SHA, SPA, NDA, Term Sheet — генерация и хранение.

**Doc types:** `sha`, `spa`, `nda`, `termsheet`, `loan`, `convertible`

---

### Portfolio Monitoring

#### `/fst-portfolio` — Портфельный монитор
**Description:** Светофор здоровья компаний, KPI, AI-отчёты, риск-мониторинг.

**Actions:** `generate-ai-report` (companyId), `filter-companies` (status, sector), `view-company` (companyId)

**Health status:** `green` (OK) / `yellow` (внимание) / `red` (критично)

---

#### `/fst-execution` — Исполнение сделок
**Description:** Kanban задач и KPI по компаниям. Milestones, контроль условий транша.

**Actions:** `add-task` (companyId, title, dueDate), `move-task` (taskId, column), `update-kpi` (companyId, kpiId, value)

---

#### `/fst-intelligence` — Portfolio Intelligence
**Description:** AI-аналитика: тренды, бенчмарки, предиктивный анализ рисков.

**Actions:** `generate-insight` (topic), `compare-benchmark` (metric)

---

#### `/fst-twin` — Цифровой двойник компании
**Description:** Симуляция tick-engine. Сценарии: оптимистический / базовый / пессимистический.

**Actions:** `run-simulation` (companyId, scenario), `change-scenario` (scenario)

---

### Fund Management

#### `/fst-fund` — Цифровой двойник фонда
**Description:** NAV, IRR, TVPI, DPI. Субфонды, J-curve.

**Actions:** `recalculate-nav`, `generate-lp-report`

---

#### `/fst-lp` — LP Dashboard
**Description:** Личный кабинет LP: портфель, доходность, J-curve, отчёты.

**Actions:** `download-report` (period), `request-distribution`

---

#### `/fst-ilpa` — ILPA Отчётность
**Description:** Отчётность по стандартам ILPA.

**Report types:** `capital-account`, `fee-expense`, `portfolio-company`

---

#### `/fst-allocation` — Оптимизация аллокации
**Description:** AI-оптимизация распределения капитала: портфельная теория, risk-return.

**Actions:** `optimize-allocation` (constraints)

---

#### `/fst-exit` — Сценарии выхода
**Description:** M&A, IPO, вторичные продажи — моделирование и симуляция.

**Exit strategies:** `ma`, `ipo`, `secondary`, `buyback`

---

#### `/fst-secondary` — Secondary Market
**Description:** Вторичный рынок долей LP: листинг, оценка, транзакции.

---

### Compliance & ESG

#### `/fst-compliance` — AML/KYC Комплаенс
**Description:** Проверка контрагентов: AML/KYC, санкционные списки.

**Risk levels:** `low`, `medium`, `high`, `critical`

---

#### `/fst-esg` — ESG-скоринг
**Description:** Экологические (E), социальные (S), управленческие (G) метрики.

**Actions:** `run-esg-audit` (companyId), `generate-esg-report` (companyId)

---

#### `/fst-sovereignty` — Аудит суверенности 9D
**Description:** Технологическая суверенность компаний по 9 измерениям (0–100).

---

### Reporting & Analytics

#### `/fst-benchmark` — Бенчмаркинг портфеля
**Description:** Сравнение с рыночными бенчмарками, мультипликаторами, аналогами.

---

#### `/fst-transparency` — Публичная витрина фонда
**Description:** Публичная страница: портфель, метрики для LP и стейкхолдеров.

---

### Governance

#### `/fst-board` — Совет директоров
**Description:** Заседания совета, Board Pack, права наблюдателя, голосования.

**Actions:** `schedule-meeting` (companyId, date), `generate-board-pack` (companyId — AI автогенерирует), `record-vote` (meetingId, question, decision)

---

#### `/fst-founders` — Founders CRM & Mentors
**Description:** CRM основателей, база менторов. AI-подбор ментора при рисках.

**Actions:** `add-founder`, `match-mentor` (founderId — *AI подбирает*), `log-interaction` (founderId, type, note)

---

#### `/fst-gov` — GR-Панель
**Description:** НПА, взаимодействие с госорганами, субсидии.

---

#### `/fst-grants` — Трекер грантов
**Description:** Сколково, Фонд Бортника, ФРП. Статусы: `open`→`applied`→`approved`/`rejected`.

---

#### `/fst-natproject` — Нацпроект БАС 2024–2030
**Description:** Трекер KPI и milestones Национального проекта БАС.

---

### Knowledge & Learning

#### `/fst-learning` — Нейрокогнитивное ядро
**Description:** База знаний KAG: онтология БПЛА (~1140 концептов), документы, прецеденты.

---

#### `/fst-school` — Школа агентов ИК
**Description:** Обучение AI-агентов: промпты, сценарии, калибровка ролей.

**Actions:** `train-agent` (agentRole, caseId), `run-scenario` (scenarioId)

---

#### `/fst-glossary` — Глоссарий
**Description:** Термины: венчур, финансы, юридические понятия, авиационная отрасль.

---

#### `/fst-dev-guide` — Путь обучения VentureOS
**Description:** Интерактивное обучение разработчиков и аналитиков фонда.

---

### Infrastructure

#### `/fst-registry` — Реестр производителей БПЛА
**Description:** Российские производители БАС: характеристики, сертификаты.

---

#### `/fst-network` — Сеть контактов
**Description:** CRM экосистемы: инвесторы, эксперты, госорганы. Граф связей.

**Contact types:** `investor`, `expert`, `corporate`, `government`, `startup`

---

#### `/fst-terminal` — Claude Code CLI
**Description:** Веб-терминал WebSocket TTY с доступом к Claude Code агенту.

**Action:** `terminal-input` (command) — *прямой CLI-доступ*

---

#### `/fst-administration` — Бэк-офис фонда
**Description:** Юридические документы, платёжный календарь, управление командой.

---

## API Endpoints for Agents

### Platform Manifest API

```
GET /api/platform/manifest
→ Full manifest: all pages, actions, data schemas, workflows

GET /api/platform/manifest/:pageId
→ Manifest for a single page (e.g. /api/platform/manifest/fst-committee)

GET /api/platform/actions/:pageId
→ Available actions on a page

GET /api/platform/workflows
→ All multi-step workflows
```

### AI Inference

```
POST /api/ai-tokens/chat
Body: {
  modelId: 'anthropic/claude-sonnet-4-20250514',
  prompt: '<user message>',
  systemPrompt: '<system context>',
  application: '<module name>'
}
Response: { response: '<AI text>' }
```

**Available models:**
- `anthropic/claude-sonnet-4-20250514` — стратегический анализ, длинные тексты
- `deepseek/deepseek-chat` — быстро, структурированные данные
- `openai/gpt-4o` — мультимодальные задачи
- `yandex/yandexgpt` — русскоязычный контент

---

## ARIA Attributes Reference

All key interactive elements use these attributes for agent accessibility:

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `data-action` | Unique action identifier | `data-action="run-investment-committee"` |
| `data-description` | Human-readable description | `data-description="Запускает голосование 6 AI-агентов"` |
| `data-agent-hint` | Automation-specific context | `data-agent-hint="Требует выбранную компанию. Ждать 30–60 сек."` |

**Example selector:** `document.querySelector('[data-action="run-investment-committee"]')`

---

*This guide is auto-generated from `src/manifests/pageManifests.js`.*
*To regenerate: `node scripts/generate-agent-guide.js`*
