#!/usr/bin/env node
/**
 * 22-directories-multiselect: PHP vs Node.js — Directory (справочник) creation
 *   and multiselect reference operations
 * Tests: creating lookup types (directories), populating them,
 *        adding reference columns (single + multiselect), setting refs,
 *        editing multiselect values, removing refs, filtering by ref
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__dirmulti_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup: Directory (lookup) types ────────────────────────────────────
  section('Directories — Create Lookup Types');

  // 1. Create "Status" directory
  const statusType = await createType(`${PREFIX}status_${TS}`, 3);

  // 2. Create "Priority" directory
  const priorityType = await createType(`${PREFIX}priority_${TS}`, 3);

  // 3. Create "Tag" directory (for multiselect)
  const tagType = await createType(`${PREFIX}tag_${TS}`, 3);

  // ── Populate directories ───────────────────────────────────────────────
  section('Directories — Populate');

  // 4-6. Add status values
  const statusActive = await createObj(statusType, 'Активен');
  const statusDone = await createObj(statusType, 'Завершен');
  const statusPaused = await createObj(statusType, 'Приостановлен');

  // 7-9. Add priority values
  const priHigh = await createObj(priorityType, 'Высокий');
  const priMedium = await createObj(priorityType, 'Средний');
  const priLow = await createObj(priorityType, 'Низкий');

  // 10-13. Add tag values
  const tagUrgent = await createObj(tagType, 'Срочно');
  const tagBug = await createObj(tagType, 'Баг');
  const tagFeature = await createObj(tagType, 'Фича');
  const tagDocs = await createObj(tagType, 'Документация');

  // 14. List status directory
  await dual('#14 GET /object (status directory)', 'GET',
    s => `/object/${statusType[s]}?JSON=1`);

  // 15. List priority directory
  await dual('#15 GET /object (priority directory)', 'GET',
    s => `/object/${priorityType[s]}?JSON=1`);

  // 16. List tag directory
  await dual('#16 GET /object (tag directory)', 'GET',
    s => `/object/${tagType[s]}?JSON=1`);

  // ── Main type with reference columns ───────────────────────────────────
  section('Directories — Main Type with Refs');

  // 17. Create main type "Tasks"
  const taskType = await createType(`${PREFIX}task_${TS}`, 3);
  const colName = await addColumn(taskType, 3);  // SHORT — name

  // 18. Add single-select reference to Status
  const colStatus = await addRefColumn(taskType, statusType);

  // 19. Add single-select reference to Priority
  const colPriority = await addRefColumn(taskType, priorityType);

  // 20. Add reference to Tags (will make multiselect)
  const colTag = await addRefColumn(taskType, tagType);

  // 21. Set Tag column as MULTI
  if (colTag.php && colTag.node) {
    await dual('#21 POST /_d_multi (set tag MULTI)', 'POST',
      s => `/_d_multi/${colTag[s]}`,
      s => `_xsrf=${getXsrf(s)}&JSON=1`);
  }

  // 22. Verify metadata has MULTI flag
  await dual('#22 GET /metadata (after MULTI)', 'GET',
    s => `/metadata/${taskType[s]}?JSON=1`);

  // ── Create objects with references ─────────────────────────────────────
  section('Directories — Create Objects with Refs');

  // 23. Create task objects
  const task1 = await createObj(taskType, 'Задача_1');
  const task2 = await createObj(taskType, 'Задача_2');
  const task3 = await createObj(taskType, 'Задача_3');

  // 24. Set status ref on task1 via _m_set
  if (task1.php && task1.node && colStatus.php && colStatus.node && statusActive.php && statusActive.node) {
    await dual('#24 POST /_m_set (set status ref)', 'POST',
      s => `/_m_set/${task1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colStatus[s]}=${statusActive[s]}&JSON=1`, { keysOnly: true });
  }

  // 25. Set priority ref on task1
  if (task1.php && task1.node && colPriority.php && colPriority.node && priHigh.php && priHigh.node) {
    await dual('#25 POST /_m_set (set priority ref)', 'POST',
      s => `/_m_set/${task1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colPriority[s]}=${priHigh[s]}&JSON=1`, { keysOnly: true });
  }

  // 26. Verify task1 has refs in edit_obj
  if (task1.php && task1.node) {
    await dual('#26 GET /edit_obj (after set refs)', 'GET',
      s => `/edit_obj/${task1[s]}?JSON=1`, null, { keysOnly: true });
  }

  // ── Multiselect operations ─────────────────────────────────────────────
  section('Multiselect — Set Values');

  // 27. Add first tag (Urgent) to task1
  if (task1.php && task1.node && colTag.php && colTag.node && tagUrgent.php && tagUrgent.node) {
    await dual('#27 POST /_m_set (add tag Urgent)', 'POST',
      s => `/_m_set/${task1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colTag[s]}=${tagUrgent[s]}&JSON=1`, { keysOnly: true });
  }

  // 28. Add second tag (Bug) to task1
  if (task1.php && task1.node && colTag.php && colTag.node && tagBug.php && tagBug.node) {
    await dual('#28 POST /_m_set (add tag Bug)', 'POST',
      s => `/_m_set/${task1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colTag[s]}=${tagBug[s]}&JSON=1`, { keysOnly: true });
  }

  // 29. Verify task1 has both tags in edit_obj
  if (task1.php && task1.node) {
    await dual('#29 GET /edit_obj (after multiselect)', 'GET',
      s => `/edit_obj/${task1[s]}?JSON=1`, null, { keysOnly: true });
  }

  // 30. Set tags on task2 (Feature + Docs)
  if (task2.php && task2.node && colTag.php && colTag.node && tagFeature.php && tagFeature.node) {
    await dual('#30 POST /_m_set (add tag Feature)', 'POST',
      s => `/_m_set/${task2[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colTag[s]}=${tagFeature[s]}&JSON=1`, { keysOnly: true });
  }

  if (task2.php && task2.node && colTag.php && colTag.node && tagDocs.php && tagDocs.node) {
    await dual('#31 POST /_m_set (add tag Docs)', 'POST',
      s => `/_m_set/${task2[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colTag[s]}=${tagDocs[s]}&JSON=1`, { keysOnly: true });
  }

  // 32. Verify listing shows refs
  await dual('#32 GET /object (listing with refs)', 'GET',
    s => `/object/${taskType[s]}?JSON=1`);

  // ── Change single-select ref ───────────────────────────────────────────
  section('Directories — Change Ref');

  // 33. Change status from Active to Done
  if (task1.php && task1.node && colStatus.php && colStatus.node && statusDone.php && statusDone.node) {
    await dual('#33 POST /_m_set (change status)', 'POST',
      s => `/_m_set/${task1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colStatus[s]}=${statusDone[s]}&JSON=1`, { keysOnly: true });
  }

  // 34. Clear priority (set to empty/0)
  if (task1.php && task1.node && colPriority.php && colPriority.node) {
    await dual('#34 POST /_m_set (clear priority)', 'POST',
      s => `/_m_set/${task1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colPriority[s]}=0&JSON=1`, { keysOnly: true });
  }

  // 35. Verify changes
  if (task1.php && task1.node) {
    await dual('#35 GET /edit_obj (after changes)', 'GET',
      s => `/edit_obj/${task1[s]}?JSON=1`, null, { keysOnly: true });
  }

  // ── _ref_reqs: Reference requisites ────────────────────────────────────
  section('Directories — _ref_reqs');

  // 36. Get reference requisites for status column
  if (colStatus.php && colStatus.node) {
    await dual('#36 GET /_ref_reqs (status)', 'GET',
      s => `/_ref_reqs/${colStatus[s]}?JSON=1`);
  }

  // 37. Get reference requisites for multiselect tag column
  if (colTag.php && colTag.node) {
    await dual('#37 GET /_ref_reqs (tag multi)', 'GET',
      s => `/_ref_reqs/${colTag[s]}?JSON=1`);
  }

  // ── Filtering by reference ─────────────────────────────────────────────
  section('Directories — Filter by Ref');

  // 38. Filter tasks by status (F_T filter — PHP uses F_T for type-level filter)
  await dual('#38 GET /object (filter by type)', 'GET',
    s => `/object/${taskType[s]}?JSON=1`);

  // ── Add duplicate ref (should warn) ────────────────────────────────────
  section('Directories — Duplicate Ref');

  // 39. Add same tag again (Urgent to task1 — already there)
  if (task1.php && task1.node && colTag.php && colTag.node && tagUrgent.php && tagUrgent.node) {
    await dual('#39 POST /_m_set (duplicate tag)', 'POST',
      s => `/_m_set/${task1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colTag[s]}=${tagUrgent[s]}&JSON=1`, { keysOnly: true });
  }

  // 40. Final state
  await dual('#40 GET /object (final state)', 'GET',
    s => `/object/${taskType[s]}?JSON=1`);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '22-directories-multiselect-results.md'), generateMD('22-directories-multiselect — Directory & Multiselect Operations'));
  writeReports('22-directories-multiselect', join(dir, '..', 'reports'));
  console.log(`\nWrote 22-directories-multiselect-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
