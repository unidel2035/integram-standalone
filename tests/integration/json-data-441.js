#!/usr/bin/env node
/**
 * Regression test for issue #441:
 * JSON_DATA returns empty array instead of actual data.
 *
 * Root cause: _d_new created types with up=parentId instead of up=0 (PHP parity),
 * which caused _m_new type-existence check (WHERE up=0) to fail, so no objects
 * were ever created via Node, and JSON_DATA returned [].
 *
 * This test verifies:
 * 1. _d_new creates types with up=0 (type meta row, matching PHP)
 * 2. _m_new can create objects against Node-created types
 * 3. JSON_DATA returns actual object data (not empty array)
 */
import h from './lib/helpers.js';
const TS = Date.now();
const PREFIX = `__441_`;

async function run() {
  await h.setup();
  console.log(`Token: ${h.token.slice(0, 8)}...`);

  h.section('Issue #441: JSON_DATA returns actual data');

  // 1. Create type via Node (with up=1 in body, like the comparison test does)
  const typeRes = await h.http(
    h.NODE, 'POST', `/${h.DB}/_d_new`,
    `_xsrf=${h.xsrfNode}&val=${PREFIX}type_${TS}&t=3&up=1&JSON=1`,
    h.cookie()
  );
  const typeId = Number(typeRes.json?.obj);
  {
    const issues = [];
    if (!typeId || typeId <= 0) issues.push(`Type creation failed: ${typeRes.body}`);
    h.report('1. _d_new creates type via Node', issues);
  }
  if (!typeId || typeId <= 0) {
    console.error('Cannot continue without type');
    h.summary('Issue #441 — JSON_DATA');
  }

  // 2. Verify type has up=0 (PHP parity) by checking _m_new can find it
  const objRes = await h.http(
    h.NODE, 'POST', `/${h.DB}/_m_new/${typeId}`,
    `_xsrf=${h.xsrfNode}&up=1&t${typeId}=Alpha&JSON=1`,
    h.cookie()
  );
  const objId = Number(objRes.json?.obj || objRes.json?.id);
  {
    const issues = [];
    if (!objId || objId <= 0) issues.push(`Object creation failed: ${objRes.body}`);
    if (objRes.json?.error) issues.push(`Error: ${objRes.json.error}`);
    h.report('2. _m_new creates object against Node-created type', issues);
  }

  // 3. Create more objects
  const objIds = [objId];
  for (const val of ['Beta', 'Gamma', 'Delta', 'Epsilon']) {
    const r = await h.http(
      h.NODE, 'POST', `/${h.DB}/_m_new/${typeId}`,
      `_xsrf=${h.xsrfNode}&up=1&t${typeId}=${val}&JSON=1`,
      h.cookie()
    );
    const id = Number(r.json?.obj || r.json?.id);
    if (id > 0) objIds.push(id);
  }
  {
    const issues = [];
    if (objIds.filter(id => id > 0).length !== 5) {
      issues.push(`Expected 5 objects, got ${objIds.filter(id => id > 0).length}`);
    }
    h.report('3. Created 5 objects total', issues);
  }

  // 4. GET /object/:typeId?JSON_DATA — the core test
  const jsonDataRes = await h.http(
    h.NODE, 'GET', `/${h.DB}/object/${typeId}?JSON_DATA`,
    null, h.cookie()
  );
  {
    const issues = [];
    if (jsonDataRes.status !== 200) issues.push(`Status ${jsonDataRes.status}`);
    if (!Array.isArray(jsonDataRes.json)) {
      issues.push(`Expected array, got ${typeof jsonDataRes.json}`);
    } else if (jsonDataRes.json.length === 0) {
      issues.push(`JSON_DATA returned empty array [] — THIS IS THE BUG`);
    } else if (jsonDataRes.json.length !== 5) {
      issues.push(`Expected 5 items, got ${jsonDataRes.json.length}`);
    }
    // Check compact format: {i, u, o, r}
    if (Array.isArray(jsonDataRes.json) && jsonDataRes.json.length > 0) {
      const first = jsonDataRes.json[0];
      if (first.i === undefined) issues.push('Missing "i" (id) field');
      if (first.u === undefined) issues.push('Missing "u" (up) field');
      if (first.o === undefined) issues.push('Missing "o" (ord) field');
      if (!Array.isArray(first.r)) issues.push('Missing "r" (reqs) array');
      if (Array.isArray(first.r) && first.r.length === 0) issues.push('"r" array is empty (should have at least val)');
    }
    h.report('4. JSON_DATA returns actual data (not empty array)', issues);
  }

  // 5. Verify JSON_DATA format matches PHP compact format
  {
    const issues = [];
    if (Array.isArray(jsonDataRes.json) && jsonDataRes.json.length > 0) {
      const vals = jsonDataRes.json.map(item => item.r?.[0]).sort();
      const expected = ['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma'];
      const valsSorted = [...vals].sort();
      if (JSON.stringify(valsSorted) !== JSON.stringify(expected)) {
        issues.push(`Values mismatch: got [${valsSorted}] expected [${expected}]`);
      }
      // All should have u=1 (root parent)
      for (const item of jsonDataRes.json) {
        if (item.u !== 1) {
          issues.push(`Object ${item.i} has u=${item.u}, expected u=1`);
          break;
        }
      }
    } else {
      issues.push('No data to verify format');
    }
    h.report('5. JSON_DATA values match created objects', issues);
  }

  // 6. Compare PHP vs Node JSON_DATA
  // Create same type+objects via PHP for comparison
  const phpTypeRes = await h.http(
    h.PHP, 'POST', `/${h.DB}/_d_new`,
    `_xsrf=${h.xsrfPhp}&val=${PREFIX}php_${TS}&t=3&up=1&JSON=1`,
    h.cookie()
  );
  const phpTypeId = Number(phpTypeRes.json?.obj);
  if (phpTypeId > 0) {
    for (const val of ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']) {
      await h.http(
        h.PHP, 'POST', `/${h.DB}/_m_new/${phpTypeId}`,
        `_xsrf=${h.xsrfPhp}&up=1&t${phpTypeId}=${val}&JSON=1`,
        h.cookie()
      );
    }
    const phpJsonData = await h.http(
      h.PHP, 'GET', `/${h.DB}/object/${phpTypeId}?JSON_DATA`,
      null, h.cookie()
    );
    const nodeJsonData = jsonDataRes;
    const issues = [];
    if (!Array.isArray(phpJsonData.json)) {
      issues.push(`PHP returned non-array: ${h.short(phpJsonData.body, 80)}`);
    } else if (phpJsonData.json.length !== (nodeJsonData.json?.length || 0)) {
      issues.push(`Count mismatch: PHP=${phpJsonData.json.length} Node=${nodeJsonData.json?.length || 0}`);
    } else {
      // Check structure matches
      if (phpJsonData.json.length > 0 && nodeJsonData.json.length > 0) {
        const phpKeys = Object.keys(phpJsonData.json[0]).sort().join(',');
        const nodeKeys = Object.keys(nodeJsonData.json[0]).sort().join(',');
        if (phpKeys !== nodeKeys) issues.push(`Structure mismatch: PHP=[${phpKeys}] Node=[${nodeKeys}]`);
      }
    }
    h.report('6. PHP vs Node JSON_DATA parity (same count + structure)', issues);

    // Cleanup PHP type
    await h.http(h.PHP, 'POST', `/${h.DB}/_d_del/${phpTypeId}`,
      `_xsrf=${h.xsrfPhp}&forced=1&JSON=1`, h.cookie());
  } else {
    h.skip('6. PHP vs Node JSON_DATA parity', 'PHP type creation failed');
  }

  // Cleanup Node type
  await h.http(h.NODE, 'POST', `/${h.DB}/_d_del/${typeId}`,
    `_xsrf=${h.xsrfNode}&forced=1&JSON=1`, h.cookie());

  h.summary('Issue #441 — JSON_DATA');
}

run().catch(e => { console.error(e); process.exit(2); });
