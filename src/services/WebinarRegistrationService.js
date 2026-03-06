import { logger } from '@/utils/logger'

/**
 * Webinar Registration Service - Manages webinar registrations and attendee access
 * Issue #2360 - Webinar mode и live streaming
 */

export const REGISTRATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DECLINED: 'declined',
  CANCELLED: 'cancelled'
}

export default class WebinarRegistrationService {
  constructor(webinarId) {
    this.webinarId = webinarId
    this.registrations = new Map() // email -> registration object
    this.approvedEmails = new Set()
    this.blockedEmails = new Set()
    this.eventHandlers = new Map()

    // Webinar settings
    this.settings = {
      requiresApproval: false,
      maxAttendees: null,
      allowGuestRegistration: true,
      requireEmail: true,
      requireName: true,
      requireOrganization: false,
      customFields: []
    }

    logger.debug(`📝 [Registration] Service initialized for webinar ${webinarId}`)
  }

  /**
   * Configure registration settings
   */
  configure(settings) {
    this.settings = { ...this.settings, ...settings }
    logger.debug('📝 [Registration] Settings updated:', this.settings)
    this.emit('registration:settings-updated', this.settings)
  }

  /**
   * Submit registration
   */
  async submitRegistration(registrationData) {
    const { email, name, organization, customData } = registrationData

    // Validate required fields
    if (this.settings.requireEmail && !email) {
      throw new Error('Email is required')
    }

    if (this.settings.requireName && !name) {
      throw new Error('Name is required')
    }

    if (this.settings.requireOrganization && !organization) {
      throw new Error('Organization is required')
    }

    // Check if email is blocked
    if (this.blockedEmails.has(email)) {
      throw new Error('Registration blocked')
    }

    // Check if already registered
    if (this.registrations.has(email)) {
      const existing = this.registrations.get(email)
      if (existing.status === REGISTRATION_STATUS.APPROVED) {
        throw new Error('Already registered')
      }
      // Allow re-submission if previously declined/cancelled
    }

    // Check capacity
    if (this.settings.maxAttendees) {
      const approvedCount = this.getApprovedRegistrationsCount()
      if (approvedCount >= this.settings.maxAttendees) {
        throw new Error('Webinar has reached maximum capacity')
      }
    }

    // Create registration
    const registration = {
      id: this.generateRegistrationId(),
      webinarId: this.webinarId,
      email,
      name,
      organization: organization || null,
      customData: customData || {},
      status: this.settings.requiresApproval ?
        REGISTRATION_STATUS.PENDING :
        REGISTRATION_STATUS.APPROVED,
      registeredAt: new Date().toISOString(),
      approvedAt: null,
      declinedAt: null,
      cancelledAt: null,
      accessToken: this.generateAccessToken(email)
    }

    this.registrations.set(email, registration)

    if (registration.status === REGISTRATION_STATUS.APPROVED) {
      this.approvedEmails.add(email)
      registration.approvedAt = new Date().toISOString()
    }

    logger.debug('📝 [Registration] New registration:', email, registration.status)
    this.emit('registration:submitted', registration)

    // Send confirmation email
    await this.sendConfirmationEmail(registration)

    return registration
  }

  /**
   * Approve pending registration
   */
  async approveRegistration(email) {
    const registration = this.registrations.get(email)
    if (!registration) {
      throw new Error('Registration not found')
    }

    if (registration.status === REGISTRATION_STATUS.APPROVED) {
      throw new Error('Already approved')
    }

    // Check capacity
    if (this.settings.maxAttendees) {
      const approvedCount = this.getApprovedRegistrationsCount()
      if (approvedCount >= this.settings.maxAttendees) {
        throw new Error('Webinar has reached maximum capacity')
      }
    }

    registration.status = REGISTRATION_STATUS.APPROVED
    registration.approvedAt = new Date().toISOString()
    this.approvedEmails.add(email)

    logger.debug('📝 [Registration] Approved:', email)
    this.emit('registration:approved', registration)

    // Send approval email
    await this.sendApprovalEmail(registration)

    return registration
  }

  /**
   * Decline registration
   */
  async declineRegistration(email, reason = null) {
    const registration = this.registrations.get(email)
    if (!registration) {
      throw new Error('Registration not found')
    }

    registration.status = REGISTRATION_STATUS.DECLINED
    registration.declinedAt = new Date().toISOString()
    registration.declineReason = reason
    this.approvedEmails.delete(email)

    logger.debug('📝 [Registration] Declined:', email)
    this.emit('registration:declined', registration)

    // Send decline email
    if (reason) {
      await this.sendDeclineEmail(registration, reason)
    }

    return registration
  }

  /**
   * Cancel registration (by attendee)
   */
  async cancelRegistration(email) {
    const registration = this.registrations.get(email)
    if (!registration) {
      throw new Error('Registration not found')
    }

    registration.status = REGISTRATION_STATUS.CANCELLED
    registration.cancelledAt = new Date().toISOString()
    this.approvedEmails.delete(email)

    logger.debug('📝 [Registration] Cancelled:', email)
    this.emit('registration:cancelled', registration)

    return registration
  }

  /**
   * Verify access token
   */
  verifyAccessToken(email, token) {
    const registration = this.registrations.get(email)
    if (!registration) {
      return false
    }

    if (registration.status !== REGISTRATION_STATUS.APPROVED) {
      return false
    }

    return registration.accessToken === token
  }

  /**
   * Check if email is approved
   */
  isApproved(email) {
    return this.approvedEmails.has(email)
  }

  /**
   * Block email from registering
   */
  blockEmail(email) {
    this.blockedEmails.add(email)
    logger.debug('📝 [Registration] Email blocked:', email)
    this.emit('registration:email-blocked', { email })
  }

