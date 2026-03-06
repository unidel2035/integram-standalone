/**
 * Test Service
 *
 * Service for running tests and managing test execution.
 * This service communicates with the backend API to execute npm test commands.
 */

import { getOrchestratorUrl } from '@/utils/apiConfig'

const API_BASE_URL = getOrchestratorUrl()

/**
 * Run a test command via the backend API
 * @param {string} command - The npm test command to run (e.g., 'npm run test:unit')
 * @param {string} testId - The unique test identifier
 * @returns {Promise<{exitCode: number, output: string, errorOutput: string, duration: number, status: string}>} Test execution result
 */
export async function runTestCommand(command, testId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/test-runner/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        testId,
        command
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Test execution failed')
    }

    return {
      exitCode: result.data.exitCode,
      output: result.data.output + (result.data.errorOutput ? '\n\nErrors:\n' + result.data.errorOutput : ''),
      duration: result.data.duration,
      status: result.data.status
    }
  } catch (error) {
    throw new Error(`Failed to run test: ${error.message}`)
  }
}

/**
 * Get available test categories and tests from backend
 * @returns {Promise<Array>} List of test categories
 */
export async function getTestCategories() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/test-runner/tests`)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to get test categories')
    }

    return result.data
  } catch (error) {
    console.error('Error fetching test categories:', error)
    // Fallback to local categories if backend fails
    return getLocalTestCategories()
  }
}

/**
 * Get test execution logs
 * @param {string} testId - Optional test ID to filter logs
 * @param {number} limit - Number of logs to retrieve
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Array>} List of test logs
 */
export async function getTestLogs(testId = null, limit = 50, offset = 0) {
  try {
    const params = new URLSearchParams({ limit, offset })
    if (testId) {
      params.append('testId', testId)
    }

    const response = await fetch(`${API_BASE_URL}/api/test-runner/logs?${params}`)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to get test logs')
    }

    return result.data
  } catch (error) {
    console.error('Error fetching test logs:', error)
    throw error
  }
}

/**
 * Get latest log for a specific test
 * @param {string} testId - Test ID
 * @returns {Promise<Object>} Latest test log
 */
export async function getLatestTestLog(testId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/test-runner/logs/${testId}/latest`)

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to get latest test log')
    }

    return result.data
  } catch (error) {
    console.error('Error fetching latest test log:', error)
    return null
  }
}

/**
 * Fallback: Get local test categories (for backwards compatibility)
 * @returns {Array} List of test categories
 */
function getLocalTestCategories() {
  return [
    {
      id: 'unit',
      name: 'Unit Tests',
      icon: '🧩',
      tests: [
        { id: 'unit-all', name: 'All Unit Tests', command: 'npm run test:unit' },
        { id: 'unit-services', name: 'Service Tests', command: 'npm run test:unit -- src/__tests__/service' },
        { id: 'unit-components', name: 'Component Tests', command: 'npm run test:unit -- src/components/__tests__' }
      ]
    },
    {
      id: 'integration',
      name: 'Integration Tests',
      icon: '🔗',
      tests: [
        { id: 'integration-all', name: 'All Integration Tests', command: 'npm run test:integration' }
      ]
    },
    {
      id: 'e2e',
      name: 'E2E Tests',
      icon: '🎭',
      tests: [
        { id: 'e2e-all', name: 'All E2E Tests', command: 'npm run test:e2e' },
        { id: 'e2e-chrome', name: 'E2E (Chrome)', command: 'npm run test:e2e:chrome' }
      ]
    }
  ]
}

/**
 * DEPRECATED: Generate simulated test output for demonstration
 * This is kept for backwards compatibility but should not be used
 */
function generateSimulatedOutput(command) {
  const timestamp = new Date().toISOString()

  // Simulate different outputs based on command type
  if (command.includes('test:unit')) {
    return `
> dronedoc-sakai-vue@4.5.0 test:unit
> vitest run

 RUN  v3.2.4 /tmp/gh-issue-solver-1761985211475

 ✓ src/__tests__/service/telegramApi.spec.js (12 tests) ${Date.now() - 1200}ms
 ✓ src/__tests__/service/ordApi.spec.js (8 tests) ${Date.now() - 800}ms
 ✓ src/__tests__/services/agricultureService.spec.js (15 tests) ${Date.now() - 1500}ms
 ✓ src/components/__tests__/ComponentLoader.spec.js (6 tests) ${Date.now() - 600}ms

 Test Files  4 passed (4)
      Tests  41 passed (41)
   Start at  ${timestamp}
   Duration  2.45s (transform 234ms, setup 0ms, collect 1.12s, tests 1.09s, environment 0ms, prepare 145ms)
`
  } else if (command.includes('test:integration')) {
    return `
> dronedoc-sakai-vue@4.5.0 test:integration
> vitest run tests/integration

 RUN  v3.2.4 /tmp/gh-issue-solver-1761985211475

 ✓ tests/integration/router.spec.js (5 tests) ${Date.now() - 500}ms
 ✓ tests/integration/agents/agent-lifecycle.spec.js (8 tests) ${Date.now() - 900}ms

 Test Files  2 passed (2)
      Tests  13 passed (13)
   Start at  ${timestamp}
   Duration  1.67s (transform 156ms, setup 0ms, collect 678ms, tests 834ms, environment 0ms, prepare 89ms)
`
  } else if (command.includes('test:e2e')) {
    return `
> dronedoc-sakai-vue@4.5.0 test:e2e
> playwright test

Running 24 tests using 4 workers
  24 passed (45.3s)

To open last HTML report run:
  npx playwright show-report

Execution time: ${timestamp}
`
  } else if (command.includes('verify-imports')) {
    return `
> dronedoc-sakai-vue@4.5.0 verify-imports
> node scripts/verify-imports.js

✓ Checking imports in .vue files...
✓ Checking imports in .js files...
✓ Checking imports in .ts files...

Summary:
  Files scanned: 487
  Import statements: 2,341
  Valid imports: 2,341
  Broken imports: 0

All imports are valid!
`
  } else {
    return `
> dronedoc-sakai-vue@4.5.0 ${command.replace('npm run ', '')}

Test execution completed successfully.
Timestamp: ${timestamp}
`
  }
}

export default {
  runTestCommand,
  getTestCategories,
  getTestLogs,
  getLatestTestLog
}
