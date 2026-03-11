/**
 * fixEventActors.js — создать акторов для портфельных компаний
 * и привязать все события (type 2451) без актора к нужному актору.
 *
 * Логика: события type 2451 созданы пайплайном без t3007 (актора).
 * В event.val записано что-то вроде "Регуляторное — ..." без привязки к компании.
 * Но события также содержат ссылку на project (t3008? или не содержат вообще?).
 *
 * Упрощённый вариант: создаём по одному актору на компанию из type 1155,
 * затем для каждой компании прогоняем события без актора и смотрим
 * на дату создания (ID — монотонный в Integram). Но это ненадёжно.
 *
 * Правильный вариант: перезапустить пайплайн с флагом --relink.
 *
 * Для ТЕКУЩИХ событий: добавляем поле r3008 (project ref) и r3007 (actor).
 * Поскольку существующие события уже созданы, нам нужно найти их по набору
 * метаданных — но у нас нет надёжного способа сматчить 112 событий к компаниям.
 *
 * Поэтому делаем иначе:
 *   1. Создаём акторов для 5 компаний в type 2406
 *   2. Удаляем/пересоздаём события — нет, слишком destructive
 *   3. ЛУЧШЕ: добавляем поле "проект" к типу событий и ссылаемся на type 1155
 *
 * Пока: просто создаём акторов для компаний — они понадобятся при следующем прогоне.
 * Результат сохраняем в JSON.
 */

import fetch from 'node-fetch'

const INTEGRAM_URL  = process.env.INTEGRAM_SERVER_URL || 'https://api.ai2o.ru'
const INTEGRAM_DB   = 'fst'
const INTEGRAM_USER = process.env.INTEGRAM_SYSTEM_USERNAME
const INTEGRAM_PASS = process.env.INTEGRAM_SYSTEM_PASSWORD

const TYPE_ACTORS   = 2406
const TYPE_PROJECTS = 1155
const TYPE_EVENTS   = 2451

// Companies that had matching Yandex.Disk folders
const COMPANY_NAMES = [
  'ООО Эколибри-БТ — Конвертоплан Р-75',
  'ООО ЭкстраСинема',
  'ООО 3Д Исследования и Разработки — Сверхлегкая ракета',
  'ООО ЭраАэро — Конвертоплан Эра',
  'ООО ИНЭСИС — Гигафабрика',
]

async function auth() {
  const res = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/auth`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ login: INTEGRAM_USER, pwd: INTEGRAM_PASS })
  })
  const cookie = res.headers.get('set-cookie') || ''
  const m = cookie.match(new RegExp(`${INTEGRAM_DB}=([^;]+)`))
  if (!m) throw new Error('No token')
  const token = m[1]

  const xr = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/xsrf`, {
    headers: { 'X-Authorization': token }
  })
  const xd = await xr.json()
  return { token, xsrf: xd._xsrf }
}

async function post(token, xsrf, path, body) {
  body.set('_xsrf', xsrf)
  const res = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/${path}?JSON_KV`, {
    method: 'POST',
    headers: { 'X-Authorization': token },
    body
  })
  return res.json()
}

async function main() {
  console.log('=== Fix Event Actors ===')
  const { token, xsrf } = await auth()
  console.log('✓ Authenticated')

  // 1. Load existing actors
  const ar = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/object/${TYPE_ACTORS}?JSON_KV&l=200`, {
    headers: { 'X-Authorization': token }
  })
  const ad = await ar.json()
  const actors = (ad.object || []).map(o => ({ id: o.id, name: o.val }))
  console.log(`Loaded ${actors.length} actors`)

  // 2. Create actors for companies that don't have one yet
  const actorMap = {}  // companyName → actorId
  for (const cname of COMPANY_NAMES) {
    const existing = actors.find(a => a.name === cname)
    if (existing) {
      console.log(`  Already exists: ${cname} (id=${existing.id})`)
      actorMap[cname] = existing.id
      continue
    }
    const body = new URLSearchParams()
    body.set('name', cname)
    body.set('up', '1')
    const result = await post(token, xsrf, `_m_new/${TYPE_ACTORS}`, body)
    const newId = result?.id || result?.object?.[0]?.id
    if (newId) {
      console.log(`  Created actor: ${cname} (id=${newId})`)
      actorMap[cname] = newId
    } else {
      console.log(`  ⚠ Failed to create actor: ${cname}`, JSON.stringify(result).slice(0, 100))
    }
  }

  // 3. Load all events, find ones without actor (ref_3007 empty)
  const er = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/object/${TYPE_EVENTS}?JSON_KV&l=500`, {
    headers: { 'X-Authorization': token }
  })
  const ed = await er.json()
  const events = (ed.object || [])
  const reqs   = ed.reqs || {}

  let noActor = 0, linked = 0
  for (const ev of events) {
    const r = reqs[ev.id] || {}
    if (r.ref_3007) continue  // already has actor
    noActor++
  }
  console.log(`\nEvents without actor: ${noActor} out of ${events.length}`)
  console.log('Note: To link events to actors, re-run yadiskPipeline.js (actors are now created)')
  console.log('\nActor map:')
  for (const [name, id] of Object.entries(actorMap)) {
    console.log(`  ${id}: ${name}`)
  }
}

main().catch(console.error)
