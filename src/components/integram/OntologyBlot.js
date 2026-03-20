/**
 * Custom Quill Blot for embedding OntologyBlock in BlockDocumentEditor
 * Issue #7157: BlockDependencyStore — unified reactive block system
 *
 * This blot creates a placeholder DOM node with data attributes.
 * The actual OntologyBlock Vue component is mounted by BlockDocumentEditor's
 * remountEmbeddedComponents() — same pattern as FinModelBlot / EcosystemBlot.
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class OntologyBlot extends BlockEmbed {
  static blotName = 'ontology_embed'
  static tagName = 'div'
  static className = 'ontology-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const database = value?.database || 'kval'
    const server = value?.server || 'ai2o.ru'
    const mode = value?.mode || 'tree' // tree | graph | table
    const rootConceptId = value?.rootConceptId || ''

    node.setAttribute('data-database', database)
    node.setAttribute('data-server', server)
    node.setAttribute('data-mode', mode)
    node.setAttribute('data-root-concept-id', String(rootConceptId))
    node.dataset.value = JSON.stringify({ database, server, mode, rootConceptId })

    node.innerHTML = `
      <div class="ontology-placeholder" style="height:400px;background:var(--p-surface-ground,#f9fafb);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--p-text-color-secondary,#94a3b8);gap:10px;font-family:Inter,system-ui,sans-serif;font-size:13px;">
        <i class="pi pi-spin pi-spinner" style="font-size:1.5rem;"></i>
        <span>Загрузка онтологии БПЛА…</span>
      </div>
    `

    return node
  }

  static value(node) {
    try {
      return JSON.parse(node.dataset.value)
    } catch (e) {
      return {
        database: node.getAttribute('data-database') || 'kval',
        server: node.getAttribute('data-server') || 'ai2o.ru',
        mode: node.getAttribute('data-mode') || 'tree',
        rootConceptId: node.getAttribute('data-root-concept-id') || ''
      }
    }
  }
}

Quill.register(OntologyBlot)

export { OntologyBlot }
