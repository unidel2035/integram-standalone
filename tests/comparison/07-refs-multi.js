#!/usr/bin/env node
/**
 * 07-refs-multi: PHP vs Node.js — References, multiselect, subordinate tables, lookup
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, deleteType, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__ref_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // Setup: parent type + child/ref type
  const parentType = await createType(`${PREFIX}parent_${TS}`, 3);
  const childType = await createType(`${PREFIX}child_${TS}`, 3);
  const refReq = await addRefColumn(parentType, childType);

  // Create objects in child type (for reference options)
  const childObj1 = await createObj(childType, 'RefOpt1');
  const childObj2 = await createObj(childType, 'RefOpt2');
  const childObj3 = await createObj(childType, 'RefOpt3');

  // Create parent object
  const parentObj1 = await createObj(parentType, 'ParentA');

  section('Reference Requisites');

  // 1. GET /_ref_reqs/:reqId
  if (refReq.php && refReq.node) {
    await dual('GET /_ref_reqs/:reqId', 'GET',
      s => `/_ref_reqs/${refReq[s]}`);
  }

  // 2. GET /_ref_reqs/:reqId?q=Opt1
  if (refReq.php && refReq.node) {
    await dual('GET /_ref_reqs?q=Opt1', 'GET',
      s => `/_ref_reqs/${refReq[s]}?q=Opt1`);
  }

  // 3. GET /_ref_reqs (non-existent)
  await dual('GET /_ref_reqs (bad id)', 'GET', '/_ref_reqs/999999999');

  section('Set Reference Value');

  // 4. Set reference value on parent object (_m_set with ref type ID)
  if (refReq.php && refReq.node && childObj1.php && childObj1.node) {
    await dual('POST /_m_set (ref value)', 'POST',
      s => `/_m_set/${parentObj1[s]}`,
      s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&t${childType[s]}=${childObj1[s]}&JSON=1`);
  }

  // 5. Clear reference value
  if (refReq.php && refReq.node) {
    await dual('POST /_m_set (clear ref)', 'POST',
      s => `/_m_set/${parentObj1[s]}`,
      s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&t${childType[s]}=&JSON=1`);
  }

  section('Multiselect Toggle');

  // 6. Toggle multi on ref column (_d_multi)
  if (refReq.php && refReq.node) {
    await dual('POST /_d_multi (enable)', 'POST',
      s => `/_d_multi/${refReq[s]}`,
      s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&multi=1&JSON=1`);
  }

  // 7. Verify listing after multi toggle
  await dual('GET /object after multi toggle', 'GET',
    s => `/object/${parentType[s]}?JSON=1`);

  // 8. Toggle multi off
  if (refReq.php && refReq.node) {
    await dual('POST /_d_multi (disable)', 'POST',
      s => `/_d_multi/${refReq[s]}`,
      s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&multi=0&JSON=1`);
  }

  section('Subordinate Tables (up/parent)');

  // 9. Create sub-type under parent type
  const subType = await createType(`${PREFIX}sub_${TS}`, 3, s => `&up=${parentType[s]}`);
  // Note: sub-type created with up=parentType — makes it subordinate

  // 10. List sub-type objects
  await dual('GET /object (sub-type)', 'GET',
    s => `/object/${subType[s]}?JSON=1`);

  // 11. Move object to parent (_m_move)
  const subObj = await createObj(subType, 'SubObj');
  if (parentObj1.php && parentObj1.node) {
    await dual('POST /_m_move (to parent)', 'POST',
      s => `/_m_move/${subObj[s]}`,
      s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&up=${parentObj1[s]}&JSON=1`);
  }

  // 12. List with F_U (parent filter)
  if (parentObj1.php && parentObj1.node) {
    await dual('GET /object?F_U=parentId', 'GET',
      s => `/object/${subType[s]}?JSON=1&F_U=${parentObj1[s]}`);
  }

  section('Lookup / _list Endpoints');

  // 13. GET /_list/:typeId
  await dual('GET /_list/:type', 'GET',
    s => `/_list/${childType[s]}?JSON=1`);

  // 14. GET /_list with search
  await dual('GET /_list?q=Opt2', 'GET',
    s => `/_list/${childType[s]}?JSON=1&q=Opt2`);

  // 15. GET /_list_join/:typeId
  await dual('GET /_list_join/:type', 'GET',
    s => `/_list_join/${parentType[s]}?JSON=1`);

  section('NOT NULL Toggle');

  // 16. Toggle NOT NULL on column
  if (refReq.php && refReq.node) {
    await dual('POST /_d_null (required=1)', 'POST',
      s => `/_d_null/${refReq[s]}`,
      s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&required=1&JSON=1`);
  }

  // 17. Toggle NOT NULL off
  if (refReq.php && refReq.node) {
    await dual('POST /_d_null (required=0)', 'POST',
      s => `/_d_null/${refReq[s]}`,
      s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&required=0&JSON=1`);
  }

  section('Column ↔ Table Conversion');

  // 18. Make column a table (add subordinate type with same ref)
  // This is done by creating a type with up=parentType
  const colAsTable = await createType(`${PREFIX}coltab_${TS}`, 3);
  const colAsTableRef = await addRefColumn(colAsTable, parentType);
  await dual('GET /object (col-as-table)', 'GET',
    s => `/object/${colAsTable[s]}?JSON=1`);

  // 19. Delete the ref column (revert to plain column)
  // Shared DB: colAsTableRef.php === colAsTableRef.node (same row).
  // Create two separate ref types so each server has its own ref to delete.
  {
    const ck = cookie();
    const delType1 = await createType(`${PREFIX}delref1_${TS}`, 3);
    const delType2 = await createType(`${PREFIX}delref2_${TS}`, 3);
    const phpRef = await http(PHP, 'POST', `/${DB}/_d_ref/${delType1.php}`, `_xsrf=${xsrfPhp}&JSON=1`, ck);
    const nodeRef = await http(NODE, 'POST', `/${DB}/_d_ref/${delType2.node}`, `_xsrf=${xsrfNode}&JSON=1`, ck);
    const delPhp = Number(phpRef.json?.obj);
    const delNode = Number(nodeRef.json?.obj);
    if (delPhp && delNode && delPhp !== delNode) {
      await dual('POST /_d_del_req (remove ref)', 'POST',
        s => `/_d_del_req/${s === 'php' ? delPhp : delNode}`,
        s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&JSON=1`);
    }
  }

  section('Edit Object with References');

  // 20. GET /edit_obj with ref columns
  await dual('GET /edit_obj (with refs)', 'GET',
    s => `/edit_obj/${parentObj1[s]}?JSON=1`);

  // Cleanup
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '07-refs-multi-results.md'), generateMD('07-refs-multi — References & Multiselect'));
  writeReports('07-refs-multi', join(dir, '..', 'reports'));
  console.log(`\nWrote 07-refs-multi-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
