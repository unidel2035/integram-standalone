/**
 * Custom Quill Blot for embedding Mermaid diagrams
 * Stores diagram code as base64 in data attributes for safe HTML persistence
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class MermaidDiagramBlot extends BlockEmbed {
  static blotName = 'mermaid-diagram'
  static tagName = 'div'
  static className = 'mermaid-diagram-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    // Encode code to base64 for safe HTML storage
    const code = value.code || 'graph TD\n    A[Начало] --> B[Процесс]\n    B --> C[Результат]'
    const base64Code = btoa(unescape(encodeURIComponent(code)))
    node.setAttribute('data-code-base64', base64Code)

    // Create a unique ID for this embed
    const embedId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    node.setAttribute('data-embed-id', embedId)

    // Store the value for later retrieval
    node.dataset.value = JSON.stringify({ code })

    // Create a placeholder that will be replaced by Vue component
    node.innerHTML = `
      <div class="mermaid-diagram-placeholder" id="${embedId}">
        <div class="flex align-items-center gap-2 mb-2">
          <i class="pi pi-sitemap text-primary"></i>
          <h4 class="m-0 text-primary">Диаграмма Mermaid</h4>
        </div>
        <div class="mt-3 loading-indicator">
          <i class="pi pi-spin pi-spinner"></i> Загрузка диаграммы...
        </div>
      </div>
    `

    return node
  }

  static value(node) {
    // Try to read from base64 attribute first
    const base64Code = node.getAttribute('data-code-base64')
    if (base64Code) {
      try {
        const code = decodeURIComponent(escape(atob(base64Code)))
        return { code }
      } catch (e) {
        console.error('MermaidBlot: Failed to decode base64:', e)
      }
    }

    // Fallback to dataset.value
    try {
      return JSON.parse(node.dataset.value)
    } catch (e) {
      return { code: '' }
    }
  }
}

// Register custom blot
Quill.register(MermaidDiagramBlot)

export { MermaidDiagramBlot }
