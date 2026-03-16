#!/usr/bin/env node
/**
 * 18-column-metadata: PHP vs Node.js — Column metadata operations
 * DataTable header management patterns:
 *   _d_alias (rename), _d_null (NOT NULL), _d_multi (multiselect),
 *   _d_ord (reorder), _d_up (move up), _d_attrs (attributes),
 *   _d_del_req (delete column)
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__colm_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup ───────────────────────────────────────────────────────────────
  const mainType = await createType(`${PREFIX}tasks_${TS}`, 3);
  const col1 = await addColumn(mainType, 3);   // SHORT
  const col2 = await addColumn(mainType, 2);   // LONG/MEMO
  const col3 = await addColumn(mainType, 13);  // NUMBER
  const col4 = await addColumn(mainType, 4);   // DATETIME
  const col5 = await addColumn(mainType, 11);  // BOOLEAN

  // Lookup type for reference column
  const lookupType = await createType(`${PREFIX}status_${TS}`, 3);
  await createObj(lookupType, 'Активен');
  await createObj(lookupType, 'Неактивен');
  const col6 = await addRefColumn(mainType, lookupType);

  // ── _d_alias: Rename column ─────────────────────────────────────────────
  section('Column Metadata — _d_alias (rename)');

  // 1. Set alias on SHORT column
  if (col1.php && col1.node) {
    await dual('#1 POST /_d_alias (set alias)', 'POST',
      s => `/_d_alias/${col1[s]}`,
      s => `_xsrf=${getXsrf(s)}&val=${encodeURIComponent('Название задачи')}&JSON=1`);
  }

  // 2. Set alias on NUMBER column
  if (col3.php && col3.node) {
    await dual('#2 POST /_d_alias (number alias)', 'POST',
      s => `/_d_alias/${col3[s]}`,
      s => `_xsrf=${getXsrf(s)}&val=${encodeURIComponent('Стоимость')}&JSON=1`);
  }

  // 3. Clear alias
  if (col1.php && col1.node) {
    await dual('#3 POST /_d_alias (clear alias)', 'POST',
      s => `/_d_alias/${col1[s]}`,
      s => `_xsrf=${getXsrf(s)}&val=&JSON=1`);
  }

  // 4. Set alias again (for later metadata check)
  if (col1.php && col1.node) {
    await dual('#4 POST /_d_alias (set again)', 'POST',
      s => `/_d_alias/${col1[s]}`,
      s => `_xsrf=${getXsrf(s)}&val=${encodeURIComponent('Title')}&JSON=1`);
  }

  // ── _d_null: Toggle NOT NULL ────────────────────────────────────────────
  section('Column Metadata — _d_null (NOT NULL)');

  // 5. Set NOT NULL on SHORT column
  if (col1.php && col1.node) {
    await dual('#5 POST /_d_null (set NOT NULL)', 'POST',
      s => `/_d_null/${col1[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // 6. Toggle NOT NULL off
  if (col1.php && col1.node) {
    await dual('#6 POST /_d_null (toggle off)', 'POST',
      s => `/_d_null/${col1[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // ── _d_multi: Toggle multiselect ────────────────────────────────────────
  section('Column Metadata — _d_multi (multiselect)');

  // 7. Set MULTI on reference column
  if (col6.php && col6.node) {
    await dual('#7 POST /_d_multi (set MULTI)', 'POST',
      s => `/_d_multi/${col6[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // 8. Toggle MULTI off
  if (col6.php && col6.node) {
    await dual('#8 POST /_d_multi (toggle off)', 'POST',
      s => `/_d_multi/${col6[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // ── _d_ord: Set column order ────────────────────────────────────────────
  section('Column Metadata — _d_ord (reorder)');

  // 9. Move col3 to position 1
  if (col3.php && col3.node) {
    await dual('#9 POST /_d_ord (move to pos 1)', 'POST',
      s => `/_d_ord/${col3[s]}`,
      s => `_xsrf=${getXsrf(s)}&order=1&JSON=1`);
  }

  // 10. Verify order in metadata
  await dual('#10 GET /metadata (after reorder)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // ── _d_up: Move column up ──────────────────────────────────────────────
  section('Column Metadata — _d_up (move up)');

  // 11. Move col4 up
  if (col4.php && col4.node) {
    await dual('#11 POST /_d_up (move col up)', 'POST',
      s => `/_d_up/${col4[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // 12. Verify order after move
  await dual('#12 GET /metadata (after move up)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // ── _d_attrs: Set attributes ────────────────────────────────────────────
  section('Column Metadata — _d_attrs (attributes)');

  // 13. Set attrs on NUMBER column
  if (col3.php && col3.node) {
    await dual('#13 POST /_d_attrs (set attrs)', 'POST',
      s => `/_d_attrs/${col3[s]}`,
      s => `_xsrf=${getXsrf(s)}&val=${encodeURIComponent(':ALIAS=Price:')}&JSON=1`);
  }

  // 14. Clear attrs
  if (col3.php && col3.node) {
    await dual('#14 POST /_d_attrs (clear attrs)', 'POST',
      s => `/_d_attrs/${col3[s]}`,
      s => `_xsrf=${getXsrf(s)}&val=&JSON=1`);
  }

  // ── _d_del_req: Delete column ──────────────────────────────────────────
  section('Column Metadata — _d_del_req (delete column)');

  // 15. Delete BOOLEAN column
  // Note: PHP/Node share the same DB table. When col5.php==col5.node (Node found PHP's row
  // as duplicate via _d_req), both servers delete the same row concurrently — whichever
  // runs second gets "not found" and returns obj:null. Use statusOnly to avoid race DIFF.
  if (col5.php && col5.node) {
    await dual('#15 POST /_d_del_req (delete column)', 'POST',
      s => `/_d_del_req/${col5[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });
  }

  // 16. Verify column deleted in metadata
  await dual('#16 GET /metadata (after delete col)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // 17. Try deleting non-existent column
  if (col5.php && col5.node) {
    await dual('#17 POST /_d_del_req (already deleted)', 'POST',
      s => `/_d_del_req/${col5[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // ── Full state verification ─────────────────────────────────────────────
  section('Column Metadata — Final State');

  // 18. Check edit_types for full type view
  await dual('#18 GET /edit_types (full state)', 'GET',
    '/edit_types?JSON=1', null, { keysOnly: true });

  // 19. Check metadata final state
  await dual('#19 GET /metadata (final)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '18-column-metadata-results.md'), generateMD('18-column-metadata — Column Metadata Operations'));
  writeReports('18-column-metadata', join(dir, '..', 'reports'));
  console.log(`\nWrote 18-column-metadata-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
