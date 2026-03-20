// Issue #6891: Video Conference Block Blot
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class VideoConferenceBlot extends BlockEmbed {
  static blotName = 'video-conference'
  static tagName = 'div'
  static className = 'video-conference-block-wrapper'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')
    node.setAttribute('data-room-name', value.roomName || '')
    node.setAttribute('data-title', value.title || 'Видеоконференция')
    node.setAttribute('data-height', value.height || 500)
    if (value.password) {
      node.setAttribute('data-password', value.password)
    }
    node.setAttribute('data-auto-start', value.autoStart || false)
    if (value.documentId) {
      node.setAttribute('data-document-id', value.documentId)
    }

    // Store full config as JSON
    node.setAttribute('data-value', JSON.stringify(value))

    // Create unique ID for the block
    const blockId = `video-conference-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    node.setAttribute('data-block-id', blockId)

    // Create container div for Vue component
    const container = document.createElement('div')
    container.id = blockId
    container.className = 'video-conference-container'
    node.appendChild(container)

    return node
  }

  static value(node) {
    try {
      const valueStr = node.getAttribute('data-value')
      if (valueStr) {
        return JSON.parse(valueStr)
      }
    } catch (e) {
      console.error('[VideoConferenceBlot] Failed to parse value:', e)
    }

    // Fallback to reading individual attributes
    return {
      roomName: node.getAttribute('data-room-name') || '',
      title: node.getAttribute('data-title') || 'Видеоконференция',
      height: parseInt(node.getAttribute('data-height')) || 500,
      password: node.getAttribute('data-password') || null,
      autoStart: node.getAttribute('data-auto-start') === 'true',
      documentId: node.getAttribute('data-document-id') || null
    }
  }
}

Quill.register(VideoConferenceBlot)

export { VideoConferenceBlot }
