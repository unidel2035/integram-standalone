<template>
  <div class="agent-execution-steps" :class="{ 'compact': compact }">
    <!-- Header with agent info -->
    <div class="execution-header" v-if="!compact">
      <div class="agent-info">
        <span class="agent-icon">{{ currentAgent?.icon || '🤖' }}</span>
        <span class="agent-name">{{ currentAgent?.name || 'Агент' }}</span>
        <Tag
          v-if="status === 'running'"
          severity="info"
          value="Выполняется..."
          class="status-tag pulse"
        />
        <Tag
          v-else-if="status === 'completed'"
          severity="success"
          value="Готово"
          class="status-tag"
        />
        <Tag
          v-else-if="status === 'error'"
          severity="danger"
          value="Ошибка"
          class="status-tag"
        />
      </div>
      <div class="execution-time" v-if="startTime">
        <i class="pi pi-clock"></i>
        {{ formatDuration(elapsedTime) }}
      </div>
    </div>

    <!-- Steps timeline -->
    <div class="steps-timeline">
      <TransitionGroup name="step-slide">
        <div
          v-for="(step, index) in visibleSteps"
          :key="step.id || index"
          class="step-item"
          :class="{
            'completed': step.status === 'completed',
            'running': step.status === 'running',
            'pending': step.status === 'pending',
            'error': step.status === 'error'
          }"
        >
          <!-- Step connector line -->
          <div class="step-connector" v-if="index > 0"></div>

          <!-- Step indicator -->
          <div class="step-indicator">
            <i v-if="step.status === 'completed'" class="pi pi-check"></i>
            <i v-else-if="step.status === 'running'" class="pi pi-spin pi-spinner"></i>
            <i v-else-if="step.status === 'error'" class="pi pi-times"></i>
            <span v-else>{{ index + 1 }}</span>
          </div>

          <!-- Step content -->
          <div class="step-content">
            <div class="step-header" @click="toggleStep(step)">
              <span class="step-type-icon">{{ getStepIcon(step.type, step.toolName) }}</span>
              <span class="step-title">{{ step.title }}</span>
              <span v-if="step.status === 'error' && step.errorMessage" class="step-error-text">{{ step.errorMessage }}</span>
              <span v-if="step.retryCount" class="step-retry-badge">×{{ step.retryCount }}</span>
              <span class="step-duration" v-if="step.duration">
                {{ formatDuration(step.duration) }}
              </span>
              <Button
                v-if="step.details || step.result"
                :icon="expandedSteps.has(step.id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                text
                rounded
                size="small"
                class="expand-btn"
              />
            </div>

            <!-- Expanded details -->
            <Transition name="expand">
              <div v-if="expandedSteps.has(step.id)" class="step-details">
                <!-- Thinking block -->
                <div v-if="step.type === 'thinking' && step.thinking" class="thinking-block">
                  <div class="thinking-header">
                    <i class="pi pi-lightbulb"></i>
                    <span>Рассуждение</span>
                  </div>
                  <div class="thinking-content" v-html="formatThinking(step.thinking)"></div>
                </div>

                <!-- Tool call -->
                <div v-if="step.type === 'tool_call'" class="tool-call-block">
                  <div class="tool-name">
                    <i class="pi pi-cog"></i>
                    <code>{{ step.toolName }}</code>
                  </div>
                  <div v-if="step.toolInput" class="tool-input">
                    <span class="label">Входные данные:</span>
                    <pre class="language-json"><code v-html="highlightJSON(step.toolInput)"></code></pre>
                  </div>
                  <div v-if="step.toolResult?.error || step.errorMessage" class="tool-error">
                    <i class="pi pi-exclamation-triangle"></i>
                    {{ step.toolResult?.error || step.errorMessage }}
                  </div>
                  <div v-if="step.toolResult" class="tool-result">
                    <span class="label">Результат:</span>
                    <pre class="language-json"><code v-html="highlightJSON(step.toolResult)"></code></pre>
                  </div>
                </div>

                <!-- Agent handoff -->
                <div v-if="step.type === 'handoff'" class="handoff-block">
                  <div class="handoff-arrow">
                    <span class="from-agent">{{ step.fromAgent }}</span>
                    <i class="pi pi-arrow-right"></i>
                    <span class="to-agent">{{ step.toAgent }}</span>
                  </div>
                  <div v-if="step.reason" class="handoff-reason">
                    <i class="pi pi-info-circle"></i>
                    {{ step.reason }}
                  </div>
                </div>

                <!-- General details -->
                <div v-if="step.details" class="general-details">
                  {{ step.details }}
                </div>

                <!-- Result preview -->
                <div v-if="step.result" class="step-result">
                  <div class="result-header">
                    <i class="pi pi-check-circle"></i>
                    <span>Результат</span>
                  </div>
                  <div class="result-content" v-html="formatResult(step.result)"></div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- Current action indicator -->
    <div v-if="currentAction && status === 'running'" class="current-action">
      <ProgressSpinner style="width: 16px; height: 16px;" strokeWidth="4" />
      <span>{{ currentAction }}</span>
    </div>

    <!-- Agents involved (for orchestrator view) -->
    <div v-if="involvedAgents.length > 1" class="agents-flow">
      <div class="agents-flow-header">
        <i class="pi pi-sitemap"></i>
        <span>Цепочка агентов</span>
      </div>
      <div class="agents-chain">
        <template v-for="(agent, index) in involvedAgents" :key="agent.id">
          <div
            class="agent-chip"
            :class="{ 'active': agent.id === currentAgent?.id }"
          >
            <span class="agent-chip-icon">{{ agent.icon || '🤖' }}</span>
            <span class="agent-chip-name">{{ agent.name }}</span>
          </div>
          <i v-if="index < involvedAgents.length - 1" class="pi pi-arrow-right chain-arrow"></i>
        </template>
      </div>
    </div>

    <!-- Show more button -->
    <button
      v-if="steps.length > maxVisibleSteps && !showAll"
      @click="showAll = true"
      class="show-more-btn"
    >
      <i class="pi pi-list"></i>
      Показать все шаги
      <span class="show-more-badge">+{{ steps.length - maxVisibleSteps }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { marked } from 'marked'
import { highlightCode } from '@/utils/lazyLoadPrismJS'
import 'prismjs/themes/prism-tomorrow.css'

const props = defineProps({
  steps: {
    type: Array,
    default: () => []
  },
  currentAgent: {
    type: Object,
    default: null
  },
  involvedAgents: {
    type: Array,
    default: () => []
  },
  status: {
    type: String,
    default: 'idle', // idle, running, completed, error
    validator: (v) => ['idle', 'running', 'completed', 'error'].includes(v)
  },
  currentAction: {
    type: String,
    default: ''
  },
  startTime: {
    type: Number,
    default: null
  },
  compact: {
    type: Boolean,
    default: false
  },
  maxVisibleSteps: {
    type: Number,
    default: 5
  }
})

const emit = defineEmits(['step-click', 'expand-all', 'collapse-all'])

const expandedSteps = ref(new Set())
const showAll = ref(false)
const elapsedTime = ref(0)
let timer = null

// Computed
const visibleSteps = computed(() => {
  if (showAll.value || props.steps.length <= props.maxVisibleSteps) {
    return props.steps
  }
  return props.steps.slice(-props.maxVisibleSteps)
})

// Methods
const toggleStep = (step) => {
  if (expandedSteps.value.has(step.id)) {
    expandedSteps.value.delete(step.id)
  } else {
    expandedSteps.value.add(step.id)
  }
  expandedSteps.value = new Set(expandedSteps.value) // trigger reactivity
}

// Tool-specific emoji icons for meaningful display instead of generic wrench
const TOOL_ICONS = {
  // Web tools
  'web_search':           '🔍',
  'tavily_search':        '🔍',
  'web_fetch':            '🌐',
  'web_instant_answer':   '💡',
  // Document tools
  'doc_append_section':   '➕',
  'doc_replace_section':  '🔄',
  'doc_get_content':      '📖',
  'doc_create_document':  '📄',
  'doc_summarize':        '📝',
  'doc_search':           '🔎',
  // Editor tools
  'editor_append_section':      '➕',
  'editor_str_replace':         '✏️',
  'editor_insert_text':         '📝',
  'editor_clear_and_write':     '🔄',
  'editor_insert_heading':      '📌',
  'editor_insert_list':         '📋',
  'editor_insert_simple_table': '📊',
  'editor_insert_code_block':   '💻',
  'editor_replace_selection':   '🔁',
  'editor_plan_steps':          '📋',
  'editor_insert_finmodel':     '📊',
  'editor_insert_ecosystem':    '🌐',
  'editor_update_finmodel':     '✏️',
  'editor_read_finmodel':       '📖',
  'editor_read_ecosystem':      '🌿',
  'editor_update_ecosystem':    '🌱',
  'editor_insert_business_transform': '🔄',
  'editor_import_file':         '📂',
  'finmodel':                   '📊',
  'ecosystem':                  '🌐',
  // Integram tools
  'integram_get_dictionary':    '📚',
  'integram_search_objects':    '🔎',
  'integram_create_object':     '➕',
  'integram_set_object_requisites': '✏️',
  'integram_delete_object':     '🗑️',
  'integram_execute_report':    '📊',
  'integram_get_object_list':   '📋',
  'integram_authenticate':      '🔑',
  'integram_get_type_metadata': '🔍',
  'integram_get_object_edit_data': '📝',
  'integram_save_object':       '💾',
  'integram_create_type':       '🏗️',
  'integram_add_requisite':     '➕',
  'integram_save_requisite_alias': '🏷️',
  'integram_get_type_editor_data': '🔧',
  // Integram table-row tools
  'integram_get_table':         '📋',
  'integram_get_row':           '📄',
  'integram_update_cell':       '✏️',
  'integram_search_rows':       '🔎',
  'integram_create_row':        '➕',
  // Doc tools (additional)
  'doc_duplicate':              '📋',
  'doc_insert_integram_table':  '📊',
  'doc_insert_integram_report': '📈',
  'doc_insert_mermaid':         '🔷',
  'doc_insert_callout':         '💬',
  'doc_insert_embed':           '🔗',
  // Editor tools (additional)
  'editor_insert_integram_table':  '🗃️',
  'editor_insert_integram_report': '📈',
  'editor_insert_ecosystem_unified': '🌐',
  'editor_delete_block':        '🗑️',
  'editor_insert_mermaid':      '🔷',
  // Ontology tools
  'ontology_search_concepts':   '🔍',
  'ontology_get_concept':       '📖',
  'ontology_get_hierarchy':     '🌳',
  // Event engine tools
  'event_engine_get_scenarios': '🎯',
  'event_engine_get_mission':   '🚁',
  'event_engine_get_stats':     '📊',
  'event_engine_list_concepts': '📋',
  'event_engine_create_concept': '➕',
  'event_engine_list_actors':   '👥',
  'event_engine_create_actor':  '👤',
  'event_engine_list_models':   '📦',
  'event_engine_get_model_tree': '🌳',
  'event_engine_create_individual': '🚁',
  'event_engine_execute_model': '▶️',
  'event_engine_query_bsl':     '🔎',
  'event_engine_link_ontology': '🔗',
  // MBSE tools
  'mbse_list_requirements':     '📋',
  'mbse_create_requirement':    '➕',
  'mbse_get_traceability':      '🔗',
  'mbse_trace_requirement':     '🔗',
  'mbse_list_states':           '🔄',
  'mbse_create_state':          '➕',
  'mbse_create_transition':     '➡️',
  'mbse_execute_fsm':           '▶️',
  'mbse_generate_diagram':      '📊',
  'mbse_verify_requirement':    '✅',
  'mbse_get_coverage':          '📊',
  // Navigation tools
  'search_platform_routes':     '🗺️',
  'navigate_to':                '🔀',
  // Knowledge base tools
  'kb_search':                  '🔍',
  'kb_save_entity':             '💾',
  // Agent tools
  'launch_agent':               '🤖',
  'check_agent_job':            '📋',
}

const getStepIcon = (type, toolName) => {
  // For tool_call steps, use tool-specific icon if available
  if (type === 'tool_call' && toolName && TOOL_ICONS[toolName]) {
    return TOOL_ICONS[toolName]
  }
  const icons = {
    thinking: '🧠',
    tool_call: '⚙️',
    api_call: '🌐',
    database: '🗄️',
    search: '🔍',
    code: '💻',
    file: '📄',
    handoff: '🔄',
    response: '💬',
    error: '❌',
    success: '✅',
    agent_task: '▶️',
    default: '▶️'
  }
  return icons[type] || icons.default
}

const formatDuration = (ms) => {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return `${mins}m ${secs}s`
}

const formatJSON = (obj) => {
  try {
    if (typeof obj === 'string') return obj
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

// Cache for highlighted HTML keyed by raw string
const highlightCache = ref(new Map())

const highlightJSON = (obj) => {
  const raw = formatJSON(obj)
  const cached = highlightCache.value.get(raw)
  if (cached) return cached
  // Schedule async highlight, return escaped for now
  const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  highlightCode(raw, 'json').then(html => {
    if (html && html !== escaped) {
      highlightCache.value.set(raw, html)
      highlightCache.value = new Map(highlightCache.value) // trigger reactivity
    }
  })
  return escaped
}

const formatThinking = (thinking) => {
  if (!thinking) return ''
  // Convert markdown to HTML for thinking blocks
  try {
    return marked.parse(thinking, { breaks: true })
  } catch {
    return thinking.replace(/\n/g, '<br>')
  }
}

const formatResult = (result) => {
  if (!result) return ''
  if (typeof result === 'string') {
    try {
      return marked.parse(result, { breaks: true })
    } catch {
      return result.replace(/\n/g, '<br>')
    }
  }
  return `<pre>${formatJSON(result)}</pre>`
}

// Timer for elapsed time
const startTimer = () => {
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    if (props.startTime) {
      elapsedTime.value = Date.now() - props.startTime
    }
  }, 100)
}

const stopTimer = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

// Watchers
watch(() => props.status, (newStatus) => {
  if (newStatus === 'running') {
    startTimer()
  } else {
    stopTimer()
  }
}, { immediate: true })

// Auto-expand running steps
watch(() => props.steps, (newSteps) => {
  const runningStep = newSteps.find(s => s.status === 'running')
  if (runningStep && runningStep.id) {
    expandedSteps.value.add(runningStep.id)
    expandedSteps.value = new Set(expandedSteps.value)
  }
}, { deep: true })

onMounted(() => {
  if (props.status === 'running') {
    startTimer()
  }
})

onUnmounted(() => {
  stopTimer()
})
</script>

<style scoped>
.agent-execution-steps {
  background: var(--surface-card, #f7f7f5);
  border: 1px solid var(--surface-border, var(--surface-border));
  border-radius: 8px;
  padding: 1rem;
  margin: 0.5rem 0;
}

.agent-execution-steps.compact {
  padding: 0.375rem;
  background: transparent;
  border: none;
}

.compact .step-item {
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.compact .step-connector {
  left: 9px;
  top: -0.25rem;
  height: 0.5rem;
  width: 1.5px;
}

.compact .step-type-icon {
  font-size: 0.8rem;
}

.compact .step-title {
  font-size: 0.8rem;
}

.compact .step-duration {
  font-size: 0.675rem;
}

.compact .step-header {
  padding: 0.125rem;
  gap: 0.375rem;
}

.execution-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--surface-border, var(--surface-border));
}

.agent-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.agent-icon {
  font-size: 1.25rem;
}

.agent-name {
  font-weight: 600;
  color: var(--p-text-color, var(--text-color));
}

.status-tag.pulse {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.execution-time {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
  font-size: 0.875rem;
}

.steps-timeline {
  position: relative;
}

.step-item {
  display: flex;
  gap: 0.75rem;
  position: relative;
  padding: 0.5rem 0;
}

.step-connector {
  position: absolute;
  left: 12px;
  top: -0.5rem;
  width: 2px;
  height: 1rem;
  background: var(--surface-border, var(--surface-border));
}

.step-item.completed .step-connector {
  background: var(--p-green-500, #22c55e);
}

.step-item.running .step-connector {
  background: var(--p-blue-500, #3b82f6);
}

.step-indicator {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--surface-ground, var(--surface-ground));
  border: 2px solid var(--surface-border, var(--surface-border));
  color: var(--p-text-color-secondary, var(--text-color-secondary));
  z-index: 1;
}

.compact .step-indicator {
  width: 18px;
  height: 18px;
  font-size: 0.625rem;
  border-width: 1.5px;
}

.compact .step-indicator .pi {
  font-size: 0.6rem;
}

.step-item.completed .step-indicator {
  background: var(--p-green-500, #22c55e);
  border-color: var(--p-green-500, #22c55e);
  color: white;
}

.step-item.running .step-indicator {
  background: var(--p-blue-500, #3b82f6);
  border-color: var(--p-blue-500, #3b82f6);
  color: white;
}

.step-item.error .step-indicator {
  background: var(--p-red-500, #ef4444);
  border-color: var(--p-red-500, #ef4444);
  color: white;
}

.step-item.error .step-connector {
  background: var(--p-red-500, #ef4444);
}

.step-error-text {
  font-size: 0.75rem;
  color: var(--p-red-500, #ef4444);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.tool-error {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--p-red-300, #fca5a5);
  border-radius: 6px;
  color: var(--p-red-700, #b91c1c);
  font-size: 0.8125rem;
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.step-content {
  flex: 1;
  min-width: 0;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.step-header:hover {
  background: var(--surface-hover, var(--surface-hover));
}

.step-type-icon {
  font-size: 1rem;
}

.step-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  color: var(--p-text-color, var(--text-color));
}

.step-item.running .step-title {
  font-weight: 500;
}

.step-duration {
  font-size: 0.75rem;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
}

.step-retry-badge {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--p-orange-500, #f97316);
  background: var(--p-orange-50, #fff7ed);
  border: 1px solid var(--p-orange-200, #fed7aa);
  border-radius: 4px;
  padding: 0 4px;
  margin-left: 4px;
  white-space: nowrap;
}

.expand-btn {
  width: 1.5rem !important;
  height: 1.5rem !important;
}

.step-details {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: var(--surface-ground, var(--surface-ground));
  border-radius: 6px;
  font-size: 0.875rem;
}

.thinking-block {
  border-left: 3px solid var(--p-purple-500, #a855f7);
  padding-left: 0.75rem;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--p-purple-500, #a855f7);
  margin-bottom: 0.5rem;
}

.thinking-content {
  color: var(--p-text-color-secondary, var(--text-color-secondary));
  line-height: 1.5;
}

.thinking-content :deep(p) {
  margin: 0.5rem 0;
}

.tool-call-block {
  border-left: 3px solid var(--p-blue-500, #3b82f6);
  padding-left: 0.75rem;
}

.tool-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.tool-name code {
  background: var(--surface-card, #f7f7f5);
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-family: monospace;
}

.tool-input,
.tool-result {
  margin-top: 0.5rem;
}

.tool-input .label,
.tool-result .label {
  font-weight: 500;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
  display: block;
  margin-bottom: 0.25rem;
}

.tool-input pre,
.tool-result pre {
  background: #2d2d2d;
  padding: 0.5rem;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.75rem;
  margin: 0;
  line-height: 1.4;
}

.tool-input pre code,
.tool-result pre code {
  background: none;
  padding: 0;
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: inherit;
}

.handoff-block {
  border-left: 3px solid var(--p-orange-500, #f97316);
  padding-left: 0.75rem;
}

.handoff-arrow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

.from-agent,
.to-agent {
  padding: 0.25rem 0.5rem;
  background: var(--surface-card, #f7f7f5);
  border-radius: 4px;
}

.handoff-reason {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
  font-style: italic;
}

.step-result {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--surface-border, var(--surface-border));
}

.result-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--p-green-500, #22c55e);
  margin-bottom: 0.5rem;
}

.result-content {
  color: var(--p-text-color, var(--text-color));
}

.current-action {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--p-blue-50, #eff6ff);
  border-radius: 4px;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: var(--p-blue-700, #1d4ed8);
}

.agents-flow {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-border, var(--surface-border));
}

.agents-flow-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--p-text-color, var(--text-color));
}

.agents-chain {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.agent-chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: var(--surface-ground, var(--surface-ground));
  border-radius: 16px;
  font-size: 0.875rem;
}

.agent-chip.active {
  background: var(--p-primary-color, var(--primary-color));
  color: var(--p-primary-contrast-color, white);
}

.chain-arrow {
  color: var(--p-text-color-secondary, var(--text-color-secondary));
}

.show-more-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: var(--surface-ground, var(--surface-ground));
  border: 1px solid var(--surface-border, var(--surface-border));
  border-radius: 20px;
  font-size: 0.8125rem;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.show-more-btn:hover {
  background: var(--surface-hover, var(--surface-hover));
  color: var(--p-text-color, var(--text-color));
  border-color: var(--p-primary-color, var(--primary-color));
}

.show-more-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.3rem;
  background: var(--p-primary-color, var(--primary-color));
  color: white;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
}

/* Transitions */
.step-slide-enter-active {
  transition: all 0.3s ease-out;
}

.step-slide-leave-active {
  transition: all 0.3s ease-in;
}

.step-slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.step-slide-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}

/* Dark mode support */
:root.dark .current-action,
.p-dark .current-action {
  background: rgba(59, 130, 246, 0.15);
  color: var(--p-blue-400, #60a5fa);
}
</style>
