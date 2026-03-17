/**
 * LinoFormat — текстовый формат экспорта/импорта онтологий.
 *
 * Совместим с LiNo-синтаксисом link-cli (скобочная нотация):
 *   (id: source target)         — чистый links-client формат
 *   (src) ==kind==> (tgt) @conf — расширенный формат с типом + confidence
 *
 * Два режима:
 *   'extended' (default) — полный формат с метаданными и расширенными дублетами
 *   'pure-lino'          — только (id: source target), совместимый с link-cli/clink
 *
 * @module LinoFormat
 */

export class LinoFormat {
  // ========================================
  // Сериализация
  // ========================================

  /**
   * Сериализовать граф в LinoFormat.
   * @param {Array} entities
   * @param {Array} relations
   * @param {Array} doublets
   * @param {object} options — { mode: 'extended' | 'pure-lino' }
   * @returns {string}
   */
  static serialize(entities = [], relations = [], doublets = [], options = {}) {
    const { mode = 'extended' } = options;
    const lines = [];

    lines.push(`# DronDoc LinoFormat export`);
    lines.push(`# mode: ${mode}`);
    lines.push(`# date: ${new Date().toISOString()}`);
    lines.push('');

    // Entities
    if (entities.length > 0) {
      lines.push('# Entities');
      for (const e of entities) {
        lines.push(LinoFormat.serializeEntity(e));
      }
      lines.push('');
    }

    // Relations
    if (relations.length > 0) {
      lines.push('# Relations');
      for (const r of relations) {
        lines.push(LinoFormat.serializeRelation(r));
      }
      lines.push('');
    }

    // Doublets
    if (doublets.length > 0) {
      lines.push('# Doublets');
      for (const d of doublets) {
        lines.push(LinoFormat.serializeDoublet(d, mode));
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Сериализовать сущность.
   * Формат:
   *   (name: type
   *     \u00abobservation\u00bb
   *     prop: value
   *   )
   */
  static serializeEntity(entity) {
    const name = LinoFormat._escapeName(entity.name || entity.id);
    const type = entity.type || 'Entity';
    const lines = [`(${name}: ${type}`];

    // Observations
    const obs = Array.isArray(entity.observations) ? entity.observations : [];
    for (const o of obs) {
      if (o && typeof o === 'string') {
        lines.push(`  \u00ab${o.replace(/\n/g, ' ').slice(0, 200)}\u00bb`);
      }
    }

    // Key properties
    const props = entity.properties || {};
    const importantKeys = ['source', 'notation', 'nameRu', 'nameEn', 'kvalObjectId'];
    for (const key of importantKeys) {
      if (props[key]) {
        lines.push(`  ${key}: ${String(props[key]).slice(0, 200)}`);
      }
    }

    // ID if different from name
    if (entity.id && entity.id !== entity.name) {
      lines.push(`  id: ${entity.id}`);
    }

    lines.push(')');
    return lines.join('\n');
  }

  /**
   * Сериализовать связь.
   * Формат: (from) --type--> (to)
   */
  static serializeRelation(rel) {
    const from = LinoFormat._escapeName(rel.from || rel.from_id || '?');
    const to = LinoFormat._escapeName(rel.to || rel.to_id || '?');
    const type = rel.type || 'related_to';
    return `(${from}) --${type}--> (${to})`;
  }

  /**
   * Сериализовать дублет.
   * extended: (src) ==kind==> (tgt) @confidence
   * pure-lino: (id: source target)
   */
  static serializeDoublet(doublet, mode = 'extended') {
    if (mode === 'pure-lino') {
      // link-cli совместимый формат
      return `(${doublet.id}: ${doublet.source} ${doublet.target})`;
    }

    // Расширенный формат
    const conf = doublet.data?.confidence;
    const confStr = conf != null ? ` @${conf}` : '';
    return `(${doublet.source}) ==${doublet.kind}==> (${doublet.target})${confStr}`;
  }

  // ========================================
  // Парсинг
  // ========================================

  /**
   * Распарсить LinoFormat текст.
   * @param {string} text
   * @returns {{ entities: Array, relations: Array, doublets: Array }}
   */
  static parse(text) {
    if (!text || typeof text !== 'string') {
      return { entities: [], relations: [], doublets: [] };
    }

    const entities = [];
    const relations = [];
    const doublets = [];

    const lines = text.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      // Пропускаем комментарии и пустые строки
      if (!line || line.startsWith('#')) {
        i++;
        continue;
      }

      // Многострочная сущность: (name: type\n  ...\n)
      if (line.startsWith('(') && line.includes(': ') && !line.includes('-->') && !line.includes('==>')) {
        // Проверяем, не однострочный ли это дублет в pure-lino формате
        const pureLino = LinoFormat._tryParsePureLinoDoublet(line);
        if (pureLino) {
          doublets.push(pureLino);
          i++;
          continue;
        }

        // Собираем многострочный блок
        let block = line;
        if (!line.endsWith(')')) {
          i++;
          while (i < lines.length) {
            const nextLine = lines[i];
            block += '\n' + nextLine;
            if (nextLine.trim() === ')') break;
            i++;
          }
        }
        const entity = LinoFormat.parseEntity(block);
        if (entity) entities.push(entity);
        i++;
        continue;
      }

      // Связь: (from) --type--> (to)
      if (line.includes('-->') && !line.includes('==>')) {
        const rel = LinoFormat.parseRelation(line);
        if (rel) relations.push(rel);
        i++;
        continue;
      }

      // Расширенный дублет: (src) ==kind==> (tgt) @conf
      if (line.includes('==>')) {
        const dbl = LinoFormat.parseDoublet(line);
        if (dbl) doublets.push(dbl);
        i++;
        continue;
      }

      i++;
    }

    return { entities, relations, doublets };
  }

  /**
   * Парсинг блока сущности.
   * Вход: "(name: type\n  \u00abobs\u00bb\n  key: val\n)"
   */
  static parseEntity(block) {
    if (!block) return null;

    // Извлечь первую строку: (name: type
    const firstLineMatch = block.match(/^\(([^:]+):\s*(\S+)/);
    if (!firstLineMatch) return null;

    const name = firstLineMatch[1].trim();
    const type = firstLineMatch[2].trim();

    const observations = [];
    const properties = {};
    let id = null;

    // Парсим внутренние строки
    const innerLines = block.split('\n').slice(1);
    for (const line of innerLines) {
      const trimmed = line.trim();
      if (trimmed === ')') break;

      // Observation: \u00abtext\u00bb
      const obsMatch = trimmed.match(/^\u00ab(.+?)\u00bb$/);
      if (obsMatch) {
        observations.push(obsMatch[1]);
        continue;
      }

      // Property: key: value
      const propMatch = trimmed.match(/^(\w+):\s+(.+)$/);
      if (propMatch) {
        const key = propMatch[1];
        const val = propMatch[2];
        if (key === 'id') {
          id = val;
        } else {
          properties[key] = val;
        }
      }
    }

    return {
      id: id || name,
      name,
      type,
      observations,
      properties,
    };
  }

  /**
   * Парсинг строки связи.
   * Вход: "(from) --type--> (to)"
   */
  static parseRelation(line) {
    const match = line.match(/^\(([^)]+)\)\s*--(\S+)-->\s*\(([^)]+)\)$/);
    if (!match) return null;

    return {
      id: `rel-${match[1]}-${match[3]}-${match[2]}`.slice(0, 80),
      from: match[1].trim(),
      to: match[3].trim(),
      type: match[2].trim(),
    };
  }

  /**
   * Парсинг дублета (оба формата).
   * Расширенный: "(src) ==kind==> (tgt) @0.95"
   * Pure-lino:   "(id: source target)"
   */
  static parseDoublet(line) {
    // Расширенный формат
    const extMatch = line.match(/^\(([^)]+)\)\s*==(\w+)==>\s*\(([^)]+)\)(?:\s*@([\d.]+))?$/);
    if (extMatch) {
      return {
        source: extMatch[1].trim(),
        target: extMatch[3].trim(),
        kind: extMatch[2].trim(),
        data: extMatch[4] ? { confidence: parseFloat(extMatch[4]) } : {},
      };
    }

