'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/guards';
import { createSupabaseAdmin, createSupabaseServer } from '@/lib/supabase/server';
import {
  removeBookingFromCalendar,
  syncBookingToCalendar,
  upsertBookingCalendar,
} from '@/lib/google/booking-sync';

// Statuses where the session is off the calendar (event should be removed).
const CANCELLED_STATUSES = new Set([
  'cancelled_24hr_plus',
  'cancelled_under_24hr',
  'no_show',
  'rescheduled',
]);

const VALID_STATUS = new Set([
  'confirmed',
  'completed',
  'cancelled_24hr_plus',
  'cancelled_under_24hr',
  'no_show',
  'rescheduled',
]);

/** Read + validate the shared booking fields. Returns the row to write, or an error. */
async function buildBookingRow(formData: FormData) {
  const client_id = String(formData.get('client_id') ?? '');
  const service_id = String(formData.get('service_id') ?? '');
  const location_id = String(formData.get('location_id') ?? '');
  const startsLocal = String(formData.get('starts_at') ?? '');

  if (!client_id || !service_id || !location_id || !startsLocal) return null;

  const start = new Date(startsLocal); // datetime-local is interpreted in server tz
  if (Number.isNaN(start.getTime())) return null;

  const supabase = await createSupabaseServer();
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', service_id)
    .maybeSingle();
  const duration = (service as { duration_minutes: number } | null)?.duration_minutes ?? 45;
  const end = new Date(start.getTime() + duration * 60000);

  return {
    client_id,
    service_id,
    location_id,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
  };
}

/** Create a new booking for the signed-in trainer. */
export async function createBooking(formData: FormData) {
  const { staff } = await requireStaff();
  const row = await buildBookingRow(formData);
  if (!row) redirect('/portal/bookings/new?error=1');

  const supabase = await createSupabaseServer();
  const { data: created } = await supabase
    .from('bookings')
    .insert({ ...row, staff_id: staff.id, status: 'confirmed' } as never)
    .select('id')
    .single();

  const bookingId = (created as { id: string } | null)?.id;
  if (bookingId) await syncBookingToCalendar(bookingId); // adds to the coach's Google Calendar

  revalidatePath('/portal/schedule');
  revalidatePath('/portal');
  redirect('/portal/schedule?created=1');
}

// AUTHORIZATION MODEL (multi-coach) — DECISION, 2026-06.
// `updateBooking` / `cancelBooking` let ANY active staff member edit or cancel
// ANY coach's booking, and the clients list is shared. The studio is a single
// operator (Jack) at launch, so this is the handoff's "fine for a single trusted
// operator" case — no scoping needed.
// When a second coach is added and they should be siloed, scope writes to the
// owning coach: load the booking's `staff_id`, compare to the signed-in
// `staff.id`, and reject the mismatch (or allow only via a `client_assignments`
// link). Calendar sync already targets the booking's own coach, so scoping is a
// guard, not a rewrite.
/** Edit an existing booking (reschedule, change service/location/status). */
export async function updateBooking(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  const row = await buildBookingRow(formData);
  if (!id) redirect('/portal/schedule');
  if (!row) redirect(`/portal/bookings/${id}/edit?error=1`);

  const statusRaw = String(formData.get('status') ?? 'confirmed');
  const status = VALID_STATUS.has(statusRaw) ? statusRaw : 'confirmed';

  const supabase = await createSupabaseServer();
  await supabase
    .from('bookings')
    .update({ ...row, status } as never)
    .eq('id', id);

  // Keep Google Calendar in step: drop the event if cancelled/no-show,
  // otherwise patch it (or create one if the coach connected after booking).
  if (CANCELLED_STATUSES.has(status)) {
    await removeBookingFromCalendar(id);
  } else {
    await upsertBookingCalendar(id);
  }

  revalidatePath('/portal/schedule');
  revalidatePath('/portal');
  redirect('/portal/schedule?updated=1');
}

