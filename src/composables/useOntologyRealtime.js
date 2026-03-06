/**
 * Composable for real-time ontology collaboration via Socket.IO
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { io } from 'socket.io-client'

const socket = ref(null)
const onlineUsers = ref([])
const connected = ref(false)
const lastEvent = ref(null)

let toastCallback = null

export function useOntologyRealtime(options = {}) {
  const { userId, username, onEvent } = options

  function connect() {
    if (socket.value?.connected) return

    const baseUrl = import.meta.env.VITE_API_URL || window.location.origin
    socket.value = io(`${baseUrl}/ontology`, {
      transports: ['polling'],
      reconnection: true,
      reconnectionDelay: 3000,
    })

    socket.value.on('connect', () => {
      connected.value = true
      socket.value.emit('join', { userId, username })
    })

    socket.value.on('disconnect', () => {
      connected.value = false
    })

    socket.value.on('users:online', (users) => {
      onlineUsers.value = users
    })

    // Ontology change events
    const events = ['concept:created', 'concept:updated', 'concept:deleted', 'relation:created']
    events.forEach(event => {
      socket.value.on(event, (data) => {
        lastEvent.value = { type: event, data, receivedAt: new Date().toISOString() }
        if (onEvent) onEvent(event, data)
        if (toastCallback) toastCallback(event, data)
      })
    })
  }

  function disconnect() {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
      connected.value = false
    }
  }

  function changeSection(section) {
    if (socket.value?.connected) {
      socket.value.emit('section:change', { section })
    }
  }

  function setToastHandler(cb) {
    toastCallback = cb
  }

  onMounted(() => {
    connect()
  })

  onUnmounted(() => {
    disconnect()
  })

  return {
    socket,
    connected,
    onlineUsers,
    lastEvent,
    connect,
    disconnect,
    changeSection,
    setToastHandler,
    onlineCount: ref(0),
  }
}
