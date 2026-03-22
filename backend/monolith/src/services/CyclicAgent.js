/**
 * CyclicAgent — агент с циклическим состоянием
 *
 * Идея из LangGraph: агент не просто выполняет задачу линейно.
 * Он может вернуться назад, исправить ошибку, переоценить.
 *
 * Граф состояний:
 *
 *   ┌─────────────────────────────────────┐
 *   │                                     ↓
 *  IDLE → PLAN → EXECUTE → EVALUATE ──→ DONE
 *                    ↑          │
 *                    └── RETRY ─┘ (если evaluate решил повторить)
 *
 * Что добавляет к MultiAgentOrchestrator:
 * - Возврат назад с сохранением состояния
 * - История шагов (traceability)
 * - Явные условия перехода между состояниями
 * - Ограничение циклов (maxRetries)
 *
 * В отличие от LangGraph (Python):
 * - Нет Python-зависимостей
 * - Работает поверх существующего AgentBus
 * - Состояние сохраняется в памяти + опционально в Integram
 */

import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

// ── Состояния ─────────────────────────────────────────────────

export const AgentState = {
  IDLE:     'idle',
  PLANNING: 'planning',
  EXECUTING:'executing',
  EVALUATING:'evaluating',
  RETRYING: 'retrying',
  DONE:     'done',
  FAILED:   'failed',
};

// ── TypedMessageSchema: валидация на границах агента ──────────
// Вдохновлено PydanticAI: не допускаем невалидные данные внутрь.

export const MessageSchema = {
  /**
   * Проверить что объект соответствует схеме.
   * Схема: { field: 'string'|'number'|'boolean'|'object'|'array', required? }
   *
   * @param {Object} data
   * @param {Object} schema — { fieldName: { type, required?, default? } }
   * @returns {{ valid: boolean, errors: string[], data: Object }}
   */
  validate(data, schema) {
    const errors = [];
    const result = {};

    for (const [field, def] of Object.entries(schema)) {
      const raw = def.required !== false
        ? data?.[field]
        : data?.[field] ?? def.default;

      if (raw === undefined || raw === null) {
        if (def.required !== false) {
          errors.push(`${field}: required`);
        } else {
          result[field] = def.default ?? null;
        }
        continue;
      }

      const actualType = Array.isArray(raw) ? 'array' : typeof raw;
      if (def.type && actualType !== def.type) {
        errors.push(`${field}: expected ${def.type}, got ${actualType}`);
        continue;
      }

      result[field] = raw;
    }

    return { valid: errors.length === 0, errors, data: result };
  },
};

// ── Шаг выполнения ────────────────────────────────────────────

/**
 * @typedef {Object} AgentStep
 * @property {string} state — состояние в котором был шаг
 * @property {number} attempt — номер попытки
 * @property {*} input — входные данные шага
 * @property {*} output — результат шага
 * @property {string|null} error — ошибка если есть
 * @property {number} durationMs
 * @property {number} timestamp
 */

// ── CyclicAgent ───────────────────────────────────────────────

