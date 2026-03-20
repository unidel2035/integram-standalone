/**
 * Custom Quill Blot for embedding TechPyramid in BlockDocumentEditor
 * Issue #6593: Пирамида технологического суверенитета как блок редактора
 *
 * This blot creates a placeholder DOM node with data attributes.
 * The actual TechPyramidBlock Vue component is mounted by BlockDocumentEditor's
 * remountEmbeddedComponents() — same pattern as MapBlot / DomainBlockBlot.
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class TechPyramidBlot extends BlockEmbed {
  static blotName = 'tech-pyramid'
  static tagName = 'div'
  static className = 'tech-pyramid-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const height = value?.height || 'normal'
    const showHeader = value?.showHeader !== false
    const showLegend = value?.showLegend !== false

    node.setAttribute('data-height', height)
    node.setAttribute('data-show-header', String(showHeader))
    node.setAttribute('data-show-legend', String(showLegend))
    node.dataset.value = JSON.stringify({ height, showHeader, showLegend })

    const heightPx = height === 'compact' ? '360px' : height === 'full' ? '680px' : '500px'
    node.innerHTML = `
      <div class="tech-pyramid-placeholder" style="height:${heightPx};background:var(--p-surface-900, #0a1628);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--p-text-muted-color, #94a3b8);gap:10px;font-family:Inter,system-ui,sans-serif;font-size:13px;">
        <i class="pi pi-spin pi-spinner" style="font-size:1.5rem;"></i>
        <span>Загрузка пирамиды технологий…</span>
      </div>
    `

    return node
  }

  static value(node) {
    try {
      return JSON.parse(node.dataset.value)
    } catch (e) {
      return {
        height: node.getAttribute('data-height') || 'normal',
        showHeader: node.getAttribute('data-show-header') !== 'false',
        showLegend: node.getAttribute('data-show-legend') !== 'false'
      }
    }
  }
}

Quill.register(TechPyramidBlot)

export { TechPyramidBlot }
