// CustomerSupportTelegramBot.js - Telegram Bot for Customer Support Agent
// Issue #2452 - Customer Support Agent with Telegram Bot Integration
//
// This service implements a Telegram bot that integrates with the CustomerSupportAgent
// to provide automated customer support via Telegram messaging.

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import logger from '../utils/logger.js';

/**
 * CustomerSupportTelegramBot
 *
 * Features:
 * - Listens to incoming Telegram messages from customers
 * - Maintains customer context (tariffs, questions, issues)
 * - Integrates with CustomerSupportAgent for AI-powered responses
 * - Tracks conversation history
 * - Provides support for platform usage, tariffs, and features
 */
export class CustomerSupportTelegramBot {
  constructor(options = {}) {
    this.apiId = options.apiId || process.env.TELEGRAM_API_ID;
    this.apiHash = options.apiHash || process.env.TELEGRAM_API_HASH;
    this.sessionString = options.sessionString || process.env.TELEGRAM_SESSION || '';
    this.botToken = options.botToken || process.env.TELEGRAM_SUPPORT_BOT_TOKEN;

    this.customerSupportAgent = options.customerSupportAgent;
    this.llmCoordinator = options.llmCoordinator;

    // In-memory customer context storage (TODO: replace with DronDoc API)
    this.customerContexts = new Map();

    // Active conversations tracking
    this.activeConversations = new Map();

    // Bot state
    this.client = null;
    this.isConnected = false;
    this.startTime = null;
  }

  /**
   * Initialize and start the Telegram bot
   */
  async start() {
    try {
      logger.info('Starting Customer Support Telegram Bot...');

      // Validate configuration
      if (!this.apiId || !this.apiHash) {
        throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH are required. Get them from https://my.telegram.org/apps');
      }

      // Create Telegram client
      const session = new StringSession(this.sessionString);
      this.client = new TelegramClient(session, parseInt(this.apiId), this.apiHash, {
        connectionRetries: 5,
      });

      // Connect to Telegram
      logger.info('Connecting to Telegram...');
      await this.client.connect();

      if (!await this.client.isUserAuthorized()) {
        throw new Error('Telegram session is not authorized. Please run telegram-auth script first.');
      }

      logger.info('✅ Connected to Telegram successfully');

      // Register message handler
      this.client.addEventHandler(
        this.handleIncomingMessage.bind(this),
        new NewMessage({})
      );

      this.isConnected = true;
      this.startTime = new Date();

      logger.info('🤖 Customer Support Telegram Bot is running and ready to handle messages');

      return {
        success: true,
        message: 'Bot started successfully',
        startTime: this.startTime
      };

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to start Customer Support Telegram Bot');
      throw error;
    }
  }

  /**
   * Stop the Telegram bot
   */
  async stop() {
    try {
      logger.info('Stopping Customer Support Telegram Bot...');

      if (this.client && this.isConnected) {
        await this.client.disconnect();
        this.isConnected = false;
        logger.info('✅ Bot disconnected successfully');
      }

      return {
        success: true,
        message: 'Bot stopped successfully'
      };

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to stop bot');
      throw error;
    }
  }

  /**
   * Handle incoming Telegram message
   */
  async handleIncomingMessage(event) {
    try {
      const message = event.message;

      // Ignore messages from bots and channels
      if (!message || message.fromId?.className === 'PeerChannel') {
        return;
      }

      const chatId = message.chatId.toString();
      const senderId = message.senderId?.toString();
      const messageText = message.text || '';

      logger.info({
        chatId,
        senderId,
        messageLength: messageText.length
      }, 'Received customer message');

      // Get or create customer context
      const customerContext = await this.getOrCreateCustomerContext(senderId, chatId);

      // Update customer context with message
      customerContext.lastMessage = messageText;
      customerContext.lastMessageAt = new Date();
      customerContext.messageCount = (customerContext.messageCount || 0) + 1;

      // Extract context from message (detect tariff questions, technical issues, etc.)
      const extractedContext = await this.extractContextFromMessage(messageText);
      Object.assign(customerContext, extractedContext);

      // Get conversation ID or create new one
      let conversationId = this.activeConversations.get(chatId);
      if (!conversationId) {
        conversationId = `telegram_${chatId}_${Date.now()}`;
        this.activeConversations.set(chatId, conversationId);

        // Create support conversation via agent
        if (this.customerSupportAgent) {
          await this.customerSupportAgent.processTask({
            id: `create_conv_${Date.now()}`,
            type: 'create_support_conversation',
            payload: {
              conversationId,
              customerUserId: senderId,
              botId: 'telegram_customer_support',
              subject: 'Telegram Support Request',
              category: customerContext.category || 'general'
            }
          });
        }
      }

      // Generate AI response using CustomerSupportAgent
      const aiResponse = await this.generateAIResponse(messageText, customerContext, conversationId, senderId);

      // Send response to customer
      await this.sendMessage(chatId, aiResponse);

      logger.info({ chatId }, 'Sent AI response to customer');

    } catch (error) {
      logger.error({ error: error.message }, 'Error handling incoming message');

      // Send error message to customer
      try {
        await this.sendMessage(
          event.message.chatId.toString(),
          'Извините, произошла ошибка при обработке вашего сообщения. Пожалуйста, попробуйте позже или свяжитесь с нами напрямую.'
        );
      } catch (sendError) {
        logger.error({ error: sendError.message }, 'Failed to send error message');
      }
    }
  }

