/**
 * Regression test for issue #409:
 * Wrong credentials must return HTTP 200 with JSON array [{error: "..."}],
 * matching PHP's my_die() behaviour. Previously Node returned 401 + plain text.
 *
 * This test verifies the source code directly (grep-style) rather than using
 * supertest HTTP calls, which are broken on Node v25 (socket hang up).
 * The existing tests in legacy-compat.test.js (lines 144-167) provide the
 * supertest-based coverage for this behaviour once supertest compatibility
 * is restored.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceFile = path.resolve(__dirname, '../legacy-compat.js');
const source = readFileSync(sourceFile, 'utf-8');

describe('Issue #409 — wrong credentials response format', () => {
  // Extract all lines that respond after "User not found" or "Password mismatch"
  // These are the two code paths for wrong credentials in the POST /:db/auth handler.

  it('wrong credentials response uses status(200), not status(401)', () => {
    // Find all lines with "Wrong credentials" in the response
    const wrongCredLines = source.split('\n').filter(line =>
      line.includes('Wrong credentials') && line.includes('res.status')
    );

    expect(wrongCredLines.length).toBeGreaterThanOrEqual(2); // user-not-found + password-mismatch paths

    for (const line of wrongCredLines) {
      // Must use status(200)
      expect(line).toContain('status(200)');
      // Must NOT use status(401)
      expect(line).not.toContain('status(401)');
    }
  });

  it('wrong credentials response is JSON array with error key', () => {
    const wrongCredLines = source.split('\n').filter(line =>
      line.includes('Wrong credentials') && line.includes('res.status')
    );

    for (const line of wrongCredLines) {
      // Must use .json() not .send()
      expect(line).toContain('.json(');
      expect(line).not.toMatch(/\.send\(/);
      // Must wrap in array: .json([{ error: ... }])
      expect(line).toMatch(/\.json\(\[\{/);
    }
  });

  it('wrong credentials message includes username and database placeholders', () => {
    const wrongCredLines = source.split('\n').filter(line =>
      line.includes('Wrong credentials') && line.includes('res.status')
    );

    for (const line of wrongCredLines) {
      // Must include dynamic login and db values
      expect(line).toContain('${login}');
      expect(line).toContain('${db}');
    }
  });

  it('no 401 status codes exist for credential error paths', () => {
    // Ensure no line combines "401" with "credentials" or "Wrong" or "Invalid credentials"
    const lines = source.split('\n');
    const bad401Lines = lines.filter(line =>
      line.includes('401') &&
      (line.includes('Invalid credentials') || line.includes('Wrong credentials'))
    );

    expect(bad401Lines).toHaveLength(0);
  });
});
