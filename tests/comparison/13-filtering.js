#!/usr/bin/env node
/**
 * 13-filtering: PHP vs Node.js — Filtering, sorting, pagination
 * Based on IntegramDataTableWrapper.vue DataTable composables:
 *   F_U (parent filter), sort/asc/desc, LIMIT, pg, object count
 *
 * NOTE: F_T (text search) and F_I[colId]=val (bracket notation) are
 * Node-only features — PHP doesn't support them (returns 500).
 * Only PHP-compatible filter patterns are tested here.
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, addRefColumn, createObj, deleteType, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__flt_';
const TS = Date.now();

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup: Table with data for filtering ──────────────────────────────────

  const mainType = await createType(`${PREFIX}products_${TS}`, 3);
  const colName   = await addColumn(mainType, 3);   // SHORT — name
  const colPrice  = await addColumn(mainType, 13);  // NUMBER
  const colDate   = await addColumn(mainType, 4);   // DATETIME — created
  const colDesc   = await addColumn(mainType, 2);   // LONG — description
  const colActive = await addColumn(mainType, 11);  // BOOLEAN

  // Create lookup for category
  const catType = await createType(`${PREFIX}categories_${TS}`, 3);
  const catElec = await createObj(catType, 'Электроника');
  const catFood = await createObj(catType, 'Продукты');
  const catBook = await createObj(catType, 'Книги');

  const colCat = await addRefColumn(mainType, catType); // reference — category

  // Populate products
  const products = [];
  const data = [
    { name: 'iPhone 15', price: '999', cat: catElec, date: '2025-01-15 10:00:00', desc: 'Смартфон Apple', active: '1' },
    { name: 'Samsung Galaxy', price: '799', cat: catElec, date: '2025-02-20 14:30:00', desc: 'Смартфон Samsung', active: '1' },
    { name: 'MacBook Pro', price: '2499', cat: catElec, date: '2025-03-01 09:00:00', desc: 'Ноутбук Apple', active: '1' },
    { name: 'Хлеб', price: '50', cat: catFood, date: '2025-01-01 08:00:00', desc: 'Белый хлеб', active: '1' },
    { name: 'Молоко', price: '80', cat: catFood, date: '2025-01-02 07:00:00', desc: 'Молоко 3.2%', active: '0' },
    { name: 'Война и мир', price: '500', cat: catBook, date: '2025-06-10 12:00:00', desc: 'Толстой Л.Н.', active: '1' },
    { name: 'Python Cookbook', price: '1200', cat: catBook, date: '2025-04-15 15:00:00', desc: 'Programming recipes', active: '1' },
    { name: 'Pixel 8', price: '699', cat: catElec, date: '2025-05-05 11:00:00', desc: 'Google Phone', active: '0' },
  ];

  for (const d of data) {
    const obj = await createObj(mainType, d.name);
    products.push(obj);
    // Set requisites
    const ck2 = cookie();
    if (colName.php && colName.node) {
      await Promise.all([
        http(PHP, 'POST', `/${DB}/_m_set/${obj.php}`, `_xsrf=${xsrfPhp}&t${colName.php}=${encodeURIComponent(d.name)}&t${colPrice.php}=${d.price}&t${colDate.php}=${encodeURIComponent(d.date)}&t${colActive.php}=${d.active}&t${colCat.php}=${d.cat.php}&JSON=1`, ck2),
        http(NODE, 'POST', `/${DB}/_m_set/${obj.node}`, `_xsrf=${xsrfNode}&t${colName.node}=${encodeURIComponent(d.name)}&t${colPrice.node}=${d.price}&t${colDate.node}=${encodeURIComponent(d.date)}&t${colActive.node}=${d.active}&t${colCat.node}=${d.cat.node}&JSON=1`, ck2),
      ]);
    }
  }

  // ── Basic Listing ─────────────────────────────────────────────────────────
  section('Filtering — Basic Listing');

  // 1. List all (default)
  await dual('#1 GET /object (all products)', 'GET',
    s => `/object/${mainType[s]}?JSON=1`);

  // 2. List with LIMIT=3
  await dual('#2 GET /object (LIMIT=3)', 'GET',
    s => `/object/${mainType[s]}?LIMIT=3&JSON=1`);

  // 3. Page 2
  await dual('#3 GET /object (pg=2, LIMIT=3)', 'GET',
    s => `/object/${mainType[s]}?LIMIT=3&pg=2&JSON=1`);

  // 4. Page 3
  await dual('#4 GET /object (pg=3, LIMIT=3)', 'GET',
    s => `/object/${mainType[s]}?LIMIT=3&pg=3&JSON=1`);

  // 5. Count only
  await dual('#5 GET /object (LIMIT=0 count)', 'GET',
    s => `/object/${mainType[s]}?LIMIT=0&JSON=1`);

  // ── F_I scalar (PHP-compatible) ─────────────────────────────────────────
  // PHP supports F_I as a scalar integer (single value), NOT bracket notation
  section('Filtering — F_I scalar');

  // 6. F_I with category ref ID (scalar)
  await dual('#6 GET /object (F_I=catElec)', 'GET',
    s => `/object/${mainType[s]}?F_I=${catElec[s]}&JSON=1`);

  // ── Sorting ───────────────────────────────────────────────────────────────
  section('Filtering — Sort');

  // 7. Sort by main value ASC
  await dual('#7 GET /object (sort val ASC)', 'GET',
    s => `/object/${mainType[s]}?sort=val&asc=1&JSON=1`);

  // 8. Sort by main value DESC
  await dual('#8 GET /object (sort val DESC)', 'GET',
    s => `/object/${mainType[s]}?sort=val&desc=1&JSON=1`);

  // 9. Sort by number field
  if (colPrice.php && colPrice.node) {
    await dual('#9 GET /object (sort by price)', 'GET',
      s => `/object/${mainType[s]}?sort=${colPrice[s]}&asc=1&JSON=1`);
  }

  // 10. Sort by date field
  if (colDate.php && colDate.node) {
    await dual('#10 GET /object (sort by date DESC)', 'GET',
      s => `/object/${mainType[s]}?sort=${colDate[s]}&desc=1&JSON=1`);
  }

  // ── Edge Cases ────────────────────────────────────────────────────────────
  section('Filtering — Edge Cases');

  // 11. Page beyond data
  await dual('#11 GET /object (pg=100, beyond data)', 'GET',
    s => `/object/${mainType[s]}?LIMIT=3&pg=100&JSON=1`);

  // 12. LIMIT=1
  await dual('#12 GET /object (LIMIT=1)', 'GET',
    s => `/object/${mainType[s]}?LIMIT=1&JSON=1`);

  // 13. Large LIMIT
  await dual('#13 GET /object (LIMIT=1000)', 'GET',
    s => `/object/${mainType[s]}?LIMIT=1000&JSON=1`);

  // 14. Empty F_T (PHP treats as no filter)
  await dual('#14 GET /object (F_T empty)', 'GET',
    s => `/object/${mainType[s]}?F_T=&JSON=1`);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '13-filtering-results.md'), generateMD('13-filtering — Filtering, Sorting, Pagination'));
  writeReports('13-filtering', join(dir, '..', 'reports'));
  console.log(`\nWrote 13-filtering-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
