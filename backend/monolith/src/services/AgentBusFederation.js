/**
 * AgentBusFederation — P2P federation manager for AgentBus
 *
 * Dual transport: Socket.io (realtime, preferred) + REST (fallback)
 * mDNS zero-config LAN discovery + env/REST manual peering
 * Ghost agents, HMAC signing, anti-loop, topic federation
 *
 * Works with any AgentBus that has:
 *   .projectId, .busId, .discover(), .registerGhost(), .unregisterGhost(), ._deliver()
 */

import { createHmac, randomUUID } from 'crypto';

const MAX_HOPS = 3;
const SYNC_INTERVAL = 30_000;
const HEALTH_INTERVAL = 15_000;
const RECONNECT_DELAY = 5_000;

// ─── FederationLink ─────────────────────────────────────────────────────────

class FederationLink {
  constructor(peerUrl, peerProject, peerBusId, localBus, options = {}) {
    this.peerUrl = peerUrl.replace(/\/$/, '');
    this.peerProject = peerProject;
    this.peerBusId = peerBusId;
    this.localBus = localBus;
    this.secret = options.secret || process.env.AGENTBUS_FEDERATION_SECRET || 'dev-secret';
    this.connected = false;
    this.transport = 'rest'; // 'socket' | 'rest'
    this.lastSync = 0;
    this.lastHealth = 0;
    this.remoteAgents = [];

    this._socket = null;
    this._syncTimer = null;
    this._healthTimer = null;
  }

  async start() {
    // Try Socket.io first (realtime), fallback to REST polling
    await this._trySocketConnect();

    // Initial agent sync
    await this.syncAgents();

    // Periodic sync (less frequent if socket connected — socket pushes changes)
    const syncInterval = this.transport === 'socket' ? SYNC_INTERVAL * 2 : SYNC_INTERVAL;
    this._syncTimer = setInterval(() => this.syncAgents().catch(e =>
      console.warn(`[Federation] Sync error with ${this.peerProject}:`, e.message)
    ), syncInterval);

    // Health check (only for REST — socket has built-in keepalive)
    if (this.transport === 'rest') {
      this._healthTimer = setInterval(() => this.healthCheck().catch(e => {
        console.warn(`[Federation] Health failed for ${this.peerProject}:`, e.message);
        this.connected = false;
      }), HEALTH_INTERVAL);
    }

    this.connected = true;
    console.log(`[Federation] Link established: ${this.peerProject} @ ${this.peerUrl} (transport=${this.transport})`);
  }

  stop() {
    if (this._syncTimer) clearInterval(this._syncTimer);
    if (this._healthTimer) clearInterval(this._healthTimer);
    if (this._socket) {
      this._socket.removeAllListeners();
      this._socket.disconnect();
      this._socket = null;
    }

    for (const agent of this.remoteAgents) {
      const globalId = `${this.peerProject}:${agent.agentId}`;
      this.localBus.unregisterGhost(globalId);
    }
    this.remoteAgents = [];
    this.connected = false;
    console.log(`[Federation] Link stopped: ${this.peerProject}`);
  }

  // ── Socket.io Transport ────────────────────────────────────────────

  async _trySocketConnect() {
    try {
      const { io } = await import('socket.io-client');

      this._socket = io(`${this.peerUrl}/agent-bus-federation`, {
        reconnection: true,
        reconnectionDelay: RECONNECT_DELAY,
        reconnectionAttempts: Infinity,
        timeout: 5000,
        auth: {
          project: this.localBus.projectId,
          busId: this.localBus.busId,
          secret: this._sign('handshake'),
        },
      });

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Socket.io connect timeout'));
        }, 5000);

        this._socket.on('connect', () => {
          clearTimeout(timer);
          this.transport = 'socket';
          this.connected = true;
          console.log(`[Federation] Socket.io connected to ${this.peerProject}`);

          // Send our agent list
          this._socket.emit('federation:sync', {
            project: this.localBus.projectId,
            busId: this.localBus.busId,
            agents: this.localBus.discover(),
          });

          resolve();
        });

