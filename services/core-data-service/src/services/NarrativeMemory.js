/**
 * NarrativeMemory — повествовательная память
 *
 * Не список фактов, а связный рассказ.
 * "Что произошло за неделю?" → нарратив с причинно-следственными связями.
 *
 * Архитектура:
 *   1. Собирает факты из памяти (SearchService + TemporalService)
 *   2. Группирует по темам (кластеризация через вектора)
 *   3. Выстраивает хронологию
 *   4. Строит нарратив (шаблон или LLM)
 *
 * Типы нарративов:
 *   - chronicle  — хронологический (что было по порядку)
 *   - causal     — причинно-следственный (почему что произошло)
 *   - summary    — краткое резюме (суть в 3 предложениях)
 *   - agent_log  — от лица агента (что я делал)
 *
 * «Анамнесис — не вспоминание, а со-присутствие прошлого»
 */

const EMBEDDING_TYPE = 54;
const LINK_TYPE = 52;
const TEMPORAL_TYPE = 53;

export class NarrativeMemory {
  constructor({ databaseService, vectorService, linkService, temporalService, options = {} }) {
    this.db = databaseService;
    this.vector = vectorService;
    this.links = linkService;
    this.temporal = temporalService;
    this.logger = options.logger || console;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Хроника — что произошло за период
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Построить хронологический нарратив
   *
   * @param {string} database
   * @param {Object} options
   * @param {string} [options.since] — ISO дата начала
   * @param {string} [options.until] — ISO дата конца
   * @param {number[]} [options.types] — фильтр по типам
   * @param {number} [options.limit] — макс. событий
   * @param {string} [options.style] — chronicle|causal|summary|agent_log
   */
  async narrate(database, options = {}) {
    const since = options.since || new Date(Date.now() - 7 * 86400000).toISOString();
    const until = options.until || new Date().toISOString();
    const limit = options.limit || 100;
    const style = options.style || 'chronicle';

    // 1. Собрать события за период
    const events = await this._collectEvents(database, since, until, options.types, limit);

    if (events.length === 0) {
      return { narrative: 'За указанный период событий не обнаружено.', events: [], style };
    }

    // 2. Обогатить связями
    const enriched = await this._enrichWithLinks(database, events);

    // 3. Кластеризовать по темам
    const clusters = await this._clusterByTopic(database, enriched);

    // 4. Построить нарратив
    let narrative;
    switch (style) {
      case 'causal':
        narrative = this._buildCausalNarrative(clusters, enriched);
        break;
      case 'summary':
        narrative = this._buildSummary(clusters, enriched);
        break;
      case 'agent_log':
        narrative = this._buildAgentLog(enriched, options.agentId);
        break;
      default:
        narrative = this._buildChronicle(clusters, enriched);
    }

    return {
      narrative,
      style,
      period: { since, until },
      eventCount: events.length,
      clusterCount: clusters.length,
      clusters: clusters.map(c => ({ topic: c.topic, count: c.events.length })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Сборка событий
  // ═══════════════════════════════════════════════════════════════════════════

  async _collectEvents(database, since, until, types, limit) {
    // Собираем TEMPORAL записи (изменения) за период
    let sql = `SELECT id, up, val FROM \`${database}\` WHERE t = ${TEMPORAL_TYPE} AND val != '' ORDER BY id DESC LIMIT ?`;
    const params = [limit * 2];
    const result = await this.db.execSql(sql, params, 'Narrative.collectTemporal');

    const events = [];
    for (const row of (result.rows || [])) {
      try {
        const parsed = JSON.parse(row.val);
        const validTo = parsed.validTo || parsed.recordedAt;
        if (validTo && validTo >= since && validTo <= until) {
          events.push({
            id: row.id,
            objectId: row.up,
            value: parsed.value,
            timestamp: validTo,
            changedBy: parsed.changedBy || 'unknown',
            type: 'change',
          });
        }
      } catch (e) { continue; }
    }

    // Также собираем новые объекты (без TEMPORAL = только что созданные)
    let sql2 = `SELECT id, val, t, up FROM \`${database}\` WHERE up != 0 AND t NOT IN (${EMBEDDING_TYPE}, ${LINK_TYPE}, ${TEMPORAL_TYPE}) AND val != '' ORDER BY id DESC LIMIT ?`;
    const result2 = await this.db.execSql(sql2, [limit], 'Narrative.collectNew');

    for (const row of (result2.rows || [])) {
      events.push({
        id: row.id,
        objectId: row.id,
        value: row.val,
        timestamp: null, // нет точного времени создания в EAV
        typeId: row.t,
        parentId: row.up,
        type: 'creation',
      });
    }

    // Сортировать по id (приблизительная хронология)
    events.sort((a, b) => a.id - b.id);

    return events.slice(0, limit);
  }

  async _enrichWithLinks(database, events) {
    const objectIds = new Set(events.map(e => e.objectId));

    for (const event of events) {
      try {
        const links = await this.links.getLinksFrom(database, event.objectId);
        event.links = links.filter(l => objectIds.has(l.targetId));
      } catch (e) {
        event.links = [];
      }
    }

    return events;
  }

  async _clusterByTopic(database, events) {
    // Простая кластеризация: группировка по parentId (объекты одного типа)
    const groups = new Map();

    for (const event of events) {
      const key = event.parentId || event.typeId || 'misc';
      if (!groups.has(key)) {
        groups.set(key, { topic: `Тип ${key}`, events: [] });
      }
      groups.get(key).events.push(event);
    }

    // Попробуем определить названия типов
    const typeIds = [...groups.keys()].filter(k => typeof k === 'number');
    if (typeIds.length > 0) {
      try {
        const placeholders = typeIds.map(() => '?').join(',');
        const result = await this.db.execSql(
          `SELECT id, val FROM \`${database}\` WHERE id IN (${placeholders}) AND up = 0`,
          typeIds, 'Narrative.typeNames'
        );
        for (const row of (result.rows || [])) {
          const group = groups.get(row.id);
          if (group) group.topic = row.val;
        }
      } catch (e) { /* keep generic names */ }
    }

    return [...groups.values()].filter(g => g.events.length > 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Построение нарративов
  // ═══════════════════════════════════════════════════════════════════════════

  _buildChronicle(clusters, events) {
    const lines = [];
    lines.push(`## Хроника (${events.length} событий)\n`);

    for (const cluster of clusters) {
      lines.push(`### ${cluster.topic} (${cluster.events.length})`);
      for (const e of cluster.events.slice(0, 20)) {
        const time = e.timestamp ? ` [${e.timestamp.substring(0, 16)}]` : '';
        const actor = e.changedBy !== 'unknown' ? ` (${e.changedBy})` : '';
        const val = String(e.value || '').substring(0, 100);
        lines.push(`- ${e.type === 'change' ? '✏️' : '✨'} ${val}${time}${actor}`);

        // Связи
        if (e.links && e.links.length > 0) {
          for (const l of e.links.slice(0, 3)) {
            lines.push(`  → ${l.kind}: объект #${l.targetId}`);
          }
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  _buildCausalNarrative(clusters, events) {
    const lines = [];
    lines.push(`## Причинно-следственный анализ\n`);

    // Найти цепочки: events[i].links → events[j]
    const chains = [];
    const eventMap = new Map(events.map(e => [e.objectId, e]));

    for (const event of events) {
      if (event.links) {
        for (const link of event.links) {
          const target = eventMap.get(link.targetId);
          if (target) {
            chains.push({ cause: event, effect: target, kind: link.kind });
          }
        }
      }
    }

    if (chains.length > 0) {
      lines.push(`Обнаружено ${chains.length} причинно-следственных связей:\n`);
      for (const chain of chains.slice(0, 20)) {
        const causeVal = String(chain.cause.value || '').substring(0, 60);
        const effectVal = String(chain.effect.value || '').substring(0, 60);
        lines.push(`- **${causeVal}** →[${chain.kind}]→ **${effectVal}**`);
      }
    } else {
      lines.push('Явных причинно-следственных связей не обнаружено.');
      lines.push('Хронологический порядок:\n');
      for (const e of events.slice(0, 20)) {
        lines.push(`- ${String(e.value || '').substring(0, 80)}`);
      }
    }

    return lines.join('\n');
  }

  _buildSummary(clusters, events) {
    const topClusters = clusters
      .sort((a, b) => b.events.length - a.events.length)
      .slice(0, 5);

    const lines = [];
    lines.push(`## Краткое резюме\n`);
    lines.push(`Всего ${events.length} событий в ${clusters.length} темах.\n`);
    lines.push('Основные темы:\n');

    for (const c of topClusters) {
      const sample = c.events[0];
      lines.push(`- **${c.topic}** (${c.events.length} событий) — ${String(sample?.value || '').substring(0, 80)}`);
    }

    const changes = events.filter(e => e.type === 'change').length;
    const creations = events.filter(e => e.type === 'creation').length;
    lines.push(`\nИзменений: ${changes}, Новых: ${creations}`);

    return lines.join('\n');
  }

  _buildAgentLog(events, agentId) {
    const agentEvents = agentId
      ? events.filter(e => e.changedBy === agentId)
      : events;

    const lines = [];
    lines.push(`## Лог агента${agentId ? ' ' + agentId : ''}\n`);

    if (agentEvents.length === 0) {
      return lines.join('\n') + 'Нет действий за период.';
    }

    for (const e of agentEvents.slice(0, 30)) {
      const val = String(e.value || '').substring(0, 100);
      lines.push(`- [${e.type}] ${val}`);
    }

    return lines.join('\n');
  }
}

export default NarrativeMemory;
