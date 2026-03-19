/**
 * Drononomics Service
 *
 * Seeds economic game data into kval database via EventEngineService:
 * - 10 economic actors (buyers, platform, investor, insurer)
 * - 1 vocabulary "Дронономика" with 12 economic properties
 * - 1 concept "Дата-токен" (auto-creates model)
 *
 * Uses existing СОД tables from Event Engine (Issue #7043).
 */

import { getEventEngineService } from './EventEngineService.js';
import logger from '../../utils/logger.js';

class DrononomicsService {
  constructor() {
    this.engine = null;
    this.seeded = false;
  }

  getEngine() {
    if (!this.engine) this.engine = getEventEngineService();
    return this.engine;
  }

  // ─── Seed All Data ──────────────────────────────────────────

  async seed() {
    const engine = this.getEngine();
    await engine.initialize();

    const results = {
      actors: [],
      vocabulary: null,
      properties: [],
      concept: null,
    };

    // 1. Seed actors
    results.actors = await this.seedActors();

    // 2. Seed vocabulary
    results.vocabulary = await this.seedVocabulary();

    // 3. Seed properties
    if (results.vocabulary?.id) {
      results.properties = await this.seedProperties(results.vocabulary.id);
    }

    // 4. Seed concept (auto-creates model)
    results.concept = await this.seedConcept();

    this.seeded = true;
    logger.info('[Drononomics] Seed complete', {
      actors: results.actors.length,
      properties: results.properties.length,
      vocabulary: results.vocabulary?.id,
      concept: results.concept?.id,
    });

    return results;
  }

  // ─── Actors ─────────────────────────────────────────────────

  async seedActors() {
    const engine = this.getEngine();
    const existing = await engine.getActors();
    const existingNames = new Set(existing.map(a => a.val));

    const actorsToCreate = [
      { name: 'Фермер Иванов', type: 'buyer', description: 'Покупатель С/Х данных (NDVI-карты)' },
      { name: 'Лесничество МЧС', type: 'buyer', description: 'Покупатель тепловых карт лесных пожаров' },
      { name: 'Газпромнефть', type: 'buyer', description: 'Покупатель ортофотопланов нефтепровода' },
      { name: 'Логист-Экспресс', type: 'buyer', description: 'Покупатель трек-логистики доставки' },
      { name: 'Россети', type: 'buyer', description: 'Покупатель 3D-моделей инспекции ЛЭП' },
      { name: 'СтройГарант', type: 'buyer', description: 'Покупатель ортофото строительных площадок' },
      { name: 'Росприроднадзор', type: 'buyer', description: 'Покупатель мультиспектральных данных экомониторинга' },
      { name: 'DronDoc Platform', type: 'platform', description: 'Платформа-маркетплейс дронных данных' },
      { name: 'Фонд Развития БАС', type: 'investor', description: 'Инвестиционный фонд развития беспилотной авиации' },
      { name: 'СОГАЗ Страхование', type: 'insurer', description: 'Страховщик дронных операций и рисков' },
    ];

    const created = [];
    for (const actor of actorsToCreate) {
      if (existingNames.has(actor.name)) {
        const ex = existing.find(a => a.val === actor.name);
        created.push({ id: ex.id, name: actor.name, status: 'exists' });
        continue;
      }
      try {
        const result = await engine.createActor(actor.name, {
          type: actor.type,
          description: actor.description,
          status: 'active',
        });
        created.push({ id: result?.id || result?.obj, name: actor.name, status: 'created' });
      } catch (err) {
        logger.warn(`[Drononomics] Failed to create actor ${actor.name}:`, err.message);
        created.push({ name: actor.name, status: 'error', error: err.message });
      }
    }
    return created;
  }

  // ─── Vocabulary ─────────────────────────────────────────────

  async seedVocabulary() {
    const engine = this.getEngine();
    const existing = await engine.getVocabularies();
    const found = existing.find(v => v.val === 'Дронономика');
    if (found) return { id: found.id, status: 'exists' };

    try {
      const result = await engine.createVocabulary('Дронономика', 'Экономическая модель дронных операций: токены данных, ценообразование, ROI');
      return { id: result?.id || result?.obj, status: 'created' };
    } catch (err) {
      logger.warn('[Drononomics] Failed to create vocabulary:', err.message);
      return { status: 'error', error: err.message };
    }
  }

  // ─── Properties ─────────────────────────────────────────────

