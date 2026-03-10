/**
 * Cross-Entity Automation — события запускают действия автоматически
 * Issue #184
 *
 * Called by eventStore.add() after persisting an event.
 * Fire-and-forget — errors are logged, not thrown.
 */

import { nextCrossEntityEvents, ENTITY_TYPES } from '@/services/crossEntityReactor.js'
import { getEventDef } from '@/config/eventRegistry.js'

// ─── Правила автоматизации ────────────────────────────────────────────────────

/**
 * Набор правил: linkId → действие при срабатывании cross-entity связи.
 *
 * Каждое правило:
 *   linkId    — совпадает с id из CROSS_ENTITY_LINKS
 *   action    — 'notify' | 'task' | 'suggest'
 *   message   — функция (triggerEvent, link) → string
 *   severity  — 'info' | 'success' | 'warning'
 */
export const AUTOMATION_RULES = [
  {
    linkId:   'lead→session',
    action:   'notify',
    message:  (_triggerEvent, _link) =>
      'Заявка отправлена в ИК — откройте новую сессию',
    severity: 'info',
  },

  {
    linkId:   'session→deal:approve',
    action:   'suggest',
    message:  (_triggerEvent, _link) =>
      'Решение APPROVE — подготовьте Term Sheet',
    severity: 'success',
  },

  {
    linkId:   'deal→company',
    action:   'task',
    message:  (_triggerEvent, _link) =>
      'Сделка закрыта — добавьте компанию в портфель',
    severity: 'success',
  },

  {
    linkId:   'deal→fund',
    action:   'notify',
    message:  (_triggerEvent, _link) =>
      'Сделка закрыта — выполните Capital Call из фонда',
    severity: 'warning',
  },

  {
    linkId:   'company→fund:nav',
    action:   'suggest',
    message:  (_triggerEvent, _link) =>
      'Новый раунд компании — обновите NAV фонда',
    severity: 'info',
  },
]

// ─── Ядро обработки ───────────────────────────────────────────────────────────

/**
 * Обработать событие: найти matching cross-entity связи и правила, вызвать emitFn.
 *
 * @param {Object} event    — { entityType, type, data?, ts? }
 * @param {Function} emitFn — получает { type, message, linkId, enables, severity }
 * @returns {Promise<void>}
 */
export async function processEvent(event, emitFn) {
  try {
    const links = nextCrossEntityEvents(event)

    for (const link of links) {
      const matchingRules = AUTOMATION_RULES.filter(rule => rule.linkId === link.id)

      for (const rule of matchingRules) {
        try {
          const message = rule.message(event, link)

          await emitFn({
            type:     rule.action,
            message,
            linkId:   link.id,
            enables:  link.enables,
            severity: rule.severity,
          })
        } catch (ruleErr) {
          console.error(
            `[crossEntityAutomation] rule "${rule.linkId}" emitFn failed:`,
            ruleErr
          )
        }
      }
    }
  } catch (err) {
    console.error('[crossEntityAutomation] processEvent error:', err)
  }
}

// ─── Фабрика плагина ──────────────────────────────────────────────────────────

/**
 * Создать экземпляр автоматизации с привязанным emitFn.
 *
 * @param {Function} emitFn — колбэк уведомлений; получает объект автоматизации
 * @returns {{ processEvent: (event: Object) => Promise<void> }}
 */
export function createAutomationPlugin(emitFn) {
  return {
    processEvent: (event) => processEvent(event, emitFn),
  }
}
