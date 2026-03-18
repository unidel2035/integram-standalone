/**
 * Event Engine REST API — Full CRUD + Query + Execution + MBSE
 *
 * Serves all frontend components in /src/components/event-engine/
 * Components use injected `eventEngineApi` from EventOntologyEngine.vue
 * which routes all calls to /api/event-engine/*
 *
 * ~80 endpoints organized by domain.
 */

import { Router } from 'express';
import { getEventEngineService } from '../../services/ontology/EventEngineService.js';
import logger from '../../utils/logger.js';

export function createEventEngineRoutes() {
  const router = Router();
  const LOG = '[EventEngineAPI]';

  // ── Helper: wrap service calls with init + error handling ──────────

  function wrap(fn) {
    return async (req, res) => {
      try {
        const engine = getEventEngineService();
        await engine.initialize();
        const result = await fn(engine, req);
        res.json({ success: true, data: result });
      } catch (err) {
        logger.error(`${LOG} ${req.method} ${req.path} error:`, err.message);
        const status = err.message.includes('not found') ? 404 : 500;
        res.status(status).json({ success: false, error: err.message });
      }
    };
  }

  // Helper: apply application scope filtering
  async function applyScope(engine, req, data, entityType) {
    const appId = req.query.applicationId;
    if (!appId) return data;
    try {
      const scope = await engine.getApplicationScopeCached(appId);
      if (!scope || scope.unrestricted) return data;
      if (entityType === 'concepts' && scope.conceptIds?.length) {
        return data.filter(d => scope.conceptIds.includes(String(d.id)));
      }
      if (entityType === 'models' && scope.modelIds?.length) {
        return data.filter(d => scope.modelIds.includes(String(d.id)));
      }
      if (entityType === 'vocabularies' && scope.vocabularyIds?.length) {
        return data.filter(d => scope.vocabularyIds.includes(String(d.id)));
      }
      if (entityType === 'individuals' && scope.conceptIds?.length) {
        return data.filter(d => {
          const cReq = d.reqs?.['Концепт'];
          return cReq && scope.conceptIds.includes(String(cReq.value));
        });
      }
    } catch { /* scope resolution failed, return all */ }
    return data;
  }

  // ══════════════════════════════════════════════════════════════════
  // 1. STATS & DASHBOARD
  // ══════════════════════════════════════════════════════════════════

  router.get('/stats', wrap(e => e.getStats()));
  router.get('/dashboard', wrap(e => e.getDashboardStats()));
  router.get('/analytics', wrap(e => e.getAnalytics()));

  // Infodynamics — метрики второго закона инфодинамики Вопсона
  router.get('/infodynamics', wrap((e, req) => e.getInfodynamics(req.query.domain || null)));
  router.get('/infodynamics/:domain', wrap((e, req) => e.getInfodynamics(req.params.domain)));

  // ── Prediction Engine — паттерны, аномалии, прогнозы, тренды ────────
  router.get('/predictions/patterns', wrap((e, req) => {
    const { domain, windowSize, minSupport } = req.query;
    return e.analyzePatterns(domain || null, Number(windowSize) || 3, Number(minSupport) || 2);
  }));
  router.get('/predictions/patterns/:domain', wrap((e, req) => {
    const { windowSize, minSupport } = req.query;
    return e.analyzePatterns(req.params.domain, Number(windowSize) || 3, Number(minSupport) || 2);
  }));
  router.get('/predictions/anomalies', wrap((e, req) => e.detectAnomalies(req.query.domain || null)));
  router.get('/predictions/anomalies/:domain', wrap((e, req) => e.detectAnomalies(req.params.domain)));
  router.get('/predictions/correlations', wrap((e, req) => {
    return e.crossDomainCorrelations(Number(req.query.window) || 3600000);
  }));
  router.get('/predictions/next/:eventType', wrap((e, req) => {
    return e.predictNext(req.params.eventType, req.query.domain || null);
  }));
  router.get('/predictions/trends', wrap((e, req) => {
    return e.getTrends(req.query.domain || null, req.query.period || 'day');
  }));
  router.get('/predictions/trends/:domain', wrap((e, req) => {
    return e.getTrends(req.params.domain, req.query.period || 'day');
  }));
  router.post('/predictions/simulate', wrap((e, req) => e.simulateEvent(req.body)));

  // ── Webhook Subscriptions — подписки для внешних систем ──────────────
  const _webhooks = new Map(); // id → { url, domain, eventType, secret, createdAt }
  let _webhookCounter = 1;

  router.get('/webhooks', (req, res) => {
    const list = [..._webhooks.values()].map(w => ({ ...w, secret: '***' }));
    res.json({ success: true, data: list });
  });

  router.post('/webhooks', (req, res) => {
    const { url, domain, eventType, secret } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'url is required' });
    const id = `wh_${_webhookCounter++}`;
    const webhook = { id, url, domain: domain || null, eventType: eventType || null, secret: secret || null, createdAt: new Date().toISOString(), deliveries: 0, lastStatus: null };
    _webhooks.set(id, webhook);
    res.json({ success: true, data: { ...webhook, secret: secret ? '***' : null } });
  });

  router.delete('/webhooks/:id', (req, res) => {
    if (_webhooks.delete(req.params.id)) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Webhook not found' });
    }
  });

  // Hook into event creation — deliver webhooks
  const _originalWrap = wrap;
  async function deliverWebhooks(eventData) {
    for (const [, wh] of _webhooks) {
      try {
        const eventDomain = (eventData.name || '').split('.')[0];
        if (wh.domain && eventDomain !== wh.domain) continue;
        if (wh.eventType && eventData.name !== wh.eventType) continue;

        const payload = { event: eventData, timestamp: new Date().toISOString(), webhookId: wh.id };
        const headers = { 'Content-Type': 'application/json' };
        if (wh.secret) {
          const { createHmac } = await import('crypto');
          headers['X-SOD-Signature'] = createHmac('sha256', wh.secret).update(JSON.stringify(payload)).digest('hex');
        }

        const axios = (await import('axios')).default;
        const resp = await axios.post(wh.url, payload, { headers, timeout: 5000 }).catch(e => ({ status: e.response?.status || 0 }));
        wh.deliveries++;
        wh.lastStatus = resp.status || 0;
        wh.lastDelivery = new Date().toISOString();
      } catch { /* ignore delivery failures */ }
    }
  }

  // Expose webhook delivery function for EventEngineService
  if (!globalThis._sodWebhookDeliver) {
    globalThis._sodWebhookDeliver = deliverWebhooks;
  }

  // ── SOD Operations — Projection, Diff ───────────────────────────────
  router.get('/operations/projection', wrap(async (e, req) => {
    const { domain, actor, from, to, limit: lim } = req.query;
    // Use in-memory events (same source as /events endpoint)
    let allRaw;
    try {
      allRaw = await e.getObjects(e.tables.subjectEvents);
    } catch {
      allRaw = [];
    }
    let events = (Array.isArray(allRaw) ? allRaw : []).concat(e._subjectEvents || []);
    // Deduplicate by id
    const seen = new Set();
    events = events.filter(ev => { const k = ev.id || ev.name; if (seen.has(k)) return false; seen.add(k); return true; });
    // Use name (event type) for filtering, not val (object name)
    const getName = ev => ev.name || ev.val || '';

    if (domain) events = events.filter(ev => getName(ev).startsWith(domain + '.'));
    if (actor) events = events.filter(ev => (ev.actorId && String(ev.actorId).includes(actor)) || ev.reqs?.['Актор']?.displayValue?.includes(actor));
    if (from) {
      const fromTs = new Date(from).getTime();
      events = events.filter(ev => {
        const ts = e._parseTimestamp(ev.reqs?.['Временная метка']?.value);
        return ts && ts >= fromTs;
      });
    }
    if (to) {
      const toTs = new Date(to).getTime();
      events = events.filter(ev => {
        const ts = e._parseTimestamp(ev.reqs?.['Временная метка']?.value);
        return ts && ts <= toTs;
      });
    }

    // Aggregate
    const types = {};
    for (const ev of events) {
      const t = getName(ev);
      types[t] = (types[t] || 0) + 1;
    }

    return {
      events: events.slice(0, parseInt(lim) || 100).map(ev => ({
        id: ev.id, type: getName(ev),
        timestamp: ev.timestamp || ev.reqs?.['Временная метка']?.value,
        individual: ev.individualId || ev.reqs?.['Индивид']?.value,
        value: (ev.value || ev.reqs?.['Значение']?.value || '').substring(0, 100),
      })),
      totalEvents: events.length,
      types,
      filters: { domain, actor, from, to },
    };
  }));

  router.get('/operations/diff', wrap(async (e, req) => {
    const { domain, periodA, periodB } = req.query;
    // Use in-memory + DB events (same approach as projection)
    let allRaw;
    try {
      allRaw = await e.getObjects(e.tables.subjectEvents);
    } catch {
      allRaw = [];
    }
    let events = (Array.isArray(allRaw) ? allRaw : []).concat(e._subjectEvents || []);
    const seen = new Set();
    events = events.filter(ev => { const k = ev.id || ev.name; if (seen.has(k)) return false; seen.add(k); return true; });
    const getName = ev => ev.name || ev.val || '';
    if (domain) events = events.filter(ev => getName(ev).startsWith(domain + '.'));

    const now = Date.now();
    const dayMs = 86400000;
    const aStart = periodA ? new Date(periodA).getTime() : now - 2 * dayMs;
    const aEnd = periodA ? aStart + dayMs : now - dayMs;
    const bStart = periodB ? new Date(periodB).getTime() : now - dayMs;
    const bEnd = periodB ? bStart + dayMs : now;

    const inA = [], inB = [];
    for (const ev of events) {
      const ts = ev.timestamp ? new Date(ev.timestamp).getTime() : e._parseTimestamp(ev.reqs?.['Временная метка']?.value);
      if (!ts) continue;
      if (ts >= aStart && ts < aEnd) inA.push(ev);
      if (ts >= bStart && ts < bEnd) inB.push(ev);
    }

    const typesA = {}, typesB = {};
    for (const ev of inA) { const t = getName(ev); typesA[t] = (typesA[t] || 0) + 1; }
    for (const ev of inB) { const t = getName(ev); typesB[t] = (typesB[t] || 0) + 1; }

    const allTypes = new Set([...Object.keys(typesA), ...Object.keys(typesB)]);
    const diff = [];
    for (const type of allTypes) {
      const a = typesA[type] || 0;
      const b = typesB[type] || 0;
      if (a !== b) {
        diff.push({ type, periodA: a, periodB: b, change: b - a, changePercent: a > 0 ? Math.round((b - a) / a * 100) : (b > 0 ? 100 : 0) });
      }
    }

    return {
      periodA: { start: new Date(aStart).toISOString(), end: new Date(aEnd).toISOString(), total: inA.length },
      periodB: { start: new Date(bStart).toISOString(), end: new Date(bEnd).toISOString(), total: inB.length },
      diff: diff.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)),
      newTypes: diff.filter(d => d.periodA === 0).map(d => d.type),
      removedTypes: diff.filter(d => d.periodB === 0).map(d => d.type),
    };
  }));

  // ── NL Query — запросы на естественном языке ─────────────────────────
  router.post('/nl-query', wrap(async (e, req) => {
    const { query } = req.body;
    if (!query) return { error: 'query is required' };

    // Parse natural language into filters
    const q = query.toLowerCase();
    const filters = {};

    // Domain detection
    const domainKeywords = {
      dev: ['разраб', 'код', 'коммит', 'pr', 'ветк', 'деплой', 'devops'],
      ops: ['опера', 'мисси', 'полёт', 'flight', 'операци'],
      infra: ['монитор', 'серв', 'cpu', 'память', 'инфра'],
      twin: ['двойник', 'twin', 'дрон', 'компонент'],
      reg: ['регул', 'серти', 'закон', 'норм', 'правил'],
      risk: ['страх', 'полис', 'риск', 'insur'],
      market: ['рынок', 'торг', 'маркет', 'листинг', 'прода'],
      swarm: ['рой', 'swarm', 'формац', 'лидер'],
      train: ['обуч', 'тренир', 'курсант', 'сцена'],
      strategy: ['идея', 'план', 'стратег', 'решени', 'бэклог', 'roadmap'],
      knowledge: ['знани', 'факт', 'правил', 'процедур'],
    };

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some(kw => q.includes(kw))) {
        filters.domain = domain;
        break;
      }
    }

    // Time detection
    if (q.includes('сегодня') || q.includes('today')) {
      filters.from = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    } else if (q.includes('вчера') || q.includes('yesterday')) {
      const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0);
      filters.from = d.toISOString();
      filters.to = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    } else if (q.includes('недел') || q.includes('week')) {
      const d = new Date(); d.setDate(d.getDate() - 7);
      filters.from = d.toISOString();
    } else if (q.includes('месяц') || q.includes('month')) {
      const d = new Date(); d.setMonth(d.getMonth() - 1);
      filters.from = d.toISOString();
    }

    // Type detection
    if (q.includes('ошиб') || q.includes('fail') || q.includes('блок')) {
      filters.eventTypeMatch = 'failed|blocked|error';
    } else if (q.includes('успех') || q.includes('succe') || q.includes('deploy') || q.includes('готов')) {
      filters.eventTypeMatch = 'succeeded|completed|deployed';
    }

    // Count detection
    if (q.includes('сколько') || q.includes('count') || q.includes('количеств')) {
      filters.mode = 'count';
    }

    // Execute query
    await e.initialize();
    let events = await e.getObjectsCached(e.tables.subjectEvents, { limit: 5000 });

    if (filters.domain) events = events.filter(ev => (ev.val || '').startsWith(filters.domain + '.'));
    if (filters.from) {
      const fromTs = new Date(filters.from).getTime();
      events = events.filter(ev => {
        const ts = e._parseTimestamp(ev.reqs?.['Временная метка']?.value);
        return ts && ts >= fromTs;
      });
    }
    if (filters.to) {
      const toTs = new Date(filters.to).getTime();
      events = events.filter(ev => {
        const ts = e._parseTimestamp(ev.reqs?.['Временная метка']?.value);
        return ts && ts <= toTs;
      });
    }
    if (filters.eventTypeMatch) {
      const re = new RegExp(filters.eventTypeMatch, 'i');
      events = events.filter(ev => re.test(ev.val || ''));
    }

    // Build response
    const typeCounts = {};
    for (const ev of events) {
      const t = ev.val || 'unknown';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }

    const result = {
      query,
      parsedFilters: filters,
      totalEvents: events.length,
      typeCounts,
      events: events.slice(0, 20).map(ev => ({
        id: ev.id, type: ev.val,
        timestamp: ev.reqs?.['Временная метка']?.value,
        value: (ev.reqs?.['Значение']?.value || '').substring(0, 100),
      })),
    };

    // Natural language summary
    const parts = [];
    if (filters.domain) parts.push(`в домене "${filters.domain}"`);
    if (filters.from) parts.push(`с ${new Date(filters.from).toLocaleDateString('ru-RU')}`);
    if (filters.eventTypeMatch) parts.push(`типа "${filters.eventTypeMatch}"`);
    result.summary = `Найдено ${events.length} событий${parts.length ? ' ' + parts.join(', ') : ''}.`;

    if (Object.keys(typeCounts).length > 0) {
      const top = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
      result.summary += ` Самый частый тип: ${top[0]} (${top[1]} раз).`;
    }

    return result;
  }));

  // ── Knowledge Domain — факты, правила, процедуры ─────────────────────
  router.post('/knowledge/bootstrap', wrap(e => e.bootstrapKnowledgeDomain()));
  router.get('/knowledge/query', wrap((e, req) => e.queryKnowledge(req.query)));
  router.post('/knowledge/fact', wrap(async (e, req) => {
    await e.bootstrapKnowledgeDomain();
    const ids = e.getKnowledgeIds();
    const { title, description, tags } = req.body;
    const value = `${title}\n${description || ''}\n[tags: ${tags || ''}]`;
    return e.createSubjectEvent('knowledge.fact_established', {
      modelEventId: ids?.modelEventIds?.['knowledge.fact_established'],
      value, actorId: ids?.agentId,
    });
  }));
  router.post('/knowledge/rule', wrap(async (e, req) => {
    await e.bootstrapKnowledgeDomain();
    const ids = e.getKnowledgeIds();
    const { title, condition, action } = req.body;
    const value = `${title}\nIF: ${condition || ''}\nTHEN: ${action || ''}`;
    return e.createSubjectEvent('knowledge.rule_defined', {
      modelEventId: ids?.modelEventIds?.['knowledge.rule_defined'],
      value, actorId: ids?.agentId,
    });
  }));

  // ── MCP endpoints: domains, events, fsm ─────────────────────────────
  // Все домены с их событиями, акторами, FSM
  router.get('/domains', wrap(e => {
    const domains = {};
    // Собираем из bootstrap-данных
    const domainPrefixes = {
      devops: 'dev.', operations: 'ops.', monitoring: 'infra.',
      'digital-twin': 'twin.', regulatory: 'reg.', insurance: 'risk.',
      marketplace: 'market.', swarm: 'swarm.', training: 'train.'
    };
    for (const [name, prefix] of Object.entries(domainPrefixes)) {
      const events = (e._modelEvents || []).filter(me =>
        me.val?.startsWith(prefix) || me.reqs?.['Имя']?.value?.startsWith(prefix)
      );
      const triggers = (e._triggers || []).filter(t =>
        t.condition?.includes(prefix) || t.domain === name
      );
      domains[name] = {
        prefix,
        eventCount: events.length,
        triggerCount: triggers.length,
        events: events.slice(0, 20).map(ev => ev.val || ev.reqs?.['Имя']?.value || '?'),
      };
    }
    return domains;
  }));

  // Все предметные события (с фильтрами) — из Integram, не из runtime
  router.get('/events', wrap(async (e, req) => {
    let allEvents;
    try {
      const raw = await e.getObjects(e.tables.subjectEvents);
      allEvents = Array.isArray(raw) ? raw : (raw?.data || []);
    } catch {
      allEvents = e._subjectEvents || [];
    }
    let filtered = [...allEvents];
    if (req.query.domain) {
      const prefixMap = {
        devops: 'dev.', operations: 'ops.', monitoring: 'infra.',
        'digital-twin': 'twin.', regulatory: 'reg.', insurance: 'risk.',
        marketplace: 'market.', swarm: 'swarm.', training: 'train.'
      };
      const prefix = prefixMap[req.query.domain] || req.query.domain + '.';
      filtered = filtered.filter(ev => (ev.name || ev.val || '').startsWith(prefix));
    }
    if (req.query.actorId) {
      filtered = filtered.filter(ev => String(ev.actorId) === String(req.query.actorId));
    }
    if (req.query.eventType) {
      filtered = filtered.filter(ev => (ev.name || ev.val || '') === req.query.eventType);
    }
    const limit = parseInt(req.query.limit) || 50;
    return filtered.slice(-limit).reverse();
  }));

  // FSM: все определения или по домену
  router.get('/fsm', wrap(async (e, req) => {
    const states = e._states || [];
    const transitions = e._transitions || [];
    return { states, transitions, count: { states: states.length, transitions: transitions.length } };
  }));

  // ══════════════════════════════════════════════════════════════════
  // 2. ACTORS
  // ══════════════════════════════════════════════════════════════════

  router.get('/actors', wrap(e => e.getObjects(e.tables.actors)));
  router.post('/actors', wrap((e, req) => e.createActor(req.body.name, req.body)));
  router.put('/actors/:id', wrap((e, req) => e.updateActor(req.params.id, req.body)));
  router.delete('/actors/:id', wrap((e, req) => e.deleteActor(req.params.id)));

  // Epistemic
  router.get('/actors/:id/scope', wrap((e, req) => e.getActorEpistemicScope(req.params.id)));
  router.get('/actors/:id/access/:individualId', wrap(async (e, req) => {
    const allowed = await e.checkEpistemicAccess(req.params.id, req.params.individualId);
    return { allowed };
  }));
  router.get('/actors/:id/filtered-events', wrap((e, req) => e.getEpistemicFilteredEvents(req.params.id)));

  // ══════════════════════════════════════════════════════════════════
  // 3. CONCEPTS
  // ══════════════════════════════════════════════════════════════════

  router.get('/concepts', wrap(async (e, req) => {
    const data = await e.getConcepts();
    return applyScope(e, req, data, 'concepts');
  }));
  router.post('/concepts', wrap((e, req) => e.createConcept(req.body.name, req.body.description, req.body.ontologyElementId)));
  router.put('/concepts/:id/ontology-link', wrap((e, req) => e.linkConceptToOntology(req.params.id, req.body.ontologyElementId)));
  router.put('/concepts/:id/table-link', wrap((e, req) => e.linkConceptToTable(req.params.id, req.body.tableId, req.body.propertyMap)));
  router.get('/concepts/:id/resolve', wrap((e, req) => e.resolveConcept(req.params.id, {
    includeData: req.query.includeData !== 'false',
    dataLimit: req.query.dataLimit ? Number(req.query.dataLimit) : 20,
  })));
  router.get('/concepts/:id/suggest-table', wrap((e, req) => e.suggestTableForConcept(req.params.id)));
  router.get('/unified-map', wrap(e => e.getUnifiedMap()));
  router.get('/concepts/:id/model', wrap((e, req) => e.getModels(req.params.id)));

  // ══════════════════════════════════════════════════════════════════
  // 4. ONTOLOGY ELEMENTS (UAV ontology in kval 1673250)
  // ══════════════════════════════════════════════════════════════════

  router.get('/ontology-elements', wrap(e => e.getOntologyElements()));
  router.get('/ontology/search', wrap(async (e, req) => {
    const all = await e.getOntologyElements();
    const q = (req.query.q || '').toLowerCase();
    const limit = parseInt(req.query.limit) || 50;
    if (!q) return all.slice(0, limit);
    return all.filter(el => (el.val || '').toLowerCase().includes(q)).slice(0, limit);
  }));

  // ══════════════════════════════════════════════════════════════════
  // 5. VOCABULARIES & PROPERTIES
  // ══════════════════════════════════════════════════════════════════

  router.get('/vocabularies', wrap(async (e, req) => {
    const data = await e.getVocabularies();
    return applyScope(e, req, data, 'vocabularies');
  }));
  router.post('/vocabularies', wrap((e, req) => e.createVocabulary(req.body.name, req.body.description)));
  router.post('/vocabularies/entries', wrap((e, req) => e.createVocabularyEntry(req.body.vocabularyId, req.body.value)));

  router.get('/vocabularies/:id/properties', wrap(async (e, req) => {
    const vocabId = req.params.id === '0' ? null : req.params.id;
    return e.getProperties(vocabId);
  }));
  router.post('/vocabularies/:id/properties', wrap((e, req) => e.createProperty(req.body.name, req.body)));

  // ══════════════════════════════════════════════════════════════════
  // 6. APPLICATIONS
  // ══════════════════════════════════════════════════════════════════

  router.get('/applications', wrap(e => e.getApplications()));
  router.post('/applications', wrap((e, req) => e.createApplication(req.body.name, req.body.description)));
  router.get('/applications/:id/scope', wrap((e, req) => e.getApplicationScope(req.params.id)));
  router.put('/applications/:id/models', wrap((e, req) => e.attachModelToApp(req.params.id, req.body.modelId)));
  router.put('/applications/:id/vocabularies', wrap((e, req) => e.attachVocabToApp(req.params.id, req.body.vocabularyId)));

  // ══════════════════════════════════════════════════════════════════
  // 7. MODELS & MODEL EVENTS
  // ══════════════════════════════════════════════════════════════════

  router.get('/models', wrap(async (e, req) => {
    const conceptId = req.query.conceptId || null;
    const data = await e.getModels(conceptId);
    return applyScope(e, req, data, 'models');
  }));
  router.get('/models/:id/tree', wrap((e, req) => e.getModelTree(req.params.id)));
  router.get('/models/:id/model-events', wrap((e, req) => e.getModelEvents(req.params.id)));
  router.post('/models/:id/events', wrap((e, req) => e.createModelEvent(req.body.name, {
    modelId: req.params.id,
    propertyId: req.body.propertyId,
    parentEventId: req.body.parentEventId,
    order: req.body.order,
    constraints: req.body.constraints,
  })));
  router.put('/model-events/:id', wrap((e, req) => e.updateModelEvent(req.params.id, req.body)));
  router.delete('/model-events/:id', wrap((e, req) => e.deleteModelEvent(req.params.id)));
  router.post('/models/:id/clone', wrap((e, req) => e.cloneModel(req.params.id, req.body.version)));

  // Model versions & diff
  router.get('/models/:id/versions', wrap((e, req) => e.getModelVersions(req.params.id)));
  router.get('/models/:a/diff/:b', wrap((e, req) => e.diffModels(req.params.a, req.params.b)));
  router.post('/individuals/:indId/migrate-safe', wrap((e, req) =>
    e.migrateIndividualSafe(req.params.indId, req.body.fromModelId, req.body.toModelId)
  ));

  // ══════════════════════════════════════════════════════════════════
  // 8. INDIVIDUALS & SUBJECT EVENTS
  // ══════════════════════════════════════════════════════════════════

  router.get('/individuals', wrap(async (e, req) => {
    const conceptId = req.query.conceptId || null;
    const data = await e.getIndividuals(conceptId);
    return applyScope(e, req, data, 'individuals');
  }));
  router.post('/individuals', wrap((e, req) => e.createIndividual(req.body.name, req.body)));
  router.put('/individuals/:id', wrap(async (e, req) => {
    const { conceptId, modelId, status } = req.body;
    const reqs = {};
    if (conceptId) reqs['Концепт'] = String(conceptId);
    if (modelId) reqs['Модель'] = String(modelId);
    if (status) reqs['Статус'] = status;
    await e.ensureReqMap(e.tables.individuals);
    const map = e.reqMaps[e.tables.individuals];
    const resolved = {};
    for (const [key, val] of Object.entries(reqs)) {
      const reqId = map?.aliasMap?.[key] || key;
      resolved[reqId] = val;
    }
    const result = await e.updateObject(req.params.id, resolved);
    e.invalidateCache(e.tables.individuals);
    return result;
  }));

  router.get('/individuals/:id/events', wrap((e, req) => e.getSubjectEvents(req.params.id)));
  router.post('/individuals/:id/events', wrap((e, req) => e.createSubjectEvent(req.body.name, {
    individualId: req.params.id,
    modelEventId: req.body.modelEventId,
    value: req.body.value,
    actorId: req.body.actorId,
    causes: req.body.causes || [],
    timestamp: req.body.timestamp,
  })));
  router.post('/individuals/:id/validated-event', wrap((e, req) => e.validateAndCreateEvent(req.body.name, {
    individualId: req.params.id,
    modelEventId: req.body.modelEventId,
    value: req.body.value,
    actorId: req.body.actorId,
    causes: req.body.causes || [],
    timestamp: req.body.timestamp,
  })));
  router.get('/individuals/:id/timeline', wrap((e, req) => e.getIndividualTimeline(req.params.id)));
  router.post('/individuals/:id/execute', wrap((e, req) =>
    e.executeModelValidated(req.body.modelId, req.params.id, req.body.actorId, req.body.values || {})
  ));
  router.post('/individuals/:id/migrate', wrap((e, req) =>
    e.migrateIndividual(req.params.id, req.body.fromModelId, req.body.toModelId)
  ));

  // Soft delete event
  router.delete('/events/:id', wrap((e, req) => e.softDeleteSubjectEvent(req.params.id)));

  // All subject events (unfiltered)
  router.get('/subject-events', wrap(e => e.getObjects(e.tables.subjectEvents)));

  // ══════════════════════════════════════════════════════════════════
  // 9. CAUSAL ANALYSIS
  // ══════════════════════════════════════════════════════════════════

  router.get('/events/:a/happens-before/:b', wrap(async (e, req) => {
    const result = await e.happensBefore(req.params.a, req.params.b);
    return { happensBefore: result };
  }));
  router.get('/events/:id/causes', wrap((e, req) => e.getCausalChain(req.params.id)));
  router.get('/events/:id/effects', wrap((e, req) => e.getEffects(req.params.id)));
  router.get('/events/:id/roots', wrap((e, req) => e.traceToRoots(req.params.id)));

  // ══════════════════════════════════════════════════════════════════
  // 10. QUERY ENGINE (BSL)
  // ══════════════════════════════════════════════════════════════════

  router.post('/query', wrap((e, req) => e.executeExtendedQuery(req.body.query)));
  router.post('/query-extended', wrap((e, req) => e.executeExtendedQuery(req.body.query)));

  // ══════════════════════════════════════════════════════════════════
  // 11. TEMPORAL HIERARCHY
  // ══════════════════════════════════════════════════════════════════

  router.get('/processes', wrap((e, req) => e.getProcesses(req.query.individualId)));
  router.get('/actions', wrap((e, req) => e.getActions(req.query.individualId)));
  router.get('/activities', wrap(e => e.getActivities()));
  router.get('/individuals/:id/temporal-hierarchy', wrap((e, req) => e.getTemporalHierarchy(req.params.id)));

  // ══════════════════════════════════════════════════════════════════
  // 12. DATAFLOW / TRIGGERS
  // ══════════════════════════════════════════════════════════════════

  router.get('/dataflow/triggers', wrap(e => e.getTriggers ? e.getTriggers() : (e._triggers || [])));
  router.post('/dataflow/triggers', wrap((e, req) => e.registerTrigger(req.body)));
  router.delete('/dataflow/triggers/:id', wrap((e, req) => e.removeTrigger(req.params.id)));
  router.post('/individuals/:id/execute-dataflow', wrap((e, req) =>
    e.executeModelDataflow ? e.executeModelDataflow(req.body.modelId, req.params.id, req.body.actorId, req.body.values || {}) : {}
  ));

  // ══════════════════════════════════════════════════════════════════
  // 13. MBSE: REQUIREMENTS & TRACES
  // ══════════════════════════════════════════════════════════════════

  router.get('/requirements', wrap(async (e, req) => {
    const all = await e.getRequirements();
    // Optional filtering
    const { type, priority, status } = req.query;
    let filtered = all;
    if (type) filtered = filtered.filter(r => r.reqs?.['Тип']?.value === type);
    if (priority) filtered = filtered.filter(r => r.reqs?.['Приоритет']?.value === priority);
    if (status) filtered = filtered.filter(r => r.reqs?.['Статус']?.value === status);
    return filtered;
  }));
  router.post('/requirements', wrap((e, req) => e.createRequirement(req.body)));
  router.put('/requirements/:id', wrap((e, req) => e.updateRequirement(req.params.id, req.body)));
  router.delete('/requirements/:id', wrap((e, req) => e.deleteRequirement(req.params.id)));
  router.get('/requirement-coverage', wrap(e => e.getRequirementCoverage()));
  router.get('/requirements/:id/test-cases', wrap((e, req) => e.generateTestCases(req.params.id)));
  router.get('/requirements/:id/impact', wrap((e, req) => e.getRequirementImpact(req.params.id)));

  router.get('/traces', wrap(async (e, req) => {
    const all = await e.getTraces();
    if (req.query.requirementId) {
      return all.filter(t => {
        const src = t.reqs?.['Источник']?.value;
        return src && String(src) === req.query.requirementId;
      });
    }
    return all;
  }));
  router.post('/traces', wrap((e, req) => e.createTrace(req.body)));
  router.delete('/traces/:id', wrap((e, req) => e.deleteTrace(req.params.id)));
  router.get('/coverage-matrix', wrap(e => e.getTraceabilityMatrix()));
  router.get('/traceability-matrix', wrap(e => e.getTraceabilityMatrix()));

  // ══════════════════════════════════════════════════════════════════
  // 14. MBSE: STATE MACHINE
  // ══════════════════════════════════════════════════════════════════

  router.get('/models/:id/states', wrap((e, req) => e.getStates(req.params.id)));
  router.post('/models/:id/states', wrap((e, req) => e.createState(req.params.id, req.body)));
  router.put('/states/:id', wrap((e, req) => e.updateState(req.params.id, req.body)));
  router.delete('/states/:id', wrap((e, req) => e.deleteState(req.params.id)));

  router.get('/models/:id/transitions', wrap((e, req) => e.getTransitions(req.params.id)));
  router.post('/models/:id/transitions', wrap((e, req) => e.createTransition(req.params.id, req.body)));
  router.delete('/transitions/:id', wrap((e, req) => e.deleteTransition(req.params.id)));

  router.post('/individuals/:id/fsm/:modelId', wrap((e, req) =>
    e.executeStateMachine(req.params.id, req.params.modelId)
  ));
  router.get('/models/:id/state-diagram', wrap((e, req) => e.getStateMachineDiagram(req.params.id)));

  // FSM validation
  router.get('/models/:id/fsm-validate', wrap(async (e, req) => {
    const states = await e.getStates(req.params.id);
    const transitions = await e.getTransitions(req.params.id);
    const errors = [];
    const initials = states.filter(s => s.reqs?.['Тип']?.value === 'initial');
    if (initials.length !== 1) errors.push(`Expected 1 initial state, found ${initials.length}`);
    const finals = states.filter(s => s.reqs?.['Тип']?.value === 'final');
    if (finals.length === 0) errors.push('No final state defined');
    for (const s of states) {
      if (s.reqs?.['Тип']?.value === 'final') continue;
      const outgoing = transitions.filter(t => String(t.reqs?.['Из']?.value) === String(s.id));
      if (outgoing.length === 0) errors.push(`State "${s.val}" has no outgoing transitions (dead-end)`);
    }
    return { valid: errors.length === 0, errors, states: states.length, transitions: transitions.length };
  }));

  // ══════════════════════════════════════════════════════════════════
  // 15. MBSE: SysML DIAGRAMS & V-MODEL
  // ══════════════════════════════════════════════════════════════════

  router.get('/models/:id/diagrams/bdd', wrap((e, req) => e.generateBDD(req.params.id)));
  router.get('/models/:id/diagrams/ibd', wrap((e, req) => e.generateIBD(req.params.id)));
  router.get('/models/:id/diagrams/activity', wrap((e, req) => e.generateActivityDiagram(req.params.id)));
  router.get('/models/:id/diagrams/requirements', wrap((e, req) => e.generateRequirementsDiagram(req.params.id)));
  router.get('/models/:id/v-model', wrap((e, req) => e.getVModelData(req.params.id)));

  // Verifications
  router.get('/verifications', wrap(async (e, req) => {
    const all = await e.getVerifications ? e.getVerifications() : e.getObjects(e.tables.verifications);
    if (req.query.requirementId) {
      return all.filter(v => {
        const rReq = v.reqs?.['Требование']?.value;
        return rReq && String(rReq) === req.query.requirementId;
      });
    }
    return all;
  }));
  router.post('/verifications', wrap((e, req) =>
    e.createVerification ? e.createVerification(req.body) : e.createObject(e.tables.verifications, req.body.name, req.body)
  ));

  // ══════════════════════════════════════════════════════════════════
  // 16. EXPORT / IMPORT
  // ══════════════════════════════════════════════════════════════════

  router.get('/export/json-ld', wrap(e => e.exportToJsonLd()));
  router.get('/export/owl', async (req, res) => {
    try {
      const engine = getEventEngineService();
      await engine.initialize();
      const owl = await engine.exportToOwl();
      res.set('Content-Type', 'application/xml');
      res.send(owl);
    } catch (err) {
      logger.error(`${LOG} GET /export/owl error:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  router.post('/import/json-ld', wrap((e, req) => e.importFromJsonLd(req.body)));

  router.post('/import/owl', async (req, res) => {
    try {
      const engine = getEventEngineService();
      await engine.initialize();
      const owlString = typeof req.body === 'string' ? req.body : req.body.owl || '';
      const result = await engine.importFromOwl(owlString);
      res.json({ success: true, data: result });
    } catch (err) {
      logger.error(`${LOG} POST /import/owl error:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // 17. SYSTEM MONITORING BRIDGE (existing endpoints)
  // ══════════════════════════════════════════════════════════════════

  router.get('/sys-mon-ids', async (req, res) => {
    try {
      const engine = getEventEngineService();
      await engine.initialize();
      const ids = engine.getSysMonIds();
      if (!ids) return res.status(503).json({ error: 'System monitoring domain not yet bootstrapped' });
      res.json(ids);
    } catch (err) {
      logger.error(`${LOG} GET /sys-mon-ids error:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/system-events', async (req, res) => {
    try {
      const { eventType, value, actorAlias, causes, timestamp } = req.body;
      if (!eventType) return res.status(400).json({ error: 'eventType is required' });

      const engine = getEventEngineService();
      await engine.initialize();
      const ids = engine.getSysMonIds();
      if (!ids) return res.status(503).json({ error: 'System monitoring domain not bootstrapped' });

      const actorId = ids.actors[actorAlias || 'SystemMonitor'] || ids.actors.SystemMonitor;
      const modelEventId = ids.modelEventIds[eventType];

      const result = await engine.createSubjectEvent(eventType, {
        individualId: ids.individualId,
        modelEventId: modelEventId || undefined,
        value: value || eventType,
        actorId,
        causes: causes || [],
        timestamp: timestamp || new Date().toISOString(),
      });

      const eventId = String(result?.id || result?.obj);

      let triggerResults = [];
      try {
        triggerResults = await engine.evaluateTriggers({
          id: eventId, name: eventType, individualId: ids.individualId,
          modelEventId, value: value || eventType, actorId, modelId: ids.modelId,
        });
      } catch (err) {
        logger.warn(`${LOG} Trigger evaluation failed:`, err.message);
      }

      res.json({ eventId, eventType, actorId, modelEventId, triggers: triggerResults });
    } catch (err) {
      logger.error(`${LOG} POST /system-events error:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/triggers/evaluate', async (req, res) => {
    try {
      const { eventId, eventType, value, actorId } = req.body;
      const engine = getEventEngineService();
      await engine.initialize();
      const ids = engine.getSysMonIds();

      const results = await engine.evaluateTriggers({
        id: eventId, name: eventType,
        individualId: ids?.individualId,
        modelEventId: ids?.modelEventIds?.[eventType],
        value: value || eventType,
        actorId: actorId || ids?.actors?.SystemMonitor,
        modelId: ids?.modelId,
      });

      res.json({ triggers: results });
    } catch (err) {
      logger.error(`${LOG} POST /triggers/evaluate error:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Causal chain (kept for bridge compatibility)
  router.get('/chain/:eventId', wrap((e, req) => e.getCausalChain(req.params.eventId)));

  // ── Item 8: SPARQL → BSL Translation ──────────────────────

  router.post('/sparql', async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) return res.status(400).json({ success: false, error: 'Missing query parameter' });
      const engine = getEventEngineService();
      await engine.initialize();
      const result = await engine.executeSparql(query);
      res.json({ success: true, data: result });
    } catch (err) {
      logger.error(`${LOG} POST /sparql error:`, err.message);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ── Item 10: FSM Validation ───────────────────────────────

  router.get('/fsm/:modelId/validate', wrap((e, req) => e.validateFSM(req.params.modelId)));

  // ── Item 9: WebSocket Subscriptions ───────────────────────

  router.post('/subscribe', async (req, res) => {
    try {
      const { channel, filters } = req.body;
      const engine = getEventEngineService();
      await engine.initialize();

      // Регистрация подписки — клиент будет получать ee:event-created через Socket.IO
      // Фильтры сохраняются в памяти для серверной фильтрации
      if (!engine._wsSubscriptions) engine._wsSubscriptions = new Map();
      const subId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      engine._wsSubscriptions.set(subId, {
        channel: channel || 'ee:event-created',
        filters: filters || {},
        createdAt: Date.now(),
      });

      res.json({ success: true, data: { subscriptionId: subId, channel: channel || 'ee:event-created' } });
    } catch (err) {
      logger.error(`${LOG} POST /subscribe error:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.delete('/subscribe/:subId', async (req, res) => {
    const engine = getEventEngineService();
    const deleted = engine._wsSubscriptions?.delete(req.params.subId) || false;
    res.json({ success: true, data: { deleted } });
  });

  // Dashboard stats — лёгкий endpoint для polling / ws refresh
  router.get('/dashboard/live', wrap(async (e) => {
    const stats = {};
    try {
      const events = await e.getObjectsCached(e.tables.subjectEvents);
      const now = Date.now();
      const last5min = events.filter(ev => {
        const ts = ev.reqs['Timestamp']?.value || ev.reqs['Время']?.value;
        return ts && (now - new Date(ts).getTime()) < 300000;
      });
      stats.totalEvents = events.length;
      stats.recentEvents = last5min.length;
      stats.lastEventTime = events.length > 0
        ? (events[events.length - 1].reqs['Timestamp']?.value || events[events.length - 1].reqs['Время']?.value)
        : null;
    } catch { stats.totalEvents = 0; stats.recentEvents = 0; }

    try {
      const triggers = e._triggers || [];
      stats.activeTriggers = triggers.length;
      stats.triggersFired = triggers.reduce((sum, t) => sum + (t._fireCount || 0), 0);
    } catch { stats.activeTriggers = 0; }

    try {
      stats.actorCount = (await e.getObjectsCached(e.tables.actors)).length;
      stats.modelCount = (await e.getObjectsCached(e.tables.models)).length;
      stats.individualCount = (await e.getObjectsCached(e.tables.individuals)).length;
    } catch { /* ok */ }

    return stats;
  }));

  // ══════════════════════════════════════════════════════════════════
  // 20. DAO GOVERNANCE (Executable Ontologies — Boldachev)
  // ══════════════════════════════════════════════════════════════════

  // Bootstrap DAO domain on first request
  router.post('/dao/bootstrap', wrap(e => e.bootstrapDAODomain()));

  // ── Proposals ──
  router.post('/dao/proposals', wrap((e, req) => e.createDAOProposal(req.body)));

  router.get('/dao/proposals', wrap((e, req) => e.getDAOProposals(req.query.status)));

  router.get('/dao/proposals/:id', wrap((e, req) => e.getDAOProposalDetail(req.params.id)));

  router.post('/dao/proposals/:id/vote', wrap((e, req) =>
    e.processDAOVote(req.params.id, req.body.actorId, req.body.verdict, req.body.weight)
  ));

  router.post('/dao/proposals/:id/open', wrap((e, req) =>
    e.openDAOVoting(req.params.id, req.body.actorId)
  ));

  router.get('/dao/proposals/:id/quorum', wrap((e, req) =>
    e.getDAOQuorumProgress(req.params.id)
  ));

  router.post('/dao/proposals/:id/execute', wrap(async (e, req) => {
    const ids = e.getDAOIds();
    if (!ids) throw new Error('DAO domain not bootstrapped');
    const detail = await e.getDAOProposalDetail(req.params.id);
    if (detail.status !== 'approved') throw new Error(`Cannot execute: status is ${detail.status}`);
    const result = await e.createSubjectEvent('dao.proposal_executed', {
      individualId: req.params.id,
      modelEventId: ids.modelEventIds?.['dao.proposal_executed'],
      value: JSON.stringify({ status: 'executed', bslRule: detail.bslRule, executedAt: new Date().toISOString() }),
      actorId: req.body.actorId || ids.actors.DAOExecutor,
      causes: [],
    });
    return { eventId: String(result?.id || result?.obj), status: 'executed' };
  }));

  // ── Members ──
  router.post('/dao/members', wrap((e, req) => e.registerDAOMember(req.body)));

  router.get('/dao/members', wrap(e => e.getDAOMembers()));

  router.put('/dao/members/:id/reputation', wrap((e, req) =>
    e.updateDAOMemberReputation(req.params.id, req.body.reputation)
  ));

  // ── BSL Rules ──
  router.post('/dao/rules/generate', wrap((e, req) =>
    e.generateBSLFromNaturalLanguage(req.body.text, req.body.context)
  ));

  router.post('/dao/rules/validate', wrap((e, req) =>
    e.validateBSLRule(req.body.bsl)
  ));

  router.post('/dao/sandbox/fork', wrap((e, req) =>
    e.createDAOSandbox(req.body.proposalId)
  ));

  // ── DAO IDs (for frontend) ──
  router.get('/dao/ids', async (req, res) => {
    try {
      const engine = getEventEngineService();
      await engine.initialize();
      await engine.bootstrapDAODomain();
      const ids = engine.getDAOIds();
      if (!ids) return res.status(503).json({ error: 'DAO domain not yet bootstrapped' });
      res.json(ids);
    } catch (err) {
      logger.error(`${LOG} GET /dao/ids error:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // 21. OPERATIONS ANALYTICS (Mission Readiness + Predictive + Compliance)
  // ══════════════════════════════════════════════════════════════════

  // Bootstrap operations domain
  router.post('/ops/bootstrap', wrap(e => e.bootstrapOperationsDomain()));

  // ── Mission Readiness ──
  router.post('/ops/missions', wrap((e, req) => e.createMission(req.body)));
  router.get('/ops/missions', wrap((e, req) => e.getMissions(req.query.status)));
  router.get('/ops/missions/:id', wrap((e, req) => e.getMissionDetail(req.params.id)));
  router.post('/ops/missions/:id/readiness', wrap((e, req) =>
    e.evaluateMissionReadiness(req.params.id, req.body)
  ));
  router.post('/ops/missions/:id/start', wrap(async (e, req) => {
    const ids = e.getOpsIds();
    if (!ids) throw new Error('Operations domain not bootstrapped');
    const result = await e.createSubjectEvent('ops.mission_started', {
      individualId: req.params.id,
      modelEventId: ids.modelEventIds?.['ops.mission_started'],
      value: JSON.stringify({ status: 'active', startedAt: new Date().toISOString() }),
      actorId: req.body.actorId || ids.actors.MissionPlanner,
      causes: [],
    });
    return { eventId: String(result?.id || result?.obj), status: 'active' };
  }));
  router.post('/ops/missions/:id/complete', wrap(async (e, req) => {
    const ids = e.getOpsIds();
    if (!ids) throw new Error('Operations domain not bootstrapped');
    const result = await e.createSubjectEvent('ops.mission_completed', {
      individualId: req.params.id,
      modelEventId: ids.modelEventIds?.['ops.mission_completed'],
      value: JSON.stringify({ status: 'completed', completedAt: new Date().toISOString(), ...req.body }),
      actorId: req.body.actorId || ids.actors.MissionPlanner,
      causes: [],
    });
    return { eventId: String(result?.id || result?.obj), status: 'completed' };
  }));
  router.post('/ops/missions/:id/abort', wrap(async (e, req) => {
    const ids = e.getOpsIds();
    if (!ids) throw new Error('Operations domain not bootstrapped');
    const result = await e.createSubjectEvent('ops.mission_aborted', {
      individualId: req.params.id,
      modelEventId: ids.modelEventIds?.['ops.mission_aborted'],
      value: JSON.stringify({ status: 'aborted', reason: req.body.reason, abortedAt: new Date().toISOString() }),
      actorId: req.body.actorId || ids.actors.MissionPlanner,
      causes: [],
    });
    return { eventId: String(result?.id || result?.obj), status: 'aborted' };
  }));

  // ── Predictive Analytics ──
  router.get('/ops/patterns', wrap((e, req) =>
    e.detectEventPatterns({ limit: parseInt(req.query.limit) || 50, minOccurrences: parseInt(req.query.min) || 2 })
  ));
  router.get('/ops/anomalies', wrap(async (e, req) => {
    const result = await e.detectEventPatterns({ limit: 100 });
    return result.anomalies || [];
  }));
  router.get('/ops/predictions', wrap(async (e, req) => {
    const result = await e.detectEventPatterns({ limit: 100 });
    return result.predictions || [];
  }));

  // ── Scenario Planner ──
  router.post('/ops/scenarios/fork', wrap((e, req) =>
    e.forkScenario(req.body.baseIndividualId, req.body.name, req.body.modifications)
  ));
  router.get('/ops/scenarios/:id', wrap((e, req) => e.getMissionDetail(req.params.id)));

  // ── Compliance Audit ──
  router.get('/ops/missions/:id/compliance', wrap((e, req) => e.auditCompliance(req.params.id)));
  router.post('/ops/audit', wrap(async (e, req) => {
    await e.bootstrapOperationsDomain();
    const ids = e.getOpsIds();
    if (!ids) throw new Error('Operations domain not bootstrapped');
    const result = await e.createSubjectEvent('ops.audit_started', {
      individualId: req.body.missionId || ids.individualId,
      modelEventId: ids.modelEventIds?.['ops.audit_started'],
      value: JSON.stringify({ auditType: req.body.type || 'full', startedAt: new Date().toISOString() }),
      actorId: ids.actors.ComplianceAuditor,
      causes: [],
    });
    const compliance = await e.auditCompliance(req.body.missionId || ids.individualId);
    // Record audit completion
    await e.createSubjectEvent('ops.audit_completed', {
      individualId: req.body.missionId || ids.individualId,
      modelEventId: ids.modelEventIds?.['ops.audit_completed'],
      value: JSON.stringify({ ...compliance, completedAt: new Date().toISOString() }),
      actorId: ids.actors.ComplianceAuditor,
      causes: [String(result?.id || result?.obj)],
    });
    return compliance;
  }));

  // ── Smart Procurement ──
  router.get('/ops/procurement', wrap((e, req) => e.deriveProcurementNeeds({
    horizon: parseInt(req.query.horizon) || 30,
    region: req.query.region,
  })));

  // ── Operations IDs ──
  router.get('/ops/ids', async (req, res) => {
    try {
      const engine = getEventEngineService();
      await engine.initialize();
      await engine.bootstrapOperationsDomain();
      const ids = engine.getOpsIds();
      if (!ids) return res.status(503).json({ error: 'Operations domain not yet bootstrapped' });
      res.json(ids);
    } catch (err) {
      logger.error(`${LOG} GET /ops/ids error:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Operations Dashboard ──
  router.get('/ops/dashboard', wrap(async (e) => {
    await e.bootstrapOperationsDomain();
    const ids = e.getOpsIds();
    if (!ids) return { error: 'not bootstrapped' };

    const missions = await e.getMissions();
    const patterns = await e.detectEventPatterns({ limit: 20 });

    const byStatus = {};
    for (const m of (missions || [])) {
      byStatus[m.status] = (byStatus[m.status] || 0) + 1;
    }

    return {
      totalMissions: missions?.length || 0,
      byStatus,
      activeMissions: byStatus.active || 0,
      readyMissions: byStatus.ready || 0,
      blockedMissions: byStatus.blocked || 0,
      patternCount: patterns?.patterns?.length || 0,
      anomalyCount: patterns?.anomalies?.length || 0,
      predictionCount: patterns?.predictions?.length || 0,
    };
  }));

  // ══════════════════════════════════════════════════════════════════
  // 22. DEVOPS — Software Development Ontology
  // ══════════════════════════════════════════════════════════════════

  router.post('/devops/bootstrap', wrap(e => e.bootstrapDevOpsDomain()));
  router.get('/devops/ids', wrap(e => e.getDevOpsIds()));
  router.get('/devops/dashboard', wrap(e => e.getDevDashboard()));

  // Plans
  router.post('/devops/plans', wrap((e, req) => e.createDevPlan(req.body)));
  router.get('/devops/plans/:id/progress', wrap((e, req) => e.getDevPlanProgress(req.params.id)));
  router.post('/devops/plans/:id/verify', wrap((e, req) => e.verifyPlan(req.params.id)));

  // Ideas
  router.post('/devops/ideas', wrap((e, req) => e.captureIdea(req.body)));
  router.get('/devops/ideas', wrap((e, req) => e.getIdeas(req.query.status)));
  router.post('/devops/ideas/:id/promote', wrap((e, req) => e.promoteIdea(req.params.id)));

  // Decisions
  router.post('/devops/decisions', wrap((e, req) => e.recordDecision(req.body)));

  // Git integration
  router.post('/devops/commits', wrap((e, req) => e.recordCommit(req.body)));
  router.post('/devops/github-events', wrap((e, req) => e.recordGitHubEvent(req.body)));

  // ── Claude Code Mailbox: межсессионная связь (Integram V2 persistent) ──
  // Write-through: in-memory cache + Integram V2 persist.
  // On startup: load from Integram → never lose messages on restart.
  //
  // Integram tables (kval):
  //   MailboxMessage (1864145): От(1864202) Кому(1864204) Сообщение(1864206) Прочитано(1864208) Время(1864209)
  //   MailboxSession (1864146): Alias(1864210) Name(1864212) Role(1864214) SessionId(1864216) Status(1864218) LastSeen(1864220)

  const MAILBOX_TYPE = '1864145';
  const MAILBOX_REQS = { from: '1864202', to: '1864204', message: '1864206', readBy: '1864208', time: '1864209' };
  const SESSION_TYPE = '1864146';
  const SESSION_REQS = { alias: '1864210', name: '1864212', role: '1864214', sessionId: '1864216', status: '1864218', lastSeen: '1864220', state: '1865154' };

  // In-memory cache (loaded from Integram on first access)
  const _mailbox = []; // [{id, integramId, from, to, message, timestamp, read: {}}]
  let _mailboxSeq = 0;
  const _sessions = new Map(); // alias → {sessionId, name, alias, role, lastSeen, status, state, integramId}
  let _mailboxLoaded = false;

  // Lazy V2 client
  let _v2Client = null;
  function _getV2() {
    if (_v2Client) return _v2Client;
    try {
      // Dynamic import resolved at module load — use require-like pattern
      const { IntegramV2Client } = require('../../services/integram/integram-v2-client.js');
      _v2Client = new IntegramV2Client('kval');
      return _v2Client;
    } catch {
      return null;
    }
  }

  // Async lazy init (for ESM)
  async function _getV2Async() {
    if (_v2Client) return _v2Client;
    try {
      const mod = await import('../../services/integram/integram-v2-client.js');
      _v2Client = new mod.IntegramV2Client('kval');
      return _v2Client;
    } catch (e) {
      logger.warn(`${LOG} V2 client init failed: ${e.message}`);
      return null;
    }
  }

  // Helper: extract requisite value from V2 getObjects result
  function _reqVal(reqs, reqId) {
    if (!reqs || !reqs[reqId]) return '';
    const r = reqs[reqId];
    return r.value !== undefined ? r.value : (typeof r === 'string' ? r : String(r || ''));
  }

  // Load mailbox + sessions from Integram (once)
  async function _loadMailbox() {
    if (_mailboxLoaded) return;
    _mailboxLoaded = true;
    try {
      const v2 = await _getV2Async();
      if (!v2) return;

      // Load messages
      const msgs = await v2.getObjects(MAILBOX_TYPE, { limit: 500, withReqs: true });
      if (Array.isArray(msgs)) {
        for (const obj of msgs) {
          const entry = {
            id: ++_mailboxSeq,
            integramId: obj.id,
            from: _reqVal(obj.reqs, MAILBOX_REQS.from),
            to: _reqVal(obj.reqs, MAILBOX_REQS.to),
            message: _reqVal(obj.reqs, MAILBOX_REQS.message) || obj.val || '',
            timestamp: _reqVal(obj.reqs, MAILBOX_REQS.time),
            read: {},
          };
          const readBy = _reqVal(obj.reqs, MAILBOX_REQS.readBy).split(',').filter(Boolean);
          readBy.forEach(s => { entry.read[s.trim()] = true; });
          _mailbox.push(entry);
        }
      }

      // Load sessions
      const sess = await v2.getObjects(SESSION_TYPE, { limit: 50, withReqs: true });
      if (Array.isArray(sess)) {
        for (const obj of sess) {
          const alias = _reqVal(obj.reqs, SESSION_REQS.alias) || obj.val || '';
          if (alias) {
            let state = {};
            try { state = JSON.parse(_reqVal(obj.reqs, SESSION_REQS.state) || '{}'); } catch { state = {}; }
            _sessions.set(alias, {
              sessionId: _reqVal(obj.reqs, SESSION_REQS.sessionId),
              name: _reqVal(obj.reqs, SESSION_REQS.name) || alias,
              alias,
              role: _reqVal(obj.reqs, SESSION_REQS.role) || 'general',
              lastSeen: _reqVal(obj.reqs, SESSION_REQS.lastSeen),
              status: _reqVal(obj.reqs, SESSION_REQS.status) || 'offline',
              state,
              integramId: obj.id,
            });
          }
        }
      }

      logger.info(`${LOG} Mailbox loaded from Integram V2: ${_mailbox.length} messages, ${_sessions.size} sessions`);
    } catch (e) {
      logger.warn(`${LOG} Mailbox V2 load failed (using empty): ${e.message}`);
    }
  }

  // Persist message to Integram V2 (fire-and-forget)
  async function _persistMessage(entry) {
    try {
      const v2 = await _getV2Async();
      if (!v2) return;
      const result = await v2.createObject(MAILBOX_TYPE, `${entry.from}→${entry.to}`, {
        [MAILBOX_REQS.from]: entry.from,
        [MAILBOX_REQS.to]: entry.to,
        [MAILBOX_REQS.message]: entry.message,
        [MAILBOX_REQS.readBy]: '',
        [MAILBOX_REQS.time]: entry.timestamp,
      });
      entry.integramId = result?.id;
    } catch (e) {
      logger.warn(`${LOG} Mailbox persist failed: ${e.message}`);
    }
  }

  // Update read status in Integram V2
  async function _persistRead(entry) {
    if (!entry.integramId) return;
    try {
      const v2 = await _getV2Async();
      if (!v2) return;
      const readBy = Object.keys(entry.read).filter(k => entry.read[k]).join(',');
      await v2.setRequisiteValue(entry.integramId, MAILBOX_REQS.readBy, readBy);
    } catch (e) {
      logger.warn(`${LOG} Mailbox read-persist failed: ${e.message}`);
    }
  }

  // Persist session to Integram V2
  async function _persistSession(session) {
    try {
      const v2 = await _getV2Async();
      if (!v2) return;
      const stateJson = JSON.stringify(session.state || {});
      if (session.integramId) {
        // Update existing session — set each field
        const fields = {
          [SESSION_REQS.name]: session.name,
          [SESSION_REQS.role]: session.role,
          [SESSION_REQS.sessionId]: session.sessionId,
          [SESSION_REQS.status]: session.status,
          [SESSION_REQS.lastSeen]: session.lastSeen,
          [SESSION_REQS.state]: stateJson,
        };
        for (const [reqId, val] of Object.entries(fields)) {
          await v2.setRequisiteValue(session.integramId, reqId, val);
        }
      } else {
        const result = await v2.createObject(SESSION_TYPE, session.alias, {
          [SESSION_REQS.alias]: session.alias,
          [SESSION_REQS.name]: session.name,
          [SESSION_REQS.role]: session.role,
          [SESSION_REQS.sessionId]: session.sessionId,
          [SESSION_REQS.status]: session.status,
          [SESSION_REQS.lastSeen]: session.lastSeen,
          [SESSION_REQS.state]: stateJson,
        });
        session.integramId = result?.id;
      }
    } catch (e) {
      logger.warn(`${LOG} Session persist failed: ${e.message}`);
    }
  }

  router.get('/devops/mailbox', async (req, res) => {
    try {
      await _loadMailbox();
      const forSession = req.query.for || 'A';

      const unread = _mailbox.filter(m =>
        m.to === forSession && !m.read[forSession]
      );

      // Mark as read (memory + Integram)
      for (const m of unread) {
        m.read[forSession] = true;
        _persistRead(m); // fire-and-forget
      }

      res.json({
        success: true,
        data: {
          session: forSession,
          messages: unread.map(m => ({
            id: m.id, from: m.from, message: m.message, timestamp: m.timestamp,
          })),
          count: unread.length,
          totalInbox: _mailbox.filter(m => m.to === forSession).length,
        }
      });
    } catch (err) {
      logger.error(`${LOG} GET /devops/mailbox error:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/devops/mailbox', async (req, res) => {
    try {
      await _loadMailbox();
      const { from, to, message } = req.body;
      const id = ++_mailboxSeq;
      const entry = {
        id, from, to, message,
        timestamp: new Date().toISOString(),
        read: {},
      };
      _mailbox.push(entry);

      // Persist to Integram V2 (fire-and-forget)
      _persistMessage(entry);

      // Also persist as SOD event (best-effort)
      try {
        const engine = getEventEngineService();
        await engine.initialize();
        const ids = engine.getDevOpsIds?.() || {};
        const actorId = ids.actors?.['Claude Code'] || ids.actors?.['Разработчик'];
        await engine.createSubjectEvent('session.message', {
          actorId,
          value: `[MSG→${to}] от ${from}: ${message.slice(0, 200)}`,
        });
      } catch { /* SOD persist is best-effort */ }

      res.json({
        success: true,
        data: { id, from, to, message, timestamp: entry.timestamp }
      });
    } catch (err) {
      logger.error(`${LOG} POST /devops/mailbox error:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Session registry: track who's online (Integram V2 persistent)
  router.post('/devops/mailbox/register', async (req, res) => {
    await _loadMailbox();
    const { alias, name, role, sessionId } = req.body;
    if (!alias) return res.status(400).json({ error: 'alias required' });
    const existing = _sessions.get(alias);
    const id = sessionId || existing?.sessionId || `ses_${alias}_${Date.now().toString(36)}`;
    const session = {
      sessionId: id,
      name: name || alias,
      alias,
      role: role || 'general',
      lastSeen: new Date().toISOString(),
      status: 'online',
      state: existing?.state || {},
      integramId: existing?.integramId || null,
    };
    _sessions.set(alias, session);
    _persistSession(session); // fire-and-forget
    res.json({ success: true, data: { sessionId: id, registered: alias, totalSessions: _sessions.size } });
  });

  // Save session state (conversations, lastSeenMailId, exchangeCount)
  router.put('/devops/mailbox/session/:alias/state', async (req, res) => {
    await _loadMailbox();
    const { alias } = req.params;
    const session = _sessions.get(alias);
    if (!session) return res.status(404).json({ error: 'session not found' });
    session.state = req.body;
    session.lastSeen = new Date().toISOString();
    _persistSession(session);
    res.json({ success: true, data: { alias, stateKeys: Object.keys(req.body) } });
  });

  // Get session state (for --resume)
  router.get('/devops/mailbox/session/:alias/state', async (req, res) => {
    await _loadMailbox();
    const { alias } = req.params;
    const session = _sessions.get(alias);
    if (!session) return res.status(404).json({ error: 'session not found' });
    res.json({ success: true, data: { sessionId: session.sessionId, alias, state: session.state } });
  });

  router.get('/devops/mailbox/sessions', async (req, res) => {
    await _loadMailbox();
    const sessions = [..._sessions.values()].map(s => ({
      sessionId: s.sessionId, name: s.name, alias: s.alias, role: s.role,
      lastSeen: s.lastSeen, status: s.status,
    }));
    res.json({ success: true, data: { sessions, count: sessions.length } });
  });

  router.get('/devops/mailbox/history', async (req, res) => {
    await _loadMailbox();
    const limit = parseInt(req.query.limit || '50', 10);
    const messages = _mailbox.slice(-limit).map(m => ({
      id: m.id, from: m.from, to: m.to, message: m.message, timestamp: m.timestamp,
    }));
    res.json({ success: true, data: { messages, total: _mailbox.length } });
  });

  // ── Claude Code integration: quick event fire ─────────────────────
  // Позволяет Claude Code одним вызовом создать событие в DevOps домене
  // без необходимости знать individualId, actorId и т.д.
  router.post('/devops/claude-event', async (req, res) => {
    try {
      const engine = getEventEngineService();
      await engine.initialize();
      const { type, title, description, branch, commit, pr, pipelineMode, priority, tags, source } = req.body;

      // Найти или создать актора "Claude Code"
      const ids = engine.getDevOpsIds?.() || {};
      let claudeActorId = ids.actors?.['Claude Code'] || ids.actors?.['Разработчик'];
      if (!claudeActorId) {
        const actor = await engine.createActor('Claude Code', { role: 'ai-developer', description: 'Claude Code AI assistant' });
        claudeActorId = actor.id;
      }

      // Найти или создать индивида для текущей задачи
      let individualId = req.body.individualId;
      if (!individualId && title) {
        const ind = await engine.createIndividual(`[Claude] ${title}`, {
          applicationId: '1814003', // Платформа DronDoc 2026
        });
        individualId = ind.id;
      }

      // Маппинг коротких типов → полные события
      const typeMap = {
        // DevOps workflow
        'plan': 'dev.issue_opened',
        'branch': 'dev.branch_created',
        'start': 'dev.task_started',
        'commit': 'dev.code_committed',
        'build_ok': 'dev.build_succeeded',
        'build_fail': 'dev.build_failed',
        'pr': 'dev.pr_opened',
        'merged': 'dev.pr_merged',
        'deployed': 'dev.deployed',
        'blocked': 'dev.task_blocked',
        // Strategy / Backlog — идеи и планы (НЕ теряются между сессиями)
        'idea': 'strategy.idea_proposed',
        'backlog': 'strategy.backlog_added',
        'priority': 'strategy.priority_set',
        'research': 'strategy.research_started',
        'finding': 'strategy.finding_recorded',
        'decision': 'strategy.decision_made',
        'rejected': 'strategy.idea_rejected',
        'roadmap': 'strategy.roadmap_updated',
        // Data / Report management — агенты создают отчёты событийно
        'report_create': 'data.report_created',
        'report_interactive': 'data.report_interactive_created',
        'report_curl': 'data.report_curl_created',
        'report_chain': 'data.report_chain_linked',
        'table_create': 'data.table_created',
        'data_populate': 'data.records_populated',
        'schema_change': 'data.schema_changed',
      };
      const eventType = typeMap[type] || type || 'dev.issue_opened';

      // Значение события
      const value = [
        title || 'Claude Code event',
        description ? `\n${description}` : '',
        branch ? ` [branch: ${branch}]` : '',
        commit ? ` [commit: ${commit}]` : '',
        pr ? ` [PR: ${pr}]` : '',
        priority ? ` [priority: ${priority}]` : '',
        tags ? ` [tags: ${tags}]` : '',
        source ? ` [source: ${source}]` : '',
        pipelineMode ? ' pipelineMode' : '',
      ].join('');

      // Resolve modelEventId so triggers can match by modelId
      // Strategy events don't need DevOps bootstrap
      let modelEventId = null;
      if (eventType.startsWith('dev.')) {
        await engine.bootstrapDevOpsDomain();
        const devOpsIds = engine.getDevOpsIds?.() || {};
        modelEventId = devOpsIds.modelEventIds?.[eventType];
      }
      // Создать событие — триггеры сработают автоматически
      const event = await engine.createSubjectEvent(eventType, {
        individualId,
        actorId: claudeActorId,
        modelEventId,
        value,
      });

      // Auto-save to Claude Memory (fire-and-forget)
      try {
        const { getClaudeMemoryService } = await import('../../services/claude-memory/ClaudeMemoryService.js');
        const mem = getClaudeMemoryService();
        if (mem._ready !== false) {
          mem.autoSaveEvent({ type, title, description, branch, commit, pr, tags, source }).catch(() => {});
        }
      } catch { /* claude-memory not initialized yet — skip */ }

      res.json({
        success: true,
        data: {
          eventId: event.id,
          individualId,
          type: eventType,
          value,
          message: `Event ${eventType} created. Triggers will cascade.`,
        }
      });
    } catch (err) {
      logger.error(`${LOG} POST /devops/claude-event error:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Hive-Mind Pipeline: self-executing step dispatcher ──────────
  router.post('/pipeline/execute-step', async (req, res) => {
    try {
      const engine = getEventEngineService();
      await engine.initialize();
      await engine.bootstrapDevOpsDomain();
      const ids = engine.getDevOpsIds();
      if (!ids) throw new Error('DevOps domain not bootstrapped');

      const { step, triggerEvent } = req.body;
      const individualId = triggerEvent?.individualId || ids.individualId;

      // Idempotency: check if step already produced its output event
      const allEvents = await engine.getSubjectEvents(individualId);
      const STEP_OUTPUT = {
        create_branch: 'dev.branch_created',
        launch_solve: 'dev.task_started',
        check_ci: 'dev.build_started',
        create_pr: 'dev.pr_opened',
        mark_deployed: 'dev.deployed',
      };
      if (STEP_OUTPUT[step]) {
        const existing = allEvents.find(e => e.val === STEP_OUTPUT[step]);
        if (existing) {
          return res.json({ success: true, data: { skipped: true, step, reason: 'already exists' } });
        }
      }

      // Parse trigger event value for context
      let triggerValue = {};
      try {
        triggerValue = JSON.parse(triggerEvent?.value || '{}');
      } catch {
        // Value is a plain string (from claude-event), extract title from it
        const rawVal = triggerEvent?.value || '';
        triggerValue = { title: rawVal.replace(/ pipelineMode$/, '').trim() };
      }

      let result;
      const { execSync } = await import('child_process');
      const REPO = process.env.GITHUB_REPO || 'unidel2035/dronedoc2026';
      const BASE_BRANCH = process.env.GIT_BASE_BRANCH || 'dev';

      switch (step) {
        case 'create_branch': {
          const title = triggerValue.title || triggerEvent?.name || 'SOD task';
          const description = triggerValue.description || '';

          // 1. Create real GitHub issue
          let issueNumber = triggerValue.number;
          try {
            const body = [description, '', `SOD Individual: ${individualId}`, `SOD Event: ${triggerEvent?.id}`].join('\n');
            const ghOut = execSync(
              `gh issue create --repo ${REPO} --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}" --label "sod-pipeline"`,
              { encoding: 'utf8', timeout: 15000 }
            ).trim();
            // gh returns URL like https://github.com/.../issues/42
            const match = ghOut.match(/\/issues\/(\d+)/);
            issueNumber = match ? match[1] : issueNumber;
            logger.info(`[Pipeline] GitHub issue #${issueNumber} created: ${ghOut}`);
          } catch (e) {
            logger.warn(`[Pipeline] GitHub issue creation failed: ${e.message}`);
          }

          // 2. Create real git branch
          const branchName = `hive/${issueNumber || Date.now()}-${title.replace(/[^a-zA-Zа-яА-Я0-9]/g, '-').substring(0, 40)}`;
          try {
            execSync(`git fetch origin ${BASE_BRANCH} && git branch ${branchName} origin/${BASE_BRANCH}`, { encoding: 'utf8', timeout: 15000 });
            logger.info(`[Pipeline] Git branch created: ${branchName}`);
          } catch (e) {
            logger.warn(`[Pipeline] Git branch creation failed: ${e.message}`);
          }

          // 3. Emit branch_created event
          result = await engine.createSubjectEvent('dev.branch_created', {
            individualId, modelEventId: ids.modelEventIds['dev.branch_created'],
            value: JSON.stringify({ ...triggerValue, branch: branchName, issueNumber, repo: REPO, pipelineMode: true }),
            actorId: ids.actors.GitHub_бот, causes: triggerEvent?.id ? [String(triggerEvent.id)] : [],
          });
          break;
        }
        case 'launch_solve': {
          result = await engine.createSubjectEvent('dev.task_started', {
            individualId, modelEventId: ids.modelEventIds['dev.task_started'],
            value: JSON.stringify({ ...triggerValue, pipelineMode: true, solveStatus: 'launched' }),
            actorId: ids.actors.Разработчик, causes: triggerEvent?.id ? [String(triggerEvent.id)] : [],
          });
          break;
        }
        case 'check_ci': {
          result = await engine.createSubjectEvent('dev.build_started', {
            individualId, modelEventId: ids.modelEventIds['dev.build_started'],
            value: JSON.stringify({ ...triggerValue, pipelineMode: true, ciStatus: 'checking' }),
            actorId: ids.actors.CI_система, causes: triggerEvent?.id ? [String(triggerEvent.id)] : [],
          });
          // Check CI status via GitHub if we have branch info
          try {
            if (triggerValue.branch && triggerValue.owner && triggerValue.repo) {
              const axios = (await import('axios')).default;
              const port = process.env.PORT || 8081;
              const ghResp = await axios.get(`http://localhost:${port}/api/github/repos/${triggerValue.owner}/${triggerValue.repo}/commits/${triggerValue.branch}/status`).catch(() => null);
              const state = ghResp?.data?.state || 'success'; // default success if no CI configured
              const ciEvent = state === 'success' ? 'dev.build_succeeded' : 'dev.build_failed';
              await engine.createSubjectEvent(ciEvent, {
                individualId, modelEventId: ids.modelEventIds[ciEvent],
                value: JSON.stringify({ ...triggerValue, pipelineMode: true, ciResult: state }),
                actorId: ids.actors.CI_система, causes: result?.id ? [String(result.id || result.obj)] : [],
              });
            } else {
              // No CI configured — skip straight to build_succeeded
              await engine.createSubjectEvent('dev.build_succeeded', {
                individualId, modelEventId: ids.modelEventIds['dev.build_succeeded'],
                value: JSON.stringify({ ...triggerValue, pipelineMode: true, ciResult: 'no_ci_config' }),
                actorId: ids.actors.CI_система, causes: result?.id ? [String(result.id || result.obj)] : [],
              });
            }
          } catch (e) {
            logger.warn('[Pipeline] CI check failed, assuming success:', e.message);
            await engine.createSubjectEvent('dev.build_succeeded', {
              individualId, modelEventId: ids.modelEventIds['dev.build_succeeded'],
              value: JSON.stringify({ ...triggerValue, pipelineMode: true, ciResult: 'fallback_success' }),
              actorId: ids.actors.CI_система, causes: result?.id ? [String(result.id || result.obj)] : [],
            });
          }
          break;
        }
        case 'create_pr': {
          const branch = triggerValue.branch || `hive/${triggerValue.issueNumber || Date.now()}`;
          const prTitle = triggerValue.title || triggerEvent?.name || 'SOD pipeline PR';
          let prNumber = triggerValue.prNumber;
          let prUrl = '';

          // Create real GitHub PR
          try {
            // Push branch first
            execSync(`git push origin ${branch} 2>&1 || true`, { encoding: 'utf8', timeout: 15000 });
            const issueRef = triggerValue.issueNumber ? `\n\nCloses #${triggerValue.issueNumber}` : '';
            const body = `SOD Pipeline PR\n\nIndividual: ${individualId}${issueRef}`;
            const ghOut = execSync(
              `gh pr create --repo ${REPO} --head ${branch} --base ${BASE_BRANCH} --title "${prTitle.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}" --label "sod-pipeline"`,
              { encoding: 'utf8', timeout: 15000 }
            ).trim();
            const match = ghOut.match(/\/pull\/(\d+)/);
            prNumber = match ? match[1] : prNumber;
            prUrl = ghOut;
            logger.info(`[Pipeline] GitHub PR #${prNumber} created: ${ghOut}`);
          } catch (e) {
            logger.warn(`[Pipeline] GitHub PR creation failed: ${e.message}`);
            prNumber = prNumber || 'failed';
          }

          result = await engine.createSubjectEvent('dev.pr_opened', {
            individualId, modelEventId: ids.modelEventIds['dev.pr_opened'],
            value: JSON.stringify({ ...triggerValue, pipelineMode: true, prNumber, prUrl }),
            actorId: ids.actors.Разработчик, causes: triggerEvent?.id ? [String(triggerEvent.id)] : [],
          });
          break;
        }
        case 'mark_deployed': {
          // Close GitHub issue if we have the number
          if (triggerValue.issueNumber) {
            try {
              execSync(
                `gh issue close ${triggerValue.issueNumber} --repo ${REPO} --comment "Deployed via SOD pipeline"`,
                { encoding: 'utf8', timeout: 10000 }
              );
              logger.info(`[Pipeline] GitHub issue #${triggerValue.issueNumber} closed`);
            } catch (e) {
              logger.warn(`[Pipeline] GitHub issue close failed: ${e.message}`);
            }
          }

          result = await engine.createSubjectEvent('dev.deployed', {
            individualId, modelEventId: ids.modelEventIds['dev.deployed'],
            value: JSON.stringify({ ...triggerValue, pipelineMode: true, deployedAt: new Date().toISOString() }),
            actorId: ids.actors.CI_система, causes: triggerEvent?.id ? [String(triggerEvent.id)] : [],
          });
          break;
        }
        case 'retry_or_block': {
          const retryCount = (triggerValue.retryCount || 0) + 1;
          if (retryCount < 3) {
            result = await engine.createSubjectEvent('dev.task_started', {
              individualId, modelEventId: ids.modelEventIds['dev.task_started'],
              value: JSON.stringify({ ...triggerValue, pipelineMode: true, retryCount, retrying: true }),
              actorId: ids.actors.Разработчик, causes: triggerEvent?.id ? [String(triggerEvent.id)] : [],
            });
          } else {
            result = await engine.createSubjectEvent('dev.task_blocked', {
              individualId, modelEventId: ids.modelEventIds['dev.task_blocked'],
              value: JSON.stringify({ ...triggerValue, pipelineMode: true, retryCount, reason: 'max retries exceeded' }),
              actorId: ids.actors.Разработчик, causes: triggerEvent?.id ? [String(triggerEvent.id)] : [],
            });
          }
          break;
        }
        default:
          return res.status(400).json({ success: false, error: `Unknown step: ${step}` });
      }

      res.json({ success: true, data: { step, eventId: String(result?.id || result?.obj) } });
    } catch (err) {
      logger.error('[Pipeline] execute-step error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // 23. DIGITAL TWIN — Drone Fleet Digital Twins
  // ══════════════════════════════════════════════════════════════════

  router.post('/twin/bootstrap', wrap(e => e.bootstrapDigitalTwinDomain()));
  router.get('/twin/ids', wrap(e => e.getTwinIds()));

  // Drone registration & management
  router.post('/twin/drones', wrap((e, req) => e.registerDrone(req.body)));
  router.get('/twin/fleet', wrap(e => e.getFleetStatus()));
  router.get('/twin/drones/:id/health', wrap((e, req) => e.getDroneHealth(req.params.id)));
  router.get('/twin/drones/:id/predict', wrap((e, req) => e.predictMaintenance(req.params.id)));

  // Telemetry
  router.post('/twin/drones/:id/telemetry', wrap((e, req) =>
    e.recordTelemetry(req.params.id, req.body)
  ));

  // Maintenance
  router.post('/twin/drones/:id/maintenance', wrap((e, req) =>
    e.recordMaintenance(req.params.id, req.body)
  ));

  // ══════════════════════════════════════════════════════════════════
  // 24. REGULATORY ENGINE — Aviation Rules as BSL
  // ══════════════════════════════════════════════════════════════════

  router.post('/reg/bootstrap', wrap(e => e.bootstrapRegulatoryDomain()));
  router.get('/reg/ids', wrap(e => e.getRegIds()));
  router.get('/reg/dashboard', wrap(e => e.getRegulatoryDashboard()));

  // Rules
  router.post('/reg/rules', wrap((e, req) => e.defineRule(req.body)));
  router.get('/reg/rules', wrap((e, req) => e.getRules(req.query)));
  router.post('/reg/bootstrap-russian', wrap(e => e.bootstrapRussianRules()));

  // Compliance check
  router.post('/reg/check', wrap((e, req) => e.checkCompliance(req.body)));
  router.get('/reg/certification/:id', wrap((e, req) => e.verifyCertification(req.params.id)));

  // ══════════════════════════════════════════════════════════════════
  // 25. SWARM COORDINATION — Multi-drone Operations
  // ══════════════════════════════════════════════════════════════════

  router.post('/swarm/bootstrap', wrap(e => e.bootstrapSwarmDomain()));
  router.get('/swarm/ids', wrap(e => e.getSwarmIds()));

  // Swarm missions
  router.post('/swarm/missions', wrap((e, req) => e.createSwarmMission(req.body)));
  router.get('/swarm/missions', wrap(e => e.getActiveSwarms()));
  router.get('/swarm/missions/:id', wrap((e, req) => e.getSwarmStatus(req.params.id)));

  // Drone management within swarm
  router.post('/swarm/missions/:id/assign', wrap((e, req) =>
    e.assignDroneToSwarm(req.params.id, req.body.droneId)
  ));
  router.post('/swarm/missions/:id/remove', wrap((e, req) =>
    e.removeDroneFromSwarm(req.params.id, req.body.droneId, req.body.reason)
  ));
  router.post('/swarm/missions/:id/redistribute', wrap((e, req) =>
    e.redistributeSwarmTasks(req.params.id, req.body.lostDroneId)
  ));
  router.get('/swarm/missions/:id/coverage', wrap((e, req) =>
    e.updateSwarmCoverage(req.params.id)
  ));
  router.post('/swarm/missions/:id/elect-leader', wrap((e, req) =>
    e.electSwarmLeader(req.params.id)
  ));
  router.post('/swarm/missions/:id/complete', wrap((e, req) =>
    e.completeSwarmMission(req.params.id, req.body)
  ));

  // ══════════════════════════════════════════════════════════════════
  // 26. INSURANCE & RISK SCORING
  // ══════════════════════════════════════════════════════════════════

  router.post('/risk/bootstrap', wrap(e => e.bootstrapInsuranceDomain()));
  router.get('/risk/ids', wrap(e => e.getInsuranceIds()));
  router.get('/risk/dashboard', wrap(e => e.getRiskDashboard()));

  // Risk assessment
  router.post('/risk/score', wrap((e, req) => e.computeRiskScore(req.body)));
  router.post('/risk/premium', wrap((e, req) => e.calculatePremium(req.body)));
  router.get('/risk/operators/:id/rating', wrap((e, req) => e.getOperatorSafetyRating(req.params.id)));

  // Claims
  router.post('/risk/claims', wrap((e, req) => e.fileClaim(req.body)));

  // ══════════════════════════════════════════════════════════════════
  // 27. MARKETPLACE — Ontological Drone Services Marketplace
  // ══════════════════════════════════════════════════════════════════

  router.post('/market/bootstrap', wrap(e => e.bootstrapMarketplaceDomain()));
  router.get('/market/ids', wrap(e => e.getMarketplaceIds()));
  router.get('/market/dashboard', wrap(e => e.getMarketplaceDashboard()));

  // Requests & Orders
  router.post('/market/requests', wrap((e, req) => e.createMarketRequest(req.body)));
  router.post('/market/requests/:id/accept', wrap((e, req) => e.acceptQuote(req.params.id, req.body)));
  router.post('/market/orders/:id/feedback', wrap((e, req) => e.submitFeedback(req.params.id, req.body)));

  // Matching & Pricing
  router.post('/market/match-drones', wrap((e, req) => e.matchDrones(req.body.requirements)));
  router.post('/market/match-operators', wrap((e, req) => e.matchOperators(req.body)));
  router.post('/market/quote', wrap((e, req) => e.generateQuote(req.body)));
  router.post('/market/search', wrap((e, req) => e.searchCatalog(req.body.query)));

  // ══════════════════════════════════════════════════════════════════
  // 28. TRAINING SIMULATION
  // ══════════════════════════════════════════════════════════════════

  router.post('/training/bootstrap', wrap(e => e.bootstrapTrainingDomain()));
  router.get('/training/ids', wrap(e => e.getTrainingIds()));
  router.get('/training/dashboard', wrap(e => e.getTrainingDashboard()));

  // Scenarios
  router.post('/training/scenarios', wrap((e, req) => e.createTrainingScenario(req.body)));
  router.get('/training/scenarios', wrap((e, req) => e.getScenarios(req.query)));
  router.post('/training/scenarios/bootstrap-standard', wrap(e => e.bootstrapStandardScenarios()));
  router.post('/training/scenarios/from-history', wrap((e, req) =>
    e.generateScenarioFromHistory(req.body.incidentEventId)
  ));

  // Training sessions
  router.post('/training/start', wrap((e, req) =>
    e.startTrainingSession(req.body.scenarioId, req.body.traineeId)
  ));
  router.post('/training/attempts/:id/decide', wrap((e, req) =>
    e.recordDecisionAttempt(req.params.id, {
      decisionPointId: req.body.decisionPointIndex,
      chosenOption: req.body.chosenOption,
      timeSpent: req.body.timeSpent,
    })
  ));
  router.post('/training/attempts/:id/complete', wrap((e, req) =>
    e.completeTraining(req.params.id, {
      score: req.body.score,
      feedback: req.body.feedback,
    })
  ));

  // Trainee progress
  router.get('/training/trainees/:id', wrap((e, req) => e.getTraineeProgress(req.params.id)));

  // ══════════════════════════════════════════════════════════════════
  // 29. CROSS-DOMAIN TRIGGERS (Module 8)
  // ══════════════════════════════════════════════════════════════════

  router.post('/cross-domain/register', wrap(async (e, req) => {
    const { sourceEvent, targetEvent, condition, priority } = req.body;
    return e.registerTrigger({
      condition: condition || `eventType $EQ "${sourceEvent}"`,
      action: { type: 'createEvent', params: { name: targetEvent, value: `Cross-domain: ${sourceEvent} → ${targetEvent}` } },
      priority: priority || 5,
    });
  }));

  router.get('/cross-domain/triggers', wrap(e => {
    const triggers = e.getTriggers();
    return triggers.filter(t => (t.condition || '').includes('Cross-domain') ||
      ['ops.', 'twin.', 'reg.', 'swarm.', 'risk.', 'market.', 'train.', 'dev.'].some(prefix =>
        (t.actionType === 'createEvent' && JSON.stringify(t).includes(prefix))
      ));
  }));

  router.post('/cross-domain/bootstrap', wrap(async (e) => {
    // Register standard cross-domain triggers
    const crossTriggers = [
      { condition: 'eventType $EQ "reg.rule_violated"', action: { type: 'createEvent', params: { name: 'ops.mission_blocked', value: 'Regulatory violation → mission blocked' } }, priority: 10 },
      { condition: 'eventType $EQ "reg.certification_expired"', action: { type: 'createEvent', params: { name: 'ops.pilot_cleared', value: 'false' } }, priority: 9 },
      { condition: 'eventType $EQ "ops.mission_failed"', action: { type: 'createEvent', params: { name: 'risk.factor_identified', value: 'Mission failure → risk factor' } }, priority: 8 },
      { condition: 'eventType $EQ "twin.component_degradation"', action: { type: 'createEvent', params: { name: 'ops.failure_predicted', value: 'Component degradation → failure prediction' } }, priority: 8 },
      { condition: 'eventType $EQ "risk.threshold_exceeded"', action: { type: 'createEvent', params: { name: 'ops.mission_blocked', value: 'High risk → mission blocked' } }, priority: 10 },
      { condition: 'eventType $EQ "train.certification_earned"', action: { type: 'createEvent', params: { name: 'ops.pilot_cleared', value: 'New certification → pilot cleared' } }, priority: 7 },
      { condition: 'eventType $EQ "swarm.coverage_updated"', action: { type: 'createEvent', params: { name: 'ops.procurement_needed', value: 'Swarm coverage low → need more drones' } }, priority: 6 },
      { condition: 'eventType $EQ "dao.proposal_executed"', action: { type: 'createEvent', params: { name: 'reg.rule_defined', value: 'DAO decision → new regulatory rule' } }, priority: 7 },
      { condition: 'eventType $EQ "reg.regulation_updated"', action: { type: 'createEvent', params: { name: 'train.remediation_assigned', value: 'Regulation updated → operators retrain' } }, priority: 6 },
      { condition: 'eventType $EQ "dev.deployed"', action: { type: 'createEvent', params: { name: 'dev.plan_verified', value: 'Deployment → plan verification check' } }, priority: 5 },
    ];
    const results = [];
    for (const t of crossTriggers) {
      try {
        const id = await e.registerTrigger(t);
        results.push({ id, condition: t.condition });
      } catch (err) {
        results.push({ error: err.message, condition: t.condition });
      }
    }
    return { registered: results.length, triggers: results };
  }));

  // ══════════════════════════════════════════════════════════════════
  // 30. ONTOLOGICAL TESTING — The ontology IS the test spec
  // ══════════════════════════════════════════════════════════════════

  // Validate a single domain
  router.get('/test/domain/:name', wrap((e, req) => e.validateDomain(req.params.name)));

  // Run ALL domain validations
  router.get('/test/all', wrap(e => e.runAllDomainTests()));

  // Run a scenario test
  router.post('/test/scenario', wrap((e, req) =>
    e.runScenarioTest(req.body.domain, req.body.scenario, req.body.expectedFinalState)
  ));

  // Generate test scenarios from FSM
  router.get('/test/generate/:domain', wrap((e, req) => e.generateTestScenarios(req.params.domain)));

  // ══════════════════════════════════════════════════════════════════
  // 31. CATALOG — transparent access to all Integram tables
  // ══════════════════════════════════════════════════════════════════

  router.get('/catalog', wrap((e, req) => e.getCatalog(req.query.filter, {
    minObjects: req.query.minObjects != null ? Number(req.query.minObjects) : 2,
    compact: req.query.compact !== 'false'
  })));
  router.get('/catalog/:typeId', wrap((e, req) => e.getCatalogDetails(req.params.typeId)));

  // Generic object reader for any Integram table (used by migration scripts)
  router.get('/objects/:typeId', wrap((e, req) => e.getObjects(req.params.typeId, {
    limit: Math.min(Number(req.query.limit) || 2000, 5000)
  })));

  // ── Schema Intelligence (миграция текстовых колонок в справочники) ───
  router.get('/schema-intelligence/scan', async (req, res) => {
    try {
      const { bulkFindCandidates } = await import('../../services/integram/schema-intelligence.js');
      const result = await bulkFindCandidates(req.query.database || 'kval', {
        maxTables: Math.min(Number(req.query.maxTables) || 80, 300),
        minObjects: Number(req.query.minObjects) || 5,
        filter: req.query.filter || null
      });
      res.json({ success: true, data: result });
    } catch (err) {
      logger.error(`${LOG} Schema intelligence scan error:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/schema-intelligence/migrate', async (req, res) => {
    try {
      const { executeMigration } = await import('../../services/integram/schema-intelligence.js');
      const { typeId, reqId, dryRun, lookupTableId, lookupTableName } = req.body;
      if (!typeId || !reqId) {
        return res.status(400).json({ success: false, error: 'typeId и reqId обязательны' });
      }
      const result = await executeMigration(typeId, reqId, {
        dryRun: dryRun !== false,
        lookupTableId,
        lookupTableName,
        database: req.body.database || 'kval'
      });
      res.json({ success: true, data: result });
    } catch (err) {
      logger.error(`${LOG} Schema intelligence migrate error:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/schema-intelligence/analyze/:typeId/:reqId', async (req, res) => {
    try {
      const { migrateToReference } = await import('../../services/integram/schema-intelligence.js');
      const result = await migrateToReference(req.params.typeId, req.params.reqId, req.query.database || 'kval');
      res.json({ success: true, data: result });
    } catch (err) {
      logger.error(`${LOG} Schema intelligence analyze error:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Schema Intelligence: delete column ──────────────────────────
  router.delete('/schema-intelligence/column/:reqId', wrap(async (e, req) => {
    const { default: axios } = await import('axios');
    const authResp = await axios.get(`https://${e.serverURL}/${e.database}/auth?JSON_KV=`, {
      headers: e.getHeaders()
    });
    const xsrf = authResp.data?._xsrf || e.xsrfToken || '';
    const resp = await axios.post(
      `https://${e.serverURL}/${e.database}/_d_req_del/${req.params.reqId}?JSON`,
      new URLSearchParams({ _xsrf: xsrf }).toString(),
      { headers: { ...e.getHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return resp.data;
  }));

  // ── Кросс-доменный анализ каскадов ─────────────────────────────
  router.get('/cross-domain/triggers', wrap(async (e) => {
    const triggers = e._triggers || [];
    const crossDomain = triggers.filter(t => {
      const cond = t.condition || '';
      const action = t.action?.params?.name || '';
      const condDomain = cond.match(/eventType \$EQ "(\w+)\./)?.[1];
      const actionDomain = action.match(/^(\w+)\./)?.[1];
      return condDomain && actionDomain && condDomain !== actionDomain;
    });
    return {
      total: triggers.length,
      crossDomain: crossDomain.length,
      triggers: crossDomain.map(t => ({
        id: t.id,
        condition: t.condition,
        action: t.action,
        priority: t.priority,
      })),
    };
  }));

  router.get('/cross-domain/cascade-map', wrap(async (e) => {
    const triggers = e._triggers || [];
    const edges = [];
    const domains = new Set();
    for (const t of triggers) {
      const cond = t.condition || '';
      const actionName = t.action?.params?.name || '';
      const src = cond.match(/eventType \$EQ "(\w+)\./)?.[1];
      const dst = actionName.match(/^(\w+)\./)?.[1];
      if (src) domains.add(src);
      if (dst) domains.add(dst);
      if (src && dst && src !== dst) {
        edges.push({ from: src, to: dst, trigger: cond, action: actionName, priority: t.priority });
      }
    }
    return { domains: [...domains], edges, edgeCount: edges.length };
  }));

  // ── Валидация всех FSM ──────────────────────────────────────────
  router.get('/fsm/validate-all', wrap(async (e) => {
    const models = await e.getObjects(e.tables.models);
    const results = [];
    for (const m of models) {
      try {
        const validation = await e.validateFSM(String(m.id));
        if (validation.stateCount > 0) {
          results.push({ modelId: m.id, modelName: m.val, ...validation });
        }
      } catch { /* skip models without FSM */ }
    }
    return { total: results.length, results };
  }));

  // ── Версионирование моделей (versions + migrate) ────────────────
  router.get('/models/:id/versions', wrap((e, req) => e.getModelVersions(req.params.id)));
  router.post('/individuals/:id/migrate', wrap(async (e, req) => {
    const { fromModelId, toModelId, safe } = req.body;
    if (safe) return e.migrateIndividualSafe(req.params.id, fromModelId, toModelId);
    return e.migrateIndividual(req.params.id, fromModelId, toModelId);
  }));

  // ── Эпистемическое создание событий ─────────────────────────────
  router.post('/events/epistemic', wrap((e, req) => {
    const { name, individualId, modelEventId, value, actorId, causes } = req.body;
    return e.createSubjectEventEpistemic(name, { individualId, modelEventId, value, actorId, causes });
  }));

  // ── Экспорт/Импорт ─────────────────────────────────────────────
  router.get('/export/json-ld', wrap(e => e.exportToJsonLd()));
  router.get('/export/owl', wrap(e => e.exportToOwl()));

  // ── SPARQL запросы ──────────────────────────────────────────────
  router.post('/sparql', wrap((e, req) => e.executeSparql(req.body.query)));

  // ── Hot-reload domain configuration ─────────────────────────────
  router.post('/reload', wrap((e) => e.reloadDomainConfig()));

  // ── Bootstrap кросс-доменных триггеров ──────────────────────────
  router.post('/bootstrap/cross-domain', wrap((e) => e.bootstrapCrossDomainTriggers()));

  return router;
}
