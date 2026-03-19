/**
 * Security Ontology Service (СОД)
 * Аудит безопасности: входы, выходы, ошибки аутентификации, блокировки
 */

import { getEventEngineService } from './EventEngineService.js';
import logger from '../../utils/logger.js';

const VOCABULARY_NAME = 'Безопасность и аутентификация';
const CONCEPTS = {
  login: 'Вход в систему',
  logout: 'Выход из системы',
  failedAttempt: 'Неудачная попытка входа',
  tokenCreated: 'Токен создан',
  sessionExpired: 'Сессия истекла',
  ipBlocked: 'IP заблокирован',
};

const PROPERTIES = [
  { name: 'ID пользователя', dataType: 'Text' },
  { name: 'Логин', dataType: 'Text' },
  { name: 'IP адрес', dataType: 'Text' },
  { name: 'Метод авторизации', dataType: 'Text' },
  { name: 'База данных', dataType: 'Text' },
  { name: 'User-Agent', dataType: 'Text' },
  { name: 'Причина отказа', dataType: 'Text' },
  { name: 'Результат', dataType: 'Text' },
];

class SecurityOntologyService {
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
      if (!vocab) vocab = await engine.createVocabulary(VOCABULARY_NAME, 'Онтология безопасности: аудит входов, сессий, блокировок');
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
        if (!c) c = await engine.createConcept(name, `Событие безопасности: ${name}`);
        conceptIds[k] = c.id || c.obj;
      }

      const actors = await engine.getActors();
      let actor = actors.find(a => a.val === 'Система безопасности');
      if (!actor) actor = await engine.createActor('Система безопасности', { type: 'agent', description: 'Auth + Session + Rate Limiter' });

      this.seedData = { vocabularyId, conceptIds, propertyIds, actorId: actor.id || actor.obj };
      this.initialized = true;
      logger.info('[SecurityOntology] Initialized', { vocabularyId });
      const queue = [...this.eventQueue]; this.eventQueue = [];
      for (const evt of queue) { try { await this._createEvent(evt); } catch {} }
    } catch (error) { logger.error('[SecurityOntology] Init failed:', error.message); }
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

  async logLogin(userId, login, ip, method, database) { return this.logEvent({ name: `Вход: ${login}`, action: 'login', userId, login, ip, method, database, result: 'success' }); }
  async logLogout(userId, login) { return this.logEvent({ name: `Выход: ${login}`, action: 'logout', userId, login, result: 'success' }); }
  async logFailedLogin(login, ip, reason) { return this.logEvent({ name: `Ошибка входа: ${login}`, action: 'failed_login', login, ip, reason, result: 'failure' }); }
  async logTokenCreated(userId, tokenType) { return this.logEvent({ name: `Токен создан: ${userId}`, action: 'token_created', userId, tokenType }); }
  async logRateLimited(ip, path) { return this.logEvent({ name: `Rate limit: ${ip}`, action: 'rate_limited', ip, path, result: 'blocked' }); }

  async getEvents(filters = {}) {
    try {
      await this.initialize();
      if (!this.initialized) return [];
      const engine = getEventEngineService();
      const events = await engine.getSubjectEvents();
      let filtered = events.filter(e => {
        const a = e.reqs?.['Актор']; return a && (String(a.value) === String(this.seedData.actorId) || a.value === 'Система безопасности');
      }).map(e => { let d = {}; try { d = JSON.parse(e.reqs?.['Значение']?.value || '{}'); } catch {} return { id: e.id, name: e.val, ...d }; });
      if (filters.userId) filtered = filtered.filter(e => e.userId === filters.userId);
      if (filters.action) filtered = filtered.filter(e => e.action === filters.action);
      if (filters.ip) filtered = filtered.filter(e => e.ip === filters.ip);
      if (filters.limit) filtered = filtered.slice(0, filters.limit);
      return filtered;
    } catch { return []; }
  }
}

let instance = null;
export function getSecurityOntologyService() { if (!instance) instance = new SecurityOntologyService(); return instance; }
export default SecurityOntologyService;
