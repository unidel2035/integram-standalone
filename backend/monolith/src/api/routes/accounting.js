// accounting.js - Accounting & Financial Management Routes
import express from 'express';
import multer from 'multer';
import path from 'path';
import logger from '../../utils/logger.js';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|xlsx|xls|csv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, Excel, and CSV files are allowed'));
    }
  }
});

/**
 * Create Accounting routes
 * Provides accounting automation, transaction management, and tax calculations
 */
export function createAccountingRoutes() {
  const router = express.Router();

  /**
   * GET /api/accounting/transactions
   * List all transactions with optional filters
   */
  router.get('/transactions', async (req, res) => {
    try {
      const { startDate, endDate, type, status, limit = 100, offset = 0 } = req.query;

      // Import transaction manager
      const { TransactionManager } = await import('../../services/accounting/transaction-manager.js');
      const manager = new TransactionManager();

      const transactions = await manager.listTransactions({
        startDate,
        endDate,
        type,
        status,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        transactions: transactions.rows,
        total: transactions.count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to list transactions');
      res.status(500).json({
        success: false,
        error: 'Failed to list transactions',
        message: error.message
      });
    }
  });

  /**
   * POST /api/accounting/transactions
   * Create a new transaction manually
   */
  router.post('/transactions', async (req, res) => {
    try {
      const transactionData = req.body;

      if (!transactionData.amount || !transactionData.type) {
        return res.status(400).json({
          success: false,
          error: 'Amount and type are required'
        });
      }

      // Import transaction manager
      const { TransactionManager } = await import('../../services/accounting/transaction-manager.js');
      const manager = new TransactionManager();

      const transaction = await manager.createTransaction(transactionData);

      res.json({
        success: true,
        transaction
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create transaction');
      res.status(500).json({
        success: false,
        error: 'Failed to create transaction',
        message: error.message
      });
    }
  });

  /**
   * POST /api/accounting/upload
   * Upload and parse financial documents (PDF, Excel, CSV)
   */
  router.post('/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const filePath = req.file.path;
      const fileType = path.extname(req.file.originalname).toLowerCase();

      let parser;
      let data;

      // Select appropriate parser based on file type
      if (fileType === '.pdf') {
        const { PDFParser } = await import('../../parsers/pdf-parser.js');
        parser = new PDFParser();
        data = await parser.parse(filePath);
      } else if (fileType === '.xlsx' || fileType === '.xls') {
        const { ExcelParser } = await import('../../parsers/excel-parser.js');
        parser = new ExcelParser();
        data = await parser.parse(filePath);
      } else if (fileType === '.csv') {
        const { CSVParser } = await import('../../parsers/csv-parser.js');
        parser = new CSVParser();
        data = await parser.parse(filePath);
      }

      // Process parsed data and create transactions
      const { TransactionManager } = await import('../../services/accounting/transaction-manager.js');
      const manager = new TransactionManager();
      const transactions = await manager.importTransactions(data);

      res.json({
        success: true,
        file: req.file.originalname,
        parsed: data.length,
        imported: transactions.length,
        transactions
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to upload and parse file');
      res.status(500).json({
        success: false,
        error: 'Failed to process file',
        message: error.message
      });
    }
  });

  /**
   * GET /api/accounting/reports
   * Generate financial reports
   */
  router.get('/reports', async (req, res) => {
    try {
      const { type = 'summary', startDate, endDate, format = 'json' } = req.query;

      // Import report generator
      const { ReportGenerator } = await import('../../services/accounting/report-generator.js');
      const generator = new ReportGenerator();

      const report = await generator.generateReport({
        type,
        startDate,
        endDate,
        format
      });

      if (format === 'pdf') {
        res.contentType('application/pdf');
        res.send(report);
      } else {
        res.json({
          success: true,
          report
        });
      }
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to generate report');
      res.status(500).json({
        success: false,
        error: 'Failed to generate report',
        message: error.message
      });
    }
  });

  /**
   * POST /api/accounting/reconcile
   * Reconcile transactions with bank statements
   */
  router.post('/reconcile', async (req, res) => {
    try {
      const { bankStatements, transactions } = req.body;

      if (!bankStatements || !transactions) {
        return res.status(400).json({
          success: false,
          error: 'Bank statements and transactions are required'
        });
      }

      // Import reconciliation service
      const { Reconciliation } = await import('../../services/accounting/reconciliation.js');
      const reconciliation = new Reconciliation();

      const result = await reconciliation.reconcile(bankStatements, transactions);

      res.json({
        success: true,
        matched: result.matched,
        unmatched: result.unmatched,
        discrepancies: result.discrepancies,
        summary: result.summary
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to reconcile transactions');
      res.status(500).json({
        success: false,
        error: 'Failed to reconcile',
        message: error.message
      });
    }
  });

  /**
   * GET /api/accounting/tax
   * Calculate tax obligations
   */
  router.get('/tax', async (req, res) => {
    try {
      const { year, quarter, taxSystem = 'USN' } = req.query;

      if (!year) {
        return res.status(400).json({
          success: false,
          error: 'Year is required'
        });
      }

      // Import tax calculator
      const { TaxCalculator } = await import('../../services/accounting/tax-calculator.js');
      const calculator = new TaxCalculator();

      const taxData = await calculator.calculate({
        year: parseInt(year),
        quarter: quarter ? parseInt(quarter) : null,
        taxSystem
      });

      res.json({
        success: true,
        tax: taxData
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to calculate tax');
      res.status(500).json({
        success: false,
        error: 'Failed to calculate tax',
        message: error.message
      });
    }
  });

  /**
   * POST /api/accounting/deduplicate
   * Find and mark duplicate transactions
   */
  router.post('/deduplicate', async (req, res) => {
    try {
      const { threshold = 0.95 } = req.body;

      // Import deduplicator
      const { Deduplicator } = await import('../../services/accounting/deduplicator.js');
      const deduplicator = new Deduplicator();

      const duplicates = await deduplicator.findDuplicates(threshold);

      res.json({
        success: true,
        duplicates: duplicates.length,
        groups: duplicates
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to deduplicate transactions');
      res.status(500).json({
        success: false,
        error: 'Failed to deduplicate',
        message: error.message
      });
    }
  });

  /**
   * POST /api/accounting/watch
   * Start watching inbox folder for new documents
   */
  router.post('/watch', async (req, res) => {
    try {
      const { folder } = req.body;

      if (!folder) {
        return res.status(400).json({
          success: false,
          error: 'Folder path is required'
        });
      }

      // Import file watcher
      const { FileWatcher } = await import('../../services/accounting/file-watcher.js');
      const watcher = new FileWatcher();

      await watcher.watch(folder);

      res.json({
        success: true,
        message: `Watching folder: ${folder}`,
        folder
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to start file watcher');
      res.status(500).json({
        success: false,
        error: 'Failed to start watching',
        message: error.message
      });
    }
  });

  /**
   * GET /api/accounting/health
   * Accounting service health check
   */
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'accounting',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
