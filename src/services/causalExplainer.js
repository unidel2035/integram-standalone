/**
 * Causal Explainer — build a causal explanation chain for any entity state field.
 * Issue #183
 *
 * All functions are pure — no store imports, no side effects.
 * Pass all data as arguments.
 */

import { getUpstream }  from './crossEntityReactor.js'
import { getEventDef }  from '../config/eventRegistry.js'

// ─── Field → event-type mapping ───────────────────────────────────────────────
// Describes which event types "set" a given logical field per entity type.

const FIELD_EVENTS = {
  deal: {
    phase:   ['DEAL_SOURCED', 'TERM_SHEET_PROPOSED', 'TERM_SHEET_SIGNED',
              'DUE_DILIGENCE_STARTED', 'DD_COMPLETED', 'DEAL_CLOSED',
              'TRANCHE_RELEASED'],
  },
  company: {
    risk:    ['RISK_ELEVATED'],
    lastKpi: ['KPI_UPDATED'],
  },
  session: {
    decision: ['DECISION_MADE'],
  },
  fund: {
    nav: ['NAV_UPDATED'],
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find the last event in a timeline that matches any of the given types,
 * optionally considering only events up to maxTs.
 */
function lastEventOfTypes(timeline, types, maxTs = Infinity) {
  return [...timeline]
    .filter(e => types.includes(e.type) && e.ts <= maxTs)
    .sort((a, b) => b.ts - a.ts)[0] ?? null
}

/**
 * Format a timestamp as a YYYY-MM-DD date string.
 */
function fmtDate(ts) {
  return new Date(ts).toISOString().slice(0, 10)
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Explain why a specific field has its current value by tracing the causal chain.
 *
 * @param {string} entityType
 * @param {string} entityId
 * @param {string} field        - logical field name (e.g. 'phase', 'risk', 'nav')
 * @param {Array}  timeline     - events for this entity: [{ type, ts, data? }]
 * @param {Object} crossTimelines - all timelines keyed by "entityType:entityId"
 * @param {number} [depth=3]   - max recursion depth for upstream chain
 * @returns {Object|null} ExplanationNode or null
 */
export function explainField(
  entityType,
  entityId,
  field,
  timeline,
  crossTimelines,
  depth = 3
) {
  const candidateTypes = FIELD_EVENTS[entityType]?.[field]
  if (!candidateTypes || candidateTypes.length === 0) return null

  const event = lastEventOfTypes(timeline, candidateTypes)
  if (!event) return null

  const def = getEventDef(event.type) ?? {}

  let upstream = []
  if (depth > 0) {
    const upstreamLinks = getUpstream(entityType, event.type)
    for (const link of upstreamLinks) {
      const upKey      = `${link.trigger.entityType}:${link.trigger.entityId ?? '*'}`
      // Try to find the triggering entity timeline — scan crossTimelines for a match
      const matchedKey = Object.keys(crossTimelines).find(k => {
        const colonIdx = k.indexOf(':')
        return colonIdx !== -1 && k.slice(0, colonIdx) === link.trigger.entityType
      })
      if (!matchedKey) continue

      const upTimeline = crossTimelines[matchedKey]
      const colonIdx   = matchedKey.indexOf(':')
      const upEntityId = matchedKey.slice(colonIdx + 1)

      // Recurse: explain the trigger event as a field on the upstream entity
      const upNode = explainField(
        link.trigger.entityType,
        upEntityId,
        _eventToFieldHint(link.trigger.eventType, link.trigger.entityType),
        upTimeline,
        crossTimelines,
        depth - 1
      )

      if (upNode) upstream.push(upNode)
      else {
        // Build a leaf node for the trigger event even without a field mapping
        const upEvent = lastEventOfTypes(upTimeline, [link.trigger.eventType])
        if (upEvent) {
          const upDef = getEventDef(upEvent.type) ?? {}
          upstream.push({
            eventType:  upEvent.type,
            eventTs:    upEvent.ts,
            entityType: link.trigger.entityType,
            entityId:   upEntityId,
            label:      upDef.label  ?? upEvent.type,
            color:      upDef.color  ?? '#64748b',
            icon:       upDef.icon   ?? 'pi pi-circle',
            upstream:   [],
          })
        }
      }
    }
  }

  return {
    eventType:  event.type,
    eventTs:    event.ts,
    entityType,
    entityId,
    label:      def.label  ?? event.type,
    color:      def.color  ?? '#64748b',
    icon:       def.icon   ?? 'pi pi-circle',
    upstream,
  }
}

/**
 * Explain the key state fields for an entity based on its type.
 *
 * @param {string} entityType
 * @param {string} entityId
 * @param {Array}  timeline
 * @param {Object} crossTimelines
 * @returns {Array} ExplanationNode[]
 */
export function explainState(entityType, entityId, timeline, crossTimelines) {
  const keyFields = {
    deal:    ['phase'],
    company: ['risk', 'lastKpi'],
    session: ['decision'],
    fund:    ['nav'],
  }

  const fields = keyFields[entityType] ?? []
  const nodes  = []

  for (const field of fields) {
    const node = explainField(entityType, entityId, field, timeline, crossTimelines, 3)
    if (node) nodes.push(node)
  }

  return nodes
}

/**
 * Format an ExplanationNode chain as a human-readable string (for debug / AI prompt).
 *
 * @param {Object} node   - ExplanationNode
 * @param {number} [indent=0]
 * @returns {string}
 */
export function formatChain(node, indent = 0) {
  if (!node) return ''

  const prefix = '  '.repeat(indent)
  const arrow  = indent === 0 ? '' : '← '
  const date   = fmtDate(node.eventTs)
  let out      = `${prefix}${arrow}${node.eventType} (${node.entityType}:${node.entityId}, ${date})`

  if (node.label && node.label !== node.eventType) {
    out += ` — ${node.label}`
  }

  if (Array.isArray(node.upstream) && node.upstream.length > 0) {
    for (const up of node.upstream) {
      out += '\n' + formatChain(up, indent + 1)
    }
  }

  return out
}

// ─── Internal helper ──────────────────────────────────────────────────────────

/**
 * Map an event type back to the most relevant field hint for a given entity.
 * Used when recursing upstream to pick the right field to explain.
 */
function _eventToFieldHint(eventType, entityType) {
  const fieldMap = FIELD_EVENTS[entityType] ?? {}
  for (const [field, types] of Object.entries(fieldMap)) {
    if (types.includes(eventType)) return field
  }
  // Fallback: use any first field for this entity, or a generic sentinel
  return Object.keys(fieldMap)[0] ?? '__any__'
}
