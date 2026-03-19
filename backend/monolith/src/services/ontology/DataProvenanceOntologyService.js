/**
 * Data Provenance Ontology Service (СОД)
 * OSINT и внешние данные: импорт, парсинг, сопоставление, качество
 */

import { getEventEngineService } from './EventEngineService.js';
import logger from '../../utils/logger.js';

const VOCABULARY_NAME = 'Провенанс данных';
const CONCEPTS = {
  import: 'Импорт данных',
  parsing: 'Парсинг источника',
  matching: 'Сопоставление с онтологией',
  qualityCheck: 'Проверка качества',
  enrichment: 'Обогащение данных',
};

const PROPERTIES = [
  { name: 'Источник', dataType: 'Text' },
  { name: 'Тип данных', dataType: 'Text' },
  { name: 'Кол-во записей', dataType: 'Number' },
  { name: 'ИНН', dataType: 'Text' },
  { name: 'URL источника', dataType: 'Text' },
  { name: 'Качество (0-100)', dataType: 'Number' },
  { name: 'Статус', dataType: 'Text' },
];

class DataProvenanceOntologyService {
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
      if (!vocab) vocab = await engine.createVocabulary(VOCABULARY_NAME, 'Онтология провенанса: происхождение и качество внешних данных');
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
        if (!c) c = await engine.createConcept(name, `Провенанс: ${name}`);
        conceptIds[k] = c.id || c.obj;
      }

      const actors = await engine.getActors();
      let actor = actors.find(a => a.val === 'Парсер внешних данных');
      if (!actor) actor = await engine.createActor('Парсер внешних данных', { type: 'agent', description: 'OSINT, ЕГРЮЛ, торги, аналитика' });

      this.seedData = { vocabularyId, conceptIds, propertyIds, actorId: actor.id || actor.obj };
      this.initialized = true;
      logger.info('[DataProvenanceOntology] Initialized', { vocabularyId });
      const queue = [...this.eventQueue]; this.eventQueue = [];
      for (const evt of queue) { try { await this._createEvent(evt); } catch {} }
    } catch (error) { logger.error('[DataProvenanceOntology] Init failed:', error.message); }
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

  async logImport(source, dataType, count) { return this.logEvent({ name: `Импорт: ${source} (${count})`, action: 'import', source, dataType, count }); }
  async logParsing(source, url, count) { return this.logEvent({ name: `Парсинг: ${source}`, action: 'parsing', source, url, count }); }
  async logMatching(source, matched, total) { return this.logEvent({ name: `Сопоставление: ${matched}/${total}`, action: 'matching', source, matched, total, quality: Math.round(matched / total * 100) }); }
  async logEgrulImport(inn, recordCount) { return this.logEvent({ name: `ЕГРЮЛ: ${inn}`, action: 'egrul_import', source: 'egrul.itsoft.ru', inn, count: recordCount }); }
  async logOsintParsing(source, articles) { return this.logEvent({ name: `OSINT: ${source} (${articles})`, action: 'osint_parsing', source, count: articles }); }

  async getEvents(filters = {}) {
    try {
      await this.initialize();
      if (!this.initialized) return [];
      const engine = getEventEngineService();
      const events = await engine.getSubjectEvents();
      let filtered = events.filter(e => {
        const a = e.reqs?.['Актор']; return a && (String(a.value) === String(this.seedData.actorId) || a.value === 'Парсер внешних данных');
      }).map(e => { let d = {}; try { d = JSON.parse(e.reqs?.['Значение']?.value || '{}'); } catch {} return { id: e.id, name: e.val, ...d }; });
      if (filters.source) filtered = filtered.filter(e => e.source === filters.source);
      if (filters.action) filtered = filtered.filter(e => e.action === filters.action);
      if (filters.limit) filtered = filtered.slice(0, filters.limit);
      return filtered;
    } catch { return []; }
  }
}

let instance = null;
export function getDataProvenanceOntologyService() { if (!instance) instance = new DataProvenanceOntologyService(); return instance; }
export default DataProvenanceOntologyService;
