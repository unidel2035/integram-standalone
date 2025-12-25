# FullCalendar MCP Server

Model Context Protocol (MCP) server for accessing DronDoc FullCalendar API.

## Overview

This MCP server provides AI-accessible tools for working with the FullCalendar system at `https://dronedoc.ru/fullcalendar/`.

## Architecture

```
┌─────────────────┐
│   AI Model      │
│ (DeepSeek, etc) │
└────────┬────────┘
         │
         │ MCP Protocol
         │
┌────────▼─────────┐
│  FullCalendar    │
│   MCP Server     │
└────────┬─────────┘
         │
         │ HTTP/HTTPS
         │
┌────────▼─────────┐
│  FullCalendar    │
│      API         │
│ (dronedoc.ru/    │
│  fullcalendar)   │
└──────────────────┘
```

## Features

### Available Tools

1. **fullcalendar_authenticate**
   - Authenticate with FullCalendar API
   - Arguments:
     - `baseURL` (string): FullCalendar base URL (e.g., `https://dronedoc.ru/fullcalendar`)
     - `login` (string): Username
     - `password` (string): Password

2. **fullcalendar_get_object**
   - Get calendar object by ID
   - Arguments:
     - `objectId` (number): Object ID

3. **fullcalendar_get_events**
   - Get calendar events
   - Arguments:
     - `start` (string, optional): Start date (YYYY-MM-DD)
     - `end` (string, optional): End date (YYYY-MM-DD)

4. **fullcalendar_get_users**
   - Get users/participants for calendar object
   - Arguments:
     - `objectId` (number): Object ID

5. **fullcalendar_count_users**
   - Count users/participants for calendar object
   - Arguments:
     - `objectId` (number): Object ID
   - Returns:
     - `objectId`: The object ID
     - `userCount`: Number of users
     - `users`: Array of user objects

## Installation

The FullCalendar MCP server is already integrated into the DronDoc monolith backend.

### Dependencies

Required npm packages (already in package.json):
- `@modelcontextprotocol/sdk` - MCP SDK
- `axios` - HTTP client

## Usage

### 1. Via MCP Routes (Recommended)

#### List Available Tools

```bash
GET /api/fullcalendar-mcp/tools
```

Response:
```json
{
  "success": true,
  "tools": [
    {
      "name": "fullcalendar_authenticate",
      "description": "Authenticate with FullCalendar API",
      "inputSchema": { ... }
    },
    ...
  ],
  "count": 5
}
```

#### Execute a Tool

```bash
POST /api/fullcalendar-mcp/execute
Content-Type: application/json

{
  "toolName": "fullcalendar_authenticate",
  "arguments": {
    "baseURL": "https://dronedoc.ru/fullcalendar",
    "login": "d",
    "password": "d"
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
        "text": "{\"success\":true,\"token\":\"...\",\"xsrf\":\"...\"}"
      }
    ]
  },
  "toolName": "fullcalendar_authenticate"
}
```

#### Quick User Count Endpoint

```bash
POST /api/fullcalendar-mcp/count-users
Content-Type: application/json

{
  "objectId": 18,
  "login": "d",
  "password": "d"
}
```

Response:
```json
{
  "success": true,
  "objectId": 18,
  "userCount": 2,
  "users": [
    {"id": 285, "val": "fullcalendar"},
    {"id": 291, "val": "d"}
  ]
}
```

### 2. Direct MCP Client Usage

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Initialize transport
const transport = new StdioClientTransport({
  command: 'node',
  args: ['backend/monolith/src/services/mcp/fullcalendar-server.js'],
});

