/**
 * eventBacktest.js — бэктест предсказательной силы событийной онтологии
 *
 * Алгоритм:
 *   1. Загружаем все события type 2451 с каузальными связями (r3024)
 *   2. Строим матрицу переходов по историческим данным (тренировочная выборка)
 *   3. Для каждого актора скрываем последнее событие ("тест")
 *   4. Предсказываем тип следующего события по предыдущему
 *   5. Считаем точность: top-1 accuracy, top-2 accuracy, MRR
 *
 * Запуск:
 *   node src/scripts/eventBacktest.js
 *   node src/scripts/eventBacktest.js --verbose
 */

import fetch from 'node-fetch'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'

const INTEGRAM_URL  = process.env.INTEGRAM_SERVER_URL || 'https://api.ai2o.ru'
const INTEGRAM_DB   = 'fst'
const INTEGRAM_USER = process.env.INTEGRAM_SYSTEM_USERNAME
const INTEGRAM_PASS = process.env.INTEGRAM_SYSTEM_PASSWORD

const TYPE_EVENTS = 2451
const TYPE_ACTORS = 2406

const EVENT_TYPE_LABELS = {
  3049: 'Регуляторное',
  3050: 'Рыночное',
  3051: 'Технологическое',
  3052: 'Финансовое',
}

// ── Auth ─────────────────────────────────────────────────────────

