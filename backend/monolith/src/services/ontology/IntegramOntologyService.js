/**
 * Integram Ontology Service
 *
 * Manages UAV ontology in Integram (kval database) using SKOS taxonomy model.
 * Provides CRUD operations for concepts, relations, and hierarchies.
 *
 * Related:
 * - Issue #7135 - UAV Ontology: SKOS Taxonomy in Integram
 *
 * Schema:
 * - Table "Онтология БПЛА" (ID: 1673250) - UAV Ontology Concepts
 * - Table "Тип связи онтологии" (ID: 1673242) - Relation Types
 * - Table "Связи онтологии" (ID: 1673287) - Ontology Relations
 *
 * Integram API notes:
 * - All URLs must include ?JSON_KV= for JSON responses
 * - Read data: GET /object/{typeId}?JSON_KV= (with cookie auth)
 * - Write data: POST /_m_new/{typeId}?up=1&JSON_KV= (with _xsrf in body)
 * - Auth: POST /auth?JSON_KV= returns {token, _xsrf}
 * - Cookie: {db}={token} is required for all requests
 * - _d_* endpoints are DDL (require CSRF+WRITE), NOT for reading data
 */

import axios from 'axios';
import logger from '../../utils/logger.js';

class IntegramOntologyService {
  constructor() {
    this.serverURL = (process.env.INTEGRAM_SERVER_URL || 'ai2o.ru').replace(/^https?:\/\//, '');
    this.database = 'kval';
    this.token = null;
    this.xsrfToken = null;

    // Table IDs (set after initialization)
    this.ontologyTableId = null;
    this.relationTypeTableId = null;
    this.relationsTableId = null;

    // Requisite alias map: {typeId: {alias: reqId}}
    this.reqAliasMap = {};

    // Cache
    this.conceptsCache = new Map();
    this.relationsCache = new Map();
    this.lastCacheUpdate = null;
    this.lastCacheLimit = 0;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Build auth headers + cookies for Integram requests
   */
  getHeaders() {
    return {
      'X-Authorization': this.token,
      'Cookie': `${this.database}=${this.token}`,
    };
  }

  /**
   * Initialize service: authenticate and discover table IDs
   */
  async initialize() {
    if (this.token && this.ontologyTableId) {
      return;
    }

    try {
      await this.authenticate();
      await this.discoverTables();
      logger.info('[OntologyService] Initialized', {
        database: this.database,
        ontologyTableId: this.ontologyTableId,
        relationTypeTableId: this.relationTypeTableId,
        relationsTableId: this.relationsTableId
      });
    } catch (error) {
      logger.error('[OntologyService] Initialization failed', error);
      throw error;
    }
  }

  /**
   * Authenticate with Integram
   */
  async authenticate() {
    const username = process.env.INTEGRAM_SYSTEM_USERNAME || 'd';
    const password = process.env.INTEGRAM_SYSTEM_PASSWORD || 'd';

    try {
      const response = await axios.post(
        `https://${this.serverURL}/${this.database}/auth?JSON_KV=`,
        new URLSearchParams({ login: username, pwd: password }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      if (!response.data.token) {
        throw new Error('No token in auth response');
      }

      this.token = response.data.token;
      this.xsrfToken = response.data._xsrf;

      logger.info('[OntologyService] Authenticated successfully', { user: username });
    } catch (error) {
      logger.error('[OntologyService] Authentication failed', error);
      throw new Error('Integram authentication failed');
    }
  }

  /**
   * Discover table IDs by name from dictionary
   */
  async discoverTables() {
    try {
      const dictionary = await this.getDictionary();

      // dictionary is {id: name} object from dict?JSON_KV=
      for (const [id, name] of Object.entries(dictionary)) {
        if (name === 'Онтология БПЛА') this.ontologyTableId = id;
        else if (name === 'Тип связи онтологии') this.relationTypeTableId = id;
        else if (name === 'Связи онтологии') this.relationsTableId = id;
      }

      logger.info('[OntologyService] Tables discovered', {
        ontologyTableId: this.ontologyTableId,
        relationTypeTableId: this.relationTypeTableId,
        relationsTableId: this.relationsTableId
      });
    } catch (error) {
      logger.warn('[OntologyService] Table discovery failed', error.message);
    }
  }

  /**
   * Get dictionary (list of all types/tables)
   * Returns: {id: name, ...}
   */
  async getDictionary() {
    try {
      const response = await axios.get(
        `https://${this.serverURL}/${this.database}/dict?JSON_KV=`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      logger.error('[OntologyService] Failed to get dictionary', error);
      throw error;
    }
  }

  /**
   * Get objects from a table using object/{typeId} endpoint (read-only).
   * Returns normalized array of objects with merged reqs.
   *
   * Integram object/{typeId}?JSON_KV= response format:
   * {
   *   type: {id, val, base},
   *   req_type: {reqId: alias, ...},
   *   req_order: [reqId, ...],
   *   ref_type: {reqId: targetTypeId, ...},
   *   object: [{id, val, up, base}, ...],
   *   reqs: {objectId: {reqId: value, ...}, ...}
   * }
   */
  async getObjects(typeId, params = {}) {
    const { limit = 100 } = params;

    try {
      const response = await axios.get(
        `https://${this.serverURL}/${this.database}/object/${typeId}?JSON_KV=&LIMIT=${limit}`,
        { headers: this.getHeaders() }
      );

      const data = response.data;
      const objects = data.object || [];
      const allReqs = data.reqs || {};
      const reqTypes = data.req_type || {};
      const refTypes = data.ref_type || {};

      // Cache the reqType map for this typeId
      this.reqAliasMap[typeId] = reqTypes;

      // Merge reqs into objects
      return objects.map(obj => {
        const objReqs = allReqs[obj.id] || {};
        const reqs = {};

        for (const [reqId, value] of Object.entries(objReqs)) {
          reqs[reqId] = {
            value,
            alias: reqTypes[reqId] || reqId,
            isRef: !!refTypes[reqId],
            refType: refTypes[reqId] || null
          };
        }

        return {
          id: obj.id,
          val: obj.val,
          up: obj.up,
          base: obj.base,
          reqs
        };
      });
    } catch (error) {
      logger.error('[OntologyService] Failed to get objects', { typeId, error: error.message });
      throw error;
    }
  }

  /**
   * Get single object by ID
   */
  async getObject(objectId) {
    try {
      const response = await axios.get(
        `https://${this.serverURL}/${this.database}/edit_obj/${objectId}?JSON_KV=`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      logger.error('[OntologyService] Failed to get object', { objectId, error: error.message });
      throw error;
    }
  }

  /**
   * Create object (insert row).
   * Uses _m_new which is a DML operation (requires _xsrf in body).
   */
  async createObject(typeId, value, requisites = {}) {
    try {
      if (!this.xsrfToken) {
        await this.fetchXsrfToken();
      }

      const formData = new URLSearchParams();
      formData.append('_xsrf', this.xsrfToken);
      formData.append(`t${typeId}`, value);

      if (requisites.reqs) {
        for (const [reqId, reqData] of Object.entries(requisites.reqs)) {
          formData.append(`t${reqId}`, reqData.value || '');
        }
      }

      const response = await axios.post(
        `https://${this.serverURL}/${this.database}/_m_new/${typeId}?up=1&JSON_KV=`,
        formData,
        {
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('[OntologyService] Failed to create object', { typeId, value, error: error.message });
      throw error;
    }
  }

  /**
   * Update object requisites.
   * Uses _m_save which is a DML operation (requires _xsrf in body).
   */
  async updateObject(objectId, requisites) {
    try {
      if (!this.xsrfToken) {
        await this.fetchXsrfToken();
      }

      const formData = new URLSearchParams();
      formData.append('_xsrf', this.xsrfToken);

      if (requisites.reqs) {
        for (const [reqId, reqData] of Object.entries(requisites.reqs)) {
          formData.append(`t${reqId}`, reqData.value || '');
        }
      } else {
        for (const [key, value] of Object.entries(requisites)) {
          if (key !== '_xsrf') {
            formData.append(`t${key}`, value || '');
          }
        }
      }

      const response = await axios.post(
        `https://${this.serverURL}/${this.database}/_m_save/${objectId}?full=1&JSON_KV=`,
        formData,
        {
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('[OntologyService] Failed to update object', { objectId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete object
   */
  async deleteObject(objectId) {
    try {
      if (!this.xsrfToken) {
        await this.fetchXsrfToken();
      }

      const formData = new URLSearchParams();
      formData.append('_xsrf', this.xsrfToken);
      formData.append('id', objectId);

      const response = await axios.post(
        `https://${this.serverURL}/${this.database}/_m_del?JSON_KV=`,
        formData,
        {
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('[OntologyService] Failed to delete object', { objectId, error: error.message });
      throw error;
    }
  }

  /**
   * Fetch XSRF token for POST requests
   */
  async fetchXsrfToken() {
    try {
      const response = await axios.get(
        `https://${this.serverURL}/${this.database}/xsrf?JSON_KV=`,
        { headers: this.getHeaders() }
      );

      this.xsrfToken = response.data._xsrf || response.data;
      logger.debug('[OntologyService] XSRF token fetched');
    } catch (error) {
      logger.error('[OntologyService] Failed to fetch XSRF token', error);
      throw error;
    }
  }

  /**
   * Create concept in ontology
   */
  async createConcept(concept) {
    if (!this.ontologyTableId) {
      throw new Error('Ontology table not initialized');
    }

    try {
      // Use cached reqAliasMap or fetch table structure
      let reqTypes = this.reqAliasMap[this.ontologyTableId];
      if (!reqTypes) {
        await this.getObjects(this.ontologyTableId, { limit: 1 });
        reqTypes = this.reqAliasMap[this.ontologyTableId] || {};
      }

      // Reverse map: alias → reqId
      const aliasToReqId = {};
      for (const [reqId, alias] of Object.entries(reqTypes)) {
        aliasToReqId[alias] = reqId;
      }

      const requisites = {};
      const fieldMap = {
        prefLabel_zh: concept.prefLabel_zh,
        prefLabel_en: concept.prefLabel_en,
        altLabels_zh: concept.altLabels_zh,
        altLabels_en: concept.altLabels_en,
        notation: concept.notation,
        exactMatch: concept.exactMatch,
        broader: concept.broaderId,
      };

      for (const [alias, value] of Object.entries(fieldMap)) {
        if (value && aliasToReqId[alias]) {
          requisites[aliasToReqId[alias]] = { value };
        }
      }

      const result = await this.createObject(
        this.ontologyTableId,
        concept.prefLabel_ru,
        { reqs: requisites }
      );

      this.clearCache();

      logger.info('[OntologyService] Concept created', {
        conceptId: result.id,
        label: concept.prefLabel_ru
      });

      return result;
    } catch (error) {
      logger.error('[OntologyService] Failed to create concept', { concept, error: error.message });
      throw error;
    }
  }

  /**
   * Get all concepts (with optional limit)
   */
  async getConcepts(params = {}) {
    if (!this.ontologyTableId) {
      throw new Error('Ontology table not initialized');
    }

    const requestedLimit = params.limit || 100;

    // Use cache only if valid AND the cached limit covers the requested limit
    if (this.shouldUseCache() && this.lastCacheLimit >= requestedLimit) {
      return Array.from(this.conceptsCache.values());
    }

    try {
      const objects = await this.getObjects(this.ontologyTableId, params);

      this.conceptsCache.clear();
      for (const obj of objects) {
        this.conceptsCache.set(obj.id, obj);
      }
      this.lastCacheUpdate = Date.now();
      this.lastCacheLimit = requestedLimit;

      return objects;
    } catch (error) {
      logger.error('[OntologyService] Failed to get concepts', error);
      throw error;
    }
  }

  /**
   * Search concepts by label (any language)
   */
  async searchConcepts(query, language = 'all') {
    const concepts = await this.getConcepts({ limit: 1000 });
    const lowerQuery = query.toLowerCase();

    return concepts.filter(concept => {
      const val = (concept.val || '').toLowerCase();
      if (val.includes(lowerQuery)) return true;

      const reqs = concept.reqs || {};
      for (const req of Object.values(reqs)) {
        const value = (req.value || '').toString().toLowerCase();
        if (value.includes(lowerQuery)) return true;
      }

      return false;
    });
  }

  /**
   * Get concept hierarchy (children/descendants)
   */
  async getConceptHierarchy(conceptId, direction = 'narrower', depth = 1) {
    const concepts = await this.getConcepts({ limit: 1000 });
    const result = [];

    if (direction === 'narrower' || direction === 'both') {
      const children = concepts.filter(c => {
        const reqs = c.reqs || {};
        return Object.values(reqs).some(r => r.isRef && String(r.value) === String(conceptId));
      });

      for (const child of children) {
        result.push(child);
        if (depth > 1) {
          const descendants = await this.getConceptHierarchy(child.id, 'narrower', depth - 1);
          result.push(...descendants);
        }
      }
    }

    if (direction === 'broader' || direction === 'both') {
      const concept = concepts.find(c => String(c.id) === String(conceptId));
      if (concept) {
        const broaderReq = Object.values(concept.reqs || {}).find(r => r.isRef && r.value);
        if (broaderReq && broaderReq.value) {
          const parent = concepts.find(c => String(c.id) === String(broaderReq.value));
          if (parent) {
            result.push(parent);
            if (depth > 1) {
              const ancestors = await this.getConceptHierarchy(parent.id, 'broader', depth - 1);
              result.push(...ancestors);
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Get all relations from the relations table.
   * Extracts actual object IDs from ref_XXXX keys (format: "typeId:objectId").
   */
  async getAllRelations() {
    if (!this.relationsTableId) return []

    try {
      const response = await axios.get(
        `https://${this.serverURL}/${this.database}/object/${this.relationsTableId}?JSON_KV=&LIMIT=1000`,
        { headers: this.getHeaders() }
      )

      const data = response.data
      const objects = data.object || []
      const allReqs = data.reqs || {}

      return objects.map(obj => {
        const objReqs = allReqs[obj.id] || {}
        let sourceId = null, targetId = null, typeId = null
        let sourceLabel = '', targetLabel = '', typeLabel = '', ontology = ''

        // Extract ref IDs from ref_XXXX keys (format "typeId:objectId")
        for (const [key, value] of Object.entries(objReqs)) {
          if (key === '1673291') ontology = value || ''
          else if (key === '1673292') sourceLabel = value || ''
          else if (key === '1673293') targetLabel = value || ''
          else if (key === '1673295') typeLabel = value || ''
          else if (key === 'ref_1673292' && value) {
            sourceId = value.split(':')[1] || value
          }
          else if (key === 'ref_1673293' && value) {
            targetId = value.split(':')[1] || value
          }
          else if (key === 'ref_1673295' && value) {
            typeId = value.split(':')[1] || value
          }
        }

        return {
          id: obj.id,
          value: obj.val,
          sourceId,
          targetId,
          typeId,
          typeLabel,
          sourceLabel,
          targetLabel,
          ontology
        }
      }).filter(r => r.sourceId && r.targetId)
    } catch (error) {
      logger.error('[OntologyService] Failed to get all relations', error)
      return []
    }
  }

  /**
   * Get relations for a concept
   */
  async getRelations(conceptId, direction = 'both') {
    if (!this.relationsTableId) {
      return [];
    }

    try {
      const relations = await this.getObjects(this.relationsTableId, { limit: 1000 });

      return relations.filter(rel => {
        const reqs = rel.reqs || {};
        const hasRef = Object.values(reqs).some(r => r.isRef && String(r.value) === String(conceptId));
        return hasRef;
      });
    } catch (error) {
      logger.error('[OntologyService] Failed to get relations', { conceptId, error: error.message });
      return [];
    }
  }

  /**
   * Export ontology to JSON-LD format
   */
  async exportToJsonLd() {
    const concepts = await this.getConcepts({ limit: 10000 });

    const context = {
      '@context': {
        'skos': 'http://www.w3.org/2004/02/skos/core#',
        'dront': 'http://dronetology.net/dronetology#',
        'prefLabelRu': { '@id': 'skos:prefLabel', '@language': 'ru' },
        'prefLabelZh': { '@id': 'skos:prefLabel', '@language': 'zh' },
        'prefLabelEn': { '@id': 'skos:prefLabel', '@language': 'en' },
        'altLabel': 'skos:altLabel',
        'broader': { '@id': 'skos:broader', '@type': '@id' },
        'narrower': { '@id': 'skos:narrower', '@type': '@id' },
        'exactMatch': { '@id': 'skos:exactMatch', '@type': '@id' },
        'definition': 'skos:definition',
        'notation': 'skos:notation'
      }
    };

    const graph = concepts.map(concept => {
      const reqs = concept.reqs || {};
      const node = {
        '@id': `urn:drondoc:ontology:${concept.id}`,
        '@type': 'skos:Concept',
        'prefLabelRu': concept.val
      };

      for (const req of Object.values(reqs)) {
        if (!req.value) continue;
        if (req.alias === 'prefLabel_zh') node.prefLabelZh = req.value;
        else if (req.alias === 'prefLabel_en') node.prefLabelEn = req.value;
        else if (req.alias === 'notation') node.notation = req.value;
        else if (req.alias === 'exactMatch') node.exactMatch = req.value;
        else if (req.alias === 'broader' && req.isRef) {
          node.broader = `urn:drondoc:ontology:${req.value}`;
        }
      }

      return node;
    });

    return { ...context, '@graph': graph };
  }

  shouldUseCache() {
    if (!this.lastCacheUpdate) return false;
    return (Date.now() - this.lastCacheUpdate) < this.cacheTimeout;
  }

  clearCache() {
    this.conceptsCache.clear();
    this.relationsCache.clear();
    this.lastCacheUpdate = null;
  }
}

// Singleton instance
let instance = null;

export function getOntologyService() {
  if (!instance) {
    instance = new IntegramOntologyService();
  }
  return instance;
}

export default IntegramOntologyService;
