/**
 * Platform Gap Detector — temporal gap alerts across all entities
 * Issue #183
 */

// Thresholds: days without expected next event before it's a gap
const THRESHOLDS = {
  lead:    { SCORING_DONE: 7, SENT_TO_IC: 14 },
  session: { SESSION_STARTED: 14, DECISION_MADE: 30 },
  deal:    { TERM_SHEET_PROPOSED: 21, DD_COMPLETED: 45, DEAL_CLOSED: 60 },
  company: { COMPANY_ADDED: 30, KPI_UPDATED: 30, REVENUE_MILESTONE: 90 },
  fund:    { CAPITAL_CALLED: 60 },
}

// expectedNext: what event should follow, per current last event type
const EXPECTED_NEXT = {
  SCORING_DONE:        { next: 'SENT_TO_IC',         entityType: 'lead' },
  SESSION_STARTED:     { next: 'DECISION_MADE',       entityType: 'session' },
  TERM_SHEET_PROPOSED: { next: 'TERM_SHEET_SIGNED',   entityType: 'deal' },
  DD_COMPLETED:        { next: 'DEAL_CLOSED',         entityType: 'deal' },
  COMPANY_ADDED:       { next: 'KPI_UPDATED',         entityType: 'company' },
  KPI_UPDATED:         { next: 'KPI_UPDATED',         entityType: 'company' },
  CAPITAL_CALLED:      { next: 'NAV_UPDATED',         entityType: 'fund' },
}

const MS_PER_DAY = 86_400_000

export const gapSeverityOrder = { critical: 0, high: 1, medium: 2 }

/**
 * Calculate severity based on how overdue the gap is.
 *
 * @param {number} daysSince
 * @param {number} thresholdDays
 * @returns {'critical'|'high'|'medium'}
 */
function calcSeverity(daysSince, thresholdDays) {
  if (daysSince > thresholdDays * 2)   return 'critical'
  if (daysSince > thresholdDays * 1.5) return 'high'
  return 'medium'
}

/**
 * Detect a temporal gap for a single entity timeline.
 *
 * @param {string}   entityType - 'lead' | 'session' | 'deal' | 'company' | 'fund'
 * @param {string}   entityId
 * @param {Array}    timeline   - array of event objects, each with { type, ts, data? }
 * @param {number}   [nowMs]    - timestamp to use as "now" (defaults to Date.now())
 * @returns {Object|null} GapAlert or null
 */
export function detectEntityGap(entityType, entityId, timeline, nowMs = Date.now()) {
  if (!Array.isArray(timeline) || timeline.length === 0) return null

  const entityThresholds = THRESHOLDS[entityType]
  if (!entityThresholds) return null

  // Sort ascending to find the actual last event
  const sorted = [...timeline].sort((a, b) => a.ts - b.ts)
  const lastEvent = sorted[sorted.length - 1]
  const lastEventType = lastEvent.type

  // Is there a threshold defined for this last event type?
  const thresholdDays = entityThresholds[lastEventType]
  if (thresholdDays == null) return null

  // Has the expected next event already occurred?
  const expectedNextDef = EXPECTED_NEXT[lastEventType]
  if (expectedNextDef) {
    const alreadyHappened = timeline.some(e => e.type === expectedNextDef.next)
    if (alreadyHappened) return null
  }

  const daysSince = (nowMs - lastEvent.ts) / MS_PER_DAY

  if (daysSince <= thresholdDays) return null

  return {
    entityType,
    entityId,
    lastEventType,
    lastEventTs: lastEvent.ts,
    expectedNext: expectedNextDef?.next ?? null,
    daysSince,
    thresholdDays,
    severity: calcSeverity(daysSince, thresholdDays),
  }
}

/**
 * Detect gaps across all entity timelines on the platform.
 *
 * @param {Object} timelines - keyed by "entityType:entityId", value is Event[]
 *   Example: { "lead:lead-001": [...], "deal:deal-7": [...] }
 * @param {number} [nowMs]
 * @returns {Array} GapAlert[] sorted by severity (critical first)
 */
export function detectPlatformGaps(timelines, nowMs = Date.now()) {
  const gaps = []

  for (const [key, timeline] of Object.entries(timelines)) {
    const colonIdx = key.indexOf(':')
    if (colonIdx === -1) continue
    const entityType = key.slice(0, colonIdx)
    const entityId   = key.slice(colonIdx + 1)

    const gap = detectEntityGap(entityType, entityId, timeline, nowMs)
    if (gap) gaps.push(gap)
  }

  return gaps.sort((a, b) => gapSeverityOrder[a.severity] - gapSeverityOrder[b.severity])
}
