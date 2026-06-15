/**
 * Shared booking time helpers.
 *
 * Slot maths (duration, changeover buffer, clinic-timezone weekday/minute) was
 * previously re-implemented in `lib/account/actions.ts` and partially in
 * `lib/portal/actions.ts`. Centralising it here keeps the member auto-confirm
 * path and the staff paths from drifting, and is a prerequisite for ever
 * supporting a second location/timezone (ARC-3).
 */

/** The clinic's wall-clock timezone. Availability is stored as clinic local time. */
export const CLINIC_TZ = 'Australia/Sydney';

/** Fallback session length when a service row has no `duration_minutes`. */
export const DEFAULT_DURATION_MINUTES = 45;

/** Minutes since midnight for a 'HH:MM' / 'HH:MM:SS' time string. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Changeover buffer (minutes) reserved after a session before the next slot can
 * open. Mirrors `bufferFor` in the booking UI: the 30- and 45-minute training
 * sessions carry a 15-minute buffer; other services get none.
 */
export function bufferFor(durationMinutes: number): number {
  return durationMinutes === 30 || durationMinutes === 45 ? 15 : 0;
}

/**
 * Weekday (0=Sun..6=Sat) and minute-of-day for an instant, evaluated in the
 * clinic's timezone. Availability is stored as clinic wall-clock time, so we
 * must compare against the same zone — not the server's (UTC on Vercel).
 */
export function clinicWeekdayMinute(date: Date): { weekday: number; minute: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: CLINIC_TZ,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = Number(parts.hour) % 24; // some runtimes emit '24' at midnight
  return { weekday: weekdays[parts.weekday] ?? -1, minute: hour * 60 + Number(parts.minute) };
}
