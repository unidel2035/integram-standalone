/**
 * Unit tests for financial calculation functions
 *
 * Tests NPV, IRR, DPP, MIRR, PI calculations with known values
 */

import { describe, it, expect } from 'vitest'
import {
  calcNpv,
  calcIrr,
  calcDpp,
  calcMirr,
  calcPi,
  npvProfile
} from '../src/utils/financialCalculations.js'

describe('Financial Calculations — NPV (Net Present Value)', () => {
  it('calculates NPV for positive cash flows', () => {
    const cashflows = [100, 100, 100]
    const ic = 250
    const r = 0.10  // 10% discount rate

    const npv = calcNpv(cashflows, ic, r)

    // Expected: -250 + 100/1.1 + 100/1.21 + 100/1.331
    // = -250 + 90.91 + 82.64 + 75.13 = -1.32
    expect(npv).toBeCloseTo(-1.32, 1)
  })

  it('calculates NPV for profitable project', () => {
    const cashflows = [150, 150, 150]
    const ic = 250
    const r = 0.10

    const npv = calcNpv(cashflows, ic, r)

    // Expected: -250 + 150/1.1 + 150/1.21 + 150/1.331
    // = -250 + 136.36 + 123.97 + 112.70 = 123.03
    expect(npv).toBeGreaterThan(0)
    expect(npv).toBeCloseTo(123.03, 1)
  })

  it('returns negative NPV for unprofitable project', () => {
    const cashflows = [10, 10, 10]
    const ic = 100
    const r = 0.10

    const npv = calcNpv(cashflows, ic, r)

    expect(npv).toBeLessThan(0)
  })

  it('handles zero discount rate (simple sum)', () => {
    const cashflows = [100, 100, 100]
    const ic = 250
    const r = 0  // No discounting

    const npv = calcNpv(cashflows, ic, r)

    // -250 + 100 + 100 + 100 = 50
    expect(npv).toBe(50)
  })

  it('handles high discount rate', () => {
    const cashflows = [100, 100, 100]
    const ic = 200
    const r = 0.50  // 50% discount rate

    const npv = calcNpv(cashflows, ic, r)

    // -200 + 100/1.5 + 100/2.25 + 100/3.375
    // = -200 + 66.67 + 44.44 + 29.63 = -59.26
    expect(npv).toBeLessThan(0)
    expect(npv).toBeCloseTo(-59.26, 1)
  })

  it('handles empty cash flows', () => {
    const cashflows = []
    const ic = 100
    const r = 0.10

    const npv = calcNpv(cashflows, ic, r)

    expect(npv).toBe(-100)  // Just the initial investment
  })
})

describe('Financial Calculations — IRR (Internal Rate of Return)', () => {
  it('calculates IRR for standard project', () => {
    const cashflows = [100, 100, 100]
    const ic = 200

    const irr = calcIrr(cashflows, ic)

    // At IRR, NPV = 0
    const npvAtIrr = calcNpv(cashflows, ic, irr)
    expect(npvAtIrr).toBeCloseTo(0, 3)

    // Expected IRR ~23.4% for this project
    expect(irr).toBeGreaterThan(0.20)
    expect(irr).toBeLessThan(0.30)
  })

  it('calculates IRR for high-return project', () => {
    const cashflows = [200, 200, 200]
    const ic = 100

    const irr = calcIrr(cashflows, ic)

    expect(irr).toBeGreaterThan(1.0)  // >100% return
    const npvAtIrr = calcNpv(cashflows, ic, irr)
    expect(npvAtIrr).toBeCloseTo(0, 3)
  })

  it('calculates IRR for marginal project', () => {
    const cashflows = [50, 50, 50]
    const ic = 140

    const irr = calcIrr(cashflows, ic)

    expect(irr).toBeGreaterThan(0.05)
    expect(irr).toBeLessThan(0.10)
    const npvAtIrr = calcNpv(cashflows, ic, irr)
    expect(npvAtIrr).toBeCloseTo(0, 2)
  })

  it('handles exact known IRR case', () => {
    // If CF = [110], IC = 100, IRR should be exactly 10%
    const cashflows = [110]
    const ic = 100

    const irr = calcIrr(cashflows, ic)

    expect(irr).toBeCloseTo(0.10, 3)
  })

  it('converges with custom tolerance', () => {
    const cashflows = [100, 100, 100]
    const ic = 200
    const tol = 1e-8

    const irr = calcIrr(cashflows, ic, tol)

    const npvAtIrr = calcNpv(cashflows, ic, irr)
    expect(Math.abs(npvAtIrr)).toBeLessThan(tol * 10)
  })

  it('does not exceed max iterations', () => {
    const cashflows = [100, 100, 100]
    const ic = 200
    const maxIter = 10

    const irr = calcIrr(cashflows, ic, 1e-6, maxIter)

    // Should return some value even with low iterations
    expect(typeof irr).toBe('number')
  })
})

