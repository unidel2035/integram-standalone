#!/usr/bin/env node
/**
 * 29-object-count-pagination: PHP vs Node.js — Object counting & pagination
 * Tests: LIMIT, pg (page), asc/desc sorting, RECORD_COUNT,
 *        _count parameter, empty type listing, large offset
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__pgn_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup: Type with 12 objects ────────────────────────────────────────
  const mainType = await createType(`${PREFIX}item_${TS}`, 3);
  const colName = await addColumn(mainType, 3);

  for (let i = 1; i <= 12; i++) {
    await createObj(mainType, `Item_${String(i).padStart(2, '0')}`);
  }

  // ── Basic listing ──────────────────────────────────────────────────────
  section('Pagination — Basic');

  // 1. Full listing (all 12)
  await dual('#1 GET /object (all)', 'GET',
    s => `/object/${mainType[s]}?JSON=1`);

  // 2. LIMIT=5 (first 5)
  await dual('#2 GET /object (LIMIT=5)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=5`);

  // 3. LIMIT=5,5 (offset 5, take 5)
  await dual('#3 GET /object (LIMIT=5,5)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=5,5`, null, { keysOnly: true });

  // 4. LIMIT=10,5 (last 2 objects)
  await dual('#4 GET /object (LIMIT=10,5)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=10,5`, null, { keysOnly: true });

  // 5. LIMIT=100 (more than exists)
  await dual('#5 GET /object (LIMIT=100)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=100`);

  // ── Sorting ────────────────────────────────────────────────────────────
  section('Pagination — Sorting');

  // 6. Ascending
  await dual('#6 GET /object (asc)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&asc=1`);

  // 7. Descending
  await dual('#7 GET /object (desc)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&desc=1`);

  // 8. LIMIT + asc
  await dual('#8 GET /object (LIMIT+asc)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=3&asc=1`);

  // 9. LIMIT + desc
  await dual('#9 GET /object (LIMIT+desc)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=3&desc=1`);

  // ── /report pagination ─────────────────────────────────────────────────
  section('Pagination — /report');

  // 10. report LIMIT=5
  await dual('#10 GET /report (LIMIT=5)', 'GET',
    s => `/report/${mainType[s]}?JSON=1&LIMIT=5`);

  // 11. report LIMIT=5,5
  await dual('#11 GET /report (LIMIT=5,5)', 'GET',
    s => `/report/${mainType[s]}?JSON=1&LIMIT=5,5`, null, { keysOnly: true });

  // 12. report RECORD_COUNT
  await dual('#12 GET /report (RECORD_COUNT)', 'GET',
    s => `/report/${mainType[s]}?JSON=1&RECORD_COUNT=1`);

  // ── Empty type ─────────────────────────────────────────────────────────
  section('Pagination — Empty Type');

  const emptyType = await createType(`${PREFIX}empty_${TS}`, 3);

  // 13. Listing empty type
  await dual('#13 GET /object (empty type)', 'GET',
    s => `/object/${emptyType[s]}?JSON=1`);

  // 14. Report on empty type
  await dual('#14 GET /report (empty type)', 'GET',
    s => `/report/${emptyType[s]}?JSON=1`, null, { keysOnly: true });

  // ── Edge cases ─────────────────────────────────────────────────────────
  section('Pagination — Edge Cases');

  // 15. LIMIT=0 (should return all or error)
  await dual('#15 GET /object (LIMIT=0)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=0`, null, { statusOnly: true });

  // 16. Very large offset — statusOnly: shared DB may have different total counts
  await dual('#16 GET /object (LIMIT=1000,5)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=1000,5`, null, { statusOnly: true });

  // 17. LIMIT=1 (single record)
  await dual('#17 GET /object (LIMIT=1)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=1`);

  // ── Cleanup ────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '29-object-count-pagination-results.md'), generateMD('29-object-count-pagination — Counting & Pagination'));
  writeReports('29-object-count-pagination', join(dir, '..', 'reports'));
  console.log(`\nWrote 29-object-count-pagination-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
