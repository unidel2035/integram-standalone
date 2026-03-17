/**
 * Claude Memory API — единая память для всех сессий Claude Code
 *
 * POST /save            — сохранить запись (+ auto doublet links)
 * GET  /search?q=       — семантический + текстовый поиск (с memory decay)
 * POST /remember        — LLM нарратив (вспомнить)
 * GET  /list            — все записи
 * POST /sync            — синхронизировать .md файлы → Integram+KAG
 * POST /compact         — LSM compaction: raw → patterns → insights
 * GET  /stats           — статистика (+ doublets)
 * GET  /doublets/:id    — связи записи
 * GET  /shared-state    — кросс-сессионный shared context
 * PUT  /shared-state    — обновить shared state
 * DELETE /shared-state  — очистить shared state
 */

import { Router } from 'express';
import { getClaudeMemoryService } from '../../services/claude-memory/ClaudeMemoryService.js';
import logger from '../../utils/logger.js';

let _service = null;
async function getService() {
  if (!_service) {
    _service = getClaudeMemoryService();
    await _service.init();
  }
  return _service;
}

export function createClaudeMemoryRoutes() {
  const router = Router();

  // Сохранить память
  router.post('/save', async (req, res) => {
    try {
      const svc = await getService();
      const { type, name, content, tags, session } = req.body;
      if (!name || !content) {
        return res.status(400).json({ error: 'name and content required' });
      }
      const result = await svc.save({
        type: type || 'project',
        name,
        content,
        tags: tags || [],
        session: session || req.headers['x-claude-session'] || '?',
      });
      res.json({ success: true, data: result });
    } catch (e) {
      logger.error('[claude-memory] save error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // Семантический поиск
  router.get('/search', async (req, res) => {
    try {
      const svc = await getService();
      const q = req.query.q || req.query.query || '';
      const limit = parseInt(req.query.limit) || 15;
      if (!q) return res.status(400).json({ error: 'q parameter required' });
      const results = await svc.search(q, limit);
      res.json({ success: true, data: results, count: results.length });
    } catch (e) {
      logger.error('[claude-memory] search error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // LLM нарратив — вспомнить
  router.post('/remember', async (req, res) => {
    try {
      const svc = await getService();
      const { question, limit, model } = req.body;
      if (!question) return res.status(400).json({ error: 'question required' });
      const result = await svc.remember(question, { limit, model });
      res.json({ success: true, data: result });
    } catch (e) {
      logger.error('[claude-memory] remember error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // Все записи
  router.get('/list', async (req, res) => {
    try {
      const svc = await getService();
      const limit = parseInt(req.query.limit) || 100;
      const records = await svc.list(limit);
      res.json({ success: true, data: records, count: records.length });
    } catch (e) {
      logger.error('[claude-memory] list error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // Синхронизировать .md файлы → Integram + KAG
  router.post('/sync', async (req, res) => {
    try {
      const svc = await getService();
      const dir = req.body.dir || undefined;
      const result = await svc.syncFromFiles(dir);
      res.json({ success: true, data: result });
    } catch (e) {
      logger.error('[claude-memory] sync error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // Статистика (+ doublets)
  router.get('/stats', async (req, res) => {
    try {
      const svc = await getService();
      const stats = await svc.stats();
      stats.doublets = await svc.getDoubletStats();
      stats.sharedStateKeys = Object.keys(svc.getSharedState());
      res.json({ success: true, data: stats });
    } catch (e) {
      logger.error('[claude-memory] stats error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // LSM Compaction: raw → patterns → insights
  router.post('/compact', async (req, res) => {
    try {
      const svc = await getService();
      const result = await svc.compact(req.body || {});
      res.json({ success: true, data: result });
    } catch (e) {
      logger.error('[claude-memory] compact error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // Doublet links для записи
  router.get('/doublets/:id', async (req, res) => {
    try {
      const svc = await getService();
      const links = await svc.getDoublets(req.params.id);
      res.json({ success: true, data: links, count: links.length });
    } catch (e) {
      logger.error('[claude-memory] doublets error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // Cross-session shared state
  router.get('/shared-state', async (req, res) => {
    try {
      const svc = await getService();
      const key = req.query.key;
      const data = key ? svc.getSharedState(key) : svc.getSharedState();
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.put('/shared-state', async (req, res) => {
    try {
      const svc = await getService();
      const { key, value, session } = req.body;
      if (!key) return res.status(400).json({ error: 'key required' });
      const result = await svc.setSharedState(key, value, session || req.headers['x-claude-session'] || '?');
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete('/shared-state', async (req, res) => {
    try {
      const svc = await getService();
      await svc.deleteSharedState(req.query.key);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
