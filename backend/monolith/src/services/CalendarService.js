// CalendarService.js - Calendar and scheduling service
import logger from '../utils/logger.js';

/**
 * CalendarService
 *
 * Handles calendar operations, availability calculation, and scheduling logic
 *
 * Features:
 * - Available slot calculation
 * - Working hours management
 * - Holiday management
 * - Double-booking prevention
 * - Timezone handling
 *
 * Note: This service works with file-based storage
 */
export class CalendarService {
  constructor(options = {}) {
    this.storageService = options.storageService || null;
    this.slotDuration = options.slotDuration || 15; // Default 15-minute slots
  }

  /**
   * Get available time slots for a specialist on a given date
   * @param {string} specialistId - Specialist ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} serviceId - Service ID (optional, for duration)
   * @returns {Array} Array of available time slots
   */
  async getAvailableSlots(specialistId, date, serviceId = null) {
    try {
      logger.info(
        { specialistId, date, serviceId },
        'Calculating available slots'
      );

      // Get specialist
      const specialist = await this.getSpecialist(specialistId);
      if (!specialist) {
        throw new Error('Specialist not found');
      }

      if (!specialist.isActive) {
        return []; // Inactive specialist has no slots
      }

      // Get service duration
      let serviceDuration = this.slotDuration;
      if (serviceId) {
        const service = await this.getService(serviceId);
        if (service) {
          serviceDuration = service.duration;
        }
      }

      // Get day of week
      const dateObj = new Date(date);
      const dayOfWeek = this.getDayOfWeek(dateObj);

      // Get working hours for this day
      const workingHours = specialist.workingHours[dayOfWeek];
      if (!workingHours || !workingHours.enabled) {
        return []; // Not working on this day
      }

      // Check if date is a holiday
      if (specialist.holidays && specialist.holidays.includes(date)) {
        return []; // Holiday, no slots
      }

      // Generate all possible slots for the day
      const allSlots = this.generateSlotsForDay(
        date,
        workingHours,
        serviceDuration,
        specialist.timezone
      );

      // Get existing appointments for this day
      const appointments = await this.getAppointmentsForDay(specialistId, date);

      // Filter out booked slots
      const availableSlots = this.filterAvailableSlots(
        allSlots,
        appointments,
        serviceDuration
      );

      logger.info(
        { specialistId, date, slotsCount: availableSlots.length },
        'Available slots calculated'
      );

      return availableSlots;
    } catch (error) {
      logger.error(
        { error: error.message, specialistId, date },
        'Failed to get available slots'
      );
      throw error;
    }
  }

  /**
   * Check if a time slot is available
   * @param {string} specialistId - Specialist ID
   * @param {string} startTime - Start time (ISO 8601)
   * @param {string} endTime - End time (ISO 8601)
   * @returns {boolean} True if available
   */
  async checkAvailability(specialistId, startTime, endTime) {
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);

      // Get appointments for the day
      const date = start.toISOString().split('T')[0];
      const appointments = await this.getAppointmentsForDay(specialistId, date);

      // Check for conflicts
      for (const apt of appointments) {
        if (apt.status === 'cancelled') continue;

        const aptStart = new Date(apt.startTime);
        const aptEnd = new Date(apt.endTime);

        // Check for overlap
        if (
          (start >= aptStart && start < aptEnd) ||
          (end > aptStart && end <= aptEnd) ||
          (start <= aptStart && end >= aptEnd)
        ) {
          logger.info(
            { specialistId, startTime, endTime, conflictingAppointment: apt.id },
            'Time slot not available (conflict)'
          );
          return false;
        }
      }

      logger.info(
        { specialistId, startTime, endTime },
        'Time slot available'
      );

