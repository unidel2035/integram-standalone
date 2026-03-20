/**
 * Custom Quill Blot for embedding Integram tables as interactive components
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class IntegramTableBlot extends BlockEmbed {
  static blotName = 'integram-table'
  static tagName = 'div'
  static className = 'integram-table-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')
    node.setAttribute('data-database', value.database)
    node.setAttribute('data-table-id', value.tableId)
    node.setAttribute('data-table-name', value.tableName)
    // Issue #6533: Support for full-fledged table mode
    node.setAttribute('data-table-mode', value.mode || 'simple')
    // Issue #6474: filterParent for scenario constructor
    if (value.filterParent) {
      node.setAttribute('data-filter-parent', value.filterParent)
    }
    // Issue #6769: Selector binding
    if (value.selectorName) {
      node.setAttribute('data-selector-name', value.selectorName)
    }
    if (value.selectorColumnId) {
      node.setAttribute('data-selector-column-id', value.selectorColumnId)
    }

    // Create a unique ID for this embed
    const embedId = `integram-table-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    node.setAttribute('data-embed-id', embedId)

    // Store the value for later retrieval
    node.dataset.value = JSON.stringify(value)

    // Create a placeholder that will be replaced by Vue component
    const modeLabel = value.mode === 'full' ? 'Полная таблица' : 'Простой просмотр'
    node.innerHTML = `
      <div class="integram-table-placeholder" id="${embedId}">
        <div class="flex align-items-center gap-2 mb-2">
          <i class="pi pi-table text-primary"></i>
          <h4 class="m-0 text-primary">📊 Таблица Integram: ${value.tableName}</h4>
          ${value.mode === 'full' ? '<span class="mode-badge full-mode">Полный режим</span>' : ''}
        </div>
        <div class="text-sm text-color-secondary">
          <div><strong>База данных:</strong> ${value.database}</div>
          <div><strong>ID таблицы:</strong> ${value.tableId}</div>
          <div><strong>Режим:</strong> ${modeLabel}</div>
        </div>
        <div class="mt-3 loading-indicator">
          <i class="pi pi-spin pi-spinner"></i> Загрузка данных таблицы...
        </div>
      </div>
    `

    return node
  }

  static value(node) {
    try {
      const val = JSON.parse(node.dataset.value)
      // Ensure filterParent is captured from DOM attribute too
      if (!val.filterParent && node.getAttribute('data-filter-parent')) {
        val.filterParent = node.getAttribute('data-filter-parent')
      }
      // Issue #6769: Capture selector binding from DOM attributes (may be set after creation)
      if (!val.selectorName && node.getAttribute('data-selector-name')) {
        val.selectorName = node.getAttribute('data-selector-name')
      }
      if (!val.selectorColumnId && node.getAttribute('data-selector-column-id')) {
        val.selectorColumnId = node.getAttribute('data-selector-column-id')
      }
      return val
    } catch (e) {
      return {
        database: node.getAttribute('data-database'),
        tableId: node.getAttribute('data-table-id'),
        tableName: node.getAttribute('data-table-name'),
        mode: node.getAttribute('data-table-mode') || 'simple',
        filterParent: node.getAttribute('data-filter-parent') || '',
        selectorName: node.getAttribute('data-selector-name') || null,
        selectorColumnId: node.getAttribute('data-selector-column-id') || null
      }
    }
  }
}

class IntegramReportBlot extends BlockEmbed {
  static blotName = 'integram-report'
  static tagName = 'div'
  static className = 'integram-report-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')
    node.setAttribute('data-database', value.database)
    node.setAttribute('data-report-id', value.reportId)

    // Create a unique ID for this embed
    const embedId = `integram-report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    node.setAttribute('data-embed-id', embedId)

    // Store the value for later retrieval
    node.dataset.value = JSON.stringify(value)

    // Create a placeholder that will be replaced by Vue component
    node.innerHTML = `
      <div class="integram-report-placeholder" id="${embedId}">
        <div class="flex align-items-center gap-2 mb-2">
          <i class="pi pi-chart-bar text-primary"></i>
          <h4 class="m-0 text-primary">📈 Отчёт Integram #${value.reportId}</h4>
        </div>
        <div class="text-sm text-color-secondary">
          <div><strong>База данных:</strong> ${value.database}</div>
          <div><strong>ID отчёта:</strong> ${value.reportId}</div>
        </div>
        <div class="mt-3 loading-indicator">
          <i class="pi pi-spin pi-spinner"></i> Загрузка данных отчёта...
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
        database: node.getAttribute('data-database'),
        reportId: node.getAttribute('data-report-id')
      }
    }
  }
}

// Register custom blots
Quill.register(IntegramTableBlot)
Quill.register(IntegramReportBlot)

export { IntegramTableBlot, IntegramReportBlot }
