/**
 * SemanticField — Контекстуальное семантическое поле агента
 *
 * Каждый ИИ-агент окружён персонализированным «пузырём» релевантного контекста,
 * подобно периферийному зрению. Поле вычисляется на основе:
 *   - Текущей задачи агента (фокус)
 *   - Долгосрочных интересов агента (периферия)
 *   - Графа связей Integram (горизонт)
 *
 * Архитектура:
 *   Профиль агента → объект t=51 (JSON_DATA) в Integram
 *   Вектора внимания → EMBEDDING (t=54) привязанные к профилю
 *   Связи → LINK (t=52) для графового обхода
 *   Внимание → таблица attention_ в val профиля
 *
 * Три зоны поля:
 *   Focus     (центр)    — объекты, прямо связанные с текущей задачей (cosine > 0.85)
 *   Peripheral (периферия) — объекты, связанные с интересами агента (cosine > 0.6)
 *   Horizon   (горизонт)  — объекты, связанные с focus/peripheral через граф (depth=1)
 *
 * «Семантическое поле = периферийное зрение агента»
 */

const EMBEDDING_TYPE = 54;
const LINK_TYPE = 52;
const AGENT_PROFILE_TYPE = 51;

/**
 * Вычисляет cosine similarity двух векторов
 * @param {Float32Array|number[]} a
 * @param {Float32Array|number[]} b
 * @returns {number} значение от 0 до 1
 */
function cosine(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    nA += a[i] * a[i];
    nB += b[i] * b[i];
  }
  const d = Math.sqrt(nA) * Math.sqrt(nB);
  return d === 0 ? 0 : dot / d;
}

