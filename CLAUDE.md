# CLAUDE.md — VentureOS Project Context

## Project Overview

This is **VentureOS** — an AI-powered venture fund management platform. The platform covers the full investment lifecycle: deal sourcing → AI committee → deal structuring → post-investment monitoring → exit.

**Repository:** https://github.com/unidel2035/found  
**Live platform:** https://dev.drondoc.ru  
**Production:** https://drondoc.ru

---

## Architecture Summary

### Frontend
- **Vue 3** + Composition API, **Vite** build
- **PrimeVue** — UI components (use CSS variables for theming, never hardcode dark/light colors)
- **Pinia** — state management
- **vue-router** — routing
- **HyperFormula** — financial formula engine
- Main source: `src/views/pages/` (one `.vue` file per route)

### Backend
- **Node.js ESM monolith** at `backend/monolith/`
- **Express.js** REST API
- **Socket.io** WebSocket
- Services run via **systemd** (NOT pm2):
  - `dronedoc-backend.service`
  - `dronedoc-frontend.service`
  - `dronedoc-telegram-bot.service`

### Data Layer
- **Integram** — primary database (NoSQL + graph, accessed via MCP tools or REST API)
  - Server: `ai2o.ru`
  - Auth: POST `/{db}/auth`, returns `{token, _xsrf}`, use `X-Authorization: {token}` header
  - `_xsrf` goes in **request BODY**, not header
- **KAG** — Knowledge Augmented Graph for ontology and semantic search
- **SQLite** — ephemeral local cache only

### AI
- **Token router** — all AI calls go through `/api/ai-tokens/chat`
- **Providers**: DeepSeek (default), Claude, GPT-4o, YandexGPT
- **MCP** (Model Context Protocol) — agents call 60+ Integram tools
- Frontend: use `getDefaultToken(userId)` from `@/services/aiTokenService`

---

## Key Modules and Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/fst` | `FstHub.vue` | Central hub — all FST fund modules |
| `/fst-committee` | `FstCommittee.vue` | AI investment committee (6 agents, 3-round debate) |
| `/fst-deal` | `FstDeal.vue` | Deal structuring (Term Sheet, SPV, tranches, KPIs) |
| `/fst-portfolio` | `FstPortfolio.vue` | Portfolio monitoring (traffic lights, sensors, AI reports) |
| `/fst-execution` | `FstExecution.vue` | Post-investment (Kanban, KPI tracking, fund interventions) |
| `/fst-twin` | `FstDigitalTwin.vue` | Company digital twin simulation |
| `/fst-fund` | `FstFundTwin.vue` | Fund-level simulation (NAV, IRR, sub-funds) |
| `/nti-simulator` | `NtiSimulator.vue` | NTI agent configuration simulator |
| `/onto` | `OntologySpace.vue` | Ontology hub (KAG-based) |

---

## Development Rules

### MUST follow
1. **Branch**: always use `dev`
2. **Services**: restart via systemd, NEVER `npm run dev` manually
3. **Database**: ONLY Integram MCP for DB operations (no raw SQL, no Postgres/MySQL)
4. **AI calls**: ALWAYS through token router (`/api/ai-tokens/chat`)
5. **Theming**: use PrimeVue CSS variables (`var(--p-surface-card)`) — never hardcode colors
6. **Testing**: every module needs tests (unit + e2e)
7. **Docs**: update `src/config/routeDescriptions.js` and `src/views/pages/Spaces.vue` for every new route

### New Route Checklist
- [ ] Add to `src/router/index.js`
- [ ] Add description to `src/config/routeDescriptions.js`
- [ ] Add card to `src/views/pages/Spaces.vue`
- [ ] Create component in `src/views/pages/`
- [ ] Write unit test in `src/__tests__/`

### Financial Models (TemplateRenderer)
- Templates: `src/templates/finmodel/*.json`
- Sheet items: `type: "input"` (user fills) or `type: "formula"` (calculated)
- Cross-sheet refs: `[ItemName]` resolves globally across all sheets
- IRR: approximate via nested IF chains (no Newton-Raphson in HyperFormula)

### FST Policy Pattern
```javascript
const FST_POLICY_DEFAULTS = { maxCheck: 30, minIrr: 25, ... }
const FST_POLICY_RANGES = { maxCheck: { min: 10, max: 60 }, ... }
```
Use sliders bound to `fundPolicy` reactive object.

### Digital Twin / Simulation Pattern
```javascript
// Tick-based simulation
const simTimer = ref(null)
const tickSpeed = ref(1000)
function toggleRun() { /* setInterval → tick() */ }
function tick() { /* update metrics, generate events from pool */ }
```
Event pool: array of `{ id, label, probability, effect: fn }` objects.

---

