/**
 * HandoffService - Manages AI-Human collaboration in process workflows
 * Part of Phase 5: Human-AI Collaboration implementation
 *
 * This service handles:
 * - AI → Human handoff (when AI needs human input)
 * - Human → AI handoff (when human delegates to AI)
 * - Context preservation during handoffs
 * - Breakpoint management for human review
 *
 * IMPORTANT: Uses local file storage (no database creation per guidelines)
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class HandoffService {
  constructor() {
    this.dataDir = path.join(__dirname, '../../../data/process')
    this.handoffsFile = path.join(this.dataDir, 'handoffs.json')
    this.breakpointsFile = path.join(this.dataDir, 'breakpoints.json')
    this.initialize()
  }

  /**
   * Initialize data storage
   */
  async initialize() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true })

      // Create handoffs file if doesn't exist
      try {
        await fs.access(this.handoffsFile)
      } catch {
        await fs.writeFile(this.handoffsFile, JSON.stringify([]))
      }

      // Create breakpoints file if doesn't exist
      try {
        await fs.access(this.breakpointsFile)
      } catch {
        await fs.writeFile(this.breakpointsFile, JSON.stringify([]))
      }
    } catch (error) {
      console.error('Failed to initialize HandoffService:', error)
    }
  }

  /**
   * Handoff from AI agent to human
   * @param {Object} agentTask - AI agent task data
   * @param {string} humanUserId - Human user to assign task to
   * @returns {Promise<Object>} Created user task
   */
  async handoffToHuman(agentTask, humanUserId) {
    const userTask = {
      id: `user-task-${Date.now()}`,
      processInstanceId: agentTask.processInstanceId,
      name: `Review: ${agentTask.name}`,
      assignee: humanUserId,
      priority: agentTask.priority || 'medium',
      status: 'active',
      createdAt: new Date().toISOString(),
      formSchema: this.generateReviewForm(agentTask),
      context: {
        handoffType: 'ai-to-human',
        agentId: agentTask.agentId,
        agentResult: agentTask.result,
        handoffReason: agentTask.handoffReason || 'AI requested human review',
        timestamp: new Date().toISOString()
      }
    }

    // Record handoff
    await this.recordHandoff({
      id: `handoff-${Date.now()}`,
      processInstanceId: agentTask.processInstanceId,
      type: 'ai-to-human',
      from: { type: 'agent', id: agentTask.agentId },
      to: { type: 'human', id: humanUserId },
      taskId: userTask.id,
      timestamp: new Date().toISOString(),
      context: userTask.context
    })

    // TODO: Notify human agent via notification service
    // await this.notificationService.notify(humanUserId, {...})

    return userTask
  }

  /**
   * Handoff from human to AI agent
   * @param {Object} userTaskResult - Human task completion result
   * @param {string} nextAgentId - AI agent to assign task to
   * @returns {Promise<Object>} Created AI task
   */
  async handoffToAI(userTaskResult, nextAgentId) {
    const aiTask = {
      id: `ai-task-${Date.now()}`,
      processInstanceId: userTaskResult.processInstanceId,
      agentId: nextAgentId,
      name: `Continue from human input`,
      priority: 'high',
      status: 'pending',
      createdAt: new Date().toISOString(),
      data: {
        action: userTaskResult.nextAction || 'continue',
        input: userTaskResult.formData,
        humanFeedback: userTaskResult.formData.comments,
        decision: userTaskResult.formData.approval_decision
      },
      context: {
        handoffType: 'human-to-ai',
        humanUserId: userTaskResult.userId,
        userTaskId: userTaskResult.taskId,
        timestamp: new Date().toISOString()
      }
    }

    // Record handoff
    await this.recordHandoff({
      id: `handoff-${Date.now()}`,
      processInstanceId: userTaskResult.processInstanceId,
      type: 'human-to-ai',
      from: { type: 'human', id: userTaskResult.userId },
      to: { type: 'agent', id: nextAgentId },
      taskId: aiTask.id,
      timestamp: new Date().toISOString(),
      context: aiTask.context
    })

    // TODO: Execute AI agent via agent manager
    // await this.agentManager.assignTask(aiTask)

    return aiTask
  }

  /**
   * Create a breakpoint for human review
   * @param {Object} breakpointData - Breakpoint configuration
   * @returns {Promise<Object>} Breakpoint details
   */
  async createBreakpoint(breakpointData) {
    const breakpoint = {
      id: `breakpoint-${Date.now()}`,
      processInstanceId: breakpointData.processInstanceId,
      nodeId: breakpointData.nodeId,
      reason: breakpointData.reason,
      status: 'active',
      createdAt: new Date().toISOString(),
      context: breakpointData.context || {},
      aiResult: breakpointData.aiResult
    }

    // Save breakpoint
    const breakpoints = await this.getBreakpoints()
    breakpoints.push(breakpoint)
    await fs.writeFile(this.breakpointsFile, JSON.stringify(breakpoints, null, 2))

    // TODO: Notify assigned user
    // await this.notificationService.notify(breakpointData.assignee, {...})

    return breakpoint
  }

  /**
   * Resume process from breakpoint
   * @param {string} breakpointId - Breakpoint ID
   * @param {Object} humanInput - Human input to continue with
   * @returns {Promise<Object>} Resume result
   */
  async resumeFromBreakpoint(breakpointId, humanInput) {
    const breakpoints = await this.getBreakpoints()
    const breakpoint = breakpoints.find((bp) => bp.id === breakpointId)

    if (!breakpoint) {
      throw new Error(`Breakpoint ${breakpointId} not found`)
    }

    if (breakpoint.status !== 'active') {
      throw new Error(`Breakpoint ${breakpointId} is not active`)
    }

    // Update breakpoint status
    breakpoint.status = 'resolved'
    breakpoint.resolvedAt = new Date().toISOString()
    breakpoint.humanInput = humanInput

    await fs.writeFile(this.breakpointsFile, JSON.stringify(breakpoints, null, 2))

    // TODO: Resume process execution
    // await this.processEngine.resume(breakpoint.processInstanceId, humanInput)

    return {
      success: true,
      breakpointId,
      processInstanceId: breakpoint.processInstanceId,
      humanInput
    }
  }

  /**
   * Get handoff history for a process instance
   * @param {string} processInstanceId - Process instance ID
   * @returns {Promise<Array>} Handoff history
   */
  async getHandoffHistory(processInstanceId) {
    const handoffs = await this.getHandoffs()
    return handoffs.filter((h) => h.processInstanceId === processInstanceId)
  }

  /**
   * Generate review form for AI agent result
   * @param {Object} agentTask - AI agent task
   * @returns {Object} Form schema
   */
  generateReviewForm(agentTask) {
    return {
      fields: [
        {
          id: 'agent_result',
          type: 'textarea',
          label: 'AI Agent Result',
          readonly: true,
          defaultValue: JSON.stringify(agentTask.result || {}, null, 2)
        },
        {
          id: 'agent_confidence',
          type: 'text',
          label: 'Confidence Score',
          readonly: true,
          defaultValue: agentTask.confidence
            ? `${(agentTask.confidence * 100).toFixed(1)}%`
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
   * Record handoff event
   * @param {Object} handoff - Handoff data
   * @returns {Promise<void>}
   */
  async recordHandoff(handoff) {
    const handoffs = await this.getHandoffs()
    handoffs.push(handoff)
    await fs.writeFile(this.handoffsFile, JSON.stringify(handoffs, null, 2))
  }

  /**
   * Get all handoffs
   * @returns {Promise<Array>} Handoffs
   */
  async getHandoffs() {
    try {
      const data = await fs.readFile(this.handoffsFile, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      console.error('Error reading handoffs:', error)
      return []
    }
  }

  /**
   * Get all breakpoints
   * @returns {Promise<Array>} Breakpoints
   */
  async getBreakpoints() {
    try {
      const data = await fs.readFile(this.breakpointsFile, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      console.error('Error reading breakpoints:', error)
      return []
    }
  }
}

export { HandoffService }
