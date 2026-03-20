/**
 * DroneResearchBlot — Quill blot for embedding DroneResearch block in BlockDocumentEditor
 *
 * Allows users to search the internet for UAV/drone specs, extract TTX via LLM,
 * save knowledge to KAG, and persist structured data to an Integram kval table.
 *
 * Pattern: same as OsintBlot / DrononomicsBlot — placeholder DOM node with data attributes,
 * actual Vue component is mounted by BlockDocumentEditor's remountEmbeddedComponents().
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class DroneResearchBlot extends BlockEmbed {
  static blotName = 'drone_research_embed'
  static tagName = 'div'
  static className = 'drone-research-blot'

  static create(value = {}) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    node.dataset.value = JSON.stringify({
      query: value.query || '',
      modelId: value.modelId || 'kodacode/KodaAgent',
      accessToken: value.accessToken || '',
      tableId: value.tableId || null,
      database: value.database || 'kval',
      maxResults: value.maxResults || 5,
      enrich: value.enrich !== false,
      status: 'idle',
      lastResult: null
    })

    node.innerHTML = `
      <div class="drone-research-placeholder" style="
        padding: 16px;
        border: 1px solid var(--surface-border, #e5e7eb);
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--p-text-muted-color, #6b7280);
        font-family: Inter, system-ui, sans-serif;
        font-size: 13px;
        background: var(--p-content-background, var(--surface-card, #f9fafb));
      ">
        <i class="pi pi-spin pi-spinner" style="font-size: 1.2rem;"></i>
        <span>Поиск БПЛА — загрузка...</span>
      </div>
    `

    return node
  }

  static value(node) {
    try {
      return JSON.parse(node.dataset.value)
    } catch {
      return {
        query: '',
        modelId: 'kodacode/KodaAgent',
        accessToken: '',
        tableId: null,
        database: 'kval',
        maxResults: 5,
        enrich: true,
        status: 'idle',
        lastResult: null
      }
    }
  }
}

Quill.register(DroneResearchBlot)

export { DroneResearchBlot }
