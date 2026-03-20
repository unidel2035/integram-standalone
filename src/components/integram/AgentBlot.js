/**
 * AgentBlot — Quill blot for embedding AI agents in block editor
 * Universal blot: agent is selected from registry, configured via dialog
 */

import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class AgentBlot extends BlockEmbed {
  static blotName = 'agent_embed'
  static tagName = 'div'
  static className = 'agent-blot'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const agentId = value?.agentId || null
    const agentName = value?.agentName || 'Выберите агента'
    const agentType = value?.agentType || 'generic'
    const config = value?.config || {}
    const status = value?.status || 'idle'

    node.dataset.value = JSON.stringify({ agentId, agentName, agentType, config, status })

    const statusColors = {
      idle: 'var(--p-surface-400, #8892b0)',
      running: 'var(--p-green-400, #64ffda)',
      done: 'var(--p-green-500, #4ade80)',
      error: 'var(--p-red-400, #f87171)',
    }
    const statusColor = statusColors[status] || statusColors.idle

    node.innerHTML = `
      <div class="agent-blot-placeholder" style="
        min-height: 60px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: linear-gradient(135deg, var(--p-surface-900, #1a1a2e) 0%, var(--p-surface-800, #16213e) 100%);
        border-radius: 10px;
        border-left: 4px solid ${statusColor};
        color: var(--p-surface-0, #ccd6f6);
        font-size: 14px;
      ">
        <i class="pi pi-android" style="font-size: 1.4rem; color: ${statusColor};"></i>
        <div style="flex:1;">
          <div style="font-weight:600;">${agentName}</div>
          <div style="font-size:12px; color:var(--p-text-muted-color, #8892b0);">${agentType}</div>
        </div>
        <span style="
          display:inline-block;
          padding:2px 8px;
          border-radius:12px;
          font-size:11px;
          color:${statusColor};
        ">${status}</span>
      </div>
    `

    return node
  }

  static value(node) {
    try {
      return JSON.parse(node.dataset.value)
    } catch (e) {
      return {
        agentId: null,
        agentName: 'Агент',
        agentType: 'generic',
        config: {},
        status: 'idle',
      }
    }
  }
}

Quill.register(AgentBlot)
export { AgentBlot }
