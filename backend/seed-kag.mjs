/**
 * Seed KAG SQLite with fund knowledge base + drone ontology concepts
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Dynamic import for KAGStorageIntegram
const { default: KAGStorageIntegram } = await import('./src/services/kag/KAGStorageIntegram.js')

const DB_PATH = join(__dirname, 'data/kag/kag.sqlite')
const storage = new KAGStorageIntegram({ dbPath: DB_PATH })
await storage.initialize()

const stats = storage.getStats()
console.log(`[Seed] DB initialized at ${DB_PATH}`)
console.log(`[Seed] Existing: ${stats.totalEntities} entities, ${stats.totalRelations} relations`)

// Load fund knowledge
const kb = JSON.parse(readFileSync(join(__dirname, 'data/fund-knowledge.json'), 'utf-8'))

// ── 1. Fund entity ──────────────────────────────────────────────
storage.addEntity({
  id: 'fund_fst_nti',
  name: 'ФСТ НТИ — Фонд Суверенных Технологий',
  type: 'Fund',
  observations: [
    `Тип: ${kb.fund.type}`,
    `Размер: ${kb.fund.size}`,
    `Горизонт: ${kb.fund.horizon}`,
    `Стадии: ${kb.fund.stages}`,
    `Критерии: ${kb.fund.criteria}`,
    `Структура: ${kb.fund.structure}`,
    `Платформа: ${kb.fund.platform}`,
    `${kb.fund.subfunds.length} субфондов: ${kb.fund.subfunds.map(s => s.name).join(', ')}`,
  ],
  properties: {},
  source: 'seed',
})
console.log('[Seed] Fund entity created')

// ── 2. Subfund entities ─────────────────────────────────────────
for (const sf of kb.fund.subfunds) {
  const id = `subfund_${sf.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}`
  storage.addEntity({
    id,
    name: sf.name,
    type: 'Subfund',
    observations: [
      `Полное название: ${sf.fullName}`,
      sf.budget ? `Бюджет: ${sf.budget}` : null,
    ].filter(Boolean),
    properties: {},
    source: 'seed',
  })
  storage.addRelation({
    id: `rel_fund_${id}`,
    type: 'has_subfund',
    from_id: 'fund_fst_nti',
    to_id: id,
    properties: {},
  })
}
console.log(`[Seed] ${kb.fund.subfunds.length} subfunds created`)

// ── 3. Portfolio companies ──────────────────────────────────────
let companyCount = 0
for (const c of kb.portfolio) {
  const id = `company_${c.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_').slice(0, 60)}`
  const obs = [c.description]
  if (c.trl) obs.push(`TRL: ${c.trl}`)
  if (c.founded) obs.push(`Год основания: ${c.founded}`)
  if (c.employees) obs.push(`Сотрудников: ${c.employees}`)
  if (c.sector) obs.push(`Сектор: ${c.sector}`)
  if (c.sovereignty) obs.push(`Суверенность: ${c.sovereignty}/9`)
  if (c.patents) obs.push(`Патенты: ${c.patents}`)
  if (c.status === 'stopped') obs.push('СТАТУС: НА СТОПЕ')
  if (c.subfund) obs.push(`Субфонд: ${c.subfund}`)

  storage.addEntity({
    id,
    name: c.name,
    type: 'PortfolioCompany',
    observations: obs,
    properties: { tags: c.tags || [] },
    source: 'seed',
  })

  // Relation to subfund
  if (c.subfund) {
    const sfId = `subfund_${c.subfund.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}`
    storage.addRelation({
      id: `rel_${id}_${sfId}`,
      type: 'belongs_to_subfund',
      from_id: id,
      to_id: sfId,
      properties: {},
    })
  }
  companyCount++
}
console.log(`[Seed] ${companyCount} portfolio companies created`)

// ── 4. Drone ontology concepts (key categories) ─────────────────
const droneOntology = [
  { name: 'Конвертоплан', type: 'UAV_Type', obs: ['Тип БАС, сочетающий вертикальный взлёт/посадку с самолётным крейсерским полётом', 'Примеры: Р-75 (Эколибри-БТ), ЭРА-21/ЭРА-70 (ЭраАэро)', 'Преимущества: дальность до 300 км, грузоподъёмность до 75 кг'] },
  { name: 'Мультикоптер', type: 'UAV_Type', obs: ['Тип БАС с 4-8 роторами, вертикальный взлёт/посадка', 'Простота конструкции, хорошая маневренность', 'Ограниченная дальность и скорость'] },
  { name: 'Самолётного типа', type: 'UAV_Type', obs: ['БАС с фиксированным крылом', 'Максимальная дальность и автономность', 'Требует полосу или катапульту для взлёта'] },
  { name: 'VTOL', type: 'UAV_Type', obs: ['Vertical Take-Off and Landing — обобщённый тип', 'Включает конвертопланы, тильтроторы, тильтвинги', 'Тренд в урбан-мобильности и доставке'] },
  { name: 'TRL (Technology Readiness Level)', type: 'Metric', obs: ['Уровень готовности технологии, шкала 1-9', 'TRL 1-3: исследования, TRL 4-6: демонстрация, TRL 7-9: производство', 'Минимальный порог ФСТ: TRL >= 4'] },
  { name: 'MRL (Manufacturing Readiness Level)', type: 'Metric', obs: ['Уровень производственной готовности, шкала 1-10', 'Оценивает готовность серийного производства', 'Минимальный порог ФСТ: MRL >= 3'] },
  { name: 'Суверенность', type: 'Metric', obs: ['Показатель технологической независимости 1-9', 'Доля отечественных компонентов и технологий', '6/9 — минимум для ФСТ, 9/9 — полностью отечественное'] },
  { name: 'AeroNet', type: 'NTI_Market', obs: ['Рынок НТИ: беспилотные авиационные системы', 'Дорожная карта НТИ по БПЛА', 'Покрывает: логистику, мониторинг, агро, доставку'] },
  { name: 'TechNet', type: 'NTI_Market', obs: ['Рынок НТИ: передовые производственные технологии', 'Аддитивные технологии, цифровые двойники, Industry 4.0', 'Компании: НПК Антей (Redfab), АЙ 3Д Группа'] },
  { name: 'HealthNet', type: 'NTI_Market', obs: ['Рынок НТИ: медицина и здравоохранение', 'Нейросети для диагностики, биотех, фарма', 'Компании: Брейнфон, Эпифарма, НЬЮВАК'] },
  { name: 'EnergyNet', type: 'NTI_Market', obs: ['Рынок НТИ: энергетика', 'Литий-ионные батареи, солнечная энергия, умные сети', 'Компания: ИНЭСИС (гигафабрика аккумуляторов)'] },
  { name: 'FoodNet', type: 'NTI_Market', obs: ['Рынок НТИ: продовольствие и агротехнологии', 'Биопрепараты, умное земледелие, вертикальные фермы', 'Компания: Органик парк (BIONOVATIC)'] },
  { name: 'SpaceNet', type: 'NTI_Market', obs: ['Рынок НТИ: космические технологии', 'Малые спутники, лазерная связь, ракеты-носители', 'Компании: QSpace (БТЛС), 3Д Исследования (ракеты)'] },
  { name: 'ЗПИФ', type: 'LegalForm', obs: ['Закрытый паевой инвестиционный фонд', 'Основная юридическая форма венчурных фондов в России', 'ФСТ НТИ организован как ЗПИФв (венчурных инвестиций)'] },
  { name: 'SPV', type: 'LegalForm', obs: ['Special Purpose Vehicle — компания специального назначения', 'Создаётся для каждой сделки фонда', 'Изолирует риски, упрощает структуру'] },
  { name: 'Term Sheet', type: 'Document', obs: ['Ключевые условия инвестиционной сделки', 'Определяет: оценку, долю, права, защиты', 'Предшествует юридическому оформлению SHA/SPA'] },
  { name: 'AI-инвесткомитет', type: 'Process', obs: ['Многораундовый AI-дебат по каждой заявке', '6 агентов: Финансист, Технолог, Рыночный аналитик, Юрист, LP-представитель, Модератор', 'Генерирует скоркарт, аргументы за/против, рекомендацию'] },
  { name: 'Инвестиционный конвейер', type: 'Process', obs: ['Стадии: Заявка → Скрининг → Due Diligence → ИК → Term Sheet → Сделка', 'Каждый этап логирован в Integram (ai2o.ru/fst)', 'AI помогает на каждом этапе'] },
  { name: 'Power Law Distribution', type: 'Concept', obs: ['Венчурное распределение доходности: 80% прибыли от 20% сделок', '1-2 компании из 10 дают >10x return', 'Фонд строит портфель с учётом этого закона'] },
  { name: 'NAV (Net Asset Value)', type: 'Metric', obs: ['Чистая стоимость активов фонда', 'NAV = Стоимость портфеля + Кэш - Обязательства', 'Рассчитывается для каждого субфонда'] },
  { name: 'IRR (Internal Rate of Return)', type: 'Metric', obs: ['Внутренняя норма доходности', 'Целевая для ФСТ: 25-30% IRR на горизонте фонда', 'Учитывает временную стоимость денег'] },
  { name: 'MOIC (Multiple on Invested Capital)', type: 'Metric', obs: ['Мультипликатор на вложенный капитал', 'MOIC = Возврат / Инвестиции', 'Целевой MOIC фонда: 3-5x'] },
]

for (const d of droneOntology) {
  const id = `ontology_${d.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}`
  storage.addEntity({
    id,
    name: d.name,
    type: d.type,
    observations: d.obs,
    properties: {},
    source: 'ontology',
  })
}
console.log(`[Seed] ${droneOntology.length} ontology concepts created`)

// Final stats
const finalStats = storage.getStats()
console.log(`\n[Seed] DONE: ${finalStats.totalEntities} entities, ${finalStats.totalRelations} relations`)
console.log('[Seed] Entity types:', JSON.stringify(finalStats.entityTypes))
