/**
 * EcosystemEventService — Persistence layer for ecosystemStore via Event Engine (СОД)
 *
 * Saves/loads 12 value-chain actors, 22 flows, and simulation snapshots
 * through the event ontology engine (СОД) in kval database.
 *
 * Singleton pattern matching EventEngineService.js.
 *
 * @module services/ontology/EcosystemEventService
 */

import { getEventEngineService } from './EventEngineService.js';
import logger from '../../utils/logger.js';

// ── Seed data definitions ─────────────────────────────────────────

const VOCAB_NAME = 'Экосистема БАС';

const VOCAB_PROPERTIES = [
  { name: 'Сектор',       dataType: 'Text',   desc: 'Актор' },
  { name: 'Выручка',      dataType: 'Number', desc: 'Актор' },
  { name: 'EBITDA',        dataType: 'Number', desc: 'Актор' },
  { name: 'Маржа',        dataType: 'Number', desc: 'Актор' },
  { name: 'Порядок',      dataType: 'Number', desc: 'Актор' },
  { name: 'Цвет',         dataType: 'Text',   desc: 'Актор' },
  { name: 'Источник',     dataType: 'Text',   desc: 'Поток' },
  { name: 'Получатель',   dataType: 'Text',   desc: 'Поток' },
  { name: 'Продукт',      dataType: 'Text',   desc: 'Поток' },
  { name: 'Объём',        dataType: 'Number', desc: 'Поток' },
  { name: 'Бизнес-модель', dataType: 'Text',   desc: 'Актор' },
  { name: 'Тик',          dataType: 'Number', desc: 'Снимок' },
  { name: 'JSON_данные',  dataType: 'Text',   desc: 'Снимок' },
];

const CONCEPT_NAMES = [
  'Актор цепочки ценности',
  'Поток ценности',
  'Снимок симуляции',
];

// Individual definitions: "localId:displayName"
const ACTOR_INDIVIDUALS = [
  { localId: 'components',       name: 'Производитель компонентов',      sector: 'manuf',   order: 1,  revenue: 250, ebitda: 45,  margin: 18, color: '#4A90D9' },
  { localId: 'manufacturer',     name: 'Производитель БАС',              sector: 'manuf',   order: 2,  revenue: 520, ebitda: 78,  margin: 15, color: '#2E86C1' },
  { localId: 'infrastructure',   name: 'Инфраструктура',                 sector: 'constr',  order: 3,  revenue: 180, ebitda: 36,  margin: 20, color: '#E67E22' },
  { localId: 'datacenter',       name: 'ИИ Дата-центры',                 sector: 'it',      order: 4,  revenue: 280, ebitda: 84,  margin: 30, color: '#1ABC9C' },
  { localId: 'operator',         name: 'Оператор БАС',                   sector: 'bas',     order: 5,  revenue: 350, ebitda: 70,  margin: 20, color: '#27AE60' },
  { localId: 'data-processing',  name: 'Обработка данных',               sector: 'it',      order: 6,  revenue: 420, ebitda: 126, margin: 30, color: '#8E44AD' },
  { localId: 'engineering',      name: 'DevOps-инжиниринг',              sector: 'it',      order: 7,  revenue: 340, ebitda: 88,  margin: 26, color: '#E91E63' },
  { localId: 'customer',         name: 'Заказчик',                       sector: 'agri',    order: 8,  revenue: 600, ebitda: 90,  margin: 15, color: '#F39C12' },
  { localId: 'finance',          name: 'Страхование и финансы',           sector: 'finance', order: 9,  revenue: 150, ebitda: 45,  margin: 30, color: '#C0392B' },
  { localId: 'government',       name: 'Государство (госпрограммы)',     sector: 'gov',     order: 10, revenue: 0,   ebitda: 0,   margin: 0,  color: '#5C6BC0' },
  { localId: 'university',       name: 'Университет (НИР)',              sector: 'gov',     order: 11, revenue: 0,   ebitda: 0,   margin: 0,  color: '#7E57C2' },
  { localId: 'npc',              name: 'НПЦ (региональный)',             sector: 'gov',     order: 12, revenue: 45,  ebitda: 5,   margin: 11, color: '#26A69A' },
];

