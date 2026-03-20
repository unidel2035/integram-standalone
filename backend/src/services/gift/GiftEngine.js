/**
 * GiftEngine — Value Exchange Engine for Venture Fund
 *
 * ARCHITECTURE:
 *   - Stakeholders — actors (not data in Map)
 *   - Value exchanges — immutable events in GiftEventStore
 *   - GiftEngine — thin coordinator (facade), not God Object
 *   - Side effects — GiftEventBus subscribers
 *
 * Three zones: visible (facts) -> intelligible (patterns, questions) -> reserve (silence)
 */

import { PersonRegistry } from './PersonRegistry.js';
import { GratitudeGraph } from './GratitudeGraph.js';
import { AnamnesisCache } from './AnamnesisCache.js';
import { TelosPlanner } from './TelosPlanner.js';
import { FreedomGuard } from './FreedomGuard.js';
import PatternObserver from './PatternObserver.js';
import GiftEventBus from './GiftEventBus.js';
import GiftEventStore from './GiftEventStore.js';
import { createGiftEvent, EVENT_TYPES } from './GiftEvent.js';
import GiftPersistence from './GiftPersistence.js';
import logger from '../../utils/logger.js';

let _instance = null;

export class GiftEngine {
  constructor() {
    // -- Core subsystems --
    this.persons = new PersonRegistry();
    this.gratitude = new GratitudeGraph();
    this.graph = this.gratitude; // Legacy alias
    this.anamnesis = new AnamnesisCache();
    this.telos = new TelosPlanner();
    this.freedom = new FreedomGuard();

    // -- Observation --
    this.patterns = new PatternObserver(this);
    this.persistence = new GiftPersistence();

    // -- Event architecture --
    this._eventBus = new GiftEventBus();
    this._eventStore = new GiftEventStore();

    // -- Backward-compatible shim --
    this._nextId = 1;
    this._io = null;
    this._incalculableEvents = [];
  }

  // -- Backward-compatible accessors --
  get _gifts() { return this._eventStore.getAll(); }
  get gifts() { return this._eventStore.getAll(); }

  setIO(io) { this._io = io; }

  // ===================================================================
  // VALUE CREATION — the vertical axis: Fund -> portfolio
  // ===================================================================

  /**
   * Create a new value exchange event (fund contributes to portfolio).
   */
  create(creationData) {
    const source = this.persons.getSource();
    if (!source) throw new Error('Fund source not registered. Call bootstrap() first.');

    const id = this._eventStore.nextId();
    const event = {
      id,
      giver: source.id,
      giverName: source.name,
      receiver: creationData.receiver || 'all',
      receiverName: creationData.receiverName || creationData.receiver || 'all',
      content: creationData.content || creationData.name || '',
      telos: creationData.telos || null,
      ontologicalType: 'value_created',
      status: 'offered',
      offeredAt: new Date().toISOString(),
      layer: creationData.layer || 'utilitas',
      ...creationData,
    };

    const stored = this._eventStore.append(event);
    this.persons.recordGift(source.id, 'giver');

    const busEvent = createGiftEvent(EVENT_TYPES.VALUE_CREATED, stored);
    this._eventBus.emit(EVENT_TYPES.VALUE_CREATED, busEvent);

    return stored;
  }

  // ===================================================================
  // VALUE EXCHANGE LIFECYCLE (horizontal: stakeholder <-> stakeholder)
  // ===================================================================

