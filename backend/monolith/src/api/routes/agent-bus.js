/**
 * AgentBus REST API for VentureOS/Fund
 *
 * Same endpoint surface as DronDoc's agent-bus routes.
 */

import { Router } from 'express';
import { getAgentBus } from '../../services/AgentBus.js';

export function createAgentBusRoutes() {
  const router = Router();

  router.post('/register', (req, res) => {
    try {
      const { agentId, name, type, capabilities, transport, meta } = req.body;
      if (!agentId) return res.status(400).json({ error: 'agentId is required' });
      const bus = getAgentBus();
      const agent = bus.register(agentId, { name, type, capabilities, transport: transport || 'rest', meta });
      res.json({ ok: true, agent });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/unregister/:id', (req, res) => {
    try {
      const bus = getAgentBus();
      res.json({ ok: bus.unregister(req.params.id) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/agents', (req, res) => {
    try {
      const bus = getAgentBus();
      const filter = {};
      if (req.query.type) filter.type = req.query.type;
      if (req.query.capability) filter.capability = req.query.capability;
      if (req.query.name) filter.name = req.query.name;
      if (req.query.project) filter.project = req.query.project;
      const agents = bus.discover(filter);
      res.json({ ok: true, agents, count: agents.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/send', (req, res) => {
    try {
      const { from, to, payload, type, ttl, priority } = req.body;
      if (!to) return res.status(400).json({ error: 'to is required' });
      const bus = getAgentBus();
      const msg = bus.send(from || 'anonymous', to, payload || {}, { type, ttl, priority });
      res.json({ ok: true, message: msg });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/publish', (req, res) => {
    try {
      const { topic, payload, from, ttl, priority } = req.body;
      if (!topic) return res.status(400).json({ error: 'topic is required' });
      const bus = getAgentBus();
      const result = bus.publish(topic, payload || {}, { from, ttl, priority });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/subscribe', (req, res) => {
    try {
      const { agentId, topic } = req.body;
      if (!agentId || !topic) return res.status(400).json({ error: 'agentId and topic are required' });
      const bus = getAgentBus();
      bus.subscribeTopic(agentId, topic);
      res.json({ ok: true, agentId, topic });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/unsubscribe', (req, res) => {
    try {
      const { agentId, topic } = req.body;
      if (!agentId || !topic) return res.status(400).json({ error: 'agentId and topic are required' });
      const bus = getAgentBus();
      bus.unsubscribeTopic(agentId, topic);
      res.json({ ok: true, agentId, topic });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/inbox/:agentId', (req, res) => {
    try {
      const bus = getAgentBus();
      const markRead = req.query.markRead === 'true';
      const limit = parseInt(req.query.limit || '50', 10);
      const messages = bus.getInbox(req.params.agentId, { markRead, limit });
      res.json({
        ok: true,
        agentId: req.params.agentId,
        messages,
        count: messages.length,
        totalInbox: bus.getInboxCount(req.params.agentId),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/request', async (req, res) => {
    try {
      const { from, to, payload, timeout } = req.body;
      if (!to) return res.status(400).json({ error: 'to is required' });
      const bus = getAgentBus();
      const result = await bus.request(from || 'anonymous', to, payload || {}, timeout || 10_000);
      res.json({ ok: true, result });
    } catch (err) {
      res.status(408).json({ error: err.message });
    }
  });

  router.post('/respond', (req, res) => {
    try {
      const { from, correlationId, payload } = req.body;
      if (!correlationId) return res.status(400).json({ error: 'correlationId is required' });
      const bus = getAgentBus();
      const ok = bus.respond(from, correlationId, payload || {});
      res.json({ ok });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/heartbeat', (req, res) => {
    try {
      const { agentId } = req.body;
      if (!agentId) return res.status(400).json({ error: 'agentId is required' });
      const bus = getAgentBus();
      res.json({ ok: bus.heartbeat(agentId) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/status', (req, res) => {
    try {
      const bus = getAgentBus();
      res.json(bus.getStatus());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Federation endpoints ─────────────────────────────────────────

  router.get('/federation/peers', (req, res) => {
    try {
      const bus = getAgentBus();
      const federation = bus._federation;
      if (!federation) return res.json({ ok: true, peers: [], count: 0 });
      const peers = federation.getPeers();
      res.json({ ok: true, peers, count: peers.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/federation/connect', async (req, res) => {
    try {
      const { url, secret } = req.body;
      if (!url) return res.status(400).json({ error: 'url is required' });
      const bus = getAgentBus();
      const federation = bus._federation;
      if (!federation) return res.status(503).json({ error: 'Federation not initialized' });
      const peer = await federation.connectToPeer({ url, secret });
      res.json({ ok: true, peer });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/federation/disconnect', (req, res) => {
    try {
      const { busId } = req.body;
      if (!busId) return res.status(400).json({ error: 'busId is required' });
      const bus = getAgentBus();
      const federation = bus._federation;
      if (!federation) return res.status(503).json({ error: 'Federation not initialized' });
      federation.disconnectPeer(busId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Receive federation messages (REST fallback for projects without Socket.io)
  router.post('/federation/message', (req, res) => {
    try {
      const msg = req.body;
      if (!msg.to) return res.status(400).json({ error: 'to is required' });
      const bus = getAgentBus();

      // Anti-loop: check hops
      if (msg._federation?.hops >= 3) {
        return res.json({ ok: false, reason: 'max hops exceeded' });
      }
      // Anti-loop: don't deliver back to origin
      if (msg._federation?.originBus === bus.busId) {
        return res.json({ ok: false, reason: 'echo prevention' });
      }

      bus._deliver(msg.to, msg);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Receive federation agent sync (REST)
  router.post('/federation/sync', (req, res) => {
    try {
      const bus = getAgentBus();
      const localAgents = bus.discover();
      res.json({
        ok: true,
        project: bus.projectId,
        busId: bus.busId,
        agents: localAgents,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
