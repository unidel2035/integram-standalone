// telegram-lead-agent.js - API routes for Telegram Lead Generation Agent
// Provides REST API interface for the Telegram Lead MCP Server

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
const leadDatabase = new Map(); // Store parsed leads
const campaignDatabase = new Map(); // Store campaigns

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
 * Parse lead information from message text
 * Extracts phones, emails, Telegram usernames, company names
 */
function parseLeadFromMessage(messageText, sender) {
  const lead = {
    text: messageText,
    sender: sender,
    contacts: {
      phones: [],
      emails: [],
      usernames: [],
      websites: []
    },
    keywords: [],
    score: 0 // Lead quality score
  };

  // Extract phone numbers (various formats)
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  lead.contacts.phones = [...new Set((messageText.match(phoneRegex) || []).map(p => p.trim()))];

  // Extract emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  lead.contacts.emails = [...new Set(messageText.match(emailRegex) || [])];

  // Extract Telegram usernames
  const usernameRegex = /@([a-zA-Z0-9_]{5,})/g;
  const usernames = messageText.match(usernameRegex) || [];
  lead.contacts.usernames = [...new Set(usernames.map(u => u.substring(1)))];

  // Extract websites
  const websiteRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
  lead.contacts.websites = [...new Set(messageText.match(websiteRegex) || [])];

  // Extract potential keywords (for lead qualification)
  const keywords = [
    'ищу', 'нужен', 'требуется', 'куплю', 'заказ', 'проект',
    'разработка', 'автоматизация', 'интеграция', 'бот', 'агент',
    'ai', 'ии', 'chatgpt', 'claude', 'нейросеть', 'ml'
  ];
  lead.keywords = keywords.filter(kw => messageText.toLowerCase().includes(kw));

  // Calculate lead score
  lead.score = (
    lead.contacts.phones.length * 3 +
    lead.contacts.emails.length * 2 +
    lead.contacts.usernames.length * 1 +
    lead.keywords.length * 2
  );

  return lead;
}

/**
 * Create Telegram Lead Agent routes
 */
