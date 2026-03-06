<template>
  <div class="enhanced-chat-message" :class="{ 'user-message': isUser, 'agent-message': !isUser }">
    <!-- Agent Info Header (for AI messages) -->
    <div v-if="!isUser && agent" class="message-agent-header">
      <div class="agent-avatar">
        {{ agent.icon || '🤖' }}
      </div>
      <div class="agent-details">
        <span class="agent-name">{{ agent.name || 'AI Assistant' }}</span>
        <Tag
          v-if="agent.type"
          :value="agent.type"
          severity="secondary"
          class="agent-type-tag"
        />
      </div>
    </div>

    <!-- Thinking Block (Claude-style) -->
    <ThinkingBlock
      v-if="thinking && (showThinking || isStreaming)"
      :content="thinking"
      :title="thinkingTitle"
      :thinking-type="thinkingType"
      :is-streaming="isStreaming && !content"
      :duration="thinkingDuration"
      :default-expanded="isStreaming"
      :auto-collapse="true"
    />

    <!-- Execution Steps (tool calls, API calls, etc.) -->
    <AgentExecutionSteps
      v-if="executionSteps && executionSteps.length > 0"
      :steps="executionSteps"
      :current-agent="agent"
      :involved-agents="involvedAgents"
      :status="executionStatus"
      :current-action="currentAction"
      :start-time="executionStartTime"
      :compact="compact"
    />

    <!-- Agent Handoff -->
    <AgentHandoffIndicator
      v-if="handoff"
      :from-agent="handoff.from"
      :to-agent="handoff.to"
      :reason="handoff.reason"
      :context="handoff.context"
      :timestamp="handoff.timestamp"
      :animated="isStreaming"
    />

    <!-- Main Message Content -->
    <div class="message-content-wrapper">
      <!-- Attachments (before content) -->
      <div v-if="attachments && attachments.length > 0" class="message-attachments">
        <div
          v-for="(attachment, index) in attachments"
          :key="index"
          class="attachment-item"
          @click="$emit('attachment-click', attachment)"
        >
          <img
            v-if="isImage(attachment)"
            :src="attachment.url"
            class="attachment-image"
            :alt="attachment.name"
          />
          <div v-else class="attachment-file">
            <i :class="getAttachmentIcon(attachment)"></i>
            <span class="attachment-name">{{ attachment.name }}</span>
          </div>
        </div>
      </div>

      <!-- Message Text -->
      <div class="message-text" :class="{ 'streaming': isStreaming }">
        <MarkdownRender v-if="content" :content="content" />
        <span v-if="isStreaming && content" class="streaming-cursor"></span>
        <div v-if="isStreaming && !content" class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      <!-- Code Blocks with Actions -->
      <div v-if="codeBlocks && codeBlocks.length > 0" class="code-blocks">
        <div v-for="(code, index) in codeBlocks" :key="index" class="code-block-item">
          <div class="code-header">
            <span class="code-language">{{ code.language || 'code' }}</span>
            <div class="code-actions">
              <Button
                icon="pi pi-copy"
                text
                size="small"
                @click="copyCode(code.content)"
                v-tooltip.top="'Copy'"
              />
              <Button
                v-if="code.executable"
                icon="pi pi-play"
                text
                size="small"
                @click="$emit('execute-code', code)"
                v-tooltip.top="'Run'"
              />
            </div>
          </div>
          <pre><code>{{ code.content }}</code></pre>
        </div>
      </div>
    </div>

    <!-- Workflow Flow View (Taskade-style) -->
    <WorkflowFlowView
      v-if="workflowNodes && workflowNodes.length > 0"
      :nodes="workflowNodes"
      :edges="workflowEdges"
      :title="workflowTitle"
      :status="workflowStatus"
      :compact="compact"
      @node-click="$emit('workflow-node-click', $event)"
    />

    <!-- Sources / References -->
    <div v-if="sources && sources.length > 0" class="message-sources">
      <div class="sources-header">
        <i class="pi pi-link"></i>
        <span>Sources ({{ sources.length }})</span>
        <Button
          :icon="sourcesExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
          text
          size="small"
          @click="sourcesExpanded = !sourcesExpanded"
        />
      </div>
      <Transition name="slide">
        <div v-if="sourcesExpanded" class="sources-list">
          <a
            v-for="(source, index) in sources"
            :key="index"
            :href="source.url"
            target="_blank"
            class="source-item"
          >
            <i class="pi pi-external-link"></i>
            <span>{{ source.title || source.url }}</span>
          </a>
        </div>
      </Transition>
    </div>

    <!-- Message Footer -->
    <div class="message-footer">
      <span class="message-time">{{ formatTime(timestamp) }}</span>

      <div class="message-actions">
        <!-- Feedback buttons (for AI messages) -->
        <template v-if="!isUser && showFeedback">
          <Button
            icon="pi pi-thumbs-up"
            text
            rounded
            size="small"
            :class="{ 'active': feedback === 'positive' }"
            @click="$emit('feedback', 'positive')"
            v-tooltip.top="'Helpful'"
          />
          <Button
            icon="pi pi-thumbs-down"
            text
            rounded
            size="small"
            :class="{ 'active': feedback === 'negative' }"
            @click="$emit('feedback', 'negative')"
            v-tooltip.top="'Not helpful'"
          />
        </template>

        <!-- Copy button -->
        <Button
          v-if="content"
          icon="pi pi-copy"
          text
          rounded
          size="small"
          @click="copyMessage"
          v-tooltip.top="'Copy'"
        />

        <!-- Regenerate (for AI messages) -->
        <Button
          v-if="!isUser && showRegenerate"
          icon="pi pi-refresh"
          text
          rounded
          size="small"
          @click="$emit('regenerate')"
          v-tooltip.top="'Regenerate'"
        />

        <!-- Edit (for user messages) -->
        <Button
          v-if="isUser && showEdit"
          icon="pi pi-pencil"
          text
          rounded
          size="small"
          @click="$emit('edit')"
          v-tooltip.top="'Edit'"
        />

        <!-- Delete -->
        <Button
          v-if="showDelete"
          icon="pi pi-trash"
          text
          rounded
          size="small"
          severity="danger"
          @click="$emit('delete')"
          v-tooltip.top="'Delete'"
        />
      </div>
    </div>

    <!-- Suggested Actions / Quick Replies -->
    <div v-if="suggestedActions && suggestedActions.length > 0" class="suggested-actions">
      <Button
        v-for="(action, index) in suggestedActions"
        :key="index"
        :label="action.label"
        :icon="action.icon"
        outlined
        size="small"
        @click="$emit('action', action)"
        class="suggested-action-btn"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import MarkdownRender from '@/components/MarkdownRender.vue'
