/**
 * СОД — Событийно-Ориентированный Дашборд
 * Спецификация модельных событий и требований
 *
 * Концепт: дашборд портфеля живёт по правилам онтологии событий.
 * Каждое действие пользователя, каждое изменение данных — событие.
 * Блоки дашборда появляются, исчезают, перестраиваются на основе событий.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 1. МОДЕЛЬНЫЕ СОБЫТИЯ (что порождает изменение дашборда)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── Категория: Взаимодействие пользователя (UI Events) ────────────────────
export const UI_EVENTS = {
  // Клик по модулю/блоку — другие перестраиваются
  BLOCK_FOCUSED: {
    id: 'BLOCK_FOCUSED',
    label: 'Фокус на блоке',
    description: 'Пользователь кликнул на блок дашборда → остальные блоки перестраиваются в контекст выбранного',
    payload: '{ blockId, blockType, context }',
    effects: [
      'Связанные блоки подсвечиваются',
      'Нерелевантные блоки сворачиваются или уходят',
      'Появляются drill-down блоки для выбранного контекста',
    ],
    examples: [
      'Клик на "Субфонд БАС" → все графики фильтруются по БАС, появляется детальный блок компаний БАС',
      'Клик на компанию в рейтинге → появляется карточка компании, её KPI, цепочка событий',
      'Клик на фазу в Phase Timeline → появляется список компаний в этой фазе',
    ],
  },

  COMPANY_SELECTED: {
    id: 'COMPANY_SELECTED',
    label: 'Компания выбрана',
    description: 'Пользователь выбрал конкретную компанию → дашборд перестраивается под неё',
    payload: '{ companyId, companyName, scope }',
    effects: [
      'Появляется блок детальной карточки компании',
      'Графики перестраиваются: подсвечивают выбранную компанию',
      'Показываются цепочки событий именно этой компании',
      'Появляется timeline событий компании',
    ],
  },

  SUBFUND_FILTERED: {
    id: 'SUBFUND_FILTERED',
    label: 'Фильтр по субфонду',
    description: 'Пользователь выбрал субфонд → все блоки фильтруются',
    payload: '{ subfundId, subfundName }',
    effects: [
      'Все метрики пересчитываются для выбранного субфонда',
      'Компании не из этого субфонда скрываются',
      'Появляется блок сравнения субфонда с общим портфелем',
    ],
  },

  AI_QUERY_SENT: {
    id: 'AI_QUERY_SENT',
    label: 'AI-запрос отправлен',
    description: 'Пользователь ввёл запрос в AI-бар → генерируются динамические блоки',
    payload: '{ query, blocks[] }',
    effects: [
      'Статические блоки отходят на второй план (уменьшаются)',
      'Появляются AI-блоки с анимацией',
      'AI-блоки имеют приоритет в layout',
    ],
  },

  PHASE_CLICKED: {
    id: 'PHASE_CLICKED',
    label: 'Фаза жизненного цикла выбрана',
    description: 'Клик по фазе в Phase Timeline → дашборд показывает контекст этой фазы',
    payload: '{ phaseId, phaseName }',
    effects: [
      'Появляется блок со списком компаний в этой фазе',
      'Показываются события этой фазы',
      'Появляется блок "Что нужно сделать" для перехода в следующую фазу',
    ],
  },

  SIGNAL_CLICKED: {
    id: 'SIGNAL_CLICKED',
    label: 'Сигнал выбран',
    description: 'Клик по сигналу в Signal Board → раскрывается детальный контекст',
    payload: '{ signalId, eventType, companyId }',
    effects: [
      'Раскрывается причинно-следственная цепочка сигнала',
      'Появляется блок рекомендаций по этому сигналу',
      'Подсвечивается компания в графиках и таблицах',
    ],
  },
}

// ── Категория: Данные (Data Events) ────────────────────────────────────────
export const DATA_EVENTS = {
  METRICS_LOADED: {
    id: 'METRICS_LOADED',
    label: 'Метрики загружены',
    description: 'Данные из Integram загружены и обогащены → дашборд перестраивается',
    payload: '{ companyCount, hasRevenue, hasRisk }',
    effects: [
      'Появляются графики (до загрузки — скелетоны)',
      'Пересчитываются все KPI',
      'Генерируются производные события (RISK_ELEVATED и т.д.)',
    ],
  },

  RISK_CHANGED: {
    id: 'RISK_CHANGED',
    label: 'Уровень риска изменился',
    description: 'У компании изменился riskLevel → перестраивается Signal Board и тепловая карта',
    payload: '{ companyId, oldRisk, newRisk }',
    effects: [
      'Signal Board получает новый сигнал',
      'Тепловая карта обновляет цвет ячейки',
      'Если risk → red: появляется блок "Созвать ИК"',
      'Обновляется Phase Timeline (может появиться фаза "Алерты")',
    ],
  },

  REVENUE_UPDATED: {
    id: 'REVENUE_UPDATED',
    label: 'Обновление выручки',
    description: 'Компания обновила финансовые показатели',
    payload: '{ companyId, oldRevenue, newRevenue }',
    effects: [
      'Графики выручки перестраиваются',
      'Если первая выручка: появляется milestone-блок',
      'MOIC пересчитывается',
      'Может сработать REVENUE_MILESTONE → цепочка на NEXT_TRANCHE_RELEASED',
    ],
  },

  NEW_COMPANY_ADDED: {
    id: 'NEW_COMPANY_ADDED',
    label: 'Новая компания в портфеле',
    description: 'Добавлена компания через сделку → дашборд обновляется',
    payload: '{ companyId, subfund, stage }',
    effects: [
      'Метрики top strip обновляются (N+1)',
      'Phase Timeline: фаза "Вход" получает +1',
      'Графики по субфондам / стадиям обновляются',
      'Появляется приветственный блок новой компании',
    ],
  },
}

// ── Категория: Аналитические (Analytical Events) ─────────────────────────
export const ANALYTICAL_EVENTS = {
  THRESHOLD_CROSSED: {
    id: 'THRESHOLD_CROSSED',
    label: 'Порог пересечён',
    description: 'Автоматический триггер при пересечении порогового значения',
    payload: '{ metric, threshold, direction, companyId }',
    examples: [
      'Runway < 6 месяцев → блок-алерт "Критический runway"',
      'MOIC > 3x → блок-достижение "Звёздная компания"',
      'Herfindahl > 0.25 → блок-предупреждение "Высокая концентрация"',
      'Доля фонда < 5% → блок-рекомендация "Размытие позиции"',
    ],
    effects: [
      'Появляется блок-нотификация на дашборде',
      'Подсвечивается компания/метрика',
      'Записывается в eventStore для истории',
    ],
  },

  PATTERN_DETECTED: {
    id: 'PATTERN_DETECTED',
    label: 'Паттерн обнаружен',
    description: 'AI или правила обнаружили закономерность в данных портфеля',
    payload: '{ patternType, companies[], insight }',
    examples: [
      'Все компании БАС-субфонда имеют рост выручки > 30% → блок-инсайт',
      '3 компании одновременно в красной зоне → блок "Системный риск"',
      'Средний TRL портфеля растёт 3 квартала подряд → блок "Технологическая зрелость"',
    ],
  },

  CAUSAL_CHAIN_TRIGGERED: {
    id: 'CAUSAL_CHAIN_TRIGGERED',
    label: 'Причинно-следственная цепочка',
    description: 'Событие A произошло → разблокирует событие B (из eventRegistry enables)',
    payload: '{ fromEvent, toEvent, companyId, status }',
    effects: [
      'В блоке цепочек появляется новая связь',
      'Если toEvent ожидается: пульсирующая индикация',
      'Если toEvent произошло: зелёная галочка',
    ],
  },
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 2. ПРАВИЛА ПЕРЕСТРОЕНИЯ ДАШБОРДА (Layout Rules)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Правило 1: ФОКУС
 *   При клике на любой блок дашборда:
 *   - Выбранный блок расширяется (flex: 2)
 *   - Связанные блоки остаются видимыми
 *   - Нерелевантные блоки сворачиваются в минимальный размер
 *   - Появляются drill-down блоки
 *
 * Правило 2: КОНТЕКСТ
 *   Блоки дашборда реагируют на глобальный контекст:
 *   - Выбран субфонд → все фильтруются
 *   - Выбрана компания → все подсвечивают её
 *   - Введён AI-запрос → AI-блоки вытесняют статические
 *
 * Правило 3: ПРИОРИТЕТЫ БЛОКОВ
 *   Порядок отображения определяется приоритетом:
 *   1. AI-блоки (если есть) — всегда сверху
 *   2. Алерты (RISK_ELEVATED, THRESHOLD_CROSSED) — сразу после
 *   3. Сигналы (Signal Board) — живая лента
 *   4. Phase Timeline — горизонтальная шкала
 *   5. Причинно-следственные цепочки
 *   6. Статические графики и KPI
 *
 * Правило 4: ПОЯВЛЕНИЕ / ИСЧЕЗНОВЕНИЕ
 *   Блоки появляются ТОЛЬКО когда есть данные:
 *   - Нет событий фазы "alert" → блок алертов скрыт
 *   - Нет компаний с выручкой → графики выручки скрыты
 *   - Нет AI-запросов → AI-блоки скрыты
 *   Анимация: slide-in + fade (0.35s ease-out)
 *
 * Правило 5: СВЯЗАННОСТЬ
 *   Блоки связаны через события:
 *   - Клик на сигнал → фокус на компанию → drill-down
 *   - Клик на фазу → список компаний в фазе
 *   - Hover на графике → подсветка во всех связанных графиках
 */

