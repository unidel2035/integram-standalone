<template>
  <div class="exp-workspace">

    <!-- ══ LEFT PANEL ════════════════════════════════════════ -->
    <div class="exp-sidebar" :class="{ collapsed: sidebarCollapsed }">

      <!-- Collapse toggle -->
      <button class="exp-collapse-btn" @click="sidebarCollapsed = !sidebarCollapsed"
        :title="sidebarCollapsed ? 'Развернуть' : 'Свернуть'">
        <i :class="sidebarCollapsed ? 'pi pi-chevron-right' : 'pi pi-chevron-left'"></i>
      </button>

      <template v-if="!sidebarCollapsed">

        <!-- Expert profile -->
        <div class="exp-profile">
          <div class="exp-profile-avatar" :style="expertProfile ? `border-color:${expertProfile.color}` : ''">
            <span v-if="expertProfile">{{ expertProfile.avatar }}</span>
            <i v-else class="pi pi-user"></i>
          </div>
          <div class="exp-profile-info">
            <div class="exp-profile-name">{{ expertProfile?.name || 'Эксперт' }}</div>
            <div class="exp-profile-title">{{ expertProfile?.title || 'Claude Code AI' }}</div>
          </div>
          <div class="exp-conn-dot" :class="isConnected ? 'online' : 'offline'"
            :title="statusText"></div>
        </div>

        <!-- Session controls -->
        <div class="exp-session-bar">
          <button class="exp-sess-btn exp-sess-btn--primary" :disabled="isConnecting"
            @click="startSession('continue')" title="claude --continue">
            <i class="pi pi-play"></i> Продолжить
          </button>
          <button class="exp-sess-btn" :disabled="isConnecting"
            @click="startSession('new')" title="Новая сессия">
            <i class="pi pi-plus"></i> Новая
          </button>
        </div>

        <!-- Mode presets -->
        <div class="exp-section-label">Режим</div>
        <div class="exp-modes">
          <button v-for="m in MODES" :key="m.id"
            :class="['exp-mode-btn', { active: activeMode === m.id }]"
            @click="setMode(m)" :title="m.desc">
            <i :class="m.icon"></i>
            <span>{{ m.label }}</span>
          </button>
        </div>

        <!-- Quick prompts -->
        <div class="exp-section-label">Быстрые запросы</div>
        <div class="exp-quick-list">
          <button v-for="q in activeModeDef.prompts" :key="q"
            class="exp-quick-btn" @click="sendPrompt(q)" :title="q">
            <i class="pi pi-bolt" style="font-size:10px;opacity:0.6"></i>
            <span>{{ q }}</span>
          </button>
        </div>

        <!-- File upload -->
        <div class="exp-section-label">Файлы</div>
        <div class="exp-files-area">
          <label class="exp-upload-btn">
            <i class="pi pi-upload"></i>
            <span>Загрузить файл</span>
            <input type="file" hidden multiple
              accept=".txt,.md,.pdf,.docx,.json,.py,.js,.ts,.csv,.xlsx,.yaml,.toml"
              @change="onFileUpload" />
          </label>
          <div v-for="(f, i) in uploadedFiles" :key="i" class="exp-file-item">
            <i :class="fileIcon(f.name)" style="color:var(--fst-blue);flex-shrink:0"></i>
            <span class="exp-file-name" :title="f.name">{{ f.name }}</span>
            <button class="exp-file-del" @click="removeFile(i)" title="Удалить">
              <i class="pi pi-times"></i>
            </button>
          </div>
          <button v-if="uploadedFiles.length" class="exp-send-files-btn" @click="sendFilesToClaude">
            <i class="pi pi-arrow-right"></i> Передать Клоду
          </button>
        </div>

        <!-- Connectors -->
        <div class="exp-section-label">Коннекторы</div>
        <div class="exp-connectors">
          <button v-for="c in CONNECTORS" :key="c.id"
            :class="['exp-conn-btn', { active: connectors[c.id] }]"
            @click="toggleConnector(c.id)" :title="c.label">
            <i :class="c.icon" :style="`color:${c.color}`"></i>
            <span>{{ c.label }}</span>
            <span class="exp-conn-status">{{ connectors[c.id] ? '●' : '○' }}</span>
          </button>
        </div>

        <!-- Context notes -->
        <div class="exp-section-label">Контекст для Клода</div>
        <textarea v-model="contextNote" class="exp-context-area"
          placeholder="Дополнительный контекст, инструкции, данные..."
          rows="3"></textarea>
        <button v-if="contextNote.trim()" class="exp-send-files-btn" @click="sendContext">
          <i class="pi pi-arrow-right"></i> Отправить контекст
        </button>

        <!-- ── Digital Twin panel ─────────────────────────────── -->
        <div class="exp-section-label" style="margin-top:14px">
          Цифровой двойник
          <button class="exp-twin-refresh" @click="loadTwinProfile" :disabled="twinLoading"
            title="Обновить профиль">
            <i :class="twinLoading ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'" style="font-size:10px"></i>
          </button>
        </div>

        <!-- Prediction score -->
        <div v-if="twin.prediction" class="exp-twin-prediction">
          <div class="exp-twin-pred-label">Прогноз решения</div>
          <div class="exp-twin-pred-bar">
            <div class="exp-twin-pred-fill"
              :style="{
                width: (twin.prediction.approvalProbability * 100) + '%',
                background: twin.prediction.approvalProbability > 0.6
                  ? 'var(--fst-green)'
                  : twin.prediction.approvalProbability > 0.4
                    ? 'var(--fst-brand)'
                    : 'var(--fst-red)'
              }">
            </div>
          </div>
          <div class="exp-twin-pred-row">
            <span :class="['exp-twin-verdict', twin.prediction.decision?.toLowerCase()]">
              {{ twin.prediction.decision }}
            </span>
            <span class="exp-twin-conf">{{ Math.round(twin.prediction.approvalProbability * 100) }}%</span>
          </div>
          <div v-if="twin.prediction.reasoning" class="exp-twin-reasoning">
            {{ twin.prediction.reasoning }}
          </div>
        </div>

        <!-- Decision stats -->
        <div v-if="twin.stats?.total > 0" class="exp-twin-stats">
          <div class="exp-twin-stat" :title="'Одобрено: ' + twin.stats['ОДОБРИТЬ']">
            <span class="exp-twin-stat-num" style="color:var(--fst-green)">{{ twin.stats['ОДОБРИТЬ'] || 0 }}</span>
            <span class="exp-twin-stat-lbl">✓</span>
          </div>
          <div class="exp-twin-stat" :title="'Отложено: ' + twin.stats['ОТЛОЖИТЬ']">
            <span class="exp-twin-stat-num" style="color:var(--fst-brand)">{{ twin.stats['ОТЛОЖИТЬ'] || 0 }}</span>
            <span class="exp-twin-stat-lbl">⏸</span>
          </div>
          <div class="exp-twin-stat" :title="'Отклонено: ' + twin.stats['ОТКЛОНИТЬ']">
            <span class="exp-twin-stat-num" style="color:var(--fst-red)">{{ twin.stats['ОТКЛОНИТЬ'] || 0 }}</span>
            <span class="exp-twin-stat-lbl">✗</span>
          </div>
          <div class="exp-twin-stat">
            <span class="exp-twin-stat-num" style="color:var(--p-text-muted-color)">{{ twin.stats.total }}</span>
            <span class="exp-twin-stat-lbl">всего</span>
          </div>
        </div>

        <!-- Fired patterns -->
        <div v-if="twin.firedPatterns?.length" class="exp-twin-patterns">
          <div v-for="(p, i) in twin.firedPatterns.slice(0, 3)" :key="i" class="exp-twin-pattern">
            <i class="pi pi-bolt" style="font-size:9px;color:var(--fst-brand);flex-shrink:0"></i>
            <span>{{ p.text || p }}</span>
          </div>
        </div>

        <!-- Recent expert event timeline -->
        <div v-if="twin.recentEvents?.length" class="exp-twin-timeline">
          <div v-for="(evt, i) in twin.recentEvents.slice(0, 5)" :key="i" class="exp-twin-evt">
            <i :class="evt.icon || 'pi pi-circle'" :style="{ color: evt.color || 'var(--p-text-muted-color)', fontSize: '10px', flexShrink: 0 }"></i>
            <span class="exp-twin-evt-label">{{ evt.label || evt.type }}</span>
            <span class="exp-twin-evt-time">{{ formatEventTime(evt.ts) }}</span>
          </div>
        </div>

        <!-- Typical questions -->
        <div v-if="expertProfile?.cognitiveStyle?.typicalQuestions?.length" class="exp-section-label" style="margin-top:10px">
          Типичные вопросы
        </div>
        <div v-if="expertProfile?.cognitiveStyle?.typicalQuestions?.length" class="exp-twin-questions">
          <button v-for="q in expertProfile.cognitiveStyle.typicalQuestions.slice(0, 3)" :key="q"
            class="exp-quick-btn" @click="sendPrompt(q)" :title="q">
            <i class="pi pi-question-circle" style="font-size:9px;opacity:0.6"></i>
            <span>{{ q }}</span>
          </button>
        </div>

      </template>

      <!-- Collapsed: icon-only mode -->
      <template v-else>
        <div class="exp-collapsed-icons">
          <button class="exp-icon-btn" @click="startSession('continue')" title="Продолжить сессию">
            <i class="pi pi-play"></i>
          </button>
          <button class="exp-icon-btn" @click="startSession('new')" title="Новая сессия">
            <i class="pi pi-plus"></i>
          </button>
          <label class="exp-icon-btn" title="Загрузить файл">
            <i class="pi pi-upload"></i>
            <input type="file" hidden multiple @change="onFileUpload" />
          </label>
        </div>
      </template>

    </div>

    <!-- ══ TERMINAL ══════════════════════════════════════════ -->
    <div class="exp-terminal-wrap">

      <!-- Terminal topbar -->
      <div class="exp-term-topbar">
        <div class="exp-term-topbar-left">
          <i class="pi pi-code" style="color:var(--fst-purple)"></i>
          <span class="exp-term-title">Claude Code</span>
          <span :class="['exp-status-tag', isConnected ? 'connected' : isConnecting ? 'connecting' : 'disconnected']">
            {{ statusText }}
          </span>
          <span v-if="sessionBranch" class="exp-branch-tag" :title="'Git branch: ' + sessionBranch">
            <i class="pi pi-code-branch" style="font-size:10px"></i> {{ sessionBranch }}
          </span>
        </div>
        <div class="exp-term-topbar-right">
          <button class="exp-tbtn" @click="startSession('continue')" :disabled="isConnecting"
            title="claude --continue">
            <i class="pi pi-play"></i> Продолжить
          </button>
          <button class="exp-tbtn" @click="startSession('new')" :disabled="isConnecting"
            title="Новая сессия">
            <i class="pi pi-plus"></i> Новая
          </button>
          <button class="exp-tbtn exp-tbtn--debate" @click="showDebate = true"
            title="Challenger Debate — два эксперта дебатируют по сделке (BlackRock model)">
            <i class="pi pi-bolt"></i> Дебаты
          </button>
          <button class="exp-tbtn" @click="showHelp = !showHelp" title="Справка">
            <i class="pi pi-question-circle"></i>
          </button>
        </div>
      </div>

      <!-- xterm.js container -->
      <div ref="terminalRef" class="exp-terminal"></div>

    </div>

    <!-- Debate Dialog -->
    <ExpertDebateDialog v-model="showDebate"
      :initialDealContext="contextNote" />

    <!-- Help Dialog -->
    <Dialog v-model:visible="showHelp" header="Справка" :modal="true"
      style="width:520px;max-width:95vw">
      <div class="exp-help">
        <p><b>Продолжить</b> — <code>claude --continue</code>, возобновляет последнюю сессию</p>
        <p><b>Новая</b> — свежая сессия Claude без истории</p>
        <p><b>Быстрые запросы</b> → отправляются напрямую в терминал</p>
        <p><b>Файлы</b> → читаются и вставляются в Claude как контекст</p>
        <hr />
        <p><kbd>Ctrl+C</kbd> — прервать генерацию</p>
        <p><kbd>Ctrl+D</kbd> — завершить сессию</p>
        <p><kbd>↑ / ↓</kbd> — история команд</p>
      </div>
    </Dialog>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useRoleStore } from '@/stores/roleStore'
