# Integram MCP Server

Model Context Protocol (MCP) server that exposes Integram API functionality as AI-accessible tools.

## Overview

This MCP server wraps the Integram API client (`src/services/integramApiClient.js`) and exposes all its functionality as MCP tools that can be used by AI models like DeepSeek, Claude, or GPT-4.

**Universal Domain Support**: This server works with ANY Integram installation across different domains and databases:
- ✅ dronedoc.ru with any database (a2025, mydb, etc.)
- ✅ integram.io with any database
- ✅ app.integram.io with any database
- ✅ Custom Integram installations on any domain
- ✅ Localhost/development servers

The server automatically detects the domain type and uses the appropriate URL format for each installation.

## Architecture

```
┌─────────────────┐
│   AI Model      │
│ (DeepSeek, etc) │
└────────┬────────┘
         │
         │ MCP Protocol
         │
┌────────▼────────┐
│  Integram MCP   │
│     Server      │
└────────┬────────┘
         │
         │ HTTP/HTTPS
         │
┌────────▼────────────────────────┐
│      Integram API               │
│                                 │
│  Supports ANY domain:           │
│  • dronedoc.ru                  │
│  • integram.io                  │
│  • app.integram.io              │
│  • custom.example.com           │
│  • localhost:3000               │
│                                 │
│  With ANY database name         │
└─────────────────────────────────┘
```

## Multi-Domain & Multi-Database Support

### Universal URL Handling

The MCP server automatically adapts to different Integram installation formats:

#### DronDoc.ru Format
```
URL Pattern: https://dronedoc.ru/{database}/{endpoint}?JSON_KV

Examples:
- https://dronedoc.ru/a2025/dict?JSON_KV
- https://dronedoc.ru/mydb/auth?JSON_KV
- https://dronedoc.ru/production/_d_new?JSON_KV
```

#### Integram.io Format
```
URL Pattern: https://[app.]integram.io/api/{database}/{endpoint}

Examples:
- https://integram.io/api/testdb/dict
- https://app.integram.io/api/production/auth
- https://integram.io/api/staging/_m_save/123
```

#### Custom Domains
```
URL Pattern: https://custom.domain/api/{database}/{endpoint}

Examples:
- https://custom.example.com/api/mydb/dict
- http://localhost:3000/api/dev/dict
- http://192.168.1.100/api/testdb/auth
```

### Database Name Flexibility

The server works with **ANY** database name:
- Standard: `a2025`, `production`, `staging`, `dev`
- Custom: `mydb`, `test_db`, `company_data`
- Short: `db`, `a1`
- Long: `very_long_database_name_2025`

### Automatic Detection

The server automatically detects:
1. **Domain type** (dronedoc.ru vs integram.io vs custom)
2. **URL format** (with or without `/api/` prefix)
3. **Query parameters** (JSON_KV for dronedoc.ru, none for integram.io)
4. **Database in path** (handles cases where database is already in baseURL)

## Features

### Authentication & Context Management
- `integram_authenticate` - Authenticate with username/password
- `integram_set_context` - Set authentication context from existing session

### DDL Operations (Data Definition Language)
Operations for managing database structure:
- `integram_create_type` - Create new type (table)
- `integram_save_type` - Save type properties
- `integram_delete_type` - Delete a type
- `integram_add_requisite` - Add requisite (column) to type
- `integram_delete_requisite` - Delete a requisite
- `integram_save_requisite_alias` - Save requisite alias
- `integram_toggle_requisite_null` - Toggle NULL constraint
- `integram_toggle_requisite_multi` - Toggle multi-select flag

### DML Operations (Data Manipulation Language)
Operations for managing data:
- `integram_create_object` - Create new object (record)
- `integram_save_object` - Save object value and requisites
- `integram_set_object_requisites` - Set object requisites
- `integram_delete_object` - Delete an object
- `integram_move_object_up` - Move object up in order
- `integram_move_object_to_parent` - Move subordinate object to new parent

