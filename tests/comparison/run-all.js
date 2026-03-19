#!/usr/bin/env node
/**
 * run-all: Execute all comparison tests sequentially, generate combined report.
 */
import { execSync } from 'child_process';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));

const tests = [
  '01-auth.js',
  '02-ddl.js',
  '03-dml.js',
  '04-listing.js',
  '05-reports.js',
  '06-admin.js',
  '07-refs-multi.js',
  '08-export.js',
  '09-tables-crud.js',
  '10-objects-lifecycle.js',
  '11-directories.js',
  '12-subordinates.js',
  '13-filtering.js',
  '14-multiselect.js',
  '15-reports-advanced.js',
  '16-datatable-patterns.js',
  '17-file-upload.js',
  '18-column-metadata.js',
  '19-auth-password.js',
  '20-row-operations.js',
  '21-subordinate-tables.js',
  '22-directories-multiselect.js',
  '23-inline-editing.js',
  '24-reports-filters.js',
  '25-admin-endpoints.js',
  '26-json-formats.js',
  '27-reference-search.js',
  '28-date-formats.js',
  '29-object-count-pagination.js',
  '30-special-operations.js',
  '31-list-dict-connect.js',
  '32-session-exit-jwt.js',
  '33-error-handling-edge.js',
  '34-ref-search-filters.js',
  '35-metadata-obj-meta.js',
  '36-multifield-save.js',
  '37-report-listing-export.js',
  '38-subordinate-ordering.js',
  '39-encoding-escaping.js',
  '40-grants-permissions.js',
  '41-type-lifecycle.js',
  '42-bulk-operations.js',
  '43-my-database.js',
  '44-d-req-attrs-ord.js',
  '45-m-id-validate-auth.js',
  '46-legacy-aliases.js',
  '47-upload-direct.js',
  '48-bki-restore.js',
  '49-more-legacy-aliases.js',
  '50-dir-admin-write.js',
];

const results = [];
let totalPass = 0, totalFail = 0;

console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║  PHP vs Node.js — Full Comparison Suite              ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

for (const test of tests) {
  const path = join(dir, test);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Running: ${test}`);
  console.log('═'.repeat(60));

  try {
    execSync(`node ${path}`, {
      stdio: 'inherit',
      cwd: dir,
      timeout: 120000,
    });
    results.push({ test, status: 'PASS' });
    totalPass++;
  } catch (e) {
    const code = e.status || 'error';
    results.push({ test, status: code === 1 ? 'DIFF' : `ERROR(${code})` });
    totalFail++;
  }
}

// Combine all result MDs into one
console.log(`\n${'═'.repeat(60)}`);
console.log('  COMBINED RESULTS');
console.log('═'.repeat(60));

const combined = ['# PHP vs Node.js — Full Comparison Report\n'];
combined.push(`**Date**: ${new Date().toISOString()}\n`);
combined.push(`| Test | Status |`);
combined.push(`|------|--------|`);
for (const r of results) {
  combined.push(`| ${r.test} | ${r.status} |`);
}
combined.push(`\n**${totalPass} passed, ${totalFail} with diffs/errors**\n`);

// Append individual result files
for (const test of tests) {
  const mdFile = test.replace('.js', '-results.md');
  const mdPath = join(dir, mdFile);
  try {
    const content = readFileSync(mdPath, 'utf8');
    combined.push(`\n---\n\n${content}`);
  } catch {
    combined.push(`\n---\n\n## ${mdFile}\n\nNo results generated.\n`);
  }
}

writeFileSync(join(dir, 'FULL-RESULTS.md'), combined.join('\n'));
console.log(`\nWrote FULL-RESULTS.md`);
console.log(`\n  ${totalPass} PASSED  ${totalFail} DIFF/ERROR  out of ${tests.length} test files`);

process.exit(totalFail > 0 ? 1 : 0);
