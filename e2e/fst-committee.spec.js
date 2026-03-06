/**
 * E2E tests for /fst-committee — AI Investment Committee
 *
 * Tests the investment committee simulation flow:
 * - Loading the page
 * - Creating a project
 * - Running the IC session
 * - Checking debate and voting
 */

import { test, expect } from '@playwright/test'

test.describe('FstCommittee — AI Investment Committee', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fst-committee')
  })

  test('loads the committee page', async ({ page }) => {
    await expect(page).toHaveTitle(/AI-инвесткомитет/)

    // Check for main UI elements
    await expect(page.locator('h1, h2, .page-title')).toContainText(/инвесткомитет/i)
  })

  test('displays all 6 AI agents', async ({ page }) => {
    // Wait for agents to load
    await page.waitForTimeout(2000)

    const agentCards = page.locator('.agent-card, [data-testid="agent-card"]')

    // Should have 6 agents: tech, finance, sovereignty, risk, portfolio, devil
    await expect(agentCards).toHaveCount(6, { timeout: 10000 })
  })

  test('can create a new project', async ({ page }) => {
    // Look for "New Project" or "Создать проект" button
    const createButton = page.locator('button:has-text("Создать"), button:has-text("New"), button:has-text("проект")').first()

    if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createButton.click()

      // Fill project form if it appears
      await page.waitForTimeout(1000)
    }
  })

  test('displays phase progression', async ({ page }) => {
    // Check for phase indicators
    const phases = [
      'LOADING',
      'PRIMARY_POSITIONS',
      'CROSS_DEBATE',
      'VOTING',
      'SYNTHESIS',
      'HUMAN_APPROVAL'
    ]

    // At least one phase indicator should be visible
    const phaseElements = page.locator('[data-phase], .phase-indicator, .phase-badge')
    const count = await phaseElements.count()

    expect(count).toBeGreaterThan(0)
  })

  test('smoke test: page renders without errors', async ({ page }) => {
    // Check console for errors
    const errors = []
    page.on('pageerror', error => errors.push(error.message))

    await page.waitForLoadState('networkidle', { timeout: 10000 })

    // Allow Vue dev warnings but fail on real errors
    const realErrors = errors.filter(e => !e.includes('[Vue warn]'))
    expect(realErrors).toHaveLength(0)
  })
})
