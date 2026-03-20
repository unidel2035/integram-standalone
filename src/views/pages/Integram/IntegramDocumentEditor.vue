<template>
  <div class="integram-document-editor">
    <!-- Toolbar -->
    <div class="editor-toolbar">
      <div class="toolbar-group">
        <Button
          icon="pi pi-bold"
          text
          severity="secondary"
          @click="execCommand('bold')"
          v-tooltip.bottom="'Bold (Ctrl+B)'"
        />
        <Button
          icon="pi pi-italic"
          text
          severity="secondary"
          @click="execCommand('italic')"
          v-tooltip.bottom="'Italic (Ctrl+I)'"
        />
        <Button
          icon="pi pi-underline"
          text
          severity="secondary"
          @click="execCommand('underline')"
          v-tooltip.bottom="'Underline (Ctrl+U)'"
        />
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <Button
          icon="pi pi-list"
          text
          severity="secondary"
          @click="execCommand('insertUnorderedList')"
          v-tooltip.bottom="'Bullet List'"
        />
        <Button
          icon="pi pi-sort-numeric-down"
          text
          severity="secondary"
          @click="execCommand('insertOrderedList')"
          v-tooltip.bottom="'Numbered List'"
        />
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <Dropdown
          v-model="selectedHeadingLevel"
          :options="headingOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Heading"
          @change="applyHeading"
          class="heading-dropdown"
        />
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <Button
          icon="pi pi-table"
          text
          severity="info"
          @click="showTableSelector"
          v-tooltip.bottom="'Insert Table'"
        />
        <Button
          icon="pi pi-chart-bar"
          text
          severity="info"
          @click="showReportSelector"
          v-tooltip.bottom="'Insert Report'"
        />
        <Button
          icon="pi pi-sparkles"
          text
          severity="help"
          @click="insertAiBlock"
          v-tooltip.bottom="'Вставить ИИ Блок'"
        />
      </div>

      <div class="toolbar-spacer"></div>

      <!-- WebSocket Status Indicator (Issue #6459) -->
      <div v-if="wsConnected || wsConnecting" class="toolbar-group websocket-status">
        <span v-if="wsConnecting" class="status-indicator connecting">
          <i class="pi pi-spin pi-spinner"></i>
          <span class="status-text">Connecting...</span>
        </span>
        <span v-else-if="wsConnected" class="status-indicator connected">
          <i class="pi pi-check-circle"></i>
          <span class="status-text">
            {{ wsMembersCount > 1 ? `${wsMembersCount} users editing` : 'Connected' }}
          </span>
        </span>
      </div>

      <div class="toolbar-group actions-group">
        <Button
          icon="pi pi-save"
          label="Save"
          severity="success"
          @click="openSaveDialog"
          v-tooltip.bottom="'Save Document'"
        />
        <Button
          icon="pi pi-download"
          text
          severity="secondary"
          @click="exportDocument"
          v-tooltip.bottom="'Export as HTML'"
        />
      </div>
    </div>

    <!-- Editor Content Area -->
    <div
      ref="editorContent"
      class="editor-content"
      contenteditable="true"
      @input="onContentChange"
      @paste="onPaste"
    >
      <p>Start writing your document here...</p>
    </div>

    <!-- Table Selector Dialog -->
    <Dialog
      v-model:visible="showTableDialog"
      header="Выберите таблицу Integram"
      :modal="true"
      :style="{ width: '800px' }"
    >
      <div class="table-selector">
        <div class="search-box">
          <span class="p-input-icon-left w-full">
            <i class="pi pi-search" />
            <InputText
              v-model="tableSearchQuery"
              placeholder="Поиск по названию или ID таблицы..."
              class="w-full"
              autofocus
            />
          </span>
        </div>

        <DataTable
          :value="filteredTables"
          :loading="loadingTables"
          selectionMode="single"
          @row-select="onTableSelected"
          :paginator="true"
          :rows="10"
          class="mt-3"
          :emptyMessage="tableSearchQuery ? 'Таблицы не найдены' : 'Нет доступных таблиц'"
        >
          <Column field="id" header="ID" :sortable="true" style="width: 100px" />
          <Column field="val" header="Название" :sortable="true" />
          <Column header="Действия" style="width: 150px">
            <template #body="slotProps">
              <Button
                label="Вставить"
                size="small"
                @click="insertTable(slotProps.data)"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </Dialog>

    <!-- Report Selector Dialog (Issue #6562: Added search functionality) -->
    <Dialog
      v-model:visible="showReportDialog"
      header="Выберите отчёт Integram"
      :modal="true"
      :style="{ width: '800px' }"
    >
      <div class="report-selector">
        <div class="search-box">
          <span class="p-input-icon-left w-full">
            <i class="pi pi-search" />
            <InputText
              v-model="reportSearchQuery"
              placeholder="Поиск по названию или ID отчёта..."
              class="w-full"
              autofocus
            />
          </span>
        </div>

        <DataTable
          :value="filteredReports"
          :loading="loadingReports"
          selectionMode="single"
          @row-select="onReportSelected"
          :paginator="true"
          :rows="10"
          class="mt-3"
          :emptyMessage="reportSearchQuery ? 'Отчёты не найдены' : 'Нет доступных отчётов'"
        >
          <Column field="id" header="ID" :sortable="true" style="width: 100px" />
          <Column field="value" header="Название" :sortable="true" />
          <Column header="Действия" style="width: 150px">
            <template #body="slotProps">
              <Button
                label="Вставить"
                size="small"
                @click="insertReport(slotProps.data)"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </Dialog>

    <!-- Save Dialog -->
    <Dialog
      v-model:visible="showSaveDialog"
      header="Сохранить документ"
      :modal="true"
      :style="{ width: '500px' }"
    >
      <div class="save-dialog-content">
        <label for="doc-title" class="block mb-2 font-semibold">Название документа:</label>
        <InputText
          id="doc-title"
          v-model="saveDialogTitle"
          placeholder="Введите название документа"
          class="w-full"
          @keyup.enter="confirmSave"
          autofocus
        />
      </div>
      <template #footer>
        <Button
          label="Отмена"
          severity="secondary"
          @click="showSaveDialog = false"
        />
        <Button
          label="Сохранить"
          severity="success"
          @click="confirmSave"
          :disabled="!saveDialogTitle.trim()"
        />
      </template>
    </Dialog>

    <!-- Loading Overlay -->
    <div v-if="loading" class="loading-overlay">
      <ProgressSpinner />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import integramApiClient from '@/services/integramApiClient'
import integramService from '@/services/integramApiClient'
import { useIntegramDocEditorWebSocket } from '@/composables/useIntegramDocEditorWebSocket'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Dropdown from 'primevue/dropdown'
import ProgressSpinner from 'primevue/progressspinner'

// Simple debounce utility
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

const route = useRoute()
const toast = useToast()

const editorContent = ref(null)
const loading = ref(false)
const documentContent = ref('')

// Document properties
const documentTitle = ref('')
const documentId = ref(null)
const documentTypeId = ref(null)
const requisiteIds = ref(null)
const tableMetadataLoaded = ref(false)
const embeddedTables = ref([])
const embeddedReports = ref([])

// Save dialog
const showSaveDialog = ref(false)
const saveDialogTitle = ref('')

// Table selector
const showTableDialog = ref(false)
const loadingTables = ref(false)
const tables = ref([])
const tableSearchQuery = ref('')

// Report selector
const showReportDialog = ref(false)
const loadingReports = ref(false)
const reports = ref([])
const reportSearchQuery = ref('')

// Heading options
const selectedHeadingLevel = ref('p')
const headingOptions = [
  { label: 'Normal', value: 'p' },
  { label: 'Heading 1', value: 'h1' },
  { label: 'Heading 2', value: 'h2' },
  { label: 'Heading 3', value: 'h3' },
  { label: 'Heading 4', value: 'h4' },
]

// WebSocket collaborative editing (Issue #6459)
const currentUserId = ref('user-' + Math.random().toString(36).substr(2, 9))
const currentUserName = ref('User ' + currentUserId.value.slice(-4))
const isUpdatingFromWebSocket = ref(false) // Flag to prevent echo

// Initialize WebSocket composable
const {
  connected: wsConnected,
  connecting: wsConnecting,
  members: wsMembers,
  membersCount: wsMembersCount,
  sendUpdate: wsSendUpdate,
  connect: wsConnect,
  disconnect: wsDisconnect
} = useIntegramDocEditorWebSocket(
  documentId,
  currentUserId,
  {
    userName: currentUserName.value,
    onUpdate: (content, metadata) => {
      console.log('[Integram Doc Editor] Received WebSocket update')
      isUpdatingFromWebSocket.value = true
      if (editorContent.value) {
        editorContent.value.innerHTML = content
      }
      documentContent.value = content
      if (metadata) {
        embeddedTables.value = metadata.embeddedTables || []
        embeddedReports.value = metadata.embeddedReports || []
      }
      // Reset flag after a short delay to allow Vue to process
      setTimeout(() => {
        isUpdatingFromWebSocket.value = false
      }, 100)
    },
    onMembersUpdate: (members) => {
      console.log('[Integram Doc Editor] Members updated:', members)
      // Show notification when members change
      if (members.length > 1) {
        const otherMembers = members.filter(m => m.userId !== currentUserId.value)
        if (otherMembers.length > 0) {
          toast.add({
            severity: 'info',
            summary: 'Collaborative Editing',
            detail: `${otherMembers.length} other user(s) are editing this document`,
            life: 3000
          })
        }
      }
    },
    onError: (error) => {
      console.error('[Integram Doc Editor] WebSocket error:', error)
    },
    onConnected: () => {
      console.log('[Integram Doc Editor] WebSocket connected')
      toast.add({
        severity: 'success',
        summary: 'Connected',
        detail: 'Real-time collaborative editing enabled',
        life: 2000
      })
    },
    onDisconnected: () => {
      console.log('[Integram Doc Editor] WebSocket disconnected')
    },
    autoConnect: false // We'll connect manually after loading document
  }
)

// ==================== AI Block Feature (Issue #6507) ====================
const aiBlocks = reactive({})
let aiBlockIdCounter = 0

function insertAiBlock() {
  const blockId = `ai-block-${Date.now()}-${++aiBlockIdCounter}`

  // Initialize block state
  aiBlocks[blockId] = {
    prompt: '',
    response: '',
    loading: false,
    error: null
  }

  const blockHtml = `<div class="ai-block-embed" data-integram-component="ai-block" data-ai-block-id="${blockId}" contenteditable="false">
    <div class="ai-block-header">
      <span class="ai-block-label"><i class="pi pi-sparkles"></i> ИИ Блок</span>
      <button class="ai-block-btn ai-block-remove-btn" data-ai-action="remove" data-ai-block-id="${blockId}" title="Удалить блок">&times;</button>
    </div>
    <div class="ai-block-prompt-area">
      <textarea class="ai-block-input" data-ai-input="${blockId}" placeholder="Напишите запрос для ИИ..." rows="2"></textarea>
      <button class="ai-block-btn ai-block-send-btn" data-ai-action="send" data-ai-block-id="${blockId}">
        <i class="pi pi-send"></i> Отправить
      </button>
    </div>
    <div class="ai-block-response" data-ai-response="${blockId}" style="display:none;"></div>
    <div class="ai-block-actions" data-ai-actions="${blockId}" style="display:none;">
      <button class="ai-block-btn ai-block-apply-btn" data-ai-action="apply" data-ai-block-id="${blockId}">
        <i class="pi pi-check"></i> Вставить в документ
      </button>
      <button class="ai-block-btn ai-block-retry-btn" data-ai-action="retry" data-ai-block-id="${blockId}">
        <i class="pi pi-refresh"></i> Повторить
      </button>
    </div>
    <div class="ai-block-loading" data-ai-loading="${blockId}" style="display:none;">
      <span class="ai-block-spinner"></span> Генерация...
    </div>
    <div class="ai-block-error" data-ai-error="${blockId}" style="display:none;"></div>
  </div><p><br></p>`

  // Insert at cursor position or append
  const selection = window.getSelection()
  if (selection.rangeCount > 0 && editorContent.value?.contains(selection.anchorNode)) {
    const range = selection.getRangeAt(0)
    range.deleteContents()
    const div = document.createElement('div')
    div.innerHTML = blockHtml
    const frag = document.createDocumentFragment()
    while (div.firstChild) {
      frag.appendChild(div.firstChild)
    }
    range.insertNode(frag)
  } else {
    editorContent.value.innerHTML += blockHtml
  }

  onContentChange()

  // Focus the textarea after insertion
  nextTick(() => {
    const textarea = editorContent.value?.querySelector(`[data-ai-input="${blockId}"]`)
    if (textarea) textarea.focus()
  })
}

function getDocumentContextForAiBlock() {
  // Get the plain text content of the editor, excluding AI block elements
  const clone = editorContent.value?.cloneNode(true)
  if (!clone) return ''
  // Remove AI block elements from clone to get clean context
  const aiBlockEls = clone.querySelectorAll('.ai-block-embed')
  aiBlockEls.forEach(el => el.remove())
  const text = clone.textContent || clone.innerText || ''
  return text.substring(0, 8000)
}

async function sendAiBlockPrompt(blockId) {
  const state = aiBlocks[blockId]
  if (!state) return

  const inputEl = editorContent.value?.querySelector(`[data-ai-input="${blockId}"]`)
  const prompt = inputEl?.value?.trim()
  if (!prompt) return

  state.prompt = prompt
  state.loading = true
  state.error = null
  state.response = ''

  // Update UI elements
  const loadingEl = editorContent.value?.querySelector(`[data-ai-loading="${blockId}"]`)
  const responseEl = editorContent.value?.querySelector(`[data-ai-response="${blockId}"]`)
  const actionsEl = editorContent.value?.querySelector(`[data-ai-actions="${blockId}"]`)
  const errorEl = editorContent.value?.querySelector(`[data-ai-error="${blockId}"]`)
  const sendBtn = editorContent.value?.querySelector(`[data-ai-action="send"][data-ai-block-id="${blockId}"]`)

  if (loadingEl) loadingEl.style.display = 'flex'
  if (responseEl) responseEl.style.display = 'none'
  if (actionsEl) actionsEl.style.display = 'none'
  if (errorEl) errorEl.style.display = 'none'
  if (sendBtn) sendBtn.disabled = true

  try {
    const docContext = getDocumentContextForAiBlock()
    const docTitle = documentTitle.value || 'Без названия'

    let systemPrompt = 'Ты — ИИ-помощник для редактора документов DronDoc.'
    systemPrompt += '\nПользователь работает в редакторе документов и вставил ИИ Блок.'
    systemPrompt += '\nТвоя задача — сгенерировать текст по запросу пользователя.'
    systemPrompt += '\nОтвечай ТОЛЬКО текстом, который можно вставить в документ. Без приветствий, пояснений или лишних комментариев.'
    systemPrompt += '\nФорматируй ответ в HTML (заголовки, списки, абзацы), чтобы он хорошо смотрелся в редакторе.'
    if (docTitle) {
      systemPrompt += `\n\nНазвание документа: "${docTitle}"`
    }
    if (docContext) {
      systemPrompt += `\n\nКонтекст документа (до 8000 символов):\n${docContext}`
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        userId: currentUserId.value,
        model: localStorage.getItem('selectedModel') || 'deepseek-chat',
        provider: localStorage.getItem('selectedProvider') || 'deepseek',
        conversationHistory: [],
        systemPrompt,
        enableTools: false,
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type')
    let aiText = ''

    if (contentType && contentType.includes('text/event-stream')) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content') aiText += parsed.content
              else if (parsed.type === 'content_block_delta' && parsed.delta?.text) aiText += parsed.delta.text
              else if (parsed.chunk) aiText += parsed.chunk
            } catch (_e) { /* skip parse errors */ }
          }
        }
        // Update response in real-time
        if (responseEl) {
          responseEl.innerHTML = aiText
          responseEl.style.display = 'block'
        }
      }
    } else if (contentType && contentType.includes('application/json')) {
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Ошибка API')
      aiText = data.response
    }

    state.response = aiText
    if (responseEl) {
      responseEl.innerHTML = aiText
      responseEl.style.display = 'block'
    }
    if (actionsEl) actionsEl.style.display = 'flex'

  } catch (error) {
    console.error(`[AI Block ${blockId}] Error:`, error)
    state.error = error.message
    if (errorEl) {
      errorEl.textContent = 'Ошибка: ' + error.message
      errorEl.style.display = 'block'
    }
  } finally {
    state.loading = false
    if (loadingEl) loadingEl.style.display = 'none'
    if (sendBtn) sendBtn.disabled = false
  }
}