### Query Operations
Operations for retrieving data:
- `integram_get_dictionary` - Get list of independent types
- `integram_get_type_metadata` - Get type metadata
- `integram_get_object_list` - Get object list for type
- `integram_get_object_edit_data` - Get object edit form data
- `integram_get_type_editor_data` - Get type editor data
- `integram_execute_report` - Execute a report
- `integram_get_reference_options` - Get reference options for dropdowns

### Multiselect Operations
Operations for managing multiselect fields:
- `integram_add_multiselect_item` - Add item to multiselect field
- `integram_remove_multiselect_item` - Remove item from multiselect field

### File Operations
- `integram_get_dir_admin` - Get directory admin data
- `integram_create_backup` - Create database backup

### High-Level Table Operations (NEW)
High-level convenience tools that combine multiple low-level operations:

- `integram_create_table_with_columns` - Create complete table with all columns in one operation
- `integram_delete_table_cascade` - Delete table and all its data (cascade deletion)
- `integram_get_table_structure` - Get complete table structure with metadata
- `integram_clone_table_structure` - Clone table structure to create new table
- `integram_rename_table` - Rename existing table
- `integram_add_columns_to_table` - Add multiple columns to existing table in one operation

## Installation

The Integram MCP server is already integrated into the DronDoc monolith backend.

### Dependencies

Required npm packages (already in package.json):
- `@modelcontextprotocol/sdk` - MCP SDK
- `axios` - HTTP client

## Usage

### 1. Via MCP Routes (Recommended)

#### List Available Tools

```bash
GET /api/mcp/integram/tools
```

Response:
```json
{
  "success": true,
  "tools": [
    {
      "name": "integram_authenticate",
      "description": "Authenticate with Integram API and establish a session",
      "inputSchema": { ... }
    },
    ...
  ],
  "count": 28
}
```

#### Execute a Tool

```bash
POST /api/mcp/integram/execute
Content-Type: application/json

{
  "toolName": "integram_authenticate",
  "arguments": {
    "serverURL": "https://dronedoc.ru",
    "database": "a2025",
    "login": "username",
    "password": "password"
  }
}
```

Response:
```json
{
  "success": true,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"success\":true,\"token\":\"...\",\"userId\":123,...}"
      }
    ]
  },
  "toolName": "integram_authenticate"
}
```

#### Chat with AI Using Integram Tools

```bash
POST /api/mcp/integram/chat
Content-Type: application/json

{
  "message": "Show me all types in the database",
  "serverURL": "https://dronedoc.ru",
  "database": "a2025",
  "token": "your-token",
  "xsrfToken": "your-xsrf",
  "conversationHistory": []
}
```

Response:
```json
{
  "success": true,
  "response": "Here are all the types in your database:\n\n1. Users\n2. Projects\n...",
  "toolCallsCount": 1,
  "conversationHistory": [...]
}
```

### 2. Direct MCP Client Usage

For advanced users or custom integrations:

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Initialize transport
const transport = new StdioClientTransport({
  command: 'node',
  args: ['backend/monolith/src/services/mcp/integram-server.js'],
});

