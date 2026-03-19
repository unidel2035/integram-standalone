/**
 * Тесты для новых сервисов памяти Integram
 * Запуск: node --test services/core-data-service/src/services/__tests__/memory-services.test.js
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';

// Mock databaseService
function createMockDb(rows = []) {
  return {
    execSql: mock.fn(async () => ({ rows, insertId: Date.now() })),
  };
}

// Mock vectorService
function createMockVector(searchResults = []) {
  return {
    search: mock.fn(async () => ({ results: searchResults, total: searchResults.length })),
    addVector: mock.fn(async (db, parentId) => ({ id: Date.now(), parentId })),
    getStats: () => ({ vectorCount: 10, dimensions: 384, initialized: true }),
    initialize: mock.fn(async () => {}),
  };
}

// Mock linkService
function createMockLinks() {
  return {
    createLink: mock.fn(async (db, s, t, k) => ({ id: Date.now(), sourceId: s, targetId: t, kind: k })),
    getLinksFrom: mock.fn(async () => []),
    getLinksTo: mock.fn(async () => []),
    traverse: mock.fn(async () => ({ nodes: [], edges: [], depth: 2 })),
    getStats: mock.fn(async () => ({ total: 5, byKind: { references: 3, similar_to: 2 } })),
  };
}

function createMockTemporal() {
  return {
    getHistory: mock.fn(async () => ({ objectId: 1, versions: [], total: 0 })),
    recordVersion: mock.fn(async () => {}),
    getStats: mock.fn(async () => ({ totalVersions: 10 })),
  };
}

// ══════════════════════════════════════════════════════════════
// VectorService
// ══════════════════════════════════════════════════════════════

describe('VectorService', async () => {
  const { VectorService } = await import('../VectorService.js');

  it('should initialize with empty index', async () => {
    const db = createMockDb([]);
    const vs = new VectorService(db);
    await vs.initialize('test');
    const stats = vs.getStats('test');
    assert.strictEqual(stats.initialized, true);
    assert.strictEqual(stats.vectorCount, 0);
  });

  it('should add vector and search', async () => {
    const db = createMockDb([]);
    const vs = new VectorService(db);
    await vs.initialize('test');
    await vs.addVector('test', 100, [0.1, 0.2, 0.3], { model: 'test' });
    assert.strictEqual(vs.getStats('test').vectorCount, 1);

    const results = await vs.search('test', [0.1, 0.2, 0.3]);
    assert.strictEqual(results.results.length, 1);
    assert.ok(results.results[0].score > 0.99);
    assert.strictEqual(results.engine, 'vector-cosine');
  });

  it('cosine should be 0 for orthogonal vectors', async () => {
    const db = createMockDb([]);
    const vs = new VectorService(db);
    await vs.initialize('ortho');
    await vs.addVector('ortho', 1, [1, 0, 0]);
    const r = await vs.search('ortho', [0, 1, 0]);
    assert.ok(Math.abs(r.results[0].score) < 0.001);
  });
});

// ══════════════════════════════════════════════════════════════
// LinkService
// ══════════════════════════════════════════════════════════════

describe('LinkService', async () => {
  const { LinkService } = await import('../LinkService.js');

  it('should create link', async () => {
    const db = createMockDb([]);
    const ls = new LinkService(db);
    const link = await ls.createLink('test', 1, 2, 'references');
    assert.ok(link.id);
    assert.strictEqual(link.sourceId, 1);
    assert.strictEqual(link.targetId, 2);
  });

  it('should reject invalid kind', async () => {
    const db = createMockDb([]);
    const ls = new LinkService(db);
    await assert.rejects(() => ls.createLink('test', 1, 2, 'invalid_kind'));
  });
});

// ══════════════════════════════════════════════════════════════
// TemporalService
// ══════════════════════════════════════════════════════════════

describe('TemporalService', async () => {
  const { TemporalService } = await import('../TemporalService.js');

  it('should record version', async () => {
    const db = createMockDb([]);
    const ts = new TemporalService(db);
    await ts.recordVersion('test', 100, 'old value', 'agent-A');
    assert.strictEqual(db.execSql.mock.calls.length, 1);
  });

  it('should return empty history', async () => {
    const db = createMockDb([]);
    const ts = new TemporalService(db);
    const h = await ts.getHistory('test', 999);
    assert.strictEqual(h.versions.length, 0);
  });
});

// ══════════════════════════════════════════════════════════════
// UnifiedMemoryService
// ══════════════════════════════════════════════════════════════

describe('UnifiedMemoryService', async () => {
  const { UnifiedMemoryService } = await import('../UnifiedMemoryService.js');

  it('should save and return id', async () => {
    const db = createMockDb([]);
    const ums = new UnifiedMemoryService({
      vectorService: createMockVector(),
      linkService: createMockLinks(),
      temporalService: createMockTemporal(),
      searchService: { semanticSearch: mock.fn(async () => ({ results: [] })) },
      databaseService: db,
      embeddingService: null,
    });
    const result = await ums.save('my', 100, 'test value');
    assert.ok(result.id);
    assert.strictEqual(result.value, 'test value');
  });

  it('should create links when linkTo provided', async () => {
    const links = createMockLinks();
    const db = createMockDb([]);
    const ums = new UnifiedMemoryService({
      vectorService: createMockVector(),
      linkService: links,
      temporalService: createMockTemporal(),
      searchService: { semanticSearch: mock.fn(async () => ({ results: [] })) },
      databaseService: db,
    });
    await ums.save('my', 100, 'test', {}, { linkTo: [1, 2, 3] });
    assert.strictEqual(links.createLink.mock.calls.length, 3);
  });
});

// ══════════════════════════════════════════════════════════════
// AutoEmbeddingHook
// ══════════════════════════════════════════════════════════════

describe('AutoEmbeddingHook', async () => {
  const { AutoEmbeddingHook } = await import('../AutoEmbeddingHook.js');

  it('should queue on created', () => {
    const hook = new AutoEmbeddingHook();
    hook.pool = true;
    hook.embeddingService = { embed: mock.fn(async () => [0.1, 0.2]) };
    hook.onCreated('test', 1, 100, 'hello world test');
    assert.strictEqual(hook.getStats().queueLength, 1);
  });

  it('should skip system types', () => {
    const hook = new AutoEmbeddingHook();
    hook.pool = true;
    hook.embeddingService = {};
    hook.onCreated('test', 1, 3, 'short type');
    assert.strictEqual(hook.getStats().queueLength, 0);
  });

  it('should skip short values', () => {
    const hook = new AutoEmbeddingHook();
    hook.pool = true;
    hook.embeddingService = {};
    hook.onCreated('test', 1, 100, 'ab');
    assert.strictEqual(hook.getStats().queueLength, 0);
  });
});

// ══════════════════════════════════════════════════════════════
// RealtimeSubscriptions
// ══════════════════════════════════════════════════════════════

describe('RealtimeSubscriptions', async () => {
  const { RealtimeSubscriptions } = await import('../RealtimeSubscriptions.js');

  it('should subscribe and notify', () => {
    const rs = new RealtimeSubscriptions();
    let received = null;
    rs.subscribe('agent-1', { database: 'test' }, (event) => { received = event; });
    rs.notify({ database: 'test', objectId: 1, action: 'create', value: 'hello' });
    assert.ok(received);
    assert.strictEqual(received.objectId, 1);
  });

  it('should filter by types', () => {
    const rs = new RealtimeSubscriptions();
    let received = null;
    rs.subscribe('agent-1', { database: 'test', types: [100] }, (event) => { received = event; });
    rs.notify({ database: 'test', objectId: 1, typeId: 200, action: 'create' });
    assert.strictEqual(received, null);
    rs.notify({ database: 'test', objectId: 2, typeId: 100, action: 'create' });
    assert.ok(received);
    assert.strictEqual(received.objectId, 2);
  });

  it('should unsubscribe', () => {
    const rs = new RealtimeSubscriptions();
    let count = 0;
    const subId = rs.subscribe('agent-1', {}, () => count++);
    rs.notify({ database: 'test', objectId: 1, action: 'create' });
    assert.strictEqual(count, 1);
    rs.unsubscribe(subId);
    rs.notify({ database: 'test', objectId: 2, action: 'create' });
    assert.strictEqual(count, 1);
  });
});

// ══════════════════════════════════════════════════════════════
// NarrativeMemory
// ══════════════════════════════════════════════════════════════

describe('NarrativeMemory', async () => {
  const { NarrativeMemory } = await import('../NarrativeMemory.js');

  it('should return empty narrative', async () => {
    const nm = new NarrativeMemory({
      databaseService: createMockDb([]),
      vectorService: createMockVector(),
      linkService: createMockLinks(),
      temporalService: createMockTemporal(),
    });
    const result = await nm.narrate('test', { style: 'summary' });
    assert.ok(result.narrative.includes('не обнаружено'));
  });
});

console.log('\n✅ All memory service tests defined\n');
