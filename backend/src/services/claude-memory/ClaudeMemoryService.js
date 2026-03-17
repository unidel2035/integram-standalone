/**
 * ClaudeMemoryService — единая память для всех сессий Claude Code
 *
 * Три слоя (как AnamnesisMemory):
 *   1. ФАКТЫ → Integram V2 (3 таблицы, JSON в val)
 *   2. СЕМАНТИКА → KAG (EmbeddingService + SQLiteVectorStore)
 *   3. НАРРАТИВ → Kodacode LLM (пере-проживание)
 *
 * Хранилища (ВСЁ в Integram V2):
 *   - "КлодПамять" — записи памяти (type/name/content/tags/session/timestamp as JSON)
 *   - "КлодСвязи" — дублеты (source/target/kind/data/score)
 *   - "КлодСтейт" — shared state (key/value/session/timestamp)
 *
 * Формат val: JSON-строка со всеми полями.
 * V2 endpoint /types/{id}/objects используется для листинга (V1 не работает с новыми типами).
 */

import { IntegramV2Client } from '../integram/integram-v2-client.js';
import { getEmbeddingService } from '../kag/EmbeddingService.js';
import { getSQLiteVectorStore } from '../kag/SQLiteVectorStore.js';
let OpenAI = null;
try { OpenAI = (await import('openai')).default; } catch { /* optional */ }
import logger from '../../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

const TABLE_MEMORY = 'КлодПамять';
const TABLE_DOUBLETS = 'КлодСвязи';
const TABLE_STATE = 'КлодСтейт';
const VECTOR_COLLECTION = 'claude_memory';
const VALID_DOUBLET_KINDS = ['same_as', 'similar_to', 'part_of', 'derived_from'];

const MEMORY_DIR = path.resolve(
  process.env.HOME || '/home/hive',
  '.claude/projects/-home-hive-fund/memory'
);

const RECALL_SYSTEM = `Ты — Память фонда ФСТ НТИ (VentureOS). Тебе дан вопрос и набор записей из памяти Claude Code (заметки, решения, обратная связь, контекст проекта).

Правила:
- Ответь прозой, по-русски, 3-7 предложений
- Не перечисляй записи — рассказывай связную историю
- Если видишь паттерн или противоречие — назови
- Если нет данных — скажи прямо
- Будь конкретен: имена файлов, решения, даты`;

export class ClaudeMemoryService {
  constructor() {
    this.v2 = new IntegramV2Client('kval');
    this._ready = false;

    // Table IDs (filled on init)
    this._memTypeId = null;
    this._dblTypeId = null;
    this._stTypeId = null;

    // KAG semantic layer
    this._embeddings = getEmbeddingService();
    this._vectors = getSQLiteVectorStore({ collectionName: VECTOR_COLLECTION });
    this._kagReady = false;

    // In-memory cache for shared state (warmed from Integram on init)
    this._sharedState = {};
  }

  // ─────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────

  async init() {
    try {
      this._memTypeId = await this._ensureType(TABLE_MEMORY);
      this._dblTypeId = await this._ensureType(TABLE_DOUBLETS);
      this._stTypeId = await this._ensureType(TABLE_STATE);
      this._ready = true;
      logger.info(`[ClaudeMemory] V2 ready: mem=${this._memTypeId}, dbl=${this._dblTypeId}, st=${this._stTypeId}`);
    } catch (e) {
      logger.warn(`[ClaudeMemory] Integram V2 init failed: ${e.message}`);
    }

    // KAG
    try {
      await this._vectors.initialize();
      this._kagReady = true;
      const count = await this._vectors.count();
      logger.info(`[ClaudeMemory] KAG ready, vectors=${count}`);
    } catch (e) {
      logger.warn(`[ClaudeMemory] KAG init failed: ${e.message}`);
    }

    // Warm shared state
    if (this._ready && this._stTypeId) {
      try { await this._loadSharedState(); } catch (e) {
        logger.warn(`[ClaudeMemory] shared state load failed: ${e.message}`);
      }
    }
  }

  /**
   * Find or create a type by name.
   * Data is stored as JSON in val — no columns needed.
   */
  async _ensureType(name) {
    const found = await this.v2.findTypeByName(name);
    const exact = found.find(t => t.name === name);
    if (exact) return String(exact.id);
    return await this.v2.createType(name, 3);
  }

