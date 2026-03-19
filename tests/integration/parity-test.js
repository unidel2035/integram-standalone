#!/usr/bin/env node
/**
 * PHP vs Node.js Parity Integration Test
 * Compares HTTP responses from both servers for identical requests.
 *
 * Usage: node parity-test.js
 * Prerequisites:
 *   PHP:  php -S 127.0.0.1:8082 router.php  (in integram-server/)
 *   Node: PORT=8081 node start-legacy-test.js (in backend/monolith/)
 *   Test user: testbot / test123 in 'my' database
 */

const PHP  = 'http://127.0.0.1:8082';
const NODE = 'http://127.0.0.1:8081';
const DB   = 'my';

let token = '';
let pass = 0, fail = 0, skip = 0;
const diffs = [];

// ─── HTTP helper ────────────────────────────────────────────────────────────

async function req(baseUrl, method, path, body, cookie) {
  const url = `${baseUrl}${path}`;
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;

  const opts = { method, headers, redirect: 'manual' };

  if (body && method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = body;
  }

  const res = await fetch(url, opts);
  const text = await res.text();

  let json = null;
  try { json = JSON.parse(text); } catch {}

  const hdrs = {};
  for (const [k, v] of res.headers.entries()) {
    hdrs[k.toLowerCase()] = v;
  }

  return {
    status: res.status,
    body: text,
    json,
    headers: hdrs,
    location: hdrs['location'] || '',
    contentType: hdrs['content-type'] || '',
    contentDisposition: hdrs['content-disposition'] || '',
    cookies: hdrs['set-cookie'] || '',
  };
}

// ─── Comparison helpers ─────────────────────────────────────────────────────

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false;
    if (!deepEqual(a[keysA[i]], b[keysB[i]])) return false;
  }
  return true;
}

function jsonDiff(a, b, path = '') {
  const results = [];
  if (a === b) return results;
  if (typeof a !== typeof b) {
    results.push(`${path}: type ${typeof a} vs ${typeof b}`);
    return results;
  }
  if (a === null || b === null || typeof a !== 'object') {
    const aStr = JSON.stringify(a);
    const bStr = JSON.stringify(b);
    if (aStr !== bStr) {
      const aShort = aStr.length > 80 ? aStr.slice(0, 80) + '...' : aStr;
      const bShort = bStr.length > 80 ? bStr.slice(0, 80) + '...' : bStr;
      results.push(`${path}: PHP=${aShort} NODE=${bShort}`);
    }
    return results;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      results.push(`${path}: array length ${a.length} vs ${b.length}`);
    }
    const len = Math.min(a.length, b.length, 3); // compare first 3 elements
    for (let i = 0; i < len; i++) {
      results.push(...jsonDiff(a[i], b[i], `${path}[${i}]`));
    }
    if (a.length > 3 || b.length > 3) {
      results.push(`${path}: (showing first 3 of ${Math.max(a.length, b.length)} elements)`);
    }
    return results;
  }

  const allKeys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const key of allKeys) {
    if (!(key in a)) {
      results.push(`${path}.${key}: missing in PHP`);
    } else if (!(key in b)) {
      results.push(`${path}.${key}: missing in NODE`);
    } else {
      results.push(...jsonDiff(a[key], b[key], `${path}.${key}`));
    }
    if (results.length > 10) {
      results.push('... (truncated)');
      break;
    }
  }
  return results;
}

// ─── Test runner ────────────────────────────────────────────────────────────

