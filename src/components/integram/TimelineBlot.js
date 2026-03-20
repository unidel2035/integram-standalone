/**
 * Custom Quill Blot for embedding Timeline component (Issue #6880)
 * Gantt chart view showing Integram table rows as horizontal timeline bars
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class TimelineBlot extends BlockEmbed {
  static blotName = 'timeline'
  static tagName = 'div'
  static className = 'timeline-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')
    node.setAttribute('data-type', 'timeline')

    const embedId = `timeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    node.setAttribute('data-embed-id', embedId)
    node.dataset.value = JSON.stringify(value)

    // Set individual data attributes for easier access
    if (value.database) node.setAttribute('data-database', value.database)
    if (value.typeId) node.setAttribute('data-type-id', value.typeId)
    if (value.titleField) node.setAttribute('data-title-field', value.titleField)
    if (value.startDateField) node.setAttribute('data-start-date-field', value.startDateField)
    if (value.endDateField) node.setAttribute('data-end-date-field', value.endDateField)
    if (value.colorField) node.setAttribute('data-color-field', value.colorField)
    if (value.groupField) node.setAttribute('data-group-field', value.groupField)
    if (value.defaultScale) node.setAttribute('data-default-scale', value.defaultScale)
    if (value.color) node.setAttribute('data-color', value.color)

    node.innerHTML = `
      <div class="timeline-placeholder" id="${embedId}">
        <div class="flex align-items-center gap-2 mb-2">
          <i class="pi pi-calendar text-primary"></i>
          <h4 class="m-0 text-primary">${value.title || 'Таймлайн проекта'}</h4>
        </div>
        <div class="text-sm text-color-secondary">
          <div><strong>База данных:</strong> ${value.database || 'Не указана'}</div>
          <div><strong>Таблица:</strong> ${value.typeId || 'Не указана'}</div>
          <div><strong>Масштаб:</strong> ${value.defaultScale || 'week'}</div>
        </div>
        <div class="mt-3 loading-indicator">
          <i class="pi pi-spin pi-spinner"></i> Загрузка таймлайна...
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
        title: node.textContent || 'Таймлайн проекта',
        database: node.getAttribute('data-database'),
        typeId: node.getAttribute('data-type-id'),
        titleField: node.getAttribute('data-title-field'),
        startDateField: node.getAttribute('data-start-date-field'),
        endDateField: node.getAttribute('data-end-date-field'),
        colorField: node.getAttribute('data-color-field'),
        groupField: node.getAttribute('data-group-field'),
        defaultScale: node.getAttribute('data-default-scale') || 'week',
        color: node.getAttribute('data-color') || '#4361ee'
      }
    }
  }
}

Quill.register(TimelineBlot)

export { TimelineBlot }
