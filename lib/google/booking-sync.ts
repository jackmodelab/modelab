/**
 * Booking ↔ Google Calendar sync.
 *
 * Bridges a `bookings` row to the coach's Google Calendar. All reads/writes use
 * the service-role admin client because (a) coach refresh tokens are only
 * accessible server-side, and (b) member-initiated bookings have no RLS insert
 * path. Every function is best-effort: a calendar failure is logged and
 * swallowed so it never breaks the booking itself.
 */
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { googleConfigured } from './oauth';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
  type CalendarEventInput,
} from './calendar';

type BookingContext = {
  eventId: string | null;
  refreshToken: string;
  event: CalendarEventInput;
};

/**
 * Flatten a member-supplied string to a single safe line: drop control
 * characters and collapse whitespace. The calendar event description is built by
 * joining labelled lines with "\n", so without this a member could put newlines
 * in their name/phone/notes to forge extra "fields" (e.g. a fake
 * "Client: someone-else" line) in the coach's calendar event. Cosmetic-spoofing
 * defence — values are sent to Google as JSON, so there is no API injection.
 * Uses a codepoint check (codepoints 0–31 and 127) rather than a regex range so
 * this source file contains no literal control bytes.
 */
function oneLine(value: string | null | undefined): string {
  const stripped = Array.from(value ?? '')
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code > 31 && code !== 127;
    })
    .join('');
  return stripped.replace(/\s+/g, ' ').trim();
}

/**
 * Load everything needed to build a calendar event for a booking. Returns null
 * when Google isn't configured, the booking is missing, or the coach hasn't
 * connected their calendar — i.e. there's nothing to sync.
 */
async function loadBookingContext(bookingId: string): Promise<BookingContext | null> {
  if (!googleConfigured()) return null;

  const admin = createSupabaseAdmin();
  const { data: booking } = await admin
    .from('bookings')
    .select('staff_id, client_id, service_id, location_id, starts_at, ends_at, notes, google_calendar_event_id')
    .eq('id', bookingId)
    .maybeSingle();
  if (!booking) return null;

  const [{ data: client }, { data: service }, { data: location }, { data: refreshToken }] = await Promise.all([
    admin.from('clients').select('full_name, email, phone').eq('id', booking.client_id).maybeSingle(),
    admin.from('services').select('name').eq('id', booking.service_id).maybeSingle(),
    admin.from('locations').select('name, address, suburb').eq('id', booking.location_id).maybeSingle(),
    // Refresh token is encrypted at rest in Vault — decrypt via service-role RPC.
    admin.rpc('get_staff_google_refresh_token', { p_staff_id: booking.staff_id }),
  ]);

  if (!refreshToken) return null; // coach hasn't connected their calendar

  // Member-controlled fields (name, email, phone, notes) are embedded line-by-line
  // in the description below; oneLine() neutralises newline-injection spoofing.
  const clientName = oneLine(client?.full_name) || client?.email || 'Client';
  const clientEmail = oneLine(client?.email);
  const clientPhone = oneLine(client?.phone);
  const bookingNotes = oneLine(booking.notes);
  const serviceName = service?.name || 'Training session';
  const locationLabel = location
    ? [location.name, location.address || location.suburb].filter(Boolean).join(', ') || undefined
    : undefined;

  const description = [
    `Client: ${clientName}`,
    clientEmail ? `Email: ${clientEmail}` : null,
    clientPhone ? `Phone: ${clientPhone}` : null,
    `Service: ${serviceName}`,
    bookingNotes ? `Notes: ${bookingNotes}` : null,
    '',
    'Booked via MODE Lab.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    eventId: booking.google_calendar_event_id,
    refreshToken,
    event: {
      summary: `${serviceName} — ${clientName}`,
      description,
      location: locationLabel,
      startIso: booking.starts_at,
      endIso: booking.ends_at,
      attendees: client?.email ? [{ email: client.email, displayName: clientName }] : undefined,
    },
  };
}

async function storeEventId(bookingId: string, eventId: string | null) {
  await createSupabaseAdmin()
    .from('bookings')
    .update({ google_calendar_event_id: eventId } as never)
    .eq('id', bookingId);
}

/**
 * Create a calendar event for a newly-booked session and persist its id.
 * No-ops when there's nothing to sync or an event already exists.
 */
export async function syncBookingToCalendar(bookingId: string): Promise<boolean> {
  const ctx = await loadBookingContext(bookingId);
  if (!ctx || ctx.eventId) return false; // nothing to do / already synced

  try {
    const eventId = await createCalendarEvent(ctx.refreshToken, ctx.event);
    await storeEventId(bookingId, eventId);
    return true;
  } catch (err) {
    console.warn(`[google-calendar] failed to create event for booking ${bookingId}:`, err);
    return false;
  }
}

/**
 * Reflect an edited booking (reschedule / detail change) on the calendar:
 * patch the existing event, or create one if none exists yet.
 */
export async function upsertBookingCalendar(bookingId: string): Promise<void> {
  const ctx = await loadBookingContext(bookingId);
  if (!ctx) return;

  try {
    if (ctx.eventId) {
      const stillExists = await updateCalendarEvent(ctx.refreshToken, ctx.eventId, ctx.event);
      if (stillExists) return;
      // Event was deleted out-of-band — fall through and recreate.
    }
    const eventId = await createCalendarEvent(ctx.refreshToken, ctx.event);
    await storeEventId(bookingId, eventId);
  } catch (err) {
    console.warn(`[google-calendar] failed to update event for booking ${bookingId}:`, err);
  }
}

/**
 * Remove a booking's calendar event (on cancellation) and clear the stored id.
 * Best-effort; safe to call on bookings that were never synced.
 */
export async function removeBookingFromCalendar(bookingId: string): Promise<void> {
  if (!googleConfigured()) return;

  const admin = createSupabaseAdmin();
  const { data: booking } = await admin
    .from('bookings')
    .select('staff_id, google_calendar_event_id')
    .eq('id', bookingId)
    .maybeSingle();
  if (!booking?.google_calendar_event_id) return;

  const { data: refreshToken } = await admin.rpc('get_staff_google_refresh_token', {
    p_staff_id: booking.staff_id,
  });
  if (!refreshToken) return;

  try {
    await deleteCalendarEvent(refreshToken, booking.google_calendar_event_id);
    await storeEventId(bookingId, null);
  } catch (err) {
    console.warn(`[google-calendar] failed to remove event for booking ${bookingId}:`, err);
  }
}
