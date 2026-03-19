// telegram-user-auth.js - Telegram User Authentication API routes
// Implements user-based Telegram parsing using MTProto Client API (GramJS)

import express from 'express';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import logger from '../../utils/logger.js';

// Telegram API credentials from environment
const API_ID = parseInt(process.env.TELEGRAM_API_ID || '35138704', 10);
const API_HASH = process.env.TELEGRAM_API_HASH || '542f1deaf9babb8c9de2af6dc7d3b9a8';

// Store for active clients and sessions (in-memory)
// In production, sessions should be encrypted and stored in database
const activeClients = new Map();
const pendingAuths = new Map();

/**
 * Get or create a Telegram client for a session
 */
async function getClient(sessionString = '') {
  const stringSession = new StringSession(sessionString);
  const client = new TelegramClient(stringSession, API_ID, API_HASH, {
    connectionRetries: 5,
    useWSS: false,
    timeout: 30000,
  });

  await client.connect();
  return client;
}

/**
 * Create Telegram User Authentication routes
 */
export function createTelegramUserAuthRoutes() {
  const router = express.Router();

  /**
   * POST /api/telegram-user-auth/send-code
   * Send verification code to user's phone number
   */
  router.post('/send-code', async (req, res) => {
    let client = null;

    try {
      const { phone_number } = req.body;

      if (!phone_number) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
        });
      }

      // Validate phone format
      const cleanPhone = phone_number.replace(/\s+/g, '');
      if (!/^\+\d{10,15}$/.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format. Use international format: +79001234567'
        });
      }

      logger.info({ phone_number: cleanPhone }, 'Telegram user auth: sending code');

      // Create new client for this auth session
      client = await getClient();

      // Send the code
      const result = await client.sendCode(
        {
          apiId: API_ID,
          apiHash: API_HASH,
        },
        cleanPhone
      );

      // Generate session ID and store pending auth data
      const sessionId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      pendingAuths.set(sessionId, {
        phone_number: cleanPhone,
        phone_code_hash: result.phoneCodeHash,
        client: client,
        timestamp: Date.now()
      });

      // Clean up old pending auths (older than 10 minutes)
      for (const [id, auth] of pendingAuths.entries()) {
        if (Date.now() - auth.timestamp > 600000) {
          try {
            if (auth.client) {
              await auth.client.disconnect();
            }
          } catch (e) {}
          pendingAuths.delete(id);
        }
      }

      logger.info({ sessionId, phone_code_hash: result.phoneCodeHash }, 'Code sent successfully');

      return res.json({
        success: true,
        session_id: sessionId,
        phone_code_hash: result.phoneCodeHash,
        code_type: result.type?.className || 'unknown',
        message: 'Код отправлен на ваш Telegram. Введите код для авторизации.'
      });
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Failed to send Telegram code');

      // Disconnect client on error
      if (client) {
        try {
          await client.disconnect();
        } catch (e) {}
      }

      // Handle specific Telegram errors
      let errorMessage = 'Failed to send verification code';

      if (error.message?.includes('PHONE_NUMBER_INVALID')) {
        errorMessage = 'Invalid phone number. Please check and try again.';
      } else if (error.message?.includes('PHONE_NUMBER_BANNED')) {
        errorMessage = 'This phone number is banned from Telegram.';
      } else if (error.message?.includes('PHONE_NUMBER_FLOOD')) {
        errorMessage = 'Too many attempts. Please try again later.';
      } else if (error.message?.includes('FLOOD_WAIT')) {
        const waitSeconds = error.message.match(/FLOOD_WAIT_(\d+)/)?.[1] || 60;
        errorMessage = `Too many attempts. Please wait ${waitSeconds} seconds and try again.`;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  });

  /**
   * POST /api/telegram-user-auth/verify-code
   * Verify code and authenticate user
   */
  router.post('/verify-code', async (req, res) => {
    try {
      const { session_id, phone_number, code, password } = req.body;

      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Verification code is required'
        });
      }

      // Get pending auth
      const pendingAuth = pendingAuths.get(session_id);

      if (!pendingAuth) {
        return res.status(400).json({
          success: false,
          error: 'Session expired or invalid. Please request a new code.'
        });
      }

      const { client, phone_code_hash, phone_number: storedPhone } = pendingAuth;

      logger.info({ session_id, phone_number: storedPhone }, 'Verifying code');

      try {
        // Try to sign in with the code
        const result = await client.invoke(
          new Api.auth.SignIn({
            phoneNumber: storedPhone,
            phoneCodeHash: phone_code_hash,
            phoneCode: code.toString().trim()
          })
        );

        // Get user info
        const me = await client.getMe();

        // Save the session string
        const sessionString = client.session.save();

        // Store active client
        activeClients.set(sessionString, {
          client,
          user: me,
          timestamp: Date.now()
        });

        // Remove from pending
        pendingAuths.delete(session_id);

        logger.info({
          userId: me.id?.toString(),
          username: me.username
        }, 'User authenticated successfully');

        return res.json({
          success: true,
          user: {
            id: me.id?.toString(),
            first_name: me.firstName,
            last_name: me.lastName || '',
            username: me.username || '',
            phone: me.phone || storedPhone
          },
          session: sessionString,
          message: 'Авторизация успешна!'
        });
      } catch (signInError) {
        // Check if 2FA is required
        if (signInError.message?.includes('SESSION_PASSWORD_NEEDED')) {
          if (!password) {
            return res.json({
              success: false,
              requires_password: true,
              session_id: session_id,
              message: 'Требуется двухфакторная аутентификация. Введите пароль.'
            });
          }

          // Handle 2FA
          const passwordResult = await client.invoke(
            new Api.account.GetPassword()
          );

          const { computeCheck } = await import('telegram/Password.js');
          const passwordCheck = await computeCheck(passwordResult, password);

          await client.invoke(
            new Api.auth.CheckPassword({
              password: passwordCheck
            })
          );

          const me = await client.getMe();
          const sessionString = client.session.save();

          activeClients.set(sessionString, {
            client,
            user: me,
            timestamp: Date.now()
          });

          pendingAuths.delete(session_id);

          return res.json({
            success: true,
            user: {
              id: me.id?.toString(),
              first_name: me.firstName,
              last_name: me.lastName || '',
              username: me.username || '',
              phone: me.phone || storedPhone
            },
            session: sessionString,
            message: 'Авторизация с 2FA успешна!'
          });
        }

        throw signInError;
      }
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Failed to verify code');

      let errorMessage = 'Failed to verify code';

      if (error.message?.includes('PHONE_CODE_INVALID')) {
        errorMessage = 'Invalid code. Please check and try again.';
      } else if (error.message?.includes('PHONE_CODE_EXPIRED')) {
        errorMessage = 'Code has expired. Please request a new code.';
      } else if (error.message?.includes('PASSWORD_HASH_INVALID')) {
        errorMessage = 'Invalid password. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  });

  /**
   * POST /api/telegram-user-auth/get-chats
   * Get list of chats/channels user is subscribed to
   */
  router.post('/get-chats', async (req, res) => {
    try {
      const { session } = req.body;

      if (!session) {
        return res.status(400).json({
          success: false,
          error: 'Session is required'
        });
      }

      logger.info('Getting user chats');

      // Get or restore client
      let clientData = activeClients.get(session);
      let client;

      if (clientData) {
        client = clientData.client;
      } else {
        // Restore from session string
        client = await getClient(session);
        const me = await client.getMe();
        activeClients.set(session, {
          client,
          user: me,
          timestamp: Date.now()
        });
      }

      // Get dialogs (chats)
      const dialogs = await client.getDialogs({ limit: 100 });

      const chats = dialogs.map(dialog => {
        const entity = dialog.entity;
        let type = 'private';

        if (entity?.className === 'Channel') {
          type = entity.broadcast ? 'channel' : 'supergroup';
        } else if (entity?.className === 'Chat') {
          type = 'group';
        }

        return {
          id: dialog.id?.toString(),
          title: dialog.title || dialog.name || 'Unknown',
          username: entity?.username || null,
          type,
          members_count: entity?.participantsCount || 0,
          unread_count: dialog.unreadCount || 0,
          is_verified: entity?.verified || false
        };
      });

      logger.info({ count: chats.length }, 'Chats retrieved');

      return res.json({
        success: true,
        chats,
        total: chats.length
      });
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Failed to get chats');

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get chats'
      });
    }
  });

  /**
   * POST /api/telegram-user-auth/get-messages
   * Get messages from a channel/chat
   */
  router.post('/get-messages', async (req, res) => {
    try {
      const { session, chat_id, limit = 100, offset_id = 0 } = req.body;

      if (!session || !chat_id) {
        return res.status(400).json({
          success: false,
          error: 'Session and chat_id are required'
        });
      }

      logger.info({ chat_id, limit, offset_id }, 'Getting messages');

      // Get or restore client
      let clientData = activeClients.get(session);
      let client;

      if (clientData) {
        client = clientData.client;
      } else {
        client = await getClient(session);
        activeClients.set(session, {
          client,
          timestamp: Date.now()
        });
      }

      // Get messages
      const messages = await client.getMessages(chat_id, {
        limit: Math.min(limit, 100),
        offsetId: offset_id
      });

      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        date: msg.date,
        text: msg.text || '',
        sender_id: msg.senderId?.toString(),
        sender_name: msg.sender?.firstName || msg.sender?.title || 'Unknown',
        views: msg.views || 0,
        forwards: msg.forwards || 0,
        replies: msg.replies?.replies || 0,
        has_media: !!msg.media,
        media_type: msg.media?.className || null
      }));

      logger.info({ chat_id, count: formattedMessages.length }, 'Messages retrieved');

      return res.json({
        success: true,
        messages: formattedMessages,
        total: formattedMessages.length,
        has_more: formattedMessages.length === limit
      });
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Failed to get messages');

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get messages'
      });
    }
  });

  /**
   * POST /api/telegram-user-auth/logout
   * Logout user and clear session
   */
  router.post('/logout', async (req, res) => {
    try {
      const { session } = req.body;

      if (!session) {
        return res.status(400).json({
          success: false,
          error: 'Session is required'
        });
      }

      logger.info('Logging out user');

      const clientData = activeClients.get(session);

      if (clientData && clientData.client) {
        try {
          await clientData.client.invoke(new Api.auth.LogOut());
          await clientData.client.disconnect();
        } catch (e) {
          logger.warn({ error: e.message }, 'Error during logout');
        }
      }

      activeClients.delete(session);

      return res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Failed to logout');

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to logout'
      });
    }
  });

  /**
   * GET /api/telegram-user-auth/status
   * Check if user is authenticated
   */
  router.post('/status', async (req, res) => {
    try {
      const { session } = req.body;

      if (!session) {
        return res.json({
          success: true,
          authenticated: false
        });
      }

      const clientData = activeClients.get(session);

      if (clientData && clientData.user) {
        return res.json({
          success: true,
          authenticated: true,
          user: {
            id: clientData.user.id?.toString(),
            first_name: clientData.user.firstName,
            username: clientData.user.username
          }
        });
      }

      // Try to restore session
      try {
        const client = await getClient(session);
        const me = await client.getMe();

        activeClients.set(session, {
          client,
          user: me,
          timestamp: Date.now()
        });

        return res.json({
          success: true,
          authenticated: true,
          user: {
            id: me.id?.toString(),
            first_name: me.firstName,
            username: me.username
          }
        });
      } catch (e) {
        return res.json({
          success: true,
          authenticated: false
        });
      }
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to check status');

      return res.json({
        success: true,
        authenticated: false
      });
    }
  });

  /**
   * GET /api/telegram-user-auth/health
   * Health check for the Telegram auth service
   */
  router.get('/health', (req, res) => {
    return res.json({
      success: true,
      status: 'healthy',
      api_id_configured: !!API_ID,
      api_hash_configured: !!API_HASH,
      active_sessions: activeClients.size,
      pending_auths: pendingAuths.size
    });
  });

  return router;
}
