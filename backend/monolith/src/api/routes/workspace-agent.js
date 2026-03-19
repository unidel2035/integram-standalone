/**
 * Workspace Agent API
 *
 * Provides autonomous agent capabilities for workspace code analysis,
 * suggestions, and automated fixes.
 *
 * Features:
 * - Analyze workspace files for bugs, security issues, improvements
 * - Generate suggestions with fix proposals
 * - Apply suggested fixes
 * - Track agent activity and statistics
 *
 * Architecture:
 * WorkspaceAgentPanel.vue → /api/workspace-agent → Kodacode API → WorkspaceService
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import logger from '../../utils/logger.js';
import workspaceService from '../../services/WorkspaceService.js';
import tokenConsumptionLogger from '../../services/ai/tokenConsumptionLogger.js';
import { fileWatcherService } from '../../services/FileWatcherService.js';

// Kodacode API configuration
const KODACODE_API_URL = 'https://api.kodacode.ru/v1/chat/completions';

/**
 * Get GitHub token for Kodacode API
 */
function getGithubToken() {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    logger.warn('GITHUB_TOKEN not found for workspace agent (required for Kodacode API)');
    return null;
  }
  return token;
}

/**
 * Call Kodacode API (OpenAI-compatible)
 */
async function callKodacodeAPI(messages, options = {}) {
  const token = getGithubToken();
  if (!token) {
    throw new Error('GITHUB_TOKEN not configured');
  }

  const {
    model = 'gemini-2.5-flash', // Default: large context window, free
    maxTokens = 4096,
    temperature = 0.2
  } = options;

  const response = await fetch(KODACODE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kodacode API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: {
      input_tokens: data.usage?.prompt_tokens || 0,
      output_tokens: data.usage?.completion_tokens || 0
    }
  };
}

/**
 * Create Workspace Agent routes
 */
