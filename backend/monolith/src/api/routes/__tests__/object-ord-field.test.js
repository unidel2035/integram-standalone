/**
 * Object ord field parity test (Issue #418)
 *
 * PHP conditionally includes the `ord` field in the object array when
 * viewing child objects (F_U > 1). Node.js must do the same.
 *
 * PHP source: index.php:6126-6127
 *   if($f_u > 1)
 *       $GLOBALS["GLOBAL_VARS"]["api"]["object"][$i]["ord"] = $row["val_ord"];
 *
 * Node source: legacy-compat.js ~line 5638-5645
 *   The object mapping must include ord = String(r.ord) when fuParam > 1.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__dirname, '..', 'legacy-compat.js'), 'utf-8');

describe('Object ord field — Issue #418', () => {

  it('includes ord in object entries when F_U > 1', () => {
    // The object-building block must contain the ord assignment
    // PHP: if($f_u > 1) ... ["ord"] = $row["val_ord"];
    // Node: if (fuParam && parseInt(fuParam, 10) > 1) obj.ord = String(r.ord ...)
    expect(SRC).toMatch(/if\s*\(fuParam\s*&&\s*parseInt\(fuParam,\s*10\)\s*>\s*1\)\s*obj\.ord\s*=/);
  });

  it('ord is a string value', () => {
    // PHP outputs val_ord as-is (numeric from DB), Node must stringify
    expect(SRC).toMatch(/obj\.ord\s*=\s*String\(r\.ord/);
  });

  it('does NOT include ord when F_U is absent or 1', () => {
    // The condition guards ord behind fuParam > 1 — verify the guard exists
    // If ord were unconditionally set, the condition would be missing
    const objectMapBlock = SRC.match(/response\['object'\]\s*=\s*(?:await\s+Promise\.all\()?\s*objRows\.map\((?:async\s+)?\(?r\)?\s*=>\s*\{([\s\S]*?)\}\)/);
    expect(objectMapBlock).not.toBeNull();
    const block = objectMapBlock[1];
    // ord must appear inside an if-block, not as a bare assignment
    expect(block).toMatch(/if\s*\(.*fuParam.*\)\s*obj\.ord/);
    // The base object literal should NOT contain ord
    expect(block).toMatch(/const obj\s*=\s*\{\s*id:/);
    expect(block).not.toMatch(/const obj\s*=\s*\{[^}]*ord:/);
  });

  it('SQL query selects a.ord for object rows', () => {
    // The main object query must include a.ord so r.ord is available
    expect(SRC).toMatch(/SELECT.*a\.ord\s+FROM/i);
  });

  it('fuParam is derived from F_U request parameter', () => {
    // Verify fuParam is extracted from allObjParams.F_U
    expect(SRC).toMatch(/fuParam\s*=\s*allObjParams\.F_U\s*!==\s*undefined/);
  });
});
