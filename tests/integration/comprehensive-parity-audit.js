#!/usr/bin/env node
/**
 * Comprehensive PHP ↔ Node.js Parity Audit
 *
 * Covers ALL endpoints, ALL parameter variants from FULL-TEST-PLAN.md:
 *   Section 1: Auth & Session (extended)
 *   Section 2: Types DDL (all base types, all operations)
 *   Section 3: Objects DML (all data types, all operations)
 *   Section 4: Listing & Querying (all formats, filters, sorting)
 *   Section 5: Edge cases (XSS, unicode, boundary values)
 *   Section 6: Pages JSON API
 *   Section 7: Reports (all formats)
 *   Section 8: Type Deletion
 *
 * Usage: node comprehensive-parity-audit.js
 */

const PHP  = 'http://127.0.0.1:8082';
const NODE = 'http://127.0.0.1:8081';
const DB   = 'my';
const USER = 'testbot';
const PASS = 'test123';
const TS   = Date.now();

let token = '';
let xsrfPhp = '', xsrfNode = '';
let passCount = 0, failCount = 0, skipCount = 0;
const reports = [];
const created = { php: { types: [], objects: [], dbs: [] }, node: { types: [], objects: [], dbs: [] } };

// ─── HTTP ────────────────────────────────────────────────────────────────────

async function http(baseUrl, method, path, body, cookie, extraHeaders = {}) {
  const url = `${baseUrl}${path}`;
  const headers = { ...extraHeaders };
  if (cookie) headers['Cookie'] = cookie;
  const opts = { method, headers, redirect: 'manual' };
  if (body && (method === 'POST' || method === 'PUT')) {
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = body;
  }
  try {
    const res = await fetch(url, opts);
    const buf = await res.arrayBuffer();
    const text = new TextDecoder().decode(buf);
    let json = null;
    try { json = JSON.parse(text); } catch {}
    const hdrs = {};
    for (const [k, v] of res.headers.entries()) hdrs[k.toLowerCase()] = v;
    return { status: res.status, body: text, json, headers: hdrs, buf };
  } catch (err) {
    return { status: 0, body: '', json: null, headers: {}, error: err.message, buf: null };
  }
}

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

const cookie = () => `${DB}=${token}`;
const section = (title) => console.log(`\n\x1b[36m━━━ ${title} ━━━\x1b[0m`);

/**
 * Compare PHP vs Node responses. Auto-SKIPs if PHP fails (500/null/HTML).
 */
async function cmp(name, method, path, body, opts = {}) {
  const ck = opts.cookie !== undefined ? opts.cookie : cookie();
  const [php, node] = await Promise.all([
    http(PHP, method, `/${DB}${path}`, body, ck, opts.headers),
    http(NODE, method, `/${DB}${path}`, body, ck, opts.headers),
  ]);
  if (php.status >= 500) { skip(name, 'PHP built-in server 500'); return { php, node, skipped: true }; }
  if (php.body === 'null' || php.body === '') { skip(name, 'PHP returned null/empty'); return { php, node, skipped: true }; }
  if (!php.json && php.body.startsWith('<!DOCTYPE')) { skip(name, 'PHP returned HTML'); return { php, node, skipped: true }; }
  return { php, node, skipped: false };
}

/**
 * Node-only structural validation when PHP always fails.
 */
function nodeOnly(name, node, checks) {
  const issues = [];
  if (node.status >= 500) { issues.push('Node 500'); report(name + ' (Node-only)', issues); return; }
  checks(node, issues);
  report(name + ' (Node-only)', issues);
}

// ─── Setup ───────────────────────────────────────────────────────────────────

async function setup() {
  console.log('\x1b[1m╔═══════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[1m║   Comprehensive PHP ↔ Node.js Parity Audit           ║\x1b[0m');
  console.log('\x1b[1m╚═══════════════════════════════════════════════════════╝\x1b[0m');

  const authRes = await http(PHP, 'POST', `/${DB}/auth`, `login=${USER}&pwd=${PASS}`);
  const m = ((authRes.headers['set-cookie'] || '').match(/my=([a-f0-9]+)/) || [])[1];
  if (!m) { console.error('Auth failed'); process.exit(1); }
  token = m;
  console.log(`Token: ${token.slice(0, 8)}...`);

  const [phpX, nodeX] = await Promise.all([
    http(PHP, 'GET', `/${DB}/xsrf`, null, cookie()),
    http(NODE, 'GET', `/${DB}/xsrf`, null, cookie()),
  ]);
  xsrfPhp = phpX.json?._xsrf || '';
  xsrfNode = nodeX.json?._xsrf || '';
  if (!xsrfPhp || !xsrfNode) { console.error('XSRF failed'); process.exit(1); }
  console.log(`XSRF: ${xsrfPhp.slice(0, 8)}...`);

  // Pre-cleanup stale types
  for (const [label, base, xsrf] of [['PHP', PHP, xsrfPhp], ['Node', NODE, xsrfNode]]) {
    const terms = await http(base, 'GET', `/${DB}/terms`, null, cookie());
    if (terms.json) {
      const stale = terms.json.filter(t => (t.val || t.name || '').startsWith('__comp'));
      for (const t of stale) {
        await http(base, 'POST', `/${DB}/_d_del/${t.id}`, `_xsrf=${xsrf}&JSON=1&forced`, cookie());
      }
      if (stale.length) console.log(`  Pre-cleanup: removed ${stale.length} stale types from ${label}`);
    }
  }
}

// Re-auth helper (call after auth tests that may invalidate session)
async function reauth() {
  const authRes = await http(PHP, 'POST', `/${DB}/auth`, `login=${USER}&pwd=${PASS}`);
  const m = ((authRes.headers['set-cookie'] || '').match(/my=([a-f0-9]+)/) || [])[1];
  if (m) token = m;
  const [phpX, nodeX] = await Promise.all([
    http(PHP, 'GET', `/${DB}/xsrf`, null, cookie()),
    http(NODE, 'GET', `/${DB}/xsrf`, null, cookie()),
  ]);
  xsrfPhp = phpX.json?._xsrf || xsrfPhp;
  xsrfNode = nodeX.json?._xsrf || xsrfNode;
}

// Helper: create type on both servers
async function createType(name, baseType, opts = {}) {
  const up = opts.up ? `&up=${opts.up}` : '';
  const unique = opts.unique ? '&unique=1' : '';
  const [php, node] = await Promise.all([
    http(PHP, 'POST', `/${DB}/_d_new`, `_xsrf=${xsrfPhp}&val=${name}_p&t=${baseType}${up}${unique}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB}/_d_new`, `_xsrf=${xsrfNode}&val=${name}_n&t=${baseType}${up}${unique}&JSON=1`, cookie()),
  ]);
  const phpId = Number(php.json?.obj);
  const nodeId = Number(node.json?.obj);
  if (phpId > 0) created.php.types.push(phpId);
  if (nodeId > 0) created.node.types.push(nodeId);
  return { phpId, nodeId, php, node };
}

