import apiClient from '@/axios2'
import { logger } from '@/utils/logger'

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api'

/**
 * Appointment Booking Service
 * Handles all API interactions for the appointment booking system
 */
export const appointmentService = {
  // ==================== Specialists ====================

  /**
   * Get all specialists
   */
  async getSpecialists() {
    try {
      const response = await apiClient.get(`${API_BASE_URL}/appointments/specialists`)
      return response.data
    } catch (error) {
      logger.error('appointmentService.getSpecialists error', { error })
      throw error
    }
  },

  /**
   * Get specialist by ID
   */
  async getSpecialist(id) {
    try {
      const response = await apiClient.get(`${API_BASE_URL}/appointments/specialists/${id}`)
      return response.data
    } catch (error) {
      logger.error('appointmentService.getSpecialist error', { error, id })
      throw error
    }
  },

  /**
   * Create new specialist
   */
  async createSpecialist(specialistData) {
    try {
      const response = await apiClient.post(
        `${API_BASE_URL}/appointments/specialists`,
        specialistData
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.createSpecialist error', { error })
      throw error
    }
  },

  /**
   * Update specialist
   */
  async updateSpecialist(id, specialistData) {
    try {
      const response = await apiClient.put(
        `${API_BASE_URL}/appointments/specialists/${id}`,
        specialistData
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.updateSpecialist error', { error, id })
      throw error
    }
  },

  /**
   * Delete specialist
   */
  async deleteSpecialist(id) {
    try {
      const response = await apiClient.delete(
        `${API_BASE_URL}/appointments/specialists/${id}`
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.deleteSpecialist error', { error, id })
      throw error
    }
  },

  /**
   * Get available time slots for specialist
   */
  async getSpecialistAvailability(specialistId, date, serviceId) {
    try {
      const response = await apiClient.get(
        `${API_BASE_URL}/appointments/specialists/${specialistId}/availability`,
        {
          params: { date, serviceId }
        }
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.getSpecialistAvailability error', {
        error,
        specialistId,
        date,
        serviceId
      })
      throw error
    }
  },

  // ==================== Services ====================

  /**
   * Get all services
   */
  async getServices() {
    try {
      const response = await apiClient.get(`${API_BASE_URL}/appointments/services`)
      return response.data
    } catch (error) {
      logger.error('appointmentService.getServices error', { error })
      throw error
    }
  },

  /**
   * Get service by ID
   */
  async getService(id) {
    try {
      const response = await apiClient.get(`${API_BASE_URL}/appointments/services/${id}`)
      return response.data
    } catch (error) {
      logger.error('appointmentService.getService error', { error, id })
      throw error
    }
  },

  /**
   * Create new service
   */
  async createService(serviceData) {
    try {
      const response = await apiClient.post(
        `${API_BASE_URL}/appointments/services`,
        serviceData
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.createService error', { error })
      throw error
    }
  },

  /**
   * Update service
   */
  async updateService(id, serviceData) {
    try {
      const response = await apiClient.put(
        `${API_BASE_URL}/appointments/services/${id}`,
        serviceData
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.updateService error', { error, id })
      throw error
    }
  },

  /**
   * Delete service
   */
  async deleteService(id) {
    try {
      const response = await apiClient.delete(
        `${API_BASE_URL}/appointments/services/${id}`
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.deleteService error', { error, id })
      throw error
    }
  },

  // ==================== Appointments ====================

  /**
   * Get all appointments
   */
  async getAppointments(filters = {}) {
    try {
      const response = await apiClient.get(`${API_BASE_URL}/appointments/bookings`, {
        params: filters
      })
      return response.data
    } catch (error) {
      logger.error('appointmentService.getAppointments error', { error })
      throw error
    }
  },

  /**
   * Get appointment by ID
   */
  async getAppointment(id) {
    try {
      const response = await apiClient.get(`${API_BASE_URL}/appointments/bookings/${id}`)
      return response.data
    } catch (error) {
      logger.error('appointmentService.getAppointment error', { error, id })
      throw error
    }
  },

  /**
   * Create new appointment
   */
  async createAppointment(appointmentData) {
    try {
      const response = await apiClient.post(
        `${API_BASE_URL}/appointments/bookings`,
        appointmentData
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.createAppointment error', { error })
      throw error
    }
  },

  /**
   * Update appointment
   */
  async updateAppointment(id, appointmentData) {
    try {
      const response = await apiClient.put(
        `${API_BASE_URL}/appointments/bookings/${id}`,
        appointmentData
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.updateAppointment error', { error, id })
      throw error
    }
  },

  /**
   * Cancel appointment
   */
  async cancelAppointment(id, reason = '') {
    try {
      const response = await apiClient.post(
        `${API_BASE_URL}/appointments/bookings/${id}/cancel`,
        { reason }
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.cancelAppointment error', { error, id })
      throw error
    }
  },

  /**
   * Reschedule appointment
   */
  async rescheduleAppointment(id, newStartTime) {
    try {
      const response = await apiClient.post(
        `${API_BASE_URL}/appointments/bookings/${id}/reschedule`,
        { newStartTime }
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.rescheduleAppointment error', { error, id })
      throw error
    }
  },

  /**
   * Get client's appointments by email
   */
  async getClientAppointments(email) {
    try {
      const response = await apiClient.get(
        `${API_BASE_URL}/appointments/bookings/client/${encodeURIComponent(email)}`
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.getClientAppointments error', { error, email })
      throw error
    }
  },

  // ==================== Calendar Integration ====================

  /**
   * Get calendar integrations
   */
  async getCalendarIntegrations() {
    try {
      const response = await apiClient.get(`${API_BASE_URL}/appointments/calendar/integrations`)
      return response.data
    } catch (error) {
      logger.error('appointmentService.getCalendarIntegrations error', { error })
      throw error
    }
  },

  /**
   * Authorize Google Calendar
   */
  async authorizeGoogleCalendar(specialistId) {
    try {
      const response = await apiClient.post(
        `${API_BASE_URL}/appointments/calendar/google/authorize`,
        { specialistId }
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.authorizeGoogleCalendar error', { error })
      throw error
    }
  },

  /**
   * Authorize Outlook Calendar
   */
  async authorizeOutlookCalendar(specialistId) {
    try {
      const response = await apiClient.post(
        `${API_BASE_URL}/appointments/calendar/outlook/authorize`,
        { specialistId }
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.authorizeOutlookCalendar error', { error })
      throw error
    }
  },

  /**
   * Sync calendar for specialist
   */
  async syncCalendar(specialistId) {
    try {
      const response = await apiClient.post(
        `${API_BASE_URL}/appointments/calendar/${specialistId}/sync`
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.syncCalendar error', { error, specialistId })
      throw error
    }
  },

  // ==================== Payments ====================

  /**
   * Get payment settings
   */
  async getPaymentSettings() {
    try {
      const response = await apiClient.get(`${API_BASE_URL}/appointments/payments/settings`)
      return response.data
    } catch (error) {
      logger.error('appointmentService.getPaymentSettings error', { error })
      throw error
    }
  },

  /**
   * Create payment for appointment
   */
  async createPayment(appointmentId, paymentData) {
    try {
      const response = await apiClient.post(
        `${API_BASE_URL}/appointments/payments/create`,
        {
          appointmentId,
          ...paymentData
        }
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.createPayment error', { error, appointmentId })
      throw error
    }
  },

  /**
   * Process refund
   */
  async processRefund(paymentId, amount) {
    try {
      const response = await apiClient.post(
        `${API_BASE_URL}/appointments/payments/${paymentId}/refund`,
        { amount }
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.processRefund error', { error, paymentId })
      throw error
    }
  },

  // ==================== Video Conference ====================

  /**
   * Generate video conference link
   */
  async generateVideoConferenceLink(appointmentId, provider = 'zoom') {
    try {
      const response = await apiClient.post(
        `${API_BASE_URL}/appointments/video-conference/generate`,
        {
          appointmentId,
          provider
        }
      )
      return response.data
    } catch (error) {
      logger.error('appointmentService.generateVideoConferenceLink error', {
        error,
        appointmentId,
        provider
      })
      throw error
    }
  }
}

export default appointmentService