import Dialog from 'primevue/dialog'
import ExpertDebateDialog from '@/components/fst-expert/ExpertDebateDialog.vue'

const roleStore = useRoleStore()

// ── Modes ──────────────────────────────────────────────────────
const MODES = [
  {
    id: 'analyze',
    label: 'Анализ сделки',
    icon: 'pi pi-chart-bar',
    desc: 'Анализ стартапа, due diligence',
    prompts: [
      'Проанализируй стартап по критериям ФСТ НТИ',
      'Составь DDQ для портфельной компании',
      'Оцени TRL и MRL проекта',
      'Риски и красные флаги'
    ]
  },
  {
    id: 'strategy',
    label: 'Стратегия',
    icon: 'pi pi-compass',
    desc: 'Стратегическое планирование',
    prompts: [
      'Выработай инвестиционную стратегию',
      'Сравни два проекта для портфеля',
      'Структура SPV для этой сделки',
      'Сценарии выхода из инвестиции'
    ]
  },
  {
    id: 'code',
    label: 'Код / Данные',
    icon: 'pi pi-code',
    desc: 'Написание кода, работа с данными',
    prompts: [
      'Напиши финансовую модель на Python',
      'Скрипт парсинга данных из Integram',
      'DCF-расчёт для проекта',
      'Визуализация портфеля Chart.js'
    ]
  },
  {
    id: 'docs',
    label: 'Документы',
    icon: 'pi pi-file-edit',
    desc: 'Подготовка документов фонда',
    prompts: [
      'Инвестиционный меморандум',
      'Term Sheet для стартапа',
      'Протокол заседания ИК',
      'Презентация для LP'
    ]
  },
]

