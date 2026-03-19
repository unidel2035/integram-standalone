#!/usr/bin/env node
/**
 * 01-auth: PHP vs Node.js — Auth & Session endpoints
 */
import { PHP, NODE, DB, USER, PASS, http, dual, setup, section, summary, generateMD, writeReports, getXsrf, cookie, results } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));

async function run() {
  await setup();
  section('Auth & Session');

  // 1. POST /auth — correct credentials
  await dual('POST /auth (correct creds)', 'POST', '/auth',
    `login=${USER}&pwd=${PASS}&JSON=1`, { noCookie: true });

  // 2. POST /auth — wrong password
  await dual('POST /auth (wrong password)', 'POST', '/auth',
    `login=${USER}&pwd=wrongpass&JSON=1`, { noCookie: true });

  // 3. POST /auth — empty fields
  await dual('POST /auth (empty fields)', 'POST', '/auth',
    `login=&pwd=&JSON=1`, { noCookie: true });

  // 4. POST /auth — missing JSON flag (redirect)
  await dual('POST /auth (redirect mode)', 'POST', '/auth',
    `login=${USER}&pwd=${PASS}`, { noCookie: true, statusOnly: true });

  // 5. GET /xsrf
  await dual('GET /xsrf', 'GET', '/xsrf?JSON=1');

  // 6. POST /getcode — non-existent user
  await dual('POST /getcode (bad user)', 'POST', '/getcode',
    `u=nonexistent_user_xyz&login=nonexistent_user_xyz&tzone=3`, { noCookie: true });

  // 7. POST /checkcode — invalid code
  await dual('POST /checkcode (invalid)', 'POST', '/checkcode',
    `u=${USER}&login=${USER}&c=999&code=000000`, { noCookie: true });

  // 8. GET /validate
  await dual('GET /validate', 'GET', '/validate?JSON=1');

  // 9. POST /jwt — empty token
  await dual('POST /jwt (empty)', 'POST', '/jwt', 'jwt=&JSON=1', { noCookie: true });

  // 10. POST /jwt — invalid token
  await dual('POST /jwt (invalid)', 'POST', '/jwt', 'jwt=not.a.valid.jwt&JSON=1', { noCookie: true });

  // 11. GET /exit
  await dual('GET /exit', 'GET', '/exit', null, { statusOnly: true });

  // 12. GET /login
  await dual('GET /login', 'GET', '/login', null, { statusOnly: true, noCookie: true });

  // 13. GET /login?u=testbot
  await dual('GET /login?u=testbot', 'GET', `/login?u=${USER}`, null, { statusOnly: true, noCookie: true });

  // 14. OPTIONS preflight
  await dual('OPTIONS /*', 'OPTIONS', '/', null, { noCookie: true, statusOnly: true });

  // 15. POST /auth — non-existent database (#427: must return 404 + plain text)
  {
    const fakeDb = 'zzznoexist427';
    const body = `login=${USER}&pwd=${PASS}&JSON=1`;
    const [php, node] = await Promise.all([
      http(PHP, 'POST', `/${fakeDb}/auth`, body),
      http(NODE, 'POST', `/${fakeDb}/auth`, body),
    ]);
    const diffs = [];
    // PHP returns 500 (empty), Node returns 404 with error msg — intentional improvement (#427)
    if (node.status !== 404) diffs.push(`Node should return 404, got ${node.status}`);
    if (node.json !== null) diffs.push('Node should return plain text, got JSON');
    if (!node.body.includes('does not exist')) diffs.push(`Node body missing "does not exist": ${node.body.slice(0, 80)}`);
    const match = diffs.length === 0;
    const icon = match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m';
    console.log(`  ${icon}  POST /auth (nonexistent db #427)${diffs.length ? '\n         ' + diffs.join('\n         ') : ''}`);
    results.push({ name: 'POST /auth (nonexistent db #427)', match, diffs, phpStatus: php.status, nodeStatus: node.status, phpBody: php.body.slice(0, 200), nodeBody: node.body.slice(0, 200) });
  }

  // Summary
  const s = summary();
  const md = generateMD('01-auth — Auth & Session');
  writeReports('01-auth', join(dir, '..', 'reports'));
  writeFileSync(join(dir, '01-auth-results.md'), md);
  console.log(`\nWrote 01-auth-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