const FLOW_INDIVIDUALS = [
  { localId: 'f1',  name: 'Двигатели, камеры, платы',               source: 'components',      target: 'manufacturer',     volume: 180 },
  { localId: 'f2',  name: 'Готовые БАС',                            source: 'manufacturer',    target: 'operator',         volume: 450 },
  { localId: 'f3',  name: 'Инфра-сервис (ПП, РЛС)',                 source: 'infrastructure',  target: 'operator',         volume: 120 },
  { localId: 'f4',  name: 'Сырые данные миссий',                    source: 'operator',        target: 'datacenter',       volume: 280 },
  { localId: 'f5',  name: 'ИИ-обработка: NDVI, 3D, тепло',         source: 'datacenter',      target: 'data-processing',  volume: 250 },
  { localId: 'f6',  name: 'Аналитика, ML-модели, дашборды',         source: 'data-processing', target: 'engineering',      volume: 200 },
  { localId: 'f7',  name: 'Трансформация бизнеса, ИИ-агенты',      source: 'engineering',     target: 'customer',         volume: 380 },
  { localId: 'f8',  name: 'Данные рисков, заказы',                  source: 'customer',        target: 'finance',          volume: 80 },
  { localId: 'f9',  name: 'Лизинг, страховые продукты',             source: 'finance',         target: 'manufacturer',     volume: 60 },
  { localId: 'f10', name: 'Страхование ответственности',            source: 'finance',         target: 'operator',         volume: 40 },
  { localId: 'f11', name: 'GPU-мощности для ИИ-агентов',            source: 'datacenter',      target: 'engineering',      volume: 160 },
  { localId: 'f12', name: 'Автоматизация полётных операций',        source: 'engineering',     target: 'operator',         volume: 90 },
  { localId: 'f13', name: 'Субсидии на компонентную базу',          source: 'government',      target: 'components',       volume: 40 },
  { localId: 'f14', name: 'Субсидии на производство БАС',           source: 'government',      target: 'manufacturer',     volume: 80 },
  { localId: 'f15', name: 'Субсидии на инфраструктуру',             source: 'government',      target: 'infrastructure',   volume: 60 },
  { localId: 'f16', name: 'Субсидии на эксплуатацию',               source: 'government',      target: 'operator',         volume: 35 },
  { localId: 'f17', name: 'Грантовое финансирование НИР',           source: 'government',      target: 'university',       volume: 55 },
  { localId: 'f18', name: 'Федеральный бюджет НПЦ',                 source: 'government',      target: 'npc',              volume: 70 },
  { localId: 'f19', name: 'Заказы НИР',                             source: 'engineering',     target: 'university',       volume: 30 },
  { localId: 'f20', name: 'Результаты НИР, кадры',                  source: 'university',      target: 'engineering',      volume: 25 },
  { localId: 'f21', name: 'Содействие, агентские услуги',           source: 'npc',             target: 'operator',         volume: 20 },
  { localId: 'f22', name: 'Налоги, обратная связь',                 source: 'customer',        target: 'government',       volume: 50 },
];

// Model event constraint definitions
const ACTOR_MODEL_EVENTS = [
  { prop: 'Сектор',  constraints: { immutable: true,  required: true } },
  { prop: 'Порядок', constraints: { required: true } },
  { prop: 'Выручка', constraints: { required: true } },
  { prop: 'EBITDA',  constraints: {} },
  { prop: 'Маржа',   constraints: {} },
  { prop: 'Цвет',    constraints: { immutable: true } },
];

const FLOW_MODEL_EVENTS = [
  { prop: 'Источник',   constraints: { immutable: true, required: true } },
  { prop: 'Получатель', constraints: { immutable: true, required: true } },
  { prop: 'Продукт',    constraints: {} },
  { prop: 'Объём',      constraints: { required: true } },
];

const SNAPSHOT_MODEL_EVENTS = [
  { prop: 'Тик',         constraints: { required: true } },
  { prop: 'JSON_данные', constraints: { required: true } },
];


class EcosystemEventService {
  constructor() {
    this._engine = null;
    this._seeded = false;

    // Cached IDs after seed/discovery
    this._conceptIds = {};      // conceptName → id
    this._modelIds = {};        // conceptName → modelId
    this._propertyIds = {};     // propName → id
    this._modelEventIds = {};   // "conceptName:propName" → modelEventId
    this._individualIds = {};   // localId → individualId
    this._vocabId = null;
  }

