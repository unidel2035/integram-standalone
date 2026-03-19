#!/usr/bin/env node
/**
 * 46-legacy-aliases: PHP vs Node.js — Legacy URL aliases
 * Tests: POST _terms (→_d_new), _references (→_d_ref), _patchterm (→_d_save)
 * These are backward-compat aliases that must behave identically to the originals.
 */
import { PHP, NODE, DB, DB_PHP, DB_NODE, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, getXsrf, cookie, cookieNode, results, registerIds } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__alias_';
const TS = Date.now();

/** Push a custom test result (match or diff) into the shared results array */
function pushResult(name, method, phpPath, nodePath, phpRes, nodeRes, diffs) {
  const match = diffs.length === 0;
  const icon = match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m';
  const detail = diffs.length ? '\n         ' + diffs.join('\n         ') : '';
  console.log(`  ${icon}  ${name}${detail}`);
  results.push({
    name, match, diffs, method,
    phpStatus: phpRes.status, nodeStatus: nodeRes.status,
    phpBody: phpRes.body, nodeBody: nodeRes.body,
    phpJson: phpRes.json, nodeJson: nodeRes.json,
    phpPath, nodePath,
  });
  return match;
}

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── _terms — alias for _d_new ─────────────────────────────────────────────
  section('_terms — alias for _d_new');

  const termName = `${PREFIX}type_${TS}`;
  // 1. POST /_terms (no parentTypeId)
  const [t1php, t1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_terms`,  `_xsrf=${xsrfPhp}&val=${encodeURIComponent(termName)}&t=3&up=1&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_terms`, `_xsrf=${xsrfNode}&val=${encodeURIComponent(termName)}&t=3&up=1&JSON=1`, cookieNode()),
  ]);
  const mainPhpId  = Number(t1php.json?.obj);
  const mainNodeId = Number(t1node.json?.obj);
  if (mainPhpId && mainNodeId) registerIds(mainPhpId, mainNodeId);
  {
    const diffs = [];
    if (t1php.status !== t1node.status) diffs.push(`status: PHP=${t1php.status} Node=${t1node.status}`);
    if (!mainPhpId)  diffs.push('PHP did not return obj id');
    if (!mainNodeId) diffs.push('Node did not return obj id');
    if (mainPhpId && mainNodeId) {
      const pk = Object.keys(t1php.json || {}).sort().join(',');
      const nk = Object.keys(t1node.json || {}).sort().join(',');
      if (pk !== nk) diffs.push(`keys: PHP=[${pk}] Node=[${nk}]`);
    }
    pushResult('#1 POST /_terms (create type)', 'POST', `/${DB_PHP}/_terms`, `/${DB_NODE}/_terms`, t1php, t1node, diffs);
  }

  // 2. POST /_terms/:parentTypeId (with parent)
  const childName = `${PREFIX}child_${TS}`;
  const [t2php, t2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_terms/${mainPhpId}`,  `_xsrf=${xsrfPhp}&val=${encodeURIComponent(childName)}&t=3&up=1&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_terms/${mainNodeId}`, `_xsrf=${xsrfNode}&val=${encodeURIComponent(childName)}&t=3&up=1&JSON=1`, cookieNode()),
  ]);
  const childPhpId  = Number(t2php.json?.obj);
  const childNodeId = Number(t2node.json?.obj);
  if (childPhpId && childNodeId) registerIds(childPhpId, childNodeId);
  {
    const diffs = [];
    if (t2php.status !== t2node.status) diffs.push(`status: PHP=${t2php.status} Node=${t2node.status}`);
    if (!childPhpId)  diffs.push('PHP did not return obj id');
    if (!childNodeId) diffs.push('Node did not return obj id');
    pushResult('#2 POST /_terms/:parentTypeId (child type)', 'POST',
      `/${DB_PHP}/_terms/${mainPhpId}`, `/${DB_NODE}/_terms/${mainNodeId}`,
      t2php, t2node, diffs);
  }

  // 3. Verify our created types appear in both /terms responses
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'GET', `/${DB_PHP}/terms?JSON=1`,  null, cookie()),
      http(NODE, 'GET', `/${DB_NODE}/terms?JSON=1`, null, cookieNode()),
    ]);
    const diffs = [];
    if (!Array.isArray(phpRes.json))  diffs.push('PHP /terms not array');
    if (!Array.isArray(nodeRes.json)) diffs.push('Node /terms not array');
    if (!diffs.length) {
      const phpEntry  = phpRes.json.find(t => String(t.id) === String(mainPhpId));
      const nodeEntry = nodeRes.json.find(t => String(t.id) === String(mainNodeId));
      if (!phpEntry)  diffs.push(`type ${mainPhpId} not found in PHP /terms`);
      if (!nodeEntry) diffs.push(`type ${mainNodeId} not found in Node /terms`);
      if (phpEntry && nodeEntry) {
        const pk = Object.keys(phpEntry).sort().join(',');
        const nk = Object.keys(nodeEntry).sort().join(',');
        if (pk !== nk) diffs.push(`keys: PHP=[${pk}] Node=[${nk}]`);
      }
    }
    pushResult('#3 GET /terms (created type visible in both)', 'GET',
      `/${DB_PHP}/terms?JSON=1`, `/${DB_NODE}/terms?JSON=1`,
      phpRes, nodeRes, diffs);
  }

  // ── _references — alias for _d_ref ───────────────────────────────────────
  section('_references — alias for _d_ref');

  // Need a ref target type first
  const refTargetName = `${PREFIX}reftarget_${TS}`;
  const [rt1php, rt1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_d_new`,  `_xsrf=${xsrfPhp}&val=${encodeURIComponent(refTargetName)}&t=3&up=1&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_d_new`, `_xsrf=${xsrfNode}&val=${encodeURIComponent(refTargetName)}&t=3&up=1&JSON=1`, cookieNode()),
  ]);
  const refTargetPhp  = Number(rt1php.json?.obj);
  const refTargetNode = Number(rt1node.json?.obj);
  if (refTargetPhp && refTargetNode) registerIds(refTargetPhp, refTargetNode);

  // 4. POST /_references/:typeId (add reference column)
  const [r1php, r1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_references/${mainPhpId}`,  `_xsrf=${xsrfPhp}&t=${refTargetPhp}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_references/${mainNodeId}`, `_xsrf=${xsrfNode}&t=${refTargetNode}&JSON=1`, cookieNode()),
  ]);
  const refColPhp  = Number(r1php.json?.obj);
  const refColNode = Number(r1node.json?.obj);
  if (refColPhp && refColNode) registerIds(refColPhp, refColNode);
  {
    const diffs = [];
    if (r1php.status !== r1node.status) diffs.push(`status: PHP=${r1php.status} Node=${r1node.status}`);
    if (!refColPhp)  diffs.push('PHP did not return ref column id');
    if (!refColNode) diffs.push('Node did not return ref column id');
    if (r1php.json && r1node.json) {
      const pk = Object.keys(r1php.json).sort().join(',');
      const nk = Object.keys(r1node.json).sort().join(',');
      if (pk !== nk) diffs.push(`keys: PHP=[${pk}] Node=[${nk}]`);
    }
    pushResult('#4 POST /_references/:typeId (add ref column)', 'POST',
      `/${DB_PHP}/_references/${mainPhpId}`, `/${DB_NODE}/_references/${mainNodeId}`,
      r1php, r1node, diffs);
  }

  // 5. Verify metadata shows new ref column
  if (mainPhpId && mainNodeId) {
    await dual('#5 GET /metadata (after _references)', 'GET',
      s => `/metadata/${s === 'php' ? mainPhpId : mainNodeId}?JSON=1`, null, { keysOnly: true });
  }

  // 6. _references with nonexistent type → error
  const [r2php, r2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_references/999999999`,  `_xsrf=${xsrfPhp}&t=${refTargetPhp}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_references/999999999`, `_xsrf=${xsrfNode}&t=${refTargetNode}&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (r2php.status !== r2node.status) diffs.push(`status: PHP=${r2php.status} Node=${r2node.status}`);
    pushResult('#6 POST /_references (nonexistent type)', 'POST',
      `/${DB_PHP}/_references/999999999`, `/${DB_NODE}/_references/999999999`,
      r2php, r2node, diffs);
  }

  // ── _patchterm — alias for _d_save ───────────────────────────────────────
  section('_patchterm — alias for _d_save');

  // 7. POST /_patchterm/:typeId (rename type)
  const newName = `${PREFIX}renamed_${TS}`;
  const [p1php, p1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_patchterm/${mainPhpId}`,  `_xsrf=${xsrfPhp}&val=${encodeURIComponent(newName)}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_patchterm/${mainNodeId}`, `_xsrf=${xsrfNode}&val=${encodeURIComponent(newName)}&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (p1php.status !== p1node.status) diffs.push(`status: PHP=${p1php.status} Node=${p1node.status}`);
    if (p1php.json && p1node.json) {
      const pk = Object.keys(p1php.json).sort().join(',');
      const nk = Object.keys(p1node.json).sort().join(',');
      if (pk !== nk) diffs.push(`keys: PHP=[${pk}] Node=[${nk}]`);
    }
    pushResult('#7 POST /_patchterm/:typeId (rename)', 'POST',
      `/${DB_PHP}/_patchterm/${mainPhpId}`, `/${DB_NODE}/_patchterm/${mainNodeId}`,
      p1php, p1node, diffs);
  }

  // 8. Verify rename took effect
  if (mainPhpId && mainNodeId) {
    await dual('#8 GET /edit_types (after _patchterm)', 'GET',
      '/edit_types?JSON=1', null, { keysOnly: true });
  }

  // 9. _patchterm with nonexistent id → error
  const [p2php, p2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_patchterm/999999999`,  `_xsrf=${xsrfPhp}&val=X&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_patchterm/999999999`, `_xsrf=${xsrfNode}&val=X&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (p2php.status !== p2node.status) diffs.push(`status: PHP=${p2php.status} Node=${p2node.status}`);
    pushResult('#9 POST /_patchterm (nonexistent)', 'POST',
      `/${DB_PHP}/_patchterm/999999999`, `/${DB_NODE}/_patchterm/999999999`,
      p2php, p2node, diffs);
  }

  // ── Error cases ──────────────────────────────────────────────────────────
  section('Aliases — Auth errors');

  // 10. _terms without XSRF → rejected
  const [e1php, e1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_terms`,  `val=X&t=3&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_terms`, `val=X&t=3&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (e1php.status !== e1node.status) diffs.push(`status: PHP=${e1php.status} Node=${e1node.status}`);
    pushResult('#10 POST /_terms (no xsrf)', 'POST',
      `/${DB_PHP}/_terms`, `/${DB_NODE}/_terms`, e1php, e1node, diffs);
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '46-legacy-aliases-results.md'), generateMD('46-legacy-aliases — Legacy URL Aliases'));
  writeReports('46-legacy-aliases', join(dir, '..', 'reports'));
  console.log(`\nWrote 46-legacy-aliases-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
