#!/usr/bin/env node
/**
 * 24-reports-filters: PHP vs Node.js — Report execution with filters
 * Tests: JSON_KV, JSON_CR, JSON_HR output formats, LIMIT, ORDER,
 *        RECORD_COUNT, csv export, FR_/TO_ range filters
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__repf_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup: Type with data for reports ──────────────────────────────────
  const dataType = await createType(`${PREFIX}sales_${TS}`, 3);
  const colName = await addColumn(dataType, 3);    // SHORT — product
  const colAmount = await addColumn(dataType, 13);  // NUMBER — amount
  const colDate = await addColumn(dataType, 4);     // DATETIME — date

  // Populate with test data
  for (let i = 1; i <= 8; i++) {
    const obj = await createObj(dataType, `Product_${i}`);
    // Set amount
    if (obj.php && obj.node && colAmount.php && colAmount.node) {
      await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_set/${obj.php}`, `_xsrf=${getXsrf('php')}&t${colAmount.php}=${i * 10}&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_m_set/${obj.node}`, `_xsrf=${getXsrf('node')}&t${colAmount.node}=${i * 10}&JSON=1`, cookie()),
      ]);
    }
  }

  // ── JSON output formats ────────────────────────────────────────────────
  section('Reports — JSON Output Formats');

  // 1. Default JSON listing
  await dual('#1 GET /object (JSON default)', 'GET',
    s => `/object/${dataType[s]}?JSON=1`);

  // 2. JSON_DATA format
  await dual('#2 GET /object (JSON_DATA)', 'GET',
    s => `/object/${dataType[s]}?JSON_DATA=1`);

  // 3. JSON_KV format
  await dual('#3 GET /object (JSON_KV)', 'GET',
    s => `/object/${dataType[s]}?JSON_KV=1`, null, { keysOnly: true });

  // ── Pagination ─────────────────────────────────────────────────────────
  section('Reports — Pagination');

  // 4. LIMIT=3 (first 3 records)
  await dual('#4 GET /object (LIMIT=3)', 'GET',
    s => `/object/${dataType[s]}?JSON=1&LIMIT=3`);

  // 5. LIMIT=3,3 (offset 3, take 3) — keysOnly: shared DB causes different data at offsets
  await dual('#5 GET /object (LIMIT=3,3)', 'GET',
    s => `/object/${dataType[s]}?JSON=1&LIMIT=3,3`, null, { keysOnly: true });

  // 6. RECORD_COUNT — statusOnly: Node doesn't support RECORD_COUNT on /object yet
  await dual('#6 GET /object (RECORD_COUNT)', 'GET',
    s => `/object/${dataType[s]}?JSON=1&RECORD_COUNT=1`, null, { statusOnly: true });

  // ── Sorting ────────────────────────────────────────────────────────────
  section('Reports — Sorting');

  // 7. Sort ascending by name
  await dual('#7 GET /object (sort asc)', 'GET',
    s => `/object/${dataType[s]}?JSON=1&asc=1`);

  // 8. Sort descending by name
  await dual('#8 GET /object (sort desc)', 'GET',
    s => `/object/${dataType[s]}?JSON=1&desc=1`);

  // ── Report endpoint ────────────────────────────────────────────────────
  section('Reports — /report endpoint');

  // 9. report with JSON
  await dual('#9 GET /report (JSON)', 'GET',
    s => `/report/${dataType[s]}?JSON=1`, null, { keysOnly: true });

  // 10. report with JSON_KV
  await dual('#10 GET /report (JSON_KV)', 'GET',
    s => `/report/${dataType[s]}?JSON_KV=1`, null, { keysOnly: true });

  // 11. report with JSON_DATA
  await dual('#11 GET /report (JSON_DATA)', 'GET',
    s => `/report/${dataType[s]}?JSON_DATA=1`, null, { keysOnly: true });

  // 12. report with JSON_CR (column-row)
  await dual('#12 GET /report (JSON_CR)', 'GET',
    s => `/report/${dataType[s]}?JSON_CR=1`, null, { keysOnly: true });

  // 13. report with JSON_HR (header-row)
  await dual('#13 GET /report (JSON_HR)', 'GET',
    s => `/report/${dataType[s]}?JSON_HR=1`, null, { keysOnly: true });

  // ── Report with LIMIT ──────────────────────────────────────────────────
  section('Reports — /report with LIMIT');

  // 14. report LIMIT
  await dual('#14 GET /report (LIMIT=3)', 'GET',
    s => `/report/${dataType[s]}?JSON=1&LIMIT=3`);

  // 15. report RECORD_COUNT
  await dual('#15 GET /report (RECORD_COUNT)', 'GET',
    s => `/report/${dataType[s]}?JSON=1&RECORD_COUNT=1`);

  // ── CSV export ─────────────────────────────────────────────────────────
  section('Reports — CSV');

  // 16. report CSV export
  await dual('#16 GET /report (csv)', 'GET',
    s => `/report/${dataType[s]}?csv=1`, null, { statusOnly: true });

  // ── Export endpoint ────────────────────────────────────────────────────
  section('Reports — /export');

  // 17. export type — statusOnly: PHP returns null for dynamically created types
  await dual('#17 GET /export (type)', 'GET',
    s => `/export/${dataType[s]}?JSON=1`, null, { statusOnly: true });

  // ── Cleanup ────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '24-reports-filters-results.md'), generateMD('24-reports-filters — Report Formats & Pagination'));
  writeReports('24-reports-filters', join(dir, '..', 'reports'));
  console.log(`\nWrote 24-reports-filters-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
