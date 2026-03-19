#!/usr/bin/env node
/**
 * CRUD Parity Audit: PHP ↔ Node.js
 *
 * Tests table/column/row CRUD operations for response parity.
 * Creates test data, verifies responses match, then cleans up.
 *
 * Usage: node crud-parity-audit.js
 * Prerequisites:
 *   PHP:  php -S 127.0.0.1:8082 router.php  (in integram-server/)
 *   Node: PORT=8081 node start-legacy-test.js (in backend/monolith/)
 *   Test user: testbot / test123 in 'my' database
 */

const PHP  = 'http://127.0.0.1:8082';
const NODE = 'http://127.0.0.1:8081';
const DB   = 'my';
const USER = 'testbot';
const PASS = 'test123';
const TS   = Date.now(); // unique suffix for test data

let token = '';
let xsrfPhp = '', xsrfNode = '';
let passCount = 0, failCount = 0, skipCount = 0;
const reports = [];

// IDs tracked per server for cleanup
const created = { php: { types: [], objects: [] }, node: { types: [], objects: [] } };

// ─── HTTP ───────────────────────────────────────────────────────────────────

async function http(baseUrl, method, path, body, cookie) {
  const url = `${baseUrl}${path}`;
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  const opts = { method, headers, redirect: 'manual' };
  if (body && (method === 'POST' || method === 'PUT')) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = body;
  }
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    const hdrs = {};
    for (const [k, v] of res.headers.entries()) hdrs[k.toLowerCase()] = v;
    return { status: res.status, body: text, json, headers: hdrs };
  } catch (err) {
    return { status: 0, body: '', json: null, headers: {}, error: err.message };
  }
}

function hdr(res, name) { return (res.headers[name.toLowerCase()] || '').trim(); }
function short(s, n = 120) { return s && s.length > n ? s.slice(0, n) + '...' : (s || ''); }