// Create client
const client = new Client(
  { name: 'my-fullcalendar-client', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Connect
await client.connect(transport);

// Authenticate
const authResult = await client.callTool({
  name: 'fullcalendar_authenticate',
  arguments: {
    baseURL: 'https://dronedoc.ru/fullcalendar',
    login: 'username',
    password: 'password'
  }
});

// Count users
const countResult = await client.callTool({
  name: 'fullcalendar_count_users',
  arguments: { objectId: 18 }
});

console.log('User count:', countResult);

// Close client
await client.close();
```

## Example Workflows

### Example 1: Count users for object 18

```javascript
// Authenticate
await client.callTool({
  name: 'fullcalendar_authenticate',
  arguments: {
    baseURL: 'https://dronedoc.ru/fullcalendar',
    login: 'd',
    password: 'd'
  }
});

// Count users
const result = await client.callTool({
  name: 'fullcalendar_count_users',
  arguments: { objectId: 18 }
});

console.log('Result:', result);
// Output: { objectId: 18, userCount: 2, users: [
//   {id: 285, val: "fullcalendar"},
//   {id: 291, val: "d"}
// ]}
```

### Example 2: Get calendar object details

```javascript
// Get object
const objectData = await client.callTool({
  name: 'fullcalendar_get_object',
  arguments: { objectId: 18 }
});

console.log('Object data:', objectData);
```

### Example 3: Get calendar events

```javascript
// Get events for date range
const events = await client.callTool({
  name: 'fullcalendar_get_events',
  arguments: {
    start: '2025-01-01',
    end: '2025-01-31'
  }
});

console.log('Events:', events);
```

## Configuration

### Environment Variables

- `MCP_SERVER_URL`: FullCalendar base URL (default: `https://dronedoc.ru/fullcalendar`)

### Claude MCP Configuration

Add to `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "fullcalendar": {
      "command": "node",
      "args": [
        "backend/monolith/src/services/mcp/fullcalendar-server.js"
      ],
      "env": {
        "MCP_SERVER_URL": "https://dronedoc.ru/fullcalendar"
      }
    }
  }
}
```

## Error Handling

The MCP server provides comprehensive error handling:

1. **Authentication errors**: Returns error if credentials are invalid
2. **Not authenticated**: Returns error if trying to call tools without authentication
3. **Invalid arguments**: Returns error with validation message
4. **Network errors**: Returns error with connection details
5. **API errors**: Returns FullCalendar API error messages

Error response format:
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"error\":\"Not authenticated\",\"tool\":\"fullcalendar_get_object\",\"arguments\":{\"objectId\":18}}"
    }
  ],
  "isError": true
}
```

## Troubleshooting

### Server won't start
- Check that Node.js is installed
- Verify `@modelcontextprotocol/sdk` is in package.json
- Check file permissions on `fullcalendar-server.js`

### Authentication fails
- Verify base URL is correct
- Check credentials are valid
- Ensure network connectivity to FullCalendar server

### Tools not listed
- Check MCP client connection
- Verify server is running
- Check logs for errors

### Tool execution fails
- Ensure authentication is completed first
- Verify tool arguments match schema
- Check network connectivity

## Comparison with Integram MCP

| Feature | Integram MCP | FullCalendar MCP |
|---------|--------------|------------------|
| Purpose | Database operations (DDL/DML) | Calendar and events |
| Endpoint | `/a2025/`, `/api/{db}/` | `/fullcalendar/` |
| Tools | 27+ tools | 5 tools |
| Focus | CRUD operations | Calendar objects, events, users |
| Authentication | Per-database | Single fullcalendar instance |

## Security Considerations

1. **Credentials**: Never expose credentials in logs or error messages
2. **Token management**: Tokens are session-specific
3. **Authentication required**: Most tools require authentication
4. **HTTPS only**: Always use HTTPS for FullCalendar API

## Testing

Create test file `backend/monolith/src/services/mcp/__tests__/fullcalendar-server.test.js` for testing the MCP server.

Run tests:
```bash
cd backend/monolith
npm test -- fullcalendar-server.test.js
```

## Contributing

When adding new tools:

1. Add tool definition to `TOOLS` array
2. Add case handler in `CallToolRequestSchema` handler
3. Add method to `FullCalendarClient` class
4. Add tests
5. Update this documentation

## License

Part of the DronDoc project. See main project LICENSE file.

## Support

For issues or questions:
- Create an issue in the DronDoc repository
- Check FullCalendar API documentation

## Related

- Integram MCP Server: `INTEGRAM_MCP_README.md`
- MCP Setup Guide: `/MCP_SETUP.md`
- MCP Catalog: `/docs/MCP_SERVERS_CATALOG.md`
