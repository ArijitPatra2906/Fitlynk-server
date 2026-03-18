/**
 * Timezone utilities for IST (Indian Standard Time)
 * All dates in the system should be handled in IST timezone
 */

/**
 * Get current date/time in IST
 */
export function getISTDate(): Date {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

/**
 * Get current IST date in YYYY-MM-DD format
 */
export function getISTDateString(): string {
  const istDate = getISTDate();
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current IST time in HH:MM format
 */
export function getISTTimeString(): string {
  const istDate = getISTDate();
  const hours = String(istDate.getHours()).padStart(2, '0');
  const minutes = String(istDate.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Get start of day in IST
 */
export function getISTStartOfDay(date?: Date): Date {
  const istDate = date ? new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })) : getISTDate();
  istDate.setHours(0, 0, 0, 0);
  return istDate;
}

/**
 * Get end of day in IST
 */
export function getISTEndOfDay(date?: Date): Date {
  const istDate = date ? new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })) : getISTDate();
  istDate.setHours(23, 59, 59, 999);
  return istDate;
}

/**
 * Convert a date string (YYYY-MM-DD) to IST Date object at start of day
 */
export function dateStringToISTDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  // Create date in IST timezone
  const istDateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`;
  return new Date(new Date(istDateString).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

/**
 * Get IST hour (0-23)
 */
export function getISTHour(): number {
  return getISTDate().getHours();
}

/**
 * Get IST minute (0-59)
 */
export function getISTMinute(): number {
  return getISTDate().getMinutes();
}

/**
 * Check if a given time string (HH:MM) matches current IST time
 */
export function isCurrentISTTime(timeString: string): boolean {
  const currentTime = getISTTimeString();
  return currentTime === timeString;
}

/**
 * Get date range for today in IST (for DB queries)
 */
export function getTodayISTRange(): { start: Date; end: Date } {
  return {
    start: getISTStartOfDay(),
    end: getISTEndOfDay(),
  };
}