const CONNECTORS = [
  { id: 'integram', label: 'Integram БД',   icon: 'pi pi-database',   color: 'var(--fst-blue)'   },
  { id: 'memory',   label: 'Память (KAG)',   icon: 'pi pi-circle-fill', color: 'var(--fst-purple)' },
  { id: 'yandex',   label: 'Яндекс Диск',   icon: 'pi pi-cloud',      color: 'var(--fst-brand)'  },
  { id: 'telegram', label: 'Telegram',       icon: 'pi pi-send',       color: 'var(--fst-cyan)'   },
]

// ── State ──────────────────────────────────────────────────────
const sidebarCollapsed = ref(false)
const activeMode       = ref('analyze')
const expertProfile    = ref(null)
const uploadedFiles    = ref([])
const contextNote      = ref('')
const connectors       = ref({ integram: false, memory: false, yandex: false, telegram: false })
const showHelp         = ref(false)
const showDebate       = ref(false)

// Digital Twin state
const twin = ref({
  stats:         null,  // { ОДОБРИТЬ, ОТЛОЖИТЬ, ОТКЛОНИТЬ, total }
  patterns:      [],    // learned patterns
  firedPatterns: [],    // patterns fired for current deal
  recentEvents:  [],    // expert's last events
  prediction:    null,  // { decision, approvalProbability, confidence, reasoning }
})
const twinLoading    = ref(false)
const expertSessionId = ref(null)  // server-side expert session

