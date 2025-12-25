// CalendarService.spec.js - Unit tests for CalendarService
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalendarService } from '../CalendarService.js';

describe('CalendarService', () => {
  let calendarService;
  let mockStorageService;

  beforeEach(() => {
    // Create mock storage service
    mockStorageService = {
      getSpecialist: vi.fn(),
      getService: vi.fn(),
      getAppointmentsForDay: vi.fn()
    };

    calendarService = new CalendarService({
      storageService: mockStorageService,
      slotDuration: 15
    });
  });

  describe('getDayOfWeek', () => {
    it('should return correct day of week', () => {
      const monday = new Date('2025-11-17'); // Monday
      const friday = new Date('2025-11-21'); // Friday
      const sunday = new Date('2025-11-16'); // Sunday

      expect(calendarService.getDayOfWeek(monday)).toBe('monday');
      expect(calendarService.getDayOfWeek(friday)).toBe('friday');
      expect(calendarService.getDayOfWeek(sunday)).toBe('sunday');
    });
  });

  describe('generateSlotsForDay', () => {
    it('should generate slots for working hours', () => {
      const workingHours = {
        start: '09:00',
        end: '12:00',
        breaks: []
      };

      const slots = calendarService.generateSlotsForDay(
        '2025-11-17',
        workingHours,
        60,
        'Europe/Moscow'
      );

      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0].duration).toBe(60);
    });

    it('should exclude break periods', () => {
      const workingHours = {
        start: '09:00',
        end: '13:00',
        breaks: [{ start: '11:00', end: '12:00' }]
      };

      const slots = calendarService.generateSlotsForDay(
        '2025-11-17',
        workingHours,
        60,
        'Europe/Moscow'
      );

      // Should have 2 slots: 09:00-10:00 and 12:00-13:00
      // (10:00-11:00 is excluded because it overlaps with break)
      expect(slots.length).toBe(2);
    });

    it('should respect slot duration', () => {
      const workingHours = {
        start: '09:00',
        end: '10:00',
        breaks: []
      };

      const slots30 = calendarService.generateSlotsForDay(
        '2025-11-17',
        workingHours,
        30,
        'Europe/Moscow'
      );

      const slots60 = calendarService.generateSlotsForDay(
        '2025-11-17',
        workingHours,
        60,
        'Europe/Moscow'
      );

      expect(slots30.length).toBe(2); // 09:00-09:30, 09:30-10:00
      expect(slots60.length).toBe(1); // 09:00-10:00
    });
  });

  describe('filterAvailableSlots', () => {
    it('should filter out past slots', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const allSlots = [
        {
          time: yesterday.toISOString(),
          endTime: new Date(yesterday.getTime() + 60 * 60 * 1000).toISOString(),
          duration: 60
        }
      ];

      const available = calendarService.filterAvailableSlots(allSlots, [], 60);
      expect(available.length).toBe(0);
    });

    it('should filter out conflicting slots', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const allSlots = [
        {
          time: tomorrow.toISOString(),
          endTime: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
          duration: 60
        }
      ];

      const appointments = [
        {
          id: 'apt_1',
          startTime: tomorrow.toISOString(),
          endTime: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
          status: 'confirmed'
        }
      ];

      const available = calendarService.filterAvailableSlots(allSlots, appointments, 60);
      expect(available.length).toBe(0);
    });

    it('should not filter cancelled appointments', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const allSlots = [
        {
          time: tomorrow.toISOString(),
          endTime: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
          duration: 60
        }
      ];

      const appointments = [
        {
          id: 'apt_1',
          startTime: tomorrow.toISOString(),
          endTime: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
          status: 'cancelled'
        }
      ];

      const available = calendarService.filterAvailableSlots(allSlots, appointments, 60);
      expect(available.length).toBe(1);
    });
  });

  describe('checkAvailability', () => {
    it('should return true for available slot', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const startTime = tomorrow.toISOString();
      const endTime = new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString();

      mockStorageService.getAppointmentsForDay.mockResolvedValue([]);

      const available = await calendarService.checkAvailability('spec_1', startTime, endTime);
      expect(available).toBe(true);
    });

    it('should return false for conflicting slot', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const startTime = tomorrow.toISOString();
      const endTime = new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString();

      mockStorageService.getAppointmentsForDay.mockResolvedValue([
        {
          id: 'apt_1',
          startTime,
          endTime,
          status: 'confirmed'
        }
      ]);

      const available = await calendarService.checkAvailability('spec_1', startTime, endTime);
      expect(available).toBe(false);
    });

    it('should ignore cancelled appointments', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const startTime = tomorrow.toISOString();
      const endTime = new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString();

      mockStorageService.getAppointmentsForDay.mockResolvedValue([
        {
          id: 'apt_1',
          startTime,
          endTime,
          status: 'cancelled'
        }
      ]);

      const available = await calendarService.checkAvailability('spec_1', startTime, endTime);
      expect(available).toBe(true);
    });

    it('should detect partial overlaps', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const startTime = tomorrow.toISOString();
      const endTime = new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString();

      // Existing appointment: 09:30 - 10:30
      const existingStart = new Date(tomorrow.getTime() - 30 * 60 * 1000).toISOString();
      const existingEnd = new Date(tomorrow.getTime() + 30 * 60 * 1000).toISOString();

      mockStorageService.getAppointmentsForDay.mockResolvedValue([
        {
          id: 'apt_1',
          startTime: existingStart,
          endTime: existingEnd,
          status: 'confirmed'
        }
      ]);

      const available = await calendarService.checkAvailability('spec_1', startTime, endTime);
      expect(available).toBe(false);
    });
  });

  describe('getAvailableSlots', () => {
    it('should return empty array for inactive specialist', async () => {
      mockStorageService.getSpecialist.mockResolvedValue({
        id: 'spec_1',
        isActive: false
      });

      const slots = await calendarService.getAvailableSlots('spec_1', '2025-11-17');
      expect(slots).toEqual([]);
    });

    it('should return empty array for disabled day', async () => {
      mockStorageService.getSpecialist.mockResolvedValue({
        id: 'spec_1',
        isActive: true,
        workingHours: {
          monday: { enabled: false }
        },
        holidays: []
      });

      const slots = await calendarService.getAvailableSlots('spec_1', '2025-11-17'); // Monday
      expect(slots).toEqual([]);
    });

    it('should return empty array for holidays', async () => {
      mockStorageService.getSpecialist.mockResolvedValue({
        id: 'spec_1',
        isActive: true,
        workingHours: {
          monday: { enabled: true, start: '09:00', end: '17:00', breaks: [] }
        },
        holidays: ['2025-11-17']
      });

      const slots = await calendarService.getAvailableSlots('spec_1', '2025-11-17');
      expect(slots).toEqual([]);
    });

    it('should return available slots for working day', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const dayOfWeek = calendarService.getDayOfWeek(tomorrow);

      mockStorageService.getSpecialist.mockResolvedValue({
        id: 'spec_1',
        isActive: true,
        timezone: 'Europe/Moscow',
        workingHours: {
          [dayOfWeek]: { enabled: true, start: '09:00', end: '10:00', breaks: [] }
        },
        holidays: []
      });

      mockStorageService.getService.mockResolvedValue({
        id: 'svc_1',
        duration: 60
      });

      mockStorageService.getAppointmentsForDay.mockResolvedValue([]);

      const slots = await calendarService.getAvailableSlots('spec_1', tomorrowStr, 'svc_1');
      expect(slots.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent specialist', async () => {
      mockStorageService.getSpecialist.mockResolvedValue(null);

      await expect(
        calendarService.getAvailableSlots('non_existent', '2025-11-17')
      ).rejects.toThrow('Specialist not found');
    });
  });
});
