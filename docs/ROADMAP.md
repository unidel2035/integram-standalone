# 🗺️ VentureOS Platform Roadmap

> **Цель:** создать суверенную AI-платформу управления венчурным портфелем, сравнимую с EQT Motherbrain, SignalFire Beacon, BlackRock Aladdin

**Live demo:** https://dev.drondoc.ru
**Issues:** https://github.com/unidel2035/found/issues

---

## Содержание

- [Уже реализовано](#уже-реализовано)
- [P0 — Критический путь](#p0--критический-путь)
- [P1 — Высокий приоритет](#p1--высокий-приоритет)
- [P2 — Средний приоритет](#p2--средний-приоритет)
- [P3 — Долгосрочно](#p3--долгосрочно)
- [Стек технологий](#стек-технологий)
- [Сравнение с мировыми аналогами](#сравнение-с-мировыми-аналогами)

---

## ✅ Уже реализовано

Базовая платформа фонда полностью функциональна и развернута в production на https://dev.drondoc.ru

| Модуль | Маршрут | Issue | Описание |
|--------|---------|-------|----------|
| **Хаб платформы** | `/fst` | #83 | Единая стартовая страница с воронкой и модулями (подключена к БД) |
| **AI Инвесткомитет** | `/fst-committee` | #8 | 6 AI-агентов дебатируют, голосуют, принимают решение ИК |
| **Доведение сделки** | `/fst-deal` | — | Term Sheet, SPV, транши, финмодель, смарт-контракт |
| **Исполнение сделки** | `/fst-execution` | — | Kanban задач, KPI мониторинг, действия фонда |
| **Портфельный монитор** | `/fst-portfolio` | — | Светофор рисков, датчики, AI-отчёт |
| **ЦД Компании** | `/fst-twin` | — | Живая симуляция компании (tick engine) |
| **ЦД Фонда** | `/fst-fund` | — | NAV, IRR, субфонды, прогноз |
| **Воронка заявок** | `/fst-dealflow` | #13 | Скрининг заявок, AI-оценка, управление статусами |
| **Инвестмеморандум** | `/fst-memo` | #14 | AI-генерация инвестмеморандума за 60 секунд |
| **LP Dashboard** | `/fst-lp` | #15 | Дашборд для ограниченных партнёров фонда |
| **ILPA Reporting** | `/fst-ilpa` | #40 | ILPA-совместимая отчётность для LP |
| **Cap Table** | `/fst-captable` | #16 | Управление долями, опционы, конвертация |
| **Benchmark** | `/fst-benchmark` | #17 | Сравнение с отраслевыми пирами |
| **Exit Scenarios** | `/fst-exit` | #18 | Моделирование M&A, IPO, buyback |
| **Sovereignty Audit** | `/fst-sovereignty` | #19 | Аудит суверенности 9D (детальный) |
| **Waterfall Calculator** | `/fst-waterfall` | #35 | Калькулятор водопада и carried interest |
| **Government Relations** | `/fst-gov` | #36 | Дашборд взаимодействия с государством (LP-государство) |
| **Симулятор** | `/nti-simulator` | — | Стратегическая игра управления фондом |
| **Лендинг FST** | `/` | #82 | Позиционирование «Rebuild, not Automate» |

**Инфраструктура:**
- ✅ База данных `fst` в Integram (#5, #7)
- ✅ Миграция кода из dronedoc2025 (#3, #4)
- ✅ E2E тесты для FST-маршрутов (#10)
- ✅ Деплой на dev.drondoc.ru (#9)
- ✅ CI/CD настроен (#2)
- ✅ Доступ к ai2o.ru/fst (#1)

---

## 🔥 P0 — Критический путь

Блокирующие задачи для выхода на production и работы с реальными заявками.

| # | Модуль | Маршрут | Issue | Статус | Описание |
|---|--------|---------|-------|--------|----------|
| 1 | **Public Application** | `/fst-apply` | #84 | 🚧 | Публичная форма подачи заявки для стартапов |
| 2 | **Committee Protocols** | — | #85 | 🚧 | Сохранение протокола инвесткомитета в базу fst |
| 3 | **ROADMAP Documentation** | — | #30 | 🚧 | Этот документ — полный план развития платформы |

**Приоритет:** Завершить до запуска публичного приёма заявок.

---

## 📈 P1 — Высокий приоритет

Функции, необходимые для полноценной работы фонда в течение 1-2 месяцев.

| # | Модуль | Маршрут | Issue | Статус | Описание |
|---|--------|---------|-------|--------|----------|
| 4 | **AI Deal Sourcing** | `/fst-sourcing` | #20 | 🔄 | Автоматический поиск стартапов через API |
| 5 | **External Data** | — | #11 | 🔄 | Интеграция с ЕГРЮЛ, Роспатент, HH.ru |

**Приоритет:** Следующий спринт после P0.

---

## 🔧 P2 — Средний приоритет

Улучшения для повышения эффективности и качества работы фонда.

| # | Модуль | Маршрут | Issue | Статус | Описание |
|---|--------|---------|-------|--------|----------|
| 6 | **Portfolio Intelligence** | `/fst-intelligence` | #22 | 📋 | Еженедельный AI-отчёт по портфелю |
| 7 | **Black-Litterman** | `/fst-allocation` | #23 | 📋 | Оптимизация аллокации капитала |
| 8 | **Co-Investor Network** | `/fst-network` | #24 | 📋 | Сеть соинвесторов и синдикация сделок |
| 9 | **Founders CRM** | `/fst-founders` | #25 | 📋 | CRM основателей + сеть менторов |
| 10 | **Board Pack** | `/fst-board` | #26, #43 | 📋 | Материалы совета директоров |
| 11 | **Benchmark v2** | `/fst-benchmark` | #44 | 📋 | Бенчмаркинг по отраслевым мультипликаторам |
| 12 | **Back-Office** | `/fst-administration` | #46 | 📋 | Управленческий учёт и ФСБУ 4/2023 |
| 13 | **Public Transparency** | `/fst-transparency` | #47 | 📋 | Публичная витрина фонда (Santiago Principles) |

**Приоритет:** 2-6 месяцев.

---

## 🔮 P3 — Долгосрочно

Инновационные функции для масштабирования и открытия платформы.

| # | Модуль | Маршрут | Issue | Статус | Описание |
|---|--------|---------|-------|--------|----------|
| 14 | **Telegram Bot** | — | #27 | 📋 | Уведомления и мобильный доступ |
| 15 | **Secondary Market** | `/fst-secondary` | #28 | 📋 | Продажа доли фонда другому инвестору |
| 16 | **Public API** | `/api/*` | #29 | 📋 | Открытый REST API для интеграций |
| 17 | **Neural Core** | — | #12 | 📋 | Самообучение на исторических данных ИК |

**Приоритет:** 6-12 месяцев.

---

## Стек технологий

### Frontend
```
Vue 3 (Composition API) + Vite
PrimeVue — enterprise UI components
Pinia — state management
HyperFormula — spreadsheet engine для финмоделей
Socket.io-client — real-time streaming
Chart.js — analytics visualization
vue-i18n — multilingual (RU/EN/ZH)
```

### Backend
```
Node.js ESM монолит
Express.js — REST API
Socket.io — WebSocket для симуляций
Integram API — NoSQL + graph database (ai2o.ru)
SQLite — ephemeral cache
```

### AI & Knowledge
```
KAG (Knowledge Augmented Graph) — hybrid vector + graph
Multi-provider LLM routing:
  - DeepSeek (default, fast & cheap)
  - Claude Sonnet 4 (strategic analysis)
  - GPT-4o (multimodal)
  - YandexGPT (russian content)
Token-based access control — per-user quotas, cost tracking
MCP (Model Context Protocol) — 60+ structured tools for agents
Playwright + Koda — AI-powered QA
```

### Infrastructure
```
systemd — service management (НЕ pm2)
SOCKS5 proxy (port 9050) — tunneled access для ЕГРЮЛ, Роспатент
Telegram Bot — notifications, approvals, deal alerts
Integram MCP Server — 60+ tools для AI агентов
GitHub Actions — CI/CD
```

---

## Сравнение с мировыми аналогами

| Функция | EQT Motherbrain | SignalFire Beacon | BlackRock Aladdin | **VentureOS** |
|---------|----------------|------------------|--------------------|---------------|
| **AI-скрининг заявок** | ✅ | ✅ | — | ✅ (#13) |
| **Автоматический sourcing** | ✅ | ✅ | — | 🔨 #20 |
| **Инвест-меморандум AI** | ✅ | — | — | ✅ (#14) |
| **Портфельный мониторинг** | ✅ | ✅ | ✅ | ✅ |
| **AI Инвесткомитет** | — | — | — | ✅ **уникально** |
| **LP Reporting** | ✅ | — | ✅ | ✅ (#15, #40) |
| **Cap Table** | ✅ | — | — | ✅ (#16) |
| **Black-Litterman** | — | — | ✅ | 🔨 #23 |
| **Суверенность 9D** | — | — | — | ✅ **уникально** (#19) |
| **Смарт-контракт транши** | — | — | — | ✅ **уникально** |
| **Digital Twin компании** | — | — | — | ✅ **уникально** |
| **Digital Twin фонда** | — | — | — | ✅ **уникально** |
| **Waterfall & Carried** | ✅ | — | ✅ | ✅ (#35) |
| **Government Relations** | — | — | — | ✅ **уникально** (#36) |
| **ILPA Compliance** | ✅ | — | ✅ | ✅ (#40) |

### Ключевые отличия VentureOS

#### 1. AI-Инвесткомитет
Единственная платформа с **полным циклом дебатов** 6 специализированных агентов:
- Market Analyst, Technical Auditor, Financial Modeler
- Legal & Compliance, Portfolio Strategist, Contrarian
- 3 раунда: анализ → дебаты → голосование
- Полная прозрачность аргументации

#### 2. Суверенность 9D
Уникальный модуль оценки технологической независимости по 9 измерениям:
- Технология, Data, Infrastructure, Supply Chain
- HR, Legal, Financial, Market, Strategic

Критично для российских венчурных фондов в условиях санкций.

#### 3. Digital Twins
Симуляционные модели компаний и фонда с **tick-based event engine**:
- Стохастические события (смена команды, регуляция, конкуренты)
- Прогнозирование метрик (revenue, burn, TRL/MRL)
- Стресс-тестирование сценариев

#### 4. Smart Contract Tranches
Автоматическое высвобождение транша при достижении KPI:
- Привязка к цифровым датчикам (revenue, users, TRL)
- Blockchain-опционально (можно без крипты)
- Снижение рисков для фонда и стартапа

#### 5. Ontology-First Architecture
**~1,100 концептов** в knowledge graph (БПЛА домен):
- Semantic search для deal sourcing
- Автоматическая классификация заявок
- Граф-запросы для анализа конкуренции

---

## Метрики успеха

### Текущее состояние (март 2026)
- ✅ **18 модулей** в production
- ✅ **87 issues** закрыто
- ✅ **~30,000 строк кода** (frontend + backend)
- ✅ **60+ MCP tools** для AI агентов
- ✅ **1,100+ концептов** в онтологии
- ✅ **E2E тесты** покрывают все FST-маршруты

### Целевые показатели (Q2-Q3 2026)
- 🎯 **100% автоматизация** скрининга заявок
- 🎯 **<1 час** на генерацию полного инвестмеморандума
- 🎯 **Real-time** мониторинг всех портфельных компаний
- 🎯 **Weekly AI reports** по каждой компании
- 🎯 **Public API** для LP интеграций
- 🎯 **Secondary market** для ликвидности долей фонда

---

## Архитектурные принципы

### 1. Ontology-First
> Structure the domain before building features

Если концепт не в knowledge graph — о нём нельзя рассуждать.

### 2. Agents Over Dashboards
> Instead of showing data, have agents act on it

Менеджер фонда одобряет решения, а не строит таблицы.

### 3. Simulation Before Action
> Test investment theses in digital twin before committing capital

Стресс-тестирование в симуляторе перед реальными деньгами.

### 4. Transparency Through Debate
> AI recommendations come with full deliberation trace

Никаких чёрных ящиков — полная история аргументации.

### 5. Sovereignty by Design
> Every technology choice evaluated through sovereignty lens

Контроль над данными, инфраструктурой, зависимостями.

---

## Быстрый старт

### Клонирование и установка
```bash
git clone https://github.com/unidel2035/found.git
cd found
git checkout dev
npm install
cd backend/monolith && npm install && cd ../..
```

### Конфигурация
```bash
cp .env.example .env
# Редактировать .env:
# - DEEPSEEK_API_KEY (обязательно)
# - INTEGRAM credentials (уже настроены для demo)
```

### Запуск
```bash
# Terminal 1 — Backend
cd backend/monolith && npm run dev

# Terminal 2 — Frontend
npm run dev
```

Откройте http://localhost:5173

### Документация
- 📖 [Setup Guide](setup.md) — детальная настройка
- 🏗️ [Architecture](architecture.md) — архитектура платформы
- 🗄️ [Database Schema](database.md) — схема Integram БД
- 🤖 [CLAUDE.md](../CLAUDE.md) — правила разработки

---

## Философия проекта

> **"A venture fund is an information processing machine. We're building the OS for it."**

Венчурный фонд — это машина по обработке информации:
- Входные заявки → скрининг
- Данные портфеля → анализ
- Сигналы рынка → решения
- Отчёты LP → доверие

VentureOS — операционная система для этой машины.

---

## Контакты и поддержка

- **Issues & Feature Requests:** https://github.com/unidel2035/found/issues
- **Live Demo:** https://dev.drondoc.ru
- **Documentation:** https://github.com/unidel2035/found/tree/dev/docs

---

**Last updated:** 2026-03-06
**Version:** 1.0.0
**Status:** 🚀 Active Development
