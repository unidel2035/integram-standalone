/**
 * Drononomics Ontology Service (СОД)
 * Экономические шоки, каскады Леонтьева, рыночные события
 */

import { getEventEngineService } from './EventEngineService.js';
import logger from '../../utils/logger.js';

const VOCABULARY_NAME = 'Экономика БАС (Дронономика)';
const CONCEPTS = {
  shock: 'Шок спроса',
  cascade: 'Каскад Леонтьева',
  priceChange: 'Изменение рыночной цены',
  missionCompleted: 'Миссия завершена',
  factoryCreated: 'Завод создан',
  deficitAlert: 'Дефицит обнаружен',
};

const PROPERTIES = [
  { name: 'Сектор', dataType: 'Text' },
  { name: 'Величина (млн)', dataType: 'Number' },
  { name: 'Старая цена', dataType: 'Number' },
  { name: 'Новая цена', dataType: 'Number' },
  { name: 'Тип дрона', dataType: 'Text' },
  { name: 'Лётные часы', dataType: 'Number' },
  { name: 'Выручка', dataType: 'Number' },
  { name: 'Регион', dataType: 'Text' },
  { name: 'Мультипликатор', dataType: 'Number' },
];

class DrononomicsOntologyService {
  constructor() { this.initialized = false; this.seedData = null; this.eventQueue = []; this._initPromise = null; }

  async initialize() {
    if (this.initialized) return;
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit();
    try { await this._initPromise; } finally { this._initPromise = null; }
  }

  async _doInit() {
    try {
      const engine = getEventEngineService();
      await engine.initialize();
      const vocabs = await engine.getVocabularies();
      let vocab = vocabs.find(v => v.val === VOCABULARY_NAME);
      if (!vocab) vocab = await engine.createVocabulary(VOCABULARY_NAME, 'Онтология дронономики: шоки, каскады, рыночная динамика');
      const vocabularyId = vocab.id || vocab.obj;

      const existingProps = await engine.getProperties(vocabularyId);
      const propertyIds = {};
      for (const p of PROPERTIES) {
        let ex = existingProps.find(x => x.val === p.name);
        if (!ex) ex = await engine.createProperty(p.name, { propertyType: 'attribute', dataType: p.dataType, vocabularyId });
        propertyIds[p.name] = ex.id || ex.obj;
      }

      const concepts = await engine.getConcepts();
      const conceptIds = {};
      for (const [k, name] of Object.entries(CONCEPTS)) {
        let c = concepts.find(x => x.val === name);
        if (!c) c = await engine.createConcept(name, `Дронономика: ${name}`);
        conceptIds[k] = c.id || c.obj;
      }

      const actors = await engine.getActors();
      let actor = actors.find(a => a.val === 'Движок Дронономики');
      if (!actor) actor = await engine.createActor('Движок Дронономики', { type: 'agent', description: 'DrononomicsEngine — симуляция экономики БАС' });

      this.seedData = { vocabularyId, conceptIds, propertyIds, actorId: actor.id || actor.obj };
      this.initialized = true;
      logger.info('[DrononomicsOntology] Initialized', { vocabularyId });
      const queue = [...this.eventQueue]; this.eventQueue = [];
      for (const evt of queue) { try { await this._createEvent(evt); } catch {} }
    } catch (error) { logger.error('[DrononomicsOntology] Init failed:', error.message); }
  }

  async _createEvent(params) {
    const engine = getEventEngineService();
    const value = JSON.stringify({ ...params, timestamp: new Date().toISOString() });
    return engine.createSubjectEvent(params.name, { actorId: this.seedData.actorId, value, timestamp: new Date().toISOString() });
  }

  async logEvent(params) {
    if (!this.initialized) { this.eventQueue.push(params); this.initialize().catch(() => {}); return { success: true, queued: true }; }
    try { const r = await this._createEvent(params); return { success: true, eventId: r?.id }; }
    catch (e) { return { success: false, error: e.message }; }
  }

  async logShock(sector, amount, scenario) { return this.logEvent({ name: `Шок: ${sector} (${amount}М)`, action: 'shock', sector, amount, scenario }); }
  async logCascade(sector, multiplier) { return this.logEvent({ name: `Каскад: ${sector} x${multiplier}`, action: 'cascade', sector, multiplier }); }
  async logPriceChange(oldPrice, newPrice) { return this.logEvent({ name: `Цена: ${oldPrice} → ${newPrice}`, action: 'price_change', oldPrice, newPrice }); }
  async logMission(droneType, flightHours, revenue) { return this.logEvent({ name: `Миссия: ${droneType} ${flightHours}ч`, action: 'mission_completed', droneType, flightHours, revenue }); }
  async logFactory(name, region) { return this.logEvent({ name: `Завод: ${name}`, action: 'factory_created', factoryName: name, region }); }
  async logDeficit(sector, ratio) { return this.logEvent({ name: `Дефицит: ${sector} (${ratio})`, action: 'deficit_alert', sector, deficitRatio: ratio }); }

  async getEvents(filters = {}) {
    try {
      await this.initialize();
      if (!this.initialized) return [];
      const engine = getEventEngineService();
      const events = await engine.getSubjectEvents();
      let filtered = events.filter(e => {
        const a = e.reqs?.['Актор']; return a && (String(a.value) === String(this.seedData.actorId) || a.value === 'Движок Дронономики');
      }).map(e => { let d = {}; try { d = JSON.parse(e.reqs?.['Значение']?.value || '{}'); } catch {} return { id: e.id, name: e.val, ...d }; });
      if (filters.sector) filtered = filtered.filter(e => e.sector === filters.sector);
      if (filters.action) filtered = filtered.filter(e => e.action === filters.action);
      if (filters.limit) filtered = filtered.slice(0, filters.limit);
      return filtered;
    } catch { return []; }
  }
}

let instance = null;
export function getDrononomicsOntologyService() { if (!instance) instance = new DrononomicsOntologyService(); return instance; }
export default DrononomicsOntologyService;
