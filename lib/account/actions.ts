'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireActiveClient } from '@/lib/auth/guards';
import { createSupabaseAdmin, createSupabaseServer } from '@/lib/supabase/server';
import { hasCompletedScreening } from '@/lib/screening/queries';
import { removeBookingFromCalendar, syncBookingToCalendar } from '@/lib/google/booking-sync';
import {
  DEFAULT_DURATION_MINUTES,
  bufferFor,
  clinicWeekdayMinute,
  timeToMinutes,
} from '@/lib/booking/time';

/**
 * Statuses that actually occupy a coach's calendar. Used for the double-booking
 * overlap check (ARC-2): a slot is "taken" only by a confirmed/completed
 * session, not by a cancelled/no-show/rescheduled one, nor by another member's
 * still-pending (off-grid) request.
 */
const OCCUPYING_STATUSES = ['confirmed', 'completed'] as const;

/**
 * Marker appended to a booking's notes when the member opts to complete the
 * health pre-screening in person at their first session rather than online.
 * Surfaces on the staff schedule + requests views so the coach knows to screen
 * the client on arrival.
 */
const IN_PERSON_SCREENING_NOTE = 'Pre-screening: to complete in person';

/**
 * Member-initiated booking cancellation.
 * Applies the 24-hour policy: ≥24hr ahead → `cancelled_24hr_plus` (credit returns);
 * <24hr ahead → `cancelled_under_24hr` (credit consumed).
 * Credit-return bookkeeping happens on the server (TODO: wire to client_packages
 * once the credit-deduction model is decided — for now this only writes the
 * cancellation status and leaves sessions_remaining untouched).
 */
export async function cancelMemberBooking(formData: FormData) {
  const { client } = await requireActiveClient();
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

  // Members have NO direct RLS write path into `bookings` (the "bookings update
  // own" policy was dropped — see 20260620100000_restrict_member_booking_writes.sql)
  // so a member can't arbitrarily rewrite their bookings (time, coach, status)
  // via the public API. The cancel is performed with the service-role client
  // AFTER the ownership + lead-time checks above, double-scoped to this member's
  // own booking as a backstop.
  const admin = createSupabaseAdmin();
  await admin
    .from('bookings')
    .update({ status, cancellation_reason: 'Cancelled by member' } as never)
    .eq('id', id)
    .eq('client_id', client.id);

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
  const { client } = await requireActiveClient();
  if (!client) redirect('/login');

  // Pre-screening is recommended but optional: a member may instead choose to
  // complete it in person at their first session (the booking UI sends
  // `screening_in_person` when they do). Block only if they've neither completed
  // it online nor opted to do it in person.
  const screeningDone = await hasCompletedScreening(client.id);
  const screeningInPerson = !!formData.get('screening_in_person');
  if (!screeningDone && !screeningInPerson) {
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

  const duration = service.duration_minutes ?? DEFAULT_DURATION_MINUTES;
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

  // Double-booking guard (ARC-2): refuse if the coach already has a
  // confirmed/completed session overlapping [start, end). Two members hitting
  // the same open slot would otherwise both auto-confirm. A DB exclusion
  // constraint backs this up (20260615130000_booking_overlap_guard.sql); the
  // app check turns the race into a friendly redirect instead of a 500.
  const { data: clash } = await admin
    .from('bookings')
    .select('id')
    .eq('staff_id', coachId)
    .in('status', [...OCCUPYING_STATUSES])
    .lt('starts_at', end.toISOString())
    .gt('ends_at', start.toISOString())
    .limit(1);
  if (clash && clash.length > 0) {
    redirect('/account/book?error=taken');
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
      // A member who got here without completed screening chose the in-person
      // option above; flag it for the coach.
      notes: screeningDone ? null : IN_PERSON_SCREENING_NOTE,
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
  const { client } = await requireActiveClient();
  if (!client) redirect('/login');

  // Pre-screening is recommended but optional here too — see `requestBooking`.
  const screeningDone = await hasCompletedScreening(client.id);
  const screeningInPerson = !!formData.get('screening_in_person');
  if (!screeningDone && !screeningInPerson) {
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

  const duration = service.duration_minutes ?? DEFAULT_DURATION_MINUTES;
  const end = new Date(start.getTime() + duration * 60000);

  // Carry the member's note plus, for an in-person screening opt-in, the marker.
  const notes =
    [note, screeningDone ? '' : IN_PERSON_SCREENING_NOTE].filter(Boolean).join(' · ') || null;

  await admin.from('bookings').insert({
    client_id: client.id,
    staff_id: coachId,
    service_id: serviceId,
    location_id: locationId,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    status: 'pending',
    notes,
  } as never);
  // No calendar sync — the event is created only when the trainer accepts.

  redirect(`/account/bookings?requested=1`);
}

/**
 * Mint a short-lived signed URL for one of the signed-in client's own shared
 * documents. The `documents` RLS ("read own") already scopes reads to the
 * caller, so a row that isn't theirs simply returns null here. Returns
 * `{ url }` or `{ error }` (never throws) for a graceful download button.
 */
export async function getMyDocumentSignedUrl(
  documentId: string,
): Promise<{ url: string } | { error: string }> {
  const { client } = await requireActiveClient();
  if (!client) return { error: 'Please sign in.' };
  if (!documentId) return { error: 'Missing document.' };

  const supabase = await createSupabaseServer();
  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', documentId)
    .maybeSingle();

  const storagePath = (doc as { storage_path: string } | null)?.storage_path;
  if (!storagePath) return { error: 'File not found.' };

  const { data, error } = await supabase.storage
    .from('client-files')
    .createSignedUrl(storagePath, 60, { download: true });

  if (error || !data?.signedUrl) return { error: 'File unavailable.' };
  return { url: data.signedUrl };
}

/** Save profile updates (name + phone). Email is auth-managed and read-only here. */
export async function updateProfile(formData: FormData) {
  const { client } = await requireActiveClient();
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
