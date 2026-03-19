/**
 * AgentBusFederation — P2P federation manager for AgentBus
 *
 * Handles:
 * - mDNS service discovery (LAN zero-config)
 * - Manual peer connections (env/REST)
 * - REST-based federation transport (Socket.io optional)
 * - Ghost agent registration/unregistration
 * - Federated message routing
 * - Topic federation
 * - HMAC message signing
 *
 * Works with any AgentBus instance that has:
 *   .projectId, .busId, .discover(), .registerGhost(), .unregisterGhost(), ._deliver()
 */

import { createHmac } from 'crypto';
import { randomUUID } from 'crypto';

const MAX_HOPS = 3;
const SYNC_INTERVAL = 30_000;   // re-sync agent lists every 30s
const HEALTH_INTERVAL = 15_000; // health check every 15s

class FederationLink {
  constructor(peerUrl, peerProject, peerBusId, localBus, options = {}) {
    this.peerUrl = peerUrl.replace(/\/$/, '');
    this.peerProject = peerProject;
    this.peerBusId = peerBusId;
    this.localBus = localBus;
    this.secret = options.secret || process.env.AGENTBUS_FEDERATION_SECRET || 'dev-secret';
    this.connected = false;
    this.lastSync = 0;
    this.lastHealth = 0;
    this.remoteAgents = []; // cached list of remote agents

    this._syncTimer = null;
    this._healthTimer = null;
  }

  async start() {
    // Initial sync
    await this.syncAgents();

    // Periodic sync
    this._syncTimer = setInterval(() => this.syncAgents().catch(e =>
      console.warn(`[Federation] Sync error with ${this.peerProject}:`, e.message)
    ), SYNC_INTERVAL);

    // Health check
    this._healthTimer = setInterval(() => this.healthCheck().catch(e => {
      console.warn(`[Federation] Health check failed for ${this.peerProject}:`, e.message);
      this.connected = false;
    }), HEALTH_INTERVAL);

    this.connected = true;
    console.log(`[Federation] Link established: ${this.peerProject} @ ${this.peerUrl}`);
  }

  stop() {
    if (this._syncTimer) clearInterval(this._syncTimer);
    if (this._healthTimer) clearInterval(this._healthTimer);

    // Remove ghost agents
    for (const agent of this.remoteAgents) {
      const globalId = `${this.peerProject}:${agent.agentId}`;
      this.localBus.unregisterGhost(globalId);
    }
    this.remoteAgents = [];
    this.connected = false;
    console.log(`[Federation] Link stopped: ${this.peerProject}`);
  }

