#!/usr/bin/env node
/**
 * 10-objects-lifecycle: PHP vs Node.js — Full object lifecycle
 * Based on IntegramDataTableWrapper.vue + IntegramObjectEditor.vue patterns:
 *   _m_new, _m_save, _m_set, _m_del, _m_up, _m_ord, _m_move, _m_id
 *   edit_obj, object list, object count
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, deleteType, deleteObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__obj_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // Setup: main type with columns of different types
  const mainType = await createType(`${PREFIX}main_${TS}`, 3);
  const colText = await addColumn(mainType, 3);    // SHORT text
  const colNum  = await addColumn(mainType, 13);   // NUMBER (13, not 11=BOOLEAN)
  const colDate = await addColumn(mainType, 4);     // DATETIME
  const colBool = await addColumn(mainType, 11);    // BOOLEAN (11, not 7=BUTTON)
  const colLong = await addColumn(mainType, 2);     // LONG text

  // Create seed objects
  const obj1 = await createObj(mainType, 'Alpha');
  const obj2 = await createObj(mainType, 'Beta');
  const obj3 = await createObj(mainType, 'Gamma');
  const obj4 = await createObj(mainType, 'Delta');
  const obj5 = await createObj(mainType, 'Epsilon');

  // ── Create Objects ────────────────────────────────────────────────────────
  section('Objects — Create');

  // 1. Create with value only
  await dual('#1 POST /_m_new (value only)', 'POST',
    s => `/_m_new/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=SimpleObj&up=1&JSON=1`);

  // 2. Create with value + requisite data
  if (colText.php && colText.node) {
    await dual('#2 POST /_m_new (with requisites)', 'POST',
      s => `/_m_new/${mainType[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=WithReqs&t${colText[s]}=hello&t${colNum[s]}=99&up=1&JSON=1`);
  }

  // 3. Create with empty value — val/ord auto-generated (MAX+1), differs on shared DB
  await dual('#3 POST /_m_new (empty)', 'POST',
    s => `/_m_new/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=&up=1&JSON=1`,
    { keysOnly: true });

  // 4. Create with special characters
  await dual('#4 POST /_m_new (special chars)', 'POST',
    s => `/_m_new/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=${encodeURIComponent('Тест <html> & "quotes"')}&up=1&JSON=1`);

  // ── Save/Update Objects ───────────────────────────────────────────────────
  section('Objects — Save/Update');

  // 5. Rename via _m_save
  await dual('#5 POST /_m_save (rename)', 'POST',
    s => `/_m_save/${obj1[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=Alpha_RENAMED&JSON=1`);

  // 6. Save with requisite values
  if (colText.php && colText.node) {
    await dual('#6 POST /_m_save (with reqs)', 'POST',
      s => `/_m_save/${obj2[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=Beta_updated&t${colText[s]}=text_value&t${colNum[s]}=42&JSON=1`);
  }

  // 7. Copy via _m_save copybtn
  await dual('#7 POST /_m_save (copy)', 'POST',
    s => `/_m_save/${obj1[s]}`,
    s => `_xsrf=${getXsrf(s)}&copybtn=1&val=Alpha_COPY&JSON=1`);

  // ── Set Individual Fields ─────────────────────────────────────────────────
  section('Objects — Set Fields (_m_set)');

  // 8. Set text field
  if (colText.php && colText.node) {
    await dual('#8 POST /_m_set (text)', 'POST',
      s => `/_m_set/${obj3[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colText[s]}=gamma_text&JSON=1`);
  }

  // 9. Set number field
  if (colNum.php && colNum.node) {
    await dual('#9 POST /_m_set (number)', 'POST',
      s => `/_m_set/${obj3[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colNum[s]}=123.45&JSON=1`);
  }

  // 10. Set date field
  if (colDate.php && colDate.node) {
    await dual('#10 POST /_m_set (date)', 'POST',
      s => `/_m_set/${obj3[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colDate[s]}=${encodeURIComponent('2025-06-15 10:30:00')}&JSON=1`);
  }

  // 11. Set boolean field
  if (colBool.php && colBool.node) {
    await dual('#11 POST /_m_set (bool true)', 'POST',
      s => `/_m_set/${obj3[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colBool[s]}=1&JSON=1`);
  }

  // 12. Set boolean field to false
  if (colBool.php && colBool.node) {
    await dual('#12 POST /_m_set (bool false)', 'POST',
      s => `/_m_set/${obj3[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colBool[s]}=0&JSON=1`);
  }

  // 13. Set long text field
  if (colLong.php && colLong.node) {
    const longText = 'A'.repeat(500);
    await dual('#13 POST /_m_set (long text)', 'POST',
      s => `/_m_set/${obj4[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colLong[s]}=${encodeURIComponent(longText)}&JSON=1`);
  }

  // 14. Clear field (set empty)
  if (colText.php && colText.node) {
    await dual('#14 POST /_m_set (clear field)', 'POST',
      s => `/_m_set/${obj4[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colText[s]}=&JSON=1`);
  }

  // ── Read Objects ──────────────────────────────────────────────────────────
  section('Objects — Read');

  // 15. Get object list — keysOnly: shared DB creates duplicate columns, values shift
  await dual('#15 GET /object (list)', 'GET',
    s => `/object/${mainType[s]}?JSON=1`, null, { keysOnly: true });

  // 16. Get object list with LIMIT
  await dual('#16 GET /object (LIMIT=2)', 'GET',
    s => `/object/${mainType[s]}?LIMIT=2&JSON=1`);

  // 17. Get object list page 2
  await dual('#17 GET /object (page 2)', 'GET',
    s => `/object/${mainType[s]}?LIMIT=2&pg=2&JSON=1`, null, { keysOnly: true });

  // 18. Get single object (edit_obj) — keysOnly: column order differs on shared DB
  await dual('#18 GET /edit_obj', 'GET',
    s => `/edit_obj/${obj2[s]}?JSON=1`, null, { keysOnly: true });

  // 19. Get object count (LIMIT=0) — keysOnly: same as #15
  await dual('#19 GET /object (count, LIMIT=0)', 'GET',
    s => `/object/${mainType[s]}?LIMIT=0&JSON=1`, null, { keysOnly: true });

  // 20. Get object metadata
  await dual('#20 GET /obj_meta', 'GET',
    s => `/obj_meta/${obj1[s]}?JSON=1`);

  // ── Reorder Objects ───────────────────────────────────────────────────────
  section('Objects — Order');

  // 21. Move up
  await dual('#21 POST /_m_up', 'POST',
    s => `/_m_up/${obj3[s]}`,
    s => `_xsrf=${getXsrf(s)}&JSON=1`);

  // 22. Set order
  await dual('#22 POST /_m_ord (order=1)', 'POST',
    s => `/_m_ord/${obj4[s]}`,
    s => `_xsrf=${getXsrf(s)}&order=1&JSON=1`);

  // 23. Move to root
  await dual('#23 POST /_m_move (to root)', 'POST',
    s => `/_m_move/${obj5[s]}`,
    s => `_xsrf=${getXsrf(s)}&up=1&JSON=1`);

  // ── Change ID ─────────────────────────────────────────────────────────────
  section('Objects — Change ID');

  // 24. Change object ID
  const tempObj = await createObj(mainType, 'ForReID');
  await dual('#24 POST /_m_id (valid)', 'POST',
    s => `/_m_id/${tempObj[s]}`,
    s => `_xsrf=${getXsrf(s)}&new_id=8888${s === 'php' ? '1' : '2'}&JSON=1`);

  // 25. Change to duplicate ID
  await dual('#25 POST /_m_id (duplicate)', 'POST',
    s => `/_m_id/${obj1[s]}`,
    s => `_xsrf=${getXsrf(s)}&new_id=${obj2[s]}&JSON=1`);

  // ── Delete Objects ────────────────────────────────────────────────────────
  section('Objects — Delete');

  // 26. Delete existing object
  const delObj = await createObj(mainType, 'ToDelete');
  await dual('#26 POST /_m_del (existing)', 'POST',
    s => `/_m_del/${delObj[s]}`,
    s => `_xsrf=${getXsrf(s)}&JSON=1`);

  // 27. Delete non-existent
  await dual('#27 POST /_m_del (non-existent)', 'POST',
    '/_m_del/999999999',
    s => `_xsrf=${getXsrf(s)}&JSON=1`);

  // 28. Verify list after deletes — keysOnly: shared DB column diffs
  await dual('#28 GET /object (after delete)', 'GET',
    s => `/object/${mainType[s]}?JSON=1`, null, { keysOnly: true });

  // ── Cleanup ───────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '10-objects-lifecycle-results.md'), generateMD('10-objects-lifecycle — Full Object Lifecycle'));
  writeReports('10-objects-lifecycle', join(dir, '..', 'reports'));
  console.log(`\nWrote 10-objects-lifecycle-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
