/**
 * Custom Quill Blot for embedding Domain Block editor (Issue #6583)
 * Inline block with its own mini-editor, slash menu, and scenario filter.
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class DomainBlockBlot extends BlockEmbed {
  static blotName = 'domain-block'
  static tagName = 'div'
  static className = 'domain-block-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')
    node.setAttribute('data-scenario-id', value.scenarioId || '')
    node.setAttribute('data-scenario-name', value.scenarioName || '')
    node.setAttribute('data-takt-filter', value.taktFilter || '')

    const embedId = `domain-block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    node.setAttribute('data-embed-id', embedId)
    node.dataset.value = JSON.stringify(value)

    node.innerHTML = `
      <div class="domain-block-placeholder" id="${embedId}">
        <div class="flex align-items-center gap-2 mb-2">
          <i class="pi pi-book text-primary"></i>
          <h4 class="m-0 text-primary">Доменные блоки: ${value.scenarioName || 'Сценарий'}</h4>
        </div>
        <div class="text-sm text-color-secondary">
          <div><strong>Сценарий:</strong> ${value.scenarioName || value.scenarioId}</div>
          ${value.taktFilter ? `<div><strong>Такт:</strong> ${value.taktFilter}</div>` : ''}
        </div>
        <div class="mt-3 loading-indicator">
          <i class="pi pi-spin pi-spinner"></i> Загрузка доменных блоков...
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
        scenarioId: node.getAttribute('data-scenario-id'),
        scenarioName: node.getAttribute('data-scenario-name'),
        taktFilter: node.getAttribute('data-takt-filter')
      }
    }
  }
}

Quill.register(DomainBlockBlot)

export { DomainBlockBlot }
