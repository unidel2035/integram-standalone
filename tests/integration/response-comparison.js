#!/usr/bin/env node
/**
 * PHP vs Node.js Response Comparison — 28+ tests.
 *
 * Each test calls BOTH servers with the same request,
 * logs actual response bodies side by side, and documents differences.
 *
 * Output: tests/integration/RESPONSE-COMPARISON.md
 */
import h from './lib/helpers.js';
import { writeFileSync } from 'fs';

const TS = Date.now();
const results = [];
const created = { php: { types: [], objects: [] }, node: { types: [], objects: [] } };

function record(num, name, method, path, phpRes, nodeRes, notes = '') {
  const phpBody = typeof phpRes.json !== 'undefined' && phpRes.json !== null
    ? JSON.stringify(phpRes.json) : (phpRes.body || '').slice(0, 500);
  const nodeBody = typeof nodeRes.json !== 'undefined' && nodeRes.json !== null
    ? JSON.stringify(nodeRes.json) : (nodeRes.body || '').slice(0, 500);
  const match = phpRes.status === nodeRes.status &&
    (phpBody === nodeBody || (phpRes.json && nodeRes.json &&
      JSON.stringify(Object.keys(phpRes.json).sort()) === JSON.stringify(Object.keys(nodeRes.json).sort())));
  results.push({ num, name, method, path, phpStatus: phpRes.status, nodeStatus: nodeRes.status,
    phpBody: phpBody.slice(0, 300), nodeBody: nodeBody.slice(0, 300), match, notes });
  const icon = match ? '\x1b[32m✓\x1b[0m' : '\x1b[33m≠\x1b[0m';
  console.log(`  ${icon} ${num}. ${name} — PHP:${phpRes.status} Node:${nodeRes.status}${match ? '' : ' [DIFF]'}`);
}

