#!/usr/bin/env node
/**
 * 16-datatable-patterns: PHP vs Node.js — DataTable component API patterns
 * Based on DataTable.vue + composables (useCellEditing, useRowEditing, useDirectoryCache):
 *   Cell editing, row editing, directory caching, batch operations,
 *   object list with all column data, edit_obj for form view
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, deleteType, deleteObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__dt_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup: Full table schema matching DataTable usage ─────────────────────

  // Status lookup
  const statusType = await createType(`${PREFIX}status_${TS}`, 3);
  const stNew  = await createObj(statusType, 'Новый');
  const stWork = await createObj(statusType, 'В работе');
  const stDone = await createObj(statusType, 'Завершен');
  const stCanc = await createObj(statusType, 'Отменен');

  // Priority lookup
  const prioType = await createType(`${PREFIX}prio_${TS}`, 3);
  const prLow  = await createObj(prioType, 'Низкий');
  const prMed  = await createObj(prioType, 'Средний');
  const prHigh = await createObj(prioType, 'Высокий');

  // Main task table (mimics real DataTable usage)
  const taskType = await createType(`${PREFIX}tasks_${TS}`, 3);
  const colTitle   = await addColumn(taskType, 3);   // SHORT — title
  const colDesc    = await addColumn(taskType, 2);   // LONG — description
  const colHours   = await addColumn(taskType, 13);  // NUMBER (13, not 11=BOOLEAN)
  const colDue     = await addColumn(taskType, 4);   // DATETIME — due date
  const colDone    = await addColumn(taskType, 11);  // BOOLEAN (11, not 7=BUTTON)
  const colStatus  = await addRefColumn(taskType, statusType);  // reference
  const colPrio    = await addRefColumn(taskType, prioType);    // reference

  const ck2 = cookie();

  // ── Directory Cache Pattern ───────────────────────────────────────────────
  section('DataTable — Directory Cache (preload lookups)');

  // DataTable preloads all lookup values for reference columns
  // useDirectoryCache.js: getObjectList(dirTableId, { LIMIT: 500 })

  // 1. Preload status directory
  await dual('#1 GET /object (preload status dir)', 'GET',
    s => `/object/${statusType[s]}?LIMIT=500&JSON=1`);

  // 2. Preload priority directory
  await dual('#2 GET /object (preload prio dir)', 'GET',
    s => `/object/${prioType[s]}?LIMIT=500&JSON=1`);

  // ── Populate Data ─────────────────────────────────────────────────────────
  // Create tasks with all field types filled
  const tasks = [];
  const taskData = [
    { title: 'Задача 1', desc: 'Описание первой задачи', hours: '8', due: '2025-04-01 09:00:00', done: '0', status: stNew, prio: prHigh },
    { title: 'Задача 2', desc: 'Вторая задача с длинным описанием для тестирования', hours: '16', due: '2025-04-15 18:00:00', done: '0', status: stWork, prio: prMed },
    { title: 'Bug fix #123', desc: 'Fix critical bug', hours: '2', due: '2025-03-20 12:00:00', done: '1', status: stDone, prio: prHigh },
    { title: 'Рефакторинг', desc: 'Переписать модуль авторизации', hours: '40', due: '2025-05-01 00:00:00', done: '0', status: stNew, prio: prLow },
    { title: 'Code review', desc: 'Review PR #456', hours: '1', due: '2025-03-18 15:00:00', done: '1', status: stDone, prio: prMed },
    { title: 'Deploy v2.0', desc: 'Production deployment', hours: '4', due: '2025-06-01 06:00:00', done: '0', status: stCanc, prio: prHigh },
  ];

  for (const d of taskData) {
    const obj = await createObj(taskType, d.title);
    tasks.push(obj);
    if (colTitle.php && colTitle.node) {
      await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_set/${obj.php}`,
          `_xsrf=${xsrfPhp}&t${colTitle.php}=${encodeURIComponent(d.title)}&t${colDesc.php}=${encodeURIComponent(d.desc)}&t${colHours.php}=${d.hours}&t${colDue.php}=${encodeURIComponent(d.due)}&t${colDone.php}=${d.done}&t${colStatus.php}=${d.status.php}&t${colPrio.php}=${d.prio.php}&JSON=1`, ck2),
        http(NODE, 'POST', `/${DB}/_m_set/${obj.node}`,
          `_xsrf=${xsrfNode}&t${colTitle.node}=${encodeURIComponent(d.title)}&t${colDesc.node}=${encodeURIComponent(d.desc)}&t${colHours.node}=${d.hours}&t${colDue.node}=${encodeURIComponent(d.due)}&t${colDone.node}=${d.done}&t${colStatus.node}=${d.status.node}&t${colPrio.node}=${d.prio.node}&JSON=1`, ck2),
      ]);
    }
  }

  // ── DataTable List Pattern ────────────────────────────────────────────────
  section('DataTable — Object List (main grid view)');

  // 3. Full list (DataTable default load)
  await dual('#3 GET /object (full list)', 'GET',
    s => `/object/${taskType[s]}?JSON=1`);

  // 4. List with LIMIT=20 (DataTable default)
  await dual('#4 GET /object (LIMIT=20)', 'GET',
    s => `/object/${taskType[s]}?LIMIT=20&JSON=1`);

  // 5. Get _list endpoint
  await dual('#5 GET /_list (alternative)', 'GET',
    s => `/_list/${taskType[s]}?JSON=1`);

  // ── Cell Editing Pattern ──────────────────────────────────────────────────
  section('DataTable — Cell Editing (useCellEditing)');

  // useCellEditing: save cell → _m_set with single field

  // 6. Edit title cell
  if (colTitle.php && colTitle.node) {
    await dual('#6 POST /_m_set (edit title cell)', 'POST',
      s => `/_m_set/${tasks[0][s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colTitle[s]}=${encodeURIComponent('Задача 1 (обновлена)')}&JSON=1`);
  }

  // 7. Edit number cell
  if (colHours.php && colHours.node) {
    await dual('#7 POST /_m_set (edit hours cell)', 'POST',
      s => `/_m_set/${tasks[0][s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colHours[s]}=12&JSON=1`);
  }

  // 8. Toggle boolean cell
  if (colDone.php && colDone.node) {
    await dual('#8 POST /_m_set (toggle bool cell)', 'POST',
      s => `/_m_set/${tasks[0][s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colDone[s]}=1&JSON=1`);
  }

  // 9. Edit date cell
  if (colDue.php && colDue.node) {
    await dual('#9 POST /_m_set (edit date cell)', 'POST',
      s => `/_m_set/${tasks[1][s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colDue[s]}=${encodeURIComponent('2025-12-31 23:59:59')}&JSON=1`);
  }

  // 10. Change reference cell (change status)
  if (colStatus.php && colStatus.node) {
    await dual('#10 POST /_m_set (change ref cell)', 'POST',
      s => `/_m_set/${tasks[0][s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colStatus[s]}=${stWork[s]}&JSON=1`);
  }

  // 11. Clear reference cell
  if (colPrio.php && colPrio.node) {
    await dual('#11 POST /_m_set (clear ref cell)', 'POST',
      s => `/_m_set/${tasks[3][s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colPrio[s]}=&JSON=1`);
  }

  // ── Row Editing Pattern ───────────────────────────────────────────────────
  section('DataTable — Row Editing (useRowEditing)');

  // useRowEditing: save all fields at once via _m_save

  // 12. Save entire row
  if (colTitle.php && colTitle.node) {
    await dual('#12 POST /_m_save (save full row)', 'POST',
      s => `/_m_save/${tasks[1][s]}`,
      s => `_xsrf=${getXsrf(s)}&t${taskType[s]}=${encodeURIComponent('Задача 2 FULL SAVE')}&t${colTitle[s]}=${encodeURIComponent('Updated Title')}&t${colHours[s]}=24&t${colDone[s]}=1&JSON=1`);
  }

  // ── Dropdown Loading Pattern ──────────────────────────────────────────────
  section('DataTable — Dropdown Loading (reference cells)');

  // When user clicks reference cell, DataTable loads options via _ref_reqs

  // 13. Load status options for cell
  if (colStatus.php && colStatus.node) {
    await dual('#13 GET /_ref_reqs (status dropdown)', 'GET',
      s => `/_ref_reqs/${colStatus[s]}?id=${tasks[0][s]}&JSON=1`);
  }

  // 14. Load priority options for cell
  if (colPrio.php && colPrio.node) {
    await dual('#14 GET /_ref_reqs (prio dropdown)', 'GET',
      s => `/_ref_reqs/${colPrio[s]}?id=${tasks[0][s]}&JSON=1`);
  }

  // 15. Load options with search query
  if (colStatus.php && colStatus.node) {
    await dual('#15 GET /_ref_reqs (search=Завер)', 'GET',
      s => `/_ref_reqs/${colStatus[s]}?id=${tasks[0][s]}&q=${encodeURIComponent('Завер')}&JSON=1`);
  }

  // ── Object Form View ─────────────────────────────────────────────────────
  section('DataTable — Object Form View');

  // When user double-clicks row, opens edit_obj form

  // 16. Open task in form view (keysOnly: shared DB causes field ordering diffs)
  await dual('#16 GET /edit_obj (task form)', 'GET',
    s => `/edit_obj/${tasks[0][s]}?JSON=1`, null, { keysOnly: true });

  // 17. Open task with references (keysOnly: shared DB causes field ordering diffs)
  await dual('#17 GET /edit_obj (task with refs)', 'GET',
    s => `/edit_obj/${tasks[2][s]}?JSON=1`, null, { keysOnly: true });

  // ── DataTable CRUD ────────────────────────────────────────────────────────
  section('DataTable — Add/Delete Rows');

  // 18. Add new row (DataTable "+" button)
  await dual('#18 POST /_m_new (add row via DataTable)', 'POST',
    s => `/_m_new/${taskType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${taskType[s]}=&up=1&JSON=1`);

  // 19. Delete row (DataTable delete button)
  const delTask = await createObj(taskType, 'ToDelete');
  await dual('#19 POST /_m_del (delete row via DataTable)', 'POST',
    s => `/_m_del/${delTask[s]}`,
    s => `_xsrf=${getXsrf(s)}&JSON=1`);

  // 20. Copy row
  await dual('#20 POST /_m_save (copy row)', 'POST',
    s => `/_m_save/${tasks[0][s]}`,
    s => `_xsrf=${getXsrf(s)}&copybtn=1&val=${encodeURIComponent('Задача 1 (копия)')}&JSON=1`);

  // ── Metadata Pattern ──────────────────────────────────────────────────────
  section('DataTable — Metadata');

  // 21. Get type metadata (DataTable column config)
  await dual('#21 GET /metadata (DataTable columns)', 'GET',
    s => `/metadata/${taskType[s]}?JSON=1`);

  // 22. Get obj_meta for specific row
  await dual('#22 GET /obj_meta (row meta)', 'GET',
    s => `/obj_meta/${tasks[0][s]}?JSON=1`);

  // ── Verify Final State ────────────────────────────────────────────────────
  section('DataTable — Final State');

  // 23. Final list after all edits
  await dual('#23 GET /object (final state)', 'GET',
    s => `/object/${taskType[s]}?JSON=1`);

  // 24. Count after edits
  await dual('#24 GET /object (final count)', 'GET',
    s => `/object/${taskType[s]}?LIMIT=0&JSON=1`);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '16-datatable-patterns-results.md'), generateMD('16-datatable-patterns — DataTable Component Patterns'));
  writeReports('16-datatable-patterns', join(dir, '..', 'reports'));
  console.log(`\nWrote 16-datatable-patterns-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
