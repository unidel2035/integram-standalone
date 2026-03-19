#!/usr/bin/env node
/**
 * 03-dml: PHP vs Node.js — Object DML operations
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, createObj, deleteType, deleteObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__dml_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // Setup: type with 2 columns + objects
  const mainType = await createType(`${PREFIX}main_${TS}`, 3);
  const col1 = await addColumn(mainType, 3);   // text
  const col2 = await addColumn(mainType, 13);  // NUMBER (13, not 11=BOOLEAN)
  const obj1 = await createObj(mainType, 'ObjA');
  const obj2 = await createObj(mainType, 'ObjB');
  const obj3 = await createObj(mainType, 'ObjC');

  section('Object DML — Create');

  // 1. Create object (_m_new)
  await dual('POST /_m_new', 'POST',
    s => `/_m_new/${mainType[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&t${mainType[s]}=NewObj&up=1&JSON=1`);

  // 2. Create object with empty value — val/ord are auto-generated (MAX+1) and differ on shared DB
  await dual('POST /_m_new (empty val)', 'POST',
    s => `/_m_new/${mainType[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&t${mainType[s]}=&up=1&JSON=1`,
    { keysOnly: true });

  section('Object DML — Save/Update');

  // 3. Save object (_m_save)
  await dual('POST /_m_save (rename)', 'POST',
    s => `/_m_save/${obj1[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&t${mainType[s]}=ObjA_renamed&JSON=1`);

  // 4. Copy object (_m_save copybtn)
  await dual('POST /_m_save (copy)', 'POST',
    s => `/_m_save/${obj1[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&copybtn=1&val=ObjA_copy&JSON=1`);

  section('Object DML — Set Attributes');

  // 5. Set text attribute (_m_set)
  if (col1.php && col1.node) {
    await dual('POST /_m_set (text)', 'POST',
      s => `/_m_set/${obj2[s]}`,
      s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&t${col1[s]}=hello_world&JSON=1`);
  }

  // 6. Set number attribute
  if (col2.php && col2.node) {
    await dual('POST /_m_set (number)', 'POST',
      s => `/_m_set/${obj2[s]}`,
      s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&t${col2[s]}=42&JSON=1`);
  }

  // 7. Set empty value
  if (col1.php && col1.node) {
    await dual('POST /_m_set (clear)', 'POST',
      s => `/_m_set/${obj3[s]}`,
      s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&t${col1[s]}=&JSON=1`);
  }

  section('Object DML — Move/Order');

  // 8. Move object up (_m_up)
  await dual('POST /_m_up', 'POST',
    s => `/_m_up/${obj2[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&JSON=1`);

  // 9. Set object order (_m_ord)
  await dual('POST /_m_ord (order=5)', 'POST',
    s => `/_m_ord/${obj3[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&order=5&JSON=1`);

  // 10. Move object to parent (_m_move)
  await dual('POST /_m_move (to root)', 'POST',
    s => `/_m_move/${obj2[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&up=1&JSON=1`);

  section('Object DML — Change ID');

  // 11. Change object ID (_m_id)
  const tempObj = await createObj(mainType, 'ForReID');
  await dual('POST /_m_id', 'POST',
    s => `/_m_id/${tempObj[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&new_id=999777${s === 'php' ? '1' : '2'}&JSON=1`);

  // 12. Change to duplicate ID
  await dual('POST /_m_id (duplicate)', 'POST',
    s => `/_m_id/${obj1[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&new_id=${obj2[s]}&JSON=1`);

  // 13. Change to invalid ID (0)
  await dual('POST /_m_id (zero)', 'POST',
    s => `/_m_id/${obj1[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&new_id=0&JSON=1`);

  section('Object DML — Delete');

  // 14. Delete object
  const delObj = await createObj(mainType, 'ToDelete');
  await dual('POST /_m_del', 'POST',
    s => `/_m_del/${delObj[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&JSON=1`);

  // 15. Delete non-existent object
  await dual('POST /_m_del (non-existent)', 'POST',
    '/_m_del/999999999',
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&JSON=1`);

  // 16. Delete type with objects (should block)
  await dual('POST /_d_del (type with objects)', 'POST',
    s => `/_d_del/${mainType[s]}`,
    s => `_xsrf=${s === 'php' ? xsrfPhp : xsrfNode}&JSON=1`);

  // Cleanup
  section('Cleanup');
  await preCleanup(PREFIX);
  await deleteType(mainType.php).catch(() => {});

  const s = summary();
  writeFileSync(join(dir, '03-dml-results.md'), generateMD('03-dml — Object DML'));
  writeReports('03-dml', join(dir, '..', 'reports'));
  console.log(`\nWrote 03-dml-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