  async seedProperties(vocabularyId) {
    const engine = this.getEngine();
    const existing = await engine.getProperties();
    const existingNames = new Set(existing.map(p => p.val));

    const propsToCreate = [
      { name: 'Цена', dataType: 'Number', desc: 'Цена токена данных (₽)' },
      { name: 'Себестоимость', dataType: 'Number', desc: 'Себестоимость сбора данных (₽)' },
      { name: 'Качество', dataType: 'Number', desc: 'Качество данных (0-100)' },
      { name: 'Свежесть', dataType: 'Number', desc: 'Коэффициент свежести данных (0.0-1.0)' },
      { name: 'Объём данных', dataType: 'Number', desc: 'Объём собранных данных (MB)' },
      { name: 'Комиссия', dataType: 'Number', desc: 'Комиссия платформы (₽)' },
      { name: 'Прибыль', dataType: 'Number', desc: 'Прибыль участника (₽)' },
      { name: 'ROI', dataType: 'Number', desc: 'Return on Investment (%)' },
      { name: 'Тип данных', dataType: 'Text', desc: 'Тип дронных данных (NDVI, тепловая карта, ортофото, 3D и т.д.)' },
      { name: 'Выгода покупателя', dataType: 'Number', desc: 'Экономическая выгода покупателя (₽)' },
      { name: 'Статус сделки', dataType: 'Text', desc: 'Статус: pending, sold, delivered, verified' },
      { name: 'Формация роя', dataType: 'Text', desc: 'Тип формации роя: line, grid, circle, V-formation' },
    ];

    const created = [];
    for (const prop of propsToCreate) {
      if (existingNames.has(prop.name)) {
        const ex = existing.find(p => p.val === prop.name);
        created.push({ id: ex.id, name: prop.name, status: 'exists' });
        continue;
      }
      try {
        const result = await engine.createProperty(prop.name, {
          propertyType: 'attribute',
          dataType: prop.dataType,
          vocabularyId: String(vocabularyId),
        });
        created.push({ id: result?.id || result?.obj, name: prop.name, status: 'created' });
      } catch (err) {
        logger.warn(`[Drononomics] Failed to create property ${prop.name}:`, err.message);
        created.push({ name: prop.name, status: 'error', error: err.message });
      }
    }
    return created;
  }

  // ─── Concept ────────────────────────────────────────────────

  async seedConcept() {
    const engine = this.getEngine();
    const existing = await engine.getConcepts();
    const found = existing.find(c => c.val === 'Дата-токен');
    if (found) return { id: found.id, status: 'exists' };

    try {
      const result = await engine.createConcept('Дата-токен', 'Токен полезных данных, созданный дроном при выполнении миссии. Содержит NDVI, ортофото, тепловую карту и другие продукты обработки.');
      return { id: result?.id || result?.obj, status: 'created' };
    } catch (err) {
      logger.warn('[Drononomics] Failed to create concept:', err.message);
      return { status: 'error', error: err.message };
    }
  }

  // ─── Scenarios Config ────────────────────────────────────────

  getScenarios() {
    return [
      {
        id: 'agri',
        name: 'С/Х обработка',
        product: 'NDVI-карта',
        price: 45000,
        cost: 17000,
        buyerBenefit: 120000,
        buyer: 'Фермер Иванов',
        color: '#4caf50',
        emoji: '\u{1F33E}',
        droneCount: 3,
        formation: 'line',
        routeType: 'snake',
      },
      {
        id: 'fire',
        name: 'Лесные пожары',
        product: 'Тепловая карта',
        price: 65000,
        cost: 26000,
        buyerBenefit: 500000,
        buyer: 'Лесничество МЧС',
        color: '#f44336',
        emoji: '\u{1F525}',
        droneCount: 3,
        formation: 'V',
        routeType: 'patrol',
      },
      {
        id: 'oil',
        name: 'Нефтепровод',
        product: 'Ортофотоплан',
        price: 80000,
        cost: 32000,
        buyerBenefit: 1000000,
        buyer: 'Газпромнефть',
        color: '#ff9800',
        emoji: '\u{1F6E2}',
        droneCount: 3,
        formation: 'line',
        routeType: 'along',
      },
      {
        id: 'delivery',
        name: 'Доставка',
        product: 'Трек логистики',
        price: 15000,
        cost: 7000,
        buyerBenefit: 25000,
        buyer: 'Логист-Экспресс',
        color: '#2196f3',
        emoji: '\u{1F4E6}',
        droneCount: 3,
        formation: 'V',
        routeType: 'direct',
      },
      {
        id: 'powerline',
        name: 'Инспекция ЛЭП',
        product: '3D-модель',
        price: 90000,
        cost: 40000,
        buyerBenefit: 800000,
        buyer: 'Россети',
        color: '#9c27b0',
        emoji: '\u26A1',
        droneCount: 3,
        formation: 'line',
        routeType: 'along',
      },
      {
        id: 'construction',
        name: 'Строительство',
        product: 'Ортофото+3D',
        price: 55000,
        cost: 27000,
        buyerBenefit: 300000,
        buyer: 'СтройГарант',
        color: '#795548',
        emoji: '\u{1F3D7}',
        droneCount: 3,
        formation: 'grid',
        routeType: 'grid',
      },
      {
        id: 'eco',
        name: 'Экомониторинг',
        product: 'Мультиспектр',
        price: 40000,
        cost: 21000,
        buyerBenefit: 150000,
        buyer: 'Росприроднадзор',
        color: '#00bcd4',
        emoji: '\u{1F30A}',
        droneCount: 3,
        formation: 'circle',
        routeType: 'circle',
      },
    ];
  }

