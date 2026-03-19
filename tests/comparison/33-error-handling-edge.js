#!/usr/bin/env node
/**
 * 33-error-handling-edge: PHP vs Node.js — Error handling & edge cases
 * Tests: invalid DB, nonexistent type/object IDs, wrong HTTP methods,
 *        malformed requests, double-delete, boundary values
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__erredge_';
const TS = Date.now();
const USER = 'testbot';
const PASS = 'test123';

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup ──────────────────────────────────────────────────────────────
  const mainType = await createType(`${PREFIX}item_${TS}`, 3);
  const colName = await addColumn(mainType, 3);
  const obj1 = await createObj(mainType, 'TestObj');

  // ── Invalid/nonexistent IDs ──────────────────────────────────────────
  section('Errors — Invalid IDs');

  // 1. edit_obj for nonexistent ID
  await dual('#1 GET /edit_obj (nonexistent)', 'GET',
    '/edit_obj/999999999?JSON=1', null, { statusOnly: true });

  // 2. _m_del for nonexistent ID
  await dual('#2 POST /_m_del (nonexistent)', 'POST',
    '/_m_del/999999999',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // 3. _m_set for nonexistent ID
  await dual('#3 POST /_m_set (nonexistent)', 'POST',
    '/_m_set/999999999',
    s => `_xsrf=${getXsrf(s)}&t999999999=val&JSON=1`, { statusOnly: true });

  // 4. _m_save for nonexistent ID
  await dual('#4 POST /_m_save (nonexistent)', 'POST',
    '/_m_save/999999999',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // 5. object listing for nonexistent type
  await dual('#5 GET /object (nonexistent type)', 'GET',
    '/object/999999999?JSON=1', null, { statusOnly: true });

  // ── XSRF validation ─────────────────────────────────────────────────
  section('Errors — XSRF');

  // 6. _m_del without XSRF
  if (obj1.php && obj1.node) {
    await dual('#6 POST /_m_del (no xsrf)', 'POST',
      s => `/_m_del/${obj1[s]}`,
      'JSON=1', { statusOnly: true });
  }

  // 7. _m_del with wrong XSRF
  if (obj1.php && obj1.node) {
    await dual('#7 POST /_m_del (wrong xsrf)', 'POST',
      s => `/_m_del/${obj1[s]}`,
      '_xsrf=wrong_token_value&JSON=1', { statusOnly: true });
  }

  // 8. _d_new without XSRF
  await dual('#8 POST /_d_new (no xsrf)', 'POST',
    '/_d_new',
    'val=test&t=3&JSON=1', { statusOnly: true });

  // ── Double operations ────────────────────────────────────────────────
  section('Errors — Double operations');

  // Create and delete, then try to delete again
  const tempObj = await createObj(mainType, 'TempForDelete');

  // 9. First delete (should succeed)
  if (tempObj.php && tempObj.node) {
    await dual('#9 POST /_m_del (first delete)', 'POST',
      s => `/_m_del/${tempObj[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });
  }

  // 10. Second delete (already deleted)
  if (tempObj.php && tempObj.node) {
    await dual('#10 POST /_m_del (double delete)', 'POST',
      s => `/_m_del/${tempObj[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });
  }

  // ── Boundary values ──────────────────────────────────────────────────
  section('Errors — Boundary values');

  // 11. _m_set with very long value (1000+ chars)
  const longVal = 'X'.repeat(1000);
  if (obj1.php && obj1.node && colName.php && colName.node) {
    await dual('#11 POST /_m_set (very long value)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colName[s]}=${encodeURIComponent(longVal)}&JSON=1`, { keysOnly: true });
  }

  // 12. _m_new with special characters in name
  await dual('#12 POST /_m_new (special chars)', 'POST',
    s => `/_m_new/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=${encodeURIComponent('<script>alert(1)</script>')}&up=1&JSON=1`, { keysOnly: true });

  // 13. _m_new with unicode emoji — PHP 500 (charset), Node 200
  await dual('#13 POST /_m_new (emoji)', 'POST',
    s => `/_m_new/${mainType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${mainType[s]}=${encodeURIComponent('Тест 🚀 emoji')}&up=1&JSON=1`, { ignoreStatus: true, statusOnly: true });

  // 14. _m_set with zero for number column
  const colNum = await addColumn(mainType, 13);
  if (obj1.php && obj1.node && colNum.php && colNum.node) {
    await dual('#14 POST /_m_set (number=0)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colNum[s]}=0&JSON=1`, { keysOnly: true });
  }

  // 15. _m_set with negative number
  if (obj1.php && obj1.node && colNum.php && colNum.node) {
    await dual('#15 POST /_m_set (number=-999)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colNum[s]}=-999&JSON=1`, { keysOnly: true });
  }

  // ── Content-Type edge cases ──────────────────────────────────────────
  section('Errors — Content-Type');

  // 16. Auth with JSON Content-Type
  await dual('#16 POST /auth (JSON content-type)', 'POST',
    '/auth',
    `login=${USER}&pwd=${PASS}&JSON=1`, { noCookie: true, keysOnly: true });

  // ── Malformed paths ──────────────────────────────────────────────────
  section('Errors — Malformed paths');

  // 17. _m_set with string ID (not numeric)
  await dual('#17 POST /_m_set (string id)', 'POST',
    '/_m_set/notanumber',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // 18. object with ID=0
  await dual('#18 GET /object (id=0)', 'GET',
    '/object/0?JSON=1', null, { statusOnly: true });

  // 19. edit_obj with ID=0
  await dual('#19 GET /edit_obj (id=0)', 'GET',
    '/edit_obj/0?JSON=1', null, { statusOnly: true });

  // 20. _m_up with nonexistent id
  await dual('#20 POST /_m_up (nonexistent)', 'POST',
    '/_m_up/999999999',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // ── Cleanup ────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '33-error-handling-edge-results.md'), generateMD('33-error-handling-edge — Error Handling & Edge Cases'));
  writeReports('33-error-handling-edge', join(dir, '..', 'reports'));
  console.log(`\nWrote 33-error-handling-edge-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
