/**
 * Shared library for PHP vs Node.js comparison tests.
 * No skipping. No "Node-only". Send same request to both, compare results.
 */
import { mkdirSync, writeFileSync as _writeFileSync } from 'fs';
import { join as _join } from 'path';

const PHP  = 'http://127.0.0.1:8082';
const NODE = process.env.NODE_URL || 'http://127.0.0.1:8081';
const DB   = 'my';
const USER = 'testbot';
const PASS = 'test123';

let token = '';
let xsrfPhp = '', xsrfNode = '';
const results = [];

/**
 * Map of base type IDs to concrete type IDs usable with _d_req.
 * PHP's _d_req rejects base types (where id == t in DB), so we need
 * concrete types that have the desired base type.
 * Populated in setup() by scanning /terms.
 * If no concrete type exists for a base type, one is created.
 */
const concreteTypes = {};

// ── HTTP ──────────────────────────────────────────────────────────────────────

async function http(baseUrl, method, path, body, cookie, extraHeaders = {}) {
  const url = `${baseUrl}${path}`;
  const headers = { ...extraHeaders };
  if (cookie) headers['Cookie'] = cookie;
  const opts = { method, headers, redirect: 'manual' };
  if (body && (method === 'POST' || method === 'PUT')) {
    // FormData sets Content-Type automatically (multipart/form-data with boundary)
    if (!headers['Content-Type'] && !(body instanceof FormData)) headers['Content-Type'] = 'application/x-www-form-urlencoded';
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
    return { status: res.status, body: text, json, headers: hdrs, size: buf.byteLength };
  } catch (err) {
    return { status: 0, body: '', json: null, headers: {}, error: err.message, size: 0 };
  }
}

// ── Compare ───────────────────────────────────────────────────────────────────

function short(s, n = 100) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '...' : s;
}

/**
 * Mask dynamic IDs in a string — numbers >= 10000 are likely type/requisite/object IDs.
 */
function maskIds(s) {
  if (typeof s !== 'string') return s;
  // F_1000006760 → F___ID__, standalone large numbers, arr-type="204212"
  return s.replace(/\d{5,}/g, '__ID__');
}

/**
 * Normalize JSON for comparison — replace IDs, tokens, timestamps with placeholders.
 * This way we compare structure and non-variable values.
 */
function normalize(obj, depth = 0) {
  if (depth > 10) return obj;
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(v => normalize(v, depth + 1));
  if (typeof obj === 'number') return obj >= 10000 ? '__ID__' : obj;
  if (typeof obj === 'string') return maskIds(obj);
  if (typeof obj !== 'object') return obj;

  const out = {};
  for (const k of Object.keys(obj).sort()) {
    // Mask dynamic IDs in keys too (e.g. "1000006747": [...])
    const nk = /^\d{5,}$/.test(k) ? '__ID__' : k;
    const v = obj[k];
    if (k === '_xsrf' || k === 'xsrf') { out[nk] = '__XSRF__'; continue; }
    if (k === 'token') { out[nk] = '__TOKEN__'; continue; }
    if (k === 'id' && (typeof v === 'number' || typeof v === 'string')) { out[nk] = '__ID__'; continue; }
    if (k === 'id' && Array.isArray(v)) { out[nk] = v.map(() => '__ID__'); continue; }
    if (k === 'obj' && (typeof v === 'number' || typeof v === 'string')) { out[nk] = '__ID__'; continue; }
    if (k === 'obj' && Array.isArray(v)) { out[nk] = v.map(() => '__ID__'); continue; }
    if (k === 'ord') { out[nk] = '__ORD__'; continue; }
    out[nk] = normalize(v, depth + 1);
  }
  return out;
}

