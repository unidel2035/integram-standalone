/**
 * Custom Quill Blot for embedding Calendar (FullCalendar) in BlockDocumentEditor
 * Issue #6879: Компонент Календарь — отображение событий из таблицы Integram
 *
 * This blot creates a placeholder DOM node with data attributes.
 * The actual FullCalendar Vue component is mounted by BlockDocumentEditor's
 * remountEmbeddedComponents() — same pattern as maps, tables, mermaid.
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

// Helper function to generate unique IDs
const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

/**
 * CalendarBlot - Placeholder blot for FullCalendar component
 */
class CalendarBlot extends BlockEmbed {
  static blotName = 'coda-calendar'
  static tagName = 'div'
  static className = 'coda-calendar-block'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    // Default values
    const database = value?.database || 'kval'
    const typeId = value?.typeId || null
    const dateField = value?.dateField || null
    const endDateField = value?.endDateField || null
    const titleField = value?.titleField || null
    const colorField = value?.colorField || null
    const defaultView = value?.defaultView || 'dayGridMonth'
    const color = value?.color || '#4CAF50'
    const height = value?.height || 600

    // Generate unique ID for this calendar
    const embedId = generateId('calendar')
    node.setAttribute('data-embed-id', embedId)

    // Store data as JSON in data-value attribute
    const calendarData = {
      database,
      typeId,
      dateField,
      endDateField,
      titleField,
      colorField,
      defaultView,
      color,
      height
    }
    node.setAttribute('data-value', JSON.stringify(calendarData))

    // Build placeholder HTML (loading spinner, replaced by Vue component via remountEmbeddedComponents)
    const dbBadge = database && typeId
      ? `<span class="calendar-db-badge" title="Данные из БД: ${database}"><i class="pi pi-database"></i> ${database}</span>`
      : ''

    // No leading whitespace — avoids text-node gap at top of block embed
    node.innerHTML = `<div class="calendar-block-wrapper"><div class="calendar-block-header"><i class="pi pi-calendar"></i><span class="calendar-block-title">Календарь</span>${dbBadge}</div><div class="calendar-block-container" style="height:${height}px;position:relative;"><div class="calendar-placeholder-loading" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-color-secondary);"><i class="pi pi-spin pi-spinner" style="font-size:2rem;margin-right:8px;"></i><span>Загрузка календаря…</span></div></div><div class="calendar-resize-handle"><div class="calendar-resize-grip"></div></div><div class="calendar-block-controls"><button class="calendar-control-btn config-btn" data-calendar-action="config" data-embed-id="${embedId}" title="Настроить календарь"><i class="pi pi-cog"></i></button></div></div>`

    return node
  }

  static value(node) {
    try {
      const dataValue = node.getAttribute('data-value')
      if (dataValue) {
        return JSON.parse(dataValue)
      }
    } catch (e) {
      console.warn('CalendarBlot: Failed to parse data-value:', e)
    }

    // Fallback defaults
    return {
      database: 'kval',
      typeId: null,
      dateField: null,
      endDateField: null,
      titleField: null,
      colorField: null,
      defaultView: 'dayGridMonth',
      color: '#4CAF50',
      height: 600
    }
  }

  remove() {
    // Vue app cleanup happens in BlockDocumentEditor via mountedComponents
    super.remove()
  }
}

export { CalendarBlot }
