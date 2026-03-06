<template>
  <div class="log-viewer">
    <!-- Toolbar -->
    <div class="log-toolbar">
      <div class="toolbar-left">
        <Button
          icon="pi pi-trash"
          label="Очистить"
          text
          size="small"
          @click="clearLogs"
          :disabled="logs.length === 0"
        />
        <Button
          icon="pi pi-download"
          label="Экспорт"
          text
          size="small"
          @click="exportLogs"
          :disabled="logs.length === 0"
        />
      </div>
      <div class="toolbar-right">
        <InputText
          v-model="searchQuery"
          placeholder="Поиск по логам (Ctrl+F)"
          class="search-input"
        >
          <template #prefix>
            <i class="pi pi-search"></i>
          </template>
        </InputText>
        <Dropdown
          v-model="selectedAgent"
          :options="agentOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Все агенты"
          class="agent-filter"
        />
        <Dropdown
          v-model="selectedLevel"
          :options="levelOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Все уровни"
          class="level-filter"
        />
      </div>
    </div>

    <!-- Log Container -->
    <div ref="logContainer" class="log-container" @scroll="handleScroll">
      <div v-if="filteredLogs.length === 0" class="empty-logs">
        <i class="pi pi-inbox"></i>
        <p>{{ logs.length === 0 ? 'Нет логов' : 'Логи не найдены' }}</p>
      </div>
      <div
        v-for="log in filteredLogs"
        :key="log.id"
        class="log-entry"
        :class="['log-' + log.level, { highlighted: isHighlighted(log) }]"
        @click="selectLog(log)"
      >
        <div class="log-timestamp">
          {{ formatTimestamp(log.timestamp) }}
        </div>
        <div class="log-icon">
          <span>{{ log.icon }}</span>
        </div>
        <div class="log-agent" :class="'agent-' + log.agent.toLowerCase().replace(/\s+/g, '-')">
          [{{ log.agent }}]
        </div>
        <div class="log-message">
          {{ log.message }}
        </div>
        <div class="log-actions">
          <Button
            icon="pi pi-copy"
            text
            rounded
            size="small"
            @click.stop="copyLog(log)"
            title="'Копировать'"
          />
        </div>
      </div>
    </div>

    <!-- Auto-scroll toggle -->
    <div class="log-footer">
      <div class="footer-left">
        <span class="log-count">Всего логов: {{ filteredLogs.length }} / {{ logs.length }}</span>
      </div>
      <div class="footer-right">
        <label class="auto-scroll-toggle">
          <Checkbox v-model="autoScroll" binary />
          <span>Авто-прокрутка</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { logger } from '@/utils/logger'
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  logs: {
    type: Array,
    default: () => []
  },
  highlightAgent: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['log-selected', 'logs-cleared'])

const logContainer = ref(null)
const searchQuery = ref('')
const selectedAgent = ref(null)
const selectedLevel = ref(null)
const autoScroll = ref(true)
const selectedLog = ref(null)

// Agent options
const agentOptions = computed(() => {
  const agents = [...new Set(props.logs.map((log) => log.agent))]
  return [{ label: 'Все агенты', value: null }, ...agents.map((agent) => ({ label: agent, value: agent }))]
})

// Level options
const levelOptions = computed(() => [
  { label: 'Все уровни', value: null },
  { label: 'Info', value: 'info' },
  { label: 'Success', value: 'success' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' },
  { label: 'Debug', value: 'debug' }
])

// Filtered logs
const filteredLogs = computed(() => {
  let filtered = props.logs

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (log) =>
        log.message.toLowerCase().includes(query) ||
        log.agent.toLowerCase().includes(query)
    )
  }

  // Filter by agent
  if (selectedAgent.value) {
    filtered = filtered.filter((log) => log.agent === selectedAgent.value)
  }

  // Filter by level
  if (selectedLevel.value) {
    filtered = filtered.filter((log) => log.level === selectedLevel.value)
  }

  return filtered
})

// Format timestamp
const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  return `${hours}:${minutes}:${seconds}.${ms}`
}

// Check if log is highlighted
const isHighlighted = (log) => {
  return props.highlightAgent && log.agent === props.highlightAgent
}

// Select log
const selectLog = (log) => {
  selectedLog.value = log
  emit('log-selected', log)
}

