/**
 * FstCommitteeConfig.js — Static data for FST NTI Investment Committee Simulator
 *
 * AI Investment Committee: 6 agents debate project merits → humans approve decision
 * Based on ФСТ НТИ domain: БАС, Робот, МЭ subFunds, 6.4B RUB portfolio
 */

// ── Session Phases ────────────────────────────────────────────

export const PHASES = {
  IDLE:             { id: 'IDLE',             label: 'Ожидание',            icon: 'pi pi-clock',          color: '#78909c' },
  LOADING:          { id: 'LOADING',          label: 'Анализ документов',   icon: 'pi pi-file-search',    color: '#42a5f5' },
  PRIMARY_POSITIONS:{ id: 'PRIMARY_POSITIONS',label: 'Первичные позиции',   icon: 'pi pi-comments',       color: '#7e57c2' },
  CROSS_DEBATE:     { id: 'CROSS_DEBATE',     label: 'Дебаты',              icon: 'pi pi-bolt',           color: '#ef5350' },
  FINAL_POSITIONS:  { id: 'FINAL_POSITIONS',  label: 'Финальные позиции',   icon: 'pi pi-flag',           color: '#ff7043' },
  VOTING:           { id: 'VOTING',           label: 'Голосование',         icon: 'pi pi-check-square',   color: '#26c6da' },
  SYNTHESIS:        { id: 'SYNTHESIS',        label: 'Синтез решения',      icon: 'pi pi-chart-bar',      color: '#66bb6a' },
  HUMAN_APPROVAL:   { id: 'HUMAN_APPROVAL',   label: 'Утверждение людьми',  icon: 'pi pi-users',          color: '#ffa726' },
  CONCLUDED:        { id: 'CONCLUDED',        label: 'Завершено',           icon: 'pi pi-check-circle',   color: '#4caf50' },
  RECOMMENDATIONS:  { id: 'RECOMMENDATIONS',  label: 'Рекомендации',        icon: 'pi pi-list-check',     color: '#ab47bc' },
  REVISION:         { id: 'REVISION',         label: 'Доработка проекта',   icon: 'pi pi-cog',            color: '#26a69a' },
  READY_NEXT:       { id: 'READY_NEXT',       label: 'Готов к след. раунду',icon: 'pi pi-forward',        color: '#42a5f5' },
}

export const PHASE_ORDER = [
  'IDLE', 'LOADING', 'PRIMARY_POSITIONS', 'CROSS_DEBATE',
  'FINAL_POSITIONS', 'VOTING', 'SYNTHESIS', 'HUMAN_APPROVAL', 'CONCLUDED',
]

// Phases shown in progress bar for each round
export const ROUND_PHASE_ORDER = [
  'LOADING', 'PRIMARY_POSITIONS', 'CROSS_DEBATE',
  'FINAL_POSITIONS', 'VOTING', 'SYNTHESIS', 'HUMAN_APPROVAL',
]

// ── Agent Roles & Definitions ─────────────────────────────────

