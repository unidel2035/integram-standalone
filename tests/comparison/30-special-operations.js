#!/usr/bin/env node
/**
 * 30-special-operations: PHP vs Node.js — Misc special operations
 * Tests: uniqueness constraint, NOT NULL constraint, type rename (_d_save),
 *        object rename (_m_save val), delete with refs (should fail),
 *        metadata endpoint variants, dict endpoint
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__specop_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup ──────────────────────────────────────────────────────────────
  const mainType = await createType(`${PREFIX}item_${TS}`, 3);
  const colName = await addColumn(mainType, 3);
  const colNum = await addColumn(mainType, 13);

  // ── Type rename via _d_save ────────────────────────────────────────────
  section('Special Ops — _d_save (rename type)');

  // 1. Rename type
  await dual('#1 POST /_d_save (rename type)', 'POST',
    s => `/_d_save/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&val=${encodeURIComponent(`${PREFIX}renamed_${TS}`)}&JSON=1`, { keysOnly: true });

  // 2. Verify in edit_types
  await dual('#2 GET /edit_types (after rename)', 'GET',
    '/edit_types?JSON=1', null, { keysOnly: true });

  // ── NOT NULL constraint ────────────────────────────────────────────────
  section('Special Ops — NOT NULL');

  // 3. Set NOT NULL on name column
  if (colName.php && colName.node) {
    await dual('#3 POST /_d_null (set NOT NULL)', 'POST',
      s => `/_d_null/${colName[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // 4. Try creating object with empty name (should fail if NOT NULL enforced)
  await dual('#4 POST /_m_new (empty with NOT NULL)', 'POST',
    s => `/_m_new/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=&up=1&JSON=1`, { statusOnly: true });

  // 5. Create object with value (should succeed)
  const obj1 = await createObj(mainType, 'Valid_Item');

  // 6. Remove NOT NULL
  if (colName.php && colName.node) {
    await dual('#6 POST /_d_null (remove NOT NULL)', 'POST',
      s => `/_d_null/${colName[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // ── Object rename via _m_save ──────────────────────────────────────────
  section('Special Ops — Object rename');

  // 7. Rename object via _m_save (change val)
  if (obj1.php && obj1.node) {
    await dual('#7 POST /_m_save (rename object)', 'POST',
      s => `/_m_save/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=${encodeURIComponent('Переименованный')}&JSON=1`, { keysOnly: true });
  }

  // 8. Verify rename
  if (obj1.php && obj1.node) {
    await dual('#8 GET /edit_obj (after rename)', 'GET',
      s => `/edit_obj/${obj1[s]}?JSON=1`, null, { keysOnly: true });
  }

  // ── Delete with references (should fail) ───────────────────────────────
  section('Special Ops — Delete with refs');

  // Create ref target and referencing object
  const targetType = await createType(`${PREFIX}target_${TS}`, 3);
  const target1 = await createObj(targetType, 'Target1');

  const refType = await createType(`${PREFIX}ref_${TS}`, 3);
  const colRef = await addRefColumn(refType, targetType);
  const refObj = await createObj(refType, 'Referrer');

  // Set reference
  if (refObj.php && refObj.node && colRef.php && colRef.node && target1.php && target1.node) {
    await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_set/${refObj.php}`, `_xsrf=${getXsrf('php')}&t${colRef.php}=${target1.php}&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_m_set/${refObj.node}`, `_xsrf=${getXsrf('node')}&t${colRef.node}=${target1.node}&JSON=1`, cookie()),
    ]);
  }

  // 9. Try deleting referenced target (should fail with "has links")
  if (target1.php && target1.node) {
    await dual('#9 POST /_m_del (referenced object)', 'POST',
      s => `/_m_del/${target1[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });
  }

  // ── Metadata variants ──────────────────────────────────────────────────
  section('Special Ops — Metadata');

  // 10. metadata for main type
  await dual('#10 GET /metadata (main type)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // 11. metadata JSON_KV
  await dual('#11 GET /metadata (JSON_KV)', 'GET',
    s => `/metadata/${mainType[s]}?JSON_KV=1`, null, { keysOnly: true });

  // 12. obj_meta for specific object
  if (obj1.php && obj1.node) {
    await dual('#12 GET /obj_meta (object)', 'GET',
      s => `/obj_meta/${obj1[s]}?JSON=1`, null, { statusOnly: true });
  }

  // ── Type delete ────────────────────────────────────────────────────────
  section('Special Ops — Type delete');

  // 13. Delete empty type (no objects)
  const emptyType = await createType(`${PREFIX}empty_${TS}`, 3);
  await dual('#13 POST /_d_del (empty type)', 'POST',
    s => `/_d_del/${emptyType[s]}`,
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { keysOnly: true });

  // 14. Delete type with objects (forced)
  const typeWithObj = await createType(`${PREFIX}hasobj_${TS}`, 3);
  await createObj(typeWithObj, 'WillBeDeleted');
  await dual('#14 POST /_d_del (type with objects, forced)', 'POST',
    s => `/_d_del/${typeWithObj[s]}`,
    s => `_xsrf=${getXsrf(s)}&forced=1&JSON=1`, { keysOnly: true });

  // 15. Verify deleted types not in edit_types
  await dual('#15 GET /edit_types (after deletes)', 'GET',
    '/edit_types?JSON=1', null, { keysOnly: true });

  // ── Cleanup ────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '30-special-operations-results.md'), generateMD('30-special-operations — Misc Special Operations'));
  writeReports('30-special-operations', join(dir, '..', 'reports'));
  console.log(`\nWrote 30-special-operations-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