export function createTelegramLeadAgentRoutes() {
  const router = express.Router();

  /**
   * POST /api/telegram-lead-agent/auth/send-code
   * Send verification code to user's phone number
   */
  router.post('/auth/send-code', async (req, res) => {
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

      logger.info({ phone_number: cleanPhone }, 'Telegram lead agent: sending code');

      client = await getClient();
      const result = await client.sendCode(
        { apiId: API_ID, apiHash: API_HASH },
        cleanPhone
      );

      const sessionId = `lead_auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
            if (auth.client) await auth.client.disconnect();
          } catch (e) {}
          pendingAuths.delete(id);
        }
      }

      logger.info({ sessionId }, 'Code sent successfully');

      return res.json({
        success: true,
        session_id: sessionId,
        message: 'Код отправлен на ваш Telegram. Введите код для авторизации.'
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to send Telegram code');

      if (client) {
        try {
          await client.disconnect();
        } catch (e) {}
      }

      let errorMessage = 'Failed to send verification code';
      if (error.message?.includes('PHONE_NUMBER_INVALID')) {
        errorMessage = 'Invalid phone number. Please check and try again.';
      } else if (error.message?.includes('FLOOD_WAIT')) {
        const waitSeconds = error.message.match(/FLOOD_WAIT_(\d+)/)?.[1] || 60;
        errorMessage = `Too many attempts. Please wait ${waitSeconds} seconds.`;
      }

      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  });

  /**
   * POST /api/telegram-lead-agent/auth/verify-code
   * Verify code and authenticate user
   */
  router.post('/auth/verify-code', async (req, res) => {
    try {
      const { session_id, code, password } = req.body;

      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Verification code is required'
        });
      }

      const pendingAuth = pendingAuths.get(session_id);

      if (!pendingAuth) {
        return res.status(400).json({
          success: false,
          error: 'Session expired. Please request a new code.'
        });
      }

      const { client, phone_code_hash, phone_number } = pendingAuth;

      logger.info({ session_id, phone_number }, 'Verifying code');

      try {
        await client.invoke(
          new Api.auth.SignIn({
            phoneNumber: phone_number,
            phoneCodeHash: phone_code_hash,
            phoneCode: code.toString().trim()
          })
        );

        const me = await client.getMe();
        const sessionString = client.session.save();

        activeClients.set(sessionString, {
          client,
          user: me,
          timestamp: Date.now(),
          stats: {
            scanned_groups: 0,
            found_leads: 0,
            sent_messages: 0
          }
        });

        pendingAuths.delete(session_id);

        logger.info({
          userId: me.id?.toString(),
          username: me.username
        }, 'Lead agent authenticated');

        return res.json({
          success: true,
          user: {
            id: me.id?.toString(),
            first_name: me.firstName,
            last_name: me.lastName || '',
            username: me.username || '',
            phone: me.phone || phone_number
          },
          session: sessionString,
          message: 'Авторизация успешна!'
        });
      } catch (signInError) {
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
          const passwordResult = await client.invoke(new Api.account.GetPassword());
          const { computeCheck } = await import('telegram/Password.js');
          const passwordCheck = await computeCheck(passwordResult, password);

          await client.invoke(new Api.auth.CheckPassword({ password: passwordCheck }));

          const me = await client.getMe();
          const sessionString = client.session.save();

          activeClients.set(sessionString, {
            client,
            user: me,
            timestamp: Date.now(),
            stats: {
              scanned_groups: 0,
              found_leads: 0,
              sent_messages: 0
            }
          });

          pendingAuths.delete(session_id);

          return res.json({
            success: true,
            user: {
              id: me.id?.toString(),
              first_name: me.firstName,
              last_name: me.lastName || '',
              username: me.username || '',
              phone: me.phone || phone_number
            },
            session: sessionString,
            message: 'Авторизация с 2FA успешна!'
          });
        }

        throw signInError;
      }
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to verify code');

      let errorMessage = 'Failed to verify code';
      if (error.message?.includes('PHONE_CODE_INVALID')) {
        errorMessage = 'Invalid code. Please try again.';
      } else if (error.message?.includes('PHONE_CODE_EXPIRED')) {
        errorMessage = 'Code expired. Please request a new code.';
      }

      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  });

  /**
   * POST /api/telegram-lead-agent/groups
   * Get list of groups/channels
   */
  router.post('/groups', async (req, res) => {
    try {
      const { session } = req.body;

      if (!session) {
        return res.status(400).json({
          success: false,
          error: 'Session is required'
        });
      }

      let clientData = activeClients.get(session);
      let client;

      if (clientData) {
        client = clientData.client;
      } else {
        client = await getClient(session);
        const me = await client.getMe();
        activeClients.set(session, {
          client,
          user: me,
          timestamp: Date.now(),
          stats: {
            scanned_groups: 0,
            found_leads: 0,
            sent_messages: 0
          }
        });
      }

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

      return res.json({
        success: true,
        chats,
        total: chats.length
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get groups');
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/telegram-lead-agent/scan
   * Scan messages from groups for leads
   */
  router.post('/scan', async (req, res) => {
    try {
      const { session, chat_ids, keywords = [], limit = 100 } = req.body;

      if (!session || !chat_ids || !Array.isArray(chat_ids)) {
        return res.status(400).json({
          success: false,
          error: 'Session and chat_ids array are required'
        });
      }

      let clientData = activeClients.get(session);
      if (!clientData) {
        const client = await getClient(session);
        clientData = { client, timestamp: Date.now(), stats: {} };
        activeClients.set(session, clientData);
      }

      const { client } = clientData;
      const allLeads = [];

      for (const chat_id of chat_ids) {
        try {
          const messages = await client.getMessages(chat_id, { limit });

          for (const msg of messages) {
            if (!msg.text || msg.text.length === 0) continue;

            // Filter by keywords if provided
            if (keywords.length > 0) {
              const hasKeyword = keywords.some(kw =>
                msg.text.toLowerCase().includes(kw.toLowerCase())
              );
              if (!hasKeyword) continue;
            }

            const sender = {
              id: msg.senderId?.toString(),
              name: msg.sender?.firstName || msg.sender?.title || 'Unknown',
              username: msg.sender?.username || null
            };

            const lead = parseLeadFromMessage(msg.text, sender);

            // Only include if has contacts or relevant keywords
            if (
              lead.contacts.phones.length > 0 ||
              lead.contacts.emails.length > 0 ||
              lead.contacts.usernames.length > 0 ||
              lead.keywords.length > 0
            ) {
              lead.message_id = msg.id;
              lead.date = msg.date;
              lead.chat_id = chat_id;

              const leadId = `${chat_id}_${msg.id}_${Date.now()}`;
              leadDatabase.set(leadId, lead);

              allLeads.push({
                id: leadId,
                ...lead
              });
            }
          }

          // Update stats
          if (clientData.stats) {
            clientData.stats.scanned_groups = (clientData.stats.scanned_groups || 0) + 1;
            clientData.stats.found_leads = (clientData.stats.found_leads || 0) + allLeads.length;
          }
        } catch (chatError) {
          logger.warn({ chat_id, error: chatError.message }, 'Failed to scan chat');
        }
      }

      // Sort by score descending
      allLeads.sort((a, b) => b.score - a.score);

      return res.json({
        success: true,
        leads: allLeads,
        total: allLeads.length,
        scanned_chats: chat_ids.length
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to scan messages');
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/telegram-lead-agent/send-proposal
   * Send commercial proposal to a lead
   */
  router.post('/send-proposal', async (req, res) => {
    try {
      const { session, user_id, message, delay = 5 } = req.body;

      if (!session || !user_id || !message) {
        return res.status(400).json({
          success: false,
          error: 'Session, user_id, and message are required'
        });
      }

      let clientData = activeClients.get(session);
      if (!clientData) {
        const client = await getClient(session);
        clientData = { client, timestamp: Date.now(), stats: {} };
        activeClients.set(session, clientData);
      }

      const { client } = clientData;

      // Anti-spam delay
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
      }

      const result = await client.sendMessage(user_id, { message });

      // Update stats
      if (clientData.stats) {
        clientData.stats.sent_messages = (clientData.stats.sent_messages || 0) + 1;
      }

      return res.json({
        success: true,
        message_id: result.id,
        date: result.date,
        recipient: user_id,
        message: 'Proposal sent successfully'
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to send proposal');
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/telegram-lead-agent/leads
   * Get stored leads
   */
  router.get('/leads', (req, res) => {
    const leads = Array.from(leadDatabase.entries()).map(([id, lead]) => ({
      id,
      ...lead
    }));

    // Sort by score
    leads.sort((a, b) => b.score - a.score);

    return res.json({
      success: true,
      leads,
      total: leads.length
    });
  });

  /**
   * POST /api/telegram-lead-agent/stats
   * Get agent statistics
   */
  router.post('/stats', (req, res) => {
    const { session } = req.body;

    if (!session) {
      return res.status(400).json({
        success: false,
        error: 'Session is required'
      });
    }

    const clientData = activeClients.get(session);

    if (!clientData) {
      return res.json({
        success: true,
        stats: {
          scanned_groups: 0,
          found_leads: 0,
          sent_messages: 0
        }
      });
    }

    return res.json({
      success: true,
      stats: clientData.stats || {
        scanned_groups: 0,
        found_leads: 0,
        sent_messages: 0
      }
    });
  });

  /**
   * POST /api/telegram-lead-agent/logout
   * Logout and clear session
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
      logger.error({ error: error.message }, 'Failed to logout');
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/telegram-lead-agent/health
   * Health check
   */
  router.get('/health', (req, res) => {
    return res.json({
      success: true,
      status: 'healthy',
      api_id_configured: !!API_ID,
      api_hash_configured: !!API_HASH,
      active_sessions: activeClients.size,
      total_leads: leadDatabase.size
    });
  });

  return router;
}