  async getEngine() {
    if (!this._engine) {
      this._engine = getEventEngineService();
      await this._engine.initialize();
    }
    return this._engine;
  }

  // ─── Seed ───────────────────────────────────────────────────────

  async seed() {
    const engine = await this.getEngine();
    logger.info('[EcosystemEvents] Starting seed...');

    // 1. Create vocabulary (if not exists)
    const vocabs = await engine.getVocabularies();
    let vocab = vocabs.find(v => v.val === VOCAB_NAME);
    if (!vocab) {
      const result = await engine.createVocabulary(VOCAB_NAME, 'Свойства экосистемы цепочки ценности БАС');
      this._vocabId = result?.id || result?.obj;
      logger.info('[EcosystemEvents] Created vocabulary', { id: this._vocabId });
    } else {
      this._vocabId = vocab.id;
      logger.info('[EcosystemEvents] Vocabulary exists', { id: this._vocabId });
    }

    // 2. Create properties
    const existingProps = await engine.getProperties(this._vocabId);
    for (const propDef of VOCAB_PROPERTIES) {
      const existing = existingProps.find(p => p.val === propDef.name);
      if (existing) {
        this._propertyIds[propDef.name] = existing.id;
      } else {
        const result = await engine.createProperty(propDef.name, {
          propertyType: 'attribute',
          dataType: propDef.dataType,
          vocabularyId: this._vocabId,
        });
        this._propertyIds[propDef.name] = result?.id || result?.obj;
        logger.info('[EcosystemEvents] Created property', { name: propDef.name, id: this._propertyIds[propDef.name] });
      }
    }

    // 3. Create concepts (each auto-creates Model_X)
    const existingConcepts = await engine.getConcepts();
    for (const conceptName of CONCEPT_NAMES) {
      const existing = existingConcepts.find(c => c.val === conceptName);
      if (existing) {
        this._conceptIds[conceptName] = existing.id;
      } else {
        const result = await engine.createConcept(conceptName, `Экосистема БАС — ${conceptName}`);
        this._conceptIds[conceptName] = result?.id || result?.obj;
        logger.info('[EcosystemEvents] Created concept', { name: conceptName, id: this._conceptIds[conceptName] });
      }
    }

    // 4. Discover models (auto-created by createConcept)
    const allModels = await engine.getModels();
    for (const conceptName of CONCEPT_NAMES) {
      const conceptId = this._conceptIds[conceptName];
      const model = allModels.find(m => {
        const cReq = m.reqs['Концепт'];
        return cReq && String(cReq.value) === String(conceptId);
      }) || allModels.find(m => m.val === `Model_${conceptName}`);
      if (model) {
        this._modelIds[conceptName] = model.id;
        logger.info('[EcosystemEvents] Found model', { concept: conceptName, modelId: model.id });
      }
    }

    // 5. Create model events (property + constraints per concept model)
    await this._seedModelEvents(engine, 'Актор цепочки ценности', ACTOR_MODEL_EVENTS);
    await this._seedModelEvents(engine, 'Поток ценности', FLOW_MODEL_EVENTS);
    await this._seedModelEvents(engine, 'Снимок симуляции', SNAPSHOT_MODEL_EVENTS);

    // 6. Create individuals
    await this._seedIndividuals(engine, 'Актор цепочки ценности', ACTOR_INDIVIDUALS);
    await this._seedIndividuals(engine, 'Поток ценности', FLOW_INDIVIDUALS);
    // Snapshot individual
    await this._seedIndividuals(engine, 'Снимок симуляции', [
      { localId: 'sim_snapshot', name: 'Текущая симуляция' },
    ]);

    // 7. Create initial subject events for actors
    await this._seedActorEvents(engine);
    await this._seedFlowEvents(engine);

    this._seeded = true;
    const stats = {
      vocabulary: this._vocabId,
      properties: Object.keys(this._propertyIds).length,
      concepts: Object.keys(this._conceptIds).length,
      models: Object.keys(this._modelIds).length,
      modelEvents: Object.keys(this._modelEventIds).length,
      individuals: Object.keys(this._individualIds).length,
    };
    logger.info('[EcosystemEvents] Seed complete', stats);
    return stats;
  }

