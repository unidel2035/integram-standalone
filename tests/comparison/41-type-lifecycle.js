#!/usr/bin/env node
/**
 * 41-type-lifecycle: PHP vs Node.js — Full type lifecycle
 * Tests: create type → add columns → rename type → rename columns →
 *        set attrs (NOT NULL, MULTI) → delete columns → delete type →
 *        verify cleanup in /terms and /edit_types
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__typelc_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Create type ──────────────────────────────────────────────────────
  section('Type Lifecycle — Create');

  // 1. Create type
  const mainType = await createType(`${PREFIX}doc_${TS}`, 3);
  await dual('#1 GET /terms (after create)', 'GET',
    '/terms?JSON=1');

  // 2. Add SHORT column
  const col1 = await addColumn(mainType, 3);
  await dual('#2 GET /metadata (after SHORT col)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // 3. Add NUMBER column
  const col2 = await addColumn(mainType, 13);
  await dual('#3 GET /metadata (after NUMBER col)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // 4. Add DATETIME column
  const col3 = await addColumn(mainType, 4);
  await dual('#4 GET /metadata (after DATETIME col)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // 5. Add ref column
  const lookupType = await createType(`${PREFIX}lookup_${TS}`, 3);
  await createObj(lookupType, 'OptionA');
  await createObj(lookupType, 'OptionB');
  const colRef = await addRefColumn(mainType, lookupType);
  await dual('#5 GET /metadata (after REF col)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // ── Rename ───────────────────────────────────────────────────────────
  section('Type Lifecycle — Rename');

  // 6. Rename type via _d_save
  await dual('#6 POST /_d_save (rename type)', 'POST',
    s => `/_d_save/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&val=${encodeURIComponent(`${PREFIX}renamed_${TS}`)}&JSON=1`, { keysOnly: true });

  // 7. Rename column via _d_alias
  if (col1.php && col1.node) {
    await dual('#7 POST /_d_alias (rename col1)', 'POST',
      s => `/_d_alias/${col1[s]}`,
      s => `_xsrf=${getXsrf(s)}&val=${encodeURIComponent('Название_поля')}&JSON=1`, { keysOnly: true });
  }

  // 8. Verify renames
  await dual('#8 GET /metadata (after renames)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // ── Column modifiers ─────────────────────────────────────────────────
  section('Type Lifecycle — Modifiers');

  // 9. Set NOT NULL on col1
  if (col1.php && col1.node) {
    await dual('#9 POST /_d_null (set NOT NULL)', 'POST',
      s => `/_d_null/${col1[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // 10. Set MULTI on ref column
  if (colRef.php && colRef.node) {
    await dual('#10 POST /_d_multi (set MULTI)', 'POST',
      s => `/_d_multi/${colRef[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // 11. Verify modifiers in metadata
  await dual('#11 GET /metadata (after modifiers)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // 12. Remove NOT NULL
  if (col1.php && col1.node) {
    await dual('#12 POST /_d_null (remove NOT NULL)', 'POST',
      s => `/_d_null/${col1[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // ── Column reorder ───────────────────────────────────────────────────
  section('Type Lifecycle — Reorder');

  // 13. Move col2 up
  if (col2.php && col2.node) {
    await dual('#13 POST /_d_up (move col2 up)', 'POST',
      s => `/_d_up/${col2[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { keysOnly: true });
  }

  // 14. Verify order
  await dual('#14 GET /metadata (after reorder)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // ── Delete columns ───────────────────────────────────────────────────
  section('Type Lifecycle — Delete cols');

  // 15. Delete col3 (DATETIME)
  if (col3.php && col3.node) {
    await dual('#15 POST /_d_del_req (delete DATETIME)', 'POST',
      s => `/_d_del_req/${col3[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { keysOnly: true });
  }

  // 16. Verify column deleted
  await dual('#16 GET /metadata (after del col)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // ── Delete type ──────────────────────────────────────────────────────
  section('Type Lifecycle — Delete type');

  // 17. Delete type (forced)
  await dual('#17 POST /_d_del (forced)', 'POST',
    s => `/_d_del/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&forced=1&JSON=1`, { keysOnly: true });

  // 18. Verify type gone from terms
  await dual('#18 GET /terms (after delete)', 'GET',
    '/terms?JSON=1');

  // 19. Verify type gone from edit_types
  await dual('#19 GET /edit_types (after delete)', 'GET',
    '/edit_types?JSON=1', null, { keysOnly: true });

  // ── Cleanup ────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '41-type-lifecycle-results.md'), generateMD('41-type-lifecycle — Full Type Lifecycle'));
  writeReports('41-type-lifecycle', join(dir, '..', 'reports'));
  console.log(`\nWrote 41-type-lifecycle-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
