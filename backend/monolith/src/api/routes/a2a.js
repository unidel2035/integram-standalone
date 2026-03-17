/**
 * A2A Protocol API Routes
 *
 * REST endpoints implementing Google A2A-compatible protocol.
 * Enables agent-to-agent communication, task routing, and discovery.
 */

import { Router } from 'express';
import { getA2AProtocol, createAgentCard, TaskState } from '../../services/a2a/A2AProtocol.js';
import { getCryptoReceiptService } from '../../services/receipts/CryptoReceiptService.js';
import { getAgentTaxonomy } from '../../services/agents/AgentTaxonomy.js';

export function createA2ARoutes() {
  const router = Router();
  const a2a = getA2AProtocol({ receiptService: getCryptoReceiptService() });
  const taxonomy = getAgentTaxonomy();

  // ── Agent Registration ─────────────────────────────────────────────────

  /**
   * POST /register — Register an agent with Agent Card
   */
  router.post('/register', (req, res) => {
    try {
      const { agentId, name, description, url, version, capabilities, skills, authentication, taxonomy: taxInfo } = req.body;
      if (!agentId || !name) return res.status(400).json({ error: 'agentId and name required' });

      const card = createAgentCard({ name, description, url, version, capabilities, skills, authentication });
      const agent = a2a.registerAgent(agentId, card);

      // Auto-classify if taxonomy info provided
      if (taxInfo) {
        taxonomy.classify(agentId, { ...taxInfo, name, description });
      }

      res.json({ ok: true, agent });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * DELETE /agents/:agentId — Deregister an agent
   */
  router.delete('/agents/:agentId', (req, res) => {
    const ok = a2a.deregisterAgent(req.params.agentId);
    res.json({ ok });
  });

  /**
   * POST /agents/:agentId/heartbeat — Agent heartbeat
   */
  router.post('/agents/:agentId/heartbeat', (req, res) => {
    const ok = a2a.heartbeat(req.params.agentId);
    res.json({ ok });
  });

  /**
   * GET /agents — List agents (optional filters: capability, skill, status)
   */
  router.get('/agents', (req, res) => {
    const agents = a2a.listAgents(req.query);
    res.json({ agents, total: agents.length });
  });

  /**
   * GET /agents/:agentId — Get Agent Card
   */
  router.get('/agents/:agentId', (req, res) => {
    const agent = a2a.getAgentCard(req.params.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const classification = taxonomy.getClassification(req.params.agentId);
    res.json({ agent, classification });
  });

  /**
   * GET /agents/search/:skillQuery — Find agents by skill
   */
  router.get('/agents/search/:skillQuery', (req, res) => {
    const results = a2a.findAgentsBySkill(req.params.skillQuery);
    res.json({ results, total: results.length });
  });

  // ── Task Management ────────────────────────────────────────────────────

  /**
   * POST /tasks/send — Send a task to an agent
   */
  router.post('/tasks/send', (req, res) => {
    try {
      const { fromAgent, toAgent, message, metadata } = req.body;
      if (!fromAgent || !toAgent || !message) {
        return res.status(400).json({ error: 'fromAgent, toAgent, and message required' });
      }
      const task = a2a.sendTask({ fromAgent, toAgent, message, metadata });
      res.json({ ok: true, task });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /tasks/route — Route task to best agent by skill
   */
  router.post('/tasks/route', (req, res) => {
    try {
      const { fromAgent, skillRequired, message, metadata } = req.body;
      if (!fromAgent || !skillRequired || !message) {
        return res.status(400).json({ error: 'fromAgent, skillRequired, and message required' });
      }
      const task = a2a.routeTask({ fromAgent, skillRequired, message, metadata });
      res.json({ ok: true, task });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  /**
   * GET /tasks/:taskId — Get task status
   */
  router.get('/tasks/:taskId', (req, res) => {
    const task = a2a.getTask(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  });

  /**
   * POST /tasks/:taskId/start — Agent starts working on task
   */
  router.post('/tasks/:taskId/start', (req, res) => {
    try {
      const { agentId } = req.body;
      const task = a2a.startTask(req.params.taskId, agentId);
      res.json({ ok: true, task });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  /**
   * POST /tasks/:taskId/message — Add message to task
   */
  router.post('/tasks/:taskId/message', (req, res) => {
    try {
      const { agentId, message } = req.body;
      const msg = a2a.addMessage(req.params.taskId, agentId, message);
      res.json({ ok: true, message: msg });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  /**
   * POST /tasks/:taskId/artifact — Add artifact to task
   */
  router.post('/tasks/:taskId/artifact', (req, res) => {
    try {
      const { agentId, artifact } = req.body;
      const art = a2a.addArtifact(req.params.taskId, agentId, artifact);
      res.json({ ok: true, artifact: art });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  /**
   * POST /tasks/:taskId/complete — Complete a task
   */
  router.post('/tasks/:taskId/complete', (req, res) => {
    try {
      const { agentId, finalMessage, artifacts } = req.body;
      const task = a2a.completeTask(req.params.taskId, agentId, { finalMessage, artifacts });
      res.json({ ok: true, task });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  /**
   * POST /tasks/:taskId/fail — Fail a task
   */
  router.post('/tasks/:taskId/fail', (req, res) => {
    try {
      const { agentId, error } = req.body;
      const task = a2a.failTask(req.params.taskId, agentId, error);
      res.json({ ok: true, task });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  /**
   * POST /tasks/:taskId/cancel — Cancel a task
   */
  router.post('/tasks/:taskId/cancel', (req, res) => {
    try {
      const task = a2a.cancelTask(req.params.taskId, req.body.reason);
      res.json({ ok: true, task });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  /**
   * GET /tasks — List tasks for agent
   */
  router.get('/tasks', (req, res) => {
    const { agentId, state } = req.query;
    if (!agentId) return res.status(400).json({ error: 'agentId query param required' });
    const tasks = a2a.getTasksByAgent(agentId, { state });
    res.json({ tasks, total: tasks.length });
  });

  // ── Stats & Dashboard ──────────────────────────────────────────────────

  /**
   * GET /stats — Protocol statistics
   */
  router.get('/stats', (req, res) => {
    res.json(a2a.getStats());
  });

  // ── Taxonomy ───────────────────────────────────────────────────────────

  /**
   * POST /taxonomy/classify — Classify an agent
   */
  router.post('/taxonomy/classify', (req, res) => {
    try {
      const classification = taxonomy.classify(req.body.agentId, req.body);
      res.json({ ok: true, classification });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /taxonomy/agents — Find classified agents
   */
  router.get('/taxonomy/agents', (req, res) => {
    const results = taxonomy.findAgents(req.query);
    res.json({ agents: results, total: results.length });
  });

  /**
   * GET /taxonomy/dashboard — Workforce dashboard
   */
  router.get('/taxonomy/dashboard', (req, res) => {
    res.json(taxonomy.getWorkforceDashboard());
  });

  /**
   * GET /taxonomy/tree — Full taxonomy tree for UI
   */
  router.get('/taxonomy/tree', (req, res) => {
    res.json(taxonomy.getTaxonomyTree());
  });

  /**
   * GET /taxonomy/templates — Available agent templates
   */
  router.get('/taxonomy/templates', (req, res) => {
    res.json({ templates: taxonomy.getTemplates() });
  });

  /**
   * GET /taxonomy/agents/:agentId/governance — Governance policy for agent
   */
  router.get('/taxonomy/agents/:agentId/governance', (req, res) => {
    const policy = taxonomy.getGovernancePolicy(req.params.agentId);
    if (!policy) return res.status(404).json({ error: 'Agent not classified' });
    res.json(policy);
  });

  // ── Receipts ───────────────────────────────────────────────────────────

  const receipts = getCryptoReceiptService();

  /**
   * GET /receipts — Query receipts
   */
  router.get('/receipts', (req, res) => {
    const { agentId, action, targetId, from, to, limit, offset } = req.query;
    const result = receipts.query({
      agentId, action, targetId, from, to,
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0,
    });
    res.json(result);
  });

  /**
   * GET /receipts/stats — Receipt statistics
   */
  router.get('/receipts/stats', (req, res) => {
    res.json(receipts.getStats());
  });

  /**
   * GET /receipts/:receiptId — Get single receipt
   */
  router.get('/receipts/:receiptId', (req, res) => {
    const receipt = receipts.getReceipt(req.params.receiptId);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    res.json({ receipt });
  });

  /**
   * POST /receipts/:receiptId/verify — Verify a receipt
   */
  router.post('/receipts/:receiptId/verify', (req, res) => {
    const result = receipts.verifyReceipt(req.params.receiptId);
    res.json(result);
  });

  /**
   * POST /receipts/verify-chain — Verify chain integrity
   */
  router.post('/receipts/verify-chain', (req, res) => {
    const { fromIndex, toIndex } = req.body;
    const result = receipts.verifyChain({ fromIndex, toIndex });
    res.json(result);
  });

  /**
   * GET /receipts/export/chain — Export receipt chain for external audit
   */
  router.get('/receipts/export/chain', (req, res) => {
    const { from, to } = req.query;
    const chain = receipts.exportChain({
      from: parseInt(from) || 0,
      to: to ? parseInt(to) : undefined,
    });
    res.json(chain);
  });

  /**
   * GET /receipts/agent/:agentId — Get receipts for specific agent
   */
  router.get('/receipts/agent/:agentId', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const agentReceipts = receipts.getAgentReceipts(req.params.agentId, { limit });
    res.json({ receipts: agentReceipts, total: agentReceipts.length });
  });

  return router;
}

export default createA2ARoutes;