  /**
   * Get or create customer context
   */
  async getOrCreateCustomerContext(customerId, chatId) {
    if (this.customerContexts.has(customerId)) {
      return this.customerContexts.get(customerId);
    }

    const context = {
      customerId,
      chatId,
      createdAt: new Date(),
      tariff: null, // Current tariff
      questions: [], // List of questions asked
      issues: [], // Technical issues reported
      features: [], // Features interested in
      category: 'general', // support category
      messageCount: 0,
      lastMessageAt: null,
      sentiment: 'neutral' // customer sentiment
    };

    this.customerContexts.set(customerId, context);

    logger.info({ customerId }, 'Created new customer context');

    return context;
  }

  /**
   * Extract context from customer message
   */
  async extractContextFromMessage(messageText) {
    const context = {};

    const lowerText = messageText.toLowerCase();

    // Detect tariff-related questions
    const tariffKeywords = ['тариф', 'цена', 'стоимость', 'оплата', 'подписка', 'план'];
    if (tariffKeywords.some(kw => lowerText.includes(kw))) {
      context.category = 'tariff';
      context.questions = context.questions || [];
      context.questions.push({
        type: 'tariff',
        question: messageText,
        timestamp: new Date()
      });
    }

    // Detect technical issues
    const issueKeywords = ['не работает', 'ошибка', 'проблема', 'баг', 'не получается', 'не могу'];
    if (issueKeywords.some(kw => lowerText.includes(kw))) {
      context.category = 'technical_issue';
      context.issues = context.issues || [];
      context.issues.push({
        description: messageText,
        timestamp: new Date(),
        status: 'reported'
      });
    }

    // Detect feature inquiries
    const featureKeywords = ['функция', 'возможность', 'как', 'можно ли', 'поддерживает'];
    if (featureKeywords.some(kw => lowerText.includes(kw))) {
      context.category = 'feature_inquiry';
      context.features = context.features || [];
      context.features.push({
        inquiry: messageText,
        timestamp: new Date()
      });
    }

    // Detect sentiment
    const positiveKeywords = ['спасибо', 'отлично', 'хорошо', 'супер', 'понятно'];
    const negativeKeywords = ['плохо', 'не понимаю', 'сложно', 'не помогло'];

    if (positiveKeywords.some(kw => lowerText.includes(kw))) {
      context.sentiment = 'positive';
    } else if (negativeKeywords.some(kw => lowerText.includes(kw))) {
      context.sentiment = 'negative';
    }

    return context;
  }

  /**
   * Generate AI response using CustomerSupportAgent
   */
  async generateAIResponse(messageText, customerContext, conversationId, customerId) {
    try {
      // Build context summary for AI
      const contextSummary = this.buildContextSummary(customerContext);

      // If CustomerSupportAgent is available, use it
      if (this.customerSupportAgent) {
        const result = await this.customerSupportAgent.processTask({
          id: `msg_${Date.now()}`,
          type: 'handle_message',
          payload: {
            messageText,
            conversationId,
            customerUserId: customerId,
            accessToken: process.env.DRONDOC_DEFAULT_TOKEN || 'system_token', // TODO: use proper token
            customerContext: contextSummary
          }
        });

        if (result.response) {
          return result.response;
        }
      }

      // Fallback: generate response using LLM directly
      if (this.llmCoordinator) {
        const systemPrompt = `Ты - профессиональный консультант по платформе DronDoc.
DronDoc - это комплексная платформа для управления дронами и автоматизации полетов.

Контекст клиента:
- Категория вопроса: ${customerContext.category || 'общий'}
- Количество сообщений: ${customerContext.messageCount || 0}
- Настроение: ${customerContext.sentiment || 'нейтральное'}

Твоя задача:
1. Вежливо ответить на вопрос клиента
2. Предоставить четкую и полезную информацию о платформе
3. Если нужно, предложить дополнительную помощь или демонстрацию

Сообщение клиента: ${messageText}`;

        const response = await this.llmCoordinator.chat(
          'deepseek-chat',
          systemPrompt,
          {
            temperature: 0.7,
            maxTokens: 1024,
            application: 'CustomerSupportBot'
          }
        );

        return response.content;
      }

      // Fallback: simple template response
      return this.getTemplateResponse(messageText, customerContext);

    } catch (error) {
      logger.error({ error: error.message }, 'Error generating AI response');
      return 'Спасибо за ваше сообщение! Я передам ваш вопрос специалисту поддержки, который свяжется с вами в ближайшее время.';
    }
  }

