/**
 * Unit tests for ScheduledMeetingService
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { scheduledMeetingService, MEETING_STATUS, RECURRENCE_PATTERN } from '../ScheduledMeetingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test data directory
const TEST_DATA_DIR = path.join(__dirname, '../../../../data/scheduled-meetings-test');

describe('ScheduledMeetingService', () => {
  // Override data directory for tests
  beforeEach(async () => {
    // Create test data directory
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });
    // Override service data directory (not ideal, but works for testing)
    // In production, inject data directory via constructor
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('createMeeting', () => {
    it('should create a new meeting with required fields', async () => {
      const meetingData = {
        title: 'Test Meeting',
        startTime: new Date('2025-12-01T10:00:00Z').toISOString(),
        endTime: new Date('2025-12-01T11:00:00Z').toISOString(),
        timezone: 'UTC',
        organizerId: 'user-123',
        organizerEmail: 'organizer@example.com'
      };

      const meeting = await scheduledMeetingService.createMeeting(meetingData);

      expect(meeting).toBeDefined();
      expect(meeting.id).toBeDefined();
      expect(meeting.title).toBe('Test Meeting');
      expect(meeting.status).toBe(MEETING_STATUS.SCHEDULED);
      expect(meeting.roomId).toBeDefined();
      expect(meeting.joinUrl).toContain(meeting.roomId);
    });

    it('should throw error when missing required fields', async () => {
      const meetingData = {
        title: 'Test Meeting'
        // Missing other required fields
      };

      await expect(scheduledMeetingService.createMeeting(meetingData)).rejects.toThrow();
    });

    it('should create meeting with participants', async () => {
      const meetingData = {
        title: 'Test Meeting',
        startTime: new Date('2025-12-01T10:00:00Z').toISOString(),
        endTime: new Date('2025-12-01T11:00:00Z').toISOString(),
        timezone: 'UTC',
        organizerId: 'user-123',
        organizerEmail: 'organizer@example.com',
        participants: [
          { email: 'participant1@example.com', name: 'Participant 1' },
          { email: 'participant2@example.com', name: 'Participant 2' }
        ]
      };

      const meeting = await scheduledMeetingService.createMeeting(meetingData);

      expect(meeting.participants).toHaveLength(2);
      expect(meeting.participants[0].email).toBe('participant1@example.com');
      expect(meeting.participants[0].invitationStatus).toBe('pending');
    });

    it('should create meeting with reminders', async () => {
      const meetingData = {
        title: 'Test Meeting',
        startTime: new Date('2025-12-01T10:00:00Z').toISOString(),
        endTime: new Date('2025-12-01T11:00:00Z').toISOString(),
        timezone: 'UTC',
        organizerId: 'user-123',
        organizerEmail: 'organizer@example.com',
        reminders: [5, 15, 30]
      };

      const meeting = await scheduledMeetingService.createMeeting(meetingData);

      expect(meeting.reminders).toHaveLength(3);
      expect(meeting.reminders[0].reminderTime).toBe(5);
      expect(meeting.reminders[0].status).toBe('pending');
    });

    it('should generate passcode when required', async () => {
      const meetingData = {
        title: 'Test Meeting',
        startTime: new Date('2025-12-01T10:00:00Z').toISOString(),
        endTime: new Date('2025-12-01T11:00:00Z').toISOString(),
        timezone: 'UTC',
        organizerId: 'user-123',
        organizerEmail: 'organizer@example.com',
        requirePasscode: true
      };

      const meeting = await scheduledMeetingService.createMeeting(meetingData);

      expect(meeting.passcode).toBeDefined();
      expect(meeting.passcode).toHaveLength(6);
      expect(Number(meeting.passcode)).toBeGreaterThan(0);
    });
  });

  describe('getMeeting', () => {
    it('should retrieve existing meeting', async () => {
      const meetingData = {
        title: 'Test Meeting',
        startTime: new Date('2025-12-01T10:00:00Z').toISOString(),
        endTime: new Date('2025-12-01T11:00:00Z').toISOString(),
        timezone: 'UTC',
        organizerId: 'user-123',
        organizerEmail: 'organizer@example.com'
      };

      const created = await scheduledMeetingService.createMeeting(meetingData);
      const retrieved = await scheduledMeetingService.getMeeting(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.title).toBe('Test Meeting');
    });

    it('should return null for non-existent meeting', async () => {
      const meeting = await scheduledMeetingService.getMeeting('non-existent-id');
      expect(meeting).toBeNull();
    });
  });

  describe('updateMeeting', () => {
    it('should update meeting title', async () => {
      const meetingData = {
        title: 'Original Title',
        startTime: new Date('2025-12-01T10:00:00Z').toISOString(),
        endTime: new Date('2025-12-01T11:00:00Z').toISOString(),
        timezone: 'UTC',
        organizerId: 'user-123',
        organizerEmail: 'organizer@example.com'
      };

      const created = await scheduledMeetingService.createMeeting(meetingData);
      const updated = await scheduledMeetingService.updateMeeting(created.id, {
        title: 'Updated Title'
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.updatedAt).not.toBe(created.updatedAt);
    });

    it('should throw error when updating non-existent meeting', async () => {
      await expect(
        scheduledMeetingService.updateMeeting('non-existent-id', { title: 'New Title' })
      ).rejects.toThrow();
    });
  });

  describe('cancelMeeting', () => {
    it('should cancel meeting', async () => {
      const meetingData = {
        title: 'Test Meeting',
        startTime: new Date('2025-12-01T10:00:00Z').toISOString(),
        endTime: new Date('2025-12-01T11:00:00Z').toISOString(),
        timezone: 'UTC',
        organizerId: 'user-123',
        organizerEmail: 'organizer@example.com'
      };

      const created = await scheduledMeetingService.createMeeting(meetingData);
      const cancelled = await scheduledMeetingService.cancelMeeting(created.id);

      expect(cancelled.status).toBe(MEETING_STATUS.CANCELLED);
    });
  });

  describe('deleteMeeting', () => {
    it('should delete existing meeting', async () => {
      const meetingData = {
        title: 'Test Meeting',
        startTime: new Date('2025-12-01T10:00:00Z').toISOString(),
        endTime: new Date('2025-12-01T11:00:00Z').toISOString(),
        timezone: 'UTC',
        organizerId: 'user-123',
        organizerEmail: 'organizer@example.com'
      };

      const created = await scheduledMeetingService.createMeeting(meetingData);
      const deleted = await scheduledMeetingService.deleteMeeting(created.id);

      expect(deleted).toBe(true);

      const retrieved = await scheduledMeetingService.getMeeting(created.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent meeting', async () => {
      const deleted = await scheduledMeetingService.deleteMeeting('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('addParticipant', () => {
    it('should add participant to meeting', async () => {
      const meetingData = {
        title: 'Test Meeting',
        startTime: new Date('2025-12-01T10:00:00Z').toISOString(),
        endTime: new Date('2025-12-01T11:00:00Z').toISOString(),
        timezone: 'UTC',
        organizerId: 'user-123',
        organizerEmail: 'organizer@example.com'
      };

      const created = await scheduledMeetingService.createMeeting(meetingData);

      const updated = await scheduledMeetingService.addParticipant(created.id, {
        email: 'newparticipant@example.com',
        name: 'New Participant'
      });

      expect(updated.participants).toHaveLength(1);
      expect(updated.participants[0].email).toBe('newparticipant@example.com');
    });
  });

  describe('generateRecurringInstances', () => {
    it('should return single instance for non-recurring meeting', () => {
      const meeting = {
        id: 'meeting-1',
        title: 'Test Meeting',
        startTime: new Date('2025-12-01T10:00:00Z').toISOString(),
        endTime: new Date('2025-12-01T11:00:00Z').toISOString(),
        recurrencePattern: RECURRENCE_PATTERN.NONE
      };

      const instances = scheduledMeetingService.generateRecurringInstances(meeting, 10);

      expect(instances).toHaveLength(1);
      expect(instances[0]).toEqual(meeting);
    });

    it('should generate daily recurring instances', () => {
      const meeting = {
        id: 'meeting-1',
        title: 'Daily Meeting',
        startTime: new Date('2025-12-01T10:00:00Z').toISOString(),
        endTime: new Date('2025-12-01T11:00:00Z').toISOString(),
        recurrencePattern: RECURRENCE_PATTERN.DAILY,
        recurrenceEndDate: new Date('2025-12-10T10:00:00Z').toISOString()
      };

      const instances = scheduledMeetingService.generateRecurringInstances(meeting, 10);

      expect(instances.length).toBeGreaterThan(1);
      expect(instances.length).toBeLessThanOrEqual(10);

      // Check that instances are spaced 1 day apart
      const firstStart = new Date(instances[0].instanceStartTime);
      const secondStart = new Date(instances[1].instanceStartTime);
      const diffDays = (secondStart - firstStart) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(1);
    });

    it('should generate weekly recurring instances', () => {
      const meeting = {
        id: 'meeting-1',
        title: 'Weekly Meeting',
        startTime: new Date('2025-12-01T10:00:00Z').toISOString(),
        endTime: new Date('2025-12-01T11:00:00Z').toISOString(),
        recurrencePattern: RECURRENCE_PATTERN.WEEKLY
      };

      const instances = scheduledMeetingService.generateRecurringInstances(meeting, 5);

      expect(instances).toHaveLength(5);

      // Check that instances are spaced 7 days apart
      const firstStart = new Date(instances[0].instanceStartTime);
      const secondStart = new Date(instances[1].instanceStartTime);
      const diffDays = (secondStart - firstStart) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(7);
    });
  });
});