## Integram API Quick Reference

```javascript
// Auth
POST https://ai2o.ru/{db}/auth
body: login=d&pwd=d
→ { token, _xsrf }

// Headers for all requests
X-Authorization: {token}

// XSRF for POST requests — in BODY, not header!
body: _xsrf={_xsrf}&...

// Create object
POST /{db}/_m_new/{typeId}
body: _xsrf={_xsrf}&t{typeId}={name}&r{reqId}={value}

// Update object  
POST /{db}/_m_set/{objectId}
body: _xsrf={_xsrf}&t{reqId}={value}

// Get objects
GET /{db}/_d_req/{typeId}?JSON_KV&l=100&s=0
```

**Key Integram databases:**
- `my` — users, tokens, agent categories
- `kval` — UAV ontology (type 1673250: ~1140 concepts; type 1673287: ~923 relations)
- `fst` — fund data (deals, portfolio companies, committee sessions)

---

## AI Agent Button (Integram DataTable)

BUTTON requisite (type 7) renders as gear+play buttons in each table row.

- **Gear** → `AIAgentConfigDialog` (model, prompt, output field, MCP mode)
- **Play** → `handleAIAgentExecute` → `/api/ai-tokens/chat` or `/api/mcp/integram/chat`
- Attrs format: `:ALIAS=Name:ai-agent:o=fieldId:m=0:p=prompt:`
- Placeholders in prompt: `[ID]`, `[VAL]`, `[ColumnName]`

Key files:
- `src/components/integram/IntegramDataTableWrapper.vue` — execution logic
- `src/components/integram/DataTable.vue` — button rendering
- `src/components/integram/DataTable/dialogs/AIAgentConfigDialog.vue` — config UI

---

## KAG Knowledge Graph

KAG stores structured knowledge for the platform:

```javascript
// Search
kag_search("UAV regulation certification")

// Ask semantic question  
kag_ask("What are the key risks for hardware startups?")

// Create entity
kag_create_entities([{
  name: "EntityName",
  entityType: "Technology|Company|Concept|Person",
  observations: ["fact 1", "fact 2"]
}])

// Add knowledge
kag_add_observations([{ entityName: "...", contents: ["..."] }])
```

**Ontology data in kval:**
- Type 1673250: UAV technology concepts (~1140)
- Type 1673287: Ontology relations (~923)
- Type 1731380: Drone models (~30)
- Type 1734484: AeroNet companies (95)

---

## Koda Scripts (Free AI Automation)

All scripts in `backend/monolith/scripts/`, run from `cd backend/monolith`:

```bash
node scripts/koda-site-tester.cjs /route --full      # QA page testing
node scripts/koda-code-reviewer.cjs --commit HEAD~3..HEAD  # code review
node scripts/koda-api-tester.cjs --auth              # API testing
node scripts/koda-deploy-checker.cjs                 # deployment health
node scripts/koda-deploy-tester.cjs --full           # remote deploy test via SOCKS proxy
```

Use Koda for: testing, review, QA, deploy checks. It's FREE (MiniMax-M2.5 via GITHUB_TOKEN).

---

## Commit Convention

```
feat(module): short description
fix(module): what was broken
refactor(module): what changed
docs: what was documented
```

Module names: `fst-committee`, `fst-deal`, `fst-portfolio`, `fst-execution`, `fst-twin`, `onto`, `integram`, `kag`, etc.

---

## Environment Variables

```env
# Backend (backend/monolith/.env)
DEEPSEEK_API_KEY=sk-...
INTEGRAM_SERVER_URL=ai2o.ru
INTEGRAM_SYSTEM_USERNAME=d
INTEGRAM_SYSTEM_PASSWORD=d
TELEGRAM_BOT_TOKEN=...
GITHUB_TOKEN=...          # for Koda free AI

# Frontend (src/.env or vite.config)
VITE_API_URL=http://localhost:3000
```

---

## Testing

- **Unit**: `src/__tests__/` — Vitest
- **Integration**: `tests/integration/` — Vitest
- **E2E**: `e2e/` — Playwright
- **Test runner UI**: https://drondoc.ru/agents/test-runner
- **Minimum coverage**: 70% statements, 60% branches, 70% functions

```bash
npm run test:unit
npm run test:e2e
npm run test:coverage
```

---

## Issue Labels

| Label | Color | Usage |
|-------|-------|-------|
| `feature` | #0075ca | New functionality |
| `ai` | #ab47bc | AI/ML features |
| `analytics` | #26c6da | Data analytics |
| `fintech` | #66bb6a | Financial tools |
| `lp` | #ffa726 | LP/investor features |
| `infrastructure` | #e4e669 | DevOps, deployment |
| `ontology` | #d93f0b | Knowledge graph |
