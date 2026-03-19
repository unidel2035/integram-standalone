#!/usr/bin/env node
/**
 * Full PHP ↔ Node.js Endpoint Parity Audit
 *
 * Sends identical requests to both servers, compares responses,
 * prints detailed report per endpoint.
 *
 * Usage: node full-parity-audit.js
 */

const PHP  = 'http://127.0.0.1:8082';
const NODE = 'http://127.0.0.1:8081';
const DB   = 'my';
const USER = 'testbot';
const PASS = 'test123';

let token = '';
let xsrfPhp = '';
let xsrfNode = '';
let passCount = 0, failCount = 0, skipCount = 0;
const reports = [];

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
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}

    const hdrs = {};
    for (const [k, v] of res.headers.entries()) hdrs[k.toLowerCase()] = v;

    return {
      status: res.status,
      body: text,
      json,
      headers: hdrs,
    };
  } catch (err) {
    return { status: 0, body: '', json: null, headers: {}, error: err.message };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hdr(res, name) {
  return (res.headers[name.toLowerCase()] || '').trim();
}

function shortBody(res, maxLen = 120) {
  const b = res.body || '';
  return b.length > maxLen ? b.slice(0, maxLen) + '...' : b;
}

function deepSortedJson(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepSortedJson);
  const sorted = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = deepSortedJson(obj[k]);
  }
  return sorted;
}

function jsonEq(a, b) {
  return JSON.stringify(deepSortedJson(a)) === JSON.stringify(deepSortedJson(b));
}

// ─── Report builder ─────────────────────────────────────────────────────────

function report(name, issues) {
  const status = issues.length === 0 ? 'PASS' : 'FAIL';
  if (status === 'PASS') passCount++;
  else failCount++;

  const icon = status === 'PASS' ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`\n${icon} \x1b[1m${name}\x1b[0m`);
  if (issues.length > 0) {
    for (const i of issues) console.log(`  → ${i}`);
  }
  reports.push({ name, status, issues });
}

function skip(name, reason) {
  skipCount++;
  console.log(`\n\x1b[33m⊘\x1b[0m \x1b[1m${name}\x1b[0m — ${reason}`);
  reports.push({ name, status: 'SKIP', issues: [reason] });
}

// ─── Endpoint audit functions ───────────────────────────────────────────────

