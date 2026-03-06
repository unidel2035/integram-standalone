import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Test Configuration for VentureOS FST Platform
 *
 * Tests all FST routes including:
 * - /fst-committee — AI Investment Committee
 * - /fst-deal — Deal creation and management
 * - /fst-portfolio — Portfolio monitoring
 * - /fst-twin — Digital Twin simulation
 * - /fst-fund — Fund Twin NAV/IRR
 */

export default defineConfig({
  testDir: './e2e',

  fullyParallel: true,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html'],
    ['list'],
    process.env.CI ? ['github'] : ['list']
  ],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5174',

    trace: 'on-first-retry',

    screenshot: 'only-on-failure',

    video: 'retain-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
