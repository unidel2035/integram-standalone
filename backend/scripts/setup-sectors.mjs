#!/usr/bin/env node
/**
 * Setup "Секторы" (Sectors) lookup table in Integram fst database
 * and add it as a reference column to the companies table (type 1155).
 *
 * Then uses AI to classify each company by sector based on its description.
 *
 * Usage: node backend/scripts/setup-sectors.mjs [--classify]
 *   --classify  Also run AI classification of existing companies
 */

const INTEGRAM_SERVER = 'https://ai2o.ru'
const DATABASE = 'fst'
const LOGIN = 'd'
const PASSWORD = 'd'
const COMPANIES_TYPE_ID = 1155
const DESCRIPTION_REQ_ID = 1158  // "Описание проекта" field

// Sectors to create
const SECTORS = [
  'Аэронет / БАС',
  'AI / ML',
  'FinTech',
  'BioTech / Фармацевтика',
  'CleanTech / Энергетика',
  'AgriTech',
  'Кибербезопасность',
  'SpaceTech / Космос',
  'EdTech',
  'MedTech / Здоровье',
  'Робототехника',
  'Новые материалы',
  'Логистика / Транспорт',
  'Телеком / Связь',
  'Другое'
]

// ─── Integram HTTP helpers ───────────────────────────────────────────────────

let session = null