async function authenticate() {
  // Integram возвращает 302 с токеном в Set-Cookie: fst=<token>
  const res = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/auth`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ login: INTEGRAM_USER, pwd: INTEGRAM_PASS })
  })

  if (res.status !== 302) throw new Error(`Auth failed: ${res.status}`)

  const cookieHeader = res.headers.get('set-cookie') || ''
  const m = cookieHeader.match(new RegExp(`${INTEGRAM_DB}=([^;]+)`))
  if (!m) throw new Error('No token in Set-Cookie')
  return m[1]
}

async function fetchObjectList(typeId, token) {
  // Integram caps at 20 items per page regardless of l= param.
  // Must deduplicate by ID and stop when no new items arrive.
  const all = []
  const seen = new Set()
  let offset = 0

  while (true) {
    const res = await fetch(
      `${INTEGRAM_URL}/${INTEGRAM_DB}/object/${typeId}?JSON_KV&l=20&s=${offset}`,
      { headers: { 'X-Authorization': token } }
    )
    if (!res.ok) throw new Error(`fetch ${typeId}: ${res.status}`)
    const data = await res.json()

    const objects = data.object || []
    const reqs    = data.reqs || {}

    if (objects.length === 0) break
    let newCount = 0

    for (const obj of objects) {
      if (seen.has(obj.id)) continue
      seen.add(obj.id)
      newCount++

      const r = reqs[obj.id] || {}

      // Actors: prefer ref_3007 (REF format), fallback to plain r['3007'] (pipeline events)
      const actorsFromRef   = parseMultiRefStr(r.ref_3007)
      const actorsFromPlain = r['3007']
        ? String(r['3007']).split(',').map(s => Number(s.trim())).filter(Boolean)
        : []
      const actors = actorsFromRef.length ? actorsFromRef : actorsFromPlain

      // Event type: prefer ref_3044, fallback to plain r['3044'] (pipeline events)
      const typeFromRef   = parseRef(r.ref_3044)
      const typeFromPlain = r['3044'] ? Number(String(r['3044']).split(',')[0]) || null : null
      const evType = typeFromRef || typeFromPlain

      all.push({
        id:    Number(obj.id),
        val:   obj.val,
        r3044: evType,
        // Causal links from ref_3024: "2451:60060,60067"
        r3024: parseMultiRefStr(r.ref_3024),
        // Actors (merged from both ref_3007 and plain 3007)
        r3007: actors,
        // Concepts from ref_3021
        r3021: parseMultiRefStr(r.ref_3021),
        // Date
        r2458: r['2458'] || '',
        // Quantitative fields
        r61928: r['61928'] || null,  // probability
        r61929: r['61929'] || null,  // delta_trl
        r61930: r['61930'] || null,  // delta_funding_mln
        r61931: r['61931'] || null,  // magnitude
      })
    }

    if (newCount === 0) break
    offset += objects.length
  }

  return all
}

// "3042:3049" → 3049
function parseRef(str) {
  if (!str) return null
  const parts = str.split(':')
  if (parts.length < 2) return null
  const ids = parts[1].split(',')
  return Number(ids[0]) || null
}

// "2451:60060,60067" → [60060, 60067]
function parseMultiRefStr(str) {
  if (!str) return []
  const parts = str.split(':')
  if (parts.length < 2) return []
  return parts[1].split(',').map(Number).filter(Boolean)
}

// ── Helpers ───────────────────────────────────────────────────────

function parseMultiRef(val) {
  if (!val) return []
  if (Array.isArray(val)) return val.map(Number).filter(Boolean)
  if (typeof val === 'number') return [val]
  if (typeof val === 'string') return val.split(',').map(s => Number(s.trim())).filter(Boolean)
  return []
}

// actors field in our flat records is already an array
function getActors(evt) {
  return Array.isArray(evt.r3007) ? evt.r3007 : parseMultiRef(evt.r3007)
}

function getCauses(evt) {
  return Array.isArray(evt.r3024) ? evt.r3024 : parseMultiRef(evt.r3024)
}

function typeName(typeId) {
  return EVENT_TYPE_LABELS[typeId] || `type_${typeId}`
}

// ── Transition matrix ─────────────────────────────────────────────

/**
 * Два режима построения матрицы:
 *   causal   — через r3024 (каузальные ссылки)
 *   temporal — через временную последовательность событий по акторам
 */
function buildMatrix(events, excludeIds = new Set(), mode = 'causal') {
  const counts = {}
  const totals = {}

  if (mode === 'causal') {
    const evtMap = Object.fromEntries(events.map(e => [e.id, e]))
    for (const evt of events) {
      if (excludeIds.has(evt.id)) continue
      const causes = getCauses(evt)
      for (const causeId of causes) {
        const cause = evtMap[causeId]
        if (!cause || excludeIds.has(causeId)) continue
        const from = typeName(cause.r3044)
        const to   = typeName(evt.r3044)
        if (!from || from === 'Неизвестно' || !to || to === 'Неизвестно') continue
        const key = `${from}→${to}`
        counts[key] = (counts[key] || 0) + 1
        totals[from] = (totals[from] || 0) + 1
      }
    }
  } else {
    // temporal: group by actor, sort by date, count sequential type transitions
    const groups = groupByActor(events.filter(e => !excludeIds.has(e.id)))
    for (const actorEvents of Object.values(groups)) {
      for (let i = 1; i < actorEvents.length; i++) {
        const from = typeName(actorEvents[i - 1].r3044)
        const to   = typeName(actorEvents[i].r3044)
        if (!from || from === 'Неизвестно' || !to || to === 'Неизвестно') continue
        const key = `${from}→${to}`
        counts[key] = (counts[key] || 0) + 1
        totals[from] = (totals[from] || 0) + 1
      }
    }
  }

  const matrix = {}
  for (const from of Object.keys(totals)) {
    const outgoing = Object.entries(counts)
      .filter(([k]) => k.startsWith(`${from}→`))
      .map(([k, c]) => ({ to: k.split('→')[1], count: c, p: c / totals[from] }))
      .sort((a, b) => b.p - a.p)
    matrix[from] = outgoing
  }
  return matrix
}

function predict(matrix, fromType) {
  return matrix[fromType] || []
}

// ── Group events by actor / sort by date ──────────────────────────

function groupByActor(events) {
  const groups = {}
  for (const evt of events) {
    const actorIds = getActors(evt)
    for (const aId of actorIds) {
      if (!groups[aId]) groups[aId] = []
      groups[aId].push(evt)
    }
  }

  // Sort each actor's events by date (r2458), fallback to id
  for (const aId of Object.keys(groups)) {
    groups[aId].sort((a, b) => {
      const da = a.r2458 ? new Date(a.r2458) : 0
      const db = b.r2458 ? new Date(b.r2458) : 0
      if (da && db) return da - db
      return a.id - b.id
    })
  }

  return groups
}

// ── Backtest ──────────────────────────────────────────────────────

function runBacktest(events, actors, verbose = false) {
  const actorMap = Object.fromEntries(actors.map(a => [a.id, a.name || `Актор #${a.id}`]))
  const groups   = groupByActor(events)

  // Determine best matrix mode
  const hasCausalLinks = events.some(e => getCauses(e).length > 0)
  const matrixMode = hasCausalLinks ? 'causal' : 'temporal'
  if (verbose) console.log(`Режим матрицы: ${matrixMode} (каузальных рёбер: ${events.reduce((s,e)=>s+getCauses(e).length,0)})\n`)

  const results = []

  for (const [actorId, actorEvents] of Object.entries(groups)) {
    if (actorEvents.length < 2) continue

    const testEvent    = actorEvents[actorEvents.length - 1]
    const trainEvents  = actorEvents.slice(0, -1)
    const lastTrain    = trainEvents[trainEvents.length - 1]

    if (!testEvent.r3044 || !lastTrain.r3044) continue

    const actualType = typeName(testEvent.r3044)
    const prevType   = typeName(lastTrain.r3044)

    // Leave-one-out: строим матрицу без тестового события
    const excludeSet  = new Set([testEvent.id])
    const matrix      = buildMatrix(events, excludeSet, matrixMode)
    let predictions   = predict(matrix, prevType)

    // Fallback: если матрица пуста для этого типа — используем глобальную частоту типов
    if (predictions.length === 0) {
      const globalMatrix = buildMatrix(events, new Set(), matrixMode)
      predictions = predict(globalMatrix, prevType)
    }

    const top1 = predictions[0]?.to
    const top2 = predictions.slice(0, 2).map(p => p.to)
    const rank = predictions.findIndex(p => p.to === actualType) + 1

    const hit1 = top1 === actualType
    const hit2 = top2.includes(actualType)
    const mrr  = rank > 0 ? 1 / rank : 0

    results.push({
      actorId: Number(actorId),
      actorName:   actorMap[actorId] || `Актор #${actorId}`,
      prevType,
      actualType,
      top1,
      top2,
      hit1,
      hit2,
      mrr,
      confidence:  predictions[0]?.p || 0,
    })

    if (verbose) {
      const mark = hit1 ? '✅' : hit2 ? '🟡' : '❌'
      console.log(`${mark} ${actorMap[actorId] || actorId}`)
      console.log(`   История: ...→ ${prevType} → [${actualType}]`)
      console.log(`   Предсказание: ${top1 || '—'} (${Math.round((predictions[0]?.p || 0) * 100)}%)`)
      if (!hit1 && predictions.length > 1) {
        console.log(`   Top-2: ${top2.join(', ')}`)
      }
      console.log()
    }
  }

  return results
}

