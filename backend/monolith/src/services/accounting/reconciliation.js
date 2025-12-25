// reconciliation.js - Автоматическая реконсилиация (сверка транзакций)

const logger = require('../../utils/logger');
// TODO: Replace with actual database models when ready
// const { Transaction } = require('../../models');
// Using mock data for now
const Transaction = {
  findAll: async () => [],
  create: async (data) => ({ id: Date.now(), ...data }),
  update: async (id, data) => ({ id, ...data }),
};

class ReconciliationEngine {
  constructor() {
    this.matchingRules = [];
    this.tolerance = 0.01; // Допустимая погрешность для сумм
  }

  /**
   * Выполнить реконсилиацию между двумя источниками
   */
  async reconcile(source1, source2, options = {}) {
    try {
      logger.info(`Starting reconciliation: ${source1} vs ${source2}`);

      // Получить транзакции из обоих источников
      const transactions1 = await this.getTransactionsBySource(source1);
      const transactions2 = await this.getTransactionsBySource(source2);

      const results = {
        source1,
        source2,
        matched: [],
        unmatchedSource1: [],
        unmatchedSource2: [],
        discrepancies: [],
        summary: {},
      };

      // Создать копии массивов для отслеживания несопоставленных
      const unmatched1 = [...transactions1];
      const unmatched2 = [...transactions2];

      // Сопоставление транзакций
      for (let i = 0; i < transactions1.length; i++) {
        const trans1 = transactions1[i];
        let bestMatch = null;
        let bestScore = 0;

        for (let j = 0; j < transactions2.length; j++) {
          const trans2 = transactions2[j];

          // Проверить уже сопоставлены ли
          if (results.matched.some(m => m.trans2Id === trans2.id)) {
            continue;
          }

          // Вычислить оценку совпадения
          const score = this.calculateMatchScore(trans1, trans2);

          if (score > bestScore && score >= options.minScore || 0.7) {
            bestScore = score;
            bestMatch = trans2;
          }
        }

        if (bestMatch) {
          // Найдено совпадение
          const match = {
            trans1Id: trans1.id,
            trans2Id: bestMatch.id,
            score: bestScore,
            trans1: trans1,
            trans2: bestMatch,
          };

          // Проверить на расхождения в сумме
          if (Math.abs(trans1.amount - bestMatch.amount) > this.tolerance) {
            match.discrepancy = {
              field: 'amount',
              value1: trans1.amount,
              value2: bestMatch.amount,
              difference: trans1.amount - bestMatch.amount,
            };
            results.discrepancies.push(match);
          }

          results.matched.push(match);

          // Удалить из несопоставленных
          const idx1 = unmatched1.findIndex(t => t.id === trans1.id);
          if (idx1 >= 0) unmatched1.splice(idx1, 1);

          const idx2 = unmatched2.findIndex(t => t.id === bestMatch.id);
          if (idx2 >= 0) unmatched2.splice(idx2, 1);
        }
      }

      results.unmatchedSource1 = unmatched1;
      results.unmatchedSource2 = unmatched2;

      // Сводка
      results.summary = {
        total1: transactions1.length,
        total2: transactions2.length,
        matched: results.matched.length,
        unmatched1: unmatched1.length,
        unmatched2: unmatched2.length,
        discrepancies: results.discrepancies.length,
        matchRate: (results.matched.length / Math.max(transactions1.length, transactions2.length) * 100).toFixed(2) + '%',
      };

      logger.info('Reconciliation completed:', results.summary);

      return results;
    } catch (error) {
      logger.error('Reconciliation error:', error);
      throw error;
    }
  }

