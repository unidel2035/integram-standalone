/**
 * GitHub Webhook Service for KAG Auto-Indexing
 *
 * Handles GitHub webhook events and triggers incremental KAG indexing.
 * Supports HMAC signature verification for security.
 *
 * Events handled:
 * - push: Update files in knowledge graph
 * - pull_request: Update PR entities
 * - issues: Update issue entities
 * - issue_comment: Update issue with new comments
 *
 * Issue #5079
 *
 * @module WebhookService
 */

import crypto from 'crypto';
import logger from '../../utils/logger.js';
import { getKAGService } from './KAGService.js';
import { getWebhookQueue } from './WebhookQueue.js';

class WebhookService {
  constructor() {
    this.kagService = getKAGService();
    this.webhookQueue = getWebhookQueue();

    // Get webhook secret from environment
    this.webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || null;

    if (!this.webhookSecret) {
      logger.warn('[Webhook] GITHUB_WEBHOOK_SECRET not set - webhook signature verification disabled');
    }
  }

  /**
   * Verify GitHub webhook signature using HMAC SHA-256
   * @param {string} payload - Raw webhook payload
   * @param {string} signature - GitHub signature from X-Hub-Signature-256 header
   * @returns {boolean} True if signature is valid
   */
  verifySignature(payload, signature) {
    if (!this.webhookSecret) {
      logger.warn('[Webhook] Skipping signature verification (no secret configured)');
      return true; // Allow webhooks when secret is not configured (development mode)
    }

    if (!signature) {
      logger.error('[Webhook] No signature provided');
      return false;
    }

    // GitHub sends signature in format: sha256=<hex>
    const signatureParts = signature.split('=');
    if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
      logger.error('[Webhook] Invalid signature format', { signature });
      return false;
    }

    const receivedSignature = signatureParts[1];

    // Compute expected signature
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    hmac.update(payload, 'utf-8');
    const expectedSignature = hmac.digest('hex');

