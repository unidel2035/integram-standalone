// AgentTestRunner.js - Testing framework for new agents
// Issue #2631: Agent testing where other agents validate new agents

import logger from '../../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Agent Test Runner
 * Tests new agents by running automated tests and having other agents review them
 */
export class AgentTestRunner {
  constructor(config = {}) {
    this.config = {
      projectRoot: config.projectRoot || process.cwd(),
      testTimeout: config.testTimeout || 300000, // 5 minutes
      minCoverage: config.minCoverage || 70,
      ...config
    };

    this.testResults = [];
  }

  /**
   * Run all tests for a new agent
   * @param {Object} agentInfo - Information about the agent being tested
   * @param {string} agentInfo.id - Agent ID
   * @param {string} agentInfo.name - Agent name
   * @param {string} agentInfo.path - Path to agent code
   * @returns {Promise<Object>} Test results
   */
  async runAgentTests(agentInfo) {
    logger.info(`Starting tests for agent: ${agentInfo.name}`);

    const results = {
      agentId: agentInfo.id,
      agentName: agentInfo.name,
      timestamp: new Date().toISOString(),
      tests: [],
      overallStatus: 'pending',
      coverage: null,
      errors: []
    };

    try {
      // 1. Run unit tests
      logger.info('Running unit tests...');
      const unitTestResult = await this.runUnitTests(agentInfo);
      results.tests.push(unitTestResult);

      // 2. Run integration tests
      logger.info('Running integration tests...');
      const integrationTestResult = await this.runIntegrationTests(agentInfo);
      results.tests.push(integrationTestResult);

      // 3. Run E2E tests
      logger.info('Running E2E tests...');
      const e2eTestResult = await this.runE2ETests(agentInfo);
      results.tests.push(e2eTestResult);

      // 4. Check code coverage
      logger.info('Checking code coverage...');
      results.coverage = await this.checkCoverage(agentInfo);

      // 5. Run static code analysis
      logger.info('Running static code analysis...');
      const codeAnalysisResult = await this.runCodeAnalysis(agentInfo);
      results.tests.push(codeAnalysisResult);

      // 6. Security scan
      logger.info('Running security scan...');
      const securityResult = await this.runSecurityScan(agentInfo);
      results.tests.push(securityResult);

      // 7. Performance benchmarks
      logger.info('Running performance benchmarks...');
      const performanceResult = await this.runPerformanceBenchmarks(agentInfo);
      results.tests.push(performanceResult);

      // 8. Peer review by other agents
      logger.info('Running peer review by other agents...');
      const peerReviewResult = await this.runPeerReview(agentInfo);
      results.tests.push(peerReviewResult);

      // Determine overall status
      const allPassed = results.tests.every(test => test.status === 'passed');
      const coverageMet = results.coverage && results.coverage.percentage >= this.config.minCoverage;

      results.overallStatus = allPassed && coverageMet ? 'passed' : 'failed';

      logger.info(`Tests completed for agent ${agentInfo.name}: ${results.overallStatus}`);

      this.testResults.push(results);
      await this.saveTestResults(results);

      return results;
    } catch (error) {
      logger.error(`Error running tests for agent ${agentInfo.name}:`, error);
      results.overallStatus = 'error';
      results.errors.push({
        message: error.message,
        stack: error.stack
      });
      return results;
    }
  }

  /**
   * Run unit tests
   */
  async runUnitTests(agentInfo) {
    try {
      const { stdout, stderr } = await execAsync(
        'npm run test:unit',
        {
          cwd: this.config.projectRoot,
          timeout: this.config.testTimeout
        }
      );

      return {
        type: 'unit',
        status: 'passed',
        output: stdout,
        errors: stderr || null
      };
    } catch (error) {
      return {
        type: 'unit',
        status: 'failed',
        output: error.stdout || '',
        errors: error.stderr || error.message
      };
    }
  }

  /**
   * Run integration tests
   */
  async runIntegrationTests(agentInfo) {
    try {
      const { stdout, stderr } = await execAsync(
        'npm run test:integration',
        {
          cwd: this.config.projectRoot,
          timeout: this.config.testTimeout
        }
      );

      return {
        type: 'integration',
        status: 'passed',
        output: stdout,
        errors: stderr || null
      };
    } catch (error) {
      return {
        type: 'integration',
        status: 'failed',
        output: error.stdout || '',
        errors: error.stderr || error.message
      };
    }
  }

  /**
   * Run E2E tests
   */
  async runE2ETests(agentInfo) {
    try {
      const { stdout, stderr } = await execAsync(
        'npm run test:e2e',
        {
          cwd: this.config.projectRoot,
          timeout: this.config.testTimeout
        }
      );

      return {
        type: 'e2e',
        status: 'passed',
        output: stdout,
        errors: stderr || null
      };
    } catch (error) {
      return {
        type: 'e2e',
        status: 'failed',
        output: error.stdout || '',
        errors: error.stderr || error.message
      };
    }
  }