// Terminal state
const terminalRef    = ref(null)
const terminal       = ref(null)
const fitAddon       = ref(null)
const ws             = ref(null)
const isConnected    = ref(false)
const isConnecting   = ref(true)
const statusText     = ref('Подключение...')
const sessionMode    = ref('auto')
const workspaceId    = computed(() =>
  localStorage.getItem('id') || localStorage.getItem('user') || 'fst-expert'
)
const clientId      = ref(localStorage.getItem(`claude_clientId_${workspaceId.value}`) || null)
const sessionBranch = ref(null)
let heartbeatTimer = null
let reconnectTimer = null
let reconnectAttempts = 0

const isDark = ref(document.documentElement.classList.contains('app-dark'))
let themeObserver = null

const activeModeDef = computed(() => MODES.find(m => m.id === activeMode.value) || MODES[0])

// ── Terminal themes ────────────────────────────────────────────
const DARK_THEME = {
  background: '#0d0d14', foreground: '#e2e8f0', cursor: '#a78bfa',
  cursorAccent: '#0d0d14', selectionBackground: '#3f3f5a',
  black: '#1e1e2e', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
  blue: '#818cf8', magenta: '#cba6f7', cyan: '#94e2d5', white: '#a1a1aa',
  brightBlack: '#45475a', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af', brightBlue: '#818cf8', brightMagenta: '#cba6f7',
  brightCyan: '#94e2d5', brightWhite: '#ffffff'
}
const LIGHT_THEME = {
  background: '#f8f9fc', foreground: '#1e293b', cursor: '#7c3aed',
  cursorAccent: '#ffffff', selectionBackground: '#c7d2fe',
  black: '#334155', red: '#e45649', green: '#16a34a', yellow: '#ca8a04',
  blue: '#4f46e5', magenta: '#7c3aed', cyan: '#0891b2', white: '#64748b',
  brightBlack: '#64748b', brightRed: '#e06c75', brightGreen: '#22c55e',
  brightYellow: '#eab308', brightBlue: '#6366f1', brightMagenta: '#8b5cf6',
  brightCyan: '#06b6d4', brightWhite: '#f1f5f9'
}
const termTheme = computed(() => isDark.value ? DARK_THEME : LIGHT_THEME)
watch(isDark, () => { if (terminal.value) terminal.value.options.theme = termTheme.value })

// ── Lifecycle ──────────────────────────────────────────────────
onMounted(async () => {
  document.documentElement.classList.add('expert-page')

  themeObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('app-dark')
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  // Load expert profile silently
  const expId = roleStore.expertId
  if (expId) {
    try {
      const r = await fetch('/api/expert/profiles')
      const d = await r.json()
      expertProfile.value = d.profiles?.find(p => p.id === expId) || null
      if (expertProfile.value) {
        initExpertSession()  // async — non-blocking
        loadTwinProfile()
      }
    } catch {}
  }

  await initTerminal()
  connectWebSocket('auto')
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  document.documentElement.classList.remove('expert-page')
  if (themeObserver) themeObserver.disconnect()
  stopHeartbeat()
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (ws.value) ws.value.close(1000, 'User navigated away')
  try { terminal.value?.dispose() } catch {}
  window.removeEventListener('resize', handleResize)
})

// ── Terminal init ──────────────────────────────────────────────
async function initTerminal() {
  await nextTick()
  terminal.value = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'JetBrains Mono, Fira Code, Menlo, Consolas, monospace',
    theme: termTheme.value,
    allowProposedApi: true,
    scrollback: 5000,
  })
  fitAddon.value = new FitAddon()
  terminal.value.loadAddon(fitAddon.value)
  terminal.value.loadAddon(new WebLinksAddon())
  terminal.value.open(terminalRef.value)
  fitAddon.value.fit()
  terminal.value.focus()

  terminal.value.onData(data => {
    if (ws.value?.readyState === WebSocket.OPEN)
      ws.value.send(JSON.stringify({ type: 'input', data }))
  })
  terminal.value.onResize(({ cols, rows }) => {
    if (ws.value?.readyState === WebSocket.OPEN)
      ws.value.send(JSON.stringify({ type: 'resize', cols, rows }))
  })
}

// ── WebSocket ──────────────────────────────────────────────────
function getWsUrl(mode = 'auto') {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  // In dev mode Vite v8 proxy breaks WS upgrades — connect directly to the backend port
  const host = import.meta.env.DEV ? `${location.hostname}:8082` : location.host
  let url = `${proto}//${host}/wsclaude?workspaceId=${workspaceId.value}&mode=${mode}`
  if (clientId.value) url += `&clientId=${clientId.value}`
  return url
}