export const AGENTS = [
  {
    id: 'tech',
    name: 'Технический аналитик',
    shortName: 'Техн.',
    role: 'TECH_ANALYST',
    avatar: '🔬',
    color: '#42a5f5',
    bias: 'neutral',
    weight: 0.18,
    focus: ['trl', 'mrl', 'techRisk'],
    description: 'Оценивает технологическую зрелость, готовность к производству и технические риски',
    scoringWeights: { trl: 0.35, mrl: 0.30, sovereignty: 0.10, market: 0.05, finance: 0.10, risk: 0.10, team: 0.00 },
    thinkingPhrases: [
      'Изучаю технический паспорт...',
      'Проверяю уровень TRL по стандарту NASA...',
      'Анализирую производственную готовность...',
      'Сравниваю с мировыми аналогами...',
    ],
  },
  {
    id: 'finance',
    name: 'Финансовый аналитик',
    shortName: 'Фин.',
    role: 'FINANCIAL_ANALYST',
    avatar: '📊',
    color: '#66bb6a',
    bias: 'skeptic',
    weight: 0.20,
    focus: ['irr', 'npv', 'unitEconomics'],
    description: 'Оценивает финансовую модель, IRR, NPV и unit economics проекта',
    scoringWeights: { trl: 0.05, mrl: 0.05, sovereignty: 0.05, market: 0.20, finance: 0.55, risk: 0.10, team: 0.00 },
    thinkingPhrases: [
      'Строю финансовую модель...',
      'Рассчитываю IRR при базовом сценарии...',
      'Проверяю unit economics...',
      'Оцениваю потенциал выхода...',
    ],
  },
  {
    id: 'sovereignty',
    name: 'Эксперт суверенности',
    shortName: 'Суверен.',
    role: 'SOVEREIGNTY_EXPERT',
    avatar: '🛡️',
    color: '#ffa726',
    bias: 'optimist',
    weight: 0.16,
    focus: ['sovereignty', 'localization', 'importSub'],
    description: 'Оценивает уровень локализации, импортозамещения и соответствие критериям суверенности',
    scoringWeights: { trl: 0.05, mrl: 0.05, sovereignty: 0.55, market: 0.10, finance: 0.05, risk: 0.10, team: 0.10 },
    thinkingPhrases: [
      'Проверяю долю отечественных компонентов...',
      'Анализирую критические зависимости от импорта...',
      'Оцениваю соответствие критериям суверенности...',
      'Проверяю патентную чистоту...',
    ],
  },
  {
    id: 'risk',
    name: 'Риск-менеджер',
    shortName: 'Риски',
    role: 'RISK_MANAGER',
    avatar: '⚠️',
    color: '#ef5350',
    bias: 'pessimist',
    weight: 0.18,
    focus: ['techRisk', 'marketRisk', 'regulatoryRisk', 'teamRisk'],
    description: 'Идентифицирует и оценивает все категории рисков: технические, рыночные, регуляторные',
    scoringWeights: { trl: 0.10, mrl: 0.10, sovereignty: 0.10, market: 0.10, finance: 0.15, risk: 0.45, team: 0.00 },
    thinkingPhrases: [
      'Составляю реестр рисков...',
      'Оцениваю вероятность технического провала...',
      'Анализирую регуляторные риски в сфере БПЛА...',
      'Проверяю сценарии стресс-тестирования...',
    ],
  },
  {
    id: 'portfolio',
    name: 'Стратег портфеля',
    shortName: 'Портф.',
    role: 'PORTFOLIO_STRATEGIST',
    avatar: '🎯',
    color: '#7e57c2',
    bias: 'neutral',
    weight: 0.14,
    focus: ['portfolioFit', 'diversification', 'synergies'],
    description: 'Оценивает вписанность проекта в портфель фонда, синергии и диверсификацию',
    scoringWeights: { trl: 0.05, mrl: 0.05, sovereignty: 0.15, market: 0.25, finance: 0.20, risk: 0.10, team: 0.20 },
    thinkingPhrases: [
      'Анализирую текущий портфель фонда...',
      'Оцениваю синергии с портфельными компаниями...',
      'Проверяю диверсификацию по рынкам НТИ...',
      'Рассматриваю стратегическую позицию...',
    ],
  },
  {
    id: 'devil',
    name: 'Критический аналитик',
    shortName: 'Критик',
    role: 'CRITICAL_ANALYST',
    avatar: '🔍',
    color: '#78909c',
    bias: 'pessimist',
    weight: 0.14,
    focus: ['weaknesses', 'assumptions', 'alternatives'],
    description: 'Оспаривает допущения, ищет слабые места, предлагает альтернативные интерпретации',
    scoringWeights: { trl: 0.10, mrl: 0.10, sovereignty: 0.10, market: 0.15, finance: 0.20, risk: 0.25, team: 0.10 },
    thinkingPhrases: [
      'Ищу слабые места в заявке...',
      'Проверяю оптимистичные допущения команды...',
      'Рассматриваю сценарий провала...',
      'Анализирую конкурентный ландшафт критически...',
    ],
  },
]

// ── Scoring Dimensions ────────────────────────────────────────

export const SCORING_DIMS = {
  trl:         { label: 'TRL',          weight: 0.12, unit: '1-9',  color: '#42a5f5', description: 'Уровень технологической готовности' },
  mrl:         { label: 'MRL',          weight: 0.10, unit: '1-10', color: '#26c6da', description: 'Уровень производственной готовности' },
  sovereignty: { label: 'Суверенность', weight: 0.20, unit: '0-9',  color: '#ffa726', description: 'Степень технологического суверенитета' },
  market:      { label: 'Рынок',        weight: 0.12, unit: 'млрд', color: '#66bb6a', description: 'Размер и доступность целевого рынка' },
  finance:     { label: 'Финансы',      weight: 0.18, unit: 'IRR%', color: '#7e57c2', description: 'Финансовая привлекательность (IRR/NPV)' },
  risk:        { label: 'Риски',        weight: 0.15, unit: '0-10', color: '#ef5350', description: 'Комплексная оценка рисков (инверс.)' },
  team:        { label: 'Команда',      weight: 0.13, unit: '0-10', color: '#ffd54f', description: 'Качество команды и трек-рекорд' },
}

// ── SubFunds ──────────────────────────────────────────────────

export const SUBFUNDS = {
  bas: {
    id: 'bas',
    name: 'Субфонд БАС',
    shortName: 'БАС',
    color: '#42a5f5',
    icon: 'pi pi-send',
    budget: 3_200_000_000,
    deployedRatio: 0.31,
    description: 'Беспилотные авиационные системы',
    marketFocus: ['aeronet'],
  },
  robot: {
    id: 'robot',
    name: 'Субфонд Робот',
    shortName: 'Робот',
    color: '#66bb6a',
    icon: 'pi pi-cog',
    budget: 1_800_000_000,
    deployedRatio: 0.18,
    description: 'Робототехника и автономные системы',
    marketFocus: ['autonet'],
  },
  me: {
    id: 'me',
    name: 'Субфонд МЭ',
    shortName: 'МЭ',
    color: '#ffa726',
    icon: 'pi pi-chip',
    budget: 1_400_000_000,
    deployedRatio: 0.22,
    description: 'Микро- и радиоэлектроника',
    marketFocus: ['neuronet', 'energynet'],
  },
}

// ── Sample Projects Pool ──────────────────────────────────────

