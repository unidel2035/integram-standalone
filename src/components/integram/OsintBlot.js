/**
 * Custom Quill Blot for embedding OsintBlock in BlockDocumentEditor
 * Issue #7157: BlockDependencyStore — unified reactive block system
 *
 * This blot creates a placeholder DOM node with data attributes.
 * The actual OsintBlock Vue component is mounted by BlockDocumentEditor's
 * remountEmbeddedComponents() — same pattern as FinModelBlot / EcosystemBlot.
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class OsintBlot extends BlockEmbed {
  static blotName = 'osint_embed'
  static tagName = 'div'
  static className = 'osint-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const source = value?.source || '' // chyxx | qianzhan | all
    const keyword = value?.keyword || '无人机'
    const mode = value?.mode || 'dashboard' // dashboard | articles | metrics

    node.setAttribute('data-source', source)
    node.setAttribute('data-keyword', keyword)
    node.setAttribute('data-mode', mode)
    node.dataset.value = JSON.stringify({ source, keyword, mode })

    node.innerHTML = `
      <div class="osint-placeholder" style="height:400px;background:var(--p-surface-ground,#f9fafb);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--p-text-color-secondary,#94a3b8);gap:10px;font-family:Inter,system-ui,sans-serif;font-size:13px;">
        <i class="pi pi-spin pi-spinner" style="font-size:1.5rem;"></i>
        <span>Загрузка OSINT-дашборда…</span>
      </div>
    `

    return node
  }

  static value(node) {
    try {
      return JSON.parse(node.dataset.value)
    } catch (e) {
      return {
        source: node.getAttribute('data-source') || '',
        keyword: node.getAttribute('data-keyword') || '无人机',
        mode: node.getAttribute('data-mode') || 'dashboard'
      }
    }
  }
}

Quill.register(OsintBlot)

export { OsintBlot }
