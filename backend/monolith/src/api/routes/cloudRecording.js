/**
 * Cloud Recording API Routes
 *
 * REST API for managing cloud-based video conference recordings with AI features
 */

import express from 'express';
import multer from 'multer';
import { cloudRecordingService, RECORDING_STATUS, RETENTION_POLICY } from '../../services/recording/CloudRecordingService.js';
import logger from '../../utils/logger.js';

// Configure multer for video upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB max
  }
});

/**
 * Create cloud recording routes
 *
 * @returns {express.Router} - Express router
 */
export function createCloudRecordingRoutes() {
  const router = express.Router();

  /**
   * POST /api/cloud-recording/start
   * Start cloud recording for a room
   */
  router.post('/start', async (req, res) => {
    try {
      const {
        roomId,
        userId,
        roomName,
        participants = [],
        retentionDays = RETENTION_POLICY.FOREVER,
        folders = [],
        tags = []
      } = req.body;

      if (!roomId || !userId) {
        return res.status(400).json({
          success: false,
          error: 'roomId and userId are required'
        });
      }

      const result = await cloudRecordingService.startRecording(roomId, {
        userId,
        roomName,
        participants,
        retentionDays,
        folders,
        tags
      });

      res.json({
        success: true,
        data: result,
        message: 'Cloud recording started successfully'
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to start cloud recording');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/cloud-recording/stop/:roomId
   * Stop cloud recording and upload video
   */
  router.post('/stop/:roomId', upload.single('video'), async (req, res) => {
    try {
      const { roomId } = req.params;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Video file is required'
        });
      }

      // Convert uploaded file buffer to video blob
      const videoBlob = req.file.buffer;

      const metadata = await cloudRecordingService.stopRecording(roomId, videoBlob);

      res.json({
        success: true,
        data: metadata,
        message: 'Cloud recording stopped and saved successfully'
      });
    } catch (error) {
      logger.error({ error: error.message, roomId: req.params.roomId }, 'Failed to stop cloud recording');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/cloud-recording/audio/:roomId
   * Add audio chunk to active recording
   */
  router.post('/audio/:roomId', async (req, res) => {
    try {
      const { roomId } = req.params;
      const { audioChunk, metadata } = req.body;

      await cloudRecordingService.addAudioChunk(roomId, Buffer.from(audioChunk, 'base64'), metadata);

      res.json({
        success: true,
        message: 'Audio chunk added'
      });
    } catch (error) {
      logger.error({ error: error.message, roomId: req.params.roomId }, 'Failed to add audio chunk');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/cloud-recording/chat/:roomId
   * Add chat message to recording
   */
  router.post('/chat/:roomId', async (req, res) => {
    try {
      const { roomId } = req.params;
      const message = req.body;

      await cloudRecordingService.addChatMessage(roomId, message);

      res.json({
        success: true,
        message: 'Chat message added'
      });
    } catch (error) {
      logger.error({ error: error.message, roomId: req.params.roomId }, 'Failed to add chat message');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/cloud-recording/event/:roomId
   * Add event to recording
   */
  router.post('/event/:roomId', async (req, res) => {
    try {
      const { roomId } = req.params;
      const event = req.body;

      await cloudRecordingService.addEvent(roomId, event);

      res.json({
        success: true,
        message: 'Event added'
      });
    } catch (error) {
      logger.error({ error: error.message, roomId: req.params.roomId }, 'Failed to add event');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/cloud-recording/list
   * List all cloud recordings with optional filtering
   */
  router.get('/list', async (req, res) => {
    try {
      const {
        userId,
        folders,
        tags,
        status,
        limit,
        offset
      } = req.query;

      const filters = {
        userId,
        folders: folders ? folders.split(',') : undefined,
        tags: tags ? tags.split(',') : undefined,
        status,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      };

      const result = await cloudRecordingService.listRecordings(filters);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to list cloud recordings');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/cloud-recording/:recordingId
   * Get recording metadata
   */
  router.get('/:recordingId', async (req, res) => {
    try {
      const { recordingId } = req.params;

      const recording = await cloudRecordingService.getRecording(recordingId);

      if (!recording) {
        return res.status(404).json({
          success: false,
          error: 'Recording not found'
        });
      }

      res.json({
        success: true,
        data: recording
      });
    } catch (error) {
      logger.error({ error: error.message, recordingId: req.params.recordingId }, 'Failed to get recording');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /api/cloud-recording/:recordingId
   * Update recording metadata
   */
  router.put('/:recordingId', async (req, res) => {
    try {
      const { recordingId } = req.params;
      const updates = req.body;

      const recording = await cloudRecordingService.updateRecording(recordingId, updates);

      res.json({
        success: true,
        data: recording,
        message: 'Recording updated successfully'
      });
    } catch (error) {
      logger.error({ error: error.message, recordingId: req.params.recordingId }, 'Failed to update recording');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/cloud-recording/:recordingId
   * Delete a cloud recording
   */
  router.delete('/:recordingId', async (req, res) => {
    try {
      const { recordingId } = req.params;

      const success = await cloudRecordingService.deleteRecording(recordingId);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Recording not found or already deleted'
        });
      }

      res.json({
        success: true,
        message: 'Recording deleted successfully'
      });
    } catch (error) {
      logger.error({ error: error.message, recordingId: req.params.recordingId }, 'Failed to delete recording');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/cloud-recording/:recordingId/video
   * Download video file
   */
  router.get('/:recordingId/video', async (req, res) => {
    try {
      const { recordingId } = req.params;

      const videoPath = await cloudRecordingService.getVideoPath(recordingId);

      if (!videoPath) {
        return res.status(404).json({
          success: false,
          error: 'Video file not found'
        });
      }

      res.download(videoPath, `${recordingId}.webm`);
    } catch (error) {
      logger.error({ error: error.message, recordingId: req.params.recordingId }, 'Failed to download video');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/cloud-recording/:recordingId/transcript
   * Get transcript
   */
  router.get('/:recordingId/transcript', async (req, res) => {
    try {
      const { recordingId } = req.params;

      const transcript = await cloudRecordingService.getTranscript(recordingId);

      if (!transcript) {
        return res.status(404).json({
          success: false,
          error: 'Transcript not found'
        });
      }

      res.json({
        success: true,
        data: transcript
      });
    } catch (error) {
      logger.error({ error: error.message, recordingId: req.params.recordingId }, 'Failed to get transcript');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/cloud-recording/search
   * Search in transcripts
   */
  router.get('/search/transcripts', async (req, res) => {
    try {
      const { query, userId, folders, tags } = req.query;

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'query parameter is required'
        });
      }

      const filters = {
        userId,
        folders: folders ? folders.split(',') : undefined,
        tags: tags ? tags.split(',') : undefined
      };

      const results = await cloudRecordingService.searchTranscripts(query, filters);

      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to search transcripts');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/cloud-recording/:recordingId/share
   * Enable public sharing
   */
  router.post('/:recordingId/share', async (req, res) => {
    try {
      const { recordingId } = req.params;
      const { baseUrl } = req.body;

      const sharingInfo = await cloudRecordingService.enableSharing(recordingId, baseUrl);

      res.json({
        success: true,
        data: sharingInfo,
        message: 'Sharing enabled successfully'
      });
    } catch (error) {
      logger.error({ error: error.message, recordingId: req.params.recordingId }, 'Failed to enable sharing');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/cloud-recording/:recordingId/share
   * Disable public sharing
   */
  router.delete('/:recordingId/share', async (req, res) => {
    try {
      const { recordingId } = req.params;

      await cloudRecordingService.disableSharing(recordingId);

      res.json({
        success: true,
        message: 'Sharing disabled successfully'
      });
    } catch (error) {
      logger.error({ error: error.message, recordingId: req.params.recordingId }, 'Failed to disable sharing');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/cloud-recording/shared/:sharingToken
   * Get recording by sharing token (public access)
   */
  router.get('/shared/:sharingToken', async (req, res) => {
    try {
      const { sharingToken } = req.params;

      const recording = await cloudRecordingService.getRecordingByToken(sharingToken);

      if (!recording) {
        return res.status(404).json({
          success: false,
          error: 'Recording not found or sharing is disabled'
        });
      }

      res.json({
        success: true,
        data: recording
      });
    } catch (error) {
      logger.error({ error: error.message, sharingToken: req.params.sharingToken }, 'Failed to get shared recording');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/cloud-recording/cleanup
   * Clean up expired recordings
   */
  router.post('/cleanup', async (req, res) => {
    try {
      const stats = await cloudRecordingService.cleanupExpiredRecordings();

      res.json({
        success: true,
        data: stats,
        message: 'Cleanup completed successfully'
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to cleanup expired recordings');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/cloud-recording/stats
   * Get storage statistics
   */
  router.get('/stats/storage', async (req, res) => {
    try {
      const stats = await cloudRecordingService.getStorageStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get storage stats');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/cloud-recording/constants
   * Get constants for frontend use
   */
  router.get('/constants', (req, res) => {
    res.json({
      success: true,
      data: {
        RECORDING_STATUS,
        RETENTION_POLICY
      }
    });
  });

  return router;
}