export const PROJECTS_POOL = [
  {
    id: 'proj_001',
    title: 'АвиаЛогик — система управления роем БПЛА',
    company: 'ООО АвиаЛогик',
    subFund: 'bas',
    market: 'АэроНет',
    stage: 'Seed',
    requestedAmount: 180_000_000,
    trl: 6,
    mrl: 4,
    sovereigntyScore: 7,
    localizationRatio: 0.72,
    marketSize: 12_400_000_000,
    projectedIRR: 0.34,
    teamStrength: 0.78,
    employees: 23,
    founded: 2021,
    patents: 3,
    description: 'Система централизованного управления роем из 50+ БПЛА для логистики и мониторинга. Разработка алгоритмов распределённой навигации на отечественной элементной базе.',
    strengths: ['Высокая суверенность', 'Растущий рынок', 'Опытная команда'],
    risks: ['TRL 6 — нет опытной эксплуатации', 'Зависимость от одного заказчика', 'Низкий MRL'],
    documents: ['Технический паспорт', 'Финансовая модель', 'Письма намерений от 2 заказчиков'],
  },
  {
    id: 'proj_002',
    title: 'МикроСхема — отечественный RISC-V процессор для БПЛА',
    company: 'АО МикроСхема',
    subFund: 'me',
    market: 'Сквозная технология',
    stage: 'Series A',
    requestedAmount: 450_000_000,
    trl: 5,
    mrl: 3,
    sovereigntyScore: 9,
    localizationRatio: 0.91,
    marketSize: 8_700_000_000,
    projectedIRR: 0.28,
    teamStrength: 0.85,
    employees: 67,
    founded: 2018,
    patents: 12,
    description: 'Разработка и серийное производство процессора RISC-V для бортовых компьютеров БПЛА. Полностью отечественная разработка, производство на отечественных мощностях.',
    strengths: ['Максимальная суверенность', 'Широкий B2B рынок', 'Сильная IP-база'],
    risks: ['TRL 5 — прототип, не серийный продукт', 'Длинный цикл R&D', 'Высокая капиталоёмкость'],
    documents: ['Прототип чипа', 'Техническая документация', 'Соглашение с МЦСТ'],
  },
  {
    id: 'proj_003',
    title: 'АэроМед — БПЛА для санитарной авиации в труднодоступных районах',
    company: 'ООО АэроМед',
    subFund: 'bas',
    market: 'АэроНет',
    stage: 'Pre-seed',
    requestedAmount: 60_000_000,
    trl: 4,
    mrl: 2,
    sovereigntyScore: 5,
    localizationRatio: 0.48,
    marketSize: 3_200_000_000,
    projectedIRR: 0.21,
    teamStrength: 0.55,
    employees: 8,
    founded: 2023,
    patents: 0,
    description: 'БПЛА вертикального взлёта для доставки медикаментов и биоматериалов в труднодоступные районы Сибири и Дальнего Востока. Поддержка государственного заказчика.',
    strengths: ['Социальная значимость', 'Господдержка', 'Первые испытания пройдены'],
    risks: ['Ранняя стадия (TRL 4)', 'Низкая суверенность', 'Рынок < 5 млрд', 'Слабая команда'],
    documents: ['Концепция', 'Письмо поддержки Минздрава', 'MVP видео'],
  },
  {
    id: 'proj_004',
    title: 'РоботАгро — автономная система мониторинга полей',
    company: 'ООО РоботАгро',
    subFund: 'robot',
    market: 'АвтоНет / АгроНет',
    stage: 'Series A',
    requestedAmount: 290_000_000,
    trl: 7,
    mrl: 6,
    sovereigntyScore: 6,
    localizationRatio: 0.65,
    marketSize: 18_500_000_000,
    projectedIRR: 0.41,
    teamStrength: 0.82,
    employees: 45,
    founded: 2019,
    patents: 7,
    description: 'Автономный наземный робот для мониторинга сельскохозяйственных угодий, точного внесения удобрений и ранней диагностики болезней растений. Интеграция с БПЛА-мониторингом.',
    strengths: ['TRL 7 — опытная эксплуатация', 'Большой рынок', 'Высокий IRR', 'Синергия с портфелем'],
    risks: ['Зависимость от иностранных сенсоров', 'Высокая конкуренция', 'Сезонность'],
    documents: ['Прототип', 'Данные по 3 сезонам испытаний', 'Контракт с агрохолдингом'],
  },
  {
    id: 'proj_005',
    title: 'СканТекс — лидарная система для автопилота беспилотных грузовиков',
    company: 'ООО СканТекс',
    subFund: 'bas',
    market: 'АвтоНет',
    stage: 'Seed',
    requestedAmount: 220_000_000,
    trl: 5,
    mrl: 3,
    sovereigntyScore: 4,
    localizationRatio: 0.41,
    marketSize: 22_000_000_000,
    projectedIRR: 0.29,
    teamStrength: 0.70,
    employees: 31,
    founded: 2020,
    patents: 5,
    description: 'Отечественный твёрдотельный лидар для систем автопилота грузовых автомобилей. Производительность сопоставима с Velodyne, стоимость в 3 раза ниже.',
    strengths: ['Огромный рынок', 'Ценовое преимущество', 'Растущий спрос'],
    risks: ['Низкая суверенность (ключевые компоненты — импорт)', 'Высокий технический риск', 'Сильные зарубежные конкуренты'],
    documents: ['Техническое описание', 'Тест-отчёт', 'МОУ с КАМАЗом'],
  },
]

