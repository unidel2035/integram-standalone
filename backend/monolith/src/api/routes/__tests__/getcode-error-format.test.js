/**
 * Regression test for Issue #405: getcode error response format
 *
 * PHP returns error as a bare JSON object: {"error":"invalid user"}
 * Node.js was incorrectly wrapping it in an array: [{"error":"invalid user"}]
 * This broke frontend parsing since response.error would be undefined.
 *
 * These tests verify the source code directly to ensure the fix stays in place.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const legacyCompatSource = fs.readFileSync(
  path.join(__dirname, '..', 'legacy-compat.js'),
  'utf-8'
);

describe('getcode error response format (Issue #405)', () => {
  // Extract the getcode handler source code for analysis
  const getcodeStart = legacyCompatSource.indexOf("router.post('/:db/getcode'");
  const getcodeEnd = legacyCompatSource.indexOf("router.post('/:db/checkcode'");
  const getcodeSource = legacyCompatSource.slice(getcodeStart, getcodeEnd);

  it('getcode handler exists in legacy-compat.js', () => {
    expect(getcodeStart).toBeGreaterThan(-1);
    expect(getcodeSource).toContain('getcode');
  });

  it('invalid-user error is NOT wrapped in array (regression #405)', () => {
    // The bug was: res.json([{ error: 'invalid user' }])
    // The fix is:  res.send('{"error":"invalid user"}') or res.json({ error: '...' })
    expect(getcodeSource).not.toMatch(/json\s*\(\s*\[\s*\{\s*error\s*:/);
    // Must contain the bare error response
    expect(getcodeSource).toContain('"error":"invalid user"');
  });

  it('invalid-user error uses text/html content type (matching PHP die())', () => {
    // PHP die('{"error":"invalid user"}') sends text/html
    // Node.js must match: res.type('text/html').send(...)
    expect(getcodeSource).toMatch(/type\s*\(\s*['"]text\/html['"]\s*\)/);
  });

  it('invalid-user error sends bare JSON string (matching PHP die())', () => {
    // PHP: die('{"error":"invalid user"}')
    // Node: res.status(200).type('text/html').send('{"error":"invalid user"}')
    expect(getcodeSource).toMatch(/\.send\s*\(\s*'\{"error":"invalid user"\}'\s*\)/);
  });

  it('user-not-found response is a bare object with msg:new', () => {
    // PHP: die('{"msg":"new"}')
    // Node: res.json({ msg: 'new' }) — must NOT be an array
    expect(getcodeSource).toMatch(/\.json\s*\(\s*\{\s*msg\s*:\s*'new'\s*\}\s*\)/);
    expect(getcodeSource).not.toMatch(/\.json\s*\(\s*\[\s*\{\s*msg\s*:\s*'new'\s*\}\s*\]\s*\)/);
  });

  it('user-found response is a bare object with msg:ok', () => {
    // PHP: die('{"msg":"ok"}')
    // Node: res.json({ msg: 'ok' }) — must NOT be an array
    expect(getcodeSource).toMatch(/\.json\s*\(\s*\{\s*msg\s*:\s*'ok'\s*\}\s*\)/);
    expect(getcodeSource).not.toMatch(/\.json\s*\(\s*\[\s*\{\s*msg\s*:\s*'ok'\s*\}\s*\]\s*\)/);
  });

  it('server-error response is a bare object (not array)', () => {
    // The catch block should return { error: 'server error' }, not [{ error: '...' }]
    expect(getcodeSource).toMatch(/\.json\s*\(\s*\{\s*error\s*:\s*'server error'\s*\}\s*\)/);
    expect(getcodeSource).not.toMatch(/\.json\s*\(\s*\[\s*\{\s*error\s*:\s*'server error'\s*\}\s*\]\s*\)/);
  });
});
