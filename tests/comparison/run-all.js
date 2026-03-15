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
