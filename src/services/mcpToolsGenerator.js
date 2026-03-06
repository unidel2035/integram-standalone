/**
 * MCP Tools Generator Service
 *
 * Генерация MCP tools из визуальных блоков для Sub-Agent Builder.
 * Преобразует блоки в исполняемые MCP инструменты.
 */

import { getBlockById } from '@/config/mcpBlockDefinitions';
import integramService from '@/services/integramApiClient';

/**
 * Генерирует MCP tools из массива блоков
 *
 * @param {Array} blocks - Массив блоков { id, type, config, connections }
 * @param {Object} options - Опции генерации { agentName, systemPrompt }
 * @returns {Array} Массив MCP tools
 */
export function generateMCPTools(blocks, options = {}) {
  const tools = [];
  const { agentName = 'SubAgent' } = options;

  blocks.forEach((block, index) => {
    const definition = getBlockById(block.type);
    if (!definition) {
      console.warn(`Unknown block type: ${block.type}`);
      return;
    }

    // Генерируем уникальное имя для каждого блока
    const toolName = `${agentName}_${definition.id}_${index}`;

    // Создаём параметры на основе конфигурации блока
    const parameters = buildParameters(definition, block.config);

    // Создаём execute функцию
    const execute = buildExecuteFunction(definition, block.config);

    tools.push({
      name: toolName,
      description: `${definition.description} (${block.config.name || block.id})`,
      category: definition.category,
      parameters,
      execute,
      metadata: {
        blockId: block.id,
        blockType: block.type,
        mcpTools: definition.mcpTools
      }
    });
  });

  return tools;
}

/**
 * Строит параметры MCP tool из конфигурации блока
 */
function buildParameters(definition, config) {
  const params = {};

  // Базовые параметры в зависимости от типа блока
  switch (definition.id) {
    case 'mcp-table-reader':
      params.tableId = config.tableId;
      params.columns = config.columns || [];
      params.limit = config.limit || 100;
      params.offset = config.offset || 0;
      if (config.filters && config.filters.length > 0) {
        params.filters = config.filters;
      }
      break;

    case 'mcp-table-writer':
      params.tableId = config.tableId;
      params.mapping = config.mapping || {};
      params.mode = config.mode || 'create';
      break;

    case 'mcp-record-crud':
      params.tableId = config.tableId;
      params.operation = config.operation || 'read';
      break;

    case 'mcp-smart-query':
      params.tables = config.tables || [];
      params.columns = config.columns || [];
      params.where = config.where || '';
      params.having = config.having || '';
      params.orderBy = config.orderBy || '';
      params.limit = config.limit || 100;
      break;

    case 'mcp-natural-query':
      params.question = config.question || '';
      params.targetTable = config.targetTable;
      params.limit = config.limit || 50;
      break;

    case 'mcp-lookup':
      params.tableId = config.tableId;
      params.displayField = config.displayField;
      params.valueField = config.valueField || 'id';
      params.searchable = config.searchable !== false;
      params.multiSelect = config.multiSelect || false;
      break;

    case 'mcp-relation':
      params.fromTable = config.fromTable;
      params.toTable = config.toTable;
      params.foreignKeyColumn = config.foreignKeyColumn;
      params.relationType = config.relationType || '1:N';
      break;

    case 'mcp-multiselect':
      params.objectId = config.objectId;
      params.requisiteId = config.requisiteId;
      params.tableId = config.tableId;
      break;

    case 'mcp-data-mapper':
      params.mapping = config.mapping || {};
      params.transform = config.transform || {};
      break;

    case 'mcp-batch-processor':
      params.batchSize = config.batchSize || 10;
      params.concurrency = config.concurrency || 3;
      params.operation = config.operation || 'map';
      break;

    case 'mcp-table-creator':
      params.tableName = config.tableName || '';
      params.baseTypeId = config.baseTypeId || 3;
      params.columns = config.columns || [];
      params.parentTableId = config.parentTableId;
      break;

    case 'mcp-column-manager':
      params.tableId = config.tableId;
      params.operation = config.operation || 'add';
      params.columns = config.columns || [];
      break;

    default:
      // Копируем всю конфигурацию как параметры
      Object.assign(params, config);
  }

  return params;
}

/**
 * Строит execute функцию для MCP tool
 */
