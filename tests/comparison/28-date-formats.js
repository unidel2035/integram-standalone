#!/usr/bin/env node
/**
 * 28-date-formats: PHP vs Node.js — Date/time value handling
 * Tests: ISO dates, Russian DD.MM.YYYY, slash-separated, time components,
 *        empty dates, epoch-like values, date in listing/edit_obj
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__datefmt_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup ──────────────────────────────────────────────────────────────
  const mainType = await createType(`${PREFIX}evt_${TS}`, 3);
  const colName = await addColumn(mainType, 3);    // SHORT
  const colDate = await addColumn(mainType, 4);     // DATETIME
  const colNum = await addColumn(mainType, 13);     // NUMBER (for comparison)

  // Create objects for each date test
  const obj1 = await createObj(mainType, 'ISO_full');
  const obj2 = await createObj(mainType, 'ISO_date_only');
  const obj3 = await createObj(mainType, 'ISO_T_separator');
  const obj4 = await createObj(mainType, 'Slash_date');
  const obj5 = await createObj(mainType, 'Dot_date');
  const obj6 = await createObj(mainType, 'Empty_date');
  const obj7 = await createObj(mainType, 'Midnight');

  // ── ISO format dates ───────────────────────────────────────────────────
  section('Date Formats — ISO');

  // 1. Full ISO: YYYY-MM-DD HH:MM:SS
  if (obj1.php && obj1.node && colDate.php && colDate.node) {
    await dual('#1 POST /_m_set (ISO full)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colDate[s]}=${encodeURIComponent('2025-06-15 14:30:45')}&JSON=1`, { keysOnly: true });
  }

  // 2. Date only: YYYY-MM-DD
  if (obj2.php && obj2.node && colDate.php && colDate.node) {
    await dual('#2 POST /_m_set (ISO date only)', 'POST',
      s => `/_m_set/${obj2[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colDate[s]}=${encodeURIComponent('2025-12-31')}&JSON=1`, { keysOnly: true });
  }

  // 3. ISO with T separator: YYYY-MM-DDTHH:MM:SS
  if (obj3.php && obj3.node && colDate.php && colDate.node) {
    await dual('#3 POST /_m_set (ISO T separator)', 'POST',
      s => `/_m_set/${obj3[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colDate[s]}=${encodeURIComponent('2025-01-01T00:00:00')}&JSON=1`, { keysOnly: true });
  }

  // ── Alternative separators ─────────────────────────────────────────────
  section('Date Formats — Alternative separators');

  // 4. Slash: YYYY/MM/DD
  if (obj4.php && obj4.node && colDate.php && colDate.node) {
    await dual('#4 POST /_m_set (slash date)', 'POST',
      s => `/_m_set/${obj4[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colDate[s]}=${encodeURIComponent('2025/03/16')}&JSON=1`, { keysOnly: true });
  }

  // 5. Dot: DD.MM.YYYY (Russian format)
  if (obj5.php && obj5.node && colDate.php && colDate.node) {
    await dual('#5 POST /_m_set (dot date RU)', 'POST',
      s => `/_m_set/${obj5[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colDate[s]}=${encodeURIComponent('16.03.2025')}&JSON=1`, { keysOnly: true });
  }

  // ── Edge cases ─────────────────────────────────────────────────────────
  section('Date Formats — Edge Cases');

  // 6. Empty date
  if (obj6.php && obj6.node && colDate.php && colDate.node) {
    await dual('#6 POST /_m_set (empty date)', 'POST',
      s => `/_m_set/${obj6[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colDate[s]}=&JSON=1`, { keysOnly: true });
  }

  // 7. Midnight: YYYY-MM-DD 00:00:00
  if (obj7.php && obj7.node && colDate.php && colDate.node) {
    await dual('#7 POST /_m_set (midnight)', 'POST',
      s => `/_m_set/${obj7[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colDate[s]}=${encodeURIComponent('2025-07-04 00:00:00')}&JSON=1`, { keysOnly: true });
  }

  // ── Verify dates in edit_obj ───────────────────────────────────────────
  section('Date Formats — Verify via edit_obj');

  // 8. Check ISO full date stored correctly
  if (obj1.php && obj1.node) {
    await dual('#8 GET /edit_obj (ISO full)', 'GET',
      s => `/edit_obj/${obj1[s]}?JSON=1`, null, { keysOnly: true });
  }

  // 9. Check date-only stored
  if (obj2.php && obj2.node) {
    await dual('#9 GET /edit_obj (date only)', 'GET',
      s => `/edit_obj/${obj2[s]}?JSON=1`, null, { keysOnly: true });
  }

  // 10. Check dot-date stored
  if (obj5.php && obj5.node) {
    await dual('#10 GET /edit_obj (dot date)', 'GET',
      s => `/edit_obj/${obj5[s]}?JSON=1`, null, { keysOnly: true });
  }

  // ── Verify in listing ──────────────────────────────────────────────────
  section('Date Formats — Listing');

  // 11. Full listing shows dates
  await dual('#11 GET /object (listing with dates)', 'GET',
    s => `/object/${mainType[s]}?JSON=1`);

  // 12. JSON_KV format with dates
  await dual('#12 GET /object (JSON_KV with dates)', 'GET',
    s => `/object/${mainType[s]}?JSON_KV=1`, null, { keysOnly: true });

  // ── Update date ────────────────────────────────────────────────────────
  section('Date Formats — Update');

  // 13. Update ISO full to new value
  if (obj1.php && obj1.node && colDate.php && colDate.node) {
    await dual('#13 POST /_m_set (update date)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colDate[s]}=${encodeURIComponent('2026-01-01 12:00:00')}&JSON=1`, { keysOnly: true });
  }

  // 14. Clear date (set to empty)
  if (obj1.php && obj1.node && colDate.php && colDate.node) {
    await dual('#14 POST /_m_set (clear date)', 'POST',
      s => `/_m_set/${obj1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colDate[s]}=&JSON=1`, { keysOnly: true });
  }

  // ── Cleanup ────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '28-date-formats-results.md'), generateMD('28-date-formats — Date/Time Value Handling'));
  writeReports('28-date-formats', join(dir, '..', 'reports'));
  console.log(`\nWrote 28-date-formats-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
