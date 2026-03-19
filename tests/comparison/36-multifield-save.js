#!/usr/bin/env node
/**
 * 36-multifield-save: PHP vs Node.js — _m_save multi-field, _m_new with fields,
 *                      copy object patterns, _m_set with multiple fields at once
 * Tests patterns used by dronedoc2025: save whole form, create with defaults,
 *        edit_obj after multi-field save, JSON_KV listing after changes
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__mfsave_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup ──────────────────────────────────────────────────────────
  const mainType = await createType(`${PREFIX}doc_${TS}`, 3);
  const colTitle = await addColumn(mainType, 3);   // SHORT
  const colDesc = await addColumn(mainType, 2);    // LONG (memo)
  const colNum = await addColumn(mainType, 13);    // NUMBER
  const colDt = await addColumn(mainType, 4);      // DATETIME

  const lookupType = await createType(`${PREFIX}status_${TS}`, 3);
  const st1 = await createObj(lookupType, 'Черновик');
  const st2 = await createObj(lookupType, 'Активен');
  const colStatus = await addRefColumn(mainType, lookupType);

  // ── _m_save: multi-field at once ─────────────────────────────────────
  section('Multi-field Save');

  // 1. Create object, then _m_save with ALL fields
  const obj1 = await createObj(mainType, 'Документ_1');
  if (obj1.php && obj1.node && colTitle.php && colTitle.node) {
    await dual('#1 POST /_m_save (all fields)', 'POST',
      s => `/_m_save/${obj1[s]}`,
      s => {
        const parts = [`_xsrf=${getXsrf(s)}`];
        parts.push(`t${mainType[s]}=${encodeURIComponent('Обновлённый_Док')}`);
        parts.push(`t${colTitle[s]}=${encodeURIComponent('Заголовок')}`);
        parts.push(`t${colDesc[s]}=${encodeURIComponent('Описание документа с кириллицей')}`);
        parts.push(`t${colNum[s]}=500`);
        parts.push(`t${colDt[s]}=${encodeURIComponent('2025-07-01 10:00:00')}`);
        parts.push('JSON=1');
        return parts.join('&');
      }, { keysOnly: true });
  }

  // 2. Verify via edit_obj
  if (obj1.php && obj1.node) {
    await dual('#2 GET /edit_obj (after multi-save)', 'GET',
      s => `/edit_obj/${obj1[s]}?JSON=1`, null, { keysOnly: true });
  }

  // 3. Update only some fields (partial save)
  if (obj1.php && obj1.node && colNum.php && colNum.node) {
    await dual('#3 POST /_m_save (partial update)', 'POST',
      s => `/_m_save/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colNum[s]}=999&JSON=1`, { keysOnly: true });
  }

  // 4. Verify partial save kept other fields
  if (obj1.php && obj1.node) {
    await dual('#4 GET /edit_obj (after partial save)', 'GET',
      s => `/edit_obj/${obj1[s]}?JSON=1`, null, { keysOnly: true });
  }

  // ── _m_save: clear fields ────────────────────────────────────────────
  section('Multi-field Save — Clear');

  // 5. Clear number field
  if (obj1.php && obj1.node && colNum.php && colNum.node) {
    await dual('#5 POST /_m_save (clear number)', 'POST',
      s => `/_m_save/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colNum[s]}=&JSON=1`, { keysOnly: true });
  }

  // 6. Clear ref field via _m_set (direct single-field)
  if (obj1.php && obj1.node && colStatus.php && colStatus.node) {
    await dual('#6 POST /_m_set (clear ref to 0)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colStatus[s]}=0&JSON=1`, { keysOnly: true });
  }

  // 7. Verify clears
  if (obj1.php && obj1.node) {
    await dual('#7 GET /edit_obj (after clears)', 'GET',
      s => `/edit_obj/${obj1[s]}?JSON=1`, null, { keysOnly: true });
  }

  // ── _m_save: change ref ──────────────────────────────────────────────
  section('Multi-field Save — Change ref');

  // 8. Set ref via _m_set
  if (obj1.php && obj1.node && colStatus.php && colStatus.node && st2.php && st2.node) {
    await dual('#8 POST /_m_set (set ref)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colStatus[s]}=${st2[s]}&JSON=1`, { keysOnly: true });
  }

  // 9. Change ref to different value via _m_set
  if (obj1.php && obj1.node && colStatus.php && colStatus.node && st1.php && st1.node) {
    await dual('#9 POST /_m_set (change ref)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colStatus[s]}=${st1[s]}&JSON=1`, { keysOnly: true });
  }

  // ── Create with name containing special patterns ─────────────────────
  section('Create — Special names');

  // 10. Create with HTML-like name
  await dual('#10 POST /_m_new (HTML name)', 'POST',
    s => `/_m_new/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=${encodeURIComponent('<b>Bold</b>')}&up=1&JSON=1`, { keysOnly: true });

  // 11. Create with quotes
  await dual('#11 POST /_m_new (quotes)', 'POST',
    s => `/_m_new/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=${encodeURIComponent('He said "hello" & \'bye\'')}&up=1&JSON=1`, { keysOnly: true });

  // 12. Create with newlines in name — PHP may return non-JSON
  await dual('#12 POST /_m_new (newlines)', 'POST',
    s => `/_m_new/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=${encodeURIComponent('Line1\nLine2')}&up=1&JSON=1`, { statusOnly: true });

  // ── JSON_KV listing after changes ────────────────────────────────────
  section('Listing — After changes');

  // 13. JSON_KV listing
  await dual('#13 GET /object (JSON_KV)', 'GET',
    s => `/object/${mainType[s]}?JSON_KV=1`, null, { keysOnly: true });

  // 14. JSON_DATA listing — shared DB may produce different object counts
  await dual('#14 GET /object (JSON_DATA)', 'GET',
    s => `/object/${mainType[s]}?JSON_DATA=1`, null, { statusOnly: true });

  // 15. JSON_CR listing
  await dual('#15 GET /object (JSON_CR)', 'GET',
    s => `/object/${mainType[s]}?JSON_CR=1`, null, { keysOnly: true });

  // ── Cleanup ────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '36-multifield-save-results.md'), generateMD('36-multifield-save — Multi-field Save & Create'));
  writeReports('36-multifield-save', join(dir, '..', 'reports'));
  console.log(`\nWrote 36-multifield-save-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
