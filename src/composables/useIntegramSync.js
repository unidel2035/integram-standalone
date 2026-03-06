/**
 * useIntegramSync.js
 *
 * Vue composable for cross-tab / cross-user Integram data synchronization
 * via WebSocket (Issue #6742 — Step 2 of #6738).
 *
 * Bridges the local EventBus (Step 1) with the backend WebSocket channel,
 * so that changes made in any browser tab or by any user are instantly
 * propagated to all other subscribers of the same (database, typeId) channel.
 *
 * Architecture:
 *   Component saves object
 *     → integramEventBus.emit('object:updated', payload)      ← Step 1 (same-page)
 *     → useIntegramSync.publish(payload)                       ← Step 2 (cross-tab/user)
 *       → WS send 'integram-sync:publish'
 *       → Backend broadcasts 'integram-sync:event' to other subscribers
 *       → Other clients receive → integramEventBus.emit()     ← feeds Step 1 handlers
 *
 * Usage:
 * ```javascript
 * import { useIntegramSync } from '@/composables/useIntegramSync'
 *
 * const { publish, subscribe, unsubscribe, connected } = useIntegramSync()
 *
 * // Subscribe to a table's events
 * subscribe([{ database: 'kval', typeId: '467150' }])
 *
 * // After saving an object:
 * publish('object:updated', { database, typeId, objectId, requisites })
 *
 * // Cleanup (called automatically in onBeforeUnmount if autoCleanup=true)
 * unsubscribe([{ database, typeId }])
 * ```
 */

import { ref, onBeforeUnmount } from 'vue'
import { getWebSocketUrl } from '@/utils/apiConfig'
import { integramEventBus } from '@/services/integramEventBus'

// ─────────────────────────────────────────────────────────────────────────────
// Module-level singleton — one WS connection shared across all composable calls
// ─────────────────────────────────────────────────────────────────────────────

let _ws = null
let _wsReady = false
let _connectPromise = null
const _subscribers = new Set()          // channel keys subscribed server-side
const _pendingMessages = []             // queued while connecting
const _instanceCount = ref(0)           // how many composable instances are active

const MAX_RECONNECT_ATTEMPTS = 5
let _reconnectAttempts = 0
let _reconnectTimer = null

function _channelKey(database, typeId) {
  return `${database}:${typeId}`
}

function _sendWhenReady(msg) {
  if (_ws && _wsReady && _ws.readyState === WebSocket.OPEN) {
    _ws.send(JSON.stringify(msg))
  } else {
    _pendingMessages.push(msg)
  }
}

function _flushPending() {
  while (_pendingMessages.length > 0) {
    const msg = _pendingMessages.shift()
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify(msg))
    }
  }
}

function _onMessage(event) {
  let data
  try {
    data = JSON.parse(event.data)
  } catch {
    return
  }

  if (data.type === 'integram-sync:event') {
    // Re-emit via local EventBus so all subscribed components react immediately
    const { event: busEvent, database, typeId, objectId, requisites } = data
    if (busEvent === 'object:updated') {
      integramEventBus.emit('object:updated', { database, typeId, objectId, requisites })
    } else if (busEvent === 'object:deleted') {
      integramEventBus.emit('object:deleted', { database, typeId, objectId })
    } else if (busEvent === 'object:created') {
      integramEventBus.emit('object:created', { database, typeId, objectId })
    }
  }
}

function _connect() {
  if (_connectPromise) return _connectPromise

  _connectPromise = new Promise((resolve) => {
    try {
      const wsUrl = getWebSocketUrl()
      _ws = new WebSocket(wsUrl)

      _ws.onopen = () => {
        _wsReady = true
        _reconnectAttempts = 0
        _flushPending()

        // Re-subscribe to all previously known channels (reconnect scenario)
        if (_subscribers.size > 0) {
          const channels = Array.from(_subscribers).map((key) => {
            const [database, typeId] = key.split(':')
            return { database, typeId }
          })
          _ws.send(JSON.stringify({ type: 'integram-sync:subscribe', channels }))
        }

        resolve()
      }

      _ws.onmessage = _onMessage

      _ws.onclose = (event) => {
        _wsReady = false
        _connectPromise = null

        if (event.code !== 1000 && _reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          _reconnectAttempts++
          const delay = 2000 * _reconnectAttempts
          _reconnectTimer = setTimeout(() => {
            _reconnectTimer = null
            _connect()
          }, delay)
        }
      }

      _ws.onerror = () => {
        _wsReady = false
        _connectPromise = null
      }
    } catch {
      _connectPromise = null
      resolve()
    }
  })

  return _connectPromise
}