        this._socket.on('connect_error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      // ── Incoming events ──────────────────────────────────

      // Receive peer's agent list
      this._socket.on('federation:sync', (data) => {
        this._handleSyncData(data);
      });

      // Receive realtime agent online/offline
      this._socket.on('federation:agent-online', (agent) => {
        const globalId = `${this.peerProject}:${agent.agentId}`;
        if (!this.localBus._agents.has(globalId)) {
          this.localBus.registerGhost(globalId, {
            ...agent,
            project: this.peerProject,
            _federationPeer: this,
          });
          this.remoteAgents.push(agent);
        }
      });

      this._socket.on('federation:agent-offline', (data) => {
        const globalId = `${this.peerProject}:${data.agentId}`;
        this.localBus.unregisterGhost(globalId);
        this.remoteAgents = this.remoteAgents.filter(a => a.agentId !== data.agentId);
      });

      // Receive federated messages (realtime)
      this._socket.on('federation:message', (msg) => {
        if (msg._federation?.hops >= MAX_HOPS) return;
        if (msg._federation?.originBus === this.localBus.busId) return;
        this.localBus._deliver(msg.to, msg);
      });

      // Receive federated topic publishes
      this._socket.on('federation:topic-publish', (data) => {
        const { topic, payload, from } = data;
        // Deliver to local subscribers only (don't re-federate)
        const subs = this.localBus._topicSubs.get(topic);
        if (subs) {
          const msg = {
            id: `msg_${randomUUID()}`,
            from: from || `${this.peerProject}:unknown`,
            topic,
            type: 'broadcast',
            payload,
            timestamp: Date.now(),
            _federation: { originProject: this.peerProject, hops: 1 },
          };
          for (const agentId of subs) {
            this.localBus._deliver(agentId, msg);
          }
        }
      });

      // Reconnection handling
      this._socket.on('disconnect', () => {
        console.warn(`[Federation] Socket disconnected from ${this.peerProject}, will reconnect...`);
        this.connected = false;
      });

      this._socket.on('reconnect', () => {
        console.log(`[Federation] Socket reconnected to ${this.peerProject}`);
        this.connected = true;
        // Re-sync on reconnect
        this._socket.emit('federation:sync', {
          project: this.localBus.projectId,
          busId: this.localBus.busId,
          agents: this.localBus.discover(),
        });
      });

    } catch (err) {
      // Socket.io not available or connection failed — use REST
      if (this._socket) {
        this._socket.removeAllListeners();
        this._socket.disconnect();
        this._socket = null;
      }
      this.transport = 'rest';
      console.log(`[Federation] Socket.io unavailable for ${this.peerProject}, using REST (${err.message})`);
    }
  }

  // ── Agent Sync ─────────────────────────────────────────────────────

  async syncAgents() {
    // Socket transport: emit sync event
    if (this.transport === 'socket' && this._socket?.connected) {
      this._socket.emit('federation:sync', {
        project: this.localBus.projectId,
        busId: this.localBus.busId,
        agents: this.localBus.discover(),
      });
      // Response comes async via 'federation:sync' event
      return;
    }

    // REST transport: POST /federation/sync
    try {
      const resp = await fetch(`${this.peerUrl}/api/agent-bus/federation/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Federation-Secret': this._sign('sync'),
        },
        body: JSON.stringify({
          project: this.localBus.projectId,
          busId: this.localBus.busId,
          agents: this.localBus.discover(),
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this._handleSyncData(data);
    } catch (err) {
      console.warn(`[Federation] syncAgents REST failed for ${this.peerProject}:`, err.message);
      this.connected = false;
      throw err;
    }
  }

  _handleSyncData(data) {
    if (data.busId) this.peerBusId = data.busId;

    const remoteIds = new Set((data.agents || []).map(a => a.agentId));
    const currentIds = new Set(this.remoteAgents.map(a => a.agentId));

    // Register new ghost agents
    for (const agent of (data.agents || [])) {
      if (!currentIds.has(agent.agentId)) {
        const globalId = `${this.peerProject}:${agent.agentId}`;
        this.localBus.registerGhost(globalId, {
          ...agent,
          project: this.peerProject,
          _federationPeer: this,
        });
      }
    }

    // Unregister removed agents
    for (const agent of this.remoteAgents) {
      if (!remoteIds.has(agent.agentId)) {
        const globalId = `${this.peerProject}:${agent.agentId}`;
        this.localBus.unregisterGhost(globalId);
      }
    }

    this.remoteAgents = data.agents || [];
    this.lastSync = Date.now();
    this.connected = true;
  }

  // ── Health Check ───────────────────────────────────────────────────

  async healthCheck() {
    if (this.transport === 'socket') {
      this.connected = this._socket?.connected || false;
      this.lastHealth = Date.now();
      return;
    }

    try {
      const resp = await fetch(`${this.peerUrl}/api/agent-bus/status`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this.lastHealth = Date.now();
      this.connected = true;
    } catch (err) {
      this.connected = false;
      throw err;
    }
  }

  // ── Send Message ───────────────────────────────────────────────────

  async sendToPeer(msg) {
    const signedMsg = this._signMessage(msg);

    // Socket transport: emit
    if (this.transport === 'socket' && this._socket?.connected) {
      this._socket.emit('federation:message', signedMsg);
      return;
    }

    // REST fallback
    try {
      const resp = await fetch(`${this.peerUrl}/api/agent-bus/federation/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signedMsg),
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) {
        console.warn(`[Federation] sendToPeer REST failed: HTTP ${resp.status}`);
      }
    } catch (err) {
      console.warn(`[Federation] sendToPeer error to ${this.peerProject}:`, err.message);
    }
  }

  // ── Publish Topic (federated) ──────────────────────────────────────

  publishToPeer(topic, payload, from) {
    if (this.transport === 'socket' && this._socket?.connected) {
      this._socket.emit('federation:topic-publish', { topic, payload, from });
      return;
    }

    // REST fallback — use /federation/message with topic
    this.sendToPeer({
      id: `msg_${randomUUID()}`,
      from,
      topic,
      type: 'broadcast',
      payload,
      timestamp: Date.now(),
      _federation: {
        originBus: this.localBus.busId,
        originProject: this.localBus.projectId,
        hops: 0,
      },
    });
  }

  // ── Crypto ─────────────────────────────────────────────────────────

  _signMessage(msg) {
    const payload = JSON.stringify({
      from: msg.from, to: msg.to,
      payload: msg.payload, timestamp: msg.timestamp,
    });
    const signature = createHmac('sha256', this.secret).update(payload).digest('hex');
    return {
      ...msg,
      _federation: {
        ...(msg._federation || {}),
        originBus: msg._federation?.originBus || this.localBus.busId,
        originProject: msg._federation?.originProject || this.localBus.projectId,
        hops: (msg._federation?.hops || 0),
        signature,
      },
    };
  }

  _sign(action) {
    return createHmac('sha256', this.secret).update(`${action}:${this.localBus.busId}`).digest('hex');
  }

  toJSON() {
    return {
      peerUrl: this.peerUrl,
      peerProject: this.peerProject,
      peerBusId: this.peerBusId,
      connected: this.connected,
      transport: this.transport,
      remoteAgents: this.remoteAgents.length,
      lastSync: this.lastSync,
      lastHealth: this.lastHealth,
    };
  }
}

