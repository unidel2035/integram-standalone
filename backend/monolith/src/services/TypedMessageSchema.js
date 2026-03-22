/**
 * TypedMessageSchema — типизированные схемы сообщений для агентов
 *
 * Вдохновлено PydanticAI: строгая типизация на входе и выходе агента.
 * Проблема: в JS/Node.js нет встроенной валидации типов.
 * Баги типов в мультиагентных системах находятся когда уже поздно.
 *
 * Решение: декларативные схемы + валидация до передачи в агента.
 *
 * Почему не Zod/Joi:
 * - Нет внешних зависимостей
 * - Минимальный API, достаточный для AgentBus сообщений
 * - Легко расширить под конкретные агенты
 *
 * Пример из их стека:
 *   PydanticAI: @agent.tool def analyze(ctx, data: AnalyticsInput) → AnalyticsOutput
 *   Здесь:      schema.validate(data, AnalyticsInput) → { valid, errors, data }
 */

// ── Базовые типы ──────────────────────────────────────────────

const Types = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && !isNaN(v),
  boolean: (v) => typeof v === 'boolean',
  array: (v) => Array.isArray(v),
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  any: () => true,
};

// ── Schema ────────────────────────────────────────────────────

export class Schema {
  /**
   * @param {Object} fields — { fieldName: FieldDef }
   *
   * FieldDef:
   *   { type, required?, default?, min?, max?, enum?, items? }
   *
   *   type: 'string'|'number'|'boolean'|'array'|'object'|'any'
   *   required: boolean (default: true)
   *   default: any (если !required)
   *   min/max: для number
   *   enum: для string — допустимые значения
   *   items: Schema — для array (валидация каждого элемента)
   *   shape: Schema — для object (вложенная схема)
   */
  constructor(fields) {
    this.fields = fields;
  }

  /**
   * Валидировать объект.
   * @param {*} data
   * @returns {{ valid: boolean, errors: string[], data: Object }}
   */
  validate(data) {
    const errors = [];
    const result = {};

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Expected object'], data: {} };
    }

    for (const [field, def] of Object.entries(this.fields)) {
      const raw = data[field];
      const missing = raw === undefined || raw === null;

      // Required check
      if (missing) {
        if (def.required !== false) {
          errors.push(`${field}: required`);
        } else {
          result[field] = def.default ?? null;
        }
        continue;
      }

      // Type check
      const typeCheck = Types[def.type] || Types.any;
      if (!typeCheck(raw)) {
        errors.push(`${field}: expected ${def.type}, got ${Array.isArray(raw) ? 'array' : typeof raw}`);
        result[field] = raw;
        continue;
      }

      // Constraints
      if (def.type === 'number') {
        if (def.min !== undefined && raw < def.min) errors.push(`${field}: min ${def.min}`);
        if (def.max !== undefined && raw > def.max) errors.push(`${field}: max ${def.max}`);
      }

      if (def.type === 'string') {
        if (def.minLength !== undefined && raw.length < def.minLength) {
          errors.push(`${field}: minLength ${def.minLength}`);
        }
        if (def.maxLength !== undefined && raw.length > def.maxLength) {
          errors.push(`${field}: maxLength ${def.maxLength}`);
        }
        if (def.enum && !def.enum.includes(raw)) {
          errors.push(`${field}: must be one of [${def.enum.join(', ')}]`);
        }
        if (def.pattern && !new RegExp(def.pattern).test(raw)) {
          errors.push(`${field}: pattern mismatch`);
        }
      }

      if (def.type === 'array') {
        if (def.minItems !== undefined && raw.length < def.minItems) {
          errors.push(`${field}: minItems ${def.minItems}`);
        }
        if (def.items instanceof Schema) {
          raw.forEach((item, i) => {
            const sub = def.items.validate(item);
            sub.errors.forEach(e => errors.push(`${field}[${i}].${e}`));
          });
        }
      }

      if (def.type === 'object' && def.shape instanceof Schema) {
        const sub = def.shape.validate(raw);
        sub.errors.forEach(e => errors.push(`${field}.${e}`));
        result[field] = sub.data;
        continue;
      }

      result[field] = raw;
    }