async function auditAuth() {
  console.log('\n\x1b[36m━━━ 1. POST /:db/auth ━━━\x1b[0m');
  const cookie = `${DB}=${token}`;

  // 1a. Successful auth (already done to get token, verify redirect)
  {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/auth`, `login=${USER}&pwd=${PASS}`),
      http(NODE, 'POST', `/${DB}/auth`, `login=${USER}&pwd=${PASS}`),
    ]);
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    // Both should 302 redirect
    const phpLoc = hdr(php, 'Location');
    const nodeLoc = hdr(node, 'Location');
    if (phpLoc !== nodeLoc) issues.push(`Location: PHP="${phpLoc}" Node="${nodeLoc}"`);
    // Both should set cookie
    const phpCookie = hdr(php, 'Set-Cookie');
    const nodeCookie = hdr(node, 'Set-Cookie');
    if (!phpCookie) issues.push('PHP: no Set-Cookie');
    if (!nodeCookie) issues.push('Node: no Set-Cookie');
    report('auth — valid login (redirect)', issues);
  }

  // 1b. Successful auth with JSON param
  {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/auth`, `login=${USER}&pwd=${PASS}&JSON=1`),
      http(NODE, 'POST', `/${DB}/auth`, `login=${USER}&pwd=${PASS}&JSON=1`),
    ]);
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    // Both should return 200 with JSON
    if (php.json && node.json) {
      for (const key of ['_xsrf', 'token', 'id']) {
        if ((key in php.json) !== (key in node.json)) {
          issues.push(`Key "${key}": PHP=${key in php.json} Node=${key in node.json}`);
        }
      }
    } else {
      if (!php.json) issues.push(`PHP: not JSON: ${shortBody(php)}`);
      if (!node.json) issues.push(`Node: not JSON: ${shortBody(node)}`);
    }
    const phpCD = hdr(php, 'Content-Disposition');
    const nodeCD = hdr(node, 'Content-Disposition');
    if (phpCD !== nodeCD) issues.push(`Content-Disposition: PHP="${phpCD}" Node="${nodeCD}"`);
    report('auth — valid login (JSON)', issues);
  }

  // 1c. Wrong password (no JSON)
  {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/auth`, `login=${USER}&pwd=wrongpass`),
      http(NODE, 'POST', `/${DB}/auth`, `login=${USER}&pwd=wrongpass`),
    ]);
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    const phpLoc = hdr(php, 'Location');
    const nodeLoc = hdr(node, 'Location');
    if (phpLoc !== nodeLoc) issues.push(`Location: PHP="${phpLoc}" Node="${nodeLoc}"`);
    report('auth — wrong password (redirect)', issues);
  }

  // 1d. Wrong password with JSON
  {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/auth`, `login=${USER}&pwd=wrongpass&JSON=1`),
      http(NODE, 'POST', `/${DB}/auth`, `login=${USER}&pwd=wrongpass&JSON=1`),
    ]);
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      if (!jsonEq(php.json, node.json)) {
        issues.push(`Body: PHP=${shortBody(php)} Node=${shortBody(node)}`);
      }
    }
    report('auth — wrong password (JSON)', issues);
  }

  // 1e. Missing fields
  {
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${DB}/auth`, ''),
      http(NODE, 'POST', `/${DB}/auth`, ''),
    ]);
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    report('auth — missing fields', issues);
  }
}

async function auditXsrf() {
  console.log('\n\x1b[36m━━━ 2. GET /:db/xsrf ━━━\x1b[0m');
  const cookie = `${DB}=${token}`;

  const [php, node] = await Promise.all([
    http(PHP, 'GET', `/${DB}/xsrf`, null, cookie),
    http(NODE, 'GET', `/${DB}/xsrf`, null, cookie),
  ]);

  const issues = [];
  if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
  if (php.json && node.json) {
    const phpKeys = Object.keys(php.json).sort().join(',');
    const nodeKeys = Object.keys(node.json).sort().join(',');
    if (phpKeys !== nodeKeys) issues.push(`Keys: PHP=[${phpKeys}] Node=[${nodeKeys}]`);
    // Values _xsrf should match (same DB state)
    if (php.json._xsrf !== node.json._xsrf) issues.push(`_xsrf values differ`);
    if (php.json.role !== node.json.role) issues.push(`role: PHP="${php.json.role}" Node="${node.json.role}"`);
    if (php.json.user !== node.json.user) issues.push(`user: PHP="${php.json.user}" Node="${node.json.user}"`);
  }
  const phpCD = hdr(php, 'Content-Disposition');
  const nodeCD = hdr(node, 'Content-Disposition');
  if (phpCD !== nodeCD) issues.push(`Content-Disposition: PHP="${phpCD}" Node="${nodeCD}"`);

  xsrfPhp = php.json?._xsrf || '';
  xsrfNode = node.json?._xsrf || '';

  report('xsrf — session info', issues);
}

async function auditGetcode() {
  console.log('\n\x1b[36m━━━ 3. POST /:db/getcode ━━━\x1b[0m');

  // getcode with non-existent user
  const [php, node] = await Promise.all([
    http(PHP, 'POST', `/${DB}/getcode`, 'login=nonexistent_user_xyz'),
    http(NODE, 'POST', `/${DB}/getcode`, 'login=nonexistent_user_xyz'),
  ]);

  const issues = [];
  if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
  // PHP returns redirect to login page, Node may return JSON
  const phpLoc = hdr(php, 'Location');
  const nodeLoc = hdr(node, 'Location');
  if (php.status >= 300 || node.status >= 300) {
    if (phpLoc !== nodeLoc) issues.push(`Location: PHP="${phpLoc}" Node="${nodeLoc}"`);
  }
  const phpCT = hdr(php, 'Content-Type').split(';')[0].trim().toLowerCase();
  const nodeCT = hdr(node, 'Content-Type').split(';')[0].trim().toLowerCase();
  if (phpCT !== nodeCT) issues.push(`Content-Type: PHP="${phpCT}" Node="${nodeCT}"`);
  const phpCD = hdr(php, 'Content-Disposition');
  const nodeCD = hdr(node, 'Content-Disposition');
  if (phpCD !== nodeCD) issues.push(`Content-Disposition: PHP="${phpCD}" Node="${nodeCD}"`);

  report('getcode — non-existent user', issues);
}

async function auditCheckcode() {
  console.log('\n\x1b[36m━━━ 4. POST /:db/checkcode ━━━\x1b[0m');

  const [php, node] = await Promise.all([
    http(PHP, 'POST', `/${DB}/checkcode`, 'login=testbot&code=000000'),
    http(NODE, 'POST', `/${DB}/checkcode`, 'login=testbot&code=000000'),
  ]);

  const issues = [];
  if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
  const phpCT = hdr(php, 'Content-Type').split(';')[0].trim().toLowerCase();
  const nodeCT = hdr(node, 'Content-Type').split(';')[0].trim().toLowerCase();
  if (phpCT !== nodeCT) issues.push(`Content-Type: PHP="${phpCT}" Node="${nodeCT}"`);

  report('checkcode — wrong code', issues);
}

async function auditTerms() {
  console.log('\n\x1b[36m━━━ 5. GET /:db/terms ━━━\x1b[0m');
  const cookie = `${DB}=${token}`;

  const [php, node] = await Promise.all([
    http(PHP, 'GET', `/${DB}/terms`, null, cookie),
    http(NODE, 'GET', `/${DB}/terms`, null, cookie),
  ]);

  const issues = [];
  if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
  if (php.json && node.json) {
    if (!Array.isArray(php.json) || !Array.isArray(node.json)) {
      issues.push(`Not arrays: PHP=${Array.isArray(php.json)} Node=${Array.isArray(node.json)}`);
    } else {
      if (php.json.length !== node.json.length) issues.push(`Count: PHP=${php.json.length} Node=${node.json.length}`);
      // Compare each term {id, type, name}
      const phpById = Object.fromEntries(php.json.map(t => [t.id, t]));
      const nodeById = Object.fromEntries(node.json.map(t => [t.id, t]));
      const missingInNode = php.json.filter(t => !(t.id in nodeById));
      const missingInPhp = node.json.filter(t => !(t.id in phpById));
      if (missingInNode.length) issues.push(`Missing in Node: ${missingInNode.map(t => `${t.id}(${t.name})`).join(', ')}`);
      if (missingInPhp.length) issues.push(`Missing in PHP: ${missingInPhp.map(t => `${t.id}(${t.name})`).join(', ')}`);
      // Compare matching terms
      let termDiffs = 0;
      for (const pt of php.json) {
        const nt = nodeById[pt.id];
        if (!nt) continue;
        if (pt.type !== nt.type) { issues.push(`Term ${pt.id}: type PHP=${pt.type} Node=${nt.type}`); termDiffs++; }
        if (pt.name !== nt.name) { issues.push(`Term ${pt.id}: name PHP="${pt.name}" Node="${nt.name}"`); termDiffs++; }
        if (termDiffs > 5) { issues.push('... (more diffs)'); break; }
      }
    }
  }
  // Headers
  for (const h of ['Content-Disposition', 'Content-Type', 'Cache-Control', 'Access-Control-Allow-Origin']) {
    const pv = hdr(php, h), nv = hdr(node, h);
    if (pv.toLowerCase() !== nv.toLowerCase()) issues.push(`${h}: PHP="${pv}" Node="${nv}"`);
  }
  // Expires: allow +0000 vs GMT difference
  const phpExp = hdr(php, 'Expires');
  const nodeExp = hdr(node, 'Expires');
  if (phpExp && nodeExp && phpExp.replace('+0000', 'GMT') !== nodeExp.replace('+0000', 'GMT')) {
    issues.push(`Expires: PHP="${phpExp}" Node="${nodeExp}"`);
  }

  report('terms — type list', issues);
}

async function auditMetadata() {
  console.log('\n\x1b[36m━━━ 6. GET /:db/metadata ━━━\x1b[0m');
  const cookie = `${DB}=${token}`;

  const [php, node] = await Promise.all([
    http(PHP, 'GET', `/${DB}/metadata`, null, cookie),
    http(NODE, 'GET', `/${DB}/metadata`, null, cookie),
  ]);

  const issues = [];
  if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
  if (php.json && node.json && Array.isArray(php.json) && Array.isArray(node.json)) {
    if (php.json.length !== node.json.length) issues.push(`Type count: PHP=${php.json.length} Node=${node.json.length}`);

    const phpById = Object.fromEntries(php.json.map(t => [t.id, t]));
    const nodeById = Object.fromEntries(node.json.map(t => [t.id, t]));

    let diffs = 0;
    for (const pt of php.json) {
      const nt = nodeById[pt.id];
      if (!nt) { issues.push(`Type ${pt.id} (${pt.val}) missing in Node`); diffs++; continue; }
      // Compare top-level fields
      for (const k of ['up', 'type', 'val', 'unique']) {
        if (String(pt[k] || '') !== String(nt[k] || '')) {
          issues.push(`Type ${pt.id}.${k}: PHP="${pt[k]}" Node="${nt[k]}"`);
          diffs++;
        }
      }
      // Compare reqs count
      const pr = pt.reqs || [], nr = nt.reqs || [];
      if (pr.length !== nr.length) {
        issues.push(`Type ${pt.id} (${pt.val}): reqs count PHP=${pr.length} Node=${nr.length}`);
        diffs++;
      }
      // Compare each req (normalize \uXXXX escapes — PHP json_encode escapes non-ASCII, Node doesn't)
      for (let i = 0; i < Math.min(pr.length, nr.length); i++) {
        for (const rk of ['id', 'val', 'orig', 'type', 'ref', 'ref_id', 'arr_id', 'attrs']) {
          let pv = String(pr[i][rk] ?? ''), nv = String(nr[i][rk] ?? '');
          // Normalize: decode any \uXXXX sequences in both before comparing
          try { pv = JSON.parse(`"${pv.replace(/"/g, '\\"')}"`); } catch {}
          try { nv = JSON.parse(`"${nv.replace(/"/g, '\\"')}"`); } catch {}
          if (pv !== nv) {
            issues.push(`Type ${pt.id}.reqs[${i}].${rk}: PHP="${pr[i][rk]}" Node="${nr[i][rk]}"`);
            diffs++;
          }
        }
        if (diffs > 15) break;
      }
      if (diffs > 15) { issues.push('... (truncated)'); break; }
    }
  }
  // Headers
  const phpCD = hdr(php, 'Content-Disposition'), nodeCD = hdr(node, 'Content-Disposition');
  if (phpCD !== nodeCD) issues.push(`Content-Disposition: PHP="${phpCD}" Node="${nodeCD}"`);

  report('metadata — all types', issues);
}

