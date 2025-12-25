// MessageBus.spec.js - Unit tests for MessageBus
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageBus, MessageType, MessageStatus } from '../MessageBus.js';
import { EventEmitter } from 'events';

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = 1; // OPEN
    this.sentMessages = [];
  }

  send(data) {
    this.sentMessages.push(data);
    // Simulate successful send
    return true;
  }

  close() {
    this.readyState = 3; // CLOSED
  }
}

describe('MessageBus', () => {
  let messageBus;

  beforeEach(() => {
    messageBus = new MessageBus({
      maxMessages: 1000,
      messageRetryAttempts: 3,
      messageRetryDelay: 100,
      messageDefaultTTL: 60000,
      cleanupInterval: 10000
    });
  });

  afterEach(() => {
    messageBus.shutdown();
  });

  describe('WebSocket Connection Management', () => {
    it('should register a WebSocket connection', () => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-1', ws);

      expect(messageBus.connections.has('agent-1')).toBe(true);
      expect(messageBus.connections.get('agent-1')).toBe(ws);
    });

    it('should unregister a WebSocket connection', () => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-1', ws);
      messageBus.unregisterConnection('agent-1');

      expect(messageBus.connections.has('agent-1')).toBe(false);
    });

    it('should handle WebSocket close event', () => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-1', ws);

      ws.emit('close');

      expect(messageBus.connections.has('agent-1')).toBe(false);
    });
  });

  describe('Request Messages', () => {
    it('should send a request message', async () => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-2', ws);

      const requestPromise = messageBus.sendRequest(
        'agent-1',
        'agent-2',
        { action: 'process', data: 'test' }
      );

      // Simulate response
      setTimeout(() => {
        const sentMessage = JSON.parse(ws.sentMessages[0]);
        messageBus._handleIncomingMessage('agent-2', JSON.stringify({
          messageType: MessageType.RESPONSE,
          metadata: {
            responseToMessageId: sentMessage.messageId
          },
          payload: { result: 'success' }
        }));
      }, 10);

      const response = await requestPromise;

      expect(response).toEqual({ result: 'success' });
    });

    it('should timeout if no response received', async () => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-2', ws);

      // Send request with short TTL
      const requestPromise = messageBus.sendRequest(
        'agent-1',
        'agent-2',
        { action: 'process' },
        { ttl: 50 }
      );

      await expect(requestPromise).rejects.toThrow('Request timeout');
    }, 10000);

    it('should store request message', async () => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-2', ws);

      messageBus.sendRequest('agent-1', 'agent-2', { action: 'test' }).catch(() => {});

      expect(messageBus.messages.size).toBeGreaterThan(0);

      const message = Array.from(messageBus.messages.values())[0];
      expect(message.messageType).toBe(MessageType.REQUEST);
      expect(message.from.agentId).toBe('agent-1');
      expect(message.to.agentId).toBe('agent-2');
    });
  });

  describe('Response Messages', () => {
    it('should send a response message', async () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      messageBus.registerConnection('agent-1', ws1);
      messageBus.registerConnection('agent-2', ws2);

      // Create original request message
      const originalMessage = messageBus._createMessage({
        from: { agentId: 'agent-1' },
        to: { agentId: 'agent-2' },
        messageType: MessageType.REQUEST,
        payload: { action: 'test' }
      });
      messageBus.messages.set(originalMessage.messageId, originalMessage);

      const sent = await messageBus.sendResponse(
        originalMessage.messageId,
        'agent-2',
        'agent-1',
        { result: 'success' }
      );

      expect(sent).toBe(true);
      expect(ws1.sentMessages.length).toBe(1);
    });

    it('should throw error if original message not found', async () => {
      await expect(
        messageBus.sendResponse('non-existent', 'agent-1', 'agent-2', {})
      ).rejects.toThrow('Original message non-existent not found');
    });
  });

  describe('Notification Messages', () => {
    it('should send a notification message', async () => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-2', ws);

      const message = await messageBus.sendNotification(
        'agent-1',
        'agent-2',
        { event: 'statusUpdate', data: 'completed' }
      );

      expect(message).toBeDefined();
      expect(message.messageType).toBe(MessageType.NOTIFICATION);
      expect(ws.sentMessages.length).toBe(1);
    });

    it('should not wait for acknowledgement by default', async () => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-2', ws);

      const message = await messageBus.sendNotification(
        'agent-1',
        'agent-2',
        { event: 'test' }
      );

      expect(message.status).toBe(MessageStatus.DELIVERED);
    });
  });

  describe('Handoff Messages', () => {
    it('should send a handoff message', async () => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-2', ws);

      const message = await messageBus.sendHandoff(
        'agent-1',
        'agent-2',
        { context: 'conversation', state: {} },
        { handoffReason: 'Escalation' }
      );

      expect(message).toBeDefined();
      expect(message.messageType).toBe(MessageType.HANDOFF);
      expect(message.payload.handoffReason).toBe('Escalation');
    });

    it('should throw error if handoff fails', async () => {
      // No connection registered for agent-2
      await expect(
        messageBus.sendHandoff('agent-1', 'agent-2', {})
      ).rejects.toThrow('Failed to send handoff');
    });
  });

  describe('Broadcast Messages', () => {
    it('should broadcast message to multiple agents', async () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      const ws3 = new MockWebSocket();

      messageBus.registerConnection('agent-1', ws1);
      messageBus.registerConnection('agent-2', ws2);
      messageBus.registerConnection('agent-3', ws3);

      const messages = await messageBus.broadcast(
        'agent-0',
        ['agent-1', 'agent-2', 'agent-3'],
        { announcement: 'System update' }
      );

      expect(messages).toHaveLength(3);
      expect(ws1.sentMessages.length).toBe(1);
      expect(ws2.sentMessages.length).toBe(1);
      expect(ws3.sentMessages.length).toBe(1);
    });

    it('should handle partial broadcast failures gracefully', async () => {
      const ws1 = new MockWebSocket();
      messageBus.registerConnection('agent-1', ws1);
      // agent-2 not connected

      const messages = await messageBus.broadcast(
        'agent-0',
        ['agent-1', 'agent-2'],
        { announcement: 'Test' }
      );

      expect(messages).toHaveLength(2);
      // Should not throw error, just mark failed messages
    });
  });

  describe('Message Acknowledgement', () => {
    it('should acknowledge message receipt', () => {
      const message = messageBus._createMessage({
        from: { agentId: 'agent-1' },
        to: { agentId: 'agent-2' },
        messageType: MessageType.NOTIFICATION,
        payload: {}
      });
      messageBus.messages.set(message.messageId, message);

      const acknowledged = messageBus.acknowledgeMessage(message.messageId, 'agent-2');

      expect(acknowledged.status).toBe(MessageStatus.ACKNOWLEDGED);
      expect(acknowledged.acknowledgedBy).toBe('agent-2');
      expect(acknowledged.acknowledgedAt).toBeDefined();
    });

    it('should throw error if message not found', () => {
      expect(() => messageBus.acknowledgeMessage('non-existent', 'agent-1'))
        .toThrow('Message non-existent not found');
    });
  });

  describe('Conversation Tracking', () => {
    it('should track conversation participants', async () => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-2', ws);

      await messageBus.sendNotification(
        'agent-1',
        'agent-2',
        { text: 'Hello' }
      );

      const conversations = Array.from(messageBus.conversations.values());
      expect(conversations.length).toBeGreaterThan(0);

      const conversation = conversations[0];
      expect(conversation.participants.has('agent-1')).toBe(true);
      expect(conversation.participants.has('agent-2')).toBe(true);
      expect(conversation.messageCount).toBe(1);
    });

    it('should get conversation messages', async () => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-2', ws);

      // Send messages with same conversation ID
      const conversationId = 'conv-123';

      await messageBus.sendNotification(
        'agent-1',
        'agent-2',
        { text: 'Message 1' },
        { conversationId }
      );

      await messageBus.sendNotification(
        'agent-2',
        'agent-1',
        { text: 'Message 2' },
        { conversationId }
      );

      const messages = messageBus.getConversationMessages(conversationId);

      expect(messages.length).toBe(2);
      expect(messages[0].payload.text).toBe('Message 1');
      expect(messages[1].payload.text).toBe('Message 2');
    });
  });

  describe('Message Retrieval', () => {
    it('should get message by ID', async () => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-2', ws);

      const sent = await messageBus.sendNotification('agent-1', 'agent-2', {});
      const retrieved = messageBus.getMessage(sent.messageId);

      expect(retrieved).toBeDefined();
      expect(retrieved.messageId).toBe(sent.messageId);
    });

    it('should get all messages', async () => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-2', ws);

      await messageBus.sendNotification('agent-1', 'agent-2', { msg: 1 });
      await messageBus.sendNotification('agent-1', 'agent-2', { msg: 2 });

      const allMessages = messageBus.getAllMessages();

      expect(allMessages.length).toBe(2);
    });

    it('should get messages by status', async () => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-2', ws);

      await messageBus.sendNotification('agent-1', 'agent-2', {});

      const deliveredMessages = messageBus.getMessagesByStatus(MessageStatus.DELIVERED);

      expect(deliveredMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should return message bus statistics', async () => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-2', ws);

      await messageBus.sendNotification('agent-1', 'agent-2', {});

      const stats = messageBus.getStats();

      expect(stats.totalMessages).toBeGreaterThan(0);
      expect(stats.activeConnections).toBe(1);
      expect(stats.messagesByStatus).toBeDefined();
      expect(stats.messagesByStatus.delivered).toBeGreaterThan(0);
    });
  });

  describe('Message Retry', () => {
    it('should add failed message to retry queue', async () => {
      // No connection for agent-2
      await messageBus.sendNotification(
        'agent-1',
        'agent-2',
        {},
        { requiresAck: true }
      );

      expect(messageBus.retryQueue.length).toBeGreaterThan(0);
    });

    it('should mark message as failed after max retries', () => {
      const message = messageBus._createMessage({
        from: { agentId: 'agent-1' },
        to: { agentId: 'agent-2' },
        messageType: MessageType.NOTIFICATION,
        payload: {}
      });

      message.retryCount = messageBus.messageRetryAttempts;

      messageBus._addToRetryQueue(message);

      expect(message.status).toBe(MessageStatus.FAILED);
      expect(messageBus.retryQueue).not.toContain(message);
    });
  });

  describe('Incoming Message Handling', () => {
    it('should handle incoming REQUEST message', (done) => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-1', ws);

      messageBus.on('message:request', ({ agentId, message }) => {
        expect(agentId).toBe('agent-1');
        expect(message.messageType).toBe(MessageType.REQUEST);
        done();
      });

      const incomingMessage = {
        messageType: MessageType.REQUEST,
        from: { agentId: 'agent-1' },
        to: { agentId: 'agent-2' },
        payload: { action: 'test' }
      };

      messageBus._handleIncomingMessage('agent-1', JSON.stringify(incomingMessage));
    });

    it('should handle incoming NOTIFICATION message', (done) => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-1', ws);

      messageBus.on('message:notification', ({ agentId, message }) => {
        expect(agentId).toBe('agent-1');
        expect(message.messageType).toBe(MessageType.NOTIFICATION);
        done();
      });

      const incomingMessage = {
        messageType: MessageType.NOTIFICATION,
        from: { agentId: 'agent-1' },
        to: { agentId: 'agent-2' },
        payload: { event: 'update' }
      };

      messageBus._handleIncomingMessage('agent-1', JSON.stringify(incomingMessage));
    });
  });

  describe('Cleanup', () => {
    it('should remove expired messages', async () => {
      const ws = new MockWebSocket();
      messageBus.registerConnection('agent-2', ws);

      const message = await messageBus.sendNotification(
        'agent-1',
        'agent-2',
        {},
        { ttl: 100 }
      );

      // Fast-forward time by manipulating createdAt
      message.createdAt = new Date(Date.now() - 300);

      messageBus._cleanup();

      // Message should be marked as expired and potentially removed
      if (messageBus.messages.has(message.messageId)) {
        expect(message.status).toBe(MessageStatus.EXPIRED);
      }
    });
  });
});