// Create client
const client = new Client(
  { name: 'my-integram-client', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Connect
await client.connect(transport);

// List tools
const toolsResponse = await client.listTools();
console.log('Available tools:', toolsResponse.tools.map(t => t.name));

// Authenticate
const authResult = await client.callTool({
  name: 'integram_authenticate',
  arguments: {
    serverURL: 'https://dronedoc.ru',
    database: 'a2025',
    login: 'username',
    password: 'password'
  }
});

console.log('Auth result:', authResult);

// Get dictionary
const dictResult = await client.callTool({
  name: 'integram_get_dictionary',
  arguments: {}
});

console.log('Dictionary:', dictResult);

// Close client
await client.close();
```

## API Endpoints

### Authentication

#### `integram_authenticate`

Authenticate with Integram API.

**Arguments:**
- `serverURL` (string, required) - Integram server URL (e.g., `https://dronedoc.ru`)
- `database` (string, required) - Database name (e.g., `a2025`)
- `login` (string, required) - Username
- `password` (string, required) - Password

**Returns:**
```json
{
  "success": true,
  "token": "auth-token",
  "xsrf": "xsrf-token",
  "userId": 123,
  "userName": "John Doe",
  "userRole": "admin"
}
```

#### `integram_set_context`

Set authentication context from existing session.

**Arguments:**
- `serverURL` (string, required)
- `database` (string, required)
- `token` (string, required)
- `xsrfToken` (string, required)

**Returns:**
```json
{
  "success": true,
  "message": "Context set successfully"
}
```

### DDL Operations

#### `integram_create_type`

Create new type (table).

**Arguments:**
- `name` (string, required) - Type name
- `baseTypeId` (number, required) - Base type ID
- `unique` (boolean, optional) - First column is unique

**Returns:**
Integram API response with created type info.

#### `integram_add_requisite`

Add requisite (column) to type.

**Arguments:**
- `typeId` (number, required) - Type ID
- `requisiteTypeId` (number, required) - Requisite type ID

**Returns:**
Integram API response with created requisite info.

### DML Operations

#### `integram_create_object`

Create new object (record).

**Arguments:**
- `typeId` (number, required) - Object type ID
- `value` (string, required) - Object value
- `requisites` (object, optional) - Requisites as key-value pairs
- `parentId` (number, optional) - Parent ID for subordinate objects

**Example:**
```json
{
  "typeId": 42,
  "value": "New Project",
  "requisites": {
    "101": "Description text",
    "102": "2025-01-15"
  },
  "parentId": 10
}
```

**Returns:**
Integram API response with created object info.

#### `integram_save_object`

Save object value and requisites.

**Arguments:**
- `objectId` (number, required) - Object ID
- `typeId` (number, required) - Object type ID
- `value` (string, required) - Object value
- `requisites` (object, optional) - Requisites to update

**Returns:**
Integram API response with updated object info.

### Query Operations

#### `integram_get_dictionary`

Get list of independent types (tables).

**Arguments:** None

**Returns:**
```json
{
  "types": [
    {
      "id": 1,
      "name": "Users",
      "base_type_id": 0
    },
    ...
  ]
}
```

#### `integram_get_type_metadata`

Get type metadata including requisites.

**Arguments:**
- `typeId` (number, required) - Type ID

**Returns:**
```json
{
  "id": 42,
  "name": "Projects",
  "requisites": [
    {
      "id": 101,
      "name": "Description",
      "type_id": 1
    },
    ...
  ]
}
```

#### `integram_get_object_list`

Get object list for type.

**Arguments:**
- `typeId` (number, required) - Type ID
- `params` (object, optional) - Query parameters (filters, sorting, pagination)

**Example params:**
```json
{
  "offset": 0,
  "limit": 50,
  "sort": "name",
  "filter": "status=active"
}
```

**Returns:**
```json
{
  "objects": [
    {
      "id": 1,
      "value": "Project Alpha",
      "requisites": { ... }
    },
    ...
  ],
  "total": 150
}
```

#### `integram_execute_report`

Execute a report.

**Arguments:**
- `reportId` (number, required) - Report ID
- `params` (object, optional) - Report parameters

**Returns:**
Report results (format depends on report type).

### Multiselect Operations

#### `integram_add_multiselect_item`

Add item to multiselect field.

**Arguments:**
- `objectId` (number, required) - Object ID being edited
- `requisiteId` (number, required) - Requisite ID of multiselect field
- `value` (number|string, required) - ID of item to add

**Returns:**
Integram API response with multiselect item ID.

#### `integram_remove_multiselect_item`

Remove item from multiselect field.

**Arguments:**
- `itemId` (number, required) - Multiselect item ID (NOT the referenced object ID)

**Returns:**
Integram API response confirming deletion.

### File Operations

#### `integram_get_dir_admin`

Get directory admin data.

**Arguments:**
- `path` (string, optional) - Directory path (default: root)

**Returns:**
Directory structure and files.

#### `integram_create_backup`

Create database backup.

**Arguments:** None

**Returns:**
Backup file information.

## Testing

Tests are located in `backend/monolith/src/services/mcp/__tests__/integram-server.test.js`.

Run tests:
```bash
cd backend/monolith
npm test -- integram-server.test.js
```

Test coverage:
- Tool listing
- Tool schemas validation
- Authentication and context management
- Error handling
- Integration tests

## Error Handling

The MCP server provides comprehensive error handling:

1. **Authentication errors**: Returns error if not authenticated
2. **Invalid arguments**: Returns error with validation message
3. **Network errors**: Returns error with connection details
4. **API errors**: Returns Integram API error messages

Error response format:
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"error\":\"Not authenticated. Call authenticate first.\",\"tool\":\"integram_get_dictionary\",\"arguments\":{}}"
    }
  ],
  "isError": true
}
```

## Security Considerations

1. **Credentials**: Never expose credentials in logs or error messages
2. **Token management**: Tokens are session-specific and should be rotated
3. **XSRF protection**: All POST requests include XSRF token
4. **Authentication required**: Most tools require authentication

## Troubleshooting

### Server won't start
- Check that Node.js is installed
- Verify `@modelcontextprotocol/sdk` is in package.json
- Check file permissions on `integram-server.js`

### Authentication fails
- Verify server URL is correct (e.g., `https://dronedoc.ru`, not `https://dronedoc.ru/a2025`)
- Check database name is correct
- Verify credentials are valid
- Ensure network connectivity to Integram server

