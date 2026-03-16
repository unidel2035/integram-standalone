#!/usr/bin/env node
/**
 * 32-session-exit-jwt: PHP vs Node.js — Session lifecycle, exit, JWT, confirm
 * Tests: /exit (logout), /jwt (no RSA key), /confirm (password reset),
 *        /login redirect, re-auth after exit
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const USER = 'testbot';
const PASS = 'test123';

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();

  // ── JWT endpoint (no RSA key configured) ─────────────────────────────
  section('JWT — No RSA key');

  // 1. JWT with empty body
  await dual('#1 POST /jwt (empty body)', 'POST',
    '/jwt', '_xsrf=x&JSON=1', { noCookie: true, keysOnly: true });

  // 2. JWT with empty jwt field
  await dual('#2 POST /jwt (jwt=empty)', 'POST',
    '/jwt', 'jwt=&JSON=1', { noCookie: true, keysOnly: true });

  // 3. JWT with fake token
  await dual('#3 POST /jwt (fake token)', 'POST',
    '/jwt', 'jwt=fake.token.here&JSON=1', { noCookie: true, keysOnly: true });

  // 4. JWT with malformed (1 part)
  await dual('#4 POST /jwt (malformed)', 'POST',
    '/jwt', 'jwt=notajwt&JSON=1', { noCookie: true, keysOnly: true });

  // ── /confirm endpoint ────────────────────────────────────────────────
  section('Confirm — Password reset');

  // 5. Confirm with no params
  await dual('#5 GET /confirm (no params)', 'GET',
    '/confirm?JSON=1', null, { noCookie: true, keysOnly: true });

  // 6. Confirm with empty params
  await dual('#6 GET /confirm (empty params)', 'GET',
    '/confirm?u=&o=&p=&JSON=1', null, { noCookie: true, keysOnly: true });

  // 7. Confirm with invalid user
  await dual('#7 GET /confirm (invalid user)', 'GET',
    '/confirm?u=nonexistent_user_xyz&o=oldhash&p=newhash&JSON=1', null, { noCookie: true, keysOnly: true });

  // 8. Confirm POST with no params
  await dual('#8 POST /confirm (no params)', 'POST',
    '/confirm', 'JSON=1', { noCookie: true, keysOnly: true });

  // 9. Confirm POST with invalid data
  await dual('#9 POST /confirm (invalid)', 'POST',
    '/confirm', 'u=fakeusr&o=wronghash&p=newhash&JSON=1', { noCookie: true, keysOnly: true });

  // ── /login redirect ──────────────────────────────────────────────────
  section('Login — Redirect');

  // 10. GET /login (should redirect)
  await dual('#10 GET /login', 'GET',
    '/login', null, { noCookie: true, statusOnly: true });

  // 11. POST /login — PHP renders page (200), Node redirects (302)
  await dual('#11 POST /login', 'POST',
    '/login', 'JSON=1', { noCookie: true, ignoreStatus: true, statusOnly: true });

  // ── /exit (logout) ───────────────────────────────────────────────────
  section('Exit — Logout');

  // 12. Exit with JSON — race: both delete same token from shared DB
  await dual('#12 GET /exit (JSON)', 'GET',
    '/exit?JSON=1', null, { ignoreStatus: true, statusOnly: true });

  // 13. After exit, xsrf should fail (401)
  await dual('#13 GET /xsrf (after exit)', 'GET',
    '/xsrf?JSON=1', null, { statusOnly: true });

  // ── Re-authenticate (so cleanup works) ───────────────────────────────
  section('Re-auth after exit');

  // Re-auth via PHP (shared token in lib.js won't work after exit)
  const authRes = await http(PHP, 'POST', `/${DB}/auth`, `login=${USER}&pwd=${PASS}&JSON=1`);
  if (!authRes.json?.token) {
    console.error('Re-auth failed');
    process.exit(2);
  }

  // 14. Verify re-auth works: xsrf should return 200
  const ck = `${DB}=${authRes.json.token}`;
  const [xP, xN] = await Promise.all([
    http(PHP, 'GET', `/${DB}/xsrf?JSON=1`, null, ck),
    http(NODE, 'GET', `/${DB}/xsrf?JSON=1`, null, ck),
  ]);
  const reMatch = xP.status === 200 && xN.status === 200;
  console.log(`  ${reMatch ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m'}  #14 GET /xsrf (after re-auth) — PHP=${xP.status} Node=${xN.status}`);

  // ── /exit without cookie ─────────────────────────────────────────────
  section('Exit — Edge cases');

  // 15. Exit without cookie — PHP 401 (Validate_Token), Node 200 (direct)
  await dual('#15 GET /exit (no cookie, JSON)', 'GET',
    '/exit?JSON=1', null, { noCookie: true, ignoreStatus: true, statusOnly: true });

  const s = summary();
  writeFileSync(join(dir, '32-session-exit-jwt-results.md'), generateMD('32-session-exit-jwt — Session Lifecycle'));
  writeReports('32-session-exit-jwt', join(dir, '..', 'reports'));
  console.log(`\nWrote 32-session-exit-jwt-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
