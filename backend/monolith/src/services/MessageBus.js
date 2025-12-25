// MessageBus.js - WebSocket-based message broker for agent communication
import EventEmitter from 'events';
import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';
import metrics from '../utils/metrics.js';
import { BoundedMap } from '../utils/memoryOptimization.js';
import { CircuitBreakerManager } from './CircuitBreakerManager.js';

/**
 * Message types for agent communication
 */
export const MessageType = {
  REQUEST: 'request',           // Request-response pattern (requires response)
  RESPONSE: 'response',          // Response to a request
  NOTIFICATION: 'notification',  // Fire-and-forget (no response expected)
  HANDOFF: 'handoff',           // Transfer control to another agent
  BROADCAST: 'broadcast'         // Broadcast to multiple agents
};

/**
 * Message delivery status
 */
export const MessageStatus = {
  PENDING: 'pending',
  DELIVERED: 'delivered',
  ACKNOWLEDGED: 'acknowledged',
  FAILED: 'failed',
  EXPIRED: 'expired'
};

/**
 * MessageBus provides WebSocket-based message broker for agent-to-agent communication
 * Implements Phase 2 communication protocol (Issue #2459)
 */
export class MessageBus extends EventEmitter {
  constructor(options = {}) {
    super();

    // Message storage
    this.maxMessages = options.maxMessages || 50000;
    this.messages = new BoundedMap(this.maxMessages);

    // Pending requests (waiting for responses)
    this.pendingRequests = new Map(); // messageId -> { resolve, reject, timeout }

    // Message persistence and retry
    this.messageRetryAttempts = options.messageRetryAttempts || 3;
    this.messageRetryDelay = options.messageRetryDelay || 1000; // 1 second
    this.messageDefaultTTL = options.messageDefaultTTL || 3600000; // 1 hour

    // WebSocket connections
    this.connections = new Map(); // agentId -> WebSocket connection

    // Conversation tracking
    this.conversations = new BoundedMap(options.maxConversations || 10000);

    // Message queue for retry
    this.retryQueue = [];

    // Circuit Breaker Manager (Issue #2707 - Phase 3.2)
    this.circuitBreakerManager = new CircuitBreakerManager({
      defaultConfig: options.circuitBreakerConfig || {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000 // 60 seconds
      }
    });

    // Forward circuit breaker events
    this.circuitBreakerManager.on('breaker:state:changed', (event) => {
      this.emit('circuitBreaker:stateChanged', event);
      logger.info({ event }, 'Circuit breaker state changed');
    });

    // Start periodic cleanup and retry
    this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute
    this._startCleanupTimer();
    this._startRetryTimer();

    logger.info('MessageBus initialized', {
      maxMessages: this.maxMessages,
      messageRetryAttempts: this.messageRetryAttempts,
      messageRetryDelay: this.messageRetryDelay,
      circuitBreakerEnabled: true
    });
  }

  /**
   * Register a WebSocket connection for an agent
   */
  registerConnection(agentId, ws) {
    this.connections.set(agentId, ws);

    // Set up WebSocket event handlers
    ws.on('message', (data) => {
      this._handleIncomingMessage(agentId, data);
    });

    ws.on('close', () => {
      this.unregisterConnection(agentId);
    });

    ws.on('error', (error) => {
      logger.error({ agentId, error: error.message }, 'WebSocket error');
    });

    logger.info({ agentId }, 'Agent WebSocket connection registered');
    this.emit('connection:registered', { agentId });
  }

  /**
   * Unregister a WebSocket connection
   */
  unregisterConnection(agentId) {
    const ws = this.connections.get(agentId);
    if (ws) {
      this.connections.delete(agentId);
      logger.info({ agentId }, 'Agent WebSocket connection unregistered');
      this.emit('connection:unregistered', { agentId });
    }
  }