### Tools not listed
- Check MCP client connection
- Verify server is running
- Check logs for errors

### Tool execution fails
- Ensure authentication is completed first
- Verify tool arguments match schema
- Check network connectivity
- Review Integram API documentation for endpoint-specific requirements

## Examples

### Example 1: Working with dronedoc.ru

```javascript
// Authenticate with dronedoc.ru
await client.callTool({
  name: 'integram_authenticate',
  arguments: {
    serverURL: 'https://dronedoc.ru',
    database: 'a2025',  // Can be any database name
    login: 'admin',
    password: 'password'
  }
});

// Get dictionary
const dict = await client.callTool({
  name: 'integram_get_dictionary',
  arguments: {}
});

console.log('Existing types:', dict);
// Server automatically uses: https://dronedoc.ru/a2025/dict?JSON_KV

// Create new type
const newType = await client.callTool({
  name: 'integram_create_type',
  arguments: {
    name: 'Tasks',
    baseTypeId: 1,
    unique: false
  }
});

console.log('Created type:', newType);
// Server automatically uses: https://dronedoc.ru/a2025/_d_new?JSON_KV
```

### Example 1b: Working with integram.io

```javascript
// Same operations, different domain
await client.callTool({
  name: 'integram_authenticate',
  arguments: {
    serverURL: 'https://app.integram.io',
    database: 'production',  // Can be any database name
    login: 'admin',
    password: 'password'
  }
});

// Get dictionary - server automatically adapts URL format
const dict = await client.callTool({
  name: 'integram_get_dictionary',
  arguments: {}
});
// Server automatically uses: https://app.integram.io/api/production/dict

// Create new type
const newType = await client.callTool({
  name: 'integram_create_type',
  arguments: {
    name: 'Tasks',
    baseTypeId: 1,
    unique: false
  }
});
// Server automatically uses: https://app.integram.io/api/production/_d_new
```

### Example 1c: Working with custom domain

```javascript
// Works with any custom Integram installation
await client.callTool({
  name: 'integram_authenticate',
  arguments: {
    serverURL: 'https://custom.example.com',
    database: 'mydb',
    login: 'admin',
    password: 'password'
  }
});

// All operations work the same way
const dict = await client.callTool({
  name: 'integram_get_dictionary',
  arguments: {}
});
// Server automatically uses: https://custom.example.com/api/mydb/dict
```

### Example 2: Create object with requisites

```javascript
// Create object
const newObject = await client.callTool({
  name: 'integram_create_object',
  arguments: {
    typeId: 42,
    value: 'New Task',
    requisites: {
      101: 'Task description',
      102: 'high',
      103: '2025-12-31'
    }
  }
});

console.log('Created object:', newObject);
```

### Example 3: Switching between different Integram installations

