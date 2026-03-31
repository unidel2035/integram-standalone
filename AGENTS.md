# AGENTS.md — Integram Standalone: Карта проекта для ИИ-агентов

> Самостоятельная СУБД/CMS платформа. Основа data-слоя всей экосистемы DronDoc.

---

## 1. Что это такое

**Integram Standalone** — независимое приложение на базе Integram: авторизация, онбординг, полный функционал работы с данными (таблицы, объекты, документы, чаты).

Это выделенная версия data-движка, встроенного в `dronedoc2026`. Может работать отдельно.

**Live API**: `https://ai2o.ru/api/`

---

## 2. Архитектура

```
src/                        — Vue 3 Frontend
├── App.vue
├── components/integram/    — DataTable, AI-кнопка, диалоги
├── composables/            — useIntegram, useAuth, useAI
└── views/                  — страницы приложения

backend/monolith/src/
├── index.js                — точка входа (Express, 158+ маршрутов)
├── api/routes/             — 50+ API маршрутов
├── core/                   — TokenBasedLLMCoordinator, AgentRegistry
├── database/               — MySQL + SQLite адаптеры
└── models/                 — ORM модели

backend/monolith/src/api/routes/ (ключевые):
├── a2a.js          — Agent-to-Agent протокол
├── agent-bus.js    — AgentBus pub/sub
├── accounting.js   — финансовый учёт
├── aero-*.js       — авиационные данные
└── admin.js        — администрирование
```

---

## 3. Технологический стек

```
Frontend:  Vue 3 + PrimeVue + Vite + Pinia
Backend:   Node.js 20 + Express
Storage:   MySQL (основной, ai2o.ru) + SQLite (local cache)
AI:        Claude API · TokenBasedLLMCoordinator
Auth:      JWT
Deploy:    api.ai2o.ru (основной), 173.249.2.184 (тест)
```

---

## 4. API (ai2o.ru)

```
Base: https://ai2o.ru/api/

GET  /api/my/{table}/records       — список записей
POST /api/my/{table}/records       — создать запись
PUT  /api/my/{table}/records/{id}  — обновить
DEL  /api/my/{table}/records/{id}  — удалить
POST /api/ai-tokens/chat           — AI чат с инструментами
POST /api/mcp/integram/chat        — MCP-инструменты через HTTP
GET  /api/agent-bus/agents         — список агентов
```

---

## 5. Связи с экосистемой

- `dronedoc2026` использует Integram API как data-backend (`integramConfig.js`)
- `fund` (VentureOS) — встроенные компоненты `src/components/integram/`
- `gift-engine` — хранит Gift State в Integram SQLite
- Таблицы: дроны, организации, НТД, сессии, документы, финансы, события

---

## 6. Важно для агентов

PHP запрещён — только Node.js.
Все запросы к данным — через Integram API (не прямой SQL).
`integramConfig.js` — центральная точка настройки в клиентских проектах.
`legacy-compat.js` — 15413 строк, совместимость со старым API (не трогать).

---

## 7. Ключевые файлы

```
backend/monolith/src/index.js                 — точка входа, регистрация маршрутов
backend/monolith/src/core/TokenBasedLLMCoordinator.js — LLM роутер
backend/monolith/src/database/               — адаптеры MySQL/SQLite
src/composables/useIntegram.js               — Vue composable для данных
CLAUDE.md                                    — архитектурные правила
```

*Последнее обновление: 2026-03-31*
