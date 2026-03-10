/**
 * GR Event Types — событийная онтология мер государственной поддержки
 *
 * Событийная онтология: объект существует через события.
 * Мера поддержки — не справочная запись, а ТИП СОБЫТИЯ,
 * которое происходит (или не происходит) между субъектом и проектом.
 *
 * Каждый тип события:
 *   - имеет субъекта (кто инициирует)
 *   - имеет объект (на что направлено)
 *   - имеет предусловия (какие события должны произойти до)
 *   - порождает постусловия (что становится возможным после)
 *   - принадлежит цепочке (market_failure | tech_gap | ...)
 */

// ─── Диагностика (обнаружение провалов) ──────────────────────────────────────

export const EVT_DIAGNOSE = {
  PROJECT_STARTED: {
    id: 'PROJECT_STARTED',
    label: 'Проект запущен',
    icon: 'pi pi-flag',
    color: '#64748b',
    subject: 'Команда основателей',
    object: 'Проект',
    description: 'Возникновение проекта — точка отсчёта всей событийной цепи',
    preconditions: [],
    enables: [
      'MARKET_FAILURE_DETECTED',
      'TECH_GAP_DETECTED',
      'REGULATORY_BARRIER_DETECTED',
      'INFRA_GAP_DETECTED',
    ],
    chain: null,
    phase: 'init',
  },

  MARKET_FAILURE_DETECTED: {
    id: 'MARKET_FAILURE_DETECTED',
    label: 'Рыночный провал выявлен',
    icon: 'pi pi-chart-line',
    color: '#ef4444',
    subject: 'Аналитик / Фонд',
    object: 'Рынок',
    description: 'Частный капитал не идёт в стадию из-за высоких рисков. TRL 1-5 — «долина смерти».',
    preconditions: ['PROJECT_STARTED'],
    enables: [
      'MEASURE_APPLIED:fasie-umnik',
      'MEASURE_APPLIED:fasie-start1',
      'MEASURE_APPLIED:sk-accelerator',
      'MEASURE_APPLIED:corpmsp-kredit',
      'MEASURE_APPLIED:asi-natproject',
    ],
    chain: 'market_failure',
    phase: 'diagnose',
  },

  TECH_GAP_DETECTED: {
    id: 'TECH_GAP_DETECTED',
    label: 'Технологический разрыв выявлен',
    icon: 'pi pi-microchip',
    color: '#f59e0b',
    subject: 'Аналитик / НТИ',
    object: 'Технология',
    description: 'GAP-анализ показал отставание от мировых лидеров на 3+ года по TRL.',
    preconditions: ['PROJECT_STARTED'],
    enables: [
      'MEASURE_APPLIED:nti-aeronet',
      'MEASURE_APPLIED:nti-technet',
      'MEASURE_APPLIED:frp-niokr',
      'MEASURE_APPLIED:sk-grant-rd',
      'MEASURE_APPLIED:rfriti-ai',
      'MEASURE_APPLIED:fpi-techdir',
    ],
    chain: 'tech_gap',
    phase: 'diagnose',
  },

  REGULATORY_BARRIER_DETECTED: {
    id: 'REGULATORY_BARRIER_DETECTED',
    label: 'Регуляторный барьер выявлен',
    icon: 'pi pi-shield',
    color: '#8b5cf6',
    subject: 'Юрист / Фонд',
    object: 'Нормативная среда',
    description: 'Нет стандартов, лицензий или сертификации — технология не может выйти на рынок.',
    preconditions: ['PROJECT_STARTED'],
    enables: [
      'MEASURE_APPLIED:sk-status',
      'MEASURE_APPLIED:napo-cert',
      'MEASURE_APPLIED:minprom-719',
      'MEASURE_APPLIED:minprom-spik',
    ],
    chain: 'regulatory_barrier',
    phase: 'diagnose',
  },

  INFRA_GAP_DETECTED: {
    id: 'INFRA_GAP_DETECTED',
    label: 'Инфраструктурный пробел выявлен',
    icon: 'pi pi-server',
    color: '#06b6d4',
    subject: 'Инженер / Фонд',
    object: 'Инфраструктура',
    description: 'Нет испытательных стендов, полигонов или производственных мощностей.',
    preconditions: ['PROJECT_STARTED'],
    enables: [
      'MEASURE_APPLIED:minprom-bas',
      'MEASURE_APPLIED:veb-tech',
      'MEASURE_APPLIED:frp-proekty',
      'MEASURE_APPLIED:corpmsp-kredit',
    ],
    chain: 'infrastructure_gap',
    phase: 'diagnose',
  },
}