  async _seedModelEvents(engine, conceptName, eventDefs) {
    const modelId = this._modelIds[conceptName];
    if (!modelId) {
      logger.warn('[EcosystemEvents] No model for concept', { conceptName });
      return;
    }

    const existingEvents = await engine.getModelEvents(modelId);
    for (let i = 0; i < eventDefs.length; i++) {
      const def = eventDefs[i];
      const propId = this._propertyIds[def.prop];
      if (!propId) {
        logger.warn('[EcosystemEvents] Property not found', { prop: def.prop });
        continue;
      }

      const key = `${conceptName}:${def.prop}`;
      // Check if already exists (match by property ref)
      const existing = existingEvents.find(e => {
        const pReq = e.reqs['Свойство'];
        return pReq && String(pReq.value) === String(propId);
      });

      if (existing) {
        this._modelEventIds[key] = existing.id;
      } else {
        const result = await engine.createModelEvent(`${def.prop}`, {
          modelId,
          propertyId: propId,
          order: i + 1,
          constraints: def.constraints,
        });
        this._modelEventIds[key] = result?.id || result?.obj;
        logger.info('[EcosystemEvents] Created model event', { key, id: this._modelEventIds[key] });
      }
    }
  }

  async _seedIndividuals(engine, conceptName, defs) {
    const conceptId = this._conceptIds[conceptName];
    const modelId = this._modelIds[conceptName];
    if (!conceptId) return;

    const existingIndividuals = await engine.getIndividuals(conceptId);
    for (const def of defs) {
      const fullName = `${def.localId}:${def.name}`;
      const existing = existingIndividuals.find(i => i.val === fullName || i.val.startsWith(`${def.localId}:`));
      if (existing) {
        this._individualIds[def.localId] = existing.id;
      } else {
        const result = await engine.createIndividual(fullName, {
          conceptId,
          modelId,
        });
        this._individualIds[def.localId] = result?.id || result?.obj;
        logger.info('[EcosystemEvents] Created individual', { localId: def.localId, id: this._individualIds[def.localId] });
      }
    }
  }

  async _seedActorEvents(engine) {
    for (const actor of ACTOR_INDIVIDUALS) {
      const indId = this._individualIds[actor.localId];
      if (!indId) continue;

      // Check if events already exist for this individual
      const existing = await engine.getSubjectEvents(indId);
      if (existing.length > 0) {
        logger.info('[EcosystemEvents] Actor events exist', { localId: actor.localId, count: existing.length });
        continue;
      }

      const metrics = {
        'Сектор': actor.sector,
        'Порядок': String(actor.order),
        'Выручка': String(actor.revenue),
        'EBITDA': String(actor.ebitda),
        'Маржа': String(actor.margin),
        'Цвет': actor.color,
      };

      for (const [propName, value] of Object.entries(metrics)) {
        const meKey = `Актор цепочки ценности:${propName}`;
        const meId = this._modelEventIds[meKey];
        if (!meId) continue;

        await engine.createSubjectEvent(`${actor.localId}:${propName}`, {
          individualId: indId,
          modelEventId: meId,
          value: String(value),
        });
      }
      logger.info('[EcosystemEvents] Seeded actor events', { localId: actor.localId });
    }
  }

  async _seedFlowEvents(engine) {
    for (const flow of FLOW_INDIVIDUALS) {
      const indId = this._individualIds[flow.localId];
      if (!indId) continue;

      const existing = await engine.getSubjectEvents(indId);
      if (existing.length > 0) {
        logger.info('[EcosystemEvents] Flow events exist', { localId: flow.localId, count: existing.length });
        continue;
      }

      const metrics = {
        'Источник': flow.source,
        'Получатель': flow.target,
        'Продукт': flow.name,
        'Объём': String(flow.volume),
      };

      for (const [propName, value] of Object.entries(metrics)) {
        const meKey = `Поток ценности:${propName}`;
        const meId = this._modelEventIds[meKey];
        if (!meId) continue;

        await engine.createSubjectEvent(`${flow.localId}:${propName}`, {
          individualId: indId,
          modelEventId: meId,
          value: String(value),
        });
      }
      logger.info('[EcosystemEvents] Seeded flow events', { localId: flow.localId });
    }
  }

