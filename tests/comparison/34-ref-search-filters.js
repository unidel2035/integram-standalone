#!/usr/bin/env node
/**
 * 34-ref-search-filters: PHP vs Node.js — _ref_reqs search/restrict, F_I/F_U filters
 * Tests: _ref_reqs with q=, r= (restrict), LIMIT; /object with F_I, F_U;
 *        combined pagination params (pg+LIMIT+desc)
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__rsf_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup: lookup type with many items ─────────────────────────────
  const catType = await createType(`${PREFIX}cat_${TS}`, 3);
  const catNames = ['Альфа', 'Бета', 'Гамма', 'Дельта', 'Эпсилон',
                    'Зета', 'Эта', 'Тета', 'Йота', 'Каппа',
                    'Лямбда', 'Мю'];
  const catObjs = [];
  for (const name of catNames) {
    catObjs.push(await createObj(catType, name));
  }

  // Main type with ref + name columns
  const mainType = await createType(`${PREFIX}order_${TS}`, 3);
  const colName = await addColumn(mainType, 3);
  const colCat = await addRefColumn(mainType, catType);

  // Create objects and set refs
  const obj1 = await createObj(mainType, 'Заказ_А');
  const obj2 = await createObj(mainType, 'Заказ_Б');
  const obj3 = await createObj(mainType, 'Заказ_В');
  const obj4 = await createObj(mainType, 'Заказ_Г');
  const obj5 = await createObj(mainType, 'Заказ_Д');

  // Set references
  for (const [obj, catIdx] of [[obj1, 0], [obj2, 2], [obj3, 5], [obj4, 0], [obj5, 8]]) {
    if (obj.php && obj.node && colCat.php && colCat.node && catObjs[catIdx].php && catObjs[catIdx].node) {
      await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_set/${obj.php}`, `_xsrf=${getXsrf('php')}&t${colCat.php}=${catObjs[catIdx].php}&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_m_set/${obj.node}`, `_xsrf=${getXsrf('node')}&t${colCat.node}=${catObjs[catIdx].node}&JSON=1`, cookie()),
      ]);
    }
  }

  // ── _ref_reqs with search ────────────────────────────────────────────
  section('Ref Search — q= parameter');

  // 1. All refs (baseline)
  if (colCat.php && colCat.node) {
    await dual('#1 GET /_ref_reqs (all)', 'GET',
      s => `/_ref_reqs/${colCat[s]}?JSON=1`);
  }

  // 2. Search by partial name
  if (colCat.php && colCat.node) {
    await dual('#2 GET /_ref_reqs (q=Альф)', 'GET',
      s => `/_ref_reqs/${colCat[s]}?q=${encodeURIComponent('Альф')}&JSON=1`, null, { keysOnly: true });
  }

  // 3. Search with no results
  if (colCat.php && colCat.node) {
    await dual('#3 GET /_ref_reqs (q=ZZZZZ)', 'GET',
      s => `/_ref_reqs/${colCat[s]}?q=ZZZZZ&JSON=1`);
  }

  // ── _ref_reqs with restrict ──────────────────────────────────────────
  section('Ref Search — r= (restrict)');

  // 4. Restrict to specific IDs
  if (colCat.php && colCat.node && catObjs[0].php && catObjs[0].node && catObjs[1].php && catObjs[1].node) {
    await dual('#4 GET /_ref_reqs (r=id1,id2)', 'GET',
      s => `/_ref_reqs/${colCat[s]}?r=${catObjs[0][s]},${catObjs[1][s]}&JSON=1`);
  }

  // 5. Restrict with nonexistent ID
  if (colCat.php && colCat.node) {
    await dual('#5 GET /_ref_reqs (r=999999999)', 'GET',
      s => `/_ref_reqs/${colCat[s]}?r=999999999&JSON=1`);
  }

  // ── _ref_reqs with LIMIT ────────────────────────────────────────────
  section('Ref Search — LIMIT');

  // 6. LIMIT=3
  if (colCat.php && colCat.node) {
    await dual('#6 GET /_ref_reqs (LIMIT=3)', 'GET',
      s => `/_ref_reqs/${colCat[s]}?LIMIT=3&JSON=1`, null, { keysOnly: true });
  }

  // 7. LIMIT + q combined
  if (colCat.php && colCat.node) {
    await dual('#7 GET /_ref_reqs (LIMIT+q)', 'GET',
      s => `/_ref_reqs/${colCat[s]}?LIMIT=2&q=${encodeURIComponent('а')}&JSON=1`, null, { keysOnly: true });
  }

  // ── F_I filter (object by ID) ────────────────────────────────────────
  section('Object Filters — F_I');

  // 8. F_I = specific object ID
  if (obj1.php && obj1.node) {
    await dual('#8 GET /object (F_I=objId)', 'GET',
      s => `/object/${mainType[s]}?F_I=${obj1[s]}&JSON=1`, null, { keysOnly: true });
  }

  // 9. F_I = nonexistent
  await dual('#9 GET /object (F_I=999999999)', 'GET',
    s => `/object/${mainType[s]}?F_I=999999999&JSON=1`, null, { keysOnly: true });

  // ── F_U filter (parent) ──────────────────────────────────────────────
  section('Object Filters — F_U');

  // 10. F_U=1 (root level)
  await dual('#10 GET /object (F_U=1)', 'GET',
    s => `/object/${mainType[s]}?F_U=1&JSON=1`, null, { keysOnly: true });

  // 11. F_U=0 (should show all or default)
  await dual('#11 GET /object (F_U=0)', 'GET',
    s => `/object/${mainType[s]}?F_U=0&JSON=1`, null, { keysOnly: true });

  // ── Combined pagination params ───────────────────────────────────────
  section('Pagination — Combined');

  // 12. LIMIT + desc
  await dual('#12 GET /object (LIMIT=2 + desc)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=2&desc=1`, null, { keysOnly: true });

  // 13. LIMIT + asc
  await dual('#13 GET /object (LIMIT=2 + asc)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=2&asc=1`, null, { keysOnly: true });

  // 14. LIMIT with offset + desc
  await dual('#14 GET /object (LIMIT=2,2 + desc)', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=2,2&desc=1`, null, { keysOnly: true });

  // ── obj_meta detailed ────────────────────────────────────────────────
  section('obj_meta — Detailed');

  // 15. obj_meta for object with ref set
  if (obj1.php && obj1.node) {
    await dual('#15 GET /obj_meta (obj with ref)', 'GET',
      s => `/obj_meta/${obj1[s]}?JSON=1`, null, { keysOnly: true });
  }

  // 16. obj_meta for object without ref set
  const bareObj = await createObj(mainType, 'BareObj');
  if (bareObj.php && bareObj.node) {
    await dual('#16 GET /obj_meta (bare obj)', 'GET',
      s => `/obj_meta/${bareObj[s]}?JSON=1`, null, { keysOnly: true });
  }

  // 17. obj_meta for nonexistent
  await dual('#17 GET /obj_meta (nonexistent)', 'GET',
    '/obj_meta/999999999?JSON=1', null, { statusOnly: true });

  // ── /download edge case ──────────────────────────────────────────────
  section('Download — Edge cases');

  // 18. Download nonexistent file — PHP 200 (renders page), Node 404
  await dual('#18 GET /download (nonexistent)', 'GET',
    '/download/nonexistent_file_xyz.txt', null, { ignoreStatus: true, statusOnly: true });

  // ── /report with combined params ─────────────────────────────────────
  section('Report — Combined params');

  // 19. report LIMIT + desc
  await dual('#19 GET /report (LIMIT=2 + desc)', 'GET',
    s => `/report/${mainType[s]}?JSON=1&LIMIT=2&desc=1`, null, { keysOnly: true });

  // 20. report RECORD_COUNT + LIMIT
  await dual('#20 GET /report (RECORD_COUNT+LIMIT)', 'GET',
    s => `/report/${mainType[s]}?JSON=1&RECORD_COUNT=1&LIMIT=3`, null, { keysOnly: true });

  // ── Cleanup ────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '34-ref-search-filters-results.md'), generateMD('34-ref-search-filters — Ref Search & Object Filters'));
  writeReports('34-ref-search-filters', join(dir, '..', 'reports'));
  console.log(`\nWrote 34-ref-search-filters-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
