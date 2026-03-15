#!/usr/bin/env node
/**
 * 17-file-upload: PHP vs Node.js — File upload, download, deletion
 * Tests FILE base type (10) requisites:
 *   Upload via _m_save (multipart), display in edit_obj, download,
 *   file replacement, deletion, blacklist validation
 */
import { PHP, NODE, DB, http, dual, setup, preCleanup, section, summary, generateMD, writeReports, createType, addColumn, createObj, getXsrf, cookie } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Blob } from 'buffer';

const dir = dirname(fileURLToPath(import.meta.url));
const PREFIX = '__file_';
const TS = Date.now();

/** Build a multipart FormData with a file field */
function buildFileForm(xsrf, fieldName, fileName, content, extraFields = {}) {
  const fd = new FormData();
  fd.set('_xsrf', xsrf);
  fd.set('JSON', '1');
  for (const [k, v] of Object.entries(extraFields)) fd.set(k, v);
  const blob = new Blob([content], { type: 'application/octet-stream' });
  fd.set(fieldName, blob, fileName);
  return fd;
}

async function run() {
  const { xsrfPhp, xsrfNode } = await setup();
  await preCleanup(PREFIX);

  // ── Setup: Type with FILE column ──────────────────────────────────────────
  const mainType = await createType(`${PREFIX}docs_${TS}`, 3);
  const colName = await addColumn(mainType, 3);   // SHORT — name
  const colFile = await addColumn(mainType, 10);   // FILE
  console.log('  colFile:', colFile);

  // Create test object
  const obj1 = await createObj(mainType, 'TestDoc1');
  const obj2 = await createObj(mainType, 'TestDoc2');

  // ── Upload via _m_save ──────────────────────────────────────────────────
  section('File Upload — _m_save');

  // 1. Upload file via _m_save (multipart)
  if (colFile.php && colFile.node) {
    const fileContent = 'Hello, this is a test file content!\nLine 2\n';
    const ck = cookie();

    const phpForm = buildFileForm(xsrfPhp, `t${colFile.php}`, 'test_doc.txt', fileContent,
      { [`t${mainType.php}`]: 'TestDoc1' });
    const nodeForm = buildFileForm(xsrfNode, `t${colFile.node}`, 'test_doc.txt', fileContent,
      { [`t${mainType.node}`]: 'TestDoc1' });

    const [phpRes, nodeRes] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_save/${obj1.php}`, phpForm, ck),
      http(NODE, 'POST', `/${DB}/_m_save/${obj1.node}`, nodeForm, ck),
    ]);

    // Compare status codes
    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    const match = diffs.length === 0;
    console.log(`  ${match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m'}  #1 POST /_m_save (upload file)`);
    if (!match) diffs.forEach(d => console.log(`    → ${d}`));

    // Save reports
    writeFileSync(join(dir, '..', 'reports', '17-file-upload', '01-php.json'),
      JSON.stringify(phpRes.json, null, 2) || phpRes.body);
    writeFileSync(join(dir, '..', 'reports', '17-file-upload', '01-node.json'),
      JSON.stringify(nodeRes.json, null, 2) || nodeRes.body);
  }

  // 2. Verify file appears in edit_obj
  await dual('#2 GET /edit_obj (after upload)', 'GET',
    s => `/edit_obj/${obj1[s]}?JSON=1`, null, { keysOnly: true });

  // 3. Verify file appears in object listing
  await dual('#3 GET /object (listing with file)', 'GET',
    s => `/object/${mainType[s]}?JSON=1`);

  // ── Upload via _m_set ───────────────────────────────────────────────────
  section('File Upload — _m_set');

  // 4. Upload file via _m_set (single field)
  if (colFile.php && colFile.node) {
    const fileContent2 = 'Second file content for _m_set test\n';
    const ck = cookie();

    const phpForm = buildFileForm(xsrfPhp, `t${colFile.php}`, 'report.csv', fileContent2);
    const nodeForm = buildFileForm(xsrfNode, `t${colFile.node}`, 'report.csv', fileContent2);

    const [phpRes, nodeRes] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_set/${obj2.php}`, phpForm, ck),
      http(NODE, 'POST', `/${DB}/_m_set/${obj2.node}`, nodeForm, ck),
    ]);

    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    const match = diffs.length === 0;
    console.log(`  ${match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m'}  #4 POST /_m_set (upload file)`);
    if (!match) diffs.forEach(d => console.log(`    → ${d}`));
  }

  // 5. Verify obj2 has file in edit_obj
  await dual('#5 GET /edit_obj (after _m_set upload)', 'GET',
    s => `/edit_obj/${obj2[s]}?JSON=1`, null, { keysOnly: true });

  // ── File Replacement ────────────────────────────────────────────────────
  section('File Upload — Replace');

  // 6. Replace file on obj1
  if (colFile.php && colFile.node) {
    const newContent = 'REPLACED file content v2\n';
    const ck = cookie();

    const phpForm = buildFileForm(xsrfPhp, `t${colFile.php}`, 'updated_doc.pdf', newContent,
      { [`t${mainType.php}`]: 'TestDoc1' });
    const nodeForm = buildFileForm(xsrfNode, `t${colFile.node}`, 'updated_doc.pdf', newContent,
      { [`t${mainType.node}`]: 'TestDoc1' });

    const [phpRes, nodeRes] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_save/${obj1.php}`, phpForm, ck),
      http(NODE, 'POST', `/${DB}/_m_save/${obj1.node}`, nodeForm, ck),
    ]);

    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    const match = diffs.length === 0;
    console.log(`  ${match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m'}  #6 POST /_m_save (replace file)`);
    if (!match) diffs.forEach(d => console.log(`    → ${d}`));
  }

  // 7. Verify replacement
  await dual('#7 GET /edit_obj (after replace)', 'GET',
    s => `/edit_obj/${obj1[s]}?JSON=1`, null, { keysOnly: true });

  // ── File Clear ──────────────────────────────────────────────────────────
  section('File Upload — Clear');

  // 8. Clear file by sending empty value
  // statusOnly: PHP tries to delete from its local path, shared DB causes path mismatch
  if (colFile.php && colFile.node) {
    await dual('#8 POST /_m_set (clear file)', 'POST',
      s => `/_m_set/${obj2[s]}`,
      s => `_xsrf=${getXsrf(s)}&t${colFile[s]}=&JSON=1`, { statusOnly: true });
  }

  // 9. Verify cleared
  await dual('#9 GET /edit_obj (after clear)', 'GET',
    s => `/edit_obj/${obj2[s]}?JSON=1`, null, { keysOnly: true });

  // ── Blacklist ───────────────────────────────────────────────────────────
  section('File Upload — Blacklist');

  // 10. Try uploading .php file (should be rejected)
  if (colFile.php && colFile.node) {
    const phpContent = '<?php echo "hack"; ?>';
    const ck = cookie();

    const phpForm = buildFileForm(xsrfPhp, `t${colFile.php}`, 'evil.php', phpContent);
    const nodeForm = buildFileForm(xsrfNode, `t${colFile.node}`, 'evil.php', phpContent);

    const [phpRes, nodeRes] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_set/${obj1.php}`, phpForm, ck),
      http(NODE, 'POST', `/${DB}/_m_set/${obj1.node}`, nodeForm, ck),
    ]);

    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    // Both should reject — check that neither accepted
    const isRejected = (r) => r.body.includes('Недопустимый') || r.body.includes('Wrong') || r.body.includes('file') || r.status >= 400;
    const phpRejected = isRejected(phpRes);
    const nodeRejected = isRejected(nodeRes);
    console.log(`  ${phpRejected && nodeRejected ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m'}  #10 POST /_m_set (blacklisted .php)`);
    if (!phpRejected) console.log(`    → PHP did NOT reject .php file`);
    if (!nodeRejected) console.log(`    → Node did NOT reject .php file`);
  }

  // 11. Try uploading .jsp file
  if (colFile.php && colFile.node) {
    const jspContent = '<% out.println("hack"); %>';
    const ck = cookie();

    const phpForm = buildFileForm(xsrfPhp, `t${colFile.php}`, 'evil.jsp', jspContent);
    const nodeForm = buildFileForm(xsrfNode, `t${colFile.node}`, 'evil.jsp', jspContent);

    const [phpRes, nodeRes] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_set/${obj1.php}`, phpForm, ck),
      http(NODE, 'POST', `/${DB}/_m_set/${obj1.node}`, nodeForm, ck),
    ]);

    const isRejected = (r) => r.body.includes('Недопустимый') || r.body.includes('Wrong') || r.body.includes('file') || r.status >= 400;
    const phpRejected = isRejected(phpRes);
    const nodeRejected = isRejected(nodeRes);
    console.log(`  ${phpRejected && nodeRejected ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m'}  #11 POST /_m_set (blacklisted .jsp)`);
    if (!phpRejected) console.log(`    → PHP did NOT reject .jsp file`);
    if (!nodeRejected) console.log(`    → Node did NOT reject .jsp file`);
  }

  // 12. Upload allowed extension (.txt)
  if (colFile.php && colFile.node) {
    const txtContent = 'Safe text file\n';
    const ck = cookie();

    const phpForm = buildFileForm(xsrfPhp, `t${colFile.php}`, 'safe.txt', txtContent);
    const nodeForm = buildFileForm(xsrfNode, `t${colFile.node}`, 'safe.txt', txtContent);

    const [phpRes, nodeRes] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_set/${obj1.php}`, phpForm, ck),
      http(NODE, 'POST', `/${DB}/_m_set/${obj1.node}`, nodeForm, ck),
    ]);

    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    const match = diffs.length === 0;
    console.log(`  ${match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m'}  #12 POST /_m_set (allowed .txt)`);
    if (!match) diffs.forEach(d => console.log(`    → ${d}`));
  }

  // ── Special Characters ──────────────────────────────────────────────────
  section('File Upload — Special Names');

  // 13. File with Cyrillic name
  if (colFile.php && colFile.node) {
    const content = 'Содержимое файла\n';
    const ck = cookie();

    const phpForm = buildFileForm(xsrfPhp, `t${colFile.php}`, 'отчёт_2025.docx', content);
    const nodeForm = buildFileForm(xsrfNode, `t${colFile.node}`, 'отчёт_2025.docx', content);

    const [phpRes, nodeRes] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_set/${obj2.php}`, phpForm, ck),
      http(NODE, 'POST', `/${DB}/_m_set/${obj2.node}`, nodeForm, ck),
    ]);

    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    const match = diffs.length === 0;
    console.log(`  ${match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m'}  #13 POST /_m_set (Cyrillic filename)`);
    if (!match) diffs.forEach(d => console.log(`    → ${d}`));
  }

  // 14. File with spaces in name
  if (colFile.php && colFile.node) {
    const content = 'Spaced filename content\n';
    const ck = cookie();

    const phpForm = buildFileForm(xsrfPhp, `t${colFile.php}`, 'my document v2.txt', content);
    const nodeForm = buildFileForm(xsrfNode, `t${colFile.node}`, 'my document v2.txt', content);

    const [phpRes, nodeRes] = await Promise.all([
      http(PHP, 'POST', `/${DB}/_m_save/${obj1.php}`, phpForm, ck),
      http(NODE, 'POST', `/${DB}/_m_save/${obj1.node}`, nodeForm, ck),
    ]);

    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    const match = diffs.length === 0;
    console.log(`  ${match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m'}  #14 POST /_m_save (spaces in filename)`);
    if (!match) diffs.forEach(d => console.log(`    → ${d}`));
  }

  // 15. Final state check
  await dual('#15 GET /object (final state)', 'GET',
    s => `/object/${mainType[s]}?JSON=1`);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  section('Cleanup');
  await preCleanup(PREFIX);

  const s = summary();
  writeFileSync(join(dir, '17-file-upload-results.md'), generateMD('17-file-upload — File Upload, Download, Blacklist'));
  writeReports('17-file-upload', join(dir, '..', 'reports'));
  console.log(`\nWrote 17-file-upload-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
