#!/usr/bin/env node
/**
 * 21-subordinate-tables: PHP vs Node.js — Subordinate type operations
 * Tests: creating subordinate types, adding objects to parent,
 *        listing children (F_U filter), edit_obj for sub-objects,
 *        multi-level hierarchy, cascading deletes
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__subt_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup: Parent type ─────────────────────────────────────────────────
  const parentType = await createType(`${PREFIX}proj_${TS}`, 3);
  const colProjName = await addColumn(parentType, 3); // SHORT — project name

  // ── Create subordinate type ────────────────────────────────────────────
  section('Subordinate Tables — Type Creation');

  // 1. Create subordinate type under parentType
  const subType = await createType(`${PREFIX}task_${TS}`, 3, s => `&up=${parentType[s]}`);

  // 2. Add columns to subordinate type
  const colTaskName = await addColumn(subType, 3);   // SHORT — task name
  const colTaskNum = await addColumn(subType, 13);    // NUMBER — priority

  // 3. Verify subordinate type appears in edit_types
  await dual('#3 GET /edit_types (has subordinate)', 'GET',
    '/edit_types?JSON=1', null, { keysOnly: true });

  // 4. Check metadata of subordinate type
  await dual('#4 GET /metadata (subordinate)', 'GET',
    s => `/metadata/${subType[s]}?JSON=1`);

  // ── Create parent objects ──────────────────────────────────────────────
  section('Subordinate Tables — Parent Objects');

  // 5. Create parent object "Project Alpha"
  const proj1 = await createObj(parentType, 'Project_Alpha');

  // 6. Create parent object "Project Beta"
  const proj2 = await createObj(parentType, 'Project_Beta');

  // 7. List parent objects
  await dual('#7 GET /object (parent listing)', 'GET',
    s => `/object/${parentType[s]}?JSON=1`);

  // ── Create subordinate objects ─────────────────────────────────────────
  section('Subordinate Tables — Child Objects');

  // 8. Create child under proj1
  let task1 = { php: NaN, node: NaN };
  if (proj1.php && proj1.node) {
    task1 = await createObj(subType, 'Task_1', proj1.php, proj1.node);
  }

  // 9. Create another child under proj1
  let task2 = { php: NaN, node: NaN };
  if (proj1.php && proj1.node) {
    task2 = await createObj(subType, 'Task_2', proj1.php, proj1.node);
  }

  // 10. Create child under proj2
  let task3 = { php: NaN, node: NaN };
  if (proj2.php && proj2.node) {
    task3 = await createObj(subType, 'Task_3', proj2.php, proj2.node);
  }

  // 11. List children of proj1 via F_U filter
  if (proj1.php && proj1.node) {
    await dual('#11 GET /object (children of proj1)', 'GET',
      s => `/object/${subType[s]}?F_U=${proj1[s]}&JSON=1`);
  }

  // 12. List children of proj2 via F_U filter
  if (proj2.php && proj2.node) {
    await dual('#12 GET /object (children of proj2)', 'GET',
      s => `/object/${subType[s]}?F_U=${proj2[s]}&JSON=1`);
  }

  // 13. edit_obj for a child object
  if (task1.php && task1.node) {
    await dual('#13 GET /edit_obj (subordinate object)', 'GET',
      s => `/edit_obj/${task1[s]}?JSON=1`, null, { keysOnly: true });
  }

  // ── Edit subordinate object ────────────────────────────────────────────
  section('Subordinate Tables — Edit Child');

  // 14. Edit child name via _m_save
  if (task1.php && task1.node && colTaskName.php && colTaskName.node) {
    await dual('#14 POST /_m_save (edit child)', 'POST',
      s => `/_m_save/${task1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colTaskName[s]}=${encodeURIComponent('Task_1_Updated')}&JSON=1`, { keysOnly: true });
  }

  // 15. Verify edit
  if (task1.php && task1.node) {
    await dual('#15 GET /edit_obj (after edit)', 'GET',
      s => `/edit_obj/${task1[s]}?JSON=1`, null, { keysOnly: true });
  }

  // ── Set child field via _m_set ─────────────────────────────────────────
  section('Subordinate Tables — _m_set on Child');

  // 16. Set number field on child
  if (task2.php && task2.node && colTaskNum.php && colTaskNum.node) {
    await dual('#16 POST /_m_set (set number on child)', 'POST',
      s => `/_m_set/${task2[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colTaskNum[s]}=42&JSON=1`, { keysOnly: true });
  }

  // ── Multi-level hierarchy ──────────────────────────────────────────────
  section('Subordinate Tables — Multi-level');

  // 17. Create grandchild type under subType
  const grandType = await createType(`${PREFIX}step_${TS}`, 3, s => `&up=${subType[s]}`);
  const colStep = await addColumn(grandType, 3);

  // 18. Check grandchild type in metadata
  await dual('#18 GET /metadata (grandchild type)', 'GET',
    s => `/metadata/${grandType[s]}?JSON=1`);

  // 19. Create grandchild object under task1
  let step1 = { php: NaN, node: NaN };
  if (task1.php && task1.node) {
    step1 = await createObj(grandType, 'Step_1', task1.php, task1.node);
  }

  // 20. List grandchildren of task1
  if (task1.php && task1.node && step1.php && step1.node) {
    await dual('#20 GET /object (grandchildren)', 'GET',
      s => `/object/${grandType[s]}?F_U=${task1[s]}&JSON=1`);
  }

  // ── Delete child object ────────────────────────────────────────────────
  section('Subordinate Tables — Delete');

  // 21. Delete task3 (child of proj2)
  if (task3.php && task3.node) {
    await dual('#21 POST /_m_del (delete child)', 'POST',
      s => `/_m_del/${task3[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`, { keysOnly: true });
  }

  // 22. Verify proj2 has no children
  if (proj2.php && proj2.node) {
    await dual('#22 GET /object (no children after delete)', 'GET',
      s => `/object/${subType[s]}?F_U=${proj2[s]}&JSON=1`);
  }

  // ── Object listing without F_U filter ──────────────────────────────────
  section('Subordinate Tables — Unfiltered Listing');

  // 23. Object listing for subordinate type without F_U — PHP shows all
  await dual('#23 GET /object (sub type no filter)', 'GET',
    s => `/object/${subType[s]}?JSON=1`);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '21-subordinate-tables-results.md'), generateMD('21-subordinate-tables — Subordinate Type Operations'));
  writeReports('21-subordinate-tables', join(dir, '..', 'reports'));
  console.log(`\nWrote 21-subordinate-tables-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
