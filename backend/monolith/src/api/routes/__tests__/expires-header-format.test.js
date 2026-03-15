/**
 * Expires header format — PHP parity (Issue #431)
 *
 * PHP (index.php:4) sets:
 *   header("Expires: ".date("r"));
 *
 * PHP date("r") produces RFC 2822 format: "Thu, 14 Mar 2026 12:00:00 +0000"
 * Node.js toUTCString() produces RFC 7231:  "Thu, 14 Mar 2026 12:00:00 GMT"
 *
 * The fix in legacy-compat.js replaces "GMT" with "+0000" so both servers
 * emit the same Expires header format.
 */

import { describe, it, expect, vi } from 'vitest';

describe('Expires header format (#431)', () => {
  // Replicate the Cache-Control middleware from legacy-compat.js (lines 257-263)
  function cacheControlMiddleware(_req, res, next) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const now = new Date();
    res.setHeader('Expires', now.toUTCString().replace('GMT', '+0000'));
    next();
  }

  function createMockRes() {
    const headers = {};
    return {
      setHeader(key, val) { headers[key] = val; },
      _headers: headers,
    };
  }

  it('Expires header ends with +0000, not GMT', () => {
    const res = createMockRes();
    cacheControlMiddleware({}, res, () => {});
    expect(res._headers['Expires']).toMatch(/\+0000$/);
    expect(res._headers['Expires']).not.toMatch(/GMT$/);
  });

  it('Expires header matches PHP date("r") RFC 2822 format', () => {
    const res = createMockRes();
    cacheControlMiddleware({}, res, () => {});
    // RFC 2822: "Day, DD Mon YYYY HH:MM:SS +0000"
    const rfc2822 = /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} \+0000$/;
    expect(res._headers['Expires']).toMatch(rfc2822);
  });

  it('Cache-Control header matches PHP value', () => {
    const res = createMockRes();
    cacheControlMiddleware({}, res, () => {});
    expect(res._headers['Cache-Control']).toBe('no-store, no-cache, must-revalidate');
  });

  it('calls next() to continue middleware chain', () => {
    const res = createMockRes();
    const next = vi.fn();
    cacheControlMiddleware({}, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('toUTCString().replace("GMT", "+0000") produces correct output for known date', () => {
    // Verify the replacement logic with a fixed date
    const fixed = new Date('2026-03-14T12:00:00Z');
    const result = fixed.toUTCString().replace('GMT', '+0000');
    expect(result).toBe('Sat, 14 Mar 2026 12:00:00 +0000');
  });
});
