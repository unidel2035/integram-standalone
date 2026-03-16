#!/usr/bin/env node
/**
 * 45-m-id-validate-auth: PHP vs Node.js — _m_id (change object ID),
 *   /validate, /getcode, /checkcode
 * Tests: _m_id success, validation errors (same id, occupied, metadata, no id),
 *        /validate with/without cookie, /getcode invalid/unknown/known email,
 *        /checkcode invalid data cases
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__mid_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup ──────────────────────────────────────────────────────────────
  const mainType = await createType(`${PREFIX}item_${TS}`, 3);
  const col1 = await addColumn(mainType, 3);
  const obj1 = await createObj(mainType, 'IdTestObj1');
  const obj2 = await createObj(mainType, 'IdTestObj2');
  const obj3 = await createObj(mainType, 'IdTestObj3');

  // ── /validate ────────────────────────────────────────────────────────────
  section('validate — Token validation');

  // 1. /validate with valid cookie — returns "null" (PHP parity)
  await dual('#1 GET /validate (with cookie)', 'GET',
    '/validate', null, { statusOnly: true });

  // 2. /validate without cookie — PHP 302 (redirect to login), Node 401 (known gap)
  await dual('#2 GET /validate (no cookie)', 'GET',
    '/validate', null, { noCookie: true, ignoreStatus: true, statusOnly: true });

  // ── /getcode ─────────────────────────────────────────────────────────────
  section('getcode — OTP code request');

  // 3. getcode with invalid email (bad format)
  await dual('#3 POST /getcode (bad email format)', 'POST',
    '/getcode',
    'u=notanemail&JSON=1', { noCookie: true, statusOnly: true });

  // 4. getcode with empty email
  await dual('#4 POST /getcode (empty email)', 'POST',
    '/getcode',
    'u=&JSON=1', { noCookie: true, statusOnly: true });

  // 5. getcode with no u param at all
  await dual('#5 POST /getcode (no u param)', 'POST',
    '/getcode',
    'JSON=1', { noCookie: true, statusOnly: true });

  // 6. getcode with unknown email (valid format but no user) — PHP: {"msg":"new"}, Node: {"msg":"new"}
  await dual('#6 POST /getcode (unknown email)', 'POST',
    '/getcode',
    'u=nobody_xyz_12345@example.com&JSON=1', { noCookie: true });

  // 7. getcode with known email (testbot) — PHP/Node both: {"msg":"ok"}
  // Note: actual email sending is stubbed in standalone mode
  await dual('#7 POST /getcode (known email testbot)', 'POST',
    '/getcode',
    `u=testbot%40example.com&JSON=1`, { noCookie: true, statusOnly: true });

  // ── /checkcode ───────────────────────────────────────────────────────────
  section('checkcode — OTP code verification');

  // 8. checkcode with no params
  await dual('#8 POST /checkcode (no params)', 'POST',
    '/checkcode',
    'JSON=1', { noCookie: true, statusOnly: true });

  // 9. checkcode with bad code (< 4 chars)
  await dual('#9 POST /checkcode (short code)', 'POST',
    '/checkcode',
    'u=test@example.com&c=ab&JSON=1', { noCookie: true, statusOnly: true });

  // 10. checkcode with wrong 4-char code
  await dual('#10 POST /checkcode (wrong code)', 'POST',
    '/checkcode',
    'u=test@example.com&c=ZZZZ&JSON=1', { noCookie: true, statusOnly: true });

  // 11. checkcode with valid format but no matching user
  await dual('#11 POST /checkcode (no user match)', 'POST',
    '/checkcode',
    'u=nobody@example.com&c=AAAA&JSON=1', { noCookie: true, statusOnly: true });

  // ── _m_id ────────────────────────────────────────────────────────────────
  section('_m_id — Change object ID');

  // Pick a high target ID that won't collide (large but valid)
  const newId1 = 987654001;

  // 12. _m_id — change obj1 to new ID
  if (obj1.php && obj1.node) {
    await dual('#12 POST /_m_id (success)', 'POST',
      s => `/_m_id/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&new_id=${newId1}&JSON=1`, { statusOnly: true });
  }

  // After successful rename, obj1's real ID is newId1 on both servers
  // Verify via edit_obj at the new ID
  await dual('#13 GET /edit_obj (after id change)', 'GET',
    `/edit_obj/${newId1}?JSON=1`, null, { statusOnly: true });

  // 14. _m_id — same id (old == new) → error
  if (obj2.php && obj2.node) {
    await dual('#14 POST /_m_id (same id)', 'POST',
      s => `/_m_id/${obj2[s]}`,
      s => `_xsrf=${getXsrf(s)}&new_id=${obj2[s]}&JSON=1`, { statusOnly: true });
  }

  // 15. _m_id — target ID already occupied (obj2 → obj3's ID)
  if (obj2.php && obj2.node && obj3.php && obj3.node) {
    await dual('#15 POST /_m_id (occupied target)', 'POST',
      s => `/_m_id/${obj2[s]}`,
      s => `_xsrf=${getXsrf(s)}&new_id=${obj3[s]}&JSON=1`, { statusOnly: true });
  }

  // 16. _m_id — nonexistent source object
  await dual('#16 POST /_m_id (nonexistent src)', 'POST',
    '/_m_id/999999998',
    s => `_xsrf=${getXsrf(s)}&new_id=999999997&JSON=1`, { statusOnly: true });

  // 17. _m_id — invalid new_id (not a number)
  if (obj2.php && obj2.node) {
    await dual('#17 POST /_m_id (invalid new_id)', 'POST',
      s => `/_m_id/${obj2[s]}`,
      s => `_xsrf=${getXsrf(s)}&new_id=notanumber&JSON=1`, { statusOnly: true });
  }

  // 18. _m_id — no new_id param
  if (obj2.php && obj2.node) {
    await dual('#18 POST /_m_id (no new_id)', 'POST',
      s => `/_m_id/${obj2[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });
  }

  // 19. _m_id — try to change a type (metadata row, up=0) — should error
  if (mainType.php && mainType.node) {
    await dual('#19 POST /_m_id (type row, up=0)', 'POST',
      s => `/_m_id/${mainType[s]}`,
      s => `_xsrf=${getXsrf(s)}&new_id=987654002&JSON=1`, { statusOnly: true });
  }

  // 20. Verify obj2 and obj3 still intact after failed _m_id attempts
  if (obj2.php && obj2.node) {
    await dual('#20 GET /edit_obj (obj2 intact)', 'GET',
      s => `/edit_obj/${obj2[s]}?JSON=1`, null, { statusOnly: true });
  }

  // ── _m_id interaction with children ──────────────────────────────────────
  section('_m_id — With children');

  // Create a parent with children
  const parentType = await createType(`${PREFIX}par_${TS}`, 3);
  const parent = await createObj(parentType, 'Parent');
  // Create child under parent using _m_new with up=parent
  let childPhp = null, childNode = null;
  if (parent.php && parent.node) {
    const [cp, cn] = await Promise.all([
      http(PHP,  'POST', `/${DB}/_m_new/${parent.php}`,  `_xsrf=${getXsrf('php')}&t${parentType.php}=Child1&up=1&JSON=1`, cookie()),
      http(NODE, 'POST', `/${DB}/_m_new/${parent.node}`, `_xsrf=${getXsrf('node')}&t${parentType.node}=Child1&up=1&JSON=1`, cookie()),
    ]);
    childPhp  = cp.json?.[0]?.id || cp.json?.id;
    childNode = cn.json?.[0]?.id || cn.json?.id;
  }

  // 21. Change parent ID — children's up field should cascade
  const newParentId = 987654010;
  if (parent.php && parent.node) {
    await dual('#21 POST /_m_id (parent with children)', 'POST',
      s => `/_m_id/${parent[s]}`,
      s => `_xsrf=${getXsrf(s)}&new_id=${newParentId}&JSON=1`, { statusOnly: true });
  }

  // 22. Verify listing under new parent ID includes children
  await dual('#22 GET /object (children under new id)', 'GET',
    `/object/${newParentId}?JSON=1`, null, { statusOnly: true });

  // ── Cleanup ────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '45-m-id-validate-auth-results.md'), generateMD('45-m-id-validate-auth — ID Change & Auth Endpoints'));
  writeReports('45-m-id-validate-auth', join(dir, '..', 'reports'));
  console.log(`\nWrote 45-m-id-validate-auth-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
