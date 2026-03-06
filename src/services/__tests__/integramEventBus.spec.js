/**
 * Unit tests for integramEventBus
 *
 * Tests the singleton EventBus used for local real-time synchronization
 * of Integram data across components on the same page.
 *
 * Related to issue #6738
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { integramEventBus } from '../integramEventBus'

describe('integramEventBus', () => {
  beforeEach(() => {
    // Reset listeners before each test
    integramEventBus._listeners = {}
  })

  describe('on / off / emit', () => {
    it('calls a registered handler when the event is emitted', () => {
      const handler = vi.fn()
      integramEventBus.on('object:updated', handler)

      const payload = { database: 'kval', typeId: '467150', objectId: 42, requisites: { '12': 'value' } }
      integramEventBus.emit('object:updated', payload)

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(payload)
    })

    it('does not call a handler after it is removed with off', () => {
      const handler = vi.fn()
      integramEventBus.on('object:deleted', handler)
      integramEventBus.off('object:deleted', handler)

      integramEventBus.emit('object:deleted', { database: 'kval', typeId: '467150', objectId: 42 })

      expect(handler).not.toHaveBeenCalled()
    })

    it('calls multiple handlers for the same event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      integramEventBus.on('object:updated', handler1)
      integramEventBus.on('object:updated', handler2)

      integramEventBus.emit('object:updated', { database: 'my', typeId: '18', objectId: 1, requisites: {} })

      expect(handler1).toHaveBeenCalledOnce()
      expect(handler2).toHaveBeenCalledOnce()
    })

    it('only removes the specified handler, leaving others intact', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      integramEventBus.on('object:updated', handler1)
      integramEventBus.on('object:updated', handler2)

      integramEventBus.off('object:updated', handler1)
      integramEventBus.emit('object:updated', { database: 'my', typeId: '18', objectId: 1, requisites: {} })

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledOnce()
    })

    it('does nothing when emitting an event with no listeners', () => {
      // Should not throw
      expect(() => {
        integramEventBus.emit('object:created', { database: 'my', typeId: '18', objectId: 99 })
      }).not.toThrow()
    })

    it('does nothing when calling off for an unknown event', () => {
      const handler = vi.fn()
      // Should not throw even if event was never registered
      expect(() => {
        integramEventBus.off('object:created', handler)
      }).not.toThrow()
    })

    it('does not register the same handler twice', () => {
      const handler = vi.fn()
      integramEventBus.on('object:updated', handler)
      integramEventBus.on('object:updated', handler) // duplicate

      integramEventBus.emit('object:updated', { database: 'my', typeId: '18', objectId: 1, requisites: {} })

      expect(handler).toHaveBeenCalledOnce()
    })

    it('continues calling other handlers even if one throws', () => {
      const badHandler = vi.fn(() => { throw new Error('oops') })
      const goodHandler = vi.fn()

      integramEventBus.on('object:updated', badHandler)
      integramEventBus.on('object:updated', goodHandler)

      // Should not propagate the error
      expect(() => {
        integramEventBus.emit('object:updated', { database: 'my', typeId: '18', objectId: 1, requisites: {} })
      }).not.toThrow()

      expect(badHandler).toHaveBeenCalledOnce()
      expect(goodHandler).toHaveBeenCalledOnce()
    })
  })

  describe('object:updated event', () => {
    it('passes the correct payload structure for object:updated', () => {
      const handler = vi.fn()
      integramEventBus.on('object:updated', handler)

      const payload = {
        database: 'kval',
        typeId: '467150',
        objectId: 915303,
        requisites: { '123': 'new value', '456': 'another value' }
      }
      integramEventBus.emit('object:updated', payload)

      expect(handler).toHaveBeenCalledWith(payload)
    })
  })

  describe('object:deleted event', () => {
    it('passes the correct payload structure for object:deleted', () => {
      const handler = vi.fn()
      integramEventBus.on('object:deleted', handler)

      const payload = { database: 'kval', typeId: '467150', objectId: 915303 }
      integramEventBus.emit('object:deleted', payload)

      expect(handler).toHaveBeenCalledWith(payload)
    })
  })

  describe('object:created event', () => {
    it('passes the correct payload structure for object:created', () => {
      const handler = vi.fn()
      integramEventBus.on('object:created', handler)

      const payload = { database: 'kval', typeId: '467150', objectId: 999999 }
      integramEventBus.emit('object:created', payload)

      expect(handler).toHaveBeenCalledWith(payload)
    })
  })
})