function applyAiBlock(blockId) {
  const state = aiBlocks[blockId]
  if (!state || !state.response) return

  const blockEl = editorContent.value?.querySelector(`[data-ai-block-id="${blockId}"].ai-block-embed`)
  if (!blockEl) return

  // Replace the AI block with its response content
  const div = document.createElement('div')
  div.innerHTML = state.response
  blockEl.replaceWith(div)

  // Cleanup state
  delete aiBlocks[blockId]
  onContentChange()

  toast.add({
    severity: 'success',
    summary: 'Готово',
    detail: 'ИИ-контент вставлен в документ',
    life: 2000
  })
}

function removeAiBlock(blockId) {
  const blockEl = editorContent.value?.querySelector(`[data-ai-block-id="${blockId}"].ai-block-embed`)
  if (blockEl) {
    blockEl.remove()
    delete aiBlocks[blockId]
    onContentChange()
  }
}

// Handle clicks inside AI blocks (delegation pattern for contenteditable)
function handleEditorClick(event) {
  const target = event.target.closest('[data-ai-action]')
  if (!target) return

  const action = target.getAttribute('data-ai-action')
  const blockId = target.getAttribute('data-ai-block-id')
  if (!blockId) return

  event.preventDefault()
  event.stopPropagation()

  switch (action) {
    case 'send':
      sendAiBlockPrompt(blockId)
      break
    case 'apply':
      applyAiBlock(blockId)
      break
    case 'remove':
      removeAiBlock(blockId)
      break
    case 'retry':
      sendAiBlockPrompt(blockId)
      break
  }
}

