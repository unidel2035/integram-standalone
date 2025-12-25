/**
 * Telecom Ensemble Definition
 *
 * Pre-configured set of agents for telecommunications companies and ISPs.
 * Automates tariff consultation, connection handling, technical support, and upselling.
 *
 * Issue #3114 - Phase 2: Ensemble Deployment
 *
 * Agents included:
 * 1. Tariff Consultant - Help customers choose optimal plans
 * 2. Connection Handler - Automate service activation and provisioning
 * 3. Tech Support - Troubleshoot technical issues
 * 4. Upsell Agent - Identify upgrade and cross-sell opportunities
 */

const telecomEnsemble = {
  id: 'telecom',
  name: 'Telecom Solution',
  description: 'Complete automation for telecom providers: tariff consulting, service activation, technical support, and intelligent upselling',
  icon: '📡',
  category: 'telecom',
  estimatedSetupTime: '10-15 minutes',

  /**
   * Agents in the ensemble
   */
  agents: [
    {
      agentId: 'tariff-consultant',
      order: 1,
      instanceName: 'Tariff Consultant Agent',
      config: {
        analysisFactors: [
          'usage-patterns',
          'budget',
          'features-needed',
          'family-size',
          'business-requirements'
        ],
        comparisonMode: 'comprehensive',
        recommendationEngine: 'ai-powered',
        includePromotions: true,
        languages: ['en', 'ru'],
        presentationStyle: 'detailed'
      },
      autoStart: true
    },
    {
      agentId: 'connection-handler',
      order: 2,
      instanceName: 'Service Connection Agent',
      config: {
        automatedProvisioning: true,
        serviceTypes: [
          'mobile',
          'broadband',
          'fiber',
          'tv',
          'iot'
        ],
        activationWorkflow: {
          steps: [
            'verify-identity',
            'check-availability',
            'provision-service',
            'activate-account',
            'send-credentials',
            'schedule-installation'
          ]
        },
        installationScheduling: true,
        notificationChannels: ['sms', 'email', 'app-push'],
        qualityCheck: true
      },
      autoStart: true
    },
    {
      agentId: 'tech-support-agent',
      order: 3,
      instanceName: 'Technical Support Agent',
      config: {
        supportChannels: ['chat', 'phone', 'email', 'ticket'],
        troubleshootingMode: 'guided',
        knowledgeBase: {
          enabled: true,
          autoUpdate: true,
          categories: [
            'connectivity',
            'billing',
            'equipment',
            'account',
            'performance'
          ]
        },
        diagnosticTools: {
          speedTest: true,
          connectionCheck: true,
          equipmentStatus: true,
          lineQuality: true
        },
        escalationRules: {
          autoEscalate: true,
          maxAttempts: 3,
          complexityThreshold: 'medium'
        },
        aiAssisted: true
      },
      autoStart: true
    },
    {
      agentId: 'upsell-agent',
      order: 4,
      instanceName: 'Smart Upsell Agent',
      config: {
        triggers: [
          'usage-threshold',
          'service-interaction',
          'plan-review',
          'competitive-offer',
          'seasonal-promotion'
        ],
        personalization: {
          enabled: true,
          usageAnalysis: true,
          preferenceLearning: true
        },
        offerTypes: [
          'upgrade',
          'add-on',
          'bundle',
          'premium-feature',
          'family-plan'
        ],
        timingOptimization: true,
        abTesting: true,
        ethicalSelling: {
          enabled: true,
          maxOffersPerMonth: 2,
          respectOptOut: true
        }
      },
      autoStart: true
    }
  ],

  /**
   * Onboarding steps
   */
  onboardingSteps: [
    {
      step: 1,
      title: 'Import your tariff catalog',
      description: 'Upload your plans, prices, and service offerings',
      action: 'import',
      targetAgent: 'tariff-consultant',
      optional: false
    },
    {
      step: 2,
      title: 'Configure provisioning system',
      description: 'Connect to your OSS/BSS systems for service activation',
      action: 'integration',
      targetAgent: 'connection-handler',
      optional: false
    },
    {
      step: 3,
      title: 'Set up knowledge base',
      description: 'Import FAQs, troubleshooting guides, and technical documentation',
      action: 'import',
      targetAgent: 'tech-support-agent',
      optional: false
    },
    {
      step: 4,
      title: 'Define upsell strategies',
      description: 'Configure upsell triggers, offers, and personalization rules',
      action: 'configure',
      targetAgent: 'upsell-agent',
      optional: true
    },
    {
      step: 5,
      title: 'Connect customer database',
      description: 'Link your CRM and customer database for personalized service',
      action: 'integration',
      targetAgent: 'all',
      optional: false
    },
    {
      step: 6,
      title: 'Test scenarios and go live',
      description: 'Run test scenarios and activate the automation',
      action: 'review',
      optional: false
    }
  ],

  /**
   * Features
   */
  features: [
    'AI-powered tariff recommendations',
    'Automated service provisioning',
    'Intelligent technical support',
    'Smart upselling and cross-selling',
    '24/7 availability',
    'Multi-channel support (chat, phone, email)',
    'Self-service diagnostics',
    'Personalized customer experience',
    'Usage pattern analysis',
    'OSS/BSS system integration',
    'Knowledge base management',
    'Escalation management'
  ],

  /**
   * Use cases
   */
  useCases: [
    'Mobile network operators',
    'Internet service providers (ISPs)',
    'Cable and satellite TV providers',
    'Fiber optic providers',
    'IoT connectivity providers',
    'MVNO (Mobile Virtual Network Operators)',
    'Business telecom services'
  ],

  /**
   * Benefits
   */
  benefits: {
    timeSavings: '80-90% reduction in routine support tasks',
    costSavings: 'Replace 3-5 customer service agents',
    customerSatisfaction: '50% faster issue resolution',
    revenueBoost: 'Upselling increases ARPU by 15-25%',
    churnReduction: '30% decrease in customer churn'
  }
}

export default telecomEnsemble