  /**
   * Offer a value exchange.
   */
  offer(exchangeData) {
    const giver = this.persons.resolve(exchangeData.giver);
    if (!giver) throw new Error(`Unknown stakeholder: ${exchangeData.giver}`);

    const id = this._eventStore.nextId();
    const event = {
      id,
      giver: giver.id,
      giverName: giver.name,
      receiver: exchangeData.receiver || 'all',
      receiverName: exchangeData.receiverName || exchangeData.receiver || 'all',
      content: exchangeData.content || '',
      telos: exchangeData.telos || null,
      ontologicalType: exchangeData.ontologicalType || 'value_exchange',
      status: 'offered',
      offeredAt: new Date().toISOString(),
      layer: exchangeData.layer || this._detectGiftLayer(exchangeData),
      cost: exchangeData.cost || null,
      anonymous: exchangeData.anonymous || false,
      anamnesisIds: exchangeData.anamnesisIds || [],
      ...exchangeData,
      // Override with resolved values
      id,
      giver: giver.id,
      giverName: giver.name,
    };

    const stored = this._eventStore.append(event);
    this.persons.recordGift(giver.id, 'giver');

    // Context memory: link to past exchanges
    if (event.anamnesisIds) {
      for (const aid of event.anamnesisIds) {
        this.anamnesis.makePresent(aid, id);
      }
    }

    const busEvent = createGiftEvent(EVENT_TYPES.VALUE_OFFERED, stored);
    this._eventBus.emit(EVENT_TYPES.VALUE_OFFERED, busEvent);

    // Emit via Socket.io if available
    if (this._io) {
      this._io.emit('gift:offered', stored);
    }

    return stored;
  }

  /**
   * Accept a value exchange.
   */
  accept(exchangeId, transformation = {}) {
    const exchange = this._eventStore.getById(String(exchangeId));
    if (!exchange) throw new Error(`Exchange ${exchangeId} not found`);
    if (exchange.status !== 'offered' && exchange.status !== 'deferred') {
      throw new Error(`Exchange ${exchangeId} already ${exchange.status}`);
    }

    const statusData = {
      status: 'accepted',
      deferReason: null,
      freedom: true,
      acceptedAt: new Date().toISOString(),
      transforms: {
        giver: transformation.giver || `became contributor of "${exchange.content}"`,
        receiver: transformation.receiver || `received "${exchange.content}"`,
      },
    };
    this._eventStore.applyStatusChange(exchangeId, statusData);

    if (exchange.receiver && exchange.receiver !== 'all') {
      this.persons.recordGift(exchange.receiver, 'receiver');
      if (!exchange.anonymous) this.gratitude.addGratitude(exchange.receiver, exchange.giver, exchange.id);
    }
    if (exchange.telos) this.telos.recordProgress(exchange.telos, exchange.id);

    const projected = this._eventStore.getById(exchangeId);
    const busEvent = createGiftEvent(EVENT_TYPES.VALUE_ACCEPTED, projected);
    this._eventBus.emit(EVENT_TYPES.VALUE_ACCEPTED, busEvent);

    if (this._io) {
      this._io.emit('gift:accepted', projected);
    }

    return projected;
  }

  /**
   * Decline a value exchange.
   */
  decline(exchangeId, reason) {
    const exchange = this._eventStore.getById(String(exchangeId));
    if (!exchange) throw new Error(`Exchange ${exchangeId} not found`);
    if (exchange.status !== 'offered' && exchange.status !== 'deferred') {
      throw new Error(`Exchange ${exchangeId} already ${exchange.status}`);
    }

    const statusData = {
      status: 'declined',
      deferReason: null,
      freedom: true,
      transforms: {
        giver: reason || 'exchange was not received',
        receiver: 'exercised autonomy',
      },
    };
    this._eventStore.applyStatusChange(exchangeId, statusData);

    if (exchange.receiver && exchange.receiver !== 'all') {
      this.persons.recordGift(exchange.receiver, 'declined');
    }

    const projected = this._eventStore.getById(exchangeId);
    const busEvent = createGiftEvent(EVENT_TYPES.VALUE_DECLINED, projected);
    this._eventBus.emit(EVENT_TYPES.VALUE_DECLINED, busEvent);

    if (this._io) {
      this._io.emit('gift:declined', projected);
    }

    return projected;
  }

  // ===================================================================
  // QUERIES
  // ===================================================================

  getGift(id) {
    return this._eventStore.getById(String(id));
  }

  getGifts({ status, giver, receiver, telos, limit = 50 } = {}) {
    const result = this._eventStore.query({ status, giver, receiver, telos });
    return result.slice(-limit).reverse();
  }

