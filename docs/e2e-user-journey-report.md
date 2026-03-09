# E2E User Journey Test Report

**Date:** 2026-03-09
**Tester:** Claude Code (Playwright MCP)
**Environment:** http://173.249.2.184:5174 (dev server)

## Summary

Full user journey tested: Login -> Hub -> Apply -> IC -> Decision.
All core flows work. 3 bugs found, 1 cosmetic issue.

## Test Results

### 1. Authorization — PASS
- /login -> credentials -> redirect to /fst-hub
- Auth tokens saved to localStorage
- Session timestamp recorded

### 2. Hub (/fst-hub) — PASS
- Stats: 0 IC sessions, 6 subfunds, 9 closed deals, IRR 36%
- Investment funnel: 6 phases rendered
- 15 platform modules, all status "live"
- Onboarding dialog appears (role selection: LP/Analyst/GP/Startup)

### 3. Application (/fst-apply) — PASS
- 4-step wizard: Company -> Technology -> Finance -> Documents
- Pre-scoring on step 4: TRL 77/100, Sovereignty 85/100, Team 100/100, Market 100/100
- Application FST-6957 accepted
- Test data: OOO SkyDron, BAS sector, Seed, TRL 7, 200M RUB, 85% sovereignty

### 4. AI Investment Committee (/fst-committee) — PASS
- Project SkyDron selected from list (TRL 7, MRL 7, 200M, IRR 41%)
- IC launched with 12 agents, hybrid voting mode
- Full pipeline completed:
  - Document analysis: 12/12 agents (~2 sec)
  - Initial positions: 7 arguments
  - Debates: 32 arguments, 143 events total
  - Voting: 12 votes (1 APPROVE, 10 DEFER, 1 REJECT)
  - Decision synthesis -> Human approval
- Models used: 8x Qwen Turbo, 4x Gemini 2.5 Flash Lite
- Tools used: web_search x12, query_data x11, read_room x9, memory_search x9, exec_code x7
- Average agent iterations: 4.8

### 5. IC Decision — DEFER (52/100)

#### Agent Scores

| Agent | Score | Verdict | Change |
|-------|-------|---------|--------|
| Tech | 49 | DEFER | — |
| Finance | 52 | DEFER | — |
| Sovereignty | 53 | DEFER | APPROVE->DEFER |
| Risk | 27 | REJECT | — |
| Portfolio | 70 | APPROVE | — |
| Critical | 59 | DEFER | — |
| Monte Carlo | 50 | DEFER | — |
| ROV | 60 | DEFER | — |
| Timing | 52 | DEFER | APPROVE->DEFER |
| Bayesian | 60 | DEFER | — |
| 7P Moat | 51 | DEFER | — |
| Game Theory | 49 | DEFER | APPROVE->DEFER |

#### Approval Conditions (5)
1. Prepare financial plan with current burn rate
2. Sign preliminary agreement with production facility
3. Confirm financial model with 2 independent analysts (score: 52/100)
4. Present scaling plan with unit economics for 3 years
5. Confirm patent clearance before deal closing

#### Recommendations (8)
1. **tech -> CTO** (HIGH, 8 wks): Independent TRL 7 verification via NASA/ESA methodology
2. **finance -> CFO** (HIGH, 6 wks): Three-scenario financial model stress test
3. **sovereignty -> CTO** (HIGH, 8 wks): Component passport — foreign component criticality mapping
4. **risk -> CRO** (HIGH, 6 wks): Risk register with PxI scoring and mitigation plans
5. **devil -> CEO** (HIGH, 6 wks): Anti-pitch — honest failure analysis with responses
6. **tech -> COO** (MEDIUM, 12 wks): MRL 7->9 production readiness plan
7. **finance -> CFO** (MEDIUM, 8 wks): CAC/LTV/payback from 3+ real clients
8. **portfolio -> CEO** (MEDIUM, 4 wks): Portfolio synergy with 2-3 fund companies

#### Digital Twin Contract Scenarios

| Scenario | IC (M RUB) | IRR | NPV (M) | Verdict |
|----------|-----------|-----|---------|---------|
| Conservative (x0.6) | 120 | -6.0% | -70.8 | FAIL |
| Base (x1) | 100 | 19.5% | 4.4 | PASS |
| Optimistic (x1.4) | 80 | 45.1% | 96.4 | PASS |

Expected NPV (probability-weighted): **8.6M RUB**

#### Deal Conditions (from contradictions)
- REPORTING: Provide LOI from 2+ anchor clients before Tranche B

## Bugs Found

### BUG-1: Onboarding dialog reappears on navigation (MEDIUM)
**Steps:** Login -> Hub -> dismiss dialog -> navigate to /fst-committee
**Expected:** Dialog does not reappear
**Actual:** Dialog appears again on every page navigation
**Root cause:** "Choose later" does not persist dismissal state in localStorage

### BUG-2: Duplicate toast on application submit (LOW)
**Steps:** Fill application -> submit
**Expected:** 1 success toast
**Actual:** 2 identical toasts "Application sent. Number: FST-6957"

### BUG-3: JSON data leak in project card (MEDIUM)
**Steps:** Open project card in IC -> view description
**Expected:** Clean description text
**Actual:** Raw FST_FULL_APPLICATION JSON comment visible in description field
**Impact:** Exposes full application data including contacts, financials

### NOTE-1: Initial scoring zeros (cosmetic)
Moat (7P), Timing, Power Law, P(success) show 0 during document analysis phase.
These populate after LLM phase — likely by design, but confusing visually.

## Performance

| Metric | Time |
|--------|------|
| Login -> Hub | ~2s |
| Application form (4 steps) | Manual input |
| IC Document Analysis | ~2s |
| IC Initial Positions | ~15s |
| IC Debates | ~60s |
| IC Voting + Synthesis | ~30s |
| **Total IC session** | **~2 min** |

## Unit Tests

350 tests passed, 4 skipped (integration). See tests/README.md for details.
