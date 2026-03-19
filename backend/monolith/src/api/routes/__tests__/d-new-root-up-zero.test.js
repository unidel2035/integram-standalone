/**
 * Regression test for Issue #444: _d_new root types must insert with up=0
 *
 * PHP behavior (index.php line 8637):
 *   Insert(0, $unique, $t, $val) — always uses 0 for `up` parameter
 *   The `up` value from $_REQUEST is ignored for root type creation.
 *
 * Bug: Node.js was using `req.body.up` (e.g., up=1) as the parentId,
 *   causing root types to be inserted with up=1 instead of up=0.
 *   This made obj_meta return up="1" instead of up="0" for root types.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__dirname, '..', 'legacy-compat.js'), 'utf-8');

// Extract the _d_new route handler source
function getDNewSection() {
  const startMatch = SRC.match(/router\.post\([^)]*_d_new[^)]*\)/);
  if (!startMatch) return '';
  const startIdx = startMatch.index;
  const rest = SRC.slice(startIdx + 10);
  const nextRoute = rest.match(/\nrouter\.(post|get|put|delete|all)\(/);
  const endIdx = nextRoute ? startIdx + 10 + nextRoute.index : SRC.length;
  return SRC.slice(startIdx, endIdx);
}

describe('Issue #444: _d_new root types use up=0', () => {
  const section = getDNewSection();

  it('should NOT use req.body.up for parentId calculation', () => {
    // The bug was: parseInt(parentTypeId || req.body.up || '0', 10)
    // This caused req.body.up=1 to be used as parentId for root types
    // Strip comments to only check executable code
    const codeOnly = section.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/req\.body\.up/);
  });

  it('should default parentId to 0 when no URL parentTypeId', () => {
    // Correct: parentTypeId ? parseInt(parentTypeId, 10) : 0
    // This ensures root types always get up=0 matching PHP Insert(0, ...)
    expect(section).toMatch(/parentTypeId\s*\?\s*parseInt\(parentTypeId/);
    expect(section).toMatch(/:\s*0\s*;/);
  });

  it('should pass parentId to insertRow (which becomes up column)', () => {
    // insertRow(db, parentId, order, baseType, name)
    expect(section).toMatch(/insertRow\(\s*db\s*,\s*parentId/);
  });

  it('obj_meta should return up as string (matching PHP mysqli_fetch_array)', () => {
    // In obj_meta handler: up: String(rows[0].up)
    const objMetaMatch = SRC.match(/router\.all\([^)]*obj_meta[^)]*\)/);
    expect(objMetaMatch).not.toBeNull();
    const objMetaStart = objMetaMatch.index;
    const objMetaRest = SRC.slice(objMetaStart + 10);
    const nextRoute = objMetaRest.match(/\nrouter\.(post|get|put|delete|all)\(/);
    const objMetaSection = SRC.slice(objMetaStart, objMetaStart + 10 + (nextRoute ? nextRoute.index : 500));

    expect(objMetaSection).toMatch(/up:\s*String\(rows\[0\]\.up\)/);
  });
});
