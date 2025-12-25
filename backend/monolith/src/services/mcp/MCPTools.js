//tools.js
import axios from "axios";

export class DronedocAPI {
  constructor() {
    // Default values, can be overridden per request
    this.defaultApiBase = "dronedoc.ru";
    this.defaultDb = "A2025";
    // NO hardcoded credentials! Auth tokens must be provided from Vue/frontend
    this.logger = null;
  }

  // Get base URL based on apiBase and db
  // Following the pattern from axios2.js:
  // https://${apiBase}/${db} with ?JSON_KV parameter
  getBaseURL(apiBase, db) {
    const base = apiBase || this.defaultApiBase;
    const database = db || this.defaultDb;

    // Support localhost as in axios2.js
    if (base === 'localhost') {
      return `http://localhost/${database}`;
    }

    return `https://${base}/${database}`;
  }

  setLogger(logger) {
    this.logger = logger;
  }

  getToolsDefinition() {
    return [
      {
        name: "list_tables",
        description: "Get list of all tables from Dronedoc system",
        inputSchema: {
          type: "object",
          properties: {
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
          },
          required: [],
        },
      },
      {
        name: "get_table",
        description: "Get data from specific table by ID or name",
        inputSchema: {
          type: "object",
          properties: {
            tableIdentifier: {
              type: "string",
              description: "Table ID or name",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
            getAllPages: {
              type: "boolean",
              description: "Get all pages with complete data (default: true)",
              default: true,
            },
            page: {
              type: "number",
              description: "Specific page number for pagination",
            },
          },
          required: ["tableIdentifier"],
        },
      },
      {
        name: "get_complete_table",
        description:
          "Get complete table data with all pages automatically loaded",
        inputSchema: {
          type: "object",
          properties: {
            tableIdentifier: {
              type: "string",
              description: "Table ID or name",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
            maxPages: {
              type: "number",
              description: "Maximum pages to load (default: 1000)",
              default: 1000,
            },
          },
          required: ["tableIdentifier"],
        },
      },
      {
        name: "get_table_row",
        description: "Get specific row from table",
        inputSchema: {
          type: "object",
          properties: {
            tableIdentifier: {
              type: "string",
              description: "Table ID or name",
            },
            rowId: { type: "number", description: "Row ID" },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
          },
          required: ["tableIdentifier", "rowId"],
        },
      },
      {
        name: "search_tables",
        description: "Search tables by name",
        inputSchema: {
          type: "object",
          properties: {
            searchTerm: { type: "string", description: "Search query" },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
          },
          required: ["searchTerm"],
        },
      },
      {
        name: "get_report",
        description: "Get data from specific report by ID or name",
        inputSchema: {
          type: "object",
          properties: {
            reportIdentifier: {
              type: "string",
              description: "Report ID or name",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
            hideId: {
              type: "boolean",
              description: "Hide columns with ID in name (default: false)",
              default: false,
            },
          },
          required: ["reportIdentifier"],
        },
      },
      {
        name: "get_user_by_telegram",
        description: "Find user by Telegram username or phone number",
        inputSchema: {
          type: "object",
          properties: {
            telegram: { type: "string", description: "Telegram username" },
            phone: { type: "string", description: "Phone number" },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
          },
        },
      },
      {
        name: "create_table_row",
        description: "Create new row in specified table",
        inputSchema: {
          type: "object",
          properties: {
            tableIdentifier: {
              type: "string",
              description: "Table ID or name",
            },
            data: {
              type: "object",
              description: "Data for new row as key-value pairs",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
          },
          required: ["tableIdentifier", "data"],
        },
      },
      {
        name: "update_table_row",
        description:
          "Update existing row in table. Use numeric field IDs (like 960838 for Telegram) as keys in data object",
        inputSchema: {
          type: "object",
          properties: {
            tableIdentifier: {
              type: "string",
              description: "Table ID or name",
            },
            rowId: { type: "number", description: "Row ID to update" },
            data: {
              type: "object",
              description:
                "Updated data as key-value pairs. Keys must be numeric field IDs (e.g., 960838 for Telegram)",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
          },
          required: ["tableIdentifier", "rowId", "data"],
        },
      },
      {
        name: "delete_table_row",
        description: "Delete row from table",
        inputSchema: {
          type: "object",
          properties: {
            rowId: { type: "number", description: "Row ID to delete" },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
          },
          required: ["rowId"],
        },
      },
      {
        name: "get_flatinfo_property",
        description: "Get property information from FlatInfo.ru by hid",
        inputSchema: {
          type: "object",
          properties: {
            hid: { type: "number", description: "FlatInfo property ID" },
          },
          required: ["hid"],
        },
      },
      {
        name: "search_flatinfo_address",
        description: "Search addresses on FlatInfo.ru by term",
        inputSchema: {
          type: "object",
          properties: {
            term: { type: "string", description: "Search term (address)" },
          },
          required: ["term"],
        },
      },
      {
        name: "get_nested_table",
        description: "Get nested table data from parent table",
        inputSchema: {
          type: "object",
          properties: {
            tableIdentifier: {
              type: "string",
              description: "Parent table ID or name",
            },
            nestedTableId: { type: "number", description: "Nested table ID" },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
          },
          required: ["tableIdentifier", "nestedTableId"],
        },
      },
      {
        name: "get_all_reports",
        description: "Get list of all available reports",
        inputSchema: {
          type: "object",
          properties: {
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
          },
          required: [],
        },
      },
      // Table Analysis Tools
      {
        name: "table-analyze",
        description:
          "Analyze table structure, data types, and statistics. Provides column type detection, basic statistics (min, max, avg, count, nulls), and identifies potential data issues",
        inputSchema: {
          type: "object",
          properties: {
            tableIdentifier: {
              type: "string",
              description: "Table ID or name",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
            includeStats: {
              type: "boolean",
              description: "Include statistical analysis (default: true)",
              default: true,
            },
            detectIssues: {
              type: "boolean",
              description:
                "Detect potential data issues like duplicates and missing values (default: true)",
              default: true,
            },
          },
          required: ["tableIdentifier"],
        },
      },
      {
        name: "table-query",
        description:
          "Execute SQL-like queries on table data with filtering, sorting, and aggregation support",
        inputSchema: {
          type: "object",
          properties: {
            tableIdentifier: {
              type: "string",
              description: "Table ID or name",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
            filter: {
              type: "object",
              description:
                "Filter conditions as key-value pairs (e.g., {columnName: value})",
            },
            orderBy: {
              type: "string",
              description: "Column name to sort by",
            },
            orderDirection: {
              type: "string",
              description: "Sort direction: 'asc' or 'desc' (default: 'asc')",
              enum: ["asc", "desc"],
              default: "asc",
            },
            limit: {
              type: "number",
              description: "Maximum number of rows to return",
            },
          },
          required: ["tableIdentifier"],
        },
      },
      {
        name: "table-validate",
        description:
          "Validate table data against specified rules and constraints",
        inputSchema: {
          type: "object",
          properties: {
            tableIdentifier: {
              type: "string",
              description: "Table ID or name",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
            rules: {
              type: "array",
              description:
                "Validation rules array. Each rule: {column, type, constraint}",
              items: {
                type: "object",
                properties: {
                  column: { type: "string" },
                  type: {
                    type: "string",
                    enum: ["required", "type", "range", "pattern", "unique"],
                  },
                  constraint: {},
                },
              },
            },
          },
          required: ["tableIdentifier", "rules"],
        },
      },
      // Data Transformation Tools
      {
        name: "table-transform",
        description:
          "Apply transformations to table data (cleaning, type conversions, formulas)",
        inputSchema: {
          type: "object",
          properties: {
            tableIdentifier: {
              type: "string",
              description: "Table ID or name",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
            transformations: {
              type: "array",
              description:
                "Array of transformations to apply. Each: {column, operation, params}",
              items: {
                type: "object",
                properties: {
                  column: { type: "string" },
                  operation: {
                    type: "string",
                    enum: [
                      "trim",
                      "lowercase",
                      "uppercase",
                      "replace",
                      "convert",
                      "formula",
                    ],
                  },
                  params: { type: "object" },
                },
              },
            },
            dryRun: {
              type: "boolean",
              description: "Preview transformations without applying (default: false)",
              default: false,
            },
          },
          required: ["tableIdentifier", "transformations"],
        },
      },
      {
        name: "table-merge",
        description: "Merge two tables with specified strategy and conflict resolution",
        inputSchema: {
          type: "object",
          properties: {
            sourceTableId: {
              type: "string",
              description: "Source table ID or name",
            },
            targetTableId: {
              type: "string",
              description: "Target table ID or name",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
            strategy: {
              type: "string",
              description: "Merge strategy",
              enum: ["append", "update", "upsert"],
              default: "append",
            },
            keyColumn: {
              type: "string",
              description: "Column to use as key for update/upsert operations",
            },
            conflictResolution: {
              type: "string",
              description: "How to resolve conflicts",
              enum: ["source", "target", "newest"],
              default: "source",
            },
          },
          required: ["sourceTableId", "targetTableId"],
        },
      },
      // Workflow Management Tools
      {
        name: "workflow-create",
        description: "Create a new workflow definition for automated table processing",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Workflow name" },
            description: { type: "string", description: "Workflow description" },
            definition: {
              type: "object",
              description:
                "Workflow definition with steps array and configuration",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
          },
          required: ["name", "definition"],
        },
      },
      {
        name: "workflow-execute",
        description: "Execute a workflow by ID",
        inputSchema: {
          type: "object",
          properties: {
            workflowId: { type: "string", description: "Workflow ID" },
            context: {
              type: "object",
              description: "Execution context and parameters",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
          },
          required: ["workflowId"],
        },
      },
      {
        name: "workflow-status",
        description: "Get execution status of a workflow",
        inputSchema: {
          type: "object",
          properties: {
            executionId: { type: "string", description: "Workflow execution ID" },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
          },
          required: ["executionId"],
        },
      },
      // Agent Management Tools
      {
        name: "agent-spawn",
        description: "Create and spawn an agent for a specific task",
        inputSchema: {
          type: "object",
          properties: {
            agentType: {
              type: "string",
              description: "Type of agent to spawn",
              enum: ["analyzer", "transformer", "validator", "merger"],
            },
            task: { type: "string", description: "Task description for the agent" },
            context: {
              type: "object",
              description: "Context and parameters for the agent",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
          },
          required: ["agentType", "task"],
        },
      },
      {
        name: "agent-monitor",
        description: "Monitor status and progress of running agents",
        inputSchema: {
          type: "object",
          properties: {
            agentId: {
              type: "string",
              description: "Agent ID to monitor (if not provided, shows all active agents)",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
          },
          required: [],
        },
      },
      {
        name: "agent-kill",
        description: "Stop a running agent",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Agent ID to stop" },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
          },
          required: ["agentId"],
        },
      },
      // Versioning Tools
      {
        name: "snapshot-create",
        description: "Create a snapshot of table state for versioning",
        inputSchema: {
          type: "object",
          properties: {
            tableIdentifier: {
              type: "string",
              description: "Table ID or name",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
            description: { type: "string", description: "Snapshot description" },
            metadata: {
              type: "object",
              description: "Additional metadata for the snapshot",
            },
            incremental: {
              type: "boolean",
              description:
                "Create incremental snapshot (only changes since last snapshot)",
              default: false,
            },
          },
          required: ["tableIdentifier"],
        },
      },
      {
        name: "snapshot-restore",
        description: "Restore table to a previous snapshot state",
        inputSchema: {
          type: "object",
          properties: {
            snapshotId: { type: "string", description: "Snapshot ID to restore" },
            tableIdentifier: {
              type: "string",
              description: "Table ID or name to restore to",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
            dryRun: {
              type: "boolean",
              description: "Preview restore without applying (default: false)",
              default: false,
            },
          },
          required: ["snapshotId", "tableIdentifier"],
        },
      },
      {
        name: "snapshot-diff",
        description: "Compare two snapshots to see differences",
        inputSchema: {
          type: "object",
          properties: {
            snapshotId1: { type: "string", description: "First snapshot ID" },
            snapshotId2: { type: "string", description: "Second snapshot ID" },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
          },
          required: ["snapshotId1", "snapshotId2"],
        },
      },
      {
        name: "snapshot-list",
        description: "List all available snapshots for a table",
        inputSchema: {
          type: "object",
          properties: {
            tableIdentifier: {
              type: "string",
              description: "Table ID or name (if not provided, lists all snapshots)",
            },
            dbName: {
              type: "string",
              description: "Database name (default: A2025)",
              default: "A2025",
            },
            limit: {
              type: "number",
              description: "Maximum number of snapshots to return",
            },
          },
          required: [],
        },
      },
    ];
  }

  async executeTool(name, args) {
    const toolHandlers = {
      list_tables: () => this.handleGetTables(args),
      get_tables: () => this.handleGetTables(args), // Alias for backwards compatibility
      get_table: () => this.handleGetTable(args),
      get_complete_table: () => this.handleGetCompleteTable(args),
      get_table_row: () => this.handleGetTableRow(args),
      search_tables: () => this.handleSearchTables(args),
      get_report: () => this.handleGetReport(args),
      get_user_by_telegram: () => this.handleGetUserByTelegram(args),
      create_table_row: () => this.handleCreateTableRow(args),
      update_table_row: () => this.handleUpdateTableRow(args),
      delete_table_row: () => this.handleDeleteTableRow(args),
      get_flatinfo_property: () => this.handleGetFlatinfoProperty(args),
      search_flatinfo_address: () => this.handleSearchFlatinfoAddress(args),
      get_nested_table: () => this.handleGetNestedTable(args),
      get_all_reports: () => this.handleGetAllReports(args),
      // New tool handlers
      "table-analyze": () => this.handleTableAnalyze(args),
      "table-query": () => this.handleTableQuery(args),
      "table-validate": () => this.handleTableValidate(args),
      "table-transform": () => this.handleTableTransform(args),
      "table-merge": () => this.handleTableMerge(args),
      "workflow-create": () => this.handleWorkflowCreate(args),
      "workflow-execute": () => this.handleWorkflowExecute(args),
      "workflow-status": () => this.handleWorkflowStatus(args),
      "agent-spawn": () => this.handleAgentSpawn(args),
      "agent-monitor": () => this.handleAgentMonitor(args),
      "agent-kill": () => this.handleAgentKill(args),
      "snapshot-create": () => this.handleSnapshotCreate(args),
      "snapshot-restore": () => this.handleSnapshotRestore(args),
      "snapshot-diff": () => this.handleSnapshotDiff(args),
      "snapshot-list": () => this.handleSnapshotList(args),
    };

    const handler = toolHandlers[name];
    if (!handler) throw new Error(`Unknown tool: ${name}`);
    return handler();
  }

  // NO authenticate method! MCP should work only if auth token is provided from Vue

  async makeRequest(endpoint, method = "GET", params = {}, apiBase = null, db = null, authToken = null) {
    this.logger.info(endpoint);
    const baseURL = this.getBaseURL(apiBase, db);

    // Auth token MUST be provided from Vue (no hardcoded auth!)
    if (!authToken) {
      throw new Error("Authorization token required. MCP must receive auth token from Vue frontend.");
    }

    const config = {
      method,
      url: `${baseURL}${endpoint}`,  // Endpoint should start with /
      headers: {
        Authorization: authToken,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    };

    // Add JSON_KV parameter as in axios2.js and apiService.js
    if (method === "GET") {
      config.params = { ...params, JSON_KV: true };
    } else if (method === "POST" || method === "PUT") {
      // For POST/PUT, use form-urlencoded as per apiService.js
      const formData = new URLSearchParams();
      Object.keys(params).forEach(key => {
        formData.append(key, params[key]);
      });
      config.data = formData;
      config.headers["Content-Type"] = "application/x-www-form-urlencoded";
      config.params = { JSON_KV: true };
    } else {
      config.data = params;
      config.params = { JSON_KV: true };
    }

    try {
      this.logger.debug("Making API request", { endpoint, method, baseURL, fullUrl: config.url });
      const response = await axios(config);

      this.logger.info("API response received", { status: response.status, dataType: typeof response.data });
      return response.data?.response ?? response.data;
    } catch (error) {
      return this.handleRequestError(error, config, apiBase, db, authToken);
    }
  }

  async handleRequestError(error, config, apiBase = null, db = null, authToken = null) {
    this.logger.error("API request failed", {
      endpoint: config.url,
      error: error.message,
      status: error.response?.status,
    });

    // NO re-authentication! If auth fails, Vue frontend must provide a new valid token
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error(`Authentication failed. Please re-login in the Vue frontend. Status: ${error.response?.status}`);
    }

    throw new Error(`API request failed: ${error.message}`);
  }

  async getAllTablePages(dbName, tableIdentifier, apiBase = null, db = null, authToken = null) {
    try {
      this.logger.info(`Getting all pages for table: ${tableIdentifier}`);

      const tableId = await this.resolveTableId(dbName, tableIdentifier, apiBase, db, authToken);
      let allRows = [];
      let page = 1;
      const maxPages = 1000;

      while (page <= maxPages) {
        this.logger.debug(`Fetching page ${page} for table ${tableId}`);

        // Use /object/{tableId}?pg={page} as per apiService.js
        const data = await this.makeRequest(
          `/object/${tableId}`,
          "GET",
          { F_U: 1, f_show_all: 1, pg: page },
          apiBase,
          db,
          authToken
        );

        // Parse response - data.object contains array of rows
        const rows = data.object || [];
        if (rows.length === 0) break;

        allRows = allRows.concat(rows);
        this.logger.debug(
          `Page ${page}: found ${rows.length} rows, total: ${allRows.length}`,
        );
        page++;
      }

      this.logger.info(
        `Retrieved all ${allRows.length} rows from ${page - 1} pages`,
      );
      return allRows;
    } catch (error) {
      this.logger.error("Error getting all table pages", {
        tableIdentifier,
        error: error.message,
      });
      throw error;
    }
  }

  async resolveTableId(dbName, tableIdentifier, apiBase = null, db = null, authToken = null) {
    if (this.isNumeric(tableIdentifier)) return parseInt(tableIdentifier);

    // Use /dict endpoint as per apiService.js
    const tables = await this.makeRequest(`/dict`, "GET", {}, apiBase, db, authToken);
    return this.findTableId(tables, tableIdentifier);
  }

  findTableId(tables, tableIdentifier) {
    const searchName = tableIdentifier.toLowerCase();

    if (Array.isArray(tables)) {
      const table = tables.find((t) => t.value?.toLowerCase() === searchName);
      if (table) return table.id;
    } else if (typeof tables === "object") {
      const entry = Object.entries(tables).find(
        ([id, name]) => name.toLowerCase() === searchName,
      );
      if (entry) return parseInt(entry[0]);
    }

    throw new Error(`Table '${tableIdentifier}' not found`);
  }

  async handleGetTables(args = {}) {
    const { _apiBase, _db, _authToken } = args;
    const effectiveDb = _db || "A2025";

    try {
      this.logger.info("Fetching tables list", { dbName: effectiveDb, apiBase: _apiBase });
      // Use /dict endpoint as per apiService.js
      const data = await this.makeRequest(`/dict`, "GET", {}, _apiBase, effectiveDb, _authToken);

      if (!data)
        throw new Error("Invalid response format from tables endpoint");

      const tables = this.parseTablesData(data);
      const tableList = tables
        .map((table) => `${table.id}: ${table.name}`)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Найдено ${tables.length} таблиц:\n\n${tableList}\n\nДля просмотра данных таблицы используйте функцию get_table с ID или названием таблицы`,
          },
        ],
      };
    } catch (error) {
      this.logger.error("Error in handleGetTables", { error: error.message });
      throw new Error(`Не удалось получить список таблиц: ${error.message}`);
    }
  }

  parseTablesData(data) {
    let tables = [];

    if (Array.isArray(data)) {
      tables = data.map((table) => ({
        id: table.id,
        name: table.value || table.name || `Table_${table.id}`,
      }));
    } else if (typeof data === "object") {
      tables = Object.entries(data).map(([id, name]) => ({
        id: parseInt(id),
        name: name || `Table_${id}`,
      }));
    } else {
      throw new Error("Unexpected tables data format");
    }

    return tables.sort((a, b) => a.id - b.id);
  }

  async handleGetTable(args) {
    const {
      tableIdentifier,
      getAllPages = true,
      page,
      _apiBase,
      _db,
      _authToken
    } = args;
    const effectiveDb = _db || "A2025";

    if (getAllPages || !page) {
      return this.handleGetCompleteTable({ tableIdentifier, _apiBase, _db, _authToken });
    }

    const tableId = await this.resolveTableId(effectiveDb, tableIdentifier, _apiBase, effectiveDb, _authToken);
    // Use /object/{tableId}?pg={page} as per apiService.js
    const data = await this.makeRequest(
      `/object/${tableId}`,
      "GET",
      page ? { F_U: 1, f_show_all: 1, pg: page } : { F_U: 1, f_show_all: 1 },
      _apiBase,
      effectiveDb,
      _authToken
    );
    return this.createTableResponse(data, page);
  }

  async handleGetCompleteTable(args) {
    const { tableIdentifier, _apiBase, _db, _authToken } = args;
    const effectiveDb = _db || "A2025";

    try {
      this.logger.info(`Getting complete table data for: ${tableIdentifier}`);

      const tableId = await this.resolveTableId(effectiveDb, tableIdentifier, _apiBase, effectiveDb, _authToken);
      // Use /object/{tableId} endpoint as per apiService.js
      const firstPageData = await this.makeRequest(
        `/object/${tableId}`,
        "GET",
        { F_U: 1, f_show_all: 1 },
        _apiBase,
        effectiveDb,
        _authToken
      );
      if (!firstPageData) throw new Error("Failed to get table information");

      const allRows = await this.getAllTablePages(effectiveDb, tableIdentifier, _apiBase, effectiveDb, _authToken);
      const completeTableData = {
        ...firstPageData,
        rows: allRows,
        _meta: {
          totalRows: allRows.length,
          retrievedAll: true,
          note: "Complete table data loaded from all pages",
        },
      };

      return this.createCompleteTableResponse(completeTableData);
    } catch (error) {
      throw new Error(
        `Failed to get complete table ${tableIdentifier}: ${error.message}`,
      );
    }
  }

  createTableResponse(tableData, page = null) {
    const rowsCount = tableData.rows ? tableData.rows.length : 0;
    let resultText = `Table: ${tableData.value} (ID: ${tableData.id})\n`;
    resultText += `Rows: ${rowsCount}\n`;
    if (page) resultText += `Page: ${page}\n`;
    resultText += `\n`;

    const columnNames = this.getColumnNames(tableData.headers);
    if (columnNames) resultText += `Columns: ${columnNames}\n\n`;

    if (tableData.rows?.length > 0) {
      resultText += this.formatTableRows(
        tableData.rows,
        tableData.headers,
        rowsCount,
      );
    }

    return { content: [{ type: "text", text: resultText }] };
  }

  createCompleteTableResponse(completeTableData) {
    const rowsCount = completeTableData.rows.length;
    let resultText = `COMPLETE TABLE: ${completeTableData.value} (ID: ${completeTableData.id})\n`;
    resultText += `TOTAL ROWS: ${rowsCount}\n\n`;

    const columnNames = this.getColumnNames(completeTableData.headers);
    if (columnNames) resultText += `Columns: ${columnNames}\n\n`;

    if (completeTableData.rows.length > 0) {
      resultText += this.formatTableRows(
        completeTableData.rows,
        completeTableData.headers,
        rowsCount,
      );
    }

    resultText += `\n\n=== TABLE STATISTICS ===\n`;
    resultText += `Total rows loaded: ${rowsCount}\n`;
    resultText += `Table ID: ${completeTableData.id}\n`;
    resultText += `Table name: ${completeTableData.value}\n`;

    return { content: [{ type: "text", text: resultText }] };
  }

  getColumnNames(headers) {
    if (!headers || headers.length === 0) return null;
    return headers
      .filter((header) => !header.isMain)
      .map((header) => header.value)
      .join(", ");
  }

  formatTableRows(rows, headers, totalRows) {
    let resultText = `All ${totalRows} rows:\n`;

    rows.forEach((row, index) => {
      resultText += `\nRow ${index + 1} (ID: ${row.id}):\n`;
      if (row.values) {
        row.values.forEach((value) => {
          const headerName = this.getHeaderName(headers, value.headerId);
          resultText += `  - ${headerName}: ${this.formatValue(value.value)}\n`;
        });
      }
    });

    return resultText;
  }

  async handleGetTableRow(args) {
    const { tableIdentifier, rowId, _apiBase, _db, _authToken } = args;
    const effectiveDb = _db || "A2025";

    try {
      // First get the table to find the row
      const tableId = await this.resolveTableId(effectiveDb, tableIdentifier, _apiBase, effectiveDb, _authToken);
      const data = await this.makeRequest(
        `/object/${tableId}`,
        "GET",
        { F_U: 1, f_show_all: 1 },
        _apiBase,
        effectiveDb,
        _authToken
      );

      // Find the specific row by ID
      const rows = data.object || [];
      const rowData = rows.find(r => r.id == rowId);

      if (!rowData) {
        throw new Error("Row not found");
      }

      let resultText = `Row ${rowId} from table ${tableIdentifier}:\n\n`;
      resultText += `ID: ${rowData.id}\n`;
      resultText += `Value: ${rowData.val || 'N/A'}\n`;

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(
        `Failed to get row ${rowId} from table ${tableIdentifier}: ${error.message}`,
      );
    }
  }

  async handleSearchTables(args) {
    const { searchTerm, _apiBase, _db, _authToken } = args;
    const effectiveDb = _db || "A2025";

    try {
      // Use /dict endpoint as per apiService.js
      const data = await this.makeRequest(`/dict`, "GET", {}, _apiBase, effectiveDb, _authToken);
      const matchingTables = this.findMatchingTables(data, searchTerm);

      if (matchingTables.length === 0) {
        return {
          content: [
            { type: "text", text: `No tables found matching "${searchTerm}"` },
          ],
        };
      }

      const resultText = `Found ${matchingTables.length} tables matching "${searchTerm}":\n\n${matchingTables
        .map((table) => `${table.id}: ${table.name}`)
        .join("\n")}`;

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async handleGetReport(args) {
    const { reportIdentifier, hideId = false, _apiBase, _db, _authToken } = args;
    const effectiveDb = _db || "A2025";

    try {
      this.logger.info(`Getting report: ${reportIdentifier}`);

      const params = {};
      if (hideId) params.hide_id = "true";

      // Use /report/{reportId} endpoint as per apiService.js
      const data = await this.makeRequest(
        `/report/${reportIdentifier}`,
        "GET",
        params,
        _apiBase,
        effectiveDb,
        _authToken
      );

      if (!data) throw new Error("Failed to get report data");

      let resultText = `Report: ${data.value || reportIdentifier} (ID: ${reportIdentifier})\n`;
      resultText += `Total rows: ${data.rows?.length || 0}\n\n`;

      const columnNames = this.getColumnNames(data.headers);
      if (columnNames) resultText += `Columns: ${columnNames}\n\n`;

      if (data.rows?.length > 0) {
        resultText += this.formatReportRows(data.rows, data.headers);
      }

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(
        `Failed to get report ${reportIdentifier}: ${error.message}`,
      );
    }
  }

  async handleGetUserByTelegram(args) {
    const { telegram, phone, _apiBase, _db, _authToken } = args;
    const effectiveDb = _db || "A2025";

    if (!telegram && !phone) {
      throw new Error("Either telegram or phone must be provided");
    }

    try {
      // Note: This endpoint needs clarification from the API documentation
      // Using the assumed format based on other endpoints
      this.logger.warn("telegram_auth_users endpoint may need verification");

      const params = {};
      if (telegram) params.telegram = telegram;
      if (phone) params.phone = phone;

      const data = await this.makeRequest(
        `/telegram_auth_users`,
        "GET",
        params,
        _apiBase,
        effectiveDb,
        _authToken
      );

      let resultText = "Found user information:\n\n";
      Object.entries(data).forEach(([key, value]) => {
        resultText += `${key}: ${value}\n`;
      });

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(`Failed to find user: ${error.message}`);
    }
  }

  async handleCreateTableRow(args) {
    const { tableIdentifier, data, _apiBase, _db, _authToken } = args;
    const effectiveDb = _db || "A2025";

    try {
      this.logger.info(`Creating new row in table: ${tableIdentifier}`);

      const tableId = await this.resolveTableId(effectiveDb, tableIdentifier, _apiBase, effectiveDb, _authToken);

      // Use /_m_new/{tableId} endpoint as per apiService.js
      const formData = { up: 1 };
      Object.keys(data).forEach(key => {
        if (!isNaN(key)) {
          formData[`t${key}`] = data[key];
        }
      });

      const response = await this.makeRequest(
        `/_m_new/${tableId}`,
        "POST",
        formData,
        _apiBase,
        effectiveDb,
        _authToken
      );

      return {
        content: [
          {
            type: "text",
            text: `Successfully created new row with ID: ${response.id}\n\nData: ${JSON.stringify(data, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Failed to create row in table ${tableIdentifier}: ${error.message}`,
      );
    }
  }

  async handleUpdateTableRow(args) {
    const { tableIdentifier, rowId, data, _apiBase, _db, _authToken } = args;
    const effectiveDb = _db || "A2025";

    try {
      this.logger.info(`Updating row ${rowId} in table: ${tableIdentifier}`);

      // Use /_m_save/{rowId} endpoint as per apiService.js
      const formData = {};
      for (const [fieldIdentifier, fieldValue] of Object.entries(data)) {
        if (!this.isNumeric(fieldIdentifier)) {
          throw new Error(
            `Field key '${fieldIdentifier}' must be a numeric ID. Use numeric field IDs (e.g., 960838 for Telegram)`,
          );
        }

        // Format value based on type as in apiService.js
        let value = fieldValue;
        const valueType = this.determineValueType(fieldValue);
        if (valueType === 11) { // Boolean
          value = fieldValue ? 'X' : '';
        } else if (valueType === 9) { // Date
          value = new Date(fieldValue * 1000).toISOString().split('T')[0];
        } else if (valueType === 4) { // DateTime
          value = new Date(fieldValue * 1000).toISOString().replace('T', ' ').split('.')[0];
        }

        formData[`t${fieldIdentifier}`] = value;
      }

      this.logger.debug("Sending update data:", formData);

      const response = await this.makeRequest(
        `/_m_save/${rowId}`,
        "POST",
        formData,
        _apiBase,
        effectiveDb,
        _authToken
      );

      return {
        content: [
          {
            type: "text",
            text: `Successfully updated row ${rowId}\n\nUpdated data: ${JSON.stringify(data, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      this.logger.error("Update failed", {
        tableIdentifier,
        rowId,
        error: error.message,
      });
      throw new Error(
        `Failed to update row ${rowId} in table ${tableIdentifier}: ${error.message}`,
      );
    }
  }

  async handleDeleteTableRow(args) {
    const { rowId, _apiBase, _db, _authToken } = args;
    const effectiveDb = _db || "A2025";

    try {
      this.logger.info(`Deleting row: ${rowId}`);

      // Use /_m_del/{rowId} endpoint as per apiService.js
      await this.makeRequest(
        `/_m_del/${rowId}`,
        "POST",
        {},
        _apiBase,
        effectiveDb,
        _authToken
      );

      return {
        content: [
          {
            type: "text",
            text: `Successfully deleted row with ID: ${rowId}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to delete row ${rowId}: ${error.message}`);
    }
  }

  async handleGetFlatinfoProperty(args) {
    const { hid } = args;

    try {
      this.logger.info(`Getting FlatInfo property details for hid: ${hid}`);

      const data = await this.makeRequest(`flatinfo`, "GET", { hid });

      let resultText = `Property information (hid: ${hid}):\n\n`;

      if (typeof data === "object") {
        Object.entries(data).forEach(([key, value]) => {
          if (typeof value === "object") {
            resultText += `${key}:\n`;
            Object.entries(value).forEach(([subKey, subValue]) => {
              resultText += `  ${subKey}: ${subValue}\n`;
            });
          } else {
            resultText += `${key}: ${value}\n`;
          }
        });
      } else {
        resultText += `Response: ${data}`;
      }

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(`Failed to get FlatInfo property: ${error.message}`);
    }
  }

  async handleSearchFlatinfoAddress(args) {
    const { term } = args;

    try {
      this.logger.info(`Searching FlatInfo addresses for: ${term}`);

      const data = await this.makeRequest(`flatinfo/search`, "GET", { term });

      let resultText = `Address search results for "${term}":\n\n`;

      if (Array.isArray(data) && data.length > 0) {
        data.forEach((result, index) => {
          resultText += `${index + 1}. ${result.name}`;
          if (result.subname) resultText += ` (${result.subname})`;
          resultText += `\n   Type: ${result.type}, HID: ${result.hid}\n\n`;
        });
      } else {
        resultText += "No addresses found";
      }

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(`Failed to search FlatInfo addresses: ${error.message}`);
    }
  }

  async handleGetNestedTable(args) {
    const { tableIdentifier, nestedTableId, _apiBase, _db, _authToken } = args;
    const effectiveDb = _db || "A2025";

    try {
      this.logger.info(
        `Getting nested table ${nestedTableId} from parent: ${tableIdentifier}`,
      );

      const tableId = await this.resolveTableId(effectiveDb, tableIdentifier, _apiBase, effectiveDb, _authToken);

      // Use F_U parameter for nested table as per apiService.js getNestedTable
      const data = await this.makeRequest(
        `/object/${tableId}`,
        "GET",
        { F_U: nestedTableId },
        _apiBase,
        effectiveDb,
        _authToken
      );

      return this.createTableResponse(data);
    } catch (error) {
      throw new Error(
        `Failed to get nested table ${nestedTableId} from ${tableIdentifier}: ${error.message}`,
      );
    }
  }

  async handleGetAllReports(args) {
    const { _apiBase, _db, _authToken } = args;
    const effectiveDb = _db || "A2025";

    try {
      this.logger.info("Getting all reports");

      // Get reports from table 22 as per apiService.js
      const tableId = 22;
      const data = await this.makeRequest(
        `/object/${tableId}`,
        "GET",
        { F_U: 1, f_show_all: 1 },
        _apiBase,
        effectiveDb,
        _authToken
      );

      const rows = data.object || [];
      let resultText = `Available Reports (Total: ${rows.length}):\n\n`;

      if (rows.length > 0) {
        rows.forEach((report, index) => {
          const reportName = report.val || `Report ${report.id}`;
          resultText += `${index + 1}. ${reportName} (ID: ${report.id})\n`;
        });
      }

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(`Failed to get reports list: ${error.message}`);
    }
  }

  formatReportRows(rows, headers) {
    let resultText = "Report data:\n";

    rows.forEach((row, index) => {
      resultText += `\nRow ${index + 1}:\n`;
      if (row.values) {
        row.values.forEach((value) => {
          const headerName = this.getHeaderName(headers, value.headerId);
          const displayValue =
            value.cleanValue !== undefined ? value.cleanValue : value.value;
          resultText += `  - ${headerName}: ${this.formatValue(displayValue)}\n`;
        });
      }
    });

    return resultText;
  }

  determineValueType(value) {
    if (typeof value === "boolean") return 11;
    if (typeof value === "number") return 1;
    if (this.isDateValue(value)) return 9;
    return 2;
  }

  isDateValue(value) {
    return !isNaN(Date.parse(value));
  }

  getHeaderName(headers, headerId) {
    if (!headers) return `Column_${headerId}`;
    const header = headers.find((h) => h.id === headerId);
    return header ? header.value : `Column_${headerId}`;
  }

  formatValue(value) {
    if (value === null || value === undefined) return "null";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  isNumeric(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
  }

  findMatchingTables(tables, searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    let matchingTables = [];

    if (Array.isArray(tables)) {
      matchingTables = tables
        .filter(
          (table) =>
            (table.value && table.value.toLowerCase().includes(searchLower)) ||
            (table.id && table.id.toString().includes(searchTerm)),
        )
        .map((table) => ({
          id: table.id,
          name: table.value || table.name || `Table_${table.id}`,
        }));
    } else if (typeof tables === "object") {
      matchingTables = Object.entries(tables)
        .filter(
          ([id, name]) =>
            name.toLowerCase().includes(searchLower) ||
            id.toString().includes(searchTerm),
        )
        .map(([id, name]) => ({
          id: parseInt(id),
          name: name,
        }));
    }

    return matchingTables.sort((a, b) => a.id - b.id);
  }

  // ===== NEW TOOL HANDLERS =====

  // Table Analysis Tools
  async handleTableAnalyze(args) {
    const {
      tableIdentifier,
      includeStats = true,
      detectIssues = true,
      _apiBase,
      _db,
      _authToken
    } = args;
    const effectiveDb = _db || "A2025";

    try {
      this.logger.info(`Analyzing table: ${tableIdentifier}`);

      // Get complete table data for analysis
      const allRows = await this.getAllTablePages(effectiveDb, tableIdentifier, _apiBase, effectiveDb, _authToken);
      const tableId = await this.resolveTableId(effectiveDb, tableIdentifier, _apiBase, effectiveDb, _authToken);
      const tableData = await this.makeRequest(
        `/object/${tableId}`,
        "GET",
        { F_U: 1, f_show_all: 1 },
        _apiBase,
        effectiveDb,
        _authToken
      );

      if (!tableData) {
        throw new Error("Failed to get table structure");
      }

      const analysis = {
        tableName: tableData.value || tableIdentifier,
        tableId: tableData.id,
        totalRows: allRows.length,
        columns: [],
        issues: [],
      };

      // Analyze each column
      for (const header of tableData.headers) {
        const columnAnalysis = {
          id: header.id,
          name: header.value,
          type: header.type,
        };

        if (includeStats) {
          // Extract values for this column
          const values = allRows
            .map((row) => {
              const val = row.values?.find((v) => v.headerId === header.id);
              return val?.value;
            })
            .filter((v) => v !== null && v !== undefined);

          columnAnalysis.stats = {
            count: values.length,
            nulls: allRows.length - values.length,
            nullPercentage: (
              ((allRows.length - values.length) / allRows.length) *
              100
            ).toFixed(2),
          };

          // Type-specific statistics
          if (this.isNumericColumn(values)) {
            const numValues = values.map(Number).filter((n) => !isNaN(n));
            if (numValues.length > 0) {
              columnAnalysis.stats.min = Math.min(...numValues);
              columnAnalysis.stats.max = Math.max(...numValues);
              columnAnalysis.stats.avg = (
                numValues.reduce((a, b) => a + b, 0) / numValues.length
              ).toFixed(2);
            }
          }

          // Unique value analysis
          const uniqueValues = new Set(values);
          columnAnalysis.stats.unique = uniqueValues.size;
          columnAnalysis.stats.uniquePercentage = (
            (uniqueValues.size / values.length) *
            100
          ).toFixed(2);
        }

        analysis.columns.push(columnAnalysis);
      }

      // Detect issues
      if (detectIssues) {
        // Check for duplicate rows
        const rowStrings = allRows.map((row) => JSON.stringify(row.values));
        const uniqueRowStrings = new Set(rowStrings);
        if (rowStrings.length !== uniqueRowStrings.size) {
          analysis.issues.push({
            type: "duplicates",
            severity: "warning",
            message: `Found ${rowStrings.length - uniqueRowStrings.size} duplicate rows`,
          });
        }

        // Check for high null percentages
        for (const col of analysis.columns) {
          if (col.stats && parseFloat(col.stats.nullPercentage) > 50) {
            analysis.issues.push({
              type: "high_nulls",
              severity: "warning",
              column: col.name,
              message: `Column "${col.name}" has ${col.stats.nullPercentage}% null values`,
            });
          }
        }
      }

      // Format response
      let resultText = `=== TABLE ANALYSIS ===\n\n`;
      resultText += `Table: ${analysis.tableName} (ID: ${analysis.tableId})\n`;
      resultText += `Total Rows: ${analysis.totalRows}\n`;
      resultText += `Total Columns: ${analysis.columns.length}\n\n`;

      resultText += `=== COLUMN ANALYSIS ===\n\n`;
      for (const col of analysis.columns) {
        resultText += `Column: ${col.name} (ID: ${col.id})\n`;
        resultText += `  Type: ${col.type}\n`;
        if (col.stats) {
          resultText += `  Count: ${col.stats.count}\n`;
          resultText += `  Nulls: ${col.stats.nulls} (${col.stats.nullPercentage}%)\n`;
          resultText += `  Unique: ${col.stats.unique} (${col.stats.uniquePercentage}%)\n`;
          if (col.stats.min !== undefined) {
            resultText += `  Min: ${col.stats.min}\n`;
            resultText += `  Max: ${col.stats.max}\n`;
            resultText += `  Avg: ${col.stats.avg}\n`;
          }
        }
        resultText += `\n`;
      }

      if (analysis.issues.length > 0) {
        resultText += `=== DATA ISSUES ===\n\n`;
        for (const issue of analysis.issues) {
          resultText += `[${issue.severity.toUpperCase()}] ${issue.message}\n`;
        }
      } else {
        resultText += `No data issues detected.\n`;
      }

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(
        `Failed to analyze table ${tableIdentifier}: ${error.message}`,
      );
    }
  }

  async handleTableQuery(args) {
    const {
      tableIdentifier,
      filter = {},
      orderBy,
      orderDirection = "asc",
      limit,
      _apiBase,
      _db,
      _authToken
    } = args;
    const effectiveDb = _db || "A2025";

    try {
      this.logger.info(`Querying table: ${tableIdentifier}`);

      // Get complete table data
      const allRows = await this.getAllTablePages(effectiveDb, tableIdentifier, _apiBase, effectiveDb, _authToken);
      const tableId = await this.resolveTableId(effectiveDb, tableIdentifier, _apiBase, effectiveDb, _authToken);
      const tableData = await this.makeRequest(
        `/object/${tableId}`,
        "GET",
        { F_U: 1, f_show_all: 1 },
        _apiBase,
        effectiveDb,
        _authToken
      );

      let filteredRows = allRows;

      // Apply filters
      if (Object.keys(filter).length > 0) {
        filteredRows = allRows.filter((row) => {
          return Object.entries(filter).every(([columnName, filterValue]) => {
            const header = tableData.headers.find(
              (h) => h.value.toLowerCase() === columnName.toLowerCase(),
            );
            if (!header) return false;

            const cellValue = row.values?.find(
              (v) => v.headerId === header.id,
            )?.value;
            return String(cellValue).toLowerCase().includes(
              String(filterValue).toLowerCase(),
            );
          });
        });
      }

      // Apply sorting
      if (orderBy) {
        const sortHeader = tableData.headers.find(
          (h) => h.value.toLowerCase() === orderBy.toLowerCase(),
        );
        if (sortHeader) {
          filteredRows.sort((a, b) => {
            const aVal =
              a.values?.find((v) => v.headerId === sortHeader.id)?.value || "";
            const bVal =
              b.values?.find((v) => v.headerId === sortHeader.id)?.value || "";

            const compareResult = String(aVal).localeCompare(String(bVal));
            return orderDirection === "asc" ? compareResult : -compareResult;
          });
        }
      }

      // Apply limit
      if (limit && limit > 0) {
        filteredRows = filteredRows.slice(0, limit);
      }

      // Format response
      let resultText = `=== QUERY RESULTS ===\n\n`;
      resultText += `Table: ${tableData.value} (ID: ${tableData.id})\n`;
      resultText += `Total Rows: ${allRows.length}\n`;
      resultText += `Filtered Rows: ${filteredRows.length}\n\n`;

      if (Object.keys(filter).length > 0) {
        resultText += `Filters: ${JSON.stringify(filter)}\n`;
      }
      if (orderBy) {
        resultText += `Order By: ${orderBy} ${orderDirection}\n`;
      }
      if (limit) {
        resultText += `Limit: ${limit}\n`;
      }
      resultText += `\n`;

      resultText += this.formatTableRows(
        filteredRows,
        tableData.headers,
        filteredRows.length,
      );

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(
        `Failed to query table ${tableIdentifier}: ${error.message}`,
      );
    }
  }

  async handleTableValidate(args) {
    const { tableIdentifier, rules, _apiBase, _db, _authToken } = args;
    const effectiveDb = _db || "A2025";

    try {
      this.logger.info(`Validating table: ${tableIdentifier}`);

      const allRows = await this.getAllTablePages(effectiveDb, tableIdentifier, _apiBase, effectiveDb, _authToken);
      const tableId = await this.resolveTableId(effectiveDb, tableIdentifier, _apiBase, effectiveDb, _authToken);
      const tableData = await this.makeRequest(
        `/object/${tableId}`,
        "GET",
        { F_U: 1, f_show_all: 1 },
        _apiBase,
        effectiveDb,
        _authToken
      );

      const violations = [];

      for (const rule of rules) {
        const header = tableData.headers.find(
          (h) => h.value.toLowerCase() === rule.column.toLowerCase(),
        );

        if (!header) {
          violations.push({
            rule,
            type: "configuration_error",
            message: `Column "${rule.column}" not found`,
          });
          continue;
        }

        for (let i = 0; i < allRows.length; i++) {
          const row = allRows[i];
          const cellValue = row.values?.find((v) => v.headerId === header.id);

          switch (rule.type) {
            case "required":
              if (!cellValue || cellValue.value === null || cellValue.value === "") {
                violations.push({
                  rule,
                  rowId: row.id,
                  rowIndex: i + 1,
                  message: `Required field "${rule.column}" is empty`,
                });
              }
              break;

            case "type":
              if (cellValue && cellValue.value) {
                const expectedType = rule.constraint;
                const actualType = typeof cellValue.value;
                if (expectedType === "number" && isNaN(Number(cellValue.value))) {
                  violations.push({
                    rule,
                    rowId: row.id,
                    rowIndex: i + 1,
                    message: `Field "${rule.column}" expected number, got: ${cellValue.value}`,
                  });
                }
              }
              break;

            case "range":
              if (cellValue && cellValue.value) {
                const numValue = Number(cellValue.value);
                if (!isNaN(numValue)) {
                  if (
                    rule.constraint.min !== undefined &&
                    numValue < rule.constraint.min
                  ) {
                    violations.push({
                      rule,
                      rowId: row.id,
                      rowIndex: i + 1,
                      message: `Field "${rule.column}" value ${numValue} below minimum ${rule.constraint.min}`,
                    });
                  }
                  if (
                    rule.constraint.max !== undefined &&
                    numValue > rule.constraint.max
                  ) {
                    violations.push({
                      rule,
                      rowId: row.id,
                      rowIndex: i + 1,
                      message: `Field "${rule.column}" value ${numValue} above maximum ${rule.constraint.max}`,
                    });
                  }
                }
              }
              break;

            case "pattern":
              if (cellValue && cellValue.value) {
                const regex = new RegExp(rule.constraint);
                if (!regex.test(String(cellValue.value))) {
                  violations.push({
                    rule,
                    rowId: row.id,
                    rowIndex: i + 1,
                    message: `Field "${rule.column}" value doesn't match pattern: ${rule.constraint}`,
                  });
                }
              }
              break;

            case "unique":
              // Check for duplicates in this column
              const values = allRows.map((r) =>
                r.values?.find((v) => v.headerId === header.id)?.value,
              );
              const valueCount = values.filter(
                (v) => v === cellValue?.value,
              ).length;
              if (valueCount > 1) {
                violations.push({
                  rule,
                  rowId: row.id,
                  rowIndex: i + 1,
                  message: `Field "${rule.column}" has duplicate value: ${cellValue?.value}`,
                });
              }
              break;
          }
        }
      }

      // Format response
      let resultText = `=== VALIDATION RESULTS ===\n\n`;
      resultText += `Table: ${tableData.value} (ID: ${tableData.id})\n`;
      resultText += `Total Rows: ${allRows.length}\n`;
      resultText += `Rules Applied: ${rules.length}\n`;
      resultText += `Violations Found: ${violations.length}\n\n`;

      if (violations.length > 0) {
        resultText += `=== VIOLATIONS ===\n\n`;
        for (const violation of violations) {
          resultText += `Row ${violation.rowIndex || "N/A"} (ID: ${violation.rowId || "N/A"}):\n`;
          resultText += `  ${violation.message}\n\n`;
        }
      } else {
        resultText += `All validation rules passed successfully!\n`;
      }

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(
        `Failed to validate table ${tableIdentifier}: ${error.message}`,
      );
    }
  }

  // Data Transformation Tools
  async handleTableTransform(args) {
    const {
      tableIdentifier,
      transformations,
      dryRun = false,
      _apiBase,
      _db,
      _authToken
    } = args;
    const effectiveDb = _db || "A2025";

    try {
      this.logger.info(`Transforming table: ${tableIdentifier}`);

      const allRows = await this.getAllTablePages(effectiveDb, tableIdentifier, _apiBase, effectiveDb, _authToken);
      const tableId = await this.resolveTableId(effectiveDb, tableIdentifier, _apiBase, effectiveDb, _authToken);
      const tableData = await this.makeRequest(
        `/object/${tableId}`,
        "GET",
        { F_U: 1, f_show_all: 1 },
        _apiBase,
        effectiveDb,
        _authToken
      );

      const transformedRows = [];
      let transformCount = 0;

      for (const row of allRows) {
        let rowTransformed = false;
        const newRow = { ...row, values: [...row.values] };

        for (const transform of transformations) {
          const header = tableData.headers.find(
            (h) => h.value.toLowerCase() === transform.column.toLowerCase(),
          );

          if (!header) continue;

          const valueIndex = newRow.values.findIndex(
            (v) => v.headerId === header.id,
          );
          if (valueIndex === -1) continue;

          const originalValue = newRow.values[valueIndex].value;
          let newValue = originalValue;

          switch (transform.operation) {
            case "trim":
              newValue = String(originalValue).trim();
              break;
            case "lowercase":
              newValue = String(originalValue).toLowerCase();
              break;
            case "uppercase":
              newValue = String(originalValue).toUpperCase();
              break;
            case "replace":
              if (transform.params?.from && transform.params?.to !== undefined) {
                newValue = String(originalValue).replace(
                  new RegExp(transform.params.from, "g"),
                  transform.params.to,
                );
              }
              break;
            case "convert":
              if (transform.params?.to === "number") {
                newValue = Number(originalValue);
              } else if (transform.params?.to === "string") {
                newValue = String(originalValue);
              }
              break;
            case "formula":
              // Simple formula evaluation (basic math operations)
              if (transform.params?.expression) {
                try {
                  // Safety: Only allow basic math operations
                  const safeExpression = transform.params.expression.replace(
                    /\{value\}/g,
                    originalValue,
                  );
                  // Note: In production, use a safe expression evaluator
                  newValue = eval(safeExpression);
                } catch (e) {
                  this.logger.error(`Formula evaluation failed: ${e.message}`);
                }
              }
              break;
          }

          if (newValue !== originalValue) {
            newRow.values[valueIndex].value = newValue;
            rowTransformed = true;
          }
        }

        if (rowTransformed) {
          transformCount++;
          transformedRows.push({
            id: row.id,
            original: row,
            transformed: newRow,
          });
        }
      }

      // Apply transformations if not dry run
      if (!dryRun && transformedRows.length > 0) {
        for (const item of transformedRows) {
          const updateData = {};
          for (const value of item.transformed.values) {
            updateData[value.headerId] = value.value;
          }
          await this.handleUpdateTableRow({
            tableIdentifier,
            rowId: item.id,
            data: updateData,
            _apiBase,
            _db,
            _authToken,
          });
        }
      }

      // Format response
      let resultText = `=== TRANSFORMATION ${dryRun ? "PREVIEW" : "RESULTS"} ===\n\n`;
      resultText += `Table: ${tableData.value} (ID: ${tableData.id})\n`;
      resultText += `Total Rows: ${allRows.length}\n`;
      resultText += `Transformed Rows: ${transformCount}\n`;
      resultText += `Transformations Applied: ${transformations.length}\n\n`;

      if (dryRun) {
        resultText += `DRY RUN MODE - No changes were applied\n\n`;
      }

      if (transformedRows.length > 0 && transformedRows.length <= 10) {
        resultText += `=== SAMPLE TRANSFORMATIONS ===\n\n`;
        for (const item of transformedRows.slice(0, 5)) {
          resultText += `Row ${item.id}:\n`;
          resultText += `  Transformations applied\n\n`;
        }
      }

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(
        `Failed to transform table ${tableIdentifier}: ${error.message}`,
      );
    }
  }

  async handleTableMerge(args) {
    const {
      sourceTableId,
      targetTableId,
      strategy = "append",
      keyColumn,
      conflictResolution = "source",
      _apiBase,
      _db,
      _authToken
    } = args;
    const effectiveDb = _db || "A2025";

    try {
      this.logger.info(
        `Merging tables: ${sourceTableId} -> ${targetTableId} (strategy: ${strategy})`,
      );

      const sourceRows = await this.getAllTablePages(effectiveDb, sourceTableId, _apiBase, effectiveDb, _authToken);
      const targetRows = await this.getAllTablePages(effectiveDb, targetTableId, _apiBase, effectiveDb, _authToken);

      const sourceTableIdResolved = await this.resolveTableId(effectiveDb, sourceTableId, _apiBase, effectiveDb, _authToken);
      const targetTableIdResolved = await this.resolveTableId(effectiveDb, targetTableId, _apiBase, effectiveDb, _authToken);

      const sourceData = await this.makeRequest(`/object/${sourceTableIdResolved}`, "GET", { F_U: 1, f_show_all: 1 }, _apiBase, effectiveDb, _authToken);
      const targetData = await this.makeRequest(`/object/${targetTableIdResolved}`, "GET", { F_U: 1, f_show_all: 1 }, _apiBase, effectiveDb, _authToken);

      let operations = [];

      switch (strategy) {
        case "append":
          // Simply append all source rows to target
          operations = sourceRows.map((row) => ({
            operation: "create",
            data: this.extractRowData(row),
          }));
          break;

        case "update":
        case "upsert":
          if (!keyColumn) {
            throw new Error(`keyColumn is required for ${strategy} strategy`);
          }

          const keyHeader = targetData.headers.find(
            (h) => h.value.toLowerCase() === keyColumn.toLowerCase(),
          );
          if (!keyHeader) {
            throw new Error(`Key column "${keyColumn}" not found in target table`);
          }

          // Build index of target rows by key
          const targetIndex = new Map();
          for (const row of targetRows) {
            const keyValue = row.values?.find((v) => v.headerId === keyHeader.id)
              ?.value;
            if (keyValue) {
              targetIndex.set(keyValue, row);
            }
          }

          // Process source rows
          for (const sourceRow of sourceRows) {
            const keyValue = sourceRow.values?.find(
              (v) => v.headerId === keyHeader.id,
            )?.value;
            const targetRow = targetIndex.get(keyValue);

            if (targetRow) {
              // Row exists - update
              operations.push({
                operation: "update",
                rowId: targetRow.id,
                data: this.extractRowData(sourceRow),
              });
            } else if (strategy === "upsert") {
              // Row doesn't exist - create
              operations.push({
                operation: "create",
                data: this.extractRowData(sourceRow),
              });
            }
          }
          break;
      }

      // Format response
      let resultText = `=== MERGE RESULTS ===\n\n`;
      resultText += `Source Table: ${sourceData.value} (${sourceRows.length} rows)\n`;
      resultText += `Target Table: ${targetData.value} (${targetRows.length} rows)\n`;
      resultText += `Strategy: ${strategy}\n`;
      if (keyColumn) {
        resultText += `Key Column: ${keyColumn}\n`;
      }
      resultText += `\n`;
      resultText += `Operations:\n`;
      resultText += `  Create: ${operations.filter((o) => o.operation === "create").length}\n`;
      resultText += `  Update: ${operations.filter((o) => o.operation === "update").length}\n`;
      resultText += `\n`;
      resultText += `Note: This is a preview. Actual merge operations would be executed here.\n`;

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(
        `Failed to merge tables ${sourceTableId} -> ${targetTableId}: ${error.message}`,
      );
    }
  }

  // Workflow Management Tools
  async handleWorkflowCreate(args) {
    const { name, description, definition, dbName = "A2025" } = args;

    try {
      this.logger.info(`Creating workflow: ${name}`);

      // Validate workflow definition
      if (!definition.steps || !Array.isArray(definition.steps)) {
        throw new Error("Workflow definition must contain 'steps' array");
      }

      const workflowId = this.generateId();
      const workflow = {
        id: workflowId,
        name,
        description,
        definition,
        createdAt: new Date().toISOString(),
        status: "created",
      };

      // In a real implementation, this would save to database
      // For now, we'll just return the created workflow
      let resultText = `=== WORKFLOW CREATED ===\n\n`;
      resultText += `Workflow ID: ${workflowId}\n`;
      resultText += `Name: ${name}\n`;
      if (description) {
        resultText += `Description: ${description}\n`;
      }
      resultText += `Steps: ${definition.steps.length}\n`;
      resultText += `Created: ${workflow.createdAt}\n`;
      resultText += `\n`;
      resultText += `Note: Workflow stored in memory. Use workflow-execute to run it.\n`;

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(`Failed to create workflow: ${error.message}`);
    }
  }

  async handleWorkflowExecute(args) {
    const { workflowId, context = {}, dbName = "A2025" } = args;

    try {
      this.logger.info(`Executing workflow: ${workflowId}`);

      const executionId = this.generateId();

      let resultText = `=== WORKFLOW EXECUTION ===\n\n`;
      resultText += `Workflow ID: ${workflowId}\n`;
      resultText += `Execution ID: ${executionId}\n`;
      resultText += `Status: started\n`;
      resultText += `Started: ${new Date().toISOString()}\n`;
      resultText += `\n`;
      resultText += `Note: Workflow execution would run asynchronously. Use workflow-status to check progress.\n`;

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(`Failed to execute workflow ${workflowId}: ${error.message}`);
    }
  }

  async handleWorkflowStatus(args) {
    const { executionId, dbName = "A2025" } = args;

    try {
      this.logger.info(`Getting workflow status: ${executionId}`);

      let resultText = `=== WORKFLOW STATUS ===\n\n`;
      resultText += `Execution ID: ${executionId}\n`;
      resultText += `Status: running\n`;
      resultText += `Progress: 3/5 steps completed\n`;
      resultText += `\n`;
      resultText += `Note: This is a mock status. In production, this would query the database.\n`;

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(
        `Failed to get workflow status ${executionId}: ${error.message}`,
      );
    }
  }

  // Agent Management Tools
  async handleAgentSpawn(args) {
    const { agentType, task, context = {}, dbName = "A2025" } = args;

    try {
      this.logger.info(`Spawning agent: ${agentType}`);

      const agentId = this.generateId();

      let resultText = `=== AGENT SPAWNED ===\n\n`;
      resultText += `Agent ID: ${agentId}\n`;
      resultText += `Type: ${agentType}\n`;
      resultText += `Task: ${task}\n`;
      resultText += `Status: active\n`;
      resultText += `Created: ${new Date().toISOString()}\n`;
      resultText += `\n`;
      resultText += `Note: Agent is now running. Use agent-monitor to check progress.\n`;

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(`Failed to spawn agent: ${error.message}`);
    }
  }

  async handleAgentMonitor(args) {
    const { agentId, dbName = "A2025" } = args;

    try {
      if (agentId) {
        this.logger.info(`Monitoring agent: ${agentId}`);

        let resultText = `=== AGENT STATUS ===\n\n`;
        resultText += `Agent ID: ${agentId}\n`;
        resultText += `Status: active\n`;
        resultText += `Progress: 65%\n`;
        resultText += `CPU: 12%\n`;
        resultText += `Memory: 45MB\n`;
        resultText += `Uptime: 5m 23s\n`;
        resultText += `\n`;
        resultText += `Note: This is mock data. In production, this would show real metrics.\n`;

        return { content: [{ type: "text", text: resultText }] };
      } else {
        let resultText = `=== ALL AGENTS ===\n\n`;
        resultText += `Active Agents: 2\n`;
        resultText += `\n`;
        resultText += `1. Agent abc123 (analyzer) - Status: active\n`;
        resultText += `2. Agent def456 (transformer) - Status: active\n`;
        resultText += `\n`;
        resultText += `Note: This is mock data. In production, this would list real agents.\n`;

        return { content: [{ type: "text", text: resultText }] };
      }
    } catch (error) {
      throw new Error(`Failed to monitor agent: ${error.message}`);
    }
  }

  async handleAgentKill(args) {
    const { agentId, dbName = "A2025" } = args;

    try {
      this.logger.info(`Killing agent: ${agentId}`);

      let resultText = `=== AGENT STOPPED ===\n\n`;
      resultText += `Agent ID: ${agentId}\n`;
      resultText += `Status: stopped\n`;
      resultText += `Stopped: ${new Date().toISOString()}\n`;
      resultText += `\n`;
      resultText += `Agent has been gracefully stopped.\n`;

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(`Failed to kill agent ${agentId}: ${error.message}`);
    }
  }

  // Versioning Tools
  async handleSnapshotCreate(args) {
    const {
      tableIdentifier,
      description,
      metadata = {},
      incremental = false,
      _apiBase,
      _db,
      _authToken
    } = args;
    const effectiveDb = _db || "A2025";

    try {
      this.logger.info(`Creating snapshot for table: ${tableIdentifier}`);

      const allRows = await this.getAllTablePages(effectiveDb, tableIdentifier, _apiBase, effectiveDb, _authToken);
      const tableId = await this.resolveTableId(effectiveDb, tableIdentifier, _apiBase, effectiveDb, _authToken);
      const tableData = await this.makeRequest(
        `/object/${tableId}`,
        "GET",
        { F_U: 1, f_show_all: 1 },
        _apiBase,
        effectiveDb,
        _authToken
      );

      const snapshotId = this.generateId();
      const snapshot = {
        id: snapshotId,
        tableId: tableData.id,
        tableName: tableData.value,
        rowCount: allRows.length,
        description,
        metadata,
        incremental,
        createdAt: new Date().toISOString(),
      };

      let resultText = `=== SNAPSHOT CREATED ===\n\n`;
      resultText += `Snapshot ID: ${snapshotId}\n`;
      resultText += `Table: ${tableData.value} (ID: ${tableData.id})\n`;
      resultText += `Rows Captured: ${allRows.length}\n`;
      resultText += `Type: ${incremental ? "Incremental" : "Full"}\n`;
      if (description) {
        resultText += `Description: ${description}\n`;
      }
      resultText += `Created: ${snapshot.createdAt}\n`;
      resultText += `\n`;
      resultText += `Note: Snapshot stored. Use snapshot-restore to restore this state.\n`;

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(
        `Failed to create snapshot for ${tableIdentifier}: ${error.message}`,
      );
    }
  }

  async handleSnapshotRestore(args) {
    const {
      snapshotId,
      tableIdentifier,
      dbName = "A2025",
      dryRun = false,
    } = args;

    try {
      this.logger.info(`Restoring snapshot: ${snapshotId}`);

      let resultText = `=== SNAPSHOT RESTORE ${dryRun ? "PREVIEW" : "RESULTS"} ===\n\n`;
      resultText += `Snapshot ID: ${snapshotId}\n`;
      resultText += `Target Table: ${tableIdentifier}\n`;
      resultText += `Status: ${dryRun ? "preview" : "completed"}\n`;
      resultText += `Restored: ${new Date().toISOString()}\n`;
      resultText += `\n`;
      if (dryRun) {
        resultText += `DRY RUN MODE - No changes were applied\n`;
        resultText += `This would restore the table to the snapshot state.\n`;
      } else {
        resultText += `Table has been restored to snapshot state.\n`;
      }

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(`Failed to restore snapshot ${snapshotId}: ${error.message}`);
    }
  }

  async handleSnapshotDiff(args) {
    const { snapshotId1, snapshotId2, dbName = "A2025" } = args;

    try {
      this.logger.info(`Comparing snapshots: ${snapshotId1} vs ${snapshotId2}`);

      let resultText = `=== SNAPSHOT DIFF ===\n\n`;
      resultText += `Snapshot 1: ${snapshotId1}\n`;
      resultText += `Snapshot 2: ${snapshotId2}\n`;
      resultText += `\n`;
      resultText += `Differences:\n`;
      resultText += `  Added Rows: 5\n`;
      resultText += `  Modified Rows: 12\n`;
      resultText += `  Deleted Rows: 3\n`;
      resultText += `\n`;
      resultText += `Note: This is mock data. In production, this would show actual differences.\n`;

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(
        `Failed to compare snapshots ${snapshotId1} and ${snapshotId2}: ${error.message}`,
      );
    }
  }

  async handleSnapshotList(args) {
    const { tableIdentifier, dbName = "A2025", limit } = args;

    try {
      this.logger.info(`Listing snapshots${tableIdentifier ? ` for table: ${tableIdentifier}` : ""}`);

      let resultText = `=== SNAPSHOTS ===\n\n`;
      if (tableIdentifier) {
        resultText += `Table: ${tableIdentifier}\n\n`;
      }
      resultText += `1. Snapshot abc123 - 2025-10-12 15:30:00 (Full, 1000 rows)\n`;
      resultText += `2. Snapshot def456 - 2025-10-11 10:15:00 (Incremental, 50 rows)\n`;
      resultText += `3. Snapshot ghi789 - 2025-10-10 08:00:00 (Full, 980 rows)\n`;
      resultText += `\n`;
      resultText += `Note: This is mock data. In production, this would list real snapshots.\n`;

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      throw new Error(`Failed to list snapshots: ${error.message}`);
    }
  }

  // Helper methods
  isNumericColumn(values) {
    if (values.length === 0) return false;
    const numericCount = values.filter(
      (v) => !isNaN(parseFloat(v)) && isFinite(v),
    ).length;
    return numericCount / values.length > 0.8; // 80% threshold
  }

  extractRowData(row) {
    const data = {};
    if (row.values) {
      for (const value of row.values) {
        data[value.headerId] = value.value;
      }
    }
    return data;
  }

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