async function auditObjMeta() {
  console.log('\n\x1b[36m━━━ 7. GET /:db/obj_meta/:id ━━━\x1b[0m');
  const cookie = `${DB}=${token}`;

  // 7a. Valid type
  const termsRes = await http(PHP, 'GET', `/${DB}/terms`, null, cookie);
  const firstType = termsRes.json?.[0]?.id || '';

  if (firstType) {
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/obj_meta/${firstType}`, null, cookie),
      http(NODE, 'GET', `/${DB}/obj_meta/${firstType}`, null, cookie),
    ]);

    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      for (const k of ['id', 'up', 'type', 'val']) {
        if (String(php.json[k] || '') !== String(node.json[k] || '')) {
          issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
        }
      }
      // Compare reqs
      const pr = php.json.reqs || {}, nr = node.json.reqs || {};
      const prKeys = Object.keys(pr).sort(), nrKeys = Object.keys(nr).sort();
      if (prKeys.join(',') !== nrKeys.join(',')) {
        issues.push(`reqs keys: PHP=[${prKeys}] Node=[${nrKeys}]`);
      } else {
        for (const k of prKeys) {
          for (const rk of ['id', 'val', 'type', 'arr_id', 'ref', 'ref_id', 'attrs']) {
            if (String(pr[k][rk] || '') !== String(nr[k][rk] || '')) {
              issues.push(`reqs[${k}].${rk}: PHP="${pr[k][rk]}" Node="${nr[k][rk]}"`);
            }
          }
        }
      }
    }
    const phpCD = hdr(php, 'Content-Disposition'), nodeCD = hdr(node, 'Content-Disposition');
    if (phpCD !== nodeCD) issues.push(`Content-Disposition: PHP="${phpCD}" Node="${nodeCD}"`);

    report(`obj_meta — valid type (${firstType})`, issues);
  }

  // 7b. Non-existent type
  {
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/obj_meta/999999999`, null, cookie),
      http(NODE, 'GET', `/${DB}/obj_meta/999999999`, null, cookie),
    ]);
    const issues = [];
    if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    if (php.json && node.json) {
      if (!jsonEq(php.json, node.json)) {
        issues.push(`Body: PHP=${shortBody(php, 200)} Node=${shortBody(node, 200)}`);
      }
    }
    report('obj_meta — non-existent type', issues);
  }
}

