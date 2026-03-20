/**
 * AnamnesisCache — Context Memory: lightweight in-memory co-presence index
 *
 * Fast lookup cache for tracking relationships between value exchanges.
 * If the process restarts, the cache is empty and rebuilt lazily.
 *
 * Interface:
 *   makePresent(pastExchangeId, newExchangeId) — record bidirectional link
 *   getCoPresent(exchangeId)                   — list linked exchange IDs
 *   totalLinks()                               — count of unique links
 */

export class AnamnesisCache {
  constructor() {
    /** @type {Map<string, Set<string>>} exchangeId → Set<exchangeId> */
    this._links = new Map();
  }

  /** Record bidirectional co-presence between two value exchanges. */
  makePresent(pastExchangeId, newExchangeId) {
    const a = String(pastExchangeId);
    const b = String(newExchangeId);
    if (!this._links.has(a)) this._links.set(a, new Set());
    if (!this._links.has(b)) this._links.set(b, new Set());
    this._links.get(a).add(b);
    this._links.get(b).add(a);
  }

  /** Return array of exchange IDs co-present with the given one. */
  getCoPresent(exchangeId) {
    const s = this._links.get(String(exchangeId));
    return s ? [...s] : [];
  }

  /** Total unique co-presence links (each pair counted once). */
  totalLinks() {
    let n = 0;
    for (const s of this._links.values()) n += s.size;
    return n / 2;
  }

  /**
   * Get co-presence WEIGHT between two exchanges.
   * Not binary (linked/not-linked) but continuous (0-1).
   * Recent co-presence = ~1.0, old = decays but never 0.
   */
  getCoPresenceWeight(exchangeIdA, exchangeIdB) {
    const a = String(exchangeIdA);
    const b = String(exchangeIdB);

    const direct = this._links.get(a)?.has(b) || false;
    if (direct) return 1.0;

    // Transitive co-presence (depth 2)
    const aLinks = this._links.get(a);
    if (aLinks) {
      for (const mid of aLinks) {
        if (this._links.get(mid)?.has(b)) {
          return 0.5; // Transitive
        }
      }
    }

    // All exchanges share a base co-presence (they exist in the same ecosystem)
    return 0.01; // Never zero — everything is connected
  }

  /**
   * Get the full context memory field for an exchange — its weight to ALL other exchanges.
   */
  getField(exchangeId) {
    const id = String(exchangeId);
    const field = new Map();

    // Direct links
    const direct = this._links.get(id) || new Set();
    for (const linked of direct) {
      field.set(linked, 1.0);
    }

    // Transitive
    for (const linked of direct) {
      const transitive = this._links.get(linked) || new Set();
      for (const t of transitive) {
        if (t !== id && !field.has(t)) {
          field.set(t, 0.5);
        }
      }
    }

    return field;
  }
}
