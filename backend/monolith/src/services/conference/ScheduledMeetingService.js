/**
 * Scheduled Meeting Service
 *
 * Service for managing scheduled video conference meetings with calendar integration.
 * Handles meeting creation, updates, recurring meetings, invitations, and reminders.
 *
 * NOTE: Currently uses local file storage. For production, this requires backend
 * integration with the unified storage system (DronDoc API or database).
 *
 * @module ScheduledMeetingService
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory for scheduled meetings
const DATA_DIR = path.join(__dirname, '../../../data/scheduled-meetings');

/**
 * Meeting status enum
 */
export const MEETING_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

/**
 * Recurrence pattern enum
 */
export const RECURRENCE_PATTERN = {
  NONE: 'none',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom'
};

/**
 * Reminder time enum (minutes before meeting)
 */
export const REMINDER_TIME = {
  FIVE_MINUTES: 5,
  FIFTEEN_MINUTES: 15,
  THIRTY_MINUTES: 30,
  ONE_HOUR: 60,
  ONE_DAY: 1440
};

/**
 * Database Schema Documentation
 *
 * This service requires the following database tables:
 *
 * scheduled_meetings:
 *   - id (UUID, PRIMARY KEY)
 *   - title (VARCHAR(255), NOT NULL)
 *   - description (TEXT)
 *   - start_time (TIMESTAMP WITH TIMEZONE, NOT NULL)
 *   - end_time (TIMESTAMP WITH TIMEZONE, NOT NULL)
 *   - timezone (VARCHAR(100), NOT NULL)
 *   - room_id (VARCHAR(255), UNIQUE, NOT NULL) - Video conference room ID
 *   - organizer_id (VARCHAR(255), NOT NULL) - User ID of organizer
 *   - organizer_email (VARCHAR(255), NOT NULL)
 *   - status (ENUM: scheduled, in_progress, completed, cancelled)
 *   - recurrence_pattern (ENUM: none, daily, weekly, monthly, custom)
 *   - recurrence_end_date (TIMESTAMP WITH TIMEZONE)
 *   - recurrence_rules (JSONB) - Detailed recurrence rules
 *   - join_url (TEXT, NOT NULL) - URL to join the meeting
 *   - passcode (VARCHAR(50)) - Optional meeting passcode
 *   - created_at (TIMESTAMP WITH TIMEZONE, DEFAULT NOW())
 *   - updated_at (TIMESTAMP WITH TIMEZONE, DEFAULT NOW())
 *
 * meeting_participants:
 *   - id (UUID, PRIMARY KEY)
 *   - meeting_id (UUID, FOREIGN KEY → scheduled_meetings.id)
 *   - user_id (VARCHAR(255))
 *   - email (VARCHAR(255), NOT NULL)
 *   - name (VARCHAR(255))
 *   - role (ENUM: organizer, co-host, participant)
 *   - invitation_status (ENUM: pending, accepted, declined, tentative)
 *   - invitation_sent_at (TIMESTAMP WITH TIMEZONE)
 *   - response_at (TIMESTAMP WITH TIMEZONE)
 *   - created_at (TIMESTAMP WITH TIMEZONE, DEFAULT NOW())
 *
 * meeting_reminders:
 *   - id (UUID, PRIMARY KEY)
 *   - meeting_id (UUID, FOREIGN KEY → scheduled_meetings.id)
 *   - recipient_email (VARCHAR(255), NOT NULL)
 *   - reminder_time (INTEGER, NOT NULL) - Minutes before meeting
 *   - scheduled_at (TIMESTAMP WITH TIMEZONE, NOT NULL) - Calculated time to send
 *   - sent_at (TIMESTAMP WITH TIMEZONE) - NULL if not sent yet
 *   - status (ENUM: pending, sent, failed)
 *   - created_at (TIMESTAMP WITH TIMEZONE, DEFAULT NOW())
 *
 * calendar_integrations:
 *   - id (UUID, PRIMARY KEY)
 *   - user_id (VARCHAR(255), NOT NULL)
 *   - provider (ENUM: google, microsoft, ical)
 *   - access_token (TEXT) - Encrypted
 *   - refresh_token (TEXT) - Encrypted
 *   - token_expiry (TIMESTAMP WITH TIMEZONE)
 *   - calendar_id (VARCHAR(255)) - External calendar ID
 *   - enabled (BOOLEAN, DEFAULT TRUE)
 *   - created_at (TIMESTAMP WITH TIMEZONE, DEFAULT NOW())
 *   - updated_at (TIMESTAMP WITH TIMEZONE, DEFAULT NOW())
 */

