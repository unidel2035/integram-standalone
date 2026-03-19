/**
 * AgentBus — Unified agent communication hub (standalone version for VentureOS/Fund)
 *
 * Same API as DronDoc's AgentBus but without UnifiedEventBus/InterAgentProtocol dependencies.
 * Transports: REST (primary), Socket.io (optional if wired)
 */

import EventEmitter from 'events';
import { randomUUID } from 'crypto';

const HEARTBEAT_INTERVAL = 30_000;
const HEARTBEAT_TIMEOUT  = 90_000;
const DEFAULT_MSG_TTL    = 3_600_000;
const INBOX_MAX          = 500;

function createMessage({ from, to, topic, type, payload, correlationId, ttl, priority }) {
  return {
    id: `msg_${randomUUID()}`,
    from: from || null,
    to: to || null,
    topic: topic || null,
    type: type || 'notification',
    payload: payload || {},
    correlationId: correlationId || null,
    timestamp: Date.now(),
    ttl: ttl || DEFAULT_MSG_TTL,
    priority: priority || 'normal',
  };
}

class AgentBus extends EventEmitter {
  constructor(projectId = 'fund') {
    super();
    this.setMaxListeners(200);
    this.projectId = projectId;
    this.busId = `bus_${randomUUID()}`;

    this._agents = new Map();
    this._inboxes = new Map();
    this._topicSubs = new Map();
    this._pendingRequests = new Map();

    this._stats = {
      registered: 0,
      unregistered: 0,
      messagesSent: 0,
      messagesPublished: 0,
      requestsSent: 0,
      startedAt: new Date().toISOString(),
    };

    this._heartbeatTimer = setInterval(() => this._checkHeartbeats(), HEARTBEAT_INTERVAL);
    this._inboxCleanerTimer = setInterval(() => this._cleanInboxes(), 300_000);

    console.log(`[AgentBus] Created (project=${projectId}, busId=${this.busId})`);
  }

  // ── Agent Registry ─────────────────────────────────────────────────

  register(agentId, info = {}) {
    const agent = {
      agentId,
      name: info.name || agentId,
      type: info.type || 'generic',
      capabilities: info.capabilities || [],
      transport: info.transport || 'rest',
      lastHeartbeat: Date.now(),
      registeredAt: Date.now(),
      meta: info.meta || {},
    };

    this._agents.set(agentId, agent);
    if (!this._inboxes.has(agentId)) {
      this._inboxes.set(agentId, []);
    }
    this._stats.registered++;

    console.log(`[AgentBus] Agent registered: ${agentId} (type=${agent.type})`);
    this.emit('agent:registered', agent);
    return agent;
  }

  unregister(agentId) {
    const agent = this._agents.get(agentId);
    if (!agent) return false;

    this._agents.delete(agentId);
    this._stats.unregistered++;

    for (const [topic, subs] of this._topicSubs.entries()) {
      subs.delete(agentId);
      if (subs.size === 0) this._topicSubs.delete(topic);
    }

    console.log(`[AgentBus] Agent unregistered: ${agentId}`);
    this.emit('agent:unregistered', { agentId });
    return true;
  }