// Handle keyboard events inside AI block textareas
function handleEditorKeydown(event) {
  const target = event.target
  if (!target.classList?.contains('ai-block-input')) return

  // Allow typing inside AI block textarea (prevent contenteditable interference)
  event.stopPropagation()

  // Ctrl+Enter or Enter to send
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    const blockId = target.getAttribute('data-ai-input')
    if (blockId) sendAiBlockPrompt(blockId)
  }
}
// ===========================================================================

// Computed
const filteredTables = computed(() => {
  if (!tableSearchQuery.value) return tables.value
  const query = tableSearchQuery.value.toLowerCase()
  return tables.value.filter(table =>
    table.val?.toLowerCase().includes(query) ||
    table.id?.toString().includes(query)
  )
})

const filteredReports = computed(() => {
  if (!reportSearchQuery.value) return reports.value
  const query = reportSearchQuery.value.toLowerCase()
  return reports.value.filter(report =>
    report.value?.toLowerCase().includes(query) ||
    report.id?.toString().includes(query)
  )
})

// Editor Commands
function execCommand(command, value = null) {
  document.execCommand(command, false, value)
  editorContent.value?.focus()
}

function applyHeading() {
  const level = selectedHeadingLevel.value
  if (level === 'p') {
    execCommand('formatBlock', '<p>')
  } else {
    execCommand('formatBlock', `<${level}>`)
  }
}

