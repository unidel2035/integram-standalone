/**
 * A2A Protocol — Agent-to-Agent Communication
 *
 * Implements Google A2A-compatible protocol for inter-agent communication.
 * Deloitte Tech Trends 2026: "Agent-to-Agent Protocol (A2A) enables
 * direct communication between different AI agents."
 *
 * Core concepts:
 * - Agent Card: JSON descriptor of agent identity + capabilities
 * - Task: unit of work exchanged between agents
 * - Message: communication within a task context
 * - Artifact: output produced by an agent
 *
 * @see https://google.github.io/A2A/
 */

import { randomUUID } from 'crypto';
import EventEmitter from 'events';
import logger from '../../utils/logger.js';

// ─── Task States ─────────────────────────────────────────────────────────────

export const TaskState = {
  SUBMITTED:  'submitted',
  WORKING:    'working',
  INPUT_REQUIRED: 'input-required',
  COMPLETED:  'completed',
  FAILED:     'failed',
  CANCELED:   'canceled',
};

// ─── Agent Card ──────────────────────────────────────────────────────────────

/**
 * Create an Agent Card — standard identity descriptor
 */
export function createAgentCard({
  name,
  description,
  url,
  version = '1.0.0',
  capabilities = {},
  skills = [],
  provider = { organization: 'AI-2-O / DronDoc' },
  authentication = null,
}) {
  return {
    name,
    description,
    url,
    version,
    provider,
    capabilities: {
      streaming: capabilities.streaming ?? false,
      pushNotifications: capabilities.pushNotifications ?? false,
      stateTransitionHistory: capabilities.stateTransitionHistory ?? true,
      ...capabilities,
    },
    skills: skills.map(s => ({
      id: s.id || randomUUID(),
      name: s.name,
      description: s.description,
      inputModes: s.inputModes || ['text'],
      outputModes: s.outputModes || ['text'],
      tags: s.tags || [],
    })),
    authentication,
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
  };
}

// ─── Message & Artifact ──────────────────────────────────────────────────────

export function createMessage({ role, parts, metadata = {} }) {
  return {
    messageId: randomUUID(),
    role,    // 'user' | 'agent'
    parts,   // [{ type: 'text', text: '...' }, { type: 'data', data: {...} }]
    metadata,
    timestamp: new Date().toISOString(),
  };
}

export function createArtifact({ name, parts, metadata = {} }) {
  return {
    artifactId: randomUUID(),
    name,
    parts,
    metadata,
    timestamp: new Date().toISOString(),
  };
}

// ─── A2A Protocol Service ────────────────────────────────────────────────────

export class A2AProtocol extends EventEmitter {
  constructor(options = {}) {
    super();
    this.agents = new Map();     // agentId → AgentCard
    this.tasks = new Map();      // taskId → Task
    this.maxTasks = options.maxTasks || 50000;
    this.receiptService = options.receiptService || null;
    logger.info('[A2A] Protocol initialized');
  }

  // ── Agent Registration ───────────────────────────────────────────────────

  registerAgent(agentId, card) {
    this.agents.set(agentId, {
      ...card,
      agentId,
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      status: 'online',
    });
    this.emit('agent:registered', { agentId, card });
    logger.info({ agentId, name: card.name }, '[A2A] Agent registered');
    return this.agents.get(agentId);
  }

  deregisterAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    // Cancel all tasks owned by this agent
    for (const [taskId, task] of this.tasks) {
      if (task.assignedTo === agentId && ![TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELED].includes(task.state)) {
        this._transitionTask(taskId, TaskState.CANCELED, `Agent ${agentId} deregistered`);
      }
    }
    this.agents.delete(agentId);
    this.emit('agent:deregistered', { agentId });
    logger.info({ agentId }, '[A2A] Agent deregistered');
    return true;
  }

  heartbeat(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    agent.lastSeen = new Date().toISOString();
    agent.status = 'online';
    return true;
  }

  getAgentCard(agentId) {
    return this.agents.get(agentId) || null;
  }

  listAgents({ capability, skill, status } = {}) {
    let agents = Array.from(this.agents.values());
    if (capability) {
      agents = agents.filter(a => a.capabilities?.[capability]);
    }
    if (skill) {
      agents = agents.filter(a =>
        a.skills?.some(s => s.tags?.includes(skill) || s.name.toLowerCase().includes(skill.toLowerCase()))
      );
    }
    if (status) {
      agents = agents.filter(a => a.status === status);
    }
    return agents;
  }

  findAgentsBySkill(skillQuery) {
    const results = [];
    for (const [agentId, agent] of this.agents) {
      for (const skill of (agent.skills || [])) {
        const match =
          skill.name.toLowerCase().includes(skillQuery.toLowerCase()) ||
          skill.tags?.some(t => t.toLowerCase().includes(skillQuery.toLowerCase()));
        if (match) {
          results.push({ agentId, agent, matchedSkill: skill });
        }
      }
    }
    return results;
  }

  // ── Task Management (core A2A flow) ──────────────────────────────────────

  /**
   * Send a task to an agent (tasks/send)
   */
  sendTask({ fromAgent, toAgent, message, metadata = {} }) {
    if (this.tasks.size >= this.maxTasks) {
      this._evictOldTasks();
    }
    const taskId = randomUUID();
    const task = {
      id: taskId,
      fromAgent,
      assignedTo: toAgent,
      state: TaskState.SUBMITTED,
      messages: [createMessage({ role: 'user', parts: message.parts || [{ type: 'text', text: message.text || message }], metadata: message.metadata })],
      artifacts: [],
      history: [{ state: TaskState.SUBMITTED, timestamp: new Date().toISOString() }],
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(taskId, task);
    this.emit('task:submitted', { taskId, fromAgent, toAgent });

    // Issue receipt if service available
    if (this.receiptService) {
      this.receiptService.issueReceipt({
        agentId: fromAgent,
        action: 'a2a:task:send',
        targetId: taskId,
        details: { toAgent, messageCount: 1 },
      });
    }

    logger.info({ taskId, from: fromAgent, to: toAgent }, '[A2A] Task submitted');
    return task;
  }

  /**
   * Agent picks up and starts working on a task
   */
  startTask(taskId, agentId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    if (task.assignedTo !== agentId) throw new Error(`Task ${taskId} not assigned to ${agentId}`);
    this._transitionTask(taskId, TaskState.WORKING);
    return task;
  }

  /**
   * Agent adds a message to the task
   */
  addMessage(taskId, agentId, message) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    const msg = createMessage({
      role: task.assignedTo === agentId ? 'agent' : 'user',
      parts: message.parts || [{ type: 'text', text: message.text || message }],
      metadata: message.metadata,
    });
    task.messages.push(msg);
    task.updatedAt = new Date().toISOString();
    this.emit('task:message', { taskId, agentId, message: msg });
    return msg;
  }

  /**
   * Agent produces an artifact
   */
  addArtifact(taskId, agentId, artifact) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    const art = createArtifact(artifact);
    task.artifacts.push(art);
    task.updatedAt = new Date().toISOString();
    this.emit('task:artifact', { taskId, agentId, artifact: art });
    return art;
  }

  /**
   * Complete a task
   */
  completeTask(taskId, agentId, { finalMessage, artifacts } = {}) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    if (finalMessage) this.addMessage(taskId, agentId, finalMessage);
    if (artifacts) artifacts.forEach(a => this.addArtifact(taskId, agentId, a));
    this._transitionTask(taskId, TaskState.COMPLETED);

    if (this.receiptService) {
      this.receiptService.issueReceipt({
        agentId,
        action: 'a2a:task:complete',
        targetId: taskId,
        details: { messageCount: task.messages.length, artifactCount: task.artifacts.length },
      });
    }
    return task;
  }

  /**
   * Fail a task
   */
  failTask(taskId, agentId, error) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.error = { message: error.message || error, code: error.code || 'AGENT_ERROR' };
    this._transitionTask(taskId, TaskState.FAILED, error.message || error);
    return task;
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId, reason = 'Canceled by requester') {
    this._transitionTask(taskId, TaskState.CANCELED, reason);
    return this.tasks.get(taskId);
  }

  /**
   * Request input from the requester
   */
  requestInput(taskId, agentId, question) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    this.addMessage(taskId, agentId, { text: question, metadata: { type: 'input-request' } });
    this._transitionTask(taskId, TaskState.INPUT_REQUIRED);
    return task;
  }

  getTask(taskId) {
    return this.tasks.get(taskId) || null;
  }

  getTasksByAgent(agentId, { state } = {}) {
    const results = [];
    for (const task of this.tasks.values()) {
      if (task.assignedTo === agentId || task.fromAgent === agentId) {
        if (!state || task.state === state) results.push(task);
      }
    }
    return results;
  }

  // ── Capability-based routing ─────────────────────────────────────────────

  /**
   * Route a task to the best agent based on skill requirements
   */
  routeTask({ fromAgent, skillRequired, message, metadata = {} }) {
    const candidates = this.findAgentsBySkill(skillRequired);
    const onlineAgents = candidates.filter(c => c.agent.status === 'online');
    if (onlineAgents.length === 0) {
      throw new Error(`No online agent found with skill: ${skillRequired}`);
    }
    // Pick agent with fewest active tasks
    let bestAgent = onlineAgents[0];
    let minTasks = Infinity;
    for (const candidate of onlineAgents) {
      const activeTasks = this.getTasksByAgent(candidate.agentId, { state: TaskState.WORKING }).length;
      if (activeTasks < minTasks) {
        minTasks = activeTasks;
        bestAgent = candidate;
      }
    }
    return this.sendTask({ fromAgent, toAgent: bestAgent.agentId, message, metadata: { ...metadata, routedBySkill: skillRequired } });
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  getStats() {
    const taskStates = {};
    for (const task of this.tasks.values()) {
      taskStates[task.state] = (taskStates[task.state] || 0) + 1;
    }
    return {
      agents: {
        total: this.agents.size,
        online: Array.from(this.agents.values()).filter(a => a.status === 'online').length,
      },
      tasks: {
        total: this.tasks.size,
        byState: taskStates,
      },
    };
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  _transitionTask(taskId, newState, reason) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    const oldState = task.state;
    task.state = newState;
    task.updatedAt = new Date().toISOString();
    task.history.push({
      from: oldState,
      state: newState,
      reason,
      timestamp: task.updatedAt,
    });
    this.emit('task:transition', { taskId, from: oldState, to: newState, reason });
  }

  _evictOldTasks() {
    const terminal = [TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELED];
    const toDelete = [];
    for (const [taskId, task] of this.tasks) {
      if (terminal.includes(task.state)) toDelete.push(taskId);
    }
    // Delete oldest first
    toDelete.sort((a, b) => this.tasks.get(a).updatedAt.localeCompare(this.tasks.get(b).updatedAt));
    const deleteCount = Math.max(toDelete.length, Math.floor(this.maxTasks * 0.1));
    for (let i = 0; i < deleteCount && i < toDelete.length; i++) {
      this.tasks.delete(toDelete[i]);
    }
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _instance = null;
export function getA2AProtocol(options) {
  if (!_instance) _instance = new A2AProtocol(options);
  return _instance;
}

export default A2AProtocol;
