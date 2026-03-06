/**
 * ecosystemStore.js — Shared Pinia store linking FinModel, Ecosystem, and Drononomics
 *
 * Provides:
 * - actors[] (12 BAS value-chain actors with metrics)
 * - flows[] (22 inter-actor product/service flows)
 * - leontiefMatrixA (10x10 Leontief technical coefficients)
 * - simSnapshot (last snapshot from DrononomicsEngine)
 * - Computed: leontiefInverse, outputMultipliers, enrichedActors, businessesData, flowsData
 *
 * Setup store (Composition API) with module-level reactive state
 *
 * @module stores/ecosystemStore
 */

import { reactive, computed, toRefs } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'
import { LEONTIEF_SECTORS, LEONTIEF_MATRIX_A } from '@/components/drononomics/DrononomicsConfig.js'
import { computeLeontiefInverse, computeMultipliers } from '@/components/ecosystem/LeontiefCalculator.js'
import { CUSTOMER_SCENARIOS } from '@/config/customerScenarios.js'

const API_BASE = import.meta.env.VITE_API_URL || ''

// ── Default actor data (mirrors ValueChainEditor ACTORS) ──────────────────

const DEFAULT_ACTORS = [
  {
    id: 'components',
    order: 1,
    name: 'Производитель компонентов',
    icon: '🔩',
    template: 'pnl_extended',
    templateLabel: 'PnL Extended',
    sector: 'manuf',
    sectorLabel: 'Производство (C)',
    color: '#4A90D9',
    inputs: ['Сырьё', 'Электроника', 'Полимеры'],
    outputs: ['Двигатели', 'Камеры', 'Платы управления'],
    revenue: 250,
    ebitda: 45,
    margin: 18,
    description: 'Производство ключевых компонентов для сборки БАС: электродвигатели, камеры, платы управления полётом, датчики и антенны.'
  },
  {
    id: 'manufacturer',
    order: 2,
    name: 'Производитель БАС',
    icon: '🏭',
    template: 'pnl_extended',
    templateLabel: 'PnL Extended',
    sector: 'manuf',
    sectorLabel: 'Производство (C)',
    color: '#2E86C1',
    inputs: ['Компоненты', 'Двигатели', 'Платы'],
    outputs: ['Готовые БАС (дроны)', 'ЗИП'],
    revenue: 520,
    ebitda: 78,
    margin: 15,
    description: 'Сборка и выпуск готовых беспилотных авиационных систем: мультироторные, самолётного типа, вертолётного типа.'
  },
  {
    id: 'infrastructure',
    order: 3,
    name: 'Инфраструктура полётов',
    icon: '🛬',
    template: 'bas_infrastructure',
    templateLabel: 'БАС Инфраструктура',
    sector: 'constr',
    sectorLabel: 'Строительство (F)',
    color: '#E67E22',
    inputs: ['Земля', 'Стройматериалы', 'Оборудование'],
    outputs: ['Посадочные площадки', 'РЛС', 'Командные станции', 'Зарядные станции'],
    revenue: 180,
    ebitda: 36,
    margin: 20,
    description: 'Строительство и эксплуатация наземной инфраструктуры обеспечения полётов БАС: посадочные площадки, радиолокационные станции, каналы связи, системы обнаружения, зарядные станции.'
  },
  {
    id: 'datacenter',
    order: 4,
    name: 'ИИ Дата-центры',
    icon: '🖥️',
    template: 'bas_datacenter',
    templateLabel: 'ИИ Дата-центр БАС',
    sector: 'it',
    sectorLabel: 'IT (J)',
    color: '#1ABC9C',
    inputs: ['Сырые данные миссий', 'Электроэнергия', 'GPU-серверы'],
    outputs: ['NDVI-карты', '3D-модели', 'Тепловые карты', 'ИИ-аналитика'],
    revenue: 280,
    ebitda: 84,
    margin: 30,
    description: 'Дата-центры для ИИ-обработки данных с БАС: GPU-кластеры, ML-пайплайны, хранение петабайтов аэросъёмки, SaaS-платформа аналитики, API для интеграций.'
  },
  {
    id: 'operator',
    order: 5,
    name: 'Оператор БАС',
    icon: '🎮',
    template: 'bas_operator',
    templateLabel: 'БАС Оператор',
    sector: 'bas',
    sectorLabel: 'БАС-сектор (BAS)',
    color: '#27AE60',
    inputs: ['Готовые БАС', 'Инфра-сервис (ПП, РЛС)'],
    outputs: ['Лётные часы', 'Сырые данные миссий'],
    revenue: 350,
    ebitda: 70,
    margin: 20,
    description: 'Выполнение полётных миссий: аэросъёмка, мониторинг, доставка. Генерация лётных часов и первичных данных.'
  },
  {
    id: 'data-processing',
    order: 6,
    name: 'Аналитика и отчётность',
    icon: '📊',
    template: 'pnl_extended',
    templateLabel: 'PnL Extended',
    sector: 'it',
    sectorLabel: 'IT (J)',
    color: '#8E44AD',
    inputs: ['ИИ-обработанные данные от дата-центра', 'Спутниковые снимки'],
    outputs: ['Аналитические отчёты', 'Рекомендации', 'Дашборды заказчика'],
    revenue: 420,
    ebitda: 126,
    margin: 30,
    description: 'Аналитическая платформа: формирование отчётов, дашбордов и рекомендаций на основе ИИ-обработанных данных от дата-центров.'
  },
  {
    id: 'engineering',
    order: 7,
    name: 'DevOps-инжиниринг',
    icon: '⚙️',
    template: 'bas_engineering',
    templateLabel: 'DevOps-инжиниринг БАС',
    sector: 'it',
    sectorLabel: 'IT (J)',
    color: '#E91E63',
    inputs: ['Технологии БАС', 'ML-модели', 'Данные аналитики', 'Бизнес-процессы клиента', 'Результаты НИР'],
    outputs: ['Трансформация бизнеса', 'ИИ-агенты', 'Обучение', 'SLA-поддержка', 'Заказы НИР', 'Производственные заказы'],
    revenue: 340,
    ebitda: 88,
    margin: 26,
    description: 'DevOps-хаб экосистемы: трансформация бизнеса заказчика, внедрение дронов и ИИ-агентов, заказ НИР у университетов, постановка задач производству. Без инжиниринга — технологии не летают.'
  },
  {
    id: 'customer',
    order: 8,
    name: 'Заказчик (с/х, нефть, строй)',
    icon: '🌾',
    template: 'pnl_basic',
    templateLabel: 'PnL Basic',
    sector: 'agri',
    sectorLabel: 'Сельское хозяйство (A)',
    color: '#F39C12',
    inputs: ['NDVI-карты', 'Аналитические отчёты'],
    outputs: ['Решения по обработке', 'Экономия ресурсов', 'Повышение урожайности'],
    revenue: 600,
    ebitda: 90,
    margin: 15,
    description: 'Конечные потребители аналитических продуктов: сельхозпредприятия, нефтегазовые компании, строительные организации.'
  },
  {
    id: 'finance',
    order: 9,
    name: 'Страхование и финансы',
    icon: '🏦',
    template: 'pnl_extended',
    templateLabel: 'PnL Extended',
    sector: 'finance',
    sectorLabel: 'Финансы (K)',
    color: '#C0392B',
    inputs: ['Данные рисков', 'Статистика полётов'],
    outputs: ['Полисы ОСАГО БАС', 'Лизинг', 'Страховые продукты'],
    revenue: 150,
    ebitda: 45,
    margin: 30,
    description: 'Финансовые и страховые услуги для экосистемы БАС: лизинг дронов, страхование ответственности, страхование рисков.'
  },
  {
    id: 'government',
    order: 10,
    name: 'Государство (госпрограммы)',
    icon: '🏛️',
    template: 'bas_government',
    templateLabel: 'Бюджетная модель БАС',
    sector: 'gov',
    sectorLabel: 'Госсектор (O)',
    color: '#5C6BC0',
    inputs: ['Налоговые поступления', 'Обратная связь от заказчиков'],
    outputs: ['Субсидии производству', 'Субсидии инфраструктуре', 'Гранты НИР', 'Бюджет НПЦ'],
    revenue: 0,
    ebitda: 0,
    margin: 0,
    description: 'Государственные программы субсидирования экосистемы БАС: целевое финансирование производства, инфраструктуры, операторов, НИР и НПЦ.'
  },
  {
    id: 'university',
    order: 11,
    name: 'Университет (НИР)',
    icon: '🎓',
    template: 'bas_university',
    templateLabel: 'Грантовая модель НИР',
    sector: 'gov',
    sectorLabel: 'Госсектор (O)',
    color: '#7E57C2',
    inputs: ['Гранты государства', 'Заказы НИР от инжиниринга'],
    outputs: ['Результаты НИР', 'Кадры', 'Патенты', 'Публикации'],
    revenue: 0,
    ebitda: 0,
    margin: 0,
    description: 'Университетская НИР для экосистемы БАС: грантовое финансирование, подготовка кадров, разработка технологий, коммерциализация результатов.'
  },
  {
    id: 'npc',
    order: 12,
    name: 'НПЦ (региональный)',
    icon: '🏢',
    template: 'bas_npc',
    templateLabel: 'НПЦ модель',
    sector: 'gov',
    sectorLabel: 'Госсектор (O)',
    color: '#26A69A',
    inputs: ['Федеральный бюджет', 'Региональное софинансирование'],
    outputs: ['Содействие операторам', 'Агентские услуги', 'Консультации'],
    revenue: 45,
    ebitda: 5,
    margin: 11,
    description: 'Региональный научно-производственный центр БАС: содействие развитию сервисов, агентские услуги операторам, координация региональной экосистемы.'
  }
]