// Debounced WebSocket update sender (Issue #6459)
const sendWebSocketUpdate = debounce(() => {
  if (!isUpdatingFromWebSocket.value && wsConnected.value) {
    const content = editorContent.value?.innerHTML || ''
    const metadata = {
      embeddedTables: embeddedTables.value,
      embeddedReports: embeddedReports.value,
      title: documentTitle.value
    }
    console.log('[Integram Doc Editor] Sending WebSocket update')
    wsSendUpdate(content, metadata)
  }
}, 500) // Debounce for 500ms to avoid spamming

// Debounced broadcast of document context to Chat.vue (Issue #6507)
const broadcastEditorContext = debounce(() => {
  const ctx = {
    title: documentTitle.value || 'Без названия',
    content: (documentContent.value || '').substring(0, 8000),
    fullLength: (documentContent.value || '').length,
    documentId: documentId.value,
    database: route.params.database || 'my'
  }
  window.__editorDocumentContext = ctx
  window.dispatchEvent(new CustomEvent('editor-context-update', { detail: ctx }))
}, 500)

function onContentChange() {
  documentContent.value = editorContent.value?.innerHTML || ''

  // Send WebSocket update if connected and not updating from WebSocket
  if (!isUpdatingFromWebSocket.value) {
    sendWebSocketUpdate()
  }

  // Broadcast context to Chat.vue (Issue #6507)
  broadcastEditorContext()
}

// Handle insert-ai-content events from Chat.vue sidebar (Issue #6507)
function handleInsertAIContent(event) {
  const content = event.detail?.content
  if (!content || !editorContent.value) return

  // Insert content at cursor position or append
  const selection = window.getSelection()
  if (selection.rangeCount > 0 && editorContent.value.contains(selection.anchorNode)) {
    const range = selection.getRangeAt(0)
    range.deleteContents()
    const div = document.createElement('div')
    div.innerHTML = content
    const frag = document.createDocumentFragment()
    while (div.firstChild) frag.appendChild(div.firstChild)
    range.insertNode(frag)
  } else {
    editorContent.value.innerHTML += content
  }
  onContentChange()
}

function onPaste(event) {
  event.preventDefault()
  const text = event.clipboardData.getData('text/plain')
  document.execCommand('insertText', false, text)
}

// Table Selector
async function showTableSelector() {
  showTableDialog.value = true
  if (tables.value.length === 0) {
    await loadTables()
  }
}

async function loadTables() {
  loadingTables.value = true
  try {
    const dictionary = await integramApiClient.getDictionary()
    tables.value = dictionary.filter(item => item.id && item.val)
  } catch (error) {
    console.error('Failed to load tables:', error)
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load Integram tables',
      life: 3000
    })
  } finally {
    loadingTables.value = false
  }
}

function onTableSelected(event) {
  insertTable(event.data)
}

async function insertTable(table) {
  loading.value = true
  try {
    // Load table data
    const database = route.params.database || 'my'
    const response = await integramApiClient.getObjectList(table.id, {
      LIMIT: 100
    })

    // Create HTML table
    const tableHtml = createTableHtml(table, response)

    // Insert into editor
    const selection = window.getSelection()
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.deleteContents()

      const div = document.createElement('div')
      div.innerHTML = tableHtml
      range.insertNode(div.firstChild)

      // Move cursor after inserted content
      range.setStartAfter(div.firstChild)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    } else {
      editorContent.value.innerHTML += tableHtml
    }

    // Track embedded table
    embeddedTables.value.push({
      id: table.id,
      name: table.val,
      database: route.params.database || 'my',
      insertedAt: new Date().toISOString()
    })

    onContentChange()
    showTableDialog.value = false

    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: `Table "${table.val}" inserted successfully`,
      life: 3000
    })
  } catch (error) {
    console.error('Failed to insert table:', error)
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to insert table: ' + error.message,
      life: 3000
    })
  } finally {
    loading.value = false
  }
}

function createTableHtml(table, response) {
  const objects = response.object || []
  const reqs = response.reqs || {}

  if (objects.length === 0) {
    return `<p><strong>Table: ${table.val}</strong> (No data)</p>`
  }

  // Get columns from first object's requisites
  const firstObj = objects[0]
  const firstReqs = reqs[firstObj.id] || {}
  const columns = Object.keys(firstReqs)

  // Store metadata in data attributes for reconstruction
  const database = route.params.database || 'my'
  const metadata = {
    tableId: table.id,
    tableName: table.val,
    database: database,
    insertedAt: new Date().toISOString()
  }

  let html = `
    <div class="integram-table-embed"
         data-integram-component="table"
         data-table-id="${table.id}"
         data-table-name="${escapeHtml(table.val)}"
         data-database="${database}"
         data-inserted-at="${metadata.insertedAt}"
         contenteditable="false">
      <h3>${table.val}</h3>
      <table border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0;">
        <thead>
          <tr style="background-color: var(--p-surface-100, #f0f0f0);">
            <th style="padding: 8px; border: 1px solid var(--surface-border, #ddd);">ID</th>
            <th style="padding: 8px; border: 1px solid var(--surface-border, #ddd);">Name</th>
  `

  // Add column headers
  columns.forEach(colId => {
    html += `<th style="padding: 8px; border: 1px solid var(--surface-border, #ddd);">Field ${colId}</th>`
  })

  html += `
          </tr>
        </thead>
        <tbody>
  `

  // Add rows
  objects.slice(0, 20).forEach(obj => {
    const objReqs = reqs[obj.id] || {}
    html += `
          <tr>
            <td style="padding: 8px; border: 1px solid var(--surface-border, #ddd);">${obj.id}</td>
            <td style="padding: 8px; border: 1px solid var(--surface-border, #ddd);">${escapeHtml(obj.val || '')}</td>
    `

    columns.forEach(colId => {
      const value = objReqs[colId] || ''
      html += `<td style="padding: 8px; border: 1px solid var(--surface-border, #ddd);">${escapeHtml(String(value))}</td>`
    })

    html += `</tr>`
  })

  html += `
        </tbody>
      </table>
      ${objects.length > 20 ? `<p><em>Showing 20 of ${objects.length} rows</em></p>` : ''}
    </div>
  `

  return html
}

