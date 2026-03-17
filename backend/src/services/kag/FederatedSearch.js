/**
 * FederatedSearch — единый поиск по всем источникам данных DronDoc.
 *
 * Параллельно ищет по:
 * - KAG SQLite (65K+ онтологических сущностей)
 * - kval Integram (224 концепта БАС, СОД, дронономика)
 * - Event Engine (акторы, концепты СОД)
 *
 * Объединяет результаты с дедупликацией и ранжированием.
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export class FederatedSearch {
  constructor() {
    /** @type {Map<string, {provider: object, weight: number}>} */
    this.providers = new Map();
    /** @type {import('./DoubletStore.js').DoubletStore|null} */
    this.doubletStore = null;
  }

  /**
   * Установить DoubletStore для авто-создания дублетов при дедупликации.
   * @param {import('./DoubletStore.js').DoubletStore} store
   */
  setDoubletStore(store) {
    this.doubletStore = store;
  }

  /**
   * Добавить провайдер поиска.
   * @param {object} provider — объект с методами search(query, options) и name
   * @param {number} weight — базовый вес провайдера (0-1), default 1.0
   */
  addProvider(provider, weight = 1.0) {
    if (!provider || !provider.name || typeof provider.search !== 'function') {
      throw new Error('Provider must have name and search() method');
    }
    this.providers.set(provider.name, { provider, weight });
  }

  /**
   * Удалить провайдер.
   */
  removeProvider(name) {
    this.providers.delete(name);
  }

  /**
   * Параллельный поиск по всем провайдерам.
   * @param {string} query — поисковый запрос
   * @param {object} options — { limit, minScore, providers }
   * @returns {Promise<Array<{id, name, type, score, source, observations, properties}>>}
   */
  async search(query, options = {}) {
    const { limit = 20, minScore = 0.1, providers: providerFilter } = options;

    if (!query || query.trim().length === 0) {
      return [];
    }

    const activeProviders = [];
    for (const [name, entry] of this.providers) {
      if (providerFilter && !providerFilter.includes(name)) continue;
      activeProviders.push(entry);
    }

    if (activeProviders.length === 0) return [];

    // Параллельный поиск по всем провайдерам
    const searchPromises = activeProviders.map(async ({ provider, weight }) => {
      try {
        const results = await provider.search(query, { limit: limit * 2 });
        return results.map(r => ({
          ...r,
          score: (r.score || 0.5) * weight,
          source: r.source || provider.name,
        }));
      } catch (err) {
        console.error(`[FederatedSearch] Provider ${provider.name} error:`, err.message);
        return [];
      }
    });

    const allResults = (await Promise.all(searchPromises)).flat();

    // Ранжирование
    const ranked = this._rankResults(allResults, query);

    // Дедупликация по нормализованному имени
    const deduped = this._deduplicate(ranked);

    // Фильтрация по минимальному скору
    const filtered = deduped.filter(r => r.score >= minScore);

    return filtered.slice(0, limit);
  }

  /**
   * Получить статистику по всем провайдерам.
   */
  async getStats() {
    const stats = {};
    for (const [name, { provider }] of this.providers) {
      try {
        stats[name] = typeof provider.getStats === 'function'
          ? await provider.getStats()
          : { available: true };
      } catch {
        stats[name] = { available: false };
      }
    }
    return stats;
  }

  /**
   * Ранжирование результатов с бустами.
   */
  _rankResults(results, query) {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 1);

    return results.map(r => {
      let boost = 0;
      const nameLower = (r.name || '').toLowerCase();

      // Точное совпадение имени
      if (nameLower === queryLower) {
        boost += 0.5;
      }
      // Имя содержит запрос целиком
      else if (nameLower.includes(queryLower)) {
        boost += 0.3;
      }
      // Все термины запроса присутствуют в имени
      else if (queryTerms.length > 1 && queryTerms.every(t => nameLower.includes(t))) {
        boost += 0.2;
      }

      // Буст для доменных онтологий (не generic)
      if (r.source && (r.source.includes('kval') || r.source.includes('event-engine'))) {
        boost += 0.2;
      }

      // Буст для свежих OSINT-статей
      if (r.properties?.date || r.properties?.created_at) {
        const date = new Date(r.properties.date || r.properties.created_at);
        if (Date.now() - date.getTime() < SEVEN_DAYS_MS) {
          boost += 0.1;
        }
      }

      return { ...r, score: r.score + boost };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Дедупликация по нормализованному имени.
   * Если концепт есть и в KAG и в kval — объединить, взять макс score.
   */
  _deduplicate(results) {
    const seen = new Map(); // normalized_name → best result

    for (const r of results) {
      const key = this._normalizeKey(r.name);
      const existing = seen.get(key);

      if (!existing) {
        // Добавляем поле sources для отслеживания всех источников
        seen.set(key, { ...r, sources: [r.source] });
      } else {
        // Авто-создание дублета similar_to при обнаружении дупликата
        if (this.doubletStore && existing.id && r.id && existing.id !== r.id) {
          try {
            this.doubletStore.createDoublet(existing.id, r.id, 'similar_to', {
              confidence: Math.max(existing.score, r.score),
              createdBy: 'federated-dedup',
              sourceSystem: existing.source,
              targetSystem: r.source,
            });
          } catch {
            // UNIQUE constraint — skip
          }
        }

        // Объединяем: берём макс score, добавляем источник
        if (r.score > existing.score) {
          const mergedSources = [...new Set([...existing.sources, r.source])];
          seen.set(key, { ...r, sources: mergedSources, score: r.score });
        } else {
          existing.sources = [...new Set([...existing.sources, r.source])];
        }
        // Объединяем observations
        if (r.observations && existing.observations) {
          const allObs = [...new Set([
            ...(Array.isArray(existing.observations) ? existing.observations : [existing.observations]),
            ...(Array.isArray(r.observations) ? r.observations : [r.observations]),
          ])];
          existing.observations = allObs;
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Нормализация ключа для дедупликации.
   */
  _normalizeKey(name) {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/[_\-\s]+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .trim();
  }
}

export default FederatedSearch;