    // Compare signatures using timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    if (!isValid) {
      logger.error('[Webhook] Signature verification failed');
    }

    return isValid;
  }

  /**
   * Handle incoming webhook event
   * @param {string} event - GitHub event type (e.g., 'push', 'pull_request', 'issues')
   * @param {Object} payload - Webhook payload
   * @param {string} deliveryId - GitHub delivery ID
   * @returns {Promise<Object>} Processing result
   */
  async handleWebhook(event, payload, deliveryId) {
    logger.info('[Webhook] Received event', {
      event,
      deliveryId,
      repository: payload.repository?.full_name
    });

    // Validate repository
    if (!this.isTargetRepository(payload.repository)) {
      logger.info('[Webhook] Ignoring event from non-target repository', {
        repository: payload.repository?.full_name
      });
      return { success: true, ignored: true, reason: 'non-target repository' };
    }

    // Queue the webhook for async processing
    const job = await this.webhookQueue.add({
      event,
      payload,
      deliveryId,
      receivedAt: new Date().toISOString()
    });

    logger.info('[Webhook] Event queued for processing', {
      event,
      deliveryId,
      jobId: job.id
    });

    return {
      success: true,
      queued: true,
      jobId: job.id,
      event
    };
  }

  /**
   * Check if webhook is from target repository
   * @param {Object} repository - Repository object from webhook payload
   * @returns {boolean} True if target repository
   * @private
   */
  isTargetRepository(repository) {
    if (!repository) return false;

    const targetOwner = process.env.GITHUB_OWNER || 'unidel2035';
    const targetRepo = process.env.GITHUB_REPO || 'dronedoc2025';
    const targetFullName = `${targetOwner}/${targetRepo}`;

    return repository.full_name === targetFullName;
  }

  /**
   * Process webhook event (called by queue worker)
   * @param {Object} job - Queue job data
   * @returns {Promise<Object>} Processing result
   */
  async processWebhookEvent(job) {
    const { event, payload, deliveryId } = job;

    logger.info('[Webhook] Processing event', { event, deliveryId });

    try {
      let result;

      switch (event) {
        case 'push':
          result = await this.handlePushEvent(payload);
          break;

        case 'pull_request':
          result = await this.handlePullRequestEvent(payload);
          break;

        case 'issues':
          result = await this.handleIssuesEvent(payload);
          break;

        case 'issue_comment':
          result = await this.handleIssueCommentEvent(payload);
          break;

        default:
          logger.info('[Webhook] Unsupported event type, ignoring', { event });
          result = { success: true, ignored: true, reason: 'unsupported event type' };
      }

      logger.info('[Webhook] Event processed successfully', {
        event,
        deliveryId,
        result
      });

      return result;
    } catch (error) {
      logger.error('[Webhook] Event processing failed', {
        event,
        deliveryId,
        error: error.message,
        stack: error.stack
      });
      throw error; // Re-throw for queue retry handling
    }
  }

  /**
   * Handle push event - update modified files
   * @param {Object} payload - Push event payload
   * @returns {Promise<Object>} Processing result
   */
  async handlePushEvent(payload) {
    const { commits, ref, repository } = payload;

    logger.info('[Webhook Push] Processing push event', {
      ref,
      commitsCount: commits?.length || 0
    });

    if (!commits || commits.length === 0) {
      return { success: true, updated: 0, reason: 'no commits' };
    }

    // Extract all modified file paths from commits
    const modifiedFiles = new Set();
    const addedFiles = new Set();
    const removedFiles = new Set();

    for (const commit of commits) {
      // added, modified, removed arrays from commit
      if (commit.added) {
        commit.added.forEach(file => addedFiles.add(file));
      }
      if (commit.modified) {
        commit.modified.forEach(file => modifiedFiles.add(file));
      }
      if (commit.removed) {
        commit.removed.forEach(file => removedFiles.add(file));
      }
    }

    logger.info('[Webhook Push] File changes detected', {
      added: addedFiles.size,
      modified: modifiedFiles.size,
      removed: removedFiles.size
    });

    // Update files in knowledge graph
    const result = await this.kagService.updateFilesFromPush({
      addedFiles: Array.from(addedFiles),
      modifiedFiles: Array.from(modifiedFiles),
      removedFiles: Array.from(removedFiles),
      ref
    });

    return {
      success: true,
      event: 'push',
      updated: result.updated || 0,
      added: result.added || 0,
      removed: result.removed || 0
    };
  }

  /**
   * Handle pull_request event - update PR entity
   * @param {Object} payload - Pull request event payload
   * @returns {Promise<Object>} Processing result
   */
  async handlePullRequestEvent(payload) {
    const { action, pull_request, repository } = payload;

    logger.info('[Webhook PR] Processing pull request event', {
      action,
      prNumber: pull_request.number,
      prTitle: pull_request.title
    });

    // Only process certain actions
    const relevantActions = ['opened', 'edited', 'closed', 'reopened', 'synchronize'];
    if (!relevantActions.includes(action)) {
      return { success: true, ignored: true, reason: `action ${action} not relevant` };
    }

    // Update PR entity in knowledge graph
    const result = await this.kagService.updatePullRequest({
      number: pull_request.number,
      title: pull_request.title,
      body: pull_request.body || '',
      state: pull_request.state,
      merged: pull_request.merged_at !== null,
      url: pull_request.html_url,
      created_at: pull_request.created_at,
      updated_at: pull_request.updated_at,
      merged_at: pull_request.merged_at,
      closed_at: pull_request.closed_at,
      author: pull_request.user.login,
      base_branch: pull_request.base.ref,
      head_branch: pull_request.head.ref
    });

    return {
      success: true,
      event: 'pull_request',
      action,
      prNumber: pull_request.number,
      updated: result.updated || false
    };
  }

  /**
   * Handle issues event - update issue entity
   * @param {Object} payload - Issues event payload
   * @returns {Promise<Object>} Processing result
   */
  async handleIssuesEvent(payload) {
    const { action, issue, repository } = payload;

    logger.info('[Webhook Issues] Processing issues event', {
      action,
      issueNumber: issue.number,
      issueTitle: issue.title
    });

    // Only process certain actions
    const relevantActions = ['opened', 'edited', 'closed', 'reopened', 'labeled', 'unlabeled'];
    if (!relevantActions.includes(action)) {
      return { success: true, ignored: true, reason: `action ${action} not relevant` };
    }

    // Update issue entity in knowledge graph
    const result = await this.kagService.updateIssue({
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      state: issue.state,
      url: issue.html_url,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      closed_at: issue.closed_at,
      author: issue.user.login,
      labels: issue.labels.map(l => l.name)
    });

    return {
      success: true,
      event: 'issues',
      action,
      issueNumber: issue.number,
      updated: result.updated || false
    };
  }

  /**
   * Handle issue_comment event - update issue with new comment
   * @param {Object} payload - Issue comment event payload
   * @returns {Promise<Object>} Processing result
   */
  async handleIssueCommentEvent(payload) {
    const { action, issue, comment, repository } = payload;

    logger.info('[Webhook IssueComment] Processing issue comment event', {
      action,
      issueNumber: issue.number,
      commentId: comment.id
    });

    // Only process certain actions
    const relevantActions = ['created', 'edited'];
    if (!relevantActions.includes(action)) {
      return { success: true, ignored: true, reason: `action ${action} not relevant` };
    }

    // Update issue entity with comment information
    // Comments are added to observations
    const result = await this.kagService.updateIssueWithComment({
      issueNumber: issue.number,
      comment: {
        id: comment.id,
        body: comment.body,
        author: comment.user.login,
        created_at: comment.created_at,
        updated_at: comment.updated_at
      }
    });

    return {
      success: true,
      event: 'issue_comment',
      action,
      issueNumber: issue.number,
      commentId: comment.id,
      updated: result.updated || false
    };
  }

  /**
   * Get webhook statistics
   * @returns {Promise<Object>} Webhook stats
   */
  async getStats() {
    const queueStats = await this.webhookQueue.getStats();

    return {
      webhookSecret: this.webhookSecret ? 'configured' : 'not configured',
      queue: queueStats
    };
  }
}

// Singleton instance
let webhookServiceInstance = null;

export function getWebhookService() {
  if (!webhookServiceInstance) {
    webhookServiceInstance = new WebhookService();
  }
  return webhookServiceInstance;
}

export default WebhookService;