function connectWebSocket(mode = 'auto') {
  sessionMode.value = mode
  ws.value = new WebSocket(getWsUrl(mode))

  ws.value.onopen = () => {
    isConnected.value = true
    isConnecting.value = false
    reconnectAttempts = 0
    statusText.value = 'Подключено'
    if (fitAddon.value) {
      const { cols, rows } = terminal.value
      ws.value.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
    startHeartbeat()
  }

  ws.value.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      if (msg.type === 'session') {
        clientId.value = msg.clientId
        localStorage.setItem(`claude_clientId_${workspaceId.value}`, msg.clientId)
        if (msg.mode) sessionMode.value = msg.mode
        if (msg.branch) {
          sessionBranch.value = msg.branch
          terminal.value?.writeln(`\x1b[2m[branch: ${msg.branch}]\x1b[0m`)
        }
      } else if (msg.type === 'output') {
        terminal.value.write(msg.data)
      } else if (msg.type === 'error') {
        terminal.value.writeln(`\x1b[31mОшибка: ${msg.error}\x1b[0m`)
        if (msg.fatal) {
          clientId.value = null
          localStorage.removeItem(`claude_clientId_${workspaceId.value}`)
        }
      } else if (msg.type === 'exit') {
        const txt = msg.code === 129 ? 'Сессия приостановлена'
          : msg.code === 0 ? 'Сессия завершена'
          : `Claude завершился (код ${msg.code})`
        terminal.value.writeln(`\n\x1b[33m${txt}\x1b[0m`)
        isConnected.value = false
        statusText.value = 'Завершён'
        clientId.value = null
        localStorage.removeItem(`claude_clientId_${workspaceId.value}`)
        stopHeartbeat()
      }
    } catch {
      terminal.value.write(event.data)
    }
  }

  ws.value.onerror = () => { isConnecting.value = false; stopHeartbeat() }

  ws.value.onclose = (event) => {
    isConnected.value = false
    stopHeartbeat()
    if (event.code !== 1000 && event.code !== 1001) {
      statusText.value = 'Переподключение...'
      scheduleReconnect()
    } else {
      statusText.value = 'Отключено'
    }
  }
}

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    if (ws.value?.readyState === WebSocket.OPEN)
      ws.value.send(JSON.stringify({ type: 'ping' }))
  }, 25000)
}
function stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (reconnectAttempts >= 10) { statusText.value = 'Ошибка'; return }
  const delay = Math.min(2000 * Math.pow(2, reconnectAttempts), 30000)
  reconnectAttempts++
  reconnectTimer = setTimeout(() => {
    if (!isConnected.value) connectWebSocket(sessionMode.value)
  }, delay)
}

function handleResize() { fitAddon.value?.fit() }

function startSession(mode) {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  stopHeartbeat()
  ws.value?.close(1000, 'User action')
  clientId.value = null
  localStorage.removeItem(`claude_clientId_${workspaceId.value}`)
  reconnectAttempts = 0
  isConnecting.value = true
  statusText.value = mode === 'continue' ? 'Возобновление...' : 'Запуск...'
  terminal.value?.clear()
  connectWebSocket(mode)
}

// ── Send to terminal ───────────────────────────────────────────
function sendInput(text) {
  if (ws.value?.readyState === WebSocket.OPEN) {
    ws.value.send(JSON.stringify({ type: 'input', data: text }))
    terminal.value?.focus()
  }
}

function sendPrompt(prompt) {
  sendInput(prompt + '\n')
}

function setMode(m) {
  activeMode.value = m.id
  sendInput(`# Режим: ${m.label}\n`)
}

// ── Files ──────────────────────────────────────────────────────
function fileIcon(name) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pi pi-file-pdf'
  if (['doc','docx'].includes(ext)) return 'pi pi-file-word'
  if (['xls','xlsx','csv'].includes(ext)) return 'pi pi-file-excel'
  if (['py','js','ts','json','yaml','toml'].includes(ext)) return 'pi pi-code'
  return 'pi pi-file'
}

async function onFileUpload(e) {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  for (const f of files) {
    const text = await f.text().catch(() => null)
    uploadedFiles.value.push({ name: f.name, size: f.size, text })
  }
}

function removeFile(i) { uploadedFiles.value.splice(i, 1) }

function sendFilesToClaude() {
  if (!uploadedFiles.value.length) return
  const parts = uploadedFiles.value
    .filter(f => f.text)
    .map(f => `=== Файл: ${f.name} ===\n${f.text.slice(0, 8000)}`)
    .join('\n\n')
  if (parts) sendInput(parts + '\n')
  uploadedFiles.value = []
}

function sendContext() {
  if (!contextNote.value.trim()) return
  sendInput(contextNote.value + '\n')
  contextNote.value = ''
}

