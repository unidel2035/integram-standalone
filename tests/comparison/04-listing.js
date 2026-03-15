#!/usr/bin/env node
/**
 * 04-listing: PHP vs Node.js — Listing, filtering, querying endpoints
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, deleteType, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__lst_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // Setup: type with columns and objects
  const mainType = await createType(`${PREFIX}main_${TS}`, 3);
  const col1 = await addColumn(mainType, 3);
  const refType = await createType(`${PREFIX}ref_${TS}`, 3);
  const refReq = await addRefColumn(mainType, refType);

  // Create 5 objects with values
  const objs = [];
  for (const val of ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']) {
    objs.push(await createObj(mainType, val));
  }

  section('Object Listing — JSON formats');

  // 1. GET /object/:typeId?JSON=1
  await dual('GET /object/:type?JSON=1', 'GET',
    s => `/object/${mainType[s]}?JSON=1`);

  // 2. GET /object/:typeId?JSON_DATA
  await dual('GET /object/:type?JSON_DATA', 'GET',
    s => `/object/${mainType[s]}?JSON_DATA`);

  // 3. GET /object/:typeId?JSON=1&LIMIT=2
  await dual('GET /object/:type?LIMIT=2', 'GET',
    s => `/object/${mainType[s]}?JSON=1&LIMIT=2`);

  // 4. Empty type listing
  const emptyType = await createType(`${PREFIX}empty_${TS}`, 3);
  await dual('GET /object/:type (empty)', 'GET',
    s => `/object/${emptyType[s]}?JSON=1`);

  section('Object Listing — Filters');

  // 5. F_U=1 (root objects)
  await dual('GET /object?F_U=1', 'GET',
    s => `/object/${mainType[s]}?JSON=1&F_U=1`);

  // 6. F_U=0 (all root)
  await dual('GET /object?F_U=0', 'GET',
    s => `/object/${mainType[s]}?JSON=1&F_U=0`);

  // 7. F_I (exact object ID)
  await dual('GET /object?F_I=id', 'GET',
    s => `/object/${mainType[s]}?JSON=1&F_I=${objs[0][s]}`);

  // 8. F_{typeId} (filter by main value)
  await dual('GET /object?F_{type}=Alpha', 'GET',
    s => `/object/${mainType[s]}?JSON=1&F_${mainType[s]}=Alpha`);

  // 9. order_val sorting
  await dual('GET /object?order_val=val', 'GET',
    s => `/object/${mainType[s]}?JSON=1&order_val=val`);

  // 10. Descending sort
  await dual('GET /object?desc=1', 'GET',
    s => `/object/${mainType[s]}?JSON=1&order_val=val&desc=1`);

  section('Edit/View Endpoints');

  // 11. GET /edit_obj/:objId
  await dual('GET /edit_obj/:id', 'GET',
    s => `/edit_obj/${objs[0][s]}?JSON=1`);

  // 12. GET /edit_types
  await dual('GET /edit_types', 'GET', '/edit_types?JSON=1', null, { keysOnly: true });

  // 13. GET /obj_meta/:typeId
  await dual('GET /obj_meta/:type', 'GET',
    s => `/obj_meta/${mainType[s]}`);

  // 14. GET /obj_meta (non-existent)
  await dual('GET /obj_meta (bad id)', 'GET', '/obj_meta/999999999');

  section('_list Endpoints');

  // 15. GET /_list/:typeId
  await dual('GET /_list/:type', 'GET',
    s => `/_list/${mainType[s]}?JSON=1`);

  // 16. GET /_list with search
  await dual('GET /_list?q=Alpha', 'GET',
    s => `/_list/${mainType[s]}?JSON=1&q=Alpha`);

  // 17. GET /_list with LIMIT
  await dual('GET /_list?LIMIT=2', 'GET',
    s => `/_list/${mainType[s]}?JSON=1&LIMIT=2`);

  // 18. GET /_list_join
  await dual('GET /_list_join/:type', 'GET',
    s => `/_list_join/${mainType[s]}?JSON=1`);

  section('Reference Search');

  // 19. GET /_ref_reqs/:reqId
  if (refReq.php && refReq.node) {
    await dual('GET /_ref_reqs/:reqId', 'GET',
      s => `/_ref_reqs/${refReq[s]}`);
  }

  // 20. GET /_ref_reqs with search
  if (refReq.php && refReq.node) {
    await dual('GET /_ref_reqs?q=test', 'GET',
      s => `/_ref_reqs/${refReq[s]}?q=test`);
  }

  // 21. POST / (action=object)
  await dual('POST / action=object', 'POST', '/',
    s => `a=object&id=${mainType[s]}&JSON=1`, { statusOnly: true });

  // Cleanup
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '04-listing-results.md'), generateMD('04-listing — Listing & Querying'));
  writeReports('04-listing', join(dir, '..', 'reports'));
  console.log(`\nWrote 04-listing-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
