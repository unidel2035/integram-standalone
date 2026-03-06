/**
 * Composable for Event Engine WebSocket connection (Item 4)
 *
 * Provides real-time updates for event-engine operations:
 * event-created, event-deleted, trigger-registered, model-executed, model-cloned, data-imported
 */

import { ref, onBeforeUnmount } from 'vue'
import { getWebSocketUrl } from '@/utils/apiConfig'

export function useEventEngineWebSocket(options = {}) {
  const {
    onEventCreated = () => {},
    onEventDeleted = () => {},
    onTriggerFired = () => {},
    onModelExecuted = () => {},
    onModelCloned = () => {},
    onDataImported = () => {},
    onError = () => {},
    autoConnect = true,
  } = options

  const ws = ref(null)
  const connected = ref(false)
  const lastMessage = ref(null)
  let reconnectTimer = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 5

  const handlers = {
    'event-engine:event-created': onEventCreated,
    'event-engine:event-deleted': onEventDeleted,
    'event-engine:trigger-registered': onTriggerFired,
    'event-engine:model-executed': onModelExecuted,
    'event-engine:model-cloned': onModelCloned,
    'event-engine:data-imported': onDataImported,
  }

  const connect = () => {
    try {
      const wsUrl = getWebSocketUrl ? getWebSocketUrl() : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
      ws.value = new WebSocket(wsUrl)

      ws.value.onopen = () => {
        connected.value = true
        reconnectAttempts = 0
        // Subscribe to event-engine channel
        ws.value.send(JSON.stringify({ type: 'subscribe', channel: 'event-engine' }))
      }

      ws.value.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          lastMessage.value = msg
          const handler = handlers[msg.channel]
          if (handler) handler(msg.data, msg)
        } catch { /* non-JSON message, ignore */ }
      }

      ws.value.onclose = () => {
        connected.value = false
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectTimer = setTimeout(() => {
            reconnectAttempts++
            connect()
          }, 2000 * Math.pow(2, reconnectAttempts))
        }
      }

      ws.value.onerror = (err) => {
        onError(err)
      }
    } catch (err) {
      onError(err)
    }
  }

  const disconnect = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectAttempts = maxReconnectAttempts // prevent reconnect
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
    connected.value = false
  }

  if (autoConnect) connect()

  onBeforeUnmount(() => {
    disconnect()
  })

  return {
    connected,
    lastMessage,
    connect,
    disconnect,
  }
}
