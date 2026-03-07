# Glossary MCP Tool Documentation

## Overview

The Glossary MCP Tool provides AI agents with programmatic access to the VentureOS glossary of 65+ venture capital and financial terms.

**Issue:** #114 - feat(education): страница /fst-glossary

## API Endpoints

### Base URL
```
https://dev.drondoc.ru/api/fst
```

### Authentication
All endpoints require API token authentication via header:
```
Authorization: Bearer {token}
```

### Endpoints

#### 1. Get All Terms
```http
GET /api/fst/glossary/terms
```

**Query Parameters:**
- `category` (optional): Filter by category (financial, venture, ai, regulation, platform)
- `search` (optional): Search in title and definition

**Response:**
```json
{
  "success": true,
  "count": 65,
  "terms": [
    {
      "id": "irr",
      "title": "IRR — Внутренняя норма доходности",
      "category": "financial",
      "definition": "Ставка дисконтирования...",
      "formula": "IRR = 25% означает...",
      "example": "Фонд инвестировал...",
      "relatedTerms": ["moic", "dpi", "tvpi"],
      "context": "Ключевая метрика..."
    }
  ]
}
```

#### 2. Get Specific Term (MCP Tool)
```http
GET /api/fst/glossary/term/:termId
```

**Parameters:**
- `termId`: Term identifier (lowercase, e.g., "irr", "moic", "cap-table")

**Example:**
```bash
curl -H "Authorization: Bearer {token}" \
  https://dev.drondoc.ru/api/fst/glossary/term/irr
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
    "formula": "...",
    "example": "...",
    "relatedTerms": ["moic", "dpi", "tvpi"],
    "context": "..."
  }
}
```

#### 3. Get Categories
```http
GET /api/fst/glossary/categories
```

**Response:**
```json
{
  "success": true,
  "categories": [
    { "id": "financial", "label": "Финансовые метрики", "icon": "pi-chart-line" },
    { "id": "venture", "label": "Венчурные термины", "icon": "pi-briefcase" },
    { "id": "ai", "label": "AI & Технологии", "icon": "pi-sparkles" },
    { "id": "regulation", "label": "Регулирование", "icon": "pi-shield" },
    { "id": "platform", "label": "Платформа", "icon": "pi-desktop" }
  ]
}
```

## Usage in AI Agents

### Claude Agent Example
```python
# In MCP tool definition
{
  "name": "get_term_definition",
  "description": "Get definition of venture capital term from VentureOS glossary",
  "parameters": {
    "term": {
      "type": "string",
      "description": "Term ID (e.g., 'irr', 'moic', 'term-sheet')"
    }
  }
}

# Tool implementation
def get_term_definition(term: str) -> dict:
    response = requests.get(
        f"https://dev.drondoc.ru/api/fst/glossary/term/{term.lower()}",
        headers={"Authorization": f"Bearer {API_TOKEN}"}
    )
    return response.json()
```

### Agent Workflow Example
```
User: "Что такое IRR нашего фонда?"

Agent thoughts:
1. User asks about IRR
2. Need to understand what IRR means
3. Call get_term_definition("irr")
4. Get definition: "Внутренняя норма доходности..."
5. Then query portfolio data for actual IRR value

Agent response:
"IRR (Внутренняя норма доходности) — это ставка дисконтирования,
при которой NPV равен нулю. Для нашего фонда IRR составляет
23.5% годовых, что превышает целевые 20%."
```

## Available Terms (65+)

### Financial Metrics (15)
- IRR, MOIC, DPI, TVPI, NAV, RVPI, ROI, ROE, EBITDA
- Fair Value, Carried Interest, Waterfall, Hurdle Rate, Management Fee, Catch-up

### Venture Terms (20)
- Term Sheet, Due Diligence, Cap Table, SPV, LP, GP
- Seed, Series A, Vesting, Cliff, Pro-rata, Anti-dilution
- Dilution, Option Pool, Down Round, Drag-along, Tag-along
- Veto Rights, Board Seat, Liquidation Preference, SHA

### AI & Platform (10)
- AI Committee, Screening, Digital Twin, KAG, MCP
- Integram, Token Router, DeepSeek, HyperFormula, Tick Engine
- RAG, Vector DB

### Regulation (5)
- AML, KYC, ILPA, ESG, Accredited Investor, PP-1726

### Venture Operations (15)
- Investment Memo, Runway, Burn Rate, Unit Economics
- LTV, CAC, Product-Market Fit, Pivot, Bridge Round
- SAFE, Convertible Note, Valuation

## Frontend Integration

The glossary is also available via the web UI:
- **URL:** `/fst-glossary`
- **Features:**
  - Instant search across all terms
  - Category filters
  - Interactive financial calculator
  - AI-powered simple explanations (DeepSeek)
  - Related terms navigation
  - Responsive design

## Rate Limits

- 1000 requests per 24 hours per API token
- Shared limit with other FST API endpoints

## Error Handling

**404 - Term Not Found:**
```json
{
  "success": false,
  "error": "Term not found",
  "message": "Термин \"xyz\" не найден в глоссарии"
}
```

**500 - Server Error:**
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Error details..."
}
```

## Future Enhancements

1. **Integram Storage:** Move glossary from in-memory to Integram database
2. **Multi-language:** Add English translations for international LP
3. **Examples:** Real portfolio data in examples (anonymized)
4. **History:** Track term definition changes over time
5. **Contributions:** Allow LP to suggest new terms

---

**Contact:** ФСТ НТИ Technical Team
**Last Updated:** 2026-03-07
