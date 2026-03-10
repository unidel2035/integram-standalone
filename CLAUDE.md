# CLAUDE.md — VentureOS Platform

## Что это за репозиторий

**VentureOS** — AI-платформа управления венчурным фондом.  
Покрывает полный цикл: заявка → AI-инвесткомитет → сделка → мониторинг → выход.

**Live demo:** https://ai2fund.ru

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
| `/fst` | FstLanding.vue | Лендинг (публичный) |
| `/fst-hub` | FstHub.vue | Хаб — все модули фонда |
| `/fst-committee` | FstCommittee.vue | AI-инвесткомитет (6 агентов) |
| `/fst-protocol` | FstProtocol.vue | Протоколы заседаний ИК |
| `/fst-deal` | FstDeal.vue | Сделка: SPV, транши, Term Sheet, финмодель |
| `/fst-portfolio` | FstPortfolio.vue | Портфель: светофор, датчики, AI-отчёты |
| `/fst-execution` | FstExecution.vue | Исполнение: Kanban, KPI, действия фонда |
| `/fst-twin` | FstDigitalTwin.vue | ЦД компании: симуляция tick-engine |
| `/fst-fund` | FstFundTwin.vue | ЦД фонда: NAV, IRR, субфонды |
| `/fst-sourcing` | FstSourcing.vue | AI Deal Sourcing |
| `/fst-transparency` | FstTransparency.vue | Публичная витрина фонда |
| `/fst-administration` | FstAdministration.vue | Бэк-офис фонда |
| `/fst-terminal` | FstTerminal.vue | Claude Code CLI (WebSocket TTY) |
| `/fst-dev-guide` | FstDevGuide.vue | Путь обучения VentureOS |

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
Deploy:    sshpass -p 'k7x21PZkGFMR' ssh root@185.252.147.243
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

1. **Ветка:** `main` (основная)
2. **Сервисы:** systemd, НЕ pm2
   - `sudo systemctl restart dronedoc-backend`
   - `sudo systemctl restart dronedoc-frontend`
3. **Тема и цвета — строгие правила:**

   **Запрещено:**
   - Хардкод hex-цветов (`#66bb6a`, `#ef5350`, `#42a5f5` и т.д.) — ни в CSS, ни в JS, ни в inline-стилях шаблона
   - PrimeVue токены шкалы 0/50/100/200 (слишком светлые/тёмные, ломают тему)
   - `rgba(76,175,80,0.15)` и подобные — используй `color-mix(in srgb, var(--fst-green) 15%, transparent)`

   **Разрешено — только эти переменные:**

   | Назначение | Переменная |
   |-----------|-----------|
   | Основной текст | `var(--p-text-color)` |
   | Вторичный текст | `var(--p-text-muted-color)` |
   | Фон карточки | `var(--p-surface-card)` |
   | Граница | `var(--p-content-border-color)` |
   | Акцент платформы | `var(--p-primary-color)` |
   | **Зелёный** (успех, норма, рост) | `var(--fst-green)` / `var(--fst-green-dark)` |
   | **Красный** (риск, ошибка) | `var(--fst-red)` / `var(--fst-red-dark)` |
   | **Синий** (инфо, TRL, технологии) | `var(--fst-blue)` / `var(--fst-blue-dark)` |
   | **Фиолетовый** (AI, ИК, патенты) | `var(--fst-purple)` / `var(--fst-purple-dark)` |
   | **Оранжевый** (предупреждение, KPI) | `var(--fst-brand)` / `var(--fst-brand-dark)` |
   | **Циан** (события, история) | `var(--fst-cyan)` |

   Все `--fst-*` переменные определены в `src/assets/fst.css`.

   **Правило для JS-значений цвета** (inline `:style`, data-массивы, функции `*Color()`):
   ```js
   // ✅ правильно — CSS var работает и в inline-стилях
   function riskColor(level) {
     if (level === 'green') return 'var(--fst-green)'
     if (level === 'yellow') return 'var(--fst-brand)'
     return 'var(--fst-red)'
   }
   // ❌ неправильно
   function riskColor(level) { return level === 'green' ? '#66bb6a' : '#ef5350' }
   ```

   **Исключение:** Chart.js `borderColor`/`backgroundColor` — там CSS vars не работают, оставить hex.

   **Шаблон страницы:** Все sidebar-страницы должны использовать `<FstPageLayout>` из `src/components/fst-shared/FstPageLayout.vue` (PrimeVue Toolbar + единый скелет)

