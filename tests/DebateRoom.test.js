/**
 * Unit tests for DebateRoom.js
 *
 * Tests in-memory pub/sub message bus for multi-agent investment committee
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DebateRoom } from '../src/components/fst-committee/DebateRoom.js'

describe('DebateRoom — Constructor', () => {
  it('initializes with empty state', () => {
    const room = new DebateRoom()
    expect(room.messages).toEqual([])
    expect(room.byAgent).toEqual({})
    expect(room.toolCalls).toEqual([])
    expect(room.size).toBe(0)
    expect(room._phase).toBeNull()
    expect(room._counter).toBe(0)
  })

  it('accepts onPublish callback', () => {
    const cb = () => {}
    const room = new DebateRoom(cb)
    expect(room._onPublish).toBe(cb)
  })
})

describe('DebateRoom — setPhase', () => {
  it('sets the current phase', () => {
    const room = new DebateRoom()
    room.setPhase('OPENING')
    expect(room._phase).toBe('OPENING')
  })

  it('allows changing phase', () => {
    const room = new DebateRoom()
    room.setPhase('OPENING')
    room.setPhase('CROSS_DEBATE')
    expect(room._phase).toBe('CROSS_DEBATE')
  })
})

describe('DebateRoom — publish', () => {
  let room

  beforeEach(() => {
    room = new DebateRoom()
    room.setPhase('OPENING')
  })

  it('publishes a message and returns it', () => {
    const msg = room.publish('tech', { text: 'TRL is 7', dimension: 'trl', confidence: 0.8, stance: 'APPROVE' })
    expect(msg.agentId).toBe('tech')
    expect(msg.text).toBe('TRL is 7')
    expect(msg.dimension).toBe('trl')
    expect(msg.confidence).toBe(0.8)
    expect(msg.stance).toBe('APPROVE')
    expect(msg.phase).toBe('OPENING')
    expect(msg.type).toBe('ARGUMENT')
    expect(msg.id).toContain('room_1_tech')
    expect(msg.ts).toBeGreaterThan(0)
  })

  it('increments counter for each message', () => {
    const m1 = room.publish('tech', { text: 'A' })
    const m2 = room.publish('finance', { text: 'B' })
    expect(m1.id).toContain('room_1_')
    expect(m2.id).toContain('room_2_')
  })

  it('stores messages in messages array', () => {
    room.publish('tech', { text: 'A' })
    room.publish('finance', { text: 'B' })
    expect(room.messages).toHaveLength(2)
    expect(room.size).toBe(2)
  })

  it('stores messages by agent', () => {
    room.publish('tech', { text: 'A' })
    room.publish('finance', { text: 'B' })
    room.publish('tech', { text: 'C' })
    expect(room.byAgent['tech']).toHaveLength(2)
    expect(room.byAgent['finance']).toHaveLength(1)
  })

  it('applies default values for missing payload fields', () => {
    const msg = room.publish('tech', { text: 'Hello' })
    expect(msg.type).toBe('ARGUMENT')
    expect(msg.dimension).toBeNull()
    expect(msg.confidence).toBe(0.7)
    expect(msg.stance).toBeNull()
    expect(msg.targetArgId).toBeNull()
    expect(msg.toolsUsed).toEqual([])
  })

  it('fires onPublish callback', () => {
    const published = []
    const room2 = new DebateRoom(msg => published.push(msg))
    room2.publish('tech', { text: 'X' })
    expect(published).toHaveLength(1)
    expect(published[0].text).toBe('X')
  })

  it('allows custom type', () => {
    const msg = room.publish('tech', { text: 'A', type: 'CHALLENGE' })
    expect(msg.type).toBe('CHALLENGE')
  })
})

describe('DebateRoom — logToolCall', () => {
  it('logs a tool call entry', () => {
    const room = new DebateRoom()
    room.setPhase('OPENING')
    const entry = room.logToolCall('tech', 'calc_irr', { cashflows: [10, 20] }, { irr: 0.25 }, 150)
    expect(entry.agentId).toBe('tech')
    expect(entry.tool).toBe('calc_irr')
    expect(entry.args).toEqual({ cashflows: [10, 20] })
    expect(entry.result).toEqual({ irr: 0.25 })
    expect(entry.durationMs).toBe(150)
    expect(entry.phase).toBe('OPENING')
    expect(entry.ts).toBeGreaterThan(0)
    expect(room.toolCalls).toHaveLength(1)
  })
})

describe('DebateRoom — readLatest', () => {
  let room

  beforeEach(() => {
    room = new DebateRoom()
    for (let i = 0; i < 12; i++) {
      room.publish(i % 3 === 0 ? 'tech' : i % 3 === 1 ? 'finance' : 'risk', { text: `msg${i}` })
    }
  })

  it('returns last N messages', () => {
    const msgs = room.readLatest(3)
    expect(msgs).toHaveLength(3)
    expect(msgs[0].text).toBe('msg9')
    expect(msgs[2].text).toBe('msg11')
  })

  it('defaults to 8 messages', () => {
    const msgs = room.readLatest()
    expect(msgs).toHaveLength(8)
  })

  it('excludes agent when specified', () => {
    const msgs = room.readLatest(100, 'tech')
    expect(msgs.every(m => m.agentId !== 'tech')).toBe(true)
    expect(msgs.length).toBe(8)
  })

  it('returns empty array for empty room', () => {
    const emptyRoom = new DebateRoom()
    expect(emptyRoom.readLatest()).toEqual([])
  })
})

describe('DebateRoom — getByAgent', () => {
  it('returns messages for specific agent', () => {
    const room = new DebateRoom()
    room.publish('tech', { text: 'A' })
    room.publish('finance', { text: 'B' })
    room.publish('tech', { text: 'C' })
    expect(room.getByAgent('tech')).toHaveLength(2)
  })

  it('returns empty array for unknown agent', () => {
    const room = new DebateRoom()
    expect(room.getByAgent('nonexistent')).toEqual([])
  })
})

describe('DebateRoom — format', () => {
  it('returns empty message for empty room', () => {
    const room = new DebateRoom()
    expect(room.format()).toBe('Зал дебатов пуст — ты первый.')
  })

  it('formats messages for LLM context', () => {
    const room = new DebateRoom()
    room.publish('tech', { text: 'TRL is good', dimension: 'trl' })
    room.publish('finance', { text: 'IRR is low' })
    const formatted = room.format()
    expect(formatted).toContain('[tech')
    expect(formatted).toContain('[trl]')
    expect(formatted).toContain('TRL is good')
    expect(formatted).toContain('[finance')
    expect(formatted).toContain('IRR is low')
  })

  it('marks current agent messages', () => {
    const room = new DebateRoom()
    room.publish('tech', { text: 'My arg' })
    const formatted = room.format(8, 'tech')
    expect(formatted).toContain('[ты уже сказал]')
  })

  it('does not mark other agents', () => {
    const room = new DebateRoom()
    room.publish('tech', { text: 'My arg' })
    const formatted = room.format(8, 'finance')
    expect(formatted).not.toContain('[ты уже сказал]')
  })
})

describe('DebateRoom — getUnchallengedArgs', () => {
  it('returns args not targeted by any response', () => {
    const room = new DebateRoom()
    const m1 = room.publish('tech', { text: 'Arg 1' })
    room.publish('finance', { text: 'Arg 2' })
    room.publish('risk', { text: 'Counter to 1', targetArgId: m1.id })

    const unchallenged = room.getUnchallengedArgs('risk')
    expect(unchallenged).toHaveLength(1)
    expect(unchallenged[0].agentId).toBe('finance')
  })

  it('excludes specified agent from results', () => {
    const room = new DebateRoom()
    room.publish('tech', { text: 'A' })
    room.publish('tech', { text: 'B' })
    const unchallenged = room.getUnchallengedArgs('tech')
    expect(unchallenged).toHaveLength(0)
  })

  it('returns all args when none are challenged', () => {
    const room = new DebateRoom()
    room.publish('tech', { text: 'A' })
    room.publish('finance', { text: 'B' })
    const unchallenged = room.getUnchallengedArgs('risk')
    expect(unchallenged).toHaveLength(2)
  })
})
