// transaction-manager.js - Управление транзакциями и автозаполнение таблицы

const logger = require('../../utils/logger');
// TODO: Replace with actual database models when ready
// const { Transaction, Document } = require('../../models');
// Using mock data for now
const Transaction = {
  findAll: async () => [],
  create: async (data) => ({ id: Date.now(), ...data }),
};
const Document = {
  findAll: async () => [],
  create: async (data) => ({ id: Date.now(), ...data }),
};

class TransactionManager {
  constructor() {
    this.pendingTransactions = [];
  }

  /**
   * Обработать документ и извлечь транзакции
   */
  async processDocument(documentData, filePath) {
    try {
      // Сохранить документ в БД
      const document = await this.saveDocument(documentData, filePath);

      let transactions = [];

      // Извлечь транзакции в зависимости от типа документа
      switch (documentData.type) {
        case 'invoice':
          transactions = await this.extractInvoiceTransactions(documentData, document);
          break;

        case 'bank_statement':
          transactions = await this.extractBankStatementTransactions(documentData, document);
          break;

        case 'stripe_export':
          transactions = await this.extractStripeTransactions(documentData, document);
          break;

        case 'receipt':
          transactions = await this.extractReceiptTransactions(documentData, document);
          break;

        default:
          logger.warn(`Unknown document type: ${documentData.type}`);
          return [];
      }

      // Сохранить транзакции в БД
      const savedTransactions = await this.saveTransactions(transactions);

      logger.info(`Processed ${savedTransactions.length} transactions from ${documentData.type}`);

      return savedTransactions;
    } catch (error) {
      logger.error('Error processing document:', error);
      throw error;
    }
  }

  /**
   * Сохранить документ в БД
   */
  async saveDocument(documentData, filePath) {
    try {
      const document = await Document.create({
        type: documentData.type,
        filePath: filePath,
        fileName: documentData.sourceFile,
        invoiceNumber: documentData.invoiceNumber,
        date: documentData.date,
        amount: documentData.amount,
        currency: documentData.currency,
        seller: documentData.seller,
        buyer: documentData.buyer,
        vat: documentData.vat,
        accountNumber: documentData.accountNumber,
        periodStart: documentData.periodStart,
        periodEnd: documentData.periodEnd,
        openingBalance: documentData.openingBalance,
        closingBalance: documentData.closingBalance,
        metadata: JSON.stringify(documentData),
        parsedAt: new Date(),
      });

      logger.info(`Document saved: ${document.id}`);

      return document;
    } catch (error) {
      logger.error('Error saving document:', error);
      throw error;
    }
  }

  /**
   * Извлечь транзакции из инвойса
   */
  async extractInvoiceTransactions(documentData, document) {
    const transactions = [];

    // Основная транзакция инвойса
    transactions.push({
      documentId: document.id,
      type: 'invoice',
      date: documentData.date,
      description: `Invoice ${documentData.invoiceNumber || 'Unknown'}`,
      amount: documentData.amount,
      currency: documentData.currency || 'USD',
      category: 'Income',
      subCategory: 'Sales',
      counterparty: documentData.buyer || documentData.seller,
      invoiceNumber: documentData.invoiceNumber,
      vat: documentData.vat,
      source: 'document',
    });

    // Если есть позиции, создать детализированные транзакции
    if (documentData.items && documentData.items.length > 0) {
      for (const item of documentData.items) {
        transactions.push({
          documentId: document.id,
          type: 'invoice_item',
          date: documentData.date,
          description: item.description,
          amount: item.amount,
          currency: documentData.currency || 'USD',
          category: 'Income',
          subCategory: 'Sales',
          quantity: item.quantity,
          unitPrice: item.price,
          invoiceNumber: documentData.invoiceNumber,
          source: 'document',
        });
      }
    }

    return transactions;
  }

  /**
   * Извлечь транзакции из банковской выписки
   */
  async extractBankStatementTransactions(documentData, document) {
    const transactions = [];

    if (!documentData.transactions || documentData.transactions.length === 0) {
      return transactions;
    }

    for (const trans of documentData.transactions) {
      const amount = (trans.credit || 0) - (trans.debit || 0);

      transactions.push({
        documentId: document.id,
        type: 'bank_transaction',
        date: trans.date,
        description: trans.description,
        amount: amount,
        debit: trans.debit,
        credit: trans.credit,
        balance: trans.balance,
        currency: documentData.currency || 'USD',
        category: amount > 0 ? 'Income' : 'Expense',
        subCategory: trans.category || 'Uncategorized',
        accountNumber: documentData.accountNumber,
        source: 'bank_statement',
      });
    }

    return transactions;
  }

