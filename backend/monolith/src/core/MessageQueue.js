// MessageQueue.js - In-memory message queue with pub/sub
// Issue #2185: Replaced Redis with in-memory implementation
import EventEmitter from 'events';
import logger from '../utils/logger.js';

/**
 * MessageQueue provides in-memory message queue and pub/sub functionality
 * Replaces Redis-based implementation per Issue #2185
 */
export class MessageQueue extends EventEmitter {
  constructor(options = {}) {
    super();

    // Size limits to prevent unbounded growth
    this.maxQueueSize = options.maxQueueSize || 10000; // Max messages per queue
    this.maxStorageSize = options.maxStorageSize || 100000; // Max key-value pairs
    this.maxSubscriptions = options.maxSubscriptions || 1000; // Issue #60: Max subscription channels

    // In-memory storage for queues
    this.queues = new Map();

    // In-memory storage for key-value pairs
    this.storage = new Map();

    // In-memory storage for subscriptions
    this.subscriptions = new Map();

    // TTL timers for expiring keys
    this.ttlTimers = new Map();

    // Pending dequeue operations (for blocking behavior)
    this.pendingDequeues = new Map();

    // Issue #60: Start periodic cleanup
    this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute
    this._startCleanup();

    logger.info('MessageQueue initialized (in-memory mode)', {
      maxQueueSize: this.maxQueueSize,
      maxStorageSize: this.maxStorageSize,
      maxSubscriptions: this.maxSubscriptions,
      cleanupInterval: this.cleanupInterval
    });
  }

  /**
   * Connect - no-op for in-memory implementation
   * Kept for API compatibility
   */
  async connect() {
    logger.info('MessageQueue connected (in-memory mode)');
    this.emit('connected');
  }

  /**
   * Disconnect - cleanup for in-memory implementation
   * Issue #60: Improved to clear all Maps and timers
   */
  async disconnect() {
    // Stop cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Clear all TTL timers
    for (const timer of this.ttlTimers.values()) {
      clearTimeout(timer);
    }
    this.ttlTimers.clear();

    // Clear all pending dequeues
    for (const pending of this.pendingDequeues.values()) {
      for (const deferred of pending) {
        deferred.resolve(null);
      }
    }
    this.pendingDequeues.clear();

    // Issue #60: Clear all subscriptions
    this.subscriptions.clear();

    // Issue #60: Clear storage and queues
    this.storage.clear();
    this.queues.clear();

    // Issue #60: Remove all event listeners
    this.removeAllListeners();

    logger.info('MessageQueue disconnected (in-memory mode)');
    this.emit('disconnected');
  }

  /**
   * Push a message to a queue
   */
  async enqueue(queueName, message) {
    try {
      if (!this.queues.has(queueName)) {
        this.queues.set(queueName, []);
      }

      const queue = this.queues.get(queueName);

      // Enforce queue size limit - drop oldest message if full
      if (queue.length >= this.maxQueueSize) {
        const dropped = queue.shift();
        logger.warn({
          queueName,
          droppedMessageId: dropped?.id,
          queueSize: queue.length
        }, 'Queue size limit reached, dropping oldest message');
      }

      queue.push(message);

      logger.debug({ queueName, messageId: message.id }, 'Message enqueued');

      // Check if there are pending dequeue operations
      this._notifyPendingDequeues(queueName);
    } catch (error) {
      logger.error({ queueName, error: error.message }, 'Failed to enqueue message');
      throw error;
    }
  }

  /**
   * Pop a message from a queue (blocking with timeout)
   * @param {string} queueName - Queue name
   * @param {number} timeout - Timeout in seconds (0 = wait indefinitely)
   */
  async dequeue(queueName, timeout = 0) {
    try {
      // Check if queue has messages
      if (this.queues.has(queueName) && this.queues.get(queueName).length > 0) {
        const queue = this.queues.get(queueName);
        const message = queue.shift();
        logger.debug({ queueName, messageId: message.id }, 'Message dequeued');
        return message;
      }

      // No messages available - implement blocking behavior
      return new Promise((resolve) => {
        const timeoutMs = timeout * 1000;
        let timer = null;

        // Create deferred dequeue operation
        const deferred = {
          resolve: (msg) => {
            if (timer) clearTimeout(timer);
            resolve(msg);
          }
        };

        // Add to pending dequeues
        if (!this.pendingDequeues.has(queueName)) {
          this.pendingDequeues.set(queueName, []);
        }
        this.pendingDequeues.get(queueName).push(deferred);

        // Set timeout if specified
        if (timeout > 0) {
          timer = setTimeout(() => {
            // Remove from pending
            const pending = this.pendingDequeues.get(queueName);
            if (pending) {
              const index = pending.indexOf(deferred);
              if (index > -1) {
                pending.splice(index, 1);
              }
            }
            resolve(null);
          }, timeoutMs);
        }
      });
    } catch (error) {
      logger.error({ queueName, error: error.message }, 'Failed to dequeue message');
      throw error;
    }
  }

