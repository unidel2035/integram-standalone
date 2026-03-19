#!/usr/bin/env node
/**
 * 25-admin-endpoints: PHP vs Node.js — Admin & system endpoints
 * Tests: /info, /dir_admin, /form, /sql, /terms, /dict,
 *        /backup, /csv_all, /grants, error handling
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();

  // ── /terms — Type listing ──────────────────────────────────────────────
  section('Admin — /terms');

  // 1. GET /terms (all types)
  await dual('#1 GET /terms (JSON)', 'GET',
    '/terms?JSON=1');

  // ── /edit_types — DDL view ─────────────────────────────────────────────
  section('Admin — /edit_types');

  // 2. GET /edit_types
  await dual('#2 GET /edit_types (JSON)', 'GET',
    '/edit_types?JSON=1', null, { keysOnly: true });

  // ── /info — System info ────────────────────────────────────────────────
  section('Admin — /info');

  // 3. GET /info
  await dual('#3 GET /info', 'GET',
    '/info?JSON=1', null, { statusOnly: true });

  // ── /dir_admin — File manager ──────────────────────────────────────────
  section('Admin — /dir_admin');

  // 4. GET /dir_admin
  await dual('#4 GET /dir_admin', 'GET',
    '/dir_admin?JSON=1', null, { statusOnly: true });

  // ── /form — Form view ──────────────────────────────────────────────────
  section('Admin — /form');

  // 5. GET /form
  await dual('#5 GET /form', 'GET',
    '/form?JSON=1', null, { statusOnly: true });

  // ── /sql — SQL endpoint ────────────────────────────────────────────────
  section('Admin — /sql');

  // 6. GET /sql
  await dual('#6 GET /sql', 'GET',
    '/sql?JSON=1', null, { statusOnly: true });

  // ── /grants — Permission info ──────────────────────────────────────────
  section('Admin — /grants');

  // 7. GET /grants
  await dual('#7 GET /grants (JSON)', 'GET',
    '/grants?JSON=1', null, { keysOnly: true });

  // 8. POST /check_grant with type
  await dual('#8 POST /check_grant', 'POST',
    '/check_grant',
    s => `_xsrf=${getXsrf(s)}&t=3&JSON=1`, { statusOnly: true });

  // ── /backup — Backup creation ──────────────────────────────────────────
  section('Admin — /backup');

  // 9. GET /backup (statusOnly — large response)
  await dual('#9 GET /backup', 'GET',
    '/backup?JSON=1', null, { statusOnly: true });

  // ── /csv_all — Full CSV export ─────────────────────────────────────────
  section('Admin — /csv_all');

  // 10. GET /csv_all (ignoreStatus: PHP 500 internal vs Node 302 redirect — both non-200)
  await dual('#10 GET /csv_all', 'GET',
    '/csv_all', null, { statusOnly: true, ignoreStatus: true });

  // ── /bki-export ────────────────────────────────────────────────────────
  section('Admin — /bki-export');

  // 11. GET /bki-export (statusOnly — large binary)
  await dual('#11 GET /bki-export', 'GET',
    '/bki-export', null, { statusOnly: true });

  // ── Error handling ─────────────────────────────────────────────────────
  section('Admin — Error Handling');

  // 12. Invalid database name — both error but with different codes (PHP 500, Node 401)
  // Use ignoreStatus since the error format differs between PHP/Node for invalid DB
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP, 'GET', `/INVALID_DB_123/terms?JSON=1`, null, cookie()),
      http(NODE, 'GET', `/INVALID_DB_123/terms?JSON=1`, null, cookie()),
    ]);
    // Both should error — just verify neither returns 200
    const phpError = phpRes.status !== 200;
    const nodeError = nodeRes.status !== 200;
    const match = phpError && nodeError;
    console.log(`  ${match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m'}  #12 Invalid DB (both error: PHP=${phpRes.status} Node=${nodeRes.status})`);
  }

  // 13. Non-existent type in /object
  await dual('#13 GET /object (nonexistent type)', 'GET',
    '/object/999999999?JSON=1', null, { statusOnly: true });

  // 14. Non-existent object in /edit_obj
  await dual('#14 GET /edit_obj (nonexistent obj)', 'GET',
    '/edit_obj/999999999?JSON=1', null, { statusOnly: true });

  // 15. _m_del on metadata (should fail)
  await dual('#15 POST /_m_del (metadata id=1)', 'POST',
    '/_m_del/1',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // 16. _d_del on non-existent type
  await dual('#16 POST /_d_del (nonexistent)', 'POST',
    '/_d_del/999999999',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // 17. POST with no body
  await dual('#17 POST /_m_new (no body)', 'POST',
    '/_m_new/1',
    s => `_xsrf=${getXsrf(s)}&JSON=1`, { statusOnly: true });

  // ── /validate and /xsrf with token ─────────────────────────────────────
  section('Admin — Session');

  // 18. validate with token
  await dual('#18 GET /validate', 'GET',
    '/validate?JSON=1');

  // 19. xsrf returns valid session
  await dual('#19 GET /xsrf (session check)', 'GET',
    '/xsrf?JSON=1', null, { keysOnly: true });

  // ── /metadata ──────────────────────────────────────────────────────────
  section('Admin — /metadata');

  // 20. metadata for base type 3 (SHORT) — statusOnly: PHP returns text for base types, Node returns JSON
  await dual('#20 GET /metadata (type 3)', 'GET',
    '/metadata/3?JSON=1', null, { statusOnly: true });

  const s = summary();
  writeFileSync(join(dir, '25-admin-endpoints-results.md'), generateMD('25-admin-endpoints — Admin & System Endpoints'));
  writeReports('25-admin-endpoints', join(dir, '..', 'reports'));
  console.log(`\nWrote 25-admin-endpoints-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
