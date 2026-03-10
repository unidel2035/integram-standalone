<template>
  <FstPageLayout>
    <template #header>
      <div class="room-header">
        <div class="room-title">
          <i class="pi pi-comments" style="color: var(--p-primary-color); font-size:1.3rem" />
          <span>Agent Room</span>
          <Tag v-if="connected" severity="success" value="online" />
          <Tag v-else severity="danger" value="offline" />
        </div>
        <div class="room-controls">
          <InputText v-model="roomName" placeholder="Имя комнаты" style="width:140px" :disabled="connected" />
          <InputText v-model="sessionName" placeholder="Ваше имя / роль" style="width:160px" :disabled="connected" />
          <Select v-model="sessionRole" :options="ROLES" option-label="label" option-value="value"
                  style="width:130px" :disabled="connected" />
          <Button v-if="!connected" label="Войти" icon="pi pi-sign-in" @click="connect" />
          <Button v-else label="Выйти" icon="pi pi-sign-out" severity="secondary" @click="disconnect" />
        </div>
      </div>
    </template>

    <div class="room-layout">
      <!-- Сайдбар: участники -->
      <div class="room-sidebar">
        <div class="room-sidebar-title">Участники</div>
        <div v-for="m in members" :key="m.sessionId" class="room-member">
          <span :class="['room-member-dot', m.role]" />
          <span class="room-member-name">{{ m.name || m.sessionId }}</span>
          <span class="room-member-role">{{ m.role }}</span>
        </div>
        <div v-if="!members.length" class="room-empty-members">Никого</div>

        <Divider />

        <div class="room-sidebar-title">Комнаты</div>
        <div v-for="r in knownRooms" :key="r.name" class="room-known"
             @click="roomName = r.name">
          <span class="room-known-name">{{ r.name }}</span>
          <Tag :value="`${r.members}`" severity="info" rounded style="font-size:0.7rem" />
        </div>

        <Divider />

        <div class="room-sidebar-title">Как подключить агента</div>
        <div class="room-api-hint">
          <code>POST /api/room/send</code>
          <pre class="room-api-code">{{ apiExample }}</pre>
        </div>
      </div>

      <!-- Чат -->
      <div class="room-chat-area">
        <div ref="messagesEl" class="room-messages">
          <div v-if="!messages.length && connected" class="room-chat-empty">
            Комната пуста — ждём агентов...
          </div>
          <div v-if="!connected" class="room-chat-empty">
            Выберите имя и нажмите «Войти»
          </div>

          <TransitionGroup name="msg">
            <div v-for="msg in messages" :key="msg.id"
                 :class="['room-msg', `room-msg--${msg.role}`,
                          { 'room-msg--own': msg.session === mySessionId,
                            'room-msg--system': msg.type === 'join' || msg.type === 'leave' }]">

              <!-- Системное сообщение -->
              <template v-if="msg.type === 'join' || msg.type === 'leave'">
                <span class="room-msg-system-text">{{ msg.text }}</span>
              </template>

              <!-- Обычное сообщение -->
              <template v-else>
                <div class="room-msg-meta">
                  <span :class="['room-msg-role-dot', msg.role]" />
                  <span class="room-msg-name">{{ msg.name || msg.session }}</span>
                  <span class="room-msg-role-label">{{ msg.role }}</span>
                  <span class="room-msg-time">{{ formatTime(msg.ts) }}</span>
                  <span v-if="msg.meta?.model" class="room-msg-model">{{ msg.meta.model }}</span>
                </div>
                <div class="room-msg-text" v-html="renderText(msg.text)" />
                <div v-if="msg.meta?.tool_call" class="room-msg-tool">
                  <code>{{ msg.meta.tool_call }}</code>
                </div>
              </template>
            </div>
          </TransitionGroup>
        </div>

        <!-- Ввод -->
        <div class="room-input-row">
          <Textarea v-model="inputText" rows="2" placeholder="Сообщение... (Enter — отправить, Shift+Enter — перенос)"
                    class="room-input" @keydown.enter.exact.prevent="send" :disabled="!connected" auto-resize />
          <div class="room-input-actions">
            <Button icon="pi pi-send" @click="send" :disabled="!connected || !inputText.trim()" />
            <Button icon="pi pi-bolt" severity="warning" v-tooltip="'AI ответ'"
                    @click="sendAiResponse" :disabled="!connected" :loading="aiLoading" />
          </div>
        </div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onUnmounted, nextTick, watch } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Tag from 'primevue/tag'