async function auditRefReqs() {
  console.log('\n\x1b[36m━━━ 8. GET /:db/_ref_reqs/:id ━━━\x1b[0m');
  const cookie = `${DB}=${token}`;

  // Use type 42 (Role) which should have references
  for (const typeId of ['42', '18']) {
    const [php, node] = await Promise.all([
      http(PHP, 'GET', `/${DB}/_ref_reqs/${typeId}`, null, cookie),
      http(NODE, 'GET', `/${DB}/_ref_reqs/${typeId}`, null, cookie),
    ]);

    if (php.status >= 500) {
      skip(`_ref_reqs — type ${typeId}`, 'PHP built-in server 500');
    } else {
      const issues = [];
      if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
      if (php.json && node.json) {
        if (!jsonEq(php.json, node.json)) {
          if (Array.isArray(php.json) && Array.isArray(node.json)) {
            if (php.json.length !== node.json.length) issues.push(`Count: PHP=${php.json.length} Node=${node.json.length}`);
          } else {
            issues.push(`Body structure differs`);
          }
        }
      }
      report(`_ref_reqs — type ${typeId}`, issues);
    }
  }
}

async function auditObject() {
  console.log('\n\x1b[36m━━━ 9. POST /:db (action=object) ━━━\x1b[0m');
  const cookie = `${DB}=${token}`;
  const termsRes = await http(PHP, 'GET', `/${DB}/terms`, null, cookie);
  const firstType = termsRes.json?.[0]?.id || '';

  if (!firstType) { console.log('  SKIP — no types'); skipCount++; return; }

  // This returns HTML page, compare status and Content-Type
  const [php, node] = await Promise.all([
    http(PHP, 'POST', `/${DB}`, `id=${firstType}&a=object`, cookie),
    http(NODE, 'POST', `/${DB}`, `id=${firstType}&a=object`, cookie),
  ]);

  const issues = [];
  if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
  // Both should return HTML
  const phpCT = hdr(php, 'Content-Type').split(';')[0].trim();
  const nodeCT = hdr(node, 'Content-Type').split(';')[0].trim();
  if (phpCT.toLowerCase() !== nodeCT.toLowerCase()) issues.push(`Content-Type: PHP="${phpCT}" Node="${nodeCT}"`);

  report(`POST / (action=object, type=${firstType})`, issues);
}