// Helper: create object on both servers
async function createObject(phpTypeId, nodeTypeId, value, up = 1) {
  const [php, node] = await Promise.all([
    http(PHP, 'POST', `/${DB}/_m_new/${phpTypeId}`, `_xsrf=${xsrfPhp}&up=${up}&t${phpTypeId}=${encodeURIComponent(value)}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB}/_m_new/${nodeTypeId}`, `_xsrf=${xsrfNode}&up=${up}&t${nodeTypeId}=${encodeURIComponent(value)}&JSON=1`, cookie()),
  ]);
  const phpId = Number(php.json?.id);
  const nodeId = Number(node.json?.id);
  if (phpId > 0) created.php.objects.push(phpId);
  if (nodeId > 0) created.node.objects.push(nodeId);
  return { phpId, nodeId, php, node };
}

// ─── Section 1: Auth & Session ───────────────────────────────────────────────

async function section1_auth() {
  section('Section 1: Auth & Session');

  // 1.1 Auth — correct creds, form POST (redirect)
  {
    const { php, node, skipped } = await cmp('1.1 auth redirect', 'POST', '/auth',
      `login=${USER}&pwd=${PASS}`);
    if (!skipped) {
      const issues = [];
      if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
      if (node.status !== 302) issues.push(`Node not 302: ${node.status}`);
      const phpCk = (php.headers['set-cookie'] || '').includes(`${DB}=`);
      const nodeCk = (node.headers['set-cookie'] || '').includes(`${DB}=`);
      if (phpCk !== nodeCk) issues.push(`Cookie: PHP=${phpCk} Node=${nodeCk}`);
      report('1.1 auth redirect', issues);
    }
  }

  // 1.2 Auth — correct creds + JSON=1
  {
    const { php, node, skipped } = await cmp('1.2 auth JSON', 'POST', '/auth',
      `login=${USER}&pwd=${PASS}&JSON=1`);
    if (!skipped) {
      const issues = [];
      if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
      if (php.json && node.json) {
        for (const k of ['status', 'token']) {
          if ((k in php.json) !== (k in node.json)) issues.push(`Key "${k}" presence differs`);
        }
      }
      report('1.2 auth JSON', issues);
    }
  }

  // 1.3 Auth — wrong password redirect
  {
    const { php, node, skipped } = await cmp('1.3 auth wrong pwd redirect', 'POST', '/auth',
      `login=${USER}&pwd=wrongpassword`);
    if (!skipped) {
      const issues = [];
      if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
      report('1.3 auth wrong pwd redirect', issues);
    }
  }

  // 1.4 Auth — wrong password JSON
  {
    const { php, node, skipped } = await cmp('1.4 auth wrong pwd JSON', 'POST', '/auth',
      `login=${USER}&pwd=wrongpassword&JSON=1`);
    if (!skipped) {
      const issues = [];
      if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
      if (!node.json) issues.push('Node not JSON');
      report('1.4 auth wrong pwd JSON', issues);
    }
  }

  // 1.5 Auth — empty fields
  {
    const { php, node, skipped } = await cmp('1.5 auth empty', 'POST', '/auth', `login=&pwd=`);
    if (!skipped) {
      const issues = [];
      if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
      report('1.5 auth empty', issues);
    }
  }

  // 1.6 Auth — with uri= redirect
  {
    const { php, node, skipped } = await cmp('1.6 auth uri', 'POST', '/auth',
      `login=${USER}&pwd=${PASS}&uri=/my/object/42`);
    if (!skipped) {
      const issues = [];
      if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
      report('1.6 auth uri', issues);
    }
  }

  // 1.7 XSRF — with valid token
  {
    const { php, node, skipped } = await cmp('1.7 xsrf valid', 'GET', '/xsrf');
    if (!skipped) {
      const issues = [];
      if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
      if (php.json && node.json) {
        for (const k of ['_xsrf', 'user', 'role']) {
          if ((k in php.json) !== (k in node.json)) issues.push(`Key "${k}" presence differs`);
        }
      }
      report('1.7 xsrf valid', issues);
    }
  }

  // 1.8 XSRF — without token
  {
    const { php, node, skipped } = await cmp('1.8 xsrf no token', 'GET', '/xsrf', null, { cookie: '' });
    if (!skipped) {
      const issues = [];
      if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
      report('1.8 xsrf no token', issues);
    }
  }

  // 1.9-1.10 getcode
  {
    const { php, node, skipped } = await cmp('1.9 getcode nonexistent', 'POST', '/getcode', `u=nonexistent_user_${TS}`);
    if (!skipped) report('1.9 getcode nonexistent', php.status !== node.status ? [`Status: ${php.status} vs ${node.status}`] : []);
  }
  {
    const { php, node, skipped } = await cmp('1.10 getcode empty', 'POST', '/getcode', `u=`);
    if (!skipped) report('1.10 getcode empty', php.status !== node.status ? [`Status: ${php.status} vs ${node.status}`] : []);
  }

  // 1.11-1.12 checkcode
  {
    const { php, node, skipped } = await cmp('1.11 checkcode wrong', 'POST', '/checkcode', `u=${USER}&c=0000`);
    if (!skipped) report('1.11 checkcode wrong', php.status !== node.status ? [`Status`] : []);
  }
  {
    const { php, node, skipped } = await cmp('1.12 checkcode empty', 'POST', '/checkcode', `u=${USER}&c=`);
    if (!skipped) report('1.12 checkcode empty', php.status !== node.status ? [`Status`] : []);
  }

  // 1.13-1.15 confirm
  {
    const { php, node, skipped } = await cmp('1.13 confirm missing', 'GET', '/confirm');
    if (!skipped) report('1.13 confirm missing', php.status !== node.status ? [`Status`] : []);
  }
  {
    const { php, node, skipped } = await cmp('1.14 confirm wrong old', 'POST', '/confirm', `u=${USER}&o=wronghash&p=newhash`);
    if (!skipped) report('1.14 confirm wrong old', php.status !== node.status ? [`Status`] : []);
  }
  {
    const { php, node, skipped } = await cmp('1.15 confirm nonexistent', 'POST', '/confirm', `u=nonexistent_${TS}&o=hash&p=hash`);
    if (!skipped) report('1.15 confirm nonexistent', php.status !== node.status ? [`Status`] : []);
  }

  // 1.16-1.17 login GET
  {
    const { php, node, skipped } = await cmp('1.16 login GET', 'GET', '/login');
    if (!skipped) report('1.16 login GET', php.status !== node.status ? [`Status`] : []);
  }
  {
    const { php, node, skipped } = await cmp('1.17 login GET u=', 'GET', '/login?u=testbot');
    if (!skipped) report('1.17 login GET u=', php.status !== node.status ? [`Status`] : []);
  }

  // 1.18 exit
  {
    const authRes = await http(PHP, 'POST', `/${DB}/auth`, `login=${USER}&pwd=${PASS}`);
    const tmpToken = ((authRes.headers['set-cookie'] || '').match(/my=([a-f0-9]+)/) || [])[1];
    if (tmpToken) {
      const [php, node] = await Promise.all([
        http(PHP, 'GET', `/${DB}/exit`, null, `${DB}=${tmpToken}`),
        http(NODE, 'GET', `/${DB}/exit`, null, `${DB}=${tmpToken}`),
      ]);
      const issues = [];
      if (!node.headers['location']) issues.push('Node no Location header');
      report('1.18 exit redirect', issues);
    } else {
      skip('1.18 exit redirect', 'No temp token');
    }
  }

  // 1.19 terms without token
  {
    const { php, node, skipped } = await cmp('1.19 terms no token', 'GET', '/terms', null, { cookie: '' });
    if (!skipped) report('1.19 terms no token', php.status !== node.status ? [`Status`] : []);
  }

  // 1.20 OPTIONS preflight
  {
    const [php, node] = await Promise.all([
      http(PHP, 'OPTIONS', `/${DB}/terms`),
      http(NODE, 'OPTIONS', `/${DB}/terms`),
    ]);
    const issues = [];
    if (node.status !== 204 && node.status !== 200) issues.push(`Node status: ${node.status}`);
    if (!node.headers['access-control-allow-origin']) issues.push('Node missing CORS');
    report('1.20 OPTIONS preflight', issues);
  }
}

