# VentureOS — AI-Powered Venture Fund Management Platform

<div align="center">

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Stack](https://img.shields.io/badge/stack-Vue3%20%7C%20Node.js%20%7C%20AI%20Agents-blue)
![License](https://img.shields.io/badge/license-proprietary-red)

> **The operating system for a modern venture fund** — from deal sourcing to exit, powered by a network of specialized AI agents, ontological knowledge graphs, and real-time digital twins.

</div>

---

## Why This Exists

Traditional venture fund management is fragmented across spreadsheets, CRMs, pitch decks, and gut feelings. Decisions are slow, data is siloed, and portfolio monitoring is reactive.

VentureOS replaces that with a unified intelligent platform where AI agents conduct investment committee debates, ontology graphs map technology landscapes, financial models update in real time, and fund managers get a clear, data-driven view of every portfolio company — from first pitch to exit.

---

## Core Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    VentureOS Platform                    │
├──────────────┬──────────────┬──────────────┬────────────┤
│  AI Agent    │  Ontology    │  Digital     │  Financial │
│  Network     │  Engine      │  Twins       │  Engine    │
├──────────────┴──────────────┴──────────────┴────────────┤
│              Integram Data Layer (NoSQL + Graph)         │
├─────────────────────────────────────────────────────────┤
│      KAG — Knowledge Augmented Graph (Vector + Graph)   │
└─────────────────────────────────────────────────────────┘
```

### 1. AI Agent Network

The platform runs a **multi-agent deliberation system** — specialized agents that argue, critique, vote, and advise across all fund workflows:

| Agent Role | Domain | Output |
|------------|--------|--------|
| **Market Analyst** | TAM/SAM/SOM, competitive landscape | Quantified market assessment |
| **Technical Auditor** | TRL, architecture, IP, sovereignty | Technical risk score |
| **Financial Modeler** | Unit economics, burn, projections | Valuation range, IRR/MOIC |
| **Legal & Compliance** | Regulatory, jurisdiction, licenses | Risk flags, blockers |
| **Portfolio Strategist** | Synergies, co-investment, follow-on | Strategic fit score |
| **Contrarian** | Devil's advocate, stress testing | Red flags, failure modes |

Agents conduct **structured multi-round debates** with position statements, rebuttals, and synthesis. Human decision-makers get a full deliberation transcript + actionable recommendation.

### 2. Ontology Engine (KAG)

The platform maintains a living **knowledge graph** of the technology domain:

- **~1,100+ technology concepts** with semantic relationships
- **Domain taxonomies**: hardware, software, regulation, markets, companies
- **Semantic search**: "find startups adjacent to X" returns ontology-aware results
- **Auto-enrichment**: new portfolio companies are automatically mapped to the ontology
- **Graph queries**: "what companies compete with portfolio company Y in segment Z?"

Built on a hybrid **vector + graph** architecture (KAG — Knowledge Augmented Graph) enabling both fuzzy semantic search and precise relationship traversal.

### 3. Digital Twins

Every portfolio company gets a **real-time digital twin** — a simulation model tracking:

```
Company Twin                      Fund Twin
├── Revenue simulation            ├── NAV (live)
├── Burn rate & runway            ├── IRR / MOIC (real-time)
├── TRL/MRL progression           ├── Sub-fund allocation
├── Headcount dynamics            ├── Risk exposure heatmap
├── KPI achievement probability   └── LP reporting metrics
└── Market share model
```

Twins run **tick-based event simulations** — random events (team changes, regulatory shifts, competitor moves) are generated probabilistically and affect company metrics, allowing fund managers to stress-test scenarios.

### 4. Financial Engine

- **Embedded financial modeling** — startups fill in parameters directly in deal flow forms
- **Automated calculations**: NPV, IRR, MOIC, DPP, Payback Index across 5-year horizon
- **Scenario analysis**: best/base/worst case with Monte Carlo sensitivity
- **Cap table management**: dilution modeling, pro-rata rights, option pool
- **Exit modeling**: M&A, IPO, secondary buyback scenarios with IRR impact

Formula engine uses **HyperFormula** with cross-sheet references, supporting `[ItemName]` syntax for linked cell resolution.

---

## Platform Modules

| Module | Route | Description |
|--------|-------|-------------|
| **Deal Sourcing** | `/dealflow` | AI-powered intake from Telegram, job boards, research databases |
| **Investment Memo** | `/memo` | Auto-generate 12-page investment memo from pitch deck in 60 seconds |
| **AI Committee** | `/committee` | 6-agent investment committee debate + vote simulation |
| **Deal Execution** | `/deal` | Term Sheet builder, SPV setup, tranche structuring, smart contract timeline |
| **Portfolio Monitor** | `/portfolio` | Real-time KPI dashboard, risk traffic lights, AI weekly reports |
| **Post-Investment** | `/execution` | Kanban task board, milestone tracking, fund interventions |
| **Company Twin** | `/twin` | Simulation: revenue, burn, TRL/MRL, market share |
| **Fund Twin** | `/fund` | NAV, IRR, sub-fund allocation, stress testing |
| **Cap Table** | `/captable` | Ownership tracking, dilution modeling, option pools |
| **Benchmarking** | `/benchmark` | Peer comparison, sector multiples, cohort analysis |
| **Exit Scenarios** | `/exit` | M&A / IPO / buyback with IRR sensitivity |
| **Sovereignty Audit** | `/sovereignty` | 9-dimension assessment: technology, data, supply chain |
| **LP Dashboard** | `/lp` | Investor reporting, NAV statements, KPI summaries |
| **Co-Investor Network** | `/network` | Syndication map, co-investment matching, deal sharing |
| **Founders CRM** | `/founders` | Mentorship network, expert matching, board composition |
| **Board Pack** | `/board` | Auto-generate board materials from portfolio data |
| **Open API** | `/api` | REST + webhook access for LP integrations |

---

## Technology Stack

### Frontend
- **Vue 3** (Composition API) + **Vite**
- **PrimeVue** — enterprise UI component library
- **Pinia** — state management
- **HyperFormula** — spreadsheet formula engine (financial models)
- **Socket.io-client** — real-time data streaming
- **Chart.js** — portfolio analytics visualization
- **vue-i18n** — multilingual support (RU/EN)

### Backend
- **Node.js** (ESM monolith) — single backend service
- **Express.js** — REST API layer
- **Socket.io** — WebSocket for live simulation streaming
- **Integram API** — structured data layer (NoSQL + references + reports)
- **SQLite** — ephemeral caching and session storage

### AI & Knowledge
- **KAG** (Knowledge Augmented Graph) — hybrid vector + graph memory
- **Multi-provider LLM routing** — DeepSeek, GPT-4o, Claude, YandexGPT via token router
- **Token-based access control** — per-user AI quotas, cost tracking, model selection
- **MCP** (Model Context Protocol) — AI agents call structured tools (read/write DB, search ontology, run reports)
- **Playwright** — automated QA with AI analysis

### Infrastructure
- **systemd** — service management (backend, frontend, Telegram bot, SOCKS tunnel)
- **SOCKS5 proxy** — tunneled access for external data sources
- **Telegram Bot** — notifications, approvals, deal alerts
- **Integram MCP Server** — 60+ tools for AI agents to operate the database

---

## AI Agent Architecture

```
User Request
     │
     ▼
Orchestrator (Claude/DeepSeek)
     │
     ├──► Market Agent ──► KAG semantic search → ontology query
     │
     ├──► Financial Agent ──► HyperFormula engine → scenario compute
     │
     ├──► Technical Agent ──► TRL database → patent search → risk score
     │
     ├──► Legal Agent ──► Regulatory ontology → compliance check
     │
     └──► Contrarian Agent ──► Red-team analysis → stress test
                │
                ▼
         Debate Synthesis
                │
                ▼
         Recommendation + Confidence Score
```

### Token-Based LLM Routing

Every AI operation goes through a **token router** that:
- Selects optimal model per task (speed vs quality vs cost)
- Enforces per-user daily/monthly quotas
- Tracks token usage and cost per application
- Supports model fallback chains

### MCP Tool Integration

AI agents access the platform database via **Model Context Protocol tools**:
- `get_dictionary` — explore data schema
- `get_object_list` — query records with filters
- `set_object_requisites` — write results back to database
- `execute_report` — run aggregate analytics
- `search_objects` — full-text + semantic search

This means agents can **read portfolio data, update records, generate reports** — all through structured tool calls, not hallucinated outputs.

---

## Data Model

```
Fund
 ├── Sub-funds (by sector/stage/geography)
 │    └── Portfolio Companies
 │         ├── Financials (per-period)
 │         ├── KPIs (milestones × tranches)
 │         ├── Tasks (Kanban board)
 │         ├── Events (simulation log)
 │         └── Documents (memos, term sheets, board packs)
 ├── Deal Flow
 │    ├── Applications
 │    ├── Screening scores
 │    └── Committee votes
 ├── LPs
 │    ├── Commitments
 │    └── Distributions
 └── Knowledge Graph
      ├── Technology ontology (~1,100+ concepts)
      ├── Company profiles
      ├── Market segments
      └── Regulatory framework
```

---

## Investment Committee Flow

```
1. Application received (form / Telegram / API)
        │
2. AI pre-screening (15 criteria, scored 0-100)
        │
3. Partner review (human gate)
        │
4. AI Committee debate (6 agents, 3 rounds)
   - Each agent: analysis → position → rebuttal
   - Synthesis: areas of agreement + key disputes
   - Vote: Approve / Conditional / Reject + confidence
        │
5. Human IC meeting (AI transcript as briefing)
        │
6. Decision → Term Sheet generation (if approved)
        │
7. Deal structuring (SPV, tranches, KPI triggers)
        │
8. Smart contract timeline → tranche release conditions
        │
9. Post-investment monitoring (KPI dashboard, Kanban)
```

---

## Portfolio Monitoring

Real-time monitoring across all portfolio companies with:

- **Traffic light risk system** — Green / Yellow / Red per company per dimension
- **8 sensor types**: revenue, burn, team, product, market, legal, IP, regulatory
- **Automated alerts**: threshold breaches trigger notifications + fund actions
- **Fund interventions**: warn, request docs, assign mentor, block tranche, call IC
- **AI weekly digest**: auto-generated report per company (4 sections: performance, risks, opportunities, actions needed)

---

## Quick Start

### Prerequisites

- **Node.js** 20.0.0+ ([Download](https://nodejs.org))
- **npm** 9.0.0+
- **Git**

### Installation

```bash
# 1. Clone repository
git clone https://github.com/unidel2035/found.git
cd found

# 2. Checkout dev branch (main development branch)
git checkout dev

# 3. Install frontend dependencies
npm install

# 4. Install backend dependencies
cd backend/monolith
npm install
cd ../..

# 5. Configure environment
cp .env.example .env
```

### Configuration

Edit `.env` and set these **required** variables:

```bash
# AI Provider (at least one)
DEEPSEEK_API_KEY=sk-your-deepseek-key-here

# Integram Database (required)
INTEGRAM_SERVER_URL=ai2o.ru
INTEGRAM_SYSTEM_USERNAME=your-integram-login
INTEGRAM_SYSTEM_PASSWORD=your-integram-password

# Backend
PORT=3000
NODE_ENV=development

# Frontend
VITE_API_URL=http://localhost:3000
```

**Get API Keys:**
- DeepSeek: https://platform.deepseek.com (recommended, cost-efficient)
- OpenAI: https://platform.openai.com (optional)
- Anthropic: https://console.anthropic.com (optional)

### Run Development Servers

**Terminal 1 - Backend:**
```bash
cd backend/monolith
npm run dev
# → Backend running on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
npm run dev
# → Frontend running on http://localhost:5173
```

Open browser: http://localhost:5173

### Verify Setup

```bash
# Check backend health
curl http://localhost:3000/api/health

# Check Integram connection
curl -X POST 'https://ai2o.ru/fst/auth?JSON_KV' -d 'login=d&pwd=d'
```

### Next Steps

- 📖 Read [Setup Guide](docs/setup.md) for detailed configuration
- 🏗️ Read [Architecture](docs/architecture.md) to understand the platform
- 🗄️ Read [Database Schema](docs/database.md) for Integram data model
- 🤖 Read [CLAUDE.md](CLAUDE.md) for development guidelines

**Required services:**
- Integram instance (data layer) — test DB available at `ai2o.ru/fst`
- KAG server (knowledge graph) — optional for development
- LLM API keys (DeepSeek recommended for cost efficiency)

---

## Repository Structure

```
found/
├── src/
│   ├── views/pages/        # Vue page components (one per module)
│   ├── components/         # Reusable UI components
│   │   └── integram/       # Data table, dialogs, AI button
│   ├── services/           # API clients, AI token service
│   ├── templates/finmodel/ # Financial model templates (JSON)
│   ├── config/             # Routes, i18n, constants
│   └── router/             # Vue Router config
├── backend/
│   └── monolith/
│       ├── src/api/routes/  # REST endpoints
│       ├── src/core/        # LLM coordinator, providers
│       ├── src/services/    # Business logic
│       └── scripts/         # Koda AI automation scripts
├── docs/
│   ├── plans/              # Roadmaps and feature plans
│   ├── reports/            # Analysis and test reports
│   └── implementation/     # Technical implementation docs
├── e2e/                    # Playwright end-to-end tests
└── tests/                  # Unit and integration tests
```

---

## Roadmap

📋 **[Complete Roadmap](docs/ROADMAP.md)** — full development plan with priorities, milestones, and technical comparison with EQT Motherbrain, SignalFire Beacon, and BlackRock Aladdin.

**Current Focus (P0):**
- 📝 Public application form for startups (#84)
- 💾 Investment committee protocol storage (#85)

**Next Quarter (P1):**
- 🤖 AI Deal Sourcing — automatic startup discovery (#20)
- 🔗 External data integration: ЕГРЮЛ, Роспатент, HH.ru (#11)

**Upcoming (P2-P3):**
- Portfolio Intelligence with weekly AI reports
- Black-Litterman portfolio allocation
- Co-investor syndication network
- Secondary market for LP stakes
- Open API with webhooks
- Telegram bot for fund managers

See [Issues](https://github.com/unidel2035/found/issues) for full backlog and [docs/ROADMAP.md](docs/ROADMAP.md) for detailed breakdown.

---

## Philosophy

> **"A venture fund is an information processing machine. We're building the OS for it."**

- **Ontology-first**: structure the domain before building features. If it's not in the knowledge graph, you can't reason about it.
- **Agents over dashboards**: instead of showing data, have agents act on it. The fund manager approves decisions, not builds spreadsheets.
- **Simulation before action**: test investment theses in the digital twin before committing capital.
- **Transparency through debate**: AI recommendations come with a full deliberation trace. No black boxes.

---

<div align="center">

Built with Vue 3 · Node.js · KAG · Integram · Multi-Agent AI

</div>