  /**
   * Build context summary for AI
   */
  buildContextSummary(context) {
    return {
      category: context.category,
      messageCount: context.messageCount,
      sentiment: context.sentiment,
      hasQuestions: (context.questions || []).length > 0,
      hasIssues: (context.issues || []).length > 0,
      interestedFeatures: (context.features || []).map(f => f.inquiry)
    };
  }

  /**
   * Get template response (fallback when AI is not available)
   */
  getTemplateResponse(messageText, context) {
    const lowerText = messageText.toLowerCase();

    // Tariff questions
    if (context.category === 'tariff') {
      return `Здравствуйте! 👋

По поводу тарифов DronDoc:
- Базовый тариф: подходит для начинающих (бесплатно на 30 дней)
- Профессиональный: расширенные возможности для команд
- Корпоративный: полный функционал для крупных организаций

Для точного расчета стоимости, пожалуйста, расскажите о ваших задачах и масштабе использования. Я помогу подобрать оптимальное решение!`;
    }

    // Technical issues
    if (context.category === 'technical_issue') {
      return `Понял, у вас возникла проблема. 🔧

Я передам ваше сообщение нашей технической поддержке. Обычно мы отвечаем в течение 1-2 часов в рабочее время.

Пока жду ответа специалиста, вы можете:
- Проверить раздел FAQ на нашем сайте
- Посмотреть видеоуроки в разделе "Обучение"

Чем еще я могу помочь?`;
    }

    // Feature inquiries
    if (context.category === 'feature_inquiry') {
      return `Отличный вопрос! 🚁

DronDoc предоставляет широкий функционал:
- Автоматическое планирование миссий
- Телеметрия в реальном времени
- AI-оптимизация маршрутов
- Модули для сельского хозяйства
- Управление флотом дронов

Расскажите подробнее о вашей задаче, и я помогу найти подходящее решение!`;
    }

    // General greeting
    if (lowerText.includes('привет') || lowerText.includes('здравствуй')) {
      return `Здравствуйте! 👋 Я - ассистент поддержки DronDoc.

Я помогу вам с:
- Вопросами о тарифах и ценах
- Техническими проблемами
- Информацией о функциях платформы
- Обучением работе с DronDoc

Чем могу помочь?`;
    }

    // Default response
    return `Спасибо за ваше сообщение!

Я - автоматический ассистент поддержки DronDoc. Чем могу помочь?

Если вам нужна помощь специалиста, напишите /help или просто опишите вашу задачу подробнее.`;
  }

  /**
   * Send message to Telegram chat
   */
  async sendMessage(chatId, text) {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Bot is not connected');
      }

      await this.client.sendMessage(chatId, {
        message: text
      });

      logger.info({ chatId, messageLength: text.length }, 'Sent message to customer');

    } catch (error) {
      logger.error({ error: error.message, chatId }, 'Failed to send message');
      throw error;
    }
  }

  /**
   * Get bot statistics
   */
  getStatistics() {
    return {
      isConnected: this.isConnected,
      startTime: this.startTime,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      activeConversations: this.activeConversations.size,
      totalCustomers: this.customerContexts.size,
      customersByCategory: this.getCustomersByCategory()
    };
  }

  /**
   * Get customers grouped by category
   */
  getCustomersByCategory() {
    const byCategory = {};

    for (const context of this.customerContexts.values()) {
      const category = context.category || 'general';
      byCategory[category] = (byCategory[category] || 0) + 1;
    }

    return byCategory;
  }

  /**
   * Get customer context
   */
  getCustomerContext(customerId) {
    return this.customerContexts.get(customerId) || null;
  }

  /**
   * Get all active conversations
   */
  getActiveConversations() {
    return Array.from(this.activeConversations.entries()).map(([chatId, conversationId]) => ({
      chatId,
      conversationId,
      customer: this.customerContexts.get(chatId)
    }));
  }
}

export default CustomerSupportTelegramBot;
