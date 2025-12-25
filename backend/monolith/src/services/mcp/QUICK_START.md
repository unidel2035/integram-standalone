# MCP Quick Start Guide

## 🚀 5-Minute Setup

This guide gets you up and running with MCP in 5 minutes for the distributed architecture where Claude CLI runs on one server and backend runs on `dev.drondoc.ru`.

## Prerequisites

- Node.js installed (check: `node --version`)
- Network access to `dev.drondoc.ru`
- Claude CLI installed

## Step 1: Verify Backend is Running

```bash
curl https://dev.drondoc.ru/api/health
```

**Expected response**:
```json
{
  "status": "healthy",
  "uptime": 12345.67
}
```

✅ If you see this, backend is ready!

❌ If connection fails, contact DevOps team.

## Step 2: Verify MCP Tools are Available

```bash
curl https://dev.drondoc.ru/api/mcp/integram/tools
```

**Expected response**:
```json
{
  "success": true,
  "tools": [...],
  "count": 27
}
```

✅ 27 tools available? Great!

## Step 3: Check Local Configuration

Navigate to project root and verify `.claude/mcp.json` exists:

```bash
cat .claude/mcp.json
```

**Should contain**:
```json
{
  "mcpServers": {
    "integram": {
      "command": "node",
      "args": [
        "backend/monolith/src/services/mcp/http-mcp-bridge.js"
      ],
      "env": {
        "MCP_SERVER_URL": "https://dev.drondoc.ru",
        "MCP_API_PATH": "/api/mcp/integram"
      }
    }
  }
}
```

✅ Configuration looks correct!

## Step 4: Start Claude CLI

```bash
claude
```

Claude CLI will:
1. Read `.claude/mcp.json`
2. Spawn `http-mcp-bridge.js`
3. Connect to remote backend
4. Load 27 MCP tools

## Step 5: Test MCP Connection

In Claude CLI, ask:

```
What MCP tools do you have available?
```

**Expected**: Claude should list tools including:
- `integram_authenticate`
- `integram_get_dictionary`
- `integram_create_object`
- ... and 24 more

✅ Tools listed? Setup complete!

## Step 6: Authenticate with Integram

```
Authenticate with Integram using these credentials:
- Server: https://dronedoc.ru
- Database: a2025
- Login: d
- Password: d
```

**Expected**: Claude uses `integram_authenticate` tool and shows:
```
✓ Authentication successful
Token: ***
User: Администратор (ID: 1)
```

✅ Authenticated? You're ready to use MCP!

## Common Tasks

### List All Types in Database

```
Show me all types in the Integram database
```

Claude will use `integram_get_dictionary` tool.

### Create a New Object

```
Create a new object:
- Type ID: 42
- Name: "Test Project"
- Description: "My test project"
```

Claude will use `integram_create_object` tool.

### Get Object Details

```
Show me details of object with ID 123
```

Claude will use `integram_get_object_edit_data` tool.

### Execute a Query

```
Get all objects of type 42, show first 10 results
```

Claude will use `integram_get_object_list` tool.

## Troubleshooting

### Problem: "MCP server not found"

**Solution**:
```bash
# Check bridge script exists
ls backend/monolith/src/services/mcp/http-mcp-bridge.js

# Verify Node.js in PATH
which node
```

### Problem: "Cannot connect to backend"

**Solution**:
```bash
# Test backend connectivity
curl https://dev.drondoc.ru/api/health

# Check firewall/VPN settings
ping dev.drondoc.ru
```

### Problem: "SSL certificate error"

**Solution**: Bridge already bypasses SSL for dev server. If error persists:
```bash
# Check bridge has SSL bypass
grep "rejectUnauthorized" backend/monolith/src/services/mcp/http-mcp-bridge.js
```

### Problem: "Authentication failed"

**Solution**:
- Verify credentials (server URL, database, login, password)
- Check Integram API is accessible: `curl https://dronedoc.ru`
- Ensure database name is correct: `a2025`

### Problem: "Tool execution timeout"

**Solution**:
- Large queries may take time
- Use pagination: limit results to 50-100 per request
- Check Integram API performance

## Next Steps

### Learn More

1. **Distributed Architecture**: Read [DISTRIBUTED_MCP_ARCHITECTURE.md](./DISTRIBUTED_MCP_ARCHITECTURE.md)
2. **HTTP API Usage**: Read [HTTP_MCP_USAGE.md](./HTTP_MCP_USAGE.md)
3. **All 27 Tools**: Read [INTEGRAM_MCP_README.md](./INTEGRAM_MCP_README.md)
4. **Claude Code Setup**: Read [CLAUDE_CODE_SETUP.md](./CLAUDE_CODE_SETUP.md)

