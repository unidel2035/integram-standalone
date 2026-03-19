/**
 * LOD Cloud Service
 *
 * Provides integration with Linked Open Data cloud services:
 * - Wikidata search and entity retrieval
 * - DBpedia lookup
 * - owl:sameAs mapping management for ontology concepts
 *
 * Uses native fetch (Node 18+) for all HTTP calls.
 */

import logger from '../../utils/logger.js';
import { getOntologyService } from './IntegramOntologyService.js';

const LOG_PREFIX = '[LodCloudService]';

class LodCloudService {
  constructor() {
    this.wikidataApiUrl = 'https://www.wikidata.org/w/api.php';
    this.dbpediaLookupUrl = 'https://lookup.dbpedia.org/api/search';
    this.requestTimeout = 10000; // 10 seconds
  }

  /**
   * Search Wikidata entities by text query.
   * Uses the wbsearchentities action.
   *
   * @param {string} query - Search text
   * @param {string} lang - Language code (default 'en')
   * @returns {Array<{id: string, label: string, description: string, url: string}>}
   */
  async searchWikidata(query, lang = 'en') {
    if (!query || !query.trim()) {
      return [];
    }

    const params = new URLSearchParams({
      action: 'wbsearchentities',
      search: query.trim(),
      language: lang,
      format: 'json',
      limit: '10',
      origin: '*',
    });

    const url = `${this.wikidataApiUrl}?${params}`;

    try {
      logger.info(`${LOG_PREFIX} Searching Wikidata`, { query, lang });

      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.requestTimeout),
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Wikidata API returned ${response.status}`);
      }

      const data = await response.json();

      const results = (data.search || []).map(item => ({
        id: item.id,
        label: item.label || '',
        description: item.description || '',
        url: item.concepturi || `https://www.wikidata.org/wiki/${item.id}`,
      }));

      logger.info(`${LOG_PREFIX} Wikidata search returned ${results.length} results`, { query });
      return results;
    } catch (error) {
      logger.error(`${LOG_PREFIX} Wikidata search failed`, { query, error: error.message });
      return [];
    }
  }

  /**
   * Get a full Wikidata entity by QID.
   *
   * @param {string} qid - Wikidata entity ID (e.g. 'Q178401')
   * @returns {Object|null} Parsed entity with labels, descriptions, claims count, wikipedia link
   */
  async getWikidataEntity(qid) {
    if (!qid || !qid.match(/^Q\d+$/i)) {
      logger.warn(`${LOG_PREFIX} Invalid QID format`, { qid });
      return null;
    }

    const params = new URLSearchParams({
      action: 'wbgetentities',
      ids: qid.toUpperCase(),
      format: 'json',
      props: 'labels|descriptions|claims|sitelinks',
      origin: '*',
    });

    const url = `${this.wikidataApiUrl}?${params}`;

    try {
      logger.info(`${LOG_PREFIX} Fetching Wikidata entity`, { qid });

      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.requestTimeout),
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Wikidata API returned ${response.status}`);
      }

      const data = await response.json();
      const entity = data.entities?.[qid.toUpperCase()];

      if (!entity || entity.missing !== undefined) {
        logger.warn(`${LOG_PREFIX} Wikidata entity not found`, { qid });
        return null;
      }

      // Extract labels as {lang: value}
      const labels = {};
      for (const [lang, labelObj] of Object.entries(entity.labels || {})) {
        labels[lang] = labelObj.value;
      }

      // Extract descriptions as {lang: value}
      const descriptions = {};
      for (const [lang, descObj] of Object.entries(entity.descriptions || {})) {
        descriptions[lang] = descObj.value;
      }

      // Count claims (properties)
      const claimsCount = Object.keys(entity.claims || {}).length;

      // Find Wikipedia link (prefer English, fallback to Russian, then any)
      let wikipediaLink = null;
      const sitelinks = entity.sitelinks || {};
      if (sitelinks.enwiki) {
        wikipediaLink = `https://en.wikipedia.org/wiki/${encodeURIComponent(sitelinks.enwiki.title)}`;
      } else if (sitelinks.ruwiki) {
        wikipediaLink = `https://ru.wikipedia.org/wiki/${encodeURIComponent(sitelinks.ruwiki.title)}`;
      } else {
        const firstWiki = Object.keys(sitelinks).find(k => k.endsWith('wiki'));
        if (firstWiki) {
          const langCode = firstWiki.replace('wiki', '');
          wikipediaLink = `https://${langCode}.wikipedia.org/wiki/${encodeURIComponent(sitelinks[firstWiki].title)}`;
        }
      }

      const result = {
        id: qid.toUpperCase(),
        labels,
        descriptions,
        claimsCount,
        wikipediaLink,
        url: `https://www.wikidata.org/wiki/${qid.toUpperCase()}`,
      };

      logger.info(`${LOG_PREFIX} Wikidata entity fetched`, { qid, claimsCount });
      return result;
    } catch (error) {
      logger.error(`${LOG_PREFIX} Failed to fetch Wikidata entity`, { qid, error: error.message });
      return null;
    }
  }

  /**
   * Search DBpedia resources by text query.
   *
   * @param {string} query - Search text
   * @returns {Array<{uri: string, label: string, description: string, categories: string[]}>}
   */
  async searchDbpedia(query) {
    if (!query || !query.trim()) {
      return [];
    }

    const params = new URLSearchParams({
      query: query.trim(),
      format: 'json',
      maxResults: '10',
    });

    const url = `${this.dbpediaLookupUrl}?${params}`;

    try {
      logger.info(`${LOG_PREFIX} Searching DBpedia`, { query });

      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.requestTimeout),
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`DBpedia API returned ${response.status}`);
      }

      const data = await response.json();
      const docs = data.docs || data.results || [];

      const results = docs.map(item => ({
        uri: item.resource?.[0] || item.uri || '',
        label: item.label?.[0] || item.label || '',
        description: item.comment?.[0] || item.description || '',
        categories: (item.category || []).map(c => typeof c === 'string' ? c : c.label || ''),
      }));

      logger.info(`${LOG_PREFIX} DBpedia search returned ${results.length} results`, { query });
      return results;
    } catch (error) {
      logger.error(`${LOG_PREFIX} DBpedia search failed`, { query, error: error.message });
      return [];
    }
  }

  /**
   * Enrich an ontology concept with Wikidata data.
   * Fetches the Wikidata entity, retrieves the local concept,
   * and adds owl:sameAs mapping plus description/labels.
   *
   * @param {string} conceptId - Local ontology concept ID
   * @param {string} wikidataQid - Wikidata entity QID (e.g. 'Q178401')
   * @returns {Object} {concept, wikidata, mappingsAdded}
   */
  async enrichConcept(conceptId, wikidataQid) {
    const ontologyService = getOntologyService();
    await ontologyService.initialize();

    // Fetch wikidata entity
    const wikidata = await this.getWikidataEntity(wikidataQid);
    if (!wikidata) {
      throw new Error(`Wikidata entity ${wikidataQid} not found`);
    }

    // Fetch local concept
    const concepts = await ontologyService.getConcepts({ limit: 1000 });
    const concept = concepts.find(c => String(c.id) === String(conceptId));
    if (!concept) {
      throw new Error(`Concept ${conceptId} not found in ontology`);
    }

    // Build the sameAs URI
    const sameAsUri = `https://www.wikidata.org/wiki/${wikidataQid.toUpperCase()}`;

    // Find the exactMatch/sameAs requisite from the alias map
    const reqTypes = ontologyService.reqAliasMap[ontologyService.ontologyTableId] || {};
    const aliasToReqId = {};
    for (const [reqId, alias] of Object.entries(reqTypes)) {
      aliasToReqId[alias] = reqId;
    }

    const mappingsAdded = [];
    const updateReqs = {};

    // Add owl:sameAs via exactMatch field
    if (aliasToReqId.exactMatch) {
      const existingValue = concept.reqs?.[aliasToReqId.exactMatch]?.value || '';
      const newValue = existingValue ? `${existingValue}, ${sameAsUri}` : sameAsUri;
      updateReqs[aliasToReqId.exactMatch] = newValue;
      mappingsAdded.push({ field: 'exactMatch', uri: sameAsUri });
    }

    // Pull English label into prefLabel_en if empty
    if (aliasToReqId.prefLabel_en && wikidata.labels.en) {
      const existing = concept.reqs?.[aliasToReqId.prefLabel_en]?.value;
      if (!existing) {
        updateReqs[aliasToReqId.prefLabel_en] = wikidata.labels.en;
        mappingsAdded.push({ field: 'prefLabel_en', value: wikidata.labels.en });
      }
    }

    // Pull English description into notation if empty
    if (aliasToReqId.notation && wikidata.descriptions.en) {
      const existing = concept.reqs?.[aliasToReqId.notation]?.value;
      if (!existing) {
        updateReqs[aliasToReqId.notation] = wikidata.descriptions.en;
        mappingsAdded.push({ field: 'notation', value: wikidata.descriptions.en });
      }
    }

    // Apply updates
    if (Object.keys(updateReqs).length > 0) {
      await ontologyService.updateObject(conceptId, updateReqs);
      ontologyService.clearCache();
      logger.info(`${LOG_PREFIX} Concept enriched`, { conceptId, wikidataQid, mappingsAdded: mappingsAdded.length });
    }

    return {
      concept: { id: concept.id, val: concept.val, reqs: concept.reqs },
      wikidata,
      mappingsAdded,
    };
  }

  /**
   * Get all existing owl:sameAs mappings from the ontology.
   * Scans all concepts for exactMatch fields containing external URIs.
   *
   * @returns {Array<{conceptId: string, conceptLabel: string, externalUri: string, source: string}>}
   */
  async getSameAsMappings() {
    const ontologyService = getOntologyService();
    await ontologyService.initialize();

    const concepts = await ontologyService.getConcepts({ limit: 1000 });
    const reqTypes = ontologyService.reqAliasMap[ontologyService.ontologyTableId] || {};

    // Find the exactMatch requisite ID
    let exactMatchReqId = null;
    for (const [reqId, alias] of Object.entries(reqTypes)) {
      if (alias === 'exactMatch') {
        exactMatchReqId = reqId;
        break;
      }
    }

    if (!exactMatchReqId) {
      logger.warn(`${LOG_PREFIX} No exactMatch requisite found in ontology table`);
      return [];
    }

    const mappings = [];

    for (const concept of concepts) {
      const matchValue = concept.reqs?.[exactMatchReqId]?.value;
      if (!matchValue) continue;

      // Split by comma in case multiple URIs are stored
      const uris = matchValue.split(',').map(u => u.trim()).filter(Boolean);

      for (const uri of uris) {
        let source = 'unknown';
        if (uri.includes('wikidata.org')) source = 'wikidata';
        else if (uri.includes('dbpedia.org')) source = 'dbpedia';
        else if (uri.includes('schema.org')) source = 'schema.org';
        else if (uri.includes('w3.org')) source = 'w3c';

        mappings.push({
          conceptId: String(concept.id),
          conceptLabel: concept.val || '',
          externalUri: uri,
          source,
        });
      }
    }

    logger.info(`${LOG_PREFIX} Found ${mappings.length} sameAs mappings`);
    return mappings;
  }
}

// Singleton
let instance = null;

export function getLodCloudService() {
  if (!instance) {
    instance = new LodCloudService();
  }
  return instance;
}

export default LodCloudService;
