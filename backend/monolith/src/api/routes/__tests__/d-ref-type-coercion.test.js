/**
 * _d_ref Type Coercion Regression Tests (Issue #447)
 *
 * Verifies that the _d_ref (add reference column) endpoint uses Number()
 * coercion for mysql2 row values, matching PHP's loose comparison behavior.
 *
 * Bug: mysql2 may return integer columns as strings, causing strict comparison
 * (row.up !== 0, row.t === id) to produce wrong results — returning
 * "Invalid N type" error instead of the expected success object.
 *
 * PHP reference: index.php line 8652
 *   if(($row["up"] != 0) || ($row["t"] == $id))  — loose comparison
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__dirname, '..', 'legacy-compat.js'), 'utf-8');

// Extract the _d_ref route handler source
function getDRefSection() {
  const start = SRC.indexOf("router.post('/:db/_d_ref/:typeId'");
  if (start === -1) return '';
  const rest = SRC.slice(start + 10);
  const nextRoute = rest.match(/\nrouter\.(post|get|put|delete|all)\(/);
  const end = nextRoute ? start + 10 + nextRoute.index : SRC.length;
  return SRC.slice(start, end);
}

describe('_d_ref type coercion parity (Issue #447)', () => {
  const section = getDRefSection();

  it('route handler exists', () => {
    expect(section).toContain('_d_ref');
  });

  it('uses Number(row.up) for the up-field check (PHP: $row["up"] != 0)', () => {
    // Must use Number() coercion, not strict row.up !== 0
    expect(section).toContain('Number(row.up)');
    expect(section).not.toMatch(/row\.up\s*!==\s*0/);
  });

  it('uses Number(row.t) for the type-field check (PHP: $row["t"] == $id)', () => {
    // Must use Number() coercion, not strict row.t === id
    expect(section).toContain('Number(row.t)');
    expect(section).not.toMatch(/row\.t\s*===\s*id/);
  });

  it('uses Number(row.refId) for the existing-ref check (PHP: $row["id"] > 0)', () => {
    // Must use Number() coercion for the LEFT JOIN result which may be null/string
    expect(section).toContain('Number(row.refId)');
    expect(section).not.toMatch(/row\.refId\s*>\s*0/);
  });

  it('returns success object with {id, obj, next_act, args} on valid type', () => {
    // PHP api_dump: {id, obj, next_act:"edit_types", args:"ext"}
    expect(section).toContain("next_act: 'edit_types'");
    expect(section).toContain("args: 'ext'");
    expect(section).toMatch(/obj:\s*refId/);
  });

  it('returns error for id=0 (PHP: if($id == 0) die("Invalid link"))', () => {
    expect(section).toMatch(/Invalid link/);
  });
});
