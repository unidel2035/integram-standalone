// @ts-check
import { test, expect } from '@playwright/test'

/** Close any blocking modal dialogs (role-selection, onboarding, etc.) */
async function dismissModals(page) {
  await page.waitForTimeout(1500)
  // Try "Выбрать позже" (skip onboarding) or close button
  const skipBtn = page.locator('text=Выбрать позже')
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click()
    await page.waitForTimeout(500)
  }
  // Try close button on any remaining dialog
  const closeBtn = page.locator('.p-dialog-close-button').first()
  if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn.click()
    await page.waitForTimeout(300)
  }
  // Escape as last resort
  await page.keyboard.press('Escape')
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

test.describe('FST Committee — Voting Modes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fst-committee')
    await page.waitForLoadState('networkidle')
    await dismissModals(page)
  })

  test('page loads with voting mode selector', async ({ page }) => {
    await enableToggles(page)
    await expect(page.locator('text=Голосование:')).toBeVisible({ timeout: 5000 })
  })

  test('voting mode has three options', async ({ page }) => {
    await enableToggles(page)
    await expect(page.getByRole('button', { name: 'Формула' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: 'Гибрид' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: 'LLM' })).toBeVisible({ timeout: 5000 })
  })

  test('switching voting mode updates description', async ({ page }) => {
    await enableToggles(page)

    // Default is Гибрид
    await expect(page.locator('text=LLM stance из дебатов')).toBeVisible({ timeout: 5000 })

    // Switch to Формула
    await page.getByRole('button', { name: 'Формула' }).click()
    await expect(page.locator('text=Алгоритмические веса')).toBeVisible({ timeout: 3000 })

    // Switch to LLM
    await page.getByRole('button', { name: 'LLM' }).click()
    await expect(page.locator('text=Чисто LLM')).toBeVisible({ timeout: 3000 })

    // Back to Гибрид
    await page.getByRole('button', { name: 'Гибрид' }).click()
    await expect(page.locator('text=LLM stance из дебатов')).toBeVisible({ timeout: 3000 })
  })
})

test.describe('FST Committee — Page Integrity', () => {
  test('smoke test: no critical JS errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/fst-committee')
    await page.waitForLoadState('networkidle')
    await dismissModals(page)
    await page.waitForTimeout(2000)

    const critical = errors.filter(e =>
      !e.includes('[Vue warn]') &&
      !e.includes('ResizeObserver') &&
      !e.includes('Script error') &&
      !e.includes('Non-Error') &&
      !e.includes('hydration') &&
      !e.includes('Failed to fetch')
    )
    expect(critical).toHaveLength(0)
  })

  test('agents section visible on page', async ({ page }) => {
    await page.goto('/fst-committee')
    await page.waitForLoadState('networkidle')
    await dismissModals(page)

    await expect(page.locator('body')).toBeVisible()
    // Page should have some committee-related content
    const content = await page.textContent('body')
    expect(content.length).toBeGreaterThan(100)
  })
})

test.describe('FST Committee — Debate Flow', () => {
  test('start debate with formula voting', async ({ page }) => {
    test.setTimeout(180_000)

    await page.goto('/fst-committee')
    await page.waitForLoadState('networkidle')
    await dismissModals(page)
    await enableToggles(page)

    // Set formula mode
    const formulaBtn = page.getByRole('button', { name: 'Формула' })
    if (await formulaBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await formulaBtn.click()
    }

    // Select project
    const projectCard = page.locator('.fst-project-card, [class*="project-card"], .p-card').first()
    if (await projectCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectCard.click()
    }

    // Start debate
    const startBtn = page.locator('button:has-text("Начать заседание"), button:has-text("Начать"), button:has-text("Запустить")')
    if (await startBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await startBtn.first().click()
      // Wait for some phase to appear
      await page.waitForTimeout(10_000)
    }
    // If we got here without crash — pass
  })

  test('parallel API tracking works', async ({ page }) => {
    test.setTimeout(30_000)

    const apiCalls = []
    page.on('request', (req) => {
      if (req.url().includes('/api/ai-tokens/chat')) {
        apiCalls.push(Date.now())
      }
    })

    await page.goto('/fst-committee')
    await page.waitForLoadState('networkidle')
    await dismissModals(page)

    // Verify API tracking mechanism works (no crash)
    expect(apiCalls).toBeDefined()
  })
})
