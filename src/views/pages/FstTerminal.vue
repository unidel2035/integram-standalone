<script setup>
/**
 * FstTerminal.vue — Claude Code CLI (WebSocket TTY)
 *
 * Per-user session persistence:
 * - Auto-resume: backend checks if user has a saved session → claude --continue
 * - New session: user clicks button → fresh claude
 * - Continue: explicit continue last session
 */
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

// Workspace ID = user ID (per-user sessions)
const workspaceId = computed(() => {
  return localStorage.getItem('id') || localStorage.getItem('user') || 'fst-default'
})

const terminalRef = ref(null)
const terminal = ref(null)
const fitAddon = ref(null)
const ws = ref(null)
const isConnected = ref(false)
const isConnecting = ref(true)
const statusText = ref('Подключение...')
const sessionMode = ref('auto') // current mode: auto, new, continue

// Session management
const clientId = ref(localStorage.getItem(`claude_clientId_${workspaceId.value}`) || null)
let heartbeatTimer = null
let reconnectTimer = null
let reconnectAttempts = 0
const maxReconnectAttempts = 10

// Reactive dark theme detection
const isDark = ref(document.documentElement.classList.contains('app-dark'))
let themeObserver = null

const DARK_THEME = {
  background: '#09090b',
  foreground: '#ffffff',
  cursor: '#818cf8',
  cursorAccent: '#09090b',
  selectionBackground: '#3f3f46',
  black: '#27272a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
  blue: '#818cf8', magenta: '#cba6f7', cyan: '#94e2d5', white: '#a1a1aa',
  brightBlack: '#3f3f46', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af', brightBlue: '#818cf8', brightMagenta: '#cba6f7',
  brightCyan: '#94e2d5', brightWhite: '#ffffff'
}

const LIGHT_THEME = {
  background: '#ffffff',
  foreground: '#334155',
  cursor: '#10b981',
  cursorAccent: '#ffffff',
  selectionBackground: '#d0d5dd',
  black: '#334155', red: '#e45649', green: '#10b981', yellow: '#c18401',
  blue: '#4078f2', magenta: '#a626a4', cyan: '#0184bc', white: '#64748b',
  brightBlack: '#64748b', brightRed: '#e06c75', brightGreen: '#10b981',
  brightYellow: '#e5c07b', brightBlue: '#61afef', brightMagenta: '#c678dd',
  brightCyan: '#56b6c2', brightWhite: '#ffffff'
}

const termTheme = computed(() => isDark.value ? DARK_THEME : LIGHT_THEME)

// Watch theme changes and apply to terminal
watch(isDark, () => {
  if (terminal.value) {
    terminal.value.options.theme = termTheme.value
  }
})

// WebSocket URL
function getWsUrl(mode = 'auto') {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  // In dev mode Vite v8 proxy breaks WS upgrades — connect directly to the backend port
  const host = import.meta.env.DEV ? `${location.hostname}:8082` : location.host
  let wsUrl = `${protocol}//${host}/wsclaude?workspaceId=${workspaceId.value}&mode=${mode}`
  if (clientId.value) {
    wsUrl += `&clientId=${clientId.value}`
  }
  return wsUrl
}

onMounted(async () => {
  // Full-bleed mode: hide footer, remove padding (same pattern as committee-page)
  document.documentElement.classList.add('terminal-page')

  themeObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('app-dark')
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })

  await initTerminal()
  connectWebSocket('auto')
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  document.documentElement.classList.remove('terminal-page')
  if (themeObserver) themeObserver.disconnect()
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (ws.value) ws.value.close(1000, 'User navigated away')
  try { terminal.value?.dispose() } catch { /* addon not yet loaded */ }
  window.removeEventListener('resize', handleResize)
})

async function initTerminal() {
  await nextTick()

  terminal.value = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
    theme: termTheme.value,
    allowProposedApi: true
  })

  fitAddon.value = new FitAddon()
  terminal.value.loadAddon(fitAddon.value)
  terminal.value.loadAddon(new WebLinksAddon())

  terminal.value.open(terminalRef.value)
  fitAddon.value.fit()

  writeBanner()

  terminal.value.onData((data) => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({ type: 'input', data }))
    }
  })

  terminal.value.onResize(({ cols, rows }) => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
  })
}

