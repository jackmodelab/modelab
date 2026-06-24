/**
 * Google Calendar API (v3) — event create/delete via native fetch.
 *
 * Events are written to the connected coach's `primary` calendar. We send
 * updates to attendees (`sendUpdates=all`) so the client receives an email
 * invite with reminders.
 */
import { refreshAccessToken } from './oauth';

const CALENDAR_ID = 'primary';
const EVENTS_BASE = `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events`;

// MODE Lab operates in Australia; render event times in this zone. Bookings are
// stored as UTC timestamptz, so the dateTime carries the offset and the zone is
// for display/DST correctness.
export const DEFAULT_TIME_ZONE = 'Australia/Sydney';

export type CalendarEventInput = {
  summary: string;
  description?: string;
  location?: string;
  /** ISO 8601 start (e.g. the booking's starts_at). */
  startIso: string;
  /** ISO 8601 end. */
  endIso: string;
  /** Attendees to invite (e.g. the client). */
  attendees?: { email: string; displayName?: string }[];
  timeZone?: string;
};

/**
 * Create an event on the coach's primary calendar. Returns the Google event id
 * (store it on the booking so we can update/cancel later).
 */
export async function createCalendarEvent(
  refreshToken: string,
  input: CalendarEventInput
): Promise<string> {
  const accessToken = await refreshAccessToken(refreshToken);
  const body = {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: input.startIso, timeZone: input.timeZone ?? DEFAULT_TIME_ZONE },
    end: { dateTime: input.endIso, timeZone: input.timeZone ?? DEFAULT_TIME_ZONE },
    attendees: input.attendees,
  };

  const res = await fetch(`${EVENTS_BASE}?sendUpdates=all`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Calendar event create failed (${res.status})`);
  }
  const event = (await res.json()) as { id: string };
  return event.id;
}

/**
 * Update an existing event (used on reschedule / detail changes). Returns true
 * on success, false if the event no longer exists (404/410) so the caller can
 * recreate it.
 */
export async function updateCalendarEvent(
  refreshToken: string,
  eventId: string,
  input: CalendarEventInput
): Promise<boolean> {
  const accessToken = await refreshAccessToken(refreshToken);
  const body = {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: input.startIso, timeZone: input.timeZone ?? DEFAULT_TIME_ZONE },
    end: { dateTime: input.endIso, timeZone: input.timeZone ?? DEFAULT_TIME_ZONE },
    attendees: input.attendees,
  };

  const res = await fetch(`${EVENTS_BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (res.status === 404 || res.status === 410) return false;
  if (!res.ok) {
    throw new Error(`Calendar event update failed (${res.status})`);
  }
  return true;
}

/**
 * Delete an event from the coach's primary calendar (used on cancellation).
 * Treats a 404/410 as success — the event is already gone.
 */
export async function deleteCalendarEvent(refreshToken: string, eventId: string): Promise<void> {
  const accessToken = await refreshAccessToken(refreshToken);
  const res = await fetch(`${EVENTS_BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Calendar event delete failed (${res.status})`);
  }
}