function compare(php, node, opts = {}) {
  const diffs = [];

  // Status
  if (!opts.ignoreStatus && php.status !== node.status) {
    diffs.push(`status: PHP=${php.status} Node=${node.status}`);
  }

  if (opts.statusOnly) return diffs;

  // Both JSON
  if (php.json !== null && node.json !== null) {
    const pType = Array.isArray(php.json) ? 'array' : typeof php.json;
    const nType = Array.isArray(node.json) ? 'array' : typeof node.json;
    if (pType !== nType) {
      diffs.push(`type: PHP=${pType} Node=${nType}`);
    } else if (pType === 'array') {
      // Compare array lengths (not exact content, IDs will differ)
      if (php.json.length !== node.json.length) {
        diffs.push(`length: PHP=${php.json.length} Node=${node.json.length}`);
      }
      // Compare structure of first element
      if (php.json.length > 0 && node.json.length > 0) {
        const pk = Object.keys(php.json[0]).sort().join(',');
        const nk = Object.keys(node.json[0]).sort().join(',');
        if (pk !== nk) diffs.push(`keys[0]: PHP=[${pk}] Node=[${nk}]`);
      }
    } else if (pType === 'object') {
      // Compare top-level keys
      const pk = Object.keys(php.json).sort().join(',');
      const nk = Object.keys(node.json).sort().join(',');
      if (pk !== nk) diffs.push(`keys: PHP=[${short(pk,60)}] Node=[${short(nk,60)}]`);
      // Compare normalized values
      if (!opts.keysOnly) {
        const pn = normalize(php.json);
        const nn = normalize(node.json);
        if (JSON.stringify(pn) !== JSON.stringify(nn)) {
          // Find which keys differ
          for (const k of Object.keys(pn)) {
            if (JSON.stringify(pn[k]) !== JSON.stringify(nn[k])) {
              diffs.push(`val[${k}]: PHP=${short(JSON.stringify(pn[k]),40)} Node=${short(JSON.stringify(nn[k]),40)}`);
              if (diffs.length > 3) break;
            }
          }
        }
      }
    }
  } else if (php.json === null && node.json === null) {
    // Both non-JSON
    if (opts.binary) {
      // Compare sizes for binary
      if (Math.abs(php.size - node.size) > 100) {
        diffs.push(`size: PHP=${php.size} Node=${node.size}`);
      }
    } else {
      const pb = maskIds(php.body.trim());
      const nb = maskIds(node.body.trim());
      if (pb !== nb) diffs.push(`body: PHP=${short(pb,50)} Node=${short(nb,50)}`);
    }
  } else {
    // One JSON, one not
    diffs.push(`format: PHP=${php.json ? 'JSON' : 'text'} Node=${node.json ? 'JSON' : 'text'}`);
  }

  return diffs;
}

// ── dual() — the core test function ──────────────────────────────────────────

/**
 * Send same request to PHP and Node, compare, log result.
 * @param {string} name - Test name
 * @param {string} method - HTTP method
 * @param {string|Function} pathFn - Path string or (server) => path
 * @param {string|Function|null} bodyFn - Body string or (server) => body
 * @param {object} opts - { noCookie, statusOnly, keysOnly, binary, extractId }
 * @returns {{ php, node, match, diffs }}
 */
async function dual(name, method, pathFn, bodyFn = null, opts = {}) {
  const phpPath = typeof pathFn === 'function' ? pathFn('php') : pathFn;
  const nodePath = typeof pathFn === 'function' ? pathFn('node') : pathFn;
  const phpBody = typeof bodyFn === 'function' ? bodyFn('php') : bodyFn;
  const nodeBody = typeof bodyFn === 'function' ? bodyFn('node') : bodyFn;
  const ck = opts.noCookie ? null : `${DB}=${token}`;

  const [php, node] = await Promise.all([
    http(PHP, method, `/${DB}${phpPath}`, phpBody, ck),
    http(NODE, method, `/${DB}${nodePath}`, nodeBody, ck),
  ]);

  const diffs = compare(php, node, opts);
  const match = diffs.length === 0;
  const icon = match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m';
  console.log(`  ${icon}  ${name}${diffs.length ? '\n         ' + diffs.join('\n         ') : ''}`);

  const entry = {
    name, match, diffs,
    phpStatus: php.status, nodeStatus: node.status,
    phpBody: php.body, nodeBody: node.body,
    phpJson: php.json, nodeJson: node.json,
    phpPath, nodePath,
    method,
  };
  results.push(entry);

  return { php, node, match, diffs };
}