  // ─── Discovery (find existing IDs without seeding) ──────────────

  async _discover() {
    if (this._seeded || Object.keys(this._individualIds).length > 0) return;

    const engine = await this.getEngine();

    // Find concepts
    const concepts = await engine.getConcepts();
    for (const name of CONCEPT_NAMES) {
      const c = concepts.find(x => x.val === name);
      if (c) this._conceptIds[name] = c.id;
    }

    // Find models
    const models = await engine.getModels();
    for (const name of CONCEPT_NAMES) {
      const cid = this._conceptIds[name];
      if (!cid) continue;
      const m = models.find(x => {
        const cReq = x.reqs['Концепт'];
        return cReq && String(cReq.value) === String(cid);
      });
      if (m) this._modelIds[name] = m.id;
    }

    // Find vocabulary and properties
    const vocabs = await engine.getVocabularies();
    const vocab = vocabs.find(v => v.val === VOCAB_NAME);
    if (vocab) {
      this._vocabId = vocab.id;
      const props = await engine.getProperties(this._vocabId);
      for (const p of props) {
        this._propertyIds[p.val] = p.id;
      }
    }

    // Find model events
    for (const conceptName of CONCEPT_NAMES) {
      const modelId = this._modelIds[conceptName];
      if (!modelId) continue;
      const events = await engine.getModelEvents(modelId);
      for (const e of events) {
        const propReq = e.reqs['Свойство'];
        if (!propReq) continue;
        // Find property name by ID
        const propName = Object.entries(this._propertyIds).find(([, id]) => String(id) === String(propReq.value))?.[0];
        if (propName) {
          this._modelEventIds[`${conceptName}:${propName}`] = e.id;
        }
      }
    }

    // Find individuals
    const actorConceptId = this._conceptIds['Актор цепочки ценности'];
    if (actorConceptId) {
      const individuals = await engine.getIndividuals(actorConceptId);
      for (const ind of individuals) {
        const localId = ind.val.split(':')[0];
        if (localId) this._individualIds[localId] = ind.id;
      }
    }

    const flowConceptId = this._conceptIds['Поток ценности'];
    if (flowConceptId) {
      const individuals = await engine.getIndividuals(flowConceptId);
      for (const ind of individuals) {
        const localId = ind.val.split(':')[0];
        if (localId) this._individualIds[localId] = ind.id;
      }
    }

    const snapConceptId = this._conceptIds['Снимок симуляции'];
    if (snapConceptId) {
      const individuals = await engine.getIndividuals(snapConceptId);
      for (const ind of individuals) {
        const localId = ind.val.split(':')[0];
        if (localId) this._individualIds[localId] = ind.id;
      }
    }

    logger.info('[EcosystemEvents] Discovery complete', {
      concepts: Object.keys(this._conceptIds).length,
      individuals: Object.keys(this._individualIds).length,
      modelEvents: Object.keys(this._modelEventIds).length,
    });
  }

  // ─── Load ───────────────────────────────────────────────────────

  async loadActors() {
    const engine = await this.getEngine();
    await this._discover();

    const conceptId = this._conceptIds['Актор цепочки ценности'];
    if (!conceptId) return [];

    const individuals = await engine.getIndividuals(conceptId);
    const actors = [];

    for (const ind of individuals) {
      const localId = ind.val.split(':')[0];
      const displayName = ind.val.split(':').slice(1).join(':');

      // Get latest events for this individual
      const events = await engine.getSubjectEvents(ind.id);

      // Build metrics from latest events (last event per model event wins)
      const metrics = {};
      for (const ev of events) {
        const evName = ev.val;
        const propName = evName.split(':').slice(1).join(':') || evName;
        metrics[propName] = ev.reqs['Значение']?.value || ev.reqs['Значение']?.displayValue || '';
      }

      actors.push({
        id: localId,
        name: displayName,
        sector: metrics['Сектор'] || '',
        revenue: Number(metrics['Выручка']) || 0,
        ebitda: Number(metrics['EBITDA']) || 0,
        margin: Number(metrics['Маржа']) || 0,
        order: Number(metrics['Порядок']) || 0,
        color: metrics['Цвет'] || '#666',
        _individualId: ind.id,
      });
    }

    actors.sort((a, b) => a.order - b.order);
    return actors;
  }

