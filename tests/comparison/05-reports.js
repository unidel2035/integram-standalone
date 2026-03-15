#!/usr/bin/env node
/**
 * 05-reports: PHP vs Node.js — Report endpoints & JSON formats
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, deleteType, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__rpt_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // Setup: type + columns + objects for report data
  const mainType = await createType(`${PREFIX}main_${TS}`, 3);
  const col1 = await addColumn(mainType, 3);   // text
  const col2 = await addColumn(mainType, 13);  // NUMBER (13, not 11=BOOLEAN)

  // Create objects with varied data
  for (const [name, num] of [['Alpha', 10], ['Beta', 20], ['Gamma', 30], ['Delta', 40], ['Epsilon', 50]]) {
    const obj = await createObj(mainType, name);
    // Set number column value
    if (col2.php && col2.node) {
      const ck = cookie();
      await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_set/${obj.php}`, `_xsrf=${xsrfPhp}&t${col2.php}=${num}&JSON=1`, ck),
        http(NODE, 'POST', `/${DB}/_m_set/${obj.node}`, `_xsrf=${xsrfNode}&t${col2.node}=${num}&JSON=1`, ck),
      ]);
    }
  }

  // Create a report on this type
  // Reports are created via the type editor — we'll use the object listing as report source
  // The report endpoint works on type IDs directly

  section('Report — JSON Formats');

  // 1. GET /report/:typeId?JSON=1
  await dual('GET /report/:type?JSON=1', 'GET',
    s => `/report/${mainType[s]}?JSON=1`);

  // 2. GET /report/:typeId?JSON_DATA
  await dual('GET /report/:type?JSON_DATA', 'GET',
    s => `/report/${mainType[s]}?JSON_DATA`);

  // 3. GET /report/:typeId?JSON_KV
  await dual('GET /report/:type?JSON_KV', 'GET',
    s => `/report/${mainType[s]}?JSON_KV`);

  // 4. GET /report/:typeId?JSON_CR
  await dual('GET /report/:type?JSON_CR', 'GET',
    s => `/report/${mainType[s]}?JSON_CR`);

  // 5. GET /report/:typeId?JSON_HR
  await dual('GET /report/:type?JSON_HR', 'GET',
    s => `/report/${mainType[s]}?JSON_HR`);

  section('Report — Pagination & Count');

  // 6. LIMIT=2
  await dual('GET /report?LIMIT=2', 'GET',
    s => `/report/${mainType[s]}?JSON=1&LIMIT=2`);

  // 7. LIMIT=1,3 (offset,count)
  await dual('GET /report?LIMIT=1,3', 'GET',
    s => `/report/${mainType[s]}?JSON=1&LIMIT=1,3`);

  // 8. RECORD_COUNT
  await dual('GET /report?RECORD_COUNT', 'GET',
    s => `/report/${mainType[s]}?RECORD_COUNT`);

  section('Report — Filters');

  // 9. Filter by text column (FR_/TO_ range)
  if (col1.php && col1.node) {
    await dual('GET /report?FR_col=B', 'GET',
      s => `/report/${mainType[s]}?JSON=1&FR_${col1[s]}=B`);
  }

  // 10. Filter by number column
  if (col2.php && col2.node) {
    await dual('GET /report?FR_col=20&TO_col=40', 'GET',
      s => `/report/${mainType[s]}?JSON=1&FR_${col2[s]}=20&TO_${col2[s]}=40`);
  }

  section('Report — CSV');

  // 11. CSV export
  await dual('GET /report?csv', 'GET',
    s => `/report/${mainType[s]}?csv`, null, { binary: true });

  // 12. GET /report (non-existent type)
  await dual('GET /report (bad id)', 'GET', '/report/999999999?JSON=1');

  section('Report — POST action=report');

  // 13. POST / action=report
  await dual('POST / action=report', 'POST', '/',
    s => `a=report&id=${mainType[s]}&JSON=1`, { statusOnly: true });

  // Cleanup
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '05-reports-results.md'), generateMD('05-reports — Reports & Formats'));
  writeReports('05-reports', join(dir, '..', 'reports'));
  console.log(`\nWrote 05-reports-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