  heartbeat(agentId) {
    const agent = this._agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = Date.now();
      return true;
    }
    return false;
  }

  discover(filter = {}) {
    let agents = Array.from(this._agents.values());

    if (filter.type) agents = agents.filter(a => a.type === filter.type);
    if (filter.capability) agents = agents.filter(a => a.capabilities.includes(filter.capability));
    if (filter.name) {
      const q = filter.name.toLowerCase();
      agents = agents.filter(a => a.name.toLowerCase().includes(q));
    }
    if (filter.project) {
      agents = agents.filter(a => {
        if (a.transport === 'federated') return a.meta?.project === filter.project;
        return filter.project === this.projectId;
      });
    }

    return agents.map(a => ({
      agentId: a.agentId,
      name: a.name,
      type: a.type,
      capabilities: a.capabilities,
      transport: a.transport,
      registeredAt: a.registeredAt,
      lastHeartbeat: a.lastHeartbeat,
      project: a.transport === 'federated' ? a.meta?.project : this.projectId,
    }));
  }

  // ── Messaging ──────────────────────────────────────────────────────

  send(fromAgent, toAgent, payload, options = {}) {
    const msg = createMessage({
      from: fromAgent,
      to: toAgent,
      type: options.type || 'notification',
      payload,
      ttl: options.ttl,
      priority: options.priority,
    });

    this._stats.messagesSent++;
    this._deliver(toAgent, msg);
    this.emit('message:sent', msg);
    return msg;
  }

  publish(topic, payload, options = {}) {
    const msg = createMessage({
      from: options.from || null,
      topic,
      type: 'broadcast',
      payload,
      ttl: options.ttl,
      priority: options.priority,
    });

    this._stats.messagesPublished++;
    const subs = this._topicSubs.get(topic);
    const delivered = [];

    if (subs) {
      for (const agentId of subs) {
        this._deliver(agentId, msg);
        delivered.push(agentId);
      }
    }

    this.emit('message:published', { topic, deliveredTo: delivered });
    return { ...msg, deliveredTo: delivered };
  }

  subscribeTopic(agentId, topic) {
    if (!this._topicSubs.has(topic)) {
      this._topicSubs.set(topic, new Set());
    }
    this._topicSubs.get(topic).add(agentId);
    this.emit('topic:subscribed', { agentId, topic });
    return true;
  }

  unsubscribeTopic(agentId, topic) {
    const subs = this._topicSubs.get(topic);
    if (subs) {
      subs.delete(agentId);
      if (subs.size === 0) this._topicSubs.delete(topic);
    }
    return true;
  }

  async request(fromAgent, toAgent, payload, timeout = 10_000) {
    const correlationId = `req_${randomUUID()}`;
    const msg = createMessage({
      from: fromAgent,
      to: toAgent,
      type: 'request',
      payload,
      correlationId,
    });

    this._stats.requestsSent++;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pendingRequests.delete(correlationId);
        reject(new Error(`Request to ${toAgent} timed out after ${timeout}ms`));
      }, timeout);

      this._pendingRequests.set(correlationId, { resolve, reject, timer });
      this._deliver(toAgent, msg);
    });
  }

  respond(fromAgent, correlationId, payload) {
    const pending = this._pendingRequests.get(correlationId);
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve(payload);
      this._pendingRequests.delete(correlationId);
      return true;
    }

    const msg = createMessage({
      from: fromAgent,
      type: 'response',
      payload,
      correlationId,
    });
    this.emit('message:response', msg);
    return true;
  }

  // ── Inbox ──────────────────────────────────────────────────────────

  getInbox(agentId, options = {}) {
    const inbox = this._inboxes.get(agentId) || [];
    const limit = options.limit || 50;
    const messages = inbox.slice(-limit);

    if (options.markRead) {
      this._inboxes.set(agentId, []);
    }
    return messages;
  }

  getInboxCount(agentId) {
    return (this._inboxes.get(agentId) || []).length;
  }

  // ── Ghost Agents (Federation) ──────────────────────────────────────

  registerGhost(globalId, info) {
    const agent = {
      agentId: globalId,
      name: info.name,
      type: info.type,
      capabilities: info.capabilities || [],
      transport: 'federated',
      _federationPeer: info._federationPeer,
      lastHeartbeat: Date.now(),
      registeredAt: Date.now(),
      meta: { originalId: info.agentId || info.originalId, project: info.project },
    };
    this._agents.set(globalId, agent);
    // No local inbox for ghost agents — inbox lives on remote peer
    this.emit('agent:registered', agent);
    return agent;
  }

  unregisterGhost(globalId) {
    const agent = this._agents.get(globalId);
    if (!agent || agent.transport !== 'federated') return false;
    this._agents.delete(globalId);
    this.emit('agent:unregistered', { agentId: globalId });
    return true;
  }

  // ── Status ─────────────────────────────────────────────────────────

  getStatus() {
    const agents = this.discover();
    const topics = {};
    for (const [topic, subs] of this._topicSubs.entries()) {
      topics[topic] = subs.size;
    }

    return {
      status: 'running',
      projectId: this.projectId,
      busId: this.busId,
      agents: {
        online: agents.length,
        list: agents,
      },
      topics,
      pendingRequests: this._pendingRequests.size,
      stats: this._stats,
    };
  }

  // ── Internal ───────────────────────────────────────────────────────

  _deliver(agentId, msg) {
    const agent = this._agents.get(agentId);

    // Federated routing — forward to remote peer
    if (agent && agent.transport === 'federated' && agent._federationPeer) {
      agent._federationPeer.sendToPeer({
        ...msg,
        to: agent.meta.originalId,
        _federation: {
          originBus: this.busId,
          originProject: this.projectId,
          hops: (msg._federation?.hops || 0) + 1,
        },
      });
      return;
    }

    // Local delivery — store in inbox
    if (!this._inboxes.has(agentId)) {
      this._inboxes.set(agentId, []);
    }
    const inbox = this._inboxes.get(agentId);
    inbox.push(msg);
    if (inbox.length > INBOX_MAX) {
      inbox.splice(0, inbox.length - INBOX_MAX);
    }
  }

  _checkHeartbeats() {
    const now = Date.now();
    for (const [agentId, agent] of this._agents.entries()) {
      // Don't timeout federated agents — they have their own heartbeat via federation link
      if (agent.transport === 'federated') continue;
      if (now - agent.lastHeartbeat > HEARTBEAT_TIMEOUT) {
        console.warn(`[AgentBus] Heartbeat timeout: ${agentId}`);
        this.unregister(agentId);
      }
    }
  }

  _cleanInboxes() {
    const now = Date.now();
    for (const [agentId, inbox] of this._inboxes.entries()) {
      const before = inbox.length;
      const filtered = inbox.filter(msg => (now - msg.timestamp) < msg.ttl);
      if (filtered.length < before) {
        this._inboxes.set(agentId, filtered);
      }
    }
  }

  destroy() {
    clearInterval(this._heartbeatTimer);
    clearInterval(this._inboxCleanerTimer);

    for (const [, req] of this._pendingRequests.entries()) {
      clearTimeout(req.timer);
      req.reject(new Error('AgentBus destroyed'));
    }
    this._pendingRequests.clear();
    this._agents.clear();
    this._inboxes.clear();
    this._topicSubs.clear();
    this.removeAllListeners();
    console.log('[AgentBus] Destroyed');
  }
}

// Singleton
let instance = null;

export function getAgentBus(projectId) {
  if (!instance) {
    instance = new AgentBus(projectId || process.env.AGENTBUS_PROJECT_ID || 'integram');
  }
  return instance;
}

export { AgentBus };
export default getAgentBus;
