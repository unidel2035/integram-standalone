/**
 * integramEventBus.js
 *
 * Singleton EventBus for real-time local synchronization of Integram data
 * between components on the same page (IntegramCardsEmbed, IntegramDataTableWrapper, etc.).
 *
 * Events:
 *   'object:updated'  — { database, typeId, objectId, requisites }
 *   'object:deleted'  — { database, typeId, objectId }
 *   'object:created'  — { database, typeId, objectId }
 *
 * Usage:
 *   import { integramEventBus } from '@/services/integramEventBus'
 *
 *   // Emit after saving:
 *   integramEventBus.emit('object:updated', { database, typeId, objectId, requisites })
 *
 *   // Subscribe in onMounted:
 *   integramEventBus.on('object:updated', handler)
 *
 *   // Unsubscribe in onUnmounted:
 *   integramEventBus.off('object:updated', handler)
 */
export const integramEventBus = {
  _listeners: {},

  /**
   * Emit an event with a payload.
   * @param {string} event
   * @param {object} payload
   */
  emit(event, payload) {
    const handlers = this._listeners[event]
    if (!handlers) return
    for (const handler of [...handlers]) {
      try {
        handler(payload)
      } catch (e) {
        console.error(`[integramEventBus] Error in handler for "${event}":`, e)
      }
    }
  },

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {function} handler
   */
  on(event, handler) {
    if (!this._listeners[event]) {
      this._listeners[event] = []
    }
    if (!this._listeners[event].includes(handler)) {
      this._listeners[event].push(handler)
    }
  },

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {function} handler
   */
  off(event, handler) {
    const handlers = this._listeners[event]
    if (!handlers) return
    const idx = handlers.indexOf(handler)
    if (idx !== -1) {
      handlers.splice(idx, 1)
    }
  }
}