  /**
   * Notify pending dequeue operations when new message arrives
   * @private
   */
  _notifyPendingDequeues(queueName) {
    const pending = this.pendingDequeues.get(queueName);
    if (!pending || pending.length === 0) return;

    const queue = this.queues.get(queueName);
    if (!queue || queue.length === 0) return;

    // Process pending dequeues in FIFO order
    while (pending.length > 0 && queue.length > 0) {
      const deferred = pending.shift();
      const message = queue.shift();
      deferred.resolve(message);
      logger.debug({ queueName, messageId: message.id }, 'Message dequeued (pending)');
    }
  }

  /**
   * Get queue length
   */
  async getQueueLength(queueName) {
    try {
      if (!this.queues.has(queueName)) {
        return 0;
      }
      return this.queues.get(queueName).length;
    } catch (error) {
      logger.error({ queueName, error: error.message }, 'Failed to get queue length');
      throw error;
    }
  }

  /**
   * Publish a message to a channel
   */
  async publish(channel, message) {
    try {
      const handlers = this.subscriptions.get(channel);
      if (handlers && handlers.length > 0) {
        for (const handler of handlers) {
          try {
            handler(message);
          } catch (err) {
            logger.error({ channel, error: err.message }, 'Error in subscription handler');
          }
        }
      }

      this.emit('message', { channel, message });
      logger.debug({ channel, messageId: message.id }, 'Message published');
    } catch (error) {
      logger.error({ channel, error: error.message }, 'Failed to publish message');
      throw error;
    }
  }

  /**
   * Subscribe to a channel
   * Issue #60: Enforce maxSubscriptions limit
   */
  async subscribe(channel, handler) {
    try {
      if (!this.subscriptions.has(channel)) {
        // Issue #60: Check subscription limit before adding new channel
        if (this.subscriptions.size >= this.maxSubscriptions) {
          throw new Error(`Maximum subscriptions limit reached: ${this.maxSubscriptions}`);
        }
        this.subscriptions.set(channel, []);
      }

      this.subscriptions.get(channel).push(handler);
      logger.info({ channel }, 'Subscribed to channel');
    } catch (error) {
      logger.error({ channel, error: error.message }, 'Failed to subscribe to channel');
      throw error;
    }
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel, handler = null) {
    try {
      if (!this.subscriptions.has(channel)) return;

      if (handler) {
        // Remove specific handler
        const handlers = this.subscriptions.get(channel);
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      } else {
        // Remove all handlers for this channel
        this.subscriptions.delete(channel);
      }

      logger.info({ channel }, 'Unsubscribed from channel');
    } catch (error) {
      logger.error({ channel, error: error.message }, 'Failed to unsubscribe from channel');
      throw error;
    }
  }

  /**
   * Set a key with optional expiration
   */
  async set(key, value, ttl = null) {
    try {
      // Enforce storage size limit - remove oldest key if full
      if (this.storage.size >= this.maxStorageSize && !this.storage.has(key)) {
        const firstKey = this.storage.keys().next().value;
        this.storage.delete(firstKey);

        // Also clear TTL timer for removed key
        if (this.ttlTimers.has(firstKey)) {
          clearTimeout(this.ttlTimers.get(firstKey));
          this.ttlTimers.delete(firstKey);
        }

        logger.warn({
          removedKey: firstKey,
          storageSize: this.storage.size
        }, 'Storage size limit reached, removing oldest key');
      }

      this.storage.set(key, value);

      // Clear existing TTL timer if any
      if (this.ttlTimers.has(key)) {
        clearTimeout(this.ttlTimers.get(key));
        this.ttlTimers.delete(key);
      }

      // Set new TTL timer if specified
      if (ttl) {
        const timer = setTimeout(() => {
          this.storage.delete(key);
          this.ttlTimers.delete(key);
          logger.debug({ key }, 'Key expired');
        }, ttl * 1000);
        this.ttlTimers.set(key, timer);
      }
    } catch (error) {
      logger.error({ key, error: error.message }, 'Failed to set key');
      throw error;
    }
  }

  /**
   * Get a key
   */
  async get(key) {
    try {
      return this.storage.get(key) || null;
    } catch (error) {
      logger.error({ key, error: error.message }, 'Failed to get key');
      throw error;
    }
  }

