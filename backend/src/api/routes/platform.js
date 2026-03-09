/**
 * Platform Manifest API Routes
 *
 * Provides machine-readable metadata about all FST platform pages.
 * Used by AI agents to understand capabilities, actions, and data schemas.
 *
 * Endpoints:
 *  GET /api/platform/manifest           — full platform manifest
 *  GET /api/platform/manifest/:pageId   — single page manifest
 *  GET /api/platform/actions/:pageId    — available actions on a page
 */

import { Router } from 'express'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const router = Router()

// ── Load manifests (shared with frontend via static JSON copy) ──────────────
// We keep manifests as plain JSON so backend doesn't need to parse Vue files.
// The source of truth is src/manifests/pageManifests.js (frontend);
// the backend uses a pre-built snapshot in backend/src/api/data/platform-manifest.json
// OR generates it on-the-fly from the same data structure.

function buildManifest() {
  // Inline manifest data — mirrors src/manifests/pageManifests.js
  // (kept in sync manually or via CI build step)
  const pages = [
    {
      id: 'fst-hub',
      title: 'Хаб модулей фонда',
      description: 'Центральная точка входа в платформу ФСТ НТИ. Показывает все доступные модули фонда.',
      capabilities: [
        { id: 'navigate-module', label: 'Перейти к модулю', params: ['moduleId'] }
      ],
      dataFields: [{ id: 'module-list', label: 'Список модулей', type: 'array' }],
      relatedPages: ['fst-committee', 'fst-dealflow', 'fst-portfolio']
    },
    {
      id: 'fst-committee',
      title: 'AI-инвесткомитет',
      description: 'Запуск голосования 6 AI-агентов по инвестиционной заявке. Агенты анализируют заявку с разных ролей и выносят решение.',
      capabilities: [
        { id: 'run-committee', label: 'Запустить ИК', params: ['companyId'], agentHint: 'Требует выбранную компанию. Ждать 30–60 сек.' },
        { id: 'view-protocol', label: 'Просмотр протокола' },
        { id: 'export-pdf', label: 'Экспорт в PDF' },
        { id: 'select-company', label: 'Выбор компании', params: ['companyId'] }
      ],
      dataFields: [
        { id: 'company-name', label: 'Название компании', type: 'string' },
        { id: 'vote-result', label: 'Результат голосования', type: 'enum', values: ['approved', 'rejected', 'conditional', 'pending'] },
        { id: 'aggregated-score', label: 'Итоговый балл', type: 'number', range: [0, 100] },
        { id: 'agent-votes', label: 'Голоса агентов', type: 'array' },
        { id: 'conditions', label: 'Условия одобрения', type: 'array' }
      ],
      relatedPages: ['fst-dealflow', 'fst-deal', 'fst-protocol']
    },
    {
      id: 'fst-protocol',
      title: 'Протоколы инвесткомитета',
      description: 'Хранилище и просмотр протоколов заседаний инвестиционного комитета.',
      capabilities: [
        { id: 'search-protocol', label: 'Поиск протокола', params: ['query'] },
        { id: 'view-protocol', label: 'Просмотр протокола', params: ['protocolId'] },
        { id: 'export-pdf', label: 'Экспорт в PDF', params: ['protocolId'] }
      ],
      dataFields: [
        { id: 'protocol-list', label: 'Список протоколов', type: 'array' },
        { id: 'decision', label: 'Решение ИК', type: 'enum', values: ['approved', 'rejected', 'conditional'] }
      ],
      relatedPages: ['fst-committee', 'fst-deal']
    },
    {
      id: 'fst-dealflow',
      title: 'Воронка сделок',
      description: 'Канбан-доска сделок по этапам: входящие → скрининг → DD → ИК → закрытие.',
      capabilities: [
        { id: 'add-deal', label: 'Добавить сделку' },
        { id: 'move-stage', label: 'Переместить по этапам', params: ['dealId', 'stage'] },
        { id: 'run-committee', label: 'Отправить на ИК', params: ['dealId'] }
      ],
      dataFields: [
        { id: 'deals', label: 'Список сделок', type: 'array' },
        { id: 'stage', label: 'Этап', type: 'enum', values: ['incoming', 'screening', 'due-diligence', 'committee', 'closing'] }
      ],
      relatedPages: ['fst-committee', 'fst-deal', 'fst-sourcing']
    },
    {
      id: 'fst-deal',
      title: 'Доведение сделки',
      description: 'Управление сделкой: SPV-структура, транши, Term Sheet, финансовая модель.',
      capabilities: [
        { id: 'create-spv', label: 'Создать SPV' },
        { id: 'add-tranche', label: 'Добавить транш', params: ['amount', 'date', 'conditions'] },
        { id: 'generate-termsheet', label: 'Сгенерировать Term Sheet', agentHint: 'AI генерирует Term Sheet' },
        { id: 'open-finmodel', label: 'Открыть финмодель' }
      ],
      dataFields: [
        { id: 'investment-amount', label: 'Сумма инвестиций', type: 'number' },
        { id: 'valuation', label: 'Оценка компании', type: 'number' },
        { id: 'equity-stake', label: 'Доля фонда', type: 'number' },
        { id: 'tranches', label: 'Транши', type: 'array' }
      ],
      relatedPages: ['fst-committee', 'fst-captable', 'fst-portfolio']
    },
    {
      id: 'fst-portfolio',
      title: 'Портфельный монитор',
      description: 'Мониторинг портфеля: светофор здоровья, KPI, AI-отчёты, риск-мониторинг.',
      capabilities: [
        { id: 'generate-report', label: 'AI-отчёт', params: ['companyId'], agentHint: 'AI анализирует метрики' },
        { id: 'filter-companies', label: 'Фильтр компаний', params: ['status', 'sector'] },
        { id: 'view-company', label: 'Просмотр компании', params: ['companyId'] }
      ],
      dataFields: [
        { id: 'health-status', label: 'Статус здоровья', type: 'enum', values: ['green', 'yellow', 'red'] },
        { id: 'nav', label: 'NAV фонда', type: 'number' },
        { id: 'irr', label: 'IRR портфеля', type: 'number' }
      ],
      relatedPages: ['fst-execution', 'fst-fund', 'fst-intelligence']
    },
    {
      id: 'fst-execution',
      title: 'Исполнение сделок',
      description: 'Kanban задач и KPI по портфельным компаниям. Milestones, контроль условий транша.',
      capabilities: [
        { id: 'add-task', label: 'Добавить задачу', params: ['companyId', 'title', 'dueDate'] },
        { id: 'move-task', label: 'Переместить задачу', params: ['taskId', 'column'] },
        { id: 'update-kpi', label: 'Обновить KPI', params: ['companyId', 'kpiId', 'value'] }
      ],
      dataFields: [
        { id: 'tasks', label: 'Задачи', type: 'array' },
        { id: 'kpis', label: 'KPI', type: 'array' }
      ],
      relatedPages: ['fst-portfolio', 'fst-board']
    },
    {
      id: 'fst-twin',
      title: 'Цифровой двойник компании',
      description: 'Симуляция компании через tick-engine. Прогноз финансовых метрик, сценарии.',
      capabilities: [
        { id: 'run-simulation', label: 'Запустить симуляцию', params: ['companyId', 'scenario'] },
        { id: 'change-scenario', label: 'Сменить сценарий', params: ['scenario'] }
      ],
      dataFields: [
        { id: 'scenario', label: 'Сценарий', type: 'enum', values: ['optimistic', 'base', 'pessimistic'] },
        { id: 'projected-metrics', label: 'Прогнозные метрики', type: 'object' }
      ],
      relatedPages: ['fst-fund', 'fst-portfolio', 'fst-deal']
    },
    {
      id: 'fst-fund',
      title: 'Цифровой двойник фонда',
      description: 'Финансовая модель фонда: NAV, IRR, TVPI, DPI. Субфонды, J-curve.',
      capabilities: [
        { id: 'recalculate-nav', label: 'Пересчитать NAV' },
        { id: 'generate-lp-report', label: 'Отчёт для LP' }
      ],
      dataFields: [
        { id: 'nav', label: 'NAV', type: 'number' },
        { id: 'irr', label: 'IRR', type: 'number' },
        { id: 'tvpi', label: 'TVPI', type: 'number' }
      ],
      relatedPages: ['fst-twin', 'fst-lp', 'fst-ilpa']
    },
    {
      id: 'fst-sourcing',
      title: 'AI Deal Sourcing',
      description: 'Мониторинг открытых источников для поиска стартапов: Telegram, HH.ru, ЕГРЮЛ, GitHub.',
      capabilities: [
        { id: 'refresh-feed', label: 'Обновить ленту' },
        { id: 'add-to-funnel', label: 'Добавить в воронку', params: ['companyId'], agentHint: 'Создаёт заявку в /fst-dealflow' }
      ],
      dataFields: [
        { id: 'candidates', label: 'Кандидаты', type: 'array' },
        { id: 'ai-score', label: 'AI-скоринг', type: 'number', range: [0, 100] }
      ],
      relatedPages: ['fst-dealflow', 'fst-apply']
    },
    {
      id: 'fst-apply',
      title: 'Подача заявки',
      description: 'Публичная форма подачи инвестиционной заявки в фонд.',
      capabilities: [
        { id: 'submit-application', label: 'Подать заявку', params: ['companyName', 'sector', 'stage', 'amount'] }
      ],
      dataFields: [
        { id: 'company-name', label: 'Название', type: 'string' },
        { id: 'stage', label: 'Стадия', type: 'enum', values: ['pre-seed', 'seed', 'series-a', 'series-b'] }
      ],
      relatedPages: ['fst-dealflow', 'fst-sourcing']
    },
    {
      id: 'fst-duediligence',
      title: 'AI Due Diligence',
      description: 'Автоматизированный DD: финансовый, юридический, технологический, ESG.',
      capabilities: [
        { id: 'run-dd', label: 'Запустить DD', params: ['companyId', 'ddType'], agentHint: 'AI анализирует все данные компании' },
        { id: 'export-dd-report', label: 'Экспорт отчёта', params: ['companyId'] }
      ],
      dataFields: [
        { id: 'dd-type', label: 'Тип DD', type: 'enum', values: ['financial', 'legal', 'tech', 'esg', 'full'] },
        { id: 'risk-flags', label: 'Флаги рисков', type: 'array' }
      ],
      relatedPages: ['fst-committee', 'fst-dealflow', 'fst-legal']
    },
    {
      id: 'fst-memo',
      title: 'AI Инвест-меморандум',
      description: 'Автогенерация инвестиционного меморандума (IM) по компании с помощью AI.',
      capabilities: [
        { id: 'generate-memo', label: 'Сгенерировать IM', params: ['companyId'], agentHint: 'AI создаёт полный инвест-меморандум' }
      ],
      dataFields: [
        { id: 'memo-content', label: 'Содержание IM', type: 'object' }
      ],
      relatedPages: ['fst-committee', 'fst-duediligence', 'fst-deal']
    },
    {
      id: 'fst-captable',
      title: 'Cap Table',
      description: 'Таблица капитализации: акционеры, доли, опционные пулы, dilution-анализ.',
      capabilities: [
        { id: 'add-shareholder', label: 'Добавить акционера', params: ['name', 'shares', 'type'] },
        { id: 'simulate-round', label: 'Симулировать раунд', params: ['preMoneyVal', 'investAmount'] }
      ],
      dataFields: [
        { id: 'shareholders', label: 'Акционеры', type: 'array' },
        { id: 'total-shares', label: 'Всего акций', type: 'number' }
      ],
      relatedPages: ['fst-deal', 'fst-waterfall', 'fst-syndication']
    },
    {
      id: 'fst-waterfall',
      title: 'Waterfall Калькулятор',
      description: 'Расчёт распределения выручки при выходе: hurdle rate, carried interest.',
      capabilities: [
        { id: 'calculate-waterfall', label: 'Рассчитать waterfall', params: ['exitAmount', 'hurdleRate', 'carry'] }
      ],
      dataFields: [
        { id: 'exit-amount', label: 'Сумма выхода', type: 'number' },
        { id: 'carry', label: 'Carried interest', type: 'number' }
      ],
      relatedPages: ['fst-captable', 'fst-exit']
    },
    {
      id: 'fst-exit',
      title: 'Сценарии выхода',
      description: 'Планирование и симуляция стратегий выхода: M&A, IPO, вторичные продажи.',
      capabilities: [
        { id: 'model-exit', label: 'Смоделировать выход', params: ['companyId', 'strategy', 'valuation'] }
      ],
      dataFields: [
        { id: 'strategy', label: 'Стратегия', type: 'enum', values: ['ma', 'ipo', 'secondary', 'buyback'] }
      ],
      relatedPages: ['fst-portfolio', 'fst-waterfall', 'fst-secondary']
    },
    {
      id: 'fst-secondary',
      title: 'Secondary Market',
      description: 'Вторичный рынок долей LP: листинг, оценка, транзакции.',
      capabilities: [
        { id: 'list-stake', label: 'Выставить долю', params: ['companyId', 'stakePercent', 'askPrice'] }
      ],
      dataFields: [
        { id: 'listings', label: 'Листинги', type: 'array' }
      ],
      relatedPages: ['fst-captable', 'fst-exit']
    },
    {
      id: 'fst-syndication',
      title: 'Со-инвестирование',
      description: 'База со-инвесторов и синдицированные сделки. Граф сети партнёров.',
      capabilities: [
        { id: 'invite-coinvestor', label: 'Пригласить со-инвестора', params: ['investorId', 'dealId', 'stake'] }
      ],
      dataFields: [
        { id: 'co-investors', label: 'Со-инвесторы', type: 'array' }
      ],
      relatedPages: ['fst-deal', 'fst-captable']
    },
    {
      id: 'fst-founders',
      title: 'Founders CRM & Mentors',
      description: 'CRM основателей и база менторов. AI-подбор ментора при рисках.',
      capabilities: [
        { id: 'add-founder', label: 'Добавить основателя' },
        { id: 'match-mentor', label: 'Подобрать ментора', params: ['founderId'], agentHint: 'AI подбирает по компетенциям' }
      ],
      dataFields: [
        { id: 'founders', label: 'Основатели', type: 'array' },
        { id: 'mentors', label: 'Менторы', type: 'array' }
      ],
      relatedPages: ['fst-execution', 'fst-portfolio']
    },
    {
      id: 'fst-board',
      title: 'Совет директоров',
      description: 'Управление советами директоров: заседания, Board Pack, права наблюдателя.',
      capabilities: [
        { id: 'schedule-meeting', label: 'Запланировать заседание', params: ['companyId', 'date'] },
        { id: 'generate-board-pack', label: 'Board Pack', params: ['companyId'], agentHint: 'AI автогенерирует материалы' }
      ],
      dataFields: [
        { id: 'meetings', label: 'Заседания', type: 'array' }
      ],
      relatedPages: ['fst-execution', 'fst-deal']
    },
    {
      id: 'fst-intelligence',
      title: 'Portfolio Intelligence',
      description: 'AI-аналитика: тренды, бенчмарки, предиктивный анализ рисков.',
      capabilities: [
        { id: 'generate-insight', label: 'Сгенерировать инсайт', params: ['topic'] }
      ],
      dataFields: [
        { id: 'insights', label: 'Инсайты', type: 'array' }
      ],
      relatedPages: ['fst-portfolio', 'fst-benchmark', 'fst-esg']
    },
    {
      id: 'fst-esg',
      title: 'ESG-скоринг портфеля',
      description: 'Оценка ESG-показателей: экологические, социальные, управленческие метрики.',
      capabilities: [
        { id: 'run-esg-audit', label: 'ESG-аудит', params: ['companyId'] }
      ],
      dataFields: [
        { id: 'esg-scores', label: 'ESG-оценки', type: 'array' }
      ],
      relatedPages: ['fst-portfolio', 'fst-intelligence']
    },
    {
      id: 'fst-compliance',
      title: 'AML/KYC Комплаенс',
      description: 'Проверка контрагентов: AML/KYC скрининг, санкционные списки.',
      capabilities: [
        { id: 'run-aml-check', label: 'AML-проверка', params: ['entityId', 'entityType'] }
      ],
      dataFields: [
        { id: 'risk-level', label: 'Уровень риска', type: 'enum', values: ['low', 'medium', 'high', 'critical'] }
      ],
      relatedPages: ['fst-legal', 'fst-administration']
    },
    {
      id: 'fst-legal',
      title: 'Юридические документы',
      description: 'Генерация и хранение юр. документов: SHA, SPA, NDA, Term Sheet.',
      capabilities: [
        { id: 'generate-doc', label: 'Сгенерировать документ', params: ['docType', 'companyId'] }
      ],
      dataFields: [
        { id: 'doc-type', label: 'Тип документа', type: 'enum', values: ['sha', 'spa', 'nda', 'termsheet', 'loan', 'convertible'] }
      ],
      relatedPages: ['fst-deal', 'fst-administration', 'fst-compliance']
    },
    {
      id: 'fst-administration',
      title: 'Бэк-офис фонда',
      description: 'Административное управление: документы, платёжный календарь, команда.',
      capabilities: [
        { id: 'generate-doc', label: 'Сгенерировать документ', params: ['docType'] }
      ],
      dataFields: [
        { id: 'documents', label: 'Документы', type: 'array' }
      ],
      relatedPages: ['fst-legal', 'fst-compliance']
    },
    {
      id: 'fst-lp',
      title: 'LP Dashboard',
      description: 'Личный кабинет LP: портфель, доходность, отчёты, J-curve.',
      capabilities: [
        { id: 'download-report', label: 'Скачать отчёт', params: ['period'] }
      ],
      dataFields: [
        { id: 'lp-stake', label: 'Доля LP', type: 'number' },
        { id: 'current-value', label: 'Текущая стоимость', type: 'number' }
      ],
      relatedPages: ['fst-fund', 'fst-transparency']
    },
    {
      id: 'fst-ilpa',
      title: 'ILPA Отчётность',
      description: 'Отчётность по стандартам ILPA: Capital Account Statements, Fee Reports.',
      capabilities: [
        { id: 'generate-ilpa-report', label: 'ILPA-отчёт', params: ['period', 'reportType'] }
      ],
      dataFields: [
        { id: 'report-type', label: 'Тип', type: 'enum', values: ['capital-account', 'fee-expense', 'portfolio-company'] }
      ],
      relatedPages: ['fst-lp', 'fst-fund']
    },
    {
      id: 'fst-benchmark',
      title: 'Бенчмаркинг портфеля',
      description: 'Сравнение с рыночными бенчмарками: мультипликаторы, аналоги.',
      capabilities: [
        { id: 'compare-company', label: 'Сравнить', params: ['companyId', 'benchmarkType'] }
      ],
      dataFields: [
        { id: 'peer-companies', label: 'Аналоги', type: 'array' }
      ],
      relatedPages: ['fst-portfolio', 'fst-intelligence']
    },
    {
      id: 'fst-allocation',
      title: 'Оптимизация аллокации',
      description: 'AI-оптимизация распределения капитала: портфельная теория, risk-return.',
      capabilities: [
        { id: 'optimize-allocation', label: 'Оптимизировать', params: ['constraints'] }
      ],
      dataFields: [
        { id: 'allocation-plan', label: 'План аллокации', type: 'object' }
      ],
      relatedPages: ['fst-fund', 'fst-portfolio']
    },
    {
      id: 'fst-gov',
      title: 'GR-Панель',
      description: 'Government Relations: НПА, взаимодействие с госорганами, субсидии.',
      capabilities: [
        { id: 'track-regulation', label: 'Отслеживать НПА', params: ['topic'] }
      ],
      dataFields: [
        { id: 'regulations', label: 'НПА', type: 'array' }
      ],
      relatedPages: ['fst-grants', 'fst-natproject']
    },
    {
      id: 'fst-grants',
      title: 'Трекер грантов',
      description: 'Мониторинг грантов: Сколково, Фонд Бортника, ФРП, нацпроекты.',
      capabilities: [
        { id: 'apply-grant', label: 'Подать на грант', params: ['grantId', 'companyId'] }
      ],
      dataFields: [
        { id: 'grants', label: 'Гранты', type: 'array' }
      ],
      relatedPages: ['fst-gov', 'fst-natproject']
    },
    {
      id: 'fst-natproject',
      title: 'Нацпроект БАС 2024–2030',
      description: 'Трекер исполнения Нацпроекта БАС: KPI, milestones, бюджет.',
      capabilities: [
        { id: 'update-milestone', label: 'Обновить milestone', params: ['milestoneId', 'progress'] }
      ],
      dataFields: [
        { id: 'milestones', label: 'Milestones', type: 'array' }
      ],
      relatedPages: ['fst-gov', 'fst-grants']
    },
    {
      id: 'fst-sovereignty',
      title: 'Аудит суверенности 9D',
      description: 'Аудит технологической суверенности по 9 измерениям.',
      capabilities: [
        { id: 'run-audit', label: 'Запустить аудит', params: ['companyId'] }
      ],
      dataFields: [
        { id: 'sovereignty-score', label: 'Балл суверенности', type: 'number', range: [0, 100] }
      ],
      relatedPages: ['fst-portfolio', 'fst-intelligence']
    },
    {
      id: 'fst-registry',
      title: 'Реестр производителей БПЛА',
      description: 'Реестр российских производителей БАС: характеристики, сертификаты.',
      capabilities: [
        { id: 'search-manufacturer', label: 'Поиск производителя', params: ['query'] }
      ],
      dataFields: [
        { id: 'manufacturers', label: 'Производители', type: 'array' }
      ],
      relatedPages: ['fst-sourcing', 'fst-intelligence']
    },
    {
      id: 'fst-glossary',
      title: 'Глоссарий',
      description: 'Справочник венчурных терминов, финансовых метрик, авиационных понятий.',
      capabilities: [
        { id: 'search-term', label: 'Поиск термина', params: ['query'] }
      ],
      dataFields: [
        { id: 'terms', label: 'Термины', type: 'array' }
      ],
      relatedPages: ['fst-school', 'fst-dev-guide']
    },
    {
      id: 'fst-school',
      title: 'Школа агентов ИК',
      description: 'Обучение AI-агентов ИК: промпты, сценарии, калибровка ролей.',
      capabilities: [
        { id: 'train-agent', label: 'Тренировать агента', params: ['agentRole', 'caseId'] },
        { id: 'run-scenario', label: 'Запустить сценарий', params: ['scenarioId'] }
      ],
      dataFields: [
        { id: 'agent-roles', label: 'Роли агентов', type: 'array' }
      ],
      relatedPages: ['fst-committee', 'fst-learning']
    },
    {
      id: 'fst-learning',
      title: 'Нейрокогнитивное ядро',
      description: 'База знаний: онтология БПЛА (~1140 концептов), KAG-система.',
      capabilities: [
        { id: 'search-knowledge', label: 'Поиск', params: ['query'] }
      ],
      dataFields: [
        { id: 'concepts', label: 'Концепты онтологии', type: 'array' }
      ],
      relatedPages: ['fst-school', 'fst-intelligence']
    },
    {
      id: 'fst-transparency',
      title: 'Публичная витрина фонда',
      description: 'Публичная страница: портфель, метрики, отчёты для LP и стейкхолдеров.',
      capabilities: [
        { id: 'view-portfolio', label: 'Просмотр портфеля' }
      ],
      dataFields: [
        { id: 'public-portfolio', label: 'Публичный портфель', type: 'array' }
      ],
      relatedPages: ['fst-lp', 'fst-ilpa']
    },
    {
      id: 'fst-network',
      title: 'Сеть контактов',
      description: 'CRM контактов экосистемы: инвесторы, эксперты, госорганы. Граф связей.',
      capabilities: [
        { id: 'add-contact', label: 'Добавить контакт' },
        { id: 'view-graph', label: 'Граф связей' }
      ],
      dataFields: [
        { id: 'contacts', label: 'Контакты', type: 'array' }
      ],
      relatedPages: ['fst-founders', 'fst-syndication']
    },
    {
      id: 'fst-terminal',
      title: 'Claude Code CLI',
      description: 'Веб-терминал с доступом к Claude Code (WebSocket TTY). Прямое управление через AI.',
      capabilities: [
        { id: 'run-command', label: 'Выполнить команду', params: ['command'], agentHint: 'Прямой CLI-доступ к Claude Code' }
      ],
      dataFields: [
        { id: 'session-output', label: 'Вывод сессии', type: 'string' }
      ],
      relatedPages: ['fst-school', 'fst-dev-guide']
    },
    {
      id: 'fst-dev-guide',
      title: 'Путь обучения VentureOS',
      description: 'Интерактивный путь обучения: модули, квизы, практические задания.',
      capabilities: [
        { id: 'start-module', label: 'Начать модуль', params: ['moduleId'] }
      ],
      dataFields: [
        { id: 'modules', label: 'Модули', type: 'array' }
      ],
      relatedPages: ['fst-school', 'fst-glossary']
    }
  ]

  const actions = pages.flatMap(p =>
    p.capabilities.map(c => ({ ...c, pageId: p.id, pageTitle: p.title }))
  )

  const dataSchemas = {}
  for (const page of pages) {
    dataSchemas[page.id] = page.dataFields
  }

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    platform: 'VentureOS / ФСТ НТИ',
    totalPages: pages.length,
    pages,
    actions,
    dataSchemas,
    workflows: [
      {
        id: 'full-deal-flow',
        title: 'Полный цикл инвестиционной сделки',
        description: 'От подачи заявки до закрытия и мониторинга',
        steps: ['fst-apply', 'fst-dealflow', 'fst-duediligence', 'fst-memo', 'fst-committee', 'fst-deal', 'fst-portfolio']
      },
      {
        id: 'sourcing-to-committee',
        title: 'От сорсинга до инвесткомитета',
        description: 'Автоматизированный поиск и скрининг',
        steps: ['fst-sourcing', 'fst-dealflow', 'fst-committee']
      },
      {
        id: 'deal-to-exit',
        title: 'От сделки до выхода',
        description: 'Исполнение → мониторинг → выход',
        steps: ['fst-deal', 'fst-execution', 'fst-portfolio', 'fst-exit', 'fst-waterfall']
      },
      {
        id: 'lp-reporting',
        title: 'LP Отчётность',
        description: 'Полный цикл отчётности для LP',
        steps: ['fst-fund', 'fst-lp', 'fst-ilpa', 'fst-transparency']
      }
    ]
  }
}

