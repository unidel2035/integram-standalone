/**
 * Tests for WebhookService
 *
 * Tests GitHub webhook handling and signature verification
 *
 * Issue #5079
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { getWebhookService } from '../WebhookService.js';

describe('WebhookService', () => {
  let webhookService;
  let originalEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };

    // Set test environment
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    process.env.GITHUB_OWNER = 'unidel2035';
    process.env.GITHUB_REPO = 'dronedoc2025';

    // Get fresh instance
    webhookService = getWebhookService();
  });

  afterEach(() => {
    // Restore env
    process.env = originalEnv;
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const hmac = crypto.createHmac('sha256', 'test-secret');
      hmac.update(payload, 'utf-8');
      const signature = `sha256=${hmac.digest('hex')}`;

      const isValid = webhookService.verifySignature(payload, signature);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const invalidSignature = 'sha256=invalid';

      const isValid = webhookService.verifySignature(payload, invalidSignature);
      expect(isValid).toBe(false);
    });

    it('should reject missing signature when secret configured', () => {
      const payload = JSON.stringify({ test: 'data' });

      const isValid = webhookService.verifySignature(payload, null);
      expect(isValid).toBe(false);
    });

    it('should allow missing signature when no secret configured', () => {
      process.env.GITHUB_WEBHOOK_SECRET = '';
      const webhookServiceNoSecret = getWebhookService();

      const payload = JSON.stringify({ test: 'data' });
      const isValid = webhookServiceNoSecret.verifySignature(payload, null);
      expect(isValid).toBe(true);
    });
  });

  describe('isTargetRepository', () => {
    it('should accept correct repository', () => {
      const repository = {
        full_name: 'unidel2035/dronedoc2025'
      };

      const isTarget = webhookService.isTargetRepository(repository);
      expect(isTarget).toBe(true);
    });

    it('should reject other repository', () => {
      const repository = {
        full_name: 'other-owner/other-repo'
      };

      const isTarget = webhookService.isTargetRepository(repository);
      expect(isTarget).toBe(false);
    });

    it('should reject null repository', () => {
      const isTarget = webhookService.isTargetRepository(null);
      expect(isTarget).toBe(false);
    });
  });

  describe('handleWebhook', () => {
    it('should queue webhook for target repository', async () => {
      const payload = {
        repository: {
          full_name: 'unidel2035/dronedoc2025'
        },
        action: 'opened',
        issue: {
          number: 123,
          title: 'Test issue'
        }
      };

      const result = await webhookService.handleWebhook('issues', payload, 'delivery-123');

      expect(result.success).toBe(true);
      expect(result.queued).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.event).toBe('issues');
    });

    it('should ignore webhook from non-target repository', async () => {
      const payload = {
        repository: {
          full_name: 'other-owner/other-repo'
        }
      };

      const result = await webhookService.handleWebhook('push', payload, 'delivery-456');

      expect(result.success).toBe(true);
      expect(result.ignored).toBe(true);
      expect(result.reason).toBe('non-target repository');
    });
  });

  describe('processWebhookEvent', () => {
    it('should process push event', async () => {
      const job = {
        event: 'push',
        payload: {
          repository: {
            full_name: 'unidel2035/dronedoc2025'
          },
          ref: 'refs/heads/main',
          commits: [
            {
              added: ['file1.js'],
              modified: ['file2.js'],
              removed: []
            }
          ]
        },
        deliveryId: 'delivery-123'
      };

      // Mock KAGService.updateFilesFromPush
      vi.mock('../KAGService.js', () => ({
        getKAGService: () => ({
          updateFilesFromPush: vi.fn().mockResolvedValue({ updated: 1, added: 1, removed: 0 })
        })
      }));

      const result = await webhookService.processWebhookEvent(job);

      expect(result.success).toBe(true);
      expect(result.event).toBe('push');
    });

    it('should ignore unsupported event type', async () => {
      const job = {
        event: 'unsupported_event',
        payload: {},
        deliveryId: 'delivery-789'
      };

      const result = await webhookService.processWebhookEvent(job);

      expect(result.success).toBe(true);
      expect(result.ignored).toBe(true);
      expect(result.reason).toBe('unsupported event type');
    });
  });

  describe('getStats', () => {
    it('should return webhook stats', async () => {
      const stats = await webhookService.getStats();

      expect(stats).toBeDefined();
      expect(stats.webhookSecret).toBeDefined();
      expect(stats.queue).toBeDefined();
    });

    it('should indicate when webhook secret is configured', async () => {
      const stats = await webhookService.getStats();
      expect(stats.webhookSecret).toBe('configured');
    });

    it('should indicate when webhook secret is not configured', async () => {
      process.env.GITHUB_WEBHOOK_SECRET = '';
      const webhookServiceNoSecret = getWebhookService();

      const stats = await webhookServiceNoSecret.getStats();
      expect(stats.webhookSecret).toBe('not configured');
    });
  });
});