  whatIsNeeded(stakeholderId) {
    return this.telos.whatIsNeeded(stakeholderId, this._eventStore.getAll(), this.persons);
  }

  getCoPresent(exchangeId) {
    return this.anamnesis.getCoPresent(exchangeId).map(id => this.getGift(id)).filter(Boolean);
  }

  getGratitudePath(fromStakeholder, toStakeholder) {
    return this.gratitude.findPath(fromStakeholder, toStakeholder);
  }

  // ===================================================================
  // PATTERNS
  // ===================================================================

  getPatterns(stakeholderId) { return this.patterns.observe(stakeholderId); }

  // ===================================================================
  // STRATEGIC GOALS — emergent discovery
  // ===================================================================

  getDiscoveredTelos(stakeholderId) {
    return this.telos.discoverTelos(stakeholderId, this._eventStore.getAll(), this.persons);
  }

  // ===================================================================
  // MUTUAL VALUE CYCLES (formerly Perichoresis)
  // ===================================================================

  getPerichoresis() {
    return {
      cycles: this.gratitude.findCycles(5),
      pairs: this.gratitude.getMutualPairs(),
    };
  }

  // ===================================================================
  // INCALCULABLE EVENTS
  // ===================================================================

  recordIncalculable(data) {
    const event = {
      id: `inc-${Date.now()}`,
      persons: data.persons || [],
      description: data.description || '',
      witness: data.witness || null,
      createdAt: new Date().toISOString(),
    };
    this._incalculableEvents.push(event);
    logger.info(`[Gift] Incalculable event: "${event.description}"`);

    const busEvent = createGiftEvent(EVENT_TYPES.INCALCULABLE, event);
    this._eventBus.emit(EVENT_TYPES.INCALCULABLE, busEvent);

    return event;
  }

  getIncalculableEvents() { return [...this._incalculableEvents]; }

  // ===================================================================
  // PERSISTENCE
  // ===================================================================

  exportState() {
    return {
      persons: this.persons.all(),
      gifts: this._eventStore.getAll(),
      freedom: this.freedom.export(),
      incalculable: this._incalculableEvents,
      gratitude: this.gratitude.export(),
    };
  }

  importState(data) {
    if (!data) return;
    if (data.persons) {
      for (const p of data.persons) {
        if (!this.persons.get(p.id)) {
          if (p.ontologicalOrder === 'source') {
            this.persons.registerSource();
          } else {
            this.persons.register(p.name, {
              calling: p.calling,
              description: p.description,
              ontologicalOrder: p.ontologicalOrder,
            });
          }
        }
      }
    }
    if (data.gifts) {
      const existingIds = new Set(this._eventStore.getAll().map(g => g.id));
      for (const g of data.gifts) {
        if (!existingIds.has(g.id)) {
          this._eventStore.append(g);
        }
      }
      this._rebuildIndices(this._eventStore.getAll());
    }
    if (data.freedom) this.freedom.import(data.freedom);
    if (data.incalculable) this._incalculableEvents = data.incalculable;
    if (data.gratitude) this.gratitude.import(data.gratitude);
  }

  _rebuildIndices(exchanges) {
    for (const g of exchanges) {
      if (g.status === 'accepted' && g.receiver !== 'all') {
        this.gratitude.addGratitude(g.receiver, g.giver, g.id);
      }
      if (g.telos && g.status === 'accepted') {
        this.telos.recordProgress(g.telos, g.id);
      }
      if (g.anamnesisIds) {
        for (const aid of g.anamnesisIds) {
          this.anamnesis.makePresent(aid, g.id);
        }
      }
    }
  }

  // ===================================================================
  // BOOTSTRAP
  // ===================================================================

