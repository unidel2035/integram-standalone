#!/usr/bin/env node
/**
 * 37-report-listing-export: PHP vs Node.js — Report listing, /export, /report edge cases
 * Tests: /report (no id = list all), /report with invalid id,
 *        /export with JSON/JSON_KV, /export CSV, /report with LIMIT+RECORD_COUNT
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__rptexp_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup ──────────────────────────────────────────────────────────
  const mainType = await createType(`${PREFIX}doc_${TS}`, 3);
  const colName = await addColumn(mainType, 3);
  const colNum = await addColumn(mainType, 13);

  for (let i = 1; i <= 6; i++) {
    const obj = await createObj(mainType, `Doc_${String(i).padStart(2, '0')}`);
    if (obj.php && obj.node && colNum.php && colNum.node) {
      await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_set/${obj.php}`, `_xsrf=${getXsrf('php')}&t${colNum.php}=${i * 10}&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_m_set/${obj.node}`, `_xsrf=${getXsrf('node')}&t${colNum.node}=${i * 10}&JSON=1`, cookie()),
      ]);
    }
  }

  // ── Report listing (no ID) ───────────────────────────────────────────
  section('Report — Listing');

  // 1. /report with no ID — PHP errors (requires auth differently), Node lists
  await dual('#1 GET /report (no id, list)', 'GET',
    '/report?JSON=1', null, { statusOnly: true });

  // 2. /report with invalid ID
  await dual('#2 GET /report (invalid id)', 'GET',
    '/report/999999999?JSON=1', null, { statusOnly: true });

  // 3. /report with type ID (not a report — should error)
  await dual('#3 GET /report (type id, not report)', 'GET',
    s => `/report/${mainType[s]}?JSON=1`, null, { keysOnly: true });

  // ── Report formats ───────────────────────────────────────────────────
  section('Report — Formats on type');

  // 4. report JSON
  await dual('#4 GET /report (JSON)', 'GET',
    s => `/report/${mainType[s]}?JSON=1`, null, { keysOnly: true });

  // 5. report JSON_KV
  await dual('#5 GET /report (JSON_KV)', 'GET',
    s => `/report/${mainType[s]}?JSON_KV=1`, null, { keysOnly: true });

  // 6. report JSON_CR
  await dual('#6 GET /report (JSON_CR)', 'GET',
    s => `/report/${mainType[s]}?JSON_CR=1`, null, { keysOnly: true });

  // 7. report JSON_HR
  await dual('#7 GET /report (JSON_HR)', 'GET',
    s => `/report/${mainType[s]}?JSON_HR=1`, null, { keysOnly: true });

  // 8. report JSON_DATA
  await dual('#8 GET /report (JSON_DATA)', 'GET',
    s => `/report/${mainType[s]}?JSON_DATA=1`, null, { keysOnly: true });

  // ── Report pagination ────────────────────────────────────────────────
  section('Report — Pagination');

  // 9. LIMIT=3
  await dual('#9 GET /report (LIMIT=3)', 'GET',
    s => `/report/${mainType[s]}?JSON=1&LIMIT=3`, null, { keysOnly: true });

  // 10. LIMIT=3 + desc
  await dual('#10 GET /report (LIMIT=3+desc)', 'GET',
    s => `/report/${mainType[s]}?JSON=1&LIMIT=3&desc=1`, null, { keysOnly: true });

  // 11. LIMIT + offset
  await dual('#11 GET /report (LIMIT=3,3)', 'GET',
    s => `/report/${mainType[s]}?JSON=1&LIMIT=3,3`, null, { keysOnly: true });

  // 12. RECORD_COUNT
  await dual('#12 GET /report (RECORD_COUNT)', 'GET',
    s => `/report/${mainType[s]}?JSON=1&RECORD_COUNT=1`, null, { keysOnly: true });

  // ── /export ──────────────────────────────────────────────────────────
  section('Export');

  // 13. export — PHP returns CSV text, Node returns CSV; compare status only
  await dual('#13 GET /export (JSON)', 'GET',
    s => `/export/${mainType[s]}?JSON=1`, null, { statusOnly: true });

  // 14. export JSON_KV
  await dual('#14 GET /export (JSON_KV)', 'GET',
    s => `/export/${mainType[s]}?JSON_KV=1`, null, { statusOnly: true });

  // 15. export nonexistent type
  await dual('#15 GET /export (nonexistent)', 'GET',
    '/export/999999999?JSON=1', null, { statusOnly: true });

  // ── /object with multiple format params ──────────────────────────────
  section('Object — Format combos');

  // 16. object JSON + LIMIT + asc
  await dual('#16 GET /object (JSON+LIMIT+asc)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=3&asc=1`);

  // 17. object JSON_KV + LIMIT + desc
  await dual('#17 GET /object (JSON_KV+LIMIT+desc)', 'GET',
    s => `/object/${mainType[s]}?JSON_KV=1&LIMIT=3&desc=1`, null, { keysOnly: true });

  // 18. object JSON_HR
  await dual('#18 GET /object (JSON_HR)', 'GET',
    s => `/object/${mainType[s]}?JSON_HR=1`, null, { keysOnly: true });

  // ── /terms with type filter ──────────────────────────────────────────
  section('Terms — type filter');

  // 19. terms JSON (all)
  await dual('#19 GET /terms (JSON)', 'GET',
    '/terms?JSON=1');

  // 20. terms JSON_KV
  await dual('#20 GET /terms (JSON_KV)', 'GET',
    '/terms?JSON_KV=1', null, { keysOnly: true });

  // ── Cleanup ────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '37-report-listing-export-results.md'), generateMD('37-report-listing-export — Reports & Export'));
  writeReports('37-report-listing-export', join(dir, '..', 'reports'));
  console.log(`\nWrote 37-report-listing-export-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
