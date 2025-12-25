/**
 * GitHub Issue Service for Backend Self-Healing
 * Issue #1674: Система самолечения бэкэнда
 *
 * Automatically creates GitHub issues for backend errors
 */

import { Octokit } from '@octokit/rest';
import logger from '../../utils/logger.js';
import { pool } from '../../config/database.js';

export class GitHubIssueService {
  constructor(options = {}) {
    this.owner = options.owner || process.env.GITHUB_OWNER || 'unidel2035';
    this.repo = options.repo || process.env.GITHUB_REPO || 'dronedoc2025';
    this.githubToken = null;
    this.octokit = null;
    this.rateLimitRemaining = 5000;
    this.rateLimitReset = null;

    logger.info('GitHubIssueService initialized', {
      owner: this.owner,
      repo: this.repo
    });
  }

  /**
   * Get GitHub token from environment or database
   */
  async getGitHubToken() {
    // Check cache first
    if (this.githubToken) {
      return this.githubToken;
    }

    // Check environment variable
    if (process.env.GITHUB_TOKEN) {
      logger.debug('Using GitHub token from environment variable');
      this.githubToken = process.env.GITHUB_TOKEN;
      return this.githubToken;
    }

    // Try to get from unified token storage
    try {
      const result = await pool.query(`
        SELECT
          k.api_key_encrypted,
          p.name as provider_name
        FROM ai_provider_api_keys k
        JOIN ai_model_providers p ON k.provider_id = p.id
        WHERE p.name = 'github'
          AND k.is_active = true
          AND k.is_default = true
        LIMIT 1
      `);

      if (result.rows.length === 0) {
        logger.warn('GitHub API key not found in unified token storage or environment');
        return null;
      }

      // Decrypt the key
      const encryptedKey = result.rows[0].api_key_encrypted;
      this.githubToken = Buffer.from(encryptedKey, 'base64').toString('utf-8');

      logger.debug('Using GitHub token from unified token storage');
      return this.githubToken;
    } catch (error) {
      logger.error('Failed to retrieve GitHub token', {
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  /**
   * Initialize Octokit client
   */
  async initOctokit() {
    if (this.octokit) {
      return this.octokit;
    }

    const token = await this.getGitHubToken();
    if (!token) {
      throw new Error('GitHub token not configured');
    }

    this.octokit = new Octokit({ auth: token });

    // Check rate limit
    try {
      const { data } = await this.octokit.rateLimit.get();
      this.rateLimitRemaining = data.rate.remaining;
      this.rateLimitReset = new Date(data.rate.reset * 1000);

      logger.info('GitHub API rate limit checked', {
        remaining: this.rateLimitRemaining,
        reset: this.rateLimitReset
      });
    } catch (error) {
      logger.warn('Failed to check GitHub rate limit', { error: error.message });
    }

    return this.octokit;
  }

  /**
   * Check if issue already exists for this error
   */
  async findExistingIssue(errorSignature) {
    try {
      await this.initOctokit();

      const searchQuery = `repo:${this.owner}/${this.repo} is:issue label:backend-error "${errorSignature}"`;

      const { data } = await this.octokit.search.issuesAndPullRequests({
        q: searchQuery,
        per_page: 1,
        sort: 'created',
        order: 'desc'
      });

      if (data.items.length > 0) {
        const issue = data.items[0];
        logger.info('Found existing GitHub issue for error', {
          issueNumber: issue.number,
          issueUrl: issue.html_url,
          errorSignature
        });
        return issue;
      }

      return null;
    } catch (error) {
      logger.error('Failed to search for existing issue', {
        error: error.message,
        errorSignature
      });
      return null;
    }
  }

  /**
   * Generate error signature for deduplication
   */
  generateErrorSignature(errorLog) {
    const { error_type, error_message, service_name, endpoint } = errorLog;

    // Create a simplified signature for matching similar errors
    const message = error_message || '';
    const firstLine = message.split('\n')[0].substring(0, 100);

    return `${service_name}:${error_type}:${firstLine}`;
  }

  /**
   * Format error log as GitHub issue body
   */
  formatIssueBody(errorLog, recoveryActions = []) {
    const {
      error_type,
      severity,
      service_name,
      error_message,
      error_stack,
      error_context,
      endpoint,
      request_method,
      timestamp,
      user_id,
      ip_address
    } = errorLog;

    let body = `## 🚨 Backend Error Report\n\n`;
    body += `**Auto-generated error report from backend self-healing system**\n\n`;

    body += `### Error Details\n\n`;
    body += `- **Severity:** \`${severity}\`\n`;
    body += `- **Error Type:** \`${error_type}\`\n`;
    body += `- **Service:** \`${service_name}\`\n`;
    body += `- **Timestamp:** ${timestamp}\n`;

    if (endpoint) {
      body += `- **Endpoint:** \`${request_method} ${endpoint}\`\n`;
    }

    if (user_id) {
      body += `- **User ID:** \`${user_id}\`\n`;
    }

    if (ip_address) {
      body += `- **IP Address:** \`${ip_address}\`\n`;
    }

    body += `\n### Error Message\n\n`;
    body += `\`\`\`\n${error_message}\n\`\`\`\n\n`;

    if (error_stack) {
      body += `### Stack Trace\n\n`;
      body += `<details>\n<summary>Click to expand stack trace</summary>\n\n`;
      body += `\`\`\`\n${error_stack}\n\`\`\`\n\n`;
      body += `</details>\n\n`;
    }

    if (error_context && Object.keys(error_context).length > 0) {
      body += `### Error Context\n\n`;
      body += `\`\`\`json\n${JSON.stringify(error_context, null, 2)}\n\`\`\`\n\n`;
    }

    if (recoveryActions.length > 0) {
      body += `### Recovery Actions Attempted\n\n`;
      recoveryActions.forEach((action) => {
        const icon = action.success ? '✅' : '❌';
        body += `${icon} **${action.action_type}** - ${action.status}\n`;
        if (action.result_message) {
          body += `  - ${action.result_message}\n`;
        }
      });
      body += `\n`;
    }

    body += `---\n`;
    body += `*Автоматически создано системой самолечения бэкэнда*\n`;
    body += `*Issue #1674 - Backend Self-Healing System*\n`;

    return body;
  }

  /**
   * Create GitHub issue for backend error
   */
  async createIssueForError(errorLog, recoveryActions = []) {
    try {
      await this.initOctokit();

      // Check rate limit
      if (this.rateLimitRemaining < 10) {
        logger.warn('GitHub API rate limit low, skipping issue creation', {
          remaining: this.rateLimitRemaining,
          reset: this.rateLimitReset
        });
        return null;
      }

      // Generate error signature
      const errorSignature = this.generateErrorSignature(errorLog);

      // Check if issue already exists
      const existingIssue = await this.findExistingIssue(errorSignature);
      if (existingIssue && existingIssue.state === 'open') {
        logger.info('Skipping issue creation - similar issue already exists', {
          existingIssue: existingIssue.number,
          errorSignature
        });

        // Add a comment to existing issue
        await this.addCommentToIssue(existingIssue.number, errorLog, recoveryActions);

        return existingIssue;
      }

      // Create issue title
      const title = `[Backend Error] ${errorLog.service_name}: ${errorLog.error_type}`;

      // Create issue body
      const body = this.formatIssueBody(errorLog, recoveryActions);

      // Determine labels based on severity
      const labels = ['backend-error', 'auto-generated'];
      if (errorLog.severity === 'critical') {
        labels.push('critical', 'priority-high');
      } else if (errorLog.severity === 'high') {
        labels.push('priority-high');
      } else if (errorLog.severity === 'medium') {
        labels.push('priority-medium');
      } else {
        labels.push('priority-low');
      }

      // Add service label
      if (errorLog.service_name) {
        labels.push(`service:${errorLog.service_name}`);
      }

      // Create the issue
      logger.info('Creating GitHub issue for backend error', {
        title: title.substring(0, 50),
        severity: errorLog.severity,
        service: errorLog.service_name
      });

      const { data: issue } = await this.octokit.issues.create({
        owner: this.owner,
        repo: this.repo,
        title,
        body,
        labels
      });

      logger.info('GitHub issue created successfully', {
        issueNumber: issue.number,
        issueUrl: issue.html_url
      });

      // Update rate limit
      this.rateLimitRemaining--;

      return issue;
    } catch (error) {
      logger.error('Failed to create GitHub issue', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Add comment to existing issue
   */
  async addCommentToIssue(issueNumber, errorLog, recoveryActions = []) {
    try {
      await this.initOctokit();

      let comment = `### 🔄 Error Occurred Again\n\n`;
      comment += `**Timestamp:** ${errorLog.timestamp}\n`;
      comment += `**Error Type:** \`${errorLog.error_type}\`\n`;
      comment += `**Severity:** \`${errorLog.severity}\`\n\n`;

      if (recoveryActions.length > 0) {
        comment += `**Recovery Actions:**\n`;
        recoveryActions.forEach((action) => {
          const icon = action.success ? '✅' : '❌';
          comment += `${icon} ${action.action_type} - ${action.status}\n`;
        });
        comment += `\n`;
      }

      comment += `\`\`\`\n${errorLog.error_message}\n\`\`\`\n`;

      await this.octokit.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        body: comment
      });

      logger.info('Added comment to existing GitHub issue', {
        issueNumber
      });

      return true;
    } catch (error) {
      logger.error('Failed to add comment to issue', {
        error: error.message,
        issueNumber
      });
      return false;
    }
  }

  /**
   * Update error log with GitHub issue information
   */
  async updateErrorLogWithIssue(errorLogId, issue) {
    try {
      await pool.query(
        `UPDATE backend_error_logs
         SET github_issue_number = $1,
             github_issue_url = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [issue.number, issue.html_url, errorLogId]
      );

      logger.debug('Updated error log with GitHub issue info', {
        errorLogId,
        issueNumber: issue.number
      });
    } catch (error) {
      logger.error('Failed to update error log with issue info', {
        error: error.message,
        errorLogId
      });
    }
  }

  /**
   * Close GitHub issue when error is resolved
   */
  async closeIssueForResolvedError(issueNumber, resolutionMessage) {
    try {
      await this.initOctokit();

      // Add resolution comment
      await this.octokit.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        body: `✅ **Error Resolved**\n\n${resolutionMessage}\n\n*Auto-closed by backend self-healing system*`
      });

      // Close the issue
      await this.octokit.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        state: 'closed'
      });

      logger.info('Closed GitHub issue for resolved error', {
        issueNumber
      });

      return true;
    } catch (error) {
      logger.error('Failed to close GitHub issue', {
        error: error.message,
        issueNumber
      });
      return false;
    }
  }
}

export default GitHubIssueService;
