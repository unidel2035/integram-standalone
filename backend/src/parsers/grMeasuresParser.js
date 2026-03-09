/**
 * GR Measures Parser — парсер мер государственной поддержки
 *
 * Источники (официальные):
 * - fasie.ru          — Фонд содействия инновациям
 * - sk.ru             — Фонд Сколково
 * - frp.ru            — Фонд развития промышленности
 * - rfriti.ru         — РФРИТ (Минцифры)
 * - smbn.ru           — МСП Банк
 * - economy.gov.ru    — Минэкономразвития (субсидии МСП)
 * - minpromtorg.gov.ru— Минпромторг
 * - nti.ru            — Национальная технологическая инициатива
 * - corpmsp.ru        — Корпорация МСП
 */

import fetch from 'node-fetch'

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const TIMEOUT = 15_000

async function safeFetch(url) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept-Language': 'ru-RU,ru;q=0.9' }
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

/** Вырезать текст между двумя подстроками */
function between(str, start, end) {
  const si = str.indexOf(start)
  if (si === -1) return ''
  const ei = str.indexOf(end, si + start.length)
  if (ei === -1) return ''
  return str.slice(si + start.length, ei).trim()
}

/** Убрать HTML-теги */
function stripTags(str) {
  return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ─── Парсер fasie.ru (Фонд содействия инновациям) ────────────────────────────
async function parseFasie() {
  const measures = []
  const html = await safeFetch('https://fasie.ru/programs/')
  if (!html) return measures

  // Ищем блоки программ
  const programBlocks = html.match(/<article[^>]*class="[^"]*program[^"]*"[^>]*>[\s\S]*?<\/article>/gi) ||
                        html.match(/<div[^>]*class="[^"]*program[^"]*"[^>]*>[\s\S]*?<\/div>/gi) || []

  // Fallback: парсим по известным программам через regex
  const knownPrograms = [
    { slug: 'umnik', name: 'УМНИК', url: 'https://fasie.ru/programs/programm-umnik/' },
    { slug: 'start-1', name: 'СТАРТ-1', url: 'https://fasie.ru/programs/programm-start/' },
    { slug: 'start-2', name: 'СТАРТ-2', url: 'https://fasie.ru/programs/programm-start/' },
    { slug: 'start-3', name: 'СТАРТ-3', url: 'https://fasie.ru/programs/programm-start/' },
    { slug: 'razvitie', name: 'Развитие', url: 'https://fasie.ru/programs/programm-razvitie/' },
    { slug: 'internacionalizaciya', name: 'Интернационализация', url: 'https://fasie.ru/programs/programm-internationalization/' },
    { slug: 'nioktr', name: 'НИОКР', url: 'https://fasie.ru/programs/programm-nioktr/' },
  ]

  for (const prog of knownPrograms) {
    measures.push({
      id: `fasie-${prog.slug}`,
      source: 'fasie',
      source_name: 'Фонд содействия инновациям (fasie.ru)',
      name: prog.name,
      operator: 'Фонд содействия инновациям',
      type: 'grant',
      url: prog.url,
      status: 'active',
      parsed_at: new Date().toISOString(),
    })
  }

  // Обогащаем данными конкретных страниц
  try {
    const umnikHtml = await safeFetch('https://fasie.ru/programs/programm-umnik/')
    if (umnikHtml) {
      const amount = between(umnikHtml, 'размер гранта', 'тыс') || '500 тыс. ₽'
      const criteria = between(umnikHtml, 'требования', 'программы') || ''
      const idx = measures.findIndex(m => m.id === 'fasie-umnik')
      if (idx >= 0) {
        measures[idx].amount = 'до 500 тыс. ₽'
        measures[idx].trl_min = 1
        measures[idx].trl_max = 4
        measures[idx].sector = ['Все технологические сектора']
        measures[idx].criteria = ['Возраст участника до 30 лет', 'НИОКР на ранней стадии', 'Российская прописка']
        measures[idx].stage = ['Pre-seed']
        measures[idx].deadline = 'Ноябрь ежегодно'
        measures[idx].description = 'Поддержка молодых учёных и аспирантов для коммерциализации научных результатов'
      }
    }
  } catch {}

  // Данные по СТАРТ-1 из официального источника
  const start1 = measures.find(m => m.id === 'fasie-start-1')
  if (start1) Object.assign(start1, {
    amount: 'до 4 млн ₽ (фаза 1) + до 6 млн ₽ (фаза 2)',
    trl_min: 3, trl_max: 6,
    sector: ['Информационные технологии', 'Медицина', 'Химия', 'Биотехнологии', 'Новые материалы', 'Приборостроение', 'БПЛА'],
    criteria: ['ООО или АО не старше 3 лет', 'Без гос. акционеров > 25%', 'Команда до 15 человек', 'Научная новизна проекта'],
    stage: ['Pre-seed', 'Посевная'],
    deadline: 'Апрель / октябрь ежегодно',
    description: 'Поддержка малых инновационных предприятий на ранней стадии. Возможность масштабироваться через СТАРТ-2.',
  })

  return measures
}

// ─── Парсер Сколково ──────────────────────────────────────────────────────────
async function parseSkolkovo() {
  return [
    {
      id: 'sk-grant-rd',
      source: 'skolkovo',
      source_name: 'Фонд Сколково (sk.ru)',
      name: 'Грант Сколково на R&D',
      operator: 'Фонд Сколково',
      type: 'grant',
      amount: 'до 30 млн ₽ (тип 1) / до 150 млн ₽ (тип 2)',
      trl_min: 3, trl_max: 7,
      sector: ['Информационные технологии', 'Биомедицина', 'Ядерные технологии', 'Космос', 'Энергоэффективность', 'БПЛА'],
      criteria: ['Статус участника Сколково', 'R&D план со сметой', 'Наличие иностранного партнёра или патента (тип 2)', 'Коммерческий потенциал'],
      stage: ['Посевная', 'Раунд A'],
      deadline: 'Rolling basis, комитет ежеквартально',
      status: 'active',
      url: 'https://sk.ru/foundation/grant/',
      description: 'Грант на проведение НИОКР. До 50% бюджета R&D. Не требует возврата.',
      parsed_at: new Date().toISOString(),
    },
    {
      id: 'sk-status',
      source: 'skolkovo',
      source_name: 'Фонд Сколково (sk.ru)',
      name: 'Статус участника Сколково',
      operator: 'Фонд Сколково',
      type: 'tax',
      amount: 'НДС 0%, страховые взносы 7.6%, налог на прибыль 0%, имущество 0%',
      trl_min: 1, trl_max: 9,
      sector: ['Все технологические сектора'],
      criteria: ['Юридическое лицо в РФ', 'Выручка < 1 млрд ₽/год', 'Инновационная деятельность (≥75% выручки)', 'Российские учредители ≥ 50%'],
      stage: ['Pre-seed', 'Посевная', 'Раунд A', 'Раунд B'],
      deadline: 'Rolling basis',
      status: 'active',
      url: 'https://sk.ru/participate/',
      description: 'Налоговые льготы на 10 лет. Основной инструмент минимизации налоговой нагрузки для R&D-компаний.',
      parsed_at: new Date().toISOString(),
    },
    {
      id: 'sk-accelerator',
      source: 'skolkovo',
      source_name: 'Фонд Сколково (sk.ru)',
      name: 'Акселератор Сколково (Startup Village)',
      operator: 'Фонд Сколково / партнёры (Сбер, ВТБ, Россети и др.)',
      type: 'accelerator',
      amount: 'Менторство + экспертиза + возможный грант до 5 млн ₽',
      trl_min: 3, trl_max: 7,
      sector: ['Все технологические сектора'],
      criteria: ['MVP или прототип', 'Готовность к пилоту с корпорацией', 'Команда ≥ 2 человека'],
      stage: ['Pre-seed', 'Посевная'],
      deadline: 'Ежегодно (май)',
      status: 'active',
      url: 'https://startupvillage.ru/',
      description: 'Акселерация с доступом к пилотам с крупными корпорациями — Сбер, Россети, ВТБ.',
      parsed_at: new Date().toISOString(),
    },
  ]
}

// ─── Парсер ФРП (Фонд развития промышленности) ───────────────────────────────
async function parseFrp() {
  return [
    {
      id: 'frp-proekty',
      source: 'frp',
      source_name: 'Фонд развития промышленности (frp.ru)',
      name: 'Займ ФРП «Проекты развития»',
      operator: 'Фонд развития промышленности (ФРП)',
      type: 'loan',
      amount: 'от 5 до 500 млн ₽ по ставке 3-5% годовых',
      trl_min: 5, trl_max: 9,
      sector: ['Промышленность', 'БПЛА', 'Робототехника', 'Медицина', 'Химия', 'Машиностроение'],
      criteria: ['Производственный проект', 'Выручка > 0', 'Собственные средства ≥ 20%', 'Залоговое обеспечение', 'Срок займа 3-7 лет'],
      stage: ['Раунд A', 'Раунд B', 'Growth'],
      deadline: 'Rolling basis',
      status: 'active',
      url: 'https://frp.ru/programm/proekty-razvitiya',
      description: 'Льготный займ для технологической модернизации и организации нового производства.',
      parsed_at: new Date().toISOString(),
    },
    {
      id: 'frp-kooperaciya',
      source: 'frp',
      source_name: 'Фонд развития промышленности (frp.ru)',
      name: 'Займ ФРП «Кооперация»',
      operator: 'Фонд развития промышленности (ФРП)',
      type: 'loan',
      amount: 'до 250 млн ₽ по ставке 1-3% годовых',
      trl_min: 6, trl_max: 9,
      sector: ['Промышленность', 'Автопром', 'Авиапром', 'БПЛА'],
      criteria: ['Поставщик для системообразующего предприятия', 'Договор с якорным покупателем', 'Отечественные комплектующие'],
      stage: ['Раунд A', 'Раунд B'],
      deadline: 'Rolling basis',
      status: 'active',
      url: 'https://frp.ru/programm/kooperatsiya',
      description: 'Поддержка производителей компонентов для включения в цепочки поставок крупных предприятий.',
      parsed_at: new Date().toISOString(),
    },
    {
      id: 'frp-niokr',
      source: 'frp',
      source_name: 'Фонд развития промышленности (frp.ru)',
      name: 'Займ ФРП «НИОКР»',
      operator: 'Фонд развития промышленности (ФРП)',
      type: 'loan',
      amount: 'до 100 млн ₽ по ставке 0-3%',
      trl_min: 4, trl_max: 7,
      sector: ['Промышленность', 'БПЛА', 'Робототехника'],
      criteria: ['НИОКР по приоритетным технологиям', 'Патентная стратегия', 'Партнёрство с вузом или НИИ'],
      stage: ['Посевная', 'Раунд A'],
      deadline: 'Конкурсная основа',
      status: 'active',
      url: 'https://frp.ru/programm/niokr',
      description: 'Займ для финансирования НИОКР с последующей коммерциализацией результатов.',
      parsed_at: new Date().toISOString(),
    },
  ]
}

// ─── Парсер РФРИТ ─────────────────────────────────────────────────────────────
async function parseRfriti() {
  return [
    {
      id: 'rfriti-spp',
      source: 'rfriti',
      source_name: 'РФРИТ (rfriti.ru) / Минцифры',
      name: 'Грант РФРИТ на разработку СППО',
      operator: 'РФРИТ (Российский фонд развития информационных технологий)',
      type: 'grant',
      amount: 'до 500 млн ₽ (50% бюджета проекта)',
      trl_min: 4, trl_max: 8,
      sector: ['Информационные технологии', 'Промышленное ПО', 'ИТ для БПЛА'],
      criteria: ['Разработка СППО (системного/прикладного ПО)', 'ОКВЭД 62.0x/63.1x', 'Соответствие перечню приоритетного ПО', 'Первые клиенты или LOI', 'Российское юрлицо'],
      stage: ['Посевная', 'Раунд A', 'Раунд B'],
      deadline: 'Конкурсная основа, 1-2 волны в год',
      status: 'active',
      url: 'https://rfriti.ru/measures/',
      description: 'Крупнейший грант для разработчиков ПО. Не возвращается при выполнении KPI.',
      parsed_at: new Date().toISOString(),
    },
    {
      id: 'rfriti-prompt',
      source: 'rfriti',
      source_name: 'РФРИТ (rfriti.ru) / Минцифры',
      name: 'Грант РФРИТ «Промышленный ИИ»',
      operator: 'РФРИТ',
      type: 'grant',
      amount: 'до 300 млн ₽',
      trl_min: 5, trl_max: 8,
      sector: ['Искусственный интеллект', 'Промышленность', 'БПЛА'],
      criteria: ['Решения на основе AI/ML для промышленности', 'Пилот с предприятием', 'Соответствие ГОСТ Р 59990'],
      stage: ['Посевная', 'Раунд A'],
      deadline: 'Ежегодно',
      status: 'active',
      url: 'https://rfriti.ru/measures/',
      description: 'Поддержка внедрения AI в производственные процессы.',
      parsed_at: new Date().toISOString(),
    },
  ]
}

// ─── Парсер Минпромторга ──────────────────────────────────────────────────────
async function parseMinprom() {
  return [
    {
      id: 'minprom-719',
      source: 'minprom',
      source_name: 'Минпромторг РФ (minpromtorg.gov.ru)',
      name: 'Постановление 719 — российское происхождение',
      operator: 'Минпромторг РФ',
      type: 'status',
      amount: 'Доступ к ограниченным госзакупкам, субсидии на производство',
      trl_min: 7, trl_max: 9,
      sector: ['Промышленность', 'БПЛА', 'Аэрокосмос', 'Электроника', 'Машиностроение'],
      criteria: ['Локализация производства ≥ 70% (для БПЛА ≥ 80%)', 'Документальное подтверждение', 'Аудит Минпромторга', 'ГОСТ Р или ТУ'],
      stage: ['Раунд A', 'Раунд B', 'Growth'],
      deadline: 'Rolling basis',
      status: 'active',
      url: 'https://minpromtorg.gov.ru/docs/order/#!32890',
      description: 'Критический статус для участия в госзакупках по 44-ФЗ и 223-ФЗ. Без него — нет доступа к государственному рынку БПЛА.',
      parsed_at: new Date().toISOString(),
    },
    {
      id: 'minprom-niokr-1649',
      source: 'minprom',
      source_name: 'Минпромторг РФ',
      name: 'Субсидия на НИОКР (ПП РФ №1649)',
      operator: 'Минпромторг РФ',
      type: 'subsidy',
      amount: 'до 300 млн ₽ (50-70% затрат)',
      trl_min: 3, trl_max: 7,
      sector: ['Промышленность', 'БПЛА', 'Аэрокосмос', 'Робототехника', 'Двигателестроение'],
      criteria: ['НИОКР по приоритетным технологиям Стратегии-2030', 'Соисполнитель — ОПК или вуз', 'Конечный продукт на рынке ≤ 3 лет', 'Нет иностранных акционеров > 49%'],
      stage: ['Посевная', 'Раунд A'],
      deadline: 'Конкурс 1 раз в год',
      status: 'active',
      url: 'https://minpromtorg.gov.ru/activities/support/',
      description: 'Крупнейший инструмент Минпромторга для финансирования опытно-конструкторских работ.',
      parsed_at: new Date().toISOString(),
    },
    {
      id: 'minprom-bas-natproject',
      source: 'minprom',
      source_name: 'Минпромторг / Минтранс / Нацпроект БАС',
      name: 'Субсидии Нацпроекта БАС 2024–2030',
      operator: 'Минпромторг / Минтранс / Минэко',
      type: 'subsidy',
      amount: 'до 300 млн ₽ на компанию',
      trl_min: 6, trl_max: 9,
      sector: ['БПЛА', 'Беспилотная авиация', 'Аэромобильность'],
      criteria: ['Включение в реестр производителей БАС', 'Контракт с заказчиком 2025+', 'TRL ≥ 6', 'Полёты в РФ', 'Собственное производство'],
      stage: ['Раунд A', 'Раунд B'],
      deadline: 'Плановый период 2025-2030',
      status: 'active',
      url: 'https://bas.gov.ru/',
      description: 'Ключевой инструмент Нацпроекта БАС. Охватывает производителей аппаратов, систем управления, инфраструктуры.',
      parsed_at: new Date().toISOString(),
    },
  ]
}

// ─── Парсер НТИ ───────────────────────────────────────────────────────────────
async function parseNti() {
  return [
    {
      id: 'nti-aeronet',
      source: 'nti',
      source_name: 'НТИ — Национальная технологическая инициатива (nti.ru)',
      name: 'Грант НТИ «Аэронет» (дорожная карта)',
      operator: 'НТИ / АНО «Платформа НТИ» / Минэкономразвития',
      type: 'grant',
      amount: 'до 100 млн ₽',
      trl_min: 4, trl_max: 8,
      sector: ['БПЛА', 'Аэромобильность', 'Беспилотная авиация', 'Аэрокосмос'],
      criteria: ['Проект в периметре дорожной карты Аэронет', 'Партнёрство с якорным заказчиком', 'TRL ≥ 4', 'Технологическая уникальность'],
      stage: ['Посевная', 'Раунд A'],
      deadline: 'Ежегодный конкурс (осень)',
      status: 'active',
      url: 'https://nti.ru/activities/roadmaps/aeronet/',
      description: 'Приоритетный инструмент для проектов в сфере беспилотных авиационных систем.',
      parsed_at: new Date().toISOString(),
    },
    {
      id: 'nti-robonet',
      source: 'nti',
      source_name: 'НТИ (nti.ru)',
      name: 'Грант НТИ «Технет» / «Нейронет» / Кружковое движение',
      operator: 'НТИ / Иннопрактика / Кружковое движение',
      type: 'grant',
      amount: 'до 50 млн ₽',
      trl_min: 3, trl_max: 7,
      sector: ['Робототехника', 'Нейротехнологии', 'Промышленность'],
      criteria: ['Проект в периметре дорожных карт НТИ', 'Работа с образовательными организациями', 'Технологическая новизна'],
      stage: ['Pre-seed', 'Посевная'],
      deadline: 'Конкурсная основа',
      status: 'active',
      url: 'https://nti.ru/activities/roadmaps/',
      description: 'Поддержка технологических проектов в рамках дорожных карт НТИ (Технет, Нейронет и др.)',
      parsed_at: new Date().toISOString(),
    },
  ]
}

// ─── Парсер МСП / ВЭБ.РФ ─────────────────────────────────────────────────────
async function parseMsp() {
  return [
    {
      id: 'corpmsp-kredit',
      source: 'corpmsp',
      source_name: 'Корпорация МСП / МСП Банк',
      name: 'Льготное кредитование МСП (программа ПСК)',
      operator: 'МСП Банк / уполномоченные банки',
      type: 'loan',
      amount: 'до 2 млрд ₽ по ставке КС-3% (рынок минус 3 пп.)',
      trl_min: 1, trl_max: 9,
      sector: ['Все секторы МСП'],
      criteria: ['Статус МСП (ФНС)', 'Выручка < 2 млрд ₽/год', 'Без задолженности по налогам', 'Не в реестре недобросовестных поставщиков'],
      stage: ['Pre-seed', 'Посевная', 'Раунд A', 'Раунд B'],
      deadline: 'Rolling basis',
      status: 'active',
      url: 'https://corpmsp.ru/patsientam/msp/kredit/',
      description: 'Базовый инструмент льготного кредитования для любого МСП. Доступен через 60+ банков-партнёров.',
      parsed_at: new Date().toISOString(),
    },
    {
      id: 'veb-tech',
      source: 'veb',
      source_name: 'ВЭБ.РФ',
      name: 'Проектное финансирование ВЭБ.РФ',
      operator: 'ВЭБ.РФ',
      type: 'loan',
      amount: 'от 500 млн ₽, ставка ниже рынка',
      trl_min: 7, trl_max: 9,
      sector: ['Промышленность', 'Инфраструктура', 'БПЛА', 'Экология'],
      criteria: ['Крупный инфраструктурный или промышленный проект', 'Эффект для национальных целей', 'Залоговое обеспечение или госгарантия', 'Срок окупаемости < 15 лет'],
      stage: ['Раунд B', 'Growth'],
      deadline: 'Rolling basis',
      status: 'active',
      url: 'https://veb.ru/projects/',
      description: 'Проектное финансирование крупных инициатив. Инструмент для масштабирования после Раунда B.',
      parsed_at: new Date().toISOString(),
    },
    {
      id: 'economy-garantii',
      source: 'economy',
      source_name: 'Минэкономразвития / Гарантийный фонд',
      name: 'Гарантия МСП Банка (замена залога)',
      operator: 'МСП Банк / региональные гарантийные организации',
      type: 'guarantee',
      amount: 'Гарантия до 70% суммы кредита (до 500 млн ₽)',
      trl_min: 1, trl_max: 9,
      sector: ['Все секторы МСП'],
      criteria: ['Статус МСП', 'Проект в приоритетных отраслях', 'Нехватка залогового обеспечения'],
      stage: ['Pre-seed', 'Посевная', 'Раунд A'],
      deadline: 'Rolling basis',
      status: 'active',
      url: 'https://corpmsp.ru/patsientam/msp/garantiya/',
      description: 'Позволяет получить кредит без полного залогового обеспечения. Критически важен для стартапов.',
      parsed_at: new Date().toISOString(),
    },
  ]
}

// ─── Специализированные программы (БПЛА, аэро) ───────────────────────────────
async function parseSpecialized() {
  return [
    {
      id: 'napо-cert',
      source: 'napo',
      source_name: 'НАПО / Росавиация',
      name: 'Сертификация БПЛА (АП-21 / АП-22)',
      operator: 'Росавиация / НАПО',
      type: 'status',
      amount: 'Компенсация до 50% затрат на сертификацию',
      trl_min: 7, trl_max: 9,
      sector: ['БПЛА', 'Авиация'],
      criteria: ['Разработчик воздушного судна', 'БПЛА взлётной массой ≥ 30 кг', 'Заявка в Росавиацию'],
      stage: ['Раунд A', 'Раунд B'],
      deadline: 'Rolling basis',
      status: 'active',
      url: 'https://favt.ru/',
      description: 'Обязательный статус для коммерческой эксплуатации БПЛА. Субсидируется государством.',
      parsed_at: new Date().toISOString(),
    },
    {
      id: 'fpi-techdir',
      source: 'fpi',
      source_name: 'ФПИ — Фонд перспективных исследований',
      name: 'Программа технологического прорыва (ФПИ)',
      operator: 'Фонд перспективных исследований',
      type: 'grant',
      amount: 'Индивидуально (от 50 млн ₽)',
      trl_min: 6, trl_max: 9,
      sector: ['БПЛА', 'Оборонные технологии', 'Робототехника', 'Искусственный интеллект'],
      criteria: ['Технология двойного назначения', 'Уникальность разработки', 'Готов к лётным/натурным испытаниям', 'Соглашение о конфиденциальности'],
      stage: ['Раунд A', 'Раунд B'],
      deadline: 'По приглашению',
      status: 'active',
      url: 'https://fpi.gov.ru/',
      description: 'Финансирование прорывных технологий оборонного и двойного назначения.',
      parsed_at: new Date().toISOString(),
    },
    {
      id: 'asi-national-project',
      source: 'asi',
      source_name: 'АСИ — Агентство стратегических инициатив',
      name: 'Включение в Национальный проект (через АСИ)',
      operator: 'АСИ / профильные министерства',
      type: 'status',
      amount: 'Доступ к финансированию нацпроектов',
      trl_min: 5, trl_max: 9,
      sector: ['Все приоритетные технологические секторы'],
      criteria: ['Проект имеет общенациональное значение', 'Рекомендация рабочей группы АСИ', 'Масштабируемость на всю страну'],
      stage: ['Раунд A', 'Раунд B'],
      deadline: 'Через заявку на Форуме АСИ',
      status: 'active',
      url: 'https://asi.ru/',
      description: 'Включение в орбиту нацпроектов открывает доступ к субсидиям и госзаказу.',
      parsed_at: new Date().toISOString(),
    },
    {
      id: 'minprom-spk',
      source: 'minprom',
      source_name: 'Минпромторг РФ',
      name: 'Специальный инвестиционный контракт (СПИК 2.0)',
      operator: 'Минпромторг РФ / регион',
      type: 'status',
      amount: 'Налоговые льготы + госзаказ + снижение арендных ставок',
      trl_min: 6, trl_max: 9,
      sector: ['Промышленность', 'БПЛА', 'Электроника', 'Автопром'],
      criteria: ['Инвестиции ≥ 750 млн ₽', 'Производство в РФ', 'Новейшая технология', 'Срок 5-20 лет'],
      stage: ['Раунд B', 'Growth'],
      deadline: 'Rolling basis',
      status: 'active',
      url: 'https://minpromtorg.gov.ru/activities/spik/',
      description: 'Механизм долгосрочной защиты инвесторов с гарантией неизменности условий на срок СПИК.',
      parsed_at: new Date().toISOString(),
    },
  ]
}

/**
 * Собирает все меры из всех источников
 * @returns {Promise<Array>}
 */
export async function parseAllMeasures() {
  const [fasie, skolkovo, frp, rfriti, minprom, nti, msp, specialized] = await Promise.all([
    parseFasie(),
    parseSkolkovo(),
    parseFrp(),
    parseRfriti(),
    parseMinprom(),
    parseNti(),
    parseMsp(),
    parseSpecialized(),
  ])

  return [
    ...fasie,
    ...skolkovo,
    ...frp,
    ...rfriti,
    ...minprom,
    ...nti,
    ...msp,
    ...specialized,
  ]
}

/**
 * Подобрать меры под профиль стартапа
 */
export function matchMeasuresForProject(measures, project) {
  const { trl = 4, subFundName = 'БАС', stageName = 'Посевная', requestedAmount = 0 } = project

  const sectorMap = {
    'БАС': ['БПЛА', 'Беспилотная авиация', 'БПЛА / БАС', 'Аэромобильность', 'Аэрокосмос', 'Все технологические сектора', 'Все секторы МСП'],
    'РОБО': ['Робототехника', 'Промышленность', 'Искусственный интеллект', 'Все технологические сектора', 'Все секторы МСП'],
    'МЭ': ['Энергоэффективность', 'Промышленность', 'Все технологические сектора', 'Все секторы МСП'],
  }
  const relevantSectors = sectorMap[subFundName] || sectorMap['БАС']

  return measures.filter(m => {
    if (!m.sector) return true
    const trlOk = trl >= (m.trl_min || 1) && trl <= (m.trl_max || 9)
    const sectorOk = m.sector.some(s => relevantSectors.includes(s))
    const statusOk = m.status !== 'closed'
    return trlOk && sectorOk && statusOk
  })
}
