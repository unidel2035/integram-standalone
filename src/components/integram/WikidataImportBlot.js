/**
 * WikidataImportBlot — Quill blot for embedding WikidataImportBlock in BlockDocumentEditor
 *
 * Allows users to trigger a Wikidata → Integram drone import directly from a document.
 * Pattern: same as DroneResearchBlot / OsintBlot — placeholder DOM node with data attributes,
 * actual Vue component is mounted by BlockDocumentEditor's remountEmbeddedComponents().
 *
 * Issue #7193: Wikidata Drone Import
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class WikidataImportBlot extends BlockEmbed {
  static blotName = 'wikidata_import_embed'
  static tagName = 'div'
  static className = 'wikidata-import-blot'

  static create(value = {}) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    node.dataset.value = JSON.stringify({
      limit: value.limit || 500,
      status: 'idle',
      lastResult: null
    })

    node.innerHTML = `
      <div class="wikidata-import-placeholder" style="
        padding: 16px;
        border: 1px dashed var(--p-blue-300, #93c5fd);
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--p-primary-color, #3b82f6);
        font-family: Inter, system-ui, sans-serif;
        font-size: 13px;
        background: var(--p-primary-50, #eff6ff);
      ">
        <i class="pi pi-spin pi-spinner" style="font-size: 1.2rem;"></i>
        <span>Импорт БПЛА из Wikidata — загрузка...</span>
      </div>
    `

    return node
  }

  static value(node) {
    try {
      return JSON.parse(node.dataset.value)
    } catch {
      return { limit: 500, status: 'idle', lastResult: null }
    }
  }
}

export { WikidataImportBlot }
