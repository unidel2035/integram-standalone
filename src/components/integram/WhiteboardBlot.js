/**
 * Custom Quill Blot for embedding Whiteboard (Fabric.js canvas) in BlockDocumentEditor
 * Issue #6887: feat(block-editor): компонент Доска (Whiteboard)
 *
 * Data model (stored in data-value as JSON):
 * {
 *   "blockId": "wb-1708600000000",
 *   "height": 500,
 *   "canvasJSON": "{\"version\":\"6.7.1\",\"objects\":[...]}",
 *   "background": "white",
 *   "collaborative": false
 * }
 *
 * The actual WhiteboardBlock Vue component is mounted by BlockDocumentEditor's
 * remountEmbeddedComponents() — same pattern as SimpleTableBlot.
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class WhiteboardBlot extends BlockEmbed {
  static blotName = 'whiteboard'
  static tagName = 'div'
  static className = 'whiteboard-block-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    // Generate unique block ID if not provided
    const blockId = value?.blockId || `wb-${Date.now()}`
    const height = value?.height || 500
    const canvasJSON = value?.canvasJSON || null
    const background = value?.background || 'white'
    const collaborative = value?.collaborative || false

    // Store the data as JSON in data-value
    const data = {
      blockId,
      height,
      canvasJSON,
      background,
      collaborative
    }
    node.dataset.value = JSON.stringify(data)
    node.dataset.blockId = blockId
    node.dataset.height = height

    // Render a placeholder until the Vue component is mounted
    node.innerHTML = `
      <div class="whiteboard-placeholder" style="
        padding: 24px;
        border: 2px dashed var(--surface-border, #cbd5e1);
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        color: var(--p-text-muted-color, #64748b);
        font-family: Inter, system-ui, sans-serif;
        font-size: 14px;
        min-height: ${height}px;
        background: var(--p-content-background, var(--surface-card, #f8fafc));
      ">
        <i class="pi pi-pencil" style="font-size: 2rem; color: var(--p-primary-color, #6366f1);"></i>
        <span style="font-weight: 500; color: var(--text-color, #1e293b);">🎨 Доска для рисования</span>
        <span style="font-size: 12px;">Загрузка Whiteboard...</span>
      </div>
    `

    return node
  }

  static value(node) {
    try {
      return JSON.parse(node.dataset.value)
    } catch (e) {
      return {
        blockId: node.dataset.blockId || `wb-${Date.now()}`,
        height: parseInt(node.dataset.height) || 500,
        canvasJSON: null,
        background: 'white',
        collaborative: false
      }
    }
  }
}

Quill.register(WhiteboardBlot)

export { WhiteboardBlot }
