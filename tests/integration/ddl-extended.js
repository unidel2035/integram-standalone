#!/usr/bin/env node
/**
 * Extended DDL parity tests.
 * Covers: subtypes, empty name, GRANT base type, _d_req flags (multi/required/alias),
 * self-ref, _d_null explicit, _d_multi explicit, _d_ord=999, _d_del_req nonexistent, _d_ref nonexistent.
 */
import h from './lib/helpers.js';
const TS = Date.now();
const created = { php: [], node: [] };

async function createType(name, baseType, extra = '') {
  const [php, node] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfPhp}&val=${name}_p&t=${baseType}${extra}&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfNode}&val=${name}_n&t=${baseType}${extra}&JSON=1`, h.cookie()),
  ]);
  const pId = Number(php.json?.obj), nId = Number(node.json?.obj);
  if (pId > 0) created.php.push(pId);
  if (nId > 0) created.node.push(nId);
  return { pId, nId, php, node };
}

async function run() {
  await h.setup();
  console.log(`Token: ${h.token.slice(0, 8)}...`);

  h.section('DDL — Subtypes & Special Base Types');

  // Create parent type
  const parent = await createType(`__ddlx_parent_${TS}`, 3);
  h.report('_d_new parent', parent.php.status !== parent.node.status ? [`Status`] : []);

  // Create subtype (up=parentId)
  if (parent.pId && parent.nId) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfPhp}&val=__ddlx_sub_p_${TS}&t=3&up=${parent.pId}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfNode}&val=__ddlx_sub_n_${TS}&t=3&up=${parent.nId}&JSON=1`, h.cookie()),
    ]);
    if (Number(php.json?.obj) > 0) created.php.push(Number(php.json.obj));
    if (Number(node.json?.obj) > 0) created.node.push(Number(node.json.obj));
    h.report('_d_new subtype', php.status !== node.status ? [`Status: PHP=${php.status} Node=${node.status}`] : []);
  }

  // Empty name
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfPhp}&val=&t=3&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfNode}&val=&t=3&JSON=1`, h.cookie()),
    ]);
    // Both should create (PHP allows empty, might set default name)
    if (Number(php.json?.obj) > 0) created.php.push(Number(php.json.obj));
    if (Number(node.json?.obj) > 0) created.node.push(Number(node.json.obj));
    h.report('_d_new empty name', php.status !== node.status ? [`Status`] : []);
  }

  // GRANT base type (t=23)
  {
    const grant = await createType(`__ddlx_grant_${TS}`, 23);
    h.report('_d_new t=23 GRANT', grant.php.status !== grant.node.status ? [`Status`] : []);
  }

  // _d_save change base type
  if (parent.pId && parent.nId) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_save/${parent.pId}`, `_xsrf=${h.xsrfPhp}&t=11&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_save/${parent.nId}`, `_xsrf=${h.xsrfNode}&t=11&JSON=1`, h.cookie()),
    ]);
    h.report('_d_save change base', php.status !== node.status ? [`Status`] : []);

    // Change back to CHARS for later tests
    await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_save/${parent.pId}`, `_xsrf=${h.xsrfPhp}&t=3&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_save/${parent.nId}`, `_xsrf=${h.xsrfNode}&t=3&JSON=1`, h.cookie()),
    ]);
  }

  h.section('DDL — _d_req Flags');

  // Create a column type for testing
  const colType = await createType(`__ddlx_col_${TS}`, 3);

  if (parent.pId && parent.nId && colType.pId && colType.nId) {
    // _d_req with multi=1 (alternate flag)
    // First add normal column
    const [r1p, r1n] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_req/${parent.pId}`, `_xsrf=${h.xsrfPhp}&t=${colType.pId}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_req/${parent.nId}`, `_xsrf=${h.xsrfNode}&t=${colType.nId}&JSON=1`, h.cookie()),
    ]);
    h.report('_d_req normal', r1p.status !== r1n.status ? [`Status`] : []);
    const reqPId = Number(r1p.json?.id), reqNId = Number(r1n.json?.id);

    // _d_req duplicate (should return warning, not error)
    {
      const [php, node] = await Promise.all([
        h.http(h.PHP, 'POST', `/${h.DB}/_d_req/${parent.pId}`, `_xsrf=${h.xsrfPhp}&t=${colType.pId}&JSON=1`, h.cookie()),
        h.http(h.NODE, 'POST', `/${h.DB}/_d_req/${parent.nId}`, `_xsrf=${h.xsrfNode}&t=${colType.nId}&JSON=1`, h.cookie()),
      ]);
      h.report('_d_req duplicate', php.status !== node.status ? [`Status`] : []);
    }

    // _d_req self-reference (should error)
    {
      const [php, node] = await Promise.all([
        h.http(h.PHP, 'POST', `/${h.DB}/_d_req/${parent.pId}`, `_xsrf=${h.xsrfPhp}&t=${parent.pId}&JSON=1`, h.cookie()),
        h.http(h.NODE, 'POST', `/${h.DB}/_d_req/${parent.nId}`, `_xsrf=${h.xsrfNode}&t=${parent.nId}&JSON=1`, h.cookie()),
      ]);
      h.report('_d_req self-ref', php.status !== node.status ? [`Status`] : []);
    }

    h.section('DDL — _d_null/_d_multi Explicit Params');

    if (reqPId && reqNId) {
      // _d_null explicit required=1
      {
        const [php, node] = await Promise.all([
          h.http(h.PHP, 'POST', `/${h.DB}/_d_null/${reqPId}`, `_xsrf=${h.xsrfPhp}&required=1&JSON=1`, h.cookie()),
          h.http(h.NODE, 'POST', `/${h.DB}/_d_null/${reqNId}`, `_xsrf=${h.xsrfNode}&required=1&JSON=1`, h.cookie()),
        ]);
        h.report('_d_null required=1', php.status !== node.status ? [`Status`] : []);
      }

      // _d_null explicit required=0
      {
        const [php, node] = await Promise.all([
          h.http(h.PHP, 'POST', `/${h.DB}/_d_null/${reqPId}`, `_xsrf=${h.xsrfPhp}&required=0&JSON=1`, h.cookie()),
          h.http(h.NODE, 'POST', `/${h.DB}/_d_null/${reqNId}`, `_xsrf=${h.xsrfNode}&required=0&JSON=1`, h.cookie()),
        ]);
        h.report('_d_null required=0', php.status !== node.status ? [`Status`] : []);
      }

      // _d_multi explicit multi=1
      {
        const [php, node] = await Promise.all([
          h.http(h.PHP, 'POST', `/${h.DB}/_d_multi/${reqPId}`, `_xsrf=${h.xsrfPhp}&multi=1&JSON=1`, h.cookie()),
          h.http(h.NODE, 'POST', `/${h.DB}/_d_multi/${reqNId}`, `_xsrf=${h.xsrfNode}&multi=1&JSON=1`, h.cookie()),
        ]);
        h.report('_d_multi multi=1', php.status !== node.status ? [`Status`] : []);
      }

      // _d_multi explicit multi=0
      {
        const [php, node] = await Promise.all([
          h.http(h.PHP, 'POST', `/${h.DB}/_d_multi/${reqPId}`, `_xsrf=${h.xsrfPhp}&multi=0&JSON=1`, h.cookie()),
          h.http(h.NODE, 'POST', `/${h.DB}/_d_multi/${reqNId}`, `_xsrf=${h.xsrfNode}&multi=0&JSON=1`, h.cookie()),
        ]);
        h.report('_d_multi multi=0', php.status !== node.status ? [`Status`] : []);
      }

      // _d_ord order=999 (beyond count)
      {
        const [php, node] = await Promise.all([
          h.http(h.PHP, 'POST', `/${h.DB}/_d_ord/${reqPId}`, `_xsrf=${h.xsrfPhp}&order=999&JSON=1`, h.cookie()),
          h.http(h.NODE, 'POST', `/${h.DB}/_d_ord/${reqNId}`, `_xsrf=${h.xsrfNode}&order=999&JSON=1`, h.cookie()),
        ]);
        h.report('_d_ord order=999', php.status !== node.status ? [`Status`] : []);
      }

      // _d_alias with val=NewName (rename via alias endpoint)
      {
        const [php, node] = await Promise.all([
          h.http(h.PHP, 'POST', `/${h.DB}/_d_alias/${reqPId}`, `_xsrf=${h.xsrfPhp}&val=renamed_ddlx&JSON=1`, h.cookie()),
          h.http(h.NODE, 'POST', `/${h.DB}/_d_alias/${reqNId}`, `_xsrf=${h.xsrfNode}&val=renamed_ddlx&JSON=1`, h.cookie()),
        ]);
        h.report('_d_alias val=rename', php.status !== node.status ? [`Status`] : []);
      }

      // _d_attrs all params
      {
        const [php, node] = await Promise.all([
          h.http(h.PHP, 'POST', `/${h.DB}/_d_attrs/${reqPId}`, `_xsrf=${h.xsrfPhp}&alias=full_alias&required=1&multi=1&name=full_name&JSON=1`, h.cookie()),
          h.http(h.NODE, 'POST', `/${h.DB}/_d_attrs/${reqNId}`, `_xsrf=${h.xsrfNode}&alias=full_alias&required=1&multi=1&name=full_name&JSON=1`, h.cookie()),
        ]);
        h.report('_d_attrs all params', php.status !== node.status ? [`Status`] : []);
      }

      // Undo NOT NULL for cleanup
      await Promise.all([
        h.http(h.PHP, 'POST', `/${h.DB}/_d_attrs/${reqPId}`, `_xsrf=${h.xsrfPhp}&set_null=1&JSON=1`, h.cookie()),
        h.http(h.NODE, 'POST', `/${h.DB}/_d_attrs/${reqNId}`, `_xsrf=${h.xsrfNode}&set_null=1&JSON=1`, h.cookie()),
      ]);

      // _d_del_req the column
      {
        const [php, node] = await Promise.all([
          h.http(h.PHP, 'POST', `/${h.DB}/_d_del_req/${reqPId}`, `_xsrf=${h.xsrfPhp}&JSON=1`, h.cookie()),
          h.http(h.NODE, 'POST', `/${h.DB}/_d_del_req/${reqNId}`, `_xsrf=${h.xsrfNode}&JSON=1`, h.cookie()),
        ]);
        h.report('_d_del_req valid', php.status !== node.status ? [`Status`] : []);
      }
    }

    // _d_del_req nonexistent
    {
      const [php, node] = await Promise.all([
        h.http(h.PHP, 'POST', `/${h.DB}/_d_del_req/999999999`, `_xsrf=${h.xsrfPhp}&JSON=1`, h.cookie()),
        h.http(h.NODE, 'POST', `/${h.DB}/_d_del_req/999999999`, `_xsrf=${h.xsrfNode}&JSON=1`, h.cookie()),
      ]);
      h.report('_d_del_req nonexistent', php.status !== node.status ? [`Status`] : []);
    }

    // _d_ref nonexistent type
    {
      const [php, node] = await Promise.all([
        h.http(h.PHP, 'POST', `/${h.DB}/_d_ref/${parent.pId}`, `_xsrf=${h.xsrfPhp}&t=999999999&JSON=1`, h.cookie()),
        h.http(h.NODE, 'POST', `/${h.DB}/_d_ref/${parent.nId}`, `_xsrf=${h.xsrfNode}&t=999999999&JSON=1`, h.cookie()),
      ]);
      h.report('_d_ref nonexistent', php.status !== node.status ? [`Status`] : []);
    }
  }

  // Cleanup
  h.section('Cleanup');
  let cleaned = 0;
  for (const [base, xsrf, ids] of [[h.PHP, h.xsrfPhp, created.php], [h.NODE, h.xsrfNode, created.node]]) {
    for (const id of ids) {
      await h.http(base, 'POST', `/${h.DB}/_d_del/${id}`, `_xsrf=${xsrf}&JSON=1&forced`, h.cookie());
      cleaned++;
    }
  }
  console.log(`  Cleaned ${cleaned} types`);

  h.summary('DDL Extended');
}

run().catch(err => { console.error(err); process.exit(1); });
