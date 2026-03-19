/**
 * RealtimeSubscriptions — подписки на изменения объектов памяти в реальном времени
 *
 * WebSocket-like система уведомлений без зависимости от WebSocket.
 * Использует callback-паттерн — внешний транспорт (Socket.io, WS, SSE)
 * подключается извне через notify().
 *
 * Агент подписывается на изменения по фильтру:
 *   - database — конкретная БД
 *   - types[] — типы объектов (t)
 *   - objectIds[] — конкретные объекты
 *   - kinds[] — виды связей (для link-событий)
 *
 * При изменении объекта вызывается notify(event) —
 * система матчит событие по всем подпискам и вызывает callback.
 *
 * «Внимание — это направленная память. Подписка — это акт внимания.»
 */

import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

// ============================================================================
// RealtimeSubscriptions
// ============================================================================

export class RealtimeSubscriptions extends EventEmitter {
  constructor(options = {}) {
    super();

    /** @type {Map<string, SubscriptionEntry>} subscriptionId → entry */
    this.subscriptions = new Map();

    /** @type {Map<string, Set<string>>} agentId → Set<subscriptionId> */
    this.agentSubscriptions = new Map();

    /** Счётчик отправленных событий */
    this.eventsDispatched = 0;

    /** Логгер */
    this.logger = options.logger || console;

    /** Макс. подписок на одного агента (защита от утечки) */
    this.maxPerAgent = options.maxPerAgent || 100;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Подписка
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Подписаться на изменения объектов
   *
   * @param {string} agentId — идентификатор агента-подписчика
   * @param {Object} filter — фильтр событий
   * @param {string} [filter.database] — имя БД (null = все)
   * @param {number[]} [filter.types] — типы объектов (t)
   * @param {number[]} [filter.objectIds] — конкретные ID объектов
   * @param {string[]} [filter.kinds] — виды связей (для link-событий)
   * @param {Function} callback — callback(event) при совпадении
   * @returns {string} subscriptionId
   */
  subscribe(agentId, filter, callback) {
    if (!agentId || typeof agentId !== 'string') {
      throw new Error('RealtimeSubscriptions: agentId required');
    }
    if (typeof callback !== 'function') {
      throw new Error('RealtimeSubscriptions: callback must be a function');
    }

    // Проверка лимита подписок
    const agentSubs = this.agentSubscriptions.get(agentId);
    if (agentSubs && agentSubs.size >= this.maxPerAgent) {
      throw new Error(`RealtimeSubscriptions: agent "${agentId}" exceeded max subscriptions (${this.maxPerAgent})`);
    }

    const subscriptionId = `sub_${crypto.randomUUID()}`;
    const normalizedFilter = this._normalizeFilter(filter || {});

    /** @type {SubscriptionEntry} */
    const entry = {
      id: subscriptionId,
      agentId,
      filter: normalizedFilter,
      callback,
      createdAt: new Date().toISOString(),
      matchCount: 0,
    };

    this.subscriptions.set(subscriptionId, entry);

    // Индекс по агенту
    if (!this.agentSubscriptions.has(agentId)) {
      this.agentSubscriptions.set(agentId, new Set());
    }
    this.agentSubscriptions.get(agentId).add(subscriptionId);

    this.logger.debug?.(`[RealtimeSubscriptions] subscribe: agent=${agentId} sub=${subscriptionId} filter=${JSON.stringify(normalizedFilter)}`);
    this.emit('subscribed', { subscriptionId, agentId, filter: normalizedFilter });

    return subscriptionId;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Отписка
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Удалить подписку
   *
   * @param {string} subscriptionId — ID подписки (полученный от subscribe())
   * @returns {boolean} true если подписка была найдена и удалена
   */
  unsubscribe(subscriptionId) {
    const entry = this.subscriptions.get(subscriptionId);
    if (!entry) {
      this.logger.debug?.(`[RealtimeSubscriptions] unsubscribe: not found sub=${subscriptionId}`);
      return false;
    }

    // Удалить из индекса агента
    const agentSubs = this.agentSubscriptions.get(entry.agentId);
    if (agentSubs) {
      agentSubs.delete(subscriptionId);
      if (agentSubs.size === 0) {
        this.agentSubscriptions.delete(entry.agentId);
      }
    }

    this.subscriptions.delete(subscriptionId);

    this.logger.debug?.(`[RealtimeSubscriptions] unsubscribe: agent=${entry.agentId} sub=${subscriptionId}`);
    this.emit('unsubscribed', { subscriptionId, agentId: entry.agentId });

    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Уведомление об изменении
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Уведомить о создании/обновлении/удалении/связывании объекта.
   * Матчит по всем подпискам, вызывает callback совпавших.
   *
   * @param {Object} event — событие изменения
   * @param {string} event.database — имя БД
   * @param {number} event.objectId — ID объекта
   * @param {number} [event.typeId] — тип объекта (t)
   * @param {string} event.action — 'create' | 'update' | 'delete' | 'link'
   * @param {*} [event.value] — новое значение (или данные связи)
   * @param {string} [event.actor] — кто произвёл изменение
   * @param {string} [event.kind] — вид связи (для action='link')
   * @returns {number} количество вызванных callback-ов
   */
  notify(event) {
    if (!event || !event.action) {
      this.logger.warn?.('[RealtimeSubscriptions] notify: event.action required');
      return 0;
    }

    let matchCount = 0;
    const enrichedEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
      eventId: `evt_${crypto.randomUUID()}`,
    };

    for (const [subId, entry] of this.subscriptions) {
      if (this._matchesFilter(entry.filter, enrichedEvent)) {
        try {
          entry.callback(enrichedEvent);
          entry.matchCount++;
          matchCount++;
        } catch (err) {
          this.logger.error?.(`[RealtimeSubscriptions] callback error: sub=${subId} agent=${entry.agentId}`, err.message);
        }
      }
    }

    this.eventsDispatched += matchCount;

    if (matchCount > 0) {
      this.logger.debug?.(`[RealtimeSubscriptions] notify: action=${event.action} objectId=${event.objectId} matched=${matchCount}`);
    }

    // Эмит для внешних слушателей (мониторинг, логирование)
    this.emit('event', { event: enrichedEvent, matchCount });

    return matchCount;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Уведомление об изменении поля агента
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Уведомить агента, что объект в его поле внимания изменился
   *
   * @param {string} agentId — агент, которому направлено уведомление
   * @param {number} objectId — изменившийся объект
   * @param {string} [zone='field'] — зона: 'field' | 'periphery' | 'archive'
   * @returns {number} количество вызванных callback-ов
   */
  notifyFieldChange(agentId, objectId, zone = 'field') {
    const agentSubs = this.agentSubscriptions.get(agentId);
    if (!agentSubs || agentSubs.size === 0) {
      return 0;
    }

    const fieldEvent = {
      database: null,
      objectId,
      typeId: null,
      action: 'field_change',
      value: { zone },
      actor: 'system',
      timestamp: new Date().toISOString(),
      eventId: `evt_${crypto.randomUUID()}`,
    };

    let matchCount = 0;
    for (const subId of agentSubs) {
      const entry = this.subscriptions.get(subId);
      if (!entry) continue;

      // Для field_change — вызываем если objectId в фильтре или фильтр пустой
      const filter = entry.filter;
      const objectMatch = !filter.objectIds || filter.objectIds.length === 0 || filter.objectIds.includes(objectId);

      if (objectMatch) {
        try {
          entry.callback(fieldEvent);
          entry.matchCount++;
          matchCount++;
        } catch (err) {
          this.logger.error?.(`[RealtimeSubscriptions] notifyFieldChange callback error: sub=${subId}`, err.message);
        }
      }
    }

    this.eventsDispatched += matchCount;
    this.logger.debug?.(`[RealtimeSubscriptions] notifyFieldChange: agent=${agentId} objectId=${objectId} zone=${zone} matched=${matchCount}`);

    return matchCount;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Запросы
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Получить все подписки агента
   *
   * @param {string} agentId — идентификатор агента
   * @returns {Array<{id, filter, createdAt, matchCount}>}
   */
  getSubscriptions(agentId) {
    const agentSubs = this.agentSubscriptions.get(agentId);
    if (!agentSubs) return [];

    const result = [];
    for (const subId of agentSubs) {
      const entry = this.subscriptions.get(subId);
      if (entry) {
        result.push({
          id: entry.id,
          filter: entry.filter,
          createdAt: entry.createdAt,
          matchCount: entry.matchCount,
        });
      }
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Статистика
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Статистика подписок
   *
   * @returns {{totalSubscriptions, agentsSubscribed, eventsDispatched}}
   */
  getStats() {
    return {
      totalSubscriptions: this.subscriptions.size,
      agentsSubscribed: this.agentSubscriptions.size,
      eventsDispatched: this.eventsDispatched,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Очистка
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Удалить все подписки агента (при отключении)
   *
   * @param {string} agentId
   * @returns {number} количество удалённых подписок
   */
  unsubscribeAll(agentId) {
    const agentSubs = this.agentSubscriptions.get(agentId);
    if (!agentSubs) return 0;

    const count = agentSubs.size;
    for (const subId of [...agentSubs]) {
      this.subscriptions.delete(subId);
    }
    this.agentSubscriptions.delete(agentId);

    this.logger.debug?.(`[RealtimeSubscriptions] unsubscribeAll: agent=${agentId} removed=${count}`);
    return count;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Приватные методы
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Нормализовать фильтр — привести к единообразному виду
   * @private
   */
  _normalizeFilter(filter) {
    return {
      database: filter.database || null,
      types: Array.isArray(filter.types) ? filter.types.map(Number) : null,
      objectIds: Array.isArray(filter.objectIds) ? filter.objectIds.map(Number) : null,
      kinds: Array.isArray(filter.kinds) ? filter.kinds : null,
    };
  }

  /**
   * Проверить совпадение события с фильтром подписки
   *
   * Логика: все заданные критерии должны совпадать (AND).
   * null/пустой массив = не проверять (пропустить всё).
   *
   * @private
   */
  _matchesFilter(filter, event) {
    // database
    if (filter.database && event.database && filter.database !== event.database) {
      return false;
    }

    // types
    if (filter.types && filter.types.length > 0) {
      if (event.typeId != null && !filter.types.includes(event.typeId)) {
        return false;
      }
    }

    // objectIds
    if (filter.objectIds && filter.objectIds.length > 0) {
      if (event.objectId != null && !filter.objectIds.includes(event.objectId)) {
        return false;
      }
    }

    // kinds (для link-событий)
    if (filter.kinds && filter.kinds.length > 0) {
      if (event.kind && !filter.kinds.includes(event.kind)) {
        return false;
      }
    }

    return true;
  }
}

/**
 * @typedef {Object} SubscriptionEntry
 * @property {string} id — ID подписки
 * @property {string} agentId — ID агента
 * @property {Object} filter — нормализованный фильтр
 * @property {Function} callback — callback(event)
 * @property {string} createdAt — ISO timestamp создания
 * @property {number} matchCount — сколько раз сработала
 */

export default RealtimeSubscriptions;