// Copy log
const copyLog = (log) => {
  const text = `[${formatTimestamp(log.timestamp)}] ${log.icon} [${log.agent}] ${log.message}`
  navigator.clipboard.writeText(text).then(() => {
    // Show toast or notification
    logger.debug('Log copied to clipboard')
  })
}

// Clear logs
const clearLogs = () => {
  emit('logs-cleared')
}

// Export logs
const exportLogs = () => {
  const text = filteredLogs.value
    .map((log) => `[${formatTimestamp(log.timestamp)}] ${log.icon} [${log.agent}] ${log.message}`)
    .join('\n')

  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `logs-${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// Handle scroll
const handleScroll = () => {
  if (!logContainer.value) return

  const { scrollTop, scrollHeight, clientHeight } = logContainer.value
  const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50

  if (!isAtBottom) {
    autoScroll.value = false
  }
}

// Auto-scroll to bottom
const scrollToBottom = () => {
  if (!logContainer.value || !autoScroll.value) return

  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

// Watch for new logs
watch(
  () => props.logs.length,
  () => {
    if (autoScroll.value) {
      scrollToBottom()
    }
  }
)

// Keyboard shortcuts
const handleKeyDown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault()
    const searchInput = document.querySelector('.search-input input')
    if (searchInput) searchInput.focus()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  scrollToBottom()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.log-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.log-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #252526;
  border-bottom: 1px solid #3e3e42;
  gap: 1rem;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.search-input {
  width: 200px;
}

.agent-filter,
.level-filter {
  min-width: 150px;
}

.log-container {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
  background: #1e1e1e;
}

.log-container::-webkit-scrollbar {
  width: 8px;
}

.log-container::-webkit-scrollbar-track {
  background: #1e1e1e;
}

.log-container::-webkit-scrollbar-thumb {
  background: #3e3e42;
  border-radius: 4px;
}

.log-container::-webkit-scrollbar-thumb:hover {
  background: #4e4e52;
}

.empty-logs {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6e6e6e;
}

.empty-logs i {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.log-entry {
  display: grid;
  grid-template-columns: 100px 40px auto 1fr 40px;
  gap: 0.75rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
  line-height: 1.5;
  cursor: pointer;
  transition: background 0.2s;
}

.log-entry:hover {
  background: #2d2d30;
}

.log-entry.highlighted {
  background: #264f78;
}

.log-timestamp {
  color: #858585;
  font-size: 0.8125rem;
}

.log-icon {
  font-size: 1rem;
  text-align: center;
}

.log-agent {
  font-weight: 600;
  white-space: nowrap;
}

.log-agent.agent-orchestrator {
  color: #9cdcfe;
}

.log-agent.agent-tableanalyzer-1,
.log-agent.agent-tableanalyzer-2,
.log-agent.agent-tableanalyzer-3 {
  color: #4ec9b0;
}

.log-agent.agent-validator-1,
.log-agent.agent-validator-2,
.log-agent.agent-validator-3,
.log-agent.agent-validator-4 {
  color: #b5cea8;
}

.log-agent.agent-reportgenerator-1,
.log-agent.agent-reportgenerator-2 {
  color: #dcdcaa;
}

.log-agent.agent-datatransform-1 {
  color: #c586c0;
}

.log-agent.agent-user {
  color: #569cd6;
}

.log-message {
  color: #d4d4d4;
}

.log-entry.log-info .log-message {
  color: #d4d4d4;
}

.log-entry.log-success .log-message {
  color: #4ec9b0;
}

.log-entry.log-warning .log-message {
  color: #dcdcaa;
}

.log-entry.log-error .log-message {
  color: #f48771;
}

.log-entry.log-debug .log-message {
  color: #858585;
}

.log-actions {
  opacity: 0;
  transition: opacity 0.2s;
}

.log-entry:hover .log-actions {
  opacity: 1;
}

.log-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #252526;
  border-top: 1px solid #3e3e42;
  color: #858585;
  font-size: 0.8125rem;
}

.auto-scroll-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

@media (max-width: 768px) {
  .log-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-left,
  .toolbar-right {
    width: 100%;
    justify-content: space-between;
  }

  .search-input,
  .agent-filter,
  .level-filter {
    width: 100%;
  }

  .log-entry {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }

  .log-timestamp {
    font-size: 0.75rem;
  }
}
</style>