// ── Argument Templates ─────────────────────────────────────────

export const ARGUMENT_TEMPLATES = {
  tech: {
    OPENING: [
      (p) => `С технической точки зрения, проект «${p.title}» демонстрирует TRL ${p.trl} — ${p.trl >= 6 ? 'это хороший уровень для инвестиций' : 'что является ранней стадией с высоким техническим риском'}. MRL ${p.mrl} указывает на ${p.mrl >= 5 ? 'реальную производственную готовность' : 'необходимость существенных инвестиций в производство'}.`,
      (p) => `Анализ технической документации «${p.company}»: разработка находится на TRL ${p.trl}. ${p.trl >= 7 ? 'Проект прошёл опытную эксплуатацию — это снижает технический риск.' : p.trl >= 5 ? 'Есть прототип, но до серийного производства ещё далеко.' : 'Стадия концепции — высокий риск невыхода из R&D фазы.'}`,
    ],
    CHALLENGE: [
      (p) => `Оспариваю оптимистичную оценку MRL ${p.mrl}: при такой локализации ${(p.localizationRatio * 100).toFixed(0)}% производственная масштабируемость ограничена. Необходим план закупок отечественных компонентов.`,
      (p) => `Важное замечание по TRL ${p.trl}: декларируемый уровень не подтверждён независимой экспертизой. Прошу предоставить протоколы испытаний.`,
    ],
    COUNTER: [
      (p) => `Согласен с рисками MRL, но TRL ${p.trl} для рынка ${p.market} — это норма. Портфельные компании БАС фонда в среднем заходили на TRL ${p.trl - 1}.`,
      (p) => `Независимая экспертиза TRL ${p.trl} подтверждена — в документации приложены протоколы испытаний. Замечание снято.`,
    ],
    SUMMARY: [
      (p) => `Итоговая техническая оценка: TRL ${p.trl}/9, MRL ${p.mrl}/10. ${p.trl >= 6 && p.mrl >= 4 ? 'Технически проект готов к инвестированию при условии роуд-мэпа по MRL.' : 'Рекомендую дополнительный технический due diligence перед инвестированием.'}`,
    ],
  },
  finance: {
    OPENING: [
      (p) => `Финансовая модель «${p.company}»: проектный IRR ${(p.projectedIRR * 100).toFixed(0)}%. ${p.projectedIRR >= 0.35 ? 'Выдающийся показатель, соответствует венчурным ожиданиям 30%+.' : p.projectedIRR >= 0.25 ? 'Приемлемый IRR для фонда.' : 'IRR ниже минимального порога 25% — вызывает вопросы по финмодели.'}`,
      (p) => `Запрашиваемая сумма ${(p.requestedAmount / 1e6).toFixed(0)} млн руб при целевом рынке ${(p.marketSize / 1e9).toFixed(1)} млрд. ${p.marketSize / p.requestedAmount >= 50 ? 'Рыночный потенциал многократно превышает инвестиции.' : 'Соотношение рынок/инвестиции требует обоснования.'}`,
    ],
    CHALLENGE: [
      (p) => `Вызывают сомнения допущения по доле рынка в финмодели. IRR ${(p.projectedIRR * 100).toFixed(0)}% предполагает захват ${((p.requestedAmount * 5) / p.marketSize * 100).toFixed(1)}% рынка к году 5 — это агрессивный прогноз.`,
      (p) => `Финансовая модель не учитывает стоимость привлечения клиентов. Unit economics на масштабе требует проверки.`,
    ],
    COUNTER: [
      (p) => `Рост рынка ${p.market} по прогнозу МЭР составляет 28% в год — при таких темпах захват ${((p.requestedAmount * 3) / p.marketSize * 100).toFixed(1)}% реалистичен.`,
      (p) => `Unit economics подтверждены: у компании уже есть 2 платящих клиента с LTV/CAC > 5.`,
    ],
    SUMMARY: [
      (p) => `Финансовый вывод: IRR ${(p.projectedIRR * 100).toFixed(0)}%, рынок ${(p.marketSize / 1e9).toFixed(1)} млрд. ${p.projectedIRR >= 0.28 && p.marketSize >= 5e9 ? 'Финансово проект привлекателен.' : 'Финансовые показатели ниже целевых — рекомендую условное одобрение с KPI по тракции.'}`,
    ],
  },
  sovereignty: {
    OPENING: [
      (p) => `Суверенность «${p.title}»: ${p.sovereigntyScore}/9 баллов. Локализация ${(p.localizationRatio * 100).toFixed(0)}%. ${p.sovereigntyScore >= 7 ? 'Отличный показатель — проект соответствует критериям ФСТ.' : p.sovereigntyScore >= 5 ? 'Средний уровень суверенности — есть критические импортные компоненты.' : 'Низкая суверенность — проект под вопросом для ФСТ.'}`,
    ],
    CHALLENGE: [
      (p) => `При локализации ${(p.localizationRatio * 100).toFixed(0)}% — ${(100 - p.localizationRatio * 100).toFixed(0)}% компонентов импортные. Прошу указать: какие именно, есть ли отечественные альтернативы?`,
      (p) => `Суверенность ${p.sovereigntyScore}/9 заявлена, но методология оценки не стандартизирована. Прошу предоставить паспорт компонентов.`,
    ],
    COUNTER: [
      (p) => `Паспорт компонентов приложен. Критические элементы (${p.sovereigntyScore >= 7 ? 'все ключевые — отечественные' : 'часть — в процессе замены'}). Дорожная карта импортозамещения представлена.`,
    ],
    SUMMARY: [
      (p) => `Суверенный статус: ${p.sovereigntyScore}/9. ${p.sovereigntyScore >= 7 ? 'Проект полностью соответствует критериям суверенности ФСТ НТИ.' : p.sovereigntyScore >= 5 ? 'Условно соответствует — требуется план импортозамещения.' : 'Не соответствует критериям суверенности — рекомендую отклонить или запросить план локализации.'}`,
    ],
  },
  risk: {
    OPENING: [
      (p) => `Реестр рисков «${p.title}»: выявлено ${p.risks.length + 2} категорий. Ключевой риск: ${p.trl < 6 ? 'технологический (TRL ' + p.trl + ')' : p.localizationRatio < 0.6 ? 'зависимость от импорта' : 'рыночный (конкуренция)'}. Общая оценка рисков: ${p.trl >= 6 && p.sovereigntyScore >= 6 ? 'умеренный' : 'высокий'}.`,
    ],
    CHALLENGE: [
      (p) => `Критический риск: ${p.risks[0]}. Вероятность реализации оцениваю в 35-45%. Необходим план митигации.`,
      (p) => `Регуляторный риск недооценён — сфера БПЛА находится в активной нормативной разработке. Изменение правил эксплуатации может отрезать рынок сбыта.`,
    ],
    COUNTER: [
      (p) => `Регуляторный риск учтён: компания участвует в рабочей группе Росавиации и готова к изменениям нормативной базы.`,
    ],
    SUMMARY: [
      (p) => `Итог по рискам: ${p.trl >= 6 && p.sovereigntyScore >= 5 ? 'риски управляемые при условии план митигации.' : 'риски существенные, требуют детального плана управления рисками как условие инвестирования.'}`,
    ],
  },
  portfolio: {
    OPENING: [
      (p) => `Портфельная перспектива: «${p.title}» в субфонде ${p.subFund.toUpperCase()} создаёт ${p.subFund === 'bas' ? 'усиление позиций в аэронет-кластере' : p.subFund === 'robot' ? 'диверсификацию в робототехнику' : 'критически важное МЭ-звено'}. Синергия с 3 портфельными компаниями.`,
    ],
    CHALLENGE: [
      (p) => `Стратегически: этот проект дублирует функциональность «${p.market === 'АэроНет' ? 'АвиаКом' : 'РобоПром'}» из нашего портфеля. Каноны портфельной теории говорят о необходимости дифференциации.`,
    ],
    COUNTER: [
      (p) => `Дублирования нет — технологические ниши различны. «${p.title}» атакует сегмент B2G, портфельные компании — B2B. Конкуренция внутри портфеля исключена.`,
    ],
    SUMMARY: [
      (p) => `Портфельный вывод: проект ${p.trl >= 5 && p.marketSize >= 5e9 ? 'органично вписывается в портфель и создаёт синергии' : 'требует уточнения позиционирования относительно портфеля'}.`,
    ],
  },
  devil: {
    OPENING: [
      (p) => `Сыграю роль критика. «${p.title}»: компания основана в ${p.founded} году, ${p.employees} сотрудников, ${p.patents} патентов. На стадии ${p.stage} запрашивают ${(p.requestedAmount / 1e6).toFixed(0)} млн — ${p.requestedAmount >= 200e6 ? 'это много для их стадии' : 'сумма разумная, но вопросы остаются'}. Начну с самого слабого места.`,
    ],
    CHALLENGE: [
      (p) => `${p.risks[0]}. Команда из ${p.employees} человек справится с масштабированием после инвестиции? Трек-рекорд основателей требует более детального изучения.`,
      (p) => `Все цифры в заявке — это лучший сценарий. Где стресс-тест? Что если рынок вырастет не на 28%, а на 12%? IRR при пессимистичном сценарии?`,
      (p) => `Конкуренты: ${p.market === 'АэроНет' ? 'DJI, Autel, десятки китайских производителей давят ценой' : 'мировые лидеры имеют преимущество в R&D в 5-10 лет'}. Почему победит именно эта команда?`,
    ],
    COUNTER: [
      (p) => `Принимаю возражения, но: есть подтверждённый спрос (письма намерений). Это не просто питч-дек.`,
    ],
    SUMMARY: [
      (p) => `Резюме скептика: ${p.trl >= 6 && p.sovereigntyScore >= 6 && p.projectedIRR >= 0.28 ? 'несмотря на мои вопросы, метрики проекта выдерживают критику. Условно поддержу при наличии KPI.' : 'слишком много красных флагов. Рекомендую отклонить или существенно переработать.'}`,
    ],
  },
}

