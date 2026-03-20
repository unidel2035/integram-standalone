/**
 * DrononomicsBlot — Quill blot for embedding Drononomics simulation in block editor
 */

import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class DrononomicsBlot extends BlockEmbed {
  static blotName = 'drononomics_embed'
  static tagName = 'div'
  static className = 'drononomics-blot'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const scenario = value?.scenario || 'default'
    const region = value?.region || ''
    const speed = value?.speed || 1
    const mode = value?.mode || 'mini' // mini | full | leontief

    node.setAttribute('data-scenario', scenario)
    node.setAttribute('data-region', region)
    node.setAttribute('data-speed', String(speed))
    node.setAttribute('data-mode', mode)
    node.dataset.value = JSON.stringify({ scenario, region, speed, mode })

    node.innerHTML = `
      <div class="drononomics-placeholder" style="
        height: 320px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--p-surface-900, #1a1a2e) 0%, var(--p-surface-800, #16213e) 50%, var(--p-surface-700, #0f3460) 100%);
        border-radius: 12px;
        color: var(--p-text-muted-color, #8892b0);
        gap: 12px;
        font-size: 14px;
      ">
        <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem; color: var(--p-primary-color, #64ffda);"></i>
        <span>Дронономика — загрузка...</span>
      </div>
    `

    return node
  }

  static value(node) {
    try {
      return JSON.parse(node.dataset.value)
    } catch (e) {
      return {
        scenario: node.getAttribute('data-scenario') || 'default',
        region: node.getAttribute('data-region') || '',
        speed: parseInt(node.getAttribute('data-speed')) || 1,
        mode: node.getAttribute('data-mode') || 'mini',
      }
    }
  }
}

Quill.register(DrononomicsBlot)
export { DrononomicsBlot }
