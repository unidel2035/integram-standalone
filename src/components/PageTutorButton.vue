<template>
  <div class="page-tutor-wrapper">
    <!-- Floating Button -->
    <Transition name="tutor-button">
      <Button
        v-if="!isOpen"
        icon="pi pi-question-circle"
        class="page-tutor-button"
        severity="help"
        rounded
        @click="toggleTutor"
        v-tooltip.left="'AI-помощь по странице'"
      />
    </Transition>

    <!-- Chat Panel -->
    <Transition name="tutor-panel">
      <div v-if="isOpen" class="page-tutor-panel">
        <!-- Header -->
        <div class="tutor-header">
          <div class="tutor-title">
            <i class="pi pi-sparkles" style="color: var(--p-primary-color)"></i>
            <span>AI-наставник</span>
          </div>
          <div class="tutor-actions">
            <Button
              icon="pi pi-trash"
              text
              rounded
              size="small"
              severity="secondary"
              @click="clearChat"
              v-tooltip.left="'Очистить чат'"
            />
            <Button
              icon="pi pi-times"
              text
              rounded
              size="small"
              severity="secondary"
              @click="closeTutor"
            />
          </div>
        </div>

        <!-- Messages -->
        <div class="tutor-messages" ref="messagesContainer">
          <div
            v-for="msg in messages"
            :key="msg.id"
            :class="['tutor-message', `tutor-message--${msg.role}`, { 'tutor-message--error': msg.isError }]"
          >
            <div class="tutor-message-header">
              <i :class="msg.role === 'user' ? 'pi pi-user' : 'pi pi-sparkles'"></i>
              <span class="tutor-message-time">
                {{ formatTime(msg.timestamp) }}
              </span>
            </div>
            <div class="tutor-message-content" v-html="formatMarkdown(msg.content)"></div>
          </div>

          <!-- Loading indicator -->
          <div v-if="isLoading" class="tutor-message tutor-message--assistant">
            <div class="tutor-message-header">
              <i class="pi pi-sparkles"></i>
              <span class="tutor-message-time">Печатает...</span>
            </div>
            <div class="tutor-loading">
              <ProgressSpinner
                style="width: 30px; height: 30px"
                strokeWidth="4"
              />
            </div>
          </div>
        </div>

        <!-- Quick Questions -->
        <div v-if="quickQuestions.length > 0 && !hasMessages" class="tutor-quick-questions">
          <div class="tutor-quick-label">Быстрые вопросы:</div>
          <div class="tutor-chips">
            <Chip
              v-for="(q, idx) in quickQuestions"
              :key="idx"
              :label="q"
              class="tutor-chip"
              @click="askAbout(q)"
            />
          </div>
        </div>

        <!-- Input -->
        <div class="tutor-input-container">
          <Textarea
            v-model="currentMessage"
            placeholder="Задайте вопрос о странице..."
            :autoResize="true"
            rows="2"
            class="tutor-input"
            @keydown.enter.ctrl="sendMessage"
            @keydown.enter.meta="sendMessage"
          />
          <Button
            icon="pi pi-send"
            severity="primary"
            :disabled="!currentMessage.trim() || isLoading"
            @click="sendMessage()"
            class="tutor-send-btn"
          />
        </div>

        <!-- Hint -->
        <div class="tutor-hint">
          <i class="pi pi-info-circle"></i>
          <span>Ctrl+Enter или Cmd+Enter для отправки</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
import { usePageTutor } from '@/composables/usePageTutor'
import { getPageTutorConfig } from '@/config/pageTutorPrompts'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Chip from 'primevue/chip'
import ProgressSpinner from 'primevue/progressspinner'
import { marked } from 'marked'

/**
 * Props
 */
const props = defineProps({
  pageId: {
    type: String,
    required: true
  },
  getContext: {
    type: Function,
    default: () => ({})
  }
})

/**
 * Get page tutor config
 */
const config = getPageTutorConfig(props.pageId)

/**
 * Use composable
 */
const {
  isOpen,
  messages,
  currentMessage,
  isLoading,
  hasMessages,
  quickQuestions: configQuestions,
  openTutor,
  closeTutor,
  toggleTutor,
  sendMessage,
  askAbout,
  clearChat
} = usePageTutor({
  page: props.pageId,
  systemPrompt: config.systemPrompt,
  quickQuestions: config.quickQuestions,
  getContext: props.getContext
})

