<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  results: {
    type: Object,
    default: () => ({
      menuItems: [],
      routes: [],
      agents: [],
      documents: [],
      integramResults: [],
      aiResults: [],
      totalResults: 0
    })
  },
  query: {
    type: String,
    default: ''
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['navigate', 'close'])

const router = useRouter()

const hasResults = computed(() => {
  return (
    props.results.routes.length > 0 ||
    props.results.agents.length > 0 ||
    (props.results.documents && props.results.documents.length > 0) ||
    props.results.integramResults.length > 0 ||
    props.results.aiResults.length > 0
  )
})

const navigateTo = (path) => {
  router.push(path)
  emit('navigate', path)
  emit('close')
}

// Safe text highlighting without v-html
const escapeHtml = (text) => {
  const div = document.createElement('div')
  div.textContent = text || ''
  return div.innerHTML
}

const highlightMatch = (text, query) => {
  if (!query || !text) return escapeHtml(text)

  // Escape both text and query for safety
  const escapedText = String(text)
  const escapedQuery = String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const parts = []
  const regex = new RegExp(`(${escapedQuery})`, 'gi')
  let lastIndex = 0
  let match

  while ((match = regex.exec(escapedText)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push({
        text: escapedText.substring(lastIndex, match.index),
        highlighted: false
      })
    }
    // Add matched text
    parts.push({
      text: match[0],
      highlighted: true
    })
    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < escapedText.length) {
    parts.push({
      text: escapedText.substring(lastIndex),
      highlighted: false
    })
  }

  return parts.length > 0 ? parts : [{ text: escapedText, highlighted: false }]
}

const handleKeyDown = (event, path) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    navigateTo(path)
  }
}
</script>

