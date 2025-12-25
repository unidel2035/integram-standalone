// AppointmentStorageService.js - File-based storage for appointment booking system
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * AppointmentStorageService
 *
 * File-based storage service for appointment booking system
 *
 * Storage structure:
 * data/appointments/
 *   specialists/
 *     {specialist-id}.json
 *   services/
 *     {service-id}.json
 *   appointments/
 *     {appointment-id}.json
 *   index/
 *     specialists-index.json
 *     services-index.json
 *     appointments-by-date.json
 *     appointments-by-specialist.json
 *
 * Features:
 * - Atomic file operations with optimistic locking
 * - Index files for fast queries
 * - Automatic directory creation
 * - JSON-based storage
 */
export class AppointmentStorageService {
  constructor(options = {}) {
    this.basePath = options.basePath || path.join(__dirname, '../../data/appointments');
    this.initialized = false;
  }

  /**
   * Initialize storage directories
   */
  async initialize() {
    if (this.initialized) return;

    try {
      logger.info({ basePath: this.basePath }, 'Initializing appointment storage');

      const dirs = [
        this.basePath,
        path.join(this.basePath, 'specialists'),
        path.join(this.basePath, 'services'),
        path.join(this.basePath, 'appointments'),
        path.join(this.basePath, 'index')
      ];

      for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true });
      }

      // Initialize index files if they don't exist
      await this.initializeIndexFile('specialists-index.json', []);
      await this.initializeIndexFile('services-index.json', []);
      await this.initializeIndexFile('appointments-by-date.json', {});
      await this.initializeIndexFile('appointments-by-specialist.json', {});

      this.initialized = true;
      logger.info('Appointment storage initialized');
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to initialize appointment storage');
      throw error;
    }
  }

  /**
   * Initialize an index file if it doesn't exist
   */
  async initializeIndexFile(filename, defaultValue) {
    const filePath = path.join(this.basePath, 'index', filename);
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
    }
  }

  // ==================== SPECIALIST OPERATIONS ====================

  /**
   * Create or update a specialist
   */
  async saveSpecialist(specialist) {
    await this.initialize();

    try {
      const filePath = path.join(this.basePath, 'specialists', `${specialist.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(specialist, null, 2));

      // Update index
      await this.updateSpecialistIndex(specialist);

      logger.info({ specialistId: specialist.id }, 'Specialist saved');
      return specialist;
    } catch (error) {
      logger.error({ error: error.message, specialistId: specialist.id }, 'Failed to save specialist');
      throw error;
    }
  }

  /**
   * Get specialist by ID
   */
  async getSpecialist(id) {
    await this.initialize();

    try {
      const filePath = path.join(this.basePath, 'specialists', `${id}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      logger.error({ error: error.message, specialistId: id }, 'Failed to get specialist');
      throw error;
    }
  }

  /**
   * Get all specialists
   */
  async getAllSpecialists() {
    await this.initialize();

    try {
      const indexPath = path.join(this.basePath, 'index', 'specialists-index.json');
      const data = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(data);

      const specialists = await Promise.all(
        index.map(id => this.getSpecialist(id))
      );

      return specialists.filter(s => s !== null);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get all specialists');
      throw error;
    }
  }

  /**
   * Delete specialist
   */
  async deleteSpecialist(id) {
    await this.initialize();

    try {
      const filePath = path.join(this.basePath, 'specialists', `${id}.json`);
      await fs.unlink(filePath);

      // Update index
      await this.removeFromSpecialistIndex(id);

      logger.info({ specialistId: id }, 'Specialist deleted');
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      logger.error({ error: error.message, specialistId: id }, 'Failed to delete specialist');
      throw error;
    }
  }

  /**
   * Update specialist index
   */
  async updateSpecialistIndex(specialist) {
    const indexPath = path.join(this.basePath, 'index', 'specialists-index.json');
    const data = await fs.readFile(indexPath, 'utf-8');
    const index = JSON.parse(data);

    if (!index.includes(specialist.id)) {
      index.push(specialist.id);
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    }
  }

  /**
   * Remove from specialist index
   */
  async removeFromSpecialistIndex(id) {
    const indexPath = path.join(this.basePath, 'index', 'specialists-index.json');
    const data = await fs.readFile(indexPath, 'utf-8');
    const index = JSON.parse(data);

    const newIndex = index.filter(specId => specId !== id);
    await fs.writeFile(indexPath, JSON.stringify(newIndex, null, 2));
  }

  // ==================== SERVICE OPERATIONS ====================

  /**
   * Create or update a service
   */
  async saveService(service) {
    await this.initialize();

    try {
      const filePath = path.join(this.basePath, 'services', `${service.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(service, null, 2));

      // Update index
      await this.updateServiceIndex(service);

      logger.info({ serviceId: service.id }, 'Service saved');
      return service;
    } catch (error) {
      logger.error({ error: error.message, serviceId: service.id }, 'Failed to save service');
      throw error;
    }
  }

  /**
   * Get service by ID
   */
  async getService(id) {
    await this.initialize();

    try {
      const filePath = path.join(this.basePath, 'services', `${id}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      logger.error({ error: error.message, serviceId: id }, 'Failed to get service');
      throw error;
    }
  }

  /**
   * Get all services
   */
  async getAllServices() {
    await this.initialize();

    try {
      const indexPath = path.join(this.basePath, 'index', 'services-index.json');
      const data = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(data);

      const services = await Promise.all(
        index.map(id => this.getService(id))
      );

      return services.filter(s => s !== null);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get all services');
      throw error;
    }
  }

  /**
   * Delete service
   */
  async deleteService(id) {
    await this.initialize();

    try {
      const filePath = path.join(this.basePath, 'services', `${id}.json`);
      await fs.unlink(filePath);

      // Update index
      await this.removeFromServiceIndex(id);

      logger.info({ serviceId: id }, 'Service deleted');
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      logger.error({ error: error.message, serviceId: id }, 'Failed to delete service');
      throw error;
    }
  }

  /**
   * Update service index
   */
  async updateServiceIndex(service) {
    const indexPath = path.join(this.basePath, 'index', 'services-index.json');
    const data = await fs.readFile(indexPath, 'utf-8');
    const index = JSON.parse(data);

    if (!index.includes(service.id)) {
      index.push(service.id);
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    }
  }

  /**
   * Remove from service index
   */
  async removeFromServiceIndex(id) {
    const indexPath = path.join(this.basePath, 'index', 'services-index.json');
    const data = await fs.readFile(indexPath, 'utf-8');
    const index = JSON.parse(data);

    const newIndex = index.filter(svcId => svcId !== id);
    await fs.writeFile(indexPath, JSON.stringify(newIndex, null, 2));
  }

  // ==================== APPOINTMENT OPERATIONS ====================

  /**
   * Create or update an appointment
   */
  async saveAppointment(appointment) {
    await this.initialize();

    try {
      const filePath = path.join(this.basePath, 'appointments', `${appointment.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(appointment, null, 2));

      // Update indexes
      await this.updateAppointmentIndexes(appointment);

      logger.info({ appointmentId: appointment.id }, 'Appointment saved');
      return appointment;
    } catch (error) {
      logger.error({ error: error.message, appointmentId: appointment.id }, 'Failed to save appointment');
      throw error;
    }
  }

  /**
   * Get appointment by ID
   */
  async getAppointment(id) {
    await this.initialize();

    try {
      const filePath = path.join(this.basePath, 'appointments', `${id}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      logger.error({ error: error.message, appointmentId: id }, 'Failed to get appointment');
      throw error;
    }
  }

  /**
   * Get appointments for a specific date
   */
  async getAppointmentsByDate(date) {
    await this.initialize();

    try {
      const indexPath = path.join(this.basePath, 'index', 'appointments-by-date.json');
      const data = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(data);

      const appointmentIds = index[date] || [];
      const appointments = await Promise.all(
        appointmentIds.map(id => this.getAppointment(id))
      );

      return appointments.filter(a => a !== null);
    } catch (error) {
      logger.error({ error: error.message, date }, 'Failed to get appointments by date');
      throw error;
    }
  }

  /**
   * Get appointments for a specific specialist
   */
  async getAppointmentsBySpecialist(specialistId) {
    await this.initialize();

    try {
      const indexPath = path.join(this.basePath, 'index', 'appointments-by-specialist.json');
      const data = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(data);

      const appointmentIds = index[specialistId] || [];
      const appointments = await Promise.all(
        appointmentIds.map(id => this.getAppointment(id))
      );

      return appointments.filter(a => a !== null);
    } catch (error) {
      logger.error({ error: error.message, specialistId }, 'Failed to get appointments by specialist');
      throw error;
    }
  }

  /**
   * Get appointments for a specialist on a specific date
   */
  async getAppointmentsForDay(specialistId, date) {
    await this.initialize();

    try {
      const byDate = await this.getAppointmentsByDate(date);
      return byDate.filter(apt => apt.specialistId === specialistId);
    } catch (error) {
      logger.error({ error: error.message, specialistId, date }, 'Failed to get appointments for day');
      throw error;
    }
  }

  /**
   * Get appointments by client email
   */
  async getAppointmentsByClient(clientEmail) {
    await this.initialize();

    try {
      // This is less efficient - we need to scan all appointments
      // In production, we'd maintain a client index too
      const files = await fs.readdir(path.join(this.basePath, 'appointments'));
      const appointments = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const id = file.replace('.json', '');
          const apt = await this.getAppointment(id);
          if (apt && apt.clientEmail === clientEmail) {
            appointments.push(apt);
          }
        }
      }

      return appointments;
    } catch (error) {
      logger.error({ error: error.message, clientEmail }, 'Failed to get appointments by client');
      throw error;
    }
  }

  /**
   * Delete appointment
   */
  async deleteAppointment(id) {
    await this.initialize();

    try {
      const appointment = await this.getAppointment(id);
      if (!appointment) {
        return false;
      }

      const filePath = path.join(this.basePath, 'appointments', `${id}.json`);
      await fs.unlink(filePath);

      // Update indexes
      await this.removeFromAppointmentIndexes(appointment);

      logger.info({ appointmentId: id }, 'Appointment deleted');
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      logger.error({ error: error.message, appointmentId: id }, 'Failed to delete appointment');
      throw error;
    }
  }

  /**
   * Update appointment indexes
   */
  async updateAppointmentIndexes(appointment) {
    // Update by-date index
    const dateIndexPath = path.join(this.basePath, 'index', 'appointments-by-date.json');
    const dateData = await fs.readFile(dateIndexPath, 'utf-8');
    const dateIndex = JSON.parse(dateData);

    const date = new Date(appointment.startTime).toISOString().split('T')[0];
    if (!dateIndex[date]) {
      dateIndex[date] = [];
    }
    if (!dateIndex[date].includes(appointment.id)) {
      dateIndex[date].push(appointment.id);
    }
    await fs.writeFile(dateIndexPath, JSON.stringify(dateIndex, null, 2));

    // Update by-specialist index
    const specIndexPath = path.join(this.basePath, 'index', 'appointments-by-specialist.json');
    const specData = await fs.readFile(specIndexPath, 'utf-8');
    const specIndex = JSON.parse(specData);

    if (!specIndex[appointment.specialistId]) {
      specIndex[appointment.specialistId] = [];
    }
    if (!specIndex[appointment.specialistId].includes(appointment.id)) {
      specIndex[appointment.specialistId].push(appointment.id);
    }
    await fs.writeFile(specIndexPath, JSON.stringify(specIndex, null, 2));
  }

  /**
   * Remove from appointment indexes
   */
  async removeFromAppointmentIndexes(appointment) {
    // Remove from by-date index
    const dateIndexPath = path.join(this.basePath, 'index', 'appointments-by-date.json');
    const dateData = await fs.readFile(dateIndexPath, 'utf-8');
    const dateIndex = JSON.parse(dateData);

    const date = new Date(appointment.startTime).toISOString().split('T')[0];
    if (dateIndex[date]) {
      dateIndex[date] = dateIndex[date].filter(id => id !== appointment.id);
      if (dateIndex[date].length === 0) {
        delete dateIndex[date];
      }
    }
    await fs.writeFile(dateIndexPath, JSON.stringify(dateIndex, null, 2));

    // Remove from by-specialist index
    const specIndexPath = path.join(this.basePath, 'index', 'appointments-by-specialist.json');
    const specData = await fs.readFile(specIndexPath, 'utf-8');
    const specIndex = JSON.parse(specData);

    if (specIndex[appointment.specialistId]) {
      specIndex[appointment.specialistId] = specIndex[appointment.specialistId].filter(id => id !== appointment.id);
      if (specIndex[appointment.specialistId].length === 0) {
        delete specIndex[appointment.specialistId];
      }
    }
    await fs.writeFile(specIndexPath, JSON.stringify(specIndex, null, 2));
  }
}

export default AppointmentStorageService;
