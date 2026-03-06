/**
 * Calendar Utilities
 *
 * Utilities for calendar operations, timezone handling, and iCalendar export
 */

/**
 * Common timezones list
 */
export const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Kiev', label: 'Киев (UTC+2)' },
  { value: 'Europe/Minsk', label: 'Минск (UTC+3)' },
  { value: 'Europe/London', label: 'Лондон (UTC+0)' },
  { value: 'Europe/Paris', label: 'Париж (UTC+1)' },
  { value: 'Europe/Berlin', label: 'Берлин (UTC+1)' },
  { value: 'America/New_York', label: 'Нью-Йорк (UTC-5)' },
  { value: 'America/Los_Angeles', label: 'Лос-Анджелес (UTC-8)' },
  { value: 'America/Chicago', label: 'Чикаго (UTC-6)' },
  { value: 'Asia/Tokyo', label: 'Токио (UTC+9)' },
  { value: 'Asia/Shanghai', label: 'Шанхай (UTC+8)' },
  { value: 'Asia/Dubai', label: 'Дубай (UTC+4)' },
  { value: 'Australia/Sydney', label: 'Сидней (UTC+11)' }
];

/**
 * Get user's timezone
 */
export function getUserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (error) {
    return 'UTC';
  }
}

/**
 * Format date in timezone
 *
 * @param {Date|string} date - Date to format
 * @param {string} timezone - Timezone
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDateInTimezone(date, timezone = 'UTC', options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone
  };

  return new Date(date).toLocaleString('ru-RU', { ...defaultOptions, ...options });
}

/**
 * Convert date to ISO string in timezone
 *
 * @param {Date} date - Date object
 * @param {string} timezone - Timezone
 * @returns {string} ISO 8601 string
 */
export function dateToISOInTimezone(date, timezone) {
  // Note: This is a simplified version. For production, use a library like date-fns-tz or luxon
  return date.toISOString();
}

/**
 * Generate iCalendar (.ics) file content
 *
 * @param {Object} meeting - Meeting object
 * @returns {string} iCalendar content
 */