// Helper function to escape HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return String(text).replace(/[&<>"']/g, m => map[m])
}

// Report Selector
async function showReportSelector() {
  showReportDialog.value = true
  if (reports.value.length === 0) {
    await loadReports()
  }
}

async function loadReports() {
  loadingReports.value = true
  try {
    // Issue #6562: Load Integram reports using integramService.getReportList()
    // This uses the same method as SmartQReportList.vue for consistency
    // The getReportList() method fetches type 22 (Query) objects with proper session handling
    const response = await integramService.getReportList()

    // Extract report objects from response
    // Response format: { object: [{ id, val, ... }, ...] }
    const reportObjects = response.object || []
    reports.value = reportObjects.map(item => ({
      id: item.id,
      value: item.val || `Report #${item.id}`
    }))

    console.log(`[IntegramDocumentEditor] Loaded ${reports.value.length} reports from integramService`)
  } catch (error) {
    console.error('Failed to load reports:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось загрузить список отчётов: ' + error.message,
      life: 3000
    })
  } finally {
    loadingReports.value = false
  }
}

function onReportSelected(event) {
  insertReport(event.data)
}

async function insertReport(report) {
  loading.value = true
  try {
    // Execute report using integramService for consistent session handling
    const response = await integramService.executeReport(report.id, {})

    // Create HTML table from report data
    const reportHtml = createReportHtml(report, response)

    // Insert into editor
    const selection = window.getSelection()
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.deleteContents()

      const div = document.createElement('div')
      div.innerHTML = reportHtml
      range.insertNode(div.firstChild)

      // Move cursor after inserted content
      range.setStartAfter(div.firstChild)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    } else {
      editorContent.value.innerHTML += reportHtml
    }

    // Track embedded report
    embeddedReports.value.push({
      id: report.id,
      name: report.value,
      database: route.params.database || 'my',
      insertedAt: new Date().toISOString()
    })

    onContentChange()
    showReportDialog.value = false

    toast.add({
      severity: 'success',
      summary: 'Успешно',
      detail: `Отчёт "${report.value}" добавлен`,
      life: 3000
    })
  } catch (error) {
    console.error('Failed to insert report:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось добавить отчёт: ' + error.message,
      life: 3000
    })
  } finally {
    loading.value = false
  }
}

function createReportHtml(report, response) {
  // Issue #6562: Handle both formats:
  // - Legacy format: { head: [...], data: [[...], [...]], totals: [...] }
  // - Modern format: { rows: [...], headers: [...] }

  // Extract columns/headers
  let columns = []
  if (response.head && Array.isArray(response.head)) {
    columns = response.head
  } else if (response.headers && Array.isArray(response.headers)) {
    columns = response.headers.map(h => h.name || h.header || h.id || h)
  } else if (response.columns && Array.isArray(response.columns)) {
    columns = response.columns.map(c => c.header || c.name || c)
  }

  // Extract rows/data
  let rows = []
  if (response.data && Array.isArray(response.data)) {
    rows = response.data
  } else if (response.rows && Array.isArray(response.rows)) {
    rows = response.rows
  }

  if (rows.length === 0 && columns.length === 0) {
    return `<p><strong>Отчёт: ${escapeHtml(report.value)}</strong> (Нет данных)</p>`
  }

  // Store metadata in data attributes for reconstruction
  const database = route.params.database || 'my'
  const insertedAt = new Date().toISOString()

  let html = `
    <div class="integram-report-embed"
         data-integram-component="report"
         data-report-id="${report.id}"
         data-report-name="${escapeHtml(report.value)}"
         data-database="${database}"
         data-inserted-at="${insertedAt}"
         contenteditable="false">
      <h3>${escapeHtml(report.value)}</h3>
      <table border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0;">
        <thead>
          <tr style="background-color: var(--p-surface-100, #f0f0f0);">
  `

  // Add column headers
  columns.forEach(col => {
    const headerText = typeof col === 'string' ? col : (col.name || col.header || col.id || '')
    html += `<th style="padding: 8px; border: 1px solid var(--surface-border, #ddd);">${escapeHtml(String(headerText))}</th>`
  })

  html += `
          </tr>
        </thead>
        <tbody>
  `

  // Add rows (limit to 20 for display)
  const displayRows = rows.slice(0, 20)
  displayRows.forEach(row => {
    html += `<tr>`

    if (Array.isArray(row)) {
      // Legacy format: row is an array of values
      row.forEach(value => {
        html += `<td style="padding: 8px; border: 1px solid var(--surface-border, #ddd);">${escapeHtml(String(value ?? ''))}</td>`
      })
    } else if (typeof row === 'object') {
      // Modern format: row is an object with field keys
      Object.values(row).forEach(value => {
        html += `<td style="padding: 8px; border: 1px solid var(--surface-border, #ddd);">${escapeHtml(String(value ?? ''))}</td>`
      })
    }

    html += `</tr>`
  })

  html += `
        </tbody>
      </table>
      ${rows.length > 20 ? `<p><em>Показано 20 из ${rows.length} строк</em></p>` : ''}
    </div>
  `

  return html
}

