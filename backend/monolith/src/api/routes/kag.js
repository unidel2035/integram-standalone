/**
 * KAG (Knowledge Augmented Generation) API Routes
 *
 * Provides endpoints for the project knowledge base:
 * - Repository indexing
 * - Knowledge graph queries
 * - RAG-based question answering
 * - Statistics and management
 *
 * Issue #5005
 */

import express from 'express';
import logger from '../../utils/logger.js';
import { getKAGService } from '../../services/kag/KAGService.js';

/**
 * Lazy initialization middleware
 * Ensures KAG service is initialized only when routes are accessed
 */
async function ensureKAGInitialized(req, res, next) {
  try {
    const kagService = getKAGService();
    await kagService.initialize();
    req.kagService = kagService;
    next();
  } catch (error) {
    logger.error('Failed to initialize KAG service', {
      error: error.message,
      stack: error.stack,
      code: error.code
    });

    // Provide helpful error messages based on error type
    let userMessage = error.message;
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      userMessage = `Missing dependency: ${error.message}. Please run 'npm install' in backend/monolith directory.`;
    } else if (error.message.includes('ENOENT')) {
      userMessage = `File or directory not found: ${error.message}. Check KAG data directory configuration.`;
    } else if (error.message.includes('API key')) {
      userMessage = `API configuration error: ${error.message}. Check DEEPSEEK_API_KEY, OPENAI_API_KEY, or POLZA_AI_API_KEY environment variable.`;
    }

    res.status(503).json({
      success: false,
      error: 'KAG service initialization failed',
      message: userMessage,
      details: process.env.NODE_ENV === 'development' ? {
        originalError: error.message,
        code: error.code,
        stack: error.stack
      } : undefined
    });
  }
}

/**
 * Create KAG routes
 */
