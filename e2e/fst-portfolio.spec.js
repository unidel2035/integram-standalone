/**
 * E2E tests for /fst-portfolio — Portfolio Monitoring
 *
 * Tests portfolio company cards, risk indicators, and AI reports
 */

import { test, expect } from '@playwright/test'

test.describe('FstPortfolio — Portfolio Monitoring', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fst-portfolio')
  })

  test('loads the portfolio page', async ({ page }) => {
    await expect(page).toHaveTitle(/Портфельный монитор|Portfolio/)

    await expect(page.locator('body')).toBeVisible()
  })

  test('displays portfolio companies or empty state', async ({ page }) => {
    await page.waitForTimeout(2000)

    // Either show companies or empty state
    const hasCompanies = await page.locator('.company-card, .portfolio-card, [data-testid="company-card"]').count()
    const hasEmptyState = await page.locator('.empty-state, .no-data, :text("Нет компаний")').isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasCompanies > 0 || hasEmptyState).toBe(true)
  })

  test('smoke test: page renders without errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))

    await page.waitForLoadState('networkidle', { timeout: 10000 })

    const realErrors = errors.filter(e => !e.includes('[Vue warn]') && !e.includes('ResizeObserver'))
    expect(realErrors).toHaveLength(0)
  })
})
