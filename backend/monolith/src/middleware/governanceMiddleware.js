/**
 * governanceMiddleware.js — Серверный контроль уровней автономии агентов
 *
 * Применяется к MCP-маршрутам для обеспечения governance на уровне сервера.
 * Гарантирует, что frontend не может обойти политику автономии.
 *
 * Уровни автономии:
 *   augmentation (1) — человек подтверждает каждое действие
 *   automation   (2) — автоматическое выполнение по правилам
 *   autonomy     (3) — полная автономия агента
 */

import logger from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Константы
// ---------------------------------------------------------------------------

/** Числовые веса уровней автономии */
export const AUTONOMY_LEVELS = {
  augmentation: 1,
  automation: 2,
  autonomy: 3,
};

/**
 * Классификация действий по шаблону имени инструмента.
 * Ключ — тип действия, значение — массив префиксов toolName.
 * Порядок проверки: admin → delete → execute → write → read_only (fallback).
 */
const ACTION_CLASSIFICATION = {
  admin:     ['drop_', 'destroy_', 'migrate_'],
  delete:    ['delete_', 'del_'],
  execute:   ['execute_', 'run_'],
  write:     ['create_', 'save_', 'set_', 'update_', 'add_', 'move_', 'rename_', 'clone_', 'copy_', 'toggle_', 'modify_', 'bulk_'],
  read_only: ['get_', 'search_', 'list_', 'read_', 'open_', 'query_', 'find_', 'export_'],
};

/**
 * Минимальный уровень автономии, необходимый для каждого типа действия.
 * `Infinity` означает, что всегда требуется явное одобрение человека.
 */
const REQUIRED_LEVEL = {
  read_only: AUTONOMY_LEVELS.augmentation, // 1 — разрешено всегда
  write:     AUTONOMY_LEVELS.automation,   // 2
  execute:   AUTONOMY_LEVELS.automation,   // 2
  delete:    AUTONOMY_LEVELS.autonomy,     // 3
  admin:     Infinity,                     // всегда требует human approval
};

// ---------------------------------------------------------------------------
// Статистика (in-memory)
// ---------------------------------------------------------------------------

const stats = {
  allowed: 0,
  denied: 0,
  byActionType: { read_only: 0, write: 0, delete: 0, execute: 0, admin: 0 },
  byLevel: { augmentation: 0, automation: 0, autonomy: 0, unknown: 0 },
};

/**
 * Возвращает текущую статистику governance-решений.
 * @returns {{ allowed: number, denied: number, byActionType: Object, byLevel: Object }}
 */
export function getGovernanceStats() {
  return {
    allowed: stats.allowed,
    denied: stats.denied,
    byActionType: { ...stats.byActionType },
    byLevel: { ...stats.byLevel },
  };
}

// ---------------------------------------------------------------------------
// Классификация и проверка
// ---------------------------------------------------------------------------

/**
 * Определяет тип действия по имени инструмента.
 * Проверяет префиксы в порядке приоритета: admin → delete → execute → write → read_only.
 * Если ни один шаблон не подошёл — возвращает 'write' (безопасный дефолт).
 *
 * @param {string} toolName — имя MCP-инструмента (напр. 'integram_create_object')
 * @returns {'read_only'|'write'|'delete'|'execute'|'admin'}
 */
export function classifyAction(toolName) {
  if (!toolName || typeof toolName !== 'string') {
    return 'write'; // безопасный дефолт при отсутствии имени
  }

  const normalized = toolName.toLowerCase();

  // Убираем общие префиксы серверов (integram_, kag_, yadisk_ и т.д.)
  const parts = normalized.split('_');
  // Ищем совпадение и по полному имени, и без первого сегмента
  const candidates = [normalized];
  if (parts.length > 1) {
    candidates.push(parts.slice(1).join('_'));
  }

  // Порядок проверки важен: от самого строгого к самому мягкому
  const checkOrder = ['admin', 'delete', 'execute', 'write', 'read_only'];

  for (const actionType of checkOrder) {
    const prefixes = ACTION_CLASSIFICATION[actionType];
    for (const candidate of candidates) {
      for (const prefix of prefixes) {
        if (candidate.startsWith(prefix)) {
          return actionType;
        }
      }
    }
  }

  return 'write'; // неизвестные действия считаем write — требуют automation+
}

/**
 * Проверяет, достаточен ли заданный уровень автономии для типа действия.
 *
 * @param {'read_only'|'write'|'delete'|'execute'|'admin'} actionType
 * @param {'augmentation'|'automation'|'autonomy'} autonomyLevel
 * @returns {boolean} true — действие разрешено
 */
export function checkPermission(actionType, autonomyLevel) {
  const required = REQUIRED_LEVEL[actionType];
  if (required === undefined) return false;
  if (required === Infinity) return false; // admin — всегда только человек

  const provided = AUTONOMY_LEVELS[autonomyLevel];
  if (provided === undefined) return false;

  return provided >= required;
}

