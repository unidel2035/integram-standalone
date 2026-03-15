#!/usr/bin/env node
/**
 * 11-directories: PHP vs Node.js — Directories (справочники) & Reference fields
 * Based on IntegramDirAdmin.vue + ReferenceField.vue patterns:
 *   Lookup tables, reference columns, _ref_reqs, dropdown options,
 *   multiselect add/remove, directory caching
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, deleteType, deleteObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__dir_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup: Lookup table (справочник) ──────────────────────────────────────
  section('Directories — Create Lookup Table');

  // Create lookup table
  const lookupType = await createType(`${PREFIX}colors_${TS}`, 3);

  // Populate with values
  const red   = await createObj(lookupType, 'Красный');
  const green = await createObj(lookupType, 'Зеленый');
  const blue  = await createObj(lookupType, 'Синий');
  const white = await createObj(lookupType, 'Белый');
  const black = await createObj(lookupType, 'Черный');

  // Create second lookup for multi-level references
  const sizeType = await createType(`${PREFIX}sizes_${TS}`, 3);
  const small  = await createObj(sizeType, 'S');
  const medium = await createObj(sizeType, 'M');
  const large  = await createObj(sizeType, 'L');
  const xl     = await createObj(sizeType, 'XL');

  // Create main table with reference columns
  const mainType = await createType(`${PREFIX}items_${TS}`, 3);
  const colName = await addColumn(mainType, 3);        // name (SHORT)
  const colColor = await addRefColumn(mainType, lookupType);  // reference to colors
  const colSize  = await addRefColumn(mainType, sizeType);    // reference to sizes

  // ── Verify Lookup Table ───────────────────────────────────────────────────
  section('Directories — List Lookup Values');

  // 1. List all lookup values
  await dual('#1 GET /object (lookup list)', 'GET',
    s => `/object/${lookupType[s]}?JSON=1`);

  // 2. List with LIMIT
  await dual('#2 GET /object (lookup LIMIT=3)', 'GET',
    s => `/object/${lookupType[s]}?LIMIT=3&JSON=1`);

  // 3. Get single lookup value (edit_obj)
  await dual('#3 GET /edit_obj (lookup item)', 'GET',
    s => `/edit_obj/${red[s]}?JSON=1`);

  // ── Reference Options (_ref_reqs) ─────────────────────────────────────────
  section('Directories — Reference Options (_ref_reqs)');

  // Create an object in main table to reference against
  const item1 = await createObj(mainType, 'Item1');

  // 4. Get reference options for color column
  if (colColor.php && colColor.node) {
    await dual('#4 GET /_ref_reqs (color options)', 'GET',
      s => `/_ref_reqs/${colColor[s]}?id=${item1[s]}&JSON=1`);
  }

  // 5. Get reference options for size column
  if (colSize.php && colSize.node) {
    await dual('#5 GET /_ref_reqs (size options)', 'GET',
      s => `/_ref_reqs/${colSize[s]}?id=${item1[s]}&JSON=1`);
  }

  // 6. Reference options with search query
  if (colColor.php && colColor.node) {
    await dual('#6 GET /_ref_reqs (query=Крас)', 'GET',
      s => `/_ref_reqs/${colColor[s]}?id=${item1[s]}&q=${encodeURIComponent('Крас')}&JSON=1`);
  }

  // 7. Reference options with empty query
  if (colColor.php && colColor.node) {
    await dual('#7 GET /_ref_reqs (empty query)', 'GET',
      s => `/_ref_reqs/${colColor[s]}?id=${item1[s]}&q=&JSON=1`);
  }

  // ── Set Reference Values ──────────────────────────────────────────────────
  section('Directories — Set Reference Values');

  // 8. Set single reference value (select color)
  if (colColor.php && colColor.node) {
    await dual('#8 POST /_m_set (set color ref)', 'POST',
      s => `/_m_set/${item1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colColor[s]}=${red[s]}&JSON=1`);
  }

  // 9. Set another reference value (select size)
  if (colSize.php && colSize.node) {
    await dual('#9 POST /_m_set (set size ref)', 'POST',
      s => `/_m_set/${item1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colSize[s]}=${medium[s]}&JSON=1`);
  }

  // 10. Verify object with references (edit_obj)
  await dual('#10 GET /edit_obj (with refs)', 'GET',
    s => `/edit_obj/${item1[s]}?JSON=1`);

  // 11. Change reference value
  if (colColor.php && colColor.node) {
    await dual('#11 POST /_m_set (change color ref)', 'POST',
      s => `/_m_set/${item1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colColor[s]}=${blue[s]}&JSON=1`);
  }

  // 12. Clear reference value
  if (colColor.php && colColor.node) {
    await dual('#12 POST /_m_set (clear color ref)', 'POST',
      s => `/_m_set/${item1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colColor[s]}=&JSON=1`);
  }

  // ── Multiselect ───────────────────────────────────────────────────────────
  section('Directories — Multiselect');

  // Toggle multiselect on color column
  if (colColor.php && colColor.node) {
    await http(PHP, 'POST', `/${DB}/_d_multi/${colColor.php}`, `_xsrf=${xsrfPhp}&JSON=1`, cookie());
    await http(NODE, 'POST', `/${DB}/_d_multi/${colColor.node}`, `_xsrf=${xsrfNode}&JSON=1`, cookie());
  }

  const item2 = await createObj(mainType, 'MultiItem');

  // 13. Add multiselect item
  if (colColor.php && colColor.node) {
    await dual('#13 POST /_m_set (multiselect add red)', 'POST',
      s => `/_m_set/${item2[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colColor[s]}=${red[s]}&JSON=1`);
  }

  // 14. Add another multiselect item
  if (colColor.php && colColor.node) {
    await dual('#14 POST /_m_set (multiselect add green)', 'POST',
      s => `/_m_set/${item2[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colColor[s]}=${green[s]}&JSON=1`);
  }

  // 15. Add third multiselect item
  if (colColor.php && colColor.node) {
    await dual('#15 POST /_m_set (multiselect add blue)', 'POST',
      s => `/_m_set/${item2[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colColor[s]}=${blue[s]}&JSON=1`);
  }

  // 16. Verify multiselect object
  await dual('#16 GET /edit_obj (multiselect obj)', 'GET',
    s => `/edit_obj/${item2[s]}?JSON=1`);

  // 17. Get _ref_reqs for multiselect column
  if (colColor.php && colColor.node) {
    await dual('#17 GET /_ref_reqs (multiselect col)', 'GET',
      s => `/_ref_reqs/${colColor[s]}?id=${item2[s]}&JSON=1`);
  }

  // 18. List with multiselect data
  await dual('#18 GET /object (with multiselect)', 'GET',
    s => `/object/${mainType[s]}?JSON=1`);

  // ── Lookup CRUD ───────────────────────────────────────────────────────────
  section('Directories — Lookup CRUD');

  // 19. Add value to lookup
  await dual('#19 POST /_m_new (add to lookup)', 'POST',
    s => `/_m_new/${lookupType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${lookupType[s]}=${encodeURIComponent('Оранжевый')}&up=1&JSON=1`);

  // 20. Rename lookup value
  await dual('#20 POST /_m_save (rename lookup)', 'POST',
    s => `/_m_save/${white[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${lookupType[s]}=${encodeURIComponent('Белый (white)')}&JSON=1`);

  // 21. Delete lookup value
  const delItem = await createObj(lookupType, 'ToDeleteColor');
  await dual('#21 POST /_m_del (delete lookup val)', 'POST',
    s => `/_m_del/${delItem[s]}`,
    s => `_xsrf=${getXsrf(s)}&JSON=1`);

  // 22. Verify lookup after CRUD
  await dual('#22 GET /object (lookup after CRUD)', 'GET',
    s => `/object/${lookupType[s]}?JSON=1`);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '11-directories-results.md'), generateMD('11-directories — Справочники & References'));
  writeReports('11-directories', join(dir, '..', 'reports'));
  console.log(`\nWrote 11-directories-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
