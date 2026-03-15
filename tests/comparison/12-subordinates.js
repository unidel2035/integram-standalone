#!/usr/bin/env node
/**
 * 12-subordinates: PHP vs Node.js — Parent-child relationships (подчинённости)
 * Based on IntegramDataTableWrapper.vue subordinate patterns:
 *   Hierarchical types (up=parentId), F_U filter, _m_move,
 *   subordinate tables, tree navigation
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, createObj, deleteType, deleteObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__sub_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup: Parent-child type structure ────────────────────────────────────

  // Create parent type
  const parentType = await createType(`${PREFIX}parent_${TS}`, 3);
  const pCol1 = await addColumn(parentType, 3); // name column

  // Create child type (subordinate to parent)
  const ck = cookie();
  const [childPhp, childNode] = await Promise.all([
    http(PHP, 'POST', `/${DB}/_d_new`, `_xsrf=${xsrfPhp}&val=${encodeURIComponent(`${PREFIX}child_${TS}`)}&t=3&up=${parentType.php}&JSON=1`, ck),
    http(NODE, 'POST', `/${DB}/_d_new`, `_xsrf=${xsrfNode}&val=${encodeURIComponent(`${PREFIX}child_${TS}`)}&t=3&up=${parentType.node}&JSON=1`, ck),
  ]);
  const childType = { php: Number(childPhp.json?.obj), node: Number(childNode.json?.obj) };
  const cCol1 = await addColumn(childType, 3); // child name column

  // Create grandchild type (subordinate to child)
  const [gcPhp, gcNode] = await Promise.all([
    http(PHP, 'POST', `/${DB}/_d_new`, `_xsrf=${xsrfPhp}&val=${encodeURIComponent(`${PREFIX}grandchild_${TS}`)}&t=3&up=${childType.php}&JSON=1`, ck),
    http(NODE, 'POST', `/${DB}/_d_new`, `_xsrf=${xsrfNode}&val=${encodeURIComponent(`${PREFIX}grandchild_${TS}`)}&t=3&up=${childType.node}&JSON=1`, ck),
  ]);
  const grandchildType = { php: Number(gcPhp.json?.obj), node: Number(gcNode.json?.obj) };

  // Create parent objects
  const parent1 = await createObj(parentType, 'Department A');
  const parent2 = await createObj(parentType, 'Department B');
  const parent3 = await createObj(parentType, 'Department C');

  // Create child objects under parent1
  const child1 = await createObj(childType, 'Employee 1', parent1.php, parent1.node);
  const child2 = await createObj(childType, 'Employee 2', parent1.php, parent1.node);
  const child3 = await createObj(childType, 'Employee 3', parent1.php, parent1.node);

  // Create child objects under parent2
  const child4 = await createObj(childType, 'Employee 4', parent2.php, parent2.node);
  const child5 = await createObj(childType, 'Employee 5', parent2.php, parent2.node);

  // Create grandchild objects under child1
  const gc1 = await createObj(grandchildType, 'Task 1', child1.php, child1.node);
  const gc2 = await createObj(grandchildType, 'Task 2', child1.php, child1.node);

  // ── Subordinate Type Structure ────────────────────────────────────────────
  section('Subordinates — Type Structure');

  // 1. Get parent type metadata (should show subordinate types)
  await dual('#1 GET /metadata (parent type)', 'GET',
    s => `/metadata/${parentType[s]}?JSON=1`);

  // 2. Get child type metadata
  await dual('#2 GET /metadata (child type)', 'GET',
    s => `/metadata/${childType[s]}?JSON=1`);

  // 3. Get grandchild type metadata
  await dual('#3 GET /metadata (grandchild type)', 'GET',
    s => `/metadata/${grandchildType[s]}?JSON=1`);

  // 4. Get edit_types (full structure)
  await dual('#4 GET /edit_types (full tree)', 'GET',
    '/edit_types?JSON=1', null, { keysOnly: true });

  // ── List with F_U Filter ──────────────────────────────────────────────────
  section('Subordinates — F_U Filter');

  // 5. List children of parent1
  await dual('#5 GET /object (children of parent1)', 'GET',
    s => `/object/${childType[s]}?F_U=${parent1[s]}&JSON=1`);

  // 6. List children of parent2
  await dual('#6 GET /object (children of parent2)', 'GET',
    s => `/object/${childType[s]}?F_U=${parent2[s]}&JSON=1`);

  // 7. List children of parent3 (empty — no children)
  await dual('#7 GET /object (children of parent3 — empty)', 'GET',
    s => `/object/${childType[s]}?F_U=${parent3[s]}&JSON=1`);

  // 8. List grandchildren of child1
  if (child1.php && child1.node) {
    await dual('#8 GET /object (grandchildren of child1)', 'GET',
      s => `/object/${grandchildType[s]}?F_U=${child1[s]}&JSON=1`);
  }

  // 9. List all children (no F_U)
  await dual('#9 GET /object (all children, no F_U)', 'GET',
    s => `/object/${childType[s]}?JSON=1`);

  // 10. List with F_U + LIMIT
  await dual('#10 GET /object (F_U + LIMIT=2)', 'GET',
    s => `/object/${childType[s]}?F_U=${parent1[s]}&LIMIT=2&JSON=1`);

  // 11. List with F_U + page 2
  await dual('#11 GET /object (F_U + pg=2, LIMIT=2)', 'GET',
    s => `/object/${childType[s]}?F_U=${parent1[s]}&LIMIT=2&pg=2&JSON=1`);

  // ── Create Subordinate Objects ────────────────────────────────────────────
  section('Subordinates — Create Under Parent');

  // 12. Create child under parent3
  await dual('#12 POST /_m_new (child under parent3)', 'POST',
    s => `/_m_new/${childType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${childType[s]}=NewEmployee&up=${parent3[s]}&JSON=1`);

  // 13. Create grandchild under child4
  await dual('#13 POST /_m_new (grandchild under child4)', 'POST',
    s => `/_m_new/${grandchildType[s]}`,
    s => `_xsrf=${getXsrf(s)}&t${grandchildType[s]}=NewTask&up=${child4[s]}&JSON=1`);

  // ── Move Objects Between Parents ──────────────────────────────────────────
  section('Subordinates — Move Between Parents');

  // 14. Move child3 from parent1 to parent2
  await dual('#14 POST /_m_move (child to different parent)', 'POST',
    s => `/_m_move/${child3[s]}`,
    s => `_xsrf=${getXsrf(s)}&up=${parent2[s]}&JSON=1`);

  // 15. Verify parent1 children after move (should be 2)
  await dual('#15 GET /object (parent1 after move)', 'GET',
    s => `/object/${childType[s]}?F_U=${parent1[s]}&JSON=1`);

  // 16. Verify parent2 children after move (should be 3)
  await dual('#16 GET /object (parent2 after move)', 'GET',
    s => `/object/${childType[s]}?F_U=${parent2[s]}&JSON=1`);

  // 17. Move child back
  await dual('#17 POST /_m_move (move child back)', 'POST',
    s => `/_m_move/${child3[s]}`,
    s => `_xsrf=${getXsrf(s)}&up=${parent1[s]}&JSON=1`);

  // ── Order Within Parent ───────────────────────────────────────────────────
  section('Subordinates — Order Within Parent');

  // 18. Move child2 up within parent1
  await dual('#18 POST /_m_up (reorder within parent)', 'POST',
    s => `/_m_up/${child2[s]}`,
    s => `_xsrf=${getXsrf(s)}&JSON=1`);

  // 19. Set order of child1
  await dual('#19 POST /_m_ord (set order within parent)', 'POST',
    s => `/_m_ord/${child1[s]}`,
    s => `_xsrf=${getXsrf(s)}&order=3&JSON=1`);

  // 20. Verify order after changes
  await dual('#20 GET /object (order after changes)', 'GET',
    s => `/object/${childType[s]}?F_U=${parent1[s]}&JSON=1`);

  // ── Edit Object With Requisites ───────────────────────────────────────────
  section('Subordinates — Edit Subordinate Objects');

  // 21. Set requisite on child object
  if (cCol1.php && cCol1.node) {
    await dual('#21 POST /_m_set (child requisite)', 'POST',
      s => `/_m_set/${child1[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${cCol1[s]}=ChildData&JSON=1`);
  }

  // 22. Get edit_obj for child
  if (child1.php && child1.node) {
    await dual('#22 GET /edit_obj (child)', 'GET',
      s => `/edit_obj/${child1[s]}?JSON=1`);
  }

  // 23. Get edit_obj for grandchild
  if (gc1.php && gc1.node) {
    await dual('#23 GET /edit_obj (grandchild)', 'GET',
      s => `/edit_obj/${gc1[s]}?JSON=1`);
  }

  // ── Parent List & Count ───────────────────────────────────────────────────
  section('Subordinates — Parent Operations');

  // 24. Parent list shows subordinate counts
  await dual('#24 GET /object (parent list)', 'GET',
    s => `/object/${parentType[s]}?JSON=1`);

  // 25. Delete child and verify parent
  const delChild = await createObj(childType, 'ToDeleteChild', parent2.php, parent2.node);
  await dual('#25 POST /_m_del (delete child)', 'POST',
    s => `/_m_del/${delChild[s]}`,
    s => `_xsrf=${getXsrf(s)}&JSON=1`);

  // 26. Verify parent2 children after delete
  await dual('#26 GET /object (parent2 after child delete)', 'GET',
    s => `/object/${childType[s]}?F_U=${parent2[s]}&JSON=1`);

  // ── Delete Parent With Children ───────────────────────────────────────────
  section('Subordinates — Delete Parent');

  // 27. Try to delete parent with children (should fail or cascade)
  await dual('#27 POST /_m_del (parent with children)', 'POST',
    s => `/_m_del/${parent1[s]}`,
    s => `_xsrf=${getXsrf(s)}&JSON=1`);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '12-subordinates-results.md'), generateMD('12-subordinates — Подчинённости'));
  writeReports('12-subordinates', join(dir, '..', 'reports'));
  console.log(`\nWrote 12-subordinates-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