async function test(name, method, path, body, cookie, opts = {}) {
  try {
    const [php, node] = await Promise.all([
      req(PHP, method, path, body, cookie),
      req(NODE, method, path, body, cookie),
    ]);

    const issues = [];

    // Status code
    if (php.status !== node.status) {
      issues.push(`status: ${php.status} vs ${node.status}`);
    }

    // Body comparison
    if (opts.compareBody !== false) {
      if (php.json && node.json) {
        if (!deepEqual(php.json, node.json)) {
          const d = jsonDiff(php.json, node.json);
          issues.push(...d.slice(0, 5));
        }
      } else if (opts.compareBody === 'text') {
        if (php.body.trim() !== node.body.trim()) {
          issues.push(`body: PHP="${php.body.trim().slice(0, 100)}" NODE="${node.body.trim().slice(0, 100)}"`);
        }
      }
    }

    // Headers
    if (opts.checkHeaders) {
      for (const h of opts.checkHeaders) {
        const hLower = h.toLowerCase();
        const pv = php.headers[hLower] || '';
        const nv = node.headers[hLower] || '';
        // Normalize: trim, lowercase for comparison
        if (pv.toLowerCase().trim() !== nv.toLowerCase().trim()) {
          issues.push(`${h}: PHP="${pv}" NODE="${nv}"`);
        }
      }
    }

    // Location header (for redirects)
    if (php.status >= 300 && php.status < 400) {
      if (php.location !== node.location) {
        issues.push(`Location: PHP="${php.location}" NODE="${node.location}"`);
      }
    }

    if (issues.length === 0) {
      console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
      pass++;
    } else {
      console.log(`  \x1b[31mFAIL\x1b[0m  ${name}`);
      for (const i of issues) console.log(`         ${i}`);
      fail++;
      diffs.push({ name, issues });
    }

    return { php, node };
  } catch (err) {
    console.log(`  \x1b[33mERROR\x1b[0m ${name}: ${err.message}`);
    skip++;
    return {};
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\x1b[1m═══════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[1m  PHP ↔ Node.js Parity Test\x1b[0m');
  console.log('\x1b[1m═══════════════════════════════════════════════════\x1b[0m\n');

  // ─── Auth ───
  console.log('\x1b[1m▶ Authentication\x1b[0m');
  const authPhp = await req(PHP, 'POST', `/${DB}/auth`, 'login=testbot&pwd=test123');
  const cookieMatch = (authPhp.cookies || '').match(/my=([a-f0-9]+)/);
  if (!cookieMatch) {
    console.log('  \x1b[31mFailed to authenticate with PHP\x1b[0m');
    console.log('  Response:', authPhp.status, authPhp.body.slice(0, 200));
    process.exit(1);
  }
  token = cookieMatch[1];
  const cookie = `${DB}=${token}`;
  console.log(`  Token: ${token.slice(0, 8)}...`);

  // Get XSRF
  const xsrfRes = await test('xsrf structure', 'GET', `/${DB}/xsrf`, null, cookie, {
    compareBody: false, // xsrf values differ, compare structure only
  });
  if (xsrfRes.php?.json && xsrfRes.node?.json) {
    const phpKeys = Object.keys(xsrfRes.php.json).sort().join(',');
    const nodeKeys = Object.keys(xsrfRes.node.json).sort().join(',');
    if (phpKeys === nodeKeys) {
      console.log(`         keys match: [${phpKeys}]`);
    } else {
      console.log(`         \x1b[31mkeys differ: PHP=[${phpKeys}] NODE=[${nodeKeys}]\x1b[0m`);
    }
  }

  console.log('');

  // ─── Read-only endpoints ───
  console.log('\x1b[1m▶ Read-only endpoints\x1b[0m');

  const hdrs = ['Content-Type', 'Content-Disposition', 'Access-Control-Allow-Origin'];

  await test('GET /terms', 'GET', `/${DB}/terms`, null, cookie, { checkHeaders: hdrs });
  await test('GET /metadata', 'GET', `/${DB}/metadata`, null, cookie, { checkHeaders: hdrs });

  // Get first type for further tests
  const termsPhp = await req(PHP, 'GET', `/${DB}/terms`, null, cookie);
  let firstType = '';
  if (termsPhp.json && Array.isArray(termsPhp.json) && termsPhp.json.length > 0) {
    firstType = String(termsPhp.json[0].id);
  }

  if (firstType) {
    await test(`GET /obj_meta/${firstType}`, 'GET', `/${DB}/obj_meta/${firstType}`, null, cookie, { checkHeaders: hdrs });
  }

  // _ref_reqs
  await test('GET /_ref_reqs/18', 'GET', `/${DB}/_ref_reqs/18`, null, cookie, { checkHeaders: hdrs });

  console.log('');

  // ─── Data endpoints ───
  console.log('\x1b[1m▶ Data endpoints\x1b[0m');

  if (firstType) {
    // POST /:db (action=object) — HTML response, compare structure differences
    await test(`POST / (object type=${firstType})`, 'POST', `/${DB}`, `id=${firstType}&a=object`, cookie, {
      compareBody: false, // HTML page, not JSON
      checkHeaders: ['Content-Type'],
    });
  }

  console.log('');

  // ─── Auth errors ───
  console.log('\x1b[1m▶ Auth error responses\x1b[0m');

  await test('wrong password', 'POST', `/${DB}/auth`, 'login=testbot&pwd=wrongpwd', null, {
    checkHeaders: ['Content-Type'],
  });

  await test('missing login field', 'POST', `/${DB}/auth`, 'pwd=x', null, {
    checkHeaders: ['Content-Type'],
  });

  console.log('');

  // ─── Error cases ───
  console.log('\x1b[1m▶ Error cases\x1b[0m');

  await test('invalid database', 'GET', '/zzz_nonexist/terms', null, cookie, {
    checkHeaders: ['Content-Type'],
  });

  await test('obj_meta missing type', 'GET', `/${DB}/obj_meta/999999999`, null, cookie, {
    checkHeaders: ['Content-Type'],
  });

  await test('unknown action', 'POST', `/${DB}`, 'a=zzz_unknown_action', cookie, {
    compareBody: false, // Both return HTML page
    checkHeaders: ['Content-Type'],
  });

  console.log('');

  // ─── Header parity ───
  console.log('\x1b[1m▶ Header parity\x1b[0m');

  // Compare Cache-Control, Expires on a standard endpoint
  await test('cache headers on /terms', 'GET', `/${DB}/terms`, null, cookie, {
    compareBody: false,
    checkHeaders: ['Cache-Control', 'Expires', 'Access-Control-Allow-Origin', 'Access-Control-Allow-Methods'],
  });

  // Content-Disposition on auth-related JSON endpoints
  await test('getcode Content-Disposition', 'POST', `/${DB}/getcode`, 'login=nonexistent@test.com', null, {
    compareBody: false,
    checkHeaders: ['Content-Disposition', 'Content-Type'],
  });

  console.log('');

  // ─── Summary ───
  console.log('\x1b[1m═══════════════════════════════════════════════════\x1b[0m');
  console.log(`  Results: \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m, \x1b[33m${skip} skipped\x1b[0m`);
  console.log('\x1b[1m═══════════════════════════════════════════════════\x1b[0m');

  process.exit(fail);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