  /**
   * Unblock email
   */
  unblockEmail(email) {
    this.blockedEmails.delete(email)
    logger.debug('📝 [Registration] Email unblocked:', email)
    this.emit('registration:email-unblocked', { email })
  }

  /**
   * Get registration by email
   */
  getRegistration(email) {
    return this.registrations.get(email)
  }

  /**
   * Get all registrations
   */
  getAllRegistrations() {
    return Array.from(this.registrations.values())
  }

  /**
   * Get pending registrations
   */
  getPendingRegistrations() {
    return Array.from(this.registrations.values()).filter(
      r => r.status === REGISTRATION_STATUS.PENDING
    )
  }

  /**
   * Get approved registrations
   */
  getApprovedRegistrations() {
    return Array.from(this.registrations.values()).filter(
      r => r.status === REGISTRATION_STATUS.APPROVED
    )
  }

  /**
   * Get approved registrations count
   */
  getApprovedRegistrationsCount() {
    return this.getApprovedRegistrations().length
  }

  /**
   * Get registration statistics
   */
  getStatistics() {
    const all = this.getAllRegistrations()
    const byStatus = {
      pending: 0,
      approved: 0,
      declined: 0,
      cancelled: 0
    }

    all.forEach(r => {
      byStatus[r.status]++
    })

    return {
      total: all.length,
      ...byStatus,
      availableSlots: this.settings.maxAttendees ?
        this.settings.maxAttendees - byStatus.approved : null
    }
  }

  /**
   * Generate unique registration ID
   */
  generateRegistrationId() {
    return `reg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate access token for attendee
   */
  generateAccessToken(email) {
    // Simple token generation - in production, use JWT or secure tokens
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 16)
    return Buffer.from(`${email}:${timestamp}:${random}`).toString('base64')
  }

  /**
   * Send confirmation email (placeholder)
   * TODO: Integrate with email service
   */
  async sendConfirmationEmail(registration) {
    logger.debug('📧 [Registration] Confirmation email:', registration.email)

    // Placeholder for email sending
    // In production:
    // 1. Use email service (SendGrid, Mailgun, etc.)
    // 2. Include webinar details
    // 3. Include join link with access token
    // 4. Include calendar invite (.ics file)

    const emailData = {
      to: registration.email,
      subject: `Registration confirmed for webinar`,
      body: this.generateConfirmationEmailBody(registration)
    }

    // TODO: Call email service API
    return emailData
  }

  /**
   * Send approval email (placeholder)
   */
  async sendApprovalEmail(registration) {
    logger.debug('📧 [Registration] Approval email:', registration.email)

    const emailData = {
      to: registration.email,
      subject: `Your registration has been approved`,
      body: this.generateApprovalEmailBody(registration)
    }

    // TODO: Call email service API
    return emailData
  }

  /**
   * Send decline email (placeholder)
   */
  async sendDeclineEmail(registration, reason) {
    logger.debug('📧 [Registration] Decline email:', registration.email)

    const emailData = {
      to: registration.email,
      subject: `Registration declined`,
      body: this.generateDeclineEmailBody(registration, reason)
    }

    // TODO: Call email service API
    return emailData
  }

  /**
   * Generate confirmation email body
   */
  generateConfirmationEmailBody(registration) {
    if (registration.status === REGISTRATION_STATUS.PENDING) {
      return `
        <h2>Registration Received</h2>
        <p>Thank you for registering for our webinar.</p>
        <p>Your registration is pending approval. You will receive another email once it's approved.</p>
      `
    } else {
      const joinUrl = this.generateJoinUrl(registration)
      return `
        <h2>Registration Confirmed</h2>
        <p>Thank you for registering for our webinar.</p>
        <p>Your access link: <a href="${joinUrl}">${joinUrl}</a></p>
        <p>Please save this link. You will need it to join the webinar.</p>
      `
    }
  }

  /**
   * Generate approval email body
   */
  generateApprovalEmailBody(registration) {
    const joinUrl = this.generateJoinUrl(registration)
    return `
      <h2>Registration Approved</h2>
      <p>Great news! Your registration has been approved.</p>
      <p>Your access link: <a href="${joinUrl}">${joinUrl}</a></p>
      <p>Please save this link. You will need it to join the webinar.</p>
    `
  }

  /**
   * Generate decline email body
   */
  generateDeclineEmailBody(registration, reason) {
    return `
      <h2>Registration Update</h2>
      <p>Unfortunately, we are unable to approve your registration at this time.</p>
      ${reason ? `<p>Reason: ${reason}</p>` : ''}
      <p>If you believe this is an error, please contact the organizer.</p>
    `
  }

  /**
   * Generate join URL with access token
   */
  generateJoinUrl(registration) {
    const baseUrl = window.location.origin
    return `${baseUrl}/webinar/${this.webinarId}?email=${encodeURIComponent(registration.email)}&token=${encodeURIComponent(registration.accessToken)}`
  }

  /**
   * Export registrations to CSV
   */
  exportToCSV() {
    const registrations = this.getAllRegistrations()

    const headers = ['Email', 'Name', 'Organization', 'Status', 'Registered At', 'Access Token']
    const rows = registrations.map(r => [
      r.email,
      r.name,
      r.organization || '',
      r.status,
      r.registeredAt,
      r.accessToken
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    return csv
  }

  /**
   * Register event handler
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event).push(handler)
  }

  /**
   * Emit event to handlers
   */
  emit(event, ...args) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args)
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error)
        }
      })
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.registrations.clear()
    this.approvedEmails.clear()
    this.blockedEmails.clear()
    this.eventHandlers.clear()
    logger.debug('📝 [Registration] Cleaned up')
  }
}
