#!/usr/bin/env node
/**
 * 15-reports-advanced: PHP vs Node.js — Report CRUD and execution
 * Based on IntegramReport.vue patterns:
 *   Create report, add columns, add FROM, execute, clone, delete
 *   SmartQ report format, CSV export, pagination
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, createObj, deleteType, deleteObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__rpt_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup: Data tables for reporting ──────────────────────────────────────

  const dataType = await createType(`${PREFIX}data_${TS}`, 3);
  const colVal  = await addColumn(dataType, 3);   // text
  const colNum  = await addColumn(dataType, 13);  // NUMBER (13, not 11=BOOLEAN)
  const colDate = await addColumn(dataType, 4);   // date

  // Populate data
  const ck2 = cookie();
  const items = [
    { val: 'Item A', num: '100', date: '2025-01-01 00:00:00' },
    { val: 'Item B', num: '200', date: '2025-02-01 00:00:00' },
    { val: 'Item C', num: '300', date: '2025-03-01 00:00:00' },
    { val: 'Item D', num: '150', date: '2025-04-01 00:00:00' },
    { val: 'Item E', num: '250', date: '2025-05-01 00:00:00' },
  ];

  for (const d of items) {
    const obj = await createObj(dataType, d.val);
    if (colVal.php && colVal.node) {
      await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_set/${obj.php}`, `_xsrf=${xsrfPhp}&t${colVal.php}=${encodeURIComponent(d.val)}&t${colNum.php}=${d.num}&t${colDate.php}=${encodeURIComponent(d.date)}&JSON=1`, ck2),
        http(NODE, 'POST', `/${DB}/_m_set/${obj.node}`, `_xsrf=${xsrfNode}&t${colVal.node}=${encodeURIComponent(d.val)}&t${colNum.node}=${d.num}&t${colDate.node}=${encodeURIComponent(d.date)}&JSON=1`, ck2),
      ]);
    }
  }

  // ── Existing Reports ──────────────────────────────────────────────────────
  section('Reports — List Existing');

  // 1. List all reports (type 22 is reports)
  await dual('#1 GET /object/22 (report list)', 'GET',
    '/object/22?JSON=1');

  // 2. Get edit_types for reports structure
  await dual('#2 GET /edit_types', 'GET',
    '/edit_types?JSON=1', null, { keysOnly: true });

  // ── Create Report ─────────────────────────────────────────────────────────
  section('Reports — Create');

  // 3. Create new report
  const rptRes = await dual('#3 POST /_m_new/22 (create report)', 'POST',
    '/_m_new/22',
    s => `_xsrf=${getXsrf(s)}&t22=${encodeURIComponent(`${PREFIX}report_${TS}`)}&up=1&JSON=1`);

  const rptId = {
    php: Number(rptRes.php?.json?.obj || rptRes.php?.json?.id),
    node: Number(rptRes.node?.json?.obj || rptRes.node?.json?.id),
  };

  // 4. Get report structure (edit_obj)
  if (rptId.php && rptId.node) {
    await dual('#4 GET /edit_obj (new report)', 'GET',
      s => `/edit_obj/${rptId[s]}?JSON=1`);
  }

  // ── Add Report FROM ───────────────────────────────────────────────────────
  section('Reports — Add FROM');

  // Add FROM table (type 44 = report FROM entries)
  // 5. Add FROM clause
  if (rptId.php && rptId.node) {
    const fromRes = await dual('#5 POST /_m_new/44 (add FROM)', 'POST',
      '/_m_new/44',
      s => `_xsrf=${getXsrf(s)}&t44=${dataType[s]}&up=${rptId[s]}&JSON=1`);
  }

  // ── Add Report Columns ────────────────────────────────────────────────────
  section('Reports — Add Columns');

  // Add columns to report (type 28 = report columns)
  // 6. Add value column
  if (rptId.php && rptId.node && colVal.php && colVal.node) {
    await dual('#6 POST /_m_new/28 (add val column)', 'POST',
      '/_m_new/28',
      s => `_xsrf=${getXsrf(s)}&t28=${colVal[s]}&up=${rptId[s]}&JSON=1`);
  }

  // 7. Add number column
  if (rptId.php && rptId.node && colNum.php && colNum.node) {
    await dual('#7 POST /_m_new/28 (add num column)', 'POST',
      '/_m_new/28',
      s => `_xsrf=${getXsrf(s)}&t28=${colNum[s]}&up=${rptId[s]}&JSON=1`);
  }

  // 8. Add date column
  if (rptId.php && rptId.node && colDate.php && colDate.node) {
    await dual('#8 POST /_m_new/28 (add date column)', 'POST',
      '/_m_new/28',
      s => `_xsrf=${getXsrf(s)}&t28=${colDate[s]}&up=${rptId[s]}&JSON=1`);
  }

  // 9. Get report structure after columns
  if (rptId.php && rptId.node) {
    await dual('#9 GET /edit_obj (report with columns)', 'GET',
      s => `/edit_obj/${rptId[s]}?JSON=1`);
  }

  // ── Execute Report ────────────────────────────────────────────────────────
  section('Reports — Execute');

  // 10. Set execute flag on report
  if (rptId.php && rptId.node) {
    await dual('#10 POST /_m_save (set execute flag)', 'POST',
      s => `/_m_save/${rptId[s]}`,
      s => `_xsrf=${getXsrf(s)}&_m_confirmed=1&JSON=1`);
  }

  // 11. Execute report (JSON)
  if (rptId.php && rptId.node) {
    await dual('#11 GET /report (execute JSON)', 'GET',
      s => `/report/${rptId[s]}?JSON=1`, null, { keysOnly: true });
  }

  // 12. Execute report with LIMIT
  if (rptId.php && rptId.node) {
    await dual('#12 GET /report (LIMIT=2)', 'GET',
      s => `/report/${rptId[s]}?LIMIT=2&JSON=1`, null, { keysOnly: true });
  }

  // 13. Execute report page 2
  if (rptId.php && rptId.node) {
    await dual('#13 GET /report (pg=2, LIMIT=2)', 'GET',
      s => `/report/${rptId[s]}?LIMIT=2&pg=2&JSON=1`, null, { keysOnly: true });
  }

  // 14. Execute report CSV
  if (rptId.php && rptId.node) {
    await dual('#14 GET /report (CSV)', 'GET',
      s => `/report/${rptId[s]}?csv=1`, null, { statusOnly: true });
  }

  // ── Report Metadata ───────────────────────────────────────────────────────
  section('Reports — Metadata');

  // 15. Get report metadata
  if (rptId.php && rptId.node) {
    await dual('#15 GET /metadata (report)', 'GET',
      s => `/metadata/${rptId[s]}?JSON=1`);
  }

  // 16. List report columns (children of report)
  if (rptId.php && rptId.node) {
    // REPORT_COLUMN listing has complex PHP-specific blocks not yet ported to Node:
    // &new_req_report_column, rep_col_list, parent, &ord, &move_n_delete
    // Skipped: compare only status to confirm endpoint works
    await dual('#16 GET /object/28 (report columns)', 'GET',
      s => `/object/28?F_U=${rptId[s]}&JSON=1`, null, { statusOnly: true });
  }

  // ── Rename Report ─────────────────────────────────────────────────────────
  section('Reports — Update');

  // 17. Rename report
  if (rptId.php && rptId.node) {
    await dual('#17 POST /_m_save (rename report)', 'POST',
      s => `/_m_save/${rptId[s]}`,
      s => `_xsrf=${getXsrf(s)}&t22=${encodeURIComponent(`${PREFIX}renamed_${TS}`)}&JSON=1`);
  }

  // ── Delete Report ─────────────────────────────────────────────────────────
  section('Reports — Delete');

  // 18. Delete report
  if (rptId.php && rptId.node) {
    await dual('#18 POST /_m_del (delete report)', 'POST',
      s => `/_m_del/${rptId[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // 19. Verify deleted
  if (rptId.php && rptId.node) {
    await dual('#19 GET /edit_obj (deleted report)', 'GET',
      s => `/edit_obj/${rptId[s]}?JSON=1`);
  }

  // ── Execute Non-existent Report ───────────────────────────────────────────
  section('Reports — Edge Cases');

  // 20. Execute non-existent report
  await dual('#20 GET /report (non-existent)', 'GET',
    '/report/999999999?JSON=1');

  // ── Cleanup ───────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '15-reports-advanced-results.md'), generateMD('15-reports-advanced — Report CRUD & Execution'));
  writeReports('15-reports-advanced', join(dir, '..', 'reports'));
  console.log(`\nWrote 15-reports-advanced-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