### Try Advanced Features

#### AI-Powered Database Chat

Use the chat endpoint to ask questions about your database:

```bash
curl -X POST https://dev.drondoc.ru/api/mcp/integram/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me all project types and their object counts",
    "serverURL": "https://dronedoc.ru",
    "database": "a2025",
    "token": "your-token",
    "xsrfToken": "your-xsrf"
  }'
```

AI will automatically use MCP tools to answer your question.

#### Create Complex Structures

```
Create a new type called "Tasks" with these requisites:
- Title (SHORT text)
- Description (LONG text)
- Due Date (DATETIME)
- Priority (NUMBER)
- Status (SHORT text)

Then create 3 sample task objects.
```

Claude will orchestrate multiple tool calls to complete this.

#### Generate Reports

```
Execute report ID 10 and summarize the results
```

Claude will use `integram_execute_report` and present data clearly.

## Configuration Options

### Use Different Backend

To point to staging or production backend:

```json
{
  "mcpServers": {
    "integram": {
      "command": "node",
      "args": ["backend/monolith/src/services/mcp/http-mcp-bridge.js"],
      "env": {
        "MCP_SERVER_URL": "https://staging.drondoc.ru",
        "MCP_API_PATH": "/api/mcp/integram"
      }
    }
  }
}
```

### Use Local MCP Server

For offline development (no HTTP bridge):

```json
{
  "mcpServers": {
    "integram-local": {
      "command": "node",
      "args": [
        "backend/monolith/src/services/mcp/integram-server.js"
      ]
    }
  }
}
```

**Note**: Requires local backend setup.

### Multiple Servers

Run both remote and local for comparison:

```json
{
  "mcpServers": {
    "integram-remote": {
      "command": "node",
      "args": ["backend/monolith/src/services/mcp/http-mcp-bridge.js"],
      "env": {
        "MCP_SERVER_URL": "https://dev.drondoc.ru",
        "MCP_API_PATH": "/api/mcp/integram"
      }
    },
    "integram-local": {
      "command": "node",
      "args": ["backend/monolith/src/services/mcp/integram-server.js"]
    }
  }
}
```

Claude will have access to both.

## Performance Tips

1. **Use Pagination**: Don't fetch all objects at once
   ```
   Get first 50 objects of type 42
   ```

2. **Cache Type Metadata**: Save frequently used type/requisite info
   ```
   Show me metadata for type 42 and save it for future reference
   ```

3. **Batch Operations**: Group multiple creates/updates
   ```
   Create 5 objects in type 42 with these values: [...]
   ```

4. **Use Specific Queries**: Avoid broad queries
   ```
   Get objects of type 42 where requisite 101 = "Active"
   ```

## Security Reminders

🔒 **Best Practices**:

- ✅ Never commit credentials to git
- ✅ Use environment variables for sensitive data
- ✅ Rotate tokens regularly
- ✅ Use read-only accounts for queries
- ✅ Use test database for experiments

❌ **Don't**:
- Store passwords in config files
- Share tokens publicly
- Use production database for testing
- Disable SSL in production

## Support

Need help?

1. Check [Troubleshooting](#troubleshooting) section
2. Verify backend health: `curl https://dev.drondoc.ru/api/health`
3. Check Claude CLI logs
4. Review [DISTRIBUTED_MCP_ARCHITECTURE.md](./DISTRIBUTED_MCP_ARCHITECTURE.md)
5. Create issue in repository with error details

## Monitoring

### Check MCP Status

```bash
# Backend health
curl https://dev.drondoc.ru/api/health

# MCP tools count
curl https://dev.drondoc.ru/api/mcp/integram/tools | jq '.count'

# Should return: 27
```

### View Logs

```bash
# Claude CLI logs (if available)
tail -f ~/.claude/logs/mcp.log

# Backend logs (requires server access)
ssh dev.drondoc.ru
pm2 logs orchestrator
```

## Changelog

- **2025-11-15**: Added distributed architecture documentation
- **2025-11-10**: HTTP MCP bridge implementation
- **2025-11-01**: Initial MCP server release

---

**You're all set!** 🎉

Start using MCP tools through Claude CLI to interact with Integram database using natural language.