// ── Vote Verdicts ─────────────────────────────────────────────

export const VERDICTS = {
  APPROVE: { id: 'APPROVE', label: 'Одобрить',   icon: 'pi pi-check', color: '#4caf50', textColor: '#fff' },
  REJECT:  { id: 'REJECT',  label: 'Отклонить',  icon: 'pi pi-times', color: '#ef5350', textColor: '#fff' },
  DEFER:   { id: 'DEFER',   label: 'Отложить',   icon: 'pi pi-clock', color: '#ffa726', textColor: '#fff' },
}

// ── Human Committee Members ───────────────────────────────────

export const HUMAN_MEMBERS = [
  { id: 'chair', name: 'Председатель комитета',   role: 'Управляющий партнёр ФСТ',    avatar: '👤', weight: 2.0 },
  { id: 'gp1',   name: 'Партнёр по инвестициям',  role: 'Директор по портфелю',       avatar: '👤', weight: 1.0 },
  { id: 'gp2',   name: 'Отраслевой советник',     role: 'Эксперт рынка НТИ',          avatar: '👤', weight: 1.0 },
]

// ── Timing (ms) ────────────────────────────────────────────────

export const TIMING = {
  LOADING_DURATION: 3000,       // ms per agent "reading docs"
  THINKING_DURATION: 1500,      // ms agent "thinking" bubble
  ARGUMENT_DELAY: 800,          // ms between arguments
  PHASE_TRANSITION_DELAY: 1200, // ms pause between phases
  VOTE_DELAY: 600,              // ms per vote reveal
}