  getEconomicFormulas() {
    return {
      commissionRate: 0.05,
      operatorShare: 0.60,
      processorShare: 0.25,
      platformShare: 0.05,
      devFundShare: 0.10,
      freshnessDecay: 30,
    };
  }

  // ─── FSM Model (Ontology → JSON for frontend runtime) ─────────

  /**
   * Build FSM model from kval СОД tables.
   * Reads: СОД Модели → СОД Состояния → СОД Переходы → СОД Триггеры
   * Returns JSON compatible with DrononomicsFSMRuntime.loadModel()
   */
  async buildOntologyModel() {
    const engine = this.getEngine();
    await engine.initialize();

    // Find all models tagged as "Дронономика" or with concept = "Дата-токен"
    const allModels = await engine.getModels();
    const dronModels = allModels.filter(m => {
      const name = (m.val || '').toLowerCase();
      return name.includes('дронономик') || name.includes('fsm') || name.includes('financial') ||
             name.includes('war') || name.includes('adoption') || name.includes('gov');
    });

    if (dronModels.length === 0) {
      logger.info('[Drononomics] No FSM models found in kval, returning null (fallback to hardcoded)');
      return null;
    }

    const machines = {};
    const triggers = [];

    for (const model of dronModels) {
      const modelId = model.id;
      const machineId = this._extractMachineId(model.val);

      const states = await engine.getStates(modelId);
      const transitions = await engine.getTransitions(modelId);

      const stateMap = {};
      const stateIdToName = {};
      for (const s of states) {
        const stateId = this._normalizeId(s.val);
        stateIdToName[s.id] = stateId;
        let params = {};
        try {
          const descRaw = s.reqs?.['Описание']?.value;
          if (descRaw && descRaw.startsWith('{')) params = JSON.parse(descRaw);
        } catch { /* ignore parse errors */ }
        stateMap[stateId] = { params };
      }

      const transArr = transitions.map(t => {
        const from = stateIdToName[t.reqs?.['Из']?.value] || '*';
        const to = stateIdToName[t.reqs?.['В']?.value] || 'unknown';
        let guard = t.reqs?.['Охранное условие']?.value || null;
        let action = null;
        try {
          const actionRaw = t.reqs?.['Действие']?.value;
          if (actionRaw && actionRaw.startsWith('{')) action = JSON.parse(actionRaw);
        } catch { /* ignore */ }
        return { from, to, guard, action };
      });

      const initial = states.length > 0
        ? stateIdToName[states.sort((a, b) => Number(a.reqs?.['Порядок']?.value || 0) - Number(b.reqs?.['Порядок']?.value || 0))[0].id]
        : Object.keys(stateMap)[0];

      const perEntity = (model.val || '').toLowerCase().includes('per-entity') ||
                        ['droneStatus', 'missionStatus', 'droneEthics', 'factoryQueue'].includes(machineId);

      machines[machineId] = {
        states: stateMap,
        transitions: transArr,
        initial,
        params: {},
        perEntity,
      };
    }

    // Fetch triggers from СОД Триггеры
    try {
      const allTriggers = engine.getTriggers();
      for (const trig of allTriggers) {
        const on = trig.reqs?.['Событие']?.value || 'transition';
        const machine = trig.reqs?.['Модель']?.value || null;
        const toState = trig.reqs?.['Состояние']?.value || null;
        let action = null;
        try {
          const actionRaw = trig.reqs?.['Действие']?.value;
          if (actionRaw && actionRaw.startsWith('{')) action = JSON.parse(actionRaw);
        } catch { /* ignore */ }
        triggers.push({ on, machine, toState, action });
      }
    } catch (err) {
      logger.warn('[Drononomics] Could not fetch triggers:', err.message);
    }

    logger.info(`[Drononomics] Built ontology model: ${Object.keys(machines).length} machines, ${triggers.length} triggers`);
    return { machines, triggers };
  }