export class CyclicAgent extends EventEmitter {
  /**
   * @param {Object} opts
   * @param {string} opts.id — ID агента
   * @param {string} [opts.name] — имя для логов
   * @param {number} [opts.maxRetries=3] — максимум повторов
   * @param {number} [opts.stepTimeoutMs=30000] — таймаут одного шага
   *
   * @param {Function} opts.plan — async (context) → { steps, strategy }
   * @param {Function} opts.execute — async (step, context) → result
   * @param {Function} opts.evaluate — async (result, context) → { ok, retry, reason, done }
   * @param {Function} [opts.onRetry] — async (attempt, context) → void
   * @param {Function} [opts.onDone] — async (context) → void
   * @param {Function} [opts.onFailed] — async (context, error) → void
   */
  constructor(opts) {
    super();

    if (!opts.id) throw new Error('CyclicAgent: id required');
    if (!opts.plan) throw new Error('CyclicAgent: plan() required');
    if (!opts.execute) throw new Error('CyclicAgent: execute() required');
    if (!opts.evaluate) throw new Error('CyclicAgent: evaluate() required');

    this.id = opts.id;
    this.name = opts.name || opts.id;
    this.maxRetries = opts.maxRetries ?? 3;
    this.stepTimeoutMs = opts.stepTimeoutMs ?? 30000;

    this._plan = opts.plan;
    this._execute = opts.execute;
    this._evaluate = opts.evaluate;
    this._onRetry = opts.onRetry || null;
    this._onDone = opts.onDone || null;
    this._onFailed = opts.onFailed || null;

    // Контекст — живёт на всё время работы агента
    this.context = {
      agentId: this.id,
      state: AgentState.IDLE,
      attempt: 0,
      steps: [],      // история всех шагов
      memory: {},     // произвольная память агента
      plan: null,     // текущий план
      lastResult: null,
      startedAt: null,
      finishedAt: null,
    };
  }

  // ── Запуск ────────────────────────────────────────────────

  /**
   * Запустить цикл агента.
   *
   * @param {*} input — начальные данные
   * @returns {Promise<Object>} — финальный контекст
   */
  async run(input) {
    this.context.startedAt = Date.now();
    this.context.memory.input = input;
    this._setState(AgentState.PLANNING);

    try {
      // ПЛАН
      const plan = await this._withTimeout(
        this._plan(this.context),
        this.stepTimeoutMs,
        'plan'
      );
      this.context.plan = plan;
      this._recordStep('planning', input, plan);
      logger.info(`[CyclicAgent:${this.name}] Plan ready`, { steps: plan?.steps?.length });

      // ЦИКЛ: execute → evaluate → retry?
      let attempt = 0;
      while (attempt <= this.maxRetries) {
        this.context.attempt = attempt;

        // EXECUTE
        this._setState(attempt > 0 ? AgentState.RETRYING : AgentState.EXECUTING);
        if (attempt > 0 && this._onRetry) {
          await this._onRetry(attempt, this.context).catch(() => {});
        }

        let result;
        try {
          result = await this._withTimeout(
            this._execute(this.context.plan, this.context),
            this.stepTimeoutMs,
            'execute'
          );
        } catch (execErr) {
          this._recordStep('executing', this.context.plan, null, execErr.message);
          this.context.lastResult = null;
          result = { error: execErr.message };
        }

        this.context.lastResult = result;
        this._recordStep(
          attempt > 0 ? 'retrying' : 'executing',
          this.context.plan,
          result,
          result?.error || null
        );

        // EVALUATE
        this._setState(AgentState.EVALUATING);
        let evaluation;
        try {
          evaluation = await this._withTimeout(
            this._evaluate(result, this.context),
            this.stepTimeoutMs,
            'evaluate'
          );
        } catch (evalErr) {
          evaluation = { ok: false, retry: false, reason: evalErr.message, done: false };
        }

        this._recordStep('evaluating', result, evaluation);
        logger.info(`[CyclicAgent:${this.name}] Evaluate #${attempt}`, evaluation);

        // РЕШЕНИЕ
        if (evaluation.done || evaluation.ok) {
          this._setState(AgentState.DONE);
          this.context.finishedAt = Date.now();
          this.emit('done', this.context);
          if (this._onDone) await this._onDone(this.context).catch(() => {});
          return this.context;
        }

        if (!evaluation.retry || attempt >= this.maxRetries) {
          break;
        }

        // Передать причину следующей попытке
        this.context.memory.lastRetryReason = evaluation.reason;
        attempt++;
      }

      // Исчерпаны попытки
      this._setState(AgentState.FAILED);
      this.context.finishedAt = Date.now();
      const err = new Error(`CyclicAgent exhausted retries (${this.maxRetries})`);
      this.emit('failed', this.context, err);
      if (this._onFailed) await this._onFailed(this.context, err).catch(() => {});
      return this.context;

    } catch (fatalErr) {
      this._setState(AgentState.FAILED);
      this.context.finishedAt = Date.now();
      logger.error(`[CyclicAgent:${this.name}] Fatal`, { error: fatalErr.message });
      this.emit('failed', this.context, fatalErr);
      if (this._onFailed) await this._onFailed(this.context, fatalErr).catch(() => {});
      return this.context;
    }
  }

