/**
 * Regression tests for sendLegacyDie() — issue #426.
 *
 * PHP my_die() outputs JSON error arrays with Content-Type: text/html
 * (from the global header at index.php:3). sendLegacyDie() replicates
 * this behavior for PHP parity.
 */

import { describe, it, expect, vi } from 'vitest';

// ─── mock mysql2/promise ─────────────────────────────────────────────────────
vi.mock('mysql2/promise', () => ({
  default: {
    createPool: vi.fn(() => ({
      query: vi.fn(),
    })),
  },
}));

// ─── mock logger ─────────────────────────────────────────────────────────────
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

// ─── mock cookie-parser ──────────────────────────────────────────────────────
vi.mock('cookie-parser', () => ({
  default: () => (_req, _res, next) => next(),
}));

// ─── import after mocks ─────────────────────────────────────────────────────
const { sendLegacyDie } = await import('../legacy-compat.js');

/**
 * Build a mock Express response object that records status, headers, and body.
 */
function mockRes() {
  const res = {
    _status: null,
    _type: null,
    _body: null,
    status(code) {
      res._status = code;
      return res;
    },
    type(t) {
      res._type = t;
      return res;
    },
    send(body) {
      res._body = body;
      return res;
    },
  };
  return res;
}

describe('sendLegacyDie (#426)', () => {
  it('sets Content-Type to text/html; charset=UTF-8 (matching PHP)', () => {
    const res = mockRes();
    sendLegacyDie(res, 'some error');
    expect(res._type).toBe('text/html; charset=UTF-8');
  });

  it('defaults to HTTP 200 status (matching PHP my_die)', () => {
    const res = mockRes();
    sendLegacyDie(res, 'some error');
    expect(res._status).toBe(200);
  });

  it('wraps string error in [{error: "..."}] array format', () => {
    const res = mockRes();
    sendLegacyDie(res, 'Authentication error');
    expect(JSON.parse(res._body)).toEqual([{ error: 'Authentication error' }]);
  });

  it('passes pre-built array payload through unchanged', () => {
    const res = mockRes();
    const payload = [{ error: 'custom', code: 42 }];
    sendLegacyDie(res, payload);
    expect(JSON.parse(res._body)).toEqual(payload);
  });

  it('respects custom status code (e.g. 403 for XSRF)', () => {
    const res = mockRes();
    sendLegacyDie(res, 'invalid_csrf', 403);
    expect(res._status).toBe(403);
    expect(res._type).toBe('text/html; charset=UTF-8');
  });

  it('respects custom status code 401 for auth errors', () => {
    const res = mockRes();
    sendLegacyDie(res, 'auth_failed', 401);
    expect(res._status).toBe(401);
  });

  it('produces valid JSON string in body', () => {
    const res = mockRes();
    sendLegacyDie(res, 'test');
    expect(() => JSON.parse(res._body)).not.toThrow();
  });

  it('body matches PHP my_die output format: [{"error":"msg"}]', () => {
    const res = mockRes();
    sendLegacyDie(res, 'Запрос не распознан');
    // PHP: die('[{"error":"Запрос не распознан"}]')
    expect(res._body).toBe('[{"error":"Запрос не распознан"}]');
  });

  it('does NOT set application/json Content-Type', () => {
    const res = mockRes();
    sendLegacyDie(res, 'error');
    expect(res._type).not.toContain('application/json');
  });
});