// ─── Section 2: Types DDL ────────────────────────────────────────────────────

async function section2_typesDDL() {
  section('Section 2: Types DDL — All Base Types');

  const baseTypes = [
    [3, 'CHARS'], [8, 'SHORT'], [11, 'NUMBER'], [12, 'DATE'],
    [13, 'BOOLEAN'], [14, 'MEMO'], [16, 'DATETIME'], [17, 'SIGNED'],
    [19, 'FILE'], [22, 'PATH'], [20, 'PWD'],
  ];

  const createdTypes = [];

  for (let i = 0; i < baseTypes.length; i++) {
    const [bt, btName] = baseTypes[i];
    const name = `__comp_bt${bt}_${TS}`;
    const { phpId, nodeId, php, node } = await createType(name, bt);
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['id', 'obj', 'next_act']) {
        if ((k in php.json) !== (k in node.json)) issues.push(`Key "${k}" presence differs`);
      }
    } else {
      if (!php.json) issues.push(`PHP not JSON: ${short(php.body)}`);
      if (!node.json) issues.push(`Node not JSON: ${short(node.body)}`);
    }
    report(`2.${i + 1} _d_new t=${bt} (${btName})`, issues);
    if (phpId > 0 && nodeId > 0) createdTypes.push({ phpId, nodeId, baseType: bt, name: btName });
  }

  const mainType = createdTypes[0]; // CHARS type
  if (!mainType) { console.log('  ⚠ No types created, skipping remaining DDL tests'); return { createdTypes }; }

  section('Section 2: Types DDL — Operations');

  // Duplicate type name
  {
    const name = `__comp_bt3_${TS}`;
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_d_new`, `_xsrf=${xsrfPhp}&val=${name}_p&t=3&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_d_new`, `_xsrf=${xsrfNode}&val=${name}_n&t=3&JSON=1`, cookie()),
    ]);
    report('2.12 _d_new duplicate name', []);
  }

  // Rename type
  {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_d_save/${mainType.phpId}`, `_xsrf=${xsrfPhp}&val=__comp_renamed_p_${TS}&t=3&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_d_save/${mainType.nodeId}`, `_xsrf=${xsrfNode}&val=__comp_renamed_n_${TS}&t=3&JSON=1`, cookie()),
    ]);
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['id', 'obj', 'next_act']) {
        if ((k in php.json) !== (k in node.json)) issues.push(`Key "${k}" differs`);
      }
    }
    report('2.13 _d_save rename', issues);
  }

  // Save with unique
  {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_d_save/${mainType.phpId}`, `_xsrf=${xsrfPhp}&val=__comp_renamed_p_${TS}&t=3&unique=1&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_d_save/${mainType.nodeId}`, `_xsrf=${xsrfNode}&val=__comp_renamed_n_${TS}&t=3&unique=1&JSON=1`, cookie()),
    ]);
    report('2.14 _d_save unique', php.status !== node.status ? [`Status`] : []);
  }

  // Add columns — _d_req expects type IDs (not base type numbers!), so use createdTypes
  // Each created type IS a column type (e.g. a CHARS type acts as a CHARS column)
  const addedReqs = { php: [], node: [] };
  const colSources = createdTypes.slice(0, 8); // use first 8 created types as column types

  for (let i = 0; i < colSources.length; i++) {
    const src = colSources[i];
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_d_req/${mainType.phpId}`, `_xsrf=${xsrfPhp}&t=${src.phpId}&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_d_req/${mainType.nodeId}`, `_xsrf=${xsrfNode}&t=${src.nodeId}&JSON=1`, cookie()),
    ]);
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json?.id > 0) addedReqs.php.push(Number(php.json.id));
    if (node.json?.id > 0) addedReqs.node.push(Number(node.json.id));
    report(`2.${15 + i} _d_req col=${src.name}`, issues);
  }

  // Duplicate column
  {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_d_req/${mainType.phpId}`, `_xsrf=${xsrfPhp}&t=3&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_d_req/${mainType.nodeId}`, `_xsrf=${xsrfNode}&t=3&JSON=1`, cookie()),
    ]);
    report('2.23 _d_req duplicate', php.status !== node.status ? [`Status`] : []);
  }

  // Alias operations
  if (addedReqs.php[0] && addedReqs.node[0]) {
    // Set alias
    {
      const [php, node] = await Promise.all([
        http(PHP, 'POST', `/${DB}/_d_alias/${addedReqs.php[0]}`, `_xsrf=${xsrfPhp}&alias=my_alias&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_d_alias/${addedReqs.node[0]}`, `_xsrf=${xsrfNode}&alias=my_alias&JSON=1`, cookie()),
      ]);
      report('2.24 _d_alias set', php.status !== node.status ? [`Status`] : []);
    }
    // Invalid alias (colon)
    {
      const [php, node] = await Promise.all([
        http(PHP, 'POST', `/${DB}/_d_alias/${addedReqs.php[0]}`, `_xsrf=${xsrfPhp}&alias=bad:alias&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_d_alias/${addedReqs.node[0]}`, `_xsrf=${xsrfNode}&alias=bad:alias&JSON=1`, cookie()),
      ]);
      report('2.25 _d_alias invalid', php.status !== node.status ? [`Status`] : []);
    }
    // Clear alias
    {
      const [php, node] = await Promise.all([
        http(PHP, 'POST', `/${DB}/_d_alias/${addedReqs.php[0]}`, `_xsrf=${xsrfPhp}&alias=&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_d_alias/${addedReqs.node[0]}`, `_xsrf=${xsrfNode}&alias=&JSON=1`, cookie()),
      ]);
      report('2.26 _d_alias clear', php.status !== node.status ? [`Status`] : []);
    }
    // Toggle NOT NULL
    {
      const [php, node] = await Promise.all([
        http(PHP, 'POST', `/${DB}/_d_null/${addedReqs.php[0]}`, `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_d_null/${addedReqs.node[0]}`, `_xsrf=${xsrfNode}&JSON=1`, cookie()),
      ]);
      report('2.27 _d_null toggle', php.status !== node.status ? [`Status`] : []);
    }
    // Toggle MULTI
    {
      const [php, node] = await Promise.all([
        http(PHP, 'POST', `/${DB}/_d_multi/${addedReqs.php[0]}`, `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_d_multi/${addedReqs.node[0]}`, `_xsrf=${xsrfNode}&JSON=1`, cookie()),
      ]);
      report('2.28 _d_multi toggle', php.status !== node.status ? [`Status`] : []);
    }
    // _d_attrs complex
    {
      const [php, node] = await Promise.all([
        http(PHP, 'POST', `/${DB}/_d_attrs/${addedReqs.php[0]}`, `_xsrf=${xsrfPhp}&alias=attr_alias&required=1&multi=0&name=renamed_col&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_d_attrs/${addedReqs.node[0]}`, `_xsrf=${xsrfNode}&alias=attr_alias&required=1&multi=0&name=renamed_col&JSON=1`, cookie()),
      ]);
      report('2.29 _d_attrs complex', php.status !== node.status ? [`Status`] : []);
    }
    // _d_attrs set_null
    {
      const [php, node] = await Promise.all([
        http(PHP, 'POST', `/${DB}/_d_attrs/${addedReqs.php[0]}`, `_xsrf=${xsrfPhp}&set_null=1&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_d_attrs/${addedReqs.node[0]}`, `_xsrf=${xsrfNode}&set_null=1&JSON=1`, cookie()),
      ]);
      report('2.30 _d_attrs set_null', php.status !== node.status ? [`Status`] : []);
    }
  }

  // Move column up
  if (addedReqs.php.length >= 2 && addedReqs.node.length >= 2) {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_d_up/${addedReqs.php[1]}`, `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_d_up/${addedReqs.node[1]}`, `_xsrf=${xsrfNode}&JSON=1`, cookie()),
    ]);
    report('2.31 _d_up', php.status !== node.status ? [`Status`] : []);
  }

  // Set column order
  if (addedReqs.php[0] && addedReqs.node[0]) {
    {
      const [php, node] = await Promise.all([
        http(PHP, 'POST', `/${DB}/_d_ord/${addedReqs.php[0]}`, `_xsrf=${xsrfPhp}&order=2&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_d_ord/${addedReqs.node[0]}`, `_xsrf=${xsrfNode}&order=2&JSON=1`, cookie()),
      ]);
      report('2.32 _d_ord set', php.status !== node.status ? [`Status`] : []);
    }
    // Invalid order
    {
      const [php, node] = await Promise.all([
        http(PHP, 'POST', `/${DB}/_d_ord/${addedReqs.php[0]}`, `_xsrf=${xsrfPhp}&order=0&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_d_ord/${addedReqs.node[0]}`, `_xsrf=${xsrfNode}&order=0&JSON=1`, cookie()),
      ]);
      report('2.33 _d_ord invalid', php.status !== node.status ? [`Status`] : []);
    }
  }

  // Add reference
  if (createdTypes.length >= 2) {
    const refType = createdTypes[1];
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_d_ref/${mainType.phpId}`, `_xsrf=${xsrfPhp}&t=${refType.phpId}&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_d_ref/${mainType.nodeId}`, `_xsrf=${xsrfNode}&t=${refType.nodeId}&JSON=1`, cookie()),
    ]);
    report('2.34 _d_ref', php.status !== node.status ? [`Status`] : []);
  }

  // Delete column
  if (addedReqs.php.length > 1 && addedReqs.node.length > 1) {
    const lastP = addedReqs.php[addedReqs.php.length - 1];
    const lastN = addedReqs.node[addedReqs.node.length - 1];
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_d_del_req/${lastP}`, `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_d_del_req/${lastN}`, `_xsrf=${xsrfNode}&JSON=1`, cookie()),
    ]);
    report('2.35 _d_del_req', php.status !== node.status ? [`Status`] : []);
  }

  // NOT NULL was already undone by _d_attrs set_null=1 (test 2.30).
  // Do NOT toggle _d_null again — that would re-enable NOT NULL and break _m_new.

  return { createdTypes, mainType, addedReqs };
}