async function run() {
  await h.setup();
  console.log(`Token: ${h.token.slice(0, 8)}...`);

  // ── Create test data ──
  const [ptR, ntR] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfPhp}&val=__cmp_type_p_${TS}&t=3&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfNode}&val=__cmp_type_n_${TS}&t=3&JSON=1`, h.cookie()),
  ]);
  const typeP = Number(ptR.json?.obj), typeN = Number(ntR.json?.obj);
  if (typeP > 0) created.php.types.push(typeP);
  if (typeN > 0) created.node.types.push(typeN);

  // Create objects
  const objs = { php: [], node: [] };
  for (let i = 0; i < 3; i++) {
    const [po, no] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_new/${typeP}`, `_xsrf=${h.xsrfPhp}&up=1&t${typeP}=item_${i}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_new/${typeN}`, `_xsrf=${h.xsrfNode}&up=1&t${typeN}=item_${i}&JSON=1`, h.cookie()),
    ]);
    const pId = Number(po.json?.id), nId = Number(no.json?.id);
    if (pId > 0) { objs.php.push(pId); created.php.objects.push(pId); }
    if (nId > 0) { objs.node.push(nId); created.node.objects.push(nId); }
  }

  // Create ref type + items
  const [refPR, refNR] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfPhp}&val=__cmp_ref_p_${TS}&t=3&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfNode}&val=__cmp_ref_n_${TS}&t=3&JSON=1`, h.cookie()),
  ]);
  const refP = Number(refPR.json?.obj), refN = Number(refNR.json?.obj);
  if (refP > 0) created.php.types.push(refP);
  if (refN > 0) created.node.types.push(refN);

  const [riPR, riNR] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_m_new/${refP}`, `_xsrf=${h.xsrfPhp}&up=1&t${refP}=RefItem1&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_m_new/${refN}`, `_xsrf=${h.xsrfNode}&up=1&t${refN}=RefItem1&JSON=1`, h.cookie()),
  ]);
  const refItemP = Number(riPR.json?.id), refItemN = Number(riNR.json?.id);
  if (refItemP > 0) created.php.objects.push(refItemP);
  if (refItemN > 0) created.node.objects.push(refItemN);

  // Add columns
  const [numPR, numNR] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfPhp}&val=__cmp_num_p_${TS}&t=11&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfNode}&val=__cmp_num_n_${TS}&t=11&JSON=1`, h.cookie()),
  ]);
  const numP = Number(numPR.json?.obj), numN = Number(numNR.json?.obj);
  if (numP > 0) created.php.types.push(numP);
  if (numN > 0) created.node.types.push(numN);

  await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_d_req/${typeP}`, `_xsrf=${h.xsrfPhp}&t=${numP}&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_d_req/${typeN}`, `_xsrf=${h.xsrfNode}&t=${numN}&JSON=1`, h.cookie()),
  ]);

  // Set number value on first object
  await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_m_set/${objs.php[0]}`, `_xsrf=${h.xsrfPhp}&t${numP}=42&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_m_set/${objs.node[0]}`, `_xsrf=${h.xsrfNode}&t${numN}=42&JSON=1`, h.cookie()),
  ]);

  console.log(`  Setup: typeP=${typeP} typeN=${typeN}, ${objs.php.length}+${objs.node.length} objects`);

  h.section('Auth & Session');

  // 1. POST /auth — correct credentials
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', '/auth', `login=${h.USER}&pwd=${h.PASS}&JSON=1`),
      h.http(h.NODE, 'POST', '/auth', `login=${h.USER}&pwd=${h.PASS}&JSON=1`),
    ]);
    record(1, 'POST /auth (correct)', 'POST', '/auth', php, node, 'token/xsrf values differ (expected)');
  }

  // 2. POST /auth — wrong password
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', '/auth', `login=${h.USER}&pwd=wrongpass&JSON=1`),
      h.http(h.NODE, 'POST', '/auth', `login=${h.USER}&pwd=wrongpass&JSON=1`),
    ]);
    record(2, 'POST /auth (wrong pwd)', 'POST', '/auth', php, node);
  }

  // 3. GET /xsrf
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/xsrf?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/xsrf?JSON=1`, null, h.cookie()),
    ]);
    record(3, 'GET /xsrf', 'GET', '/xsrf?JSON=1', php, node, 'xsrf values differ (expected)');
  }

  // 4. GET /validate
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/validate?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/validate?JSON=1`, null, h.cookie()),
    ]);
    record(4, 'GET /validate', 'GET', '/validate?JSON=1', php, node);
  }

  // 5. POST /getcode
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', '/getcode', `u=${h.USER}`),
      h.http(h.NODE, 'POST', '/getcode', `u=${h.USER}`),
    ]);
    record(5, 'POST /getcode', 'POST', '/getcode', php, node);
  }

  // 6. POST /checkcode (invalid)
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', '/checkcode', `u=${h.USER}&c=0000`),
      h.http(h.NODE, 'POST', '/checkcode', `u=${h.USER}&c=0000`),
    ]);
    record(6, 'POST /checkcode (invalid)', 'POST', '/checkcode', php, node);
  }

  h.section('Terms & Metadata');

  // 7. GET /terms
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/terms`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/terms`, null, h.cookie()),
    ]);
    record(7, 'GET /terms', 'GET', '/terms', php, node,
      `PHP: ${Array.isArray(php.json) ? php.json.length : '?'} types, Node: ${Array.isArray(node.json) ? node.json.length : '?'} types`);
  }

  // 8. GET /metadata
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/metadata?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/metadata?JSON=1`, null, h.cookie()),
    ]);
    record(8, 'GET /metadata', 'GET', '/metadata?JSON=1', php, node);
  }

  // 9. GET /obj_meta
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/obj_meta/${objs.php[0]}`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/obj_meta/${objs.node[0]}`, null, h.cookie()),
    ]);
    record(9, 'GET /obj_meta', 'GET', '/obj_meta/:id', php, node, 'IDs differ (expected)');
  }

  h.section('Type DDL');

  // 10. POST /_d_new
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfPhp}&val=__cmp_ddl_p_${TS}&t=3&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfNode}&val=__cmp_ddl_n_${TS}&t=3&JSON=1`, h.cookie()),
    ]);
    if (Number(php.json?.obj) > 0) created.php.types.push(Number(php.json.obj));
    if (Number(node.json?.obj) > 0) created.node.types.push(Number(node.json.obj));
    record(10, 'POST /_d_new (create type)', 'POST', '/_d_new', php, node);
  }

  // 11. POST /_d_save
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_save/${typeP}`, `_xsrf=${h.xsrfPhp}&val=__cmp_renamed_p_${TS}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_save/${typeN}`, `_xsrf=${h.xsrfNode}&val=__cmp_renamed_n_${TS}&JSON=1`, h.cookie()),
    ]);
    record(11, 'POST /_d_save (rename type)', 'POST', '/_d_save/:id', php, node);
  }

  // 12. POST /_d_req
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_req/${typeP}`, `_xsrf=${h.xsrfPhp}&t=${refP}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_req/${typeN}`, `_xsrf=${h.xsrfNode}&t=${refN}&JSON=1`, h.cookie()),
    ]);
    record(12, 'POST /_d_req (add column)', 'POST', '/_d_req/:id', php, node);
  }

  // 13. POST /_d_ref
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_ref/${typeP}`, `_xsrf=${h.xsrfPhp}&t=${refP}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_ref/${typeN}`, `_xsrf=${h.xsrfNode}&t=${refN}&JSON=1`, h.cookie()),
    ]);
    record(13, 'POST /_d_ref (add ref column)', 'POST', '/_d_ref/:id', php, node);
  }

  h.section('Object DML');

  // 14. POST /_m_new
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_new/${typeP}`, `_xsrf=${h.xsrfPhp}&up=1&t${typeP}=NewObj&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_new/${typeN}`, `_xsrf=${h.xsrfNode}&up=1&t${typeN}=NewObj&JSON=1`, h.cookie()),
    ]);
    if (Number(php.json?.id) > 0) created.php.objects.push(Number(php.json.id));
    if (Number(node.json?.id) > 0) created.node.objects.push(Number(node.json.id));
    record(14, 'POST /_m_new (create object)', 'POST', '/_m_new/:typeId', php, node);
  }

  // 15. POST /_m_save
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_save/${objs.php[0]}`, `_xsrf=${h.xsrfPhp}&t${typeP}=Updated&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_save/${objs.node[0]}`, `_xsrf=${h.xsrfNode}&t${typeN}=Updated&JSON=1`, h.cookie()),
    ]);
    record(15, 'POST /_m_save (update object)', 'POST', '/_m_save/:id', php, node);
  }

  // 16. POST /_m_set
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_set/${objs.php[1]}`, `_xsrf=${h.xsrfPhp}&t${numP}=99&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_set/${objs.node[1]}`, `_xsrf=${h.xsrfNode}&t${numN}=99&JSON=1`, h.cookie()),
    ]);
    record(16, 'POST /_m_set (set attribute)', 'POST', '/_m_set/:id', php, node);
  }

  // 17. POST /_m_save (copy)
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_save/${objs.php[0]}`, `_xsrf=${h.xsrfPhp}&copybtn&val=CopyObj&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_save/${objs.node[0]}`, `_xsrf=${h.xsrfNode}&copybtn&val=CopyObj&JSON=1`, h.cookie()),
    ]);
    if (Number(php.json?.id) > 0) created.php.objects.push(Number(php.json.id));
    if (Number(node.json?.id) > 0) created.node.objects.push(Number(node.json.id));
    record(17, 'POST /_m_save (copy object)', 'POST', '/_m_save/:id&copybtn', php, node);
  }

  // 18. POST /_m_ord
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_ord/${objs.php[0]}`, `_xsrf=${h.xsrfPhp}&order=2&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_ord/${objs.node[0]}`, `_xsrf=${h.xsrfNode}&order=2&JSON=1`, h.cookie()),
    ]);
    record(18, 'POST /_m_ord (set order)', 'POST', '/_m_ord/:id', php, node);
  }

  // 19. POST /_m_up
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_up/${objs.php[1]}`, `_xsrf=${h.xsrfPhp}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_up/${objs.node[1]}`, `_xsrf=${h.xsrfNode}&JSON=1`, h.cookie()),
    ]);
    record(19, 'POST /_m_up (move up)', 'POST', '/_m_up/:id', php, node);
  }

  // 20. POST /_m_id
  {
    const newId1 = 800000 + Math.floor(Math.random() * 100000);
    const newId2 = newId1 + 1;
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_id/${objs.php[2]}`, `_xsrf=${h.xsrfPhp}&new_id=${newId1}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_id/${objs.node[2]}`, `_xsrf=${h.xsrfNode}&new_id=${newId2}&JSON=1`, h.cookie()),
    ]);
    record(20, 'POST /_m_id (change ID)', 'POST', '/_m_id/:id', php, node);
    if (php.json?.id == newId1) {
      created.php.objects = created.php.objects.map(id => id === objs.php[2] ? newId1 : id);
      objs.php[2] = newId1;
    }
    if (node.json?.id == newId2) {
      created.node.objects = created.node.objects.map(id => id === objs.node[2] ? newId2 : id);
      objs.node[2] = newId2;
    }
  }

  h.section('Listing');

  // 21. GET /object/:typeId?JSON=1
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${typeP}?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1`, null, h.cookie()),
    ]);
    record(21, 'GET /object/:type?JSON=1', 'GET', '/object/:type?JSON=1', php, node,
      `PHP: ${php.json?.object?.length || 0} objs, Node: ${node.json?.object?.length || 0} objs`);
  }

  // 22. GET /object/:typeId?JSON_DATA
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${typeP}?JSON_DATA`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON_DATA`, null, h.cookie()),
    ]);
    record(22, 'GET /object/:type?JSON_DATA', 'GET', '/object/:type?JSON_DATA', php, node);
  }

  // 23. GET /object?JSON=1&LIMIT=2
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${typeP}?JSON=1&LIMIT=2`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1&LIMIT=2`, null, h.cookie()),
    ]);
    record(23, 'GET /object?JSON=1&LIMIT=2', 'GET', '/object/:type?JSON=1&LIMIT=2', php, node,
      `PHP: ${php.json?.object?.length || 0} objs, Node: ${node.json?.object?.length || 0} objs`);
  }

  // 24. GET /object?JSON=1&F_I=id
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${typeP}?JSON=1&F_I=${objs.php[0]}`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1&F_I=${objs.node[0]}`, null, h.cookie()),
    ]);
    record(24, 'GET /object?F_I=id', 'GET', '/object/:type?JSON=1&F_I=id', php, node);
  }

  // 25. GET /edit_obj
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/edit_obj/${objs.php[0]}?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/edit_obj/${objs.node[0]}?JSON=1`, null, h.cookie()),
    ]);
    record(25, 'GET /edit_obj/:id?JSON=1', 'GET', '/edit_obj/:id?JSON=1', php, node);
  }

  // 26. GET /edit_types
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/edit_types?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/edit_types?JSON=1`, null, h.cookie()),
    ]);
    record(26, 'GET /edit_types?JSON=1', 'GET', '/edit_types?JSON=1', php, node);
  }

  h.section('Reports');

  // Get a report ID
  const reportList = await h.http(h.NODE, 'GET', `/${h.DB}/report?JSON=1`, null, h.cookie());
  const reportId = reportList.json?.[0]?.id || reportList.json?.[0]?.ID;

  if (reportId) {
    // 27. GET /report/:id?JSON=1
    {
      const [php, node] = await Promise.all([
        h.http(h.PHP, 'GET', `/${h.DB}/report/${reportId}?JSON=1`, null, h.cookie()),
        h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON=1`, null, h.cookie()),
      ]);
      record(27, 'GET /report/:id?JSON=1', 'GET', '/report/:id?JSON=1', php, node);
    }

    // 28. GET /report/:id?JSON_KV
    {
      const [php, node] = await Promise.all([
        h.http(h.PHP, 'GET', `/${h.DB}/report/${reportId}?JSON_KV`, null, h.cookie()),
        h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON_KV`, null, h.cookie()),
      ]);
      record(28, 'GET /report/:id?JSON_KV', 'GET', '/report/:id?JSON_KV', php, node);
    }

    // 29. GET /report/:id?JSON_CR
    {
      const [php, node] = await Promise.all([
        h.http(h.PHP, 'GET', `/${h.DB}/report/${reportId}?JSON_CR`, null, h.cookie()),
        h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON_CR`, null, h.cookie()),
      ]);
      record(29, 'GET /report/:id?JSON_CR', 'GET', '/report/:id?JSON_CR', php, node);
    }

    // 30. GET /report/:id?RECORD_COUNT
    {
      const [php, node] = await Promise.all([
        h.http(h.PHP, 'GET', `/${h.DB}/report/${reportId}?RECORD_COUNT`, null, h.cookie()),
        h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?RECORD_COUNT`, null, h.cookie()),
      ]);
      record(30, 'GET /report/:id?RECORD_COUNT', 'GET', '/report/:id?RECORD_COUNT', php, node);
    }

    // 31. GET /report/:id?JSON_KV&LIMIT=2
    {
      const [php, node] = await Promise.all([
        h.http(h.PHP, 'GET', `/${h.DB}/report/${reportId}?JSON_KV&LIMIT=2`, null, h.cookie()),
        h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON_KV&LIMIT=2`, null, h.cookie()),
      ]);
      record(31, 'GET /report?JSON_KV&LIMIT=2', 'GET', '/report/:id?JSON_KV&LIMIT=2', php, node);
    }
  } else {
    console.log('  No reports available, skipping 27-31');
  }

  h.section('Pages & System');

  // 32. GET /dict?JSON=1
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/dict?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/dict?JSON=1`, null, h.cookie()),
    ]);
    record(32, 'GET /dict?JSON=1', 'GET', '/dict?JSON=1', php, node);
  }

  // 33. GET /sql?JSON=1
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/sql?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/sql?JSON=1`, null, h.cookie()),
    ]);
    record(33, 'GET /sql?JSON=1', 'GET', '/sql?JSON=1', php, node);
  }

  // 34. GET /form?JSON=1
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/form?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/form?JSON=1`, null, h.cookie()),
    ]);
    record(34, 'GET /form?JSON=1', 'GET', '/form?JSON=1', php, node);
  }

  // 35. GET /terms invalid db
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', '/nonexistent_db_xyz/terms', null, h.cookie()),
      h.http(h.NODE, 'GET', '/nonexistent_db_xyz/terms', null, h.cookie()),
    ]);
    record(35, 'GET /terms (invalid db)', 'GET', '/nonexistent_db/terms', php, node);
  }

  // 36. POST /_m_del (delete)
  {
    const delP = objs.php[2], delN = objs.node[2];
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_del/${delP}`, `_xsrf=${h.xsrfPhp}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_del/${delN}`, `_xsrf=${h.xsrfNode}&JSON=1`, h.cookie()),
    ]);
    record(36, 'POST /_m_del (delete object)', 'POST', '/_m_del/:id', php, node);
    created.php.objects = created.php.objects.filter(id => id !== delP);
    created.node.objects = created.node.objects.filter(id => id !== delN);
  }

  // ── Cleanup ──
  h.section('Cleanup');
  let cleaned = 0;
  for (const [base, xsrf, data] of [[h.PHP, h.xsrfPhp, created.php], [h.NODE, h.xsrfNode, created.node]]) {
    for (const id of data.objects) {
      await h.http(base, 'POST', `/${h.DB}/_m_del/${id}`, `_xsrf=${xsrf}&JSON=1`, h.cookie());
      cleaned++;
    }
    for (const id of [...data.types].reverse()) {
      await h.http(base, 'POST', `/${h.DB}/_d_del/${id}`, `_xsrf=${xsrf}&JSON=1&forced`, h.cookie());
      cleaned++;
    }
  }
  console.log(`  Cleaned ${cleaned} entities`);

  // ── Generate MD report ──
  let md = `# PHP vs Node.js Response Comparison\n\nDate: ${new Date().toISOString().slice(0, 10)}\n\n`;
  md += `| # | Test | Method | Path | PHP | Node | Match | Notes |\n`;
  md += `|---|------|--------|------|-----|------|-------|-------|\n`;
  for (const r of results) {
    const matchIcon = r.match ? 'MATCH' : 'DIFF';
    md += `| ${r.num} | ${r.name} | ${r.method} | \`${r.path}\` | ${r.phpStatus} | ${r.nodeStatus} | ${matchIcon} | ${r.notes} |\n`;
  }

  md += `\n## Detailed Responses\n\n`;
  for (const r of results) {
    md += `### ${r.num}. ${r.name}\n\n`;
    md += `**${r.method} \`${r.path}\`**\n\n`;
    md += `| | Status | Body (first 300 chars) |\n`;
    md += `|---|--------|------------------------|\n`;
    md += `| PHP | ${r.phpStatus} | \`${r.phpBody.replace(/\|/g, '\\|').replace(/\n/g, ' ')}\` |\n`;
    md += `| Node | ${r.nodeStatus} | \`${r.nodeBody.replace(/\|/g, '\\|').replace(/\n/g, ' ')}\` |\n`;
    if (r.notes) md += `\n> ${r.notes}\n`;
    md += `\n`;
  }

  const matchCount = results.filter(r => r.match).length;
  const diffCount = results.filter(r => !r.match).length;
  md += `## Summary\n\n**${matchCount} MATCH / ${diffCount} DIFF** out of ${results.length} tests.\n`;

  writeFileSync('tests/integration/RESPONSE-COMPARISON.md', md);
  console.log(`\n  Wrote RESPONSE-COMPARISON.md: ${matchCount} MATCH / ${diffCount} DIFF`);
}

run().catch(err => { console.error(err); process.exit(1); });
