/**
 * DomainConfigLoader — загрузка конфигурации доменов СОД из Integram-справочников.
 *
 * Приоритет: Integram-справочники → fallback на локальный JSON (data/sod-seed-data.json).
 * Кэш: 5 минут TTL.
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SEED_PATH = join(__dirname, '../../../data/sod-seed-data.json');

const CACHE_TTL = 5 * 60 * 1000; // 5 минут

class DomainConfigLoader {
  constructor(eventEngine) {
    this.engine = eventEngine;
    this._cache = null;
    this._cacheTs = 0;
  }

  /**
   * Загрузить полную конфигурацию всех доменов.
   * @returns {{ domains, eventTypes, actorRoles, properties, fsmTemplates, triggerTemplates }}
   */
  async loadAll() {
    if (this._cache && (Date.now() - this._cacheTs) < CACHE_TTL) {
      return this._cache;
    }

    let config;
    try {
      config = await this._loadFromIntegram();
      if (config && config.domains.length > 0) {
        logger.info(`[DomainConfigLoader] Loaded ${config.domains.length} domains from Integram`);
      } else {
        throw new Error('No domains found in Integram');
      }
    } catch (err) {
      logger.warn(`[DomainConfigLoader] Integram unavailable (${err.message}), falling back to seed JSON`);
      config = await this._loadFromSeedFile();
    }

    this._cache = config;
    this._cacheTs = Date.now();
    return config;
  }

  /**
   * Загрузить только домены.
   */
  async loadDomains() {
    const config = await this.loadAll();
    return config.domains;
  }

  /**
   * Загрузить типы событий для домена.
   */
  async loadEventTypes(domainName) {
    const config = await this.loadAll();
    return config.eventTypes.filter(e => e.domain === domainName);
  }

  /**
   * Загрузить роли акторов для домена.
   */
  async loadActorRoles(domainName) {
    const config = await this.loadAll();
    return config.actorRoles.filter(a => a.domain === domainName);
  }

  /**
   * Загрузить свойства для домена.
   */
  async loadProperties(domainName) {
    const config = await this.loadAll();
    return config.properties.filter(p => p.domain === domainName);
  }

  /**
   * Загрузить FSM шаблон для домена.
   */
  async loadFSM(domainName) {
    const config = await this.loadAll();
    return config.fsmTemplates.find(f => f.domain === domainName) || null;
  }

  /**
   * Загрузить шаблоны триггеров для домена.
   */
  async loadTriggerTemplates(domainName) {
    const config = await this.loadAll();
    return config.triggerTemplates.filter(t => t.domain === domainName);
  }

  /**
   * Сброс кэша (для hot-reload).
   */
  invalidateCache() {
    this._cache = null;
    this._cacheTs = 0;
    logger.info('[DomainConfigLoader] Cache invalidated');
  }

  // ── Внутренние методы ─────────────────────────────────────────────

  /**
   * Загрузить из Integram-справочников (lookup tables).
   * Ищет таблицы по имени: СОД_Домены, СОД_ТипыСобытий, и т.д.
   */
  async _loadFromIntegram() {
    const engine = this.engine;
    if (!engine || !engine.token) {
      throw new Error('EventEngine not authenticated');
    }

    // Найти справочники по имени
    const tableMap = await this._discoverLookupTables();
    if (!tableMap.domains) {
      throw new Error('Lookup table СОД_Домены not found');
    }

    // Загрузить данные из каждого справочника
    const domains = await this._loadLookupObjects(tableMap.domains, (obj, reqs) => ({
      name: reqs['Имя'] || obj.val,
      prefix: reqs['Префикс'] || '',
      conceptName: reqs['Концепт'] || '',
      conceptDescription: reqs['Описание'] || '',
      modelName: reqs['Модель'] || '',
      markerActor: reqs['МаркерАктор'] || '',
      individualName: reqs['Индивид'] || null,
      idsField: reqs['IdsField'] || '',
      bootstrappedField: reqs['BootstrappedField'] || '',
      active: reqs['Активен'] !== 'false' && reqs['Активен'] !== '0',
      order: parseInt(reqs['Порядок'] || '0', 10)
    }));

    const eventTypes = tableMap.eventTypes
      ? await this._loadLookupObjects(tableMap.eventTypes, (obj, reqs) => ({
          domain: reqs['Домен'] || '',
          name: reqs['Имя'] || obj.val,
          constraints: this._parseJSON(reqs['Ограничения'] || '{}')
        }))
      : [];

    const actorRoles = tableMap.actorRoles
      ? await this._loadLookupObjects(tableMap.actorRoles, (obj, reqs) => ({
          domain: reqs['Домен'] || '',
          name: reqs['Имя'] || obj.val,
          type: reqs['Тип'] || 'agent',
          description: reqs['Описание'] || ''
        }))
      : [];

    const properties = tableMap.properties
      ? await this._loadLookupObjects(tableMap.properties, (obj, reqs) => ({
          domain: reqs['Домен'] || '',
          name: reqs['Имя'] || obj.val,
          propertyType: reqs['ТипСвойства'] || 'attribute',
          dataType: reqs['ТипДанных'] || 'Text'
        }))
      : [];

    const fsmTemplates = tableMap.fsmTemplates
      ? await this._loadLookupObjects(tableMap.fsmTemplates, (obj, reqs) => ({
          domain: reqs['Домен'] || '',
          states: this._parseJSON(reqs['Состояния'] || '[]'),
          transitions: this._parseJSON(reqs['Переходы'] || '[]')
        }))
      : [];

    const triggerTemplates = tableMap.triggerTemplates
      ? await this._loadLookupObjects(tableMap.triggerTemplates, (obj, reqs) => ({
          domain: reqs['Домен'] || '',
          condition: reqs['Условие'] || '',
          actionType: reqs['ТипДействия'] || 'createEvent',
          params: this._parseJSON(reqs['Параметры'] || '{}'),
          priority: parseInt(reqs['Приоритет'] || '5', 10)
        }))
      : [];

    return { domains, eventTypes, actorRoles, properties, fsmTemplates, triggerTemplates };
  }

  /**
   * Найти ID справочных таблиц по имени.
   */
  async _discoverLookupTables() {
    const axios = (await import('axios')).default;
    const response = await axios.get(`${this.engine.v2BaseUrl}/schema/stats`);
    const byType = response.data?.data?.byType || [];

    const nameMap = {
      'СОД_Домены': 'domains',
      'СОД_ТипыСобытий': 'eventTypes',
      'СОД_РолиАкторов': 'actorRoles',
      'СОД_Свойства': 'properties',
      'СОД_FSM_Шаблоны': 'fsmTemplates',
      'СОД_ШаблоныТриггеров': 'triggerTemplates',
    };

    const result = {};
    for (const t of byType) {
      const key = nameMap[t.name];
      if (key) result[key] = String(t.id);
    }
    return result;
  }

  /**
   * Загрузить объекты из Integram-таблицы и маппить через fn(obj, reqsMap).
   */
  async _loadLookupObjects(typeId, mapFn) {
    try {
      const objects = await this.engine.getObjects(typeId);
      return objects.map(obj => {
        const reqs = {};
        if (obj.reqs) {
          for (const [key, val] of Object.entries(obj.reqs)) {
            // Strip table prefix: "СОД_Домены::Имя" → "Имя"
            const alias = key.includes('::') ? key.split('::').pop() : key;
            reqs[alias] = typeof val === 'object' ? (val.value || val.val || '') : String(val);
          }
        }
        return mapFn(obj, reqs);
      });
    } catch (err) {
      logger.warn(`[DomainConfigLoader] Failed to load objects from type ${typeId}:`, err.message);
      return [];
    }
  }

  /**
   * Загрузить из локального JSON-файла (fallback).
   */
  async _loadFromSeedFile() {
    try {
      const raw = await readFile(SEED_PATH, 'utf8');
      const data = JSON.parse(raw);
      logger.info(`[DomainConfigLoader] Loaded seed data: ${data.domains?.length || 0} domains`);
      return {
        domains: data.domains || [],
        eventTypes: data.eventTypes || [],
        actorRoles: data.actorRoles || [],
        properties: data.properties || [],
        fsmTemplates: data.fsmTemplates || [],
        triggerTemplates: data.triggerTemplates || [],
      };
    } catch (err) {
      logger.error(`[DomainConfigLoader] Failed to load seed file:`, err.message);
      return { domains: [], eventTypes: [], actorRoles: [], properties: [], fsmTemplates: [], triggerTemplates: [] };
    }
  }

  _parseJSON(str) {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }
}

export default DomainConfigLoader;