// ── Connectors ─────────────────────────────────────────────────
function toggleConnector(id) {
  connectors.value[id] = !connectors.value[id]
  if (connectors.value[id]) {
    const hints = {
      integram: 'Используй MCP-инструменты Integram для работы с базой данных фонда',
      memory:   'Сохраняй важные выводы в память платформы (KAG)',
      yandex:   'Можешь работать с файлами Яндекс Диска через /api/yandex',
      telegram: 'Отправляй уведомления в Telegram-бот фонда',
    }
    sendInput(hints[id] + '\n')
  }
}

// ── Digital Twin ───────────────────────────────────────────────
async function initExpertSession() {
  if (!expertProfile.value?.id) return
  try {
    const r = await fetch('/api/expert/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expertId: expertProfile.value.id })
    })
    const d = await r.json()
    if (d.sessionId) {
      expertSessionId.value = d.sessionId
      // Merge cognitiveStyle into expertProfile
      if (d.expert?.cognitiveStyle) {
        expertProfile.value = { ...expertProfile.value, ...d.expert }
      }
      // Load initial expert timeline stats
      if (d.expertTimeline?.length) {
        twin.value.recentEvents = d.expertTimeline.slice(-5).reverse()
      }
    }
  } catch (e) {
    console.warn('[twin] initExpertSession failed:', e.message)
  }
}

async function loadTwinProfile() {
  if (!expertProfile.value?.id) return
  twinLoading.value = true
  try {
    const r = await fetch(`/api/expert/timeline/${expertProfile.value.id}`)
    const d = await r.json()
    twin.value.stats   = d.stats   || null
    twin.value.patterns = d.patterns || []
    twin.value.recentEvents = (d.timeline || []).slice(-5).reverse()
  } catch (e) {
    console.warn('[twin] loadTwinProfile failed:', e.message)
  } finally {
    twinLoading.value = false
  }
}

async function runPrediction(dealId = null) {
  if (!expertSessionId.value) return
  try {
    const r = await fetch('/api/expert/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: expertSessionId.value, dealId })
    })
    const d = await r.json()
    if (d.prediction) {
      twin.value.prediction    = d.prediction
      twin.value.firedPatterns = d.prediction.firedPatterns?.map(t => ({ text: t })) || []
    }
  } catch (e) {
    console.warn('[twin] runPrediction failed:', e.message)
  }
}

function formatEventTime(ts) {
  if (!ts) return ''
  const d = Math.floor((Date.now() - ts) / 86400000)
  if (d === 0) return 'сегодня'
  if (d === 1) return '1 д.'
  if (d < 30) return d + ' д.'
  return Math.floor(d / 30) + ' мес.'
}
</script>

<style scoped>
/* ══ Root ═════════════════════════════════════════════════════ */
.exp-workspace {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: var(--p-surface-ground);
  color: var(--p-text-color);
  font-size: 13px;
}

/* ══ Sidebar ══════════════════════════════════════════════════ */
.exp-sidebar {
  width: 260px;
  flex-shrink: 0;
  background: var(--p-surface-card);
  border-right: 1px solid var(--p-content-border-color);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  transition: width 0.2s;
  position: relative;
  padding: 12px 0 20px;
  gap: 0;
}
.exp-sidebar.collapsed { width: 44px; padding: 12px 0; }

.exp-collapse-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px; height: 24px;
  border: none; border-radius: 6px;
  background: var(--p-surface-ground);
  color: var(--p-text-muted-color);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px;
  z-index: 1;
}
.exp-collapse-btn:hover { color: var(--p-text-color); }

/* Profile */
.exp-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px 12px;
  border-bottom: 1px solid var(--p-content-border-color);
  margin-bottom: 12px;
}
.exp-profile-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  border: 2px solid var(--fst-purple);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
  background: color-mix(in srgb, var(--fst-purple) 10%, var(--p-surface-card));
}
.exp-profile-avatar i { color: var(--fst-purple); font-size: 16px; }
.exp-profile-info { flex: 1; min-width: 0; }
.exp-profile-name  { font-weight: 700; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.exp-profile-title { font-size: 10px; color: var(--p-text-muted-color); line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.exp-conn-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.exp-conn-dot.online  { background: var(--fst-green); }
.exp-conn-dot.offline { background: var(--p-text-muted-color); }

/* Section label */
.exp-section-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--p-text-muted-color);
  padding: 0 16px;
  margin: 12px 0 6px;
}

