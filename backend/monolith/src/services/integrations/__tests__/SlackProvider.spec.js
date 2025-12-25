/**
 * Tests for Slack Integration Provider
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import SlackProvider from '../providers/SlackProvider.js'
import crypto from 'crypto'

describe('SlackProvider', () => {
  let slack
  let mockFetch

  beforeEach(() => {
    slack = new SlackProvider({
      signingSecret: 'test-signing-secret'
    })

    // Mock global fetch
    mockFetch = vi.fn()
    global.fetch = mockFetch
  })

  describe('verifyWebhookSignature', () => {
    it('should verify valid webhook signature', () => {
      const timestamp = Math.floor(Date.now() / 1000)
      const body = { test: 'data' }
      const bodyString = JSON.stringify(body)

      const sigBasestring = `v0:${timestamp}:${bodyString}`
      const hmac = crypto.createHmac('sha256', 'test-signing-secret')
      hmac.update(sigBasestring)
      const signature = 'v0=' + hmac.digest('hex')

      const req = {
        headers: {
          'x-slack-request-timestamp': timestamp.toString(),
          'x-slack-signature': signature
        },
        body
      }

      expect(slack.verifyWebhookSignature(req)).toBe(true)
    })

    it('should reject invalid signature', () => {
      const req = {
        headers: {
          'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
          'x-slack-signature': 'v0=invalid'
        },
        body: { test: 'data' }
      }

      expect(slack.verifyWebhookSignature(req)).toBe(false)
    })

    it('should reject old timestamp', () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400 // 6+ minutes ago

      const req = {
        headers: {
          'x-slack-request-timestamp': oldTimestamp.toString(),
          'x-slack-signature': 'v0=test'
        },
        body: { test: 'data' }
      }

      expect(slack.verifyWebhookSignature(req)).toBe(false)
    })
  })

  describe('postMessage', () => {
    it('should post message successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, ts: '1234567890.123456' })
      })

      const result = await slack.postMessage('token', '#general', 'Hello World')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer token'
          })
        })
      )

      expect(result.ok).toBe(true)
    })

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: false, error: 'channel_not_found' })
      })

      await expect(
        slack.postMessage('token', '#invalid', 'Test')
      ).rejects.toThrow('channel_not_found')
    })
  })

  describe('postRecording', () => {
    it('should post recording with blocks', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, ts: '1234567890.123456' })
      })

      const recording = {
        id: 'rec_123',
        title: 'Team Meeting',
        duration: '45:30',
        createdAt: '2025-11-07T10:00:00Z',
        participantCount: 5,
        url: 'https://example.com/recording/123'
      }

      const result = await slack.postRecording('token', '#general', recording)

      expect(mockFetch).toHaveBeenCalled()
      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)

      expect(body.blocks).toBeDefined()
      expect(body.blocks[0].type).toBe('header')
    })
  })

  describe('handleSlashCommand', () => {
    it('should handle /drondoc help command', () => {
      const payload = {
        command: '/drondoc',
        text: 'help',
        user_id: 'U123',
        channel_id: 'C123'
      }

      const response = slack.handleSlashCommand(payload)

      expect(response.response_type).toBe('ephemeral')
      expect(response.text).toContain('DronDoc Commands')
    })

    it('should handle /drondoc join command', () => {
      const payload = {
        command: '/drondoc',
        text: 'join',
        user_id: 'U123',
        channel_id: 'C123'
      }

      const response = slack.handleSlashCommand(payload)

      expect(response.text).toContain('join')
    })

    it('should handle unknown subcommand', () => {
      const payload = {
        command: '/drondoc',
        text: 'unknown',
        user_id: 'U123',
        channel_id: 'C123'
      }

      const response = slack.handleSlashCommand(payload)

      expect(response.text).toContain('Unknown subcommand')
    })
  })

  describe('listChannels', () => {
    it('should list channels successfully', async () => {
      const mockChannels = [
        { id: 'C1', name: 'general' },
        { id: 'C2', name: 'random' }
      ]

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, channels: mockChannels })
      })

      const result = await slack.listChannels('token')

      expect(result).toEqual(mockChannels)
    })
  })
})