export class SemanticField {
  /**
   * @param {Object} params
   * @param {Object} params.vectorService — VectorService для работы с эмбеддингами
   * @param {Object} params.linkService — LinkService для графовых связей
   * @param {Object} params.databaseService — DatabaseService для SQL-запросов
   * @param {Object} [params.options] — дополнительные настройки
   * @param {Object} [params.options.logger] — логгер
   * @param {Object} [params.options.embeddingService] — сервис генерации эмбеддингов
   * @param {number} [params.options.focusThreshold] — порог cosine для фокуса (по умолчанию 0.85)
   * @param {number} [params.options.peripheralThreshold] — порог cosine для периферии (по умолчанию 0.6)
   * @param {number} [params.options.focusLimit] — максимум объектов в фокусе (по умолчанию 10)
   * @param {number} [params.options.peripheralLimit] — максимум объектов в периферии (по умолчанию 20)
   * @param {number} [params.options.horizonLimit] — максимум объектов на горизонте (по умолчанию 30)
   * @param {number} [params.options.attentionPromoteThreshold] — порог внимания для повышения в фокус (по умолчанию 5)
   * @param {number} [params.options.attentionFadeTTL] — время в мс до угасания без внимания (по умолчанию 24ч)
   */
  constructor({ vectorService, linkService, databaseService, options = {} }) {
    this.vector = vectorService;
    this.links = linkService;
    this.db = databaseService;
    this.logger = options.logger || console;
    this.embedding = options.embeddingService || null;

    // Пороги зон поля
    this.focusThreshold = options.focusThreshold || 0.85;
    this.peripheralThreshold = options.peripheralThreshold || 0.6;

    // Лимиты зон
    this.focusLimit = options.focusLimit || 10;
    this.peripheralLimit = options.peripheralLimit || 20;
    this.horizonLimit = options.horizonLimit || 30;

    // Параметры внимания
    this.attentionPromoteThreshold = options.attentionPromoteThreshold || 5;
    this.attentionFadeTTL = options.attentionFadeTTL || 24 * 60 * 60 * 1000; // 24 часа

    // Кэш вычисленных полей: agentId → { focus, peripheral, horizon, computedAt }
    this._fieldCache = new Map();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Регистрация агента
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Зарегистрировать агента в семантическом поле
   *
   * Создаёт профиль агента как JSON_DATA объект (t=51) в Integram,
   * генерирует эмбеддинги для каждого интереса агента («вектора внимания»).
   *
   * @param {string} database — имя базы данных Integram
   * @param {string} agentId — уникальный идентификатор агента
   * @param {Object} profile — профиль агента
   * @param {string} profile.name — имя агента
   * @param {string} profile.role — роль (architect, developer, analyst, etc.)
   * @param {string[]} profile.capabilities — способности агента
   * @param {string} profile.currentTask — текстовое описание текущей задачи
   * @param {string[]} profile.interests — текстовые описания интересов агента
   * @returns {Promise<{agentId, profileId, interestVectors}>} — результат регистрации
   */
  async registerAgent(database, agentId, profile) {
    const db = this._validateDb(database);
    const { name, role, capabilities = [], currentTask = '', interests = [] } = profile;

    // Проверяем, нет ли уже профиля этого агента
    const existing = await this._findAgentProfile(db, agentId);
    if (existing) {
      // Обновляем существующий профиль
      return this._updateAgentProfile(db, existing.id, agentId, profile);
    }

    // Создаём JSON профиля
    const profileData = JSON.stringify({
      agentId,
      name,
      role,
      capabilities,
      currentTask,
      interests,
      attention: {},       // objectId → { count, lastAccessed }
      notifications: [],   // ожидающие уведомления
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Сохраняем как объект t=51 (JSON_DATA) в Integram
    const sql = `INSERT INTO \`${db}\` (up, ord, t, val) VALUES (0, 0, ?, ?)`;
    const result = await this.db.execSql(sql, [AGENT_PROFILE_TYPE, profileData], 'SemanticField.register');
    const profileId = result.insertId;

    // Генерируем эмбеддинги для интересов агента
    const interestVectors = [];
    if (this.embedding && interests.length > 0) {
      for (const interest of interests) {
        try {
          const vec = await this.embedding.embed(interest.substring(0, 2000));
          if (vec && vec.length > 0) {
            const stored = await this.vector.addVector(db, profileId, Array.from(vec), {
              model: this.embedding.config?.model,
              kind: 'interest',
              text: interest,
            });
            interestVectors.push({ id: stored.id, text: interest });
          }
        } catch (e) {
          this.logger.warn(`[SemanticField] Ошибка эмбеддинга интереса «${interest}»: ${e.message}`);
        }
      }
    }

    // Генерируем эмбеддинг текущей задачи
    if (this.embedding && currentTask) {
      try {
        const taskVec = await this.embedding.embed(currentTask.substring(0, 2000));
        if (taskVec && taskVec.length > 0) {
          await this.vector.addVector(db, profileId, Array.from(taskVec), {
            model: this.embedding.config?.model,
            kind: 'task',
            text: currentTask,
          });
        }
      } catch (e) {
        this.logger.warn(`[SemanticField] Ошибка эмбеддинга задачи: ${e.message}`);
      }
    }

    this.logger.info(`[SemanticField] Агент «${name}» (${agentId}) зарегистрирован, profileId=${profileId}, интересов=${interestVectors.length}`);

    return { agentId, profileId, interestVectors };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Вычисление семантического поля
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Вычислить семантическое поле агента
   *
   * Поле состоит из трёх зон:
   *   - Focus: объекты с cosine > 0.85 к текущей задаче
   *   - Peripheral: объекты с cosine > 0.6 к интересам агента
   *   - Horizon: объекты, связанные графом с focus/peripheral (глубина 1)
   *
   * @param {string} database — имя базы данных
   * @param {string} agentId — идентификатор агента
   * @param {Object} [options] — настройки вычисления
   * @param {boolean} [options.useCache=true] — использовать кэш (TTL 60 сек)
   * @param {number} [options.focusThreshold] — переопределить порог фокуса
   * @param {number} [options.peripheralThreshold] — переопределить порог периферии
   * @returns {Promise<{focus, peripheral, horizon, agentId, computedAt}>}
   */
  async getField(database, agentId, options = {}) {
    const db = this._validateDb(database);
    const useCache = options.useCache !== false;
    const cacheTTL = 60_000; // 60 секунд

    // Проверяем кэш
    if (useCache) {
      const cached = this._fieldCache.get(`${db}:${agentId}`);
      if (cached && (Date.now() - cached.computedAt < cacheTTL)) {
        return cached;
      }
    }

    // Загружаем профиль агента
    const profile = await this._findAgentProfile(db, agentId);
    if (!profile) {
      throw new Error(`Агент «${agentId}» не зарегистрирован. Вызовите registerAgent() сначала.`);
    }

    // Инициализируем VectorService для этой БД
    await this.vector.initialize(database);

    const focusThreshold = options.focusThreshold || this.focusThreshold;
    const peripheralThreshold = options.peripheralThreshold || this.peripheralThreshold;

    // ── Focus: объекты, близкие к текущей задаче ──
    const focus = await this._computeFocusZone(db, profile, focusThreshold);

    // ── Peripheral: объекты, близкие к интересам агента ──
    const peripheral = await this._computePeripheralZone(db, profile, peripheralThreshold, focus);

    // ── Horizon: объекты, связанные графом с focus + peripheral ──
    const horizon = await this._computeHorizonZone(db, focus, peripheral);

    const field = {
      focus,
      peripheral,
      horizon,
      agentId,
      computedAt: Date.now(),
    };

    // Сохраняем в кэш
    this._fieldCache.set(`${db}:${agentId}`, field);

    return field;
  }

  /**
   * Вычислить зону фокуса — объекты, близкие к текущей задаче агента
   * @private
   */
  async _computeFocusZone(db, profile, threshold) {
    const profileData = JSON.parse(profile.val);
    if (!profileData.currentTask) return [];

    // Находим эмбеддинг задачи агента (kind=task, привязан к профилю)
    const taskVector = await this._getAgentTaskVector(db, profile.id);
    if (!taskVector) return [];

    // Поиск ближайших объектов
    const results = await this.vector.search(db, taskVector, {
      limit: this.focusLimit * 2, // берём с запасом, потом фильтруем
      minScore: threshold,
    });

    // Фильтруем: исключаем собственные вектора агента (привязанные к profileId)
    const focusItems = [];
    for (const r of results.results) {
      if (r.parentId === profile.id) continue; // пропускаем свои вектора
      focusItems.push({
        objectId: r.parentId,
        vectorId: r.id,
        score: Math.round(r.score * 10000) / 10000,
        zone: 'focus',
      });
      if (focusItems.length >= this.focusLimit) break;
    }

    return focusItems;
  }

  /**
   * Вычислить зону периферии — объекты, близкие к интересам агента
   * @private
   */
  async _computePeripheralZone(db, profile, threshold, focusItems) {
    const interestVectors = await this._getAgentInterestVectors(db, profile.id);
    if (interestVectors.length === 0) return [];

    // Собираем ID объектов из фокуса, чтобы не дублировать
    const focusObjectIds = new Set(focusItems.map(f => f.objectId));

    // Для каждого интереса ищем ближайшие объекты
    const candidateMap = new Map(); // objectId → { maxScore, vectorId }

    for (const interest of interestVectors) {
      const results = await this.vector.search(db, interest.vec, {
        limit: this.peripheralLimit,
        minScore: threshold,
      });

      for (const r of results.results) {
        if (r.parentId === profile.id) continue;   // свои вектора
        if (focusObjectIds.has(r.parentId)) continue; // уже в фокусе

        const existing = candidateMap.get(r.parentId);
        if (!existing || r.score > existing.maxScore) {
          candidateMap.set(r.parentId, {
            objectId: r.parentId,
            vectorId: r.id,
            maxScore: r.score,
          });
        }
      }
    }

    // Сортируем по убыванию score, берём top N
    const sorted = Array.from(candidateMap.values())
      .sort((a, b) => b.maxScore - a.maxScore)
      .slice(0, this.peripheralLimit);

    return sorted.map(s => ({
      objectId: s.objectId,
      vectorId: s.vectorId,
      score: Math.round(s.maxScore * 10000) / 10000,
      zone: 'peripheral',
    }));
  }

  /**
   * Вычислить зону горизонта — объекты, связанные графом с фокусом и периферией
   * @private
   */
  async _computeHorizonZone(db, focusItems, peripheralItems) {
    // Собираем все ID из фокуса и периферии
    const seedIds = new Set([
      ...focusItems.map(f => f.objectId),
      ...peripheralItems.map(p => p.objectId),
    ]);

    if (seedIds.size === 0) return [];

    const horizonMap = new Map(); // objectId → { sourceId, linkKind }

    // Для каждого seed-объекта делаем обход графа глубиной 1
    for (const seedId of seedIds) {
      try {
        const outgoing = await this.links.getLinksFrom(db, seedId);
        for (const link of outgoing) {
          if (!seedIds.has(link.targetId) && !horizonMap.has(link.targetId)) {
            horizonMap.set(link.targetId, {
              objectId: link.targetId,
              linkedFrom: seedId,
              linkKind: link.kind,
              linkWeight: link.weight || 1.0,
            });
          }
        }

        const incoming = await this.links.getLinksTo(db, seedId);
        for (const link of incoming) {
          if (!seedIds.has(link.sourceId) && !horizonMap.has(link.sourceId)) {
            horizonMap.set(link.sourceId, {
              objectId: link.sourceId,
              linkedFrom: seedId,
              linkKind: link.kind,
              linkWeight: link.weight || 1.0,
            });
          }
        }
      } catch (e) {
        // Игнорируем ошибки отдельных запросов графа
        this.logger.warn(`[SemanticField] Ошибка обхода графа для id=${seedId}: ${e.message}`);
      }
    }

    // Сортируем по весу связи, берём top N
    const sorted = Array.from(horizonMap.values())
      .sort((a, b) => b.linkWeight - a.linkWeight)
      .slice(0, this.horizonLimit);

    return sorted.map(h => ({
      objectId: h.objectId,
      linkedFrom: h.linkedFrom,
      linkKind: h.linkKind,
      score: h.linkWeight,
      zone: 'horizon',
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Обновление фокуса
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Обновить фокус агента при смене задачи
   *
   * Перевычисляет только зону фокуса — периферия и горизонт остаются
   * от предыдущего вычисления для скорости.
   *
   * @param {string} database — имя базы данных
   * @param {string} agentId — идентификатор агента
   * @param {string} newTask — текстовое описание новой задачи
   * @returns {Promise<{focus, peripheral, horizon, agentId, computedAt}>}
   */
  async updateFocus(database, agentId, newTask) {
    const db = this._validateDb(database);

    // Загружаем профиль
    const profile = await this._findAgentProfile(db, agentId);
    if (!profile) {
      throw new Error(`Агент «${agentId}» не зарегистрирован.`);
    }

    // Обновляем currentTask в профиле
    const profileData = JSON.parse(profile.val);
    profileData.currentTask = newTask;
    profileData.updatedAt = new Date().toISOString();

    const updateSql = `UPDATE \`${db}\` SET val = ? WHERE id = ?`;
    await this.db.execSql(updateSql, [JSON.stringify(profileData), profile.id], 'SemanticField.updateFocus.profile');

    // Удаляем старый task-эмбеддинг и создаём новый
    await this._replaceTaskVector(db, profile.id, newTask);

    // Перевычисляем только фокус
    await this.vector.initialize(database);
    const newFocus = await this._computeFocusZone(db, { ...profile, val: JSON.stringify(profileData) }, this.focusThreshold);

    // Берём периферию и горизонт из кэша (если есть)
    const cacheKey = `${db}:${agentId}`;
    const cached = this._fieldCache.get(cacheKey);
    const peripheral = cached ? cached.peripheral : [];
    const horizon = cached ? cached.horizon : [];

    const field = {
      focus: newFocus,
      peripheral,
      horizon,
      agentId,
      computedAt: Date.now(),
    };

    this._fieldCache.set(cacheKey, field);

    this.logger.info(`[SemanticField] Фокус агента «${agentId}» обновлён: ${newFocus.length} объектов`);

    return field;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Событие изменения объекта
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Обработать изменение объекта — проверить, затронуто ли поле какого-либо агента
   *
   * Для каждого зарегистрированного агента: если objectId находится в его поле,
   * добавить уведомление. Возвращает список затронутых агентов.
   *
   * @param {string} database — имя базы данных
   * @param {number} objectId — ID изменённого объекта
   * @returns {Promise<{affectedAgents: Array<{agentId, zone, score}>}>}
   */
  async onObjectChanged(database, objectId) {
    const db = this._validateDb(database);

    // Загружаем всех агентов
    const agents = await this._getAllAgentProfiles(db);
    const affectedAgents = [];

    for (const agent of agents) {
      const profileData = JSON.parse(agent.val);
      const cacheKey = `${db}:${profileData.agentId}`;
      const cached = this._fieldCache.get(cacheKey);

      if (!cached) continue; // Поле не вычислено — пропускаем

      // Проверяем каждую зону
      let foundZone = null;
      let foundScore = 0;

      for (const item of cached.focus) {
        if (item.objectId === objectId) {
          foundZone = 'focus';
          foundScore = item.score;
          break;
        }
      }
      if (!foundZone) {
        for (const item of cached.peripheral) {
          if (item.objectId === objectId) {
            foundZone = 'peripheral';
            foundScore = item.score;
            break;
          }
        }
      }
      if (!foundZone) {
        for (const item of cached.horizon) {
          if (item.objectId === objectId) {
            foundZone = 'horizon';
            foundScore = item.score;
            break;
          }
        }
      }

      if (foundZone) {
        // Добавляем уведомление в профиль агента
        const notification = {
          type: 'object_changed',
          objectId,
          zone: foundZone,
          score: foundScore,
          timestamp: Date.now(),
        };

        profileData.notifications = profileData.notifications || [];
        profileData.notifications.push(notification);

        // Ограничиваем количество уведомлений (последние 100)
        if (profileData.notifications.length > 100) {
          profileData.notifications = profileData.notifications.slice(-100);
        }

        profileData.updatedAt = new Date().toISOString();
        const updateSql = `UPDATE \`${db}\` SET val = ? WHERE id = ?`;
        await this.db.execSql(updateSql, [JSON.stringify(profileData), agent.id], 'SemanticField.onObjectChanged');

        affectedAgents.push({
          agentId: profileData.agentId,
          name: profileData.name,
          zone: foundZone,
          score: foundScore,
        });
      }
    }

    if (affectedAgents.length > 0) {
      this.logger.info(`[SemanticField] Объект id=${objectId} затронул ${affectedAgents.length} агентов: ${affectedAgents.map(a => a.agentId).join(', ')}`);
    }

    return { affectedAgents };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Трекинг внимания
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Зафиксировать обращение агента к объекту
   *
   * Увеличивает счётчик внимания. Объекты с высоким вниманием
   * перемещаются из периферии в фокус. Объекты без внимания
   * со временем угасают из поля.
   *
   * @param {string} database — имя базы данных
   * @param {string} agentId — идентификатор агента
   * @param {number} objectId — ID объекта, к которому обратился агент
   * @returns {Promise<{objectId, attentionCount, promoted}>}
   */
  async recordAttention(database, agentId, objectId) {
    const db = this._validateDb(database);

    const profile = await this._findAgentProfile(db, agentId);
    if (!profile) {
      throw new Error(`Агент «${agentId}» не зарегистрирован.`);
    }

    const profileData = JSON.parse(profile.val);
    const attention = profileData.attention || {};

    // Обновляем счётчик внимания
    const existing = attention[objectId] || { count: 0, lastAccessed: 0 };
    existing.count += 1;
    existing.lastAccessed = Date.now();
    attention[objectId] = existing;

    // Проверяем, нужно ли повысить объект из периферии в фокус
    let promoted = false;
    if (existing.count >= this.attentionPromoteThreshold) {
      const cacheKey = `${db}:${agentId}`;
      const cached = this._fieldCache.get(cacheKey);

      if (cached) {
        // Ищем объект в периферии
        const peripheralIdx = cached.peripheral.findIndex(p => p.objectId === objectId);
        if (peripheralIdx !== -1 && cached.focus.length < this.focusLimit) {
          const item = cached.peripheral.splice(peripheralIdx, 1)[0];
          item.zone = 'focus';
          item.promotedByAttention = true;
          cached.focus.push(item);
          promoted = true;
          this.logger.info(`[SemanticField] Объект id=${objectId} повышен в фокус агента «${agentId}» (внимание=${existing.count})`);
        }
      }
    }

    // Угасание: убираем объекты, к которым давно не обращались
    const now = Date.now();
    for (const [objId, data] of Object.entries(attention)) {
      if (data.count === 0 && (now - data.lastAccessed) > this.attentionFadeTTL) {
        delete attention[objId];

        // Удаляем из кэшированного поля
        const cacheKey = `${db}:${agentId}`;
        const cached = this._fieldCache.get(cacheKey);
        if (cached) {
          cached.peripheral = cached.peripheral.filter(p => p.objectId !== parseInt(objId));
          cached.horizon = cached.horizon.filter(h => h.objectId !== parseInt(objId));
        }
      }
    }

    // Сохраняем обновлённый профиль
    profileData.attention = attention;
    profileData.updatedAt = new Date().toISOString();
    const updateSql = `UPDATE \`${db}\` SET val = ? WHERE id = ?`;
    await this.db.execSql(updateSql, [JSON.stringify(profileData), profile.id], 'SemanticField.recordAttention');

    return {
      objectId,
      attentionCount: existing.count,
      promoted,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Пересечение полей двух агентов
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Найти пересечение семантических полей двух агентов
   *
   * Объекты, которые видят оба агента — потенциальные точки сотрудничества.
   * Объекты, видимые только одному — уникальная экспертиза.
   *
   * @param {string} database — имя базы данных
   * @param {string} agentId1 — первый агент
   * @param {string} agentId2 — второй агент
   * @returns {Promise<{shared, agent1Only, agent2Only}>}
   */
  async getOverlap(database, agentId1, agentId2) {
    const db = this._validateDb(database);

    // Вычисляем поля обоих агентов (с кэшем)
    const [field1, field2] = await Promise.all([
      this.getField(db, agentId1),
      this.getField(db, agentId2),
    ]);

    // Собираем множества objectId для каждого агента
    const objects1 = new Map(); // objectId → { zone, score }
    const objects2 = new Map();

    for (const item of [...field1.focus, ...field1.peripheral, ...field1.horizon]) {
      if (!objects1.has(item.objectId)) {
        objects1.set(item.objectId, { zone: item.zone, score: item.score });
      }
    }

    for (const item of [...field2.focus, ...field2.peripheral, ...field2.horizon]) {
      if (!objects2.has(item.objectId)) {
        objects2.set(item.objectId, { zone: item.zone, score: item.score });
      }
    }

    // Вычисляем пересечение и разности
    const shared = [];
    const agent1Only = [];
    const agent2Only = [];

    for (const [objId, data1] of objects1) {
      const data2 = objects2.get(objId);
      if (data2) {
        shared.push({
          objectId: objId,
          agent1Zone: data1.zone,
          agent1Score: data1.score,
          agent2Zone: data2.zone,
          agent2Score: data2.score,
        });
      } else {
        agent1Only.push({
          objectId: objId,
          zone: data1.zone,
          score: data1.score,
        });
      }
    }

    for (const [objId, data2] of objects2) {
      if (!objects1.has(objId)) {
        agent2Only.push({
          objectId: objId,
          zone: data2.zone,
          score: data2.score,
        });
      }
    }

    // Сортируем shared по среднему score
    shared.sort((a, b) => {
      const avgA = (a.agent1Score + a.agent2Score) / 2;
      const avgB = (b.agent1Score + b.agent2Score) / 2;
      return avgB - avgA;
    });

    return {
      shared,
      agent1Only,
      agent2Only,
      summary: {
        sharedCount: shared.length,
        agent1OnlyCount: agent1Only.length,
        agent2OnlyCount: agent2Only.length,
        overlapRatio: objects1.size + objects2.size > 0
          ? Math.round((shared.length * 2 / (objects1.size + objects2.size)) * 10000) / 10000
          : 0,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Статистика поля
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Получить статистику семантического поля агента
   *
   * @param {string} database — имя базы данных
   * @param {string} agentId — идентификатор агента
   * @returns {Promise<{focusSize, peripheralSize, horizonSize, totalAttention, lastComputed}>}
   */
  async getFieldStats(database, agentId) {
    const db = this._validateDb(database);

    const profile = await this._findAgentProfile(db, agentId);
    if (!profile) {
      throw new Error(`Агент «${agentId}» не зарегистрирован.`);
    }

    const profileData = JSON.parse(profile.val);
    const cacheKey = `${db}:${agentId}`;
    const cached = this._fieldCache.get(cacheKey);

    // Считаем суммарное внимание
    const attention = profileData.attention || {};
    let totalAttention = 0;
    let mostAttendedId = null;
    let mostAttendedCount = 0;

    for (const [objId, data] of Object.entries(attention)) {
      totalAttention += data.count;
      if (data.count > mostAttendedCount) {
        mostAttendedCount = data.count;
        mostAttendedId = parseInt(objId);
      }
    }

    return {
      agentId,
      name: profileData.name,
      role: profileData.role,
      currentTask: profileData.currentTask || null,
      focusSize: cached ? cached.focus.length : 0,
      peripheralSize: cached ? cached.peripheral.length : 0,
      horizonSize: cached ? cached.horizon.length : 0,
      totalFieldSize: cached ? (cached.focus.length + cached.peripheral.length + cached.horizon.length) : 0,
      totalAttention,
      trackedObjects: Object.keys(attention).length,
      mostAttended: mostAttendedId ? { objectId: mostAttendedId, count: mostAttendedCount } : null,
      pendingNotifications: (profileData.notifications || []).length,
      lastComputed: cached ? cached.computedAt : null,
      registeredAt: profileData.createdAt,
      updatedAt: profileData.updatedAt,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Внутренние методы
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Валидация имени базы данных
   * @private
   */
  _validateDb(database) {
    if (!database || typeof database !== 'string') {
      throw new Error('Требуется имя базы данных (database)');
    }
    return database;
  }

  /**
   * Найти профиль агента по agentId
   * @private
   * @param {string} db — имя базы данных
   * @param {string} agentId — идентификатор агента
   * @returns {Promise<{id, val}|null>}
   */
  async _findAgentProfile(db, agentId) {
    const sql = `SELECT id, val FROM \`${db}\` WHERE t = ? AND val LIKE ? LIMIT 1`;
    const result = await this.db.execSql(sql, [AGENT_PROFILE_TYPE, `%"agentId":"${agentId}"%`], 'SemanticField.findProfile');
    const rows = result.rows || [];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Получить все профили агентов
   * @private
   * @param {string} db — имя базы данных
   * @returns {Promise<Array<{id, val}>>}
   */
  async _getAllAgentProfiles(db) {
    const sql = `SELECT id, val FROM \`${db}\` WHERE t = ? AND val LIKE '%"agentId"%'`;
    const result = await this.db.execSql(sql, [AGENT_PROFILE_TYPE], 'SemanticField.allProfiles');
    return result.rows || [];
  }

  /**
   * Обновить существующий профиль агента
   * @private
   */
  async _updateAgentProfile(db, profileId, agentId, profile) {
    const { name, role, capabilities = [], currentTask = '', interests = [] } = profile;

    // Читаем текущий профиль для сохранения attention и notifications
    const readSql = `SELECT val FROM \`${db}\` WHERE id = ?`;
    const readResult = await this.db.execSql(readSql, [profileId], 'SemanticField.readProfile');
    const existingData = readResult.rows?.[0] ? JSON.parse(readResult.rows[0].val) : {};

    const profileData = JSON.stringify({
      agentId,
      name,
      role,
      capabilities,
      currentTask,
      interests,
      attention: existingData.attention || {},
      notifications: existingData.notifications || [],
      createdAt: existingData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const updateSql = `UPDATE \`${db}\` SET val = ? WHERE id = ?`;
    await this.db.execSql(updateSql, [profileData, profileId], 'SemanticField.updateProfile');

    // Удаляем старые вектора интересов и задачи
    const deleteVecSql = `DELETE FROM \`${db}\` WHERE up = ? AND t = ?`;
    await this.db.execSql(deleteVecSql, [profileId, EMBEDDING_TYPE], 'SemanticField.clearVectors');

    // Перегенерируем вектора интересов
    const interestVectors = [];
    if (this.embedding && interests.length > 0) {
      for (const interest of interests) {
        try {
          const vec = await this.embedding.embed(interest.substring(0, 2000));
          if (vec && vec.length > 0) {
            const stored = await this.vector.addVector(db, profileId, Array.from(vec), {
              model: this.embedding.config?.model,
              kind: 'interest',
              text: interest,
            });
            interestVectors.push({ id: stored.id, text: interest });
          }
        } catch (e) {
          this.logger.warn(`[SemanticField] Ошибка эмбеддинга интереса «${interest}»: ${e.message}`);
        }
      }
    }

    // Генерируем эмбеддинг задачи
    if (this.embedding && currentTask) {
      try {
        const taskVec = await this.embedding.embed(currentTask.substring(0, 2000));
        if (taskVec && taskVec.length > 0) {
          await this.vector.addVector(db, profileId, Array.from(taskVec), {
            model: this.embedding.config?.model,
            kind: 'task',
            text: currentTask,
          });
        }
      } catch (e) {
        this.logger.warn(`[SemanticField] Ошибка эмбеддинга задачи: ${e.message}`);
      }
    }

    // Инвалидируем кэш поля
    this._fieldCache.delete(`${db}:${agentId}`);

    this.logger.info(`[SemanticField] Профиль агента «${name}» (${agentId}) обновлён, profileId=${profileId}`);

    return { agentId, profileId, interestVectors };
  }

  /**
   * Получить task-вектор агента (эмбеддинг текущей задачи)
   * @private
   * @param {string} db — имя базы данных
   * @param {number} profileId — ID профиля агента
   * @returns {Promise<Float32Array|null>}
   */
  async _getAgentTaskVector(db, profileId) {
    // Ищем эмбеддинг с kind=task, привязанный к профилю
    const sql = `SELECT id, val FROM \`${db}\` WHERE up = ? AND t = ? AND val LIKE '%"kind":"task"%' LIMIT 1`;
    const result = await this.db.execSql(sql, [profileId, EMBEDDING_TYPE], 'SemanticField.taskVec');
    const rows = result.rows || [];

    if (rows.length === 0) return null;

    try {
      const parsed = JSON.parse(rows[0].val);
      const values = parsed.values || parsed;
      if (Array.isArray(values) && values.length > 0) {
        return values;
      }
    } catch (e) {
      this.logger.warn(`[SemanticField] Ошибка парсинга task-вектора: ${e.message}`);
    }

    return null;
  }

  /**
   * Получить interest-вектора агента (эмбеддинги интересов)
   * @private
   * @param {string} db — имя базы данных
   * @param {number} profileId — ID профиля агента
   * @returns {Promise<Array<{id, vec: Float32Array, text}>>}
   */
  async _getAgentInterestVectors(db, profileId) {
    const sql = `SELECT id, val FROM \`${db}\` WHERE up = ? AND t = ? AND val LIKE '%"kind":"interest"%'`;
    const result = await this.db.execSql(sql, [profileId, EMBEDDING_TYPE], 'SemanticField.interestVecs');
    const vectors = [];

    for (const row of (result.rows || [])) {
      try {
        const parsed = JSON.parse(row.val);
        const values = parsed.values || parsed;
        if (Array.isArray(values) && values.length > 0) {
          vectors.push({
            id: row.id,
            vec: values,
            text: parsed.text || '',
          });
        }
      } catch (e) { /* пропускаем */ }
    }

    return vectors;
  }

  /**
   * Заменить task-вектор агента (удалить старый, создать новый)
   * @private
   * @param {string} db — имя базы данных
   * @param {number} profileId — ID профиля агента
   * @param {string} newTask — текст новой задачи
   */
  async _replaceTaskVector(db, profileId, newTask) {
    // Удаляем старый task-эмбеддинг
    const deleteSql = `DELETE FROM \`${db}\` WHERE up = ? AND t = ? AND val LIKE '%"kind":"task"%'`;
    await this.db.execSql(deleteSql, [profileId, EMBEDDING_TYPE], 'SemanticField.deleteTaskVec');

    // Удаляем из RAM-индекса VectorService
    // (vector.initialize перечитает при следующем search, но лучше явно)

    // Создаём новый
    if (this.embedding && newTask) {
      try {
        const taskVec = await this.embedding.embed(newTask.substring(0, 2000));
        if (taskVec && taskVec.length > 0) {
          await this.vector.addVector(db, profileId, Array.from(taskVec), {
            model: this.embedding.config?.model,
            kind: 'task',
            text: newTask,
          });
        }
      } catch (e) {
        this.logger.warn(`[SemanticField] Ошибка эмбеддинга новой задачи: ${e.message}`);
      }
    }
  }
}

export default SemanticField;
