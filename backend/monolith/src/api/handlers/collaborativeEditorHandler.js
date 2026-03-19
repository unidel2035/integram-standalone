// collaborativeEditorHandler.js - WebSocket handler for collaborative editing with EchoEditor
import axios from 'axios';
import FormData from 'form-data';
import logger from '../../utils/logger.js';
import { BoundedMap } from '../../utils/memoryOptimization.js';

/**
 * Collaborative Editor Handler
 * Manages real-time collaborative editing sessions for EchoEditor
 *
 * Features:
 * - Multiple users editing same document
 * - Real-time content synchronization
 * - User presence tracking
 * - Auto-save to backend API
 */
export class CollaborativeEditorHandler {
  constructor() {
    // Issue #2157: Use BoundedMap to prevent unbounded memory growth
    // Limit to 1,000 concurrent editing rooms
    // Map of roomId -> { clients: Map<userId, Set<ws>>, content: string, updateQueue: Promise }
    this.rooms = new BoundedMap(1000);
    // Cleanup interval (every 10 minutes)
    this.cleanupInterval = 600000;
    this._startCleanupTimer();
    logger.info('Collaborative Editor Handler initialized');
  }

  /**
   * Handle editor-related messages
   */
  handleMessage(ws, data) {
    const roomId = data.roomId;

    if (!roomId) {
      logger.error('No roomId provided in editor message');
      return;
    }

    // Initialize room if it doesn't exist
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        clients: new Map(),
        content: data.content || '',
        updateQueue: Promise.resolve(),
      });
    }

    const room = this.rooms.get(roomId);

    switch (data.type) {
      case 'editor:join':
        this.handleJoin(ws, room, data);
        break;

      case 'editor:update':
        this.handleUpdate(ws, room, data);
        break;

      default:
        logger.warn({ type: data.type }, 'Unknown editor message type');
    }
  }

  /**
   * Handle user joining a collaborative editing session
   */
  handleJoin(ws, room, data) {
    const userId = data.userId;
    if (!userId) {
      logger.error('No userId provided');
      return;
    }

    // Add user to room
    if (!room.clients.has(userId)) {
      room.clients.set(userId, new Set());
    }

    const userClients = room.clients.get(userId);
    userClients.add(ws);

    // Store metadata on WebSocket connection
    ws.editorUserId = userId;
    ws.editorRoomId = data.roomId;

    // Send initial state to the joining client
    ws.send(
      JSON.stringify({
        type: 'editor:init',
        content: room.content,
        userId: userId,
        members: Array.from(room.clients.keys()),
      })
    );

    // Broadcast updated members list to all other clients in the room
    this.broadcastMembersList(room, userId);

    logger.info({ userId, roomId: data.roomId }, 'User joined editor room');
  }

  /**
   * Handle content update from a user
   */
  handleUpdate(ws, room, data) {
    // Queue the update to prevent race conditions
    room.updateQueue = room.updateQueue
      .then(() => this.processUpdate(room, data, ws))
      .catch((error) => {
        logger.error({ error: error.message }, 'Error processing editor update');
      });
  }

  /**
   * Process a content update and broadcast to all clients
   */
  async processUpdate(room, data, ws) {
    // Only process if content has actually changed
    if (room.content !== data.content) {
      room.content = data.content;

      // Broadcast to all clients in the room
      const broadcastPromises = [];
      room.clients.forEach((clients, userId) => {
        clients.forEach((client) => {
          if (client.readyState === 1) { // WebSocket.OPEN = 1
            broadcastPromises.push(
              new Promise((resolve) => {
                client.send(
                  JSON.stringify({
                    type: 'editor:update',
                    content: data.content,
                    userId: data.userId,
                  }),
                  resolve
                );
              })
            );
          }
        });
      });

      await Promise.all(broadcastPromises);

      // Save document to backend API
      await this.saveDocument(data);

      logger.debug({ roomId: data.roomId, userId: data.userId }, 'Editor content updated');
    }
  }

  /**
   * Save document to backend API
   */
  async saveDocument(data) {
    if (!data.xsrf || !data.content || !data.token || !data.roomId || !data.userId) {
      logger.warn('Insufficient data for saving document');
      return;
    }

    const formData = new FormData();
    formData.append('_xsrf', data.xsrf);
    formData.append('t36978', data.content);

    try {
      const response = await axios.post(
        `https://dronedoc.ru/a2025/_m_save/${data.roomId}?JSON`,
        formData,
        {
          headers: {
            'X-Authorization': data.token,
            ...formData.getHeaders(),
          },
        }
      );
      logger.debug({ roomId: data.roomId }, 'Document saved successfully');
      return response.data;
    } catch (error) {
      logger.error(
        { error: error.response?.data || error.message, roomId: data.roomId },
        'Failed to save document'
      );
      throw error;
    }
  }

  /**
   * Broadcast members list to all clients in a room (except excluded user)
   */
  broadcastMembersList(room, excludeUserId = null) {
    const members = Array.from(room.clients.keys());
    room.clients.forEach((clients, userId) => {
      clients.forEach((client) => {
        if (client.readyState === 1 && userId !== excludeUserId) { // WebSocket.OPEN = 1
          client.send(
            JSON.stringify({
              type: 'editor:members',
              members: members,
            })
          );
        }
      });
    });
  }

  /**
   * Handle user disconnection from a collaborative editing session
   */
  handleDisconnect(ws) {
    if (ws.editorUserId && ws.editorRoomId) {
      const room = this.rooms.get(ws.editorRoomId);
      if (room) {
        const userClients = room.clients.get(ws.editorUserId);
        if (userClients) {
          userClients.delete(ws);
          if (userClients.size === 0) {
            room.clients.delete(ws.editorUserId);
          }
        }

        // Broadcast updated members list
        this.broadcastMembersList(room);

        // Clean up empty rooms
        if (room.clients.size === 0) {
          this.rooms.delete(ws.editorRoomId);
          logger.info({ roomId: ws.editorRoomId }, 'Editor room deleted (no users)');
        }
      }
    }
  }

  /**
   * Get statistics about active editing sessions
   */
  getStats() {
    return {
      totalRooms: this.rooms.size,
      rooms: Array.from(this.rooms.entries()).map(([roomId, room]) => ({
        roomId,
        userCount: room.clients.size,
        users: Array.from(room.clients.keys()),
      })),
    };
  }

  /**
   * Start periodic cleanup of empty rooms
   * Issue #2157: Prevent memory leaks from abandoned rooms
   * @private
   */
  _startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this._cleanup();
    }, this.cleanupInterval);

    logger.debug('CollaborativeEditorHandler cleanup timer started');
  }

  /**
   * Cleanup empty rooms
   * Issue #2157: Prevent memory leaks
   * @private
   */
  _cleanup() {
    let cleanedRooms = 0;

    for (const [roomId, room] of this.rooms.entries()) {
      // Remove empty rooms
      if (room.clients.size === 0) {
        this.rooms.delete(roomId);
        cleanedRooms++;
      } else {
        // Remove closed connections from room
        for (const [userId, clients] of room.clients.entries()) {
          const validClients = new Set();
          for (const ws of clients) {
            if (ws.readyState === 1) { // WebSocket.OPEN
              validClients.add(ws);
            }
          }
          if (validClients.size === 0) {
            room.clients.delete(userId);
          } else if (validClients.size < clients.size) {
            room.clients.set(userId, validClients);
          }
        }
      }
    }

    if (cleanedRooms > 0) {
      logger.info({
        cleanedRooms,
        activeRooms: this.rooms.size
      }, 'CollaborativeEditorHandler cleanup completed');
    }
  }

  /**
   * Stop cleanup timer and cleanup resources
   */
  shutdown() {
    logger.info('Shutting down CollaborativeEditorHandler');

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.rooms.clear();
  }
}