// ─── AgentBusFederation Manager ─────────────────────────────────────────────

class AgentBusFederation {
  constructor(localBus, options = {}) {
    this.localBus = localBus;
    this.secret = options.secret || process.env.AGENTBUS_FEDERATION_SECRET || 'dev-secret';
    this._links = new Map();
    this._mdns = null;
    this._mdnsBrowser = null;
    this._io = null; // Socket.io server instance for incoming federation

    localBus._federation = this;
    console.log(`[Federation] Manager created for project=${localBus.projectId}`);
  }

  /**
   * Start federation: Socket.io namespace + mDNS + env peers
   */
  async start(port, io) {
    this._port = port;

    // 1. Setup Socket.io federation namespace (for incoming peer connections)
    if (io) {
      this._setupSocketNamespace(io);
    }

    // 2. Try mDNS discovery
    await this._startMdns(port);

    // 3. Connect to env-configured peers
    const envPeers = process.env.AGENTBUS_PEERS;
    if (envPeers) {
      for (const peerUrl of envPeers.split(',').map(s => s.trim()).filter(Boolean)) {
        this.connectToPeer({ url: peerUrl }).catch(e =>
          console.warn(`[Federation] Env peer ${peerUrl} connect failed:`, e.message)
        );
      }
    }

    // 4. Listen for local agent changes → push to peers
    this.localBus.on('agent:registered', (agent) => {
      if (agent.transport === 'federated') return;
      this._broadcastAgentChange('online', agent);
    });
    this.localBus.on('agent:unregistered', (data) => {
      this._broadcastAgentChange('offline', data);
    });

    console.log(`[Federation] Started on port ${port} (socket.io=${!!io})`);
  }

