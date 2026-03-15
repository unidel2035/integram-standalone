#!/usr/bin/env node
/**
 * 02-ddl: PHP vs Node.js — Type/Column DDL operations
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, deleteType, getXsrf, cookie, getConcreteType } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__ddl_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  const cleanup = [];

  section('Type DDL — Create');

  // 1. Create type (SHORT)
  const t1 = await createType(`${PREFIX}short_${TS}`, 3);
  cleanup.push(t1);
  await dual('POST /_d_new (SHORT type)', 'POST',
    s => `/_d_new`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&val=${PREFIX}verify_${TS}_${s}&t=3&up=1&JSON=1`);
  // extract IDs from last dual result for cleanup
  // (cleanup at end)

  // 2. Create type (NUMBER)
  await dual('POST /_d_new (NUMBER type)', 'POST',
    '/_d_new',
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&val=${PREFIX}num_${TS}_${s}&t=11&up=1&JSON=1`);

  // 3. Create type (DATE)
  await dual('POST /_d_new (DATE type)', 'POST',
    '/_d_new',
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&val=${PREFIX}date_${TS}_${s}&t=12&up=1&JSON=1`);

  // 4. Create duplicate type
  await dual('POST /_d_new (duplicate name)', 'POST',
    '/_d_new',
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&val=${PREFIX}short_${TS}&t=3&up=1&JSON=1`);

  // 5. Create type with unique flag
  await dual('POST /_d_new (unique=1)', 'POST',
    '/_d_new',
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&val=${PREFIX}uniq_${TS}_${s}&t=3&up=1&unique=1&JSON=1`);

  // 6. Create type with empty name
  await dual('POST /_d_new (empty name)', 'POST',
    '/_d_new',
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&val=&t=3&up=1&JSON=1`);

  section('Type DDL — Modify');

  // 7. Rename type (_d_save)
  await dual('POST /_d_save (rename)', 'POST',
    s => `/_d_save/${t1[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&val=${PREFIX}renamed_${TS}_${s}&t=3&JSON=1`);

  // 8. Save with unique flag
  await dual('POST /_d_save (unique=1)', 'POST',
    s => `/_d_save/${t1[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&val=${PREFIX}renamed_${TS}_${s}&t=3&unique=1&JSON=1`);

  section('Column DDL — Add/Modify');

  // 9. Add text column (_d_req)
  const col1 = await addColumn(t1, 3);
  await dual('POST /_d_req (text column)', 'POST',
    s => `/_d_req/${t1[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&t=3&JSON=1`);

  // 10. Add number column
  const colNum = await addColumn(t1, 13);  // NUMBER (13, not 11=BOOLEAN)
  await dual('POST /_d_req (number column)', 'POST',
    s => `/_d_req/${t1[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&t=11&JSON=1`);

  // 11. Add ref column via _d_ref
  const refType = await createType(`${PREFIX}ref_${TS}`, 3);
  cleanup.push(refType);
  const refReq = await addRefColumn(t1, refType);
  await dual('POST /_d_ref (reference column)', 'POST',
    s => `/_d_ref/${t1[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&t=${refType[s]}&JSON=1`);

  // 12. Toggle NOT NULL (_d_null)
  await dual('POST /_d_null (required=1)', 'POST',
    s => `/_d_null/${col1[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&required=1&JSON=1`);

  // 13. Toggle MULTI (_d_multi)
  if (refReq.php && refReq.node) {
    await dual('POST /_d_multi (multi=1)', 'POST',
      s => `/_d_multi/${refReq[s]}`,
      s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&multi=1&JSON=1`);
  }

  // 14. Move column up (_d_up)
  if (colNum.php && colNum.node) {
    await dual('POST /_d_up', 'POST',
      s => `/_d_up/${colNum[s]}`,
      s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&JSON=1`);
  }

  // 15. Set column order (_d_ord)
  if (col1.php && col1.node) {
    await dual('POST /_d_ord (order=1)', 'POST',
      s => `/_d_ord/${col1[s]}`,
      s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&order=1&JSON=1`);
  }

  // 16. Set alias (_d_alias)
  if (col1.php && col1.node) {
    await dual('POST /_d_alias', 'POST',
      s => `/_d_alias/${col1[s]}`,
      s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&val=test_alias&JSON=1`);
  }

  // 17. Set multiple attrs (_d_attrs)
  if (col1.php && col1.node) {
    await dual('POST /_d_attrs', 'POST',
      s => `/_d_attrs/${col1[s]}`,
      s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&alias=myalias&name=MyCol&required=0&JSON=1`);
  }

  section('Column DDL — Delete');

  // 18. Delete column (_d_del_req)
  // PHP & Node share one DB, so col1.php === col1.node (same row).
  // Create two fresh columns with different base types (DATETIME=4, BOOLEAN=7) so each server has its own to delete.
  {
    const ck = cookie();
    const ct4 = getConcreteType(4);   // DATETIME concrete
    const ct7 = getConcreteType(7);   // BOOLEAN concrete
    const phpAdd = await http(PHP, 'POST', `/${DB}/_d_req/${t1.php}`, `_xsrf=${xsrfPhp}&t=${ct4}&JSON=1`, ck);
    const nodeAdd = await http(NODE, 'POST', `/${DB}/_d_req/${t1.node}`, `_xsrf=${xsrfNode}&t=${ct7}&JSON=1`, ck);
    const delPhp = Number(phpAdd.json?.id);
    const delNode = Number(nodeAdd.json?.id);
    if (delPhp && delNode && delPhp !== delNode) {
      await dual('POST /_d_del_req', 'POST',
        s => `/_d_del_req/${s === 'php' ? delPhp : delNode}`,
        s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&JSON=1`);
    }
  }

  section('Type DDL — Delete');

  // 19. Delete type
  const tDel = await createType(`${PREFIX}todel_${TS}`, 3);
  await dual('POST /_d_del (empty type)', 'POST',
    s => `/_d_del/${tDel[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&JSON=1`);

  // 20. Delete non-existent type
  await dual('POST /_d_del (non-existent)', 'POST',
    '/_d_del/999999999',
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&JSON=1`);

  // Cleanup
  section('Cleanup');
  await preCleanup(PREFIX);
  for (const t of cleanup) await deleteType(t.php).catch(() => {});

  const s = summary();
  writeFileSync(join(dir, '02-ddl-results.md'), generateMD('02-ddl — Type/Column DDL'));
  writeReports('02-ddl', join(dir, '..', 'reports'));
  console.log(`\nWrote 02-ddl-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
