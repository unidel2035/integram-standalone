/**
 * Token Event Ontology Service
 * Интеграция событийной онтологии (СОД) с потреблением AI токенов
 *
 * Создаёт в kval:
 * - Словарь "Токены и потребление AI"
 * - Свойства: Модель, Входящие токены, Исходящие токены, Стоимость, Приложение, Операция
 * - Концепт "Потребление AI токена"
 * - Индивиды — конкретные пользовательские сессии потребления
 * - Предметные события — каждый запрос к AI
 *
 * Связь с Integram (my):
 * - Таблица 198016 (AI токены) — баланс пользователя
 * - Таблица 198038 (Транзакции) — потребление (существующий логгер)
 * - Таблица 195686 (AI модели) — каталог моделей
 */

import { getEventEngineService } from './EventEngineService.js';
import logger from '../../utils/logger.js';

// Seed data constants
const VOCABULARY_NAME = 'Токены и потребление AI';
const CONCEPT_NAME = 'Потребление AI токена';
const ACTOR_NAME = 'AI-Платформа DronDoc';

const PROPERTIES = [
  { name: 'Модель AI', dataType: 'Text', description: 'Идентификатор AI модели (deepseek-chat, claude-sonnet-4.5 и др.)' },
  { name: 'Входящие токены', dataType: 'Number', description: 'Количество входящих (prompt) токенов' },
  { name: 'Исходящие токены', dataType: 'Number', description: 'Количество исходящих (completion) токенов' },
  { name: 'Стоимость (руб)', dataType: 'Number', description: 'Стоимость запроса в рублях' },
  { name: 'Приложение', dataType: 'Text', description: 'Источник запроса (Chat, MassEditor, Agent, API)' },
  { name: 'ID пользователя', dataType: 'Text', description: 'Integram ID пользователя (из my/18)' },
  { name: 'ID транзакции', dataType: 'Text', description: 'ID записи в таблице 198038' },
];

class TokenEventOntologyService {
  constructor() {
    this.initialized = false;
    this.seedData = null; // { vocabularyId, conceptId, modelId, actorId, propertyIds }
    this.eventQueue = []; // Queue for events created while initializing
    this._initPromise = null;
  }

  /**
   * Initialize: ensure seed data exists in СОД (kval)
   */
  async initialize() {
    if (this.initialized && this.seedData) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInit();
    try {
      await this._initPromise;
    } finally {
      this._initPromise = null;
    }
  }

