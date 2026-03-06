/**
 * Composable for Integram Document Editor WebSocket connection
 *
 * Provides real-time collaborative editing functionality for Integram Document Editor
 * Issue #6459
 *
 * Usage:
 * ```javascript
 * import { useIntegramDocEditorWebSocket } from '@/composables/useIntegramDocEditorWebSocket'
 *
 * const {
 *   connected,
 *   connecting,
 *   members,
 *   sendUpdate,
 *   connect,
 *   disconnect
 * } = useIntegramDocEditorWebSocket(documentId, userId, {
 *   userName: 'John Doe',
 *   onUpdate: (content, metadata) => { ... },
 *   onMembersUpdate: (members) => { ... },
 *   onError: (error) => { ... }
 * })
 * ```
 */

import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { getWebSocketUrl } from '@/utils/apiConfig'

export function useIntegramDocEditorWebSocket(documentId, userId, options = {}) {
  const {
    userName = 'Anonymous',
    getUserName = null, // Optional getter for reactive userName (called at connect time)
    onUpdate = () => {},
    onInitialState = null, // Separate callback for initial_state (if null, falls back to onUpdate)
    onMembersUpdate = () => {},
    onTableUpdate = () => {}, // Issue #6777: Callback when embedded table data changes
    onCursor = () => {}, // Issue #6775: Callback for cursor position updates
    onError = () => {},
    onConnected = () => {},
    onDisconnected = () => {},
    autoConnect = true
  } = options

  const ws = ref(null)
  const connected = ref(false)
  const connecting = ref(false)
  const members = ref([])
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = 2000
  let pingInterval = null

  // Unique per-tab/per-connection identifier for self-echo prevention.
  // Two browser tabs belonging to the same user share the same userId,
  // so we can't use userId to distinguish them. tabId is generated fresh
  // each time the composable is instantiated and never shared across tabs.
  const tabId = Math.random().toString(36).slice(2, 11)

  // Compute roomId from documentId
  const roomId = computed(() => {
    return documentId.value ? `integram-doc-${documentId.value}` : null
  })

  /**
   * Connect to WebSocket server
   */
  const connect = () => {
    if (!documentId.value || !userId.value) {
      console.warn('[Integram Doc Editor WS] Cannot connect: missing documentId or userId')
      return
    }

    if (ws.value && (ws.value.readyState === WebSocket.CONNECTING || ws.value.readyState === WebSocket.OPEN)) {
      console.warn('[Integram Doc Editor WS] Already connecting or connected')
      return
    }

    connecting.value = true

    try {
      const wsUrl = getWebSocketUrl()

      console.log('[Integram Doc Editor WS] Connecting to:', wsUrl)

      ws.value = new WebSocket(wsUrl)

      ws.value.onopen = () => {
        console.log('[Integram Doc Editor WS] Connected')
        connected.value = true
        connecting.value = false
        reconnectAttempts.value = 0

        // Send join message
        const joinMessage = {
          type: 'integram-doc:join',
          roomId: roomId.value,
          userId: userId.value,
          tabId,
          userName: getUserName ? getUserName() : userName,
          documentId: documentId.value
        }

        console.log('[Integram Doc Editor WS] Sending join message:', joinMessage)
        ws.value.send(JSON.stringify(joinMessage))

        onConnected()

        // Keepalive ping каждые 30 сек чтобы соединение не обрывалось
        if (pingInterval) clearInterval(pingInterval)
        pingInterval = setInterval(() => {
          if (ws.value && ws.value.readyState === WebSocket.OPEN) {
            ws.value.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000)
      }

      ws.value.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('[Integram Doc Editor WS] Received message:', data.type)

          switch (data.type) {
            case 'integram-doc:init':
              // Receive initial state when joining
              console.log('[Integram Doc Editor WS] Received initial state')
              if (data.content) {
                // Use dedicated onInitialState callback if provided, otherwise fall back to onUpdate
                const initHandler = onInitialState || onUpdate
                initHandler(data.content, data.metadata || {})
              }
              if (data.members) {
                members.value = data.members
                onMembersUpdate(data.members)
              }
              break

            case 'integram-doc:update':
              // Receive update from other tab/user.
              // Use tabId (not userId) to detect self-echo: two tabs of the same user
              // share the same userId but have different tabIds.
              console.log('[Integram Doc Editor WS] Received update from:', data.userId, 'tabId:', data.tabId)
              if (data.tabId !== tabId) {
                onUpdate(data.content, data.metadata || {})
              }
              break

            case 'integram-doc:members':
              // Members list updated
              console.log('[Integram Doc Editor WS] Members updated:', data.members)
              members.value = data.members
              onMembersUpdate(data.members)
              break

            case 'integram-doc:table-update':
              // Issue #6777: Table data changed, refresh the table
              console.log('[Integram Doc Editor WS] Table update:', data.tableId, data.database)
              if (data.tableId && data.database) {
                onTableUpdate(data.tableId, data.database)
              }
              break

            case 'integram-doc:cursor':
              // Issue #6775: Cursor position update from another tab/user.
              // Use tabId for self-echo prevention (same as update messages).
              console.log('[Integram Doc Editor WS] Received cursor from:', data.userId)
              if (data.tabId !== tabId) {
                onCursor(data.userId, data.userName, data.cursor)
              }
              break

            case 'pong':
            case 'connected':
              // Keepalive / welcome — ничего не делаем
              break

            case 'error':
              console.error('[Integram Doc Editor WS] Server error:', data.message)
              onError(new Error(data.message))
              break

            default:
              console.warn('[Integram Doc Editor WS] Unknown message type:', data.type)
          }
        } catch (error) {
          console.error('[Integram Doc Editor WS] Failed to parse message:', error)
          onError(error)
        }
      }

      ws.value.onclose = (event) => {
        console.log('[Integram Doc Editor WS] Disconnected:', event.code, event.reason)
        connected.value = false
        connecting.value = false

        if (pingInterval) { clearInterval(pingInterval); pingInterval = null }

        onDisconnected()

        // Attempt reconnection if not manually closed
        if (event.code !== 1000 && reconnectAttempts.value < maxReconnectAttempts) {
          reconnectAttempts.value++
          console.log(
            `[Integram Doc Editor WS] Reconnecting (attempt ${reconnectAttempts.value}/${maxReconnectAttempts})...`
          )
          setTimeout(() => {
            if (!connected.value) {
              connect()
            }
          }, reconnectDelay * reconnectAttempts.value)
        } else if (reconnectAttempts.value >= maxReconnectAttempts) {
          console.error('[Integram Doc Editor WS] Max reconnection attempts reached')
          onError(new Error('Failed to reconnect to WebSocket server'))
        }
      }

      ws.value.onerror = (error) => {
        console.error('[Integram Doc Editor WS] WebSocket error:', error)
        connecting.value = false
        onError(error)
      }
    } catch (error) {
      console.error('[Integram Doc Editor WS] Failed to initialize WebSocket:', error)
      connecting.value = false
      connected.value = false
      onError(error)
    }
  }

  /**
   * Send content update to server
   * @param {string} content - HTML content
   * @param {object} metadata - Document metadata (embeddedTables, embeddedReports, etc.)
   */
  const sendUpdate = (content, metadata = {}) => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      console.warn('[Integram Doc Editor WS] Cannot send update: not connected')
      return false
    }

    try {
      const updateMessage = {
        type: 'integram-doc:update',
        roomId: roomId.value,
        userId: userId.value,
        tabId,
        documentId: documentId.value,
        content,
        metadata
      }

      console.log('[Integram Doc Editor WS] Sending update')
      ws.value.send(JSON.stringify(updateMessage))
      return true
    } catch (error) {
      console.error('[Integram Doc Editor WS] Failed to send update:', error)
      onError(error)
      return false
    }
  }

  /**
   * Send table update notification to server (Issue #6777)
   * Notifies other users that embedded table data has changed so they can refresh
   * @param {string} tableId - Integram table ID
   * @param {string} database - Integram database name
   */
  const sendTableUpdate = (tableId, database) => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      console.warn('[Integram Doc Editor WS] Cannot send table update: not connected')
      return false
    }

    if (!tableId || !database) {
      console.warn('[Integram Doc Editor WS] Cannot send table update: missing tableId or database')
      return false
    }

    try {
      const tableUpdateMessage = {
        type: 'integram-doc:table-update',
        roomId: roomId.value,
        userId: userId.value,
        tabId,
        documentId: documentId.value,
        tableId,
        database
      }

      console.log('[Integram Doc Editor WS] Sending table update', { tableId, database })
      ws.value.send(JSON.stringify(tableUpdateMessage))
      return true
    } catch (error) {
      console.error('[Integram Doc Editor WS] Failed to send table update:', error)
      onError(error)
      return false
    }
  }

  /**
   * Send cursor position to server (Issue #6775)
   * @param {object} cursor - Cursor position { index, length }
   */
  const sendCursor = (cursor) => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      // Don't warn here - cursor updates are optional and frequent
      return false
    }

    try {
      const cursorMessage = {
        type: 'integram-doc:cursor',
        roomId: roomId.value,
        userId: userId.value,
        tabId,
        userName: getUserName ? getUserName() : userName,
        documentId: documentId.value,
        cursor
      }

      ws.value.send(JSON.stringify(cursorMessage))
      return true
    } catch (error) {
      console.error('[Integram Doc Editor WS] Failed to send cursor:', error)
      return false
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = () => {
    if (pingInterval) { clearInterval(pingInterval); pingInterval = null }
    if (ws.value) {
      console.log('[Integram Doc Editor WS] Disconnecting')
      reconnectAttempts.value = maxReconnectAttempts // Prevent reconnection
      ws.value.close(1000, 'Client disconnecting')
      ws.value = null
      connected.value = false
      connecting.value = false
      members.value = []
    }
  }

  /**
   * Check if currently connected
   */
  const isConnected = computed(() => connected.value)

  /**
   * Check if currently connecting
   */
  const isConnecting = computed(() => connecting.value)

  /**
   * Get current members count
   */
  const membersCount = computed(() => members.value.length)

  // Auto-connect on mount if enabled
  if (autoConnect) {
    onMounted(() => {
      if (documentId.value && userId.value) {
        connect()
      }
    })
  }

  // Auto-disconnect on unmount
  onBeforeUnmount(() => {
    disconnect()
  })

  return {
    // State
    connected: isConnected,
    connecting: isConnecting,
    members,
    membersCount,

    // Methods
    connect,
    disconnect,
    sendUpdate,
    sendTableUpdate, // Issue #6777: Notify others about table data changes
    sendCursor, // Issue #6775

    // Raw WebSocket reference (for advanced usage)
    ws
  }
}
