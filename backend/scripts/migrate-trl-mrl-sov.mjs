#!/usr/bin/env node
/**
 * Migrate TRL/MRL/Sovereignty from NUMBER fields to real reference fields in Integram.
 *
 * Current state:
 *   - Req 6155 = TRL (NUMBER, values 1-9)
 *   - Req 6157 = MRL (NUMBER, values 1-9)
 *   - Req 6159 = Sovereignty (NUMBER, values 1-9)
 *   - Reference tables: 226256 (TRL), 226266 (MRL), 226276 (Sovereignty)
 *   - Object IDs: base + N (e.g., TRL 5 = 226256 + 5 = 226261)
 *
 * What this script does:
 *   1. Reads all companies (type 1155) and their current TRL/MRL/Sov numbers
 *   2. Changes requisite types from NUMBER to reference tables
 *   3. Updates each company: number N → object ID (base + N)
 *
 * Usage:
 *   node backend/scripts/migrate-trl-mrl-sov.mjs [--dry-run]
 *   --dry-run   Show what would be done without making changes
 */

const INTEGRAM_SERVER = 'https://ai2o.ru'
const DATABASE = 'fst'
const LOGIN = 'd'
const PASSWORD = 'd'
const COMPANIES_TYPE_ID = 1155

const FIELDS = [
  { reqId: '6155', name: 'TRL', targetTableId: 226256 },
  { reqId: '6157', name: 'MRL', targetTableId: 226266 },
  { reqId: '6159', name: 'Суверенность', targetTableId: 226276 },
]

const DRY_RUN = process.argv.includes('--dry-run')

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
  console.log('[auth] OK')
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
  if (DRY_RUN) console.log('*** DRY RUN — no changes will be made ***\n')

  // Step 1: Load all companies with their current values
  console.log('=== Step 1: Load companies ===')
  const data = await iGet(`object/${COMPANIES_TYPE_ID}?JSON_KV&l=200`)
  const companies = data.object || []
  console.log(`Loaded ${companies.length} companies`)

  // Collect current values for each field
  const migrations = [] // { companyId, companyName, reqId, currentValue, newValue (dirRowId) }
  for (const company of companies) {
    const id = company.id || company.ID
    const name = company.val || company.value || ''
    const reqs = company.reqs || {}

    for (const field of FIELDS) {
      const rawValue = reqs[field.reqId]
      if (!rawValue) continue

      const num = parseInt(rawValue)
      if (num >= 1 && num <= 9) {
        const dirRowId = field.targetTableId + num
        migrations.push({
          companyId: id,
          companyName: name,
          reqId: field.reqId,
          fieldName: field.name,
          currentValue: num,
          newValue: dirRowId
        })
      }
    }
  }

  console.log(`Found ${migrations.length} values to migrate`)

  // Step 2: Change requisite types from NUMBER to reference
  console.log('\n=== Step 2: Change requisite types ===')
  for (const field of FIELDS) {
    console.log(`  Changing ${field.name} (req ${field.reqId}) → reference to table ${field.targetTableId}`)
    if (!DRY_RUN) {
      // _d_type changes the type of a requisite
      // For reference columns, the type is the target table ID
      const result = await iPost(`_d_type/${field.reqId}`, { t: field.targetTableId })
      console.log(`  Result:`, JSON.stringify(result))
    }
  }

  // Step 3: Update each company's values (number → object ID)
  console.log('\n=== Step 3: Migrate values ===')
  let success = 0, errors = 0
  for (const m of migrations) {
    const msg = `${m.companyName}: ${m.fieldName} ${m.currentValue} → dirRowId ${m.newValue}`
    if (DRY_RUN) {
      console.log(`  [DRY] ${msg}`)
    } else {
      try {
        await iPost(`_m_set/${m.companyId}`, {
          [`t${m.reqId}`]: m.newValue
        })
        console.log(`  [OK] ${msg}`)
        success++
      } catch (err) {
        console.error(`  [ERR] ${msg}:`, err.message)
        errors++
      }
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`Companies: ${companies.length}`)
  console.log(`Values migrated: ${success}`)
  console.log(`Errors: ${errors}`)

  if (!DRY_RUN) {
    console.log('\nNow remove VIRTUAL_DIRS from IntegramDataTableWrapper.vue')
    console.log('The frontend virtual mapping is no longer needed.')
  }
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