// ---------------------------------------------------------------------------
// Фабрика middleware
// ---------------------------------------------------------------------------

/**
 * Создаёт Express-middleware для governance-контроля MCP-вызовов.
 *
 * @param {Object} [options]
 * @param {'augmentation'|'automation'|'autonomy'} [options.defaultLevel='automation']
 *   Уровень по умолчанию, если заголовок/тело не содержат явного указания.
 * @param {boolean} [options.strictMode=false]
 *   В strict-режиме запрос без явного уровня автономии отклоняется (403).
 * @param {string[]} [options.allowList=[]]
 *   Имена инструментов, которые всегда разрешены (обходят governance).
 * @param {string[]} [options.denyList=[]]
 *   Имена инструментов, которые всегда запрещены.
 * @returns {Function} Express middleware (req, res, next)
 */
export function governanceMiddleware(options = {}) {
  const {
    defaultLevel = 'automation',
    strictMode = false,
    allowList = [],
    denyList = [],
  } = options;

  // Нормализуем списки один раз
  const allowSet = new Set(allowList.map((t) => t.toLowerCase()));
  const denySet = new Set(denyList.map((t) => t.toLowerCase()));

  return function governance(req, res, next) {
    const toolName = req.body?.toolName || req.body?.tool || '';
    const normalizedTool = toolName.toLowerCase();

    // Определяем уровень автономии из заголовка или тела запроса
    const headerLevel = req.headers['x-agent-autonomy-level'];
    const bodyLevel = req.body?.autonomyLevel;
    const rawLevel = headerLevel || bodyLevel;

    // --- strict mode: нет явного уровня → отказ ---
    if (strictMode && !rawLevel) {
      const decision = {
        toolName,
        actionType: null,
        level: null,
        allowed: false,
        reason: 'strict_mode_no_level',
        timestamp: new Date().toISOString(),
      };
      req.governanceDecision = decision;
      stats.denied++;

      logger.warn({ decision }, 'Governance: отклонено — strict mode, уровень автономии не указан');
      return res.status(403).json({
        error: 'Governance: уровень автономии обязателен (x-agent-autonomy-level)',
        decision,
      });
    }

    const autonomyLevel = rawLevel || defaultLevel;
    const actionType = classifyAction(toolName);

    // Обновляем статистику по уровню
    if (AUTONOMY_LEVELS[autonomyLevel] !== undefined) {
      stats.byLevel[autonomyLevel]++;
    } else {
      stats.byLevel.unknown++;
    }

    // --- deny list ---
    if (denySet.has(normalizedTool)) {
      const decision = {
        toolName,
        actionType,
        level: autonomyLevel,
        allowed: false,
        reason: 'deny_list',
        timestamp: new Date().toISOString(),
      };
      req.governanceDecision = decision;
      stats.denied++;
      stats.byActionType[actionType] = (stats.byActionType[actionType] || 0) + 1;

      logger.warn({ decision }, 'Governance: инструмент в deny-списке');
      return res.status(403).json({
        error: `Governance: инструмент "${toolName}" запрещён политикой`,
        decision,
      });
    }

    // --- allow list (обходит governance) ---
    if (allowSet.has(normalizedTool)) {
      const decision = {
        toolName,
        actionType,
        level: autonomyLevel,
        allowed: true,
        reason: 'allow_list',
        timestamp: new Date().toISOString(),
      };
      req.governanceDecision = decision;
      stats.allowed++;
      stats.byActionType[actionType] = (stats.byActionType[actionType] || 0) + 1;

      logger.info({ decision }, 'Governance: разрешено (allow-list)');
      return next();
    }

    // --- основная проверка ---
    const allowed = checkPermission(actionType, autonomyLevel);
    const decision = {
      toolName,
      actionType,
      level: autonomyLevel,
      allowed,
      reason: allowed ? 'level_sufficient' : 'insufficient_level',
      requiredLevel: Object.entries(AUTONOMY_LEVELS).find(
        ([, v]) => v === REQUIRED_LEVEL[actionType]
      )?.[0] || 'human_approval',
      timestamp: new Date().toISOString(),
    };

    req.governanceDecision = decision;
    stats.byActionType[actionType] = (stats.byActionType[actionType] || 0) + 1;

    if (allowed) {
      stats.allowed++;
      logger.info({ decision }, `Governance: разрешено [${actionType}] для уровня "${autonomyLevel}"`);
      return next();
    }

    // Отклонено
    stats.denied++;
    logger.warn(
      { decision },
      `Governance: отклонено [${actionType}] — требуется "${decision.requiredLevel}", получен "${autonomyLevel}"`
    );

    return res.status(403).json({
      error: `Governance: действие "${actionType}" требует уровня "${decision.requiredLevel}", ` +
             `текущий уровень: "${autonomyLevel}"`,
      decision,
    });
  };
}
