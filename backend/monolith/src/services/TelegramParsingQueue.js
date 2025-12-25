// TelegramParsingQueue.js - Queue system for processing Telegram message parsing jobs
import Queue from 'bull';
import logger from '../utils/logger.js';
import TelegramPublicChannelParser from './TelegramPublicChannelParser.js';

/**
 * Queue manager for Telegram message parsing
 * Uses Bull + Redis for robust job processing
 *
 * Features:
 * - Async job processing
 * - Automatic retries
 * - Rate limiting (30 req/sec)
 * - Progress tracking
 * - Job prioritization
 */
export class TelegramParsingQueue {
  constructor(config = {}) {
    // Redis configuration
    this.redisHost = config.redisHost || process.env.REDIS_HOST || 'localhost';
    this.redisPort = config.redisPort || process.env.REDIS_PORT || 6379;
    this.redisPassword = config.redisPassword || process.env.REDIS_PASSWORD || undefined;

    // Queue configuration
    this.queueName = config.queueName || 'telegram-parsing';
    this.concurrency = config.concurrency || 1; // Process one job at a time to respect rate limits

    // Telegram parser (will be initialized in worker)
    this.parser = null;

    // Create queue
    this.queue = new Queue(this.queueName, {
      redis: {
        host: this.redisHost,
        port: this.redisPort,
        password: this.redisPassword,
      },
      defaultJobOptions: {
        attempts: 3, // Retry up to 3 times
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 second delay, doubles each retry
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 100, // Keep last 100 failed jobs
      },
    });

    // Setup event handlers
    this.setupEventHandlers();

    logger.info({
      queue: this.queueName,
      redis: `${this.redisHost}:${this.redisPort}`
    }, 'Telegram parsing queue initialized');
  }

  /**
   * Setup queue event handlers
   */
  setupEventHandlers() {
    this.queue.on('error', (error) => {
      logger.error({ error: error.message }, 'Queue error');
    });

    this.queue.on('failed', (job, error) => {
      logger.error({
        jobId: job.id,
        error: error.message,
        data: job.data
      }, 'Job failed');
    });

    this.queue.on('completed', (job, result) => {
      logger.info({
        jobId: job.id,
        messageCount: result.messageCount,
        duration: result.duration
      }, 'Job completed');
    });

    this.queue.on('progress', (job, progress) => {
      logger.debug({
        jobId: job.id,
        progress: progress
      }, 'Job progress');
    });
  }

  /**
   * Add a parsing job to the queue
   * @param {Object} jobData - Job data
   * @param {string} jobData.channelUsername - Channel to parse
   * @param {number} jobData.limit - Max messages to fetch
   * @param {number} jobData.offsetId - Starting message ID
   * @param {string[]} jobData.filterKeywords - Keywords to filter
   * @param {Object} options - Job options
   * @param {number} options.priority - Job priority (1-10, higher = more priority)
   * @returns {Promise<Object>} - Job object
   */
  async addParsingJob(jobData, options = {}) {
    try {
      const job = await this.queue.add(jobData, {
        priority: options.priority || 5,
        ...options,
      });

      logger.info({
        jobId: job.id,
        channel: jobData.channelUsername,
        limit: jobData.limit
      }, 'Parsing job added to queue');

      return job;
    } catch (error) {
      logger.error({
        error: error.message,
        jobData
      }, 'Failed to add job to queue');
      throw error;
    }
  }

  /**
   * Start processing jobs
   * @param {Object} parserConfig - Configuration for TelegramPublicChannelParser
   */
  async startProcessing(parserConfig = {}) {
    // Initialize parser
    this.parser = new TelegramPublicChannelParser(parserConfig);

    try {
      // Connect to Telegram
      await this.parser.connect({
        // Note: For automated processing, session should be pre-configured
        // via TELEGRAM_SESSION env var. Manual auth not supported in worker.
      });

      logger.info('Telegram parser connected, starting job processing...');

      // Define job processor
      this.queue.process(this.concurrency, async (job) => {
        return this.processJob(job);
      });

      logger.info({
        concurrency: this.concurrency
      }, 'Queue processing started');
    } catch (error) {
      logger.error({
        error: error.message
      }, 'Failed to start queue processing');
      throw error;
    }
  }

