/**
 * Custom Quill Blot for interactive button blocks
 * Stores button config as JSON in data-value; mounted by remountInteractiveButtons()
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class InteractiveButtonBlot extends BlockEmbed {
  static blotName = 'interactive-button'
  static tagName = 'div'
  static className = 'coda-interactive-button-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')
    node.dataset.value = JSON.stringify(value || {})

    const label = value?.label || 'Кнопка'
    const color = value?.color || '#3B82F6'

    node.innerHTML = `<div class="coda-interactive-button-wrapper"><button class="coda-interactive-button" style="background-color:${color};color:white;padding:0.35rem 1rem;border:none;border-radius:6px;cursor:pointer;font-weight:500;font-size:0.875rem;display:inline-flex;align-items:center;gap:5px;line-height:1.4;"><i class="pi pi-bolt" style="font-size:0.8rem;"></i>${label}</button></div>`
    return node
  }

  static value(node) {
    try {
      return JSON.parse(node.dataset.value)
    } catch (e) {
      return {}
    }
  }
}

Quill.register(InteractiveButtonBlot)

export { InteractiveButtonBlot }
