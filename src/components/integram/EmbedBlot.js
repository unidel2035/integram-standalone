/**
 * Custom Quill Blot for universal embed block in BlockDocumentEditor
 * Issue #6886: Компонент Embed — вставка внешнего контента по ссылке
 *
 * This blot creates a placeholder DOM node with data attributes.
 * The actual EmbedBlock Vue component is mounted by BlockDocumentEditor's
 * mountEmbedComponent() function.
 *
 * Supports: Figma, YouTube, Telegram, Google Docs, GitHub Gist, and many more providers.
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

// Helper function to generate unique IDs
const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

/**
 * EmbedBlot - Placeholder blot for universal embed component
 */
class EmbedBlot extends BlockEmbed {
  static blotName = 'coda-embed'
  static tagName = 'div'
  static className = 'embed-block-placeholder'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    // Default values
    const url = value?.url || ''
    const provider = value?.provider || null
    const height = value?.height || 400
    const width = value?.width || '100%'
    const title = value?.title !== false
    const link = value?.link !== false
    const embedTitle = value?.embedTitle || ''
    const editMode = value?.editMode === true

    // Generate unique ID for this embed
    const embedId = value?.embedId || generateId('embed')
    node.setAttribute('data-embed-id', embedId)

    // Store data as JSON in data-value attribute
    const embedData = {
      url,
      provider,
      height,
      width,
      title,
      link,
      embedTitle,
      editMode
    }
    node.setAttribute('data-value', JSON.stringify(embedData))

    // Also set individual attributes for easy access
    node.setAttribute('data-url', url)
    if (provider) {
      node.setAttribute('data-provider', provider)
    }
    node.setAttribute('data-height', height.toString())
    node.setAttribute('data-width', width)
    node.setAttribute('data-title', title.toString())
    node.setAttribute('data-link', link.toString())
    if (editMode) {
      node.setAttribute('data-edit-mode', 'true')
    }

    // Build placeholder HTML (loading spinner, replaced by Vue component via mountEmbedComponent)
    const safeUrl = url ? url.replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''

    // Show different placeholder based on state
    if (editMode || !url) {
      // Edit mode or empty - show input placeholder
      node.innerHTML = `<div class="embed-placeholder-edit">
        <div class="embed-placeholder-icon">
          <i class="pi pi-link" style="font-size: 2rem; color: var(--primary-color);"></i>
        </div>
        <div class="embed-placeholder-text">
          <p style="margin: 8px 0; font-weight: 600;">Вставить embed-контент</p>
          <p style="margin: 4px 0; color: var(--text-color-secondary); font-size: 0.9rem;">
            Загрузка компонента...
          </p>
        </div>
      </div>`
    } else {
      // View mode - show loading spinner
      node.innerHTML = `<div class="embed-placeholder-loading">
        <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem; margin-right: 8px;"></i>
        <span>Загрузка embed: ${safeUrl.substring(0, 50)}${safeUrl.length > 50 ? '...' : ''}</span>
      </div>`
    }

    return node
  }

  static value(node) {
    try {
      const dataValue = node.getAttribute('data-value')
      if (dataValue) {
        return JSON.parse(dataValue)
      }
    } catch (e) {
      console.warn('EmbedBlot: Failed to parse data-value:', e)
    }

    // Fallback to reading individual attributes
    return {
      url: node.getAttribute('data-url') || '',
      provider: node.getAttribute('data-provider') || null,
      height: parseInt(node.getAttribute('data-height')) || 400,
      width: node.getAttribute('data-width') || '100%',
      title: node.getAttribute('data-title') !== 'false',
      link: node.getAttribute('data-link') !== 'false',
      embedTitle: node.getAttribute('data-embed-title') || '',
      editMode: node.getAttribute('data-edit-mode') === 'true'
    }
  }

  remove() {
    // Vue app cleanup happens in BlockDocumentEditor via mountedComponents
    super.remove()
  }
}

// Register custom blot
Quill.register(EmbedBlot)

export { EmbedBlot }
