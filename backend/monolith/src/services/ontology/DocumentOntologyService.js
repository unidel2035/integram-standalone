/**
 * Document Ontology Service (СОД)
 * Документооборот: создание → редактирование → рецензия → публикация → архив
 */

import { getEventEngineService } from './EventEngineService.js';
import logger from '../../utils/logger.js';

const VOCABULARY_NAME = 'Документооборот';
const CONCEPTS = {
  created: 'Документ создан',
  edited: 'Редактирование документа',
  reviewed: 'Рецензия документа',
  published: 'Публикация документа',
  archived: 'Архивирование документа',
  massEdit: 'Массовое редактирование',
};

const PROPERTIES = [
  { name: 'ID документа', dataType: 'Text' },
  { name: 'Название документа', dataType: 'Text' },
  { name: 'ID пользователя', dataType: 'Text' },
  { name: 'Тип операции', dataType: 'Text' },
  { name: 'Блок/секция', dataType: 'Text' },
  { name: 'AI модель', dataType: 'Text' },
  { name: 'Кол-во документов', dataType: 'Number' },
];

class DocumentOntologyService {
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
      if (!vocab) vocab = await engine.createVocabulary(VOCABULARY_NAME, 'Онтология документооборота: жизненный цикл документов');
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
        if (!c) c = await engine.createConcept(name, `Этап документа: ${name}`);
        conceptIds[k] = c.id || c.obj;
      }

      const actors = await engine.getActors();
      let actor = actors.find(a => a.val === 'Документальная система');
      if (!actor) actor = await engine.createActor('Документальная система', { type: 'agent', description: 'Управление документами и блоками' });

      this.seedData = { vocabularyId, conceptIds, propertyIds, actorId: actor.id || actor.obj };
      this.initialized = true;
      logger.info('[DocumentOntology] Initialized', { vocabularyId });
      const queue = [...this.eventQueue]; this.eventQueue = [];
      for (const evt of queue) { try { await this._createEvent(evt); } catch {} }
    } catch (error) { logger.error('[DocumentOntology] Init failed:', error.message); }
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

  async logCreated(docId, title, userId) { return this.logEvent({ name: `Создан: ${title || docId}`, action: 'created', docId, title, userId }); }
  async logEdited(docId, title, userId, section) { return this.logEvent({ name: `Изменён: ${title || docId}`, action: 'edited', docId, title, userId, section }); }
  async logPublished(docId, title, userId) { return this.logEvent({ name: `Опубликован: ${title || docId}`, action: 'published', docId, title, userId }); }
  async logMassEdit(userId, count, model) { return this.logEvent({ name: `Массовое: ${count} док.`, action: 'mass_edit', userId, count, model }); }

  async getEvents(filters = {}) {
    try {
      await this.initialize();
      if (!this.initialized) return [];
      const engine = getEventEngineService();
      const events = await engine.getSubjectEvents();
      let filtered = events.filter(e => {
        const a = e.reqs?.['Актор']; return a && (String(a.value) === String(this.seedData.actorId) || a.value === 'Документальная система');
      }).map(e => { let d = {}; try { d = JSON.parse(e.reqs?.['Значение']?.value || '{}'); } catch {} return { id: e.id, name: e.val, ...d }; });
      if (filters.docId) filtered = filtered.filter(e => e.docId === filters.docId);
      if (filters.userId) filtered = filtered.filter(e => e.userId === filters.userId);
      if (filters.limit) filtered = filtered.slice(0, filters.limit);
      return filtered;
    } catch { return []; }
  }
}

let instance = null;
export function getDocumentOntologyService() { if (!instance) instance = new DocumentOntologyService(); return instance; }
export default DocumentOntologyService;
