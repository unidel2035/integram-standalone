/**
 * Ontology Matcher Service
 *
 * Matches text against UAV ontology concepts for classification and tagging.
 * Supports multilingual matching (RU/ZH/EN), synonym expansion, and hierarchy traversal.
 *
 * Use Cases:
 * - OSINT parser: Classify Chinese articles by UAV type
 * - Hierarchical search: Query "agricultural drone" includes spraying, seeding, monitoring
 * - Cross-lingual search: Chinese article → matched English concepts
 *
 * Related:
 * - Issue #7135 - UAV Ontology
 * - Issue #7133 - OSINT Parser Platform
 */

import { getOntologyService } from './IntegramOntologyService.js';
import logger from '../../utils/logger.js';

class OntologyMatcher {
  constructor() {
    this.ontologyService = getOntologyService();
    this.conceptsCache = new Map();
    this.lastCacheUpdate = null;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize matcher
   */
  async initialize() {
    // Guard: skip if already initialized and cache is fresh
    if (this.lastCacheUpdate && (Date.now() - this.lastCacheUpdate) < this.cacheTimeout) {
      return;
    }

    await this.ontologyService.initialize();
    await this.loadConcepts();
    logger.info('[OntologyMatcher] Initialized', {
      concepts: this.conceptsCache.size
    });
  }

  /**
   * Load concepts into cache
   */
  async loadConcepts() {
    const concepts = await this.ontologyService.getConcepts();
    this.conceptsCache.clear();

    for (const concept of concepts) {
      this.conceptsCache.set(concept.id, this.normalizeConcept(concept));
    }

    this.lastCacheUpdate = Date.now();
    logger.debug('[OntologyMatcher] Concepts loaded', { count: this.conceptsCache.size });
  }

  /**
   * Normalize concept structure for easier access
   */
  normalizeConcept(concept) {
    const reqs = concept.reqs || {};
    const normalized = {
      id: concept.id,
      prefLabel_ru: concept.val || '',
      prefLabel_zh: '',
      prefLabel_en: '',
      altLabels_zh: [],
      altLabels_en: [],
      altLabels_ru: [],
      broader: null,
      notation: '',
      exactMatch: [],
      definition: '',
      scopeNote: '',
      source: ''
    };

    // Extract requisites by alias
    for (const req of Object.values(reqs)) {
      const value = req.value || '';

      // Match by common patterns (this is simplified - production should use alias mapping)
      if (req.alias === 'prefLabel_zh' || value.match(/[\u4e00-\u9fff]/)) {
        normalized.prefLabel_zh = value;
      } else if (req.alias === 'prefLabel_en' || value.match(/^[a-zA-Z\s]+$/)) {
        normalized.prefLabel_en = value;
      } else if (req.alias === 'altLabels_zh') {
        normalized.altLabels_zh = value.split(',').map(s => s.trim()).filter(Boolean);
      } else if (req.alias === 'altLabels_en') {
        normalized.altLabels_en = value.split(',').map(s => s.trim()).filter(Boolean);
      } else if (req.alias === 'altLabels_ru') {
        normalized.altLabels_ru = value.split(',').map(s => s.trim()).filter(Boolean);
      } else if (req.alias === 'broader' && req.arr_type) {
        normalized.broader = value;
      } else if (req.alias === 'notation') {
        normalized.notation = value;
      } else if (req.alias === 'exactMatch') {
        normalized.exactMatch = value.split('\n').map(s => s.trim()).filter(Boolean);
      } else if (req.alias === 'definition') {
        normalized.definition = value;
      } else if (req.alias === 'scopeNote') {
        normalized.scopeNote = value;
      } else if (req.alias === 'source') {
        normalized.source = value;
      }
    }

    return normalized;
  }

  /**
   * Match text against ontology concepts
   *
   * @param {string} text - Text to match (article content, query, etc.)
   * @param {string} language - Language hint ('zh', 'en', 'ru', 'auto')
   * @param {Object} options - Matching options
   * @param {number} options.minScore - Minimum match score (0-1, default 0.3)
   * @param {number} options.maxResults - Max results to return (default 10)
   * @param {boolean} options.expandSynonyms - Match against synonyms (default true)
   * @param {boolean} options.fuzzyMatch - Allow fuzzy matching (default false)
   * @returns {Array} Matched concepts with scores
   */
  async matchText(text, language = 'auto', options = {}) {
    const {
      minScore = 0.3,
      maxResults = 10,
      expandSynonyms = true,
      fuzzyMatch = false
    } = options;

    // Detect language if auto
    if (language === 'auto') {
      language = this.detectLanguage(text);
    }

    // Tokenize text
    const tokens = this.tokenize(text, language);

    // Match against concepts
    const matches = [];

    for (const concept of this.conceptsCache.values()) {
      const score = this.calculateMatchScore(concept, tokens, language, expandSynonyms);

      if (score >= minScore) {
        matches.push({
          conceptId: concept.id,
          prefLabel_ru: concept.prefLabel_ru,
          prefLabel_zh: concept.prefLabel_zh,
          prefLabel_en: concept.prefLabel_en,
          score,
          matchedTerms: this.getMatchedTerms(concept, tokens, language)
        });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    // Return top results
    return matches.slice(0, maxResults);
  }

  /**
   * Detect text language
   */
  detectLanguage(text) {
    // Simple heuristic: check for Chinese characters
    if (/[\u4e00-\u9fff]/.test(text)) {
      return 'zh';
    }

    // Check for Cyrillic
    if (/[\u0400-\u04FF]/.test(text)) {
      return 'ru';
    }

    // Default to English
    return 'en';
  }

  /**
   * Tokenize text
   */
  tokenize(text, language) {
    const lowerText = text.toLowerCase();

    if (language === 'zh') {
      // Chinese: split into bigrams and trigrams for matching
      const tokens = new Set();

      // Add full text
      tokens.add(lowerText);

      // Add bigrams
      for (let i = 0; i < lowerText.length - 1; i++) {
        tokens.add(lowerText.substring(i, i + 2));
      }

      // Add trigrams
      for (let i = 0; i < lowerText.length - 2; i++) {
        tokens.add(lowerText.substring(i, i + 3));
      }

      // Add 4-grams (common for Chinese terms like 植保无人机)
      for (let i = 0; i < lowerText.length - 3; i++) {
        tokens.add(lowerText.substring(i, i + 4));
      }

      // Add 5-grams
      for (let i = 0; i < lowerText.length - 4; i++) {
        tokens.add(lowerText.substring(i, i + 5));
      }

      return Array.from(tokens);
    } else {
      // English/Russian: split by word boundaries
      return lowerText.split(/\s+/).filter(Boolean);
    }
  }

  /**
   * Calculate match score between concept and tokens
   */
  calculateMatchScore(concept, tokens, language, expandSynonyms) {
    let score = 0;

    // Get labels to match based on language
    const labels = this.getConceptLabels(concept, language, expandSynonyms);

    for (const label of labels) {
      const labelLower = label.toLowerCase();

      if (language === 'zh') {
        // For Chinese, check if label is in tokens (bigram/trigram match)
        if (tokens.includes(labelLower)) {
          score = Math.max(score, 1.0); // Exact match
        } else {
          // Partial match: count overlapping n-grams
          let overlap = 0;
          const labelTokens = this.tokenize(label, 'zh');
          for (const token of tokens) {
            if (labelTokens.includes(token)) {
              overlap++;
            }
          }
          const partialScore = overlap / Math.max(labelTokens.length, tokens.length);
          score = Math.max(score, partialScore * 0.8);
        }
      } else {
        // For English/Russian, check word-level matches
        const labelWords = labelLower.split(/\s+/);

        // Exact match
        const labelPhrase = labelWords.join(' ');
        const textPhrase = tokens.join(' ');
        if (textPhrase.includes(labelPhrase)) {
          score = Math.max(score, 1.0);
        } else {
          // Partial match: count matching words
          let matchingWords = 0;
          for (const word of labelWords) {
            if (tokens.includes(word)) {
              matchingWords++;
            }
          }
          const partialScore = matchingWords / labelWords.length;
          score = Math.max(score, partialScore * 0.7);
        }
      }
    }

    return score;
  }

  /**
   * Get concept labels (with optional synonyms)
   */
  getConceptLabels(concept, language, expandSynonyms) {
    const labels = [];

    if (language === 'zh') {
      if (concept.prefLabel_zh) labels.push(concept.prefLabel_zh);
      if (expandSynonyms) labels.push(...concept.altLabels_zh);
    } else if (language === 'ru') {
      if (concept.prefLabel_ru) labels.push(concept.prefLabel_ru);
      if (expandSynonyms) labels.push(...concept.altLabels_ru);
    } else if (language === 'en') {
      if (concept.prefLabel_en) labels.push(concept.prefLabel_en);
      if (expandSynonyms) labels.push(...concept.altLabels_en);
    }

    return labels;
  }

  /**
   * Get matched terms for a concept
   */
  getMatchedTerms(concept, tokens, language) {
    const labels = this.getConceptLabels(concept, language, true);
    const matched = [];

    for (const label of labels) {
      const labelLower = label.toLowerCase();

      if (language === 'zh') {
        if (tokens.includes(labelLower)) {
          matched.push(label);
        }
      } else {
        const textPhrase = tokens.join(' ');
        if (textPhrase.includes(labelLower)) {
          matched.push(label);
        }
      }
    }

    return matched;
  }

  /**
   * Expand concept hierarchy
   *
   * @param {string} conceptId - Concept ID
   * @param {string} direction - 'narrower' (children), 'broader' (parents), 'both'
   * @param {number} depth - Depth to traverse (default: unlimited)
   * @returns {Array} Array of concept IDs
   */
  async expandHierarchy(conceptId, direction = 'narrower', depth = Infinity) {
    const visited = new Set();
    const result = [];

    const traverse = async (id, currentDepth) => {
      if (visited.has(id) || currentDepth > depth) return;
      visited.add(id);

      if (id !== conceptId) {
        result.push(id);
      }

      const concept = this.conceptsCache.get(id);
      if (!concept) return;

      if (direction === 'narrower' || direction === 'both') {
        // Find children (concepts where broader = id)
        for (const c of this.conceptsCache.values()) {
          if (c.broader === id) {
            await traverse(c.id, currentDepth + 1);
          }
        }
      }

      if (direction === 'broader' || direction === 'both') {
        // Find parent
        if (concept.broader) {
          await traverse(concept.broader, currentDepth + 1);
        }
      }
    };

    await traverse(conceptId, 0);
    return result;
  }

  /**
   * Cross-lingual match: find concepts in one language, return in another
   *
   * @param {string} term - Search term
   * @param {string} sourceLang - Source language ('zh', 'en', 'ru')
   * @param {string} targetLang - Target language ('zh', 'en', 'ru')
   * @returns {Array} Matched concepts in target language
   */
  async crossLingualMatch(term, sourceLang, targetLang) {
    // Match in source language
    const matches = await this.matchText(term, sourceLang, { maxResults: 5 });

    // Return labels in target language
    return matches.map(match => {
      const concept = this.conceptsCache.get(match.conceptId);
      if (!concept) return null;

      let label = '';
      if (targetLang === 'zh') label = concept.prefLabel_zh;
      else if (targetLang === 'ru') label = concept.prefLabel_ru;
      else if (targetLang === 'en') label = concept.prefLabel_en;

      return {
        conceptId: match.conceptId,
        label,
        score: match.score,
        sourceLabel: match[`prefLabel_${sourceLang}`]
      };
    }).filter(Boolean);
  }

  /**
   * Search concepts by exact label
   */
  async searchByLabel(label, language = 'all') {
    const results = [];

    for (const concept of this.conceptsCache.values()) {
      if (language === 'all' || language === 'zh') {
        if (concept.prefLabel_zh === label || concept.altLabels_zh.includes(label)) {
          results.push(concept);
          continue;
        }
      }

      if (language === 'all' || language === 'ru') {
        if (concept.prefLabel_ru === label || concept.altLabels_ru.includes(label)) {
          results.push(concept);
          continue;
        }
      }

      if (language === 'all' || language === 'en') {
        if (concept.prefLabel_en === label || concept.altLabels_en.includes(label)) {
          results.push(concept);
          continue;
        }
      }
    }

    return results;
  }

  /**
   * Refresh cache if stale
   */
  async refreshCacheIfNeeded() {
    if (!this.lastCacheUpdate || (Date.now() - this.lastCacheUpdate) > this.cacheTimeout) {
      await this.loadConcepts();
    }
  }

  /**
   * Get concept by ID
   */
  getConcept(conceptId) {
    return this.conceptsCache.get(conceptId);
  }

  /**
   * Get all concepts
   */
  getAllConcepts() {
    return Array.from(this.conceptsCache.values());
  }
}

// Singleton
let instance = null;

export function getOntologyMatcher() {
  if (!instance) {
    instance = new OntologyMatcher();
  }
  return instance;
}

export default OntologyMatcher;
