# MCP Glossary Tool for AI Agents

## Overview

The glossary API provides AI agents with access to venture capital terminology definitions through a RESTful API. This enables agents to answer questions about venture terms during analysis and conversations.

## API Endpoints

### Base URL
```
http://localhost:3100/api/glossary
```

### 1. Get All Terms
```http
GET /api/glossary/terms
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "terms": {
    "irr": {
      "id": "irr",
      "title": "IRR — Внутренняя норма доходности",
      "category": "financial",
      "definition": "Ставка дисконтирования...",
      "formula": "IRR = 25% означает..."
    }
  }
}
```

### 2. Get Specific Term
```http
GET /api/glossary/term/:id
```

**Example:**
```bash
curl http://localhost:3100/api/glossary/term/irr
```

**Response:**
```json
{
  "success": true,
  "term": {
    "id": "irr",
    "title": "IRR — Внутренняя норма доходности",
    "category": "financial",
    "definition": "...",
    "formula": "..."
  }
}
```

### 3. Search Terms
```http
POST /api/glossary/search
```

**Body:**
```json
{
  "query": "доходность"
}
```

**Response:**
```json
{
  "success": true,
  "query": "доходность",
  "count": 2,
  "results": [...]
}
```

### 4. MCP Tool: get_term_definition

**Endpoint for MCP integration:**
```http
POST /api/glossary/mcp/get_term_definition
```

**Body:**
```json
{
  "term": "irr"
}
```

**Response:**
```json
{
  "success": true,
  "term": {
    "id": "irr",
    "title": "IRR — Внутренняя норма доходности",
    "definition": "Ставка дисконтирования, при которой чистая приведённая стоимость (NPV) инвестиции равна нулю. Показывает эффективность инвестиций в % годовых.",
    "formula": "IRR = 25% означает: ₽1 млн → ₽1.25 млн через год",
    "category": "financial"
  }
}
```

## MCP Server Implementation

For full MCP server implementation with the Anthropic MCP protocol, you would create an MCP server that exposes this tool:

```javascript
// mcp-server/glossary.mjs
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = new Server({
  name: 'fst-glossary',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
})

// Register get_term_definition tool
server.setRequestHandler('tools/list', async () => ({
  tools: [{
    name: 'get_term_definition',
    description: 'Get definition of a venture capital term from the FST glossary',
    inputSchema: {
      type: 'object',
      properties: {
        term: {
          type: 'string',
          description: 'Term ID (e.g., "irr", "moic", "dpi") or term name to look up'
        }
      },
      required: ['term']
    }
  }]
}))

server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'get_term_definition') {
    const { term } = request.params.arguments

    const response = await fetch('http://localhost:3100/api/glossary/mcp/get_term_definition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term })
    })

    const data = await response.json()

    if (!data.success) {
      return {
        content: [{
          type: 'text',
          text: `Term "${term}" not found. ${data.error || ''}`
        }],
        isError: true
      }
    }

    const termData = data.term
    return {
      content: [{
        type: 'text',
        text: `**${termData.title}**\n\n${termData.definition}\n\n**Формула:** ${termData.formula}\n\n**Категория:** ${termData.category}`
      }]
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`)
})

// Start MCP server
const transport = new StdioServerTransport()
await server.connect(transport)
```

## Usage in Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "fst-glossary": {
      "command": "node",
      "args": ["path/to/mcp-server/glossary.mjs"]
    }
  }
}
```

## Available Terms (65+)

The glossary includes 65+ terms across 5 categories:

### Financial (20+)
IRR, MOIC, DPI, TVPI, RVPI, NAV, ROI, ROE, EBITDA, Burn Rate, Runway, Carried Interest, Waterfall, Hurdle Rate, Management Fee, Fair Value, Unit Economics, LTV, CAC, ARPU, MRR, ARR

### Venture (25+)
Cap Table, SPV, LP, GP, Term Sheet, Due Diligence, Down Round, Pro-rata, Cliff, Vesting, SAFE, Convertible Note, Liquidation Preference, Participating Preferred, Anti-Dilution, Full Ratchet, Weighted Average, Preemptive Right, ROFR, Tag-Along, Drag-Along, Bridge Round, Extension, Flat Round, Dilution, Option Pool, Investment Memo

### AI & Platform (10+)
AI-инвесткомитет, Скрининг, Digital Twin, KAG, MCP, RAG, Vector DB, Embedding, Knowledge Graph, Integram, Workspace Agent, Tool Calling

### Regulation (6+)
AML, KYC, ILPA, ESG, ПП-1726, ФСБУ 4/2023

### Platform (3)
Integram, Workspace Agent, Tool Calling

## Frontend Integration

The full glossary with all 65 terms is available at:
- **Frontend:** `src/data/glossary.js`
- **UI:** `/fst-glossary` page with search, filters, and interactive calculators
- **Modal:** Click any term to see details with AI explanations

## Notes

- The backend API (`backend/src/api/routes/glossary.js`) contains a subset of core terms for API access
- Full glossary with all 65 terms is maintained in `src/data/glossary.js` on the frontend
- Frontend and backend glossaries should be kept in sync for critical terms
- No authentication required for glossary endpoints (public knowledge base)
