#!/usr/bin/env node
/**
 * 06-admin: PHP vs Node.js — Admin, metadata, terms, dict, dir_admin
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, deleteType, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__adm_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // Setup: create a type for metadata tests
  const mainType = await createType(`${PREFIX}main_${TS}`, 3);
  const col1 = await addColumn(mainType, 3);
  await createObj(mainType, 'AdminTestObj');

  section('Terms & Types Listing');

  // 1. GET /terms?JSON=1
  await dual('GET /terms?JSON=1', 'GET', '/terms?JSON=1');

  // 2. GET /terms (HTML — status only)
  await dual('GET /terms (HTML)', 'GET', '/terms', null, { statusOnly: true });

  section('Dict Endpoint');

  // 3. GET /dict?JSON=1 (all types)
  await dual('GET /dict?JSON=1', 'GET', '/dict?JSON=1');

  // 4. GET /dict/:typeId?JSON=1
  await dual('GET /dict/:type?JSON=1', 'GET',
    s => `/dict/${mainType[s]}?JSON=1`);

  // 5. GET /dict (non-existent type)
  await dual('GET /dict (bad id)', 'GET', '/dict/999999999?JSON=1');

  section('Edit Types');

  // 6. GET /edit_types?JSON=1
  await dual('GET /edit_types?JSON=1', 'GET', '/edit_types?JSON=1', null, { keysOnly: true });

  // 7. GET /types?JSON=1
  await dual('GET /types?JSON=1', 'GET', '/types?JSON=1', null, { statusOnly: true });

  section('Object Metadata');

  // 8. GET /obj_meta/:typeId
  await dual('GET /obj_meta/:type', 'GET',
    s => `/obj_meta/${mainType[s]}`);

  // 9. GET /obj_meta (bad id)
  await dual('GET /obj_meta (bad id)', 'GET', '/obj_meta/999999999');

  section('Form & SQL');

  // 10. GET /form?JSON=1
  await dual('GET /form?JSON=1', 'GET', '/form?JSON=1', null, { statusOnly: true });

  // 11. GET /sql?JSON=1
  await dual('GET /sql?JSON=1', 'GET', '/sql?JSON=1', null, { statusOnly: true });

  section('Dir Admin');

  // 12. GET /dir_admin?JSON=1
  await dual('GET /dir_admin?JSON=1', 'GET', '/dir_admin?JSON=1');

  section('Validate');

  // 13. GET /validate?JSON=1
  await dual('GET /validate?JSON=1', 'GET', '/validate?JSON=1');

  section('Grants');

  // 14. GET /grants?JSON=1
  await dual('GET /grants?JSON=1', 'GET', '/grants?JSON=1');

  // 15. POST /check_grant
  await dual('POST /check_grant', 'POST', '/check_grant',
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&JSON=1`);

  section('Exit/Logout');

  // 16. GET /exit
  await dual('GET /exit', 'GET', '/exit', null, { statusOnly: true });

  // Cleanup
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '06-admin-results.md'), generateMD('06-admin — Admin & Metadata'));
  writeReports('06-admin', join(dir, '..', 'reports'));
  console.log(`\nWrote 06-admin-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