// ── Setup & Auth ─────────────────────────────────────────────────────────────

async function setup() {
  // Auth via PHP (creates token in shared DB)
  const authRes = await http(PHP, 'POST', `/${DB}/auth`, `login=${USER}&pwd=${PASS}&JSON=1`);
  if (!authRes.json?.token) throw new Error('PHP auth failed: ' + authRes.body);
  token = authRes.json.token;

  // Get XSRF from both
  const [xP, xN] = await Promise.all([
    http(PHP, 'GET', `/${DB}/xsrf?JSON=1`, null, `${DB}=${token}`),
    http(NODE, 'GET', `/${DB}/xsrf?JSON=1`, null, `${DB}=${token}`),
  ]);
  xsrfPhp = xP.json?._xsrf || '';
  xsrfNode = xN.json?._xsrf || '';
  if (!xsrfPhp || !xsrfNode) throw new Error('XSRF fetch failed');

  // Build concrete type map: PHP _d_req rejects base types (id==t),
  // so we need concrete types for SHORT(3), LONG(2), DATETIME(4), BOOL(7), NUMBER(11), etc.
  const ck = `${DB}=${token}`;
  const termsRes = await http(PHP, 'GET', `/${DB}/terms?JSON=1`, null, ck);
  const BASE_IDS = [2, 3, 4, 7, 8, 9, 10, 11, 13, 14]; // base types we might need (10=FILE, 8=CHARS)
  if (termsRes.json && Array.isArray(termsRes.json)) {
    for (const item of termsRes.json) {
      const bt = item.type;
      if (BASE_IDS.includes(bt) && !concreteTypes[bt]) {
        concreteTypes[bt] = item.id;
      }
    }
  }
  // Create concrete types for any base types that don't have one yet
  for (const bt of BASE_IDS) {
    if (!concreteTypes[bt]) {
      const name = `__sys_bt${bt}_${Date.now()}`;
      const res = await http(PHP, 'POST', `/${DB}/_d_new`, `_xsrf=${xsrfPhp}&val=${encodeURIComponent(name)}&t=${bt}&up=1&JSON=1`, ck);
      if (res.json?.obj) {
        concreteTypes[bt] = Number(res.json.obj);
        console.log(`  Created concrete type for base ${bt}: ${concreteTypes[bt]}`);
      }
    }
  }
  console.log(`Token: ${token.slice(0, 8)}...`);
  console.log(`Concrete types: ${JSON.stringify(concreteTypes)}`);
  return { token, xsrfPhp, xsrfNode };
}

// ── Cleanup helpers ──────────────────────────────────────────────────────────

async function deleteObj(id) {
  if (!id) return;
  await Promise.all([
    http(PHP, 'POST', `/${DB}/_m_del/${id}`, `_xsrf=${xsrfPhp}&JSON=1`, `${DB}=${token}`),
    http(NODE, 'POST', `/${DB}/_m_del/${id}`, `_xsrf=${xsrfNode}&JSON=1`, `${DB}=${token}`),
  ]);
}

async function deleteType(id) {
  if (!id) return;
  await Promise.all([
    http(PHP, 'POST', `/${DB}/_d_del/${id}`, `_xsrf=${xsrfPhp}&forced=1&JSON=1`, `${DB}=${token}`),
    http(NODE, 'POST', `/${DB}/_d_del/${id}`, `_xsrf=${xsrfNode}&forced=1&JSON=1`, `${DB}=${token}`),
  ]);
}

async function preCleanup(prefix) {
  const ck = `${DB}=${token}`;
  const res = await http(PHP, 'GET', `/${DB}/terms?JSON=1`, null, ck);
  if (!res.json) return;
  let count = 0;
  for (const t of res.json) {
    if (typeof t.name === 'string' && t.name.startsWith(prefix)) {
      await deleteType(t.id);
      count++;
    }
  }
  if (count) console.log(`  Pre-cleanup: removed ${count} stale types`);
}

// ── Create helpers (for test data setup) ─────────────────────────────────────

