#!/usr/bin/env node
/**
 * 49-more-legacy-aliases: PHP vs Node.js — More Legacy URL Aliases
 * Tests: POST _setalias, _setnull, _setmulti, _setorder, _moveup,
 *        _deleteterm, _deletereq, _attributes, _modifiers
 * These are backward-compat aliases that must behave identically to the originals.
 *
 * Alias map:
 *   _setalias/:reqId  → _d_alias  (rename column, param: val=NewName)
 *   _setnull/:reqId   → _d_null   (toggle NOT NULL flag)
 *   _setmulti/:reqId  → _d_multi  (toggle multiselect flag)
 *   _setorder/:reqId  → _d_ord    (reorder column, param: ord=2)
 *   _moveup/:reqId    → _d_up     (move column up in order)
 *   _deleteterm/:id   → _d_del    (delete type)
 *   _deletereq/:reqId → _d_del_req (delete column)
 *   _attributes/:id   → _d_req    (add column to type, param: t=concreteTypeId)
 *   _modifiers/:reqId → _d_attrs  (set column attrs, param: val=:!NULL:)
 */
import { PHP, NODE, DB, DB_PHP, DB_NODE, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, getXsrf, cookie, cookieNode, results, registerIds, getConcreteType } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__alias2_';
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

  // ── Setup: create a main type + several columns ──────────────────────────
  section('Setup — create type and columns');

  const mainTypeName = `${PREFIX}type_${TS}`;
  const [mt1php, mt1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_d_new`,  `_xsrf=${xsrfPhp}&val=${encodeURIComponent(mainTypeName)}&t=3&up=1&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_d_new`, `_xsrf=${xsrfNode}&val=${encodeURIComponent(mainTypeName)}&t=3&up=1&JSON=1`, cookieNode()),
  ]);
  const mainPhpId  = Number(mt1php.json?.obj);
  const mainNodeId = Number(mt1node.json?.obj);
  if (mainPhpId && mainNodeId) registerIds(mainPhpId, mainNodeId);
  console.log(`  Main type: PHP=${mainPhpId} Node=${mainNodeId}`);

  // Create a second type (for _deleteterm test — we delete this one, not main)
  const delTypeName = `${PREFIX}deltype_${TS}`;
  const [dt1php, dt1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_d_new`,  `_xsrf=${xsrfPhp}&val=${encodeURIComponent(delTypeName)}&t=3&up=1&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_d_new`, `_xsrf=${xsrfNode}&val=${encodeURIComponent(delTypeName)}&t=3&up=1&JSON=1`, cookieNode()),
  ]);
  const delTypePhpId  = Number(dt1php.json?.obj);
  const delTypeNodeId = Number(dt1node.json?.obj);
  if (delTypePhpId && delTypeNodeId) registerIds(delTypePhpId, delTypeNodeId);
  console.log(`  Del type: PHP=${delTypePhpId} Node=${delTypeNodeId}`);

  // Add columns to mainType via the canonical _d_req (we need several for alias tests)
  // col1: used for _setalias, _setnull, _setmulti, _setorder, _moveup, _d_attrs, _deletereq
  // col2: second column so _setorder and _moveup have something to work with
  // col3: used for _deletereq test (we delete this one)
  // col4: used for _modifiers test

  // Need a concrete type ID for adding columns (base type 3 = text)
  const ctPhp  = getConcreteType(3, 'php');
  const ctNode = getConcreteType(3, 'node');

  const [col1php, col1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_d_req/${mainPhpId}`,  `_xsrf=${xsrfPhp}&t=${ctPhp}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_d_req/${mainNodeId}`, `_xsrf=${xsrfNode}&t=${ctNode}&JSON=1`, cookieNode()),
  ]);
  const col1PhpId  = Number(col1php.json?.id);
  const col1NodeId = Number(col1node.json?.id);
  if (col1PhpId && col1NodeId) registerIds(col1PhpId, col1NodeId);
  console.log(`  col1: PHP=${col1PhpId} Node=${col1NodeId}`);

  const [col2php, col2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_d_req/${mainPhpId}`,  `_xsrf=${xsrfPhp}&t=${ctPhp}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_d_req/${mainNodeId}`, `_xsrf=${xsrfNode}&t=${ctNode}&JSON=1`, cookieNode()),
  ]);
  const col2PhpId  = Number(col2php.json?.id);
  const col2NodeId = Number(col2node.json?.id);
  if (col2PhpId && col2NodeId) registerIds(col2PhpId, col2NodeId);
  console.log(`  col2: PHP=${col2PhpId} Node=${col2NodeId}`);

  const [col3php, col3node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_d_req/${mainPhpId}`,  `_xsrf=${xsrfPhp}&t=${ctPhp}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_d_req/${mainNodeId}`, `_xsrf=${xsrfNode}&t=${ctNode}&JSON=1`, cookieNode()),
  ]);
  const col3PhpId  = Number(col3php.json?.id);
  const col3NodeId = Number(col3node.json?.id);
  if (col3PhpId && col3NodeId) registerIds(col3PhpId, col3NodeId);
  console.log(`  col3: PHP=${col3PhpId} Node=${col3NodeId}`);

  const [col4php, col4node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_d_req/${mainPhpId}`,  `_xsrf=${xsrfPhp}&t=${ctPhp}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_d_req/${mainNodeId}`, `_xsrf=${xsrfNode}&t=${ctNode}&JSON=1`, cookieNode()),
  ]);
  const col4PhpId  = Number(col4php.json?.id);
  const col4NodeId = Number(col4node.json?.id);
  if (col4PhpId && col4NodeId) registerIds(col4PhpId, col4NodeId);
  console.log(`  col4: PHP=${col4PhpId} Node=${col4NodeId}`);

  // ── _attributes — alias for _d_req ───────────────────────────────────────
  section('_attributes — alias for _d_req (add column to type)');

  // #1 POST /_attributes/:typeId (add a column via alias)
  const [a1php, a1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_attributes/${mainPhpId}`,  `_xsrf=${xsrfPhp}&t=${ctPhp}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_attributes/${mainNodeId}`, `_xsrf=${xsrfNode}&t=${ctNode}&JSON=1`, cookieNode()),
  ]);
  const attrColPhpId  = Number(a1php.json?.id);
  const attrColNodeId = Number(a1node.json?.id);
  if (attrColPhpId && attrColNodeId) registerIds(attrColPhpId, attrColNodeId);
  {
    const diffs = [];
    if (a1php.status !== a1node.status) diffs.push(`status: PHP=${a1php.status} Node=${a1node.status}`);
    if (!attrColPhpId)  diffs.push('PHP did not return column id');
    if (!attrColNodeId) diffs.push('Node did not return column id');
    if (a1php.json && a1node.json) {
      const pk = Object.keys(a1php.json).sort().join(',');
      const nk = Object.keys(a1node.json).sort().join(',');
      if (pk !== nk) diffs.push(`keys: PHP=[${pk}] Node=[${nk}]`);
    }
    pushResult('#1 POST /_attributes/:typeId (add column)', 'POST',
      `/${DB_PHP}/_attributes/${mainPhpId}`, `/${DB_NODE}/_attributes/${mainNodeId}`,
      a1php, a1node, diffs);
  }

  // #2 _attributes with nonexistent typeId → error
  const [a2php, a2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_attributes/999999999`,  `_xsrf=${xsrfPhp}&t=${ctPhp}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_attributes/999999999`, `_xsrf=${xsrfNode}&t=${ctNode}&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (a2php.status !== a2node.status) diffs.push(`status: PHP=${a2php.status} Node=${a2node.status}`);
    pushResult('#2 POST /_attributes (nonexistent typeId)', 'POST',
      `/${DB_PHP}/_attributes/999999999`, `/${DB_NODE}/_attributes/999999999`,
      a2php, a2node, diffs);
  }

  // ── _setalias — alias for _d_alias ───────────────────────────────────────
  section('_setalias — alias for _d_alias (rename column)');

  const newAlias = `${PREFIX}renamed_col_${TS}`;
  // #3 POST /_setalias/:reqId (rename a column)
  const [s1php, s1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_setalias/${col1PhpId}`,  `_xsrf=${xsrfPhp}&val=${encodeURIComponent(newAlias)}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_setalias/${col1NodeId}`, `_xsrf=${xsrfNode}&val=${encodeURIComponent(newAlias)}&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (s1php.status !== s1node.status) diffs.push(`status: PHP=${s1php.status} Node=${s1node.status}`);
    if (s1php.json && s1node.json) {
      const pk = Object.keys(s1php.json).sort().join(',');
      const nk = Object.keys(s1node.json).sort().join(',');
      if (pk !== nk) diffs.push(`keys: PHP=[${pk}] Node=[${nk}]`);
    }
    pushResult('#3 POST /_setalias/:reqId (rename column)', 'POST',
      `/${DB_PHP}/_setalias/${col1PhpId}`, `/${DB_NODE}/_setalias/${col1NodeId}`,
      s1php, s1node, diffs);
  }

  // #4 _setalias with nonexistent reqId → error
  const [s2php, s2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_setalias/999999999`,  `_xsrf=${xsrfPhp}&val=X&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_setalias/999999999`, `_xsrf=${xsrfNode}&val=X&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (s2php.status !== s2node.status) diffs.push(`status: PHP=${s2php.status} Node=${s2node.status}`);
    pushResult('#4 POST /_setalias (nonexistent reqId)', 'POST',
      `/${DB_PHP}/_setalias/999999999`, `/${DB_NODE}/_setalias/999999999`,
      s2php, s2node, diffs);
  }

  // ── _setnull — alias for _d_null ─────────────────────────────────────────
  section('_setnull — alias for _d_null (toggle NOT NULL flag)');

  // #5 POST /_setnull/:reqId (toggle NOT NULL)
  const [n1php, n1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_setnull/${col1PhpId}`,  `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_setnull/${col1NodeId}`, `_xsrf=${xsrfNode}&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (n1php.status !== n1node.status) diffs.push(`status: PHP=${n1php.status} Node=${n1node.status}`);
    if (n1php.json && n1node.json) {
      const pk = Object.keys(n1php.json).sort().join(',');
      const nk = Object.keys(n1node.json).sort().join(',');
      if (pk !== nk) diffs.push(`keys: PHP=[${pk}] Node=[${nk}]`);
    }
    pushResult('#5 POST /_setnull/:reqId (toggle NOT NULL)', 'POST',
      `/${DB_PHP}/_setnull/${col1PhpId}`, `/${DB_NODE}/_setnull/${col1NodeId}`,
      n1php, n1node, diffs);
  }

  // #6 _setnull with nonexistent reqId → error
  const [n2php, n2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_setnull/999999999`,  `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_setnull/999999999`, `_xsrf=${xsrfNode}&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (n2php.status !== n2node.status) diffs.push(`status: PHP=${n2php.status} Node=${n2node.status}`);
    pushResult('#6 POST /_setnull (nonexistent reqId)', 'POST',
      `/${DB_PHP}/_setnull/999999999`, `/${DB_NODE}/_setnull/999999999`,
      n2php, n2node, diffs);
  }

  // ── _setmulti — alias for _d_multi ───────────────────────────────────────
  section('_setmulti — alias for _d_multi (toggle multiselect flag)');

  // #7 POST /_setmulti/:reqId (toggle multiselect)
  const [m1php, m1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_setmulti/${col2PhpId}`,  `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_setmulti/${col2NodeId}`, `_xsrf=${xsrfNode}&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (m1php.status !== m1node.status) diffs.push(`status: PHP=${m1php.status} Node=${m1node.status}`);
    if (m1php.json && m1node.json) {
      const pk = Object.keys(m1php.json).sort().join(',');
      const nk = Object.keys(m1node.json).sort().join(',');
      if (pk !== nk) diffs.push(`keys: PHP=[${pk}] Node=[${nk}]`);
    }
    pushResult('#7 POST /_setmulti/:reqId (toggle multiselect)', 'POST',
      `/${DB_PHP}/_setmulti/${col2PhpId}`, `/${DB_NODE}/_setmulti/${col2NodeId}`,
      m1php, m1node, diffs);
  }

  // #8 _setmulti with nonexistent reqId → error
  const [m2php, m2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_setmulti/999999999`,  `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_setmulti/999999999`, `_xsrf=${xsrfNode}&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (m2php.status !== m2node.status) diffs.push(`status: PHP=${m2php.status} Node=${m2node.status}`);
    pushResult('#8 POST /_setmulti (nonexistent reqId)', 'POST',
      `/${DB_PHP}/_setmulti/999999999`, `/${DB_NODE}/_setmulti/999999999`,
      m2php, m2node, diffs);
  }

  // ── _setorder — alias for _d_ord ─────────────────────────────────────────
  section('_setorder — alias for _d_ord (reorder column)');

  // #9 POST /_setorder/:reqId (set column order)
  const [o1php, o1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_setorder/${col2PhpId}`,  `_xsrf=${xsrfPhp}&ord=2&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_setorder/${col2NodeId}`, `_xsrf=${xsrfNode}&ord=2&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (o1php.status !== o1node.status) diffs.push(`status: PHP=${o1php.status} Node=${o1node.status}`);
    if (o1php.json && o1node.json) {
      const pk = Object.keys(o1php.json).sort().join(',');
      const nk = Object.keys(o1node.json).sort().join(',');
      if (pk !== nk) diffs.push(`keys: PHP=[${pk}] Node=[${nk}]`);
    }
    pushResult('#9 POST /_setorder/:reqId (reorder column)', 'POST',
      `/${DB_PHP}/_setorder/${col2PhpId}`, `/${DB_NODE}/_setorder/${col2NodeId}`,
      o1php, o1node, diffs);
  }

  // #10 _setorder with nonexistent reqId → error
  const [o2php, o2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_setorder/999999999`,  `_xsrf=${xsrfPhp}&ord=1&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_setorder/999999999`, `_xsrf=${xsrfNode}&ord=1&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (o2php.status !== o2node.status) diffs.push(`status: PHP=${o2php.status} Node=${o2node.status}`);
    pushResult('#10 POST /_setorder (nonexistent reqId)', 'POST',
      `/${DB_PHP}/_setorder/999999999`, `/${DB_NODE}/_setorder/999999999`,
      o2php, o2node, diffs);
  }

  // ── _moveup — alias for _d_up ─────────────────────────────────────────────
  section('_moveup — alias for _d_up (move column up)');

  // #11 POST /_moveup/:reqId (move column up in order)
  const [u1php, u1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_moveup/${col3PhpId}`,  `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_moveup/${col3NodeId}`, `_xsrf=${xsrfNode}&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (u1php.status !== u1node.status) diffs.push(`status: PHP=${u1php.status} Node=${u1node.status}`);
    if (u1php.json && u1node.json) {
      const pk = Object.keys(u1php.json).sort().join(',');
      const nk = Object.keys(u1node.json).sort().join(',');
      if (pk !== nk) diffs.push(`keys: PHP=[${pk}] Node=[${nk}]`);
    }
    pushResult('#11 POST /_moveup/:reqId (move column up)', 'POST',
      `/${DB_PHP}/_moveup/${col3PhpId}`, `/${DB_NODE}/_moveup/${col3NodeId}`,
      u1php, u1node, diffs);
  }

  // #12 _moveup with nonexistent reqId → error
  const [u2php, u2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_moveup/999999999`,  `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_moveup/999999999`, `_xsrf=${xsrfNode}&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (u2php.status !== u2node.status) diffs.push(`status: PHP=${u2php.status} Node=${u2node.status}`);
    pushResult('#12 POST /_moveup (nonexistent reqId)', 'POST',
      `/${DB_PHP}/_moveup/999999999`, `/${DB_NODE}/_moveup/999999999`,
      u2php, u2node, diffs);
  }

  // ── _modifiers — alias for _d_attrs ──────────────────────────────────────
  section('_modifiers — alias for _d_attrs (set column attrs)');

  // #13 POST /_modifiers/:reqId (set column attrs val=:!NULL:)
  const [mod1php, mod1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_modifiers/${col4PhpId}`,  `_xsrf=${xsrfPhp}&val=${encodeURIComponent(':!NULL:')}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_modifiers/${col4NodeId}`, `_xsrf=${xsrfNode}&val=${encodeURIComponent(':!NULL:')}&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (mod1php.status !== mod1node.status) diffs.push(`status: PHP=${mod1php.status} Node=${mod1node.status}`);
    if (mod1php.json && mod1node.json) {
      const pk = Object.keys(mod1php.json).sort().join(',');
      const nk = Object.keys(mod1node.json).sort().join(',');
      if (pk !== nk) diffs.push(`keys: PHP=[${pk}] Node=[${nk}]`);
    }
    pushResult('#13 POST /_modifiers/:reqId (set attrs :!NULL:)', 'POST',
      `/${DB_PHP}/_modifiers/${col4PhpId}`, `/${DB_NODE}/_modifiers/${col4NodeId}`,
      mod1php, mod1node, diffs);
  }

  // #14 _modifiers without XSRF — these aliases DO require XSRF (unlike _terms/_references/_patchterm)
  const [mod2php, mod2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_modifiers/${col4PhpId}`,  `val=${encodeURIComponent(':!NULL:')}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_modifiers/${col4NodeId}`, `val=${encodeURIComponent(':!NULL:')}&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (mod2php.status !== mod2node.status) diffs.push(`status: PHP=${mod2php.status} Node=${mod2node.status}`);
    pushResult('#14 POST /_modifiers (no xsrf — should reject)', 'POST',
      `/${DB_PHP}/_modifiers/${col4PhpId}`, `/${DB_NODE}/_modifiers/${col4NodeId}`,
      mod2php, mod2node, diffs);
  }

  // #15 _modifiers with nonexistent reqId → error
  const [mod3php, mod3node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_modifiers/999999999`,  `_xsrf=${xsrfPhp}&val=X&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_modifiers/999999999`, `_xsrf=${xsrfNode}&val=X&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (mod3php.status !== mod3node.status) diffs.push(`status: PHP=${mod3php.status} Node=${mod3node.status}`);
    pushResult('#15 POST /_modifiers (nonexistent reqId)', 'POST',
      `/${DB_PHP}/_modifiers/999999999`, `/${DB_NODE}/_modifiers/999999999`,
      mod3php, mod3node, diffs);
  }

  // ── _deletereq — alias for _d_del_req ────────────────────────────────────
  section('_deletereq — alias for _d_del_req (delete column)');

  // #16 POST /_deletereq/:reqId (delete column)
  const [dr1php, dr1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_deletereq/${col3PhpId}`,  `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_deletereq/${col3NodeId}`, `_xsrf=${xsrfNode}&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (dr1php.status !== dr1node.status) diffs.push(`status: PHP=${dr1php.status} Node=${dr1node.status}`);
    if (dr1php.json && dr1node.json) {
      const pk = Object.keys(dr1php.json).sort().join(',');
      const nk = Object.keys(dr1node.json).sort().join(',');
      if (pk !== nk) diffs.push(`keys: PHP=[${pk}] Node=[${nk}]`);
    }
    pushResult('#16 POST /_deletereq/:reqId (delete column)', 'POST',
      `/${DB_PHP}/_deletereq/${col3PhpId}`, `/${DB_NODE}/_deletereq/${col3NodeId}`,
      dr1php, dr1node, diffs);
  }

  // #17 _deletereq with nonexistent reqId → error
  const [dr2php, dr2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_deletereq/999999999`,  `_xsrf=${xsrfPhp}&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_deletereq/999999999`, `_xsrf=${xsrfNode}&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (dr2php.status !== dr2node.status) diffs.push(`status: PHP=${dr2php.status} Node=${dr2node.status}`);
    pushResult('#17 POST /_deletereq (nonexistent reqId)', 'POST',
      `/${DB_PHP}/_deletereq/999999999`, `/${DB_NODE}/_deletereq/999999999`,
      dr2php, dr2node, diffs);
  }

  // ── _deleteterm — alias for _d_del ───────────────────────────────────────
  section('_deleteterm — alias for _d_del (delete type)');

  // #18 POST /_deleteterm/:typeId (delete a type)
  const [del1php, del1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_deleteterm/${delTypePhpId}`,  `_xsrf=${xsrfPhp}&forced=1&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_deleteterm/${delTypeNodeId}`, `_xsrf=${xsrfNode}&forced=1&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (del1php.status !== del1node.status) diffs.push(`status: PHP=${del1php.status} Node=${del1node.status}`);
    if (del1php.json && del1node.json) {
      const pk = Object.keys(del1php.json).sort().join(',');
      const nk = Object.keys(del1node.json).sort().join(',');
      if (pk !== nk) diffs.push(`keys: PHP=[${pk}] Node=[${nk}]`);
    }
    pushResult('#18 POST /_deleteterm/:typeId (delete type)', 'POST',
      `/${DB_PHP}/_deleteterm/${delTypePhpId}`, `/${DB_NODE}/_deleteterm/${delTypeNodeId}`,
      del1php, del1node, diffs);
  }

  // #19 Verify deleted type is gone from both
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'GET', `/${DB_PHP}/terms?JSON=1`,  null, cookie()),
      http(NODE, 'GET', `/${DB_NODE}/terms?JSON=1`, null, cookieNode()),
    ]);
    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    if (phpRes.json && Array.isArray(phpRes.json)) {
      const found = phpRes.json.find(t => String(t.id) === String(delTypePhpId));
      if (found) diffs.push(`PHP: deleted type ${delTypePhpId} still exists`);
    }
    if (nodeRes.json && Array.isArray(nodeRes.json)) {
      const found = nodeRes.json.find(t => String(t.id) === String(delTypeNodeId));
      if (found) diffs.push(`Node: deleted type ${delTypeNodeId} still exists`);
    }
    pushResult('#19 GET /terms (deleted type gone from both)', 'GET',
      `/${DB_PHP}/terms?JSON=1`, `/${DB_NODE}/terms?JSON=1`,
      phpRes, nodeRes, diffs);
  }

  // #20 _deleteterm with nonexistent typeId → error
  const [del2php, del2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_deleteterm/999999999`,  `_xsrf=${xsrfPhp}&forced=1&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_deleteterm/999999999`, `_xsrf=${xsrfNode}&forced=1&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (del2php.status !== del2node.status) diffs.push(`status: PHP=${del2php.status} Node=${del2node.status}`);
    pushResult('#20 POST /_deleteterm (nonexistent typeId)', 'POST',
      `/${DB_PHP}/_deleteterm/999999999`, `/${DB_NODE}/_deleteterm/999999999`,
      del2php, del2node, diffs);
  }

  // ── Auth errors — aliases require XSRF ───────────────────────────────────
  section('Aliases — Auth errors (XSRF required)');

  // #21 _setalias without XSRF → rejected
  const [e1php, e1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_setalias/${col1PhpId}`,  `val=X&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_setalias/${col1NodeId}`, `val=X&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (e1php.status !== e1node.status) diffs.push(`status: PHP=${e1php.status} Node=${e1node.status}`);
    pushResult('#21 POST /_setalias (no xsrf — should reject)', 'POST',
      `/${DB_PHP}/_setalias/${col1PhpId}`, `/${DB_NODE}/_setalias/${col1NodeId}`,
      e1php, e1node, diffs);
  }

  // #22 _setnull without XSRF → rejected
  const [e2php, e2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_setnull/${col1PhpId}`,  `JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_setnull/${col1NodeId}`, `JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (e2php.status !== e2node.status) diffs.push(`status: PHP=${e2php.status} Node=${e2node.status}`);
    pushResult('#22 POST /_setnull (no xsrf — should reject)', 'POST',
      `/${DB_PHP}/_setnull/${col1PhpId}`, `/${DB_NODE}/_setnull/${col1NodeId}`,
      e2php, e2node, diffs);
  }

  // #23 _deleteterm without XSRF → rejected
  // Use mainPhpId since delTypePhpId is already gone; but we don't want to actually delete it,
  // so use a dummy nonexistent id — the XSRF check should happen before the DB lookup.
  const [e3php, e3node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/_deleteterm/999999998`,  `forced=1&JSON=1`, cookie()),
    http(NODE, 'POST', `/${DB_NODE}/_deleteterm/999999998`, `forced=1&JSON=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (e3php.status !== e3node.status) diffs.push(`status: PHP=${e3php.status} Node=${e3node.status}`);
    pushResult('#23 POST /_deleteterm (no xsrf — should reject)', 'POST',
      `/${DB_PHP}/_deleteterm/999999998`, `/${DB_NODE}/_deleteterm/999999998`,
      e3php, e3node, diffs);
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '49-more-legacy-aliases-results.md'), generateMD('49-more-legacy-aliases — More Legacy URL Aliases'));
  writeReports('49-more-legacy-aliases', join(dir, '..', 'reports'));
  console.log(`\nWrote 49-more-legacy-aliases-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
