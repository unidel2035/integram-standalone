/**
 * Financial calculation utilities
 *
 * Pure functions for NPV, IRR, DPP, MIRR, PI calculations
 * Used by FinancialCalculator.vue and can be tested independently
 */

/**
 * Calculate Net Present Value (NPV)
 * @param {number[]} cf - Cash flows array
 * @param {number} ic - Initial investment (capital)
 * @param {number} r - Discount rate (as decimal, e.g., 0.18 for 18%)
 * @returns {number} NPV value
 */
export function calcNpv(cf, ic, r) {
  return cf.reduce((acc, c, t) => acc + c / Math.pow(1 + r, t + 1), -ic)
}

/**
 * Calculate Internal Rate of Return (IRR) using Newton-Raphson method
 * @param {number[]} cf - Cash flows array
 * @param {number} ic - Initial investment
 * @param {number} tol - Tolerance for convergence (default 1e-6)
 * @param {number} maxIter - Maximum iterations (default 200)
 * @returns {number} IRR as decimal (e.g., 0.25 for 25%)
 */
export function calcIrr(cf, ic, tol = 1e-6, maxIter = 200) {
  let r = 0.1  // Initial guess: 10%
  for (let i = 0; i < maxIter; i++) {
    const f  = calcNpv(cf, ic, r)
    const df = cf.reduce((acc, c, t) => acc - (t + 1) * c / Math.pow(1 + r, t + 2), 0)
    if (Math.abs(df) < 1e-12) break
    const rNew = r - f / df
    if (Math.abs(rNew - r) < tol) { r = rNew; break }
    r = rNew
    if (r < -0.99) { r = -0.99; break }
  }
  return r
}

/**
 * Calculate Discounted Payback Period (DPP)
 * @param {number[]} cf - Cash flows array
 * @param {number} ic - Initial investment
 * @param {number} r - Discount rate
 * @returns {number|null} Number of years to payback, or null if never pays back
 */
export function calcDpp(cf, ic, r) {
  let cumulative = -ic
  for (let t = 0; t < cf.length; t++) {
    cumulative += cf[t] / Math.pow(1 + r, t + 1)
    if (cumulative >= 0) return t + 1
  }
  return null
}

/**
 * Calculate Modified Internal Rate of Return (MIRR)
 * @param {number[]} cf - Cash flows array
 * @param {number} ic - Initial investment
 * @param {number} r - Finance rate (cost of capital)
 * @param {number} reinvestRate - Reinvestment rate for positive cash flows
 * @returns {number|null} MIRR as decimal, or null if FV <= 0
 */
export function calcMirr(cf, ic, r, reinvestRate) {
  const n = cf.length
  const fv = cf.reduce((acc, c, t) => acc + c * Math.pow(1 + reinvestRate, n - t - 1), 0)
  if (fv <= 0) return null
  return Math.pow(fv / ic, 1 / n) - 1
}

/**
 * Calculate Profitability Index (PI)
 * @param {number} npv - Net Present Value
 * @param {number} ic - Initial investment
 * @returns {number} PI value (ratio)
 */
export function calcPi(npv, ic) {
  return (npv + ic) / ic
}

/**
 * Calculate cumulative NPV profile over time
 * @param {number[]} cf - Cash flows array
 * @param {number} ic - Initial investment
 * @param {number} r - Discount rate
 * @returns {number[]} Cumulative NPV at each year
 */
export function npvProfile(cf, ic, r) {
  const profile = [-ic]
  let cumNpv = -ic
  for (let t = 0; t < cf.length; t++) {
    cumNpv += cf[t] / Math.pow(1 + r, t + 1)
    profile.push(cumNpv)
  }
  return profile
}
