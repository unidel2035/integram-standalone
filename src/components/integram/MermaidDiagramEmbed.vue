<template>
  <div class="mermaid-embed-wrapper">
    <div class="mermaid-toolbar">
      <div class="mermaid-toolbar-left">
        <i class="pi pi-sitemap"></i>
        <span class="mermaid-label">Mermaid</span>
      </div>
      <div class="mermaid-toolbar-right">
        <button @click="toggleEdit" class="mermaid-btn" :title="isEditing ? 'Применить' : 'Редактировать'">
          {{ isEditing ? 'Применить' : 'Редактировать' }}
        </button>
        <button @click="removeDiagram" class="mermaid-btn mermaid-btn-danger" title="Удалить">
          <i class="pi pi-trash"></i>
        </button>
      </div>
    </div>

    <div v-if="isEditing" class="mermaid-editor">
      <textarea
        ref="codeTextarea"
        v-model="localCode"
        placeholder="Введите код Mermaid диаграммы..."
        class="mermaid-code-input"
        rows="8"
        @keydown.stop
        @keyup.stop
        @keypress.stop
      ></textarea>
      <div class="mermaid-hints">
        <strong>Примеры:</strong>
        graph TD; A-->B; B-->C; |
        sequenceDiagram; Alice->>Bob: Hello! |
        pie title Данные; "A": 30; "B": 70
      </div>
    </div>

    <div v-else class="mermaid-preview">
      <div v-if="loading" class="mermaid-loading">
        <i class="pi pi-spin pi-spinner"></i>
        <span>Рендеринг диаграммы...</span>
      </div>
      <div v-else-if="error" class="mermaid-error">
        <i class="pi pi-exclamation-triangle"></i>
        <span>{{ error }}</span>
      </div>
      <div v-else ref="svgContainer" class="mermaid-svg-container" v-html="renderedSvg"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'

const props = defineProps({
  code: {
    type: String,
    default: ''
  },
  embedEl: {
    type: Object,
    default: null
  }
})

const isEditing = ref(false)
const localCode = ref(props.code || '')
const renderedSvg = ref('')
const loading = ref(true)
const error = ref(null)
const svgContainer = ref(null)
const codeTextarea = ref(null)

let mermaid = null

// Dark mode detection via PrimeVue's app-dark class (same pattern as TechPyramidBlock.vue)
const appDark = ref(document.documentElement.classList.contains('app-dark'))
const isDark = computed(() => appDark.value)
const mermaidTheme = computed(() => isDark.value ? 'dark' : 'default')

// Load Mermaid from CDN (same pattern as genesis/MermaidDiagram.vue)
const loadMermaid = async () => {
  if (window.mermaid) {
    mermaid = window.mermaid
    return
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js'
    script.async = true
    script.onload = () => {
      mermaid = window.mermaid
      mermaid.initialize({
        startOnLoad: false,
        theme: mermaidTheme.value,
        securityLevel: 'loose',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis'
        }
      })
      resolve()
    }
    script.onerror = () => reject(new Error('Не удалось загрузить Mermaid'))
    document.head.appendChild(script)
  })
}

