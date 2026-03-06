import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api'

/**
 * Handoff Service for AI-Human collaboration in process workflows
 * Manages transitions between AI agents and human agents
 */
export function useHandoffService() {
  /**
   * Request handoff from AI agent to human
   * @param {Object} agentTask - AI agent task data
   * @param {string} humanUserId - Human user to hand off to
   * @returns {Promise<Object>} Created user task
   */
  async function handoffToHuman(agentTask, humanUserId) {
    try {
      const response = await axios.post(`${API_BASE_URL}/process/handoff/to-human`, {
        agentTask,
        humanUserId
      })
      return response.data.userTask
    } catch (error) {
      console.error('Error handing off to human:', error)
      throw error
    }
  }

  /**
   * Request handoff from human to AI agent
   * @param {Object} userTaskResult - Human task result
   * @param {string} nextAgentId - AI agent to hand off to
   * @returns {Promise<Object>} Created AI task
   */
  async function handoffToAI(userTaskResult, nextAgentId) {
    try {
      const response = await axios.post(`${API_BASE_URL}/process/handoff/to-ai`, {
        userTaskResult,
        nextAgentId
      })
      return response.data.aiTask
    } catch (error) {
      console.error('Error handing off to AI:', error)
      throw error
    }
  }

  /**
   * Create a breakpoint in process execution for human review
   * @param {Object} breakpointData - Breakpoint configuration
   * @returns {Promise<Object>} Breakpoint result
   */
  async function createBreakpoint(breakpointData) {
    try {
      const response = await axios.post(`${API_BASE_URL}/process/handoff/breakpoint`, {
        processInstanceId: breakpointData.processInstanceId,
        nodeId: breakpointData.nodeId,
        reason: breakpointData.reason,
        context: breakpointData.context
      })
      return response.data
    } catch (error) {
      console.error('Error creating breakpoint:', error)
      throw error
    }
  }

  /**
   * Resume process execution after human review
   * @param {string} breakpointId - Breakpoint ID
   * @param {Object} humanInput - Human input to continue with
   * @returns {Promise<Object>} Resume result
   */
  async function resumeFromBreakpoint(breakpointId, humanInput) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/process/handoff/breakpoint/${breakpointId}/resume`,
        {
          humanInput
        }
      )
      return response.data
    } catch (error) {
      console.error('Error resuming from breakpoint:', error)
      throw error
    }
  }

  /**
   * Get handoff history for a process instance
   * @param {string} processInstanceId - Process instance ID
   * @returns {Promise<Array>} Handoff history
   */
  async function getHandoffHistory(processInstanceId) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/process/handoff/history/${processInstanceId}`
      )
      return response.data.history || []
    } catch (error) {
      console.error('Error fetching handoff history:', error)
      return []
    }
  }

  /**
   * Generate review form for AI agent result
   * @param {Object} agentResult - AI agent result to review
   * @returns {Object} Form schema for review
   */
  function generateReviewForm(agentResult) {
    return {
      fields: [
        {
          id: 'agent_result',
          type: 'textarea',
          label: 'AI Agent Result',
          readonly: true,
          defaultValue: JSON.stringify(agentResult.data, null, 2)
        },
        {
          id: 'agent_confidence',
          type: 'text',
          label: 'Confidence Score',
          readonly: true,
          defaultValue: agentResult.confidence
            ? `${(agentResult.confidence * 100).toFixed(1)}%`
            : 'N/A'
        },
        {
          id: 'approval_decision',
          type: 'select',
          label: 'Decision',
          required: true,
          options: [
            { value: 'approve', label: 'Approve' },
            { value: 'reject', label: 'Reject' },
            { value: 'modify', label: 'Modify and Continue' }
          ]
        },
        {
          id: 'rejection_reason',
          type: 'textarea',
          label: 'Rejection Reason',
          required: true,
          conditional: {
            field: 'approval_decision',
            value: 'reject'
          }
        },
        {
          id: 'modifications',
          type: 'textarea',
          label: 'Modifications',
          required: true,
          conditional: {
            field: 'approval_decision',
            value: 'modify'
          }
        },
        {
          id: 'comments',
          type: 'textarea',
          label: 'Additional Comments',
          required: false
        }
      ],
      validations: [
        {
          field: 'rejection_reason',
          rule: 'minLength',
          value: 10,
          message: 'Rejection reason must be at least 10 characters'
        },
        {
          field: 'modifications',
          rule: 'minLength',
          value: 10,
          message: 'Modifications must be at least 10 characters'
        }
      ]
    }
  }

  /**
   * Validate handoff context preservation
   * @param {Object} context - Context to validate
   * @returns {boolean} True if context is valid
   */
  function validateContext(context) {
    if (!context || typeof context !== 'object') {
      return false
    }

    const requiredFields = ['processInstanceId', 'nodeId', 'timestamp']
    return requiredFields.every((field) => field in context)
  }

  return {
    handoffToHuman,
    handoffToAI,
    createBreakpoint,
    resumeFromBreakpoint,
    getHandoffHistory,
    generateReviewForm,
    validateContext
  }
}
