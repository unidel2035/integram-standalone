/**
 * Portfolio Health — health score 0-100 for a company based on its event history.
 * Issue #183
 */

const MS_PER_DAY = 86_400_000

/**
 * Compute a health score 0-100 for a company given its event timeline.
 *
 * Scoring formula:
 *   Start at 50
 *   +15 if has COMPANY_ADDED event
 *   +10 if KPI_UPDATED within last 30 days
 *   +10 if REVENUE_MILESTONE within last 90 days
 *   +10 if ROUND_OPENED in timeline
 *   -20 if RISK_ELEVATED without subsequent KPI_UPDATED
 *   -10 for each 30 days since last event (max -30)
 *   -25 if last event was more than 90 days ago
 *   Clamp to [0, 100]
 *
 * @param {Array}  timeline - array of { type, ts, data? }
 * @param {number} [nowMs]
 * @returns {number} score 0-100
 */
export function companyHealthScore(timeline, nowMs = Date.now()) {
  if (!Array.isArray(timeline) || timeline.length === 0) return 0

  let score = 50

  const hasEvent = type => timeline.some(e => e.type === type)

  // +15 if company has been added to portfolio
  if (hasEvent('COMPANY_ADDED')) score += 15

  // +10 if KPI updated within last 30 days
  const kpiRecent = timeline.some(
    e => e.type === 'KPI_UPDATED' && (nowMs - e.ts) <= 30 * MS_PER_DAY
  )
  if (kpiRecent) score += 10

  // +10 if revenue milestone within last 90 days
  const revenueRecent = timeline.some(
    e => e.type === 'REVENUE_MILESTONE' && (nowMs - e.ts) <= 90 * MS_PER_DAY
  )
  if (revenueRecent) score += 10

  // +10 if round opened
  if (hasEvent('ROUND_OPENED')) score += 10

  // -20 if RISK_ELEVATED without a subsequent KPI_UPDATED
  const riskEvents = timeline
    .filter(e => e.type === 'RISK_ELEVATED')
    .sort((a, b) => b.ts - a.ts)

  if (riskEvents.length > 0) {
    const lastRisk = riskEvents[0]
    const kpiAfterRisk = timeline.some(
      e => e.type === 'KPI_UPDATED' && e.ts > lastRisk.ts
    )
    if (!kpiAfterRisk) score -= 20
  }

  // -10 per 30 days since last event, max -30
  const lastEventTs = Math.max(...timeline.map(e => e.ts))
  const daysSinceLast = (nowMs - lastEventTs) / MS_PER_DAY
  const stalePenalty = Math.min(30, Math.floor(daysSinceLast / 30) * 10)
  score -= stalePenalty

  // -25 if last event was more than 90 days ago
  if (daysSinceLast > 90) score -= 25

  return Math.max(0, Math.min(100, score))
}

/**
 * Map a health score to a colour for UI display.
 *
 * @param {number} score
 * @returns {'#22c55e'|'#f59e0b'|'#ef4444'}
 */
export function healthToColor(score) {
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

/**
 * Map a health score to a PrimeVue severity string.
 *
 * @param {number} score
 * @returns {'success'|'warn'|'danger'}
 */
export function healthToSeverity(score) {
  if (score >= 70) return 'success'
  if (score >= 40) return 'warn'
  return 'danger'
}

/**
 * Return daily score snapshots over the last nDays (for sparkline charts).
 *
 * @param {Array}  timeline - array of { type, ts, data? }
 * @param {number} nDays    - how many days of history to compute
 * @param {number} [nowMs]
 * @returns {Array} Array of { date: string, score: number } ordered oldest→newest
 */
export function companyHealthHistory(timeline, nDays, nowMs = Date.now()) {
  const result = []

  for (let i = nDays - 1; i >= 0; i--) {
    const dayEndTs = nowMs - i * MS_PER_DAY
    const dayDate  = new Date(dayEndTs)
    const dateStr  = dayDate.toISOString().slice(0, 10)

    const slice = timeline.filter(e => e.ts <= dayEndTs)
    const score = companyHealthScore(slice, dayEndTs)

    result.push({ date: dateStr, score })
  }

  return result
}
