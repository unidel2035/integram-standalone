# VentureOS FST Platform — Test Suite

Comprehensive testing for the AI Investment Committee platform.

## Test Structure

```
tests/
├── FstCommitteeEngine.test.js    # Unit: AI committee state machine
├── FstCommitteeConfig.test.js    # Unit: Agent & phase configuration
├── fstApi.test.js                # Unit: Integram API client (mocked)
├── financialCalculations.test.js # Unit: NPV, IRR, DPP, MIRR, PI
└── fstApi.integration.test.js    # Integration: Real Integram API

e2e/
├── fst-committee.spec.js         # E2E: AI committee simulation
├── fst-deal.spec.js              # E2E: Deal management
├── fst-portfolio.spec.js         # E2E: Portfolio monitoring
├── fst-twin.spec.js              # E2E: Company digital twin
└── fst-fund.spec.js              # E2E: Fund NAV/IRR tracking
```

## Running Tests

### Unit Tests
```bash
# Run all unit tests
npm run test:unit

# Run specific test file
npx vitest run tests/FstCommitteeEngine.test.js

# Watch mode
npx vitest watch
```

### Coverage
```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html
```

**Coverage Targets:**
- Statements: 70%
- Branches: 60%
- Functions: 70%
- Lines: 70%

### E2E Tests
```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run E2E tests
npm run test:e2e

# Run in UI mode (interactive)
npx playwright test --ui

# Run specific browser
npx playwright test --project=chromium

# Debug mode
npx playwright test --debug
```

### Integration Tests
```bash
# Integration tests are skipped by default
# To run against real Integram server:
INTEGRATION_TESTS=true npm run test:unit
```

## Test Coverage

### FstCommitteeEngine.test.js
- ✅ Scoring functions (normalizeScore, computeDimScores)
- ✅ Verdict logic (APPROVE >= 0.72, DEFER 0.50-0.71, REJECT < 0.50)
- ✅ Session lifecycle and state transitions
- ✅ Event system and callbacks
- ✅ Human approval workflow
- ✅ Recommendations and revision system
- ✅ Conditions and risk identification

### FstCommitteeConfig.test.js
- ✅ All 6 agents defined with correct weights
- ✅ Agent scoring weights sum to 1.0
- ✅ Phase definitions and order
- ✅ 7 scoring dimensions configuration
- ✅ SubFunds (БАС, Робот, МЭ) metadata
- ✅ Data integrity (colors, icons, formats)

### fstApi.test.js
- ✅ Authentication with Integram (mocked)
- ✅ Token caching behavior
- ✅ Reference data (SUBFUNDS, STAGES, STATUSES)
- ✅ Type IDs and field mappings
- ✅ URL construction for CRUD operations

### financialCalculations.test.js
- ✅ NPV calculation with known values
- ✅ IRR using Newton-Raphson method
- ✅ DPP (Discounted Payback Period)
- ✅ MIRR (Modified IRR)
- ✅ PI (Profitability Index)
- ✅ NPV profile over time
- ✅ Integration tests (NPV at IRR = 0, PI/NPV relationship)

### E2E Tests (Playwright)
- ✅ Page load and title verification
- ✅ Key UI elements presence
- ✅ Basic user interactions
- ✅ Console error detection
- ✅ Smoke tests for all FST routes

## Known Issues

1. **Vue dev warnings** — Allowed in E2E tests, filtered from failures
2. **ResizeObserver errors** — Browser API timing, filtered from failures
3. **Integration tests** — Skipped in CI, run manually with env flag
4. **Playwright browser download** — ~1GB, cached in CI

## CI/CD Integration

Tests run automatically on:
- Pull requests to `main`, `dev`, `feat/**`
- Pushes to `dev`, `feat/**`

### CI Workflow
1. **Lint** — ESLint (continue on error)
2. **Unit Tests** — Vitest with coverage
3. **Build** — Vite production build
4. **E2E Tests** — Playwright (PR only)
5. **Quality Gate** — Aggregate results

### Artifacts
- Coverage reports (7 days)
- Build dist/ (7 days)
- Playwright HTML report (7 days)

## Debugging Tests

### Unit Test Failures
```bash
# Run single test in debug mode
npx vitest --inspect-brk tests/FstCommitteeEngine.test.js

# Use Chrome DevTools
chrome://inspect
```

### E2E Test Failures
```bash
# Run with headed browser (see UI)
npx playwright test --headed

# Generate trace for failed tests
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

## Adding New Tests

### Unit Test Template
```javascript
import { describe, it, expect } from 'vitest'
import { myFunction } from '../src/path/to/module.js'

describe('MyModule', () => {
  it('does something', () => {
    const result = myFunction(input)
    expect(result).toBe(expectedOutput)
  })
})
```

### E2E Test Template
```javascript
import { test, expect } from '@playwright/test'

test.describe('MyPage', () => {
  test('loads correctly', async ({ page }) => {
    await page.goto('/my-route')
    await expect(page).toHaveTitle(/My Page/)
  })
})
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Vue Test Utils](https://test-utils.vuejs.org/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
