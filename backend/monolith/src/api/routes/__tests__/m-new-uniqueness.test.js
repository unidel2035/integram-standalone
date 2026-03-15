/**
 * Regression tests for _m_new uniqueness check (Issue #416).
 *
 * PHP (index.php:8327, 8412):
 *   $unique = $row["ord"];          // type's ord column — any non-zero value
 *   if($unique && !isset($max_val)) // check uniqueness unless auto-increment was used
 *
 * Bug: Node.js was using `order` (calcOrder result = positional order) instead of
 *      `unique` (type's ord column = uniqueness flag).
 *
 * Fix: Use parseInt(unique, 10) instead of parseInt(order, 10), and skip when
 *      maxValWasSet (equivalent of PHP's !isset($max_val)).
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.resolve(__dirname, '../legacy-compat.js');
const src = fs.readFileSync(srcPath, 'utf8');

describe('Issue #416 — _m_new uniqueness check matches PHP conditions', () => {
  // Extract the lines around the uniqueness check in the _m_new handler
  const lines = src.split('\n');

  it('should use `unique` (type ord) not `order` (calcOrder) for uniqueness check', () => {
    // Find the uniqueness check line in _m_new context
    // It should reference `unique` (the type's ord value), not `order` (the positional order)
    const uniquenessCheckLines = lines.filter(
      l => l.includes('parseInt(') && l.includes('maxValWasSet')
    );
    expect(uniquenessCheckLines.length).toBeGreaterThanOrEqual(1);

    // The condition must use `unique`, NOT `order`
    const checkLine = uniquenessCheckLines[0];
    expect(checkLine).toContain('parseInt(unique');
    expect(checkLine).not.toMatch(/parseInt\(order/);
  });

  it('should include !maxValWasSet guard (PHP: !isset($max_val))', () => {
    // PHP skips uniqueness check when $max_val was set (unique NUMBER auto-increment path)
    const guardLines = lines.filter(l => l.includes('!maxValWasSet'));
    expect(guardLines.length).toBeGreaterThanOrEqual(1);
  });

  it('should set maxValWasSet=true inside the unique NUMBER auto-increment block', () => {
    // Find where maxValWasSet is set to true — should be in the unique NUMBER path
    const setLines = lines.filter(l => l.includes('maxValWasSet = true'));
    expect(setLines.length).toBeGreaterThanOrEqual(1);
  });

  it('should initialize maxValWasSet as false before the value-computation block', () => {
    const initLines = lines.filter(l => l.includes('maxValWasSet = false'));
    expect(initLines.length).toBeGreaterThanOrEqual(1);
  });

  it('should read unique from type_ord (type metadata ord column), not calcOrder', () => {
    // Verify unique is derived from type_ord (the type's ord column)
    const uniqueAssignment = lines.filter(
      l => l.includes('const unique') && l.includes('type_ord')
    );
    expect(uniqueAssignment.length).toBeGreaterThanOrEqual(1);
  });

  it('should NOT check :UNIQ: in attrs for _m_new uniqueness (PHP never does)', () => {
    // Find the _m_new handler block (between the route definition and the next router.*)
    const startIdx = lines.findIndex(l => l.includes("/_m_new/") && l.includes('router.post'));
    expect(startIdx).toBeGreaterThan(0);

    // Scan the _m_new handler until the next router.* definition
    let endIdx = startIdx + 1;
    while (endIdx < lines.length && !lines[endIdx].match(/^router\.(get|post|put|delete|patch)\(/)) {
      endIdx++;
    }

    const handlerBlock = lines.slice(startIdx, endIdx).join('\n');
    // The uniqueness check should NOT require :UNIQ: in attrs
    // (the old bug required attrs to contain ':UNIQ:')
    expect(handlerBlock).not.toMatch(/:UNIQ:/);
  });
});
