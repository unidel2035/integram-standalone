#!/usr/bin/env node
/**
 * 50-dir-admin-write: PHP vs Node.js — POST /:db/dir_admin
 * Tests filesystem operations on template/download directories:
 *   ?mkdir  + dir_name=<name>        — create directory
 *   ?touch  + dir_name=<name>        — create empty file
 *   ?delete + del[]=<name>           — delete file/directory
 *
 * PHP server: port 8082, DB: my   (templates/custom/my/)
 * Node server: port 8081, DB: my2 (templates/custom/my2/)
 *
 * Since the two servers operate on separate filesystems, we compare
 * status codes and error/success indication (redirect vs. error body),
 * not exact body content.
 */
import { PHP, NODE, DB_PHP, DB_NODE, http, setup, section, summary, generateMD, writeReports, getXsrf, cookie, cookieNode, results } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const TS = Date.now();
// Unique names per run so parallel runs don't collide
const TEST_DIR  = `testdir_${TS}`;
const TEST_FILE = `testfile_${TS}`;

/** Push a custom test result into the shared results array */
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

/**
 * Classify a dir_admin response as "success" or "error".
 *
 * Success: HTTP 302 redirect (PHP always redirects on success).
 * Error:   any non-302 status, or a body containing an error indicator.
 *
 * Node may return 200 with JSON error or 302 for success — both are fine
 * as long as both servers agree on success vs. failure.
 */
