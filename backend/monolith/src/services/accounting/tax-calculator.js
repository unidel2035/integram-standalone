// tax-calculator.js - Автоматический расчет налогов

const logger = require('../../utils/logger');
// TODO: Replace with actual database models when ready
// const { Transaction } = require('../../models');
// Using mock data for now
const Transaction = {
  findAll: async () => [],
  create: async (data) => ({ id: Date.now(), ...data }),
};

class TaxCalculator {
  constructor(config = {}) {
    this.config = {
      vatRate: config.vatRate || 20, // НДС 20%
      profitTaxRate: config.profitTaxRate || 20, // Налог на прибыль 20%
      country: config.country || 'RU',
      ...config,
    };
  }

  /**
   * Рассчитать налоги за период
   */
  async calculateTaxes(startDate, endDate) {
    try {
      logger.info(`Calculating taxes for period: ${startDate} - ${endDate}`);

      const transactions = await this.getTransactionsByPeriod(startDate, endDate);

      const taxReport = {
        period: { startDate, endDate },
        revenue: 0,
        revenueWithVAT: 0,
        expenses: 0,
        expensesWithVAT: 0,
        profit: 0,
        vat: {
          received: 0, // НДС полученный
          paid: 0, // НДС уплаченный
          payable: 0, // НДС к уплате
        },
        profitTax: {
          taxableProfit: 0,
          amount: 0,
        },
        transactions: {
          income: [],
          expense: [],
        },
      };

      // Обработка транзакций
      for (const trans of transactions) {
        if (trans.category === 'Income') {
          taxReport.transactions.income.push(trans);
          taxReport.revenueWithVAT += trans.amount || 0;

          // Рассчитать НДС
          const vat = this.extractVAT(trans.amount, this.config.vatRate);
          taxReport.revenue += trans.amount - vat;
          taxReport.vat.received += vat;
        } else if (trans.category === 'Expense') {
          taxReport.transactions.expense.push(trans);
          const absAmount = Math.abs(trans.amount || 0);
          taxReport.expensesWithVAT += absAmount;

          // Рассчитать НДС
          const vat = this.extractVAT(absAmount, this.config.vatRate);
          taxReport.expenses += absAmount - vat;
          taxReport.vat.paid += vat;
        }
      }

      // Итоговые расчеты
      taxReport.vat.payable = taxReport.vat.received - taxReport.vat.paid;
      taxReport.profit = taxReport.revenue - taxReport.expenses;
      taxReport.profitTax.taxableProfit = taxReport.profit;
      taxReport.profitTax.amount = taxReport.profit * (this.config.profitTaxRate / 100);

      logger.info(`Tax calculation completed: Profit = ${taxReport.profit}, VAT payable = ${taxReport.vat.payable}`);

      return taxReport;
    } catch (error) {
      logger.error('Tax calculation error:', error);
      throw error;
    }
  }

  /**
   * Извлечь НДС из суммы с НДС
   */
  extractVAT(amountWithVAT, vatRate) {
    return amountWithVAT - (amountWithVAT / (1 + vatRate / 100));
  }

  /**
   * Добавить НДС к сумме
   */
  addVAT(amountWithoutVAT, vatRate) {
    return amountWithoutVAT * (1 + vatRate / 100);
  }

  /**
   * Получить транзакции за период
   */
  async getTransactionsByPeriod(startDate, endDate) {
    return await Transaction.findAll({
      where: {
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      },
      order: [['date', 'ASC']],
    });
  }

  /**
   * Рассчитать налоги за квартал
   */
  async calculateQuarterlyTaxes(year, quarter) {
    const { startDate, endDate } = this.getQuarterDates(year, quarter);
    return await this.calculateTaxes(startDate, endDate);
  }

  /**
   * Рассчитать налоги за год
   */
  async calculateAnnualTaxes(year) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    return await this.calculateTaxes(startDate, endDate);
  }

  /**
   * Получить даты квартала
   */
  getQuarterDates(year, quarter) {
    const quarters = {
      1: { start: '01-01', end: '03-31' },
      2: { start: '04-01', end: '06-30' },
      3: { start: '07-01', end: '09-30' },
      4: { start: '10-01', end: '12-31' },
    };

    const q = quarters[quarter];
    return {
      startDate: `${year}-${q.start}`,
      endDate: `${year}-${q.end}`,
    };
  }

  /**
   * Сформировать налоговую декларацию по НДС
   */
  async generateVATDeclaration(year, quarter) {
    const taxReport = await this.calculateQuarterlyTaxes(year, quarter);

    const declaration = {
      type: 'VAT',
      period: { year, quarter },
      taxpayerInfo: {
        // TODO: Заполнить из конфигурации
        inn: this.config.inn,
        kpp: this.config.kpp,
        name: this.config.companyName,
      },
      data: {
        revenueWithVAT: taxReport.revenueWithVAT,
        revenue: taxReport.revenue,
        vatReceived: taxReport.vat.received,
        expensesWithVAT: taxReport.expensesWithVAT,
        expenses: taxReport.expenses,
        vatPaid: taxReport.vat.paid,
        vatPayable: taxReport.vat.payable,
      },
      generatedAt: new Date().toISOString(),
    };

    logger.info(`VAT declaration generated for ${year} Q${quarter}`);

    return declaration;
  }

  /**
   * Сформировать налоговую декларацию по налогу на прибыль
   */
  async generateProfitTaxDeclaration(year) {
    const taxReport = await this.calculateAnnualTaxes(year);

    const declaration = {
      type: 'ProfitTax',
      period: { year },
      taxpayerInfo: {
        inn: this.config.inn,
        kpp: this.config.kpp,
        name: this.config.companyName,
      },
      data: {
        revenue: taxReport.revenue,
        expenses: taxReport.expenses,
        profit: taxReport.profit,
        taxRate: this.config.profitTaxRate,
        taxAmount: taxReport.profitTax.amount,
      },
      generatedAt: new Date().toISOString(),
    };

    logger.info(`Profit tax declaration generated for ${year}`);

    return declaration;
  }

  /**
   * Рассчитать упрощенную систему налогообложения (УСН)
   */
  async calculateSimplifiedTax(startDate, endDate, type = '6%') {
    const transactions = await this.getTransactionsByPeriod(startDate, endDate);

    const report = {
      type: 'USN',
      scheme: type,
      period: { startDate, endDate },
      revenue: 0,
      expenses: 0,
      taxBase: 0,
      taxAmount: 0,
    };

    for (const trans of transactions) {
      if (trans.category === 'Income') {
        report.revenue += trans.amount || 0;
      } else if (trans.category === 'Expense') {
        report.expenses += Math.abs(trans.amount || 0);
      }
    }

    // УСН 6% (Доходы)
    if (type === '6%') {
      report.taxBase = report.revenue;
      report.taxAmount = report.revenue * 0.06;
    }
    // УСН 15% (Доходы минус расходы)
    else if (type === '15%') {
      report.taxBase = report.revenue - report.expenses;
      report.taxAmount = (report.revenue - report.expenses) * 0.15;
    }

    logger.info(`Simplified tax calculated: ${report.taxAmount}`);

    return report;
  }
}

module.exports = TaxCalculator;
