#!/usr/bin/env node
/**
 * 48-bki-restore: PHP vs Node.js — BKI import/export & restore
 * Tests: GET /bki-export, POST /bki-import errors, POST /restore errors,
 *        GET /backup status.
 * NOTE: PHP returns 200+HTML for error cases (legacy die()), Node returns 400/403.
 *       We compare "both indicate error" rather than exact status codes.
 */
import { PHP, NODE, DB, DB_PHP, DB_NODE, http, setup, preCleanup, section, summary, generateMD, writeReports, createType, createObj, getXsrf, cookie, cookieNode, results } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__bki_';
const TS = Date.now();

/** Returns true if response indicates an error (PHP uses 200+errorbody, Node uses 4xx) */
function isError(res) {
  if (res.status >= 400) return true;
  if (res.json && Array.isArray(res.json) && res.json[0]?.error) return true;
  if (res.json && res.json.error) return true;
  // PHP returns plain text error or HTML for some errors
  if (res.body && (res.body.includes('permission') || res.body.includes('Загрузите') ||
      res.body.includes('No BKI') || res.body.includes('error'))) return true;
  return false;
}

function pushResult(name, method, phpPath, nodePath, phpRes, nodeRes, diffs) {
  const match = diffs.length === 0;
  const icon = match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m';
  console.log(`  ${icon}  ${name}${diffs.length ? '\n         ' + diffs.join('\n         ') : ''}`);
  results.push({
    name, match, diffs, method,
    phpStatus: phpRes.status, nodeStatus: nodeRes.status,
    phpBody: phpRes.body, nodeBody: nodeRes.body,
    phpJson: phpRes.json, nodeJson: nodeRes.json,
    phpPath, nodePath,
  });
}

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // Setup: type with data
  const mainType = await createType(`${PREFIX}data_${TS}`, 3);
  await createObj(mainType, `${PREFIX}item1`);
  await createObj(mainType, `${PREFIX}item2`);

  // ── BKI Export ────────────────────────────────────────────────────────────
  section('BKI Export');

  // 1. GET /bki-export — both should return 200 with content
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'GET', `/${DB_PHP}/bki-export`,  null, cookie()),
      http(NODE, 'GET', `/${DB_NODE}/bki-export`, null, cookieNode()),
    ]);
    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    if (phpRes.status === 200 && phpRes.body.length === 0) diffs.push('PHP returned empty body');
    if (nodeRes.status === 200 && nodeRes.body.length === 0) diffs.push('Node returned empty body');
    pushResult('#1 GET /bki-export (authenticated)', 'GET', `/${DB_PHP}/bki-export`, `/${DB_NODE}/bki-export`, phpRes, nodeRes, diffs);
  }

  // 2. GET /bki-export without auth — both should deny
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'GET', `/${DB_PHP}/bki-export`,  null, null),
      http(NODE, 'GET', `/${DB_NODE}/bki-export`, null, null),
    ]);
    const diffs = [];
    const phpErr  = phpRes.status >= 300;   // PHP redirects (302) or 403
    const nodeErr = nodeRes.status >= 300;
    if (phpErr !== nodeErr) diffs.push(`both-denied: PHP=${phpRes.status} Node=${nodeRes.status}`);
    pushResult('#2 GET /bki-export (no auth → denied)', 'GET', `/${DB_PHP}/bki-export`, `/${DB_NODE}/bki-export`, phpRes, nodeRes, diffs);
  }

  // ── BKI Import — Error cases ──────────────────────────────────────────────
  section('BKI Import — Error cases');

  // 3. POST /bki-import with no content — both should indicate error
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'POST', `/${DB_PHP}/bki-import`,  `_xsrf=${xsrfPhp}`, cookie()),
      http(NODE, 'POST', `/${DB_NODE}/bki-import`, `_xsrf=${xsrfNode}`, cookieNode()),
    ]);
    const diffs = [];
    const phpErr  = isError(phpRes);
    const nodeErr = isError(nodeRes);
    if (phpErr !== nodeErr) diffs.push(`both-error: PHP=${phpErr}(${phpRes.status}) Node=${nodeErr}(${nodeRes.status})`);
    pushResult('#3 POST /bki-import (no content → error)', 'POST', `/${DB_PHP}/bki-import`, `/${DB_NODE}/bki-import`, phpRes, nodeRes, diffs);
  }

  // 4. POST /bki-import without auth — both should deny
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'POST', `/${DB_PHP}/bki-import`,  null, null),
      http(NODE, 'POST', `/${DB_NODE}/bki-import`, null, null),
    ]);
    const diffs = [];
    const phpDenied  = phpRes.status >= 300;
    const nodeDenied = nodeRes.status >= 300;
    if (phpDenied !== nodeDenied) diffs.push(`both-denied: PHP=${phpRes.status} Node=${nodeRes.status}`);
    pushResult('#4 POST /bki-import (no auth → denied)', 'POST', `/${DB_PHP}/bki-import`, `/${DB_NODE}/bki-import`, phpRes, nodeRes, diffs);
  }

  // 5. POST /bki-import with garbage content — both should indicate error
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'POST', `/${DB_PHP}/bki-import`,  `_xsrf=${xsrfPhp}&content=GARBAGE_NOT_BKI_FORMAT`, cookie()),
      http(NODE, 'POST', `/${DB_NODE}/bki-import`, `_xsrf=${xsrfNode}&content=GARBAGE_NOT_BKI_FORMAT`, cookieNode()),
    ]);
    const diffs = [];
    const phpErr  = isError(phpRes);
    const nodeErr = isError(nodeRes);
    if (phpErr !== nodeErr) diffs.push(`both-error: PHP=${phpErr}(${phpRes.status}) Node=${nodeErr}(${nodeRes.status})`);
    pushResult('#5 POST /bki-import (garbage → error)', 'POST', `/${DB_PHP}/bki-import`, `/${DB_NODE}/bki-import`, phpRes, nodeRes, diffs);
  }

  // ── Restore — Error cases ─────────────────────────────────────────────────
  section('Restore — Error cases');

  // 6. POST /restore with no content — both should indicate error
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'POST', `/${DB_PHP}/restore`,  `_xsrf=${xsrfPhp}`, cookie()),
      http(NODE, 'POST', `/${DB_NODE}/restore`, `_xsrf=${xsrfNode}`, cookieNode()),
    ]);
    const diffs = [];
    const phpErr  = isError(phpRes);
    const nodeErr = isError(nodeRes);
    if (phpErr !== nodeErr) diffs.push(`both-error: PHP=${phpErr}(${phpRes.status}) Node=${nodeErr}(${nodeRes.status})`);
    pushResult('#6 POST /restore (no content → error)', 'POST', `/${DB_PHP}/restore`, `/${DB_NODE}/restore`, phpRes, nodeRes, diffs);
  }

  // 7. POST /restore without auth — both should deny
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'POST', `/${DB_PHP}/restore`,  null, null),
      http(NODE, 'POST', `/${DB_NODE}/restore`, null, null),
    ]);
    const diffs = [];
    const phpDenied  = phpRes.status >= 300;
    const nodeDenied = nodeRes.status >= 300;
    if (phpDenied !== nodeDenied) diffs.push(`both-denied: PHP=${phpRes.status} Node=${nodeRes.status}`);
    pushResult('#7 POST /restore (no auth → denied)', 'POST', `/${DB_PHP}/restore`, `/${DB_NODE}/restore`, phpRes, nodeRes, diffs);
  }

  // 8. POST /restore with nonexistent backup_file — both should indicate error
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'POST', `/${DB_PHP}/restore`,  `_xsrf=${xsrfPhp}&backup_file=nonexistent_does_not_exist.dmp.zip`, cookie()),
      http(NODE, 'POST', `/${DB_NODE}/restore`, `_xsrf=${xsrfNode}&backup_file=nonexistent_does_not_exist.dmp.zip`, cookieNode()),
    ]);
    const diffs = [];
    const phpErr  = isError(phpRes);
    const nodeErr = isError(nodeRes);
    if (phpErr !== nodeErr) diffs.push(`both-error: PHP=${phpErr}(${phpRes.status}) Node=${nodeErr}(${nodeRes.status})`);
    pushResult('#8 POST /restore (nonexistent backup_file → error)', 'POST', `/${DB_PHP}/restore`, `/${DB_NODE}/restore`, phpRes, nodeRes, diffs);
  }

  // 9. POST /restore path traversal — both should reject
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'POST', `/${DB_PHP}/restore`,  `_xsrf=${xsrfPhp}&backup_file=../../etc/passwd`, cookie()),
      http(NODE, 'POST', `/${DB_NODE}/restore`, `_xsrf=${xsrfNode}&backup_file=../../etc/passwd`, cookieNode()),
    ]);
    const diffs = [];
    const phpErr  = isError(phpRes);
    const nodeErr = isError(nodeRes);
    if (phpErr !== nodeErr) diffs.push(`both-error: PHP=${phpErr}(${phpRes.status}) Node=${nodeErr}(${nodeRes.status})`);
    pushResult('#9 POST /restore (path traversal → error)', 'POST', `/${DB_PHP}/restore`, `/${DB_NODE}/restore`, phpRes, nodeRes, diffs);
  }

  // ── Backup ────────────────────────────────────────────────────────────────
  section('Backup');

  // 10. GET /backup — both should return same status
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'GET', `/${DB_PHP}/backup`,  null, cookie()),
      http(NODE, 'GET', `/${DB_NODE}/backup`, null, cookieNode()),
    ]);
    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    pushResult('#10 GET /backup (creates backup)', 'GET', `/${DB_PHP}/backup`, `/${DB_NODE}/backup`, phpRes, nodeRes, diffs);
  }

  // 11. GET /backup without auth — both should deny
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'GET', `/${DB_PHP}/backup`,  null, null),
      http(NODE, 'GET', `/${DB_NODE}/backup`, null, null),
    ]);
    const diffs = [];
    const phpDenied  = phpRes.status >= 300;
    const nodeDenied = nodeRes.status >= 300;
    if (phpDenied !== nodeDenied) diffs.push(`both-denied: PHP=${phpRes.status} Node=${nodeRes.status}`);
    pushResult('#11 GET /backup (no auth → denied)', 'GET', `/${DB_PHP}/backup`, `/${DB_NODE}/backup`, phpRes, nodeRes, diffs);
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '48-bki-restore-results.md'), generateMD('48-bki-restore — BKI Import/Export & Restore'));
  writeReports('48-bki-restore', join(dir, '..', 'reports'));
  console.log(`\nWrote 48-bki-restore-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
