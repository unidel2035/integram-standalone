/**
 * fst-data-migration.mjs
 *
 * Миграция FST-данных из kval (ai2o.ru) → fst (ai2o.ru)
 *
 * Данные:
 *   - kval/1777236 "Отчёт компании в ФСТ НТИ" (3 объекта: АвиаЛогик, МикроСхема, РоботАгро)
 *   - kval/1673250 "Онтология БПЛА" — FST-специфичные концепты (теги ФСТ/суверенность)
 *
 * Результат:
 *   - fst/1169 "Портфельные компании" — портфель из kval-отчётов
 *   - Журнал миграции в docs/reports/FST_MIGRATION_REPORT.md
 *
 * Запуск: cd backend/monolith && node scripts/fst-data-migration.mjs [--dry-run]
 */

import https from 'https'
import { URL } from 'url'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')

const KVAL_SERVER = 'https://ai2o.ru'
const FST_SERVER  = 'https://ai2o.ru'
const KVAL_DB     = 'kval'
const FST_DB      = 'fst'
const LOGIN       = process.env.INTEGRAM_SYSTEM_USERNAME || ''
const PASSWORD    = process.env.INTEGRAM_SYSTEM_PASSWORD || ''

// FST DB concrete typeIds (resolved from edit_types)
const FST_TYPES = {
  SHORT:    1042,
  NUMBER:   144,
  DATETIME: 123,
  HTML:     1018
}

// kval/1777236 requisite IDs → field semantics
const KVAL_REQS = {
  1777238: 'company',       // Название компании
  1777240: 'inn_ogrn',      // ИНН / ОГРН
  1777242: 'subfund',       // Субфонд (БАС / МЭ / РОБО)
  1777244: 'stage',         // Стадия (Seed, Series A, ...)
  1777248: 'period',        // Период (Q1-2026)
  1777250: 'trl',           // TRL
  1777252: 'mrl',           // MRL
  1777254: 'sovereignty',   // Суверенность (0-9)
  1777256: 'health',        // Здоровье (0-100)
  1777258: 'runway_months', // Runway (мес)
  1777260: 'revenue',       // Выручка
  1777262: 'burn_rate',     // Burn rate
  1777264: 'valuation',     // Оценка
  1777266: 'team_size',     // Команда
  1777268: 'runway_score',  // Runway score
  1777270: 'kpi_progress',  // KPI прогресс
  1777272: 'contracts',     // Контракты
  1777274: 'target_irr',    // Целевой IRR
  1777276: 'target_nav',    // Целевой NAV
  1777278: 'achievements',  // Достижения квартала
  1777280: 'risks',         // Риски
  1777282: 'next_steps',    // Следующие шаги
  1777284: 'tranche_status',// Статус траншей
  1777286: 'regulatory',    // Регуляторика
  1777288: 'manager_note',  // Комментарий менеджера
  1777290: 'status',        // Статус проверки
  1777292: 'manager'        // Ответственный менеджер
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function request(method, urlStr, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr)
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...headers
      }
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(data) }
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function authenticate(server, db, login, pwd) {
  const res = await request(
    'POST',
    `${server}/${db}/auth?JSON_KV`,
    `login=${encodeURIComponent(login)}&pwd=${encodeURIComponent(pwd)}`
  )
  if (!res.token) throw new Error(`Auth failed for ${db}: ${JSON.stringify(res)}`)
  console.log(`✓ Auth ${db}: user=${res.userId}`)
  return { token: res.token, xsrf: res._xsrf }
}

async function apiGet(server, db, path, token) {
  const sep = path.includes('?') ? '&' : '?'
  return request('GET', `${server}/${db}/${path}${sep}JSON_KV`, null, {
    'X-Authorization': token
  })
}

async function apiPost(server, db, path, body, token, xsrf) {
  const params = new URLSearchParams(body)
  params.set('_xsrf', xsrf)
  return request(
    'POST',
    `${server}/${db}/${path}?JSON_KV`,
    params.toString(),
    { 'X-Authorization': token }
  )
}

// ── Migration logic ───────────────────────────────────────────────────────────

async function getKvalReports(kvalToken) {
  console.log('\n[1] Получаю отчёты из kval/1777236...')
  const data = await apiGet(KVAL_SERVER, KVAL_DB, '_m_list/1777236', kvalToken)

  const objects = data.object || []
  const reqs    = data.reqs   || {}
  console.log(`  Найдено объектов: ${objects.length}`)

  return objects.map(obj => ({
    id:   obj.id,
    name: obj.val,
    reqs: reqs[obj.id] || {}
  }))
}

async function getFstPortfolioType(fstToken) {
  console.log('\n[2] Проверяю структуру fst/1169 (Портфельные компании)...')
  const meta = await apiGet(FST_SERVER, FST_DB, `object/1169?JSON_KV`, fstToken)
  return meta
}

