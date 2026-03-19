/**
 * Customer Journey Ontology Service (СОД)
 * Воронка продаж: лид → квалификация → предложение → сделка → удержание
 */

import { getEventEngineService } from './EventEngineService.js';
import logger from '../../utils/logger.js';

const VOCABULARY_NAME = 'Воронка продаж';
const CONCEPTS = {
  lead: 'Лид',
  qualification: 'Квалификация лида',
  proposal: 'Коммерческое предложение',
  deal: 'Сделка',
  retention: 'Удержание клиента',
  churn: 'Отказ клиента',
};

const PROPERTIES = [
  { name: 'ID лида', dataType: 'Text' },
  { name: 'Компания', dataType: 'Text' },
  { name: 'Источник', dataType: 'Text' },
  { name: 'Статус', dataType: 'Text' },
  { name: 'Прежний статус', dataType: 'Text' },
  { name: 'Оценка квалификации', dataType: 'Number' },
  { name: 'Сумма сделки', dataType: 'Number' },
  { name: 'Менеджер', dataType: 'Text' },
  { name: 'Причина отказа', dataType: 'Text' },
];

class CustomerJourneyOntologyService {
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
      if (!vocab) vocab = await engine.createVocabulary(VOCABULARY_NAME, 'Онтология воронки продаж: от лида до сделки');
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
        if (!c) c = await engine.createConcept(name, `Этап воронки: ${name}`);
        conceptIds[k] = c.id || c.obj;
      }

      const actors = await engine.getActors();
      let actor = actors.find(a => a.val === 'CRM DronDoc');
      if (!actor) actor = await engine.createActor('CRM DronDoc', { type: 'agent', description: 'CRM система — управление лидами и сделками' });

      this.seedData = { vocabularyId, conceptIds, propertyIds, actorId: actor.id || actor.obj };
      this.initialized = true;
      logger.info('[CustomerJourneyOntology] Initialized', { vocabularyId });
      const queue = [...this.eventQueue]; this.eventQueue = [];
      for (const evt of queue) { try { await this._createEvent(evt); } catch {} }
    } catch (error) { logger.error('[CustomerJourneyOntology] Init failed:', error.message); }
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

  async logLeadCreated(leadId, company, source) { return this.logEvent({ name: `Лид: ${company || leadId}`, action: 'lead_created', leadId, company, source, status: 'new' }); }
  async logStatusChange(leadId, oldStatus, newStatus, reason) { return this.logEvent({ name: `${oldStatus} → ${newStatus}: ${leadId}`, action: 'status_change', leadId, oldStatus, newStatus, reason, status: newStatus }); }
  async logQualified(leadId, score) { return this.logEvent({ name: `Квалифицирован: ${leadId} (${score})`, action: 'qualified', leadId, score, status: 'qualified' }); }
  async logDealClosed(leadId, amount) { return this.logEvent({ name: `Сделка: ${leadId} (${amount}₽)`, action: 'deal_closed', leadId, amount, status: 'converted' }); }
  async logChurn(leadId, reason) { return this.logEvent({ name: `Отказ: ${leadId}`, action: 'churn', leadId, reason, status: 'lost' }); }
  async logAssigned(leadId, managerId, managerName) { return this.logEvent({ name: `Назначен: ${leadId} → ${managerName}`, action: 'assigned', leadId, managerId, managerName }); }

  async getEvents(filters = {}) {
    try {
      await this.initialize();
      if (!this.initialized) return [];
      const engine = getEventEngineService();
      const events = await engine.getSubjectEvents();
      let filtered = events.filter(e => {
        const a = e.reqs?.['Актор']; return a && (String(a.value) === String(this.seedData.actorId) || a.value === 'CRM DronDoc');
      }).map(e => { let d = {}; try { d = JSON.parse(e.reqs?.['Значение']?.value || '{}'); } catch {} return { id: e.id, name: e.val, ...d }; });
      if (filters.leadId) filtered = filtered.filter(e => e.leadId === filters.leadId);
      if (filters.status) filtered = filtered.filter(e => e.status === filters.status);
      if (filters.limit) filtered = filtered.slice(0, filters.limit);
      return filtered;
    } catch { return []; }
  }

  async getFunnelStats() {
    const events = await this.getEvents({});
    const funnel = { new: 0, qualified: 0, contacted: 0, converted: 0, lost: 0, disqualified: 0 };
    for (const e of events) { if (e.status && funnel[e.status] !== undefined) funnel[e.status]++; }
    return funnel;
  }
}

let instance = null;
export function getCustomerJourneyOntologyService() { if (!instance) instance = new CustomerJourneyOntologyService(); return instance; }
export default CustomerJourneyOntologyService;
