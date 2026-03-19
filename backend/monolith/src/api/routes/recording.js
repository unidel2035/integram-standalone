/**
 * Recording API Routes
 *
 * Provides REST API for managing drone flight recordings
 */

import express from 'express';
import { recordingService } from '../../services/recording/RecordingService.js';
import logger from '../../utils/logger.js';

/**
 * Create recording routes
 *
 * @returns {express.Router} - Express router
 */
export function createRecordingRoutes() {
  const router = express.Router();

  /**
   * POST /api/recording/start
   * Start recording a flight
   */
  router.post('/start', async (req, res, next) => {
    try {
      const { droneId, videoSource, recordVideo = true, recordTelemetry = true } = req.body;

      if (!droneId) {
        return res.status(400).json({
          success: false,
          error: 'droneId is required'
        });
      }

      const result = await recordingService.startRecording(droneId, {
        videoSource,
        recordVideo,
        recordTelemetry
      });

      res.json({
        success: true,
        ...result,
        message: 'Recording started successfully'
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to start recording');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/recording/stop/:droneId
   * Stop recording a flight
   */
  router.post('/stop/:droneId', async (req, res, next) => {
    try {
      const { droneId } = req.params;

      const metadata = await recordingService.stopRecording(droneId);

      res.json({
        success: true,
        metadata,
        message: 'Recording stopped successfully'
      });
    } catch (error) {
      logger.error({ error: error.message, droneId: req.params.droneId }, 'Failed to stop recording');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/recording/list
   * List all recorded flights
   */
  router.get('/list', async (req, res, next) => {
    try {
      const recordings = await recordingService.listRecordings();

      res.json(recordings);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to list recordings');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/recording/metadata/:flightId
   * Get metadata for a specific recording
   */
  router.get('/metadata/:flightId', async (req, res, next) => {
    try {
      const { flightId } = req.params;

      const metadata = await recordingService.getRecording(flightId);

      if (!metadata) {
        return res.status(404).json({
          success: false,
          error: 'Recording not found'
        });
      }

      res.json(metadata);
    } catch (error) {
      logger.error({ error: error.message, flightId: req.params.flightId }, 'Failed to get metadata');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/recording/telemetry/:flightId
   * Get telemetry data for a specific recording
   */
  router.get('/telemetry/:flightId', async (req, res, next) => {
    try {
      const { flightId } = req.params;

      const telemetry = await recordingService.getTelemetry(flightId);

      if (!telemetry) {
        return res.status(404).json({
          success: false,
          error: 'Telemetry data not found'
        });
      }

      res.json(telemetry);
    } catch (error) {
      logger.error({ error: error.message, flightId: req.params.flightId }, 'Failed to get telemetry');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/recording/video/:flightId
   * Download recorded video file
   */
  router.get('/video/:flightId', async (req, res, next) => {
    try {
      const { flightId } = req.params;

      const videoPath = await recordingService.getVideoPath(flightId);

      if (!videoPath) {
        return res.status(404).json({
          success: false,
          error: 'Video file not found'
        });
      }

      res.download(videoPath, `${flightId}.mp4`);
    } catch (error) {
      logger.error({ error: error.message, flightId: req.params.flightId }, 'Failed to download video');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/recording/:flightId
   * Delete a recorded flight
   */
  router.delete('/:flightId', async (req, res, next) => {
    try {
      const { flightId } = req.params;

      const success = await recordingService.deleteRecording(flightId);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Failed to delete recording'
        });
      }

      res.json({
        success: true,
        message: 'Recording deleted successfully'
      });
    } catch (error) {
      logger.error({ error: error.message, flightId: req.params.flightId }, 'Failed to delete recording');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/recording/status/:droneId
   * Check if a drone is currently recording
   */
  router.get('/status/:droneId', async (req, res, next) => {
    try {
      const { droneId } = req.params;

      const isRecording = recordingService.isRecording(droneId);
      const activeRecording = recordingService.getActiveRecording(droneId);

      res.json({
        droneId,
        isRecording,
        recording: activeRecording
      });
    } catch (error) {
      logger.error({ error: error.message, droneId: req.params.droneId }, 'Failed to get recording status');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/recording/telemetry/:droneId
   * Add telemetry sample to active recording
   */
  router.post('/telemetry/:droneId', async (req, res, next) => {
    try {
      const { droneId } = req.params;
      const telemetry = req.body;

      await recordingService.addTelemetrySample(droneId, telemetry);

      res.json({
        success: true,
        message: 'Telemetry sample added'
      });
    } catch (error) {
      logger.error({ error: error.message, droneId: req.params.droneId }, 'Failed to add telemetry sample');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}