async function auditObjectJson() {
  console.log('\n\x1b[36m━━━ 10. POST /:db (JSON format) ━━━\x1b[0m');
  const cookie = `${DB}=${token}`;
  const termsRes = await http(PHP, 'GET', `/${DB}/terms`, null, cookie);
  const firstType = termsRes.json?.[0]?.id || '';

  if (!firstType) { console.log('  SKIP — no types'); skipCount++; return; }

  // JSON_DATA format — PHP does not support POST body action, test Node only
  const node = await http(NODE, 'POST', `/${DB}`, `id=${firstType}&a=object&JSON_DATA=1`, cookie);
  const issues = [];
  if (node.status >= 500) issues.push('Node 500');
  if (node.json && !Array.isArray(node.json)) issues.push(`Not array: ${typeof node.json}`);
  report(`POST / (JSON_DATA, type=${firstType})`, issues);
}

async function auditInvalidDb() {
  console.log('\n\x1b[36m━━━ 11. Invalid database ━━━\x1b[0m');
  const cookie = `${DB}=${token}`;

  const [php, node] = await Promise.all([
    http(PHP, 'GET', '/zzz_invalid_db_xyz/terms', null, cookie),
    http(NODE, 'GET', '/zzz_invalid_db_xyz/terms', null, cookie),
  ]);

  const issues = [];
  if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
  // Compare body type
  const phpCT = hdr(php, 'Content-Type').split(';')[0].trim();
  const nodeCT = hdr(node, 'Content-Type').split(';')[0].trim();
  if (phpCT.toLowerCase() !== nodeCT.toLowerCase()) issues.push(`Content-Type: PHP="${phpCT}" Node="${nodeCT}"`);

  report('invalid database name', issues);
}

