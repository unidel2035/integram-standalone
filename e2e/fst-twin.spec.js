/**
 * E2E tests for /fst-twin — Digital Twin Simulation
 *
 * Tests company digital twin simulation and tick engine
 */

import { test, expect } from '@playwright/test'

test.describe('FstDigitalTwin — Company Digital Twin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fst-twin')
  })

  test('loads the digital twin page', async ({ page }) => {
    await expect(page).toHaveTitle(/Цифровой двойник|Digital Twin/)

    await expect(page.locator('body')).toBeVisible()
  })

  test('displays simulation controls or status', async ({ page }) => {
    await page.waitForTimeout(2000)

    // Look for simulation-related UI elements
    const hasSimulation = await page.locator('button:has-text("Start"), button:has-text("Запуск"), button:has-text("Симуляция"), .simulation-panel, [data-testid="simulation"]').isVisible({ timeout: 5000 }).catch(() => false)
    const hasContent = await page.locator('.twin-container, .simulation-container, canvas, svg').isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasSimulation || hasContent).toBe(true)
  })

  test('smoke test: page renders without errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))

    await page.waitForLoadState('networkidle', { timeout: 10000 })

    const realErrors = errors.filter(e => !e.includes('[Vue warn]') && !e.includes('ResizeObserver'))
    expect(realErrors).toHaveLength(0)
  })
})
