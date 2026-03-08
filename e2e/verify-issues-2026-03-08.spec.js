// @ts-check
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Auth: login once, save state to file, reuse across tests
// ---------------------------------------------------------------------------

const CREDENTIALS = { login: 'unidel@yandex.ru', password: 'Denver2035' }
const AUTH_STATE_FILE = path.join(process.cwd(), 'test-results', '.auth-state.json')

/** Login once and save storage state for reuse */
async function ensureAuthenticated(page) {
  // Try to reuse saved auth state
  if (fs.existsSync(AUTH_STATE_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(AUTH_STATE_FILE, 'utf8'))
      // Inject localStorage items into page context
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1000)
      for (const item of state.origins?.[0]?.localStorage || []) {
        await page.evaluate(([k, v]) => localStorage.setItem(k, v), [item.name, item.value])
      }
      // Mark onboarding + role selection completed to prevent modals
      await page.evaluate(() => {
        localStorage.setItem('onboarding_state', JSON.stringify({
          onboardingCompleted: true, selectedRole: 'analyst', completedSteps: []
        }))
        localStorage.setItem('ventureOS_roleSelected', 'true')
      })
      // Verify token works by navigating
      await page.goto('/fst-committee', { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)
      if (!page.url().includes('/login')) return // Auth works!
    } catch { /* fall through to fresh login */ }
  }

  // Fresh login
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  if (!page.url().includes('/login')) {
    // Already authenticated
    await saveAuthState(page)
    return
  }

  const loginInput = page.locator('input[placeholder="Введите логин"]')
  await expect(loginInput).toBeVisible({ timeout: 10000 })
  await loginInput.fill(CREDENTIALS.login)

  const pwdInput = page.locator('.p-password input, input[placeholder="Введите пароль"]').first()
  await pwdInput.fill(CREDENTIALS.password)

  await page.locator('button:has-text("Войти")').click()
  await page.waitForFunction(() => !!localStorage.getItem('token'), { timeout: 30000 })
  await page.waitForTimeout(1000)

  await saveAuthState(page)
}

async function saveAuthState(page) {
  // Mark onboarding as completed to prevent the modal
  await page.evaluate(() => {
    localStorage.setItem('onboarding_state', JSON.stringify({
      onboardingCompleted: true, selectedRole: 'analyst', completedSteps: []
    }))
    localStorage.setItem('ventureOS_roleSelected', 'true')
  })
  try {
    const state = await page.context().storageState()
    fs.mkdirSync(path.dirname(AUTH_STATE_FILE), { recursive: true })
    fs.writeFileSync(AUTH_STATE_FILE, JSON.stringify(state))
  } catch { /* ignore save errors */ }
}

/** Navigate + dismiss onboarding modal */
async function navigateTo(page, routePath) {
  // Ensure onboarding is marked completed before navigating
  await page.evaluate(() => {
    localStorage.setItem('onboarding_state', JSON.stringify({
      onboardingCompleted: true, selectedRole: 'analyst', completedSteps: []
    }))
    localStorage.setItem('ventureOS_roleSelected', 'true')
  })

  await page.goto(routePath, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)

  // Dismiss any modal dialogs aggressively
  for (let attempt = 0; attempt < 5; attempt++) {
    const skipBtn = page.locator('text=Выбрать позже')
    if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipBtn.click()
      await page.waitForTimeout(800)
      continue // check again
    }
    const dialogMask = page.locator('.p-dialog-mask')
    if (await dialogMask.isVisible({ timeout: 500 }).catch(() => false)) {
      const closeBtn = page.locator('.p-dialog-close-button').first()
      if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeBtn.click()
        await page.waitForTimeout(500)
        continue
      }
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
      continue
    }
    break // no dialogs found
  }
  await page.waitForTimeout(300)
}

/** Enable AI + Agent Loop toggles */
async function enableToggles(page) {
  const toggles = page.locator('.fst-ai-toggle')
  const count = await toggles.count()
  for (let i = 0; i < Math.min(count, 2); i++) {
    const t = toggles.nth(i)
    if (await t.isVisible({ timeout: 2000 }).catch(() => false)) {
      const isOn = await t.evaluate(el => el.classList.contains('fst-ai-toggle--on'))
      if (!isOn) await t.click()
      await page.waitForTimeout(300)
    }
  }
}

/** Filter non-critical errors */
function filterCriticalErrors(errors) {
  return errors.filter(e =>
    !e.includes('[Vue warn]') &&
    !e.includes('ResizeObserver') &&
    !e.includes('Script error') &&
    !e.includes('Non-Error') &&
    !e.includes('hydration') &&
    !e.includes('Failed to fetch')
  )
}

// ===========================================================================
// Group A: Static UI Checks
// ===========================================================================

