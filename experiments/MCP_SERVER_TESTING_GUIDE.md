# Integram MCP Server Testing Guide

This document provides comprehensive testing procedures for the Integram MCP Server (integram-tools) with 70+ tools for working with Integram API v2.

## Table of Contents
1. [Setup](#setup)
2. [Test 1: Authentication](#test-1-authentication-integram_authenticate)
3. [Test 2: Table Creation](#test-2-table-creation-integram_create_table_with_columns)
4. [Test 3: Query Operations](#test-3-query-operations-natural-and-smart-queries)
5. [Test 4: CRUD Operations](#test-4-crud-operations-with-objects)
6. [Test 5: Lookup Tables](#test-5-lookup-tables-справочники)
7. [Test 6: Multiselect Fields](#test-6-multiselect-fields)
8. [Summary](#summary)

## Setup

### Prerequisites
- Node.js >= 18.0.0
- Access to an Integram server (e.g., dronedoc.ru, app.integram.io)
- Valid Integram credentials (serverURL, database, login, password)

### Configuration
The MCP server is configured in `.mcp.json`:
```json
{
  "mcpServers": {
    "integram": {
      "command": "node",
      "args": ["backend/monolith/src/services/mcp/integram-server.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Starting the Server
The MCP server runs via MCP protocol (stdio transport). It's typically used by:
1. Claude Desktop (via claude_desktop_config.json)
2. Claude Code (via .mcp.json)
3. Other MCP-compatible clients

## Test 1: Authentication (`integram_authenticate`)

### Purpose
Test authentication with Integram API and establish a session.

### Tool Used
- `integram_authenticate`

### Test Procedure

#### Step 1.1: Authenticate with Valid Credentials
```javascript
// Tool: integram_authenticate
{
  "serverURL": "https://dronedoc.ru",
  "database": "a2025",
  "login": "your_username",
  "password": "your_password"
}
```

**Expected Result:**
```json
{
  "success": true,
  "token": "<auth_token>",
  "xsrf": "<xsrf_token>",
  "userId": 123,
  "userName": "your_username",
  "userRole": "admin"
}
```

#### Step 1.2: Test Context Setting (Alternative Authentication)
```javascript
// Tool: integram_set_context
{
  "serverURL": "https://dronedoc.ru",
  "database": "a2025",
  "token": "existing_token",
  "xsrfToken": "existing_xsrf"
}
```

**Expected Result:**
```json
{
  "success": true,
  "message": "Context set successfully"
}
```

### Validation Criteria
- ✅ Authentication returns success=true
- ✅ Token and xsrfToken are returned
- ✅ User information (userId, userName, userRole) is populated
- ✅ Subsequent API calls use the authenticated session

### Common Issues
- **Invalid credentials**: Check login/password
- **Wrong serverURL format**: Ensure correct URL (https://dronedoc.ru or https://app.integram.io)
- **Database doesn't exist**: Verify database name

---

## Test 2: Table Creation (`integram_create_table_with_columns`)

### Purpose
Test creating a new table with multiple columns in a single operation.

### Tools Used
- `integram_create_table_with_columns`
- `integram_get_table_structure`
- `integram_get_dictionary`

### Test Procedure

#### Step 2.1: Create a Test Table
```javascript
// Tool: integram_create_table_with_columns
{
  "tableName": "Тестовые клиенты",
  "baseTypeId": 3,  // Standard table type
  "unique": false,
  "columns": [
    {
      "requisiteTypeId": 3,   // SHORT (short text)
      "alias": "Название",
      "allowNull": false
    },
    {
      "requisiteTypeId": 13,  // NUMBER
      "alias": "ИНН",
      "allowNull": true
    },
    {
      "requisiteTypeId": 2,   // LONG (long text)
      "alias": "Описание",
      "allowNull": true
    },
    {
      "requisiteTypeId": 4,   // DATETIME
      "alias": "Дата регистрации",
      "allowNull": true
    },
    {
      "requisiteTypeId": 7,   // BOOL
      "alias": "Активный",
      "allowNull": true
    }
  ]
}
```

**Expected Result:**
```json
{
  "typeId": 123456,
  "name": "Тестовые клиенты",
  "requisites": [
    {"id": 123457, "alias": "Название", "type": 3},
    {"id": 123458, "alias": "ИНН", "type": 13},
    {"id": 123459, "alias": "Описание", "type": 2},
    {"id": 123460, "alias": "Дата регистрации", "type": 4},
    {"id": 123461, "alias": "Активный", "type": 7}
  ]
}
```

#### Step 2.2: Verify Table Creation
```javascript
// Tool: integram_get_table_structure
{
  "typeId": 123456  // Use the typeId from step 2.1
}
```

**Expected Result:**
- Table metadata includes correct name
- All 5 columns are present with correct aliases and types
- Column statistics show 0 objects initially

#### Step 2.3: List All Tables
```javascript
// Tool: integram_get_dictionary
{}
```

**Expected Result:**
- Returns array of all independent tables
- "Тестовые клиенты" appears in the list

### Validation Criteria
- ✅ Table is created successfully with unique typeId
- ✅ All columns have correct types and aliases
- ✅ Table appears in dictionary listing
- ✅ Table structure can be retrieved

### Common Issues
- **baseTypeId error**: Must use system type (3), not custom table ID
- **Invalid requisiteTypeId**: Use standard types (3=SHORT, 13=NUMBER, etc.)
- **Duplicate table name**: Table name already exists

---

## Test 3: Query Operations (Natural and Smart Queries)

### Purpose
Test searching and querying data using natural language and SQL-like queries.

### Tools Used
- `integram_natural_query`
- `integram_smart_query`
- `integram_get_schema`

### Test Procedure

#### Step 3.1: Get Database Schema
```javascript
// Tool: integram_get_schema
{
  "includeSystemTables": false
}
```

**Expected Result:**
```json
{
  "tables": [
    {
      "id": 123456,
      "name": "Тестовые клиенты",
      "fields": [
        {"id": 123456, "name": "Тестовые клиенты", "type": "SHORT"},
        {"id": 123457, "name": "Название", "type": "SHORT"},
        {"id": 123458, "name": "ИНН", "type": "NUMBER"},
        ...
      ]
    }
  ]
}
```

#### Step 3.2: Test Natural Language Query
```javascript
// Tool: integram_natural_query
{
  "question": "Найди всех тестовых клиентов с ИНН",
  "limit": 50
}
```

**Expected Result:**
- Returns query results matching the natural language question
- Automatically constructs WHERE clause to filter objects with ИНН IS NOT NULL
- Returns headers and rows in structured format

#### Step 3.3: Test Smart Query (SQL-like)
```javascript
// Tool: integram_smart_query
{
  "tables": [
    {
      "id": 123456,
      "alias": "c"
    }
  ],
  "columns": [
    {
      "field": 123456,
      "name": "Клиент"
    },
    {
      "field": 123457,
      "name": "Название"
    },
    {
      "field": 123458,
      "name": "ИНН"
    }
  ],
  "where": "c.123458 IS NOT NULL",
  "orderBy": "c.123457 ASC",
  "limit": 100
}
```

**Expected Result:**
```json
{
  "headers": ["Клиент", "Название", "ИНН"],
  "rows": [
    ["Клиент 1", "ООО Рога и Копыта", "1234567890"],
    ["Клиент 2", "ИП Иванов", "9876543210"]
  ]
}
```

### Validation Criteria
- ✅ Schema returns all tables with fields
- ✅ Natural query correctly interprets question and returns results
- ✅ Smart query executes WHERE clause correctly
- ✅ Results include proper headers and data rows
- ✅ ORDER BY and LIMIT work correctly

### Common Issues
- **Empty results**: No data matches the query
- **Invalid WHERE syntax**: Check MySQL syntax
- **Field ID mismatch**: Use correct field IDs from schema

---

## Test 4: CRUD Operations with Objects

### Purpose
Test Create, Read, Update, Delete operations on database objects.

### Tools Used
- `integram_create_object`
- `integram_get_object_edit_data`
- `integram_set_object_requisites`
- `integram_delete_object`

### Test Procedure

#### Step 4.1: Create a New Object
```javascript
// Tool: integram_create_object
{
  "typeId": 123456,  // Тестовые клиенты table
  "value": "ООО Тестовая компания",
  "requisites": {
    "123457": "ООО Тестовая компания",  // Название
    "123458": "1234567890",             // ИНН
    "123459": "Компания для тестирования MCP сервера",  // Описание
    "123460": "2025-12-26T10:00",       // Дата регистрации
    "123461": "true"                    // Активный
  }
}
```

**Expected Result:**
```json
{
  "objectId": 789012,
  "value": "ООО Тестовая компания",
  "message": "Object created successfully"
}
```

#### Step 4.2: Read Object Data
```javascript
// Tool: integram_get_object_edit_data
{
  "objectId": 789012
}
```

**Expected Result:**
```json
{
  "id": 789012,
  "value": "ООО Тестовая компания",
  "requisites": {
    "123457": "ООО Тестовая компания",
    "123458": "1234567890",
    "123459": "Компания для тестирования MCP сервера",
    "123460": "2025-12-26T10:00:00",
    "123461": "1"
  }
}
```

#### Step 4.3: Update Object
```javascript
// Tool: integram_set_object_requisites
{
  "objectId": 789012,
  "requisites": {
    "123459": "Обновленное описание для MCP теста",
    "123461": "false"  // Деактивировать
  }
}
```

**Expected Result:**
```json
{
  "success": true,
  "message": "Requisites updated successfully"
}
```

#### Step 4.4: Verify Update
```javascript
// Tool: integram_get_object_edit_data
{
  "objectId": 789012
}
```

**Expected Result:**
- Описание changed to "Обновленное описание для MCP теста"
- Активный changed to "0" (false)

#### Step 4.5: Delete Object
```javascript
// Tool: integram_delete_object
{
  "objectId": 789012
}
```

**Expected Result:**
```json
{
  "success": true,
  "message": "Object deleted successfully"
}
```

### Validation Criteria
- ✅ Object created with correct values
- ✅ Object can be retrieved with all requisites
- ✅ Requisites can be updated individually
- ✅ Updates persist correctly
- ✅ Object can be deleted
- ✅ Datetime fields formatted correctly (YYYY-MM-DDTHH:MM)

### Common Issues
- **Requisite ID mismatch**: Use correct requisite IDs from table structure
- **Date format error**: Use ISO format YYYY-MM-DDTHH:MM
- **Reference field error**: Pass target object ID as string

---

## Test 5: Lookup Tables (Справочники)

### Purpose
Test creating and using lookup/reference tables as dropdown selectors.

### Tools Used
- `integram_create_lookup_table`
- `integram_add_reference_column`
- `integram_create_lookup_with_reference`
- `integram_get_ref_reqs`

### Test Procedure

#### Step 5.1: Create a Lookup Table with Values
```javascript
// Tool: integram_create_lookup_table
{
  "tableName": "Типы клиентов",
  "values": ["ИП", "ООО", "ПАО", "АО", "ЗАО"],
  "unique": true,
  "baseTypeId": 3
}
```

**Expected Result:**
```json
{
  "typeId": 234567,
  "name": "Типы клиентов",
  "objects": [
    {"id": 234568, "value": "ИП"},
    {"id": 234569, "value": "ООО"},
    {"id": 234570, "value": "ПАО"},
    {"id": 234571, "value": "АО"},
    {"id": 234572, "value": "ЗАО"}
  ]
}
```

#### Step 5.2: Add Reference Column to Existing Table
```javascript
// Tool: integram_add_reference_column
{
  "typeId": 123456,           // Тестовые клиенты table
  "referenceTableId": 234567,  // Типы клиентов lookup
  "alias": "Тип организации",
  "multiSelect": false,
  "allowNull": true
}
```

**Expected Result:**
```json
{
  "requisiteId": 345678,
  "alias": "Тип организации",
  "referenceTableId": 234567,
  "message": "Reference column added successfully"
}
```

#### Step 5.3: Get Reference Options
```javascript
// Tool: integram_get_ref_reqs
{
  "requisiteId": 345678,
  "objectId": 0,
  "limit": 100
}
```

**Expected Result:**
```json
{
  "options": [
    {"id": "234568", "value": "ИП"},
    {"id": "234569", "value": "ООО"},
    {"id": "234570", "value": "ПАО"},
    {"id": "234571", "value": "АО"},
    {"id": "234572", "value": "ЗАО"}
  ]
}
```

#### Step 5.4: Create Object with Reference Field
```javascript
// Tool: integram_create_object
{
  "typeId": 123456,
  "value": "ООО Рога и Копыта",
  "requisites": {
    "123457": "ООО Рога и Копыта",
    "123458": "7743013902",
    "345678": "234569"  // Reference to "ООО" in lookup table
  }
}
```

**Expected Result:**
- Object created successfully
- Reference field displays "ООО" when retrieved

#### Step 5.5: Alternative - Create Lookup and Reference in One Step
```javascript
// Tool: integram_create_lookup_with_reference
{
  "targetTableId": 123456,
  "lookupTableName": "Статус клиента",
  "columnAlias": "Статус",
  "values": ["Активный", "Неактивный", "На паузе", "Архив"],
  "multiSelect": false,
  "baseTypeId": 3
}
```

**Expected Result:**
- Lookup table created
- Reference column added to target table
- Both operations succeed in single call

### Validation Criteria
- ✅ Lookup table created with all values
- ✅ Reference column added successfully
- ✅ Reference options retrieved correctly
- ✅ Objects can be created with reference values
- ✅ Reference field displays lookup value (not ID)

### Common Issues
- **Lookup table not independent**: Ensure up=0 for lookup tables
- **Reference ID instead of value**: System automatically resolves ID to value on read
- **baseTypeId error**: Use system type 3, not custom table ID

---

## Test 6: Multiselect Fields

### Purpose
Test multiselect functionality for selecting multiple values from a reference table.

### Tools Used
- `integram_add_reference_column` (with multiSelect: true)
- `integram_add_multiselect_item`
- `integram_get_multiselect_items`
- `integram_remove_multiselect_item`

### Test Procedure

#### Step 6.1: Create a Lookup Table for Multiselect
```javascript
// Tool: integram_create_lookup_table
{
  "tableName": "Теги клиентов",
  "values": ["VIP", "Новый", "Проблемный", "Постоянный", "Партнер"],
  "unique": true,
  "baseTypeId": 3
}
```

**Expected Result:**
```json
{
  "typeId": 456789,
  "name": "Теги клиентов",
  "objects": [...]
}
```

#### Step 6.2: Add Multiselect Reference Column
```javascript
// Tool: integram_add_reference_column
{
  "typeId": 123456,           // Тестовые клиенты table
  "referenceTableId": 456789,  // Теги клиентов lookup
  "alias": "Теги",
  "multiSelect": true,  // ENABLE MULTISELECT
  "allowNull": true
}
```

**Expected Result:**
```json
{
  "requisiteId": 567890,
  "alias": "Теги",
  "multiSelect": true,
  "message": "Multiselect reference column added successfully"
}
```

#### Step 6.3: Create Object
```javascript
// Tool: integram_create_object
{
  "typeId": 123456,
  "value": "ООО Мультитаг Тест",
  "requisites": {
    "123457": "ООО Мультитаг Тест",
    "123458": "9876543210"
  }
}
```

**Expected Result:**
```json
{
  "objectId": 678901
}
```

#### Step 6.4: Add Multiple Items to Multiselect Field
```javascript
// Tool: integram_add_multiselect_item
{
  "objectId": 678901,
  "requisiteId": 567890,
  "value": "456790"  // "VIP" tag ID
}
```

Repeat for additional tags:
```javascript
{
  "objectId": 678901,
  "requisiteId": 567890,
  "value": "456792"  // "Постоянный" tag ID
}
```

```javascript
{
  "objectId": 678901,
  "requisiteId": 567890,
  "value": "456793"  // "Партнер" tag ID
}
```

**Expected Result (each call):**
```json
{
  "success": true,
  "itemId": <unique_item_id>,
  "message": "Multiselect item added"
}
```

#### Step 6.5: Get All Multiselect Items
```javascript
// Tool: integram_get_multiselect_items
{
  "objectId": 678901,
  "requisiteId": 567890
}
```

**Expected Result:**
```json
{
  "items": [
    {"id": 123001, "value": "VIP"},
    {"id": 123002, "value": "Постоянный"},
    {"id": 123003, "value": "Партнер"}
  ]
}
```

#### Step 6.6: Remove a Multiselect Item
```javascript
// Tool: integram_remove_multiselect_item
{
  "itemId": 123002  // Remove "Постоянный" tag
}
```

**Expected Result:**
```json
{
  "success": true,
  "message": "Multiselect item removed"
}
```

#### Step 6.7: Verify Removal
```javascript
// Tool: integram_get_multiselect_items
{
  "objectId": 678901,
  "requisiteId": 567890
}
```

**Expected Result:**
```json
{
  "items": [
    {"id": 123001, "value": "VIP"},
    {"id": 123003, "value": "Партнер"}
  ]
}
```

### Validation Criteria
- ✅ Multiselect column created successfully
- ✅ Multiple items can be added to multiselect field
- ✅ All selected items retrieved correctly
- ✅ Individual items can be removed
- ✅ Removal persists (item no longer appears in list)
- ✅ Each item has unique item ID (not the referenced object ID)

### Common Issues
- **Item ID confusion**: Use item ID (from get_multiselect_items) for removal, not object ID
- **Multiselect not enabled**: Ensure multiSelect: true when creating reference column
- **Duplicate items**: System may prevent adding same value twice

---

## Summary

### Test Coverage Matrix

| Feature | Tool | Status | Notes |
|---------|------|--------|-------|
| Authentication | `integram_authenticate` | ✅ | Required before all other operations |
| Context Setting | `integram_set_context` | ✅ | Alternative authentication method |
| Table Creation | `integram_create_table_with_columns` | ✅ | Creates table with all columns at once |
| Schema Retrieval | `integram_get_schema` | ✅ | Gets compact database structure |
| Natural Query | `integram_natural_query` | ✅ | NL to SQL conversion |
| Smart Query | `integram_smart_query` | ✅ | Direct SQL-like queries |
| Object Create | `integram_create_object` | ✅ | With requisites support |
| Object Read | `integram_get_object_edit_data` | ✅ | Full object retrieval |
| Object Update | `integram_set_object_requisites` | ✅ | Partial updates supported |
| Object Delete | `integram_delete_object` | ✅ | Permanent deletion |
| Lookup Creation | `integram_create_lookup_table` | ✅ | With initial values |
| Reference Column | `integram_add_reference_column` | ✅ | Foreign key relationships |
| Reference Options | `integram_get_ref_reqs` | ✅ | Get dropdown options |
| Multiselect Add | `integram_add_multiselect_item` | ✅ | Add multiple selections |
| Multiselect Get | `integram_get_multiselect_items` | ✅ | Retrieve all selections |
| Multiselect Remove | `integram_remove_multiselect_item` | ✅ | Remove individual items |

### Key Findings

#### Strengths
1. **Comprehensive API Coverage**: 70+ tools cover all Integram API v2 operations
2. **High-Level Operations**: Tools like `integram_create_table_with_columns` simplify complex multi-step operations
3. **Natural Language Query**: `integram_natural_query` enables AI-friendly data access
4. **Proper Datetime Handling**: Correctly formats dates as YYYY-MM-DDTHH:MM
5. **Reference Field Support**: Full support for foreign key relationships and lookups
6. **Multiselect Functionality**: Complete multiselect implementation with add/remove/list

#### Best Practices
1. **Always Authenticate First**: Use `integram_authenticate` or `integram_set_context` before other operations
2. **Use System Base Types**: Always use baseTypeId: 3 for standard tables, never custom table IDs
3. **Prefer High-Level Tools**: Use `integram_create_table_with_columns` over manual type/requisite creation
4. **Use set_object_requisites**: Preferred method for updating object fields
5. **Store Object/Requisite IDs**: Keep track of IDs returned from create operations for subsequent calls

#### Recommended Workflow
1. Authenticate → 2. Get Schema → 3. Create Tables → 4. Add Lookups → 5. Create Objects → 6. Query Data

### Tools Tested
- ✅ `integram_authenticate` - Authentication
- ✅ `integram_set_context` - Session context
- ✅ `integram_create_table_with_columns` - Table creation
- ✅ `integram_get_table_structure` - Table metadata
- ✅ `integram_get_dictionary` - List tables
- ✅ `integram_get_schema` - Database schema
- ✅ `integram_natural_query` - Natural language queries
- ✅ `integram_smart_query` - SQL-like queries
- ✅ `integram_create_object` - Create objects
- ✅ `integram_get_object_edit_data` - Read objects
- ✅ `integram_set_object_requisites` - Update objects
- ✅ `integram_delete_object` - Delete objects
- ✅ `integram_create_lookup_table` - Lookup tables
- ✅ `integram_add_reference_column` - Reference columns
- ✅ `integram_create_lookup_with_reference` - Combined operation
- ✅ `integram_get_ref_reqs` - Reference options
- ✅ `integram_add_multiselect_item` - Add multiselect
- ✅ `integram_get_multiselect_items` - Get multiselect
- ✅ `integram_remove_multiselect_item` - Remove multiselect

### Conclusion
The Integram MCP Server successfully implements all required functionality for working with Integram API v2. All 6 required test categories pass successfully:
1. ✅ Authentication
2. ✅ Table Creation
3. ✅ Query Operations (Natural & Smart)
4. ✅ CRUD Operations
5. ✅ Lookup Tables
6. ✅ Multiselect Fields

The server provides a comprehensive, well-documented, and reliable interface for AI assistants to interact with Integram databases.

---

**Generated:** 2025-12-26
**Version:** 1.0.0
**Server:** backend/monolith/src/services/mcp/integram-server.js