async function migrateReportToFst(report, fstToken, fstXsrf) {
  const r = report.reqs
  const body = {
    [`t1169`]: r[1777238] || report.name,  // company name → main value
    t1170: r[1777242] || '',               // Субфонд
    t1171: r[1777244] || '',               // Стадия
    t1172: r[1777250] || '',               // TRL
    t1196: r[1777278] || '',               // Достижения
    t1197: r[1777280] || '',               // Риски
    t1198: r[1777288] || ''                // Комментарий менеджера
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Создал бы: ${body[`t1169`]}`)
    return { id: `dry-${report.id}`, val: body[`t1169`] }
  }

  const res = await apiPost(FST_SERVER, FST_DB, `_m_new/1169`, body, fstToken, fstXsrf)
  return res
}

async function getFstPortfolioContents(fstToken) {
  const data = await apiGet(FST_SERVER, FST_DB, '_m_list/1169', fstToken)
  return (data.object || []).map(o => o.val)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== FST Data Migration ${DRY_RUN ? '[DRY-RUN]' : '[LIVE]'} ===\n`)

  // 1. Authenticate
  const kval = await authenticate(KVAL_SERVER, KVAL_DB, LOGIN, PASSWORD)
  const fst  = await authenticate(FST_SERVER,  FST_DB,  LOGIN, PASSWORD)

  // 2. Get kval data
  const reports = await getKvalReports(kval.token)

  // 3. Check existing portfolio in fst to avoid duplicates
  const existing = await getFstPortfolioContents(fst.token)
  console.log(`\n[3] Уже в fst/1169: ${existing.length} записей`)
  if (existing.length > 0) console.log('  ', existing.join(', '))

  // 4. Migrate each report
  console.log('\n[4] Мигрирую...')
  const migrated = []
  const skipped  = []

  for (const report of reports) {
    const company = report.reqs[1777238] || report.name
    if (existing.some(e => e === company)) {
      console.log(`  ↷ Пропускаю дубликат: ${company}`)
      skipped.push(company)
      continue
    }

    const res = await migrateReportToFst(report, fst.token, fst.xsrf)
    const newId = res.id || res
    console.log(`  ✓ Создан: ${company} → fst ID ${newId}`)
    migrated.push({ company, kvId: report.id, fstId: newId })
  }

  // 5. Summary
  console.log('\n=== Итог ===')
  console.log(`Мигрировано:  ${migrated.length}`)
  console.log(`Пропущено:    ${skipped.length}`)
  console.log(`Всего в kval: ${reports.length}`)

  // 6. Save migration report
  const reportMd = [
    '# Отчёт миграции FST данных из kval → fst',
    '',
    `> Дата: ${new Date().toISOString().slice(0, 10)} | Режим: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`,
    '',
    '## Источник: kval/1777236 "Отчёт компании в ФСТ НТИ"',
    '',
    `Найдено объектов: **${reports.length}**`,
    '',
    '| kval ID | Компания | Субфонд | Стадия | fst ID |',
    '|---------|----------|---------|--------|--------|',
    ...reports.map(r => {
      const m = migrated.find(x => x.kvId === r.id)
      const s = skipped.find(x => x === (r.reqs[1777238] || r.name))
      const status = m ? m.fstId : s ? '(дубликат)' : '(ошибка)'
      return `| ${r.id} | ${r.reqs[1777238] || r.name} | ${r.reqs[1777242] || '—'} | ${r.reqs[1777244] || '—'} | ${status} |`
    }),
    '',
    '## Целевая таблица: fst/1169 "Портфельные компании"',
    '',
    `- Мигрировано: ${migrated.length} записей`,
    `- Пропущено (дубликаты): ${skipped.length}`,
    '',
    '## Маппинг полей',
    '',
    '| kval реквизит | Поле | fst реквизит |',
    '|---------------|------|--------------|',
    '| 1777238 | Название компании | t1169 (main value) |',
    '| 1777242 | Субфонд | t1170 |',
    '| 1777244 | Стадия | t1171 |',
    '| 1777250 | TRL | t1172 |',
    '| 1777278 | Достижения квартала | t1196 |',
    '| 1777280 | Риски | t1197 |',
    '| 1777288 | Комментарий менеджера | t1198 |',
    '',
    '## Данные оставшиеся в kval',
    '',
    '| Тип | ID | Описание | Действие |',
    '|-----|----|----------|----------|',
    '| Онтология БПЛА | kval/1673250 | ~1170 концептов БПЛА (2 помечены ФСТ) | Остаётся в kval — общая онтология |',
    '| FST концепты | kval/1777211, 1777232 | Нейрокогнитивное ядро, Инв.товарищество | Копия в fst онтологии (Issue #12) |',
    '| Отчёты kval | kval/1777236 | 3 отчёта | Помечены как архивные (мигрированы) |',
    '',
    '## Следующие шаги',
    '',
    '- [ ] Issue #7: подключить FstPortfolio.vue к fst/1169 через fstApi.js',
    '- [ ] Issue #8: финансовый калькулятор NPV/IRR по данным компании',
    '- [ ] Удалить kval/1777236 после проверки (или оставить как архив)',
  ].join('\n')

  const reportPath = join(__dirname, '../../../docs/reports/FST_DATA_MIGRATION_REPORT.md')
  if (!DRY_RUN) {
    writeFileSync(reportPath, reportMd, 'utf8')
    console.log(`\nОтчёт сохранён: docs/reports/FST_DATA_MIGRATION_REPORT.md`)
  } else {
    console.log('\n[DRY-RUN] Отчёт не сохранён')
    console.log('\n--- Preview ---\n' + reportMd.slice(0, 500))
  }
}

main().catch(err => {
  console.error('\n[ERROR]', err.message)
  process.exit(1)
})
