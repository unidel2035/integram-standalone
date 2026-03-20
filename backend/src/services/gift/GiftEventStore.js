/**
 * GiftEventStore — append-only event store with indices
 *
 * Value exchanges are immutable records. Status changes (accepted/declined)
 * are separate events with correlationId to the original.
 *
 * O(1) access by id, O(k) queries through indices.
 */

class GiftEventStore {
  constructor() {
    this._events = [];              // Append-only
    this._byId = new Map();         // id → event
    this._byGiver = new Map();      // stakeholderId → event[]
    this._byReceiver = new Map();   // stakeholderId → event[]
    this._byTelos = new Map();      // strategicGoal → event[]
    this._byType = new Map();       // type → event[]
    this._byStatus = new Map();     // status → event[]
    this._nextId = 1;

    // Status projections: id → latest status event (for accept/decline)
    this._statusOverrides = new Map(); // exchangeId → { status, acceptedAt, ... }
  }

  /**
   * Monotonic ID counter.
   */
  nextId() {
    return String(this._nextId++);
  }

  /**
   * Set next ID (for restoring from persistence).
   */
  setNextId(n) {
    if (n > this._nextId) this._nextId = n;
  }

  /**
   * Append an event. Immutable once appended.
   * Updates all indices.
   */
  append(event) {
    const frozen = Object.isFrozen(event) ? event : Object.freeze({ ...event });
    this._events.push(frozen);
    this._indexEvent(frozen);

    const num = parseInt(frozen.id);
    if (!isNaN(num) && num >= this._nextId) this._nextId = num + 1;

    return frozen;
  }

  /**
   * Apply a status change (accept/decline) without mutating the original.
   * Creates a projection overlay.
   */
  applyStatusChange(exchangeId, statusData) {
    this._statusOverrides.set(String(exchangeId), Object.freeze({ ...statusData }));
    const original = this._byId.get(String(exchangeId));
    if (original) {
      const oldStatus = original.status;
      const oldList = this._byStatus.get(oldStatus);
      if (oldList) {
        const idx = oldList.indexOf(original);
        if (idx >= 0) oldList.splice(idx, 1);
      }
      this._addToIndex(this._byStatus, statusData.status, original);
    }
  }

  /**
   * Get event by ID. Returns projected view (merged with status override).
   */
  getById(id) {
    const event = this._byId.get(String(id));
    if (!event) return null;
    const override = this._statusOverrides.get(String(id));
    if (override) {
      return Object.freeze({ ...event, ...override });
    }
    return event;
  }

  /**
   * Query events by criteria. Returns projected views.
   *
   * @param {object} criteria — { status, giver, receiver, telos, type, limit }
   * @returns {object[]}
   */
  query({ status, giver, receiver, telos, type, limit, includeDead } = {}) {
    let candidates = null;

    if (type) {
      candidates = this._byType.get(type) || [];
    } else if (giver) {
      candidates = this._byGiver.get(String(giver)) || [];
    } else if (receiver) {
      candidates = this._byReceiver.get(String(receiver)) || [];
    } else if (telos) {
      candidates = this._byTelos.get(telos) || [];
    } else if (status) {
      candidates = this._byStatus.get(status) || [];
    } else {
      candidates = this._events;
    }

    let result = [...candidates];

    if (status && !(!type && !giver && !receiver && !telos)) {
      result = result.filter(e => this._getStatus(e) === status);
    }
    if (giver && candidates !== this._byGiver.get(String(giver))) {
      result = result.filter(e => e.giver === String(giver) || e.giverName === giver);
    }
    if (receiver && candidates !== this._byReceiver.get(String(receiver))) {
      result = result.filter(e => e.receiver === String(receiver) || e.receiverName === receiver);
    }
    if (telos && candidates !== this._byTelos.get(telos)) {
      result = result.filter(e => e.telos === telos);
    }
    if (type && candidates !== this._byType.get(type)) {
      result = result.filter(e => e.ontologicalType === type);
    }

    // Apply projections
    result = result.map(e => {
      const override = this._statusOverrides.get(String(e.id));
      return override ? Object.freeze({ ...e, ...override }) : e;
    });

    // Exclude dead exchanges by default
    if (!includeDead) {
      result = result.filter(e => e.status !== 'dead');
    }

    if (limit) {
      return result.slice(-limit).reverse();
    }
    return result;
  }

  /**
   * Get all events (projected).
   */
  getAll() {
    return this._events.map(e => {
      const override = this._statusOverrides.get(String(e.id));
      return override ? Object.freeze({ ...e, ...override }) : e;
    });
  }

  /**
   * Total count.
   */
  get length() {
    return this._events.length;
  }

  /**
   * Get effective status of an event.
   */
  _getStatus(event) {
    const override = this._statusOverrides.get(String(event.id));
    return override ? override.status : event.status;
  }

  /**
   * Index an event into all relevant maps.
   */
  _indexEvent(event) {
    if (event.id) this._byId.set(String(event.id), event);
    if (event.giver) this._addToIndex(this._byGiver, String(event.giver), event);
    if (event.receiver && event.receiver !== 'all') {
      this._addToIndex(this._byReceiver, String(event.receiver), event);
    }
    if (event.telos) this._addToIndex(this._byTelos, event.telos, event);
    if (event.ontologicalType) this._addToIndex(this._byType, event.ontologicalType, event);
    if (event.status) this._addToIndex(this._byStatus, event.status, event);
  }

  _addToIndex(map, key, event) {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(event);
  }

  /**
   * Mark exchange as dead — transforms into seed for new exchanges.
   * A dead exchange can no longer be accepted/declined but its context memory lives.
   */
  die(exchangeId, reason) {
    const exchange = this.getById(String(exchangeId));
    if (!exchange) return null;

    this.applyStatusChange(String(exchangeId), {
      status: 'dead',
      diedAt: new Date().toISOString(),
      deathReason: reason,
      seed: true,
    });

    return this.getById(String(exchangeId));
  }

  /**
   * Serialization for persistence.
   */
  toJSON() {
    return {
      events: this._events,
      statusOverrides: Object.fromEntries(this._statusOverrides),
      nextId: this._nextId,
    };
  }

  /**
   * Restore from serialized state.
   */
  fromJSON(data) {
    if (!data) return;
    this._events = [];
    this._byId.clear();
    this._byGiver.clear();
    this._byReceiver.clear();
    this._byTelos.clear();
    this._byType.clear();
    this._byStatus.clear();
    this._statusOverrides.clear();

    if (data.nextId) this._nextId = data.nextId;

    for (const e of (data.events || [])) {
      this.append(e);
    }

    if (data.statusOverrides) {
      for (const [id, override] of Object.entries(data.statusOverrides)) {
        this.applyStatusChange(id, override);
      }
    }
  }
}

export default GiftEventStore;