/**
 * Scheduled Meeting Service Class
 */
class ScheduledMeetingService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize service (create data directory)
   */
  async initialize() {
    if (this.initialized) return;

    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      this.initialized = true;
      logger.info('ScheduledMeetingService initialized');
    } catch (error) {
      logger.error('Failed to initialize ScheduledMeetingService:', error);
      throw error;
    }
  }

  /**
   * Generate unique meeting ID
   * @private
   */
  _generateMeetingId() {
    return crypto.randomUUID();
  }

  /**
   * Generate unique room ID for video conference
   * @private
   */
  _generateRoomId() {
    // Generate a readable room ID (e.g., "meet-abc-def-123")
    const random = crypto.randomBytes(6).toString('hex');
    return `meet-${random.slice(0, 3)}-${random.slice(3, 6)}-${random.slice(6)}`;
  }

  /**
   * Generate meeting passcode
   * @private
   */
  _generatePasscode() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  }

  /**
   * Get file path for meeting data
   * @private
   */
  _getMeetingFilePath(meetingId) {
    return path.join(DATA_DIR, `${meetingId}.json`);
  }

  /**
   * Get index file path
   * @private
   */
  _getIndexFilePath() {
    return path.join(DATA_DIR, 'index.json');
  }

  /**
   * Load meeting index
   * @private
   */
  async _loadIndex() {
    try {
      const indexPath = this._getIndexFilePath();
      const data = await fs.readFile(indexPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { meetings: [], lastUpdated: new Date().toISOString() };
      }
      throw error;
    }
  }

  /**
   * Save meeting index
   * @private
   */
  async _saveIndex(index) {
    const indexPath = this._getIndexFilePath();
    index.lastUpdated = new Date().toISOString();
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
  }

  /**
   * Create a scheduled meeting
   *
   * @param {Object} meetingData - Meeting data
   * @param {string} meetingData.title - Meeting title
   * @param {string} meetingData.description - Meeting description
   * @param {string} meetingData.startTime - ISO 8601 start time
   * @param {string} meetingData.endTime - ISO 8601 end time
   * @param {string} meetingData.timezone - Timezone (e.g., "America/New_York")
   * @param {string} meetingData.organizerId - Organizer user ID
   * @param {string} meetingData.organizerEmail - Organizer email
   * @param {Array<Object>} meetingData.participants - Array of participant objects
   * @param {string} meetingData.recurrencePattern - Recurrence pattern
   * @param {string} meetingData.recurrenceEndDate - Recurrence end date (ISO 8601)
   * @param {Object} meetingData.recurrenceRules - Detailed recurrence rules
   * @param {Array<number>} meetingData.reminders - Reminder times (minutes before)
   * @param {boolean} meetingData.requirePasscode - Whether to require passcode
   * @returns {Promise<Object>} Created meeting object
   */
  async createMeeting(meetingData) {
    await this.initialize();

    const {
      title,
      description = '',
      startTime,
      endTime,
      timezone,
      organizerId,
      organizerEmail,
      participants = [],
      recurrencePattern = RECURRENCE_PATTERN.NONE,
      recurrenceEndDate = null,
      recurrenceRules = null,
      reminders = [REMINDER_TIME.FIFTEEN_MINUTES],
      requirePasscode = false
    } = meetingData;

    // Validation
    if (!title || !startTime || !endTime || !timezone || !organizerId || !organizerEmail) {
      throw new Error('Missing required fields: title, startTime, endTime, timezone, organizerId, organizerEmail');
    }

    const meetingId = this._generateMeetingId();
    const roomId = this._generateRoomId();
    const passcode = requirePasscode ? this._generatePasscode() : null;
    const joinUrl = `${process.env.APP_URL || 'https://drondoc.ru'}/videoconference/${roomId}`;

    const meeting = {
      id: meetingId,
      title,
      description,
      startTime,
      endTime,
      timezone,
      roomId,
      organizerId,
      organizerEmail,
      status: MEETING_STATUS.SCHEDULED,
      recurrencePattern,
      recurrenceEndDate,
      recurrenceRules,
      joinUrl,
      passcode,
      participants: participants.map(p => ({
        id: crypto.randomUUID(),
        meetingId,
        userId: p.userId || null,
        email: p.email,
        name: p.name || '',
        role: p.role || 'participant',
        invitationStatus: 'pending',
        invitationSentAt: null,
        responseAt: null,
        createdAt: new Date().toISOString()
      })),
      reminders: reminders.map(minutes => ({
        id: crypto.randomUUID(),
        meetingId,
        reminderTime: minutes,
        scheduledAt: this._calculateReminderTime(startTime, minutes),
        status: 'pending',
        createdAt: new Date().toISOString()
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save meeting
    const meetingPath = this._getMeetingFilePath(meetingId);
    await fs.writeFile(meetingPath, JSON.stringify(meeting, null, 2));

    // Update index
    const index = await this._loadIndex();
    index.meetings.push({
      id: meetingId,
      title,
      startTime,
      organizerId,
      status: meeting.status
    });
    await this._saveIndex(index);

    logger.info(`Created scheduled meeting: ${meetingId} (${title})`);

    return meeting;
  }

  /**
   * Calculate reminder time
   * @private
   */
  _calculateReminderTime(startTime, minutesBefore) {
    const start = new Date(startTime);
    const reminderTime = new Date(start.getTime() - minutesBefore * 60000);
    return reminderTime.toISOString();
  }

  /**
   * Get meeting by ID
   *
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Object|null>} Meeting object or null
   */
  async getMeeting(meetingId) {
    await this.initialize();

    try {
      const meetingPath = this._getMeetingFilePath(meetingId);
      const data = await fs.readFile(meetingPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get meetings by organizer
   *
   * @param {string} organizerId - Organizer user ID
   * @param {Object} options - Query options
   * @param {string} options.status - Filter by status
   * @param {string} options.startDate - Filter meetings after this date
   * @param {string} options.endDate - Filter meetings before this date
   * @returns {Promise<Array<Object>>} Array of meetings
   */
  async getMeetingsByOrganizer(organizerId, options = {}) {
    await this.initialize();

    const index = await this._loadIndex();
    let meetingIds = index.meetings
      .filter(m => m.organizerId === organizerId)
      .map(m => m.id);

    // Apply filters
    if (options.status) {
      meetingIds = meetingIds.filter(id => {
        const meeting = index.meetings.find(m => m.id === id);
        return meeting && meeting.status === options.status;
      });
    }

    // Load full meeting data
    const meetings = [];
    for (const id of meetingIds) {
      const meeting = await this.getMeeting(id);
      if (meeting) {
        // Apply date filters
        if (options.startDate && new Date(meeting.startTime) < new Date(options.startDate)) {
          continue;
        }
        if (options.endDate && new Date(meeting.endTime) > new Date(options.endDate)) {
          continue;
        }
        meetings.push(meeting);
      }
    }

    return meetings;
  }

  /**
   * Update meeting
   *
   * @param {string} meetingId - Meeting ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated meeting
   */
  async updateMeeting(meetingId, updates) {
    await this.initialize();

    const meeting = await this.getMeeting(meetingId);
    if (!meeting) {
      throw new Error(`Meeting not found: ${meetingId}`);
    }

    // Update allowed fields
    const allowedUpdates = [
      'title', 'description', 'startTime', 'endTime', 'timezone',
      'recurrencePattern', 'recurrenceEndDate', 'recurrenceRules',
      'status', 'passcode'
    ];

    for (const key of allowedUpdates) {
      if (key in updates) {
        meeting[key] = updates[key];
      }
    }

    meeting.updatedAt = new Date().toISOString();

    // Save updated meeting
    const meetingPath = this._getMeetingFilePath(meetingId);
    await fs.writeFile(meetingPath, JSON.stringify(meeting, null, 2));

    // Update index if status changed
    if (updates.status) {
      const index = await this._loadIndex();
      const indexEntry = index.meetings.find(m => m.id === meetingId);
      if (indexEntry) {
        indexEntry.status = updates.status;
        await this._saveIndex(index);
      }
    }

    logger.info(`Updated meeting: ${meetingId}`);

    return meeting;
  }

  /**
   * Cancel meeting
   *
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Object>} Cancelled meeting
   */
  async cancelMeeting(meetingId) {
    return this.updateMeeting(meetingId, { status: MEETING_STATUS.CANCELLED });
  }

  /**
   * Delete meeting
   *
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteMeeting(meetingId) {
    await this.initialize();

    const meetingPath = this._getMeetingFilePath(meetingId);

    try {
      await fs.unlink(meetingPath);

      // Update index
      const index = await this._loadIndex();
      index.meetings = index.meetings.filter(m => m.id !== meetingId);
      await this._saveIndex(index);

      logger.info(`Deleted meeting: ${meetingId}`);

      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Add participant to meeting
   *
   * @param {string} meetingId - Meeting ID
   * @param {Object} participant - Participant data
   * @returns {Promise<Object>} Updated meeting
   */
  async addParticipant(meetingId, participant) {
    await this.initialize();

    const meeting = await this.getMeeting(meetingId);
    if (!meeting) {
      throw new Error(`Meeting not found: ${meetingId}`);
    }

    const newParticipant = {
      id: crypto.randomUUID(),
      meetingId,
      userId: participant.userId || null,
      email: participant.email,
      name: participant.name || '',
      role: participant.role || 'participant',
      invitationStatus: 'pending',
      invitationSentAt: null,
      responseAt: null,
      createdAt: new Date().toISOString()
    };

    meeting.participants.push(newParticipant);
    meeting.updatedAt = new Date().toISOString();

    const meetingPath = this._getMeetingFilePath(meetingId);
    await fs.writeFile(meetingPath, JSON.stringify(meeting, null, 2));

    logger.info(`Added participant to meeting ${meetingId}: ${participant.email}`);

    return meeting;
  }

  /**
   * Update participant invitation status
   *
   * @param {string} meetingId - Meeting ID
   * @param {string} participantId - Participant ID
   * @param {string} status - Invitation status (accepted, declined, tentative)
   * @returns {Promise<Object>} Updated meeting
   */
  async updateParticipantStatus(meetingId, participantId, status) {
    await this.initialize();

    const meeting = await this.getMeeting(meetingId);
    if (!meeting) {
      throw new Error(`Meeting not found: ${meetingId}`);
    }

    const participant = meeting.participants.find(p => p.id === participantId);
    if (!participant) {
      throw new Error(`Participant not found: ${participantId}`);
    }

    participant.invitationStatus = status;
    participant.responseAt = new Date().toISOString();
    meeting.updatedAt = new Date().toISOString();

    const meetingPath = this._getMeetingFilePath(meetingId);
    await fs.writeFile(meetingPath, JSON.stringify(meeting, null, 2));

    logger.info(`Updated participant status in meeting ${meetingId}: ${participantId} → ${status}`);

    return meeting;
  }

  /**
   * Get pending reminders (to be sent)
   *
   * @returns {Promise<Array<Object>>} Array of pending reminders with meeting data
   */
  async getPendingReminders() {
    await this.initialize();

    const now = new Date();
    const index = await this._loadIndex();
    const pendingReminders = [];

    for (const indexEntry of index.meetings) {
      if (indexEntry.status !== MEETING_STATUS.SCHEDULED) {
        continue;
      }

      const meeting = await this.getMeeting(indexEntry.id);
      if (!meeting) continue;

      for (const reminder of meeting.reminders || []) {
        if (reminder.status === 'pending' && new Date(reminder.scheduledAt) <= now) {
          pendingReminders.push({
            reminder,
            meeting: {
              id: meeting.id,
              title: meeting.title,
              startTime: meeting.startTime,
              joinUrl: meeting.joinUrl,
              participants: meeting.participants
            }
          });
        }
      }
    }

    return pendingReminders;
  }

  /**
   * Mark reminder as sent
   *
   * @param {string} meetingId - Meeting ID
   * @param {string} reminderId - Reminder ID
   * @returns {Promise<Object>} Updated meeting
   */
  async markReminderSent(meetingId, reminderId) {
    await this.initialize();

    const meeting = await this.getMeeting(meetingId);
    if (!meeting) {
      throw new Error(`Meeting not found: ${meetingId}`);
    }

    const reminder = meeting.reminders.find(r => r.id === reminderId);
    if (!reminder) {
      throw new Error(`Reminder not found: ${reminderId}`);
    }

    reminder.status = 'sent';
    reminder.sentAt = new Date().toISOString();
    meeting.updatedAt = new Date().toISOString();

    const meetingPath = this._getMeetingFilePath(meetingId);
    await fs.writeFile(meetingPath, JSON.stringify(meeting, null, 2));

    return meeting;
  }

  /**
   * Generate recurring meeting instances
   *
   * @param {Object} meeting - Base meeting object
   * @param {number} instanceCount - Number of instances to generate
   * @returns {Array<Object>} Array of meeting instances
   */
  generateRecurringInstances(meeting, instanceCount = 10) {
    if (meeting.recurrencePattern === RECURRENCE_PATTERN.NONE) {
      return [meeting];
    }

    const instances = [];
    const startDate = new Date(meeting.startTime);
    const endDate = new Date(meeting.endTime);
    const duration = endDate - startDate;

    const endRecurrence = meeting.recurrenceEndDate
      ? new Date(meeting.recurrenceEndDate)
      : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year max

    let currentStart = new Date(startDate);

    for (let i = 0; i < instanceCount; i++) {
      if (currentStart > endRecurrence) break;

      const instance = {
        ...meeting,
        instanceStartTime: currentStart.toISOString(),
        instanceEndTime: new Date(currentStart.getTime() + duration).toISOString(),
        instanceNumber: i + 1
      };

      instances.push(instance);

      // Calculate next occurrence
      switch (meeting.recurrencePattern) {
        case RECURRENCE_PATTERN.DAILY:
          currentStart.setDate(currentStart.getDate() + 1);
          break;
        case RECURRENCE_PATTERN.WEEKLY:
          currentStart.setDate(currentStart.getDate() + 7);
          break;
        case RECURRENCE_PATTERN.MONTHLY:
          currentStart.setMonth(currentStart.getMonth() + 1);
          break;
        default:
          // Custom recurrence - use recurrenceRules
          if (meeting.recurrenceRules?.interval) {
            currentStart.setDate(currentStart.getDate() + meeting.recurrenceRules.interval);
          } else {
            break;
          }
      }
    }

    return instances;
  }
}

// Singleton instance
export const scheduledMeetingService = new ScheduledMeetingService();

export default scheduledMeetingService;