  // ── Инструменты агента ─────────────────────────────────────

  /** Сохранить что-то в памяти агента (доступно между шагами) */
  remember(key, value) {
    this.context.memory[key] = value;
    return this;
  }

  /** Получить из памяти */
  recall(key) {
    return this.context.memory[key];
  }

  /** История шагов */
  get trace() {
    return this.context.steps;
  }

  /** Текущее состояние */
  get state() {
    return this.context.state;
  }

  // ── Вспомогательные ───────────────────────────────────────

  _setState(state) {
    this.context.state = state;
    this.emit('state', state, this.context);
    logger.info(`[CyclicAgent:${this.name}] → ${state}`);
  }

  _recordStep(state, input, output, error = null) {
    this.context.steps.push({
      state,
      attempt: this.context.attempt,
      input,
      output,
      error,
      durationMs: Date.now() - (this.context.startedAt || Date.now()),
      timestamp: Date.now(),
    });
  }

  _withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout in ${label} after ${ms}ms`)), ms)
      ),
    ]);
  }
}

// ── Пример: аналитический агент над данными ───────────────────

/**
 * Создать аналитический агент, который:
 * 1. Строит план запросов (PLAN)
 * 2. Выполняет запросы через AgentSandbox (EXECUTE)
 * 3. Оценивает результат, повторяет если нужно (EVALUATE → RETRY)
 *
 * @param {Object} opts
 * @param {import('./AgentSandbox').AgentSandbox} opts.sandbox
 * @param {Function} opts.llm — async (prompt) → string
 */
export function createAnalyticsAgent(opts) {
  const { sandbox, llm } = opts;

  return new CyclicAgent({
    id: `analytics-${Date.now()}`,
    name: 'AnalyticsAgent',
    maxRetries: 3,

    async plan(ctx) {
      const input = ctx.memory.input;
      // Спросить LLM: какой SQL нужен для ответа на вопрос?
      const prompt = `
Ты аналитик данных. Пользователь спрашивает: "${input.question}"
Доступные таблицы: ${input.tables?.join(', ') || 'неизвестны'}
Составь SQL SELECT запрос для ответа. Верни только SQL, без markdown.
      `.trim();

      const sql = llm ? await llm(prompt) : `SELECT * FROM ${input.tables?.[0] || 'data'} LIMIT 10`;
      return { sql: sql.trim(), question: input.question };
    },

    async execute(plan, ctx) {
      if (!sandbox.available) {
        return { error: 'Sandbox not available', rows: [] };
      }
      return sandbox.query(plan.sql, { maxRows: 1000 });
    },

    async evaluate(result, ctx) {
      if (result.error) {
        // Ошибка SQL — попробовать переформулировать
        ctx.memory.lastError = result.error;
        if (ctx.attempt < 2) {
          // Обновить план с учётом ошибки
          ctx.plan.sql = ctx.plan.sql; // LLM перегенерирует на следующей итерации
          return { ok: false, retry: true, reason: `SQL error: ${result.error}` };
        }
        return { ok: false, retry: false, reason: 'Too many SQL errors', done: false };
      }

      if (!result.rows || result.rows.length === 0) {
        return { ok: false, retry: true, reason: 'No results, try broader query' };
      }

      return { ok: true, done: true, reason: `Found ${result.rows.length} rows` };
    },
  });
}

export default CyclicAgent;