  /**
   * Delete a key
   */
  async delete(key) {
    try {
      // Clear TTL timer if exists
      if (this.ttlTimers.has(key)) {
        clearTimeout(this.ttlTimers.get(key));
        this.ttlTimers.delete(key);
      }

      this.storage.delete(key);
    } catch (error) {
      logger.error({ key, error: error.message }, 'Failed to delete key');
      throw error;
    }
  }

  /**
   * Start periodic cleanup
   * Issue #60: Prevent unbounded memory growth
   * @private
   */
  _startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this._cleanup();
    }, this.cleanupInterval);

    logger.debug('MessageQueue cleanup timer started');
  }

  /**
   * Cleanup expired and orphaned resources
   * Issue #60: Prevent memory leaks
   * @private
   */
  _cleanup() {
    const initialMetrics = {
      subscriptions: this.subscriptions.size,
      ttlTimers: this.ttlTimers.size,
      pendingDequeues: this.pendingDequeues.size,
      storage: this.storage.size
    };

    // Cleanup empty subscription channels
    this._cleanupSubscriptions();

    // Cleanup orphaned TTL timers
    this._cleanupExpiredTimers();

    // Cleanup empty pending dequeues
    this._cleanupPendingDequeues();

    // Enforce storage limit
    this._enforceStorageLimit();

    const finalMetrics = {
      subscriptions: this.subscriptions.size,
      ttlTimers: this.ttlTimers.size,
      pendingDequeues: this.pendingDequeues.size,
      storage: this.storage.size
    };

    // Log cleanup stats if something was removed
    if (
      initialMetrics.subscriptions !== finalMetrics.subscriptions ||
      initialMetrics.ttlTimers !== finalMetrics.ttlTimers ||
      initialMetrics.pendingDequeues !== finalMetrics.pendingDequeues ||
      initialMetrics.storage !== finalMetrics.storage
    ) {
      logger.info({ initial: initialMetrics, final: finalMetrics }, 'MessageQueue cleanup completed');
    }
  }

  /**
   * Cleanup empty subscription channels
   * Issue #60: Remove channels with no handlers
   * @private
   */
  _cleanupSubscriptions() {
    for (const [channel, handlers] of this.subscriptions.entries()) {
      if (handlers.length === 0) {
        this.subscriptions.delete(channel);
      }
    }
  }

  /**
   * Cleanup orphaned TTL timers
   * Issue #60: Remove timers for non-existent keys
   * @private
   */
  _cleanupExpiredTimers() {
    for (const [key, timer] of this.ttlTimers.entries()) {
      if (!this.storage.has(key)) {
        clearTimeout(timer);
        this.ttlTimers.delete(key);
      }
    }
  }

  /**
   * Cleanup empty pending dequeue lists
   * Issue #60: Remove queues with no pending operations
   * @private
   */
  _cleanupPendingDequeues() {
    for (const [queueName, pending] of this.pendingDequeues.entries()) {
      if (pending.length === 0) {
        this.pendingDequeues.delete(queueName);
      }
    }
  }

  /**
   * Enforce storage size limit
   * Issue #60: Ensure storage doesn't exceed maxStorageSize
   * @private
   */
  _enforceStorageLimit() {
    if (this.storage.size > this.maxStorageSize) {
      const excess = this.storage.size - this.maxStorageSize;
      const keys = Array.from(this.storage.keys());

      // Remove oldest elements (FIFO)
      for (let i = 0; i < excess; i++) {
        const key = keys[i];
        this.storage.delete(key);

        // Also clear TTL timer if exists
        if (this.ttlTimers.has(key)) {
          clearTimeout(this.ttlTimers.get(key));
          this.ttlTimers.delete(key);
        }
      }

      logger.warn({ excess, maxStorageSize: this.maxStorageSize }, 'Storage limit exceeded, removed oldest items');
    }
  }

  /**
   * Get memory usage metrics
   * Issue #60: Added for monitoring memory usage
   */
  getMetrics() {
    return {
      queuesCount: this.queues.size,
      storageSize: this.storage.size,
      maxStorageSize: this.maxStorageSize,
      subscriptionsCount: this.subscriptions.size,
      maxSubscriptions: this.maxSubscriptions,
      ttlTimersCount: this.ttlTimers.size,
      pendingDequeuesCount: this.pendingDequeues.size,

      // Warning flags
      storageNearLimit: this.storage.size > this.maxStorageSize * 0.8,
      subscriptionsNearLimit: this.subscriptions.size > this.maxSubscriptions * 0.8
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      // Always healthy for in-memory implementation
      return true;
    } catch (error) {
      logger.error({ error: error.message }, 'MessageQueue health check failed');
      return false;
    }
  }
}