  /**
   * Setup Socket.io namespace for INCOMING federation connections
   * (Peers connect TO us via socket.io-client)
   */
  _setupSocketNamespace(io) {
    this._io = io;
    const nsp = io.of('/agent-bus-federation');

    nsp.on('connection', (socket) => {
      const { project, busId, secret } = socket.handshake.auth || {};
      console.log(`[Federation] Incoming socket from project=${project} busId=${busId}`);

      // Store peer info on socket
      socket._peerProject = project;
      socket._peerBusId = busId;

      // Agent sync: peer sends their agents, we respond with ours
      socket.on('federation:sync', (data) => {
        // Register peer's agents as ghosts
        this._handleIncomingSync(socket, data);

        // Send our agents back
        socket.emit('federation:sync', {
          project: this.localBus.projectId,
          busId: this.localBus.busId,
          agents: this.localBus.discover(),
        });
      });

      // Incoming federated message
      socket.on('federation:message', (msg) => {
        if (msg._federation?.hops >= MAX_HOPS) return;
        if (msg._federation?.originBus === this.localBus.busId) return;
        this.localBus._deliver(msg.to, msg);
      });

      // Incoming topic publish
      socket.on('federation:topic-publish', (data) => {
        const { topic, payload, from } = data;
        const subs = this.localBus._topicSubs.get(topic);
        if (subs) {
          const msg = {
            id: `msg_${randomUUID()}`,
            from: from || `${project}:unknown`,
            topic,
            type: 'broadcast',
            payload,
            timestamp: Date.now(),
            _federation: { originProject: project, hops: 1 },
          };
          for (const agentId of subs) {
            this.localBus._deliver(agentId, msg);
          }
        }
      });

      // Disconnect — unregister ghost agents from this peer
      socket.on('disconnect', () => {
        console.log(`[Federation] Peer socket disconnected: ${project}`);
        this._removeGhostsForProject(project);
      });
    });

    console.log('[Federation] Socket.io namespace /agent-bus-federation ready');
  }

  _handleIncomingSync(socket, data) {
    const peerProject = data.project || socket._peerProject;
    if (!peerProject) return;

    const remoteAgents = data.agents || [];
    const currentGhosts = Array.from(this.localBus._agents.values())
      .filter(a => a.transport === 'federated' && a.meta?.project === peerProject);

    const remoteIds = new Set(remoteAgents.map(a => a.agentId));
    const currentIds = new Set(currentGhosts.map(a => a.meta?.originalId));

    // Register new
    for (const agent of remoteAgents) {
      if (!currentIds.has(agent.agentId)) {
        const globalId = `${peerProject}:${agent.agentId}`;
        // Create a "server-side federation link" for routing messages back
        const serverLink = {
          sendToPeer: (msg) => {
            socket.emit('federation:message', msg);
          },
          publishToPeer: (topic, payload, from) => {
            socket.emit('federation:topic-publish', { topic, payload, from });
          },
        };
        this.localBus.registerGhost(globalId, {
          ...agent,
          project: peerProject,
          _federationPeer: serverLink,
        });
      }
    }

    // Unregister removed
    for (const ghost of currentGhosts) {
      if (!remoteIds.has(ghost.meta?.originalId)) {
        this.localBus.unregisterGhost(ghost.agentId);
      }
    }
  }

  _removeGhostsForProject(project) {
    for (const [agentId, agent] of this.localBus._agents.entries()) {
      if (agent.transport === 'federated' && agent.meta?.project === project) {
        this.localBus.unregisterGhost(agentId);
      }
    }
  }