async function createType(name, baseType = 3, extra = '') {
  const ck = `${DB}=${token}`;
  const extraPhp = typeof extra === 'function' ? extra('php') : extra;
  const extraNode = typeof extra === 'function' ? extra('node') : extra;
  const [php, node] = await Promise.all([
    http(PHP, 'POST', `/${DB}/_d_new`, `_xsrf=${xsrfPhp}&val=${encodeURIComponent(name)}&t=${baseType}${extraPhp}&up=1&JSON=1`, ck),
    http(NODE, 'POST', `/${DB}/_d_new`, `_xsrf=${xsrfNode}&val=${encodeURIComponent(name)}&t=${baseType}${extraNode}&up=1&JSON=1`, ck),
  ]);
  return { php: Number(php.json?.obj), node: Number(node.json?.obj) };
}

async function addColumn(typeIds, colType = 3) {
  const ck = `${DB}=${token}`;
  // PHP _d_req rejects base type IDs (e.g. 3, 11, 4, 7) — need concrete type ID
  const concreteId = concreteTypes[colType] || colType;
  const [php, node] = await Promise.all([
    http(PHP, 'POST', `/${DB}/_d_req/${typeIds.php}`, `_xsrf=${xsrfPhp}&t=${concreteId}&JSON=1`, ck),
    http(NODE, 'POST', `/${DB}/_d_req/${typeIds.node}`, `_xsrf=${xsrfNode}&t=${concreteId}&JSON=1`, ck),
  ]);
  return { php: Number(php.json?.id), node: Number(node.json?.id) };
}

async function addRefColumn(typeIds, refTypeIds) {
  const ck = `${DB}=${token}`;
  const [php, node] = await Promise.all([
    http(PHP, 'POST', `/${DB}/_d_ref/${typeIds.php}`, `_xsrf=${xsrfPhp}&t=${refTypeIds.php}&JSON=1`, ck),
    http(NODE, 'POST', `/${DB}/_d_ref/${typeIds.node}`, `_xsrf=${xsrfNode}&t=${refTypeIds.node}&JSON=1`, ck),
  ]);
  // _d_ref: obj = requisite ID, id = parent type
  return { php: Number(php.json?.obj), node: Number(node.json?.obj) };
}

async function createObj(typeIds, value, upPhp = 1, upNode = 1) {
  const ck = `${DB}=${token}`;
  const [php, node] = await Promise.all([
    http(PHP, 'POST', `/${DB}/_m_new/${typeIds.php}`, `_xsrf=${xsrfPhp}&t${typeIds.php}=${encodeURIComponent(value)}&up=${upPhp}&JSON=1`, ck),
    http(NODE, 'POST', `/${DB}/_m_new/${typeIds.node}`, `_xsrf=${xsrfNode}&t${typeIds.node}=${encodeURIComponent(value)}&up=${upNode}&JSON=1`, ck),
  ]);
  return { php: Number(php.json?.obj || php.json?.id), node: Number(node.json?.obj || node.json?.id) };
}

// ── Summary ──────────────────────────────────────────────────────────────────

function section(title) {
  console.log(`\n\x1b[36m━━━ ${title} ━━━\x1b[0m`);
}

function summary() {
  const matchCount = results.filter(r => r.match).length;
  const diffCount = results.filter(r => !r.match).length;
  const total = results.length;

  console.log(`\n\x1b[1m╔═══════════════════════════════════════════════════════╗\x1b[0m`);
  console.log(`\x1b[1m║  \x1b[32m${matchCount} MATCH\x1b[0m  \x1b[31m${diffCount} DIFF\x1b[0m  out of ${total} tests`);
  console.log(`\x1b[1m╚═══════════════════════════════════════════════════════╝\x1b[0m`);

  if (diffCount > 0) {
    console.log(`\n\x1b[31mDIFFs:\x1b[0m`);
    for (const r of results.filter(r => !r.match)) {
      console.log(`  ${r.name}`);
      for (const d of r.diffs) console.log(`    → ${d}`);
    }
  }

  return { matchCount, diffCount, total };
}