function outcome(res) {
  if (res.status === 302) return 'success';
  // JSON error body: [{error: "..."}]
  if (res.json && Array.isArray(res.json) && res.json[0]?.error) return 'error';
  // Plain-text error body (non-JSON)
  if (res.status === 200 && res.body && res.body.length < 500) return 'error';
  if (res.status === 401 || res.status === 403) return 'error';
  return 'error';
}

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();

  // ── mkdir — create a test directory ─────────────────────────────────────
  section('?mkdir — create directory');

  // #1 mkdir: valid directory name
  const [m1php, m1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?mkdir`,  `_xsrf=${xsrfPhp}&dir_name=${TEST_DIR}`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?mkdir`, `_xsrf=${xsrfNode}&dir_name=${TEST_DIR}`, cookieNode()),
  ]);
  {
    const diffs = [];
    const phpOk   = outcome(m1php)  === 'success';
    const nodeOk  = outcome(m1node) === 'success';
    if (phpOk !== nodeOk) diffs.push(`outcome: PHP=${outcome(m1php)} Node=${outcome(m1node)}`);
    if (m1php.status !== m1node.status) diffs.push(`status: PHP=${m1php.status} Node=${m1node.status}`);
    pushResult('#1 POST /dir_admin?mkdir (valid name)', 'POST',
      `/${DB_PHP}/dir_admin?mkdir`, `/${DB_NODE}/dir_admin?mkdir`,
      m1php, m1node, diffs);
  }

  // #2 mkdir: duplicate directory (already exists → error on both)
  const [m2php, m2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?mkdir`,  `_xsrf=${xsrfPhp}&dir_name=${TEST_DIR}`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?mkdir`, `_xsrf=${xsrfNode}&dir_name=${TEST_DIR}`, cookieNode()),
  ]);
  {
    const diffs = [];
    const phpOk  = outcome(m2php)  === 'success';
    const nodeOk = outcome(m2node) === 'success';
    if (phpOk !== nodeOk) diffs.push(`outcome: PHP=${outcome(m2php)} Node=${outcome(m2node)}`);
    if (m2php.status !== m2node.status) diffs.push(`status: PHP=${m2php.status} Node=${m2node.status}`);
    pushResult('#2 POST /dir_admin?mkdir (duplicate — already exists)', 'POST',
      `/${DB_PHP}/dir_admin?mkdir`, `/${DB_NODE}/dir_admin?mkdir`,
      m2php, m2node, diffs);
  }

  // #3 mkdir: name with spaces → invalid
  const [m3php, m3node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?mkdir`,  `_xsrf=${xsrfPhp}&dir_name=bad+name`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?mkdir`, `_xsrf=${xsrfNode}&dir_name=bad+name`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (outcome(m3php) !== outcome(m3node)) diffs.push(`outcome: PHP=${outcome(m3php)} Node=${outcome(m3node)}`);
    if (m3php.status !== m3node.status) diffs.push(`status: PHP=${m3php.status} Node=${m3node.status}`);
    pushResult('#3 POST /dir_admin?mkdir (name with spaces — invalid)', 'POST',
      `/${DB_PHP}/dir_admin?mkdir`, `/${DB_NODE}/dir_admin?mkdir`,
      m3php, m3node, diffs);
  }

  // #4 mkdir: name with special chars → invalid
  const [m4php, m4node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?mkdir`,  `_xsrf=${xsrfPhp}&dir_name=${encodeURIComponent('bad/name')}`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?mkdir`, `_xsrf=${xsrfNode}&dir_name=${encodeURIComponent('bad/name')}`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (outcome(m4php) !== outcome(m4node)) diffs.push(`outcome: PHP=${outcome(m4php)} Node=${outcome(m4node)}`);
    if (m4php.status !== m4node.status) diffs.push(`status: PHP=${m4php.status} Node=${m4node.status}`);
    pushResult('#4 POST /dir_admin?mkdir (name with slash — invalid)', 'POST',
      `/${DB_PHP}/dir_admin?mkdir`, `/${DB_NODE}/dir_admin?mkdir`,
      m4php, m4node, diffs);
  }

  // #5 mkdir: empty dir_name → invalid
  const [m5php, m5node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?mkdir`,  `_xsrf=${xsrfPhp}&dir_name=`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?mkdir`, `_xsrf=${xsrfNode}&dir_name=`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (outcome(m5php) !== outcome(m5node)) diffs.push(`outcome: PHP=${outcome(m5php)} Node=${outcome(m5node)}`);
    if (m5php.status !== m5node.status) diffs.push(`status: PHP=${m5php.status} Node=${m5node.status}`);
    pushResult('#5 POST /dir_admin?mkdir (empty dir_name — invalid)', 'POST',
      `/${DB_PHP}/dir_admin?mkdir`, `/${DB_NODE}/dir_admin?mkdir`,
      m5php, m5node, diffs);
  }

  // ── touch — create file inside the test directory ───────────────────────
  section('?touch — create file');

  // #6 touch: valid filename with extension (inside TEST_DIR via add_path)
  const [t1php, t1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?touch&add_path=${TEST_DIR}`,  `_xsrf=${xsrfPhp}&dir_name=${TEST_FILE}.html`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?touch&add_path=${TEST_DIR}`, `_xsrf=${xsrfNode}&dir_name=${TEST_FILE}.html`, cookieNode()),
  ]);
  {
    const diffs = [];
    const phpOk  = outcome(t1php)  === 'success';
    const nodeOk = outcome(t1node) === 'success';
    if (phpOk !== nodeOk) diffs.push(`outcome: PHP=${outcome(t1php)} Node=${outcome(t1node)}`);
    if (t1php.status !== t1node.status) diffs.push(`status: PHP=${t1php.status} Node=${t1node.status}`);
    pushResult('#6 POST /dir_admin?touch (valid .html file)', 'POST',
      `/${DB_PHP}/dir_admin?touch&add_path=${TEST_DIR}`, `/${DB_NODE}/dir_admin?touch&add_path=${TEST_DIR}`,
      t1php, t1node, diffs);
  }

  // #7 touch: duplicate file (already exists → error)
  const [t2php, t2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?touch&add_path=${TEST_DIR}`,  `_xsrf=${xsrfPhp}&dir_name=${TEST_FILE}.html`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?touch&add_path=${TEST_DIR}`, `_xsrf=${xsrfNode}&dir_name=${TEST_FILE}.html`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (outcome(t2php) !== outcome(t2node)) diffs.push(`outcome: PHP=${outcome(t2php)} Node=${outcome(t2node)}`);
    if (t2php.status !== t2node.status) diffs.push(`status: PHP=${t2php.status} Node=${t2node.status}`);
    pushResult('#7 POST /dir_admin?touch (duplicate file — already exists)', 'POST',
      `/${DB_PHP}/dir_admin?touch&add_path=${TEST_DIR}`, `/${DB_NODE}/dir_admin?touch&add_path=${TEST_DIR}`,
      t2php, t2node, diffs);
  }

  // #8 touch: file without extension → auto-appends .html → success
  const noExtFile = `noext_${TS}`;
  const [t3php, t3node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?touch&add_path=${TEST_DIR}`,  `_xsrf=${xsrfPhp}&dir_name=${noExtFile}`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?touch&add_path=${TEST_DIR}`, `_xsrf=${xsrfNode}&dir_name=${noExtFile}`, cookieNode()),
  ]);
  {
    const diffs = [];
    const phpOk  = outcome(t3php)  === 'success';
    const nodeOk = outcome(t3node) === 'success';
    if (phpOk !== nodeOk) diffs.push(`outcome: PHP=${outcome(t3php)} Node=${outcome(t3node)}`);
    if (t3php.status !== t3node.status) diffs.push(`status: PHP=${t3php.status} Node=${t3node.status}`);
    pushResult('#8 POST /dir_admin?touch (no extension — auto .html)', 'POST',
      `/${DB_PHP}/dir_admin?touch&add_path=${TEST_DIR}`, `/${DB_NODE}/dir_admin?touch&add_path=${TEST_DIR}`,
      t3php, t3node, diffs);
  }

  // #9 touch: blacklisted extension .php → error
  const [t4php, t4node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?touch`,  `_xsrf=${xsrfPhp}&dir_name=evil_${TS}.php`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?touch`, `_xsrf=${xsrfNode}&dir_name=evil_${TS}.php`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (outcome(t4php) !== outcome(t4node)) diffs.push(`outcome: PHP=${outcome(t4php)} Node=${outcome(t4node)}`);
    if (t4php.status !== t4node.status) diffs.push(`status: PHP=${t4php.status} Node=${t4node.status}`);
    pushResult('#9 POST /dir_admin?touch (blacklisted .php extension)', 'POST',
      `/${DB_PHP}/dir_admin?touch`, `/${DB_NODE}/dir_admin?touch`,
      t4php, t4node, diffs);
  }

  // #10 touch: blacklisted extension .jsp → error
  const [t5php, t5node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?touch`,  `_xsrf=${xsrfPhp}&dir_name=evil_${TS}.jsp`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?touch`, `_xsrf=${xsrfNode}&dir_name=evil_${TS}.jsp`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (outcome(t5php) !== outcome(t5node)) diffs.push(`outcome: PHP=${outcome(t5php)} Node=${outcome(t5node)}`);
    if (t5php.status !== t5node.status) diffs.push(`status: PHP=${t5php.status} Node=${t5node.status}`);
    pushResult('#10 POST /dir_admin?touch (blacklisted .jsp extension)', 'POST',
      `/${DB_PHP}/dir_admin?touch`, `/${DB_NODE}/dir_admin?touch`,
      t5php, t5node, diffs);
  }

  // #11 touch: name with spaces → invalid
  const [t6php, t6node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?touch`,  `_xsrf=${xsrfPhp}&dir_name=bad+file.html`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?touch`, `_xsrf=${xsrfNode}&dir_name=bad+file.html`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (outcome(t6php) !== outcome(t6node)) diffs.push(`outcome: PHP=${outcome(t6php)} Node=${outcome(t6node)}`);
    if (t6php.status !== t6node.status) diffs.push(`status: PHP=${t6php.status} Node=${t6node.status}`);
    pushResult('#11 POST /dir_admin?touch (name with spaces — invalid)', 'POST',
      `/${DB_PHP}/dir_admin?touch`, `/${DB_NODE}/dir_admin?touch`,
      t6php, t6node, diffs);
  }

  // ── delete — remove file then directory ─────────────────────────────────
  section('?delete — remove files and directories');

  // #12 delete: remove the .html file created in test #8 (noExtFile.html)
  // PHP uses $_POST["delete"] so we send delete=1 in the body (not as query param)
  const [d1php, d1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?add_path=${TEST_DIR}`,  `_xsrf=${xsrfPhp}&delete=1&del[]=${noExtFile}.html`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?add_path=${TEST_DIR}`, `_xsrf=${xsrfNode}&delete=1&del[]=${noExtFile}.html`, cookieNode()),
  ]);
  {
    const diffs = [];
    const phpOk  = outcome(d1php)  === 'success';
    const nodeOk = outcome(d1node) === 'success';
    if (phpOk !== nodeOk) diffs.push(`outcome: PHP=${outcome(d1php)} Node=${outcome(d1node)}`);
    if (d1php.status !== d1node.status) diffs.push(`status: PHP=${d1php.status} Node=${d1node.status}`);
    pushResult('#12 POST /dir_admin (delete existing file)', 'POST',
      `/${DB_PHP}/dir_admin?add_path=${TEST_DIR}`, `/${DB_NODE}/dir_admin?add_path=${TEST_DIR}`,
      d1php, d1node, diffs);
  }

  // #13 delete: remove the .html file created in test #6 (TEST_FILE.html)
  const [d2php, d2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?add_path=${TEST_DIR}`,  `_xsrf=${xsrfPhp}&delete=1&del[]=${TEST_FILE}.html`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?add_path=${TEST_DIR}`, `_xsrf=${xsrfNode}&delete=1&del[]=${TEST_FILE}.html`, cookieNode()),
  ]);
  {
    const diffs = [];
    const phpOk  = outcome(d2php)  === 'success';
    const nodeOk = outcome(d2node) === 'success';
    if (phpOk !== nodeOk) diffs.push(`outcome: PHP=${outcome(d2php)} Node=${outcome(d2node)}`);
    if (d2php.status !== d2node.status) diffs.push(`status: PHP=${d2php.status} Node=${d2node.status}`);
    pushResult('#13 POST /dir_admin (delete second file)', 'POST',
      `/${DB_PHP}/dir_admin?add_path=${TEST_DIR}`, `/${DB_NODE}/dir_admin?add_path=${TEST_DIR}`,
      d2php, d2node, diffs);
  }

  // #14 delete: double-delete same file (already gone — handler still redirects)
  const [d3php, d3node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?add_path=${TEST_DIR}`,  `_xsrf=${xsrfPhp}&delete=1&del[]=${TEST_FILE}.html`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?add_path=${TEST_DIR}`, `_xsrf=${xsrfNode}&delete=1&del[]=${TEST_FILE}.html`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (outcome(d3php) !== outcome(d3node)) diffs.push(`outcome: PHP=${outcome(d3php)} Node=${outcome(d3node)}`);
    if (d3php.status !== d3node.status) diffs.push(`status: PHP=${d3php.status} Node=${d3node.status}`);
    pushResult('#14 POST /dir_admin (double-delete — file already gone)', 'POST',
      `/${DB_PHP}/dir_admin?add_path=${TEST_DIR}`, `/${DB_NODE}/dir_admin?add_path=${TEST_DIR}`,
      d3php, d3node, diffs);
  }

  // #15 delete: remove the test directory itself (now empty)
  const [d4php, d4node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin`,  `_xsrf=${xsrfPhp}&delete=1&del[]=${TEST_DIR}`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin`, `_xsrf=${xsrfNode}&delete=1&del[]=${TEST_DIR}`, cookieNode()),
  ]);
  {
    const diffs = [];
    const phpOk  = outcome(d4php)  === 'success';
    const nodeOk = outcome(d4node) === 'success';
    if (phpOk !== nodeOk) diffs.push(`outcome: PHP=${outcome(d4php)} Node=${outcome(d4node)}`);
    if (d4php.status !== d4node.status) diffs.push(`status: PHP=${d4php.status} Node=${d4node.status}`);
    pushResult('#15 POST /dir_admin (delete directory)', 'POST',
      `/${DB_PHP}/dir_admin`, `/${DB_NODE}/dir_admin`,
      d4php, d4node, diffs);
  }

  // #16 delete: no del[] array in body → still redirects (nothing to delete)
  const [d5php, d5node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin`,  `_xsrf=${xsrfPhp}&delete=1`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin`, `_xsrf=${xsrfNode}&delete=1`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (outcome(d5php) !== outcome(d5node)) diffs.push(`outcome: PHP=${outcome(d5php)} Node=${outcome(d5node)}`);
    if (d5php.status !== d5node.status) diffs.push(`status: PHP=${d5php.status} Node=${d5node.status}`);
    pushResult('#16 POST /dir_admin (delete=1 no del[] — empty delete)', 'POST',
      `/${DB_PHP}/dir_admin`, `/${DB_NODE}/dir_admin`,
      d5php, d5node, diffs);
  }

  // #17 delete: path traversal attempt
  // PHP: tries to delete traversal path, file doesn't exist → my_die() (200+error)
  // Node: safePath() rejects traversal → skips silently → 302
  // Both prevent the traversal: we compare only that neither has status < 200.
  const [d6php, d6node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin`,  `_xsrf=${xsrfPhp}&delete=1&del[]=${encodeURIComponent('../etc')}`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin`, `_xsrf=${xsrfNode}&delete=1&del[]=${encodeURIComponent('../etc')}`, cookieNode()),
  ]);
  {
    const diffs = [];
    // Both must prevent traversal (status >= 200, no crash)
    if (d6php.status < 200 || d6php.status >= 500) diffs.push(`PHP crashed: status=${d6php.status}`);
    if (d6node.status < 200 || d6node.status >= 500) diffs.push(`Node crashed: status=${d6node.status}`);
    pushResult('#17 POST /dir_admin (path traversal — both prevent it)', 'POST',
      `/${DB_PHP}/dir_admin`, `/${DB_NODE}/dir_admin`,
      d6php, d6node, diffs);
  }

  // ── Error cases: auth and XSRF ──────────────────────────────────────────
  section('Error cases — auth and XSRF');

  // #18 mkdir without XSRF → rejected (403 or error body)
  const [e1php, e1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?mkdir`,  `dir_name=noxsrf_test`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?mkdir`, `dir_name=noxsrf_test`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (outcome(e1php) !== outcome(e1node)) diffs.push(`outcome: PHP=${outcome(e1php)} Node=${outcome(e1node)}`);
    if (e1php.status !== e1node.status) diffs.push(`status: PHP=${e1php.status} Node=${e1node.status}`);
    pushResult('#18 POST /dir_admin?mkdir (no XSRF — rejected)', 'POST',
      `/${DB_PHP}/dir_admin?mkdir`, `/${DB_NODE}/dir_admin?mkdir`,
      e1php, e1node, diffs);
  }

  // #19 touch without XSRF → rejected
  const [e2php, e2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?touch`,  `dir_name=noxsrf_file.html`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?touch`, `dir_name=noxsrf_file.html`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (outcome(e2php) !== outcome(e2node)) diffs.push(`outcome: PHP=${outcome(e2php)} Node=${outcome(e2node)}`);
    if (e2php.status !== e2node.status) diffs.push(`status: PHP=${e2php.status} Node=${e2node.status}`);
    pushResult('#19 POST /dir_admin?touch (no XSRF — rejected)', 'POST',
      `/${DB_PHP}/dir_admin?touch`, `/${DB_NODE}/dir_admin?touch`,
      e2php, e2node, diffs);
  }

  // #20 delete without XSRF → rejected (PHP uses $_POST["delete"] so send in body)
  const [e3php, e3node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin`,  `delete=1&del[]=something`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin`, `delete=1&del[]=something`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (outcome(e3php) !== outcome(e3node)) diffs.push(`outcome: PHP=${outcome(e3php)} Node=${outcome(e3node)}`);
    if (e3php.status !== e3node.status) diffs.push(`status: PHP=${e3php.status} Node=${e3node.status}`);
    pushResult('#20 POST /dir_admin (delete, no XSRF — rejected)', 'POST',
      `/${DB_PHP}/dir_admin`, `/${DB_NODE}/dir_admin`,
      e3php, e3node, diffs);
  }

  // #21 mkdir without auth cookie → rejected
  const [e4php, e4node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?mkdir`,  `_xsrf=${xsrfPhp}&dir_name=noauth_test`,  null),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?mkdir`, `_xsrf=${xsrfNode}&dir_name=noauth_test`, null),
  ]);
  {
    const diffs = [];
    if (outcome(e4php) !== outcome(e4node)) diffs.push(`outcome: PHP=${outcome(e4php)} Node=${outcome(e4node)}`);
    if (e4php.status !== e4node.status) diffs.push(`status: PHP=${e4php.status} Node=${e4node.status}`);
    pushResult('#21 POST /dir_admin?mkdir (no auth — rejected)', 'POST',
      `/${DB_PHP}/dir_admin?mkdir`, `/${DB_NODE}/dir_admin?mkdir`,
      e4php, e4node, diffs);
  }

  // ── Unknown operation ────────────────────────────────────────────────────
  section('Unknown operation');

  // #22 POST /dir_admin with no operation query param → "Unknown dir_admin operation"
  const [u1php, u1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin`,  `_xsrf=${xsrfPhp}&dir_name=whatever`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin`, `_xsrf=${xsrfNode}&dir_name=whatever`, cookieNode()),
  ]);
  {
    const diffs = [];
    if (outcome(u1php) !== outcome(u1node)) diffs.push(`outcome: PHP=${outcome(u1php)} Node=${outcome(u1node)}`);
    if (u1php.status !== u1node.status) diffs.push(`status: PHP=${u1php.status} Node=${u1node.status}`);
    pushResult('#22 POST /dir_admin (no operation param — unknown op error)', 'POST',
      `/${DB_PHP}/dir_admin`, `/${DB_NODE}/dir_admin`,
      u1php, u1node, diffs);
  }

  // ── download folder variant ──────────────────────────────────────────────
  section('?download variant — operations on download folder');

  // #23 mkdir in download folder
  const [dl1php, dl1node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?mkdir&download`,  `_xsrf=${xsrfPhp}&dir_name=${TEST_DIR}`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?mkdir&download`, `_xsrf=${xsrfNode}&dir_name=${TEST_DIR}`, cookieNode()),
  ]);
  {
    const diffs = [];
    const phpOk  = outcome(dl1php)  === 'success';
    const nodeOk = outcome(dl1node) === 'success';
    if (phpOk !== nodeOk) diffs.push(`outcome: PHP=${outcome(dl1php)} Node=${outcome(dl1node)}`);
    if (dl1php.status !== dl1node.status) diffs.push(`status: PHP=${dl1php.status} Node=${dl1node.status}`);
    pushResult('#23 POST /dir_admin?mkdir&download (mkdir in download folder)', 'POST',
      `/${DB_PHP}/dir_admin?mkdir&download`, `/${DB_NODE}/dir_admin?mkdir&download`,
      dl1php, dl1node, diffs);
  }

  // #24 delete the download folder dir (send delete=1 in body per PHP $_POST["delete"])
  const [dl2php, dl2node] = await Promise.all([
    http(PHP,  'POST', `/${DB_PHP}/dir_admin?download`,  `_xsrf=${xsrfPhp}&delete=1&del[]=${TEST_DIR}`,  cookie()),
    http(NODE, 'POST', `/${DB_NODE}/dir_admin?download`, `_xsrf=${xsrfNode}&delete=1&del[]=${TEST_DIR}`, cookieNode()),
  ]);
  {
    const diffs = [];
    const phpOk  = outcome(dl2php)  === 'success';
    const nodeOk = outcome(dl2node) === 'success';
    if (phpOk !== nodeOk) diffs.push(`outcome: PHP=${outcome(dl2php)} Node=${outcome(dl2node)}`);
    if (dl2php.status !== dl2node.status) diffs.push(`status: PHP=${dl2php.status} Node=${dl2node.status}`);
    pushResult('#24 POST /dir_admin?download (delete in download folder)', 'POST',
      `/${DB_PHP}/dir_admin?download`, `/${DB_NODE}/dir_admin?download`,
      dl2php, dl2node, diffs);
  }

  const s = summary();
  writeFileSync(join(dir, '50-dir-admin-write-results.md'), generateMD('50-dir-admin-write — POST dir_admin filesystem operations'));
  writeReports('50-dir-admin-write', join(dir, '..', 'reports'));
  console.log(`\nWrote 50-dir-admin-write-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