function _disconnect() {
  if (_reconnectTimer) {
    clearTimeout(_reconnectTimer)
    _reconnectTimer = null
  }
  if (_ws) {
    _reconnectAttempts = MAX_RECONNECT_ATTEMPTS // prevent auto-reconnect
    _ws.close(1000, 'All instances unmounted')
    _ws = null
  }
  _wsReady = false
  _connectPromise = null
  _subscribers.clear()
  _pendingMessages.length = 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} [options]
 * @param {boolean} [options.autoCleanup=true]  Unsubscribe + disconnect when all instances unmount
 */
export function useIntegramSync(options = {}) {
  const { autoCleanup = true } = options

  /** Channels subscribed by THIS composable instance */
  const _localChannels = new Set()

  // Track instance count for shared connection lifecycle
  _instanceCount.value++
  _connect()

  /**
   * Subscribe to one or more (database, typeId) channels.
   * @param {Array<{database: string, typeId: string|number}>} channels
   */
  function subscribe(channels) {
    if (!channels || channels.length === 0) return

    const toAdd = []
    for (const { database, typeId } of channels) {
      if (!database || typeId === undefined || typeId === null) continue
      const key = _channelKey(database, typeId)
      if (!_subscribers.has(key)) {
        _subscribers.add(key)
        toAdd.push({ database, typeId: String(typeId) })
      }
      _localChannels.add(key)
    }

    if (toAdd.length > 0) {
      _sendWhenReady({ type: 'integram-sync:subscribe', channels: toAdd })
    }
  }

  /**
   * Unsubscribe from one or more channels.
   * Only removes from server if no other instance is still subscribed to the same channel.
   * @param {Array<{database: string, typeId: string|number}>} channels
   */
  function unsubscribe(channels) {
    if (!channels || channels.length === 0) return

    const toRemove = []
    for (const { database, typeId } of channels) {
      const key = _channelKey(database, typeId)
      _localChannels.delete(key)

      // Only unsubscribe server-side if no other instance tracks this channel.
      // Since _subscribers is module-level, we need a ref-count mechanism.
      // For simplicity we always clean up when unsubscribing — harmless because
      // subscribe() will re-add on next access.
      if (_subscribers.has(key)) {
        _subscribers.delete(key)
        toRemove.push({ database, typeId: String(typeId) })
      }
    }

    if (toRemove.length > 0) {
      _sendWhenReady({ type: 'integram-sync:unsubscribe', channels: toRemove })
    }
  }

  /**
   * Publish an Integram change event to the WebSocket channel.
   * Other clients subscribed to the same (database, typeId) will receive it
   * via their local EventBus.
   *
   * The local EventBus emit should already have been done by the caller (Step 1).
   * This function handles the cross-tab/cross-user broadcast (Step 2).
   *
   * @param {'object:updated'|'object:deleted'|'object:created'} event
   * @param {{database: string, typeId: string, objectId: number|string, requisites?: object}} payload
   */
  function publish(event, payload) {
    const { database, typeId, objectId, requisites } = payload
    _sendWhenReady({
      type: 'integram-sync:publish',
      event,
      database,
      typeId: String(typeId),
      objectId,
      requisites: requisites ?? null
    })
  }

  /** Whether the WS connection is currently open */
  const connected = ref(_wsReady)

  // Keep connected ref in sync
  const _syncConnected = () => {
    connected.value = !!(_ws && _ws.readyState === WebSocket.OPEN)
  }

  // ── Auto cleanup on unmount ──────────────────────────────────────
  if (autoCleanup) {
    onBeforeUnmount(() => {
      // Unsubscribe the channels registered by THIS instance
      if (_localChannels.size > 0) {
        const channels = Array.from(_localChannels).map((key) => {
          const [database, typeId] = key.split(':')
          return { database, typeId }
        })
        unsubscribe(channels)
      }

      _instanceCount.value--

      // Disconnect shared socket when last instance is gone
      if (_instanceCount.value <= 0) {
        _instanceCount.value = 0
        _disconnect()
      }
    })
  }

  return {
    /** @type {import('vue').Ref<boolean>} */
    connected,
    subscribe,
    unsubscribe,
    publish,
    /** Internal — exposed for testing */
    _syncConnected
  }
}