function report(name, issues) {
  const status = issues.length === 0 ? 'PASS' : 'FAIL';
  if (status === 'PASS') passCount++; else failCount++;
  const icon = status === 'PASS' ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${icon} ${name}`);
  for (const i of issues) console.log(`    → ${i}`);
  reports.push({ name, status, issues });
}

function skip(name, reason) {
  skipCount++;
  console.log(`  \x1b[33m⊘\x1b[0m ${name} — ${reason}`);
}

// Compare response shapes, ignoring auto-increment IDs
function cmpShape(php, node, issues, opts = {}) {
  const { checkKeys = [], ignoreKeys = [] } = opts;
  if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
  if (!php.json && !node.json) return;
  if (!php.json) { issues.push(`PHP not JSON: ${short(php.body)}`); return; }
  if (!node.json) { issues.push(`Node not JSON: ${short(node.body)}`); return; }

  // Check array vs object
  if (Array.isArray(php.json) !== Array.isArray(node.json)) {
    issues.push(`Type: PHP=${Array.isArray(php.json)?'array':'object'} Node=${Array.isArray(node.json)?'array':'object'}`);
    return;
  }

  // If error array, compare error text
  if (Array.isArray(php.json)) {
    const pe = php.json[0]?.error || '', ne = node.json[0]?.error || '';
    if (pe !== ne) issues.push(`error: PHP="${short(pe)}" Node="${short(ne)}"`);
    return;
  }

  for (const k of checkKeys) {
    const pv = String(php.json[k] ?? ''), nv = String(node.json[k] ?? '');
    if (pv !== nv) issues.push(`${k}: PHP="${pv}" Node="${nv}"`);
  }

  // All keys present
  const allKeys = new Set([...Object.keys(php.json), ...Object.keys(node.json)]);
  for (const k of allKeys) {
    if (ignoreKeys.includes(k) || checkKeys.includes(k)) continue;
    if (!(k in php.json)) issues.push(`Key "${k}" missing in PHP`);
    if (!(k in node.json)) issues.push(`Key "${k}" missing in Node`);
  }

  const phpCD = hdr(php, 'Content-Disposition'), nodeCD = hdr(node, 'Content-Disposition');
  if (phpCD !== nodeCD) issues.push(`CD: PHP="${phpCD}" Node="${nodeCD}"`);
}

// ─── Setup ──────────────────────────────────────────────────────────────────

const cookie = () => `${DB}=${token}`;

async function setup() {
  console.log('\x1b[1m╔═══════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[1m║   CRUD Parity Audit: PHP ↔ Node.js                   ║\x1b[0m');
  console.log('\x1b[1m╚═══════════════════════════════════════════════════════╝\x1b[0m');

  const authRes = await http(PHP, 'POST', `/${DB}/auth`, `login=${USER}&pwd=${PASS}`);
  const m = (hdr(authRes, 'Set-Cookie') || '').match(/my=([a-f0-9]+)/);
  if (!m) { console.error('Auth failed'); process.exit(1); }
  token = m[1];
  console.log(`Token: ${token.slice(0, 8)}...`);

  const [phpX, nodeX] = await Promise.all([
    http(PHP, 'GET', `/${DB}/xsrf`, null, cookie()),
    http(NODE, 'GET', `/${DB}/xsrf`, null, cookie()),
  ]);
  xsrfPhp = phpX.json?._xsrf || '';
  xsrfNode = nodeX.json?._xsrf || '';
  if (!xsrfPhp || !xsrfNode) { console.error('XSRF failed'); process.exit(1); }
  console.log(`XSRF: ${xsrfPhp.slice(0, 8)}...\n`);

  // Pre-cleanup: delete any leftover __test types from both servers
  for (const [label, base, xsrf] of [['PHP', PHP, xsrfPhp], ['Node', NODE, xsrfNode]]) {
    const terms = await http(base, 'GET', `/${DB}/terms`, null, cookie());
    if (terms.json) {
      const stale = terms.json.filter(t => (t.val || t.name || '').startsWith('__test'));
      for (const t of stale) {
        await http(base, 'POST', `/${DB}/_d_del/${t.id}`, `_xsrf=${xsrf}&JSON=1&forced`, cookie());
      }
      if (stale.length) console.log(`  Pre-cleanup: removed ${stale.length} stale types from ${label}`);
    }
  }

  // Find an existing non-base type to use as a requisite
  const termsRes = await http(PHP, 'GET', `/${DB}/terms`, null, cookie());
  const existingType = termsRes.json?.find(t => t.type === 3 && !t.name.startsWith('__test'));
  if (!existingType) { console.error('No suitable type for requisite test'); process.exit(1); }
  return existingType.id;
}

// ─── Phase 1: Type CRUD ─────────────────────────────────────────────────────

async function phase1_types() {
  console.log('\x1b[36m━━━ Phase 1: Type (Table) CRUD ━━━\x1b[0m');
  // Shared DB — use per-server suffixes to avoid collisions
  const phpName = `__test_crud_p_${TS}`;
  const nodeName = `__test_crud_n_${TS}`;
  let phpTid = 0, nodeTid = 0;

  // 1.1 Create type (same operation, different names to avoid shared-DB collision)
  {
    const php = await http(PHP, 'POST', `/${DB}/_d_new`,
      `_xsrf=${xsrfPhp}&val=${phpName}&t=3&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_new`,
      `_xsrf=${xsrfNode}&val=${nodeName}&t=3&JSON=1`, cookie());
    const issues = [];
    cmpShape(php, node, issues, {
      checkKeys: ['next_act', 'args', 'warnings'],
      ignoreKeys: ['id', 'obj'],
    });
    phpTid = Number(php.json?.obj);
    nodeTid = Number(node.json?.obj);
    if (phpTid > 0) created.php.types.push(phpTid);
    if (nodeTid > 0) created.node.types.push(nodeTid);
    if (!phpTid) issues.push(`PHP obj not positive: ${php.json?.obj}`);
    if (!nodeTid) issues.push(`Node obj not positive: ${node.json?.obj}`);
    report('1.1 Create type (_d_new)', issues);
  }

  if (!phpTid || !nodeTid) return { phpTid: 0, nodeTid: 0 };

  // 1.2 Duplicate type (re-create same name — should warn on both)
  {
    const php = await http(PHP, 'POST', `/${DB}/_d_new`,
      `_xsrf=${xsrfPhp}&val=${phpName}&t=3&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_new`,
      `_xsrf=${xsrfNode}&val=${nodeName}&t=3&JSON=1`, cookie());
    const issues = [];
    cmpShape(php, node, issues, {
      checkKeys: ['next_act', 'args'],
      ignoreKeys: ['id', 'obj', 'warnings'],
    });
    if (!php.json?.warnings) issues.push('PHP: no warning for duplicate');
    if (!node.json?.warnings) issues.push('Node: no warning for duplicate');
    report('1.2 Duplicate type (_d_new)', issues);
  }

  // 1.3 Rename type
  {
    const phpNewName = `__test_ren_p_${TS}`;
    const nodeNewName = `__test_ren_n_${TS}`;
    const php = await http(PHP, 'POST', `/${DB}/_d_save/${phpTid}`,
      `_xsrf=${xsrfPhp}&val=${phpNewName}&t=3&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_save/${nodeTid}`,
      `_xsrf=${xsrfNode}&val=${nodeNewName}&t=3&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'args', 'warnings']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
      if (String(php.json.id) !== String(php.json.obj))
        issues.push(`PHP: id(${php.json.id}) !== obj(${php.json.obj})`);
      if (String(node.json.id) !== String(node.json.obj))
        issues.push(`Node: id(${node.json.id}) !== obj(${node.json.obj})`);
    }
    report('1.3 Rename type (_d_save)', issues);
  }

  // 1.4 Save with unique flag
  {
    const phpNewName = `__test_ren_p_${TS}`;
    const nodeNewName = `__test_ren_n_${TS}`;
    const php = await http(PHP, 'POST', `/${DB}/_d_save/${phpTid}`,
      `_xsrf=${xsrfPhp}&val=${phpNewName}&t=3&unique=1&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_save/${nodeTid}`,
      `_xsrf=${xsrfNode}&val=${nodeNewName}&t=3&unique=1&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'args', 'warnings']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
    }
    report('1.4 Save type with unique (_d_save)', issues);
  }

  return { phpTid, nodeTid };
}

// ─── Phase 2: Requisite (Column) CRUD ────────────────────────────────────────

async function phase2_reqs(phpTid, nodeTid, existingReqType) {
  console.log('\n\x1b[36m━━━ Phase 2: Requisite (Column) CRUD ━━━\x1b[0m');
  let phpReqId = 0, nodeReqId = 0;
  let phpReqId2 = 0, nodeReqId2 = 0;

  if (!phpTid || !nodeTid) { skip('2.x', 'No type IDs'); return {}; }

  // To add a column, we need a non-base type ID. We'll create a helper type
  // and use an existing type as requisite reference.

  // 2.1 Add column (use existingReqType which is a non-base type)
  {
    const php = await http(PHP, 'POST', `/${DB}/_d_req/${phpTid}`,
      `_xsrf=${xsrfPhp}&t=${existingReqType}&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_req/${nodeTid}`,
      `_xsrf=${xsrfNode}&t=${existingReqType}&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'args', 'warnings']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
      // obj should be the type ID
      if (String(php.json.obj) !== String(phpTid))
        issues.push(`PHP obj(${php.json.obj}) !== typeId(${phpTid})`);
      if (String(node.json.obj) !== String(nodeTid))
        issues.push(`Node obj(${node.json.obj}) !== typeId(${nodeTid})`);
      phpReqId = Number(php.json.id);
      nodeReqId = Number(node.json.id);
      if (!phpReqId) issues.push(`PHP id not positive: ${php.json?.id}`);
      if (!nodeReqId) issues.push(`Node id not positive: ${node.json?.id}`);
    } else {
      if (!php.json) issues.push(`PHP not JSON: ${short(php.body)}`);
      if (!node.json) issues.push(`Node not JSON: ${short(node.body)}`);
    }
    report('2.1 Add column (_d_req)', issues);
  }

  // 2.2 Create second helper type for second column (per-server names)
  let phpHelper = 0, nodeHelper = 0;
  {
    const php = await http(PHP, 'POST', `/${DB}/_d_new`,
      `_xsrf=${xsrfPhp}&val=__test_hlp_p_${TS}&t=3&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_new`,
      `_xsrf=${xsrfNode}&val=__test_hlp_n_${TS}&t=3&JSON=1`, cookie());
    phpHelper = Number(php.json?.obj);
    nodeHelper = Number(node.json?.obj);
    if (phpHelper > 0) created.php.types.push(phpHelper);
    if (nodeHelper > 0) created.node.types.push(nodeHelper);
  }

  // 2.3 Add second column (using helper type)
  if (phpHelper && nodeHelper) {
    const php = await http(PHP, 'POST', `/${DB}/_d_req/${phpTid}`,
      `_xsrf=${xsrfPhp}&t=${phpHelper}&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_req/${nodeTid}`,
      `_xsrf=${xsrfNode}&t=${nodeHelper}&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'args', 'warnings']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
      phpReqId2 = Number(php.json.id);
      nodeReqId2 = Number(node.json.id);
    }
    report('2.3 Add second column (_d_req)', issues);
  }

  // 2.4 Duplicate column
  if (phpReqId && nodeReqId) {
    const php = await http(PHP, 'POST', `/${DB}/_d_req/${phpTid}`,
      `_xsrf=${xsrfPhp}&t=${existingReqType}&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_req/${nodeTid}`,
      `_xsrf=${xsrfNode}&t=${existingReqType}&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      if (!php.json.warnings) issues.push('PHP: no warning for duplicate');
      if (!node.json.warnings) issues.push('Node: no warning for duplicate');
    }
    report('2.4 Duplicate column (_d_req)', issues);
  }

  // 2.5 Toggle NOT NULL
  if (phpReqId && nodeReqId) {
    const php = await http(PHP, 'POST', `/${DB}/_d_null/${phpReqId}`,
      `_xsrf=${xsrfPhp}&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_null/${nodeReqId}`,
      `_xsrf=${xsrfNode}&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'args', 'warnings']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
      if (String(php.json.obj) !== String(phpTid))
        issues.push(`PHP obj(${php.json.obj}) !== typeId(${phpTid})`);
      if (String(node.json.obj) !== String(nodeTid))
        issues.push(`Node obj(${node.json.obj}) !== typeId(${nodeTid})`);
    }
    report('2.5 Toggle NOT NULL (_d_null)', issues);
    // Toggle back
    await http(PHP, 'POST', `/${DB}/_d_null/${phpReqId}`, `_xsrf=${xsrfPhp}&JSON=1`, cookie());
    await http(NODE, 'POST', `/${DB}/_d_null/${nodeReqId}`, `_xsrf=${xsrfNode}&JSON=1`, cookie());
  }

  // 2.6 Toggle MULTI
  if (phpReqId && nodeReqId) {
    const php = await http(PHP, 'POST', `/${DB}/_d_multi/${phpReqId}`,
      `_xsrf=${xsrfPhp}&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_multi/${nodeReqId}`,
      `_xsrf=${xsrfNode}&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'args', 'warnings']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
    }
    report('2.6 Toggle MULTI (_d_multi)', issues);
    // Toggle back
    await http(PHP, 'POST', `/${DB}/_d_multi/${phpReqId}`, `_xsrf=${xsrfPhp}&JSON=1`, cookie());
    await http(NODE, 'POST', `/${DB}/_d_multi/${nodeReqId}`, `_xsrf=${xsrfNode}&JSON=1`, cookie());
  }

  // 2.7 Move requisite up
  if (phpReqId2 && nodeReqId2) {
    const php = await http(PHP, 'POST', `/${DB}/_d_up/${phpReqId2}`,
      `_xsrf=${xsrfPhp}&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_up/${nodeReqId2}`,
      `_xsrf=${xsrfNode}&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'args', 'warnings']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
    }
    report('2.7 Move column up (_d_up)', issues);
  }

  return { phpReqId, nodeReqId, phpReqId2, nodeReqId2, phpHelper, nodeHelper };
}

// ─── Phase 3: Object (Row) CRUD ─────────────────────────────────────────────

async function phase3_objects(phpTid, nodeTid, reqType) {
  console.log('\n\x1b[36m━━━ Phase 3: Object (Row) CRUD ━━━\x1b[0m');
  let phpOid = 0, nodeOid = 0;

  if (!phpTid || !nodeTid) { skip('3.x', 'No type IDs'); return; }

  // 3.1 Create object
  // PHP _m_new: uses t<typeId>=val for the object name, up=1 for root
  {
    const php = await http(PHP, 'POST', `/${DB}/_m_new/${phpTid}`,
      `_xsrf=${xsrfPhp}&up=1&t${phpTid}=test_row_1&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_m_new/${nodeTid}`,
      `_xsrf=${xsrfNode}&up=1&t${nodeTid}=test_row_1&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      // _m_new response: {id, obj, ord, next_act, args, val}
      for (const k of ['next_act', 'val']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
      // Check key presence matches
      for (const k of ['id', 'obj', 'ord', 'next_act', 'args', 'val']) {
        if ((k in php.json) !== (k in node.json))
          issues.push(`Key "${k}": PHP=${k in php.json} Node=${k in node.json}`);
      }
      // warnings should NOT be present (PHP uses die(), not api_dump)
      if ('warnings' in php.json !== 'warnings' in node.json)
        issues.push(`warnings key: PHP=${('warnings' in php.json)} Node=${('warnings' in node.json)}`);

      phpOid = Number(php.json.id);
      nodeOid = Number(node.json.id);
      if (phpOid > 0) created.php.objects.push(phpOid);
      if (nodeOid > 0) created.node.objects.push(nodeOid);
    } else {
      if (!php.json) issues.push(`PHP not JSON: ${short(php.body)}`);
      if (!node.json) issues.push(`Node not JSON: ${short(node.body)}`);
    }
    report('3.1 Create object (_m_new)', issues);
  }

  // 3.2 Create object with requisite values
  if (reqType) {
    // Requisite is a reference type — the value should be an ID of an existing object of that type
    // For testing, we can send t<reqType>=0 (empty) or create a proper reference
    // But for parity testing, we just compare the response shape
    const php = await http(PHP, 'POST', `/${DB}/_m_new/${phpTid}`,
      `_xsrf=${xsrfPhp}&up=1&t${phpTid}=test_row_2&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_m_new/${nodeTid}`,
      `_xsrf=${xsrfNode}&up=1&t${nodeTid}=test_row_2&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'val']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
      const phpObj2 = Number(php.json.id);
      const nodeObj2 = Number(node.json.id);
      if (phpObj2 > 0) created.php.objects.push(phpObj2);
      if (nodeObj2 > 0) created.node.objects.push(nodeObj2);
    }
    report('3.2 Create second object (_m_new)', issues);
  }

  if (!phpOid || !nodeOid) { skip('3.3-3.7', 'Object creation failed'); return { phpOid: 0, nodeOid: 0 }; }

  // 3.3 Save object (_m_save)
  {
    const php = await http(PHP, 'POST', `/${DB}/_m_save/${phpOid}`,
      `_xsrf=${xsrfPhp}&t${phpTid}=saved_name&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_m_save/${nodeOid}`,
      `_xsrf=${xsrfNode}&t${nodeTid}=saved_name&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'warnings']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
      // args should contain "saved1=1"
      const pa = String(php.json.args || ''), na = String(node.json.args || '');
      if (pa.includes('saved1=1') !== na.includes('saved1=1'))
        issues.push(`args saved1: PHP="${pa.slice(0,30)}" Node="${na.slice(0,30)}"`);
      // id should be the type ID
      if (String(php.json.id) !== String(phpTid))
        issues.push(`PHP id(${php.json.id}) !== typeId(${phpTid})`);
      if (String(node.json.id) !== String(nodeTid))
        issues.push(`Node id(${node.json.id}) !== typeId(${nodeTid})`);
    } else {
      if (!php.json) issues.push(`PHP not JSON: ${short(php.body)}`);
      if (!node.json) issues.push(`Node not JSON: ${short(node.body)}`);
    }
    report('3.3 Save object (_m_save)', issues);
  }

  // 3.4 Copy object (_m_save + copybtn)
  {
    const php = await http(PHP, 'POST', `/${DB}/_m_save/${phpOid}`,
      `_xsrf=${xsrfPhp}&copybtn=1&t${phpTid}=copy_name&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_m_save/${nodeOid}`,
      `_xsrf=${xsrfNode}&copybtn=1&t${nodeTid}=copy_name&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'warnings']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
      const pa = String(php.json.args || ''), na = String(node.json.args || '');
      if (pa.includes('copied1=1') !== na.includes('copied1=1'))
        issues.push(`args copied1: PHP="${pa.slice(0,30)}" Node="${na.slice(0,30)}"`);
      const phpCopy = Number(php.json.obj);
      const nodeCopy = Number(node.json.obj);
      if (phpCopy > 0) created.php.objects.push(phpCopy);
      if (nodeCopy > 0) created.node.objects.push(nodeCopy);
    }
    report('3.4 Copy object (_m_save copybtn)', issues);
  }

  // 3.5 Delete object (_m_del) — create temp, then delete
  {
    const phpNew = await http(PHP, 'POST', `/${DB}/_m_new/${phpTid}`,
      `_xsrf=${xsrfPhp}&up=1&t${phpTid}=to_delete&JSON=1`, cookie());
    const nodeNew = await http(NODE, 'POST', `/${DB}/_m_new/${nodeTid}`,
      `_xsrf=${xsrfNode}&up=1&t${nodeTid}=to_delete&JSON=1`, cookie());
    const phpDelId = Number(phpNew.json?.id);
    const nodeDelId = Number(nodeNew.json?.id);

    if (phpDelId > 0 && nodeDelId > 0) {
      const php = await http(PHP, 'POST', `/${DB}/_m_del/${phpDelId}`,
        `_xsrf=${xsrfPhp}&JSON=1`, cookie());
      const node = await http(NODE, 'POST', `/${DB}/_m_del/${nodeDelId}`,
        `_xsrf=${xsrfNode}&JSON=1`, cookie());
      const issues = [];
      if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
      if (php.json && node.json) {
        for (const k of ['next_act', 'warnings']) {
          if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
            issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
        }
        // id = type ID, obj = deleted object ID
        if (String(php.json.id) !== String(phpTid))
          issues.push(`PHP id(${php.json.id}) !== typeId(${phpTid})`);
        if (String(node.json.id) !== String(nodeTid))
          issues.push(`Node id(${node.json.id}) !== typeId(${nodeTid})`);
        if (String(php.json.obj) !== String(phpDelId))
          issues.push(`PHP obj(${php.json.obj}) !== deletedId(${phpDelId})`);
        if (String(node.json.obj) !== String(nodeDelId))
          issues.push(`Node obj(${node.json.obj}) !== deletedId(${nodeDelId})`);
      } else {
        if (!php.json) issues.push(`PHP not JSON: ${short(php.body)}`);
        if (!node.json) issues.push(`Node not JSON: ${short(node.body)}`);
      }
      report('3.5 Delete object (_m_del)', issues);
    } else {
      skip('3.5 Delete object', 'Could not create temp object');
    }
  }

  return { phpOid, nodeOid };
}

// ─── Phase 4: Verification ──────────────────────────────────────────────────

async function phase4_verify(phpTid, nodeTid) {
  console.log('\n\x1b[36m━━━ Phase 4: Verification ━━━\x1b[0m');
  if (!phpTid || !nodeTid) { skip('4.x', 'No type IDs'); return; }

  // 4.1 Type in terms
  {
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/terms`, null, cookie()),
      http(NODE, 'GET', `/${DB}/terms`, null, cookie()),
    ]);
    const issues = [];
    if (php.json && node.json) {
      const phpHas = php.json.some(t => String(t.id) === String(phpTid));
      const nodeHas = node.json.some(t => String(t.id) === String(nodeTid));
      if (!phpHas) issues.push(`PHP: type ${phpTid} not in terms`);
      if (!nodeHas) issues.push(`Node: type ${nodeTid} not in terms`);
      if (php.json.length !== node.json.length)
        issues.push(`Count: PHP=${php.json.length} Node=${node.json.length}`);
    }
    report('4.1 Type in terms', issues);
  }

  // 4.2 obj_meta
  {
    const php = await http(PHP, 'GET', `/${DB}/obj_meta/${phpTid}`, null, cookie());
    const node = await http(NODE, 'GET', `/${DB}/obj_meta/${nodeTid}`, null, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      // val differs by design (per-server names to avoid shared-DB collision)
      // Compare structure: both should have val, same reqs count
      if (!php.json.val) issues.push('PHP: missing val');
      if (!node.json.val) issues.push('Node: missing val');
      const pr = Object.keys(php.json.reqs || {}).length;
      const nr = Object.keys(node.json.reqs || {}).length;
      if (pr !== nr) issues.push(`reqs count: PHP=${pr} Node=${nr}`);
    }
    report('4.2 obj_meta for test type', issues);
  }
}

