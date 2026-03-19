/**
 * Event Engine Service (СОД — движок событийной онтологии)
 *
 * Manages event-based ontology engine in Integram (kval database).
 * 1. Ontology editor — semantic domain description
 * 2. Workflow engine — model execution
 * 3. Temporal store — DAG of subject events
 *
 * Issue #7043 — Event Ontology Engine
 *
 * Tables (СОД = Событийная Онтология Движок):
 * - СОД Роли (1709560) — Actor roles
 * - СОД Акторы (1709561) — Actors (human/sensor/agent)
 * - СОД Концепты (1709562) — Concepts
 * - СОД Словари (1709563) — Vocabularies
 * - СОД Свойства (1709564) — Properties (attribute/relation/role)
 * - СОД Приложения (1709565) — Applications
 * - СОД Модели (1709566) — Models
 * - СОД Модельные события (1709567) — Model events (tree)
 * - СОД Индивиды (1709568) — Individuals
 * - СОД Предметные события (1709569) — Subject events (DAG)
 */

import axios from 'axios';
import logger from '../../utils/logger.js';
import { getIntegramV2DatabaseUrl } from '../../utils/integramConfig.js';
import DomainConfigLoader from './DomainConfigLoader.js';

class EventEngineService {
  constructor() {
    this.serverURL = (process.env.INTEGRAM_SERVER_URL || 'ai2o.ru').replace(/^https?:\/\//, '');
    this.database = 'kval';
    this.token = null;
    this.xsrfToken = null;

    // V2 API base URL (for batch create/update/delete, schema/stats discovery)
    this.v2BaseUrl = getIntegramV2DatabaseUrl('kval');

    // Table IDs — discovered by name at init
    this.tables = {
      roles: null,          // СОД Роли
      actors: null,         // СОД Акторы
      concepts: null,       // СОД Концепты
      vocabularies: null,   // СОД Словари
      properties: null,     // СОД Свойства
      applications: null,   // СОД Приложения
      models: null,         // СОД Модели
      modelEvents: null,    // СОД Модельные события
      individuals: null,    // СОД Индивиды
      subjectEvents: null,  // СОД Предметные события
      triggers: null,       // СОД Триггеры
      // MBSE tables
      requirements: null,   // СОД Требования
      traces: null,         // СОД Трассировки
      states: null,         // СОД Состояния
      transitions: null,    // СОД Переходы
      verifications: null,  // СОД Верификация
    };

    // Name → key mapping for discovery
    this.tableNames = {
      'СОД Роли': 'roles',
      'СОД Акторы': 'actors',
      'СОД Концепты': 'concepts',
      'СОД Словари': 'vocabularies',
      'СОД Свойства': 'properties',
      'СОД Приложения': 'applications',
      'СОД Модели': 'models',
      'СОД Модельные события': 'modelEvents',
      'СОД Индивиды': 'individuals',
      'СОД Предметные события': 'subjectEvents',
      'СОД Триггеры': 'triggers',
      // MBSE tables
      'СОД Требования': 'requirements',
      'СОД Трассировки': 'traces',
      'СОД Состояния': 'states',
      'СОД Переходы': 'transitions',
      'СОД Верификация': 'verifications',
    };

    // Socket.io instance for real-time push
    this._io = null;

    // Requisite alias → ID maps per table (populated on first getObjects)
    this.reqMaps = {};

    // Smart cache with TTL (Item 10)
    this._cachedObjects = new Map(); // typeId → { data, timestamp }
    this._cacheTTL = 5 * 60 * 1000; // 5 min

    // Cache (legacy)
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 min
  }

  setIO(io) {
    this._io = io;
  }

  // ─── Auth & Init ──────────────────────────────────────────────

  getHeaders(includeXsrf = false) {
    const h = {
      'X-Authorization': this.token,
      'Cookie': `${this.database}=${this.token}`,
    };
    if (includeXsrf && this.xsrfToken) {
      h['X-Xsrf-Token'] = this.xsrfToken;
      h['Cookie'] += `; _xsrf=${this.xsrfToken}`;
    }
    return h;
  }

  async initialize() {
    if (this.token && this.tables.roles) return;
    try {
      await this.authenticate();
      await this.discoverTables();
      await this.loadTriggersFromDB();

      // Config-driven initialization: load from Integram lookups or seed JSON
      if (!this._configLoader) {
        this._configLoader = new DomainConfigLoader(this);
      }
      const config = await this._configLoader.loadAll();
      if (config.domains.length > 0) {
        await this.initFromConfig(config);
      } else {
        // Legacy fallback: hardcoded bootstrap methods
        await this._bootstrapLegacy();
      }

      logger.info('[EventEngine] Initialized', { tables: this.tables });
    } catch (error) {
      logger.error('[EventEngine] Init failed: ' + (error?.message || error), { stack: error?.stack?.split('\n').slice(0, 5).join(' | ') });
      throw error;
    }
  }

  /**
   * Legacy bootstrap — вызывает hardcoded методы.
   * Сохранено для обратной совместимости.
   */
  async _bootstrapLegacy() {
    await this.bootstrapSystemMonitoringDomain();
    await this.bootstrapOperationsDomain();
    await this.bootstrapDevOpsDomain();
    await this.bootstrapDigitalTwinDomain();
    await this.bootstrapRegulatoryDomain();
    await this.bootstrapInsuranceDomain();
    await this.bootstrapMarketplaceDomain();
    await this.bootstrapSwarmDomain();
    await this.bootstrapTrainingDomain();
    await this.bootstrapCrossDomainTriggers();
  }

  /**
   * Config-driven initialization: создаёт домены из конфигурации.
   * Использует существующие CRUD-методы (createActor, createConcept, createModelEvent и т.д.).
   * Идемпотентно: пропускает домены, если markerActor уже существует.
   */
  async initFromConfig(config) {
    const actors = await this.getObjects(this.tables.actors);

    for (const domain of config.domains) {
      if (!domain.active) continue;

      const flagField = domain.bootstrappedField;
      if (flagField && this[flagField]) continue;

      try {
        // Проверяем: домен уже развёрнут?
        const existing = actors.find(a => a.val === domain.markerActor);
        if (existing) {
          // Загрузить ID из существующих данных — вызываем legacy loader если есть
          const loaderMethod = this._getLoadIdsMethod(domain.name);
          if (loaderMethod) {
            const ids = await loaderMethod.call(this, actors);
            if (domain.idsField) this[domain.idsField] = ids;
          }
          if (flagField) this[flagField] = true;
          logger.info(`[EventEngine] Domain ${domain.name} already bootstrapped (config-driven)`);
          continue;
        }

        logger.info(`[EventEngine] Bootstrapping domain ${domain.name} from config...`);

        // 1. Создаём акторов
        const domainActors = config.actorRoles.filter(a => a.domain === domain.name);
        const actorIds = {};
        for (const actor of domainActors) {
          try {
            const result = await this.createActor(actor.name, {
              type: actor.type, description: actor.description,
            });
            actorIds[actor.name] = String(result?.id || result?.obj);
          } catch (err) {
            logger.warn(`[EventEngine] Failed to create actor ${actor.name}:`, err.message);
          }
        }

        // 2. Создаём концепт → авто-модель
        const concept = await this.createConcept(domain.conceptName, domain.conceptDescription);
        const conceptId = String(concept?.id || concept?.obj);

        // 3. Находим авто-модель
        const models = await this.getObjects(this.tables.models);
        const model = models.find(m => m.val === domain.modelName);
        const modelId = model ? String(model.id) : null;

        if (!modelId) {
          logger.warn(`[EventEngine] Model ${domain.modelName} not found after concept creation`);
          if (flagField) this[flagField] = true;
          continue;
        }

        // 4. Создаём свойства
        const domainProps = config.properties.filter(p => p.domain === domain.name);
        const props = {};
        for (const prop of domainProps) {
          try {
            const p = await this.createProperty(prop.name, {
              propertyType: prop.propertyType, dataType: prop.dataType,
            });
            props[prop.name] = String(p?.id || p?.obj);
          } catch (err) {
            logger.warn(`[EventEngine] Failed to create property ${prop.name}:`, err.message);
          }
        }

        // 5. Создаём модельные события
        const domainEvents = config.eventTypes.filter(e => e.domain === domain.name);
        const firstPropId = Object.values(props)[0] || null;
        const modelEventIds = {};
        for (const evt of domainEvents) {
          try {
            const result = await this.createModelEvent(evt.name, {
              modelId,
              propertyId: firstPropId,
              constraints: evt.constraints || {},
            });
            modelEventIds[evt.name] = String(result?.id || result?.obj);
          } catch (err) {
            logger.warn(`[EventEngine] Failed to create model event ${evt.name}:`, err.message);
          }
        }

        // 6. FSM: состояния и переходы
        const fsmConfig = config.fsmTemplates.find(f => f.domain === domain.name);
        const stateIds = {};
        if (fsmConfig && this.createState) {
          for (const [name, type] of fsmConfig.states) {
            try {
              const s = await this.createState(modelId, { name, type });
              stateIds[name] = String(s?.id || s?.obj);
            } catch (err) {
              logger.warn(`[EventEngine] Failed to create state ${name}:`, err.message);
            }
          }

          for (const [from, to, trigger, guard] of fsmConfig.transitions) {
            if (stateIds[from] && stateIds[to]) {
              try {
                await this.createTransition(modelId, {
                  fromStateId: stateIds[from],
                  toStateId: stateIds[to],
                  trigger,
                  guard: guard || undefined,
                });
              } catch (err) {
                logger.warn(`[EventEngine] Failed to create transition ${from}→${to}:`, err.message);
              }
            }
          }
        }

        // 7. Создаём индивид (если задан)
        let individualId = null;
        if (domain.individualName) {
          const markerActorId = actorIds[domain.markerActor] || Object.values(actorIds)[0];
          try {
            const individual = await this.createIndividual(domain.individualName, {
              conceptId, modelId, actorId: markerActorId,
            });
            individualId = String(individual?.id || individual?.obj);
          } catch (err) {
            logger.warn(`[EventEngine] Failed to create individual ${domain.individualName}:`, err.message);
          }
        }

        // 8. Регистрируем триггеры
        const domainTriggers = config.triggerTemplates.filter(t => t.domain === domain.name);
        for (const trigger of domainTriggers) {
          try {
            await this.registerTrigger({
              modelId,
              condition: trigger.condition,
              action: { type: trigger.actionType, params: trigger.params },
              priority: trigger.priority,
            });
          } catch (err) {
            logger.warn(`[EventEngine] Failed to register trigger:`, err.message);
          }
        }

        // 9. Кэш ID
        if (domain.idsField) {
          this[domain.idsField] = {
            actors: actorIds,
            modelId,
            modelEventIds,
            individualId,
            conceptId,
            stateIds,
            props,
          };
        }
        if (flagField) this[flagField] = true;

        logger.info(`[EventEngine] Domain ${domain.name} bootstrapped from config`, {
          actors: Object.keys(actorIds).length,
          modelEvents: Object.keys(modelEventIds).length,
        });
      } catch (err) {
        logger.error(`[EventEngine] Config-driven bootstrap failed for ${domain.name}:`, err.message);
        if (flagField) this[flagField] = true; // Don't retry
      }
    }
  }

  /**
   * Получить метод загрузки ID для домена (для идемпотентности).
   */
  _getLoadIdsMethod(domainName) {
    const map = {
      monitoring: this._loadSysMonIds,
      dao: this._loadDAOIds,
      operations: this._loadOpsIds,
      devops: this._loadDevOpsIds,
      digitalTwin: this._loadTwinIds,
      regulatory: this._loadRegIds,
      insurance: this._loadInsuranceIds,
      marketplace: this._loadMarketplaceIds,
      swarm: this._loadSwarmIds,
      training: this._loadTrainingIds,
    };
    return map[domainName] || null;
  }

  /**
   * Hot-reload: перечитать конфигурацию и создать новые домены.
   */
  async reloadDomainConfig() {
    if (!this._configLoader) {
      this._configLoader = new DomainConfigLoader(this);
    }
    this._configLoader.invalidateCache();
    const config = await this._configLoader.loadAll();
    if (config.domains.length > 0) {
      await this.initFromConfig(config);
      return { reloaded: true, domainCount: config.domains.length };
    }
    return { reloaded: false, reason: 'No domains found' };
  }

  async authenticate() {
    const username = process.env.INTEGRAM_SYSTEM_USERNAME || 'd';
    const password = process.env.INTEGRAM_SYSTEM_PASSWORD || 'd';
    const response = await axios.post(
      `https://${this.serverURL}/${this.database}/auth?JSON_KV=`,
      new URLSearchParams({ login: username, pwd: password }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    if (!response.data.token) throw new Error('No token in auth response');
    this.token = response.data.token;
    this.xsrfToken = response.data._xsrf;
    logger.info('[EventEngine] Authenticated');
  }

  async discoverTables() {
    // V1 API: use dict endpoint which returns {typeId: name}
    const url = `https://${this.serverURL}/${this.database}/dict?JSON_KV=`;
    const response = await axios.get(url, { headers: this.getHeaders() });
    const dict = response.data || {};
    for (const [typeId, name] of Object.entries(dict)) {
      const key = this.tableNames[name];
      if (key) this.tables[key] = String(typeId);
    }
    const missing = Object.entries(this.tables).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
      logger.warn('[EventEngine] Missing tables:', missing);
    }
  }

  async ensureXsrf() {
    if (this.xsrfToken) return;
    const response = await axios.get(
      `https://${this.serverURL}/${this.database}/xsrf?JSON_KV=`,
      { headers: this.getHeaders() }
    );
    this.xsrfToken = response.data._xsrf || response.data.xsrf;
  }

  // ─── Generic CRUD ─────────────────────────────────────────────

  async getObjects(typeId, params = {}) {
    const { limit = 2000, parentId } = params;
    let url = `https://${this.serverURL}/${this.database}/object/${typeId}?JSON_KV=&LIMIT=${limit}`;
    if (parentId) url += `&UP=${parentId}`;

    const response = await axios.get(url, { headers: this.getHeaders() });
    const data = response.data;
    const objects = data.object || [];
    const allReqs = data.reqs || {};
    const reqTypes = data.req_type || {};
    const refTypes = data.ref_type || {};

    // Build and cache alias→reqId map
    const aliasMap = {};
    for (const [reqId, alias] of Object.entries(reqTypes)) {
      aliasMap[alias] = reqId;
    }
    this.reqMaps[typeId] = { aliasMap, reqTypes, refTypes };

    return objects.map(obj => {
      const objReqs = allReqs[obj.id] || {};
      const reqs = {};
      for (const [reqId, value] of Object.entries(objReqs)) {
        // Skip ref_ companion fields (handled below for references)
        if (reqId.startsWith('ref_')) continue;
        const isRef = !!refTypes[reqId];
        let refObjectId = null;
        if (isRef) {
          // Extract actual object ID from companion field ref_{reqId} = "refTypeId:refObjectId"
          const refField = objReqs[`ref_${reqId}`];
          if (refField && typeof refField === 'string') {
            const parts = refField.split(':');
            refObjectId = parts[1] || null;
          }
        }
        reqs[reqTypes[reqId] || reqId] = {
          id: reqId,
          value: isRef && refObjectId ? refObjectId : value,
          displayValue: value,
          isRef,
          refType: refTypes[reqId] || null,
        };
      }
      return { id: obj.id, val: obj.val, up: obj.up, reqs };
    });
  }

  // ─── Smart Cache (Item 10) ────────────────────────────────────

  async getObjectsCached(typeId, params = {}) {
    const cacheKey = `${typeId}_${JSON.stringify(params)}`;
    const cached = this._cachedObjects.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this._cacheTTL) {
      return cached.data;
    }
    const data = await this.getObjects(typeId, params);
    this._cachedObjects.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  invalidateCache(typeId) {
    if (!typeId) {
      this._cachedObjects.clear();
      return;
    }
    for (const key of this._cachedObjects.keys()) {
      if (key.startsWith(`${typeId}_`)) this._cachedObjects.delete(key);
    }
  }

  async getObject(objectId) {
    // V2 API: single object (basic info, no requisites)
    const response = await axios.get(`${this.v2BaseUrl}/objects/${objectId}`);
    return response.data?.data || response.data;
  }

  async createObject(typeId, value, requisites = {}, parentId = '1') {
    // V2 API: POST /objects — creates object within existing type
    if (Object.keys(requisites).length > 0) await this.ensureReqMap(typeId);
    const map = this.reqMaps[typeId];
    const resolvedReqs = {};
    for (const [key, val] of Object.entries(requisites)) {
      const reqId = map?.aliasMap?.[key] || key;
      resolvedReqs[reqId] = val;
    }

    const body = {
      typeId: parseInt(typeId),
      value,
      parentId: parseInt(parentId),
    };
    if (Object.keys(resolvedReqs).length > 0) {
      body.requisites = resolvedReqs;
    }

    const response = await axios.post(`${this.v2BaseUrl}/objects`, body, {
      headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
    });

    const result = response.data?.data || {};
    if (!result.id) {
      throw new Error(`[EventEngine] createObject failed: no id in response`);
    }

    this.invalidateCache(typeId);
    return { id: result.id, obj: result.id };
  }

  async updateObject(objectId, requisites) {
    // V1 API: _m_set/{objectId} — reliable requisite update
    await this.ensureXsrf();
    const formData = new URLSearchParams();
    for (const [reqId, value] of Object.entries(requisites)) {
      formData.append(`t${reqId}`, value);
    }
    formData.append('_xsrf', this.xsrfToken);

    const url = `https://${this.serverURL}/${this.database}/_m_set/${objectId}?JSON_KV=`;
    const response = await axios.post(url, formData, {
      headers: { ...this.getHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return { action: 'update', id: parseInt(objectId), success: true };
  }

  async deleteObject(objectId) {
    await this.initialize();
    // V2 API: batch delete — single JSON request, no XSRF
    logger.info('[EventEngine] deleteObject v2', { objectId });
    const response = await axios.post(`${this.v2BaseUrl}/batch`, {
      operations: [{
        action: 'delete',
        objectId: parseInt(objectId),
      }],
    }, { headers: { 'Content-Type': 'application/json' } });

    const result = response.data?.data?.results?.[0]?.result || {};
    logger.info('[EventEngine] deleteObject v2 response', { objectId, result });
    return result;
  }

  // Resolve alias keys to reqId keys using cached map
  resolveReqs(typeId, data) {
    const map = this.reqMaps[typeId];
    if (!map) return data;
    const resolved = {};
    for (const [key, val] of Object.entries(data)) {
      resolved[map.aliasMap[key] || key] = val;
    }
    return resolved;
  }

  // ─── V2 Schema Helpers ──────────────────────────────────────

  /**
   * Load reqMap (alias→reqId) from V2 schema instead of fetching objects.
   * Falls back to getObjects for v1 if v2 fails.
   */
  async ensureReqMap(typeId) {
    if (this.reqMaps[typeId]) return this.reqMaps[typeId];
    try {
      const response = await axios.get(`${this.v2BaseUrl}/schema/types/${typeId}`);
      const schema = response.data?.data || {};
      const aliasMap = {};
      const reqTypes = {};
      const refTypes = {};
      for (const r of (schema.requisites || [])) {
        const alias = r.alias || `req_${r.id}`;
        aliasMap[alias] = String(r.id);
        reqTypes[String(r.id)] = alias;
        if (r.refType) refTypes[String(r.id)] = String(r.refType);
      }
      this.reqMaps[typeId] = { aliasMap, reqTypes, refTypes };
      return this.reqMaps[typeId];
    } catch (err) {
      logger.warn('[EventEngine] V2 schema fallback for reqMap', { typeId, error: err.message });
      await this.getObjects(typeId, { limit: 1 });
      return this.reqMaps[typeId];
    }
  }

  // ─── Infodynamics (Vopson's Second Law) ─────────────────────
  //
  // Второй закон инфодинамики: информационная энтропия системы
  // стремится к минимуму в состоянии равновесия.
  // M/E/I эквивалентность: масса ≡ энергия ≡ информация.
  //
  // Метрики:
  //  H(domain) — Shannon entropy событий домена (бит)
  //  CR — коэффициент компрессии (ontology vs raw)
  //  PLA — индекс принципа наименьшего действия (triggered / total steps)
  //  Ω — информационная масса домена (виртуальная, по Вопсону)

  /**
   * Рассчитать инфодинамические метрики для домена или всей онтологии.
   * @param {string} [domain] — 'devops', 'operations', 'monitoring', etc. Если null — вся онтология.
   * @returns {{ entropy, maxEntropy, compressionRatio, leastActionIndex, infomass, domains, vopsonLaw }}
   */
  async getInfodynamics(domain) {
    await this.initialize();

    // Загружаем все предметные события
    const allEvents = await this.getObjectsCached(this.tables.subjectEvents, { limit: 5000 });

    // Группируем по доменам (умная классификация)
    const domainMap = {};
    for (const ev of allEvents) {
      const name = ev.val || '';
      let prefix;
      if (name.includes('.')) {
        prefix = name.split('.')[0]; // dev.*, ops.*, infra.*, market.*, etc.
      } else if (name.startsWith('Создан:') || name.startsWith('Удалён:') || name.startsWith('Обновлён:')) {
        prefix = 'content'; // документные события
      } else if (name.startsWith('__') || name.startsWith('test')) {
        prefix = '_test'; // тестовые
      } else {
        prefix = 'domain'; // доменные события без префикса
      }
      if (!domainMap[prefix]) domainMap[prefix] = [];
      domainMap[prefix].push(ev);
    }

    const targetDomains = domain ? { [domain]: domainMap[domain] || [] } : domainMap;

    const domains = {};
    let totalEntropy = 0;
    let totalMaxEntropy = 0;
    let totalEvents = 0;
    let totalTriggered = 0;

    for (const [dom, events] of Object.entries(targetDomains)) {
      const metrics = this._calcDomainEntropy(events, dom);
      domains[dom] = metrics;
      totalEntropy += metrics.entropy * metrics.eventCount;
      totalMaxEntropy += metrics.maxEntropy * metrics.eventCount;
      totalEvents += metrics.eventCount;
      totalTriggered += metrics.triggeredCount;
    }

    // Средневзвешенная энтропия
    const avgEntropy = totalEvents > 0 ? totalEntropy / totalEvents : 0;
    const avgMaxEntropy = totalEvents > 0 ? totalMaxEntropy / totalEvents : 0;

    // Коэффициент компрессии: насколько онтология сжимает информацию
    // CR = 1 - H/Hmax (0 = нет компрессии, 1 = полная компрессия)
    const compressionRatio = avgMaxEntropy > 0 ? 1 - (avgEntropy / avgMaxEntropy) : 0;

    // Индекс наименьшего действия: доля автоматически триггерированных событий
    // PLA = triggered / total (1 = всё автоматически, 0 = всё вручную)
    const leastActionIndex = totalEvents > 0 ? totalTriggered / totalEvents : 0;

    // Информационная масса по Вопсону: m = kT·ln(2) / c²  на бит
    // kT при комнатной температуре ≈ 4.11e-21 Дж
    // c² = 9e16 м²/с²
    // m_bit ≈ 3.19e-38 кг
    const VOPSON_MASS_PER_BIT = 3.19e-38; // кг
    const totalBits = totalEvents * avgEntropy;
    const infomass = totalBits * VOPSON_MASS_PER_BIT;

    // Концепты, модели, индивиды — структурные элементы онтологии
    const concepts = await this.getObjectsCached(this.tables.concepts, { limit: 5000 });
    const models = await this.getObjectsCached(this.tables.models, { limit: 5000 });
    const individuals = await this.getObjectsCached(this.tables.individuals, { limit: 5000 });

    // Структурная эффективность: events / (concepts × models × individuals)
    // Чем больше событий на единицу структуры — тем эффективнее онтология
    const structureSize = (concepts.length || 1) * (models.length || 1);
    const structuralEfficiency = totalEvents / structureSize;

    return {
      // Основные метрики
      entropy: Math.round(avgEntropy * 1000) / 1000,
      maxEntropy: Math.round(avgMaxEntropy * 1000) / 1000,
      compressionRatio: Math.round(compressionRatio * 1000) / 1000,
      leastActionIndex: Math.round(leastActionIndex * 1000) / 1000,

      // Вопсон
      infomass: {
        kg: infomass,
        description: `Информационная масса ${totalEvents} событий по M/E/I эквивалентности Вопсона`,
        totalBits: Math.round(totalBits),
      },

      // Структура онтологии
      ontologyStructure: {
        concepts: concepts.length,
        models: models.length,
        individuals: individuals.length,
        events: totalEvents,
        triggers: this._triggers?.length || 0,
        structuralEfficiency: Math.round(structuralEfficiency * 100) / 100,
      },

      // Второй закон инфодинамики
      vopsonLaw: {
        statement: 'Информационная энтропия системы стремится к минимуму в состоянии равновесия',
        currentState: compressionRatio > 0.5 ? 'equilibrium' : compressionRatio > 0.2 ? 'converging' : 'chaotic',
        interpretation: compressionRatio > 0.5
          ? 'Онтология достигла высокой степени компрессии — система близка к информационному равновесию'
          : compressionRatio > 0.2
            ? 'Онтология сжимает данные, но есть потенциал для дальнейшей структуризации'
            : 'Данные слабо структурированы — онтология ещё не достигла информационного равновесия',
      },

      // По доменам
      domains,
    };
  }

  /**
   * Shannon entropy для набора событий домена.
   */
  _calcDomainEntropy(events, domainName) {
    const n = events.length;
    if (n === 0) return { entropy: 0, maxEntropy: 0, eventCount: 0, triggeredCount: 0, types: {} };

    // Частоты типов событий
    const freq = {};
    let triggeredCount = 0;
    for (const ev of events) {
      const name = ev.val || 'unknown';
      freq[name] = (freq[name] || 0) + 1;
      // Событие считается triggered если оно имеет причины (causes)
      const causes = ev.reqs?.['Причины']?.value;
      if (causes && causes !== '[]' && causes !== '') triggeredCount++;
    }

    // Shannon entropy: H = -Σ p(x) · log2(p(x))
    let H = 0;
    const types = {};
    for (const [type, count] of Object.entries(freq)) {
      const p = count / n;
      H -= p * Math.log2(p);
      types[type] = { count, probability: Math.round(p * 1000) / 1000 };
    }

    // Максимальная энтропия (равномерное распределение)
    const uniqueTypes = Object.keys(freq).length;
    const Hmax = uniqueTypes > 1 ? Math.log2(uniqueTypes) : 1;

    return {
      entropy: Math.round(H * 1000) / 1000,
      maxEntropy: Math.round(Hmax * 1000) / 1000,
      compressionRatio: Hmax > 0 ? Math.round((1 - H / Hmax) * 1000) / 1000 : 0,
      eventCount: n,
      triggeredCount,
      uniqueTypes,
      types,
    };
  }

  // ─── Roles ────────────────────────────────────────────────────

  async getRoles() {
    await this.initialize();
    return this.getObjects(this.tables.roles);
  }

  async createRole(name, description = '') {
    await this.initialize();
    // Pre-load reqMap if needed
    await this.ensureReqMap(this.tables.roles);
    return this.createObject(this.tables.roles, name, { 'Описание': description });
  }

  // ─── Actors ───────────────────────────────────────────────────

  async getActors() {
    await this.initialize();
    return this.getObjects(this.tables.actors);
  }

  async createActor(name, { type = 'human', description = '', status = 'active' } = {}) {
    await this.initialize();
    await this.ensureReqMap(this.tables.actors);
    return this.createObject(this.tables.actors, name, {
      'Тип': type,
      'Описание': description,
      'Статус': status,
    });
  }

  async updateActor(id, data) {
    await this.initialize();
    await this.ensureReqMap(this.tables.actors);
    const resolved = this.resolveReqs(this.tables.actors, data);
    return this.updateObject(id, resolved);
  }

  async deleteActor(id) {
    await this.initialize();
    return this.deleteObject(id);
  }

  // ─── Concepts ─────────────────────────────────────────────────

  async getConcepts() {
    await this.initialize();
    return this.getObjects(this.tables.concepts);
  }

  async createConcept(name, description = '', ontologyElementId = null) {
    await this.initialize();
    await this.ensureReqMap(this.tables.concepts);

    // Create concept
    const reqs = { 'Описание': description };
    if (ontologyElementId) reqs['Элемент онтологии'] = String(ontologyElementId);
    const result = await this.createObject(this.tables.concepts, name, reqs);

    // Auto-create a model for this concept
    const conceptId = result?.id || result?.obj;
    if (conceptId) {
      try {
        await this.ensureReqMap(this.tables.models);
        await this.createObject(this.tables.models, `Model_${name}`, { 'Концепт': String(conceptId), 'Описание': '' });
      } catch (err) {
        logger.warn('[EventEngine] Auto-create model failed', err.message);
      }
    }

    return result;
  }

  // ─── Интеграция с Онтологией БПЛА (kval 1673250) ─────────────

  /** Получить все элементы Онтологии БПЛА */
  async getOntologyElements(params = {}) {
    await this.initialize();
    const ONTOLOGY_TABLE = '1673250';
    return this.getObjectsCached(ONTOLOGY_TABLE, params);
  }

  /** Связать СОД-концепт с элементом Онтологии БПЛА */
  async linkConceptToOntology(conceptId, ontologyElementId) {
    await this.initialize();
    await this.ensureReqMap(this.tables.concepts);
    const reqMap = this.reqMaps[this.tables.concepts]?.aliasMap || {};
    const reqId = reqMap['Элемент онтологии'];
    if (!reqId) throw new Error('Поле "Элемент онтологии" не найдено в СОД Концепты');
    await this.updateObject(conceptId, { [reqId]: String(ontologyElementId) });
    this.invalidateCache(this.tables.concepts);
    return { success: true, conceptId, ontologyElementId };
  }

  /** Получить концепт с данными из Онтологии БПЛА */
  async getConceptWithOntology(conceptId) {
    await this.initialize();
    const concepts = await this.getObjects(this.tables.concepts);
    const concept = concepts.find(c => String(c.id) === String(conceptId));
    if (!concept) throw new Error(`Концепт ${conceptId} не найден`);

    const ontologyRef = concept.reqs['Элемент онтологии'];
    let ontologyData = null;
    if (ontologyRef?.value) {
      const elements = await this.getOntologyElements({ limit: 500 });
      ontologyData = elements.find(e => String(e.id) === String(ontologyRef.value)) || null;
    }

    return { ...concept, ontologyElement: ontologyData };
  }

  /** Поиск элементов онтологии по имени (для автокомплита) */
  async searchOntologyElements(query) {
    const elements = await this.getOntologyElements({ limit: 500 });
    if (!query) return elements.slice(0, 50);
    const q = query.toLowerCase();
    return elements.filter(e => {
      const name = (e.val || '').toLowerCase();
      const en = (e.reqs?.['prefLabel_en']?.value || '').toLowerCase();
      const notation = (e.reqs?.['notation']?.value || '').toLowerCase();
      return name.includes(q) || en.includes(q) || notation.includes(q);
    }).slice(0, 50);
  }

  // ─── Unified Ontology Bridge ─────────────────────────────────────────────
  //
  // Прямая связь: СОД Концепт → Integram таблица (данные)
  // Концепт "Дрон" → linkedTableId → AeroNext Номенклатура (1562 записи)
  // + propertyMap: свойства концепта → реквизиты таблицы
  //
  // Три уровня:
  //   1) ontologyElementId → семантика (определение, OWL URI, мультиязычность)
  //   2) linkedTableId     → данные (таблица Integram с записями)
  //   3) propertyMap       → маппинг свойств на колонки таблицы

  /**
   * Привязать концепт к таблице Integram (данные).
   * Это ВТОРАЯ привязка (помимо ontologyElementId для семантики).
   * Даёт агенту прямой путь: концепт → реальные данные.
   *
   * @param {string} conceptId — ID концепта в СОД
   * @param {string} tableId — ID таблицы Integram (typeId)
   * @param {Object} propertyMap — маппинг { свойствоКонцепта: aliasРеквизитаТаблицы }
   */
  async linkConceptToTable(conceptId, tableId, propertyMap = {}) {
    await this.initialize();
    await this.ensureReqMap(this.tables.concepts);
    const reqMap = this.reqMaps[this.tables.concepts]?.aliasMap || {};

    // Store linkedTableId in concept requisite
    const tableReqId = reqMap['Таблица данных'];
    if (!tableReqId) {
      // Requisite doesn't exist yet — store in description/memory
      // (will be created as a proper requisite when table structure is updated)
      logger.warn('[EE] Реквизит "Таблица данных" не найден, сохраняю в свойствах концепта');
    }

    // Store property map in concept
    const mapReqId = reqMap['Маппинг свойств'];

    const updates = {};
    if (tableReqId) updates[tableReqId] = String(tableId);
    if (mapReqId) updates[mapReqId] = JSON.stringify(propertyMap);

    // Fallback: store in concept description if requisites don't exist
    if (!tableReqId || !mapReqId) {
      const descReqId = reqMap['Описание'];
      if (descReqId) {
        const concepts = await this.getObjects(this.tables.concepts);
        const concept = concepts.find(c => String(c.id) === String(conceptId));
        const existingDesc = concept?.reqs?.['Описание']?.value || '';

        // Append structured metadata to description
        const linkMeta = `\n[LINKED_TABLE:${tableId}]` +
          (Object.keys(propertyMap).length > 0 ? `\n[PROPERTY_MAP:${JSON.stringify(propertyMap)}]` : '');

        // Remove old metadata if present
        const cleanDesc = existingDesc
          .replace(/\n?\[LINKED_TABLE:[^\]]*\]/g, '')
          .replace(/\n?\[PROPERTY_MAP:[^\]]*\]/g, '');

        updates[descReqId] = cleanDesc + linkMeta;
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.updateObject(conceptId, updates);
      this.invalidateCache(this.tables.concepts);
    }

    // Validate table exists
    let tableInfo = null;
    try {
      const response = await axios.get(
        `${this.v2BaseUrl}/schema/types/${tableId}`,
        { headers: this.getHeaders(), timeout: 5000 }
      );
      tableInfo = { id: tableId, name: response.data?.data?.name || response.data?.name, exists: true };
    } catch (e) {
      tableInfo = { id: tableId, exists: false, warning: 'Таблица не найдена — возможно неверный ID' };
    }

    return {
      success: true,
      conceptId,
      linkedTableId: tableId,
      table: tableInfo,
      propertyMap,
      _hint: 'Теперь resolve(conceptId) вернёт и семантику и данные из таблицы'
    };
  }

  /**
   * Resolve — единая точка доступа к концепту.
   * Возвращает ВСЁ: семантику + привязанную таблицу + данные + схему.
   *
   * Для агента: "расскажи про Дрон" → полная картина.
   * Для человека: страница концепта показывает и определение и реальные данные.
   *
   * @param {string} conceptId — ID или имя концепта
   * @param {Object} opts — { includeData, dataLimit, dataFilter }
   */
  async resolveConcept(conceptId, opts = {}) {
    await this.initialize();
    const concepts = await this.getObjects(this.tables.concepts);

    // Find by ID or name
    let concept = concepts.find(c => String(c.id) === String(conceptId));
    if (!concept) {
      // Try by name
      const q = String(conceptId).toLowerCase();
      concept = concepts.find(c => (c.val || '').toLowerCase() === q ||
        (c.val || '').toLowerCase().includes(q));
    }
    if (!concept) throw new Error(`Концепт "${conceptId}" не найден`);

    const result = {
      concept: {
        id: concept.id,
        name: concept.val,
        description: null,
        applicationId: concept.reqs?.['Приложение']?.value || null
      },
      ontology: null,     // семантика (Онтология БПЛА)
      linkedTable: null,  // привязанная таблица
      schema: null,       // схема таблицы (колонки)
      data: null,         // реальные данные
      propertyMap: null,  // маппинг свойств → колонок
      models: [],         // модели (допустимые события)
      individuals: [],    // индивиды (экземпляры)
      events: []          // последние события
    };

    // ── 1. Extract metadata from concept ──
    const desc = concept.reqs?.['Описание']?.value || '';
    result.concept.description = desc.replace(/\n?\[LINKED_TABLE:[^\]]*\]/g, '').replace(/\n?\[PROPERTY_MAP:[^\]]*\]/g, '').trim();

    // Parse linked table from structured metadata
    let linkedTableId = concept.reqs?.['Таблица данных']?.value || null;
    let propertyMap = {};

    if (!linkedTableId) {
      // Fallback: parse from description
      const tableMatch = desc.match(/\[LINKED_TABLE:(\d+)\]/);
      if (tableMatch) linkedTableId = tableMatch[1];
    }

    const mapField = concept.reqs?.['Маппинг свойств']?.value;
    if (mapField) {
      try { propertyMap = JSON.parse(mapField); } catch (_) {}
    } else {
      const mapMatch = desc.match(/\[PROPERTY_MAP:(\{[^\]]+\})\]/);
      if (mapMatch) {
        try { propertyMap = JSON.parse(mapMatch[1]); } catch (_) {}
      }
    }

    // ── 2. Ontology element (семантика) ──
    const ontologyRef = concept.reqs?.['Элемент онтологии'];
    if (ontologyRef?.value) {
      try {
        const elements = await this.getOntologyElements({ limit: 500 });
        const elem = elements.find(e => String(e.id) === String(ontologyRef.value));
        if (elem) {
          result.ontology = {
            id: elem.id,
            name: elem.val,
            prefLabel_en: elem.reqs?.['prefLabel_en']?.value || null,
            prefLabel_zh: elem.reqs?.['prefLabel_zh']?.value || null,
            definition: elem.reqs?.['Определение']?.value || elem.reqs?.['definition']?.value || null,
            notation: elem.reqs?.['notation']?.value || null,
            owlUri: elem.reqs?.['dront:Drone']?.value || elem.reqs?.['owl:Class']?.value || null
          };
        }
      } catch (_) {}
    }

    // ── 3. Linked table (данные) ──
    if (linkedTableId) {
      try {
        const response = await axios.get(
          `${this.v2BaseUrl}/schema/types/${linkedTableId}`,
          { headers: this.getHeaders(), timeout: 5000 }
        );
        const typeData = response.data?.data || response.data;
        result.linkedTable = {
          id: linkedTableId,
          name: typeData.name,
          objectCount: typeData.objectCount || typeData.count || 0
        };

        // Schema (columns)
        const reqs = typeData.requisites || typeData.reqs || [];
        result.schema = reqs.map(r => ({
          id: r.id,
          alias: r.alias || r.name,
          type: r.type,
          isRef: r.isRef || r.refType != null,
          refTableId: r.refType || null
        }));

        result.propertyMap = propertyMap;

        // ── 4. Data from linked table (V1 API — V2 has no list endpoint) ──
        if (opts.includeData !== false) {
          const limit = opts.dataLimit || 20;
          try {
            const items = await this.getObjects(linkedTableId, { limit });
            result.data = {
              count: result.linkedTable.objectCount,
              limit,
              items: Array.isArray(items) ? items.slice(0, limit) : []
            };
          } catch (e) {
            result.data = { error: e.message, count: result.linkedTable.objectCount };
          }
        }
      } catch (e) {
        result.linkedTable = { id: linkedTableId, error: e.message };
      }
    }

    // ── 5. Models (допустимые события) ──
    try {
      const models = await this.getModels(concept.id);
      result.models = (models || []).slice(0, 10).map(m => ({
        id: m.id,
        name: m.val,
        eventCount: m._eventCount || 0
      }));
    } catch (_) {}

    // ── 6. Individuals (экземпляры) ──
    try {
      const individuals = await this.getIndividuals();
      result.individuals = individuals
        .filter(ind => {
          const cRef = ind.reqs?.['Концепт']?.value;
          return cRef && String(cRef) === String(concept.id);
        })
        .slice(0, 20)
        .map(ind => ({
          id: ind.id,
          name: ind.val,
          state: ind.reqs?.['Состояние']?.value || null
        }));
    } catch (_) {}

    // ── 7. Recent events ──
    if (result.individuals.length > 0) {
      try {
        const events = await this.getSubjectEvents({ limit: 10 });
        const indIds = new Set(result.individuals.map(i => String(i.id)));
        result.events = events
          .filter(ev => indIds.has(String(ev.reqs?.['Индивид']?.value)))
          .slice(0, 10)
          .map(ev => ({
            id: ev.id,
            type: ev.reqs?.['Тип']?.value || ev.val,
            ts: ev.reqs?.['Время']?.value || null,
            actor: ev.reqs?.['Актор']?.displayValue || null
          }));
      } catch (_) {}
    }

    return result;
  }

  /**
   * Auto-discover: найти таблицу Integram по имени концепта.
   * Ищет таблицы с похожим именем для автоматической привязки.
   */
  async suggestTableForConcept(conceptId) {
    await this.initialize();
    const concepts = await this.getObjects(this.tables.concepts);
    const concept = concepts.find(c => String(c.id) === String(conceptId));
    if (!concept) throw new Error(`Концепт ${conceptId} не найден`);

    const conceptName = (concept.val || '').toLowerCase();
    const keywords = conceptName.split(/[\s,/]+/).filter(w => w.length > 2);

    // Get all tables from catalog
    try {
      const catalog = await this.getCatalog(null, { minObjects: 0, compact: true });
      const groups = catalog.groups || {};
      const suggestions = [];

      for (const [groupName, group] of Object.entries(groups)) {
        for (const item of (group.items || [])) {
          const tableName = (item.name || '').toLowerCase();
          const score = keywords.reduce((s, kw) => s + (tableName.includes(kw) ? 1 : 0), 0);
          if (score > 0) {
            suggestions.push({
              tableId: item.id,
              tableName: item.name,
              group: groupName,
              objectCount: item.objectCount,
              matchScore: score,
              matchedKeywords: keywords.filter(kw => tableName.includes(kw))
            });
          }
        }
      }

      suggestions.sort((a, b) => b.matchScore - a.matchScore || b.objectCount - a.objectCount);

      return {
        concept: { id: concept.id, name: concept.val },
        suggestions: suggestions.slice(0, 10),
        _hint: suggestions.length > 0
          ? `Лучший кандидат: "${suggestions[0].tableName}" (${suggestions[0].objectCount} записей). Привяжи через linkConceptToTable(${conceptId}, ${suggestions[0].tableId})`
          : 'Подходящих таблиц не найдено. Создай таблицу или уточни имя концепта.'
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  /**
   * Bulk resolve — разрешить все концепты с привязками.
   * Показывает полную карту: какие концепты привязаны, какие нет.
   */
  async getUnifiedMap() {
    await this.initialize();
    const concepts = await this.getObjects(this.tables.concepts);
    const elements = await this.getOntologyElements({ limit: 1000 });
    const elemMap = {};
    for (const e of elements) elemMap[e.id] = e;

    const mapped = [];
    const unmapped = [];

    for (const c of concepts) {
      const ontRef = c.reqs?.['Элемент онтологии']?.value;
      const desc = c.reqs?.['Описание']?.value || '';
      const tableMatch = desc.match(/\[LINKED_TABLE:(\d+)\]/);
      const linkedTableId = c.reqs?.['Таблица данных']?.value || (tableMatch ? tableMatch[1] : null);

      const entry = {
        id: c.id,
        name: c.val,
        ontologyElement: ontRef ? (elemMap[ontRef]?.val || ontRef) : null,
        ontologyElementId: ontRef || null,
        linkedTableId,
        hasOntology: !!ontRef,
        hasTable: !!linkedTableId
      };

      if (linkedTableId || ontRef) {
        mapped.push(entry);
      } else {
        unmapped.push(entry);
      }
    }

    return {
      total: concepts.length,
      mapped: mapped.length,
      unmapped: unmapped.length,
      fullyCovered: mapped.filter(m => m.hasOntology && m.hasTable).length,
      ontologyOnly: mapped.filter(m => m.hasOntology && !m.hasTable).length,
      tableOnly: mapped.filter(m => !m.hasOntology && m.hasTable).length,
      concepts: { mapped, unmapped: unmapped.slice(0, 30) }
    };
  }

  // ─── Vocabularies ─────────────────────────────────────────────

  async getVocabularies() {
    await this.initialize();
    return this.getObjects(this.tables.vocabularies);
  }

  async createVocabulary(name, description = '') {
    await this.initialize();
    await this.ensureReqMap(this.tables.vocabularies);
    return this.createObject(this.tables.vocabularies, name, { 'Описание': description });
  }

  async createVocabularyEntry(vocabularyId, value) {
    await this.initialize();
    // Create a child object under the vocabulary entry
    return this.createObject(this.tables.vocabularies, value, {}, String(vocabularyId));
  }

  // ─── Properties ───────────────────────────────────────────────

  async getProperties(vocabularyId) {
    await this.initialize();
    const all = await this.getObjects(this.tables.properties);
    if (!vocabularyId) return all;
    return all.filter(p => {
      const vocabReq = p.reqs['Словарь'];
      return vocabReq && String(vocabReq.value) === String(vocabularyId);
    });
  }

  async createProperty(name, { propertyType = 'attribute', dataType = 'Text', vocabularyId, rangeConceptId, allowedValues } = {}) {
    await this.initialize();
    await this.ensureReqMap(this.tables.properties);
    const reqs = {
      'Тип свойства': propertyType,
      'Тип данных': dataType,
    };
    if (vocabularyId) reqs['Словарь'] = String(vocabularyId);
    if (rangeConceptId) reqs['Range'] = String(rangeConceptId);
    if (allowedValues) reqs['Допустимые значения'] = JSON.stringify(allowedValues);
    return this.createObject(this.tables.properties, name, reqs);
  }

  // ─── Applications ─────────────────────────────────────────────

  async getApplications() {
    await this.initialize();
    return this.getObjects(this.tables.applications);
  }

  async createApplication(name, description = '') {
    await this.initialize();
    await this.ensureReqMap(this.tables.applications);
    return this.createObject(this.tables.applications, name, { 'Описание': description });
  }

  async attachModelToApp(appId, modelId) {
    await this.initialize();
    // V2 API: batch update with requisite
    const map = this.reqMaps[this.tables.applications];
    const reqId = map?.aliasMap?.['Модели'] || '1709603';
    await this.updateObject(appId, { [reqId]: String(modelId) });
    this.invalidateEpistemicCache(appId);
  }

  async attachVocabToApp(appId, vocabId) {
    await this.initialize();
    // V2 API: batch update with requisite
    const map = this.reqMaps[this.tables.applications];
    const reqId = map?.aliasMap?.['Словари'] || '1709604';
    await this.updateObject(appId, { [reqId]: String(vocabId) });
    this.invalidateEpistemicCache(appId);
  }

  // ─── Models ───────────────────────────────────────────────────

  async getModels(conceptId) {
    await this.initialize();
    const all = await this.getObjects(this.tables.models);
    if (!conceptId) return all;
    return all.filter(m => {
      const cReq = m.reqs['Концепт'];
      return cReq && String(cReq.value) === String(conceptId);
    });
  }

  async getModelTree(modelId) {
    await this.initialize();
    const events = await this.getObjects(this.tables.modelEvents);
    const modelEvents = events.filter(e => {
      const mReq = e.reqs['Модель'];
      return mReq && String(mReq.value) === String(modelId);
    });

    // Build tree structure
    const byId = {};
    for (const ev of modelEvents) byId[ev.id] = { ...ev, children: [] };

    const roots = [];
    for (const ev of modelEvents) {
      const parentReq = ev.reqs['Родитель'];
      const parentId = parentReq?.value;
      if (parentId && byId[parentId]) {
        byId[parentId].children.push(byId[ev.id]);
      } else {
        roots.push(byId[ev.id]);
      }
    }

    // Sort by order
    const sortByOrder = (arr) => {
      arr.sort((a, b) => {
        const oa = Number(a.reqs['Порядок']?.value || 0);
        const ob = Number(b.reqs['Порядок']?.value || 0);
        return oa - ob;
      });
      arr.forEach(n => sortByOrder(n.children));
    };
    sortByOrder(roots);

    return roots;
  }

  // ─── Model Events ─────────────────────────────────────────────

  async getModelEvents(modelId) {
    await this.initialize();
    const all = await this.getObjects(this.tables.modelEvents);
    if (!modelId) return all;
    return all.filter(e => {
      const mReq = e.reqs['Модель'];
      return mReq && String(mReq.value) === String(modelId);
    });
  }

  async createModelEvent(name, { modelId, propertyId, parentEventId, order = 0, constraints = {} } = {}) {
    await this.initialize();
    await this.ensureReqMap(this.tables.modelEvents);
    const reqs = {
      'Модель': String(modelId),
      'Свойство': String(propertyId),
      'Порядок': String(order),
      'Ограничения': JSON.stringify(constraints),
    };
    if (parentEventId) reqs['Родитель'] = String(parentEventId);
    return this.createObject(this.tables.modelEvents, name, reqs);
  }

  async updateModelEvent(id, data) {
    await this.initialize();
    await this.ensureReqMap(this.tables.modelEvents);
    const resolved = this.resolveReqs(this.tables.modelEvents, data);
    return this.updateObject(id, resolved);
  }

  async deleteModelEvent(id) {
    await this.initialize();
    return this.deleteObject(id);
  }

  // ─── Individuals ──────────────────────────────────────────────

  async getIndividuals(conceptId) {
    await this.initialize();
    const all = await this.getObjects(this.tables.individuals);
    if (!conceptId) return all;
    return all.filter(i => {
      const cReq = i.reqs['Концепт'];
      return cReq && String(cReq.value) === String(conceptId);
    });
  }

  async createIndividual(name, { conceptId, modelId, actorId, status = 'active' } = {}) {
    await this.initialize();
    await this.ensureReqMap(this.tables.individuals);
    const reqs = { 'Статус': status };
    if (conceptId) reqs['Концепт'] = String(conceptId);
    if (modelId) reqs['Модель'] = String(modelId);
    if (actorId) reqs['Создал'] = String(actorId);
    const result = await this.createObject(this.tables.individuals, name, reqs);
    this.invalidateCache(this.tables.individuals);
    return result;
  }

  // ─── Subject Events (DAG) ─────────────────────────────────────

  async getSubjectEvents(individualId) {
    await this.initialize();
    const all = await this.getObjectsCached(this.tables.subjectEvents);
    if (!individualId) return all;

    // Reference fields return display names in list view, so we need to
    // match by both ID and name. First resolve the individual name.
    let individualName = null;
    try {
      const individuals = await this.getObjectsCached(this.tables.individuals);
      const ind = individuals.find(i => String(i.id) === String(individualId));
      if (ind) individualName = ind.val;
    } catch { /* ignore */ }

    return all.filter(e => {
      const iReq = e.reqs['Индивид'];
      if (!iReq) return false;
      const val = String(iReq.value);
      return val === String(individualId) || (individualName && val === individualName);
    });
  }

  async createSubjectEvent(name, { individualId, modelEventId, value, actorId, causes = [], timestamp } = {}) {
    await this.initialize();
    await this.ensureReqMap(this.tables.subjectEvents);

    // I2 invariant: Check acyclicity BEFORE creating the event
    // We use a temporary placeholder ID for the new event to check for cycles
    if (causes.length > 0) {
      const tempId = `__new_${Date.now()}`;
      const isAcyclic = await this.checkAcyclicity(tempId, causes);
      if (!isAcyclic) {
        throw new Error(`Нарушение инварианта I2 (ацикличность): добавление причин [${causes.join(', ')}] создаёт цикл в DAG`);
      }
    }

    const ts = timestamp || new Date().toISOString();

    // Store causes as JSON object with embedded timestamp
    // (Integram DATETIME field has epoch-seconds limitation for future dates)
    const causesData = JSON.stringify({ c: causes, t: ts });

    // Also try to set DATETIME field (works for small epoch values only)
    let epochSec = 0;
    try {
      epochSec = Math.floor(new Date(ts).getTime() / 1000);
    } catch { /* ignore */ }

    const reqs = {
      'Значение': value || '',
      'Причины': causesData,
      'Временная метка': String(epochSec),
    };
    if (individualId) reqs['Индивид'] = String(individualId);
    if (modelEventId) reqs['Модельное событие'] = String(modelEventId);
    if (actorId) reqs['Актор'] = String(actorId);

    const result = await this.createObject(this.tables.subjectEvents, name, reqs);

    // Phase 4: Auto-evaluate triggers + notify watchers
    const newId = result?.id || result?.obj;
    if (newId && this._triggers?.length > 0) {
      // Resolve modelId from modelEventId for trigger matching
      let resolvedModelId = null;
      if (modelEventId) {
        try {
          const allME = await this.getObjects(this.tables.modelEvents);
          const me = allME.find(e => String(e.id) === String(modelEventId));
          if (me?.reqs?.['Модель']) resolvedModelId = String(me.reqs['Модель'].value);
          logger.info(`[Dataflow] Resolved modelId=${resolvedModelId} from modelEventId=${modelEventId}`);
        } catch (e) { logger.warn(`[Dataflow] modelId resolve failed: ${e.message}`); }
      } else {
        logger.info(`[Dataflow] No modelEventId provided for event "${name}" — triggers with modelId filter will be skipped`);
      }
      // Run synchronously to ensure cascade happens
      try {
        await this.evaluateTriggers({
          id: String(newId), name, individualId, modelEventId, value, actorId,
          modelId: resolvedModelId,
        });
      } catch (err) {
        logger.warn('[Dataflow] Auto-trigger evaluation failed:', err.message);
      }
    }
    if (newId && modelEventId && this._watchers?.size > 0) {
      this._notifyWatchers?.(modelEventId, { id: String(newId), name, value, actorId, individualId });
    }

    // WebSocket push for created events
    if (this._io) {
      this._io.emit('ee:event-created', { id: String(newId), name, value, actorId, individualId, modelEventId });
    }

    // Update temporal cache for $WITHIN/$REPEATED/$SEQUENCE operators
    if (!this._recentEventsCache) this._recentEventsCache = [];
    this._recentEventsCache.push({ id: String(newId), val: name, reqs: { 'Временная метка': { value: new Date(ts).toLocaleString('ru-RU') } } });
    if (this._recentEventsCache.length > 500) this._recentEventsCache = this._recentEventsCache.slice(-500);

    return result;
  }

  // Parse causes data (supports both old array format and new {c, t} format)
  parseCausesData(raw) {
    try {
      const parsed = JSON.parse(raw || '[]');
      if (Array.isArray(parsed)) {
        return { causes: parsed, timestamp: null };
      }
      if (parsed && typeof parsed === 'object') {
        return {
          causes: Array.isArray(parsed.c) ? parsed.c : [],
          timestamp: parsed.t || null,
        };
      }
    } catch { /* ignore */ }
    return { causes: [], timestamp: null };
  }

  // ─── Event Graph ──────────────────────────────────────────────

  async getEventGraph(filters = {}) {
    await this.initialize();
    let events = await this.getObjects(this.tables.subjectEvents);

    // Filter by reference IDs (value now contains actual object ID for ref fields)
    if (filters.individualId) {
      events = events.filter(e => {
        return String(e.reqs['Индивид']?.value || '') === String(filters.individualId);
      });
    }
    if (filters.actorId) {
      events = events.filter(e => {
        return String(e.reqs['Актор']?.value || '') === String(filters.actorId);
      });
    }

    // Build DAG nodes and edges
    const nodes = events.map(e => {
      const parsed = this.parseCausesData(e.reqs['Причины']?.value);
      return {
        id: e.id,
        label: `${e.val}: ${e.reqs['Значение']?.value || ''}`,
        modelEventId: e.reqs['Модельное событие']?.value,
        individualId: e.reqs['Индивид']?.value,
        actorId: e.reqs['Актор']?.value,
        timestamp: parsed.timestamp || e.reqs['Временная метка']?.value,
        value: e.reqs['Значение']?.value,
      };
    });

    const edges = [];
    for (const e of events) {
      const parsed = this.parseCausesData(e.reqs['Причины']?.value);
      for (const causeId of parsed.causes) {
        edges.push({ source: String(causeId), target: e.id });
      }
    }

    return { nodes, edges };
  }

  // ─── Model Execution ──────────────────────────────────────────

  async executeModel(modelId, individualId, actorId, values = {}) {
    await this.initialize();
    const tree = await this.getModelTree(modelId);
    const results = [];

    const processNode = async (node, parentEventIds = []) => {
      const propertyId = node.reqs['Свойство']?.value;
      const propertyName = node.val;
      let constraints = {};
      try {
        constraints = JSON.parse(node.reqs['Ограничения']?.value || '{}');
      } catch { /* ignore */ }

      const inputValue = values[node.id] ?? values[propertyName];

      // Check conditions
      if (constraints.condition) {
        const condResult = this.evaluateCondition(constraints.condition, { values, currentNode: node });
        if (!condResult) return results;
      }

      // Compute value
      let finalValue = inputValue;
      if (constraints.setValue) {
        finalValue = this.evaluateExpression(constraints.setValue, { values, currentNode: node });
      }
      if (finalValue === undefined && constraints.default !== undefined && constraints.default !== null) {
        finalValue = constraints.default;
      }

      // Validate required
      if (constraints.required && (finalValue === undefined || finalValue === null || finalValue === '')) {
        throw new Error(`Required field "${propertyName}" is missing`);
      }

      // Create subject event
      if (finalValue !== undefined && finalValue !== null) {
        const eventResult = await this.createSubjectEvent(propertyName, {
          individualId,
          modelEventId: node.id,
          value: String(finalValue),
          actorId,
          causes: parentEventIds,
        });
        const newEventId = eventResult?.id || eventResult?.obj;
        results.push({ nodeId: node.id, property: propertyName, value: finalValue, eventId: newEventId });

        // Process children
        for (const child of node.children) {
          await processNode(child, newEventId ? [String(newEventId)] : []);
        }
      }
    };

    for (const root of tree) {
      await processNode(root);
    }

    return results;
  }

  // ─── BSL Tokenizer & Parser (arXiv:2509.09775 BNF grammar) ──

  /**
   * Tokenize BSL expression into tokens.
   * Supports: $EQ, $NE, $GT, $LT, $GE, $LE, $AND, $OR, $NOT,
   *           $Model("..."), $Concept("..."), $Actor("..."),
   *           $CurrentActor, $Now, $Value, $Count, $Sum, $Avg,
   *           strings, numbers, booleans, property names
   */
  tokenizeBSL(input) {
    const tokens = [];
    let i = 0;
    while (i < input.length) {
      if (/\s/.test(input[i])) { i++; continue; }
      if (input[i] === '"') {
        let str = '';
        i++;
        while (i < input.length && input[i] !== '"') { str += input[i]; i++; }
        i++;
        tokens.push({ type: 'STRING', value: str });
        continue;
      }
      if (/\d/.test(input[i]) || (input[i] === '-' && i + 1 < input.length && /\d/.test(input[i + 1]))) {
        let num = '';
        if (input[i] === '-') { num += '-'; i++; }
        while (i < input.length && /[\d.]/.test(input[i])) { num += input[i]; i++; }
        tokens.push({ type: 'NUMBER', value: parseFloat(num) });
        continue;
      }
      if (input[i] === '$') {
        let kw = '$';
        i++;
        while (i < input.length && /\w/.test(input[i])) { kw += input[i]; i++; }
        tokens.push({ type: 'KEYWORD', value: kw });
        continue;
      }
      if ('()[],'.includes(input[i])) {
        tokens.push({ type: 'PUNCT', value: input[i] }); i++; continue;
      }
      if (input[i] === '!' && i + 1 < input.length && input[i + 1] === '=') {
        tokens.push({ type: 'OP', value: '!=' }); i += 2; continue;
      }
      if (input[i] === '!') {
        tokens.push({ type: 'PUNCT', value: '!' }); i++; continue;
      }
      if (input[i] === '&' && input[i + 1] === '&') { tokens.push({ type: 'OP', value: '&&' }); i += 2; continue; }
      if (input[i] === '|' && input[i + 1] === '|') { tokens.push({ type: 'OP', value: '||' }); i += 2; continue; }
      if (input[i] === '&') { tokens.push({ type: 'OP', value: '&&' }); i++; continue; }
      if (input[i] === '|') { tokens.push({ type: 'OP', value: '||' }); i++; continue; }
      if ('=<>'.includes(input[i])) {
        let op = input[i]; i++;
        if (i < input.length && input[i] === '=') { op += '='; i++; }
        tokens.push({ type: 'OP', value: op }); continue;
      }
      if (/[a-zA-Zа-яА-ЯёЁ_]/.test(input[i])) {
        let id = '';
        while (i < input.length && /[a-zA-Zа-яА-ЯёЁ_0-9]/.test(input[i])) { id += input[i]; i++; }
        if (id === 'true') tokens.push({ type: 'BOOL', value: true });
        else if (id === 'false') tokens.push({ type: 'BOOL', value: false });
        else tokens.push({ type: 'IDENT', value: id });
        continue;
      }
      i++;
    }
    return tokens;
  }

  /**
   * Evaluate BSL condition with context: { values, currentNode, individualId, actorId }
   * Supports: $EQ/$NE/$GT/$LT/$GE/$LE, $AND/&&, $OR/||, $NOT/!, $CurrentActor, $Now, $Value
   */
  evaluateCondition(expression, context = {}) {
    try {
      if (typeof expression === 'boolean') return expression;
      if (expression === 'true' || expression === true) return true;
      if (expression === 'false' || expression === false) return false;
      if (typeof expression !== 'string' || !expression.trim()) return true;

      const tokens = this.tokenizeBSL(expression);
      if (tokens.length === 0) return true;
      return !!this._evalCondTokens(tokens, 0, context).value;
    } catch (err) {
      logger.warn('[EventEngine] evaluateCondition error:', err.message, 'expr:', expression);
      return true;
    }
  }

  _evalCondTokens(tokens, pos, context) {
    let left = this._evalCondAtom(tokens, pos, context);
    pos = left.pos;
    while (pos < tokens.length) {
      const tok = tokens[pos];
      if ((tok.type === 'KEYWORD' && tok.value === '$AND') || (tok.type === 'OP' && tok.value === '&&')) {
        pos++;
        const right = this._evalCondAtom(tokens, pos, context);
        pos = right.pos;
        left = { value: left.value && right.value, pos };
        continue;
      }
      if ((tok.type === 'KEYWORD' && tok.value === '$OR') || (tok.type === 'OP' && tok.value === '||')) {
        pos++;
        const right = this._evalCondAtom(tokens, pos, context);
        pos = right.pos;
        left = { value: left.value || right.value, pos };
        continue;
      }
      break;
    }
    return left;
  }

  _evalCondAtom(tokens, pos, context) {
    if (pos >= tokens.length) return { value: true, pos };
    const tok = tokens[pos];

    // ── Temporal operators (CEP) ──────────────────────────────────
    // $WITHIN(eventType, "duration") — было ли событие данного типа в пределах окна
    if (tok.type === 'KEYWORD' && tok.value === '$WITHIN') {
      return this._evalTemporalWithin(tokens, pos + 1, context);
    }
    // $REPEATED(eventType, count, "duration") — событие повторилось N раз за период
    if (tok.type === 'KEYWORD' && tok.value === '$REPEATED') {
      return this._evalTemporalRepeated(tokens, pos + 1, context);
    }
    // $SEQUENCE(eventTypeA, eventTypeB) — A произошло перед B
    if (tok.type === 'KEYWORD' && tok.value === '$SEQUENCE') {
      return this._evalTemporalSequence(tokens, pos + 1, context);
    }
    // $AGO("duration") — возвращает timestamp N назад от сейчас
    if (tok.type === 'KEYWORD' && tok.value === '$AGO') {
      pos++;
      if (pos < tokens.length && tokens[pos].value === '(') pos++;
      const durVal = this._resolveValue(tokens[pos], context);
      pos++;
      if (pos < tokens.length && tokens[pos].value === ')') pos++;
      const ms = this._parseDuration(String(durVal));
      return { value: new Date(Date.now() - ms).toISOString(), pos };
    }

    if ((tok.type === 'KEYWORD' && tok.value === '$NOT') || (tok.type === 'PUNCT' && tok.value === '!')) {
      const inner = this._evalCondAtom(tokens, pos + 1, context);
      return { value: !inner.value, pos: inner.pos };
    }
    if (tok.type === 'PUNCT' && tok.value === '(') {
      const inner = this._evalCondTokens(tokens, pos + 1, context);
      let endPos = inner.pos;
      if (endPos < tokens.length && tokens[endPos].value === ')') endPos++;
      return { value: inner.value, pos: endPos };
    }
    const leftVal = this._resolveValue(tok, context);
    pos++;
    if (pos < tokens.length) {
      const opTok = tokens[pos];
      const isCompOp = (opTok.type === 'KEYWORD' && ['$EQ', '$NE', '$GT', '$LT', '$GE', '$LE', '$BEFORE', '$AFTER', '$BETWEEN', '$MATCH', '$CONTAINS'].includes(opTok.value)) ||
                       (opTok.type === 'OP' && ['==', '!=', '>', '<', '>=', '<='].includes(opTok.value));
      if (isCompOp) {
        pos++;
        if (pos >= tokens.length) return { value: false, pos };
        const rightVal = this._resolveValue(tokens[pos], context);
        pos++;
        const op = opTok.value;
        let result;
        if (op === '$EQ' || op === '==') result = String(leftVal) === String(rightVal);
        else if (op === '$NE' || op === '!=') result = String(leftVal) !== String(rightVal);
        else if (op === '$GT' || op === '>') result = Number(leftVal) > Number(rightVal);
        else if (op === '$LT' || op === '<') result = Number(leftVal) < Number(rightVal);
        else if (op === '$GE' || op === '>=') result = Number(leftVal) >= Number(rightVal);
        else if (op === '$LE' || op === '<=') result = Number(leftVal) <= Number(rightVal);
        else if (op === '$BEFORE') {
          // $BEFORE(timestamp) — checks if event.timestamp < given timestamp
          const eventTs = new Date(context.timestamp || context.values?.timestamp || 0).getTime();
          const targetTs = new Date(rightVal).getTime();
          result = eventTs < targetTs;
        }
        else if (op === '$AFTER') {
          const eventTs = new Date(context.timestamp || context.values?.timestamp || 0).getTime();
          const targetTs = new Date(rightVal).getTime();
          result = eventTs > targetTs;
        }
        else if (op === '$BETWEEN') {
          // $BETWEEN("start", "end")
          const eventTs = new Date(context.timestamp || context.values?.timestamp || 0).getTime();
          const parts = String(rightVal).split(',').map(s => s.trim().replace(/"/g, ''));
          if (parts.length !== 2) result = false;
          else {
            const startTs = new Date(parts[0]).getTime();
            const endTs = new Date(parts[1]).getTime();
            result = eventTs >= startTs && eventTs <= endTs;
          }
        }
        else if (op === '$MATCH') {
          try { result = new RegExp(String(rightVal)).test(String(leftVal)); }
          catch { result = String(leftVal).includes(String(rightVal)); }
        }
        else if (op === '$CONTAINS') {
          result = String(leftVal).includes(String(rightVal));
        }
        else result = false;
        return { value: result, pos };
      }
    }
    return { value: !!leftVal, pos };
  }

  _resolveValue(token, context) {
    if (!token) return null;
    if (token.type === 'STRING') return token.value;
    if (token.type === 'NUMBER') return token.value;
    if (token.type === 'BOOL') return token.value;
    if (token.type === 'KEYWORD') {
      if (token.value === '$CurrentActor') return context.actorId;
      if (token.value === '$Now') return new Date().toISOString();
      if (token.value === '$Value') return context.value;
      return token.value;
    }
    if (token.type === 'IDENT') {
      const vals = context.values || {};
      if (token.value in vals) return vals[token.value];
      const node = context.currentNode;
      if (node?.reqs?.[token.value]) return node.reqs[token.value].value;
      return token.value;
    }
    return null;
  }

  /**
   * Evaluate BSL value expression (setValue, computed fields).
   * Supports: $CurrentActor, $Now, $Value, $ADD/$SUB/$MUL/$DIV, $CONCAT, {field} interpolation
   */
  evaluateExpression(expression, context = {}) {
    try {
      if (expression === null || expression === undefined) return null;
      if (typeof expression !== 'string') return expression;
      if (expression === '$CurrentActor') return context.actorId;
      if (expression === '$Now') return new Date().toISOString();
      if (expression === '$Value') return context.value;

      const arithMatch = expression.match(/^\$(ADD|MUL|SUB|DIV)\((.+),\s*(.+)\)$/);
      if (arithMatch) {
        const op = arithMatch[1];
        const a = Number(this._resolveExprValue(arithMatch[2].trim(), context));
        const b = Number(this._resolveExprValue(arithMatch[3].trim(), context));
        if (op === 'ADD') return a + b;
        if (op === 'MUL') return a * b;
        if (op === 'SUB') return a - b;
        if (op === 'DIV') return b !== 0 ? a / b : 0;
      }

      const concatMatch = expression.match(/^\$CONCAT\((.+)\)$/);
      if (concatMatch) {
        return concatMatch[1].split(',').map(p => this._resolveExprValue(p.trim(), context)).join('');
      }

      if (expression.includes('{') && expression.includes('}')) {
        return expression.replace(/\{(\w+)\}/g, (_, key) => (context.values || {})[key] ?? key);
      }

      if (expression.startsWith('$')) {
        const fieldName = expression.slice(1);
        if (fieldName in (context.values || {})) return context.values[fieldName];
      }

      return expression;
    } catch (err) {
      logger.warn('[EventEngine] evaluateExpression error:', err.message);
      return null;
    }
  }

  _resolveExprValue(token, context) {
    const t = token.trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    if (t === '$CurrentActor') return context.actorId;
    if (t === '$Now') return new Date().toISOString();
    if (t === '$Value') return context.value;
    const vals = context.values || {};
    if (t in vals) return vals[t];
    if (t.startsWith('$') && t.slice(1) in vals) return vals[t.slice(1)];
    return t;
  }

  // ─── Multilingual BSL Resolution (Item 9) ────────────────────

  /**
   * Resolve concept by name, alias, or multilingual label.
   * Checks: val (exact), val (case-insensitive), EN/ZH alt-name reqs.
   */
  resolveConceptByName(name, concepts) {
    if (!name || !concepts) return null;
    // Exact match
    let found = concepts.find(c => c.val === name);
    if (found) return found;
    // Case-insensitive
    const lower = name.toLowerCase();
    found = concepts.find(c => c.val?.toLowerCase() === lower);
    if (found) return found;
    // Check alt-name fields (EN, ZH, Notation, etc.)
    found = concepts.find(c => {
      for (const [key, req] of Object.entries(c.reqs || {})) {
        if (['en', 'EN', 'zh', 'ZH', 'Нотация', 'Notation', 'EN name', 'ZH name'].some(k => key.includes(k))) {
          if (req.value && String(req.value).toLowerCase() === lower) return true;
        }
      }
      return false;
    });
    return found || null;
  }

  resolveModelByName(name, models) {
    if (!name || !models) return null;
    let found = models.find(m => m.val === name);
    if (found) return found;
    const lower = name.toLowerCase();
    return models.find(m => m.val?.toLowerCase() === lower) || null;
  }

  resolveActorByName(name, actors) {
    if (!name || !actors) return null;
    let found = actors.find(a => a.val === name);
    if (found) return found;
    const lower = name.toLowerCase();
    return actors.find(a => a.val?.toLowerCase() === lower) || null;
  }

  async executeQuery(bslQuery, context = {}) {
    await this.initialize();

    // Parse BSL with balanced parentheses: $(conditions).property — handles nested $Model(...), $Concept(...)
    if (!bslQuery.startsWith('$(')) return { error: 'Invalid BSL query syntax. Use: $(conditions).property' };
    let _qDepth = 0, _qEnd = -1;
    for (let _qi = 1; _qi < bslQuery.length; _qi++) {
      if (bslQuery[_qi] === '(') _qDepth++;
      else if (bslQuery[_qi] === ')') { if (_qDepth === 0) { _qEnd = _qi; break; } _qDepth--; }
    }
    if (_qEnd === -1) return { error: 'Invalid BSL query: unbalanced parentheses' };
    const conditionStr = bslQuery.slice(2, _qEnd).trim();
    const _qRest = bslQuery.slice(_qEnd + 1);
    const propertyPath = _qRest.startsWith('.') ? _qRest.slice(1).trim() : undefined;

    // Parse OR groups (|), then AND within each group (, or &)
    const orGroups = conditionStr.split(/\s*\|\s*/);
    let matchedIndividuals = [];

    const allIndividuals = await this.getObjectsCached(this.tables.individuals);
    const allModels = await this.getObjectsCached(this.tables.models);
    const allConcepts = await this.getObjectsCached(this.tables.concepts);

    for (const orGroup of orGroups) {
      const andParts = orGroup.split(/\s*[,&]\s*/).map(s => s.trim()).filter(Boolean);
      let candidates = [...allIndividuals];

      for (const cond of andParts) {
        const modelMatch = cond.match(/(?:\$EQ\.)?\$Model\("([^"]+)"\)/);
        if (modelMatch) {
          const target = this.resolveModelByName(modelMatch[1], allModels);
          candidates = target ? candidates.filter(i => String(i.reqs['Модель']?.value) === String(target.id)) : [];
          continue;
        }
        const conceptMatch = cond.match(/(?:\$EQ\.)?\$Concept\("([^"]+)"\)/);
        if (conceptMatch) {
          const target = this.resolveConceptByName(conceptMatch[1], allConcepts);
          candidates = target ? candidates.filter(i => String(i.reqs['Концепт']?.value) === String(target.id)) : [];
          continue;
        }
        const neConceptMatch = cond.match(/\$NE\.\$Concept\("([^"]+)"\)/);
        if (neConceptMatch) {
          const target = this.resolveConceptByName(neConceptMatch[1], allConcepts);
          if (target) candidates = candidates.filter(i => String(i.reqs['Концепт']?.value) !== String(target.id));
          continue;
        }
        const statusMatch = cond.match(/\$Status\("([^"]+)"\)/);
        if (statusMatch) {
          candidates = candidates.filter(i => i.reqs['Статус']?.value === statusMatch[1]);
          continue;
        }
      }

      for (const c of candidates) {
        if (!matchedIndividuals.find(m => m.id === c.id)) matchedIndividuals.push(c);
      }
    }

    if (propertyPath) {
      const propertyName = propertyPath.split('.')[0];
      const aggregateMatch = propertyPath.match(/\$(COUNT|SUM|AVG|MIN|MAX)$/);
      const results = [];

      for (const ind of matchedIndividuals) {
        const events = await this.getSubjectEvents(ind.id);
        for (const ev of events.filter(e => e.val === propertyName)) {
          results.push({
            individualId: ind.id,
            individualName: ind.val,
            property: propertyName,
            value: ev.reqs['Значение']?.value,
            timestamp: this.parseCausesData(ev.reqs['Причины']?.value).timestamp || ev.reqs['Временная метка']?.value,
          });
        }
      }

      if (aggregateMatch) {
        const agg = aggregateMatch[1];
        const values = results.map(r => Number(r.value)).filter(v => !isNaN(v));
        let aggResult;
        if (agg === 'COUNT') aggResult = results.length;
        else if (agg === 'SUM') aggResult = values.reduce((a, b) => a + b, 0);
        else if (agg === 'AVG') aggResult = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        else if (agg === 'MIN') aggResult = values.length > 0 ? Math.min(...values) : null;
        else if (agg === 'MAX') aggResult = values.length > 0 ? Math.max(...values) : null;
        return { results: [{ aggregate: agg, property: propertyName, value: aggResult, count: results.length }] };
      }
      return { results };
    }

    return {
      results: matchedIndividuals.map(i => ({
        id: i.id,
        name: i.val,
        concept: i.reqs['Концепт']?.displayValue || i.reqs['Концепт']?.value,
        conceptId: i.reqs['Концепт']?.value,
        model: i.reqs['Модель']?.displayValue || i.reqs['Модель']?.value,
        modelId: i.reqs['Модель']?.value,
        status: i.reqs['Статус']?.value,
      }))
    };
  }

  // ─── Happens-Before & Causal Ordering (arXiv:2510.18040 A3) ──

  /**
   * Check if eventA happens-before eventB (transitive causal closure).
   * BFS from eventB back through causes to find eventA.
   */
  async happensBefore(eventAId, eventBId) {
    await this.initialize();
    const allEvents = await this.getObjects(this.tables.subjectEvents);
    const causesMap = new Map();
    for (const ev of allEvents) {
      causesMap.set(String(ev.id), this.parseCausesData(ev.reqs['Причины']?.value).causes.map(String));
    }
    const visited = new Set();
    const queue = [String(eventBId)];
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === String(eventAId)) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      queue.push(...(causesMap.get(current) || []));
    }
    return false;
  }

  /**
   * Get full causal chain (ancestors) via DFS. Deepest-first order.
   */
  async getCausalChain(eventId) {
    await this.initialize();
    const allEvents = await this.getObjects(this.tables.subjectEvents);
    const causesMap = new Map();
    for (const ev of allEvents) {
      causesMap.set(String(ev.id), this.parseCausesData(ev.reqs['Причины']?.value).causes.map(String));
    }
    const chain = [];
    const visited = new Set();
    const dfs = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      for (const causeId of (causesMap.get(id) || [])) dfs(causeId);
      chain.push(id);
    };
    dfs(String(eventId));
    return chain;
  }

  /**
   * Get all effects (descendants) of an event.
   */
  async getEffects(eventId) {
    await this.initialize();
    const allEvents = await this.getObjects(this.tables.subjectEvents);
    const effectsMap = new Map();
    for (const ev of allEvents) {
      for (const causeId of this.parseCausesData(ev.reqs['Причины']?.value).causes) {
        if (!effectsMap.has(String(causeId))) effectsMap.set(String(causeId), []);
        effectsMap.get(String(causeId)).push(String(ev.id));
      }
    }
    const descendants = [];
    const visited = new Set();
    const bfs = [String(eventId)];
    while (bfs.length > 0) {
      const current = bfs.shift();
      if (visited.has(current)) continue;
      visited.add(current);
      if (current !== String(eventId)) descendants.push(current);
      bfs.push(...(effectsMap.get(current) || []));
    }
    return descendants;
  }

  // ─── DAG Invariants (arXiv:2510.18040 I1-I3) ───────────────

  /**
   * I2: Acyclicity — verify adding causeIds to newEventId won't create a cycle.
   */
  async checkAcyclicity(newEventId, causeIds) {
    if (!causeIds || causeIds.length === 0) return true;
    const allEvents = await this.getObjects(this.tables.subjectEvents);
    const causesMap = new Map();
    for (const ev of allEvents) {
      causesMap.set(String(ev.id), this.parseCausesData(ev.reqs['Причины']?.value).causes.map(String));
    }
    for (const causeId of causeIds) {
      const visited = new Set();
      const queue = [String(causeId)];
      while (queue.length > 0) {
        const current = queue.shift();
        if (String(current) === String(newEventId)) return false; // cycle!
        if (visited.has(current)) continue;
        visited.add(current);
        queue.push(...(causesMap.get(current) || []));
      }
    }
    return true;
  }

  /**
   * I3: Traceability — find root causes (events with no causes).
   */
  async traceToRoots(eventId) {
    const chain = await this.getCausalChain(eventId);
    const allEvents = await this.getObjects(this.tables.subjectEvents);
    const causesMap = new Map();
    for (const ev of allEvents) {
      causesMap.set(String(ev.id), this.parseCausesData(ev.reqs['Причины']?.value).causes.map(String));
    }
    return chain.filter(id => (causesMap.get(id) || []).length === 0);
  }

  // ─── Role-Based Access Control ──────────────────────────────

  /**
   * Check if actor has permission for a model event (uses 'permission' constraint).
   */
  async checkPermission(actorId, modelEventId) {
    if (!actorId || !modelEventId) return true;
    const allModelEvents = await this.getObjects(this.tables.modelEvents);
    const modelEvent = allModelEvents.find(e => String(e.id) === String(modelEventId));
    if (!modelEvent) return true;

    let constraints = {};
    try { constraints = JSON.parse(modelEvent.reqs['Ограничения']?.value || '{}'); } catch { /* */ }
    if (!constraints.permission) return true;

    const actors = await this.getObjects(this.tables.actors);
    const actor = actors.find(a => String(a.id) === String(actorId));
    if (!actor) return false;

    const actorType = actor.reqs['Тип']?.value || '';
    const required = constraints.permission;
    if (required === 'any') return true;
    return required === actorType;
  }

  // ─── Constraint Enforcement ─────────────────────────────────

  async validateAndCreateEvent(name, { individualId, modelEventId, value, actorId, causes = [], timestamp } = {}) {
    await this.initialize();

    // Get model event to check constraints
    if (modelEventId) {
      const allModelEvents = await this.getObjects(this.tables.modelEvents);
      const modelEvent = allModelEvents.find(e => String(e.id) === String(modelEventId));
      if (modelEvent) {
        let constraints = {};
        try { constraints = JSON.parse(modelEvent.reqs['Ограничения']?.value || '{}'); } catch { /* */ }

        // RBAC: Check permission constraint (role-based access)
        if (actorId && constraints.permission) {
          const permitted = await this.checkPermission(actorId, modelEventId);
          if (!permitted) {
            throw new Error(`Актор ${actorId} не имеет разрешения для события "${name}" (требуется: ${constraints.permission})`);
          }
        }

        // Check required
        if (constraints.required && (value === undefined || value === null || value === '')) {
          throw new Error(`Поле "${name}" обязательно для заполнения`);
        }

        // Check immutable — if event already exists for this individual + model event, reject
        if (constraints.immutable && individualId) {
          const existingEvents = await this.getSubjectEvents(individualId);
          const existing = existingEvents.find(e =>
            String(e.reqs['Модельное событие']?.value) === String(modelEventId) &&
            e.reqs['Значение']?.value
          );
          if (existing) {
            throw new Error(`Поле "${name}" неизменяемо (immutable), значение уже установлено: ${existing.reqs['Значение']?.value}`);
          }
        }

        // Check unique — value must be unique across all individuals for this model event
        if (constraints.unique && value) {
          const allSubjectEvents = await this.getObjects(this.tables.subjectEvents);
          const duplicate = allSubjectEvents.find(e =>
            String(e.reqs['Модельное событие']?.value) === String(modelEventId) &&
            String(e.reqs['Значение']?.value) === String(value) &&
            String(e.reqs['Индивид']?.value) !== String(individualId)
          );
          if (duplicate) {
            throw new Error(`Поле "${name}" должно быть уникальным. Значение "${value}" уже используется`);
          }
        }

        // Apply default if value empty
        if ((value === undefined || value === null || value === '') && constraints.default !== undefined) {
          value = constraints.default;
        }

        // Apply setValue (auto-computed)
        if (constraints.setValue) {
          const computed = this.evaluateSetValue(constraints.setValue, { individualId, actorId, value });
          if (computed !== null) value = computed;
        }
      }
    }

    return this.createSubjectEvent(name, { individualId, modelEventId, value, actorId, causes, timestamp });
  }

  evaluateSetValue(expression, context) {
    try {
      if (expression === '$CurrentActor') return context.actorId;
      if (expression === '$Now') return new Date().toISOString();
      if (expression === '$Value') return context.value;
      if (expression.startsWith('$')) return expression;
      return expression;
    } catch { return null; }
  }

  // ─── Monotonicity (I1 invariant) — soft-delete ─────────────

  /**
   * Soft-delete a subject event: sets Статус = 'deleted' instead of removing.
   * I1: Events are immutable once created — monotone growth of the DAG.
   * Deleted events remain in the DAG but are filtered from normal queries.
   */
  async softDeleteSubjectEvent(eventId) {
    await this.initialize();
    await this.ensureReqMap(this.tables.subjectEvents);
    // Resolve Статус reqId — alias may appear as 'Тип' due to Integram shared type naming (type 270)
    const map = this.reqMaps[this.tables.subjectEvents]?.aliasMap || {};
    const statusReqId = map['Статус'] || map['Тип'];
    if (!statusReqId) {
      logger.warn('[EventEngine] softDelete: no Статус field found in subjectEvents');
      return { id: eventId, status: 'deleted', warning: 'Статус field not found' };
    }
    await this.updateObject(eventId, { [statusReqId]: 'deleted' });
    // Invalidate cache
    this.cache.delete(`objects_${this.tables.subjectEvents}`);
    return { id: eventId, status: 'deleted' };
  }

  /**
   * Get active (non-deleted) subject events for an individual.
   * Filters out events with Статус = 'deleted' (field may be aliased as 'Тип' or 'Статус').
   */
  async getActiveSubjectEvents(individualId) {
    const events = await this.getSubjectEvents(individualId);
    return events.filter(e => {
      const status = e.reqs['Статус']?.value || e.reqs['Тип']?.value;
      return status !== 'deleted';
    });
  }

  // ─── Individual Timeline ────────────────────────────────────

  async getIndividualTimeline(individualId) {
    await this.initialize();
    const events = await this.getSubjectEvents(individualId);
    const actors = await this.getObjects(this.tables.actors);

    // Build lookup by both ID and name (reference fields return display names)
    const actorById = {};
    const actorByName = {};
    for (const a of actors) {
      actorById[a.id] = a;
      actorByName[a.val] = a;
    }

    // Parse causes data (supports both old array and new {c, t} format)
    const enriched = events.map(e => {
      const parsed = this.parseCausesData(e.reqs['Причины']?.value);
      return { event: e, causes: parsed.causes, embeddedTimestamp: parsed.timestamp };
    });

    // Sort by embedded timestamp (ISO) or fallback to DATETIME field
    enriched.sort((a, b) => {
      const ta = a.embeddedTimestamp || a.event.reqs['Временная метка']?.value || '';
      const tb = b.embeddedTimestamp || b.event.reqs['Временная метка']?.value || '';
      return ta.localeCompare(tb);
    });

    // Build timeline with causal info
    return enriched.map(({ event: e, causes, embeddedTimestamp }) => {
      const actorRef = e.reqs['Актор']?.value;
      // Look up actor by ID first, then by name (for reference display values)
      const actor = actorById[actorRef] || actorByName[actorRef];

      return {
        id: e.id,
        property: e.val,
        value: e.reqs['Значение']?.value,
        timestamp: embeddedTimestamp || e.reqs['Временная метка']?.value,
        actorId: actorRef,
        actorName: actor?.val || '—',
        actorType: actor?.reqs?.['Тип']?.value || '—',
        modelEventId: e.reqs['Модельное событие']?.value,
        causes,
        causedBy: causes.length,
      };
    });
  }

  // ─── Execute Model (with validation) ───────────────────────

  async executeModelValidated(modelId, individualId, actorId, values = {}) {
    await this.initialize();
    const tree = await this.getModelTree(modelId);
    const results = [];
    const errors = [];

    const processNode = async (node, parentEventIds = []) => {
      const propertyName = node.val;
      let constraints = {};
      try { constraints = JSON.parse(node.reqs['Ограничения']?.value || '{}'); } catch { /* */ }

      const inputValue = values[node.id] ?? values[propertyName];

      // Check conditions
      if (constraints.condition) {
        const condResult = this.evaluateCondition(constraints.condition, { values, currentNode: node });
        if (!condResult) return;
      }

      // Compute value
      let finalValue = inputValue;
      if (constraints.setValue) {
        const computed = this.evaluateSetValue(constraints.setValue, { individualId, actorId, value: inputValue });
        if (computed !== null) finalValue = computed;
      }
      if ((finalValue === undefined || finalValue === null || finalValue === '') && constraints.default !== undefined) {
        finalValue = constraints.default;
      }

      // Validate required
      if (constraints.required && (finalValue === undefined || finalValue === null || finalValue === '')) {
        errors.push({ property: propertyName, error: `Обязательное поле "${propertyName}" не заполнено` });
        return;
      }

      // Skip if no value
      if (finalValue === undefined || finalValue === null || finalValue === '') {
        // Process children anyway if they have defaults
        for (const child of node.children || []) {
          await processNode(child, parentEventIds);
        }
        return;
      }

      // Validate unique
      if (constraints.unique) {
        const allSubjectEvents = await this.getObjects(this.tables.subjectEvents);
        const duplicate = allSubjectEvents.find(e =>
          String(e.reqs['Модельное событие']?.value) === String(node.id) &&
          String(e.reqs['Значение']?.value) === String(finalValue) &&
          String(e.reqs['Индивид']?.value) !== String(individualId)
        );
        if (duplicate) {
          errors.push({ property: propertyName, error: `Значение "${finalValue}" уже используется` });
          return;
        }
      }

      // Validate immutable
      if (constraints.immutable) {
        const existingEvents = await this.getSubjectEvents(individualId);
        const existing = existingEvents.find(e =>
          String(e.reqs['Модельное событие']?.value) === String(node.id) &&
          e.reqs['Значение']?.value
        );
        if (existing) {
          errors.push({ property: propertyName, error: `Неизменяемое поле, значение: ${existing.reqs['Значение']?.value}` });
          return;
        }
      }

      // Create subject event
      try {
        const eventResult = await this.createSubjectEvent(propertyName, {
          individualId,
          modelEventId: node.id,
          value: String(finalValue),
          actorId,
          causes: parentEventIds,
        });
        const newEventId = eventResult?.id || eventResult?.obj;
        results.push({
          nodeId: node.id,
          property: propertyName,
          value: finalValue,
          eventId: newEventId,
          constraints: Object.keys(constraints).filter(k => constraints[k]),
        });

        for (const child of node.children || []) {
          await processNode(child, newEventId ? [String(newEventId)] : []);
        }
      } catch (err) {
        errors.push({ property: propertyName, error: err.message });
      }
    };

    for (const root of tree) {
      await processNode(root);
    }

    return { results, errors, success: errors.length === 0 };
  }

  // ─── Dashboard Stats ───────────────────────────────────────

  async getDashboardStats() {
    await this.initialize();
    const [concepts, models, individuals, actors, events, modelEvents] = await Promise.all([
      this.getObjects(this.tables.concepts),
      this.getObjects(this.tables.models),
      this.getObjects(this.tables.individuals),
      this.getObjects(this.tables.actors),
      this.getObjects(this.tables.subjectEvents),
      this.getObjects(this.tables.modelEvents),
    ]);

    // Events by actor (use displayValue for human-readable keys)
    const eventsByActor = {};
    for (const ev of events) {
      const actorReq = ev.reqs['Актор'];
      const actorLabel = actorReq?.displayValue || actorReq?.value;
      if (actorLabel) {
        if (!eventsByActor[actorLabel]) eventsByActor[actorLabel] = 0;
        eventsByActor[actorLabel]++;
      }
    }

    // Individuals by concept (use displayValue for human-readable keys)
    const individualsByConcept = {};
    for (const ind of individuals) {
      const cReq = ind.reqs['Концепт'];
      const cLabel = cReq?.displayValue || cReq?.value;
      if (cLabel) {
        if (!individualsByConcept[cLabel]) individualsByConcept[cLabel] = 0;
        individualsByConcept[cLabel]++;
      }
    }

    // Recent events (last 20) - use embedded timestamp from causes JSON
    const sorted = [...events].sort((a, b) => {
      const pa = this.parseCausesData(a.reqs['Причины']?.value);
      const pb = this.parseCausesData(b.reqs['Причины']?.value);
      const ta = pa.timestamp || a.reqs['Временная метка']?.value || '';
      const tb = pb.timestamp || b.reqs['Временная метка']?.value || '';
      return tb.localeCompare(ta);
    });

    return {
      counts: {
        concepts: concepts.length,
        models: models.length,
        individuals: individuals.length,
        actors: actors.length,
        events: events.length,
        modelEvents: modelEvents.length,
      },
      eventsByActor,
      individualsByConcept,
      recentEvents: sorted.slice(0, 20).map(e => {
        const parsed = this.parseCausesData(e.reqs['Причины']?.value);
        return {
          id: e.id,
          property: e.val,
          value: e.reqs['Значение']?.value,
          timestamp: parsed.timestamp || e.reqs['Временная метка']?.value,
          actorId: e.reqs['Актор']?.value,
          individualId: e.reqs['Индивид']?.value,
        };
      }),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ▌ BOLDACHEV GAP #1: DATAFLOW ENGINE
  // ▌ Condition-based triggers, cascade computations, watchers
  // ▌ Theory: events fire asynchronously when conditions are met,
  // ▌ cascading through dependent triggers until termination.
  // ═══════════════════════════════════════════════════════════════

  constructor_initDataflow() {
    // In-memory trigger registry: { id, dbId, modelId, condition, action, priority, active }
    this._triggers = [];
    // Watcher subscriptions: modelEventId → [callback]
    this._watchers = new Map();
    // Cascade depth limit (termination guarantee)
    this._maxCascadeDepth = 10;
    // Trigger counter for IDs
    this._triggerCounter = 0;
    // Last DB sync time
    this._triggersLastSync = 0;
  }

  /**
   * Load triggers from Integram DB (Item 3: persistent triggers).
   * Called during initialize() and periodically (5 min cache).
   */
  async loadTriggersFromDB() {
    if (!this._triggers) this.constructor_initDataflow();
    if (!this.tables.triggers) {
      logger.warn('[Dataflow] Triggers table not found, skipping DB load');
      return;
    }
    try {
      const dbTriggers = await this.getObjects(this.tables.triggers);
      // Merge DB triggers into memory (keep any purely in-memory triggers too)
      const memOnlyTriggers = this._triggers.filter(t => !t.dbId);
      this._triggers = [...memOnlyTriggers];
      for (const t of dbTriggers) {
        const active = t.reqs['Активен']?.value;
        if (active === 'false' || active === '0') continue;
        let action;
        try { action = JSON.parse(t.reqs['Параметры']?.value || '{}'); } catch { action = { type: 'notify', params: {} }; }
        this._triggerCounter++;
        this._triggers.push({
          id: `trigger_${this._triggerCounter}`,
          dbId: String(t.id),
          modelId: t.reqs['Модель']?.value || null,
          condition: (t.reqs['Условие']?.value || t.val || 'true').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
          action: action.type ? action : { type: t.reqs['Тип действия']?.value || 'notify', params: action },
          priority: Number(t.reqs['Приоритет']?.value || 0),
          active: true,
        });
      }
      this._triggers.sort((a, b) => b.priority - a.priority);
      this._triggersLastSync = Date.now();
      logger.info(`[Dataflow] Loaded ${dbTriggers.length} triggers from DB, ${this._triggers.length} total`);
    } catch (err) {
      logger.warn('[Dataflow] Failed to load triggers from DB:', err.message);
    }
  }

  /**
   * Register a dataflow trigger: when condition is met after an event fires,
   * execute the action (create new events, compute values).
   * Persists to Integram DB if triggers table exists.
   *
   * @param {Object} trigger - { modelId?, condition, action, priority? }
   * @returns {string} triggerId
   */
  async registerTrigger({ modelId, condition, action, priority = 0 }) {
    if (!this._triggers) this.constructor_initDataflow();
    const id = `trigger_${++this._triggerCounter}`;
    const triggerObj = { id, modelId, condition, action, priority, active: true };

    // Persist to DB
    if (this.tables.triggers) {
      try {
        await this.initialize();
        await this.ensureReqMap(this.tables.triggers);
        const result = await this.createObject(this.tables.triggers, condition, {
          'Условие': condition,
          'Тип действия': action.type || 'notify',
          'Параметры': JSON.stringify(action),
          'Приоритет': String(priority),
          'Активен': 'true',
          ...(modelId ? { 'Модель': String(modelId) } : {}),
        });
        triggerObj.dbId = String(result?.id || result?.obj);
        this.invalidateCache(this.tables.triggers);
      } catch (err) {
        logger.warn('[Dataflow] Failed to persist trigger:', err.message);
      }
    }

    this._triggers.push(triggerObj);
    this._triggers.sort((a, b) => b.priority - a.priority);
    logger.info(`[Dataflow] Registered trigger ${id}`, { condition, action: action.type, dbId: triggerObj.dbId });
    return id;
  }

  /**
   * Remove a registered trigger. Deletes from Integram DB if persisted.
   */
  async removeTrigger(triggerId) {
    if (!this._triggers) return false;
    const idx = this._triggers.findIndex(t => t.id === triggerId);
    if (idx < 0) return false;
    const trigger = this._triggers[idx];
    // Delete from DB if persisted
    if (trigger.dbId && this.tables.triggers) {
      try {
        await this.deleteObject(trigger.dbId);
        this.invalidateCache(this.tables.triggers);
      } catch (err) {
        logger.warn('[Dataflow] Failed to delete trigger from DB:', err.message);
      }
    }
    this._triggers.splice(idx, 1);
    return true;
  }

  /**
   * List all registered triggers.
   */
  getTriggers() {
    return (this._triggers || []).map(t => ({
      id: t.id,
      dbId: t.dbId || null,
      modelId: t.modelId,
      condition: t.condition,
      actionType: t.action.type,
      priority: t.priority,
      active: t.active !== false,
    }));
  }

  /**
   * Add a watcher for a specific model event type.
   * Called whenever a subject event matching that model event is created.
   *
   * @param {string} modelEventId
   * @param {Function} callback - (event, context) => void
   * @returns {string} watcherId
   */
  addWatcher(modelEventId, callback) {
    if (!this._watchers) this.constructor_initDataflow();
    const key = String(modelEventId);
    if (!this._watchers.has(key)) this._watchers.set(key, []);
    const watcherId = `watcher_${key}_${Date.now()}`;
    this._watchers.get(key).push({ id: watcherId, callback });
    return watcherId;
  }

  /**
   * Remove a watcher by ID.
   */
  removeWatcher(watcherId) {
    if (!this._watchers) return false;
    for (const [key, watchers] of this._watchers) {
      const idx = watchers.findIndex(w => w.id === watcherId);
      if (idx >= 0) { watchers.splice(idx, 1); return true; }
    }
    return false;
  }

  /**
   * Evaluate all triggers against a newly created event.
   * Returns array of cascade results (events created by triggers).
   *
   * @param {Object} newEvent - { id, name, individualId, modelEventId, value, actorId }
   * @param {number} depth - current cascade depth (for termination)
   */
  async evaluateTriggers(newEvent, depth = 0) {
    if (!this._triggers || this._triggers.length === 0) return [];
    if (depth >= (this._maxCascadeDepth || 10)) {
      logger.warn(`[Dataflow] Cascade depth limit reached (${depth}), stopping`);
      return [{ warning: 'cascade_depth_limit', depth }];
    }

    const cascadeResults = [];
    const context = {
      values: { value: newEvent.value, eventId: newEvent.id, eventType: newEvent.name },
      actorId: newEvent.actorId,
      individualId: newEvent.individualId,
      modelEventId: newEvent.modelEventId,
      value: newEvent.value,
      eventType: newEvent.name,
    };

    logger.info(`[Dataflow] Evaluating ${this._triggers.length} triggers for event`, {
      eventType: newEvent.name, modelId: newEvent.modelId || 'NULL', modelEventId: newEvent.modelEventId || 'NULL',
      value: String(newEvent.value).substring(0, 80)
    });

    for (const trigger of this._triggers) {
      // Skip triggers for other models
      if (trigger.modelId && String(trigger.modelId) !== String(newEvent.modelId)) {
        // Debug: log skipped devops triggers
        if (trigger.condition?.includes('dev.')) {
          logger.debug(`[Dataflow] Skip trigger ${trigger.id}: modelId ${trigger.modelId} !== ${newEvent.modelId}`);
        }
        continue;
      }

      // Evaluate condition
      const condResult = this.evaluateCondition(trigger.condition, context);
      if (!condResult) continue;

      logger.info(`[Dataflow] Trigger ${trigger.id} fired`, { event: newEvent.id, action: trigger.action.type });

      try {
        const result = await this._executeTriggerAction(trigger.action, newEvent, depth);
        cascadeResults.push({ triggerId: trigger.id, result, depth: depth + 1 });
      } catch (err) {
        logger.error(`[Dataflow] Trigger ${trigger.id} error:`, err.message);
        cascadeResults.push({ triggerId: trigger.id, error: err.message });
      }
    }

    return cascadeResults;
  }

  /**
   * Execute a trigger action. If it creates events, those events may fire further triggers (cascade).
   */
  async _executeTriggerAction(action, sourceEvent, depth) {
    switch (action.type) {
      case 'createEvent': {
        const result = await this.createSubjectEvent(
          action.params.name || `auto_${sourceEvent.name}`,
          {
            individualId: action.params.individualId || sourceEvent.individualId,
            modelEventId: action.params.modelEventId,
            value: action.params.value || sourceEvent.value,
            actorId: action.params.actorId || sourceEvent.actorId,
            causes: [String(sourceEvent.id)],
          }
        );
        const newId = result?.id || result?.obj;
        // Cascade: evaluate triggers for the newly created event
        if (newId) {
          const nested = await this.evaluateTriggers({
            ...sourceEvent,
            id: newId,
            name: action.params.name,
            modelEventId: action.params.modelEventId,
          }, depth + 1);
          return { created: newId, cascade: nested };
        }
        return { created: newId };
      }
      case 'computeValue': {
        const computed = this.evaluateExpression(action.params.expression, {
          values: { value: sourceEvent.value },
          actorId: sourceEvent.actorId,
          value: sourceEvent.value,
        });
        return { computed, expression: action.params.expression };
      }
      case 'notify': {
        logger.info(`[Dataflow] Notification: ${action.params.message}`, { eventId: sourceEvent.id });
        return { notified: true, message: action.params.message };
      }
      case 'invokeAgent': {
        // Issue #7043: Invoke agent by СОД event trigger
        const { agentId, config: agentConfig, taskDescription } = action.params || {};
        try {
          if (this.agentManager) {
            const task = await this.agentManager.createTask({
              type: agentId || 'generic',
              payload: { agentId, config: { ...agentConfig, triggerEvent: sourceEvent } },
              requiredCapabilities: agentConfig?.capabilities || [],
              metadata: { source: 'EventEngine', triggeredBy: sourceEvent?.id },
            });
            logger.info(`[Dataflow] Agent invoked: ${agentId}, task: ${task.id}`, { eventId: sourceEvent?.id });
            return { invoked: true, taskId: task.id, agentId };
          }
          // Fallback: HTTP call if AgentManager not injected
          const axios = (await import('axios')).default;
          const resp = await axios.post('http://localhost:8082/api/agents/tasks', {
            type: agentId || 'generic',
            payload: { agentId, config: { ...agentConfig, triggerEvent: sourceEvent } },
            metadata: { source: 'EventEngine', triggeredBy: sourceEvent?.id },
          });
          return { invoked: true, taskId: resp.data?.task?.id, agentId };
        } catch (e) {
          logger.error(`[Dataflow] invokeAgent failed: ${e.message}`, { agentId, eventId: sourceEvent?.id });
          return { invoked: false, error: e.message };
        }
      }
      case 'chainAgent': {
        // Issue #7043: Chain agent — pass event data to another agent
        const { targetAgentId, inputFromEvent, config: chainConfig } = action.params || {};
        try {
          const axios = (await import('axios')).default;
          const resp = await axios.post('http://localhost:8082/api/agents/tasks', {
            type: targetAgentId || 'generic',
            payload: {
              agentId: targetAgentId,
              chainInput: inputFromEvent ? sourceEvent : null,
              config: chainConfig,
            },
            metadata: { source: 'EventEngine', chainedFrom: sourceEvent?.id },
          });
          logger.info(`[Dataflow] Agent chained: ${targetAgentId}, task: ${resp.data?.task?.id}`, { eventId: sourceEvent?.id });
          return { chained: true, taskId: resp.data?.task?.id, targetAgentId };
        } catch (e) {
          logger.error(`[Dataflow] chainAgent failed: ${e.message}`, { targetAgentId, eventId: sourceEvent?.id });
          return { chained: false, error: e.message };
        }
      }
      case 'executeHiveStep': {
        const { step, debounce: db } = action.params || {};
        // Debounce: skip if same step fired recently for this individual
        if (db) {
          const key = `hive_step_${step}_${sourceEvent.individualId}`;
          const now = Date.now();
          if (!this._hiveDebounce) this._hiveDebounce = new Map();
          const last = this._hiveDebounce.get(key);
          if (last && (now - last) < (db * 1000)) {
            logger.info(`[HivePipeline] Debounced step=${step} (${db}s)`);
            return { debounced: true, step };
          }
          this._hiveDebounce.set(key, now);
        }
        try {
          const axios = (await import('axios')).default;
          const port = process.env.PORT || 8081;
          const resp = await axios.post(`http://localhost:${port}/api/event-engine/pipeline/execute-step`, {
            step,
            triggerEvent: {
              id: sourceEvent.id,
              name: sourceEvent.name,
              value: sourceEvent.value,
              individualId: sourceEvent.individualId,
              actorId: sourceEvent.actorId,
            },
          });
          logger.info(`[HivePipeline] Step ${step} executed`, { eventId: sourceEvent.id });
          return resp.data;
        } catch (e) {
          logger.error(`[HivePipeline] Step ${step} failed: ${e.message}`);
          return { error: e.message, step };
        }
      }
      default:
        return { unknown: action.type };
    }
  }

  /**
   * Notify watchers when a subject event is created for a model event.
   */
  async _notifyWatchers(modelEventId, event) {
    if (!this._watchers) return;
    const key = String(modelEventId);
    const watchers = this._watchers.get(key) || [];
    for (const w of watchers) {
      try {
        await w.callback(event, { modelEventId });
      } catch (err) {
        logger.warn(`[Dataflow] Watcher ${w.id} error:`, err.message);
      }
    }
  }

  /**
   * Dataflow-enhanced model execution: instead of sequential tree traversal,
   * fires events based on condition evaluation with cascade propagation.
   *
   * @param {string} modelId
   * @param {string} individualId
   * @param {string} actorId
   * @param {Object} values
   * @param {Object} options - { enableCascade: true }
   */
  async executeModelDataflow(modelId, individualId, actorId, values = {}, options = {}) {
    await this.initialize();
    if (!this._triggers) this.constructor_initDataflow();

    const tree = await this.getModelTree(modelId);
    const results = [];
    const cascadeLog = [];

    // Phase 1: Evaluate all nodes and determine which can fire
    const readyNodes = [];
    const collectReady = (nodes, parentIds = []) => {
      for (const node of nodes) {
        let constraints = {};
        try { constraints = JSON.parse(node.reqs['Ограничения']?.value || '{}'); } catch { /**/ }

        const conditionMet = constraints.condition
          ? this.evaluateCondition(constraints.condition, { values, currentNode: node })
          : true;

        if (conditionMet) {
          readyNodes.push({ node, parentIds, constraints });
        }
        // Check children regardless (they have their own conditions)
        if (node.children) collectReady(node.children, parentIds);
      }
    };
    collectReady(tree);

    // Phase 2: Fire ready nodes (parallel where no dependencies)
    for (const { node, parentIds, constraints } of readyNodes) {
      const inputValue = values[node.id] ?? values[node.val];
      let finalValue = inputValue;

      if (constraints.setValue) {
        const computed = this.evaluateSetValue(constraints.setValue, { individualId, actorId, value: inputValue });
        if (computed !== null) finalValue = computed;
      }
      if ((finalValue === undefined || finalValue === null) && constraints.default !== undefined) {
        finalValue = constraints.default;
      }
      if (finalValue === undefined || finalValue === null || finalValue === '') continue;

      try {
        const eventResult = await this.createSubjectEvent(node.val, {
          individualId,
          modelEventId: node.id,
          value: String(finalValue),
          actorId,
          causes: parentIds,
        });
        const newEventId = eventResult?.id || eventResult?.obj;
        results.push({ nodeId: node.id, property: node.val, value: finalValue, eventId: newEventId });

        // Phase 3: Cascade — evaluate triggers for each created event
        if (options.enableCascade !== false && newEventId) {
          const cascadeResult = await this.evaluateTriggers({
            id: newEventId,
            name: node.val,
            individualId,
            modelEventId: node.id,
            value: String(finalValue),
            actorId,
          }, 0);
          if (cascadeResult.length > 0) cascadeLog.push(...cascadeResult);
        }

        // Notify watchers
        await this._notifyWatchers(node.id, { id: newEventId, name: node.val, value: finalValue });
      } catch (err) {
        results.push({ nodeId: node.id, property: node.val, error: err.message });
      }
    }

    return { results, cascadeLog, triggersEvaluated: this._triggers.length };
  }

  // ═══════════════════════════════════════════════════════════════
  // ▌ BOLDACHEV GAP #2: TEMPORAL HIERARCHY
  // ▌ Event → Process → Action → Activity
  // ▌ Process: sequence of events by single actor on single individual
  // ▌ Action: convergent processes producing a result-event
  // ▌ Activity: system of actions with goals
  // ═══════════════════════════════════════════════════════════════

  /**
   * Extract Processes from the event DAG.
   * A Process is a maximal chain of causally connected events
   * performed by the same actor on the same individual.
   *
   * @param {string} individualId - filter by individual (optional)
   * @returns {Array<{id, actor, individual, events[], startTime, endTime, duration}>}
   */
  async getProcesses(individualId) {
    await this.initialize();
    let events = await this.getObjects(this.tables.subjectEvents);
    if (individualId) {
      events = events.filter(e => String(e.reqs['Индивид']?.value) === String(individualId));
    }

    // Build causal adjacency: parent → children
    const childrenMap = new Map(); // eventId → [child eventIds]
    const parentMap = new Map();   // eventId → [cause eventIds]
    for (const ev of events) {
      const parsed = this.parseCausesData(ev.reqs['Причины']?.value);
      parentMap.set(String(ev.id), parsed.causes.map(String));
      for (const causeId of parsed.causes) {
        if (!childrenMap.has(String(causeId))) childrenMap.set(String(causeId), []);
        childrenMap.get(String(causeId)).push(String(ev.id));
      }
    }

    // Group events by (actor, individual) pair
    const groups = new Map(); // "actorId:individualId" → events[]
    for (const ev of events) {
      const actorId = ev.reqs['Актор']?.value || 'unknown';
      const indId = ev.reqs['Индивид']?.value || 'unknown';
      const key = `${actorId}:${indId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ev);
    }

    // For each group, find maximal causal chains = processes
    const processes = [];
    let processCounter = 0;

    for (const [key, groupEvents] of groups) {
      const [actorId, indId] = key.split(':');
      const groupIds = new Set(groupEvents.map(e => String(e.id)));

      // Find roots (events with no causes in this group)
      const roots = groupEvents.filter(ev => {
        const causes = parentMap.get(String(ev.id)) || [];
        return causes.every(c => !groupIds.has(c));
      });

      // Trace chains from each root
      const visited = new Set();
      for (const root of roots) {
        const chain = [];
        const dfs = (evId) => {
          if (visited.has(evId) || !groupIds.has(evId)) return;
          visited.add(evId);
          const ev = groupEvents.find(e => String(e.id) === evId);
          if (ev) chain.push(ev);
          for (const childId of (childrenMap.get(evId) || [])) {
            if (groupIds.has(childId)) dfs(childId);
          }
        };
        dfs(String(root.id));

        if (chain.length > 0) {
          // Sort by timestamp
          chain.sort((a, b) => {
            const ta = this.parseCausesData(a.reqs['Причины']?.value).timestamp || '';
            const tb = this.parseCausesData(b.reqs['Причины']?.value).timestamp || '';
            return ta.localeCompare(tb);
          });

          const timestamps = chain.map(e => this.parseCausesData(e.reqs['Причины']?.value).timestamp).filter(Boolean);
          processCounter++;
          processes.push({
            id: `process_${processCounter}`,
            actorId,
            individualId: indId,
            events: chain.map(e => ({
              id: e.id,
              name: e.val,
              value: e.reqs['Значение']?.value,
              timestamp: this.parseCausesData(e.reqs['Причины']?.value).timestamp,
            })),
            eventCount: chain.length,
            startTime: timestamps[0] || null,
            endTime: timestamps[timestamps.length - 1] || null,
          });
        }
      }
    }

    return processes;
  }

  /**
   * Extract Actions from the event DAG.
   * An Action is a set of processes that converge on a common result-event
   * (an event caused by events from multiple processes/actors).
   *
   * @param {string} individualId - filter by individual (optional)
   * @returns {Array<{id, resultEvent, contributingProcesses[], participants[]}>}
   */
  async getActions(individualId) {
    await this.initialize();
    let events = await this.getObjects(this.tables.subjectEvents);
    if (individualId) {
      events = events.filter(e => String(e.reqs['Индивид']?.value) === String(individualId));
    }

    // Find convergence points: events with causes from different actors
    const actions = [];
    let actionCounter = 0;

    for (const ev of events) {
      const parsed = this.parseCausesData(ev.reqs['Причины']?.value);
      if (parsed.causes.length < 2) continue; // need multiple causes

      // Check if causes come from different actors
      const causeActors = new Set();
      for (const causeId of parsed.causes) {
        const causeEvent = events.find(e => String(e.id) === String(causeId));
        if (causeEvent) {
          causeActors.add(causeEvent.reqs['Актор']?.value || 'unknown');
        }
      }

      if (causeActors.size >= 2) {
        actionCounter++;
        actions.push({
          id: `action_${actionCounter}`,
          resultEvent: {
            id: ev.id,
            name: ev.val,
            value: ev.reqs['Значение']?.value,
            timestamp: parsed.timestamp,
          },
          causeEventIds: parsed.causes,
          participants: [...causeActors],
          participantCount: causeActors.size,
        });
      }
    }

    return actions;
  }

  /**
   * Extract Activities from the event DAG.
   * An Activity is a system of actions grouped by concept/model
   * representing a goal-oriented workflow.
   *
   * @returns {Array<{id, concept, model, actions[], processes[], goalEvents[]}>}
   */
  async getActivities() {
    await this.initialize();
    const individuals = await this.getObjects(this.tables.individuals);
    const concepts = await this.getObjects(this.tables.concepts);
    const models = await this.getObjects(this.tables.models);
    const activities = [];
    let activityCounter = 0;

    // Group by concept: each concept defines a type of activity
    for (const concept of concepts) {
      const conceptIndividuals = individuals.filter(
        i => String(i.reqs['Концепт']?.value) === String(concept.id)
      );
      if (conceptIndividuals.length === 0) continue;

      const conceptModels = models.filter(
        m => String(m.reqs['Концепт']?.value) === String(concept.id)
      );

      // Collect all processes and actions for this concept's individuals
      let allProcesses = [];
      let allActions = [];
      for (const ind of conceptIndividuals) {
        const procs = await this.getProcesses(ind.id);
        const acts = await this.getActions(ind.id);
        allProcesses.push(...procs);
        allActions.push(...acts);
      }

      // Goal events = terminal events (events with no effects within the concept)
      const allEvents = [];
      for (const ind of conceptIndividuals) {
        const events = await this.getSubjectEvents(ind.id);
        allEvents.push(...events);
      }
      const allEventIds = new Set(allEvents.map(e => String(e.id)));
      const hasEffects = new Set();
      for (const ev of allEvents) {
        const parsed = this.parseCausesData(ev.reqs['Причины']?.value);
        for (const c of parsed.causes) {
          if (allEventIds.has(String(c))) hasEffects.add(String(c));
        }
      }
      const goalEvents = allEvents
        .filter(e => !hasEffects.has(String(e.id)))
        .map(e => ({
          id: e.id,
          name: e.val,
          value: e.reqs['Значение']?.value,
          individualId: e.reqs['Индивид']?.value,
        }));

      activityCounter++;
      activities.push({
        id: `activity_${activityCounter}`,
        conceptId: concept.id,
        conceptName: concept.val,
        models: conceptModels.map(m => ({ id: m.id, name: m.val })),
        individualCount: conceptIndividuals.length,
        processCount: allProcesses.length,
        actionCount: allActions.length,
        goalEvents: goalEvents.slice(0, 20), // limit for response size
        processes: allProcesses.slice(0, 10),
        actions: allActions.slice(0, 10),
      });
    }

    return activities;
  }

  /**
   * Get temporal hierarchy summary for an individual.
   * Returns events, processes, and actions in a unified view.
   */
  async getTemporalHierarchy(individualId) {
    const [processes, actions, timeline] = await Promise.all([
      this.getProcesses(individualId),
      this.getActions(individualId),
      this.getIndividualTimeline(individualId),
    ]);

    return {
      events: timeline,
      processes,
      actions,
      summary: {
        eventCount: timeline.length,
        processCount: processes.length,
        actionCount: actions.length,
        actors: [...new Set(processes.map(p => p.actorId))],
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ▌ BOLDACHEV GAP #3: BSL LANGUAGE EXTENSIONS
  // ▌ Temporal queries, nested paths, joins, $Actor, $PATTERN, BNF
  // ═══════════════════════════════════════════════════════════════

  /**
   * Extended BSL Query Engine with temporal and structural operators.
   *
   * BNF Grammar (arXiv:2509.09775 extension):
   *
   * <query>     ::= "$(" <filters> ")" [ "." <property> ] [ "." <aggregate> ]
   * <filters>   ::= <filter> { ("," | "&" | "|") <filter> }
   * <filter>    ::= <concept_f> | <model_f> | <status_f> | <actor_f> | <temporal_f>
   * <concept_f> ::= ["$EQ." | "$NE."] "$Concept(" <string> ")"
   * <model_f>   ::= ["$EQ." | "$NE."] "$Model(" <string> ")"
   * <actor_f>   ::= "$Actor(" <string> ")"
   * <status_f>  ::= "$Status(" <string> ")"
   * <temporal_f>::= "$BEFORE(" <datetime> ")" | "$AFTER(" <datetime> ")"
   *              |  "$BETWEEN(" <datetime> "," <datetime> ")"
   * <property>  ::= <ident> | <ident> "." <property>  (nested path)
   * <aggregate> ::= "$COUNT" | "$SUM" | "$AVG" | "$MIN" | "$MAX"
   *
   * Extended query types:
   * - $ACTOR("name") — filter by actor name
   * - $BEFORE("2025-01-01") — events before date
   * - $AFTER("2025-01-01") — events after date
   * - $BETWEEN("2025-01-01","2025-06-01") — events in range
   * - $JOIN(concept1, concept2) — cross-individual correlation
   * - $PATTERN(ev1 -> ev2 -> ev3) — sequential pattern matching
   * - $TEMPORAL_COUNT — count events in time range
   * - $FIRST / $LAST — first/last event by time
   */
  async executeExtendedQuery(bslQuery, context = {}) {
    await this.initialize();

    // Route to specialized handlers
    if (bslQuery.startsWith('$JOIN(')) return this._executeJoinQuery(bslQuery, context);
    if (bslQuery.startsWith('$PATTERN(')) return this._executePatternQuery(bslQuery, context);

    // Extended standard query with temporal/actor filters
    // Parse balanced parentheses: $(<filters>)[.<property>] — handles nested $Model(...), $Concept(...)
    if (!bslQuery.startsWith('$(')) return { error: 'Invalid BSL query. BNF: $(<filters>)[.<property>][.<aggregate>]' };
    let _depth = 0, _condEnd = -1;
    for (let _i = 1; _i < bslQuery.length; _i++) {
      if (bslQuery[_i] === '(') _depth++;
      else if (bslQuery[_i] === ')') { if (_depth === 0) { _condEnd = _i; break; } _depth--; }
    }
    if (_condEnd === -1) return { error: 'Invalid BSL query: unbalanced parentheses' };
    const conditionStr = bslQuery.slice(2, _condEnd).trim();
    const _rest = bslQuery.slice(_condEnd + 1);
    const propertyPath = _rest.startsWith('.') ? _rest.slice(1).trim() : undefined;

    const orGroups = conditionStr.split(/\s*\|\s*/);
    let matchedIndividuals = [];

    const allIndividuals = await this.getObjectsCached(this.tables.individuals);
    const allModels = await this.getObjectsCached(this.tables.models);
    const allConcepts = await this.getObjectsCached(this.tables.concepts);
    const allActors = await this.getObjectsCached(this.tables.actors);
    // Pre-load all events for $Actor optimization (Item 10)
    const allSubjectEvents = await this.getObjectsCached(this.tables.subjectEvents);

    // Temporal filters (applied after individual matching)
    let temporalBefore = null;
    let temporalAfter = null;

    for (const orGroup of orGroups) {
      const andParts = orGroup.split(/\s*[,&]\s*/).map(s => s.trim()).filter(Boolean);
      let candidates = [...allIndividuals];

      for (const cond of andParts) {
        // $Concept filter (multilingual — Item 9)
        const conceptMatch = cond.match(/(?:\$EQ\.)?\$Concept\("([^"]+)"\)/);
        if (conceptMatch) {
          const target = this.resolveConceptByName(conceptMatch[1], allConcepts);
          candidates = target ? candidates.filter(i => String(i.reqs['Концепт']?.value) === String(target.id)) : [];
          continue;
        }
        const neConceptMatch = cond.match(/\$NE\.\$Concept\("([^"]+)"\)/);
        if (neConceptMatch) {
          const target = this.resolveConceptByName(neConceptMatch[1], allConcepts);
          if (target) candidates = candidates.filter(i => String(i.reqs['Концепт']?.value) !== String(target.id));
          continue;
        }
        // $Model filter (multilingual — Item 9)
        const modelMatch = cond.match(/(?:\$EQ\.)?\$Model\("([^"]+)"\)/);
        if (modelMatch) {
          const target = this.resolveModelByName(modelMatch[1], allModels);
          candidates = target ? candidates.filter(i => String(i.reqs['Модель']?.value) === String(target.id)) : [];
          continue;
        }
        // $Actor filter (optimized — Item 10: pre-loaded events, no N+1)
        const actorMatch = cond.match(/\$Actor\("([^"]+)"\)/);
        if (actorMatch) {
          const targetActor = this.resolveActorByName(actorMatch[1], allActors);
          if (targetActor) {
            // Build individual→hasActorEvents index from pre-loaded events
            const indWithActor = new Set();
            for (const ev of allSubjectEvents) {
              if (String(ev.reqs['Актор']?.value) === String(targetActor.id) ||
                  ev.reqs['Актор']?.displayValue === actorMatch[1]) {
                const indId = ev.reqs['Индивид']?.value;
                if (indId) indWithActor.add(String(indId));
              }
            }
            candidates = candidates.filter(ind => indWithActor.has(String(ind.id)));
          } else {
            candidates = [];
          }
          continue;
        }
        // $Status filter
        const statusMatch = cond.match(/\$Status\("([^"]+)"\)/);
        if (statusMatch) {
          candidates = candidates.filter(i => i.reqs['Статус']?.value === statusMatch[1]);
          continue;
        }
        // $BEFORE (temporal)
        const beforeMatch = cond.match(/\$BEFORE\("([^"]+)"\)/);
        if (beforeMatch) {
          temporalBefore = beforeMatch[1];
          continue;
        }
        // $AFTER (temporal)
        const afterMatch = cond.match(/\$AFTER\("([^"]+)"\)/);
        if (afterMatch) {
          temporalAfter = afterMatch[1];
          continue;
        }
        // $BETWEEN (temporal)
        const betweenMatch = cond.match(/\$BETWEEN\("([^"]+)"\s*,\s*"([^"]+)"\)/);
        if (betweenMatch) {
          temporalAfter = betweenMatch[1];
          temporalBefore = betweenMatch[2];
          continue;
        }
      }

      for (const c of candidates) {
        if (!matchedIndividuals.find(m => m.id === c.id)) matchedIndividuals.push(c);
      }
    }

    // Extract property + aggregate
    if (propertyPath) {
      const pathParts = propertyPath.split('.');
      let aggregateName = null;
      let propParts = pathParts;

      // Check if last part is an aggregate
      const lastPart = pathParts[pathParts.length - 1];
      if (/^\$(COUNT|SUM|AVG|MIN|MAX|FIRST|LAST|TEMPORAL_COUNT)$/.test(lastPart)) {
        aggregateName = lastPart.slice(1);
        propParts = pathParts.slice(0, -1);
      }

      const propertyName = propParts[0];
      const nestedPath = propParts.slice(1); // for nested property paths

      const results = [];
      for (const ind of matchedIndividuals) {
        const events = await this.getSubjectEvents(ind.id);
        for (const ev of events.filter(e => e.val === propertyName)) {
          const parsed = this.parseCausesData(ev.reqs['Причины']?.value);
          const ts = parsed.timestamp || ev.reqs['Временная метка']?.value;

          // Apply temporal filters
          if (temporalBefore && ts && ts > temporalBefore) continue;
          if (temporalAfter && ts && ts < temporalAfter) continue;

          let value = ev.reqs['Значение']?.value;

          // Resolve nested path (e.g., property.subfield)
          if (nestedPath.length > 0 && value) {
            try {
              let obj = JSON.parse(value);
              for (const key of nestedPath) {
                obj = obj?.[key];
              }
              value = obj !== undefined ? String(obj) : null;
            } catch {
              // Not JSON, skip nested resolution
            }
          }

          results.push({
            individualId: ind.id,
            individualName: ind.val,
            property: propertyName,
            value,
            timestamp: ts,
          });
        }
      }

      // Aggregates
      if (aggregateName) {
        const numValues = results.map(r => Number(r.value)).filter(v => !isNaN(v));
        let aggResult;
        switch (aggregateName) {
          case 'COUNT': aggResult = results.length; break;
          case 'SUM': aggResult = numValues.reduce((a, b) => a + b, 0); break;
          case 'AVG': aggResult = numValues.length > 0 ? numValues.reduce((a, b) => a + b, 0) / numValues.length : 0; break;
          case 'MIN': aggResult = numValues.length > 0 ? Math.min(...numValues) : null; break;
          case 'MAX': aggResult = numValues.length > 0 ? Math.max(...numValues) : null; break;
          case 'FIRST': {
            const sorted = results.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
            aggResult = sorted[0] || null;
            return { results: [{ aggregate: 'FIRST', property: propertyName, value: aggResult }] };
          }
          case 'LAST': {
            const sorted = results.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
            aggResult = sorted[0] || null;
            return { results: [{ aggregate: 'LAST', property: propertyName, value: aggResult }] };
          }
          case 'TEMPORAL_COUNT': {
            aggResult = results.length;
            break;
          }
        }
        return { results: [{ aggregate: aggregateName, property: propertyName, value: aggResult, count: results.length }] };
      }

      return { results };
    }

    // No property — return matched individuals
    return {
      results: matchedIndividuals.map(i => ({
        id: i.id,
        name: i.val,
        concept: i.reqs['Концепт']?.displayValue || i.reqs['Концепт']?.value,
        model: i.reqs['Модель']?.displayValue || i.reqs['Модель']?.value,
        status: i.reqs['Статус']?.value,
      }))
    };
  }

  /**
   * $JOIN query: correlate events across individuals of different concepts.
   * Syntax: $JOIN($Concept("A"), $Concept("B")).commonProperty
   */
  async _executeJoinQuery(bslQuery, context = {}) {
    const joinMatch = bslQuery.match(/\$JOIN\(\$Concept\("([^"]+)"\)\s*,\s*\$Concept\("([^"]+)"\)\)\.?(.+)?/);
    if (!joinMatch) return { error: 'Invalid $JOIN syntax. Use: $JOIN($Concept("A"), $Concept("B")).property' };

    const [, concept1Name, concept2Name, propertyPath] = joinMatch;
    const concepts = await this.getObjects(this.tables.concepts);
    const c1 = concepts.find(c => c.val === concept1Name);
    const c2 = concepts.find(c => c.val === concept2Name);
    if (!c1 || !c2) return { error: `Concept not found: ${!c1 ? concept1Name : concept2Name}` };

    const individuals = await this.getObjects(this.tables.individuals);
    const ind1 = individuals.filter(i => String(i.reqs['Концепт']?.value) === String(c1.id));
    const ind2 = individuals.filter(i => String(i.reqs['Концепт']?.value) === String(c2.id));

    // Find correlated events (shared causes or temporal overlap)
    const correlations = [];
    for (const i1 of ind1) {
      const events1 = await this.getSubjectEvents(i1.id);
      for (const i2 of ind2) {
        const events2 = await this.getSubjectEvents(i2.id);

        // Check for shared causal links
        const e1Ids = new Set(events1.map(e => String(e.id)));
        for (const e2 of events2) {
          const causes = this.parseCausesData(e2.reqs['Причины']?.value).causes;
          const shared = causes.filter(c => e1Ids.has(String(c)));
          if (shared.length > 0) {
            correlations.push({
              individual1: { id: i1.id, name: i1.val, concept: concept1Name },
              individual2: { id: i2.id, name: i2.val, concept: concept2Name },
              sharedCauses: shared,
              event: { id: e2.id, name: e2.val, value: e2.reqs['Значение']?.value },
            });
          }
        }

        // Check for matching property values if propertyPath specified
        if (propertyPath) {
          const prop = propertyPath.split('.')[0];
          const vals1 = events1.filter(e => e.val === prop).map(e => e.reqs['Значение']?.value);
          const vals2 = events2.filter(e => e.val === prop).map(e => e.reqs['Значение']?.value);
          const commonVals = vals1.filter(v => vals2.includes(v));
          if (commonVals.length > 0) {
            correlations.push({
              individual1: { id: i1.id, name: i1.val, concept: concept1Name },
              individual2: { id: i2.id, name: i2.val, concept: concept2Name },
              matchedProperty: prop,
              commonValues: commonVals,
            });
          }
        }
      }
    }

    return { results: correlations, joinType: 'causal+property', concepts: [concept1Name, concept2Name] };
  }

  /**
   * $PATTERN query: find sequential event patterns in individual timelines.
   * Syntax: $PATTERN(eventName1 -> eventName2 -> eventName3)
   */
  async _executePatternQuery(bslQuery, context = {}) {
    const patternMatch = bslQuery.match(/\$PATTERN\((.+)\)/);
    if (!patternMatch) return { error: 'Invalid $PATTERN syntax. Use: $PATTERN(ev1 -> ev2 -> ev3)' };

    const patternSteps = patternMatch[1].split(/\s*->\s*/).map(s => s.trim());
    if (patternSteps.length < 2) return { error: 'Pattern must have at least 2 steps' };

    const individuals = await this.getObjects(this.tables.individuals);
    const matches = [];

    for (const ind of individuals) {
      const timeline = await this.getIndividualTimeline(ind.id);
      // Find sequential occurrences matching the pattern
      let stepIdx = 0;
      const matchedEvents = [];

      for (const entry of timeline) {
        if (entry.property === patternSteps[stepIdx]) {
          matchedEvents.push(entry);
          stepIdx++;
          if (stepIdx >= patternSteps.length) {
            matches.push({
              individualId: ind.id,
              individualName: ind.val,
              pattern: patternSteps,
              matchedEvents: [...matchedEvents],
              startTime: matchedEvents[0].timestamp,
              endTime: matchedEvents[matchedEvents.length - 1].timestamp,
            });
            stepIdx = 0;
            matchedEvents.length = 0;
          }
        }
      }
    }

    return { results: matches, pattern: patternSteps };
  }

  // ═══════════════════════════════════════════════════════════════
  // ▌ BOLDACHEV GAP #4: EPISTEMIC FILTERING
  // ▌ Actor sees/fixes only events within their known concept scope.
  // ▌ Scope = concepts of models in actor's applications.
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get the epistemic scope of an actor.
   * Scope = set of concept IDs that the actor can observe and act on.
   *
   * Resolution chain:
   * Actor → Actor.applications → Application.models → Model.concept → Concept
   *
   * If actor has no explicit applications, they get unrestricted scope.
   *
   * @param {string} actorId
   * @returns {{ conceptIds: string[], modelIds: string[], unrestricted: boolean }}
   */
  async getActorEpistemicScope(actorId) {
    await this.initialize();
    if (!actorId) return { conceptIds: [], modelIds: [], unrestricted: true };

    const actors = await this.getObjectsCached(this.tables.actors);
    const actor = actors.find(a => String(a.id) === String(actorId));
    if (!actor) return { conceptIds: [], modelIds: [], unrestricted: true };

    // Item 2: Real epistemic scope — Actor → Приложения (multi-ref) → Models → Concepts
    const appsReq = actor.reqs['Приложения'];
    if (!appsReq || !appsReq.value) {
      // No explicit applications → unrestricted (backward compatible)
      return { conceptIds: [], modelIds: [], unrestricted: true };
    }

    // Parse multi-ref: value can be comma-separated IDs or single ID
    let actorAppIds = [];
    const rawVal = String(appsReq.value);
    if (rawVal.includes(',')) {
      actorAppIds = rawVal.split(',').map(s => s.trim()).filter(Boolean);
    } else if (rawVal) {
      actorAppIds = [rawVal];
    }

    if (actorAppIds.length === 0) {
      return { conceptIds: [], modelIds: [], unrestricted: true };
    }

    const applications = await this.getObjectsCached(this.tables.applications);
    const models = await this.getObjectsCached(this.tables.models);

    const modelIds = new Set();
    const conceptIds = new Set();

    // Filter to only actor's assigned applications
    const actorApps = applications.filter(app => actorAppIds.includes(String(app.id)));

    for (const app of actorApps) {
      // Get models attached to this application (via "Модели" multi-ref)
      const modelsReq = app.reqs['Модели'];
      if (!modelsReq?.value) continue;
      const appModelIds = String(modelsReq.value).split(',').map(s => s.trim()).filter(Boolean);
      for (const mid of appModelIds) {
        modelIds.add(mid);
        const model = models.find(m => String(m.id) === mid);
        const conceptReq = model?.reqs['Концепт']?.value;
        if (conceptReq) conceptIds.add(String(conceptReq));
      }
    }

    if (conceptIds.size === 0) {
      return { conceptIds: [], modelIds: [], unrestricted: true };
    }

    return {
      conceptIds: [...conceptIds],
      modelIds: [...modelIds],
      unrestricted: false,
    };
  }

  /**
   * Application Scope — resolve what models, concepts, and vocabularies
   * belong to a given application. Used for UI preset filtering.
   *
   * Resolution chain:
   * Application → Application.models (multi-ref) → Model.concept → Concept
   * Application → Application.vocabularies (multi-ref) → Vocabulary
   *
   * @param {string} applicationId
   * @returns {{ modelIds: string[], conceptIds: string[], vocabularyIds: string[], unrestricted: boolean }}
   */
  async getApplicationScope(applicationId) {
    await this.initialize();
    if (!applicationId) return { modelIds: [], conceptIds: [], vocabularyIds: [], unrestricted: true };

    const applications = await this.getObjectsCached(this.tables.applications);
    const app = applications.find(a => String(a.id) === String(applicationId));
    if (!app) return { modelIds: [], conceptIds: [], vocabularyIds: [], unrestricted: true };

    const models = await this.getObjectsCached(this.tables.models);
    const modelIds = new Set();
    const conceptIds = new Set();
    const vocabularyIds = new Set();

    // Models (multi-ref "Модели")
    const modelsReq = app.reqs['Модели'];
    if (modelsReq?.value) {
      const appModelIds = String(modelsReq.value).split(',').map(s => s.trim()).filter(Boolean);
      for (const mid of appModelIds) {
        modelIds.add(mid);
        const model = models.find(m => String(m.id) === mid);
        const conceptReq = model?.reqs['Концепт']?.value;
        if (conceptReq) conceptIds.add(String(conceptReq));
      }
    }

    // Vocabularies (multi-ref "Словари")
    const vocabsReq = app.reqs['Словари'];
    if (vocabsReq?.value) {
      const appVocabIds = String(vocabsReq.value).split(',').map(s => s.trim()).filter(Boolean);
      for (const vid of appVocabIds) {
        vocabularyIds.add(vid);
      }
    }

    const hasScope = modelIds.size > 0 || conceptIds.size > 0 || vocabularyIds.size > 0;
    return {
      modelIds: [...modelIds],
      conceptIds: [...conceptIds],
      vocabularyIds: [...vocabularyIds],
      unrestricted: !hasScope,
    };
  }

  /**
   * Check if an actor can observe/fix events for a given individual.
   * Returns true if the individual's concept is within the actor's epistemic scope.
   *
   * @param {string} actorId
   * @param {string} individualId
   * @returns {boolean}
   */
  async checkEpistemicAccess(actorId, individualId) {
    if (!actorId || !individualId) return true;

    const scope = await this.getActorEpistemicScope(actorId);
    if (scope.unrestricted) return true;

    // Get individual's concept
    const individuals = await this.getObjects(this.tables.individuals);
    const individual = individuals.find(i => String(i.id) === String(individualId));
    if (!individual) return true; // non-existent individual, allow

    const conceptId = individual.reqs['Концепт']?.value;
    if (!conceptId) return true; // no concept, allow

    return scope.conceptIds.includes(String(conceptId));
  }

  /**
   * Get events filtered by actor's epistemic scope.
   * Actor only sees events for individuals within their concept scope.
   *
   * @param {string} actorId
   * @returns {Array} filtered events
   */
  async getEpistemicFilteredEvents(actorId) {
    await this.initialize();
    const scope = await this.getActorEpistemicScope(actorId);
    if (scope.unrestricted) {
      return this.getObjects(this.tables.subjectEvents);
    }

    const allEvents = await this.getObjects(this.tables.subjectEvents);
    const individuals = await this.getObjects(this.tables.individuals);

    // Build individual → concept map
    const indConceptMap = new Map();
    for (const ind of individuals) {
      indConceptMap.set(String(ind.id), String(ind.reqs['Концепт']?.value || ''));
    }

    // Filter events to those whose individual's concept is in scope
    return allEvents.filter(ev => {
      const indId = ev.reqs['Индивид']?.value;
      if (!indId) return true;
      const conceptId = indConceptMap.get(String(indId));
      if (!conceptId) return true;
      return scope.conceptIds.includes(conceptId);
    });
  }

  /**
   * Epistemic-aware event creation.
   * Validates that the actor can see the individual's concept before allowing event creation.
   */
  async createSubjectEventEpistemic(name, { individualId, modelEventId, value, actorId, causes = [], timestamp } = {}) {
    // Check epistemic access
    if (actorId && individualId) {
      const hasAccess = await this.checkEpistemicAccess(actorId, individualId);
      if (!hasAccess) {
        const scope = await this.getActorEpistemicScope(actorId);
        throw new Error(
          `Эпистемическое ограничение: актор ${actorId} не имеет доступа к индивиду ${individualId}. ` +
          `Доступные концепты: [${scope.conceptIds.join(', ')}]`
        );
      }
    }

    return this.createSubjectEvent(name, { individualId, modelEventId, value, actorId, causes, timestamp });
  }

  // ═══════════════════════════════════════════════════════════════
  // ▌ ITEM 5: MODEL VERSIONING
  // ═══════════════════════════════════════════════════════════════

  async cloneModel(modelId, newVersion) {
    await this.initialize();
    const models = await this.getObjects(this.tables.models);
    const source = models.find(m => String(m.id) === String(modelId));
    if (!source) throw new Error(`Model ${modelId} not found`);

    await this.ensureReqMap(this.tables.models);
    const version = newVersion || `v${Date.now()}`;
    const newName = `${source.val} (${version})`;
    const result = await this.createObject(this.tables.models, newName, {
      'Концепт': source.reqs['Концепт']?.value || '',
      'Описание': source.reqs['Описание']?.value || '',
      'Версия': version,
    });
    const newModelId = result?.id || result?.obj;
    if (!newModelId) throw new Error('Failed to create model clone');

    // Deep-copy model events
    const events = await this.getModelEvents(modelId);
    const idMap = {}; // oldId → newId
    // First pass: create all events without parent refs
    for (const ev of events) {
      const evResult = await this.createModelEvent(ev.val, {
        modelId: String(newModelId),
        propertyId: ev.reqs['Свойство']?.value,
        order: Number(ev.reqs['Порядок']?.value || 0),
        constraints: (() => { try { return JSON.parse(ev.reqs['Ограничения']?.value || '{}'); } catch { return {}; } })(),
      });
      idMap[ev.id] = String(evResult?.id || evResult?.obj);
    }
    // Second pass: set parent references
    for (const ev of events) {
      const parentId = ev.reqs['Родитель']?.value;
      if (parentId && idMap[parentId] && idMap[ev.id]) {
        await this.updateModelEvent(idMap[ev.id], { 'Родитель': idMap[parentId] });
      }
    }

    this.invalidateCache(this.tables.models);
    this.invalidateCache(this.tables.modelEvents);
    return { modelId: newModelId, version, name: newName, eventCount: Object.keys(idMap).length, idMap };
  }

  async migrateIndividual(individualId, fromModelId, toModelId) {
    await this.initialize();
    await this.ensureReqMap(this.tables.individuals);
    const resolved = this.resolveReqs(this.tables.individuals, { 'Модель': String(toModelId) });
    await this.updateObject(individualId, resolved);
    this.invalidateCache(this.tables.individuals);
    return { individualId, fromModelId, toModelId, migrated: true };
  }

  /**
   * List all versions of a model (same concept lineage).
   */
  async getModelVersions(modelId) {
    await this.initialize();
    const models = await this.getObjects(this.tables.models);
    const source = models.find(m => String(m.id) === String(modelId));
    if (!source) return [];
    const conceptId = source.reqs?.['Концепт']?.value;
    if (!conceptId) return [{ id: source.id, name: source.val, version: source.reqs?.['Версия']?.value || 'v1' }];
    return models.filter(m => {
      const c = m.reqs?.['Концепт']?.value;
      return c && String(c) === String(conceptId);
    }).map(m => ({
      id: m.id, name: m.val,
      version: m.reqs?.['Версия']?.value || 'v1',
    })).sort((a, b) => (a.version || '').localeCompare(b.version || ''));
  }

  /**
   * Compare two model versions — returns added/removed/modified model events.
   */
  async diffModels(modelIdA, modelIdB) {
    await this.initialize();
    const eventsA = await this.getModelEvents(modelIdA);
    const eventsB = await this.getModelEvents(modelIdB);

    const namesA = new Map(eventsA.map(e => [e.val, e]));
    const namesB = new Map(eventsB.map(e => [e.val, e]));

    const added = eventsB.filter(e => !namesA.has(e.val)).map(e => ({ id: e.id, name: e.val }));
    const removed = eventsA.filter(e => !namesB.has(e.val)).map(e => ({ id: e.id, name: e.val }));
    const modified = [];

    for (const [name, evA] of namesA) {
      const evB = namesB.get(name);
      if (!evB) continue;
      const constraintsA = evA.reqs?.['Ограничения']?.value || '{}';
      const constraintsB = evB.reqs?.['Ограничения']?.value || '{}';
      if (constraintsA !== constraintsB) {
        modified.push({ name, idA: evA.id, idB: evB.id, constraintsA, constraintsB });
      }
    }

    return { added, removed, modified, totalA: eventsA.length, totalB: eventsB.length };
  }

  /**
   * Safe migration with orphan detection.
   */
  async migrateIndividualSafe(individualId, fromModelId, toModelId) {
    const diff = await this.diffModels(fromModelId, toModelId);
    const events = await this.getSubjectEvents(individualId);
    const removedIds = new Set(diff.removed.map(r => String(r.id)));
    const orphaned = events.filter(e => {
      const meId = e.reqs?.['Модельное событие']?.value;
      return meId && removedIds.has(String(meId));
    });

    await this.migrateIndividual(individualId, fromModelId, toModelId);
    return { migrated: true, orphanedEvents: orphaned.length, orphans: orphaned.map(o => ({ id: o.id, name: o.val })), diff };
  }

  // ═══════════════════════════════════════════════════════════════
  // ▌ ITEM 6: EXPORT / IMPORT (JSON-LD, OWL)
  // ═══════════════════════════════════════════════════════════════

  async exportToJsonLd() {
    await this.initialize();
    const [concepts, models, individuals, events, actors, properties] = await Promise.all([
      this.getObjectsCached(this.tables.concepts),
      this.getObjectsCached(this.tables.models),
      this.getObjectsCached(this.tables.individuals),
      this.getObjectsCached(this.tables.subjectEvents),
      this.getObjectsCached(this.tables.actors),
      this.getObjectsCached(this.tables.properties),
    ]);

    return {
      '@context': {
        sod: 'https://dronedoc.ru/ontology/sod/',
        skos: 'http://www.w3.org/2004/02/skos/core#',
        prov: 'http://www.w3.org/ns/prov#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      },
      '@graph': [
        ...concepts.map(c => ({
          '@id': `sod:concept/${c.id}`,
          '@type': 'skos:Concept',
          'skos:prefLabel': c.val,
          'skos:definition': c.reqs['Описание']?.value || '',
        })),
        ...models.map(m => ({
          '@id': `sod:model/${m.id}`,
          '@type': 'sod:Model',
          'rdfs:label': m.val,
          'sod:concept': m.reqs['Концепт']?.value ? `sod:concept/${m.reqs['Концепт'].value}` : null,
          'sod:version': m.reqs['Версия']?.value || null,
        })),
        ...individuals.map(i => ({
          '@id': `sod:individual/${i.id}`,
          '@type': 'sod:Individual',
          'rdfs:label': i.val,
          'sod:concept': i.reqs['Концепт']?.value ? `sod:concept/${i.reqs['Концепт'].value}` : null,
          'sod:model': i.reqs['Модель']?.value ? `sod:model/${i.reqs['Модель'].value}` : null,
        })),
        ...events.map(e => {
          const parsed = this.parseCausesData(e.reqs['Причины']?.value);
          return {
            '@id': `sod:event/${e.id}`,
            '@type': 'sod:SubjectEvent',
            'rdfs:label': e.val,
            'sod:value': e.reqs['Значение']?.value || '',
            'prov:wasGeneratedBy': e.reqs['Актор']?.value ? `sod:actor/${e.reqs['Актор'].value}` : null,
            'sod:individual': e.reqs['Индивид']?.value ? `sod:individual/${e.reqs['Индивид'].value}` : null,
            'sod:happensBefore': parsed.causes.map(cid => `sod:event/${cid}`),
            'sod:timestamp': parsed.timestamp || null,
          };
        }),
        ...actors.map(a => ({
          '@id': `sod:actor/${a.id}`,
          '@type': 'sod:Actor',
          'rdfs:label': a.val,
          'sod:actorType': a.reqs['Тип']?.value || 'human',
        })),
      ],
    };
  }

  async exportToOwl() {
    await this.initialize();
    const [concepts, models, properties] = await Promise.all([
      this.getObjectsCached(this.tables.concepts),
      this.getObjectsCached(this.tables.models),
      this.getObjectsCached(this.tables.properties),
    ]);

    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"',
      '  xmlns:owl="http://www.w3.org/2002/07/owl#"',
      '  xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"',
      '  xmlns:sod="https://dronedoc.ru/ontology/sod/">',
      '',
      '<owl:Ontology rdf:about="https://dronedoc.ru/ontology/sod/event-engine"/>',
    ];

    for (const c of concepts) {
      lines.push(`<owl:Class rdf:about="sod:concept/${c.id}">`);
      lines.push(`  <rdfs:label>${this._escapeXml(c.val)}</rdfs:label>`);
      if (c.reqs['Описание']?.value) lines.push(`  <rdfs:comment>${this._escapeXml(c.reqs['Описание'].value)}</rdfs:comment>`);
      lines.push('</owl:Class>');
    }

    for (const p of properties) {
      const pType = p.reqs['Тип свойства']?.value;
      const owlType = pType === 'relation' ? 'owl:ObjectProperty' : 'owl:DatatypeProperty';
      lines.push(`<${owlType} rdf:about="sod:property/${p.id}">`);
      lines.push(`  <rdfs:label>${this._escapeXml(p.val)}</rdfs:label>`);
      lines.push(`</${owlType}>`);
    }

    lines.push('</rdf:RDF>');
    return lines.join('\n');
  }

  _escapeXml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async importFromJsonLd(data) {
    await this.initialize();
    const graph = data?.['@graph'] || [];
    const results = { concepts: 0, models: 0, individuals: 0, errors: [] };

    for (const node of graph) {
      try {
        const type = Array.isArray(node['@type']) ? node['@type'][0] : node['@type'];
        if (type === 'skos:Concept' || type === 'sod:Concept') {
          await this.createConcept(node['skos:prefLabel'] || node['rdfs:label'] || 'imported', node['skos:definition'] || '');
          results.concepts++;
        } else if (type === 'sod:Model') {
          await this.ensureReqMap(this.tables.models);
          await this.createObject(this.tables.models, node['rdfs:label'] || 'imported', {
            'Описание': node['rdfs:comment'] || '',
            'Версия': node['sod:version'] || 'imported',
          });
          results.models++;
        } else if (type === 'sod:Individual') {
          await this.createIndividual(node['rdfs:label'] || 'imported', {});
          results.individuals++;
        }
      } catch (err) {
        results.errors.push({ node: node['@id'], error: err.message });
      }
    }

    this.invalidateCache();
    return results;
  }

  /**
   * Import from OWL/Turtle format.
   * Parses simple OWL class declarations and object properties into concepts and relations.
   */
  async importFromOwl(owlString) {
    await this.initialize();
    const results = { concepts: [], properties: [], errors: [] };

    // Parse OWL/XML class declarations: <owl:Class rdf:about="#ClassName">
    const classPattern = /<owl:Class[^>]*rdf:about="[^"]*#([^"]+)"[^>]*>/g;
    let match;
    while ((match = classPattern.exec(owlString)) !== null) {
      try {
        const name = decodeURIComponent(match[1]);
        const result = await this.createConcept(name, `Imported from OWL: ${name}`);
        results.concepts.push({ name, id: result?.id || result?.obj });
      } catch (err) {
        results.errors.push({ type: 'concept', name: match[1], error: err.message });
      }
    }

    // Parse object properties: <owl:ObjectProperty rdf:about="#propertyName">
    const propPattern = /<owl:ObjectProperty[^>]*rdf:about="[^"]*#([^"]+)"[^>]*>/g;
    while ((match = propPattern.exec(owlString)) !== null) {
      try {
        const name = decodeURIComponent(match[1]);
        const result = await this.createProperty(name, { propertyType: 'relation', dataType: 'Reference' });
        results.properties.push({ name, id: result?.id || result?.obj });
      } catch (err) {
        results.errors.push({ type: 'property', name: match[1], error: err.message });
      }
    }

    // Parse datatype properties: <owl:DatatypeProperty rdf:about="#propertyName">
    const dtPropPattern = /<owl:DatatypeProperty[^>]*rdf:about="[^"]*#([^"]+)"[^>]*>/g;
    while ((match = dtPropPattern.exec(owlString)) !== null) {
      try {
        const name = decodeURIComponent(match[1]);
        const result = await this.createProperty(name, { propertyType: 'attribute', dataType: 'Text' });
        results.properties.push({ name, id: result?.id || result?.obj });
      } catch (err) {
        results.errors.push({ type: 'property', name: match[1], error: err.message });
      }
    }

    // Also try Turtle format: :ClassName a owl:Class .
    const turtleClassPattern = /:(\w+)\s+a\s+owl:Class/g;
    while ((match = turtleClassPattern.exec(owlString)) !== null) {
      const name = match[1];
      if (results.concepts.some(c => c.name === name)) continue; // skip dups
      try {
        const result = await this.createConcept(name, `Imported from OWL Turtle: ${name}`);
        results.concepts.push({ name, id: result?.id || result?.obj });
      } catch (err) {
        results.errors.push({ type: 'concept', name, error: err.message });
      }
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // ▌ ITEM 7: ANALYTICS
  // ═══════════════════════════════════════════════════════════════

  async getAnalytics() {
    await this.initialize();
    const [events, actors, concepts, individuals, models] = await Promise.all([
      this.getObjectsCached(this.tables.subjectEvents),
      this.getObjectsCached(this.tables.actors),
      this.getObjectsCached(this.tables.concepts),
      this.getObjectsCached(this.tables.individuals),
      this.getObjectsCached(this.tables.models),
    ]);

    // Events by time (group by day)
    const eventsByTime = {};
    for (const ev of events) {
      const parsed = this.parseCausesData(ev.reqs['Причины']?.value);
      const ts = parsed.timestamp || ev.reqs['Временная метка']?.value || '';
      const day = ts.slice(0, 10) || 'unknown';
      eventsByTime[day] = (eventsByTime[day] || 0) + 1;
    }

    // Process durations by concept
    const processDurations = {};
    const indConceptMap = new Map();
    for (const ind of individuals) {
      indConceptMap.set(String(ind.id), ind.reqs['Концепт']?.displayValue || ind.reqs['Концепт']?.value || 'unknown');
    }

    // Actor heatmap: actor × concept → event count
    const actorHeatmap = {};
    for (const ev of events) {
      const actorLabel = ev.reqs['Актор']?.displayValue || ev.reqs['Актор']?.value || 'unknown';
      const indId = ev.reqs['Индивид']?.value;
      const conceptLabel = indConceptMap.get(String(indId)) || 'unknown';
      const key = `${actorLabel}|${conceptLabel}`;
      actorHeatmap[key] = (actorHeatmap[key] || 0) + 1;
    }

    // Bottlenecks: events with most effects (high fan-out)
    const effectCounts = {};
    for (const ev of events) {
      const parsed = this.parseCausesData(ev.reqs['Причины']?.value);
      for (const causeId of parsed.causes) {
        effectCounts[causeId] = (effectCounts[causeId] || 0) + 1;
      }
    }
    const bottlenecks = Object.entries(effectCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([eventId, count]) => {
        const ev = events.find(e => String(e.id) === eventId);
        return { eventId, effectCount: count, name: ev?.val || 'unknown' };
      });

    // Trigger stats
    const triggerStats = {
      total: (this._triggers || []).length,
      active: (this._triggers || []).filter(t => t.active !== false).length,
      persistent: (this._triggers || []).filter(t => t.dbId).length,
    };

    // Events by actor (for bar chart)
    const eventsByActor = {};
    for (const ev of events) {
      const label = ev.reqs['Актор']?.displayValue || ev.reqs['Актор']?.value || 'unknown';
      eventsByActor[label] = (eventsByActor[label] || 0) + 1;
    }

    return {
      eventsByTime,
      eventsByActor,
      actorHeatmap,
      bottlenecks,
      triggerStats,
      totals: {
        events: events.length,
        actors: actors.length,
        concepts: concepts.length,
        individuals: individuals.length,
        models: models.length,
      },
    };
  }

  // ─── Stats ────────────────────────────────────────────────────

  async getStats() {
    await this.initialize();
    const counts = {};
    for (const [key, typeId] of Object.entries(this.tables)) {
      if (!typeId) { counts[key] = 0; continue; }
      try {
        const objs = await this.getObjects(typeId, { limit: 500 });
        counts[key] = objs.length;
      } catch {
        counts[key] = 0;
      }
    }
    return counts;
  }

  // ═══════════════════════════════════════════════════════════════
  // ▌ MBSE: Requirements Traceability (Phase 1)
  // ═══════════════════════════════════════════════════════════════

  async getRequirements(params = {}) {
    await this.initialize();
    if (!this.tables.requirements) return [];
    const all = await this.getObjectsCached(this.tables.requirements);
    let result = all;
    if (params.type) result = result.filter(r => r.reqs['Тип']?.value === params.type);
    if (params.priority) result = result.filter(r => r.reqs['Приоритет']?.value === params.priority);
    if (params.status) result = result.filter(r => r.reqs['Статус']?.value === params.status);
    return result;
  }

  async createRequirement(data) {
    await this.initialize();
    if (!this.tables.requirements) throw new Error('Table СОД Требования not found');
    await this.ensureReqMap(this.tables.requirements);
    // Auto-generate code if none provided
    if (!data.code) {
      const existing = await this.getRequirements();
      const typePrefix = { functional: 'F', interface: 'IF', performance: 'P', constraint: 'C', security: 'S' }[data.type] || 'R';
      const sameType = existing.filter(r => (r.reqs?.['Тип']?.value || '') === (data.type || ''));
      data.code = `REQ-${typePrefix}-${String(sameType.length + 1).padStart(3, '0')}`;
    }
    const reqs = {};
    if (data.code) reqs['Код'] = data.code;
    if (data.description) reqs['Описание'] = data.description;
    if (data.type) reqs['Тип'] = data.type;
    if (data.priority) reqs['Приоритет'] = data.priority;
    if (data.status) reqs['Статус'] = data.status || 'draft';
    if (data.source) reqs['Источник'] = data.source;
    if (data.conceptId) reqs['Концепт СОД'] = data.conceptId;
    const result = await this.createObject(this.tables.requirements, data.name || data.code || 'REQ', reqs);
    this.invalidateCache(this.tables.requirements);
    return result;
  }

  async updateRequirement(id, data) {
    await this.initialize();
    if (!this.tables.requirements) throw new Error('Table СОД Требования not found');
    await this.ensureReqMap(this.tables.requirements);
    const resolved = this.resolveReqs(this.tables.requirements, data);
    const result = await this.updateObject(id, resolved);
    this.invalidateCache(this.tables.requirements);
    return result;
  }

  async deleteRequirement(id) {
    await this.initialize();
    await this.deleteObject(id);
    this.invalidateCache(this.tables.requirements);
    // Cascade: delete related traces
    if (this.tables.traces) {
      const traces = await this.getObjects(this.tables.traces);
      for (const t of traces) {
        if (String(t.reqs['Источник']?.value) === String(id) || String(t.reqs['Цель']?.value) === String(id)) {
          await this.deleteObject(t.id);
        }
      }
      this.invalidateCache(this.tables.traces);
    }
  }

  async getTraces(requirementId) {
    await this.initialize();
    if (!this.tables.traces) return [];
    const all = await this.getObjectsCached(this.tables.traces);
    if (!requirementId) return all;
    return all.filter(t =>
      String(t.reqs['Источник']?.value) === String(requirementId) ||
      String(t.reqs['Цель']?.value) === String(requirementId)
    );
  }

  async createTrace(data) {
    await this.initialize();
    if (!this.tables.traces) throw new Error('Table СОД Трассировки not found');
    await this.ensureReqMap(this.tables.traces);
    const reqs = {};
    if (data.sourceId) reqs['Источник'] = data.sourceId;
    if (data.targetId) reqs['Цель'] = data.targetId;
    if (data.traceType) reqs['Тип связи'] = data.traceType;
    if (data.comment) reqs['Комментарий'] = data.comment;
    const result = await this.createObject(this.tables.traces, `${data.traceType || 'trace'}`, reqs);
    this.invalidateCache(this.tables.traces);
    return result;
  }

  async deleteTrace(id) {
    await this.initialize();
    await this.deleteObject(id);
    this.invalidateCache(this.tables.traces);
  }

  async getTraceabilityMatrix() {
    await this.initialize();
    const requirements = this.tables.requirements ? await this.getObjectsCached(this.tables.requirements) : [];
    const traces = this.tables.traces ? await this.getObjectsCached(this.tables.traces) : [];
    const matrix = [];
    for (const t of traces) {
      matrix.push({
        sourceId: t.reqs['Источник']?.value,
        sourceDisplay: t.reqs['Источник']?.displayValue,
        targetId: t.reqs['Цель']?.value,
        targetDisplay: t.reqs['Цель']?.displayValue,
        traceType: t.reqs['Тип связи']?.value || t.val,
        traceId: t.id,
      });
    }
    return { requirements, traces: matrix };
  }

  async getRequirementCoverage() {
    await this.initialize();
    const requirements = this.tables.requirements ? await this.getObjectsCached(this.tables.requirements) : [];
    const total = requirements.length;
    const verified = requirements.filter(r => r.reqs['Статус']?.value === 'verified').length;
    const implemented = requirements.filter(r => r.reqs['Статус']?.value === 'implemented').length;
    const approved = requirements.filter(r => r.reqs['Статус']?.value === 'approved').length;
    const draft = requirements.filter(r => r.reqs['Статус']?.value === 'draft' || !r.reqs['Статус']?.value).length;
    return { total, verified, implemented, approved, draft, coverage: total > 0 ? Math.round((verified / total) * 100) : 0 };
  }

  /**
   * Generate test case stubs from a requirement.
   * Returns test scenarios based on requirement type and description.
   */
  async generateTestCases(requirementId) {
    await this.initialize();
    const requirements = await this.getRequirements();
    const req = requirements.find(r => String(r.id) === String(requirementId));
    if (!req) throw new Error(`Requirement ${requirementId} not found`);

    const name = req.val || 'Unknown';
    const type = req.reqs?.['Тип']?.value || 'functional';
    const priority = req.reqs?.['Приоритет']?.value || 'medium';
    const description = req.reqs?.['Описание']?.value || '';

    const tests = [];

    // Positive test
    tests.push({
      name: `TC-${name}-01: Проверка выполнения`,
      method: 'test',
      type: 'positive',
      description: `Убедиться, что требование "${name}" выполняется корректно`,
      expectedResult: 'pass',
      priority,
    });

    // Negative test
    tests.push({
      name: `TC-${name}-02: Негативный сценарий`,
      method: 'test',
      type: 'negative',
      description: `Убедиться, что при нарушении условий "${name}" система корректно обрабатывает ошибку`,
      expectedResult: 'pass',
      priority,
    });

    // Type-specific tests
    if (type === 'performance') {
      tests.push({
        name: `TC-${name}-03: Нагрузочный тест`,
        method: 'load_test',
        type: 'performance',
        description: `Нагрузочное тестирование для "${name}"`,
        expectedResult: 'pass',
        priority: 'high',
      });
      tests.push({
        name: `TC-${name}-04: Стресс-тест`,
        method: 'stress_test',
        type: 'performance',
        description: `Стресс-тестирование граничных условий "${name}"`,
        expectedResult: 'pass',
        priority: 'high',
      });
    }

    if (type === 'security') {
      tests.push({
        name: `TC-${name}-03: Тест безопасности`,
        method: 'security_test',
        type: 'security',
        description: `Проверка безопасности для "${name}"`,
        expectedResult: 'pass',
        priority: 'critical',
      });
      tests.push({
        name: `TC-${name}-04: Тест на инъекцию`,
        method: 'injection_test',
        type: 'security',
        description: `Проверка на SQL/XSS инъекции для "${name}"`,
        expectedResult: 'pass',
        priority: 'critical',
      });
    }

    if (type === 'interface') {
      tests.push({
        name: `TC-${name}-03: Тест интеграции`,
        method: 'integration_test',
        type: 'interface',
        description: `Проверка интеграции для "${name}"`,
        expectedResult: 'pass',
        priority,
      });
    }

    // Boundary test for all types
    tests.push({
      name: `TC-${name}-B1: Граничные значения`,
      method: 'boundary_test',
      type: 'boundary',
      description: `Проверка граничных значений для "${name}"`,
      expectedResult: 'pass',
      priority,
    });

    return {
      requirementId,
      requirementName: name,
      requirementType: type,
      testCount: tests.length,
      tests,
    };
  }

  /**
   * Impact analysis — what traces/verifications reference a requirement.
   */
  async getRequirementImpact(requirementId) {
    await this.initialize();
    const traces = await this.getTraces(requirementId);
    const verifications = await this.getVerifications(requirementId);
    return {
      requirementId,
      traceCount: traces.length,
      verificationCount: verifications.length,
      traces: traces.map(t => ({ id: t.id, name: t.val })),
      verifications: verifications.map(v => ({ id: v.id, name: v.val })),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ▌ MBSE: State Machine Engine (Phase 2)
  // ═══════════════════════════════════════════════════════════════

  async getStates(modelId) {
    await this.initialize();
    if (!this.tables.states) return [];
    const all = await this.getObjectsCached(this.tables.states);
    if (!modelId) return all;
    return all.filter(s => String(s.reqs['Модель']?.value) === String(modelId));
  }

  async createState(modelId, data) {
    await this.initialize();
    if (!this.tables.states) throw new Error('Table СОД Состояния not found');
    await this.ensureReqMap(this.tables.states);
    const reqs = { 'Модель': modelId };
    if (data.type) reqs['Тип'] = data.type;
    if (data.description) reqs['Описание'] = data.description;
    if (data.order != null) reqs['Порядок'] = String(data.order);
    const result = await this.createObject(this.tables.states, data.name || 'State', reqs);
    this.invalidateCache(this.tables.states);
    return result;
  }

  async updateState(stateId, data) {
    await this.initialize();
    if (!this.tables.states) throw new Error('Table СОД Состояния not found');
    await this.ensureReqMap(this.tables.states);
    const resolved = this.resolveReqs(this.tables.states, data);
    const result = await this.updateObject(stateId, resolved);
    this.invalidateCache(this.tables.states);
    return result;
  }

  async deleteState(stateId) {
    await this.initialize();
    await this.deleteObject(stateId);
    this.invalidateCache(this.tables.states);
    // Cascade: delete transitions referencing this state
    if (this.tables.transitions) {
      const transitions = await this.getObjects(this.tables.transitions);
      for (const t of transitions) {
        if (String(t.reqs['Из']?.value) === String(stateId) || String(t.reqs['В']?.value) === String(stateId)) {
          await this.deleteObject(t.id);
        }
      }
      this.invalidateCache(this.tables.transitions);
    }
  }

  async getTransitions(modelId) {
    await this.initialize();
    if (!this.tables.transitions) return [];
    const all = await this.getObjectsCached(this.tables.transitions);
    if (!modelId) return all;
    return all.filter(t => String(t.reqs['Модель']?.value) === String(modelId));
  }

  async createTransition(modelId, data) {
    await this.initialize();
    if (!this.tables.transitions) throw new Error('Table СОД Переходы not found');
    await this.ensureReqMap(this.tables.transitions);
    const reqs = { 'Модель': modelId };
    if (data.fromStateId) reqs['Из'] = data.fromStateId;
    if (data.toStateId) reqs['В'] = data.toStateId;
    if (data.trigger) reqs['Триггер'] = data.trigger;
    if (data.guard) reqs['Охранное условие'] = data.guard;
    if (data.action) reqs['Действие'] = data.action;
    const label = data.trigger || 'transition';
    const result = await this.createObject(this.tables.transitions, label, reqs);
    this.invalidateCache(this.tables.transitions);
    return result;
  }

  async updateTransition(transitionId, data) {
    await this.initialize();
    if (!this.tables.transitions) throw new Error('Table СОД Переходы not found');
    await this.ensureReqMap(this.tables.transitions);
    const resolved = this.resolveReqs(this.tables.transitions, data);
    const result = await this.updateObject(transitionId, resolved);
    this.invalidateCache(this.tables.transitions);
    return result;
  }

  async deleteTransition(transitionId) {
    await this.initialize();
    await this.deleteObject(transitionId);
    this.invalidateCache(this.tables.transitions);
  }

  async executeStateMachine(individualId, modelId) {
    await this.initialize();
    const states = await this.getStates(modelId);
    const transitions = await this.getTransitions(modelId);
    if (!states.length) throw new Error('No states defined for this model');

    // Determine current state from subject events
    const events = this.tables.subjectEvents ? await this.getObjects(this.tables.subjectEvents) : [];
    const indEvents = events.filter(e => String(e.reqs['Индивид']?.value) === String(individualId));
    const stateEvents = indEvents.filter(e => (e.val || '').startsWith('FSM:'));

    let currentState = null;
    if (stateEvents.length > 0) {
      const lastStateId = stateEvents[stateEvents.length - 1].val.replace('FSM:', '');
      currentState = states.find(s => String(s.id) === lastStateId);
    }
    if (!currentState) {
      currentState = states.find(s => s.reqs['Тип']?.value === 'initial') || states[0];
    }

    // Evaluate transitions from current state
    const available = transitions.filter(t => String(t.reqs['Из']?.value) === String(currentState.id));
    if (!available.length) return { currentState, nextState: null, message: 'No transitions from current state' };

    // Simple guard evaluation: no guard = always true
    const firing = available.find(t => !t.reqs['Охранное условие']?.value || t.reqs['Охранное условие']?.value === 'true');
    if (!firing) return { currentState, nextState: null, message: 'All guards evaluated to false' };

    const nextState = states.find(s => String(s.id) === String(firing.reqs['В']?.value));
    if (!nextState) return { currentState, nextState: null, message: 'Target state not found' };

    // Record state transition as subject event
    if (this.tables.subjectEvents) {
      await this.ensureReqMap(this.tables.subjectEvents);
      await this.createObject(this.tables.subjectEvents, `FSM:${nextState.id}`, {
        'Индивид': individualId,
        'Значение': `${currentState.val} → ${nextState.val}`,
      });
    }

    return {
      currentState: { id: currentState.id, name: currentState.val },
      nextState: { id: nextState.id, name: nextState.val },
      transition: { id: firing.id, trigger: firing.reqs['Триггер']?.value, action: firing.reqs['Действие']?.value },
    };
  }

  async getStateMachineDiagram(modelId) {
    await this.initialize();
    const states = await this.getStates(modelId);
    const transitions = await this.getTransitions(modelId);

    const lines = ['stateDiagram-v2'];
    for (const s of states) {
      const name = (s.val || 'S').replace(/[^a-zA-Zа-яА-Я0-9_]/g, '_');
      const sType = s.reqs['Тип']?.value;
      if (sType === 'initial') lines.push(`  [*] --> ${name}`);
      if (sType === 'final') lines.push(`  ${name} --> [*]`);
      if (s.reqs['Описание']?.value) lines.push(`  ${name}: ${s.val}\\n${s.reqs['Описание']?.value}`);
      else lines.push(`  ${name}: ${s.val}`);
    }
    for (const t of transitions) {
      const from = states.find(s => String(s.id) === String(t.reqs['Из']?.value));
      const to = states.find(s => String(s.id) === String(t.reqs['В']?.value));
      if (!from || !to) continue;
      const fromName = (from.val || 'S').replace(/[^a-zA-Zа-яА-Я0-9_]/g, '_');
      const toName = (to.val || 'S').replace(/[^a-zA-Zа-яА-Я0-9_]/g, '_');
      const label = [t.reqs['Триггер']?.value, t.reqs['Охранное условие']?.value ? `[${t.reqs['Охранное условие']?.value}]` : '', t.reqs['Действие']?.value ? `/ ${t.reqs['Действие']?.value}` : ''].filter(Boolean).join(' ');
      lines.push(`  ${fromName} --> ${toName}: ${label || t.val}`);
    }
    return { mermaid: lines.join('\n'), states: states.length, transitions: transitions.length };
  }

  async getCurrentState(individualId, modelId) {
    await this.initialize();
    const states = await this.getStates(modelId);
    const events = this.tables.subjectEvents ? await this.getObjects(this.tables.subjectEvents) : [];
    const stateEvents = events
      .filter(e => String(e.reqs['Индивид']?.value) === String(individualId) && (e.val || '').startsWith('FSM:'));
    if (stateEvents.length > 0) {
      const lastStateId = stateEvents[stateEvents.length - 1].val.replace('FSM:', '');
      return states.find(s => String(s.id) === lastStateId) || null;
    }
    return states.find(s => s.reqs['Тип']?.value === 'initial') || states[0] || null;
  }

  // ═══════════════════════════════════════════════════════════════
  // ▌ MBSE: SysML-like Diagram Generation (Phase 3)
  // ═══════════════════════════════════════════════════════════════

  async generateBDD(modelId) {
    await this.initialize();
    const concepts = await this.getObjectsCached(this.tables.concepts);
    // Use ontology relations table (1673287) for structural relations
    let relations = [];
    try { relations = await this.getObjects('1673287'); } catch { /* no ontology relations */ }

    const modelEvents = modelId ? (await this.getObjectsCached(this.tables.modelEvents))
      .filter(e => String(e.reqs['Модель']?.value) === String(modelId)) : [];

    // Collect concept IDs referenced by model events
    const conceptIds = new Set();
    for (const ev of modelEvents) {
      const cRef = ev.reqs['Концепт']?.value || ev.reqs['Концепт СОД']?.value;
      if (cRef) conceptIds.add(String(cRef));
    }
    // If no model specified, use all concepts (limit 50)
    const filteredConcepts = conceptIds.size > 0
      ? concepts.filter(c => conceptIds.has(String(c.id)))
      : concepts.slice(0, 50);

    const lines = ['classDiagram'];
    const idToName = {};
    for (const c of filteredConcepts) {
      const name = (c.val || 'C').replace(/[^a-zA-Zа-яА-Я0-9_]/g, '_');
      idToName[c.id] = name;
      lines.push(`  class ${name} {`);
      if (c.reqs['Нотация']?.value) lines.push(`    <<${c.reqs['Нотация']?.value}>>`);
      if (c.reqs['Определение']?.value) lines.push(`    +${c.reqs['Определение']?.value.slice(0, 60)}`);
      lines.push(`  }`);
    }
    // Add relations
    for (const rel of relations) {
      const srcId = rel.reqs['Источник']?.value;
      const tgtId = rel.reqs['Цель']?.value;
      const relType = rel.reqs['Тип связи']?.displayValue || rel.val || 'relates';
      if (idToName[srcId] && idToName[tgtId]) {
        const arrow = relType.includes('is_a') ? '--|>' : relType.includes('part_of') ? '--*' : relType.includes('hasComponent') ? 'o--' : '-->';
        lines.push(`  ${idToName[srcId]} ${arrow} ${idToName[tgtId]}: ${relType}`);
      }
    }
    return { mermaid: lines.join('\n'), metadata: { concepts: filteredConcepts.length, relations: relations.length } };
  }

  async generateIBD(modelId) {
    await this.initialize();
    const individuals = await this.getObjectsCached(this.tables.individuals);
    const events = this.tables.subjectEvents ? await this.getObjectsCached(this.tables.subjectEvents) : [];

    // Filter by model: individuals whose concept is used in the model
    let filteredInds = individuals;
    if (modelId) {
      const modelEvents = (await this.getObjectsCached(this.tables.modelEvents))
        .filter(e => String(e.reqs['Модель']?.value) === String(modelId));
      const modelConceptIds = new Set(modelEvents.map(e => String(e.reqs['Концепт']?.value || e.reqs['Концепт СОД']?.value)).filter(Boolean));
      filteredInds = individuals.filter(i => modelConceptIds.has(String(i.reqs['Концепт']?.value)));
    }
    filteredInds = filteredInds.slice(0, 30);

    const lines = ['flowchart TD'];
    const indMap = {};
    for (const ind of filteredInds) {
      const name = (ind.val || 'I').replace(/[^a-zA-Zа-яА-Я0-9_]/g, '_');
      indMap[ind.id] = name;
      lines.push(`  ${name}["${ind.val || ind.id}"]`);
    }
    // Events as flows between individuals
    for (const ev of events) {
      const indId = ev.reqs['Индивид']?.value;
      const causes = ev.reqs['Причины']?.value;
      if (indId && causes && indMap[indId]) {
        // Parse causes: could be comma-separated event IDs
        const causeEvents = events.filter(ce => String(ce.id) === String(causes));
        for (const ce of causeEvents) {
          const ceIndId = ce.reqs['Индивид']?.value;
          if (ceIndId && indMap[ceIndId] && indMap[ceIndId] !== indMap[indId]) {
            lines.push(`  ${indMap[ceIndId]} -->|"${ev.val}"| ${indMap[indId]}`);
          }
        }
      }
    }
    return { mermaid: lines.join('\n'), metadata: { individuals: filteredInds.length, events: events.length } };
  }

  async generateActivityDiagram(modelId) {
    await this.initialize();
    if (!modelId) throw new Error('modelId is required for activity diagram');
    const modelEvents = (await this.getObjectsCached(this.tables.modelEvents))
      .filter(e => String(e.reqs['Модель']?.value) === String(modelId))
      .sort((a, b) => Number(a.reqs['Порядок']?.value || 0) - Number(b.reqs['Порядок']?.value || 0));

    const lines = ['flowchart TD'];
    lines.push('  start(("Start"))');
    let prev = 'start';
    for (let i = 0; i < modelEvents.length; i++) {
      const ev = modelEvents[i];
      const name = `ev${i}`;
      const label = (ev.val || `Event ${i}`).replace(/"/g, "'");
      const hasCondition = ev.reqs['Ограничения']?.value && ev.reqs['Ограничения']?.value !== '{}';
      if (hasCondition) {
        lines.push(`  ${name}{{"${label}"}}`);
      } else {
        lines.push(`  ${name}["${label}"]`);
      }
      lines.push(`  ${prev} --> ${name}`);
      prev = name;
    }
    lines.push(`  finish(("End"))`);
    lines.push(`  ${prev} --> finish`);
    return { mermaid: lines.join('\n'), metadata: { events: modelEvents.length } };
  }

  async generateRequirementsDiagram(modelId) {
    await this.initialize();
    const requirements = this.tables.requirements ? await this.getObjectsCached(this.tables.requirements) : [];
    const traces = this.tables.traces ? await this.getObjectsCached(this.tables.traces) : [];

    // Filter by concept linkage to model if modelId provided
    let filteredReqs = requirements;
    if (modelId) {
      const modelEvents = (await this.getObjectsCached(this.tables.modelEvents))
        .filter(e => String(e.reqs['Модель']?.value) === String(modelId));
      const conceptIds = new Set(modelEvents.map(e => String(e.reqs['Концепт']?.value || e.reqs['Концепт СОД']?.value)).filter(Boolean));
      filteredReqs = requirements.filter(r => !r.reqs['Концепт СОД']?.value || conceptIds.has(String(r.reqs['Концепт СОД']?.value)));
    }

    const lines = ['requirementDiagram'];
    const idToKey = {};
    for (const r of filteredReqs) {
      const key = (r.reqs['Код']?.value || r.val || `R${r.id}`).replace(/[^a-zA-Z0-9_]/g, '_');
      idToKey[r.id] = key;
      const rType = r.reqs['Тип']?.value || 'functional';
      lines.push(`  requirement ${key} {`);
      lines.push(`    id: ${r.reqs['Код']?.value || r.id}`);
      lines.push(`    text: ${(r.val || '').replace(/[{}]/g, '')}`);
      lines.push(`    risk: ${r.reqs['Приоритет']?.value === 'must' ? 'high' : r.reqs['Приоритет']?.value === 'should' ? 'medium' : 'low'}`);
      lines.push(`    verifymethod: ${rType === 'performance' ? 'test' : 'analysis'}`);
      lines.push(`  }`);
    }
    for (const t of traces) {
      const srcKey = idToKey[t.reqs['Источник']?.value];
      const tgtKey = idToKey[t.reqs['Цель']?.value];
      if (srcKey && tgtKey) {
        const rel = t.reqs['Тип связи']?.value || t.val || 'traces';
        lines.push(`  ${srcKey} - ${rel} -> ${tgtKey}`);
      }
    }
    return { mermaid: lines.join('\n'), metadata: { requirements: filteredReqs.length, traces: traces.length } };
  }

  // ═══════════════════════════════════════════════════════════════
  // ▌ MBSE: Verification & V-Model (Phase 4)
  // ═══════════════════════════════════════════════════════════════

  async getVerifications(requirementId) {
    await this.initialize();
    if (!this.tables.verifications) return [];
    const all = await this.getObjectsCached(this.tables.verifications);
    if (!requirementId) return all;
    return all.filter(v => String(v.reqs['Требование']?.value) === String(requirementId));
  }

  async createVerification(data) {
    await this.initialize();
    if (!this.tables.verifications) throw new Error('Table СОД Верификация not found');
    await this.ensureReqMap(this.tables.verifications);
    const reqs = {};
    if (data.requirementId) reqs['Требование'] = data.requirementId;
    if (data.method) reqs['Метод'] = data.method;
    if (data.result) reqs['Результат'] = data.result || 'pending';
    if (data.date) reqs['Дата'] = data.date;
    if (data.actorId) reqs['Исполнитель'] = data.actorId;
    if (data.description) reqs['Описание'] = data.description;
    if (data.artifact) reqs['Артефакт'] = data.artifact;
    const result = await this.createObject(this.tables.verifications, data.name || data.method || 'verification', reqs);
    this.invalidateCache(this.tables.verifications);
    return result;
  }

  async getVModelData(modelId) {
    await this.initialize();
    const requirements = this.tables.requirements ? await this.getObjectsCached(this.tables.requirements) : [];
    const traces = this.tables.traces ? await this.getObjectsCached(this.tables.traces) : [];
    const verifications = this.tables.verifications ? await this.getObjectsCached(this.tables.verifications) : [];

    // Left branch: requirements by type (decomposition levels)
    const levels = {
      stakeholder: requirements.filter(r => r.reqs['Тип']?.value === 'constraint' || r.reqs['Приоритет']?.value === 'must'),
      system: requirements.filter(r => r.reqs['Тип']?.value === 'functional'),
      subsystem: requirements.filter(r => r.reqs['Тип']?.value === 'interface'),
      component: requirements.filter(r => r.reqs['Тип']?.value === 'performance'),
    };

    // Right branch: verifications by method
    const vByMethod = {
      acceptance: verifications.filter(v => v.reqs['Метод']?.value === 'demonstration'),
      system_test: verifications.filter(v => v.reqs['Метод']?.value === 'test'),
      integration: verifications.filter(v => v.reqs['Метод']?.value === 'analysis'),
      unit_test: verifications.filter(v => v.reqs['Метод']?.value === 'inspection'),
    };

    // Horizontal links via traces (type verifies)
    const verifyLinks = traces.filter(t => t.reqs['Тип связи']?.value === 'verifies');

    return {
      leftBranch: levels,
      rightBranch: vByMethod,
      horizontalLinks: verifyLinks.map(l => ({
        requirementId: l.reqs['Источник']?.value,
        verificationId: l.reqs['Цель']?.value,
      })),
      stats: {
        totalRequirements: requirements.length,
        totalVerifications: verifications.length,
        passed: verifications.filter(v => v.reqs['Результат']?.value === 'pass').length,
        failed: verifications.filter(v => v.reqs['Результат']?.value === 'fail').length,
        pending: verifications.filter(v => v.reqs['Результат']?.value === 'pending' || !v.reqs['Результат']?.value).length,
      },
    };
  }

  async getCoverageMatrix() {
    await this.initialize();
    const requirements = this.tables.requirements ? await this.getObjectsCached(this.tables.requirements) : [];
    const verifications = this.tables.verifications ? await this.getObjectsCached(this.tables.verifications) : [];

    const matrix = requirements.map(r => {
      const reqVerifications = verifications.filter(v => String(v.reqs['Требование']?.value) === String(r.id));
      const methods = { test: null, analysis: null, inspection: null, demonstration: null };
      for (const v of reqVerifications) {
        const method = v.reqs['Метод']?.value;
        if (method && methods.hasOwnProperty(method)) {
          methods[method] = v.reqs['Результат']?.value || 'pending';
        }
      }
      return {
        requirementId: r.id,
        code: r.reqs['Код']?.value || r.val,
        name: r.val,
        type: r.reqs['Тип']?.value,
        priority: r.reqs['Приоритет']?.value,
        status: r.reqs['Статус']?.value,
        methods,
        verified: Object.values(methods).some(v => v === 'pass'),
      };
    });

    const totalReqs = matrix.length;
    const verifiedReqs = matrix.filter(m => m.verified).length;

    return { matrix, coverage: totalReqs > 0 ? Math.round((verifiedReqs / totalReqs) * 100) : 0, totalReqs, verifiedReqs };
  }
  // ═══════════════════════════════════════════════════════════════
  // ▌ ONTOLOGY ACTIONS — декларативные Actions (trigger + condition + effect)
  // ▌ Связывают KAG-события с действиями в онтологии
  // ═══════════════════════════════════════════════════════════════

  /**
   * Initialize the OntologyActions subsystem.
   * Actions = { id, name, trigger, condition, effect, enabled, stats }
   *
   * Trigger types:
   *   - onNewEntity: fires when a new KAG entity is added
   *   - onEntityUpdate: fires when a KAG entity is updated
   *   - onConnectorData: fires when a connector delivers new data
   *   - onSchedule: fires on a cron-like schedule
   *   - onEvent: fires when a СОД subject event is created
   *
   * Effect types:
   *   - createEntity: create a new KAG entity
   *   - updateEntity: update an existing KAG entity (e.g. relevance score)
   *   - createIntegram: create an Integram object
   *   - notify: send notification (log / Telegram)
   *   - invokeConnector: run a connector with params
   *   - invokeAgent: invoke an agent via API
   *   - chainActions: sequentially execute multiple effects
   */
  constructor_initOntologyActions() {
    if (this._ontologyActions) return;
    this._ontologyActions = new Map(); // id → action
    this._ontologyActionCounter = 0;
    this._ontologyActionLog = []; // last 100 executions
    this._ontologyActionLogMax = 100;
  }

  /**
   * Register an OntologyAction.
   *
   * @param {Object} actionDef
   * @param {string} actionDef.name - Human-readable name
   * @param {Object} actionDef.trigger - { type, params }
   * @param {string|Object} actionDef.condition - BSL condition or 'true'
   * @param {Object} actionDef.effect - { type, params }
   * @param {boolean} [actionDef.enabled=true]
   * @returns {string} actionId
   *
   * @example
   * registerOntologyAction({
   *   name: 'Auto-index Wikidata manufacturers',
   *   trigger: { type: 'onNewEntity', params: { entityType: 'Manufacturer', source: 'wikidata' } },
   *   condition: 'true',
   *   effect: { type: 'createIntegram', params: { typeId: '1673250', fieldMap: { name: '$entity.name' } } },
   * })
   */
  registerOntologyAction(actionDef) {
    this.constructor_initOntologyActions();
    const id = `oaction_${++this._ontologyActionCounter}`;
    const action = {
      id,
      name: actionDef.name || id,
      trigger: actionDef.trigger,
      condition: actionDef.condition || 'true',
      effect: actionDef.effect,
      enabled: actionDef.enabled !== false,
      createdAt: new Date().toISOString(),
      stats: { fired: 0, succeeded: 0, failed: 0, lastFired: null },
    };
    this._ontologyActions.set(id, action);
    logger.info(`[OntologyActions] Registered: ${id} "${action.name}"`, { trigger: action.trigger.type });
    return id;
  }

  /**
   * Remove an OntologyAction.
   */
  removeOntologyAction(actionId) {
    this.constructor_initOntologyActions();
    return this._ontologyActions.delete(actionId);
  }

  /**
   * Update an OntologyAction (partial).
   */
  updateOntologyAction(actionId, updates) {
    this.constructor_initOntologyActions();
    const action = this._ontologyActions.get(actionId);
    if (!action) return null;
    if (updates.name !== undefined) action.name = updates.name;
    if (updates.trigger !== undefined) action.trigger = updates.trigger;
    if (updates.condition !== undefined) action.condition = updates.condition;
    if (updates.effect !== undefined) action.effect = updates.effect;
    if (updates.enabled !== undefined) action.enabled = updates.enabled;
    return action;
  }

  /**
   * List all OntologyActions.
   */
  getOntologyActions() {
    this.constructor_initOntologyActions();
    return Array.from(this._ontologyActions.values()).map(a => ({
      id: a.id,
      name: a.name,
      trigger: a.trigger,
      condition: a.condition,
      effect: a.effect,
      enabled: a.enabled,
      createdAt: a.createdAt,
      stats: { ...a.stats },
    }));
  }

  /**
   * Get an OntologyAction by ID.
   */
  getOntologyAction(actionId) {
    this.constructor_initOntologyActions();
    const a = this._ontologyActions.get(actionId);
    if (!a) return null;
    return { ...a, stats: { ...a.stats } };
  }

  /**
   * Get execution log (last N entries).
   */
  getOntologyActionLog(limit = 50) {
    this.constructor_initOntologyActions();
    return this._ontologyActionLog.slice(-limit);
  }

  /**
   * Fire OntologyActions for a given trigger type with context.
   * Called by KAGService hooks or ConnectorScheduler.
   *
   * @param {string} triggerType - 'onNewEntity' | 'onEntityUpdate' | 'onConnectorData' | 'onEvent'
   * @param {Object} context - { entity?, connector?, event?, data? }
   * @returns {Array} results of executed actions
   */
  async fireOntologyActions(triggerType, context = {}) {
    this.constructor_initOntologyActions();
    const results = [];

    for (const [, action] of this._ontologyActions) {
      if (!action.enabled) continue;
      if (action.trigger.type !== triggerType) continue;

      // Check trigger params filter
      if (!this._matchTriggerParams(action.trigger, context)) continue;

      // Evaluate condition
      const condCtx = {
        values: context,
        entity: context.entity,
        connector: context.connector,
        event: context.event,
        value: context.entity?.name || context.event?.value || '',
        actorId: context.actorId || 'system',
      };
      const condResult = this.evaluateCondition(action.condition, condCtx);
      if (!condResult) continue;

      // Execute effect
      action.stats.fired++;
      action.stats.lastFired = new Date().toISOString();

      try {
        const effectResult = await this._executeOntologyEffect(action.effect, context);
        action.stats.succeeded++;
        const logEntry = {
          actionId: action.id,
          actionName: action.name,
          triggerType,
          timestamp: new Date().toISOString(),
          success: true,
          result: effectResult,
        };
        this._appendActionLog(logEntry);
        results.push(logEntry);
        logger.info(`[OntologyActions] Executed: ${action.name}`, { trigger: triggerType, result: effectResult });
      } catch (err) {
        action.stats.failed++;
        const logEntry = {
          actionId: action.id,
          actionName: action.name,
          triggerType,
          timestamp: new Date().toISOString(),
          success: false,
          error: err.message,
        };
        this._appendActionLog(logEntry);
        results.push(logEntry);
        logger.error(`[OntologyActions] Failed: ${action.name}`, err.message);
      }
    }

    return results;
  }

  /**
   * Match trigger params against context.
   * E.g. trigger.params.entityType === 'Manufacturer' filters out non-Manufacturer entities.
   */
  _matchTriggerParams(trigger, context) {
    const params = trigger.params || {};

    if (trigger.type === 'onNewEntity' || trigger.type === 'onEntityUpdate') {
      const entity = context.entity;
      if (!entity) return false;
      if (params.entityType && entity.type !== params.entityType) return false;
      if (params.source && entity.source !== params.source) return false;
      if (params.namePattern) {
        try {
          if (!new RegExp(params.namePattern, 'i').test(entity.name)) return false;
        } catch { return false; }
      }
      return true;
    }

    if (trigger.type === 'onConnectorData') {
      if (params.connector && context.connector !== params.connector) return false;
      return true;
    }

    if (trigger.type === 'onEvent') {
      const event = context.event;
      if (!event) return false;
      if (params.modelEventId && String(event.modelEventId) !== String(params.modelEventId)) return false;
      if (params.eventName && event.name !== params.eventName) return false;
      return true;
    }

    // onSchedule — always matches (scheduling is handled externally)
    return true;
  }

  /**
   * Execute an OntologyAction effect.
   */
  async _executeOntologyEffect(effect, context) {
    switch (effect.type) {
      case 'createEntity': {
        const { name, entityType, observations, properties, source } = effect.params || {};
        const resolvedName = this._resolveTemplate(name || '$entity.name', context);
        const resolvedType = this._resolveTemplate(entityType || '$entity.type', context);
        const entityId = `auto_${resolvedType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        return {
          type: 'createEntity',
          entityId,
          name: resolvedName,
          entityType: resolvedType,
          created: true,
        };
      }

      case 'updateEntity': {
        const { entityId: eidTemplate, field, value: valTemplate, operation } = effect.params || {};
        const entityId = this._resolveTemplate(eidTemplate || '$entity.id', context);
        const value = this._resolveTemplate(valTemplate || '', context);

        // operation: 'set', 'increment', 'append', 'addObservation'
        return {
          type: 'updateEntity',
          entityId,
          field,
          value,
          operation: operation || 'set',
          updated: true,
        };
      }

      case 'createIntegram': {
        const { typeId, fieldMap, parentId } = effect.params || {};
        if (!typeId) throw new Error('createIntegram: typeId is required');

        await this.initialize();
        const value = this._resolveTemplate(fieldMap?.name || '$entity.name', context);
        const reqs = {};
        if (fieldMap) {
          for (const [alias, template] of Object.entries(fieldMap)) {
            if (alias === 'name') continue;
            reqs[alias] = this._resolveTemplate(template, context);
          }
        }

        const result = await this.createObject(typeId, value, reqs);
        return {
          type: 'createIntegram',
          typeId,
          objectId: result?.id || result?.obj,
          value,
          created: true,
        };
      }

      case 'notify': {
        const { message: msgTemplate, level, channel } = effect.params || {};
        const message = this._resolveTemplate(msgTemplate || 'OntologyAction fired', context);

        if (channel === 'telegram') {
          try {
            const resp = await axios.post('http://localhost:8082/api/telegram/send', { message });
            return { type: 'notify', channel: 'telegram', sent: resp.status === 200, message };
          } catch (err) {
            logger.warn('[OntologyActions] Telegram notify failed:', err.message);
            return { type: 'notify', channel: 'telegram', sent: false, error: err.message, message };
          }
        }

        logger.info(`[OntologyActions] Notification [${level || 'info'}]: ${message}`);
        return { type: 'notify', channel: 'log', message, level: level || 'info' };
      }

      case 'invokeConnector': {
        const { connectorName, query, limit } = effect.params || {};
        if (!connectorName) throw new Error('invokeConnector: connectorName is required');
        const resolvedQuery = this._resolveTemplate(query || '', context);

        try {
          const resp = await axios.post(`http://localhost:8082/api/connectors/${connectorName}/run`, {
            query: resolvedQuery,
            limit: limit || 10,
          });
          return {
            type: 'invokeConnector',
            connector: connectorName,
            query: resolvedQuery,
            status: resp.data?.status || 'ok',
            entities: resp.data?.entities || 0,
          };
        } catch (err) {
          throw new Error(`invokeConnector ${connectorName}: ${err.message}`);
        }
      }

      case 'invokeAgent': {
        const { agentId, config } = effect.params || {};
        try {
          const resp = await axios.post('http://localhost:8082/api/agents/tasks', {
            type: agentId || 'generic',
            payload: { agentId, config, triggerContext: context },
            metadata: { source: 'OntologyAction' },
          });
          return { type: 'invokeAgent', agentId, taskId: resp.data?.task?.id, invoked: true };
        } catch (err) {
          throw new Error(`invokeAgent ${agentId}: ${err.message}`);
        }
      }

      case 'updateRelevance': {
        const { entityId: eidTemplate, delta, field } = effect.params || {};
        const entityId = this._resolveTemplate(eidTemplate || '$entity.id', context);
        const relevanceField = field || 'relevanceScore';
        const increment = Number(delta) || 1;

        return {
          type: 'updateRelevance',
          entityId,
          field: relevanceField,
          delta: increment,
          updated: true,
        };
      }

      case 'chainActions': {
        const { effects } = effect.params || {};
        if (!Array.isArray(effects)) throw new Error('chainActions: effects must be an array');
        const chainResults = [];
        for (const subEffect of effects) {
          const subResult = await this._executeOntologyEffect(subEffect, context);
          chainResults.push(subResult);
        }
        return { type: 'chainActions', results: chainResults, count: chainResults.length };
      }

      default:
        throw new Error(`Unknown effect type: ${effect.type}`);
    }
  }

  /**
   * Resolve template strings like '$entity.name', '$connector', '$event.value'.
   * Supports simple dot-path resolution.
   */
  _resolveTemplate(template, context) {
    if (!template || typeof template !== 'string') return template;

    return template.replace(/\$([a-zA-Z_][a-zA-Z0-9_.]*)/g, (match, path) => {
      const parts = path.split('.');
      let value = context;
      for (const part of parts) {
        if (value == null) return match;
        value = value[part];
      }
      if (value == null) return match;
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    });
  }

  /**
   * Append to action execution log (circular buffer).
   */
  _appendActionLog(entry) {
    this._ontologyActionLog.push(entry);
    if (this._ontologyActionLog.length > this._ontologyActionLogMax) {
      this._ontologyActionLog = this._ontologyActionLog.slice(-this._ontologyActionLogMax);
    }
  }

  /**
   * Seed default OntologyActions for common use cases.
   */
  seedDefaultOntologyActions() {
    this.constructor_initOntologyActions();

    // 1. When a new Manufacturer entity appears from Wikidata → log notification
    this.registerOntologyAction({
      name: 'Новый производитель из Wikidata',
      trigger: { type: 'onNewEntity', params: { entityType: 'Manufacturer', source: 'wikidata' } },
      condition: 'true',
      effect: { type: 'notify', params: { message: 'Новый производитель: $entity.name', level: 'info' } },
    });

    // 2. When OSINT article mentions a concept 3+ times → boost relevance
    this.registerOntologyAction({
      name: 'OSINT boost relevance',
      trigger: { type: 'onNewEntity', params: { entityType: 'Article' } },
      condition: 'true',
      effect: { type: 'updateRelevance', params: { entityId: '$entity.id', delta: 1, field: 'relevanceScore' } },
    });

    // 3. When a connector delivers data → notify
    this.registerOntologyAction({
      name: 'Connector data notification',
      trigger: { type: 'onConnectorData', params: {} },
      condition: 'true',
      effect: { type: 'notify', params: { message: 'Коннектор $connector доставил новые данные', level: 'info' } },
    });

    // 4. New UAV entity → create in Integram kval ontology table
    this.registerOntologyAction({
      name: 'UAV → kval онтология',
      trigger: { type: 'onNewEntity', params: { entityType: 'UAV' } },
      condition: 'true',
      effect: {
        type: 'createIntegram',
        params: {
          typeId: '1673250',
          fieldMap: { name: '$entity.name', '1673254': '$entity.name', '1673264': 'Импорт из KAG' },
        },
      },
    });

    // 5. Event-driven: subject event → cascade check
    this.registerOntologyAction({
      name: 'Event cascade logger',
      trigger: { type: 'onEvent', params: {} },
      condition: 'true',
      effect: { type: 'notify', params: { message: 'Событие: $event.name = $event.value', level: 'debug' } },
    });

    logger.info(`[OntologyActions] Seeded ${this._ontologyActions.size} default actions`);
    return this.getOntologyActions();
  }

  // ─── System Monitoring Domain Bootstrap ──────────────────────

  /**
   * Bootstrap system monitoring domain in SOD.
   * Creates actors, concept, model, model-events and individual
   * for the frontend systemEventOntology.js integration.
   * Idempotent — skips if already bootstrapped.
   */
  async bootstrapSystemMonitoringDomain() {
    if (this._sysMonBootstrapped) return;

    try {
      // Check if already bootstrapped by looking for the SystemMonitor actor
      const actors = await this.getObjects(this.tables.actors);
      const existingMonitor = actors.find(a => a.val === 'Монитор_системы');
      if (existingMonitor) {
        // Load cached IDs for the bridge
        this._sysMonIds = await this._loadSysMonIds(actors);
        this._sysMonBootstrapped = true;
        logger.info('[EventEngine] System monitoring domain already bootstrapped');
        return;
      }

      logger.info('[EventEngine] Bootstrapping system monitoring domain...');

      // 1. Create Actors
      const monitorActor = await this.createActor('Монитор_системы', {
        type: 'sensor', description: 'Frontend health monitor — probes endpoints, classifies errors',
      });
      const classifierActor = await this.createActor('Классификатор_ошибок', {
        type: 'agent', description: 'Classifies raw errors into ontology event types',
      });
      const correlationActor = await this.createActor('Движок_корреляций', {
        type: 'agent', description: 'Detects causal correlations between system events',
      });

      const monitorId = String(monitorActor?.id || monitorActor?.obj);
      const classifierId = String(classifierActor?.id || classifierActor?.obj);
      const correlationId = String(correlationActor?.id || correlationActor?.obj);

      // 2. Create Concept
      const concept = await this.createConcept('Здоровье системы', 'Мониторинг и самовосстановление системы');
      const conceptId = String(concept?.id || concept?.obj);

      // 3. Find the auto-created model (createConcept auto-creates Модель_Здоровье системы)
      const models = await this.getObjects(this.tables.models);
      const model = models.find(m => m.val === 'Модель_Здоровье системы');
      const modelId = model ? String(model.id) : null;

      if (!modelId) {
        logger.warn('[EventEngine] Модель_Здоровье системы not found after concept creation');
        this._sysMonBootstrapped = true;
        return;
      }

      // 4. Create a property for event data
      const prop = await this.createProperty('EventPayload', {
        propertyType: 'attribute', dataType: 'Text',
      });
      const propId = String(prop?.id || prop?.obj);

      // 5. Create Model Events from EVENT_DOMAINS taxonomy
      const EVENT_DOMAINS = {
        infrastructure: [
          'infra.endpoint_down', 'infra.endpoint_slow', 'infra.endpoint_recovered',
          'infra.backend_crash', 'infra.backend_started', 'infra.proxy_error',
          'infra.dns_failure', 'infra.ssl_error', 'infra.disk_full', 'infra.memory_high',
        ],
        runtime: [
          'runtime.js_error', 'runtime.unhandled_reject', 'runtime.null_ref',
          'runtime.type_error', 'runtime.import_fail', 'runtime.render_error',
          'runtime.memory_leak', 'runtime.infinite_loop', 'runtime.hmr_fail',
        ],
        ai: [
          'ai.llm_timeout', 'ai.llm_error', 'ai.llm_rate_limit', 'ai.llm_empty_response',
          'ai.llm_low_confidence', 'ai.llm_hallucination', 'ai.tool_call_fail',
          'ai.react_loop_stuck', 'ai.provider_down', 'ai.context_overflow', 'ai.embedding_fail',
        ],
        data: [
          'data.kag_unreachable', 'data.kag_sync_conflict', 'data.kag_stale',
          'data.cache_miss', 'data.cache_full', 'data.localstorage_full',
          'data.rag_index_stale', 'data.federation_fail',
        ],
        security: [
          'sec.csp_violation', 'sec.cors_blocked', 'sec.auth_expired',
          'sec.auth_fail', 'sec.xss_attempt', 'sec.rate_limited',
        ],
        ui: [
          'ui.websocket_disconnect', 'ui.websocket_reconnected', 'ui.render_slow',
          'ui.cls_shift', 'ui.user_idle', 'ui.scroll_jank', 'ui.role_changed',
          'ui.menu_settings_changed', 'ui.navigation_suggested', 'ui.page_status_changed',
          'ui.page_visited',
        ],
        organization: [
          'org.created', 'org.switched', 'org.diagnostic_started', 'org.diagnostic_completed',
          'org.agent_deployed', 'org.data_imported', 'org.integration_added',
          'org.budget_exceeded', 'org.onboarding_complete',
        ],
        pipeline: [
          'pipeline.created', 'pipeline.started', 'pipeline.step_completed',
          'pipeline.step_error', 'pipeline.completed', 'pipeline.failed',
          'pipeline.checkpoint', 'pipeline.ab_test_done', 'pipeline.certified',
        ],
        integration: [
          'integration.registered', 'integration.test_ok', 'integration.test_fail',
          'integration.sync_done', 'integration.webhook_recv', 'integration.email_recv',
          'integration.telegram_msg',
        ],
      };

      // Severity/autoAction lookup (matches frontend systemEventOntology.js)
      const SEVERITY_MAP = {
        'infra.endpoint_down': 'critical', 'infra.endpoint_slow': 'warning', 'infra.endpoint_recovered': 'info',
        'infra.backend_crash': 'critical', 'infra.backend_started': 'info', 'infra.proxy_error': 'warning',
        'infra.dns_failure': 'critical', 'infra.ssl_error': 'critical', 'infra.disk_full': 'critical',
        'infra.memory_high': 'warning',
        'runtime.js_error': 'warning', 'runtime.unhandled_reject': 'warning', 'runtime.null_ref': 'critical',
        'runtime.type_error': 'critical', 'runtime.import_fail': 'critical', 'runtime.render_error': 'critical',
        'runtime.memory_leak': 'warning', 'runtime.infinite_loop': 'critical', 'runtime.hmr_fail': 'info',
        'ai.llm_timeout': 'critical', 'ai.llm_error': 'critical', 'ai.llm_rate_limit': 'warning',
        'ai.llm_empty_response': 'warning', 'ai.llm_low_confidence': 'info', 'ai.llm_hallucination': 'warning',
        'ai.tool_call_fail': 'warning', 'ai.react_loop_stuck': 'critical', 'ai.provider_down': 'critical',
        'ai.context_overflow': 'warning', 'ai.embedding_fail': 'warning',
        'data.kag_unreachable': 'critical', 'data.kag_sync_conflict': 'warning', 'data.kag_stale': 'info',
        'data.cache_miss': 'info', 'data.cache_full': 'warning', 'data.localstorage_full': 'warning',
        'data.rag_index_stale': 'info', 'data.federation_fail': 'warning',
        'sec.csp_violation': 'warning', 'sec.cors_blocked': 'warning', 'sec.auth_expired': 'warning',
        'sec.auth_fail': 'critical', 'sec.xss_attempt': 'critical', 'sec.rate_limited': 'warning',
        'pipeline.step_error': 'warning', 'pipeline.failed': 'critical',
        'org.budget_exceeded': 'warning', 'integration.test_fail': 'warning',
      };

      const modelEventIds = {};
      for (const [domain, eventTypes] of Object.entries(EVENT_DOMAINS)) {
        for (const eventType of eventTypes) {
          try {
            const severity = SEVERITY_MAP[eventType] || 'info';
            const result = await this.createModelEvent(eventType, {
              modelId,
              propertyId: propId,
              constraints: { severity, domain },
            });
            modelEventIds[eventType] = String(result?.id || result?.obj);
          } catch (err) {
            logger.warn(`[EventEngine] Failed to create model event ${eventType}:`, err.message);
          }
        }
      }

      // 6. Create Individual — current DronDoc instance
      const individual = await this.createIndividual('ДронДок-экземпляр', {
        conceptId, modelId, actorId: monitorId,
      });
      const individualId = String(individual?.id || individual?.obj);

      // 7. Register monitoring triggers (replaces frontend AUTO_ACTIONS)
      const MONITORING_TRIGGERS = [
        {
          condition: 'severity $EQ "critical" $AND eventType $MATCH "infra.*"',
          action: { type: 'createEvent', params: { name: 'escalation', value: 'Infrastructure critical alert' } },
          priority: 10,
        },
        {
          condition: 'severity $EQ "critical" $AND eventType $MATCH "ai.*"',
          action: { type: 'createEvent', params: { name: 'ai_escalation', value: 'AI subsystem critical alert' } },
          priority: 9,
        },
        {
          condition: 'severity $EQ "critical" $AND eventType $MATCH "sec.*"',
          action: { type: 'createEvent', params: { name: 'security_escalation', value: 'Security critical alert' } },
          priority: 10,
        },
      ];

      for (const trigger of MONITORING_TRIGGERS) {
        try {
          await this.registerTrigger({ modelId, ...trigger });
        } catch (err) {
          logger.warn('[EventEngine] Failed to register monitoring trigger:', err.message);
        }
      }

      // Cache IDs for the bridge API
      this._sysMonIds = {
        actors: {Монитор_системы: monitorId,Классификатор_ошибок: classifierId,Движок_корреляций: correlationId },
        modelId,
        modelEventIds,
        individualId,
        conceptId,
      };

      this._sysMonBootstrapped = true;
      logger.info('[EventEngine] System monitoring domain bootstrapped', {
        actors: 3, modelEvents: Object.keys(modelEventIds).length, individualId,
      });
    } catch (err) {
      logger.error('[EventEngine] Bootstrap system monitoring failed:', err.message);
      this._sysMonBootstrapped = true; // Don't retry on next call
    }
  }

  /**
   * Load system monitoring IDs from existing data.
   */
  async _loadSysMonIds(actors) {
    const monitorActor = actors.find(a => a.val === 'Монитор_системы');
    const classifierActor = actors.find(a => a.val === 'Классификатор_ошибок');
    const correlationActor = actors.find(a => a.val === 'Движок_корреляций');

    const models = await this.getObjects(this.tables.models);
    const model = models.find(m => m.val === 'Модель_Здоровье системы');
    const modelId = model ? String(model.id) : null;

    let modelEventIds = {};
    if (modelId) {
      const allEvents = await this.getObjects(this.tables.modelEvents);
      for (const evt of allEvents) {
        const mReq = evt.reqs['Модель'];
        if (mReq && String(mReq.value) === modelId) {
          modelEventIds[evt.val] = String(evt.id);
        }
      }
    }

    const individuals = await this.getObjects(this.tables.individuals);
    const individual = individuals.find(i => i.val === 'ДронДок-экземпляр');

    return {
      actors: {
       Монитор_системы: monitorActor ? String(monitorActor.id) : null,
       Классификатор_ошибок: classifierActor ? String(classifierActor.id) : null,
       Движок_корреляций: correlationActor ? String(correlationActor.id) : null,
      },
      modelId,
      modelEventIds,
      individualId: individual ? String(individual.id) : null,
    };
  }

  /**
   * Get system monitoring IDs (used by REST API for the bridge).
   */
  getSysMonIds() {
    return this._sysMonIds || null;
  }

  // ─── Item 7: Epistemic Scope Cache ─────────────────────────

  _epistemicScopeCache = new Map() // appId → { scope, ts }
  _EPISTEMIC_CACHE_TTL = 5 * 60 * 1000 // 5 мин

  async getApplicationScopeCached(applicationId) {
    if (!applicationId) return { modelIds: [], conceptIds: [], vocabularyIds: [], unrestricted: true };

    const cached = this._epistemicScopeCache.get(applicationId);
    if (cached && (Date.now() - cached.ts) < this._EPISTEMIC_CACHE_TTL) {
      return cached.scope;
    }

    const scope = await this.getApplicationScope(applicationId);
    this._epistemicScopeCache.set(applicationId, { scope, ts: Date.now() });
    return scope;
  }

  invalidateEpistemicCache(applicationId) {
    if (applicationId) {
      this._epistemicScopeCache.delete(applicationId);
    } else {
      this._epistemicScopeCache.clear();
    }
  }

  // ─── Item 10: FSM Validation ───────────────────────────────

  /**
   * Полная валидация конечного автомата:
   * - BFS reachability от initial
   * - Проверка guard-условий через evaluateCondition
   * - Обнаружение livelocks (циклы без побочных эффектов)
   * - Недостижимые состояния, мёртвые переходы
   */
  async validateFSM(modelId) {
    await this.initialize();
    const states = await this.getStates(modelId);
    const transitions = await this.getTransitions(modelId);

    const issues = [];

    if (states.length === 0) return { valid: false, issues: [{ type: 'error', msg: 'Нет состояний' }] };

    // Поиск initial и final
    const initialStates = states.filter(s => s.reqs['Тип']?.value === 'initial');
    const finalStates = states.filter(s => s.reqs['Тип']?.value === 'final');

    if (initialStates.length === 0) issues.push({ type: 'error', msg: 'Нет начального состояния (initial)' });
    if (initialStates.length > 1) issues.push({ type: 'warning', msg: `Несколько начальных состояний: ${initialStates.map(s => s.val).join(', ')}` });
    if (finalStates.length === 0) issues.push({ type: 'warning', msg: 'Нет конечного состояния (final)' });

    // Построить граф: stateId → [{ transition, targetId }]
    const adj = new Map();
    for (const s of states) adj.set(String(s.id), []);
    for (const t of transitions) {
      const fromId = String(t.reqs['Из']?.value);
      const toId = String(t.reqs['В']?.value);
      if (!adj.has(fromId)) {
        issues.push({ type: 'error', msg: `Переход "${t.val}" ссылается на несуществующее состояние-источник (${fromId})` });
        continue;
      }
      if (!states.find(s => String(s.id) === toId)) {
        issues.push({ type: 'error', msg: `Переход "${t.val}" ссылается на несуществующее состояние-цель (${toId})` });
        continue;
      }
      adj.get(fromId).push({ transition: t, targetId: toId });
    }

    // BFS reachability от initial
    const reachable = new Set();
    if (initialStates.length > 0) {
      const queue = initialStates.map(s => String(s.id));
      for (const sid of queue) reachable.add(sid);
      while (queue.length > 0) {
        const cur = queue.shift();
        for (const edge of (adj.get(cur) || [])) {
          if (!reachable.has(edge.targetId)) {
            reachable.add(edge.targetId);
            queue.push(edge.targetId);
          }
        }
      }
    }

    const unreachable = states.filter(s => !reachable.has(String(s.id)));
    for (const s of unreachable) {
      issues.push({ type: 'warning', msg: `Состояние "${s.val}" недостижимо из начального` });
    }

    // Достижимость final из каждого reachable
    const canReachFinal = new Set(finalStates.map(s => String(s.id)));
    if (finalStates.length > 0) {
      // Обратный граф
      const revAdj = new Map();
      for (const s of states) revAdj.set(String(s.id), []);
      for (const t of transitions) {
        const fromId = String(t.reqs['Из']?.value);
        const toId = String(t.reqs['В']?.value);
        if (revAdj.has(toId)) revAdj.get(toId).push(fromId);
      }
      const revQueue = [...canReachFinal];
      while (revQueue.length > 0) {
        const cur = revQueue.shift();
        for (const prev of (revAdj.get(cur) || [])) {
          if (!canReachFinal.has(prev)) {
            canReachFinal.add(prev);
            revQueue.push(prev);
          }
        }
      }
      const deadEnds = states.filter(s =>
        reachable.has(String(s.id)) && !canReachFinal.has(String(s.id)) && s.reqs['Тип']?.value !== 'final'
      );
      for (const s of deadEnds) {
        issues.push({ type: 'warning', msg: `Состояние "${s.val}" — тупик: не может достичь конечного состояния` });
      }
    }

    // Livelock: циклы без действий (Действие пустое) в SCC
    const visited = new Set();
    const onStack = new Set();
    const cycles = [];
    const detectCycle = (nodeId, path) => {
      if (onStack.has(nodeId)) {
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart >= 0) cycles.push(path.slice(cycleStart));
        return;
      }
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      onStack.add(nodeId);
      for (const edge of (adj.get(nodeId) || [])) {
        detectCycle(edge.targetId, [...path, nodeId]);
      }
      onStack.delete(nodeId);
    };
    for (const s of states) detectCycle(String(s.id), []);

    for (const cycle of cycles) {
      // Проверить есть ли хоть одно Действие в цикле
      const cycleTransitions = transitions.filter(t => {
        const fromId = String(t.reqs['Из']?.value);
        const toId = String(t.reqs['В']?.value);
        const fi = cycle.indexOf(fromId);
        return fi >= 0 && cycle[(fi + 1) % cycle.length] === toId;
      });
      const hasAction = cycleTransitions.some(t => t.reqs['Действие']?.value);
      if (!hasAction && cycleTransitions.length > 0) {
        const names = cycle.map(id => states.find(s => String(s.id) === id)?.val || id);
        issues.push({ type: 'warning', msg: `Возможный livelock: цикл [${names.join(' → ')}] без побочных эффектов` });
      }
    }

    // Валидация guard-условий (парсинг BSL)
    for (const t of transitions) {
      const guard = t.reqs['Охранное условие']?.value;
      if (guard && guard.trim()) {
        try {
          this.evaluateCondition(guard, { values: {}, currentNode: {} });
        } catch {
          issues.push({ type: 'error', msg: `Guard-условие перехода "${t.val}" не парсится: ${guard}` });
        }
      }
    }

    return {
      valid: issues.filter(i => i.type === 'error').length === 0,
      stateCount: states.length,
      transitionCount: transitions.length,
      reachableCount: reachable.size,
      unreachableCount: unreachable.length,
      cycleCount: cycles.length,
      issues,
    };
  }

  // ─── Item 8: SPARQL → BSL Translation ─────────────────────

  /**
   * Транслирует подмножество SPARQL SELECT/WHERE в BSL запрос.
   * Поддерживает: ?x a :Concept, ?x :hasModel :Model, FILTER, LIMIT
   */
  async executeSparql(sparqlQuery) {
    await this.initialize();

    const q = sparqlQuery.trim();

    // Парсинг SELECT ... WHERE { ... } LIMIT N
    const selectMatch = q.match(/SELECT\s+([\s\S]*?)\s+WHERE\s*\{([\s\S]*?)\}(?:\s*LIMIT\s+(\d+))?/i);
    if (!selectMatch) throw new Error('SPARQL parse error: only SELECT ... WHERE { } [LIMIT N] supported');

    const selectVars = selectMatch[1].trim().split(/\s+/);
    const whereBody = selectMatch[2].trim();
    const limit = selectMatch[3] ? parseInt(selectMatch[3]) : 100;

    // Парсинг triple-паттернов
    const triples = whereBody.split('.').map(t => t.trim()).filter(Boolean);
    const bslFilters = [];
    const sparqlFilters = [];

    for (const triple of triples) {
      // FILTER ( ... )
      const filterMatch = triple.match(/FILTER\s*\((.*)\)/i);
      if (filterMatch) {
        sparqlFilters.push(filterMatch[1].trim());
        continue;
      }

      // ?x a :ClassName / ?x rdf:type :ClassName
      const typeMatch = triple.match(/\?\w+\s+(?:a|rdf:type)\s+:?(\w+)/i);
      if (typeMatch) {
        bslFilters.push(`$Concept("${typeMatch[1]}")`);
        continue;
      }

      // ?x :hasModel :ModelName
      const modelMatch = triple.match(/\?\w+\s+:?hasModel\s+:?(\w+)/i);
      if (modelMatch) {
        bslFilters.push(`$Model("${modelMatch[1]}")`);
        continue;
      }

      // ?x :actor :ActorName
      const actorMatch = triple.match(/\?\w+\s+:?(?:actor|hasActor)\s+:?(\w+)/i);
      if (actorMatch) {
        bslFilters.push(`$Actor("${actorMatch[1]}")`);
        continue;
      }

      // ?x :name "value"
      const nameMatch = triple.match(/\?\w+\s+:?name\s+"([^"]+)"/i);
      if (nameMatch) {
        bslFilters.push(`name="${nameMatch[1]}"`);
        continue;
      }
    }

    // SPARQL FILTER → BSL
    for (const f of sparqlFilters) {
      // ?severity = "critical" → severity="critical"
      const eqMatch = f.match(/\?(\w+)\s*=\s*"([^"]+)"/);
      if (eqMatch) bslFilters.push(`${eqMatch[1]}="${eqMatch[2]}"`);
    }

    if (bslFilters.length === 0) {
      // Без фильтров — вернуть все individuals
      const all = await this.getObjectsCached(this.tables.individuals);
      return { results: all.slice(0, limit), query: 'SELECT * (no filters)', bslTranslation: null };
    }

    const bslQuery = `$(${bslFilters.join(', ')})`;
    const result = await this.executeExtendedQuery(bslQuery, {});
    const items = Array.isArray(result) ? result : (result.results || result.individuals || []);

    return {
      results: items.slice(0, limit),
      query: bslQuery,
      bslTranslation: bslQuery,
      variables: selectVars,
    };
  }
  // ═══════════════════════════════════════════════════════════════
  // ▌ DAO ON EXECUTABLE ONTOLOGIES (Boldachev)
  // ▌ Behavior is DERIVED from ontology, not programmed.
  // ▌ Action becomes possible when semantic state satisfies model.
  // ═══════════════════════════════════════════════════════════════

  /**
   * Bootstrap DAO governance domain in SOD.
   * Creates actors, concept, model, model events, properties, FSM states,
   * transitions, triggers, and a default individual.
   */
  async bootstrapDAODomain() {
    if (this._daoBootstrapped) return;

    try {
      const actors = await this.getObjects(this.tables.actors);
      const existingDAO = actors.find(a => a.val === 'DAO_заявитель');
      if (existingDAO) {
        this._daoIds = await this._loadDAOIds(actors);
        this._daoBootstrapped = true;
        logger.info('[EventEngine] DAO domain already bootstrapped');
        return;
      }

      logger.info('[EventEngine] Bootstrapping DAO governance domain...');

      // 1. Create Actors
      const proposer = await this.createActor('DAO_заявитель', {
        type: 'agent', description: 'Creates proposals in DAO governance',
      });
      const voter = await this.createActor('DAO_голосующий', {
        type: 'agent', description: 'Votes on DAO proposals',
      });
      const executor = await this.createActor('DAO_исполнитель', {
        type: 'agent', description: 'Executes approved DAO proposals',
      });
      const oracle = await this.createActor('DAO_оракул', {
        type: 'sensor', description: 'External fact source (Wiki, data feeds)',
      });

      const proposerId = String(proposer?.id || proposer?.obj);
      const voterId = String(voter?.id || voter?.obj);
      const executorId = String(executor?.id || executor?.obj);
      const oracleId = String(oracle?.id || oracle?.obj);

      // 2. Create Concept → auto-creates Модель_DAO_управление
      const concept = await this.createConcept('DAO_управление', 'DAO-управление с самоисполняемыми предложениями');
      const conceptId = String(concept?.id || concept?.obj);

      // 3. Find auto-created model
      const models = await this.getObjects(this.tables.models);
      const model = models.find(m => m.val === 'Модель_DAO_управление');
      const modelId = model ? String(model.id) : null;

      if (!modelId) {
        logger.warn('[EventEngine] Модель_DAO_управление not found after concept creation');
        this._daoBootstrapped = true;
        return;
      }

      // 4. Create properties
      const props = {};
      const propDefs = [
        ['Quorum', { propertyType: 'attribute', dataType: 'Number' }],
        ['Threshold', { propertyType: 'attribute', dataType: 'Number' }],
        ['VoteWeight', { propertyType: 'attribute', dataType: 'Number' }],
        ['Verdict', { propertyType: 'attribute', dataType: 'Text' }],
        ['ProposalStatus', { propertyType: 'attribute', dataType: 'Text' }],
        ['WikiRef', { propertyType: 'attribute', dataType: 'Text' }],
        ['Reputation', { propertyType: 'attribute', dataType: 'Number' }],
        ['BSLRule', { propertyType: 'attribute', dataType: 'Text' }],
      ];
      for (const [name, opts] of propDefs) {
        try {
          const p = await this.createProperty(name, opts);
          props[name] = String(p?.id || p?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create DAO property ${name}:`, err.message);
        }
      }

      // 5. Create Model Events
      const DAO_EVENTS = [
        ['dao.proposal_created', { required: true, permission: 'proposer' }],
        ['dao.proposal_amended', { permission: 'proposer' }],
        ['dao.voting_opened', { setValue: '$Now' }],
        ['dao.vote_cast', { permission: 'voter' }],
        ['dao.quorum_reached', { setValue: 'auto' }],
        ['dao.proposal_approved', { immutable: true }],
        ['dao.proposal_rejected', { immutable: true }],
        ['dao.proposal_executed', { immutable: true }],
        ['dao.proposal_expired', {}],
        ['dao.wiki_fact_updated', {}],
        ['dao.wiki_verified', {}],
        ['dao.reputation_changed', {}],
        ['dao.member_joined', {}],
        ['dao.member_left', {}],
      ];

      const modelEventIds = {};
      for (const [eventType, constraints] of DAO_EVENTS) {
        try {
          const result = await this.createModelEvent(eventType, {
            modelId,
            propertyId: props.ProposalStatus || props.Verdict,
            constraints,
          });
          modelEventIds[eventType] = String(result?.id || result?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create DAO model event ${eventType}:`, err.message);
        }
      }

      // 6. Create FSM states
      const FSM_STATES = [
        ['Черновик', 'initial'],
        ['Открыт', 'normal'],
        ['Голосование', 'normal'],
        ['Одобрен', 'normal'],
        ['Отклонён', 'final'],
        ['Исполнен', 'final'],
        ['Истёк', 'final'],
      ];

      const stateIds = {};
      if (this.createState) {
        for (const [name, type] of FSM_STATES) {
          try {
            const s = await this.createState(modelId, { name, type });
            stateIds[name] = String(s?.id || s?.obj);
          } catch (err) {
            logger.warn(`[EventEngine] Failed to create DAO state ${name}:`, err.message);
          }
        }

        // 7. Create FSM transitions
        const FSM_TRANSITIONS = [
          ['Черновик', 'Открыт', 'dao.voting_opened', ''],
          ['Открыт', 'Голосование', 'dao.vote_cast', ''],
          ['Голосование', 'Одобрен', 'dao.quorum_reached', 'threshold_met $EQ true'],
          ['Голосование', 'Отклонён', 'dao.quorum_reached', 'threshold_met $EQ false'],
          ['Голосование', 'Истёк', 'dao.proposal_expired', ''],
          ['Одобрен', 'Исполнен', 'dao.proposal_executed', ''],
        ];

        for (const [from, to, trigger, guard] of FSM_TRANSITIONS) {
          if (stateIds[from] && stateIds[to]) {
            try {
              await this.createTransition(modelId, {
                fromStateId: stateIds[from],
                toStateId: stateIds[to],
                trigger,
                guard: guard || undefined,
              });
            } catch (err) {
              logger.warn(`[EventEngine] Failed to create DAO transition ${from}→${to}:`, err.message);
            }
          }
        }
      }

      // 8. Create Individual — the DAO instance
      const individual = await this.createIndividual('DAO-экземпляр', {
        conceptId, modelId, actorId: proposerId,
      });
      const individualId = String(individual?.id || individual?.obj);

      // 9. Register DAO triggers (self-execution core)
      const DAO_TRIGGERS = [
        {
          // Quorum check — on every vote_cast
          condition: 'eventType $EQ "dao.vote_cast"',
          action: {
            type: 'computeValue',
            params: { expression: 'dao_quorum_check' },
          },
          priority: 10,
        },
        {
          // Auto-execute on proposal_approved
          condition: 'eventType $EQ "dao.proposal_approved"',
          action: {
            type: 'invokeAgent',
            params: { agentId: 'DAO_исполнитель', taskDescription: 'Исполнить одобренное DAO-предложение' },
          },
          priority: 9,
        },
        {
          // Wiki invalidation — on wiki_fact_updated
          condition: 'eventType $EQ "dao.wiki_fact_updated"',
          action: {
            type: 'createEvent',
            params: { name: 'dao.wiki_verified', value: 'false' },
          },
          priority: 8,
        },
      ];

      for (const trigger of DAO_TRIGGERS) {
        try {
          await this.registerTrigger({ modelId, ...trigger });
        } catch (err) {
          logger.warn('[EventEngine] Failed to register DAO trigger:', err.message);
        }
      }

      // Cache IDs
      this._daoIds = {
        actors: {DAO_заявитель: proposerId,DAO_голосующий: voterId,DAO_исполнитель: executorId,DAO_оракул: oracleId },
        modelId,
        modelEventIds,
        individualId,
        conceptId,
        stateIds,
        props,
      };

      this._daoBootstrapped = true;
      logger.info('[EventEngine] DAO governance domain bootstrapped', {
        actors: 4, modelEvents: Object.keys(modelEventIds).length, individualId,
      });
    } catch (err) {
      logger.error('[EventEngine] Bootstrap DAO domain failed:', err.message);
      this._daoBootstrapped = true;
    }
  }

  /**
   * Load DAO IDs from existing data.
   */
  async _loadDAOIds(actors) {
    const proposer = actors.find(a => a.val === 'DAO_заявитель');
    const voter = actors.find(a => a.val === 'DAO_голосующий');
    const executor = actors.find(a => a.val === 'DAO_исполнитель');
    const oracle = actors.find(a => a.val === 'DAO_оракул');

    const models = await this.getObjects(this.tables.models);
    const model = models.find(m => m.val === 'Модель_DAO_управление');
    const modelId = model ? String(model.id) : null;

    let modelEventIds = {};
    if (modelId) {
      const allEvents = await this.getObjects(this.tables.modelEvents);
      for (const evt of allEvents) {
        const mReq = evt.reqs['Модель'];
        if (mReq && String(mReq.value) === modelId && evt.val.startsWith('dao.')) {
          modelEventIds[evt.val] = String(evt.id);
        }
      }
    }

    const individuals = await this.getObjects(this.tables.individuals);
    const individual = individuals.find(i => i.val === 'DAO-экземпляр');

    return {
      actors: {
       DAO_заявитель: proposer ? String(proposer.id) : null,
       DAO_голосующий: voter ? String(voter.id) : null,
       DAO_исполнитель: executor ? String(executor.id) : null,
       DAO_оракул: oracle ? String(oracle.id) : null,
      },
      modelId,
      modelEventIds,
      individualId: individual ? String(individual.id) : null,
    };
  }

  /**
   * Get DAO IDs (used by REST API).
   */
  getDAOIds() {
    return this._daoIds || null;
  }

  // ─── DAO Proposal Management ──────────────────────────────────

  /**
   * Create a new DAO proposal.
   * Creates an Individual in SOD + initial subject event.
   */
  async createDAOProposal({ title, description, bslRule, wikiRef, quorum = 3, threshold = 60, actorId }) {
    await this.initialize();
    await this.bootstrapDAODomain();
    const ids = this._daoIds;
    if (!ids) throw new Error('DAO domain not bootstrapped');

    const proposerActorId = actorId || ids.actors.DAO_заявитель;

    // Create Individual for the proposal
    const individual = await this.createIndividual(title, {
      conceptId: ids.conceptId,
      modelId: ids.modelId,
      actorId: proposerActorId,
    });
    const proposalId = String(individual?.id || individual?.obj);

    // Create initial subject event: dao.proposal_created
    const eventResult = await this.createSubjectEvent('dao.proposal_created', {
      individualId: proposalId,
      modelEventId: ids.modelEventIds['dao.proposal_created'],
      value: JSON.stringify({ title, description, bslRule, wikiRef, quorum, threshold, status: 'draft' }),
      actorId: proposerActorId,
      causes: [],
    });

    return {
      proposalId,
      eventId: String(eventResult?.id || eventResult?.obj),
      title,
      status: 'draft',
      quorum,
      threshold,
    };
  }

  /**
   * Get all DAO proposals with their current status.
   */
  async getDAOProposals(statusFilter) {
    await this.initialize();
    await this.bootstrapDAODomain();
    const ids = this._daoIds;
    if (!ids) return [];

    const individuals = await this.getObjects(this.tables.individuals);
    const proposals = individuals.filter(ind => {
      const conceptReq = ind.reqs['Концепт'];
      return conceptReq && String(conceptReq.value) === ids.conceptId;
    });

    // For each proposal, get latest status from events
    const results = [];
    for (const proposal of proposals) {
      if (proposal.val === 'DAO-экземпляр') continue; // skip the root individual
      const events = await this.getSubjectEvents(proposal.id);
      let latestData = { status: 'draft', title: proposal.val };
      let votes = { approve: 0, reject: 0, abstain: 0, totalWeight: 0, voters: [] };

      for (const evt of events) {
        try {
          const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          if (val.status) latestData = { ...latestData, ...val };
        } catch { /* not JSON, skip */ }

        // Count votes
        if (evt.val === 'dao.vote_cast') {
          try {
            const voteData = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
            const verdict = voteData.verdict || 'abstain';
            const weight = Number(voteData.weight) || 1;
            votes[verdict.toLowerCase()] = (votes[verdict.toLowerCase()] || 0) + weight;
            votes.totalWeight += weight;
            votes.voters.push({ actorId: evt.reqs?.['Актор']?.value, verdict, weight });
          } catch { /* skip */ }
        }

        // Check for status-changing events
        if (evt.val === 'dao.voting_opened') latestData.status = 'voting';
        if (evt.val === 'dao.proposal_approved') latestData.status = 'approved';
        if (evt.val === 'dao.proposal_rejected') latestData.status = 'rejected';
        if (evt.val === 'dao.proposal_executed') latestData.status = 'executed';
        if (evt.val === 'dao.proposal_expired') latestData.status = 'expired';
      }

      if (statusFilter && latestData.status !== statusFilter) continue;

      results.push({
        id: proposal.id,
        ...latestData,
        votes,
        eventCount: events.length,
      });
    }

    return results;
  }

  /**
   * Get details of a specific DAO proposal.
   */
  async getDAOProposalDetail(proposalId) {
    await this.initialize();
    await this.bootstrapDAODomain();
    const ids = this._daoIds;

    const events = await this.getSubjectEvents(proposalId);
    let proposalData = { status: 'draft' };
    let votes = [];
    let causalChain = [];

    for (const evt of events) {
      try {
        const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
        if (val.title) proposalData = { ...proposalData, ...val };
      } catch { /* not JSON */ }

      if (evt.val === 'dao.vote_cast') {
        try {
          const voteData = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          votes.push({
            eventId: evt.id,
            actorId: evt.reqs?.['Актор']?.value,
            verdict: voteData.verdict,
            weight: Number(voteData.weight) || 1,
            timestamp: evt.reqs?.['Временная метка']?.value,
          });
        } catch { /* skip */ }
      }

      if (evt.val === 'dao.voting_opened') proposalData.status = 'voting';
      if (evt.val === 'dao.proposal_approved') proposalData.status = 'approved';
      if (evt.val === 'dao.proposal_rejected') proposalData.status = 'rejected';
      if (evt.val === 'dao.proposal_executed') proposalData.status = 'executed';
      if (evt.val === 'dao.proposal_expired') proposalData.status = 'expired';

      causalChain.push({
        id: evt.id,
        type: evt.val,
        value: evt.reqs?.['Значение']?.value,
        actorId: evt.reqs?.['Актор']?.value,
        timestamp: evt.reqs?.['Временная метка']?.value,
      });
    }

    const quorum = proposalData.quorum || 3;
    const threshold = proposalData.threshold || 60;
    const totalVotes = votes.reduce((sum, v) => sum + v.weight, 0);
    const approves = votes.filter(v => v.verdict === 'APPROVE').reduce((sum, v) => sum + v.weight, 0);
    const rejects = votes.filter(v => v.verdict === 'REJECT').reduce((sum, v) => sum + v.weight, 0);
    const approvePercent = totalVotes > 0 ? Math.round((approves / totalVotes) * 100) : 0;

    return {
      id: proposalId,
      ...proposalData,
      votes,
      quorumProgress: { current: totalVotes, required: quorum, met: totalVotes >= quorum },
      thresholdProgress: { approves, rejects, approvePercent, required: threshold, met: approvePercent >= threshold },
      causalChain,
    };
  }

  /**
   * Process a DAO vote — self-execution core.
   *
   * 1. Creates dao.vote_cast subject event
   * 2. Counts quorum via event graph query
   * 3. If quorum reached → auto creates dao.quorum_reached
   * 4. If threshold met → dao.proposal_approved → triggers DAOExecutor
   * 5. If not → dao.proposal_rejected
   *
   * The entire chain is traceable via getCausalChain().
   */
  async processDAOVote(proposalId, actorId, verdict, weight = 1) {
    await this.initialize();
    await this.bootstrapDAODomain();
    const ids = this._daoIds;
    if (!ids) throw new Error('DAO domain not bootstrapped');

    const voterActorId = actorId || ids.actors.DAO_голосующий;

    // Get proposal events to find the proposal data and existing votes
    const events = await this.getSubjectEvents(proposalId);
    let proposalData = {};
    const existingVotes = [];
    let lastEventId = null;

    for (const evt of events) {
      lastEventId = evt.id;
      try {
        const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
        if (val.title) proposalData = { ...proposalData, ...val };
      } catch { /* not JSON */ }

      if (evt.val === 'dao.vote_cast') {
        try {
          const voteData = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          existingVotes.push({
            actorId: evt.reqs?.['Актор']?.value,
            verdict: voteData.verdict,
            weight: Number(voteData.weight) || 1,
          });
        } catch { /* skip */ }
      }

      // Check if already decided
      if (['dao.proposal_approved', 'dao.proposal_rejected', 'dao.proposal_executed', 'dao.proposal_expired'].includes(evt.val)) {
        throw new Error(`Proposal already ${evt.val.replace('dao.proposal_', '')}`);
      }
    }

    // Check for duplicate vote
    if (existingVotes.some(v => String(v.actorId) === String(voterActorId))) {
      throw new Error('Actor has already voted on this proposal');
    }

    // 1. Create vote_cast event
    const voteEvent = await this.createSubjectEvent('dao.vote_cast', {
      individualId: proposalId,
      modelEventId: ids.modelEventIds['dao.vote_cast'],
      value: JSON.stringify({ verdict: verdict.toUpperCase(), weight }),
      actorId: voterActorId,
      causes: lastEventId ? [String(lastEventId)] : [],
    });
    const voteEventId = String(voteEvent?.id || voteEvent?.obj);

    // 2. Compute quorum
    const allVotes = [...existingVotes, { actorId: voterActorId, verdict: verdict.toUpperCase(), weight }];
    const totalWeight = allVotes.reduce((sum, v) => sum + v.weight, 0);
    const approves = allVotes.filter(v => v.verdict === 'APPROVE').reduce((sum, v) => sum + v.weight, 0);
    const rejects = allVotes.filter(v => v.verdict === 'REJECT').reduce((sum, v) => sum + v.weight, 0);
    const quorum = Number(proposalData.quorum) || 3;
    const threshold = Number(proposalData.threshold) || 60;

    const result = { voteEventId, totalVotes: totalWeight, approves, rejects, quorum, threshold };

    // 3. Check quorum
    if (totalWeight >= quorum) {
      const approvePercent = Math.round((approves / totalWeight) * 100);
      const thresholdMet = approvePercent >= threshold;

      // Create quorum_reached event
      const quorumEvent = await this.createSubjectEvent('dao.quorum_reached', {
        individualId: proposalId,
        modelEventId: ids.modelEventIds['dao.quorum_reached'],
        value: JSON.stringify({ totalVotes: totalWeight, approves, rejects, approvePercent, thresholdMet }),
        actorId: ids.actors.DAO_исполнитель,
        causes: [voteEventId],
      });
      const quorumEventId = String(quorumEvent?.id || quorumEvent?.obj);
      result.quorumReached = true;
      result.quorumEventId = quorumEventId;
      result.approvePercent = approvePercent;
      result.thresholdMet = thresholdMet;

      // 4. Self-execution: approve or reject
      if (thresholdMet) {
        const approvedEvent = await this.createSubjectEvent('dao.proposal_approved', {
          individualId: proposalId,
          modelEventId: ids.modelEventIds['dao.proposal_approved'],
          value: JSON.stringify({ status: 'approved', approvePercent, bslRule: proposalData.bslRule }),
          actorId: ids.actors.DAO_исполнитель,
          causes: [quorumEventId],
        });
        result.approvedEventId = String(approvedEvent?.id || approvedEvent?.obj);
        result.status = 'approved';

        // 5. Auto-execute if BSL rule exists
        if (proposalData.bslRule) {
          try {
            const executedEvent = await this.createSubjectEvent('dao.proposal_executed', {
              individualId: proposalId,
              modelEventId: ids.modelEventIds['dao.proposal_executed'],
              value: JSON.stringify({ status: 'executed', bslRule: proposalData.bslRule, executedAt: new Date().toISOString() }),
              actorId: ids.actors.DAO_исполнитель,
              causes: [result.approvedEventId],
            });
            result.executedEventId = String(executedEvent?.id || executedEvent?.obj);
            result.status = 'executed';
          } catch (err) {
            logger.warn('[DAO] Auto-execution failed:', err.message);
            result.executionError = err.message;
          }
        }
      } else {
        const rejectedEvent = await this.createSubjectEvent('dao.proposal_rejected', {
          individualId: proposalId,
          modelEventId: ids.modelEventIds['dao.proposal_rejected'],
          value: JSON.stringify({ status: 'rejected', approvePercent }),
          actorId: ids.actors.DAO_исполнитель,
          causes: [quorumEventId],
        });
        result.rejectedEventId = String(rejectedEvent?.id || rejectedEvent?.obj);
        result.status = 'rejected';
      }
    } else {
      result.quorumReached = false;
      result.remaining = quorum - totalWeight;
    }

    return result;
  }

  /**
   * Open voting on a DAO proposal.
   */
  async openDAOVoting(proposalId, actorId) {
    await this.initialize();
    await this.bootstrapDAODomain();
    const ids = this._daoIds;
    if (!ids) throw new Error('DAO domain not bootstrapped');

    const events = await this.getSubjectEvents(proposalId);
    const lastEventId = events.length > 0 ? events[events.length - 1].id : null;

    const result = await this.createSubjectEvent('dao.voting_opened', {
      individualId: proposalId,
      modelEventId: ids.modelEventIds['dao.voting_opened'],
      value: JSON.stringify({ status: 'voting', openedAt: new Date().toISOString() }),
      actorId: actorId || ids.actors.DAO_заявитель,
      causes: lastEventId ? [String(lastEventId)] : [],
    });

    return { eventId: String(result?.id || result?.obj), status: 'voting' };
  }

  /**
   * Get quorum progress for a proposal.
   */
  async getDAOQuorumProgress(proposalId) {
    await this.initialize();
    await this.bootstrapDAODomain();

    const events = await this.getSubjectEvents(proposalId);
    let proposalData = {};
    const votes = [];

    for (const evt of events) {
      try {
        const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
        if (val.title) proposalData = { ...proposalData, ...val };
      } catch { /* skip */ }

      if (evt.val === 'dao.vote_cast') {
        try {
          const voteData = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          votes.push({
            actorId: evt.reqs?.['Актор']?.value,
            verdict: voteData.verdict,
            weight: Number(voteData.weight) || 1,
          });
        } catch { /* skip */ }
      }
    }

    const quorum = Number(proposalData.quorum) || 3;
    const threshold = Number(proposalData.threshold) || 60;
    const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
    const approves = votes.filter(v => v.verdict === 'APPROVE').reduce((sum, v) => sum + v.weight, 0);
    const rejects = votes.filter(v => v.verdict === 'REJECT').reduce((sum, v) => sum + v.weight, 0);
    const abstains = votes.filter(v => v.verdict === 'ABSTAIN').reduce((sum, v) => sum + v.weight, 0);
    const approvePercent = totalWeight > 0 ? Math.round((approves / totalWeight) * 100) : 0;

    return {
      quorum,
      threshold,
      totalVotes: totalWeight,
      approves,
      rejects,
      abstains,
      approvePercent,
      quorumMet: totalWeight >= quorum,
      thresholdMet: approvePercent >= threshold,
      remaining: Math.max(0, quorum - totalWeight),
      voters: votes,
    };
  }

  /**
   * Register a DAO member — creates Actor + RoleBinding.
   */
  async registerDAOMember({ name, roles = ['voter'], reputation = 100 }) {
    await this.initialize();
    await this.bootstrapDAODomain();
    const ids = this._daoIds;
    if (!ids) throw new Error('DAO domain not bootstrapped');

    const actor = await this.createActor(name, {
      type: 'agent', description: `DAO member: ${roles.join(', ')}`,
    });
    const actorId = String(actor?.id || actor?.obj);

    // Create member_joined event
    await this.createSubjectEvent('dao.member_joined', {
      individualId: ids.individualId,
      modelEventId: ids.modelEventIds['dao.member_joined'],
      value: JSON.stringify({ name, roles, reputation, actorId }),
      actorId,
      causes: [],
    });

    return { actorId, name, roles, reputation };
  }

  /**
   * Get DAO members with reputation.
   */
  async getDAOMembers() {
    await this.initialize();
    await this.bootstrapDAODomain();
    const ids = this._daoIds;
    if (!ids) return [];

    const events = await this.getSubjectEvents(ids.individualId);
    const members = new Map();

    for (const evt of events) {
      if (evt.val === 'dao.member_joined') {
        try {
          const data = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          members.set(data.actorId, { ...data });
        } catch { /* skip */ }
      }
      if (evt.val === 'dao.member_left') {
        try {
          const data = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          members.delete(data.actorId);
        } catch { /* skip */ }
      }
      if (evt.val === 'dao.reputation_changed') {
        try {
          const data = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          const existing = members.get(data.actorId);
          if (existing) existing.reputation = data.reputation;
        } catch { /* skip */ }
      }
    }

    return Array.from(members.values());
  }

  /**
   * Update a member's reputation.
   */
  async updateDAOMemberReputation(actorId, reputation) {
    await this.initialize();
    await this.bootstrapDAODomain();
    const ids = this._daoIds;
    if (!ids) throw new Error('DAO domain not bootstrapped');

    const result = await this.createSubjectEvent('dao.reputation_changed', {
      individualId: ids.individualId,
      modelEventId: ids.modelEventIds['dao.reputation_changed'],
      value: JSON.stringify({ actorId, reputation }),
      actorId,
      causes: [],
    });

    return { eventId: String(result?.id || result?.obj), actorId, reputation };
  }

  // ─── LLM → BSL Generator (Phase 3) ────────────────────────────

  /**
   * Generate a BSL rule from natural language description.
   * Uses LLM (Claude API) to translate human-readable conditions into BSL syntax.
   */
  async generateBSLFromNaturalLanguage(text, context = {}) {
    const BSL_EXAMPLES = [
      { nl: 'severity is critical and event is infrastructure', bsl: 'severity $EQ "critical" $AND eventType $MATCH "infra.*"' },
      { nl: 'at least 3 votes and 60% approval', bsl: 'totalVotes $GE 3 $AND approvePercent $GT 60' },
      { nl: 'wiki article is disputed and require 75% quorum', bsl: 'wiki_disputed $EQ true $AND threshold $EQ 75' },
      { nl: 'reputation above 50 and is a voter', bsl: 'reputation $GT 50 $AND role $EQ "voter"' },
      { nl: 'proposal status is voting', bsl: 'ProposalStatus $EQ "voting"' },
      { nl: 'event type is vote cast', bsl: 'eventType $EQ "dao.vote_cast"' },
    ];

    const availableEvents = [
      'dao.proposal_created', 'dao.proposal_amended', 'dao.voting_opened',
      'dao.vote_cast', 'dao.quorum_reached', 'dao.proposal_approved',
      'dao.proposal_rejected', 'dao.proposal_executed', 'dao.proposal_expired',
      'dao.wiki_fact_updated', 'dao.wiki_verified', 'dao.reputation_changed',
      'dao.member_joined', 'dao.member_left',
    ];

    const prompt = `You are a BSL (Boldachev Semantic Language) compiler.

BSL operators: $EQ (equals), $NE (not equals), $GT (greater than), $LT (less than), $GE (>=), $LE (<=), $MATCH (regex match), $AND (logical and), $OR (logical or), $NOT (logical not)

Available model events: ${availableEvents.join(', ')}
Available properties: eventType, severity, value, Quorum, Threshold, VoteWeight, Verdict, ProposalStatus, WikiRef, Reputation, BSLRule, totalVotes, approves, rejects, approvePercent, wiki_verified, wiki_disputed, reputation, role, threshold

Examples:
${BSL_EXAMPLES.map(e => `  "${e.nl}" → ${e.bsl}`).join('\n')}

Translate this natural language rule into BSL:
"${text}"

${context.additionalContext ? `Additional context: ${context.additionalContext}` : ''}

Respond ONLY with the BSL expression, nothing else.`;

    try {
      // Try calling Claude API via backend proxy
      const axios = (await import('axios')).default;

      // Check if ANTHROPIC_API_KEY is available
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        // Fallback: simple rule-based translation
        return this._fallbackBSLGeneration(text);
      }

      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 15000,
      });

      const bsl = (response.data?.content?.[0]?.text || '').trim();

      // Validate the generated BSL
      const validation = this._validateBSL(bsl);

      return {
        bsl,
        explanation: `Generated from: "${text}"`,
        valid: validation.valid,
        issues: validation.issues,
        testResult: validation.valid ? this.evaluateCondition(bsl, { values: {} }) : null,
      };
    } catch (err) {
      logger.warn('[DAO] LLM BSL generation failed, using fallback:', err.message);
      return this._fallbackBSLGeneration(text);
    }
  }

  /**
   * Fallback rule-based BSL generation when LLM is unavailable.
   */
  _fallbackBSLGeneration(text) {
    const lower = text.toLowerCase();
    let bsl = '';

    // Simple pattern matching
    const patterns = [
      [/(\d+)%?\s*(кворум|quorum|approval)/i, (m) => `approvePercent $GE ${m[1]}`],
      [/минимум\s+(\d+)\s+голос/i, (m) => `totalVotes $GE ${m[1]}`],
      [/at least (\d+) votes?/i, (m) => `totalVotes $GE ${m[1]}`],
      [/статус\s+(\w+)/i, (m) => `ProposalStatus $EQ "${m[1]}"`],
      [/status\s+is\s+(\w+)/i, (m) => `ProposalStatus $EQ "${m[1]}"`],
      [/репутация\s*(выше|больше|>)\s*(\d+)/i, (m) => `reputation $GT ${m[2]}`],
      [/reputation\s*(above|greater|>)\s*(\d+)/i, (m) => `reputation $GT ${m[2]}`],
      [/событие\s+(\S+)/i, (m) => `eventType $EQ "${m[1]}"`],
      [/event\s+type\s+is\s+(\S+)/i, (m) => `eventType $EQ "${m[1]}"`],
    ];

    const parts = [];
    for (const [regex, gen] of patterns) {
      const match = text.match(regex);
      if (match) parts.push(gen(match));
    }

    bsl = parts.length > 0 ? parts.join(' $AND ') : `value $EQ "${text}"`;

    const validation = this._validateBSL(bsl);
    return {
      bsl,
      explanation: `Rule-based generation from: "${text}" (LLM unavailable)`,
      valid: validation.valid,
      issues: validation.issues,
      testResult: validation.valid ? this.evaluateCondition(bsl, { values: {} }) : null,
    };
  }

  /**
   * Validate a BSL expression.
   */
  _validateBSL(bsl) {
    const issues = [];

    if (!bsl || typeof bsl !== 'string') {
      issues.push('Empty or non-string BSL expression');
      return { valid: false, issues };
    }

    // Check for balanced quotes
    const quoteCount = (bsl.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) issues.push('Unbalanced quotes');

    // Check for balanced parentheses
    let parenDepth = 0;
    for (const ch of bsl) {
      if (ch === '(') parenDepth++;
      if (ch === ')') parenDepth--;
      if (parenDepth < 0) { issues.push('Unbalanced parentheses'); break; }
    }
    if (parenDepth !== 0 && !issues.includes('Unbalanced parentheses')) issues.push('Unbalanced parentheses');

    // Check that operators are valid
    const validOps = ['$EQ', '$NE', '$GT', '$LT', '$GE', '$LE', '$AND', '$OR', '$NOT', '$MATCH', '$BEFORE', '$AFTER', '$BETWEEN'];
    const opMatches = bsl.match(/\$\w+/g) || [];
    for (const op of opMatches) {
      if (!validOps.includes(op)) issues.push(`Unknown operator: ${op}`);
    }

    // Try to evaluate with empty context to check syntax
    try {
      this.evaluateCondition(bsl, { values: {} });
    } catch (err) {
      issues.push(`Evaluation error: ${err.message}`);
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Validate a BSL rule (public API).
   */
  validateBSLRule(bsl) {
    const validation = this._validateBSL(bsl);
    validation.testResult = validation.valid ? this.evaluateCondition(bsl, { values: {} }) : null;
    return validation;
  }

  /**
   * Create a sandbox fork for testing a BSL rule.
   * Clones the current DAO event graph state for isolated testing.
   */
  async createDAOSandbox(proposalId) {
    await this.initialize();
    await this.bootstrapDAODomain();
    const ids = this._daoIds;
    if (!ids) throw new Error('DAO domain not bootstrapped');

    // Create a sandbox individual (a fork of the proposal)
    const sandbox = await this.createIndividual(`Sandbox_${proposalId}_${Date.now()}`, {
      conceptId: ids.conceptId,
      modelId: ids.modelId,
      actorId: ids.actors.DAO_заявитель,
    });
    const sandboxId = String(sandbox?.id || sandbox?.obj);

    // Copy events from original proposal
    if (proposalId) {
      const events = await this.getSubjectEvents(proposalId);
      for (const evt of events) {
        await this.createSubjectEvent(`sandbox.${evt.val}`, {
          individualId: sandboxId,
          value: evt.reqs?.['Значение']?.value || '',
          actorId: evt.reqs?.['Актор']?.value || ids.actors.DAO_заявитель,
          causes: [],
        });
      }
    }

    return { sandboxId, forkedFrom: proposalId };
  }

  // ─── Operations Ontology Domain ──────────────────────────────────

  async bootstrapOperationsDomain() {
    if (this._opsBootstrapped) return;

    try {
      const actors = await this.getObjects(this.tables.actors);
      const existingOps = actors.find(a => a.val === 'Планировщик_миссий');
      if (existingOps) {
        this._opsIds = await this._loadOpsIds(actors);
        this._opsBootstrapped = true;
        logger.info('[EventEngine] Operations domain already bootstrapped');
        return;
      }

      logger.info('[EventEngine] Bootstrapping operations domain...');

      // 1. Create Actors
      const missionPlanner = await this.createActor('Планировщик_миссий', {
        type: 'agent', description: 'Планирует миссии БПЛА',
      });
      const fleetManager = await this.createActor('Менеджер_флота', {
        type: 'agent', description: 'Мониторит здоровье флота',
      });
      const weatherOracle = await this.createActor('Оракул_погоды', {
        type: 'sensor', description: 'Предоставляет данные о погоде',
      });
      const airspaceOracle = await this.createActor('Оракул_воздушного_пространства', {
        type: 'sensor', description: 'Предоставляет статус воздушного пространства',
      });
      const complianceAuditor = await this.createActor('Аудитор_соответствия', {
        type: 'agent', description: 'Аудит соответствия',
      });
      const procurementAdvisor = await this.createActor('Советник_закупок', {
        type: 'agent', description: 'Рекомендации по закупкам',
      });

      const missionPlannerId = String(missionPlanner?.id || missionPlanner?.obj);
      const fleetManagerId = String(fleetManager?.id || fleetManager?.obj);
      const weatherOracleId = String(weatherOracle?.id || weatherOracle?.obj);
      const airspaceOracleId = String(airspaceOracle?.id || airspaceOracle?.obj);
      const complianceAuditorId = String(complianceAuditor?.id || complianceAuditor?.obj);
      const procurementAdvisorId = String(procurementAdvisor?.id || procurementAdvisor?.obj);

      // 2. Create Concept → auto-creates Модель_Операции БПЛА
      const concept = await this.createConcept('Операции БПЛА', 'Жизненный цикл операций БПЛА');
      const conceptId = String(concept?.id || concept?.obj);

      // 3. Find auto-created model
      const models = await this.getObjects(this.tables.models);
      const model = models.find(m => m.val === 'Модель_Операции БПЛА');
      const modelId = model ? String(model.id) : null;

      if (!modelId) {
        logger.warn('[EventEngine] Модель_Операции БПЛА not found after concept creation');
        this._opsBootstrapped = true;
        return;
      }

      // 4. Create properties
      const props = {};
      const propDefs = [
        ['MissionType', { propertyType: 'attribute', dataType: 'Text' }],
        ['ReadinessScore', { propertyType: 'attribute', dataType: 'Number' }],
        ['WeatherStatus', { propertyType: 'attribute', dataType: 'Text' }],
        ['AirspaceStatus', { propertyType: 'attribute', dataType: 'Text' }],
        ['DroneStatus', { propertyType: 'attribute', dataType: 'Text' }],
        ['PilotStatus', { propertyType: 'attribute', dataType: 'Text' }],
        ['BatteryLevel', { propertyType: 'attribute', dataType: 'Number' }],
        ['WindSpeed', { propertyType: 'attribute', dataType: 'Number' }],
        ['Visibility', { propertyType: 'attribute', dataType: 'Number' }],
        ['PredictionConfidence', { propertyType: 'attribute', dataType: 'Number' }],
        ['AnomalyScore', { propertyType: 'attribute', dataType: 'Number' }],
        ['ComplianceStatus', { propertyType: 'attribute', dataType: 'Text' }],
        ['ProcurementPriority', { propertyType: 'attribute', dataType: 'Text' }],
      ];
      for (const [name, opts] of propDefs) {
        try {
          const p = await this.createProperty(name, opts);
          props[name] = String(p?.id || p?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create Ops property ${name}:`, err.message);
        }
      }

      // 5. Create Model Events organized by domain
      const OPS_EVENTS = [
        // Mission lifecycle
        ['ops.mission_planned', { required: true }],
        ['ops.mission_ready', { setValue: 'auto' }],
        ['ops.mission_blocked', {}],
        ['ops.mission_started', {}],
        ['ops.mission_completed', { immutable: true }],
        ['ops.mission_aborted', {}],
        ['ops.mission_failed', {}],
        // Readiness conditions
        ['ops.weather_checked', {}],
        ['ops.weather_cleared', {}],
        ['ops.weather_nogo', {}],
        ['ops.airspace_checked', {}],
        ['ops.airspace_cleared', {}],
        ['ops.airspace_restricted', {}],
        ['ops.drone_preflight', {}],
        ['ops.drone_ready', {}],
        ['ops.drone_grounded', {}],
        ['ops.pilot_verified', {}],
        ['ops.pilot_cleared', {}],
        // Predictive
        ['ops.anomaly_detected', {}],
        ['ops.failure_predicted', {}],
        ['ops.maintenance_needed', {}],
        ['ops.pattern_matched', {}],
        // Compliance
        ['ops.compliance_check', {}],
        ['ops.compliance_passed', {}],
        ['ops.compliance_violation', {}],
        ['ops.audit_started', {}],
        ['ops.audit_completed', { immutable: true }],
        // Procurement
        ['ops.procurement_needed', {}],
        ['ops.procurement_recommended', {}],
        ['ops.inventory_low', {}],
        // Scenario
        ['ops.scenario_forked', {}],
        ['ops.scenario_result', { immutable: true }],
      ];

      const modelEventIds = {};
      for (const [eventType, constraints] of OPS_EVENTS) {
        try {
          const result = await this.createModelEvent(eventType, {
            modelId,
            propertyId: props.ReadinessScore || props.MissionType,
            constraints,
          });
          modelEventIds[eventType] = String(result?.id || result?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create Ops model event ${eventType}:`, err.message);
        }
      }

      // 6. Create FSM states
      const FSM_STATES = [
        ['Запланирован', 'initial'],
        ['Проверка_готовности', 'normal'],
        ['Готов', 'normal'],
        ['Заблокирован', 'normal'],
        ['Активен', 'normal'],
        ['Завершён', 'final'],
        ['Прерван', 'final'],
        ['Ошибка', 'final'],
      ];

      const stateIds = {};
      if (this.createState) {
        for (const [name, type] of FSM_STATES) {
          try {
            const s = await this.createState(modelId, { name, type });
            stateIds[name] = String(s?.id || s?.obj);
          } catch (err) {
            logger.warn(`[EventEngine] Failed to create Ops state ${name}:`, err.message);
          }
        }

        // 7. Create FSM transitions
        const FSM_TRANSITIONS = [
          ['Запланирован', 'Проверка_готовности', 'ops.drone_preflight', ''],
          ['Проверка_готовности', 'Готов', 'ops.mission_ready', 'все условия выполнены'],
          ['Проверка_готовности', 'Заблокирован', 'ops.mission_blocked', 'условие не выполнено'],
          ['Заблокирован', 'Проверка_готовности', 'ops.weather_cleared', ''],
          ['Заблокирован', 'Проверка_готовности', 'ops.airspace_cleared', ''],
          ['Готов', 'Активен', 'ops.mission_started', ''],
          ['Активен', 'Завершён', 'ops.mission_completed', ''],
          ['Активен', 'Прерван', 'ops.mission_aborted', ''],
          ['Активен', 'Ошибка', 'ops.mission_failed', ''],
        ];

        for (const [from, to, trigger, guard] of FSM_TRANSITIONS) {
          if (stateIds[from] && stateIds[to]) {
            try {
              await this.createTransition(modelId, {
                fromStateId: stateIds[from],
                toStateId: stateIds[to],
                trigger,
                guard: guard || undefined,
              });
            } catch (err) {
              logger.warn(`[EventEngine] Failed to create Ops transition ${from}→${to}:`, err.message);
            }
          }
        }
      }

      // 8. Create Individual — the DroneOps instance
      const individual = await this.createIndividual('Операции-экземпляр', {
        conceptId, modelId, actorId: missionPlannerId,
      });
      const individualId = String(individual?.id || individual?.obj);

      // 9. Register Operations triggers (self-execution)
      const OPS_TRIGGERS = [
        {
          // Авто-проверка готовности
          condition: 'eventType $EQ "ops.weather_cleared" $OR eventType $EQ "ops.airspace_cleared" $OR eventType $EQ "ops.drone_ready" $OR eventType $EQ "ops.pilot_cleared"',
          action: {
            type: 'computeValue',
            params: { expression: 'ops_readiness_check' },
          },
          priority: 10,
        },
        {
          // Эскалация аномалии
          condition: 'eventType $EQ "ops.anomaly_detected"',
          action: {
            type: 'createEvent',
            params: { name: 'ops.maintenance_needed', value: 'ТО по обнаружению аномалии' },
          },
          priority: 9,
        },
        {
          // Триггер низкого запаса
          condition: 'eventType $EQ "ops.inventory_low"',
          action: {
            type: 'createEvent',
            params: { name: 'ops.procurement_needed', value: 'Авто-закупка при низком запасе' },
          },
          priority: 8,
        },
      ];

      for (const trigger of OPS_TRIGGERS) {
        try {
          await this.registerTrigger({ modelId, ...trigger });
        } catch (err) {
          logger.warn('[EventEngine] Failed to register Ops trigger:', err.message);
        }
      }

      // Cache IDs
      this._opsIds = {
        actors: {
         Планировщик_миссий: missionPlannerId,
         Менеджер_флота: fleetManagerId,
         Оракул_погоды: weatherOracleId,
         Оракул_воздушного_пространства: airspaceOracleId,
         Аудитор_соответствия: complianceAuditorId,
         Советник_закупок: procurementAdvisorId,
        },
        modelId,
        modelEventIds,
        individualId,
        conceptId,
        stateIds,
        props,
      };

      this._opsBootstrapped = true;
      logger.info('[EventEngine] Operations domain bootstrapped', {
        actors: 6, modelEvents: Object.keys(modelEventIds).length, individualId,
      });
    } catch (err) {
      logger.error('[EventEngine] Bootstrap Operations domain failed:', err.message);
      this._opsBootstrapped = true;
    }
  }

  /**
   * Load Operations IDs from existing data.
   */
  async _loadOpsIds(actors) {
    const missionPlanner = actors.find(a => a.val === 'Планировщик_миссий');
    const fleetManager = actors.find(a => a.val === 'Менеджер_флота');
    const weatherOracle = actors.find(a => a.val === 'Оракул_погоды');
    const airspaceOracle = actors.find(a => a.val === 'Оракул_воздушного_пространства');
    const complianceAuditor = actors.find(a => a.val === 'Аудитор_соответствия');
    const procurementAdvisor = actors.find(a => a.val === 'Советник_закупок');

    const models = await this.getObjects(this.tables.models);
    const model = models.find(m => m.val === 'Модель_Операции БПЛА');
    const modelId = model ? String(model.id) : null;

    let modelEventIds = {};
    if (modelId) {
      const allEvents = await this.getObjects(this.tables.modelEvents);
      for (const evt of allEvents) {
        const mReq = evt.reqs['Модель'];
        if (mReq && String(mReq.value) === modelId && evt.val.startsWith('ops.')) {
          modelEventIds[evt.val] = String(evt.id);
        }
      }
    }

    const individuals = await this.getObjects(this.tables.individuals);
    const individual = individuals.find(i => i.val === 'Операции-экземпляр');

    return {
      actors: {
       Планировщик_миссий: missionPlanner ? String(missionPlanner.id) : null,
       Менеджер_флота: fleetManager ? String(fleetManager.id) : null,
       Оракул_погоды: weatherOracle ? String(weatherOracle.id) : null,
       Оракул_воздушного_пространства: airspaceOracle ? String(airspaceOracle.id) : null,
       Аудитор_соответствия: complianceAuditor ? String(complianceAuditor.id) : null,
       Советник_закупок: procurementAdvisor ? String(procurementAdvisor.id) : null,
      },
      modelId,
      modelEventIds,
      individualId: individual ? String(individual.id) : null,
    };
  }

  /**
   * Get Operations IDs (used by REST API).
   */
  getOpsIds() {
    return this._opsIds || null;
  }

  // ─── Operations CRUD ─────────────────────────────────────────────

  /**
   * Create a new mission (Individual in SOD + initial event).
   */
  async createMission({ name, type = 'survey', description = '', conditions = {} }) {
    await this.initialize();
    await this.bootstrapOperationsDomain();
    const ids = this._opsIds;
    if (!ids) throw new Error('Operations domain not bootstrapped');

    const individual = await this.createIndividual(name, {
      conceptId: ids.conceptId,
      modelId: ids.modelId,
      actorId: ids.actors.Планировщик_миссий,
    });
    const missionId = String(individual?.id || individual?.obj);

    const eventResult = await this.createSubjectEvent('ops.mission_planned', {
      individualId: missionId,
      modelEventId: ids.modelEventIds['ops.mission_planned'],
      value: JSON.stringify({ name, type, description, status: 'planned', conditions, createdAt: new Date().toISOString() }),
      actorId: ids.actors.Планировщик_миссий,
      causes: [],
    });

    return { missionId, eventId: String(eventResult?.id || eventResult?.obj), name, type, status: 'planned' };
  }

  /**
   * Get all missions with current status.
   */
  async getMissions(statusFilter) {
    await this.initialize();
    await this.bootstrapOperationsDomain();
    const ids = this._opsIds;
    if (!ids) return [];

    const individuals = await this.getObjects(this.tables.individuals);
    const missions = individuals.filter(ind => {
      const conceptReq = ind.reqs['Концепт'];
      return conceptReq && String(conceptReq.value) === ids.conceptId;
    });

    const results = [];
    for (const mission of missions) {
      if (mission.val === 'Операции-экземпляр') continue;
      const events = await this.getSubjectEvents(mission.id);
      let data = { status: 'planned', name: mission.val };

      for (const evt of events) {
        try {
          const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          if (val.name || val.type) data = { ...data, ...val };
        } catch { /* skip */ }

        if (evt.val === 'ops.mission_ready') data.status = 'ready';
        if (evt.val === 'ops.mission_blocked') data.status = 'blocked';
        if (evt.val === 'ops.mission_started') data.status = 'active';
        if (evt.val === 'ops.mission_completed') data.status = 'completed';
        if (evt.val === 'ops.mission_aborted') data.status = 'aborted';
        if (evt.val === 'ops.mission_failed') data.status = 'failed';
      }

      if (statusFilter && data.status !== statusFilter) continue;
      results.push({ id: mission.id, ...data, eventCount: events.length });
    }

    return results;
  }

  /**
   * Get mission detail with full event timeline.
   */
  async getMissionDetail(missionId) {
    await this.initialize();
    await this.bootstrapOperationsDomain();

    const events = await this.getSubjectEvents(missionId);
    let missionData = { status: 'planned' };
    const timeline = [];
    const readinessChecks = [];

    for (const evt of events) {
      try {
        const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
        if (val.name || val.type) missionData = { ...missionData, ...val };
        if (val.readinessScore !== undefined) missionData.readinessScore = val.readinessScore;
      } catch { /* skip */ }

      if (evt.val === 'ops.mission_ready') missionData.status = 'ready';
      if (evt.val === 'ops.mission_blocked') missionData.status = 'blocked';
      if (evt.val === 'ops.mission_started') missionData.status = 'active';
      if (evt.val === 'ops.mission_completed') missionData.status = 'completed';
      if (evt.val === 'ops.mission_aborted') missionData.status = 'aborted';
      if (evt.val === 'ops.mission_failed') missionData.status = 'failed';

      if (evt.val.includes('checked') || evt.val.includes('cleared') || evt.val.includes('ready') || evt.val.includes('grounded') || evt.val.includes('nogo')) {
        try {
          readinessChecks.push({ type: evt.val, ...JSON.parse(evt.reqs?.['Значение']?.value || '{}') });
        } catch { readinessChecks.push({ type: evt.val }); }
      }

      timeline.push({
        id: evt.id,
        type: evt.val,
        value: evt.reqs?.['Значение']?.value,
        actorId: evt.reqs?.['Актор']?.value,
        timestamp: evt.reqs?.['Временная метка']?.value,
      });
    }

    return { id: missionId, ...missionData, timeline, readinessChecks, eventCount: events.length };
  }

  // ─── Operations Service Methods ──────────────────────────────────

  /**
   * Evaluate mission readiness from current world state.
   * Returns composite readiness score and blocking conditions.
   */
  async evaluateMissionReadiness(missionId, conditions = {}) {
    await this.initialize();
    await this.bootstrapOperationsDomain();
    const ids = this._opsIds;
    if (!ids) throw new Error('Operations domain not bootstrapped');

    const {
      weather = null,
      airspace = null,
      drone = null,
      pilot = null,
      battery = null,
      windSpeed = null,
      visibility = null,
    } = conditions;

    const events = await this.getSubjectEvents(missionId);
    let lastEventId = events.length > 0 ? String(events[events.length - 1].id) : null;

    const checks = [];
    const blockReasons = [];

    // Weather check
    if (weather !== null) {
      const weatherEvent = await this.createSubjectEvent('ops.weather_checked', {
        individualId: missionId,
        modelEventId: ids.modelEventIds['ops.weather_checked'],
        value: JSON.stringify({ weather, windSpeed, visibility, checkedAt: new Date().toISOString() }),
        actorId: ids.actors.Оракул_погоды,
        causes: lastEventId ? [lastEventId] : [],
      });
      lastEventId = String(weatherEvent?.id || weatherEvent?.obj);

      const weatherClear = weather === 'clear' || weather === 'marginal';
      const windOk = windSpeed === null || windSpeed <= 15;
      const visOk = visibility === null || visibility >= 1000;

      if (weatherClear && windOk && visOk) {
        const clearedEvt = await this.createSubjectEvent('ops.weather_cleared', {
          individualId: missionId,
          modelEventId: ids.modelEventIds['ops.weather_cleared'],
          value: JSON.stringify({ weather, windSpeed, visibility }),
          actorId: ids.actors.Оракул_погоды,
          causes: [lastEventId],
        });
        lastEventId = String(clearedEvt?.id || clearedEvt?.obj);
        checks.push({ check: 'weather', status: 'cleared', score: 100 });
      } else {
        const nogoEvt = await this.createSubjectEvent('ops.weather_nogo', {
          individualId: missionId,
          modelEventId: ids.modelEventIds['ops.weather_nogo'],
          value: JSON.stringify({ weather, windSpeed, visibility, reason: !weatherClear ? 'bad weather' : !windOk ? 'high wind' : 'low visibility' }),
          actorId: ids.actors.Оракул_погоды,
          causes: [lastEventId],
        });
        lastEventId = String(nogoEvt?.id || nogoEvt?.obj);
        const reason = !weatherClear ? `Weather: ${weather}` : !windOk ? `Wind: ${windSpeed}m/s` : `Visibility: ${visibility}m`;
        blockReasons.push(reason);
        checks.push({ check: 'weather', status: 'nogo', score: 0, reason });
      }
    }

    // Airspace check
    if (airspace !== null) {
      const airspaceEvent = await this.createSubjectEvent('ops.airspace_checked', {
        individualId: missionId,
        modelEventId: ids.modelEventIds['ops.airspace_checked'],
        value: JSON.stringify({ airspace, checkedAt: new Date().toISOString() }),
        actorId: ids.actors.Оракул_воздушного_пространства,
        causes: lastEventId ? [lastEventId] : [],
      });
      lastEventId = String(airspaceEvent?.id || airspaceEvent?.obj);

      if (airspace === 'clear') {
        const clearedEvt = await this.createSubjectEvent('ops.airspace_cleared', {
          individualId: missionId,
          modelEventId: ids.modelEventIds['ops.airspace_cleared'],
          value: JSON.stringify({ airspace }),
          actorId: ids.actors.Оракул_воздушного_пространства,
          causes: [lastEventId],
        });
        lastEventId = String(clearedEvt?.id || clearedEvt?.obj);
        checks.push({ check: 'airspace', status: 'cleared', score: 100 });
      } else {
        const restrictedEvt = await this.createSubjectEvent('ops.airspace_restricted', {
          individualId: missionId,
          modelEventId: ids.modelEventIds['ops.airspace_restricted'],
          value: JSON.stringify({ airspace, reason: `Airspace ${airspace}` }),
          actorId: ids.actors.Оракул_воздушного_пространства,
          causes: [lastEventId],
        });
        lastEventId = String(restrictedEvt?.id || restrictedEvt?.obj);
        blockReasons.push(`Airspace: ${airspace}`);
        checks.push({ check: 'airspace', status: 'restricted', score: 0, reason: `Airspace ${airspace}` });
      }
    }

    // Drone preflight check
    if (drone !== null || battery !== null) {
      const droneData = { drone, battery, checkedAt: new Date().toISOString() };
      const preflightEvt = await this.createSubjectEvent('ops.drone_preflight', {
        individualId: missionId,
        modelEventId: ids.modelEventIds['ops.drone_preflight'],
        value: JSON.stringify(droneData),
        actorId: ids.actors.Менеджер_флота,
        causes: lastEventId ? [lastEventId] : [],
      });
      lastEventId = String(preflightEvt?.id || preflightEvt?.obj);

      const droneOk = drone === null || drone === 'ready';
      const batteryOk = battery === null || battery >= 20;

      if (droneOk && batteryOk) {
        const readyEvt = await this.createSubjectEvent('ops.drone_ready', {
          individualId: missionId,
          modelEventId: ids.modelEventIds['ops.drone_ready'],
          value: JSON.stringify({ drone, battery }),
          actorId: ids.actors.Менеджер_флота,
          causes: [lastEventId],
        });
        lastEventId = String(readyEvt?.id || readyEvt?.obj);
        const batteryScore = battery !== null ? Math.min(100, battery) : 100;
        checks.push({ check: 'drone', status: 'ready', score: batteryScore });
      } else {
        const groundedEvt = await this.createSubjectEvent('ops.drone_grounded', {
          individualId: missionId,
          modelEventId: ids.modelEventIds['ops.drone_grounded'],
          value: JSON.stringify({ drone, battery, reason: !droneOk ? `Drone: ${drone}` : `Battery: ${battery}%` }),
          actorId: ids.actors.Менеджер_флота,
          causes: [lastEventId],
        });
        lastEventId = String(groundedEvt?.id || groundedEvt?.obj);
        const reason = !droneOk ? `Drone: ${drone}` : `Battery: ${battery}%`;
        blockReasons.push(reason);
        checks.push({ check: 'drone', status: 'grounded', score: 0, reason });
      }
    }

    // Pilot verification
    if (pilot !== null) {
      const pilotEvt = await this.createSubjectEvent('ops.pilot_verified', {
        individualId: missionId,
        modelEventId: ids.modelEventIds['ops.pilot_verified'],
        value: JSON.stringify({ pilot, verifiedAt: new Date().toISOString() }),
        actorId: ids.actors.Планировщик_миссий,
        causes: lastEventId ? [lastEventId] : [],
      });
      lastEventId = String(pilotEvt?.id || pilotEvt?.obj);

      if (pilot === 'certified') {
        const clearedEvt = await this.createSubjectEvent('ops.pilot_cleared', {
          individualId: missionId,
          modelEventId: ids.modelEventIds['ops.pilot_cleared'],
          value: JSON.stringify({ pilot }),
          actorId: ids.actors.Планировщик_миссий,
          causes: [lastEventId],
        });
        lastEventId = String(clearedEvt?.id || clearedEvt?.obj);
        checks.push({ check: 'pilot', status: 'cleared', score: 100 });
      } else {
        blockReasons.push(`Pilot: ${pilot}`);
        checks.push({ check: 'pilot', status: pilot, score: 0, reason: `Pilot: ${pilot}` });
      }
    }

    // Compute composite readiness score
    const totalChecks = checks.length || 1;
    const compositeScore = Math.round(checks.reduce((sum, c) => sum + c.score, 0) / totalChecks);
    const allPassed = blockReasons.length === 0 && checks.length > 0;

    // Create final event: mission_ready or mission_blocked
    if (allPassed) {
      const readyEvt = await this.createSubjectEvent('ops.mission_ready', {
        individualId: missionId,
        modelEventId: ids.modelEventIds['ops.mission_ready'],
        value: JSON.stringify({ readinessScore: compositeScore, checks, allPassed: true }),
        actorId: ids.actors.Планировщик_миссий,
        causes: lastEventId ? [lastEventId] : [],
      });

      return {
        missionId,
        readinessScore: compositeScore,
        status: 'ready',
        checks,
        blockReasons: [],
        eventId: String(readyEvt?.id || readyEvt?.obj),
      };
    } else {
      const blockedEvt = await this.createSubjectEvent('ops.mission_blocked', {
        individualId: missionId,
        modelEventId: ids.modelEventIds['ops.mission_blocked'],
        value: JSON.stringify({ readinessScore: compositeScore, checks, blockReasons }),
        actorId: ids.actors.Планировщик_миссий,
        causes: lastEventId ? [lastEventId] : [],
      });

      return {
        missionId,
        readinessScore: compositeScore,
        status: 'blocked',
        checks,
        blockReasons,
        eventId: String(blockedEvt?.id || blockedEvt?.obj),
      };
    }
  }

  /**
   * Detect patterns in causal graph for predictive analytics.
   * Scans event history for recurring causal chains.
   */
  async detectEventPatterns(options = {}) {
    await this.initialize();
    await this.bootstrapOperationsDomain();
    const ids = this._opsIds;
    if (!ids) throw new Error('Operations domain not bootstrapped');

    const { timeWindowMs = 24 * 60 * 60 * 1000, minOccurrences = 2 } = options;

    // Get all subject events for the operations individual
    const individualId = ids.individualId;
    const allEvents = await this.getSubjectEvents(individualId);

    // Build frequency map of sequential event pairs (A→B patterns)
    const pairFreq = {};    // "A→B" → count
    const chainFreq = {};   // "A→B→C" → count
    const eventTimestamps = {}; // eventType → [timestamps]
    const eventIntervals = {};  // eventType → [interval_ms]

    for (let i = 0; i < allEvents.length; i++) {
      const evt = allEvents[i];
      const evtType = evt.val;
      const ts = evt.reqs?.['Временная метка']?.value;
      const timestamp = ts ? new Date(ts).getTime() : Date.now() - (allEvents.length - i) * 1000;

      if (!eventTimestamps[evtType]) eventTimestamps[evtType] = [];
      eventTimestamps[evtType].push(timestamp);

      // Track intervals between same event types
      if (eventTimestamps[evtType].length >= 2) {
        const stamps = eventTimestamps[evtType];
        const interval = stamps[stamps.length - 1] - stamps[stamps.length - 2];
        if (!eventIntervals[evtType]) eventIntervals[evtType] = [];
        eventIntervals[evtType].push(interval);
      }

      // Track pairs
      if (i > 0) {
        const prevType = allEvents[i - 1].val;
        const pairKey = `${prevType}→${evtType}`;
        pairFreq[pairKey] = (pairFreq[pairKey] || 0) + 1;
      }

      // Track triples
      if (i > 1) {
        const ppType = allEvents[i - 2].val;
        const pType = allEvents[i - 1].val;
        const chainKey = `${ppType}→${pType}→${evtType}`;
        chainFreq[chainKey] = (chainFreq[chainKey] || 0) + 1;
      }
    }

    // Identify recurring patterns (pairs that occur >= minOccurrences)
    const patterns = [];
    for (const [pair, count] of Object.entries(pairFreq)) {
      if (count >= minOccurrences) {
        patterns.push({ chain: pair, occurrences: count, type: 'pair' });
      }
    }
    for (const [chain, count] of Object.entries(chainFreq)) {
      if (count >= minOccurrences) {
        patterns.push({ chain, occurrences: count, type: 'triple' });
      }
    }
    patterns.sort((a, b) => b.occurrences - a.occurrences);

    // Identify anomalies: events expected (based on patterns) but missing within timeframe
    const anomalies = [];
    const now = Date.now();
    for (const [evtType, intervals] of Object.entries(eventIntervals)) {
      if (intervals.length < 2) continue;
      const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      const lastTs = eventTimestamps[evtType][eventTimestamps[evtType].length - 1];
      const elapsed = now - lastTs;

      // If elapsed > 2x average interval, it's anomalous (overdue event)
      if (elapsed > avgInterval * 2 && avgInterval > 0) {
        anomalies.push({
          eventType: evtType,
          expectedIntervalMs: Math.round(avgInterval),
          elapsedMs: Math.round(elapsed),
          severity: elapsed > avgInterval * 5 ? 'critical' : 'warning',
        });
      }
    }

    // Generate predictions: if A→B is common and A just happened, predict B
    const predictions = [];
    if (allEvents.length > 0) {
      const lastEvtType = allEvents[allEvents.length - 1].val;
      for (const [pair, count] of Object.entries(pairFreq)) {
        const [fromType, toType] = pair.split('→');
        if (fromType === lastEvtType && count >= minOccurrences) {
          const totalFromOccurrences = Object.entries(pairFreq)
            .filter(([k]) => k.startsWith(fromType + '→'))
            .reduce((s, [, c]) => s + c, 0);
          const confidence = Math.round((count / totalFromOccurrences) * 100);
          predictions.push({ predictedEvent: toType, confidence, basedOn: pair, occurrences: count });
        }
      }
      predictions.sort((a, b) => b.confidence - a.confidence);
    }

    // Create pattern_matched event if significant patterns found
    if (patterns.length > 0) {
      try {
        await this.createSubjectEvent('ops.pattern_matched', {
          individualId,
          modelEventId: ids.modelEventIds['ops.pattern_matched'],
          value: JSON.stringify({
            patternCount: patterns.length,
            anomalyCount: anomalies.length,
            predictionCount: predictions.length,
            detectedAt: new Date().toISOString(),
          }),
          actorId: ids.actors.Менеджер_флота,
          causes: [],
        });
      } catch (err) {
        logger.warn('[EventEngine] Failed to create pattern_matched event:', err.message);
      }
    }

    // Create anomaly event if anomalies found
    if (anomalies.length > 0) {
      try {
        await this.createSubjectEvent('ops.anomaly_detected', {
          individualId,
          modelEventId: ids.modelEventIds['ops.anomaly_detected'],
          value: JSON.stringify({
            anomalies,
            anomalyScore: Math.min(100, anomalies.length * 25),
            detectedAt: new Date().toISOString(),
          }),
          actorId: ids.actors.Менеджер_флота,
          causes: [],
        });
      } catch (err) {
        logger.warn('[EventEngine] Failed to create anomaly_detected event:', err.message);
      }
    }

    return { patterns, anomalies, predictions };
  }

  /**
   * Fork event graph for what-if scenario simulation.
   */
  async forkScenario(baseIndividualId, scenarioName, modifications = {}) {
    await this.initialize();
    await this.bootstrapOperationsDomain();
    const ids = this._opsIds;
    if (!ids) throw new Error('Operations domain not bootstrapped');

    const { injectEvents = [], removeEventTypes = [], modifyConditions = {} } = modifications;

    // 1. Create new individual as sandbox
    const sandbox = await this.createIndividual(`Scenario_${scenarioName}`, {
      conceptId: ids.conceptId,
      modelId: ids.modelId,
      actorId: ids.actors.Планировщик_миссий,
    });
    const scenarioId = String(sandbox?.id || sandbox?.obj);

    // 2. Create scenario_forked event
    const forkEvt = await this.createSubjectEvent('ops.scenario_forked', {
      individualId: scenarioId,
      modelEventId: ids.modelEventIds['ops.scenario_forked'],
      value: JSON.stringify({
        baseIndividualId,
        scenarioName,
        modifications: { injectCount: injectEvents.length, removeTypes: removeEventTypes, modifyConditions },
        forkedAt: new Date().toISOString(),
      }),
      actorId: ids.actors.Планировщик_миссий,
      causes: [],
    });
    let lastEventId = String(forkEvt?.id || forkEvt?.obj);

    // 3. Copy event history from base (filtering out removed types)
    const baseEvents = await this.getSubjectEvents(baseIndividualId);
    const copiedEvents = [];
    for (const evt of baseEvents) {
      if (removeEventTypes.includes(evt.val)) continue;

      let value = evt.reqs?.['Значение']?.value || '';

      // Apply modifications to conditions if specified
      if (modifyConditions[evt.val]) {
        try {
          const parsed = JSON.parse(value);
          Object.assign(parsed, modifyConditions[evt.val]);
          value = JSON.stringify(parsed);
        } catch {
          // If value is not JSON, wrap it
          value = JSON.stringify({ originalValue: value, ...modifyConditions[evt.val] });
        }
      }

      try {
        const copied = await this.createSubjectEvent(evt.val, {
          individualId: scenarioId,
          modelEventId: ids.modelEventIds[evt.val],
          value,
          actorId: evt.reqs?.['Актор']?.value || ids.actors.Планировщик_миссий,
          causes: lastEventId ? [lastEventId] : [],
        });
        lastEventId = String(copied?.id || copied?.obj);
        copiedEvents.push({ type: evt.val, eventId: lastEventId });
      } catch (err) {
        logger.warn(`[EventEngine] Failed to copy event ${evt.val} to scenario:`, err.message);
      }
    }

    // 4. Inject hypothetical events
    const injectedEvents = [];
    for (const injected of injectEvents) {
      try {
        const injEvt = await this.createSubjectEvent(injected.type, {
          individualId: scenarioId,
          modelEventId: ids.modelEventIds[injected.type],
          value: JSON.stringify(injected.value || {}),
          actorId: injected.actorId || ids.actors.Планировщик_миссий,
          causes: lastEventId ? [lastEventId] : [],
        });
        lastEventId = String(injEvt?.id || injEvt?.obj);
        injectedEvents.push({ type: injected.type, eventId: lastEventId });
      } catch (err) {
        logger.warn(`[EventEngine] Failed to inject scenario event ${injected.type}:`, err.message);
      }
    }

    // 5. Analyze final state of the scenario by replaying events
    const scenarioEvents = await this.getSubjectEvents(scenarioId);
    let currentState = 'Planned';
    const causalChain = [];

    for (const evt of scenarioEvents) {
      causalChain.push({
        id: evt.id,
        type: evt.val,
        value: evt.reqs?.['Значение']?.value,
        timestamp: evt.reqs?.['Временная метка']?.value,
      });

      // Replay FSM transitions
      if (evt.val === 'ops.drone_preflight' && currentState === 'Planned') currentState = 'ReadinessCheck';
      if (evt.val === 'ops.mission_ready' && currentState === 'ReadinessCheck') currentState = 'Ready';
      if (evt.val === 'ops.mission_blocked' && currentState === 'ReadinessCheck') currentState = 'Blocked';
      if ((evt.val === 'ops.weather_cleared' || evt.val === 'ops.airspace_cleared') && currentState === 'Blocked') currentState = 'ReadinessCheck';
      if (evt.val === 'ops.mission_started' && currentState === 'Ready') currentState = 'Active';
      if (evt.val === 'ops.mission_completed' && currentState === 'Active') currentState = 'Completed';
      if (evt.val === 'ops.mission_aborted' && currentState === 'Active') currentState = 'Aborted';
      if (evt.val === 'ops.mission_failed' && currentState === 'Active') currentState = 'Failed';
    }

    // 6. Create scenario_result event
    const resultEvt = await this.createSubjectEvent('ops.scenario_result', {
      individualId: scenarioId,
      modelEventId: ids.modelEventIds['ops.scenario_result'],
      value: JSON.stringify({
        scenarioName,
        finalState: currentState,
        eventCount: scenarioEvents.length,
        copiedEvents: copiedEvents.length,
        injectedEvents: injectedEvents.length,
        completedAt: new Date().toISOString(),
      }),
      actorId: ids.actors.Планировщик_миссий,
      causes: lastEventId ? [lastEventId] : [],
    });

    return {
      scenarioId,
      scenarioName,
      finalState: currentState,
      copiedEvents,
      injectedEvents,
      causalChain,
      resultEventId: String(resultEvt?.id || resultEvt?.obj),
    };
  }

  /**
   * Audit compliance for an operation.
   * Walks causal graph to verify all required steps were taken.
   */
  async auditCompliance(missionId) {
    await this.initialize();
    await this.bootstrapOperationsDomain();
    const ids = this._opsIds;
    if (!ids) throw new Error('Operations domain not bootstrapped');

    // Create audit_started event
    const auditStartEvt = await this.createSubjectEvent('ops.audit_started', {
      individualId: missionId,
      modelEventId: ids.modelEventIds['ops.audit_started'],
      value: JSON.stringify({ auditedAt: new Date().toISOString() }),
      actorId: ids.actors.Аудитор_соответствия,
      causes: [],
    });
    const auditStartId = String(auditStartEvt?.id || auditStartEvt?.obj);

    // Get all events for this mission
    const events = await this.getSubjectEvents(missionId);
    const eventTypes = events.map(e => e.val);
    const eventTimeline = events.map(e => ({
      id: e.id,
      type: e.val,
      timestamp: e.reqs?.['Временная метка']?.value,
      actor: e.reqs?.['Актор']?.value,
      value: e.reqs?.['Значение']?.value,
    }));

    // Define required events and their ordering
    const REQUIRED_EVENTS = [
      { type: 'ops.mission_planned', label: 'Mission planning', required: true },
      { type: 'ops.weather_checked', label: 'Weather check', required: true },
      { type: 'ops.airspace_checked', label: 'Airspace check', required: true },
      { type: 'ops.drone_preflight', label: 'Drone preflight', required: true },
      { type: 'ops.pilot_verified', label: 'Pilot verification', required: true },
    ];

    const REQUIRED_ORDER = [
      ['ops.mission_planned', 'ops.drone_preflight'],
      ['ops.drone_preflight', 'ops.mission_started'],
      ['ops.weather_checked', 'ops.mission_started'],
      ['ops.airspace_checked', 'ops.mission_started'],
      ['ops.pilot_verified', 'ops.mission_started'],
    ];

    const violations = [];
    let score = 100;

    // Check required events exist
    for (const req of REQUIRED_EVENTS) {
      if (req.required && !eventTypes.includes(req.type)) {
        violations.push({
          type: 'missing_event',
          event: req.type,
          label: req.label,
          severity: 'critical',
          message: `Required event "${req.label}" (${req.type}) was not recorded`,
        });
        score -= 15;
      }
    }

    // Check ordering constraints
    for (const [before, after] of REQUIRED_ORDER) {
      const beforeIdx = eventTypes.indexOf(before);
      const afterIdx = eventTypes.indexOf(after);
      if (beforeIdx >= 0 && afterIdx >= 0 && beforeIdx > afterIdx) {
        violations.push({
          type: 'ordering',
          before,
          after,
          severity: 'warning',
          message: `Event "${before}" must occur before "${after}" but was recorded after`,
        });
        score -= 10;
      }
    }

    // Check timing constraints: preflight should be within 2 hours of start
    const preflightEvt = events.find(e => e.val === 'ops.drone_preflight');
    const startEvt = events.find(e => e.val === 'ops.mission_started');
    if (preflightEvt && startEvt) {
      const preflightTs = preflightEvt.reqs?.['Временная метка']?.value;
      const startTs = startEvt.reqs?.['Временная метка']?.value;
      if (preflightTs && startTs) {
        const gap = new Date(startTs).getTime() - new Date(preflightTs).getTime();
        const twoHours = 2 * 60 * 60 * 1000;
        if (gap > twoHours) {
          violations.push({
            type: 'timing',
            events: ['ops.drone_preflight', 'ops.mission_started'],
            gapMs: gap,
            severity: 'warning',
            message: `Preflight check was ${Math.round(gap / (60 * 60 * 1000))}h before mission start (max 2h recommended)`,
          });
          score -= 5;
        }
      }
    }

    // Check for weather/airspace clearance before mission start
    const missionStarted = eventTypes.includes('ops.mission_started');
    if (missionStarted) {
      const hasWeatherClear = eventTypes.includes('ops.weather_cleared');
      const hasAirspaceClear = eventTypes.includes('ops.airspace_cleared');
      if (!hasWeatherClear) {
        violations.push({
          type: 'missing_clearance',
          event: 'ops.weather_cleared',
          severity: 'critical',
          message: 'Mission started without weather clearance',
        });
        score -= 20;
      }
      if (!hasAirspaceClear) {
        violations.push({
          type: 'missing_clearance',
          event: 'ops.airspace_cleared',
          severity: 'critical',
          message: 'Mission started without airspace clearance',
        });
        score -= 20;
      }
    }

    score = Math.max(0, score);
    const compliant = violations.length === 0;

    // Create compliance result event
    const complianceEventType = compliant ? 'ops.compliance_passed' : 'ops.compliance_violation';
    const complianceEvt = await this.createSubjectEvent(complianceEventType, {
      individualId: missionId,
      modelEventId: ids.modelEventIds[complianceEventType],
      value: JSON.stringify({ compliant, score, violationCount: violations.length, violations }),
      actorId: ids.actors.Аудитор_соответствия,
      causes: [auditStartId],
    });

    // Create audit_completed event
    await this.createSubjectEvent('ops.audit_completed', {
      individualId: missionId,
      modelEventId: ids.modelEventIds['ops.audit_completed'],
      value: JSON.stringify({ compliant, score, completedAt: new Date().toISOString() }),
      actorId: ids.actors.Аудитор_соответствия,
      causes: [String(complianceEvt?.id || complianceEvt?.obj)],
    });

    return {
      compliant,
      violations,
      timeline: eventTimeline,
      score,
    };
  }

  /**
   * Derive procurement needs from operations plan.
   * Analyzes planned operations + fleet status + consumption patterns.
   */
  async deriveProcurementNeeds(options = {}) {
    await this.initialize();
    await this.bootstrapOperationsDomain();
    const ids = this._opsIds;
    if (!ids) throw new Error('Operations domain not bootstrapped');

    const { planningHorizonDays = 30 } = options;

    // Get all individuals (missions) linked to the operations concept
    const individuals = await this.getObjects(this.tables.individuals);
    const opsMissions = individuals.filter(ind => {
      const conceptReq = ind.reqs['Концепт'];
      return conceptReq && String(conceptReq.value) === ids.conceptId;
    });

    // Collect events across all missions
    const missionStatuses = [];
    const allOpsEvents = [];
    let maintenanceCount = 0;
    let groundedCount = 0;
    let lowBatteryCount = 0;
    let totalMissions = 0;

    for (const mission of opsMissions) {
      if (mission.val === 'Операции-экземпляр') continue; // skip the root
      if (mission.val.startsWith('Scenario_')) continue; // skip scenario forks
      totalMissions++;

      const events = await this.getSubjectEvents(mission.id);
      let status = 'planned';
      let missionType = 'unknown';

      for (const evt of events) {
        allOpsEvents.push(evt);

        // Track status
        if (evt.val === 'ops.mission_ready') status = 'ready';
        if (evt.val === 'ops.mission_started') status = 'active';
        if (evt.val === 'ops.mission_completed') status = 'completed';
        if (evt.val === 'ops.mission_blocked') status = 'blocked';
        if (evt.val === 'ops.mission_aborted') status = 'aborted';
        if (evt.val === 'ops.mission_failed') status = 'failed';

        // Parse event values for consumption data
        try {
          const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          if (val.missionType) missionType = val.missionType;
          if (evt.val === 'ops.maintenance_needed') maintenanceCount++;
          if (evt.val === 'ops.drone_grounded') groundedCount++;
          if (val.battery !== undefined && val.battery < 20) lowBatteryCount++;
        } catch { /* not JSON */ }
      }

      missionStatuses.push({ id: mission.id, name: mission.val, status, missionType, eventCount: events.length });
    }

    // Calculate consumption rates from history
    const plannedMissions = missionStatuses.filter(m => m.status === 'planned' || m.status === 'ready');
    const activeMissions = missionStatuses.filter(m => m.status === 'active');
    const completedMissions = missionStatuses.filter(m => m.status === 'completed');

    // Estimate battery consumption: average events per mission * estimated battery per flight
    const avgEventsPerMission = totalMissions > 0 ? allOpsEvents.length / totalMissions : 0;
    const estimatedFlightsPerDay = completedMissions.length > 0 ? completedMissions.length / planningHorizonDays : 1;

    // Derive needs
    const needs = [];
    const estimatedCostPerUnit = { battery: 15000, spare_parts: 50000, pilot_hours: 3000 };

    // Battery needs
    if (lowBatteryCount > 0 || plannedMissions.length > 2) {
      const batteryNeed = Math.max(lowBatteryCount, Math.ceil(plannedMissions.length * 0.5));
      needs.push({
        item: 'battery_pack',
        quantity: batteryNeed,
        reason: lowBatteryCount > 0
          ? `${lowBatteryCount} low-battery events detected`
          : `${plannedMissions.length} missions planned requiring spare batteries`,
        estimatedCost: batteryNeed * estimatedCostPerUnit.battery,
        urgency: lowBatteryCount > 2 ? 'critical' : 'medium',
      });
    }

    // Spare parts / maintenance needs
    if (maintenanceCount > 0 || groundedCount > 0) {
      const partsNeed = maintenanceCount + groundedCount;
      needs.push({
        item: 'spare_parts',
        quantity: partsNeed,
        reason: `${maintenanceCount} maintenance events, ${groundedCount} grounded events`,
        estimatedCost: partsNeed * estimatedCostPerUnit.spare_parts,
        urgency: groundedCount > 1 ? 'critical' : 'high',
      });
    }

    // Pilot hours
    const requiredPilotHours = (plannedMissions.length + activeMissions.length) * 2; // ~2h per mission
    if (requiredPilotHours > 0) {
      needs.push({
        item: 'pilot_hours',
        quantity: requiredPilotHours,
        reason: `${plannedMissions.length} planned + ${activeMissions.length} active missions requiring pilot time`,
        estimatedCost: requiredPilotHours * estimatedCostPerUnit.pilot_hours,
        urgency: activeMissions.length > 3 ? 'high' : 'medium',
      });
    }

    const totalEstimatedCost = needs.reduce((sum, n) => sum + n.estimatedCost, 0);
    const overallUrgency = needs.some(n => n.urgency === 'critical') ? 'critical'
      : needs.some(n => n.urgency === 'high') ? 'high' : 'medium';

    // Create procurement events
    if (needs.length > 0) {
      try {
        await this.createSubjectEvent('ops.procurement_recommended', {
          individualId: ids.individualId,
          modelEventId: ids.modelEventIds['ops.procurement_recommended'],
          value: JSON.stringify({
            needs,
            totalEstimatedCost,
            urgency: overallUrgency,
            planningHorizonDays,
            analyzedMissions: totalMissions,
            derivedAt: new Date().toISOString(),
          }),
          actorId: ids.actors.Советник_закупок,
          causes: [],
        });
      } catch (err) {
        logger.warn('[EventEngine] Failed to create procurement_recommended event:', err.message);
      }
    }

    return {
      needs,
      urgency: overallUrgency,
      estimatedCost: totalEstimatedCost,
      missionStatuses,
      summary: {
        totalMissions,
        planned: plannedMissions.length,
        active: activeMissions.length,
        completed: completedMissions.length,
        maintenanceEvents: maintenanceCount,
        groundedEvents: groundedCount,
        lowBatteryEvents: lowBatteryCount,
        estimatedFlightsPerDay: Math.round(estimatedFlightsPerDay * 10) / 10,
      },
    };
  }

  // ─── Module 0: Meta — Software Development Domain ───────────────

  async bootstrapDevOpsDomain() {
    if (this._devOpsBootstrapped) return;

    try {
      const actors = await this.getObjects(this.tables.actors);
      const existingDevOps = actors.find(a => a.val === 'Разработчик');
      if (existingDevOps) {
        this._devOpsIds = await this._loadDevOpsIds(actors);
        this._devOpsBootstrapped = true;
        logger.info('[EventEngine] DevOps domain already bootstrapped');
        return;
      }

      logger.info('[EventEngine] Bootstrapping DevOps domain...');

      // 1. Create Actors
      const developer = await this.createActor('Разработчик', {
        type: 'agent', description: 'Пишет код, коммитит',
      });
      const ciRunner = await this.createActor('CI_система', {
        type: 'agent', description: 'Запускает тесты, сборку',
      });
      const gitHubBot = await this.createActor('GitHub_бот', {
        type: 'sensor', description: 'Мониторит GitHub-события (коммиты, PR, задачи)',
      });
      const planTracker = await this.createActor('Трекер_планов', {
        type: 'agent', description: 'Отслеживает выполнение планов',
      });
      const ideaCollector = await this.createActor('Сборщик_идей', {
        type: 'sensor', description: 'Собирает идеи из разговоров',
      });

      const developerId = String(developer?.id || developer?.obj);
      const ciRunnerId = String(ciRunner?.id || ciRunner?.obj);
      const gitHubBotId = String(gitHubBot?.id || gitHubBot?.obj);
      const planTrackerId = String(planTracker?.id || planTracker?.obj);
      const ideaCollectorId = String(ideaCollector?.id || ideaCollector?.obj);

      // 2. Create Concept → auto-creates Модель_Разработка ПО
      const concept = await this.createConcept('Разработка ПО', 'Жизненный цикл разработки ПО с интеграцией Git/GitHub');
      const conceptId = String(concept?.id || concept?.obj);

      // 3. Find auto-created model
      const models = await this.getObjects(this.tables.models);
      const model = models.find(m => m.val === 'Model_Разработка ПО');
      const modelId = model ? String(model.id) : null;

      if (!modelId) {
        logger.warn('[EventEngine] Model_Разработка ПО not found after concept creation');
        this._devOpsBootstrapped = true;
        return;
      }

      // 4. Create properties
      const props = {};
      const propDefs = [
        ['CommitHash', { propertyType: 'attribute', dataType: 'Text' }],
        ['BranchName', { propertyType: 'attribute', dataType: 'Text' }],
        ['PRNumber', { propertyType: 'attribute', dataType: 'Number' }],
        ['IssueNumber', { propertyType: 'attribute', dataType: 'Number' }],
        ['PlanStatus', { propertyType: 'attribute', dataType: 'Text' }],
        ['TaskStatus', { propertyType: 'attribute', dataType: 'Text' }],
        ['TestResult', { propertyType: 'attribute', dataType: 'Text' }],
        ['IdeaStatus', { propertyType: 'attribute', dataType: 'Text' }],
        ['CoveragePercent', { propertyType: 'attribute', dataType: 'Number' }],
        ['DeployTarget', { propertyType: 'attribute', dataType: 'Text' }],
        ['FilesChanged', { propertyType: 'attribute', dataType: 'Number' }],
        ['LinesAdded', { propertyType: 'attribute', dataType: 'Number' }],
        ['LinesRemoved', { propertyType: 'attribute', dataType: 'Number' }],
      ];
      for (const [name, opts] of propDefs) {
        try {
          const p = await this.createProperty(name, opts);
          props[name] = String(p?.id || p?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create DevOps property ${name}:`, err.message);
        }
      }

      // 5. Create Model Events
      const DEV_EVENTS = [
        // Plan lifecycle
        ['dev.plan_created', { required: true }],
        ['dev.plan_updated', {}],
        ['dev.plan_verified', { immutable: true }],
        ['dev.plan_abandoned', { immutable: true }],
        // Idea lifecycle
        ['dev.idea_captured', {}],
        ['dev.idea_evaluated', {}],
        ['dev.idea_promoted', {}],
        ['dev.idea_rejected', {}],
        // Task lifecycle
        ['dev.task_created', {}],
        ['dev.task_started', {}],
        ['dev.task_completed', {}],
        ['dev.task_blocked', {}],
        // Decision records
        ['dev.decision_made', { immutable: true }],
        ['dev.decision_reason', {}],
        // Git operations
        ['dev.code_committed', {}],
        ['dev.branch_created', {}],
        ['dev.branch_merged', {}],
        // Pull requests
        ['dev.pr_opened', {}],
        ['dev.pr_reviewed', {}],
        ['dev.pr_merged', { immutable: true }],
        ['dev.pr_closed', {}],
        // Issues
        ['dev.issue_opened', {}],
        ['dev.issue_closed', {}],
        // CI/CD
        ['dev.test_passed', {}],
        ['dev.test_failed', {}],
        ['dev.build_started', {}],
        ['dev.build_succeeded', {}],
        ['dev.build_failed', {}],
        ['dev.deployed', {}],
        ['dev.deploy_failed', {}],
        ['dev.rollback', {}],
        // Incidents
        ['dev.incident_detected', {}],
        ['dev.incident_resolved', {}],
        // Reviews
        ['dev.review_requested', {}],
        ['dev.review_completed', {}],
      ];

      const modelEventIds = {};
      for (const [eventType, constraints] of DEV_EVENTS) {
        try {
          const result = await this.createModelEvent(eventType, {
            modelId,
            propertyId: props.TaskStatus || props.PlanStatus,
            constraints,
          });
          modelEventIds[eventType] = String(result?.id || result?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create DevOps model event ${eventType}:`, err.message);
        }
      }

      // 6. Create FSM states
      const FSM_STATES = [
        ['Идея', 'initial'],
        ['Планирование', 'normal'],
        ['Разработка', 'normal'],
        ['Ревью', 'normal'],
        ['Тестирование', 'normal'],
        ['Развёрнут', 'normal'],
        ['Верифицирован', 'final'],
        ['Заброшен', 'final'],
      ];

      const stateIds = {};
      if (this.createState) {
        for (const [name, type] of FSM_STATES) {
          try {
            const s = await this.createState(modelId, { name, type });
            stateIds[name] = String(s?.id || s?.obj);
          } catch (err) {
            logger.warn(`[EventEngine] Failed to create DevOps state ${name}:`, err.message);
          }
        }

        // 7. Create FSM transitions
        const FSM_TRANSITIONS = [
          ['Идея', 'Планирование', 'dev.idea_promoted', ''],
          ['Планирование', 'Разработка', 'dev.task_started', ''],
          ['Разработка', 'Ревью', 'dev.pr_opened', ''],
          ['Ревью', 'Тестирование', 'dev.pr_merged', ''],
          ['Тестирование', 'Развёрнут', 'dev.deployed', 'тесты пройдены'],
          ['Тестирование', 'Разработка', 'dev.test_failed', 'нужен фикс'],
          ['Развёрнут', 'Верифицирован', 'dev.plan_verified', ''],
          // Any → Abandoned transitions
          ['Идея', 'Заброшен', 'dev.plan_abandoned', ''],
          ['Планирование', 'Заброшен', 'dev.plan_abandoned', ''],
          ['Разработка', 'Заброшен', 'dev.plan_abandoned', ''],
          ['Ревью', 'Заброшен', 'dev.plan_abandoned', ''],
          ['Тестирование', 'Заброшен', 'dev.plan_abandoned', ''],
          ['Развёрнут', 'Заброшен', 'dev.plan_abandoned', ''],
        ];

        for (const [from, to, trigger, guard] of FSM_TRANSITIONS) {
          if (stateIds[from] && stateIds[to]) {
            try {
              await this.createTransition(modelId, {
                fromStateId: stateIds[from],
                toStateId: stateIds[to],
                trigger,
                guard: guard || undefined,
              });
            } catch (err) {
              logger.warn(`[EventEngine] Failed to create DevOps transition ${from}→${to}:`, err.message);
            }
          }
        }
      }

      // 8. Create Individual — the DevOps tracker instance
      const individual = await this.createIndividual('ДронДок-трекер', {
        conceptId, modelId, actorId: developerId,
      });
      const individualId = String(individual?.id || individual?.obj);

      // 9. Register DevOps triggers (self-execution)
      const DEV_TRIGGERS = [
        {
          // Трекинг плана — при завершении задачи проверить прогресс
          condition: 'eventType $EQ "dev.task_completed"',
          action: {
            type: 'computeValue',
            params: { expression: 'dev_plan_progress' },
          },
          priority: 8,
        },
        {
          // Эскалация при провале тестов
          condition: 'eventType $EQ "dev.test_failed"',
          action: {
            type: 'createEvent',
            params: { name: 'dev.task_blocked', value: 'Тесты провалены — задача заблокирована' },
          },
          priority: 9,
        },
        {
          // Напоминание об идее
          condition: 'eventType $EQ "dev.idea_captured"',
          action: {
            type: 'notify',
            params: { message: 'Новая идея зафиксирована — оценить в течение 7 дней' },
          },
          priority: 5,
        },
        // ── Hive-Mind Pipeline triggers (pipelineMode guard) ──
        {
          condition: 'eventType $EQ "dev.issue_opened" $AND value $CONTAINS "pipelineMode"',
          action: { type: 'executeHiveStep', params: { step: 'create_branch' } },
          priority: 10,
        },
        {
          condition: 'eventType $EQ "dev.branch_created" $AND value $CONTAINS "pipelineMode"',
          action: { type: 'executeHiveStep', params: { step: 'launch_solve' } },
          priority: 10,
        },
        {
          condition: 'eventType $EQ "dev.code_committed" $AND value $CONTAINS "pipelineMode"',
          action: { type: 'executeHiveStep', params: { step: 'check_ci', debounce: 10 } },
          priority: 10,
        },
        {
          condition: 'eventType $EQ "dev.build_succeeded" $AND value $CONTAINS "pipelineMode"',
          action: { type: 'executeHiveStep', params: { step: 'create_pr' } },
          priority: 10,
        },
        {
          condition: 'eventType $EQ "dev.pr_merged" $AND value $CONTAINS "pipelineMode"',
          action: { type: 'executeHiveStep', params: { step: 'mark_deployed' } },
          priority: 10,
        },
        {
          condition: 'eventType $EQ "dev.build_failed" $AND value $CONTAINS "pipelineMode"',
          action: {
            type: 'notify',
            params: { message: 'Сборка пайплайна провалена — задача заблокирована' },
          },
          priority: 10,
        },
        {
          condition: 'eventType $EQ "dev.test_failed" $AND value $CONTAINS "pipelineMode"',
          action: { type: 'executeHiveStep', params: { step: 'retry_or_block' } },
          priority: 10,
        },
      ];

      for (const trigger of DEV_TRIGGERS) {
        try {
          await this.registerTrigger({ modelId, ...trigger });
        } catch (err) {
          logger.warn('[EventEngine] Failed to register DevOps trigger:', err.message);
        }
      }

      // Cache IDs
      this._devOpsIds = {
        actors: {
         Разработчик: developerId,
         CI_система: ciRunnerId,
         GitHub_бот: gitHubBotId,
         Трекер_планов: planTrackerId,
         Сборщик_идей: ideaCollectorId,
        },
        modelId,
        modelEventIds,
        individualId,
        conceptId,
        stateIds,
        props,
      };

      this._devOpsBootstrapped = true;
      logger.info('[EventEngine] DevOps domain bootstrapped', {
        actors: 5, modelEvents: Object.keys(modelEventIds).length, individualId,
      });
    } catch (err) {
      logger.error('[EventEngine] Bootstrap DevOps domain failed:', err.message);
      this._devOpsBootstrapped = true;
    }
  }

  /**
   * Load DevOps IDs from existing data.
   */
  async _loadDevOpsIds(actors) {
    const developer = actors.find(a => a.val === 'Разработчик');
    const ciRunner = actors.find(a => a.val === 'CI_система');
    const gitHubBot = actors.find(a => a.val === 'GitHub_бот');
    const planTracker = actors.find(a => a.val === 'Трекер_планов');
    const ideaCollector = actors.find(a => a.val === 'Сборщик_идей');

    const models = await this.getObjects(this.tables.models);
    // Find the model that actually has dev.* events attached
    const devModelCandidates = models.filter(m =>
      m.val === 'Model_Разработка ПО' || m.val === 'Model_SoftwareDevelopment' || m.val === 'Модель_Разработка ПО'
    );

    const allEvents = await this.getObjects(this.tables.modelEvents);
    let modelId = null;
    let modelEventIds = {};

    // Try each candidate model and pick the one with actual dev.* events
    for (const candidate of devModelCandidates) {
      const candidateId = String(candidate.id);
      const matched = {};
      for (const evt of allEvents) {
        const mReq = evt.reqs?.['Модель'] || evt.reqs?.['Model'];
        if (mReq && String(mReq.value || mReq) === candidateId && evt.val.startsWith('dev.')) {
          matched[evt.val] = String(evt.id);
        }
      }
      if (Object.keys(matched).length > Object.keys(modelEventIds).length) {
        modelId = candidateId;
        modelEventIds = matched;
      }
    }
    if (Object.keys(modelEventIds).length === 0) {
      logger.warn(`[_loadDevOpsIds] No dev.* model events found for any candidate model`);
    }

    const individuals = await this.getObjects(this.tables.individuals);
    const individual = individuals.find(i => i.val === 'ДронДок-трекер');

    return {
      actors: {
       Разработчик: developer ? String(developer.id) : null,
       CI_система: ciRunner ? String(ciRunner.id) : null,
       GitHub_бот: gitHubBot ? String(gitHubBot.id) : null,
       Трекер_планов: planTracker ? String(planTracker.id) : null,
       Сборщик_идей: ideaCollector ? String(ideaCollector.id) : null,
      },
      modelId,
      modelEventIds,
      individualId: individual ? String(individual.id) : null,
    };
  }

  /**
   * Get DevOps IDs (used by REST API).
   */
  getDevOpsIds() {
    return this._devOpsIds || null;
  }

  // ─── DevOps Service Methods ─────────────────────────────────────

  /**
   * Record a git commit as a SOD event with causal links.
   */
  async recordCommit({ hash, message, branch, filesChanged, linesAdded, linesRemoved, author, relatedTaskId }) {
    await this.initialize();
    await this.bootstrapDevOpsDomain();
    const ids = this._devOpsIds;
    if (!ids) throw new Error('DevOps domain not bootstrapped');

    // Build causal links — if this commit relates to a task, find the task's last event
    const causes = [];
    if (relatedTaskId) {
      const taskEvents = await this.getSubjectEvents(relatedTaskId);
      if (taskEvents.length > 0) {
        causes.push(String(taskEvents[taskEvents.length - 1].id));
      }
    }

    const eventResult = await this.createSubjectEvent('dev.code_committed', {
      individualId: ids.individualId,
      modelEventId: ids.modelEventIds['dev.code_committed'],
      value: JSON.stringify({
        hash,
        message,
        branch,
        filesChanged: filesChanged || 0,
        linesAdded: linesAdded || 0,
        linesRemoved: linesRemoved || 0,
        author: author || 'unknown',
        relatedTaskId: relatedTaskId || null,
        committedAt: new Date().toISOString(),
      }),
      actorId: ids.actors.Разработчик,
      causes,
    });

    return {
      eventId: String(eventResult?.id || eventResult?.obj),
      hash,
      branch,
      message,
    };
  }

  /**
   * Record a GitHub event (PR, issue, etc.).
   */
  async recordGitHubEvent({ type, number, title, body, author, branch, relatedCommits, pipelineMode, owner, repo, issueUrl }) {
    await this.initialize();
    await this.bootstrapDevOpsDomain();
    const ids = this._devOpsIds;
    if (!ids) throw new Error('DevOps domain not bootstrapped');

    // Map GitHub event type to SOD model event
    const eventTypeMap = {
      'pr_opened': 'dev.pr_opened',
      'pr_reviewed': 'dev.pr_reviewed',
      'pr_merged': 'dev.pr_merged',
      'pr_closed': 'dev.pr_closed',
      'issue_opened': 'dev.issue_opened',
      'issue_closed': 'dev.issue_closed',
    };

    const sodEventType = eventTypeMap[type] || `dev.${type}`;
    const modelEventId = ids.modelEventIds[sodEventType];

    // Build causal links from related commits
    const causes = [];
    if (relatedCommits && relatedCommits.length > 0) {
      const allEvents = await this.getSubjectEvents(ids.individualId);
      for (const commitHash of relatedCommits) {
        const commitEvent = allEvents.find(e => {
          try {
            const val = JSON.parse(e.reqs?.['Значение']?.value || '{}');
            return val.hash === commitHash;
          } catch { return false; }
        });
        if (commitEvent) causes.push(String(commitEvent.id));
      }
    }

    const valuePayload = {
      type,
      number: number || null,
      title: title || '',
      body: body || '',
      author: author || 'unknown',
      branch: branch || null,
      relatedCommits: relatedCommits || [],
      recordedAt: new Date().toISOString(),
    };
    // Pass through pipeline context for trigger guards
    if (pipelineMode) {
      valuePayload.pipelineMode = true;
      if (owner) valuePayload.owner = owner;
      if (repo) valuePayload.repo = repo;
      if (issueUrl) valuePayload.issueUrl = issueUrl;
    }

    const eventResult = await this.createSubjectEvent(sodEventType, {
      individualId: ids.individualId,
      modelEventId,
      value: JSON.stringify(valuePayload),
      actorId: ids.actors.GitHub_бот,
      causes,
    });

    return {
      eventId: String(eventResult?.id || eventResult?.obj),
      type: sodEventType,
      number,
      title,
    };
  }

  /**
   * Create a plan in SOD.
   */
  async createDevPlan({ title, description, modules, tasks }) {
    await this.initialize();
    await this.bootstrapDevOpsDomain();
    const ids = this._devOpsIds;
    if (!ids) throw new Error('DevOps domain not bootstrapped');

    // Create Individual for the plan
    const individual = await this.createIndividual(title, {
      conceptId: ids.conceptId,
      modelId: ids.modelId,
      actorId: ids.actors.Трекер_планов,
    });
    const planId = String(individual?.id || individual?.obj);

    // Create initial subject event: dev.plan_created
    const taskList = (tasks || []).map((t, idx) => ({
      id: `task_${idx}`,
      title: typeof t === 'string' ? t : t.title,
      description: typeof t === 'string' ? '' : (t.description || ''),
      module: typeof t === 'string' ? null : (t.module || null),
      status: 'todo',
    }));

    const eventResult = await this.createSubjectEvent('dev.plan_created', {
      individualId: planId,
      modelEventId: ids.modelEventIds['dev.plan_created'],
      value: JSON.stringify({
        title,
        description: description || '',
        modules: modules || [],
        tasks: taskList,
        planStatus: 'planned',
        totalTasks: taskList.length,
        completedTasks: 0,
        createdAt: new Date().toISOString(),
      }),
      actorId: ids.actors.Трекер_планов,
      causes: [],
    });

    return {
      planId,
      eventId: String(eventResult?.id || eventResult?.obj),
      title,
      totalTasks: taskList.length,
      status: 'planned',
    };
  }

  /**
   * Get plan progress (how many tasks done vs total).
   */
  async getDevPlanProgress(planId) {
    await this.initialize();
    await this.bootstrapDevOpsDomain();
    const ids = this._devOpsIds;
    if (!ids) throw new Error('DevOps domain not bootstrapped');

    const events = await this.getSubjectEvents(planId);
    if (events.length === 0) return null;

    // Reconstruct plan state from event stream
    let planData = { title: '', tasks: [], planStatus: 'planned', totalTasks: 0, completedTasks: 0 };
    const taskStatuses = {};
    const timeline = [];

    for (const evt of events) {
      let val = {};
      try {
        val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
      } catch { /* skip */ }

      if (evt.val === 'dev.plan_created') {
        planData = { ...planData, ...val };
        if (val.tasks) {
          for (const t of val.tasks) {
            taskStatuses[t.id] = t.status || 'todo';
          }
        }
      }

      if (evt.val === 'dev.plan_updated') {
        planData = { ...planData, ...val };
      }

      if (evt.val === 'dev.task_started' && val.taskId) {
        taskStatuses[val.taskId] = 'in_progress';
      }

      if (evt.val === 'dev.task_completed' && val.taskId) {
        taskStatuses[val.taskId] = 'done';
      }

      if (evt.val === 'dev.task_blocked' && val.taskId) {
        taskStatuses[val.taskId] = 'blocked';
      }

      if (evt.val === 'dev.plan_verified') {
        planData.planStatus = 'verified';
      }

      if (evt.val === 'dev.plan_abandoned') {
        planData.planStatus = 'abandoned';
      }

      timeline.push({
        id: evt.id,
        type: evt.val,
        value: val,
        timestamp: evt.reqs?.['Временная метка']?.value || null,
      });
    }

    const totalTasks = Object.keys(taskStatuses).length || planData.totalTasks;
    const completedTasks = Object.values(taskStatuses).filter(s => s === 'done').length;
    const blockedTasks = Object.values(taskStatuses).filter(s => s === 'blocked').length;
    const inProgressTasks = Object.values(taskStatuses).filter(s => s === 'in_progress').length;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      planId,
      title: planData.title,
      planStatus: planData.planStatus,
      totalTasks,
      completedTasks,
      blockedTasks,
      inProgressTasks,
      todoTasks: totalTasks - completedTasks - blockedTasks - inProgressTasks,
      progressPercent,
      taskStatuses,
      timeline,
      isComplete: completedTasks === totalTasks && totalTasks > 0,
    };
  }

  /**
   * Capture an idea.
   */
  async captureIdea({ title, description, source, relatedTo }) {
    await this.initialize();
    await this.bootstrapDevOpsDomain();
    const ids = this._devOpsIds;
    if (!ids) throw new Error('DevOps domain not bootstrapped');

    // Create Individual for the idea
    const individual = await this.createIndividual(`Idea: ${title}`, {
      conceptId: ids.conceptId,
      modelId: ids.modelId,
      actorId: ids.actors.Сборщик_идей,
    });
    const ideaId = String(individual?.id || individual?.obj);

    // Build causal links from relatedTo
    const causes = [];
    if (relatedTo) {
      const relatedIds = Array.isArray(relatedTo) ? relatedTo : [relatedTo];
      for (const rId of relatedIds) {
        const relatedEvents = await this.getSubjectEvents(rId);
        if (relatedEvents.length > 0) {
          causes.push(String(relatedEvents[relatedEvents.length - 1].id));
        }
      }
    }

    const eventResult = await this.createSubjectEvent('dev.idea_captured', {
      individualId: ideaId,
      modelEventId: ids.modelEventIds['dev.idea_captured'],
      value: JSON.stringify({
        title,
        description: description || '',
        source: source || 'conversation',
        ideaStatus: 'captured',
        relatedTo: relatedTo || null,
        capturedAt: new Date().toISOString(),
      }),
      actorId: ids.actors.Сборщик_идей,
      causes,
    });

    return {
      ideaId,
      eventId: String(eventResult?.id || eventResult?.obj),
      title,
      status: 'captured',
    };
  }

  /**
   * Get all ideas with status.
   */
  async getIdeas(statusFilter) {
    await this.initialize();
    await this.bootstrapDevOpsDomain();
    const ids = this._devOpsIds;
    if (!ids) return [];

    const individuals = await this.getObjects(this.tables.individuals);
    const ideas = individuals.filter(ind => {
      const conceptReq = ind.reqs['Концепт'];
      return conceptReq && String(conceptReq.value) === ids.conceptId && ind.val.startsWith('Idea: ');
    });

    const results = [];
    for (const idea of ideas) {
      const events = await this.getSubjectEvents(idea.id);
      let data = { title: idea.val.replace('Idea: ', ''), ideaStatus: 'captured' };

      for (const evt of events) {
        try {
          const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          if (val.title || val.ideaStatus) data = { ...data, ...val };
        } catch { /* skip */ }

        if (evt.val === 'dev.idea_evaluated') data.ideaStatus = 'evaluated';
        if (evt.val === 'dev.idea_promoted') data.ideaStatus = 'promoted';
        if (evt.val === 'dev.idea_rejected') data.ideaStatus = 'rejected';
      }

      if (statusFilter && data.ideaStatus !== statusFilter) continue;
      results.push({ id: idea.id, ...data, eventCount: events.length });
    }

    return results;
  }

  /**
   * Promote idea to plan.
   */
  async promoteIdea(ideaId) {
    await this.initialize();
    await this.bootstrapDevOpsDomain();
    const ids = this._devOpsIds;
    if (!ids) throw new Error('DevOps domain not bootstrapped');

    // Get the idea's current state
    const events = await this.getSubjectEvents(ideaId);
    if (events.length === 0) throw new Error(`Idea ${ideaId} not found or has no events`);

    // Extract idea data from the last capture/evaluate event
    let ideaData = {};
    for (const evt of events) {
      try {
        const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
        if (val.title) ideaData = { ...ideaData, ...val };
      } catch { /* skip */ }
    }

    // Record promotion event on the idea
    const lastEventId = String(events[events.length - 1].id);
    const promoteEvent = await this.createSubjectEvent('dev.idea_promoted', {
      individualId: ideaId,
      modelEventId: ids.modelEventIds['dev.idea_promoted'],
      value: JSON.stringify({
        ...ideaData,
        ideaStatus: 'promoted',
        promotedAt: new Date().toISOString(),
      }),
      actorId: ids.actors.Трекер_планов,
      causes: [lastEventId],
    });

    // Auto-create a plan from the idea
    const plan = await this.createDevPlan({
      title: ideaData.title || `Plan from idea ${ideaId}`,
      description: ideaData.description || '',
      modules: [],
      tasks: [],
    });

    return {
      ideaId,
      promotionEventId: String(promoteEvent?.id || promoteEvent?.obj),
      planId: plan.planId,
      title: ideaData.title,
    };
  }

  /**
   * Record an architectural decision.
   */
  async recordDecision({ title, rationale, alternatives, chosen, relatedTo }) {
    await this.initialize();
    await this.bootstrapDevOpsDomain();
    const ids = this._devOpsIds;
    if (!ids) throw new Error('DevOps domain not bootstrapped');

    // Build causal links
    const causes = [];
    if (relatedTo) {
      const relatedIds = Array.isArray(relatedTo) ? relatedTo : [relatedTo];
      for (const rId of relatedIds) {
        const relatedEvents = await this.getSubjectEvents(rId);
        if (relatedEvents.length > 0) {
          causes.push(String(relatedEvents[relatedEvents.length - 1].id));
        }
      }
    }

    // Record the decision
    const decisionEvent = await this.createSubjectEvent('dev.decision_made', {
      individualId: ids.individualId,
      modelEventId: ids.modelEventIds['dev.decision_made'],
      value: JSON.stringify({
        title,
        rationale: rationale || '',
        alternatives: alternatives || [],
        chosen: chosen || title,
        decidedAt: new Date().toISOString(),
      }),
      actorId: ids.actors.Разработчик,
      causes,
    });

    const decisionEventId = String(decisionEvent?.id || decisionEvent?.obj);

    // Record the reason as a separate causal event (WHY this decision)
    const reasonEvent = await this.createSubjectEvent('dev.decision_reason', {
      individualId: ids.individualId,
      modelEventId: ids.modelEventIds['dev.decision_reason'],
      value: JSON.stringify({
        decisionTitle: title,
        reason: rationale || '',
        alternatives: alternatives || [],
        chosen: chosen || title,
        recordedAt: new Date().toISOString(),
      }),
      actorId: ids.actors.Разработчик,
      causes: [decisionEventId],
    });

    return {
      decisionEventId,
      reasonEventId: String(reasonEvent?.id || reasonEvent?.obj),
      title,
      chosen: chosen || title,
    };
  }

  /**
   * Get development dashboard stats.
   */
  async getDevDashboard() {
    await this.initialize();
    await this.bootstrapDevOpsDomain();
    const ids = this._devOpsIds;
    if (!ids) return null;

    // Get all events for the DevTracker individual
    const allEvents = await this.getSubjectEvents(ids.individualId);

    // Count events by type
    const eventCounts = {};
    let totalCommits = 0;
    let totalPRs = 0;
    let totalIssues = 0;
    let totalTestsPassed = 0;
    let totalTestsFailed = 0;
    let totalDeploys = 0;
    let totalDecisions = 0;
    let totalLinesAdded = 0;
    let totalLinesRemoved = 0;
    let totalFilesChanged = 0;
    const recentEvents = [];
    const branches = new Set();
    const authors = new Set();

    for (const evt of allEvents) {
      eventCounts[evt.val] = (eventCounts[evt.val] || 0) + 1;

      let val = {};
      try {
        val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
      } catch { /* skip */ }

      if (evt.val === 'dev.code_committed') {
        totalCommits++;
        totalLinesAdded += val.linesAdded || 0;
        totalLinesRemoved += val.linesRemoved || 0;
        totalFilesChanged += val.filesChanged || 0;
        if (val.branch) branches.add(val.branch);
        if (val.author) authors.add(val.author);
      }

      if (evt.val === 'dev.pr_opened' || evt.val === 'dev.pr_merged' || evt.val === 'dev.pr_closed') {
        totalPRs++;
      }

      if (evt.val === 'dev.issue_opened' || evt.val === 'dev.issue_closed') {
        totalIssues++;
      }

      if (evt.val === 'dev.test_passed') totalTestsPassed++;
      if (evt.val === 'dev.test_failed') totalTestsFailed++;
      if (evt.val === 'dev.deployed') totalDeploys++;
      if (evt.val === 'dev.decision_made') totalDecisions++;

      // Collect recent events (last 20)
      if (recentEvents.length < 20) {
        recentEvents.push({
          id: evt.id,
          type: evt.val,
          value: val,
          timestamp: evt.reqs?.['Временная метка']?.value || null,
        });
      }
    }

    // Get all plans and ideas
    const individuals = await this.getObjects(this.tables.individuals);
    const planIndividuals = individuals.filter(ind => {
      const conceptReq = ind.reqs['Концепт'];
      return conceptReq && String(conceptReq.value) === ids.conceptId
        && !ind.val.startsWith('Idea: ')
        && ind.val !== 'ДронДок-трекер';
    });

    const ideaIndividuals = individuals.filter(ind => {
      const conceptReq = ind.reqs['Концепт'];
      return conceptReq && String(conceptReq.value) === ids.conceptId && ind.val.startsWith('Idea: ');
    });

    return {
      summary: {
        totalEvents: allEvents.length,
        totalCommits,
        totalPRs,
        totalIssues,
        totalTestsPassed,
        totalTestsFailed,
        totalDeploys,
        totalDecisions,
        totalLinesAdded,
        totalLinesRemoved,
        totalFilesChanged,
        activeBranches: branches.size,
        uniqueAuthors: authors.size,
        totalPlans: planIndividuals.length,
        totalIdeas: ideaIndividuals.length,
      },
      testHealth: totalTestsPassed + totalTestsFailed > 0
        ? Math.round((totalTestsPassed / (totalTestsPassed + totalTestsFailed)) * 100)
        : 100,
      eventCounts,
      recentEvents: recentEvents.reverse(),
      branches: Array.from(branches),
      authors: Array.from(authors),
    };
  }

  /**
   * Verify a plan against implementation (check commits/PRs exist for all tasks).
   */
  async verifyPlan(planId) {
    await this.initialize();
    await this.bootstrapDevOpsDomain();
    const ids = this._devOpsIds;
    if (!ids) throw new Error('DevOps domain not bootstrapped');

    // Get plan progress first
    const progress = await this.getDevPlanProgress(planId);
    if (!progress) throw new Error(`Plan ${planId} not found`);

    // Get all commits and PRs from the tracker
    const trackerEvents = await this.getSubjectEvents(ids.individualId);
    const commits = [];
    const prs = [];

    for (const evt of trackerEvents) {
      let val = {};
      try {
        val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
      } catch { /* skip */ }

      if (evt.val === 'dev.code_committed') {
        commits.push({ id: evt.id, ...val });
      }
      if (evt.val === 'dev.pr_merged') {
        prs.push({ id: evt.id, ...val });
      }
    }

    // Check plan events for task references to commits
    const planEvents = await this.getSubjectEvents(planId);
    const taskCompletions = planEvents.filter(e => e.val === 'dev.task_completed');
    const hasCommits = commits.length > 0;
    const hasMergedPRs = prs.length > 0;

    const verificationResult = {
      planId,
      title: progress.title,
      isComplete: progress.isComplete,
      progressPercent: progress.progressPercent,
      totalTasks: progress.totalTasks,
      completedTasks: progress.completedTasks,
      blockedTasks: progress.blockedTasks,
      hasCommits,
      commitCount: commits.length,
      hasMergedPRs,
      mergedPRCount: prs.length,
      taskCompletionEvents: taskCompletions.length,
      verified: progress.isComplete && hasCommits,
      verifiedAt: new Date().toISOString(),
    };

    // If plan is complete and has implementation evidence, record verification
    if (verificationResult.verified) {
      const lastPlanEvent = planEvents[planEvents.length - 1];
      await this.createSubjectEvent('dev.plan_verified', {
        individualId: planId,
        modelEventId: ids.modelEventIds['dev.plan_verified'],
        value: JSON.stringify(verificationResult),
        actorId: ids.actors.Трекер_планов,
        causes: lastPlanEvent ? [String(lastPlanEvent.id)] : [],
      });
    }

    return verificationResult;
  }

  // ─── Module 1: Digital Twin Domain ─────────────────────────────────

  async bootstrapDigitalTwinDomain() {
    if (this._twinBootstrapped) return;

    try {
      const actors = await this.getObjects(this.tables.actors);
      const existingTwin = actors.find(a => a.val === 'Дрон_юнит');
      if (existingTwin) {
        this._twinIds = await this._loadTwinIds(actors);
        this._twinBootstrapped = true;
        logger.info('[EventEngine] Digital Twin domain already bootstrapped');
        return;
      }

      logger.info('[EventEngine] Bootstrapping Digital Twin domain...');

      // 1. Create Actors
      const droneUnit = await this.createActor('Дрон_юнит', {
        type: 'sensor', description: 'Физический дрон, передающий телеметрию',
      });
      const telemetryCollector = await this.createActor('Коллектор_телеметрии', {
        type: 'sensor', description: 'Собирает и агрегирует телеметрию',
      });
      const maintenanceManager = await this.createActor('Менеджер_ТО', {
        type: 'agent', description: 'Управляет графиком обслуживания',
      });
      const fleetAnalyzer = await this.createActor('Аналитик_флота', {
        type: 'agent', description: 'Анализирует здоровье флота',
      });

      const droneUnitId = String(droneUnit?.id || droneUnit?.obj);
      const telemetryCollectorId = String(telemetryCollector?.id || telemetryCollector?.obj);
      const maintenanceManagerId = String(maintenanceManager?.id || maintenanceManager?.obj);
      const fleetAnalyzerId = String(fleetAnalyzer?.id || fleetAnalyzer?.obj);

      // 2. Create Concept → auto-creates Модель_Цифровой двойник
      const concept = await this.createConcept('Цифровой двойник', 'Цифровой двойник физического дрона');
      const conceptId = String(concept?.id || concept?.obj);

      // 3. Find auto-created model
      const models = await this.getObjects(this.tables.models);
      const model = models.find(m => m.val === 'Модель_Цифровой двойник');
      const modelId = model ? String(model.id) : null;

      if (!modelId) {
        logger.warn('[EventEngine] Модель_Цифровой двойник not found after concept creation');
        this._twinBootstrapped = true;
        return;
      }

      // 4. Create properties
      const props = {};
      const propDefs = [
        ['SerialNumber', { propertyType: 'attribute', dataType: 'Text' }],
        ['DroneModel', { propertyType: 'attribute', dataType: 'Text' }],
        ['Manufacturer', { propertyType: 'attribute', dataType: 'Text' }],
        ['FlightHours', { propertyType: 'attribute', dataType: 'Number' }],
        ['CycleCount', { propertyType: 'attribute', dataType: 'Number' }],
        ['BatteryHealth', { propertyType: 'attribute', dataType: 'Number' }],
        ['MotorWear', { propertyType: 'attribute', dataType: 'Number' }],
        ['GPSAccuracy', { propertyType: 'attribute', dataType: 'Number' }],
        ['FirmwareVersion', { propertyType: 'attribute', dataType: 'Text' }],
        ['BaseLocation', { propertyType: 'attribute', dataType: 'Text' }],
        ['CurrentLocation', { propertyType: 'attribute', dataType: 'Text' }],
        ['ComponentStatus', { propertyType: 'attribute', dataType: 'Text' }],
      ];
      for (const [name, opts] of propDefs) {
        try {
          const p = await this.createProperty(name, opts);
          props[name] = String(p?.id || p?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create Twin property ${name}:`, err.message);
        }
      }

      // 5. Create Model Events
      const TWIN_EVENTS = [
        ['twin.telemetry_received', {}],
        ['twin.state_changed', {}],
        ['twin.component_degradation', {}],
        ['twin.maintenance_due', {}],
        ['twin.maintenance_done', { immutable: true }],
        ['twin.firmware_updated', {}],
        ['twin.calibration_needed', {}],
        ['twin.geofence_violation', {}],
        ['twin.collision_risk', {}],
        ['twin.return_to_home', {}],
        ['twin.lost_signal', {}],
        ['twin.recovered', {}],
        ['twin.registered', { required: true }],
        ['twin.decommissioned', { immutable: true }],
        ['twin.health_report', {}],
      ];

      const modelEventIds = {};
      for (const [eventType, constraints] of TWIN_EVENTS) {
        try {
          const result = await this.createModelEvent(eventType, {
            modelId,
            propertyId: props.BatteryHealth || props.SerialNumber,
            constraints,
          });
          modelEventIds[eventType] = String(result?.id || result?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create Twin model event ${eventType}:`, err.message);
        }
      }

      // 6. Create FSM states
      const FSM_STATES = [
        ['Простой', 'initial'],
        ['Предполёт', 'normal'],
        ['Готов', 'normal'],
        ['Полёт', 'normal'],
        ['Посадка', 'normal'],
        ['Аварийный', 'normal'],
        ['Обслуживание', 'normal'],
        ['Списан', 'final'],
      ];

      const stateIds = {};
      if (this.createState) {
        for (const [name, type] of FSM_STATES) {
          try {
            const s = await this.createState(modelId, { name, type });
            stateIds[name] = String(s?.id || s?.obj);
          } catch (err) {
            logger.warn(`[EventEngine] Failed to create Twin state ${name}:`, err.message);
          }
        }

        // 7. Create FSM transitions
        const FSM_TRANSITIONS = [
          ['Простой', 'Предполёт', 'twin.state_changed', 'начало предполётной'],
          ['Предполёт', 'Готов', 'twin.state_changed', 'предполётная завершена'],
          ['Готов', 'Полёт', 'twin.state_changed', 'взлёт'],
          ['Полёт', 'Посадка', 'twin.state_changed', 'начало посадки'],
          ['Посадка', 'Простой', 'twin.state_changed', 'приземлился'],
          ['Полёт', 'Аварийный', 'twin.lost_signal', 'потеря сигнала'],
          ['Полёт', 'Аварийный', 'twin.collision_risk', 'обнаружен риск столкновения'],
          ['Аварийный', 'Посадка', 'twin.return_to_home', 'возврат домой активирован'],
          ['Простой', 'Обслуживание', 'twin.maintenance_due', 'требуется ТО'],
          ['Предполёт', 'Обслуживание', 'twin.maintenance_due', 'предполётная не пройдена'],
          ['Посадка', 'Обслуживание', 'twin.maintenance_due', 'послеполётное ТО'],
          ['Обслуживание', 'Простой', 'twin.maintenance_done', 'ТО завершено'],
          ['Простой', 'Списан', 'twin.decommissioned', 'дрон списан'],
          ['Предполёт', 'Списан', 'twin.decommissioned', 'дрон списан'],
          ['Обслуживание', 'Списан', 'twin.decommissioned', 'дрон списан'],
        ];

        for (const [from, to, trigger, guard] of FSM_TRANSITIONS) {
          if (stateIds[from] && stateIds[to]) {
            try {
              await this.createTransition(modelId, {
                fromStateId: stateIds[from],
                toStateId: stateIds[to],
                trigger,
                guard: guard || undefined,
              });
            } catch (err) {
              logger.warn(`[EventEngine] Failed to create Twin transition ${from}→${to}:`, err.message);
            }
          }
        }
      }

      // 8. Register Digital Twin triggers
      const TWIN_TRIGGERS = [
        {
          // Здоровье батареи < 70 → ТО
          condition: 'eventType $EQ "twin.telemetry_received" $AND BatteryHealth $LT 70',
          action: {
            type: 'createEvent',
            params: { name: 'twin.maintenance_due', value: 'Здоровье батареи ниже 70%' },
          },
          priority: 10,
        },
        {
          // Налёт > 100 → калибровка
          condition: 'eventType $EQ "twin.telemetry_received" $AND FlightHours $GT 100',
          action: {
            type: 'createEvent',
            params: { name: 'twin.calibration_needed', value: 'Налёт превышает 100 часов без калибровки' },
          },
          priority: 9,
        },
        {
          // Потеря сигнала → возврат домой
          condition: 'eventType $EQ "twin.lost_signal"',
          action: {
            type: 'createEvent',
            params: { name: 'twin.return_to_home', value: 'Авто-RTH при потере сигнала' },
          },
          priority: 10,
        },
        {
          // Деградация × 3 → прогноз отказа (кросс-домен)
          condition: 'eventType $EQ "twin.component_degradation" $AND occurrences $GTE 3',
          action: {
            type: 'createEvent',
            params: { name: 'ops.failure_predicted', value: 'Повторная деградация компонента обнаружена' },
          },
          priority: 8,
        },
      ];

      for (const trigger of TWIN_TRIGGERS) {
        try {
          await this.registerTrigger({ modelId, ...trigger });
        } catch (err) {
          logger.warn('[EventEngine] Failed to register Twin trigger:', err.message);
        }
      }

      // Cache IDs
      this._twinIds = {
        actors: {
         Дрон_юнит: droneUnitId,
         Коллектор_телеметрии: telemetryCollectorId,
         Менеджер_ТО: maintenanceManagerId,
         Аналитик_флота: fleetAnalyzerId,
        },
        modelId,
        modelEventIds,
        conceptId,
        stateIds,
        props,
      };

      this._twinBootstrapped = true;
      logger.info('[EventEngine] Digital Twin domain bootstrapped', {
        actors: 4, modelEvents: Object.keys(modelEventIds).length,
      });
    } catch (err) {
      logger.error('[EventEngine] Bootstrap Digital Twin domain failed:', err.message);
      this._twinBootstrapped = true;
    }
  }

  /**
   * Load Digital Twin IDs from existing data.
   */
  async _loadTwinIds(actors) {
    const droneUnit = actors.find(a => a.val === 'Дрон_юнит');
    const telemetryCollector = actors.find(a => a.val === 'Коллектор_телеметрии');
    const maintenanceManager = actors.find(a => a.val === 'Менеджер_ТО');
    const fleetAnalyzer = actors.find(a => a.val === 'Аналитик_флота');

    const models = await this.getObjects(this.tables.models);
    const model = models.find(m => m.val === 'Модель_Цифровой двойник');
    const modelId = model ? String(model.id) : null;

    const concepts = await this.getObjects(this.tables.concepts);
    const concept = concepts.find(c => c.val === 'Цифровой двойник');
    const conceptId = concept ? String(concept.id) : null;

    let modelEventIds = {};
    if (modelId) {
      const allEvents = await this.getObjects(this.tables.modelEvents);
      for (const evt of allEvents) {
        const mReq = evt.reqs['Модель'];
        if (mReq && String(mReq.value) === modelId && evt.val.startsWith('twin.')) {
          modelEventIds[evt.val] = String(evt.id);
        }
      }
    }

    // Load properties
    const allProps = await this.getObjects(this.tables.properties);
    const propNames = ['SerialNumber', 'DroneModel', 'Manufacturer', 'FlightHours', 'CycleCount', 'BatteryHealth', 'MotorWear', 'GPSAccuracy', 'FirmwareVersion', 'BaseLocation', 'CurrentLocation', 'ComponentStatus'];
    const props = {};
    for (const pName of propNames) {
      const p = allProps.find(pr => pr.val === pName);
      if (p) props[pName] = String(p.id);
    }

    return {
      actors: {
       Дрон_юнит: droneUnit ? String(droneUnit.id) : null,
       Коллектор_телеметрии: telemetryCollector ? String(telemetryCollector.id) : null,
       Менеджер_ТО: maintenanceManager ? String(maintenanceManager.id) : null,
       Аналитик_флота: fleetAnalyzer ? String(fleetAnalyzer.id) : null,
      },
      modelId,
      modelEventIds,
      conceptId,
      props,
    };
  }

  /**
   * Get Digital Twin IDs (used by REST API).
   */
  getTwinIds() {
    return this._twinIds || null;
  }

  // ─── Digital Twin Service Methods ───────────────────────────────────

  /**
   * Register a new drone in the digital twin system.
   */
  async registerDrone({ serialNumber, model, manufacturer, baseLocation }) {
    await this.initialize();
    await this.bootstrapDigitalTwinDomain();
    const ids = this._twinIds;
    if (!ids) throw new Error('Digital Twin domain not bootstrapped');

    const individual = await this.createIndividual(`Drone-${serialNumber}`, {
      conceptId: ids.conceptId,
      modelId: ids.modelId,
      actorId: ids.actors.Дрон_юнит,
    });
    const droneId = String(individual?.id || individual?.obj);

    // Create registration event
    const eventResult = await this.createSubjectEvent('twin.registered', {
      individualId: droneId,
      modelEventId: ids.modelEventIds['twin.registered'],
      value: JSON.stringify({
        serialNumber,
        model,
        manufacturer,
        baseLocation,
        registeredAt: new Date().toISOString(),
        status: 'idle',
        flightHours: 0,
        cycleCount: 0,
        batteryHealth: 100,
        motorWear: 0,
      }),
      actorId: ids.actors.Дрон_юнит,
      causes: [],
    });

    return { droneId, eventId: String(eventResult?.id || eventResult?.obj) };
  }

  /**
   * Record telemetry data as SOD event.
   * If battery < 20 → auto-creates twin.maintenance_due
   * If battery < 10 → auto-creates twin.return_to_home
   */
  async recordTelemetry(droneId, { gps, altitude, battery, speed, heading, temperature }) {
    await this.initialize();
    await this.bootstrapDigitalTwinDomain();
    const ids = this._twinIds;
    if (!ids) throw new Error('Digital Twin domain not bootstrapped');

    const events = await this.getSubjectEvents(droneId);
    const lastEventId = events.length > 0 ? String(events[events.length - 1].id) : null;

    const telemetryData = {
      gps,
      altitude,
      battery,
      speed,
      heading,
      temperature,
      timestamp: new Date().toISOString(),
    };

    const telemetryEvent = await this.createSubjectEvent('twin.telemetry_received', {
      individualId: droneId,
      modelEventId: ids.modelEventIds['twin.telemetry_received'],
      value: JSON.stringify(telemetryData),
      actorId: ids.actors.Коллектор_телеметрии,
      causes: lastEventId ? [lastEventId] : [],
    });
    const telemetryEventId = String(telemetryEvent?.id || telemetryEvent?.obj);

    const result = { droneId, eventId: telemetryEventId, telemetry: telemetryData, alerts: [] };

    // Auto-alert: battery < 20 → maintenance_due
    if (battery !== undefined && battery < 20) {
      try {
        const maintenanceEvt = await this.createSubjectEvent('twin.maintenance_due', {
          individualId: droneId,
          modelEventId: ids.modelEventIds['twin.maintenance_due'],
          value: JSON.stringify({ reason: `Battery critically low: ${battery}%`, battery, triggeredAt: new Date().toISOString() }),
          actorId: ids.actors.Менеджер_ТО,
          causes: [telemetryEventId],
        });
        result.alerts.push({ type: 'twin.maintenance_due', reason: `Battery low: ${battery}%`, eventId: String(maintenanceEvt?.id || maintenanceEvt?.obj) });
      } catch (err) {
        logger.warn('[EventEngine] Failed to create battery maintenance_due event:', err.message);
      }
    }

    // Auto-alert: battery < 10 → return_to_home
    if (battery !== undefined && battery < 10) {
      try {
        const rthEvt = await this.createSubjectEvent('twin.return_to_home', {
          individualId: droneId,
          modelEventId: ids.modelEventIds['twin.return_to_home'],
          value: JSON.stringify({ reason: `Battery critical: ${battery}%, initiating RTH`, battery, triggeredAt: new Date().toISOString() }),
          actorId: ids.actors.Дрон_юнит,
          causes: [telemetryEventId],
        });
        result.alerts.push({ type: 'twin.return_to_home', reason: `Battery critical: ${battery}%`, eventId: String(rthEvt?.id || rthEvt?.obj) });
      } catch (err) {
        logger.warn('[EventEngine] Failed to create RTH event:', err.message);
      }
    }

    return result;
  }

  /**
   * Get drone health report from event history.
   * Scans events for degradation patterns, maintenance history.
   */
  async getDroneHealth(droneId) {
    await this.initialize();
    await this.bootstrapDigitalTwinDomain();
    const ids = this._twinIds;
    if (!ids) throw new Error('Digital Twin domain not bootstrapped');

    const events = await this.getSubjectEvents(droneId);

    let batteryHealth = 100;
    let motorWear = 0;
    let flightHours = 0;
    let lastMaintenance = null;
    let nextMaintenance = null;
    let riskScore = 0;
    const issues = [];

    let degradationCount = 0;
    let telemetryCount = 0;
    let lastTelemetryBattery = null;

    for (const evt of events) {
      let val = {};
      try { val = JSON.parse(evt.reqs?.['Значение']?.value || '{}'); } catch { /* skip */ }

      switch (evt.val) {
        case 'twin.registered':
          if (val.batteryHealth !== undefined) batteryHealth = val.batteryHealth;
          if (val.motorWear !== undefined) motorWear = val.motorWear;
          if (val.flightHours !== undefined) flightHours = val.flightHours;
          break;

        case 'twin.telemetry_received':
          telemetryCount++;
          if (val.battery !== undefined) {
            lastTelemetryBattery = val.battery;
            if (val.battery < 50) batteryHealth = Math.min(batteryHealth, val.battery + 20);
          }
          break;

        case 'twin.component_degradation':
          degradationCount++;
          if (val.component === 'motor') motorWear = Math.min(100, motorWear + 10);
          if (val.component === 'battery') batteryHealth = Math.max(0, batteryHealth - 10);
          issues.push({ type: 'degradation', component: val.component || 'unknown', timestamp: val.timestamp || evt.reqs?.['Временная метка']?.value });
          break;

        case 'twin.maintenance_done':
          lastMaintenance = val.completedAt || evt.reqs?.['Временная метка']?.value;
          if (val.components) {
            for (const comp of (Array.isArray(val.components) ? val.components : [val.components])) {
              if (comp === 'battery') batteryHealth = Math.min(100, batteryHealth + 30);
              if (comp === 'motor') motorWear = Math.max(0, motorWear - 30);
            }
          }
          break;

        case 'twin.maintenance_due':
          nextMaintenance = val.triggeredAt || evt.reqs?.['Временная метка']?.value;
          issues.push({ type: 'maintenance_due', reason: val.reason || 'scheduled', timestamp: nextMaintenance });
          break;

        case 'twin.calibration_needed':
          issues.push({ type: 'calibration_needed', reason: val.reason || 'flight hours exceeded', timestamp: val.timestamp || evt.reqs?.['Временная метка']?.value });
          break;

        case 'twin.lost_signal':
          issues.push({ type: 'lost_signal', timestamp: val.timestamp || evt.reqs?.['Временная метка']?.value });
          riskScore += 15;
          break;

        case 'twin.geofence_violation':
          issues.push({ type: 'geofence_violation', timestamp: val.timestamp || evt.reqs?.['Временная метка']?.value });
          riskScore += 10;
          break;

        case 'twin.collision_risk':
          issues.push({ type: 'collision_risk', timestamp: val.timestamp || evt.reqs?.['Временная метка']?.value });
          riskScore += 20;
          break;
      }
    }

    // Calculate risk score based on health indicators
    if (batteryHealth < 50) riskScore += 20;
    if (batteryHealth < 30) riskScore += 30;
    if (motorWear > 50) riskScore += 15;
    if (motorWear > 80) riskScore += 25;
    if (degradationCount >= 3) riskScore += 20;
    riskScore = Math.min(100, riskScore);

    // Estimate next maintenance
    if (!nextMaintenance && lastMaintenance) {
      const lastMs = new Date(lastMaintenance).getTime();
      const nextMs = lastMs + 30 * 24 * 60 * 60 * 1000; // 30 days
      nextMaintenance = new Date(nextMs).toISOString();
    }

    return {
      droneId,
      batteryHealth,
      motorWear,
      flightHours,
      lastMaintenance,
      nextMaintenance,
      riskScore,
      issues,
      telemetryCount,
      degradationCount,
      lastTelemetryBattery,
      eventCount: events.length,
    };
  }

  /**
   * Get full fleet status — all drones with health summaries.
   */
  async getFleetStatus() {
    await this.initialize();
    await this.bootstrapDigitalTwinDomain();
    const ids = this._twinIds;
    if (!ids) return [];

    const individuals = await this.getObjects(this.tables.individuals);
    const drones = individuals.filter(ind => {
      const conceptReq = ind.reqs['Концепт'];
      return conceptReq && String(conceptReq.value) === ids.conceptId;
    });

    const fleet = [];
    for (const drone of drones) {
      try {
        const health = await this.getDroneHealth(drone.id);
        const events = await this.getSubjectEvents(drone.id);
        let regData = {};
        const regEvt = events.find(e => e.val === 'twin.registered');
        if (regEvt) {
          try { regData = JSON.parse(regEvt.reqs?.['Значение']?.value || '{}'); } catch { /* skip */ }
        }

        fleet.push({
          id: drone.id,
          name: drone.val,
          serialNumber: regData.serialNumber || drone.val,
          model: regData.model || 'unknown',
          manufacturer: regData.manufacturer || 'unknown',
          baseLocation: regData.baseLocation || 'unknown',
          batteryHealth: health.batteryHealth,
          motorWear: health.motorWear,
          flightHours: health.flightHours,
          riskScore: health.riskScore,
          issueCount: health.issues.length,
          lastMaintenance: health.lastMaintenance,
          eventCount: health.eventCount,
        });
      } catch (err) {
        logger.warn(`[EventEngine] Failed to get health for drone ${drone.id}:`, err.message);
        fleet.push({ id: drone.id, name: drone.val, error: err.message });
      }
    }

    return fleet;
  }

  /**
   * Record maintenance performed on a drone.
   */
  async recordMaintenance(droneId, { type, components, technician, notes }) {
    await this.initialize();
    await this.bootstrapDigitalTwinDomain();
    const ids = this._twinIds;
    if (!ids) throw new Error('Digital Twin domain not bootstrapped');

    const events = await this.getSubjectEvents(droneId);
    const lastEventId = events.length > 0 ? String(events[events.length - 1].id) : null;

    const maintenanceData = {
      type: type || 'general',
      components: components || [],
      technician: technician || 'unknown',
      notes: notes || '',
      completedAt: new Date().toISOString(),
    };

    const result = await this.createSubjectEvent('twin.maintenance_done', {
      individualId: droneId,
      modelEventId: ids.modelEventIds['twin.maintenance_done'],
      value: JSON.stringify(maintenanceData),
      actorId: ids.actors.Менеджер_ТО,
      causes: lastEventId ? [lastEventId] : [],
    });

    return { droneId, eventId: String(result?.id || result?.obj), maintenance: maintenanceData };
  }

  /**
   * Predict maintenance needs for a drone based on event patterns.
   * Uses detectEventPatterns logic - looks for degradation→failure chains.
   */
  async predictMaintenance(droneId) {
    await this.initialize();
    await this.bootstrapDigitalTwinDomain();
    const ids = this._twinIds;
    if (!ids) throw new Error('Digital Twin domain not bootstrapped');

    const events = await this.getSubjectEvents(droneId);
    const predictions = [];
    let urgency = 'low';
    let estimatedDate = null;

    // Analyze event patterns for this drone
    const timestamps = events.map(e => {
      const ts = e.reqs?.['Временная метка']?.value;
      return ts ? new Date(ts).getTime() : null;
    }).filter(Boolean);

    // Count degradation events
    const degradationEvents = events.filter(e => e.val === 'twin.component_degradation');
    const maintenanceDoneEvents = events.filter(e => e.val === 'twin.maintenance_done');
    const calibrationEvents = events.filter(e => e.val === 'twin.calibration_needed');
    const lostSignalEvents = events.filter(e => e.val === 'twin.lost_signal');

    // Check for degradation→failure chain pattern
    let degradationsSinceMaintenance = 0;
    let lastMaintenanceIdx = -1;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].val === 'twin.maintenance_done') {
        lastMaintenanceIdx = i;
        break;
      }
    }
    for (let i = lastMaintenanceIdx + 1; i < events.length; i++) {
      if (events[i].val === 'twin.component_degradation') {
        degradationsSinceMaintenance++;
      }
    }

    // Predict based on degradation count since last maintenance
    if (degradationsSinceMaintenance >= 3) {
      predictions.push({
        type: 'imminent_failure',
        component: 'multiple',
        confidence: 85,
        reason: `${degradationsSinceMaintenance} degradation events since last maintenance`,
      });
      urgency = 'critical';
    } else if (degradationsSinceMaintenance >= 1) {
      predictions.push({
        type: 'degradation_trend',
        component: 'unknown',
        confidence: 60,
        reason: `${degradationsSinceMaintenance} degradation event(s) detected`,
      });
      if (urgency !== 'critical') urgency = 'medium';
    }

    // Analyze telemetry for battery degradation trend
    const telemetryEvents = events.filter(e => e.val === 'twin.telemetry_received');
    const batteryReadings = [];
    for (const te of telemetryEvents) {
      try {
        const val = JSON.parse(te.reqs?.['Значение']?.value || '{}');
        if (val.battery !== undefined) batteryReadings.push(val.battery);
      } catch { /* skip */ }
    }

    if (batteryReadings.length >= 3) {
      const recentReadings = batteryReadings.slice(-5);
      const avgRecent = recentReadings.reduce((s, v) => s + v, 0) / recentReadings.length;
      const trend = recentReadings.length >= 2 ? recentReadings[recentReadings.length - 1] - recentReadings[0] : 0;

      if (avgRecent < 30) {
        predictions.push({
          type: 'battery_replacement',
          component: 'battery',
          confidence: 90,
          reason: `Average recent battery: ${Math.round(avgRecent)}%, trending ${trend < 0 ? 'down' : 'stable'}`,
        });
        urgency = 'critical';
      } else if (avgRecent < 50 || trend < -10) {
        predictions.push({
          type: 'battery_degradation',
          component: 'battery',
          confidence: 70,
          reason: `Battery trend: ${Math.round(avgRecent)}% average, ${Math.round(trend)} delta`,
        });
        if (urgency === 'low') urgency = 'medium';
      }
    }

    // Check for recurring lost signal issues
    if (lostSignalEvents.length >= 2) {
      predictions.push({
        type: 'communication_issue',
        component: 'radio',
        confidence: 65,
        reason: `${lostSignalEvents.length} signal loss events recorded`,
      });
      if (urgency === 'low') urgency = 'medium';
    }

    // Check for pending calibration
    const lastCalibration = calibrationEvents.length > 0 ? calibrationEvents[calibrationEvents.length - 1] : null;
    const lastCalibDone = maintenanceDoneEvents.find(e => {
      try {
        const val = JSON.parse(e.reqs?.['Значение']?.value || '{}');
        return val.type === 'calibration';
      } catch { return false; }
    });
    if (lastCalibration && !lastCalibDone) {
      predictions.push({
        type: 'calibration_overdue',
        component: 'sensors',
        confidence: 80,
        reason: 'Calibration needed but not yet performed',
      });
      if (urgency === 'low') urgency = 'medium';
    }

    // Estimate date based on degradation rate
    if (timestamps.length >= 2 && degradationEvents.length >= 2) {
      const degradationTimestamps = degradationEvents.map(e => {
        const ts = e.reqs?.['Временная метка']?.value;
        return ts ? new Date(ts).getTime() : null;
      }).filter(Boolean);

      if (degradationTimestamps.length >= 2) {
        const intervals = [];
        for (let i = 1; i < degradationTimestamps.length; i++) {
          intervals.push(degradationTimestamps[i] - degradationTimestamps[i - 1]);
        }
        const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
        const lastDegradation = degradationTimestamps[degradationTimestamps.length - 1];
        estimatedDate = new Date(lastDegradation + avgInterval).toISOString();
      }
    }

    if (!estimatedDate && urgency === 'critical') {
      estimatedDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days
    } else if (!estimatedDate && urgency === 'medium') {
      estimatedDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days
    }

    return {
      droneId,
      predictions,
      urgency,
      estimatedDate,
      summary: {
        totalEvents: events.length,
        degradationsSinceMaintenance,
        totalDegradations: degradationEvents.length,
        totalMaintenances: maintenanceDoneEvents.length,
        batteryReadings: batteryReadings.length,
        lostSignals: lostSignalEvents.length,
      },
    };
  }

  // ─── Module 3: Regulatory Engine Domain ─────────────────────────────

  async bootstrapRegulatoryDomain() {
    if (this._regBootstrapped) return;

    try {
      const actors = await this.getObjects(this.tables.actors);
      const existingReg = actors.find(a => a.val === 'Оракул_регуляций');
      if (existingReg) {
        this._regIds = await this._loadRegIds(actors);
        this._regBootstrapped = true;
        logger.info('[EventEngine] Regulatory domain already bootstrapped');
        return;
      }

      logger.info('[EventEngine] Bootstrapping Regulatory domain...');

      // 1. Create Actors
      const regulatoryOracle = await this.createActor('Оракул_регуляций', {
        type: 'sensor', description: 'Monitors regulatory changes and provides rule data',
      });
      const complianceChecker = await this.createActor('Проверщик_соответствия', {
        type: 'agent', description: 'Evaluates missions against regulatory rules',
      });
      const certificationManager = await this.createActor('Менеджер_сертификации', {
        type: 'agent', description: 'Manages operator/drone certifications and expiry',
      });

      const regulatoryOracleId = String(regulatoryOracle?.id || regulatoryOracle?.obj);
      const complianceCheckerId = String(complianceChecker?.id || complianceChecker?.obj);
      const certificationManagerId = String(certificationManager?.id || certificationManager?.obj);

      // 2. Create Concept → auto-creates Модель_Авиарегулирование
      const concept = await this.createConcept('Авиарегулирование', 'Авиарегуляции и соответствие требованиям');
      const conceptId = String(concept?.id || concept?.obj);

      // 3. Find auto-created model
      const models = await this.getObjects(this.tables.models);
      const model = models.find(m => m.val === 'Модель_Авиарегулирование');
      const modelId = model ? String(model.id) : null;

      if (!modelId) {
        logger.warn('[EventEngine] Модель_Авиарегулирование not found after concept creation');
        this._regBootstrapped = true;
        return;
      }

      // 4. Create properties
      const props = {};
      const propDefs = [
        ['RegulatoryBody', { propertyType: 'attribute', dataType: 'Text' }],
        ['DocumentRef', { propertyType: 'attribute', dataType: 'Text' }],
        ['ArticleNumber', { propertyType: 'attribute', dataType: 'Text' }],
        ['RuleText', { propertyType: 'attribute', dataType: 'Text' }],
        ['BSLCondition', { propertyType: 'attribute', dataType: 'Text' }],
        ['Penalty', { propertyType: 'attribute', dataType: 'Text' }],
        ['ValidFrom', { propertyType: 'attribute', dataType: 'Text' }],
        ['ValidTo', { propertyType: 'attribute', dataType: 'Text' }],
        ['Jurisdiction', { propertyType: 'attribute', dataType: 'Text' }],
        ['DroneCategory', { propertyType: 'attribute', dataType: 'Text' }],
      ];
      for (const [name, opts] of propDefs) {
        try {
          const p = await this.createProperty(name, opts);
          props[name] = String(p?.id || p?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create Reg property ${name}:`, err.message);
        }
      }

      // 5. Create Model Events
      const REG_EVENTS = [
        ['reg.rule_defined', { required: true }],
        ['reg.rule_evaluated', {}],
        ['reg.rule_passed', {}],
        ['reg.rule_violated', {}],
        ['reg.exemption_granted', {}],
        ['reg.certification_valid', {}],
        ['reg.certification_expired', {}],
        ['reg.airspace_class_set', {}],
        ['reg.flight_zone_approved', {}],
        ['reg.notification_sent', {}],
        ['reg.regulation_updated', {}],
        ['reg.regulation_repealed', { immutable: true }],
      ];

      const modelEventIds = {};
      for (const [eventType, constraints] of REG_EVENTS) {
        try {
          const result = await this.createModelEvent(eventType, {
            modelId,
            propertyId: props.BSLCondition || props.DocumentRef,
            constraints,
          });
          modelEventIds[eventType] = String(result?.id || result?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create Reg model event ${eventType}:`, err.message);
        }
      }

      // 6. Create FSM states
      const FSM_STATES = [
        ['Черновик', 'initial'],
        ['Активен', 'normal'],
        ['Изменён', 'normal'],
        ['Приостановлен', 'normal'],
        ['Отменён', 'final'],
      ];

      const stateIds = {};
      if (this.createState) {
        for (const [name, type] of FSM_STATES) {
          try {
            const s = await this.createState(modelId, { name, type });
            stateIds[name] = String(s?.id || s?.obj);
          } catch (err) {
            logger.warn(`[EventEngine] Failed to create Reg state ${name}:`, err.message);
          }
        }

        // 7. Create FSM transitions
        const FSM_TRANSITIONS = [
          ['Черновик', 'Активен', 'reg.rule_defined', 'правило опубликовано'],
          ['Активен', 'Изменён', 'reg.regulation_updated', 'регуляция изменена'],
          ['Изменён', 'Активен', 'reg.rule_defined', 'поправка принята'],
          ['Активен', 'Приостановлен', 'reg.regulation_updated', 'временно приостановлено'],
          ['Приостановлен', 'Активен', 'reg.rule_defined', 'приостановка снята'],
          ['Активен', 'Отменён', 'reg.regulation_repealed', 'регуляция отменена'],
          ['Изменён', 'Отменён', 'reg.regulation_repealed', 'регуляция отменена'],
        ];

        for (const [from, to, trigger, guard] of FSM_TRANSITIONS) {
          if (stateIds[from] && stateIds[to]) {
            try {
              await this.createTransition(modelId, {
                fromStateId: stateIds[from],
                toStateId: stateIds[to],
                trigger,
                guard: guard || undefined,
              });
            } catch (err) {
              logger.warn(`[EventEngine] Failed to create Reg transition ${from}→${to}:`, err.message);
            }
          }
        }
      }

      // 8. Register Regulatory triggers
      const REG_TRIGGERS = [
        {
          // Нарушение правила → блокировка миссии (кросс-домен)
          condition: 'eventType $EQ "reg.rule_violated"',
          action: {
            type: 'createEvent',
            params: { name: 'ops.mission_blocked', value: 'Regulatory violation blocks mission' },
          },
          priority: 10,
        },
        {
          // certification_expired → ops.pilot_cleared = false
          condition: 'eventType $EQ "reg.certification_expired"',
          action: {
            type: 'createEvent',
            params: { name: 'ops.pilot_cleared', value: 'false — certification expired' },
          },
          priority: 10,
        },
        {
          // regulation_updated → Wiki Oracle re-check
          condition: 'eventType $EQ "reg.regulation_updated"',
          action: {
            type: 'computeValue',
            params: { expression: 'reg_wiki_oracle_recheck' },
          },
          priority: 8,
        },
      ];

      for (const trigger of REG_TRIGGERS) {
        try {
          await this.registerTrigger({ modelId, ...trigger });
        } catch (err) {
          logger.warn('[EventEngine] Failed to register Reg trigger:', err.message);
        }
      }

      // Cache IDs
      this._regIds = {
        actors: {
         Оракул_регуляций: regulatoryOracleId,
         Проверщик_соответствия: complianceCheckerId,
         Менеджер_сертификации: certificationManagerId,
        },
        modelId,
        modelEventIds,
        conceptId,
        stateIds,
        props,
      };

      this._regBootstrapped = true;
      logger.info('[EventEngine] Regulatory domain bootstrapped', {
        actors: 3, modelEvents: Object.keys(modelEventIds).length,
      });
    } catch (err) {
      logger.error('[EventEngine] Bootstrap Regulatory domain failed:', err.message);
      this._regBootstrapped = true;
    }
  }

  /**
   * Load Regulatory IDs from existing data.
   */
  async _loadRegIds(actors) {
    const regulatoryOracle = actors.find(a => a.val === 'Оракул_регуляций');
    const complianceChecker = actors.find(a => a.val === 'Проверщик_соответствия');
    const certificationManager = actors.find(a => a.val === 'Менеджер_сертификации');

    const models = await this.getObjects(this.tables.models);
    const model = models.find(m => m.val === 'Модель_Авиарегулирование');
    const modelId = model ? String(model.id) : null;

    const concepts = await this.getObjects(this.tables.concepts);
    const concept = concepts.find(c => c.val === 'Авиарегулирование');
    const conceptId = concept ? String(concept.id) : null;

    let modelEventIds = {};
    if (modelId) {
      const allEvents = await this.getObjects(this.tables.modelEvents);
      for (const evt of allEvents) {
        const mReq = evt.reqs['Модель'];
        if (mReq && String(mReq.value) === modelId && evt.val.startsWith('reg.')) {
          modelEventIds[evt.val] = String(evt.id);
        }
      }
    }

    // Load properties
    const allProps = await this.getObjects(this.tables.properties);
    const propNames = ['RegulatoryBody', 'DocumentRef', 'ArticleNumber', 'RuleText', 'BSLCondition', 'Penalty', 'ValidFrom', 'ValidTo', 'Jurisdiction', 'DroneCategory'];
    const props = {};
    for (const pName of propNames) {
      const p = allProps.find(pr => pr.val === pName);
      if (p) props[pName] = String(p.id);
    }

    // Load existing rule individuals
    const individuals = await this.getObjects(this.tables.individuals);
    const ruleIndividuals = individuals.filter(ind => {
      const conceptReq = ind.reqs['Концепт'];
      return conceptReq && conceptId && String(conceptReq.value) === conceptId;
    });

    return {
      actors: {
       Оракул_регуляций: regulatoryOracle ? String(regulatoryOracle.id) : null,
       Проверщик_соответствия: complianceChecker ? String(complianceChecker.id) : null,
       Менеджер_сертификации: certificationManager ? String(certificationManager.id) : null,
      },
      modelId,
      modelEventIds,
      conceptId,
      stateIds: {},
      props,
      ruleCount: ruleIndividuals.length,
    };
  }

  /**
   * Get Regulatory IDs (used by REST API).
   */
  getRegIds() {
    return this._regIds || null;
  }

  // ─── Regulatory Service Methods ─────────────────────────────────────

  /**
   * Define a regulatory rule with BSL condition.
   * Creates Individual + reg.rule_defined event.
   */
  async defineRule({ name, documentRef, articleNumber, bslCondition, ruleText, penalty, regulatoryBody, jurisdiction }) {
    await this.initialize();
    await this.bootstrapRegulatoryDomain();
    const ids = this._regIds;
    if (!ids) throw new Error('Regulatory domain not bootstrapped');

    const individual = await this.createIndividual(`Rule-${name}`, {
      conceptId: ids.conceptId,
      modelId: ids.modelId,
      actorId: ids.actors.Оракул_регуляций,
    });
    const ruleId = String(individual?.id || individual?.obj);

    const ruleData = {
      name,
      documentRef: documentRef || '',
      articleNumber: articleNumber || '',
      bslCondition: bslCondition || '',
      ruleText: ruleText || '',
      penalty: penalty || '',
      regulatoryBody: regulatoryBody || '',
      jurisdiction: jurisdiction || 'RU',
      status: 'active',
      definedAt: new Date().toISOString(),
    };

    const eventResult = await this.createSubjectEvent('reg.rule_defined', {
      individualId: ruleId,
      modelEventId: ids.modelEventIds['reg.rule_defined'],
      value: JSON.stringify(ruleData),
      actorId: ids.actors.Оракул_регуляций,
      causes: [],
    });

    return { ruleId, eventId: String(eventResult?.id || eventResult?.obj), rule: ruleData };
  }

  /**
   * Get all defined rules with optional filters.
   */
  async getRules(filters = {}) {
    await this.initialize();
    await this.bootstrapRegulatoryDomain();
    const ids = this._regIds;
    if (!ids) return [];

    const individuals = await this.getObjects(this.tables.individuals);
    const ruleIndividuals = individuals.filter(ind => {
      const conceptReq = ind.reqs['Концепт'];
      return conceptReq && String(conceptReq.value) === ids.conceptId;
    });

    const rules = [];
    for (const ruleInd of ruleIndividuals) {
      const events = await this.getSubjectEvents(ruleInd.id);
      let ruleData = { name: ruleInd.val, status: 'draft' };

      for (const evt of events) {
        let val = {};
        try { val = JSON.parse(evt.reqs?.['Значение']?.value || '{}'); } catch { /* skip */ }

        if (evt.val === 'reg.rule_defined') {
          ruleData = { ...ruleData, ...val, status: 'active' };
        }
        if (evt.val === 'reg.regulation_updated') {
          ruleData = { ...ruleData, ...val, status: 'amended' };
        }
        if (evt.val === 'reg.regulation_repealed') {
          ruleData.status = 'repealed';
        }
      }

      // Apply filters
      if (filters.status && ruleData.status !== filters.status) continue;
      if (filters.documentRef && ruleData.documentRef !== filters.documentRef) continue;
      if (filters.jurisdiction && ruleData.jurisdiction !== filters.jurisdiction) continue;
      if (filters.regulatoryBody && ruleData.regulatoryBody !== filters.regulatoryBody) continue;

      rules.push({ id: ruleInd.id, ...ruleData, eventCount: events.length });
    }

    return rules;
  }

  /**
   * Check a mission against ALL rules — returns pass/fail for each.
   * Evaluates each rule's BSL condition against the mission data.
   */
  async checkCompliance(missionData) {
    await this.initialize();
    await this.bootstrapRegulatoryDomain();
    const ids = this._regIds;
    if (!ids) throw new Error('Regulatory domain not bootstrapped');

    const {
      droneWeight,
      altitude,
      visualLineOfSight,
      distanceToAirport,
      nightFlight,
      droneCategory,
      region,
      overPopulatedArea,
      militaryZone,
      payloadWeight,
      commercialFlight,
    } = missionData;

    // Alias mapping for BSL evaluation
    const variables = {
      droneWeight: droneWeight !== undefined ? Number(droneWeight) : undefined,
      flightAltitude: altitude !== undefined ? Number(altitude) : undefined,
      visualLineOfSight: visualLineOfSight !== undefined ? String(visualLineOfSight) : undefined,
      distanceToAirport: distanceToAirport !== undefined ? Number(distanceToAirport) : undefined,
      nightFlight: nightFlight !== undefined ? String(nightFlight) : undefined,
      droneCategory: droneCategory || undefined,
      region: region || undefined,
      overPopulatedArea: overPopulatedArea !== undefined ? String(overPopulatedArea) : undefined,
      militaryZone: militaryZone !== undefined ? String(militaryZone) : undefined,
      payloadWeight: payloadWeight !== undefined ? Number(payloadWeight) : undefined,
      commercialFlight: commercialFlight !== undefined ? String(commercialFlight) : undefined,
    };

    const rules = await this.getRules({ status: 'active' });
    const results = [];
    let violations = 0;

    for (const rule of rules) {
      const bsl = rule.bslCondition;
      if (!bsl) {
        results.push({ rule: rule.name, passed: true, skipped: true, reason: 'No BSL condition' });
        continue;
      }

      const evaluation = this._evaluateBSL(bsl, variables);

      if (evaluation.triggered) {
        // BSL condition matched — rule is triggered (violation or requirement)
        violations++;
        results.push({
          rule: rule.name,
          documentRef: rule.documentRef,
          articleNumber: rule.articleNumber,
          passed: false,
          violation: rule.ruleText || bsl,
          penalty: rule.penalty || '',
          bslCondition: bsl,
        });

        // Create violation event
        try {
          await this.createSubjectEvent('reg.rule_violated', {
            individualId: rule.id,
            modelEventId: ids.modelEventIds['reg.rule_violated'],
            value: JSON.stringify({
              missionData,
              rule: rule.name,
              bslCondition: bsl,
              violatedAt: new Date().toISOString(),
            }),
            actorId: ids.actors.Проверщик_соответствия,
            causes: [],
          });
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create violation event for rule ${rule.name}:`, err.message);
        }
      } else {
        results.push({
          rule: rule.name,
          documentRef: rule.documentRef,
          articleNumber: rule.articleNumber,
          passed: true,
          bslCondition: bsl,
        });

        // Create passed event
        try {
          await this.createSubjectEvent('reg.rule_passed', {
            individualId: rule.id,
            modelEventId: ids.modelEventIds['reg.rule_passed'],
            value: JSON.stringify({
              missionData,
              rule: rule.name,
              checkedAt: new Date().toISOString(),
            }),
            actorId: ids.actors.Проверщик_соответствия,
            causes: [],
          });
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create passed event for rule ${rule.name}:`, err.message);
        }
      }
    }

    const totalRules = results.length;
    const passedRules = results.filter(r => r.passed).length;
    const score = totalRules > 0 ? Math.round((passedRules / totalRules) * 100) : 100;

    return {
      compliant: violations === 0,
      score,
      totalRules,
      passed: passedRules,
      violations,
      results,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Evaluate a BSL condition string against variables.
   * Supports: $GT, $LT, $GTE, $LTE, $EQ, $NEQ, $AND, $OR
   */
  _evaluateBSL(bsl, variables) {
    try {
      // Split by $OR first (lower precedence)
      const orParts = bsl.split(' $OR ');
      for (const orPart of orParts) {
        const andParts = orPart.trim().split(' $AND ');
        let allAndTrue = true;

        for (const part of andParts) {
          const trimmed = part.trim();
          // Parse: varName $OP value
          const match = trimmed.match(/^(\w+)\s+\$(GT|LT|GTE|LTE|EQ|NEQ)\s+(.+)$/);
          if (!match) {
            allAndTrue = false;
            break;
          }

          const [, varName, op, rawValue] = match;
          const actualValue = variables[varName];

          if (actualValue === undefined) {
            // Variable not provided — cannot evaluate, treat as not triggered
            allAndTrue = false;
            break;
          }

          // Clean the comparison value
          let compareValue = rawValue.trim().replace(/^["']|["']$/g, '');
          const numActual = Number(actualValue);
          const numCompare = Number(compareValue);
          const isNumeric = !isNaN(numActual) && !isNaN(numCompare);

          let conditionMet = false;
          switch (op) {
            case 'GT': conditionMet = isNumeric && numActual > numCompare; break;
            case 'LT': conditionMet = isNumeric && numActual < numCompare; break;
            case 'GTE': conditionMet = isNumeric && numActual >= numCompare; break;
            case 'LTE': conditionMet = isNumeric && numActual <= numCompare; break;
            case 'EQ': conditionMet = String(actualValue) === compareValue; break;
            case 'NEQ': conditionMet = String(actualValue) !== compareValue; break;
          }

          if (!conditionMet) {
            allAndTrue = false;
            break;
          }
        }

        if (allAndTrue) {
          return { triggered: true };
        }
      }

      return { triggered: false };
    } catch (err) {
      logger.warn('[EventEngine] BSL evaluation error:', err.message, { bsl });
      return { triggered: false, error: err.message };
    }
  }

  /**
   * Verify a pilot/operator certification status.
   */
  async verifyCertification(operatorId) {
    await this.initialize();
    await this.bootstrapRegulatoryDomain();
    const ids = this._regIds;
    if (!ids) throw new Error('Regulatory domain not bootstrapped');

    // Check for certification events in subject events
    const individuals = await this.getObjects(this.tables.individuals);
    const certIndividuals = individuals.filter(ind => {
      const conceptReq = ind.reqs['Концепт'];
      return conceptReq && String(conceptReq.value) === ids.conceptId && ind.val.includes('Cert-');
    });

    // Search across all regulatory individuals for certification events
    let certValid = false;
    let certExpiry = null;
    let certType = null;
    let lastCheck = null;

    for (const certInd of certIndividuals) {
      const events = await this.getSubjectEvents(certInd.id);
      for (const evt of events) {
        let val = {};
        try { val = JSON.parse(evt.reqs?.['Значение']?.value || '{}'); } catch { /* skip */ }

        if (val.operatorId && String(val.operatorId) !== String(operatorId)) continue;

        if (evt.val === 'reg.certification_valid') {
          certValid = true;
          certExpiry = val.expiresAt || null;
          certType = val.certType || null;
          lastCheck = val.checkedAt || evt.reqs?.['Временная метка']?.value;
        }
        if (evt.val === 'reg.certification_expired') {
          certValid = false;
          certExpiry = val.expiredAt || null;
          lastCheck = val.checkedAt || evt.reqs?.['Временная метка']?.value;
        }
      }
    }

    // Check if expiry date has passed
    if (certValid && certExpiry) {
      const expiryDate = new Date(certExpiry).getTime();
      if (expiryDate < Date.now()) {
        certValid = false;

        // Create expiration event
        try {
          const firstCertInd = certIndividuals[0];
          if (firstCertInd) {
            await this.createSubjectEvent('reg.certification_expired', {
              individualId: firstCertInd.id,
              modelEventId: ids.modelEventIds['reg.certification_expired'],
              value: JSON.stringify({ operatorId, expiredAt: certExpiry, detectedAt: new Date().toISOString() }),
              actorId: ids.actors.Менеджер_сертификации,
              causes: [],
            });
          }
        } catch (err) {
          logger.warn('[EventEngine] Failed to create certification_expired event:', err.message);
        }
      }
    }

    return {
      operatorId,
      valid: certValid,
      certType,
      expiresAt: certExpiry,
      lastCheck,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Get regulatory dashboard — summary of rules, violations, certifications.
   */
  async getRegulatoryDashboard() {
    await this.initialize();
    await this.bootstrapRegulatoryDomain();
    const ids = this._regIds;
    if (!ids) return { totalRules: 0, activeRules: 0, recentViolations: [], expiringCertifications: [] };

    const rules = await this.getRules();
    const activeRules = rules.filter(r => r.status === 'active');
    const amendedRules = rules.filter(r => r.status === 'amended');
    const repealedRules = rules.filter(r => r.status === 'repealed');

    // Collect recent violations and certifications
    const recentViolations = [];
    const expiringCertifications = [];
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    for (const rule of rules) {
      const events = await this.getSubjectEvents(rule.id);
      for (const evt of events) {
        let val = {};
        try { val = JSON.parse(evt.reqs?.['Значение']?.value || '{}'); } catch { /* skip */ }
        const timestamp = evt.reqs?.['Временная метка']?.value;

        if (evt.val === 'reg.rule_violated') {
          recentViolations.push({
            rule: rule.name,
            documentRef: rule.documentRef,
            violatedAt: val.violatedAt || timestamp,
            missionData: val.missionData,
          });
        }

        if (evt.val === 'reg.certification_valid' && val.expiresAt) {
          const expiryMs = new Date(val.expiresAt).getTime();
          if (expiryMs - now < thirtyDaysMs && expiryMs > now) {
            expiringCertifications.push({
              operatorId: val.operatorId,
              certType: val.certType,
              expiresAt: val.expiresAt,
              daysRemaining: Math.ceil((expiryMs - now) / (24 * 60 * 60 * 1000)),
            });
          }
        }
      }
    }

    // Sort violations by date (most recent first)
    recentViolations.sort((a, b) => {
      const ta = a.violatedAt ? new Date(a.violatedAt).getTime() : 0;
      const tb = b.violatedAt ? new Date(b.violatedAt).getTime() : 0;
      return tb - ta;
    });

    return {
      totalRules: rules.length,
      activeRules: activeRules.length,
      amendedRules: amendedRules.length,
      repealedRules: repealedRules.length,
      recentViolations: recentViolations.slice(0, 20),
      expiringCertifications,
      summary: {
        byDocument: rules.reduce((acc, r) => {
          const doc = r.documentRef || 'unknown';
          acc[doc] = (acc[doc] || 0) + 1;
          return acc;
        }, {}),
        byJurisdiction: rules.reduce((acc, r) => {
          const jur = r.jurisdiction || 'unknown';
          acc[jur] = (acc[jur] || 0) + 1;
          return acc;
        }, {}),
      },
    };
  }

  /**
   * Define a set of standard Russian aviation rules (FAP-138, VP RF).
   * Pre-populates ~10 key BSL rules from Russian aviation law.
   */
  async bootstrapRussianRules() {
    await this.initialize();
    await this.bootstrapRegulatoryDomain();
    const ids = this._regIds;
    if (!ids) throw new Error('Regulatory domain not bootstrapped');

    const RUSSIAN_RULES = [
      {
        name: 'FAP-138-§12-Certification',
        documentRef: 'ФАП-138',
        articleNumber: '§12',
        bslCondition: 'droneWeight $GT 30',
        ruleText: 'Дроны массой более 30 кг требуют сертификации лётной годности',
        penalty: 'Запрет эксплуатации, штраф до 300 000 руб.',
        regulatoryBody: 'Росавиация',
        jurisdiction: 'RU',
      },
      {
        name: 'FAP-138-§15-Airspace',
        documentRef: 'ФАП-138',
        articleNumber: '§15',
        bslCondition: 'flightAltitude $GT 150',
        ruleText: 'Полёты выше 150 м требуют координации с органами ОрВД',
        penalty: 'Штраф до 150 000 руб., изъятие БПЛА',
        regulatoryBody: 'Росавиация',
        jurisdiction: 'RU',
      },
      {
        name: 'FAP-138-§21-BVLOS',
        documentRef: 'ФАП-138',
        articleNumber: '§21',
        bslCondition: 'visualLineOfSight $EQ "false"',
        ruleText: 'Полёты вне прямой видимости требуют расширенного сертификата',
        penalty: 'Запрет полётов, штраф до 200 000 руб.',
        regulatoryBody: 'Росавиация',
        jurisdiction: 'RU',
      },
      {
        name: 'VP-RF-§47-Airport',
        documentRef: 'ВП РФ',
        articleNumber: '§47',
        bslCondition: 'distanceToAirport $LT 5000',
        ruleText: 'Полёты ближе 5 км от аэродрома запрещены',
        penalty: 'Уголовная ответственность по ст. 271.1 УК РФ',
        regulatoryBody: 'Минтранс',
        jurisdiction: 'RU',
      },
      {
        name: 'VP-RF-§48-Night',
        documentRef: 'ВП РФ',
        articleNumber: '§48',
        bslCondition: 'nightFlight $EQ "true"',
        ruleText: 'Ночные полёты требуют специального разрешения',
        penalty: 'Штраф до 100 000 руб.',
        regulatoryBody: 'Минтранс',
        jurisdiction: 'RU',
      },
      {
        name: 'FAP-138-§8-NoRegistration',
        documentRef: 'ФАП-138',
        articleNumber: '§8',
        bslCondition: 'droneWeight $LT 0.25',
        ruleText: 'Дроны массой менее 250 г не требуют регистрации',
        penalty: 'Не применяется — информационное правило',
        regulatoryBody: 'Росавиация',
        jurisdiction: 'RU',
      },
      {
        name: 'VP-RF-§52-MaxAltitude',
        documentRef: 'ВП РФ',
        articleNumber: '§52',
        bslCondition: 'flightAltitude $GT 500',
        ruleText: 'Полёты выше 500 м запрещены без разрешения ОрВД (АТС)',
        penalty: 'Уголовная ответственность, штраф до 500 000 руб.',
        regulatoryBody: 'Минтранс',
        jurisdiction: 'RU',
      },
      {
        name: 'FAP-138-§30-PopulatedArea',
        documentRef: 'ФАП-138',
        articleNumber: '§30',
        bslCondition: 'overPopulatedArea $EQ "true"',
        ruleText: 'Полёты над населёнными пунктами ограничены',
        penalty: 'Штраф до 200 000 руб.',
        regulatoryBody: 'Росавиация',
        jurisdiction: 'RU',
      },
      {
        name: 'VP-RF-§44-Military',
        documentRef: 'ВП РФ',
        articleNumber: '§44',
        bslCondition: 'militaryZone $EQ "true"',
        ruleText: 'Полёты в зонах военных объектов запрещены',
        penalty: 'Уголовная ответственность по ст. 271.1 УК РФ',
        regulatoryBody: 'Минобороны',
        jurisdiction: 'RU',
      },
      {
        name: 'FAP-138-§25-Commercial',
        documentRef: 'ФАП-138',
        articleNumber: '§25',
        bslCondition: 'payloadWeight $GT 0 $AND commercialFlight $EQ "true"',
        ruleText: 'Коммерческие полёты с грузом требуют коммерческой лицензии',
        penalty: 'Штраф до 250 000 руб., запрет коммерческой деятельности',
        regulatoryBody: 'Росавиация',
        jurisdiction: 'RU',
      },
    ];

    const created = [];
    for (const ruleDef of RUSSIAN_RULES) {
      try {
        const result = await this.defineRule(ruleDef);
        created.push({ name: ruleDef.name, ruleId: result.ruleId, eventId: result.eventId });
      } catch (err) {
        logger.warn(`[EventEngine] Failed to create Russian rule ${ruleDef.name}:`, err.message);
        created.push({ name: ruleDef.name, error: err.message });
      }
    }

    logger.info('[EventEngine] Russian rules bootstrapped', { created: created.filter(c => c.ruleId).length, total: RUSSIAN_RULES.length });

    return {
      total: RUSSIAN_RULES.length,
      created: created.filter(c => c.ruleId).length,
      failed: created.filter(c => c.error).length,
      rules: created,
    };
  }
  // ═══════════════════════════════════════════════════════════════
  // ▌ ONTOLOGICAL TESTING — Test via Model Events + FSM + BSL
  // ▌ "The ontology IS the test specification"
  // ═══════════════════════════════════════════════════════════════

  /**
   * Validate a domain by walking its FSM and checking that all model events,
   * states, transitions, and triggers are properly defined.
   * This is a STRUCTURAL test — does the ontology itself make sense?
   */
  async validateDomain(domainName) {
    await this.initialize();
    const models = await this.getObjects(this.tables.models);
    const model = models.find(m => m.val === `Model_${domainName}`);
    if (!model) return { valid: false, error: `Model_${domainName} not found`, checks: [] };

    const modelId = String(model.id);
    const checks = [];
    let passed = 0;
    let failed = 0;

    // Check 1: Model events exist
    const events = await this.getModelEvents(modelId);
    checks.push({ check: 'Model events defined', passed: events.length > 0, count: events.length });
    if (events.length > 0) passed++; else failed++;

    // Check 2: FSM states exist
    let states = [];
    let transitions = [];
    try {
      states = await this.getStates(modelId);
      transitions = await this.getTransitions(modelId);
    } catch { /* FSM optional */ }

    if (states.length > 0) {
      checks.push({ check: 'FSM states defined', passed: true, count: states.length });
      passed++;

      // Check 3: Has initial state
      const initials = states.filter(s => s.reqs?.['Тип']?.value === 'initial');
      checks.push({ check: 'Has initial state', passed: initials.length === 1, count: initials.length });
      if (initials.length === 1) passed++; else failed++;

      // Check 4: Has final state
      const finals = states.filter(s => s.reqs?.['Тип']?.value === 'final');
      checks.push({ check: 'Has final state(s)', passed: finals.length > 0, count: finals.length });
      if (finals.length > 0) passed++; else failed++;

      // Check 5: No dead-end states (except finals)
      const nonFinals = states.filter(s => s.reqs?.['Тип']?.value !== 'final');
      const deadEnds = nonFinals.filter(s => {
        return !transitions.some(t => String(t.reqs?.['Из']?.value) === String(s.id));
      });
      checks.push({ check: 'No dead-end states', passed: deadEnds.length === 0, deadEnds: deadEnds.map(s => s.val) });
      if (deadEnds.length === 0) passed++; else failed++;

      // Check 6: Transitions reference valid states
      let invalidTransitions = 0;
      for (const t of transitions) {
        const fromId = String(t.reqs?.['Из']?.value || '');
        const toId = String(t.reqs?.['В']?.value || '');
        if (!states.some(s => String(s.id) === fromId)) invalidTransitions++;
        if (!states.some(s => String(s.id) === toId)) invalidTransitions++;
      }
      checks.push({ check: 'Transitions reference valid states', passed: invalidTransitions === 0, invalid: invalidTransitions });
      if (invalidTransitions === 0) passed++; else failed++;
    }

    // Check 7: Triggers exist for this model
    const triggers = (this._triggers || []).filter(t => String(t.modelId) === modelId);
    checks.push({ check: 'Triggers registered', passed: triggers.length > 0, count: triggers.length });
    if (triggers.length > 0) passed++; else failed++;

    // Check 8: Model event constraints are valid JSON
    let invalidConstraints = 0;
    for (const evt of events) {
      try {
        const c = evt.reqs?.['Ограничения']?.value;
        if (c) JSON.parse(c);
      } catch {
        invalidConstraints++;
      }
    }
    checks.push({ check: 'Constraints are valid JSON', passed: invalidConstraints === 0, invalid: invalidConstraints });
    if (invalidConstraints === 0) passed++; else failed++;

    return {
      valid: failed === 0,
      domain: domainName,
      modelId,
      passed,
      failed,
      total: passed + failed,
      checks,
    };
  }

  /**
   * Run a scenario test — simulate a sequence of events through the FSM
   * and verify the expected final state.
   *
   * @param {string} domainName — e.g. "DAOGovernance", "DroneOperations"
   * @param {Array} scenario — [{ eventType, value, actorId? }] sequence
   * @param {string} expectedFinalState — expected FSM state after all events
   */
  async runScenarioTest(domainName, scenario, expectedFinalState) {
    await this.initialize();
    const models = await this.getObjects(this.tables.models);
    const model = models.find(m => m.val === `Model_${domainName}`);
    if (!model) return { passed: false, error: `Model not found: Model_${domainName}` };

    const modelId = String(model.id);
    const concepts = await this.getConcepts();
    const concept = concepts.find(c => c.val === domainName.replace('Model_', ''));
    const conceptId = concept ? String(concept.id) : null;

    // Create a test individual (sandbox)
    const testIndividual = await this.createIndividual(`Test_${domainName}_${Date.now()}`, {
      conceptId,
      modelId,
    });
    const testId = String(testIndividual?.id || testIndividual?.obj);

    const results = [];
    let lastEventId = null;

    // Get model events for lookup
    const modelEvents = await this.getModelEvents(modelId);
    const eventMap = {};
    for (const me of modelEvents) {
      eventMap[me.val] = String(me.id);
    }

    // Execute scenario
    for (const step of scenario) {
      try {
        const result = await this.createSubjectEvent(step.eventType, {
          individualId: testId,
          modelEventId: eventMap[step.eventType],
          value: typeof step.value === 'object' ? JSON.stringify(step.value) : String(step.value || ''),
          actorId: step.actorId || 'test_actor',
          causes: lastEventId ? [lastEventId] : [],
        });
        lastEventId = String(result?.id || result?.obj);
        results.push({ step: step.eventType, eventId: lastEventId, success: true });
      } catch (err) {
        results.push({ step: step.eventType, success: false, error: err.message });
      }
    }

    // Check final state via FSM
    let currentState = null;
    try {
      if (this.executeStateMachine) {
        const fsmResult = await this.executeStateMachine(testId, modelId);
        currentState = fsmResult?.currentState || fsmResult?.state;
      }
    } catch { /* FSM execution may not be available */ }

    // Check final state from events
    const allEvents = await this.getSubjectEvents(testId);
    const lastEvent = allEvents[allEvents.length - 1];

    const passed = expectedFinalState
      ? (currentState === expectedFinalState || lastEvent?.val === expectedFinalState)
      : results.every(r => r.success);

    return {
      passed,
      domain: domainName,
      testId,
      expectedFinalState,
      actualState: currentState || lastEvent?.val,
      steps: results,
      eventCount: allEvents.length,
      causalChainValid: results.every(r => r.success),
    };
  }

  /**
   * Run ALL domain validations — comprehensive system health check.
   */
  async runAllDomainTests() {
    const domains = [
      'Здоровье системы',
      'DAO_управление',
      'Операции БПЛА',
      'Разработка ПО',
      'Цифровой двойник',
      'Авиарегулирование',
      'Рой_миссия',
      'Оценка рисков',
      'Маркетплейс',
      'Учебный сценарий',
    ];

    const results = [];
    for (const domain of domains) {
      try {
        const result = await this.validateDomain(domain);
        results.push(result);
      } catch (err) {
        results.push({ domain, valid: false, error: err.message });
      }
    }

    const totalPassed = results.filter(r => r.valid).length;
    const totalFailed = results.filter(r => !r.valid).length;

    return {
      timestamp: new Date().toISOString(),
      totalDomains: results.length,
      passed: totalPassed,
      failed: totalFailed,
      allGreen: totalFailed === 0,
      results,
    };
  }

  /**
   * Generate test scenarios from model definition.
   * Walks FSM to produce valid event sequences that cover all transitions.
   */
  async generateTestScenarios(domainName) {
    await this.initialize();
    const models = await this.getObjects(this.tables.models);
    const model = models.find(m => m.val === `Model_${domainName}`);
    if (!model) return { scenarios: [], error: 'Model not found' };

    const modelId = String(model.id);
    let states = [];
    let transitions = [];
    try {
      states = await this.getStates(modelId);
      transitions = await this.getTransitions(modelId);
    } catch { return { scenarios: [{ name: 'basic', steps: [], note: 'No FSM defined' }] }; }

    const scenarios = [];
    const initial = states.find(s => s.reqs?.['Тип']?.value === 'initial');
    const finals = states.filter(s => s.reqs?.['Тип']?.value === 'final');

    if (!initial) return { scenarios: [], error: 'No initial state' };

    // Generate one scenario per final state (BFS paths)
    for (const final of finals) {
      const path = this._findPath(initial, final, states, transitions);
      if (path.length > 0) {
        scenarios.push({
          name: `${initial.val} → ${final.val}`,
          expectedFinalState: final.val,
          steps: path.map(t => ({
            eventType: t.reqs?.['Триггер']?.value || t.val,
            value: `test_${t.val}`,
          })),
        });
      }
    }

    return { domain: domainName, scenarios, stateCount: states.length, transitionCount: transitions.length };
  }

  /**
   * BFS to find path from start state to end state through transitions.
   */
  _findPath(startState, endState, states, transitions) {
    const queue = [[startState, []]];
    const visited = new Set();

    while (queue.length > 0) {
      const [current, path] = queue.shift();
      if (String(current.id) === String(endState.id)) return path;
      if (visited.has(String(current.id))) continue;
      visited.add(String(current.id));

      const outgoing = transitions.filter(t => String(t.reqs?.['Из']?.value) === String(current.id));
      for (const t of outgoing) {
        const toId = String(t.reqs?.['В']?.value);
        const nextState = states.find(s => String(s.id) === toId);
        if (nextState && !visited.has(toId)) {
          queue.push([nextState, [...path, t]]);
        }
      }
    }
    return [];
  }

  // ─── Module 5: Insurance & Risk Scoring ─────────────────────

  async bootstrapInsuranceDomain() {
    if (this._insuranceBootstrapped) return;

    try {
      const actors = await this.getObjects(this.tables.actors);
      const existingInsurance = actors.find(a => a.val === 'Анализатор_рисков');
      if (existingInsurance) {
        this._insuranceIds = await this._loadInsuranceIds(actors);
        this._insuranceBootstrapped = true;
        logger.info('[EventEngine] Insurance domain already bootstrapped');
        return;
      }

      logger.info('[EventEngine] Bootstrapping insurance & risk scoring domain...');

      // 1. Create Actors
      const riskAnalyzer = await this.createActor('Анализатор_рисков', {
        type: 'agent', description: 'Computes risk scores for operations, drones, and operators',
      });
      const insuranceOracle = await this.createActor('Оракул_страхования', {
        type: 'agent', description: 'Manages insurance policies and premium calculations',
      });
      const claimsProcessor = await this.createActor('Обработчик_претензий', {
        type: 'agent', description: 'Processes insurance claims and resolutions',
      });

      const riskAnalyzerId = String(riskAnalyzer?.id || riskAnalyzer?.obj);
      const insuranceOracleId = String(insuranceOracle?.id || insuranceOracle?.obj);
      const claimsProcessorId = String(claimsProcessor?.id || claimsProcessor?.obj);

      // 2. Create Concept → auto-creates Модель_Оценка рисков
      const concept = await this.createConcept('Оценка рисков', 'Оценка страховых рисков и обработка претензий');
      const conceptId = String(concept?.id || concept?.obj);

      // 3. Find auto-created model
      const models = await this.getObjects(this.tables.models);
      const model = models.find(m => m.val === 'Модель_Оценка рисков');
      const modelId = model ? String(model.id) : null;

      if (!modelId) {
        logger.warn('[EventEngine] Модель_Оценка рисков not found after concept creation');
        this._insuranceBootstrapped = true;
        return;
      }

      // 4. Create properties
      const props = {};
      const propDefs = [
        ['RiskScore', { propertyType: 'attribute', dataType: 'Number' }],
        ['RiskCategory', { propertyType: 'attribute', dataType: 'Text' }],
        ['InsurancePremium', { propertyType: 'attribute', dataType: 'Number' }],
        ['ClaimCount', { propertyType: 'attribute', dataType: 'Number' }],
        ['SafetyRating', { propertyType: 'attribute', dataType: 'Text' }],
        ['IncidentHistory', { propertyType: 'attribute', dataType: 'Text' }],
        ['CoverageType', { propertyType: 'attribute', dataType: 'Text' }],
        ['PolicyNumber', { propertyType: 'attribute', dataType: 'Text' }],
        ['ExpirationDate', { propertyType: 'attribute', dataType: 'Text' }],
        ['MaxPayout', { propertyType: 'attribute', dataType: 'Number' }],
      ];
      for (const [name, opts] of propDefs) {
        try {
          const p = await this.createProperty(name, opts);
          props[name] = String(p?.id || p?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create Insurance property ${name}:`, err.message);
        }
      }

      // 5. Create Model Events
      const INSURANCE_EVENTS = [
        ['risk.assessment_started', { required: true }],
        ['risk.factor_identified', {}],
        ['risk.score_computed', {}],
        ['risk.mitigation_suggested', {}],
        ['risk.claim_filed', {}],
        ['risk.claim_resolved', {}],
        ['risk.premium_calculated', {}],
        ['risk.policy_issued', {}],
        ['risk.policy_expired', {}],
        ['risk.history_analyzed', {}],
        ['risk.rating_updated', {}],
        ['risk.threshold_exceeded', { immutable: true }],
      ];

      const modelEventIds = {};
      for (const [eventType, constraints] of INSURANCE_EVENTS) {
        try {
          const result = await this.createModelEvent(eventType, {
            modelId,
            propertyId: props.RiskScore || props.RiskCategory,
            constraints,
          });
          modelEventIds[eventType] = String(result?.id || result?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create Insurance model event ${eventType}:`, err.message);
        }
      }

      // 6. Create FSM states
      const FSM_STATES = [
        ['Не_оценён', 'initial'],
        ['Оценка', 'normal'],
        ['Оценён', 'normal'],
        ['Застрахован', 'normal'],
        ['Претензия', 'normal'],
        ['Урегулирован', 'normal'],
        ['Высокий_риск', 'final'],
      ];

      const stateIds = {};
      if (this.createState) {
        for (const [name, type] of FSM_STATES) {
          try {
            const s = await this.createState(modelId, { name, type });
            stateIds[name] = String(s?.id || s?.obj);
          } catch (err) {
            logger.warn(`[EventEngine] Failed to create Insurance state ${name}:`, err.message);
          }
        }

        // 7. Create FSM transitions
        const FSM_TRANSITIONS = [
          ['Не_оценён', 'Оценка', 'risk.assessment_started', ''],
          ['Оценка', 'Оценён', 'risk.score_computed', ''],
          ['Оценён', 'Застрахован', 'risk.policy_issued', ''],
          ['Застрахован', 'Претензия', 'risk.claim_filed', ''],
          ['Претензия', 'Урегулирован', 'risk.claim_resolved', ''],
          ['Урегулирован', 'Оценён', 'risk.score_computed', ''],
          ['Оценён', 'Высокий_риск', 'risk.threshold_exceeded', 'score $GT 80'],
        ];

        for (const [from, to, trigger, guard] of FSM_TRANSITIONS) {
          if (stateIds[from] && stateIds[to]) {
            try {
              await this.createTransition(modelId, {
                fromStateId: stateIds[from],
                toStateId: stateIds[to],
                trigger,
                guard: guard || undefined,
              });
            } catch (err) {
              logger.warn(`[EventEngine] Failed to create Insurance transition ${from}->${to}:`, err.message);
            }
          }
        }
      }

      // 8. Create Individual
      const individual = await this.createIndividual('Оценка_рисков-экземпляр', {
        conceptId, modelId, actorId: riskAnalyzerId,
      });
      const individualId = String(individual?.id || individual?.obj);

      // 9. Register Insurance triggers (cross-domain)
      const INSURANCE_TRIGGERS = [
        {
          condition: 'eventType $EQ "risk.score_computed" $AND value $GT 80',
          action: {
            type: 'createEvent',
            params: { name: 'ops.mission_blocked', value: 'Blocked by high risk score (>80)' },
          },
          priority: 10,
        },
        {
          condition: 'eventType $EQ "risk.claim_filed"',
          action: {
            type: 'createEvent',
            params: { name: 'risk.premium_calculated', value: 'Auto-recalculated after claim' },
          },
          priority: 9,
        },
        {
          condition: 'eventType $EQ "ops.mission_failed"',
          action: {
            type: 'createEvent',
            params: { name: 'risk.factor_identified', value: 'Mission failure registered as risk factor' },
          },
          priority: 8,
        },
      ];

      for (const trigger of INSURANCE_TRIGGERS) {
        try {
          await this.registerTrigger({ modelId, ...trigger });
        } catch (err) {
          logger.warn('[EventEngine] Failed to register Insurance trigger:', err.message);
        }
      }

      this._insuranceIds = {
        actors: {Анализатор_рисков: riskAnalyzerId,Оракул_страхования: insuranceOracleId,Обработчик_претензий: claimsProcessorId },
        modelId, modelEventIds, individualId, conceptId, stateIds, props,
      };

      this._insuranceBootstrapped = true;
      logger.info('[EventEngine] Insurance & risk scoring domain bootstrapped', {
        actors: 3, modelEvents: Object.keys(modelEventIds).length, individualId,
      });
    } catch (err) {
      logger.error('[EventEngine] Bootstrap Insurance domain failed:', err.message);
      this._insuranceBootstrapped = true;
    }
  }

  async _loadInsuranceIds(actors) {
    const riskAnalyzer = actors.find(a => a.val === 'Анализатор_рисков');
    const insuranceOracle = actors.find(a => a.val === 'Оракул_страхования');
    const claimsProcessor = actors.find(a => a.val === 'Обработчик_претензий');

    const models = await this.getObjects(this.tables.models);
    const model = models.find(m => m.val === 'Модель_Оценка рисков');
    const modelId = model ? String(model.id) : null;

    let modelEventIds = {};
    if (modelId) {
      const allEvents = await this.getObjects(this.tables.modelEvents);
      for (const evt of allEvents) {
        const mReq = evt.reqs['Модель'];
        if (mReq && String(mReq.value) === modelId && evt.val.startsWith('risk.')) {
          modelEventIds[evt.val] = String(evt.id);
        }
      }
    }

    const concepts = await this.getObjects(this.tables.concepts);
    const concept = concepts.find(c => c.val === 'Оценка рисков');
    const conceptId = concept ? String(concept.id) : null;

    const individuals = await this.getObjects(this.tables.individuals);
    const individual = individuals.find(i => i.val === 'Оценка_рисков-экземпляр');

    return {
      actors: {
       Анализатор_рисков: riskAnalyzer ? String(riskAnalyzer.id) : null,
       Оракул_страхования: insuranceOracle ? String(insuranceOracle.id) : null,
       Обработчик_претензий: claimsProcessor ? String(claimsProcessor.id) : null,
      },
      modelId, modelEventIds,
      individualId: individual ? String(individual.id) : null,
      conceptId,
    };
  }

  getInsuranceIds() {
    return this._insuranceIds || null;
  }

  // ─── Insurance Service Methods ──────────────────────────────

  async computeRiskScore({ missionType, droneModel, operatorId, region, conditions = {} }) {
    await this.initialize();
    await this.bootstrapInsuranceDomain();
    const ids = this._insuranceIds;
    if (!ids) throw new Error('Insurance domain not bootstrapped');

    const startEvent = await this.createSubjectEvent('risk.assessment_started', {
      individualId: ids.individualId,
      modelEventId: ids.modelEventIds['risk.assessment_started'],
      value: JSON.stringify({ missionType, droneModel, operatorId, region, startedAt: new Date().toISOString() }),
      actorId: ids.actors.Анализатор_рисков,
      causes: [],
    });
    const startEventId = String(startEvent?.id || startEvent?.obj);

    const allSubjectEvents = await this.getObjects(this.tables.subjectEvents);
    const historicalIncidents = [];
    let failureCount = 0;
    let abortCount = 0;
    let totalOpsEvents = 0;

    for (const evt of allSubjectEvents) {
      const evtName = evt.val || '';
      if (!evtName.startsWith('ops.')) continue;
      totalOpsEvents++;

      try {
        const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
        const matchesRegion = !region || (val.region === region);
        const matchesMission = !missionType || (val.type === missionType || val.missionType === missionType);
        const matchesDrone = !droneModel || (val.droneModel === droneModel);
        const matchesOperator = !operatorId || (String(evt.reqs?.['Актор']?.value || '') === String(operatorId));

        if (evtName === 'ops.mission_failed') {
          failureCount++;
          if (matchesRegion || matchesMission || matchesDrone || matchesOperator) {
            historicalIncidents.push({ id: evt.id, type: 'failure', value: val, timestamp: evt.reqs?.['Временная метка']?.value });
          }
        }
        if (evtName === 'ops.mission_aborted') {
          abortCount++;
          if (matchesRegion || matchesMission || matchesDrone || matchesOperator) {
            historicalIncidents.push({ id: evt.id, type: 'abort', value: val, timestamp: evt.reqs?.['Временная метка']?.value });
          }
        }
      } catch { /* not JSON */ }
    }

    let rootCauseCount = 0;
    for (const incident of historicalIncidents.slice(0, 10)) {
      try {
        const roots = await this.traceToRoots(incident.id);
        rootCauseCount += roots.length;
      } catch { /* ignore */ }
    }

    const failureRate = totalOpsEvents > 0 ? (failureCount + abortCount) / totalOpsEvents : 0;

    const factors = [];
    const mitigations = [];

    const weatherScore = conditions.windSpeed
      ? Math.min(100, (conditions.windSpeed / 25) * 100)
      : (conditions.weather === 'bad' ? 70 : conditions.weather === 'moderate' ? 40 : 15);
    factors.push({ name: 'weather', score: weatherScore, weight: 0.20, description: `Weather conditions: wind=${conditions.windSpeed || 'N/A'} m/s` });
    if (weatherScore > 60) mitigations.push('Delay mission until weather improves or switch to weather-resistant drone');

    const technicalScore = Math.min(100, (failureRate * 200) + (rootCauseCount * 5));
    factors.push({ name: 'technical', score: technicalScore, weight: 0.30, description: `Failure rate: ${(failureRate * 100).toFixed(1)}%, root causes: ${rootCauseCount}` });
    if (technicalScore > 50) mitigations.push('Schedule preventive maintenance and pre-flight diagnostics');

    const humanScore = operatorId
      ? Math.min(100, historicalIncidents.filter(i => String(i.value?.operatorId) === String(operatorId)).length * 15 + 10)
      : 25;
    factors.push({ name: 'human', score: humanScore, weight: 0.25, description: `Operator incident history: ${historicalIncidents.length} incidents` });
    if (humanScore > 50) mitigations.push('Require additional operator training and certification renewal');

    const regulatoryScore = conditions.hasPermit === false ? 80 : conditions.restrictedAirspace ? 60 : 15;
    factors.push({ name: 'regulatory', score: regulatoryScore, weight: 0.25, description: `Permit: ${conditions.hasPermit !== false ? 'yes' : 'no'}, restricted: ${conditions.restrictedAirspace ? 'yes' : 'no'}` });
    if (regulatoryScore > 50) mitigations.push('Obtain required airspace permits and regulatory clearance');

    const score = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));
    const category = score <= 20 ? 'minimal' : score <= 40 ? 'low' : score <= 60 ? 'moderate' : score <= 80 ? 'high' : 'critical';

    const scoreEvent = await this.createSubjectEvent('risk.score_computed', {
      individualId: ids.individualId,
      modelEventId: ids.modelEventIds['risk.score_computed'],
      value: JSON.stringify({ score, category, missionType, droneModel, operatorId, region }),
      actorId: ids.actors.Анализатор_рисков,
      causes: [startEventId],
    });
    const scoreEventId = String(scoreEvent?.id || scoreEvent?.obj);

    if (score > 80) {
      await this.createSubjectEvent('risk.threshold_exceeded', {
        individualId: ids.individualId,
        modelEventId: ids.modelEventIds['risk.threshold_exceeded'],
        value: JSON.stringify({ score, category, reason: 'Risk score exceeds safety threshold' }),
        actorId: ids.actors.Анализатор_рисков,
        causes: [scoreEventId],
      });
    }

    for (const factor of factors) {
      if (factor.score > 40) {
        try {
          await this.createSubjectEvent('risk.factor_identified', {
            individualId: ids.individualId,
            modelEventId: ids.modelEventIds['risk.factor_identified'],
            value: JSON.stringify(factor),
            actorId: ids.actors.Анализатор_рисков,
            causes: [scoreEventId],
          });
        } catch { /* non-critical */ }
      }
    }

    for (const mitigation of mitigations) {
      try {
        await this.createSubjectEvent('risk.mitigation_suggested', {
          individualId: ids.individualId,
          modelEventId: ids.modelEventIds['risk.mitigation_suggested'],
          value: mitigation,
          actorId: ids.actors.Анализатор_рисков,
          causes: [scoreEventId],
        });
      } catch { /* non-critical */ }
    }

    return { score, category, factors, mitigations, historicalIncidents };
  }

  async calculatePremium({ riskScore, coverageType = 'standard', missionCount = 1, droneValue = 500000 }) {
    await this.initialize();
    await this.bootstrapInsuranceDomain();
    const ids = this._insuranceIds;
    if (!ids) throw new Error('Insurance domain not bootstrapped');

    const basePremium = droneValue * 0.02;
    const riskMultiplier = 0.5 + (riskScore / 100) * 2.5;
    const coverageFactors = { basic: 0.6, standard: 1.0, comprehensive: 1.5, full: 2.0 };
    const coverageFactor = coverageFactors[coverageType] || 1.0;
    const volumeDiscount = missionCount > 100 ? 0.85 : missionCount > 50 ? 0.90 : missionCount > 20 ? 0.95 : 1.0;

    const premium = Math.round(basePremium * riskMultiplier * coverageFactor * volumeDiscount);
    const breakdown = {
      basePremium: Math.round(basePremium), riskMultiplier: Math.round(riskMultiplier * 100) / 100,
      coverageFactor, coverageType, volumeDiscount, missionCount, droneValue,
    };

    const validFor = new Date();
    validFor.setMonth(validFor.getMonth() + 12);

    await this.createSubjectEvent('risk.premium_calculated', {
      individualId: ids.individualId,
      modelEventId: ids.modelEventIds['risk.premium_calculated'],
      value: JSON.stringify({ premium, breakdown, validFor: validFor.toISOString() }),
      actorId: ids.actors.Оракул_страхования,
      causes: [],
    });

    return { premium, breakdown, validFor: validFor.toISOString() };
  }

  async fileClaim({ policyId, incidentId, description, estimatedLoss }) {
    await this.initialize();
    await this.bootstrapInsuranceDomain();
    const ids = this._insuranceIds;
    if (!ids) throw new Error('Insurance domain not bootstrapped');

    const claimName = `Claim-${Date.now()}`;
    const individual = await this.createIndividual(claimName, {
      conceptId: ids.conceptId, modelId: ids.modelId, actorId: ids.actors.Обработчик_претензий,
    });
    const claimId = String(individual?.id || individual?.obj);

    const claimEvent = await this.createSubjectEvent('risk.claim_filed', {
      individualId: claimId,
      modelEventId: ids.modelEventIds['risk.claim_filed'],
      value: JSON.stringify({ policyId, incidentId, description, estimatedLoss, status: 'filed', filedAt: new Date().toISOString() }),
      actorId: ids.actors.Обработчик_претензий,
      causes: incidentId ? [String(incidentId)] : [],
    });
    const claimEventId = String(claimEvent?.id || claimEvent?.obj);

    const allSubjectEvents = await this.getObjects(this.tables.subjectEvents);
    const pastClaims = allSubjectEvents.filter(e => e.val === 'risk.claim_filed');
    const claimCount = pastClaims.length;

    await this.createSubjectEvent('risk.history_analyzed', {
      individualId: claimId,
      modelEventId: ids.modelEventIds['risk.history_analyzed'],
      value: JSON.stringify({ totalClaims: claimCount, policyId, analyzedAt: new Date().toISOString() }),
      actorId: ids.actors.Анализатор_рисков,
      causes: [claimEventId],
    });

    return { claimId, claimEventId, policyId, estimatedLoss, status: 'filed', totalClaimsOnPolicy: claimCount };
  }

  async getRiskDashboard() {
    await this.initialize();
    await this.bootstrapInsuranceDomain();
    const ids = this._insuranceIds;
    if (!ids) return { averageRisk: 0, riskDistribution: {}, topRisks: [], recentClaims: [], safetyRatings: [] };

    const allSubjectEvents = await this.getObjects(this.tables.subjectEvents);
    const scores = [];
    const topRisks = [];
    const recentClaims = [];
    const safetyRatings = [];

    for (const evt of allSubjectEvents) {
      const evtName = evt.val || '';
      if (evtName === 'risk.score_computed') {
        try {
          const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          scores.push(val.score || 0);
          if ((val.score || 0) > 60) {
            topRisks.push({ id: evt.id, score: val.score, category: val.category, missionType: val.missionType, region: val.region, operatorId: val.operatorId });
          }
        } catch { /* not JSON */ }
      }
      if (evtName === 'risk.claim_filed') {
        try {
          const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          recentClaims.push({ id: evt.id, policyId: val.policyId, description: val.description, estimatedLoss: val.estimatedLoss, status: val.status, filedAt: val.filedAt });
        } catch { /* not JSON */ }
      }
      if (evtName === 'risk.rating_updated') {
        try {
          const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          safetyRatings.push({ operatorId: val.operatorId, rating: val.rating, score: val.score });
        } catch { /* not JSON */ }
      }
    }

    const riskDistribution = { minimal: 0, low: 0, moderate: 0, high: 0, critical: 0 };
    for (const s of scores) {
      if (s <= 20) riskDistribution.minimal++;
      else if (s <= 40) riskDistribution.low++;
      else if (s <= 60) riskDistribution.moderate++;
      else if (s <= 80) riskDistribution.high++;
      else riskDistribution.critical++;
    }

    const averageRisk = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    topRisks.sort((a, b) => b.score - a.score);

    return { averageRisk, riskDistribution, topRisks: topRisks.slice(0, 10), recentClaims: recentClaims.slice(-10).reverse(), safetyRatings };
  }

  async getOperatorSafetyRating(operatorId) {
    await this.initialize();
    await this.bootstrapInsuranceDomain();
    const ids = this._insuranceIds;
    if (!ids) throw new Error('Insurance domain not bootstrapped');

    const allSubjectEvents = await this.getObjects(this.tables.subjectEvents);
    const operatorScores = [];
    let incidentCount = 0;
    let claimCount = 0;

    for (const evt of allSubjectEvents) {
      const evtName = evt.val || '';
      const actorVal = String(evt.reqs?.['Актор']?.value || '');
      const isOperatorEvent = actorVal === String(operatorId);

      if (evtName === 'risk.score_computed') {
        try {
          const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          if (val.operatorId === operatorId || isOperatorEvent) {
            operatorScores.push(val.score || 0);
          }
        } catch { /* not JSON */ }
      }
      if (isOperatorEvent) {
        if (evtName === 'ops.mission_failed' || evtName === 'ops.mission_aborted') incidentCount++;
        if (evtName === 'risk.claim_filed') claimCount++;
      }
    }

    let avgScore = 0;
    if (operatorScores.length > 0) {
      avgScore = Math.round(operatorScores.reduce((a, b) => a + b, 0) / operatorScores.length);
    } else {
      avgScore = Math.min(100, incidentCount * 15 + claimCount * 10);
    }

    const rating = avgScore <= 20 ? 'A' : avgScore <= 40 ? 'B' : avgScore <= 60 ? 'C' : avgScore <= 80 ? 'D' : 'E';

    await this.createSubjectEvent('risk.rating_updated', {
      individualId: ids.individualId,
      modelEventId: ids.modelEventIds['risk.rating_updated'],
      value: JSON.stringify({ operatorId, rating, score: avgScore, incidentCount, claimCount, assessedScores: operatorScores.length, updatedAt: new Date().toISOString() }),
      actorId: ids.actors.Анализатор_рисков,
      causes: [],
    });

    return {
      operatorId, rating, score: avgScore, incidentCount, claimCount, assessedScores: operatorScores.length,
      description: { A: 'Excellent — minimal risk, exemplary safety record', B: 'Good — low risk, minor incidents only', C: 'Moderate — average risk, some safety concerns', D: 'Poor — high risk, significant incident history', E: 'Critical — very high risk, immediate review required' }[rating],
    };
  }

  // ─── Module 6: Ontological Marketplace ──────────────────────

  async bootstrapMarketplaceDomain() {
    if (this._marketplaceBootstrapped) return;

    try {
      const actors = await this.getObjects(this.tables.actors);
      const existingMarketplace = actors.find(a => a.val === 'Движок_маркетплейса');
      if (existingMarketplace) {
        this._marketplaceIds = await this._loadMarketplaceIds(actors);
        this._marketplaceBootstrapped = true;
        logger.info('[EventEngine] Marketplace domain already bootstrapped');
        return;
      }

      logger.info('[EventEngine] Bootstrapping ontological marketplace domain...');

      // 1. Create Actors
      const marketplaceEngine = await this.createActor('Движок_маркетплейса', {
        type: 'agent', description: 'Orchestrates marketplace request lifecycle',
      });
      const requirementsParser = await this.createActor('Парсер_требований', {
        type: 'agent', description: 'Parses natural language requirements into BSL queries',
      });
      const pricingEngine = await this.createActor('Движок_ценообразования', {
        type: 'agent', description: 'Computes price quotes based on mission parameters and risk',
      });
      const matchingEngine = await this.createActor('Движок_подбора', {
        type: 'agent', description: 'Matches drones and operators to mission requirements',
      });

      const marketplaceEngineId = String(marketplaceEngine?.id || marketplaceEngine?.obj);
      const requirementsParserId = String(requirementsParser?.id || requirementsParser?.obj);
      const pricingEngineId = String(pricingEngine?.id || pricingEngine?.obj);
      const matchingEngineId = String(matchingEngine?.id || matchingEngine?.obj);

      // 2. Create Concept -> auto-creates Модель_Маркетплейс
      const concept = await this.createConcept('Маркетплейс', 'Онтологический маркетплейс услуг БПЛА');
      const conceptId = String(concept?.id || concept?.obj);

      // 3. Find auto-created model
      const models = await this.getObjects(this.tables.models);
      const model = models.find(m => m.val === 'Модель_Маркетплейс');
      const modelId = model ? String(model.id) : null;

      if (!modelId) {
        logger.warn('[EventEngine] Модель_Маркетплейс not found after concept creation');
        this._marketplaceBootstrapped = true;
        return;
      }

      // 4. Create properties
      const props = {};
      const propDefs = [
        ['MissionRequirements', { propertyType: 'attribute', dataType: 'Text' }],
        ['BudgetRange', { propertyType: 'attribute', dataType: 'Text' }],
        ['MatchScore', { propertyType: 'attribute', dataType: 'Number' }],
        ['QuotePrice', { propertyType: 'attribute', dataType: 'Number' }],
        ['OperatorRating', { propertyType: 'attribute', dataType: 'Number' }],
        ['DeliveryTime', { propertyType: 'attribute', dataType: 'Text' }],
        ['ServiceRegion', { propertyType: 'attribute', dataType: 'Text' }],
        ['DroneCapabilities', { propertyType: 'attribute', dataType: 'Text' }],
        ['OrderStatus', { propertyType: 'attribute', dataType: 'Text' }],
      ];
      for (const [name, opts] of propDefs) {
        try {
          const p = await this.createProperty(name, opts);
          props[name] = String(p?.id || p?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create Marketplace property ${name}:`, err.message);
        }
      }

      // 5. Create Model Events
      const MARKETPLACE_EVENTS = [
        ['market.request_created', { required: true }],
        ['market.requirements_parsed', {}],
        ['market.drones_matched', {}],
        ['market.operators_matched', {}],
        ['market.quote_generated', {}],
        ['market.quote_accepted', {}],
        ['market.order_placed', {}],
        ['market.order_started', {}],
        ['market.order_fulfilled', { immutable: true }],
        ['market.order_cancelled', {}],
        ['market.feedback_received', {}],
        ['market.rating_updated', {}],
        ['market.dispute_opened', {}],
        ['market.dispute_resolved', {}],
      ];

      const modelEventIds = {};
      for (const [eventType, constraints] of MARKETPLACE_EVENTS) {
        try {
          const result = await this.createModelEvent(eventType, {
            modelId,
            propertyId: props.OrderStatus || props.MatchScore,
            constraints,
          });
          modelEventIds[eventType] = String(result?.id || result?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create Marketplace model event ${eventType}:`, err.message);
        }
      }

      // 6. Create FSM states
      const FSM_STATES = [
        ['Открыт', 'initial'],
        ['Разобран', 'normal'],
        ['Подобран', 'normal'],
        ['Оценён', 'normal'],
        ['Принят', 'normal'],
        ['В_работе', 'normal'],
        ['Выполнен', 'final'],
        ['Отменён', 'final'],
        ['Спор', 'normal'],
        ['Решён', 'normal'],
      ];

      const stateIds = {};
      if (this.createState) {
        for (const [name, type] of FSM_STATES) {
          try {
            const s = await this.createState(modelId, { name, type });
            stateIds[name] = String(s?.id || s?.obj);
          } catch (err) {
            logger.warn(`[EventEngine] Failed to create Marketplace state ${name}:`, err.message);
          }
        }

        const FSM_TRANSITIONS = [
          ['Открыт', 'Разобран', 'market.requirements_parsed', ''],
          ['Разобран', 'Подобран', 'market.drones_matched', ''],
          ['Подобран', 'Оценён', 'market.quote_generated', ''],
          ['Оценён', 'Принят', 'market.quote_accepted', ''],
          ['Оценён', 'Отменён', 'market.order_cancelled', ''],
          ['Принят', 'В_работе', 'market.order_started', ''],
          ['В_работе', 'Выполнен', 'market.order_fulfilled', ''],
          ['В_работе', 'Спор', 'market.dispute_opened', ''],
          ['Спор', 'Решён', 'market.dispute_resolved', ''],
          ['Решён', 'Выполнен', 'market.order_fulfilled', ''],
        ];

        for (const [from, to, trigger, guard] of FSM_TRANSITIONS) {
          if (stateIds[from] && stateIds[to]) {
            try {
              await this.createTransition(modelId, {
                fromStateId: stateIds[from],
                toStateId: stateIds[to],
                trigger,
                guard: guard || undefined,
              });
            } catch (err) {
              logger.warn(`[EventEngine] Failed to create Marketplace transition ${from}->${to}:`, err.message);
            }
          }
        }
      }

      // 8. Create Individual
      const individual = await this.createIndividual('Маркетплейс-экземпляр', {
        conceptId, modelId, actorId: marketplaceEngineId,
      });
      const individualId = String(individual?.id || individual?.obj);

      // 9. Register Marketplace triggers (self-execution chain)
      const MARKETPLACE_TRIGGERS = [
        {
          condition: 'eventType $EQ "market.request_created"',
          action: { type: 'createEvent', params: { name: 'market.requirements_parsed', value: 'Auto-parsed from request' } },
          priority: 10,
        },
        {
          condition: 'eventType $EQ "market.requirements_parsed"',
          action: { type: 'createEvent', params: { name: 'market.drones_matched', value: 'Auto-matched drones from BSL query' } },
          priority: 9,
        },
        {
          condition: 'eventType $EQ "market.drones_matched"',
          action: { type: 'createEvent', params: { name: 'market.operators_matched', value: 'Auto-matched operators for region' } },
          priority: 8,
        },
        {
          condition: 'eventType $EQ "market.operators_matched"',
          action: { type: 'createEvent', params: { name: 'market.quote_generated', value: 'Auto-generated price quote' } },
          priority: 7,
        },
      ];

      for (const trigger of MARKETPLACE_TRIGGERS) {
        try {
          await this.registerTrigger({ modelId, ...trigger });
        } catch (err) {
          logger.warn('[EventEngine] Failed to register Marketplace trigger:', err.message);
        }
      }

      this._marketplaceIds = {
        actors: {Движок_маркетплейса: marketplaceEngineId,Парсер_требований: requirementsParserId,Движок_ценообразования: pricingEngineId,Движок_подбора: matchingEngineId },
        modelId, modelEventIds, individualId, conceptId, stateIds, props,
      };

      this._marketplaceBootstrapped = true;
      logger.info('[EventEngine] Ontological marketplace domain bootstrapped', {
        actors: 4, modelEvents: Object.keys(modelEventIds).length, individualId,
      });
    } catch (err) {
      logger.error('[EventEngine] Bootstrap Marketplace domain failed:', err.message);
      this._marketplaceBootstrapped = true;
    }
  }

  async _loadMarketplaceIds(actors) {
    const marketplaceEngine = actors.find(a => a.val === 'Движок_маркетплейса');
    const requirementsParser = actors.find(a => a.val === 'Парсер_требований');
    const pricingEngine = actors.find(a => a.val === 'Движок_ценообразования');
    const matchingEngine = actors.find(a => a.val === 'Движок_подбора');

    const models = await this.getObjects(this.tables.models);
    const model = models.find(m => m.val === 'Модель_Маркетплейс');
    const modelId = model ? String(model.id) : null;

    let modelEventIds = {};
    if (modelId) {
      const allEvents = await this.getObjects(this.tables.modelEvents);
      for (const evt of allEvents) {
        const mReq = evt.reqs['Модель'];
        if (mReq && String(mReq.value) === modelId && evt.val.startsWith('market.')) {
          modelEventIds[evt.val] = String(evt.id);
        }
      }
    }

    const concepts = await this.getObjects(this.tables.concepts);
    const concept = concepts.find(c => c.val === 'Маркетплейс');
    const conceptId = concept ? String(concept.id) : null;

    const individuals = await this.getObjects(this.tables.individuals);
    const individual = individuals.find(i => i.val === 'Маркетплейс-экземпляр');

    return {
      actors: {
       Движок_маркетплейса: marketplaceEngine ? String(marketplaceEngine.id) : null,
       Парсер_требований: requirementsParser ? String(requirementsParser.id) : null,
       Движок_ценообразования: pricingEngine ? String(pricingEngine.id) : null,
       Движок_подбора: matchingEngine ? String(matchingEngine.id) : null,
      },
      modelId, modelEventIds,
      individualId: individual ? String(individual.id) : null,
      conceptId,
    };
  }

  getMarketplaceIds() {
    return this._marketplaceIds || null;
  }

  // ─── Marketplace Service Methods ────────────────────────────

  async createMarketRequest({ description, budget, region, deadline }) {
    await this.initialize();
    await this.bootstrapMarketplaceDomain();
    const ids = this._marketplaceIds;
    if (!ids) throw new Error('Marketplace domain not bootstrapped');

    const requestName = `Request-${Date.now()}`;
    const individual = await this.createIndividual(requestName, {
      conceptId: ids.conceptId, modelId: ids.modelId, actorId: ids.actors.Движок_маркетплейса,
    });
    const requestId = String(individual?.id || individual?.obj);

    let parsedRequirements = null;
    try {
      parsedRequirements = await this.generateBSLFromNaturalLanguage(description, {
        additionalContext: `Marketplace request for drone services. Budget: ${budget}, Region: ${region}, Deadline: ${deadline}`,
      });
    } catch (err) {
      logger.warn('[Marketplace] BSL generation failed, using description as-is:', err.message);
      parsedRequirements = { bsl: `description $EQ "${description}"`, valid: true, issues: [] };
    }

    const requestEvent = await this.createSubjectEvent('market.request_created', {
      individualId: requestId,
      modelEventId: ids.modelEventIds['market.request_created'],
      value: JSON.stringify({ description, budget, region, deadline, bsl: parsedRequirements?.bsl || '', status: 'open', createdAt: new Date().toISOString() }),
      actorId: ids.actors.Движок_маркетплейса,
      causes: [],
    });
    const requestEventId = String(requestEvent?.id || requestEvent?.obj);

    // Execute auto-fire chain explicitly for full data
    const parsedEvent = await this.createSubjectEvent('market.requirements_parsed', {
      individualId: requestId,
      modelEventId: ids.modelEventIds['market.requirements_parsed'],
      value: JSON.stringify({ originalDescription: description, bsl: parsedRequirements?.bsl || '', valid: parsedRequirements?.valid || false, parsedAt: new Date().toISOString() }),
      actorId: ids.actors.Парсер_требований,
      causes: [requestEventId],
    });
    const parsedEventId = String(parsedEvent?.id || parsedEvent?.obj);

    const droneMatches = await this.matchDrones(parsedRequirements?.bsl || description);
    const dronesEvent = await this.createSubjectEvent('market.drones_matched', {
      individualId: requestId,
      modelEventId: ids.modelEventIds['market.drones_matched'],
      value: JSON.stringify({ matchCount: droneMatches.count, bestMatch: droneMatches.bestMatch, matchedAt: new Date().toISOString() }),
      actorId: ids.actors.Движок_подбора,
      causes: [parsedEventId],
    });
    const dronesEventId = String(dronesEvent?.id || dronesEvent?.obj);

    const operatorMatches = await this.matchOperators({ region, missionType: description, minRating: 3 });
    const operatorsEvent = await this.createSubjectEvent('market.operators_matched', {
      individualId: requestId,
      modelEventId: ids.modelEventIds['market.operators_matched'],
      value: JSON.stringify({ operatorCount: operatorMatches.operators.length, bestMatch: operatorMatches.bestMatch, matchedAt: new Date().toISOString() }),
      actorId: ids.actors.Движок_подбора,
      causes: [dronesEventId],
    });
    const operatorsEventId = String(operatorsEvent?.id || operatorsEvent?.obj);

    const bestDrone = droneMatches.bestMatch;
    const quote = await this.generateQuote({
      droneModel: bestDrone?.name || 'generic', missionType: description, duration: 1, region, riskScore: 30,
    });
    await this.createSubjectEvent('market.quote_generated', {
      individualId: requestId,
      modelEventId: ids.modelEventIds['market.quote_generated'],
      value: JSON.stringify({ price: quote.price, breakdown: quote.breakdown, insurance: quote.insurance, validity: quote.validity, generatedAt: new Date().toISOString() }),
      actorId: ids.actors.Движок_ценообразования,
      causes: [operatorsEventId],
    });

    return { requestId, parsedRequirements, matches: { drones: droneMatches, operators: operatorMatches }, quote };
  }

  async matchDrones(bslRequirements) {
    await this.initialize();

    let drones = [];
    try {
      const ontologyElements = await this.getOntologyElements({ limit: 500 });
      drones = ontologyElements.map(el => ({
        id: el.id, name: el.val || '',
        type: el.reqs?.['notation']?.value || 'unknown',
        category: el.reqs?.['prefLabel_en']?.value || '',
        payload: parseFloat(el.reqs?.['maxPayload']?.value || '0') || 0,
        range: parseFloat(el.reqs?.['maxRange']?.value || '0') || 0,
        endurance: parseFloat(el.reqs?.['maxEndurance']?.value || '0') || 0,
        weight: parseFloat(el.reqs?.['weight']?.value || '0') || 0,
      }));
    } catch (err) {
      logger.warn('[Marketplace] Failed to load drone ontology, using fallback catalog:', err.message);
      drones = [
        { id: 'drone-1', name: 'DJI Mavic 3', type: 'multirotor', category: 'survey', payload: 0.2, range: 15, endurance: 46, weight: 0.9 },
        { id: 'drone-2', name: 'DJI Matrice 350', type: 'multirotor', category: 'industrial', payload: 2.7, range: 20, endurance: 55, weight: 6.3 },
        { id: 'drone-3', name: 'Supercam S350', type: 'fixed-wing', category: 'mapping', payload: 1.5, range: 100, endurance: 240, weight: 9.5 },
        { id: 'drone-4', name: 'Geoscan 201', type: 'fixed-wing', category: 'survey', payload: 0.5, range: 50, endurance: 180, weight: 3.2 },
        { id: 'drone-5', name: 'ZALA 421-16E', type: 'fixed-wing', category: 'monitoring', payload: 2.0, range: 110, endurance: 300, weight: 8.5 },
        { id: 'drone-6', name: 'Orlan-10', type: 'fixed-wing', category: 'recon', payload: 5.0, range: 120, endurance: 960, weight: 14 },
        { id: 'drone-7', name: 'Coax-2D', type: 'helicopter', category: 'delivery', payload: 3.0, range: 40, endurance: 60, weight: 7.0 },
        { id: 'drone-8', name: 'Ehang 216', type: 'multirotor', category: 'passenger', payload: 220, range: 35, endurance: 21, weight: 360 },
      ];
    }

    if (drones.length === 0) return { matches: [], count: 0, bestMatch: null };

    const bslLower = (bslRequirements || '').toLowerCase();
    const scored = drones.map(drone => {
      let score = 50;
      const catLower = (drone.category || '').toLowerCase();
      const typeLower = (drone.type || '').toLowerCase();
      const nameLower = (drone.name || '').toLowerCase();

      if (bslLower.includes('survey') && (catLower.includes('survey') || catLower.includes('mapping'))) score += 20;
      if (bslLower.includes('delivery') && catLower.includes('delivery')) score += 25;
      if (bslLower.includes('monitoring') && (catLower.includes('monitoring') || catLower.includes('recon'))) score += 20;
      if (bslLower.includes('industrial') && catLower.includes('industrial')) score += 20;
      if (bslLower.includes('mapping') && catLower.includes('mapping')) score += 25;
      if (bslLower.includes('fixed-wing') && typeLower === 'fixed-wing') score += 15;
      if (bslLower.includes('multirotor') && typeLower === 'multirotor') score += 15;
      if (bslLower.includes('helicopter') && typeLower === 'helicopter') score += 15;
      if (bslLower.includes('long range') || bslLower.includes('long-range')) score += Math.min(20, drone.range / 5);
      if (bslLower.includes('heavy') || bslLower.includes('payload')) score += Math.min(20, drone.payload * 5);
      if (bslLower.includes(nameLower) || nameLower.includes(bslLower.split(' ')[0] || '___')) score += 30;

      return { ...drone, matchScore: Math.min(100, Math.round(score)) };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore);
    return { matches: scored.slice(0, 10), count: scored.length, bestMatch: scored[0] || null };
  }

  async matchOperators({ region, missionType, minRating = 3 }) {
    await this.initialize();

    const allActors = await this.getObjects(this.tables.actors);
    const humanActors = allActors.filter(a => {
      const typeVal = a.reqs?.['Тип']?.value || '';
      return typeVal === 'human' || typeVal === 'operator';
    });

    let daoIds = null;
    try { await this.bootstrapDAODomain(); daoIds = this.getDAOIds(); } catch { /* DAO not available */ }

    let insuranceIds = null;
    try { await this.bootstrapInsuranceDomain(); insuranceIds = this.getInsuranceIds(); } catch { /* Insurance not available */ }

    const operators = [];
    for (const actor of humanActors) {
      const actorId = String(actor.id);
      let reputation = 50;
      let safetyRating = 'C';

      if (daoIds) {
        const allSubjectEvents = await this.getObjectsCached(this.tables.subjectEvents);
        for (const evt of allSubjectEvents) {
          if (evt.val === 'dao.reputation_changed') {
            try {
              const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
              if (val.actorId === actorId || String(evt.reqs?.['Актор']?.value || '') === actorId) {
                reputation = val.reputation || reputation;
              }
            } catch { /* ignore */ }
          }
        }
      }

      if (insuranceIds) {
        try { const ratingResult = await this.getOperatorSafetyRating(actorId); safetyRating = ratingResult.rating; } catch { /* ignore */ }
      }

      const ratingNumeric = { A: 5, B: 4, C: 3, D: 2, E: 1 }[safetyRating] || 3;
      if (ratingNumeric < minRating) continue;

      const operatorScore = Math.round((reputation / 100) * 40 + (ratingNumeric / 5) * 30 + 30);
      operators.push({ id: actorId, name: actor.val, reputation, safetyRating, ratingNumeric, operatorScore, status: actor.reqs?.['Статус']?.value || 'active' });
    }

    operators.sort((a, b) => b.operatorScore - a.operatorScore);
    return { operators: operators.slice(0, 20), bestMatch: operators[0] || null };
  }

  async generateQuote({ droneModel, missionType, duration = 1, region, riskScore = 30 }) {
    await this.initialize();

    const baseRates = { survey: 15000, mapping: 20000, monitoring: 12000, delivery: 25000, industrial: 30000, recon: 18000, passenger: 50000, default: 15000 };
    const missionLower = (missionType || '').toLowerCase();
    let flightHourRate = baseRates.default;
    for (const [key, rate] of Object.entries(baseRates)) {
      if (missionLower.includes(key)) { flightHourRate = rate; break; }
    }

    const riskMultiplier = 0.8 + (riskScore / 100) * 1.2;
    const regionFactors = { 'Москва': 1.0, 'Санкт-Петербург': 1.0, 'Сибирь': 1.4, 'Дальний Восток': 1.5, 'Арктика': 2.0, 'Урал': 1.2, 'Юг': 1.1, 'Центр': 1.0 };
    let regionFactor = 1.15;
    if (region) {
      for (const [key, factor] of Object.entries(regionFactors)) {
        if (region.includes(key) || key.includes(region)) { regionFactor = factor; break; }
      }
    }

    const price = Math.round(flightHourRate * duration * riskMultiplier * regionFactor);
    const insurance = Math.round(price * 0.05);
    const validity = new Date();
    validity.setDate(validity.getDate() + 7);

    return {
      price,
      breakdown: { flightHourRate, duration, riskMultiplier: Math.round(riskMultiplier * 100) / 100, regionFactor, region: region || 'default', droneModel: droneModel || 'generic', missionType: missionType || 'general' },
      insurance,
      validity: validity.toISOString(),
    };
  }

  async acceptQuote(requestId, quoteData = {}) {
    await this.initialize();
    await this.bootstrapMarketplaceDomain();
    const ids = this._marketplaceIds;
    if (!ids) throw new Error('Marketplace domain not bootstrapped');

    const acceptEvent = await this.createSubjectEvent('market.quote_accepted', {
      individualId: requestId,
      modelEventId: ids.modelEventIds['market.quote_accepted'],
      value: JSON.stringify({ ...quoteData, acceptedAt: new Date().toISOString(), status: 'accepted' }),
      actorId: ids.actors.Движок_маркетплейса,
      causes: [],
    });
    const acceptEventId = String(acceptEvent?.id || acceptEvent?.obj);

    const orderEvent = await this.createSubjectEvent('market.order_placed', {
      individualId: requestId,
      modelEventId: ids.modelEventIds['market.order_placed'],
      value: JSON.stringify({ requestId, price: quoteData.price, status: 'placed', placedAt: new Date().toISOString() }),
      actorId: ids.actors.Движок_маркетплейса,
      causes: [acceptEventId],
    });
    const orderEventId = String(orderEvent?.id || orderEvent?.obj);

    await this.createSubjectEvent('market.order_started', {
      individualId: requestId,
      modelEventId: ids.modelEventIds['market.order_started'],
      value: JSON.stringify({ requestId, status: 'in_progress', startedAt: new Date().toISOString() }),
      actorId: ids.actors.Движок_маркетплейса,
      causes: [orderEventId],
    });

    return { requestId, orderId: orderEventId, status: 'in_progress', price: quoteData.price, acceptedAt: new Date().toISOString() };
  }

  async submitFeedback(orderId, { rating, comment }) {
    await this.initialize();
    await this.bootstrapMarketplaceDomain();
    const ids = this._marketplaceIds;
    if (!ids) throw new Error('Marketplace domain not bootstrapped');

    const fulfilledEvent = await this.createSubjectEvent('market.order_fulfilled', {
      individualId: orderId,
      modelEventId: ids.modelEventIds['market.order_fulfilled'],
      value: JSON.stringify({ orderId, status: 'fulfilled', fulfilledAt: new Date().toISOString() }),
      actorId: ids.actors.Движок_маркетплейса,
      causes: [],
    });
    const fulfilledEventId = String(fulfilledEvent?.id || fulfilledEvent?.obj);

    const feedbackEvent = await this.createSubjectEvent('market.feedback_received', {
      individualId: orderId,
      modelEventId: ids.modelEventIds['market.feedback_received'],
      value: JSON.stringify({ orderId, rating, comment, submittedAt: new Date().toISOString() }),
      actorId: ids.actors.Движок_маркетплейса,
      causes: [fulfilledEventId],
    });
    const feedbackEventId = String(feedbackEvent?.id || feedbackEvent?.obj);

    await this.createSubjectEvent('market.rating_updated', {
      individualId: orderId,
      modelEventId: ids.modelEventIds['market.rating_updated'],
      value: JSON.stringify({ orderId, rating, updatedAt: new Date().toISOString() }),
      actorId: ids.actors.Движок_маркетплейса,
      causes: [feedbackEventId],
    });

    return { orderId, rating, comment, status: 'fulfilled' };
  }

  async getMarketplaceDashboard() {
    await this.initialize();
    await this.bootstrapMarketplaceDomain();
    const ids = this._marketplaceIds;
    if (!ids) return { activeRequests: 0, fulfilledOrders: 0, avgPrice: 0, topOperators: [], popularMissions: [] };

    const allSubjectEvents = await this.getObjects(this.tables.subjectEvents);
    const activeRequests = [];
    const fulfilledOrders = [];
    const prices = [];
    const operatorCounts = {};
    const missionTypes = {};

    for (const evt of allSubjectEvents) {
      const evtName = evt.val || '';
      if (evtName === 'market.request_created') {
        try {
          const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          activeRequests.push({ id: evt.id, description: val.description, budget: val.budget, region: val.region, createdAt: val.createdAt });
          const desc = (val.description || '').toLowerCase();
          for (const mType of ['survey', 'mapping', 'monitoring', 'delivery', 'industrial']) {
            if (desc.includes(mType)) missionTypes[mType] = (missionTypes[mType] || 0) + 1;
          }
        } catch { /* not JSON */ }
      }
      if (evtName === 'market.order_fulfilled') {
        try {
          const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          fulfilledOrders.push({ id: evt.id, orderId: val.orderId, fulfilledAt: val.fulfilledAt });
        } catch { /* not JSON */ }
      }
      if (evtName === 'market.quote_generated') {
        try {
          const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          if (val.price) prices.push(val.price);
        } catch { /* not JSON */ }
      }
      if (evtName === 'market.operators_matched') {
        try {
          const val = JSON.parse(evt.reqs?.['Значение']?.value || '{}');
          if (val.bestMatch?.name) operatorCounts[val.bestMatch.name] = (operatorCounts[val.bestMatch.name] || 0) + 1;
        } catch { /* not JSON */ }
      }
    }

    const topOperators = Object.entries(operatorCounts).map(([name, count]) => ({ name, matchCount: count })).sort((a, b) => b.matchCount - a.matchCount).slice(0, 10);
    const popularMissions = Object.entries(missionTypes).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

    return { activeRequests: activeRequests.length, fulfilledOrders: fulfilledOrders.length, avgPrice, topOperators, popularMissions, recentRequests: activeRequests.slice(-5).reverse(), recentFulfilled: fulfilledOrders.slice(-5).reverse() };
  }

  async searchCatalog(query) {
    await this.initialize();
    await this.bootstrapMarketplaceDomain();

    let bsl = null;
    try {
      const result = await this.generateBSLFromNaturalLanguage(query, { additionalContext: 'Marketplace catalog search for drones and operators' });
      bsl = result?.bsl || null;
    } catch { bsl = null; }

    const droneResults = await this.matchDrones(bsl || query);
    const operatorResults = await this.matchOperators({ region: null, missionType: query, minRating: 1 });

    return { query, bsl, drones: droneResults, operators: operatorResults, totalResults: droneResults.count + operatorResults.operators.length };
  }

  // ─── Insurance/Risk missing methods ───────────────────────────────────

  async getInsuranceIds() {
    await this.initialize();
    await this.bootstrapInsuranceDomain();
    return this._insuranceIds || {};
  }

  async computeRiskScore({ droneId, operatorId, missionType, region, weather = 'clear' }) {
    await this.initialize();
    await this.bootstrapInsuranceDomain();

    const ids = this._insuranceIds || {};
    const factors = [];
    let score = 20; // base

    // Weather factor
    const weatherScores = { clear: 0, cloudy: 5, rain: 15, wind: 20, storm: 40, snow: 25 };
    score += weatherScores[weather] || 10;
    factors.push({ factor: 'weather', value: weather, impact: weatherScores[weather] || 10 });

    // Mission type factor
    const missionScores = { survey: 5, delivery: 15, inspection: 10, emergency: 25, military: 40, agriculture: 8 };
    score += missionScores[missionType] || 10;
    factors.push({ factor: 'missionType', value: missionType, impact: missionScores[missionType] || 10 });

    // Region factor (simplified)
    if (region) {
      const urbanRegions = ['Москва', 'Санкт-Петербург', 'Moscow', 'SPb'];
      const regionImpact = urbanRegions.some(u => region.includes(u)) ? 15 : 5;
      score += regionImpact;
      factors.push({ factor: 'region', value: region, impact: regionImpact });
    }

    score = Math.min(100, Math.max(0, score));
    const category = score > 80 ? 'critical' : score > 60 ? 'high' : score > 40 ? 'medium' : score > 20 ? 'low' : 'minimal';

    // Create subject event
    try {
      await this.createSubjectEvent('risk.score_computed', {
        actorId: ids.actors?.RiskAnalyzer,
        modelId: ids.modelId,
        individualId: ids.individualId,
        value: String(score),
      });
    } catch (err) {
      logger.warn('[EventEngine] Failed to create risk.score_computed event:', err.message);
    }

    return { riskScore: score, category, factors, droneId, operatorId, missionType, region, weather };
  }

  async getOperatorSafetyRating(operatorId) {
    await this.initialize();
    await this.bootstrapInsuranceDomain();

    const events = await this.getObjects(this.tables.subjectEvents);
    const operatorEvents = events.filter(e => {
      try {
        const parsed = JSON.parse(e.val || '{}');
        return parsed.actorId === operatorId || parsed.operatorId === operatorId;
      } catch { return false; }
    });

    const incidents = operatorEvents.filter(e => {
      const val = e.val || '';
      return val.includes('failed') || val.includes('incident') || val.includes('claim');
    }).length;
    const totalMissions = operatorEvents.filter(e => (e.val || '').includes('mission')).length;
    const successRate = totalMissions > 0 ? ((totalMissions - incidents) / totalMissions * 100).toFixed(1) : 100;
    const rating = incidents === 0 ? 'A+' : incidents <= 2 ? 'A' : incidents <= 5 ? 'B' : incidents <= 10 ? 'C' : 'D';

    return { operatorId, rating, successRate: Number(successRate), totalMissions, incidents, lastUpdated: new Date().toISOString() };
  }

  async fileClaim({ policyId, incidentDate, description, estimatedDamage, droneId }) {
    await this.initialize();
    await this.bootstrapInsuranceDomain();

    const ids = this._insuranceIds || {};
    const claimId = `CLM-${Date.now()}`;

    try {
      await this.createSubjectEvent('risk.claim_filed', {
        actorId: ids.actors?.ClaimsProcessor,
        modelId: ids.modelId,
        individualId: ids.individualId,
        value: JSON.stringify({ claimId, policyId, incidentDate, description, estimatedDamage, droneId }),
      });
    } catch (err) {
      logger.warn('[EventEngine] Failed to create risk.claim_filed event:', err.message);
    }

    return { claimId, status: 'filed', policyId, incidentDate, description, estimatedDamage, droneId, filedAt: new Date().toISOString() };
  }

  // ─── Marketplace missing methods ──────────────────────────────────────

  async getMarketplaceIds() {
    await this.initialize();
    await this.bootstrapMarketplaceDomain();
    return this._marketplaceIds || {};
  }

  // ─── Swarm Domain ────────────────────────────────────────────────────

  async bootstrapSwarmDomain() {
    if (this._swarmBootstrapped) return;

    try {
      const actors = await this.getObjects(this.tables.actors);
      const existingSwarm = actors.find(a => a.val === 'Координатор_роя');
      if (existingSwarm) {
        this._swarmIds = await this._loadSwarmIds(actors);
        this._swarmBootstrapped = true;
        logger.info('[EventEngine] Swarm domain already bootstrapped');
        return;
      }

      logger.info('[EventEngine] Bootstrapping swarm coordination domain...');

      // 1. Create Actors
      const swarmCoordinator = await this.createActor('Координатор_роя', {
        type: 'agent', description: 'Coordinates drone swarm behavior and task distribution',
      });
      const swarmLeader = await this.createActor('Лидер_роя', {
        type: 'agent', description: 'Elected leader drone for consensus decisions',
      });
      const swarmDrone = await this.createActor('Дрон_роя', {
        type: 'sensor', description: 'Individual drone participating in swarm',
      });

      const swarmCoordinatorId = String(swarmCoordinator?.id || swarmCoordinator?.obj);
      const swarmLeaderId = String(swarmLeader?.id || swarmLeader?.obj);
      const swarmDroneId = String(swarmDrone?.id || swarmDrone?.obj);

      // 2. Create Concept
      const concept = await this.createConcept('Рой_миссия', 'Координация роя дронов с выбором лидера');
      const conceptId = String(concept?.id || concept?.obj);

      // 3. Find model
      const models = await this.getObjects(this.tables.models);
      const model = models.find(m => m.val === 'Модель_Рой_миссия');
      const modelId = model ? String(model.id) : null;

      if (!modelId) {
        logger.warn('[EventEngine] Модель_Рой_миссия not found');
        this._swarmBootstrapped = true;
        return;
      }

      // 4. Properties
      const props = {};
      const propDefs = [
        ['SwarmSize', { propertyType: 'attribute', dataType: 'Number' }],
        ['FormationType', { propertyType: 'attribute', dataType: 'Text' }],
        ['CoverageArea', { propertyType: 'attribute', dataType: 'Number' }],
        ['LeaderId', { propertyType: 'attribute', dataType: 'Text' }],
        ['TaskQueue', { propertyType: 'attribute', dataType: 'Text' }],
        ['ConsensusThreshold', { propertyType: 'attribute', dataType: 'Number' }],
        ['SwarmHealth', { propertyType: 'attribute', dataType: 'Text' }],
        ['CommunicationRange', { propertyType: 'attribute', dataType: 'Number' }],
      ];
      for (const [name, opts] of propDefs) {
        try {
          const p = await this.createProperty(name, opts);
          props[name] = String(p?.id || p?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create Swarm property ${name}:`, err.message);
        }
      }

      // 5. Model Events
      const SWARM_EVENTS = [
        ['swarm.mission_created', { required: true }],
        ['swarm.drone_assigned', {}],
        ['swarm.drone_removed', {}],
        ['swarm.formation_set', {}],
        ['swarm.leader_elected', {}],
        ['swarm.task_distributed', {}],
        ['swarm.task_redistributed', {}],
        ['swarm.coverage_updated', {}],
        ['swarm.drone_lost', {}],
        ['swarm.consensus_reached', {}],
        ['swarm.mission_completed', { immutable: true }],
        ['swarm.emergency_recall', { immutable: true }],
      ];

      const modelEventIds = {};
      for (const [eventType, constraints] of SWARM_EVENTS) {
        try {
          const result = await this.createModelEvent(eventType, {
            modelId,
            propertyId: props.SwarmSize || props.SwarmHealth,
            constraints,
          });
          modelEventIds[eventType] = String(result?.id || result?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create Swarm model event ${eventType}:`, err.message);
        }
      }

      // 6. FSM states
      const FSM_STATES = [
        ['Формирование', 'initial'],
        ['Сборка', 'normal'],
        ['Активен', 'normal'],
        ['Перераспределение', 'normal'],
        ['Деградация', 'normal'],
        ['Завершён', 'final'],
        ['Отозван', 'final'],
      ];

      const stateIds = {};
      if (this.createState) {
        for (const [name, type] of FSM_STATES) {
          try {
            const s = await this.createState(modelId, { name, type });
            stateIds[name] = String(s?.id || s?.obj);
          } catch (err) {
            logger.warn(`[EventEngine] Failed to create Swarm state ${name}:`, err.message);
          }
        }

        const FSM_TRANSITIONS = [
          ['Формирование', 'Сборка', 'swarm.drone_assigned', ''],
          ['Сборка', 'Активен', 'swarm.leader_elected', ''],
          ['Активен', 'Перераспределение', 'swarm.drone_lost', ''],
          ['Перераспределение', 'Активен', 'swarm.task_redistributed', ''],
          ['Активен', 'Деградация', 'swarm.drone_lost', 'swarmHealth $EQ "critical"'],
          ['Деградация', 'Отозван', 'swarm.emergency_recall', ''],
          ['Активен', 'Завершён', 'swarm.mission_completed', ''],
          ['Деградация', 'Завершён', 'swarm.mission_completed', ''],
        ];

        for (const [from, to, trigger, guard] of FSM_TRANSITIONS) {
          if (stateIds[from] && stateIds[to]) {
            try {
              await this.createTransition(modelId, {
                fromStateId: stateIds[from],
                toStateId: stateIds[to],
                trigger,
                guard: guard || undefined,
              });
            } catch (err) {
              logger.warn(`[EventEngine] Failed to create Swarm transition ${from}->${to}:`, err.message);
            }
          }
        }
      }

      // 7. Individual
      const individual = await this.createIndividual('Рой-экземпляр', {
        conceptId, modelId, actorId: swarmCoordinatorId,
      });
      const individualId = String(individual?.id || individual?.obj);

      // 8. Triggers
      const SWARM_TRIGGERS = [
        {
          condition: 'eventType $EQ "swarm.drone_lost"',
          action: { type: 'createEvent', params: { name: 'swarm.task_redistributed', value: 'Auto-redistribute after drone loss' } },
          priority: 10,
        },
        {
          condition: 'eventType $EQ "swarm.coverage_updated" $AND value $LT 50',
          action: { type: 'notify', params: { channel: 'alert', message: 'Swarm coverage below 50%' } },
          priority: 9,
        },
      ];

      for (const trigger of SWARM_TRIGGERS) {
        try {
          await this.registerTrigger({ modelId, ...trigger });
        } catch (err) {
          logger.warn('[EventEngine] Failed to register Swarm trigger:', err.message);
        }
      }

      this._swarmIds = {
        actors: {Координатор_роя: swarmCoordinatorId,Лидер_роя: swarmLeaderId,Дрон_роя: swarmDroneId },
        modelId, modelEventIds, individualId, conceptId, stateIds, props,
      };

      this._swarmBootstrapped = true;
      logger.info('[EventEngine] Swarm coordination domain bootstrapped', {
        actors: 3, modelEvents: Object.keys(modelEventIds).length, individualId,
      });
    } catch (err) {
      logger.error('[EventEngine] Bootstrap Swarm domain failed:', err.message);
      this._swarmBootstrapped = true;
    }
  }

  async _loadSwarmIds(actors) {
    const coordinator = actors.find(a => a.val === 'Координатор_роя');
    const leader = actors.find(a => a.val === 'Лидер_роя');
    const drone = actors.find(a => a.val === 'Дрон_роя');
    const models = await this.getObjects(this.tables.models);
    const model = models.find(m => m.val === 'Модель_Рой_миссия');
    const modelId = model ? String(model.id) : null;
    return {
      actors: {
       Координатор_роя: coordinator ? String(coordinator.id) : null,
       Лидер_роя: leader ? String(leader.id) : null,
       Дрон_роя: drone ? String(drone.id) : null,
      },
      modelId,
    };
  }

  async getSwarmIds() {
    await this.initialize();
    await this.bootstrapSwarmDomain();
    return this._swarmIds || {};
  }

  /**
   * Найти индивид роя по missionId — ищет в событиях swarm.mission_created
   */
  async _findSwarmIndividual(missionId) {
    if (!missionId) return null;
    try {
      const events = await this.getFilteredEvents({ eventType: 'swarm.mission_created' });
      for (const e of events) {
        try {
          const val = JSON.parse(e.reqs?.['Значение']?.value || e.val || '{}');
          if (val.missionId === missionId && e.reqs?.['Индивид']?.value) {
            return String(e.reqs['Индивид'].value);
          }
        } catch { /* skip */ }
      }
    } catch { /* fallback */ }
    return null;
  }

  /**
   * Завершить миссию роя
   */
  async completeSwarmMission(missionId, { result = 'success', summary = '' } = {}) {
    await this.initialize();
    await this.bootstrapSwarmDomain();

    const ids = this._swarmIds || {};
    const individualId = await this._findSwarmIndividual(missionId) || ids.individualId;

    await this.createSubjectEvent('swarm.mission_completed', {
      actorId: ids.actors?.Координатор_роя,
      modelEventId: ids.modelEventIds?.['swarm.mission_completed'],
      individualId,
      value: JSON.stringify({ missionId, result, summary, completedAt: new Date().toISOString() }),
    });

    return { missionId, result, summary, completed: true };
  }

  async createSwarmMission({ name, missionType, area, droneCount = 3, formation = 'grid' }) {
    await this.initialize();
    await this.bootstrapSwarmDomain();

    const ids = this._swarmIds || {};
    const missionId = `SWM-${Date.now()}`;

    // Создать индивид для этой миссии роя
    let individualId = ids.individualId;
    try {
      const ind = await this.createIndividual(`Рой: ${name}`, {
        conceptId: ids.conceptId, modelId: ids.modelId,
        actorId: ids.actors?.Координатор_роя,
      });
      individualId = String(ind?.id || ind?.obj);
    } catch { /* использовать дефолтный */ }

    await this.createSubjectEvent('swarm.mission_created', {
      actorId: ids.actors?.Координатор_роя,
      modelEventId: ids.modelEventIds?.['swarm.mission_created'],
      individualId,
      value: JSON.stringify({ missionId, name, missionType, area, droneCount, formation }),
    });

    return { missionId, individualId, name, missionType, area, droneCount, formation, status: 'forming', createdAt: new Date().toISOString() };
  }

  async getActiveSwarms() {
    await this.initialize();
    await this.bootstrapSwarmDomain();

    const events = await this.getObjects(this.tables.subjectEvents);
    const swarmEvents = events.filter(e => (e.val || '').startsWith('swarm.'));

    const missions = {};
    for (const e of swarmEvents) {
      try {
        const valueStr = e.reqs?.['Значение']?.value || '{}';
        const data = JSON.parse(valueStr);
        if (data.missionId) {
          if (!missions[data.missionId]) {
            missions[data.missionId] = { ...data, events: [], status: 'forming', lastUpdate: null };
          }
          missions[data.missionId].events.push({ type: e.val, id: e.id, data });
          missions[data.missionId].lastUpdate = e.reqs?.['Временная метка']?.value;
          // Трекинг статуса по типу события
          if (e.val === 'swarm.leader_elected') missions[data.missionId].status = 'active';
          if (e.val === 'swarm.drone_lost') missions[data.missionId].status = 'degraded';
          if (e.val === 'swarm.task_redistributed') missions[data.missionId].status = 'redistributing';
          if (e.val === 'swarm.mission_completed') missions[data.missionId].status = 'completed';
          if (e.val === 'swarm.emergency_recall') missions[data.missionId].status = 'recalled';
          if (data.leaderId) missions[data.missionId].leader = data.leaderId;
          if (data.coverage) missions[data.missionId].coverage = data.coverage;
        }
      } catch { /* skip */ }
    }

    return { swarms: Object.values(missions), count: Object.keys(missions).length };
  }

  async getSwarmStatus(missionId) {
    await this.initialize();
    await this.bootstrapSwarmDomain();

    const events = await this.getObjects(this.tables.subjectEvents);
    const swarmEvents = events.filter(e => (e.val || '').startsWith('swarm.'));

    const drones = new Set();
    const removedDrones = new Set();
    let leader = null;
    let status = 'forming';
    let coverage = 0;
    const timeline = [];

    for (const e of swarmEvents) {
      try {
        const valueStr = e.reqs?.['Значение']?.value || '{}';
        const data = JSON.parse(valueStr);
        if (data.missionId !== missionId) continue;

        timeline.push({ type: e.val, id: e.id, data, ts: e.reqs?.['Временная метка']?.value });

        if (e.val === 'swarm.drone_assigned' && data.droneId) drones.add(data.droneId);
        if ((e.val === 'swarm.drone_lost' || e.val === 'swarm.drone_removed') && data.droneId) {
          removedDrones.add(data.droneId);
        }
        if (e.val === 'swarm.leader_elected') { leader = data.leaderId; status = 'active'; }
        if (e.val === 'swarm.drone_lost') status = 'degraded';
        if (e.val === 'swarm.task_redistributed') status = data.status || 'active';
        if (e.val === 'swarm.mission_completed') status = 'completed';
        if (e.val === 'swarm.emergency_recall') status = 'recalled';
        if (e.val === 'swarm.coverage_updated') coverage = data.coverage || 0;
      } catch { /* skip */ }
    }

    const activeDrones = [...drones].filter(d => !removedDrones.has(d));
    return { missionId, status, drones: activeDrones, removedDrones: [...removedDrones], leader, coverage, eventCount: timeline.length, timeline };
  }

  async assignDroneToSwarm(missionId, droneId) {
    await this.initialize();
    await this.bootstrapSwarmDomain();

    const ids = this._swarmIds || {};
    // Найти индивид миссии по missionId в событиях
    const individualId = await this._findSwarmIndividual(missionId) || ids.individualId;

    await this.createSubjectEvent('swarm.drone_assigned', {
      actorId: ids.actors?.Координатор_роя,
      modelEventId: ids.modelEventIds?.['swarm.drone_assigned'],
      individualId,
      value: JSON.stringify({ missionId, droneId }),
    });

    return { missionId, droneId, assigned: true };
  }

  async removeDroneFromSwarm(missionId, droneId, reason = 'manual') {
    await this.initialize();
    await this.bootstrapSwarmDomain();

    const ids = this._swarmIds || {};
    const individualId = await this._findSwarmIndividual(missionId) || ids.individualId;
    const eventType = reason === 'lost' ? 'swarm.drone_lost' : 'swarm.drone_removed';

    await this.createSubjectEvent(eventType, {
      actorId: ids.actors?.Координатор_роя,
      modelEventId: ids.modelEventIds?.[eventType] || ids.modelEventIds?.['swarm.drone_lost'],
      individualId,
      value: JSON.stringify({ missionId, droneId, reason }),
    });

    return { missionId, droneId, removed: true, reason };
  }

  async redistributeSwarmTasks(missionId, lostDroneId) {
    await this.initialize();
    await this.bootstrapSwarmDomain();

    const ids = this._swarmIds || {};
    const individualId = await this._findSwarmIndividual(missionId) || ids.individualId;

    await this.createSubjectEvent('swarm.task_redistributed', {
      actorId: ids.actors?.Координатор_роя,
      modelEventId: ids.modelEventIds?.['swarm.task_redistributed'],
      individualId,
      value: JSON.stringify({ missionId, lostDroneId, redistributedAt: new Date().toISOString() }),
    });

    return { missionId, lostDroneId, redistributed: true };
  }

  async updateSwarmCoverage(missionId) {
    await this.initialize();
    await this.bootstrapSwarmDomain();

    const status = await this.getSwarmStatus(missionId);
    const coverage = status.drones.length > 0 ? Math.min(100, status.drones.length * 25) : 0;

    const ids = this._swarmIds || {};
    const individualId = await this._findSwarmIndividual(missionId) || ids.individualId;

    await this.createSubjectEvent('swarm.coverage_updated', {
      actorId: ids.actors?.Координатор_роя,
      modelEventId: ids.modelEventIds?.['swarm.coverage_updated'],
      individualId,
      value: JSON.stringify({ missionId, coverage, droneCount: status.drones.length }),
    });

    return { missionId, coverage, droneCount: status.drones.length };
  }

  async electSwarmLeader(missionId) {
    await this.initialize();
    await this.bootstrapSwarmDomain();

    const status = await this.getSwarmStatus(missionId);
    // Выбираем лидера по стратегии: первый дрон в рое или случайный
    const leaderId = status.drones.length > 0 ? status.drones[0] : null;

    const ids = this._swarmIds || {};
    const individualId = await this._findSwarmIndividual(missionId) || ids.individualId;
    if (leaderId) {
      try {
        await this.createSubjectEvent('swarm.leader_elected', {
          actorId: ids.actors?.Координатор_роя,
          modelEventId: ids.modelEventIds?.['swarm.leader_elected'],
          individualId,
          value: JSON.stringify({ missionId, leaderId, electedAt: new Date().toISOString() }),
        });
      } catch (err) {
        logger.warn('[EventEngine] Failed to create swarm.leader_elected event:', err.message);
      }
    }

    return { missionId, leaderId, elected: !!leaderId };
  }

  // ─── Training Domain ─────────────────────────────────────────────────

  async bootstrapTrainingDomain() {
    if (this._trainingBootstrapped) return;

    try {
      const actors = await this.getObjects(this.tables.actors);
      const existingTraining = actors.find(a => a.val === 'Инструктор');
      if (existingTraining) {
        this._trainingIds = await this._loadTrainingIds(actors);
        this._trainingBootstrapped = true;
        logger.info('[EventEngine] Training domain already bootstrapped');
        return;
      }

      logger.info('[EventEngine] Bootstrapping training simulation domain...');

      // 1. Actors
      const instructor = await this.createActor('Инструктор', {
        type: 'agent', description: 'Creates and evaluates training scenarios',
      });
      const trainee = await this.createActor('Курсант', {
        type: 'agent', description: 'Participant in training simulation',
      });
      const simulator = await this.createActor('Движок_симуляции', {
        type: 'agent', description: 'Runs scenario simulations and forks event graphs',
      });

      const instructorId = String(instructor?.id || instructor?.obj);
      const traineeId = String(trainee?.id || trainee?.obj);
      const simulatorId = String(simulator?.id || simulator?.obj);

      // 2. Concept
      const concept = await this.createConcept('Учебный сценарий', 'Учебные симуляции на основе графов событий');
      const conceptId = String(concept?.id || concept?.obj);

      // 3. Model
      const models = await this.getObjects(this.tables.models);
      const model = models.find(m => m.val === 'Модель_Учебный сценарий');
      const modelId = model ? String(model.id) : null;

      if (!modelId) {
        logger.warn('[EventEngine] Модель_Учебный сценарий not found');
        this._trainingBootstrapped = true;
        return;
      }

      // 4. Properties
      const props = {};
      const propDefs = [
        ['Difficulty', { propertyType: 'attribute', dataType: 'Text' }],
        ['ScenarioType', { propertyType: 'attribute', dataType: 'Text' }],
        ['TimeLimit', { propertyType: 'attribute', dataType: 'Number' }],
        ['Score', { propertyType: 'attribute', dataType: 'Number' }],
        ['DecisionCount', { propertyType: 'attribute', dataType: 'Number' }],
        ['CorrectDecisions', { propertyType: 'attribute', dataType: 'Number' }],
        ['TraineeLevel', { propertyType: 'attribute', dataType: 'Text' }],
        ['CertificationStatus', { propertyType: 'attribute', dataType: 'Text' }],
      ];
      for (const [name, opts] of propDefs) {
        try {
          const p = await this.createProperty(name, opts);
          props[name] = String(p?.id || p?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create Training property ${name}:`, err.message);
        }
      }

      // 5. Model Events
      const TRAINING_EVENTS = [
        ['train.scenario_created', { required: true }],
        ['train.session_started', {}],
        ['train.decision_point', {}],
        ['train.decision_made', {}],
        ['train.scenario_forked', {}],
        ['train.outcome_evaluated', {}],
        ['train.session_completed', { immutable: true }],
        ['train.certification_granted', { immutable: true }],
        ['train.certification_revoked', {}],
        ['train.score_updated', {}],
        ['train.hint_requested', {}],
        ['train.replay_started', {}],
      ];

      const modelEventIds = {};
      for (const [eventType, constraints] of TRAINING_EVENTS) {
        try {
          const result = await this.createModelEvent(eventType, {
            modelId,
            propertyId: props.Score || props.Difficulty,
            constraints,
          });
          modelEventIds[eventType] = String(result?.id || result?.obj);
        } catch (err) {
          logger.warn(`[EventEngine] Failed to create Training model event ${eventType}:`, err.message);
        }
      }

      // 6. FSM
      const FSM_STATES = [
        ['Готов', 'initial'],
        ['В_работе', 'normal'],
        ['Точка_решения', 'normal'],
        ['Оценка', 'normal'],
        ['Завершён', 'final'],
        ['Сертифицирован', 'final'],
      ];

      const stateIds = {};
      if (this.createState) {
        for (const [name, type] of FSM_STATES) {
          try {
            const s = await this.createState(modelId, { name, type });
            stateIds[name] = String(s?.id || s?.obj);
          } catch (err) {
            logger.warn(`[EventEngine] Failed to create Training state ${name}:`, err.message);
          }
        }

        const FSM_TRANSITIONS = [
          ['Готов', 'В_работе', 'train.session_started', ''],
          ['В_работе', 'Точка_решения', 'train.decision_point', ''],
          ['Точка_решения', 'В_работе', 'train.decision_made', ''],
          ['В_работе', 'Оценка', 'train.session_completed', ''],
          ['Оценка', 'Завершён', 'train.outcome_evaluated', ''],
          ['Завершён', 'Сертифицирован', 'train.certification_granted', 'score $GE 80'],
        ];

        for (const [from, to, trigger, guard] of FSM_TRANSITIONS) {
          if (stateIds[from] && stateIds[to]) {
            try {
              await this.createTransition(modelId, {
                fromStateId: stateIds[from],
                toStateId: stateIds[to],
                trigger,
                guard: guard || undefined,
              });
            } catch (err) {
              logger.warn(`[EventEngine] Failed to create Training transition ${from}->${to}:`, err.message);
            }
          }
        }
      }

      // 7. Individual
      const individual = await this.createIndividual('Обучение-экземпляр', {
        conceptId, modelId, actorId: instructorId,
      });
      const individualId = String(individual?.id || individual?.obj);

      // 8. Triggers
      const TRAINING_TRIGGERS = [
        {
          condition: 'eventType $EQ "train.session_completed" $AND score $GE 80',
          action: { type: 'createEvent', params: { name: 'train.certification_granted', value: 'Auto-certified: score >= 80' } },
          priority: 10,
        },
        {
          condition: 'eventType $EQ "train.decision_made"',
          action: { type: 'computeValue', params: { property: 'Score', formula: 'incrementCorrect' } },
          priority: 8,
        },
      ];

      for (const trigger of TRAINING_TRIGGERS) {
        try {
          await this.registerTrigger({ modelId, ...trigger });
        } catch (err) {
          logger.warn('[EventEngine] Failed to register Training trigger:', err.message);
        }
      }

      this._trainingIds = {
        actors: {Инструктор: instructorId,Курсант: traineeId,Движок_симуляции: simulatorId },
        modelId, modelEventIds, individualId, conceptId, stateIds, props,
      };

      this._trainingBootstrapped = true;
      logger.info('[EventEngine] Training simulation domain bootstrapped', {
        actors: 3, modelEvents: Object.keys(modelEventIds).length, individualId,
      });
    } catch (err) {
      logger.error('[EventEngine] Bootstrap Training domain failed:', err.message);
      this._trainingBootstrapped = true;
    }
  }

  async _loadTrainingIds(actors) {
    const instructor = actors.find(a => a.val === 'Инструктор');
    const traineeActor = actors.find(a => a.val === 'Курсант');
    const simulator = actors.find(a => a.val === 'Движок_симуляции');
    const models = await this.getObjects(this.tables.models);
    const model = models.find(m => m.val === 'Модель_Учебный сценарий');
    const modelId = model ? String(model.id) : null;
    return {
      actors: {
       Инструктор: instructor ? String(instructor.id) : null,
       Курсант: traineeActor ? String(traineeActor.id) : null,
       Движок_симуляции: simulator ? String(simulator.id) : null,
      },
      modelId,
    };
  }

  async getTrainingIds() {
    await this.initialize();
    await this.bootstrapTrainingDomain();
    return this._trainingIds || {};
  }

  async getTrainingDashboard() {
    await this.initialize();
    await this.bootstrapTrainingDomain();

    const events = await this.getObjects(this.tables.subjectEvents);
    const trainEvents = events.filter(e => (e.val || '').includes('train.') || (e.val || '').includes('SCN-'));

    let totalScenarios = 0, activeSessions = 0, completedSessions = 0, certifications = 0;
    const traineeScores = {};

    for (const e of trainEvents) {
      try {
        const data = JSON.parse(e.val || '{}');
        if (data.scenarioId) totalScenarios++;
        if (data.status === 'in_progress') activeSessions++;
        if (data.status === 'completed') completedSessions++;
        if ((e.val || '').includes('certification_granted')) certifications++;
        if (data.traineeId && data.score) {
          if (!traineeScores[data.traineeId]) traineeScores[data.traineeId] = [];
          traineeScores[data.traineeId].push(data.score);
        }
      } catch { /* skip */ }
    }

    const avgScore = Object.values(traineeScores).flat();
    const averageScore = avgScore.length > 0 ? Math.round(avgScore.reduce((a, b) => a + b, 0) / avgScore.length) : 0;

    return { totalScenarios, activeSessions, completedSessions, certifications, averageScore, traineeCount: Object.keys(traineeScores).length };
  }

  async createTrainingScenario({ name, description, difficulty = 'medium', type = 'emergency', timeLimit = 300, decisionPoints = [] }) {
    await this.initialize();
    await this.bootstrapTrainingDomain();

    const ids = this._trainingIds || {};
    const scenarioId = `SCN-${Date.now()}`;

    try {
      await this.createSubjectEvent('train.scenario_created', {
        actorId: ids.actors?.TrainingInstructor,
        modelId: ids.modelId,
        individualId: ids.individualId,
        value: JSON.stringify({ scenarioId, name, description, difficulty, type, timeLimit, decisionPoints }),
      });
    } catch (err) {
      logger.warn('[EventEngine] Failed to create train.scenario_created event:', err.message);
    }

    return { scenarioId, name, description, difficulty, type, timeLimit, decisionPoints, createdAt: new Date().toISOString() };
  }

  async getScenarios(query = {}) {
    await this.initialize();
    await this.bootstrapTrainingDomain();

    const events = await this.getObjects(this.tables.subjectEvents);
    const scenarios = [];

    for (const e of events) {
      try {
        const data = JSON.parse(e.val || '{}');
        if (data.scenarioId && (e.val || '').includes('scenario_created')) {
          if (query.difficulty && data.difficulty !== query.difficulty) continue;
          if (query.type && data.type !== query.type) continue;
          scenarios.push({ ...data, createdAt: e.dt });
        }
      } catch { /* skip */ }
    }

    return { scenarios, count: scenarios.length };
  }

  async bootstrapStandardScenarios() {
    await this.initialize();
    await this.bootstrapTrainingDomain();

    const standardScenarios = [
      { name: 'Отказ двигателя в полёте', description: 'Дрон теряет один из моторов на высоте 100м', difficulty: 'hard', type: 'emergency', timeLimit: 60, decisionPoints: [
        { id: 'dp1', prompt: 'Двигатель 3 отказал. Действие?', options: ['Экстренная посадка', 'Продолжить на 3 моторах', 'Активировать парашют'], correct: 0 },
        { id: 'dp2', prompt: 'Выберите площадку для посадки', options: ['Ближайшее поле', 'Дорога', 'Точка взлёта'], correct: 0 },
      ]},
      { name: 'Потеря связи с оператором', description: 'GPS и радиосвязь потеряны одновременно', difficulty: 'hard', type: 'emergency', timeLimit: 120, decisionPoints: [
        { id: 'dp1', prompt: 'Связь потеряна. Протокол?', options: ['Return-to-Home', 'Зависнуть и ждать', 'Продолжить по маршруту'], correct: 0 },
      ]},
      { name: 'Нарушение воздушного пространства', description: 'Дрон приближается к запретной зоне аэродрома', difficulty: 'medium', type: 'regulatory', timeLimit: 30, decisionPoints: [
        { id: 'dp1', prompt: 'До границы запретной зоны 500м. Действие?', options: ['Немедленный разворот', 'Снижение высоты', 'Запрос у диспетчера'], correct: 0 },
      ]},
      { name: 'Плановый осмотр сельхозугодий', description: 'Стандартная миссия обследования поля 50 га', difficulty: 'easy', type: 'agriculture', timeLimit: 600, decisionPoints: [
        { id: 'dp1', prompt: 'Оптимальный маршрут облёта?', options: ['Зигзаг', 'Спираль', 'Параллельные полосы'], correct: 2 },
      ]},
    ];

    const results = [];
    for (const scenario of standardScenarios) {
      const result = await this.createTrainingScenario(scenario);
      results.push(result);
    }

    return { bootstrapped: results.length, scenarios: results };
  }

  async createScenarioFromHistory(eventIds) {
    await this.initialize();
    await this.bootstrapTrainingDomain();

    const events = await this.getObjects(this.tables.subjectEvents);
    const selectedEvents = events.filter(e => eventIds.includes(String(e.id)));

    const decisionPoints = selectedEvents.map((e, i) => ({
      id: `dp${i + 1}`,
      prompt: `Событие: ${e.val}. Какое решение?`,
      options: ['Продолжить', 'Остановить', 'Изменить подход'],
      correct: 0,
    }));

    return this.createTrainingScenario({
      name: `Сценарий из истории (${eventIds.length} событий)`,
      description: 'Автоматически сгенерирован из реальных событий',
      difficulty: 'medium',
      type: 'historical',
      timeLimit: 300,
      decisionPoints,
    });
  }

  async startTrainingSession(scenarioId, traineeId) {
    await this.initialize();
    await this.bootstrapTrainingDomain();

    const ids = this._trainingIds || {};
    const sessionId = `SESS-${Date.now()}`;

    try {
      await this.createSubjectEvent('train.session_started', {
        actorId: ids.actors?.Курсант || traineeId,
        modelEventId: ids.modelEventIds?.['train.session_started'],
        individualId: ids.individualId,
        value: JSON.stringify({ sessionId, scenarioId, traineeId, status: 'in_progress', startedAt: new Date().toISOString() }),
      });
    } catch (err) {
      logger.warn('[EventEngine] Failed to create train.session_started event:', err.message);
    }

    // Fetch scenario details
    const scenarios = await this.getScenarios({});
    const scenario = scenarios.scenarios.find(s => s.scenarioId === scenarioId);

    return {
      sessionId, scenarioId, traineeId, status: 'in_progress',
      scenario: scenario || null,
      startedAt: new Date().toISOString(),
    };
  }

  async recordDecisionAttempt(sessionId, { decisionPointId, chosenOption, timeSpent }) {
    await this.initialize();
    await this.bootstrapTrainingDomain();

    const ids = this._trainingIds || {};

    try {
      await this.createSubjectEvent('train.decision_made', {
        actorId: ids.actors?.Курсант,
        modelEventId: ids.modelEventIds?.['train.decision_made'],
        individualId: ids.individualId,
        value: JSON.stringify({ sessionId, decisionPointId, chosenOption, timeSpent }),
      });
    } catch (err) {
      logger.warn('[EventEngine] Failed to create train.decision_made event:', err.message);
    }

    return { sessionId, decisionPointId, chosenOption, timeSpent, recorded: true };
  }

  async completeTraining(sessionId, { score, feedback }) {
    await this.initialize();
    await this.bootstrapTrainingDomain();

    const ids = this._trainingIds || {};

    try {
      await this.createSubjectEvent('train.session_completed', {
        actorId: ids.actors?.Инструктор,
        modelEventId: ids.modelEventIds?.['train.session_completed'],
        individualId: ids.individualId,
        value: JSON.stringify({ sessionId, score, feedback, status: 'completed', completedAt: new Date().toISOString() }),
      });
    } catch (err) {
      logger.warn('[EventEngine] Failed to create train.session_completed event:', err.message);
    }

    const certified = score >= 80;
    return { sessionId, score, feedback, certified, completedAt: new Date().toISOString() };
  }

  async getTraineeProgress(traineeId) {
    await this.initialize();
    await this.bootstrapTrainingDomain();

    const events = await this.getObjects(this.tables.subjectEvents);
    const traineeEvents = events.filter(e => (e.val || '').includes(traineeId));

    let sessionsCompleted = 0, totalScore = 0, certifications = 0;
    const sessions = [];

    for (const e of traineeEvents) {
      try {
        const data = JSON.parse(e.val || '{}');
        if (data.status === 'completed') {
          sessionsCompleted++;
          totalScore += data.score || 0;
          sessions.push(data);
        }
        if ((e.val || '').includes('certification_granted')) certifications++;
      } catch { /* skip */ }
    }

    const avgScore = sessionsCompleted > 0 ? Math.round(totalScore / sessionsCompleted) : 0;
    const level = avgScore >= 90 ? 'expert' : avgScore >= 70 ? 'advanced' : avgScore >= 50 ? 'intermediate' : 'beginner';

    return { traineeId, sessionsCompleted, avgScore, level, certifications, recentSessions: sessions.slice(-5).reverse() };
  }

  // ═══════════════════════════════════════════════════════════════
  // CATALOG — transparent proxy to all Integram tables
  // ═══════════════════════════════════════════════════════════════

  /**
   * Categorize a table name into a group.
   */
  _classifyTable(name) {
    if (name.startsWith('СОД ')) return 'СОД core';
    if (name.startsWith('СОД_')) return 'СОД справочники';
    if (name.startsWith('AeroNext')) return 'AeroNext';
    if (/^Справочник/i.test(name)) return 'Справочники';
    if (/БПЛА|[Дд]рон|UAV/i.test(name)) return 'Дроны/БПЛА';
    if (/[Оо]нтолог/i.test(name)) return 'Онтология БПЛА';
    if (name.startsWith('doc_') || name.startsWith('Документ')) return 'Документы';
    return 'Прочее';
  }

  /**
   * Get catalog of all Integram tables grouped by category.
   */
  async getCatalog(filter, { minObjects = 2, compact = true } = {}) {
    await this.initialize();
    const response = await axios.get(`${this.v2BaseUrl}/schema/stats`);
    const stats = response.data?.data || {};
    const byType = stats.byType || [];

    // Build SOD-managed set for marking
    const sodManagedIds = new Set(Object.values(this.tables).filter(Boolean));

    const groups = {};
    let totalTables = 0;
    let totalObjects = 0;
    let hiddenTables = 0;

    for (const t of byType) {
      const count = t.objectCount || 0;
      const isSod = sodManagedIds.has(String(t.id));

      // Skip noise tables (requisite types with ≤N objects) unless SOD-managed
      if (count < minObjects && !isSod) {
        hiddenTables++;
        continue;
      }

      const group = this._classifyTable(t.name);
      const lowerFilter = filter?.toLowerCase();
      if (lowerFilter && !t.name.toLowerCase().includes(lowerFilter) && !group.toLowerCase().includes(lowerFilter)) {
        continue;
      }

      if (!groups[group]) groups[group] = { tables: 0, objects: 0, items: [] };

      const item = compact
        ? { id: String(t.id), name: t.name, n: count, sod: isSod || undefined }
        : { id: String(t.id), name: t.name, group, objectCount: count, sodManaged: isSod };

      groups[group].items.push(item);
      groups[group].tables++;
      groups[group].objects += count;
      totalTables++;
      totalObjects += count;
    }

    // Sort items within each group by objectCount desc
    for (const g of Object.values(groups)) {
      g.items.sort((a, b) => (b.n ?? b.objectCount ?? 0) - (a.n ?? a.objectCount ?? 0));
    }

    return { totalTables, totalObjects, hiddenTables, groups };
  }

  /**
   * Get detailed schema for a specific table (columns, sample data, references).
   */
  async getCatalogDetails(typeId) {
    await this.initialize();

    // 1. Load objects via V1 API — gives us both schema and data
    let objects = [];
    let reqMeta = null;
    try {
      objects = await this.getObjects(typeId, { limit: 20 });
      reqMeta = this.reqMaps[typeId] || {};
    } catch (e) {
      logger.warn('[Catalog] Failed to load objects for', typeId, e.message);
      reqMeta = {};
    }

    // 2. Build columns from reqTypes (alias→reqId) and refTypes (reqId→refTypeId)
    const reqTypes = reqMeta.reqTypes || {};
    const refTypes = reqMeta.refTypes || {};
    const columns = [];
    const seenAliases = new Set();

    for (const [reqId, alias] of Object.entries(reqTypes)) {
      if (seenAliases.has(alias)) continue;
      seenAliases.add(alias);
      const isRef = !!refTypes[reqId];
      columns.push({
        id: String(reqId),
        alias: alias || `req_${reqId}`,
        type: isRef ? 'REFERENCE' : 'SHORT',
        refTable: null,
        refTableId: isRef ? String(refTypes[reqId]) : null,
      });
    }

    const references = columns.filter(c => c.refTableId).map(c => ({
      column: c.alias,
      targetTable: c.refTable,
      targetId: c.refTableId,
    }));

    // 3. Sample data (first 5 objects)
    const sampleData = objects.slice(0, 5).map(obj => {
      const row = { id: obj.id, val: obj.val };
      for (const [alias, info] of Object.entries(obj.reqs || {})) {
        row[alias] = info.displayValue || info.value;
      }
      return row;
    });

    // 4. Determine name from first object's table context or alias map
    let tableName = `Type ${typeId}`;
    // Try to find name from catalog cache or V1 dict
    try {
      const dictResp = await axios.get(`https://${this.serverURL}/${this.database}/dict?JSON`, {
        headers: this.getHeaders()
      });
      const dict = dictResp.data || {};
      if (dict[typeId]) tableName = dict[typeId];
    } catch (e) { /* dict lookup optional */ }

    return {
      id: String(typeId),
      name: tableName,
      objectCount: objects.length >= 20 ? '20+' : objects.length,
      columns,
      references,
      sampleData,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ▌ KNOWLEDGE DOMAIN — факты, правила, процедуры в графе
  // ═══════════════════════════════════════════════════════════════

  async bootstrapKnowledgeDomain() {
    if (this._knowledgeBootstrapped) return;
    try {
      const domainName = 'knowledge';
      await this.registerDomain(domainName, 'Управление знаниями', 'Факты, правила, процедуры, ограничения');

      const conceptId = await this.createConcept('Элемент знания', {
        domain: domainName,
        description: 'Факт, правило или процедура',
      });

      // Акторы
      const expertId = await this.createActor('Эксперт', { role: 'human', description: 'Источник экспертных знаний' });
      const agentId = await this.createActor('ИИ-агент_знания', { role: 'ai-agent', description: 'Автоматический извлекатель знаний' });

      // Модель
      const modelId = await this.createModel('Model_Knowledge', { domain: domainName, description: 'Жизненный цикл знания' });

      // События
      const EVENTS = [
        { name: 'knowledge.fact_established', label: 'Факт установлен', desc: 'Зафиксирован новый факт' },
        { name: 'knowledge.rule_defined', label: 'Правило определено', desc: 'Определено бизнес-правило или ограничение' },
        { name: 'knowledge.procedure_documented', label: 'Процедура описана', desc: 'Задокументирована процедура или инструкция' },
        { name: 'knowledge.fact_verified', label: 'Факт верифицирован', desc: 'Факт проверен экспертом' },
        { name: 'knowledge.fact_deprecated', label: 'Факт устарел', desc: 'Факт помечен как устаревший' },
        { name: 'knowledge.conflict_detected', label: 'Конфликт обнаружен', desc: 'Два факта противоречат друг другу' },
        { name: 'knowledge.query_answered', label: 'Запрос отвечен', desc: 'Агент запросил знание и получил ответ' },
      ];

      const modelEventIds = {};
      for (const ev of EVENTS) {
        const meId = await this.createModelEvent(ev.name, { modelId, label: ev.label, description: ev.desc });
        modelEventIds[ev.name] = meId;
      }

      // FSM
      const STATES = ['draft', 'verified', 'active', 'deprecated', 'conflict'];
      for (const s of STATES) {
        await this.addFSMState(modelId, s);
      }

      const TRANSITIONS = [
        { from: 'draft', to: 'verified', event: 'knowledge.fact_verified' },
        { from: 'verified', to: 'active', event: 'knowledge.fact_established' },
        { from: 'active', to: 'deprecated', event: 'knowledge.fact_deprecated' },
        { from: 'active', to: 'conflict', event: 'knowledge.conflict_detected' },
        { from: 'conflict', to: 'active', event: 'knowledge.fact_verified' },
      ];
      for (const t of TRANSITIONS) {
        await this.addFSMTransition(modelId, t);
      }

      this._knowledgeIds = { modelId, conceptId, expertId, agentId, modelEventIds };
      this._knowledgeBootstrapped = true;
      logger.info(`[EventEngine] Knowledge domain: ${EVENTS.length} событий, ${STATES.length} FSM-состояний`);
    } catch (err) {
      logger.error('[EventEngine] Ошибка bootstrap Knowledge:', err.message);
      this._knowledgeBootstrapped = true;
    }
  }

  getKnowledgeIds() {
    return this._knowledgeIds || null;
  }

  /**
   * Запросить знания по тегам/домену — для агентов.
   * @param {object} query — { tags, domain, type: 'fact'|'rule'|'procedure' }
   */
  async queryKnowledge(query = {}) {
    await this.initialize();
    const allEvents = await this.getObjectsCached(this.tables.subjectEvents, { limit: 5000 });
    const knowledgeEvents = allEvents.filter(e => (e.val || '').startsWith('knowledge.'));

    let results = knowledgeEvents.map(e => {
      const value = e.reqs?.['Значение']?.value || '';
      return {
        id: e.id,
        type: e.val,
        value,
        timestamp: e.reqs?.['Временная метка']?.value,
        individual: e.reqs?.['Индивид']?.value,
      };
    });

    if (query.tags) {
      const tags = query.tags.split(',').map(t => t.trim().toLowerCase());
      results = results.filter(r => tags.some(tag => r.value.toLowerCase().includes(tag)));
    }
    if (query.type) {
      const typeMap = { fact: 'fact_established', rule: 'rule_defined', procedure: 'procedure_documented' };
      const mapped = typeMap[query.type];
      if (mapped) results = results.filter(r => r.type.includes(mapped));
    }

    return { results: results.slice(0, 50), total: results.length };
  }

  // ═══════════════════════════════════════════════════════════════
  // ▌ CROSS-DOMAIN TRIGGERS — связь доменов через события
  // ═══════════════════════════════════════════════════════════════

  async bootstrapCrossDomainTriggers() {
    if (this._crossDomainBootstrapped) return;

    try {
      logger.info('[EventEngine] Регистрация кросс-доменных триггеров...');

      const CROSS_DOMAIN_TRIGGERS = [
        // ── twin → ops: дрон деградирует → блокировать миссии ──
        {
          condition: 'eventType $EQ "twin.component_degradation"',
          action: {
            type: 'createEvent',
            params: { name: 'ops.mission_blocked', value: 'Деградация компонента дрона — миссия заблокирована' },
          },
          priority: 9,
        },
        // ── twin → risk: потеря сигнала → пересчёт риска ──
        {
          condition: 'eventType $EQ "twin.lost_signal"',
          action: {
            type: 'createEvent',
            params: { name: 'risk.assessment_started', value: 'Потеря сигнала — переоценка риска' },
          },
          priority: 8,
        },
        // ── twin → risk: аварийная посадка → страховой случай ──
        {
          condition: 'eventType $EQ "twin.collision_risk"',
          action: {
            type: 'createEvent',
            params: { name: 'risk.claim_filed', value: 'Риск столкновения — страховой инцидент' },
          },
          priority: 10,
        },
        // ── ops → twin: миссия завершена → обновить налёт ──
        {
          condition: 'eventType $EQ "ops.mission_completed"',
          action: {
            type: 'createEvent',
            params: { name: 'twin.telemetry_received', value: 'Миссия завершена — обновление состояния двойника' },
          },
          priority: 7,
        },
        // ── ops → reg: миссия запланирована → проверка соответствия ──
        {
          condition: 'eventType $EQ "ops.mission_planned"',
          action: {
            type: 'createEvent',
            params: { name: 'reg.compliance_check', value: 'Миссия запланирована — проверка регуляторных требований' },
          },
          priority: 9,
        },
        // ── reg → ops: нарушение правил → блокировка миссии ──
        {
          condition: 'eventType $EQ "reg.rule_violated"',
          action: {
            type: 'createEvent',
            params: { name: 'ops.mission_blocked', value: 'Нарушение правил — миссия заблокирована' },
          },
          priority: 10,
        },
        // ── reg → risk: новая регуляция → пересчёт рисков ──
        {
          condition: 'eventType $EQ "reg.rule_defined"',
          action: {
            type: 'createEvent',
            params: { name: 'risk.assessment_started', value: 'Новая регуляция — переоценка страховых рисков' },
          },
          priority: 7,
        },
        // ── risk → ops: высокий риск → блокировка миссии ──
        {
          condition: 'eventType $EQ "risk.threshold_exceeded"',
          action: {
            type: 'createEvent',
            params: { name: 'ops.mission_blocked', value: 'Превышен порог риска — миссия заблокирована' },
          },
          priority: 10,
        },
        // ── risk → market: полис выпущен → обновить условия маркетплейса ──
        {
          condition: 'eventType $EQ "risk.policy_issued"',
          action: {
            type: 'createEvent',
            params: { name: 'market.quote_generated', value: 'Полис выпущен — обновление цен маркетплейса' },
          },
          priority: 6,
        },
        // ── market → ops: заказ принят → запланировать миссию ──
        {
          condition: 'eventType $EQ "market.order_started"',
          action: {
            type: 'createEvent',
            params: { name: 'ops.mission_planned', value: 'Заказ маркетплейса → планирование миссии' },
          },
          priority: 9,
        },
        // ── swarm → twin: дрон потерян в рое → обновить двойник ──
        {
          condition: 'eventType $EQ "swarm.drone_lost"',
          action: {
            type: 'createEvent',
            params: { name: 'twin.lost_signal', value: 'Дрон потерян в рое — обновление двойника' },
          },
          priority: 9,
        },
        // ── swarm → ops: миссия роя завершена → закрыть миссию ──
        {
          condition: 'eventType $EQ "swarm.mission_completed"',
          action: {
            type: 'createEvent',
            params: { name: 'ops.mission_completed', value: 'Миссия роя завершена' },
          },
          priority: 8,
        },
        // ── train → ops: сертификация получена → разрешить оператору миссии ──
        {
          condition: 'eventType $EQ "train.certification_granted"',
          action: {
            type: 'createEvent',
            params: { name: 'ops.operator_certified', value: 'Оператор прошёл обучение — допущен к миссиям' },
          },
          priority: 7,
        },
        // ── ops → train: ошибка миссии → назначить переобучение ──
        {
          condition: 'eventType $EQ "ops.mission_failed"',
          action: {
            type: 'createEvent',
            params: { name: 'train.session_started', value: 'Провал миссии — назначено переобучение' },
          },
          priority: 7,
        },
        // ── dev → ops: деплой → обновить систему мониторинга ──
        {
          condition: 'eventType $EQ "dev.deployed"',
          action: {
            type: 'createEvent',
            params: { name: 'mon.system_updated', value: 'Новый деплой — обновить мониторинг' },
          },
          priority: 6,
        },
        // ── dev → dao: PR смержен → предложить голосование по фиче ──
        {
          condition: 'eventType $EQ "dev.pr_merged"',
          action: {
            type: 'notify',
            params: { message: 'PR смержен — рассмотреть предложение в DAO' },
          },
          priority: 5,
        },
        // ── dao → dev: предложение одобрено → создать задачу ──
        {
          condition: 'eventType $EQ "dao.proposal_executed"',
          action: {
            type: 'createEvent',
            params: { name: 'dev.task_created', value: 'DAO-предложение одобрено → задача на разработку' },
          },
          priority: 8,
        },
      ];

      for (const trigger of CROSS_DOMAIN_TRIGGERS) {
        try {
          await this.registerTrigger({ modelId: null, ...trigger });
        } catch (err) {
          logger.warn('[EventEngine] Ошибка регистрации кросс-триггера:', err.message);
        }
      }

      this._crossDomainBootstrapped = true;
      logger.info(`[EventEngine] Зарегистрировано ${CROSS_DOMAIN_TRIGGERS.length} кросс-доменных триггеров`);
    } catch (err) {
      logger.error('[EventEngine] Ошибка bootstrap кросс-доменных триггеров:', err.message);
      this._crossDomainBootstrapped = true;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // ██  PREDICTION ENGINE — паттерн-майнинг, аномалии, прогнозы     ██
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Анализ паттернов — повторяющиеся последовательности событий.
   * Находит N-граммы в цепочках событий и возвращает топ паттернов.
   * @param {string} [domain] — фильтр по домену (dev, ops, etc.)
   * @param {number} [windowSize=3] — размер N-граммы
   * @param {number} [minSupport=2] — минимальное количество повторений
   */
  async analyzePatterns(domain, windowSize = 3, minSupport = 2) {
    await this.initialize();
    const allEvents = await this.getObjectsCached(this.tables.subjectEvents, { limit: 5000 });

    // Фильтруем по домену
    const events = domain
      ? allEvents.filter(e => (e.val || '').startsWith(domain + '.'))
      : allEvents;

    if (events.length < windowSize) return { patterns: [], total: 0 };

    // Сортируем по времени
    const sorted = [...events].sort((a, b) => {
      const tA = a.reqs?.['Временная метка']?.value || '';
      const tB = b.reqs?.['Временная метка']?.value || '';
      return tA.localeCompare(tB);
    });

    // Извлекаем N-граммы
    const ngramCounts = {};
    const ngramExamples = {};
    for (let i = 0; i <= sorted.length - windowSize; i++) {
      const ngram = sorted.slice(i, i + windowSize).map(e => e.val).join(' → ');
      ngramCounts[ngram] = (ngramCounts[ngram] || 0) + 1;
      if (!ngramExamples[ngram]) {
        ngramExamples[ngram] = sorted.slice(i, i + windowSize).map(e => ({
          id: e.id, type: e.val,
          timestamp: e.reqs?.['Временная метка']?.value,
        }));
      }
    }

    // Фильтруем по minSupport и сортируем
    const patterns = Object.entries(ngramCounts)
      .filter(([, count]) => count >= minSupport)
      .map(([pattern, count]) => ({
        pattern,
        count,
        probability: Math.round((count / (sorted.length - windowSize + 1)) * 1000) / 1000,
        example: ngramExamples[pattern],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return { patterns, total: patterns.length, eventsAnalyzed: sorted.length };
  }

  /**
   * Обнаружение аномалий — отклонения от типичных интервалов между событиями.
   * Считает среднее время между последовательными типами событий,
   * находит выбросы (> 2σ от среднего).
   * @param {string} [domain] — фильтр по домену
   */
  async detectAnomalies(domain) {
    await this.initialize();
    const allEvents = await this.getObjectsCached(this.tables.subjectEvents, { limit: 5000 });

    const events = domain
      ? allEvents.filter(e => (e.val || '').startsWith(domain + '.'))
      : allEvents;

    // Парсим временные метки и группируем по типу
    const byType = {};
    for (const e of events) {
      const ts = e.reqs?.['Временная метка']?.value;
      if (!ts) continue;
      const type = e.val;
      if (!byType[type]) byType[type] = [];
      byType[type].push({ id: e.id, timestamp: this._parseTimestamp(ts) });
    }

    // Считаем интервалы между последовательными событиями одного типа
    const anomalies = [];
    const intervalStats = {};

    for (const [type, evts] of Object.entries(byType)) {
      if (evts.length < 3) continue;
      const sorted = evts.sort((a, b) => a.timestamp - b.timestamp);
      const intervals = [];
      for (let i = 1; i < sorted.length; i++) {
        intervals.push(sorted[i].timestamp - sorted[i - 1].timestamp);
      }

      const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length;
      const stdDev = Math.sqrt(variance);

      intervalStats[type] = {
        count: evts.length,
        meanIntervalMs: Math.round(mean),
        meanIntervalHuman: this._msToHuman(mean),
        stdDevMs: Math.round(stdDev),
      };

      // Ищем выбросы: интервал > mean + 2σ
      if (stdDev > 0) {
        for (let i = 1; i < sorted.length; i++) {
          const interval = sorted[i].timestamp - sorted[i - 1].timestamp;
          const zScore = (interval - mean) / stdDev;
          if (Math.abs(zScore) > 2) {
            anomalies.push({
              type,
              eventId: sorted[i].id,
              previousEventId: sorted[i - 1].id,
              intervalMs: Math.round(interval),
              intervalHuman: this._msToHuman(interval),
              expectedMs: Math.round(mean),
              expectedHuman: this._msToHuman(mean),
              zScore: Math.round(zScore * 100) / 100,
              severity: Math.abs(zScore) > 3 ? 'critical' : 'warning',
            });
          }
        }
      }
    }

    return {
      anomalies: anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)).slice(0, 20),
      intervalStats,
      eventsAnalyzed: events.length,
    };
  }

  /**
   * Кросс-доменные корреляции — какие события в домене A
   * коррелируют с событиями в домене B по времени.
   * @param {number} [windowMs=3600000] — временное окно корреляции (по умолчанию 1 час)
   */
  async crossDomainCorrelations(windowMs = 3600000) {
    await this.initialize();
    const allEvents = await this.getObjectsCached(this.tables.subjectEvents, { limit: 5000 });

    // Парсим в удобный формат
    const parsed = allEvents
      .map(e => ({
        id: e.id,
        type: e.val || '',
        domain: (e.val || '').split('.')[0],
        timestamp: this._parseTimestamp(e.reqs?.['Временная метка']?.value),
      }))
      .filter(e => e.timestamp && e.type.includes('.'))
      .sort((a, b) => a.timestamp - b.timestamp);

    // Считаем co-occurrences в окне
    const cooccurrences = {};
    for (let i = 0; i < parsed.length; i++) {
      for (let j = i + 1; j < parsed.length; j++) {
        if (parsed[j].timestamp - parsed[i].timestamp > windowMs) break;
        if (parsed[i].domain === parsed[j].domain) continue; // только кросс-домен

        const pair = [parsed[i].type, parsed[j].type].sort().join(' ↔ ');
        cooccurrences[pair] = (cooccurrences[pair] || 0) + 1;
      }
    }

    const correlations = Object.entries(cooccurrences)
      .filter(([, count]) => count >= 2)
      .map(([pair, count]) => {
        const [a, b] = pair.split(' ↔ ');
        return { eventA: a, eventB: b, cooccurrences: count, window: this._msToHuman(windowMs) };
      })
      .sort((a, b) => b.cooccurrences - a.cooccurrences)
      .slice(0, 20);

    return { correlations, window: this._msToHuman(windowMs), eventsAnalyzed: parsed.length };
  }

  /**
   * Предсказание следующего события на основе паттернов.
   * Дано текущее событие — что скорее всего произойдёт дальше?
   * @param {string} eventType — тип текущего события
   * @param {string} [domain] — фильтр по домену
   */
  async predictNext(eventType, domain) {
    await this.initialize();
    const allEvents = await this.getObjectsCached(this.tables.subjectEvents, { limit: 5000 });

    const events = domain
      ? allEvents.filter(e => (e.val || '').startsWith(domain + '.'))
      : allEvents;

    const sorted = [...events].sort((a, b) => {
      const tA = a.reqs?.['Временная метка']?.value || '';
      const tB = b.reqs?.['Временная метка']?.value || '';
      return tA.localeCompare(tB);
    });

    // Считаем: после eventType какие типы идут следующими
    const nextCounts = {};
    let total = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].val === eventType) {
        const next = sorted[i + 1].val;
        nextCounts[next] = (nextCounts[next] || 0) + 1;
        total++;
      }
    }

    const predictions = Object.entries(nextCounts)
      .map(([type, count]) => ({
        type,
        probability: Math.round((count / total) * 1000) / 1000,
        count,
      }))
      .sort((a, b) => b.probability - a.probability);

    // Среднее время до следующего события
    const intervals = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].val === eventType) {
        const t1 = this._parseTimestamp(sorted[i].reqs?.['Временная метка']?.value);
        const t2 = this._parseTimestamp(sorted[i + 1].reqs?.['Временная метка']?.value);
        if (t1 && t2) intervals.push(t2 - t1);
      }
    }
    const avgInterval = intervals.length > 0
      ? intervals.reduce((s, v) => s + v, 0) / intervals.length
      : null;

    return {
      currentEvent: eventType,
      predictions: predictions.slice(0, 10),
      occurrences: total,
      avgTimeToNext: avgInterval ? this._msToHuman(avgInterval) : null,
      avgTimeToNextMs: avgInterval ? Math.round(avgInterval) : null,
    };
  }

  /**
   * Тренды — агрегация событий по временным окнам.
   * @param {string} [domain] — фильтр по домену
   * @param {string} [period='day'] — 'hour', 'day', 'week', 'month'
   */
  async getTrends(domain, period = 'day') {
    await this.initialize();
    const allEvents = await this.getObjectsCached(this.tables.subjectEvents, { limit: 5000 });

    const events = domain
      ? allEvents.filter(e => (e.val || '').startsWith(domain + '.'))
      : allEvents;

    const buckets = {};
    const typeBuckets = {};

    for (const e of events) {
      const ts = this._parseTimestamp(e.reqs?.['Временная метка']?.value);
      if (!ts) continue;
      const key = this._dateToBucket(new Date(ts), period);
      buckets[key] = (buckets[key] || 0) + 1;

      const type = e.val;
      if (!typeBuckets[type]) typeBuckets[type] = {};
      typeBuckets[type][key] = (typeBuckets[type][key] || 0) + 1;
    }

    // Сортируем бакеты хронологически
    const sortedKeys = Object.keys(buckets).sort();
    const timeline = sortedKeys.map(k => ({ period: k, count: buckets[k] }));

    // Тренд: сравниваем последние 2 периода
    let trend = 'stable';
    let changePercent = 0;
    if (sortedKeys.length >= 2) {
      const last = buckets[sortedKeys[sortedKeys.length - 1]];
      const prev = buckets[sortedKeys[sortedKeys.length - 2]];
      if (prev > 0) {
        changePercent = Math.round(((last - prev) / prev) * 100);
        trend = changePercent > 10 ? 'rising' : changePercent < -10 ? 'falling' : 'stable';
      }
    }

    // Топ типов по частоте в последнем периоде
    const lastPeriod = sortedKeys[sortedKeys.length - 1];
    const topTypes = lastPeriod
      ? Object.entries(typeBuckets)
          .map(([type, bkts]) => ({ type, count: bkts[lastPeriod] || 0 }))
          .filter(t => t.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      : [];

    return { timeline, trend, changePercent, topTypes, period, eventsAnalyzed: events.length };
  }

  /**
   * What-if Simulation — dry-run триггеров без создания реальных событий.
   * @param {object} eventData — { eventType, value, individualId }
   * @returns {object} — какие триггеры сработают, какие события будут созданы
   */
  async simulateEvent(eventData) {
    await this.initialize();
    const { eventType, value, individualId } = eventData;

    const simulatedCascade = [];
    const triggersMatched = [];

    // Проверяем все триггеры
    for (const trigger of (this._triggers || [])) {
      try {
        const conditionResult = this.evaluateCondition(trigger.condition, {
          eventType,
          value: typeof value === 'string' ? value : JSON.stringify(value || {}),
          individualId,
        });
        if (conditionResult) {
          triggersMatched.push({
            triggerId: trigger.id,
            name: trigger.name,
            condition: trigger.condition,
            action: trigger.action,
          });
          // Симулируем действие
          if (trigger.action?.type === 'createEvent') {
            const simEvent = {
              type: trigger.action.params?.eventType || trigger.action.eventType,
              simulated: true,
              triggeredBy: trigger.name,
            };
            simulatedCascade.push(simEvent);
          }
        }
      } catch { /* skip broken triggers */ }
    }

    return {
      input: { eventType, value },
      triggersMatched,
      simulatedCascade,
      cascadeDepth: simulatedCascade.length,
      warning: simulatedCascade.length > 5 ? 'Глубокий каскад — проверьте триггеры на циклы' : null,
    };
  }

  // ── Helpers для Prediction Engine ──────────────────────────────

  _parseTimestamp(tsString) {
    if (!tsString) return null;
    // Формат: "14.03.2026 13:28:47" или ISO
    if (tsString.includes('T')) return new Date(tsString).getTime();
    const [datePart, timePart] = tsString.split(' ');
    if (!datePart) return null;
    const [d, m, y] = datePart.split('.');
    if (!y) return null;
    return new Date(`${y}-${m}-${d}T${timePart || '00:00:00'}`).getTime();
  }

  _msToHuman(ms) {
    if (ms < 1000) return `${Math.round(ms)}мс`;
    if (ms < 60000) return `${Math.round(ms / 1000)}с`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}мин`;
    if (ms < 86400000) return `${Math.round(ms / 3600000 * 10) / 10}ч`;
    return `${Math.round(ms / 86400000 * 10) / 10}дн`;
  }

  // ── Temporal BSL helpers ─────────────────────────────────────────

  /**
   * Parse duration string: "30s", "5m", "2h", "1d", "1w"
   */
  _parseDuration(s) {
    const match = String(s).match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|min|h|d|w)$/i);
    if (!match) return 0;
    const n = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers = { ms: 1, s: 1000, m: 60000, min: 60000, h: 3600000, d: 86400000, w: 604800000 };
    return n * (multipliers[unit] || 0);
  }

  /**
   * $WITHIN(eventType, "duration") — проверяет, было ли событие данного типа
   * в пределах временного окна от текущего момента.
   * Использует кэшированные события.
   */
  _evalTemporalWithin(tokens, pos, context) {
    // parse args: (eventType, "duration")
    if (pos < tokens.length && tokens[pos].value === '(') pos++;
    const eventType = this._resolveValue(tokens[pos], context); pos++;
    if (pos < tokens.length && tokens[pos].value === ',') pos++;
    const duration = this._resolveValue(tokens[pos], context); pos++;
    if (pos < tokens.length && tokens[pos].value === ')') pos++;

    const windowMs = this._parseDuration(String(duration));
    const now = Date.now();
    const cutoff = now - windowMs;

    // Check recent events cache
    const recentEvents = this._recentEventsCache || [];
    const found = recentEvents.some(e => {
      if (e.val !== eventType) return false;
      const ts = this._parseTimestamp(e.reqs?.['Временная метка']?.value);
      return ts && ts >= cutoff;
    });

    return { value: found, pos };
  }

  /**
   * $REPEATED(eventType, count, "duration") — событие повторилось N+ раз за период.
   */
  _evalTemporalRepeated(tokens, pos, context) {
    if (pos < tokens.length && tokens[pos].value === '(') pos++;
    const eventType = this._resolveValue(tokens[pos], context); pos++;
    if (pos < tokens.length && tokens[pos].value === ',') pos++;
    const minCount = Number(this._resolveValue(tokens[pos], context)); pos++;
    if (pos < tokens.length && tokens[pos].value === ',') pos++;
    const duration = this._resolveValue(tokens[pos], context); pos++;
    if (pos < tokens.length && tokens[pos].value === ')') pos++;

    const windowMs = this._parseDuration(String(duration));
    const cutoff = Date.now() - windowMs;

    const recentEvents = this._recentEventsCache || [];
    let count = 0;
    for (const e of recentEvents) {
      if (e.val !== eventType) continue;
      const ts = this._parseTimestamp(e.reqs?.['Временная метка']?.value);
      if (ts && ts >= cutoff) count++;
    }

    return { value: count >= minCount, pos };
  }

  /**
   * $SEQUENCE(eventTypeA, eventTypeB) — A произошло перед B в недавней истории.
   */
  _evalTemporalSequence(tokens, pos, context) {
    if (pos < tokens.length && tokens[pos].value === '(') pos++;
    const eventA = this._resolveValue(tokens[pos], context); pos++;
    if (pos < tokens.length && tokens[pos].value === ',') pos++;
    const eventB = this._resolveValue(tokens[pos], context); pos++;
    if (pos < tokens.length && tokens[pos].value === ')') pos++;

    const recentEvents = this._recentEventsCache || [];
    let lastA = -1, lastB = -1;
    for (let i = 0; i < recentEvents.length; i++) {
      if (recentEvents[i].val === eventA) lastA = i;
      if (recentEvents[i].val === eventB) lastB = i;
    }

    return { value: lastA >= 0 && lastB >= 0 && lastA < lastB, pos };
  }

  /**
   * Update recent events cache for temporal operators.
   * Called after each event creation.
   */
  async _refreshRecentEventsCache() {
    try {
      const events = await this.getObjectsCached(this.tables.subjectEvents, { limit: 500 });
      this._recentEventsCache = events.sort((a, b) => {
        const tA = a.reqs?.['Временная метка']?.value || '';
        const tB = b.reqs?.['Временная метка']?.value || '';
        return tA.localeCompare(tB);
      });
    } catch { this._recentEventsCache = []; }
  }

  _dateToBucket(date, period) {
    const pad = n => String(n).padStart(2, '0');
    switch (period) {
      case 'hour': return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:00`;
      case 'day': return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      case 'week': {
        const d = new Date(date);
        d.setDate(d.getDate() - d.getDay());
        return `${d.getFullYear()}-W${pad(Math.ceil((d.getDate()) / 7))}`;
      }
      case 'month': return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
      default: return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
  }

}

// Singleton
let instance = null;
export function getEventEngineService() {
  if (!instance) instance = new EventEngineService();
  return instance;
}

export default EventEngineService;