// ─── Применение мер (подача / одобрение / финансирование) ─────────────────────

export const EVT_MEASURES = {
  MEASURE_APPLIED: {
    id: 'MEASURE_APPLIED',
    label: 'Заявка подана',
    icon: 'pi pi-send',
    color: '#3b82f6',
    subject: 'Команда',
    object: 'Оператор (фонд)',
    description: 'Команда подала заявку на получение государственной поддержки',
    preconditions: [], // динамические — зависит от measure.triggers
    enables: ['MEASURE_APPROVED', 'MEASURE_REJECTED'],
    phase: 'apply',
  },

  MEASURE_APPROVED: {
    id: 'MEASURE_APPROVED',
    label: 'Мера одобрена',
    icon: 'pi pi-check-circle',
    color: '#22c55e',
    subject: 'Оператор',
    object: 'Проект',
    description: 'Оператор одобрил заявку — ожидаем перечисления',
    preconditions: ['MEASURE_APPLIED'],
    enables: ['MEASURE_FUNDED'],
    phase: 'approve',
  },

  MEASURE_REJECTED: {
    id: 'MEASURE_REJECTED',
    label: 'Отказ по заявке',
    icon: 'pi pi-times-circle',
    color: '#ef4444',
    subject: 'Оператор',
    object: 'Проект',
    description: 'Заявка отклонена. Анализ причин → корректировка → повторная подача',
    preconditions: ['MEASURE_APPLIED'],
    enables: ['MEASURE_APPLIED', 'REJECTION_ANALYZED'],
    phase: 'approve',
  },

  REJECTION_ANALYZED: {
    id: 'REJECTION_ANALYZED',
    label: 'Отказ проанализирован',
    icon: 'pi pi-search',
    color: '#fb923c',
    subject: 'Команда / Консультант',
    object: 'Заявка',
    description: 'Выявлены причины отказа, намечен план корректировки',
    preconditions: ['MEASURE_REJECTED'],
    enables: ['MEASURE_APPLIED'],
    phase: 'diagnose',
  },

  MEASURE_FUNDED: {
    id: 'MEASURE_FUNDED',
    label: 'Финансирование получено',
    icon: 'pi pi-wallet',
    color: '#10b981',
    subject: 'Оператор → Банк',
    object: 'Проект (счёт)',
    description: 'Денежные средства поступили. Событие порождает возможности TRL-роста и пилотов.',
    preconditions: ['MEASURE_APPROVED'],
    enables: ['TRL_ADVANCED', 'PILOT_LAUNCHED', 'TEAM_HIRED'],
    phase: 'fund',
  },
}

// ─── Результаты (трансформация проекта) ──────────────────────────────────────