import ThinkingBlock from './ThinkingBlock.vue'
import AgentExecutionSteps from './AgentExecutionSteps.vue'
import AgentHandoffIndicator from './AgentHandoffIndicator.vue'
import WorkflowFlowView from './WorkflowFlowView.vue'

const props = defineProps({
  // Basic message props
  content: {
    type: String,
    default: ''
  },
  isUser: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: [Number, Date, String],
    default: () => new Date()
  },
  attachments: {
    type: Array,
    default: () => []
  },

  // Agent props
  agent: {
    type: Object,
    default: null
    // { id, name, icon, type }
  },
  involvedAgents: {
    type: Array,
    default: () => []
  },

  // Thinking/Reasoning
  thinking: {
    type: String,
    default: ''
  },
  thinkingTitle: {
    type: String,
    default: 'Thinking'
  },
  thinkingType: {
    type: String,
    default: '' // 'analysis', 'planning', 'reasoning'
  },
  thinkingDuration: {
    type: Number,
    default: null
  },
  showThinking: {
    type: Boolean,
    default: true
  },

  // Execution steps
  executionSteps: {
    type: Array,
    default: () => []
  },
  executionStatus: {
    type: String,
    default: 'idle' // idle, running, completed, error
  },
  currentAction: {
    type: String,
    default: ''
  },
  executionStartTime: {
    type: Number,
    default: null
  },

  // Agent handoff
  handoff: {
    type: Object,
    default: null
    // { from: Agent, to: Agent, reason, context, timestamp }
  },

  // Workflow (Taskade-style)
  workflowNodes: {
    type: Array,
    default: () => []
  },
  workflowEdges: {
    type: Array,
    default: () => []
  },
  workflowTitle: {
    type: String,
    default: 'Workflow'
  },
  workflowStatus: {
    type: String,
    default: 'idle'
  },

  // Code blocks
  codeBlocks: {
    type: Array,
    default: () => []
    // [{ language, content, executable }]
  },

  // Sources
  sources: {
    type: Array,
    default: () => []
    // [{ url, title }]
  },

  // Suggested actions
  suggestedActions: {
    type: Array,
    default: () => []
    // [{ label, icon, action }]
  },

  // Streaming state
  isStreaming: {
    type: Boolean,
    default: false
  },

  // UI options
  compact: {
    type: Boolean,
    default: false
  },
  showFeedback: {
    type: Boolean,
    default: true
  },
  showRegenerate: {
    type: Boolean,
    default: true
  },
  showEdit: {
    type: Boolean,
    default: true
  },
  showDelete: {
    type: Boolean,
    default: false
  },
  feedback: {
    type: String,
    default: null // 'positive', 'negative', null
  }
})

const emit = defineEmits([
  'attachment-click',
  'execute-code',
  'workflow-node-click',
  'feedback',
  'regenerate',
  'edit',
  'delete',
  'action',
  'copy'
])

// State
const sourcesExpanded = ref(false)

// Methods
const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const isImage = (attachment) => {
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
  return attachment.type && imageTypes.includes(attachment.type)
}