async function auditExpires() {
  console.log('\n\x1b[36m━━━ 12. Expires header format ━━━\x1b[0m');
  const cookie = `${DB}=${token}`;

  const [php, node] = await Promise.all([
    http(PHP, 'GET', `/${DB}/terms`, null, cookie),
    http(NODE, 'GET', `/${DB}/terms`, null, cookie),
  ]);

  const issues = [];
  const phpExp = hdr(php, 'Expires');
  const nodeExp = hdr(node, 'Expires');
  // PHP: "Sat, 14 Mar 2026 19:02:38 +0000" (RFC 2822)
  // Node: "Sat, 14 Mar 2026 19:02:38 GMT" (RFC 7231)
  if (phpExp && nodeExp) {
    const phpNorm = phpExp.replace(/\+0000$/, 'GMT');
    const nodeNorm = nodeExp.replace(/\+0000$/, 'GMT');
    // Check if they differ beyond timezone format (allow ±2 sec for timing)
    const phpDate = new Date(phpExp).getTime();
    const nodeDate = new Date(nodeExp).getTime();
    if (Math.abs(phpDate - nodeDate) > 2000) {
      issues.push(`Expires time differs: PHP="${phpExp}" Node="${nodeExp}"`);
    }
    if (phpExp.includes('+0000') && nodeExp.includes('GMT')) {
      issues.push(`Timezone format: PHP="+0000" (RFC 2822) Node="GMT" (RFC 7231) — cosmetic, issue #431`);
    }
  }

  report('Expires header format', issues);
}

async function auditCacheHeaders() {
  console.log('\n\x1b[36m━━━ 13. Cache-Control / CORS headers ━━━\x1b[0m');
  const cookie = `${DB}=${token}`;

  const [php, node] = await Promise.all([
    http(PHP, 'GET', `/${DB}/terms`, null, cookie),
    http(NODE, 'GET', `/${DB}/terms`, null, cookie),
  ]);

  const issues = [];
  for (const h of ['Cache-Control', 'Access-Control-Allow-Origin', 'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers']) {
    const pv = hdr(php, h), nv = hdr(node, h);
    // Normalize spaces
    const pvNorm = pv.replace(/\s+/g, ' ').trim().toLowerCase();
    const nvNorm = nv.replace(/\s+/g, ' ').trim().toLowerCase();
    if (pvNorm !== nvNorm) issues.push(`${h}: PHP="${pv}" Node="${nv}"`);
  }

  report('Cache-Control / CORS headers', issues);
}

