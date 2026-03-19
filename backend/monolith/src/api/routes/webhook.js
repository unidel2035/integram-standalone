// webhook.js - GitHub webhook endpoint for auto-deployment
import express from 'express';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../../utils/logger.js';

const execAsync = promisify(exec);

export function createWebhookRoutes() {
  const router = express.Router();

  /**
   * Verify GitHub webhook signature
   */
  function verifyGitHubSignature(payload, signature, secret) {
    if (!signature) return false;

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  }

  /**
   * GitHub webhook endpoint
   * POST /api/webhook/github
   */
  router.post('/github', async (req, res) => {
    try {
      const signature = req.headers['x-hub-signature-256'];
      const event = req.headers['x-github-event'];
      const secret = process.env.GITHUB_WEBHOOK_SECRET;

      // Get raw body for signature verification
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      // Verify signature if secret is configured
      if (secret && signature) {
        const isValid = verifyGitHubSignature(rawBody, signature, secret);
        if (!isValid) {
          logger.warn('GitHub webhook: Invalid signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      // Parse payload
      const payload = typeof req.body === 'object' ? req.body : JSON.parse(rawBody);

      // Log webhook event
      logger.info({
        event,
        ref: payload.ref,
        pusher: payload.pusher?.name,
        commits: payload.commits?.length
      }, 'GitHub webhook received');

      // Only deploy on push to dev branch
      if (event === 'push' && payload.ref === 'refs/heads/dev') {
        logger.info('Push to dev branch detected, starting deployment...');

        // Respond immediately to GitHub
        res.status(200).json({
          success: true,
          message: 'Deployment initiated'
        });

        // Run deployment in background
        deployInBackground();
      } else {
        logger.info(`Ignoring webhook: event=${event}, ref=${payload.ref}`);
        res.status(200).json({
          success: true,
          message: 'Event ignored'
        });
      }

    } catch (error) {
      logger.error({ error: error.message }, 'GitHub webhook error');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Deploy in background
   */
  async function deployInBackground() {
    try {
      logger.info('Starting deployment process...');

      // Execute deployment script
      const scriptPath = '/home/hive/dronedoc2025/deploy-local.sh';
      const { stdout, stderr } = await execAsync(`bash ${scriptPath}`, {
        timeout: 300000 // 5 minutes timeout
      });

      logger.info({ stdout, stderr }, 'Deployment completed');
    } catch (error) {
      logger.error({ error: error.message }, 'Deployment failed');
    }
  }

  /**
   * Health check endpoint
   * GET /api/webhook/health
   */
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      message: 'Webhook endpoint is healthy',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