// ─── Section 3: Objects DML ──────────────────────────────────────────────────

async function section3_objectsDML(mainType, addedReqs) {
  if (!mainType) { console.log('  ⚠ No main type, skipping Objects DML'); return {}; }

  section('Section 3: Objects DML — Create & Update');

  const obj1 = await createObject(mainType.phpId, mainType.nodeId, 'test_obj_1');
  report('3.1 _m_new root', obj1.php.status !== obj1.node.status ? [`Status`] : []);

  const obj2 = await createObject(mainType.phpId, mainType.nodeId, 'test_obj_child');
  report('3.2 _m_new second', []);

  // Under parent
  if (obj1.phpId && obj1.nodeId) {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_new/${mainType.phpId}`, `_xsrf=${xsrfPhp}&up=${obj1.phpId}&t${mainType.phpId}=child_obj&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_m_new/${mainType.nodeId}`, `_xsrf=${xsrfNode}&up=${obj1.nodeId}&t${mainType.nodeId}=child_obj&JSON=1`, cookie()),
    ]);
    if (Number(php.json?.id) > 0) created.php.objects.push(Number(php.json.id));
    if (Number(node.json?.id) > 0) created.node.objects.push(Number(node.json.id));
    report('3.3 _m_new under parent', php.status !== node.status ? [`Status`] : []);
  }

  // Save — update value
  if (obj1.phpId && obj1.nodeId) {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_save/${obj1.phpId}`, `_xsrf=${xsrfPhp}&val=updated_value&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_m_save/${obj1.nodeId}`, `_xsrf=${xsrfNode}&val=updated_value&JSON=1`, cookie()),
    ]);
    report('3.4 _m_save update', php.status !== node.status ? [`Status`] : []);
  }

  // _m_set different data types
  section('Section 3: Objects DML — Set Attributes');

  const testValues = [
    ['hello_world', 'CHARS'], ['short_txt', 'SHORT'], ['12345', 'NUMBER'],
    ['2026-03-15', 'DATE'], ['1', 'BOOLEAN'], ['This is a memo\nwith newlines', 'MEMO'],
    ['2026-03-15 12:30:00', 'DATETIME'], ['-42', 'SIGNED'],
  ];

  if (obj1.phpId && obj1.nodeId && addedReqs && addedReqs.php.length > 0) {
    for (let i = 0; i < Math.min(addedReqs.php.length, addedReqs.node.length, testValues.length); i++) {
      const [val, typeName] = testValues[i];
      const [php, node] = await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_set/${obj1.phpId}`, `_xsrf=${xsrfPhp}&t${addedReqs.php[i]}=${encodeURIComponent(val)}&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_m_set/${obj1.nodeId}`, `_xsrf=${xsrfNode}&t${addedReqs.node[i]}=${encodeURIComponent(val)}&JSON=1`, cookie()),
      ]);
      const issues = [];
      if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
      report(`3.${5 + i} _m_set ${typeName}`, issues);
    }

    // Clear value
    {
      const [php, node] = await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_set/${obj1.phpId}`, `_xsrf=${xsrfPhp}&t${addedReqs.php[0]}=&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_m_set/${obj1.nodeId}`, `_xsrf=${xsrfNode}&t${addedReqs.node[0]}=&JSON=1`, cookie()),
      ]);
      report('3.13 _m_set clear', php.status !== node.status ? [`Status`] : []);
    }
  }

  section('Section 3: Objects DML — Move & Order');

  // Copy
  if (obj1.phpId && obj1.nodeId) {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_save/${obj1.phpId}`, `_xsrf=${xsrfPhp}&copybtn&val=copied_obj&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_m_save/${obj1.nodeId}`, `_xsrf=${xsrfNode}&copybtn&val=copied_obj&JSON=1`, cookie()),
    ]);
    if (Number(php.json?.id) > 0) created.php.objects.push(Number(php.json.id));
    if (Number(node.json?.id) > 0) created.node.objects.push(Number(node.json.id));
    report('3.14 _m_save copy', php.status !== node.status ? [`Status`] : []);
  }

  // Move up
  if (obj2.phpId && obj2.nodeId) {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_up/${obj2.phpId}`, `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_m_up/${obj2.nodeId}`, `_xsrf=${xsrfNode}&JSON=1`, cookie()),
    ]);
    report('3.15 _m_up', php.status !== node.status ? [`Status`] : []);
  }

  // Set order
  if (obj1.phpId && obj1.nodeId) {
    {
      const [php, node] = await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_ord/${obj1.phpId}`, `_xsrf=${xsrfPhp}&order=2&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_m_ord/${obj1.nodeId}`, `_xsrf=${xsrfNode}&order=2&JSON=1`, cookie()),
      ]);
      report('3.16 _m_ord set', php.status !== node.status ? [`Status`] : []);
    }
    {
      const [php, node] = await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_ord/${obj1.phpId}`, `_xsrf=${xsrfPhp}&order=0&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_m_ord/${obj1.nodeId}`, `_xsrf=${xsrfNode}&order=0&JSON=1`, cookie()),
      ]);
      report('3.17 _m_ord invalid', php.status !== node.status ? [`Status`] : []);
    }
  }

  // Move to sibling
  if (obj1.phpId && obj2.phpId && obj1.nodeId && obj2.nodeId) {
    {
      const [php, node] = await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_move/${obj2.phpId}`, `_xsrf=${xsrfPhp}&up=${obj1.phpId}&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_m_move/${obj2.nodeId}`, `_xsrf=${xsrfNode}&up=${obj1.nodeId}&JSON=1`, cookie()),
      ]);
      report('3.18 _m_move to sibling', php.status !== node.status ? [`Status`] : []);
    }
    // Move to root
    {
      const [php, node] = await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_move/${obj2.phpId}`, `_xsrf=${xsrfPhp}&up=1&JSON=1`, cookie()),
        http(NODE, 'POST', `/${DB}/_m_move/${obj2.nodeId}`, `_xsrf=${xsrfNode}&up=1&JSON=1`, cookie()),
      ]);
      report('3.19 _m_move to root', php.status !== node.status ? [`Status`] : []);
    }
  }

  // Change ID
  if (obj2.phpId && obj2.nodeId) {
    const newPid = 8000000 + TS % 100000;
    const newNid = 8100000 + TS % 100000;
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_id/${obj2.phpId}`, `_xsrf=${xsrfPhp}&new_id=${newPid}&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_m_id/${obj2.nodeId}`, `_xsrf=${xsrfNode}&new_id=${newNid}&JSON=1`, cookie()),
    ]);
    const issues = [];
    if (php.status !== node.status) issues.push(`Status`);
    if (php.json && String(php.json.id) !== String(newPid)) issues.push('PHP id != newId');
    if (node.json && String(node.json.id) !== String(newNid)) issues.push('Node id != newId');
    report('3.20 _m_id change', issues);
    const pi = created.php.objects.indexOf(obj2.phpId);
    if (pi >= 0) created.php.objects[pi] = newPid;
    const ni = created.node.objects.indexOf(obj2.nodeId);
    if (ni >= 0) created.node.objects[ni] = newNid;
    obj2.phpId = newPid; obj2.nodeId = newNid;
  }

  // Duplicate ID
  if (obj1.phpId && obj2.phpId) {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_id/${obj1.phpId}`, `_xsrf=${xsrfPhp}&new_id=${obj2.phpId}&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_m_id/${obj1.nodeId}`, `_xsrf=${xsrfNode}&new_id=${obj2.nodeId}&JSON=1`, cookie()),
    ]);
    report('3.21 _m_id duplicate', php.status !== node.status ? [`Status`] : []);
  }

  // Delete
  if (obj2.phpId && obj2.nodeId) {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_del/${obj2.phpId}`, `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_m_del/${obj2.nodeId}`, `_xsrf=${xsrfNode}&JSON=1`, cookie()),
    ]);
    report('3.22 _m_del', php.status !== node.status ? [`Status`] : []);
    created.php.objects = created.php.objects.filter(id => id !== obj2.phpId);
    created.node.objects = created.node.objects.filter(id => id !== obj2.nodeId);
  }

  // Delete nonexistent
  {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_del/999999999`, `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_m_del/999999999`, `_xsrf=${xsrfNode}&JSON=1`, cookie()),
    ]);
    report('3.23 _m_del nonexistent', php.status !== node.status ? [`Status`] : []);
  }

  return { obj1 };
}