test.describe('Group A: Static UI Checks', () => {

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await ensureAuthenticated(page)
  })

  // #154 — Agents loaded from DB
  test('#154 — agents list has >= 6 items', async ({ page }) => {
    await navigateTo(page, '/fst-committee')
    await enableToggles(page)

    // Click "Модели агентов" toggle to expand model panel
    const modelToggle = page.locator('.fst-policy-toggle:has-text("Модели агентов")')
    await modelToggle.scrollIntoViewIfNeeded()
    await modelToggle.click()
    await page.waitForTimeout(1000)

    const agentRows = page.locator('.fst-agent-model-row')
    await expect(agentRows.first()).toBeVisible({ timeout: 10000 })
    const count = await agentRows.count()
    expect(count).toBeGreaterThanOrEqual(6)
  })

  // #155 — Session history page renders
  test('#155 — /fst-protocol renders with header', async ({ page }) => {
    await navigateTo(page, '/fst-protocol')
    await expect(page.locator('.fst-protocol, [class*="fst-protocol"]').first()).toBeVisible({ timeout: 10000 })
  })

  // #156 — Contract page renders
  test('#156 — /fst-contract/test renders without crash', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => errors.push(err.message))

    await navigateTo(page, '/fst-contract/test')
    await page.waitForTimeout(2000)

    const content = await page.locator('body').textContent()
    expect(content.length).toBeGreaterThan(50)

    const critical = filterCriticalErrors(errors)
    expect(critical).toHaveLength(0)
  })

  // #157 — TRL / MRL / sovereignty metrics on project cards
  test('#157 — project cards show TRL, MRL, sovereignty metrics', async ({ page }) => {
    await navigateTo(page, '/fst-committee')
    await enableToggles(page)

    const card = page.locator('.fst-pcard').first()
    await expect(card).toBeVisible({ timeout: 10000 })

    // Cards have .fst-metric spans with TRL/MRL directly
    const cardText = await card.textContent()
    expect(cardText).toContain('TRL')
    expect(cardText).toContain('MRL')

    // Click to open modal for full metrics
    await card.click()
    await page.waitForTimeout(1000)

    const modal = page.locator('.fst-pmodal')
    await expect(modal).toBeVisible({ timeout: 5000 })

    const metrics = page.locator('.fst-pmodal-metric')
    expect(await metrics.count()).toBeGreaterThanOrEqual(2)

    const modalText = await modal.textContent()
    expect(modalText).toContain('TRL')
    expect(modalText).toContain('MRL')
  })

  // #159 — Model selection persists in localStorage
  test('#159 — agent model overrides persist in localStorage', async ({ page }) => {
    await navigateTo(page, '/fst-committee')
    await enableToggles(page)

    // Click "Модели агентов" toggle to expand model panel
    const modelToggle = page.locator('.fst-policy-toggle:has-text("Модели агентов")')
    await modelToggle.scrollIntoViewIfNeeded()
    await modelToggle.click()
    await page.waitForTimeout(1000)

    const modelSelect = page.locator('.fst-am-select').first()
    if (await modelSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      const options = await modelSelect.locator('option').allTextContents()
      if (options.length > 1) {
        await modelSelect.selectOption({ index: 1 })
        await page.waitForTimeout(500)
      }
    }

    const stored = await page.evaluate(() => localStorage.getItem('fst_agent_models'))
    expect(stored).toBeTruthy()
    expect(stored).not.toBe('{}')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    const storedAfterReload = await page.evaluate(() => localStorage.getItem('fst_agent_models'))
    expect(storedAfterReload).toBe(stored)
  })

  // #160 — Debug mode loads without crash
  test('#160 — /fst-committee?debug loads without crash', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => errors.push(err.message))

    await navigateTo(page, '/fst-committee?debug')
    await enableToggles(page)
    await page.waitForTimeout(2000)

    const critical = filterCriticalErrors(errors)
    expect(critical).toHaveLength(0)

    // Verify debug param is preserved
    const hasDebug = await page.evaluate(() =>
      new URLSearchParams(window.location.search).has('debug')
    )
    expect(hasDebug).toBe(true)
  })

  // #161 — IC params / policy sliders
  test('#161 — IC params sliders visible in policy panel', async ({ page }) => {
    await navigateTo(page, '/fst-committee')
    await enableToggles(page)

    // Click "Пороги решений ИК" toggle to expand IC params
    const icToggle = page.locator('.fst-policy-toggle:has-text("Пороги")')
    await icToggle.scrollIntoViewIfNeeded()
    await icToggle.click()
    await page.waitForTimeout(1000)

    // PrimeVue <Slider> renders as .p-slider
    const sliders = page.locator('.p-slider, .fst-policy-slider')
    expect(await sliders.count()).toBeGreaterThanOrEqual(1)
  })
})