describe('Financial Calculations — DPP (Discounted Payback Period)', () => {
  it('calculates DPP for project that pays back', () => {
    const cashflows = [100, 100, 100]
    const ic = 200
    const r = 0.10

    const dpp = calcDpp(cashflows, ic, r)

    // After year 3: -200 + 90.91 + 82.64 + 75.13 ≈ 48.68 > 0
    expect(dpp).toBe(3)
  })

  it('calculates DPP for quick payback project', () => {
    const cashflows = [150, 150]
    const ic = 200
    const r = 0.10

    const dpp = calcDpp(cashflows, ic, r)

    // After year 2: -200 + 136.36 + 123.97 = 60.33 > 0
    expect(dpp).toBe(2)
  })

  it('calculates DPP for first-year payback', () => {
    const cashflows = [250]
    const ic = 200
    const r = 0.10

    const dpp = calcDpp(cashflows, ic, r)

    // After year 1: -200 + 227.27 > 0
    expect(dpp).toBe(1)
  })

  it('returns null for project that never pays back', () => {
    const cashflows = [10, 10, 10]
    const ic = 200
    const r = 0.10

    const dpp = calcDpp(cashflows, ic, r)

    expect(dpp).toBeNull()
  })

  it('handles zero discount rate', () => {
    const cashflows = [50, 50, 50, 50]
    const ic = 150
    const r = 0

    const dpp = calcDpp(cashflows, ic, r)

    // Undiscounted: year 3 → -150 + 50 + 50 + 50 = 0
    expect(dpp).toBe(3)
  })
})

describe('Financial Calculations — MIRR (Modified Internal Rate of Return)', () => {
  it('calculates MIRR for standard project', () => {
    const cashflows = [100, 100, 100]
    const ic = 200
    const r = 0.10
    const reinvestRate = 0.10

    const mirr = calcMirr(cashflows, ic, r, reinvestRate)

    expect(mirr).toBeGreaterThan(0)
    expect(mirr).toBeLessThan(1.0)
    expect(typeof mirr).toBe('number')
  })

  it('calculates MIRR with different reinvestment rate', () => {
    const cashflows = [100, 100, 100]
    const ic = 200
    const r = 0.10
    const reinvestRate = 0.15  // Higher reinvestment rate

    const mirr = calcMirr(cashflows, ic, r, reinvestRate)

    expect(mirr).toBeGreaterThan(0)
  })

  it('returns null for negative future value', () => {
    const cashflows = [-10, -10, -10]  // All negative cash flows
    const ic = 100
    const r = 0.10
    const reinvestRate = 0.10

    const mirr = calcMirr(cashflows, ic, r, reinvestRate)

    expect(mirr).toBeNull()
  })

  it('calculates MIRR for high-return project', () => {
    const cashflows = [200, 200, 200]
    const ic = 100
    const r = 0.10
    const reinvestRate = 0.10

    const mirr = calcMirr(cashflows, ic, r, reinvestRate)

    expect(mirr).toBeGreaterThan(0.5)  // High return
  })
})

describe('Financial Calculations — PI (Profitability Index)', () => {
  it('calculates PI for profitable project', () => {
    const npv = 100
    const ic = 200

    const pi = calcPi(npv, ic)

    // PI = (100 + 200) / 200 = 1.5
    expect(pi).toBe(1.5)
  })

  it('calculates PI for break-even project', () => {
    const npv = 0
    const ic = 200

    const pi = calcPi(npv, ic)

    // PI = (0 + 200) / 200 = 1.0
    expect(pi).toBe(1.0)
  })

  it('calculates PI for unprofitable project', () => {
    const npv = -50
    const ic = 200

    const pi = calcPi(npv, ic)

    // PI = (-50 + 200) / 200 = 0.75
    expect(pi).toBe(0.75)
    expect(pi).toBeLessThan(1.0)
  })

  it('PI > 1 indicates positive NPV', () => {
    const npv = 50
    const ic = 100

    const pi = calcPi(npv, ic)

    expect(pi).toBeGreaterThan(1.0)
  })

  it('PI < 1 indicates negative NPV', () => {
    const npv = -30
    const ic = 100

    const pi = calcPi(npv, ic)

    expect(pi).toBeLessThan(1.0)
  })
})