export const SPEED_MULTIPLIERS = {
  slow:   1.0,
  normal: 2.5,
  fast:   6.0,
}

// ── Recommendation Templates (per agent, per verdict) ─────────
//
// Each template fn(project, decision) → { id, priority, text, effect, metric, delta, effort, weeks }
// effect: what metric improves and by how much
// effort: LOW / MEDIUM / HIGH

export const RECOMMENDATION_TEMPLATES = {
  tech: {
    DEFER: [
      (p) => ({
        id: 'tech_trl',
        agent: 'tech',
        priority: 'HIGH',
        text: `Провести независимую верификацию TRL ${p.trl} по методологии NASA/ESA и получить официальное подтверждение уровня. Разработать детальный план выхода на TRL ${Math.min(p.trl + 1, 9)} с контрольными точками.`,
        metric: 'trl',
        delta: 1,
        effort: 'MEDIUM',
        weeks: 8,
        owner: 'CTO',
      }),
      (p) => ({
        id: 'tech_mrl',
        agent: 'tech',
        priority: p.mrl < 4 ? 'HIGH' : 'MEDIUM',
        text: `Разработать план производственной готовности MRL: от текущего MRL ${p.mrl} до MRL ${Math.min(p.mrl + 2, 10)}. Включить технологический аудит производственной площадки, BOM-анализ и план закупок.`,
        metric: 'mrl',
        delta: 1,
        effort: 'HIGH',
        weeks: 12,
        owner: 'COO',
      }),
    ],
    REJECT: [
      (p) => ({
        id: 'tech_proto',
        agent: 'tech',
        priority: 'CRITICAL',
        text: `Текущий TRL ${p.trl} недостаточен для инвестирования. Необходимо достичь TRL ${Math.min(p.trl + 2, 7)} с рабочим прототипом в реальных условиях эксплуатации. Вернуться с обновлённой заявкой после завершения опытной эксплуатации.`,
        metric: 'trl',
        delta: 2,
        effort: 'HIGH',
        weeks: 24,
        owner: 'CTO',
      }),
    ],
    APPROVE: [
      (p) => ({
        id: 'tech_roadmap',
        agent: 'tech',
        priority: 'MEDIUM',
        text: `Подготовить детальный технический роуд-мэп на 18 месяцев с квартальными KPI по TRL/MRL. Включить план сертификации и технической документации.`,
        metric: 'mrl',
        delta: 1,
        effort: 'LOW',
        weeks: 4,
        owner: 'CTO',
      }),
    ],
  },

  finance: {
    DEFER: [
      (p) => ({
        id: 'fin_stress',
        agent: 'finance',
        priority: 'HIGH',
        text: `Финансовая модель не прошла стресс-тест. Предоставить три сценария: базовый (IRR ${(p.projectedIRR * 100).toFixed(0)}%), пессимистичный (−40% к прогнозу) и оптимистичный. Подтвердить unit economics на данных реальных продаж.`,
        metric: 'finance',
        delta: 0.08,
        effort: 'MEDIUM',
        weeks: 6,
        owner: 'CFO',
      }),
      (p) => ({
        id: 'fin_cac',
        agent: 'finance',
        priority: 'MEDIUM',
        text: `Представить расчёт CAC, LTV и payback period на основе данных от не менее 3 реальных клиентов. Текущие цифры по захвату рынка кажутся агрессивными — обосновать математически.`,
        metric: 'finance',
        delta: 0.05,
        effort: 'MEDIUM',
        weeks: 8,
        owner: 'CFO',
      }),
    ],
    REJECT: [
      (p) => ({
        id: 'fin_model',
        agent: 'finance',
        priority: 'CRITICAL',
        text: `Финансовая модель полностью переработана. IRR ${(p.projectedIRR * 100).toFixed(0)}% не достигает минимального порога фонда 25% с учётом рисков. Необходимо: снизить запрашиваемую сумму, пересмотреть структуру сделки (CLN вместо equity) или улучшить unit economics.`,
        metric: 'finance',
        delta: 0.1,
        effort: 'HIGH',
        weeks: 16,
        owner: 'CFO',
      }),
    ],
    APPROVE: [
      (p) => ({
        id: 'fin_kpi',
        agent: 'finance',
        priority: 'LOW',
        text: `Зафиксировать KPI по выручке и IRR для ежеквартальных отчётов. Настроить дашборд мониторинга финансовых показателей для инвесторов.`,
        metric: 'finance',
        delta: 0.03,
        effort: 'LOW',
        weeks: 2,
        owner: 'CFO',
      }),
    ],
  },

  sovereignty: {
    DEFER: [
      (p) => ({
        id: 'sov_passport',
        agent: 'sovereignty',
        priority: 'HIGH',
        text: `Составить паспорт компонентов: для каждого иностранного компонента указать критичность, российский аналог (или план его создания), срок перехода. Текущая локализация ${(p.localizationRatio * 100).toFixed(0)}% — цель на следующий раунд: ${Math.min(Math.round(p.localizationRatio * 100) + 15, 90)}%.`,
        metric: 'sovereignty',
        delta: 1,
        effort: 'MEDIUM',
        weeks: 8,
        owner: 'CTO',
      }),
    ],
    REJECT: [
      (p) => ({
        id: 'sov_critical',
        agent: 'sovereignty',
        priority: 'CRITICAL',
        text: `Суверенность ${p.sovereigntyScore}/9 не удовлетворяет критериям ФСТ НТИ (минимум 6/9). Разработать и реализовать план импортозамещения критических компонентов с подтверждёнными договорами с отечественными поставщиками.`,
        metric: 'sovereignty',
        delta: 2,
        effort: 'HIGH',
        weeks: 20,
        owner: 'CEO',
      }),
    ],
    APPROVE: [
      (p) => ({
        id: 'sov_roadmap',
        agent: 'sovereignty',
        priority: 'LOW',
        text: `Зафиксировать текущий уровень локализации ${(p.localizationRatio * 100).toFixed(0)}% как базу. Поставить цель ${Math.min(Math.round(p.localizationRatio * 100) + 10, 95)}% к концу первого года финансирования.`,
        metric: 'sovereignty',
        delta: 0,
        effort: 'LOW',
        weeks: 2,
        owner: 'CTO',
      }),
    ],
  },

  risk: {
    DEFER: [
      (p) => ({
        id: 'risk_registry',
        agent: 'risk',
        priority: 'HIGH',
        text: `Разработать детальный реестр рисков с оценкой вероятности (P) и воздействия (I) для каждого риска. По каждому HIGH-риску — конкретный план митигации с ответственным, сроком и KPI. Особое внимание: регуляторный риск в сфере ${p.market}.`,
        metric: 'risk',
        delta: 0.1,
        effort: 'MEDIUM',
        weeks: 6,
        owner: 'CRO',
      }),
    ],
    REJECT: [
      (p) => ({
        id: 'risk_critical',
        agent: 'risk',
        priority: 'CRITICAL',
        text: `Критические риски не закрыты. До следующего рассмотрения: 1) Регуляторный риск — получить разъяснения Росавиации/профильного ведомства. 2) Рыночный риск — подписать хотя бы 1 LOI с якорным клиентом. 3) Технический риск — провести стресс-тестирование прототипа.`,
        metric: 'risk',
        delta: 0.15,
        effort: 'HIGH',
        weeks: 16,
        owner: 'CEO',
      }),
    ],
    APPROVE: [
      (p) => ({
        id: 'risk_monitor',
        agent: 'risk',
        priority: 'MEDIUM',
        text: `Настроить систему мониторинга рисков: ежемесячные отчёты о статусе риск-факторов в фонд. Триггерные события для внеочередного созыва инвесткомитета.`,
        metric: 'risk',
        delta: 0.05,
        effort: 'LOW',
        weeks: 3,
        owner: 'CRO',
      }),
    ],
  },

  portfolio: {
    DEFER: [
      (p) => ({
        id: 'port_position',
        agent: 'portfolio',
        priority: 'MEDIUM',
        text: `Представить позиционирование относительно портфельных компаний фонда: конкурируете или дополняете? Предложить конкретные точки синергии с 2–3 портфельными компаниями. Разработать план совместных продаж или R&D-кооперации.`,
        metric: 'team',
        delta: 0.05,
        effort: 'LOW',
        weeks: 4,
        owner: 'CEO',
      }),
    ],
    REJECT: [
      (p) => ({
        id: 'port_strategy',
        agent: 'portfolio',
        priority: 'HIGH',
        text: `Стратегическая роль проекта в портфеле ФСТ не очевидна. Необходимо: 1) Провести анализ конкурентного ландшафта. 2) Определить уникальное позиционирование. 3) Показать, как проект усиливает суверенитет портфеля в целом.`,
        metric: 'team',
        delta: 0.08,
        effort: 'MEDIUM',
        weeks: 8,
        owner: 'CEO',
      }),
    ],
    APPROVE: [
      (p) => ({
        id: 'port_sync',
        agent: 'portfolio',
        priority: 'LOW',
        text: `Организовать квартальные встречи с портфельными компаниями для поиска синергий. Целевой показатель: 1 совместный пилот с портфельной компанией в течение 12 месяцев.`,
        metric: 'team',
        delta: 0.03,
        effort: 'LOW',
        weeks: 4,
        owner: 'CEO',
      }),
    ],
  },

  devil: {
    DEFER: [
      (p) => ({
        id: 'dev_assumptions',
        agent: 'devil',
        priority: 'HIGH',
        text: `Все ключевые допущения финансовой модели и технического плана должны быть верифицированы независимыми экспертами. Команда обязана представить "anti-pitch" — самое честное описание того, почему проект может провалиться, с ответами на каждый риск.`,
        metric: 'team',
        delta: 0.07,
        effort: 'MEDIUM',
        weeks: 6,
        owner: 'CEO',
      }),
    ],
    REJECT: [
      (p) => ({
        id: 'dev_team',
        agent: 'devil',
        priority: 'CRITICAL',
        text: `Команда из ${p.employees} человек на стадии ${p.stage} — недостаточно для реализации амбиций. Необходимо: привлечь опытного операционного директора (COO) с трек-рекордом в масштабировании, и коммерческого директора (CCO) с клиентской базой в целевом рынке.`,
        metric: 'team',
        delta: 0.12,
        effort: 'HIGH',
        weeks: 12,
        owner: 'CEO',
      }),
    ],
    APPROVE: [
      (p) => ({
        id: 'dev_governance',
        agent: 'devil',
        priority: 'MEDIUM',
        text: `Обязательно: создать advisory board из 3 отраслевых экспертов до первого транша. Ввести квартальный независимый аудит прогресса по KPI. Это защита от самообмана на стадии роста.`,
        metric: 'team',
        delta: 0.04,
        effort: 'LOW',
        weeks: 6,
        owner: 'CEO',
      }),
    ],
  },
}

