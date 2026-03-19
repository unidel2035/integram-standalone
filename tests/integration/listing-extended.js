#!/usr/bin/env node
/**
 * Extended Listing & Querying parity tests.
 * Covers: F_I, JSON_DATA+LIMIT, JSON_DATA+F_U, _list params (q, sort, LIMIT, F),
 * _list_join params, _ref_reqs params, edit_obj nonexistent, metadata/:typeId.
 */
import h from './lib/helpers.js';
const TS = Date.now();
const created = { php: { types: [], objects: [] }, node: { types: [], objects: [] } };

async function run() {
  await h.setup();
  console.log(`Token: ${h.token.slice(0, 8)}...`);

  // Create test type + objects
  const [pt, nt] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfPhp}&val=__lstx_p_${TS}&t=3&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfNode}&val=__lstx_n_${TS}&t=3&JSON=1`, h.cookie()),
  ]);
  const typeP = Number(pt.json?.obj), typeN = Number(nt.json?.obj);
  if (typeP > 0) created.php.types.push(typeP);
  if (typeN > 0) created.node.types.push(typeN);
  if (!typeP || !typeN) { console.error('Type creation failed'); process.exit(1); }

  // Create 5 objects
  const objIds = { php: [], node: [] };
  for (let i = 0; i < 5; i++) {
    const [po, no] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_new/${typeP}`, `_xsrf=${h.xsrfPhp}&up=1&t${typeP}=item_${i}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_new/${typeN}`, `_xsrf=${h.xsrfNode}&up=1&t${typeN}=item_${i}&JSON=1`, h.cookie()),
    ]);
    const pId = Number(po.json?.id), nId = Number(no.json?.id);
    if (pId > 0) { objIds.php.push(pId); created.php.objects.push(pId); }
    if (nId > 0) { objIds.node.push(nId); created.node.objects.push(nId); }
  }
  console.log(`  Created type PHP=${typeP} Node=${typeN}, ${objIds.php.length}+${objIds.node.length} objects`);

  // Create child under first object
  if (objIds.php[0] && objIds.node[0]) {
    const [po, no] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_new/${typeP}`, `_xsrf=${h.xsrfPhp}&up=${objIds.php[0]}&t${typeP}=child_item&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_new/${typeN}`, `_xsrf=${h.xsrfNode}&up=${objIds.node[0]}&t${typeN}=child_item&JSON=1`, h.cookie()),
    ]);
    if (Number(po.json?.id) > 0) { objIds.php.push(Number(po.json.id)); created.php.objects.push(Number(po.json.id)); }
    if (Number(no.json?.id) > 0) { objIds.node.push(Number(no.json.id)); created.node.objects.push(Number(no.json.id)); }
  }

  h.section('Listing — F_I Filter');

  // F_I=objectId
  if (objIds.php[0] && objIds.node[0]) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${typeP}?JSON=1&F_I=${objIds.php[0]}`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1&F_I=${objIds.node[0]}`, null, h.cookie()),
    ]);
    const issues = [];
    if (node.json?.object) {
      if (node.json.object.length !== 1) issues.push(`Expected 1 got ${node.json.object.length}`);
      if (node.json.object[0]?.id != objIds.node[0]) issues.push(`Wrong ID`);
    }
    h.report('F_I=objectId', issues);
  }

  // F_I nonexistent
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${typeP}?JSON=1&F_I=999999999`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1&F_I=999999999`, null, h.cookie()),
    ]);
    const nLen = Array.isArray(node.json?.object) ? node.json.object.length : 0;
    h.report('F_I nonexistent', nLen !== 0 ? [`Got ${nLen} objects`] : []);
  }

  h.section('Listing — JSON_DATA Variants');

  // JSON_DATA + LIMIT
  {
    const r = await h.cmp('JSON_DATA+LIMIT', 'GET', `/object/${typeP}?JSON_DATA&LIMIT=2`);
    if (!r.skipped) {
      const issues = [];
      if (Array.isArray(r.node.json) && r.node.json.length > 2) issues.push(`Node ${r.node.json.length} with LIMIT=2`);
      h.report('JSON_DATA LIMIT=2', issues);
    } else {
      // Node-only check
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON_DATA&LIMIT=2`, null, h.cookie());
      h.nodeOnly('JSON_DATA LIMIT=2', n, (n, iss) => {
        if (Array.isArray(n.json) && n.json.length > 2) iss.push(`${n.json.length} items`);
      });
    }
  }

  // JSON_DATA + F_U (filter by parent)
  if (objIds.php[0] && objIds.node[0]) {
    const r = await h.cmp('JSON_DATA+F_U', 'GET', `/object/${typeP}?JSON_DATA&F_U=${objIds.php[0]}`);
    if (!r.skipped) {
      h.report('JSON_DATA F_U', r.php.status !== r.node.status ? [`Status`] : []);
    } else {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON_DATA&F_U=${objIds.node[0]}`, null, h.cookie());
      h.nodeOnly('JSON_DATA F_U', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    }
  }

  // F_U=0 (root objects only)
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${typeP}?JSON=1&F_U=0`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1&F_U=0`, null, h.cookie()),
    ]);
    h.report('F_U=0 root only', php.status !== node.status ? [`Status`] : []);
  }

  // F_TYPEID=value (filter by main value)
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${typeP}?JSON=1&F_${typeP}=item_0`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1&F_${typeN}=item_0`, null, h.cookie()),
    ]);
    const issues = [];
    if (node.json?.object) {
      const matching = node.json.object.filter(o => (o.val || '').includes('item_0'));
      if (matching.length === 0) issues.push('Filter did not match');
    }
    h.report('F_TYPEID=value', issues);
  }

  h.section('Listing — _list Params');

  // _list LIMIT
  {
    const r = await h.cmp('_list LIMIT=2', 'GET', `/_list/${typeP}?JSON=1&LIMIT=2`);
    if (r.skipped) {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/_list/${typeN}?JSON=1&LIMIT=2`, null, h.cookie());
      h.nodeOnly('_list LIMIT=2', n, (n, iss) => {
        if (n.json?.data && n.json.data.length > 2) iss.push(`${n.json.data.length} items`);
      });
    } else h.report('_list LIMIT=2', []);
  }

  // _list with q=search
  {
    const r = await h.cmp('_list q=item_0', 'GET', `/_list/${typeP}?JSON=1&q=item_0`);
    if (r.skipped) {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/_list/${typeN}?JSON=1&q=item_0`, null, h.cookie());
      h.nodeOnly('_list q=item_0', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    } else h.report('_list q=item_0', []);
  }

  // _list with sort
  {
    const r = await h.cmp('_list sort=val', 'GET', `/_list/${typeP}?JSON=1&sort=val&dir=desc`);
    if (r.skipped) {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/_list/${typeN}?JSON=1&sort=val&dir=desc`, null, h.cookie());
      h.nodeOnly('_list sort desc', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    } else h.report('_list sort desc', []);
  }

  // _list with offset (F=2)
  {
    const r = await h.cmp('_list F=2', 'GET', `/_list/${typeP}?JSON=1&F=2`);
    if (r.skipped) {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/_list/${typeN}?JSON=1&F=2`, null, h.cookie());
      h.nodeOnly('_list F=2', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    } else h.report('_list F=2', []);
  }

  // _list with up=parentId
  if (objIds.node[0]) {
    const r = await h.cmp('_list up=parent', 'GET', `/_list/${typeP}?JSON=1&up=${objIds.php[0]}`);
    if (r.skipped) {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/_list/${typeN}?JSON=1&up=${objIds.node[0]}`, null, h.cookie());
      h.nodeOnly('_list up=parent', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    } else h.report('_list up=parent', []);
  }

  h.section('Listing — _list_join Params');

  // _list_join with q=
  {
    const r = await h.cmp('_list_join q=item', 'GET', `/_list_join/${typeP}?JSON=1&q=item`);
    if (r.skipped) {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/_list_join/${typeN}?JSON=1&q=item`, null, h.cookie());
      h.nodeOnly('_list_join q=item', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    } else h.report('_list_join q=item', []);
  }

  // _list_join LIMIT
  {
    const r = await h.cmp('_list_join LIMIT=2', 'GET', `/_list_join/${typeP}?JSON=1&LIMIT=2&F=0`);
    if (r.skipped) {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/_list_join/${typeN}?JSON=1&LIMIT=2&F=0`, null, h.cookie());
      h.nodeOnly('_list_join LIMIT=2', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    } else h.report('_list_join LIMIT=2', []);
  }

  h.section('Listing — Edit & Metadata Extended');

  // edit_obj nonexistent — PHP returns 200 HTML page, Node returns 404 JSON error
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/edit_obj/999999999?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/edit_obj/999999999?JSON=1`, null, h.cookie()),
    ]);
    if (!php.json) {
      // PHP returned HTML (not JSON), can only check Node
      h.nodeOnly('edit_obj nonexistent', node, (n, iss) => {
        if (n.status === 200 && !n.json?.error && !n.json?.[0]?.error) iss.push('Should return error for nonexistent');
      });
    } else {
      h.report('edit_obj nonexistent', php.status !== node.status ? [`Status: PHP=${php.status} Node=${node.status}`] : []);
    }
  }

  // metadata/:typeId
  {
    const { php, node, skipped } = await h.cmp('metadata/:typeId', 'GET', `/metadata/${typeP}`);
    if (!skipped) {
      const issues = [];
      if (php.json && node.json) {
        if ((typeof php.json) !== (typeof node.json)) issues.push('Type differs');
      }
      h.report('metadata/:typeId', issues);
    } else {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/metadata/${typeN}`, null, h.cookie());
      h.nodeOnly('metadata/:typeId', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    }
  }

  // metadata nonexistent
  {
    const { php, node, skipped } = await h.cmp('metadata/999999999', 'GET', '/metadata/999999999');
    if (!skipped) h.report('metadata nonexistent', php.status !== node.status ? [`Status`] : []);
  }

  // terms invalid db
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', '/nonexistent_db_xyz/terms', null, h.cookie()),
      h.http(h.NODE, 'GET', '/nonexistent_db_xyz/terms', null, h.cookie()),
    ]);
    h.report('terms invalid db', php.status !== node.status ? [`Status: PHP=${php.status} Node=${node.status}`] : []);
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

  h.summary('Listing Extended');
}

run().catch(err => { console.error(err); process.exit(1); });
