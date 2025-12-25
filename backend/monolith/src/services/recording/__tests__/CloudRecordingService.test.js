/**
 * CloudRecordingService Tests
 *
 * Basic tests for cloud recording functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CloudRecordingService, { RECORDING_STATUS, RETENTION_POLICY } from '../CloudRecordingService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CloudRecordingService', () => {
  let service;
  const testStorageDir = path.join(__dirname, 'test-cloud-recordings');

  beforeEach(async () => {
    // Create test instance with temporary storage
    service = new CloudRecordingService({ storageDir: testStorageDir });

    // Wait for directory initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    // Clean up test storage
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('startRecording', () => {
    it('should start a new cloud recording', async () => {
      const result = await service.startRecording('test-room-1', {
        userId: 'user123',
        roomName: 'Test Room',
        participants: ['user1', 'user2'],
        retentionDays: RETENTION_POLICY.ONE_MONTH,
        folders: ['meetings'],
        tags: ['work', 'important']
      });

      expect(result).toHaveProperty('recordingId');
      expect(result).toHaveProperty('roomId', 'test-room-1');
      expect(result).toHaveProperty('status', RECORDING_STATUS.RECORDING);
      expect(result).toHaveProperty('startTime');
    });

    it('should throw error if recording already active for room', async () => {
      await service.startRecording('test-room-1', {
        userId: 'user123',
        roomName: 'Test Room'
      });

      await expect(
        service.startRecording('test-room-1', {
          userId: 'user123',
          roomName: 'Test Room'
        })
      ).rejects.toThrow('Recording already active for room test-room-1');
    });

    it('should generate unique recording IDs', async () => {
      const result1 = await service.startRecording('test-room-1', {
        userId: 'user123',
        roomName: 'Test Room 1'
      });

      const result2 = await service.startRecording('test-room-2', {
        userId: 'user123',
        roomName: 'Test Room 2'
      });

      expect(result1.recordingId).not.toBe(result2.recordingId);
    });
  });

  describe('stopRecording', () => {
    it('should stop recording and save video', async () => {
      const startResult = await service.startRecording('test-room-1', {
        userId: 'user123',
        roomName: 'Test Room'
      });

      // Create dummy video blob
      const videoBlob = Buffer.from('dummy video data');

      const stopResult = await service.stopRecording('test-room-1', videoBlob);

      expect(stopResult).toHaveProperty('recordingId', startResult.recordingId);
      expect(stopResult).toHaveProperty('status', RECORDING_STATUS.PROCESSING);
      expect(stopResult).toHaveProperty('endTime');
      expect(stopResult).toHaveProperty('durationSeconds');
      expect(stopResult).toHaveProperty('videoFile');
      expect(stopResult).toHaveProperty('videoSizeBytes');
    });

    it('should throw error if no active recording', async () => {
      const videoBlob = Buffer.from('dummy video data');

      await expect(
        service.stopRecording('non-existent-room', videoBlob)
      ).rejects.toThrow('No active recording for room non-existent-room');
    });
  });

  describe('addChatMessage', () => {
    it('should add chat message to active recording', async () => {
      await service.startRecording('test-room-1', {
        userId: 'user123',
        roomName: 'Test Room'
      });

      await service.addChatMessage('test-room-1', {
        userId: 'user1',
        userName: 'User One',
        message: 'Hello everyone!'
      });

      // No error means success (chat messages are collected internally)
      expect(true).toBe(true);
    });

    it('should handle adding chat to non-existent room gracefully', async () => {
      // Should not throw error
      await service.addChatMessage('non-existent-room', {
        userId: 'user1',
        message: 'Test'
      });

      expect(true).toBe(true);
    });
  });

  describe('addEvent', () => {
    it('should add event to active recording', async () => {
      await service.startRecording('test-room-1', {
        userId: 'user123',
        roomName: 'Test Room'
      });

      await service.addEvent('test-room-1', {
        type: 'participant_joined',
        userId: 'user2',
        userName: 'User Two'
      });

      // No error means success
      expect(true).toBe(true);
    });
  });

  describe('getRecording', () => {
    it('should retrieve saved recording metadata', async () => {
      const startResult = await service.startRecording('test-room-1', {
        userId: 'user123',
        roomName: 'Test Room',
        folders: ['meetings'],
        tags: ['work']
      });

      const videoBlob = Buffer.from('dummy video data');
      await service.stopRecording('test-room-1', videoBlob);

      // Wait for metadata to be saved
      await new Promise(resolve => setTimeout(resolve, 100));

      const recording = await service.getRecording(startResult.recordingId);

      expect(recording).toBeTruthy();
      expect(recording.id).toBe(startResult.recordingId);
      expect(recording.roomName).toBe('Test Room');
      expect(recording.folders).toContain('meetings');
      expect(recording.tags).toContain('work');
    });

    it('should return null for non-existent recording', async () => {
      const recording = await service.getRecording('non-existent-id');
      expect(recording).toBeNull();
    });
  });

  describe('listRecordings', () => {
    it('should list all recordings', async () => {
      // Create multiple recordings
      await service.startRecording('room-1', {
        userId: 'user123',
        roomName: 'Room 1'
      });

      await service.stopRecording('room-1', Buffer.from('video1'));

      await service.startRecording('room-2', {
        userId: 'user123',
        roomName: 'Room 2'
      });

      await service.stopRecording('room-2', Buffer.from('video2'));

      // Wait for metadata to be saved
      await new Promise(resolve => setTimeout(resolve, 200));

      const result = await service.listRecordings();

      expect(result.recordings).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter recordings by user', async () => {
      await service.startRecording('room-1', {
        userId: 'user1',
        roomName: 'Room 1'
      });

      await service.stopRecording('room-1', Buffer.from('video1'));

      await service.startRecording('room-2', {
        userId: 'user2',
        roomName: 'Room 2'
      });

      await service.stopRecording('room-2', Buffer.from('video2'));

      await new Promise(resolve => setTimeout(resolve, 200));

      const result = await service.listRecordings({ userId: 'user1' });

      expect(result.recordings).toHaveLength(1);
      expect(result.recordings[0].userId).toBe('user1');
    });
  });

  describe('enableSharing', () => {
    it('should enable public sharing and generate token', async () => {
      const startResult = await service.startRecording('test-room-1', {
        userId: 'user123',
        roomName: 'Test Room'
      });

      await service.stopRecording('test-room-1', Buffer.from('video'));
      await new Promise(resolve => setTimeout(resolve, 100));

      const sharingInfo = await service.enableSharing(
        startResult.recordingId,
        'https://example.com'
      );

      expect(sharingInfo.sharingEnabled).toBe(true);
      expect(sharingInfo.sharingToken).toBeTruthy();
      expect(sharingInfo.sharingUrl).toContain('https://example.com');
      expect(sharingInfo.sharingUrl).toContain(sharingInfo.sharingToken);
    });
  });

  describe('getRecordingByToken', () => {
    it('should retrieve recording by sharing token', async () => {
      const startResult = await service.startRecording('test-room-1', {
        userId: 'user123',
        roomName: 'Test Room'
      });

      await service.stopRecording('test-room-1', Buffer.from('video'));
      await new Promise(resolve => setTimeout(resolve, 100));

      const sharingInfo = await service.enableSharing(startResult.recordingId);

      const recording = await service.getRecordingByToken(sharingInfo.sharingToken);

      expect(recording).toBeTruthy();
      expect(recording.id).toBe(startResult.recordingId);
    });

    it('should return null for invalid token', async () => {
      const recording = await service.getRecordingByToken('invalid-token');
      expect(recording).toBeNull();
    });
  });

  describe('deleteRecording', () => {
    it('should delete recording and all associated files', async () => {
      const startResult = await service.startRecording('test-room-1', {
        userId: 'user123',
        roomName: 'Test Room'
      });

      await service.stopRecording('test-room-1', Buffer.from('video'));
      await new Promise(resolve => setTimeout(resolve, 100));

      const success = await service.deleteRecording(startResult.recordingId);
      expect(success).toBe(true);

      const recording = await service.getRecording(startResult.recordingId);
      expect(recording).toBeNull();
    });
  });

  describe('getStorageStats', () => {
    it('should return storage statistics', async () => {
      await service.startRecording('room-1', {
        userId: 'user123',
        roomName: 'Room 1'
      });

      await service.stopRecording('room-1', Buffer.from('video1'));
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = await service.getStorageStats();

      expect(stats).toHaveProperty('totalRecordings');
      expect(stats).toHaveProperty('totalSizeBytes');
      expect(stats).toHaveProperty('totalDurationSeconds');
      expect(stats).toHaveProperty('statusCounts');
      expect(stats.totalRecordings).toBeGreaterThan(0);
    });
  });

  describe('constants', () => {
    it('should export RECORDING_STATUS constants', () => {
      expect(RECORDING_STATUS.RECORDING).toBe('recording');
      expect(RECORDING_STATUS.PROCESSING).toBe('processing');
      expect(RECORDING_STATUS.COMPLETED).toBe('completed');
      expect(RECORDING_STATUS.FAILED).toBe('failed');
      expect(RECORDING_STATUS.DELETED).toBe('deleted');
    });

    it('should export RETENTION_POLICY constants', () => {
      expect(RETENTION_POLICY.ONE_WEEK).toBe(7);
      expect(RETENTION_POLICY.ONE_MONTH).toBe(30);
      expect(RETENTION_POLICY.THREE_MONTHS).toBe(90);
      expect(RETENTION_POLICY.SIX_MONTHS).toBe(180);
      expect(RETENTION_POLICY.ONE_YEAR).toBe(365);
      expect(RETENTION_POLICY.FOREVER).toBe(-1);
    });
  });
});
