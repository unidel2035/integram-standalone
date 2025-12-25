/**
 * Integram MCP Tools for AI Tool Calling
 * Issue #5266: Add MCP tool support to coordinator
 *
 * Provides Integram database tools in Anthropic tool calling format.
 * These tools allow AI to query and manipulate Integram database directly.
 */

/**
 * Get Integram database tools for AI tool calling
 * @returns {Array} Array of tool definitions in Anthropic format
 */
export function getIntegramTools() {
  return [
    {
      name: 'integram_get_dictionary',
      description: 'Get list of all tables (types) in Integram database. Use this to discover available tables before querying data.',
      input_schema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'integram_get_type_metadata',
      description: 'Get detailed metadata for a specific table including all columns (requisites) with their types and properties. Use this to understand table structure before reading or writing data.',
      input_schema: {
        type: 'object',
        properties: {
          typeId: {
            type: 'number',
            description: 'Table type ID from get_dictionary'
          }
        },
        required: ['typeId']
      }
    },
    {
      name: 'integram_get_object_list',
      description: 'Get list of records (objects) from a specific table with pagination. Returns record IDs, values, and all requisite values.',
      input_schema: {
        type: 'object',
        properties: {
          typeId: {
            type: 'number',
            description: 'Table type ID to query'
          },
          params: {
            type: 'object',
            description: 'Query parameters with offset and limit for pagination (default: {offset: 0, limit: 100})',
            properties: {
              offset: { type: 'number' },
              limit: { type: 'number' }
            }
          }
        },
        required: ['typeId']
      }
    },
    {
      name: 'integram_get_all_objects',
      description: 'Get ALL records from a table with automatic pagination. Use when you need complete data export. Warning: Can be slow for large tables.',
      input_schema: {
        type: 'object',
        properties: {
          typeId: {
            type: 'number',
            description: 'Table type ID to query'
          },
          pageSize: {
            type: 'number',
            description: 'Number of records per page (default: 100)'
          },
          maxPages: {
            type: 'number',
            description: 'Maximum pages to fetch (safety limit, default: 50)'
          }
        },
        required: ['typeId']
      }
    },
    {
      name: 'integram_get_object_count',
      description: 'Get count of records in a table without fetching data. Fast way to check table size.',
      input_schema: {
        type: 'object',
        properties: {
          typeId: {
            type: 'number',
            description: 'Table type ID to count'
          }
        },
        required: ['typeId']
      }
    },
    {
      name: 'integram_get_object_edit_data',
      description: 'Get detailed data for a single record including all requisite values and metadata.',
      input_schema: {
        type: 'object',
        properties: {
          objectId: {
            type: 'number',
            description: 'Record object ID'
          }
        },
        required: ['objectId']
      }
    },
    {
      name: 'integram_create_object',
      description: 'Create new record in a table with requisite values. Returns created object ID.',
      input_schema: {
        type: 'object',
        properties: {
          typeId: {
            type: 'number',
            description: 'Table type ID'
          },
          value: {
            type: 'string',
            description: 'Record name/value (main field)'
          },
          requisites: {
            type: 'object',
            description: 'Requisite values as key-value pairs where key is requisiteId (string) and value is field value. For reference fields, pass target object ID as string.'
          },
          parentId: {
            type: 'number',
            description: 'Parent ID for subordinate objects (optional)'
          }
        },
        required: ['typeId', 'value']
      }
    },
    {
      name: 'integram_set_object_requisites',
      description: 'Update specific requisite values for an existing record. Only updates specified requisites, leaves others unchanged. Recommended method for updates.',
      input_schema: {
        type: 'object',
        properties: {
          objectId: {
            type: 'number',
            description: 'Record object ID to update'
          },
          requisites: {
            type: 'object',
            description: 'Requisites to update as key-value pairs. Key is requisiteId (string), value is new value.'
          }
        },
        required: ['objectId', 'requisites']
      }
    },
    {
      name: 'integram_delete_object',
      description: 'Delete a record from a table. Use with caution.',
      input_schema: {
        type: 'object',
        properties: {
          objectId: {
            type: 'number',
            description: 'Record object ID to delete'
          }
        },
        required: ['objectId']
      }
    },
    {
      name: 'integram_create_type',
      description: 'Create new table (type) in Integram database. Returns created type ID.',
      input_schema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Table name (Russian name recommended)'
          },
          baseTypeId: {
            type: 'number',
            description: 'Base type ID (default 3 for standard tables, 0 NOT allowed)'
          },
          unique: {
            type: 'boolean',
            description: 'Whether first column is unique (default: false)'
          }
        },
        required: ['name']
      }
    },
    {
      name: 'integram_add_requisite',
      description: 'Add column (requisite) to an existing table. Returns created requisite ID.',
      input_schema: {
        type: 'object',
        properties: {
          typeId: {
            type: 'number',
            description: 'Table type ID to add column to'
          },
          requisiteTypeId: {
            type: 'number',
            description: 'Requisite type ID: 3=SHORT text, 2=LONG text, 13=NUMBER, 4=DATETIME, 7=BOOL, 8=REFERENCE'
          }
        },
        required: ['typeId', 'requisiteTypeId']
      }
    },
    {
      name: 'integram_save_requisite_alias',
      description: 'Set human-readable name (alias) for a column. Russian names recommended.',
      input_schema: {
        type: 'object',
        properties: {
          requisiteId: {
            type: 'number',
            description: 'Requisite ID to set alias for'
          },
          alias: {
            type: 'string',
            description: 'Column display name (e.g., "Название", "Описание")'
          }
        },
        required: ['requisiteId', 'alias']
      }
    },
    {
      name: 'integram_execute_report',
      description: 'Execute a saved Integram report/query. Returns query results.',
      input_schema: {
        type: 'object',
        properties: {
          reportId: {
            type: 'number',
            description: 'Report ID to execute'
          },
          params: {
            type: 'object',
            description: 'Report parameters (optional)'
          }
        },
        required: ['reportId']
      }
    }
  ];
}

/**
 * Execute an Integram MCP tool call
 * @param {string} toolName - Name of the tool to execute
 * @param {object} toolInput - Tool input parameters
 * @param {object} mcpClient - Authenticated Integram MCP client
 * @returns {Promise<object>} Tool execution result
 */
export async function executeIntegramTool(toolName, toolInput, mcpClient) {
  try {
    // Map tool name to MCP client method
    const methodName = toolName.replace('integram_', '');

    if (typeof mcpClient[methodName] !== 'function') {
      throw new Error(`Unknown Integram tool: ${toolName}`);
    }

    // Execute the tool via MCP client
    const result = await mcpClient[methodName](toolInput);

    return {
      success: true,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.toString()
    };
  }
}
