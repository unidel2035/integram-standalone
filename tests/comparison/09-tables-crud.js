#!/usr/bin/env node
/**
 * 09-tables-crud: PHP vs Node.js — Table/Type CRUD operations
 * Based on IntegramTypeEditor.vue patterns:
 *   _d_new, _d_save, _d_del, _d_req, _d_del_req, _d_alias, _d_attrs,
 *   _d_null, _d_multi, _d_up, _d_ref, edit_types, metadata
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, deleteType, getXsrf, getConcreteType, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__tbl_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Create Types ──────────────────────────────────────────────────────────
  section('Table CRUD — Create Types');

  // 1. Create basic type (table) — unique names per server to avoid shared-DB duplicate warnings
  const t1 = await createType(`${PREFIX}basic_${TS}`, 3);
  await dual('#1 POST /_d_new (basic type)', 'POST',
    '/_d_new',
    s => `_xsrf=${getXsrf(s)}&val=${encodeURIComponent(`${PREFIX}verify_${s}_${TS}`)}&t=3&up=1&JSON=1`);

  // 2. Create type with LONG base
  await dual('#2 POST /_d_new (LONG base)', 'POST',
    '/_d_new',
    s => `_xsrf=${getXsrf(s)}&val=${encodeURIComponent(`${PREFIX}long_${s}_${TS}`)}&t=2&up=1&JSON=1`);

  // 3. Create type with empty name
  await dual('#3 POST /_d_new (empty name)', 'POST',
    '/_d_new',
    s => `_xsrf=${getXsrf(s)}&val=&t=3&up=1&JSON=1`);

  // 4. Create subordinate type (up=parentId) — unique names per server
  await dual('#4 POST /_d_new (subordinate)', 'POST',
    s => '/_d_new',
    s => `_xsrf=${getXsrf(s)}&val=${encodeURIComponent(`${PREFIX}sub_${s}_${TS}`)}&t=3&up=${t1[s]}&JSON=1`);

  // ── Add Columns (Requisites) ──────────────────────────────────────────────
  section('Table CRUD — Add Columns');

  // 5. Add SHORT column
  const col1 = await addColumn(t1, 3);
  await dual('#5 POST /_d_req (SHORT col)', 'POST',
    s => `/_d_req/${t1[s]}`,
    s => `_xsrf=${getXsrf(s)}&t=3&JSON=1`);

  // 6. Add NUMBER column
  const col2 = await addColumn(t1, 13);  // NUMBER (13, not 11=BOOLEAN)
  await dual('#6 POST /_d_req (NUMBER col)', 'POST',
    s => `/_d_req/${t1[s]}`,
    s => `_xsrf=${getXsrf(s)}&t=11&JSON=1`);

  // 7. Add DATE column
  const col3 = await addColumn(t1, 4);
  await dual('#7 POST /_d_req (DATE col)', 'POST',
    s => `/_d_req/${t1[s]}`,
    s => `_xsrf=${getXsrf(s)}&t=4&JSON=1`);

  // 8. Add BOOL column
  await dual('#8 POST /_d_req (BOOL col)', 'POST',
    s => `/_d_req/${t1[s]}`,
    s => `_xsrf=${getXsrf(s)}&t=7&JSON=1`);

  // 9. Add LONG column
  await dual('#9 POST /_d_req (LONG col)', 'POST',
    s => `/_d_req/${t1[s]}`,
    s => `_xsrf=${getXsrf(s)}&t=2&JSON=1`);

  // ── Column Attributes ─────────────────────────────────────────────────────
  section('Table CRUD — Column Attributes');

  // 10. Set alias (column name)
  if (col1.php && col1.node) {
    await dual('#10 POST /_d_alias (set name)', 'POST',
      s => `/_d_alias/${col1[s]}`,
      s => `_xsrf=${getXsrf(s)}&alias=${encodeURIComponent('Тестовое поле')}&JSON=1`);
  }

  // 11. Set attributes (default value)
  if (col1.php && col1.node) {
    await dual('#11 POST /_d_attrs', 'POST',
      s => `/_d_attrs/${col1[s]}`,
      s => `_xsrf=${getXsrf(s)}&attrs=${encodeURIComponent(':default=hello:')}&JSON=1`);
  }

  // 12. Toggle NOT NULL
  if (col1.php && col1.node) {
    await dual('#12 POST /_d_null (toggle ON)', 'POST',
      s => `/_d_null/${col1[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // 13. Toggle NOT NULL back
  if (col1.php && col1.node) {
    await dual('#13 POST /_d_null (toggle OFF)', 'POST',
      s => `/_d_null/${col1[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // 14. Toggle multiselect
  if (col1.php && col1.node) {
    await dual('#14 POST /_d_multi (toggle ON)', 'POST',
      s => `/_d_multi/${col1[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // 15. Move column up
  if (col2.php && col2.node) {
    await dual('#15 POST /_d_up (move col up)', 'POST',
      s => `/_d_up/${col2[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // ── Reference Columns ─────────────────────────────────────────────────────
  section('Table CRUD — Reference Columns');

  // Create a lookup table for references
  const lookupType = await createType(`${PREFIX}lookup_${TS}`, 3);

  // 16. Add reference column (_d_ref)
  const refCol = await addRefColumn(t1, lookupType);
  await dual('#16 POST /_d_ref (add ref col)', 'POST',
    s => `/_d_ref/${t1[s]}`,
    s => `_xsrf=${getXsrf(s)}&t=${lookupType[s]}&JSON=1`);

  // ── Read Metadata ─────────────────────────────────────────────────────────
  section('Table CRUD — Read Metadata');

  // 17. Get type metadata
  await dual('#17 GET /metadata (single type)', 'GET',
    s => `/metadata/${t1[s]}?JSON=1`);

  // 18. Get edit_types
  await dual('#18 GET /edit_types', 'GET',
    '/edit_types?JSON=1', null, { keysOnly: true });

  // 19. Get terms (all types list)
  await dual('#19 GET /terms', 'GET', '/terms?JSON=1');

  // 20. Get dict (independent types)
  await dual('#20 GET /dict?JSON=1', 'GET', '/dict?JSON=1');

  // ── Rename Type ───────────────────────────────────────────────────────────
  section('Table CRUD — Rename & Save');

  // 21. Rename type (_d_save)
  await dual('#21 POST /_d_save (rename type)', 'POST',
    s => `/_d_save/${t1[s]}`,
    s => `_xsrf=${getXsrf(s)}&val=${encodeURIComponent(`${PREFIX}renamed_${TS}`)}&JSON=1`);

  // ── Delete Columns ────────────────────────────────────────────────────────
  section('Table CRUD — Delete Columns');

  // 22. Delete requisite — create separate columns per server (shared DB: same col would be deleted twice)
  {
    const ck = cookie();
    const ct9 = getConcreteType(9);
    const ct14 = getConcreteType(14);
    const phpAdd = await http(PHP, 'POST', `/${DB}/_d_req/${t1.php}`, `_xsrf=${xsrfPhp}&t=${ct9}&JSON=1`, ck);
    const nodeAdd = await http(NODE, 'POST', `/${DB}/_d_req/${t1.node}`, `_xsrf=${xsrfNode}&t=${ct14}&JSON=1`, ck);
    const delPhp = Number(phpAdd.json?.id);
    const delNode = Number(nodeAdd.json?.id);
    if (delPhp && delNode && delPhp !== delNode) {
      await dual('#22 POST /_d_del_req (delete col)', 'POST',
        s => `/_d_del_req/${s === 'php' ? delPhp : delNode}`,
        s => `_xsrf=${getXsrf(s)}&forced=1&JSON=1`);
    }
  }

  // 23. Delete non-existent requisite
  await dual('#23 POST /_d_del_req (non-existent)', 'POST',
    '/_d_del_req/999999999',
    s => `_xsrf=${getXsrf(s)}&forced=1&JSON=1`);

  // ── Delete Types ──────────────────────────────────────────────────────────
  section('Table CRUD — Delete Types');

  // 24. Delete lookup type (should succeed, empty)
  await dual('#24 POST /_d_del (empty type)', 'POST',
    s => `/_d_del/${lookupType[s]}`,
    s => `_xsrf=${getXsrf(s)}&forced=1&JSON=1`);

  // 25. Delete non-existent type
  await dual('#25 POST /_d_del (non-existent)', 'POST',
    '/_d_del/999999999',
    s => `_xsrf=${getXsrf(s)}&JSON=1`);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '09-tables-crud-results.md'), generateMD('09-tables-crud — Table CRUD'));
  writeReports('09-tables-crud', join(dir, '..', 'reports'));
  console.log(`\nWrote 09-tables-crud-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
