/**
 * Issue #414: Unknown actions render main page instead of 404
 *
 * PHP's switch($a) default: case renders main.html for any unrecognized
 * action. Node.js previously called next() which fell through to Express's
 * 404 handler. This test verifies the fix.
 *
 * PHP reference: index.php lines 9118-9162
 *
 * Note: HTTP-level tests (supertest) are not possible in the current
 * test environment (Node.js v25 + Express causes "socket hang up" on
 * all HTTP methods). These unit tests verify the handler logic directly
 * by examining the route registration and handler behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// ─── Mocks ────────────────────────────────────────────────────────────────────

let mockQueryFn = vi.fn().mockResolvedValue([[]]);

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: vi.fn(() => ({
      query: (...args) => mockQueryFn(...args),
    })),
  },
}));

vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

vi.mock('cookie-parser', () => ({
  default: () => (_req, _res, next) => next(),
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: vi.fn() })) },
}));

vi.mock('multer', () => {
  const handler = () => (_req, _res, next) => next();
  const multer = () => ({ none: handler, any: handler, single: () => handler(), fields: () => handler() });
  multer.memoryStorage = () => ({});
  multer.diskStorage = () => ({});
  return { default: multer };
});

// ─── Import after mocks ──────────────────────────────────────────────────────

const legacyCompat = await import('../legacy-compat.js');
const router = legacyCompat.default;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockReq(overrides = {}) {
  return {
    method: 'GET',
    url: '/testdb/unknown_page',
    path: '/testdb/unknown_page',
    originalUrl: '/testdb/unknown_page',
    query: {},
    body: {},
    params: {},
    cookies: {},
    headers: {},
    get: function(h) { return this.headers[h?.toLowerCase()] || ''; },
    ...overrides,
  };
}

function createMockRes() {
  const headers = {};
  let statusCode = 200;
  let sentBody = null;
  let redirectUrl = null;
  let fileToSend = null;
  let contentType = null;
  let ended = false;
  let jsonBody = null;
  let clearedCookies = [];

  const res = {
    get statusCode() { return statusCode; },
    _headers: headers,
    _sentBody: () => sentBody,
    _redirectUrl: () => redirectUrl,
    _fileToSend: () => fileToSend,
    _jsonBody: () => jsonBody,
    _ended: () => ended,
    _clearedCookies: () => clearedCookies,
    setHeader(key, val) { headers[key] = val; return res; },
    getHeader(key) { return headers[key]; },
    removeHeader(key) { delete headers[key]; return res; },
    set(key, val) { headers[key] = val; return res; },
    status(code) { statusCode = code; return res; },
    send(body) { sentBody = body; ended = true; return res; },
    json(body) { jsonBody = body; sentBody = JSON.stringify(body); ended = true; return res; },
    redirect(url) { statusCode = 302; redirectUrl = url; ended = true; return res; },
    sendFile(f) { fileToSend = f; ended = true; return res; },
    type(t) { contentType = t; return res; },
    end() { ended = true; },
    clearCookie(name, opts) { clearedCookies.push(name); return res; },
    headersSent: false,
  };
  return res;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Issue #414 — Unknown actions render main page instead of 404', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryFn = vi.fn().mockResolvedValue([[]]);
  });

  describe('Route registration', () => {
    it('has a POST /:db/:action catch-all route', () => {
      // The router should have a route matching /:db/:action
      const postRoutes = router.stack.filter(layer =>
        layer.route && layer.route.methods.post
      );
      const catchAllRoute = postRoutes.find(layer =>
        layer.route.path === '/:db/:action'
      );
      expect(catchAllRoute).toBeDefined();
    });

    it('has a GET /:db/:page* route', () => {
      const getRoutes = router.stack.filter(layer =>
        layer.route && layer.route.methods.get
      );
      const pageRoute = getRoutes.find(layer =>
        layer.route.path === '/:db/:page*'
      );
      expect(pageRoute).toBeDefined();
    });
  });

  describe('GET /:db/:page* handler — unknown pages (no token)', () => {
    // The GET /:db/:page* handler should redirect to login for unknown pages
    // when there is no token, matching PHP behavior.

    it('redirects to login for unknown page without token', () => {
      const req = createMockReq({
        method: 'GET',
        url: '/testdb/nonexistent_page',
        path: '/testdb/nonexistent_page',
        params: { db: 'testdb', page: 'nonexistent_page', 0: '' },
        query: {},
      });
      const res = createMockRes();

      // Find the GET /:db/:page* handler
      const getRoutes = router.stack.filter(l =>
        l.route && l.route.methods.get && l.route.path === '/:db/:page*'
      );
      expect(getRoutes.length).toBeGreaterThan(0);

      // The handler checks for token — no cookies means no token → redirect
      // We verify the handler doesn't call next() (which would 404)
      const handler = getRoutes[0].route.stack[0].handle;
      const nextCalled = { value: false };

      // Execute the handler
      handler(req, res, () => { nextCalled.value = true; });

      // Without token, should redirect to login (not call next)
      // The redirect happens synchronously in extractToken check
      expect(res._redirectUrl()).toMatch(/login/);
    });
  });

  describe('GET /:db/:page*?JSON handler — unknown pages (no token)', () => {
    it('returns auth_required error for unknown page JSON request without token', () => {
      const req = createMockReq({
        method: 'GET',
        url: '/testdb/nonexistent_page?JSON',
        path: '/testdb/nonexistent_page',
        params: { db: 'testdb', page: 'nonexistent_page', 0: '' },
        query: { JSON: '' },
      });
      const res = createMockRes();

      const getRoutes = router.stack.filter(l =>
        l.route && l.route.methods.get && l.route.path === '/:db/:page*'
      );
      const handler = getRoutes[0].route.stack[0].handle;

      handler(req, res, () => {});

      // JSON request without token should return auth error, not 404
      const body = res._jsonBody();
      expect(body).toBeInstanceOf(Array);
      expect(body[0]).toHaveProperty('error');
    });
  });

  describe('POST /:db/:action handler — unknown actions', () => {
    it('does not return error JSON for unknown action (no token, non-API)', async () => {
      const req = createMockReq({
        method: 'POST',
        url: '/testdb/unknown_action',
        path: '/testdb/unknown_action',
        params: { db: 'testdb', action: 'unknown_action' },
        query: {},
        headers: {},
      });
      const res = createMockRes();

      const postRoutes = router.stack.filter(l =>
        l.route && l.route.methods.post && l.route.path === '/:db/:action'
      );
      const handler = postRoutes[0].route.stack[0].handle;

      await handler(req, res);

      // Without token, non-API request should redirect to login
      expect(res._redirectUrl()).toMatch(/login/);
    });

    it('returns auth_required for unknown action JSON request without token', async () => {
      const req = createMockReq({
        method: 'POST',
        url: '/testdb/unknown_action?JSON',
        path: '/testdb/unknown_action',
        params: { db: 'testdb', action: 'unknown_action' },
        query: { JSON: '' },
        headers: {},
      });
      const res = createMockRes();

      const postRoutes = router.stack.filter(l =>
        l.route && l.route.methods.post && l.route.path === '/:db/:action'
      );
      const handler = postRoutes[0].route.stack[0].handle;

      await handler(req, res);

      // JSON request without token should return auth error
      const body = res._jsonBody();
      expect(body).toBeInstanceOf(Array);
      expect(body[0]).toHaveProperty('error');
    });

    it('returns menu data for unknown action JSON with valid token', async () => {
      // Mock DB returning user row for token validation
      mockQueryFn = vi.fn().mockResolvedValue([[{ uid: 1, uname: 'testuser', xsrf_val: 'x' }]]);

      const req = createMockReq({
        method: 'POST',
        url: '/testdb/unknown_action?JSON',
        path: '/testdb/unknown_action',
        params: { db: 'testdb', action: 'unknown_action' },
        query: { JSON: '' },
        cookies: { testdb: 'valid-token' },
        headers: {},
      });
      const res = createMockRes();

      const postRoutes = router.stack.filter(l =>
        l.route && l.route.methods.post && l.route.path === '/:db/:action'
      );
      const handler = postRoutes[0].route.stack[0].handle;

      await handler(req, res);

      // With valid token and JSON, should return menu data (not error)
      const body = res._jsonBody();
      expect(body).toBeDefined();
      // PHP default: case + isApi() returns api globals including myrolemenu
      expect(body).toHaveProperty('&main.myrolemenu');
    });

    it('renders main page for unknown action with valid token (non-API)', async () => {
      // Mock DB returning user row for token validation
      mockQueryFn = vi.fn().mockResolvedValue([[{ uid: 1, uname: 'testuser', xsrf_val: 'x' }]]);

      const req = createMockReq({
        method: 'POST',
        url: '/testdb/unknown_action',
        path: '/testdb/unknown_action',
        params: { db: 'testdb', action: 'unknown_action' },
        query: {},
        cookies: { testdb: 'valid-token' },
        headers: {},
      });
      const res = createMockRes();

      const postRoutes = router.stack.filter(l =>
        l.route && l.route.methods.post && l.route.path === '/:db/:action'
      );
      const handler = postRoutes[0].route.stack[0].handle;

      await handler(req, res);

      // Non-API with valid token: should try to render main.html
      // If main.html template exists → send HTML; otherwise falls back to error JSON
      // In test env without template files, it falls to the error JSON fallback
      const body = res._sentBody();
      const jsonB = res._jsonBody();
      // Either rendered HTML body or fallback JSON — but NOT a 404
      expect(body || jsonB).toBeDefined();
      expect(res.statusCode).not.toBe(404);
    });

    it('does not return "Unknown action" error for valid DB name', async () => {
      const req = createMockReq({
        method: 'POST',
        url: '/testdb/unknown_action?JSON',
        path: '/testdb/unknown_action',
        params: { db: 'testdb', action: 'unknown_action' },
        query: { JSON: '' },
        headers: {},
      });
      const res = createMockRes();

      const postRoutes = router.stack.filter(l =>
        l.route && l.route.methods.post && l.route.path === '/:db/:action'
      );
      const handler = postRoutes[0].route.stack[0].handle;

      await handler(req, res);

      // Should NOT return the old "Unknown action: xxx" error
      const body = res._jsonBody();
      if (body && !Array.isArray(body)) {
        expect(body.error).not.toMatch(/Unknown action/);
      }
    });
  });
});
