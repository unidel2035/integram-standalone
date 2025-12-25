// file-organizer.js - Организация файлов по годам и кварталам

const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');

class FileOrganizer {
  constructor(documentsBasePath) {
    this.documentsBasePath = documentsBasePath || './documents';
  }

  /**
   * Организовать файл (переместить в папку по году/кварталу)
   */
  async organizeFile(filePath, documentData) {
    try {
      // Определить дату документа
      const date = this.getDocumentDate(documentData);
      if (!date) {
        logger.warn(`Could not determine date for ${filePath}, using current date`);
        date = new Date();
      }

      // Определить год и квартал
      const year = date.getFullYear();
      const quarter = this.getQuarter(date);

      // Определить тип документа для подпапки
      const docType = documentData.type || 'other';

      // Создать структуру папок: /documents/2025/Q1/invoices/
      const targetDir = path.join(
        this.documentsBasePath,
        year.toString(),
        `Q${quarter}`,
        docType + 's' // invoices, receipts, statements и т.д.
      );

      // Создать папку если не существует
      await fs.mkdir(targetDir, { recursive: true });

      // Определить имя файла
      const newFileName = this.generateFileName(documentData, filePath);
      const targetPath = path.join(targetDir, newFileName);

      // Проверить существует ли файл
      let finalPath = targetPath;
      try {
        await fs.access(targetPath);
        // Файл существует, добавить timestamp
        const ext = path.extname(newFileName);
        const baseName = path.basename(newFileName, ext);
        const timestamp = Date.now();
        finalPath = path.join(targetDir, `${baseName}_${timestamp}${ext}`);
      } catch (err) {
        // Файл не существует, можно использовать оригинальное имя
      }

      // Переместить файл
      await fs.rename(filePath, finalPath);

      logger.info(`File organized: ${filePath} -> ${finalPath}`);

      return finalPath;
    } catch (error) {
      logger.error(`Error organizing file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Получить дату документа
   */
  getDocumentDate(documentData) {
    if (documentData.date) {
      return new Date(documentData.date);
    }

    if (documentData.periodEnd) {
      return new Date(documentData.periodEnd);
    }

    if (documentData.periodStart) {
      return new Date(documentData.periodStart);
    }

    return null;
  }

  /**
   * Определить квартал
   */
  getQuarter(date) {
    const month = date.getMonth() + 1; // 1-12
    return Math.ceil(month / 3);
  }

  /**
   * Сгенерировать имя файла
   */
  generateFileName(documentData, originalPath) {
    const ext = path.extname(originalPath);
    const parts = [];

    // Добавить дату
    if (documentData.date) {
      parts.push(documentData.date.replace(/\//g, '-'));
    }

    // Добавить тип
    if (documentData.type) {
      parts.push(documentData.type);
    }

    // Добавить номер инвойса/документа
    if (documentData.invoiceNumber) {
      parts.push(`INV${documentData.invoiceNumber}`);
    }

    // Добавить сумму
    if (documentData.amount) {
      const amount = Math.round(documentData.amount * 100) / 100;
      const currency = documentData.currency || '';
      parts.push(`${amount}${currency}`);
    }

    // Если нет частей, использовать оригинальное имя
    if (parts.length === 0) {
      return path.basename(originalPath);
    }

    return parts.join('_') + ext;
  }

  /**
   * Получить структуру директорий
   */
  async getDirectoryStructure() {
    const structure = {
      basePath: this.documentsBasePath,
      years: {},
    };

    try {
      const years = await fs.readdir(this.documentsBasePath);

      for (const year of years) {
        const yearPath = path.join(this.documentsBasePath, year);
        const stats = await fs.stat(yearPath);

        if (stats.isDirectory() && /^\d{4}$/.test(year)) {
          structure.years[year] = {
            quarters: {},
          };

          const quarters = await fs.readdir(yearPath);

          for (const quarter of quarters) {
            const quarterPath = path.join(yearPath, quarter);
            const qStats = await fs.stat(quarterPath);

            if (qStats.isDirectory() && /^Q[1-4]$/.test(quarter)) {
              const types = await fs.readdir(quarterPath);
              structure.years[year].quarters[quarter] = types;
            }
          }
        }
      }

      return structure;
    } catch (error) {
      logger.error('Error getting directory structure:', error);
      return structure;
    }
  }

  /**
   * Статистика по организованным файлам
   */
  async getOrganizationStats() {
    const stats = {
      totalFiles: 0,
      byYear: {},
      byQuarter: {},
      byType: {},
    };

    try {
      const structure = await this.getDirectoryStructure();

      for (const [year, yearData] of Object.entries(structure.years)) {
        stats.byYear[year] = 0;

        for (const [quarter, types] of Object.entries(yearData.quarters)) {
          const quarterKey = `${year}-${quarter}`;
          stats.byQuarter[quarterKey] = 0;

          for (const type of types) {
            const typePath = path.join(
              this.documentsBasePath,
              year,
              quarter,
              type
            );

            const files = await fs.readdir(typePath);
            const fileCount = files.length;

            stats.totalFiles += fileCount;
            stats.byYear[year] += fileCount;
            stats.byQuarter[quarterKey] += fileCount;

            if (!stats.byType[type]) {
              stats.byType[type] = 0;
            }
            stats.byType[type] += fileCount;
          }
        }
      }

      return stats;
    } catch (error) {
      logger.error('Error getting organization stats:', error);
      return stats;
    }
  }
}

module.exports = FileOrganizer;
