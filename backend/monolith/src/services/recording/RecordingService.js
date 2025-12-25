/**
 * Flight Recording Service
 *
 * Manages recording of drone flights including video and telemetry data.
 * Records are stored in the recordings directory with the following structure:
 *
 * recordings/
 * ├── flight_20250114_143025/
 * │   ├── video.mp4 (placeholder - actual video recording TBD)
 * │   ├── telemetry.json
 * │   └── metadata.json
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../utils/logger.js';
import { limitArraySize } from '../../utils/memoryOptimization.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RecordingService {
  constructor(recordingsDir = 'recordings') {
    this.recordingsDir = path.resolve(recordingsDir);
    this._activeRecordings = new Map();
    this._initializeDirectory();
  }

  /**
   * Initialize recordings directory
   */
  async _initializeDirectory() {
    try {
      await fs.mkdir(this.recordingsDir, { recursive: true });
      logger.info(`Recordings directory initialized: ${this.recordingsDir}`);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create recordings directory');
    }
  }

  /**
   * Start recording a flight
   *
   * @param {string} droneId - Unique identifier for the drone
   * @param {object} options - Recording options
   * @param {string} options.videoSource - Video source URL (RTSP/HTTP)
   * @param {boolean} options.recordVideo - Whether to record video (default: true)
   * @param {boolean} options.recordTelemetry - Whether to record telemetry (default: true)
   * @returns {Promise<object>} - Flight information
   */
  async startRecording(droneId, options = {}) {
    if (this._activeRecordings.has(droneId)) {
      throw new Error(`Recording already active for drone ${droneId}`);
    }

    const {
      videoSource = null,
      recordVideo = true,
      recordTelemetry = true
    } = options;

    // Generate flight ID with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const flightId = `flight_${timestamp}`;

    // Create flight directory
    const flightDir = path.join(this.recordingsDir, flightId);
    await fs.mkdir(flightDir, { recursive: true });

    // Initialize recording state
    const recording = {
      flightId,
      droneId,
      flightDir,
      startTime: new Date(),
      videoSource,
      recordVideo,
      recordTelemetry,
      telemetrySamples: [],
      stats: {
        maxAltitude: 0.0,
        maxSpeed: 0.0,
        distanceTraveled: 0.0,
        batteryStart: null,
        batteryEnd: null
      },
      frameCount: 0,
      telemetryCount: 0
    };

    this._activeRecordings.set(droneId, recording);

    logger.info({
      droneId,
      flightId,
      videoSource,
      recordVideo,
      recordTelemetry
    }, 'Started recording flight');

    return {
      flightId,
      droneId,
      startTime: recording.startTime.toISOString(),
      recordVideo,
      recordTelemetry
    };
  }

  /**
   * Stop recording a flight
   *
   * @param {string} droneId - Unique identifier for the drone
   * @returns {Promise<object>} - Recording metadata
   */
  async stopRecording(droneId) {
    const recording = this._activeRecordings.get(droneId);

    if (!recording) {
      throw new Error(`No active recording for drone ${droneId}`);
    }

    const endTime = new Date();
    const durationSeconds = (endTime - recording.startTime) / 1000;

    // Save telemetry data
    const telemetryFile = path.join(recording.flightDir, 'telemetry.json');
    await fs.writeFile(
      telemetryFile,
      JSON.stringify(
        {
          samples: recording.telemetrySamples
        },
        null,
        2
      )
    );

    // Create placeholder video file (actual video recording to be implemented)
    const videoFile = path.join(recording.flightDir, 'video.mp4');
    let videoSize = 0;
    if (recording.recordVideo) {
      // Create empty placeholder file
      await fs.writeFile(videoFile, '');
      const videoStats = await fs.stat(videoFile);
      videoSize = videoStats.size;
    }

    // Create metadata
    const metadata = {
      flightId: recording.flightId,
      droneId,
      startTime: recording.startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationSeconds,
      videoFile: recording.recordVideo ? 'video.mp4' : null,
      videoSizeBytes: videoSize,
      telemetryFile: 'telemetry.json',
      telemetrySamples: recording.telemetrySamples.length,
      maxAltitude: recording.stats.maxAltitude,
      maxSpeed: recording.stats.maxSpeed,
      distanceTraveled: recording.stats.distanceTraveled,
      batteryStart: recording.stats.batteryStart,
      batteryEnd: recording.stats.batteryEnd,
      frameCount: recording.frameCount
    };

    // Save metadata
    const metadataFile = path.join(recording.flightDir, 'metadata.json');
    await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));

    // Remove from active recordings
    this._activeRecordings.delete(droneId);

    logger.info({
      droneId,
      flightId: recording.flightId,
      durationSeconds,
      telemetrySamples: recording.telemetrySamples.length
    }, 'Stopped recording flight');

    return metadata;
  }

  /**
   * Add telemetry sample to active recording
   *
   * @param {string} droneId - Unique identifier for the drone
   * @param {object} telemetry - Telemetry data
   */
  async addTelemetrySample(droneId, telemetry) {
    const recording = this._activeRecordings.get(droneId);

    if (!recording || !recording.recordTelemetry) {
      return;
    }

    // Add timestamp if not present
    const sample = {
      timestamp: new Date().toISOString(),
      ...telemetry
    };

    recording.telemetrySamples.push(sample);
    recording.telemetryCount++;

    // Fix #2157: Limit telemetry samples to prevent memory leak
    // During long flights, telemetry at 10-30Hz can accumulate 1-4GB in memory
    // Limit to last 50,000 samples (~8-24 hours at 10-30Hz = ~25-75MB max)
    limitArraySize(recording.telemetrySamples, 50000);

    // Update stats
    if (telemetry.altitude !== undefined) {
      recording.stats.maxAltitude = Math.max(
        recording.stats.maxAltitude,
        telemetry.altitude
      );
    }

    if (telemetry.groundspeed !== undefined) {
      recording.stats.maxSpeed = Math.max(
        recording.stats.maxSpeed,
        telemetry.groundspeed
      );
    }

    if (recording.stats.batteryStart === null && telemetry.batteryVoltage !== undefined) {
      recording.stats.batteryStart = telemetry.batteryVoltage;
    }

    if (telemetry.batteryVoltage !== undefined) {
      recording.stats.batteryEnd = telemetry.batteryVoltage;
    }
  }

  /**
   * Add video frame to active recording (placeholder)
   *
   * @param {string} droneId - Unique identifier for the drone
   * @param {Buffer} frame - Video frame data
   */
  async addVideoFrame(droneId, frame) {
    const recording = this._activeRecordings.get(droneId);

    if (!recording || !recording.recordVideo) {
      return;
    }

    recording.frameCount++;
    // TODO: Implement actual video recording with ffmpeg or similar
  }

  /**
   * List all recorded flights
   *
   * @returns {Promise<Array>} - List of flight metadata
   */
  async listRecordings() {
    try {
      const entries = await fs.readdir(this.recordingsDir, { withFileTypes: true });
      const recordings = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const metadataFile = path.join(this.recordingsDir, entry.name, 'metadata.json');

        try {
          const data = await fs.readFile(metadataFile, 'utf8');
          const metadata = JSON.parse(data);
          recordings.push(metadata);
        } catch (error) {
          logger.warn({ error: error.message, dir: entry.name }, 'Failed to read metadata');
        }
      }

      // Sort by start time (newest first)
      recordings.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

      return recordings;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to list recordings');
      return [];
    }
  }

  /**
   * Get metadata for a specific recording
   *
   * @param {string} flightId - Flight identifier
   * @returns {Promise<object|null>} - Flight metadata or null if not found
   */
  async getRecording(flightId) {
    try {
      const metadataFile = path.join(this.recordingsDir, flightId, 'metadata.json');
      const data = await fs.readFile(metadataFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.warn({ error: error.message, flightId }, 'Failed to get recording');
      return null;
    }
  }

  /**
   * Get telemetry data for a specific recording
   *
   * @param {string} flightId - Flight identifier
   * @returns {Promise<object|null>} - Telemetry data or null if not found
   */
  async getTelemetry(flightId) {
    try {
      const telemetryFile = path.join(this.recordingsDir, flightId, 'telemetry.json');
      const data = await fs.readFile(telemetryFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.warn({ error: error.message, flightId }, 'Failed to get telemetry');
      return null;
    }
  }

  /**
   * Get video file path for a specific recording
   *
   * @param {string} flightId - Flight identifier
   * @returns {Promise<string|null>} - Video file path or null if not found
   */
  async getVideoPath(flightId) {
    try {
      const videoFile = path.join(this.recordingsDir, flightId, 'video.mp4');
      await fs.access(videoFile);
      return videoFile;
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete a recorded flight
   *
   * @param {string} flightId - Flight identifier
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async deleteRecording(flightId) {
    try {
      const flightDir = path.join(this.recordingsDir, flightId);
      await fs.rm(flightDir, { recursive: true, force: true });

      logger.info({ flightId }, 'Deleted recording');
      return true;
    } catch (error) {
      logger.error({ error: error.message, flightId }, 'Failed to delete recording');
      return false;
    }
  }

  /**
   * Check if a drone is currently recording
   *
   * @param {string} droneId - Unique identifier for the drone
   * @returns {boolean} - True if recording
   */
  isRecording(droneId) {
    return this._activeRecordings.has(droneId);
  }

  /**
   * Get active recording info for a drone
   *
   * @param {string} droneId - Unique identifier for the drone
   * @returns {object|null} - Recording info or null if not recording
   */
  getActiveRecording(droneId) {
    const recording = this._activeRecordings.get(droneId);

    if (!recording) {
      return null;
    }

    return {
      flightId: recording.flightId,
      droneId: recording.droneId,
      startTime: recording.startTime.toISOString(),
      duration: (new Date() - recording.startTime) / 1000,
      telemetrySamples: recording.telemetrySamples.length,
      frameCount: recording.frameCount
    };
  }
}

// Export singleton instance
export const recordingService = new RecordingService();
export default RecordingService;
