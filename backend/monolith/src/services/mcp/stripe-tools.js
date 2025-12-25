// stripe-tools.js - MCP инструменты для работы со Stripe

const Stripe = require('stripe');
const logger = require('../../utils/logger');

class StripeMCPTools {
  constructor() {
    this.stripeClients = new Map();
  }

  /**
   * Инициализация Stripe клиентов
   */
  initializeClients(apiKeys) {
    apiKeys.forEach((key, index) => {
      try {
        const stripe = new Stripe(key, {
          apiVersion: '2023-10-16',
        });
        this.stripeClients.set(`account_${index + 1}`, {
          client: stripe,
          key: key.substring(0, 10) + '...',
        });
        logger.info(`Stripe client ${index + 1} initialized successfully`);
      } catch (error) {
        logger.error(`Failed to initialize Stripe client ${index + 1}:`, error);
      }
    });
  }

  /**
   * Получить определения MCP инструментов для Stripe
   */
  getToolsDefinition() {
    return [
      {
        name: 'stripe-sync-accounts',
        description: 'Синхронизировать все Stripe аккаунты и получить список',
        inputSchema: {
          type: 'object',
          properties: {
            forceRefresh: {
              type: 'boolean',
              description: 'Принудительное обновление кеша',
              default: false,
            },
          },
        },
      },
      {
        name: 'stripe-get-balance',
        description: 'Получить баланс Stripe аккаунта',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'ID аккаунта (account_1, account_2 и т.д.)',
            },
          },
          required: ['accountId'],
        },
      },
      {
        name: 'stripe-list-transactions',
        description: 'Получить список транзакций из Stripe',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'ID аккаунта',
            },
            startDate: {
              type: 'string',
              description: 'Дата начала (YYYY-MM-DD)',
            },
            endDate: {
              type: 'string',
              description: 'Дата окончания (YYYY-MM-DD)',
            },
            limit: {
              type: 'number',
              description: 'Максимальное количество записей',
              default: 100,
            },
          },
          required: ['accountId'],
        },
      },
      {
        name: 'stripe-list-invoices',
        description: 'Получить список инвойсов из Stripe',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'ID аккаунта',
            },
            startDate: {
              type: 'string',
              description: 'Дата начала',
            },
            endDate: {
              type: 'string',
              description: 'Дата окончания',
            },
            status: {
              type: 'string',
              description: 'Статус инвойса',
              enum: ['draft', 'open', 'paid', 'void', 'uncollectible'],
            },
            limit: {
              type: 'number',
              default: 100,
            },
          },
          required: ['accountId'],
        },
      },
      {
        name: 'stripe-list-payouts',
        description: 'Получить список выплат из Stripe',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'ID аккаунта',
            },
            startDate: {
              type: 'string',
              description: 'Дата начала',
            },
            endDate: {
              type: 'string',
              description: 'Дата окончания',
            },
            limit: {
              type: 'number',
              default: 100,
            },
          },
          required: ['accountId'],
        },
      },
      {
        name: 'stripe-download-statement',
        description: 'Скачать выписку из Stripe',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'ID аккаунта',
            },
            period: {
              type: 'string',
              description: 'Период (YYYY-MM)',
            },
          },
          required: ['accountId', 'period'],
        },
      },
    ];
  }

  /**
   * Выполнить MCP инструмент
   */
  async executeTool(name, args) {
    const toolHandlers = {
      'stripe-sync-accounts': () => this.syncAccounts(args),
      'stripe-get-balance': () => this.getBalance(args),
      'stripe-list-transactions': () => this.listTransactions(args),
      'stripe-list-invoices': () => this.listInvoices(args),
      'stripe-list-payouts': () => this.listPayouts(args),
      'stripe-download-statement': () => this.downloadStatement(args),
    };

    const handler = toolHandlers[name];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    return handler();
  }

  /**
   * Синхронизация всех аккаунтов
   */
  async syncAccounts({ forceRefresh = false }) {
    const results = [];

    for (const [accountId, { client }] of this.stripeClients.entries()) {
      try {
        const account = await client.accounts.retrieve();
        const balance = await client.balance.retrieve();

        results.push({
          accountId,
          email: account.email,
          businessName: account.business_profile?.name,
          country: account.country,
          currency: account.default_currency,
          available: balance.available,
          pending: balance.pending,
          synced: new Date().toISOString(),
        });

        logger.info(`Synced account ${accountId}`);
      } catch (error) {
        logger.error(`Failed to sync account ${accountId}:`, error);
        results.push({
          accountId,
          error: error.message,
        });
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Синхронизировано ${results.length} Stripe аккаунтов:\n\n${JSON.stringify(results, null, 2)}`,
        },
      ],
    };
  }

  /**
   * Получить баланс аккаунта
   */
  async getBalance({ accountId }) {
    const account = this.stripeClients.get(accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    const balance = await account.client.balance.retrieve();

    return {
      content: [
        {
          type: 'text',
          text: `Баланс аккаунта ${accountId}:\n\n${JSON.stringify(balance, null, 2)}`,
        },
      ],
    };
  }

  /**
   * Получить список транзакций
   */
  async listTransactions({ accountId, startDate, endDate, limit = 100 }) {
    const account = this.stripeClients.get(accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    const params = { limit };

    if (startDate || endDate) {
      params.created = {};
      if (startDate) {
        params.created.gte = Math.floor(new Date(startDate).getTime() / 1000);
      }
      if (endDate) {
        params.created.lte = Math.floor(new Date(endDate).getTime() / 1000);
      }
    }

    const transactions = await account.client.balanceTransactions.list(params);

    return {
      content: [
        {
          type: 'text',
          text: `Найдено ${transactions.data.length} транзакций:\n\n${JSON.stringify(transactions.data, null, 2)}`,
        },
      ],
      transactions: transactions.data, // Для последующей обработки
    };
  }

  /**
   * Получить список инвойсов
   */
  async listInvoices({ accountId, startDate, endDate, status, limit = 100 }) {
    const account = this.stripeClients.get(accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    const params = { limit };

    if (status) {
      params.status = status;
    }

    if (startDate || endDate) {
      params.created = {};
      if (startDate) {
        params.created.gte = Math.floor(new Date(startDate).getTime() / 1000);
      }
      if (endDate) {
        params.created.lte = Math.floor(new Date(endDate).getTime() / 1000);
      }
    }

    const invoices = await account.client.invoices.list(params);

    return {
      content: [
        {
          type: 'text',
          text: `Найдено ${invoices.data.length} инвойсов:\n\n${JSON.stringify(invoices.data, null, 2)}`,
        },
      ],
      invoices: invoices.data,
    };
  }

  /**
   * Получить список выплат
   */
  async listPayouts({ accountId, startDate, endDate, limit = 100 }) {
    const account = this.stripeClients.get(accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    const params = { limit };

    if (startDate || endDate) {
      params.created = {};
      if (startDate) {
        params.created.gte = Math.floor(new Date(startDate).getTime() / 1000);
      }
      if (endDate) {
        params.created.lte = Math.floor(new Date(endDate).getTime() / 1000);
      }
    }

    const payouts = await account.client.payouts.list(params);

    return {
      content: [
        {
          type: 'text',
          text: `Найдено ${payouts.data.length} выплат:\n\n${JSON.stringify(payouts.data, null, 2)}`,
        },
      ],
      payouts: payouts.data,
    };
  }

  /**
   * Скачать выписку
   */
  async downloadStatement({ accountId, period }) {
    const account = this.stripeClients.get(accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    // Получить все транзакции за период
    const [year, month] = period.split('-');
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const transactions = await this.listTransactions({
      accountId,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      limit: 1000,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Выписка за ${period} для аккаунта ${accountId}:\n\nВсего транзакций: ${transactions.transactions.length}`,
        },
      ],
      statement: {
        period,
        accountId,
        transactions: transactions.transactions,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

module.exports = StripeMCPTools;
