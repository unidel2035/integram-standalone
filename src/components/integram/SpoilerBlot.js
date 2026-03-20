/**
 * Custom Quill Blot for embedding spoiler/collapsible containers
 * Issue #6850: Spoiler component for block editor
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class SpoilerBlot extends BlockEmbed {
  static blotName = 'spoiler-embed'
  static tagName = 'div'
  static className = 'spoiler-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')
    node.setAttribute('data-title', value.title || 'Нажмите, чтобы развернуть')
    node.setAttribute('data-default-open', value.defaultOpen ? 'true' : 'false')
    node.setAttribute('data-open', value.defaultOpen ? 'true' : 'false')

    // Store nested content HTML
    const content = value.content || ''
    node.setAttribute('data-content', content)

    // Create a unique ID for this embed
    const embedId = `spoiler-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    node.setAttribute('data-embed-id', embedId)

    // Store the value for later retrieval
    node.dataset.value = JSON.stringify(value)

    // Create a placeholder that will be replaced by Vue component
    const icon = value.defaultOpen ? '▼' : '▶'
    const openClass = value.defaultOpen ? 'open' : 'closed'

    node.innerHTML = `
      <div class="spoiler-placeholder ${openClass}" id="${embedId}">
        <div class="spoiler-placeholder-header">
          <span class="spoiler-icon">${icon}</span>
          <span class="spoiler-title-text">${value.title || 'Нажмите, чтобы развернуть'}</span>
          <i class="pi pi-cog spoiler-settings-icon"></i>
        </div>
        <div class="spoiler-placeholder-content" style="display: ${value.defaultOpen ? 'block' : 'none'}">
          <div class="spoiler-content-area">
            <p class="text-color-secondary">
              <i class="pi pi-info-circle"></i>
              Внутрь спойлера можно вставлять любые компоненты: таблицы, отчёты, карты, текст...
            </p>
          </div>
        </div>
      </div>
    `

    return node
  }

  static value(node) {
    try {
      const val = JSON.parse(node.dataset.value)
      // Update from DOM attributes (may be changed by user)
      const title = node.getAttribute('data-title')
      const defaultOpen = node.getAttribute('data-default-open') === 'true'
      const isOpen = node.getAttribute('data-open') === 'true'
      const content = node.getAttribute('data-content') || ''

      return {
        ...val,
        title: title || val.title,
        defaultOpen: defaultOpen !== undefined ? defaultOpen : val.defaultOpen,
        isOpen: isOpen !== undefined ? isOpen : val.isOpen,
        content: content || val.content || ''
      }
    } catch (e) {
      return {
        title: node.getAttribute('data-title') || 'Нажмите, чтобы развернуть',
        defaultOpen: node.getAttribute('data-default-open') === 'true',
        isOpen: node.getAttribute('data-open') === 'true',
        content: node.getAttribute('data-content') || ''
      }
    }
  }
}

// Register custom blot
Quill.register(SpoilerBlot)

export { SpoilerBlot }
