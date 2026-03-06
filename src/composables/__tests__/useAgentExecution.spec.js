/**
 * Tests for useAgentExecution composable
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAgentExecution } from '../useAgentExecution'

describe('useAgentExecution', () => {
  let execution

  beforeEach(() => {
    execution = useAgentExecution()
    execution.reset()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      expect(execution.currentAgent.value).toBeNull()
      expect(execution.involvedAgents.value).toEqual([])
      expect(execution.executionStatus.value).toBe('idle')
      expect(execution.currentAction.value).toBe('')
      expect(execution.steps.value).toEqual([])
      expect(execution.thinking.value).toBe('')
      expect(execution.isThinking.value).toBe(false)
      expect(execution.workflowNodes.value).toEqual([])
      expect(execution.workflowEdges.value).toEqual([])
    })

    it('should have correct computed values initially', () => {
      expect(execution.isRunning.value).toBe(false)
      expect(execution.hasSteps.value).toBe(false)
      expect(execution.hasWorkflow.value).toBe(false)
      expect(execution.progress.value).toBe(0)
    })
  })

  describe('startExecution', () => {
    it('should start execution with agent', () => {
      const agent = { id: 'agent-1', name: 'Test Agent', icon: '🤖' }

      execution.startExecution(agent)

      expect(execution.currentAgent.value).toEqual(agent)
      expect(execution.executionStatus.value).toBe('running')
      expect(execution.executionStartTime.value).toBeGreaterThan(0)
      expect(execution.involvedAgents.value).toContainEqual(agent)
      expect(execution.isRunning.value).toBe(true)
    })

    it('should add start node to workflow', () => {
      const agent = { id: 'agent-1', name: 'Test Agent' }

      execution.startExecution(agent)

      expect(execution.workflowNodes.value.length).toBe(1)
      expect(execution.workflowNodes.value[0]).toMatchObject({
        id: 'start',
        type: 'start',
        status: 'completed'
      })
      expect(execution.hasWorkflow.value).toBe(true)
    })

    it('should clear previous state', () => {
      execution.thinking.value = 'old thinking'
      execution.steps.value = [{ id: 'old-step' }]

      execution.startExecution({ id: 'agent-1', name: 'Agent' })

      expect(execution.thinking.value).toBe('')
      expect(execution.steps.value).toEqual([])
    })
  })

  describe('endExecution', () => {
    it('should end execution with completed status', () => {
      execution.startExecution({ id: 'agent-1', name: 'Agent' })

      execution.endExecution('completed')

      expect(execution.executionStatus.value).toBe('completed')
      expect(execution.currentAction.value).toBe('')
      expect(execution.isThinking.value).toBe(false)
    })

    it('should end execution with error status', () => {
      execution.startExecution({ id: 'agent-1', name: 'Agent' })

      execution.endExecution('error')

      expect(execution.executionStatus.value).toBe('error')
    })

    it('should add end node to workflow', () => {
      execution.startExecution({ id: 'agent-1', name: 'Agent' })

      execution.endExecution('completed')

      const endNode = execution.workflowNodes.value.find(n => n.id === 'end')
      expect(endNode).toBeDefined()
      expect(endNode.type).toBe('end')
      expect(endNode.status).toBe('completed')
    })
  })

  describe('Thinking', () => {
    it('should update thinking content', () => {
      execution.updateThinking('Analyzing the request...')

      expect(execution.thinking.value).toBe('Analyzing the request...')
      expect(execution.isThinking.value).toBe(true)
    })

    it('should update thinking with type', () => {
      execution.updateThinking('Planning steps', { type: 'planning' })

      expect(execution.thinking.value).toBe('Planning steps')
      expect(execution.thinkingType.value).toBe('planning')
    })

    it('should clear thinking', () => {
      execution.startExecution({ id: 'agent-1', name: 'Agent' })
      execution.updateThinking('Some thinking')

      execution.clearThinking()

      expect(execution.isThinking.value).toBe(false)
      // Duration can be 0 if both calls happen in the same millisecond
      expect(execution.thinkingDuration.value).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Steps', () => {
    it('should add execution step', () => {
      const stepId = execution.addStep({
        type: 'search',
        title: 'Searching for data'
      })

      expect(execution.steps.value.length).toBe(1)
      expect(execution.steps.value[0]).toMatchObject({
        id: stepId,
        type: 'search',
        title: 'Searching for data',
        status: 'running'
      })
      expect(execution.hasSteps.value).toBe(true)
      expect(execution.currentAction.value).toBe('Searching for data')
    })

    it('should update step status', () => {
      const stepId = execution.addStep({ type: 'api_call', title: 'API call' })

      execution.updateStep(stepId, { status: 'completed', result: 'success' })

      const step = execution.steps.value.find(s => s.id === stepId)
      expect(step.status).toBe('completed')
      expect(step.result).toBe('success')
      // Duration can be 0 if both calls happen in the same millisecond
      expect(step.duration).toBeGreaterThanOrEqual(0)
    })

    it('should complete step', () => {
      const stepId = execution.addStep({ type: 'search', title: 'Search' })

      execution.completeStep(stepId, { data: 'found' })

      const step = execution.steps.value.find(s => s.id === stepId)
      expect(step.status).toBe('completed')
      expect(step.result).toEqual({ data: 'found' })
    })

    it('should fail step', () => {
      const stepId = execution.addStep({ type: 'api_call', title: 'API' })

      execution.failStep(stepId, 'Network error')

      const step = execution.steps.value.find(s => s.id === stepId)
      expect(step.status).toBe('error')
      expect(step.error).toBe('Network error')
    })

    it('should track progress', () => {
      execution.addStep({ type: 'step1', title: 'Step 1' })
      execution.addStep({ type: 'step2', title: 'Step 2' })
      const step3Id = execution.addStep({ type: 'step3', title: 'Step 3' })

      expect(execution.totalSteps.value).toBe(3)
      expect(execution.completedSteps.value).toBe(0)
      expect(execution.progress.value).toBe(0)

      execution.completeStep(execution.steps.value[0].id)
      expect(execution.completedSteps.value).toBe(1)
      expect(execution.progress.value).toBe(33)

      execution.completeStep(execution.steps.value[1].id)
      execution.completeStep(step3Id)
      expect(execution.completedSteps.value).toBe(3)
      expect(execution.progress.value).toBe(100)
    })
  })

  describe('Tool Calls', () => {
    it('should add tool call step', () => {
      const stepId = execution.addToolCall('web_search', { query: 'test' })

      expect(execution.steps.value.length).toBe(1)
      const step = execution.steps.value[0]
      expect(step.type).toBe('tool_call')
      expect(step.toolName).toBe('web_search')
      expect(step.toolInput).toEqual({ query: 'test' })
    })

    it('should add API call step', () => {
      const stepId = execution.addApiCall('/api/users', 'GET')

      const step = execution.steps.value[0]
      expect(step.type).toBe('api_call')
      expect(step.endpoint).toBe('/api/users')
      expect(step.method).toBe('GET')
    })

    it('should add search step', () => {
      const stepId = execution.addSearch('machine learning algorithms')

      const step = execution.steps.value[0]
      expect(step.type).toBe('search')
      expect(step.query).toBe('machine learning algorithms')
    })
  })

  describe('Agent Handoff', () => {
    it('should handoff to another agent', () => {
      const agent1 = { id: 'agent-1', name: 'Research Agent', icon: '🔍' }
      const agent2 = { id: 'agent-2', name: 'Writer Agent', icon: '✍️' }

      execution.startExecution(agent1)
      execution.handoffToAgent(agent2, 'Handing off to write the response')

      expect(execution.currentAgent.value).toEqual(agent2)
      expect(execution.involvedAgents.value).toContainEqual(agent1)
      expect(execution.involvedAgents.value).toContainEqual(agent2)
      expect(execution.currentHandoff.value).toBeDefined()
      expect(execution.currentHandoff.value.from).toEqual(agent1)
      expect(execution.currentHandoff.value.to).toEqual(agent2)
      expect(execution.currentHandoff.value.reason).toBe('Handing off to write the response')
    })

    it('should add handoff step', () => {
      const agent1 = { id: 'agent-1', name: 'Agent 1' }
      const agent2 = { id: 'agent-2', name: 'Agent 2' }

      execution.startExecution(agent1)
      execution.handoffToAgent(agent2, 'Reason')

      const handoffStep = execution.steps.value.find(s => s.type === 'handoff')
      expect(handoffStep).toBeDefined()
      expect(handoffStep.fromAgent).toBe('Agent 1')
      expect(handoffStep.toAgent).toBe('Agent 2')
    })
  })

  describe('Workflow', () => {
    it('should add workflow nodes', () => {
      execution.addWorkflowNode({
        id: 'node-1',
        label: 'First Node',
        type: 'agent'
      })

      expect(execution.workflowNodes.value.length).toBe(1)
      expect(execution.workflowNodes.value[0].label).toBe('First Node')
    })

    it('should auto-connect nodes with edges', () => {
      execution.addWorkflowNode({ id: 'node-1', label: 'Node 1', type: 'start' })
      execution.addWorkflowNode({ id: 'node-2', label: 'Node 2', type: 'agent' })

      expect(execution.workflowEdges.value.length).toBe(1)
      expect(execution.workflowEdges.value[0].source).toBe('node-1')
      expect(execution.workflowEdges.value[0].target).toBe('node-2')
    })

    it('should update workflow node', () => {
      execution.addWorkflowNode({ id: 'node-1', label: 'Node 1', status: 'running' })

      execution.updateWorkflowNode('node-1', { status: 'completed' })

      expect(execution.workflowNodes.value[0].status).toBe('completed')
    })

    it('should manually add edges', () => {
      execution.addWorkflowEdge('source-1', 'target-1', { animated: true })

      expect(execution.workflowEdges.value.length).toBe(1)
      expect(execution.workflowEdges.value[0]).toMatchObject({
        source: 'source-1',
        target: 'target-1',
        animated: true
      })
    })
  })

  describe('Streaming Response Parsing', () => {
    it('should detect and extract thinking blocks', () => {
      execution.parseStreamingResponse('<thinking>Analyzing the question...</thinking>')

      expect(execution.thinking.value).toBe('Analyzing the question...')
    })

    it('should handle streaming thinking blocks', () => {
      execution.parseStreamingResponse('<thinking>Start of thinking')
      expect(execution.isThinking.value).toBe(true)

      execution.parseStreamingResponse(' continued thinking')
      expect(execution.thinking.value).toContain('continued thinking')
    })
  })

  describe('Reset', () => {
    it('should reset all state', () => {
      execution.startExecution({ id: 'agent-1', name: 'Agent' })
      execution.addStep({ type: 'test', title: 'Test' })
      execution.updateThinking('Some thinking')
      execution.addWorkflowNode({ id: 'node', label: 'Node', type: 'test' })

      execution.reset()

      expect(execution.currentAgent.value).toBeNull()
      expect(execution.executionStatus.value).toBe('idle')
      expect(execution.steps.value).toEqual([])
      expect(execution.thinking.value).toBe('')
      expect(execution.workflowNodes.value).toEqual([])
      expect(execution.workflowEdges.value).toEqual([])
    })
  })
})