// ─── Phase 5: Type deletion ─────────────────────────────────────────────────

async function phase5_delete(phpTid, nodeTid) {
  console.log('\n\x1b[36m━━━ Phase 5: Type deletion ━━━\x1b[0m');
  if (!phpTid || !nodeTid) { skip('5.x', 'No type IDs'); return; }

  // 5.1 Delete type with objects (should fail)
  {
    const php = await http(PHP, 'POST', `/${DB}/_d_del/${phpTid}`,
      `_xsrf=${xsrfPhp}&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_del/${nodeTid}`,
      `_xsrf=${xsrfNode}&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    // Both should contain error about instances/objects
    const phpErr = (php.body || '').includes('annot delete') || (php.body || '').includes('ельзя');
    const nodeErr = (node.body || '').includes('annot delete') || (node.body || '').includes('ельзя');
    if (phpErr !== nodeErr)
      issues.push(`Error presence: PHP=${phpErr} Node=${nodeErr}`);
    report('5.1 Delete type with objects (blocked)', issues);
  }
}

// ─── Phase 6: Object operations (_m_set, _m_up, _m_ord) ─────────────────────

async function phase6_objOps(phpTid, nodeTid, phpOid, nodeOid, existingReqType, phpReqId, nodeReqId) {
  console.log('\n\x1b[36m━━━ Phase 6: Object Operations ━━━\x1b[0m');
  if (!phpOid || !nodeOid) { skip('6.x', 'No object IDs'); return; }

  // 6.1 _m_set — set reference attribute on object
  // _m_set expects t<requisiteId>=<objectId> for reference columns
  // Use reqId (reference to existingReqType) and set value to the object's own ID (valid ref)
  if (!phpReqId || !nodeReqId) { skip('6.1 Set attribute', 'No requisite IDs'); }
  else {
    // Set reference to 0 (clear) — both servers should handle this
    const php = await http(PHP, 'POST', `/${DB}/_m_set/${phpOid}`,
      `_xsrf=${xsrfPhp}&t${phpReqId}=0&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_m_set/${nodeOid}`,
      `_xsrf=${xsrfNode}&t${nodeReqId}=0&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'warnings']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
      // next_act should be "nul" (PHP $a="nul" → api_dump → next_act:"nul")
      if (String(php.json.next_act) !== 'nul') issues.push(`PHP next_act="${php.json.next_act}" (expected "nul")`);
      if (String(node.json.next_act) !== 'nul') issues.push(`Node next_act="${node.json.next_act}" (expected "nul")`);
      // obj should be the object ID (integer)
      if (Number(php.json.obj) !== phpOid) issues.push(`PHP obj(${php.json.obj}) !== oid(${phpOid})`);
      if (Number(node.json.obj) !== nodeOid) issues.push(`Node obj(${node.json.obj}) !== oid(${nodeOid})`);
    } else {
      if (!php.json) issues.push(`PHP not JSON: ${short(php.body)}`);
      if (!node.json) issues.push(`Node not JSON: ${short(node.body)}`);
    }
    report('6.1 Set attribute (_m_set)', issues);
  }

  // 6.2 Create a second object so we can test ordering
  let phpOid2 = 0, nodeOid2 = 0;
  {
    const php = await http(PHP, 'POST', `/${DB}/_m_new/${phpTid}`,
      `_xsrf=${xsrfPhp}&up=1&t${phpTid}=order_test&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_m_new/${nodeTid}`,
      `_xsrf=${xsrfNode}&up=1&t${nodeTid}=order_test&JSON=1`, cookie());
    phpOid2 = Number(php.json?.id);
    nodeOid2 = Number(node.json?.id);
    if (phpOid2 > 0) created.php.objects.push(phpOid2);
    if (nodeOid2 > 0) created.node.objects.push(nodeOid2);
  }

  // 6.3 _m_up — move object up in order
  if (phpOid2 && nodeOid2) {
    const php = await http(PHP, 'POST', `/${DB}/_m_up/${phpOid2}`,
      `_xsrf=${xsrfPhp}&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_m_up/${nodeOid2}`,
      `_xsrf=${xsrfNode}&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'warnings']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
      // next_act should be "object"
      if (String(php.json.next_act) !== 'object') issues.push(`PHP next_act="${php.json.next_act}" (expected "object")`);
      if (String(node.json.next_act) !== 'object') issues.push(`Node next_act="${node.json.next_act}" (expected "object")`);
      // args should contain F_U=
      const pa = String(php.json.args || ''), na = String(node.json.args || '');
      if (pa.includes('F_U=') !== na.includes('F_U='))
        issues.push(`args F_U: PHP="${pa}" Node="${na}"`);
    } else {
      if (!php.json) issues.push(`PHP not JSON: ${short(php.body)}`);
      if (!node.json) issues.push(`Node not JSON: ${short(node.body)}`);
    }
    report('6.3 Move object up (_m_up)', issues);
  } else {
    skip('6.3 Move object up', 'Could not create second object');
  }

  // 6.4 _m_ord — set object order
  if (phpOid2 && nodeOid2) {
    const php = await http(PHP, 'POST', `/${DB}/_m_ord/${phpOid2}`,
      `_xsrf=${xsrfPhp}&order=1&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_m_ord/${nodeOid2}`,
      `_xsrf=${xsrfNode}&order=1&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'warnings']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
      // Both should return successfully
      if (php.json.error) issues.push(`PHP error: ${php.json.error}`);
      if (node.json.error) issues.push(`Node error: ${node.json.error}`);
    } else {
      if (!php.json) issues.push(`PHP not JSON: ${short(php.body)}`);
      if (!node.json) issues.push(`Node not JSON: ${short(node.body)}`);
    }
    report('6.4 Set object order (_m_ord)', issues);
  } else {
    skip('6.4 Set object order', 'Could not create second object');
  }

  // 6.5 _m_ord invalid order
  {
    const php = await http(PHP, 'POST', `/${DB}/_m_ord/${phpOid}`,
      `_xsrf=${xsrfPhp}&order=0&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_m_ord/${nodeOid}`,
      `_xsrf=${xsrfNode}&order=0&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    // Both should return error text "Invalid order"
    const phpBody = (php.body || '').trim(), nodeBody = (node.body || '').trim();
    if (phpBody !== nodeBody) issues.push(`body: PHP="${short(phpBody)}" Node="${short(nodeBody)}"`);
    report('6.5 Invalid order (_m_ord)', issues);
  }
}

// ─── Phase 7: Schema operations (_d_alias, _d_attrs, _d_ord, _d_del_req) ────

async function phase7_schemaOps(phpTid, nodeTid, phpReqId, nodeReqId, phpReqId2, nodeReqId2) {
  console.log('\n\x1b[36m━━━ Phase 7: Schema Operations ━━━\x1b[0m');
  if (!phpReqId || !nodeReqId) { skip('7.x', 'No requisite IDs'); return; }

  // 7.1 _d_alias — set column alias
  {
    const php = await http(PHP, 'POST', `/${DB}/_d_alias/${phpReqId}`,
      `_xsrf=${xsrfPhp}&val=test_alias&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_alias/${nodeReqId}`,
      `_xsrf=${xsrfNode}&val=test_alias&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'args', 'warnings']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
      // next_act should be "edit_types"
      if (String(php.json.next_act) !== 'edit_types') issues.push(`PHP next_act="${php.json.next_act}"`);
      if (String(node.json.next_act) !== 'edit_types') issues.push(`Node next_act="${node.json.next_act}"`);
    } else {
      if (!php.json) issues.push(`PHP not JSON: ${short(php.body)}`);
      if (!node.json) issues.push(`Node not JSON: ${short(node.body)}`);
    }
    report('7.1 Set alias (_d_alias)', issues);
  }

  // 7.2 _d_alias — invalid alias with colon
  {
    const php = await http(PHP, 'POST', `/${DB}/_d_alias/${phpReqId}`,
      `_xsrf=${xsrfPhp}&val=bad:alias&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_alias/${nodeReqId}`,
      `_xsrf=${xsrfNode}&val=bad:alias&JSON=1`, cookie());
    const issues = [];
    // Both should return an error
    const phpHasErr = (php.body || '').toLowerCase().includes('invalid') || (php.body || '').includes('едопустим');
    const nodeHasErr = (node.body || '').toLowerCase().includes('invalid') || (node.body || '').includes('едопустим') || (node.body || '').includes('colon');
    if (phpHasErr !== nodeHasErr)
      issues.push(`Error presence: PHP=${phpHasErr} Node=${nodeHasErr}`);
    report('7.2 Invalid alias with colon (_d_alias)', issues);
  }

  // 7.3 _d_attrs — set modifiers
  {
    const php = await http(PHP, 'POST', `/${DB}/_d_attrs/${phpReqId}`,
      `_xsrf=${xsrfPhp}&alias=attr_alias&set_null=1&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_attrs/${nodeReqId}`,
      `_xsrf=${xsrfNode}&alias=attr_alias&set_null=1&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'args', 'warnings']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
    } else {
      if (!php.json) issues.push(`PHP not JSON: ${short(php.body)}`);
      if (!node.json) issues.push(`Node not JSON: ${short(node.body)}`);
    }
    report('7.3 Set modifiers (_d_attrs)', issues);
  }

  // 7.4 _d_ord — set column order (swap first two columns)
  if (phpReqId2 && nodeReqId2) {
    const php = await http(PHP, 'POST', `/${DB}/_d_ord/${phpReqId}`,
      `_xsrf=${xsrfPhp}&order=2&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_ord/${nodeReqId}`,
      `_xsrf=${xsrfNode}&order=2&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'args', 'warnings']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
    } else {
      if (!php.json) issues.push(`PHP not JSON: ${short(php.body)}`);
      if (!node.json) issues.push(`Node not JSON: ${short(node.body)}`);
    }
    report('7.4 Set column order (_d_ord)', issues);
  } else {
    skip('7.4 Set column order', 'No second requisite IDs');
  }

  // 7.5 _d_ord — invalid order
  {
    const php = await http(PHP, 'POST', `/${DB}/_d_ord/${phpReqId}`,
      `_xsrf=${xsrfPhp}&order=0&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_ord/${nodeReqId}`,
      `_xsrf=${xsrfNode}&order=0&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    const phpBody = (php.body || '').trim(), nodeBody = (node.body || '').trim();
    if (phpBody !== nodeBody) issues.push(`body: PHP="${short(phpBody)}" Node="${short(nodeBody)}"`);
    report('7.5 Invalid column order (_d_ord)', issues);
  }

  // 7.6 _d_del_req — delete column (no forced, should warn about usage)
  // First create a third helper column to delete without breaking other tests
  let phpDelReq = 0, nodeDelReq = 0;
  {
    // Create a helper type to use as column
    const phpH = await http(PHP, 'POST', `/${DB}/_d_new`,
      `_xsrf=${xsrfPhp}&val=__test_delreq_p_${TS}&t=3&JSON=1`, cookie());
    const nodeH = await http(NODE, 'POST', `/${DB}/_d_new`,
      `_xsrf=${xsrfNode}&val=__test_delreq_n_${TS}&t=3&JSON=1`, cookie());
    const phpHId = Number(phpH.json?.obj);
    const nodeHId = Number(nodeH.json?.obj);
    if (phpHId > 0) created.php.types.push(phpHId);
    if (nodeHId > 0) created.node.types.push(nodeHId);

    if (phpHId && nodeHId) {
      // Add it as column to our test type
      const phpR = await http(PHP, 'POST', `/${DB}/_d_req/${phpTid}`,
        `_xsrf=${xsrfPhp}&t=${phpHId}&JSON=1`, cookie());
      const nodeR = await http(NODE, 'POST', `/${DB}/_d_req/${nodeTid}`,
        `_xsrf=${xsrfNode}&t=${nodeHId}&JSON=1`, cookie());
      phpDelReq = Number(phpR.json?.id);
      nodeDelReq = Number(nodeR.json?.id);
    }
  }

  if (phpDelReq && nodeDelReq) {
    const php = await http(PHP, 'POST', `/${DB}/_d_del_req/${phpDelReq}`,
      `_xsrf=${xsrfPhp}&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/${DB}/_d_del_req/${nodeDelReq}`,
      `_xsrf=${xsrfNode}&JSON=1`, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['next_act', 'args', 'warnings']) {
        if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
      }
      // id and obj should be the parent type
      if (String(php.json.id) !== String(phpTid))
        issues.push(`PHP id(${php.json.id}) !== typeId(${phpTid})`);
      if (String(node.json.id) !== String(nodeTid))
        issues.push(`Node id(${node.json.id}) !== typeId(${nodeTid})`);
    } else {
      if (!php.json) issues.push(`PHP not JSON: ${short(php.body)}`);
      if (!node.json) issues.push(`Node not JSON: ${short(node.body)}`);
    }
    report('7.6 Delete column (_d_del_req)', issues);
  } else {
    skip('7.6 Delete column', 'Could not create helper column');
  }
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

async function cleanup() {
  console.log('\n\x1b[36m━━━ Cleanup ━━━\x1b[0m');
  let cleaned = 0;

  // Delete objects
  for (const id of created.php.objects) {
    try { await http(PHP, 'POST', `/${DB}/_m_del/${id}`, `_xsrf=${xsrfPhp}&JSON=1`, cookie()); cleaned++; } catch {}
  }
  for (const id of created.node.objects) {
    try { await http(NODE, 'POST', `/${DB}/_m_del/${id}`, `_xsrf=${xsrfNode}&JSON=1`, cookie()); cleaned++; } catch {}
  }

  // Delete types (reverse order)
  for (const id of [...created.php.types].reverse()) {
    try { await http(PHP, 'POST', `/${DB}/_d_del/${id}`, `_xsrf=${xsrfPhp}&JSON=1`, cookie()); cleaned++; } catch {}
  }
  for (const id of [...created.node.types].reverse()) {
    try { await http(NODE, 'POST', `/${DB}/_d_del/${id}`, `_xsrf=${xsrfNode}&JSON=1`, cookie()); cleaned++; } catch {}
  }

  console.log(`  Cleaned ${cleaned} entities`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const existingReqType = await setup();

  const { phpTid, nodeTid } = await phase1_types();
  const reqs = await phase2_reqs(phpTid, nodeTid, existingReqType);
  const { phpOid, nodeOid } = await phase3_objects(phpTid, nodeTid, existingReqType) || {};
  await phase4_verify(phpTid, nodeTid);
  await phase5_delete(phpTid, nodeTid);
  await phase6_objOps(phpTid, nodeTid, phpOid, nodeOid, existingReqType, reqs.phpReqId, reqs.nodeReqId);
  await phase7_schemaOps(phpTid, nodeTid, reqs.phpReqId, reqs.nodeReqId, reqs.phpReqId2, reqs.nodeReqId2);
  await cleanup();

  // Summary
  console.log('\n\x1b[1m╔═══════════════════════════════════════════════════════╗\x1b[0m');
  console.log(`\x1b[1m║  \x1b[32m${passCount} PASS\x1b[0m  \x1b[31m${failCount} FAIL\x1b[0m  \x1b[33m${skipCount} SKIP\x1b[0m`);
  console.log('\x1b[1m╚═══════════════════════════════════════════════════════╝\x1b[0m');

  if (failCount > 0) {
    console.log('\n\x1b[1mFailed tests:\x1b[0m');
    for (const r of reports.filter(r => r.status === 'FAIL')) {
      console.log(`  \x1b[31m✗\x1b[0m ${r.name}`);
      for (const i of r.issues) console.log(`    → ${i}`);
    }
  }

  process.exit(failCount);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
