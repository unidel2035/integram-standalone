// CustomerSupportTelegramBot.test.js - Unit tests for Customer Support Telegram Bot
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomerSupportTelegramBot } from '../CustomerSupportTelegramBot.js';

// Mock telegram library
vi.mock('telegram', () => ({
  TelegramClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(true),
    isUserAuthorized: vi.fn().mockResolvedValue(true),
    addEventHandler: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue({ success: true })
  })),
  StringSession: vi.fn()
}));

vi.mock('telegram/sessions/index.js', () => ({
  StringSession: vi.fn()
}));

vi.mock('telegram/events/index.js', () => ({
  NewMessage: vi.fn()
}));

describe('CustomerSupportTelegramBot', () => {
  let bot;
  let mockCustomerSupportAgent;
  let mockLLMCoordinator;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock CustomerSupportAgent
    mockCustomerSupportAgent = {
      processTask: vi.fn().mockResolvedValue({
        response: 'AI response'
      })
    };

    // Mock LLMCoordinator
    mockLLMCoordinator = {
      chat: vi.fn().mockResolvedValue({
        content: 'LLM response'
      })
    };

    // Create bot instance with mocked dependencies
    bot = new CustomerSupportTelegramBot({
      apiId: 'test_api_id',
      apiHash: 'test_api_hash',
      sessionString: 'test_session',
      customerSupportAgent: mockCustomerSupportAgent,
      llmCoordinator: mockLLMCoordinator
    });
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(bot.apiId).toBe('test_api_id');
      expect(bot.apiHash).toBe('test_api_hash');
      expect(bot.sessionString).toBe('test_session');
      expect(bot.customerSupportAgent).toBe(mockCustomerSupportAgent);
      expect(bot.llmCoordinator).toBe(mockLLMCoordinator);
    });

    it('should initialize empty customer contexts and conversations', () => {
      expect(bot.customerContexts.size).toBe(0);
      expect(bot.activeConversations.size).toBe(0);
    });

    it('should start with disconnected state', () => {
      expect(bot.isConnected).toBe(false);
      expect(bot.startTime).toBeNull();
    });
  });

  describe('Customer Context Management', () => {
    it('should create new customer context', async () => {
      const customerId = 'customer_123';
      const chatId = 'chat_456';

      const context = await bot.getOrCreateCustomerContext(customerId, chatId);

      expect(context).toEqual({
        customerId,
        chatId,
        createdAt: expect.any(Date),
        tariff: null,
        questions: [],
        issues: [],
        features: [],
        category: 'general',
        messageCount: 0,
        lastMessageAt: null,
        sentiment: 'neutral'
      });

      expect(bot.customerContexts.has(customerId)).toBe(true);
    });

    it('should return existing customer context', async () => {
      const customerId = 'customer_123';
      const chatId = 'chat_456';

      const context1 = await bot.getOrCreateCustomerContext(customerId, chatId);
      const context2 = await bot.getOrCreateCustomerContext(customerId, chatId);

      expect(context1).toBe(context2);
      expect(bot.customerContexts.size).toBe(1);
    });
  });

  describe('Context Extraction', () => {
    it('should detect tariff-related questions', async () => {
      const message = 'Сколько стоит ваш тариф?';
      const context = await bot.extractContextFromMessage(message);

      expect(context.category).toBe('tariff');
      expect(context.questions).toHaveLength(1);
      expect(context.questions[0].type).toBe('tariff');
    });

    it('should detect technical issues', async () => {
      const message = 'У меня не работает приложение, ошибка при запуске';
      const context = await bot.extractContextFromMessage(message);

      expect(context.category).toBe('technical_issue');
      expect(context.issues).toHaveLength(1);
      expect(context.issues[0].status).toBe('reported');
    });

    it('should detect feature inquiries', async () => {
      const message = 'Какие функции есть для дронов?';
      const context = await bot.extractContextFromMessage(message);

      expect(context.category).toBe('feature_inquiry');
      expect(context.features).toHaveLength(1);
    });

    it('should detect positive sentiment', async () => {
      const message = 'Спасибо, всё отлично работает!';
      const context = await bot.extractContextFromMessage(message);

      expect(context.sentiment).toBe('positive');
    });

    it('should detect negative sentiment', async () => {
      const message = 'Не понимаю, как это использовать, очень сложно';
      const context = await bot.extractContextFromMessage(message);

      expect(context.sentiment).toBe('negative');
    });
  });

  describe('AI Response Generation', () => {
    it('should generate response using CustomerSupportAgent', async () => {
      const messageText = 'Расскажите о тарифах';
      const customerContext = {
        category: 'tariff',
        messageCount: 1,
        sentiment: 'neutral'
      };
      const conversationId = 'conv_123';
      const customerId = 'customer_123';

      const response = await bot.generateAIResponse(
        messageText,
        customerContext,
        conversationId,
        customerId
      );

      expect(mockCustomerSupportAgent.processTask).toHaveBeenCalled();
      expect(response).toBe('AI response');
    });

    it('should fallback to LLM if agent returns no response', async () => {
      mockCustomerSupportAgent.processTask.mockResolvedValue({});

      const messageText = 'Привет';
      const customerContext = { category: 'general', messageCount: 1, sentiment: 'neutral' };
      const conversationId = 'conv_123';
      const customerId = 'customer_123';

      const response = await bot.generateAIResponse(
        messageText,
        customerContext,
        conversationId,
        customerId
      );

      expect(mockLLMCoordinator.chat).toHaveBeenCalled();
      expect(response).toBe('LLM response');
    });

    it('should use template response if no AI available', async () => {
      bot.customerSupportAgent = null;
      bot.llmCoordinator = null;

      const messageText = 'Привет';
      const customerContext = { category: 'general', messageCount: 1, sentiment: 'neutral' };
      const conversationId = 'conv_123';
      const customerId = 'customer_123';

      const response = await bot.generateAIResponse(
        messageText,
        customerContext,
        conversationId,
        customerId
      );

      expect(response).toContain('Здравствуйте');
      expect(response).toContain('ассистент поддержки');
    });
  });

  describe('Template Responses', () => {
    it('should provide tariff template response', () => {
      const message = 'Сколько стоит?';
      const context = { category: 'tariff', messageCount: 1, sentiment: 'neutral' };

      const response = bot.getTemplateResponse(message, context);

      expect(response).toContain('тариф');
      expect(response).toContain('Базовый');
    });

    it('should provide technical issue template response', () => {
      const message = 'Не работает функция';
      const context = { category: 'technical_issue', messageCount: 1, sentiment: 'neutral' };

      const response = bot.getTemplateResponse(message, context);

      expect(response).toContain('проблема');
      expect(response).toContain('техническ');
    });

    it('should provide feature inquiry template response', () => {
      const message = 'Какие функции есть?';
      const context = { category: 'feature_inquiry', messageCount: 1, sentiment: 'neutral' };

      const response = bot.getTemplateResponse(message, context);

      expect(response).toContain('функционал');
      expect(response).toContain('DronDoc');
    });

    it('should provide greeting template response', () => {
      const message = 'Привет';
      const context = { category: 'general', messageCount: 1, sentiment: 'neutral' };

      const response = bot.getTemplateResponse(message, context);

      expect(response).toContain('Здравствуйте');
      expect(response).toContain('ассистент');
    });
  });

  describe('Statistics', () => {
    it('should return correct statistics', async () => {
      // Create some test data
      await bot.getOrCreateCustomerContext('customer_1', 'chat_1');
      await bot.getOrCreateCustomerContext('customer_2', 'chat_2');
      bot.activeConversations.set('chat_1', 'conv_1');

      bot.isConnected = true;
      bot.startTime = new Date(Date.now() - 60000); // 1 minute ago

      const stats = bot.getStatistics();

      expect(stats.isConnected).toBe(true);
      expect(stats.activeConversations).toBe(1);
      expect(stats.totalCustomers).toBe(2);
      expect(stats.uptime).toBeGreaterThan(0);
    });

    it('should group customers by category', async () => {
      const context1 = await bot.getOrCreateCustomerContext('customer_1', 'chat_1');
      context1.category = 'tariff';

      const context2 = await bot.getOrCreateCustomerContext('customer_2', 'chat_2');
      context2.category = 'tariff';

      const context3 = await bot.getOrCreateCustomerContext('customer_3', 'chat_3');
      context3.category = 'technical_issue';

      const categories = bot.getCustomersByCategory();

      expect(categories).toEqual({
        tariff: 2,
        technical_issue: 1
      });
    });
  });

  describe('Active Conversations', () => {
    it('should return active conversations with customer data', async () => {
      const context = await bot.getOrCreateCustomerContext('customer_1', 'chat_1');
      context.category = 'tariff';
      context.messageCount = 5;

      bot.activeConversations.set('chat_1', 'conv_1');

      const conversations = bot.getActiveConversations();

      expect(conversations).toHaveLength(1);
      expect(conversations[0]).toEqual({
        chatId: 'chat_1',
        conversationId: 'conv_1',
        customer: expect.objectContaining({
          customerId: 'customer_1',
          category: 'tariff',
          messageCount: 5
        })
      });
    });
  });

  describe('Context Summary Building', () => {
    it('should build context summary correctly', () => {
      const context = {
        category: 'tariff',
        messageCount: 3,
        sentiment: 'positive',
        questions: [{ type: 'tariff', question: 'Сколько стоит?' }],
        issues: [],
        features: [{ inquiry: 'Есть ли API?' }]
      };

      const summary = bot.buildContextSummary(context);

      expect(summary).toEqual({
        category: 'tariff',
        messageCount: 3,
        sentiment: 'positive',
        hasQuestions: true,
        hasIssues: false,
        interestedFeatures: ['Есть ли API?']
      });
    });
  });
});
