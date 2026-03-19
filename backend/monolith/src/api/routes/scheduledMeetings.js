/**
 * Scheduled Meetings API Routes
 *
 * REST API for managing scheduled video conference meetings with calendar integration.
 * Provides endpoints for creating, updating, and managing scheduled meetings.
 *
 * @module routes/scheduledMeetings
 */

import express from 'express';
import { scheduledMeetingService, MEETING_STATUS, RECURRENCE_PATTERN, REMINDER_TIME } from '../../services/conference/ScheduledMeetingService.js';
import logger from '../../utils/logger.js';

/**
 * Create scheduled meetings routes
 *
 * @returns {express.Router} - Express router
 */
export function createScheduledMeetingsRoutes() {
  const router = express.Router();

  /**
   * POST /api/scheduled-meetings
   * Create a new scheduled meeting
   */
  router.post('/', async (req, res) => {
    try {
      const meetingData = req.body;

      // Validate required fields
      if (!meetingData.title || !meetingData.startTime || !meetingData.endTime) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: title, startTime, endTime'
        });
      }

      if (!meetingData.timezone) {
        meetingData.timezone = 'UTC';
      }

      if (!meetingData.organizerId || !meetingData.organizerEmail) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: organizerId, organizerEmail'
        });
      }

      const meeting = await scheduledMeetingService.createMeeting(meetingData);

      logger.info(`Created scheduled meeting: ${meeting.id} by ${meetingData.organizerId}`);

      res.status(201).json({
        success: true,
        data: meeting
      });
    } catch (error) {
      logger.error('Error creating scheduled meeting:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/scheduled-meetings/:id
   * Get meeting by ID
   */
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const meeting = await scheduledMeetingService.getMeeting(id);

      if (!meeting) {
        return res.status(404).json({
          success: false,
          error: 'Meeting not found'
        });
      }

      res.json({
        success: true,
        data: meeting
      });
    } catch (error) {
      logger.error('Error getting meeting:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/scheduled-meetings/organizer/:organizerId
   * Get meetings by organizer
   *
   * Query params:
   * - status: Filter by status (scheduled, in_progress, completed, cancelled)
   * - startDate: Filter meetings after this date (ISO 8601)
   * - endDate: Filter meetings before this date (ISO 8601)
   */
  router.get('/organizer/:organizerId', async (req, res) => {
    try {
      const { organizerId } = req.params;
      const { status, startDate, endDate } = req.query;

      const options = {};
      if (status) options.status = status;
      if (startDate) options.startDate = startDate;
      if (endDate) options.endDate = endDate;

      const meetings = await scheduledMeetingService.getMeetingsByOrganizer(organizerId, options);

      res.json({
        success: true,
        data: meetings,
        count: meetings.length
      });
    } catch (error) {
      logger.error('Error getting meetings by organizer:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PATCH /api/scheduled-meetings/:id
   * Update meeting
   */
  router.patch('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const meeting = await scheduledMeetingService.updateMeeting(id, updates);

      logger.info(`Updated meeting: ${id}`);

      res.json({
        success: true,
        data: meeting
      });
    } catch (error) {
      logger.error('Error updating meeting:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/scheduled-meetings/:id/cancel
   * Cancel meeting
   */
  router.post('/:id/cancel', async (req, res) => {
    try {
      const { id } = req.params;
      const meeting = await scheduledMeetingService.cancelMeeting(id);

      logger.info(`Cancelled meeting: ${id}`);

      res.json({
        success: true,
        data: meeting
      });
    } catch (error) {
      logger.error('Error cancelling meeting:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/scheduled-meetings/:id
   * Delete meeting
   */
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await scheduledMeetingService.deleteMeeting(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Meeting not found'
        });
      }

      logger.info(`Deleted meeting: ${id}`);

      res.json({
        success: true,
        message: 'Meeting deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting meeting:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/scheduled-meetings/:id/participants
   * Add participant to meeting
   */
  router.post('/:id/participants', async (req, res) => {
    try {
      const { id } = req.params;
      const participant = req.body;

      if (!participant.email) {
        return res.status(400).json({
          success: false,
          error: 'Participant email is required'
        });
      }

      const meeting = await scheduledMeetingService.addParticipant(id, participant);

      logger.info(`Added participant to meeting ${id}: ${participant.email}`);

      res.json({
        success: true,
        data: meeting
      });
    } catch (error) {
      logger.error('Error adding participant:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PATCH /api/scheduled-meetings/:meetingId/participants/:participantId
   * Update participant invitation status
   */
  router.patch('/:meetingId/participants/:participantId', async (req, res) => {
    try {
      const { meetingId, participantId } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'Status is required'
        });
      }

      const validStatuses = ['accepted', 'declined', 'tentative'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      const meeting = await scheduledMeetingService.updateParticipantStatus(
        meetingId,
        participantId,
        status
      );

      logger.info(`Updated participant ${participantId} status in meeting ${meetingId}: ${status}`);

      res.json({
        success: true,
        data: meeting
      });
    } catch (error) {
      logger.error('Error updating participant status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/scheduled-meetings/:id/recurring-instances
   * Get recurring meeting instances
   *
   * Query params:
   * - count: Number of instances to generate (default: 10, max: 100)
   */
  router.get('/:id/recurring-instances', async (req, res) => {
    try {
      const { id } = req.params;
      const count = Math.min(parseInt(req.query.count || '10'), 100);

      const meeting = await scheduledMeetingService.getMeeting(id);

      if (!meeting) {
        return res.status(404).json({
          success: false,
          error: 'Meeting not found'
        });
      }

      const instances = scheduledMeetingService.generateRecurringInstances(meeting, count);

      res.json({
        success: true,
        data: instances,
        count: instances.length
      });
    } catch (error) {
      logger.error('Error generating recurring instances:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/scheduled-meetings/reminders/pending
   * Get pending reminders to send
   */
  router.get('/reminders/pending', async (req, res) => {
    try {
      const reminders = await scheduledMeetingService.getPendingReminders();

      res.json({
        success: true,
        data: reminders,
        count: reminders.length
      });
    } catch (error) {
      logger.error('Error getting pending reminders:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/scheduled-meetings/:meetingId/reminders/:reminderId/mark-sent
   * Mark reminder as sent
   */
  router.post('/:meetingId/reminders/:reminderId/mark-sent', async (req, res) => {
    try {
      const { meetingId, reminderId } = req.params;

      const meeting = await scheduledMeetingService.markReminderSent(meetingId, reminderId);

      res.json({
        success: true,
        data: meeting
      });
    } catch (error) {
      logger.error('Error marking reminder as sent:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/scheduled-meetings/enums
   * Get enums for meeting configuration
   */
  router.get('/enums', (req, res) => {
    res.json({
      success: true,
      data: {
        meetingStatus: MEETING_STATUS,
        recurrencePattern: RECURRENCE_PATTERN,
        reminderTime: REMINDER_TIME
      }
    });
  });

  return router;
}

export default createScheduledMeetingsRoutes;
