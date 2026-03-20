/**
 * GiftEvent — immutable record of a value exchange event
 *
 * Value exchanges are immutable events. Once recorded — forever.
 * Object.freeze guarantees immutability.
 */

// All valid event types — mapped to business/fund terminology
export const EVENT_TYPES = Object.freeze({
  // Value creation
  VALUE_CREATED:         'value:created',
  VALUE_SUSTAINED:       'value:sustained',
  VALUE_ACKNOWLEDGED:    'value:acknowledged',

  // Value exchange lifecycle
  VALUE_OFFERED:         'value:offered',
  VALUE_ACCEPTED:        'value:accepted',
  VALUE_DECLINED:        'value:declined',

  // Risk & recovery
  RISK_RECORDED:         'risk:recorded',
  RECOVERY_COMPLETED:    'recovery:completed',

  // Strategic milestones
  MILESTONE_COMMITMENT:  'milestone:commitment',
  MILESTONE_INVESTMENT:  'milestone:investment',
  MILESTONE_EXIT:        'milestone:exit',
  MILESTONE_GROWTH:      'milestone:growth',
  MILESTONE_SYNERGY:     'milestone:synergy',

  // Beyond measurement
  INCALCULABLE:          'incalculable:recorded',
});

let _seq = 0;

/**
 * Create an immutable GiftEvent.
 *
 * @param {string} type — one of EVENT_TYPES
 * @param {object} data — event payload (giver, receiver, content, etc.)
 * @returns {Readonly<object>} — frozen event
 */
export function createGiftEvent(type, data = {}) {
  const event = Object.freeze({
    _eventType: type,
    _seq: ++_seq,
    _timestamp: new Date().toISOString(),
    // Correlation: link status events to their origin
    _correlationId: data._correlationId || data.id || null,
    ...data,
  });
  return event;
}

export default { EVENT_TYPES, createGiftEvent };
