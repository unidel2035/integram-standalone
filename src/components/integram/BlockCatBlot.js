/**
 * Custom Quill Blot for Block Category system (Issue #6583)
 * Preserves block-cat divs (static, user, ai, domain) as atomic embeds in Quill.
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class BlockCatBlot extends BlockEmbed {
  static blotName = 'block-cat'
  static tagName = 'div'
  static className = 'block-cat'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    // Restore modifier class (--static, --user, --ai, --domain)
    if (value.modifier) {
      node.classList.add(value.modifier)
    }

    // Restore data attributes
    if (value.blockId) node.setAttribute('data-block-id', value.blockId)
    if (value.userName) node.setAttribute('data-user-name', value.userName)
    if (value.catLabel) node.setAttribute('data-cat-label', value.catLabel)
    if (value.category) node.setAttribute('data-category', value.category)
    if (value.domainBlockId) node.setAttribute('data-domain-block-id', value.domainBlockId)
    if (value.domainName) node.setAttribute('data-domain-name', value.domainName)

    // Restore body content
    const body = document.createElement('div')
    body.className = 'block-cat__body'
    body.innerHTML = value.bodyHtml || ''
    node.appendChild(body)

    return node
  }

  static value(node) {
    const body = node.querySelector('.block-cat__body')
    const classes = Array.from(node.classList)
    const modifier = classes.find(c => c.startsWith('block-cat--') && c !== 'block-cat--modified')

    return {
      modifier: modifier || '',
      blockId: node.getAttribute('data-block-id') || '',
      userName: node.getAttribute('data-user-name') || '',
      catLabel: node.getAttribute('data-cat-label') || '',
      category: node.getAttribute('data-category') || '',
      domainBlockId: node.getAttribute('data-domain-block-id') || '',
      domainName: node.getAttribute('data-domain-name') || '',
      bodyHtml: body ? body.innerHTML : '',
    }
  }
}

Quill.register(BlockCatBlot)

export { BlockCatBlot }
