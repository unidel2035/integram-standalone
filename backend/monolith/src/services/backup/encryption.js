/**
 * Backup Encryption Utility
 *
 * Provides AES-256-GCM encryption/decryption for backup files
 *
 * Features:
 * - AES-256-GCM encryption (authenticated encryption)
 * - Unique IV per encryption
 * - PBKDF2 key derivation from master key
 * - Streaming encryption for large files
 * - Automatic integrity verification
 *
 * @module services/backup/encryption
 */

import crypto from 'crypto';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('BackupEncryption');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

class BackupEncryption {
  constructor(masterKey) {
    if (!masterKey) {
      throw new Error('Master encryption key is required');
    }
    this.masterKey = masterKey;
  }

  /**
   * Derive encryption key from master key using PBKDF2
   * @param {string} masterKey - Master encryption key
   * @param {Buffer} salt - Random salt
   * @returns {Promise<Buffer>} Derived key
   */
  async deriveKey(masterKey, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        masterKey,
        salt,
        PBKDF2_ITERATIONS,
        KEY_LENGTH,
        'sha256',
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        }
      );
    });
  }

  /**
   * Encrypt a file using AES-256-GCM
   * @param {string} inputPath - Path to input file
   * @param {string} outputPath - Path to encrypted output file
   * @returns {Promise<Object>} Encryption metadata
   */
  async encryptFile(inputPath, outputPath) {
    try {
      logger.info(`Encrypting file: ${inputPath} -> ${outputPath}`);

      // Generate random salt and IV
      const salt = crypto.randomBytes(SALT_LENGTH);
      const iv = crypto.randomBytes(IV_LENGTH);

      // Derive encryption key
      const key = await this.deriveKey(this.masterKey, salt);

      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

      // Create streams
      const input = fs.createReadStream(inputPath);
      const output = fs.createWriteStream(outputPath);

      // Write header: [SALT (32 bytes)][IV (16 bytes)]
      output.write(salt);
      output.write(iv);

      // Encrypt file
      await pipeline(
        input,
        cipher,
        output
      );

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Append auth tag to file
      await fs.promises.appendFile(outputPath, authTag);

      // Get file stats
      const inputStats = await fs.promises.stat(inputPath);
      const outputStats = await fs.promises.stat(outputPath);

      const metadata = {
        algorithm: ALGORITHM,
        inputSize: inputStats.size,
        outputSize: outputStats.size,
        encrypted: true,
        timestamp: new Date().toISOString()
      };

      logger.info(`File encrypted successfully: ${inputPath}`);

      return metadata;
    } catch (error) {
      logger.error(`Encryption failed: ${error.message}`, { error, inputPath, outputPath });
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt a file using AES-256-GCM
   * @param {string} inputPath - Path to encrypted file
   * @param {string} outputPath - Path to decrypted output file
   * @returns {Promise<Object>} Decryption metadata
   */
  async decryptFile(inputPath, outputPath) {
    try {
      logger.info(`Decrypting file: ${inputPath} -> ${outputPath}`);

      // Read file header
      const fd = await fs.promises.open(inputPath, 'r');

      // Read salt
      const saltBuffer = Buffer.alloc(SALT_LENGTH);
      await fd.read(saltBuffer, 0, SALT_LENGTH, 0);

      // Read IV
      const ivBuffer = Buffer.alloc(IV_LENGTH);
      await fd.read(ivBuffer, 0, IV_LENGTH, SALT_LENGTH);

      // Derive encryption key
      const key = await this.deriveKey(this.masterKey, saltBuffer);

      // Get file size and calculate encrypted data size
      const stats = await fs.promises.stat(inputPath);
      const encryptedDataSize = stats.size - SALT_LENGTH - IV_LENGTH - AUTH_TAG_LENGTH;

      // Read auth tag (last 16 bytes)
      const authTagBuffer = Buffer.alloc(AUTH_TAG_LENGTH);
      await fd.read(authTagBuffer, 0, AUTH_TAG_LENGTH, stats.size - AUTH_TAG_LENGTH);

      await fd.close();

      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
      decipher.setAuthTag(authTagBuffer);

      // Create read stream (skip header, exclude auth tag)
      const input = fs.createReadStream(inputPath, {
        start: SALT_LENGTH + IV_LENGTH,
        end: SALT_LENGTH + IV_LENGTH + encryptedDataSize - 1
      });

      const output = fs.createWriteStream(outputPath);

      // Decrypt file
      await pipeline(
        input,
        decipher,
        output
      );

      // Get file stats
      const outputStats = await fs.promises.stat(outputPath);

      const metadata = {
        algorithm: ALGORITHM,
        inputSize: stats.size,
        outputSize: outputStats.size,
        decrypted: true,
        timestamp: new Date().toISOString()
      };

      logger.info(`File decrypted successfully: ${inputPath}`);

      return metadata;
    } catch (error) {
      logger.error(`Decryption failed: ${error.message}`, { error, inputPath, outputPath });

      // Clean up partial output file
      try {
        await fs.promises.unlink(outputPath);
      } catch {}

      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt data in memory (for small data)
   * @param {Buffer|string} data - Data to encrypt
   * @returns {Object} Encrypted data and metadata
   */
  encryptData(data) {
    try {
      const salt = crypto.randomBytes(SALT_LENGTH);
      const iv = crypto.randomBytes(IV_LENGTH);
      const key = crypto.pbkdf2Sync(this.masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');

      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

      const encrypted = Buffer.concat([
        cipher.update(data),
        cipher.final()
      ]);

      const authTag = cipher.getAuthTag();

      // Combine: salt + iv + encrypted data + auth tag
      const combined = Buffer.concat([salt, iv, encrypted, authTag]);

      return {
        data: combined,
        size: combined.length,
        algorithm: ALGORITHM
      };
    } catch (error) {
      logger.error(`Data encryption failed: ${error.message}`, { error });
      throw new Error(`Data encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data in memory (for small data)
   * @param {Buffer} encryptedData - Encrypted data
   * @returns {Buffer} Decrypted data
   */
  decryptData(encryptedData) {
    try {
      // Extract components
      const salt = encryptedData.slice(0, SALT_LENGTH);
      const iv = encryptedData.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const authTag = encryptedData.slice(-AUTH_TAG_LENGTH);
      const encrypted = encryptedData.slice(SALT_LENGTH + IV_LENGTH, -AUTH_TAG_LENGTH);

      // Derive key
      const key = crypto.pbkdf2Sync(this.masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');

      // Decrypt
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      return decrypted;
    } catch (error) {
      logger.error(`Data decryption failed: ${error.message}`, { error });
      throw new Error(`Data decryption failed: ${error.message}`);
    }
  }

  /**
   * Calculate SHA-256 checksum of a file
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} Hex-encoded checksum
   */
  async calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Verify file checksum
   * @param {string} filePath - Path to file
   * @param {string} expectedChecksum - Expected checksum
   * @returns {Promise<boolean>} True if checksum matches
   */
  async verifyChecksum(filePath, expectedChecksum) {
    const actualChecksum = await this.calculateChecksum(filePath);
    return actualChecksum === expectedChecksum;
  }
}

/**
 * Create a BackupEncryption instance
 * @param {string} masterKey - Master encryption key
 * @returns {BackupEncryption}
 */
export function createEncryption(masterKey) {
  return new BackupEncryption(masterKey);
}

export default BackupEncryption;
