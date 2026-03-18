#!/usr/bin/env node
/**
 * 35-metadata-obj-meta: PHP vs Node.js — metadata & obj_meta deep comparison
 * Tests: /metadata with/without typeId, JSON_KV format, obj_meta for objects
 *        with various column types (ref, number, bool, datetime),
 *        metadata after column add/remove
 */
import { PHP, NODE, DB, DB_PHP, DB_NODE, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, getXsrf, cookie, cookieNode, results } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__metaom_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup: type with multiple column types ─────────────────────────
  const mainType = await createType(`${PREFIX}doc_${TS}`, 3);
  const colShort = await addColumn(mainType, 3);   // SHORT
  const colNum = await addColumn(mainType, 13);     // NUMBER
  const colBool = await addColumn(mainType, 11);    // BOOL
  const colDt = await addColumn(mainType, 4);       // DATETIME

  // Lookup type for ref
  const catType = await createType(`${PREFIX}cat_${TS}`, 3);
  await createObj(catType, 'RefTarget');
  const colRef = await addRefColumn(mainType, catType);

  // Create objects
  const obj1 = await createObj(mainType, 'Документ_1');
  const obj2 = await createObj(mainType, 'Документ_2');

  // Set field values on obj1
  if (obj1.php && obj1.node) {
    const sets = [];
    if (colNum.php && colNum.node) {
      sets.push([colNum, '42']);
    }
    if (colDt.php && colDt.node) {
      sets.push([colDt, '2025-06-15 14:30:00']);
    }
    for (const [col, val] of sets) {
      await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_set/${obj1.php}`, `_xsrf=${getXsrf('php')}&t${col.php}=${encodeURIComponent(val)}&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_m_set/${obj1.node}`, `_xsrf=${getXsrf('node')}&t${col.node}=${encodeURIComponent(val)}&JSON=1`, cookie()),
      ]);
    }
  }

  // ── metadata for type ────────────────────────────────────────────────
  section('Metadata — Type');

  // 1. metadata JSON
  await dual('#1 GET /metadata (JSON)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // 2. metadata JSON_KV
  await dual('#2 GET /metadata (JSON_KV)', 'GET',
    s => `/metadata/${mainType[s]}?JSON_KV=1`, null, { keysOnly: true });

  // 3. metadata without type ID — verify structure matches for our type in both responses
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP, 'GET', `/${DB_PHP}/metadata?JSON=1`, null, cookie()),
      http(NODE, 'GET', `/${DB_NODE}/metadata?JSON=1`, null, cookieNode()),
    ]);
    const phpArr = phpRes.json;
    const nodeArr = nodeRes.json;
    const diffs = [];
    let phpEntry = null;
    let nodeEntry = null;
    if (!Array.isArray(phpArr)) {
      diffs.push('PHP response is not array');
    } else if (!Array.isArray(nodeArr)) {
      diffs.push('Node response is not array');
    } else {
      // IDs come as strings in this endpoint
      phpEntry = phpArr.find(t => String(t.id) === String(mainType.php));
      nodeEntry = nodeArr.find(t => String(t.id) === String(mainType.node));
      if (!phpEntry) diffs.push(`mainType ${mainType.php} not found in PHP response`);
      if (!nodeEntry) diffs.push(`mainType ${mainType.node} not found in Node response`);
      if (phpEntry && nodeEntry) {
        const pk = Object.keys(phpEntry).sort().join(',');
        const nk = Object.keys(nodeEntry).sort().join(',');
        if (pk !== nk) diffs.push(`keys: PHP=[${pk}] Node=[${nk}]`);
      }
    }
    const match = diffs.length === 0;
    const icon = match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m';
    console.log(`  ${icon}  #3 GET /metadata (no typeId)${diffs.length ? '\n         ' + diffs.join('\n         ') : ''}`);
    results.push({
      name: '#3 GET /metadata (no typeId)', match, diffs,
      phpStatus: phpRes.status, nodeStatus: nodeRes.status,
      phpBody: phpRes.body, nodeBody: nodeRes.body,
      phpJson: phpEntry, nodeJson: nodeEntry,
      phpPath: `/${DB_PHP}/metadata?JSON=1`, nodePath: `/${DB_NODE}/metadata?JSON=1`,
      method: 'GET',
    });
  }

  // ── obj_meta — various column types ──────────────────────────────────
  section('obj_meta — Column types');

  // 4. obj_meta for obj with values set
  if (obj1.php && obj1.node) {
    await dual('#4 GET /obj_meta (obj with values)', 'GET',
      s => `/obj_meta/${obj1[s]}?JSON=1`, null, { keysOnly: true });
  }

  // 5. obj_meta for obj with no values
  if (obj2.php && obj2.node) {
    await dual('#5 GET /obj_meta (obj no values)', 'GET',
      s => `/obj_meta/${obj2[s]}?JSON=1`, null, { keysOnly: true });
  }

  // ── metadata after adding column ─────────────────────────────────────
  section('Metadata — After changes');

  // Add another column
  const colExtra = await addColumn(mainType, 3);

  // 6. metadata after adding extra column
  await dual('#6 GET /metadata (after add col)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // 7. Rename column via _d_alias
  if (colExtra.php && colExtra.node) {
    await dual('#7 POST /_d_alias (rename col)', 'POST',
      s => `/_d_alias/${colExtra[s]}`,
      s => `_xsrf=${getXsrf(s)}&val=ExtraColumn&JSON=1`, { keysOnly: true });
  }

  // 8. metadata after rename
  await dual('#8 GET /metadata (after rename)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // 9. Delete column
  if (colExtra.php && colExtra.node) {
    await dual('#9 POST /_d_del_req (delete col)', 'POST',
      s => `/_d_del_req/${colExtra[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { keysOnly: true });
  }

  // 10. metadata after delete column
  await dual('#10 GET /metadata (after del col)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // ── obj_meta for lookup type objects ──────────────────────────────────
  section('obj_meta — Lookup type');

  // 11. obj_meta for lookup type object (no requisites of its own)
  const catObjRes = await http(PHP, 'GET', `/${DB}/object/${catType.php}?JSON=1`, null, cookie());
  let catObjId = null;
  if (catObjRes.json && Array.isArray(catObjRes.json) && catObjRes.json.length > 0) {
    catObjId = catObjRes.json[0]?.id;
  }
  // Get Node equivalent
  const catObjResN = await http(NODE, 'GET', `/${DB}/object/${catType.node}?JSON=1`, null, cookie());
  let catObjIdN = null;
  if (catObjResN.json && Array.isArray(catObjResN.json) && catObjResN.json.length > 0) {
    catObjIdN = catObjResN.json[0]?.id;
  }
  if (catObjId && catObjIdN) {
    await dual('#11 GET /obj_meta (lookup obj)', 'GET',
      s => `/obj_meta/${s === 'php' ? catObjId : catObjIdN}?JSON=1`, null, { keysOnly: true });
  }

  // ── edit_types variants ──────────────────────────────────────────────
  section('edit_types — Formats');

  // 12. edit_types JSON
  await dual('#12 GET /edit_types (JSON)', 'GET',
    '/edit_types?JSON=1', null, { keysOnly: true });

  // 13. edit_types JSON_DATA
  await dual('#13 GET /edit_types (JSON_DATA)', 'GET',
    '/edit_types?JSON_DATA=1', null, { keysOnly: true });

  // ── terms variants ───────────────────────────────────────────────────
  section('terms — Formats');

  // 14. terms JSON
  await dual('#14 GET /terms (JSON)', 'GET',
    '/terms?JSON=1');

  // 15. terms JSON_DATA
  await dual('#15 GET /terms (JSON_DATA)', 'GET',
    '/terms?JSON_DATA=1', null, { keysOnly: true });

  // ── Cleanup ────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '35-metadata-obj-meta-results.md'), generateMD('35-metadata-obj-meta — Metadata Deep Comparison'));
  writeReports('35-metadata-obj-meta', join(dir, '..', 'reports'));
  console.log(`\nWrote 35-metadata-obj-meta-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
