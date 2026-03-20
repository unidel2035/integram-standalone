/**
 * Custom Quill Blot for Selector blocks
 *
 * Issue #6769: Interactive dropdown selector that filters page components
 *
 * Embeds a Vue component (SelectorBlock.vue) that:
 * - Loads unique values from an Integram table field
 * - Updates global selectorStore when value changes
 * - Other components (tables, cards, maps, charts) read filters from store
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class SelectorBlot extends BlockEmbed {
  static blotName = 'selector'
  static tagName = 'div'
  static className = 'selector-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    // Store configuration
    node.setAttribute('data-name', value.name || 'selector')
    node.setAttribute('data-database', value.database || 'kval')
    node.setAttribute('data-type-id', value.typeId || '')
    node.setAttribute('data-requisite-id', value.requisiteId || '')
    node.setAttribute('data-placeholder', value.placeholder || 'Выберите значение')
    node.setAttribute('data-default-value', value.defaultValue || '')

    // Create unique ID
    const embedId = `selector-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    node.setAttribute('data-embed-id', embedId)

    // Store full value as JSON
    node.dataset.value = JSON.stringify(value)

    // Create placeholder HTML
    node.innerHTML = `
      <div class="selector-placeholder" id="${embedId}">
        <div class="selector-header">
          <i class="pi pi-filter"></i>
          <strong>Селектор: ${value.name}</strong>
          <button
            class="selector-config-btn"
            data-selector-action="config"
            data-embed-id="${embedId}"
            title="Настроить селектор"
            style="margin-left:auto;padding:4px 8px;border:1px solid var(--surface-border, #cbd5e1);border-radius:6px;background:var(--p-content-background, var(--surface-card, #f8fafc));cursor:pointer;display:flex;align-items:center;gap:4px;font-size:12px;color:var(--p-text-muted-color, #64748b);"
          ><i class="pi pi-cog"></i> Настроить</button>
        </div>
        <div class="selector-loading">
          <i class="pi pi-spin pi-spinner"></i> Инициализация селектора...
        </div>
      </div>
    `

    return node
  }

  static value(node) {
    try {
      return JSON.parse(node.dataset.value)
    } catch (e) {
      return {
        name: node.getAttribute('data-name') || 'selector',
        database: node.getAttribute('data-database') || 'kval',
        typeId: node.getAttribute('data-type-id') || '',
        requisiteId: node.getAttribute('data-requisite-id') || '',
        placeholder: node.getAttribute('data-placeholder') || 'Выберите значение',
        defaultValue: node.getAttribute('data-default-value') || ''
      }
    }
  }
}

// Register blot
Quill.register(SelectorBlot)

export { SelectorBlot }
