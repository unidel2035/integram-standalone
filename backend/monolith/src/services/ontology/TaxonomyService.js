/**
 * Taxonomy Service
 *
 * Provides NLP-based term extraction, concept suggestion,
 * hierarchy tree building, and concept reordering for the UAV ontology.
 *
 * Uses IntegramOntologyService as the underlying data layer.
 */

import { getOntologyService } from './IntegramOntologyService.js';
import logger from '../../utils/logger.js';

const RUSSIAN_STOP_WORDS = new Set([
  'а', 'без', 'более', 'бы', 'был', 'была', 'были', 'было', 'быть',
  'в', 'вам', 'вас', 'весь', 'во', 'вот', 'все', 'всего', 'всех', 'вы',
  'где', 'да', 'даже', 'для', 'до', 'его', 'ее', 'если', 'есть', 'ещё',
  'же', 'за', 'здесь', 'и', 'из', 'или', 'им', 'их', 'к', 'как', 'ко',
  'когда', 'кто', 'ли', 'лишь', 'мне', 'может', 'мы', 'на', 'над', 'надо',
  'наш', 'не', 'нет', 'ни', 'них', 'но', 'ну', 'о', 'об', 'однако', 'он',
  'она', 'они', 'оно', 'от', 'очень', 'по', 'под', 'при', 'с', 'со', 'так',
  'также', 'такой', 'там', 'те', 'тем', 'то', 'того', 'тоже', 'той', 'только',
  'том', 'ты', 'у', 'уже', 'хотя', 'что', 'чтобы', 'чье', 'чья', 'эта',
  'эти', 'это', 'я'
]);

const ENGLISH_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'must',
  'not', 'no', 'nor', 'so', 'if', 'then', 'than', 'too', 'very', 'just',
  'about', 'above', 'after', 'again', 'all', 'also', 'am', 'any', 'as',
  'because', 'before', 'between', 'both', 'each', 'few', 'he', 'her',
  'here', 'him', 'his', 'how', 'i', 'into', 'it', 'its', 'me', 'more',
  'most', 'my', 'now', 'only', 'other', 'our', 'out', 'over', 'own',
  'same', 'she', 'some', 'such', 'that', 'their', 'them', 'there',
  'these', 'they', 'this', 'those', 'through', 'up', 'we', 'what',
  'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'you', 'your'
]);

class TaxonomyService {
  constructor() {
    this.ontologyService = null;
  }

  /**
   * Lazily get initialized ontology service
   */
  async getService() {
    if (!this.ontologyService) {
      this.ontologyService = getOntologyService();
      await this.ontologyService.initialize();
    }
    return this.ontologyService;
  }

  /**
   * Extract terms from text using simple NLP tokenization,
   * stop-word removal, and n-gram generation (1-3 words).
   * @param {string} text - Input text
   * @returns {Array<{term: string, frequency: number, ngram: number}>} sorted by frequency desc
   */
  extractTerms(text) {
    if (!text || typeof text !== 'string') return [];

    // Tokenize: keep Cyrillic, Latin, digits; lowercase
    const tokens = text
      .toLowerCase()
      .replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);

    // Remove stop words
    const filtered = tokens.filter(
      t => !RUSSIAN_STOP_WORDS.has(t) && !ENGLISH_STOP_WORDS.has(t)
    );

    const freqMap = new Map();

    // Generate n-grams (1 to 3)
    for (let n = 1; n <= 3; n++) {
      for (let i = 0; i <= filtered.length - n; i++) {
        const ngram = filtered.slice(i, i + n).join(' ');
        if (ngram.length < 2) continue;
        const entry = freqMap.get(ngram);
        if (entry) {
          entry.frequency++;
        } else {
          freqMap.set(ngram, { term: ngram, frequency: 1, ngram: n });
        }
      }
    }

