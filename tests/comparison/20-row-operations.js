#!/usr/bin/env node
/**
 * 20-row-operations: PHP vs Node.js — Row ordering, moving, ID change
 * Tests: _m_up (move up), _m_ord (set order), _m_id (change ID),
 *        _m_move (move to new parent), _m_del edge cases
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__rowop_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup: parent type with objects ─────────────────────────────────────
  const parentType = await createType(`${PREFIX}items_${TS}`, 3);
  const colName = await addColumn(parentType, 3);

  // Create 5 objects to work with
  const obj1 = await createObj(parentType, 'Item_A');
  const obj2 = await createObj(parentType, 'Item_B');
  const obj3 = await createObj(parentType, 'Item_C');
  const obj4 = await createObj(parentType, 'Item_D');
  const obj5 = await createObj(parentType, 'Item_E');

  // ── _m_up: Move object up ─────────────────────────────────────────────
  section('Row Operations — _m_up (move up)');

  // 1. Move obj3 up (swap with obj2)
  if (obj3.php && obj3.node) {
    await dual('#1 POST /_m_up (move Item_C up)', 'POST',
      s => `/_m_up/${obj3[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { keysOnly: true });
  }

  // 2. Verify order after move
  await dual('#2 GET /object (after move up)', 'GET',
    s => `/object/${parentType[s]}?JSON=1`);

  // 3. Move obj1 up (already at top — should be no-op)
  if (obj1.php && obj1.node) {
    await dual('#3 POST /_m_up (already at top)', 'POST',
      s => `/_m_up/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { keysOnly: true });
  }

  // ── _m_ord: Set order ─────────────────────────────────────────────────
  section('Row Operations — _m_ord (set order)');

  // 4. Move obj5 to position 1
  if (obj5.php && obj5.node) {
    await dual('#4 POST /_m_ord (move to pos 1)', 'POST',
      s => `/_m_ord/${obj5[s]}?JSON=1&order=1`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // 5. Verify order after _m_ord
  await dual('#5 GET /object (after _m_ord)', 'GET',
    s => `/object/${parentType[s]}?JSON=1`);

  // 6. _m_ord with invalid order (0)
  if (obj4.php && obj4.node) {
    await dual('#6 POST /_m_ord (invalid order=0)', 'POST',
      s => `/_m_ord/${obj4[s]}?JSON=1&order=0`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });
  }

  // 7. _m_ord with invalid order (negative)
  if (obj4.php && obj4.node) {
    await dual('#7 POST /_m_ord (invalid order=-1)', 'POST',
      s => `/_m_ord/${obj4[s]}?JSON=1&order=-1`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });
  }

  // ── _m_id: Change object ID ───────────────────────────────────────────
  section('Row Operations — _m_id (change ID)');

  // 8. Change ID to a very high number
  const newId = 99000000 + Math.floor(Math.random() * 900000);
  if (obj4.php && obj4.node) {
    await dual('#8 POST /_m_id (change ID)', 'POST',
      s => `/_m_id/${obj4[s]}?JSON=1&new_id=${newId + (s === 'php' ? 0 : 1)}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { keysOnly: true });
  }

  // 9. Try changing to occupied ID (should fail)
  if (obj1.php && obj1.node && obj2.php && obj2.node) {
    await dual('#9 POST /_m_id (occupied ID)', 'POST',
      s => `/_m_id/${obj1[s]}?JSON=1&new_id=${obj2[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });
  }

  // 10. Try changing to metadata ID (should fail — id with up=0)
  if (obj1.php && obj1.node) {
    await dual('#10 POST /_m_id (metadata ID)', 'POST',
      s => `/_m_id/${obj1[s]}?JSON=1&new_id=1`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });
  }

  // ── _m_del: Delete edge cases ─────────────────────────────────────────
  section('Row Operations — _m_del (delete)');

  // 11. Delete obj5
  if (obj5.php && obj5.node) {
    await dual('#11 POST /_m_del (delete obj5)', 'POST',
      s => `/_m_del/${obj5[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { keysOnly: true });
  }

  // 12. Verify listing after delete
  await dual('#12 GET /object (after delete)', 'GET',
    s => `/object/${parentType[s]}?JSON=1`);

  // 13. Delete non-existent object
  await dual('#13 POST /_m_del (non-existent)', 'POST',
    '/_m_del/999999999',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // 14. Delete with id=0
  await dual('#14 POST /_m_del (id=0)', 'POST',
    '/_m_del/0',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // ── _m_move: Move between parents ─────────────────────────────────────
  section('Row Operations — _m_move');

  // Create a second parent type (same base) to move objects to
  const parentType2 = await createType(`${PREFIX}dest_${TS}`, 3);
  await addColumn(parentType2, 3);

  // Create objects in parentType2 — we need the parent itself, not just the type.
  // _m_move needs a parent object of the SAME type.
  // Let's create a subordinate type and objects under different parents.
  const subType = await createType(`${PREFIX}sub_${TS}`, 3, s => `&up=${parentType[s]}`);
  const subCol = await addColumn(subType, 3);

  // Create parent objects in parentType
  const parentObj1 = await createObj(parentType, 'Parent1');
  const parentObj2 = await createObj(parentType, 'Parent2');

  // Create child objects under parentObj1 (if subordinate type was created)
  if (subType.php && subType.node && parentObj1.php && parentObj1.node) {
    const child1 = await createObj(subType, 'Child1', parentObj1.php, parentObj1.node);
    const child2 = await createObj(subType, 'Child2', parentObj1.php, parentObj1.node);

    // 15. Move child2 from parentObj1 to parentObj2
    if (child2.php && child2.node && parentObj2.php && parentObj2.node) {
      await dual('#15 POST /_m_move (move child)', 'POST',
        s => `/_m_move/${child2[s]}`,
        s => `_xsrf=${getXsrf(s)}&up=${parentObj2[s]}&JSON=1`, { keysOnly: true });
    }

    // 16. List children of parentObj1 (should have child1 only)
    await dual('#16 GET /object (src parent after move)', 'GET',
      s => `/object/${subType[s]}?F_U=${parentObj1[s]}&JSON=1`);

    // 17. List children of parentObj2 (should have child2)
    await dual('#17 GET /object (dest parent after move)', 'GET',
      s => `/object/${subType[s]}?F_U=${parentObj2[s]}&JSON=1`);
  }

  // 18. _m_move with invalid id
  await dual('#18 POST /_m_move (id=0)', 'POST',
    '/_m_move/0',
    s => `_xsrf=${getXsrf(s)}&up=1&JSON=1`, { statusOnly: true });

  // ── Cleanup ─────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '20-row-operations-results.md'), generateMD('20-row-operations — Row Ordering, Moving, ID Change'));
  writeReports('20-row-operations', join(dir, '..', 'reports'));
  console.log(`\nWrote 20-row-operations-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