    // Pure-lino
    return LinoFormat._tryParsePureLinoDoublet(line);
  }

  /**
   * Попытка распарсить pure-lino дублет: "(id: source target)"
   */
  static _tryParsePureLinoDoublet(line) {
    const match = line.match(/^\((\S+):\s+(\S+)\s+(\S+)\)$/);
    if (!match) return null;

    return {
      id: match[1],
      source: match[2],
      target: match[3],
      kind: 'same_as',
      data: {},
    };
  }

  // ========================================
  // Совместимость с link-cli / clink
  // ========================================

  /**
   * Конвертировать в LiNo query для clink.
   * @param {Array} entities
   * @param {Array} relations
   * @returns {string}
   */
  static toClinkQuery(entities = [], relations = []) {
    const lines = [];

    for (const e of entities) {
      const name = LinoFormat._escapeName(e.name || e.id);
      lines.push(`(${name}: ${e.type || 'Entity'})`);
    }

    for (const r of relations) {
      const from = LinoFormat._escapeName(r.from || r.from_id || '?');
      const to = LinoFormat._escapeName(r.to || r.to_id || '?');
      lines.push(`(${from}) --${r.type || 'related_to'}--> (${to})`);
    }

    return lines.join('\n');
  }

  /**
   * Парсить вывод clink.
   * @param {string} output
   * @returns {{ links: Array<{id: string, source: string, target: string}> }}
   */
  static fromClinkOutput(output) {
    if (!output) return { links: [] };

    const links = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.trim().match(/^\((\S+):\s+(\S+)\s+(\S+)\)$/);
      if (match) {
        links.push({
          id: match[1],
          source: match[2],
          target: match[3],
        });
      }
    }

    return { links };
  }

  // ========================================
  // Helpers
  // ========================================

  /**
   * Escape имени для LiNo (убрать скобки, переносы).
   */
  static _escapeName(name) {
    if (!name) return '?';
    return String(name)
      .replace(/[()]/g, '')
      .replace(/\n/g, ' ')
      .trim()
      || '?';
  }
}

export default LinoFormat;