async function auditUnknownAction() {
  console.log('\n\x1b[36m━━━ 14. Unknown action ━━━\x1b[0m');
  const cookie = `${DB}=${token}`;

  const [php, node] = await Promise.all([
    http(PHP, 'POST', `/${DB}`, 'a=zzz_unknown_action', cookie),
    http(NODE, 'POST', `/${DB}`, 'a=zzz_unknown_action', cookie),
  ]);

  const issues = [];
  if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);

  report('unknown action', issues);
}

async function auditNoToken() {
  console.log('\n\x1b[36m━━━ 15. Access without token ━━━\x1b[0m');

  const [php, node] = await Promise.all([
    http(PHP, 'GET', `/${DB}/terms`),
    http(NODE, 'GET', `/${DB}/terms`),
  ]);

  const issues = [];
  if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
  const phpLoc = hdr(php, 'Location');
  const nodeLoc = hdr(node, 'Location');
  if (phpLoc !== nodeLoc) issues.push(`Location: PHP="${phpLoc}" Node="${nodeLoc}"`);

  report('access without token', issues);
}

async function auditOptions() {
  console.log('\n\x1b[36m━━━ 16. OPTIONS preflight ━━━\x1b[0m');

  const [php, node] = await Promise.all([
    http(PHP, 'OPTIONS', `/${DB}/terms`),
    http(NODE, 'OPTIONS', `/${DB}/terms`),
  ]);

  const issues = [];
  if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
  for (const h of ['Access-Control-Allow-Origin', 'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers']) {
    const pv = hdr(php, h).toLowerCase(), nv = hdr(node, h).toLowerCase();
    if (pv !== nv) issues.push(`${h}: PHP="${pv}" Node="${nv}"`);
  }
  // Check Allow header
  const phpAllow = hdr(php, 'Allow');
  const nodeAllow = hdr(node, 'Allow');
  if (phpAllow !== nodeAllow) issues.push(`Allow: PHP="${phpAllow}" Node="${nodeAllow}"`);

  report('OPTIONS preflight', issues);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\x1b[1m╔═══════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[1m║   Full PHP ↔ Node.js Endpoint Parity Audit           ║\x1b[0m');
  console.log('\x1b[1m╚═══════════════════════════════════════════════════════╝\x1b[0m');
  console.log(`PHP:  ${PHP}`);
  console.log(`Node: ${NODE}`);
  console.log(`DB:   ${DB}`);

  // Get token
  const authRes = await http(PHP, 'POST', `/${DB}/auth`, `login=${USER}&pwd=${PASS}`);
  const cookieMatch = (hdr(authRes, 'Set-Cookie') || '').match(/my=([a-f0-9]+)/);
  if (!cookieMatch) {
    console.error('Failed to authenticate:', authRes.status, shortBody(authRes));
    process.exit(1);
  }
  token = cookieMatch[1];
  console.log(`Token: ${token.slice(0, 8)}...\n`);

  await auditAuth();
  await auditXsrf();
  await auditGetcode();
  await auditCheckcode();
  await auditTerms();
  await auditMetadata();
  await auditObjMeta();
  await auditRefReqs();
  await auditObject();
  await auditObjectJson();
  await auditInvalidDb();
  await auditExpires();
  await auditCacheHeaders();
  await auditUnknownAction();
  await auditNoToken();
  await auditOptions();

  // ─── Summary ───
  console.log('\n\x1b[1m╔═══════════════════════════════════════════════════════╗\x1b[0m');
  console.log(`\x1b[1m║  \x1b[32m${passCount} PASS\x1b[0m  \x1b[31m${failCount} FAIL\x1b[0m  \x1b[33m${skipCount} SKIP\x1b[0m`);
  console.log('\x1b[1m╚═══════════════════════════════════════════════════════╝\x1b[0m');

  if (failCount > 0) {
    console.log('\n\x1b[1mFailed tests summary:\x1b[0m');
    for (const r of reports.filter(r => r.status === 'FAIL')) {
      console.log(`  \x1b[31m✗\x1b[0m ${r.name}`);
      for (const i of r.issues) console.log(`    → ${i}`);
    }
  }

  process.exit(failCount);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