// ===========================================================================
// Group B: Full Session Verification (single LLM session with test.step)
// ===========================================================================

test.describe('Group B: Full IC Session', () => {

  test('full IC session — verify issues #148-#164', async ({ page }) => {
    test.setTimeout(240_000)

    await ensureAuthenticated(page)

    // --- Capture console + errors + network ---
    const consoleLogs = []
    const pageErrors = []
    const networkRequests = []

    page.on('console', msg => consoleLogs.push(msg.text()))
    page.on('pageerror', err => pageErrors.push(err.message))
    page.on('request', req => networkRequests.push(req.url()))

    // --- Navigate with debug mode ---
    await navigateTo(page, '/fst-committee?debug')
    await enableToggles(page)

    // --- Select formula voting mode ---
    const formulaBtn = page.getByRole('button', { name: 'Формула' })
    if (await formulaBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await formulaBtn.click()
    }

    // --- Select first project ---
    const card = page.locator('.fst-pcard').first()
    await expect(card).toBeVisible({ timeout: 10000 })
    await card.click()
    await page.waitForTimeout(1000)

    // Click "Выбрать" in project modal
    const selectBtn = page.locator('.fst-pmodal button:has-text("Выбрать"), button:has-text("Выбрать проект")')
    if (await selectBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await selectBtn.first().click()
      await page.waitForTimeout(500)
    } else {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }

    // --- Start session ---
    const startBtn = page.locator('button:has-text("Начать заседание"), button:has-text("Начать"), button:has-text("Запустить")')
    await expect(startBtn.first()).toBeVisible({ timeout: 5000 })
    await startBtn.first().click()

    // --- Wait for conclusion (up to 150s) ---
    const conclusion = page.locator('.fst-conclusion')
    try {
      await conclusion.waitFor({ state: 'visible', timeout: 150_000 })
    } catch {
      console.log('Session did not reach conclusion within timeout, checking partial results...')
    }

    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'test-results/group-b-session.png', fullPage: true })

    // -----------------------------------------------------------------------
    // Step checks
    // -----------------------------------------------------------------------

    await test.step('#148/#149 — Smart targeting: arguments exist', async () => {
      const argCount = await page.locator('.dt-argument').count()
      expect(argCount, 'Should have debate arguments from smart targeting').toBeGreaterThan(0)
    })

    await test.step('#151 — IRR value != hardcoded 0.25', async () => {
      const kpis = page.locator('.fst-kpi')
      const kpiCount = await kpis.count()
      let foundIRR = false
      for (let i = 0; i < kpiCount; i++) {
        const text = await kpis.nth(i).textContent()
        if (text.includes('IRR')) {
          foundIRR = true
          expect(text, 'IRR should not be hardcoded 25%').not.toContain('25%')
          break
        }
      }
      expect(foundIRR, 'Should find an IRR KPI element').toBe(true)
    })

    await test.step('#152 — Contract save feedback (no error in logs)', async () => {
      const contractLogs = consoleLogs.filter(l => l.includes('[saveContractNodes]'))
      const contractErrors = contractLogs.filter(l =>
        l.toLowerCase().includes('error') || l.toLowerCase().includes('fail')
      )
      expect(contractErrors, 'saveContractNodes should not log errors').toHaveLength(0)
    })

    await test.step('#153 — AgentLoop publishes entries', async () => {
      const agentLoopLogs = consoleLogs.filter(l => l.includes('[AgentLoop]'))
      expect(agentLoopLogs.length, 'AgentLoop should produce console entries').toBeGreaterThan(0)
    })

    await test.step('#158 — Recommendations present in conclusion', async () => {
      const recCount = await page.locator('.fst-rec-item').count()
      if (await conclusion.isVisible().catch(() => false)) {
        expect(recCount, 'Conclusion should have recommendation items').toBeGreaterThan(0)
      }
    })

    await test.step('#160 — Debug panel visible after session', async () => {
      const isVisible = await page.locator('.fst-debug-panel').isVisible().catch(() => false)
      expect(isVisible, 'Debug panel should be visible after session with ?debug').toBe(true)
    })

    await test.step('#162 — KAG requests fired', async () => {
      const kagRequests = networkRequests.filter(url => url.includes('/api/kag/'))
      expect(kagRequests.length, 'Should have KAG API requests').toBeGreaterThan(0)
    })

    await test.step('#164 — No "Недопустимо" in console', async () => {
      const badLogs = consoleLogs.filter(l => l.includes('Недопустимо'))
      expect(badLogs, 'Console should not contain "Недопустимо"').toHaveLength(0)
    })
  })
})
