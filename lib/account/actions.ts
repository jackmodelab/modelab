'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireClient } from '@/lib/auth/guards';
import { createSupabaseAdmin, createSupabaseServer } from '@/lib/supabase/server';
import { hasCompletedScreening } from '@/lib/screening/queries';
import { removeBookingFromCalendar, syncBookingToCalendar } from '@/lib/google/booking-sync';

/** Minutes since midnight for a 'HH:MM' / 'HH:MM:SS' time string. */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Changeover buffer (minutes) reserved after a session before the next slot can
 * open. Mirrors `bufferFor` in the booking UI: the 30- and 45-minute training
 * sessions carry a 15-minute buffer; other services get none.
 */
function bufferFor(durationMinutes: number): number {
  return durationMinutes === 30 || durationMinutes === 45 ? 15 : 0;
}

/**
 * Weekday (0=Sun..6=Sat) and minute-of-day for an instant, evaluated in the
 * clinic's timezone. Availability is stored as clinic wall-clock time, so we
 * must compare against the same zone — not the server's (UTC on Vercel).
 */
function clinicWeekdayMinute(date: Date): { weekday: number; minute: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Australia/Sydney',
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

/**
 * Member-initiated booking cancellation.
 * Applies the 24-hour policy: ≥24hr ahead → `cancelled_24hr_plus` (credit returns);
 * <24hr ahead → `cancelled_under_24hr` (credit consumed).
 * Credit-return bookkeeping happens on the server (TODO: wire to client_packages
 * once the credit-deduction model is decided — for now this only writes the
 * cancellation status and leaves sessions_remaining untouched).
 */
export async function cancelMemberBooking(formData: FormData) {
  const { client } = await requireClient();
  if (!client) redirect('/login');
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const supabase = await createSupabaseServer();

  // Fetch the booking to confirm ownership + compute lead time.
  const { data: booking } = await supabase
    .from('bookings')
    .select('id,client_id,starts_at,status')
    .eq('id', id)
    .maybeSingle();
  if (!booking || (booking as { client_id: string }).client_id !== client.id) return;

  const startsAt = new Date((booking as { starts_at: string }).starts_at);
  const hoursAhead = (startsAt.getTime() - Date.now()) / 36e5;
  const status = hoursAhead >= 24 ? 'cancelled_24hr_plus' : 'cancelled_under_24hr';

  await supabase
    .from('bookings')
    .update({ status, cancellation_reason: 'Cancelled by member' } as never)
    .eq('id', id);

  await removeBookingFromCalendar(id); // pull it off the coach's calendar

  revalidatePath('/account/bookings');
  revalidatePath('/account');
}

/**
 * Member-initiated session request. Clients have no RLS insert path into
 * `bookings`, so the write goes through the service-role admin client. The
 * booking is created as `confirmed` and, if the chosen coach has linked their
 * Google Calendar, the session is added to it (with the client invited).
 */
export async function requestBooking(formData: FormData) {
  const { client } = await requireClient();
  if (!client) redirect('/login');

  // The pre-screening health questionnaire is mandatory before booking.
  if (!(await hasCompletedScreening(client.id))) {
    redirect('/account/screening');
  }

  const serviceId = String(formData.get('service_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');
  const coachId = String(formData.get('coach_id') ?? '');
  const startsAt = String(formData.get('starts_at') ?? '');
  if (!serviceId || !locationId || !coachId || !startsAt) {
    redirect('/account/book?error=missing');
  }

  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) redirect('/account/book?error=missing');

  // Service-role client: bypasses RLS for the member insert (clients can't
  // insert into bookings directly). The form-supplied ids are untrusted, so we
  // verify each references an ACTIVE row and the slot sits inside the coach's
  // published availability — otherwise a forged form could create an incoherent
  // booking (inactive coach/service/location, or an out-of-hours slot).
  const admin = createSupabaseAdmin();
  const [{ data: service }, { data: location }, { data: coach }, { data: availability }] =
    await Promise.all([
      admin.from('services').select('duration_minutes, is_active').eq('id', serviceId).maybeSingle(),
      admin.from('locations').select('status').eq('id', locationId).maybeSingle(),
      admin.from('staff').select('is_active').eq('id', coachId).maybeSingle(),
      admin
        .from('staff_availability')
        .select('weekday, start_time, end_time, location_id, is_active')
        .eq('staff_id', coachId),
    ]);

  if (!service?.is_active || location?.status !== 'active' || !coach?.is_active) {
    redirect('/account/book?error=invalid');
  }

  const duration = service.duration_minutes ?? 45;
  const end = new Date(start.getTime() + duration * 60000);

  // Standard requests are auto-confirmed, so they must land on a real bookable
  // slot: on the hour, and entirely inside one of the coach's active
  // availability blocks for this location — session + changeover buffer (mirrors
  // the booking UI; evaluated in clinic timezone). Off-grid times go through
  // `requestCustomBooking` instead, where the trainer accepts manually.
  const { weekday, minute: slotMin } = clinicWeekdayMinute(start);
  const need = duration + bufferFor(duration);
  const fitsAvailability =
    slotMin % 60 === 0 &&
    (availability ?? []).some(
      (b) =>
        b.is_active &&
        b.weekday === weekday &&
        (b.location_id === null || b.location_id === locationId) &&
        timeToMinutes(b.start_time) <= slotMin &&
        slotMin + need <= timeToMinutes(b.end_time),
    );
  if (!fitsAvailability) {
    redirect('/account/book?error=unavailable');
  }

  const { data: created } = await admin
    .from('bookings')
    .insert({
      client_id: client.id,
      staff_id: coachId,
      service_id: serviceId,
      location_id: locationId,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      status: 'confirmed',
    } as never)
    .select('id')
    .single();

  const bookingId = (created as { id: string } | null)?.id;
  if (bookingId) await syncBookingToCalendar(bookingId); // adds to the coach's Google Calendar

  redirect(`/account/bookings?requested=1`);
}

/**
 * Member-initiated request for a SPECIFIC (off-grid) time. Unlike `requestBooking`,
 * the chosen time need not fall on a published availability slot — the client is
 * asking the trainer to make room. The booking is created as `pending` and is NOT
 * added to any calendar; the trainer accepts or declines it in the portal
 * (`acceptBookingRequest` / `declineBookingRequest`), and calendar sync happens
 * only on acceptance.
 */
export async function requestCustomBooking(formData: FormData) {
  const { client } = await requireClient();
  if (!client) redirect('/login');

  // The pre-screening health questionnaire is mandatory before booking.
  if (!(await hasCompletedScreening(client.id))) {
    redirect('/account/screening');
  }

  const serviceId = String(formData.get('service_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');
  const coachId = String(formData.get('coach_id') ?? '');
  const startsAt = String(formData.get('starts_at') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);
  if (!serviceId || !locationId || !coachId || !startsAt) {
    redirect('/account/book?error=missing');
  }

  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) redirect('/account/book?error=missing');
  // A request must be for a future time.
  if (start.getTime() <= Date.now()) redirect('/account/book?error=past');

  // Validate the referenced rows are active (the form ids are untrusted), but —
  // unlike the standard path — do NOT require the time to fit published
  // availability: requesting an off-grid time is the whole point here.
  const admin = createSupabaseAdmin();
  const [{ data: service }, { data: location }, { data: coach }] = await Promise.all([
    admin.from('services').select('duration_minutes, is_active').eq('id', serviceId).maybeSingle(),
    admin.from('locations').select('status').eq('id', locationId).maybeSingle(),
    admin.from('staff').select('is_active').eq('id', coachId).maybeSingle(),
  ]);

  if (!service?.is_active || location?.status !== 'active' || !coach?.is_active) {
    redirect('/account/book?error=invalid');
  }

  const duration = service.duration_minutes ?? 45;
  const end = new Date(start.getTime() + duration * 60000);

  await admin.from('bookings').insert({
    client_id: client.id,
    staff_id: coachId,
    service_id: serviceId,
    location_id: locationId,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    status: 'pending',
    notes: note || null,
  } as never);
  // No calendar sync — the event is created only when the trainer accepts.

  redirect(`/account/bookings?requested=1`);
}

/** Save profile updates (name + phone). Email is auth-managed and read-only here. */
export async function updateProfile(formData: FormData) {
  const { client } = await requireClient();
  if (!client) redirect('/login');

  const full_name = String(formData.get('full_name') ?? '').trim().slice(0, 120);
  const phone = String(formData.get('phone') ?? '').trim().slice(0, 40);

  const supabase = await createSupabaseServer();
  await supabase
    .from('clients')
    .update({ full_name: full_name || null, phone: phone || null } as never)
    .eq('id', client.id);

  revalidatePath('/account');
  revalidatePath('/account/profile');
}