async function auth() {
  if (session) return session
  const body = `login=${encodeURIComponent(LOGIN)}&pwd=${encodeURIComponent(PASSWORD)}`
  const resp = await fetch(`${INTEGRAM_SERVER}/${DATABASE}/auth?JSON_KV=`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const data = await resp.json()
  const d = Array.isArray(data) ? data[0] : data
  if (!d.token) throw new Error(`Auth failed: ${JSON.stringify(d)}`)
  session = { token: d.token, xsrf: d._xsrf }
  console.log('[auth] OK, token:', session.token.slice(0, 8) + '...')
  return session
}

async function iPost(path, params = {}) {
  const sess = await auth()
  const parts = [`_xsrf=${encodeURIComponent(sess.xsrf)}`]
  for (const [k, v] of Object.entries(params)) {
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  }
  const resp = await fetch(`${INTEGRAM_SERVER}/${DATABASE}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Authorization': sess.token,
      'Cookie': `token=${sess.token}`
    },
    body: parts.join('&')
  })
  const text = await resp.text()
  try { return JSON.parse(text) }
  catch { return { raw: text } }
}

async function iGet(path) {
  const sess = await auth()
  const resp = await fetch(`${INTEGRAM_SERVER}/${DATABASE}/${path}`, {
    headers: {
      'X-Authorization': sess.token,
      'Cookie': `token=${sess.token}`
    }
  })
  const text = await resp.text()
  try { return JSON.parse(text) }
  catch { return { raw: text } }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const doClassify = process.argv.includes('--classify')

  console.log('=== Step 1: Create "Секторы" lookup table ===')

  // Create the type (table)
  const typeResult = await iPost('_d_new', { val: 'Секторы', t: 3 })
  const sectorTypeId = typeResult.obj || typeResult.id
  if (!sectorTypeId) {
    console.error('Failed to create Секторы table:', typeResult)
    // Try to find existing
    const dict = await iGet('dict?JSON_KV=')
    const types = dict.type || []
    const existing = types.find(t => (t.val || t.name) === 'Секторы')
    if (existing) {
      console.log('Found existing "Секторы" table with ID:', existing.id || existing.ID)
      return useExistingTable(Number(existing.id || existing.ID), doClassify)
    }
    throw new Error('Cannot create or find Секторы table')
  }
  console.log(`[OK] Created "Секторы" table with typeId: ${sectorTypeId}`)

  // Populate with sector values
  console.log('\n=== Step 2: Populate sectors ===')
  const sectorMap = {} // name → id
  for (const sector of SECTORS) {
    const obj = await iPost(`_m_new/${sectorTypeId}`, {
      [`t${sectorTypeId}`]: sector,
      up: 1
    })
    const id = obj.obj || obj.id
    if (id) {
      sectorMap[sector] = id
      console.log(`  [OK] ${sector} → ID ${id}`)
    } else {
      console.warn(`  [WARN] Failed to create "${sector}":`, obj)
    }
  }

  // Add reference column to companies table (type 1155)
  console.log('\n=== Step 3: Add "Сектор" reference column to type 1155 ===')
  const reqResult = await iPost(`_d_req/${COMPANIES_TYPE_ID}`, { t: sectorTypeId })
  const sectorReqId = reqResult.id
  if (!sectorReqId) {
    console.error('Failed to add requisite:', reqResult)
    throw new Error('Cannot add Сектор requisite')
  }
  console.log(`[OK] Created requisite ID: ${sectorReqId}`)

  // Set alias
  await iPost(`_d_alias/${sectorReqId}`, { val: 'Сектор' })
  console.log('[OK] Alias set to "Сектор"')

  console.log('\n=== Summary ===')
  console.log(`Sectors table ID: ${sectorTypeId}`)
  console.log(`Sector requisite ID: ${sectorReqId}`)
  console.log(`Sectors created: ${Object.keys(sectorMap).length}`)
  console.log(JSON.stringify(sectorMap, null, 2))

  if (doClassify) {
    await classifyCompanies(sectorMap, sectorReqId)
  } else {
    console.log('\nRun with --classify to auto-classify companies by sector via AI')
  }
}

async function useExistingTable(sectorTypeId, doClassify) {
  console.log(`Using existing sectors table: ${sectorTypeId}`)

  // Load existing sectors
  const data = await iGet(`_d_req/${sectorTypeId}?JSON_KV&l=100`)
  const objects = data.object || []
  const sectorMap = {}
  for (const obj of objects) {
    sectorMap[obj.val || obj.value] = obj.id || obj.ID
  }
  console.log('Existing sectors:', sectorMap)

  // Check if reference column already exists
  const meta = await iGet(`_d_req/${COMPANIES_TYPE_ID}?JSON_KV`)
  const refType = meta.ref_type || {}
  let sectorReqId = null
  for (const [reqId, targetId] of Object.entries(refType)) {
    if (Number(targetId) === sectorTypeId) {
      sectorReqId = reqId
      break
    }
  }

  if (!sectorReqId) {
    console.log('Adding reference column...')
    const reqResult = await iPost(`_d_req/${COMPANIES_TYPE_ID}`, { t: sectorTypeId })
    sectorReqId = reqResult.id
    if (sectorReqId) {
      await iPost(`_d_alias/${sectorReqId}`, { val: 'Сектор' })
      console.log(`[OK] Created requisite ID: ${sectorReqId}, alias: Сектор`)
    }
  } else {
    console.log(`Sector reference column already exists: reqId=${sectorReqId}`)
  }

  if (doClassify && sectorReqId) {
    await classifyCompanies(sectorMap, sectorReqId)
  }
}

async function classifyCompanies(sectorMap, sectorReqId) {
  console.log('\n=== Classifying companies by sector via AI ===')

  // Load all companies
  const data = await iGet(`object/${COMPANIES_TYPE_ID}?JSON_KV&l=200`)
  const companies = data.object || []
  console.log(`Loaded ${companies.length} companies`)

  const sectorNames = Object.keys(sectorMap)

  for (const company of companies) {
    const name = company.val || company.value || ''
    const reqs = company.reqs || {}
    const description = reqs[DESCRIPTION_REQ_ID] || ''

    if (!description) {
      console.log(`  [SKIP] ${name} — no description`)
      continue
    }

    // Check if sector already set
    if (reqs[sectorReqId]) {
      console.log(`  [SKIP] ${name} — sector already set: ${reqs[sectorReqId]}`)
      continue
    }

    // Use AI to classify
    try {
      const prompt = `Определи сектор компании по её описанию. Ответь ТОЛЬКО названием сектора из списка, без пояснений.

Список секторов: ${sectorNames.join(', ')}

Компания: ${name}
Описание: ${description.slice(0, 500)}

Сектор:`

      const aiResp = await fetch('http://localhost:8082/api/ai-tokens/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'deepseek/deepseek-chat',
          prompt,
          systemPrompt: 'Ты — классификатор компаний по секторам. Отвечай ТОЛЬКО названием сектора из предоставленного списка.',
          application: 'setup-sectors'
        })
      })
      const aiData = await aiResp.json()
      const sectorAnswer = (aiData.response || '').trim()

      // Find best match
      const match = sectorNames.find(s =>
        sectorAnswer.toLowerCase().includes(s.toLowerCase()) ||
        s.toLowerCase().includes(sectorAnswer.toLowerCase())
      )
      const sectorId = match ? sectorMap[match] : sectorMap['Другое']
      const sectorName = match || 'Другое'

      if (sectorId) {
        await iPost(`_m_set/${company.id || company.ID}`, {
          [`t${sectorReqId}`]: sectorId
        })
        console.log(`  [OK] ${name} → ${sectorName} (ID: ${sectorId})`)
      } else {
        console.log(`  [WARN] ${name} → AI said "${sectorAnswer}" — no match`)
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 300))
    } catch (err) {
      console.error(`  [ERR] ${name}:`, err.message)
    }
  }

  console.log('\n=== Classification complete ===')
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
