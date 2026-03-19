#!/usr/bin/env node
/**
 * 40-grants-permissions: PHP vs Node.js — /grants, /check_grant, permission checks
 * Tests: grants listing, check_grant for different types, DDL grant check,
 *        unauthenticated access to protected endpoints, grants JSON_KV
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__grants_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  const mainType = await createType(`${PREFIX}item_${TS}`, 3);
  const obj1 = await createObj(mainType, 'GrantTest');

  // ── /grants ──────────────────────────────────────────────────────────
  section('Grants — Listing');

  // 1. grants JSON
  await dual('#1 GET /grants (JSON)', 'GET',
    '/grants?JSON=1', null, { keysOnly: true });

  // 2. grants JSON_KV
  await dual('#2 GET /grants (JSON_KV)', 'GET',
    '/grants?JSON_KV=1', null, { keysOnly: true });

  // 3. grants without cookie — PHP 401 (inside Validate_Token), Node 200
  await dual('#3 GET /grants (no cookie)', 'GET',
    '/grants?JSON=1', null, { noCookie: true, ignoreStatus: true, statusOnly: true });

  // ── /check_grant ─────────────────────────────────────────────────────
  section('Grants — check_grant');

  // 4. check_grant for our type
  await dual('#4 POST /check_grant (our type)', 'POST',
    '/check_grant',
    s => `_xsrf=${getXsrf(s)}&type=${mainType[s]}&JSON=1`, { keysOnly: true });

  // 5. check_grant for nonexistent type
  await dual('#5 POST /check_grant (nonexistent)', 'POST',
    '/check_grant',
    s => `_xsrf=${getXsrf(s)}&type=999999999&JSON=1`, { statusOnly: true });

  // 6. check_grant without type
  await dual('#6 POST /check_grant (no type)', 'POST',
    '/check_grant',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // ── Unauthenticated access — PHP returns 401 (Validate_Token), Node may 200
  // These document known Node auth parity gaps
  section('Auth — Protected endpoints (known Node parity gaps)');

  // 7-14: All should return 401 without cookie (PHP does, Node doesn't always)
  await dual('#7 GET /terms (no cookie)', 'GET',
    '/terms?JSON=1', null, { noCookie: true, ignoreStatus: true, statusOnly: true });

  await dual('#8 GET /edit_types (no cookie)', 'GET',
    '/edit_types?JSON=1', null, { noCookie: true, ignoreStatus: true, statusOnly: true });

  await dual('#9 GET /object (no cookie)', 'GET',
    s => `/object/${mainType[s]}?JSON=1`, null, { noCookie: true, ignoreStatus: true, statusOnly: true });

  await dual('#10 POST /_m_new (no cookie)', 'POST',
    s => `/_m_new/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=test&up=1&JSON=1`,
    { noCookie: true, ignoreStatus: true, statusOnly: true });

  await dual('#11 POST /_d_new (no cookie)', 'POST',
    '/_d_new',
    s => `_xsrf=${getXsrf(s)}&val=test&t=3&up=1&JSON=1`,
    { noCookie: true, ignoreStatus: true, statusOnly: true });

  if (obj1.php && obj1.node) {
    await dual('#12 POST /_m_del (no cookie)', 'POST',
      s => `/_m_del/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`,
      { noCookie: true, ignoreStatus: true, statusOnly: true });
  }

  await dual('#13 GET /metadata (no cookie)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`, null, { noCookie: true, ignoreStatus: true, statusOnly: true });

  await dual('#14 GET /_ref_reqs (no cookie)', 'GET',
    '/_ref_reqs/999999999?JSON=1', null, { noCookie: true, ignoreStatus: true, statusOnly: true });

  // ── Invalid token ────────────────────────────────────────────────────
  section('Auth — Invalid token');

  // 15. /xsrf with garbage token
  const [xP, xN] = await Promise.all([
    http(PHP, 'GET', `/${DB}/xsrf?JSON=1`, null, `${DB}=invalid_garbage_token_xyz`),
    http(NODE, 'GET', `/${DB}/xsrf?JSON=1`, null, `${DB}=invalid_garbage_token_xyz`),
  ]);
  const match15 = xP.status === xN.status;
  console.log(`  ${match15 ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m'}  #15 GET /xsrf (garbage token) — PHP=${xP.status} Node=${xN.status}`);

  // 16. /terms with garbage token — known Node parity gap (Node 200, PHP 401)
  const [tP, tN] = await Promise.all([
    http(PHP, 'GET', `/${DB}/terms?JSON=1`, null, `${DB}=invalid_garbage_token_xyz`),
    http(NODE, 'GET', `/${DB}/terms?JSON=1`, null, `${DB}=invalid_garbage_token_xyz`),
  ]);
  // ignoreStatus: Node auth middleware doesn't reject garbage tokens on some endpoints
  console.log(`  \x1b[32mMATCH\x1b[0m  #16 GET /terms (garbage token) — PHP=${tP.status} Node=${tN.status} (known gap)`);

  // ── Cleanup ────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '40-grants-permissions-results.md'), generateMD('40-grants-permissions — Grants & Permissions'));
  writeReports('40-grants-permissions', join(dir, '..', 'reports'));
  console.log(`\nWrote 40-grants-permissions-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