/** Add a weekly recurring availability block for the signed-in staff member. */
export async function addAvailability(formData: FormData) {
  const { staff } = await requireStaff();
  const weekday = Number(formData.get('weekday'));
  const start_time = String(formData.get('start_time') ?? '');
  const end_time = String(formData.get('end_time') ?? '');
  const locationRaw = String(formData.get('location_id') ?? '');

  if (Number.isNaN(weekday) || !start_time || !end_time) return;
  if (end_time <= start_time) return; // end must be after start

  const supabase = await createSupabaseServer();
  await supabase.from('staff_availability').insert({
    staff_id: staff.id,
    weekday,
    start_time,
    end_time,
    location_id: locationRaw && locationRaw !== 'any' ? locationRaw : null,
    is_active: true,
  } as never);
  revalidatePath('/portal/availability');
}

export async function deleteAvailability(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const supabase = await createSupabaseServer();
  await supabase.from('staff_availability').delete().eq('id', id);
  revalidatePath('/portal/availability');
}

export async function toggleAvailability(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  const next = String(formData.get('next') ?? '') === 'true';
  if (!id) return;
  const supabase = await createSupabaseServer();
  await supabase.from('staff_availability').update({ is_active: next } as never).eq('id', id);
  revalidatePath('/portal/availability');
}

/** Edit the time window and/or location of an existing availability block. */
export async function updateAvailability(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('id') ?? '');
  const start_time = String(formData.get('start_time') ?? '');
  const end_time = String(formData.get('end_time') ?? '');
  const locationRaw = String(formData.get('location_id') ?? '');

  if (!id || !start_time || !end_time) return;
  if (end_time <= start_time) return; // end must be after start

  const supabase = await createSupabaseServer();
  await supabase
    .from('staff_availability')
    .update({
      start_time,
      end_time,
      location_id: locationRaw && locationRaw !== 'any' ? locationRaw : null,
    } as never)
    .eq('id', id);
  revalidatePath('/portal/availability');
}

/** Staff-initiated cancellation (no client penalty). */
export async function cancelBooking(id: string) {
  await requireStaff();
  if (!id) return;
  const supabase = await createSupabaseServer();
  await supabase
    .from('bookings')
    .update({ status: 'cancelled_24hr_plus', cancellation_reason: 'Cancelled by staff' } as never)
    .eq('id', id);
  await removeBookingFromCalendar(id); // pull it off the coach's calendar
  revalidatePath('/portal/schedule');
  revalidatePath('/portal');
}

/** Save the signed-in coach's profile (display name, title, bio). */
export async function updateStaffProfile(formData: FormData) {
  const { staff } = await requireStaff();
  const display_name = String(formData.get('display_name') ?? '').trim().slice(0, 120);
  const title = String(formData.get('title') ?? '').trim().slice(0, 120);
  const bio = String(formData.get('bio') ?? '').trim().slice(0, 2000);

  const supabase = await createSupabaseServer();
  await supabase
    .from('staff')
    .update({ display_name: display_name || staff.display_name, title: title || null, bio: bio || null } as never)
    .eq('id', staff.id);

  revalidatePath('/portal/profile');
  revalidatePath('/portal');
}

/**
 * Mint a short-lived signed URL for a client document so staff can download it.
 * Files live in the private Supabase Storage `client-files` bucket and have no
 * public URL — the only way to hand one to the browser is a signed URL minted
 * server-side from the row's `storage_path`. Returns `{ error }` (never throws)
 * so the client button can surface a graceful message on dummy/missing objects.
 */
export async function getDocumentSignedUrl(
  documentId: string,
): Promise<{ url: string } | { error: string }> {
  await requireStaff();
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
    .createSignedUrl(storagePath, 60, { download: true }); // 60s, forces a download

  if (error || !data?.signedUrl) return { error: 'File unavailable.' };
  return { url: data.signedUrl };
}

/** Disconnect the signed-in coach's Google Calendar (clears stored tokens). */
export async function disconnectGoogleCalendar() {
  const { staff } = await requireStaff();
  const admin = createSupabaseAdmin();
  await admin.from('staff_google_credentials').delete().eq('staff_id', staff.id);
  await admin
    .from('staff')
    .update({
      google_calendar_email: null,
      google_calendar_connected_at: null,
    } as never)
    .eq('id', staff.id);
  revalidatePath('/portal/profile');
}