  /**
   * Process a single parsing job
   * @param {Object} job - Bull job object
   * @returns {Promise<Object>} - Job result
   */
  async processJob(job) {
    const startTime = Date.now();
    const { channelUsername, limit, offsetId, filterKeywords } = job.data;

    try {
      logger.info({
        jobId: job.id,
        channel: channelUsername,
        limit
      }, 'Processing parsing job...');

      // Update progress: 10%
      await job.progress(10);

      // Parse channel
      const messages = await this.parser.parseChannel(channelUsername, {
        limit,
        offsetId,
        filterKeywords,
      });

      // Update progress: 70%
      await job.progress(70);

      // Save messages
      const savedPath = await this.parser.saveMessages(messages, channelUsername);

      // Update progress: 90%
      await job.progress(90);

      // Get statistics
      const stats = await this.parser.getChannelStatistics(channelUsername);

      // Update progress: 100%
      await job.progress(100);

      const duration = Date.now() - startTime;

      logger.info({
        jobId: job.id,
        channel: channelUsername,
        messageCount: messages.length,
        duration,
        savedPath
      }, 'Job completed successfully');

      return {
        success: true,
        messageCount: messages.length,
        savedPath,
        statistics: stats,
        duration,
      };
    } catch (error) {
      logger.error({
        jobId: job.id,
        channel: channelUsername,
        error: error.message,
        stack: error.stack
      }, 'Job processing failed');

      throw error; // Bull will handle retries
    }
  }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} - Job status
   */
  async getJobStatus(jobId) {
    try {
      const job = await this.queue.getJob(jobId);

      if (!job) {
        return { error: 'Job not found' };
      }

      const state = await job.getState();
      const progress = job._progress;

      return {
        id: job.id,
        state,
        progress,
        data: job.data,
        returnvalue: job.returnvalue,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      };
    } catch (error) {
      logger.error({
        error: error.message,
        jobId
      }, 'Failed to get job status');
      throw error;
    }
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>} - Queue stats
   */
  async getQueueStats() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      };
    } catch (error) {
      logger.error({
        error: error.message
      }, 'Failed to get queue stats');
      throw error;
    }
  }

  /**
   * Clean old jobs from queue
   * @param {number} grace - Grace period in milliseconds (default: 1 hour)
   * @returns {Promise<Array>} - Cleaned job IDs
   */
  async cleanQueue(grace = 3600000) {
    try {
      const cleaned = await this.queue.clean(grace, 'completed');
      const failedCleaned = await this.queue.clean(grace, 'failed');

      logger.info({
        completed: cleaned.length,
        failed: failedCleaned.length
      }, 'Queue cleaned');

      return [...cleaned, ...failedCleaned];
    } catch (error) {
      logger.error({
        error: error.message
      }, 'Failed to clean queue');
      throw error;
    }
  }

  /**
   * Pause queue processing
   * @returns {Promise<void>}
   */
  async pause() {
    await this.queue.pause();
    logger.info('Queue processing paused');
  }

  /**
   * Resume queue processing
   * @returns {Promise<void>}
   */
  async resume() {
    await this.queue.resume();
    logger.info('Queue processing resumed');
  }

  /**
   * Stop queue and disconnect parser
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      await this.queue.close();

      if (this.parser) {
        await this.parser.disconnect();
      }

      logger.info('Queue and parser stopped');
    } catch (error) {
      logger.error({
        error: error.message
      }, 'Failed to stop queue');
      throw error;
    }
  }

  /**
   * Get queue instance (for advanced operations)
   * @returns {Queue} - Bull queue instance
   */
  getQueue() {
    return this.queue;
  }
}

export default TelegramParsingQueue;
