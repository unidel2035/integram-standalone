// deduplicator.js - Дедупликация файлов (обнаружение дубликатов документов)

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');

class Deduplicator {
  constructor() {
    this.hashCache = new Map(); // Кеш хешей файлов
    this.duplicatesDir = null;
  }

  /**
   * Установить директорию для дубликатов
   */
  setDuplicatesDirectory(dir) {
    this.duplicatesDir = dir;
  }

  /**
   * Вычислить хеш файла
   */
  async calculateFileHash(filePath) {
    try {
      const content = await fs.readFile(filePath);
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      return hash;
    } catch (error) {
      logger.error(`Error calculating hash for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Вычислить метаданные файла для дополнительной проверки
   */
  async getFileMetadata(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
      };
    } catch (error) {
      logger.error(`Error getting metadata for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Проверить является ли файл дубликатом
   */
  async checkDuplicate(filePath) {
    try {
      const hash = await this.calculateFileHash(filePath);

      // Проверить в кеше
      if (this.hashCache.has(hash)) {
        const existingFile = this.hashCache.get(hash);
        logger.info(`Duplicate found: ${filePath} matches ${existingFile}`);
        return { isDuplicate: true, originalFile: existingFile, hash };
      }

      // Проверить в базе данных (если используется)
      // TODO: Добавить проверку в БД
      // const dbResult = await this.checkDuplicateInDatabase(hash);
      // if (dbResult) return dbResult;

      // Сохранить хеш в кеше
      this.hashCache.set(hash, filePath);

      return { isDuplicate: false, hash };
    } catch (error) {
      logger.error(`Error checking duplicate for ${filePath}:`, error);
      return { isDuplicate: false, error: error.message };
    }
  }

  /**
   * Обработать дубликат
   */
  async handleDuplicate(filePath) {
    try {
      const fileName = path.basename(filePath);

      // Если настроена папка для дубликатов
      if (this.duplicatesDir) {
        // Убедиться что папка существует
        await fs.mkdir(this.duplicatesDir, { recursive: true });

        // Переместить файл в папку дубликатов
        const duplicatePath = path.join(this.duplicatesDir, fileName);

        // Если файл с таким именем уже существует, добавить timestamp
        let finalPath = duplicatePath;
        try {
          await fs.access(duplicatePath);
          const ext = path.extname(fileName);
          const baseName = path.basename(fileName, ext);
          const timestamp = Date.now();
          finalPath = path.join(
            this.duplicatesDir,
            `${baseName}_${timestamp}${ext}`
          );
        } catch (err) {
          // Файл не существует, можно использовать оригинальное имя
        }

        await fs.rename(filePath, finalPath);
        logger.info(`Duplicate moved to: ${finalPath}`);

        return { moved: true, newPath: finalPath };
      } else {
        // Просто удалить дубликат
        await fs.unlink(filePath);
        logger.info(`Duplicate deleted: ${filePath}`);

        return { deleted: true };
      }
    } catch (error) {
      logger.error(`Error handling duplicate ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Найти дубликаты в директории
   */
  async findDuplicatesInDirectory(directory) {
    try {
      const files = await fs.readdir(directory);
      const hashGroups = new Map(); // hash -> [files]

      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          const hash = await this.calculateFileHash(filePath);

          if (!hashGroups.has(hash)) {
            hashGroups.set(hash, []);
          }

          hashGroups.get(hash).push({
            path: filePath,
            size: stats.size,
            modified: stats.mtime,
          });
        }
      }

      // Найти группы с дубликатами
      const duplicates = [];
      for (const [hash, files] of hashGroups.entries()) {
        if (files.length > 1) {
          duplicates.push({
            hash,
            count: files.length,
            files,
          });
        }
      }

      logger.info(`Found ${duplicates.length} groups of duplicates in ${directory}`);

      return duplicates;
    } catch (error) {
      logger.error(`Error finding duplicates in ${directory}:`, error);
      throw error;
    }
  }

  /**
   * Очистить кеш хешей
   */
  clearCache() {
    this.hashCache.clear();
    logger.info('Hash cache cleared');
  }

  /**
   * Получить статистику кеша
   */
  getCacheStats() {
    return {
      size: this.hashCache.size,
      entries: Array.from(this.hashCache.entries()).map(([hash, file]) => ({
        hash: hash.substring(0, 8) + '...',
        file,
      })),
    };
  }

  /**
   * Интеллектуальная дедупликация с анализом содержимого
   */
  async smartDuplicateCheck(filePath, documentData) {
    // Проверка по хешу
    const hashCheck = await this.checkDuplicate(filePath);
    if (hashCheck.isDuplicate) {
      return hashCheck;
    }

    // Дополнительная проверка по содержимому документа
    if (documentData) {
      // Проверить по номеру инвойса
      if (documentData.invoiceNumber) {
        // TODO: Проверить в БД по номеру инвойса
        logger.debug(`Checking for duplicate invoice: ${documentData.invoiceNumber}`);
      }

      // Проверить по дате и сумме
      if (documentData.date && documentData.amount) {
        // TODO: Проверить в БД по дате и сумме
        logger.debug(`Checking for duplicate by date/amount: ${documentData.date} / ${documentData.amount}`);
      }
    }

    return { isDuplicate: false };
  }
}

module.exports = Deduplicator;
