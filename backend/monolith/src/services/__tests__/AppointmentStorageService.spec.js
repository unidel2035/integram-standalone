// AppointmentStorageService.spec.js - Unit tests for AppointmentStorageService
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppointmentStorageService } from '../AppointmentStorageService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AppointmentStorageService', () => {
  let storage;
  const testBasePath = path.join(__dirname, 'test-appointment-data');

  beforeEach(async () => {
    // Create service with test base path
    storage = new AppointmentStorageService({ basePath: testBasePath });
    await storage.initialize();
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.rm(testBasePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    it('should create required directories', async () => {
      const dirs = [
        testBasePath,
        path.join(testBasePath, 'specialists'),
        path.join(testBasePath, 'services'),
        path.join(testBasePath, 'appointments'),
        path.join(testBasePath, 'index')
      ];

      for (const dir of dirs) {
        const stats = await fs.stat(dir);
        expect(stats.isDirectory()).toBe(true);
      }
    });

    it('should create index files', async () => {
      const indexFiles = [
        'specialists-index.json',
        'services-index.json',
        'appointments-by-date.json',
        'appointments-by-specialist.json'
      ];

      for (const file of indexFiles) {
        const filePath = path.join(testBasePath, 'index', file);
        const stats = await fs.stat(filePath);
        expect(stats.isFile()).toBe(true);
      }
    });
  });

  describe('Specialist Operations', () => {
    it('should save a specialist', async () => {
      const specialist = {
        id: 'spec_1',
        name: 'Dr. Test',
        email: 'test@example.com',
        specialty: 'General',
        isActive: true
      };

      const saved = await storage.saveSpecialist(specialist);
      expect(saved).toEqual(specialist);

      // Verify file exists
      const filePath = path.join(testBasePath, 'specialists', 'spec_1.json');
      const stats = await fs.stat(filePath);
      expect(stats.isFile()).toBe(true);
    });

    it('should get a specialist by ID', async () => {
      const specialist = {
        id: 'spec_2',
        name: 'Dr. Test 2',
        email: 'test2@example.com'
      };

      await storage.saveSpecialist(specialist);
      const retrieved = await storage.getSpecialist('spec_2');

      expect(retrieved).toEqual(specialist);
    });

    it('should return null for non-existent specialist', async () => {
      const retrieved = await storage.getSpecialist('non_existent');
      expect(retrieved).toBeNull();
    });

    it('should get all specialists', async () => {
      await storage.saveSpecialist({ id: 'spec_1', name: 'Spec 1' });
      await storage.saveSpecialist({ id: 'spec_2', name: 'Spec 2' });

      const all = await storage.getAllSpecialists();
      expect(all).toHaveLength(2);
      expect(all.map(s => s.id)).toContain('spec_1');
      expect(all.map(s => s.id)).toContain('spec_2');
    });

    it('should delete a specialist', async () => {
      await storage.saveSpecialist({ id: 'spec_3', name: 'Spec 3' });

      const deleted = await storage.deleteSpecialist('spec_3');
      expect(deleted).toBe(true);

      const retrieved = await storage.getSpecialist('spec_3');
      expect(retrieved).toBeNull();
    });

    it('should update specialist index', async () => {
      await storage.saveSpecialist({ id: 'spec_4', name: 'Spec 4' });

      const indexPath = path.join(testBasePath, 'index', 'specialists-index.json');
      const indexData = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexData);

      expect(index).toContain('spec_4');
    });
  });

  describe('Service Operations', () => {
    it('should save a service', async () => {
      const service = {
        id: 'svc_1',
        name: 'Consultation',
        duration: 60,
        price: 100
      };

      const saved = await storage.saveService(service);
      expect(saved).toEqual(service);
    });

    it('should get a service by ID', async () => {
      const service = {
        id: 'svc_2',
        name: 'Checkup',
        duration: 30
      };

      await storage.saveService(service);
      const retrieved = await storage.getService('svc_2');

      expect(retrieved).toEqual(service);
    });

    it('should get all services', async () => {
      await storage.saveService({ id: 'svc_1', name: 'Service 1' });
      await storage.saveService({ id: 'svc_2', name: 'Service 2' });

      const all = await storage.getAllServices();
      expect(all).toHaveLength(2);
    });

    it('should delete a service', async () => {
      await storage.saveService({ id: 'svc_3', name: 'Service 3' });

      const deleted = await storage.deleteService('svc_3');
      expect(deleted).toBe(true);

      const retrieved = await storage.getService('svc_3');
      expect(retrieved).toBeNull();
    });
  });

  describe('Appointment Operations', () => {
    it('should save an appointment', async () => {
      const appointment = {
        id: 'apt_1',
        specialistId: 'spec_1',
        serviceId: 'svc_1',
        clientEmail: 'client@example.com',
        startTime: '2025-11-15T10:00:00Z',
        endTime: '2025-11-15T11:00:00Z',
        status: 'confirmed'
      };

      const saved = await storage.saveAppointment(appointment);
      expect(saved).toEqual(appointment);
    });

    it('should get an appointment by ID', async () => {
      const appointment = {
        id: 'apt_2',
        specialistId: 'spec_1',
        startTime: '2025-11-15T12:00:00Z',
        endTime: '2025-11-15T13:00:00Z'
      };

      await storage.saveAppointment(appointment);
      const retrieved = await storage.getAppointment('apt_2');

      expect(retrieved).toEqual(appointment);
    });

    it('should get appointments by date', async () => {
      await storage.saveAppointment({
        id: 'apt_3',
        specialistId: 'spec_1',
        startTime: '2025-11-15T10:00:00Z',
        endTime: '2025-11-15T11:00:00Z'
      });

      await storage.saveAppointment({
        id: 'apt_4',
        specialistId: 'spec_2',
        startTime: '2025-11-15T14:00:00Z',
        endTime: '2025-11-15T15:00:00Z'
      });

      const appointments = await storage.getAppointmentsByDate('2025-11-15');
      expect(appointments).toHaveLength(2);
    });

    it('should get appointments by specialist', async () => {
      await storage.saveAppointment({
        id: 'apt_5',
        specialistId: 'spec_1',
        startTime: '2025-11-16T10:00:00Z',
        endTime: '2025-11-16T11:00:00Z'
      });

      await storage.saveAppointment({
        id: 'apt_6',
        specialistId: 'spec_1',
        startTime: '2025-11-16T14:00:00Z',
        endTime: '2025-11-16T15:00:00Z'
      });

      const appointments = await storage.getAppointmentsBySpecialist('spec_1');
      expect(appointments).toHaveLength(2);
    });

    it('should get appointments for a specific day and specialist', async () => {
      await storage.saveAppointment({
        id: 'apt_7',
        specialistId: 'spec_1',
        startTime: '2025-11-17T10:00:00Z',
        endTime: '2025-11-17T11:00:00Z'
      });

      await storage.saveAppointment({
        id: 'apt_8',
        specialistId: 'spec_2',
        startTime: '2025-11-17T10:00:00Z',
        endTime: '2025-11-17T11:00:00Z'
      });

      const appointments = await storage.getAppointmentsForDay('spec_1', '2025-11-17');
      expect(appointments).toHaveLength(1);
      expect(appointments[0].id).toBe('apt_7');
    });

    it('should get appointments by client email', async () => {
      await storage.saveAppointment({
        id: 'apt_9',
        clientEmail: 'client@example.com',
        specialistId: 'spec_1',
        startTime: '2025-11-18T10:00:00Z',
        endTime: '2025-11-18T11:00:00Z'
      });

      const appointments = await storage.getAppointmentsByClient('client@example.com');
      expect(appointments).toHaveLength(1);
      expect(appointments[0].id).toBe('apt_9');
    });

    it('should delete an appointment', async () => {
      await storage.saveAppointment({
        id: 'apt_10',
        specialistId: 'spec_1',
        startTime: '2025-11-19T10:00:00Z',
        endTime: '2025-11-19T11:00:00Z'
      });

      const deleted = await storage.deleteAppointment('apt_10');
      expect(deleted).toBe(true);

      const retrieved = await storage.getAppointment('apt_10');
      expect(retrieved).toBeNull();
    });

    it('should update appointment indexes on save', async () => {
      await storage.saveAppointment({
        id: 'apt_11',
        specialistId: 'spec_1',
        startTime: '2025-11-20T10:00:00Z',
        endTime: '2025-11-20T11:00:00Z'
      });

      // Check by-date index
      const dateIndexPath = path.join(testBasePath, 'index', 'appointments-by-date.json');
      const dateData = await fs.readFile(dateIndexPath, 'utf-8');
      const dateIndex = JSON.parse(dateData);
      expect(dateIndex['2025-11-20']).toContain('apt_11');

      // Check by-specialist index
      const specIndexPath = path.join(testBasePath, 'index', 'appointments-by-specialist.json');
      const specData = await fs.readFile(specIndexPath, 'utf-8');
      const specIndex = JSON.parse(specData);
      expect(specIndex['spec_1']).toContain('apt_11');
    });

    it('should remove from indexes on delete', async () => {
      await storage.saveAppointment({
        id: 'apt_12',
        specialistId: 'spec_1',
        startTime: '2025-11-21T10:00:00Z',
        endTime: '2025-11-21T11:00:00Z'
      });

      await storage.deleteAppointment('apt_12');

      const dateIndexPath = path.join(testBasePath, 'index', 'appointments-by-date.json');
      const dateData = await fs.readFile(dateIndexPath, 'utf-8');
      const dateIndex = JSON.parse(dateData);
      expect(dateIndex['2025-11-21'] || []).not.toContain('apt_12');
    });
  });
});
