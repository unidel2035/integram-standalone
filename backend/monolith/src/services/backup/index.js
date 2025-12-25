/**
 * Backup Service Module
 *
 * Exports all backup-related services and utilities
 *
 * @module services/backup
 */

import BackupService from './BackupService.js';
import { createEncryption } from './encryption.js';
import { createStorage } from './storage.js';

export { BackupService, createEncryption, createStorage };
export default BackupService;
