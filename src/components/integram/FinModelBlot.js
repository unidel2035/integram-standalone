/**
 * Custom Quill Blot for embedding FinModelBlock in BlockDocumentEditor
 * Issue #6975: FinModel Pack — встраиваемый компонент финансового моделирования
 *
 * This blot creates a placeholder DOM node with data attributes.
 * The actual FinModelBlock Vue component is mounted by BlockDocumentEditor's
 * remountEmbeddedComponents() — same pattern as TechPyramidBlot / MapBlot.
 *
 * Issue #7043: blotName renamed from 'fin-model' → 'fin_model_embed' and
 * className from 'fin-model-embed' → 'fin-model-blot' to fix Quill serialization.
 * Quill failed to recognize the hyphenated 'fin-model' blotName during
 * HTML→Delta clipboard conversion on reload, converting the embed to a plain
 * paragraph and losing all data-attributes (same root cause as #7037).
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class FinModelBlot extends BlockEmbed {
  static blotName = 'fin_model_embed'
  static tagName = 'div'
  static className = 'fin-model-blot'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const modelId = value?.modelId || ''
    const database = value?.database || 'fm'
    const server = value?.server || 'ai2o.ru'

    node.setAttribute('data-model-id', String(modelId))
    node.setAttribute('data-database', database)
    node.setAttribute('data-server', server)
    node.dataset.value = JSON.stringify({ modelId, database, server })

    node.innerHTML = `
      <div class="fin-model-placeholder" style="height:480px;background:var(--p-surface-ground,#f9fafb);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--p-text-color-secondary,#94a3b8);gap:10px;font-family:Inter,system-ui,sans-serif;font-size:13px;">
        <i class="pi pi-spin pi-spinner" style="font-size:1.5rem;"></i>
        <span>Загрузка финансовой модели…</span>
      </div>
    `

    return node
  }

  static value(node) {
    try {
      return JSON.parse(node.dataset.value)
    } catch (e) {
      return {
        modelId: node.getAttribute('data-model-id') || '',
        database: node.getAttribute('data-database') || 'fm',
        server: node.getAttribute('data-server') || 'ai2o.ru'
      }
    }
  }
}

Quill.register(FinModelBlot)

export { FinModelBlot }