    return { valid: errors.length === 0, errors, data: result };
  }

  /**
   * Валидировать или выбросить ошибку.
   * @param {*} data
   * @returns {Object} — проверенные данные
   */
  parse(data) {
    const { valid, errors, data: parsed } = this.validate(data);
    if (!valid) {
      throw new TypeError(`Schema validation failed:\n  ${errors.join('\n  ')}`);
    }
    return parsed;
  }

  /**
   * Создать функцию-обёртку, которая валидирует вход до вызова fn.
   * Аналог @agent.tool декоратора в PydanticAI.
   *
   * @param {Function} fn — async (validatedData, ...rest) → result
   * @returns {Function}
   */
  typed(fn) {
    const schema = this;
    return async function typedFn(data, ...rest) {
      const { valid, errors, data: parsed } = schema.validate(data);
      if (!valid) {
        return { error: `Invalid input: ${errors.join('; ')}`, validationErrors: errors };
      }
      return fn(parsed, ...rest);
    };
  }
}

// ── Встроенные схемы для AgentBus ─────────────────────────────

/**
 * Схема сообщения AgentBus.
 * Гарантирует что from/to/payload всегда на месте и правильного типа.
 */
export const AgentMessageSchema = new Schema({
  from:    { type: 'string', required: true, minLength: 1 },
  to:      { type: 'string', required: true, minLength: 1 },
  payload: { type: 'object', required: true },
  type:    { type: 'string', required: false, default: 'notification',
             enum: ['request', 'response', 'notification', 'broadcast'] },
  priority:{ type: 'string', required: false, default: 'normal',
             enum: ['low', 'normal', 'high', 'critical'] },
  correlationId: { type: 'string', required: false, default: null },
  ttl:     { type: 'number', required: false, default: 3600000, min: 0 },
});

/**
 * Схема запроса к AgentSandbox.
 */
export const SandboxQuerySchema = new Schema({
  sql:     { type: 'string', required: true, minLength: 1 },
  maxRows: { type: 'number', required: false, default: 1000, min: 1, max: 100000 },
  explain: { type: 'boolean', required: false, default: false },
});

/**
 * Схема аналитического запроса агента.
 * Типичный ввод в LLM-аналитику: вопрос + таблицы + фильтры.
 */
export const AnalyticsQuerySchema = new Schema({
  question: { type: 'string', required: true, minLength: 3 },
  tables:   { type: 'array', required: false, default: [] },
  filters:  { type: 'object', required: false, default: {} },
  limit:    { type: 'number', required: false, default: 100, min: 1, max: 10000 },
  format:   { type: 'string', required: false, default: 'rows',
              enum: ['rows', 'summary', 'chart'] },
});

/**
 * Схема результата шага CyclicAgent.
 */
export const AgentStepResultSchema = new Schema({
  ok:      { type: 'boolean', required: true },
  done:    { type: 'boolean', required: false, default: false },
  retry:   { type: 'boolean', required: false, default: false },
  reason:  { type: 'string', required: false, default: '' },
  data:    { type: 'any', required: false, default: null },
});

// ── Middleware для AgentBus ────────────────────────────────────

/**
 * Express middleware: валидировать входящие AgentBus сообщения.
 *
 * Использование:
 *   router.post('/send', validateAgentMessage, handler)
 */
export function validateAgentMessage(req, res, next) {
  const { valid, errors } = AgentMessageSchema.validate(req.body);
  if (!valid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid message schema',
      details: errors,
    });
  }
  next();
}

/**
 * Обёртка для обработчика AgentBus: валидировать payload по схеме.
 *
 * Использование:
 *   agentBus.on('my.topic', withSchema(MySchema, async (data) => { ... }))
 */
export function withSchema(schema, handler) {
  return async function (message) {
    const { valid, errors, data } = schema.validate(message.payload);
    if (!valid) {
      return {
        error: `Invalid payload: ${errors.join('; ')}`,
        validationErrors: errors,
      };
    }
    return handler({ ...message, payload: data });
  };
}

export default Schema;
