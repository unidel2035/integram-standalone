/**
 * Token Encryption Service
 *
 * Provides AES-256-GCM encryption for database tokens with key rotation support.
 * Part of Issue #3631: Database Token Storage System
 *
 * @module TokenEncryptionService
 */

const crypto = require('crypto');

/**
 * Service for encrypting and decrypting authentication tokens
 * using AES-256-GCM encryption with authenticated encryption.
 */
class TokenEncryptionService {
  /**
   * Create a new TokenEncryptionService
   * @param {Object} options - Configuration options
   * @param {string} options.masterKey - Master encryption key (256-bit hex string)
   * @param {string} [options.keyVersion='1'] - Key version for rotation support
   */
  constructor(options = {}) {
    const { masterKey, keyVersion = '1' } = options;

    if (!masterKey) {
      throw new Error('Master encryption key is required');
    }

    // Validate master key is 256-bit (64 hex characters)
    if (!/^[0-9a-f]{64}$/i.test(masterKey)) {
      throw new Error('Master key must be a 256-bit hex string (64 characters)');
    }

    this.masterKey = Buffer.from(masterKey, 'hex');
    this.keyVersion = keyVersion;
    this.algorithm = 'aes-256-gcm';
    this.ivLength = 12; // 96 bits recommended for GCM
    this.authTagLength = 16; // 128 bits
  }

  /**
   * Encrypt a token using AES-256-GCM
   * @param {string} plaintext - The token to encrypt
   * @returns {string} Encrypted token in format: version:iv:authTag:ciphertext (base64url)
   * @throws {Error} If encryption fails
   */
  encrypt(plaintext) {
    try {
      if (!plaintext || typeof plaintext !== 'string') {
        throw new Error('Plaintext must be a non-empty string');
      }

      // Generate random IV (Initialization Vector)
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv, {
        authTagLength: this.authTagLength
      });

      // Encrypt
      let ciphertext = cipher.update(plaintext, 'utf8');
      ciphertext = Buffer.concat([ciphertext, cipher.final()]);

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Format: version:iv:authTag:ciphertext (all base64url encoded)
      const encrypted = [
        this.keyVersion,
        iv.toString('base64url'),
        authTag.toString('base64url'),
        ciphertext.toString('base64url')
      ].join(':');

      return encrypted;
    } catch (error) {
      throw new Error(`Token encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt a token using AES-256-GCM
   * @param {string} encrypted - Encrypted token in format: version:iv:authTag:ciphertext
   * @returns {string} Decrypted plaintext token
   * @throws {Error} If decryption fails or authentication fails
   */
  decrypt(encrypted) {
    try {
      if (!encrypted || typeof encrypted !== 'string') {
        throw new Error('Encrypted token must be a non-empty string');
      }

      // Parse encrypted format: version:iv:authTag:ciphertext
      const parts = encrypted.split(':');
      if (parts.length !== 4) {
        throw new Error('Invalid encrypted token format');
      }

      const [version, ivBase64, authTagBase64, ciphertextBase64] = parts;

      // Check key version
      if (version !== this.keyVersion) {
        throw new Error(`Key version mismatch: expected ${this.keyVersion}, got ${version}`);
      }

      // Decode components
      const iv = Buffer.from(ivBase64, 'base64url');
      const authTag = Buffer.from(authTagBase64, 'base64url');
      const ciphertext = Buffer.from(ciphertextBase64, 'base64url');

      // Validate lengths
      if (iv.length !== this.ivLength) {
        throw new Error(`Invalid IV length: expected ${this.ivLength}, got ${iv.length}`);
      }
      if (authTag.length !== this.authTagLength) {
        throw new Error(`Invalid auth tag length: expected ${this.authTagLength}, got ${authTag.length}`);
      }

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv, {
        authTagLength: this.authTagLength
      });

      // Set authentication tag
      decipher.setAuthTag(authTag);

      // Decrypt
      let plaintext = decipher.update(ciphertext);
      plaintext = Buffer.concat([plaintext, decipher.final()]);

      return plaintext.toString('utf8');
    } catch (error) {
      // Authentication failure or decryption error
      throw new Error(`Token decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt multiple tokens (batch operation)
   * @param {string[]} plaintexts - Array of tokens to encrypt
   * @returns {string[]} Array of encrypted tokens
   */
  encryptBatch(plaintexts) {
    if (!Array.isArray(plaintexts)) {
      throw new Error('Plaintexts must be an array');
    }
    return plaintexts.map(pt => this.encrypt(pt));
  }

  /**
   * Decrypt multiple tokens (batch operation)
   * @param {string[]} encryptedTokens - Array of encrypted tokens
   * @returns {string[]} Array of decrypted tokens
   */
  decryptBatch(encryptedTokens) {
    if (!Array.isArray(encryptedTokens)) {
      throw new Error('Encrypted tokens must be an array');
    }
    return encryptedTokens.map(et => this.decrypt(et));
  }

  /**
   * Generate a new random 256-bit master key
   * @returns {string} 256-bit key as hex string
   */
  static generateMasterKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate if a string is a valid encrypted token
   * @param {string} encrypted - Potential encrypted token
   * @returns {boolean} True if valid format
   */
  static isValidEncryptedToken(encrypted) {
    if (!encrypted || typeof encrypted !== 'string') {
      return false;
    }

    const parts = encrypted.split(':');
    if (parts.length !== 4) {
      return false;
    }

    try {
      // Try to decode each part
      Buffer.from(parts[1], 'base64url'); // IV
      Buffer.from(parts[2], 'base64url'); // authTag
      Buffer.from(parts[3], 'base64url'); // ciphertext
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Rotate encryption key by re-encrypting with new key
   * @param {string} encrypted - Token encrypted with old key
   * @param {TokenEncryptionService} newService - Service with new key
   * @returns {string} Token re-encrypted with new key
   */
  static rotateKey(encrypted, newService) {
    // Decrypt with old key (this service)
    const plaintext = this.decrypt(encrypted);

    // Encrypt with new key
    return newService.encrypt(plaintext);
  }

  /**
   * Get key version from encrypted token
   * @param {string} encrypted - Encrypted token
   * @returns {string|null} Key version or null if invalid
   */
  static getKeyVersion(encrypted) {
    if (!this.isValidEncryptedToken(encrypted)) {
      return null;
    }
    return encrypted.split(':')[0];
  }
}

module.exports = TokenEncryptionService;
