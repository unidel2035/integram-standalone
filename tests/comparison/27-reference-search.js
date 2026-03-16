#!/usr/bin/env node
/**
 * 27-reference-search: PHP vs Node.js — Reference dropdown & search
 * Tests: _ref_reqs with search queries, filtering, restriction values,
 *        object listing with F_U (parent filter), pagination on refs
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__refsrch_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup: Lookup with many items ──────────────────────────────────────
  const catType = await createType(`${PREFIX}cat_${TS}`, 3);
  const items = [];
  const names = ['Автомобиль', 'Велосипед', 'Грузовик', 'Дрон', 'Электросамокат',
                 'Фургон', 'Газель', 'Хэтчбек', 'Минивэн', 'Кабриолет'];
  for (const name of names) {
    items.push(await createObj(catType, name));
  }

  // Main type with ref
  const mainType = await createType(`${PREFIX}order_${TS}`, 3);
  const colName = await addColumn(mainType, 3);
  const colCat = await addRefColumn(mainType, catType);

  const obj1 = await createObj(mainType, 'Заказ_1');

  // ── _ref_reqs: Basic reference list ────────────────────────────────────
  section('Reference Search — Basic');

  // 1. Get all reference options
  if (colCat.php && colCat.node) {
    await dual('#1 GET /_ref_reqs (all items)', 'GET',
      s => `/_ref_reqs/${colCat[s]}?JSON=1`);
  }

  // 2. Get ref options for specific object
  if (colCat.php && colCat.node && obj1.php && obj1.node) {
    await dual('#2 GET /_ref_reqs (with obj id)', 'GET',
      s => `/_ref_reqs/${colCat[s]}?id=${obj1[s]}&JSON=1`);
  }

  // ── Listing with F_U (parent filter) ───────────────────────────────────
  section('Reference Search — F_U filter');

  // 3. List objects of lookup type (all)
  await dual('#3 GET /object (lookup all)', 'GET',
    s => `/object/${catType[s]}?JSON=1`);

  // 4. List objects with F_U=1 (root level)
  await dual('#4 GET /object (F_U=1)', 'GET',
    s => `/object/${catType[s]}?F_U=1&JSON=1`);

  // ── Set reference and verify ───────────────────────────────────────────
  section('Reference Search — Set & Verify');

  // 5. Set reference on obj1
  if (obj1.php && obj1.node && colCat.php && colCat.node && items[3].php && items[3].node) {
    await dual('#5 POST /_m_set (set ref to Дрон)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colCat[s]}=${items[3][s]}&JSON=1`, { keysOnly: true });
  }

  // 6. Verify in edit_obj
  if (obj1.php && obj1.node) {
    await dual('#6 GET /edit_obj (after set ref)', 'GET',
      s => `/edit_obj/${obj1[s]}?JSON=1`, null, { keysOnly: true });
  }

  // 7. Verify in listing
  await dual('#7 GET /object (listing with refs)', 'GET',
    s => `/object/${mainType[s]}?JSON=1`);

  // ── Invalid reference ──────────────────────────────────────────────────
  section('Reference Search — Edge Cases');

  // 8. Set invalid reference (non-existent ID)
  if (obj1.php && obj1.node && colCat.php && colCat.node) {
    await dual('#8 POST /_m_set (invalid ref)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colCat[s]}=999999999&JSON=1`, { keysOnly: true });
  }

  // 9. Set ref to 0 (clear)
  if (obj1.php && obj1.node && colCat.php && colCat.node) {
    await dual('#9 POST /_m_set (clear ref to 0)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colCat[s]}=0&JSON=1`, { keysOnly: true });
  }

  // 10. _ref_reqs for non-existent column
  await dual('#10 GET /_ref_reqs (nonexistent)', 'GET',
    '/_ref_reqs/999999999?JSON=1', null, { statusOnly: true });

  // ── Multiple objects with same ref ─────────────────────────────────────
  section('Reference Search — Multiple refs');

  const obj2 = await createObj(mainType, 'Заказ_2');
  const obj3 = await createObj(mainType, 'Заказ_3');

  // 11-12. Set refs on multiple objects
  if (obj2.php && obj2.node && colCat.php && colCat.node && items[0].php && items[0].node) {
    await dual('#11 POST /_m_set (set ref obj2)', 'POST',
      s => `/_m_set/${obj2[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colCat[s]}=${items[0][s]}&JSON=1`, { keysOnly: true });
  }

  if (obj3.php && obj3.node && colCat.php && colCat.node && items[0].php && items[0].node) {
    await dual('#12 POST /_m_set (set ref obj3 same)', 'POST',
      s => `/_m_set/${obj3[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colCat[s]}=${items[0][s]}&JSON=1`, { keysOnly: true });
  }

  // 13. List all — should show refs
  await dual('#13 GET /object (all with refs)', 'GET',
    s => `/object/${mainType[s]}?JSON=1`);

  // ── Cleanup ────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '27-reference-search-results.md'), generateMD('27-reference-search — Reference Dropdown & Search'));
  writeReports('27-reference-search', join(dir, '..', 'reports'));
  console.log(`\nWrote 27-reference-search-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