export function generateICalendar(meeting) {
  const {
    title,
    description = '',
    startTime,
    endTime,
    joinUrl,
    organizerEmail,
    organizerName = 'Организатор'
  } = meeting;

  // Format dates for iCal (YYYYMMDDTHHMMSSZ)
  const formatICalDate = (dateStr) => {
    return new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const uid = `${meeting.id}@drondoc.ru`;
  const dtstamp = formatICalDate(new Date().toISOString());
  const dtstart = formatICalDate(startTime);
  const dtend = formatICalDate(endTime);

  const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//DronDoc//Video Conference Scheduler//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
DTSTART:${dtstart}
DTEND:${dtend}
DTSTAMP:${dtstamp}
ORGANIZER;CN=${organizerName}:mailto:${organizerEmail}
UID:${uid}
SUMMARY:${title}
DESCRIPTION:${description}\\n\\nПрисоединиться: ${joinUrl}
LOCATION:${joinUrl}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

  return icalContent;
}

/**
 * Download iCalendar file
 *
 * @param {Object} meeting - Meeting object
 * @param {string} filename - File name (default: meeting title)
 */
export function downloadICalendar(meeting, filename) {
  const icalContent = generateICalendar(meeting);
  const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${meeting.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Add to Google Calendar URL
 *
 * @param {Object} meeting - Meeting object
 * @returns {string} Google Calendar URL
 */
export function getGoogleCalendarUrl(meeting) {
  const { title, description, startTime, endTime, joinUrl } = meeting;

  const formatGoogleDate = (dateStr) => {
    return new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    details: `${description || ''}\n\nПрисоединиться: ${joinUrl}`,
    location: joinUrl,
    dates: `${formatGoogleDate(startTime)}/${formatGoogleDate(endTime)}`
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Add to Outlook Calendar URL
 *
 * @param {Object} meeting - Meeting object
 * @returns {string} Outlook Calendar URL
 */
export function getOutlookCalendarUrl(meeting) {
  const { title, description, startTime, endTime, joinUrl } = meeting;

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: title,
    body: `${description || ''}\n\nПрисоединиться: ${joinUrl}`,
    location: joinUrl,
    startdt: new Date(startTime).toISOString(),
    enddt: new Date(endTime).toISOString()
  });

  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Calculate meeting duration in minutes
 *
 * @param {string} startTime - Start time (ISO 8601)
 * @param {string} endTime - End time (ISO 8601)
 * @returns {number} Duration in minutes
 */
export function calculateDuration(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return Math.round((end - start) / (1000 * 60));
}

/**
 * Format duration as human-readable string
 *
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration
 */
export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins} мин`;
  } else if (mins === 0) {
    return `${hours} ч`;
  } else {
    return `${hours} ч ${mins} мин`;
  }
}

/**
 * Check if meeting is happening now
 *
 * @param {string} startTime - Start time (ISO 8601)
 * @param {string} endTime - End time (ISO 8601)
 * @returns {boolean} True if meeting is in progress
 */
export function isMeetingNow(startTime, endTime) {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);
  return now >= start && now <= end;
}

/**
 * Check if meeting is upcoming (within next hour)
 *
 * @param {string} startTime - Start time (ISO 8601)
 * @returns {boolean} True if meeting starts within next hour
 */
export function isMeetingUpcoming(startTime) {
  const now = new Date();
  const start = new Date(startTime);
  const oneHour = 60 * 60 * 1000;
  return start > now && (start - now) <= oneHour;
}

/**
 * Check if meeting is in the past
 *
 * @param {string} endTime - End time (ISO 8601)
 * @returns {boolean} True if meeting has ended
 */
export function isMeetingPast(endTime) {
  const now = new Date();
  const end = new Date(endTime);
  return end < now;
}

/**
 * Get meeting status based on time
 *
 * @param {string} startTime - Start time (ISO 8601)
 * @param {string} endTime - End time (ISO 8601)
 * @param {string} status - Scheduled status
 * @returns {string} Status: 'upcoming', 'now', 'past', 'cancelled'
 */
export function getMeetingStatus(startTime, endTime, status = 'scheduled') {
  if (status === 'cancelled') return 'cancelled';
  if (isMeetingNow(startTime, endTime)) return 'now';
  if (isMeetingPast(endTime)) return 'past';
  return 'upcoming';
}

/**
 * Get status color for badge/chip
 *
 * @param {string} status - Meeting status
 * @returns {string} Color name for PrimeVue severity
 */
export function getStatusColor(status) {
  switch (status) {
    case 'now':
      return 'success';
    case 'upcoming':
      return 'info';
    case 'past':
      return 'secondary';
    case 'cancelled':
      return 'danger';
    default:
      return 'info';
  }
}

/**
 * Get status label
 *
 * @param {string} status - Meeting status
 * @returns {string} Human-readable status label
 */
export function getStatusLabel(status) {
  switch (status) {
    case 'now':
      return 'Сейчас';
    case 'upcoming':
      return 'Предстоящая';
    case 'past':
      return 'Завершена';
    case 'cancelled':
      return 'Отменена';
    default:
      return 'Запланирована';
  }
}

/**
 * Parse recurrence pattern to human-readable text
 *
 * @param {string} pattern - Recurrence pattern
 * @returns {string} Human-readable recurrence description
 */
export function getRecurrenceLabel(pattern) {
  switch (pattern) {
    case 'none':
      return 'Не повторяется';
    case 'daily':
      return 'Ежедневно';
    case 'weekly':
      return 'Еженедельно';
    case 'monthly':
      return 'Ежемесячно';
    case 'custom':
      return 'Пользовательское расписание';
    default:
      return 'Не повторяется';
  }
}

export default {
  TIMEZONES,
  getUserTimezone,
  formatDateInTimezone,
  dateToISOInTimezone,
  generateICalendar,
  downloadICalendar,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
  calculateDuration,
  formatDuration,
  isMeetingNow,
  isMeetingUpcoming,
  isMeetingPast,
  getMeetingStatus,
  getStatusColor,
  getStatusLabel,
  getRecurrenceLabel
};
