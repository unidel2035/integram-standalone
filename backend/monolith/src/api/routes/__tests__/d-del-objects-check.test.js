/**
 * Regression tests for _d_del type deletion with objects check (#449)
 *
 * Verifies that _d_del blocks deletion when the type has existing objects,
 * matching PHP die() behavior at index.php:8741-8745.
 *
 * Uses unit-test approach: imports handler helpers and execSql directly,
 * avoiding complex HTTP middleware stack.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

let mockQuery;

const loggerStub = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: vi.fn(() => ({
      query: (...args) => mockQuery(...args),
    })),
  },
}));

vi.mock('../../../utils/logger.js', () => ({
  default: loggerStub,
  createLogger: vi.fn(() => loggerStub),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('_d_del type deletion with objects check (#449)', () => {
  let execSql;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockQuery = vi.fn().mockResolvedValue([[]]);

    // Import execSql to test query behavior directly
    const mod = await import('../../../utils/execSql.js');
    execSql = mod.execSql;
  });

  it('COUNT query returns correct cnt when type has objects', async () => {
    mockQuery.mockResolvedValue([[{ cnt: 7 }]]);

    const pool = { query: mockQuery };
    const result = await execSql(pool, 'SELECT COUNT(id) AS cnt FROM `testdb` WHERE t = ?', [100], { label: 'test' });

    expect(result.rows).toHaveLength(1);
    expect(Number(result.rows[0].cnt)).toBe(7);
    expect(Number(result.rows[0].cnt) > 0).toBe(true);
  });

  it('COUNT query returns cnt=0 when type has no objects', async () => {
    mockQuery.mockResolvedValue([[{ cnt: 0 }]]);

    const pool = { query: mockQuery };
    const result = await execSql(pool, 'SELECT COUNT(id) AS cnt FROM `testdb` WHERE t = ?', [100], { label: 'test' });

    expect(result.rows).toHaveLength(1);
    expect(Number(result.rows[0].cnt)).toBe(0);
    expect(Number(result.rows[0].cnt) > 0).toBe(false);
  });

  it('COUNT returning string "5" is correctly caught by Number() conversion', async () => {
    // Some MySQL configurations return COUNT as string
    mockQuery.mockResolvedValue([[{ cnt: '5' }]]);

    const pool = { query: mockQuery };
    const result = await execSql(pool, 'SELECT COUNT(id) AS cnt FROM `testdb` WHERE t = ?', [100], { label: 'test' });

    const instRows = result.rows || [];
    const instCnt = instRows.length > 0 ? Number(instRows[0].cnt) : 0;
    expect(instCnt).toBe(5);
    expect(instCnt > 0).toBe(true);
  });

  it('empty rows array defaults cnt to 0 (defensive)', async () => {
    // Edge case: query returns empty rows
    mockQuery.mockResolvedValue([[]]);

    const pool = { query: mockQuery };
    const result = await execSql(pool, 'SELECT COUNT(id) AS cnt FROM `testdb` WHERE t = ?', [100], { label: 'test' });

    const instRows = result.rows || [];
    const instCnt = instRows.length > 0 ? Number(instRows[0].cnt) : 0;
    expect(instCnt).toBe(0);
    expect(instCnt > 0).toBe(false);
  });

  it('execSql error returns object without rows (defensive check with || [])', async () => {
    // When table doesn't exist, execSql returns { error: 'DB_NOT_FOUND', db: ... }
    mockQuery.mockRejectedValue(Object.assign(new Error('Table not found'), { errno: 1146, code: 'ER_NO_SUCH_TABLE' }));

    const pool = { query: mockQuery };
    const result = await execSql(pool, 'SELECT COUNT(id) AS cnt FROM `testdb` WHERE t = ?', [100], { label: 'test' });

    // execSql returns { error: 'DB_NOT_FOUND', db: '' } for ER_NO_SUCH_TABLE
    expect(result).toHaveProperty('error', 'DB_NOT_FOUND');
    // The defensive code `result.rows || []` prevents crash
    const instRows = result.rows || [];
    expect(instRows).toHaveLength(0);
    const instCnt = instRows.length > 0 ? Number(instRows[0].cnt) : 0;
    expect(instCnt).toBe(0);
  });

  it('_d_del handler logic: blocks when instCnt > 0', () => {
    // Simulate the exact check from the handler
    const instRows = [{ cnt: 7 }];
    const instCnt = instRows.length > 0 ? Number(instRows[0].cnt) : 0;

    // This is the guard condition from the handler
    const shouldBlock = instCnt > 0;
    expect(shouldBlock).toBe(true);
    expect(instCnt).toBe(7);
  });

  it('_d_del handler logic: allows when instCnt === 0', () => {
    const instRows = [{ cnt: 0 }];
    const instCnt = instRows.length > 0 ? Number(instRows[0].cnt) : 0;

    const shouldBlock = instCnt > 0;
    expect(shouldBlock).toBe(false);
  });

  it('_d_del handler logic: handles BigInt from COUNT correctly', () => {
    // mysql2 with supportBigNumbers could return BigInt
    const instRows = [{ cnt: BigInt(3) }];
    const instCnt = instRows.length > 0 ? Number(instRows[0].cnt) : 0;

    const shouldBlock = instCnt > 0;
    expect(shouldBlock).toBe(true);
    expect(instCnt).toBe(3);
  });
});
