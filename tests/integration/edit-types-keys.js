#!/usr/bin/env node
/**
 * Regression test for #443: edit_types must NOT return &main.myrolemenu or &main.&top_menu.
 *
 * PHP's edit_types handler calls die() inside isApi() before myrolemenu/top_menu
 * are added, so the JSON response only contains:
 *   &main.a.&editables, &main.a.&types, edit_types, editable, types
 *
 * Usage: node tests/integration/edit-types-keys.js
 * Requires: Node server on 127.0.0.1:8081, test user testbot/test123 in 'my' db
 */

const NODE = 'http://127.0.0.1:8081';
const DB   = 'my';
const USER = 'testbot';
const PASS = 'test123';

let passCount = 0, failCount = 0;

async function http(baseUrl, method, path, body, cookie) {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  const opts = { method, headers, redirect: 'manual' };
  if (body && method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = body;
  }
  const res = await fetch(baseUrl + path, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json };
}

function check(name, ok, detail) {
  if (ok) { passCount++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  else    { failCount++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${detail}`); }
}

async function run() {
  // Authenticate against Node
  const authRes = await http(NODE, 'POST', `/${DB}/auth`, `login=${USER}&pwd=${PASS}`);
  if (!authRes.json?.token) {
    console.error('Auth failed — is Node server running on :8081?');
    process.exit(2);
  }
  const token = authRes.json.token;
  const cookie = `${DB}=${token}`;

  console.log('\n\x1b[36m━━━ #443: edit_types key parity ━━━\x1b[0m');

  // GET /edit_types?JSON=1
  const r = await http(NODE, 'GET', `/${DB}/edit_types?JSON=1`, null, cookie);

  check('edit_types returns 200', r.status === 200, `got ${r.status}`);
  check('response is JSON object', r.json && typeof r.json === 'object', 'not an object');

  if (r.json) {
    const keys = Object.keys(r.json).sort();

    // Must NOT have these extra keys
    check('no &main.myrolemenu key',
      !('&main.myrolemenu' in r.json),
      `found &main.myrolemenu (extra key not in PHP)`);

    check('no &main.&top_menu key',
      !('&main.&top_menu' in r.json),
      `found &main.&top_menu (extra key not in PHP)`);

    // Must have required keys
    const required = ['&main.a.&editables', '&main.a.&types', 'edit_types', 'editable', 'types'];
    for (const k of required) {
      check(`has required key "${k}"`, k in r.json, `missing key "${k}"`);
    }

    // Exactly the expected keys
    const expected = required.sort();
    const match = JSON.stringify(keys) === JSON.stringify(expected);
    check('exactly 5 expected keys',
      match,
      `expected [${expected.join(', ')}] got [${keys.join(', ')}]`);
  }

  // Summary
  console.log(`\n  Total: ${passCount} passed, ${failCount} failed`);
  process.exit(failCount > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(2); });