export function createKAGRoutes() {
  const router = express.Router();

  /**
   * GET /api/kag/health
   * Health check endpoint (doesn't require initialization)
   *
   * Response:
   * {
   *   success: boolean
   *   status: 'healthy' | 'unhealthy'
   *   checks: {
   *     dependencies: boolean
   *     config: boolean
   *     initialization: boolean
   *   }
   *   message?: string
   * }
   */
  router.get('/health', async (req, res) => {
    const checks = {
      dependencies: false,
      config: false,
      initialization: false
    };
    const issues = [];

    try {
      // Check 1: Dependencies
      try {
        await import('@octokit/rest');
        checks.dependencies = true;
      } catch (error) {
        issues.push(`Missing dependency: ${error.message}`);
      }

      // Check 2: Configuration (Issue #5097: Added POLZA_AI_API_KEY support)
      const hasApiKey = !!(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.POLZA_AI_API_KEY);
      const hasGithubToken = !!process.env.GITHUB_TOKEN;
      checks.config = hasApiKey; // GitHub token is optional
      if (!hasApiKey) {
        issues.push('No AI API key configured (DEEPSEEK_API_KEY, OPENAI_API_KEY, or POLZA_AI_API_KEY)');
      }
      if (!hasGithubToken) {
        issues.push('No GitHub token configured (GITHUB_TOKEN) - API rate limits will apply');
      }

      // Check 3: Initialization
      try {
        console.log('[KAG Health] Getting KAG service...');
        const kagService = getKAGService();
        console.log('[KAG Health] Calling initialize...');
        await kagService.initialize();
        console.log('[KAG Health] Initialize completed successfully');
        checks.initialization = true;
      } catch (error) {
        console.log('[KAG Health] Initialize FAILED:', error.message);
        console.log('[KAG Health] Error stack:', error.stack);
        issues.push(`Initialization failed: ${error.message}`);
      }

      const allHealthy = Object.values(checks).every(check => check);

      res.json({
        success: allHealthy,
        status: allHealthy ? 'healthy' : 'unhealthy',
        checks,
        issues: issues.length > 0 ? issues : undefined,
        message: allHealthy
          ? 'KAG service is operational'
          : 'KAG service has issues. See "issues" array for details.',
        debug: {
          timestamp: new Date().toISOString(),
          codeVersion: 'v5097-test-1'
        }
      });
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        checks,
        message: 'Health check encountered an error',
        error: error.message
      });
    }
  });

  // Apply lazy initialization middleware to all other routes
  router.use(ensureKAGInitialized);

  /**
   * POST /api/kag/index
   * Start repository indexing
   *
   * Request body:
   * {
   *   includeIssues?: boolean (default: true)
   *   includePRs?: boolean (default: true)
   *   includeCode?: boolean (default: true)
   *   includeDocs?: boolean (default: true)
   *   maxIssues?: number (default: 100)
   *   maxPRs?: number (default: 100)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   results: {
   *     issues: number
   *     prs: number
   *     files: number
   *     entities: number
   *     relations: number
   *     errors: Array<string>
   *   }
   * }
   */
  router.post('/index', async (req, res) => {
    const kagService = req.kagService;
    try {
      logger.info('Starting KAG indexing', { options: req.body });

      const results = await kagService.indexRepository(req.body);

      res.json({
        success: true,
        results
      });
    } catch (error) {
      logger.error('KAG indexing failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to index repository',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/search
   * Search the knowledge base
   *
   * Request body:
   * {
   *   query: string - Search query
   *   limit?: number (default: 10)
   *   entityTypes?: Array<string> - Filter by entity types
   *   minScore?: number (default: 0.3)
   *   mode?: 'hybrid' | 'keyword' | 'semantic' (default: 'hybrid')
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   results: Array<{
   *     entity: Object
   *     score: number
   *     id: string
   *     sources?: Array<'keyword' | 'semantic'> (in hybrid mode)
   *   }>
   *   mode: string
   * }
   */
  router.post('/search', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { query, ...options } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Query is required and must be a string'
        });
      }

      // Validate mode if provided
      const mode = options.mode || 'hybrid';
      if (!['hybrid', 'keyword', 'semantic'].includes(mode)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid search mode. Must be one of: hybrid, keyword, semantic'
        });
      }

      logger.info('KAG search', { query, mode, options });

      const results = await kagService.search(query, { ...options, mode });

      res.json({
        success: true,
        results,
        mode
      });
    } catch (error) {
      logger.error('KAG search failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/entity/:entityId
   * Get entity by ID
   *
   * Response:
   * {
   *   success: boolean
   *   entity: Object | null
   *   relations: Array<Object>
   * }
   */
  router.get('/entity/:entityId', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { entityId } = req.params;

      const entity = kagService.getEntity(entityId);

      if (!entity) {
        return res.status(404).json({
          success: false,
          error: 'Entity not found'
        });
      }

      const relations = kagService.getRelations(entityId);

      res.json({
        success: true,
        entity,
        relations
      });
    } catch (error) {
      logger.error('Failed to get entity', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get entity',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/filter-options
   * Get available filter options (authors, labels, states)
   *
   * Response:
   * {
   *   success: boolean
   *   options: {
   *     authors: Array<string>
   *     labels: Array<string>
   *     states: Array<string>
   *   }
   * }
   */
  router.get('/filter-options', async (req, res) => {
    try {
      await kagService.initialize();

      const options = kagService.getFilterOptions();

      res.json({
        success: true,
        options
      });
    } catch (error) {
      logger.error('Failed to get filter options', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get filter options',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/stats
   * Get knowledge graph statistics
   *
   * Response:
   * {
   *   success: boolean
   *   stats: {
   *     totalEntities: number
   *     totalRelations: number
   *     entityTypes: Object
   *     relationTypes: Object
   *   }
   * }
   */
  router.get('/stats', async (req, res) => {
    const kagService = req.kagService;
    logger.info('[KAG ROUTE] /stats endpoint called');
    try {
      const stats = kagService.getStats();
      logger.info('[KAG ROUTE] Got stats', { stats });

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('[KAG ROUTE] Error', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/export/mcp
   * Export knowledge graph to MCP Memory format
   *
   * Response:
   * {
   *   success: boolean
   *   data: {
   *     entities: Array
   *     relations: Array
   *   }
   * }
   */
  router.post('/export/mcp', async (req, res) => {
    const kagService = req.kagService;
    try {
      const data = kagService.exportToMCPMemory();

      res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error('Failed to export to MCP', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to export',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/embeddings/generate
   * Generate embeddings for all entities
   *
   * Response:
   * {
   *   success: boolean
   *   count: number - Number of embeddings generated
   * }
   */
  router.post('/embeddings/generate', async (req, res) => {
    const kagService = req.kagService;
    try {
      logger.info('Generating embeddings for all entities');

      const count = await kagService.generateAllEmbeddings();

      res.json({
        success: true,
        count
      });
    } catch (error) {
      logger.error('Failed to generate embeddings', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to generate embeddings',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/embeddings/stats
   * Get embedding and vector store statistics
   *
   * Response:
   * {
   *   success: boolean
   *   stats: {
   *     vectorStore: Object
   *     embeddingCache: Object
   *   }
   * }
   */
  router.get('/embeddings/stats', async (req, res) => {
    const kagService = req.kagService;
    try {
      const vectorStoreStats = await kagService.vectorStore.getStats();
      const cacheStats = kagService.embeddingService.getCacheStats();

      res.json({
        success: true,
        stats: {
          vectorStore: vectorStoreStats,
          embeddingCache: cacheStats
        }
      });
    } catch (error) {
      logger.error('Failed to get embedding stats', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
        message: error.message
      });
    }
  });

  /**
   * DELETE /api/kag/embeddings/clear
   * Clear embedding cache and vector store
   *
   * Response:
   * {
   *   success: boolean
   *   message: string
   * }
   */
  router.delete('/embeddings/clear', async (req, res) => {
    const kagService = req.kagService;
    try {
      logger.info('Clearing embeddings and vector store');

      await kagService.embeddingService.clearCache();
      await kagService.vectorStore.clear();

      res.json({
        success: true,
        message: 'Embeddings and vector store cleared successfully'
      });
    } catch (error) {
      logger.error('Failed to clear embeddings', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to clear embeddings',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/answer
   * RAG-based question answering
   *
   * Request body:
   * {
   *   question: string - The question to answer
   *   accessToken: string - AI access token
   *   modelId: string - AI model ID
   *   maxSources?: number (default: 5) - Max number of sources to retrieve
   *   minScore?: number (default: 0.3) - Minimum relevance score
   *   temperature?: number (default: 0.2) - LLM temperature
   *   maxTokens?: number (default: 2000) - Max tokens in response
   *   conversationHistory?: Array<{role, content}> - Previous messages
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   answer: string
   *   sources: Array<{id, type, name, score, url}>
   *   usage: Object - Token usage stats
   *   metadata: Object - RAG metadata
   * }
   */
  router.post('/answer', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { question, accessToken, modelId, ...options } = req.body;

      if (!question || typeof question !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Question is required and must be a string'
        });
      }

      if (!accessToken || !modelId) {
        return res.status(400).json({
          success: false,
          error: 'Access token and model ID are required'
        });
      }

      logger.info('KAG RAG answer request', { question, modelId, options });

      // Get LLM coordinator
      const { getTokenBasedLLMCoordinator } = await import('../../core/TokenBasedLLMCoordinator.js');
      const llmCoordinator = getTokenBasedLLMCoordinator();

      // Call RAG pipeline
      const result = await kagService.answerQuestion(question, {
        llmCoordinator,
        accessToken,
        modelId,
        ...options
      });

      res.json(result);
    } catch (error) {
      logger.error('KAG RAG answer failed', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: 'Failed to answer question',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/history/file/:filePath
   * Get commit history for a specific file
   *
   * Response:
   * {
   *   success: boolean
   *   history: Array<{
   *     commit: Object
   *     date: string
   *     author: string
   *     message: string
   *     changes: Object
   *   }>
   * }
   */
  router.get('/history/file/*', async (req, res) => {
    const kagService = req.kagService;
    try {
      // Extract file path from wildcard parameter
      const filePath = req.params[0];

      if (!filePath) {
        return res.status(400).json({
          success: false,
          error: 'File path is required'
        });
      }

      const history = kagService.getFileHistory(filePath);

      res.json({
        success: true,
        filePath,
        history
      });
    } catch (error) {
      logger.error('Failed to get file history', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get file history',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/history/modifier/:entityId
   * Get last modifier for an entity
   *
   * Response:
   * {
   *   success: boolean
   *   modifier: Object | null
   * }
   */
  router.get('/history/modifier/:entityId', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { entityId } = req.params;

      const modifier = kagService.getLastModifier(entityId);

      if (!modifier) {
        return res.status(404).json({
          success: false,
          error: 'No modification history found'
        });
      }

      res.json({
        success: true,
        entityId,
        modifier
      });
    } catch (error) {
      logger.error('Failed to get last modifier', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get last modifier',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/history/changes
   * Get file changes with filters
   *
   * Request body:
   * {
   *   filePath: string
   *   since?: string (ISO date)
   *   until?: string (ISO date)
   *   author?: string
   *   limit?: number
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   changes: Array
   * }
   */
  router.post('/history/changes', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { filePath, ...options } = req.body;

      if (!filePath) {
        return res.status(400).json({
          success: false,
          error: 'File path is required'
        });
      }

      const changes = kagService.getFileChanges(filePath, options);

      res.json({
        success: true,
        filePath,
        options,
        changes
      });
    } catch (error) {
      logger.error('Failed to get file changes', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get file changes',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/history/issue/:issueNumber
   * Get commits that fixed/referenced an issue
   *
   * Response:
   * {
   *   success: boolean
   *   commits: Array
   * }
   */
  router.get('/history/issue/:issueNumber', async (req, res) => {
    const kagService = req.kagService;
    try {
      const issueNumber = parseInt(req.params.issueNumber);

      if (isNaN(issueNumber)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid issue number'
        });
      }

      const commits = kagService.getCommitsForIssue(issueNumber);

      res.json({
        success: true,
        issueNumber,
        commits
      });
    } catch (error) {
      logger.error('Failed to get commits for issue', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get commits for issue',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/history/feature/:keyword
   * Track feature development history by keyword
   *
   * Response:
   * {
   *   success: boolean
   *   commits: Array
   * }
   */
  router.get('/history/feature/:keyword', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { keyword } = req.params;

      if (!keyword) {
        return res.status(400).json({
          success: false,
          error: 'Keyword is required'
        });
      }

      const commits = kagService.getFeatureDevelopmentHistory(keyword);

      res.json({
        success: true,
        keyword,
        commits
      });
    } catch (error) {
      logger.error('Failed to get feature development history', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get feature development history',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/history/user/:userIdentifier
   * Get commit statistics for a user
   *
   * Response:
   * {
   *   success: boolean
   *   stats: Object
   * }
   */
  router.get('/history/user/:userIdentifier', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { userIdentifier } = req.params;

      if (!userIdentifier) {
        return res.status(400).json({
          success: false,
          error: 'User identifier is required'
        });
      }

      const stats = kagService.getUserCommitStats(userIdentifier);

      res.json({
        success: true,
        userIdentifier,
        stats
      });
    } catch (error) {
      logger.error('Failed to get user commit stats', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get user commit stats',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/webhook
   * GitHub webhook endpoint for auto-indexing
   *
   * Headers:
   * - X-GitHub-Event: Event type (push, pull_request, issues, issue_comment)
   * - X-Hub-Signature-256: HMAC SHA-256 signature
   * - X-GitHub-Delivery: Delivery ID
   *
   * Response:
   * {
   *   success: boolean
   *   queued?: boolean
   *   jobId?: string
   *   event?: string
   * }
   */
  router.post('/webhook', async (req, res) => {
    try {
      // Import webhook service
      const { getWebhookService } = await import('../../services/kag/WebhookService.js');
      const webhookService = getWebhookService();

      // Get GitHub headers
      const event = req.headers['x-github-event'];
      const signature = req.headers['x-hub-signature-256'];
      const deliveryId = req.headers['x-github-delivery'];

      if (!event) {
        return res.status(400).json({
          success: false,
          error: 'Missing X-GitHub-Event header'
        });
      }

      // Verify webhook signature
      const payload = JSON.stringify(req.body);
      const isValid = webhookService.verifySignature(payload, signature);

      if (!isValid) {
        logger.warn('[KAG Webhook] Invalid signature', { event, deliveryId });
        return res.status(401).json({
          success: false,
          error: 'Invalid webhook signature'
        });
      }

      // Handle webhook
      const result = await webhookService.handleWebhook(event, req.body, deliveryId);

      res.json(result);
    } catch (error) {
      logger.error('[KAG Webhook] Webhook handling failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Webhook processing failed',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/webhook/stats
   * Get webhook processing statistics
   *
   * Response:
   * {
   *   success: boolean
   *   stats: Object
   * }
   */
  router.get('/webhook/stats', async (req, res) => {
    try {
      const { getWebhookService } = await import('../../services/kag/WebhookService.js');
      const webhookService = getWebhookService();

      const stats = await webhookService.getStats();

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('[KAG Webhook] Failed to get webhook stats', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/webhook/retry/:jobId
   * Retry a failed webhook job
   *
   * Response:
   * {
   *   success: boolean
   *   jobId: string
   * }
   */
  router.post('/webhook/retry/:jobId', async (req, res) => {
    try {
      const { getWebhookQueue } = await import('../../services/kag/WebhookQueue.js');
      const webhookQueue = getWebhookQueue();

      const { jobId } = req.params;
      await webhookQueue.retryJob(jobId);

      res.json({
        success: true,
        jobId,
        message: 'Job retry queued'
      });
    } catch (error) {
      logger.error('[KAG Webhook] Failed to retry job', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retry job',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/export/json
   * Export knowledge graph to JSON format
   *
   * Query parameters:
   * - includeMetadata: boolean (default: true)
   * - includeEmbeddings: boolean (default: false)
   *
   * Response: JSON file download
   */
  router.get('/export/json', async (req, res) => {
    try {
      await kagService.initialize();

      const options = {
        includeMetadata: req.query.includeMetadata !== 'false',
        includeEmbeddings: req.query.includeEmbeddings === 'true'
      };

      const data = kagService.exportToJSON(options);

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="kag-export-${Date.now()}.json"`);

      res.json(data);
    } catch (error) {
      logger.error('[KAG Export] JSON export failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to export to JSON',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/export/csv
   * Export knowledge graph to CSV format (entities and relations)
   *
   * Response: ZIP file with entities.csv and relations.csv
   */
  router.get('/export/csv', async (req, res) => {
    try {
      await kagService.initialize();

      const data = kagService.exportToCSV();

      // Return as JSON with both CSV files
      // Frontend can download them separately or create a ZIP
      res.json({
        success: true,
        data: {
          entities: data.entities,
          relations: data.relations,
          metadata: data.metadata
        }
      });
    } catch (error) {
      logger.error('[KAG Export] CSV export failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to export to CSV',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/export/graphml
   * Export knowledge graph to GraphML format
   *
   * Response: GraphML XML file download
   */
  router.get('/export/graphml', async (req, res) => {
    try {
      await kagService.initialize();

      const graphml = kagService.exportToGraphML();

      // Set headers for file download
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename="kag-export-${Date.now()}.graphml"`);

      res.send(graphml);
    } catch (error) {
      logger.error('[KAG Export] GraphML export failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to export to GraphML',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/import/json
   * Import knowledge graph from JSON format
   *
   * Request body:
   * {
   *   data: Object - JSON data to import
   *   mode?: 'merge' | 'replace' (default: 'merge')
   *   validate?: boolean (default: true)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   stats: Object - Import statistics
   *   metadata?: Object - Original metadata
   * }
   */
  router.post('/import/json', async (req, res) => {
    try {
      const { data, mode = 'merge', validate = true } = req.body;

      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Data is required'
        });
      }

      logger.info('[KAG Import] Starting JSON import', { mode, validate });

      const result = await kagService.importFromJSON(data, { mode, validate });

      res.json(result);
    } catch (error) {
      logger.error('[KAG Import] JSON import failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to import from JSON',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/import/csv
   * Import knowledge graph from CSV format
   *
   * Request body:
   * {
   *   entities: string - Entities CSV content
   *   relations: string - Relations CSV content
   *   mode?: 'merge' | 'replace' (default: 'merge')
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   stats: Object - Import statistics
   * }
   */
  router.post('/import/csv', async (req, res) => {
    try {
      const { entities, relations, mode = 'merge' } = req.body;

      if (!entities && !relations) {
        return res.status(400).json({
          success: false,
          error: 'At least one of entities or relations CSV is required'
        });
      }

      logger.info('[KAG Import] Starting CSV import', { mode });

      const result = await kagService.importFromCSV({ entities, relations }, { mode });

      res.json(result);
    } catch (error) {
      logger.error('[KAG Import] CSV import failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to import from CSV',
        message: error.message
      });
    }
  });

  // Test endpoint for VectorStore debugging
  router.get('/test-vector', async (req, res) => {
    try {
      const { getVectorStore } = await import('../../services/kag/VectorStore.js');
      const vs = getVectorStore();
      await vs.initialize();
      const stats = await vs.getStats();
      res.json({
        success: true,
        stats,
        useInMemory: vs.useInMemory,
        initialized: vs.initialized
      });
    } catch (error) {
      res.json({
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  });

  // Health endpoint removed - using detailed health check at line 79 instead

  /**
   * GET /api/kag/versions
   * List all knowledge graph snapshots
   *
   * Response:
   * {
   *   success: boolean
   *   snapshots: Array<{id, timestamp, metadata}>
   *   current: string
   * }
   */
  router.get('/versions', async (req, res) => {
    try {
      await kagService.initialize();

      const snapshots = kagService.versionManager.listSnapshots();
      const current = kagService.versionManager.getCurrentVersion();

      res.json({
        success: true,
        snapshots,
        current
      });
    } catch (error) {
      logger.error('Failed to list versions', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to list versions',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/versions/:snapshotId
   * Get a specific snapshot
   *
   * Response:
   * {
   *   success: boolean
   *   snapshot: Object
   * }
   */
  router.get('/versions/:snapshotId', async (req, res) => {
    try {
      await kagService.initialize();

      const { snapshotId } = req.params;
      const snapshot = await kagService.versionManager.getSnapshot(snapshotId);

      if (!snapshot) {
        return res.status(404).json({
          success: false,
          error: 'Snapshot not found'
        });
      }

      res.json({
        success: true,
        snapshot
      });
    } catch (error) {
      logger.error('Failed to get snapshot', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get snapshot',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/versions/diff
   * Compute diff between two snapshots
   *
   * Request body:
   * {
   *   from: string - Source snapshot ID
   *   to: string - Target snapshot ID
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   diff: Object
   * }
   */
  router.post('/versions/diff', async (req, res) => {
    try {
      await kagService.initialize();

      const { from, to } = req.body;

      if (!from || !to) {
        return res.status(400).json({
          success: false,
          error: 'Both "from" and "to" snapshot IDs are required'
        });
      }

      const diff = await kagService.versionManager.computeDiff(from, to);

      res.json({
        success: true,
        diff
      });
    } catch (error) {
      logger.error('Failed to compute diff', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to compute diff',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/versions/:snapshotId/rollback
   * Rollback knowledge graph to a specific snapshot
   *
   * Request body:
   * {
   *   selective?: boolean (default: false)
   *   entityTypes?: Array<string> (required if selective=true)
   *   keepOther?: boolean (default: true, only with selective=true)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   snapshotId: string
   *   restoredData: Object
   * }
   */
  router.post('/versions/:snapshotId/rollback', async (req, res) => {
    try {
      await kagService.initialize();

      const { snapshotId } = req.params;
      const { selective = false, entityTypes = [], keepOther = true } = req.body;

      let restoredData;

      if (selective) {
        if (!entityTypes || entityTypes.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'entityTypes array is required for selective rollback'
          });
        }

        restoredData = await kagService.versionManager.selectiveRollback(
          snapshotId,
          { entityTypes, keepOther }
        );
      } else {
        restoredData = await kagService.versionManager.rollback(snapshotId);
      }

      // Apply restored data to current KG
      kagService.entities.clear();
      for (const entity of restoredData.entities) {
        kagService.entities.set(entity.id, entity);
      }

      kagService.relations.clear();
      for (const relation of restoredData.relations) {
        kagService.relations.set(relation.id, relation);
      }

      // Save the restored state
      await kagService.saveKnowledgeGraph();

      res.json({
        success: true,
        snapshotId,
        restoredData: {
          entitiesCount: restoredData.entities.length,
          relationsCount: restoredData.relations.length
        }
      });
    } catch (error) {
      logger.error('Failed to rollback', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to rollback',
        message: error.message
      });
    }
  });

  /**
   * DELETE /api/kag/versions/:snapshotId
   * Delete a specific snapshot
   *
   * Response:
   * {
   *   success: boolean
   *   snapshotId: string
   * }
   */
  router.delete('/versions/:snapshotId', async (req, res) => {
    try {
      await kagService.initialize();

      const { snapshotId } = req.params;
      await kagService.versionManager.deleteSnapshot(snapshotId);

      res.json({
        success: true,
        snapshotId
      });
    } catch (error) {
      logger.error('Failed to delete snapshot', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to delete snapshot',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/versions/create
   * Manually create a snapshot
   *
   * Request body:
   * {
   *   metadata?: Object - Additional metadata
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   snapshot: Object
   * }
   */
  router.post('/versions/create', async (req, res) => {
    try {
      await kagService.initialize();

      const { metadata = {} } = req.body;

      const data = {
        entities: Array.from(kagService.entities.values()),
        relations: Array.from(kagService.relations.values())
      };

      const snapshot = await kagService.versionManager.createSnapshot(data, {
        ...metadata,
        source: 'manual',
        stats: kagService.getStats()
      });

      res.json({
        success: true,
        snapshot
      });
    } catch (error) {
      logger.error('Failed to create snapshot', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to create snapshot',
        message: error.message
      });
    }
  });

  return router;
}
