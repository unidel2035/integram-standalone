#!/usr/bin/env node
/**
 * 23-inline-editing: PHP vs Node.js — Inline field editing via _m_save/_m_set
 * Tests: editing multiple field types (SHORT, NUMBER, DATETIME, BOOLEAN, REF),
 *        partial updates, empty/null values, special characters, long text
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__ined_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup ──────────────────────────────────────────────────────────────
  const mainType = await createType(`${PREFIX}rec_${TS}`, 3);
  const colShort = await addColumn(mainType, 3);    // SHORT
  const colNum = await addColumn(mainType, 13);      // NUMBER
  const colDate = await addColumn(mainType, 4);      // DATETIME
  const colBool = await addColumn(mainType, 11);     // BOOLEAN
  const colMemo = await addColumn(mainType, 2);      // LONG/MEMO

  // Lookup type for reference
  const lookupType = await createType(`${PREFIX}cat_${TS}`, 3);
  const catA = await createObj(lookupType, 'КатегорияА');
  const catB = await createObj(lookupType, 'КатегорияБ');
  const colRef = await addRefColumn(mainType, lookupType);

  // Create test objects
  const obj1 = await createObj(mainType, 'Запись_1');
  const obj2 = await createObj(mainType, 'Запись_2');
  const obj3 = await createObj(mainType, 'Запись_3');

  // ── _m_set: Single field updates ───────────────────────────────────────
  section('Inline Editing — _m_set (single field)');

  // 1. Set SHORT field
  if (obj1.php && obj1.node && colShort.php && colShort.node) {
    await dual('#1 POST /_m_set (set SHORT)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colShort[s]}=${encodeURIComponent('Новое значение')}&JSON=1`, { keysOnly: true });
  }

  // 2. Set NUMBER field
  if (obj1.php && obj1.node && colNum.php && colNum.node) {
    await dual('#2 POST /_m_set (set NUMBER)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colNum[s]}=42.5&JSON=1`, { keysOnly: true });
  }

  // 3. Set DATETIME field
  if (obj1.php && obj1.node && colDate.php && colDate.node) {
    await dual('#3 POST /_m_set (set DATETIME)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colDate[s]}=${encodeURIComponent('2025-06-15 14:30:00')}&JSON=1`, { keysOnly: true });
  }

  // 4. Set BOOLEAN field (true)
  if (obj1.php && obj1.node && colBool.php && colBool.node) {
    await dual('#4 POST /_m_set (set BOOL true)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colBool[s]}=1&JSON=1`, { keysOnly: true });
  }

  // 5. Set reference field
  if (obj1.php && obj1.node && colRef.php && colRef.node && catA.php && catA.node) {
    await dual('#5 POST /_m_set (set REF)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colRef[s]}=${catA[s]}&JSON=1`, { keysOnly: true });
  }

  // 6. Verify all fields via edit_obj
  if (obj1.php && obj1.node) {
    await dual('#6 GET /edit_obj (after set all fields)', 'GET',
      s => `/edit_obj/${obj1[s]}?JSON=1`, null, { keysOnly: true });
  }

  // ── _m_save: Multi-field update ────────────────────────────────────────
  section('Inline Editing — _m_save (multi-field)');

  // 7. Update name + number + bool via _m_save
  if (obj2.php && obj2.node && colShort.php && colShort.node && colNum.php && colNum.node && colBool.php && colBool.node) {
    await dual('#7 POST /_m_save (multi-field)', 'POST',
      s => `/_m_save/${obj2[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=${encodeURIComponent('Запись_2_Обновлена')}&t${colShort[s]}=${encodeURIComponent('Краткое')}&t${colNum[s]}=100&t${colBool[s]}=1&JSON=1`, { keysOnly: true });
  }

  // 8. Verify multi-field update
  if (obj2.php && obj2.node) {
    await dual('#8 GET /edit_obj (after multi-field)', 'GET',
      s => `/edit_obj/${obj2[s]}?JSON=1`, null, { keysOnly: true });
  }

  // ── Edge cases ─────────────────────────────────────────────────────────
  section('Inline Editing — Edge Cases');

  // 9. Set empty string
  if (obj1.php && obj1.node && colShort.php && colShort.node) {
    await dual('#9 POST /_m_set (empty string)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colShort[s]}=&JSON=1`, { keysOnly: true });
  }

  // 10. Set BOOLEAN to false (0)
  if (obj1.php && obj1.node && colBool.php && colBool.node) {
    await dual('#10 POST /_m_set (BOOL false)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colBool[s]}=0&JSON=1`, { keysOnly: true });
  }

  // 11. Set NUMBER to 0
  if (obj1.php && obj1.node && colNum.php && colNum.node) {
    await dual('#11 POST /_m_set (NUMBER=0)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colNum[s]}=0&JSON=1`, { keysOnly: true });
  }

  // 12. Set NUMBER to negative
  if (obj2.php && obj2.node && colNum.php && colNum.node) {
    await dual('#12 POST /_m_set (NUMBER negative)', 'POST',
      s => `/_m_set/${obj2[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colNum[s]}=-15.7&JSON=1`, { keysOnly: true });
  }

  // 13. Special characters in SHORT
  if (obj3.php && obj3.node && colShort.php && colShort.node) {
    await dual('#13 POST /_m_set (special chars)', 'POST',
      s => `/_m_set/${obj3[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colShort[s]}=${encodeURIComponent('<script>alert("xss")</script> & "quotes" \'single\'')}&JSON=1`, { keysOnly: true });
  }

  // 14. Long MEMO text
  if (obj3.php && obj3.node && colMemo.php && colMemo.node) {
    const longText = 'Длинный текст. '.repeat(50);
    await dual('#14 POST /_m_set (long MEMO)', 'POST',
      s => `/_m_set/${obj3[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colMemo[s]}=${encodeURIComponent(longText)}&JSON=1`, { keysOnly: true });
  }

  // 15. Change reference to different value
  if (obj1.php && obj1.node && colRef.php && colRef.node && catB.php && catB.node) {
    await dual('#15 POST /_m_set (change REF)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colRef[s]}=${catB[s]}&JSON=1`, { keysOnly: true });
  }

  // 16. Clear reference (set to 0)
  if (obj1.php && obj1.node && colRef.php && colRef.node) {
    await dual('#16 POST /_m_set (clear REF)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colRef[s]}=0&JSON=1`, { keysOnly: true });
  }

  // ── Verify final state ─────────────────────────────────────────────────
  section('Inline Editing — Final State');

  // 17. Object listing with all data
  await dual('#17 GET /object (final listing)', 'GET',
    s => `/object/${mainType[s]}?JSON=1`);

  // 18. edit_obj for obj3 (has special chars)
  if (obj3.php && obj3.node) {
    await dual('#18 GET /edit_obj (special chars obj)', 'GET',
      s => `/edit_obj/${obj3[s]}?JSON=1`, null, { keysOnly: true });
  }

  // ── Cleanup ────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '23-inline-editing-results.md'), generateMD('23-inline-editing — Inline Field Editing'));
  writeReports('23-inline-editing', join(dir, '..', 'reports'));
  console.log(`\nWrote 23-inline-editing-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
