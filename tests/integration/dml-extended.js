#!/usr/bin/env node
/**
 * Extended DML parity tests.
 * Covers: _m_new empty val / with explicit type, _m_del forced/cascade,
 * _m_ord order=999, _m_id new_id=0 / same_id, _m_save with tzone/tab.
 */
import h from './lib/helpers.js';
const TS = Date.now();
const created = { php: { types: [], objects: [] }, node: { types: [], objects: [] } };

async function run() {
  await h.setup();
  console.log(`Token: ${h.token.slice(0, 8)}...`);

  // Create test type
  const [pt, nt] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfPhp}&val=__dmlx_p_${TS}&t=3&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfNode}&val=__dmlx_n_${TS}&t=3&JSON=1`, h.cookie()),
  ]);
  const typeP = Number(pt.json?.obj), typeN = Number(nt.json?.obj);
  if (typeP > 0) created.php.types.push(typeP);
  if (typeN > 0) created.node.types.push(typeN);
  if (!typeP || !typeN) { console.error('Type creation failed'); process.exit(1); }

  h.section('DML — _m_new Variants');

  // _m_new empty value
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_new/${typeP}`, `_xsrf=${h.xsrfPhp}&up=1&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_new/${typeN}`, `_xsrf=${h.xsrfNode}&up=1&JSON=1`, h.cookie()),
    ]);
    if (Number(php.json?.id) > 0) created.php.objects.push(Number(php.json.id));
    if (Number(node.json?.id) > 0) created.node.objects.push(Number(node.json.id));
    h.report('_m_new empty value', php.status !== node.status ? [`Status: PHP=${php.status} Node=${node.status}`] : []);
  }

  // _m_new with explicit type= param
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_new/${typeP}`, `_xsrf=${h.xsrfPhp}&up=1&type=${typeP}&t${typeP}=explicit_type&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_new/${typeN}`, `_xsrf=${h.xsrfNode}&up=1&type=${typeN}&t${typeN}=explicit_type&JSON=1`, h.cookie()),
    ]);
    if (Number(php.json?.id) > 0) created.php.objects.push(Number(php.json.id));
    if (Number(node.json?.id) > 0) created.node.objects.push(Number(node.json.id));
    h.report('_m_new explicit type=', php.status !== node.status ? [`Status`] : []);
  }

  // Create several objects for move/order/delete tests
  const objIds = { php: [], node: [] };
  for (let i = 0; i < 4; i++) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_new/${typeP}`, `_xsrf=${h.xsrfPhp}&up=1&t${typeP}=obj_${i}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_new/${typeN}`, `_xsrf=${h.xsrfNode}&up=1&t${typeN}=obj_${i}&JSON=1`, h.cookie()),
    ]);
    const pId = Number(php.json?.id), nId = Number(node.json?.id);
    if (pId > 0) { objIds.php.push(pId); created.php.objects.push(pId); }
    if (nId > 0) { objIds.node.push(nId); created.node.objects.push(nId); }
  }

  // Create child for cascade tests
  if (objIds.php[0] && objIds.node[0]) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_new/${typeP}`, `_xsrf=${h.xsrfPhp}&up=${objIds.php[0]}&t${typeP}=child_cascade&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_new/${typeN}`, `_xsrf=${h.xsrfNode}&up=${objIds.node[0]}&t${typeN}=child_cascade&JSON=1`, h.cookie()),
    ]);
    if (Number(php.json?.id) > 0) created.php.objects.push(Number(php.json.id));
    if (Number(node.json?.id) > 0) created.node.objects.push(Number(node.json.id));
  }

  h.section('DML — _m_save Variants');

  // _m_save with tab=2 (redirect args)
  if (objIds.php[0] && objIds.node[0]) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_save/${objIds.php[0]}`, `_xsrf=${h.xsrfPhp}&val=with_tab&tab=2&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_save/${objIds.node[0]}`, `_xsrf=${h.xsrfNode}&val=with_tab&tab=2&JSON=1`, h.cookie()),
    ]);
    h.report('_m_save tab=2', php.status !== node.status ? [`Status`] : []);
  }

  // _m_save with tzone=3
  if (objIds.php[0] && objIds.node[0]) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_save/${objIds.php[0]}`, `_xsrf=${h.xsrfPhp}&val=with_tzone&tzone=3&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_save/${objIds.node[0]}`, `_xsrf=${h.xsrfNode}&val=with_tzone&tzone=3&JSON=1`, h.cookie()),
    ]);
    h.report('_m_save tzone=3', php.status !== node.status ? [`Status`] : []);
  }

  h.section('DML — _m_ord Extended');

  // order=999 (beyond count)
  if (objIds.php[0] && objIds.node[0]) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_ord/${objIds.php[0]}`, `_xsrf=${h.xsrfPhp}&order=999&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_ord/${objIds.node[0]}`, `_xsrf=${h.xsrfNode}&order=999&JSON=1`, h.cookie()),
    ]);
    h.report('_m_ord order=999', php.status !== node.status ? [`Status`] : []);
  }

  h.section('DML — _m_id Extended');

  // _m_id same ID (no change)
  if (objIds.php[1] && objIds.node[1]) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_id/${objIds.php[1]}`, `_xsrf=${h.xsrfPhp}&new_id=${objIds.php[1]}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_id/${objIds.node[1]}`, `_xsrf=${h.xsrfNode}&new_id=${objIds.node[1]}&JSON=1`, h.cookie()),
    ]);
    h.report('_m_id same ID', php.status !== node.status ? [`Status`] : []);
  }

  // _m_id new_id=0 (invalid)
  if (objIds.php[1] && objIds.node[1]) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_id/${objIds.php[1]}`, `_xsrf=${h.xsrfPhp}&new_id=0&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_id/${objIds.node[1]}`, `_xsrf=${h.xsrfNode}&new_id=0&JSON=1`, h.cookie()),
    ]);
    if (php.status >= 500) h.skip('_m_id new_id=0', 'PHP 500');
    else h.report('_m_id new_id=0', php.status !== node.status ? [`Status: PHP=${php.status} Node=${node.status}`] : []);
  }

  h.section('DML — _m_move Extended');

  // _m_move same parent (no-op)
  if (objIds.php[2] && objIds.node[2]) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_move/${objIds.php[2]}`, `_xsrf=${h.xsrfPhp}&up=1&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_move/${objIds.node[2]}`, `_xsrf=${h.xsrfNode}&up=1&JSON=1`, h.cookie()),
    ]);
    h.report('_m_move same parent', php.status !== node.status ? [`Status`] : []);
  }

  h.section('DML — _m_del Variants');

  // _m_del cascade (parent with children) — obj[0] has a child
  if (objIds.php[0] && objIds.node[0]) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_del/${objIds.php[0]}`, `_xsrf=${h.xsrfPhp}&cascade=1&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_del/${objIds.node[0]}`, `_xsrf=${h.xsrfNode}&cascade=1&JSON=1`, h.cookie()),
    ]);
    h.report('_m_del cascade', php.status !== node.status ? [`Status`] : []);
    created.php.objects = created.php.objects.filter(id => id !== objIds.php[0]);
    created.node.objects = created.node.objects.filter(id => id !== objIds.node[0]);
  }

  // _m_del forced
  if (objIds.php[1] && objIds.node[1]) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_del/${objIds.php[1]}`, `_xsrf=${h.xsrfPhp}&forced&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_del/${objIds.node[1]}`, `_xsrf=${h.xsrfNode}&forced&JSON=1`, h.cookie()),
    ]);
    h.report('_m_del forced', php.status !== node.status ? [`Status`] : []);
    created.php.objects = created.php.objects.filter(id => id !== objIds.php[1]);
    created.node.objects = created.node.objects.filter(id => id !== objIds.node[1]);
  }

  // _m_del nonexistent
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_del/999999999`, `_xsrf=${h.xsrfPhp}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_del/999999999`, `_xsrf=${h.xsrfNode}&JSON=1`, h.cookie()),
    ]);
    h.report('_m_del nonexistent', php.status !== node.status ? [`Status`] : []);
  }

  // Cleanup
  h.section('Cleanup');
  let cleaned = 0;
  for (const [base, xsrf, data] of [[h.PHP, h.xsrfPhp, created.php], [h.NODE, h.xsrfNode, created.node]]) {
    for (const id of data.objects) {
      await h.http(base, 'POST', `/${h.DB}/_m_del/${id}`, `_xsrf=${xsrf}&JSON=1`, h.cookie());
      cleaned++;
    }
    for (const id of data.types) {
      await h.http(base, 'POST', `/${h.DB}/_d_del/${id}`, `_xsrf=${xsrf}&JSON=1&forced`, h.cookie());
      cleaned++;
    }
  }
  console.log(`  Cleaned ${cleaned} entities`);

  h.summary('DML Extended');
}

run().catch(err => { console.error(err); process.exit(1); });
