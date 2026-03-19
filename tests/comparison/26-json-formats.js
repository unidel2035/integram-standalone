#!/usr/bin/env node
/**
 * 26-json-formats: PHP vs Node.js — All JSON output format variants
 * Tests: JSON, JSON_DATA, JSON_KV, JSON_CR, JSON_HR on /object and /edit_obj
 * These are the core formats used by dronedoc2025 frontend
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__jfmt_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup ──────────────────────────────────────────────────────────────
  const mainType = await createType(`${PREFIX}item_${TS}`, 3);
  const colName = await addColumn(mainType, 3);
  const colNum = await addColumn(mainType, 13);
  const colBool = await addColumn(mainType, 11);

  const lookupType = await createType(`${PREFIX}cat_${TS}`, 3);
  await createObj(lookupType, 'Alpha');
  await createObj(lookupType, 'Beta');
  const colRef = await addRefColumn(mainType, lookupType);

  // Create objects with data
  const obj1 = await createObj(mainType, 'Элемент_1');
  const obj2 = await createObj(mainType, 'Элемент_2');
  const obj3 = await createObj(mainType, 'Элемент_3');

  // Set field values
  if (obj1.php && obj1.node && colNum.php && colNum.node) {
    await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_set/${obj1.php}`, `_xsrf=${getXsrf('php')}&t${colNum.php}=100&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_m_set/${obj1.node}`, `_xsrf=${getXsrf('node')}&t${colNum.node}=100&JSON=1`, cookie()),
    ]);
  }

  // ── /object with different JSON formats ────────────────────────────────
  section('JSON Formats — /object');

  // 1. JSON (default — full listing)
  await dual('#1 GET /object (JSON)', 'GET',
    s => `/object/${mainType[s]}?JSON=1`);

  // 2. JSON_DATA (data only, no UI blocks)
  await dual('#2 GET /object (JSON_DATA)', 'GET',
    s => `/object/${mainType[s]}?JSON_DATA=1`);

  // 3. JSON_KV (key-value format — used by dronedoc)
  await dual('#3 GET /object (JSON_KV)', 'GET',
    s => `/object/${mainType[s]}?JSON_KV=1`, null, { keysOnly: true });

  // 4. JSON_CR (column-row format)
  await dual('#4 GET /object (JSON_CR)', 'GET',
    s => `/object/${mainType[s]}?JSON_CR=1`, null, { keysOnly: true });

  // 5. JSON_HR (header-row format)
  await dual('#5 GET /object (JSON_HR)', 'GET',
    s => `/object/${mainType[s]}?JSON_HR=1`, null, { keysOnly: true });

  // ── /edit_obj with JSON formats ────────────────────────────────────────
  section('JSON Formats — /edit_obj');

  // 6. edit_obj JSON
  if (obj1.php && obj1.node) {
    await dual('#6 GET /edit_obj (JSON)', 'GET',
      s => `/edit_obj/${obj1[s]}?JSON=1`, null, { keysOnly: true });
  }

  // 7. edit_obj JSON_KV
  if (obj1.php && obj1.node) {
    await dual('#7 GET /edit_obj (JSON_KV)', 'GET',
      s => `/edit_obj/${obj1[s]}?JSON_KV=1`, null, { keysOnly: true });
  }

  // ── /edit_types with JSON formats ──────────────────────────────────────
  section('JSON Formats — /edit_types');

  // 8. edit_types JSON
  await dual('#8 GET /edit_types (JSON)', 'GET',
    '/edit_types?JSON=1', null, { keysOnly: true });

  // 9. edit_types JSON_KV
  await dual('#9 GET /edit_types (JSON_KV)', 'GET',
    '/edit_types?JSON_KV=1', null, { keysOnly: true });

  // ── /terms with JSON formats ───────────────────────────────────────────
  section('JSON Formats — /terms');

  // 10. terms JSON
  await dual('#10 GET /terms (JSON)', 'GET',
    '/terms?JSON=1');

  // 11. terms JSON_KV
  await dual('#11 GET /terms (JSON_KV)', 'GET',
    '/terms?JSON_KV=1', null, { keysOnly: true });

  // ── /metadata with JSON formats ────────────────────────────────────────
  section('JSON Formats — /metadata');

  // 12. metadata JSON
  await dual('#12 GET /metadata (JSON)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // 13. metadata JSON_KV
  await dual('#13 GET /metadata (JSON_KV)', 'GET',
    s => `/metadata/${mainType[s]}?JSON_KV=1`, null, { keysOnly: true });

  // ── /report with JSON formats ──────────────────────────────────────────
  section('JSON Formats — /report');

  // 14. report JSON
  await dual('#14 GET /report (JSON)', 'GET',
    s => `/report/${mainType[s]}?JSON=1`, null, { keysOnly: true });

  // 15. report JSON_KV
  await dual('#15 GET /report (JSON_KV)', 'GET',
    s => `/report/${mainType[s]}?JSON_KV=1`, null, { keysOnly: true });

  // 16. report JSON_DATA
  await dual('#16 GET /report (JSON_DATA)', 'GET',
    s => `/report/${mainType[s]}?JSON_DATA=1`, null, { keysOnly: true });

  // 17. report JSON_CR
  await dual('#17 GET /report (JSON_CR)', 'GET',
    s => `/report/${mainType[s]}?JSON_CR=1`, null, { keysOnly: true });

  // 18. report JSON_HR
  await dual('#18 GET /report (JSON_HR)', 'GET',
    s => `/report/${mainType[s]}?JSON_HR=1`, null, { keysOnly: true });

  // ── /xsrf and /auth with JSON_KV ──────────────────────────────────────
  section('JSON Formats — Auth endpoints');

  // 19. xsrf JSON_KV (used by dronedoc for session check)
  await dual('#19 GET /xsrf (JSON_KV)', 'GET',
    '/xsrf?JSON_KV=1', null, { keysOnly: true });

  // 20. grants JSON_KV
  await dual('#20 GET /grants (JSON_KV)', 'GET',
    '/grants?JSON_KV=1', null, { keysOnly: true });

  // ── /object with combined params ───────────────────────────────────────
  section('JSON Formats — Combined params');

  // 21. JSON_KV + LIMIT
  await dual('#21 GET /object (JSON_KV + LIMIT)', 'GET',
    s => `/object/${mainType[s]}?JSON_KV=1&LIMIT=2`, null, { keysOnly: true });

  // 22. JSON_KV + asc
  await dual('#22 GET /object (JSON_KV + asc)', 'GET',
    s => `/object/${mainType[s]}?JSON_KV=1&asc=1`, null, { keysOnly: true });

  // ── _ref_reqs with JSON_KV ─────────────────────────────────────────────
  section('JSON Formats — _ref_reqs');

  // 23. _ref_reqs JSON
  if (colRef.php && colRef.node) {
    await dual('#23 GET /_ref_reqs (JSON)', 'GET',
      s => `/_ref_reqs/${colRef[s]}?JSON=1`);
  }

  // 24. _ref_reqs JSON_KV
  if (colRef.php && colRef.node) {
    await dual('#24 GET /_ref_reqs (JSON_KV)', 'GET',
      s => `/_ref_reqs/${colRef[s]}?JSON_KV=1`, null, { keysOnly: true });
  }

  // ── Cleanup ────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '26-json-formats-results.md'), generateMD('26-json-formats — JSON Output Format Variants'));
  writeReports('26-json-formats', join(dir, '..', 'reports'));
  console.log(`\nWrote 26-json-formats-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