// ── Endpoints ───────────────────────────────────────────────────────────────

/**
 * GET /api/platform/manifest
 * Full platform manifest: all pages, actions, data schemas, workflows.
 * MCP tool: get_platform_manifest
 */
router.get('/manifest', (req, res) => {
  try {
    const manifest = buildManifest()
    res.json(manifest)
  } catch (err) {
    res.status(500).json({ error: 'Failed to build platform manifest', detail: err.message })
  }
})

/**
 * GET /api/platform/manifest/:pageId
 * Manifest for a single page.
 * MCP tool: get_page_manifest
 */
router.get('/manifest/:pageId', (req, res) => {
  try {
    const manifest = buildManifest()
    const page = manifest.pages.find(p => p.id === req.params.pageId)
    if (!page) {
      return res.status(404).json({
        error: 'Page not found',
        availablePages: manifest.pages.map(p => p.id)
      })
    }
    res.json(page)
  } catch (err) {
    res.status(500).json({ error: 'Failed to get page manifest', detail: err.message })
  }
})

/**
 * GET /api/platform/actions/:pageId
 * Available actions on a specific page.
 * MCP tool: get_available_actions
 */
router.get('/actions/:pageId', (req, res) => {
  try {
    const manifest = buildManifest()
    const page = manifest.pages.find(p => p.id === req.params.pageId)
    if (!page) {
      return res.status(404).json({ error: 'Page not found' })
    }
    res.json({
      pageId: page.id,
      pageTitle: page.title,
      actions: page.capabilities
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get actions', detail: err.message })
  }
})

/**
 * GET /api/platform/workflows
 * List all platform workflows (multi-step processes).
 */
router.get('/workflows', (req, res) => {
  try {
    const manifest = buildManifest()
    res.json({ workflows: manifest.workflows })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get workflows', detail: err.message })
  }
})

export default router