  /**
   * Connect to a specific peer (outgoing)
   */
  async connectToPeer({ url, secret, project, busId }) {
    try {
      const resp = await fetch(`${url}/api/agent-bus/status`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) throw new Error(`Peer ${url} returned HTTP ${resp.status}`);
      const status = await resp.json();

      const peerProject = project || status.projectId || 'unknown';
      const peerBusId = busId || status.busId || `peer_${randomUUID()}`;

      if (peerBusId === this.localBus.busId) {
        console.log('[Federation] Skipping self-connection');
        return null;
      }

      if (this._links.has(peerBusId)) {
        console.log(`[Federation] Already connected to ${peerProject}`);
        return this._links.get(peerBusId).toJSON();
      }

      const link = new FederationLink(url, peerProject, peerBusId, this.localBus, {
        secret: secret || this.secret,
      });
      await link.start();
      this._links.set(peerBusId, link);

      return link.toJSON();
    } catch (err) {
      console.warn(`[Federation] connectToPeer(${url}) failed:`, err.message);
      throw err;
    }
  }

  disconnectPeer(busId) {
    const link = this._links.get(busId);
    if (link) {
      link.stop();
      this._links.delete(busId);
    }
  }

  getPeers() {
    return Array.from(this._links.values()).map(l => l.toJSON());
  }

  /**
   * Broadcast agent change to all connected peers (socket + REST)
   */
  _broadcastAgentChange(event, agentData) {
    // Socket.io peers (outgoing links)
    for (const link of this._links.values()) {
      if (link.transport === 'socket' && link._socket?.connected) {
        link._socket.emit(`federation:agent-${event}`, {
          agentId: agentData.agentId,
          name: agentData.name,
          type: agentData.type,
          capabilities: agentData.capabilities,
        });
      } else if (link.connected) {
        link.syncAgents().catch(() => {});
      }
    }

    // Socket.io peers (incoming — via server namespace)
    if (this._io) {
      const nsp = this._io.of('/agent-bus-federation');
      nsp.emit(`federation:agent-${event}`, {
        agentId: agentData.agentId,
        name: agentData.name,
        type: agentData.type,
        capabilities: agentData.capabilities,
      });
    }
  }

  async _startMdns(port) {
    try {
      const { default: Bonjour } = await import('bonjour-service');
      this._mdns = new Bonjour();

      this._mdns.publish({
        name: `${this.localBus.projectId}-agentbus`,
        type: 'agentbus',
        port,
        txt: {
          project: this.localBus.projectId,
          busId: this.localBus.busId,
          version: '2',
        },
      });

      this._mdnsBrowser = this._mdns.find({ type: 'agentbus' });

      this._mdnsBrowser.on('up', (service) => {
        const peerProject = service.txt?.project;
        const peerBusId = service.txt?.busId;
        if (peerBusId === this.localBus.busId) return;
        if (this._links.has(peerBusId)) return;

        const host = service.host || service.addresses?.[0] || 'localhost';
        const peerUrl = `http://${host}:${service.port}`;

        console.log(`[Federation] mDNS discovered: ${peerProject} @ ${peerUrl}`);
        this.connectToPeer({ url: peerUrl, project: peerProject, busId: peerBusId }).catch(e =>
          console.warn('[Federation] mDNS peer connect failed:', e.message)
        );
      });

      this._mdnsBrowser.on('down', (service) => {
        const peerBusId = service.txt?.busId;
        if (peerBusId && this._links.has(peerBusId)) {
          console.log(`[Federation] mDNS peer down: ${service.txt?.project}`);
          this.disconnectPeer(peerBusId);
        }
      });

      console.log('[Federation] mDNS started');
    } catch (err) {
      console.warn('[Federation] mDNS not available:', err.message);
    }
  }

  destroy() {
    for (const link of this._links.values()) link.stop();
    this._links.clear();
    if (this._mdnsBrowser) this._mdnsBrowser.stop();
    if (this._mdns) this._mdns.destroy();
    console.log('[Federation] Destroyed');
  }
}

export { AgentBusFederation, FederationLink };
export default AgentBusFederation;
