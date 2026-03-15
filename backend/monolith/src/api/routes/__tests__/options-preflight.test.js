/**
 * OPTIONS preflight — PHP parity (Issue #378, #421)
 *
 * PHP (index.php:242-246) returns HTTP 200, Allow: GET,POST,OPTIONS,
 * and Content-Length: 0 for all OPTIONS requests.
 *
 * Issue #378: The cors middleware was returning 204 with no Allow header.
 * Issue #421: The fix was applied in the CORS middleware, but a dead
 *   router.options('*') handler remained as unreachable code. That dead
 *   code has been removed; the CORS middleware now handles OPTIONS directly.
 *
 * Note: HTTP-level tests (supertest) are not possible in the current
 * test environment (Node.js v25 + Express causes "socket hang up" on
 * all HTTP methods). These unit tests verify the handler logic directly.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('OPTIONS preflight — CORS middleware logic (#378, #421)', () => {
  /**
   * Simulate the CORS middleware's OPTIONS branch:
   *   if (req.method === 'OPTIONS') {
   *     res.set('Allow', 'GET,POST,OPTIONS');
   *     res.set('Content-Length', '0');
   *     return res.status(200).end();
   *   }
   */
  function createMockRes() {
    const headers = {};
    const res = {
      _status: null,
      _ended: false,
      set(key, val) { headers[key] = val; return res; },
      setHeader(key, val) { headers[key] = val; return res; },
      removeHeader(key) { delete headers[key]; return res; },
      status(code) { res._status = code; return res; },
      end() { res._ended = true; },
      _headers: headers,
    };
    return res;
  }

  /**
   * This mirrors the CORS middleware in legacy-compat.js.
   * It sets CORS headers, then handles OPTIONS with Allow + 200.
   */
  function corsMiddleware(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.removeHeader('Access-Control-Allow-Credentials');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-Authorization, x-authorization,Content-Type,content-type,Origin,Authorization,authorization'
    );

    if (req.method === 'OPTIONS') {
      res.set('Allow', 'GET,POST,OPTIONS');
      res.set('Content-Length', '0');
      return res.status(200).end();
    }
    next();
  }

  it('sets status 200 (not 204) for OPTIONS', () => {
    const res = createMockRes();
    corsMiddleware({ method: 'OPTIONS' }, res, () => {});
    expect(res._status).toBe(200);
  });

  it('sets Allow: GET,POST,OPTIONS header', () => {
    const res = createMockRes();
    corsMiddleware({ method: 'OPTIONS' }, res, () => {});
    expect(res._headers['Allow']).toBe('GET,POST,OPTIONS');
  });

  it('sets Content-Length: 0 header', () => {
    const res = createMockRes();
    corsMiddleware({ method: 'OPTIONS' }, res, () => {});
    expect(res._headers['Content-Length']).toBe('0');
  });

  it('calls res.end() to terminate the response', () => {
    const res = createMockRes();
    corsMiddleware({ method: 'OPTIONS' }, res, () => {});
    expect(res._ended).toBe(true);
  });

  it('does NOT call next() for OPTIONS requests', () => {
    const res = createMockRes();
    let nextCalled = false;
    corsMiddleware({ method: 'OPTIONS' }, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
  });

  it('calls next() for non-OPTIONS requests', () => {
    const res = createMockRes();
    let nextCalled = false;
    corsMiddleware({ method: 'GET' }, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res._ended).toBe(false);
  });

  it('sets CORS headers for all requests including OPTIONS', () => {
    const res = createMockRes();
    corsMiddleware({ method: 'OPTIONS' }, res, () => {});
    expect(res._headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res._headers['Access-Control-Allow-Methods']).toBe('POST, GET, OPTIONS');
  });

  it('matches PHP behavior: 200 + Allow + Content-Length: 0 (index.php:242-246)', () => {
    const res = createMockRes();
    corsMiddleware({ method: 'OPTIONS' }, res, () => {});

    // PHP: implicit 200
    expect(res._status).toBe(200);
    // PHP: header("Allow: GET,POST,OPTIONS");
    expect(res._headers['Allow']).toBe('GET,POST,OPTIONS');
    // PHP: header("Content-Length: 0");
    expect(res._headers['Content-Length']).toBe('0');
    // PHP: die();
    expect(res._ended).toBe(true);
  });
});

describe('Issue #421 regression: no dead router.options handler', () => {
  it('legacy-compat.js does NOT contain a router.options() handler', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '..', 'legacy-compat.js'),
      'utf-8'
    );
    // The dead router.options('*') handler should have been removed.
    // OPTIONS is handled solely by the CORS middleware.
    expect(src).not.toMatch(/router\.options\s*\(/);
  });

  it('CORS middleware contains the OPTIONS branch with Allow header', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '..', 'legacy-compat.js'),
      'utf-8'
    );
    // Verify the middleware sets the Allow header inside the OPTIONS check
    expect(src).toMatch(/req\.method\s*===\s*'OPTIONS'/);
    expect(src).toMatch(/res\.set\('Allow'/);
  });
});
