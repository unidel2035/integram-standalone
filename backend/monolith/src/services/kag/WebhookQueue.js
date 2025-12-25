/**
 * Webhook Event Queue using Bull
 *
 * Manages async processing of GitHub webhook events with:
 * - Job queue with priorities
 * - Retry failed jobs with exponential backoff
 * - Job status tracking
 *
 * Issue #5079
 *
 * @module WebhookQueue
 */

import Queue from 'bull';
import logger from '../../utils/logger.js';

class WebhookQueue {
  constructor() {
    // Redis connection config from environment
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0')
    };

    // Create Bull queue
    this.queue = new Queue('kag-webhooks', {
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 3, // Retry failed jobs up to 3 times
        backoff: {
          type: 'exponential',
          delay: 5000 // Start with 5 second delay, then 10s, 20s
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: false // Keep failed jobs for debugging
      }
    });

    // Setup event listeners
    this.setupEventListeners();

    logger.info('[WebhookQueue] Queue initialized', { redis: redisConfig });
  }

  /**
   * Setup queue event listeners
   * @private
   */
  setupEventListeners() {
    this.queue.on('completed', (job, result) => {
      logger.info('[WebhookQueue] Job completed', {
        jobId: job.id,
        event: job.data.event,
        result
      });
    });

    this.queue.on('failed', (job, error) => {
      logger.error('[WebhookQueue] Job failed', {
        jobId: job.id,
        event: job.data.event,
        error: error.message,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts
      });
    });

    this.queue.on('stalled', (job) => {
      logger.warn('[WebhookQueue] Job stalled', {
        jobId: job.id,
        event: job.data.event
      });
    });

    this.queue.on('error', (error) => {
      logger.error('[WebhookQueue] Queue error', { error: error.message });
    });
  }

  /**
   * Add webhook event to queue
   * @param {Object} data - Webhook event data
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job instance
   */
  async add(data, options = {}) {
    const { event, deliveryId } = data;

    // Determine priority based on event type
    const priority = this.getEventPriority(event);

    const jobOptions = {
      priority,
      jobId: `webhook_${event}_${deliveryId}`,
      ...options
    };

    const job = await this.queue.add(data, jobOptions);

    logger.info('[WebhookQueue] Job added to queue', {
      jobId: job.id,
      event,
      priority
    });

    return job;
  }

  /**
   * Get priority for event type
   * Lower number = higher priority
   * @param {string} event - Event type
   * @returns {number} Priority (1-10)
   * @private
   */
  getEventPriority(event) {
    const priorities = {
      'issues': 1,           // Highest priority
      'issue_comment': 2,
      'pull_request': 3,
      'push': 4,
      'default': 5           // Lowest priority
    };

    return priorities[event] || priorities.default;
  }

  /**
   * Process jobs from queue
   * @param {Function} processor - Job processor function
   * @param {Object} options - Processing options
   */
  process(processor, options = {}) {
    const { concurrency = 5 } = options;

    this.queue.process(concurrency, async (job) => {
      logger.info('[WebhookQueue] Processing job', {
        jobId: job.id,
        event: job.data.event,
        attempt: job.attemptsMade + 1
      });

      try {
        const result = await processor(job.data);
        return result;
      } catch (error) {
        logger.error('[WebhookQueue] Job processor error', {
          jobId: job.id,
          event: job.data.event,
          error: error.message
        });
        throw error; // Re-throw to trigger retry
      }
    });

    logger.info('[WebhookQueue] Queue processor started', { concurrency });
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>} Queue stats
   */
  async getStats() {
    const [
      waitingCount,
      activeCount,
      completedCount,
      failedCount,
      delayedCount
    ] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount()
    ]);

    return {
      waiting: waitingCount,
      active: activeCount,
      completed: completedCount,
      failed: failedCount,
      delayed: delayedCount,
      total: waitingCount + activeCount + completedCount + failedCount + delayedCount
    };
  }

  /**
   * Get job by ID
   * @param {string} jobId - Job ID
   * @returns {Promise<Object|null>} Job instance or null
   */
  async getJob(jobId) {
    return await this.queue.getJob(jobId);
  }

  /**
   * Get failed jobs
   * @param {number} start - Start index
   * @param {number} end - End index
   * @returns {Promise<Array>} Failed jobs
   */
  async getFailedJobs(start = 0, end = 10) {
    return await this.queue.getFailed(start, end);
  }

  /**
   * Retry failed job
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Retried job
   */
  async retryJob(jobId) {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.retry();
    logger.info('[WebhookQueue] Job retried', { jobId });
    return job;
  }

  /**
   * Clear completed jobs
   * @returns {Promise<void>}
   */
  async clearCompleted() {
    await this.queue.clean(0, 'completed');
    logger.info('[WebhookQueue] Completed jobs cleared');
  }

  /**
   * Pause queue processing
   * @returns {Promise<void>}
   */
  async pause() {
    await this.queue.pause();
    logger.info('[WebhookQueue] Queue paused');
  }

  /**
   * Resume queue processing
   * @returns {Promise<void>}
   */
  async resume() {
    await this.queue.resume();
    logger.info('[WebhookQueue] Queue resumed');
  }

  /**
   * Close queue (cleanup)
   * @returns {Promise<void>}
   */
  async close() {
    await this.queue.close();
    logger.info('[WebhookQueue] Queue closed');
  }
}

// Singleton instance
let webhookQueueInstance = null;

export function getWebhookQueue() {
  if (!webhookQueueInstance) {
    webhookQueueInstance = new WebhookQueue();
  }
  return webhookQueueInstance;
}

export default WebhookQueue;
