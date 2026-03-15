/**
 * Regression test for #412 — JSON_DATA array count
 *
 * PHP returns integer count of linked values for array-type requisites.
 * Node.js was returning raw stored value (always 1) because the SQL GROUP BY
 * included reqs.id, preventing proper aggregation for array types.
 *
 * Fix: use CASE WHEN typs.up = 0 THEN 0 ELSE reqs.id END to collapse
 * array-type rows before GROUP BY, matching PHP index.php:6347-6353.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = resolve(__dirname, '..', 'legacy-compat.js');
const src = readFileSync(srcPath, 'utf8');

describe('#412 — JSON_DATA returns count for array types', () => {
  it('SQL uses CASE WHEN typs.up = 0 to collapse array-type rows', () => {
    // The JSON_DATA batch query must use CASE WHEN to zero out id/val for
    // array types (typs.up = 0), so GROUP BY aggregates them and COUNT(1)
    // returns the real count.
    expect(src).toContain('CASE WHEN typs.up = 0 THEN 0 ELSE reqs.id END AS id');
    expect(src).toContain('CASE WHEN typs.up = 0 THEN 0 ELSE reqs.val END AS val');
  });

  it('GROUP BY does not include reqs.id directly (which prevents aggregation)', () => {
    // Find the JSON_DATA reqvals query block
    const queryStart = src.indexOf("label: 'json_data_reqvals'");
    expect(queryStart).toBeGreaterThan(-1);

    // Extract the SQL query around it (go back to find the SELECT)
    const blockStart = src.lastIndexOf('SELECT reqs.up', queryStart);
    expect(blockStart).toBeGreaterThan(-1);
    const block = src.slice(blockStart, queryStart);

    // Must NOT group by reqs.id directly (that produces COUNT=1 always)
    expect(block).not.toMatch(/GROUP BY[^]*?reqs\.id[^]*?typs\.id/);
    // Must group by the aliased columns
    expect(block).toMatch(/GROUP BY reqs\.up, val, id, t, refr/);
  });

  it('arrSet path returns Number(arr_num) for array types', () => {
    // The processing code after the query should use arr_num for array types
    expect(src).toContain('arrSet.has(tid)');
    // Ensure it stores numeric arr_num (not raw val)
    const arrSetIdx = src.indexOf('// Array type: store count (#412)');
    expect(arrSetIdx).toBeGreaterThan(-1);
    const nextLine = src.slice(arrSetIdx, arrSetIdx + 200);
    expect(nextLine).toContain('Number(rv.arr_num)');
  });
});
