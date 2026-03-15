/**
 * Regression tests for parseIdParam (#448)
 *
 * Validates that NaN is never passed to SQL queries by ensuring
 * parseIdParam returns NaN for invalid inputs, which route handlers
 * must check before proceeding.
 */

import { describe, it, expect, vi } from 'vitest';

// ─── mock mysql2/promise ─────────────────────────────────────────────────────
vi.mock('mysql2/promise', () => ({
  default: {
    createPool: vi.fn(() => ({
      query: vi.fn(async () => [[], []]),
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
const { parseIdParam } = await import('../legacy-compat.js');

describe('parseIdParam (#448 — NaN in SQL queries)', () => {
  it('parses valid integer strings', () => {
    expect(parseIdParam('42')).toBe(42);
    expect(parseIdParam('1')).toBe(1);
    expect(parseIdParam('0')).toBe(0);
    expect(parseIdParam('999999')).toBe(999999);
  });

  it('parses negative integers', () => {
    expect(parseIdParam('-1')).toBe(-1);
    expect(parseIdParam('-100')).toBe(-100);
  });

  it('parses strings with trailing non-numeric chars (parseInt behavior)', () => {
    // parseInt('42abc') => 42 — this is acceptable
    expect(parseIdParam('42abc')).toBe(42);
  });

  it('returns NaN for completely non-numeric strings', () => {
    expect(isNaN(parseIdParam('abc'))).toBe(true);
    expect(isNaN(parseIdParam(''))).toBe(true);
    expect(isNaN(parseIdParam('NaN'))).toBe(true);
  });

  it('returns NaN for undefined and null', () => {
    expect(isNaN(parseIdParam(undefined))).toBe(true);
    expect(isNaN(parseIdParam(null))).toBe(true);
  });

  it('handles numeric inputs (not just strings)', () => {
    expect(parseIdParam(42)).toBe(42);
    expect(parseIdParam(0)).toBe(0);
  });

  it('returns NaN for NaN input', () => {
    expect(isNaN(parseIdParam(NaN))).toBe(true);
  });

  it('returns NaN for object/array inputs', () => {
    expect(isNaN(parseIdParam({}))).toBe(true);
    expect(isNaN(parseIdParam([]))).toBe(true);
  });
});