// ── FST Fund Policy (from NtiSimulator) ───────────────────────

export const FST_POLICY_DEFAULTS = {
  keyRate:        0.16,  // ключевая ставка ЦБ
  taxRate:        0.20,  // налоговая нагрузка
  coFinanceRate:  0.50,  // доля со-финансирования
  minTRL:         4,     // мин. TRL для инвестиций
  maxGrantShare:  0.20,  // макс. доля бюджета на 1 сделку
  minSovereignty: 6,     // мин. суверенность (1-9)
  minMRL:         3,     // мин. MRL для инвестиций
}

export const FST_POLICY_RANGES = {
  keyRate:        { min: 0.05, max: 0.25, step: 0.01, label: 'Ключевая ставка ЦБ, %' },
  taxRate:        { min: 0.10, max: 0.40, step: 0.01, label: 'Налоговая нагрузка, %' },
  coFinanceRate:  { min: 0.20, max: 0.80, step: 0.05, label: 'Доля со-финансирования, %' },
  minTRL:         { min: 1,    max: 7,    step: 1,    label: 'Мин. TRL для инвестиций' },
  maxGrantShare:  { min: 0.10, max: 0.50, step: 0.05, label: 'Макс. доля бюджета на 1 сделку, %' },
  minSovereignty: { min: 1,    max: 8,    step: 1,    label: 'Мин. суверенность (ось СВ)' },
  minMRL:         { min: 1,    max: 7,    step: 1,    label: 'Мин. MRL для инвестиций' },
}

