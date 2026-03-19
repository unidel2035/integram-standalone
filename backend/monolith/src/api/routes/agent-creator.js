// agent-creator.js - Agent Creator Agent routes
// Issue #2631: Create agent for creating agents

import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../utils/logger.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get monolith root (go up from backend/monolith/src/api/routes/)
const MONOLITH_ROOT = path.resolve(__dirname, '../../../');
const SYSTEM_PROMPT_PATH = path.join(MONOLITH_ROOT, 'docs/AGENT_CREATION_SYSTEM_PROMPT.md');

// Get project root for git operations (go up 2 more levels from monolith root)
const PROJECT_ROOT = path.resolve(MONOLITH_ROOT, '../../');

export function createAgentCreatorRoutes() {
  const router = express.Router();

  /**
   * Generate agent ID from name
   */
  function generateAgentId(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Select appropriate emoji based on category and keywords
   */
  function selectEmoji(category, name, description) {
    const text = `${name} ${description}`.toLowerCase();

    // Category-based emojis
    const categoryEmojis = {
      ai: ['🤖', '🧠', '🔮', '✨', '🎯'],
      analytics: ['📊', '📈', '📉', '🔍', '📋'],
      automation: ['⚙️', '🔧', '⚡', '🔄', '🎛️'],
      business: ['💼', '💰', '📈', '🏢', '💵'],
      web: ['🌐', '🕷️', '🔗', '🌍', '📡'],
      drones: ['🚁', '✈️', '🛸', '📡', '🗺️'],
      communication: ['💬', '📹', '📞', '📨', '🔔'],
      education: ['🎓', '📚', '📖', '🧑‍🎓', '✏️'],
      development: ['💻', '🔧', '🛠️', '⚙️', '🐙']
    };

    // Keyword-based emojis
    if (text.includes('video') || text.includes('видео')) return '📹';
    if (text.includes('chat') || text.includes('чат')) return '💬';
    if (text.includes('mail') || text.includes('почта')) return '📧';
    if (text.includes('security') || text.includes('безопасность')) return '🔐';
    if (text.includes('database') || text.includes('база данных')) return '🗄️';
    if (text.includes('test') || text.includes('тест')) return '🧪';
    if (text.includes('monitor') || text.includes('мониторинг')) return '🔍';
    if (text.includes('payment') || text.includes('платеж')) return '💳';
    if (text.includes('report') || text.includes('отчет')) return '📊';
    if (text.includes('search') || text.includes('поиск')) return '🔎';

    // Default to category emoji
    const emojis = categoryEmojis[category] || ['🤖'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  }

  /**
   * Read system prompt template
   */
  async function getSystemPrompt() {
    try {
      const content = await fs.readFile(SYSTEM_PROMPT_PATH, 'utf-8');
      logger.info(`System prompt loaded successfully from: ${SYSTEM_PROMPT_PATH}`);
      return content;
    } catch (error) {
      logger.error(`Failed to read system prompt from ${SYSTEM_PROMPT_PATH}:`, error);
      throw new Error(`System prompt template not found at ${SYSTEM_PROMPT_PATH}. Error: ${error.message}`);
    }
  }

  /**
   * Create GitHub issue for new agent
   */
  async function createGitHubIssue(agentData) {
    const { name, description, category, functionalRequirements, technicalRequirements, successMetrics } = agentData;

    const systemPrompt = await getSystemPrompt();

    // Build issue body
    const issueBody = `## Agent Purpose
${description}

## User Story
As a DronDoc user, I want ${name.toLowerCase()} so that ${description.toLowerCase()}.

## Functional Requirements
${functionalRequirements.map((req, idx) => `${idx + 1}. ${req}`).join('\n')}

## Technical Requirements
${Object.entries(technicalRequirements).map(([key, value]) => `- **${key}**: ${value}`).join('\n')}

## Acceptance Criteria
- [ ] Agent performs core functionality
- [ ] Tests passing (70%+ coverage)
- [ ] Documentation complete
- [ ] Deployed and accessible
- [ ] Visible on /spaces page
- [ ] Route registered and documented

## Success Metrics
${successMetrics.map((metric) => `- ${metric.name}: ${metric.target}`).join('\n')}

---

${systemPrompt}
`;

    // Create GitHub issue using gh CLI
    const issueTitle = `Create Agent: ${name}`;
    const labels = ['agent-creation', 'enhancement', 'needs-testing', category];

    try {
      // Write issue body to temp file to avoid shell escaping issues
      const tempFile = path.join('/tmp', `issue-body-${Date.now()}.md`);
      await fs.writeFile(tempFile, issueBody, 'utf-8');

      try {
        // Create issue using body-file flag
        const { stdout } = await execAsync(
          `gh issue create --repo unidel2035/dronedoc2025 --title "${issueTitle}" --body-file "${tempFile}" --label "${labels.join(',')}"`,
          { cwd: PROJECT_ROOT }
        );

        // Extract issue number from output
        const issueMatch = stdout.match(/#(\d+)/);
        const issueNumber = issueMatch ? issueMatch[1] : null;

        logger.info(`Created GitHub issue #${issueNumber} for agent: ${name}`);

        // Clean up temp file
        await fs.unlink(tempFile).catch(() => {});

        return {
          issueNumber,
          issueUrl: `https://github.com/unidel2035/dronedoc2025/issues/${issueNumber}`,
          title: issueTitle
        };
      } catch (error) {
        // Clean up temp file on error
        await fs.unlink(tempFile).catch(() => {});
        throw error;
      }
    } catch (error) {
      logger.error('Failed to create GitHub issue:', error);
      throw new Error(`Failed to create GitHub issue: ${error.message}`);
    }
  }

  /**
   * Trigger solve command for the created issue
   */
  async function triggerSolveCommand(issueNumber) {
    try {
      logger.info(`Triggering solve command for issue #${issueNumber}`);

      const issueUrl = `https://github.com/unidel2035/dronedoc2025/issues/${issueNumber}`;

      // Make HTTP request to local solve API
      const fetch = (await import('node-fetch')).default;
      const response = await fetch('http://localhost:3000/api/solve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          issueUrl,
          options: [],
          userId: 'agent-creator',
          userInfo: 'Agent Creator System'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to trigger solve command');
      }

      const result = await response.json();

      logger.info(`Solve command triggered successfully for issue #${issueNumber}`, result);

      return {
        triggered: true,
        sessionId: result.sessionId,
        status: result.status,
        message: `Solve command started for issue #${issueNumber}`,
        note: result.note
      };
    } catch (error) {
      logger.error('Failed to trigger solve command:', error);
      // Don't throw error - just log it and return failure status
      // We still want the agent creation to succeed even if solve fails
      return {
        triggered: false,
        error: error.message,
        message: `Solve command could not be triggered: ${error.message}`
      };
    }
  }

  /**
   * POST /api/agent-creator/create
   * Create a new agent
   */
  router.post('/create', async (req, res, next) => {
    try {
      const {
        name,
        description,
        category,
        aiPrompt,
        functionalRequirements = [],
        technicalRequirements = {},
        successMetrics = []
      } = req.body;

      // Validation
      if (!name || !description || !category) {
        return res.status(400).json({
          success: false,
          error: 'Name, description, and category are required'
        });
      }

      // Generate agent metadata
      const agentId = generateAgentId(name);
      const icon = selectEmoji(category, name, description);

      // Prepare agent data
      const agentData = {
        id: agentId,
        name,
        description,
        icon,
        category,
        functionalRequirements: functionalRequirements.length > 0
          ? functionalRequirements
          : [
            'Collect and process relevant data',
            'Perform core agent functionality',
            'Provide user-friendly interface',
            'Integrate with DronDoc ecosystem'
          ],
        technicalRequirements: Object.keys(technicalRequirements).length > 0
          ? technicalRequirements
          : {
            'Backend': 'API endpoints in backend/monolith/',
            'Frontend': 'Vue 3 components with PrimeVue',
            'AI Integration': aiPrompt ? 'Yes, using DronDoc tokens and DeepSeek' : 'No',
            'Data Storage': 'DronDoc API or local files',
            'Testing': 'Unit, integration, and E2E tests (70%+ coverage)'
          },
        successMetrics: successMetrics.length > 0
          ? successMetrics
          : [
            { name: 'User Adoption', target: '100+ users in first month' },
            { name: 'Response Time', target: '< 200ms (95th percentile)' },
            { name: 'Error Rate', target: '< 1%' },
            { name: 'Test Coverage', target: '> 70%' }
          ]
      };

      // Create GitHub issue
      const issue = await createGitHubIssue(agentData);

      // Trigger solve command
      const solveResult = await triggerSolveCommand(issue.issueNumber);

      res.status(201).json({
        success: true,
        agent: {
          id: agentId,
          name,
          description,
          icon,
          category
        },
        issue: {
          number: issue.issueNumber,
          url: issue.issueUrl,
          title: issue.title
        },
        solve: solveResult,
        message: `Agent creation issue #${issue.issueNumber} created and solve command triggered`
      });
    } catch (error) {
      logger.error('Agent creation failed:', error);
      // Return proper error response
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create agent',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  /**
   * POST /api/agent-creator/create-with-ai
   * Create a new agent using AI to generate requirements
   */
  router.post('/create-with-ai', async (req, res, next) => {
    try {
      const { name, description, category, aiPrompt } = req.body;

      if (!name || !aiPrompt) {
        return res.status(400).json({
          success: false,
          error: 'Name and AI prompt are required'
        });
      }

      // TODO: In production, use AI to generate functional requirements,
      // technical requirements, and success metrics from the aiPrompt
      // For now, use default values

      // Call the regular create endpoint internally
      const agentData = {
        name,
        description: description || aiPrompt.slice(0, 150),
        category: category || 'ai',
        aiPrompt,
        functionalRequirements: [
          'Implement core functionality as described',
          'Integrate AI capabilities using DronDoc tokens',
          'Provide intuitive user interface',
          'Ensure proper error handling and logging'
        ],
        technicalRequirements: {
          'Backend': 'API endpoints in backend/monolith/',
          'Frontend': 'Vue 3 components with PrimeVue',
          'AI Integration': 'Yes, using TokenBasedLLMCoordinator with DeepSeek',
          'Data Storage': 'DronDoc API or local files',
          'Testing': 'Comprehensive test suite (70%+ coverage)'
        },
        successMetrics: [
          { name: 'AI Response Accuracy', target: '> 90%' },
          { name: 'User Satisfaction', target: '> 4.5/5.0' },
          { name: 'Response Time', target: '< 2 seconds' },
          { name: 'Test Coverage', target: '> 70%' }
        ]
      };

      const agentId = generateAgentId(name);
      const icon = selectEmoji(agentData.category, name, aiPrompt);

      agentData.id = agentId;
      agentData.icon = icon;

      // Create GitHub issue
      const issue = await createGitHubIssue(agentData);

      // Trigger solve command
      const solveResult = await triggerSolveCommand(issue.issueNumber);

      res.status(201).json({
        success: true,
        agent: {
          id: agentId,
          name,
          description: agentData.description,
          icon,
          category: agentData.category
        },
        issue: {
          number: issue.issueNumber,
          url: issue.issueUrl,
          title: issue.title
        },
        solve: solveResult,
        message: `AI-powered agent creation issue #${issue.issueNumber} created and solve command triggered`
      });
    } catch (error) {
      logger.error('AI-powered agent creation failed:', error);
      // Return proper error response
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create AI-powered agent',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  /**
   * GET /api/agent-creator/categories
   * Get available agent categories
   */
  router.get('/categories', (req, res) => {
    const categories = [
      { label: '🤖 ИИ и ML', value: 'ai' },
      { label: '📊 Аналитика', value: 'analytics' },
      { label: '🚁 Дроны и IoT', value: 'drones' },
      { label: '⚙️ Автоматизация', value: 'automation' },
      { label: '📝 Обработка текста', value: 'text' },
      { label: '🌐 Веб-инструменты', value: 'web' },
      { label: '💼 Бизнес', value: 'business' },
      { label: '👥 HR', value: 'hr' },
      { label: '🎨 Дизайн', value: 'design' },
      { label: '💰 Продажи', value: 'sales' },
      { label: '💬 Коммуникация', value: 'communication' },
      { label: '🎓 Образование', value: 'education' },
      { label: '🛠️ Разработка', value: 'development' }
    ];

    res.json({
      success: true,
      categories
    });
  });

  /**
   * GET /api/agent-creator/template
   * Get agent creation template
   */
  router.get('/template', async (req, res, next) => {
    try {
      const systemPrompt = await getSystemPrompt();

      res.json({
        success: true,
        template: {
          systemPrompt,
          defaultFunctionalRequirements: [
            'Collect and process relevant data',
            'Perform core agent functionality',
            'Provide user-friendly interface',
            'Integrate with DronDoc ecosystem'
          ],
          defaultTechnicalRequirements: {
            'Backend': 'API endpoints in backend/monolith/',
            'Frontend': 'Vue 3 components with PrimeVue',
            'AI Integration': 'If needed, use DronDoc tokens and DeepSeek',
            'Data Storage': 'DronDoc API or local files',
            'Testing': 'Unit, integration, and E2E tests (70%+ coverage)'
          },
          defaultSuccessMetrics: [
            { name: 'User Adoption', target: '100+ users in first month' },
            { name: 'Response Time', target: '< 200ms (95th percentile)' },
            { name: 'Error Rate', target: '< 1%' },
            { name: 'Test Coverage', target: '> 70%' }
          ]
        }
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
