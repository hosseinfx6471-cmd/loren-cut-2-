// Persian Date Utilities for Loren Cut Booking System

const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند'
];

const PERSIAN_WEEKDAYS: { [key: number]: string } = {
  0: 'یکشنبه',
  1: 'دوشنبه',
  2: 'سه‌شنبه',
  3: 'چهارشنبه',
  4: 'پنج‌شنبه',
  5: 'جمعه',
  6: 'شنبه' // Saturday
};

export function toPersianDigits(num?: number | string | null): string {
  if (num === undefined || num === null) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
}

export interface AvailableDate {
  dateStr: string; // YYYY-MM-DD
  dayName: string; // e.g. "پنج‌شنبه ۳ مرداد"
  fullLabel: string; // e.g. "امروز - چهارشنبه ۲ مرداد"
  isToday: boolean;
  isSaturday: boolean;
  dayOfWeek: number;
}

/**
 * Calculates available booking dates starting from today for the next 3 days.
 * AUTOMATICALLY EXCLUDES SATURDAYS (شنبه).
 */
export function getAvailableBookingDates(): AvailableDate[] {
  const dates: AvailableDate[] = [];
  const today = new Date();
  
  let checkCount = 0;
  let offset = 0;

  // We want to give up to 3 or 4 bookable days excluding Saturday
  while (dates.length < 3 && checkCount < 7) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);

    const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
    const isSaturday = dayOfWeek === 6;

    if (!isSaturday) {
      // Convert to Jalali / Persian date representation using Intl
      const formatter = new Intl.DateTimeFormat('fa-IR', {
        day: 'numeric',
        month: 'long',
        weekday: 'long'
      });
      
      const formattedParts = formatter.formatToParts(d);
      let dayStr = '';
      let monthStr = '';
      let weekdayStr = PERSIAN_WEEKDAYS[dayOfWeek];

      formattedParts.forEach(p => {
        if (p.type === 'day') dayStr = p.value;
        if (p.type === 'month') monthStr = p.value;
        if (p.type === 'weekday') weekdayStr = p.value;
      });

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const dayLabel = `${weekdayStr} ${dayStr} ${monthStr}`;
      const isToday = offset === 0;
      const prefix = isToday ? 'امروز - ' : offset === 1 ? 'فردا - ' : '';

      dates.push({
        dateStr,
        dayName: dayLabel,
        fullLabel: `${prefix}${dayLabel}`,
        isToday,
        isSaturday: false,
        dayOfWeek
      });
    }

    offset++;
    checkCount++;
  }

  return dates;
}

/**
 * Returns upcoming bookable dates for the admin management UI (default: next 7 bookable days)
 */
export function getUpcomingDates(daysCount = 7): AvailableDate[] {
  const dates: AvailableDate[] = [];
  const today = new Date();
  
  let offset = 0;
  let safety = 0;

  while (dates.length < daysCount && safety < 14) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);

    const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
    const isSaturday = dayOfWeek === 6;

    if (!isSaturday) {
      const formatter = new Intl.DateTimeFormat('fa-IR', {
        day: 'numeric',
        month: 'long',
        weekday: 'long'
      });
      
      const formattedParts = formatter.formatToParts(d);
      let dayStr = '';
      let monthStr = '';
      let weekdayStr = PERSIAN_WEEKDAYS[dayOfWeek];

      formattedParts.forEach(p => {
        if (p.type === 'day') dayStr = p.value;
        if (p.type === 'month') monthStr = p.value;
        if (p.type === 'weekday') weekdayStr = p.value;
      });

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const dayLabel = `${weekdayStr} ${dayStr} ${monthStr}`;
      const isToday = offset === 0;
      const prefix = isToday ? 'امروز - ' : offset === 1 ? 'فردا - ' : '';

      dates.push({
        dateStr,
        dayName: dayLabel,
        fullLabel: `${prefix}${dayLabel}`,
        isToday,
        isSaturday: false,
        dayOfWeek
      });
    }

    offset++;
    safety++;
  }

  return dates;
}

/**
 * Generates available hourly slots from 11:00 AM to 7:00 PM (11 تا 19)
 */
export function getAvailableTimeSlots(): string[] {
  return [
    '11:00',
    '11:45',
    '12:30',
    '13:15',
    '14:00',
    '14:45',
    '15:30',
    '16:15',
    '17:00',
    '17:45',
    '18:30',
    '19:15'
  ];
}

export function generateTrackingCode(): string {
  const chars = '1234567890';
  let code = 'LC-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Returns today's date in standard YYYY-MM-DD string format (Local Time)
 */
export function getTodayDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a given date string (YYYY-MM-DD) is strictly in the past (before today)
 */
export function isPastDate(dateStr?: string): boolean {
  if (!dateStr) return false;
  const todayStr = getTodayDateStr();
  return dateStr < todayStr;
}

/**
 * Checks if an appointment is considered past/archived
 */
export function isAppointmentPast(app: { dateStr?: string; archived?: boolean; status?: string }): boolean {
  if (app.archived === true || app.status === 'archived') {
    return true;
  }
  if (app.dateStr && isPastDate(app.dateStr)) {
    return true;
  }
  return false;
}

/**
 * Automatically transitions all past appointments (where date is before today) into archived status
 */
export function autoArchivePastAppointments<T extends { dateStr?: string; archived?: boolean; archivedAt?: string; status?: string }>(
  appointments: T[]
): { updatedAppointments: T[]; hasChanges: boolean } {
  const todayStr = getTodayDateStr();
  const nowPersian = new Date().toLocaleDateString('fa-IR') + ' - ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  let hasChanges = false;

  const updatedAppointments = appointments.map((app) => {
    // If appointment has a past date and is not yet archived
    if (app.dateStr && app.dateStr < todayStr && !app.archived && app.status !== 'archived') {
      hasChanges = true;
      return {
        ...app,
        archived: true,
        archivedAt: app.archivedAt || nowPersian,
      };
    }
    return app;
  });

  return { updatedAppointments, hasChanges };
}

