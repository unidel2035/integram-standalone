/**
 * Custom Quill Blot for embedding Integram charts
 * Issue #6587: Interactive chart block with table selection and Chart.js rendering
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class IntegramChartBlot extends BlockEmbed {
  static blotName = 'integram-chart'
  static tagName = 'div'
  static className = 'integram-chart-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    // Store chart configuration
    node.setAttribute('data-database', value.database || 'my')
    node.setAttribute('data-type-id', value.typeId || '')
    node.setAttribute('data-chart-type', value.chartType || 'bar')
    node.setAttribute('data-label-field', value.labelField || '')
    node.setAttribute('data-value-field', value.valueField || '')
    node.setAttribute('data-title', value.title || 'Диаграмма Integram')
    node.setAttribute('data-height', value.height || '400')

    // Create a unique ID for this embed
    const embedId = `integram-chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    node.setAttribute('data-embed-id', embedId)

    // Store the value for later retrieval
    node.dataset.value = JSON.stringify(value)

    // Create placeholder that will be replaced by Vue component
    const chartTypeName = {
      'bar': 'Столбчатая',
      'line': 'Линейная',
      'pie': 'Круговая',
      'doughnut': 'Кольцевая',
      'radar': 'Радар',
      'polarArea': 'Полярная область'
    }[value.chartType] || 'Диаграмма'

    const hasData = value.typeId && value.labelField && value.valueField

    node.innerHTML = `
      <div class="integram-chart-placeholder" id="${embedId}">
        <div class="chart-header">
          <div class="flex align-items-center gap-2">
            <i class="pi pi-chart-bar text-primary"></i>
            <h4 class="m-0 text-primary">📊 ${value.title || 'Диаграмма Integram'}</h4>
          </div>
          <div class="chart-actions">
            <button class="chart-btn chart-btn-config" data-action="configure" data-chart-id="${embedId}" title="Настроить">
              <i class="pi pi-cog"></i>
            </button>
            ${hasData ? `
            <button class="chart-btn chart-btn-refresh" data-action="refresh" data-chart-id="${embedId}" title="Обновить данные">
              <i class="pi pi-refresh"></i>
            </button>` : ''}
          </div>
        </div>
        ${hasData ? `
        <div class="chart-info">
          <div class="text-sm text-color-secondary">
            <div><strong>База данных:</strong> ${value.database || 'my'}</div>
            <div><strong>Таблица:</strong> ${value.typeName || `ID ${value.typeId}`}</div>
            <div><strong>Тип:</strong> ${chartTypeName}</div>
          </div>
        </div>
        <div class="chart-canvas-wrapper" style="height: ${value.height}px;">
          <canvas id="chart-canvas-${embedId}"></canvas>
        </div>
        <div class="chart-loading" data-chart-loading="${embedId}" style="display: none;">
          <i class="pi pi-spin pi-spinner"></i> Загрузка данных...
        </div>` : `
        <div class="chart-empty-state">
          <i class="pi pi-chart-line" style="font-size: 3rem; color: var(--surface-400);"></i>
          <p>Нажмите "Настроить" для выбора таблицы и построения графика</p>
        </div>`}
      </div>
    `

    return node
  }

  static value(node) {
    try {
      return JSON.parse(node.dataset.value)
    } catch (e) {
      return {
        database: node.getAttribute('data-database') || 'my',
        typeId: node.getAttribute('data-type-id') || '',
        chartType: node.getAttribute('data-chart-type') || 'bar',
        labelField: node.getAttribute('data-label-field') || '',
        valueField: node.getAttribute('data-value-field') || '',
        title: node.getAttribute('data-title') || 'Диаграмма Integram',
        height: parseInt(node.getAttribute('data-height')) || 400
      }
    }
  }
}

// Register custom blot
Quill.register(IntegramChartBlot)

export { IntegramChartBlot }
