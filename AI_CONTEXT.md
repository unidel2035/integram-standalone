# VentureOS / ФСТ НТИ — AI Agent Context

> This file is intended for AI agents (Claude, GPT, etc.) to quickly understand the platform.
> GitHub token bearer: read this file first, then explore `src/views/pages/` for module details.

## What is this?

**VentureOS** is an AI-native venture fund management platform built for **ФСТ НТИ** (Sovereign Technologies Fund of NTI Russia). It covers the full investment lifecycle: sourcing → AI investment committee → deal structuring → execution → monitoring → exit.

**Live:** https://ai2fund.ru
**Stack:** Vue 3 + Vite + PrimeVue (frontend), Node.js ESM + Express (backend), Integram NoSQL (database), DeepSeek/Claude/GPT-4o (AI layer)

---

## Core Philosophy

> "We didn't automate old processes — we redesigned the process itself."

Traditional VC fund:
- Startup sends PDF → manager copies to Excel → closed meeting → "approved/rejected"
- 3–6 months, no transparency

ФСТ НТИ approach:
- AI agent parses data from open sources (no forms to fill)
- Team psychotype assessment via interview (not questionnaire)
- AI builds a digital project profile (knowledge map of the NTI market)
- 6 AI agents debate → transparent protocol → decision in 48 hours
- Friendly investment structure: we package startups, solve all operational problems

---

## Key Differentiators

1. **No forms** — AI agents collect data autonomously from open sources
2. **Team assessment** — psychotype analysis via AI interview, not tests
3. **6-agent investment committee** — Technology, Finance, Sovereignty, Risk, Strategy, Critical Analyst agents debate in multiple rounds
4. **Sovereignty dimension** — 9D sovereignty matrix (0–9 scale) is a mandatory criterion for every deal
5. **Startup packaging** — legal (SPV, Term Sheet), financial model, IR materials — fund handles it all
6. **Friendly structure** — open Term Sheet, no hidden covenants, partner model

---

## Platform Modules (30+ pages)

### Deal Pipeline
| Module | Route | Description |
|--------|-------|-------------|
| Hub | `/fst-hub` | Command center — all metrics, all modules |
| Dealflow | `/fst-dealflow` | Deal funnel — all applications, AI scoring |
| AI Committee | `/fst-committee` | 6 AI agents debate in real-time, multi-round |
| Protocol | `/fst-protocol` | Committee session protocols |
| Deal | `/fst-deal` | Term Sheet, SPV, tranches with KPI triggers |
| Execution | `/fst-execution` | Kanban + KPI tracking, tranche unlock |

### Portfolio
| Module | Route | Description |
|--------|-------|-------------|
| Portfolio | `/fst-portfolio` | Risk traffic light, EGRUL + HH.ru monitoring |
| Digital Twin (company) | `/fst-twin` | Live simulation, burn rate, survival AI |
| Digital Twin (fund) | `/fst-fund` | NAV, IRR, DPI — 3 subfunds in real time |

### Analytics
| Module | Route | Description |
|--------|-------|-------------|
| Sovereignty | `/fst-sovereignty` | 9D sovereignty audit per technology |
| Factor Model | `/fst-factor` | T·S·M·G·E scoring matrix |
| Cap Table | `/fst-captable` | Dilution, liquidation preference waterfall |
| ESG | `/fst-esg` | ESG scoring across portfolio |
| Benchmark | `/fst-benchmark` | Portfolio vs market benchmarks |

### Infrastructure
| Module | Route | Description |
|--------|-------|-------------|
| Legal | `/fst-legal` | Document generator, SPV structures |
| Compliance | `/fst-compliance` | AML/KYC automated checks |
| Grants | `/fst-grants` | Grant tracker (state programs) |
| Administration | `/fst-administration` | Back-office operations |
| Transparency | `/fst-transparency` | Public fund showcase for LPs |

---

## AI Architecture

```
Frontend → POST /api/ai-tokens/chat
  body: { modelId, prompt, systemPrompt, application }

Models available:
- anthropic/claude-sonnet-4-20250514  ← strategic analysis, long documents
- deepseek/deepseek-chat              ← fast, code, structured data
- openai/gpt-4o                       ← multimodal tasks
- yandex/yandexgpt                    ← Russian-language content

AI Committee agents (FstCommittee.vue):
  1. Технолог     — TRL assessment, technology readiness
  2. Финансист    — financial model, unit economics, runway
  3. Суверенность — 9D sovereignty matrix evaluation
  4. Риск         — market, team, regulatory risks
  5. Стратег      — competitive positioning, exit scenarios
  6. Критик       — devil's advocate, challenges assumptions
```

---

## Database (Integram)

NoSQL platform at `ai2o.ru`. Key databases:
- `my` — users, AI tokens, agent categories
- `fst` — fund data (deals, portfolio, committee events)
- `kval` — domain knowledge map of UAV/NTI market (~1140 concepts, type 1673250)

The "knowledge map" (what we call the domain model) is stored in `kval` — it's a graph of ~1140 technology concepts covering the UAV and NTI market. AI agents use this context rather than parsing raw text.

---

## Sovereignty (9D Matrix)

Unique to ФСТ НТИ. Every deal must pass a sovereignty audit across 9 dimensions:
1. Production location (Russia vs abroad)
2. Component origin (imported vs domestic)
3. Software stack (foreign dependencies)
4. Data residency
5. IP ownership (Russian patents)
6. Personnel (Russian engineers)
7. Supply chain resilience
8. Export control compliance
9. Strategic independence from foreign ecosystems

Score: 0–9. Minimum threshold for investment: varies by subfund.

---

## Fund Structure

3 subfunds:
1. **БАС** (Unmanned Aerial Systems) — core focus
2. **Робототехника** (Robotics) — adjacent technologies
3. **Машиностроение** (Manufacturing) — production base

Investment instruments: Equity, CLN (convertible loan note), Grant.

---

## For Claude agents exploring this repo

Key files to read:
- `src/views/pages/FstCommittee.vue` — AI committee implementation (most complex module)
- `src/views/pages/FstDeal.vue` — deal structuring logic
- `src/views/pages/FstPortfolio.vue` — portfolio monitoring
- `src/config/fstMenuConfig.js` — full navigation structure
- `backend/monolith/src/api/routes/ai-tokens.js` — AI routing endpoint
- `backend/monolith/src/core/TokenBasedLLMCoordinator.js` — LLM router logic
- `docs/architecture.md` — full technical architecture
- `CLAUDE.md` — developer guidelines

**Questions this platform can answer:**
- "Show me the sovereignty score for a specific technology"
- "What AI agents are in the investment committee and what do they evaluate?"
- "How does tranche unlocking work with KPI triggers?"
- "What is the fund's current NAV and IRR?"
- "Explain the difference between this fund and a traditional VC fund"