  /**
   * Извлечь транзакции из Stripe экспорта
   */
  async extractStripeTransactions(documentData, document) {
    const transactions = [];

    if (!documentData.transactions || documentData.transactions.length === 0) {
      return transactions;
    }

    for (const trans of documentData.transactions) {
      transactions.push({
        documentId: document.id,
        type: 'stripe_transaction',
        externalId: trans.id,
        date: trans.date,
        description: trans.description,
        amount: trans.amount,
        currency: trans.currency,
        fee: trans.fee,
        net: trans.net,
        category: 'Income',
        subCategory: 'Online Sales',
        counterparty: trans.customerEmail,
        status: trans.status,
        source: 'stripe',
      });
    }

    return transactions;
  }

  /**
   * Извлечь транзакции из квитанции
   */
  async extractReceiptTransactions(documentData, document) {
    const transactions = [];

    transactions.push({
      documentId: document.id,
      type: 'receipt',
      date: documentData.date,
      description: documentData.description || 'Receipt',
      amount: documentData.amount,
      currency: documentData.currency || 'USD',
      category: 'Expense',
      subCategory: 'Uncategorized',
      source: 'document',
    });

    return transactions;
  }

  /**
   * Сохранить транзакции в БД
   */
  async saveTransactions(transactions) {
    try {
      const saved = [];

      for (const trans of transactions) {
        // Проверить на дубликаты
        const existing = await Transaction.findOne({
          where: {
            documentId: trans.documentId,
            date: trans.date,
            amount: trans.amount,
            description: trans.description,
          },
        });

        if (existing) {
          logger.warn(`Duplicate transaction skipped: ${trans.description}`);
          continue;
        }

        const transaction = await Transaction.create(trans);
        saved.push(transaction);
      }

      logger.info(`Saved ${saved.length} transactions`);

      return saved;
    } catch (error) {
      logger.error('Error saving transactions:', error);
      throw error;
    }
  }

  /**
   * Получить транзакции с фильтрацией
   */
  async getTransactions(filters = {}) {
    try {
      const where = {};

      if (filters.startDate) {
        where.date = { $gte: filters.startDate };
      }
      if (filters.endDate) {
        where.date = { ...where.date, $lte: filters.endDate };
      }
      if (filters.category) {
        where.category = filters.category;
      }
      if (filters.type) {
        where.type = filters.type;
      }
      if (filters.source) {
        where.source = filters.source;
      }

      const transactions = await Transaction.findAll({
        where,
        include: [Document],
        order: [['date', 'DESC']],
        limit: filters.limit || 1000,
      });

      return transactions;
    } catch (error) {
      logger.error('Error getting transactions:', error);
      throw error;
    }
  }

  /**
   * Категоризация транзакций
   */
  async categorizeTransactions() {
    const uncategorized = await Transaction.findAll({
      where: { category: 'Uncategorized' },
    });

    for (const trans of uncategorized) {
      const category = this.detectCategory(trans);
      if (category) {
        await trans.update({ category: category.main, subCategory: category.sub });
        logger.info(`Transaction ${trans.id} categorized as ${category.main}/${category.sub}`);
      }
    }
  }

  /**
   * Автоматическое определение категории по описанию
   */
  detectCategory(transaction) {
    const desc = transaction.description.toLowerCase();

    const patterns = {
      salary: { main: 'Income', sub: 'Salary' },
      rent: { main: 'Expense', sub: 'Rent' },
      office: { main: 'Expense', sub: 'Office' },
      software: { main: 'Expense', sub: 'Software' },
      hosting: { main: 'Expense', sub: 'Hosting' },
      advertising: { main: 'Expense', sub: 'Marketing' },
      payment: { main: 'Income', sub: 'Sales' },
    };

    for (const [keyword, category] of Object.entries(patterns)) {
      if (desc.includes(keyword)) {
        return category;
      }
    }

    return null;
  }

  /**
   * Статистика транзакций
   */
  async getTransactionStats(period = 'month') {
    try {
      // TODO: Implement aggregation queries
      const stats = {
        totalIncome: 0,
        totalExpense: 0,
        netProfit: 0,
        transactionCount: 0,
        byCategory: {},
      };

      const transactions = await this.getTransactions();

      for (const trans of transactions) {
        if (trans.category === 'Income') {
          stats.totalIncome += trans.amount || 0;
        } else if (trans.category === 'Expense') {
          stats.totalExpense += Math.abs(trans.amount || 0);
        }

        stats.transactionCount++;

        if (!stats.byCategory[trans.category]) {
          stats.byCategory[trans.category] = 0;
        }
        stats.byCategory[trans.category] += Math.abs(trans.amount || 0);
      }

      stats.netProfit = stats.totalIncome - stats.totalExpense;

      return stats;
    } catch (error) {
      logger.error('Error getting transaction stats:', error);
      throw error;
    }
  }
}

module.exports = TransactionManager;