/* Session bar */
.exp-session-bar {
  display: flex; gap: 6px;
  padding: 0 16px;
}
.exp-sess-btn {
  flex: 1;
  display: flex; align-items: center; justify-content: center; gap: 5px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid var(--p-content-border-color);
  background: var(--p-surface-ground);
  color: var(--p-text-muted-color);
  font-size: 11px; font-weight: 600;
  cursor: pointer; font-family: inherit;
  transition: all 0.12s;
}
.exp-sess-btn:hover { color: var(--p-text-color); background: var(--p-surface-card); }
.exp-sess-btn--primary { color: var(--fst-green); border-color: color-mix(in srgb, var(--fst-green) 30%, transparent); }
.exp-sess-btn--primary:hover { background: color-mix(in srgb, var(--fst-green) 8%, var(--p-surface-card)); }
.exp-sess-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Modes */
.exp-modes {
  display: flex; flex-direction: column; gap: 2px;
  padding: 0 8px;
}
.exp-mode-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px;
  border-radius: 8px; border: none;
  background: transparent;
  color: var(--p-text-muted-color);
  font-size: 12px; font-weight: 600;
  cursor: pointer; font-family: inherit; text-align: left;
  transition: all 0.12s;
}
.exp-mode-btn i { font-size: 12px; flex-shrink: 0; }
.exp-mode-btn:hover { background: var(--p-surface-ground); color: var(--p-text-color); }
.exp-mode-btn.active { background: color-mix(in srgb, var(--fst-purple) 10%, var(--p-surface-card));
  color: var(--fst-purple); }

/* Quick prompts */
.exp-quick-list {
  display: flex; flex-direction: column; gap: 2px;
  padding: 0 8px;
}
.exp-quick-btn {
  display: flex; align-items: flex-start; gap: 6px;
  padding: 6px 10px;
  border-radius: 7px; border: none;
  background: transparent;
  color: var(--p-text-muted-color);
  font-size: 11px; cursor: pointer; font-family: inherit; text-align: left;
  line-height: 1.4;
  transition: all 0.12s;
}
.exp-quick-btn:hover { background: var(--p-surface-ground); color: var(--p-text-color); }
.exp-quick-btn span { flex: 1; }

/* Files */
.exp-files-area {
  padding: 0 8px;
  display: flex; flex-direction: column; gap: 4px;
}
.exp-upload-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px dashed var(--p-content-border-color);
  color: var(--p-text-muted-color);
  font-size: 11px; cursor: pointer;
  transition: all 0.12s;
}
.exp-upload-btn:hover { border-color: var(--fst-blue); color: var(--fst-blue); }
.exp-file-item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px;
  background: color-mix(in srgb, var(--fst-blue) 6%, var(--p-surface-card));
  border-radius: 6px;
  font-size: 11px;
}
.exp-file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.exp-file-del {
  border: none; background: none; cursor: pointer;
  color: var(--p-text-muted-color); font-size: 10px;
  padding: 0 2px;
}
.exp-file-del:hover { color: var(--fst-red); }
.exp-send-files-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--fst-purple) 30%, transparent);
  background: color-mix(in srgb, var(--fst-purple) 8%, var(--p-surface-card));
  color: var(--fst-purple);
  font-size: 11px; font-weight: 600;
  cursor: pointer; font-family: inherit;
}
.exp-send-files-btn:hover { background: color-mix(in srgb, var(--fst-purple) 14%, var(--p-surface-card)); }

/* Connectors */
.exp-connectors {
  display: flex; flex-direction: column; gap: 2px;
  padding: 0 8px;
}
.exp-conn-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  border-radius: 7px; border: none;
  background: transparent;
  font-size: 11px; cursor: pointer; font-family: inherit; text-align: left;
  color: var(--p-text-muted-color);
  transition: all 0.12s;
}
.exp-conn-btn:hover { background: var(--p-surface-ground); }
.exp-conn-btn.active { background: var(--p-surface-ground); color: var(--p-text-color); }
.exp-conn-status { margin-left: auto; font-size: 10px; }
.exp-conn-btn.active .exp-conn-status { color: var(--fst-green); }

/* Context textarea */
.exp-context-area {
  margin: 0 8px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--p-surface-ground);
  color: var(--p-text-color);
  font-size: 11px; font-family: inherit;
  resize: vertical; min-height: 60px;
}
.exp-context-area:focus { outline: none; border-color: var(--fst-purple); }

/* Collapsed icons */
.exp-collapsed-icons {
  display: flex; flex-direction: column; align-items: center;
  gap: 8px; padding: 36px 0 8px;
}
.exp-icon-btn {
  width: 28px; height: 28px;
  border: none; border-radius: 8px;
  background: var(--p-surface-ground);
  color: var(--p-text-muted-color);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
  transition: all 0.12s;
}
.exp-icon-btn:hover { color: var(--fst-purple); background: color-mix(in srgb, var(--fst-purple) 10%, var(--p-surface-card)); }

/* ══ Terminal area ════════════════════════════════════════════ */
.exp-terminal-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.exp-term-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-content-border-color);
  flex-shrink: 0;
  gap: 10px;
}
.exp-term-topbar-left { display: flex; align-items: center; gap: 8px; }
.exp-term-title { font-weight: 700; font-size: 13px; }
.exp-term-topbar-right { display: flex; align-items: center; gap: 4px; }

.exp-status-tag {
  font-size: 11px; font-weight: 600;
  border-radius: 20px; padding: 2px 8px;
  border: 1px solid;
}
.exp-status-tag.connected    { color: var(--fst-green);  border-color: color-mix(in srgb, var(--fst-green) 35%, transparent);  background: color-mix(in srgb, var(--fst-green) 10%, transparent); }
.exp-status-tag.connecting   { color: var(--fst-brand);  border-color: color-mix(in srgb, var(--fst-brand) 35%, transparent);  background: color-mix(in srgb, var(--fst-brand) 10%, transparent); }
.exp-status-tag.disconnected { color: var(--p-text-muted-color); border-color: var(--p-content-border-color); background: transparent; }

