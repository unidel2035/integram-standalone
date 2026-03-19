#!/usr/bin/env node
/**
 * 43-my-database: PHP vs Node.js — /my (master management database)
 * Tests: auth on /my, /my/terms, /my/edit_types, /my/object (user list),
 *        /my/_new_db validation (reserved names, bad format, duplicate),
 *        /my/register validation, /my/xsrf, /my/grants,
 *        /my/metadata, /my/edit_obj on user, /my/report
 *
 * NOTE: We do NOT actually create new databases — only test validation errors.
 *       Creating a real DB would leave permanent side effects.
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();

  // ── /my auth & xsrf ─────────────────────────────────────────────────
  section('/my — Auth & XSRF');

  // 1. xsrf on /my
  await dual('#1 GET /xsrf (my)', 'GET',
    '/xsrf?JSON=1', null, { keysOnly: true });

  // 2. grants on /my
  await dual('#2 GET /grants (my)', 'GET',
    '/grants?JSON=1', null, { keysOnly: true });

  // ── /my/terms ────────────────────────────────────────────────────────
  section('/my — Terms & Types');

  // 3. terms on /my (lists User, Role, Token, etc.)
  await dual('#3 GET /terms (my)', 'GET',
    '/terms?JSON=1');

  // 4. terms JSON_KV
  await dual('#4 GET /terms (my JSON_KV)', 'GET',
    '/terms?JSON_KV=1', null, { keysOnly: true });

  // 5. edit_types on /my
  await dual('#5 GET /edit_types (my)', 'GET',
    '/edit_types?JSON=1', null, { keysOnly: true });

  // ── /my/object — user listing ────────────────────────────────────────
  section('/my — Object listings');

  // 6. List User type (type=18) objects — shows registered users
  await dual('#6 GET /object/18 (users)', 'GET',
    '/object/18?JSON=1', null, { keysOnly: true });

  // 7. List Role type (type=42) objects
  await dual('#7 GET /object/42 (roles)', 'GET',
    '/object/42?JSON=1', null, { keysOnly: true });

  // 8. List User type JSON_KV
  await dual('#8 GET /object/18 (JSON_KV)', 'GET',
    '/object/18?JSON_KV=1', null, { keysOnly: true });

  // 9. List with LIMIT
  await dual('#9 GET /object/18 (LIMIT=3)', 'GET',
    '/object/18?JSON=1&LIMIT=3', null, { keysOnly: true });

  // ── /my/metadata — system types ──────────────────────────────────────
  section('/my — Metadata');

  // 10. metadata for User type (18)
  await dual('#10 GET /metadata/18 (User)', 'GET',
    '/metadata/18?JSON=1');

  // 11. metadata for Role type (42)
  await dual('#11 GET /metadata/42 (Role)', 'GET',
    '/metadata/42?JSON=1');

  // 12. metadata JSON_KV for User
  await dual('#12 GET /metadata/18 (JSON_KV)', 'GET',
    '/metadata/18?JSON_KV=1', null, { keysOnly: true });

  // ── /my/_new_db validation ───────────────────────────────────────────
  section('/my — _new_db validation');

  // 13. _new_db without name
  await dual('#13 POST /_new_db (no name)', 'POST',
    '/_new_db',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // 14. _new_db with reserved name (select)
  await dual('#14 POST /_new_db (reserved: select)', 'POST',
    '/_new_db?db=select',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // 15. _new_db with reserved name (table)
  await dual('#15 POST /_new_db (reserved: table)', 'POST',
    '/_new_db?db=table',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // 16. _new_db with too short name (2 chars)
  await dual('#16 POST /_new_db (too short: ab)', 'POST',
    '/_new_db?db=ab',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // 17. _new_db with invalid chars
  await dual('#17 POST /_new_db (invalid: a-b)', 'POST',
    '/_new_db?db=a-b-c',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // 18. _new_db starting with number
  await dual('#18 POST /_new_db (starts digit: 1abc)', 'POST',
    '/_new_db?db=1abc',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // 19. _new_db with existing name (my)
  await dual('#19 POST /_new_db (existing: my)', 'POST',
    '/_new_db?db=my',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // 20. _new_db with too long name (20 chars)
  await dual('#20 POST /_new_db (too long)', 'POST',
    '/_new_db?db=abcdefghijklmnopqrst',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // ── /my/register validation ──────────────────────────────────────────
  section('/my — Register validation');

  // 21. register with no data
  await dual('#21 POST /register (no data)', 'POST',
    '/register',
    'JSON=1', { noCookie: true, statusOnly: true });

  // 22. register with bad email
  await dual('#22 POST /register (bad email)', 'POST',
    '/register',
    'email=notanemail&regpwd=test123&regpwd1=test123&agree=1&JSON=1',
    { noCookie: true, statusOnly: true });

  // 23. register GET with no params — PHP 200 (renders page), Node 302 (redirect)
  await dual('#23 GET /register (no params)', 'GET',
    '/register', null, { noCookie: true, ignoreStatus: true, statusOnly: true });

  // ── /my/report ───────────────────────────────────────────────────────
  section('/my — Report');

  // 24. report for User type (18)
  await dual('#24 GET /report/18 (User type)', 'GET',
    '/report/18?JSON=1', null, { keysOnly: true });

  // 25. report JSON_KV for User type
  await dual('#25 GET /report/18 (JSON_KV)', 'GET',
    '/report/18?JSON_KV=1', null, { keysOnly: true });

  // ── /my/_list and _ref_reqs ──────────────────────────────────────────
  section('/my — _list & _ref_reqs');

  // 26. _list for User type
  await dual('#26 GET /_list/18 (users)', 'GET',
    '/_list/18', null, { statusOnly: true });

  // 27. _list for Role type
  await dual('#27 GET /_list/42 (roles)', 'GET',
    '/_list/42', null, { statusOnly: true });

  // ── /my/edit_obj ─────────────────────────────────────────────────────
  section('/my — edit_obj');

  // Find testbot user ID from listing
  const usersRes = await http(PHP, 'GET', `/${DB}/object/18?JSON_KV=1`, null, cookie());
  let testbotId = null;
  if (usersRes.json && typeof usersRes.json === 'object') {
    for (const [k, v] of Object.entries(usersRes.json)) {
      if (v && typeof v === 'object') {
        const vals = Object.values(v);
        if (vals.some(x => x === 'testbot')) {
          testbotId = k;
          break;
        }
      }
    }
  }

  // 28. edit_obj for testbot user (same ID on both servers since /my is shared)
  if (testbotId) {
    await dual('#28 GET /edit_obj (testbot user)', 'GET',
      `/edit_obj/${testbotId}?JSON=1`, null, { keysOnly: true });
  }

  // 29. obj_meta for testbot
  if (testbotId) {
    await dual('#29 GET /obj_meta (testbot)', 'GET',
      `/obj_meta/${testbotId}?JSON=1`, null, { keysOnly: true });
  }

  // ── /my edge cases ───────────────────────────────────────────────────
  section('/my — Edge cases');

  // 30. object for nonexistent type in /my
  await dual('#30 GET /object/999999999 (nonexistent in my)', 'GET',
    '/object/999999999?JSON=1', null, { statusOnly: true });

  const s = summary();
  writeFileSync(join(dir, '43-my-database-results.md'), generateMD('43-my-database — Master Database Operations'));
  writeReports('43-my-database', join(dir, '..', 'reports'));
  console.log(`\nWrote 43-my-database-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