  async _doInit() {
    try {
      const engine = getEventEngineService();
      await engine.initialize();

      // 1. Find or create vocabulary
      const vocabularies = await engine.getVocabularies();
      let vocab = vocabularies.find(v => v.val === VOCABULARY_NAME);
      if (!vocab) {
        logger.info('[TokenEventOntology] Creating vocabulary:', VOCABULARY_NAME);
        vocab = await engine.createVocabulary(VOCABULARY_NAME, 'Онтология потребления AI токенов пользователями платформы DronDoc');
      }
      const vocabularyId = vocab.id || vocab.obj;

      // 2. Find or create properties
      const existingProps = await engine.getProperties(vocabularyId);
      const propertyIds = {};
      for (const prop of PROPERTIES) {
        let existing = existingProps.find(p => p.val === prop.name);
        if (!existing) {
          logger.info('[TokenEventOntology] Creating property:', prop.name);
          existing = await engine.createProperty(prop.name, {
            propertyType: 'attribute',
            dataType: prop.dataType,
            vocabularyId,
          });
        }
        propertyIds[prop.name] = existing.id || existing.obj;
      }

      // 3. Find or create concept
      const concepts = await engine.getConcepts();
      let concept = concepts.find(c => c.val === CONCEPT_NAME);
      if (!concept) {
        logger.info('[TokenEventOntology] Creating concept:', CONCEPT_NAME);
        concept = await engine.createConcept(CONCEPT_NAME, 'Событие потребления AI токена: запрос к модели с учётом входящих/исходящих токенов и стоимости');
      }
      const conceptId = concept.id || concept.obj;

      // 4. Find the auto-created model for this concept
      const models = await engine.getModels();
      let model = models.find(m => m.val === `Model_${CONCEPT_NAME}`);
      const modelId = model?.id || model?.obj || null;

      // 5. Find or create platform actor
      const actors = await engine.getActors();
      let actor = actors.find(a => a.val === ACTOR_NAME);
      if (!actor) {
        logger.info('[TokenEventOntology] Creating actor:', ACTOR_NAME);
        actor = await engine.createActor(ACTOR_NAME, { type: 'agent', description: 'AI платформа DronDoc — маршрутизация запросов к моделям' });
      }
      const actorId = actor.id || actor.obj;

      this.seedData = { vocabularyId, conceptId, modelId, actorId, propertyIds };
      this.initialized = true;

      logger.info('[TokenEventOntology] Initialized', {
        vocabularyId,
        conceptId,
        modelId,
        actorId,
        properties: Object.keys(propertyIds).length,
      });

      // Process queued events
      if (this.eventQueue.length > 0) {
        logger.info(`[TokenEventOntology] Processing ${this.eventQueue.length} queued events`);
        const queue = [...this.eventQueue];
        this.eventQueue = [];
        for (const evt of queue) {
          try {
            await this.logTokenEvent(evt);
          } catch (err) {
            logger.warn('[TokenEventOntology] Failed to process queued event:', err.message);
          }
        }
      }
    } catch (error) {
      logger.error('[TokenEventOntology] Init failed:', error.message);
      // Don't throw — allow graceful degradation
    }
  }

