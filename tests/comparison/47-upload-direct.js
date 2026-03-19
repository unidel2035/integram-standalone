#!/usr/bin/env node
/**
 * 47-upload-direct: PHP vs Node.js — POST /upload endpoint
 * Tests: direct file upload to /download/ directory,
 *        MIME verification, blacklist, no-auth, no-file error cases.
 * NOTE: POST /upload stores files in the /download/:db/ directory (not tied to an object).
 */
import { PHP, NODE, DB, DB_PHP, DB_NODE, http, setup, section, summary, generateMD, writeReports, cookie, cookieNode, results } from './lib.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Blob } from 'buffer';

const dir = dirname(fileURLToPath(import.meta.url));

/** Build multipart form with a file */
function buildUploadForm(fieldName, fileName, content, mimeType = 'application/octet-stream') {
  const fd = new FormData();
  const blob = new Blob([content], { type: mimeType });
  fd.set(fieldName, blob, fileName);
  return fd;
}

/** Fake PNG header (8 bytes magic) + trailing garbage */
function fakePng(extraBytes = 100) {
  const buf = Buffer.alloc(8 + extraBytes);
  buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4E; buf[3] = 0x47; // \x89PNG
  buf[4] = 0x0D; buf[5] = 0x0A; buf[6] = 0x1A; buf[7] = 0x0A;
  buf.fill(0x20, 8);
  return buf;
}

/** Fake PDF header */
function fakePdf() {
  return Buffer.from('%PDF-1.4\n' + 'x'.repeat(50));
}

