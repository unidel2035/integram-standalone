#!/usr/bin/env node
/**
 * seed-fst-demo-data.js — Populate FST database with demo data
 *
 * Issue #83: Remove hardcoded data from FstHub and FstCommittee
 *
 * Usage:
 *   node scripts/seed-fst-demo-data.js
 *
 * This script:
 * 1. Reads hardcoded PROJECTS_POOL from FstCommitteeConfig.js
 * 2. Creates projects in Integram database (ai2o.ru/fst)
 * 3. Stores extended fields (TRL, MRL, IRR, etc.) as JSON in description
 */

import { seedDemoProjects } from '../src/services/fstExtendedApi.js'

// Import demo data from config
const DEMO_PROJECTS = [
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

async function main() {
  console.log('🌱 Seeding FST demo data...\n')

  try {
    const results = await seedDemoProjects(DEMO_PROJECTS)

    console.log(`\n✅ Successfully seeded ${results.length} projects`)
    console.log('\nCreated project IDs:')
    results.forEach((proj, idx) => {
      console.log(`  ${idx + 1}. ID ${proj.id || proj.object_id}: ${DEMO_PROJECTS[idx].title}`)
    })

    console.log('\n📊 Next steps:')
    console.log('  1. Visit https://ai2o.ru/fst to verify projects')
    console.log('  2. Refresh FstCommittee page to see data from API')
    console.log('  3. Test editing data in Integram and reload page\n')

  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message)
    console.error(error)
    process.exit(1)
  }
}

main()
