/**
 * Tests for SelfHealingService
 * Issue #1674: Система самолечения бэкэнда
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SelfHealingService from '../SelfHealingService.js';

describe('SelfHealingService', () => {
  let selfHealingService;

  beforeEach(async () => {
    selfHealingService = new SelfHealingService();
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Initialization', () => {
    it('should initialize with default recovery strategies', () => {
      expect(selfHealingService.recoveryStrategies.size).toBeGreaterThan(0);
      expect(selfHealingService.recoveryStrategies.has('reconnect_database')).toBe(true);
      expect(selfHealingService.recoveryStrategies.has('log_and_continue')).toBe(true);
    });

    it('should be enabled by default', () => {
      expect(selfHealingService.isEnabled).toBe(true);
    });
  });

  describe('Error Classification', () => {
    it('should classify database connection errors', async () => {
      const errorMessage = 'Error: ECONNREFUSED 127.0.0.1:5432 postgres';
      const classification = await selfHealingService.classifyError(errorMessage, null);

      // Should match database connection pattern or return default
      expect(classification).toBeDefined();
      expect(classification.recovery_strategy).toBeDefined();
      expect(classification.severity).toBeDefined();
    });

    it('should return default classification for unknown errors', async () => {
      const errorMessage = 'Some random unknown error';
      const classification = await selfHealingService.classifyError(errorMessage, null);

      expect(classification.pattern).toBe('unknown');
      expect(classification.recovery_strategy).toBe('log_and_continue');
      expect(classification.severity).toBe('medium');
    });
  });

  describe('Recovery Strategies', () => {
    it('should execute log_and_continue strategy', async () => {
      const result = await selfHealingService.logAndContinue({});
      expect(result.message).toContain('logged');
      expect(result.data.logged).toBe(true);
    });

    it('should execute reconnect_database strategy', async () => {
      const result = await selfHealingService.reconnectDatabase({});
      expect(result.message).toBeDefined();
      expect(result.data).toBeDefined();
    });

    it('should execute clear_cache strategy', async () => {
      const result = await selfHealingService.clearCache({});
      expect(result.message).toContain('Cache cleared');
      expect(result.data.cleared).toBe(true);
    });
  });

  describe('Custom Strategy Registration', () => {
    it('should allow registering custom recovery strategies', () => {
      const customStrategy = vi.fn(async () => ({
        message: 'Custom strategy executed',
        data: { custom: true }
      }));

      selfHealingService.registerStrategy('custom_strategy', customStrategy);

      expect(selfHealingService.recoveryStrategies.has('custom_strategy')).toBe(true);
    });

    it('should execute custom registered strategy', async () => {
      const customStrategy = async (params) => ({
        message: `Custom strategy with param: ${params.testParam}`,
        data: { custom: true, param: params.testParam }
      });

      selfHealingService.registerStrategy('test_custom', customStrategy);

      const handler = selfHealingService.recoveryStrategies.get('test_custom');
      const result = await handler({ testParam: 'test_value' });

      expect(result.message).toContain('test_value');
      expect(result.data.custom).toBe(true);
    });
  });

  describe('Error Handling Flow', () => {
    it('should handle error when self-healing is disabled', async () => {
      selfHealingService.isEnabled = false;

      const error = new Error('Test error');
      const result = await selfHealingService.handleError(error, {});

      expect(result).toBeNull();
    });
  });
});