  /**
   * Log token consumption as a subject event in СОД
   *
   * @param {Object} params
   * @param {string} params.userId - Integram user ID (my/18)
   * @param {string} params.model - AI model name
   * @param {number} params.promptTokens - Input tokens count
   * @param {number} params.completionTokens - Output tokens count
   * @param {number} params.cost - Cost in RUB
   * @param {string} [params.application] - Source app (Chat, Agent, etc.)
   * @param {string} [params.transactionId] - ID from table 198038
   * @returns {Promise<Object>} Created event or queued status
   */
  async logTokenEvent({ userId, model, promptTokens, completionTokens, cost, application, transactionId }) {
    // Queue if not initialized yet
    if (!this.initialized) {
      this.eventQueue.push({ userId, model, promptTokens, completionTokens, cost, application, transactionId });
      // Trigger lazy init
      this.initialize().catch(err => logger.warn('[TokenEventOntology] Lazy init error:', err.message));
      return { success: true, queued: true };
    }

    try {
      const engine = getEventEngineService();

      // Create subject event with token consumption data
      const totalTokens = (promptTokens || 0) + (completionTokens || 0);
      const eventName = `${model}: ${totalTokens} tok`;
      const value = JSON.stringify({
        model,
        promptTokens: promptTokens || 0,
        completionTokens: completionTokens || 0,
        cost: cost || 0,
        application: application || 'unknown',
        userId,
        transactionId: transactionId || null,
        timestamp: new Date().toISOString(),
      });

      const result = await engine.createSubjectEvent(eventName, {
        actorId: this.seedData.actorId,
        modelEventId: null, // No specific model event, this is a direct subject event
        individualId: null, // Could map to user individual in future
        value,
        timestamp: new Date().toISOString(),
      });

      logger.info('[TokenEventOntology] Event created', {
        eventId: result?.id,
        model,
        totalTokens,
        cost,
        userId,
      });

      return { success: true, eventId: result?.id || result?.obj };
    } catch (error) {
      logger.warn('[TokenEventOntology] Failed to log event:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get token consumption events from СОД
   * @param {Object} [filters] - { userId, model, fromDate, toDate, limit }
   */
  async getTokenEvents(filters = {}) {
    try {
      await this.initialize();
      if (!this.initialized) return [];

      const engine = getEventEngineService();
      const events = await engine.getSubjectEvents();

      // Filter to only token consumption events (by actor)
      let tokenEvents = events.filter(e => {
        const actorReq = e.reqs?.['Актор'];
        return actorReq && (
          String(actorReq.value) === String(this.seedData.actorId) ||
          actorReq.value === ACTOR_NAME
        );
      });

      // Parse values and apply filters
      tokenEvents = tokenEvents.map(e => {
        const causesData = engine.parseCausesData(e.reqs?.['Причины']?.value);
        let data = {};
        try {
          data = JSON.parse(e.reqs?.['Значение']?.value || '{}');
        } catch { /* ignore */ }

        return {
          id: e.id,
          name: e.val,
          ...data,
          eventTimestamp: causesData.timestamp || data.timestamp,
        };
      });

      // Apply user filter
      if (filters.userId) {
        tokenEvents = tokenEvents.filter(e => String(e.userId) === String(filters.userId));
      }

      // Apply model filter
      if (filters.model) {
        tokenEvents = tokenEvents.filter(e => e.model === filters.model);
      }

      // Apply date filters
      if (filters.fromDate) {
        const from = new Date(filters.fromDate);
        tokenEvents = tokenEvents.filter(e => new Date(e.eventTimestamp || e.timestamp) >= from);
      }
      if (filters.toDate) {
        const to = new Date(filters.toDate);
        tokenEvents = tokenEvents.filter(e => new Date(e.eventTimestamp || e.timestamp) <= to);
      }

      // Sort by timestamp desc
      tokenEvents.sort((a, b) => {
        const ta = new Date(a.eventTimestamp || a.timestamp || 0);
        const tb = new Date(b.eventTimestamp || b.timestamp || 0);
        return tb - ta;
      });

      // Apply limit
      if (filters.limit) {
        tokenEvents = tokenEvents.slice(0, filters.limit);
      }

      return tokenEvents;
    } catch (error) {
      logger.error('[TokenEventOntology] getTokenEvents error:', error.message);
      return [];
    }
  }

  /**
   * Get aggregated statistics from СОД events
   * @param {string} [userId] - Filter by user
   * @param {number} [days=30] - Period in days
   */
  async getTokenStats(userId, days = 30) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const events = await this.getTokenEvents({
      userId,
      fromDate: fromDate.toISOString(),
    });

    const stats = {
      totalEvents: events.length,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalCost: 0,
      byModel: {},
      byApplication: {},
      byDay: {},
    };

    for (const evt of events) {
      stats.totalPromptTokens += evt.promptTokens || 0;
      stats.totalCompletionTokens += evt.completionTokens || 0;
      stats.totalCost += evt.cost || 0;

      // By model
      const model = evt.model || 'unknown';
      if (!stats.byModel[model]) stats.byModel[model] = { count: 0, tokens: 0, cost: 0 };
      stats.byModel[model].count++;
      stats.byModel[model].tokens += (evt.promptTokens || 0) + (evt.completionTokens || 0);
      stats.byModel[model].cost += evt.cost || 0;

      // By application
      const app = evt.application || 'unknown';
      if (!stats.byApplication[app]) stats.byApplication[app] = { count: 0, tokens: 0, cost: 0 };
      stats.byApplication[app].count++;
      stats.byApplication[app].tokens += (evt.promptTokens || 0) + (evt.completionTokens || 0);
      stats.byApplication[app].cost += evt.cost || 0;

      // By day
      const day = (evt.eventTimestamp || evt.timestamp || '').substring(0, 10);
      if (day) {
        if (!stats.byDay[day]) stats.byDay[day] = { count: 0, tokens: 0, cost: 0 };
        stats.byDay[day].count++;
        stats.byDay[day].tokens += (evt.promptTokens || 0) + (evt.completionTokens || 0);
        stats.byDay[day].cost += evt.cost || 0;
      }
    }

    return stats;
  }
}

// Singleton
let instance = null;
export function getTokenEventOntologyService() {
  if (!instance) {
    instance = new TokenEventOntologyService();
  }
  return instance;
}

export default TokenEventOntologyService;