// ── Metrics ───────────────────────────────────────────────────────

function calcMetrics(results) {
  if (results.length === 0) return null

  const n     = results.length
  const acc1  = results.filter(r => r.hit1).length / n
  const acc2  = results.filter(r => r.hit2).length / n
  const mrr   = results.reduce((s, r) => s + r.mrr, 0) / n

  // By event type
  const byType = {}
  for (const r of results) {
    if (!byType[r.prevType]) byType[r.prevType] = { total: 0, hit1: 0, hit2: 0 }
    byType[r.prevType].total++
    if (r.hit1) byType[r.prevType].hit1++
    if (r.hit2) byType[r.prevType].hit2++
  }

  // Confusion matrix
  const confusion = {}
  for (const r of results) {
    const key = `${r.prevType}→${r.actualType}`
    confusion[key] = (confusion[key] || 0) + 1
  }

  return { n, acc1, acc2, mrr, byType, confusion }
}

// ── Load pipeline events from local JSON ─────────────────────────

function loadPipelineEvents(jsonPath) {
  if (!existsSync(jsonPath)) return { events: [], actors: [] }
  try {
    const data = JSON.parse(readFileSync(jsonPath, 'utf8'))
    const events = []
    const actorSet = new Set()
    let syntheticId = -1

    for (const result of (data.results || [])) {
      const actorId = result.actorId
      if (!actorId) continue
      actorSet.add(actorId)

      for (const ev of (result.events || [])) {
        const typeId = ev.typeId || null
        if (!typeId) continue  // skip events with unknown type
        events.push({
          id:     syntheticId--,  // negative IDs to avoid collisions
          val:    ev.description || '',
          r3044:  typeId,
          r3024:  [],
          r3007:  [actorId],
          r3021:  [],
          r2458:  ev.date || '',
          r61928: ev.probability || null,
          r61929: ev.delta_trl   || null,
          r61930: ev.amount_mln  || null,
          r61931: ev.magnitude   || null,
        })
      }
    }

    // Use project names as actor names where available
    const actorNames = new Map()
    for (const result of (data.results || [])) {
      if (result.actorId && result.project?.name) {
        actorNames.set(result.actorId, result.project.name)
      }
    }
    const actors = Array.from(actorSet).map(id => ({ id, name: actorNames.get(id) || `Компания #${id}` }))
    return { events, actors }
  } catch (e) {
    console.warn(`[pipeline JSON] Failed to load: ${e.message}`)
    return { events: [], actors: [] }
  }
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const verbose = process.argv.includes('--verbose')

  console.log('=== Бэктест событийной онтологии ФСТ ===\n')
  console.log('Загружаю данные из Integram...')

  const token  = await authenticate()
  const integEvents = await fetchObjectList(TYPE_EVENTS, token)
  const integActors = await fetchObjectList(TYPE_ACTORS, token)

  // Supplement with pipeline events from local JSON
  const pipelineJsonPath = new URL('../../../yadisk-pipeline-result.json', import.meta.url).pathname
  const { events: pipeEvents, actors: pipeActors } = loadPipelineEvents(pipelineJsonPath)

  // Merge: pipeline events supplement Integram events (dedup by actor+type+date+desc prefix)
  const seenKeys = new Set()
  const allEvents = []
  for (const ev of integEvents) {
    const key = `${ev.r3007.join(',')}_${ev.r3044}_${ev.r2458}_${ev.val.slice(0, 30)}`
    seenKeys.add(key)
    allEvents.push(ev)
  }
  for (const ev of pipeEvents) {
    const key = `${ev.r3007.join(',')}_${ev.r3044}_${ev.r2458}_${ev.val.slice(0, 30)}`
    if (!seenKeys.has(key)) allEvents.push(ev)
  }

  // Merge actors
  const actorMap = new Map()
  for (const a of integActors) actorMap.set(a.id, a)
  for (const a of pipeActors)  if (!actorMap.has(a.id)) actorMap.set(a.id, a)
  const actors = Array.from(actorMap.values())

  const events = allEvents
  console.log(`Событий Integram: ${integEvents.length}, pipeline JSON: ${pipeEvents.length}, итого уникальных: ${events.length}`)
  console.log(`Акторов: ${actors.length}\n`)

  if (verbose) console.log('--- Детали по компаниям ---\n')

  const results = runBacktest(events, actors, verbose)
  const metrics = calcMetrics(results)

  if (!metrics) {
    console.log('❌ Недостаточно данных для бэктеста (нужно ≥2 события на компанию с каузальными связями)')
    return
  }

  // ── Вывод результатов ────────────────────────────────────────────
  console.log('=== РЕЗУЛЬТАТЫ БЭКТЕСТА ===\n')
  console.log(`Компаний в выборке:   ${metrics.n}`)
  console.log(`Top-1 accuracy:       ${(metrics.acc1 * 100).toFixed(1)}%`)
  console.log(`Top-2 accuracy:       ${(metrics.acc2 * 100).toFixed(1)}%`)
  console.log(`MRR (Mean Recip Rank): ${metrics.mrr.toFixed(3)}\n`)

  console.log('--- Точность по типу предыдущего события ---')
  for (const [type, stat] of Object.entries(metrics.byType)) {
    const a1 = stat.total ? (stat.hit1 / stat.total * 100).toFixed(0) : '—'
    const a2 = stat.total ? (stat.hit2 / stat.total * 100).toFixed(0) : '—'
    console.log(`  ${type.padEnd(20)} n=${stat.total}  top-1=${a1}%  top-2=${a2}%`)
  }

  console.log('\n--- Матрица ошибок (предыдущее→фактическое) ---')
  for (const [key, count] of Object.entries(metrics.confusion).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key.padEnd(40)} ${count}x`)
  }

  // ── Интерпретация ─────────────────────────────────────────────────
  console.log('\n=== ИНТЕРПРЕТАЦИЯ ===')
  if (metrics.acc1 >= 0.6) {
    console.log('✅ Высокая предсказательная сила — модель полезна для раннего предупреждения')
  } else if (metrics.acc1 >= 0.4) {
    console.log('🟡 Умеренная предсказательная сила — модель лучше случайного угадывания (25%)')
  } else {
    console.log('❌ Слабая предсказательная сила — нужно больше данных или уточнение каузальных цепочек')
  }

  const baseline = 1 / Object.keys(EVENT_TYPE_LABELS).length
  console.log(`   Baseline (случайный выбор): ${(baseline * 100).toFixed(0)}%`)
  console.log(`   Прирост над baseline: +${((metrics.acc1 - baseline) * 100).toFixed(1)} п.п.`)

  // Сохраняем результат в JSON для использования фронтом
  const output = {
    timestamp:  new Date().toISOString(),
    sampleSize: metrics.n,
    accuracy:   { top1: metrics.acc1, top2: metrics.acc2, mrr: metrics.mrr },
    baseline,
    byType:     metrics.byType,
    confusion:  metrics.confusion,
    details:    results,
  }

  const { writeFileSync } = await import('fs')
  const { join, dirname } = await import('path')
  const outPath = join(dirname(fileURLToPath(import.meta.url)), '../../backtest-result.json')
  writeFileSync(outPath, JSON.stringify(output, null, 2))
  console.log(`\nРезультат сохранён: backend/backtest-result.json`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
