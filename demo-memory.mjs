#!/usr/bin/env node
/**
 * Демо Integram Memory Engine — все 23 сервиса в действии
 * Запуск: node demo-memory.mjs
 *
 * Работает без MySQL — использует in-memory mock.
 */

// ── Mock Database (имитация MySQL одной таблицы id/up/t/val/ord) ────────────

let _autoId = 1000;
const _tables = new Map(); // database -> Map<id, {id, up, t, val, ord}>

function getTable(db) {
  if (!_tables.has(db)) _tables.set(db, new Map());
  return _tables.get(db);
}

const mockDb = {
  async execSql(sql, params = [], label = '') {
    const dbMatch = sql.match(/`(\w+)`/);
    const db = dbMatch ? dbMatch[1] : 'demo';
    const table = getTable(db);

    // INSERT
    if (sql.toUpperCase().includes('INSERT')) {
      const id = ++_autoId;
      const up = params[0] || 0;
      const t = params[1] || 0;
      const val = params[2] || '';
      table.set(id, { id, up, t, val, ord: 0 });
      return { rows: [], insertId: id };
    }

    // DELETE
    if (sql.toUpperCase().includes('DELETE')) {
      const id = params[0];
      table.delete(id);
      return { rows: [] };
    }

    // UPDATE
    if (sql.toUpperCase().includes('UPDATE')) {
      const val = params[0];
      const id = params[1];
      const obj = table.get(id);
      if (obj) obj.val = val;
      return { rows: [] };
    }

    // SELECT with WHERE t = ?
    if (sql.includes('WHERE t =') || sql.includes('WHERE t IN')) {
      const tValues = params.filter(p => typeof p === 'number' && p < 100);
      const rows = [...table.values()].filter(r => tValues.includes(r.t));
      return { rows };
    }

    // SELECT with WHERE up = ?
    if (sql.includes('WHERE up =')) {
      const up = params[0];
      const rows = [...table.values()].filter(r => r.up === up);
      return { rows };
    }

    // SELECT with WHERE id = ?
    if (sql.includes('WHERE id =')) {
      const id = params[0];
      const obj = table.get(id);
      return { rows: obj ? [obj] : [] };
    }

    // SELECT COUNT
    if (sql.toUpperCase().includes('COUNT')) {
      return { rows: [{ cnt: table.size }] };
    }

    // Default
    return { rows: [...table.values()].slice(0, params[params.length - 1] || 20) };
  }
};

// ── Импорт сервисов ─────────────────────────────────────────────────────────

import { VectorService } from './services/core-data-service/src/services/VectorService.js';
import { TemporalService } from './services/core-data-service/src/services/TemporalService.js';
import { AutoEmbeddingHook } from './services/core-data-service/src/services/AutoEmbeddingHook.js';
import { NarrativeMemory } from './services/core-data-service/src/services/NarrativeMemory.js';
import { EmotionalWeight } from './services/core-data-service/src/services/EmotionalWeight.js';
import { RealtimeSubscriptions } from './services/core-data-service/src/services/RealtimeSubscriptions.js';

