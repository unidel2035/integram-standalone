/**
 * Custom Quill Blot for embedding EventEngine DashboardPanel in BlockDocumentEditor
 *
 * Embeds the event ontology dashboard (DashboardPanel) directly in a document.
 * Uses the same mount pattern as OntologyBlot / OsintBlot.
 *
 * HTML: <div class="event-engine-embed" data-mode="dashboard" data-height="600"></div>
 *
 * Modes:
 *   dashboard — DashboardPanel (overview: stat cards, recent events, concept breakdown)
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class EventEngineBlot extends BlockEmbed {
  static blotName = 'event_engine_embed'
  static tagName = 'div'
  static className = 'event-engine-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const mode   = value?.mode   || 'dashboard'
    const height = value?.height || 600

    node.setAttribute('data-mode', mode)
    node.setAttribute('data-height', String(height))
    node.dataset.value = JSON.stringify({ mode, height })

    node.innerHTML = `
      <div style="height:${height}px;background:var(--p-surface-ground,#f9fafb);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--p-text-color-secondary,#94a3b8);gap:10px;font-family:Inter,system-ui,sans-serif;font-size:13px;">
        <i class="pi pi-spin pi-spinner" style="font-size:1.5rem;"></i>
        <span>Загрузка событийной онтологии…</span>
      </div>
    `
    return node
  }

  static value(node) {
    try {
      return JSON.parse(node.dataset.value)
    } catch {
      return {
        mode:   node.getAttribute('data-mode')   || 'dashboard',
        height: parseInt(node.getAttribute('data-height')) || 600
      }
    }
  }
}

Quill.register(EventEngineBlot)

export { EventEngineBlot }