// ── Матрица реакций блоков на события ──────────────────────────────────────
export const BLOCK_REACTIONS = {
  // Строка = тип блока, столбец = событие → реакция
  'signal-board': {
    RISK_CHANGED: 'добавить/обновить сигнал',
    REVENUE_UPDATED: 'добавить сигнал milestone при первой выручке',
    COMPANY_SELECTED: 'подсветить сигналы выбранной компании',
    AI_QUERY_SENT: 'свернуть (AI-блоки приоритетнее)',
  },
  'phase-timeline': {
    NEW_COMPANY_ADDED: 'обновить счётчик фазы init',
    RISK_CHANGED: 'обновить счётчик фазы alert',
    PHASE_CLICKED: 'подсветить выбранную фазу, показать drill-down',
    SUBFUND_FILTERED: 'пересчитать счётчики по субфонду',
  },
  'causal-chains': {
    CAUSAL_CHAIN_TRIGGERED: 'добавить новую цепочку',
    COMPANY_SELECTED: 'показать только цепочки выбранной компании',
    METRICS_LOADED: 'перестроить цепочки из новых данных',
  },
  'risk-heatmap': {
    RISK_CHANGED: 'обновить цвет ячейки',
    COMPANY_SELECTED: 'подсветить ячейку рамкой',
    SUBFUND_FILTERED: 'показать только компании субфонда',
    THRESHOLD_CROSSED: 'мигание ячейки при пересечении порога',
  },
  'charts': {
    METRICS_LOADED: 'перестроить все графики',
    SUBFUND_FILTERED: 'фильтровать данные графиков',
    COMPANY_SELECTED: 'подсветить точку/столбец компании',
    AI_QUERY_SENT: 'уменьшить (дать место AI-блокам)',
  },
  'ai-blocks': {
    AI_QUERY_SENT: 'появиться с анимацией, занять верхнюю часть',
    COMPANY_SELECTED: 'если AI-блоки видны — добавить контекст компании',
    BLOCK_FOCUSED: 'перестроиться при клике на конкретный AI-блок',
  },
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 3. МОДЕЛЬНЫЕ ПОРОГОВЫЕ ЗНАЧЕНИЯ (Thresholds)
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export const THRESHOLDS = {
  RUNWAY_CRITICAL: { metric: 'runway', value: 6, unit: 'месяцев', direction: 'below', severity: 'critical', action: 'Созвать ИК для обсуждения бридж-раунда' },
  RUNWAY_WARNING: { metric: 'runway', value: 12, unit: 'месяцев', direction: 'below', severity: 'warning', action: 'Начать подготовку к следующему раунду' },
  MOIC_STAR: { metric: 'moic', value: 3, unit: 'x', direction: 'above', severity: 'success', action: 'Рассмотреть частичный выход или follow-on' },
  HERFINDAHL_HIGH: { metric: 'herfindahl', value: 0.25, unit: '', direction: 'above', severity: 'warning', action: 'Диверсифицировать: добавить проекты из другого субфонда' },
  SHARE_DILUTION: { metric: 'fundShare', value: 5, unit: '%', direction: 'below', severity: 'warning', action: 'Участвовать в раунде для защиты доли' },
  REVENUE_FIRST: { metric: 'revenue', value: 0, unit: '₽', direction: 'above', severity: 'success', action: 'Первая выручка! Рассмотреть транш-2' },
  TRL_READY: { metric: 'trl', value: 8, unit: '', direction: 'above', severity: 'success', action: 'TRL 8+ — готовность к масштабированию' },
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 4. ТРЕБОВАНИЯ К РЕАЛИЗАЦИИ
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * REQ-1: Все блоки дашборда должны реагировать на глобальный dashboardContext
 *   dashboardContext = reactive({ focusedBlock, selectedCompany, selectedSubfund, selectedPhase, aiBlocks })
 *
 * REQ-2: Каждый клик по блоку порождает событие BLOCK_FOCUSED с context
 *   → eventBus.emit('dashboard:focus', { blockId, blockType, context })
 *
 * REQ-3: Графики Chart.js должны поддерживать highlight-режим
 *   → при COMPANY_SELECTED подсвечивать элемент, остальные делать полупрозрачными
 *
 * REQ-4: TransitionGroup для всех динамических секций
 *   → плавное появление/исчезновение/перемещение блоков
 *
 * REQ-5: AI-бар встроен в дашборд (не отдельная вкладка)
 *   → AI-блоки появляются прямо среди статических
 *   → При AI-запросе статические блоки "отъезжают" вниз
 *
 * REQ-6: Пороговые значения (THRESHOLDS) проверяются при каждом обновлении данных
 *   → Автоматически генерируют блоки-алерты
 *   → Записываются в eventStore
 *
 * REQ-7: Все тексты на русском языке
 *   → Нет английских лейблов (кроме терминов: MOIC, TVPI, DPI, TRL, IRR, Due Diligence)
 *
 * REQ-8: Кросс-блочная навигация
 *   → Клик на компанию в любом блоке → COMPANY_SELECTED → все блоки реагируют
 *   → Клик на фазу → PHASE_CLICKED → фильтрация
 *   → Клик на сигнал → SIGNAL_CLICKED → drill-down
 *
 * REQ-9: Persistence
 *   → AI-блоки сохраняются в eventStore (тип KPI_UPDATED с uiBlock)
 *   → При обновлении страницы последние AI-блоки восстанавливаются
 *
 * REQ-10: Пресеты быстрых запросов
 *   → "Риски", "Лидеры", "Сравнение", "Runway", "Рекомендации"
 *   → Каждый пресет = готовый промпт для AI с ожидаемой структурой блоков
 */

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 5. ПРАВИЛА ВИДИМОСТИ БЛОКОВ (Anti-Clutter Rules)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Принцип: КАЖДЫЙ блок знает, когда ему появляться.
 * Нет данных → нет блока. Нет события → нет реакции.
 * Дашборд минимален при первой загрузке, растёт по мере поступления данных.
 */
export const BLOCK_VISIBILITY_RULES = {
  // ─── ВСЕГДА ВИДИМЫЕ ─────────────────────────────────────────────────────
  'ai-bar':           { condition: 'ВСЕГДА', reason: 'Точка входа для пользователя' },
  'metrics-strip':    { condition: 'ВСЕГДА', reason: 'KPI верхней полоски — базовая навигация' },
  'summary-cards':    { condition: 'allCompanies.length > 0', reason: 'Есть хотя бы 1 компания' },

  // ─── СОБЫТИЙНЫЕ (появляются по событиям) ────────────────────────────────
  'signal-board':     { condition: 'ВСЕГДА (пустое состояние: "Все в норме")', reason: 'Пользователь должен видеть, что система мониторит. Сигналы появляются из RISK_ELEVATED, REVENUE_MILESTONE и т.д.' },
  'phase-timeline':   { condition: 'ВСЕГДА', reason: 'Показывает жизненный цикл всего портфеля, счётчики обновляются из событий' },
  'phase-drill':      { condition: 'dashCtx.focusedPhase !== null', reason: 'Только при клике на фазу в Phase Timeline' },
  'alert-block':      { condition: 'eventBlockData.alerts.length > 0', reason: 'Есть события RISK_ELEVATED' },
  'milestone-block':  { condition: 'eventBlockData.milestones.length > 0', reason: 'Есть события REVENUE_MILESTONE, PRODUCT_LAUNCH' },
  'deals-block':      { condition: 'eventBlockData.deals.length > 0', reason: 'Есть события DEAL_SOURCED, TERM_SHEET_*, DD_*' },
  'growth-block':     { condition: 'eventBlockData.growth.length > 0', reason: 'Есть события ROUND_OPENED, EXIT_EVENT' },
  'causal-chains':    { condition: 'activeCausalChains.length > 0', reason: 'Есть события с enables (цепочки причина→следствие)' },
  'threshold-alerts': { condition: 'thresholdAlerts.length > 0', reason: 'Автоматические пороговые триггеры (runway < 6, MOIC > 3x, TRL >= 8)' },
  'ai-blocks':        { condition: 'aiBlocks.length > 0', reason: 'Пользователь сделал AI-запрос' },

  // ─── АНАЛИТИЧЕСКИЕ (появляются при наличии данных) ──────────────────────
  'subfund-pie':      { condition: 'allCompanies.length > 0', reason: 'Есть компании для группировки' },
  'stage-pie':        { condition: 'allCompanies.length > 0', reason: 'Есть компании для группировки' },
  'health-pie':       { condition: 'allCompanies.length > 0', reason: 'Есть компании для оценки здоровья' },
  'top-investments':  { condition: 'portfolioCompanies.some(c => c.invested > 0)', reason: 'Есть инвестированные компании' },
  'trl-distribution': { condition: 'portfolioCompanies.some(c => c.invested > 0)', reason: 'Есть данные TRL' },
  'risk-heatmap':     { condition: 'portfolioCompanies.length > 0', reason: 'Есть портфельные компании' },
  'bubble-chart':     { condition: 'portfolioCompanies.length > 0', reason: 'Есть данные TRL + инвестиции' },
  'event-activity':   { condition: 'allEventsFlat.some(e => e.type !== "COMPANY_ADDED")', reason: 'Есть события кроме просто добавления' },
  'live-feed':        { condition: 'allEventsFlat.some(e => e.type !== "COMPANY_ADDED")', reason: 'Есть значимые события' },
  'revenue-chart':    { condition: 'portfolioCompanies.some(c => c.revenue > 0)', reason: 'Хотя бы 1 компания с выручкой' },
  'fund-deploy':      { condition: 'portfolioCompanies.some(c => c.revenue > 0)', reason: 'Есть данные для визуализации deployment' },
  'runway-bars':      { condition: 'portfolioCompanies.some(c => c.invested > 0)', reason: 'Есть данные для расчёта runway' },
  'moic-chart':       { condition: 'portfolioCompanies.some(c => c.invested > 0)', reason: 'Есть данные для расчёта MOIC' },
  'j-curve':          { condition: 'portfolioCompanies.length >= 3', reason: 'Минимум 3 компании для осмысленной J-кривой' },
  'cohort-vintage':   { condition: 'portfolioCompanies.length >= 3', reason: 'Минимум 3 компании для когортного анализа' },
  'radar-chart':      { condition: 'portfolioCompanies.length >= 2', reason: 'Минимум 2 компании для сравнения' },
  'fund-kpis':        { condition: 'portfolioCompanies.length >= 2', reason: 'Минимум 2 компании для агрегированных KPI' },
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 6. ПОРЯДОК ПОЯВЛЕНИЯ БЛОКОВ (приоритет сверху вниз)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. AI-бар (всегда)
 * 2. AI-блоки (если есть запрос)
 * 3. Signal Board + Threshold Alerts
 * 4. Phase Timeline + Phase Drill-Down
 * 5. Event-triggered: Алерты → Вехи → Сделки → Рост → Цепочки
 * 6. Summary cards (Портфель + На рассмотрении)
 * 7. Графики-пироги (субфонды, стадии, здоровье)
 * 8. Аналитические графики (инвестиции, TRL, риски, bubble)
 * 9. Событийная активность + лента
 * 10. Выручка + deployment (только при наличии данных)
 * 11. Runway + MOIC (только при наличии инвестиций)
 * 12. J-Curve + Когорты (только при >= 3 компаний)
 * 13. Радар + KPI фонда (только при >= 2 компаний)
 */