```javascript
// Work with development server
await client.callTool({
  name: 'integram_authenticate',
  arguments: {
    serverURL: 'http://localhost:3000',
    database: 'dev',
    login: 'dev',
    password: 'dev123'
  }
});

// ... perform operations ...

// Switch to production server (app.integram.io)
await client.callTool({
  name: 'integram_authenticate',
  arguments: {
    serverURL: 'https://app.integram.io',
    database: 'production',
    login: 'admin',
    password: 'secure_password'
  }
});

// ... perform operations ...

// Switch to dronedoc.ru
await client.callTool({
  name: 'integram_authenticate',
  arguments: {
    serverURL: 'https://dronedoc.ru',
    database: 'a2025',
    login: 'user',
    password: 'password'
  }
});

// All operations work the same way regardless of domain
```

### Example 4: AI-powered database exploration (works with any domain)

```bash
POST /api/mcp/integram/chat
Content-Type: application/json

{
  "message": "What types exist in the database? Show me their requisites.",
  "serverURL": "https://dronedoc.ru",  # Works with any domain!
  "database": "a2025",                  # Works with any database!
  "token": "your-token",
  "xsrfToken": "your-xsrf"
}
```

The AI will:
1. Call `integram_get_dictionary` to list types
2. Call `integram_get_type_metadata` for each type
3. Format and present the results

**This works identically with:**
- `serverURL: "https://integram.io"` and `database: "mydb"`
- `serverURL: "https://app.integram.io"` and `database: "production"`
- `serverURL: "https://custom.example.com"` and `database: "testdb"`

### Example 5: High-Level Table Creation (NEW)

Create a complete table with all columns in one operation using `integram_create_table_with_columns`:

```javascript
// Create "Оплата" (Payment) table with 4 columns
const result = await client.callTool({
  name: 'integram_create_table_with_columns',
  arguments: {
    tableName: 'Оплата',
    baseTypeId: 1,  // 0 for admin databases, 1 for standard
    unique: false,
    columns: [
      {
        requisiteTypeId: 3,  // SHORT text
        alias: 'Название',
        allowNull: false
      },
      {
        requisiteTypeId: 13, // NUMBER
        alias: 'Сумма',
        allowNull: false
      },
      {
        requisiteTypeId: 4,  // DATETIME
        alias: 'Дата оплаты',
        allowNull: true
      },
      {
        requisiteTypeId: 3,  // SHORT text
        alias: 'Статус',
        allowNull: true
      }
    ]
  }
});

// Response includes:
// {
//   success: true,
//   typeId: 2385,
//   tableName: 'Оплата',
//   columnsCreated: 4,
//   columns: [
//     { requisiteId: 101, alias: 'Название', ... },
//     { requisiteId: 102, alias: 'Сумма', ... },
//     ...
//   ]
// }
```

**Requisite Type IDs Reference:**
- `2` - LONG (long text)
- `3` - SHORT (short text < 255 chars)
- `4` - DATETIME (date and time)
- `5` - DATE (date only)
- `6` - TIME (time only)
- `7` - BOOL (boolean)
- `8` - REFERENCE (reference to another type)
- `13` - NUMBER (numeric value)

### Example 6: Add Columns to Existing Table

```javascript
// Add multiple columns to existing table
const result = await client.callTool({
  name: 'integram_add_columns_to_table',
  arguments: {
    typeId: 2385,
    columns: [
      {
        requisiteTypeId: 2,  // LONG text
        alias: 'Комментарий',
        allowNull: true
      },
      {
        requisiteTypeId: 7,  // BOOL
        alias: 'Подтверждено',
        allowNull: true
      }
    ]
  }
});

// Response:
// {
//   success: true,
//   typeId: 2385,
//   columnsAdded: 2,
//   columns: [...]
// }
```

### Example 7: Get Complete Table Structure

```javascript
// Get full table structure including all columns
const result = await client.callTool({
  name: 'integram_get_table_structure',
  arguments: {
    typeId: 2385
  }
});

// Response:
// {
//   typeId: 2385,
//   tableName: 'Оплата',
//   baseTypeId: 1,
//   unique: false,
//   columnCount: 6,
//   requisites: [
//     { id: 101, alias: 'Название', requisite_type_id: 3, ... },
//     { id: 102, alias: 'Сумма', requisite_type_id: 13, ... },
//     ...
//   ],
//   metadata: { ... }
// }
```