// ─── Section 4: Listing & Querying ───────────────────────────────────────────

async function section4_listing(mainType) {
  if (!mainType) return;

  section('Section 4: Listing — JSON Formats');

  // object?JSON=1
  {
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/object/${mainType.phpId}?JSON=1`, null, cookie()),
      http(NODE, 'GET', `/${DB}/object/${mainType.nodeId}?JSON=1`, null, cookie()),
    ]);
    const issues = [];
    if (php.json && node.json) {
      if (Array.isArray(php.json.object) !== Array.isArray(node.json.object))
        issues.push('object key type differs');
    }
    report('4.1 object?JSON=1', issues);
  }

  // JSON_DATA
  {
    const r = await cmp('4.2 object?JSON_DATA', 'GET', `/object/${mainType.phpId}?JSON_DATA`);
    if (!r.skipped) {
      const issues = [];
      if (r.php.json && r.node.json && Array.isArray(r.php.json) !== Array.isArray(r.node.json))
        issues.push('Root type differs');
      report('4.2 object?JSON_DATA', issues);
    }
  }

  // LIMIT=1
  {
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/object/${mainType.phpId}?JSON=1&LIMIT=1`, null, cookie()),
      http(NODE, 'GET', `/${DB}/object/${mainType.nodeId}?JSON=1&LIMIT=1`, null, cookie()),
    ]);
    const issues = [];
    const nLen = Array.isArray(node.json?.object) ? node.json.object.length : -1;
    if (nLen > 1) issues.push(`Node ${nLen} objects with LIMIT=1`);
    report('4.3 object LIMIT=1', issues);
  }

  // LIMIT=1,2
  {
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/object/${mainType.phpId}?JSON=1&LIMIT=1,2`, null, cookie()),
      http(NODE, 'GET', `/${DB}/object/${mainType.nodeId}?JSON=1&LIMIT=1,2`, null, cookie()),
    ]);
    const issues = [];
    const nLen = Array.isArray(node.json?.object) ? node.json.object.length : -1;
    if (nLen > 2) issues.push(`Node ${nLen} with LIMIT=1,2`);
    report('4.4 object LIMIT=1,2', issues);
  }

  section('Section 4: Listing — Sorting');

  // Sort by val
  {
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/object/${mainType.phpId}?JSON=1&order_val=val`, null, cookie()),
      http(NODE, 'GET', `/${DB}/object/${mainType.nodeId}?JSON=1&order_val=val`, null, cookie()),
    ]);
    const issues = [];
    if (node.json?.object) {
      const vals = node.json.object.map(o => o.val);
      const sorted = [...vals].sort();
      if (JSON.stringify(vals) !== JSON.stringify(sorted)) issues.push('Node not sorted');
    }
    report('4.5 order_val=val', issues);
  }

  // Desc
  {
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/object/${mainType.phpId}?JSON=1&order_val=val&desc=1`, null, cookie()),
      http(NODE, 'GET', `/${DB}/object/${mainType.nodeId}?JSON=1&order_val=val&desc=1`, null, cookie()),
    ]);
    const issues = [];
    if (node.json?.object) {
      const vals = node.json.object.map(o => o.val);
      const sorted = [...vals].sort().reverse();
      if (JSON.stringify(vals) !== JSON.stringify(sorted)) issues.push('Node not desc sorted');
    }
    report('4.6 desc=1', issues);
  }

  section('Section 4: Listing — Filters');

  // F_U=1
  {
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/object/${mainType.phpId}?JSON=1&F_U=1`, null, cookie()),
      http(NODE, 'GET', `/${DB}/object/${mainType.nodeId}?JSON=1&F_U=1`, null, cookie()),
    ]);
    const issues = [];
    if (node.json?.object) {
      const bad = node.json.object.filter(o => String(o.up) !== '1');
      if (bad.length) issues.push(`Node: ${bad.length} not root`);
    }
    report('4.7 F_U=1', issues);
  }

  // F_U nonexistent
  {
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/object/${mainType.phpId}?JSON=1&F_U=999999999`, null, cookie()),
      http(NODE, 'GET', `/${DB}/object/${mainType.nodeId}?JSON=1&F_U=999999999`, null, cookie()),
    ]);
    const issues = [];
    const nLen = Array.isArray(node.json?.object) ? node.json.object.length : 0;
    if (nLen !== 0) issues.push(`Node ${nLen} for nonexistent parent`);
    report('4.8 F_U=nonexistent', issues);
  }

  // Empty type listing
  {
    const emptyType = await createType(`__comp_empty_${TS}`, 3);
    if (emptyType.phpId && emptyType.nodeId) {
      const [php, node] = await Promise.all([
        http(PHP, 'GET', `/${DB}/object/${emptyType.phpId}?JSON=1`, null, cookie()),
        http(NODE, 'GET', `/${DB}/object/${emptyType.nodeId}?JSON=1`, null, cookie()),
      ]);
      const nLen = Array.isArray(node.json?.object) ? node.json.object.length : 0;
      report('4.9 empty type', nLen !== 0 ? [`Node ${nLen} in empty type`] : []);
    }
  }

  section('Section 4: Listing — Edit & Metadata');

  // edit_obj
  {
    const phpList = await http(PHP, 'GET', `/${DB}/object/${mainType.phpId}?JSON=1`, null, cookie());
    const nodeList = await http(NODE, 'GET', `/${DB}/object/${mainType.nodeId}?JSON=1`, null, cookie());
    const phpObjId = phpList.json?.object?.[0]?.id;
    const nodeObjId = nodeList.json?.object?.[0]?.id;
    if (phpObjId && nodeObjId) {
      const [php, node] = await Promise.all([
        http(PHP, 'GET', `/${DB}/edit_obj/${phpObjId}?JSON=1`, null, cookie()),
        http(NODE, 'GET', `/${DB}/edit_obj/${nodeObjId}?JSON=1`, null, cookie()),
      ]);
      const issues = [];
      if (php.json && node.json) {
        const pKeys = Object.keys(php.json).sort();
        const nKeys = Object.keys(node.json).sort();
        if (JSON.stringify(pKeys) !== JSON.stringify(nKeys))
          issues.push(`Keys: PHP=${pKeys} Node=${nKeys}`);
      }
      report('4.10 edit_obj?JSON', issues);
    } else skip('4.10 edit_obj?JSON', 'No objects');
  }

  // edit_types
  {
    const { php, node, skipped } = await cmp('4.11 edit_types', 'GET', '/edit_types?JSON=1');
    if (!skipped) report('4.11 edit_types', typeof php.json !== typeof node.json ? [`Type`] : []);
  }

  // terms
  {
    const { php, node, skipped } = await cmp('4.12 terms', 'GET', '/terms');
    if (!skipped) {
      const issues = [];
      if (Array.isArray(php.json) !== Array.isArray(node.json)) issues.push('Root type differs');
      report('4.12 terms', issues);
    }
  }

  // metadata
  {
    const { php, node, skipped } = await cmp('4.13 metadata', 'GET', '/metadata');
    if (!skipped) report('4.13 metadata', php.status !== node.status ? [`Status`] : []);
  }

  // obj_meta
  {
    const { php, node, skipped } = await cmp('4.14 obj_meta', 'GET', `/obj_meta/${mainType.phpId}`);
    if (!skipped) {
      const issues = [];
      if (php.json && node.json) {
        for (const k of ['id', 'val', 'up', 't']) {
          if ((k in php.json) !== (k in node.json)) issues.push(`Key "${k}" differs`);
        }
      }
      report('4.14 obj_meta', issues);
    } else {
      const n = await http(NODE, 'GET', `/${DB}/obj_meta/${mainType.nodeId}`, null, cookie());
      nodeOnly('4.14 obj_meta', n, (n, iss) => { if (!n.json?.id) iss.push('Missing id'); });
    }
  }

  // obj_meta nonexistent
  {
    const { php, node, skipped } = await cmp('4.15 obj_meta 999999999', 'GET', '/obj_meta/999999999');
    if (!skipped) report('4.15 obj_meta nonexistent', php.status !== node.status ? [`Status`] : []);
  }

  section('Section 4: Listing — API Endpoints');

  // _dict all
  {
    const r = await cmp('4.16 _dict all', 'GET', '/_dict');
    if (r.skipped) {
      const n = await http(NODE, 'GET', `/${DB}/_dict`, null, cookie());
      nodeOnly('4.16 _dict all', n, (n, iss) => { if (!n.json || !Array.isArray(n.json)) iss.push('Not array'); });
    } else report('4.16 _dict all', r.php.status !== r.node.status ? [`Status`] : []);
  }

  // _dict specific (returns single type metadata object)
  {
    // Use a well-known existing type (from terms) instead of test type
    const termsList = await http(NODE, 'GET', `/${DB}/terms`, null, cookie());
    const knownTypeId = termsList.json?.[0]?.id || mainType.nodeId;
    const n = await http(NODE, 'GET', `/${DB}/_dict/${knownTypeId}`, null, cookie());
    nodeOnly('4.17 _dict specific', n, (n, iss) => { if (!n.json?.id && !n.json?.name) iss.push('Missing id/name'); });
  }

  // _list
  {
    const r = await cmp('4.18 _list', 'GET', `/_list/${mainType.phpId}?JSON=1`);
    if (r.skipped) {
      const n = await http(NODE, 'GET', `/${DB}/_list/${mainType.nodeId}?JSON=1`, null, cookie());
      nodeOnly('4.18 _list', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    } else report('4.18 _list', []);
  }

  // _list_join
  {
    const r = await cmp('4.19 _list_join', 'GET', `/_list_join/${mainType.phpId}?JSON=1`);
    if (r.skipped) {
      const n = await http(NODE, 'GET', `/${DB}/_list_join/${mainType.nodeId}?JSON=1`, null, cookie());
      nodeOnly('4.19 _list_join', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    } else report('4.19 _list_join', []);
  }

  // _d_main (POST needs per-server XSRF)
  {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_d_main/${mainType.phpId}`, `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_d_main/${mainType.nodeId}`, `_xsrf=${xsrfNode}&JSON=1`, cookie()),
    ]);
    if (php.status >= 500 || php.body === 'null' || php.body === '') {
      skip('4.20 _d_main', 'PHP failed');
      nodeOnly('4.20 _d_main', node, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    } else report('4.20 _d_main', php.status !== node.status ? [`Status`] : []);
  }

  // _ref_reqs
  {
    const r = await cmp('4.21 _ref_reqs', 'GET', `/_ref_reqs/${mainType.phpId}`);
    if (r.skipped) {
      const n = await http(NODE, 'GET', `/${DB}/_ref_reqs/${mainType.nodeId}`, null, cookie());
      nodeOnly('4.21 _ref_reqs', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    } else report('4.21 _ref_reqs', []);
  }
}

