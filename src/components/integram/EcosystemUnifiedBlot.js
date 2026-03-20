/**
 * EcosystemUnifiedBlot — Quill blot for embedding Unified Ecosystem view in block editor
 */

import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class EcosystemUnifiedBlot extends BlockEmbed {
  static blotName = 'ecosystem_unified_embed'
  static tagName = 'div'
  static className = 'ecosystem-unified-blot'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const tab = value?.tab || 'models'
    const height = value?.height || 600

    node.setAttribute('data-tab', tab)
    node.setAttribute('data-height', String(height))
    node.dataset.value = JSON.stringify({ tab, height })

    node.innerHTML = `
      <div class="ecosystem-unified-placeholder" style="
        height: ${height}px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: var(--p-content-background, var(--surface-card, #f8f9fa));
        border: 2px dashed var(--p-surface-400, #adb5bd);
        border-radius: 12px;
        color: var(--p-text-muted-color, #6c757d);
        gap: 12px;
        font-size: 14px;
      ">
        <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem; color: var(--p-primary-color, #2E86C1);"></i>
        <span>Экосистема БАС — загрузка...</span>
      </div>
    `

    return node
  }

  static value(node) {
    try {
      return JSON.parse(node.dataset.value)
    } catch (e) {
      return {
        tab: node.getAttribute('data-tab') || 'models',
        height: parseInt(node.getAttribute('data-height')) || 600,
      }
    }
  }
}

Quill.register(EcosystemUnifiedBlot)
export { EcosystemUnifiedBlot }
