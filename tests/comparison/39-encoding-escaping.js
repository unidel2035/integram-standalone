#!/usr/bin/env node
/**
 * 39-encoding-escaping: PHP vs Node.js — Unicode, HTML escaping, URL encoding
 * Tests: Cyrillic values, HTML entities in values, URL-encoded special chars,
 *        mixed encoding in listing/edit_obj, _d_alias with Cyrillic,
 *        search with Cyrillic, type names with special chars
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__encesc_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup ──────────────────────────────────────────────────────────
  const mainType = await createType(`${PREFIX}тест_${TS}`, 3);
  const colName = await addColumn(mainType, 3);
  const colNum = await addColumn(mainType, 13);

  // ── Cyrillic object names ────────────────────────────────────────────
  section('Encoding — Cyrillic');

  // 1. Create with full Cyrillic name
  const obj1 = await createObj(mainType, 'Привет_Мир');

  // 2. Create with mixed Cyrillic + Latin
  const obj2 = await createObj(mainType, 'Test_Тест_123');

  // 3. Verify in edit_obj
  if (obj1.php && obj1.node) {
    await dual('#3 GET /edit_obj (Cyrillic name)', 'GET',
      s => `/edit_obj/${obj1[s]}?JSON=1`, null, { keysOnly: true });
  }

  // 4. Verify mixed in edit_obj
  if (obj2.php && obj2.node) {
    await dual('#4 GET /edit_obj (mixed name)', 'GET',
      s => `/edit_obj/${obj2[s]}?JSON=1`, null, { keysOnly: true });
  }

  // ── HTML entities ────────────────────────────────────────────────────
  section('Encoding — HTML entities');

  // 5. Set value with &amp; &lt; &gt;
  const obj3 = await createObj(mainType, 'A&B<C>D');

  // 6. Verify HTML entities preserved/escaped
  if (obj3.php && obj3.node) {
    await dual('#6 GET /edit_obj (HTML entities)', 'GET',
      s => `/edit_obj/${obj3[s]}?JSON=1`, null, { keysOnly: true });
  }

  // 7. Set field with double quotes
  if (obj3.php && obj3.node && colName.php && colName.node) {
    await dual('#7 POST /_m_set (double quotes)', 'POST',
      s => `/_m_set/${obj3[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colName[s]}=${encodeURIComponent('Value with "quotes"')}&JSON=1`, { keysOnly: true });
  }

  // 8. Verify quoted value in edit_obj
  if (obj3.php && obj3.node) {
    await dual('#8 GET /edit_obj (after quotes set)', 'GET',
      s => `/edit_obj/${obj3[s]}?JSON=1`, null, { keysOnly: true });
  }

  // ── URL encoding edge cases ──────────────────────────────────────────
  section('Encoding — URL special chars');

  // 9. Create with + (plus sign, space in URL encoding)
  const obj4 = await createObj(mainType, 'A+B=C');

  // 10. Verify plus sign
  if (obj4.php && obj4.node) {
    await dual('#10 GET /edit_obj (plus sign)', 'GET',
      s => `/edit_obj/${obj4[s]}?JSON=1`, null, { keysOnly: true });
  }

  // 11. Create with percent-encoded chars
  const obj5 = await createObj(mainType, '100%_done');

  // 12. Verify percent
  if (obj5.php && obj5.node) {
    await dual('#12 GET /edit_obj (percent)', 'GET',
      s => `/edit_obj/${obj5[s]}?JSON=1`, null, { keysOnly: true });
  }

  // ── _d_alias with Cyrillic ──────────────────────────────────────────
  section('Encoding — Column alias');

  // 13. Set Cyrillic alias
  if (colName.php && colName.node) {
    await dual('#13 POST /_d_alias (Cyrillic alias)', 'POST',
      s => `/_d_alias/${colName[s]}`,
      s => `_xsrf=${getXsrf(s)}&val=${encodeURIComponent('Название')}&JSON=1`, { keysOnly: true });
  }

  // 14. Verify alias in metadata
  await dual('#14 GET /metadata (after Cyrillic alias)', 'GET',
    s => `/metadata/${mainType[s]}?JSON=1`);

  // ── Listing with mixed encoding ──────────────────────────────────────
  section('Listing — Mixed encoding');

  // 15. JSON listing — shared DB may have slightly different HTML block counts
  await dual('#15 GET /object (JSON listing)', 'GET',
    s => `/object/${mainType[s]}?JSON=1`, null, { keysOnly: true });

  // 16. JSON_KV listing
  await dual('#16 GET /object (JSON_KV listing)', 'GET',
    s => `/object/${mainType[s]}?JSON_KV=1`, null, { keysOnly: true });

  // ── Type with Cyrillic name ──────────────────────────────────────────
  section('Encoding — Type name');

  // 17. Verify type appears in terms
  await dual('#17 GET /terms (has Cyrillic type)', 'GET',
    '/terms?JSON=1');

  // ── Search with Cyrillic ─────────────────────────────────────────────
  section('Encoding — Search');

  // 18. _list with Cyrillic search
  await dual('#18 GET /_list (q=Привет)', 'GET',
    s => `/_list/${mainType[s]}?q=${encodeURIComponent('Привет')}`, null, { statusOnly: true });

  // 19. _list with Latin search
  await dual('#19 GET /_list (q=Test)', 'GET',
    s => `/_list/${mainType[s]}?q=Test`, null, { statusOnly: true });

  // 20. _list with no results
  await dual('#20 GET /_list (q=ZZZZZZZ)', 'GET',
    s => `/_list/${mainType[s]}?q=ZZZZZZZ`, null, { statusOnly: true });

  // ── Cleanup ────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '39-encoding-escaping-results.md'), generateMD('39-encoding-escaping — Unicode & HTML Escaping'));
  writeReports('39-encoding-escaping', join(dir, '..', 'reports'));
  console.log(`\nWrote 39-encoding-escaping-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
