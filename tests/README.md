# VentureOS FST Platform — Test Suite

Comprehensive testing for the AI Investment Committee platform.

**Last verified:** 2026-03-09 — 350 tests passed, 4 skipped (integration)

## Running Tests

```bash
npx vitest run tests/           # all unit tests
npx vitest run tests/FILE.js    # specific file
npx vitest watch                # watch mode
INTEGRATION_TESTS=true npx vitest run tests/fstApi.integration.test.js  # integration
npx playwright test             # e2e (requires: npx playwright install)
```

## Test Files (12 files, 354 tests)

| File | Tests | Description |
|------|-------|-------------|
| FstCommitteeConfig.test.js | 48 | Agent/phase/dim/subfund configuration integrity |
| fstCommitteeOntology.test.js | 74 | UAV ontology, sovereignty scoring |
| financialCalculations.test.js | 35 | NPV, IRR, DPP, MIRR, PI calculations |
| FstCommitteeEngine.test.js | 34 | Committee state machine, scoring, decisions |
| AgentToolRegistry.test.js | 34 | MCP tool registration and discovery |
| fstCommitteeModelOrchestrator.test.js | 25 | Multi-model LLM routing |
| DebateRoom.test.js | 25 | Multi-agent debate system |
| fstApi.test.js | 23 | Integram API client (mocked fetch) |
| votingModes.test.js | 22 | Formula/hybrid/LLM voting strategies |
| AgentLoop.test.js | 15 | Agentic reasoning loop lifecycle |
| fstLearningService.test.js | 15 | Director training service |
| fstApi.integration.test.js | 4 | Real Integram API (skipped in CI) |

## Test Summaries

### FstCommitteeConfig.test.js — 48 tests
Validates static configuration integrity for the AI investment committee.
- **12 agents** with unique IDs, weights ~1.54, scoring weights per agent ~1.0
- **Agent roles**: tech, finance, sovereignty, risk, portfolio, devil (CRITICAL_ANALYST), market, legal, ip, ops, esg, bayesian
- **11 scoring dimensions** (trl, mrl, sovereignty, market, finance, risk, team, moat, timing, powerlaw, bayesian_p) — weights ~1.1
- **6 subfunds**: BAS, Robot, ME, Space, Energy, AI
- **Speed multipliers**: slow=1, normal=2.5, fast=6
- **Data integrity**: hex colors, PrimeIcons, verdicts (APPROVE/DEFER/REJECT)

### FstCommitteeEngine.test.js — 34 tests
Tests the committee session state machine, scoring, and decision pipeline.
- **Scoring**: normalizeScore 0-1, computeDimScores across 12 agents
- **Verdicts**: APPROVE >= 72%, DEFER 50-71%, REJECT < 50%
- **Session lifecycle**: createSession, phase transitions, agentStatus with pipeline sub-states
- **Human decisions**: humanDecide() + recommendations generation
- **Revision**: startRevision, applyRevision, buildNextRoundSession
- **Conditions & risks**: auto-generated for low MRL/TRL/localization/team, randomized templates

### financialCalculations.test.js — 35 tests
Validates financial calculations for deal analysis.
- **NPV**: positive/negative/zero discount rate, empty cash flows
- **IRR**: Newton-Raphson for standard, high-return, marginal (~3.5%), exact cases
- **DPP**: payback scenarios including never-pays-back (null)
- **MIRR**: different reinvestment rates, negative future value
- **PI**: profitable (>1), break-even (~1), unprofitable (<1)
- **Integration**: NPV@IRR=0, PI>1 iff NPV>0, known UAV project

### fstApi.test.js — 23 tests
Tests Integram API client with mocked fetch.
- **Auth**: POST /auth, token/xsrf extraction and caching
- **Reference data**: SUBFUNDS, STAGES, STATUSES type mappings
- **CRUD**: URL construction, headers, body encoding
- **Environment**: VITE_FST_DB=fst-api (proxy slug), VITE_FST_SERVER

### fstCommitteeOntology.test.js — 74 tests
UAV domain knowledge and sovereignty scoring.
- Ontology concept lookup and category mapping
- Sovereignty classification and component criticality
- Import dependency analysis for UAV subsystems

### fstCommitteeModelOrchestrator.test.js — 25 tests
Multi-model LLM routing and orchestration.
- Speed profiles (fast/balanced/quality), model assignment per role
- Fallback chains, error handling, token budget management

### AgentToolRegistry.test.js — 34 tests
MCP tool registration and discovery for AI agents.
- Registration/deregistration lifecycle, search by name/category
- Permission validation, access control, schema validation

### AgentLoop.test.js — 15 tests
Agentic reasoning loop lifecycle.
- Init/termination conditions, step execution, state accumulation
- Max iteration guards, error recovery, graceful degradation

### votingModes.test.js — 22 tests
Three voting strategies: formula (weighted aggregation), hybrid (formula + LLM override), LLM (structured output parsing).

### DebateRoom.test.js — 25 tests
Multi-agent debate: argument submission (SUPPORT/CHALLENGE/COUNTER), turn management, quality scoring, consensus detection.

### fstLearningService.test.js — 15 tests
Director training: lesson catalog, progress tracking, quiz generation, knowledge gap identification.

### fstApi.integration.test.js — 4 tests (skipped)
Real Integram API tests. Requires `INTEGRATION_TESTS=true`.

## Known Issues

1. **Localization conditions** — Use randomized phrasing templates; tests match multiple keywords
2. **Integration tests** — Skipped by default, run manually
3. **Vue dev warnings / ResizeObserver errors** — Filtered in E2E tests
