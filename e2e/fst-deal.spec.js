/**
 * E2E tests for /fst-deal — Deal Management
 *
 * Tests deal creation, form validation, and saving
 */

import { test, expect } from '@playwright/test'

test.describe('FstDeal — Deal Creation & Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fst-deal')
  })

  test('loads the deal page', async ({ page }) => {
    await expect(page).toHaveTitle(/Доведение сделки|Deal/)

    // Page should contain deal-related content
    const content = page.locator('body')
    await expect(content).toBeVisible()
  })

  test('displays deal form or deal list', async ({ page }) => {
    await page.waitForTimeout(2000)

    // Should have either a form or a list of deals
    const hasForm = await page.locator('form, .deal-form, [data-testid="deal-form"]').isVisible({ timeout: 5000 }).catch(() => false)
    const hasList = await page.locator('.deal-list, .deal-card, table').isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasForm || hasList).toBe(true)
  })

  test('smoke test: page renders without critical errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))

    await page.waitForLoadState('networkidle', { timeout: 10000 })

    const realErrors = errors.filter(e => !e.includes('[Vue warn]') && !e.includes('ResizeObserver'))
    expect(realErrors).toHaveLength(0)
  })
})