function writeBanner() {
  terminal.value.writeln('\x1b[1;36m╔═══════════════════════════════════════════════════╗\x1b[0m')
  terminal.value.writeln('\x1b[1;36m║\x1b[0m  \x1b[1;33mClaude Code CLI\x1b[0m — VentureOS Terminal             \x1b[1;36m║\x1b[0m')
  terminal.value.writeln('\x1b[1;36m╚═══════════════════════════════════════════════════╝\x1b[0m')
  terminal.value.writeln('')
}

function connectWebSocket(mode = 'auto') {
  sessionMode.value = mode
  const wsUrl = getWsUrl(mode)
  ws.value = new WebSocket(wsUrl)

  ws.value.onopen = () => {
    isConnected.value = true
    isConnecting.value = false
    reconnectAttempts = 0

    if (!clientId.value) {
      const modeLabel = mode === 'continue' ? 'Продолжение сессии...'
        : mode === 'new' ? 'Новая сессия...'
        : 'Подключение...'
      terminal.value.writeln(`\x1b[32m✓ ${modeLabel}\x1b[0m`)
    }
    terminal.value.writeln('')
    statusText.value = 'Подключено'

    if (fitAddon.value) {
      const { cols, rows } = terminal.value
      ws.value.send(JSON.stringify({ type: 'resize', cols, rows }))
    }

    startHeartbeat()
  }

  ws.value.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)

      if (message.type === 'session') {
        clientId.value = message.clientId
        localStorage.setItem(`claude_clientId_${workspaceId.value}`, message.clientId)
        if (message.mode) sessionMode.value = message.mode
      } else if (message.type === 'output') {
        terminal.value.write(message.data)
      } else if (message.type === 'error') {
        terminal.value.writeln(`\x1b[31mОшибка: ${message.error}\x1b[0m`)
        if (message.fatal) {
          clientId.value = null
          localStorage.removeItem(`claude_clientId_${workspaceId.value}`)
        }
      } else if (message.type === 'exit') {
        terminal.value.writeln('')
        // SIGHUP (129) = navigated away / tab closed — not a crash
        const exitMsg = message.code === 129
          ? 'Сессия приостановлена'
          : message.code === 0
            ? 'Сессия завершена'
            : `Claude завершился с кодом ${message.code}`
        terminal.value.writeln(`\x1b[33m${exitMsg}\x1b[0m`)
        terminal.value.writeln('\x1b[90mНажмите «Продолжить» чтобы возобновить или «Новая» для новой сессии\x1b[0m')
        isConnected.value = false
        statusText.value = message.code === 129 ? 'Приостановлен' : 'Завершён'
        clientId.value = null
        localStorage.removeItem(`claude_clientId_${workspaceId.value}`)
        stopHeartbeat()
      }
    } catch {
      terminal.value.write(event.data)
    }
  }

  ws.value.onerror = () => {
    isConnecting.value = false
    stopHeartbeat()
  }

  ws.value.onclose = (event) => {
    isConnected.value = false
    stopHeartbeat()

    if (event.code === 1000 || event.code === 1001) {
      statusText.value = 'Отключено'
    } else {
      terminal.value.writeln('')
      terminal.value.writeln('\x1b[33mСоединение потеряно, переподключение...\x1b[0m')
      statusText.value = 'Переподключение...'
      scheduleReconnect()
    }
  }
}

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({ type: 'ping' }))
    }
  }, 25000)
}

function stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (reconnectAttempts >= maxReconnectAttempts) {
    terminal.value.writeln('\x1b[31mМаксимальное число попыток.\x1b[0m')
    statusText.value = 'Ошибка'
    return
  }

  const delay = Math.min(2000 * Math.pow(2, reconnectAttempts), 30000)
  reconnectAttempts++
  terminal.value.writeln(`\x1b[90mПопытка ${reconnectAttempts}/${maxReconnectAttempts} через ${delay / 1000}с...\x1b[0m`)

  reconnectTimer = setTimeout(() => {
    if (!isConnected.value) {
      isConnecting.value = true
      statusText.value = 'Подключение...'
      connectWebSocket(sessionMode.value)
    }
  }, delay)
}

function handleResize() {
  if (fitAddon.value) fitAddon.value.fit()
}

// ── User actions ──────────────────────────────────────────

const showHelp = ref(false)
const isAdmin = computed(() => localStorage.getItem('is_admin') === 'true')

function startSession(mode) {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  stopHeartbeat()
  if (ws.value) ws.value.close(1000, 'User action')

  // Clear old clientId so backend creates a fresh PTY
  clientId.value = null
  localStorage.removeItem(`claude_clientId_${workspaceId.value}`)

  reconnectAttempts = 0
  isConnecting.value = true
  statusText.value = mode === 'continue' ? 'Возобновление...' : 'Запуск...'

  terminal.value.clear()
  writeBanner()
  terminal.value.writeln(`\x1b[90m${mode === 'continue' ? 'Возобновление последней сессии...' : 'Запуск новой сессии...'}\x1b[0m`)

  connectWebSocket(mode)
}
</script>

<template>
  <div class="fst-terminal-page">
    <div class="terminal-toolbar">
      <div class="toolbar-left">
        <i class="pi pi-code"></i>
        <span class="toolbar-title">Claude Code CLI</span>
        <Tag
          :severity="isConnected ? 'success' : isConnecting ? 'warn' : 'danger'"
          :value="statusText"
          rounded
        />
      </div>
      <div class="toolbar-right">
        <Button
          label="Продолжить"
          icon="pi pi-play"
          size="small"
          severity="success"
          outlined
          :disabled="isConnecting"
          @click="startSession('continue')"
          v-tooltip.bottom="'claude --continue (возобновить последнюю сессию)'"
        />
        <Button
          label="Новая"
          icon="pi pi-plus"
          size="small"
          severity="secondary"
          outlined
          :disabled="isConnecting"
          @click="startSession('new')"
          v-tooltip.bottom="'Запустить новую сессию Claude'"
        />
        <Button
          icon="pi pi-question-circle"
          size="small"
          severity="info"
          text
          rounded
          @click="showHelp = true"
          v-tooltip.bottom="'Справка'"
        />
      </div>
    </div>
    <div ref="terminalRef" class="terminal-container"></div>

    <!-- Help Dialog -->
    <Dialog
      v-model:visible="showHelp"
      header="Claude Code CLI — Справка"
      :modal="true"
      :style="{ width: '620px' }"
      :dismissableMask="true"
    >
      <div class="help-content">
        <h4>Управление сессиями</h4>
        <p>Каждая сессия привязана к вашему user ID. При повторном входе терминал автоматически возобновляет последнюю сессию.</p>

        <div class="help-table">
          <div class="help-row">
            <Tag value="Продолжить" severity="success" />
            <span><code>claude --continue</code> — возобновить последнюю сессию в проекте. Весь контекст (файлы, история, задачи) сохраняется.</span>
          </div>
          <div class="help-row">
            <Tag value="Новая" severity="secondary" />
            <span><code>claude</code> — запустить чистую сессию без истории.</span>
          </div>
          <div class="help-row">
            <Tag value="Авто" severity="info" />
            <span>При первом подключении: если есть сохранённая сессия — продолжает, иначе — новая.</span>
          </div>
        </div>

        <h4>Команды внутри Claude</h4>
        <div class="help-table">
          <div class="help-row">
            <code>/resume</code>
            <span>Выбрать и переключиться на другую сессию</span>
          </div>
          <div class="help-row">
            <code>/status</code>
            <span>Текущие задачи, расход токенов, статус</span>
          </div>
          <div class="help-row">
            <code>/compact</code>
            <span>Сжать контекст (если сессия стала длинной)</span>
          </div>
          <div class="help-row">
            <code>/clear</code>
            <span>Очистить историю текущей сессии</span>
          </div>
          <div class="help-row">
            <code>/help</code>
            <span>Все доступные команды Claude</span>
          </div>
        </div>

        <h4>Горячие клавиши</h4>
        <div class="help-table">
          <div class="help-row">
            <kbd>Ctrl+C</kbd>
            <span>Прервать текущую генерацию</span>
          </div>
          <div class="help-row">
            <kbd>Ctrl+D</kbd>
            <span>Завершить сессию Claude</span>
          </div>
          <div class="help-row">
            <kbd>Esc</kbd>
            <span>Отменить текущий ввод</span>
          </div>
          <div class="help-row">
            <kbd>↑ / ↓</kbd>
            <span>История предыдущих сообщений</span>
          </div>
        </div>

        <template v-if="isAdmin">
        <h4>URL-параметры WebSocket</h4>
        <p class="help-note">Терминал подключается к <code>/wsclaude</code> со следующими параметрами:</p>
        <div class="help-table">
          <div class="help-row">
            <code>workspaceId</code>
            <span>ID пользователя — привязка сессии к аккаунту</span>
          </div>
          <div class="help-row">
            <code>mode</code>
            <span><code>auto</code> | <code>new</code> | <code>continue</code> | <code>resume</code></span>
          </div>
          <div class="help-row">
            <code>sessionId</code>
            <span>UUID конкретной сессии (для <code>mode=resume</code>)</span>
          </div>
          <div class="help-row">
            <code>clientId</code>
            <span>ID клиента — для переподключения к живому PTY</span>
          </div>
          <div class="help-row">
            <code>project</code>
            <span>Путь к проекту (<code>/home/hive/fund</code> по умолчанию)</span>
          </div>
        </div>

        <h4>Где хранятся сессии</h4>
        <div class="help-table">
          <div class="help-row">
            <code>~/.claude/projects/</code>
            <span>Все сессии Claude (JSONL-файлы) по проектам</span>
          </div>
          <div class="help-row">
            <code>data/claude-sessions.json</code>
            <span>Маппинг userId → последняя сессия (backend)</span>
          </div>
          <div class="help-row">
            <code>localStorage</code>
            <span><code>claude_clientId_{userId}</code> — для reconnect к живому PTY</span>
          </div>
        </div>
        </template>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.fst-terminal-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-ground);
  overflow: hidden;
}

