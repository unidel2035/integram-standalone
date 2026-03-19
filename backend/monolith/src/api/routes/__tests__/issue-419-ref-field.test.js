/**
 * Regression tests for issue #419: object JSON missing ref field
 * for REPORT_COLUMN and GRANT types.
 *
 * PHP (index.php:6131-6132):
 *   if (in_array($GLOBALS["REV_BT"][$cur_base_typ], array("REPORT_COLUMN", "GRANT")))
 *       $GLOBALS["GLOBAL_VARS"]["api"]["object"][$i]["ref"] = $v;
 *
 * The ref field must:
 *   1. Be included when the type's base type is REPORT_COLUMN (16) or GRANT (5)
 *   2. Contain the raw object value (r.val), not the row's type id
 *   3. NOT be included for other base types (SHORT, HTML, etc.)
 */

import { describe, it, expect } from 'vitest';

// Base type IDs matching PHP $GLOBALS["basics"] and Node TYPE constant
const TYPE = {
  HTML: 2,
  SHORT: 3,
  DATETIME: 4,
  GRANT: 5,
  PWD: 6,
  BUTTON: 7,
  CHARS: 8,
  DATE: 9,
  FILE: 10,
  BOOLEAN: 11,
  MEMO: 12,
  NUMBER: 13,
  SIGNED: 14,
  CALCULATABLE: 15,
  REPORT_COLUMN: 16,
  PATH: 17,
};

/**
 * Replicates the object mapping logic from legacy-compat.js lines 5637-5648.
 * This mirrors the exact code path used in the /object/:id route handler.
 */
function buildObjectResponse(objRows, typeRow, fuParam) {
  const curBaseTypId = typeRow ? typeRow.base_type_id : 3;
  const includeRef = (curBaseTypId === TYPE.REPORT_COLUMN || curBaseTypId === TYPE.GRANT);
  return objRows.map(r => {
    const obj = { id: String(r.id), val: r.val, up: String(r.up), base: String(r.base) };
    if (fuParam && parseInt(fuParam, 10) > 1) obj.ord = String(r.ord || 0);
    if (includeRef) obj.ref = r.val || '';
    return obj;
  });
}

describe('Issue #419: ref field for REPORT_COLUMN and GRANT types', () => {
  const sampleRows = [
    { id: 100, val: 'some_value', up: 1, base: 50, ord: 1 },
    { id: 101, val: 'another_value', up: 1, base: 51, ord: 2 },
    { id: 102, val: '', up: 0, base: 52, ord: 3 },
  ];

  describe('REPORT_COLUMN base type', () => {
    const typeRow = { base_type_id: TYPE.REPORT_COLUMN };

    it('includes ref field in each object entry', () => {
      const result = buildObjectResponse(sampleRows, typeRow, null);
      for (const obj of result) {
        expect(obj).toHaveProperty('ref');
      }
    });

    it('ref contains the raw object value (r.val)', () => {
      const result = buildObjectResponse(sampleRows, typeRow, null);
      expect(result[0].ref).toBe('some_value');
      expect(result[1].ref).toBe('another_value');
    });

    it('ref is empty string when val is empty', () => {
      const result = buildObjectResponse(sampleRows, typeRow, null);
      expect(result[2].ref).toBe('');
    });

    it('ref equals val (PHP sets ref = $v = htmlspecialchars(row.val))', () => {
      const result = buildObjectResponse(sampleRows, typeRow, null);
      for (const obj of result) {
        expect(obj.ref).toBe(obj.val || '');
      }
    });
  });

  describe('GRANT base type', () => {
    const typeRow = { base_type_id: TYPE.GRANT };

    it('includes ref field in each object entry', () => {
      const result = buildObjectResponse(sampleRows, typeRow, null);
      for (const obj of result) {
        expect(obj).toHaveProperty('ref');
      }
    });

    it('ref contains the raw object value', () => {
      const result = buildObjectResponse(sampleRows, typeRow, null);
      expect(result[0].ref).toBe('some_value');
      expect(result[1].ref).toBe('another_value');
    });
  });

  describe('Other base types do NOT include ref', () => {
    const otherTypes = [
      TYPE.SHORT, TYPE.HTML, TYPE.DATETIME, TYPE.PWD, TYPE.BUTTON,
      TYPE.CHARS, TYPE.DATE, TYPE.FILE, TYPE.BOOLEAN, TYPE.MEMO,
      TYPE.NUMBER, TYPE.SIGNED, TYPE.CALCULATABLE, TYPE.PATH,
    ];

    for (const bt of otherTypes) {
      it(`base type ${bt} does not include ref`, () => {
        const typeRow = { base_type_id: bt };
        const result = buildObjectResponse(sampleRows, typeRow, null);
        for (const obj of result) {
          expect(obj).not.toHaveProperty('ref');
        }
      });
    }
  });

  describe('ref field does not interfere with other fields', () => {
    it('still includes standard fields (id, val, up, base)', () => {
      const typeRow = { base_type_id: TYPE.REPORT_COLUMN };
      const result = buildObjectResponse(sampleRows, typeRow, null);
      expect(result[0]).toMatchObject({
        id: '100',
        val: 'some_value',
        up: '1',
        base: '50',
        ref: 'some_value',
      });
    });

    it('still includes ord when fuParam > 1', () => {
      const typeRow = { base_type_id: TYPE.REPORT_COLUMN };
      const result = buildObjectResponse(sampleRows, typeRow, '2');
      expect(result[0].ord).toBe('1');
      expect(result[0].ref).toBe('some_value');
    });

    it('does not include ord when fuParam is null', () => {
      const typeRow = { base_type_id: TYPE.GRANT };
      const result = buildObjectResponse(sampleRows, typeRow, null);
      expect(result[0]).not.toHaveProperty('ord');
      expect(result[0]).toHaveProperty('ref');
    });
  });

  describe('edge cases', () => {
    it('defaults to SHORT (3) when typeRow is null/undefined', () => {
      const result = buildObjectResponse(sampleRows, null, null);
      // SHORT is not REPORT_COLUMN or GRANT, so no ref
      for (const obj of result) {
        expect(obj).not.toHaveProperty('ref');
      }
    });

    it('handles null val gracefully for REPORT_COLUMN', () => {
      const rows = [{ id: 200, val: null, up: 0, base: 60, ord: 0 }];
      const typeRow = { base_type_id: TYPE.REPORT_COLUMN };
      const result = buildObjectResponse(rows, typeRow, null);
      expect(result[0].ref).toBe('');
    });

    it('handles undefined val gracefully for GRANT', () => {
      const rows = [{ id: 201, val: undefined, up: 0, base: 61, ord: 0 }];
      const typeRow = { base_type_id: TYPE.GRANT };
      const result = buildObjectResponse(rows, typeRow, null);
      expect(result[0].ref).toBe('');
    });
  });
});