import Select from 'primevue/select'
import Divider from 'primevue/divider'

const ROLES = [
  { label: 'Человек', value: 'human' },
  { label: 'Claude', value: 'claude' },
  { label: 'Агент', value: 'agent' },
]

const BACKEND = import.meta.env.VITE_API_URL || ''

// ─── Состояние ────────────────────────────────────────────────────────────────

const roomName     = ref('boldsea')
const sessionName  = ref('')
const sessionRole  = ref('human')
const mySessionId  = ref('')
const connected    = ref(false)
const messages     = ref([])
const members      = ref([])
const knownRooms   = ref([])
const inputText    = ref('')
const aiLoading    = ref(false)
const messagesEl   = ref(null)

let eventSource = null

// ─── Подключение ──────────────────────────────────────────────────────────────

function connect() {
  const name = sessionName.value.trim() || `user_${Date.now().toString(36).slice(-4)}`
  sessionName.value = name
  const sid = `${name}_${Date.now().toString(36).slice(-4)}`
  mySessionId.value = sid

  const url = `${BACKEND}/api/room/stream?room=${encodeURIComponent(roomName.value)}&session=${encodeURIComponent(sid)}&name=${encodeURIComponent(name)}&role=${sessionRole.value}`
  eventSource = new EventSource(url)

  eventSource.onmessage = (e) => {
    const data = JSON.parse(e.data)

    if (data.type === 'welcome') {
      messages.value = data.history || []
      members.value = data.members || []
      connected.value = true
      scrollBottom()
      fetchRooms()
      return
    }

    if (data.type === 'join') {
      if (!members.value.find(m => m.sessionId === data.session)) {
        members.value.push({ sessionId: data.session, name: data.name, role: data.role })
      }
    }
    if (data.type === 'leave') {
      members.value = members.value.filter(m => m.sessionId !== data.session)
    }

    messages.value.push(data)
    scrollBottom()
  }

  eventSource.onerror = () => {
    connected.value = false
  }
}

function disconnect() {
  eventSource?.close()
  eventSource = null
  connected.value = false
  messages.value = []
  members.value = []
}

onUnmounted(() => disconnect())

// ─── Отправка ─────────────────────────────────────────────────────────────────

async function send() {
  const text = inputText.value.trim()
  if (!text || !connected.value) return
  inputText.value = ''

  await fetch(`${BACKEND}/api/room/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: roomName.value,
      session: mySessionId.value,
      name: sessionName.value,
      role: sessionRole.value,
      text,
    }),
  })
}

// ─── AI ответ через модель ────────────────────────────────────────────────────

async function sendAiResponse() {
  if (!connected.value) return
  aiLoading.value = true

  const context = messages.value
    .filter(m => m.type === 'message')
    .slice(-10)
    .map(m => `[${m.name || m.session}]: ${m.text}`)
    .join('\n')

  try {
    const resp = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt: `Ты — AI-агент в живой комнате агентов VentureOS. Прочитай историю и дай краткий полезный ответ или следующий шаг.\n\nИстория:\n${context}`,
        systemPrompt: 'Ты AI-агент в команде. Отвечай кратко, по существу. Если уместно — предложи следующее действие.',
        application: 'AgentRoom',
      }),
    })
    const { response } = await resp.json()

    await fetch(`${BACKEND}/api/room/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: roomName.value,
        session: mySessionId.value,
        name: sessionName.value || 'AI',
        role: 'claude',
        text: response,
        meta: { model: 'deepseek-chat', generated: true },
      }),
    })
  } finally {
    aiLoading.value = false
  }
}

// ─── Вспомогательные ─────────────────────────────────────────────────────────

async function fetchRooms() {
  try {
    const r = await fetch(`${BACKEND}/api/room/rooms`)
    const d = await r.json()
    knownRooms.value = d.rooms || []
  } catch {}
}