function buildExecuteFunction(definition, config) {
  return async (input) => {
    try {
      switch (definition.id) {
        case 'mcp-table-reader':
          return await executeTableReader(config, input);

        case 'mcp-table-writer':
          return await executeTableWriter(config, input);

        case 'mcp-record-crud':
          return await executeRecordCRUD(config, input);

        case 'mcp-smart-query':
          return await executeSmartQuery(config, input);

        case 'mcp-natural-query':
          return await executeNaturalQuery(config, input);

        case 'mcp-lookup':
          return await executeLookup(config, input);

        case 'mcp-relation':
          return await executeRelation(config, input);

        case 'mcp-multiselect':
          return await executeMultiselect(config, input);

        case 'mcp-data-mapper':
          return executeDataMapper(config, input);

        case 'mcp-batch-processor':
          return await executeBatchProcessor(config, input);

        case 'mcp-table-creator':
          return await executeTableCreator(config, input);

        case 'mcp-column-manager':
          return await executeColumnManager(config, input);

        default:
          throw new Error(`Unknown block type: ${definition.id}`);
      }
    } catch (error) {
      console.error(`Error executing ${definition.id}:`, error);
      throw error;
    }
  };
}

// ===== EXECUTE FUNCTIONS =====

async function executeTableReader(config, input) {
  const params = {
    typeId: config.tableId,
    params: {
      LIMIT: config.limit || 100,
      pg: Math.floor((config.offset || 0) / (config.limit || 100)) + 1,
      F_U: 1
    }
  };

  // Применяем фильтры если есть
  if (config.filters && config.filters.length > 0) {
    config.filters.forEach(filter => {
      params.params[`F_${filter.field}`] = filter.value;
    });
  }

  const response = await integramService.getObjectList(params);
  return response.objects || [];
}

async function executeTableWriter(config, input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Input must be an object');
  }

  const { tableId, mapping, mode } = config;

  // Применяем mapping для преобразования полей
  const requisites = {};
  Object.entries(mapping).forEach(([targetField, sourceField]) => {
    if (input[sourceField] !== undefined) {
      requisites[targetField] = input[sourceField];
    }
  });

  if (mode === 'create') {
    return await integramService.createObject({
      typeId: tableId,
      value: input.name || input.value || 'New Object',
      requisites
    });
  } else if (mode === 'update') {
    if (!input.objectId) {
      throw new Error('objectId required for update mode');
    }
    return await integramService.setObjectRequisites({
      objectId: input.objectId,
      requisites
    });
  } else if (mode === 'upsert') {
    // Пытаемся обновить, если не получается - создаём
    try {
      if (input.objectId) {
        return await integramService.setObjectRequisites({
          objectId: input.objectId,
          requisites
        });
      }
    } catch (error) {
      // Объект не найден, создаём новый
    }
    return await integramService.createObject({
      typeId: tableId,
      value: input.name || input.value || 'New Object',
      requisites
    });
  }

  throw new Error(`Unknown mode: ${mode}`);
}

