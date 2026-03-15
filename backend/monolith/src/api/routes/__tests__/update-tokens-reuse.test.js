/**
 * Regression tests for updateTokens (#420):
 * PHP reuses existing token when a token row exists; Node.js must match.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── mock mysql2/promise ─────────────────────────────────────────────────────
let mockQueryFn = vi.fn();

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: vi.fn(() => ({
      query: (...args) => mockQueryFn(...args),
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
const { updateTokens } = await import('../legacy-compat.js');

const DB = 'testdb';

// Helper: build a mock pool whose .query returns the given responses in order
function makePool(...responses) {
  let idx = 0;
  return {
    query: vi.fn(async () => {
      const resp = responses[idx] ?? responses[responses.length - 1];
      idx++;
      return resp;
    }),
  };
}

describe('updateTokens (#420)', () => {
  beforeEach(() => {
    mockQueryFn.mockReset();
  });

  it('reuses existing token when tok (row ID) is present', async () => {
    const existingToken = 'abc123existingtoken';
    // Pool mock: UPDATE token, UPDATE xsrf, UPDATE activity
    const pool = makePool([[{ affectedRows: 1 }]], [[{ affectedRows: 1 }]], [[{ affectedRows: 1 }]]);

    const result = await updateTokens(pool, DB, {
      uid: 10,
      tok: 42,           // token row ID exists
      tok_val: existingToken,  // existing token value
      xsrf: 43,
      act: 44,
    });

    expect(result.token).toBe(existingToken);
    // First query should UPDATE the token row, not INSERT
    const firstCallSql = pool.query.mock.calls[0][0];
    expect(firstCallSql).toMatch(/UPDATE/i);
    // The token value passed to the UPDATE should be the existing one
    const firstCallParams = pool.query.mock.calls[0][1];
    expect(firstCallParams).toContain(existingToken);
  });

  it('generates new token when tok (row ID) is absent', async () => {
    // Pool mock: INSERT token, INSERT xsrf, INSERT activity
    const pool = makePool([[{ insertId: 100 }]], [[{ insertId: 101 }]], [[{ insertId: 102 }]]);

    const result = await updateTokens(pool, DB, {
      uid: 10,
      tok: null,        // no token row
      tok_val: null,
      xsrf: null,
      act: null,
    });

    // Should generate a new token (md5 hex = 32 chars)
    expect(result.token).toMatch(/^[a-f0-9]{32}$/);
    // First query should INSERT, not UPDATE
    const firstCallSql = pool.query.mock.calls[0][0];
    expect(firstCallSql).toMatch(/INSERT/i);
  });

  it('generates new token when tok is 0 (falsy row ID)', async () => {
    const pool = makePool([[{ insertId: 100 }]], [[{ insertId: 101 }]], [[{ insertId: 102 }]]);

    const result = await updateTokens(pool, DB, {
      uid: 10,
      tok: 0,           // falsy row ID — PHP treats as no row
      tok_val: 'shouldbeignored',
      xsrf: null,
      act: null,
    });

    // tok is falsy so new token should be generated, not reusing tok_val
    expect(result.token).not.toBe('shouldbeignored');
    expect(result.token).toMatch(/^[a-f0-9]{32}$/);
  });

  it('preserves existing token even if it looks unusual', async () => {
    const weirdToken = '00000000000000000000000000000000';
    const pool = makePool([[{ affectedRows: 1 }]], [[{ affectedRows: 1 }]], [[{ affectedRows: 1 }]]);

    const result = await updateTokens(pool, DB, {
      uid: 10,
      tok: 99,
      tok_val: weirdToken,
      xsrf: 100,
      act: 101,
    });

    expect(result.token).toBe(weirdToken);
  });

  it('returns both token and xsrf', async () => {
    const pool = makePool([[{ affectedRows: 1 }]], [[{ affectedRows: 1 }]], [[{ affectedRows: 1 }]]);

    const result = await updateTokens(pool, DB, {
      uid: 10,
      tok: 42,
      tok_val: 'mytoken',
      xsrf: 43,
      act: 44,
    });

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('xsrf');
    expect(typeof result.xsrf).toBe('string');
    expect(result.xsrf.length).toBe(22); // PHP xsrf is substr(sha1(...), 0, 22)
  });
});
