// Issue #6878: CalloutBlot — Quill Blot for callout blocks with themes, icons, and custom colors
import Quill from 'quill'
const BlockEmbed = Quill.import('blots/block/embed')

class CalloutBlot extends BlockEmbed {
  static blotName = 'callout'
  static tagName = 'div'
  static className = 'callout-block-wrapper'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')
    node.setAttribute('data-theme', value.theme || 'info')
    node.setAttribute('data-icon', value.icon || '💡')
    if (value.bgColor) {
      node.setAttribute('data-bg-color', value.bgColor)
    }
    node.setAttribute('data-content', value.content || 'Важная информация или заметка...')

    // Add unique ID for Vue component mounting
    const blockId = `callout-${Math.random().toString(36).substr(2, 9)}`
    node.setAttribute('data-block-id', blockId)

    node.innerHTML = `<div id="${blockId}"></div>`
    return node
  }

  static value(node) {
    return {
      theme: node.getAttribute('data-theme') || 'info',
      icon: node.getAttribute('data-icon') || '💡',
      bgColor: node.getAttribute('data-bg-color') || null,
      content: node.getAttribute('data-content') || 'Важная информация или заметка...',
      blockId: node.getAttribute('data-block-id')
    }
  }
}

Quill.register(CalloutBlot)
export { CalloutBlot }