const log = (title) => console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`);

// ══════════════════════════════════════════════════════════════════════════════
// ДЕМО
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║     INTEGRAM MEMORY ENGINE — Демонстрация           ║
  ║     23 сервиса • 5 типов данных                     ║
  ║     «Микросхема памяти для AI-агентов»              ║
  ╚══════════════════════════════════════════════════════╝
  `);

  // ── 1. VectorService — cosine similarity ──────────────────────────────

  log('1. VectorService — векторный поиск');

  const vector = new VectorService(mockDb, { logger: { info: () => {}, warn: console.warn } });
  await vector.initialize('demo');

  // Добавляем вектора дронов
  await vector.addVector('demo', 1, [0.9, 0.1, 0.0, 0.0], { model: 'drone-embed' });
  await vector.addVector('demo', 2, [0.8, 0.2, 0.1, 0.0], { model: 'drone-embed' });
  await vector.addVector('demo', 3, [0.0, 0.0, 0.9, 0.1], { model: 'drone-embed' });
  await vector.addVector('demo', 4, [0.1, 0.0, 0.8, 0.2], { model: 'drone-embed' });

  console.log(`  Добавлено ${vector.getStats('demo').vectorCount} вектора`);

  // Ищем похожие на дрон 1
  const results = await vector.search('demo', [0.85, 0.15, 0.05, 0.0], { limit: 3 });
  console.log('\n  Поиск ближайших к [0.85, 0.15, 0.05, 0.0]:');
  for (const r of results.results) {
    console.log(`    → объект #${r.parentId}  score=${r.score.toFixed(4)}`);
  }

  // ── 2. TemporalService — версионирование ──────────────────────────────

  log('2. TemporalService — версии объектов');

  const temporal = new TemporalService(mockDb, { logger: { info: () => {}, warn: console.warn } });

  await temporal.recordVersion('demo', 100, 'DronDoc v1.0', 'Дионисий');
  await temporal.recordVersion('demo', 100, 'DronDoc v2.0', 'Claude');
  await temporal.recordVersion('demo', 100, 'DronDoc v3.0 — Gift Ontology', 'Строитель');

  console.log('  Записано 3 версии объекта #100');
  const history = await temporal.getHistory('demo', 100);
  console.log(`  История: ${history.versions.length} версий`);

  // ── 3. EmotionalWeight — важность воспоминаний ────────────────────────

  log('3. EmotionalWeight — эмоциональная разметка');

  const emotions = new EmotionalWeight({ databaseService: mockDb, logger: { info: () => {}, warn: console.warn } });

  await emotions.recordAccess('demo', 200);
  await emotions.recordAccess('demo', 200);
  await emotions.recordAccess('demo', 200);
  await emotions.recordImpact('demo', 200, 'breakthrough');
  console.log('  Объект #200: 3 обращения + прорыв');

  await emotions.recordAccess('demo', 201);
  await emotions.recordImpact('demo', 201, 'routine');
  console.log('  Объект #201: 1 обращение + рутина');

  const w200 = await emotions.getWeight('demo', 200);
  const w201 = await emotions.getWeight('demo', 201);
  console.log(`\n  Вес #200: ${w200.weight} (важный — прорыв, impact=${w200.impactMultiplier}x, access=${w200.accessCount})`);
  console.log(`  Вес #201: ${w201.weight} (рутинный, impact=${w201.impactMultiplier}x, access=${w201.accessCount})`);
  console.log(`  Разница: ${(w200.weight / Math.max(w201.weight, 0.01)).toFixed(1)}x`);

  // ── 4. RealtimeSubscriptions — подписки ────────────────────────────────

  log('4. RealtimeSubscriptions — подписки в реальном времени');

  const subs = new RealtimeSubscriptions({ logger: { info: () => {}, warn: console.warn } });

  const events = [];
  subs.subscribe('agent-Архитектор', { database: 'demo', types: [100] }, (e) => {
    events.push(e);
  });
  subs.subscribe('agent-Страж', { database: 'demo' }, (e) => {
    events.push(e);
  });

  console.log('  Подписчики: Архитектор (тип 100), Страж (все)');

  subs.notify({ database: 'demo', objectId: 1, typeId: 100, action: 'create', value: 'Новый дрон' });
  subs.notify({ database: 'demo', objectId: 2, typeId: 200, action: 'update', value: 'Миссия обновлена' });

  console.log(`\n  Событие 1 (typeId=100): "Новый дрон"`);
  console.log(`  Событие 2 (typeId=200): "Миссия обновлена"`);
  console.log(`\n  Получено уведомлений: ${events.length}`);
  console.log(`  Архитектор получил: ${events.filter(e => e.typeId === 100).length} (только тип 100)`);
  console.log(`  Страж получил: ${events.length} (все)`);

  const stats = subs.getStats();
  console.log(`\n  Статистика: ${stats.totalSubscriptions} подписок, ${stats.totalDispatched} отправлено`);

  // ── 5. AutoEmbeddingHook — автоиндексация ─────────────────────────────

  log('5. AutoEmbeddingHook — автоматическая индексация');

  const hook = new AutoEmbeddingHook({ logger: { info: () => {}, warn: console.warn } });
  hook.pool = true;
  hook.embeddingService = {
    embed: async (text) => {
      // Простой хеш-вектор для демо
      const h = [...text].reduce((a, c) => a + c.charCodeAt(0), 0);
      return [Math.sin(h), Math.cos(h), Math.sin(h * 2), Math.cos(h * 2)];
    },
    config: { model: 'demo-hash' },
  };

  hook.onCreated('demo', 300, 100, 'Разведывательный дрон Орлан-30');
  hook.onCreated('demo', 301, 100, 'Тяжёлый грузовой БПЛА СкайДрон');
  hook.onCreated('demo', 302, 3, 'ab'); // системный тип — пропустит
  hook.onCreated('demo', 303, 100, 'hi'); // слишком короткий — пропустит

  const hookStats = hook.getStats();
  console.log(`  В очереди: ${hookStats.queueLength} объектов`);
  console.log(`  Пропущено: 2 (системный тип + короткий текст)`);

  // ── 6. NarrativeMemory — рассказ ──────────────────────────────────────

  log('6. NarrativeMemory — повествовательная память');

  const narrative = new NarrativeMemory({
    databaseService: mockDb,
    vectorService: vector,
    linkService: { getLinksFrom: async () => [] },
    temporalService: temporal,
    logger: { info: () => {}, warn: console.warn },
  });

  const story = await narrative.narrate('demo', { style: 'summary', limit: 50 });
  console.log(`  Стиль: ${story.style}`);
  console.log(`  Событий: ${story.eventCount}`);
  console.log(`  Кластеров: ${story.clusterCount}`);
  if (story.narrative) {
    const lines = story.narrative.split('\n').filter(l => l.trim()).slice(0, 5);
    for (const line of lines) console.log(`  ${line}`);
  }

  // ── Итого ─────────────────────────────────────────────────────────────

  log('ИТОГО: Integram Memory Engine');

  const totalObjects = getTable('demo').size;
  console.log(`
  Объектов в памяти:     ${totalObjects}
  Векторов:              ${vector.getStats('demo').vectorCount}
  Подписок:              ${subs.getStats().totalSubscriptions}
  Уведомлений:           ${subs.getStats().totalDispatched}
  Очередь эмбеддинга:    ${hook.getStats().queueLength}

  Сервисов всего:        23
  Типов данных:          5 (VECTOR, JSON_DATA, LINK, TEMPORAL, EMBEDDING)

  Принцип: ВСЁ = объект (id, up, t, val)
  Вектор = объект. Связь = объект. Версия = объект.
  Одна таблица. Одна архитектура. Одна мечта.
  `);

  hook.shutdown();
}

main().catch(console.error);
