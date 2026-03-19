/**
 * Health Ontology Service (СОД)
 * Мониторинг здоровья: сервисы, circuit breaker, пороги, восстановление
 */

import { getEventEngineService } from './EventEngineService.js';
import logger from '../../utils/logger.js';

const VOCABULARY_NAME = 'Мониторинг здоровья';
const CONCEPTS = {
  serviceDown: 'Сервис упал',
  serviceRecovered: 'Сервис восстановлен',
  circuitBreakerOpen: 'Circuit Breaker открыт',
  circuitBreakerClosed: 'Circuit Breaker закрыт',
  thresholdExceeded: 'Порог превышен',
  healthCheck: 'Проверка здоровья',
};

const PROPERTIES = [
  { name: 'Имя сервиса', dataType: 'Text' },
  { name: 'Тип события', dataType: 'Text' },
  { name: 'Метрика', dataType: 'Text' },
  { name: 'Значение', dataType: 'Number' },
  { name: 'Порог', dataType: 'Number' },
  { name: 'Длительность простоя (с)', dataType: 'Number' },
  { name: 'Сообщение', dataType: 'Text' },
];

class HealthOntologyService {
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
      if (!vocab) vocab = await engine.createVocabulary(VOCABULARY_NAME, 'Онтология мониторинга: здоровье сервисов, circuit breaker, пороги');
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
        if (!c) c = await engine.createConcept(name, `Мониторинг: ${name}`);
        conceptIds[k] = c.id || c.obj;
      }

      const actors = await engine.getActors();
      let actor = actors.find(a => a.val === 'Система мониторинга');
      if (!actor) actor = await engine.createActor('Система мониторинга', { type: 'agent', description: 'Health Monitor + CircuitBreaker + Alerts' });

      this.seedData = { vocabularyId, conceptIds, propertyIds, actorId: actor.id || actor.obj };
      this.initialized = true;
      logger.info('[HealthOntology] Initialized', { vocabularyId });
      const queue = [...this.eventQueue]; this.eventQueue = [];
      for (const evt of queue) { try { await this._createEvent(evt); } catch {} }
    } catch (error) { logger.error('[HealthOntology] Init failed:', error.message); }
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

  async logServiceDown(serviceName, message) { return this.logEvent({ name: `Упал: ${serviceName}`, action: 'service_down', serviceName, message }); }
  async logServiceRecovered(serviceName, downtime) { return this.logEvent({ name: `Восстановлен: ${serviceName}`, action: 'service_recovered', serviceName, downtime }); }
  async logCircuitBreakerOpen(agentId) { return this.logEvent({ name: `CB открыт: ${agentId}`, action: 'circuit_breaker_open', serviceName: agentId }); }
  async logCircuitBreakerClosed(agentId) { return this.logEvent({ name: `CB закрыт: ${agentId}`, action: 'circuit_breaker_closed', serviceName: agentId }); }
  async logThresholdExceeded(metric, value, threshold) { return this.logEvent({ name: `Порог: ${metric} = ${value}`, action: 'threshold_exceeded', metric, value, threshold }); }
  async logHealthCheck(serviceName, status) { return this.logEvent({ name: `Здоровье: ${serviceName} → ${status}`, action: 'health_check', serviceName, status }); }

  async getEvents(filters = {}) {
    try {
      await this.initialize();
      if (!this.initialized) return [];
      const engine = getEventEngineService();
      const events = await engine.getSubjectEvents();
      let filtered = events.filter(e => {
        const a = e.reqs?.['Актор']; return a && (String(a.value) === String(this.seedData.actorId) || a.value === 'Система мониторинга');
      }).map(e => { let d = {}; try { d = JSON.parse(e.reqs?.['Значение']?.value || '{}'); } catch {} return { id: e.id, name: e.val, ...d }; });
      if (filters.serviceName) filtered = filtered.filter(e => e.serviceName === filters.serviceName);
      if (filters.action) filtered = filtered.filter(e => e.action === filters.action);
      if (filters.limit) filtered = filtered.slice(0, filters.limit);
      return filtered;
    } catch { return []; }
  }
}

let instance = null;
export function getHealthOntologyService() { if (!instance) instance = new HealthOntologyService(); return instance; }
export default HealthOntologyService;
