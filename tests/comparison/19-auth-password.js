#!/usr/bin/env node
/**
 * 19-auth-password: PHP vs Node.js — Authentication & password flow
 * Tests: auth (login), getcode (OTP request), checkcode (OTP verify),
 *        validate (token check), xsrf, edge cases (wrong creds, expired, etc.)
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();

  // ── Auth: valid login ────────────────────────────────────────────────────
  section('Auth — Valid Login');

  // 1. POST /auth with correct credentials (JSON mode)
  await dual('#1 POST /auth (valid login)', 'POST',
    '/auth',
    `login=testbot&pwd=test123&JSON=1`, { keysOnly: true });

  // 2. POST /auth with JSON=1 — check response structure
  await dual('#2 POST /auth (response keys)', 'POST',
    '/auth',
    `login=testbot&pwd=test123&JSON=1`, { keysOnly: true });

  // ── Auth: invalid login ──────────────────────────────────────────────────
  section('Auth — Invalid Login');

  // 3. Wrong password
  await dual('#3 POST /auth (wrong password)', 'POST',
    '/auth',
    `login=testbot&pwd=WRONG_PASSWORD&JSON=1`, { statusOnly: true });

  // 4. Non-existent user
  await dual('#4 POST /auth (nonexistent user)', 'POST',
    '/auth',
    `login=nonexistent_user_12345&pwd=test123&JSON=1`, { statusOnly: true });

  // 5. Empty login
  await dual('#5 POST /auth (empty login)', 'POST',
    '/auth',
    `login=&pwd=test123&JSON=1`, { statusOnly: true });

  // 6. Empty password
  await dual('#6 POST /auth (empty password)', 'POST',
    '/auth',
    `login=testbot&pwd=&JSON=1`, { statusOnly: true });

  // ── XSRF ─────────────────────────────────────────────────────────────────
  section('Auth — XSRF');

  // 7. GET /xsrf with valid token
  await dual('#7 GET /xsrf (valid token)', 'GET',
    '/xsrf?JSON=1', null, { keysOnly: true });

  // 8. GET /xsrf without cookie — PHP returns 401, Node should match
  await dual('#8 GET /xsrf (no cookie)', 'GET',
    '/xsrf?JSON=1', null, { noCookie: true, statusOnly: true });

  // 9. GET /xsrf with invalid token
  await dual('#9 GET /xsrf (invalid token)', 'GET',
    '/xsrf?JSON=1', null, { noCookie: true, statusOnly: true });

  // ── Validate ─────────────────────────────────────────────────────────────
  section('Auth — Validate');

  // 10. GET /validate with valid token
  await dual('#10 GET /validate (valid token)', 'GET',
    '/validate?JSON=1');

  // 11. GET /validate without cookie — PHP returns 401
  await dual('#11 GET /validate (no cookie)', 'GET',
    '/validate?JSON=1', null, { noCookie: true, statusOnly: true });

  // ── GetCode / CheckCode ──────────────────────────────────────────────────
  section('Auth — GetCode / CheckCode');

  // 12. POST /getcode with invalid email
  await dual('#12 POST /getcode (invalid email)', 'POST',
    '/getcode',
    'u=not_an_email&JSON=1', { noCookie: true });

  // 13. POST /getcode with empty user
  await dual('#13 POST /getcode (empty user)', 'POST',
    '/getcode',
    'u=&JSON=1', { noCookie: true });

  // 14. POST /getcode with valid format but non-existent user
  await dual('#14 POST /getcode (nonexistent email)', 'POST',
    '/getcode',
    'u=nobody@nonexistent.test&JSON=1', { noCookie: true });

  // 15. POST /checkcode with invalid data
  await dual('#15 POST /checkcode (invalid data)', 'POST',
    '/checkcode',
    'u=&c=&JSON=1', { noCookie: true });

  // 16. POST /checkcode with wrong code
  await dual('#16 POST /checkcode (wrong code)', 'POST',
    '/checkcode',
    'u=testbot@test.com&c=ZZZZ&JSON=1', { noCookie: true });

  // 17. POST /checkcode with short code
  await dual('#17 POST /checkcode (short code)', 'POST',
    '/checkcode',
    'u=testbot@test.com&c=AB&JSON=1', { noCookie: true });

  // ── Auth with JSON body ──────────────────────────────────────────────────
  section('Auth — JSON body');

  // 18. POST /auth with JSON content-type body
  {
    const body = JSON.stringify({ login: 'testbot', pwd: 'test123', JSON: '1' });
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP, 'POST', `/${DB}/auth`, body, null, { 'Content-Type': 'application/json' }),
      http(NODE, 'POST', `/${DB}/auth`, body, null, { 'Content-Type': 'application/json' }),
    ]);
    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    const phpHasToken = phpRes.json?.token;
    const nodeHasToken = nodeRes.json?.token;
    if (!!phpHasToken !== !!nodeHasToken) diffs.push(`token: PHP=${!!phpHasToken} Node=${!!nodeHasToken}`);
    const match = diffs.length === 0;
    console.log(`  ${match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m'}  #18 POST /auth (JSON body)`);
    if (!match) diffs.forEach(d => console.log(`    → ${d}`));
  }

  // ── XSRF validation ─────────────────────────────────────────────────────
  section('Auth — XSRF Validation');

  // 19. POST _m_new without XSRF (should fail)
  await dual('#19 POST /_m_new (no XSRF)', 'POST',
    '/_m_new/1',
    `t3=TestNoXsrf&up=1&JSON=1`, { statusOnly: true });

  // 20. POST _m_new with wrong XSRF
  await dual('#20 POST /_m_new (wrong XSRF)', 'POST',
    '/_m_new/1',
    `_xsrf=WRONG_XSRF_VALUE&t3=TestWrongXsrf&up=1&JSON=1`, { statusOnly: true });

  // ── Grants endpoint ──────────────────────────────────────────────────────
  section('Auth — Grants');

  // 21. GET /grants
  await dual('#21 GET /grants', 'GET',
    '/grants?JSON=1', null, { keysOnly: true });

  // 22. POST /check_grant
  await dual('#22 POST /check_grant', 'POST',
    '/check_grant',
    `_xsrf=${getXsrf('php')}&JSON=1`, { statusOnly: true });

  const s = summary();
  writeFileSync(join(dir, '19-auth-password-results.md'), generateMD('19-auth-password — Authentication & Password Flow'));
  writeReports('19-auth-password', join(dir, '..', 'reports'));
  console.log(`\nWrote 19-auth-password-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
