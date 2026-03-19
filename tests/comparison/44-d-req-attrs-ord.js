#!/usr/bin/env node
/**
 * 44-d-req-attrs-ord: PHP vs Node.js — Column creation & modifier operations
 * Tests: _d_req (add requisite by type), _d_ref (create reference),
 *        _d_attrs (set all modifiers at once), _d_ord (set explicit column order),
 *        validation errors for all four, duplicate req handling
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__dreq_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup ──────────────────────────────────────────────────────────────
  const mainType = await createType(`${PREFIX}main_${TS}`, 3);
  const refType  = await createType(`${PREFIX}ref_${TS}`, 3);
  // Seed ref type with objects so _list works
  await createObj(refType, 'RefObjA');
  await createObj(refType, 'RefObjB');

  // ── _d_req — Add requisite by type ID ───────────────────────────────────
  section('_d_req — Add requisites');

  // 1. Add SHORT (3) column via _d_req
  await dual('#1 POST /_d_req (add SHORT col)', 'POST',
    s => `/_d_req/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t=3&JSON=1`, { keysOnly: true });

  // 2. Add NUMBER (13) column via _d_req
  await dual('#2 POST /_d_req (add NUMBER col)', 'POST',
    s => `/_d_req/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t=13&JSON=1`, { keysOnly: true });

  // 3. Add LONG (2) column via _d_req
  await dual('#3 POST /_d_req (add LONG col)', 'POST',
    s => `/_d_req/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t=2&JSON=1`, { keysOnly: true });

  // 4. Add DATETIME (4) column via _d_req
  await dual('#4 POST /_d_req (add DATETIME col)', 'POST',
    s => `/_d_req/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t=4&JSON=1`, { keysOnly: true });

  // 5. Add ref-type column via _d_req (reference to refType)
  await dual('#5 POST /_d_req (add REF col)', 'POST',
    s => `/_d_req/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t=${refType[s]}&JSON=1`, { keysOnly: true });

  // 6. Verify metadata after adding 5 columns
  await dual('#6 GET /metadata (after _d_req)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // ── _d_req — Validation errors ───────────────────────────────────────────
  section('_d_req — Validation errors');

  // 7. _d_req with nonexistent type
  await dual('#7 POST /_d_req (nonexistent type)', 'POST',
    s => `/_d_req/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t=999999999&JSON=1`, { statusOnly: true });

  // 8. _d_req with nonexistent parent
  await dual('#8 POST /_d_req (nonexistent parent)', 'POST',
    '/_d_req/999999999',
    s => `_xsrf=${getXsrf(s)}&t=3&JSON=1`, { statusOnly: true });

  // 9. _d_req duplicate (add SHORT again — should return existing id)
  await dual('#9 POST /_d_req (duplicate SHORT)', 'POST',
    s => `/_d_req/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t=3&JSON=1`, { keysOnly: true });

  // ── _d_ref — Create reference entry ─────────────────────────────────────
  section('_d_ref — Create reference');

  // 10. _d_ref for our refType (creates a "global" ref row)
  await dual('#10 POST /_d_ref (create ref)', 'POST',
    s => `/_d_ref/${refType[s]}`,
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { keysOnly: true });

  // 11. _d_ref idempotent (call again — should return same ref)
  await dual('#11 POST /_d_ref (idempotent)', 'POST',
    s => `/_d_ref/${refType[s]}`,
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { keysOnly: true });

  // 12. _d_ref for nonexistent type
  await dual('#12 POST /_d_ref (nonexistent)', 'POST',
    '/_d_ref/999999999',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // ── _d_attrs — Set all column modifiers at once ──────────────────────────
  section('_d_attrs — Set column modifiers');

  // Get a column ID to operate on (add one for this section)
  const attrType = await createType(`${PREFIX}attrs_${TS}`, 3);
  const attrCol  = await addColumn(attrType, 3);   // SHORT column

  // 13. Set alias + required=1 + multi=0 via _d_attrs
  if (attrCol.php && attrCol.node) {
    await dual('#13 POST /_d_attrs (alias+required)', 'POST',
      s => `/_d_attrs/${attrCol[s]}`,
      s => `_xsrf=${getXsrf(s)}&alias=${encodeURIComponent('Псевдоним')}&required=1&multi=0&up=${attrType[s]}&JSON=1`, { keysOnly: true });
  }

  // 14. Verify modifiers applied
  await dual('#14 GET /metadata (after _d_attrs)', 'GET',
    s => `/metadata/${attrType[s]}?JSON=1`);

  // 15. Set multi=1 (multiselect) via _d_attrs
  if (attrCol.php && attrCol.node) {
    await dual('#15 POST /_d_attrs (multi=1)', 'POST',
      s => `/_d_attrs/${attrCol[s]}`,
      s => `_xsrf=${getXsrf(s)}&multi=1&required=0&up=${attrType[s]}&JSON=1`, { keysOnly: true });
  }

  // 16. Verify multi applied
  await dual('#16 GET /metadata (after multi)', 'GET',
    s => `/metadata/${attrType[s]}?JSON=1`);

  // 17. Clear alias (set alias to empty string)
  if (attrCol.php && attrCol.node) {
    await dual('#17 POST /_d_attrs (clear alias)', 'POST',
      s => `/_d_attrs/${attrCol[s]}`,
      s => `_xsrf=${getXsrf(s)}&alias=&multi=0&required=0&up=${attrType[s]}&JSON=1`, { keysOnly: true });
  }

  // 18. _d_attrs on nonexistent column — PHP 200 (my_die), Node 404 (known gap)
  await dual('#18 POST /_d_attrs (nonexistent col)', 'POST',
    '/_d_attrs/999999999',
    s => `_xsrf=${getXsrf(s)}&alias=x&up=1&JSON=1`, { ignoreStatus: true, statusOnly: true });

  // ── _d_ord — Set explicit column order number ─────────────────────────────
  section('_d_ord — Set column order');

  // Create type with multiple columns for reordering
  const ordType = await createType(`${PREFIX}ord_${TS}`, 3);
  const ordCol1 = await addColumn(ordType, 3);    // SHORT
  const ordCol2 = await addColumn(ordType, 13);   // NUMBER
  const ordCol3 = await addColumn(ordType, 4);    // DATETIME

  // 19. Metadata before reorder
  await dual('#19 GET /metadata (before _d_ord)', 'GET',
    s => `/metadata/${ordType[s]}?JSON=1`);

  // 20. Move col3 to position 1 (swap to top)
  if (ordCol3.php && ordCol3.node) {
    await dual('#20 POST /_d_ord (col3 → ord=1)', 'POST',
      s => `/_d_ord/${ordCol3[s]}`,
      s => `_xsrf=${getXsrf(s)}&ord=1&JSON=1`, { keysOnly: true });
  }

  // 21. Verify reorder
  await dual('#21 GET /metadata (after _d_ord)', 'GET',
    s => `/metadata/${ordType[s]}?JSON=1`);

  // 22. Move col1 to position 3 (to bottom)
  if (ordCol1.php && ordCol1.node) {
    await dual('#22 POST /_d_ord (col1 → ord=3)', 'POST',
      s => `/_d_ord/${ordCol1[s]}`,
      s => `_xsrf=${getXsrf(s)}&ord=3&JSON=1`, { keysOnly: true });
  }

  // 23. Verify new order
  await dual('#23 GET /metadata (after second _d_ord)', 'GET',
    s => `/metadata/${ordType[s]}?JSON=1`);

  // 24. _d_ord on nonexistent column
  await dual('#24 POST /_d_ord (nonexistent col)', 'POST',
    '/_d_ord/999999999',
    s => `_xsrf=${getXsrf(s)}&ord=1&JSON=1`, { statusOnly: true });

  // ── _d_req with modifiers ────────────────────────────────────────────────
  section('_d_req — With modifiers');

  const modType = await createType(`${PREFIX}mod_${TS}`, 3);

  // 25. Add col with alias param
  await dual('#25 POST /_d_req (with alias)', 'POST',
    s => `/_d_req/${modType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t=3&alias=${encodeURIComponent('МоёПоле')}&JSON=1`, { keysOnly: true });

  // 26. Add col with required=1
  await dual('#26 POST /_d_req (with required)', 'POST',
    s => `/_d_req/${modType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t=13&required=1&JSON=1`, { keysOnly: true });

  // 27. Add ref col with multiselect
  await dual('#27 POST /_d_req (ref+multiselect)', 'POST',
    s => `/_d_req/${modType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t=${refType[s]}&multiselect=1&JSON=1`, { keysOnly: true });

  // 28. Verify all modifiers in metadata
  await dual('#28 GET /metadata (with modifiers)', 'GET',
    s => `/metadata/${modType[s]}?JSON=1`);

  // ── Cleanup ────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '44-d-req-attrs-ord-results.md'), generateMD('44-d-req-attrs-ord — Column Creation & Modifiers'));
  writeReports('44-d-req-attrs-ord', join(dir, '..', 'reports'));
  console.log(`\nWrote 44-d-req-attrs-ord-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