  /**
   * List all objects from a type via V2 endpoint (V1 object/{typeId} doesn't work with new types).
   */
  /**
   * Decode HTML entities that Integram may inject into val fields.
   */
  _decodeHtml(str) {
    return str.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");
  }

  async _listObjects(typeId, limit = 500) {
    const objects = await this.v2.getObjects(typeId, { limit, withReqs: false });
    return objects.map(obj => {
      let data = {};
      const raw = obj.val || '{}';
      try {
        data = JSON.parse(raw);
      } catch {
        // Try decoding HTML entities first
        try { data = JSON.parse(this._decodeHtml(raw)); } catch {
          // Legacy non-JSON val: parse "[type] name" format
          const m = raw.match(/^\[(\w+)\]\s*(.*)$/);
          data = m ? { type: m[1], name: m[2], content: raw } : { name: raw, content: raw };
        }
      }
      return { id: obj.id, ...data };
    });
  }

  /**
   * Create object with JSON val.
   * Handles V1 response quirks (sometimes returns string instead of parsed JSON).
   */
  async _createObject(typeId, data) {
    const val = JSON.stringify(data);
    await this.v2._ensureV1Auth();
    const result = await this.v2._v1Post(`_m_new/${typeId}`, { [`t${typeId}`]: val, up: 1 });
    // V1 response may be string with HTML entities; extract obj/id with regex fallback
    let objId;
    if (typeof result === 'object' && result !== null) {
      objId = result.obj || result.id;
    } else if (typeof result === 'string') {
      // Try JSON.parse first
      try { const p = JSON.parse(result); objId = p.obj || p.id; } catch {
        // Regex fallback: extract "obj":12345 or "id":12345
        const m = result.match(/"obj"\s*:\s*(\d+)/) || result.match(/"id"\s*:\s*(\d+)/);
        if (m) objId = m[1];
      }
    }
    if (!objId) throw new Error(`_m_new returned no ID: ${JSON.stringify(parsed).slice(0, 200)}`);
    return { id: String(objId), value: val };
  }

  // ─────────────────────────────────────────────
  // SAVE — сохранить память
  // ─────────────────────────────────────────────

  async save({ type, name, content, tags = [], session = '?' }) {
    const timestamp = new Date().toISOString();
    const tagsStr = Array.isArray(tags) ? tags.join(',') : String(tags || '');

    // 1. Integram V2
    if (this._ready && this._memTypeId) {
      try {
        await this._createObject(this._memTypeId, {
          type, name, content, tags: tagsStr, session, timestamp,
        });
      } catch (e) {
        logger.warn(`[ClaudeMemory] Integram write failed: ${e.message}`);
      }
    }

    // 2. KAG embedding (fire-and-forget — не блокируем save)
    if (this._kagReady && content) {
      const text = `[${type}] ${name}: ${content}`;
      const id = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      this._embeddings.embed(text).then(embedding =>
        this._vectors.addDocument(id, embedding, { type, name, tags: tagsStr, session, timestamp }, text)
      ).catch(e => logger.warn(`[ClaudeMemory] KAG embed failed: ${e.message}`));
    }

    // 3. Doublet auto-links (fire-and-forget)
    const docId = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this._createDoubletLinks(docId, name, type, content).catch(() => {});

    return { ok: true, type, name, timestamp };
  }

  // ─────────────────────────────────────────────
  // SEARCH — семантический + текстовый
  // ─────────────────────────────────────────────

