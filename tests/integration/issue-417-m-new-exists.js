#!/usr/bin/env node
/**
 * Regression test for issue #417:
 * _m_new already-exists response must return type ID in obj field,
 * actual ord from DB, args="exists1=1", and localized warning.
 */
import h from './lib/helpers.js';
const TS = Date.now();
const created = { php: { types: [], objects: [] }, node: { types: [], objects: [] } };

async function run() {
  await h.setup();
  console.log(`Token: ${h.token.slice(0, 8)}...`);

  h.section('Issue #417 — _m_new already-exists obj field');

  // Create unique types for PHP and Node
  const [pt, nt] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfPhp}&val=__417_p_${TS}&t=3&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfNode}&val=__417_n_${TS}&t=3&JSON=1`, h.cookie()),
  ]);
  const typeP = Number(pt.json?.obj), typeN = Number(nt.json?.obj);
  if (typeP > 0) created.php.types.push(typeP);
  if (typeN > 0) created.node.types.push(typeN);
  if (!typeP || !typeN) { console.error('Type creation failed', pt.json, nt.json); process.exit(1); }

  // Create an object first (so second attempt triggers uniqueness)
  const val = `uniq_${TS}`;
  const [po, no] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_m_new/${typeP}`, `_xsrf=${h.xsrfPhp}&up=1&t${typeP}=${val}&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_m_new/${typeN}`, `_xsrf=${h.xsrfNode}&up=1&t${typeN}=${val}&JSON=1`, h.cookie()),
  ]);
  const objP = Number(po.json?.id), objN = Number(no.json?.id);
  if (objP > 0) created.php.objects.push(objP);
  if (objN > 0) created.node.objects.push(objN);
  if (!objP || !objN) { console.error('Object creation failed', po.json, no.json); process.exit(1); }

  // Now try to create the same object again — should trigger "already exists"
  const [php, node] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_m_new/${typeP}`, `_xsrf=${h.xsrfPhp}&up=1&t${typeP}=${val}&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_m_new/${typeN}`, `_xsrf=${h.xsrfNode}&up=1&t${typeN}=${val}&JSON=1`, h.cookie()),
  ]);

  // Test 1: obj field should be the type ID, not the object ID
  {
    const issues = [];
    const phpObj = php.json?.obj;
    const nodeObj = node.json?.obj;
    if (phpObj === undefined) issues.push('PHP did not return obj field');
    if (nodeObj === undefined) issues.push('Node did not return obj field');
    // PHP returns type ID in obj; Node must match
    if (Number(phpObj) !== typeP) issues.push(`PHP obj=${phpObj} expected typeId=${typeP}`);
    if (Number(nodeObj) !== typeN) issues.push(`Node obj=${nodeObj} expected typeId=${typeN}`);
    // obj must NOT be the existing object's ID
    if (Number(nodeObj) === objN) issues.push(`Node obj=${nodeObj} equals existing objId — BUG #417`);
    h.report('#417 obj = typeId (not objectId)', issues);
  }

  // Test 2: ord field should come from DB (non-zero for typical inserts)
  {
    const issues = [];
    const phpOrd = php.json?.ord;
    const nodeOrd = node.json?.ord;
    if (phpOrd === undefined) issues.push('PHP did not return ord');
    if (nodeOrd === undefined) issues.push('Node did not return ord');
    // Both should be numeric and match in type
    if (typeof phpOrd === 'number' && typeof nodeOrd === 'number') {
      // ord should be the actual order from DB, PHP returns it from the query
      if (nodeOrd === 0 && phpOrd !== 0) issues.push(`Node ord=0 but PHP ord=${phpOrd} — missing DB lookup`);
    }
    h.report('#417 ord from DB (not hardcoded 0)', issues);
  }

  // Test 3: args should be "exists1=1"
  {
    const issues = [];
    const phpArgs = php.json?.args;
    const nodeArgs = node.json?.args;
    if (phpArgs !== 'exists1=1') issues.push(`PHP args="${phpArgs}" expected "exists1=1"`);
    if (nodeArgs !== 'exists1=1') issues.push(`Node args="${nodeArgs}" expected "exists1=1"`);
    h.report('#417 args = "exists1=1"', issues);
  }

  // Test 4: next_act should be "edit_obj"
  {
    const issues = [];
    if (php.json?.next_act !== 'edit_obj') issues.push(`PHP next_act="${php.json?.next_act}"`);
    if (node.json?.next_act !== 'edit_obj') issues.push(`Node next_act="${node.json?.next_act}"`);
    h.report('#417 next_act = "edit_obj"', issues);
  }

  // Test 5: warning should contain "already exists" (localized)
  {
    const issues = [];
    const phpWarn = php.json?.warning || '';
    const nodeWarn = node.json?.warning || '';
    if (!phpWarn.toLowerCase().includes('already exists') && !phpWarn.includes('уже существует'))
      issues.push(`PHP warning unexpected: "${phpWarn}"`);
    if (!nodeWarn.toLowerCase().includes('already exists') && !nodeWarn.includes('уже существует'))
      issues.push(`Node warning unexpected: "${nodeWarn}"`);
    h.report('#417 warning text matches', issues);
  }

  // Test 6: id should be the existing object's id
  {
    const issues = [];
    if (Number(php.json?.id) !== objP) issues.push(`PHP id=${php.json?.id} expected ${objP}`);
    if (Number(node.json?.id) !== objN) issues.push(`Node id=${node.json?.id} expected ${objN}`);
    h.report('#417 id = existing object id', issues);
  }

  // Cleanup
  h.section('Cleanup');
  for (const id of [...created.php.objects].reverse()) {
    await h.http(h.PHP, 'POST', `/${h.DB}/_m_del/${id}`, `_xsrf=${h.xsrfPhp}&JSON=1`, h.cookie());
  }
  for (const id of [...created.node.objects].reverse()) {
    await h.http(h.NODE, 'POST', `/${h.DB}/_m_del/${id}`, `_xsrf=${h.xsrfNode}&JSON=1`, h.cookie());
  }
  for (const id of created.php.types) {
    await h.http(h.PHP, 'POST', `/${h.DB}/_d_del/${id}`, `_xsrf=${h.xsrfPhp}&JSON=1`, h.cookie());
  }
  for (const id of created.node.types) {
    await h.http(h.NODE, 'POST', `/${h.DB}/_d_del/${id}`, `_xsrf=${h.xsrfNode}&JSON=1`, h.cookie());
  }

  h.summary();
}

run().catch(err => { console.error(err); process.exit(1); });
