/**
 * Agent Lifecycle Ontology Service (СОД)
 * Логирование жизненного цикла агентов в событийную онтологию
 *
 * События: создание → развёртывание → выполнение → остановка, ошибки, задачи
 */

import { getEventEngineService } from './EventEngineService.js';
import logger from '../../utils/logger.js';

const VOCABULARY_NAME = 'Жизненный цикл агентов';
const CONCEPTS = {
  lifecycle: 'Жизненный цикл агента',
  task: 'Задача агента',
  error: 'Ошибка агента',
  communication: 'Межагентная коммуникация',
};

const PROPERTIES = [
  { name: 'ID агента', dataType: 'Text' },
  { name: 'Тип агента', dataType: 'Text' },
  { name: 'Действие', dataType: 'Text' },
  { name: 'Статус', dataType: 'Text' },
  { name: 'ID задачи', dataType: 'Text' },
  { name: 'Приоритет', dataType: 'Number' },
  { name: 'Длительность (мс)', dataType: 'Number' },
  { name: 'Сообщение ошибки', dataType: 'Text' },
];

class AgentLifecycleOntologyService {
  constructor() {
    this.initialized = false;
    this.seedData = null;
    this.eventQueue = [];
    this._initPromise = null;
  }

  async initialize() {
    if (this.initialized && this.seedData) return;
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit();
    try { await this._initPromise; } finally { this._initPromise = null; }
  }

  async _doInit() {
    try {
      const engine = getEventEngineService();
      await engine.initialize();

      const vocabularies = await engine.getVocabularies();
      let vocab = vocabularies.find(v => v.val === VOCABULARY_NAME);
      if (!vocab) vocab = await engine.createVocabulary(VOCABULARY_NAME, 'Онтология жизненного цикла AI-агентов: создание, выполнение, ошибки, задачи');
      const vocabularyId = vocab.id || vocab.obj;

      const existingProps = await engine.getProperties(vocabularyId);
      const propertyIds = {};
      for (const prop of PROPERTIES) {
        let existing = existingProps.find(p => p.val === prop.name);
        if (!existing) existing = await engine.createProperty(prop.name, { propertyType: 'attribute', dataType: prop.dataType, vocabularyId });
        propertyIds[prop.name] = existing.id || existing.obj;
      }

      const concepts = await engine.getConcepts();
      const conceptIds = {};
      for (const [key, name] of Object.entries(CONCEPTS)) {
        let c = concepts.find(x => x.val === name);
        if (!c) c = await engine.createConcept(name, `СОД концепт: ${name}`);
        conceptIds[key] = c.id || c.obj;
      }

      const actors = await engine.getActors();
      let actor = actors.find(a => a.val === 'Менеджер агентов');
      if (!actor) actor = await engine.createActor('Менеджер агентов', { type: 'agent', description: 'AgentManager — оркестрация и мониторинг агентов' });

      this.seedData = { vocabularyId, conceptIds, propertyIds, actorId: actor.id || actor.obj };
      this.initialized = true;
      logger.info('[AgentLifecycleOntology] Initialized', { vocabularyId, concepts: Object.keys(conceptIds).length });

      // Flush queue
      const queue = [...this.eventQueue]; this.eventQueue = [];
      for (const evt of queue) { try { await this._createEvent(evt); } catch (e) { logger.warn('[AgentLifecycleOntology] Queue flush error:', e.message); } }
    } catch (error) {
      logger.error('[AgentLifecycleOntology] Init failed:', error.message);
    }
  }

  async _createEvent({ name, action, agentId, agentType, status, taskId, priority, duration, errorMessage }) {
    const engine = getEventEngineService();
    const value = JSON.stringify({ action, agentId, agentType, status, taskId, priority, duration, errorMessage, timestamp: new Date().toISOString() });
    return engine.createSubjectEvent(name, { actorId: this.seedData.actorId, value, timestamp: new Date().toISOString() });
  }

  async logEvent(params) {
    if (!this.initialized) {
      this.eventQueue.push(params);
      this.initialize().catch(() => {});
      return { success: true, queued: true };
    }
    try {
      const result = await this._createEvent(params);
      return { success: true, eventId: result?.id };
    } catch (error) {
      logger.warn('[AgentLifecycleOntology] logEvent error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Convenience methods
  async logCreated(agentId, agentType) { return this.logEvent({ name: `Агент создан: ${agentId}`, action: 'created', agentId, agentType, status: 'created' }); }
  async logStarted(agentId, agentType) { return this.logEvent({ name: `Агент запущен: ${agentId}`, action: 'started', agentId, agentType, status: 'running' }); }
  async logStopped(agentId) { return this.logEvent({ name: `Агент остановлен: ${agentId}`, action: 'stopped', agentId, status: 'stopped' }); }
  async logError(agentId, errorMessage) { return this.logEvent({ name: `Ошибка: ${agentId}`, action: 'error', agentId, status: 'error', errorMessage }); }
  async logTaskAssigned(agentId, taskId, priority) { return this.logEvent({ name: `Задача: ${taskId} → ${agentId}`, action: 'task_assigned', agentId, taskId, priority }); }
  async logTaskCompleted(agentId, taskId, duration) { return this.logEvent({ name: `Задача выполнена: ${taskId}`, action: 'task_completed', agentId, taskId, duration, status: 'completed' }); }
  async logHealthCheck(agentId, status) { return this.logEvent({ name: `Здоровье: ${agentId} → ${status}`, action: 'health_check', agentId, status }); }

  async getEvents(filters = {}) {
    try {
      await this.initialize();
      if (!this.initialized) return [];
      const engine = getEventEngineService();
      const events = await engine.getSubjectEvents();
      let filtered = events.filter(e => {
        const actorReq = e.reqs?.['Актор'];
        return actorReq && (String(actorReq.value) === String(this.seedData.actorId) || actorReq.value === 'Менеджер агентов');
      }).map(e => {
        let data = {}; try { data = JSON.parse(e.reqs?.['Значение']?.value || '{}'); } catch {}
        return { id: e.id, name: e.val, ...data };
      });
      if (filters.agentId) filtered = filtered.filter(e => e.agentId === filters.agentId);
      if (filters.action) filtered = filtered.filter(e => e.action === filters.action);
      if (filters.limit) filtered = filtered.slice(0, filters.limit);
      return filtered;
    } catch { return []; }
  }
}

let instance = null;
export function getAgentLifecycleOntologyService() {
  if (!instance) instance = new AgentLifecycleOntologyService();
  return instance;
}
export default AgentLifecycleOntologyService;