<template>
  <div v-if="query" class="smart-search-results" role="region" aria-label="Дополнительные результаты поиска">
    <!-- Loading indicator (compact) -->
    <div v-if="loading" class="search-loading-compact" role="status" aria-live="polite" aria-busy="true">
      <ProgressSpinner style="width: 20px; height: 20px" strokeWidth="4" aria-label="Загрузка" />
      <span class="ml-2 text-sm text-500">Поиск в базах...</span>
    </div>

    <!-- Results -->
    <div v-else-if="hasResults" class="search-results-container" role="list" aria-live="polite" aria-atomic="false">
      <!-- Integram Database Results -->
      <section v-if="results.integramResults && results.integramResults.length > 0" class="search-section" aria-label="База данных">
        <h3 class="search-section-header integram-header">
          <i class="pi pi-database mr-2" aria-hidden="true"></i>
          <span>База данных ({{ results.integramResults.length }})</span>
        </h3>
        <div class="search-items" role="list">
          <div
            v-for="(item, index) in results.integramResults"
            :key="`integram-${index}`"
            role="listitem"
            class="search-item integram-item"
            tabindex="0"
            :aria-label="`Таблица ${item.title} в базе ${item.database}`"
            @click="navigateTo(item.path)"
            @keydown="handleKeyDown($event, item.path)"
          >
            <div class="search-item-icon" aria-hidden="true">
              <i class="pi pi-table"></i>
            </div>
            <div class="search-item-content">
              <div class="search-item-title">
                <template v-for="(part, idx) in highlightMatch(item.title, query)" :key="`title-${idx}`">
                  <mark v-if="part.highlighted" class="search-highlight">{{ part.text }}</mark>
                  <template v-else>{{ part.text }}</template>
                </template>
                <Tag :value="`ID: ${item.id}`" severity="secondary" class="ml-2" />
              </div>
              <div class="search-item-description">
                <template v-for="(part, idx) in highlightMatch(item.description, query)" :key="`desc-${idx}`">
                  <mark v-if="part.highlighted" class="search-highlight">{{ part.text }}</mark>
                  <template v-else>{{ part.text }}</template>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Documents (Issue #7106) -->
      <section v-if="results.documents && results.documents.length > 0" class="search-section" aria-label="Документы">
        <h3 class="search-section-header documents-header">
          <i class="pi pi-file-edit mr-2" aria-hidden="true"></i>
          <span>Документы ({{ results.documents.length }})</span>
        </h3>
        <div class="search-items" role="list">
          <div
            v-for="(doc, index) in results.documents"
            :key="`doc-${index}`"
            role="listitem"
            class="search-item document-item"
            tabindex="0"
            :aria-label="`Открыть документ ${doc.title}`"
            @click="navigateTo(doc.path)"
            @keydown="handleKeyDown($event, doc.path)"
          >
            <div class="search-item-icon document-icon" aria-hidden="true">
              <i class="pi pi-file"></i>
            </div>
            <div class="search-item-content">
              <div class="search-item-title">
                <template v-for="(part, idx) in highlightMatch(doc.title, query)" :key="`dtitle-${idx}`">
                  <mark v-if="part.highlighted" class="search-highlight">{{ part.text }}</mark>
                  <template v-else>{{ part.text }}</template>
                </template>
              </div>
              <div class="search-item-description">
                {{ doc.description }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Routes -->
      <section v-if="results.routes.length > 0" class="search-section" aria-label="Страницы">
        <h3 class="search-section-header">
          <i class="pi pi-compass mr-2" aria-hidden="true"></i>
          <span>Страницы ({{ results.routes.length }})</span>
        </h3>
        <div class="search-items" role="list">
          <div
            v-for="route in results.routes"
            :key="route.path"
            role="listitem"
            class="search-item"
            tabindex="0"
            :aria-label="`Перейти на страницу ${route.path}`"
            @click="navigateTo(route.path)"
            @keydown="handleKeyDown($event, route.path)"
          >
            <div class="search-item-icon" aria-hidden="true">
              <i class="pi pi-link"></i>
            </div>
            <div class="search-item-content">
              <div class="search-item-title">
                <template v-for="(part, idx) in highlightMatch(route.path, query)" :key="`path-${idx}`">
                  <mark v-if="part.highlighted" class="search-highlight">{{ part.text }}</mark>
                  <template v-else>{{ part.text }}</template>
                </template>
              </div>
              <div class="search-item-description">
                <template v-for="(part, idx) in highlightMatch(route.description, query)" :key="`desc-${idx}`">
                  <mark v-if="part.highlighted" class="search-highlight">{{ part.text }}</mark>
                  <template v-else>{{ part.text }}</template>
                </template>
              </div>
              <div class="search-item-tags" role="list" aria-label="Теги">
                <Tag
                  v-for="tag in route.tags.slice(0, 3)"
                  :key="tag"
                  :value="tag"
                  severity="secondary"
                  class="mr-1"
                  role="listitem"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Agents/Spaces -->
      <section v-if="results.agents.length > 0" class="search-section" aria-label="Агенты">
        <h3 class="search-section-header">
          <i class="pi pi-box mr-2" aria-hidden="true"></i>
          <span>Агенты ({{ results.agents.length }})</span>
        </h3>
        <div class="search-items" role="list">
          <div
            v-for="agent in results.agents"
            :key="agent.id"
            role="listitem"
            class="search-item"
            tabindex="0"
            :aria-label="`Открыть агента ${agent.name}`"
            @click="navigateTo(agent.path)"
            @keydown="handleKeyDown($event, agent.path)"
          >
            <div class="search-item-icon" aria-hidden="true">
              <i v-if="agent.icon?.startsWith('pi ')" :class="agent.icon"></i>
              <span v-else class="agent-emoji">{{ agent.icon || '🤖' }}</span>
            </div>
            <div class="search-item-content">
              <div class="search-item-title">
                <template v-for="(part, idx) in highlightMatch(agent.name, query)" :key="`name-${idx}`">
                  <mark v-if="part.highlighted" class="search-highlight">{{ part.text }}</mark>
                  <template v-else>{{ part.text }}</template>
                </template>
              </div>
              <div class="search-item-description">
                <template v-for="(part, idx) in highlightMatch(agent.description, query)" :key="`desc-${idx}`">
                  <mark v-if="part.highlighted" class="search-highlight">{{ part.text }}</mark>
                  <template v-else>{{ part.text }}</template>
                </template>
              </div>
              <div class="search-item-tags" role="list" aria-label="Теги">
                <Tag
                  v-for="tag in agent.tags?.slice(0, 3)"
                  :key="tag"
                  :value="tag"
                  severity="info"
                  class="mr-1"
                  role="listitem"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- AI-Powered Suggestions (Issue #4878 - shown BELOW other results) -->
      <section v-if="results.aiResults && results.aiResults.length > 0" class="search-section" aria-label="AI Suggestions">
        <h3 class="search-section-header ai-header">
          <span class="ai-emoji mr-2" aria-hidden="true">🤖</span>
          <span>AI рекомендации ({{ results.aiResults.length }})</span>
        </h3>
        <div class="search-items" role="list">
          <div
            v-for="(item, index) in results.aiResults"
            :key="`ai-${index}`"
            role="listitem"
            class="search-item ai-item"
            tabindex="0"
            :aria-label="`AI предложение: ${item.title}`"
            @click="navigateTo(item.path)"
            @keydown="handleKeyDown($event, item.path)"
          >
            <div class="search-item-icon ai-icon" aria-hidden="true">
              <i class="pi pi-sparkles"></i>
            </div>
            <div class="search-item-content">
              <div class="search-item-title">
                🤖 {{ item.title }}
              </div>
              <div class="search-item-description">
                {{ item.description }}
              </div>
              <div v-if="item.relevance" class="search-item-meta">
                <Tag
                  :value="`Релевантность: ${Math.round(item.relevance * 100)}%`"
                  severity="success"
                  class="mr-1"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.smart-search-results {
  max-height: 50vh;
  overflow-y: auto;
}

.search-loading-compact {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  color: var(--text-color-secondary);
}

.search-results-container {
  padding: 0.5rem;
}

.search-section {
  margin-bottom: 0.75rem;
}

.search-section-header {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  padding: 0.25rem 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--surface-border);
  margin-bottom: 0.5rem;
}

.search-items {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.search-item {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.1s ease;
  background: var(--p-surface-card);
}

.search-item:hover {
  background: var(--p-surface-hover);
  transform: translateX(2px);
}

.search-item.integram-item {
  background: color-mix(in srgb, var(--p-blue-500) 12%, var(--p-surface-card));
  border: 1px solid color-mix(in srgb, var(--p-blue-500) 25%, transparent);
}

.search-section-header.integram-header {
  color: var(--p-blue-400);
  border-bottom-color: color-mix(in srgb, var(--p-blue-500) 25%, transparent);
}

/* Document Results Styling (Issue #7106) */
.search-item.document-item {
  background: color-mix(in srgb, var(--p-green-500) 12%, var(--p-surface-card));
  border: 1px solid color-mix(in srgb, var(--p-green-500) 25%, transparent);
}

.search-section-header.documents-header {
  color: var(--p-green-400);
  border-bottom-color: color-mix(in srgb, var(--p-green-500) 25%, transparent);
}

.search-item-icon.document-icon {
  background: var(--p-green-500);
  color: white;
}

/* AI Results Styling (Issue #4878) */
.search-item.ai-item {
  background: color-mix(in srgb, var(--p-purple-500) 12%, var(--p-surface-card));
  border: 1px solid color-mix(in srgb, var(--p-purple-500) 25%, transparent);
  position: relative;
  overflow: hidden;
}

.search-item.ai-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--p-purple-400), var(--p-pink-400));
}