export function createWorkspaceAgentRoutes() {
  const router = express.Router();

  // Kodacode models (free via GITHUB_TOKEN)
  const DEFAULT_MODEL = 'gemini-2.5-flash'; // 986K context, free

  // Store for active analysis sessions (in-memory for now)
  // In production, this should be moved to Redis or similar
  const analysisSessionStore = new Map();

  /**
   * POST /api/workspace-agent/analyze
   * Start analysis of workspace files
   */
  router.post('/analyze', async (req, res) => {
    try {
      const {
        workspaceId,
        userId,
        agentId,
        files, // Optional: specific files to analyze
        analysisType = 'full' // 'full', 'quick', 'security', 'performance'
      } = req.body;

      if (!workspaceId || !userId) {
        return res.status(400).json({
          success: false,
          error: 'workspaceId and userId are required'
        });
      }

      // Verify workspace exists and user has access
      const workspace = await workspaceService.getWorkspace(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          error: 'Workspace not found'
        });
      }

      // Get files to analyze
      let filesToAnalyze;
      if (files && files.length > 0) {
        filesToAnalyze = files;
      } else {
        // Get all source files from workspace
        const allFiles = await workspaceService.listFiles(workspaceId);
        // Filter to only include source code files
        const sourceExtensions = ['.js', '.ts', '.vue', '.jsx', '.tsx', '.py', '.java', '.go', '.rs'];
        filesToAnalyze = allFiles.filter(f => {
          const ext = f.name?.split('.').pop()?.toLowerCase();
          return ext && sourceExtensions.includes(`.${ext}`);
        }).slice(0, 20); // Limit to 20 files for performance
      }

      logger.info({
        workspaceId,
        userId,
        agentId,
        fileCount: filesToAnalyze.length,
        analysisType
      }, 'Starting workspace analysis');

      // Create analysis session
      const sessionId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      analysisSessionStore.set(sessionId, {
        workspaceId,
        userId,
        agentId,
        status: 'running',
        startedAt: new Date().toISOString(),
        filesTotal: filesToAnalyze.length,
        filesAnalyzed: 0,
        suggestions: []
      });

      // Return immediately with session ID
      // Analysis will continue in background
      res.json({
        success: true,
        sessionId,
        message: 'Analysis started',
        filesTotal: filesToAnalyze.length
      });

      // Start background analysis (non-blocking)
      analyzeFilesInBackground(sessionId, workspaceId, filesToAnalyze, analysisType).catch(error => {
        logger.error({ error: error.message, sessionId }, 'Background analysis failed');
        const session = analysisSessionStore.get(sessionId);
        if (session) {
          session.status = 'error';
          session.error = error.message;
        }
      });

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to start workspace analysis');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/workspace-agent/analysis/:sessionId
   * Get analysis session status and results
   */
  router.get('/analysis/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;

      const session = analysisSessionStore.get(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Analysis session not found'
        });
      }

      res.json({
        success: true,
        session: {
          sessionId,
          status: session.status,
          startedAt: session.startedAt,
          completedAt: session.completedAt,
          filesTotal: session.filesTotal,
          filesAnalyzed: session.filesAnalyzed,
          suggestions: session.suggestions,
          error: session.error
        }
      });

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get analysis status');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/workspace-agent/apply-fix
   * Apply a suggested fix to a file
   */
  router.post('/apply-fix', async (req, res) => {
    try {
      const {
        workspaceId,
        userId,
        suggestionId,
        fix
      } = req.body;

      if (!workspaceId || !userId || !fix) {
        return res.status(400).json({
          success: false,
          error: 'workspaceId, userId, and fix are required'
        });
      }

      // Verify workspace exists
      const workspace = await workspaceService.getWorkspace(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          error: 'Workspace not found'
        });
      }

      let result;

      switch (fix.type) {
        case 'replace-line':
          result = await workspaceService.editFile(workspaceId, fix.file, {
            lineNumber: fix.line,
            newContent: fix.newContent
          });
          break;

        case 'delete-line':
          result = await workspaceService.editFile(workspaceId, fix.file, {
            lineNumber: fix.line,
            delete: true
          });
          break;

        case 'insert-line':
          result = await workspaceService.editFile(workspaceId, fix.file, {
            lineNumber: fix.line,
            insertContent: fix.newContent
          });
          break;

        case 'replace-content':
          result = await workspaceService.writeFile(workspaceId, fix.file, fix.newContent);
          break;

        default:
          return res.status(400).json({
            success: false,
            error: `Unknown fix type: ${fix.type}`
          });
      }

      logger.info({
        workspaceId,
        userId,
        suggestionId,
        fixType: fix.type,
        file: fix.file
      }, 'Applied fix from workspace agent');

      res.json({
        success: true,
        message: 'Fix applied successfully',
        result
      });

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to apply fix');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/workspace-agent/analyze-file
   * Analyze a single file and return suggestions
   */
  router.post('/analyze-file', async (req, res) => {
    try {
      const {
        workspaceId,
        userId,
        filePath,
        analysisType = 'full'
      } = req.body;

      if (!workspaceId || !userId || !filePath) {
        return res.status(400).json({
          success: false,
          error: 'workspaceId, userId, and filePath are required'
        });
      }

      // Check if Kodacode API is available
      if (!getGithubToken()) {
        return res.status(500).json({
          success: false,
          error: 'AI service unavailable (GITHUB_TOKEN not configured)'
        });
      }

      // Read file content
      const fileContent = await workspaceService.readFile(workspaceId, filePath);
      if (!fileContent) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      // Analyze with Kodacode API
      const systemPrompt = getAnalysisPrompt(analysisType);

      const response = await callKodacodeAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this file and provide suggestions:\n\nFile: ${filePath}\n\n\`\`\`\n${fileContent}\n\`\`\`` }
      ], {
        model: DEFAULT_MODEL,
        maxTokens: 4096
      });

      // Log token usage
      await tokenConsumptionLogger.logConsumption({
        userId,
        model: DEFAULT_MODEL,
        provider: 'kodacode',
        promptTokens: response.usage?.input_tokens || 0,
        completionTokens: response.usage?.output_tokens || 0,
        application: 'workspace-agent',
        operation: 'analyze-file'
      });

      // Parse response into suggestions
      const suggestions = parseAnalysisResponse(response.content || '', filePath);

      logger.info({
        workspaceId,
        userId,
        filePath,
        suggestionsCount: suggestions.length
      }, 'File analysis completed');

      res.json({
        success: true,
        file: filePath,
        suggestions
      });

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to analyze file');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Background analysis function
   */
  async function analyzeFilesInBackground(sessionId, workspaceId, files, analysisType) {
    const session = analysisSessionStore.get(sessionId);
    if (!session) return;

    if (!getGithubToken()) {
      session.status = 'error';
      session.error = 'AI service unavailable (GITHUB_TOKEN not configured)';
      return;
    }

    const systemPrompt = getAnalysisPrompt(analysisType);

    for (const file of files) {
      try {
        // Read file content
        const content = await workspaceService.readFile(workspaceId, file.path || file.name);
        if (!content) {
          session.filesAnalyzed++;
          continue;
        }

        // Skip large files (Kodacode/Gemini has 986K context, but let's be reasonable)
        if (content.length > 100000) {
          logger.debug({ file: file.path || file.name }, 'Skipping large file');
          session.filesAnalyzed++;
          continue;
        }

        // Analyze with Kodacode API
        const response = await callKodacodeAPI([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this file:\n\nFile: ${file.path || file.name}\n\n\`\`\`\n${content.substring(0, 50000)}\n\`\`\`` }
        ], {
          model: DEFAULT_MODEL,
          maxTokens: 2048
        });

        // Parse and add suggestions
        const fileSuggestions = parseAnalysisResponse(
          response.content || '',
          file.path || file.name
        );

        session.suggestions.push(...fileSuggestions);
        session.filesAnalyzed++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        logger.error({ error: error.message, file: file.path || file.name }, 'Failed to analyze file');
        session.filesAnalyzed++;
      }
    }

    session.status = 'completed';
    session.completedAt = new Date().toISOString();

    logger.info({
      sessionId,
      filesAnalyzed: session.filesAnalyzed,
      suggestionsCount: session.suggestions.length
    }, 'Background analysis completed');
  }

  /**
   * Get analysis prompt based on type
   */
  function getAnalysisPrompt(analysisType) {
    const basePrompt = `You are an expert code analyst. Analyze the provided code and identify issues.

For each issue found, respond in this JSON format:
{
  "suggestions": [
    {
      "type": "error|security|warning|improvement|refactor|performance",
      "title": "Short title of the issue",
      "description": "Detailed explanation",
      "line": 42,
      "code": "problematic code snippet",
      "fix": {
        "type": "replace-line|delete-line|insert-line",
        "line": 42,
        "newContent": "fixed code"
      }
    }
  ]
}

If no issues found, return: { "suggestions": [] }

Only return valid JSON, no markdown or explanations.`;

    const typeSpecificPrompts = {
      full: basePrompt,
      quick: basePrompt + '\n\nFocus only on critical bugs and security issues. Limit to 5 suggestions.',

      // Security Scanner Agent
      security: basePrompt + `

Focus EXCLUSIVELY on security vulnerabilities. Check for:

**Injection Attacks:**
- SQL injection (string concatenation in queries, unsanitized input)
- XSS (innerHTML, dangerouslySetInnerHTML, unescaped output)
- Command injection (exec, spawn with user input)
- SSRF (user-controlled URLs in fetch/axios)
- Path traversal (../ in file paths)
- Template injection (user input in templates)

**Authentication & Authorization:**
- Hardcoded credentials, API keys, secrets
- Weak password validation
- Missing authentication checks
- Broken access control (IDOR)
- JWT issues (no expiry, weak secret, alg=none)

**Data Exposure:**
- Sensitive data in logs
- PII in URLs/query params
- Missing encryption
- Insecure cookies (no httpOnly, secure flags)

**Dependencies:**
- Known vulnerable packages
- Outdated dependencies with CVEs

Use severity: 'security' for all findings. Priority: 1-3 based on exploitability.`,

      // Performance Optimizer Agent
      performance: basePrompt + `

Focus EXCLUSIVELY on performance issues. Check for:

**Database & Queries:**
- N+1 query patterns (loops with DB calls)
- Missing indexes (queries without WHERE optimization)
- SELECT * instead of specific columns
- Unbounded queries (no LIMIT)
- Synchronous DB calls that could be batched

**Memory Issues:**
- Memory leaks (unreleased event listeners, timers, closures)
- Large arrays/objects in memory
- Circular references
- Missing cleanup in useEffect/componentWillUnmount

**Algorithm Complexity:**
- O(n²) or worse algorithms that could be O(n) or O(log n)
- Nested loops over large datasets
- Inefficient string concatenation in loops
- Repeated expensive calculations (missing memoization)

**Frontend Performance:**
- Unnecessary re-renders (missing React.memo, useMemo, useCallback)
- Large bundle imports (import entire library vs specific functions)
- Blocking renders (heavy computation in render)
- Missing lazy loading for routes/components
- Large images without optimization

**Network:**
- Redundant API calls
- Missing request caching/deduplication
- Large payloads without pagination

Use type: 'performance' for all findings.`,

      // Code Review Agent
      'code-review': basePrompt + `

Focus on code quality and best practices. Check for:

**Code Style & Naming:**
- Inconsistent naming conventions (camelCase, snake_case mixing)
- Unclear variable/function names
- Magic numbers without constants
- Single-letter variable names (except loop counters)

**Code Smells:**
- Functions longer than 30 lines
- Too many parameters (>4)
- Deep nesting (>3 levels)
- Duplicated code blocks
- Dead code (unused functions, unreachable code)
- TODO/FIXME/HACK comments left in code

**Architecture:**
- God objects/functions (doing too much)
- Tight coupling between modules
- Missing error handling
- Inconsistent error handling patterns
- Direct DOM manipulation in React/Vue
- Business logic in UI components

**Best Practices:**
- Missing TypeScript types (using 'any')
- Console.log left in production code
- Commented-out code
- Missing input validation
- Hardcoded values that should be config
- Synchronous code that should be async

**Documentation:**
- Missing JSDoc for public APIs
- Outdated comments
- Complex logic without explanation

Use type: 'improvement' or 'refactor' for findings.`
    };

    return typeSpecificPrompts[analysisType] || typeSpecificPrompts.full;
  }

  /**
   * Parse analysis response into suggestions array
   */
  function parseAnalysisResponse(responseText, filePath) {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(responseText);
      if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        return parsed.suggestions.map(s => ({
          ...s,
          file: filePath,
          id: `sug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }));
      }
      return [];
    } catch (error) {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
            return parsed.suggestions.map(s => ({
              ...s,
              file: filePath,
              id: `sug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            }));
          }
        } catch (e) {
          // Ignore parse error
        }
      }

      logger.debug({ responseText: responseText.substring(0, 200) }, 'Could not parse analysis response');
      return [];
    }
  }

  // ==================== Agent State Persistence ====================

  const STATES_DIR = path.join(process.cwd(), 'data', 'agent-states');

  // Ensure directory exists
  if (!fs.existsSync(STATES_DIR)) {
    fs.mkdirSync(STATES_DIR, { recursive: true });
  }

  function getStateFilePath(userId) {
    return path.join(STATES_DIR, `${userId}.json`);
  }

  /**
   * POST /api/workspace-agent/state/save
   * Save agent state to file
   */
  router.post('/state/save', async (req, res) => {
    try {
      const { userId, agentState } = req.body;

      if (!userId || !agentState) {
        return res.status(400).json({
          success: false,
          error: 'userId and agentState are required'
        });
      }

      const data = {
        state: agentState,
        updatedAt: new Date().toISOString()
      };

      fs.writeFileSync(getStateFilePath(userId), JSON.stringify(data, null, 2));

      logger.info({ userId, agentsCount: Object.keys(agentState.agents || {}).length },
        'Agent state saved to file');

      res.json({
        success: true,
        message: 'Agent state saved'
      });

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to save agent state');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/workspace-agent/state/:userId
   * Load agent state from file
   */
  router.get('/state/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const filePath = getStateFilePath(userId);

      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        logger.info({ userId }, 'Agent state loaded from file');
        return res.json({
          success: true,
          state: data.state,
          updatedAt: data.updatedAt
        });
      }

      res.json({
        success: true,
        state: null,
        message: 'No saved state found'
      });

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to load agent state');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/workspace-agent/state/:userId
   * Clear agent state
   */
  router.delete('/state/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const filePath = getStateFilePath(userId);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      logger.info({ userId }, 'Agent state cleared');

      res.json({
        success: true,
        message: 'Agent state cleared'
      });

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to clear agent state');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ============================================
  // File Watcher Endpoints
  // ============================================

  /**
   * POST /api/workspace-agent/watch/start
   * Start watching a workspace for file changes
   */
  router.post('/watch/start', async (req, res) => {
    try {
      const { workspaceId, userId } = req.body;

      if (!workspaceId || !userId) {
        return res.status(400).json({
          success: false,
          error: 'workspaceId and userId are required'
        });
      }

      // Get workspace path
      const workspace = await workspaceService.getWorkspace(workspaceId, userId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          error: 'Workspace not found'
        });
      }

      const workspacePath = workspace.path || path.join(
        process.cwd(),
        'workspaces',
        userId,
        workspaceId
      );

      // Check if path exists
      if (!fs.existsSync(workspacePath)) {
        return res.status(404).json({
          success: false,
          error: `Workspace path does not exist: ${workspacePath}`
        });
      }

      // Start watching
      const result = await fileWatcherService.startWatching(workspaceId, workspacePath);

      logger.info({ workspaceId, workspacePath }, 'File watcher started');

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to start file watcher');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/workspace-agent/watch/stop
   * Stop watching a workspace
   */
  router.post('/watch/stop', async (req, res) => {
    try {
      const { workspaceId } = req.body;

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          error: 'workspaceId is required'
        });
      }

      const result = await fileWatcherService.stopWatching(workspaceId);

      logger.info({ workspaceId }, 'File watcher stopped');

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to stop file watcher');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/workspace-agent/watch/history/:workspaceId
   * Get file change history for a workspace
   */
  router.get('/watch/history/:workspaceId', async (req, res) => {
    try {
      const { workspaceId } = req.params;
      const limit = parseInt(req.query.limit) || 50;

      const history = fileWatcherService.getHistory(workspaceId, limit);

      res.json({
        success: true,
        data: {
          workspaceId,
          changes: history,
          count: history.length
        }
      });

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get watch history');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/workspace-agent/watch/status
   * Get status of all file watchers
   */
  router.get('/watch/status', async (req, res) => {
    try {
      const status = fileWatcherService.getStatus();

      res.json({
        success: true,
        data: {
          watchers: status,
          count: status.length
        }
      });

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get watch status');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/workspace-agent/watch/history/:workspaceId
   * Clear file change history for a workspace
   */
  router.delete('/watch/history/:workspaceId', async (req, res) => {
    try {
      const { workspaceId } = req.params;

      fileWatcherService.clearHistory(workspaceId);

      res.json({
        success: true,
        message: 'History cleared'
      });

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to clear watch history');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

export default createWorkspaceAgentRoutes;
