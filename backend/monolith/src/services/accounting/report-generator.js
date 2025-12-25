// report-generator.js - Генерация бухгалтерских отчетов

const logger = require('../../utils/logger');
const TaxCalculator = require('./tax-calculator');
const TransactionManager = require('./transaction-manager');

class ReportGenerator {
  constructor() {
    this.taxCalculator = new TaxCalculator();
    this.transactionManager = new TransactionManager();
  }

  /**
   * Сформировать баланс (форма 1)
   */
  async generateBalanceSheet(date) {
    logger.info(`Generating balance sheet for ${date}`);

    const balanceSheet = {
      reportType: 'BalanceSheet',
      date,
      assets: {
        current: {},
        nonCurrent: {},
        total: 0,
      },
      liabilities: {
        current: {},
        nonCurrent: {},
        total: 0,
      },
      equity: {
        capital: 0,
        retainedEarnings: 0,
        total: 0,
      },
    };

    // TODO: Implement balance sheet calculation from transactions
    // Это требует более сложной системы учета активов и пассивов

    return balanceSheet;
  }

  /**
   * Сформировать отчет о прибылях и убытках (форма 2)
   */
  async generateProfitLossStatement(startDate, endDate) {
    logger.info(`Generating P&L statement for ${startDate} - ${endDate}`);

    const stats = await this.transactionManager.getTransactionStats();
    const taxReport = await this.taxCalculator.calculateTaxes(startDate, endDate);

    const pnl = {
      reportType: 'ProfitAndLoss',
      period: { startDate, endDate },
      revenue: {
        sales: taxReport.revenue,
        other: 0,
        total: taxReport.revenue,
      },
      costOfSales: 0,
      grossProfit: taxReport.revenue,
      operatingExpenses: taxReport.expenses,
      operatingProfit: taxReport.profit,
      financialIncome: 0,
      financialExpenses: 0,
      profitBeforeTax: taxReport.profit,
      incomeTax: taxReport.profitTax.amount,
      netProfit: taxReport.profit - taxReport.profitTax.amount,
      generatedAt: new Date().toISOString(),
    };

    logger.info(`P&L generated: Net profit = ${pnl.netProfit}`);

    return pnl;
  }

  /**
   * Сформировать отчет о движении денежных средств
   */
  async generateCashFlowStatement(startDate, endDate) {
    logger.info(`Generating cash flow statement for ${startDate} - ${endDate}`);

    const transactions = await this.transactionManager.getTransactions({
      startDate,
      endDate,
    });

    const cashFlow = {
      reportType: 'CashFlow',
      period: { startDate, endDate },
      operating: {
        receipts: 0,
        payments: 0,
        net: 0,
      },
      investing: {
        receipts: 0,
        payments: 0,
        net: 0,
      },
      financing: {
        receipts: 0,
        payments: 0,
        net: 0,
      },
      netCashFlow: 0,
      openingBalance: 0,
      closingBalance: 0,
    };

    // Categorize cash flows
    for (const trans of transactions) {
      const amount = trans.amount || 0;

      // Operating activities
      if (['Income', 'Expense'].includes(trans.category)) {
        if (amount > 0) {
          cashFlow.operating.receipts += amount;
        } else {
          cashFlow.operating.payments += Math.abs(amount);
        }
      }
      // TODO: Add investing and financing categorization
    }

    cashFlow.operating.net = cashFlow.operating.receipts - cashFlow.operating.payments;
    cashFlow.netCashFlow = cashFlow.operating.net + cashFlow.investing.net + cashFlow.financing.net;

    return cashFlow;
  }

  /**
   * Сформировать книгу доходов и расходов (КУДиР)
   */
  async generateIncomeExpenseBook(startDate, endDate) {
    logger.info(`Generating income/expense book for ${startDate} - ${endDate}`);

    const transactions = await this.transactionManager.getTransactions({
      startDate,
      endDate,
    });

    const book = {
      reportType: 'IncomeExpenseBook',
      period: { startDate, endDate },
      entries: [],
      summary: {
        totalIncome: 0,
        totalExpense: 0,
        net: 0,
      },
    };

    for (const trans of transactions) {
      book.entries.push({
        date: trans.date,
        documentNumber: trans.invoiceNumber || trans.externalId,
        description: trans.description,
        income: trans.category === 'Income' ? trans.amount : 0,
        expense: trans.category === 'Expense' ? Math.abs(trans.amount) : 0,
      });

      if (trans.category === 'Income') {
        book.summary.totalIncome += trans.amount || 0;
      } else if (trans.category === 'Expense') {
        book.summary.totalExpense += Math.abs(trans.amount || 0);
      }
    }

    book.summary.net = book.summary.totalIncome - book.summary.totalExpense;

    return book;
  }

  /**
   * Экспорт отчета в Excel
   */
  async exportToExcel(report, filePath) {
    const XLSX = require('xlsx');

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([report]);

    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, filePath);

    logger.info(`Report exported to Excel: ${filePath}`);
  }

  /**
   * Экспорт отчета в PDF
   */
  async exportToPDF(report, filePath) {
    // TODO: Implement PDF generation
    logger.info(`Report exported to PDF: ${filePath}`);
  }
}

module.exports = ReportGenerator;
