/**
 * FreedomGuard — Stakeholder Autonomy
 *
 * A value exchange can be declined. This is not an error — it is a condition of genuine exchange.
 * Forced exchange is not exchange, it is coercion.
 * A system where a stakeholder cannot refuse is captivity, not partnership.
 */

export class FreedomGuard {
  constructor() {
    // stakeholderId → Set<fromStakeholderId> — standing refusals
    this._refusals = new Map();

    // stakeholderId → { reason, since } — temporary unavailability
    this._unavailable = new Map();

    // History of refusals — for understanding patterns, not for blame
    this._refusalHistory = [];
  }

  /**
   * Stakeholder refuses exchanges from a specific source.
   * This is autonomy, not error.
   */
  refuse(stakeholderId, fromStakeholderId, reason) {
    const id = String(stakeholderId);
    const from = String(fromStakeholderId);

    if (!this._refusals.has(id)) {
      this._refusals.set(id, new Set());
    }
    this._refusals.get(id).add(from);

    this._refusalHistory.push({
      person: id,
      from,
      reason: reason || 'Autonomy exercised without explanation (which is also autonomy)',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Stakeholder lifts refusal — opens to exchanges again.
   */
  openTo(stakeholderId, fromStakeholderId) {
    const id = String(stakeholderId);
    const from = String(fromStakeholderId);
    const refusals = this._refusals.get(id);
    if (refusals) {
      refusals.delete(from);
      if (refusals.size === 0) this._refusals.delete(id);
    }
  }

  /**
   * Is this stakeholder currently refusing exchanges from a specific source?
   */
  isRefusing(stakeholderId, fromStakeholderId) {
    const refusals = this._refusals.get(String(stakeholderId));
    if (!refusals) return false;
    return refusals.has(String(fromStakeholderId));
  }

  /**
   * Stakeholder is temporarily unavailable (on break, reassessing, etc.).
   * Not refusal — just not-now.
   */
  markUnavailable(stakeholderId, reason) {
    this._unavailable.set(String(stakeholderId), {
      reason: reason || 'On break',
      since: new Date().toISOString(),
    });
  }

  /**
   * Stakeholder becomes available again.
   */
  markAvailable(stakeholderId) {
    this._unavailable.delete(String(stakeholderId));
  }

  /**
   * Is this stakeholder available to receive value exchanges?
   */
  isAvailable(stakeholderId) {
    return !this._unavailable.has(String(stakeholderId));
  }

  /**
   * Refusal history — for understanding patterns, not for punishment.
   */
  getRefusalHistory(stakeholderId) {
    if (!stakeholderId) return this._refusalHistory;
    const id = String(stakeholderId);
    return this._refusalHistory.filter(r => r.person === id || r.from === id);
  }

  /**
   * Export for persistence.
   */
  export() {
    const refusals = {};
    for (const [stakeholderId, fromSet] of this._refusals) {
      refusals[stakeholderId] = [...fromSet];
    }
    const unavailable = {};
    for (const [stakeholderId, state] of this._unavailable) {
      unavailable[stakeholderId] = state;
    }
    return {
      refusals,
      unavailable,
      history: this._refusalHistory,
    };
  }

  /**
   * Import from persistence.
   */
  import(data) {
    if (!data) return;
    if (data.refusals) {
      for (const [stakeholderId, fromArr] of Object.entries(data.refusals)) {
        this._refusals.set(stakeholderId, new Set(fromArr));
      }
    }
    if (data.unavailable) {
      for (const [stakeholderId, state] of Object.entries(data.unavailable)) {
        this._unavailable.set(stakeholderId, state);
      }
    }
    if (data.history) {
      this._refusalHistory = data.history;
    }
  }
}
