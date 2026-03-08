/**
 * Unit Tests for IRR estimation functions (Issue #151, #152)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock import.meta.env before importing modules
vi.stubGlobal('import', { meta: { env: { VITE_FST_DB: 'fst-test', VITE_FST_SERVER: 'https://test.example.com' } } })

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn())

import { estimateIRR } from '../fstApi'
import { estimateIRRFromExtended } from '../fstExtendedApi'

describe('estimateIRR (fstApi.js — Issue #151)', () => {
  it('returns different IRR for different stages', () => {
    const preSeed = estimateIRR({ stage: 'Pre-Seed', tam: 10, trl: 5 })
    const seed = estimateIRR({ stage: 'Seed', tam: 10, trl: 5 })
    const roundA = estimateIRR({ stage: 'Round A', tam: 10, trl: 5 })
    const roundB = estimateIRR({ stage: 'Round B', tam: 10, trl: 5 })

    expect(preSeed).toBeGreaterThan(seed)
    expect(seed).toBeGreaterThan(roundA)
    expect(roundA).toBeGreaterThan(roundB)
  })

  it('Pre-Seed base IRR is ~0.55', () => {
    const irr = estimateIRR({ stage: 'Pre-Seed', tam: 10, trl: 5 })
    expect(irr).toBe(0.55)
  })

  it('Seed base IRR is ~0.40', () => {
    const irr = estimateIRR({ stage: 'Seed', tam: 10, trl: 5 })
    expect(irr).toBe(0.40)
  })

  it('Round A base IRR is ~0.30', () => {
    const irr = estimateIRR({ stage: 'Round A', tam: 10, trl: 5 })
    expect(irr).toBe(0.30)
  })

  it('large TAM (>=50B) increases IRR by 0.05', () => {
    const base = estimateIRR({ stage: 'Seed', tam: 10, trl: 5 })
    const largeTam = estimateIRR({ stage: 'Seed', tam: 60, trl: 5 })
    expect(largeTam - base).toBeCloseTo(0.05, 2)
  })

  it('small TAM (<5B) decreases IRR by 0.03', () => {
    const base = estimateIRR({ stage: 'Seed', tam: 10, trl: 5 })
    const smallTam = estimateIRR({ stage: 'Seed', tam: 3, trl: 5 })
    expect(base - smallTam).toBeCloseTo(0.03, 2)
  })

  it('high TRL (>=7) decreases IRR by 0.04', () => {
    const base = estimateIRR({ stage: 'Seed', tam: 10, trl: 5 })
    const highTrl = estimateIRR({ stage: 'Seed', tam: 10, trl: 8 })
    expect(base - highTrl).toBeCloseTo(0.04, 2)
  })

  it('low TRL (<=3) increases IRR by 0.05', () => {
    const base = estimateIRR({ stage: 'Seed', tam: 10, trl: 5 })
    const lowTrl = estimateIRR({ stage: 'Seed', tam: 10, trl: 2 })
    expect(lowTrl - base).toBeCloseTo(0.05, 2)
  })

  it('clamps to minimum 0.12', () => {
    // Round C (0.18) + high TRL (-0.04) + small TAM (-0.03) = 0.11 → clamped to 0.12
    const irr = estimateIRR({ stage: 'Round C', tam: 3, trl: 8 })
    expect(irr).toBe(0.12)
  })

  it('clamps to maximum 0.65', () => {
    // Pre-Seed (0.55) + large TAM (+0.05) + low TRL (+0.05) = 0.65
    const irr = estimateIRR({ stage: 'Pre-Seed', tam: 100, trl: 2 })
    expect(irr).toBe(0.65)
  })

  it('handles empty/missing fields gracefully', () => {
    const irr = estimateIRR({})
    expect(irr).toBeGreaterThanOrEqual(0.12)
    expect(irr).toBeLessThanOrEqual(0.65)
    expect(typeof irr).toBe('number')
  })

  it('never returns 0.25 for different inputs', () => {
    const inputs = [
      { stage: 'Pre-Seed', tam: 50, trl: 3 },
      { stage: 'Seed', tam: 20, trl: 5 },
      { stage: 'Round A', tam: 8, trl: 7 },
      { stage: 'Round B', tam: 100, trl: 4 },
    ]
    const results = inputs.map(estimateIRR)
    const unique = new Set(results)
    // All should be different from each other
    expect(unique.size).toBe(inputs.length)
  })
})

describe('estimateIRRFromExtended (fstExtendedApi.js — Issue #151)', () => {
  it('high market/amount ratio (>200) gives ~0.45 IRR', () => {
    const irr = estimateIRRFromExtended(
      { trl: 5, marketSize: 30_000_000_000 },
      { amount: 100_000_000 }
    )
    // ratio = 300 → 0.45
    expect(irr).toBe(0.45)
  })

  it('medium market/amount ratio (100-200) gives ~0.35 IRR', () => {
    const irr = estimateIRRFromExtended(
      { trl: 5, marketSize: 15_000_000_000 },
      { amount: 100_000_000 }
    )
    // ratio = 150 → 0.35
    expect(irr).toBe(0.35)
  })

  it('low market/amount ratio (50-100) gives ~0.28 IRR', () => {
    const irr = estimateIRRFromExtended(
      { trl: 5, marketSize: 7_000_000_000 },
      { amount: 100_000_000 }
    )
    // ratio = 70 → 0.28
    expect(irr).toBe(0.28)
  })

  it('very low market/amount ratio (<50) gives ~0.20 IRR', () => {
    const irr = estimateIRRFromExtended(
      { trl: 5, marketSize: 3_000_000_000 },
      { amount: 100_000_000 }
    )
    // ratio = 30 → 0.20
    expect(irr).toBe(0.20)
  })

  it('high TRL (>=7) reduces IRR by 0.04', () => {
    const base = estimateIRRFromExtended(
      { trl: 5, marketSize: 30_000_000_000 },
      { amount: 100_000_000 }
    )
    const highTrl = estimateIRRFromExtended(
      { trl: 8, marketSize: 30_000_000_000 },
      { amount: 100_000_000 }
    )
    expect(base - highTrl).toBeCloseTo(0.04, 2)
  })

  it('low TRL (<=3) increases IRR by 0.06', () => {
    const base = estimateIRRFromExtended(
      { trl: 5, marketSize: 30_000_000_000 },
      { amount: 100_000_000 }
    )
    const lowTrl = estimateIRRFromExtended(
      { trl: 2, marketSize: 30_000_000_000 },
      { amount: 100_000_000 }
    )
    expect(lowTrl - base).toBeCloseTo(0.06, 2)
  })

  it('handles missing fields with defaults', () => {
    const irr = estimateIRRFromExtended({}, {})
    expect(irr).toBeGreaterThanOrEqual(0.12)
    expect(irr).toBeLessThanOrEqual(0.65)
  })

  it('clamps result to [0.12, 0.65]', () => {
    // Low ratio (0.20) - high TRL (0.04) = 0.16 — within range
    const irr = estimateIRRFromExtended(
      { trl: 9, marketSize: 1_000_000_000 },
      { amount: 100_000_000 }
    )
    expect(irr).toBeGreaterThanOrEqual(0.12)
    expect(irr).toBeLessThanOrEqual(0.65)
  })

  it('different projects get different IRRs', () => {
    const irr1 = estimateIRRFromExtended(
      { trl: 3, marketSize: 50_000_000_000 },
      { amount: 50_000_000 }
    )
    const irr2 = estimateIRRFromExtended(
      { trl: 8, marketSize: 2_000_000_000 },
      { amount: 200_000_000 }
    )
    expect(irr1).not.toBe(irr2)
  })
})