// ── Revision: metric improvements from recommendations ─────────
//
// When team "applies" recommendations, these effects add up.
// Each rec has { metric, delta } — applied to project copy.

export const REVISION_SIMULATION_STEPS = [
  { delay: 0,    label: 'Команда получила рекомендации',             icon: 'pi pi-envelope' },
  { delay: 0.12, label: 'Технический аудит запущен',                  icon: 'pi pi-search' },
  { delay: 0.25, label: 'Независимая экспертиза TRL/MRL',             icon: 'pi pi-verified' },
  { delay: 0.38, label: 'Финансовая модель пересмотрена',             icon: 'pi pi-chart-line' },
  { delay: 0.50, label: 'Паспорт компонентов составлен',              icon: 'pi pi-file-edit' },
  { delay: 0.63, label: 'Реестр рисков с планами митигации',          icon: 'pi pi-shield' },
  { delay: 0.75, label: 'Переговоры с якорными клиентами завершены',  icon: 'pi pi-handshake' },
  { delay: 0.88, label: 'Обновлённая заявка подготовлена',            icon: 'pi pi-file-check' },
  { delay: 1.0,  label: 'Проект готов к следующему раунду',           icon: 'pi pi-forward' },
]

// How completed recs change project numeric fields
export const METRIC_FIELD_MAP = {
  trl:         'trl',
  mrl:         'mrl',
  sovereignty: 'sovereigntyScore',
  finance:     'projectedIRR',
  risk:        'teamStrength',   // risk improvement → team confidence proxy
  team:        'teamStrength',
}

// Clamp ranges after revision
export const METRIC_CLAMP = {
  trl:             [1, 9],
  mrl:             [1, 10],
  sovereigntyScore:[0, 9],
  projectedIRR:    [0.05, 0.90],
  teamStrength:    [0, 1],
  localizationRatio:[0, 1],
}
