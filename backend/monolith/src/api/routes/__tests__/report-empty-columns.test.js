/**
 * Report Empty-Columns Guard Tests (Issue #445)
 *
 * PHP returns an error when a report has no columns (e.g. when a type ID is
 * passed instead of a real report ID). Node was returning structured data
 * instead. This test verifies:
 *
 * 1. The empty-columns guard exists and returns [{error:"..."}] for JSON flags
 * 2. RECORD_COUNT without JSON flags returns plain text (PHP: my_die non-API path)
 * 3. The guard fires before report execution (before executeReport is called)
 *
 * PHP source references:
 * - index.php:1888-1889: if(!is_array(types)) my_die("Пустой отчет ...")
 * - index.php:985-998: my_die returns [{error}] when isApi(), plain text otherwise
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__dirname, '..', 'legacy-compat.js'), 'utf-8');

// Extract the report route handler section
function getReportRouteSection() {
  const match = SRC.match(/router\.all\([^)]*report[^)]*\)/);
  if (!match) return '';
  const startIdx = match.index;
  const rest = SRC.slice(startIdx + 10);
  const nextRoute = rest.match(/\nrouter\.(post|get|put|delete|all)\(/);
  const endIdx = nextRoute ? startIdx + 10 + nextRoute.index : SRC.length;
  return SRC.slice(startIdx, endIdx);
}

describe('Report Empty-Columns Guard (Issue #445)', () => {
  const section = getReportRouteSection();

  it('checks report.columns.length === 0 after compileReport', () => {
    // PHP: if(!is_array($GLOBALS["STORED_REPS"][$id]["types"])) my_die(...)
    // Node must check for empty columns before executing the report
    expect(section).toContain('report.columns.length === 0');
  });

  it('returns JSON array with error key for empty-column reports', () => {
    // PHP my_die returns [{"error":"Пустой отчет <header>"}] when isApi()
    expect(section).toMatch(/json\(\[\{\s*error:\s*errorMsg\s*\}\]\)/);
  });

  it('returns plain text for RECORD_COUNT without JSON flags on empty reports', () => {
    // PHP my_die returns plain text when isApi() is false (RECORD_COUNT alone)
    expect(section).toMatch(/RECORD_COUNT.*text\/html/s);
  });

  it('includes the PHP error message prefix', () => {
    // PHP: "Пустой отчет" + report header
    expect(section).toContain('Пустой отчет');
  });

  it('empty-columns guard appears BEFORE executeReport call', () => {
    // The guard must fire before the report is executed, matching PHP flow
    const guardIdx = section.indexOf('report.columns.length === 0');
    const executeIdx = section.indexOf('executeReport(');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(executeIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(executeIdx);
  });

  it('checks all JSON format flags for isApi detection', () => {
    // PHP isApi() = JSON || JSON_DATA || JSON_KV || JSON_CR || JSON_HR
    // The guard must differentiate these from RECORD_COUNT-only requests
    const guardArea = section.slice(
      section.indexOf('report.columns.length === 0'),
      section.indexOf('report.columns.length === 0') + 600
    );
    expect(guardArea).toContain('JSON_KV');
    expect(guardArea).toContain('JSON_CR');
    expect(guardArea).toContain('JSON_HR');
    expect(guardArea).toContain('JSON_DATA');
  });
});