  async search(query, limit = 15) {
    const [semantic, text] = await Promise.allSettled([
      this._searchSemantic(query, limit),
      this._searchText(query, limit),
    ]);

    const semResults = semantic.status === 'fulfilled' ? semantic.value : [];
    const txtResults = text.status === 'fulfilled' ? text.value : [];

    const seen = new Set();
    const merged = [];
    for (const r of [...semResults, ...txtResults]) {
      const key = r.name || r.text?.slice(0, 60) || r.id;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(r);
      }
    }
    const sorted = merged.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, limit);
    return this._applyDecay(sorted);
  }

  async _searchSemantic(query, limit) {
    if (!this._kagReady) return [];
    try {
      const qEmb = await this._embeddings.embed(query);
      const results = await this._vectors.search(qEmb, { limit });
      return results
        .filter(r => r.score > 0.25)
        .map(r => ({
          id: r.id, text: r.document,
          name: r.metadata?.name || '', type: r.metadata?.type || '',
          score: r.score, source: 'semantic', ...r.metadata,
        }));
    } catch (e) {
      logger.warn('[ClaudeMemory] semantic search error:', e.message);
      return [];
    }
  }

  async _searchText(query, limit) {
    if (!this._ready || !this._memTypeId) return [];
    try {
      const all = await this._listObjects(this._memTypeId, limit * 3);
      const qLower = query.toLowerCase();
      const qWords = qLower.split(/\s+/).filter(w => w.length > 2);
      return all
        .map(obj => {
          const haystack = `${obj.name || ''} ${obj.content || ''} ${obj.type || ''}`.toLowerCase();
          const matched = qWords.filter(w => haystack.includes(w)).length;
          const score = qWords.length > 0 ? matched / qWords.length : 0;
          return {
            id: obj.id, text: `[${obj.type}] ${obj.name}`,
            name: obj.name, type: obj.type, content: obj.content,
            tags: obj.tags, session: obj.session, timestamp: obj.timestamp,
            score: Math.round(score * 100) / 100, source: 'text',
          };
        })
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (e) {
      logger.warn('[ClaudeMemory] text search error:', e.message);
      return [];
    }
  }

  // ─────────────────────────────────────────────
  // REMEMBER — LLM нарратив
  // ─────────────────────────────────────────────

  async remember(question, opts = {}) {
    let source = await this.search(question, opts.limit || 20);

    if (source.length === 0) {
      return { narrative: 'Память пуста. Нет записей по этому вопросу.', memories: [] };
    }

    const chronicle = source.map(m =>
      `[${m.type || '?'}] ${m.name || ''}${m.score ? ` (rel: ${m.score.toFixed(2)})` : ''}\n${m.text || ''}`
    ).join('\n---\n');

    try {
      const token = process.env.KODACODE_TOKENS?.split(',')[0]?.trim() || process.env.GITHUB_TOKEN || '';
      const client = new OpenAI({
        apiKey: token,
        baseURL: 'https://api.kodacode.ru/v1',
        defaultHeaders: { 'HTTP-Referer': 'https://dev.drondoc.ru', 'X-Title': 'DronDoc ClaudeMemory' },
      });

      const response = await client.chat.completions.create({
        model: opts.model || 'koda-pro',
        messages: [
          { role: 'system', content: RECALL_SYSTEM },
          { role: 'user', content: `Вопрос: ${question}\n\nЗАПИСИ ПАМЯТИ (${source.length}):\n${chronicle}` },
        ],
        temperature: 0.5,
        max_tokens: 600,
      });

      return {
        narrative: response.choices[0]?.message?.content || 'Молчание.',
        memories: source,
      };
    } catch (e) {
      logger.error('[ClaudeMemory] LLM error:', e.message);
      return {
        narrative: `Агент молчит (${e.message}). Записи:\n${chronicle}`,
        memories: source,
      };
    }
  }

  // ─────────────────────────────────────────────
  // LIST — все записи
  // ─────────────────────────────────────────────

  async list(limit = 100) {
    if (!this._ready || !this._memTypeId) return [];
    try {
      const objs = await this._listObjects(this._memTypeId, limit);
      return objs.map(obj => ({
        id: obj.id, text: `[${obj.type}] ${obj.name}`,
        name: obj.name, type: obj.type, content: obj.content,
        tags: obj.tags, session: obj.session, timestamp: obj.timestamp,
      }));
    } catch (e) {
      logger.warn('[ClaudeMemory] list error:', e.message);
      return [];
    }
  }

  // ─────────────────────────────────────────────
  // SYNC — .md файлы → Integram + KAG
  // ─────────────────────────────────────────────

  async syncFromFiles(memoryDir = MEMORY_DIR) {
    let synced = 0;
    let skipped = 0;

    try {
      const files = await fs.readdir(memoryDir);
      const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'MEMORY.md');

      for (const file of mdFiles) {
        const filePath = path.join(memoryDir, file);
        const raw = await fs.readFile(filePath, 'utf-8');

        const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (!frontmatterMatch) { skipped++; continue; }

        const meta = {};
        for (const line of frontmatterMatch[1].split('\n')) {
          const [key, ...rest] = line.split(':');
          if (key && rest.length) meta[key.trim()] = rest.join(':').trim();
        }

        const content = frontmatterMatch[2].trim();
        const name = meta.name || file.replace('.md', '');
        const type = meta.type || 'project';
        const tags = meta.description ? [meta.description.slice(0, 80)] : [];

        if (this._kagReady) {
          try {
            const existing = await this._searchSemantic(name, 1);
            if (existing.length > 0 && existing[0].score > 0.9) { skipped++; continue; }
          } catch { /* proceed */ }
        }

        await this.save({ type, name, content, tags, session: 'sync' });
        synced++;
      }
    } catch (e) {
      logger.warn(`[ClaudeMemory] syncFromFiles error: ${e.message}`);
    }

    logger.info(`[ClaudeMemory] Sync complete: ${synced} synced, ${skipped} skipped`);
    return { synced, skipped };
  }

  // ─────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────

  async stats() {
    const result = { ready: this._ready, kagReady: this._kagReady };

    if (this._ready && this._memTypeId) {
      try {
        const all = await this._listObjects(this._memTypeId, 5000);
        result.integram = {
          table: TABLE_MEMORY,
          typeId: this._memTypeId,
          count: all.length,
        };
      } catch (e) {
        result.integram = { error: e.message };
      }
    }

    if (this._kagReady) {
      try {
        result.kag = {
          vectors: await this._vectors.count(),
          provider: this._embeddings.activeProvider,
          dimensions: this._embeddings.activeDimensions,
        };
      } catch (e) {
        result.kag = { error: e.message };
      }
    }

    return result;
  }

  // ─────────────────────────────────────────────
  // MEMORY DECAY — возрастное затухание
  // ─────────────────────────────────────────────

  _applyDecay(results) {
    const now = Date.now();
    const DAY_MS = 86400000;
    return results.map(r => {
      const ts = r.timestamp ? new Date(r.timestamp).getTime() : now;
      const ageDays = Math.max(0, (now - ts) / DAY_MS);
      const decay = Math.pow(2, -ageDays / 30);
      const decayedScore = (r.score || 0) * 0.7 + decay * 0.3;
      return { ...r, score: Math.round(decayedScore * 1000) / 1000, _ageDays: Math.round(ageDays), _decay: Math.round(decay * 100) / 100 };
    }).sort((a, b) => b.score - a.score);
  }

  async searchWithDecay(query, limit = 15) {
    const raw = await this.search(query, limit * 2);
    return this._applyDecay(raw).slice(0, limit);
  }

  // ─────────────────────────────────────────────
  // DOUBLET STORE — Integram V2 ("КлодСвязи")
  // ─────────────────────────────────────────────

  async createDoublet(source, target, kind = 'same_as', data = {}) {
    if (!source || !target) throw new Error('source and target required');
    if (!VALID_DOUBLET_KINDS.includes(kind)) {
      throw new Error(`Invalid kind "${kind}", valid: ${VALID_DOUBLET_KINDS.join(', ')}`);
    }
    if (!this._ready || !this._dblTypeId) throw new Error('DoubletStore not initialized');

    const result = await this._createObject(this._dblTypeId, {
      source, target, kind,
      data: typeof data === 'string' ? data : JSON.stringify(data),
      score: data.score || 0,
      timestamp: new Date().toISOString(),
    });
    return result.id;
  }

  async _createDoubletLinks(newId, name, type, content) {
    if (!this._ready || !this._dblTypeId || !this._kagReady) return [];
    const created = [];
    try {
      const similar = await this._searchSemantic(`${name} ${content?.slice(0, 100) || ''}`, 5);
      for (const s of similar) {
        if (s.id === newId) continue;
        try {
          if (s.score > 0.7) {
            const dId = await this.createDoublet(newId, s.id, 'same_as', { score: s.score, auto: true });
            created.push({ id: dId, kind: 'same_as', target: s.id, score: s.score });
          } else if (s.score > 0.45 && s.metadata?.type === type) {
            const dId = await this.createDoublet(newId, s.id, 'similar_to', { score: s.score, auto: true });
            created.push({ id: dId, kind: 'similar_to', target: s.id, score: s.score });
          }
        } catch { /* skip */ }
      }
    } catch (e) {
      logger.warn(`[ClaudeMemory] doublet auto-link failed: ${e.message}`);
    }
    return created;
  }

  async getDoublets(entityId) {
    if (!this._ready || !this._dblTypeId || !entityId) return [];
    try {
      const all = await this._listObjects(this._dblTypeId, 2000);
      return all.filter(d => d.source === entityId || d.target === entityId).map(d => {
        let data = d.data;
        if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = {}; } }
        return { id: d.id, source: d.source, target: d.target, kind: d.kind, data, score: d.score, timestamp: d.timestamp };
      });
    } catch (e) {
      logger.warn(`[ClaudeMemory] getDoublets error: ${e.message}`);
      return [];
    }
  }

  async getDoubletStats() {
    if (!this._ready || !this._dblTypeId) return { total: 0, byKind: {} };
    try {
      const all = await this._listObjects(this._dblTypeId, 5000);
      const byKind = {};
      for (const d of all) { byKind[d.kind] = (byKind[d.kind] || 0) + 1; }
      return { total: all.length, byKind };
    } catch (e) {
      return { total: 0, byKind: {}, error: e.message };
    }
  }

  // ─────────────────────────────────────────────
  // LSM COMPACTION — raw → patterns → insights
  // ─────────────────────────────────────────────

  async compact(opts = {}) {
    const { minClusterSize = 3, maxInsights = 5 } = opts;
    const all = await this.list(500);
    if (all.length < minClusterSize * 2) {
      return { status: 'skip', reason: `Only ${all.length} records, need ${minClusterSize * 2}+` };
    }

    const groups = {};
    for (const m of all) {
      const key = m.type || 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }

    const compacted = [];

    for (const [type, records] of Object.entries(groups)) {
      if (records.length < minClusterSize) continue;

      const chronicle = records
        .map(r => `- ${r.name}: ${(r.content || r.text || '').slice(0, 150)}`)
        .join('\n');

      try {
        const token = process.env.KODACODE_TOKENS?.split(',')[0]?.trim() || process.env.GITHUB_TOKEN || '';
        const client = new OpenAI({
          apiKey: token,
          baseURL: 'https://api.kodacode.ru/v1',
          defaultHeaders: { 'HTTP-Referer': 'https://dev.drondoc.ru', 'X-Title': 'DronDoc LSM' },
        });

        const response = await client.chat.completions.create({
          model: opts.model || 'koda-pro',
          messages: [
            { role: 'system', content: `Ты — компактор памяти. Из набора записей типа "${type}" выдели 1-3 ключевых паттерна/инсайта. Формат:
ПАТТЕРН: <краткое название>
СУТЬ: <1-2 предложения>
ИСТОЧНИКИ: <имена записей через запятую>
---` },
            { role: 'user', content: `${records.length} записей типа "${type}":\n${chronicle}` },
          ],
          temperature: 0.3,
          max_tokens: 800,
        });

        const text = response.choices[0]?.message?.content || '';
        const patterns = text.split('---').filter(p => p.trim());

        for (const pattern of patterns.slice(0, maxInsights)) {
          const nameMatch = pattern.match(/ПАТТЕРН:\s*(.+)/);
          const contentMatch = pattern.match(/СУТЬ:\s*(.+)/);
          if (nameMatch && contentMatch) {
            const insight = await this.save({
              type: 'insight',
              name: `L1: ${nameMatch[1].trim()}`,
              content: contentMatch[1].trim(),
              tags: ['compacted', `from_${type}`],
              session: 'compactor',
            });
            compacted.push(insight);
          }
        }
      } catch (e) {
        logger.warn(`[ClaudeMemory] compact LLM failed for type=${type}: ${e.message}`);
      }
    }

    logger.info(`[ClaudeMemory] Compaction complete: ${compacted.length} insights from ${all.length} records`);
    return {
      status: 'ok',
      inputRecords: all.length,
      groups: Object.keys(groups).length,
      insightsCreated: compacted.length,
      insights: compacted,
    };
  }

  // ─────────────────────────────────────────────
  // CROSS-SESSION SHARED STATE — Integram V2 ("КлодСтейт")
  // ─────────────────────────────────────────────

  async _loadSharedState() {
    const objects = await this._listObjects(this._stTypeId, 500);
    this._sharedState = {};
    for (const obj of objects) {
      if (obj.key) {
        let value = obj.value;
        if (typeof value === 'string') { try { value = JSON.parse(value); } catch { /* keep string */ } }
        this._sharedState[obj.key] = {
          value,
          updatedBy: obj.session || '?',
          updatedAt: obj.timestamp || null,
          _objectId: obj.id,
        };
      }
    }
    logger.info(`[ClaudeMemory] Shared state loaded: ${Object.keys(this._sharedState).length} keys`);
  }

  getSharedState(key) {
    if (!key) return this._sharedState;
    return this._sharedState[key] || null;
  }

  async setSharedState(key, value, session = '?') {
    const timestamp = new Date().toISOString();
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    const entry = { value, updatedBy: session, updatedAt: timestamp };

    if (this._ready && this._stTypeId) {
      try {
        const existing = this._sharedState[key];
        if (existing?._objectId) {
          // Update: delete old + create new (V1 _m_save doesn't update val reliably for new types)
          try { await this.v2.deleteObject(existing._objectId); } catch { /* ok */ }
        }
        const result = await this._createObject(this._stTypeId, {
          key, value: valueStr, session, timestamp,
        });
        entry._objectId = result.id;
      } catch (e) {
        logger.warn(`[ClaudeMemory] shared state persist failed: ${e.message}`);
      }
    }

    this._sharedState[key] = entry;

    // Also embed in KAG
    if (this._kagReady) {
      const text = `[shared_state] ${key}: ${JSON.stringify(value).slice(0, 500)}`;
      const id = `ss_${key}`;
      this._embeddings.embed(text).then(emb =>
        this._vectors.addDocument(id, emb, { type: 'shared_state', name: key, session }, text)
      ).catch(() => {});
    }

    return this._sharedState[key];
  }

  async deleteSharedState(key) {
    if (key) {
      const existing = this._sharedState[key];
      if (existing?._objectId && this._ready) {
        try { await this.v2.deleteObject(existing._objectId); } catch { /* ok */ }
      }
      delete this._sharedState[key];
    } else {
      for (const [, v] of Object.entries(this._sharedState)) {
        if (v._objectId && this._ready) {
          try { await this.v2.deleteObject(v._objectId); } catch { /* ok */ }
        }
      }
      this._sharedState = {};
    }
  }

  // ─────────────────────────────────────────────
  // AUTO-SAVE FROM SOD EVENTS
  // ─────────────────────────────────────────────

  async autoSaveEvent(event) {
    if (!event || !event.type || !event.title) return null;

    const typeMap = {
      'idea': 'project', 'finding': 'project', 'decision': 'project',
      'plan': 'project', 'roadmap': 'project',
      'commit': 'reference', 'pr': 'reference', 'merged': 'reference',
      'deployed': 'reference', 'blocked': 'project',
    };

    const sodType = event.type.replace(/^(dev\.|strategy\.)/, '');
    const memType = typeMap[sodType];
    if (!memType) return null;

    const tags = ['auto', `sod_${sodType}`];
    if (event.tags) tags.push(...event.tags.split(',').map(t => t.trim()));

    const content = [
      event.title,
      event.description || '',
      event.branch ? `Branch: ${event.branch}` : '',
      event.commit ? `Commit: ${event.commit}` : '',
      event.pr ? `PR: ${event.pr}` : '',
    ].filter(Boolean).join('\n');

    return this.save({
      type: memType,
      name: `SOD: ${event.title}`,
      content,
      tags,
      session: event.source || 'sod',
    });
  }
}

// Singleton
let _instance = null;
export function getClaudeMemoryService() {
  if (!_instance) _instance = new ClaudeMemoryService();
  return _instance;
}
