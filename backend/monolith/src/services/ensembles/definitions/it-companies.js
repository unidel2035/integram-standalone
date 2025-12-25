/**
 * IT Companies Ensemble Definition
 *
 * Pre-configured set of agents for IT service companies and software development teams.
 * Helps automate client support, requirements gathering, project management, and QA testing.
 *
 * Issue #3114 - Phase 2: Ensemble Deployment
 *
 * Agents included:
 * 1. Support Agent - Customer support automation
 * 2. Requirements Collector - Gather and analyze client requirements
 * 3. Project Manager - Project tracking and management
 * 4. QA Tester - Automated testing and bug tracking
 */

const itCompaniesEnsemble = {
  id: 'it-companies',
  name: 'IT Companies Solution',
  description: 'Complete automation suite for IT service companies: customer support, requirements analysis, project management, and QA testing',
  icon: '💻',
  category: 'it',
  estimatedSetupTime: '5-10 minutes',

  /**
   * Agents in the ensemble
   * - agentId: ID from agent registry
   * - order: Deployment order (lower first)
   * - instanceName: Custom name for this instance (optional)
   * - config: Initial configuration for the agent
   * - autoStart: Whether to start the agent immediately after deployment
   */
  agents: [
    {
      agentId: 'support-agent',
      order: 1,
      instanceName: 'IT Support Agent',
      config: {
        responseMode: 'automatic',
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          start: '09:00',
          end: '18:00',
          weekdays: [1, 2, 3, 4, 5] // Monday to Friday
        },
        aiModel: 'deepseek-chat',
        language: 'en'
      },
      autoStart: true
    },
    {
      agentId: 'requirements-collector',
      order: 2,
      instanceName: 'Requirements Collector',
      config: {
        formTemplates: ['technical-spec', 'feature-request', 'project-brief'],
        aiAnalysis: true,
        exportFormats: ['pdf', 'docx', 'markdown'],
        notifyOnSubmit: true
      },
      autoStart: true
    },
    {
      agentId: 'project-manager',
      order: 3,
      instanceName: 'Project Manager Agent',
      config: {
        boardType: 'kanban',
        defaultColumns: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'],
        reminderSettings: {
          enabled: true,
          deadlineWarning: 24 // hours before deadline
        },
        integrationsEnabled: ['jira', 'trello']
      },
      autoStart: true
    },
    {
      agentId: 'qa-tester',
      order: 4,
      instanceName: 'QA Tester Agent',
      config: {
        testFrameworks: ['selenium', 'playwright'],
        regressionSchedule: 'daily',
        bugTrackerIntegration: true,
        reportFormat: 'html'
      },
      autoStart: true
    }
  ],

  /**
   * Onboarding steps shown to user after deployment
   */
  onboardingSteps: [
    {
      step: 1,
      title: 'Connect your ticketing system',
      description: 'Link your existing ticketing system (Jira, GitHub Issues, etc.) to sync support requests',
      action: 'integration',
      targetAgent: 'support-agent',
      optional: false
    },
    {
      step: 2,
      title: 'Set up requirements forms',
      description: 'Customize forms for gathering requirements from clients',
      action: 'configure',
      targetAgent: 'requirements-collector',
      optional: true
    },
    {
      step: 3,
      title: 'Import existing projects',
      description: 'Import projects from Jira, Trello, or upload a CSV',
      action: 'import',
      targetAgent: 'project-manager',
      optional: true
    },
    {
      step: 4,
      title: 'Configure test environments',
      description: 'Set up testing environments and test suites',
      action: 'configure',
      targetAgent: 'qa-tester',
      optional: true
    },
    {
      step: 5,
      title: 'Review and activate',
      description: 'Review all configurations and activate the ensemble',
      action: 'review',
      optional: false
    }
  ],

  /**
   * Features provided by this ensemble
   */
  features: [
    '24/7 automated customer support',
    'AI-powered requirements analysis',
    'Project and task management',
    'Automated testing and QA',
    'Bug tracking and reporting',
    'Integration with popular tools (Jira, Trello, GitHub)',
    'Customizable workflows',
    'Real-time notifications and reminders'
  ],

  /**
   * Use cases for this ensemble
   */
  useCases: [
    'Software development companies',
    'IT service providers',
    'Digital agencies',
    'SaaS product teams',
    'Freelance development teams',
    'Startups building MVPs'
  ],

  /**
   * Estimated ROI and benefits
   */
  benefits: {
    timeSavings: '60-80% reduction in manual work',
    costSavings: 'Replace 2-3 full-time employees',
    responseTime: '10x faster client response time',
    quality: 'Consistent quality and fewer bugs'
  }
}

export default itCompaniesEnsemble