.exp-branch-tag {
  font-size: 11px; font-weight: 500;
  border-radius: 20px; padding: 2px 8px;
  border: 1px solid color-mix(in srgb, var(--fst-cyan) 35%, transparent);
  color: var(--fst-cyan);
  background: color-mix(in srgb, var(--fst-cyan) 8%, transparent);
  display: flex; align-items: center; gap: 4px;
}

/* ══ Digital Twin panel ═══════════════════════════════════════ */
.exp-twin-refresh {
  background: none; border: none; cursor: pointer;
  color: var(--p-text-muted-color); padding: 0 0 0 6px;
  opacity: 0.7;
  &:hover { opacity: 1; }
}

.exp-twin-prediction {
  background: color-mix(in srgb, var(--p-surface-card) 80%, transparent);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px; padding: 10px; margin-bottom: 8px;
}
.exp-twin-pred-label { font-size: 10px; color: var(--p-text-muted-color); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
.exp-twin-pred-bar {
  height: 4px; background: color-mix(in srgb, var(--p-text-color) 10%, transparent);
  border-radius: 2px; margin-bottom: 6px; overflow: hidden;
}
.exp-twin-pred-fill { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
.exp-twin-pred-row { display: flex; align-items: center; justify-content: space-between; }
.exp-twin-verdict {
  font-size: 11px; font-weight: 700; border-radius: 4px; padding: 2px 6px;
  &.одобрить { color: var(--fst-green); background: color-mix(in srgb, var(--fst-green) 12%, transparent); }
  &.отложить  { color: var(--fst-brand); background: color-mix(in srgb, var(--fst-brand) 12%, transparent); }
  &.отклонить { color: var(--fst-red);   background: color-mix(in srgb, var(--fst-red) 12%, transparent); }
}
.exp-twin-conf { font-size: 13px; font-weight: 700; color: var(--p-text-color); }
.exp-twin-reasoning { font-size: 10px; color: var(--p-text-muted-color); margin-top: 6px; line-height: 1.4; }

.exp-twin-stats {
  display: flex; gap: 6px; margin-bottom: 8px;
}
.exp-twin-stat {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 6px; padding: 5px 2px;
}
.exp-twin-stat-num { font-size: 14px; font-weight: 700; line-height: 1; }
.exp-twin-stat-lbl { font-size: 9px; color: var(--p-text-muted-color); margin-top: 2px; }

.exp-twin-patterns {
  display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;
}
.exp-twin-pattern {
  display: flex; gap: 5px; align-items: flex-start;
  font-size: 10px; color: var(--p-text-muted-color); line-height: 1.3;
  padding: 4px 6px;
  background: color-mix(in srgb, var(--fst-brand) 6%, transparent);
  border-radius: 4px;
  border-left: 2px solid color-mix(in srgb, var(--fst-brand) 40%, transparent);
}

.exp-twin-timeline { display: flex; flex-direction: column; gap: 3px; margin-bottom: 8px; }
.exp-twin-evt {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; padding: 3px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--p-content-border-color) 50%, transparent);
  &:last-child { border-bottom: none; }
}
.exp-twin-evt-label { flex: 1; color: var(--p-text-muted-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.exp-twin-evt-time  { color: color-mix(in srgb, var(--p-text-muted-color) 60%, transparent); font-size: 9px; flex-shrink: 0; }

.exp-twin-questions { display: flex; flex-direction: column; gap: 3px; }

/* ══ Buttons ═══════════════════════════════════════════════════ */
.exp-tbtn--debate {
  color: var(--fst-brand) !important;
  border-color: color-mix(in srgb, var(--fst-brand) 35%, transparent) !important;
  background: color-mix(in srgb, var(--fst-brand) 8%, transparent) !important;
  &:hover { background: color-mix(in srgb, var(--fst-brand) 16%, transparent) !important; }
}

.exp-tbtn {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 10px;
  border-radius: 7px; border: 1px solid var(--p-content-border-color);
  background: var(--p-surface-ground);
  color: var(--p-text-muted-color);
  font-size: 11px; font-weight: 600;
  cursor: pointer; font-family: inherit;
  transition: all 0.12s;
}
.exp-tbtn:hover { color: var(--p-text-color); background: var(--p-surface-card); }
.exp-tbtn:disabled { opacity: 0.4; cursor: not-allowed; }

.exp-terminal {
  flex: 1;
  overflow: hidden;
  padding: 8px;
}

/* Help */
.exp-help { font-size: 13px; line-height: 1.7; }
.exp-help p { margin: 0 0 8px; }
.exp-help hr { border: none; border-top: 1px solid var(--p-content-border-color); margin: 12px 0; }
.exp-help kbd {
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px; padding: 1px 6px;
  font-size: 12px; font-family: monospace;
}
</style>
