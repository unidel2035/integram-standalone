/**
 * Cloud Recording Service
 *
 * Manages cloud-based recording of video conferences with automatic AI processing:
 * - Cloud storage (currently local files, S3-compatible in future)
 * - Automatic transcription using AI (Whisper/Deepgram)
 * - AI summarization and highlights
 * - Smart chapters generation
 * - Searchable transcripts
 * - Public sharing links
 * - Storage organization (folders, tags)
 * - Retention policies
 * - Export in multiple formats
 *
 * Following project guidelines:
 * - Backend in monolith (backend/monolith/)
 * - No direct database creation
 * - Uses DronDoc API or local files
 * - AI via token system (TokenBasedLLMCoordinator)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import logger from '../../utils/logger.js';
import { limitArraySize } from '../../utils/memoryOptimization.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Recording status constants
 */
export const RECORDING_STATUS = {
  RECORDING: 'recording',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELETED: 'deleted'
};

/**
 * Retention policy constants (in days)
 */
export const RETENTION_POLICY = {
  ONE_WEEK: 7,
  ONE_MONTH: 30,
  THREE_MONTHS: 90,
  SIX_MONTHS: 180,
  ONE_YEAR: 365,
  FOREVER: -1
};

class CloudRecordingService {
  constructor(options = {}) {
    this.storageDir = path.resolve(options.storageDir || 'cloud-recordings');
    this.metadataDir = path.join(this.storageDir, 'metadata');
    this.videosDir = path.join(this.storageDir, 'videos');
    this.transcriptsDir = path.join(this.storageDir, 'transcripts');
    this.thumbnailsDir = path.join(this.storageDir, 'thumbnails');

    // Active recordings (room -> recording info)
    this._activeRecordings = new Map();

    // AI coordinator will be injected
    this.aiCoordinator = null;

    this._initializeDirectories();
  }

  /**
   * Set AI coordinator for transcription and summarization
   * @param {TokenBasedLLMCoordinator} coordinator - AI coordinator instance
   */
  setAICoordinator(coordinator) {
    this.aiCoordinator = coordinator;
  }

  /**
   * Initialize storage directories
   */
  async _initializeDirectories() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      await fs.mkdir(this.metadataDir, { recursive: true });
      await fs.mkdir(this.videosDir, { recursive: true });
      await fs.mkdir(this.transcriptsDir, { recursive: true });
      await fs.mkdir(this.thumbnailsDir, { recursive: true });