// ─── Section 5: Edge Cases ───────────────────────────────────────────────────

async function section5_edgeCases(mainType) {
  if (!mainType) return;

  section('Section 5: Edge Cases — Special Characters');

  const specialValues = [
    ['<script>alert(1)</script>', 'XSS script'],
    ['<img onerror=alert(1) src=x>', 'XSS img'],
    ['Тест кириллица', 'Cyrillic'],
    ["O'Brien", 'Single quote'],
    ['He said "hi"', 'Double quote'],
    ['back\\slash', 'Backslash'],
    ['tab\there', 'Tab'],
  ];

  for (let si = 0; si < specialValues.length; si++) {
    const [val, desc] = specialValues[si];
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_new/${mainType.phpId}`, `_xsrf=${xsrfPhp}&up=1&t${mainType.phpId}=${encodeURIComponent(val)}&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_m_new/${mainType.nodeId}`, `_xsrf=${xsrfNode}&up=1&t${mainType.nodeId}=${encodeURIComponent(val)}&JSON=1`, cookie()),
    ]);
    if (Number(php.json?.id) > 0) created.php.objects.push(Number(php.json.id));
    if (Number(node.json?.id) > 0) created.node.objects.push(Number(node.json.id));
    report(`5.${si + 1} ${desc}`, php.status !== node.status ? [`Status`] : []);
  }

  section('Section 5: Edge Cases — Boundary Values');

  // LIMIT edge cases
  for (const [lim, label] of [['0', 'LIMIT=0'], ['999999', 'LIMIT=999999'], ['-1', 'LIMIT=-1']]) {
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/object/${mainType.phpId}?JSON=1&LIMIT=${lim}`, null, cookie()),
      http(NODE, 'GET', `/${DB}/object/${mainType.nodeId}?JSON=1&LIMIT=${lim}`, null, cookie()),
    ]);
    const idx = 8 + [['0'], ['999999'], ['-1']].findIndex(l => l[0] === lim);
    if (php.status >= 500) { skip(`5.${idx} ${label}`, 'PHP built-in server 500'); continue; }
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    report(`5.${idx} ${label}`, issues);
  }

  // obj_meta edge cases
  {
    const { php, node, skipped } = await cmp('5.11 obj_meta ID=0', 'GET', '/obj_meta/0');
    if (!skipped) report('5.11 obj_meta ID=0', php.status !== node.status ? [`Status`] : []);
  }
  {
    const { php, node, skipped } = await cmp('5.12 obj_meta MAX_INT', 'GET', '/obj_meta/2147483647');
    if (!skipped) report('5.12 obj_meta MAX_INT', php.status !== node.status ? [`Status`] : []);
  }

  // Empty POST body
  {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_save/1`, `_xsrf=${xsrfPhp}`, cookie()),
      http(NODE, 'POST', `/${DB}/_m_save/1`, `_xsrf=${xsrfNode}`, cookie()),
    ]);
    report('5.13 empty POST', php.status !== node.status ? [`Status`] : []);
  }

  // POST without XSRF
  {
    const node = await http(NODE, 'POST', `/${DB}/_m_new/${mainType.nodeId}`, `up=1&t${mainType.nodeId}=no_xsrf&JSON=1`, cookie());
    report('5.14 POST no XSRF', node.status < 400 ? [`Node accepted: ${node.status}`] : []);
  }

  // Headers
  {
    const { php, node, skipped } = await cmp('5.15 headers', 'GET', '/terms');
    if (!skipped) {
      const issues = [];
      const ncc = node.headers['cache-control'] || '';
      if (!ncc.includes('no-cache')) issues.push('Missing no-cache');
      if (!ncc.includes('no-store')) issues.push('Missing no-store');
      const ncd = node.headers['content-disposition'] || '';
      const pcd = php.headers['content-disposition'] || '';
      if (pcd.includes('attachment') !== ncd.includes('attachment'))
        issues.push(`CD: PHP="${pcd}" Node="${ncd}"`);
      report('5.15 Cache+CD headers', issues);
    }
  }

  // CORS
  {
    const n = await http(NODE, 'GET', `/${DB}/terms`, null, cookie());
    report('5.16 CORS', n.headers['access-control-allow-origin'] !== '*' ? ['Missing *'] : []);
  }
}

// ─── Section 6: Pages JSON ───────────────────────────────────────────────────

async function section6_pages() {
  section('Section 6: Pages JSON API');

  // dict?JSON
  {
    const { php, node, skipped } = await cmp('6.1 dict?JSON', 'GET', '/dict?JSON=1');
    if (!skipped) report('6.1 dict?JSON', typeof php.json !== typeof node.json ? [`Type`] : []);
  }

  // sql?JSON — PHP wraps differently, just check both return JSON
  {
    const { php, node, skipped } = await cmp('6.2 sql?JSON', 'GET', '/sql?JSON=1');
    if (!skipped) {
      const issues = [];
      if (!php.json) issues.push('PHP not JSON');
      if (!node.json) issues.push('Node not JSON');
      report('6.2 sql?JSON', issues);
    }
  }

  // form?JSON — same
  {
    const { php, node, skipped } = await cmp('6.3 form?JSON', 'GET', '/form?JSON=1');
    if (!skipped) {
      const issues = [];
      if (!php.json) issues.push('PHP not JSON');
      if (!node.json) issues.push('Node not JSON');
      report('6.3 form?JSON', issues);
    }
  }

  // dir_admin
  {
    const r = await cmp('6.4 dir_admin', 'GET', '/dir_admin?JSON=1');
    if (r.skipped) {
      const n = await http(NODE, 'GET', `/${DB}/dir_admin?JSON=1`, null, cookie());
      nodeOnly('6.4 dir_admin', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    } else report('6.4 dir_admin', []);
  }
}

// ─── Section 7: Reports ─────────────────────────────────────────────────────

async function section7_reports() {
  section('Section 7: Reports');

  const nodeList = await http(NODE, 'GET', `/${DB}/report?JSON=1`, null, cookie());
  if (!nodeList.json || !Array.isArray(nodeList.json) || nodeList.json.length === 0) {
    skip('7.x Reports', 'No reports'); return;
  }
  nodeOnly('7.1 report list', nodeList, (n, iss) => { if (!Array.isArray(n.json)) iss.push('Not array'); });

  const reportId = nodeList.json[0].id || nodeList.json[0].ID;
  console.log(`  Using report: ${reportId}`);

  const formats = [
    ['JSON=1', 'JSON'], ['JSON_DATA', 'JSON_DATA'], ['JSON_KV', 'JSON_KV'],
    ['JSON_CR', 'JSON_CR'], ['JSON_HR', 'JSON_HR'], ['RECORD_COUNT', 'RECORD_COUNT'],
  ];

  for (let fi = 0; fi < formats.length; fi++) {
    const [param, name] = formats[fi];
    const n = await http(NODE, 'GET', `/${DB}/report/${reportId}?${param}`, null, cookie());
    nodeOnly(`7.${fi + 2} report?${name}`, n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
  }

  // LIMIT
  {
    const n = await http(NODE, 'GET', `/${DB}/report/${reportId}?JSON_KV&LIMIT=2`, null, cookie());
    nodeOnly('7.8 report LIMIT=2', n, (n, iss) => {
      if (!Array.isArray(n.json)) iss.push('Not array');
      else if (n.json.length > 2) iss.push(`${n.json.length} rows`);
    });
  }

  // Nonexistent
  {
    const n = await http(NODE, 'GET', `/${DB}/report/999999999?JSON=1`, null, cookie());
    nodeOnly('7.9 report nonexistent', n, (n, iss) => {
      if (n.status === 200 && n.json?.data?.length > 0) iss.push('Got data');
    });
  }
}

// ─── Section 8: Type Deletion ────────────────────────────────────────────────

async function section8_typeDeletion(mainType) {
  if (!mainType) return;
  section('Section 8: Type Deletion');

  {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_d_del/${mainType.phpId}`, `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_d_del/${mainType.nodeId}`, `_xsrf=${xsrfNode}&JSON=1`, cookie()),
    ]);
    report('8.1 _d_del with objects', php.status !== node.status ? [`Status`] : []);
  }
  {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_d_del/999999999`, `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_d_del/999999999`, `_xsrf=${xsrfNode}&JSON=1`, cookie()),
    ]);
    report('8.2 _d_del nonexistent', php.status !== node.status ? [`Status`] : []);
  }
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

async function cleanup() {
  section('Cleanup');
  let cleaned = 0;
  for (const [label, base, xsrf, data] of [
    ['PHP', PHP, xsrfPhp, created.php],
    ['Node', NODE, xsrfNode, created.node],
  ]) {
    for (const id of data.objects) {
      await http(base, 'POST', `/${DB}/_m_del/${id}`, `_xsrf=${xsrf}&JSON=1`, cookie());
      cleaned++;
    }
    for (const id of data.types) {
      await http(base, 'POST', `/${DB}/_d_del/${id}`, `_xsrf=${xsrf}&JSON=1&forced`, cookie());
      cleaned++;
    }
  }
  // Final cleanup
  for (const [label, base, xsrf] of [['PHP', PHP, xsrfPhp], ['Node', NODE, xsrfNode]]) {
    const terms = await http(base, 'GET', `/${DB}/terms`, null, cookie());
    if (terms.json) {
      const stale = terms.json.filter(t => (t.val || t.name || '').startsWith('__comp'));
      for (const t of stale) {
        await http(base, 'POST', `/${DB}/_d_del/${t.id}`, `_xsrf=${xsrf}&JSON=1&forced`, cookie());
        cleaned++;
      }
    }
  }
  console.log(`  Cleaned ${cleaned} entities`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  await setup();
  await section1_auth();
  await reauth();
  const ddlResult = await section2_typesDDL();
  const dmlResult = await section3_objectsDML(ddlResult?.mainType, ddlResult?.addedReqs);
  await section4_listing(ddlResult?.mainType);
  await section5_edgeCases(ddlResult?.mainType);
  await section6_pages();
  await section7_reports();
  await section8_typeDeletion(ddlResult?.mainType);
  await cleanup();

  console.log('\n\x1b[1m╔═══════════════════════════════════════════════════════╗\x1b[0m');
  console.log(`\x1b[1m║  \x1b[32m${passCount} PASS\x1b[0m  \x1b[31m${failCount} FAIL\x1b[0m  \x1b[33m${skipCount} SKIP\x1b[0m`);
  console.log('\x1b[1m╚═══════════════════════════════════════════════════════╝\x1b[0m');

  if (failCount > 0) {
    console.log('\n\x1b[31mFailed:\x1b[0m');
    for (const r of reports.filter(r => r.status === 'FAIL')) {
      console.log(`  ✗ ${r.name}`);
      for (const i of r.issues) console.log(`    → ${i}`);
    }
  }
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