// Parse embedded components from HTML
function parseEmbeddedComponents(htmlContent) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlContent, 'text/html')

  // Find all Integram table components
  const tables = []
  const tableElements = doc.querySelectorAll('[data-integram-component="table"]')
  tableElements.forEach(el => {
    tables.push({
      id: parseInt(el.getAttribute('data-table-id')),
      name: el.getAttribute('data-table-name'),
      database: el.getAttribute('data-database') || 'my',
      insertedAt: el.getAttribute('data-inserted-at')
    })
  })

  // Find all Integram report components
  const reports = []
  const reportElements = doc.querySelectorAll('[data-integram-component="report"]')
  reportElements.forEach(el => {
    reports.push({
      id: parseInt(el.getAttribute('data-report-id')),
      name: el.getAttribute('data-report-name'),
      database: el.getAttribute('data-database') || 'my',
      insertedAt: el.getAttribute('data-inserted-at')
    })
  })

  return { tables, reports }
}

// Load document from Integram by ID
async function loadDocument(docId, database = 'my') {
  loading.value = true
  try {
    console.log(`IntegramDocumentEditor: Loading document ${docId} from database ${database}`)

    // Initialize table if needed
    if (!tableMetadataLoaded.value) {
      const initialized = await initDocumentTable()
      if (!initialized) {
        return false
      }
    }

    if (!documentTypeId.value || !requisiteIds.value) {
      throw new Error('Document table not initialized')
    }

    // Get document object
    const response = await integramApiClient.getObjectList(documentTypeId.value, {
      ID: docId
    })

    const objects = response.object || []
    const reqs = response.reqs || {}

    if (objects.length === 0) {
      throw new Error(`Document with ID ${docId} not found`)
    }

    const doc = objects[0]
    const docReqs = reqs[doc.id] || {}

    console.log('IntegramDocumentEditor: Loaded document:', doc)
    console.log('IntegramDocumentEditor: Document requisites:', docReqs)

    // Extract requisite values using mapped IDs
    const reqIds = requisiteIds.value

    // Set document properties
    documentId.value = doc.id
    documentTitle.value = docReqs[reqIds.название] || doc.val || 'Untitled'

    // Load content
    const content = docReqs[reqIds.содержимое] || ''
    if (content && editorContent.value) {
      editorContent.value.innerHTML = content
      documentContent.value = content

      // Parse and restore embedded components metadata
      const { tables: parsedTables, reports: parsedReports } = parseEmbeddedComponents(content)
      embeddedTables.value = parsedTables
      embeddedReports.value = parsedReports

      console.log(`IntegramDocumentEditor: Restored ${parsedTables.length} tables and ${parsedReports.length} reports`)
    }

    // Broadcast context to Chat.vue after loading (Issue #6507)
    broadcastEditorContext()

    toast.add({
      severity: 'success',
      summary: 'Документ загружен',
      detail: `Документ "${documentTitle.value}" успешно загружен`,
      life: 3000
    })

    return true
  } catch (error) {
    console.error('IntegramDocumentEditor: Failed to load document:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка загрузки',
      detail: 'Не удалось загрузить документ: ' + error.message,
      life: 5000
    })
    return false
  } finally {
    loading.value = false
  }
}

// Document Table Initialization
async function initDocumentTable() {
  try {
    console.log('IntegramDocumentEditor: Initializing document table...')

    // Get dictionary to find document table
    const dictionary = await integramApiClient.getDictionary()
    const docTable = dictionary.find(item =>
      item.val && item.val.includes('Документы редактора')
    )

    if (!docTable) {
      throw new Error('Document table "Документы редактора" not found in dictionary')
    }

    console.log(`IntegramDocumentEditor: Found document table with ID ${docTable.id}`)
    documentTypeId.value = docTable.id

    // Get table metadata to map requisite names to IDs
    const metadata = await integramApiClient.getTypeMetadata(docTable.id)

    if (!metadata || !metadata.reqs) {
      throw new Error('Failed to load table metadata')
    }

    // Map Russian requisite names to IDs
    const reqIds = {}
    const aliases = metadata.aliases || {}

    for (const [reqId, reqData] of Object.entries(metadata.reqs)) {
      const alias = aliases[reqId] || reqData.val || ''
      const normalizedAlias = alias.toLowerCase().replace(/\s+/g, '_')

      // Map common requisite names
      if (alias.includes('Название')) reqIds.название = reqId
      else if (alias.includes('Содержимое')) reqIds.содержимое = reqId
      else if (alias.includes('Таблицы')) reqIds.таблицы = reqId
      else if (alias.includes('Отчёты') || alias.includes('Отчеты')) reqIds.отчёты = reqId
      else if (alias.includes('Дата создания')) reqIds.дата_создания = reqId
      else if (alias.includes('Дата изменения')) reqIds.дата_изменения = reqId
      else if (alias.includes('База данных')) reqIds.база_данных = reqId
    }

    requisiteIds.value = reqIds
    tableMetadataLoaded.value = true

    console.log(`IntegramDocumentEditor: Table has ${Object.keys(reqIds).length} requisites`)
    console.log('IntegramDocumentEditor: Requisite IDs:', reqIds)

    return true
  } catch (error) {
    console.error('IntegramDocumentEditor: Failed to initialize document table:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка инициализации',
      detail: 'Не удалось найти таблицу документов. Убедитесь, что таблица "Документы редактора" создана.',
      life: 5000
    })
    return false
  }
}

// Document Actions
function openSaveDialog() {
  // Set default title if empty
  saveDialogTitle.value = documentTitle.value || `Документ ${new Date().toLocaleString('ru-RU')}`
  showSaveDialog.value = true
}