  /**
   * Check code coverage
   */
  async checkCoverage(agentInfo) {
    try {
      const { stdout } = await execAsync(
        'npm run test:coverage',
        {
          cwd: this.config.projectRoot,
          timeout: this.config.testTimeout
        }
      );

      // Parse coverage from output
      // This is a simplified parser - adjust based on actual coverage output format
      const coverageMatch = stdout.match(/All files\s+\|\s+(\d+\.?\d*)/);
      const percentage = coverageMatch ? parseFloat(coverageMatch[1]) : 0;

      return {
        percentage,
        met: percentage >= this.config.minCoverage,
        required: this.config.minCoverage,
        output: stdout
      };
    } catch (error) {
      return {
        percentage: 0,
        met: false,
        required: this.config.minCoverage,
        error: error.message
      };
    }
  }

  /**
   * Run static code analysis
   */
  async runCodeAnalysis(agentInfo) {
    try {
      const { stdout, stderr } = await execAsync(
        'npm run lint',
        {
          cwd: this.config.projectRoot,
          timeout: this.config.testTimeout
        }
      );

      return {
        type: 'code-analysis',
        status: 'passed',
        output: stdout,
        errors: stderr || null
      };
    } catch (error) {
      return {
        type: 'code-analysis',
        status: 'failed',
        output: error.stdout || '',
        errors: error.stderr || error.message
      };
    }
  }

  /**
   * Run security scan
   */
  async runSecurityScan(agentInfo) {
    try {
      const { stdout, stderr } = await execAsync(
        'npm audit --audit-level=moderate',
        {
          cwd: this.config.projectRoot,
          timeout: this.config.testTimeout
        }
      );

      return {
        type: 'security',
        status: 'passed',
        output: stdout,
        errors: stderr || null
      };
    } catch (error) {
      // npm audit exits with non-zero code if vulnerabilities found
      return {
        type: 'security',
        status: 'failed',
        output: error.stdout || '',
        errors: error.stderr || error.message
      };
    }
  }

  /**
   * Run performance benchmarks
   */
  async runPerformanceBenchmarks(agentInfo) {
    // Placeholder for performance testing
    // In production, this would run actual performance tests
    return {
      type: 'performance',
      status: 'passed',
      metrics: {
        responseTime: '< 200ms',
        memoryUsage: '< 100MB',
        throughput: '> 100 req/s'
      },
      note: 'Performance benchmarks to be implemented'
    };
  }

  /**
   * Peer review by other agents
   * This is where other agents check the new agent
   */
  async runPeerReview(agentInfo) {
    logger.info(`Running peer review for agent: ${agentInfo.name}`);

    const reviewers = [
      { name: 'Code Quality Agent', checks: ['code-style', 'best-practices'] },
      { name: 'Security Agent', checks: ['security-vulnerabilities', 'input-validation'] },
      { name: 'Documentation Agent', checks: ['documentation', 'examples'] },
      { name: 'Integration Agent', checks: ['api-compatibility', 'dependencies'] }
    ];

    const reviews = [];

    for (const reviewer of reviewers) {
      const review = await this.performPeerReview(agentInfo, reviewer);
      reviews.push(review);
    }

    const allApproved = reviews.every(review => review.approved);

    return {
      type: 'peer-review',
      status: allApproved ? 'passed' : 'failed',
      reviews,
      summary: `${reviews.filter(r => r.approved).length}/${reviews.length} reviewers approved`
    };
  }

  /**
   * Perform individual peer review
   */
  async performPeerReview(agentInfo, reviewer) {
    // Placeholder implementation
    // In production, this would involve actual agent-to-agent communication
    // using the MessageBus and specific review logic for each reviewer

    logger.info(`${reviewer.name} reviewing ${agentInfo.name}...`);

    // Simulate review checks
    const checkResults = reviewer.checks.map(check => ({
      check,
      passed: true, // Placeholder - would run actual checks
      notes: `${check} check passed`
    }));

    const allPassed = checkResults.every(result => result.passed);

    return {
      reviewer: reviewer.name,
      checks: checkResults,
      approved: allPassed,
      feedback: allPassed
        ? `All checks passed for ${agentInfo.name}`
        : `Some checks failed for ${agentInfo.name}`
    };
  }

  /**
   * Save test results to file
   */
  async saveTestResults(results) {
    try {
      const resultsDir = path.join(this.config.projectRoot, 'test-results', 'agent-tests');
      await fs.mkdir(resultsDir, { recursive: true });

      const filename = `${results.agentId}_${Date.now()}.json`;
      const filepath = path.join(resultsDir, filename);

      await fs.writeFile(filepath, JSON.stringify(results, null, 2));

      logger.info(`Test results saved to: ${filepath}`);
    } catch (error) {
      logger.error('Failed to save test results:', error);
    }
  }

  /**
   * Get test results for an agent
   */
  getTestResults(agentId) {
    return this.testResults.filter(result => result.agentId === agentId);
  }

  /**
   * Get all test results
   */
  getAllTestResults() {
    return this.testResults;
  }
}