describe('Financial Calculations — NPV Profile', () => {
  it('generates cumulative NPV profile', () => {
    const cashflows = [100, 100, 100]
    const ic = 200
    const r = 0.10

    const profile = npvProfile(cashflows, ic, r)

    expect(profile).toHaveLength(4)  // t=0 + 3 years
    expect(profile[0]).toBe(-200)     // Initial investment
    expect(profile[1]).toBeCloseTo(-109.09, 1)  // After year 1
    expect(profile[2]).toBeCloseTo(-26.45, 1)   // After year 2
    expect(profile[3]).toBeCloseTo(48.68, 1)    // After year 3
  })

  it('shows cumulative growth over time', () => {
    const cashflows = [150, 150, 150]
    const ic = 200
    const r = 0.10

    const profile = npvProfile(cashflows, ic, r)

    expect(profile[0]).toBe(-200)
    expect(profile[1]).toBeGreaterThan(profile[0])
    expect(profile[2]).toBeGreaterThan(profile[1])
    expect(profile[3]).toBeGreaterThan(profile[2])
  })

  it('identifies break-even point', () => {
    const cashflows = [100, 100, 100]
    const ic = 200
    const r = 0.10

    const profile = npvProfile(cashflows, ic, r)

    // Profile should cross zero between year 2 and 3
    expect(profile[2]).toBeLessThan(0)
    expect(profile[3]).toBeGreaterThan(0)
  })

  it('handles single cash flow', () => {
    const cashflows = [250]
    const ic = 200
    const r = 0.10

    const profile = npvProfile(cashflows, ic, r)

    expect(profile).toHaveLength(2)
    expect(profile[0]).toBe(-200)
    expect(profile[1]).toBeGreaterThan(0)
  })

  it('handles empty cash flows', () => {
    const cashflows = []
    const ic = 100
    const r = 0.10

    const profile = npvProfile(cashflows, ic, r)

    expect(profile).toEqual([-100])
  })
})

describe('Financial Calculations — Integration Tests', () => {
  it('NPV and IRR relationship: NPV at IRR should be zero', () => {
    const cashflows = [80, 90, 100]
    const ic = 200

    const irr = calcIrr(cashflows, ic)
    const npvAtIrr = calcNpv(cashflows, ic, irr)

    expect(npvAtIrr).toBeCloseTo(0, 3)
  })

  it('DPP <= project horizon for profitable projects', () => {
    const cashflows = [100, 100, 100, 100]
    const ic = 250
    const r = 0.10

    const dpp = calcDpp(cashflows, ic, r)
    const npv = calcNpv(cashflows, ic, r)

    if (npv > 0) {
      expect(dpp).not.toBeNull()
      expect(dpp).toBeLessThanOrEqual(cashflows.length)
    }
  })

  it('PI and NPV relationship: PI > 1 iff NPV > 0', () => {
    const cashflows = [150, 150, 150]
    const ic = 200
    const r = 0.10

    const npv = calcNpv(cashflows, ic, r)
    const pi = calcPi(npv, ic)

    if (npv > 0) {
      expect(pi).toBeGreaterThan(1.0)
    } else if (npv < 0) {
      expect(pi).toBeLessThan(1.0)
    } else {
      expect(pi).toBeCloseTo(1.0, 3)
    }
  })

  it('known FST project case: БПЛА with high IRR', () => {
    // Investment: 100M RUB
    // Cash flows: 20M, 40M, 60M, 80M, 100M over 5 years
    const cashflows = [20, 40, 60, 80, 100]
    const ic = 100
    const r = 0.18  // WACC 18%

    const npv = calcNpv(cashflows, ic, r)
    const irr = calcIrr(cashflows, ic)
    const dpp = calcDpp(cashflows, ic, r)
    const pi = calcPi(npv, ic)

    expect(npv).toBeGreaterThan(0)  // Profitable project
    expect(irr).toBeGreaterThan(0.18)  // IRR > WACC
    expect(dpp).not.toBeNull()  // Pays back within horizon
    expect(pi).toBeGreaterThan(1.0)  // PI > 1
  })
})