const getAttachmentIcon = (attachment) => {
  const icons = {
    'application/pdf': 'pi pi-file-pdf',
    'application/msword': 'pi pi-file-word',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'pi pi-file-word',
    'application/vnd.ms-excel': 'pi pi-file-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'pi pi-file-excel',
    'text/plain': 'pi pi-file',
    'application/json': 'pi pi-code',
    'text/csv': 'pi pi-table'
  }
  return icons[attachment.type] || 'pi pi-file'
}

const copyMessage = async () => {
  try {
    await navigator.clipboard.writeText(props.content)
    emit('copy', props.content)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const copyCode = async (code) => {
  try {
    await navigator.clipboard.writeText(code)
  } catch (err) {
    console.error('Failed to copy code:', err)
  }
}
</script>

<style scoped>
.enhanced-chat-message {
  padding: 1rem;
  margin: 0.5rem 0;
  border-radius: 12px;
  background: var(--surface-card, #f7f7f5);
  border: 1px solid var(--surface-border, var(--surface-border));
}

.enhanced-chat-message.user-message {
  background: linear-gradient(135deg,
    var(--p-primary-50, #eff6ff) 0%,
    var(--p-primary-100, #dbeafe) 100%
  );
  border-color: var(--p-primary-200, #bfdbfe);
  margin-left: 2rem;
}

:root.dark .enhanced-chat-message.user-message,
.p-dark .enhanced-chat-message.user-message {
  background: linear-gradient(135deg,
    rgba(59, 130, 246, 0.1) 0%,
    rgba(59, 130, 246, 0.15) 100%
  );
  border-color: rgba(59, 130, 246, 0.3);
}

.enhanced-chat-message.agent-message {
  margin-right: 2rem;
}

/* Agent Header */
.message-agent-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--surface-border, var(--surface-border));
}

.agent-avatar {
  width: 36px;
  height: 36px;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-ground, var(--surface-ground));
  border-radius: 50%;
}

.agent-details {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.agent-name {
  font-weight: 600;
  color: var(--p-text-color, var(--text-color));
}

.agent-type-tag {
  font-size: 0.6875rem;
}

/* Message Content */
.message-content-wrapper {
  margin: 0.5rem 0;
}

.message-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.attachment-item {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s;
}

.attachment-item:hover {
  transform: scale(1.02);
}

.attachment-image {
  max-width: 200px;
  max-height: 150px;
  border-radius: 8px;
  object-fit: cover;
}

.attachment-file {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface-ground, var(--surface-ground));
  border-radius: 8px;
  font-size: 0.875rem;
}

.attachment-file i {
  font-size: 1.25rem;
  color: var(--p-primary-color, var(--primary-color));
}

.message-text {
  color: var(--p-text-color, var(--text-color));
  line-height: 1.6;
}

.message-text.streaming {
  position: relative;
}

.streaming-cursor {
  display: inline-block;
  width: 8px;
  height: 1em;
  background: var(--p-primary-color, #3b82f6);
  margin-left: 2px;
  animation: blink 0.8s infinite;
  vertical-align: middle;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 0.5rem;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: var(--p-primary-color, #3b82f6);
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-6px);
    opacity: 1;
  }
}

/* Code Blocks */
.code-blocks {
  margin-top: 0.75rem;
}

.code-block-item {
  background: var(--surface-ground, var(--surface-ground));
  border-radius: 8px;
  overflow: hidden;
  margin: 0.5rem 0;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: rgba(0, 0, 0, 0.05);
  border-bottom: 1px solid var(--surface-border, var(--surface-border));
}

.code-language {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
  text-transform: uppercase;
}

.code-actions {
  display: flex;
  gap: 0.25rem;
}

.code-block-item pre {
  margin: 0;
  padding: 0.75rem;
  overflow-x: auto;
  font-size: 0.8125rem;
}

/* Sources */
.message-sources {
  margin-top: 0.75rem;
  padding: 0.5rem;
  background: var(--surface-ground, var(--surface-ground));
  border-radius: 8px;
}

.sources-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
}

.sources-header i {
  color: var(--p-primary-color, var(--primary-color));
}

.sources-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.source-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  color: var(--p-primary-color, var(--primary-color));
  text-decoration: none;
  font-size: 0.8125rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.source-item:hover {
  background: rgba(59, 130, 246, 0.1);
}

/* Message Footer */
.message-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--surface-border, var(--surface-border));
}

.message-time {
  font-size: 0.75rem;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
}

.message-actions {
  display: flex;
  gap: 0.25rem;
}

.message-actions .active {
  color: var(--p-primary-color, var(--primary-color)) !important;
  background: rgba(59, 130, 246, 0.1) !important;
}

/* Suggested Actions */
.suggested-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--surface-border, var(--surface-border));
}

.suggested-action-btn {
  font-size: 0.8125rem;
}

/* Transitions */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}

/* Dark mode */
:root.dark .code-header,
.p-dark .code-header {
  background: rgba(255, 255, 255, 0.05);
}
</style>