  async syncAgents() {
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

      if (data.busId) this.peerBusId = data.busId;

      // Diff: find new agents, removed agents
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
    } catch (err) {
      console.warn(`[Federation] syncAgents failed for ${this.peerProject}:`, err.message);
      this.connected = false;
      throw err;
    }
  }

  async healthCheck() {
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

  async sendToPeer(msg) {
    try {
      // Sign message
      const signedMsg = this._signMessage(msg);

      const resp = await fetch(`${this.peerUrl}/api/agent-bus/federation/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signedMsg),
        signal: AbortSignal.timeout(5000),
      });

      if (!resp.ok) {
        console.warn(`[Federation] sendToPeer failed: HTTP ${resp.status}`);
      }
    } catch (err) {
      console.warn(`[Federation] sendToPeer error to ${this.peerProject}:`, err.message);
    }
  }

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
      remoteAgents: this.remoteAgents.length,
      lastSync: this.lastSync,
      lastHealth: this.lastHealth,
    };
  }
}


class AgentBusFederation {
  constructor(localBus, options = {}) {
    this.localBus = localBus;
    this.secret = options.secret || process.env.AGENTBUS_FEDERATION_SECRET || 'dev-secret';
    this._links = new Map(); // peerBusId → FederationLink
    this._mdns = null;
    this._mdnsBrowser = null;

    // Wire federation into bus
    localBus._federation = this;

    console.log(`[Federation] Manager created for project=${localBus.projectId}`);
  }

  /**
   * Start federation: mDNS advertisement + discovery + env peers
   */
  async start(port) {
    this._port = port;

    // 1. Try mDNS discovery
    await this._startMdns(port);

    // 2. Connect to env-configured peers
    const envPeers = process.env.AGENTBUS_PEERS;
    if (envPeers) {
      for (const peerUrl of envPeers.split(',').map(s => s.trim()).filter(Boolean)) {
        this.connectToPeer({ url: peerUrl }).catch(e =>
          console.warn(`[Federation] Env peer ${peerUrl} connect failed:`, e.message)
        );
      }
    }

    // 3. Listen for agent changes and notify peers
    this.localBus.on('agent:registered', (agent) => {
      if (agent.transport === 'federated') return; // don't echo ghost agents
      this._notifyPeersAgentChange('online', agent);
    });
    this.localBus.on('agent:unregistered', (data) => {
      this._notifyPeersAgentChange('offline', data);
    });

    console.log(`[Federation] Started on port ${port}`);
  }

  /**
   * Connect to a specific peer by URL
   */
  async connectToPeer({ url, secret, project, busId }) {
    // First, probe the peer to get its identity
    try {
      const resp = await fetch(`${url}/api/agent-bus/status`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) throw new Error(`Peer ${url} returned HTTP ${resp.status}`);
      const status = await resp.json();

      const peerProject = project || status.projectId || 'unknown';
      const peerBusId = busId || status.busId || `peer_${randomUUID()}`;

      // Don't connect to ourselves
      if (peerBusId === this.localBus.busId) {
        console.log('[Federation] Skipping self-connection');
        return null;
      }

      // Don't duplicate connections
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

  /**
   * Disconnect a peer
   */
  disconnectPeer(busId) {
    const link = this._links.get(busId);
    if (link) {
      link.stop();
      this._links.delete(busId);
    }
  }

  /**
   * Get all peer connections
   */
  getPeers() {
    return Array.from(this._links.values()).map(l => l.toJSON());
  }

  /**
   * Notify peers about agent changes
   */
  async _notifyPeersAgentChange(event, agentData) {
    // Trigger re-sync on all peers (lightweight approach)
    for (const link of this._links.values()) {
      if (link.connected) {
        link.syncAgents().catch(() => {}); // best-effort
      }
    }
  }

  /**
   * Start mDNS advertisement and discovery
   */
  async _startMdns(port) {
    try {
      const { default: Bonjour } = await import('bonjour-service');
      this._mdns = new Bonjour();

      // Advertise ourselves
      this._mdns.publish({
        name: `${this.localBus.projectId}-agentbus`,
        type: 'agentbus',
        port,
        txt: {
          project: this.localBus.projectId,
          busId: this.localBus.busId,
          version: '1',
        },
      });

      // Discover peers
      this._mdnsBrowser = this._mdns.find({ type: 'agentbus' });

      this._mdnsBrowser.on('up', (service) => {
        const peerProject = service.txt?.project;
        const peerBusId = service.txt?.busId;

        // Skip self
        if (peerBusId === this.localBus.busId) return;
        if (this._links.has(peerBusId)) return;

        const host = service.host || service.addresses?.[0] || 'localhost';
        const peerUrl = `http://${host}:${service.port}`;

        console.log(`[Federation] mDNS discovered: ${peerProject} @ ${peerUrl}`);
        this.connectToPeer({ url: peerUrl, project: peerProject, busId: peerBusId }).catch(e =>
          console.warn(`[Federation] mDNS peer connect failed:`, e.message)
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
      console.warn('[Federation] mDNS not available (install bonjour-service for LAN discovery):', err.message);
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    for (const link of this._links.values()) {
      link.stop();
    }
    this._links.clear();

    if (this._mdnsBrowser) this._mdnsBrowser.stop();
    if (this._mdns) this._mdns.destroy();

    console.log('[Federation] Destroyed');
  }
}

export { AgentBusFederation, FederationLink };
export default AgentBusFederation;