### Example 8: Clone Table Structure

```javascript
// Clone existing table structure to create new table
const result = await client.callTool({
  name: 'integram_clone_table_structure',
  arguments: {
    sourceTypeId: 2385,  // Source table
    newTableName: 'Оплата_Архив',
    baseTypeId: 1
  }
});

// Response:
// {
//   success: true,
//   sourceTypeId: 2385,
//   newTypeId: 2390,
//   newTableName: 'Оплата_Архив',
//   columnsCloned: 6,
//   columns: [...]
// }
```

### Example 9: Rename Table

```javascript
// Rename existing table
const result = await client.callTool({
  name: 'integram_rename_table',
  arguments: {
    typeId: 2385,
    newName: 'Платежи'
  }
});

// Response:
// {
//   success: true,
//   typeId: 2385,
//   oldName: 'Оплата',
//   newName: 'Платежи'
// }
```

### Example 10: Delete Table (Cascade)

```javascript
// Delete table and all its data (CAUTION: permanent!)
const result = await client.callTool({
  name: 'integram_delete_table_cascade',
  arguments: {
    typeId: 2385,
    confirm: true  // Must be true to proceed
  }
});

// Response:
// {
//   success: true,
//   typeId: 2385,
//   message: 'Table deleted successfully (cascade)'
// }
```

### Running the Test Script

A comprehensive test script is available to test all new high-level tools:

```bash
cd backend/monolith
node examples/test-create-payment-table.js
```

This script:
1. Authenticates with dronedoc.ru
2. Creates "Оплата" table with 4 columns
3. Verifies table structure
4. Adds sample payment record
5. Demonstrates adding columns, renaming, etc.
6. Shows final table structure

## ⚠️ Common Mistakes and Lessons Learned

This section documents common mistakes when working with Integram MCP to help avoid them.

### Mistake 1: Using Custom Table ID as baseTypeId (NOW AUTO-FIXED!)

**Previously wrong (now auto-corrected):**
```javascript
// Trying to create "subordinate" table by using parent table ID as baseTypeId
await client.callTool({
  name: 'integram_create_table_with_columns',
  arguments: {
    tableName: 'Характеристики',
    baseTypeId: 994762,  // ⚠️ ID of "Товары" table - was wrong, NOW AUTO-FIXED!
    columns: [...]
  }
});
// Previously: Error: "Неверный базовый тип: 994762"
// NOW: Auto-converts to parentTableId: 994762 and creates table with baseTypeId: 3
```

**✨ NEW BEHAVIOR (Auto-Fix):**
As of December 2024, the MCP server **automatically detects** when you try to use a custom table ID as `baseTypeId` and **converts it to the correct approach**:
- Creates table with `baseTypeId: 3` (standard)
- Automatically adds a reference column to the "parent" table
- Returns `autoFixed: true` in the response to indicate this happened

**Why the original code was wrong:**
- `baseTypeId` is for **system base types**, NOT user-created table IDs
- Valid values are strictly limited: `3` (standard tables) or `0` (admin databases)
- You cannot "inherit" from another table in Integram

**✅ RECOMMENDED - Use new `parentTableId` parameter:**
```javascript
// Best approach: Use parentTableId parameter for subordinate tables
await client.callTool({
  name: 'integram_create_table_with_columns',
  arguments: {
    tableName: 'Характеристики',
    parentTableId: 994762,          // ✅ NEW PARAMETER: Parent table ID
    parentColumnAlias: 'Товар',      // Optional: Custom alias (default: "Родительская запись")
    columns: [
      { requisiteTypeId: 3, alias: 'Название' },
      { requisiteTypeId: 3, alias: 'Значение' }
    ]
  }
});
// Result: Creates table with baseTypeId: 3 + reference column "Товар" → 994762
```

