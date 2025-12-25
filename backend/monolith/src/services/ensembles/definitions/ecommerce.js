/**
 * E-commerce Ensemble Definition
 *
 * Pre-configured set of agents for online stores and e-commerce businesses.
 * Automates order processing, appointment booking, returns handling, and dynamic pricing.
 *
 * Issue #3114 - Phase 2: Ensemble Deployment
 *
 * Agents included:
 * 1. Order Processor - Automated order handling and fulfillment
 * 2. Appointment Booking - Schedule appointments and service bookings
 * 3. Returns Handler - Process returns, refunds, and exchanges
 * 4. Price Calculator - Dynamic pricing and discount management
 */

const ecommerceEnsemble = {
  id: 'ecommerce',
  name: 'E-commerce Solution',
  description: 'Complete automation for online stores: order processing, bookings, returns handling, and smart pricing',
  icon: '🛒',
  category: 'ecommerce',
  estimatedSetupTime: '5-10 minutes',

  /**
   * Agents in the ensemble
   */
  agents: [
    {
      agentId: 'order-processor',
      order: 1,
      instanceName: 'Order Processor',
      config: {
        autoConfirmation: true,
        paymentGateways: ['stripe', 'paypal'],
        shippingProviders: ['fedex', 'ups', 'usps'],
        orderStatuses: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
        notificationChannels: ['email', 'sms'],
        inventorySync: true
      },
      autoStart: true
    },
    {
      agentId: 'appointment-booking',
      order: 2,
      instanceName: 'Appointment Booking Agent',
      config: {
        bookingWindow: 30, // days in advance
        slotDuration: 30, // minutes
        bufferTime: 15, // minutes between appointments
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
        reminderSettings: {
          enabled: true,
          before: [24, 2] // hours before appointment
        },
        maxPerDay: 16
      },
      autoStart: true
    },
    {
      agentId: 'returns-handler',
      order: 3,
      instanceName: 'Returns & Refunds Handler',
      config: {
        returnWindow: 30, // days for returns
        autoApproval: {
          enabled: false,
          maxAmount: 50 // auto-approve returns under this amount
        },
        refundMethods: ['original', 'store-credit', 'exchange'],
        reasonCategories: [
          'Defective/Damaged',
          'Wrong Item',
          'Not as Described',
          'Changed Mind',
          'Size/Fit Issue',
          'Other'
        ],
        requirePhotos: true,
        notifyOnStatusChange: true
      },
      autoStart: true
    },
    {
      agentId: 'price-calculator',
      order: 4,
      instanceName: 'Dynamic Price Calculator',
      config: {
        pricingStrategies: [
          'cost-plus',
          'competitive',
          'value-based',
          'dynamic'
        ],
        discountRules: {
          bulk: true,
          seasonal: true,
          loyalty: true,
          promotional: true
        },
        taxCalculation: {
          enabled: true,
          method: 'automatic'
        },
        currencyConversion: true,
        priceRounding: 'nearest-99'
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
      title: 'Connect your store platform',
      description: 'Link your Shopify, WooCommerce, or custom store API',
      action: 'integration',
      targetAgent: 'order-processor',
      optional: false
    },
    {
      step: 2,
      title: 'Configure payment gateways',
      description: 'Set up Stripe, PayPal, or other payment processors',
      action: 'configure',
      targetAgent: 'order-processor',
      optional: false
    },
    {
      step: 3,
      title: 'Set booking availability',
      description: 'Define your service hours and appointment types',
      action: 'configure',
      targetAgent: 'appointment-booking',
      optional: true
    },
    {
      step: 4,
      title: 'Define return policy',
      description: 'Set return windows, conditions, and approval rules',
      action: 'configure',
      targetAgent: 'returns-handler',
      optional: false
    },
    {
      step: 5,
      title: 'Configure pricing rules',
      description: 'Set up discounts, promotions, and pricing strategies',
      action: 'configure',
      targetAgent: 'price-calculator',
      optional: true
    },
    {
      step: 6,
      title: 'Test and go live',
      description: 'Run test orders and activate the automation',
      action: 'review',
      optional: false
    }
  ],

  /**
   * Features
   */
  features: [
    'Automated order processing and fulfillment',
    'Online appointment and service booking',
    'Returns, refunds, and exchange management',
    'Dynamic pricing and discount engine',
    'Multi-currency support',
    'Inventory synchronization',
    'Customer notifications (email, SMS)',
    'Integration with major e-commerce platforms',
    'Payment gateway integration',
    'Shipping provider integration'
  ],

  /**
   * Use cases
   */
  useCases: [
    'Online retail stores',
    'Service-based businesses (salons, consultants, etc.)',
    'Marketplace platforms',
    'Subscription box services',
    'Digital product stores',
    'B2B e-commerce',
    'Multi-vendor platforms'
  ],

  /**
   * Benefits
   */
  benefits: {
    timeSavings: '70-90% reduction in manual order processing',
    costSavings: 'Replace 1-2 customer service staff',
    customerSatisfaction: '40% faster order fulfillment',
    revenueBoost: 'Smart pricing increases margins by 10-15%'
  }
}

export default ecommerceEnsemble