export const EVT_OUTCOMES = {
  TRL_ADVANCED: {
    id: 'TRL_ADVANCED',
    label: 'TRL повышен',
    icon: 'pi pi-arrow-up-right',
    color: '#6366f1',
    subject: 'Команда / Лаборатория',
    object: 'Технология',
    description: 'Технологическая готовность перешла на следующий уровень',
    preconditions: ['MEASURE_FUNDED'],
    enables: [
      'MEASURE_APPLIED:fasie-start2',
      'MEASURE_APPLIED:sk-grant-rd',
      'MEASURE_APPLIED:frp-niokr',
      'PILOT_LAUNCHED',
    ],
    phase: 'outcome',
  },

  PILOT_LAUNCHED: {
    id: 'PILOT_LAUNCHED',
    label: 'Пилот запущен',
    icon: 'pi pi-play',
    color: '#84cc16',
    subject: 'Команда + Якорный заказчик',
    object: 'Технология',
    description: 'Первый полноценный пилотный проект с реальным заказчиком',
    preconditions: ['MEASURE_FUNDED'],
    enables: ['PILOT_COMPLETED'],
    phase: 'outcome',
  },

  PILOT_COMPLETED: {
    id: 'PILOT_COMPLETED',
    label: 'Пилот завершён',
    icon: 'pi pi-check',
    color: '#22c55e',
    subject: 'Команда + Заказчик',
    object: 'Продукт',
    description: 'Пилот завершён с положительным результатом',
    preconditions: ['PILOT_LAUNCHED'],
    enables: [
      'CONTRACT_SIGNED',
      'MEASURE_APPLIED:fasie-start2',
      'MEASURE_APPLIED:fasie-razvitie',
      'MEASURE_APPLIED:frp-proekty',
    ],
    phase: 'outcome',
  },

  CERTIFICATION_OBTAINED: {
    id: 'CERTIFICATION_OBTAINED',
    label: 'Сертификация получена',
    icon: 'pi pi-verified',
    color: '#f97316',
    subject: 'Росавиация / Минпромторг',
    object: 'Продукт',
    description: 'Получен регуляторный статус — открыт доступ к госзакупкам',
    preconditions: ['REGULATORY_BARRIER_DETECTED', 'MEASURE_FUNDED'],
    enables: [
      'CONTRACT_SIGNED',
      'MEASURE_APPLIED:minprom-bas',
      'MEASURE_APPLIED:minprom-spik',
    ],
    phase: 'outcome',
  },

  CONTRACT_SIGNED: {
    id: 'CONTRACT_SIGNED',
    label: 'Контракт с заказчиком',
    icon: 'pi pi-file-edit',
    color: '#0ea5e9',
    subject: 'Команда + Заказчик',
    object: 'Сделка',
    description: 'Первый коммерческий контракт или LOI с якорным заказчиком',
    preconditions: ['PILOT_COMPLETED'],
    enables: [
      'MEASURE_APPLIED:minprom-bas',
      'MEASURE_APPLIED:rfriti-spp',
      'SCALE_READY',
    ],
    phase: 'outcome',
  },

  TEAM_HIRED: {
    id: 'TEAM_HIRED',
    label: 'Команда усилена',
    icon: 'pi pi-users',
    color: '#ec4899',
    subject: 'Основатели',
    object: 'Команда',
    description: 'Наняты ключевые специалисты на средства гранта',
    preconditions: ['MEASURE_FUNDED'],
    enables: ['TRL_ADVANCED', 'PILOT_LAUNCHED'],
    phase: 'outcome',
  },

  SCALE_READY: {
    id: 'SCALE_READY',
    label: 'Готовность к масштабированию',
    icon: 'pi pi-expand',
    color: '#a855f7',
    subject: 'Команда',
    object: 'Бизнес-модель',
    description: 'Продукт готов к промышленному масштабированию. Открываются крупные меры.',
    preconditions: ['CONTRACT_SIGNED', 'TRL_ADVANCED'],
    enables: [
      'MEASURE_APPLIED:veb-tech',
      'MEASURE_APPLIED:minprom-spik',
      'MEASURE_APPLIED:asi-natproject',
    ],
    phase: 'scale',
  },
}

// ─── Системные события ────────────────────────────────────────────────────────

const EVT_SYSTEM = {
  AI_PLAN_GENERATED: {
    label: 'AI-план сгенерирован',
    icon: 'pi pi-sparkles',
    color: '#f59e0b',
    subject: 'AI-агент',
    object: 'Команда проекта',
    description: 'Искусственный интеллект сформировал персональный план получения мер поддержки',
    preconditions: ['PROJECT_STARTED'],
    enables: [],
    phase: 'diagnose',
  },
  PROJECT_STARTED: {
    label: 'Проект зарегистрирован',
    icon: 'pi pi-flag',
    color: '#64748b',
    subject: 'Команда основателей',
    object: 'Платформа ФСТ',
    description: 'Проект зарегистрирован в системе. Начало событийной ленты.',
    preconditions: [],
    enables: ['MARKET_FAILURE_DETECTED', 'TECH_GAP_DETECTED', 'REGULATORY_BARRIER_DETECTED', 'INFRA_GAP_DETECTED'],
    phase: 'init',
  },
}

// ─── Полный каталог ───────────────────────────────────────────────────────────

export const GR_EVENT_TYPES = {
  ...EVT_DIAGNOSE,
  ...EVT_MEASURES,
  ...EVT_OUTCOMES,
  ...EVT_SYSTEM,
}

// ─── Фазы (визуальный порядок) ────────────────────────────────────────────────

export const EVENT_PHASES = [
  { id: 'init',     label: 'Старт',           icon: 'pi pi-flag',          color: '#64748b' },
  { id: 'diagnose', label: 'Диагностика',      icon: 'pi pi-search',        color: '#f59e0b' },
  { id: 'apply',    label: 'Подача заявки',    icon: 'pi pi-send',          color: '#3b82f6' },
  { id: 'approve',  label: 'Рассмотрение',     icon: 'pi pi-clock',         color: '#8b5cf6' },
  { id: 'fund',     label: 'Финансирование',   icon: 'pi pi-wallet',        color: '#10b981' },
  { id: 'outcome',  label: 'Результат',        icon: 'pi pi-arrow-up-right', color: '#6366f1' },
  { id: 'scale',    label: 'Масштабирование',  icon: 'pi pi-expand',        color: '#a855f7' },
]
