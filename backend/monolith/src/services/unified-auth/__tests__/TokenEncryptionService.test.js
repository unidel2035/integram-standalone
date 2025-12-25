/**
 * Token Encryption Service Tests
 *
 * Tests for AES-256-GCM token encryption service
 * Part of Issue #3631: Database Token Storage System
 */

const TokenEncryptionService = require('../TokenEncryptionService');

describe('TokenEncryptionService', () => {
  let service;
  const masterKey = 'a'.repeat(64); // 256-bit key (64 hex chars)
  const testToken = 'test-token-12345';

  beforeEach(() => {
    service = new TokenEncryptionService({ masterKey });
  });

  describe('Constructor', () => {
    it('should create service with valid master key', () => {
      expect(service).toBeInstanceOf(TokenEncryptionService);
      expect(service.keyVersion).toBe('1');
    });

    it('should accept custom key version', () => {
      const customService = new TokenEncryptionService({
        masterKey,
        keyVersion: '2'
      });
      expect(customService.keyVersion).toBe('2');
    });

    it('should throw error if master key is missing', () => {
      expect(() => new TokenEncryptionService({})).toThrow(
        'Master encryption key is required'
      );
    });

    it('should throw error if master key is invalid length', () => {
      expect(() => new TokenEncryptionService({ masterKey: 'short' })).toThrow(
        'Master key must be a 256-bit hex string'
      );
    });

    it('should throw error if master key has invalid characters', () => {
      const invalidKey = 'g'.repeat(64); // 'g' is not a hex character
      expect(() => new TokenEncryptionService({ masterKey: invalidKey })).toThrow(
        'Master key must be a 256-bit hex string'
      );
    });
  });

  describe('encrypt()', () => {
    it('should encrypt a token', () => {
      const encrypted = service.encrypt(testToken);

      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(testToken);
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const encrypted1 = service.encrypt(testToken);
      const encrypted2 = service.encrypt(testToken);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should produce encrypted token in correct format', () => {
      const encrypted = service.encrypt(testToken);
      const parts = encrypted.split(':');

      expect(parts.length).toBe(4);
      expect(parts[0]).toBe('1'); // Key version
      expect(parts[1]).toBeTruthy(); // IV
      expect(parts[2]).toBeTruthy(); // authTag
      expect(parts[3]).toBeTruthy(); // ciphertext
    });

    it('should throw error for empty plaintext', () => {
      expect(() => service.encrypt('')).toThrow('Plaintext must be a non-empty string');
    });

    it('should throw error for non-string plaintext', () => {
      expect(() => service.encrypt(123)).toThrow('Plaintext must be a non-empty string');
      expect(() => service.encrypt(null)).toThrow('Plaintext must be a non-empty string');
      expect(() => service.encrypt(undefined)).toThrow('Plaintext must be a non-empty string');
    });
  });

  describe('decrypt()', () => {
    it('should decrypt an encrypted token', () => {
      const encrypted = service.encrypt(testToken);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(testToken);
    });

    it('should decrypt tokens with special characters', () => {
      const specialToken = 'token!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\';
      const encrypted = service.encrypt(specialToken);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(specialToken);
    });

    it('should decrypt Unicode tokens', () => {
      const unicodeToken = '日本語トークン🔐🎉';
      const encrypted = service.encrypt(unicodeToken);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(unicodeToken);
    });

    it('should throw error for invalid encrypted format', () => {
      expect(() => service.decrypt('invalid')).toThrow('Invalid encrypted token format');
      expect(() => service.decrypt('a:b:c')).toThrow('Invalid encrypted token format');
    });

    it('should throw error for empty encrypted token', () => {
      expect(() => service.decrypt('')).toThrow('Encrypted token must be a non-empty string');
    });

    it('should throw error for non-string encrypted token', () => {
      expect(() => service.decrypt(123)).toThrow('Encrypted token must be a non-empty string');
    });

    it('should throw error for wrong key version', () => {
      const encrypted = service.encrypt(testToken);
      const modifiedEncrypted = '2' + encrypted.substring(1);

      expect(() => service.decrypt(modifiedEncrypted)).toThrow('Key version mismatch');
    });

    it('should throw error for tampered ciphertext', () => {
      const encrypted = service.encrypt(testToken);
      const parts = encrypted.split(':');
      parts[3] = parts[3].substring(0, parts[3].length - 5) + 'XXXXX';
      const tampered = parts.join(':');

      expect(() => service.decrypt(tampered)).toThrow('Token decryption failed');
    });

    it('should throw error for tampered auth tag', () => {
      const encrypted = service.encrypt(testToken);
      const parts = encrypted.split(':');
      parts[2] = parts[2].substring(0, parts[2].length - 5) + 'YYYYY';
      const tampered = parts.join(':');

      expect(() => service.decrypt(tampered)).toThrow('Token decryption failed');
    });
  });

  describe('Round-trip encryption/decryption', () => {
    const testCases = [
      'simple-token',
      'token with spaces',
      '日本語',
      'emoji🔐🎉',
      '{"json": "token"}',
      'very-long-token-' + 'x'.repeat(1000),
      'special!@#$%^&*()',
      ''
    ];

    testCases.forEach((token) => {
      if (token === '') {
        it(`should handle empty token by throwing error`, () => {
          expect(() => service.encrypt(token)).toThrow();
        });
      } else {
        it(`should correctly round-trip: "${token.substring(0, 50)}${token.length > 50 ? '...' : ''}"`, () => {
          const encrypted = service.encrypt(token);
          const decrypted = service.decrypt(encrypted);
          expect(decrypted).toBe(token);
        });
      }
    });
  });

  describe('encryptBatch()', () => {
    it('should encrypt multiple tokens', () => {
      const tokens = ['token1', 'token2', 'token3'];
      const encrypted = service.encryptBatch(tokens);

      expect(encrypted.length).toBe(3);
      expect(encrypted[0]).not.toBe(tokens[0]);
      expect(encrypted[1]).not.toBe(tokens[1]);
      expect(encrypted[2]).not.toBe(tokens[2]);
    });

    it('should throw error for non-array input', () => {
      expect(() => service.encryptBatch('not-array')).toThrow('Plaintexts must be an array');
    });

    it('should handle empty array', () => {
      const encrypted = service.encryptBatch([]);
      expect(encrypted).toEqual([]);
    });
  });

  describe('decryptBatch()', () => {
    it('should decrypt multiple tokens', () => {
      const tokens = ['token1', 'token2', 'token3'];
      const encrypted = service.encryptBatch(tokens);
      const decrypted = service.decryptBatch(encrypted);

      expect(decrypted).toEqual(tokens);
    });

    it('should throw error for non-array input', () => {
      expect(() => service.decryptBatch('not-array')).toThrow(
        'Encrypted tokens must be an array'
      );
    });

    it('should handle empty array', () => {
      const decrypted = service.decryptBatch([]);
      expect(decrypted).toEqual([]);
    });
  });

  describe('Static methods', () => {
    describe('generateMasterKey()', () => {
      it('should generate a valid 256-bit key', () => {
        const key = TokenEncryptionService.generateMasterKey();

        expect(key).toBeTruthy();
        expect(typeof key).toBe('string');
        expect(key.length).toBe(64); // 32 bytes = 64 hex chars
        expect(/^[0-9a-f]{64}$/i.test(key)).toBe(true);
      });

      it('should generate different keys each time', () => {
        const key1 = TokenEncryptionService.generateMasterKey();
        const key2 = TokenEncryptionService.generateMasterKey();

        expect(key1).not.toBe(key2);
      });

      it('should generate keys that work with the service', () => {
        const key = TokenEncryptionService.generateMasterKey();
        const testService = new TokenEncryptionService({ masterKey: key });

        const encrypted = testService.encrypt(testToken);
        const decrypted = testService.decrypt(encrypted);

        expect(decrypted).toBe(testToken);
      });
    });

    describe('isValidEncryptedToken()', () => {
      it('should return true for valid encrypted tokens', () => {
        const encrypted = service.encrypt(testToken);
        expect(TokenEncryptionService.isValidEncryptedToken(encrypted)).toBe(true);
      });

      it('should return false for invalid formats', () => {
        expect(TokenEncryptionService.isValidEncryptedToken('invalid')).toBe(false);
        expect(TokenEncryptionService.isValidEncryptedToken('a:b:c')).toBe(false);
        expect(TokenEncryptionService.isValidEncryptedToken('')).toBe(false);
        expect(TokenEncryptionService.isValidEncryptedToken(null)).toBe(false);
        expect(TokenEncryptionService.isValidEncryptedToken(undefined)).toBe(false);
        expect(TokenEncryptionService.isValidEncryptedToken(123)).toBe(false);
      });

      it('should return false for invalid base64url encoding', () => {
        expect(TokenEncryptionService.isValidEncryptedToken('1:!!!:!!!:!!!')).toBe(false);
      });
    });

    describe('getKeyVersion()', () => {
      it('should return key version from valid encrypted token', () => {
        const encrypted = service.encrypt(testToken);
        const version = TokenEncryptionService.getKeyVersion(encrypted);

        expect(version).toBe('1');
      });

      it('should return custom key version', () => {
        const customService = new TokenEncryptionService({
          masterKey,
          keyVersion: '5'
        });
        const encrypted = customService.encrypt(testToken);
        const version = TokenEncryptionService.getKeyVersion(encrypted);

        expect(version).toBe('5');
      });

      it('should return null for invalid tokens', () => {
        expect(TokenEncryptionService.getKeyVersion('invalid')).toBeNull();
        expect(TokenEncryptionService.getKeyVersion('')).toBeNull();
        expect(TokenEncryptionService.getKeyVersion(null)).toBeNull();
      });
    });
  });

  describe('Key rotation', () => {
    it('should support key rotation using different service instances', () => {
      const oldKey = TokenEncryptionService.generateMasterKey();
      const newKey = TokenEncryptionService.generateMasterKey();

      const oldService = new TokenEncryptionService({
        masterKey: oldKey,
        keyVersion: '1'
      });
      const newService = new TokenEncryptionService({
        masterKey: newKey,
        keyVersion: '2'
      });

      // Encrypt with old key
      const encrypted = oldService.encrypt(testToken);

      // Decrypt with old key
      const decrypted = oldService.decrypt(encrypted);
      expect(decrypted).toBe(testToken);

      // Re-encrypt with new key
      const reEncrypted = newService.encrypt(decrypted);

      // Verify new encryption has new version
      expect(TokenEncryptionService.getKeyVersion(reEncrypted)).toBe('2');

      // Decrypt with new key
      const finalDecrypted = newService.decrypt(reEncrypted);
      expect(finalDecrypted).toBe(testToken);

      // Old key cannot decrypt new token
      expect(() => oldService.decrypt(reEncrypted)).toThrow('Key version mismatch');
    });
  });

  describe('Security properties', () => {
    it('should use different IV for each encryption', () => {
      const encrypted1 = service.encrypt(testToken);
      const encrypted2 = service.encrypt(testToken);

      const iv1 = encrypted1.split(':')[1];
      const iv2 = encrypted2.split(':')[1];

      expect(iv1).not.toBe(iv2);
    });

    it('should prevent decryption with wrong key', () => {
      const key1 = TokenEncryptionService.generateMasterKey();
      const key2 = TokenEncryptionService.generateMasterKey();

      const service1 = new TokenEncryptionService({ masterKey: key1, keyVersion: '1' });
      const service2 = new TokenEncryptionService({ masterKey: key2, keyVersion: '1' });

      const encrypted = service1.encrypt(testToken);

      // service2 has wrong key, should fail authentication
      expect(() => service2.decrypt(encrypted)).toThrow('Token decryption failed');
    });

    it('should detect tampering via auth tag', () => {
      const encrypted = service.encrypt(testToken);
      const parts = encrypted.split(':');

      // Tamper with ciphertext
      const tamperedCiphertext = parts[3] + 'x';
      const tampered = [parts[0], parts[1], parts[2], tamperedCiphertext].join(':');

      expect(() => service.decrypt(tampered)).toThrow('Token decryption failed');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long tokens', () => {
      const longToken = 'x'.repeat(10000);
      const encrypted = service.encrypt(longToken);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(longToken);
    });

    it('should handle tokens with newlines', () => {
      const tokenWithNewlines = 'line1\nline2\nline3';
      const encrypted = service.encrypt(tokenWithNewlines);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(tokenWithNewlines);
    });

    it('should handle tokens with null bytes', () => {
      const tokenWithNull = 'before\x00after';
      const encrypted = service.encrypt(tokenWithNull);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(tokenWithNull);
    });
  });
});
