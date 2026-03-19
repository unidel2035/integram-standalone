#!/usr/bin/env node
/**
 * 14-multiselect: PHP vs Node.js — Multiselect operations
 * Based on ReferenceField.vue multiselect patterns:
 *   _d_multi toggle, _m_set add, _m_del remove,
 *   _ref_reqs for multiselect, edit_obj with multiselect data
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, deleteType, deleteObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__msel_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup ─────────────────────────────────────────────────────────────────

  // Create tag lookup table
  const tagType = await createType(`${PREFIX}tags_${TS}`, 3);
  const tagJS   = await createObj(tagType, 'JavaScript');
  const tagPHP  = await createObj(tagType, 'PHP');
  const tagPy   = await createObj(tagType, 'Python');
  const tagGo   = await createObj(tagType, 'Go');
  const tagRust = await createObj(tagType, 'Rust');
  const tagTS2  = await createObj(tagType, 'TypeScript');

  // Create skill level lookup
  const levelType = await createType(`${PREFIX}levels_${TS}`, 3);
  const lvlJr  = await createObj(levelType, 'Junior');
  const lvlMid = await createObj(levelType, 'Middle');
  const lvlSr  = await createObj(levelType, 'Senior');

  // Create main table (developers)
  const devType = await createType(`${PREFIX}devs_${TS}`, 3);
  const colName = await addColumn(devType, 3); // name

  // Add reference columns
  const colTags   = await addRefColumn(devType, tagType);   // tags (will be multiselect)
  const colLevel  = await addRefColumn(devType, levelType); // level (will be multiselect)

  // Toggle multiselect on tags column
  const ck2 = cookie();
  if (colTags.php && colTags.node) {
    await Promise.all([
      http(PHP, 'POST', `/${DB}/_d_multi/${colTags.php}`, `_xsrf=${xsrfPhp}&JSON=1`, ck2),
      http(NODE, 'POST', `/${DB}/_d_multi/${colTags.node}`, `_xsrf=${xsrfNode}&JSON=1`, ck2),
    ]);
  }

  // Toggle multiselect on level column
  if (colLevel.php && colLevel.node) {
    await Promise.all([
      http(PHP, 'POST', `/${DB}/_d_multi/${colLevel.php}`, `_xsrf=${xsrfPhp}&JSON=1`, ck2),
      http(NODE, 'POST', `/${DB}/_d_multi/${colLevel.node}`, `_xsrf=${xsrfNode}&JSON=1`, ck2),
    ]);
  }

  // Create developers
  const dev1 = await createObj(devType, 'Alice');
  const dev2 = await createObj(devType, 'Bob');
  const dev3 = await createObj(devType, 'Charlie');

  // ── Toggle Multiselect ────────────────────────────────────────────────────
  section('Multiselect — Toggle Flag');

  // Create a test column to toggle
  const testCol = await addRefColumn(devType, tagType);

  // 1. Toggle multiselect ON
  if (testCol.php && testCol.node) {
    await dual('#1 POST /_d_multi (toggle ON)', 'POST',
      s => `/_d_multi/${testCol[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // 2. Toggle multiselect OFF
  if (testCol.php && testCol.node) {
    await dual('#2 POST /_d_multi (toggle OFF)', 'POST',
      s => `/_d_multi/${testCol[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // ── Add Multiselect Items ─────────────────────────────────────────────────
  section('Multiselect — Add Items');

  // 3. Add first tag to dev1
  if (colTags.php && colTags.node) {
    const r = await dual('#3 POST /_m_set (add tag JS)', 'POST',
      s => `/_m_set/${dev1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colTags[s]}=${tagJS[s]}&JSON=1`);
    // Response should contain multiselect item ID
  }

  // 4. Add second tag to dev1
  if (colTags.php && colTags.node) {
    await dual('#4 POST /_m_set (add tag PHP)', 'POST',
      s => `/_m_set/${dev1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colTags[s]}=${tagPHP[s]}&JSON=1`);
  }

  // 5. Add third tag to dev1
  if (colTags.php && colTags.node) {
    await dual('#5 POST /_m_set (add tag Python)', 'POST',
      s => `/_m_set/${dev1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colTags[s]}=${tagPy[s]}&JSON=1`);
  }

  // 6. Add tags to dev2
  if (colTags.php && colTags.node) {
    await dual('#6 POST /_m_set (dev2 add Go)', 'POST',
      s => `/_m_set/${dev2[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colTags[s]}=${tagGo[s]}&JSON=1`);
  }

  // 7. Add level to dev1
  if (colLevel.php && colLevel.node) {
    await dual('#7 POST /_m_set (add level Senior)', 'POST',
      s => `/_m_set/${dev1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colLevel[s]}=${lvlSr[s]}&JSON=1`);
  }

  // ── Read Multiselect Data ─────────────────────────────────────────────────
  section('Multiselect — Read Data');

  // 8. Get edit_obj with multiselect data
  await dual('#8 GET /edit_obj (with multiselect)', 'GET',
    s => `/edit_obj/${dev1[s]}?JSON=1`);

  // 9. Get edit_obj for dev2
  await dual('#9 GET /edit_obj (dev2 multiselect)', 'GET',
    s => `/edit_obj/${dev2[s]}?JSON=1`);

  // 10. Get edit_obj for dev3 (no multiselect items)
  await dual('#10 GET /edit_obj (dev3 empty multiselect)', 'GET',
    s => `/edit_obj/${dev3[s]}?JSON=1`);

  // 11. List all devs (should show multiselect info)
  await dual('#11 GET /object (list with multiselect)', 'GET',
    s => `/object/${devType[s]}?JSON=1`);

  // 12. Get _ref_reqs for tags (should show which are selected)
  if (colTags.php && colTags.node) {
    await dual('#12 GET /_ref_reqs (tags for dev1)', 'GET',
      s => `/_ref_reqs/${colTags[s]}?id=${dev1[s]}&JSON=1`);
  }

  // 13. Get _ref_reqs for levels
  if (colLevel.php && colLevel.node) {
    await dual('#13 GET /_ref_reqs (levels for dev1)', 'GET',
      s => `/_ref_reqs/${colLevel[s]}?id=${dev1[s]}&JSON=1`);
  }

  // ── Remove Multiselect Items ──────────────────────────────────────────────
  section('Multiselect — Remove Items');

  // We need to get the multiselect item IDs from edit_obj
  // The multiselect items have their own IDs (not the tag IDs)
  const editDev1Php  = await http(PHP, 'GET', `/${DB}/edit_obj/${dev1.php}?JSON=1`, null, ck2);
  const editDev1Node = await http(NODE, 'GET', `/${DB}/edit_obj/${dev1.node}?JSON=1`, null, ck2);

  // Extract multiselect item IDs from the response
  // Multiselect items appear in the response with their own IDs
  let msItemPhp = null, msItemNode = null;
  if (editDev1Php.json && editDev1Node.json) {
    // Try to find multiselect IDs in the response
    const findMsIds = (json) => {
      const ids = [];
      if (json.object_reqs) {
        for (const row of json.object_reqs) {
          if (row && row.id) ids.push(row.id);
        }
      }
      // Also check in items arrays
      const walk = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) { obj.forEach(walk); return; }
        if (obj.ms_id) ids.push(obj.ms_id);
        if (obj.multi_id) ids.push(obj.multi_id);
        for (const v of Object.values(obj)) walk(v);
      };
      walk(json);
      return ids;
    };
    const phpIds = findMsIds(editDev1Php.json);
    const nodeIds = findMsIds(editDev1Node.json);
    if (phpIds.length > 0) msItemPhp = phpIds[0];
    if (nodeIds.length > 0) msItemNode = nodeIds[0];
  }

  // 14. Delete multiselect item (if found)
  if (msItemPhp && msItemNode) {
    await dual('#14 POST /_m_del (remove multiselect item)', 'POST',
      s => `/_m_del/${s === 'php' ? msItemPhp : msItemNode}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  } else {
    console.log('  SKIP  #14 — could not extract multiselect item IDs');
  }

  // 15. Verify after removal
  await dual('#15 GET /edit_obj (after ms remove)', 'GET',
    s => `/edit_obj/${dev1[s]}?JSON=1`);

  // ── Duplicate Multiselect Items ───────────────────────────────────────────
  section('Multiselect — Edge Cases');

  // 16. Add same tag twice (should it deduplicate?)
  if (colTags.php && colTags.node) {
    await dual('#16 POST /_m_set (add duplicate tag)', 'POST',
      s => `/_m_set/${dev2[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colTags[s]}=${tagGo[s]}&JSON=1`);
  }

  // 17. Add all tags to dev3
  if (colTags.php && colTags.node) {
    for (const tag of [tagJS, tagPHP, tagPy, tagGo, tagRust, tagTS2]) {
      await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_set/${dev3.php}`, `_xsrf=${xsrfPhp}&t${colTags.php}=${tag.php}&JSON=1`, ck2),
        http(NODE, 'POST', `/${DB}/_m_set/${dev3.node}`, `_xsrf=${xsrfNode}&t${colTags.node}=${tag.node}&JSON=1`, ck2),
      ]);
    }
  }

  // 18. Verify dev3 has all tags
  await dual('#18 GET /edit_obj (dev3 all tags)', 'GET',
    s => `/edit_obj/${dev3[s]}?JSON=1`);

  // 19. List all devs with multiselect data
  await dual('#19 GET /object (final list)', 'GET',
    s => `/object/${devType[s]}?JSON=1`);

  // 20. Get _ref_reqs with search query on multiselect
  if (colTags.php && colTags.node) {
    await dual('#20 GET /_ref_reqs (query=Py)', 'GET',
      s => `/_ref_reqs/${colTags[s]}?id=${dev1[s]}&q=${encodeURIComponent('Py')}&JSON=1`);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '14-multiselect-results.md'), generateMD('14-multiselect — Multiselect Operations'));
  writeReports('14-multiselect', join(dir, '..', 'reports'));
  console.log(`\nWrote 14-multiselect-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
