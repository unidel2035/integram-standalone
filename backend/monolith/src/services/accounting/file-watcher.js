// file-watcher.js - Мониторинг папки /inbox для новых документов

const chokidar = require('chokidar');
const path = require('path');
const logger = require('../../utils/logger');
const PDFParser = require('../../parsers/pdf-parser');
const ExcelParser = require('../../parsers/excel-parser');
const CSVParser = require('../../parsers/csv-parser');
const Deduplicator = require('./deduplicator');
const FileOrganizer = require('./file-organizer');
const TransactionManager = require('./transaction-manager');

class FileWatcher {
  constructor(inboxPath, options = {}) {
    this.inboxPath = inboxPath;
    this.options = {
      persistent: true,
      ignoreInitial: false,
      ...options,
    };

    this.pdfParser = new PDFParser();
    this.excelParser = new ExcelParser();
    this.csvParser = new CSVParser();
    this.deduplicator = new Deduplicator();
    this.fileOrganizer = new FileOrganizer();
    this.transactionManager = new TransactionManager();

    this.watcher = null;
    this.processing = new Set(); // Для предотвращения двойной обработки
  }

  /**
   * Запуск мониторинга
   */
  start() {
    logger.info(`Starting file watcher for: ${this.inboxPath}`);

    this.watcher = chokidar.watch(this.inboxPath, this.options);

    this.watcher
      .on('add', (filePath) => this.handleFileAdded(filePath))
      .on('change', (filePath) => this.handleFileChanged(filePath))
      .on('error', (error) => logger.error('Watcher error:', error))
      .on('ready', () => logger.info('File watcher ready'));

    return this;
  }

  /**
   * Остановка мониторинга
   */
  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      logger.info('File watcher stopped');
    }
  }

  /**
   * Обработка нового файла
   */
  async handleFileAdded(filePath) {
    if (this.processing.has(filePath)) {
      return;
    }

    this.processing.add(filePath);

    try {
      const ext = path.extname(filePath).toLowerCase();

      // Поддерживаемые форматы
      if (!['.pdf', '.xlsx', '.xls', '.csv'].includes(ext)) {
        logger.info(`Skipping unsupported file: ${filePath}`);
        return;
      }

      logger.info(`New file detected: ${filePath}`);

      // Шаг 1: Проверка на дубликат
      const isDuplicate = await this.deduplicator.checkDuplicate(filePath);
      if (isDuplicate) {
        logger.info(`Duplicate file detected: ${filePath}`);
        await this.deduplicator.handleDuplicate(filePath);
        return;
      }

      // Шаг 2: Парсинг файла
      const documentData = await this.parseFile(filePath);
      if (!documentData) {
        logger.warn(`Could not parse file: ${filePath}`);
        return;
      }

      // Шаг 3: Организация файла (перемещение в папку по году/кварталу)
      const organizedPath = await this.fileOrganizer.organizeFile(filePath, documentData);
      logger.info(`File organized: ${filePath} -> ${organizedPath}`);

      // Шаг 4: Извлечение и сохранение транзакций
      await this.transactionManager.processDocument(documentData, organizedPath);

      logger.info(`Successfully processed file: ${filePath}`);
    } catch (error) {
      logger.error(`Error processing file ${filePath}:`, error);
    } finally {
      this.processing.delete(filePath);
    }
  }

  /**
   * Обработка изменения файла
   */
  async handleFileChanged(filePath) {
    logger.info(`File changed: ${filePath}`);
    // Можно добавить логику переобработки
  }

  /**
   * Парсинг файла в зависимости от типа
   */
  async parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    try {
      switch (ext) {
        case '.pdf':
          return await this.parsePDFFile(filePath);

        case '.xlsx':
        case '.xls':
          return await this.parseExcelFile(filePath);

        case '.csv':
          return await this.parseCSVFile(filePath);

        default:
          logger.warn(`Unsupported file type: ${ext}`);
          return null;
      }
    } catch (error) {
      logger.error(`Error parsing file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Парсинг PDF
   */
  async parsePDFFile(filePath) {
    const docType = await this.pdfParser.detectDocumentType(filePath);

    switch (docType) {
      case 'invoice':
        return await this.pdfParser.extractInvoiceData(filePath);

      case 'bank_statement':
        return await this.pdfParser.extractBankStatementData(filePath);

      case 'receipt':
        // Можно добавить парсинг квитанций
        return {
          type: 'receipt',
          sourceFile: filePath,
          parsedAt: new Date().toISOString(),
        };

      default:
        logger.warn(`Unknown PDF document type: ${filePath}`);
        return null;
    }
  }

  /**
   * Парсинг Excel
   */
  async parseExcelFile(filePath) {
    const docType = this.excelParser.detectDocumentType(filePath);

    switch (docType) {
      case 'invoice':
        return this.excelParser.extractInvoiceData(filePath);

      case 'bank_statement':
        return this.excelParser.extractBankStatementData(filePath);

      default:
        logger.warn(`Unknown Excel document type: ${filePath}`);
        return null;
    }
  }

  /**
   * Парсинг CSV
   */
  async parseCSVFile(filePath) {
    const docType = await this.csvParser.detectFileType(filePath);

    switch (docType) {
      case 'bank_statement':
        return await this.csvParser.extractBankStatementData(filePath);

      case 'stripe_export':
        return await this.csvParser.extractStripeExportData(filePath);

      default:
        logger.warn(`Unknown CSV file type: ${filePath}`);
        return null;
    }
  }

  /**
   * Ручная обработка файла (для переобработки)
   */
  async processFileManually(filePath) {
    return await this.handleFileAdded(filePath);
  }
}

module.exports = FileWatcher;