    // Sort by frequency descending, then by ngram size descending
    return Array.from(freqMap.values()).sort((a, b) => {
      if (b.frequency !== a.frequency) return b.frequency - a.frequency;
      return b.ngram - a.ngram;
    });
  }

  /**
   * Match extracted terms against existing ontology concepts.
   * @param {Array<{term: string}>} terms - Terms from extractTerms()
   * @returns {Promise<{matched: Array<{term: string, concept: object}>, unmatched: string[]}>}
   */
  async suggestConcepts(terms) {
    const svc = await this.getService();
    const concepts = await svc.getConcepts({ limit: 10000 });

    // Build a lookup: lowercase label -> concept
    const labelMap = new Map();
    for (const concept of concepts) {
      const mainLabel = (concept.val || '').toLowerCase().trim();
      if (mainLabel) labelMap.set(mainLabel, concept);

      // Also index requisite values (alt labels, English labels, etc.)
      const reqs = concept.reqs || {};
      for (const req of Object.values(reqs)) {
        const val = (req.value || '').toString().toLowerCase().trim();
        if (val && val.length > 1) {
          labelMap.set(val, concept);
        }
      }
    }

    const matched = [];
    const unmatched = [];

    for (const { term } of terms) {
      const lower = term.toLowerCase();
      const concept = labelMap.get(lower);
      if (concept) {
        matched.push({ term, concept });
      } else {
        // Try partial match: concept label contains the term or vice versa
        let found = false;
        for (const [label, c] of labelMap) {
          if (label.includes(lower) || lower.includes(label)) {
            matched.push({ term, concept: c });
            found = true;
            break;
          }
        }
        if (!found) {
          unmatched.push(term);
        }
      }
    }

    return { matched, unmatched };
  }

  /**
   * Build a hierarchy tree from broader/narrower relations.
   * @param {string} [rootId] - Optional root concept ID; if omitted, returns all root nodes
   * @returns {Promise<Array<{id: string, label: string, children: Array}>>}
   */
  async getHierarchyTree(rootId) {
    const svc = await this.getService();
    const [concepts, relations] = await Promise.all([
      svc.getConcepts({ limit: 10000 }),
      svc.getAllRelations()
    ]);

    // Map concept ID -> tree node
    const conceptMap = new Map();
    for (const c of concepts) {
      conceptMap.set(String(c.id), { id: String(c.id), label: c.val || '', children: [] });
    }

    // Collect parent-child from broader/narrower relations
    const childToParent = new Map();
    for (const rel of relations) {
      const typeLower = (rel.typeLabel || '').toLowerCase();
      if (typeLower.includes('broader') || typeLower.includes('шире')) {
        // source has broader target => target is parent of source
        childToParent.set(String(rel.sourceId), String(rel.targetId));
      } else if (typeLower.includes('narrower') || typeLower.includes('уже')) {
        // source has narrower target => source is parent of target
        childToParent.set(String(rel.targetId), String(rel.sourceId));
      }
    }

    // Build tree by attaching children to parents
    for (const [childId, parentId] of childToParent) {
      const parent = conceptMap.get(parentId);
      const child = conceptMap.get(childId);
      if (parent && child) {
        parent.children.push(child);
      }
    }

    // If rootId specified, return subtree from that root
    if (rootId) {
      const root = conceptMap.get(String(rootId));
      return root ? [root] : [];
    }

    // Otherwise return all nodes that have no parent
    const childIds = new Set(childToParent.keys());
    return Array.from(conceptMap.values()).filter(n => !childIds.has(n.id));
  }

  /**
   * Move a concept to a new parent by removing old broader relation and creating a new one.
   * @param {string} conceptId - The concept to move
   * @param {string} newParentId - The new parent concept ID
   * @returns {Promise<{success: boolean, conceptId: string, newParentId: string}>}
   */
  async reorderConcept(conceptId, newParentId) {
    const svc = await this.getService();
    const relations = await svc.getAllRelations();

    // Find and remove existing broader relation for this concept
    for (const rel of relations) {
      const typeLower = (rel.typeLabel || '').toLowerCase();
      const isBroader = typeLower.includes('broader') || typeLower.includes('шире');
      if (isBroader && String(rel.sourceId) === String(conceptId)) {
        await svc.deleteObject(rel.id);
        logger.info('[TaxonomyService] Removed old broader relation', { relationId: rel.id, conceptId });
      }
    }

    // Create new broader relation: conceptId -> broader -> newParentId
    await svc.createObject(svc.relationsTableId, `${conceptId}-broader-${newParentId}`, {
      '1673292': conceptId,   // source (concept)
      '1673293': newParentId, // target (parent)
      '1673295': 'broader'    // relation type
    });

    // Clear cache so subsequent reads see the change
    svc.clearCache();

    logger.info('[TaxonomyService] Concept reordered', { conceptId, newParentId });
    return { success: true, conceptId, newParentId };
  }
}

// Singleton
let instance = null;

export function getTaxonomyService() {
  if (!instance) {
    instance = new TaxonomyService();
  }
  return instance;
}