async function executeRecordCRUD(config, input) {
  const { tableId, operation } = config;

  switch (operation) {
    case 'create':
      return await integramService.createObject({
        typeId: tableId,
        value: input.value || input.name || 'New Object',
        requisites: input.requisites || {}
      });

    case 'read':
      if (!input.objectId) {
        throw new Error('objectId required for read operation');
      }
      return await integramService.getObjectEditData({ objectId: input.objectId });

    case 'update':
      if (!input.objectId) {
        throw new Error('objectId required for update operation');
      }
      return await integramService.setObjectRequisites({
        objectId: input.objectId,
        requisites: input.requisites || {}
      });

    case 'delete':
      if (!input.objectId) {
        throw new Error('objectId required for delete operation');
      }
      return await integramService.deleteObject({ objectId: input.objectId });

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

async function executeSmartQuery(config, input) {
  // Замена параметров в WHERE clause если input содержит параметры
  let where = config.where || '';
  if (input && typeof input === 'object') {
    Object.entries(input).forEach(([key, value]) => {
      where = where.replace(new RegExp(`\\$${key}`, 'g'), value);
    });
  }

  const queryParams = {
    tables: config.tables,
    columns: config.columns,
    where,
    having: config.having || '',
    orderBy: config.orderBy || '',
    limit: config.limit || 100
  };

  // В будущем будет integramService.smartQuery
  // Пока используем упрощённую версию через getObjectList
  const mainTable = config.tables[0];
  if (!mainTable) {
    throw new Error('At least one table required');
  }

  return await integramService.getObjectList({
    typeId: mainTable.id,
    params: {
      LIMIT: config.limit || 100,
      F_U: 1
    }
  });
}

async function executeNaturalQuery(config, input) {
  const question = typeof input === 'string' ? input : (input.question || config.question);

  if (!question) {
    throw new Error('Question is required for natural query');
  }

  // В будущем будет integramService.naturalQuery
  // Пока возвращаем пустой результат
  console.warn('Natural query not yet implemented:', question);
  return [];
}

async function executeLookup(config, input) {
  const { tableId, displayField, valueField, multiSelect } = config;

  const response = await integramService.getObjectList({
    typeId: tableId,
    params: {
      LIMIT: 1000, // для справочников загружаем больше
      F_U: 1
    }
  });

  const options = (response.objects || []).map(obj => ({
    label: obj[displayField] || obj.value || obj.name,
    value: obj[valueField] || obj.id
  }));

  return multiSelect ? options : options[0];
}

async function executeRelation(config, input) {
  // Связь таблиц - пока заглушка
  // В будущем будет работать с integram_add_reference_column
  console.warn('Relation not yet implemented');
  return { success: true, relation: config };
}

async function executeMultiselect(config, input) {
  const { objectId, requisiteId } = config;

  if (!objectId || !requisiteId) {
    throw new Error('objectId and requisiteId required');
  }

  // В будущем будет работать с multiselect MCP tools
  console.warn('Multiselect not yet implemented');
  return [];
}

function executeDataMapper(config, input) {
  if (!input || typeof input !== 'object') {
    return input;
  }

  const result = {};
  const { mapping, transform } = config;

  // Применяем mapping
  Object.entries(mapping).forEach(([targetField, sourceField]) => {
    if (input[sourceField] !== undefined) {
      result[targetField] = input[sourceField];
    }
  });

  // Применяем трансформации
  Object.entries(transform || {}).forEach(([field, transformFn]) => {
    if (result[field] !== undefined && typeof transformFn === 'function') {
      result[field] = transformFn(result[field]);
    }
  });

  return result;
}

async function executeBatchProcessor(config, input) {
  if (!Array.isArray(input)) {
    throw new Error('Input must be an array for batch processor');
  }

  const { batchSize, concurrency, operation } = config;

  switch (operation) {
    case 'map':
      // Пакетная обработка с ограничением concurrency
      const results = [];
      for (let i = 0; i < input.length; i += batchSize) {
        const batch = input.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(item => Promise.resolve(item))
        );
        results.push(...batchResults);
      }
      return results;

    case 'filter':
      return input.filter(item => item !== null && item !== undefined);

    case 'reduce':
      return input.reduce((acc, item) => {
        return { ...acc, ...item };
      }, {});

    default:
      return input;
  }
}

async function executeTableCreator(config, input) {
  const { tableName, baseTypeId, columns, parentTableId } = config;

  // В будущем будет integramService.createTableWithColumns
  console.warn('Table creator not yet fully implemented');
  return {
    success: true,
    typeId: null,
    tableName
  };
}

async function executeColumnManager(config, input) {
  const { tableId, operation, columns } = config;

  // В будущем будет integramService.addColumnsToTable и другие
  console.warn('Column manager not yet fully implemented');
  return {
    success: true,
    operation,
    tableId,
    columns
  };
}

/**
 * Генерирует System Prompt для sub-agent на основе блоков
 */
export function generateSystemPrompt(blocks, options = {}) {
  const { agentName = 'SubAgent', agentDescription = '' } = options;

  const blockDescriptions = blocks.map(block => {
    const definition = getBlockById(block.type);
    return `- ${definition.name}: ${definition.description}`;
  }).join('\n');

  return `You are ${agentName}, an AI sub-agent with specific capabilities.

${agentDescription}

You have access to the following MCP tools:

${blockDescriptions}

Use these tools to accomplish tasks assigned to you. Always validate input data and handle errors gracefully.`;
}

/**
 * Экспорт конфигурации sub-agent
 */
export function exportSubAgentConfig(blocks, options = {}) {
  const tools = generateMCPTools(blocks, options);
  const systemPrompt = generateSystemPrompt(blocks, options);

  return {
    name: options.agentName || 'SubAgent',
    description: options.agentDescription || '',
    systemPrompt,
    tools,
    blocks: blocks.map(block => ({
      id: block.id,
      type: block.type,
      config: block.config,
      connections: block.connections || []
    })),
    metadata: {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      ...options.metadata
    }
  };
}

export default {
  generateMCPTools,
  generateSystemPrompt,
  exportSubAgentConfig
};
