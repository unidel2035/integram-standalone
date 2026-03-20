/**
 * Custom Quill Blot for Integram Tabs Embed
 *
 * Issue #6843: Universal tab-based component for displaying Integram tables
 * as table, cards, or charts views
 *
 * Embeds a Vue component (IntegramTabsEmbed.vue) that:
 * - Manages multiple tabs with different view types (table/cards/chart)
 * - Allows adding/removing tabs dynamically
 * - Persists tab configuration (typeId, viewType, viewConfig)
 * - Each tab can show data from a different Integram table
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class IntegramTabsBlot extends BlockEmbed {
  static blotName = 'integram-tabs'
  static tagName = 'div'
  static className = 'integram-tabs-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    // Store configuration
    node.setAttribute('data-database', value.database || 'my')

    // ISSUE #6871 FIX: Store block ID for metadata persistence
    if (value.blockId) {
      node.setAttribute('data-block-id', value.blockId)
    }

    // Store tabs array and active tab ID
    const tabs = value.tabs || []
    const activeTabId = value.activeTabId || (tabs.length > 0 ? tabs[0].id : null)
    const title = value.title || ''
    const hideHeader = value.hideHeader || false

    // Create unique ID
    const embedId = `integram-tabs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    node.setAttribute('data-embed-id', embedId)

    // Store full value as JSON (including database so Quill can restore it via value())
    node.dataset.value = JSON.stringify({
      database: value.database || 'my',
      tabs,
      activeTabId,
      title,
      hideHeader,
      blockId: value.blockId || null  // ISSUE #6871 FIX: Include blockId in saved value
    })

    // Create placeholder HTML
    const tabsCount = tabs.length
    const tabsDisplay = tabsCount > 0
      ? `${tabsCount} вкладк${tabsCount === 1 ? 'а' : (tabsCount < 5 ? 'и' : 'ок')}`
      : 'без вкладок'

    node.innerHTML = `
      <div class="integram-tabs-placeholder" id="${embedId}">
        <div class="tabs-header">
          <div class="tabs-header-left">
            <i class="pi pi-window-maximize"></i>
            <strong>${title || 'Вкладки Integram'}</strong>
            <span class="tabs-badge">${tabsDisplay}</span>
          </div>
          <button
            class="tabs-config-btn"
            data-tabs-action="config"
            data-embed-id="${embedId}"
            title="Настроить вкладки"
            style="margin-left:auto;padding:4px 10px;border:1px solid var(--surface-border, #cbd5e1);border-radius:6px;background:var(--p-content-background, var(--surface-card, #f8fafc));cursor:pointer;display:flex;align-items:center;gap:5px;font-size:12px;color:var(--p-text-muted-color, #64748b);"
          ><i class="pi pi-cog"></i> Настроить</button>
        </div>
        <div class="tabs-loading">
          <i class="pi pi-spin pi-spinner"></i> Загрузка компонента вкладок...
        </div>
      </div>
    `

    return node
  }

  static value(node) {
    try {
      const parsed = JSON.parse(node.dataset.value)
      // Backward compat: older JSON didn't include database — read from attribute
      if (!parsed.database) {
        parsed.database = node.getAttribute('data-database') || 'my'
      }
      // ISSUE #6871 FIX: Restore blockId from attribute if not in JSON
      if (!parsed.blockId) {
        parsed.blockId = node.getAttribute('data-block-id') || null
      }
      return parsed
    } catch (e) {
      return {
        database: node.getAttribute('data-database') || 'my',
        tabs: [],
        activeTabId: null,
        title: '',
        hideHeader: false,
        blockId: node.getAttribute('data-block-id') || null  // ISSUE #6871 FIX
      }
    }
  }
}

// Register blot
Quill.register(IntegramTabsBlot)

export { IntegramTabsBlot }
