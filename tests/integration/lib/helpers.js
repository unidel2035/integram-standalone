/**
 * Shared helpers for parity tests.
 * Usage: const h = require('./lib/helpers');
 */

const PHP  = 'http://127.0.0.1:8082';
const NODE = 'http://127.0.0.1:8081';
const DB   = 'my';
const USER = 'testbot';
const PASS = 'test123';

let token = '';
let xsrfPhp = '', xsrfNode = '';
let passCount = 0, failCount = 0, skipCount = 0;
const reports = [];

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

function nodeOnly(name, node, checks) {
  const issues = [];
  if (node.status >= 500) { issues.push('Node 500'); report(name + ' (Node-only)', issues); return; }
  checks(node, issues);
  report(name + ' (Node-only)', issues);
}

async function setup() {
  const authRes = await http(PHP, 'POST', `/${DB}/auth`, `login=${USER}&pwd=${PASS}`);
  const m = ((authRes.headers['set-cookie'] || '').match(/my=([a-f0-9]+)/) || [])[1];
  if (!m) { console.error('Auth failed'); process.exit(1); }
  token = m;
  const [phpX, nodeX] = await Promise.all([
    http(PHP, 'GET', `/${DB}/xsrf`, null, cookie()),
    http(NODE, 'GET', `/${DB}/xsrf`, null, cookie()),
  ]);
  xsrfPhp = phpX.json?._xsrf || '';
  xsrfNode = nodeX.json?._xsrf || '';
  if (!xsrfPhp || !xsrfNode) { console.error('XSRF failed'); process.exit(1); }
  return { token, xsrfPhp, xsrfNode };
}

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

function summary(title) {
  console.log(`\n\x1b[1m╔═══════════════════════════════════════════════════════╗\x1b[0m`);
  console.log(`\x1b[1m║  ${title}\x1b[0m`);
  console.log(`\x1b[1m║  \x1b[32m${passCount} PASS\x1b[0m  \x1b[31m${failCount} FAIL\x1b[0m  \x1b[33m${skipCount} SKIP\x1b[0m`);
  console.log(`\x1b[1m╚═══════════════════════════════════════════════════════╝\x1b[0m`);
  if (failCount > 0) {
    console.log('\n\x1b[31mFailed:\x1b[0m');
    for (const r of reports.filter(r => r.status === 'FAIL')) {
      console.log(`  ✗ ${r.name}`);
      for (const i of r.issues) console.log(`    → ${i}`);
    }
  }
  process.exit(failCount > 0 ? 1 : 0);
}

const h = {
  PHP, NODE, DB, USER, PASS,
  get token() { return token; },
  set token(v) { token = v; },
  get xsrfPhp() { return xsrfPhp; },
  set xsrfPhp(v) { xsrfPhp = v; },
  get xsrfNode() { return xsrfNode; },
  set xsrfNode(v) { xsrfNode = v; },
  get passCount() { return passCount; },
  get failCount() { return failCount; },
  get skipCount() { return skipCount; },
  http, short, report, skip, cookie, section, cmp, nodeOnly,
  setup, reauth, summary,
};
export default h;