async function confirmSave() {
  if (!saveDialogTitle.value.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Предупреждение',
      detail: 'Введите название документа',
      life: 3000
    })
    return
  }

  loading.value = true
  showSaveDialog.value = false

  try {
    // Initialize table if needed
    if (!tableMetadataLoaded.value) {
      const initialized = await initDocumentTable()
      if (!initialized) {
        return
      }
    }

    if (!documentTypeId.value || !requisiteIds.value) {
      throw new Error('Document table not initialized')
    }

    // Check for required requisites
    const requiredFields = ['название', 'содержимое']
    const missingFields = requiredFields.filter(field => !requisiteIds.value[field])

    if (missingFields.length > 0) {
      throw new Error(`Missing required requisites: ${missingFields.join(', ')}`)
    }

    // Prepare requisites using IDs
    const content = editorContent.value?.innerHTML || ''

    // Re-parse embedded components from current HTML to ensure they're up to date
    const { tables: parsedTables, reports: parsedReports } = parseEmbeddedComponents(content)
    embeddedTables.value = parsedTables
    embeddedReports.value = parsedReports

    const requisites = {
      [requisiteIds.value.название]: saveDialogTitle.value.trim(),
      [requisiteIds.value.содержимое]: content
    }

    // Add optional requisites if they exist
    if (requisiteIds.value.таблицы) {
      requisites[requisiteIds.value.таблицы] = JSON.stringify(embeddedTables.value || [])
    }
    if (requisiteIds.value.отчёты) {
      requisites[requisiteIds.value.отчёты] = JSON.stringify(embeddedReports.value || [])
    }
    if (requisiteIds.value.дата_изменения) {
      requisites[requisiteIds.value.дата_изменения] = new Date().toISOString()
    }
    if (requisiteIds.value.база_данных) {
      requisites[requisiteIds.value.база_данных] = route.params.database || 'my'
    }

    let result
    if (documentId.value) {
      // Update existing document
      console.log(`IntegramDocumentEditor: Updating document ${documentId.value}`)
      await integramApiClient.setObjectRequisites(documentId.value, requisites)
      result = { id: documentId.value }

      toast.add({
        severity: 'success',
        summary: 'Успешно',
        detail: `Документ "${saveDialogTitle.value.trim()}" обновлён`,
        life: 3000
      })
    } else {
      // Create new document
      console.log('IntegramDocumentEditor: Creating new document')

      // Add creation date only for new documents
      if (requisiteIds.value.дата_создания) {
        requisites[requisiteIds.value.дата_создания] = new Date().toISOString()
      }

      result = await integramApiClient.createObject(
        documentTypeId.value,
        saveDialogTitle.value.trim(),
        requisites
      )

      // Set document ID for future updates
      documentId.value = result.id || result.objectId

      toast.add({
        severity: 'success',
        summary: 'Успешно',
        detail: `Документ "${saveDialogTitle.value.trim()}" создан`,
        life: 3000
      })
    }

    documentTitle.value = saveDialogTitle.value.trim()

    // Also save to localStorage as backup
    const docData = {
      title: documentTitle.value,
      content,
      timestamp: new Date().toISOString(),
      database: route.params.database || 'my',
      objectId: result.id || result.objectId
    }
    localStorage.setItem('integram_document_draft', JSON.stringify(docData))

  } catch (error) {
    console.error('Failed to save document:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось сохранить документ: ' + error.message,
      life: 5000
    })
  } finally {
    loading.value = false
  }
}

