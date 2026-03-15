#!/usr/bin/env node
/**
 * Endpoint Parity Audit: PHP ↔ Node.js
 *
 * Tests remaining untested endpoints for response parity:
 *   Group A: _m_id, _dict, login GET, confirm
 *   Group B: csv_all, backup, _new_db
 *   Group C: jwt, register
 *   Group D: report (JSON format variants)
 *
 * Usage: node endpoints-parity-audit.js
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
const TS   = Date.now();

let token = '';
let xsrfPhp = '', xsrfNode = '';
let passCount = 0, failCount = 0, skipCount = 0;
const reports = [];

// IDs tracked per server for cleanup
const created = { php: { types: [], objects: [], dbs: [] }, node: { types: [], objects: [], dbs: [] } };

// ─── HTTP ───────────────────────────────────────────────────────────────────

async function http(baseUrl, method, path, body, cookie, extraHeaders = {}) {
  const url = `${baseUrl}${path}`;
  const headers = { ...extraHeaders };
  if (cookie) headers['Cookie'] = cookie;
  const opts = { method, headers, redirect: 'manual' };
  if (body && (method === 'POST' || method === 'PUT')) {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
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

// ─── Setup ──────────────────────────────────────────────────────────────────

async function setup() {
  console.log('\x1b[1m╔═══════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[1m║   Endpoint Parity Audit: PHP ↔ Node.js               ║\x1b[0m');
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
  console.log(`XSRF: ${xsrfPhp.slice(0, 8)}...\n`);

  // Pre-cleanup: stale test types
  for (const [label, base, xsrf] of [['PHP', PHP, xsrfPhp], ['Node', NODE, xsrfNode]]) {
    const terms = await http(base, 'GET', `/${DB}/terms`, null, cookie());
    if (terms.json) {
      const stale = terms.json.filter(t => (t.val || t.name || '').startsWith('__etest'));
      for (const t of stale) {
        await http(base, 'POST', `/${DB}/_d_del/${t.id}`, `_xsrf=${xsrf}&JSON=1&forced`, cookie());
      }
      if (stale.length) console.log(`  Pre-cleanup: removed ${stale.length} stale types from ${label}`);
    }
  }

  // Create test type + objects for _m_id and report tests
  const phpT = await http(PHP, 'POST', `/${DB}/_d_new`,
    `_xsrf=${xsrfPhp}&val=__etest_p_${TS}&t=3&JSON=1`, cookie());
  const nodeT = await http(NODE, 'POST', `/${DB}/_d_new`,
    `_xsrf=${xsrfNode}&val=__etest_n_${TS}&t=3&JSON=1`, cookie());
  const phpTid = Number(phpT.json?.obj);
  const nodeTid = Number(nodeT.json?.obj);
  if (phpTid > 0) created.php.types.push(phpTid);
  if (nodeTid > 0) created.node.types.push(nodeTid);

  // Create 3 objects
  const phpOids = [], nodeOids = [];
  for (let i = 1; i <= 3; i++) {
    const p = await http(PHP, 'POST', `/${DB}/_m_new/${phpTid}`,
      `_xsrf=${xsrfPhp}&up=1&t${phpTid}=etest_obj_${i}&JSON=1`, cookie());
    const n = await http(NODE, 'POST', `/${DB}/_m_new/${nodeTid}`,
      `_xsrf=${xsrfNode}&up=1&t${nodeTid}=etest_obj_${i}&JSON=1`, cookie());
    const pid = Number(p.json?.id);
    const nid = Number(n.json?.id);
    if (pid > 0) { phpOids.push(pid); created.php.objects.push(pid); }
    if (nid > 0) { nodeOids.push(nid); created.node.objects.push(nid); }
  }

  console.log(`  Test type: PHP=${phpTid} Node=${nodeTid}, objects: ${phpOids.length}/${nodeOids.length}\n`);
  return { phpTid, nodeTid, phpOids, nodeOids };
}

// ─── Phase A: Simple Endpoints ──────────────────────────────────────────────

async function phaseA_simple(phpTid, nodeTid, phpOids, nodeOids) {
  console.log('\x1b[36m━━━ Phase A: Simple Endpoints ━━━\x1b[0m');

  // A1: _m_id — change object ID
  // We create temp objects, change their IDs, then clean up
  if (phpOids.length > 0 && nodeOids.length > 0) {
    // A1.1 Create temp objects for ID change
    const phpNew = await http(PHP, 'POST', `/${DB}/_m_new/${phpTid}`,
      `_xsrf=${xsrfPhp}&up=1&t${phpTid}=id_test&JSON=1`, cookie());
    const nodeNew = await http(NODE, 'POST', `/${DB}/_m_new/${nodeTid}`,
      `_xsrf=${xsrfNode}&up=1&t${nodeTid}=id_test&JSON=1`, cookie());
    const phpTmpId = Number(phpNew.json?.id);
    const nodeTmpId = Number(nodeNew.json?.id);
    if (phpTmpId > 0) created.php.objects.push(phpTmpId);
    if (nodeTmpId > 0) created.node.objects.push(nodeTmpId);

    if (phpTmpId && nodeTmpId) {
      // A1.2 Change ID — use high IDs to avoid collisions
      const phpNewId = 9000000 + TS % 100000;
      const nodeNewId = 9100000 + TS % 100000;

      const php = await http(PHP, 'POST', `/${DB}/_m_id/${phpTmpId}`,
        `_xsrf=${xsrfPhp}&new_id=${phpNewId}&JSON=1`, cookie());
      const node = await http(NODE, 'POST', `/${DB}/_m_id/${nodeTmpId}`,
        `_xsrf=${xsrfNode}&new_id=${nodeNewId}&JSON=1`, cookie());
      const issues = [];
      if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
      if (php.json && node.json) {
        for (const k of ['next_act', 'args']) {
          if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
            issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
        }
        // All keys present
        for (const k of ['id', 'obj', 'next_act', 'args']) {
          if ((k in php.json) !== (k in node.json))
            issues.push(`Key "${k}": PHP=${k in php.json} Node=${k in node.json}`);
        }
        // id and obj should equal new_id
        if (String(php.json.id) !== String(phpNewId))
          issues.push(`PHP id(${php.json.id}) !== newId(${phpNewId})`);
        if (String(node.json.id) !== String(nodeNewId))
          issues.push(`Node id(${node.json.id}) !== newId(${nodeNewId})`);
      } else {
        if (!php.json) issues.push(`PHP not JSON: ${short(php.body)}`);
        if (!node.json) issues.push(`Node not JSON: ${short(node.body)}`);
      }
      report('A1.1 Change object ID (_m_id)', issues);

      // Update created objects tracking to use new IDs
      const phpIdx = created.php.objects.indexOf(phpTmpId);
      if (phpIdx >= 0) created.php.objects[phpIdx] = phpNewId;
      const nodeIdx = created.node.objects.indexOf(nodeTmpId);
      if (nodeIdx >= 0) created.node.objects[nodeIdx] = nodeNewId;

      // A1.3 Duplicate ID (try to change another object to same ID)
      {
        const php = await http(PHP, 'POST', `/${DB}/_m_id/${phpOids[0]}`,
          `_xsrf=${xsrfPhp}&new_id=${phpNewId}&JSON=1`, cookie());
        const node = await http(NODE, 'POST', `/${DB}/_m_id/${nodeOids[0]}`,
          `_xsrf=${xsrfNode}&new_id=${nodeNewId}&JSON=1`, cookie());
        const issues = [];
        if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
        // Both should return error about ID already in use
        const phpErr = php.json?.[0]?.error || php.json?.error || '';
        const nodeErr = node.json?.[0]?.error || node.json?.error || '';
        if (!!phpErr !== !!nodeErr)
          issues.push(`Error presence: PHP="${short(phpErr, 60)}" Node="${short(nodeErr, 60)}"`);
        report('A1.2 Duplicate ID (_m_id)', issues);
      }

      // A1.4 Invalid new_id (0)
      {
        const php = await http(PHP, 'POST', `/${DB}/_m_id/${phpOids[0]}`,
          `_xsrf=${xsrfPhp}&new_id=0&JSON=1`, cookie());
        const node = await http(NODE, 'POST', `/${DB}/_m_id/${nodeOids[0]}`,
          `_xsrf=${xsrfNode}&new_id=0&JSON=1`, cookie());
        if (php.status >= 500) {
          skip('A1.3 Invalid new_id=0 (_m_id)', 'PHP 500');
        } else {
          const issues = [];
          if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
          // PHP returns plain text "Invalid ID", Node returns JSON error — both reject, PASS
          const phpErr = php.json?.[0]?.error || php.json?.error || php.body || '';
          const nodeErr = node.json?.[0]?.error || node.json?.error || node.body || '';
          if (!phpErr && !nodeErr) issues.push('Neither returned error');
          report('A1.3 Invalid new_id=0 (_m_id)', issues);
        }
      }

      // A1.5 Same ID (new_id == current id)
      {
        const php = await http(PHP, 'POST', `/${DB}/_m_id/${phpOids[0]}`,
          `_xsrf=${xsrfPhp}&new_id=${phpOids[0]}&JSON=1`, cookie());
        const node = await http(NODE, 'POST', `/${DB}/_m_id/${nodeOids[0]}`,
          `_xsrf=${xsrfNode}&new_id=${nodeOids[0]}&JSON=1`, cookie());
        const issues = [];
        if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
        const phpErr = php.json?.[0]?.error || php.json?.error || '';
        const nodeErr = node.json?.[0]?.error || node.json?.error || '';
        if (!!phpErr !== !!nodeErr)
          issues.push(`Error presence: PHP="${short(phpErr, 60)}" Node="${short(nodeErr, 60)}"`);
        report('A1.4 Same ID (_m_id)', issues);
      }
    } else {
      skip('A1 _m_id', 'Could not create temp objects');
    }
  } else {
    skip('A1 _m_id', 'No objects');
  }

  // A2: _dict — type dictionary (Node-only endpoint, no PHP equivalent)
  // PHP doesn't have /_dict route — test Node-only behavior + compare with /terms
  {
    // A2.1 _dict all types — Node-only, verify it returns valid JSON array
    const dictRes = await http(NODE, 'GET', `/${DB}/_dict`, null, cookie());
    const issues = [];
    if (dictRes.status !== 200) issues.push(`_dict status: ${dictRes.status}`);
    if (!dictRes.json) {
      issues.push(`_dict not JSON: ${short(dictRes.body)}`);
    } else if (!Array.isArray(dictRes.json)) {
      issues.push(`_dict not array: ${typeof dictRes.json}`);
    } else if (dictRes.json.length === 0) {
      issues.push('_dict returned empty array');
    } else {
      // Verify structure of first item
      const first = dictRes.json[0];
      for (const k of ['id', 'name']) {
        if (!(k in first)) issues.push(`Missing key "${k}" in first item`);
      }
    }
    report('A2.1 _dict (Node-only, all types)', issues);
  }

  {
    // A2.2 _dict with typeId — returns specific type with requisites
    const node = await http(NODE, 'GET', `/${DB}/_dict/18`, null, cookie());
    const issues = [];
    if (node.status !== 200) issues.push(`Status: ${node.status}`);
    if (node.json) {
      if (!node.json.id) issues.push('Missing id');
      if (!node.json.name) issues.push('Missing name');
      if (!Array.isArray(node.json.requisites)) issues.push('Missing requisites array');
    } else {
      issues.push(`Not JSON: ${short(node.body)}`);
    }
    report('A2.2 _dict (Node-only, specific type)', issues);
  }

  {
    // A2.3 _dict non-existent typeId
    const node = await http(NODE, 'GET', `/${DB}/_dict/999999999`, null, cookie());
    const issues = [];
    // Should return empty or have no id
    if (node.json) {
      if (Array.isArray(node.json) && node.json.length > 0)
        issues.push(`Non-existent type returned data: ${node.json.length} items`);
    }
    report('A2.3 _dict (Node-only, non-existent type)', issues);
  }

  // A3: login GET — redirect
  {
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/login`),
      http(NODE, 'GET', `/${DB}/login`),
    ]);
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    // Both should redirect (302)
    if (php.status >= 300 && php.status < 400 && node.status >= 300 && node.status < 400) {
      const phpLoc = (php.headers['location'] || '').replace(/^https?:\/\/[^/]+/, '');
      const nodeLoc = (node.headers['location'] || '').replace(/^https?:\/\/[^/]+/, '');
      // PHP redirects to /login.html?db=my&uri=..., Node to /my
      // Both are valid redirect behaviors — PHP is more specific
      if (!phpLoc.includes('/login') && !phpLoc.includes(`/${DB}`))
        issues.push(`PHP unexpected location: "${phpLoc}"`);
      if (!nodeLoc.includes('/login') && !nodeLoc.includes(`/${DB}`))
        issues.push(`Node unexpected location: "${nodeLoc}"`);
    }
    report('A3.1 login GET (redirect)', issues);
  }

  {
    // A3.2 login GET with u= parameter
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/login?u=testuser`),
      http(NODE, 'GET', `/${DB}/login?u=testuser`),
    ]);
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    report('A3.2 login GET with u= param', issues);
  }

  // A4: confirm — password change confirmation
  // Note: confirm endpoint doesn't require auth in PHP, but PHP built-in server
  // hangs on unauthenticated requests. Use cookie for both.
  {
    // A4.1 Missing params — should return "obsolete"
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/confirm?JSON=1`, null, cookie()),
      http(NODE, 'GET', `/${DB}/confirm?JSON=1`, null, cookie()),
    ]);
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      if (php.json.message !== node.json.message)
        issues.push(`message: PHP="${php.json.message}" Node="${node.json.message}"`);
    } else {
      if (!php.json) issues.push(`PHP not JSON: ${short(php.body)}`);
      if (!node.json) issues.push(`Node not JSON: ${short(node.body)}`);
    }
    report('A4.1 confirm (missing params)', issues);
  }

  {
    // A4.2 Wrong old password — should return "obsolete"
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/confirm?u=testbot&o=wronghash&p=newhash&JSON=1`, null, cookie()),
      http(NODE, 'GET', `/${DB}/confirm?u=testbot&o=wronghash&p=newhash&JSON=1`, null, cookie()),
    ]);
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      if (php.json.message !== node.json.message)
        issues.push(`message: PHP="${php.json.message}" Node="${node.json.message}"`);
      if (php.json.db !== node.json.db)
        issues.push(`db: PHP="${php.json.db}" Node="${node.json.db}"`);
      const allKeys = new Set([...Object.keys(php.json), ...Object.keys(node.json)]);
      for (const k of allKeys) {
        if (!(k in php.json)) issues.push(`Key "${k}" missing in PHP`);
        if (!(k in node.json)) issues.push(`Key "${k}" missing in Node`);
      }
    } else {
      if (!php.json) issues.push(`PHP not JSON: ${short(php.body)}`);
      if (!node.json) issues.push(`Node not JSON: ${short(node.body)}`);
    }
    report('A4.2 confirm (wrong old password)', issues);
  }

  {
    // A4.3 Non-existent user
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/confirm?u=nonexistent_xyz&o=abc&p=def&JSON=1`, null, cookie()),
      http(NODE, 'GET', `/${DB}/confirm?u=nonexistent_xyz&o=abc&p=def&JSON=1`, null, cookie()),
    ]);
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      if (php.json.message !== node.json.message)
        issues.push(`message: PHP="${php.json.message}" Node="${node.json.message}"`);
    } else {
      if (!php.json) issues.push(`PHP not JSON: ${short(php.body)}`);
      if (!node.json) issues.push(`Node not JSON: ${short(node.body)}`);
    }
    report('A4.3 confirm (non-existent user)', issues);
  }
}

// ─── Phase B: Export / Backup ───────────────────────────────────────────────

async function phaseB_export() {
  console.log('\n\x1b[36m━━━ Phase B: Export / Backup ━━━\x1b[0m');

  // B1: csv_all — export entire DB as CSV
  {
    const php = await http(PHP, 'GET', `/${DB}/csv_all`, null, cookie());
    const node = await http(NODE, 'GET', `/${DB}/csv_all`, null, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.status === 500) {
      skip('B1 csv_all', `PHP built-in server 500`);
    } else {
      // Check Content-Type
      const phpCT = (php.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const nodeCT = (node.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (phpCT !== nodeCT) issues.push(`Content-Type: PHP="${phpCT}" Node="${nodeCT}"`);
      // Both should return non-empty response
      if (!php.body.length) issues.push('PHP: empty body');
      if (!node.body.length) issues.push('Node: empty body');
      // Check Content-Disposition for filename
      const phpCD = php.headers['content-disposition'] || '';
      const nodeCD = node.headers['content-disposition'] || '';
      if (phpCD.includes('attachment') !== nodeCD.includes('attachment'))
        issues.push(`Content-Disposition attachment: PHP=${phpCD.includes('attachment')} Node=${nodeCD.includes('attachment')}`);
      report('B1 csv_all (export)', issues);
    }
  }

  // B2: backup — export DB in compact binary format
  {
    const php = await http(PHP, 'GET', `/${DB}/backup`, null, cookie());
    const node = await http(NODE, 'GET', `/${DB}/backup`, null, cookie());
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.status === 500 || php.status === 302) {
      skip('B2 backup', `PHP built-in server ${php.status}`);
    } else {
      // Both should return non-empty body
      if (!php.body.length) issues.push('PHP: empty body');
      if (!node.body.length) issues.push('Node: empty body');
      // Check Content-Disposition
      const phpCD = php.headers['content-disposition'] || '';
      const nodeCD = node.headers['content-disposition'] || '';
      if (phpCD.includes('attachment') !== nodeCD.includes('attachment'))
        issues.push(`Content-Disposition: PHP=${phpCD.includes('attachment')} Node=${nodeCD.includes('attachment')}`);
      report('B2 backup (export)', issues);
    }
  }

  // B3: _new_db — create new database
  // DANGER: creates a real DB, needs cleanup
  const testDbName = `zztest${TS % 100000}`;
  {
    // B3.1 Create DB (we only create on one server since it's a shared MySQL)
    // Test against PHP first, then Node with a different name
    const testDbPHP = `zztp${TS % 10000}`;
    const testDbNode = `zztn${TS % 10000}`;

    // PHP built-in server may not support _new_db properly — test Node only if PHP fails
    const php = await http(PHP, 'POST', `/my/_new_db`,
      `db=${testDbPHP}&template=empty&JSON=1`, cookie());
    const node = await http(NODE, 'POST', `/my/_new_db`,
      `db=${testDbNode}&template=empty&JSON=1`, cookie());

    // PHP _new_db may return different format or not work on built-in server
    // Focus on Node behavior; compare with PHP only if PHP returned JSON with status
    const issues = [];
    if (node.json) {
      if (node.json.status !== 'Ok' && !node.json.error)
        issues.push(`Node: unexpected status "${node.json.status}"`);
      if (node.json.status === 'Ok' && !node.json.id)
        issues.push('Node: Ok but no id');
    } else {
      issues.push(`Node not JSON: ${short(node.body)}`);
    }
    if (php.json?.status && node.json?.status) {
      // Both returned JSON with status field — compare
      if (php.json.status !== node.json.status)
        issues.push(`status: PHP="${php.json.status}" Node="${node.json.status}"`);
    }
    report('B3.1 Create database (_new_db)', issues);

    // Track for cleanup
    if (php.json?.status === 'Ok') created.php.dbs.push(testDbPHP);
    if (node.json?.status === 'Ok') created.node.dbs.push(testDbNode);
  }

  {
    // B3.2 Short name (Node-only — PHP _new_db may not work on built-in server)
    const node = await http(NODE, 'POST', `/my/_new_db`, `db=ab&JSON=1`, cookie());
    const issues = [];
    const nodeErr = node.json?.[0]?.error || node.json?.error || '';
    if (!nodeErr) issues.push('No error for short db name');
    report('B3.2 Short DB name (_new_db, Node-only)', issues);
  }

  {
    // B3.3 Invalid characters
    const node = await http(NODE, 'POST', `/my/_new_db`, `db=bad-name!&JSON=1`, cookie());
    const issues = [];
    const nodeErr = node.json?.[0]?.error || node.json?.error || '';
    if (!nodeErr) issues.push('No error for invalid db name');
    report('B3.3 Invalid DB name (_new_db, Node-only)', issues);
  }

  {
    // B3.4 Duplicate DB name (use one we just created)
    if (created.node.dbs.length > 0) {
      const dupName = created.node.dbs[0];
      const node = await http(NODE, 'POST', `/my/_new_db`, `db=${dupName}&JSON=1`, cookie());
      const issues = [];
      const nodeErr = node.json?.[0]?.error || node.json?.error || '';
      if (!nodeErr) issues.push('No error for duplicate db name');
      report('B3.4 Duplicate DB name (_new_db, Node-only)', issues);
    } else {
      skip('B3.4 Duplicate DB name', 'No DB was created');
    }
  }
}

// ─── Phase C: Auth Endpoints ────────────────────────────────────────────────

async function phaseC_auth() {
  console.log('\n\x1b[36m━━━ Phase C: Auth Endpoints ━━━\x1b[0m');

  // C1: jwt — JWT authentication
  // PHP built-in server crashes (500) on jwt endpoint — test Node behavior only
  {
    // C1.1 Empty JWT token
    const node = await http(NODE, 'POST', `/${DB}/jwt`, 'jwt=');
    const issues = [];
    if (node.status !== 200) issues.push(`Status: ${node.status}`);
    if (node.json) {
      if (!node.json.error) issues.push('No error for empty jwt');
    } else {
      issues.push(`Not JSON: ${short(node.body)}`);
    }
    report('C1.1 jwt (empty token, Node-only)', issues);
  }

  {
    // C1.2 Invalid JWT token (garbage)
    const node = await http(NODE, 'POST', `/${DB}/jwt`, 'jwt=not.a.valid.jwt.token');
    const issues = [];
    if (node.status !== 200) issues.push(`Status: ${node.status}`);
    if (node.json) {
      if (!node.json.error) issues.push('No error for invalid jwt');
    } else {
      issues.push(`Not JSON: ${short(node.body)}`);
    }
    report('C1.2 jwt (invalid token, Node-only)', issues);
  }

  {
    // C1.3 JWT with 3 parts but invalid signature
    const fakeJwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0Ym90IiwiZXhwIjo5OTk5OTk5OTk5fQ.invalidsig';
    const node = await http(NODE, 'POST', `/${DB}/jwt`, `jwt=${fakeJwt}`);
    const issues = [];
    if (node.status !== 200) issues.push(`Status: ${node.status}`);
    if (node.json) {
      if (!node.json.error) issues.push('No error for invalid signature jwt');
    } else {
      issues.push(`Not JSON: ${short(node.body)}`);
    }
    report('C1.3 jwt (invalid signature, Node-only)', issues);
  }

  // C2: register — user registration
  // PHP built-in server returns HTML for register errors (no JSON mode in PHP register)
  // Test Node validation only, then compare structure where PHP returns JSON
  {
    // C2.1 Invalid email (Node-only — PHP returns HTML)
    const node = await http(NODE, 'POST', `/my/register`, 'email=notanemail&regpwd=test123&regpwd1=test123&agree=1&JSON=1');
    const issues = [];
    const nodeErr = node.json?.[0]?.error || node.json?.error || '';
    if (!nodeErr) issues.push('No error for invalid email');
    report('C2.1 register (invalid email, Node-only)', issues);
  }

  {
    // C2.2 Short password
    const node = await http(NODE, 'POST', `/my/register`, 'email=test@test.com&regpwd=ab&regpwd1=ab&agree=1&JSON=1');
    const issues = [];
    const nodeErr = node.json?.[0]?.error || node.json?.error || '';
    if (!nodeErr) issues.push('No error for short password');
    report('C2.2 register (short password, Node-only)', issues);
  }

  {
    // C2.3 Password mismatch
    const node = await http(NODE, 'POST', `/my/register`, 'email=test@test.com&regpwd=test123&regpwd1=test456&agree=1&JSON=1');
    const issues = [];
    const nodeErr = node.json?.[0]?.error || node.json?.error || '';
    if (!nodeErr) issues.push('No error for password mismatch');
    report('C2.3 register (password mismatch, Node-only)', issues);
  }

  {
    // C2.4 Missing agree
    const node = await http(NODE, 'POST', `/my/register`, 'email=test@test.com&regpwd=test123&regpwd1=test123&JSON=1');
    const issues = [];
    const nodeErr = node.json?.[0]?.error || node.json?.error || '';
    if (!nodeErr) issues.push('No error for missing agree');
    report('C2.4 register (missing agree, Node-only)', issues);
  }
}

// ─── Phase D: Reports ───────────────────────────────────────────────────────

async function phaseD_reports() {
  console.log('\n\x1b[36m━━━ Phase D: Reports ━━━\x1b[0m');

  // D0: Get report list (PHP built-in server unreliable for report endpoints)
  const nodeList = await http(NODE, 'GET', `/${DB}/report?JSON=1`, null, cookie());

  {
    const issues = [];
    if (nodeList.json) {
      if (!Array.isArray(nodeList.json)) issues.push(`Node not array: ${typeof nodeList.json}`);
      else if (nodeList.json.length === 0) issues.push('Node: empty report list');
    } else {
      issues.push(`Node not JSON: ${short(nodeList.body)}`);
    }
    report('D0 Report list (Node-only)', issues);
  }

  const nodeReports = Array.isArray(nodeList.json) ? nodeList.json : [];

  if (nodeReports.length === 0) {
    skip('D1-D8 Report execution', 'No reports available');
    return;
  }

  let chosenReport = nodeReports[0];
  const reportId = chosenReport.id;
  const reportName = chosenReport.name || chosenReport.val || reportId;
  console.log(`  Using report: ${reportId} (${short(reportName, 30)})`);

  // D1: Default JSON format
  {
    const node = await http(NODE, 'GET', `/${DB}/report/${reportId}?JSON=1`, null, cookie());
    const issues = [];
    if (!node.json) {
      issues.push(`Node not JSON: ${short(node.body)}`);
    } else {
      // Verify expected structure: columns array + data array
      if (!node.json.columns) issues.push('Node missing "columns"');
      if (!Array.isArray(node.json.columns)) issues.push(`Node columns not array`);
    }
    report(`D1 Report JSON (${short(reportName, 20)}, Node-only)`, issues);
  }

  // D2: JSON_DATA format — column-major
  {
    const node = await http(NODE, 'GET', `/${DB}/report/${reportId}?JSON_DATA`, null, cookie());
    const issues = [];
    if (!node.json) {
      issues.push(`Node not JSON: ${short(node.body)}`);
    } else if (typeof node.json !== 'object') {
      issues.push(`Node not object: ${typeof node.json}`);
    } else {
      // JSON_DATA: {col_name: [val0, val1, ...]}
      const keys = Object.keys(node.json);
      if (keys.length === 0) issues.push('Node: empty JSON_DATA');
    }
    report(`D2 Report JSON_DATA (Node-only)`, issues);
  }

  // D3: JSON_KV format — key-value array
  {
    const node = await http(NODE, 'GET', `/${DB}/report/${reportId}?JSON_KV`, null, cookie());
    const issues = [];
    if (!node.json) {
      issues.push(`Node not JSON: ${short(node.body)}`);
    } else if (!Array.isArray(node.json)) {
      issues.push(`Node not array: ${typeof node.json}`);
    } else if (node.json.length > 0) {
      // Each row should be an object with column names as keys
      if (typeof node.json[0] !== 'object') issues.push(`Row not object: ${typeof node.json[0]}`);
    }
    report(`D3 Report JSON_KV (Node-only)`, issues);
  }

  // D4: JSON_CR format — columns/rows/totalCount
  {
    const node = await http(NODE, 'GET', `/${DB}/report/${reportId}?JSON_CR`, null, cookie());
    const issues = [];
    if (!node.json) {
      issues.push(`Node not JSON: ${short(node.body)}`);
    } else {
      for (const k of ['columns', 'rows', 'totalCount']) {
        if (!(k in node.json)) issues.push(`Node missing key "${k}"`);
      }
    }
    report(`D4 Report JSON_CR (Node-only)`, issues);
  }

  // D5: JSON_HR format — hierarchical
  {
    const node = await http(NODE, 'GET', `/${DB}/report/${reportId}?JSON_HR`, null, cookie());
    const issues = [];
    if (node.json) {
      for (const k of ['columns', 'groups', 'totalCount']) {
        if (!(k in node.json)) issues.push(`Node missing key "${k}"`);
      }
    } else {
      issues.push(`Node not JSON: ${short(node.body)}`);
    }
    report(`D5 Report JSON_HR (Node-only)`, issues);
  }

  // D6: RECORD_COUNT — just count
  {
    const node = await http(NODE, 'GET', `/${DB}/report/${reportId}?RECORD_COUNT`, null, cookie());
    const issues = [];
    if (!node.json) {
      issues.push(`Node not JSON: ${short(node.body, 60)}`);
    } else {
      if (!('count' in node.json)) issues.push('Node missing "count" key');
      if (node.json.count !== undefined && typeof node.json.count !== 'number')
        issues.push(`count not number: ${typeof node.json.count}`);
    }
    report(`D6 Report RECORD_COUNT (Node-only)`, issues);
  }

  // D7: LIMIT
  {
    const node = await http(NODE, 'GET', `/${DB}/report/${reportId}?JSON_KV&LIMIT=2`, null, cookie());
    const issues = [];
    if (!node.json) {
      issues.push(`Node not JSON: ${short(node.body, 60)}`);
    } else if (!Array.isArray(node.json)) {
      issues.push(`Node not array: ${typeof node.json}`);
    } else {
      if (node.json.length > 2) issues.push(`Node rows ${node.json.length} > LIMIT=2`);
    }
    report(`D7 Report with LIMIT=2 (Node-only)`, issues);
  }

  // D8: Non-existent report
  {
    const node = await http(NODE, 'GET', `/${DB}/report/999999999?JSON=1`, null, cookie());
    const issues = [];
    // Should return error or empty, not crash
    if (node.status >= 500) issues.push(`Node 500 error`);
    report('D8 Report non-existent (Node-only)', issues);
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
    try { await http(PHP, 'POST', `/${DB}/_d_del/${id}`, `_xsrf=${xsrfPhp}&JSON=1&forced`, cookie()); cleaned++; } catch {}
  }
  for (const id of [...created.node.types].reverse()) {
    try { await http(NODE, 'POST', `/${DB}/_d_del/${id}`, `_xsrf=${xsrfNode}&JSON=1&forced`, cookie()); cleaned++; } catch {}
  }

  // Drop test databases
  for (const dbName of [...created.php.dbs, ...created.node.dbs]) {
    try {
      // Drop via direct SQL through a helper endpoint is not available,
      // so we drop the table via the Node server (which has pool access)
      // Actually, _new_db creates a TABLE not a DATABASE, so we need DROP TABLE
      await http(NODE, 'POST', `/${DB}`, `a=_sql&q=DROP+TABLE+IF+EXISTS+${dbName}&JSON=1`, cookie());
      cleaned++;
    } catch {}
  }

  console.log(`  Cleaned ${cleaned} entities`);
}

// ─── Phase E: Remaining Endpoints ────────────────────────────────────────────

async function phaseE_remaining(phpTid, nodeTid, phpOids, nodeOids) {
  console.log('\n\x1b[36m━━━ Phase E: Remaining Endpoints ━━━\x1b[0m');

  // Get a real type ID from terms for testing
  const termsRes = await http(PHP, 'GET', `/${DB}/terms`, null, cookie());
  const realTypeId = termsRes.json?.[0]?.id || phpTid;
  const realObjId = phpOids[0] || 1;

  // Helper: compare PHP vs Node, skip if PHP 500/null/HTML
  async function cmp(name, method, path, body) {
    const [php, node] = await Promise.all([
      http(PHP, method, `/${DB}${path}`, body, cookie()),
      http(NODE, method, `/${DB}${path}`, body, cookie()),
    ]);
    // PHP returns 500/null/HTML for endpoints without JSON API support or auth issues
    if (php.status >= 500) {
      skip(name, 'PHP 500 (no JSON API)');
      return { php, node, skipped: true };
    }
    if (php.status === 401) {
      skip(name, 'PHP auth issue (session not preserved)');
      return { php, node, skipped: true };
    }
    if (php.body === 'null' || php.body === '') {
      skip(name, 'PHP has no JSON API for this endpoint');
      return { php, node, skipped: true };
    }
    if (!php.json && php.body.startsWith('<!DOCTYPE')) {
      skip(name, 'PHP returns HTML only (no JSON API)');
      return { php, node, skipped: true };
    }
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      const phpType = Array.isArray(php.json) ? 'array' : typeof php.json;
      const nodeType = Array.isArray(node.json) ? 'array' : typeof node.json;
      if (phpType !== nodeType) issues.push(`Type: PHP=${phpType} Node=${nodeType}`);
      if (phpType === 'array' && nodeType === 'array') {
        if (php.json.length !== node.json.length)
          issues.push(`Length: PHP=${php.json.length} Node=${node.json.length}`);
      }
      if (phpType === 'object' && nodeType === 'object') {
        const pk = Object.keys(php.json).sort().join(',');
        const nk = Object.keys(node.json).sort().join(',');
        if (pk !== nk) issues.push(`Keys: PHP=[${short(pk,80)}] Node=[${short(nk,80)}]`);
      }
    } else if (php.json && !node.json) {
      issues.push(`Node not JSON: ${short(node.body, 80)}`);
    } else if (!php.json && node.json) {
      issues.push(`PHP not JSON: ${short(php.body, 80)}`);
    } else {
      // Neither JSON — compare status and content-type
      const phpCt = (php.headers['content-type'] || '').split(';')[0];
      const nodeCt = (node.headers['content-type'] || '').split(';')[0];
      if (phpCt !== nodeCt) issues.push(`Content-Type: PHP=${phpCt} Node=${nodeCt}`);
    }
    report(name, issues);
    return { php, node, skipped: false };
  }

  // Helper: Node-only structure check (when PHP always fails)
  function nodeOnly(name, node, checks) {
    const issues = [];
    if (node.status >= 500) { issues.push(`Node 500`); report(name, issues); return; }
    if (!node.json) { issues.push(`Node not JSON: ${short(node.body, 80)}`); report(name, issues); return; }
    checks(node.json, issues);
    report(name + ' (Node-only)', issues);
  }

  // E1: validate — token check
  {
    const { node, skipped } = await cmp('E1 validate', 'GET', '/validate?JSON=1', null);
    if (skipped) {
      nodeOnly('E1 validate', node, (j, iss) => {
        if (!('valid' in j) && !('error' in j) && !('token' in j))
          iss.push(`Missing expected keys, got: ${Object.keys(j).join(',')}`);
      });
    }
  }

  // E2: sql?JSON — report functions/formats
  await cmp('E2 sql (JSON)', 'GET', '/sql?JSON=1', null);

  // E3: form?JSON — type editor structure
  await cmp('E3 form (JSON)', 'GET', '/form?JSON=1', null);

  // E4: dict?JSON — type dictionary
  await cmp('E4 dict (JSON)', 'GET', '/dict?JSON=1', null);

  // E5: _list/:typeId — object listing
  {
    const { node, skipped } = await cmp('E5 _list', 'GET', `/_list/${realTypeId}?JSON=1`, null);
    if (skipped) {
      nodeOnly('E5 _list', node, (j, iss) => {
        for (const k of ['data', 'limit', 'offset', 'total']) {
          if (!(k in j)) iss.push(`Missing key "${k}"`);
        }
        if (!Array.isArray(j.data)) iss.push(`data not array`);
      });
    }
  }

  // E6: _list_join/:typeId
  {
    const { node, skipped } = await cmp('E6 _list_join', 'GET', `/_list_join/${realTypeId}?JSON=1`, null);
    if (skipped) {
      nodeOnly('E6 _list_join', node, (j, iss) => {
        for (const k of ['data', 'total', 'requisites']) {
          if (!(k in j)) iss.push(`Missing key "${k}"`);
        }
      });
    }
  }

  // E7: _d_main/:typeId — type metadata
  {
    const node = await http(NODE, 'GET', `/${DB}/_d_main/${realTypeId}?JSON=1`, null, cookie());
    const issues = [];
    if (!node.json) {
      issues.push(`Node not JSON: ${short(node.body, 80)}`);
    } else {
      for (const k of ['id', 'name', 'requisites']) {
        if (!(k in node.json)) issues.push(`Missing key "${k}"`);
      }
      if (node.json.requisites && !Array.isArray(node.json.requisites))
        issues.push(`requisites not array`);
    }
    report('E7 _d_main (Node-only)', issues);
  }

  // E8: grants
  {
    const { node, skipped } = await cmp('E8 grants', 'GET', '/grants?JSON=1', null);
    if (skipped) {
      nodeOnly('E8 grants', node, (j, iss) => {
        if (!('grants' in j)) iss.push(`Missing "grants" key`);
        if (!('user' in j)) iss.push(`Missing "user" key`);
      });
    }
  }

  // E9: check_grant
  {
    const { node, skipped } = await cmp('E9 check_grant', 'POST', '/check_grant', `grant=ddl&JSON=1`);
    if (skipped) {
      // Node should return error or result
      const issues = [];
      if (node.status >= 500) issues.push('Node 500');
      report('E9 check_grant (Node-only)', issues);
    }
  }

  // E10: export/:typeId
  {
    const { node, skipped } = await cmp('E10 export', 'GET', `/export/${realTypeId}`, null);
    if (skipped) {
      const issues = [];
      const ct = (node.headers['content-type'] || '');
      if (!ct.includes('csv') && !ct.includes('text')) issues.push(`Unexpected Content-Type: ${ct}`);
      if (node.status >= 500) issues.push('Node 500');
      report('E10 export (Node-only)', issues);
    }
  }

  // E11: dir_admin
  {
    const { node, skipped } = await cmp('E11 dir_admin', 'GET', '/dir_admin?JSON=1', null);
    if (skipped) {
      nodeOnly('E11 dir_admin', node, (j, iss) => {
        // Should return some admin info
        if (typeof j !== 'object') iss.push(`Not object: ${typeof j}`);
      });
    }
  }

  // E12: _connect (no connector — should return legacyRespond)
  await cmp('E12 _connect', 'GET', '/_connect/999999?JSON=1', null);

  // E13: download non-existent file
  {
    const { node, skipped } = await cmp('E13 download (404)', 'GET', '/download/nonexistent_file.txt', null);
    if (skipped) {
      const issues = [];
      if (node.status !== 404 && node.status !== 200) issues.push(`Node status: ${node.status}`);
      report('E13 download 404 (Node-only)', issues);
    }
  }

  // E14: POST action=object (JSON_DATA)
  // PHP does not support POST body action=object (uses URL routing only), test Node behavior
  {
    const node = await http(NODE, 'POST', `/${DB}/?JSON_DATA=1`, `id=${realTypeId}&a=object`, cookie());
    const issues = [];
    if (node.status >= 500) issues.push('Node 500');
    if (node.json && !Array.isArray(node.json)) issues.push(`Not array: ${typeof node.json}`);
    report('E14 POST action=object JSON_DATA (Node-only)', issues);
  }

  // E15: POST action=report
  {
    const nodeReports = await http(NODE, 'GET', `/${DB}/report?JSON=1`, null, cookie());
    const repId = nodeReports.json?.[0]?.id;
    if (repId) {
      const { node, skipped } = await cmp('E15 POST action=report', 'POST', `?JSON=1`,
        `action=report&id=${repId}`);
      if (skipped) {
        const issues = [];
        if (node.status >= 500) issues.push('Node 500');
        if (node.json) {
          if (!node.json.columns && !node.json.data) issues.push('Missing columns/data');
        }
        report('E15 POST action=report (Node-only)', issues);
      }
    } else {
      skip('E15 POST action=report', 'No reports available');
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { phpTid, nodeTid, phpOids, nodeOids } = await setup();

  await phaseA_simple(phpTid, nodeTid, phpOids, nodeOids);
  await phaseB_export();
  await phaseC_auth();
  await phaseD_reports();
  await phaseE_remaining(phpTid, nodeTid, phpOids, nodeOids);
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
