// appointments.js - Appointment booking API routes
import express from 'express';
import logger from '../../utils/logger.js';
import { AppointmentStorageService } from '../../services/AppointmentStorageService.js';
import { CalendarService } from '../../services/CalendarService.js';
import { AppointmentBookingAgent } from '../../agents/AppointmentBookingAgent.js';

export function createAppointmentRoutes(orchestrator) {
  const router = express.Router();

  // Initialize services
  const storageService = new AppointmentStorageService();
  const calendarService = new CalendarService({ storageService });
  const appointmentAgent = new AppointmentBookingAgent({
    storageService,
    calendarService
  });

  // Initialize storage
  storageService.initialize().catch(error => {
    logger.error({ error: error.message }, 'Failed to initialize appointment storage');
  });

  appointmentAgent.initialize().catch(error => {
    logger.error({ error: error.message }, 'Failed to initialize appointment agent');
  });

  // ==================== SPECIALIST ROUTES ====================

  /**
   * Create a new specialist
   * POST /api/appointments/specialists
   */
  router.post('/specialists', async (req, res, next) => {
    try {
      const specialist = {
        id: `spec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...req.body,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await storageService.saveSpecialist(specialist);

      res.status(201).json({
        success: true,
        specialist
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create specialist');
      next(error);
    }
  });

  /**
   * Get all specialists
   * GET /api/appointments/specialists
   */
  router.get('/specialists', async (req, res, next) => {
    try {
      const specialists = await storageService.getAllSpecialists();

      res.json({
        success: true,
        specialists
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get specialists');
      next(error);
    }
  });

  /**
   * Get specialist by ID
   * GET /api/appointments/specialists/:id
   */
  router.get('/specialists/:id', async (req, res, next) => {
    try {
      const specialist = await storageService.getSpecialist(req.params.id);

      if (!specialist) {
        return res.status(404).json({
          success: false,
          error: 'Specialist not found'
        });
      }

      res.json({
        success: true,
        specialist
      });
    } catch (error) {
      logger.error({ error: error.message, specialistId: req.params.id }, 'Failed to get specialist');
      next(error);
    }
  });

  /**
   * Update specialist
   * PUT /api/appointments/specialists/:id
   */
  router.put('/specialists/:id', async (req, res, next) => {
    try {
      const existing = await storageService.getSpecialist(req.params.id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Specialist not found'
        });
      }

      const updated = {
        ...existing,
        ...req.body,
        id: req.params.id, // Ensure ID doesn't change
        updatedAt: new Date().toISOString()
      };

      await storageService.saveSpecialist(updated);

      res.json({
        success: true,
        specialist: updated
      });
    } catch (error) {
      logger.error({ error: error.message, specialistId: req.params.id }, 'Failed to update specialist');
      next(error);
    }
  });

  /**
   * Delete specialist
   * DELETE /api/appointments/specialists/:id
   */
  router.delete('/specialists/:id', async (req, res, next) => {
    try {
      const deleted = await storageService.deleteSpecialist(req.params.id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Specialist not found'
        });
      }

      res.json({
        success: true,
        message: 'Specialist deleted'
      });
    } catch (error) {
      logger.error({ error: error.message, specialistId: req.params.id }, 'Failed to delete specialist');
      next(error);
    }
  });

  // ==================== SERVICE ROUTES ====================

  /**
   * Create a new service
   * POST /api/appointments/services
   */
  router.post('/services', async (req, res, next) => {
    try {
      const service = {
        id: `svc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...req.body,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await storageService.saveService(service);

      res.status(201).json({
        success: true,
        service
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create service');
      next(error);
    }
  });

  /**
   * Get all services
   * GET /api/appointments/services
   */
  router.get('/services', async (req, res, next) => {
    try {
      const services = await storageService.getAllServices();

      res.json({
        success: true,
        services
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get services');
      next(error);
    }
  });

  /**
   * Get service by ID
   * GET /api/appointments/services/:id
   */
  router.get('/services/:id', async (req, res, next) => {
    try {
      const service = await storageService.getService(req.params.id);

      if (!service) {
        return res.status(404).json({
          success: false,
          error: 'Service not found'
        });
      }

      res.json({
        success: true,
        service
      });
    } catch (error) {
      logger.error({ error: error.message, serviceId: req.params.id }, 'Failed to get service');
      next(error);
    }
  });

  /**
   * Update service
   * PUT /api/appointments/services/:id
   */
  router.put('/services/:id', async (req, res, next) => {
    try {
      const existing = await storageService.getService(req.params.id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Service not found'
        });
      }

      const updated = {
        ...existing,
        ...req.body,
        id: req.params.id,
        updatedAt: new Date().toISOString()
      };

      await storageService.saveService(updated);

      res.json({
        success: true,
        service: updated
      });
    } catch (error) {
      logger.error({ error: error.message, serviceId: req.params.id }, 'Failed to update service');
      next(error);
    }
  });

  /**
   * Delete service
   * DELETE /api/appointments/services/:id
   */
  router.delete('/services/:id', async (req, res, next) => {
    try {
      const deleted = await storageService.deleteService(req.params.id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Service not found'
        });
      }

      res.json({
        success: true,
        message: 'Service deleted'
      });
    } catch (error) {
      logger.error({ error: error.message, serviceId: req.params.id }, 'Failed to delete service');
      next(error);
    }
  });

  // ==================== APPOINTMENT/BOOKING ROUTES ====================

  /**
   * Create a new appointment (booking)
   * POST /api/appointments/bookings
   */
  router.post('/bookings', async (req, res, next) => {
    try {
      const result = await appointmentAgent.execute({
        action: 'create-appointment',
        data: req.body
      });

      res.status(201).json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create appointment');
      if (error.message.includes('required field') || error.message.includes('Invalid')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  });

  /**
   * Get all appointments (with optional filters)
   * GET /api/appointments/bookings?specialistId=xxx&date=YYYY-MM-DD&clientEmail=xxx
   */
  router.get('/bookings', async (req, res, next) => {
    try {
      const { specialistId, date, clientEmail } = req.query;

      let appointments = [];

      if (date && specialistId) {
        appointments = await storageService.getAppointmentsForDay(specialistId, date);
      } else if (date) {
        appointments = await storageService.getAppointmentsByDate(date);
      } else if (specialistId) {
        appointments = await storageService.getAppointmentsBySpecialist(specialistId);
      } else if (clientEmail) {
        appointments = await storageService.getAppointmentsByClient(clientEmail);
      } else {
        // Get all appointments (this can be expensive in production)
        // For now, we'll limit to getting all files
        const fs = await import('fs/promises');
        const path = await import('path');
        const basePath = storageService.basePath;
        const files = await fs.readdir(path.join(basePath, 'appointments'));

        for (const file of files) {
          if (file.endsWith('.json')) {
            const id = file.replace('.json', '');
            const apt = await storageService.getAppointment(id);
            if (apt) appointments.push(apt);
          }
        }
      }

      res.json({
        success: true,
        appointments
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get appointments');
      next(error);
    }
  });

  /**
   * Get client's appointments by email
   * GET /api/appointments/bookings/client/:email
   */
  router.get('/bookings/client/:email', async (req, res, next) => {
    try {
      const appointments = await storageService.getAppointmentsByClient(decodeURIComponent(req.params.email));

      res.json({
        success: true,
        appointments
      });
    } catch (error) {
      logger.error({ error: error.message, email: req.params.email }, 'Failed to get client appointments');
      next(error);
    }
  });

  /**
   * Get appointment by ID
   * GET /api/appointments/bookings/:id
   */
  router.get('/bookings/:id', async (req, res, next) => {
    try {
      const appointment = await storageService.getAppointment(req.params.id);

      if (!appointment) {
        return res.status(404).json({
          success: false,
          error: 'Appointment not found'
        });
      }

      res.json({
        success: true,
        appointment
      });
    } catch (error) {
      logger.error({ error: error.message, appointmentId: req.params.id }, 'Failed to get appointment');
      next(error);
    }
  });

  /**
   * Cancel appointment
   * POST /api/appointments/bookings/:id/cancel
   */
  router.post('/bookings/:id/cancel', async (req, res, next) => {
    try {
      const { reason } = req.body;

      const result = await appointmentAgent.execute({
        action: 'cancel-appointment',
        data: {
          appointmentId: req.params.id,
          reason: reason || 'No reason provided'
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message, appointmentId: req.params.id }, 'Failed to cancel appointment');
      if (error.message.includes('not found') || error.message.includes('already cancelled')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  });

  /**
   * Reschedule appointment
   * POST /api/appointments/bookings/:id/reschedule
   */
  router.post('/bookings/:id/reschedule', async (req, res, next) => {
    try {
      const { newStartTime } = req.body;

      if (!newStartTime) {
        return res.status(400).json({
          success: false,
          error: 'newStartTime is required'
        });
      }

      const result = await appointmentAgent.execute({
        action: 'reschedule-appointment',
        data: {
          appointmentId: req.params.id,
          newStartTime
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message, appointmentId: req.params.id }, 'Failed to reschedule appointment');
      if (error.message.includes('not found') || error.message.includes('not available')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  });

  // ==================== AVAILABILITY ROUTES ====================

  /**
   * Get available slots for a specialist
   * GET /api/appointments/specialists/:specialistId/availability?date=YYYY-MM-DD&serviceId=xxx
   */
  router.get('/specialists/:specialistId/availability', async (req, res, next) => {
    try {
      const { date, serviceId } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          error: 'date query parameter is required (format: YYYY-MM-DD)'
        });
      }

      const result = await appointmentAgent.execute({
        action: 'get-availability',
        data: {
          specialistId: req.params.specialistId,
          date,
          serviceId
        }
      });

      res.json({
        success: true,
        slots: result
      });
    } catch (error) {
      logger.error({ error: error.message, specialistId: req.params.specialistId }, 'Failed to get availability');
      next(error);
    }
  });

  return router;
}

export default createAppointmentRoutes;