      logger.info(`Cloud recordings storage initialized: ${this.storageDir}`);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create cloud recordings directories');
    }
  }

  /**
   * Generate unique recording ID
   * @returns {string} - Recording ID
   */
  _generateRecordingId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `rec_${timestamp}_${random}`;
  }

  /**
   * Generate public sharing token
   * @returns {string} - Sharing token
   */
  _generateSharingToken() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Start cloud recording for a room
   *
   * @param {string} roomId - Room identifier
   * @param {object} options - Recording options
   * @param {string} options.userId - User who started recording
   * @param {string} options.roomName - Display name of the room
   * @param {string[]} options.participants - List of participant IDs
   * @param {number} options.retentionDays - Retention policy in days
   * @param {string[]} options.folders - Folder organization
   * @param {string[]} options.tags - Tags for categorization
   * @returns {Promise<object>} - Recording information
   */
  async startRecording(roomId, options = {}) {
    if (this._activeRecordings.has(roomId)) {
      throw new Error(`Recording already active for room ${roomId}`);
    }

    const {
      userId,
      roomName = roomId,
      participants = [],
      retentionDays = RETENTION_POLICY.FOREVER,
      folders = [],
      tags = []
    } = options;

    const recordingId = this._generateRecordingId();
    const startTime = new Date();

    // Create recording metadata
    const recording = {
      id: recordingId,
      roomId,
      roomName,
      userId,
      participants,
      status: RECORDING_STATUS.RECORDING,
      startTime: startTime.toISOString(),
      endTime: null,
      durationSeconds: 0,

      // Storage organization
      folders,
      tags,
      retentionDays,
      expiresAt: retentionDays > 0
        ? new Date(startTime.getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString()
        : null,

      // Video info
      videoFile: null,
      videoSizeBytes: 0,
      thumbnailFile: null,

      // Transcription
      transcriptionStatus: 'pending',
      transcriptFile: null,
      transcriptText: null,

      // AI features
      summaryStatus: 'pending',
      summary: null,
      highlights: [],
      chapters: [],

      // Sharing
      sharingEnabled: false,
      sharingToken: null,
      sharingUrl: null,

      // Metadata
      createdAt: startTime.toISOString(),
      updatedAt: startTime.toISOString(),

      // Collected data during recording
      _audioChunks: [],
      _videoChunks: [],
      _chatMessages: [],
      _events: []
    };

    this._activeRecordings.set(roomId, recording);

    logger.info({
      recordingId,
      roomId,
      userId,
      participants: participants.length
    }, 'Started cloud recording');

    return {
      recordingId,
      roomId,
      status: RECORDING_STATUS.RECORDING,
      startTime: recording.startTime
    };
  }

  /**
   * Add audio chunk to active recording
   *
   * @param {string} roomId - Room identifier
   * @param {Buffer} audioChunk - Audio data
   * @param {object} metadata - Chunk metadata (timestamp, speaker, etc.)
   */
  async addAudioChunk(roomId, audioChunk, metadata = {}) {
    const recording = this._activeRecordings.get(roomId);

    if (!recording) {
      logger.warn({ roomId }, 'No active recording for room');
      return;
    }

    recording._audioChunks.push({
      data: audioChunk,
      timestamp: new Date().toISOString(),
      ...metadata
    });

    // Limit chunks in memory (prevent memory leak)
    limitArraySize(recording._audioChunks, 10000);
  }

  /**
   * Add video chunk to active recording
   *
   * @param {string} roomId - Room identifier
   * @param {Buffer} videoChunk - Video data
   * @param {object} metadata - Chunk metadata
   */
  async addVideoChunk(roomId, videoChunk, metadata = {}) {
    const recording = this._activeRecordings.get(roomId);

    if (!recording) {
      logger.warn({ roomId }, 'No active recording for room');
      return;
    }

    recording._videoChunks.push({
      data: videoChunk,
      timestamp: new Date().toISOString(),
      ...metadata
    });

    // Limit chunks in memory
    limitArraySize(recording._videoChunks, 5000);
  }

  /**
   * Add chat message to recording
   *
   * @param {string} roomId - Room identifier
   * @param {object} message - Chat message
   */
  async addChatMessage(roomId, message) {
    const recording = this._activeRecordings.get(roomId);

    if (!recording) {
      return;
    }

    recording._chatMessages.push({
      ...message,
      timestamp: new Date().toISOString()
    });

    limitArraySize(recording._chatMessages, 10000);
  }

  /**
   * Add event to recording (participant joined, left, screen share, etc.)
   *
   * @param {string} roomId - Room identifier
   * @param {object} event - Event data
   */
  async addEvent(roomId, event) {
    const recording = this._activeRecordings.get(roomId);

    if (!recording) {
      return;
    }

    recording._events.push({
      ...event,
      timestamp: new Date().toISOString()
    });

    limitArraySize(recording._events, 5000);
  }

  /**
   * Stop recording and save video file
   *
   * @param {string} roomId - Room identifier
   * @param {Blob|Buffer} videoBlob - Recorded video data
   * @returns {Promise<object>} - Recording metadata
   */
  async stopRecording(roomId, videoBlob) {
    const recording = this._activeRecordings.get(roomId);

    if (!recording) {
      throw new Error(`No active recording for room ${roomId}`);
    }

    const endTime = new Date();
    recording.endTime = endTime.toISOString();
    recording.durationSeconds = Math.floor((endTime - new Date(recording.startTime)) / 1000);
    recording.status = RECORDING_STATUS.PROCESSING;

    // Save video file
    const videoFileName = `${recording.id}.webm`;
    const videoFilePath = path.join(this.videosDir, videoFileName);

    try {
      // Convert Blob to Buffer if needed
      let videoBuffer;
      if (videoBlob instanceof Buffer) {
        videoBuffer = videoBlob;
      } else if (videoBlob.arrayBuffer) {
        videoBuffer = Buffer.from(await videoBlob.arrayBuffer());
      } else {
        throw new Error('Invalid video data format');
      }

      await fs.writeFile(videoFilePath, videoBuffer);

      const stats = await fs.stat(videoFilePath);
      recording.videoFile = videoFileName;
      recording.videoSizeBytes = stats.size;

      logger.info({
        recordingId: recording.id,
        roomId,
        videoSizeBytes: stats.size,
        durationSeconds: recording.durationSeconds
      }, 'Saved video file');

    } catch (error) {
      logger.error({ error: error.message, recordingId: recording.id }, 'Failed to save video file');
      recording.status = RECORDING_STATUS.FAILED;
    }

    // Save metadata
    await this._saveMetadata(recording);

    // Remove from active recordings
    this._activeRecordings.delete(roomId);

    // Start async processing (transcription, summarization, etc.)
    this._processRecording(recording.id).catch(error => {
      logger.error({ error: error.message, recordingId: recording.id }, 'Failed to process recording');
    });

    logger.info({
      recordingId: recording.id,
      roomId,
      durationSeconds: recording.durationSeconds
    }, 'Stopped cloud recording');

    return {
      recordingId: recording.id,
      roomId,
      status: recording.status,
      startTime: recording.startTime,
      endTime: recording.endTime,
      durationSeconds: recording.durationSeconds,
      videoFile: recording.videoFile,
      videoSizeBytes: recording.videoSizeBytes
    };
  }

  /**
   * Process recording: transcription, summarization, highlights, chapters
   *
   * @param {string} recordingId - Recording identifier
   * @returns {Promise<void>}
   */
  async _processRecording(recordingId) {
    const recording = await this.getRecording(recordingId);

    if (!recording) {
      logger.warn({ recordingId }, 'Recording not found for processing');
      return;
    }

    logger.info({ recordingId }, 'Starting recording processing');

    try {
      // Step 1: Transcribe audio
      await this._transcribeRecording(recording);

      // Step 2: Generate AI summary
      await this._generateSummary(recording);

      // Step 3: Generate highlights
      await this._generateHighlights(recording);

      // Step 4: Generate smart chapters
      await this._generateChapters(recording);

      // Mark as completed
      recording.status = RECORDING_STATUS.COMPLETED;
      recording.updatedAt = new Date().toISOString();
      await this._saveMetadata(recording);

      logger.info({ recordingId }, 'Recording processing completed');

    } catch (error) {
      logger.error({ error: error.message, recordingId }, 'Recording processing failed');
      recording.status = RECORDING_STATUS.FAILED;
      recording.updatedAt = new Date().toISOString();
      await this._saveMetadata(recording);
    }
  }

  /**
   * Transcribe recording audio using AI
   *
   * @param {object} recording - Recording metadata
   * @returns {Promise<void>}
   */
  async _transcribeRecording(recording) {
    logger.info({ recordingId: recording.id }, 'Starting transcription');

    recording.transcriptionStatus = 'processing';
    await this._saveMetadata(recording);

    try {
      // TODO: Integrate with Whisper/Deepgram via TokenBasedLLMCoordinator
      // For now, create placeholder transcript
      const transcript = {
        recordingId: recording.id,
        language: 'ru',
        segments: [
          {
            start: 0,
            end: 10,
            text: '[Транскрипция будет доступна после интеграции с Whisper/Deepgram]',
            speaker: 'system'
          }
        ],
        fullText: '[Транскрипция будет доступна после интеграции с Whisper/Deepgram]'
      };

      // Save transcript
      const transcriptFileName = `${recording.id}_transcript.json`;
      const transcriptPath = path.join(this.transcriptsDir, transcriptFileName);
      await fs.writeFile(transcriptPath, JSON.stringify(transcript, null, 2));

      recording.transcriptFile = transcriptFileName;
      recording.transcriptText = transcript.fullText;
      recording.transcriptionStatus = 'completed';
      await this._saveMetadata(recording);

      logger.info({ recordingId: recording.id }, 'Transcription completed');

    } catch (error) {
      logger.error({ error: error.message, recordingId: recording.id }, 'Transcription failed');
      recording.transcriptionStatus = 'failed';
      await this._saveMetadata(recording);
    }
  }

  /**
   * Generate AI summary of recording
   *
   * @param {object} recording - Recording metadata
   * @returns {Promise<void>}
   */
  async _generateSummary(recording) {
    logger.info({ recordingId: recording.id }, 'Starting summary generation');

    recording.summaryStatus = 'processing';
    await this._saveMetadata(recording);

    try {
      // TODO: Integrate with TokenBasedLLMCoordinator for AI summarization
      // For now, create placeholder summary
      const summary = {
        brief: 'Краткое содержание встречи будет доступно после интеграции с AI',
        keyPoints: [
          'Основные моменты будут извлечены из транскрипта с помощью AI'
        ],
        actionItems: [],
        decisions: [],
        questions: []
      };

      recording.summary = summary;
      recording.summaryStatus = 'completed';
      await this._saveMetadata(recording);

      logger.info({ recordingId: recording.id }, 'Summary generation completed');

    } catch (error) {
      logger.error({ error: error.message, recordingId: recording.id }, 'Summary generation failed');
      recording.summaryStatus = 'failed';
      await this._saveMetadata(recording);
    }
  }

  /**
   * Generate highlights from recording
   *
   * @param {object} recording - Recording metadata
   * @returns {Promise<void>}
   */
  async _generateHighlights(recording) {
    logger.info({ recordingId: recording.id }, 'Starting highlights generation');

    try {
      // TODO: Use AI to identify important moments
      // For now, create placeholder highlights
      const highlights = [
        {
          timestamp: 30,
          duration: 10,
          title: 'Важный момент',
          description: 'AI выделит ключевые моменты встречи'
        }
      ];

      recording.highlights = highlights;
      await this._saveMetadata(recording);

      logger.info({ recordingId: recording.id }, 'Highlights generation completed');

    } catch (error) {
      logger.error({ error: error.message, recordingId: recording.id }, 'Highlights generation failed');
    }
  }

  /**
   * Generate smart chapters
   *
   * @param {object} recording - Recording metadata
   * @returns {Promise<void>}
   */
  async _generateChapters(recording) {
    logger.info({ recordingId: recording.id }, 'Starting chapters generation');

    try {
      // TODO: Use AI to detect topic changes and create chapters
      // For now, create placeholder chapters
      const chapters = [
        {
          start: 0,
          end: recording.durationSeconds,
          title: 'Полная запись',
          summary: 'AI создаст умные главы на основе смены тем в разговоре'
        }
      ];

      recording.chapters = chapters;
      await this._saveMetadata(recording);

      logger.info({ recordingId: recording.id }, 'Chapters generation completed');

    } catch (error) {
      logger.error({ error: error.message, recordingId: recording.id }, 'Chapters generation failed');
    }
  }

  /**
   * Save recording metadata to file
   *
   * @param {object} recording - Recording metadata
   * @returns {Promise<void>}
   */
  async _saveMetadata(recording) {
    // Remove internal fields before saving
    const { _audioChunks, _videoChunks, _chatMessages, _events, ...metadata } = recording;

    const metadataFile = path.join(this.metadataDir, `${recording.id}.json`);
    await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
  }

  /**
   * Get recording metadata
   *
   * @param {string} recordingId - Recording identifier
   * @returns {Promise<object|null>} - Recording metadata or null
   */
  async getRecording(recordingId) {
    try {
      const metadataFile = path.join(this.metadataDir, `${recordingId}.json`);
      const data = await fs.readFile(metadataFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.warn({ error: error.message, recordingId }, 'Failed to get recording');
      return null;
    }
  }

  /**
   * List all cloud recordings with optional filtering
   *
   * @param {object} filters - Filter options
   * @param {string} filters.userId - Filter by user
   * @param {string[]} filters.folders - Filter by folders
   * @param {string[]} filters.tags - Filter by tags
   * @param {string} filters.status - Filter by status
   * @param {number} filters.limit - Limit results
   * @param {number} filters.offset - Offset for pagination
   * @returns {Promise<object>} - List of recordings with pagination info
   */
  async listRecordings(filters = {}) {
    try {
      const files = await fs.readdir(this.metadataDir);
      let recordings = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const metadataFile = path.join(this.metadataDir, file);
          const data = await fs.readFile(metadataFile, 'utf8');
          const recording = JSON.parse(data);
          recordings.push(recording);
        } catch (error) {
          logger.warn({ error: error.message, file }, 'Failed to read recording metadata');
        }
      }

      // Apply filters
      if (filters.userId) {
        recordings = recordings.filter(r => r.userId === filters.userId);
      }

      if (filters.folders && filters.folders.length > 0) {
        recordings = recordings.filter(r =>
          r.folders.some(f => filters.folders.includes(f))
        );
      }

      if (filters.tags && filters.tags.length > 0) {
        recordings = recordings.filter(r =>
          r.tags.some(t => filters.tags.includes(t))
        );
      }

      if (filters.status) {
        recordings = recordings.filter(r => r.status === filters.status);
      }

      // Sort by creation date (newest first)
      recordings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Apply pagination
      const total = recordings.length;
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;
      const paginatedRecordings = recordings.slice(offset, offset + limit);

      return {
        recordings: paginatedRecordings,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to list cloud recordings');
      return {
        recordings: [],
        pagination: { total: 0, limit: 50, offset: 0, hasMore: false }
      };
    }
  }

  /**
   * Enable public sharing for a recording
   *
   * @param {string} recordingId - Recording identifier
   * @param {string} baseUrl - Base URL for sharing links
   * @returns {Promise<object>} - Sharing information
   */
  async enableSharing(recordingId, baseUrl = '') {
    const recording = await this.getRecording(recordingId);

    if (!recording) {
      throw new Error('Recording not found');
    }

    const sharingToken = this._generateSharingToken();
    const sharingUrl = `${baseUrl}/share/recording/${sharingToken}`;

    recording.sharingEnabled = true;
    recording.sharingToken = sharingToken;
    recording.sharingUrl = sharingUrl;
    recording.updatedAt = new Date().toISOString();

    await this._saveMetadata(recording);

    logger.info({ recordingId, sharingToken }, 'Enabled recording sharing');

    return {
      sharingEnabled: true,
      sharingToken,
      sharingUrl
    };
  }

  /**
   * Disable public sharing for a recording
   *
   * @param {string} recordingId - Recording identifier
   * @returns {Promise<void>}
   */
  async disableSharing(recordingId) {
    const recording = await this.getRecording(recordingId);

    if (!recording) {
      throw new Error('Recording not found');
    }

    recording.sharingEnabled = false;
    recording.sharingToken = null;
    recording.sharingUrl = null;
    recording.updatedAt = new Date().toISOString();

    await this._saveMetadata(recording);

    logger.info({ recordingId }, 'Disabled recording sharing');
  }

  /**
   * Get recording by sharing token
   *
   * @param {string} sharingToken - Sharing token
   * @returns {Promise<object|null>} - Recording metadata or null
   */
  async getRecordingByToken(sharingToken) {
    try {
      const files = await fs.readdir(this.metadataDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const metadataFile = path.join(this.metadataDir, file);
        const data = await fs.readFile(metadataFile, 'utf8');
        const recording = JSON.parse(data);

        if (recording.sharingToken === sharingToken && recording.sharingEnabled) {
          return recording;
        }
      }

      return null;
    } catch (error) {
      logger.error({ error: error.message, sharingToken }, 'Failed to get recording by token');
      return null;
    }
  }

  /**
   * Update recording metadata (folders, tags, etc.)
   *
   * @param {string} recordingId - Recording identifier
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} - Updated recording metadata
   */
  async updateRecording(recordingId, updates) {
    const recording = await this.getRecording(recordingId);

    if (!recording) {
      throw new Error('Recording not found');
    }

    // Allow updating only safe fields
    const allowedFields = ['roomName', 'folders', 'tags', 'retentionDays'];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        recording[field] = updates[field];
      }
    }

    // Update expiration if retention changed
    if (updates.retentionDays !== undefined) {
      const startTime = new Date(recording.startTime);
      recording.expiresAt = updates.retentionDays > 0
        ? new Date(startTime.getTime() + updates.retentionDays * 24 * 60 * 60 * 1000).toISOString()
        : null;
    }

    recording.updatedAt = new Date().toISOString();
    await this._saveMetadata(recording);

    logger.info({ recordingId, updates }, 'Updated recording metadata');

    return recording;
  }

  /**
   * Delete a cloud recording
   *
   * @param {string} recordingId - Recording identifier
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async deleteRecording(recordingId) {
    try {
      const recording = await this.getRecording(recordingId);

      if (!recording) {
        return false;
      }

      // Delete video file
      if (recording.videoFile) {
        const videoPath = path.join(this.videosDir, recording.videoFile);
        await fs.unlink(videoPath).catch(err =>
          logger.warn({ error: err.message, recordingId }, 'Failed to delete video file')
        );
      }

      // Delete transcript file
      if (recording.transcriptFile) {
        const transcriptPath = path.join(this.transcriptsDir, recording.transcriptFile);
        await fs.unlink(transcriptPath).catch(err =>
          logger.warn({ error: err.message, recordingId }, 'Failed to delete transcript file')
        );
      }

      // Delete thumbnail file
      if (recording.thumbnailFile) {
        const thumbnailPath = path.join(this.thumbnailsDir, recording.thumbnailFile);
        await fs.unlink(thumbnailPath).catch(err =>
          logger.warn({ error: err.message, recordingId }, 'Failed to delete thumbnail file')
        );
      }

      // Delete metadata file
      const metadataFile = path.join(this.metadataDir, `${recordingId}.json`);
      await fs.unlink(metadataFile);

      logger.info({ recordingId }, 'Deleted cloud recording');
      return true;

    } catch (error) {
      logger.error({ error: error.message, recordingId }, 'Failed to delete cloud recording');
      return false;
    }
  }

  /**
   * Get video file path
   *
   * @param {string} recordingId - Recording identifier
   * @returns {Promise<string|null>} - Video file path or null
   */
  async getVideoPath(recordingId) {
    const recording = await this.getRecording(recordingId);

    if (!recording || !recording.videoFile) {
      return null;
    }

    const videoPath = path.join(this.videosDir, recording.videoFile);

    try {
      await fs.access(videoPath);
      return videoPath;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get transcript
   *
   * @param {string} recordingId - Recording identifier
   * @returns {Promise<object|null>} - Transcript data or null
   */
  async getTranscript(recordingId) {
    const recording = await this.getRecording(recordingId);

    if (!recording || !recording.transcriptFile) {
      return null;
    }

    try {
      const transcriptPath = path.join(this.transcriptsDir, recording.transcriptFile);
      const data = await fs.readFile(transcriptPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.warn({ error: error.message, recordingId }, 'Failed to get transcript');
      return null;
    }
  }

  /**
   * Search in transcripts
   *
   * @param {string} query - Search query
   * @param {object} filters - Additional filters
   * @returns {Promise<Array>} - Search results
   */
  async searchTranscripts(query, filters = {}) {
    const { recordings } = await this.listRecordings(filters);
    const results = [];

    for (const recording of recordings) {
      if (!recording.transcriptText) continue;

      const text = recording.transcriptText.toLowerCase();
      const searchQuery = query.toLowerCase();

      if (text.includes(searchQuery)) {
        // Find context around the match
        const index = text.indexOf(searchQuery);
        const contextStart = Math.max(0, index - 50);
        const contextEnd = Math.min(text.length, index + searchQuery.length + 50);
        const context = recording.transcriptText.substring(contextStart, contextEnd);

        results.push({
          recordingId: recording.id,
          roomName: recording.roomName,
          startTime: recording.startTime,
          match: context,
          timestamp: null // TODO: Calculate timestamp from transcript segments
        });
      }
    }

    return results;
  }

  /**
   * Clean up expired recordings based on retention policy
   *
   * @returns {Promise<object>} - Cleanup statistics
   */
  async cleanupExpiredRecordings() {
    logger.info('Starting expired recordings cleanup');

    const now = new Date();
    const { recordings } = await this.listRecordings();

    let deleted = 0;
    let errors = 0;

    for (const recording of recordings) {
      if (!recording.expiresAt) continue;

      const expiresAt = new Date(recording.expiresAt);

      if (expiresAt < now) {
        try {
          await this.deleteRecording(recording.id);
          deleted++;
        } catch (error) {
          logger.error({ error: error.message, recordingId: recording.id }, 'Failed to delete expired recording');
          errors++;
        }
      }
    }

    logger.info({ deleted, errors }, 'Expired recordings cleanup completed');

    return { deleted, errors };
  }

  /**
   * Get storage statistics
   *
   * @returns {Promise<object>} - Storage statistics
   */
  async getStorageStats() {
    const { recordings } = await this.listRecordings();

    let totalSize = 0;
    let totalDuration = 0;
    const statusCounts = {};

    for (const recording of recordings) {
      totalSize += recording.videoSizeBytes || 0;
      totalDuration += recording.durationSeconds || 0;

      const status = recording.status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }

    return {
      totalRecordings: recordings.length,
      totalSizeBytes: totalSize,
      totalDurationSeconds: totalDuration,
      statusCounts,
      averageSizeBytes: recordings.length > 0 ? totalSize / recordings.length : 0,
      averageDurationSeconds: recordings.length > 0 ? totalDuration / recordings.length : 0
    };
  }
}

// Export singleton instance
export const cloudRecordingService = new CloudRecordingService();
export default CloudRecordingService;