/**
 * Refs
 */
const messagesContainer = ref(null)
const quickQuestions = ref(config.quickQuestions || [])

/**
 * Format time
 */
function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Format markdown content
 */
function formatMarkdown(content) {
  try {
    // Configure marked for security
    marked.setOptions({
      breaks: true,
      gfm: true
    })
    return marked.parse(content || '')
  } catch (e) {
    console.error('[PageTutor] Markdown error:', e)
    return content
  }
}

/**
 * Scroll to bottom when new messages arrive
 */
watch(messages, async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}, { deep: true })

/**
 * Auto-scroll on loading change
 */
watch(isLoading, async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
})
</script>

<style scoped>
/* ========== Floating Button ========== */
.page-tutor-button {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
  width: 56px;
  height: 56px;
  font-size: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.page-tutor-button:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

/* ========== Chat Panel ========== */
.page-tutor-panel {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 420px;
  max-width: calc(100vw - 48px);
  height: 600px;
  max-height: calc(100vh - 48px);
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: var(--p-border-radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  overflow: hidden;
}

/* ========== Header ========== */
.tutor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--p-surface-border);
  background: var(--p-surface-50);
}

.tutor-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
  color: var(--p-text-color);
}

.tutor-actions {
  display: flex;
  gap: 4px;
}

/* ========== Messages ========== */
.tutor-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tutor-message {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: var(--p-border-radius-md);
  max-width: 85%;
}

.tutor-message--user {
  align-self: flex-end;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.tutor-message--assistant {
  align-self: flex-start;
  background: var(--p-surface-100);
  color: var(--p-text-color);
}

.tutor-message--error {
  background: var(--p-red-100);
  color: var(--p-red-900);
}

.tutor-message-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  opacity: 0.8;
}

.tutor-message-content {
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word;
}

.tutor-message--user .tutor-message-content {
  color: var(--p-primary-contrast-color);
}

.tutor-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
}

/* Markdown styles */
.tutor-message-content :deep(p) {
  margin: 0 0 8px 0;
}

.tutor-message-content :deep(p:last-child) {
  margin-bottom: 0;
}

.tutor-message-content :deep(ul),
.tutor-message-content :deep(ol) {
  margin: 4px 0;
  padding-left: 20px;
}

.tutor-message-content :deep(code) {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 13px;
}

.tutor-message-content :deep(pre) {
  background: rgba(0, 0, 0, 0.1);
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
}

.tutor-message-content :deep(strong) {
  font-weight: 600;
}

/* ========== Quick Questions ========== */
.tutor-quick-questions {
  padding: 12px 16px;
  border-top: 1px solid var(--p-surface-border);
  background: var(--p-surface-50);
}

.tutor-quick-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-muted-color);
  margin-bottom: 8px;
}

.tutor-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tutor-chip {
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.tutor-chip:hover {
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

/* ========== Input ========== */
.tutor-input-container {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--p-surface-border);
  background: var(--p-surface-card);
}

.tutor-input {
  flex: 1;
  font-size: 14px;
}

.tutor-send-btn {
  align-self: flex-end;
}

/* ========== Hint ========== */
.tutor-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 11px;
  color: var(--p-text-muted-color);
  background: var(--p-surface-50);
}

/* ========== Transitions ========== */
.tutor-button-enter-active,
.tutor-button-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tutor-button-enter-from,
.tutor-button-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.tutor-panel-enter-active,
.tutor-panel-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tutor-panel-enter-from,
.tutor-panel-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

/* ========== Responsive ========== */
@media (max-width: 768px) {
  .page-tutor-panel {
    width: calc(100vw - 24px);
    height: calc(100vh - 24px);
    bottom: 12px;
    right: 12px;
  }

  .page-tutor-button {
    bottom: 16px;
    right: 16px;
    width: 48px;
    height: 48px;
    font-size: 20px;
  }
}

/* ========== Dark mode support ========== */
@media (prefers-color-scheme: dark) {
  .tutor-message--assistant {
    background: var(--p-surface-800);
  }

  .tutor-quick-questions {
    background: var(--p-surface-800);
  }

  .tutor-hint {
    background: var(--p-surface-800);
  }
}
</style>
