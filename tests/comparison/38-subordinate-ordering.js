#!/usr/bin/env node
/**
 * 38-subordinate-ordering: PHP vs Node.js — Subordinate objects & ordering
 * Tests: _m_new with parent (subordinate), _m_up/_m_ord ordering,
 *        F_U filter for children, _m_move to change parent,
 *        nested hierarchy listing
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__subord_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup: parent type with children ───────────────────────────────
  const parentType = await createType(`${PREFIX}folder_${TS}`, 3);
  const colName = await addColumn(parentType, 3);

  // Create parent objects
  const folder1 = await createObj(parentType, 'Папка_А');
  const folder2 = await createObj(parentType, 'Папка_Б');

  // Create children under folder1
  const child1 = await createObj(parentType, 'Файл_01', folder1.php, folder1.node);
  const child2 = await createObj(parentType, 'Файл_02', folder1.php, folder1.node);
  const child3 = await createObj(parentType, 'Файл_03', folder1.php, folder1.node);

  // Create children under folder2
  const child4 = await createObj(parentType, 'Файл_04', folder2.php, folder2.node);
  const child5 = await createObj(parentType, 'Файл_05', folder2.php, folder2.node);

  // ── F_U filter for children ──────────────────────────────────────────
  section('Subordinate — F_U filter');

  // 1. List children of folder1
  if (folder1.php && folder1.node) {
    await dual('#1 GET /object (F_U=folder1)', 'GET',
      s => `/object/${parentType[s]}?F_U=${folder1[s]}&JSON=1`, null, { keysOnly: true });
  }

  // 2. List children of folder2
  if (folder2.php && folder2.node) {
    await dual('#2 GET /object (F_U=folder2)', 'GET',
      s => `/object/${parentType[s]}?F_U=${folder2[s]}&JSON=1`, null, { keysOnly: true });
  }

  // 3. List root level only (F_U=1)
  await dual('#3 GET /object (F_U=1 root)', 'GET',
    s => `/object/${parentType[s]}?F_U=1&JSON=1`, null, { keysOnly: true });

  // 4. List all (no F_U)
  await dual('#4 GET /object (no F_U, all)', 'GET',
    s => `/object/${parentType[s]}?JSON=1`);

  // ── Object ordering ──────────────────────────────────────────────────
  section('Ordering — _m_up');

  // 5. Move child3 up
  if (child3.php && child3.node) {
    await dual('#5 POST /_m_up (move child3 up)', 'POST',
      s => `/_m_up/${child3[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { keysOnly: true });
  }

  // 6. Verify order after move up
  if (folder1.php && folder1.node) {
    await dual('#6 GET /object (after _m_up)', 'GET',
      s => `/object/${parentType[s]}?F_U=${folder1[s]}&JSON=1`, null, { keysOnly: true });
  }

  // ── _m_ord: set specific order ───────────────────────────────────────
  section('Ordering — _m_ord');

  // 7. Set order value on child1
  if (child1.php && child1.node) {
    await dual('#7 POST /_m_ord (set order=5)', 'POST',
      s => `/_m_ord/${child1[s]}`,
      s => `_xsrf=${getXsrf(s)}&ord=5&JSON=1`, { keysOnly: true });
  }

  // 8. Verify order after _m_ord
  if (folder1.php && folder1.node) {
    await dual('#8 GET /object (after _m_ord)', 'GET',
      s => `/object/${parentType[s]}?F_U=${folder1[s]}&JSON=1`, null, { keysOnly: true });
  }

  // ── _m_move: change parent ───────────────────────────────────────────
  section('Move — _m_move');

  // 9. Move child1 from folder1 to folder2
  if (child1.php && child1.node && folder2.php && folder2.node) {
    await dual('#9 POST /_m_move (folder1→folder2)', 'POST',
      s => `/_m_move/${child1[s]}`,
      s => `_xsrf=${getXsrf(s)}&up=${folder2[s]}&JSON=1`, { keysOnly: true });
  }

  // 10. Verify folder1 children (should be 2 now)
  if (folder1.php && folder1.node) {
    await dual('#10 GET /object (folder1 after move)', 'GET',
      s => `/object/${parentType[s]}?F_U=${folder1[s]}&JSON=1`, null, { keysOnly: true });
  }

  // 11. Verify folder2 children (should be 3 now)
  if (folder2.php && folder2.node) {
    await dual('#11 GET /object (folder2 after move)', 'GET',
      s => `/object/${parentType[s]}?F_U=${folder2[s]}&JSON=1`, null, { keysOnly: true });
  }

  // ── _m_move: move to root ────────────────────────────────────────────
  section('Move — To root');

  // 12. Move child4 to root (up=1)
  if (child4.php && child4.node) {
    await dual('#12 POST /_m_move (to root)', 'POST',
      s => `/_m_move/${child4[s]}`,
      s => `_xsrf=${getXsrf(s)}&up=1&JSON=1`, { keysOnly: true });
  }

  // 13. Verify root level (should include child4)
  await dual('#13 GET /object (root after move)', 'GET',
    s => `/object/${parentType[s]}?F_U=1&JSON=1`, null, { keysOnly: true });

  // ── Edit obj shows parent ────────────────────────────────────────────
  section('Edit — Parent info');

  // 14. edit_obj for child still in folder
  if (child2.php && child2.node) {
    await dual('#14 GET /edit_obj (child in folder)', 'GET',
      s => `/edit_obj/${child2[s]}?JSON=1`, null, { keysOnly: true });
  }

  // 15. edit_obj for object at root
  if (child4.php && child4.node) {
    await dual('#15 GET /edit_obj (object at root)', 'GET',
      s => `/edit_obj/${child4[s]}?JSON=1`, null, { keysOnly: true });
  }

  // ── Delete parent with children ──────────────────────────────────────
  section('Delete — Parent with children');

  // 16. Try deleting folder1 (has children) — should work, children orphaned
  if (folder1.php && folder1.node) {
    await dual('#16 POST /_m_del (folder with children)', 'POST',
      s => `/_m_del/${folder1[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });
  }

  // ── Cleanup ────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '38-subordinate-ordering-results.md'), generateMD('38-subordinate-ordering — Subordinate Objects & Ordering'));
  writeReports('38-subordinate-ordering', join(dir, '..', 'reports'));
  console.log(`\nWrote 38-subordinate-ordering-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