.terminal-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: var(--surface-card);
  border-bottom: 1px solid var(--p-content-border-color);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toolbar-left > i {
  font-size: 1rem;
  color: var(--p-primary-color);
}

.toolbar-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--p-text-color);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.terminal-container {
  flex: 1;
  padding: 4px;
}

:deep(.xterm) {
  height: 100%;
}

:deep(.xterm-viewport) {
  overflow-y: auto !important;
}

/* Help dialog */
.help-content h4 {
  margin: 1.25rem 0 0.5rem;
  color: var(--p-text-color);
  font-size: 0.95rem;
}

.help-content h4:first-child {
  margin-top: 0;
}

.help-content p {
  margin: 0 0 0.5rem;
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
  line-height: 1.5;
}

.help-note {
  font-size: 0.8rem !important;
}

.help-table {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.help-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  font-size: 0.875rem;
  line-height: 1.4;
}

.help-row code {
  background: var(--surface-ground);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 0.8rem;
  white-space: nowrap;
  color: var(--p-primary-color);
}

.help-row kbd {
  background: var(--surface-ground);
  border: 1px solid var(--p-content-border-color);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: inherit;
  white-space: nowrap;
}

.help-row span {
  color: var(--p-text-color);
}

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .fst-terminal-page {
    height: 100%;
  }

  .toolbar-title {
    display: none;
  }

  .terminal-toolbar {
    padding: 0.375rem 0.5rem;
  }

  .terminal-container {
    padding: 2px;
  }

  .help-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
}
</style>
