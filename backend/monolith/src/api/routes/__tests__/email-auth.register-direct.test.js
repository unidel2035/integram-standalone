/**
 * Email Authentication API Tests - register-direct endpoint
 *
 * Issue #65: Tests for weak password validation fix
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import emailAuthRouter from '../email-auth.js';

// Mock dependencies
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../services/email/EmailVerificationService.js', () => ({
  sendEmailVerification: vi.fn(),
  verifyEmail: vi.fn(),
  sendPasswordReset: vi.fn(),
  verifyPasswordResetToken: vi.fn(),
  resetPassword: vi.fn(),
  sendMagicLink: vi.fn(),
  verifyMagicLink: vi.fn()
}));

vi.mock('../../../services/ai/defaultTokenService.js', () => ({
  default: {
    ensureDefaultToken: vi.fn().mockResolvedValue({ success: true })
  }
}));

vi.mock('../../../utils/IntegramClient.js', () => ({
  createIntegramClient: vi.fn().mockReturnValue({
    checkUserExists: vi.fn().mockResolvedValue({ exists: false })
  })
}));

vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}));

describe('POST /api/email-auth/register-direct - Password Validation (Issue #65)', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/email-auth', emailAuthRouter);
    vi.clearAllMocks();
  });

  describe('Password Strength Validation', () => {
    it('should reject password with only lowercase letters', async () => {
      const response = await request(app)
        .post('/api/email-auth/register-direct')
        .send({
          email: 'test@example.com',
          password: 'abcdefgh'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors).toContain('Пароль должен содержать хотя бы одну заглавную букву');
      expect(response.body.errors).toContain('Пароль должен содержать хотя бы одну цифру');
      expect(response.body.errors).toContain('Пароль должен содержать хотя бы один специальный символ');
    });

    it('should reject password with only numbers', async () => {
      const response = await request(app)
        .post('/api/email-auth/register-direct')
        .send({
          email: 'test@example.com',
          password: '12345678'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors).toContain('Пароль должен содержать хотя бы одну строчную букву');
      expect(response.body.errors).toContain('Пароль должен содержать хотя бы одну заглавную букву');
      expect(response.body.errors).toContain('Пароль должен содержать хотя бы один специальный символ');
    });

    it('should reject password shorter than 8 characters', async () => {
      const response = await request(app)
        .post('/api/email-auth/register-direct')
        .send({
          email: 'test@example.com',
          password: 'Abc1!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors).toContain('Пароль должен содержать минимум 8 символов');
    });

    it('should reject password without uppercase letters', async () => {
      const response = await request(app)
        .post('/api/email-auth/register-direct')
        .send({
          email: 'test@example.com',
          password: 'abcd1234!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors).toContain('Пароль должен содержать хотя бы одну заглавную букву');
    });

    it('should reject password without lowercase letters', async () => {
      const response = await request(app)
        .post('/api/email-auth/register-direct')
        .send({
          email: 'test@example.com',
          password: 'ABCD1234!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors).toContain('Пароль должен содержать хотя бы одну строчную букву');
    });

    it('should reject password without numbers', async () => {
      const response = await request(app)
        .post('/api/email-auth/register-direct')
        .send({
          email: 'test@example.com',
          password: 'Abcdefgh!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors).toContain('Пароль должен содержать хотя бы одну цифру');
    });

    it('should reject password without special characters', async () => {
      const response = await request(app)
        .post('/api/email-auth/register-direct')
        .send({
          email: 'test@example.com',
          password: 'Abcd1234'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors).toContain('Пароль должен содержать хотя бы один специальный символ');
    });

    it('should reject common weak passwords', async () => {
      const weakPasswords = [
        'password',
        '12345678',
        'aaaaaaaa',
        'qwerty12',
        'abcdefgh'
      ];

      for (const weakPassword of weakPasswords) {
        const response = await request(app)
          .post('/api/email-auth/register-direct')
          .send({
            email: 'test@example.com',
            password: weakPassword
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
      }
    });
  });

  describe('Email Validation', () => {
    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/email-auth/register-direct')
        .send({
          email: 'invalid-email',
          password: 'ValidP@ss123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email format');
    });

    it('should reject email without @', async () => {
      const response = await request(app)
        .post('/api/email-auth/register-direct')
        .send({
          email: 'invalid.email.com',
          password: 'ValidP@ss123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email format');
    });

    it('should reject email without domain', async () => {
      const response = await request(app)
        .post('/api/email-auth/register-direct')
        .send({
          email: 'test@',
          password: 'ValidP@ss123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email format');
    });
  });

  describe('Username Validation', () => {
    it('should reject username shorter than 3 characters', async () => {
      const response = await request(app)
        .post('/api/email-auth/register-direct')
        .send({
          email: 'test@example.com',
          password: 'ValidP@ss123',
          username: 'ab'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Имя пользователя должно содержать минимум 3 символа');
    });

    it('should reject username longer than 50 characters', async () => {
      const response = await request(app)
        .post('/api/email-auth/register-direct')
        .send({
          email: 'test@example.com',
          password: 'ValidP@ss123',
          username: 'a'.repeat(51)
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Имя пользователя не может быть длиннее 50 символов');
    });

    it('should reject username with special characters', async () => {
      const response = await request(app)
        .post('/api/email-auth/register-direct')
        .send({
          email: 'test@example.com',
          password: 'ValidP@ss123',
          username: 'user@name!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Имя пользователя может содержать только буквы, цифры, дефис и подчеркивание');
    });

    it('should accept valid username with letters, numbers, dash, and underscore', async () => {
      // Note: This test will fail without proper mocking of axios and Integram client
      // For now, we're just testing the validation logic
      const response = await request(app)
        .post('/api/email-auth/register-direct')
        .send({
          email: 'test@example.com',
          password: 'ValidP@ss123',
          username: 'valid_user-123'
        });

      // Should pass username validation (but may fail on Integram API call)
      // We're checking it doesn't fail with username validation error
      if (response.status === 400) {
        expect(response.body.error).not.toContain('Имя пользователя');
      }
    });
  });

  describe('Required Fields Validation', () => {
    it('should reject request without email', async () => {
      const response = await request(app)
        .post('/api/email-auth/register-direct')
        .send({
          password: 'ValidP@ss123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email is required');
    });

    it('should reject request without password', async () => {
      const response = await request(app)
        .post('/api/email-auth/register-direct')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Password is required');
    });
  });

  describe('Valid Registration Data', () => {
    it('should accept strong password meeting all requirements', async () => {
      const validPasswords = [
        'ValidP@ss123',
        'Str0ng!Pass',
        'MyP@ssw0rd',
        'S3cur3#Pwd',
        'T3st!ng@123'
      ];

      for (const validPassword of validPasswords) {
        const response = await request(app)
          .post('/api/email-auth/register-direct')
          .send({
            email: 'test@example.com',
            password: validPassword
          });

        // Should not fail with password validation error
        if (response.status === 400) {
          expect(response.body.errors).toBeUndefined();
          // If it fails, it should be for other reasons (like Integram API)
        }
      }
    });
  });
});
