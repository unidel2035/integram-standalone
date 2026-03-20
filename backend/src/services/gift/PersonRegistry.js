/**
 * PersonRegistry — Stakeholder Registry
 *
 * A stakeholder is not a role, not an actor, not a user ID.
 * A stakeholder is someone capable of contributing value.
 *
 * Ontological order:
 *   'source'  — Fund itself. Not a portfolio company.
 *              The fund contributes capital, expertise, network.
 *   'person'  — Stakeholder who received investment as contribution.
 *              Capable of contributing because they received the contribution to exist.
 *
 * Storage: In-memory cache (Map). Can be extended with Integram persistence.
 */

import logger from '../../utils/logger.js';

const TABLE_NAME = 'Stakeholders';

export class PersonRegistry {
  constructor() {
    this._persons = new Map();   // id → stakeholder (cache)
    this._nextId = 1;
    this._ready = false;
  }

  // ----- INITIALIZATION -----

  async init() {
    try {
      this._ready = true;
      logger.info(`[PersonRegistry] Ready: ${this._persons.size} stakeholders in memory`);
    } catch (e) {
      logger.warn(`[PersonRegistry] Init failed: ${e.message} — working in memory-only mode`);
      this._ready = false;
    }
  }

  // ----- PUBLIC API -----

  /**
   * Register the Fund Source — the fund itself as origin of capital.
   * Returns the Source stakeholder (singleton).
   */
  registerSource() {
    const existing = this.findByName('Fund');
    if (existing) return existing;

    const source = {
      id: '0',
      name: 'Fund',
      calling: 'Source of capital and expertise',
      description: 'The venture fund. Contributes capital, expertise, network, and strategic guidance.',
      ontologicalOrder: 'source',
      registeredAt: null,
      giftsGiven: 0,
      giftsReceived: 0,
      giftsDeclined: 0,
    };

    this._persons.set(source.id, source);
    return source;
  }

  /**
   * Register a fund entity (e.g., sub-fund, LP) — ontologicalOrder 'source'.
   */
  registerDivinePerson(name, { calling, description } = {}) {
    const existing = this.findByName(name);
    if (existing) return existing;

    const entity = {
      id: `entity-${name}`,
      name,
      calling: calling || null,
      description: description || null,
      ontologicalOrder: 'source',
      registeredAt: null,
      giftsGiven: 0,
      giftsReceived: 0,
      giftsDeclined: 0,
    };

    this._persons.set(entity.id, entity);
    return entity;
  }

  /**
   * Is this stakeholder the Fund Source?
   */
  isSource(stakeholderId) {
    const p = this._persons.get(String(stakeholderId));
    return p?.ontologicalOrder === 'source';
  }

  /**
   * Get the Fund Source, if registered.
   */
  getSource() {
    return this.findByName('Fund') || null;
  }

  /**
   * Register a stakeholder. Has a name and a calling (strategic purpose).
   * Properties are minimal — a stakeholder is known by their contributions, not attributes.
   */
  register(name, { calling, description, ontologicalOrder } = {}) {
    const existing = this.findByName(name);
    if (existing) return existing;

    if (ontologicalOrder === 'source') {
      throw new Error('Cannot register source through register(). Use registerSource().');
    }

    const stakeholder = {
      id: String(this._nextId++),
      name,
      calling: calling || null,
      description: description || null,
      ontologicalOrder: ontologicalOrder || 'person',
      registeredAt: new Date().toISOString(),
      giftsGiven: 0,
      giftsReceived: 0,
      giftsDeclined: 0,
    };

    this._persons.set(stakeholder.id, stakeholder);
    return stakeholder;
  }

  resolve(nameOrId) {
    if (!nameOrId) return null;
    const id = String(nameOrId);
    if (this._persons.has(id)) return this._persons.get(id);
    return this.findByName(nameOrId);
  }

  findByName(name) {
    if (!name) return null;
    const lower = String(name).toLowerCase();
    for (const p of this._persons.values()) {
      if (p.name && p.name.toLowerCase() === lower) return p;
    }
    return null;
  }

  get(id) {
    return this._persons.get(String(id));
  }

  all() {
    return [...this._persons.values()];
  }

  count() {
    return this._persons.size;
  }

  /**
   * Update exchange counters for a stakeholder.
   */
  recordGift(stakeholderId, role) {
    const stakeholder = this._persons.get(String(stakeholderId));
    if (!stakeholder) return;
    if (role === 'giver') stakeholder.giftsGiven++;
    if (role === 'receiver') stakeholder.giftsReceived++;
    if (role === 'declined') stakeholder.giftsDeclined++;
  }

  /**
   * Stats for diagnostics.
   */
  async stats() {
    return {
      ready: this._ready,
      table: TABLE_NAME,
      cachedPersons: this._persons.size,
    };
  }
}

// Singleton factory
let _instance = null;
export function getPersonRegistry() {
  if (!_instance) _instance = new PersonRegistry();
  return _instance;
}