.search-section-header.ai-header {
  color: var(--p-purple-400);
  border-bottom-color: color-mix(in srgb, var(--p-purple-500) 25%, transparent);
}

.ai-emoji {
  font-size: 1.1rem;
}

.search-item-icon.ai-icon {
  background: var(--p-purple-500);
  color: white;
}

.search-item-meta {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.search-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--p-surface-hover);
  color: var(--p-primary-color);
  flex-shrink: 0;
  font-size: 0.875rem;
}

.integram-item .search-item-icon {
  background: var(--p-blue-500);
  color: white;
}

.agent-emoji {
  font-size: 1.5rem;
}

.search-item-content {
  flex: 1;
  overflow: hidden;
}

.search-item-title {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text-color);
  margin-bottom: 0.125rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-item-description {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.search-item-tags {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.search-highlight {
  background: color-mix(in srgb, var(--p-yellow-500) 20%, var(--p-surface-card));
  color: var(--p-yellow-400);
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  font-weight: 600;
}

/* Focus styles for keyboard navigation */
.search-item:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.search-item:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

/* Scrollbar styling */
.smart-search-results::-webkit-scrollbar {
  width: 6px;
}

.smart-search-results::-webkit-scrollbar-track {
  background: var(--surface-100);
  border-radius: 3px;
}

.smart-search-results::-webkit-scrollbar-thumb {
  background: var(--surface-400);
  border-radius: 3px;
}

.smart-search-results::-webkit-scrollbar-thumb:hover {
  background: var(--surface-500);
}
</style>