  /**
   * Вычислить оценку совпадения двух транзакций
   */
  calculateMatchScore(trans1, trans2) {
    let score = 0;
    let weights = {
      date: 0.3,
      amount: 0.4,
      description: 0.2,
      counterparty: 0.1,
    };

    // Совпадение по дате (с допуском ±3 дня)
    const dateDiff = Math.abs(new Date(trans1.date) - new Date(trans2.date)) / (1000 * 60 * 60 * 24);
    if (dateDiff === 0) {
      score += weights.date;
    } else if (dateDiff <= 3) {
      score += weights.date * (1 - dateDiff / 3);
    }

    // Совпадение по сумме
    const amountDiff = Math.abs(trans1.amount - trans2.amount);
    if (amountDiff <= this.tolerance) {
      score += weights.amount;
    } else if (amountDiff < Math.abs(trans1.amount) * 0.1) {
      // В пределах 10%
      score += weights.amount * 0.5;
    }

    // Совпадение по описанию (строковое сходство)
    if (trans1.description && trans2.description) {
      const similarity = this.stringSimilarity(
        trans1.description.toLowerCase(),
        trans2.description.toLowerCase()
      );
      score += weights.description * similarity;
    }

    // Совпадение по контрагенту
    if (trans1.counterparty && trans2.counterparty) {
      const similarity = this.stringSimilarity(
        trans1.counterparty.toLowerCase(),
        trans2.counterparty.toLowerCase()
      );
      score += weights.counterparty * similarity;
    }

    return score;
  }

  /**
   * Вычислить строковое сходство (простая метрика)
   */
  stringSimilarity(str1, str2) {
    // Используем расстояние Левенштейна
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    return (longer.length - this.levenshteinDistance(longer, shorter)) / longer.length;
  }

  /**
   * Расстояние Левенштейна
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Получить транзакции по источнику
   */
  async getTransactionsBySource(source) {
    return await Transaction.findAll({
      where: { source },
      order: [['date', 'ASC']],
    });
  }

  /**
   * Автоматическая сверка Stripe и банковских выписок
   */
  async reconcileStripeWithBank(options = {}) {
    return await this.reconcile('stripe', 'bank_statement', options);
  }

  /**
   * Сверка инвойсов с платежами
   */
  async reconcileInvoicesWithPayments(options = {}) {
    const invoices = await Transaction.findAll({
      where: { type: 'invoice' },
      order: [['date', 'ASC']],
    });

    const payments = await Transaction.findAll({
      where: { type: { $in: ['bank_transaction', 'stripe_transaction'] } },
      order: [['date', 'ASC']],
    });

    const results = {
      paidInvoices: [],
      unpaidInvoices: [],
      unmatchedPayments: [],
    };

    const unmatchedPayments = [...payments];

    for (const invoice of invoices) {
      let paid = false;

      for (let i = 0; i < unmatchedPayments.length; i++) {
        const payment = unmatchedPayments[i];

        // Проверить совпадение
        if (this.isInvoicePaymentMatch(invoice, payment)) {
          results.paidInvoices.push({
            invoice,
            payment,
          });

          unmatchedPayments.splice(i, 1);
          paid = true;
          break;
        }
      }

      if (!paid) {
        results.unpaidInvoices.push(invoice);
      }
    }

    results.unmatchedPayments = unmatchedPayments;

    logger.info(`Invoice reconciliation: ${results.paidInvoices.length} paid, ${results.unpaidInvoices.length} unpaid`);

    return results;
  }

  /**
   * Проверить является ли платеж оплатой инвойса
   */
  isInvoicePaymentMatch(invoice, payment) {
    // Проверить номер инвойса в описании платежа
    if (invoice.invoiceNumber && payment.description) {
      if (payment.description.includes(invoice.invoiceNumber)) {
        return true;
      }
    }

    // Проверить совпадение по сумме и дате (в пределах месяца)
    if (Math.abs(invoice.amount - payment.amount) <= this.tolerance) {
      const dateDiff = Math.abs(new Date(invoice.date) - new Date(payment.date)) / (1000 * 60 * 60 * 24);
      if (dateDiff <= 30) {
        return true;
      }
    }

    return false;
  }

  /**
   * Отчет о несверенных транзакциях
   */
  async getUnreconciledReport() {
    // TODO: Implement detailed unreconciled transactions report
    const results = await this.reconcileStripeWithBank();

    return {
      unmatchedStripe: results.unmatchedSource1,
      unmatchedBank: results.unmatchedSource2,
      discrepancies: results.discrepancies,
      summary: results.summary,
    };
  }
}

module.exports = ReconciliationEngine;