function exportDocument() {
  const content = editorContent.value?.innerHTML || ''

  // Create HTML file
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Integram Document</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 10px 0;
    }
    th, td {
      padding: 8px;
      border: 1px solid #ddd;
      text-align: left;
    }
    th {
      background-color: #f0f0f0;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>
  `

  // Download
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `integram-document-${Date.now()}.html`
  a.click()
  URL.revokeObjectURL(url)

  toast.add({
    severity: 'success',
    summary: 'Exported',
    detail: 'Document exported as HTML',
    life: 3000
  })
}

// Load saved document on mount
onMounted(async () => {
  // Register AI block event listeners (Issue #6507)
  if (editorContent.value) {
    editorContent.value.addEventListener('click', handleEditorClick)
    editorContent.value.addEventListener('keydown', handleEditorKeydown)
  }
  // Listen for content insertion from Chat.vue sidebar (Issue #6507)
  window.addEventListener('insert-ai-content', handleInsertAIContent)

  try {
    // Initialize document table
    await initDocumentTable()

    // Check if we have a documentId in query params
    const queryDocId = route.query.documentId
    const queryDatabase = route.query.database || route.params.database || 'my'

    if (queryDocId) {
      // Load document from Integram
      console.log(`IntegramDocumentEditor: Loading document ${queryDocId} from ${queryDatabase}`)
      await loadDocument(queryDocId, queryDatabase)
    } else {
      // Load saved document from localStorage
      const saved = localStorage.getItem('integram_document_draft')
      if (saved) {
        const docData = JSON.parse(saved)
        if (docData.title) {
          documentTitle.value = docData.title
        }
        if (docData.content && editorContent.value) {
          editorContent.value.innerHTML = docData.content
          documentContent.value = docData.content

          // Parse embedded components from localStorage content
          const { tables: parsedTables, reports: parsedReports } = parseEmbeddedComponents(docData.content)
          embeddedTables.value = parsedTables
          embeddedReports.value = parsedReports

          console.log(`IntegramDocumentEditor: Restored ${parsedTables.length} tables and ${parsedReports.length} reports from localStorage`)
        }
        if (docData.objectId) {
          documentId.value = docData.objectId
        }
      }
    }

    // Connect to WebSocket for collaborative editing (Issue #6459)
    // Only connect if we have a documentId
    if (documentId.value) {
      console.log('[Integram Doc Editor] Connecting to WebSocket for document:', documentId.value)
      wsConnect()
    }
  } catch (error) {
    console.error('Failed to load saved document:', error)
  }
})

// Cleanup event listeners (Issue #6507)
onUnmounted(() => {
  if (editorContent.value) {
    editorContent.value.removeEventListener('click', handleEditorClick)
    editorContent.value.removeEventListener('keydown', handleEditorKeydown)
  }
  window.removeEventListener('insert-ai-content', handleInsertAIContent)
  // Clear editor context when leaving the page
  window.__editorDocumentContext = null
  window.dispatchEvent(new CustomEvent('editor-context-update', { detail: null }))
})

// Watch for documentId changes and connect/reconnect to WebSocket (Issue #6459)
watch(documentId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    console.log('[Integram Doc Editor] Document ID changed, connecting to WebSocket:', newId)
    wsConnect()
  }
})
</script>

<style scoped>
.integram-document-editor {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  position: relative;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: var(--p-content-hover-background, var(--surface-hover, #f8f9fa));
  border-bottom: 1px solid var(--surface-border, #dee2e6);
  flex-wrap: wrap;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: var(--surface-border, #dee2e6);
  margin: 0 4px;
}

.toolbar-spacer {
  flex: 1;
}

.heading-dropdown {
  width: 120px;
}

.actions-group {
  gap: 8px;
}

/* WebSocket Status Indicator (Issue #6459) */
.websocket-status {
  margin-right: 8px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
}

.status-indicator.connecting {
  background: var(--p-yellow-50, #fff3cd);
  color: var(--p-yellow-700, #856404);
}

.status-indicator.connected {
  background: var(--p-blue-50, #d1ecf1);
  color: var(--p-blue-800, #0c5460);
}

.status-indicator i {
  font-size: 0.9rem;
}

.status-text {
  white-space: nowrap;
}

.save-dialog-content {
  padding: 16px 0;
}

.editor-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: var(--p-text-color, #333);
  outline: none;
}

.editor-content:empty:before {
  content: attr(placeholder);
  color: var(--p-text-muted-color, #999);
  font-style: italic;
}

.editor-content h1 {
  font-size: 2em;
  margin: 0.67em 0;
}

.editor-content h2 {
  font-size: 1.5em;
  margin: 0.75em 0;
}

.editor-content h3 {
  font-size: 1.17em;
  margin: 0.83em 0;
}

.editor-content h4 {
  font-size: 1em;
  margin: 1em 0;
}

.editor-content p {
  margin: 1em 0;
}

.editor-content ul,
.editor-content ol {
  margin: 1em 0;
  padding-left: 2em;
}

.table-selector,
.report-selector {
  padding: 16px;
}

.search-box {
  margin-bottom: 16px;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--surface-card);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* Embedded table styles */
:deep(.integram-table-embed),
:deep(.integram-report-embed) {
  margin: 20px 0;
  padding: 16px;
  border: 1px solid var(--surface-border, #dee2e6);
  border-radius: 4px;
  background: var(--p-content-hover-background, var(--surface-hover, #f8f9fa));
}

:deep(.integram-table-embed h3),
:deep(.integram-report-embed h3) {
  margin: 0 0 12px 0;
  color: var(--p-text-color, #495057);
  font-size: 1.2em;
}

:deep(.integram-table-embed table),
:deep(.integram-report-embed table) {
  width: 100%;
  border-collapse: collapse;
  background: var(--p-surface-0, white);
}

:deep(.integram-table-embed th),
:deep(.integram-report-embed th) {
  background-color: var(--p-surface-100, #e9ecef);
  font-weight: 600;
}

/* AI Block styles (Issue #6507) */
:deep(.ai-block-embed) {
  margin: 20px 0;
  padding: 0;
  border: 2px solid var(--p-purple-300, #c4b5fd);
  border-radius: 8px;
  background: var(--p-purple-50, #faf5ff);
  overflow: hidden;
}

:deep(.ai-block-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: linear-gradient(135deg, var(--p-purple-500, #8b5cf6), var(--p-purple-600, #7c3aed));
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
}

:deep(.ai-block-label) {
  display: flex;
  align-items: center;
  gap: 6px;
}

:deep(.ai-block-label i) {
  font-size: 0.9rem;
}

:deep(.ai-block-prompt-area) {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:deep(.ai-block-input) {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--p-purple-300, #d8b4fe);
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.9rem;
  resize: vertical;
  outline: none;
  background: var(--p-surface-0, white);
  color: var(--p-text-color, #333);
  box-sizing: border-box;
  min-height: 48px;
  transition: border-color 0.2s;
}

:deep(.ai-block-input:focus) {
  border-color: var(--p-purple-500, #8b5cf6);
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
}

:deep(.ai-block-input::placeholder) {
  color: var(--p-purple-400, #a78bfa);
}

:deep(.ai-block-btn) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
  font-family: inherit;
}

:deep(.ai-block-btn:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

:deep(.ai-block-btn i) {
  font-size: 0.8rem;
}

:deep(.ai-block-send-btn) {
  background: var(--p-purple-600, #7c3aed);
  color: white;
  align-self: flex-end;
}

:deep(.ai-block-send-btn:hover:not(:disabled)) {
  background: var(--p-purple-700, #6d28d9);
}

:deep(.ai-block-apply-btn) {
  background: var(--p-green-600, #059669);
  color: white;
}

:deep(.ai-block-apply-btn:hover) {
  background: var(--p-green-700, #047857);
}

:deep(.ai-block-retry-btn) {
  background: var(--p-surface-200, #e5e7eb);
  color: var(--p-text-color, #374151);
}

:deep(.ai-block-retry-btn:hover) {
  background: var(--p-surface-300, #d1d5db);
}

:deep(.ai-block-remove-btn) {
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  font-size: 1.2rem;
  padding: 2px 8px;
  line-height: 1;
}

:deep(.ai-block-remove-btn:hover) {
  color: white;
  background: rgba(255, 255, 255, 0.15);
}

:deep(.ai-block-response) {
  padding: 12px 16px;
  margin: 0 12px 8px;
  border: 1px solid var(--surface-border, #e5e7eb);
  border-radius: 6px;
  background: var(--p-surface-0, white);
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--p-text-color, #333);
  max-height: 400px;
  overflow-y: auto;
}

:deep(.ai-block-response h1),
:deep(.ai-block-response h2),
:deep(.ai-block-response h3) {
  margin: 0.6em 0 0.3em;
}

:deep(.ai-block-response p) {
  margin: 0.5em 0;
}

:deep(.ai-block-response ul),
:deep(.ai-block-response ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

:deep(.ai-block-actions) {
  display: flex;
  gap: 8px;
  padding: 0 12px 12px;
}

:deep(.ai-block-loading) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin: 0 12px 8px;
  color: var(--p-purple-600, #7c3aed);
  font-size: 0.85rem;
}

:deep(.ai-block-spinner) {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--p-purple-300, #d8b4fe);
  border-top-color: var(--p-purple-600, #7c3aed);
  border-radius: 50%;
  animation: ai-block-spin 0.6s linear infinite;
}

@keyframes ai-block-spin {
  to { transform: rotate(360deg); }
}

:deep(.ai-block-error) {
  padding: 8px 12px;
  margin: 0 12px 8px;
  background: var(--p-red-50, #fef2f2);
  border: 1px solid var(--p-red-200, #fecaca);
  border-radius: 6px;
  color: var(--p-red-700, #b91c1c);
  font-size: 0.82rem;
}
</style>
