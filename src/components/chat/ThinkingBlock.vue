<template>
  <div
    class="thinking-block-wrapper"
    :class="{
      'expanded': isExpanded,
      'streaming': isStreaming,
      'compact': compact
    }"
  >
    <!-- Collapsible header -->
    <div class="thinking-header" @click="toggleExpand">
      <div class="thinking-indicator">
        <i v-if="isStreaming" class="pi pi-spin pi-spinner"></i>
        <i v-else class="pi pi-lightbulb"></i>
      </div>

      <div class="thinking-title">
        <span class="title-text">{{ title || 'Thinking' }}</span>
        <span v-if="thinkingType" class="thinking-type">{{ thinkingType }}</span>
      </div>

      <div class="thinking-meta">
        <span v-if="duration" class="duration">
          <i class="pi pi-clock"></i>
          {{ formatDuration(duration) }}
        </span>
        <span v-if="tokenCount" class="tokens">
          {{ tokenCount }} tokens
        </span>
      </div>

      <Button
        :icon="isExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
        text
        rounded
        size="small"
        class="expand-toggle"
        :aria-label="isExpanded ? 'Collapse' : 'Expand'"
      />
    </div>

    <!-- Thinking content -->
    <Transition name="slide-fade">
      <div v-show="isExpanded" class="thinking-content">
        <!-- Streaming content with cursor -->
        <div v-if="isStreaming" class="streaming-content">
          <div class="content-text" v-html="renderedContent"></div>
          <span class="streaming-cursor"></span>
        </div>

        <!-- Static content -->
        <div v-else class="static-content" v-html="renderedContent"></div>

        <!-- Sub-thoughts (nested thinking) -->
        <div v-if="subThoughts && subThoughts.length > 0" class="sub-thoughts">
          <div
            v-for="(thought, index) in subThoughts"
            :key="index"
            class="sub-thought"
          >
            <span class="sub-thought-bullet">•</span>
            <span class="sub-thought-text">{{ thought }}</span>
          </div>
        </div>

        <!-- Issue #6832: Web search sources -->
        <div v-if="sources && sources.length > 0" class="search-sources">
          <div class="sources-header">
            <i class="pi pi-link"></i>
            <span>Sources ({{ sources.length }})</span>
          </div>
          <div class="sources-list">
            <a
              v-for="(source, index) in sources"
              :key="index"
              :href="source.url"
              target="_blank"
              rel="noopener noreferrer"
              class="source-link"
            >
              <span class="source-number">[{{ index + 1 }}]</span>
              <span class="source-title">{{ source.title || source.url }}</span>
              <i class="pi pi-external-link source-icon"></i>
            </a>
          </div>
        </div>

        <!-- Related tools/actions -->
        <div v-if="relatedTools && relatedTools.length > 0" class="related-tools">
          <div class="related-tools-header">
            <i class="pi pi-cog"></i>
            <span>Related Actions</span>
          </div>
          <div class="tools-list">
            <Tag
              v-for="tool in relatedTools"
              :key="tool"
              :value="tool"
              severity="secondary"
              class="tool-tag"
            />
          </div>
        </div>
      </div>
    </Transition>

    <!-- Quick summary when collapsed -->
    <div v-if="!isExpanded && summary" class="thinking-summary">
      {{ summary }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { marked } from 'marked'

const props = defineProps({
  content: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: 'Thinking'
  },
  thinkingType: {
    type: String,
    default: '' // 'analysis', 'planning', 'reasoning', 'reflection'
  },
  isStreaming: {
    type: Boolean,
    default: false
  },
  duration: {
    type: Number,
    default: null
  },
  tokenCount: {
    type: Number,
    default: null
  },
  subThoughts: {
    type: Array,
    default: () => []
  },
  relatedTools: {
    type: Array,
    default: () => []
  },
  defaultExpanded: {
    type: Boolean,
    default: false
  },
  compact: {
    type: Boolean,
    default: false
  },
  autoCollapse: {
    type: Boolean,
    default: true // Auto collapse when streaming ends
  },
  // Issue #6832: Web search sources
  sources: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['expand', 'collapse'])

const isExpanded = ref(props.defaultExpanded)

// Computed
const renderedContent = computed(() => {
  if (!props.content) return ''
  try {
    // Configure marked for safe rendering
    marked.setOptions({
      breaks: true,
      gfm: true
    })
    return marked.parse(props.content)
  } catch {
    return props.content.replace(/\n/g, '<br>')
  }
})

const summary = computed(() => {
  if (!props.content) return ''
  // First 100 chars as summary
  const text = props.content.replace(/[#*_`]/g, '').trim()
  if (text.length <= 100) return text
  return text.substring(0, 100) + '...'
})

// Methods
const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
  emit(isExpanded.value ? 'expand' : 'collapse')
}

const formatDuration = (ms) => {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// Watchers
watch(() => props.isStreaming, (streaming, wasStreaming) => {
  // Auto-expand when streaming starts
  if (streaming && !wasStreaming) {
    isExpanded.value = true
  }
  // Auto-collapse when streaming ends (if autoCollapse is true)
  if (!streaming && wasStreaming && props.autoCollapse) {
    // Small delay before collapsing
    setTimeout(() => {
      isExpanded.value = false
    }, 1000)
  }
})

// Auto-expand if content is provided and defaultExpanded is true
onMounted(() => {
  if (props.defaultExpanded || props.isStreaming) {
    isExpanded.value = true
  }
})
</script>

<style scoped>
.thinking-block-wrapper {
  background: linear-gradient(135deg,
    rgba(168, 85, 247, 0.05) 0%,
    rgba(139, 92, 246, 0.08) 100%
  );
  border: 1px solid rgba(168, 85, 247, 0.2);
  border-left: 3px solid var(--p-purple-500, #a855f7);
  border-radius: 8px;
  margin: 0.5rem 0;
  overflow: hidden;
  transition: all 0.3s ease;
}

.thinking-block-wrapper.compact {
  margin: 0.25rem 0;
}

.thinking-block-wrapper.streaming {
  border-color: rgba(168, 85, 247, 0.4);
  box-shadow: 0 0 12px rgba(168, 85, 247, 0.15);
}

.thinking-block-wrapper.expanded {
  background: linear-gradient(135deg,
    rgba(168, 85, 247, 0.08) 0%,
    rgba(139, 92, 246, 0.12) 100%
  );
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.thinking-header:hover {
  background: rgba(168, 85, 247, 0.1);
}

.thinking-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--p-purple-500, #a855f7);
  color: white;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.thinking-indicator .pi-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.thinking-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.title-text {
  font-weight: 600;
  color: var(--p-purple-700, #7c3aed);
}

:root.dark .title-text,
.p-dark .title-text {
  color: var(--p-purple-300, #c4b5fd);
}

.thinking-type {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  background: rgba(168, 85, 247, 0.15);
  color: var(--p-purple-600, #9333ea);
  border-radius: 12px;
  text-transform: capitalize;
}

.thinking-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
}

.duration,
.tokens {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.expand-toggle {
  flex-shrink: 0;
  width: 1.75rem !important;
  height: 1.75rem !important;
  color: var(--p-purple-500, #a855f7) !important;
}

.thinking-content {
  padding: 0 1rem 1rem 1rem;
  margin-left: 28px;
  padding-left: calc(0.75rem + 1rem);
  border-left: 2px solid rgba(168, 85, 247, 0.2);
  margin-left: 14px;
}

.streaming-content {
  display: flex;
  flex-wrap: wrap;
}

.content-text {
  color: var(--p-text-color, var(--text-color));
  font-size: 0.875rem;
  line-height: 1.6;
}

.content-text :deep(p) {
  margin: 0.5rem 0;
}

.content-text :deep(p:first-child) {
  margin-top: 0;
}

.content-text :deep(p:last-child) {
  margin-bottom: 0;
}

.content-text :deep(code) {
  background: rgba(168, 85, 247, 0.1);
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.8125rem;
}

.content-text :deep(pre) {
  background: var(--surface-ground, var(--surface-ground));
  padding: 0.75rem;
  border-radius: 6px;
  overflow-x: auto;
  margin: 0.5rem 0;
}

.content-text :deep(ul),
.content-text :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.streaming-cursor {
  display: inline-block;
  width: 8px;
  height: 1rem;
  background: var(--p-purple-500, #a855f7);
  margin-left: 2px;
  animation: blink 0.8s infinite;
  vertical-align: middle;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.static-content {
  color: var(--p-text-color, var(--text-color));
  font-size: 0.875rem;
  line-height: 1.6;
}

.sub-thoughts {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed rgba(168, 85, 247, 0.2);
}

.sub-thought {
  display: flex;
  gap: 0.5rem;
  margin: 0.25rem 0;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
  font-size: 0.8125rem;
}

.sub-thought-bullet {
  color: var(--p-purple-500, #a855f7);
  flex-shrink: 0;
}

/* Issue #6832: Web search sources */
.search-sources {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed rgba(168, 85, 247, 0.2);
}

.sources-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
  margin-bottom: 0.5rem;
}

.sources-header i {
  color: var(--p-purple-500, #a855f7);
}

.sources-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.source-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--p-primary-color, #6366f1);
  text-decoration: none;
  padding: 0.375rem 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.source-link:hover {
  background: rgba(99, 102, 241, 0.1);
  text-decoration: underline;
}

.source-number {
  font-weight: 600;
  color: var(--p-purple-500, #a855f7);
  flex-shrink: 0;
}

.source-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-icon {
  font-size: 0.625rem;
  opacity: 0.6;
  flex-shrink: 0;
}

.related-tools {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed rgba(168, 85, 247, 0.2);
}

.related-tools-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
  margin-bottom: 0.5rem;
}

.tools-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tool-tag {
  font-size: 0.75rem;
}

.thinking-summary {
  padding: 0 1rem 0.75rem 1rem;
  margin-left: calc(28px + 0.75rem);
  font-size: 0.8125rem;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Transitions */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}

.slide-fade-enter-from {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}

.slide-fade-leave-to {
  opacity: 0;
  max-height: 0;
}

.slide-fade-enter-to,
.slide-fade-leave-from {
  opacity: 1;
  max-height: 1000px;
}

/* Dark mode adjustments */
:root.dark .thinking-block-wrapper,
.p-dark .thinking-block-wrapper {
  background: linear-gradient(135deg,
    rgba(168, 85, 247, 0.08) 0%,
    rgba(139, 92, 246, 0.12) 100%
  );
}

:root.dark .thinking-block-wrapper.expanded,
.p-dark .thinking-block-wrapper.expanded {
  background: linear-gradient(135deg,
    rgba(168, 85, 247, 0.12) 0%,
    rgba(139, 92, 246, 0.16) 100%
  );
}

:root.dark .thinking-type,
.p-dark .thinking-type {
  color: var(--p-purple-300, #c4b5fd);
}
</style>