      return true;
    } catch (error) {
      logger.error(
        { error: error.message, specialistId, startTime, endTime },
        'Failed to check availability'
      );
      throw error;
    }
  }

  /**
   * Generate all possible slots for a day
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {Object} workingHours - Working hours object { start, end, breaks }
   * @param {number} slotDuration - Duration of each slot in minutes
   * @param {string} timezone - Timezone
   * @returns {Array} Array of slot objects
   */
  generateSlotsForDay(date, workingHours, slotDuration, timezone) {
    const slots = [];
    const { start, end, breaks = [] } = workingHours;

    // Parse start and end times
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);

    // Create date objects in the specialist's timezone
    let currentTime = new Date(`${date}T${start}:00`);
    const endTime = new Date(`${date}T${end}:00`);

    while (currentTime < endTime) {
      const slotStart = new Date(currentTime);
      const slotEnd = new Date(currentTime.getTime() + slotDuration * 60 * 1000);

      // Check if slot overlaps with break
      const isBreak = breaks.some(breakPeriod => {
        const breakStart = new Date(`${date}T${breakPeriod.start}:00`);
        const breakEnd = new Date(`${date}T${breakPeriod.end}:00`);

        return (
          (slotStart >= breakStart && slotStart < breakEnd) ||
          (slotEnd > breakStart && slotEnd <= breakEnd) ||
          (slotStart <= breakStart && slotEnd >= breakEnd)
        );
      });

      if (!isBreak && slotEnd <= endTime) {
        slots.push({
          time: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          duration: slotDuration
        });
      }

      // Move to next slot
      currentTime = new Date(currentTime.getTime() + slotDuration * 60 * 1000);
    }

    return slots;
  }

  /**
   * Filter available slots based on existing appointments
   * @param {Array} allSlots - All possible slots
   * @param {Array} appointments - Existing appointments
   * @param {number} serviceDuration - Required service duration in minutes
   * @returns {Array} Available slots
   */
  filterAvailableSlots(allSlots, appointments, serviceDuration) {
    const now = new Date();

    return allSlots.filter(slot => {
      const slotStart = new Date(slot.time);
      const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60 * 1000);

      // Don't show past slots
      if (slotStart <= now) {
        return false;
      }

      // Check if enough consecutive time is available
      const hasConflict = appointments.some(apt => {
        if (apt.status === 'cancelled') return false;

        const aptStart = new Date(apt.startTime);
        const aptEnd = new Date(apt.endTime);

        // Check for overlap
        return (
          (slotStart >= aptStart && slotStart < aptEnd) ||
          (slotEnd > aptStart && slotEnd <= aptEnd) ||
          (slotStart <= aptStart && slotEnd >= aptEnd)
        );
      });

      return !hasConflict;
    });
  }

  /**
   * Get day of week from date
   * @param {Date} date - Date object
   * @returns {string} Day of week (monday, tuesday, etc.)
   */
  getDayOfWeek(date) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  /**
   * Get specialist by ID
   * @param {string} id - Specialist ID
   * @returns {Object|null} Specialist or null
   */
  async getSpecialist(id) {
    if (!this.storageService) {
      logger.warn('getSpecialist: storage service not available');
      return null;
    }

    return await this.storageService.getSpecialist(id);
  }

  /**
   * Get service by ID
   * @param {string} id - Service ID
   * @returns {Object|null} Service or null
   */
  async getService(id) {
    if (!this.storageService) {
      logger.warn('getService: storage service not available');
      return null;
    }

    return await this.storageService.getService(id);
  }

  /**
   * Get appointments for a specific day
   * @param {string} specialistId - Specialist ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Array} Appointments
   */
  async getAppointmentsForDay(specialistId, date) {
    if (!this.storageService) {
      logger.warn('getAppointmentsForDay: storage service not available');
      return [];
    }

    return await this.storageService.getAppointmentsForDay(specialistId, date);
  }

  /**
   * Create calendar event (stub - will be replaced with actual calendar integration)
   * @param {Object} appointment - Appointment object
   * @returns {Object} Calendar event IDs
   */
  async createEvent(appointment) {
    // TODO: Implement Google/Outlook Calendar integration
    logger.warn('createEvent is a stub');
    return { google: null, outlook: null };
  }

  /**
   * Update calendar event (stub - will be replaced with actual calendar integration)
   * @param {Object} appointment - Appointment object
   * @returns {Object} Result
   */
  async updateEvent(appointment) {
    // TODO: Implement Google/Outlook Calendar integration
    logger.warn('updateEvent is a stub');
    return { success: true };
  }

  /**
   * Delete calendar event (stub - will be replaced with actual calendar integration)
   * @param {Object} appointment - Appointment object
   * @returns {Object} Result
   */
  async deleteEvent(appointment) {
    // TODO: Implement Google/Outlook Calendar integration
    logger.warn('deleteEvent is a stub');
    return { success: true };
  }

  /**
   * Sync with external calendar provider (stub)
   * @param {string} specialistId - Specialist ID
   * @returns {Object} Sync result
   */
  async syncWithProvider(specialistId) {
    // TODO: Implement calendar sync
    logger.warn('syncWithProvider is a stub');
    return { success: true, syncedEvents: 0 };
  }
}

export default CalendarService;