  async bootstrap() {
    // -- SQLite persistence — load state from disk --
    let loadedFromDisk = false;
    try {
      this.persistence.init(this);
      const savedState = this.persistence.load();
      if (savedState) {
        this.importState(savedState);
        loadedFromDisk = true;
        logger.info(`[Gift] State restored from disk: ${savedState.persons?.length || 0} stakeholders, ${savedState.gifts?.length || 0} exchanges`);
      }
    } catch (e) {
      logger.warn(`[Gift] SQLite persistence init failed: ${e.message}`);
    }

    // Init PersonRegistry
    try {
      await this.persons.init();
      logger.info(`[Gift] PersonRegistry ready, ${this.persons.count()} stakeholders cached`);
    } catch (e) {
      logger.warn(`[Gift] PersonRegistry init (memory-only mode): ${e.message}`);
    }

    // -- Auto-save every 30 seconds --
    this.persistence.startAutoSave(30);

    if (loadedFromDisk && this._eventStore.length > 0) {
      if (!this.persons.getSource()) {
        this.persons.registerSource();
      }
      return;
    }

    // -- Initial setup: register fund as source --
    this.persons.registerSource();
    logger.info('[Gift] Fund source registered');

    // Register fund entities
    this.persons.registerDivinePerson('LP Pool', {
      calling: 'Limited Partners',
      description: 'LP Pool — source of capital for the fund',
    });
    this.persons.registerDivinePerson('Advisory Board', {
      calling: 'Strategic Advisory',
      description: 'Advisory Board — expertise and strategic guidance',
    });
    logger.info('[Gift] Fund entities registered: Fund, LP Pool, Advisory Board');

    // Establish core reciprocity links
    const fund = this.persons.getSource();
    const lp = this.persons.findByName('LP Pool');
    const advisory = this.persons.findByName('Advisory Board');

    if (fund && lp && advisory) {
      this.gratitude.addGratitude(fund.id, lp.id, 'core-fund-lp');
      this.gratitude.addGratitude(lp.id, fund.id, 'core-lp-fund');
      this.gratitude.addGratitude(fund.id, advisory.id, 'core-fund-advisory');
      this.gratitude.addGratitude(advisory.id, fund.id, 'core-advisory-fund');
      this.gratitude.addGratitude(lp.id, advisory.id, 'core-lp-advisory');
      this.gratitude.addGratitude(advisory.id, lp.id, 'core-advisory-lp');
      logger.info('[Gift] Core reciprocity links established');
    }

    logger.info('[Gift] Value Exchange Engine bootstrap complete');
  }

  // ===================================================================
  // STATISTICS
  // ===================================================================

  getStats() {
    const all = this._eventStore.getAll();
    const total = all.length;
    const accepted = this._eventStore.query({ status: 'accepted' }).length;
    const declined = this._eventStore.query({ status: 'declined' }).length;
    const pending = this._eventStore.query({ status: 'offered' }).length;
    const teloi = new Set(all.filter(g => g.telos).map(g => g.telos));

    return {
      stakeholders: this.persons.count(),
      fundPresent: !!this.persons.getSource(),
      totalExchanges: total,
      accepted,
      declined,
      pending,
      acceptanceRate: total > 0 ? Math.round(accepted / total * 100) : 0,
      strategicGoals: [...teloi],
      goalProgress: this.telos.getAllProgress(),
      reciprocityDensity: this.gratitude.density(),
      contextMemoryLinks: this.anamnesis.totalLinks(),
    };
  }

  // ===================================================================
  // INTERNAL — layer detection
  // ===================================================================

  _detectGiftLayer(exchange) {
    const text = `${exchange.content || ''} ${exchange.cost || ''} ${exchange.telos || ''}`.toLowerCase();

    // Strategic layer keywords
    const gratiaKw = ['strategic', 'vision', 'partnership', 'transformation', 'breakthrough', 'innovation', 'inspiration'];
    for (const kw of gratiaKw) if (text.includes(kw)) return 'gratia';

    // Value layer keywords
    const bonumKw = ['trust', 'solidarity', 'collaboration', 'support', 'partnership', 'loyalty', 'honesty', 'care', 'help', 'cooperation'];
    for (const kw of bonumKw) if (text.includes(kw)) return 'bonum';

    // Default — utility
    return 'utilitas';
  }
}

// Singleton
export function getGiftEngine() {
  if (!_instance) _instance = new GiftEngine();
  return _instance;
}