**Alternative - Add reference column separately:**
```javascript
// 1. Create table with standard baseTypeId
await client.callTool({
  name: 'integram_create_table_with_columns',
  arguments: {
    tableName: 'Характеристики',
    baseTypeId: 3,  // ✅ Standard base type
    columns: [
      { requisiteTypeId: 3, alias: 'Название' },
      { requisiteTypeId: 3, alias: 'Значение' }
    ]
  }
});

// 2. Add reference column separately
await client.callTool({
  name: 'integram_add_reference_column',
  arguments: {
    typeId: newTableId,
    referenceTableId: 994762,  // Parent table ID
    alias: 'Товар'
  }
});
```

### Mistake 2: Confusing Table Relationships

**In Integram, related tables are created via:**

| Method | Description | Use Case |
|--------|-------------|----------|
| **Reference column** | Column with `requisiteTypeId` = target table ID | Lookup/dropdown selection |
| **parentId in objects** | Object's `up` field points to parent object | Hierarchical data within same type |

**NOT via:**
- `baseTypeId` inheritance (doesn't exist in Integram)
- Foreign key constraints (not supported in Integram's single-table architecture)

### Mistake 3: Forgetting baseTypeId Varies by Database

**Different Integram installations have different valid baseTypeId values:**

| Database Type | Valid baseTypeId | Example |
|---------------|------------------|---------|
| Standard (a2025, etc.) | `3` | `baseTypeId: 3` |
| Admin (ddadmin, etc.) | `0` | `baseTypeId: 0` |

**Always check first:**
```javascript
// Get valid base types for current database
const editorData = await client.callTool({
  name: 'integram_get_type_editor_data',
  arguments: {}
});
console.log('Valid base types:', editorData.baseTypeOptions);
```

### Mistake 4: Assuming SQL-like Behavior

**Integram is NOT a traditional RDBMS:**

| SQL Concept | Integram Equivalent | Notes |
|-------------|---------------------|-------|
| Foreign Key | Reference column | No cascade, no constraints |
| Table inheritance | Not supported | Use references instead |
| JOIN | Reports/Queries | Via `integram_execute_report` |
| CASCADE DELETE | Manual | Delete child objects first |
| NULL constraint | `allowNull` flag | Toggle per requisite |

### Mistake 5: Not Verifying Table Structure After Creation

**Always verify after creating tables:**
```javascript
// After creating table
const structure = await client.callTool({
  name: 'integram_get_table_structure',
  arguments: { typeId: newTableId }
});

// Check:
// - All columns present?
// - All aliases set correctly?
// - Reference columns have correct target?
console.log('Columns:', structure.requisites);
```

### Summary: How to Create Related Tables Correctly

```javascript
// Step 1: Create lookup table (справочник)
const categories = await client.callTool({
  name: 'integram_create_lookup_table',
  arguments: {
    tableName: 'Категории',
    values: ['Электроника', 'Одежда', 'Продукты']
  }
});

// Step 2: Create main table with reference to lookup
const products = await client.callTool({
  name: 'integram_create_table_with_columns',
  arguments: {
    tableName: 'Товары',
    baseTypeId: 3,  // Always 3 for standard databases!
    columns: [
      { requisiteTypeId: 3, alias: 'Название' },
      { requisiteTypeId: 13, alias: 'Цена' },
      { requisiteTypeId: categories.lookupTableId, alias: 'Категория' }  // Reference!
    ]
  }
});

// Step 3: Create related table with reference to main table
const characteristics = await client.callTool({
  name: 'integram_create_table_with_columns',
  arguments: {
    tableName: 'Характеристики',
    baseTypeId: 3,  // Always 3!
    columns: [
      { requisiteTypeId: 3, alias: 'Название' },
      { requisiteTypeId: 3, alias: 'Значение' },
      { requisiteTypeId: products.typeId, alias: 'Товар' }  // Reference to products!
    ]
  }
});
```

## Contributing

When adding new tools:

1. Add tool definition to `TOOLS` array
2. Add case handler in `CallToolRequestSchema` handler
3. Add tests in `__tests__/integram-server.test.js`
4. Update this documentation

## License

Part of the DronDoc project. See main project LICENSE file.

## Support

For issues or questions:
- Create an issue in the DronDoc repository
- Reference issue #3411 (Integram MCP Server implementation)
- Check Integram API documentation at `backend/drondoc_integram/api.csv`