  async loadFlows() {
    const engine = await this.getEngine();
    await this._discover();

    const conceptId = this._conceptIds['Поток ценности'];
    if (!conceptId) return [];

    const individuals = await engine.getIndividuals(conceptId);
    const flows = [];

    for (const ind of individuals) {
      const localId = ind.val.split(':')[0];
      const displayName = ind.val.split(':').slice(1).join(':');

      const events = await engine.getSubjectEvents(ind.id);
      const metrics = {};
      for (const ev of events) {
        const propName = ev.val.split(':').slice(1).join(':') || ev.val;
        metrics[propName] = ev.reqs['Значение']?.value || ev.reqs['Значение']?.displayValue || '';
      }

      flows.push({
        id: localId,
        source: metrics['Источник'] || '',
        target: metrics['Получатель'] || '',
        product: metrics['Продукт'] || displayName,
        volume: Number(metrics['Объём']) || 0,
        _individualId: ind.id,
      });
    }

    return flows;
  }

  async loadLatestSnapshot() {
    const engine = await this.getEngine();
    await this._discover();

    const indId = this._individualIds['sim_snapshot'];
    if (!indId) return null;

    const events = await engine.getSubjectEvents(indId);
    if (!events.length) return null;

    // Find latest by timestamp or just last
    let latest = events[events.length - 1];
    for (const ev of events) {
      const ts = ev.reqs['Временная метка']?.value;
      const latestTs = latest.reqs['Временная метка']?.value;
      if (ts && latestTs && Number(ts) > Number(latestTs)) {
        latest = ev;
      }
    }

    const jsonStr = latest.reqs['Значение']?.value || latest.reqs['Значение']?.displayValue || '';
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }

  async loadFullState() {
    const [actors, flows, snapshot] = await Promise.all([
      this.loadActors(),
      this.loadFlows(),
      this.loadLatestSnapshot(),
    ]);
    return { actors, flows, snapshot };
  }

  // ─── Save ───────────────────────────────────────────────────────

  async saveActorMetrics(localId, metrics) {
    const engine = await this.getEngine();
    await this._discover();

    const indId = this._individualIds[localId];
    if (!indId) {
      logger.warn('[EcosystemEvents] Actor individual not found', { localId });
      return null;
    }

    const results = [];
    const metricMap = {
      revenue: 'Выручка',
      ebitda: 'EBITDA',
      margin: 'Маржа',
    };

    for (const [key, propName] of Object.entries(metricMap)) {
      if (metrics[key] === undefined) continue;
      const meKey = `Актор цепочки ценности:${propName}`;
      const meId = this._modelEventIds[meKey];
      if (!meId) continue;

      const result = await engine.createSubjectEvent(`${localId}:${propName}`, {
        individualId: indId,
        modelEventId: meId,
        value: String(metrics[key]),
      });
      results.push(result);
    }

    return results;
  }

  async saveFlowVolume(localId, volume) {
    const engine = await this.getEngine();
    await this._discover();

    const indId = this._individualIds[localId];
    if (!indId) {
      logger.warn('[EcosystemEvents] Flow individual not found', { localId });
      return null;
    }

    const meKey = 'Поток ценности:Объём';
    const meId = this._modelEventIds[meKey];
    if (!meId) return null;

    return engine.createSubjectEvent(`${localId}:Объём`, {
      individualId: indId,
      modelEventId: meId,
      value: String(volume),
    });
  }

  async saveSimulationSnapshot(data) {
    const engine = await this.getEngine();
    await this._discover();

    const indId = this._individualIds['sim_snapshot'];
    if (!indId) {
      logger.warn('[EcosystemEvents] Snapshot individual not found');
      return null;
    }

    const meKey = 'Снимок симуляции:JSON_данные';
    const meId = this._modelEventIds[meKey];
    if (!meId) return null;

    const jsonStr = JSON.stringify(data);
    return engine.createSubjectEvent('sim_snapshot:JSON_данные', {
      individualId: indId,
      modelEventId: meId,
      value: jsonStr,
    });
  }
}

// ── Singleton ──────────────────────────────────────────────────────

let instance = null;

export function getEcosystemEventService() {
  if (!instance) instance = new EcosystemEventService();
  return instance;
}

export default EcosystemEventService;