const DEFAULT_FLOWS = [
  { id: 'f1', source: 'components', target: 'manufacturer', product: 'Двигатели, камеры, платы', volume: 180 },
  { id: 'f2', source: 'manufacturer', target: 'operator', product: 'Готовые БАС', volume: 450 },
  { id: 'f3', source: 'infrastructure', target: 'operator', product: 'Полётная инфра (ПП, РЛС, связь)', volume: 120 },
  { id: 'f4', source: 'operator', target: 'datacenter', product: 'Сырые данные миссий (фото, видео, LiDAR)', volume: 280 },
  { id: 'f5', source: 'datacenter', target: 'data-processing', product: 'ИИ-обработка: NDVI, 3D, тепло, детекция', volume: 250 },
  { id: 'f6', source: 'data-processing', target: 'engineering', product: 'Аналитика, ML-модели, дашборды', volume: 200 },
  { id: 'f7', source: 'engineering', target: 'customer', product: 'Трансформация бизнеса, ИИ-агенты, обучение', volume: 380 },
  { id: 'f8', source: 'customer', target: 'finance', product: 'Данные рисков, заказы', volume: 80 },
  { id: 'f9', source: 'finance', target: 'manufacturer', product: 'Лизинг, страховые продукты', volume: 60 },
  { id: 'f10', source: 'finance', target: 'operator', product: 'Страхование ответственности', volume: 40 },
  { id: 'f11', source: 'datacenter', target: 'engineering', product: 'GPU-мощности для ИИ-агентов', volume: 160 },
  { id: 'f12', source: 'engineering', target: 'operator', product: 'Автоматизация полётных операций', volume: 90 },
  { id: 'f13', source: 'government', target: 'components', product: 'Субсидии на компонентную базу', volume: 40 },
  { id: 'f14', source: 'government', target: 'manufacturer', product: 'Субсидии на производство БАС', volume: 80 },
  { id: 'f15', source: 'government', target: 'infrastructure', product: 'Субсидии на инфраструктуру', volume: 60 },
  { id: 'f16', source: 'government', target: 'operator', product: 'Субсидии на эксплуатацию', volume: 35 },
  { id: 'f17', source: 'government', target: 'university', product: 'Грантовое финансирование НИР', volume: 55 },
  { id: 'f18', source: 'government', target: 'npc', product: 'Федеральный бюджет НПЦ', volume: 70 },
  { id: 'f19', source: 'engineering', target: 'university', product: 'Заказы НИР', volume: 30 },
  { id: 'f20', source: 'university', target: 'engineering', product: 'Результаты НИР, кадры', volume: 25 },
  { id: 'f21', source: 'npc', target: 'operator', product: 'Содействие, агентские услуги', volume: 20 },
  { id: 'f22', source: 'customer', target: 'government', product: 'Налоги, обратная связь', volume: 50 }
]