function pushResult(name, method, phpPath, nodePath, phpRes, nodeRes, diffs) {
  const match = diffs.length === 0;
  const icon = match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mDIFF\x1b[0m';
  console.log(`  ${icon}  ${name}${diffs.length ? '\n         ' + diffs.join('\n         ') : ''}`);
  results.push({
    name, match, diffs, method,
    phpStatus: phpRes.status, nodeStatus: nodeRes.status,
    phpBody: phpRes.body, nodeBody: nodeRes.body,
    phpJson: phpRes.json, nodeJson: nodeRes.json,
    phpPath, nodePath,
  });
}

async function run() {
  await setup();

  // ── Valid uploads ─────────────────────────────────────────────────────────
  section('Upload — Valid files');

  // 1. Upload plain text file
  {
    const content = 'Hello upload test\n' + Date.now();
    const phpForm  = buildUploadForm('file', 'test_upload.txt', content, 'text/plain');
    const nodeForm = buildUploadForm('file', 'test_upload.txt', content, 'text/plain');
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'POST', `/${DB_PHP}/upload`,  phpForm,  cookie()),
      http(NODE, 'POST', `/${DB_NODE}/upload`, nodeForm, cookieNode()),
    ]);
    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    if (phpRes.json && nodeRes.json) {
      if (phpRes.json.status !== nodeRes.json.status) diffs.push(`json.status: PHP=${phpRes.json.status} Node=${nodeRes.json.status}`);
      const pk = Object.keys(phpRes.json).sort().join(',');
      const nk = Object.keys(nodeRes.json).sort().join(',');
      if (pk !== nk) diffs.push(`keys: PHP=[${pk}] Node=[${nk}]`);
    }
    pushResult('#1 POST /upload (txt file)', 'POST', `/${DB_PHP}/upload`, `/${DB_NODE}/upload`, phpRes, nodeRes, diffs);
  }

  // 2. Upload CSV file
  {
    const content = 'id,name,value\n1,foo,42\n2,bar,99\n';
    const phpForm  = buildUploadForm('file', 'data.csv', content, 'text/csv');
    const nodeForm = buildUploadForm('file', 'data.csv', content, 'text/csv');
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'POST', `/${DB_PHP}/upload`,  phpForm,  cookie()),
      http(NODE, 'POST', `/${DB_NODE}/upload`, nodeForm, cookieNode()),
    ]);
    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    if (phpRes.json && nodeRes.json) {
      const pk = Object.keys(phpRes.json).sort().join(',');
      const nk = Object.keys(nodeRes.json).sort().join(',');
      if (pk !== nk) diffs.push(`keys: PHP=[${pk}] Node=[${nk}]`);
    }
    pushResult('#2 POST /upload (csv file)', 'POST', `/${DB_PHP}/upload`, `/${DB_NODE}/upload`, phpRes, nodeRes, diffs);
  }

  // 3. Upload fake PNG (valid magic bytes)
  {
    const content = fakePng();
    const phpForm  = buildUploadForm('file', 'image.png', content, 'image/png');
    const nodeForm = buildUploadForm('file', 'image.png', content, 'image/png');
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'POST', `/${DB_PHP}/upload`,  phpForm,  cookie()),
      http(NODE, 'POST', `/${DB_NODE}/upload`, nodeForm, cookieNode()),
    ]);
    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    pushResult('#3 POST /upload (png with valid magic)', 'POST', `/${DB_PHP}/upload`, `/${DB_NODE}/upload`, phpRes, nodeRes, diffs);
  }

  // 4. Upload fake PDF (valid magic bytes)
  {
    const content = fakePdf();
    const phpForm  = buildUploadForm('file', 'document.pdf', content, 'application/pdf');
    const nodeForm = buildUploadForm('file', 'document.pdf', content, 'application/pdf');
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'POST', `/${DB_PHP}/upload`,  phpForm,  cookie()),
      http(NODE, 'POST', `/${DB_NODE}/upload`, nodeForm, cookieNode()),
    ]);
    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    pushResult('#4 POST /upload (pdf with valid magic)', 'POST', `/${DB_PHP}/upload`, `/${DB_NODE}/upload`, phpRes, nodeRes, diffs);
  }

  // ── MIME mismatch ─────────────────────────────────────────────────────────
  section('Upload — MIME mismatch');

  // 5. PNG extension but text content (invalid magic) → should be rejected
  {
    const content = 'This is definitely not a PNG file\n';
    const phpForm  = buildUploadForm('file', 'fake.png', content, 'image/png');
    const nodeForm = buildUploadForm('file', 'fake.png', content, 'image/png');
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'POST', `/${DB_PHP}/upload`,  phpForm,  cookie()),
      http(NODE, 'POST', `/${DB_NODE}/upload`, nodeForm, cookieNode()),
    ]);
    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    // Both should reject
    const phpOk  = phpRes.status < 400;
    const nodeOk = nodeRes.status < 400;
    if (phpOk !== nodeOk) diffs.push(`rejection: PHP=${phpOk ? 'accepted' : 'rejected'} Node=${nodeOk ? 'accepted' : 'rejected'}`);
    pushResult('#5 POST /upload (png ext, wrong magic)', 'POST', `/${DB_PHP}/upload`, `/${DB_NODE}/upload`, phpRes, nodeRes, diffs);
  }

  // 6. JPG extension but text content → should be rejected
  {
    const content = 'Not a JPEG at all';
    const phpForm  = buildUploadForm('file', 'photo.jpg', content, 'image/jpeg');
    const nodeForm = buildUploadForm('file', 'photo.jpg', content, 'image/jpeg');
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'POST', `/${DB_PHP}/upload`,  phpForm,  cookie()),
      http(NODE, 'POST', `/${DB_NODE}/upload`, nodeForm, cookieNode()),
    ]);
    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    pushResult('#6 POST /upload (jpg ext, wrong magic)', 'POST', `/${DB_PHP}/upload`, `/${DB_NODE}/upload`, phpRes, nodeRes, diffs);
  }

  // ── Error cases ───────────────────────────────────────────────────────────
  section('Upload — Error cases');

  // 7. No file in body
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'POST', `/${DB_PHP}/upload`,  'dummy=1', cookie()),
      http(NODE, 'POST', `/${DB_NODE}/upload`, 'dummy=1', cookieNode()),
    ]);
    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    pushResult('#7 POST /upload (no file)', 'POST', `/${DB_PHP}/upload`, `/${DB_NODE}/upload`, phpRes, nodeRes, diffs);
  }

  // 8. No auth
  {
    const content = 'no auth test';
    const phpForm  = buildUploadForm('file', 'noauth.txt', content);
    const nodeForm = buildUploadForm('file', 'noauth.txt', content);
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'POST', `/${DB_PHP}/upload`,  phpForm,  null),
      http(NODE, 'POST', `/${DB_NODE}/upload`, nodeForm, null),
    ]);
    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    pushResult('#8 POST /upload (no auth)', 'POST', `/${DB_PHP}/upload`, `/${DB_NODE}/upload`, phpRes, nodeRes, diffs);
  }

  // 9. GET /upload (page, not a POST)
  {
    const [phpRes, nodeRes] = await Promise.all([
      http(PHP,  'GET', `/${DB_PHP}/upload`,  null, cookie()),
      http(NODE, 'GET', `/${DB_NODE}/upload`, null, cookieNode()),
    ]);
    const diffs = [];
    if (phpRes.status !== nodeRes.status) diffs.push(`status: PHP=${phpRes.status} Node=${nodeRes.status}`);
    pushResult('#9 GET /upload (page)', 'GET', `/${DB_PHP}/upload`, `/${DB_NODE}/upload`, phpRes, nodeRes, diffs);
  }

  const s = summary();
  writeFileSync(join(dir, '47-upload-direct-results.md'), generateMD('47-upload-direct — POST /upload Endpoint'));
  writeReports('47-upload-direct', join(dir, '..', 'reports'));
  console.log(`\nWrote 47-upload-direct-results.md`);
  process.exit(s.diffCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(2); });