4. **PrimeVue компоненты — обязательно:**

   **Запрещено использовать нативные HTML элементы форм:**
   - `<input>` → `<InputText>` / `<InputNumber>`
   - `<select>` → `<Select>`
   - `<button>` для переключателей/табов → `<SelectButton>`
   - `<textarea>` → `<Textarea>`

   **InputNumber в узких колонках — всегда:**
   ```vue
   <InputNumber v-model="val" :showButtons="false" fluid />
   ```
   Без `showButtons="false"` спиннеры +/− ломают layout в flex/grid колонках.

   **Переключатели разделов (вкладки) — SelectButton:**
   ```vue
   <SelectButton v-model="activeTab" :options="tabs" optionLabel="label" optionValue="id" :allowEmpty="false" />
   ```
   Эталон: FstDeal (Equity/CLN/Грант), FstCaptable (Cap Table/Разводнение/Ликв. преф.)

   **Метрики-полоска в FstPageLayout-страницах — flush:**
   ```css
   .page-metrics {
     margin: -20px -20px 0;                              /* flush к краям body */
     border-bottom: 1px solid var(--p-content-border-color);
   }
   ```
   Эталон: FstPortfolio (`.fsp-metrics`), FstCaptable (`.ct-metrics`)

   **Форм-строки с несколькими полями — min-width: 0:**
   ```css
   .fst-form-group { min-width: 0; }   /* предотвращает overflow в flex */
   ```

   **Секции-карточки внутри FstPageLayout — обязательный wrapper с gap:**

   `fst-page-body` **не добавляет gap между дочерними элементами автоматически.**
   Каждая страница с несколькими карточками/секциями оборачивает их в контейнер:
   ```vue
   <!-- После metrics strip — все карточки в одном wrapper -->
   <div class="page-content">
     <div class="page-card">...</div>
     <div class="page-card">...</div>
   </div>
   ```
   ```css
   .page-content {
     display: flex;
     flex-direction: column;
     gap: 16px;
     padding-top: 16px;   /* отступ от metrics strip */
   }
   .page-card {
     background: var(--p-surface-card);
     border: 1px solid var(--p-content-border-color);
     border-radius: 12px;
     padding: 20px;
   }
   ```
   Эталон: FstWaterfall (`.wf-content`), FstCaptable (`.ct-section`)

   **Заголовки секций внутри карточек — НЕ `<h2>`/`<h3>`/`<h4>`:**
   ```css
   .page-section-title {
     font-size: 11px; font-weight: 700;
     text-transform: uppercase; letter-spacing: 0.07em;
     color: var(--p-text-muted-color);
     margin-bottom: 14px;
   }
   ```

5. **Единый скелет страниц — дизайн-система отступов:**

   Эталон: **FstHub** и **FstCommittee** — обе используют один скелет.

   **Правило layout-main-container** (`src/assets/layout/_main.scss`):
   ```
   padding: 6rem 2rem 0 2rem   ← ЕДИНЫЙ для всех страниц
   ```
   - `6rem` сверху = высота AppTopbar (~4rem) + 2rem дыхание
   - `2rem` по бокам = отступ контента от края sidebar
   - Страницы-исключения (full-bleed, например Committee, Terminal) сохраняют те же `2rem` по бокам, но могут менять поведение overflow/flex

   **Внутренний топбар страницы** (если есть свой, как у Hub/Committee):
   ```css
   padding: 12px 20px;
   border-bottom: 1px solid var(--p-content-border-color);
   position: sticky; top: 0; z-index: 10;
   ```

   **Типы страниц:**
   | Тип | Пример | Топбар |
   |-----|--------|--------|
   | **FstPageLayout** | Portfolio, Deal, Execution | `<FstPageLayout>` — единый компонент |
   | **Custom topbar** | Hub, Committee | собственный sticky topbar, отступы как выше |
   | **Full-bleed** | Committee, Terminal | `html.*-page` класс + overflow:hidden |
   | **Без layout** | Landing, Login | публичные, без sidebar |

   **НЕ делать:**
   - `padding-top: 4rem` в `layout-main-container` (контент сдвигается выше AppTopbar)
   - `padding: 0` по бокам без компенсации внутри компонента
   - Хардкод отступов в самом компоненте вместо использования скелета
6. **БД:** Только Integram MCP — никакого PostgreSQL/MySQL
7. **AI:** Только через token router `/api/ai-tokens/chat` — никаких прямых API-ключей на фронте
8. **Новый маршрут → обязательно добавить в:**
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
INTEGRAM_SYSTEM_USERNAME=your-integram-login
INTEGRAM_SYSTEM_PASSWORD=your-integram-password
TELEGRAM_BOT_TOKEN=...
GITHUB_TOKEN=...         # для Koda (бесплатный AI)
YANDEX_API_KEY=...
YANDEX_FOLDER_ID=...
```
