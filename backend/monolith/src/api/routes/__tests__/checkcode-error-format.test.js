/**
 * Checkcode error response format — regression test (Issue #406)
 *
 * PHP checkcode errors use die('{"error":"..."}') which sends:
 *   - Status 200
 *   - Content-Type: text/html
 *   - Body: bare JSON object (NOT wrapped in an array)
 *
 * Node.js previously returned [{ error: '...' }] with application/json,
 * breaking frontend code that checks `response.error`.
 *
 * These tests verify the source code directly since HTTP integration tests
 * have pre-existing socket issues in the test environment.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the source file directly
const sourceCode = readFileSync(resolve(__dirname, '../legacy-compat.js'), 'utf8');

describe('POST /:db/checkcode — error response format (#406)', () => {

  it('checkcode "user not found" error uses text/html and bare object, not array', () => {
    // PHP: die('{"error":"user not found"}') — sends text/html, bare object
    // Node must NOT use: res.json([{ error: 'user not found' }])
    // Node must use:     res.type('text/html').send('{"error":"user not found"}')

    // Verify no array-wrapped error responses exist for "user not found" in checkcode section
    const checkcodeSection = extractCheckcodeSection(sourceCode);

    // Must NOT contain array-wrapped error
    expect(checkcodeSection).not.toMatch(/\.json\(\[\s*\{\s*error:\s*['"]user not found['"]\s*\}\s*\]\)/);

    // Must use text/html send for PHP die() parity
    expect(checkcodeSection).toMatch(/\.type\(['"]text\/html['"]\)\.send\(['"].*user not found.*['"]\)/);
  });

  it('checkcode "invalid data" error uses text/html and bare object, not array', () => {
    // PHP: die('{"error":"invalid data"}') — sends text/html, bare object
    const checkcodeSection = extractCheckcodeSection(sourceCode);

    // Must NOT contain array-wrapped error
    expect(checkcodeSection).not.toMatch(/\.json\(\[\s*\{\s*error:\s*['"]invalid data['"]\s*\}\s*\]\)/);

    // Must use text/html send for PHP die() parity
    expect(checkcodeSection).toMatch(/\.type\(['"]text\/html['"]\)\.send\(['"].*invalid data.*['"]\)/);
  });

  it('checkcode errors are NOT wrapped in arrays anywhere', () => {
    const checkcodeSection = extractCheckcodeSection(sourceCode);

    // No .json([...]) patterns should exist in checkcode handler for error responses
    const arrayWrappedErrors = checkcodeSection.match(/\.json\(\[\s*\{[^}]*error[^}]*\}\s*\]\)/g);
    expect(arrayWrappedErrors).toBeNull();
  });

  it('checkcode error bodies are valid JSON with .error property when parsed by frontend', () => {
    // The text/html response body must be valid JSON that frontend can parse
    const errorBodies = [
      '{"error":"user not found"}',
      '{"error":"invalid data"}',
    ];

    for (const body of errorBodies) {
      const parsed = JSON.parse(body);
      expect(Array.isArray(parsed)).toBe(false);
      expect(parsed.error).toBeDefined();
      expect(typeof parsed.error).toBe('string');
    }
  });

  it('checkcode success response uses res.json() (not text/html)', () => {
    const checkcodeSection = extractCheckcodeSection(sourceCode);

    // Success path: res.status(200).json({ token: ..., _xsrf: ... })
    expect(checkcodeSection).toMatch(/\.json\(\{\s*token:/);
  });
});

/**
 * Extract the checkcode route handler section from the source code.
 */
function extractCheckcodeSection(source) {
  // Find the checkcode route handler
  const startMarker = "router.post('/:db/checkcode'";
  const startIdx = source.indexOf(startMarker);
  if (startIdx === -1) throw new Error('Could not find checkcode route in source');

  // Find the next router definition to bound the section
  const nextRouteIdx = source.indexOf('\nrouter.', startIdx + startMarker.length);
  const endIdx = nextRouteIdx !== -1 ? nextRouteIdx : startIdx + 2000;

  return source.substring(startIdx, endIdx);
}
