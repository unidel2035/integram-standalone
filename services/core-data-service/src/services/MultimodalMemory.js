/**
 * MultimodalMemory — мультимодальная память Integram
 *
 * Поддержка не-текстовых данных в памяти:
 *   - Изображения (CLIP-эмбеддинги, превью, метаданные)
 *   - Телеметрия дронов (координаты, скорость, батарея, сенсоры)
 *   - Аудио (запись, транскрипт, метаданные)
 *   - Код (сниппеты, файлы, диапазоны строк)
 *
 * Всё хранится как JSON_DATA (t=51) дочерние объекты с полем modality.
 * Эмбеддинги хранятся как EMBEDDING (t=54) дочерние объекты.
 *
 * «Память — не только слова. Дрон помнит маршрут, камера — кадр, микрофон — голос.»
 */

const EMBEDDING_TYPE = 54;
const JSON_DATA_TYPE = 51;

export class MultimodalMemory {
  /**
   * @param {Object} params
   * @param {Object} params.databaseService — сервис доступа к БД (execSql)
   * @param {Object} params.vectorService — VectorService для эмбеддингов
   * @param {Object} [params.options] — доп. настройки
   * @param {Object} [params.options.logger] — логгер
   * @param {Object} [params.options.embeddingService] — сервис генерации эмбеддингов (для текстовых описаний)
   */
  constructor({ databaseService, vectorService, options = {} }) {
    this.db = databaseService;
    this.vector = vectorService;
    this.logger = options.logger || console;
    this.embedding = options.embeddingService || null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // storeImage — сохранить изображение (ссылку + CLIP-эмбеддинг)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Сохранить ссылку на изображение и опциональный CLIP-эмбеддинг.
   *
   * @param {string} database — имя базы Integram
   * @param {number} parentId — ID родительского объекта
   * @param {Object} imageData — данные изображения
   * @param {string} [imageData.url] — URL изображения
   * @param {string} [imageData.base64thumbnail] — превью в base64
   * @param {number} [imageData.width] — ширина в пикселях
   * @param {number} [imageData.height] — высота в пикселях
   * @param {string} [imageData.format] — формат (png, jpg, webp)
   * @param {Object} [meta] — метаданные
   * @param {number[]} [meta.embedding] — CLIP-вектор изображения
   * @param {string} [meta.description] — текстовое описание
   * @returns {Promise<{id: number, parentId: number, modality: string}>}
   */
  async storeImage(database, parentId, imageData, meta = {}) {
    try {
      const payload = {
        modality: 'image',
        url: imageData.url || null,
        base64thumbnail: imageData.base64thumbnail || null,
        width: imageData.width || null,
        height: imageData.height || null,
        format: imageData.format || null,
        description: meta.description || null,
        storedAt: new Date().toISOString(),
      };

      // Сохраняем как JSON_DATA дочерний объект
      const objectId = await this._storeJsonData(database, parentId, payload, 'MultimodalMemory.storeImage');

      // Если есть CLIP-эмбеддинг — сохраняем как EMBEDDING дочерний
      if (meta.embedding && Array.isArray(meta.embedding) && meta.embedding.length > 0) {
        await this.vector.addVector(database, objectId, meta.embedding, {
          model: meta.embeddingModel || 'clip',
          modality: 'image',
        });
      }

      this.logger.info(`[MultimodalMemory] Image stored: id=${objectId}, parent=${parentId}, format=${imageData.format || 'unknown'}`);
      return { id: objectId, parentId, modality: 'image' };
    } catch (error) {
      this.logger.error(`[MultimodalMemory] storeImage failed: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // storeTelemetry — сохранить телеметрию дрона
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Сохранить телеметрию дрона. Автоматически генерирует текстовое описание
   * для семантического поиска.
   *
   * @param {string} database — имя базы Integram
   * @param {number} parentId — ID родительского объекта (дрон, миссия)
   * @param {Object} telemetry — данные телеметрии
   * @param {number} [telemetry.lat] — широта
   * @param {number} [telemetry.lon] — долгота
   * @param {number} [telemetry.alt] — высота (м)
   * @param {number} [telemetry.speed] — скорость (км/ч)
   * @param {number} [telemetry.heading] — курс (градусы)
   * @param {number} [telemetry.battery] — заряд батареи (%)
   * @param {string} [telemetry.timestamp] — ISO время замера
   * @param {Object} [telemetry.sensorData] — данные сенсоров (произвольный объект)
   * @param {Object} [meta] — метаданные
   * @param {number[]} [meta.embedding] — предвычисленный эмбеддинг
   * @returns {Promise<{id: number, parentId: number, modality: string}>}
   */
  async storeTelemetry(database, parentId, telemetry, meta = {}) {
    try {
      const payload = {
        modality: 'telemetry',
        lat: telemetry.lat ?? null,
        lon: telemetry.lon ?? null,
        alt: telemetry.alt ?? null,
        speed: telemetry.speed ?? null,
        heading: telemetry.heading ?? null,
        battery: telemetry.battery ?? null,
        timestamp: telemetry.timestamp || new Date().toISOString(),
        sensorData: telemetry.sensorData || null,
        storedAt: new Date().toISOString(),
      };

      // Сохраняем как JSON_DATA дочерний объект
      const objectId = await this._storeJsonData(database, parentId, payload, 'MultimodalMemory.storeTelemetry');

      // Генерируем текстовое описание для эмбеддинга
      const summary = this._buildTelemetrySummary(telemetry);
      await this._embedText(database, objectId, summary, meta, 'telemetry');

      this.logger.info(`[MultimodalMemory] Telemetry stored: id=${objectId}, parent=${parentId}, alt=${telemetry.alt}m`);
      return { id: objectId, parentId, modality: 'telemetry' };
    } catch (error) {
      this.logger.error(`[MultimodalMemory] storeTelemetry failed: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // storeAudio — сохранить аудиозапись
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Сохранить ссылку на аудиозапись. Использует транскрипт для эмбеддинга.
   *
   * @param {string} database — имя базы Integram
   * @param {number} parentId — ID родительского объекта
   * @param {Object} audioData — данные аудио
   * @param {string} [audioData.url] — URL аудиофайла
   * @param {number} [audioData.duration] — длительность (сек)
   * @param {number} [audioData.sampleRate] — частота дискретизации (Гц)
   * @param {string} [audioData.format] — формат (mp3, wav, ogg)
   * @param {string} [audioData.transcript] — текстовая расшифровка
   * @param {Object} [meta] — метаданные
   * @param {number[]} [meta.embedding] — предвычисленный эмбеддинг
   * @returns {Promise<{id: number, parentId: number, modality: string}>}
   */
  async storeAudio(database, parentId, audioData, meta = {}) {
    try {
      const payload = {
        modality: 'audio',
        url: audioData.url || null,
        duration: audioData.duration ?? null,
        sampleRate: audioData.sampleRate ?? null,
        format: audioData.format || null,
        transcript: audioData.transcript || null,
        storedAt: new Date().toISOString(),
      };

      // Сохраняем как JSON_DATA дочерний объект
      const objectId = await this._storeJsonData(database, parentId, payload, 'MultimodalMemory.storeAudio');

      // Используем транскрипт для эмбеддинга
      if (audioData.transcript) {
        await this._embedText(database, objectId, audioData.transcript, meta, 'audio');
      }

      this.logger.info(`[MultimodalMemory] Audio stored: id=${objectId}, parent=${parentId}, duration=${audioData.duration || '?'}s`);
      return { id: objectId, parentId, modality: 'audio' };
    } catch (error) {
      this.logger.error(`[MultimodalMemory] storeAudio failed: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // storeCode — сохранить сниппет кода
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Сохранить сниппет кода. Использует содержимое кода для эмбеддинга.
   *
   * @param {string} database — имя базы Integram
   * @param {number} parentId — ID родительского объекта
   * @param {Object} code — данные кода
   * @param {string} [code.language] — язык программирования
   * @param {string} code.content — содержимое кода
   * @param {string} [code.filename] — имя файла
   * @param {string} [code.lineRange] — диапазон строк (напр. "10-42")
   * @param {Object} [meta] — метаданные
   * @param {number[]} [meta.embedding] — предвычисленный эмбеддинг
   * @returns {Promise<{id: number, parentId: number, modality: string}>}
   */
  async storeCode(database, parentId, code, meta = {}) {
    try {
      if (!code.content) {
        throw new Error('Code content is required');
      }

      const payload = {
        modality: 'code',
        language: code.language || null,
        content: code.content,
        filename: code.filename || null,
        lineRange: code.lineRange || null,
        storedAt: new Date().toISOString(),
      };

      // Сохраняем как JSON_DATA дочерний объект
      const objectId = await this._storeJsonData(database, parentId, payload, 'MultimodalMemory.storeCode');

      // Используем код для эмбеддинга (обрезаем до 2000 символов)
      const textForEmbed = code.content.substring(0, 2000);
      await this._embedText(database, objectId, textForEmbed, meta, 'code');

      this.logger.info(`[MultimodalMemory] Code stored: id=${objectId}, parent=${parentId}, lang=${code.language || 'unknown'}`);
      return { id: objectId, parentId, modality: 'code' };
    } catch (error) {
      this.logger.error(`[MultimodalMemory] storeCode failed: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // searchByModality — поиск по конкретной модальности
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Поиск объектов определённой модальности по текстовому запросу.
   * Фильтрует JSON_DATA объекты, содержащие указанную модальность.
   *
   * @param {string} database — имя базы Integram
   * @param {string} modality — тип модальности: image|telemetry|audio|code
   * @param {string} query — текстовый запрос для поиска
   * @param {number} [limit=20] — максимальное количество результатов
   * @returns {Promise<{results: Object[], total: number, modality: string}>}
   */
  async searchByModality(database, modality, query, limit = 20) {
    try {
      const validModalities = ['image', 'telemetry', 'audio', 'code'];
      if (!validModalities.includes(modality)) {
        throw new Error(`Invalid modality: ${modality}. Must be one of: ${validModalities.join(', ')}`);
      }

      // Текстовый поиск по JSON_DATA объектам с фильтрацией по модальности
      const modalityFilter = `"modality":"${modality}"`;
      const sql = `
        SELECT id, up, val
        FROM \`${database}\`
        WHERE t = ?
          AND val LIKE ?
          AND val LIKE ?
        ORDER BY id DESC
        LIMIT ?
      `;
      const params = [
        JSON_DATA_TYPE,
        `%${modalityFilter}%`,
        query ? `%${this._escapelike(query)}%` : '%',
        limit,
      ];

      const result = await this.db.execSql(sql, params, 'MultimodalMemory.searchByModality');
      const rows = result.rows || [];

      const results = rows.map(row => {
        try {
          const data = JSON.parse(row.val);
          return { id: row.id, parentId: row.up, ...data };
        } catch {
          return { id: row.id, parentId: row.up, raw: row.val };
        }
      });

      return { results, total: results.length, modality };
    } catch (error) {
      this.logger.error(`[MultimodalMemory] searchByModality failed: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // getModalities — получить все модальности объекта
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Получить все мультимодальные вложения для указанного объекта.
   *
   * @param {string} database — имя базы Integram
   * @param {number} objectId — ID объекта
   * @returns {Promise<{images: Object[], telemetry: Object[], audio: Object[], code: Object[]}>}
   */
  async getModalities(database, objectId) {
    try {
      const sql = `
        SELECT id, up, val
        FROM \`${database}\`
        WHERE up = ? AND t = ?
        ORDER BY id ASC
      `;

      const result = await this.db.execSql(sql, [objectId, JSON_DATA_TYPE], 'MultimodalMemory.getModalities');
      const rows = result.rows || [];

      const grouped = {
        images: [],
        telemetry: [],
        audio: [],
        code: [],
      };

      for (const row of rows) {
        try {
          const data = JSON.parse(row.val);
          if (!data.modality) continue;

          const entry = { id: row.id, parentId: row.up, ...data };

          switch (data.modality) {
            case 'image':
              grouped.images.push(entry);
              break;
            case 'telemetry':
              grouped.telemetry.push(entry);
              break;
            case 'audio':
              grouped.audio.push(entry);
              break;
            case 'code':
              grouped.code.push(entry);
              break;
            // Неизвестные модальности игнорируем
          }
        } catch {
          // Невалидный JSON — пропускаем
        }
      }

      return grouped;
    } catch (error) {
      this.logger.error(`[MultimodalMemory] getModalities failed: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Приватные методы
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Сохранить JSON-данные как дочерний объект типа JSON_DATA (t=51).
   *
   * @param {string} database
   * @param {number} parentId
   * @param {Object} payload — данные для сериализации
   * @param {string} label — метка для логирования SQL
   * @returns {Promise<number>} — ID созданного объекта
   * @private
   */
  async _storeJsonData(database, parentId, payload, label) {
    const val = JSON.stringify(payload);
    const sql = `INSERT INTO \`${database}\` (up, ord, t, val) VALUES (?, 0, ?, ?)`;
    const result = await this.db.execSql(sql, [parentId, JSON_DATA_TYPE, val], label);
    return result.insertId;
  }

  /**
   * Создать эмбеддинг из текста и сохранить как EMBEDDING дочерний объект.
   * Если есть предвычисленный эмбеддинг в meta.embedding — используем его.
   * Иначе пытаемся сгенерировать через embeddingService.
   *
   * @param {string} database
   * @param {number} parentId — ID объекта, к которому привязан эмбеддинг
   * @param {string} text — текст для эмбеддинга
   * @param {Object} meta — метаданные (может содержать .embedding)
   * @param {string} modality — тип модальности (для мета-информации)
   * @private
   */
  async _embedText(database, parentId, text, meta, modality) {
    try {
      // Предвычисленный эмбеддинг
      if (meta.embedding && Array.isArray(meta.embedding) && meta.embedding.length > 0) {
        await this.vector.addVector(database, parentId, meta.embedding, {
          model: meta.embeddingModel || 'precomputed',
          modality,
        });
        return;
      }

      // Генерация через embeddingService (если доступен)
      if (this.embedding && text) {
        const emb = await this.embedding.embed(text.substring(0, 2000));
        if (emb && emb.length > 0) {
          await this.vector.addVector(database, parentId, Array.from(emb), {
            model: this.embedding.config?.model || 'auto',
            modality,
          });
        }
      }
    } catch (error) {
      // Ошибка эмбеддинга не должна блокировать сохранение данных
      this.logger.warn(`[MultimodalMemory] Embed failed for ${modality}: ${error.message}`);
    }
  }

  /**
   * Построить текстовое описание телеметрии для семантического поиска.
   *
   * @param {Object} telemetry
   * @returns {string}
   * @private
   */
  _buildTelemetrySummary(telemetry) {
    const parts = [];

    if (telemetry.alt != null) {
      parts.push(`Дрон на высоте ${telemetry.alt}м`);
    }
    if (telemetry.speed != null) {
      parts.push(`скорость ${telemetry.speed}км/ч`);
    }
    if (telemetry.battery != null) {
      parts.push(`батарея ${telemetry.battery}%`);
    }
    if (telemetry.heading != null) {
      parts.push(`курс ${telemetry.heading}°`);
    }
    if (telemetry.lat != null && telemetry.lon != null) {
      parts.push(`координаты ${telemetry.lat},${telemetry.lon}`);
    }

    return parts.length > 0
      ? parts.join(', ')
      : 'Телеметрия дрона без указанных параметров';
  }

  /**
   * Экранировать спецсимволы SQL LIKE.
   *
   * @param {string} str
   * @returns {string}
   * @private
   */
  _escapelike(str) {
    if (!str) return '';
    return str.replace(/[%_\\]/g, '\\$&');
  }
}

export default MultimodalMemory;
