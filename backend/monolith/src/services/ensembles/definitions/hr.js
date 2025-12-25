/**
 * HR Ensemble Definition
 *
 * Pre-configured set of agents for Human Resources departments.
 * Automates resume screening, interview scheduling, and employee onboarding.
 *
 * Issue #3114 - Phase 2: Ensemble Deployment
 *
 * Agents included:
 * 1. Resume Screener - AI-powered resume analysis and candidate ranking
 * 2. Interview Scheduler - Automated interview coordination
 * 3. Onboarding Assistant - New employee onboarding automation
 */

const hrEnsemble = {
  id: 'hr',
  name: 'HR Automation Solution',
  description: 'Streamline your hiring process: resume screening, interview scheduling, and employee onboarding automation',
  icon: '👥',
  category: 'hr',
  estimatedSetupTime: '5-10 minutes',

  /**
   * Agents in the ensemble
   */
  agents: [
    {
      agentId: 'resume-screener',
      order: 1,
      instanceName: 'AI Resume Screener',
      config: {
        screeningCriteria: {
          education: true,
          experience: true,
          skills: true,
          keywords: true,
          certifications: true
        },
        aiScoring: {
          enabled: true,
          model: 'deepseek-chat',
          weights: {
            relevance: 0.4,
            experience: 0.3,
            skills: 0.2,
            education: 0.1
          }
        },
        biasReduction: {
          enabled: true,
          anonymizeNames: false,
          focusOnSkills: true
        },
        parseFormats: ['pdf', 'docx', 'txt', 'rtf'],
        autoRanking: true,
        notifyOnMatch: true
      },
      autoStart: true
    },
    {
      agentId: 'interview-scheduler',
      order: 2,
      instanceName: 'Interview Scheduler',
      config: {
        interviewTypes: [
          { name: 'Phone Screening', duration: 30 },
          { name: 'Technical Interview', duration: 60 },
          { name: 'Behavioral Interview', duration: 45 },
          { name: 'Final Interview', duration: 60 },
          { name: 'Panel Interview', duration: 90 }
        ],
        calendarIntegration: ['google-calendar', 'outlook', 'icalendar'],
        bufferTime: 15, // minutes between interviews
        workingHours: {
          timezone: 'UTC',
          schedule: {
            monday: { start: '09:00', end: '17:00' },
            tuesday: { start: '09:00', end: '17:00' },
            wednesday: { start: '09:00', end: '17:00' },
            thursday: { start: '09:00', end: '17:00' },
            friday: { start: '09:00', end: '17:00' }
          }
        },
        autoReminders: {
          enabled: true,
          reminderTimes: [24, 1] // hours before interview
        },
        videoConferencing: {
          enabled: true,
          providers: ['zoom', 'google-meet', 'teams']
        },
        reschedulingAllowed: true,
        feedbackCollection: true
      },
      autoStart: true
    },
    {
      agentId: 'onboarding-assistant',
      order: 3,
      instanceName: 'Onboarding Assistant',
      config: {
        onboardingWorkflow: {
          steps: [
            'welcome-email',
            'document-collection',
            'equipment-request',
            'account-setup',
            'training-schedule',
            'team-introduction',
            'first-week-checklist'
          ]
        },
        requiredDocuments: [
          'ID verification',
          'Tax forms',
          'Bank details',
          'Emergency contacts',
          'Signed contracts',
          'NDA/IP agreements'
        ],
        accountProvisioning: {
          enabled: true,
          systems: ['email', 'slack', 'jira', 'github', 'vpn']
        },
        trainingModules: {
          enabled: true,
          required: ['company-culture', 'security-basics', 'tools-overview'],
          optional: ['advanced-tools', 'leadership-training']
        },
        mentorAssignment: true,
        progressTracking: true,
        checkInSchedule: [1, 7, 30, 90] // days after start
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
      title: 'Define job requirements',
      description: 'Create job descriptions and screening criteria',
      action: 'configure',
      targetAgent: 'resume-screener',
      optional: false
    },
    {
      step: 2,
      title: 'Connect your ATS',
      description: 'Link your Applicant Tracking System (Greenhouse, Lever, etc.)',
      action: 'integration',
      targetAgent: 'resume-screener',
      optional: true
    },
    {
      step: 3,
      title: 'Set up interviewer calendars',
      description: 'Connect calendars for automatic scheduling',
      action: 'integration',
      targetAgent: 'interview-scheduler',
      optional: false
    },
    {
      step: 4,
      title: 'Configure onboarding workflow',
      description: 'Customize the new employee onboarding process',
      action: 'configure',
      targetAgent: 'onboarding-assistant',
      optional: false
    },
    {
      step: 5,
      title: 'Test the hiring pipeline',
      description: 'Run a test candidate through the entire process',
      action: 'review',
      optional: true
    }
  ],

  /**
   * Features
   */
  features: [
    'AI-powered resume parsing and screening',
    'Automatic candidate ranking',
    'Bias reduction in hiring',
    'Automated interview scheduling',
    'Calendar integration (Google, Outlook)',
    'Video conferencing setup',
    'Interview reminders and follow-ups',
    'Employee onboarding workflows',
    'Document collection and verification',
    'Account provisioning automation',
    'Training module assignment',
    'Progress tracking and check-ins'
  ],

  /**
   * Use cases
   */
  useCases: [
    'Corporate HR departments',
    'Recruitment agencies',
    'Startups and scale-ups',
    'Remote-first companies',
    'High-volume hiring organizations',
    'Consulting firms',
    'Tech companies'
  ],

  /**
   * Benefits
   */
  benefits: {
    timeSavings: '75-85% reduction in administrative tasks',
    costSavings: 'Replace 1-2 HR coordinators',
    timeToHire: '40% faster hiring process',
    candidateExperience: 'Improved candidate satisfaction and engagement',
    compliance: 'Better documentation and compliance tracking'
  }
}

export default hrEnsemble
