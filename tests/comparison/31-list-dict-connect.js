#!/usr/bin/env node
/**
 * 31-list-dict-connect: PHP vs Node.js — _list, _list_join, _connect
 * Tests: plain-text listing endpoints, search, pagination,
 *        connect with invalid id, connect with nonexistent id
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__ldc_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup ──────────────────────────────────────────────────────────────
  const mainType = await createType(`${PREFIX}item_${TS}`, 3);
  const colName = await addColumn(mainType, 3);
  const colNum = await addColumn(mainType, 13);

  for (let i = 1; i <= 8; i++) {
    await createObj(mainType, `LDC_${String(i).padStart(2, '0')}`);
  }

  // ── _list: plain-text listing ────────────────────────────────────────
  section('_list — Plain text listing');

  // 1. Basic _list
  await dual('#1 GET /_list (basic)', 'GET',
    s => `/_list/${mainType[s]}`, null, { statusOnly: true });

  // 2. _list with LIMIT
  await dual('#2 GET /_list (LIMIT=3)', 'GET',
    s => `/_list/${mainType[s]}?LIMIT=3`, null, { statusOnly: true });

  // 3. _list with offset
  await dual('#3 GET /_list (LIMIT=3&F=3)', 'GET',
    s => `/_list/${mainType[s]}?LIMIT=3&F=3`, null, { statusOnly: true });

  // 4. _list with search
  await dual('#4 GET /_list (q=LDC_03)', 'GET',
    s => `/_list/${mainType[s]}?q=LDC_03`, null, { statusOnly: true });

  // 5. _list for nonexistent type (returns empty)
  await dual('#5 GET /_list (nonexistent)', 'GET',
    '/_list/999999999', null, { statusOnly: true });

  // ── _list_join: multi-join listing ───────────────────────────────────
  section('_list_join — Multi-join listing');

  // 6. Basic _list_join
  await dual('#6 GET /_list_join (basic)', 'GET',
    s => `/_list_join/${mainType[s]}`, null, { statusOnly: true });

  // 7. _list_join with LIMIT
  await dual('#7 GET /_list_join (LIMIT=3)', 'GET',
    s => `/_list_join/${mainType[s]}?LIMIT=3`, null, { statusOnly: true });

  // 8. _list_join with search
  await dual('#8 GET /_list_join (q=LDC_05)', 'GET',
    s => `/_list_join/${mainType[s]}?q=LDC_05`, null, { statusOnly: true });

  // ── _connect: connection check ───────────────────────────────────────
  section('_connect — Connection');

  // 9. _connect without id — PHP my_die() = 500, Node 200 with error
  await dual('#9 GET /_connect (no id)', 'GET',
    '/_connect', null, { ignoreStatus: true, statusOnly: true });

  // 10. _connect with nonexistent id
  await dual('#10 GET /_connect (nonexistent id)', 'GET',
    '/_connect/999999999', null, { statusOnly: true });

  // ── _list with references ────────────────────────────────────────────
  section('_list — With references');

  const lookupType = await createType(`${PREFIX}cat_${TS}`, 3);
  await createObj(lookupType, 'CatA');
  await createObj(lookupType, 'CatB');
  const colRef = await addRefColumn(mainType, lookupType);

  // 11. _list after adding ref column
  await dual('#11 GET /_list (with ref col)', 'GET',
    s => `/_list/${mainType[s]}?LIMIT=5`, null, { statusOnly: true });

  // 12. _list_join after adding ref column
  await dual('#12 GET /_list_join (with ref col)', 'GET',
    s => `/_list_join/${mainType[s]}?LIMIT=5`, null, { statusOnly: true });

  // ── _list with sorting ──────────────────────────────────────────────
  section('_list — Sorting');

  // 13. _list sort by name (sort=0)
  await dual('#13 GET /_list (sort=0 asc)', 'GET',
    s => `/_list/${mainType[s]}?sort=0&dir=asc`, null, { statusOnly: true });

  // 14. _list sort desc
  await dual('#14 GET /_list (sort=0 desc)', 'GET',
    s => `/_list/${mainType[s]}?sort=0&dir=desc`, null, { statusOnly: true });

  // ── _m_new with up parameter variations ──────────────────────────────
  section('Object — up parameter');

  // 15. Create object with up=0
  await dual('#15 POST /_m_new (up=0)', 'POST',
    s => `/_m_new/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=Up0_Test&up=0&JSON=1`, { keysOnly: true });

  // 16. Create with explicit up=1
  await dual('#16 POST /_m_new (up=1)', 'POST',
    s => `/_m_new/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=Up1_Test&up=1&JSON=1`, { keysOnly: true });

  // ── _m_new edge: empty value ─────────────────────────────────────────
  section('Object — Edge cases');

  // 17. Create with empty name
  await dual('#17 POST /_m_new (empty name)', 'POST',
    s => `/_m_new/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=&up=1&JSON=1`, { keysOnly: true });

  // ── Cleanup ────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '31-list-dict-connect-results.md'), generateMD('31-list-dict-connect — _list, _list_join, _connect'));
  writeReports('31-list-dict-connect', join(dir, '..', 'reports'));
  console.log(`\nWrote 31-list-dict-connect-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