function generateMD(filename) {
  const matchCount = results.filter(r => r.match).length;
  const diffCount = results.filter(r => !r.match).length;
  const lines = [
    `# ${filename}`,
    ``,
    `${matchCount} MATCH / ${diffCount} DIFF out of ${results.length} tests`,
    ``,
    `| # | Test | PHP | Node | Result |`,
    `|---|------|-----|------|--------|`,
  ];
  results.forEach((r, i) => {
    const result = r.match ? 'MATCH' : `DIFF: ${r.diffs[0] || ''}`;
    lines.push(`| ${i + 1} | ${r.name} | ${r.phpStatus} | ${r.nodeStatus} | ${result} |`);
  });

  if (diffCount > 0) {
    lines.push('', '## Diffs Detail', '');
    for (const r of results.filter(r => !r.match)) {
      lines.push(`### ${r.name}`, '');
      for (const d of r.diffs) lines.push(`- ${d}`);
      lines.push(`- PHP: \`${short(r.phpBody, 150)}\``);
      lines.push(`- Node: \`${short(r.nodeBody, 150)}\``);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Write detailed reports to tests/reports/{testName}/
 * - summary.md — overview table + diff details
 * - For each DIFF test: {N}-php.json and {N}-node.json with full responses
 */
function writeReports(testName, reportsBase) {
  const dir = _join(reportsBase, testName);
  mkdirSync(dir, { recursive: true });

  const matchCount = results.filter(r => r.match).length;
  const diffCount = results.filter(r => !r.match).length;
  const total = results.length;

  const lines = [
    `# ${testName}`,
    ``,
    `**${matchCount} MATCH / ${diffCount} DIFF** out of ${total} tests`,
    ``,
    `| # | Test | Method | PHP | Node | Result |`,
    `|---|------|--------|-----|------|--------|`,
  ];

  results.forEach((r, i) => {
    const n = String(i + 1).padStart(2, '0');
    const result = r.match ? 'MATCH' : `DIFF`;
    lines.push(`| ${n} | ${r.name} | ${r.method} | ${r.phpStatus} | ${r.nodeStatus} | ${result} |`);
  });

  // Detailed diffs
  let diffIdx = 0;
  for (const r of results) {
    const i = results.indexOf(r);
    const n = String(i + 1).padStart(2, '0');

    if (!r.match) {
      diffIdx++;
      lines.push('', `---`, `### DIFF ${n}: ${r.name}`, '');
      lines.push(`- **PHP path:** \`${r.phpPath}\``);
      lines.push(`- **Node path:** \`${r.nodePath}\``);
      lines.push(`- **PHP status:** ${r.phpStatus}`);
      lines.push(`- **Node status:** ${r.nodeStatus}`);
      lines.push('');
      for (const d of r.diffs) lines.push(`- ${d}`);
      lines.push('');
      lines.push(`Full responses: [${n}-php.json](./${n}-php.json) | [${n}-node.json](./${n}-node.json)`);

      // Write full response files
      const phpData = r.phpJson !== null ? JSON.stringify(r.phpJson, null, 2) : r.phpBody;
      const nodeData = r.nodeJson !== null ? JSON.stringify(r.nodeJson, null, 2) : r.nodeBody;
      _writeFileSync(_join(dir, `${n}-php.json`), phpData);
      _writeFileSync(_join(dir, `${n}-node.json`), nodeData);
    }
  }

  _writeFileSync(_join(dir, 'summary.md'), lines.join('\n'));
  console.log(`\nReports written to ${dir}/`);
}

export {
  PHP, NODE, DB, USER, PASS,
  http, short, normalize, compare, dual,
  setup, preCleanup, deleteObj, deleteType,
  createType, addColumn, addRefColumn, createObj,
  section, summary, generateMD, writeReports, results,
  token, xsrfPhp, xsrfNode,
};

// Re-export mutable refs via getters
export function getToken() { return token; }
export function getXsrf(server) { return server === 'php' ? xsrfPhp : xsrfNode; }
export function cookie() { return `${DB}=${token}`; }
export function getConcreteType(baseId) { return concreteTypes[baseId]; }