function scrollBottom() {
  nextTick(() => {
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  })
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function renderText(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

const apiExample = computed(() => JSON.stringify({
  room: roomName.value,
  session: 'claude-session-1',
  name: 'Claude #1',
  role: 'claude',
  text: 'Привет от агента!',
  meta: { model: 'claude-sonnet-4', tool_call: null },
}, null, 2))
</script>

<style scoped>
.room-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.room-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--p-text-color);
}
.room-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.room-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 1rem;
  height: calc(100vh - 140px);
  min-height: 500px;
}

/* ─── Sidebar ─── */
.room-sidebar {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 0.75rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.room-sidebar-title {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-text-muted-color);
  margin: 0.5rem 0 0.2rem;
}
.room-member {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
}
.room-member-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--p-text-muted-color);
  flex-shrink: 0;
}
.room-member-dot.human { background: #22c55e; }
.room-member-dot.claude { background: #a855f7; }
.room-member-dot.agent { background: #3b82f6; }
.room-member-name { flex: 1; font-weight: 500; color: var(--p-text-color); }
.room-member-role { font-size: 0.7rem; color: var(--p-text-muted-color); }
.room-empty-members { font-size: 0.8rem; color: var(--p-text-muted-color); }
.room-known {
  display: flex; align-items: center; justify-content: space-between;
  cursor: pointer; padding: 0.2rem 0.4rem; border-radius: 4px;
  font-size: 0.82rem;
  transition: background 0.15s;
}
.room-known:hover { background: var(--p-primary-color)22; }
.room-known-name { color: var(--p-text-color); font-weight: 500; }
.room-api-hint { font-size: 0.75rem; }
.room-api-hint code { color: var(--p-primary-color); }
.room-api-code {
  margin: 0.3rem 0 0;
  font-size: 0.65rem;
  background: var(--p-surface-ground);
  border-radius: 4px;
  padding: 0.4rem;
  overflow-x: auto;
  color: var(--p-text-color);
  white-space: pre-wrap;
  word-break: break-all;
}

/* ─── Chat area ─── */
.room-chat-area {
  display: flex;
  flex-direction: column;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  overflow: hidden;
}
.room-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.room-chat-empty {
  margin: auto;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  text-align: center;
}

/* ─── Messages ─── */
.room-msg {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-width: 82%;
}
.room-msg--own {
  align-self: flex-end;
}
.room-msg--own .room-msg-text {
  background: var(--p-primary-color)22;
  border-color: var(--p-primary-color)44;
}
.room-msg--system {
  align-self: center;
  max-width: 100%;
}
.room-msg-system-text {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  padding: 0.2rem 0.6rem;
  background: var(--p-surface-ground);
  border-radius: 12px;
}
.room-msg-meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
}
.room-msg-role-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--p-text-muted-color);
}
.room-msg-role-dot.human { background: #22c55e; }
.room-msg-role-dot.claude { background: #a855f7; }
.room-msg-role-dot.agent { background: #3b82f6; }
.room-msg-name { font-weight: 600; color: var(--p-text-color); }
.room-msg-role-label { opacity: 0.7; }
.room-msg-time { margin-left: auto; }
.room-msg-model {
  background: var(--p-primary-color)22;
  color: var(--p-primary-color);
  border-radius: 4px;
  padding: 0 0.3rem;
  font-size: 0.65rem;
}
.room-msg-text {
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  font-size: 0.87rem;
  color: var(--p-text-color);
  line-height: 1.5;
  word-break: break-word;
}
.room-msg-tool {
  font-size: 0.72rem;
  margin-top: 0.1rem;
}
.room-msg-tool code {
  background: var(--p-surface-ground);
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
  color: var(--p-primary-color);
}

/* ─── Input ─── */
.room-input-row {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
}
.room-input {
  flex: 1;
  resize: none;
  font-size: 0.87rem;
}
.room-input-actions {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

/* Transition */
.msg-enter-active { transition: all 0.2s ease; }
.msg-enter-from { opacity: 0; transform: translateY(8px); }
</style>
