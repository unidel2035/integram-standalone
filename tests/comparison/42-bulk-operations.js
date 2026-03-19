#!/usr/bin/env node
/**
 * 42-bulk-operations: PHP vs Node.js — Bulk create/delete, large listings
 * Tests: create 20+ objects, paginated listing, bulk delete,
 *        _list with large result set, LIMIT edge cases,
 *        type with many columns
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__bulk_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup: type with multiple columns ──────────────────────────────
  const mainType = await createType(`${PREFIX}item_${TS}`, 3);
  const col1 = await addColumn(mainType, 3);   // SHORT
  const col2 = await addColumn(mainType, 13);  // NUMBER
  const col3 = await addColumn(mainType, 3);   // SHORT (another)

  // ── Bulk create 20 objects ───────────────────────────────────────────
  section('Bulk — Create 20 objects');

  const objects = [];
  for (let i = 1; i <= 20; i++) {
    objects.push(await createObj(mainType, `Item_${String(i).padStart(3, '0')}`));
  }

  // Set some number values
  for (let i = 0; i < 20; i++) {
    if (objects[i].php && objects[i].node && col2.php && col2.node) {
      await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_set/${objects[i].php}`, `_xsrf=${getXsrf('php')}&t${col2.php}=${(i + 1) * 5}&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_m_set/${objects[i].node}`, `_xsrf=${getXsrf('node')}&t${col2.node}=${(i + 1) * 5}&JSON=1`, cookie()),
      ]);
    }
  }

  // ── Paginated listing ────────────────────────────────────────────────
  section('Bulk — Pagination');

  // 1. Full listing
  await dual('#1 GET /object (all 20)', 'GET',
    s => `/object/${mainType[s]}?JSON=1`);

  // 2. Page 1 (first 5)
  await dual('#2 GET /object (LIMIT=5)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=5`);

  // 3. Page 2 (next 5)
  await dual('#3 GET /object (LIMIT=5,5)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=5,5`, null, { keysOnly: true });

  // 4. Page 3
  await dual('#4 GET /object (LIMIT=10,5)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=10,5`, null, { keysOnly: true });

  // 5. Last page (items 16-20)
  await dual('#5 GET /object (LIMIT=15,5)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=15,5`, null, { keysOnly: true });

  // 6. Beyond end
  await dual('#6 GET /object (LIMIT=25,5)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=25,5`, null, { statusOnly: true });

  // ── Sorted pagination ────────────────────────────────────────────────
  section('Bulk — Sorted pagination');

  // 7. asc LIMIT=5
  await dual('#7 GET /object (asc LIMIT=5)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=5&asc=1`);

  // 8. desc LIMIT=5
  await dual('#8 GET /object (desc LIMIT=5)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=5&desc=1`);

  // ── _list with large set ─────────────────────────────────────────────
  section('Bulk — _list');

  // 9. _list all
  await dual('#9 GET /_list (all)', 'GET',
    s => `/_list/${mainType[s]}?LIMIT=50`, null, { statusOnly: true });

  // 10. _list paginated
  await dual('#10 GET /_list (LIMIT=5&F=5)', 'GET',
    s => `/_list/${mainType[s]}?LIMIT=5&F=5`, null, { statusOnly: true });

  // ── report on large set ──────────────────────────────────────────────
  section('Bulk — Report');

  // 11. report RECORD_COUNT
  await dual('#11 GET /report (RECORD_COUNT)', 'GET',
    s => `/report/${mainType[s]}?JSON=1&RECORD_COUNT=1`, null, { keysOnly: true });

  // 12. report LIMIT=5
  await dual('#12 GET /report (LIMIT=5)', 'GET',
    s => `/report/${mainType[s]}?JSON=1&LIMIT=5`, null, { keysOnly: true });

  // ── Type with many columns ───────────────────────────────────────────
  section('Bulk — Many columns');

  const wideType = await createType(`${PREFIX}wide_${TS}`, 3);
  const cols = [];
  for (let i = 0; i < 8; i++) {
    cols.push(await addColumn(wideType, i % 2 === 0 ? 3 : 13));
  }

  // 13. Create object in wide type
  await dual('#13 POST /_m_new (wide type)', 'POST',
    s => `/_m_new/${wideType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${wideType[s]}=WideObj&up=1&JSON=1`, { keysOnly: true });

  // 14. Metadata for wide type
  await dual('#14 GET /metadata (wide type)', 'GET',
    s => `/metadata/${wideType[s]}?JSON=1`);

  // ── Bulk delete ──────────────────────────────────────────────────────
  section('Bulk — Delete');

  // 15. Delete first 5 objects one by one
  for (let i = 0; i < 5; i++) {
    if (objects[i].php && objects[i].node) {
      await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_del/${objects[i].php}`, `_xsrf=${getXsrf('php')}&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_m_del/${objects[i].node}`, `_xsrf=${getXsrf('node')}&JSON=1`, cookie()),
      ]);
    }
  }

  // 15. Verify 15 remain
  await dual('#15 GET /object (after delete 5)', 'GET',
    s => `/object/${mainType[s]}?JSON=1`);

  // ── Cleanup ────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '42-bulk-operations-results.md'), generateMD('42-bulk-operations — Bulk Create/Delete & Large Listings'));
  writeReports('42-bulk-operations', join(dir, '..', 'reports'));
  console.log(`\nWrote 42-bulk-operations-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