  /**
   * Extract machine ID from model name.
   * "Дронономика: financialStress" → "financialStress"
   * "FSM Война" → "war"
   */
  _extractMachineId(name) {
    if (!name) return 'unknown';
    const n = name.toLowerCase();
    // Direct match after colon
    const colonMatch = name.match(/:\s*(\w+)/);
    if (colonMatch) return colonMatch[1];

    // Known name mapping
    const nameMap = {
      'финанс': 'financialStress',
      'банкротств': 'financialStress',
      'войн': 'war',
      'полити': 'govPolicy',
      'правительств': 'govPolicy',
      'adopt': 'adoption',
      'фаз': 'adoption',
      'дрон': 'droneStatus',
      'миссия': 'missionStatus',
      'этик': 'droneEthics',
      'завод': 'factoryQueue',
      'производств': 'factoryQueue',
    };
    for (const [key, id] of Object.entries(nameMap)) {
      if (n.includes(key)) return id;
    }
    return name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  }

  _normalizeId(name) {
    if (!name) return 'unknown';
    return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  }

  // ─── Save Backtest Results ────────────────────────────────────

  /**
   * Save backtest event log as subject events in kval.
   * @param {Array} eventLog - from DrononomicsFSMRuntime.getLog()
   * @param {Object} metadata - { userId, gameMode, finalIndex, totalTicks }
   */
  async saveBacktestResults(eventLog, metadata = {}) {
    const engine = this.getEngine();
    await engine.initialize();

    if (!eventLog || eventLog.length === 0) {
      return { saved: 0, status: 'empty' };
    }

    // Find or create the backtest actor
    const actors = await engine.getActors();
    let backtestActor = actors.find(a => a.val === 'Дронономика Бэктест');
    if (!backtestActor) {
      backtestActor = await engine.createActor('Дронономика Бэктест', {
        type: 'system',
        description: 'Автоматический актор для записи результатов бэктеста дронономики',
      });
    }
    const actorId = backtestActor?.id || backtestActor?.obj;

    // Save up to 500 events (sample if more)
    const maxEvents = 500;
    const eventsToSave = eventLog.length > maxEvents
      ? eventLog.filter((_, i) => i % Math.ceil(eventLog.length / maxEvents) === 0).slice(0, maxEvents)
      : eventLog;

    let saved = 0;
    for (const evt of eventsToSave) {
      try {
        const label = `FSM:${evt.machine || 'global'}:${evt.from}→${evt.to}`;
        await engine.createSubjectEvent(label, {
          individualId: actorId,
          description: JSON.stringify({
            ...evt,
            ...metadata,
            savedAt: new Date().toISOString(),
          }),
        });
        saved++;
      } catch (err) {
        logger.warn('[Drononomics] Failed to save backtest event:', err.message);
      }
    }

    logger.info(`[Drononomics] Saved ${saved}/${eventsToSave.length} backtest events`);
    return { saved, total: eventLog.length, sampled: eventsToSave.length };
  }

  // ─── Seed FSM Models into kval ────────────────────────────────