// ── Sector index lookup ────────────────────────────────────────────────────

const SECTOR_INDEX = {}
LEONTIEF_SECTORS.forEach((s, i) => { SECTOR_INDEX[s.id] = i })

// ── Module-level reactive state ────────────────────────────────────────────
// Accessible from any Vue app instance (including sub-apps without Pinia)

export const ecosystemState = reactive({
  actors: [],
  flows: [],
  leontiefMatrixA: LEONTIEF_MATRIX_A.map(row => [...row]),
  simSnapshot: null,
  selectedCustomerType: 'agriculture',
  dataSource: 'default', // 'default' | 'simulation' | 'integram'
  _initialized: false,
  _loading: false,
  _lastSaveTs: 0
})

// ── Pinia store (Setup / Composition API) ─────────────────────────────────

export const useEcosystemStore = defineStore('ecosystem', () => {
  // ── State (exposed from module-level reactive) ──────────────────────────
  const state = ecosystemState

  // ── Getters ─────────────────────────────────────────────────────────────

  const leontiefInverse = computed(() => {
    const { inverse } = computeLeontiefInverse(state.leontiefMatrixA)
    return inverse
  })

  const outputMultipliers = computed(() => {
    return computeMultipliers(leontiefInverse.value)
  })

  const enrichedActors = computed(() => {
    const mults = outputMultipliers.value
    return state.actors.map(actor => {
      const sectorIdx = SECTOR_INDEX[actor.sector]
      const multiplier = sectorIdx !== undefined ? +(mults[sectorIdx].toFixed(2)) : 1.0
      return { ...actor, multiplier }
    })
  })

  const totalRevenue = computed(() => {
    return state.actors.reduce((sum, a) => sum + (a.revenue || 0), 0)
  })

  const totalFlowVolume = computed(() => {
    return state.flows.reduce((sum, f) => sum + (f.volume || 0), 0)
  })

  const maxMultiplier = computed(() => {
    const actors = enrichedActors.value
    if (!actors.length) return 1.0
    return Math.max(...actors.map(a => a.multiplier))
  })

  const isActive = computed(() => {
    return state._initialized && state.actors.length > 0
  })

  const businessesData = computed(() => {
    const actors = enrichedActors.value
    if (!actors.length) return null

    const actorMap = {}
    actors.forEach(a => { actorMap[a.id] = a })

    const groupRevenue = (...ids) => ids.reduce((s, id) => s + (actorMap[id]?.revenue || 0), 0)
    const groupMult = (...ids) => {
      const vals = ids.map(id => actorMap[id]?.multiplier || 1).filter(Boolean)
      return vals.length ? +(Math.max(...vals).toFixed(2)) : 1
    }

    return [
      {
        id: 'mfg',
        name: 'Производство БАС',
        shortName: 'Mfg',
        type: 'manufacturing',
        phase: 1,
        color: actorMap.manufacturer?.color || '#2E86C1',
        description: 'Производство компонентов и сборка БАС',
        standaloneNPV: groupRevenue('components', 'manufacturer') * 10000,
        investmentRequired: groupRevenue('components', 'manufacturer') * 4000,
        leontief: groupMult('components', 'manufacturer')
      },
      {
        id: 'svc',
        name: 'Операторские услуги',
        shortName: 'Svc',
        type: 'services',
        phase: 2,
        color: actorMap.operator?.color || '#27AE60',
        description: 'Оператор БАС + полётная инфраструктура',
        standaloneNPV: groupRevenue('operator', 'infrastructure') * 10000,
        investmentRequired: groupRevenue('operator', 'infrastructure') * 4000,
        leontief: groupMult('operator', 'infrastructure')
      },
      {
        id: 'analytics',
        name: 'Данные и ИИ',
        shortName: 'Data+AI',
        type: 'analytics',
        phase: 3,
        color: actorMap.datacenter?.color || '#1ABC9C',
        description: 'ИИ дата-центры + обработка данных и аналитика',
        standaloneNPV: groupRevenue('datacenter', 'data-processing') * 10000,
        investmentRequired: groupRevenue('datacenter', 'data-processing') * 3000,
        leontief: groupMult('datacenter', 'data-processing')
      },
      {
        id: 'engineering',
        name: 'DevOps-инжиниринг',
        shortName: 'DevOps',
        type: 'engineering',
        phase: 4,
        color: actorMap.engineering?.color || '#E91E63',
        description: 'DevOps-трансформация: внедрение дронов и ИИ-агентов',
        standaloneNPV: (actorMap.engineering?.revenue || 0) * 10000,
        investmentRequired: (actorMap.engineering?.revenue || 0) * 2000,
        leontief: actorMap.engineering?.multiplier || 1
      },
      {
        id: 'insurance',
        name: 'Страхование и финансы',
        shortName: 'Insurance',
        type: 'insurance',
        phase: 5,
        color: actorMap.finance?.color || '#C0392B',
        description: 'Финансовые и страховые услуги',
        standaloneNPV: groupRevenue('customer', 'finance') * 10000,
        investmentRequired: groupRevenue('customer', 'finance') * 2500,
        leontief: groupMult('customer', 'finance')
      },
      {
        id: 'public',
        name: 'Госсектор и НИР',
        shortName: 'Public',
        type: 'public',
        phase: 6,
        color: actorMap.government?.color || '#5C6BC0',
        description: 'Государство, университеты и НПЦ — регулирование и развитие',
        standaloneNPV: groupRevenue('government', 'university', 'npc') * 10000,
        investmentRequired: groupRevenue('government', 'university', 'npc') * 2000,
        leontief: groupMult('government', 'university', 'npc')
      }
    ]
  })

  const flowsData = computed(() => {
    if (!state.flows.length) return null

    const actorToGroup = {
      'components': 'mfg',
      'manufacturer': 'mfg',
      'infrastructure': 'svc',
      'operator': 'svc',
      'datacenter': 'analytics',
      'data-processing': 'analytics',
      'engineering': 'engineering',
      'customer': 'insurance',
      'finance': 'insurance',
      'government': 'public',
      'university': 'public',
      'npc': 'public'
    }

    const flowTypeMap = {
      'f1': 'product', 'f2': 'product', 'f3': 'product', 'f4': 'data',
      'f5': 'data', 'f6': 'capability', 'f7': 'capability', 'f8': 'revenue',
      'f9': 'revenue', 'f10': 'revenue', 'f11': 'data', 'f12': 'capability',
      'f13': 'revenue', 'f14': 'revenue', 'f15': 'revenue', 'f16': 'revenue',
      'f17': 'revenue', 'f18': 'revenue', 'f19': 'capability', 'f20': 'capability',
      'f21': 'capability', 'f22': 'revenue'
    }

    const synergyTypeMap = {
      'f1': 'cost', 'f2': 'cost', 'f3': 'cost', 'f4': 'data',
      'f5': 'data', 'f6': 'revenue', 'f7': 'revenue', 'f8': 'revenue',
      'f9': 'financial', 'f10': 'financial', 'f11': 'data', 'f12': 'cost',
      'f13': 'financial', 'f14': 'financial', 'f15': 'financial', 'f16': 'financial',
      'f17': 'financial', 'f18': 'financial', 'f19': 'cost', 'f20': 'cost',
      'f21': 'cost', 'f22': 'financial'
    }

    const aggregated = {}
    state.flows.forEach(f => {
      const srcGroup = actorToGroup[f.source]
      const tgtGroup = actorToGroup[f.target]
      if (!srcGroup || !tgtGroup || srcGroup === tgtGroup) return

      const key = `${srcGroup}-${tgtGroup}`
      if (!aggregated[key]) {
        aggregated[key] = {
          id: `flow-${key}`,
          source: srcGroup,
          target: tgtGroup,
          value: 0,
          flowType: flowTypeMap[f.id] || 'product',
          synergyType: synergyTypeMap[f.id] || 'cost'
        }
      }
      aggregated[key].value += (f.volume || 0) * 1000
    })

    return Object.values(aggregated)
  })

  // ── Actions ─────────────────────────────────────────────────────────────

  function initDefaults() {
    if (state._initialized) return
    state.actors = DEFAULT_ACTORS.map(a => ({ ...a }))
    state.flows = DEFAULT_FLOWS.map(f => ({ ...f }))
    state.leontiefMatrixA = LEONTIEF_MATRIX_A.map(row => [...row])
    state.dataSource = 'default'
    state._initialized = true
  }

  function updateActorMetrics(actorId, metrics) {
    const actor = state.actors.find(a => a.id === actorId)
    if (!actor) return
    if (metrics.revenue !== undefined) actor.revenue = metrics.revenue
    if (metrics.ebitda !== undefined) actor.ebitda = metrics.ebitda
    if (metrics.margin !== undefined) actor.margin = metrics.margin
    persistActorMetrics(actorId, metrics)
  }

  function updateFlowVolume(flowId, volume) {
    const flow = state.flows.find(f => f.id === flowId)
    if (flow) flow.volume = volume
    persistFlowVolume(flowId, volume)
  }

  function applySimulationSnapshot(engineState) {
    state.simSnapshot = {
      tick: engineState.tick,
      year: engineState.year,
      month: engineState.monthName,
      cash: engineState.cash,
      totalRevenue: engineState.totalRevenue,
      totalCosts: engineState.totalCosts,
      totalProfit: engineState.totalProfit,
      totalDrones: engineState.totalDrones,
      activeMissionCount: engineState.activeMissionCount,
      market: engineState.market || null,
      leontief: engineState.leontief || null,
      pnlByMission: engineState.pnlByMission || null
    }

    if (engineState.market) {
      const m = engineState.market
      const opActor = state.actors.find(a => a.id === 'operator')
      if (opActor && engineState.totalRevenue > 0) {
        opActor.revenue = Math.round(engineState.totalRevenue / 1e6) || opActor.revenue
      }
      const mfgActor = state.actors.find(a => a.id === 'manufacturer')
      if (mfgActor && m.supplyCapacity > 0) {
        mfgActor.revenue = Math.round(m.supplyCapacity * (m.marketPrice || 1) / 1e6) || mfgActor.revenue
      }
    }

    if (engineState.leontief?.matrixA) {
      state.leontiefMatrixA = engineState.leontief.matrixA.map(row => [...row])
    }

    state.dataSource = 'simulation'
    persistSimulationSnapshot()
  }

  async function initFromEventEngine() {
    if (state._initialized) return
    state._loading = true
    try {
      const { data } = await axios.get(`${API_BASE}/api/ecosystem-events/state`)
      if (data.success && data.data) {
        const { actors: remoteActors, flows: remoteFlows, snapshot } = data.data

        if (remoteActors && remoteActors.length > 0) {
          const defaultMap = {}
          DEFAULT_ACTORS.forEach(a => { defaultMap[a.id] = a })
          state.actors = remoteActors.map(ra => ({
            ...defaultMap[ra.id] || {},
            ...ra,
            icon: defaultMap[ra.id]?.icon || '',
            template: defaultMap[ra.id]?.template || 'pnl_extended',
            templateLabel: defaultMap[ra.id]?.templateLabel || '',
            sectorLabel: defaultMap[ra.id]?.sectorLabel || '',
            inputs: defaultMap[ra.id]?.inputs || [],
            outputs: defaultMap[ra.id]?.outputs || [],
            description: defaultMap[ra.id]?.description || '',
          }))
        } else {
          state.actors = DEFAULT_ACTORS.map(a => ({ ...a }))
        }

        if (remoteFlows && remoteFlows.length > 0) {
          state.flows = remoteFlows
        } else {
          state.flows = DEFAULT_FLOWS.map(f => ({ ...f }))
        }

        if (snapshot) {
          state.simSnapshot = snapshot
        }

        state.leontiefMatrixA = LEONTIEF_MATRIX_A.map(row => [...row])
        state.dataSource = remoteActors?.length > 0 ? 'integram' : 'default'
        state._initialized = true
      } else {
        initDefaults()
      }
    } catch (err) {
      console.warn('[ecosystemStore] Event Engine unavailable, using defaults:', err.message)
      initDefaults()
    } finally {
      state._loading = false
    }
  }

  async function persistActorMetrics(actorId, metrics) {
    try {
      await axios.post(`${API_BASE}/api/ecosystem-events/actors/${actorId}`, metrics)
    } catch (err) {
      console.warn('[ecosystemStore] persistActorMetrics failed:', err.message)
    }
  }

  async function persistFlowVolume(flowId, volume) {
    try {
      await axios.post(`${API_BASE}/api/ecosystem-events/flows/${flowId}`, { volume })
    } catch (err) {
      console.warn('[ecosystemStore] persistFlowVolume failed:', err.message)
    }
  }

  async function persistSimulationSnapshot() {
    const now = Date.now()
    if (now - state._lastSaveTs < 30000) return
    state._lastSaveTs = now
    try {
      await axios.post(`${API_BASE}/api/ecosystem-events/snapshot`, state.simSnapshot)
    } catch (err) {
      console.warn('[ecosystemStore] persistSimulationSnapshot failed:', err.message)
    }
  }

  async function seedEventEngine() {
    try {
      const { data } = await axios.post(`${API_BASE}/api/ecosystem-events/seed`)
      return data
    } catch (err) {
      console.warn('[ecosystemStore] seedEventEngine failed:', err.message)
      return null
    }
  }

  function setCustomerType(typeId) {
    const scenario = CUSTOMER_SCENARIOS[typeId]
    if (!scenario) return

    state.selectedCustomerType = typeId

    // Update customer actor
    const customer = state.actors.find(a => a.id === 'customer')
    if (customer) {
      customer.name = `Заказчик — ${scenario.label}`
      customer.icon = scenario.icon
      customer.color = scenario.color
      customer.sector = scenario.sectorId
      customer.sectorLabel = scenario.sectorLabel
      customer.revenue = scenario.costSavings + scenario.revenueUplift
      customer.ebitda = Math.round(customer.revenue * 0.15)
      customer.margin = 15
    }

    // Insurance cascade
    const finance = state.actors.find(a => a.id === 'finance')
    if (finance && scenario.insuranceEffect) {
      finance.revenue = 150 + scenario.insuranceEffect.additionalRevenue
      finance.ebitda = Math.round(finance.revenue * 0.30)
    }

    // Update flows
    if (scenario.flowOverrides) {
      for (const [fid, overrides] of Object.entries(scenario.flowOverrides)) {
        const flow = state.flows.find(f => f.id === fid)
        if (flow) Object.assign(flow, overrides)
      }
    }
  }

  function reset() {
    state.actors = DEFAULT_ACTORS.map(a => ({ ...a }))
    state.flows = DEFAULT_FLOWS.map(f => ({ ...f }))
    state.leontiefMatrixA = LEONTIEF_MATRIX_A.map(row => [...row])
    state.simSnapshot = null
    state.dataSource = 'default'
    state._initialized = true
  }

  // ── Return all state, getters, and actions ──────────────────────────────

  const stateRefs = toRefs(state)

  return {
    // State (toRefs from module-level reactive — Pinia unwraps automatically)
    ...stateRefs,

    // Getters (computed)
    leontiefInverse,
    outputMultipliers,
    enrichedActors,
    totalRevenue,
    totalFlowVolume,
    maxMultiplier,
    isActive,
    businessesData,
    flowsData,

    // Actions
    initDefaults,
    updateActorMetrics,
    updateFlowVolume,
    applySimulationSnapshot,
    initFromEventEngine,
    persistActorMetrics,
    persistFlowVolume,
    persistSimulationSnapshot,
    seedEventEngine,
    setCustomerType,
    reset,
  }
})