  /**
   * Send a request message (expects response)
   * Uses circuit breaker pattern to prevent cascade failures (Issue #2707)
   */
  async sendRequest(fromAgentId, toAgentId, payload, options = {}) {
    // Use circuit breaker to protect against failed agents
    return this.circuitBreakerManager.executeWithBreaker(
      toAgentId,
      async () => {
        const message = this._createMessage({
          from: { agentId: fromAgentId },
          to: { agentId: toAgentId },
          messageType: MessageType.REQUEST,
          payload,
          ...options
        });

        // Store message
        this.messages.set(message.messageId, message);

        // Send message
        const sent = await this._sendMessage(toAgentId, message);

        if (!sent) {
          // Add to retry queue if send failed
          this._addToRetryQueue(message);
          throw new Error(`Failed to send request to agent ${toAgentId}`);
        }

        // Wait for response (with timeout)
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.pendingRequests.delete(message.messageId);
            message.status = MessageStatus.EXPIRED;
            reject(new Error(`Request timeout for message ${message.messageId}`));
          }, message.metadata.ttl);

          this.pendingRequests.set(message.messageId, { resolve, reject, timeout });
        });
      },
      options.circuitBreakerConfig
    );
  }

  /**
   * Send a response message
   */
  async sendResponse(originalMessageId, fromAgentId, toAgentId, payload, options = {}) {
    const originalMessage = this.messages.get(originalMessageId);
    if (!originalMessage) {
      throw new Error(`Original message ${originalMessageId} not found`);
    }

    const message = this._createMessage({
      from: { agentId: fromAgentId },
      to: { agentId: toAgentId },
      messageType: MessageType.RESPONSE,
      payload,
      conversationId: originalMessage.conversationId,
      metadata: {
        ...options.metadata,
        responseToMessageId: originalMessageId
      },
      ...options
    });

    // Store message
    this.messages.set(message.messageId, message);

    // Send message
    const sent = await this._sendMessage(toAgentId, message);

    // Resolve pending request if exists
    const pendingRequest = this.pendingRequests.get(originalMessageId);
    if (pendingRequest) {
      clearTimeout(pendingRequest.timeout);
      pendingRequest.resolve(payload);
      this.pendingRequests.delete(originalMessageId);
    }

    return sent;
  }

  /**
   * Send a notification (fire-and-forget)
   */
  async sendNotification(fromAgentId, toAgentId, payload, options = {}) {
    const message = this._createMessage({
      from: { agentId: fromAgentId },
      to: { agentId: toAgentId },
      messageType: MessageType.NOTIFICATION,
      payload,
      ...options
    });

    // Store message
    this.messages.set(message.messageId, message);

    // Send message
    const sent = await this._sendMessage(toAgentId, message);

    if (!sent && message.metadata.requiresAck) {
      // Add to retry queue if ack required
      this._addToRetryQueue(message);
    }

    return message;
  }

  /**
   * Send a handoff message (transfer control)
   */
  async sendHandoff(fromAgentId, toAgentId, payload, options = {}) {
    const message = this._createMessage({
      from: { agentId: fromAgentId },
      to: { agentId: toAgentId },
      messageType: MessageType.HANDOFF,
      payload: {
        ...payload,
        handoffReason: options.handoffReason || 'Manual handoff',
        context: options.context || {}
      },
      ...options
    });

    // Store message
    this.messages.set(message.messageId, message);

    // Send message
    const sent = await this._sendMessage(toAgentId, message);

    if (!sent) {
      throw new Error(`Failed to send handoff to agent ${toAgentId}`);
    }

    logger.info({ fromAgentId, toAgentId, messageId: message.messageId }, 'Handoff message sent');
    this.emit('handoff:sent', message);

    return message;
  }

  /**
   * Broadcast message to multiple agents
   */
  async broadcast(fromAgentId, toAgentIds, payload, options = {}) {
    const messages = [];

    for (const toAgentId of toAgentIds) {
      const message = this._createMessage({
        from: { agentId: fromAgentId },
        to: { agentId: toAgentId },
        messageType: MessageType.BROADCAST,
        payload,
        ...options
      });

      // Store message
      this.messages.set(message.messageId, message);

      // Send message (don't wait)
      this._sendMessage(toAgentId, message).catch(error => {
        logger.error({ toAgentId, error: error.message }, 'Broadcast send failed');
      });

      messages.push(message);
    }

    logger.info({ fromAgentId, recipientCount: toAgentIds.length }, 'Broadcast message sent');
    this.emit('broadcast:sent', { fromAgentId, messages });

    return messages;
  }

  /**
   * Acknowledge message receipt
   */
  acknowledgeMessage(messageId, agentId) {
    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    message.status = MessageStatus.ACKNOWLEDGED;
    message.acknowledgedAt = new Date();
    message.acknowledgedBy = agentId;

    logger.debug({ messageId, agentId }, 'Message acknowledged');
    this.emit('message:acknowledged', message);

    return message;
  }

  /**
   * Get conversation history
   */
  getConversation(conversationId) {
    return this.conversations.get(conversationId);
  }

  /**
   * Get messages for a conversation
   */
  getConversationMessages(conversationId) {
    return Array.from(this.messages.values())
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => a.metadata.timestamp.localeCompare(b.metadata.timestamp));
  }

  /**
   * Get message by ID
   */
  getMessage(messageId) {
    return this.messages.get(messageId);
  }

  /**
   * Get all messages
   */
  getAllMessages() {
    return Array.from(this.messages.values());
  }

  /**
   * Get messages by status
   */
  getMessagesByStatus(status) {
    return Array.from(this.messages.values()).filter(m => m.status === status);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalMessages: this.messages.size,
      pendingRequests: this.pendingRequests.size,
      activeConnections: this.connections.size,
      retryQueueSize: this.retryQueue.length,
      conversations: this.conversations.size,
      messagesByStatus: {
        pending: this.getMessagesByStatus(MessageStatus.PENDING).length,
        delivered: this.getMessagesByStatus(MessageStatus.DELIVERED).length,
        acknowledged: this.getMessagesByStatus(MessageStatus.ACKNOWLEDGED).length,
        failed: this.getMessagesByStatus(MessageStatus.FAILED).length,
        expired: this.getMessagesByStatus(MessageStatus.EXPIRED).length
      },
      circuitBreakers: this.circuitBreakerManager.getStats()
    };
  }

  /**
   * Get circuit breaker states (Issue #2707)
   */
  getCircuitBreakerStates() {
    return this.circuitBreakerManager.getAllStates();
  }

  /**
   * Reset a circuit breaker (Issue #2707)
   */
  resetCircuitBreaker(agentId) {
    return this.circuitBreakerManager.reset(agentId);
  }

  /**
   * Reset all circuit breakers (Issue #2707)
   */
  resetAllCircuitBreakers() {
    return this.circuitBreakerManager.resetAll();
  }

  /**
   * Create a message object
   * @private
   */
  _createMessage(data) {
    const conversationId = data.conversationId || randomUUID();

    const message = {
      messageId: data.messageId || randomUUID(),
      from: data.from,
      to: data.to,
      conversationId,
      processInstanceId: data.processInstanceId || null,
      taskInstanceId: data.taskInstanceId || null,
      messageType: data.messageType,
      payload: data.payload,
      metadata: {
        priority: data.priority || 3,
        ttl: data.ttl || this.messageDefaultTTL,
        requiresAck: data.requiresAck !== undefined ? data.requiresAck : false,
        timestamp: new Date().toISOString(),
        ...data.metadata
      },
      status: MessageStatus.PENDING,
      retryCount: 0,
      createdAt: new Date(),
      deliveredAt: null,
      acknowledgedAt: null,
      acknowledgedBy: null
    };

    // Track conversation
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, {
        conversationId,
        participants: new Set([data.from.agentId, data.to.agentId]),
        createdAt: new Date(),
        messageCount: 0
      });
    }

    const conversation = this.conversations.get(conversationId);
    conversation.participants.add(data.from.agentId);
    conversation.participants.add(data.to.agentId);
    conversation.messageCount++;

    return message;
  }

  /**
   * Send message to agent via WebSocket
   * @private
   */
  async _sendMessage(toAgentId, message) {
    const ws = this.connections.get(toAgentId);

    if (!ws || ws.readyState !== 1) { // 1 = OPEN
      logger.warn({ toAgentId, messageId: message.messageId }, 'Agent not connected');
      message.status = MessageStatus.FAILED;
      return false;
    }

    try {
      ws.send(JSON.stringify(message));
      message.status = MessageStatus.DELIVERED;
      message.deliveredAt = new Date();

      metrics.increment('messagesDelivered');
      logger.debug({ toAgentId, messageId: message.messageId }, 'Message delivered');
      this.emit('message:delivered', message);

      return true;
    } catch (error) {
      logger.error({ toAgentId, messageId: message.messageId, error: error.message },
        'Failed to send message');
      message.status = MessageStatus.FAILED;
      metrics.increment('messagesFailed');
      return false;
    }
  }

  /**
   * Handle incoming message from WebSocket
   * @private
   */
  _handleIncomingMessage(agentId, data) {
    try {
      const message = JSON.parse(data.toString());

      logger.debug({ agentId, messageType: message.messageType }, 'Received message from agent');

      // Emit event based on message type
      switch (message.messageType) {
        case MessageType.REQUEST:
          this.emit('message:request', { agentId, message });
          break;

        case MessageType.RESPONSE:
          this.emit('message:response', { agentId, message });
          // Handle response for pending request
          const pendingRequest = this.pendingRequests.get(message.metadata.responseToMessageId);
          if (pendingRequest) {
            clearTimeout(pendingRequest.timeout);
            pendingRequest.resolve(message.payload);
            this.pendingRequests.delete(message.metadata.responseToMessageId);
          }
          break;

        case MessageType.NOTIFICATION:
          this.emit('message:notification', { agentId, message });
          break;

        case MessageType.HANDOFF:
          this.emit('message:handoff', { agentId, message });
          break;

        case MessageType.BROADCAST:
          this.emit('message:broadcast', { agentId, message });
          break;

        default:
          logger.warn({ agentId, messageType: message.messageType }, 'Unknown message type');
      }

      // Emit generic message event
      this.emit('message:received', { agentId, message });

      metrics.increment('messagesReceived');
    } catch (error) {
      logger.error({ agentId, error: error.message }, 'Failed to parse incoming message');
    }
  }

  /**
   * Add message to retry queue
   * @private
   */
  _addToRetryQueue(message) {
    if (message.retryCount >= this.messageRetryAttempts) {
      message.status = MessageStatus.FAILED;
      logger.error({ messageId: message.messageId }, 'Message failed after max retry attempts');
      return;
    }

    this.retryQueue.push(message);
    logger.debug({ messageId: message.messageId, retryCount: message.retryCount },
      'Message added to retry queue');
  }

  /**
   * Start retry timer
   * @private
   */
  _startRetryTimer() {
    this.retryTimer = setInterval(() => {
      this._retryFailedMessages();
    }, this.messageRetryDelay);

    logger.debug('Message retry timer started');
  }

  /**
   * Retry failed messages
   * @private
   */
  async _retryFailedMessages() {
    if (this.retryQueue.length === 0) {
      return;
    }

    const messagesToRetry = [...this.retryQueue];
    this.retryQueue = [];

    for (const message of messagesToRetry) {
      message.retryCount++;

      const sent = await this._sendMessage(message.to.agentId, message);

      if (!sent) {
        this._addToRetryQueue(message);
      } else {
        logger.info({ messageId: message.messageId, retryCount: message.retryCount },
          'Message retry successful');
      }
    }
  }

  /**
   * Start cleanup timer
   * @private
   */
  _startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this._cleanup();
    }, this.cleanupInterval);

    logger.debug('MessageBus cleanup timer started');
  }

  /**
   * Cleanup expired messages and conversations
   * @private
   */
  _cleanup() {
    const now = Date.now();
    const messagesToRemove = [];

    // Find expired messages
    for (const [messageId, message] of this.messages.entries()) {
      const messageAge = now - new Date(message.createdAt).getTime();

      if (messageAge > message.metadata.ttl) {
        if (message.status === MessageStatus.PENDING) {
          message.status = MessageStatus.EXPIRED;
        }

        // Remove very old messages (2x TTL)
        if (messageAge > message.metadata.ttl * 2) {
          messagesToRemove.push(messageId);
        }
      }
    }

    // Remove old messages
    for (const messageId of messagesToRemove) {
      this.messages.delete(messageId);
    }

    if (messagesToRemove.length > 0) {
      logger.info({ removedMessages: messagesToRemove.length }, 'MessageBus cleanup completed');
    }
  }

  /**
   * Shutdown the message bus
   */
  shutdown() {
    logger.info('Shutting down MessageBus');

    // Stop timers
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Close all WebSocket connections
    for (const [agentId, ws] of this.connections.entries()) {
      ws.close();
    }

    // Reject all pending requests
    for (const [messageId, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(new Error('MessageBus shutting down'));
    }

    // Clear data structures
    this.connections.clear();
    this.pendingRequests.clear();
    this.messages.clear();
    this.conversations.clear();
    this.retryQueue = [];
  }
}