  /**
   * Create 8 FSM models in kval with states and transitions.
   * Uses the same default model as buildDefaultModel() in Config.js.
   */
  async seedFSMModels() {
    const engine = this.getEngine();
    await engine.initialize();

    // Inline minimal version of buildDefaultModel
    const fsmDefs = {
      financialStress: {
        name: 'Дронономика: financialStress',
        states: [
          { name: 'healthy', order: 0, params: { level: 0, debtThrottle: 1.0 } },
          { name: 'mild', order: 1, params: { level: 1, debtThrottle: 0.6 } },
          { name: 'severe', order: 2, params: { level: 2, debtThrottle: 0.25 } },
          { name: 'bankruptcy', order: 3, params: { level: 3, debtThrottle: 0 } },
        ],
        transitions: [
          { from: 'healthy', to: 'bankruptcy', guard: 'cash < debtCeiling' },
          { from: 'healthy', to: 'severe', guard: 'cash < -startCash' },
          { from: 'healthy', to: 'mild', guard: 'cash < 0' },
          { from: 'mild', to: 'bankruptcy', guard: 'cash < debtCeiling' },
          { from: 'mild', to: 'severe', guard: 'cash < -startCash' },
          { from: 'mild', to: 'healthy', guard: 'cash >= 0' },
          { from: 'severe', to: 'bankruptcy', guard: 'cash < debtCeiling' },
          { from: 'severe', to: 'healthy', guard: 'cash >= 0' },
          { from: 'bankruptcy', to: 'healthy', guard: 'cash >= 0' },
        ],
      },
      war: {
        name: 'Дронономика: war',
        states: [
          { name: 'planned', order: 0 },
          { name: 'active', order: 1, params: { productionDiversion: 0.3, fleetDiversionQuarterly: 0.05 } },
          { name: 'ended', order: 2 },
        ],
        transitions: [
          { from: 'planned', to: 'active', guard: 'warPlanned == true && tick >= warStartTick' },
          { from: 'active', to: 'ended', guard: 'tick >= warEndTick' },
        ],
      },
      govPolicy: {
        name: 'Дронономика: govPolicy',
        states: [
          { name: 'moderate', order: 0, params: { subsidyMult: 1.0 } },
          { name: 'liberal', order: 1, params: { subsidyMult: 1.15 } },
          { name: 'restrictive', order: 2, params: { subsidyMult: 0.85 } },
          { name: 'crisis', order: 3, params: { subsidyMult: 0.5 } },
        ],
        transitions: [
          { from: '*', to: 'crisis', guard: 'warActive == true || inflation > 15 || keyRate > 20' },
          { from: '*', to: 'restrictive', guard: 'inflation > 10 || keyRate > 15' },
          { from: '*', to: 'liberal', guard: 'inflation < 6 && keyRate < 10' },
        ],
      },
      adoption: {
        name: 'Дронономика: adoption',
        states: [
          { name: 'embryonic', order: 0, params: { maxFleet: 500, demandMult: 0.4 } },
          { name: 'nascent', order: 1, params: { maxFleet: 2000, demandMult: 0.7 } },
          { name: 'growing', order: 2, params: { maxFleet: 10000, demandMult: 1.2 } },
          { name: 'mainstream', order: 3, params: { maxFleet: 50000, demandMult: 2.0 } },
          { name: 'mature', order: 4, params: { maxFleet: 999999, demandMult: 2.5 } },
        ],
        transitions: [
          { from: 'embryonic', to: 'nascent', guard: 'fleet > 500' },
          { from: 'nascent', to: 'growing', guard: 'fleet > 2000' },
          { from: 'growing', to: 'mainstream', guard: 'fleet > 10000' },
          { from: 'mainstream', to: 'mature', guard: 'fleet > 50000' },
        ],
      },
    };

    const results = {};
    for (const [machineId, def] of Object.entries(fsmDefs)) {
      try {
        // Check if model already exists
        const existing = await engine.getModels();
        const found = existing.find(m => m.val === def.name);
        if (found) {
          results[machineId] = { status: 'exists', modelId: found.id };
          continue;
        }

        // Create model (via concept auto-creation)
        const concepts = await engine.getConcepts();
        let concept = concepts.find(c => c.val === 'Дронономика FSM');
        if (!concept) {
          concept = await engine.createConcept('Дронономика FSM', 'FSM-модели движка дронономики');
        }
        const conceptId = concept?.id || concept?.obj;

        const model = await engine.createModel(def.name, { conceptId });
        const modelId = model?.id || model?.obj;

        // Create states
        const stateIdMap = {};
        for (const s of def.states) {
          const st = await engine.createState(modelId, {
            name: s.name,
            order: s.order,
            description: s.params ? JSON.stringify(s.params) : undefined,
          });
          stateIdMap[s.name] = st?.id || st?.obj;
        }

        // Create transitions
        for (const t of def.transitions) {
          const fromId = t.from === '*' ? null : stateIdMap[t.from];
          const toId = stateIdMap[t.to];
          await engine.createTransition(modelId, {
            fromStateId: fromId,
            toStateId: toId,
            guard: t.guard,
            trigger: `${t.from}→${t.to}`,
          });
        }

        results[machineId] = {
          status: 'created',
          modelId,
          states: Object.keys(stateIdMap).length,
          transitions: def.transitions.length,
        };
      } catch (err) {
        logger.warn(`[Drononomics] Failed to seed FSM ${machineId}:`, err.message);
        results[machineId] = { status: 'error', error: err.message };
      }
    }

    logger.info('[Drononomics] Seed FSM complete:', results);
    return results;
  }
}

let instance = null;
export function getDrononomicsService() {
  if (!instance) instance = new DrononomicsService();
  return instance;
}

export default DrononomicsService;
