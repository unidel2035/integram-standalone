#!/usr/bin/env node
/**
 * 08-export: PHP vs Node.js — Export, backup, csv_all
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, createObj, deleteType, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__exp_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // Setup: type with data for export
  const mainType = await createType(`${PREFIX}main_${TS}`, 3);
  const col1 = await addColumn(mainType, 3);
  await createObj(mainType, 'ExportA');
  await createObj(mainType, 'ExportB');
  await createObj(mainType, 'ExportC');

  section('CSV All');

  // 1. GET /csv_all — PHP returns 500 (server config issue), Node 302
  await dual('GET /csv_all', 'GET', '/csv_all', null, { binary: true, ignoreStatus: true });

  section('Backup');

  // 2. GET /backup
  await dual('GET /backup', 'GET', '/backup', null, { binary: true, statusOnly: true });

  section('Export Type');

  // 3. GET /export/:typeId
  await dual('GET /export/:type', 'GET',
    s => `/export/${mainType[s]}`, null, { binary: true, statusOnly: true });

  // 4. GET /export (non-existent type)
  await dual('GET /export (bad id)', 'GET', '/export/999999999', null, { statusOnly: true });

  section('BKI Export/Import');

  // 5. GET /bki-export
  await dual('GET /bki-export', 'GET', '/bki-export', null, { statusOnly: true });

  section('Info & Misc');

  // 6. GET /info
  await dual('GET /info', 'GET', '/info', null, { statusOnly: true });

  // 7. GET / (root with auth)
  await dual('GET / (root)', 'GET', '/', null, { statusOnly: true });

  // 8. GET /:db (main page)
  await dual('GET /:db (main)', 'GET', '', null, { statusOnly: true });

  section('Login Page');

  // 9. GET /login (no cookie)
  await dual('GET /login (no cookie)', 'GET', '/login', null, { statusOnly: true, noCookie: true });

  // 10. GET /login?u=testbot
  await dual('GET /login?u=testbot', 'GET', '/login?u=testbot', null, { statusOnly: true, noCookie: true });

  section('Upload Endpoint');

  // 11. GET /upload (page)
  await dual('GET /upload', 'GET', '/upload', null, { statusOnly: true });

  // Cleanup
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '08-export-results.md'), generateMD('08-export — Export & Backup'));
  writeReports('08-export', join(dir, '..', 'reports'));
  console.log(`\nWrote 08-export-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