// Render diagram
const renderDiagram = async () => {
  if (!localCode.value || localCode.value.trim().length === 0) {
    error.value = 'Код диаграммы пуст'
    loading.value = false
    return
  }

  loading.value = true
  error.value = null

  try {
    if (!mermaid) {
      await loadMermaid()
    }

    const id = `mermaid-render-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const { svg } = await mermaid.render(id, localCode.value)
    renderedSvg.value = svg
    loading.value = false
  } catch (err) {
    console.error('[MermaidDiagramEmbed] Render error:', err)
    error.value = err.message || 'Ошибка рендеринга'
    loading.value = false
  }
}

// Toggle edit mode
const toggleEdit = () => {
  if (isEditing.value) {
    // Save and render
    updateEmbedAttribute()
    renderDiagram()
  } else {
    // Enter edit mode
    nextTick(() => {
      if (codeTextarea.value) {
        codeTextarea.value.focus()
      }
    })
  }
  isEditing.value = !isEditing.value
}

// Update the parent embed element's data attribute
const updateEmbedAttribute = () => {
  if (!props.embedEl) return

  try {
    const base64Code = btoa(unescape(encodeURIComponent(localCode.value)))
    props.embedEl.setAttribute('data-code-base64', base64Code)
    props.embedEl.dataset.value = JSON.stringify({ code: localCode.value })
  } catch (e) {
    console.error('[MermaidDiagramEmbed] Failed to update embed attribute:', e)
  }
}

// Remove diagram from editor
const removeDiagram = () => {
  if (props.embedEl) {
    props.embedEl.remove()
  }
}

// Initialize
onMounted(() => {
  // Watch for PrimeVue app-dark class changes (same pattern as TechPyramidBlock.vue)
  const obs = new MutationObserver(() => {
    nextTick(() => {
      appDark.value = document.documentElement.classList.contains('app-dark')
      // Re-render with new theme when dark mode changes
      if (mermaid && !isEditing.value) {
        mermaid.initialize({ startOnLoad: false, theme: mermaidTheme.value, securityLevel: 'loose' })
        renderDiagram()
      }
    })
  })
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  renderDiagram()
})

watch(() => props.code, (newCode) => {
  localCode.value = newCode
  if (!isEditing.value) {
    renderDiagram()
  }
})
</script>

<style scoped>
.mermaid-embed-wrapper {
  border: 2px solid var(--surface-border, #e5e7eb);
  border-radius: 8px;
  background: var(--surface-ground, #f9fafb);
  overflow: hidden;
  margin: 0.5rem 0;
}

.mermaid-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: var(--surface-card, #f7f7f5);
  border-bottom: 1px solid var(--surface-border, #e5e7eb);
}

.mermaid-toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--p-text-color, #374151);
}

.mermaid-toolbar-right {
  display: flex;
  gap: 0.5rem;
}

.mermaid-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mermaid-btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--surface-border, #d1d5db);
  border-radius: 4px;
  background: var(--surface-card, #f7f7f5);
  color: var(--p-text-color, #374151);
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.15s;
}

.mermaid-btn:hover {
  background: var(--surface-hover, #f3f4f6);
  border-color: var(--p-surface-400, #9ca3af);
}

.mermaid-btn-danger {
  color: var(--p-red-500, #dc2626);
}

.mermaid-btn-danger:hover {
  background: var(--p-red-50, #fee2e2);
  border-color: var(--p-red-300, #fca5a5);
}

.mermaid-editor {
  padding: 0.75rem;
}

.mermaid-code-input {
  width: 100%;
  min-height: 120px;
  padding: 0.75rem;
  border: 1px solid var(--surface-border, #d1d5db);
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
  background: var(--surface-card, #f7f7f5);
  color: var(--p-text-color, #374151);
}

.mermaid-code-input:focus {
  outline: none;
  border-color: var(--p-primary-color, #3b82f6);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--p-primary-color, #3b82f6) 15%, transparent);
}

.mermaid-hints {
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--p-yellow-50, #fef3c7);
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--p-yellow-900, #78350f);
  line-height: 1.6;
}

.mermaid-preview {
  padding: 1.5rem;
  background: var(--surface-card, #f7f7f5);
  min-height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mermaid-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--p-text-color-secondary, #6b7280);
  font-size: 0.9rem;
}

.mermaid-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--p-red-500, #dc2626);
  padding: 0.75rem;
  background: var(--p-red-50, #fee2e2);
  border-radius: 4px;
  font-size: 0.85rem;
}

.mermaid-svg-container {
  width: 100%;
  overflow-x: auto;
  display: flex;
  justify-content: center;
}

.mermaid-svg-container :deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
